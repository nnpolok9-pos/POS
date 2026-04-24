const generateOrderId = require("../utils/generateOrderId");
const {
  getOrders: getAllOrders,
  getOrderById: getStoredOrderById,
  saveOrder,
  getUsersByIds,
  deleteOrderById,
  getPromoByCode,
  getOrders: queryOrders
} = require("../lib/dataStore");
const {
  normalizeOrderItems,
  buildRequestedItems,
  buildOrderItemsFromProducts,
  applyInventoryForItems,
  restoreInventoryForOrderItems,
  buildSauceItems,
  buildSeasoningItems
} = require("../lib/orderPricing");
const { normalizePromoCode, getPromoUsageStats, validatePromoForOrder } = require("../lib/promoLogic");

const buildLocalDayRange = (dateValue, endOfDay = false) => {
  const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  return new Date(`${dateValue}${suffix}`);
};
const PARTNER_PAYMENT_METHODS = ["grab", "foodpanda"];
const COLLECTED_PAYMENT_METHODS = ["cash", "card", "qr", ...PARTNER_PAYMENT_METHODS];
const ALLOWED_PAYMENT_METHODS = [...COLLECTED_PAYMENT_METHODS, "due_on_serve"];
const hasCollectedPayment = (paymentMethod) => COLLECTED_PAYMENT_METHODS.includes(paymentMethod);
const isPartnerPaymentMethod = (paymentMethod) => PARTNER_PAYMENT_METHODS.includes(paymentMethod);
const deriveSourceFromPaymentMethod = (paymentMethod, fallback = "staff") =>
  isPartnerPaymentMethod(paymentMethod) ? paymentMethod : fallback;

const normalizeBookingDetails = (bookingDetails = {}) => ({
  customerName: bookingDetails.customerName?.trim() || bookingDetails.leadTravelerName?.trim() || "",
  customerPhone: bookingDetails.customerPhone?.trim() || bookingDetails.contactPhone?.trim() || "",
  customerDateOfBirth: bookingDetails.customerDateOfBirth || null
});

const buildQueueNumber = (orderId = "") => orderId.split("-").pop() || orderId;
const isCompletedStatus = (status) => status === "completed" || status === "confirmed";
const isQueuedStatus = (status) => status === "queued";
const getDeleteOrderPin = () => String(process.env.ORDER_DELETE_PIN || process.env.FORCE_STOCK_PIN || "4422").trim();
const isVoidHistoryEntry = (entry) => ["void", "void_edit"].includes(entry?.adjustmentType);

const getCurrentVoidAdjustment = (order) => {
  const voidEntries = (order.editHistory || []).filter(isVoidHistoryEntry);
  const latestVoidEntry = voidEntries.at(-1) || null;
  const baseVoidEntry = voidEntries.find((entry) => entry.adjustmentType === "void") || latestVoidEntry;

  if (!latestVoidEntry && !baseVoidEntry) {
    return {
      amount: Number(order.originalTotal ?? order.total ?? 0),
      method: null
    };
  }

  return {
    amount: Number(latestVoidEntry?.adjustmentAmount ?? baseVoidEntry?.adjustmentAmount ?? order.originalTotal ?? order.total ?? 0),
    method: latestVoidEntry?.adjustmentMethod ?? baseVoidEntry?.adjustmentMethod ?? null
  };
};

const buildItemChangeLog = (previousItems = [], nextItems = []) => {
  const previousMap = new Map(previousItems.map((item) => [String(item.product), item]));
  const nextMap = new Map(nextItems.map((item) => [String(item.product), item]));
  const keys = new Set([...previousMap.keys(), ...nextMap.keys()]);
  const changes = [];

  keys.forEach((key) => {
    const previousItem = previousMap.get(key);
    const nextItem = nextMap.get(key);

    if (!previousItem && nextItem) {
      changes.push(`Added ${nextItem.name} x ${nextItem.quantity}`);
      return;
    }

    if (previousItem && !nextItem) {
      changes.push(`Removed ${previousItem.name}`);
      return;
    }

    if (previousItem.quantity !== nextItem.quantity) {
      changes.push(`${nextItem.name}: ${previousItem.quantity} -> ${nextItem.quantity}`);
    }

    if (previousItem.price !== nextItem.price) {
      changes.push(`${nextItem.name} price: ${previousItem.price} -> ${nextItem.price}`);
    }
  });

  return changes;
};

const resolvePromoForOrder = async ({ promoCode, subtotal, source, excludeOrderId = null }) => {
  const normalizedPromoCode = normalizePromoCode(promoCode);

  if (!normalizedPromoCode) {
    return {
      promoCodeId: null,
      promoCode: null,
      promoDiscount: 0,
      promoSnapshot: null
    };
  }

  const promo = await getPromoByCode(normalizedPromoCode);

  if (!promo) {
    throw new Error("Promo code not found");
  }

  const promoOrders = await queryOrders({
    where: "WHERE promo_code_id=:promoCodeId",
    params: { promoCodeId: promo.id }
  });

  const usageStats = getPromoUsageStats({
    promoId: promo.id,
    orders: promoOrders,
    excludeOrderId
  });

  return validatePromoForOrder({
    promo,
    subtotal,
    source,
    usageStats
  });
};

const hydrateOrders = async (orders) => {
  const userIds = new Set();

  orders.forEach((order) => {
    [order.staff, order.voidedBy, order.editedBy, order.servedBy].forEach((value) => {
      if (value) {
        userIds.add(String(value));
      }
    });

    (order.editHistory || []).forEach((entry) => {
      if (entry.editedBy) {
        userIds.add(String(entry.editedBy));
      }
    });
  });

  const users = await getUsersByIds([...userIds]);
  const userMap = new Map(users.map((user) => [String(user.id || user._id), { id: user.id, name: user.name, email: user.email, role: user.role }]));

  return orders.map((order) => ({
    ...order,
    staff: order.staff ? userMap.get(String(order.staff)) || null : null,
    voidedBy: order.voidedBy ? userMap.get(String(order.voidedBy)) || null : null,
    editedBy: order.editedBy ? userMap.get(String(order.editedBy)) || null : null,
    servedBy: order.servedBy ? userMap.get(String(order.servedBy)) || null : null,
    editHistory: (order.editHistory || []).map((entry) => ({
      ...entry,
      editedBy: entry.editedBy ? userMap.get(String(entry.editedBy)) || null : null
    }))
  }));
};


const createOrder = async (req, res) => {
  const { items, paymentMethod, bookingDetails } = req.body;
  const requestedPromoCode = normalizePromoCode(req.body?.promoCode);

  if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ message: "A valid payment method is required" });
  }

  if (isPartnerPaymentMethod(paymentMethod) && requestedPromoCode) {
    return res.status(400).json({ message: "Promo codes are not available for delivery partner orders" });
  }

  try {
    const requestedItems = buildRequestedItems(items);
    const { orderItems, subtotal } = await buildOrderItemsFromProducts(requestedItems);
    const appliedPromo = await resolvePromoForOrder({
      promoCode: requestedPromoCode,
      subtotal,
      source: "pos"
    });
    const total = Number((subtotal - appliedPromo.promoDiscount).toFixed(2));
    const orderId = generateOrderId();
    const source = deriveSourceFromPaymentMethod(paymentMethod, "staff");
    const order = await saveOrder({
      orderId,
      queueNumber: buildQueueNumber(orderId),
      items: orderItems,
      sauceItems: [],
      subtotal,
      total,
      promoCodeId: appliedPromo.promoCodeId,
      promoCode: appliedPromo.promoCode,
      promoDiscount: appliedPromo.promoDiscount,
      promoSnapshot: appliedPromo.promoSnapshot,
      paymentMethod,
      bookingDetails: normalizeBookingDetails(bookingDetails),
      staff: req.user.id,
      status: "food_serving",
      source,
      editHistory: []
    });

    const [hydrated] = await hydrateOrders([await getStoredOrderById(order.id)]);
    res.status(201).json(hydrated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const createPublicOrder = async (req, res) => {
  const { items } = req.body;

  try {
    const requestedItems = buildRequestedItems(items);
    const { orderItems, subtotal } = await buildOrderItemsFromProducts(requestedItems);
    const appliedPromo = await resolvePromoForOrder({
      promoCode: req.body?.promoCode,
      subtotal,
      source: "menu"
    });
    const total = Number((subtotal - appliedPromo.promoDiscount).toFixed(2));
    const orderId = generateOrderId();
    const order = await saveOrder({
      orderId,
      queueNumber: buildQueueNumber(orderId),
      items: orderItems,
      sauceItems: [],
      subtotal,
      total,
      promoCodeId: appliedPromo.promoCodeId,
      promoCode: appliedPromo.promoCode,
      promoDiscount: appliedPromo.promoDiscount,
      promoSnapshot: appliedPromo.promoSnapshot,
      paymentMethod: null,
      bookingDetails: {},
      staff: null,
      status: "queued",
      source: "customer",
      editHistory: []
    });

    res.status(201).json({
      id: order.id,
      orderId: order.orderId,
      queueNumber: order.queueNumber,
      status: order.status,
      createdAt: order.createdAt,
      total,
      subtotal,
      promoCode: appliedPromo.promoCode,
      promoDiscount: appliedPromo.promoDiscount,
      items: order.items
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getOrdersHandler = async (req, res) => {
  const { from, to } = req.query;
  let orders = await getAllOrders();

  if (!["master_admin", "admin", "checker"].includes(req.user.role)) {
    orders = orders.filter((order) => String(order.staff || "") === String(req.user.id) || (order.status === "queued" && order.source === "customer"));
  }

  if (from) {
    const fromDate = buildLocalDayRange(from);
    if (Number.isNaN(fromDate.getTime())) {
      return res.status(400).json({ message: "Invalid from date" });
    }
    orders = orders.filter((order) => new Date(order.createdAt) >= fromDate);
  }

  if (to) {
    const toDate = buildLocalDayRange(to, true);
    if (Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ message: "Invalid to date" });
    }
    orders = orders.filter((order) => new Date(order.createdAt) <= toDate);
  }

  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(await hydrateOrders(orders));
};

const getEditedOrders = async (req, res) => {
  const { from, to } = req.query;
  let orders = (await getAllOrders()).filter((order) => Array.isArray(order.editHistory) && order.editHistory.length > 0);

  if (from) {
    const fromDate = buildLocalDayRange(from);
    if (Number.isNaN(fromDate.getTime())) {
      return res.status(400).json({ message: "Invalid from date" });
    }
    orders = orders.filter((order) => order.editedAt && new Date(order.editedAt) >= fromDate);
  }

  if (to) {
    const toDate = buildLocalDayRange(to, true);
    if (Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ message: "Invalid to date" });
    }
    orders = orders.filter((order) => order.editedAt && new Date(order.editedAt) <= toDate);
  }

  orders.sort((a, b) => new Date(b.editedAt || 0) - new Date(a.editedAt || 0) || new Date(b.createdAt) - new Date(a.createdAt));
  res.json(await hydrateOrders(orders));
};

const getOrderById = async (req, res) => {
  const order = await getStoredOrderById(req.params.id);

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (
    !["master_admin", "admin", "checker"].includes(req.user.role) &&
    String(order.staff || "") !== String(req.user.id) &&
    !(order.status === "queued" && order.source === "customer")
  ) {
    return res.status(404).json({ message: "Order not found" });
  }

  const [hydrated] = await hydrateOrders([order]);
  res.json(hydrated);
};

const updateOrder = async (req, res) => {
  const { items, paymentMethod, bookingDetails } = req.body;
  const requestedPromoCode = normalizePromoCode(req.body?.promoCode);

  if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ message: "A valid payment method is required" });
  }

  if (isPartnerPaymentMethod(paymentMethod) && requestedPromoCode) {
    return res.status(400).json({ message: "Promo codes are not available for delivery partner orders" });
  }

  const order = await getStoredOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (order.status === "void") {
    return res.status(400).json({ message: "Void sales cannot be edited" });
  }

  if (!["master_admin", "admin"].includes(req.user.role) && isCompletedStatus(order.status)) {
    return res.status(403).json({ message: "Only admin can edit completed orders" });
  }

  if (isCompletedStatus(order.status) && !hasCollectedPayment(paymentMethod)) {
    return res.status(400).json({ message: "Completed orders must use cash, card, or QR" });
  }

  if (order.source === "customer") {
    const existingPromoCode = normalizePromoCode(order.promoCode);
    const triesToApplyNewPromo = Boolean(requestedPromoCode) && requestedPromoCode !== existingPromoCode;

    if (triesToApplyNewPromo) {
      return res.status(400).json({ message: "Customer queue promos can only be applied from the menu page" });
    }
  }

  try {
    const requestedItems = buildRequestedItems(items);
    const previousItems = normalizeOrderItems(order.items);
    const previousSubtotal = Number(order.subtotal || 0);
    const previousTotal = Number(order.total || 0);
    const previousPaymentMethod = order.paymentMethod;
    const previousSource = order.source || "staff";
    const previousPromoCode = order.promoCode || null;
    const previousPromoDiscount = Number(order.promoDiscount || 0);
    const isQueuedOrder = isQueuedStatus(order.status);
    let nextOrderState;
    let inventoryRestored = false;

    if (isCompletedStatus(order.status)) {
      await restoreInventoryForOrderItems(order.items, order.sauceItems || []);
      inventoryRestored = true;

      try {
        nextOrderState = await buildOrderItemsFromProducts(requestedItems);
      } catch (error) {
        await applyInventoryForItems(order.items, order.sauceItems || []);
        throw error;
      }
    } else {
      nextOrderState = await buildOrderItemsFromProducts(requestedItems);
    }

    const appliedPromo = await resolvePromoForOrder({
      promoCode: requestedPromoCode,
      subtotal: nextOrderState.subtotal,
      source: order.source === "customer" ? "menu" : "pos",
      excludeOrderId: order.id
    });

    nextOrderState.total = Number((nextOrderState.subtotal - appliedPromo.promoDiscount).toFixed(2));

    const difference = Number((nextOrderState.total - previousTotal).toFixed(2));
    let adjustmentType = "none";
    let adjustmentAmount = 0;
    let adjustmentMethod = req.body.adjustmentMethod || null;

    if (difference > 0) {
      adjustmentType = "add";
      adjustmentAmount = difference;
    } else if (difference < 0) {
      adjustmentType = "refund";
      adjustmentAmount = Math.abs(difference);
    }

    const requiresImmediateAdjustment = !isQueuedOrder && hasCollectedPayment(previousPaymentMethod);

    if (requiresImmediateAdjustment && adjustmentType !== "none" && !adjustmentMethod) {
      if (inventoryRestored) {
        await applyInventoryForItems(order.items, order.sauceItems || []);
      }
      return res.status(400).json({ message: "Adjustment method is required when the total changes" });
    }

    if (adjustmentType === "none" || !requiresImmediateAdjustment) {
      adjustmentMethod = null;
    }

    const nextItems = normalizeOrderItems(nextOrderState.orderItems);
    const changes = buildItemChangeLog(previousItems, nextItems);

    if (previousPaymentMethod !== paymentMethod) {
      changes.push(`Payment method: ${previousPaymentMethod} -> ${paymentMethod}`);
    }

    const nextSource =
      order.source === "customer" ? "customer" : deriveSourceFromPaymentMethod(paymentMethod, "staff");

    if (previousSource !== nextSource) {
      changes.push(`Order source: ${previousSource} -> ${nextSource}`);
    }

    if (previousPromoCode !== (appliedPromo.promoCode || null)) {
      changes.push(`Promo code: ${previousPromoCode || "none"} -> ${appliedPromo.promoCode || "none"}`);
    }

    if (previousPromoDiscount !== Number(appliedPromo.promoDiscount || 0)) {
      changes.push(`Promo discount: ${previousPromoDiscount} -> ${Number(appliedPromo.promoDiscount || 0)}`);
    }

    if (isQueuedOrder) {
      changes.push("Retrieved from customer queue");
    }

    if (!changes.length && adjustmentType === "none") {
      changes.push("Order updated without item or payment difference");
    }

    if (isCompletedStatus(order.status)) {
      try {
        await applyInventoryForItems(nextOrderState.orderItems, order.sauceItems || []);
      } catch (error) {
        await applyInventoryForItems(order.items, order.sauceItems || []);
        throw error;
      }
    }

    Object.assign(order, {
      items: nextOrderState.orderItems,
      subtotal: nextOrderState.subtotal,
      total: nextOrderState.total,
      promoCodeId: appliedPromo.promoCodeId,
      promoCode: appliedPromo.promoCode,
      promoDiscount: appliedPromo.promoDiscount,
      promoSnapshot: appliedPromo.promoSnapshot,
      paymentMethod,
      source: nextSource,
      bookingDetails: normalizeBookingDetails(bookingDetails),
      staff: req.user.id,
      status: isQueuedOrder ? "food_serving" : order.status,
      editedAt: new Date(),
      editedBy: req.user.id,
      editHistory: [
        ...(order.editHistory || []),
        {
          editedBy: req.user.id,
          editedAt: new Date(),
          oldSubtotal: previousSubtotal,
          newSubtotal: nextOrderState.subtotal,
          oldTotal: previousTotal,
          newTotal: nextOrderState.total,
          adjustmentType,
          adjustmentAmount,
          adjustmentMethod,
          oldPaymentMethod: previousPaymentMethod,
          newPaymentMethod: paymentMethod,
          oldPromoCode: previousPromoCode,
          newPromoCode: appliedPromo.promoCode || null,
          oldPromoDiscount: previousPromoDiscount,
          newPromoDiscount: Number(appliedPromo.promoDiscount || 0),
          oldItems: previousItems,
          newItems: nextItems,
          changes
        }
      ]
    });

    await saveOrder(order);
    const [hydrated] = await hydrateOrders([await getStoredOrderById(order.id)]);
    res.json(hydrated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const voidOrder = async (req, res) => {
  const { refundMethod = null } = req.body || {};
  const order = await getStoredOrderById(req.params.id);

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (order.status === "void") {
    return res.status(400).json({ message: "Order is already void" });
  }

  if (!["master_admin", "admin"].includes(req.user.role) && order.status === "confirmed") {
    return res.status(403).json({ message: "Only admin can void completed orders" });
  }

  const previousStatus = order.status;
  const previousItems = normalizeOrderItems(order.items);
  const previousSubtotal = Number(order.subtotal || 0);
  const previousTotal = Number(order.total || 0);
  const previousPaymentMethod = order.paymentMethod;
  const previousPromoCode = order.promoCode || null;
  const previousPromoDiscount = Number(order.promoDiscount || 0);
  const refundAmount = Number(previousTotal || 0);
  const requiresRefundMethod = refundAmount > 0 && !isQueuedStatus(order.status) && hasCollectedPayment(previousPaymentMethod);

  if (requiresRefundMethod && !refundMethod) {
    return res.status(400).json({ message: "Refund method is required when voiding a booking" });
  }

  if (isCompletedStatus(order.status)) {
    await restoreInventoryForOrderItems(order.items, order.sauceItems || []);
  }

  order.originalSubtotal = order.originalSubtotal ?? order.subtotal;
  order.originalTotal = order.originalTotal ?? order.total;
  order.subtotal = 0;
  order.total = 0;
  order.status = "void";
  order.voidedAt = new Date();
  order.voidedBy = req.user.id;
  order.editedAt = new Date();
  order.editedBy = req.user.id;
  order.editHistory = [
    ...(order.editHistory || []),
    {
      editedBy: req.user.id,
      editedAt: new Date(),
      oldSubtotal: previousSubtotal,
      newSubtotal: 0,
      oldTotal: previousTotal,
      newTotal: 0,
      adjustmentType: requiresRefundMethod ? "void" : "none",
      adjustmentAmount: requiresRefundMethod ? refundAmount : 0,
      adjustmentMethod: requiresRefundMethod ? refundMethod : null,
      oldPaymentMethod: previousPaymentMethod,
      newPaymentMethod: previousPaymentMethod,
      oldPromoCode: previousPromoCode,
      newPromoCode: previousPromoCode,
      oldPromoDiscount: previousPromoDiscount,
      newPromoDiscount: previousPromoDiscount,
      oldItems: previousItems,
      newItems: [],
      changes: [
        isQueuedStatus(previousStatus) ? "Customer queue order canceled" : "Order voided",
        ...(requiresRefundMethod ? [`Refunded ${refundAmount.toFixed(2)} via ${refundMethod}`] : ["No refund amount"])
      ]
    }
  ];

  await saveOrder(order);
  const [hydrated] = await hydrateOrders([await getStoredOrderById(order.id)]);
  res.json(hydrated);
};

const editVoidOrder = async (req, res) => {
  const { refundMethod = null } = req.body || {};
  const order = await getStoredOrderById(req.params.id);

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (order.status !== "void") {
    return res.status(400).json({ message: "Only void orders can be corrected" });
  }

  const refundAmount = Number(order.originalTotal ?? 0);
  const requiresRefundMethod = refundAmount > 0 && hasCollectedPayment(order.paymentMethod);

  if (requiresRefundMethod && !refundMethod) {
    return res.status(400).json({ message: "Refund method is required for correcting this void sale" });
  }

  const currentVoidAdjustment = getCurrentVoidAdjustment(order);
  const nextMethod = requiresRefundMethod ? refundMethod : null;

  if ((currentVoidAdjustment.method || null) === nextMethod) {
    return res.status(400).json({ message: "No void refund changes detected" });
  }

  order.editedAt = new Date();
  order.editedBy = req.user.id;
  order.editHistory = [
    ...(order.editHistory || []),
    {
      editedBy: req.user.id,
      editedAt: new Date(),
      oldSubtotal: 0,
      newSubtotal: 0,
      oldTotal: 0,
      newTotal: 0,
      adjustmentType: "void_edit",
      adjustmentAmount: refundAmount,
      adjustmentMethod: nextMethod,
      previousAdjustmentMethod: currentVoidAdjustment.method || null,
      oldPaymentMethod: order.paymentMethod,
      newPaymentMethod: order.paymentMethod,
      oldPromoCode: order.promoCode || null,
      newPromoCode: order.promoCode || null,
      oldPromoDiscount: Number(order.promoDiscount || 0),
      newPromoDiscount: Number(order.promoDiscount || 0),
      oldItems: [],
      newItems: [],
      changes: [
        `Void refund method corrected: ${currentVoidAdjustment.method || "none"} -> ${nextMethod || "none"}`,
        `Refund amount remains ${refundAmount.toFixed(2)}`
      ]
    }
  ];

  await saveOrder(order);
  const [hydrated] = await hydrateOrders([await getStoredOrderById(order.id)]);
  res.json(hydrated);
};

const serveOrder = async (req, res) => {
  const order = await getStoredOrderById(req.params.id);

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (order.status === "void") {
    return res.status(400).json({ message: "Void sales cannot be served" });
  }

  if (isCompletedStatus(order.status)) {
    return res.status(400).json({ message: "Order is already completed" });
  }

  try {
    const previousPaymentMethod = order.paymentMethod || null;
    const requiresServePaymentMethod = !hasCollectedPayment(previousPaymentMethod);
    const nextPaymentMethod = req.body?.paymentMethod || null;

    if (requiresServePaymentMethod && !hasCollectedPayment(nextPaymentMethod)) {
      return res.status(400).json({ message: "Select the payment method before serving unpaid orders" });
    }

    const sauceItems = await buildSauceItems(req.body?.sauceItems || []);
    const seasoningItems = await buildSeasoningItems();
    const servedAuxiliaryItems = [...sauceItems, ...seasoningItems];
    await applyInventoryForItems(order.items, servedAuxiliaryItems);

    order.status = "completed";
    order.paymentMethod = requiresServePaymentMethod ? nextPaymentMethod : previousPaymentMethod;
    order.sauceItems = servedAuxiliaryItems;
    order.servedAt = new Date();
    order.servedBy = req.user.id;

    if (previousPaymentMethod !== order.paymentMethod) {
      const currentItems = normalizeOrderItems(order.items);
      order.editedAt = new Date();
      order.editedBy = req.user.id;
      order.editHistory = [
        ...(order.editHistory || []),
        {
          editedBy: req.user.id,
          editedAt: new Date(),
          oldSubtotal: Number(order.subtotal || 0),
          newSubtotal: Number(order.subtotal || 0),
          oldTotal: Number(order.total || 0),
          newTotal: Number(order.total || 0),
          adjustmentType: "payment_update",
          adjustmentAmount: 0,
          adjustmentMethod: null,
          oldPaymentMethod: previousPaymentMethod,
          newPaymentMethod: order.paymentMethod,
          oldPromoCode: order.promoCode || null,
          newPromoCode: order.promoCode || null,
          oldPromoDiscount: Number(order.promoDiscount || 0),
          newPromoDiscount: Number(order.promoDiscount || 0),
          oldItems: currentItems,
          newItems: currentItems,
          changes: [`Payment collected on serve: ${previousPaymentMethod || "unpaid"} -> ${order.paymentMethod}`]
        }
      ];
    }

    await saveOrder(order);

    const [hydrated] = await hydrateOrders([await getStoredOrderById(order.id)]);
    res.json(hydrated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteOrder = async (req, res) => {
  const order = await getStoredOrderById(req.params.id);
  const pin = String(req.body?.pin || "").trim();

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (!pin || pin !== getDeleteOrderPin()) {
    return res.status(403).json({ message: "Invalid PIN for deleting order" });
  }

  await deleteOrderById(order.id);
  res.json({ message: "Order deleted successfully" });
};

module.exports = {
  createOrder,
  createPublicOrder,
  getOrders: getOrdersHandler,
  getEditedOrders,
  getOrderById,
  updateOrder,
  voidOrder,
  editVoidOrder,
  serveOrder,
  deleteOrder
};
