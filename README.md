# VaultPOS

![Node.js 22.13+](https://img.shields.io/badge/node-%3E%3D22.13-3c873a) ![No dependencies](https://img.shields.io/badge/dependencies-0-blue) ![Windows | Linux | macOS](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey)

An offline-first, local shop management & point-of-sale system. Runs entirely on one
computer (or over your local Wi-Fi/LAN) - no cloud, no account, no internet required
after setup.

There are three ways to use it, all running the same app on the same kind of data file:

| | What it is | Best for |
|---|---|---|
| **Desktop app** | Windows installer / portable `.exe`, Linux AppImage / `.deb` | The main till. Nothing else to install. |
| **Web app** | Open the address in any browser, or install it to the home screen | Tablets, phones and a second till on the same Wi-Fi |
| **Server only** | `node server.js` | Headless shop PCs, Raspberry Pi, people who prefer a terminal |

## Download

Get the latest version from the **[Releases page](https://github.com/shanesenbradz/Vault-POSS/releases/latest)**:

| System | File | How to run |
|---|---|---|
| Windows (install) | `VaultPOS-Setup-x.y.z.exe` | Double-click, follow the installer. Adds Start menu and desktop shortcuts. |
| Windows (no install) | `VaultPOS-x.y.z-portable.exe` | Double-click to run. Good on a USB stick. |
| Linux (any distro) | `VaultPOS-x.y.z-linux-x86_64.AppImage` | `chmod +x VaultPOS-*.AppImage` then run it. |
| Ubuntu / Debian / Mint | `VaultPOS-x.y.z-linux-amd64.deb` | `sudo apt install ./VaultPOS-*.deb`, then find VaultPOS in your app menu. |

The Windows builds aren't code-signed yet, so Windows SmartScreen may say "Windows
protected your PC". Click **More info → Run anyway**.

## Desktop app

The desktop app runs the VaultPOS server inside itself and shows it in its own window,
so there's no Node.js to install and no console window to keep open. It adds a menu with:

- **File → Back up vault… (Ctrl+B)** - save a backup `.db` anywhere you like.
- **File → Restore from backup…** - load a backup (or a `vault.sqlite` from the
  server-only version). A safety copy of the current vault is kept first.
- **File → Open data folder** - where your vault lives:
  - Windows: `%APPDATA%\VaultPOS\data`
  - Linux: `~/.config/VaultPOS/data`
- **Network → Connect other devices…** - shows the address tablets and phones should
  open, with a copy button.
- **Network → Allow other devices on this Wi-Fi** - turn LAN sharing off if this
  computer should be the only till.

Only one copy of the app runs at a time; opening it again just brings the window back.
If port 6969 is busy, the app picks another free port and tells you in
**Connect other devices**.

**Moving from the server-only version:** copy `data/vault.sqlite` somewhere safe, open
the desktop app, and use **File → Restore from backup…** on that file.

## Web app (tablets, phones, second tills)

While VaultPOS is running on the main computer, open the LAN address it shows (for
example `http://192.168.1.42:6969`) in any browser on the same Wi-Fi.

To get an app icon on the device:

- **iPad / iPhone (Safari):** Share → **Add to Home Screen**. It opens full-screen like an app.
- **Android (Chrome):** menu → **Add to Home screen**.
- **On the main computer (Chrome / Edge at `http://127.0.0.1:6969`):** the install icon
  in the address bar installs it as a proper app window.

Browsers only allow the full "install" (offline app shell, own window) on `https` or on
the computer running the server, so on other devices over plain Wi-Fi it's a home screen
shortcut instead. Everything works the same either way.

## What's inside

- **Local server** - pure Node.js (`http` + the built-in `node:sqlite` module). There is
  **no `npm install` step and no native compilation**, so it runs identically on Windows
  and Linux (and macOS).
- **Embedded database** - a single SQLite file at `data/vault.sqlite`.
- **Web interface** - open it in any browser, on the host machine or any device on the
  same Wi-Fi/LAN.
- **Zero-dependency backups** - one-click export of the whole vault to `.json` or `.db`.

## Requirements

- **Node.js 22.13 or newer** on the computer that runs the server (for the built-in
  SQLite support; on 22.5 to 22.12 it was still hidden behind a flag). This applies on **both Windows and Linux** - Node.js does not come
  pre-installed on Windows, so you need to install it yourself first. Check with
  `node -v` in a terminal/Command Prompt. Download from https://nodejs.org (choose the
  "LTS" installer) if `node -v` doesn't work or reports a version older than 22.13.
- Devices that only *view* the app in a browser (a tablet, a second till) don't need
  Node.js installed - only the one machine actually running the server does.

## Running the server-only version

### Windows
1. Install Node.js from https://nodejs.org if you haven't already (see Requirements
   above).
2. Double-click **`start-windows.bat`**. A console window opens and stays open while the
   server runs.
3. Open a browser and go to **http://127.0.0.1:6969** - type the address exactly like
   that, including `http://`, since some browsers will otherwise try to search for it or
   force `https://`, which this local server does not use.

### Linux / macOS
```bash
git clone https://github.com/shanesenbradz/Vault-POSS.git vaultpos
cd vaultpos
./start-linux.sh
```
or simply:
```bash
npm start
```
Then open **http://127.0.0.1:6969**.

### From a tablet or second device on the same Wi-Fi
The console prints a LAN address, e.g. `http://192.168.1.42:6969`. Open that address on
any device connected to the same network - no installation needed on that device.

To stop the server, close the console window (Windows) or press `Ctrl+C` (Linux/macOS).

Optional environment variables:

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `6969` | Port to listen on |
| `HOST` | `0.0.0.0` | Set to `127.0.0.1` to allow this computer only (no LAN access) |
| `VAULTPOS_DATA_DIR` | `./data` | Folder that holds `vault.sqlite` |

## Windows firewall blocking the page

The first time you run `start-windows.bat`, Windows will usually pop up a **"Windows
Defender Firewall has blocked some features of this app"** dialog. This is normal - it
appears because Node.js is opening a network port so other devices can reach it. If you
don't allow it, the page can fail to load even on the same computer.

To fix it:

1. When that dialog appears, tick **both** "Private networks" and "Public networks" (if
   you're only using it on your home/shop Wi-Fi, Private is enough) and click
   **Allow access**.
2. If you accidentally clicked "Cancel" or the dialog never appeared and the page still
   won't load, add the rule manually:
   - Open **Windows Security** > **Firewall & network protection** > **Allow an app
     through firewall** > **Change settings** > **Allow another app**.
   - Browse to your Node.js install (usually
     `C:\Program Files\nodejs\node.exe`) and add it, checking both Private and Public.
3. If you're on a work/managed computer, antivirus or IT-managed firewall software may
   block it entirely regardless of Windows Firewall settings - check with whoever
   manages that software, or try running it on a personal machine instead.
4. `http://127.0.0.1:6969` (i.e. the same computer talking to itself) is loopback
   traffic and is essentially never blocked by a firewall - if *that* address doesn't
   load either, the problem is more likely the browser bar (see below) or Node.js not
   actually running (check the console window for errors) than the firewall.
5. Make sure the address bar has `http://127.0.0.1:6969` exactly - if a browser
   "corrects" it to `https://127.0.0.1:6969` you'll get a connection error, since this
   local server intentionally doesn't use HTTPS.

## First login

- Default profile: **Owner**, PIN **`0000`**.
- Go to **Settings → Profiles & staff** immediately and change the PIN, and add profiles
  for your staff (up to 5 total, admin or staff role).
- PINs are 4 to 6 digits. Tap them on the pad or type them on the keyboard, then press
  **Unlock** or Enter (6-digit PINs unlock automatically).
- Five wrong PINs in a row lock that profile for a minute, and longer on repeat.
- You stay logged in on that device until you press **Switch profile**, even if the server
  restarts.

## Roles

- **Admin/Owner** - full access: inventory, cost prices & margins, reports, staff
  profiles, theme/shop settings.
- **Staff/Cashier** - sees Checkout, Timeline, Inventory (without cost prices or the
  ability to add/edit/archive/import items), Clients, To-dos, and Calendar. Reports and
  Settings are hidden. These limits are enforced by the server, not just hidden in the
  page, so cost prices and profit figures never reach a staff device.

Switch profiles any time from the sidebar ("Switch profile") without closing the app.

## Clients

The **Clients** tab keeps a simple customer record: name, phone, email, and free-form
notes. Attach a client to a sale from the dropdown at the top of the checkout cart (or
add one on the fly with "+ New" right there) to build up their history automatically.

Open **View profile** on any client to see their contact details, total visits,
lifetime spend, most-purchased items, and a full list of past purchases with dates and
line items. Sales made without picking a client are logged as walk-in sales and don't
appear on any client's profile.

## Data & backups

Everything lives in `data/vault.sqlite`. To back up:

- **Settings → Backups → Export vault (.json)** - a full, human-readable dump of every
  table (profiles, customers, items, sales, todos, notes, calendar, settings).
- **Settings → Backups → Export vault (.db)** - a clean, single-file copy of the SQLite
  database. Copy this to a USB drive or another folder. To restore: stop the server,
  delete `data/vault.sqlite`, `data/vault.sqlite-wal` and `data/vault.sqlite-shm`, put
  the backup in as `data/vault.sqlite`, and start the server again.

There's no automatic cloud sync by design - back up manually to wherever you trust
(external drive, network share, etc).

## Inventory

- SKU, barcode, category, cost price, sell price, stock, and a low-stock threshold per
  item (badges turn red at or below the threshold).
- **Variants** - add a "variant label" (e.g. "Large", "Red") on any item row to represent
  size/color/bundle options as their own line items.
- **Bulk CSV import/export** from the Inventory screen. Import matches existing items by
  barcode or SKU and updates them; anything unmatched is created new. Expected columns:
  `name,category,sku,barcode,cost_price,sell_price,stock,low_stock_threshold,variant_label`.
  Files saved from Excel work as-is. Blank cells on an existing item leave that field
  unchanged. The import runs as one transaction, so a bad file changes nothing.

## Barcode scanners

Any standard USB "keyboard wedge" barcode scanner works out of the box - plug it in,
click into the **scan field** at the top of Checkout, and scan. The scanner types the
code and hits Enter automatically; VaultPOS looks it up by barcode or SKU and adds it to
the cart. No drivers or configuration needed.

## Receipt printing & cash drawer

Checkout uses the browser's native print dialog (`window.print()`) with a 32-column
receipt layout that fits 58mm and 80mm paper, so it works with **any printer your OS already knows about** - including most
USB/network thermal receipt printers that register as a normal system printer, and most
of those printers will also pulse-open a connected cash drawer automatically when a
receipt prints (this is a setting in the printer's own driver/OS print settings, not in
VaultPOS).

If you have a thermal printer that needs **raw ESC/POS commands** (bypassing the OS print
dialog entirely) rather than the standard system print path, that requires a small
platform-specific helper (e.g. the `node-thermal-printer` or `escpos` npm packages talking
to the printer over USB/serial/network) - this is printer-model-specific, so it's left as
a follow-up integration point rather than guessed at here; the receipt HTML in
`public/js/app.js` (`printReceipt`) is the place to wire that in.

## Themes

Settings → Theme lets you switch between three presets, each with light and dark
variants:

- **Girly / Pastel Pop** - blush pink, cream, pastel lavender, pill-shaped buttons.
- **Earthy / Botanical** - sage green, terracotta, oatmeal, serif headings.
- **Serious / Corporate** - slate/navy, neon-blue accents, glass-panel cards.

All fonts are system-font stacks (no web fonts fetched), so themes render correctly with
zero internet connection.

## Project layout

```
vaultpos/
  server.js         # HTTP server + all API routes (also started by the desktop app)
  db.js             # SQLite schema, migrations, seed data, PIN hashing
  package.json
  start-windows.bat
  start-linux.sh
  desktop/
    main.js         # desktop app (Electron): window, menus, backups, LAN sharing
    icons/          # app icons for Windows (.ico) and Linux (.png)
  .github/workflows/
    build.yml       # tests on Windows + Linux, builds releases from version tags
  test/
    api.test.js     # end-to-end API tests (npm test)
  public/
    index.html      # single-page app shell
    manifest.webmanifest, sw.js, icons/   # installable web app
    favicon.svg
    css/styles.css  # theme tokens + component styles
    js/app.js       # all frontend logic
  data/
    vault.sqlite    # created automatically on first run (not committed to git)
```

## Building the desktop apps yourself

```bash
npm install
npm run desktop       # run the desktop app from source
npm run dist:linux    # AppImage + .deb in dist/
npm run dist:win      # Windows installer + portable .exe in dist/
```

Building the Windows files on Linux needs Wine installed. The easy route is to let
GitHub do it: pushing a tag such as `v1.2.0` runs `.github/workflows/build.yml`, which
tests on Windows and Linux, builds every file on the matching system, and attaches
them to a GitHub Release.

## Running the tests

```bash
npm test
```

This starts a real server on a spare port with a throwaway data folder and checks login,
permissions, checkout pricing and stock, reports, backups, CSV import, and a few attack
cases. Your own `data/` folder is never touched.

## Security note

This is designed to be trusted on a **private local network only** (your shop's Wi-Fi).
PINs are hashed with scrypt, logins use random session tokens, wrong PINs are
rate-limited, and the server prices every sale itself. There is still no TLS/HTTPS, so
anyone on the same network could read traffic. Don't expose port 6969 to the public
internet or an untrusted network.

## Changelog

### 1.2.0
- **Desktop app for Windows and Linux**: installer, portable `.exe`, AppImage and
  `.deb`. No Node.js needed. Built-in backup, restore, data folder and LAN sharing
  menus, remembers its window size, single instance.
- **Installable web app**: manifest, icons and an offline app shell so it can be added
  to home screens and installed from Chrome/Edge.
- Automatic builds and releases on GitHub, with tests run on both Windows and Linux.
- The server can now be started from code (`require('./server').start()`), which is how
  the desktop app runs it.

### 1.1.0
**Security**
- Logins now issue a random session token. Before, the server trusted an
  `X-Profile-Id` header, so any device on the network could act as the owner just by
  sending `X-Profile-Id: 1`.
- Every API route except the login screen now needs a logged-in profile (clients,
  sales, to-dos and the calendar were open to anyone on the network).
- Checkout is priced from the database. The browser used to send its own prices and
  costs, so a sale could be recorded at any price.
- Staff devices no longer receive cost prices or profit figures; the inventory CSV
  export for staff leaves out cost.
- Wrong-PIN lockout, PIN/role/color validation, escaping fixes for stored text, CSV
  formula-injection protection, and stricter static-file path checks.
- The last admin can no longer be demoted.

**Fixes**
- Printed receipts were blank: the receipt area kept its `display:none` when printing.
- 5 and 6 digit PINs could never be entered, because the pad tried to log in at 4
  digits. Added an Unlock button and keyboard entry.
- Settings → Backups and Reports → Export CSV downloads failed with "Admin access
  required", because plain links don't carry login details. Downloads now go through
  the logged-in session.
- A malformed URL could crash the whole server.
- `start-windows.bat` / `start-linux.sh` failed on Node 22.5-22.12 (SQLite was behind a
  flag). The minimum is now 22.13 and the scripts explain how to fix a missing or old
  Node.js.
- Overselling: stock could go to zero silently when two tills sold the last item at the
  same time. Checkout is now a single transaction that rejects it.
- Large reports could fail with "too many SQL variables".
- Dates showed "Invalid Date" in Safari/iPad.
- The checkout client picker now resets to walk-in after each sale.
- Deleting a client no longer fails because of their past sales.
- Excel CSVs (with a BOM) imported every row as "Unnamed item".
- The Clients tab made one request per client; it now loads in one.
- `.db` export now uses `VACUUM INTO` for a consistent single-file copy.
- Port already in use now shows a clear message instead of a stack trace.

**Added**
- Delete client (admin), favicon, automated tests, `HOST` / `VAULTPOS_DATA_DIR` options.

### 1.0.0
- First release.
