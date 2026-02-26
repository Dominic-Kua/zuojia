const { contextBridge, ipcRenderer } = require('electron');

/**
 * Safely expose IPC API to renderer
 * Uses contextBridge to prevent security issues
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Invoke an IPC handler
   * @param {string} handler - Handler name
   * @param {object} payload - Data to send
   * @returns {Promise} Handler response
   */
  invoke: (handler, payload) => ipcRenderer.invoke(handler, payload),

  /**
   * Listen for events from main process
   * @param {string} event - Event name
   * @param {function} callback - Handler function
   */
  on: (event, callback) => ipcRenderer.on(event, callback),

  /**
   * Stop listening for events
   * @param {string} event - Event name
   * @param {function} callback - Handler function
   */
  off: (event, callback) => ipcRenderer.off(event, callback),
});
