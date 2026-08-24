const { contextBridge, ipcRenderer } = require('electron');

/**
 * Safely expose IPC API to renderer.
 * Uses contextBridge with a strict channel allowlist: a compromised renderer
 * can only invoke handlers registered here, not arbitrary IPC channels.
 */
const ALLOWED_INVOKE_CHANNELS = new Set([
  // Index / novels
  'helper:index:createNovel',
  'helper:index:get',
  'helper:index:validate',
  'helper:index:rebuild',
  // Chapters
  'helper:chapter:read',
  'helper:chapter:write',
  // Git
  'helper:git:commit',
  'helper:git:listChanges',
  'helper:git:manualCommit',
  'helper:git:getConfig',
  'helper:git:saveConfig',
  'helper:git:history',
  'helper:git:push',
  // Export
  'helper:export:pdf',
  'helper:export:validateDeps',
  'helper:export:getLogs',
  // Stats
  'helper:stats:word-count',
  'helper:stats:manuscript-count',
  'helper:stats:today-count',
  // Wiki
  'helper:wiki:create',
  'helper:wiki:read',
  'helper:wiki:update',
  'helper:wiki:delete',
  'helper:wiki:rename',
  'helper:wiki:list',
  'helper:wiki:rebuildDict',
  'helper:wiki:getSpellcheckDict',
  'helper:wiki:addToDict',
  // Backups
  'helper:backup:createSnapshot',
  'helper:backup:listSnapshots',
  'helper:backup:deleteSnapshot',
  'helper:backup:restore',
  // LLM
  'helper:llm:getConfig',
  'helper:llm:saveConfig',
  'helper:llm:startRuntime',
  'helper:llm:stopRuntime',
  'helper:llm:restartRuntime',
  'helper:llm:health',
  'helper:llm:chat',
  // MCP
  'helper:mcp:startServer',
  'helper:mcp:stopServer',
  'helper:mcp:health',
  'helper:mcp:callTool',
  'helper:mcp:getLogs',
  // Neo4j
  'helper:neo4j:start',
  'helper:neo4j:stop',
  'helper:neo4j:health',
  'helper:neo4j:import',
  'helper:neo4j:query',
  'helper:neo4j:search',
  'helper:neo4j:getLogs',
  // App orchestration
  'app:listNovels',
  'app:markNovelOpened',
  'app:selectNovelDirectory',
  'app:startNovelServices',
  'app:stopNovelServices',
]);

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Invoke an allowed IPC handler
   * @param {string} handler - Handler name (must be in the allowlist)
   * @param {object} payload - Data to send
   * @returns {Promise} Handler response
   */
  invoke: (handler, payload) => {
    if (!ALLOWED_INVOKE_CHANNELS.has(handler)) {
      return Promise.reject(
        new Error(`IPC channel not allowed: ${String(handler)}`)
      );
    }
    return ipcRenderer.invoke(handler, payload);
  },

  /**
   * Listen for events from main process
   * @param {string} event - Event name
   * @param {function} callback - Handler function, called with message arguments (event object excluded)
   */
  on: (event, callback) => ipcRenderer.on(event, (_, ...args) => callback(...args)),

  /**
   * Stop listening for events
   * @param {string} event - Event name
   * @param {function} callback - Handler function
   */
  off: (event, callback) => ipcRenderer.off(event, callback),
});
