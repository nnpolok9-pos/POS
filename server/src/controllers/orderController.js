const Order = require("../models/Order");
const Product = require("../models/Product");
const generateOrderId = require("../utils/generateOrderId");

const buildLocalDayRange = (dateValue, endOfDay = false) => {
  const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  return new Date(`${dateValue}${suffix}`);
};

const normalizeOrderItems = (items = []) =>
  items.map((item) => ({
    product: item.product,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    productType: item.productType || "raw",
    components: (item.components || []).map((component) => ({
      product: component.product,
      name: component.name,
      quantity: component.quantity
    })),
    selectedAlternatives: (item.selectedAlternatives || []).map((alternative) => ({
      sourceProduct: alternative.sourceProduct,
      sourceName: alternative.sourceName,
      selectedProduct: alternative.selectedProduct,
      selectedName: alternative.selectedName,
      priceAdjustment: Number(alternative.priceAdjustment || 0)
    })),
    subtotal: item.subtotal
  }));

const normalizeSauceItems = (items = []) =>
  items
    .map((item) => ({
      product: item.product,
      name: item.name,
      quantity: Number(item.quantity),
      stockUnit: item.stockUnit || "pieces"
    }))
    .filter((item) => item.product && item.quantity > 0);

const COMPOSITE_PRODUCT_TYPES = ["combo", "combo_type"];
const isCompositeProductType = (productType) => COMPOSITE_PRODUCT_TYPES.includes(productType);
const isBaseProductType = (productType) => !isCompositeProductType(productType);

const normalizeBookingDetails = (bookingDetails = {}) => ({
  leadTravelerName: bookingDetails.leadTravelerName?.trim() || "",
  contactPhone: bookingDetails.contactPhone?.trim() || "",
  destination: bookingDetails.destination?.trim() || "",
  departureDate: bookingDetails.departureDate ? new Date(bookingDetails.departureDate) : null,
  returnDate: bookingDetails.returnDate ? new Date(bookingDetails.returnDate) : null,
  travelerCount: Math.max(1, Number(bookingDetails.travelerCount) || 1),
  notes: bookingDetails.notes?.trim() || ""
});

const buildQueueNumber = (orderId = "") => orderId.split("-").pop() || orderId;

const isFoodServingStatus = (status) => status === "food_serving" || status === "quote_prepared";
const isCompletedStatus = (status) => status === "completed" || status === "confirmed";
const isQueuedStatus = (status) => status === "queued";

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

const normalizeSelectedAlternativesInput = (selectedAlternatives = []) =>
  (Array.isArray(selectedAlternatives) ? selectedAlternatives : [])
    .map((alternative) => ({
      sourceProductId: String(alternative.sourceProductId || ""),
      selectedProductId: String(alternative.selectedProductId || ""),
      priceAdjustment: Number(alternative.priceAdjustment || 0)
    }))
    .filter((alternative) => alternative.sourceProductId && alternative.selectedProductId);

const buildRequestedItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Order items are required");
  }

  return items.map((item) => {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Each item quantity must be at least 1");
    }

    return {
      productId: String(item.productId),
      quantity: item.quantity,
      selectedAlternatives: normalizeSelectedAlternativesInput(item.selectedAlternatives)
    };
  });
};

const syncProductAvailability = async (productId) => {
  const product = await Product.findById(productId);
  if (!product) {
    return;
  }

  product.isActive = product.stock > 0;
  await product.save();
};

const buildRawRequirements = (orderItems, sauceItems = []) => {
  const rawRequirements = new Map();

  orderItems.forEach((item) => {
    if (isCompositeProductType(item.productType)) {
      item.components.forEach((component) => {
        const key = String(component.product);
        rawRequirements.set(key, (rawRequirements.get(key) || 0) + component.quantity);
      });
      return;
    }

    const key = String(item.product);
    rawRequirements.set(key, (rawRequirements.get(key) || 0) + item.quantity);
  });

  sauceItems.forEach((item) => {
    const key = String(item.product);
    rawRequirements.set(key, (rawRequirements.get(key) || 0) + Number(item.quantity || 0));
  });

  return rawRequirements;
};

const buildSauceItems = async (items = []) => {
  const mergedSauces = new Map();

  items.forEach((item) => {
    const quantity = Number(item.quantity || 0);
    if (item.product && quantity > 0) {
      mergedSauces.set(String(item.product), (mergedSauces.get(String(item.product)) || 0) + quantity);
    }
  });

  if (!mergedSauces.size) {
    return [];
  }

  const sauceProducts = await Product.find({ _id: { $in: [...mergedSauces.keys()] } });
  const sauceMap = new Map(sauceProducts.map((product) => [String(product._id), product]));

  return [...mergedSauces.entries()].map(([productId, quantity]) => {
    const sauce = sauceMap.get(productId);

    if (!sauce) {
      throw new Error("One or more sauce items no longer exist");
    }

    if (sauce.productType !== "sauce") {
      throw new Error(`${sauce.name} is not a Sauce product type`);
    }

    return {
      product: sauce._id,
      name: sauce.name,
      quantity,
      stockUnit: sauce.stockUnit || "pieces"
    };
  });
};

const buildSeasoningItems = async () => {
  const seasoningProducts = await Product.find({
    productType: "seasoning",
    isActive: true
  });

  return seasoningProducts
    .map((seasoning) => ({
      product: seasoning._id,
      name: seasoning.name,
      quantity: Number(seasoning.seasoningPerOrderConsumption || 0),
      stockUnit: seasoning.stockUnit || "gram"
    }))
    .filter((seasoning) => seasoning.quantity > 0);
};

const buildProductComponents = (product, quantity, productMap, selectedAlternativeMap = new Map(), trail = new Set()) => {
  const productId = String(product._id);

  if (!isCompositeProductType(product.productType)) {
    return [
      {
        product: product._id,
        name: product.name,
        quantity,
        productType: product.productType || "raw"
      }
    ];
  }

  if (!product.comboItems?.length) {
    throw new Error(`${product.name} combo has no item composition assigned`);
  }

  if (trail.has(productId)) {
    throw new Error(`${product.name} has a circular combo composition`);
  }

  const nextTrail = new Set(trail);
  nextTrail.add(productId);
  const componentMap = new Map();

  for (const comboItem of product.comboItems) {
    const sourceProductId = String(comboItem.product?._id || comboItem.product);
    const replacementProductId = comboItem.changeable ? selectedAlternativeMap.get(sourceProductId) : null;

    if (replacementProductId) {
      const allowedAlternativeIds = (comboItem.alternativeProducts || []).map((alternativeProduct) =>
        String(alternativeProduct.product?._id || alternativeProduct.product || alternativeProduct)
      );
      if (!comboItem.changeable || !allowedAlternativeIds.includes(String(replacementProductId))) {
        throw new Error(`${product.name} contains an invalid replacement selection`);
      }
    }

    const linkedProduct = productMap.get(replacementProductId || sourceProductId);

    if (!linkedProduct) {
      throw new Error(`${product.name} combo contains an invalid item`);
    }

    const nestedComponents = buildProductComponents(
      linkedProduct,
      Number(comboItem.quantity || 0) * quantity,
      productMap,
      selectedAlternativeMap,
      nextTrail
    );

    nestedComponents.forEach((component) => {
      const key = String(component.product);
      const existing = componentMap.get(key);

      if (existing) {
        existing.quantity += component.quantity;
      } else {
        componentMap.set(key, { ...component });
      }
    });
  }

  return [...componentMap.values()];
};

const buildOrderItemsFromProducts = async (requestedItems) => {
  const itemIds = [...new Set(requestedItems.map((item) => item.productId))];
  const products = await Product.find({}).populate("comboItems.product");
  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const orderItems = [];
  let subtotal = 0;
  const rawRequirements = new Map();

  for (const requestItem of requestedItems) {
    const { productId, quantity, selectedAlternatives = [] } = requestItem;
    const product = productMap.get(productId);

    if (!product) {
      throw new Error("One or more products no longer exist");
    }

    let linePriceAdjustment = 0;

    if (isCompositeProductType(product.productType)) {
      const selectedAlternativeMap = new Map();
      const selectedAlternativeDetails = [];

      selectedAlternatives.forEach((alternative) => {
        const sourceProduct = productMap.get(alternative.sourceProductId);
        const selectedProduct = productMap.get(alternative.selectedProductId);

        if (!sourceProduct || !selectedProduct) {
          throw new Error(`${product.name} has an invalid alternative selection`);
        }

        const sourceComboItem = (product.comboItems || []).find(
          (comboItem) => String(comboItem.product?._id || comboItem.product) === alternative.sourceProductId
        );

        const alternativeProductConfig = (sourceComboItem?.alternativeProducts || []).find(
          (alternativeProduct) => String(alternativeProduct.product?._id || alternativeProduct.product || alternativeProduct) === alternative.selectedProductId
        );

        if (!sourceComboItem || !alternativeProductConfig) {
          throw new Error(`${product.name} has an invalid alternative selection`);
        }

        const priceAdjustment = Number(alternativeProductConfig.priceAdjustment || 0);
        linePriceAdjustment += priceAdjustment;
        selectedAlternativeMap.set(alternative.sourceProductId, alternative.selectedProductId);
        selectedAlternativeDetails.push({
          sourceProduct: sourceProduct._id,
          sourceName: sourceProduct.name,
          selectedProduct: selectedProduct._id,
          selectedName: selectedProduct.name,
          priceAdjustment
        });
      });

      const lineSubtotal = (product.price + linePriceAdjustment) * quantity;
      subtotal += lineSubtotal;

      const components = buildProductComponents(product, quantity, productMap, selectedAlternativeMap).map((component) => {
        const rawKey = String(component.product);
        rawRequirements.set(rawKey, (rawRequirements.get(rawKey) || 0) + component.quantity);

        return {
          product: component.product,
          name: component.name,
          quantity: component.quantity
        };
      });

      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price + linePriceAdjustment,
        quantity,
        productType: product.productType,
        components,
        selectedAlternatives: selectedAlternativeDetails,
        subtotal: lineSubtotal
      });
      continue;
    }

    const lineSubtotal = product.price * quantity;
    subtotal += lineSubtotal;
    orderItems.push({
      product: product._id,
      name: product.name,
      price: product.price,
      quantity,
      productType: "raw",
      components: [],
      selectedAlternatives: [],
      subtotal: lineSubtotal
    });
    rawRequirements.set(productId, (rawRequirements.get(productId) || 0) + quantity);
  }

  const rawIds = [...rawRequirements.keys()];
  const rawProducts = await Product.find({ _id: { $in: rawIds } });
  const rawProductMap = new Map(rawProducts.map((product) => [String(product._id), product]));

  for (const [rawId, requiredQuantity] of rawRequirements.entries()) {
    const rawProduct = rawProductMap.get(rawId);

    if (!rawProduct || !isBaseProductType(rawProduct.productType)) {
      throw new Error("One or more raw items no longer exist");
    }

    if (!rawProduct.isActive || rawProduct.stock === 0) {
      throw new Error(`${rawProduct.name} is out of stock`);
    }

    if (requiredQuantity > rawProduct.stock) {
      throw new Error(`Only ${rawProduct.stock} units left for ${rawProduct.name}`);
    }
  }

  return { orderItems, subtotal, total: subtotal };
};

const applyInventoryForItems = async (orderItems, sauceItems = []) => {
  const rawRequirements = buildRawRequirements(orderItems, sauceItems);
  const itemIds = [...rawRequirements.keys()];
  const products = await Product.find({ _id: { $in: itemIds } });
  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const appliedUpdates = [];

  try {
    for (const [productId, quantity] of rawRequirements.entries()) {
      const product = productMap.get(productId);

      if (!product) {
        throw new Error("One or more products no longer exist");
      }

      if (!product.isActive || product.stock === 0) {
        throw new Error(`${product.name} is out of stock`);
      }

      if (quantity > product.stock) {
        throw new Error(`Only ${product.stock} units left for ${product.name}`);
      }

      const updateResult = await Product.updateOne(
        {
          _id: product._id,
          isActive: true,
          stock: { $gte: quantity }
        },
        {
          $inc: { stock: -quantity }
        }
      );

      if (updateResult.modifiedCount !== 1) {
        throw new Error(`${product.name} is no longer available in the requested quantity`);
      }

      appliedUpdates.push({ productId: product._id, quantity });

      const nextStock = product.stock - quantity;
      if (nextStock <= 0) {
        await Product.updateOne({ _id: product._id }, { $set: { isActive: false, stock: 0 } });
      }

    }
  } catch (error) {
    await rollbackAppliedUpdates(appliedUpdates);
    throw error;
  }

  return { appliedUpdates };
};

const restoreInventoryForOrderItems = async (items, sauceItems = []) => {
  const rawRequirements = buildRawRequirements(items, sauceItems);

  for (const [productId, quantity] of rawRequirements.entries()) {
    await Product.updateOne(
      { _id: productId },
      { $inc: { stock: quantity }, $set: { isActive: true } }
    );
    await syncProductAvailability(productId);
  }
};

const rollbackAppliedUpdates = async (appliedUpdates) => {
  for (const update of appliedUpdates) {
    await Product.updateOne(
      { _id: update.productId },
      { $inc: { stock: update.quantity }, $set: { isActive: true } }
    );
    await syncProductAvailability(update.productId);
  }
};

const populateOrder = (query) =>
  query
    .populate("staff", "name email role")
    .populate("voidedBy", "name email role")
    .populate("editedBy", "name email role")
    .populate("servedBy", "name email role")
    .populate("editHistory.editedBy", "name email role");

const createOrder = async (req, res) => {
  const { items, paymentMethod, bookingDetails } = req.body;

  if (!paymentMethod) {
    return res.status(400).json({ message: "Payment method is required" });
  }

  const normalizedBookingDetails = normalizeBookingDetails(bookingDetails);

  try {
    const requestedItems = buildRequestedItems(items);
    const { orderItems, subtotal, total } = await buildOrderItemsFromProducts(requestedItems);
    const orderId = generateOrderId();

    const order = await Order.create({
      orderId,
      queueNumber: buildQueueNumber(orderId),
      items: orderItems,
      subtotal,
      total,
      paymentMethod,
      bookingDetails: normalizedBookingDetails,
      staff: req.user._id,
      status: "food_serving",
      source: "staff"
    });

    const populatedOrder = await populateOrder(Order.findById(order._id));
    res.status(201).json(populatedOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const createPublicOrder = async (req, res) => {
  const { items } = req.body;

  try {
    const requestedItems = buildRequestedItems(items);
    const { orderItems, subtotal, total } = await buildOrderItemsFromProducts(requestedItems);
    const orderId = generateOrderId();

    const order = await Order.create({
      orderId,
      queueNumber: buildQueueNumber(orderId),
      items: orderItems,
      subtotal,
      total,
      paymentMethod: null,
      staff: null,
      status: "queued",
      source: "customer"
    });

    res.status(201).json({
      id: order._id,
      orderId: order.orderId,
      queueNumber: order.queueNumber,
      status: order.status,
      createdAt: order.createdAt,
      total: order.total,
      subtotal: order.subtotal,
      items: order.items
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getOrders = async (req, res) => {
  const query =
    ["master_admin", "admin", "checker"].includes(req.user.role)
      ? {}
      : {
          $or: [{ staff: req.user._id }, { status: "queued", source: "customer" }]
        };
  const { from, to } = req.query;

  if (from || to) {
    query.createdAt = {};

    if (from) {
      const fromDate = buildLocalDayRange(from);
      if (Number.isNaN(fromDate.getTime())) {
        return res.status(400).json({ message: "Invalid from date" });
      }
      query.createdAt.$gte = fromDate;
    }

    if (to) {
      const toDate = buildLocalDayRange(to, true);
      if (Number.isNaN(toDate.getTime())) {
        return res.status(400).json({ message: "Invalid to date" });
      }
      query.createdAt.$lte = toDate;
    }

    if (Object.keys(query.createdAt).length === 0) {
      delete query.createdAt;
    }
  }

  const orders = await populateOrder(Order.find(query).sort({ createdAt: -1 }));
  res.json(orders);
};

const getEditedOrders = async (req, res) => {
  const { from, to } = req.query;
  const query = { "editHistory.0": { $exists: true } };

  if (from || to) {
    query.editedAt = {};

    if (from) {
      const fromDate = buildLocalDayRange(from);
      if (Number.isNaN(fromDate.getTime())) {
        return res.status(400).json({ message: "Invalid from date" });
      }
      query.editedAt.$gte = fromDate;
    }

    if (to) {
      const toDate = buildLocalDayRange(to, true);
      if (Number.isNaN(toDate.getTime())) {
        return res.status(400).json({ message: "Invalid to date" });
      }
      query.editedAt.$lte = toDate;
    }
  }

  const orders = await populateOrder(Order.find(query).sort({ editedAt: -1, createdAt: -1 }));
  res.json(orders);
};

const getOrderById = async (req, res) => {
  const query = ["master_admin", "admin", "checker"].includes(req.user.role)
    ? { _id: req.params.id }
    : {
        _id: req.params.id,
        $or: [{ staff: req.user._id }, { status: "queued", source: "customer" }]
      };
  const order = await populateOrder(Order.findOne(query));

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  res.json(order);
};

const updateOrder = async (req, res) => {
  const { items, paymentMethod, bookingDetails } = req.body;

  if (!paymentMethod) {
    return res.status(400).json({ message: "Payment method is required" });
  }

  const normalizedBookingDetails = normalizeBookingDetails(bookingDetails);

  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (order.status === "void") {
    return res.status(400).json({ message: "Void sales cannot be edited" });
  }

  if (!["master_admin", "admin"].includes(req.user.role) && isCompletedStatus(order.status)) {
    return res.status(403).json({ message: "Only admin can edit completed orders" });
  }

  try {
    const requestedItems = buildRequestedItems(items);
    const previousItems = normalizeOrderItems(order.items);
    const previousSubtotal = order.subtotal;
    const previousTotal = order.total;
    const previousPaymentMethod = order.paymentMethod;
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

    if (!isQueuedOrder && adjustmentType !== "none" && !adjustmentMethod) {
      if (inventoryRestored) {
        await applyInventoryForItems(order.items, order.sauceItems || []);
      }
      return res.status(400).json({ message: "Adjustment method is required when the total changes" });
    }

    if (adjustmentType === "none" || isQueuedOrder) {
      adjustmentMethod = null;
    }

    const nextItems = normalizeOrderItems(nextOrderState.orderItems);
    const changes = buildItemChangeLog(previousItems, nextItems);

    if (previousPaymentMethod !== paymentMethod) {
      changes.push(`Payment method: ${previousPaymentMethod} -> ${paymentMethod}`);
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

    order.items = nextOrderState.orderItems;
    order.subtotal = nextOrderState.subtotal;
    order.total = nextOrderState.total;
    order.paymentMethod = paymentMethod;
    order.bookingDetails = normalizedBookingDetails;
    order.staff = req.user._id;
    order.status = isQueuedOrder ? "food_serving" : order.status;
    order.editedAt = new Date();
    order.editedBy = req.user._id;
    order.editHistory.push({
      editedBy: req.user._id,
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
      oldItems: previousItems,
      newItems: nextItems,
      changes
    });
    await order.save();

    const populatedOrder = await populateOrder(Order.findById(order._id));
    res.json(populatedOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const voidOrder = async (req, res) => {
  const { refundMethod = null } = req.body || {};
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (order.status === "void") {
    return res.status(400).json({ message: "Order is already void" });
  }

  if (!["master_admin", "admin"].includes(req.user.role) && order.status === "confirmed") {
    return res.status(403).json({ message: "Only admin can void completed orders" });
  }

  const previousItems = normalizeOrderItems(order.items);
  const previousSubtotal = order.subtotal;
  const previousTotal = order.total;
  const previousPaymentMethod = order.paymentMethod;
  const refundAmount = Number(previousTotal || 0);

  if (refundAmount > 0 && !refundMethod && !isQueuedStatus(order.status)) {
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
  order.voidedBy = req.user._id;
  order.editedAt = new Date();
  order.editedBy = req.user._id;
  order.editHistory.push({
    editedBy: req.user._id,
    editedAt: new Date(),
    oldSubtotal: previousSubtotal,
    newSubtotal: 0,
    oldTotal: previousTotal,
    newTotal: 0,
    adjustmentType: refundAmount > 0 && !isQueuedStatus(order.status) ? "void" : "none",
    adjustmentAmount: isQueuedStatus(order.status) ? 0 : refundAmount,
    adjustmentMethod: refundAmount > 0 && !isQueuedStatus(order.status) ? refundMethod : null,
    oldPaymentMethod: previousPaymentMethod,
    newPaymentMethod: previousPaymentMethod,
    oldItems: previousItems,
    newItems: [],
    changes: [
      isQueuedStatus(order.status) ? "Customer queue order canceled" : "Order voided",
      ...(refundAmount > 0 && !isQueuedStatus(order.status) ? [`Refunded ${refundAmount.toFixed(2)} via ${refundMethod}`] : ["No refund amount"])
    ]
  });
  await order.save();

  const populatedOrder = await populateOrder(Order.findById(order._id));
  res.json(populatedOrder);
};

const serveOrder = async (req, res) => {
  const order = await Order.findById(req.params.id);

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
    const sauceItems = await buildSauceItems(req.body?.sauceItems || []);
    const seasoningItems = await buildSeasoningItems();
    const servedAuxiliaryItems = [...sauceItems, ...seasoningItems];
    await applyInventoryForItems(order.items, servedAuxiliaryItems);

    order.status = "completed";
    order.sauceItems = servedAuxiliaryItems;
    order.servedAt = new Date();
    order.servedBy = req.user._id;
    await order.save();

    const populatedOrder = await populateOrder(Order.findById(order._id));
    res.json(populatedOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { createOrder, createPublicOrder, getOrders, getEditedOrders, getOrderById, updateOrder, voidOrder, serveOrder };
