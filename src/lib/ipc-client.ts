/**
 * IPC Client wrapper for calling helper handlers
 * Provides error handling and response envelope parsing
 */

/**
 * Call a helper handler via IPC
 * @param {string} handler - Handler name (e.g., 'helper:index:createNovel')
 * @param {object} payload - Data to send to handler
 * @returns {Promise<{status, data, error, timestamp}>} Response envelope
 */
export async function invokeHandler(handler, payload = {}) {
  try {
    if (!window.electronAPI) {
      throw new Error('Electron IPC not available');
    }

    const response = await window.electronAPI.invoke(handler, payload);

    if (!response) {
      throw new Error(`No response from handler: ${handler}`);
    }

    // Handler returned error envelope
    if (response.status === 'error') {
      const err = new Error(response.error.message);
      err.code = response.error.code;
      err.suggestion = response.error.suggestion;
      err.context = response.error.context;
      throw err;
    }

    return response.data;
  } catch (err) {
    console.error(`IPC error in ${handler}:`, err);
    throw err;
  }
}

/**
 * Helper-specific handlers
 */

export const indexHandlers = {
  createNovel: (novelName) => invokeHandler('helper:index:createNovel', { novelName }),
  getIndex: (novelPath) => invokeHandler('helper:index:get', { novelPath }),
  validateNovel: (novelPath) => invokeHandler('helper:index:validate', { novelPath }),
  rebuildIndex: (novelPath) => invokeHandler('helper:index:rebuild', { novelPath }),
};

export const chapterHandlers = {
  readChapter: (novelPath, filename) => invokeHandler('helper:chapter:read', { novelPath, filename }),
  writeChapter: (novelPath, filename, content) => invokeHandler('helper:chapter:write', { novelPath, filename, content }),
};

export const appHandlers = {
  selectNovelDirectory: () => invokeHandler('app:selectNovelDirectory'),
  listNovels: () => invokeHandler('app:listNovels'),
  markNovelOpened: (novelPath) => invokeHandler('app:markNovelOpened', { novelPath }),
};

export const gitHandlers = {
  commit: (novelPath, filename, content) =>
    invokeHandler('helper:git:commit', { novelPath, filename, content }),
  getConfig: (novelPath) => invokeHandler('helper:git:getConfig', { novelPath }),
  listChanges: (novelPath) => invokeHandler('helper:git:listChanges', { novelPath }),
  manualCommit: (novelPath, files, message) =>
    invokeHandler('helper:git:manualCommit', { novelPath, files, message }),
  pull: (novelPath) => invokeHandler('helper:git:pull', { novelPath }),
  push: (novelPath) => invokeHandler('helper:git:push', { novelPath }),
  saveConfig: (novelPath, settings) => invokeHandler('helper:git:saveConfig', { novelPath, settings }),
  history: (novelPath, limit) => invokeHandler('helper:git:history', { novelPath, limit }),
};

export const statsHandlers = {
  wordCount: (content) => invokeHandler('helper:stats:word-count', { content }),
  manuscriptCount: (novelPath) => invokeHandler('helper:stats:manuscript-count', { novelPath }),
  todayCount: (novelPath) => invokeHandler('helper:stats:today-count', { novelPath }),
};

export const exportHandlers = {
  pdf: (novelPath, metadata) =>
    invokeHandler('helper:export:pdf', { novelPath, metadata }),
  validateDeps: () => invokeHandler('helper:export:validateDeps'),
  getLogs: (novelPath, limit = 10) =>
    invokeHandler('helper:export:getLogs', { novelPath, limit }),
};

export const wikiHandlers = {
  create: (novelPath, title, content, tags = []) => invokeHandler('helper:wiki:create', { novelPath, title, content, tags }),
  read: (novelPath, slug) => invokeHandler('helper:wiki:read', { novelPath, slug }),
  update: (novelPath, slug, content, tags = []) => invokeHandler('helper:wiki:update', { novelPath, slug, content, tags }),
  delete: (novelPath, slug) => invokeHandler('helper:wiki:delete', { novelPath, slug }),
  rename: (novelPath, oldSlug, newTitle) => invokeHandler('helper:wiki:rename', { novelPath, oldSlug, newTitle }),
  list: (novelPath) => invokeHandler('helper:wiki:list', { novelPath }),
  rebuildDict: (novelPath) => invokeHandler('helper:wiki:rebuildDict', { novelPath }),
  getSpellcheckDict: (novelPath) => invokeHandler('helper:wiki:getSpellcheckDict', { novelPath }),
  addToDict: (novelPath, word) => invokeHandler('helper:wiki:addToDict', { novelPath, word }),
};

export const backupHandlers = {
  createSnapshot: (novelPath, label) =>
    invokeHandler('helper:backup:createSnapshot', { novelPath, label }),
  listSnapshots: (novelPath) => invokeHandler('helper:backup:listSnapshots', { novelPath }),
  deleteSnapshot: (novelPath, timestamp) =>
    invokeHandler('helper:backup:deleteSnapshot', { novelPath, timestamp }),
  restore: (novelPath, timestamp) =>
    invokeHandler('helper:backup:restore', { novelPath, timestamp }),
};

export const llmHandlers = {
  getConfig: () => invokeHandler('helper:llm:getConfig'),
  saveConfig: (settings) => invokeHandler('helper:llm:saveConfig', { settings }),
  startRuntime: (settings) => invokeHandler('helper:llm:startRuntime', { settings }),
  stopRuntime: () => invokeHandler('helper:llm:stopRuntime'),
  restartRuntime: (settings) => invokeHandler('helper:llm:restartRuntime', { settings }),
  health: () => invokeHandler('helper:llm:health'),
  chat: (messages) => invokeHandler('helper:llm:chat', { messages }),
};

export const mcpHandlers = {
  startServer: (novelPath) => invokeHandler('helper:mcp:startServer', { novelPath }),
  stopServer: () => invokeHandler('helper:mcp:stopServer'),
  health: () => invokeHandler('helper:mcp:health'),
  callTool: (toolName, args = {}, options = {}) =>
    invokeHandler('helper:mcp:callTool', {
      toolName,
      args,
      timeoutMs: options.timeoutMs,
      retries: options.retries,
    }),
  getLogs: (limit = 50) => invokeHandler('helper:mcp:getLogs', { limit }),
};
