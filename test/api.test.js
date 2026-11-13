// End-to-end API tests. Run with: npm test
// Starts a real server on a random port against a throwaway data folder.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

let proc, base, dataDir;

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

async function call(method, p, { token, body, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined && !raw) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + p, { method, headers, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  return { status: res.status, data, headers: res.headers };
}

async function login(id, pin) {
  const r = await call('POST', '/api/login', { body: { id, pin } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data.token;
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultpos-test-'));
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  proc = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', VAULTPOS_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    proc.stdout.on('data', (d) => { if (String(d).includes('VaultPOS is running')) resolve(); });
    proc.on('exit', (c) => reject(new Error('server exited ' + c)));
  });
});

after(() => {
  proc.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

let admin, staff, itemId;

test('default owner can log in with 0000, wrong PIN is rejected', async () => {
  const bad = await call('POST', '/api/login', { body: { id: 1, pin: '1234' } });
  assert.equal(bad.status, 401);
  admin = await login(1, '0000');
  const s = await call('GET', '/api/session', { token: admin });
  assert.equal(s.data.role, 'admin');
});

test('the old X-Profile-Id header no longer grants access', async () => {
  const r = await fetch(base + '/api/vault/export.json', { headers: { 'X-Profile-Id': '1' } });
  assert.equal(r.status, 401);
  const r2 = await call('GET', '/api/customers');
  assert.equal(r2.status, 401);
});

test('profile validation: bad PIN, bad role, and creating a 6-digit staff PIN', async () => {
  assert.equal((await call('POST', '/api/profiles', { token: admin, body: { name: 'X', pin: '12', role: 'staff' } })).status, 400);
  assert.equal((await call('POST', '/api/profiles', { token: admin, body: { name: 'X', pin: '1234', role: 'boss' } })).status, 400);
  const r = await call('POST', '/api/profiles', { token: admin, body: { name: 'Cashier', pin: '123456', role: 'staff', color: 'red;x' } });
  assert.equal(r.status, 201);
  staff = await login(r.data.id, '123456');
});

test('cannot demote the last admin', async () => {
  const r = await call('PUT', '/api/profiles/1', { token: admin, body: { role: 'staff' } });
  assert.equal(r.status, 400);
});

test('admin can add items, staff cannot, staff never sees cost price', async () => {
  const r = await call('POST', '/api/items', { token: admin, body: { name: 'Soap', sku: 'S1', barcode: '111', cost_price: 2, sell_price: 5, stock: 3 } });
  assert.equal(r.status, 201);
  itemId = r.data.id;
  assert.equal((await call('POST', '/api/items', { token: staff, body: { name: 'Nope' } })).status, 403);
  const items = await call('GET', '/api/items', { token: staff });
  assert.equal(items.data[0].cost_price, undefined);
  const csv = await call('GET', '/api/items/export.csv', { token: staff });
  assert.ok(!csv.data.includes('cost_price'));
});

test('sales are priced by the server, not the browser, and stock is enforced', async () => {
  const c = await call('POST', '/api/customers', { token: staff, body: { name: 'Jane' } });
  const sale = await call('POST', '/api/sales', { token: staff, body: { items: [{ itemId, qty: 2, unitPrice: 0.01, unitCost: 999 }], customerId: c.data.id } });
  assert.equal(sale.status, 201, JSON.stringify(sale.data));
  assert.equal(sale.data.total, 10);
  assert.equal(sale.data.customerName, 'Jane');
  const over = await call('POST', '/api/sales', { token: staff, body: { items: [{ itemId, qty: 2 }] } });
  assert.equal(over.status, 409);
  const items = await call('GET', '/api/items', { token: admin });
  assert.equal(items.data.find((i) => i.id === itemId).stock, 1);
  const rep = await call('GET', '/api/reports', { token: admin });
  assert.equal(rep.data.saleCount, 1);
  assert.equal(rep.data.totalProfit, 6);
  const list = await call('GET', '/api/customers', { token: staff });
  assert.equal(list.data[0].visit_count, 1);
  assert.equal(list.data[0].lifetime_spend, 10);
});

test('reports and backups are admin-only and downloads work with a token', async () => {
  assert.equal((await call('GET', '/api/reports', { token: staff })).status, 403);
  const j = await call('GET', '/api/vault/export.json', { token: admin });
  assert.equal(j.status, 200);
  assert.ok(j.headers.get('content-disposition').includes('vault_backup_'));
  const dbr = await fetch(base + '/api/vault/export.db', { headers: { Authorization: 'Bearer ' + admin } });
  const buf = Buffer.from(await dbr.arrayBuffer());
  assert.equal(buf.subarray(0, 15).toString(), 'SQLite format 3');
});

test('CSV import handles an Excel BOM and updates by barcode', async () => {
  const csv = '﻿name,category,sku,barcode,cost_price,sell_price,stock,low_stock_threshold\r\nSoap Bar,Bath,S1,111,2,6,10,2\r\nShampoo,Bath,,222,3,8,4,1\r\n';
  const r = await call('POST', '/api/items/import', { token: admin, raw: csv });
  assert.deepEqual(r.data, { created: 1, updated: 1, skipped: 0 });
  const items = await call('GET', '/api/items', { token: admin });
  assert.equal(items.data.find((i) => i.id === itemId).sell_price, 6);
});

test('personal to-dos belong to their owner', async () => {
  const t = await call('POST', '/api/todos', { token: admin, body: { text: 'secret', scope: 'personal' } });
  assert.equal((await call('DELETE', '/api/todos/' + t.data.id, { token: staff })).status, 404);
  assert.equal((await call('DELETE', '/api/todos/' + t.data.id, { token: admin })).status, 200);
});

test('deleting a client keeps their sales', async () => {
  const list = await call('GET', '/api/customers', { token: admin });
  assert.equal((await call('DELETE', '/api/customers/' + list.data[0].id, { token: admin })).status, 200);
  const sales = await call('GET', '/api/sales', { token: admin });
  assert.equal(sales.data[0].customer_name, 'Jane');
  assert.equal(sales.data[0].customer_id, null);
});

test('malformed URLs and path traversal do not crash or leak files', async () => {
  assert.equal((await call('GET', '/%E0%A4%A')).status, 400);
  assert.equal((await call('GET', '/..%2f..%2fserver.js')).status, 403);
  assert.equal((await call('GET', '/api/session', { token: admin })).status, 200); // still alive
});

test('logout ends the session', async () => {
  await call('POST', '/api/logout', { token: staff });
  assert.equal((await call('GET', '/api/session', { token: staff })).status, 401);
});

test('five wrong PINs lock the profile', async () => {
  for (let i = 0; i < 5; i++) await call('POST', '/api/login', { body: { id: 1, pin: '9999' } });
  const r = await call('POST', '/api/login', { body: { id: 1, pin: '0000' } });
  assert.equal(r.status, 429);
});
