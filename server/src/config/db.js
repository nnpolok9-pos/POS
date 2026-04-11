const mysql = require("mysql2/promise");
const { randomUUID } = require("crypto");

let pool;

const DEFAULTS = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "fast_food_pos"
};

const createBasePool = (withDatabase = true) =>
  mysql.createPool({
    host: DEFAULTS.host,
    port: DEFAULTS.port,
    user: DEFAULTS.user,
    password: DEFAULTS.password,
    database: withDatabase ? DEFAULTS.database : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
    decimalNumbers: true,
    timezone: "Z"
  });

const runSchemaStatements = async (connection) => {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      email VARCHAR(191) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('master_admin','admin','checker','staff') NOT NULL DEFAULT 'staff',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS shop_settings (
      id INT PRIMARY KEY AUTO_INCREMENT,
      settings_key VARCHAR(64) NOT NULL UNIQUE,
      shop_name VARCHAR(191) NOT NULL,
      address TEXT NOT NULL,
      logo TEXT NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      khmer_name VARCHAR(191) NOT NULL DEFAULT '',
      price DECIMAL(12,2) NOT NULL DEFAULT 0,
      regular_price DECIMAL(12,2) NOT NULL DEFAULT 0,
      promotional_price DECIMAL(12,2) NOT NULL DEFAULT 0,
      category VARCHAR(191) NOT NULL,
      khmer_category VARCHAR(191) NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      khmer_description TEXT NOT NULL,
      image TEXT NOT NULL,
      stock DECIMAL(12,3) NOT NULL DEFAULT 0,
      stock_unit ENUM('pieces','gram','teaspoon') NOT NULL DEFAULT 'pieces',
      seasoning_per_order_consumption DECIMAL(12,3) NOT NULL DEFAULT 0,
      expiry_date DATETIME NULL,
      product_type ENUM('raw','raw_material','sauce','seasoning','combo','combo_type') NOT NULL DEFAULT 'raw',
      combo_items JSON NOT NULL,
      for_sale TINYINT(1) NOT NULL DEFAULT 1,
      sku VARCHAR(191) NOT NULL UNIQUE,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      low_stock_threshold INT NOT NULL DEFAULT 5,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS inventory_movements (
      id VARCHAR(36) PRIMARY KEY,
      product_id VARCHAR(36) NOT NULL,
      product_name VARCHAR(191) NOT NULL,
      sku VARCHAR(191) NOT NULL,
      category VARCHAR(191) NOT NULL,
      stock_unit ENUM('pieces','gram','teaspoon') NOT NULL DEFAULT 'pieces',
      movement_type ENUM('received','deducted') NOT NULL,
      quantity DECIMAL(12,3) NOT NULL,
      previous_stock DECIMAL(12,3) NOT NULL,
      new_stock DECIMAL(12,3) NOT NULL,
      performed_by VARCHAR(36) NULL,
      reason TEXT NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_inventory_product_id (product_id),
      INDEX idx_inventory_performed_by (performed_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(36) PRIMARY KEY,
      order_id VARCHAR(191) NOT NULL UNIQUE,
      items JSON NOT NULL,
      sauce_items JSON NOT NULL,
      total DECIMAL(12,2) NOT NULL DEFAULT 0,
      subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
      payment_method ENUM('cash','card','qr') NULL,
      booking_details JSON NOT NULL,
      status ENUM('queued','food_serving','completed','void','quote_prepared','confirmed') NOT NULL DEFAULT 'food_serving',
      queue_number VARCHAR(64) NOT NULL DEFAULT '',
      source ENUM('staff','customer') NOT NULL DEFAULT 'staff',
      original_subtotal DECIMAL(12,2) NULL,
      original_total DECIMAL(12,2) NULL,
      staff_id VARCHAR(36) NULL,
      voided_at DATETIME(3) NULL,
      voided_by VARCHAR(36) NULL,
      edited_at DATETIME(3) NULL,
      edited_by VARCHAR(36) NULL,
      edit_history JSON NOT NULL,
      served_at DATETIME(3) NULL,
      served_by VARCHAR(36) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_orders_staff_id (staff_id),
      INDEX idx_orders_status (status),
      INDEX idx_orders_created_at (created_at),
      INDEX idx_orders_served_at (served_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  ];

  for (const statement of statements) {
    await connection.query(statement);
  }
};

const ensureDatabase = async () => {
  const basePool = createBasePool(false);
  try {
    await basePool.query(
      `CREATE DATABASE IF NOT EXISTS \`${DEFAULTS.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await basePool.end();
  }
};

const connectDB = async () => {
  await ensureDatabase();

  pool = createBasePool(true);
  const connection = await pool.getConnection();

  try {
    await runSchemaStatements(connection);
    console.log("MySQL connected");
  } finally {
    connection.release();
  }
};

const disconnectDB = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

const getPool = () => {
  if (!pool) {
    throw new Error("Database pool is not initialized");
  }

  return pool;
};

const query = async (sql, params = {}) => {
  const [rows] = await getPool().execute(sql, params);
  return rows;
};

const withTransaction = async (handler) => {
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const queryTx = async (connection, sql, params = {}) => {
  const [rows] = await connection.execute(sql, params);
  return rows;
};

const parseJson = (value, fallback) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const stringifyJson = (value, fallback = []) => JSON.stringify(value ?? fallback);

const mapUserRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    _id: row.id,
    name: row.name,
    email: row.email,
    password: row.password_hash,
    role: row.role,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const mapShopSettingsRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    key: row.settings_key,
    shopName: row.shop_name,
    address: row.address,
    logo: row.logo,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const mapProductRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    _id: row.id,
    name: row.name,
    khmerName: row.khmer_name || "",
    price: Number(row.price || 0),
    regularPrice: Number(row.regular_price || 0),
    promotionalPrice: Number(row.promotional_price || 0),
    category: row.category,
    khmerCategory: row.khmer_category || "",
    description: row.description || "",
    khmerDescription: row.khmer_description || "",
    image: row.image || "",
    stock: Number(row.stock || 0),
    stockUnit: row.stock_unit || "pieces",
    seasoningPerOrderConsumption: Number(row.seasoning_per_order_consumption || 0),
    expiryDate: row.expiry_date,
    productType: row.product_type || "raw",
    comboItems: parseJson(row.combo_items, []),
    forSale: Boolean(row.for_sale),
    sku: row.sku,
    isActive: Boolean(row.is_active),
    lowStockThreshold: Number(row.low_stock_threshold || 5),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const mapInventoryMovementRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    _id: row.id,
    product: row.product_id,
    productName: row.product_name,
    sku: row.sku,
    category: row.category,
    stockUnit: row.stock_unit || "pieces",
    movementType: row.movement_type,
    quantity: Number(row.quantity || 0),
    previousStock: Number(row.previous_stock || 0),
    newStock: Number(row.new_stock || 0),
    performedBy: row.performed_by,
    reason: row.reason || "",
    createdAt: row.created_at
  };
};

const mapOrderRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    _id: row.id,
    orderId: row.order_id,
    items: parseJson(row.items, []),
    sauceItems: parseJson(row.sauce_items, []),
    total: Number(row.total || 0),
    subtotal: Number(row.subtotal || 0),
    paymentMethod: row.payment_method,
    bookingDetails: parseJson(row.booking_details, {}),
    status: row.status,
    queueNumber: row.queue_number || "",
    source: row.source || "staff",
    originalSubtotal: row.original_subtotal === null ? null : Number(row.original_subtotal),
    originalTotal: row.original_total === null ? null : Number(row.original_total),
    staff: row.staff_id,
    voidedAt: row.voided_at,
    voidedBy: row.voided_by,
    editedAt: row.edited_at,
    editedBy: row.edited_by,
    editHistory: parseJson(row.edit_history, []),
    servedAt: row.served_at,
    servedBy: row.served_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

module.exports = {
  connectDB,
  disconnectDB,
  getPool,
  query,
  queryTx,
  withTransaction,
  parseJson,
  stringifyJson,
  mapUserRow,
  mapShopSettingsRow,
  mapProductRow,
  mapInventoryMovementRow,
  mapOrderRow,
  createId: () => randomUUID()
};
