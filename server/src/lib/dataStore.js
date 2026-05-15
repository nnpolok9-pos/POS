const {
  query,
  queryTx,
  mapUserRow,
  mapProductRow,
  mapPromoRow,
  mapPartnerSettingRow,
  mapOrderRow,
  mapInventoryMovementRow,
  mapShopSettingsRow,
  stringifyJson,
  parseJson,
  createId
} = require("../config/db");
const { buildDefaultPartnerSettings, createDefaultPartnerSetting, normalizePartnerSetting } = require("../utils/partnerSettings");


const userColumns = `
  id, name, email, password_hash, avatar, role, is_active, created_at, updated_at
`;

const productColumns = `
  id, name, khmer_name, price, regular_price, promotional_price, tentative_cost, category, khmer_category,
  description, khmer_description, image, stock, stock_unit, seasoning_per_order_consumption,
  expiry_date, product_type, combo_items, for_sale, sku, foodpanda_sku, grab_sku, e_gates_sku, wownow_sku,
  is_active, low_stock_threshold,
  created_at, updated_at
`;

const promoColumns = `
  id, code, title, description, discount_type, discount_value, min_order_amount,
  max_discount_amount, starts_at, expires_at, max_total_uses, max_uses_per_day,
  applies_to, is_active, notes, created_by, updated_by, created_at, updated_at
`;

const orderColumns = `
  id, order_id, items, sauce_items, total, subtotal, cost_total, payment_method, booking_details, status,
  queue_number, source, promo_code_id, promo_code, promo_discount, promo_snapshot,
  original_subtotal, original_total, staff_id, voided_at, voided_by, edited_at, edited_by,
  edit_history, served_at, served_by, created_at, updated_at
`;

const movementColumns = `
  id, product_id, product_name, sku, category, stock_unit, movement_type, quantity,
  previous_stock, new_stock, performed_by, reason, created_at
`;

const settingsColumns = `
  id, settings_key, shop_name, address, logo, created_at, updated_at
`;

const partnerColumns = `
  partner_key, partner_name, commission_rate, advertisement_roi_rate, promo_config, is_active, created_at, updated_at
`;

const partnerWebhookLogColumns = `
  id, partner_key, event_type, external_order_id, order_status, headers_json, payload_json, created_at
`;

const purchaseEntryColumns = `
  id, supplier_id, supplier_name, payment_method, handled_by_user_id, handled_by_user_name,
  total_amount, created_by, updated_by, created_at, updated_at
`;

const purchaseItemColumns = `
  id, purchase_id, product_id, product_name, sku, quantity, unit_name, total_amount, unit_price, remarks, created_at
`;

const procurementVendorColumns = `
  id, name, normalized_name, created_by, created_at, updated_at
`;

const procurementPaymentColumns = `
  id, payment_type, vendor_id, vendor_name, user_id, user_name, amount, payment_method, remarks, created_by, created_at
`;

const procurementCostNameColumns = `
  id, name, normalized_name, created_by, created_at, updated_at
`;

const procurementCostEntryColumns = `
  id, cost_name_id, cost_name, payment_method, handled_by_user_id, handled_by_user_name,
  amount, remarks, created_by, updated_by, created_at, updated_at
`;

const cashHandoverColumns = `
  id, user_id, user_name, amount, remarks, created_by, created_at
`;

const boolToInt = (value) => (value ? 1 : 0);

const mapPurchaseItemRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    _id: row.id,
    purchaseId: row.purchase_id,
    productId: row.product_id,
    productName: row.product_name,
    sku: row.sku || "",
    quantity: Number(row.quantity || 0),
    unitName: row.unit_name || "Piece",
    totalAmount: Number(row.total_amount || 0),
    unitPrice: Number(row.unit_price || 0),
    remarks: row.remarks || "",
    createdAt: row.created_at
  };
};

const mapPurchaseEntryRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    _id: row.id,
    supplierId: row.supplier_id || null,
    supplierName: row.supplier_name,
    paymentMethod: row.payment_method,
    handledByUserId: row.handled_by_user_id || null,
    handledByUserName: row.handled_by_user_name || "",
    totalAmount: Number(row.total_amount || 0),
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: []
  };
};

const mapProcurementVendorRow = (row) =>
  row
    ? {
        id: row.id,
        _id: row.id,
        name: row.name,
        normalizedName: row.normalized_name,
        createdBy: row.created_by || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    : null;

const mapProcurementPaymentRow = (row) =>
  row
    ? {
        id: row.id,
        _id: row.id,
        paymentType: row.payment_type,
        vendorId: row.vendor_id || null,
        vendorName: row.vendor_name || "",
        userId: row.user_id || null,
        userName: row.user_name || "",
        amount: Number(row.amount || 0),
        paymentMethod: row.payment_method,
        remarks: row.remarks || "",
        createdBy: row.created_by || null,
        createdAt: row.created_at
    }
    : null;

const mapProcurementCostNameRow = (row) =>
  row
    ? {
        id: row.id,
        _id: row.id,
        name: row.name,
        normalizedName: row.normalized_name,
        createdBy: row.created_by || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    : null;

const mapProcurementCostEntryRow = (row) =>
  row
    ? {
        id: row.id,
        _id: row.id,
        costNameId: row.cost_name_id || null,
        costName: row.cost_name || "",
        paymentMethod: row.payment_method,
        handledByUserId: row.handled_by_user_id || null,
        handledByUserName: row.handled_by_user_name || "",
        amount: Number(row.amount || 0),
        remarks: row.remarks || "",
        createdBy: row.created_by || null,
        updatedBy: row.updated_by || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    : null;

const mapCashHandoverRow = (row) =>
  row
    ? {
        id: row.id,
        _id: row.id,
        userId: row.user_id,
        userName: row.user_name || "",
        amount: Number(row.amount || 0),
        remarks: row.remarks || "",
        createdBy: row.created_by || null,
        createdAt: row.created_at
      }
    : null;

const hydrateOrderItemImages = async (orders) => {
  const normalizedOrders = Array.isArray(orders) ? orders.filter(Boolean) : [];
  if (!normalizedOrders.length) {
    return normalizedOrders;
  }

  const productIds = [
    ...new Set(
      normalizedOrders.flatMap((order) =>
        (order.items || [])
          .filter((item) => item?.product)
          .map((item) => String(item.product))
      )
    )
  ];

  if (!productIds.length) {
    return normalizedOrders;
  }

  const products = await getProductsByIds(productIds);
  const imageMap = new Map(products.map((product) => [String(product.id || product._id), product.image || ""]));

  return normalizedOrders.map((order) => ({
    ...order,
    items: (order.items || []).map((item) => ({
      ...item,
      image: item.image || imageMap.get(String(item.product)) || ""
    }))
  }));
};

const saveUser = async (user) => {
  if (user.id) {
    await query(
       `UPDATE users
       SET name=:name, email=:email, password_hash=:passwordHash, avatar=:avatar, role=:role, is_active=:isActive
       WHERE id=:id`,
      {
        id: user.id,
        name: user.name,
        email: user.email,
        passwordHash: user.password,
        avatar: user.avatar || "",
        role: user.role,
        isActive: boolToInt(user.isActive)
      }
    );
    return getUserById(user.id);
  }

  const id = createId();
  await query(
    `INSERT INTO users (id, name, email, password_hash, avatar, role, is_active)
     VALUES (:id, :name, :email, :passwordHash, :avatar, :role, :isActive)`,
    {
      id,
      name: user.name,
      email: user.email,
      passwordHash: user.password,
      avatar: user.avatar || "",
      role: user.role,
      isActive: boolToInt(user.isActive ?? true)
    }
  );
  return getUserById(id);
};

const getUserById = async (id) => {
  const rows = await query(`SELECT ${userColumns} FROM users WHERE id=:id LIMIT 1`, { id });
  return mapUserRow(rows[0]);
};

const getUserByEmail = async (email) => {
  const rows = await query(`SELECT ${userColumns} FROM users WHERE email=:email LIMIT 1`, { email });
  return mapUserRow(rows[0]);
};

const getUsersByRoles = async (roles) => {
  if (!roles.length) {
    return [];
  }

  const placeholders = roles.map((_, index) => `:role${index}`).join(",");
  const params = roles.reduce((acc, role, index) => ({ ...acc, [`role${index}`]: role }), {});
  const rows = await query(
    `SELECT ${userColumns} FROM users WHERE role IN (${placeholders}) ORDER BY created_at DESC`,
    params
  );
  return rows.map(mapUserRow);
};

const getUsersByIds = async (ids) => {
  if (!ids.length) {
    return [];
  }

  const placeholders = ids.map((_, index) => `:id${index}`).join(",");
  const params = ids.reduce((acc, id, index) => ({ ...acc, [`id${index}`]: id }), {});
  const rows = await query(`SELECT ${userColumns} FROM users WHERE id IN (${placeholders})`, params);
  return rows.map(mapUserRow);
};

const findUserByEmailExcludingId = async (email, excludeId) => {
  const rows = await query(
    `SELECT ${userColumns} FROM users WHERE email=:email AND id<>:excludeId LIMIT 1`,
    { email, excludeId }
  );
  return mapUserRow(rows[0]);
};

const getDefaultShopSettings = async () => {
  const rows = await query(`SELECT ${settingsColumns} FROM shop_settings WHERE settings_key='default' LIMIT 1`);
  return mapShopSettingsRow(rows[0]);
};

const saveShopSettings = async (settings) => {
  const existing = await getDefaultShopSettings();

  if (existing) {
    await query(
      `UPDATE shop_settings SET shop_name=:shopName, address=:address, logo=:logo WHERE settings_key='default'`,
      {
        shopName: settings.shopName,
        address: settings.address,
        logo: settings.logo
      }
    );
  } else {
    await query(
      `INSERT INTO shop_settings (settings_key, shop_name, address, logo) VALUES ('default', :shopName, :address, :logo)`,
      {
        shopName: settings.shopName,
        address: settings.address,
        logo: settings.logo
      }
    );
  }

  return getDefaultShopSettings();
};

const getAllProducts = async () => {
  const rows = await query(`SELECT ${productColumns} FROM products ORDER BY category ASC, name ASC`);
  return rows.map(mapProductRow);
};

const getProductsByIds = async (ids) => {
  if (!ids.length) {
    return [];
  }

  const placeholders = ids.map((_, index) => `:id${index}`).join(",");
  const params = ids.reduce((acc, id, index) => ({ ...acc, [`id${index}`]: id }), {});
  const rows = await query(`SELECT ${productColumns} FROM products WHERE id IN (${placeholders})`, params);
  return rows.map(mapProductRow);
};

const getAllProductsAdmin = async () => {
  const rows = await query(`SELECT ${productColumns} FROM products ORDER BY created_at DESC`);
  return rows.map(mapProductRow);
};

const getProductById = async (id) => {
  const rows = await query(`SELECT ${productColumns} FROM products WHERE id=:id LIMIT 1`, { id });
  return mapProductRow(rows[0]);
};

const saveProduct = async (product) => {
  const params = {
    id: product.id || createId(),
    name: product.name,
    khmerName: product.khmerName || "",
    price: Number(product.price || 0),
    regularPrice: Number(product.regularPrice || 0),
    promotionalPrice: Number(product.promotionalPrice || 0),
    tentativeCost: Number(product.tentativeCost || 0),
    category: product.category,
    khmerCategory: product.khmerCategory || "",
    description: product.description || "",
    khmerDescription: product.khmerDescription || "",
    image: product.image || "",
    stock: Number(product.stock || 0),
    stockUnit: product.stockUnit || "pieces",
    seasoningPerOrderConsumption: Number(product.seasoningPerOrderConsumption || 0),
    expiryDate: product.expiryDate || null,
    productType: product.productType || "raw",
    comboItems: stringifyJson(product.comboItems, []),
    forSale: boolToInt(product.forSale ?? true),
    sku: product.sku,
    foodpandaSku: product.foodpandaSku || "",
    grabSku: product.grabSku || "",
    eGatesSku: product.eGatesSku || "",
    wownowSku: product.wownowSku || "",
    isActive: boolToInt(product.isActive ?? true),
    lowStockThreshold: Number(product.lowStockThreshold || 5)
  };

  if (product.id) {
    await query(
      `UPDATE products
       SET name=:name, khmer_name=:khmerName, price=:price, regular_price=:regularPrice,
           promotional_price=:promotionalPrice, category=:category, khmer_category=:khmerCategory,
           tentative_cost=:tentativeCost,
           description=:description, khmer_description=:khmerDescription, image=:image, stock=:stock,
           stock_unit=:stockUnit, seasoning_per_order_consumption=:seasoningPerOrderConsumption,
           expiry_date=:expiryDate, product_type=:productType, combo_items=:comboItems, for_sale=:forSale,
           sku=:sku, foodpanda_sku=:foodpandaSku, grab_sku=:grabSku, e_gates_sku=:eGatesSku, wownow_sku=:wownowSku,
           is_active=:isActive, low_stock_threshold=:lowStockThreshold
       WHERE id=:id`,
      params
    );
    return getProductById(product.id);
  }

  await query(
    `INSERT INTO products (
      id, name, khmer_name, price, regular_price, promotional_price, category, khmer_category,
      tentative_cost, description, khmer_description, image, stock, stock_unit, seasoning_per_order_consumption,
      expiry_date, product_type, combo_items, for_sale, sku, foodpanda_sku, grab_sku, e_gates_sku, wownow_sku,
      is_active, low_stock_threshold
    ) VALUES (
      :id, :name, :khmerName, :price, :regularPrice, :promotionalPrice, :category, :khmerCategory,
      :tentativeCost, :description, :khmerDescription, :image, :stock, :stockUnit, :seasoningPerOrderConsumption,
      :expiryDate, :productType, :comboItems, :forSale, :sku, :foodpandaSku, :grabSku, :eGatesSku, :wownowSku,
      :isActive, :lowStockThreshold
    )`,
    params
  );
  return getProductById(params.id);
};

const deleteProductById = async (id) => {
  await query(`DELETE FROM products WHERE id=:id`, { id });
};

const saveInventoryMovement = async (movement) => {
  const id = movement.id || createId();
  await query(
    `INSERT INTO inventory_movements (
      id, product_id, product_name, sku, category, stock_unit, movement_type,
      quantity, previous_stock, new_stock, performed_by, reason
    ) VALUES (
      :id, :productId, :productName, :sku, :category, :stockUnit, :movementType,
      :quantity, :previousStock, :newStock, :performedBy, :reason
    )`,
    {
      id,
      productId: movement.product,
      productName: movement.productName,
      sku: movement.sku,
      category: movement.category,
      stockUnit: movement.stockUnit || "pieces",
      movementType: movement.movementType,
      quantity: Number(movement.quantity || 0),
      previousStock: Number(movement.previousStock || 0),
      newStock: Number(movement.newStock || 0),
      performedBy: movement.performedBy || null,
      reason: movement.reason || ""
    }
  );
};

const getAllPromos = async () => {
  const rows = await query(`SELECT ${promoColumns} FROM promo_codes ORDER BY created_at DESC`);
  return rows.map(mapPromoRow);
};

const getPromoById = async (id) => {
  const rows = await query(`SELECT ${promoColumns} FROM promo_codes WHERE id=:id LIMIT 1`, { id });
  return mapPromoRow(rows[0]);
};

const getPromoByCode = async (code) => {
  const rows = await query(`SELECT ${promoColumns} FROM promo_codes WHERE code=:code LIMIT 1`, { code });
  return mapPromoRow(rows[0]);
};

const savePromo = async (promo) => {
  const params = {
    id: promo.id || createId(),
    code: promo.code,
    title: promo.title || "",
    description: promo.description || "",
    discountType: promo.discountType || "fixed",
    discountValue: Number(promo.discountValue || 0),
    minOrderAmount: Number(promo.minOrderAmount || 0),
    maxDiscountAmount: promo.maxDiscountAmount === null || promo.maxDiscountAmount === undefined || promo.maxDiscountAmount === ""
      ? null
      : Number(promo.maxDiscountAmount),
    startsAt: promo.startsAt || null,
    expiresAt: promo.expiresAt || null,
    maxTotalUses: promo.maxTotalUses === null || promo.maxTotalUses === undefined || promo.maxTotalUses === ""
      ? null
      : Number(promo.maxTotalUses),
    maxUsesPerDay: promo.maxUsesPerDay === null || promo.maxUsesPerDay === undefined || promo.maxUsesPerDay === ""
      ? null
      : Number(promo.maxUsesPerDay),
    appliesTo: promo.appliesTo || "all",
    isActive: boolToInt(promo.isActive ?? true),
    notes: promo.notes || "",
    createdBy: promo.createdBy || null,
    updatedBy: promo.updatedBy || null
  };

  if (promo.id) {
    await query(
      `UPDATE promo_codes
       SET code=:code, title=:title, description=:description, discount_type=:discountType,
           discount_value=:discountValue, min_order_amount=:minOrderAmount, max_discount_amount=:maxDiscountAmount,
           starts_at=:startsAt, expires_at=:expiresAt, max_total_uses=:maxTotalUses, max_uses_per_day=:maxUsesPerDay,
           applies_to=:appliesTo, is_active=:isActive, notes=:notes, updated_by=:updatedBy
       WHERE id=:id`,
      params
    );
    return getPromoById(promo.id);
  }

  await query(
    `INSERT INTO promo_codes (
      id, code, title, description, discount_type, discount_value, min_order_amount,
      max_discount_amount, starts_at, expires_at, max_total_uses, max_uses_per_day,
      applies_to, is_active, notes, created_by, updated_by
    ) VALUES (
      :id, :code, :title, :description, :discountType, :discountValue, :minOrderAmount,
      :maxDiscountAmount, :startsAt, :expiresAt, :maxTotalUses, :maxUsesPerDay,
      :appliesTo, :isActive, :notes, :createdBy, :updatedBy
    )`,
    params
  );

  return getPromoById(params.id);
};

const deletePromoById = async (id) => {
  await query(`DELETE FROM promo_codes WHERE id=:id`, { id });
};

const ensurePartnerSettings = async () => {
  const existingRows = await query(`SELECT ${partnerColumns} FROM partner_settings`);
  const existingKeys = new Set(existingRows.map((row) => String(row.partner_key)));

  for (const defaultSetting of buildDefaultPartnerSettings()) {
    if (existingKeys.has(defaultSetting.partnerKey)) {
      continue;
    }

    await query(
      `INSERT INTO partner_settings (partner_key, partner_name, commission_rate, advertisement_roi_rate, promo_config, is_active)
       VALUES (:partnerKey, :partnerName, :commissionRate, :advertisementRoiRate, :promoConfig, :isActive)`,
      {
        partnerKey: defaultSetting.partnerKey,
        partnerName: defaultSetting.partnerName,
        commissionRate: Number(defaultSetting.commissionRate || 0),
        advertisementRoiRate: Number(defaultSetting.advertisementRoiRate || 0),
        promoConfig: stringifyJson(defaultSetting.promos, []),
        isActive: boolToInt(defaultSetting.isActive ?? true)
      }
    );
  }
};

const getAllPartnerSettings = async () => {
  await ensurePartnerSettings();
  const rows = await query(`SELECT ${partnerColumns} FROM partner_settings ORDER BY partner_name ASC`);
  return rows.map(mapPartnerSettingRow);
};

const getPartnerSettingByKey = async (partnerKey) => {
  if (!partnerKey) {
    return null;
  }

  await ensurePartnerSettings();
  const rows = await query(`SELECT ${partnerColumns} FROM partner_settings WHERE partner_key=:partnerKey LIMIT 1`, { partnerKey });
  return mapPartnerSettingRow(rows[0]) || createDefaultPartnerSetting(partnerKey);
};

const savePartnerSetting = async (setting) => {
  const normalized = normalizePartnerSetting(setting);
  const existing = await getPartnerSettingByKey(normalized.partnerKey);

  if (existing) {
    await query(
      `UPDATE partner_settings
       SET partner_name=:partnerName, commission_rate=:commissionRate, advertisement_roi_rate=:advertisementRoiRate,
           promo_config=:promoConfig, is_active=:isActive
       WHERE partner_key=:partnerKey`,
      {
        partnerKey: normalized.partnerKey,
        partnerName: normalized.partnerName,
        commissionRate: Number(normalized.commissionRate || 0),
        advertisementRoiRate: Number(normalized.advertisementRoiRate || 0),
        promoConfig: stringifyJson(normalized.promos, []),
        isActive: boolToInt(normalized.isActive ?? true)
      }
    );
  } else {
    await query(
      `INSERT INTO partner_settings (partner_key, partner_name, commission_rate, advertisement_roi_rate, promo_config, is_active)
       VALUES (:partnerKey, :partnerName, :commissionRate, :advertisementRoiRate, :promoConfig, :isActive)`,
      {
        partnerKey: normalized.partnerKey,
        partnerName: normalized.partnerName,
        commissionRate: Number(normalized.commissionRate || 0),
        advertisementRoiRate: Number(normalized.advertisementRoiRate || 0),
        promoConfig: stringifyJson(normalized.promos, []),
        isActive: boolToInt(normalized.isActive ?? true)
      }
    );
  }

  return getPartnerSettingByKey(normalized.partnerKey);
};

const mapPartnerWebhookLogRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    partnerKey: row.partner_key,
    eventType: row.event_type || "",
    externalOrderId: row.external_order_id || "",
    orderStatus: row.order_status || "",
    headers: parseJson(row.headers_json, {}),
    payload: parseJson(row.payload_json, {}),
    createdAt: row.created_at
  };
};

const savePartnerWebhookLog = async (log) => {
  const id = log.id || createId();
  await query(
    `INSERT INTO partner_webhook_logs (
      id, partner_key, event_type, external_order_id, order_status, headers_json, payload_json
    ) VALUES (
      :id, :partnerKey, :eventType, :externalOrderId, :orderStatus, :headersJson, :payloadJson
    )`,
    {
      id,
      partnerKey: log.partnerKey,
      eventType: log.eventType || "",
      externalOrderId: log.externalOrderId || "",
      orderStatus: log.orderStatus || "",
      headersJson: stringifyJson(log.headers, {}),
      payloadJson: stringifyJson(log.payload, {})
    }
  );

  return getPartnerWebhookLogById(id);
};

const getPartnerWebhookLogById = async (id) => {
  const rows = await query(`SELECT ${partnerWebhookLogColumns} FROM partner_webhook_logs WHERE id=:id LIMIT 1`, { id });
  return mapPartnerWebhookLogRow(rows[0]);
};

const getPartnerWebhookLogs = async ({ partnerKey = null, limit = 50 } = {}) => {
  const conditions = [];
  const params = { limit: Number(limit) };

  if (partnerKey) {
    conditions.push("partner_key = :partnerKey");
    params.partnerKey = partnerKey;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await query(
    `SELECT ${partnerWebhookLogColumns} FROM partner_webhook_logs ${whereClause} ORDER BY created_at DESC LIMIT :limit`,
    params
  );

  return rows.map(mapPartnerWebhookLogRow);
};

const getInventoryMovements = async ({ movementType = null, from = null, to = null, limit = null } = {}) => {
  const conditions = [];
  const params = {};

  if (movementType) {
    conditions.push("movement_type = :movementType");
    params.movementType = movementType;
  }

  if (from) {
    conditions.push("created_at >= :from");
    params.from = from;
  }

  if (to) {
    conditions.push("created_at <= :to");
    params.to = to;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limitClause = limit ? `LIMIT ${Number(limit)}` : "";
  const rows = await query(
    `SELECT ${movementColumns} FROM inventory_movements ${whereClause} ORDER BY created_at DESC ${limitClause}`,
    params
  );
  return rows.map(mapInventoryMovementRow);
};

const attachPurchaseItems = async (entries) => {
  const normalizedEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
  if (!normalizedEntries.length) {
    return normalizedEntries;
  }

  const placeholders = normalizedEntries.map((_, index) => `:purchaseId${index}`).join(",");
  const params = normalizedEntries.reduce(
    (acc, entry, index) => ({ ...acc, [`purchaseId${index}`]: entry.id }),
    {}
  );
  const rows = await query(
    `SELECT ${purchaseItemColumns} FROM purchase_items WHERE purchase_id IN (${placeholders}) ORDER BY created_at ASC`,
    params
  );
  const itemMap = rows.map(mapPurchaseItemRow).reduce((acc, item) => {
    if (!acc.has(item.purchaseId)) {
      acc.set(item.purchaseId, []);
    }
    acc.get(item.purchaseId).push(item);
    return acc;
  }, new Map());

  return normalizedEntries.map((entry) => ({
    ...entry,
    items: itemMap.get(entry.id) || []
  }));
};

const normalizeVendorName = (name) => String(name || "").trim().replace(/\s+/g, " ");
const normalizeVendorKey = (name) => normalizeVendorName(name).toLowerCase();
const normalizeCostName = normalizeVendorName;
const normalizeCostKey = normalizeVendorKey;

const getProcurementVendors = async ({ search = "" } = {}) => {
  const params = {};
  const conditions = [];
  if (search) {
    conditions.push("(name LIKE :search OR normalized_name LIKE :search)");
    params.search = `%${search}%`;
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await query(`SELECT ${procurementVendorColumns} FROM procurement_vendors ${whereClause} ORDER BY name ASC`, params);
  return rows.map(mapProcurementVendorRow);
};

const getProcurementVendorByNormalizedName = async (normalizedName) => {
  const rows = await query(`SELECT ${procurementVendorColumns} FROM procurement_vendors WHERE normalized_name=:normalizedName LIMIT 1`, {
    normalizedName
  });
  return mapProcurementVendorRow(rows[0]);
};

const upsertProcurementVendor = async ({ name, createdBy = null }) => {
  const cleanName = normalizeVendorName(name);
  const normalizedName = normalizeVendorKey(cleanName);
  if (!cleanName) {
    return null;
  }

  const existing = await getProcurementVendorByNormalizedName(normalizedName);
  if (existing) {
    if (existing.name !== cleanName) {
      await query(`UPDATE procurement_vendors SET name=:name WHERE id=:id`, { id: existing.id, name: cleanName });
      return getProcurementVendorByNormalizedName(normalizedName);
    }
    return existing;
  }

  const id = createId();
  await query(
    `INSERT INTO procurement_vendors (id, name, normalized_name, created_by)
     VALUES (:id, :name, :normalizedName, :createdBy)`,
    { id, name: cleanName, normalizedName, createdBy }
  );
  return getProcurementVendorByNormalizedName(normalizedName);
};

const getProcurementUsers = async () => getUsersByRoles(["master_admin", "admin", "staff"]);

const getProcurementCostNames = async ({ search = "" } = {}) => {
  const params = {};
  const conditions = [];
  if (search) {
    conditions.push("(name LIKE :search OR normalized_name LIKE :search)");
    params.search = `%${search}%`;
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await query(`SELECT ${procurementCostNameColumns} FROM procurement_cost_names ${whereClause} ORDER BY name ASC`, params);
  return rows.map(mapProcurementCostNameRow);
};

const getProcurementCostNameByNormalizedName = async (normalizedName) => {
  const rows = await query(`SELECT ${procurementCostNameColumns} FROM procurement_cost_names WHERE normalized_name=:normalizedName LIMIT 1`, {
    normalizedName
  });
  return mapProcurementCostNameRow(rows[0]);
};

const upsertProcurementCostName = async ({ name, createdBy = null }) => {
  const cleanName = normalizeCostName(name);
  const normalizedName = normalizeCostKey(cleanName);
  if (!cleanName) {
    return null;
  }

  const existing = await getProcurementCostNameByNormalizedName(normalizedName);
  if (existing) {
    if (existing.name !== cleanName) {
      await query(`UPDATE procurement_cost_names SET name=:name WHERE id=:id`, { id: existing.id, name: cleanName });
      return getProcurementCostNameByNormalizedName(normalizedName);
    }
    return existing;
  }

  const id = createId();
  await query(
    `INSERT INTO procurement_cost_names (id, name, normalized_name, created_by)
     VALUES (:id, :name, :normalizedName, :createdBy)`,
    { id, name: cleanName, normalizedName, createdBy }
  );
  return getProcurementCostNameByNormalizedName(normalizedName);
};

const getPurchaseEntries = async ({ from = null, to = null, search = "", paymentMethod = "", supplierId = "" } = {}) => {
  const conditions = [];
  const params = {};

  if (from) {
    conditions.push("created_at >= :from");
    params.from = from;
  }

  if (to) {
    conditions.push("created_at <= :to");
    params.to = to;
  }

  if (paymentMethod) {
    conditions.push("payment_method = :paymentMethod");
    params.paymentMethod = paymentMethod;
  }

  if (supplierId) {
    conditions.push("supplier_id = :supplierId");
    params.supplierId = supplierId;
  }

  if (search) {
    conditions.push("(supplier_name LIKE :search OR handled_by_user_name LIKE :search OR id LIKE :search)");
    params.search = `%${search}%`;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await query(
    `SELECT ${purchaseEntryColumns} FROM purchase_entries ${whereClause} ORDER BY created_at DESC`,
    params
  );

  return attachPurchaseItems(rows.map(mapPurchaseEntryRow));
};

const getPurchaseEntryById = async (id) => {
  const rows = await query(`SELECT ${purchaseEntryColumns} FROM purchase_entries WHERE id=:id LIMIT 1`, { id });
  const [entry] = await attachPurchaseItems([mapPurchaseEntryRow(rows[0])]);
  return entry || null;
};

const savePurchaseEntry = async (entry) => {
  const id = entry.id || createId();
  const items = Array.isArray(entry.items) ? entry.items : [];
  const totalAmount = items.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
  const vendor = await upsertProcurementVendor({ name: entry.supplierName, createdBy: entry.createdBy || entry.updatedBy || null });

  if (entry.id) {
    await query(
        `UPDATE purchase_entries
         SET supplier_id=:supplierId, supplier_name=:supplierName, payment_method=:paymentMethod,
             handled_by_user_id=:handledByUserId, handled_by_user_name=:handledByUserName,
             total_amount=:totalAmount, updated_by=:updatedBy
         WHERE id=:id`,
      {
        id,
        supplierId: vendor?.id || null,
        supplierName: entry.supplierName,
        paymentMethod: entry.paymentMethod,
        handledByUserId: entry.handledByUserId || null,
        handledByUserName: entry.handledByUserName || "",
        totalAmount,
        updatedBy: entry.updatedBy || null
      }
    );
    await query(`DELETE FROM purchase_items WHERE purchase_id=:id`, { id });
  } else {
    await query(
        `INSERT INTO purchase_entries (
           id, supplier_id, supplier_name, payment_method, handled_by_user_id, handled_by_user_name,
           total_amount, created_by, updated_by
         )
         VALUES (
           :id, :supplierId, :supplierName, :paymentMethod, :handledByUserId, :handledByUserName,
           :totalAmount, :createdBy, :updatedBy
         )`,
      {
        id,
        supplierId: vendor?.id || null,
        supplierName: entry.supplierName,
        paymentMethod: entry.paymentMethod,
        handledByUserId: entry.handledByUserId || null,
        handledByUserName: entry.handledByUserName || "",
        totalAmount,
        createdBy: entry.createdBy || null,
        updatedBy: entry.updatedBy || entry.createdBy || null
      }
    );
  }

  for (const item of items) {
    const quantity = Number(item.quantity || 0);
    const itemTotal = Number(item.totalAmount || 0);
    await query(
      `INSERT INTO purchase_items (
        id, purchase_id, product_id, product_name, sku, quantity, unit_name, total_amount, unit_price, remarks
      ) VALUES (
        :id, :purchaseId, :productId, :productName, :sku, :quantity, :unitName, :totalAmount, :unitPrice, :remarks
      )`,
      {
        id: createId(),
        purchaseId: id,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku || "",
        quantity,
        unitName: item.unitName || "Piece",
        totalAmount: itemTotal,
        unitPrice: quantity > 0 ? Number((itemTotal / quantity).toFixed(2)) : 0,
        remarks: item.remarks || ""
      }
    );
  }

  return getPurchaseEntryById(id);
};

const deletePurchaseEntryById = async (id) => {
  await query(`DELETE FROM purchase_entries WHERE id=:id`, { id });
};

const getProcurementCostEntries = async ({ from = null, to = null, search = "", paymentMethod = "", costNameId = "" } = {}) => {
  const conditions = [];
  const params = {};

  if (from) {
    conditions.push("created_at >= :from");
    params.from = from;
  }
  if (to) {
    conditions.push("created_at <= :to");
    params.to = to;
  }
  if (paymentMethod) {
    conditions.push("payment_method = :paymentMethod");
    params.paymentMethod = paymentMethod;
  }
  if (costNameId) {
    conditions.push("cost_name_id = :costNameId");
    params.costNameId = costNameId;
  }
  if (search) {
    conditions.push("(cost_name LIKE :search OR handled_by_user_name LIKE :search OR remarks LIKE :search OR id LIKE :search)");
    params.search = `%${search}%`;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await query(
    `SELECT ${procurementCostEntryColumns} FROM procurement_cost_entries ${whereClause} ORDER BY created_at DESC`,
    params
  );
  return rows.map(mapProcurementCostEntryRow);
};

const getProcurementCostEntryById = async (id) => {
  const rows = await query(`SELECT ${procurementCostEntryColumns} FROM procurement_cost_entries WHERE id=:id LIMIT 1`, { id });
  return mapProcurementCostEntryRow(rows[0]);
};

const saveProcurementCostEntry = async (entry) => {
  const id = entry.id || createId();
  const costName = await upsertProcurementCostName({ name: entry.costName, createdBy: entry.createdBy || entry.updatedBy || null });
  const payload = {
    id,
    costNameId: costName?.id || null,
    costName: costName?.name || normalizeCostName(entry.costName),
    paymentMethod: entry.paymentMethod,
    handledByUserId: entry.handledByUserId || null,
    handledByUserName: entry.handledByUserName || "",
    amount: Number(entry.amount || 0),
    remarks: entry.remarks || "",
    createdBy: entry.createdBy || null,
    updatedBy: entry.updatedBy || entry.createdBy || null
  };

  if (entry.id) {
    await query(
      `UPDATE procurement_cost_entries
       SET cost_name_id=:costNameId, cost_name=:costName, payment_method=:paymentMethod,
           handled_by_user_id=:handledByUserId, handled_by_user_name=:handledByUserName,
           amount=:amount, remarks=:remarks, updated_by=:updatedBy
       WHERE id=:id`,
      payload
    );
  } else {
    await query(
      `INSERT INTO procurement_cost_entries (
         id, cost_name_id, cost_name, payment_method, handled_by_user_id, handled_by_user_name,
         amount, remarks, created_by, updated_by
       )
       VALUES (
         :id, :costNameId, :costName, :paymentMethod, :handledByUserId, :handledByUserName,
         :amount, :remarks, :createdBy, :updatedBy
       )`,
      payload
    );
  }

  return getProcurementCostEntryById(id);
};

const deleteProcurementCostEntryById = async (id) => {
  await query(`DELETE FROM procurement_cost_entries WHERE id=:id`, { id });
};

const saveProcurementPayment = async (payment) => {
  const id = createId();
  await query(
    `INSERT INTO procurement_payments (
       id, payment_type, vendor_id, vendor_name, user_id, user_name, amount, payment_method, remarks, created_by
     )
     VALUES (
       :id, :paymentType, :vendorId, :vendorName, :userId, :userName, :amount, :paymentMethod, :remarks, :createdBy
     )`,
    {
      id,
      paymentType: payment.paymentType,
      vendorId: payment.vendorId || null,
      vendorName: payment.vendorName || "",
      userId: payment.userId || null,
      userName: payment.userName || "",
      amount: Number(payment.amount || 0),
      paymentMethod: payment.paymentMethod,
      remarks: payment.remarks || "",
      createdBy: payment.createdBy || null
    }
  );
  const rows = await query(`SELECT ${procurementPaymentColumns} FROM procurement_payments WHERE id=:id LIMIT 1`, { id });
  return mapProcurementPaymentRow(rows[0]);
};

const getProcurementPayments = async ({ from = null, to = null, paymentType = "", vendorId = "", userId = "" } = {}) => {
  const conditions = [];
  const params = {};
  if (from) {
    conditions.push("created_at >= :from");
    params.from = from;
  }
  if (to) {
    conditions.push("created_at <= :to");
    params.to = to;
  }
  if (paymentType) {
    conditions.push("payment_type = :paymentType");
    params.paymentType = paymentType;
  }
  if (vendorId) {
    conditions.push("vendor_id = :vendorId");
    params.vendorId = vendorId;
  }
  if (userId) {
    conditions.push("user_id = :userId");
    params.userId = userId;
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await query(`SELECT ${procurementPaymentColumns} FROM procurement_payments ${whereClause} ORDER BY created_at DESC`, params);
  return rows.map(mapProcurementPaymentRow);
};

const saveCashHandover = async (handover) => {
  const id = createId();
  await query(
    `INSERT INTO cash_handovers (id, user_id, user_name, amount, remarks, created_by)
     VALUES (:id, :userId, :userName, :amount, :remarks, :createdBy)`,
    {
      id,
      userId: handover.userId,
      userName: handover.userName || "",
      amount: Number(handover.amount || 0),
      remarks: handover.remarks || "",
      createdBy: handover.createdBy || null
    }
  );
  const rows = await query(`SELECT ${cashHandoverColumns} FROM cash_handovers WHERE id=:id LIMIT 1`, { id });
  return mapCashHandoverRow(rows[0]);
};

const getCashHandovers = async ({ from = null, to = null, userId = "" } = {}) => {
  const conditions = [];
  const params = {};

  if (from) {
    conditions.push("created_at >= :from");
    params.from = from;
  }
  if (to) {
    conditions.push("created_at <= :to");
    params.to = to;
  }
  if (userId) {
    conditions.push("user_id = :userId");
    params.userId = userId;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await query(`SELECT ${cashHandoverColumns} FROM cash_handovers ${whereClause} ORDER BY created_at DESC`, params);
  return rows.map(mapCashHandoverRow);
};

const getItemwisePurchaseReport = async ({ from = null, to = null, productId = "", search = "" } = {}) => {
  const conditions = [];
  const params = {};

  if (from) {
    conditions.push("pe.created_at >= :from");
    params.from = from;
  }

  if (to) {
    conditions.push("pe.created_at <= :to");
    params.to = to;
  }

  if (productId) {
    conditions.push("pi.product_id = :productId");
    params.productId = productId;
  }

  if (search) {
    conditions.push("(pi.product_name LIKE :search OR pi.sku LIKE :search)");
    params.search = `%${search}%`;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await query(
    `SELECT
       pi.product_id,
       pi.product_name,
       pi.sku,
       pi.unit_name,
       SUM(pi.quantity) AS total_quantity,
       SUM(pi.total_amount) AS total_amount,
       COUNT(DISTINCT pe.id) AS purchase_count,
       CASE WHEN SUM(pi.quantity) > 0 THEN SUM(pi.total_amount) / SUM(pi.quantity) ELSE 0 END AS average_unit_price,
       MIN(pe.created_at) AS first_purchase_at,
       MAX(pe.created_at) AS last_purchase_at
     FROM purchase_items pi
     INNER JOIN purchase_entries pe ON pe.id = pi.purchase_id
     ${whereClause}
     GROUP BY pi.product_id, pi.product_name, pi.sku, pi.unit_name
     ORDER BY total_amount DESC, pi.product_name ASC`,
    params
  );

  return rows.map((row) => ({
    productId: row.product_id,
    productName: row.product_name,
    sku: row.sku || "",
    unitName: row.unit_name || "Piece",
    totalQuantity: Number(row.total_quantity || 0),
    totalAmount: Number(row.total_amount || 0),
    purchaseCount: Number(row.purchase_count || 0),
    averageUnitPrice: Number(row.average_unit_price || 0),
    firstPurchaseAt: row.first_purchase_at,
    lastPurchaseAt: row.last_purchase_at
  }));
};

const getCostwiseProcurementReport = async ({ from = null, to = null, costNameId = "", search = "" } = {}) => {
  const conditions = [];
  const params = {};

  if (from) {
    conditions.push("created_at >= :from");
    params.from = from;
  }
  if (to) {
    conditions.push("created_at <= :to");
    params.to = to;
  }
  if (costNameId) {
    conditions.push("cost_name_id = :costNameId");
    params.costNameId = costNameId;
  }
  if (search) {
    conditions.push("(cost_name LIKE :search OR handled_by_user_name LIKE :search OR remarks LIKE :search)");
    params.search = `%${search}%`;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await query(
    `SELECT
       cost_name_id,
       cost_name,
       COUNT(*) AS entry_count,
       SUM(amount) AS total_amount,
       SUM(CASE WHEN payment_method = 'due' THEN amount ELSE 0 END) AS due_amount,
       SUM(CASE WHEN payment_method <> 'due' THEN amount ELSE 0 END) AS paid_amount,
       MIN(created_at) AS first_cost_at,
       MAX(created_at) AS last_cost_at
     FROM procurement_cost_entries
     ${whereClause}
     GROUP BY cost_name_id, cost_name
     ORDER BY total_amount DESC, cost_name ASC`,
    params
  );

  return rows.map((row) => ({
    costNameId: row.cost_name_id || null,
    costName: row.cost_name || "",
    entryCount: Number(row.entry_count || 0),
    totalAmount: Number(row.total_amount || 0),
    dueAmount: Number(row.due_amount || 0),
    paidAmount: Number(row.paid_amount || 0),
    firstCostAt: row.first_cost_at,
    lastCostAt: row.last_cost_at
  }));
};

const getOrders = async ({ where = "", params = {}, orderBy = "created_at DESC" } = {}) => {
  const rows = await query(`SELECT ${orderColumns} FROM orders ${where} ORDER BY ${orderBy}`, params);
  return hydrateOrderItemImages(rows.map(mapOrderRow));
};

const getOrderById = async (id) => {
  const rows = await query(`SELECT ${orderColumns} FROM orders WHERE id=:id LIMIT 1`, { id });
  const [order] = await hydrateOrderItemImages([mapOrderRow(rows[0])]);
  return order || null;
};

const getOrderByPublicId = async (id) => {
  const rows = await query(`SELECT ${orderColumns} FROM orders WHERE order_id=:id LIMIT 1`, { id });
  const [order] = await hydrateOrderItemImages([mapOrderRow(rows[0])]);
  return order || null;
};

const deleteOrderById = async (id) => {
  await query(`DELETE FROM orders WHERE id=:id`, { id });
};

const saveOrder = async (order, connection = null) => {
  const params = {
    id: order.id || createId(),
    orderId: order.orderId,
    items: stringifyJson(order.items, []),
    sauceItems: stringifyJson(order.sauceItems, []),
    total: Number(order.total || 0),
    subtotal: Number(order.subtotal || 0),
    costTotal: Number(order.costTotal || 0),
    paymentMethod: order.paymentMethod || null,
    bookingDetails: stringifyJson(order.bookingDetails, {}),
    status: order.status,
    queueNumber: order.queueNumber || "",
    source: order.source || "staff",
    promoCodeId: order.promoCodeId || null,
    promoCode: order.promoCode || null,
    promoDiscount: Number(order.promoDiscount || 0),
    promoSnapshot: stringifyJson(order.promoSnapshot, null),
    originalSubtotal: order.originalSubtotal ?? null,
    originalTotal: order.originalTotal ?? null,
    staffId: typeof order.staff === "object" ? order.staff?.id || order.staff?._id || null : order.staff || null,
    voidedAt: order.voidedAt || null,
    voidedBy: typeof order.voidedBy === "object" ? order.voidedBy?.id || order.voidedBy?._id || null : order.voidedBy || null,
    editedAt: order.editedAt || null,
    editedBy: typeof order.editedBy === "object" ? order.editedBy?.id || order.editedBy?._id || null : order.editedBy || null,
    editHistory: stringifyJson(order.editHistory, []),
    servedAt: order.servedAt || null,
    servedBy: typeof order.servedBy === "object" ? order.servedBy?.id || order.servedBy?._id || null : order.servedBy || null
  };

  const runner = connection ? (sql, sqlParams) => queryTx(connection, sql, sqlParams) : query;

  if (order.id) {
    await runner(
      `UPDATE orders
       SET order_id=:orderId, items=:items, sauce_items=:sauceItems, total=:total, subtotal=:subtotal, cost_total=:costTotal,
           payment_method=:paymentMethod, booking_details=:bookingDetails, status=:status, queue_number=:queueNumber,
           source=:source, promo_code_id=:promoCodeId, promo_code=:promoCode, promo_discount=:promoDiscount,
           promo_snapshot=:promoSnapshot, original_subtotal=:originalSubtotal, original_total=:originalTotal,
           staff_id=:staffId, voided_at=:voidedAt, voided_by=:voidedBy, edited_at=:editedAt, edited_by=:editedBy,
           edit_history=:editHistory, served_at=:servedAt, served_by=:servedBy
       WHERE id=:id`,
      params
    );
    return connection ? mapOrderRow({ ...order, id: order.id }) : getOrderById(order.id);
  }

  await runner(
    `INSERT INTO orders (
      id, order_id, items, sauce_items, total, subtotal, cost_total, payment_method, booking_details, status,
      queue_number, source, promo_code_id, promo_code, promo_discount, promo_snapshot,
      original_subtotal, original_total, staff_id, voided_at, voided_by,
      edited_at, edited_by, edit_history, served_at, served_by
    ) VALUES (
      :id, :orderId, :items, :sauceItems, :total, :subtotal, :costTotal, :paymentMethod, :bookingDetails, :status,
      :queueNumber, :source, :promoCodeId, :promoCode, :promoDiscount, :promoSnapshot,
      :originalSubtotal, :originalTotal, :staffId, :voidedAt, :voidedBy,
      :editedAt, :editedBy, :editHistory, :servedAt, :servedBy
    )`,
    params
  );
  return connection ? { ...order, id: params.id, _id: params.id } : getOrderById(params.id);
};

const clearCoreData = async () => {
  await query("DELETE FROM inventory_movements");
  await query("DELETE FROM orders");
  await query("DELETE FROM products");
  await query("DELETE FROM users");
  await query("DELETE FROM shop_settings");
};

module.exports = {
  saveUser,
  getUserById,
  getUserByEmail,
  getUsersByRoles,
  getUsersByIds,
  findUserByEmailExcludingId,
  getDefaultShopSettings,
  saveShopSettings,
  getAllProducts,
  getProductsByIds,
  getAllProductsAdmin,
  getProductById,
  saveProduct,
  deleteProductById,
  saveInventoryMovement,
  getInventoryMovements,
  getProcurementVendors,
  upsertProcurementVendor,
  getProcurementCostNames,
  upsertProcurementCostName,
  getProcurementUsers,
  saveProcurementPayment,
  getProcurementPayments,
  saveCashHandover,
  getCashHandovers,
  getPurchaseEntries,
  getPurchaseEntryById,
  savePurchaseEntry,
  deletePurchaseEntryById,
  getProcurementCostEntries,
  getProcurementCostEntryById,
  saveProcurementCostEntry,
  deleteProcurementCostEntryById,
  getItemwisePurchaseReport,
  getCostwiseProcurementReport,
  getAllPromos,
  getPromoById,
  getPromoByCode,
  savePromo,
  deletePromoById,
  getAllPartnerSettings,
  getPartnerSettingByKey,
  savePartnerSetting,
  savePartnerWebhookLog,
  getPartnerWebhookLogs,
  getOrders,
  getOrderById,
  getOrderByPublicId,
  deleteOrderById,
  saveOrder,
  clearCoreData
};
