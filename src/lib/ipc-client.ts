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
};

export const gitHandlers = {
  commit: (novelPath, message, files) =>
    invokeHandler('helper:git:commit', { novelPath, message, files }),
  pull: (novelPath) => invokeHandler('helper:git:pull', { novelPath }),
  push: (novelPath) => invokeHandler('helper:git:push', { novelPath }),
  history: (novelPath, limit) => invokeHandler('helper:git:history', { novelPath, limit }),
};

export const exportHandlers = {
  pdf: (novelPath, format, metadata) =>
    invokeHandler('helper:export:pdf', { novelPath, format, metadata }),
  validateDeps: () => invokeHandler('helper:export:validateDeps'),
};

export const wikiHandlers = {
  rebuildDict: (novelPath) => invokeHandler('helper:wiki:rebuildDict', { novelPath }),
};

export const backupHandlers = {
  createSnapshot: (novelPath, label) =>
    invokeHandler('helper:backup:createSnapshot', { novelPath, label }),
  listSnapshots: (novelPath) => invokeHandler('helper:backup:listSnapshots', { novelPath }),
  restore: (novelPath, snapshotId) =>
    invokeHandler('helper:backup:restore', { novelPath, snapshotId }),
};
