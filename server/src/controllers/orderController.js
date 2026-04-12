const generateOrderId = require("../utils/generateOrderId");
const {
  getAllProducts,
  getOrders: getAllOrders,
  getOrderById: getStoredOrderById,
  saveOrder,
  getUsersByIds,
  deleteOrderById
} = require("../lib/dataStore");
const { isCompositeProductType, isBaseProductType, inferProductType, saveProduct } = require("../lib/productLogic");

const buildLocalDayRange = (dateValue, endOfDay = false) => {
  const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  return new Date(`${dateValue}${suffix}`);
};

const normalizeOrderItems = (items = []) =>
  items.map((item) => ({
    product: item.product,
    name: item.name,
    price: Number(item.price || 0),
    quantity: Number(item.quantity || 0),
    productType: item.productType || "raw",
    components: (item.components || []).map((component) => ({
      product: component.product,
      name: component.name,
      quantity: Number(component.quantity || 0)
    })),
    selectedAlternatives: (item.selectedAlternatives || []).map((alternative) => ({
      sourceProduct: alternative.sourceProduct,
      sourceName: alternative.sourceName,
      selectedProduct: alternative.selectedProduct,
      selectedName: alternative.selectedName,
      priceAdjustment: Number(alternative.priceAdjustment || 0)
    })),
    subtotal: Number(item.subtotal || 0)
  }));

const normalizeSauceItems = (items = []) =>
  items
    .map((item) => ({
      product: item.product,
      name: item.name,
      quantity: Number(item.quantity || 0),
      stockUnit: item.stockUnit || "pieces"
    }))
    .filter((item) => item.product && item.quantity > 0);

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

const buildProductComponents = (product, quantity, productMap, selectedAlternativeMap = new Map(), trail = new Set()) => {
  const productId = String(product.id || product._id);

  if (!isCompositeProductType(product.productType)) {
    return [
      {
        product: product.id || product._id,
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
    const sourceProductId = String(comboItem.product?.id || comboItem.product?._id || comboItem.product);
    const replacementProductId = comboItem.changeable ? selectedAlternativeMap.get(sourceProductId) : null;

    if (replacementProductId) {
      const allowedAlternativeIds = (comboItem.alternativeProducts || []).map((alternativeProduct) =>
        String(alternativeProduct.product?.id || alternativeProduct.product?._id || alternativeProduct.product || alternativeProduct.id || alternativeProduct)
      );

      if (!allowedAlternativeIds.includes(String(replacementProductId))) {
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
  const products = await getAllProducts();
  const productMap = new Map(products.map((product) => [String(product.id || product._id), product]));
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
          (comboItem) => String(comboItem.product?.id || comboItem.product?._id || comboItem.product) === alternative.sourceProductId
        );

        const alternativeProductConfig = (sourceComboItem?.alternativeProducts || []).find(
          (alternativeProduct) =>
            String(
              alternativeProduct.product?.id ||
                alternativeProduct.product?._id ||
                alternativeProduct.product ||
                alternativeProduct.id ||
                alternativeProduct
            ) === alternative.selectedProductId
        );

        if (!sourceComboItem || !alternativeProductConfig) {
          throw new Error(`${product.name} has an invalid alternative selection`);
        }

        const priceAdjustment = Number(alternativeProductConfig.priceAdjustment || 0);
        linePriceAdjustment += priceAdjustment;
        selectedAlternativeMap.set(alternative.sourceProductId, alternative.selectedProductId);
        selectedAlternativeDetails.push({
          sourceProduct: sourceProduct.id || sourceProduct._id,
          sourceName: sourceProduct.name,
          selectedProduct: selectedProduct.id || selectedProduct._id,
          selectedName: selectedProduct.name,
          priceAdjustment
        });
      });

      const lineSubtotal = (Number(product.price || 0) + linePriceAdjustment) * quantity;
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
        product: product.id || product._id,
        name: product.name,
        price: Number(product.price || 0) + linePriceAdjustment,
        quantity,
        productType: product.productType,
        components,
        selectedAlternatives: selectedAlternativeDetails,
        subtotal: lineSubtotal
      });
      continue;
    }

    const lineSubtotal = Number(product.price || 0) * quantity;
    subtotal += lineSubtotal;
    orderItems.push({
      product: product.id || product._id,
      name: product.name,
      price: Number(product.price || 0),
      quantity,
      productType: inferProductType(product),
      components: [],
      selectedAlternatives: [],
      subtotal: lineSubtotal
    });
    rawRequirements.set(productId, (rawRequirements.get(productId) || 0) + quantity);
  }

  const rawProductMap = productMap;
  for (const [rawId, requiredQuantity] of rawRequirements.entries()) {
    const rawProduct = rawProductMap.get(rawId);

    if (!rawProduct || !isBaseProductType(rawProduct)) {
      throw new Error("One or more raw items no longer exist");
    }

    if (!rawProduct.isActive || Number(rawProduct.stock || 0) === 0) {
      throw new Error(`${rawProduct.name} is out of stock`);
    }

    if (requiredQuantity > Number(rawProduct.stock || 0)) {
      throw new Error(`Only ${rawProduct.stock} units left for ${rawProduct.name}`);
    }
  }

  return { orderItems, subtotal, total: subtotal };
};

const buildRawRequirements = (orderItems, sauceItems = []) => {
  const rawRequirements = new Map();

  orderItems.forEach((item) => {
    if (isCompositeProductType(item.productType)) {
      item.components.forEach((component) => {
        const key = String(component.product);
        rawRequirements.set(key, (rawRequirements.get(key) || 0) + Number(component.quantity || 0));
      });
      return;
    }

    const key = String(item.product);
    rawRequirements.set(key, (rawRequirements.get(key) || 0) + Number(item.quantity || 0));
  });

  sauceItems.forEach((item) => {
    const key = String(item.product);
    rawRequirements.set(key, (rawRequirements.get(key) || 0) + Number(item.quantity || 0));
  });

  return rawRequirements;
};

const applyInventoryForItems = async (orderItems, sauceItems = []) => {
  const rawRequirements = buildRawRequirements(orderItems, sauceItems);
  const products = await getAllProducts();
  const productMap = new Map(products.map((product) => [String(product.id || product._id), product]));
  const appliedUpdates = [];

  try {
    for (const [productId, quantity] of rawRequirements.entries()) {
      const product = productMap.get(productId);

      if (!product) {
        throw new Error("One or more products no longer exist");
      }

      if (!product.isActive || Number(product.stock || 0) === 0) {
        throw new Error(`${product.name} is out of stock`);
      }

      if (quantity > Number(product.stock || 0)) {
        throw new Error(`Only ${product.stock} units left for ${product.name}`);
      }

      const previousStock = Number(product.stock || 0);
      product.stock = previousStock - quantity;
      product.isActive = product.stock > 0;
      await saveProduct(product);
      appliedUpdates.push({ product, previousStock, quantity });
    }
  } catch (error) {
    for (const update of appliedUpdates) {
      update.product.stock = update.previousStock;
      update.product.isActive = true;
      await saveProduct(update.product);
    }
    throw error;
  }

  return { appliedUpdates };
};

const restoreInventoryForOrderItems = async (items, sauceItems = []) => {
  const rawRequirements = buildRawRequirements(items, sauceItems);
  const products = await getAllProducts();
  const productMap = new Map(products.map((product) => [String(product.id || product._id), product]));

  for (const [productId, quantity] of rawRequirements.entries()) {
    const product = productMap.get(productId);
    if (!product) {
      continue;
    }
    product.stock = Number(product.stock || 0) + quantity;
    product.isActive = true;
    await saveProduct(product);
  }
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

  const products = await getAllProducts();
  const productMap = new Map(products.map((product) => [String(product.id || product._id), product]));

  return [...mergedSauces.entries()].map(([productId, quantity]) => {
    const sauce = productMap.get(productId);
    if (!sauce) {
      throw new Error("One or more sauce items no longer exist");
    }
    if (sauce.productType !== "sauce") {
      throw new Error(`${sauce.name} is not a Sauce product type`);
    }

    return {
      product: sauce.id || sauce._id,
      name: sauce.name,
      quantity,
      stockUnit: sauce.stockUnit || "pieces"
    };
  });
};

const buildSeasoningItems = async () => {
  const products = await getAllProducts();
  return products
    .filter((product) => product.productType === "seasoning" && product.isActive)
    .map((seasoning) => ({
      product: seasoning.id || seasoning._id,
      name: seasoning.name,
      quantity: Number(seasoning.seasoningPerOrderConsumption || 0),
      stockUnit: seasoning.stockUnit || "gram"
    }))
    .filter((seasoning) => seasoning.quantity > 0);
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

  if (!paymentMethod) {
    return res.status(400).json({ message: "Payment method is required" });
  }

  try {
    const requestedItems = buildRequestedItems(items);
    const { orderItems, subtotal, total } = await buildOrderItemsFromProducts(requestedItems);
    const orderId = generateOrderId();
    const order = await saveOrder({
      orderId,
      queueNumber: buildQueueNumber(orderId),
      items: orderItems,
      sauceItems: [],
      subtotal,
      total,
      paymentMethod,
      bookingDetails: normalizeBookingDetails(bookingDetails),
      staff: req.user.id,
      status: "food_serving",
      source: "staff",
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
    const { orderItems, subtotal, total } = await buildOrderItemsFromProducts(requestedItems);
    const orderId = generateOrderId();
    const order = await saveOrder({
      orderId,
      queueNumber: buildQueueNumber(orderId),
      items: orderItems,
      sauceItems: [],
      subtotal,
      total,
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
      total: order.total,
      subtotal: order.subtotal,
      items: order.items
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getOrders = async (req, res) => {
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

  if (!paymentMethod) {
    return res.status(400).json({ message: "Payment method is required" });
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

    Object.assign(order, {
      items: nextOrderState.orderItems,
      subtotal: nextOrderState.subtotal,
      total: nextOrderState.total,
      paymentMethod,
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
      adjustmentType: refundAmount > 0 && !isQueuedStatus(previousStatus) ? "void" : "none",
      adjustmentAmount: isQueuedStatus(previousStatus) ? 0 : refundAmount,
      adjustmentMethod: refundAmount > 0 && !isQueuedStatus(previousStatus) ? refundMethod : null,
      oldPaymentMethod: previousPaymentMethod,
      newPaymentMethod: previousPaymentMethod,
      oldItems: previousItems,
      newItems: [],
      changes: [
        isQueuedStatus(previousStatus) ? "Customer queue order canceled" : "Order voided",
        ...(refundAmount > 0 && !isQueuedStatus(previousStatus) ? [`Refunded ${refundAmount.toFixed(2)} via ${refundMethod}`] : ["No refund amount"])
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
    const sauceItems = await buildSauceItems(req.body?.sauceItems || []);
    const seasoningItems = await buildSeasoningItems();
    const servedAuxiliaryItems = [...sauceItems, ...seasoningItems];
    await applyInventoryForItems(order.items, servedAuxiliaryItems);

    order.status = "completed";
    order.sauceItems = servedAuxiliaryItems;
    order.servedAt = new Date();
    order.servedBy = req.user.id;
    await saveOrder(order);

    const [hydrated] = await hydrateOrders([await getStoredOrderById(order.id)]);
    res.json(hydrated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteOrder = async (req, res) => {
  const order = await getStoredOrderById(req.params.id);

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  await deleteOrderById(order.id);
  res.json({ message: "Order deleted successfully" });
};

module.exports = {
  createOrder,
  createPublicOrder,
  getOrders,
  getEditedOrders,
  getOrderById,
  updateOrder,
  voidOrder,
  serveOrder,
  deleteOrder
};
