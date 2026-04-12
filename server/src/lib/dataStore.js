const {
  query,
  queryTx,
  mapUserRow,
  mapProductRow,
  mapOrderRow,
  mapInventoryMovementRow,
  mapShopSettingsRow,
  stringifyJson,
  createId
} = require("../config/db");

const userColumns = `
  id, name, email, password_hash, role, is_active, created_at, updated_at
`;

const productColumns = `
  id, name, khmer_name, price, regular_price, promotional_price, category, khmer_category,
  description, khmer_description, image, stock, stock_unit, seasoning_per_order_consumption,
  expiry_date, product_type, combo_items, for_sale, sku, is_active, low_stock_threshold,
  created_at, updated_at
`;

const orderColumns = `
  id, order_id, items, sauce_items, total, subtotal, payment_method, booking_details, status,
  queue_number, source, original_subtotal, original_total, staff_id, voided_at, voided_by,
  edited_at, edited_by, edit_history, served_at, served_by, created_at, updated_at
`;

const movementColumns = `
  id, product_id, product_name, sku, category, stock_unit, movement_type, quantity,
  previous_stock, new_stock, performed_by, reason, created_at
`;

const settingsColumns = `
  id, settings_key, shop_name, address, logo, created_at, updated_at
`;

const boolToInt = (value) => (value ? 1 : 0);

const saveUser = async (user) => {
  if (user.id) {
    await query(
      `UPDATE users
       SET name=:name, email=:email, password_hash=:passwordHash, role=:role, is_active=:isActive
       WHERE id=:id`,
      {
        id: user.id,
        name: user.name,
        email: user.email,
        passwordHash: user.password,
        role: user.role,
        isActive: boolToInt(user.isActive)
      }
    );
    return getUserById(user.id);
  }

  const id = createId();
  await query(
    `INSERT INTO users (id, name, email, password_hash, role, is_active)
     VALUES (:id, :name, :email, :passwordHash, :role, :isActive)`,
    {
      id,
      name: user.name,
      email: user.email,
      passwordHash: user.password,
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
    isActive: boolToInt(product.isActive ?? true),
    lowStockThreshold: Number(product.lowStockThreshold || 5)
  };

  if (product.id) {
    await query(
      `UPDATE products
       SET name=:name, khmer_name=:khmerName, price=:price, regular_price=:regularPrice,
           promotional_price=:promotionalPrice, category=:category, khmer_category=:khmerCategory,
           description=:description, khmer_description=:khmerDescription, image=:image, stock=:stock,
           stock_unit=:stockUnit, seasoning_per_order_consumption=:seasoningPerOrderConsumption,
           expiry_date=:expiryDate, product_type=:productType, combo_items=:comboItems, for_sale=:forSale,
           sku=:sku, is_active=:isActive, low_stock_threshold=:lowStockThreshold
       WHERE id=:id`,
      params
    );
    return getProductById(product.id);
  }

  await query(
    `INSERT INTO products (
      id, name, khmer_name, price, regular_price, promotional_price, category, khmer_category,
      description, khmer_description, image, stock, stock_unit, seasoning_per_order_consumption,
      expiry_date, product_type, combo_items, for_sale, sku, is_active, low_stock_threshold
    ) VALUES (
      :id, :name, :khmerName, :price, :regularPrice, :promotionalPrice, :category, :khmerCategory,
      :description, :khmerDescription, :image, :stock, :stockUnit, :seasoningPerOrderConsumption,
      :expiryDate, :productType, :comboItems, :forSale, :sku, :isActive, :lowStockThreshold
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

const getOrders = async ({ where = "", params = {}, orderBy = "created_at DESC" } = {}) => {
  const rows = await query(`SELECT ${orderColumns} FROM orders ${where} ORDER BY ${orderBy}`, params);
  return rows.map(mapOrderRow);
};

const getOrderById = async (id) => {
  const rows = await query(`SELECT ${orderColumns} FROM orders WHERE id=:id LIMIT 1`, { id });
  return mapOrderRow(rows[0]);
};

const getOrderByPublicId = async (id) => {
  const rows = await query(`SELECT ${orderColumns} FROM orders WHERE order_id=:id LIMIT 1`, { id });
  return mapOrderRow(rows[0]);
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
    paymentMethod: order.paymentMethod || null,
    bookingDetails: stringifyJson(order.bookingDetails, {}),
    status: order.status,
    queueNumber: order.queueNumber || "",
    source: order.source || "staff",
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
       SET order_id=:orderId, items=:items, sauce_items=:sauceItems, total=:total, subtotal=:subtotal,
           payment_method=:paymentMethod, booking_details=:bookingDetails, status=:status, queue_number=:queueNumber,
           source=:source, original_subtotal=:originalSubtotal, original_total=:originalTotal, staff_id=:staffId,
           voided_at=:voidedAt, voided_by=:voidedBy, edited_at=:editedAt, edited_by=:editedBy,
           edit_history=:editHistory, served_at=:servedAt, served_by=:servedBy
       WHERE id=:id`,
      params
    );
    return connection ? mapOrderRow({ ...order, id: order.id }) : getOrderById(order.id);
  }

  await runner(
    `INSERT INTO orders (
      id, order_id, items, sauce_items, total, subtotal, payment_method, booking_details, status,
      queue_number, source, original_subtotal, original_total, staff_id, voided_at, voided_by,
      edited_at, edited_by, edit_history, served_at, served_by
    ) VALUES (
      :id, :orderId, :items, :sauceItems, :total, :subtotal, :paymentMethod, :bookingDetails, :status,
      :queueNumber, :source, :originalSubtotal, :originalTotal, :staffId, :voidedAt, :voidedBy,
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
  getOrders,
  getOrderById,
  getOrderByPublicId,
  deleteOrderById,
  saveOrder,
  clearCoreData
};
