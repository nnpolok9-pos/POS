const Order = require("../models/Order");
const Product = require("../models/Product");

const REPORT_TIMEZONE = process.env.REPORT_TIMEZONE || process.env.TZ || "Asia/Bangkok";
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

  if (!Array.isArray(product?.comboItems) || product.comboItems.length === 0 || trail.has(productId)) {
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
    return {
      stock: 0,
      lowStock: true,
      isActive: false
    };
  }

  let sellableStock = Infinity;

  for (const [requiredProductId, requiredQuantity] of requirements.entries()) {
    const rawProduct = productMap.get(requiredProductId);

    if (!rawProduct || requiredQuantity <= 0) {
      return {
        stock: 0,
        lowStock: true,
        isActive: false
      };
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

const buildDateRange = (from, to) => {
  const now = new Date();
  const start = from ? new Date(`${from}T00:00:00.000`) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = to ? new Date(`${to}T23:59:59.999`) : new Date();
  return { start, end };
};

const getSalesReport = async (req, res) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [daily, monthly, topSelling] = await Promise.all([
    Order.aggregate([
      { $match: { status: { $in: COMPLETED_STATUSES }, createdAt: { $gte: startOfDay } } },
      { $group: { _id: null, totalSales: { $sum: "$total" }, orderCount: { $sum: 1 } } }
    ]),
    Order.aggregate([
      { $match: { status: { $in: COMPLETED_STATUSES }, createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, totalSales: { $sum: "$total" }, orderCount: { $sum: 1 } } }
    ]),
    Order.aggregate([
      { $match: { status: { $in: COMPLETED_STATUSES } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          name: { $first: "$items.name" },
          quantitySold: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.subtotal" }
        }
      },
      { $sort: { quantitySold: -1 } },
      { $limit: 5 }
    ])
  ]);

  res.json({
    daily: daily[0] || { totalSales: 0, orderCount: 0 },
    monthly: monthly[0] || { totalSales: 0, orderCount: 0 },
    topSelling
  });
};

const getLowStockProducts = async (req, res) => {
  const products = await Product.find({}).populate("comboItems.product", "name sku stock productType lowStockThreshold").sort({ category: 1, name: 1 });
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  const lowStockProducts = products
    .map((product) => {
      const inventory = calculateProductInventory(product, productMap);
      return {
        ...product.toJSON(),
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

const getDashboardSummary = async (req, res) => {
  const [sales, products] = await Promise.all([
    Order.aggregate([
      {
        $facet: {
          totalRevenue: [{ $match: { status: { $in: COMPLETED_STATUSES } } }, { $group: { _id: null, value: { $sum: "$total" } } }],
          totalOrders: [{ $match: { status: { $in: COMPLETED_STATUSES } } }, { $count: "value" }]
        }
      }
    ]),
    Product.find({}).populate("comboItems.product", "name sku stock productType lowStockThreshold")
  ]);

  const productMap = new Map(products.map((product) => [String(product._id), product]));

  const lowStockCount = products.reduce((count, product) => {
    const inventory = calculateProductInventory(product, productMap);
    return count + (inventory.lowStock ? 1 : 0);
  }, 0);

  res.json({
    totalRevenue: sales[0]?.totalRevenue[0]?.value || 0,
    totalOrders: sales[0]?.totalOrders[0]?.value || 0,
    lowStockCount,
    productCount: products.length
  });
};

const getSalesRangeReport = async (req, res) => {
  const { from, to } = req.query;
  const { start, end } = buildDateRange(from, to);

  const rows = await Order.aggregate([
    {
      $match: {
        status: { $in: COMPLETED_STATUSES },
        createdAt: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
            timezone: REPORT_TIMEZONE
          }
        },
        totalSaleAmount: { $sum: "$total" },
        numberOfOrder: { $sum: 1 },
        cashAmount: {
          $sum: {
            $cond: [{ $eq: ["$paymentMethod", "cash"] }, "$total", 0]
          }
        },
        cardAmount: {
          $sum: {
            $cond: [{ $eq: ["$paymentMethod", "card"] }, "$total", 0]
          }
        },
        qrAmount: {
          $sum: {
            $cond: [{ $eq: ["$paymentMethod", "qr"] }, "$total", 0]
          }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.json({
    from: start,
    to: end,
    rows: rows.map((row, index) => ({
      sl: index + 1,
      date: row._id,
      totalSaleAmount: row.totalSaleAmount,
      numberOfOrder: row.numberOfOrder,
      paymentBy: {
        cash: row.cashAmount,
        card: row.cardAmount,
        qr: row.qrAmount
      }
    }))
  });
};

const getCashPositionReport = async (req, res) => {
  const { from, to } = req.query;
  const { start, end } = buildDateRange(from, to);

  const rows = await Order.aggregate([
    {
      $match: {
        status: { $in: COMPLETED_STATUSES },
        createdAt: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
            timezone: REPORT_TIMEZONE
          }
        },
        cashAmount: {
          $sum: {
            $cond: [{ $eq: ["$paymentMethod", "cash"] }, "$total", 0]
          }
        },
        cardAmount: {
          $sum: {
            $cond: [{ $eq: ["$paymentMethod", "card"] }, "$total", 0]
          }
        },
        qrAmount: {
          $sum: {
            $cond: [{ $eq: ["$paymentMethod", "qr"] }, "$total", 0]
          }
        },
        totalAmount: { $sum: "$total" }
      }
    },
    { $sort: { _id: 1 } }
  ]);

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

  res.json({
    from: start,
    to: end,
    totals,
    rows: rows.map((row, index) => ({
      sl: index + 1,
      date: row._id,
      cashAmount: row.cashAmount,
      cardAmount: row.cardAmount,
      qrAmount: row.qrAmount,
      totalAmount: row.totalAmount
    }))
  });
};

const getOrdersByDate = async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ message: "Date is required" });
  }

  const start = new Date(`${date}T00:00:00.000`);
  const end = new Date(`${date}T23:59:59.999`);

  const orders = await Order.find({
    createdAt: { $gte: start, $lte: end }
  })
    .populate("staff", "name email role")
    .sort({ createdAt: -1 });

  res.json({
    date,
    orders
  });
};

module.exports = {
  getSalesReport,
  getLowStockProducts,
  getDashboardSummary,
  getSalesRangeReport,
  getCashPositionReport,
  getOrdersByDate
};
