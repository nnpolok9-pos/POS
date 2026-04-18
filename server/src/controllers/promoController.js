const {
  getAllPromos,
  getPromoById,
  getPromoByCode,
  savePromo,
  deletePromoById,
  getOrders
} = require("../lib/dataStore");
const { buildRequestedItems, buildOrderItemsFromProducts } = require("../lib/orderPricing");
const {
  normalizePromoCode,
  parsePromoDate,
  normalizePromoPayload,
  getPromoUsageStats,
  validatePromoForOrder
} = require("../lib/promoLogic");

const enrichPromo = async (promo) => {
  const orders = await getOrders({ where: "WHERE promo_code_id=:promoCodeId", params: { promoCodeId: promo.id } });
  const usageStats = getPromoUsageStats({ promoId: promo.id, orders });
  const now = new Date();
  const startsAt = parsePromoDate(promo.startsAt);
  const expiresAt = parsePromoDate(promo.expiresAt);

  return {
    ...promo,
    usage: {
      totalUses: usageStats.totalUses,
      todayUses: usageStats.todayUses,
      remainingTotalUses:
        promo.maxTotalUses === null ? null : Math.max(Number(promo.maxTotalUses || 0) - usageStats.totalUses, 0),
      remainingDailyUses:
        promo.maxUsesPerDay === null ? null : Math.max(Number(promo.maxUsesPerDay || 0) - usageStats.todayUses, 0)
    },
    status: {
      isExpired: Boolean(expiresAt && now > expiresAt),
      isScheduled: Boolean(startsAt && now < startsAt)
    }
  };
};

const listPromos = async (_req, res) => {
  const promos = await getAllPromos();
  const enrichedPromos = await Promise.all(promos.map(enrichPromo));
  res.json(enrichedPromos);
};

const previewPromo = async (req, res) => {
  const promoCode = normalizePromoCode(req.body?.promoCode);
  const source = req.body?.source === "menu" ? "menu" : "pos";
  const orderId = req.body?.orderId || null;

  if (!promoCode) {
    return res.status(400).json({ message: "Promo code is required" });
  }

  try {
    const requestedItems = buildRequestedItems(req.body?.items || []);
    const { subtotal } = await buildOrderItemsFromProducts(requestedItems);
    const promo = await getPromoByCode(promoCode);

    if (!promo) {
      return res.status(404).json({ message: "Promo code not found" });
    }

    const promoOrders = await getOrders({ where: "WHERE promo_code_id=:promoCodeId", params: { promoCodeId: promo.id } });
    const usageStats = getPromoUsageStats({
      promoId: promo.id,
      orders: promoOrders,
      excludeOrderId: orderId
    });

    const appliedPromo = validatePromoForOrder({
      promo,
      subtotal,
      source,
      usageStats
    });

    res.json({
      code: appliedPromo.promoCode,
      discount: appliedPromo.promoDiscount,
      subtotal,
      total: Number((subtotal - appliedPromo.promoDiscount).toFixed(2)),
      promo: appliedPromo.promoSnapshot,
      usage: usageStats
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const createPromo = async (req, res) => {
  const payload = normalizePromoPayload(req.body);

  if (!payload.code) {
    return res.status(400).json({ message: "Promo code is required" });
  }

  if (payload.discountValue <= 0) {
    return res.status(400).json({ message: "Discount value must be greater than zero" });
  }

  if (payload.discountType === "percentage" && payload.discountValue > 100) {
    return res.status(400).json({ message: "Percentage discount cannot exceed 100" });
  }

  const existingPromo = await getPromoByCode(payload.code);
  if (existingPromo) {
    return res.status(400).json({ message: "Promo code already exists" });
  }

  const savedPromo = await savePromo({
    ...payload,
    createdBy: req.user.id,
    updatedBy: req.user.id
  });

  res.status(201).json(await enrichPromo(savedPromo));
};

const updatePromo = async (req, res) => {
  const existingPromo = await getPromoById(req.params.id);

  if (!existingPromo) {
    return res.status(404).json({ message: "Promo code not found" });
  }

  const payload = normalizePromoPayload(req.body);

  if (!payload.code) {
    return res.status(400).json({ message: "Promo code is required" });
  }

  if (payload.discountValue <= 0) {
    return res.status(400).json({ message: "Discount value must be greater than zero" });
  }

  if (payload.discountType === "percentage" && payload.discountValue > 100) {
    return res.status(400).json({ message: "Percentage discount cannot exceed 100" });
  }

  const promoWithSameCode = await getPromoByCode(payload.code);
  if (promoWithSameCode && String(promoWithSameCode.id) !== String(existingPromo.id)) {
    return res.status(400).json({ message: "Promo code already exists" });
  }

  const savedPromo = await savePromo({
    ...existingPromo,
    ...payload,
    updatedBy: req.user.id
  });

  res.json(await enrichPromo(savedPromo));
};

const removePromo = async (req, res) => {
  const existingPromo = await getPromoById(req.params.id);

  if (!existingPromo) {
    return res.status(404).json({ message: "Promo code not found" });
  }

  await deletePromoById(existingPromo.id);
  res.json({ message: "Promo code deleted successfully" });
};

module.exports = {
  listPromos,
  previewPromo,
  createPromo,
  updatePromo,
  removePromo
};
