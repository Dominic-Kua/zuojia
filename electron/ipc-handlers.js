import { ipcMain } from 'electron'
import { createNovel, getIndex } from '../helper/src/index/index.js'

/**
 * Register all IPC handlers
 * Formats responses as structured envelopes
 */

function wrapHandler(fn) {
  return async (event, payload) => {
    return await fn(payload);
  };
}

export function registerHandlers() {
  // Index handlers
  ipcMain.handle(
    'helper:index:createNovel',
    wrapHandler(async ({ novelName }) => {
      return await createNovel(novelName);
    })
  );

  ipcMain.handle(
    'helper:index:get',
    wrapHandler(async ({ novelPath }) => {
      return await getIndex(novelPath);
    })
  );

  // TODO: Register other handlers as they're implemented
  // - helper:git:commit
  // - helper:git:pull
  // - helper:git:push
  // - helper:git:history
  // - helper:export:pdf
  // - helper:export:validateDeps
  // - helper:wiki:rebuildDict
  // - helper:backup:createSnapshot
  // - helper:backup:listSnapshots
  // - helper:backup:restore
}
