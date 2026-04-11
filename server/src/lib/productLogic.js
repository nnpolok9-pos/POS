const fs = require("fs");
const path = require("path");
const generateSku = require("../utils/generateSku");
const { getAllProducts, getProductById, saveProduct, saveInventoryMovement, deleteProductById } = require("./dataStore");

const STOCK_UNITS = ["pieces", "gram", "teaspoon"];
const COMPOSITE_PRODUCT_TYPES = ["combo", "combo_type"];
const PRODUCT_TYPES = ["raw", "raw_material", "sauce", "seasoning", "combo", "combo_type"];

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

const inferProductType = (product) => {
  if (PRODUCT_TYPES.includes(product?.productType)) {
    return product.productType;
  }

  // Only fall back to combo detection when old records are missing productType.
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

  product.isActive = Number(product.stock || 0) > 0;
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

  await saveInventoryMovement({
    product: product.id,
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
  const productId = String(product?.id || product?._id || "");

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
    const linkedProduct = productMap.get(String(comboItem.product?.id || comboItem.product?._id || comboItem.product));

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
      stock: Number(product.stock || 0),
      isActive: Boolean(product.isActive),
      lowStock: Number(product.stock || 0) <= Number(product.lowStockThreshold || 5)
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

    availableStock = Math.min(availableStock, Math.floor((Number(rawProduct.stock) || 0) / requiredQuantity));
  }

  const stock = Number.isFinite(availableStock) ? availableStock : 0;
  return {
    stock,
    isActive: stock > 0,
    lowStock: stock <= 5
  };
};

const populateComboProducts = (products) => {
  const productMap = new Map(products.map((product) => [String(product.id || product._id), product]));

  return products.map((product) => ({
    ...product,
    comboItems: (product.comboItems || []).map((comboItem) => {
      const linkedProduct = productMap.get(String(comboItem.product?.id || comboItem.product?._id || comboItem.product));
      return {
        product: linkedProduct?.id || linkedProduct?._id || comboItem.product,
        productName: linkedProduct?.name || "",
        sku: linkedProduct?.sku || "",
        stockUnit: linkedProduct?.stockUnit || "pieces",
        productType: inferProductType(linkedProduct || { productType: "raw" }),
        quantity: Number(comboItem.quantity || 0),
        changeable: comboItem.changeable === true,
        alternativeProducts: (comboItem.alternativeProducts || []).map((alternativeProduct) => {
          const linkedAlternative = productMap.get(
            String(
              alternativeProduct.product?.id ||
                alternativeProduct.product?._id ||
                alternativeProduct.product ||
                alternativeProduct.id ||
                alternativeProduct
            )
          );

          return {
            id: linkedAlternative?.id || linkedAlternative?._id || alternativeProduct.product || alternativeProduct.id || "",
            name: linkedAlternative?.name || alternativeProduct.name || "",
            sku: linkedAlternative?.sku || alternativeProduct.sku || "",
            productType: inferProductType(linkedAlternative || { productType: "raw" }),
            stockUnit: linkedAlternative?.stockUnit || alternativeProduct.stockUnit || "pieces",
            priceAdjustment: Number(alternativeProduct.priceAdjustment || 0)
          };
        })
      };
    })
  }));
};

const serializeProducts = async (products) => {
  const populatedProducts = populateComboProducts(products);
  const productMap = new Map(populatedProducts.map((product) => [String(product.id || product._id), product]));

  return populatedProducts.map((product) => {
    const availability = calculateComboAvailability(product, productMap);
    const promotionalPrice = Number(product.promotionalPrice ?? product.price ?? 0);
    const regularPrice = Number(product.regularPrice ?? promotionalPrice);

    return {
      ...product,
      price: promotionalPrice,
      promotionalPrice,
      regularPrice,
      productType: inferProductType(product),
      stock: availability.stock,
      isActive: availability.isActive,
      lowStock: availability.lowStock
    };
  });
};

const loadAllProducts = async () => {
  const products = await getAllProducts();
  return products;
};

const removeImageFile = (imagePath) => {
  if (!imagePath) {
    return;
  }

  const fullPath = path.join(process.cwd(), "src", imagePath.replace(/^\//, ""));
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
};

const saveProductRecord = async (product) => {
  const saved = await saveProduct(product);
  return serializeProducts([saved]).then(([serialized]) => serialized);
};

module.exports = {
  STOCK_UNITS,
  parseExpiryDate,
  buildImagePath,
  parseComboItemsInput,
  buildComboItems,
  inferProductType,
  isCompositeProductType,
  isBaseProductType,
  syncAvailability,
  resolvePricing,
  recordInventoryMovement,
  buildCompositeRequirements,
  calculateComboAvailability,
  serializeProducts,
  loadAllProducts,
  removeImageFile,
  saveProductRecord,
  getProductById,
  saveProduct,
  deleteProductById,
  generateSku
};
