const {
  deleteProcurementCostEntryById,
  deletePurchaseEntryById,
  getAllProductsAdmin,
  getCostwiseProcurementReport,
  getItemwisePurchaseReport,
  getProcurementCostEntries,
  getProcurementCostEntryById,
  getProcurementCostNames,
  getProcurementPayments,
  getProcurementUsers,
  getProcurementVendors,
  getPurchaseEntries,
  getPurchaseEntryById,
  saveProcurementPayment,
  saveProcurementCostEntry,
  savePurchaseEntry
} = require("../lib/dataStore");

const DELETE_PIN = process.env.FORCE_STOCK_PIN || "4422";
const PAYMENT_METHODS = ["cash", "card", "qr", "due"];
const PAID_METHODS = ["cash", "card", "qr"];
const normalizeEntryPaymentMethod = (value) => {
  const method = String(value || "").trim();
  return PAYMENT_METHODS.includes(method) ? method : "cash";
};

const startOfDay = (date) => `${date} 00:00:00`;
const endOfDay = (date) => `${date} 23:59:59`;

const normalizeDateRange = (query) => ({
  from: query.from ? startOfDay(query.from) : null,
  to: query.to ? endOfDay(query.to) : null
});

const normalizePurchaseItems = async (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error("At least one purchase item is required");
    error.statusCode = 400;
    throw error;
  }

  const products = await getAllProductsAdmin();
  const productMap = new Map(products.map((product) => [String(product.id), product]));

  return items.map((item) => {
    const product = productMap.get(String(item.productId || ""));
    const quantity = Number(item.quantity || 0);
    const totalAmount = Number(item.totalAmount || 0);

    if (!product) {
      const error = new Error("Selected product was not found");
      error.statusCode = 400;
      throw error;
    }

    if (quantity <= 0) {
      const error = new Error("Purchase quantity must be greater than 0");
      error.statusCode = 400;
      throw error;
    }

    if (totalAmount < 0) {
      const error = new Error("Purchase amount cannot be negative");
      error.statusCode = 400;
      throw error;
    }

    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku || "",
      quantity,
      unitName: item.unitName || product.stockUnit || "Piece",
      totalAmount,
      remarks: item.remarks || ""
    };
  });
};

const getPurchases = async (req, res) => {
  const { from, to } = normalizeDateRange(req.query);
  const entries = await getPurchaseEntries({
    from,
    to,
    search: req.query.search || "",
    paymentMethod: req.query.paymentMethod || "",
    supplierId: req.query.supplierId || ""
  });
  res.json(entries);
};

const getVendors = async (req, res) => {
  res.json(await getProcurementVendors({ search: req.query.search || "" }));
};

const getPurchaseUsers = async (req, res) => {
  const users = await getProcurementUsers();
  res.json(users.map((user) => ({ id: user.id, name: user.name, email: user.email, role: user.role })));
};

const getCostNames = async (req, res) => {
  res.json(await getProcurementCostNames({ search: req.query.search || "" }));
};

const resolveHandledUser = async (userId) => {
  const users = await getProcurementUsers();
  return users.find((user) => String(user.id) === String(userId || "")) || null;
};

const validatePurchaseMeta = async ({ supplierName, paymentMethod, handledByUserId }) => {
  if (!supplierName) {
    const error = new Error("Supplier name is required");
    error.statusCode = 400;
    throw error;
  }

  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    const error = new Error("Payment method must be Cash, Card, QR, or Due");
    error.statusCode = 400;
    throw error;
  }

  const handledByUser = await resolveHandledUser(handledByUserId);
  if (!handledByUser) {
    const error = new Error("Select who paid or created the due purchase");
    error.statusCode = 400;
    throw error;
  }

  return handledByUser;
};

const validateCostMeta = async ({ costName, paymentMethod, handledByUserId, amount }) => {
  if (!costName) {
    const error = new Error("Cost name is required");
    error.statusCode = 400;
    throw error;
  }

  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    const error = new Error("Payment method must be Cash, Card, QR, or Due");
    error.statusCode = 400;
    throw error;
  }

  const handledByUser = await resolveHandledUser(handledByUserId);
  if (!handledByUser) {
    const error = new Error("Select who paid or created the due cost");
    error.statusCode = 400;
    throw error;
  }

  if (Number(amount || 0) <= 0) {
    const error = new Error("Cost amount must be greater than 0");
    error.statusCode = 400;
    throw error;
  }

  return handledByUser;
};

const createPurchase = async (req, res) => {
  const supplierName = String(req.body.supplierName || "").trim();
  const paymentMethod = normalizeEntryPaymentMethod(req.body.paymentMethod);
  const handledByUser = await validatePurchaseMeta({ supplierName, paymentMethod, handledByUserId: req.body.handledByUserId });

  const items = await normalizePurchaseItems(req.body.items);
  const entry = await savePurchaseEntry({
    supplierName,
    paymentMethod,
    handledByUserId: handledByUser.id,
    handledByUserName: handledByUser.name,
    items,
    createdBy: req.user.id,
    updatedBy: req.user.id
  });

  res.status(201).json(entry);
};

const updatePurchase = async (req, res) => {
  const existing = await getPurchaseEntryById(req.params.id);
  if (!existing) {
    return res.status(404).json({ message: "Purchase entry not found" });
  }

  const supplierName = String(req.body.supplierName || "").trim();
  const paymentMethod = normalizeEntryPaymentMethod(req.body.paymentMethod);
  const handledByUser = await validatePurchaseMeta({ supplierName, paymentMethod, handledByUserId: req.body.handledByUserId });

  const items = await normalizePurchaseItems(req.body.items);
  const entry = await savePurchaseEntry({
    id: existing.id,
    supplierName,
    paymentMethod,
    handledByUserId: handledByUser.id,
    handledByUserName: handledByUser.name,
    items,
    updatedBy: req.user.id
  });

  res.json(entry);
};

const deletePurchase = async (req, res) => {
  if (String(req.body.pin || "") !== DELETE_PIN) {
    return res.status(403).json({ message: "Invalid delete PIN" });
  }

  const existing = await getPurchaseEntryById(req.params.id);
  if (!existing) {
    return res.status(404).json({ message: "Purchase entry not found" });
  }

  await deletePurchaseEntryById(existing.id);
  res.json({ message: "Purchase entry deleted" });
};

const getCosts = async (req, res) => {
  const { from, to } = normalizeDateRange(req.query);
  const entries = await getProcurementCostEntries({
    from,
    to,
    search: req.query.search || "",
    paymentMethod: req.query.paymentMethod || "",
    costNameId: req.query.costNameId || ""
  });
  res.json(entries);
};

const createCost = async (req, res) => {
  const costName = String(req.body.costName || "").trim();
  const paymentMethod = normalizeEntryPaymentMethod(req.body.paymentMethod);
  const amount = Number(req.body.amount || 0);
  const handledByUser = await validateCostMeta({ costName, paymentMethod, amount, handledByUserId: req.body.handledByUserId });

  const entry = await saveProcurementCostEntry({
    costName,
    paymentMethod,
    handledByUserId: handledByUser.id,
    handledByUserName: handledByUser.name,
    amount,
    remarks: req.body.remarks || "",
    createdBy: req.user.id,
    updatedBy: req.user.id
  });

  res.status(201).json(entry);
};

const updateCost = async (req, res) => {
  const existing = await getProcurementCostEntryById(req.params.id);
  if (!existing) {
    return res.status(404).json({ message: "Cost entry not found" });
  }

  const costName = String(req.body.costName || "").trim();
  const paymentMethod = normalizeEntryPaymentMethod(req.body.paymentMethod);
  const amount = Number(req.body.amount || 0);
  const handledByUser = await validateCostMeta({ costName, paymentMethod, amount, handledByUserId: req.body.handledByUserId });

  const entry = await saveProcurementCostEntry({
    id: existing.id,
    costName,
    paymentMethod,
    handledByUserId: handledByUser.id,
    handledByUserName: handledByUser.name,
    amount,
    remarks: req.body.remarks || "",
    updatedBy: req.user.id
  });

  res.json(entry);
};

const deleteCost = async (req, res) => {
  if (String(req.body.pin || "") !== DELETE_PIN) {
    return res.status(403).json({ message: "Invalid delete PIN" });
  }

  const existing = await getProcurementCostEntryById(req.params.id);
  if (!existing) {
    return res.status(404).json({ message: "Cost entry not found" });
  }

  await deleteProcurementCostEntryById(existing.id);
  res.json({ message: "Cost entry deleted" });
};

const createPayment = async (req, res) => {
  const paymentType = String(req.body.paymentType || "").trim();
  const paymentMethod = String(req.body.paymentMethod || "").trim();
  const amount = Number(req.body.amount || 0);

  if (!["vendor", "staff"].includes(paymentType)) {
    return res.status(400).json({ message: "Payment type must be Vendor or Staff" });
  }
  if (!PAID_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ message: "Payment method must be Cash, Card, or QR" });
  }
  if (amount <= 0) {
    return res.status(400).json({ message: "Payment amount must be greater than 0" });
  }

  let vendorId = null;
  let vendorName = "";
  let userId = null;
  let userName = "";

  if (paymentType === "vendor") {
    const vendors = await getProcurementVendors();
    const vendor = vendors.find((entry) => String(entry.id) === String(req.body.vendorId || ""));
    if (!vendor) {
      return res.status(400).json({ message: "Select a vendor for vendor payment" });
    }
    vendorId = vendor.id;
    vendorName = vendor.name;
  } else {
    const user = await resolveHandledUser(req.body.userId);
    if (!user) {
      return res.status(400).json({ message: "Select a staff/admin user for staff payment" });
    }
    userId = user.id;
    userName = user.name;
  }

  const payment = await saveProcurementPayment({
    paymentType,
    vendorId,
    vendorName,
    userId,
    userName,
    amount,
    paymentMethod,
    remarks: req.body.remarks || "",
    createdBy: req.user.id
  });
  res.status(201).json(payment);
};

const getVendorWiseReport = async (req, res) => {
  const { from, to } = normalizeDateRange(req.query);
  const selectedVendorIds = String(req.query.vendorIds || "").split(",").map((value) => value.trim()).filter(Boolean);
  const [entries, costEntries, payments, vendors, users] = await Promise.all([
    getPurchaseEntries({ from, to }),
    getProcurementCostEntries({ from, to }),
    getProcurementPayments({ from, to }),
    getProcurementVendors(),
    getProcurementUsers()
  ]);

  const vendorMap = new Map(vendors.map((vendor) => [vendor.id, { ...vendor, purchaseAmount: 0, duePurchases: 0, paidPurchases: 0, payments: 0 }]));
  const userMap = new Map(users.map((user) => [user.id, { id: user.id, name: user.name, role: user.role, paidPurchases: 0, paidCosts: 0, staffPayments: 0 }]));

  entries.forEach((entry) => {
    if (selectedVendorIds.length && !selectedVendorIds.includes(String(entry.supplierId || ""))) return;
    const vendor = vendorMap.get(entry.supplierId) || { id: entry.supplierId || entry.supplierName, name: entry.supplierName, purchaseAmount: 0, duePurchases: 0, paidPurchases: 0, payments: 0 };
    vendor.purchaseAmount += Number(entry.totalAmount || 0);
    if (entry.paymentMethod === "due") vendor.duePurchases += Number(entry.totalAmount || 0);
    else vendor.paidPurchases += Number(entry.totalAmount || 0);
    vendorMap.set(vendor.id, vendor);

    if (PAID_METHODS.includes(entry.paymentMethod) && entry.handledByUserId) {
      const user = userMap.get(entry.handledByUserId) || { id: entry.handledByUserId, name: entry.handledByUserName, role: "", paidPurchases: 0, paidCosts: 0, staffPayments: 0 };
      user.paidPurchases += Number(entry.totalAmount || 0);
      userMap.set(user.id, user);
    }
  });

  costEntries.forEach((entry) => {
    if (PAID_METHODS.includes(entry.paymentMethod) && entry.handledByUserId) {
      const user = userMap.get(entry.handledByUserId) || { id: entry.handledByUserId, name: entry.handledByUserName, role: "", paidPurchases: 0, paidCosts: 0, staffPayments: 0 };
      user.paidCosts += Number(entry.amount || 0);
      userMap.set(user.id, user);
    }
  });

  payments.forEach((payment) => {
    if (payment.paymentType === "vendor") {
      if (selectedVendorIds.length && !selectedVendorIds.includes(String(payment.vendorId || ""))) return;
      const vendor = vendorMap.get(payment.vendorId) || { id: payment.vendorId, name: payment.vendorName, purchaseAmount: 0, duePurchases: 0, paidPurchases: 0, payments: 0 };
      vendor.payments += Number(payment.amount || 0);
      vendorMap.set(vendor.id, vendor);
    } else if (payment.userId) {
      const user = userMap.get(payment.userId) || { id: payment.userId, name: payment.userName, role: "", paidPurchases: 0, paidCosts: 0, staffPayments: 0 };
      user.staffPayments += Number(payment.amount || 0);
      userMap.set(user.id, user);
    }
  });

  const vendorRows = [...vendorMap.values()]
    .filter((vendor) => !selectedVendorIds.length || selectedVendorIds.includes(String(vendor.id)))
    .map((vendor) => ({ ...vendor, balanceDue: vendor.duePurchases - vendor.payments }))
    .filter((vendor) => vendor.purchaseAmount || vendor.payments || vendor.balanceDue);
  const userRows = [...userMap.values()]
    .map((user) => ({ ...user, balance: user.paidPurchases + user.paidCosts - user.staffPayments }))
    .filter((user) => user.paidPurchases || user.paidCosts || user.staffPayments || user.balance);

  res.json({
    vendors: vendorRows,
    users: userRows,
    summary: {
      purchaseAmount: vendorRows.reduce((sum, row) => sum + row.purchaseAmount, 0),
      duePurchases: vendorRows.reduce((sum, row) => sum + row.duePurchases, 0),
      vendorPayments: vendorRows.reduce((sum, row) => sum + row.payments, 0),
      vendorDue: vendorRows.reduce((sum, row) => sum + row.balanceDue, 0),
      userBalance: userRows.reduce((sum, row) => sum + row.balance, 0)
    }
  });
};

const getPurchaseItemwiseReport = async (req, res) => {
  const { from, to } = normalizeDateRange(req.query);
  const rows = await getItemwisePurchaseReport({
    from,
    to,
    productId: req.query.productId || "",
    search: req.query.search || ""
  });
  res.json(rows);
};

const getCostwiseReport = async (req, res) => {
  const { from, to } = normalizeDateRange(req.query);
  const rows = await getCostwiseProcurementReport({
    from,
    to,
    costNameId: req.query.costNameId || "",
    search: req.query.search || ""
  });
  res.json(rows);
};

module.exports = {
  createCost,
  createPayment,
  createPurchase,
  deleteCost,
  deletePurchase,
  getCostNames,
  getCosts,
  getCostwiseReport,
  getPurchaseItemwiseReport,
  getPurchases,
  getPurchaseUsers,
  getVendorWiseReport,
  getVendors,
  updateCost,
  updatePurchase
};
