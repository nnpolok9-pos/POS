const {
  STOCK_UNITS,
  parseExpiryDate,
  buildImagePath,
  parseComboItemsInput,
  buildComboItems,
  isCompositeProductType,
  isBaseProductType,
  syncAvailability,
  resolvePricing,
  recordInventoryMovement,
  serializeProducts,
  loadAllProducts,
  removeImageFile,
  getProductById,
  saveProduct,
  deleteProductById,
  generateSku
} = require("../lib/productLogic");
const { getAllProductsAdmin } = require("../lib/dataStore");

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
  const pricing = productType === "raw_material" ? resolvePricing({ price: 0, regularPrice: 0, promotionalPrice: 0 }) : resolvePricing({ price, regularPrice, promotionalPrice });

  if (!name || category === undefined || (productType !== "raw_material" && (regularPrice === undefined || promotionalPrice === undefined))) {
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

  const product = syncAvailability({
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
    comboItems: isCompositeProductType(productType) ? comboItems : [],
    forSale,
    sku: sku || generateSku(name, category),
    image: buildImagePath(req.file),
    lowStockThreshold: 5
  });

  const savedProduct = await saveProduct(product);

  if (isBaseProductType(savedProduct) && Number(savedProduct.stock) > 0) {
    await recordInventoryMovement({
      product: savedProduct,
      previousStock: 0,
      newStock: savedProduct.stock,
      performedBy: req.user?.id,
      movementType: "received"
    });
  }

  const [serialized] = await serializeProducts([savedProduct]);
  res.status(201).json(serialized);
};

const getProducts = async (req, res) => {
  const { category, search, includeInactive } = req.query;
  let products = await loadAllProducts();

  if (category) {
    products = products.filter((product) => product.category === category);
  }

  if (search) {
    const normalized = String(search).toLowerCase();
    products = products.filter((product) => product.name.toLowerCase().includes(normalized));
  }

  const serialized = await serializeProducts(products);
  res.json(includeInactive === "true" ? serialized : serialized.filter((product) => product.isActive && product.forSale));
};

const getAdminProducts = async (_req, res) => {
  const products = await getAllProductsAdmin();
  const serialized = await serializeProducts(products);
  res.json(serialized);
};

const updateProductStock = async (req, res) => {
  const product = await getProductById(req.params.id);

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

  const nextExpiryDate =
    req.body.expiryDate !== undefined && req.body.expiryDate !== "" ? parseExpiryDate(req.body.expiryDate) : null;

  if (req.body.expiryDate !== undefined && req.body.expiryDate !== "" && !nextExpiryDate) {
    return res.status(400).json({ message: "Invalid expiry date" });
  }

  const previousStock = product.stock;
  product.stock = previousStock + receivedQuantity;
  if (nextExpiryDate) {
    product.expiryDate = nextExpiryDate;
  }
  syncAvailability(product);
  const savedProduct = await saveProduct(product);
  await recordInventoryMovement({
    product: savedProduct,
    previousStock,
    newStock: savedProduct.stock,
    performedBy: req.user?.id,
    movementType: "received",
    reason: nextExpiryDate ? `Stock added | Expiry date: ${req.body.expiryDate}` : "Stock added"
  });

  const [serialized] = await serializeProducts([savedProduct]);
  res.json(serialized);
};

const updateProduct = async (req, res) => {
  const product = await getProductById(req.params.id);

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  const nextImage = req.file ? buildImagePath(req.file) : product.image;
  const previousImage = product.image;
  const previousStock = product.stock;
  const nextProductType = req.body.productType || product.productType || "raw";
  const nextExpiryDate = req.body.expiryDate !== undefined ? parseExpiryDate(req.body.expiryDate) : product.expiryDate;
  const nextSeasoningPerOrderConsumption =
    req.body.seasoningPerOrderConsumption !== undefined
      ? Math.max(0, Number(req.body.seasoningPerOrderConsumption || 0))
      : product.seasoningPerOrderConsumption || 0;
  const comboItems =
    req.body.comboItems !== undefined ? buildComboItems(parseComboItemsInput(req.body.comboItems)) : buildComboItems(product.comboItems || []);
  const pricing =
    nextProductType === "raw_material"
      ? resolvePricing({ price: 0, regularPrice: 0, promotionalPrice: 0 })
      : resolvePricing({
          price: req.body.price ?? product.price,
          regularPrice: req.body.regularPrice ?? product.regularPrice ?? product.price,
          promotionalPrice: req.body.promotionalPrice ?? product.promotionalPrice ?? product.price
        });

  Object.assign(product, {
    name: req.body.name ?? product.name,
    khmerName: req.body.khmerName !== undefined ? String(req.body.khmerName || "").trim() : product.khmerName,
    price: pricing.price,
    regularPrice: pricing.regularPrice,
    promotionalPrice: pricing.promotionalPrice,
    category: req.body.category ?? product.category,
    khmerCategory: req.body.khmerCategory !== undefined ? String(req.body.khmerCategory || "").trim() : product.khmerCategory,
    description: req.body.description !== undefined ? String(req.body.description || "").trim() : product.description,
    khmerDescription:
      req.body.khmerDescription !== undefined ? String(req.body.khmerDescription || "").trim() : product.khmerDescription,
    stockUnit: req.body.stockUnit || product.stockUnit || "pieces",
    productType: nextProductType,
    seasoningPerOrderConsumption: nextProductType === "seasoning" ? nextSeasoningPerOrderConsumption : 0,
    expiryDate: isCompositeProductType(nextProductType) ? null : nextExpiryDate,
    forSale: req.body.forSale !== undefined ? toBoolean(req.body.forSale, product.forSale ?? true) : product.forSale ?? true,
    stock: isCompositeProductType(nextProductType) ? 0 : req.body.stock !== undefined ? Number(req.body.stock) : product.stock,
    comboItems: isCompositeProductType(nextProductType) ? comboItems : [],
    sku: req.body.sku || product.sku || generateSku(product.name, product.category),
    image: nextImage
  });

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
  const savedProduct = await saveProduct(product);

  if (isBaseProductType(savedProduct)) {
    await recordInventoryMovement({
      product: savedProduct,
      previousStock,
      newStock: savedProduct.stock,
      performedBy: req.user?.id
    });
  }

  if (req.file && previousImage && previousImage !== nextImage) {
    removeImageFile(previousImage);
  }

  const [serialized] = await serializeProducts([savedProduct]);
  res.json(serialized);
};

const deductProductStock = async (req, res) => {
  const product = await getProductById(req.params.id);

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
  const savedProduct = await saveProduct(product);
  await recordInventoryMovement({
    product: savedProduct,
    previousStock,
    newStock: savedProduct.stock,
    performedBy: req.user?.id,
    movementType: "deducted",
    reason
  });

  const [serialized] = await serializeProducts([savedProduct]);
  res.json(serialized);
};

const deleteProduct = async (req, res) => {
  const product = await getProductById(req.params.id);

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  removeImageFile(product.image);
  await deleteProductById(product.id);
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
