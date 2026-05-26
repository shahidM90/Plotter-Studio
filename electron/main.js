import { app, BrowserWindow, Menu, nativeImage, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PLOTTER_SERVER_PORT || 5426);
const HOST = process.env.PLOTTER_SERVER_HOST || '127.0.0.1';

// Required on Windows so the taskbar / Task Manager show "Plotter Studio"
// instead of "electron.exe". Must be set before app.whenReady().
if (process.platform === 'win32') {
  app.setAppUserModelId('com.plotterstudio.app');
}

// Remove the native menu bar entirely (Task 2)
Menu.setApplicationMenu(null);

let mainWindow = null;

function loadAppIcon() {
  // In production, icon is in extraResources; in dev, it's in build/
  const pngPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '..', 'build', 'icon-256.png');
  try {
    return nativeImage.createFromPath(pngPath);
  } catch {
    return null;
  }
}

function createWindow() {
  const icon = loadAppIcon();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Plotter Studio',
    backgroundColor: '#10120f',
    icon,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Prevent white flash on startup (Task 5)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  const url = devServer || `http://${HOST}:${PORT}`;
  mainWindow.loadURL(url);

  // DevTools accessible only in dev mode (Task 2)
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await startServer(PORT, HOST, { openBrowser: false });
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
