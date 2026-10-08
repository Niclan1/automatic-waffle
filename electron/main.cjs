const { app, BrowserWindow, protocol, net, session, ipcMain, shell, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHash, randomUUID } = require('node:crypto');
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
const csp = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://niclan1.github.io; media-src 'self' blob:; frame-src 'self' blob:; connect-src 'self' https://niclan1.github.io; object-src 'none'";
let mainWindow;
if (process.env.VOLKSPELE_TEST_DATA) app.setPath('userData', process.env.VOLKSPELE_TEST_DATA);
function hashPath(hash) {
  if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid content hash');
  return path.join(app.getPath('userData'), 'content', hash);
}
async function verified(hash) {
  const bytes = await fs.readFile(hashPath(hash));
  if (createHash('sha256').update(bytes).digest('hex') !== hash) throw new Error('Saved content integrity check failed');
  return bytes;
}
function trusted(event) { if (event.sender !== mainWindow?.webContents || !event.senderFrame?.url.startsWith('app://volkspele/')) throw new Error('Untrusted caller'); }
function handler(name, fn) { ipcMain.handle(name, async (event, args) => { trusted(event); return fn(args); }); }
app.whenReady().then(async () => {
  const root = path.resolve(__dirname, '../dist');
  protocol.handle('app', request => {
    const url = new URL(request.url);
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (url.host !== 'volkspele' || !file.startsWith(root + path.sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).href);
  });
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] } }));
  mainWindow = new BrowserWindow({ show: !process.env.VOLKSPELE_TEST_DATA, width: 1280, height: 900, minWidth: 360, minHeight: 600, title: 'Volkspele', backgroundColor: '#f8f9f6', icon: path.join(__dirname, '../build/icon.png'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('app://volkspele/')) event.preventDefault(); });
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  handler('save_content', async ({ hash, bytes }) => {
    const destination = hashPath(hash);
    if (!Array.isArray(bytes) || !bytes.length || bytes.length > 250_000_000 || bytes.some(b => !Number.isInteger(b) || b < 0 || b > 255)) throw new Error('Invalid file data');
    const data = Buffer.from(bytes);
    if (createHash('sha256').update(data).digest('hex') !== hash) throw new Error('Content integrity check failed');
    await fs.mkdir(path.dirname(destination), { recursive: true });
    try { await verified(hash); return; } catch { /* Repair a missing or corrupt file. */ }
    const temp = destination + '.' + randomUUID() + '.partial';
    try { await fs.writeFile(temp, data); await fs.rename(temp, destination); }
    finally { await fs.rm(temp, { force: true }); }
  });
  handler('read_content', async ({ hash }) => Array.from(await verified(hash)));
  handler('delete_content', async ({ hash }) => fs.rm(hashPath(hash), { force: true }));
  handler('open_release', async ({ url }) => {
    if (typeof url !== 'string' || !/^https:\/\/github\.com\/Niclan1\/automatic-waffle\/releases(?:\/|$)/.test(url)) throw new Error('Invalid release URL');
    await shell.openExternal(url);
  });
  handler('open_official', async ({ url }) => { if (url !== 'https://volkspele.co.za/avvb/') throw new Error('Invalid official site URL'); await shell.openExternal(url); });
  handler('export_content', async ({ hash, title, mime }) => {
    const bytes = await verified(hash);
    const ext = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'application/pdf': 'pdf', 'text/plain': 'txt', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime] ?? 'bin';
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, { defaultPath: `${String(title).replace(/[^\p{L}\p{N} _-]/gu, '')}.${ext}` });
    if (!canceled && filePath) await fs.writeFile(filePath, bytes);
  });
  mainWindow.removeMenu();
  await mainWindow.loadURL('app://volkspele/index.html');
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show(); else { app.relaunch(); app.exit(); } });
