const { getInventoryMovements, getAllProducts, getOrders, getUsersByIds } = require("../lib/dataStore");
const { inferProductType, isCompositeProductType, isBaseProductType, buildCompositeRequirements } = require("../lib/productLogic");

const COMPLETED_STATUSES = ["completed", "confirmed"];

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
  const [products, receivedRows, deductedRows, movementHistory, completedOrders] = await Promise.all([
    getAllProducts(),
    getInventoryMovements({ movementType: "received", from: start, to: end }),
    getInventoryMovements({ movementType: "deducted", from: start, to: end }),
    getInventoryMovements({ from: start, to: end }),
    getOrders()
  ]);

  const filteredOrders = completedOrders.filter((order) => {
    if (!COMPLETED_STATUSES.includes(order.status)) {
      return false;
    }

    if (start && (!order.servedAt || new Date(order.servedAt) < start)) {
      return false;
    }

    if (end && (!order.servedAt || new Date(order.servedAt) > end)) {
      return false;
    }

    return true;
  });

  const receivedMap = new Map();
  receivedRows.forEach((row) => {
    const key = String(row.product);
    const existing = receivedMap.get(key) || { receivedQuantity: 0, lastReceivedAt: null };
    existing.receivedQuantity += row.quantity;
    existing.lastReceivedAt = !existing.lastReceivedAt || new Date(row.createdAt) > new Date(existing.lastReceivedAt) ? row.createdAt : existing.lastReceivedAt;
    receivedMap.set(key, existing);
  });

  const deductedMap = new Map();
  deductedRows.forEach((row) => {
    const key = String(row.product);
    const existing = deductedMap.get(key) || { deductedQuantity: 0, lastDeductedAt: null };
    existing.deductedQuantity += row.quantity;
    existing.lastDeductedAt = !existing.lastDeductedAt || new Date(row.createdAt) > new Date(existing.lastDeductedAt) ? row.createdAt : existing.lastDeductedAt;
    deductedMap.set(key, existing);
  });

  const soldMap = new Map();
  const comboSoldMap = new Map();
  const productMap = new Map(products.map((product) => [String(product.id || product._id), product]));

  filteredOrders.forEach((order) => {
    order.items.forEach((item) => {
      if (isCompositeProductType(item.productType)) {
        comboSoldMap.set(String(item.product), (comboSoldMap.get(String(item.product)) || 0) + item.quantity);
        item.components.forEach((component) => {
          const key = String(component.product);
          soldMap.set(key, (soldMap.get(key) || 0) + Number(component.quantity || 0));
        });
        return;
      }

      const key = String(item.product);
      soldMap.set(key, (soldMap.get(key) || 0) + Number(item.quantity || 0));
    });

    (order.sauceItems || []).forEach((sauceItem) => {
      const key = String(sauceItem.product);
      soldMap.set(key, (soldMap.get(key) || 0) + (Number(sauceItem.quantity) || 0));
    });
  });

  const baseProducts = products.filter((product) => isBaseProductType(product));
  const baseProductMap = new Map(baseProducts.map((product) => [String(product.id || product._id), product]));

  const rawRows = baseProducts.map((product, index) => {
    const key = String(product.id || product._id);
    const received = receivedMap.get(key);
    return {
      sl: index + 1,
      productId: product.id || product._id,
      productName: product.name,
      image: product.image || "",
      sku: product.sku,
      category: product.category,
      productType: inferProductType(product),
      stockUnit: product.stockUnit || "pieces",
      expiryDate: product.expiryDate || null,
      receivedQuantity: received?.receivedQuantity || 0,
      deductedQuantity: deductedMap.get(key)?.deductedQuantity || 0,
      soldQuantity: soldMap.get(key) || 0,
      currentStock: Number(product.stock || 0),
      lastReceivedAt: received?.lastReceivedAt || null,
      lowStock: Number(product.stock || 0) <= Number(product.lowStockThreshold || 5)
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
        const baseStock = Number(baseProduct?.stock || 0);
        const possibleCombos = requiredQuantity > 0 ? Math.floor(baseStock / requiredQuantity) : 0;

        if (!baseProduct || requiredQuantity <= 0) {
          inactive = true;
          availableToSell = 0;
        } else {
          availableToSell = Math.min(availableToSell, possibleCombos);
        }

        return {
          productId: baseProduct?.id || baseProduct?._id || requiredProductId,
          productName: baseProduct?.name || "Unknown base item",
          image: baseProduct?.image || "",
          sku: baseProduct?.sku || "",
          productType: inferProductType(baseProduct || { productType: "raw_material" }),
          stockUnit: baseProduct?.stockUnit || "pieces",
          requiredQuantity,
          rawStock: baseStock,
          possibleCombos
        };
      });

      const availableStock = Number.isFinite(availableToSell) ? Math.max(availableToSell, 0) : 0;
      return {
        sl: index + 1,
        productId: product.id || product._id,
        productName: product.name,
        image: product.image || "",
        sku: product.sku,
        category: product.category,
        productType: inferProductType(product),
        stockUnit: product.stockUnit || "pieces",
        availableToSell: availableStock,
        soldQuantity: comboSoldMap.get(String(product.id || product._id)) || 0,
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
      productId: product.id || product._id,
      productName: product.name,
      image: product.image || "",
      sku: product.sku,
      category: product.category,
      productType: inferProductType(product),
      stockUnit: product.stockUnit || "pieces",
      currentStock: Number(product.stock || 0),
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
    { totalReceived: 0, totalDeducted: 0, totalSold: 0, currentStock: 0, lowStockCount: 0, productCount: rawRows.length }
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
    { comboCount: 0, totalAvailable: 0, totalSold: 0, lowAvailabilityCount: 0, activeComboCount: 0 }
  );

  const expirySummary = expiryRows.reduce(
    (acc, row) => {
      if (row.hasExpiryDate) acc.trackedCount += 1;
      else acc.missingExpiryCount += 1;
      if (row.isExpired) acc.expiredCount += 1;
      else if (row.isExpiringSoon) acc.expiringSoonCount += 1;
      else if (row.isFresh) acc.freshCount += 1;
      return acc;
    },
    { trackedCount: 0, expiringSoonCount: 0, expiredCount: 0, freshCount: 0, missingExpiryCount: 0, itemCount: expiryRows.length }
  );

  const performerIds = [...new Set(movementHistory.map((movement) => movement.performedBy).filter(Boolean))];
  const performers = await getUsersByIds(performerIds);
  const performerMap = new Map(performers.map((user) => [String(user.id || user._id), { id: user.id, name: user.name, email: user.email, role: user.role }]));
  const productDetailsMap = new Map(products.map((product) => [String(product.id || product._id), product]));

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
      id: String(movement.id || movement._id),
      productId: String(movement.product),
      productName: movement.productName,
      image: productDetailsMap.get(String(movement.product))?.image || "",
      sku: movement.sku,
      category: movement.category,
      stockUnit: movement.stockUnit || "pieces",
      movementType: movement.movementType,
      quantity: movement.quantity,
      previousStock: movement.previousStock,
      newStock: movement.newStock,
      reason: movement.reason || "",
      performedBy: movement.performedBy ? performerMap.get(String(movement.performedBy)) || null : null,
      createdAt: movement.createdAt
    }))
  });
};

module.exports = { getInventoryReport };
