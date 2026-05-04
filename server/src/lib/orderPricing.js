const { getAllProducts } = require("./dataStore");
const { isCompositeProductType, isBaseProductType, inferProductType, saveProduct } = require("./productLogic");

const normalizeOrderItems = (items = []) =>
  items.map((item) => ({
    product: item.product,
    name: item.name,
    image: item.image || "",
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

    const unitPrice =
      item.unitPrice === undefined || item.unitPrice === null || item.unitPrice === ""
        ? null
        : Number(item.unitPrice);

    if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
      throw new Error("Each custom item price must be zero or more");
    }

    return {
      productId: String(item.productId),
      quantity: item.quantity,
      unitPrice,
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
    const { productId, quantity, unitPrice, selectedAlternatives = [] } = requestItem;
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

      const defaultUnitPrice = Number(product.price || 0) + linePriceAdjustment;
      const finalUnitPrice = unitPrice !== null ? unitPrice : defaultUnitPrice;
      const lineSubtotal = finalUnitPrice * quantity;
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
        image: product.image || "",
        price: finalUnitPrice,
        quantity,
        productType: product.productType,
        components,
        selectedAlternatives: selectedAlternativeDetails,
        subtotal: lineSubtotal
      });
      continue;
    }

    const finalUnitPrice = unitPrice !== null ? unitPrice : Number(product.price || 0);
    const lineSubtotal = finalUnitPrice * quantity;
    subtotal += lineSubtotal;
    orderItems.push({
      product: product.id || product._id,
      name: product.name,
      image: product.image || "",
      price: finalUnitPrice,
      quantity,
      productType: inferProductType(product),
      components: [],
      selectedAlternatives: [],
      subtotal: lineSubtotal
    });
    rawRequirements.set(productId, (rawRequirements.get(productId) || 0) + quantity);
  }

  for (const [rawId] of rawRequirements.entries()) {
    const rawProduct = productMap.get(rawId);

    if (!rawProduct || !isBaseProductType(rawProduct)) {
      throw new Error("One or more raw items no longer exist");
    }
  }

  return { orderItems, subtotal };
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

      const previousStock = Number(product.stock || 0);
      product.stock = previousStock - quantity;
      await saveProduct(product);
      appliedUpdates.push({ product, previousStock, quantity });
    }
  } catch (error) {
    for (const update of appliedUpdates) {
      update.product.stock = update.previousStock;
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
    .filter((product) => product.productType === "seasoning")
    .map((seasoning) => ({
      product: seasoning.id || seasoning._id,
      name: seasoning.name,
      quantity: Number(seasoning.seasoningPerOrderConsumption || 0),
      stockUnit: seasoning.stockUnit || "gram"
    }))
    .filter((seasoning) => seasoning.quantity > 0);
};

module.exports = {
  normalizeOrderItems,
  buildRequestedItems,
  buildOrderItemsFromProducts,
  applyInventoryForItems,
  restoreInventoryForOrderItems,
  buildSauceItems,
  buildSeasoningItems
};
