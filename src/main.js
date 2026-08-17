'use strict';

const {
  app, BrowserWindow, Menu, Tray, shell, dialog, ipcMain, nativeImage,
} = require('electron');
const path = require('path');
const fs = require('fs');

const { Settings } = require('./settings');
const { DshServer } = require('./server');

const APP_NAME = 'DeepSeek Harness';

let mainWindow = null;
let tray = null;
let server = null;
let settings = null;
let isQuitting = false;
let currentUrl = null;

const SPLASH = path.join(__dirname, 'splash.html');

// Electron's Chromium sandbox needs a setuid helper on some Linux setups.
// Running as root or with DSH_NO_SANDBOX=1 falls back gracefully.
if (process.env.DSH_NO_SANDBOX === '1' || (typeof process.getuid === 'function' && process.getuid() === 0)) {
  app.commandLine.appendSwitch('no-sandbox');
}

function assetPath(rel) {
  return path.join(__dirname, '..', rel);
}

function resolveTrayIcon() {
  const candidates = [
    assetPath('assets/tray.png'),
    assetPath('build/icons/32x32.png'),
    assetPath('assets/icon.png'),
  ];
  for (const c of candidates) { if (fs.existsSync(c)) return c; }
  return null;
}

function showError(message) {
  console.error('[dsh-desktop] error:', message);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadFile(SPLASH, { query: { error: String(message) } }).catch(() => {});
  }
}

function autostartFilePath() {
  return path.join(app.getPath('home'), '.config', 'autostart', 'deepseek-harness.desktop');
}

function setAutoStart(enabled) {
  try {
    const file = autostartFilePath();
    if (enabled) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const exec = app.isPackaged
        ? '"' + process.execPath + '"'
        : '"' + process.execPath + '" "' + app.getAppPath() + '"';
      const content = [
        '[Desktop Entry]',
        'Type=Application',
        'Name=' + APP_NAME,
        'Exec=' + exec,
        'X-GNOME-Autostart-enabled=true',
        'Comment=Start DeepSeek Harness on login',
        'Terminal=false',
        '',
      ].join('\n');
      fs.writeFileSync(file, content);
    } else if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    settings.set('autoStart', enabled);
  } catch (err) {
    console.error('[dsh-desktop] autostart failed:', err);
  }
}

async function startServer() {
  if (server) {
    server.removeAllListeners();
    server.stop();
  }
  const opts = {
    host: settings.get('host') || '127.0.0.1',
    port: Number(settings.get('port')) || 0,
    dshHome: settings.get('dshHome') || '',
  };
  server = new DshServer(opts);
  server.on('stdout', (line) => process.stdout.write(line));
  server.on('stderr', (line) => process.stderr.write(line));
  server.on('error', (err) => console.error('[dsh-desktop] server error:', err));
  server.on('exit', (info) => {
    console.warn('[dsh-desktop] dsh server exited:', info.code != null ? info.code : info.signal);
    if (!isQuitting) {
      const why = info.code != null ? ('code ' + info.code) : ('signal ' + info.signal);
      showError('DeepSeek Harness 服务已退出（' + why + '）。');
    }
  });
  try {
    const url = await server.start();
    currentUrl = url;
    console.log('[dsh-desktop] harness ready at', url);
    if (mainWindow && !mainWindow.isDestroyed()) {
      await mainWindow.loadURL(url);
    }
    updateTrayMenu();
  } catch (err) {
    console.error('[dsh-desktop] failed to start server:', err);
    showError(err && err.message ? err.message : String(err));
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 940,
    minHeight: 600,
    title: APP_NAME,
    show: false,
    backgroundColor: '#0b0f19',
    icon: assetPath('assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.loadFile(SPLASH);
  mainWindow.once('ready-to-show', () => { if (!isQuitting) mainWindow.show(); });

  mainWindow.on('close', (event) => {
    if (!isQuitting && settings.get('closeToTray')) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });

  const wc = mainWindow.webContents;
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (event, url) => {
    if (currentUrl && url !== currentUrl && url.indexOf(currentUrl) !== 0 && /^https?:\/\//i.test(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  wc.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && url.indexOf('file:') !== 0) {
      showError('页面加载失败（' + code + '）：' + desc);
    }
  });
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function showAbout() {
  const info =
    'DeepSeek Harness Desktop' + '\n\n' +
    '一个非官方的 Linux 桌面壳，把 DeepSeek Harness（dsh）的浏览器界面封装为原生窗口。' + '\n' +
    '版本：' + app.getVersion() + '\n' +
    'Electron：' + process.versions.electron + '\n' +
    (currentUrl ? ('服务地址：' + currentUrl + '\n') : '');
  const opts = {
    type: 'info', title: '关于 DeepSeek Harness', message: APP_NAME, detail: info, buttons: ['确定'],
  };
  if (mainWindow && !mainWindow.isDestroyed()) dialog.showMessageBox(mainWindow, opts);
  else dialog.showMessageBox(opts);
}

function buildAppMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '在浏览器中打开', click: () => { if (currentUrl) shell.openExternal(currentUrl); } },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', accelerator: 'CmdOrCtrl+R', click: () => { if (mainWindow) mainWindow.reload(); } },
        { label: '强制重新加载', accelerator: 'CmdOrCtrl+Shift+R', click: () => { if (mainWindow) mainWindow.webContents.reloadIgnoringCache(); } },
        { type: 'separator' },
        { label: '实际大小', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: '放大', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: '切换开发者工具', accelerator: 'CmdOrCtrl+Shift+I', role: 'toggleDevTools' },
      ],
    },
    {
      label: '帮助',
      submenu: [ { label: '关于 DeepSeek Harness', click: showAbout } ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function updateTrayMenu() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: '显示 DeepSeek Harness', click: showMainWindow },
    { label: '在浏览器中打开', enabled: !!currentUrl, click: () => { if (currentUrl) shell.openExternal(currentUrl); } },
    { type: 'separator' },
    { label: '开机自启动', type: 'checkbox', checked: !!settings.get('autoStart'), click: (item) => setAutoStart(item.checked) },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(APP_NAME + (currentUrl ? (' — ' + currentUrl) : ''));
}

function createTray() {
  try {
    const iconPath = resolveTrayIcon();
    const image = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
    tray = new Tray(image);
    tray.on('click', () => {
      if (mainWindow && mainWindow.isVisible()) mainWindow.hide();
      else showMainWindow();
    });
    updateTrayMenu();
  } catch (err) {
    console.warn('[dsh-desktop] system tray unavailable:', err && err.message ? err.message : err);
    tray = null;
  }
}

function wireIpc() {
  ipcMain.on('dsh:retry', () => startServer());
  ipcMain.on('dsh:open-external', (_e, url) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showMainWindow());

  app.whenReady().then(() => {
    if (process.argv.includes('--devtools')) app.commandLine.appendSwitch('auto-open-devtools-for-tabs');
    settings = new Settings(path.join(app.getPath('userData'), 'settings.json'));
    wireIpc();
    buildAppMenu();
    createWindow();
    createTray();
    startServer();
  });

  app.on('before-quit', () => {
    isQuitting = true;
    if (server) {
      server.removeAllListeners('exit');
      server.stop();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      if (server && server.url) mainWindow.loadURL(server.url).catch(() => {});
      else startServer();
    } else {
      showMainWindow();
    }
  });
}
