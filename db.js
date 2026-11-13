// db.js - Embedded SQLite layer using Node's built-in node:sqlite module.
// No native compilation, no npm dependency - works identically on Windows & Linux.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (e) {
  console.error('');
  console.error('  VaultPOS needs Node.js 22.13 or newer (for the built-in SQLite module).');
  console.error(`  You are running Node.js ${process.versions.node}.`);
  console.error('  Download the current LTS installer from https://nodejs.org and try again.');
  console.error('');
  process.exit(1);
}

const DATA_DIR = process.env.VAULTPOS_DATA_DIR
  ? path.resolve(process.env.VAULTPOS_DATA_DIR)
  : path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'vault.sqlite');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','staff')),
  color TEXT DEFAULT '#8a7fdb',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  profile_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  last_seen TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY(profile_id) REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT,
  barcode TEXT,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  cost_price REAL DEFAULT 0,
  sell_price REAL NOT NULL DEFAULT 0,
  stock INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  variant_of INTEGER,
  variant_label TEXT,
  archived INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY(variant_of) REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER,
  profile_name TEXT,
  customer_id INTEGER,
  customer_name TEXT,
  total REAL NOT NULL,
  profit REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY(customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  item_id INTEGER,
  item_name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  unit_cost REAL NOT NULL,
  FOREIGN KEY(sale_id) REFERENCES sales(id)
);

CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL CHECK(scope IN ('personal','shop')),
  profile_id INTEGER,
  text TEXT NOT NULL,
  done INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS item_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  profile_name TEXT,
  text TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY(item_id) REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'general',
  event_date TEXT NOT NULL,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

// Lightweight migration: if this database was created before the customers feature
// existed, the sales table won't have customer_id/customer_name columns yet.
const salesColumns = db.prepare('PRAGMA table_info(sales)').all().map((c) => c.name);
if (!salesColumns.includes('customer_id')) {
  db.exec('ALTER TABLE sales ADD COLUMN customer_id INTEGER;');
}
if (!salesColumns.includes('customer_name')) {
  db.exec('ALTER TABLE sales ADD COLUMN customer_name TEXT;');
}

// Indexes come after migrations so older databases have the columns first
db.exec(`
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_profile ON sessions(profile_id);
`);

function hashPin(pin, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pin), salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPin(pin, hash, salt) {
  if (pin === undefined || pin === null || !hash || !salt) return false;
  const test = crypto.scryptSync(String(pin), salt, 64);
  const stored = Buffer.from(hash, 'hex');
  if (stored.length !== test.length) return false;
  return crypto.timingSafeEqual(test, stored);
}

// Run fn inside a transaction; rolls back on any thrown error.
function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_) { /* already rolled back */ }
    throw e;
  }
}

// Seed a default admin profile and settings on first run
const count = db.prepare('SELECT COUNT(*) AS c FROM profiles').get().c;
if (count === 0) {
  const { hash, salt } = hashPin('0000');
  db.prepare('INSERT INTO profiles (name, pin_hash, pin_salt, role, color) VALUES (?,?,?,?,?)')
    .run('Owner', hash, salt, 'admin', '#8a7fdb');
}
const seedSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
seedSetting.run('theme', 'botanical');
seedSetting.run('mode', 'light');
seedSetting.run('shop_name', 'My Shop');

// Sessions older than 30 days are dropped on startup
db.prepare("DELETE FROM sessions WHERE last_seen < datetime('now','localtime','-30 days')").run();

module.exports = { db, hashPin, verifyPin, transaction, DB_PATH, DATA_DIR };
