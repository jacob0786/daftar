// Daftar for desktop: a window that runs the same app as the phone (its web build),
// keeps notes in its own SQLite database, and syncs with the same Turso database.
const { app, BrowserWindow, ipcMain, net, protocol, safeStorage, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const APP_DIR = path.join(__dirname, 'app'); // the exported web build
const SECURE_FILE = () => path.join(app.getPath('userData'), 'secure.json');

// --- Serve the app from app:// with the headers SQLite needs (shared memory for its database worker) ---
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true } },
]);

function serve(request) {
  const url = new URL(request.url);
  let file = path.normalize(path.join(APP_DIR, decodeURIComponent(url.pathname)));
  if (!file.startsWith(APP_DIR)) return new Response('Not found', { status: 404 });
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(APP_DIR, 'index.html'); // app routes
  return net.fetch(pathToFileURL(file).toString()).then((res) => {
    const headers = new Headers(res.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    if (file.endsWith('.wasm')) headers.set('Content-Type', 'application/wasm');
    return new Response(res.body, { status: res.status, headers });
  });
}

// --- Secure storage for the Turso token: encrypted by Windows (DPAPI) / macOS Keychain ---
function readSecure() {
  try {
    return JSON.parse(fs.readFileSync(SECURE_FILE(), 'utf8'));
  } catch {
    return {};
  }
}
function writeSecure(data) {
  fs.writeFileSync(SECURE_FILE(), JSON.stringify(data), { mode: 0o600 });
}
ipcMain.handle('secure:get', (_e, key) => {
  const v = readSecure()[key];
  if (!v) return null;
  try {
    return safeStorage.decryptString(Buffer.from(v, 'base64'));
  } catch {
    return null;
  }
});
ipcMain.handle('secure:set', (_e, key, value) => {
  const data = readSecure();
  data[key] = safeStorage.encryptString(String(value)).toString('base64');
  writeSecure(data);
});
ipcMain.handle('secure:delete', (_e, key) => {
  const data = readSecure();
  delete data[key];
  writeSecure(data);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 520,
    title: 'Daftar',
    backgroundColor: '#FAFAF6',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  // Links in notes open in the normal browser, never inside Daftar
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://')) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  win.loadURL(`app://daftar/${process.env.DAFTAR_TEST_ROUTE ?? ''}`);

  // Test mode (DAFTAR_TEST=path.png): print page messages, save a screenshot after a few seconds, then quit
  if (process.env.DAFTAR_TEST) {
    win.webContents.on('console-message', (e) => console.log(`[page ${e.level}] ${e.message}`));
    setTimeout(async () => {
      const img = await win.webContents.capturePage();
      fs.writeFileSync(process.env.DAFTAR_TEST, img.toPNG());
      const isolated = await win.webContents.executeJavaScript('self.crossOriginIsolated');
      console.log(`[test] screenshot saved, crossOriginIsolated=${isolated}`);
      app.quit();
    }, Number(process.env.DAFTAR_TEST_WAIT || 12000));
  }
}

// One window only; opening Daftar again focuses it
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => {
  const [w] = BrowserWindow.getAllWindows();
  if (w) {
    if (w.isMinimized()) w.restore();
    w.focus();
  }
});

app.whenReady().then(() => {
  protocol.handle('app', serve);
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
