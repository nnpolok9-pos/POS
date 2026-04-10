const fs = require("fs");
const path = require("path");
const Product = require("../models/Product");
const InventoryMovement = require("../models/InventoryMovement");
const generateSku = require("../utils/generateSku");
const STOCK_UNITS = ["pieces", "gram", "teaspoon"];
const parseExpiryDate = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildImagePath = (file) => (file ? `/uploads/products/${file.filename}` : "");

const parseComboItemsInput = (comboItems) => {
  if (!comboItems) {
    return [];
  }

  if (typeof comboItems === "string") {
    try {
      return JSON.parse(comboItems);
    } catch {
      return [];
    }
  }

  return comboItems;
};

const buildComboItems = (comboItems = []) =>
  comboItems
    .map((item) => ({
      product: item.product,
      quantity: Number(item.quantity),
      changeable: item.changeable === true || item.changeable === "true",
      alternativeProducts: Array.isArray(item.alternativeProducts)
        ? item.alternativeProducts
            .map((alternativeProduct) => {
              if (!alternativeProduct) {
                return null;
              }

              if (typeof alternativeProduct === "string") {
                return {
                  product: alternativeProduct,
                  priceAdjustment: 0
                };
              }

              return {
                product: alternativeProduct.product || alternativeProduct.id || "",
                priceAdjustment: Number(alternativeProduct.priceAdjustment || 0)
              };
            })
            .filter((alternativeProduct) => alternativeProduct?.product)
        : []
    }))
    .filter((item) => item.product && item.quantity > 0);

const COMPOSITE_PRODUCT_TYPES = ["combo", "combo_type"];

const inferProductType = (product) => {
  if (product?.productType === "combo") {
    return "combo";
  }

  if (product?.productType === "combo_type") {
    return "combo_type";
  }

  if (product?.productType === "raw_material") {
    return "raw_material";
  }

  if (product?.productType === "sauce") {
    return "sauce";
  }

  if (product?.productType === "seasoning") {
    return "seasoning";
  }

  if (Array.isArray(product?.comboItems) && product.comboItems.length > 0) {
    return "combo";
  }

  return "raw";
};

const isCompositeProductType = (productType) => COMPOSITE_PRODUCT_TYPES.includes(productType);
const isBaseProductType = (product) => !isCompositeProductType(inferProductType(product));

const syncAvailability = (product) => {
  if (isCompositeProductType(inferProductType(product))) {
    product.isActive = true;
    return product;
  }

  product.isActive = product.stock > 0;
  return product;
};

const resolvePricing = ({ price, regularPrice, promotionalPrice }) => {
  const normalizedPromotionalPrice =
    promotionalPrice !== undefined && promotionalPrice !== null && promotionalPrice !== ""
      ? Number(promotionalPrice)
      : Number(price);
  const normalizedRegularPrice =
    regularPrice !== undefined && regularPrice !== null && regularPrice !== ""
      ? Number(regularPrice)
      : normalizedPromotionalPrice;

  return {
    price: normalizedPromotionalPrice,
    promotionalPrice: normalizedPromotionalPrice,
    regularPrice: normalizedRegularPrice
  };
};

const recordInventoryMovement = async ({ product, previousStock, newStock, performedBy, movementType, reason = "" }) => {
  const difference = Number(newStock) - Number(previousStock);

  if (difference === 0) {
    return;
  }

  await InventoryMovement.create({
    product: product._id,
    productName: product.name,
    sku: product.sku,
    category: product.category,
    stockUnit: product.stockUnit || "pieces",
    movementType: movementType || (difference > 0 ? "received" : "deducted"),
    quantity: Math.abs(difference),
    previousStock,
    newStock,
    performedBy: performedBy || null,
    reason
  });
};

const buildCompositeRequirements = (product, productMap, multiplier = 1, trail = new Set()) => {
  const normalizedType = inferProductType(product);
  const productId = String(product?._id || "");

  if (!isCompositeProductType(normalizedType)) {
    return new Map([[productId, multiplier]]);
  }

  if (!product?.comboItems?.length) {
    return null;
  }

  if (trail.has(productId)) {
    return null;
  }

  const nextTrail = new Set(trail);
  nextTrail.add(productId);
  const requirements = new Map();

  for (const comboItem of product.comboItems) {
    const linkedProduct = productMap.get(String(comboItem.product?._id || comboItem.product));

    if (!linkedProduct) {
      return null;
    }

    const nestedRequirements = buildCompositeRequirements(
      linkedProduct,
      productMap,
      multiplier * Number(comboItem.quantity || 0),
      nextTrail
    );

    if (!nestedRequirements) {
      return null;
    }

    nestedRequirements.forEach((quantity, productKey) => {
      requirements.set(productKey, (requirements.get(productKey) || 0) + quantity);
    });
  }

  return requirements;
};

const calculateComboAvailability = (product, productMap) => {
  if (!isCompositeProductType(inferProductType(product))) {
    return {
      stock: product.stock,
      isActive: product.isActive,
      lowStock: product.stock <= product.lowStockThreshold
    };
  }

  const requirements = buildCompositeRequirements(product, productMap);

  if (!requirements?.size) {
    return { stock: 0, isActive: false, lowStock: true };
  }

  let availableStock = Infinity;

  for (const [requiredProductId, requiredQuantity] of requirements.entries()) {
    const rawProduct = productMap.get(requiredProductId);

    if (!rawProduct || !isBaseProductType(rawProduct) || requiredQuantity <= 0) {
      return { stock: 0, isActive: false, lowStock: true };
    }

    availableStock = Math.min(availableStock, Math.floor(rawProduct.stock / requiredQuantity));
  }

  const stock = Number.isFinite(availableStock) ? availableStock : 0;
  return {
    stock,
    isActive: stock > 0,
    lowStock: stock <= 5
  };
};

const serializeProducts = async (products) => {
  const populatedProducts = await Product.populate(products, {
    path: "comboItems.product comboItems.alternativeProducts.product",
    select: "name sku stock productType stockUnit"
  });

  const productMap = new Map(populatedProducts.map((product) => [String(product._id), product]));

  return populatedProducts.map((product) => {
    const serialized = product.toJSON();
    const availability = calculateComboAvailability(product, productMap);
    const promotionalPrice = Number(product.promotionalPrice ?? product.price ?? 0);
    const regularPrice = Number(product.regularPrice ?? promotionalPrice);

    return {
      ...serialized,
      price: promotionalPrice,
      promotionalPrice,
      regularPrice,
      productType: inferProductType(product),
      stock: availability.stock,
      isActive: availability.isActive,
      lowStock: availability.lowStock,
      comboItems: (serialized.comboItems || []).map((comboItem) => ({
        product: comboItem.product?.id || comboItem.product?._id || comboItem.product,
        productName: comboItem.product?.name || "",
        sku: comboItem.product?.sku || "",
        stockUnit: comboItem.product?.stockUnit || "pieces",
        productType: comboItem.product?.productType || "raw",
        quantity: comboItem.quantity,
        changeable: comboItem.changeable === true,
        alternativeProducts: (comboItem.alternativeProducts || []).map((alternativeProduct) => ({
          id:
            alternativeProduct.product?.id ||
            alternativeProduct.product?._id ||
            alternativeProduct.product ||
            alternativeProduct.id ||
            alternativeProduct._id ||
            alternativeProduct,
          name: alternativeProduct.product?.name || alternativeProduct.name || "",
          sku: alternativeProduct.product?.sku || alternativeProduct.sku || "",
          productType: alternativeProduct.product?.productType || alternativeProduct.productType || "raw",
          stockUnit: alternativeProduct.product?.stockUnit || alternativeProduct.stockUnit || "pieces",
          priceAdjustment: Number(alternativeProduct.priceAdjustment || 0)
        }))
      }))
    };
  });
};

const toBoolean = (value, fallback = true) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }

    if (value.toLowerCase() === "false") {
      return false;
    }
  }

  return fallback;
};

const createProduct = async (req, res) => {
  const {
    name,
    khmerName = "",
    price,
    regularPrice,
    promotionalPrice,
    category,
    khmerCategory = "",
    stock,
    sku,
    productType = "raw",
    stockUnit = "pieces",
    description = "",
    khmerDescription = ""
  } = req.body;
  const comboItems = buildComboItems(parseComboItemsInput(req.body.comboItems));
  const forSale = toBoolean(req.body.forSale, true);
  const expiryDate = parseExpiryDate(req.body.expiryDate);
  const seasoningPerOrderConsumption = Math.max(0, Number(req.body.seasoningPerOrderConsumption || 0));
  const pricing = resolvePricing({ price, regularPrice, promotionalPrice });

  if (!name || category === undefined || regularPrice === undefined || promotionalPrice === undefined) {
    return res.status(400).json({ message: "Name, regular price, promotional price, and category are required" });
  }

  if (pricing.regularPrice < 0 || pricing.promotionalPrice < 0 || Number(stock ?? 0) < 0) {
    return res.status(400).json({ message: "Prices and stock must be zero or greater" });
  }

  if (!["raw", "raw_material", "sauce", "seasoning", "combo", "combo_type"].includes(productType)) {
    return res.status(400).json({ message: "Invalid product type" });
  }

  if (!STOCK_UNITS.includes(stockUnit)) {
    return res.status(400).json({ message: "Invalid stock unit" });
  }

  if (req.body.expiryDate && !expiryDate) {
    return res.status(400).json({ message: "Invalid expiry date" });
  }

  if (isCompositeProductType(productType) && comboItems.length === 0) {
    return res.status(400).json({ message: "Combo products must include raw item composition" });
  }

  const product = await Product.create(
    syncAvailability({
      name,
      khmerName: String(khmerName || "").trim(),
      price: pricing.price,
      regularPrice: pricing.regularPrice,
      promotionalPrice: pricing.promotionalPrice,
      category,
      khmerCategory: String(khmerCategory || "").trim(),
      description: String(description || "").trim(),
      khmerDescription: String(khmerDescription || "").trim(),
      stock: isCompositeProductType(productType) ? 0 : Number(stock ?? 0),
      stockUnit,
      seasoningPerOrderConsumption: productType === "seasoning" ? seasoningPerOrderConsumption : 0,
      expiryDate: isCompositeProductType(productType) ? null : expiryDate,
      productType,
      comboItems,
      forSale,
      sku: sku || generateSku(name, category),
      image: buildImagePath(req.file)
    })
  );

  if (isBaseProductType(product) && product.stock > 0) {
    await recordInventoryMovement({
      product,
      previousStock: 0,
      newStock: product.stock,
      performedBy: req.user?._id,
      movementType: "received"
    });
  }

  const [serialized] = await serializeProducts([product]);
  res.status(201).json(serialized);
};

const getProducts = async (req, res) => {
  const { category, search, includeInactive } = req.query;
  const filter = {};

  if (category) {
    filter.category = category;
  }

  if (search) {
    filter.name = { $regex: search, $options: "i" };
  }

  const products = await Product.find(filter).sort({ category: 1, name: 1 });
  const serialized = await serializeProducts(products);

  res.json(includeInactive === "true" ? serialized : serialized.filter((product) => product.isActive && product.forSale));
};

const getAdminProducts = async (req, res) => {
  const products = await Product.find({}).sort({ createdAt: -1 });
  const serialized = await serializeProducts(products);
  res.json(serialized);
};

const updateProductStock = async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  if (!isBaseProductType(product)) {
    return res.status(400).json({ message: "Combo stock is derived from raw item inventory" });
  }

  const receivedQuantity = Number(req.body.receivedQuantity);
  if (Number.isNaN(receivedQuantity) || receivedQuantity <= 0) {
    return res.status(400).json({ message: "Received quantity must be greater than zero" });
  }

  const previousStock = product.stock;
  product.stock = previousStock + receivedQuantity;
  syncAvailability(product);
  await product.save();
  await recordInventoryMovement({
    product,
    previousStock,
    newStock: product.stock,
    performedBy: req.user?._id,
    movementType: "received"
  });

  const [serialized] = await serializeProducts([product]);
  res.json(serialized);
};

const updateProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  const nextImage = req.file ? buildImagePath(req.file) : product.image;
  const oldImage = req.file && product.image ? path.join(process.cwd(), "src", product.image.replace(/^\//, "")) : null;
  const previousStock = product.stock;
  const nextProductType = req.body.productType || product.productType || "raw";
  const nextExpiryDate = req.body.expiryDate !== undefined ? parseExpiryDate(req.body.expiryDate) : product.expiryDate;
  const nextSeasoningPerOrderConsumption =
    req.body.seasoningPerOrderConsumption !== undefined
      ? Math.max(0, Number(req.body.seasoningPerOrderConsumption || 0))
      : product.seasoningPerOrderConsumption || 0;
  const comboItems =
    req.body.comboItems !== undefined
      ? buildComboItems(parseComboItemsInput(req.body.comboItems))
      : buildComboItems(product.comboItems || []);
  const pricing = resolvePricing({
    price: req.body.price ?? product.price,
    regularPrice: req.body.regularPrice ?? product.regularPrice ?? product.price,
    promotionalPrice: req.body.promotionalPrice ?? product.promotionalPrice ?? product.price
  });

  product.name = req.body.name ?? product.name;
  product.khmerName = req.body.khmerName !== undefined ? String(req.body.khmerName || "").trim() : product.khmerName;
  product.price = pricing.price;
  product.regularPrice = pricing.regularPrice;
  product.promotionalPrice = pricing.promotionalPrice;
  product.category = req.body.category ?? product.category;
  product.khmerCategory =
    req.body.khmerCategory !== undefined ? String(req.body.khmerCategory || "").trim() : product.khmerCategory;
  product.description = req.body.description !== undefined ? String(req.body.description || "").trim() : product.description;
  product.khmerDescription =
    req.body.khmerDescription !== undefined ? String(req.body.khmerDescription || "").trim() : product.khmerDescription;
  product.stockUnit = req.body.stockUnit || product.stockUnit || "pieces";
  product.productType = nextProductType;
  product.seasoningPerOrderConsumption = product.productType === "seasoning" ? nextSeasoningPerOrderConsumption : 0;
  product.expiryDate = isCompositeProductType(product.productType) ? null : nextExpiryDate;
  product.forSale = req.body.forSale !== undefined ? toBoolean(req.body.forSale, product.forSale ?? true) : product.forSale ?? true;
  product.stock = isCompositeProductType(product.productType) ? 0 : req.body.stock !== undefined ? Number(req.body.stock) : product.stock;
  product.comboItems = isCompositeProductType(product.productType) ? comboItems : [];
  product.sku = req.body.sku || product.sku || generateSku(product.name, product.category);
  product.image = nextImage;

  if (product.price < 0 || Number(product.regularPrice || 0) < 0 || Number(product.promotionalPrice || 0) < 0 || product.stock < 0) {
    return res.status(400).json({ message: "Prices and stock must be zero or greater" });
  }

  if (!["raw", "raw_material", "sauce", "seasoning", "combo", "combo_type"].includes(product.productType)) {
    return res.status(400).json({ message: "Invalid product type" });
  }

  if (!STOCK_UNITS.includes(product.stockUnit)) {
    return res.status(400).json({ message: "Invalid stock unit" });
  }

  if (req.body.expiryDate !== undefined && req.body.expiryDate !== "" && !product.expiryDate) {
    return res.status(400).json({ message: "Invalid expiry date" });
  }

  if (isCompositeProductType(product.productType) && product.comboItems.length === 0) {
    return res.status(400).json({ message: "Combo products must include raw item composition" });
  }

  syncAvailability(product);

  await product.save();

  if (isBaseProductType(product)) {
    await recordInventoryMovement({
      product,
      previousStock,
      newStock: product.stock,
      performedBy: req.user?._id
    });
  }

  if (oldImage && fs.existsSync(oldImage)) {
    fs.unlinkSync(oldImage);
  }

  const [serialized] = await serializeProducts([product]);
  res.json(serialized);
};

const deductProductStock = async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  if (!isBaseProductType(product)) {
    return res.status(400).json({ message: "Combo stock is derived from raw item inventory" });
  }

  const deductionQuantity = Number(req.body.deductionQuantity);
  const reason = String(req.body.reason || "").trim();

  if (Number.isNaN(deductionQuantity) || deductionQuantity <= 0) {
    return res.status(400).json({ message: "Deduction quantity must be greater than zero" });
  }

  if (!reason) {
    return res.status(400).json({ message: "Deduction reason is required" });
  }

  if (deductionQuantity > product.stock) {
    return res.status(400).json({ message: `Only ${product.stock} units available to deduct` });
  }

  const previousStock = product.stock;
  product.stock = previousStock - deductionQuantity;
  syncAvailability(product);
  await product.save();
  await recordInventoryMovement({
    product,
    previousStock,
    newStock: product.stock,
    performedBy: req.user?._id,
    movementType: "deducted",
    reason
  });

  const [serialized] = await serializeProducts([product]);
  res.json(serialized);
};

const deleteProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  if (product.image) {
    const imagePath = path.join(process.cwd(), "src", product.image.replace(/^\//, ""));
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }

  await product.deleteOne();
  res.json({ message: "Product deleted" });
};

module.exports = {
  createProduct,
  getProducts,
  getAdminProducts,
  updateProductStock,
  deductProductStock,
  updateProduct,
  deleteProduct
};
