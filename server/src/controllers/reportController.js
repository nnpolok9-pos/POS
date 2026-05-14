const { getOrders, getAllProducts, getAllPartnerSettings } = require("../lib/dataStore");
const { inferProductType, isCompositeProductType, buildCompositeRequirements } = require("../lib/productLogic");
const { calculateOrderItemCost, buildSelectedAlternativeMapFromOrderItem } = require("../lib/orderPricing");
const { applyPromoBillingRounding } = require("../lib/promoLogic");
const {
  buildTimezoneDateRange,
  buildTimezoneDayRange,
  buildTimezoneTodayRange,
  buildTimezoneMonthRange
} = require("../utils/reportDateRange");

const REPORT_TIMEZONE = process.env.REPORT_TIMEZONE || process.env.TZ || "Asia/Bangkok";
const COMPLETED_STATUSES = ["completed", "confirmed"];
const POS_PAYMENT_METHODS = ["cash", "card", "qr"];
const PARTNER_PAYMENT_METHODS = ["grab", "foodpanda", "e_gates", "wownow"];
const PAYMENT_METHODS = [...POS_PAYMENT_METHODS, ...PARTNER_PAYMENT_METHODS];
const LEGACY_PARTNER_PROMO_START_DAY = "2026-01-01";
const LEGACY_PARTNER_PROMO_END_DAY = "2026-05-06";
const LEGACY_PARTNER_PROMO_PERCENT = 15;
const PARTNER_LABELS = {
  grab: "Grab",
  foodpanda: "Foodpanda",
  e_gates: "E-Gates",
  wownow: "WOWNOW"
};
const PARTNER_DISPLAY_ORDER = ["grab", "foodpanda", "e_gates", "wownow"];
const isVoidHistoryEntry = (entry) => ["void", "void_edit"].includes(entry?.adjustmentType);
const hasCollectedPayment = (paymentMethod) => PAYMENT_METHODS.includes(paymentMethod);


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

const buildEmptyPaymentFlows = () =>
  PAYMENT_METHODS.reduce((acc, method) => {
    acc[`${method}In`] = 0;
    acc[`${method}Out`] = 0;
    return acc;
  }, {});

const roundReportAmount = (value) => Number(Number(value || 0).toFixed(2));
const getOrderGrossSales = (order) => Number(order?.subtotal || order?.total || 0);

const getPartnerKeyForOrder = (order) => {
  if (PARTNER_PAYMENT_METHODS.includes(order?.paymentMethod)) {
    return order.paymentMethod;
  }

  if (PARTNER_PAYMENT_METHODS.includes(order?.source)) {
    return order.source;
  }

  return null;
};

const getPartnerCommissionRateForOrder = (order, partnerSettingsMap, partnerKey) =>
  Number(
    order?.bookingDetails?.partnerCommissionRate ??
      order?.promoSnapshot?.commissionRate ??
      partnerSettingsMap.get(partnerKey)?.commissionRate ??
      0
  );

const getPartnerAdvertisementRoiRateForOrder = (order, partnerSettingsMap, partnerKey) =>
  Number(
    order?.bookingDetails?.partnerAdvertisementRoiRate ??
      order?.promoSnapshot?.advertisementRoiRate ??
      partnerSettingsMap.get(partnerKey)?.advertisementRoiRate ??
      0
  );

const getPartnerPromoDiscountForOrder = (order) => {
  const subtotal = Number(order?.subtotal || 0);
  const total = Number(order?.total || 0);
  const explicitPromoDiscount = Number(order?.promoDiscount || 0);
  const snapshotPromotionDiscount = Array.isArray(order?.promoSnapshot?.promotions)
    ? roundReportAmount(
        order.promoSnapshot.promotions.reduce(
          (sum, promotion) => sum + Number(promotion?.discountApplied || 0),
          0
        )
      )
    : 0;
  const computedDiscountFromTotals =
    subtotal > total ? roundReportAmount(subtotal - total) : 0;

  if (order?.promoSnapshot?.type === "partner") {
    return explicitPromoDiscount > 0
      ? explicitPromoDiscount
      : snapshotPromotionDiscount > 0
        ? snapshotPromotionDiscount
        : computedDiscountFromTotals;
  }

  return getPartnerKeyForOrder(order) ? computedDiscountFromTotals : 0;
};

const getCounterPromoDiscountForOrder = (order) => {
  if (getPartnerKeyForOrder(order)) {
    return 0;
  }

  return Math.max(0, Number(order?.promoDiscount || 0));
};

const getLegacyPartnerPromoMetrics = (order) => {
  const subtotal = Number(order?.subtotal || 0);

  if (subtotal <= 0) {
    return {
      partnerPromoDiscount: 0,
      salesAfterPromo: 0
    };
  }

  const roundedPromo = applyPromoBillingRounding({
    subtotal,
    promoDiscount: (subtotal * LEGACY_PARTNER_PROMO_PERCENT) / 100
  });

  return {
    partnerPromoDiscount: Number(roundedPromo.promoDiscount || 0),
    salesAfterPromo: Number(roundedPromo.total || 0)
  };
};

const getStoredOrderCost = (order) => {
  const directCost = Number(order?.costTotal || 0);
  if (directCost > 0) {
    return roundReportAmount(directCost);
  }

  const itemLevelCost = roundReportAmount(
    (order?.items || []).reduce((sum, item) => {
      const costSubtotal = Number(item?.costSubtotal || 0);
      if (costSubtotal > 0) {
        return sum + costSubtotal;
      }

      const costPerUnit = Number(item?.costPerUnit || 0);
      const quantity = Number(item?.quantity || 0);
      return sum + costPerUnit * quantity;
    }, 0)
  );

  return itemLevelCost > 0 ? itemLevelCost : 0;
};

const calculateFallbackOrderCostFromProducts = (order, productMap) =>
  roundReportAmount(
    (order?.items || []).reduce((sum, item) => {
      const product = productMap.get(String(item?.product || ""));
      if (!product) {
        return sum;
      }

      const selectedAlternativeMap = buildSelectedAlternativeMapFromOrderItem(item);
      const costPerUnit = Number(calculateOrderItemCost(product, productMap, selectedAlternativeMap).toFixed(2));
      return sum + costPerUnit * Number(item?.quantity || 0);
    }, 0)
  );

const getOrderFinancialMetrics = (order, partnerSettingsMap, productMap = new Map()) => {
  const grossSales = Number(order?.subtotal || 0);
  const partnerKey = getPartnerKeyForOrder(order);
  const orderReportDay = toReportDay(order?.createdAt || new Date());
  const shouldUseLegacyPartnerPromo =
    Boolean(partnerKey) &&
    orderReportDay >= LEGACY_PARTNER_PROMO_START_DAY &&
    orderReportDay <= LEGACY_PARTNER_PROMO_END_DAY;

  let partnerPromoDiscount = 0;
  let counterPromoDiscount = 0;
  let salesAfterPromo = Number(order?.total || 0);

  if (partnerKey) {
    if (shouldUseLegacyPartnerPromo) {
      const legacyMetrics = getLegacyPartnerPromoMetrics(order);
      partnerPromoDiscount = legacyMetrics.partnerPromoDiscount;
      salesAfterPromo = legacyMetrics.salesAfterPromo;
    } else {
      partnerPromoDiscount = getPartnerPromoDiscountForOrder(order);
      salesAfterPromo = Number(order?.total || 0);
    }
  } else {
    counterPromoDiscount = getCounterPromoDiscountForOrder(order);
    salesAfterPromo = Number(order?.total || 0);
  }

  const totalPromoDiscount = roundReportAmount(counterPromoDiscount + partnerPromoDiscount);
  const commissionAmount = partnerKey
    ? roundReportAmount((salesAfterPromo * getPartnerCommissionRateForOrder(order, partnerSettingsMap, partnerKey)) / 100)
    : 0;
  const netSales = roundReportAmount(salesAfterPromo - commissionAmount);
  const advertisingRoiCost = partnerKey
    ? roundReportAmount((salesAfterPromo * getPartnerAdvertisementRoiRateForOrder(order, partnerSettingsMap, partnerKey)) / 100)
    : 0;
  const netSalesAfterAdvertising = roundReportAmount(netSales - advertisingRoiCost);
  const storedCost = getStoredOrderCost(order);
  const costOfGoodsSold = storedCost > 0 ? storedCost : calculateFallbackOrderCostFromProducts(order, productMap);
  const tentativeProfit = roundReportAmount(netSalesAfterAdvertising - costOfGoodsSold);
  const profitMarginPercent =
    netSalesAfterAdvertising > 0 ? roundReportAmount((tentativeProfit / netSalesAfterAdvertising) * 100) : 0;

  return {
    partnerKey,
    grossSales,
    counterPromoDiscount,
    partnerPromoDiscount,
    totalPromoDiscount,
    salesAfterPromo,
    salesAfterPartnerPromo: salesAfterPromo,
    commissionAmount,
    netSales,
    advertisingRoiCost,
    netSalesAfterAdvertising,
    costOfGoodsSold,
    tentativeProfit,
    profitMarginPercent
  };
};

const getInitialPaymentTransaction = (order) => {
  const firstEdit = Array.isArray(order.editHistory) ? order.editHistory[0] : null;

  if (order?.source === "customer" && firstEdit?.oldPaymentMethod == null && firstEdit?.newPaymentMethod) {
    return {
      amount: Number(firstEdit?.oldTotal ?? order.originalTotal ?? order.total ?? 0),
      method: hasCollectedPayment(firstEdit.newPaymentMethod) ? firstEdit.newPaymentMethod : null
    };
  }

  return {
    amount: Number(firstEdit?.oldTotal ?? order.originalTotal ?? order.total ?? 0),
    method: hasCollectedPayment(firstEdit?.oldPaymentMethod) ? firstEdit.oldPaymentMethod : hasCollectedPayment(order.paymentMethod) ? order.paymentMethod : null
  };
};

const getOrderPaymentFlows = (order) => {
  const flows = buildEmptyPaymentFlows();

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
  const [allOrders, partnerSettings] = await Promise.all([getOrders(), getAllPartnerSettings()]);
  const partnerSettingsMap = new Map(partnerSettings.map((setting) => [setting.partnerKey, setting]));
  const todayRange = buildTimezoneTodayRange();
  const monthRange = buildTimezoneMonthRange();
  const completedOrders = allOrders.filter((order) => COMPLETED_STATUSES.includes(order.status));

  const dailyOrders = todayRange
    ? completedOrders.filter((order) => {
        const createdAt = new Date(order.createdAt);
        return createdAt >= todayRange.start && createdAt <= todayRange.end;
      })
    : [];
  const monthlyOrders = monthRange
    ? completedOrders.filter((order) => {
        const createdAt = new Date(order.createdAt);
        return createdAt >= monthRange.start && createdAt <= monthRange.end;
      })
    : [];

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
      totalSales: dailyOrders.reduce((sum, order) => sum + getOrderGrossSales(order), 0),
      netSales: dailyOrders.reduce(
        (sum, order) => sum + getOrderFinancialMetrics(order, partnerSettingsMap).netSales,
        0
      ),
      netSalesAfterAdvertising: dailyOrders.reduce(
        (sum, order) => sum + getOrderFinancialMetrics(order, partnerSettingsMap).netSalesAfterAdvertising,
        0
      ),
      orderCount: dailyOrders.length
    },
    monthly: {
      totalSales: monthlyOrders.reduce((sum, order) => sum + getOrderGrossSales(order), 0),
      netSales: monthlyOrders.reduce(
        (sum, order) => sum + getOrderFinancialMetrics(order, partnerSettingsMap).netSales,
        0
      ),
      netSalesAfterAdvertising: monthlyOrders.reduce(
        (sum, order) => sum + getOrderFinancialMetrics(order, partnerSettingsMap).netSalesAfterAdvertising,
        0
      ),
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
  const [orders, products, partnerSettings] = await Promise.all([getOrders(), getAllProducts(), getAllPartnerSettings()]);
  const completedOrders = orders.filter((order) => COMPLETED_STATUSES.includes(order.status));
  const productMap = new Map(products.map((product) => [String(product.id || product._id), product]));
  const partnerSettingsMap = new Map(partnerSettings.map((setting) => [setting.partnerKey, setting]));
  const lowStockCount = products.reduce((count, product) => {
    const inventory = calculateProductInventory(product, productMap);
    return count + (inventory.lowStock ? 1 : 0);
  }, 0);

  const financialSummary = completedOrders.reduce(
    (acc, order) => {
      const metrics = getOrderFinancialMetrics(order, partnerSettingsMap, productMap);
      acc.netSales += metrics.netSales;
      acc.advertisingRoiCost += metrics.advertisingRoiCost;
      acc.netSalesAfterAdvertising += metrics.netSalesAfterAdvertising;
      return acc;
    },
    { netSales: 0, advertisingRoiCost: 0, netSalesAfterAdvertising: 0 }
  );

  res.json({
    totalRevenue: completedOrders.reduce((sum, order) => sum + getOrderGrossSales(order), 0),
    totalNetSales: roundReportAmount(financialSummary.netSales),
    totalAdvertisingRoiCost: roundReportAmount(financialSummary.advertisingRoiCost),
    totalNetSalesAfterAdvertising: roundReportAmount(financialSummary.netSalesAfterAdvertising),
    totalOrders: completedOrders.length,
    lowStockCount,
    productCount: products.length
  });
};

const getSalesRangeReport = async (req, res) => {
  const { from, to } = req.query;
  const range = buildTimezoneDateRange(from, to);
  if (!range) {
    return res.status(400).json({ message: "Invalid date range" });
  }
  const { start, end } = range;
  const [allOrders, partnerSettings, products] = await Promise.all([getOrders(), getAllPartnerSettings(), getAllProducts()]);
  const partnerSettingsMap = new Map(partnerSettings.map((setting) => [setting.partnerKey, setting]));
  const productMap = new Map(products.map((product) => [String(product.id || product._id), product]));
  const orders = allOrders.filter((order) => new Date(order.createdAt) >= start && new Date(order.createdAt) <= end);
  const summary = {
    grossSales: 0,
    partnerPromoDiscount: 0,
    salesAfterPartnerPromo: 0,
    commissionAmount: 0,
    advertisingRoiCost: 0,
    netSalesAfterAdvertising: 0,
    netSales: 0,
    numberOfOrder: 0,
    paymentBy: {
      cash: 0,
      card: 0,
      qr: 0,
      deliveryPartners: 0,
      partners: {
        grab: 0,
        foodpanda: 0,
        e_gates: 0,
        wownow: 0
      }
    }
  };

  const grouped = new Map();
  orders.forEach((order) => {
    const date = toReportDay(order.createdAt);
    const existing = grouped.get(date) || {
      totalSaleAmount: 0,
      grossSales: 0,
      partnerPromoDiscount: 0,
      salesAfterPartnerPromo: 0,
      commissionAmount: 0,
      advertisingRoiCost: 0,
      netSalesAfterAdvertising: 0,
      numberOfOrder: 0,
      cash: 0,
      card: 0,
      qr: 0,
      deliveryPartners: 0,
      partners: {
        grab: 0,
        foodpanda: 0,
        e_gates: 0,
        wownow: 0
      }
    };

    if (COMPLETED_STATUSES.includes(order.status)) {
      const metrics = getOrderFinancialMetrics(order, partnerSettingsMap, productMap);

      existing.grossSales += metrics.grossSales;
      existing.partnerPromoDiscount += metrics.partnerPromoDiscount;
      existing.salesAfterPartnerPromo += metrics.salesAfterPromo;
      existing.commissionAmount += metrics.commissionAmount;
      existing.advertisingRoiCost += metrics.advertisingRoiCost;
      existing.netSalesAfterAdvertising += metrics.netSalesAfterAdvertising;
      existing.totalSaleAmount += metrics.netSales;
      existing.numberOfOrder += 1;

      summary.grossSales += metrics.grossSales;
      summary.partnerPromoDiscount += metrics.partnerPromoDiscount;
      summary.salesAfterPartnerPromo += metrics.salesAfterPromo;
      summary.commissionAmount += metrics.commissionAmount;
      summary.advertisingRoiCost += metrics.advertisingRoiCost;
      summary.netSalesAfterAdvertising += metrics.netSalesAfterAdvertising;
      summary.netSales += metrics.netSales;
      summary.numberOfOrder += 1;

      if (metrics.partnerKey) {
        existing.deliveryPartners += metrics.netSales;
        existing.partners[metrics.partnerKey] += metrics.netSales;
        summary.paymentBy.deliveryPartners += metrics.netSales;
        summary.paymentBy.partners[metrics.partnerKey] += metrics.netSales;
      } else if (order.paymentMethod === "cash") {
        existing.cash += metrics.salesAfterPromo;
        summary.paymentBy.cash += metrics.salesAfterPromo;
      } else if (order.paymentMethod === "card") {
        existing.card += metrics.salesAfterPromo;
        summary.paymentBy.card += metrics.salesAfterPromo;
      } else if (order.paymentMethod === "qr") {
        existing.qr += metrics.salesAfterPromo;
        summary.paymentBy.qr += metrics.salesAfterPromo;
      }
    }

    grouped.set(date, existing);
  });

  const rows = [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, row], index) => ({
      sl: index + 1,
      date,
      totalSaleAmount: roundReportAmount(row.totalSaleAmount),
      grossSales: roundReportAmount(row.grossSales),
      partnerPromoDiscount: roundReportAmount(row.partnerPromoDiscount),
      salesAfterPartnerPromo: roundReportAmount(row.salesAfterPartnerPromo),
      commissionAmount: roundReportAmount(row.commissionAmount),
      numberOfOrder: row.numberOfOrder,
      paymentBy: {
        cash: roundReportAmount(row.cash),
        card: roundReportAmount(row.card),
        qr: roundReportAmount(row.qr),
        deliveryPartners: roundReportAmount(row.deliveryPartners),
        partners: {
          grab: roundReportAmount(row.partners.grab),
          foodpanda: roundReportAmount(row.partners.foodpanda),
          e_gates: roundReportAmount(row.partners.e_gates),
          wownow: roundReportAmount(row.partners.wownow)
        }
      }
    }));

  res.json({
    from: start,
    to: end,
    rows,
    summary: {
      grossSales: roundReportAmount(summary.grossSales),
      partnerPromoDiscount: roundReportAmount(summary.partnerPromoDiscount),
      salesAfterPartnerPromo: roundReportAmount(summary.salesAfterPartnerPromo),
      commissionAmount: roundReportAmount(summary.commissionAmount),
      advertisingRoiCost: roundReportAmount(summary.advertisingRoiCost),
      netSalesAfterAdvertising: roundReportAmount(summary.netSalesAfterAdvertising),
      netSales: roundReportAmount(summary.netSales),
      numberOfOrder: summary.numberOfOrder,
      paymentBy: {
        cash: roundReportAmount(summary.paymentBy.cash),
        card: roundReportAmount(summary.paymentBy.card),
        qr: roundReportAmount(summary.paymentBy.qr),
        deliveryPartners: roundReportAmount(summary.paymentBy.deliveryPartners),
        partners: {
          grab: roundReportAmount(summary.paymentBy.partners.grab),
          foodpanda: roundReportAmount(summary.paymentBy.partners.foodpanda),
          e_gates: roundReportAmount(summary.paymentBy.partners.e_gates),
          wownow: roundReportAmount(summary.paymentBy.partners.wownow)
        }
      }
    }
  });
};

const getDeliveryPartnerSalesReport = async (req, res) => {
  const { from, to, partner } = req.query;
  const range = buildTimezoneDateRange(from, to);
  if (!range) {
    return res.status(400).json({ message: "Invalid date range" });
  }
  const { start, end } = range;
  const selectedPartner = PARTNER_PAYMENT_METHODS.includes(partner) ? partner : null;
  const [orders, partnerSettings] = await Promise.all([getOrders(), getAllPartnerSettings()]);
  const partnerSettingsMap = new Map(partnerSettings.map((setting) => [setting.partnerKey, setting]));
  const ordersInRange = orders.filter((order) => new Date(order.createdAt) >= start && new Date(order.createdAt) <= end);
  const grouped = new Map(
    (selectedPartner ? [selectedPartner] : PARTNER_PAYMENT_METHODS).map((partnerKey) => [
      partnerKey,
        {
          partner: partnerKey,
          partnerLabel: PARTNER_LABELS[partnerKey] || partnerKey,
          orderCount: 0,
          completedOrders: 0,
          grossSales: 0,
          salesAfterPromo: 0,
          refunds: 0,
          netSales: 0,
          commissionAmount: 0,
          advertisingRoiCost: 0,
          netSalesAfterAdvertising: 0,
          settlementAmount: 0
        }
    ])
  );

    ordersInRange.forEach((order) => {
      const partnerKey = getPartnerKeyForOrder(order);
      if (!partnerKey || (selectedPartner && partnerKey !== selectedPartner)) {
        return;
      }

      const existing = grouped.get(partnerKey);
      if (!existing) {
        return;
      }

      if (COMPLETED_STATUSES.includes(order.status)) {
        const grossSales = Number(order.subtotal || 0);
        const salesAfterPromo = Number(order.total || 0);
        const commissionAmount = roundReportAmount(
          (salesAfterPromo * getPartnerCommissionRateForOrder(order, partnerSettingsMap, partnerKey)) / 100
        );
        const advertisingRoiCost = roundReportAmount(
          (salesAfterPromo * getPartnerAdvertisementRoiRateForOrder(order, partnerSettingsMap, partnerKey)) / 100
        );
        const netSales = roundReportAmount(salesAfterPromo - commissionAmount);
        const netSalesAfterAdvertising = roundReportAmount(netSales - advertisingRoiCost);

        existing.orderCount += 1;
        existing.completedOrders += 1;
        existing.grossSales += grossSales;
        existing.salesAfterPromo += salesAfterPromo;
        existing.commissionAmount += commissionAmount;
        existing.advertisingRoiCost += advertisingRoiCost;
        existing.netSales += netSales;
        existing.netSalesAfterAdvertising += netSalesAfterAdvertising;
        existing.settlementAmount += netSales;
      }

      const flows = getOrderPaymentFlows(order);
      existing.refunds += Number(flows[`${partnerKey}Out`] || 0);
    });

  const rows = [...grouped.values()].map((row, index) => ({
    sl: index + 1,
    partner: row.partner,
    partnerLabel: row.partnerLabel,
    orderCount: row.orderCount,
    completedOrders: row.completedOrders,
    grossSales: roundReportAmount(row.grossSales),
    salesAfterPromo: roundReportAmount(row.salesAfterPromo),
    refunds: roundReportAmount(row.refunds),
    netSales: roundReportAmount(row.netSales),
    commissionAmount: roundReportAmount(row.commissionAmount),
    advertisingRoiCost: roundReportAmount(row.advertisingRoiCost),
    netSalesAfterAdvertising: roundReportAmount(row.netSalesAfterAdvertising),
    settlementAmount: roundReportAmount(row.settlementAmount),
    averageOrderValue: row.orderCount > 0 ? roundReportAmount(row.salesAfterPromo / row.orderCount) : 0
  }));

  const summary = rows.reduce(
    (acc, row) => {
      acc.totalOrders += row.orderCount;
      acc.totalCompletedOrders += row.completedOrders;
      acc.totalGrossSales += row.grossSales;
      acc.totalSalesAfterPromo += row.salesAfterPromo;
      acc.totalRefunds += row.refunds;
      acc.totalNetSales += row.netSales;
      acc.totalCommissionAmount += row.commissionAmount;
      acc.totalAdvertisingRoiCost += row.advertisingRoiCost;
      acc.totalNetSalesAfterAdvertising += row.netSalesAfterAdvertising;
      acc.totalSettlementAmount += row.settlementAmount;
      return acc;
    },
      {
        totalOrders: 0,
        totalCompletedOrders: 0,
        totalGrossSales: 0,
        totalSalesAfterPromo: 0,
        totalRefunds: 0,
        totalNetSales: 0,
        totalCommissionAmount: 0,
        totalAdvertisingRoiCost: 0,
        totalNetSalesAfterAdvertising: 0,
        totalSettlementAmount: 0
      }
    );

  const topPartner = [...rows].sort((left, right) => right.settlementAmount - left.settlementAmount || right.orderCount - left.orderCount)[0] || null;

  res.json({
    from: start,
    to: end,
    summary: {
      ...summary,
      topPartner: topPartner?.partnerLabel || null
    },
    rows
  });
};

const getTentativeProfitReport = async (req, res) => {
  const { from, to, channel, partner } = req.query;
  const range = buildTimezoneDateRange(from, to);
  if (!range) {
    return res.status(400).json({ message: "Invalid date range" });
  }

  const channelFilter = ["all", "counter", "partners"].includes(channel) ? channel : "all";
  const selectedPartner = PARTNER_PAYMENT_METHODS.includes(partner) ? partner : null;
  const { start, end } = range;
  const [allOrders, partnerSettings, products] = await Promise.all([getOrders(), getAllPartnerSettings(), getAllProducts()]);
  const partnerSettingsMap = new Map(partnerSettings.map((setting) => [setting.partnerKey, setting]));
  const productMap = new Map(products.map((product) => [String(product.id || product._id), product]));

  const filteredOrders = allOrders.filter((order) => {
    const createdAt = new Date(order.createdAt);
    if (createdAt < start || createdAt > end || !COMPLETED_STATUSES.includes(order.status)) {
      return false;
    }

    const partnerKey = getPartnerKeyForOrder(order);

    if (channelFilter === "counter" && partnerKey) {
      return false;
    }

    if (channelFilter === "partners" && !partnerKey) {
      return false;
    }

    if (selectedPartner && partnerKey !== selectedPartner) {
      return false;
    }

    return true;
  });

  const dailyGrouped = new Map();
  const partnerGrouped = new Map();
  const summary = {
    totalOrders: 0,
    totalItems: 0,
    grossSales: 0,
    counterPromoDiscount: 0,
    partnerPromoDiscount: 0,
    totalPromoDiscount: 0,
    salesAfterPartnerPromo: 0,
    commissionAmount: 0,
    netSales: 0,
    advertisingRoiCost: 0,
    netSalesAfterAdvertising: 0,
    costOfGoodsSold: 0,
    tentativeProfit: 0,
    counterGrossSales: 0,
    counterNetSales: 0,
    counterAdvertisingRoiCost: 0,
    counterNetSalesAfterAdvertising: 0,
    counterCostOfGoodsSold: 0,
    counterTentativeProfit: 0,
    partnerGrossSales: 0,
    partnerPromoSalesDiscount: 0,
    partnerSalesAfterPromo: 0,
    partnerCommissionAmount: 0,
    partnerAdvertisingRoiCost: 0,
    partnerNetSales: 0,
    partnerNetSalesAfterAdvertising: 0,
    partnerCostOfGoodsSold: 0,
    partnerTentativeProfit: 0
  };

  filteredOrders.forEach((order) => {
    const metrics = getOrderFinancialMetrics(order, partnerSettingsMap, productMap);
    const reportDay = toReportDay(order.createdAt);
    const isPartnerOrder = Boolean(metrics.partnerKey);
    const itemCount = (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    const dailyRow = dailyGrouped.get(reportDay) || {
      totalOrders: 0,
      totalItems: 0,
      grossSales: 0,
      counterPromoDiscount: 0,
      partnerPromoDiscount: 0,
      totalPromoDiscount: 0,
      salesAfterPartnerPromo: 0,
      commissionAmount: 0,
      netSales: 0,
      advertisingRoiCost: 0,
      netSalesAfterAdvertising: 0,
      costOfGoodsSold: 0,
      tentativeProfit: 0,
      counterGrossSales: 0,
      counterNetSales: 0,
      counterAdvertisingRoiCost: 0,
      counterNetSalesAfterAdvertising: 0,
      partnerGrossSales: 0,
      partnerNetSales: 0,
      partnerAdvertisingRoiCost: 0,
      partnerNetSalesAfterAdvertising: 0
    };

    dailyRow.totalOrders += 1;
    dailyRow.totalItems += itemCount;
    dailyRow.grossSales += metrics.grossSales;
    dailyRow.counterPromoDiscount += metrics.counterPromoDiscount;
    dailyRow.partnerPromoDiscount += metrics.partnerPromoDiscount;
    dailyRow.totalPromoDiscount += metrics.totalPromoDiscount;
    dailyRow.salesAfterPartnerPromo += metrics.salesAfterPromo;
    dailyRow.commissionAmount += metrics.commissionAmount;
    dailyRow.netSales += metrics.netSales;
    dailyRow.advertisingRoiCost += metrics.advertisingRoiCost;
    dailyRow.netSalesAfterAdvertising += metrics.netSalesAfterAdvertising;
    dailyRow.costOfGoodsSold += metrics.costOfGoodsSold;
    dailyRow.tentativeProfit += metrics.tentativeProfit;
    if (isPartnerOrder) {
      dailyRow.partnerGrossSales += metrics.grossSales;
      dailyRow.partnerNetSales += metrics.netSales;
      dailyRow.partnerAdvertisingRoiCost += metrics.advertisingRoiCost;
      dailyRow.partnerNetSalesAfterAdvertising += metrics.netSalesAfterAdvertising;
    } else {
      dailyRow.counterGrossSales += metrics.grossSales;
      dailyRow.counterNetSales += metrics.netSales;
      dailyRow.counterAdvertisingRoiCost += metrics.advertisingRoiCost;
      dailyRow.counterNetSalesAfterAdvertising += metrics.netSalesAfterAdvertising;
    }
    dailyGrouped.set(reportDay, dailyRow);

    summary.totalOrders += 1;
    summary.totalItems += itemCount;
    summary.grossSales += metrics.grossSales;
    summary.counterPromoDiscount += metrics.counterPromoDiscount;
    summary.partnerPromoDiscount += metrics.partnerPromoDiscount;
    summary.totalPromoDiscount += metrics.totalPromoDiscount;
    summary.salesAfterPartnerPromo += metrics.salesAfterPromo;
    summary.commissionAmount += metrics.commissionAmount;
    summary.netSales += metrics.netSales;
    summary.advertisingRoiCost += metrics.advertisingRoiCost;
    summary.netSalesAfterAdvertising += metrics.netSalesAfterAdvertising;
    summary.costOfGoodsSold += metrics.costOfGoodsSold;
    summary.tentativeProfit += metrics.tentativeProfit;
    if (isPartnerOrder) {
      summary.partnerGrossSales += metrics.grossSales;
      summary.partnerPromoSalesDiscount += metrics.partnerPromoDiscount;
      summary.partnerSalesAfterPromo += metrics.salesAfterPromo;
      summary.partnerCommissionAmount += metrics.commissionAmount;
      summary.partnerAdvertisingRoiCost += metrics.advertisingRoiCost;
      summary.partnerNetSales += metrics.netSales;
      summary.partnerNetSalesAfterAdvertising += metrics.netSalesAfterAdvertising;
      summary.partnerCostOfGoodsSold += metrics.costOfGoodsSold;
      summary.partnerTentativeProfit += metrics.tentativeProfit;
    } else {
      summary.counterGrossSales += metrics.grossSales;
      summary.counterNetSales += metrics.netSales;
      summary.counterAdvertisingRoiCost += metrics.advertisingRoiCost;
      summary.counterNetSalesAfterAdvertising += metrics.netSalesAfterAdvertising;
      summary.counterCostOfGoodsSold += metrics.costOfGoodsSold;
      summary.counterTentativeProfit += metrics.tentativeProfit;
    }

    if (metrics.partnerKey) {
      const existingPartner = partnerGrouped.get(metrics.partnerKey) || {
        partner: metrics.partnerKey,
        partnerLabel: PARTNER_LABELS[metrics.partnerKey] || metrics.partnerKey,
        orderCount: 0,
        grossSales: 0,
        partnerPromoDiscount: 0,
        salesAfterPartnerPromo: 0,
        commissionAmount: 0,
        netSales: 0,
        advertisingRoiCost: 0,
        netSalesAfterAdvertising: 0,
        costOfGoodsSold: 0,
        tentativeProfit: 0
      };

      existingPartner.orderCount += 1;
      existingPartner.grossSales += metrics.grossSales;
      existingPartner.partnerPromoDiscount += metrics.partnerPromoDiscount;
      existingPartner.salesAfterPartnerPromo += metrics.salesAfterPromo;
      existingPartner.commissionAmount += metrics.commissionAmount;
      existingPartner.netSales += metrics.netSales;
      existingPartner.advertisingRoiCost += metrics.advertisingRoiCost;
      existingPartner.netSalesAfterAdvertising += metrics.netSalesAfterAdvertising;
      existingPartner.costOfGoodsSold += metrics.costOfGoodsSold;
      existingPartner.tentativeProfit += metrics.tentativeProfit;
      partnerGrouped.set(metrics.partnerKey, existingPartner);
    }
  });

  const rows = [...dailyGrouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, row], index) => ({
      sl: index + 1,
      date,
      totalOrders: row.totalOrders,
      totalItems: row.totalItems,
      grossSales: roundReportAmount(row.grossSales),
      counterPromoDiscount: roundReportAmount(row.counterPromoDiscount),
      partnerPromoDiscount: roundReportAmount(row.partnerPromoDiscount),
      totalPromoDiscount: roundReportAmount(row.totalPromoDiscount),
      salesAfterPartnerPromo: roundReportAmount(row.salesAfterPartnerPromo),
      commissionAmount: roundReportAmount(row.commissionAmount),
      netSales: roundReportAmount(row.netSales),
      advertisingRoiCost: roundReportAmount(row.advertisingRoiCost),
      netSalesAfterAdvertising: roundReportAmount(row.netSalesAfterAdvertising),
      costOfGoodsSold: roundReportAmount(row.costOfGoodsSold),
      tentativeProfit: roundReportAmount(row.tentativeProfit),
      profitMarginPercent:
        row.netSalesAfterAdvertising > 0
          ? roundReportAmount((row.tentativeProfit / row.netSalesAfterAdvertising) * 100)
          : 0,
      counterGrossSales: roundReportAmount(row.counterGrossSales),
      counterNetSales: roundReportAmount(row.counterNetSales),
      counterAdvertisingRoiCost: roundReportAmount(row.counterAdvertisingRoiCost),
      counterNetSalesAfterAdvertising: roundReportAmount(row.counterNetSalesAfterAdvertising),
      partnerGrossSales: roundReportAmount(row.partnerGrossSales),
      partnerNetSales: roundReportAmount(row.partnerNetSales),
      partnerAdvertisingRoiCost: roundReportAmount(row.partnerAdvertisingRoiCost),
      partnerNetSalesAfterAdvertising: roundReportAmount(row.partnerNetSalesAfterAdvertising)
    }));

  const partnerRows = [...partnerGrouped.values()]
    .sort(
      (left, right) =>
        PARTNER_DISPLAY_ORDER.indexOf(left.partner) - PARTNER_DISPLAY_ORDER.indexOf(right.partner) ||
        left.partnerLabel.localeCompare(right.partnerLabel)
    )
    .map((row, index) => ({
      sl: index + 1,
      partner: row.partner,
      partnerLabel: row.partnerLabel,
      orderCount: row.orderCount,
      grossSales: roundReportAmount(row.grossSales),
      partnerPromoDiscount: roundReportAmount(row.partnerPromoDiscount),
      salesAfterPartnerPromo: roundReportAmount(row.salesAfterPartnerPromo),
      commissionAmount: roundReportAmount(row.commissionAmount),
      netSales: roundReportAmount(row.netSales),
      advertisingRoiCost: roundReportAmount(row.advertisingRoiCost),
      netSalesAfterAdvertising: roundReportAmount(row.netSalesAfterAdvertising),
      costOfGoodsSold: roundReportAmount(row.costOfGoodsSold),
      tentativeProfit: roundReportAmount(row.tentativeProfit),
      profitMarginPercent:
        row.netSalesAfterAdvertising > 0
          ? roundReportAmount((row.tentativeProfit / row.netSalesAfterAdvertising) * 100)
          : 0
    }));

  res.json({
    from: start,
    to: end,
    channel: channelFilter,
    partner: selectedPartner,
    summary: {
      ...summary,
      grossSales: roundReportAmount(summary.grossSales),
      counterPromoDiscount: roundReportAmount(summary.counterPromoDiscount),
      partnerPromoDiscount: roundReportAmount(summary.partnerPromoDiscount),
      totalPromoDiscount: roundReportAmount(summary.totalPromoDiscount),
      salesAfterPartnerPromo: roundReportAmount(summary.salesAfterPartnerPromo),
      commissionAmount: roundReportAmount(summary.commissionAmount),
      netSales: roundReportAmount(summary.netSales),
      advertisingRoiCost: roundReportAmount(summary.advertisingRoiCost),
      netSalesAfterAdvertising: roundReportAmount(summary.netSalesAfterAdvertising),
      costOfGoodsSold: roundReportAmount(summary.costOfGoodsSold),
      tentativeProfit: roundReportAmount(summary.tentativeProfit),
      counterGrossSales: roundReportAmount(summary.counterGrossSales),
      counterNetSales: roundReportAmount(summary.counterNetSales),
      counterAdvertisingRoiCost: roundReportAmount(summary.counterAdvertisingRoiCost),
      counterNetSalesAfterAdvertising: roundReportAmount(summary.counterNetSalesAfterAdvertising),
      counterCostOfGoodsSold: roundReportAmount(summary.counterCostOfGoodsSold),
      counterTentativeProfit: roundReportAmount(summary.counterTentativeProfit),
      partnerGrossSales: roundReportAmount(summary.partnerGrossSales),
      partnerPromoSalesDiscount: roundReportAmount(summary.partnerPromoSalesDiscount),
      partnerSalesAfterPromo: roundReportAmount(summary.partnerSalesAfterPromo),
      partnerCommissionAmount: roundReportAmount(summary.partnerCommissionAmount),
      partnerAdvertisingRoiCost: roundReportAmount(summary.partnerAdvertisingRoiCost),
      partnerNetSales: roundReportAmount(summary.partnerNetSales),
      partnerNetSalesAfterAdvertising: roundReportAmount(summary.partnerNetSalesAfterAdvertising),
      partnerCostOfGoodsSold: roundReportAmount(summary.partnerCostOfGoodsSold),
      partnerTentativeProfit: roundReportAmount(summary.partnerTentativeProfit),
      profitMarginPercent:
        summary.netSalesAfterAdvertising > 0
          ? roundReportAmount((summary.tentativeProfit / summary.netSalesAfterAdvertising) * 100)
          : 0,
      averageOrderValue: summary.totalOrders > 0 ? roundReportAmount(summary.netSales / summary.totalOrders) : 0
    },
    rows,
    partnerRows
  });
};

const getProductSalesReport = async (req, res) => {
  const { from, to } = req.query;
  const range = buildTimezoneDateRange(from, to);
  if (!range) {
    return res.status(400).json({ message: "Invalid date range" });
  }
  const { start, end } = range;
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
  const range = buildTimezoneDateRange(from, to);
  if (!range) {
    return res.status(400).json({ message: "Invalid date range" });
  }
  const { start, end } = range;
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
    } else if (order.paymentMethod === "cash") {
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

  const dayRange = buildTimezoneDayRange(date);
  if (!dayRange) {
    return res.status(400).json({ message: "Invalid date" });
  }

  const { start, end } = dayRange;
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
  getDeliveryPartnerSalesReport,
  getTentativeProfitReport,
  getProductSalesReport,
  getCashPositionReport,
  getOrdersByDate
};
