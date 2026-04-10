const InventoryMovement = require("../models/InventoryMovement");
const Order = require("../models/Order");
const Product = require("../models/Product");

const COMPLETED_STATUSES = ["completed", "confirmed"];

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

const COMPOSITE_PRODUCT_TYPES = ["combo", "combo_type"];
const isCompositeProductType = (productType) => COMPOSITE_PRODUCT_TYPES.includes(productType);
const isBaseProductType = (product) => !isCompositeProductType(inferProductType(product));

const buildCompositeRequirements = (product, productMap, multiplier = 1, trail = new Set()) => {
  const normalizedType = inferProductType(product);
  const productId = String(product?._id || "");

  if (!isCompositeProductType(normalizedType)) {
    return new Map([[productId, multiplier]]);
  }

  if (!product?.comboItems?.length || trail.has(productId)) {
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

    nestedRequirements.forEach((quantity, key) => {
      requirements.set(key, (requirements.get(key) || 0) + quantity);
    });
  }

  return requirements;
};

const buildDateRange = (from, to) => {
  const start = from ? new Date(`${from}T00:00:00.000`) : null;
  const end = to ? new Date(`${to}T23:59:59.999`) : null;
  return { start, end };
};

const getDaysUntilExpiry = (expiryDate) => {
  if (!expiryDate) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const getInventoryReport = async (req, res) => {
  const { from, to } = req.query;
  const { start, end } = buildDateRange(from, to);
  const receivedMatch = { movementType: "received" };
  const deductedMatch = { movementType: "deducted" };
  const orderMatch = { status: { $in: COMPLETED_STATUSES } };
  const movementHistoryMatch = {};

  if (start || end) {
    receivedMatch.createdAt = {};
    deductedMatch.createdAt = {};
    orderMatch.servedAt = {};
    movementHistoryMatch.createdAt = {};

    if (start) {
      receivedMatch.createdAt.$gte = start;
      deductedMatch.createdAt.$gte = start;
      orderMatch.servedAt.$gte = start;
      movementHistoryMatch.createdAt.$gte = start;
    }

    if (end) {
      receivedMatch.createdAt.$lte = end;
      deductedMatch.createdAt.$lte = end;
      orderMatch.servedAt.$lte = end;
      movementHistoryMatch.createdAt.$lte = end;
    }
  }

  const [products, receivedRows, deductedRows, movementHistory, completedOrders] = await Promise.all([
    Product.find({}).populate("comboItems.product", "name sku stock productType").sort({ category: 1, name: 1 }),
    InventoryMovement.aggregate([
      { $match: receivedMatch },
      {
        $group: {
          _id: "$product",
          receivedQuantity: { $sum: "$quantity" },
          lastReceivedAt: { $max: "$createdAt" }
        }
      }
    ]),
    InventoryMovement.aggregate([
      { $match: deductedMatch },
      {
        $group: {
          _id: "$product",
          deductedQuantity: { $sum: "$quantity" },
          lastDeductedAt: { $max: "$createdAt" }
        }
      }
    ]),
    InventoryMovement.find(movementHistoryMatch)
      .populate("performedBy", "name email role")
      .sort({ createdAt: -1 })
      .limit(100),
    Order.find({ ...orderMatch }).select("items sauceItems")
  ]);

  const receivedMap = new Map(receivedRows.map((row) => [String(row._id), row]));
  const deductedMap = new Map(deductedRows.map((row) => [String(row._id), row]));
  const soldMap = new Map();
  const comboSoldMap = new Map();
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  completedOrders.forEach((order) => {
    order.items.forEach((item) => {
      if (isCompositeProductType(item.productType)) {
        comboSoldMap.set(String(item.product), (comboSoldMap.get(String(item.product)) || 0) + item.quantity);
        item.components.forEach((component) => {
          const key = String(component.product);
          soldMap.set(key, (soldMap.get(key) || 0) + component.quantity);
        });
        return;
      }

      const key = String(item.product);
      soldMap.set(key, (soldMap.get(key) || 0) + item.quantity);
    });

    (order.sauceItems || []).forEach((sauceItem) => {
      const key = String(sauceItem.product);
      soldMap.set(key, (soldMap.get(key) || 0) + (Number(sauceItem.quantity) || 0));
    });
  });

  const baseProducts = products.filter((product) => isBaseProductType(product));
  const baseProductMap = new Map(baseProducts.map((product) => [String(product._id), product]));

  const rawRows = baseProducts.map((product, index) => {
    const received = receivedMap.get(String(product._id));
    const sold = soldMap.get(String(product._id));

    return {
      sl: index + 1,
      productId: product._id,
      productName: product.name,
      sku: product.sku,
      category: product.category,
      productType: inferProductType(product),
      stockUnit: product.stockUnit || "pieces",
      expiryDate: product.expiryDate || null,
      receivedQuantity: received?.receivedQuantity || 0,
      deductedQuantity: deductedMap.get(String(product._id))?.deductedQuantity || 0,
      soldQuantity: sold || 0,
      currentStock: product.stock,
      lastReceivedAt: received?.lastReceivedAt || null,
      lowStock: product.stock <= (product.lowStockThreshold || 5)
    };
  });

  const comboRows = products
    .filter((product) => isCompositeProductType(inferProductType(product)))
    .map((product, index) => {
      const requirementMap = buildCompositeRequirements(product, productMap);
      let inactive = !requirementMap?.size;
      let availableToSell = inactive ? 0 : Infinity;

      const components = [...(requirementMap?.entries() || [])].map(([requiredProductId, requiredQuantity]) => {
        const baseProduct = baseProductMap.get(String(requiredProductId));
        const baseStock = baseProduct?.stock || 0;
        const possibleCombos = requiredQuantity > 0 ? Math.floor(baseStock / requiredQuantity) : 0;

        if (!baseProduct || requiredQuantity <= 0) {
          inactive = true;
          availableToSell = 0;
        } else {
          availableToSell = Math.min(availableToSell, possibleCombos);
        }

        return {
          productId: baseProduct?._id || requiredProductId,
          productName: baseProduct?.name || "Unknown base item",
          sku: baseProduct?.sku || "",
          requiredQuantity,
          rawStock: baseStock,
          possibleCombos
        };
      });

      const availableStock = Number.isFinite(availableToSell) ? Math.max(availableToSell, 0) : 0;

      return {
        sl: index + 1,
        productId: product._id,
        productName: product.name,
        sku: product.sku,
        category: product.category,
        productType: inferProductType(product),
        stockUnit: product.stockUnit || "pieces",
        availableToSell: availableStock,
        soldQuantity: comboSoldMap.get(String(product._id)) || 0,
        componentCount: components.length,
        components,
        lowAvailability: availableStock > 0 && availableStock <= 5,
        isActive: !inactive && availableStock > 0
      };
    });

  const expiryRows = baseProducts.map((product, index) => {
    const daysUntilExpiry = getDaysUntilExpiry(product.expiryDate);
    const hasExpiryDate = Boolean(product.expiryDate);
    const isExpired = hasExpiryDate && daysUntilExpiry < 0;
    const isExpiringSoon = hasExpiryDate && daysUntilExpiry >= 0 && daysUntilExpiry <= 2;
    const isFresh = hasExpiryDate && daysUntilExpiry > 2;

    return {
      sl: index + 1,
      productId: product._id,
      productName: product.name,
      sku: product.sku,
      category: product.category,
      productType: inferProductType(product),
      stockUnit: product.stockUnit || "pieces",
      currentStock: product.stock,
      expiryDate: product.expiryDate || null,
      daysUntilExpiry,
      hasExpiryDate,
      isExpired,
      isExpiringSoon,
      isFresh,
      suggestion: !hasExpiryDate
        ? "Set an expiry date for traceability"
        : isExpired
          ? "Stop sale and review remaining stock urgently"
          : isExpiringSoon
            ? "Use or promote this item within 2 days"
            : "Safe for now, keep monitoring"
    };
  });

  const rawSummary = rawRows.reduce(
    (acc, row) => {
      acc.totalReceived += row.receivedQuantity;
      acc.totalDeducted += row.deductedQuantity;
      acc.totalSold += row.soldQuantity;
      acc.currentStock += row.currentStock;
      if (row.lowStock) {
        acc.lowStockCount += 1;
      }
      return acc;
    },
    {
      totalReceived: 0,
      totalDeducted: 0,
      totalSold: 0,
      currentStock: 0,
      lowStockCount: 0,
      productCount: rawRows.length
    }
  );

  const comboSummary = comboRows.reduce(
    (acc, row) => {
      acc.comboCount += 1;
      acc.totalAvailable += row.availableToSell;
      acc.totalSold += row.soldQuantity;
      if (row.lowAvailability) {
        acc.lowAvailabilityCount += 1;
      }
      if (row.isActive) {
        acc.activeComboCount += 1;
      }
      return acc;
    },
    {
      comboCount: 0,
      totalAvailable: 0,
      totalSold: 0,
      lowAvailabilityCount: 0,
      activeComboCount: 0
    }
  );

  const expirySummary = expiryRows.reduce(
    (acc, row) => {
      if (row.hasExpiryDate) {
        acc.trackedCount += 1;
      } else {
        acc.missingExpiryCount += 1;
      }

      if (row.isExpired) {
        acc.expiredCount += 1;
      } else if (row.isExpiringSoon) {
        acc.expiringSoonCount += 1;
      } else if (row.isFresh) {
        acc.freshCount += 1;
      }

      return acc;
    },
    {
      trackedCount: 0,
      expiringSoonCount: 0,
      expiredCount: 0,
      freshCount: 0,
      missingExpiryCount: 0,
      itemCount: expiryRows.length
    }
  );

  res.json({
    from: start,
    to: end,
    summary: rawSummary,
    rows: rawRows,
    rawRows,
    rawSummary,
    comboRows,
    comboSummary,
    expiryRows,
    expirySummary,
    movementHistory: movementHistory.map((movement) => ({
      id: String(movement._id),
      productId: String(movement.product),
      productName: movement.productName,
      sku: movement.sku,
      category: movement.category,
      stockUnit: movement.stockUnit || "pieces",
      movementType: movement.movementType,
      quantity: movement.quantity,
      previousStock: movement.previousStock,
      newStock: movement.newStock,
      reason: movement.reason || "",
      performedBy: movement.performedBy,
      createdAt: movement.createdAt
    }))
  });
};

module.exports = {
  getInventoryReport
};
