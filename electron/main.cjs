const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const storymapWindows = new Map();

function getRendererMode() {
  const forcedMode = process.env.ZUOJIA_RENDERER_MODE;
  if (forcedMode === 'development' || forcedMode === 'production') {
    return forcedMode;
  }

  if (app.isPackaged || process.env.NODE_ENV === 'production') {
    return 'production';
  }

  return 'development';
}

function resolveRendererEntry() {
  if (app.isPackaged) {
    const packagedEntry = path.join(process.resourcesPath, 'dist', 'index.html');
    if (fs.existsSync(packagedEntry)) {
      return packagedEntry;
    }
  }

  const distEntry = path.join(__dirname, '../dist/index.html');
  if (fs.existsSync(distEntry)) {
    return distEntry;
  }

  const rootEntry = path.join(__dirname, '../index.html');
  if (fs.existsSync(rootEntry)) {
    return rootEntry;
  }

  return distEntry;
}

let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  const rendererMode = getRendererMode();
  if (rendererMode === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(resolveRendererEntry());
  }

  mainWindow = win;
  win.on('closed', () => {
    mainWindow = null;
  });
}

function getStorymapBoundsPath() {
  return path.join(app.getPath('userData'), 'storymap-windows.json');
}

function loadAllStorymapBounds() {
  try {
    const data = fs.readFileSync(getStorymapBoundsPath(), 'utf-8');
    const parsed = JSON.parse(data);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveStorymapBounds(novelPath, bounds) {
  try {
    const all = loadAllStorymapBounds();
    all[novelPath] = bounds;
    fs.writeFileSync(getStorymapBoundsPath(), JSON.stringify(all, null, 2), 'utf-8');
  } catch (err) {
    console.error('[storymap] failed to save window bounds:', err);
  }
}

function loadStorymapWindowBounds(novelPath) {
  const all = loadAllStorymapBounds();
  const stored = all[novelPath];
  if (
    stored &&
    typeof stored.x === 'number' &&
    typeof stored.y === 'number' &&
    typeof stored.width === 'number' &&
    typeof stored.height === 'number'
  ) {
    return stored;
  }
  return null;
}

function createStorymapWindow(novelPath) {
  const existing = storymapWindows.get(novelPath);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    return existing;
  }

  const defaults = { width: 1200, height: 800, x: undefined, y: undefined };
  const stored = loadStorymapWindowBounds(novelPath);
  const bounds = stored ? { ...defaults, ...stored } : defaults;

  const win = new BrowserWindow({
    ...bounds,
    title: 'Story Map',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--novel-path=${novelPath}`],
    },
  });

  win.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  const rendererMode = getRendererMode();
  if (rendererMode === 'development') {
    win.loadURL(`http://localhost:5173?view=storymap&novelPath=${encodeURIComponent(novelPath)}`);
  } else {
    win.loadFile(resolveRendererEntry(), {
      query: {
        view: 'storymap',
        novelPath,
      },
    });
  }

  function persistBounds() {
    if (win.isDestroyed()) return;
    saveStorymapBounds(novelPath, win.getBounds());
  }

  win.on('resize', persistBounds);
  win.on('move', persistBounds);
  win.on('closed', () => {
    persistBounds();
    storymapWindows.delete(novelPath);
  });

  storymapWindows.set(novelPath, win);
  return win;
}

function registerWindowHandlers() {
  ipcMain.handle('storymap-window:open', (event, novelPath) => {
    if (typeof novelPath !== 'string' || novelPath.length === 0) {
      return { status: 'error', error: { code: 'INVALID_INPUT', message: 'novelPath is required' } };
    }
    createStorymapWindow(novelPath);
    return { status: 'ok', data: { opened: true } };
  });

  ipcMain.handle('storymap:open-wiki-page', (event, slug) => {
    if (typeof slug !== 'string' || slug.length === 0) {
      return { status: 'error', error: { code: 'INVALID_INPUT', message: 'slug is required' } };
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('wiki:open-page', slug);
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    return { status: 'ok', data: { sent: true } };
  });
}

async function main() {
  // Import the ESM module dynamically
  const { registerHandlers } = await import('./ipc-handlers.js');
  
  app.whenReady().then(() => {
    // Register all IPC handlers
    registerHandlers();
    registerWindowHandlers();
    createWindow();
    
    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  }).catch(console.error);

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
  });
}

main().catch(error => {
  console.error('Failed to start app:', error);
  process.exit(1);
});

