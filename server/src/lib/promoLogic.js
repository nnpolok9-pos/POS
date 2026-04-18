const PROMO_DISCOUNT_TYPES = ["fixed", "percentage"];
const PROMO_APPLIES_TO = ["all", "pos", "menu"];
const BUSINESS_TIMEZONE_OFFSET = "+07:00";

const normalizePromoCode = (value) => String(value || "").trim().toUpperCase();

const parsePromoDate = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const rawValue = String(value).trim();
  if (!rawValue) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    const parsed = new Date(`${rawValue}T00:00:00${BUSINESS_TIMEZONE_OFFSET}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(rawValue)) {
    const normalized = rawValue.replace(" ", "T");
    const withSeconds = normalized.length === 16 ? `${normalized}:00` : normalized;
    const parsed = new Date(`${withSeconds}${BUSINESS_TIMEZONE_OFFSET}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const sameLocalDay = (left, right) => {
  const leftDate = parsePromoDate(left);
  const rightDate = parsePromoDate(right);

  if (!leftDate || !rightDate) {
    return false;
  }

  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
};

const serializePromoDate = (value) => {
  const parsed = parsePromoDate(value);
  if (!parsed) {
    return null;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  const seconds = String(parsed.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const normalizePromoPayload = (payload = {}) => {
  const discountType = PROMO_DISCOUNT_TYPES.includes(payload.discountType) ? payload.discountType : "fixed";
  const appliesTo = PROMO_APPLIES_TO.includes(payload.appliesTo) ? payload.appliesTo : "all";

  return {
    code: normalizePromoCode(payload.code),
    title: String(payload.title || "").trim(),
    description: String(payload.description || "").trim(),
    discountType,
    discountValue: Number(payload.discountValue || 0),
    minOrderAmount: Number(payload.minOrderAmount || 0),
    maxDiscountAmount:
      payload.maxDiscountAmount === null || payload.maxDiscountAmount === undefined || payload.maxDiscountAmount === ""
        ? null
        : Number(payload.maxDiscountAmount),
    startsAt: serializePromoDate(payload.startsAt),
    expiresAt: serializePromoDate(payload.expiresAt),
    maxTotalUses:
      payload.maxTotalUses === null || payload.maxTotalUses === undefined || payload.maxTotalUses === ""
        ? null
        : Number(payload.maxTotalUses),
    maxUsesPerDay:
      payload.maxUsesPerDay === null || payload.maxUsesPerDay === undefined || payload.maxUsesPerDay === ""
        ? null
        : Number(payload.maxUsesPerDay),
    appliesTo,
    isActive: payload.isActive !== false,
    notes: String(payload.notes || "").trim()
  };
};

const buildPromoSnapshot = (promo) => ({
  id: promo.id,
  code: promo.code,
  title: promo.title || "",
  description: promo.description || "",
  discountType: promo.discountType || "fixed",
  discountValue: Number(promo.discountValue || 0),
  minOrderAmount: Number(promo.minOrderAmount || 0),
  maxDiscountAmount: promo.maxDiscountAmount === null ? null : Number(promo.maxDiscountAmount),
  startsAt: promo.startsAt || null,
  expiresAt: promo.expiresAt || null,
  maxTotalUses: promo.maxTotalUses === null ? null : Number(promo.maxTotalUses),
  maxUsesPerDay: promo.maxUsesPerDay === null ? null : Number(promo.maxUsesPerDay),
  appliesTo: promo.appliesTo || "all"
});

const calculatePromoDiscount = (promoSnapshot, subtotal) => {
  const numericSubtotal = Number(subtotal || 0);
  if (!promoSnapshot || numericSubtotal <= 0) {
    return 0;
  }

  let discount =
    promoSnapshot.discountType === "percentage"
      ? (numericSubtotal * Number(promoSnapshot.discountValue || 0)) / 100
      : Number(promoSnapshot.discountValue || 0);

  if (promoSnapshot.maxDiscountAmount !== null && promoSnapshot.maxDiscountAmount !== undefined) {
    discount = Math.min(discount, Number(promoSnapshot.maxDiscountAmount || 0));
  }

  discount = Math.max(0, Math.min(discount, numericSubtotal));
  return Number(discount.toFixed(2));
};

const getPromoUsageStats = ({ promoId, orders, excludeOrderId = null, at = new Date() }) => {
  const filteredOrders = (orders || []).filter(
    (order) =>
      String(order.promoCodeId || "") === String(promoId) &&
      order.status !== "void" &&
      (!excludeOrderId || String(order.id) !== String(excludeOrderId))
  );

  const totalUses = filteredOrders.length;
  const todayUses = filteredOrders.filter((order) => sameLocalDay(order.createdAt, at)).length;

  return { totalUses, todayUses };
};

const validatePromoForOrder = ({ promo, subtotal, source = "pos", usageStats }) => {
  if (!promo) {
    throw new Error("Promo code not found");
  }

  if (!promo.isActive) {
    throw new Error("Promo code is inactive");
  }

  const now = new Date();
  const startsAt = parsePromoDate(promo.startsAt);
  const expiresAt = parsePromoDate(promo.expiresAt);

  if (startsAt && now < startsAt) {
    throw new Error("Promo code is not active yet");
  }

  if (expiresAt && now > expiresAt) {
    throw new Error("Promo code has expired");
  }

  if (!PROMO_APPLIES_TO.includes(promo.appliesTo || "all")) {
    throw new Error("Promo code has an invalid target source");
  }

  if (promo.appliesTo !== "all" && promo.appliesTo !== source) {
    throw new Error(`Promo code is not available for ${source === "menu" ? "customer menu orders" : "POS orders"}`);
  }

  if (Number(subtotal || 0) < Number(promo.minOrderAmount || 0)) {
    throw new Error("Order does not meet the minimum amount for this promo code");
  }

  if (promo.maxTotalUses !== null && usageStats.totalUses >= Number(promo.maxTotalUses || 0)) {
    throw new Error("Promo code has reached its maximum total uses");
  }

  if (promo.maxUsesPerDay !== null && usageStats.todayUses >= Number(promo.maxUsesPerDay || 0)) {
    throw new Error("Promo code has reached its daily usage limit");
  }

  const promoSnapshot = buildPromoSnapshot(promo);
  const promoDiscount = calculatePromoDiscount(promoSnapshot, subtotal);

  if (promoDiscount <= 0) {
    throw new Error("Promo code does not apply to this order");
  }

  return {
    promoCodeId: promo.id,
    promoCode: promo.code,
    promoDiscount,
    promoSnapshot
  };
};

module.exports = {
  PROMO_DISCOUNT_TYPES,
  PROMO_APPLIES_TO,
  normalizePromoCode,
  parsePromoDate,
  normalizePromoPayload,
  buildPromoSnapshot,
  calculatePromoDiscount,
  getPromoUsageStats,
  validatePromoForOrder
};
