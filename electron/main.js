import { app, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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
  // Spawn the Python helper (FastAPI) for orchestration in development.
  // Uses port 5178 by default; change via env `NETWRITER_HELPER_PORT`.
  const isDev = process.env.NODE_ENV !== 'production'
  const helperPort = process.env.NETWRITER_HELPER_PORT || '5178'
  let helperProc = null
  try {
    const helperPath = path.join(__dirname, '..', 'helper', 'api.py')
    helperProc = spawn('python3', [helperPath, helperPort], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    })
    helperProc.on('error', (err) => {
      console.error('Failed to start helper process:', err)
    })
    process.on('exit', () => {
      if (helperProc && !helperProc.killed) helperProc.kill()
    })
  } catch (e) {
    console.warn('Could not spawn helper process (continue without helper):', e)
  }

  createWindow()
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})
