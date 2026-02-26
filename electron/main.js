import { app, BrowserWindow } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { registerHandlers } from './ipc-handlers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const isDev = process.env.NODE_ENV !== 'production'
  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  // Register all IPC handlers
  registerHandlers()

  createWindow()
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})
