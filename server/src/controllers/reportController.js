const { getOrders, getAllProducts } = require("../lib/dataStore");
const { inferProductType, isCompositeProductType, buildCompositeRequirements } = require("../lib/productLogic");

const REPORT_TIMEZONE = process.env.REPORT_TIMEZONE || process.env.TZ || "Asia/Bangkok";
const COMPLETED_STATUSES = ["completed", "confirmed"];
const PAYMENT_METHODS = ["cash", "card", "qr"];
const isVoidHistoryEntry = (entry) => ["void", "void_edit"].includes(entry?.adjustmentType);

const buildDateRange = (from, to) => {
  const now = new Date();
  const start = from ? new Date(`${from}T00:00:00.000`) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = to ? new Date(`${to}T23:59:59.999`) : new Date();
  return { start, end };
};

const toReportDay = (dateValue) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(dateValue));

const pushPaymentFlow = (flows, method, direction, amount) => {
  if (!PAYMENT_METHODS.includes(method)) {
    return;
  }

  const numericAmount = Number(amount || 0);
  if (numericAmount <= 0) {
    return;
  }

  flows[`${method}${direction}`] += numericAmount;
};

const getInitialPaymentTransaction = (order) => {
  const firstEdit = Array.isArray(order.editHistory) ? order.editHistory[0] : null;

  if (order?.source === "customer" && firstEdit?.oldPaymentMethod == null && firstEdit?.newPaymentMethod) {
    return {
      amount: Number(firstEdit?.oldTotal ?? order.originalTotal ?? order.total ?? 0),
      method: firstEdit.newPaymentMethod
    };
  }

  return {
    amount: Number(firstEdit?.oldTotal ?? order.originalTotal ?? order.total ?? 0),
    method: firstEdit?.oldPaymentMethod || order.paymentMethod || null
  };
};

const getOrderPaymentFlows = (order) => {
  const flows = PAYMENT_METHODS.reduce((acc, method) => {
    acc[`${method}In`] = 0;
    acc[`${method}Out`] = 0;
    return acc;
  }, {});

  const initialTransaction = getInitialPaymentTransaction(order);
  pushPaymentFlow(flows, initialTransaction.method, "In", initialTransaction.amount);

  const editHistory = Array.isArray(order.editHistory) ? order.editHistory : [];
  const voidEntries = editHistory.filter(isVoidHistoryEntry);
  const latestVoidEntry = voidEntries.length ? voidEntries[voidEntries.length - 1] : null;
  const baseVoidEntry = voidEntries.find((entry) => entry.adjustmentType === "void") || latestVoidEntry;

  editHistory.forEach((entry) => {
    if (order?.source === "customer" && entry.oldPaymentMethod == null && entry.newPaymentMethod) {
      return;
    }

    if (isVoidHistoryEntry(entry)) {
      return;
    }

    const oldMethod = entry.oldPaymentMethod || null;
    const newMethod = entry.newPaymentMethod || null;
    const oldTotal = Number(entry.oldTotal || 0);
    const newTotal = Number(entry.newTotal || 0);

    if (oldMethod && newMethod && oldMethod !== newMethod) {
      pushPaymentFlow(flows, oldMethod, "Out", oldTotal);
      pushPaymentFlow(flows, newMethod, "In", newTotal);
      return;
    }

    if (entry.adjustmentType === "add") {
      pushPaymentFlow(flows, entry.adjustmentMethod || newMethod || oldMethod, "In", entry.adjustmentAmount);
      return;
    }

    if (entry.adjustmentType === "refund") {
      pushPaymentFlow(flows, entry.adjustmentMethod || oldMethod || newMethod, "Out", entry.adjustmentAmount);
    }
  });

  if (order?.status === "void") {
    const effectiveVoidMethod = latestVoidEntry?.adjustmentMethod ?? baseVoidEntry?.adjustmentMethod ?? null;
    const effectiveVoidAmount = Number(latestVoidEntry?.adjustmentAmount ?? baseVoidEntry?.adjustmentAmount ?? order.originalTotal ?? 0);
    pushPaymentFlow(flows, effectiveVoidMethod, "Out", effectiveVoidAmount);
  }

  return flows;
};

const calculateProductInventory = (product, productMap) => {
  const lowStockThreshold = Number(product?.lowStockThreshold) || 5;

  if (!isCompositeProductType(inferProductType(product))) {
    const stock = Number(product?.stock) || 0;
    return {
      stock,
      lowStock: stock <= lowStockThreshold,
      isActive: stock > 0
    };
  }

  const requirements = buildCompositeRequirements(product, productMap);
  if (!requirements?.size) {
    return { stock: 0, lowStock: true, isActive: false };
  }

  let sellableStock = Infinity;
  for (const [requiredProductId, requiredQuantity] of requirements.entries()) {
    const rawProduct = productMap.get(requiredProductId);
    if (!rawProduct || requiredQuantity <= 0) {
      return { stock: 0, lowStock: true, isActive: false };
    }
    sellableStock = Math.min(sellableStock, Math.floor((Number(rawProduct.stock) || 0) / requiredQuantity));
  }

  const stock = Number.isFinite(sellableStock) ? Math.max(sellableStock, 0) : 0;
  return {
    stock,
    lowStock: stock <= lowStockThreshold,
    isActive: stock > 0
  };
};

const getSalesReport = async (_req, res) => {
  const allOrders = await getOrders();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const completedOrders = allOrders.filter((order) => COMPLETED_STATUSES.includes(order.status));

  const dailyOrders = completedOrders.filter((order) => new Date(order.createdAt) >= startOfDay);
  const monthlyOrders = completedOrders.filter((order) => new Date(order.createdAt) >= startOfMonth);

  const topSellingMap = new Map();
  completedOrders.forEach((order) => {
    order.items.forEach((item) => {
      const key = String(item.product);
      const existing = topSellingMap.get(key) || {
        _id: key,
        name: item.name,
        quantitySold: 0,
        revenue: 0
      };
      existing.quantitySold += Number(item.quantity || 0);
      existing.revenue += Number(item.subtotal || 0);
      topSellingMap.set(key, existing);
    });
  });

  const topSelling = [...topSellingMap.values()]
    .sort((a, b) => b.quantitySold - a.quantitySold || b.revenue - a.revenue)
    .slice(0, 5);

  res.json({
    daily: {
      totalSales: dailyOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      orderCount: dailyOrders.length
    },
    monthly: {
      totalSales: monthlyOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      orderCount: monthlyOrders.length
    },
    topSelling
  });
};

const getLowStockProducts = async (_req, res) => {
  const products = await getAllProducts();
  const productMap = new Map(products.map((product) => [String(product.id || product._id), product]));

  const lowStockProducts = products
    .map((product) => {
      const inventory = calculateProductInventory(product, productMap);
      return {
        ...product,
        productType: inferProductType(product),
        stock: inventory.stock,
        lowStock: inventory.lowStock,
        isActive: inventory.isActive
      };
    })
    .filter((product) => product.lowStock)
    .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));

  res.json(lowStockProducts);
};

const getDashboardSummary = async (_req, res) => {
  const [orders, products] = await Promise.all([getOrders(), getAllProducts()]);
  const completedOrders = orders.filter((order) => COMPLETED_STATUSES.includes(order.status));
  const productMap = new Map(products.map((product) => [String(product.id || product._id), product]));
  const lowStockCount = products.reduce((count, product) => {
    const inventory = calculateProductInventory(product, productMap);
    return count + (inventory.lowStock ? 1 : 0);
  }, 0);

  res.json({
    totalRevenue: completedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    totalOrders: completedOrders.length,
    lowStockCount,
    productCount: products.length
  });
};

const getSalesRangeReport = async (req, res) => {
  const { from, to } = req.query;
  const { start, end } = buildDateRange(from, to);
  const allOrders = await getOrders();
  const orders = allOrders.filter((order) => new Date(order.createdAt) >= start && new Date(order.createdAt) <= end);

  const grouped = new Map();
  orders.forEach((order) => {
    const date = toReportDay(order.createdAt);
    const existing = grouped.get(date) || {
      totalSaleAmount: 0,
      numberOfOrder: 0,
      cashIn: 0,
      cashOut: 0,
      cardIn: 0,
      cardOut: 0,
      qrIn: 0,
      qrOut: 0
    };

    if (COMPLETED_STATUSES.includes(order.status)) {
      existing.totalSaleAmount += Number(order.total || 0);
      existing.numberOfOrder += 1;
    }

    const flows = getOrderPaymentFlows(order);
    existing.cashIn += Number(flows.cashIn || 0);
    existing.cashOut += Number(flows.cashOut || 0);
    existing.cardIn += Number(flows.cardIn || 0);
    existing.cardOut += Number(flows.cardOut || 0);
    existing.qrIn += Number(flows.qrIn || 0);
    existing.qrOut += Number(flows.qrOut || 0);
    grouped.set(date, existing);
  });

  const rows = [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, row], index) => ({
      sl: index + 1,
      date,
      totalSaleAmount: row.totalSaleAmount,
      numberOfOrder: row.numberOfOrder,
      paymentBy: {
        cash: row.cashIn - row.cashOut,
        card: row.cardIn - row.cardOut,
        qr: row.qrIn - row.qrOut
      }
    }));

  res.json({ from: start, to: end, rows });
};

const getProductSalesReport = async (req, res) => {
  const { from, to } = req.query;
  const { start, end } = buildDateRange(from, to);
  const [orders, products] = await Promise.all([getOrders(), getAllProducts()]);
  const productMap = new Map(products.map((product) => [String(product.id || product._id), product]));
  const grouped = new Map();

  orders
    .filter((order) => COMPLETED_STATUSES.includes(order.status) && new Date(order.createdAt) >= start && new Date(order.createdAt) <= end)
    .forEach((order) => {
      order.items.forEach((item) => {
        const productId = String(item.product);
        const product = productMap.get(productId);

        if (product && product.forSale === false) {
          return;
        }

        const existing = grouped.get(productId) || {
          productId,
          productName: item.name || product?.name || "Unknown Product",
          category: product?.category || item.category || "-",
          productType: product ? inferProductType(product) : item.productType || "raw",
          soldQty: 0,
          saleAmount: 0,
          orderCount: 0
        };

        existing.soldQty += Number(item.quantity || 0);
        existing.saleAmount += Number(item.subtotal || 0);
        existing.orderCount += 1;
        grouped.set(productId, existing);
      });
    });

  const rows = [...grouped.values()]
    .sort((left, right) => right.soldQty - left.soldQty || right.saleAmount - left.saleAmount || left.productName.localeCompare(right.productName))
    .map((row, index) => ({
      sl: index + 1,
      productId: row.productId,
      productName: row.productName,
      category: row.category,
      productType: row.productType,
      soldQty: row.soldQty,
      saleAmount: row.saleAmount,
      orderCount: row.orderCount
    }));

  const summary = rows.reduce(
    (acc, row) => {
      acc.totalProducts += 1;
      acc.totalQty += Number(row.soldQty || 0);
      acc.totalSales += Number(row.saleAmount || 0);
      acc.totalOrderTouches += Number(row.orderCount || 0);
      acc.categories.add(row.category || "-");
      return acc;
    },
    {
      totalProducts: 0,
      totalQty: 0,
      totalSales: 0,
      totalOrderTouches: 0,
      categories: new Set()
    }
  );

  res.json({
    from: start,
    to: end,
    summary: {
      totalProducts: summary.totalProducts,
      totalQty: summary.totalQty,
      totalSales: summary.totalSales,
      totalOrderTouches: summary.totalOrderTouches,
      categoryCount: summary.categories.size
    },
    rows
  });
};

const getCashPositionReport = async (req, res) => {
  const { from, to } = req.query;
  const { start, end } = buildDateRange(from, to);
  const orders = (await getOrders()).filter(
    (order) => COMPLETED_STATUSES.includes(order.status) && new Date(order.createdAt) >= start && new Date(order.createdAt) <= end
  );

  const grouped = new Map();
  orders.forEach((order) => {
    const date = toReportDay(order.createdAt);
    const existing = grouped.get(date) || { cashAmount: 0, cardAmount: 0, qrAmount: 0, totalAmount: 0 };
    existing.totalAmount += Number(order.total || 0);
    if (order.paymentMethod === "card") {
      existing.cardAmount += Number(order.total || 0);
    } else if (order.paymentMethod === "qr") {
      existing.qrAmount += Number(order.total || 0);
    } else {
      existing.cashAmount += Number(order.total || 0);
    }
    grouped.set(date, existing);
  });

  const rows = [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, row], index) => ({
      sl: index + 1,
      date,
      cashAmount: row.cashAmount,
      cardAmount: row.cardAmount,
      qrAmount: row.qrAmount,
      totalAmount: row.totalAmount
    }));

  const totals = rows.reduce(
    (acc, row) => {
      acc.cash += row.cashAmount;
      acc.card += row.cardAmount;
      acc.qr += row.qrAmount;
      acc.total += row.totalAmount;
      return acc;
    },
    { cash: 0, card: 0, qr: 0, total: 0 }
  );

  res.json({ from: start, to: end, totals, rows });
};

const getOrdersByDate = async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ message: "Date is required" });
  }

  const start = new Date(`${date}T00:00:00.000`);
  const end = new Date(`${date}T23:59:59.999`);
  const orders = (await getOrders())
    .filter((order) => new Date(order.createdAt) >= start && new Date(order.createdAt) <= end)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ date, orders });
};

module.exports = {
  getSalesReport,
  getLowStockProducts,
  getDashboardSummary,
  getSalesRangeReport,
  getProductSalesReport,
  getCashPositionReport,
  getOrdersByDate
};
