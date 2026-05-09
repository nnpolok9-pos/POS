const PARTNER_KEYS = ["grab", "foodpanda", "e_gates", "wownow"];

const PARTNER_LABELS = {
  grab: "Grab",
  foodpanda: "Foodpanda",
  e_gates: "E-Gates",
  wownow: "WOWNOW"
};

const PARTNER_PROMO_DISCOUNT_TYPES = ["fixed", "percentage"];


const DEFAULT_PARTNER_COMMISSIONS = {
  foodpanda: 27.5,
  grab: 27.5,
  e_gates: 22,
  wownow: 22
};

const DEFAULT_PARTNER_ADVERTISEMENT_ROI = {
  foodpanda: 14,
  grab: 14,
  e_gates: 14,
  wownow: 14
};

const createDefaultPartnerSetting = (partnerKey) => ({
  partnerKey,
  partnerName: PARTNER_LABELS[partnerKey] || partnerKey,
  commissionRate: DEFAULT_PARTNER_COMMISSIONS[partnerKey] ?? 0,
  advertisementRoiRate: DEFAULT_PARTNER_ADVERTISEMENT_ROI[partnerKey] ?? 14,
  isActive: true,
  promos: []
});

const buildDefaultPartnerSettings = () => PARTNER_KEYS.map((partnerKey) => createDefaultPartnerSetting(partnerKey));

const normalizePartnerPromo = (promo = {}, index = 0) => {
  const rawName = String(promo.name || promo.title || promo.code || `Promo ${index + 1}`).trim();
  const discountType = PARTNER_PROMO_DISCOUNT_TYPES.includes(promo.discountType) ? promo.discountType : "fixed";

  return {
    id: String(promo.id || `${Date.now()}-${index}`).trim(),
    name: rawName || `Promo ${index + 1}`,
    discountType,
    discountValue: Number(promo.discountValue || 0),
    minOrderAmount: Number(promo.minOrderAmount || 0),
    maxDiscountAmount:
      promo.maxDiscountAmount === null || promo.maxDiscountAmount === undefined || promo.maxDiscountAmount === ""
        ? null
        : Number(promo.maxDiscountAmount),
    isActive: promo.isActive !== false,
    isDefault: Boolean(promo.isDefault),
    notes: String(promo.notes || "").trim()
  };
};

const normalizePartnerSetting = (setting = {}) => {
  const partnerKey = String(setting.partnerKey || "").trim();

  return {
    partnerKey,
    partnerName: String(setting.partnerName || PARTNER_LABELS[partnerKey] || partnerKey).trim(),
    commissionRate: Number(setting.commissionRate || 0),
    advertisementRoiRate: Number(setting.advertisementRoiRate ?? DEFAULT_PARTNER_ADVERTISEMENT_ROI[partnerKey] ?? 14),
    isActive: setting.isActive !== false,
    promos: Array.isArray(setting.promos) ? setting.promos.map((promo, index) => normalizePartnerPromo(promo, index)) : []
  };
};

const getPartnerPromoDiscount = (promo, subtotal) => {
  const numericSubtotal = Number(subtotal || 0);
  if (!promo || numericSubtotal <= 0) {
    return 0;
  }

  if (numericSubtotal < Number(promo.minOrderAmount || 0)) {
    return 0;
  }

  let discount =
    promo.discountType === "percentage"
      ? (numericSubtotal * Number(promo.discountValue || 0)) / 100
      : Number(promo.discountValue || 0);

  if (promo.maxDiscountAmount !== null && promo.maxDiscountAmount !== undefined) {
    discount = Math.min(discount, Number(promo.maxDiscountAmount || 0));
  }

  discount = Math.max(0, Math.min(discount, numericSubtotal));
  return Number(discount.toFixed(2));
};

const applyPartnerPromotions = ({ partnerSetting, subtotal, selectedPromoIds = [] }) => {
  const normalizedSetting = normalizePartnerSetting(partnerSetting);
  const activePromos = normalizedSetting.promos.filter((promo) => promo.isActive);
  const requestedIds = selectedPromoIds.map((promoId) => String(promoId));
  const selectedPromos =
    requestedIds.length > 0
      ? activePromos.filter((promo) => requestedIds.includes(String(promo.id)))
      : activePromos.filter((promo) => promo.isDefault);

  let runningSubtotal = Number(subtotal || 0);
  let totalDiscount = 0;
  const appliedPromotions = [];

  selectedPromos.forEach((promo) => {
    const discount = getPartnerPromoDiscount(promo, runningSubtotal);
    if (discount <= 0) {
      return;
    }

    runningSubtotal = Number((runningSubtotal - discount).toFixed(2));
    totalDiscount += discount;
    appliedPromotions.push({
      id: promo.id,
      name: promo.name,
      discountType: promo.discountType,
      discountValue: Number(promo.discountValue || 0),
      minOrderAmount: Number(promo.minOrderAmount || 0),
      maxDiscountAmount: promo.maxDiscountAmount,
      isDefault: Boolean(promo.isDefault),
      discountApplied: discount
    });
  });

  return {
    promoCode: appliedPromotions.length ? appliedPromotions.map((promo) => promo.name).join(" + ") : null,
    promoDiscount: Number(totalDiscount.toFixed(2)),
    promoSnapshot: appliedPromotions.length
      ? {
          type: "partner",
          partner: normalizedSetting.partnerKey,
          partnerName: normalizedSetting.partnerName,
          commissionRate: Number(normalizedSetting.commissionRate || 0),
          advertisementRoiRate: Number(normalizedSetting.advertisementRoiRate || 0),
          promotions: appliedPromotions
        }
      : null,
    selectedPromoIds: appliedPromotions.map((promo) => promo.id)
  };
};

module.exports = {
  PARTNER_KEYS,
  PARTNER_LABELS,
  DEFAULT_PARTNER_ADVERTISEMENT_ROI,
  buildDefaultPartnerSettings,
  createDefaultPartnerSetting,
  normalizePartnerPromo,
  normalizePartnerSetting,
  applyPartnerPromotions
};
