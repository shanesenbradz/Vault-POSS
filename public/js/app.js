// app.js - VaultPOS frontend. Vanilla JS, no build step, no framework.
(function () {
  'use strict';

  // ---------------- Icon set (inline SVG, no external assets) ----------------
  const ICONS = {
    checkout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/></svg>',
    timeline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    inventory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l9-5 9 5-9 5-9-5z"/><path d="M3 8v9l9 5 9-5V8"/><path d="M12 13v9"/></svg>',
    reports: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="21" x2="19" y2="21"/><rect x="6" y="12" width="3" height="8"/><rect x="11" y="7" width="3" height="13"/><rect x="16" y="15" width="3" height="5"/></svg>',
    todos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12l2.5 2.5L16 9"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.9 7.9 0 000-2l2-1.5-2-3.4-2.4 1a8 8 0 00-1.7-1L15 3h-6l-.3 2.6a8 8 0 00-1.7 1l-2.4-1-2 3.4L4.6 11a7.9 7.9 0 000 2l-2 1.5 2 3.4 2.4-1a8 8 0 001.7 1L9 21h6l.3-2.6a8 8 0 001.7-1l2.4 1 2-3.4-2-1.5z"/></svg>',
    clients: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M2.8 20a6.2 6.2 0 0112.4 0"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15.5 13.5a5.5 5.5 0 015.7 6"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 119.5 4a7 7 0 0010.5 10.5z"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5L21.5 20h-19L12 3.5z"/><line x1="12" y1="9.5" x2="12" y2="14"/><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5.5 5.5L20 6.5"/></svg>',
    arrowleft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="11 6 5 12 11 18"/></svg>',
    backspace: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11a1 1 0 011 1v10a1 1 0 01-1 1H9l-6-6z"/><line x1="12.5" y1="9.5" x2="17.5" y2="14.5"/><line x1="17.5" y1="9.5" x2="12.5" y2="14.5"/></svg>',
  };
  function icon(name, cls) {
    return `<span class="icon ${cls || ''}">${ICONS[name] || ''}</span>`;
  }

  function loadSession() {
    try {
      localStorage.removeItem('vp_profile'); // pre-1.1 key, no longer used
      const s = JSON.parse(localStorage.getItem('vp_session') || 'null');
      return s && s.token && s.profile ? s : null;
    } catch (e) { return null; }
  }
  function saveSession() {
    try {
      if (state.token) localStorage.setItem('vp_session', JSON.stringify({ token: state.token, profile: state.profile }));
      else localStorage.removeItem('vp_session');
    } catch (e) { /* storage unavailable: session lasts until reload */ }
  }
  const saved = loadSession();

  const state = {
    profile: saved ? saved.profile : null,
    token: saved ? saved.token : null,
    profiles: [],
    items: [],
    customers: [],
    cart: [], // { itemId, name, unitPrice, unitCost, qty, stock }
    settings: {},
    pendingLoginId: null,
    pin: '',
  };

  const AVATAR_COLORS = ['#e79ac2', '#7f9973', '#2f8fe0', '#c99a3f', '#c97a54'];

  // ---------------- API helper ----------------
  async function rawFetch(path, opts = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
    let res;
    try {
      res = await fetch('/api' + path, Object.assign({}, opts, { headers }));
    } catch (e) {
      throw new Error('Cannot reach the VaultPOS server. Is it still running?');
    }
    if (!res.ok) {
      let msg = 'Request failed (' + res.status + ')';
      try { msg = (await res.json()).error || msg; } catch (e) {}
      // Session expired or profile removed: go back to the login screen
      if (res.status === 401 && state.token && path !== '/login') { showLoginScreen(); }
      throw new Error(msg);
    }
    return res;
  }

  async function api(path, opts = {}) {
    const res = await rawFetch(path, opts);
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res.text();
  }

  // File downloads go through fetch so the session token is sent along
  async function download(path, fallbackName) {
    try {
      const res = await rawFetch(path);
      const cd = res.headers.get('content-disposition') || '';
      const m = cd.match(/filename="([^"]+)"/);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = m ? m[1] : fallbackName;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { flash(e.message); }
  }

  function money(n) { return '$' + (Number(n) || 0).toFixed(2); }

  // SQLite stores "YYYY-MM-DD HH:MM:SS"; Safari can't parse that with a space
  function parseDate(s) {
    if (!s) return new Date(NaN);
    return new Date(String(s).replace(' ', 'T'));
  }
  function fmtDate(s) {
    const d = parseDate(s);
    return isNaN(d) ? String(s || '') : d.toLocaleString();
  }
  function safeColor(c, fallback) { return /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : fallback; }

  // ---------------- LOGIN ----------------
  async function loadProfilesScreen() {
    state.profiles = await api('/profiles');
    const grid = document.getElementById('profile-grid');
    grid.innerHTML = '';
    state.profiles.forEach((p, i) => {
      const tile = document.createElement('button');
      tile.className = 'profile-tile';
      tile.innerHTML = `
        <div class="profile-avatar" style="background:${safeColor(p.color, AVATAR_COLORS[i % AVATAR_COLORS.length])}">${escapeHtml(p.name.slice(0,1).toUpperCase())}</div>
        <div class="profile-tile-name">${escapeHtml(p.name)}</div>
        <div class="profile-tile-role">${escapeHtml(p.role)}</div>`;
      tile.addEventListener('click', () => openPinPad(p));
      grid.appendChild(tile);
    });
  }

  function openPinPad(profile) {
    state.pendingLoginId = profile.id;
    state.pin = '';
    document.getElementById('pin-target-name').textContent = `Enter PIN for ${profile.name}`;
    document.getElementById('pin-error').textContent = '';
    updatePinDots();
    document.getElementById('profile-grid').classList.add('hidden');
    document.getElementById('add-profile-btn').classList.add('hidden');
    document.getElementById('pin-pad-wrap').classList.remove('hidden');
  }

  function closePinPad() {
    document.getElementById('profile-grid').classList.remove('hidden');
    document.getElementById('add-profile-btn').classList.remove('hidden');
    document.getElementById('pin-pad-wrap').classList.add('hidden');
  }

  // PINs can be 4-6 digits, so we can't auto-submit at 4. The pad submits on
  // the Unlock button / Enter key, or automatically once 6 digits are typed.
  function updatePinDots() {
    const wrap = document.getElementById('pin-dots');
    const n = Math.max(4, state.pin.length);
    wrap.innerHTML = Array.from({ length: n }, (_, i) => `<span class="${i < state.pin.length ? 'filled' : ''}"></span>`).join('');
    const submit = document.getElementById('pin-submit');
    if (submit) submit.disabled = state.pin.length < 4 || state.loggingIn;
  }

  async function tryLogin() {
    if (state.pin.length < 4 || state.loggingIn) return;
    state.loggingIn = true;
    updatePinDots();
    try {
      const r = await api('/login', { method: 'POST', body: JSON.stringify({ id: state.pendingLoginId, pin: state.pin }) });
      state.token = r.token;
      state.profile = r.profile;
      saveSession();
      state.pin = '';
      await enterApp();
    } catch (e) {
      document.getElementById('pin-error').textContent = e.message;
      state.pin = '';
    } finally {
      state.loggingIn = false;
      updatePinDots();
    }
  }

  function pinKey(k) {
    document.getElementById('pin-error').textContent = '';
    if (k === 'clear') state.pin = '';
    else if (k === 'back') state.pin = state.pin.slice(0, -1);
    else if (k === 'enter') { tryLogin(); return; }
    else if (/^\d$/.test(k) && state.pin.length < 6) state.pin += k;
    updatePinDots();
    if (state.pin.length === 6) tryLogin();
  }

  document.getElementById('pin-pad').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn) pinKey(btn.dataset.k);
  });
  document.getElementById('pin-submit').addEventListener('click', () => pinKey('enter'));
  // Physical keyboard / number pad support on the PIN screen
  document.addEventListener('keydown', (e) => {
    if (document.getElementById('pin-pad-wrap').classList.contains('hidden')) return;
    if (document.getElementById('login-screen').classList.contains('hidden')) return;
    if (!document.getElementById('modal-host').classList.contains('hidden')) return;
    if (/^\d$/.test(e.key)) pinKey(e.key);
    else if (e.key === 'Backspace') pinKey('back');
    else if (e.key === 'Enter') pinKey('enter');
    else if (e.key === 'Escape') closePinPad();
    else return;
    e.preventDefault();
  });
  document.getElementById('pin-back').addEventListener('click', closePinPad);

  document.getElementById('add-profile-btn').addEventListener('click', () => {
    openProfileModal();
  });

  // ---------------- APP SHELL ----------------
  async function enterApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('active-profile-name').textContent = state.profile.name;
    document.getElementById('active-profile-role').textContent = state.profile.role;
    document.getElementById('active-profile-dot').style.background = safeColor(state.profile.color, '#8a7fdb');
    // .admin-only elements are hidden by CSS whenever body has .is-staff
    document.body.classList.toggle('is-staff', state.profile.role !== 'admin');

    state.settings = await api('/settings');
    applyTheme(state.settings.theme || 'botanical', state.settings.mode || 'light');
    document.getElementById('shop-name-display').textContent = state.settings.shop_name || 'VaultPOS';
    document.getElementById('sidebar-shop-name').textContent = state.settings.shop_name || 'VaultPOS';

    await refreshItems();
    await refreshCustomers();
    injectNavIcons();
    renderCatalog();
    renderCart();
    goToView('pos');
    document.getElementById('scan-input').focus();
  }

  function showLoginScreen() {
    state.profile = null;
    state.token = null;
    saveSession();
    state.cart = [];
    state.pin = '';
    closeModal();
    document.body.classList.remove('is-staff');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    closePinPad();
    loadProfilesScreen().catch((e) => flash(e.message));
  }

  document.getElementById('switch-shift-btn').addEventListener('click', async () => {
    if (state.cart.length && !confirm('The current sale has items in it. Switch profile and clear the cart?')) return;
    try { await api('/logout', { method: 'POST' }); } catch (e) { /* already signed out */ }
    showLoginScreen();
  });

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => goToView(btn.dataset.view));
  });

  function goToView(view) {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
    if (view === 'timeline') renderTimeline();
    if (view === 'inventory') renderInventory();
    if (view === 'clients') renderClients();
    if (view === 'reports') runReport();
    if (view === 'todos') renderTodos();
    if (view === 'calendar') renderCalendar();
    if (view === 'settings') renderSettings();
    if (view === 'pos') document.getElementById('scan-input').focus();
  }

  function injectNavIcons() {
    document.querySelectorAll('[data-icon]').forEach((el) => {
      const target = el.querySelector('.icon');
      if (target) target.innerHTML = ICONS[el.dataset.icon] || '';
    });
    const lightIcon = document.querySelector('#mode-light-btn .icon');
    const darkIcon = document.querySelector('#mode-dark-btn .icon');
    if (lightIcon) lightIcon.innerHTML = ICONS.sun;
    if (darkIcon) darkIcon.innerHTML = ICONS.moon;
  }

  function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // ---------------- THEME ----------------
  function applyTheme(theme, mode) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-mode', mode);
    document.querySelectorAll('.theme-swatch').forEach((b) => b.classList.toggle('active', b.dataset.theme === theme));
    const lightBtn = document.getElementById('mode-light-btn'), darkBtn = document.getElementById('mode-dark-btn');
    if (lightBtn && darkBtn) { lightBtn.classList.toggle('active', mode === 'light'); darkBtn.classList.toggle('active', mode === 'dark'); }
  }

  // ================================================================
  // INVENTORY / CATALOG
  // ================================================================
  async function refreshItems() {
    state.items = await api('/items');
    const categories = [...new Set(state.items.map((i) => i.category || 'General'))];
    const sel = document.getElementById('catalog-category');
    const cur = sel.value;
    sel.innerHTML = '<option value="">All categories</option>' + categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    sel.value = cur;
  }

  function renderCatalog() {
    const search = (document.getElementById('catalog-search').value || '').toLowerCase();
    const cat = document.getElementById('catalog-category').value;
    const list = document.getElementById('catalog-list');
    const filtered = state.items.filter((i) =>
      (!cat || i.category === cat) &&
      (!search || i.name.toLowerCase().includes(search) || (i.sku||'').toLowerCase().includes(search) || (i.barcode||'').toLowerCase().includes(search))
    );
    list.innerHTML = filtered.map((i) => {
      const low = i.stock <= i.low_stock_threshold;
      return `<button class="catalog-item" data-id="${i.id}" ${i.stock <= 0 ? 'disabled' : ''}>
        <div class="ci-name">${escapeHtml(i.name)}</div>
        <div class="ci-price">${money(i.sell_price)}</div>
        <div class="ci-stock ${low ? 'low' : ''}">${i.stock} in stock${low ? ' ' + icon('warning') : ''}</div>
      </button>`;
    }).join('') || '<p class="muted">No items match.</p>';
    list.querySelectorAll('.catalog-item').forEach((btn) => {
      btn.addEventListener('click', () => addToCart(Number(btn.dataset.id)));
    });
  }
  document.getElementById('catalog-search').addEventListener('input', renderCatalog);
  document.getElementById('catalog-category').addEventListener('change', renderCatalog);

  function addToCart(itemId, qty = 1) {
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return;
    const existing = state.cart.find((c) => c.itemId === itemId);
    const currentQty = existing ? existing.qty : 0;
    if (currentQty + qty > item.stock) { flash(`Only ${item.stock} of "${item.name}" in stock.`); return; }
    if (existing) existing.qty += qty;
    else state.cart.push({ itemId: item.id, name: item.variant_label ? `${item.name} (${item.variant_label})` : item.name, unitPrice: item.sell_price, qty, stock: item.stock });
    renderCart();
  }

  function renderCart() {
    const list = document.getElementById('cart-list');
    list.innerHTML = state.cart.map((c, idx) => `
      <div class="cart-row">
        <span class="cr-name">${escapeHtml(c.name)}</span>
        <span class="cr-qty">
          <button data-idx="${idx}" data-d="-1">−</button>
          <span>${c.qty}</span>
          <button data-idx="${idx}" data-d="1">+</button>
        </span>
        <span>${money(c.unitPrice * c.qty)}</span>
      </div>
    `).join('') || '<p class="muted">Cart is empty. Scan or tap an item.</p>';
    list.querySelectorAll('button[data-d]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        const d = Number(btn.dataset.d);
        const row = state.cart[idx];
        if (d > 0 && row.qty + 1 > row.stock) { flash('No more stock available.'); return; }
        row.qty += d;
        if (row.qty <= 0) state.cart.splice(idx, 1);
        renderCart();
      });
    });
    const count = state.cart.reduce((a, c) => a + c.qty, 0);
    const total = state.cart.reduce((a, c) => a + c.qty * c.unitPrice, 0);
    document.getElementById('cart-item-count').textContent = count;
    document.getElementById('cart-total').textContent = money(total);
  }

  document.getElementById('clear-cart-btn').addEventListener('click', () => { state.cart = []; renderCart(); });

  let checkingOut = false;
  document.getElementById('checkout-btn').addEventListener('click', async () => {
    if (!state.cart.length || checkingOut) return;
    checkingOut = true;
    const btn = document.getElementById('checkout-btn');
    btn.disabled = true;
    try {
      const customerSelect = document.getElementById('customer-select');
      // Prices and costs are looked up by the server; we only send what and how many
      const payload = {
        items: state.cart.map((c) => ({ itemId: c.itemId, qty: c.qty })),
        customerId: customerSelect.value ? Number(customerSelect.value) : null,
      };
      const sale = await api('/sales', { method: 'POST', body: JSON.stringify(payload) });
      state.cart = [];
      customerSelect.value = ''; // next sale starts as walk-in
      renderCart();
      await refreshItems();
      renderCatalog();
      flash('Sale completed: ' + money(sale.total));
      printReceipt(sale);
    } catch (e) {
      flash(e.message);
      await refreshItems().catch(() => {});
      renderCatalog();
    } finally {
      checkingOut = false;
      btn.disabled = false;
      document.getElementById('scan-input').focus();
    }
  });

  // ---- Barcode scanner / manual scan input ----
  // USB barcode scanners behave like a fast keyboard, typing the code then Enter.
  document.getElementById('scan-input').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const val = e.target.value.trim();
    e.target.value = '';
    if (!val) return;
    const item = state.items.find((i) => i.barcode === val || i.sku === val) ||
      state.items.find((i) => i.name.toLowerCase() === val.toLowerCase());
    if (item) addToCart(item.id);
    else flash(`No item found for "${val}"`);
  });

  // ---- Receipt printing (browser print API; ESC/POS-friendly plain layout) ----
  // 32 characters wide fits standard 58mm and 80mm thermal paper
  function printReceipt(sale) {
    const W = 32;
    const center = (s) => { s = String(s).slice(0, W); return ' '.repeat(Math.max(0, Math.floor((W - s.length) / 2))) + s; };
    const rule = '-'.repeat(W);
    const lineFor = (l) => {
      const amt = money(l.qty * l.unitPrice);
      const left = `${l.qty} x ${l.name}`;
      const room = W - amt.length - 1;
      if (left.length <= room) return left.padEnd(room) + ' ' + amt;
      // long names wrap onto their own line, amount right-aligned below
      return left + '\n' + amt.padStart(W);
    };
    const text = [
      center(state.settings.shop_name || 'VaultPOS'),
      center(fmtDate(sale.created_at) || new Date().toLocaleString()),
      `Receipt #${sale.id}`,
      `Served by: ${state.profile.name}`,
      sale.customerName ? `Client: ${sale.customerName}` : null,
      rule,
      ...sale.lines.map(lineFor),
      rule,
      ('TOTAL').padEnd(W - money(sale.total).length) + money(sale.total),
      rule,
      center('Thank you!'),
    ].filter((x) => x !== null).join('\n');
    document.getElementById('receipt-print-area').innerHTML = `<pre class="receipt">${escapeHtml(text)}</pre>`;
    window.print();
  }

  // ---- Inventory management view ----
  document.getElementById('add-item-btn').addEventListener('click', () => openItemModal());
  document.getElementById('csv-export-btn').addEventListener('click', () => download('/items/export.csv', 'items_export.csv'));
  document.getElementById('csv-import-btn').addEventListener('click', () => document.getElementById('csv-import-input').click());
  document.getElementById('csv-import-input').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    try {
      const result = await api('/items/import', { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: text });
      flash(`Imported: ${result.created} new, ${result.updated} updated${result.skipped ? `, ${result.skipped} skipped (no name)` : ''}`);
      await refreshItems(); renderCatalog(); renderInventory();
    } catch (err) { flash(err.message); }
    e.target.value = '';
  });

  async function renderInventory() {
    await refreshItems();
    const lowStock = state.items.filter((i) => i.stock <= i.low_stock_threshold);
    const banner = document.getElementById('low-stock-banner');
    if (lowStock.length) {
      banner.classList.remove('hidden');
      banner.textContent = '';
      banner.innerHTML = `${icon('warning')} ${lowStock.length} item(s) at or below their low-stock threshold: ${escapeHtml(lowStock.map((i) => i.name).join(', '))}`;
    } else banner.classList.add('hidden');

    const tbody = document.getElementById('inventory-tbody');
    tbody.innerHTML = state.items.map((i) => `
      <tr>
        <td>${escapeHtml(i.name)}${i.variant_label ? ` <span class="tag">${escapeHtml(i.variant_label)}</span>` : ''}</td>
        <td>${escapeHtml(i.sku || '-')} / ${escapeHtml(i.barcode || '-')}</td>
        <td>${escapeHtml(i.category)}</td>
        <td class="admin-only">${money(i.cost_price)}</td>
        <td>${money(i.sell_price)}</td>
        <td><span class="stock-badge ${i.stock <= i.low_stock_threshold ? 'low' : 'ok'}">${i.stock}</span></td>
        <td class="row-actions">
          <button class="ghost-btn small admin-only edit-item" data-id="${i.id}">Edit</button>
          <button class="ghost-btn small note-item" data-id="${i.id}">Notes</button>
          <button class="ghost-btn small admin-only del-item" data-id="${i.id}">Archive</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="7" class="muted">No items yet.</td></tr>';
    tbody.querySelectorAll('.edit-item').forEach((b) => b.addEventListener('click', () => openItemModal(state.items.find((i) => i.id === Number(b.dataset.id)))));
    tbody.querySelectorAll('.note-item').forEach((b) => b.addEventListener('click', () => openNotesModal(Number(b.dataset.id))));
    tbody.querySelectorAll('.del-item').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Archive this item? It will be hidden from checkout.')) return;
      try {
        await api('/items/' + b.dataset.id, { method: 'DELETE' });
        state.cart = state.cart.filter((c) => c.itemId !== Number(b.dataset.id));
        renderCart();
        await refreshItems(); renderInventory(); renderCatalog();
      } catch (e) { flash(e.message); }
    }));
  }

  function openItemModal(item) {
    const isEdit = !!item;
    showModal(`
      <h3>${isEdit ? 'Edit item' : 'Add item'}</h3>
      <label>Name <input id="m-name" value="${escapeHtml(item?.name || '')}"></label>
      <label>Category <input id="m-category" value="${escapeHtml(item?.category || 'General')}"></label>
      <label>SKU <input id="m-sku" value="${escapeHtml(item?.sku || '')}"></label>
      <label>Barcode <input id="m-barcode" value="${escapeHtml(item?.barcode || '')}"></label>
      <label>Variant / option (e.g. "Large", "Red") <input id="m-variant" value="${escapeHtml(item?.variant_label || '')}"></label>
      <label>Cost price <input id="m-cost" type="number" step="0.01" value="${item?.cost_price ?? 0}"></label>
      <label>Selling price <input id="m-price" type="number" step="0.01" value="${item?.sell_price ?? 0}"></label>
      <label>Stock <input id="m-stock" type="number" value="${item?.stock ?? 0}"></label>
      <label>Low-stock threshold <input id="m-threshold" type="number" value="${item?.low_stock_threshold ?? 5}"></label>
      <div class="modal-actions">
        <button class="ghost-btn" id="m-cancel">Cancel</button>
        <button class="primary-btn" id="m-save">Save</button>
      </div>
    `);
    document.getElementById('m-cancel').addEventListener('click', closeModal);
    document.getElementById('m-save').addEventListener('click', async () => {
      const payload = {
        name: document.getElementById('m-name').value.trim(),
        category: document.getElementById('m-category').value.trim() || 'General',
        sku: document.getElementById('m-sku').value.trim(),
        barcode: document.getElementById('m-barcode').value.trim(),
        variant_label: document.getElementById('m-variant').value.trim(),
        cost_price: parseFloat(document.getElementById('m-cost').value) || 0,
        sell_price: parseFloat(document.getElementById('m-price').value) || 0,
        stock: parseInt(document.getElementById('m-stock').value) || 0,
        low_stock_threshold: parseInt(document.getElementById('m-threshold').value) || 5,
      };
      if (!payload.name) { flash('Name is required'); return; }
      try {
        if (isEdit) await api('/items/' + item.id, { method: 'PUT', body: JSON.stringify(payload) });
        else await api('/items', { method: 'POST', body: JSON.stringify(payload) });
        closeModal();
        await refreshItems(); renderInventory(); renderCatalog();
      } catch (e) { flash(e.message); }
    });
  }

  async function openNotesModal(itemId) {
    const item = state.items.find((i) => i.id === itemId);
    const notes = await api(`/items/${itemId}/notes`);
    showModal(`
      <h3>Notes - ${escapeHtml(item.name)}</h3>
      <div id="notes-list" style="margin-bottom:14px; max-height:220px; overflow-y:auto;">
        ${notes.map((n) => `<div style="padding:8px 0; border-bottom:1px dashed var(--border);">
          <div style="font-size:13px;">${escapeHtml(n.text)}</div>
          <div style="font-size:11px;color:var(--text-muted);">${escapeHtml(n.profile_name)} · ${escapeHtml(fmtDate(n.created_at))}
            <button class="link-btn del-note" data-id="${n.id}" style="color:var(--danger);">delete</button>
          </div>
        </div>`).join('') || '<p class="muted">No notes yet.</p>'}
      </div>
      <label>Add a note <textarea id="m-note-text" rows="2" placeholder="e.g. Supplier delivery arriving Thursday"></textarea></label>
      <div class="modal-actions">
        <button class="ghost-btn" id="m-cancel">Close</button>
        <button class="primary-btn" id="m-add-note">Add note</button>
      </div>
    `);
    document.getElementById('m-cancel').addEventListener('click', closeModal);
    document.getElementById('m-add-note').addEventListener('click', async () => {
      const text = document.getElementById('m-note-text').value.trim();
      if (!text) return;
      await api(`/items/${itemId}/notes`, { method: 'POST', body: JSON.stringify({ text }) });
      openNotesModal(itemId);
    });
    document.querySelectorAll('.del-note').forEach((b) => b.addEventListener('click', async () => {
      await api('/notes/' + b.dataset.id, { method: 'DELETE' });
      openNotesModal(itemId);
    }));
  }

  // ================================================================
  // TIMELINE
  // ================================================================
  async function renderTimeline() {
    const sales = await api('/sales?limit=100');
    const feed = document.getElementById('timeline-feed');
    feed.innerHTML = sales.map((s) => `
      <div class="timeline-item">
        <div class="ti-time">${escapeHtml(fmtDate(s.created_at))}</div>
        <div class="ti-body">
          <span class="ti-total">${money(s.total)}</span>
          <strong>${escapeHtml(s.profile_name)}</strong> sold ${s.items.map((it) => `${it.qty}x ${escapeHtml(it.item_name)}`).join(', ')}${s.customer_name ? ` to <strong>${escapeHtml(s.customer_name)}</strong>` : ''}
        </div>
      </div>
    `).join('') || '<p class="muted">No sales yet.</p>';
  }

  // ================================================================
  // REPORTS
  // ================================================================
  async function runReport() {
    const from = document.getElementById('report-from').value;
    const to = document.getElementById('report-to').value;
    const qs = new URLSearchParams(); if (from) qs.set('from', from); if (to) qs.set('to', to);
    const r = await api('/reports?' + qs.toString());
    document.getElementById('rc-sales').textContent = r.saleCount;
    document.getElementById('rc-revenue').textContent = money(r.totalRevenue);
    document.getElementById('rc-profit').textContent = money(r.totalProfit);
    document.getElementById('top-items-tbody').innerHTML = r.topItems.map((t) => `
      <tr><td>${escapeHtml(t.item_name)}</td><td>${t.qty_sold}</td><td>${money(t.revenue)}</td><td>${money(t.profit)}</td></tr>
    `).join('') || '<tr><td colspan="4" class="muted">No sales in this range.</td></tr>';
  }
  document.getElementById('report-run-btn').addEventListener('click', runReport);
  document.getElementById('report-export-btn').addEventListener('click', () => {
    const from = document.getElementById('report-from').value;
    const to = document.getElementById('report-to').value;
    const qs = new URLSearchParams(); if (from) qs.set('from', from); if (to) qs.set('to', to);
    download('/reports/export.csv?' + qs.toString(), 'report.csv');
  });

  // ================================================================
  // TODOS
  // ================================================================
  async function renderTodos() {
    const { shop, personal } = await api('/todos');
    const renderList = (el, items) => {
      el.innerHTML = items.map((t) => `
        <div class="todo-item ${t.done ? 'done' : ''}">
          <input type="checkbox" ${t.done ? 'checked' : ''} data-id="${t.id}">
          <span class="todo-text">${escapeHtml(t.text)}</span>
          <button class="del" data-id="${t.id}">${icon('close')}</button>
        </div>`).join('') || '<p class="muted">Nothing here yet.</p>';
      el.querySelectorAll('input[type=checkbox]').forEach((cb) => cb.addEventListener('change', async () => {
        await api('/todos/' + cb.dataset.id, { method: 'PUT', body: JSON.stringify({ done: cb.checked }) });
        renderTodos();
      }));
      el.querySelectorAll('button.del').forEach((b) => b.addEventListener('click', async () => {
        await api('/todos/' + b.dataset.id, { method: 'DELETE' });
        renderTodos();
      }));
    };
    renderList(document.getElementById('personal-todo-list'), personal);
    renderList(document.getElementById('shop-todo-list'), shop);
  }
  document.getElementById('personal-todo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    if (!input.value.trim()) return;
    await api('/todos', { method: 'POST', body: JSON.stringify({ text: input.value.trim(), scope: 'personal' }) });
    input.value = ''; renderTodos();
  });
  document.getElementById('shop-todo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    if (!input.value.trim()) return;
    await api('/todos', { method: 'POST', body: JSON.stringify({ text: input.value.trim(), scope: 'shop' }) });
    input.value = ''; renderTodos();
  });

  // ================================================================
  // CALENDAR
  // ================================================================
  async function renderCalendar() {
    const events = await api('/calendar');
    const list = document.getElementById('calendar-list');
    list.innerHTML = events.map((ev) => `
      <div class="cal-item">
        <div class="cal-date">${escapeHtml(ev.event_date)}</div>
        <div>
          <div class="cal-title">${escapeHtml(ev.title)} <span class="tag">${escapeHtml(ev.type)}</span></div>
          ${ev.note ? `<div class="cal-note">${escapeHtml(ev.note)}</div>` : ''}
        </div>
        <button class="del" data-id="${ev.id}">${icon('close')}</button>
      </div>
    `).join('') || '<p class="muted">No events scheduled.</p>';
    list.querySelectorAll('button.del').forEach((b) => b.addEventListener('click', async () => {
      await api('/calendar/' + b.dataset.id, { method: 'DELETE' });
      renderCalendar();
    }));
  }
  document.getElementById('add-event-btn').addEventListener('click', () => {
    showModal(`
      <h3>New event</h3>
      <label>Title <input id="m-ev-title" placeholder="Supplier delivery"></label>
      <label>Type
        <select id="m-ev-type">
          <option value="delivery">Supplier delivery</option>
          <option value="shift">Staff shift</option>
          <option value="stocktake">Stock count</option>
          <option value="general">General</option>
        </select>
      </label>
      <label>Date <input id="m-ev-date" type="date"></label>
      <label>Note <textarea id="m-ev-note" rows="2"></textarea></label>
      <div class="modal-actions">
        <button class="ghost-btn" id="m-cancel">Cancel</button>
        <button class="primary-btn" id="m-save">Add</button>
      </div>
    `);
    document.getElementById('m-cancel').addEventListener('click', closeModal);
    document.getElementById('m-save').addEventListener('click', async () => {
      const title = document.getElementById('m-ev-title').value.trim();
      const event_date = document.getElementById('m-ev-date').value;
      if (!title || !event_date) { flash('Title and date required'); return; }
      await api('/calendar', { method: 'POST', body: JSON.stringify({
        title, type: document.getElementById('m-ev-type').value, event_date,
        note: document.getElementById('m-ev-note').value.trim(),
      })});
      closeModal(); renderCalendar();
    });
  });

  // ================================================================
  // SETTINGS
  // ================================================================
  async function renderSettings() {
    document.getElementById('setting-shop-name').value = state.settings.shop_name || '';
    document.querySelectorAll('.theme-swatch').forEach((b) => b.classList.toggle('active', b.dataset.theme === state.settings.theme));
    const mode = document.documentElement.getAttribute('data-mode');
    document.getElementById('mode-light-btn').classList.toggle('active', mode === 'light');
    document.getElementById('mode-dark-btn').classList.toggle('active', mode === 'dark');

    const profiles = await api('/profiles');
    document.getElementById('settings-profile-list').innerHTML = profiles.map((p) => `
      <div class="settings-profile-row">
        <span class="spr-name">${escapeHtml(p.name)}</span>
        <span class="spr-role">${escapeHtml(p.role)}</span>
        <button class="ghost-btn small edit-profile" data-id="${p.id}">Edit</button>
        ${p.id !== state.profile.id ? `<button class="ghost-btn small remove-profile" data-id="${p.id}">Remove</button>` : ''}
      </div>`).join('');
    document.querySelectorAll('.edit-profile').forEach((b) => b.addEventListener('click', () => {
      openProfileModal(profiles.find((p) => p.id === Number(b.dataset.id)));
    }));
    document.querySelectorAll('.remove-profile').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Remove this profile?')) return;
      await api('/profiles/' + b.dataset.id, { method: 'DELETE' });
      renderSettings();
    }));
  }

  document.getElementById('save-shop-name-btn').addEventListener('click', async () => {
    const shop_name = document.getElementById('setting-shop-name').value.trim();
    state.settings = await api('/settings', { method: 'PUT', body: JSON.stringify({ shop_name }) });
    document.getElementById('shop-name-display').textContent = state.settings.shop_name;
    document.getElementById('sidebar-shop-name').textContent = state.settings.shop_name;
    flash('Saved');
  });

  document.querySelectorAll('.theme-swatch').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const theme = btn.dataset.theme;
      const mode = document.documentElement.getAttribute('data-mode');
      applyTheme(theme, mode);
      state.settings = await api('/settings', { method: 'PUT', body: JSON.stringify({ theme }) });
    });
  });
  document.getElementById('mode-light-btn').addEventListener('click', async () => {
    applyTheme(document.documentElement.getAttribute('data-theme'), 'light');
    await api('/settings/mode', { method: 'PUT', body: JSON.stringify({ mode: 'light' }) });
  });
  document.getElementById('mode-dark-btn').addEventListener('click', async () => {
    applyTheme(document.documentElement.getAttribute('data-theme'), 'dark');
    await api('/settings/mode', { method: 'PUT', body: JSON.stringify({ mode: 'dark' }) });
  });

  document.getElementById('settings-add-profile-btn').addEventListener('click', () => openProfileModal());
  document.getElementById('export-json-btn').addEventListener('click', () => download('/vault/export.json', 'vault_backup.json'));
  document.getElementById('export-db-btn').addEventListener('click', () => download('/vault/export.db', 'vault.db'));

  function openProfileModal(profile) {
    const isEdit = !!profile;
    // If there's no logged-in session (i.e. this was opened from the login screen),
    // the server has no way to know we're an admin - so we need to authorize the
    // change by picking an existing admin profile and entering their PIN here.
    const needsAuth = !state.profile;
    const admins = state.profiles ? state.profiles.filter((p) => p.role === 'admin') : [];
    showModal(`
      <h3>${isEdit ? 'Edit profile' : 'Add profile'}</h3>
      ${needsAuth ? `
        <p class="muted" style="margin-top:-8px;">Adding a profile requires admin authorization.</p>
        <label>Authorizing admin
          <select id="m-auth-admin">${admins.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('')}</select>
        </label>
        <label>Admin PIN <input id="m-auth-pin" type="password" inputmode="numeric" maxlength="6"></label>
      ` : ''}
      <label>Name <input id="m-p-name" value="${escapeHtml(profile?.name || '')}"></label>
      <label>Role
        <select id="m-p-role">
          <option value="staff" ${profile?.role === 'staff' ? 'selected' : ''}>Staff / Cashier</option>
          <option value="admin" ${profile?.role === 'admin' ? 'selected' : ''}>Admin / Owner</option>
        </select>
      </label>
      <label>${isEdit ? 'New PIN (leave blank to keep current)' : 'PIN (4-6 digits)'} <input id="m-p-pin" type="password" inputmode="numeric" maxlength="6"></label>
      <div class="modal-actions">
        <button class="ghost-btn" id="m-cancel">Cancel</button>
        <button class="primary-btn" id="m-save">Save</button>
      </div>
    `);
    document.getElementById('m-cancel').addEventListener('click', closeModal);
    document.getElementById('m-save').addEventListener('click', async () => {
      const name = document.getElementById('m-p-name').value.trim();
      const role = document.getElementById('m-p-role').value;
      const pin = document.getElementById('m-p-pin').value.trim();
      if (!name) { flash('Name required'); return; }
      if ((!isEdit || pin) && !/^\d{4,6}$/.test(pin)) { flash('PIN must be 4 to 6 digits'); return; }
      if (needsAuth && !admins.length) { flash('No admin profile exists to authorize this'); return; }
      try {
        if (isEdit) {
          const body = { name, role }; if (pin) body.pin = pin;
          const r = await api('/profiles/' + profile.id, { method: 'PUT', body: JSON.stringify(body) });
          if (r.self) {
            // Edited our own profile: refresh the sidebar, and drop admin UI if we demoted ourselves
            state.profile = r.self; saveSession();
            closeModal();
            await enterApp();
            if (r.self.role !== 'admin') return;
            goToView('settings');
            return;
          }
        } else {
          const body = { name, role, pin, color: AVATAR_COLORS[Math.floor(Math.random()*AVATAR_COLORS.length)] };
          if (needsAuth) {
            body.adminId = document.getElementById('m-auth-admin').value;
            body.adminPin = document.getElementById('m-auth-pin').value.trim();
          }
          await api('/profiles', { method: 'POST', body: JSON.stringify(body) });
        }
        closeModal();
        if (document.getElementById('login-screen').classList.contains('hidden')) renderSettings();
        else loadProfilesScreen();
      } catch (e) { flash(e.message); }
    });
  }

  // ================================================================
  // CLIENTS / CUSTOMERS
  // ================================================================
  async function refreshCustomers() {
    state.customers = await api('/customers');
    const sel = document.getElementById('customer-select');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Walk-in (no client)</option>' +
      state.customers.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    sel.value = cur;
  }

  document.getElementById('new-client-inline-btn').addEventListener('click', () => openClientModal(null, true));

  document.getElementById('add-client-btn').addEventListener('click', () => openClientModal());
  document.getElementById('client-search').addEventListener('input', renderClients);

  async function renderClients() {
    await refreshCustomers();
    const search = (document.getElementById('client-search').value || '').toLowerCase();
    const filtered = state.customers.filter((c) =>
      !search || c.name.toLowerCase().includes(search) || (c.phone||'').includes(search) || (c.email||'').toLowerCase().includes(search));
    // visit_count and lifetime_spend come back with the list (one request, not one per client)
    const rows = filtered.map((c) => ({ c, visitCount: c.visit_count || 0, lifetimeSpend: c.lifetime_spend || 0 }));
    document.getElementById('clients-tbody').innerHTML = rows.map(({ c, visitCount, lifetimeSpend }) => `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.phone || '-')}</td>
        <td>${escapeHtml(c.email || '-')}</td>
        <td>${visitCount}</td>
        <td>${money(lifetimeSpend)}</td>
        <td>
          <button class="ghost-btn small view-client" data-id="${c.id}">View profile</button>
          <button class="ghost-btn small edit-client" data-id="${c.id}">Edit</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="6" class="muted">No clients yet.</td></tr>';
    document.querySelectorAll('.view-client').forEach((b) => b.addEventListener('click', () => openClientProfile(Number(b.dataset.id))));
    document.querySelectorAll('.edit-client').forEach((b) => b.addEventListener('click', () => openClientModal(state.customers.find((c) => c.id === Number(b.dataset.id)))));
  }

  function openClientModal(client, selectAfterSave) {
    const isEdit = !!client;
    showModal(`
      <h3>${isEdit ? 'Edit client' : 'Add client'}</h3>
      <label>Name <input id="m-c-name" value="${escapeHtml(client?.name || '')}"></label>
      <label>Phone <input id="m-c-phone" value="${escapeHtml(client?.phone || '')}"></label>
      <label>Email <input id="m-c-email" type="email" value="${escapeHtml(client?.email || '')}"></label>
      <label>Notes <textarea id="m-c-notes" rows="2">${escapeHtml(client?.notes || '')}</textarea></label>
      <div class="modal-actions">
        ${isEdit ? '<button class="ghost-btn admin-only danger-btn" id="m-delete">Delete</button>' : ''}
        <button class="ghost-btn" id="m-cancel">Cancel</button>
        <button class="primary-btn" id="m-save">Save</button>
      </div>
    `);
    document.getElementById('m-cancel').addEventListener('click', closeModal);
    const delBtn = document.getElementById('m-delete');
    if (delBtn) delBtn.addEventListener('click', async () => {
      if (!confirm(`Delete ${client.name}? Their past sales stay in your records as plain text.`)) return;
      try {
        await api('/customers/' + client.id, { method: 'DELETE' });
        closeModal();
        await refreshCustomers();
        if (document.getElementById('view-clients').classList.contains('active')) renderClients();
      } catch (e) { flash(e.message); }
    });
    document.getElementById('m-save').addEventListener('click', async () => {
      const name = document.getElementById('m-c-name').value.trim();
      if (!name) { flash('Name is required'); return; }
      const payload = {
        name,
        phone: document.getElementById('m-c-phone').value.trim(),
        email: document.getElementById('m-c-email').value.trim(),
        notes: document.getElementById('m-c-notes').value.trim(),
      };
      try {
        let newId = client?.id;
        if (isEdit) await api('/customers/' + client.id, { method: 'PUT', body: JSON.stringify(payload) });
        else { const r = await api('/customers', { method: 'POST', body: JSON.stringify(payload) }); newId = r.id; }
        closeModal();
        await refreshCustomers();
        if (selectAfterSave && newId) document.getElementById('customer-select').value = newId;
        if (!document.getElementById('view-clients').classList.contains('active')) return;
        renderClients();
      } catch (e) { flash(e.message); }
    });
  }

  async function openClientProfile(id) {
    const data = await api(`/customers/${id}/profile`);
    const { customer, sales, visitCount, lifetimeSpend, favoriteItems } = data;
    showModal(`
      <h3>${escapeHtml(customer.name)}</h3>
      <p class="muted" style="margin-top:-10px;">
        ${customer.phone ? escapeHtml(customer.phone) : ''}${customer.phone && customer.email ? ' &middot; ' : ''}${customer.email ? escapeHtml(customer.email) : ''}
        ${!customer.phone && !customer.email ? 'No contact details on file' : ''}
      </p>
      ${customer.notes ? `<p style="font-size:13px;">${escapeHtml(customer.notes)}</p>` : ''}
      <div class="report-cards" style="grid-template-columns:1fr 1fr; margin:14px 0;">
        <div class="report-card"><div class="rc-label">Visits</div><div class="rc-value">${visitCount}</div></div>
        <div class="report-card"><div class="rc-label">Lifetime spend</div><div class="rc-value">${money(lifetimeSpend)}</div></div>
      </div>
      ${favoriteItems.length ? `<h3 style="font-size:15px;">Most purchased</h3>
        <p style="font-size:13px;">${favoriteItems.map((f) => `${escapeHtml(f.name)} (${f.qty}x)`).join(', ')}</p>` : ''}
      <h3 style="font-size:15px;">Purchase history</h3>
      <div style="max-height:220px; overflow-y:auto;">
        ${sales.map((s) => `
          <div style="padding:8px 0; border-bottom:1px dashed var(--border); font-size:13px;">
            <strong>${money(s.total)}</strong> - ${escapeHtml(fmtDate(s.created_at))}<br>
            <span class="muted">${s.items.map((it) => `${it.qty}x ${escapeHtml(it.item_name)}`).join(', ')}</span>
          </div>
        `).join('') || '<p class="muted">No purchases on record yet.</p>'}
      </div>
      <div class="modal-actions">
        <button class="ghost-btn full" id="m-cancel">Close</button>
      </div>
    `);
    document.getElementById('m-cancel').addEventListener('click', closeModal);
  }

  // ================================================================
  // MODAL + TOAST helpers
  // ================================================================
  function showModal(html) {
    document.getElementById('modal-box').innerHTML = html;
    document.getElementById('modal-host').classList.remove('hidden');
  }
  function closeModal() { document.getElementById('modal-host').classList.add('hidden'); }
  document.querySelector('.modal-backdrop').addEventListener('click', closeModal);

  let flashTimeout;
  function flash(msg) {
    let el = document.getElementById('flash-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'flash-toast';
      el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid var(--border);color:var(--text);padding:12px 20px;border-radius:14px;box-shadow:var(--card-shadow);z-index:100;font-size:14px;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(flashTimeout);
    flashTimeout = setTimeout(() => { el.style.opacity = '0'; }, 2600);
  }
  // Any async action that fails without its own handler still tells the user why
  window.addEventListener('unhandledrejection', (e) => {
    flash((e.reason && e.reason.message) || 'Something went wrong');
  });

  // ================================================================
  // BOOT
  // ================================================================
  (async function boot() {
    try {
      const settings = await api('/settings');
      applyTheme(settings.theme || 'botanical', settings.mode || 'light');
    } catch (e) {}

    injectNavIcons();
    if (state.token) {
      try {
        // Make sure the saved session is still valid (and pick up any role/name change)
        state.profile = await api('/session');
        saveSession();
        await enterApp();
        return;
      } catch (e) {
        state.profile = null; state.token = null; saveSession();
        document.getElementById('app').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
      }
    }
    try { await loadProfilesScreen(); }
    catch (e) { document.getElementById('profile-grid').innerHTML = `<p class="pin-error">${escapeHtml(e.message)}</p>`; }
  })();
})();
