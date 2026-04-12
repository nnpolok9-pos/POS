const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const Database = require("better-sqlite3");
const { randomUUID } = require("crypto");

let pool;
let sqliteDb;

const DB_CLIENT = (process.env.DB_CLIENT || "mysql").toLowerCase();
const IS_SQLITE = DB_CLIENT === "sqlite";

const DEFAULTS = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "fast_food_pos",
  sqlitePath: process.env.DB_SQLITE_PATH || path.join(process.cwd(), "data", "local-pos.sqlite")
};

const mysqlSchemaStatements = [
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

const sqliteSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS shop_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    settings_key TEXT NOT NULL UNIQUE,
    shop_name TEXT NOT NULL,
    address TEXT NOT NULL,
    logo TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    khmer_name TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL DEFAULT 0,
    regular_price REAL NOT NULL DEFAULT 0,
    promotional_price REAL NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    khmer_category TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    khmer_description TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    stock REAL NOT NULL DEFAULT 0,
    stock_unit TEXT NOT NULL DEFAULT 'pieces',
    seasoning_per_order_consumption REAL NOT NULL DEFAULT 0,
    expiry_date TEXT NULL,
    product_type TEXT NOT NULL DEFAULT 'raw',
    combo_items TEXT NOT NULL DEFAULT '[]',
    for_sale INTEGER NOT NULL DEFAULT 1,
    sku TEXT NOT NULL UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS inventory_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    sku TEXT NOT NULL,
    category TEXT NOT NULL,
    stock_unit TEXT NOT NULL DEFAULT 'pieces',
    movement_type TEXT NOT NULL,
    quantity REAL NOT NULL,
    previous_stock REAL NOT NULL,
    new_stock REAL NOT NULL,
    performed_by TEXT NULL,
    reason TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory_movements (product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_inventory_performed_by ON inventory_movements (performed_by)`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE,
    items TEXT NOT NULL DEFAULT '[]',
    sauce_items TEXT NOT NULL DEFAULT '[]',
    total REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL DEFAULT 0,
    payment_method TEXT NULL,
    booking_details TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'food_serving',
    queue_number TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'staff',
    original_subtotal REAL NULL,
    original_total REAL NULL,
    staff_id TEXT NULL,
    voided_at TEXT NULL,
    voided_by TEXT NULL,
    edited_at TEXT NULL,
    edited_by TEXT NULL,
    edit_history TEXT NOT NULL DEFAULT '[]',
    served_at TEXT NULL,
    served_by TEXT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_orders_staff_id ON orders (staff_id)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_served_at ON orders (served_at)`,
  `CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
    AFTER UPDATE ON users
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
      UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END`,
  `CREATE TRIGGER IF NOT EXISTS trg_shop_settings_updated_at
    AFTER UPDATE ON shop_settings
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
      UPDATE shop_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END`,
  `CREATE TRIGGER IF NOT EXISTS trg_products_updated_at
    AFTER UPDATE ON products
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
      UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END`,
  `CREATE TRIGGER IF NOT EXISTS trg_orders_updated_at
    AFTER UPDATE ON orders
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
      UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END`
];

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

const runMysqlSchemaStatements = async (connection) => {
  for (const statement of mysqlSchemaStatements) {
    await connection.query(statement);
  }
};

const ensureMysqlDatabase = async () => {
  const basePool = createBasePool(false);
  try {
    await basePool.query(`CREATE DATABASE IF NOT EXISTS \`${DEFAULTS.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally {
    await basePool.end();
  }
};

const runSqliteStatements = (db, statements) => {
  statements.forEach((statement) => {
    db.prepare(statement).run();
  });
};

const normalizeSqliteValue = (value) => {
  if (value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value) || (value && typeof value === "object" && !Buffer.isBuffer(value))) {
    return JSON.stringify(value);
  }

  return value;
};

const normalizeSqliteParams = (params = {}) =>
  Object.fromEntries(Object.entries(params).map(([key, value]) => [key, normalizeSqliteValue(value)]));

const ensureSqliteDatabase = () => {
  const sqliteDir = path.dirname(DEFAULTS.sqlitePath);
  if (!fs.existsSync(sqliteDir)) {
    fs.mkdirSync(sqliteDir, { recursive: true });
  }
};

const executeSqlite = (executor, sql, params = {}) => {
  const statement = executor.prepare(sql);
  const normalizedParams = normalizeSqliteParams(params);

  if (statement.reader) {
    return statement.all(normalizedParams);
  }

  statement.run(normalizedParams);
  return [];
};

const connectDB = async () => {
  if (IS_SQLITE) {
    ensureSqliteDatabase();
    sqliteDb = new Database(DEFAULTS.sqlitePath);
    sqliteDb.pragma("journal_mode = WAL");
    sqliteDb.pragma("foreign_keys = ON");
    runSqliteStatements(sqliteDb, sqliteSchemaStatements);
    console.log(`SQLite connected: ${DEFAULTS.sqlitePath}`);
    return;
  }

  await ensureMysqlDatabase();
  pool = createBasePool(true);
  const connection = await pool.getConnection();

  try {
    await runMysqlSchemaStatements(connection);
    console.log("MySQL connected");
  } finally {
    connection.release();
  }
};

const disconnectDB = async () => {
  if (IS_SQLITE) {
    if (sqliteDb) {
      sqliteDb.close();
      sqliteDb = null;
    }
    return;
  }

  if (pool) {
    await pool.end();
    pool = null;
  }
};

const getPool = () => {
  if (IS_SQLITE) {
    if (!sqliteDb) {
      throw new Error("SQLite database is not initialized");
    }
    return sqliteDb;
  }

  if (!pool) {
    throw new Error("Database pool is not initialized");
  }

  return pool;
};

const query = async (sql, params = {}) => {
  if (IS_SQLITE) {
    return executeSqlite(getPool(), sql, params);
  }

  const [rows] = await getPool().execute(sql, params);
  return rows;
};

const withTransaction = async (handler) => {
  if (IS_SQLITE) {
    const db = getPool();
    const transaction = db.transaction(() => handler(db));
    return transaction();
  }

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
  if (IS_SQLITE) {
    return executeSqlite(connection, sql, params);
  }

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
