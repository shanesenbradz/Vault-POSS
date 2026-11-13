// server.js - VaultPOS local server. Pure Node.js (http + node:sqlite). No npm install required.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { db, hashPin, verifyPin, transaction, DB_PATH, DATA_DIR } = require('./db');

const PORT = Number(process.env.PORT) || 6969;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_PROFILES = 5;

const THEMES = ['girly', 'botanical', 'corporate'];
const MODES = ['light', 'dark'];
const ROLES = ['admin', 'staff'];
const EVENT_TYPES = ['delivery', 'shift', 'stocktake', 'general'];

// ---------- helpers ----------
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'no-referrer',
};

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendData(res, status, data, contentType, extraHeaders = {}) {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': contentType,
    'Content-Length': Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data),
    ...extraHeaders,
  });
  res.end(data);
}

function attachment(filename) {
  const safe = String(filename).replace(/[^A-Za-z0-9._-]/g, '_');
  return { 'Content-Disposition': `attachment; filename="${safe}"`, 'Cache-Control': 'no-store' };
}

function readBody(req, limit = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'Request body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJSON(req) {
  const raw = await readBody(req, 1024 * 1024);
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : {};
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

function str(v, max = 500) {
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, max);
}
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function int(v, fallback = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}
function money(n) { return Math.round(n * 100) / 100; }
function validPin(pin) { return typeof pin === 'string' && /^\d{4,6}$/.test(pin); }
function validColor(c) { return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c); }
function validDate(d) { return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d); }

// ---------- sessions / auth ----------
// The browser gets a random session token at login and sends it as
// "Authorization: Bearer <token>". Sessions live in the database so a server
// restart doesn't log everyone out.
const findSession = db.prepare(`
  SELECT p.id, p.name, p.role, p.color FROM sessions s
  JOIN profiles p ON p.id = s.profile_id
  WHERE s.token = ? AND p.active = 1
`);
const touchSession = db.prepare("UPDATE sessions SET last_seen = datetime('now','localtime') WHERE token = ?");

function getToken(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+([A-Za-z0-9_-]{20,})$/);
  return m ? m[1] : null;
}

function getProfile(req) {
  if (req._profile !== undefined) return req._profile;
  const token = getToken(req);
  const p = token ? findSession.get(token) || null : null;
  if (p) touchSession.run(token);
  req._profile = p ? { id: p.id, name: p.name, role: p.role, color: p.color } : null;
  return req._profile;
}

function requireLogin(req) {
  const p = getProfile(req);
  if (!p) throw new HttpError(401, 'Please log in again');
  return p;
}

function requireAdmin(req) {
  const p = requireLogin(req);
  if (p.role !== 'admin') throw new HttpError(403, 'Admin access required');
  return p;
}

// Same as requireAdmin, but also accepts admin credentials passed in the body
// (adminId/adminPin). Used by the login screen's "add profile" flow.
function requireAdminOrCredentials(req, body) {
  const p = getProfile(req);
  if (p && p.role === 'admin') return p;
  if (body && body.adminId && body.adminPin) {
    checkLockout(body.adminId);
    const a = db.prepare("SELECT * FROM profiles WHERE id = ? AND active = 1 AND role = 'admin'").get(int(body.adminId));
    if (a && verifyPin(str(body.adminPin, 10), a.pin_hash, a.pin_salt)) {
      clearFailures(a.id);
      return { id: a.id, name: a.name, role: a.role, color: a.color };
    }
    recordFailure(body.adminId);
  }
  throw new HttpError(403, 'Admin authorization required to add a profile');
}

// Simple PIN brute-force protection: 5 wrong PINs locks that profile for 60s,
// doubling on each further lockout (max 15 min). Resets on a correct PIN.
const failures = new Map(); // profileId -> { count, lockedUntil, lockouts }
function checkLockout(id) {
  const f = failures.get(String(id));
  if (f && f.lockedUntil > Date.now()) {
    const secs = Math.ceil((f.lockedUntil - Date.now()) / 1000);
    throw new HttpError(429, `Too many wrong PINs. Try again in ${secs}s.`);
  }
}
function recordFailure(id) {
  const key = String(id);
  const f = failures.get(key) || { count: 0, lockedUntil: 0, lockouts: 0 };
  f.count++;
  if (f.count >= 5) {
    f.lockouts++;
    f.lockedUntil = Date.now() + Math.min(60_000 * 2 ** (f.lockouts - 1), 15 * 60_000);
    f.count = 0;
  }
  failures.set(key, f);
}
function clearFailures(id) { failures.delete(String(id)); }

function activeAdminCount(excludeId) {
  return db.prepare("SELECT COUNT(*) c FROM profiles WHERE active = 1 AND role = 'admin' AND id != ?").get(excludeId ?? -1).c;
}

// ---------- CSV ----------
function csvEscape(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // Stop spreadsheet apps from treating a cell as a formula (CSV injection)
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCSV(rows, columns) {
  const header = columns.map(csvEscape).join(',');
  const lines = rows.map((r) => columns.map((c) => csvEscape(r[c])).join(','));
  return [header, ...lines].join('\r\n') + '\r\n';
}

function parseCSV(text) {
  text = text.replace(/^﻿/, ''); // strip Excel's BOM
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).filter((r) => r.some((x) => x.trim() !== '')).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = r[idx] !== undefined ? r[idx].trim() : ''; });
    return obj;
  });
}

function getSettings() {
  const s = {};
  db.prepare('SELECT key, value FROM settings').all().forEach((r) => (s[r.key] = r.value));
  return s;
}

function dateRange(query) {
  const from = validDate(query.get('from')) ? query.get('from') : '1970-01-01';
  const to = validDate(query.get('to')) ? query.get('to') : '2999-12-31';
  return { from, to };
}

function stripCost(item) {
  const { cost_price, ...rest } = item;
  return rest;
}

// ---------- static file serving ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJSON(res, 405, { error: 'Method not allowed' });
  const rel = pathname === '/' ? 'index.html' : pathname === '/favicon.ico' ? 'favicon.svg' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, rel);
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    return sendData(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback for unknown routes, but a real 404 for missing assets
      if (path.extname(rel)) return sendData(res, 404, 'Not found', 'text/plain; charset=utf-8');
      return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, data2) => {
        if (err2) sendData(res, 404, 'Not found', 'text/plain; charset=utf-8');
        else sendData(res, 200, data2, MIME['.html'], { 'Cache-Control': 'no-cache' });
      });
    }
    const ext = path.extname(filePath).toLowerCase();
    sendData(res, 200, data, MIME[ext] || 'application/octet-stream', { 'Cache-Control': 'no-cache' });
  });
}

// ---------- prepared statements used in several places ----------
const itemsWithSales = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?');
function withItems(sales) {
  return sales.map((s) => ({ ...s, items: itemsWithSales.all(s.id).map(({ item_name, qty, unit_price, unit_cost }) => ({ item_name, qty, unit_price, unit_cost })) }));
}

// ---------- routes ----------
async function handleApi(req, res, pathname, query) {
  const method = req.method;
  let m;

  // ===== PROFILES / AUTH =====
  if (pathname === '/api/profiles' && method === 'GET') {
    const rows = db.prepare('SELECT id, name, role, color FROM profiles WHERE active = 1 ORDER BY id').all();
    return sendJSON(res, 200, rows);
  }

  if (pathname === '/api/login' && method === 'POST') {
    const { id, pin } = await readJSON(req);
    checkLockout(id);
    const p = db.prepare('SELECT * FROM profiles WHERE id = ? AND active = 1').get(int(id));
    if (!p || !verifyPin(str(pin, 10), p.pin_hash, p.pin_salt)) {
      recordFailure(id);
      throw new HttpError(401, 'Incorrect PIN');
    }
    clearFailures(p.id);
    const token = crypto.randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO sessions (token, profile_id) VALUES (?, ?)').run(token, p.id);
    return sendJSON(res, 200, { token, profile: { id: p.id, name: p.name, role: p.role, color: p.color } });
  }

  if (pathname === '/api/logout' && method === 'POST') {
    const token = getToken(req);
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return sendJSON(res, 200, { ok: true });
  }

  if (pathname === '/api/session' && method === 'GET') {
    return sendJSON(res, 200, requireLogin(req));
  }

  if (pathname === '/api/profiles' && method === 'POST') {
    const body = await readJSON(req);
    requireAdminOrCredentials(req, body);
    const name = str(body.name, 40);
    const pin = str(body.pin, 10);
    const role = body.role;
    if (!name) throw new HttpError(400, 'Name is required');
    if (!ROLES.includes(role)) throw new HttpError(400, 'Role must be admin or staff');
    if (!validPin(pin)) throw new HttpError(400, 'PIN must be 4 to 6 digits');
    const activeCount = db.prepare('SELECT COUNT(*) c FROM profiles WHERE active = 1').get().c;
    if (activeCount >= MAX_PROFILES) throw new HttpError(400, `Maximum of ${MAX_PROFILES} profiles reached`);
    const { hash, salt } = hashPin(pin);
    const info = db.prepare('INSERT INTO profiles (name, pin_hash, pin_salt, role, color) VALUES (?,?,?,?,?)')
      .run(name, hash, salt, role, validColor(body.color) ? body.color : '#8a7fdb');
    return sendJSON(res, 201, { id: Number(info.lastInsertRowid) });
  }

  if ((m = pathname.match(/^\/api\/profiles\/(\d+)$/)) && method === 'PUT') {
    const admin = requireAdmin(req);
    const pid = Number(m[1]);
    const body = await readJSON(req);
    const existing = db.prepare('SELECT * FROM profiles WHERE id = ? AND active = 1').get(pid);
    if (!existing) throw new HttpError(404, 'Profile not found');
    const name = body.name !== undefined ? str(body.name, 40) : existing.name;
    const role = body.role !== undefined ? body.role : existing.role;
    if (!name) throw new HttpError(400, 'Name is required');
    if (!ROLES.includes(role)) throw new HttpError(400, 'Role must be admin or staff');
    if (existing.role === 'admin' && role !== 'admin' && activeAdminCount(pid) === 0) {
      throw new HttpError(400, 'At least one admin profile is required');
    }
    let pin_hash = existing.pin_hash, pin_salt = existing.pin_salt;
    if (body.pin) {
      const pin = str(body.pin, 10);
      if (!validPin(pin)) throw new HttpError(400, 'PIN must be 4 to 6 digits');
      ({ hash: pin_hash, salt: pin_salt } = hashPin(pin));
    }
    const color = validColor(body.color) ? body.color : existing.color;
    db.prepare('UPDATE profiles SET name=?, role=?, color=?, pin_hash=?, pin_salt=? WHERE id=?')
      .run(name, role, color, pin_hash, pin_salt, pid);
    // PIN or role changed: sign that profile out everywhere else
    if (body.pin || role !== existing.role) {
      db.prepare('DELETE FROM sessions WHERE profile_id = ? AND token != ?').run(pid, getToken(req) || '');
    }
    const self = pid === admin.id ? { id: pid, name, role, color } : null;
    return sendJSON(res, 200, { ok: true, self });
  }

  if ((m = pathname.match(/^\/api\/profiles\/(\d+)$/)) && method === 'DELETE') {
    const admin = requireAdmin(req);
    const pid = Number(m[1]);
    if (pid === admin.id) throw new HttpError(400, 'You cannot remove the profile you are logged in with');
    db.prepare('UPDATE profiles SET active = 0 WHERE id = ?').run(pid);
    db.prepare('DELETE FROM sessions WHERE profile_id = ?').run(pid);
    return sendJSON(res, 200, { ok: true });
  }

  // ===== SETTINGS (read is public so the login screen can be themed) =====
  if (pathname === '/api/settings' && method === 'GET') {
    return sendJSON(res, 200, getSettings());
  }

  // Everything below needs a logged-in profile
  const profile = requireLogin(req);
  const isAdmin = profile.role === 'admin';

  if (pathname === '/api/settings' && method === 'PUT') {
    requireAdmin(req);
    const b = await readJSON(req);
    const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    if (b.shop_name !== undefined) {
      const n = str(b.shop_name, 60);
      if (!n) throw new HttpError(400, 'Shop name cannot be empty');
      upsert.run('shop_name', n);
    }
    if (b.theme !== undefined) {
      if (!THEMES.includes(b.theme)) throw new HttpError(400, 'Unknown theme');
      upsert.run('theme', b.theme);
    }
    if (b.mode !== undefined) {
      if (!MODES.includes(b.mode)) throw new HttpError(400, 'Unknown mode');
      upsert.run('mode', b.mode);
    }
    return sendJSON(res, 200, getSettings());
  }

  // Light/dark mode can be changed by any logged-in profile
  if (pathname === '/api/settings/mode' && method === 'PUT') {
    const b = await readJSON(req);
    if (!MODES.includes(b.mode)) throw new HttpError(400, 'Unknown mode');
    db.prepare("INSERT INTO settings (key, value) VALUES ('mode', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(b.mode);
    return sendJSON(res, 200, getSettings());
  }

  // ===== ITEMS =====
  if (pathname === '/api/items' && method === 'GET') {
    const rows = db.prepare('SELECT * FROM items WHERE archived = 0 ORDER BY name COLLATE NOCASE').all();
    return sendJSON(res, 200, isAdmin ? rows : rows.map(stripCost));
  }

  if (pathname === '/api/items/low-stock' && method === 'GET') {
    const rows = db.prepare('SELECT * FROM items WHERE archived = 0 AND stock <= low_stock_threshold ORDER BY stock ASC').all();
    return sendJSON(res, 200, isAdmin ? rows : rows.map(stripCost));
  }

  if (pathname === '/api/items/export.csv' && method === 'GET') {
    const rows = db.prepare('SELECT * FROM items WHERE archived = 0 ORDER BY name COLLATE NOCASE').all();
    const cols = ['name', 'category', 'sku', 'barcode', 'cost_price', 'sell_price', 'stock', 'low_stock_threshold', 'variant_label'];
    const csv = toCSV(rows, isAdmin ? cols : cols.filter((c) => c !== 'cost_price'));
    return sendData(res, 200, '﻿' + csv, 'text/csv; charset=utf-8', attachment('items_export.csv'));
  }

  if (pathname === '/api/items/import' && method === 'POST') {
    requireAdmin(req);
    const records = parseCSV(await readBody(req));
    if (!records.length) throw new HttpError(400, 'No rows found in that CSV');
    const insert = db.prepare(`
      INSERT INTO items (sku, barcode, name, category, cost_price, sell_price, stock, low_stock_threshold, variant_label)
      VALUES (?,?,?,?,?,?,?,?,?)
    `);
    const findByBarcode = db.prepare("SELECT id FROM items WHERE barcode = ? AND barcode != '' AND archived = 0 LIMIT 1");
    const findBySku = db.prepare("SELECT id FROM items WHERE sku = ? AND sku != '' AND archived = 0 LIMIT 1");
    const update = db.prepare(`
      UPDATE items SET name=?, category=?, sku=?, barcode=?, cost_price=?, sell_price=?, stock=?, low_stock_threshold=?,
      variant_label=?, updated_at=datetime('now','localtime') WHERE id=?
    `);
    let created = 0, updated = 0, skipped = 0;
    transaction(() => {
      for (const r of records) {
        const rec = {
          sku: str(r.sku, 64), barcode: str(r.barcode, 64), name: str(r.name, 120),
          category: str(r.category, 60) || 'General',
          cost_price: Math.max(0, money(num(r.cost_price))), sell_price: Math.max(0, money(num(r.sell_price))),
          stock: Math.max(0, int(r.stock)), low_stock_threshold: Math.max(0, int(r.low_stock_threshold, 5)),
          variant_label: str(r.variant_label, 40) || null,
        };
        const existing = (rec.barcode && findByBarcode.get(rec.barcode)) || (rec.sku && findBySku.get(rec.sku));
        if (!rec.name && !existing) { skipped++; continue; }
        if (existing) {
          const cur = db.prepare('SELECT * FROM items WHERE id = ?').get(existing.id);
          update.run(rec.name || cur.name, rec.category, rec.sku || cur.sku, rec.barcode || cur.barcode,
            r.cost_price !== undefined && r.cost_price !== '' ? rec.cost_price : cur.cost_price,
            r.sell_price !== undefined && r.sell_price !== '' ? rec.sell_price : cur.sell_price,
            r.stock !== undefined && r.stock !== '' ? rec.stock : cur.stock,
            r.low_stock_threshold !== undefined && r.low_stock_threshold !== '' ? rec.low_stock_threshold : cur.low_stock_threshold,
            rec.variant_label ?? cur.variant_label, existing.id);
          updated++;
        } else {
          insert.run(rec.sku, rec.barcode, rec.name, rec.category, rec.cost_price, rec.sell_price, rec.stock, rec.low_stock_threshold, rec.variant_label);
          created++;
        }
      }
    });
    return sendJSON(res, 200, { created, updated, skipped });
  }

  if (pathname === '/api/items' && method === 'POST') {
    requireAdmin(req);
    const b = await readJSON(req);
    const name = str(b.name, 120);
    if (!name) throw new HttpError(400, 'Name is required');
    const info = db.prepare(`
      INSERT INTO items (sku, barcode, name, category, cost_price, sell_price, stock, low_stock_threshold, variant_of, variant_label)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(str(b.sku, 64), str(b.barcode, 64), name, str(b.category, 60) || 'General',
      Math.max(0, money(num(b.cost_price))), Math.max(0, money(num(b.sell_price))),
      Math.max(0, int(b.stock)), Math.max(0, int(b.low_stock_threshold, 5)),
      b.variant_of ? int(b.variant_of) : null, str(b.variant_label, 40) || null);
    return sendJSON(res, 201, { id: Number(info.lastInsertRowid) });
  }

  if ((m = pathname.match(/^\/api\/items\/(\d+)$/)) && method === 'PUT') {
    requireAdmin(req);
    const id = Number(m[1]);
    const e = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    if (!e) throw new HttpError(404, 'Item not found');
    const b = await readJSON(req);
    const name = b.name !== undefined ? str(b.name, 120) : e.name;
    if (!name) throw new HttpError(400, 'Name is required');
    db.prepare(`
      UPDATE items SET sku=?, barcode=?, name=?, category=?, cost_price=?, sell_price=?, stock=?, low_stock_threshold=?, variant_label=?, updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(
      b.sku !== undefined ? str(b.sku, 64) : e.sku,
      b.barcode !== undefined ? str(b.barcode, 64) : e.barcode,
      name,
      b.category !== undefined ? (str(b.category, 60) || 'General') : e.category,
      b.cost_price !== undefined ? Math.max(0, money(num(b.cost_price))) : e.cost_price,
      b.sell_price !== undefined ? Math.max(0, money(num(b.sell_price))) : e.sell_price,
      b.stock !== undefined ? Math.max(0, int(b.stock)) : e.stock,
      b.low_stock_threshold !== undefined ? Math.max(0, int(b.low_stock_threshold, 5)) : e.low_stock_threshold,
      b.variant_label !== undefined ? (str(b.variant_label, 40) || null) : e.variant_label,
      id
    );
    return sendJSON(res, 200, { ok: true });
  }

  if ((m = pathname.match(/^\/api\/items\/(\d+)$/)) && method === 'DELETE') {
    requireAdmin(req);
    db.prepare("UPDATE items SET archived = 1, updated_at = datetime('now','localtime') WHERE id = ?").run(Number(m[1]));
    return sendJSON(res, 200, { ok: true });
  }

  // ===== ITEM NOTES =====
  if ((m = pathname.match(/^\/api\/items\/(\d+)\/notes$/)) && method === 'GET') {
    return sendJSON(res, 200, db.prepare('SELECT * FROM item_notes WHERE item_id = ? ORDER BY id DESC').all(Number(m[1])));
  }

  if ((m = pathname.match(/^\/api\/items\/(\d+)\/notes$/)) && method === 'POST') {
    const b = await readJSON(req);
    const text = str(b.text, 2000);
    if (!text) throw new HttpError(400, 'Note text is required');
    if (!db.prepare('SELECT id FROM items WHERE id = ?').get(Number(m[1]))) throw new HttpError(404, 'Item not found');
    const info = db.prepare('INSERT INTO item_notes (item_id, profile_name, text) VALUES (?,?,?)').run(Number(m[1]), profile.name, text);
    return sendJSON(res, 201, { id: Number(info.lastInsertRowid) });
  }

  if ((m = pathname.match(/^\/api\/notes\/(\d+)$/)) && method === 'DELETE') {
    db.prepare('DELETE FROM item_notes WHERE id = ?').run(Number(m[1]));
    return sendJSON(res, 200, { ok: true });
  }

  // ===== CUSTOMERS / CLIENTS =====
  if (pathname === '/api/customers' && method === 'GET') {
    const rows = db.prepare(`
      SELECT c.*, COUNT(s.id) AS visit_count, COALESCE(SUM(s.total), 0) AS lifetime_spend
      FROM customers c LEFT JOIN sales s ON s.customer_id = c.id
      GROUP BY c.id ORDER BY c.name COLLATE NOCASE
    `).all();
    return sendJSON(res, 200, rows);
  }

  if (pathname === '/api/customers' && method === 'POST') {
    const b = await readJSON(req);
    const name = str(b.name, 100);
    if (!name) throw new HttpError(400, 'Name is required');
    const info = db.prepare('INSERT INTO customers (name, phone, email, notes) VALUES (?,?,?,?)')
      .run(name, str(b.phone, 40), str(b.email, 120), str(b.notes, 2000));
    return sendJSON(res, 201, { id: Number(info.lastInsertRowid) });
  }

  if ((m = pathname.match(/^\/api\/customers\/(\d+)$/)) && method === 'PUT') {
    const id = Number(m[1]);
    const e = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!e) throw new HttpError(404, 'Client not found');
    const b = await readJSON(req);
    const name = b.name !== undefined ? str(b.name, 100) : e.name;
    if (!name) throw new HttpError(400, 'Name is required');
    transaction(() => {
      db.prepare('UPDATE customers SET name=?, phone=?, email=?, notes=? WHERE id=?').run(
        name,
        b.phone !== undefined ? str(b.phone, 40) : e.phone,
        b.email !== undefined ? str(b.email, 120) : e.email,
        b.notes !== undefined ? str(b.notes, 2000) : e.notes,
        id);
      // keep the denormalized customer_name on past sales in sync
      db.prepare('UPDATE sales SET customer_name = ? WHERE customer_id = ?').run(name, id);
    });
    return sendJSON(res, 200, { ok: true });
  }

  if ((m = pathname.match(/^\/api\/customers\/(\d+)$/)) && method === 'DELETE') {
    requireAdmin(req);
    const id = Number(m[1]);
    transaction(() => {
      // Past sales keep the client's name as text but drop the link
      db.prepare('UPDATE sales SET customer_id = NULL WHERE customer_id = ?').run(id);
      db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    });
    return sendJSON(res, 200, { ok: true });
  }

  if ((m = pathname.match(/^\/api\/customers\/(\d+)\/profile$/)) && method === 'GET') {
    const id = Number(m[1]);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!customer) throw new HttpError(404, 'Client not found');
    const sales = withItems(db.prepare('SELECT * FROM sales WHERE customer_id = ? ORDER BY id DESC').all(id));
    const lifetimeSpend = money(sales.reduce((a, s) => a + s.total, 0));
    const itemCounts = {};
    sales.forEach((s) => s.items.forEach((it) => { itemCounts[it.item_name] = (itemCounts[it.item_name] || 0) + it.qty; }));
    const favoriteItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty }));
    if (!isAdmin) sales.forEach((s) => { delete s.profit; s.items.forEach((it) => delete it.unit_cost); });
    return sendJSON(res, 200, { customer, sales, visitCount: sales.length, lifetimeSpend, favoriteItems });
  }

  // ===== SALES / CHECKOUT =====
  if (pathname === '/api/sales' && method === 'POST') {
    const b = await readJSON(req);
    if (!Array.isArray(b.items) || !b.items.length) throw new HttpError(400, 'No items in sale');

    // Merge duplicate lines, then price everything from the database, never the browser.
    const qtyById = new Map();
    for (const it of b.items) {
      const id = int(it.itemId), qty = int(it.qty);
      if (!id || qty <= 0 || qty > 100000) throw new HttpError(400, 'Invalid item or quantity in cart');
      qtyById.set(id, (qtyById.get(id) || 0) + qty);
    }

    const sale = transaction(() => {
      const getItem = db.prepare('SELECT * FROM items WHERE id = ? AND archived = 0');
      const lines = [];
      for (const [id, qty] of qtyById) {
        const item = getItem.get(id);
        if (!item) throw new HttpError(400, 'An item in the cart no longer exists');
        if (item.stock < qty) throw new HttpError(409, `Only ${item.stock} of "${item.name}" left in stock`);
        const label = item.variant_label ? `${item.name} (${item.variant_label})` : item.name;
        lines.push({ itemId: id, name: label, qty, unitPrice: item.sell_price, unitCost: item.cost_price || 0 });
      }
      let customerId = null, customerName = null;
      if (b.customerId) {
        const c = db.prepare('SELECT id, name FROM customers WHERE id = ?').get(int(b.customerId));
        if (!c) throw new HttpError(400, 'Selected client not found');
        customerId = c.id; customerName = c.name;
      }
      const total = money(lines.reduce((a, l) => a + l.qty * l.unitPrice, 0));
      const profit = money(lines.reduce((a, l) => a + l.qty * (l.unitPrice - l.unitCost), 0));
      const info = db.prepare('INSERT INTO sales (profile_id, profile_name, customer_id, customer_name, total, profit) VALUES (?,?,?,?,?,?)')
        .run(profile.id, profile.name, customerId, customerName, total, profit);
      const saleId = Number(info.lastInsertRowid);
      const insertLine = db.prepare('INSERT INTO sale_items (sale_id, item_id, item_name, qty, unit_price, unit_cost) VALUES (?,?,?,?,?,?)');
      const decrement = db.prepare("UPDATE items SET stock = stock - ?, updated_at = datetime('now','localtime') WHERE id = ?");
      for (const l of lines) {
        insertLine.run(saleId, l.itemId, l.name, l.qty, l.unitPrice, l.unitCost);
        decrement.run(l.qty, l.itemId);
      }
      const created_at = db.prepare('SELECT created_at FROM sales WHERE id = ?').get(saleId).created_at;
      return { id: saleId, total, profit, customerName, created_at, lines };
    });
    if (!isAdmin) { delete sale.profit; sale.lines.forEach((l) => delete l.unitCost); }
    return sendJSON(res, 201, sale);
  }

  if (pathname === '/api/sales' && method === 'GET') {
    const { from, to } = dateRange(query);
    const limit = Math.min(Math.max(int(query.get('limit'), 200), 1), 2000);
    const sales = withItems(db.prepare('SELECT * FROM sales WHERE date(created_at) BETWEEN date(?) AND date(?) ORDER BY id DESC LIMIT ?').all(from, to, limit));
    if (!isAdmin) sales.forEach((s) => { delete s.profit; s.items.forEach((it) => delete it.unit_cost); });
    return sendJSON(res, 200, sales);
  }

  // ===== REPORTS (admin) =====
  if (pathname === '/api/reports' && method === 'GET') {
    requireAdmin(req);
    const { from, to } = dateRange(query);
    const totals = db.prepare(`
      SELECT COUNT(*) AS saleCount, COALESCE(SUM(total),0) AS totalRevenue, COALESCE(SUM(profit),0) AS totalProfit
      FROM sales WHERE date(created_at) BETWEEN date(?) AND date(?)
    `).get(from, to);
    const topItems = db.prepare(`
      SELECT si.item_name, SUM(si.qty) AS qty_sold, SUM(si.qty * si.unit_price) AS revenue,
             SUM(si.qty * (si.unit_price - si.unit_cost)) AS profit
      FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE date(s.created_at) BETWEEN date(?) AND date(?)
      GROUP BY si.item_name ORDER BY qty_sold DESC LIMIT 10
    `).all(from, to);
    return sendJSON(res, 200, { from, to, saleCount: totals.saleCount, totalRevenue: money(totals.totalRevenue), totalProfit: money(totals.totalProfit), topItems });
  }

  if (pathname === '/api/reports/export.csv' && method === 'GET') {
    requireAdmin(req);
    const { from, to } = dateRange(query);
    const rows = db.prepare(`
      SELECT s.id AS sale_id, s.created_at, s.profile_name, s.customer_name, si.item_name, si.qty, si.unit_price, si.unit_cost,
             ROUND(si.qty * si.unit_price, 2) AS line_total
      FROM sales s JOIN sale_items si ON si.sale_id = s.id
      WHERE date(s.created_at) BETWEEN date(?) AND date(?)
      ORDER BY s.id
    `).all(from, to);
    const csv = toCSV(rows, ['sale_id', 'created_at', 'profile_name', 'customer_name', 'item_name', 'qty', 'unit_price', 'unit_cost', 'line_total']);
    return sendData(res, 200, '﻿' + csv, 'text/csv; charset=utf-8', attachment(`report_${from}_to_${to}.csv`));
  }

  // ===== TODOS =====
  if (pathname === '/api/todos' && method === 'GET') {
    const shop = db.prepare("SELECT * FROM todos WHERE scope = 'shop' ORDER BY done, id DESC").all();
    const personal = db.prepare("SELECT * FROM todos WHERE scope = 'personal' AND profile_id = ? ORDER BY done, id DESC").all(profile.id);
    return sendJSON(res, 200, { shop, personal });
  }

  if (pathname === '/api/todos' && method === 'POST') {
    const b = await readJSON(req);
    const text = str(b.text, 500);
    if (!text) throw new HttpError(400, 'Task text is required');
    const scope = b.scope === 'shop' ? 'shop' : 'personal';
    const info = db.prepare('INSERT INTO todos (scope, profile_id, text) VALUES (?,?,?)').run(scope, scope === 'personal' ? profile.id : null, text);
    return sendJSON(res, 201, { id: Number(info.lastInsertRowid) });
  }

  if ((m = pathname.match(/^\/api\/todos\/(\d+)$/)) && (method === 'PUT' || method === 'DELETE')) {
    const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(Number(m[1]));
    if (!todo || (todo.scope === 'personal' && todo.profile_id !== profile.id)) throw new HttpError(404, 'Task not found');
    if (method === 'PUT') {
      const b = await readJSON(req);
      db.prepare('UPDATE todos SET done = ? WHERE id = ?').run(b.done ? 1 : 0, todo.id);
    } else {
      db.prepare('DELETE FROM todos WHERE id = ?').run(todo.id);
    }
    return sendJSON(res, 200, { ok: true });
  }

  // ===== CALENDAR =====
  if (pathname === '/api/calendar' && method === 'GET') {
    return sendJSON(res, 200, db.prepare('SELECT * FROM calendar_events ORDER BY event_date, id').all());
  }

  if (pathname === '/api/calendar' && method === 'POST') {
    const b = await readJSON(req);
    const title = str(b.title, 120);
    if (!title || !validDate(b.event_date)) throw new HttpError(400, 'Title and a valid date are required');
    const type = EVENT_TYPES.includes(b.type) ? b.type : 'general';
    const info = db.prepare('INSERT INTO calendar_events (title, type, event_date, note) VALUES (?,?,?,?)').run(title, type, b.event_date, str(b.note, 1000));
    return sendJSON(res, 201, { id: Number(info.lastInsertRowid) });
  }

  if ((m = pathname.match(/^\/api\/calendar\/(\d+)$/)) && method === 'DELETE') {
    db.prepare('DELETE FROM calendar_events WHERE id = ?').run(Number(m[1]));
    return sendJSON(res, 200, { ok: true });
  }

  // ===== VAULT EXPORT / BACKUP (admin) =====
  if (pathname === '/api/vault/export.json' && method === 'GET') {
    requireAdmin(req);
    const dump = {
      app: 'VaultPOS',
      exported_at: new Date().toISOString(),
      profiles: db.prepare('SELECT id, name, role, color, active, created_at FROM profiles').all(),
      customers: db.prepare('SELECT * FROM customers').all(),
      items: db.prepare('SELECT * FROM items').all(),
      sales: db.prepare('SELECT * FROM sales').all(),
      sale_items: db.prepare('SELECT * FROM sale_items').all(),
      todos: db.prepare('SELECT * FROM todos').all(),
      item_notes: db.prepare('SELECT * FROM item_notes').all(),
      calendar_events: db.prepare('SELECT * FROM calendar_events').all(),
      settings: getSettings(),
    };
    return sendData(res, 200, JSON.stringify(dump, null, 2), 'application/json; charset=utf-8', attachment(`vault_backup_${Date.now()}.json`));
  }

  if (pathname === '/api/vault/export.db' && method === 'GET') {
    requireAdmin(req);
    // VACUUM INTO writes a clean, consistent single-file copy (no -wal/-shm needed).
    const tmp = path.join(DATA_DIR, `.export-${process.pid}-${Date.now()}.sqlite`);
    try {
      db.prepare('VACUUM INTO ?').run(tmp);
      const data = fs.readFileSync(tmp);
      return sendData(res, 200, data, 'application/octet-stream', attachment(`vault_${Date.now()}.db`));
    } finally {
      fs.rm(tmp, { force: true }, () => {});
    }
  }

  throw new HttpError(404, 'Not found');
}

async function handler(req, res) {
  try {
    const parsed = new URL(req.url, 'http://localhost');
    let pathname;
    try { pathname = decodeURIComponent(parsed.pathname); } catch { throw new HttpError(400, 'Bad URL'); }
    if (pathname.includes('\0')) throw new HttpError(400, 'Bad URL');
    if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname);
    await handleApi(req, res, pathname, parsed.searchParams);
  } catch (err) {
    if (res.headersSent) { res.destroy(); return; }
    if (err instanceof HttpError) return sendJSON(res, err.status, { error: err.message });
    console.error(err);
    return sendJSON(res, 500, { error: 'Server error: ' + (err.message || 'unknown') });
  }
}

function lanAddresses() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === 'IPv4' && !n.internal) out.push(n.address);
    }
  }
  return out;
}

function usingDefaultPin() {
  const p = db.prepare('SELECT pin_hash, pin_salt FROM profiles WHERE id = 1 AND active = 1').get();
  return !!(p && verifyPin('0000', p.pin_hash, p.pin_salt));
}

// Start the HTTP server. Used by the command line (below) and by the desktop app.
// Resolves with { server, port, host }. If fallbackPort is true and the port is
// taken, a free port is picked instead of failing.
function start({ port = PORT, host = HOST, fallbackPort = false } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => { handler(req, res); });
    const onError = (err) => {
      if (err.code === 'EADDRINUSE' && fallbackPort && port !== 0) {
        server.removeListener('error', onError);
        start({ port: 0, host, fallbackPort: false }).then(resolve, reject);
      } else {
        reject(err);
      }
    };
    server.once('error', onError);
    server.listen(port, host, () => {
      server.removeListener('error', onError);
      resolve({ server, port: server.address().port, host });
    });
  });
}

function close() {
  try { db.close(); } catch (_) {}
}

module.exports = { start, close, lanAddresses, usingDefaultPin, db, DB_PATH, DATA_DIR };

// ---------- command line: node server.js ----------
if (require.main === module) {
  start().then(({ server, port, host }) => {
    console.log('');
    console.log('  VaultPOS is running');
    console.log('  ------------------------------------------');
    console.log(`  On this computer:   http://127.0.0.1:${port}`);
    if (host === '0.0.0.0') lanAddresses().forEach((ip) => console.log(`  On your Wi-Fi/LAN:  http://${ip}:${port}`));
    console.log('  ------------------------------------------');
    if (usingDefaultPin()) {
      console.log('  Default login -> Profile: Owner   PIN: 0000');
      console.log('  (Change this PIN now from Settings > Profiles & staff)');
    }
    console.log('  Keep this window open while you use VaultPOS.');
    console.log('');
    const shutdown = () => { server.close(); close(); process.exit(0); };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }).catch((err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n  Port ${PORT} is already in use. Is VaultPOS already running in another window?`);
      console.error('  Close it, or start on another port, e.g.  PORT=7070 node server.js\n');
    } else {
      console.error(err);
    }
    process.exit(1);
  });
}
