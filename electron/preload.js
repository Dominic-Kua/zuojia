import { contextBridge } from 'electron'

// Minimal preload — expose safe, future-friendly API surface
contextBridge.exposeInMainWorld('netwriter', {
  platform: process.platform
})
