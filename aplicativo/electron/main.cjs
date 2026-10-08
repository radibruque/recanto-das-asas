const { app, BrowserWindow, protocol, net, session, shell, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

// These names and the app:// origin are part of the data/update compatibility contract.
app.setName('RecantoDasAsas');
app.setPath('userData', path.join(app.getPath('appData'), 'RecantoDasAsas'));
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const origin = 'app://recanto';
const contentRoot = path.resolve(__dirname, '../dist');
const contentSecurityPolicy = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https:; worker-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'";
const safeLocalUrl = (url) => url.startsWith(`${origin}/`) || url.startsWith(`blob:${origin}/`);

function protectWindow(window) {
  window.webContents.on('will-navigate', (event, url) => {
    if (!safeLocalUrl(url)) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (safeLocalUrl(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: {
        autoHideMenuBar: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
      } };
    }
    // Only HTTPS destinations may be delegated to the browser; never shell commands.
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('did-create-window', protectWindow);
}

function createWindow() {
  const window = new BrowserWindow({
    title: 'Recanto das Asas', width: 1280, height: 840, minWidth: 360, minHeight: 560,
    backgroundColor: '#f7f4ed', autoHideMenuBar: true,
    icon: path.join(__dirname, '../native/icon.png'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
  });
  protectWindow(window);
  void window.loadURL(`${origin}/index.html`);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window) { if (window.isMinimized()) window.restore(); window.focus(); }
  });
  app.whenReady().then(() => {
    protocol.handle('app', (request) => {
      let url;
      try { url = new URL(request.url); } catch { return new Response('Endereço inválido', { status: 400 }); }
      if (url.hostname !== 'recanto') return new Response('Origem inválida', { status: 403 });
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { return new Response('Endereço inválido', { status: 400 }); }
      let filename = path.resolve(contentRoot, `.${pathname}`);
      if (!filename.startsWith(`${contentRoot}${path.sep}`)) return new Response('Acesso negado', { status: 403 });
      if (!fs.existsSync(filename) && !path.extname(pathname)) filename = path.join(contentRoot, 'index.html');
      if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) return new Response('Arquivo não encontrado', { status: 404 });
      return net.fetch(pathToFileURL(filename).href);
    });
    session.defaultSession.webRequest.onHeadersReceived({ urls: ['app://recanto/*'] }, (details, callback) => {
      callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [contentSecurityPolicy] } });
    });
    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
      callback(permission === 'clipboard-sanitized-write');
    });
    session.defaultSession.setPermissionCheckHandler((_contents, permission) => permission === 'clipboard-sanitized-write');
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  }).catch((error) => {
    // Avoid including private paths or records in an OS error dialog.
    dialog.showErrorBox('Recanto das Asas', `Não foi possível iniciar o aplicativo (${error.code || 'E_START'}).`);
    app.quit();
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
