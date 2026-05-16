import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { registerHandlers } from './ipc-handlers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function resolveRendererEntry () {
  if (app.isPackaged) {
    const packagedEntry = path.join(process.resourcesPath, 'dist', 'index.html')
    if (fs.existsSync(packagedEntry)) {
      return packagedEntry
    }
  }

  const distEntry = path.join(__dirname, '../dist/index.html')
  if (fs.existsSync(distEntry)) {
    return distEntry
  }

  const rootEntry = path.join(__dirname, '../index.html')
  if (fs.existsSync(rootEntry)) {
    return rootEntry
  }

  return distEntry
}

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

  const isDev = !app.isPackaged
  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(resolveRendererEntry())
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
