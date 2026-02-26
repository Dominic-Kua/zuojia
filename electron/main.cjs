const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

async function main() {
  // Import the ESM module dynamically
  const { registerHandlers } = await import('./ipc-handlers.js');
  
  app.whenReady().then(() => {
    // Register all IPC handlers
    registerHandlers();
    createWindow();
    
    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
  });
}

main().catch(error => {
  console.error('Failed to start app:', error);
  process.exit(1);
});

