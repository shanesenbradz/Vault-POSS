// desktop/main.js - VaultPOS desktop app (Windows & Linux).
// Runs the same VaultPOS server inside the app and shows it in its own window.
// Other devices on the same Wi-Fi (tablets, a second till) can still connect to it
// in a browser, exactly like the command-line version.
const { app, BrowserWindow, Menu, dialog, shell, clipboard, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

app.setName('VaultPOS');

// ---------- one copy of the app at a time ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

// ---------- desktop settings (window size, network sharing) ----------
const USER_DIR = app.getPath('userData');
const DATA_DIR = path.join(USER_DIR, 'data');
const PREFS_FILE = path.join(USER_DIR, 'desktop.json');
const DEFAULT_PREFS = { lanAccess: true, port: 6969, bounds: { width: 1280, height: 820 }, maximized: false };

function loadPrefs() {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8')) }; }
  catch { return { ...DEFAULT_PREFS }; }
}
function savePrefs() {
  try { fs.mkdirSync(USER_DIR, { recursive: true }); fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2)); }
  catch (e) { console.error('Could not save desktop settings', e); }
}
const prefs = loadPrefs();

// The server reads its data folder from this variable when it is first loaded
process.env.VAULTPOS_DATA_DIR = DATA_DIR;
const vault = require('../server');

const ICON = path.join(__dirname, 'icons', process.platform === 'win32' ? 'icon.ico' : 'icon.png');

let win = null;
let running = null; // { server, port, host }

function localUrl() { return `http://127.0.0.1:${running.port}`; }

function lanUrls() {
  if (!running || running.host !== '0.0.0.0') return [];
  return vault.lanAddresses().map((ip) => `http://${ip}:${running.port}`);
}

// ---------- window ----------
function createWindow() {
  win = new BrowserWindow({
    ...prefs.bounds,
    minWidth: 900,
    minHeight: 600,
    title: 'VaultPOS',
    icon: ICON,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e2019' : '#f4efe4',
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  if (prefs.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());

  // Stay inside the app; real web links open in the normal browser
  const isLocal = (url) => url.startsWith(localUrl());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isLocal(url) && /^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!isLocal(url)) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); }
  });

  const remember = () => {
    if (!win || win.isDestroyed()) return;
    prefs.maximized = win.isMaximized();
    if (!prefs.maximized && !win.isMinimized()) prefs.bounds = win.getBounds();
  };
  win.on('resize', remember);
  win.on('move', remember);
  win.on('close', () => { remember(); savePrefs(); });
  win.on('closed', () => { win = null; });

  win.loadURL(localUrl());
}

// ---------- menu actions ----------
async function backupNow() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Save a backup of your vault',
    defaultPath: path.join(app.getPath('documents'), `VaultPOS-backup-${stamp}.db`),
    filters: [{ name: 'VaultPOS backup', extensions: ['db'] }],
  });
  if (canceled || !filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.rmSync(filePath);
    vault.db.prepare('VACUUM INTO ?').run(filePath);
    dialog.showMessageBox(win, { type: 'info', message: 'Backup saved', detail: filePath });
  } catch (e) {
    dialog.showErrorBox('Backup failed', e.message);
  }
}

async function restoreBackup() {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Restore a vault backup',
    properties: ['openFile'],
    filters: [{ name: 'VaultPOS database', extensions: ['db', 'sqlite'] }, { name: 'All files', extensions: ['*'] }],
  });
  if (canceled || !filePaths.length) return;
  const src = filePaths[0];
  try {
    const head = Buffer.alloc(16);
    const fd = fs.openSync(src, 'r'); fs.readSync(fd, head, 0, 16, 0); fs.closeSync(fd);
    if (!head.toString('latin1').startsWith('SQLite format 3')) throw new Error('That file is not a VaultPOS database.');
  } catch (e) {
    return dialog.showErrorBox('Cannot restore', e.message);
  }
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Cancel', 'Replace and restart'],
    defaultId: 0, cancelId: 0,
    message: 'Replace the current vault with this backup?',
    detail: 'Everything currently in VaultPOS on this computer will be replaced. A safety copy of the current vault is saved first, in the data folder.',
  });
  if (response !== 1) return;
  try {
    const live = vault.DB_PATH;
    const safety = path.join(DATA_DIR, `before-restore-${Date.now()}.db`);
    vault.db.prepare('VACUUM INTO ?').run(safety);
    running.server.close();
    vault.close();
    for (const f of [live, live + '-wal', live + '-shm']) fs.rmSync(f, { force: true });
    fs.copyFileSync(src, live);
    app.relaunch();
    app.exit(0);
  } catch (e) {
    dialog.showErrorBox('Restore failed', e.message + '\n\nThe app will now restart.');
    app.relaunch();
    app.exit(1);
  }
}

function showNetworkInfo() {
  const urls = lanUrls();
  const detail = prefs.lanAccess
    ? (urls.length
      ? `Open this address in a browser on any tablet, phone or second till on the same Wi-Fi:\n\n${urls.join('\n')}\n\nKeep VaultPOS open on this computer while they use it.` +
        (running.port !== prefs.port ? `\n\nNote: port ${prefs.port} was busy, so port ${running.port} is in use for now.` : '')
      : 'This computer is not connected to a network right now.')
    : 'Sharing with other devices is turned off. Turn on "Allow other devices on this Wi-Fi" in the Network menu.';
  dialog.showMessageBox(win, {
    type: 'info',
    title: 'Connect other devices',
    message: 'Use VaultPOS on other devices',
    detail,
    buttons: urls.length ? ['Copy address', 'Close'] : ['Close'],
  }).then(({ response }) => { if (urls.length && response === 0) clipboard.writeText(urls[0]); });
}

async function toggleLan(item) {
  prefs.lanAccess = item.checked;
  savePrefs();
  const { response } = await dialog.showMessageBox(win, {
    type: 'question', buttons: ['Restart now', 'Later'], defaultId: 0,
    message: prefs.lanAccess ? 'Other devices will be able to connect after a restart.' : 'Other devices will be blocked after a restart.',
  });
  if (response === 0) { app.relaunch(); app.exit(0); }
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Back up vault…', accelerator: 'CmdOrCtrl+B', click: backupNow },
        { label: 'Restore from backup…', click: restoreBackup },
        { type: 'separator' },
        { label: 'Open data folder', click: () => shell.openPath(DATA_DIR) },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'Network',
      submenu: [
        { label: 'Connect other devices…', click: showNetworkInfo },
        { label: 'Open in web browser', click: () => shell.openExternal(localUrl()) },
        { type: 'separator' },
        { label: 'Allow other devices on this Wi-Fi', type: 'checkbox', checked: prefs.lanAccess, click: toggleLan },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' }]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'VaultPOS on GitHub', click: () => shell.openExternal('https://github.com/shanesenbradz/Vault-POSS') },
        { label: 'Report a problem', click: () => shell.openExternal('https://github.com/shanesenbradz/Vault-POSS/issues') },
        { type: 'separator' },
        {
          label: 'About VaultPOS',
          click: () => dialog.showMessageBox(win, {
            type: 'info', title: 'About VaultPOS', icon: ICON,
            message: `VaultPOS ${app.getVersion()}`,
            detail: `Offline-first shop management & POS.\nBy Bradley Williams.\n\nYour data is stored on this computer in:\n${DATA_DIR}`,
          }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- startup ----------
app.on('second-instance', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

app.whenReady().then(async () => {
  try {
    running = await vault.start({
      port: prefs.port,
      host: prefs.lanAccess ? '0.0.0.0' : '127.0.0.1',
      fallbackPort: true,
    });
  } catch (e) {
    dialog.showErrorBox('VaultPOS could not start', e.message);
    app.exit(1);
    return;
  }
  buildMenu();
  createWindow();
});

app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!win && running) createWindow(); });
app.on('will-quit', () => {
  try { running && running.server.close(); } catch (_) {}
  vault.close();
});
