import { ipcMain, dialog } from 'electron'
import { createNovel, getIndex, validateNovel, rebuildIndex, readChapter, writeChapter } from '../helper/src/index/index.js'
import { commitChapter } from '../helper/src/git/commit.js';
import { calculateWordCount } from '../helper/src/stats/word-count.js';
import { getManuscriptWordCount } from '../helper/src/stats/manuscript-count.js';
import { getWordsWrittenToday } from '../helper/src/git/history.js';
import { createWikiPage, readWikiPage, updateWikiPage, deleteWikiPage, renameWikiPage } from '../helper/src/wiki/crud.js';
import { listWikiPages } from '../helper/src/wiki/list-pages.js';
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

  ipcMain.handle(
    'helper:index:validate',
    wrapHandler(async ({ novelPath }) => {
      return await validateNovel(novelPath);
    })
  );

  ipcMain.handle(
    'helper:index:rebuild',
    wrapHandler(async ({ novelPath }) => {
      return await rebuildIndex(novelPath);
    })
  );

  // Chapter handlers
  ipcMain.handle(
    'helper:chapter:read',
    wrapHandler(async ({ novelPath, filename }) => {
      return await readChapter(novelPath, filename);
    })
  );

  ipcMain.handle(
    'helper:chapter:write',
    wrapHandler(async ({ novelPath, filename, content }) => {
      return await writeChapter(novelPath, filename, content);
    })
  );

  // Git handlers
  ipcMain.handle(
    'helper:git:commit',
    wrapHandler(async ({ novelPath, filename, content }) => {
      return await commitChapter(novelPath, filename, content);
    })
  );

  // Stats handlers
  ipcMain.handle(
    'helper:stats:word-count',
    wrapHandler(async ({ content }) => {
      try {
        const wordCount = calculateWordCount(content);
        return {
          status: 'ok',
          data: { wordCount },
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          status: 'error',
          error: {
            code: 'WORD_COUNT_ERROR',
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        };
      }
    })
  );

  ipcMain.handle(
    'helper:stats:manuscript-count',
    wrapHandler(async ({ novelPath }) => {
      try {
        const wordCount = await getManuscriptWordCount(novelPath);
        return {
          status: 'ok',
          data: { wordCount },
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          status: 'error',
          error: {
            code: 'MANUSCRIPT_COUNT_ERROR',
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        };
      }
    })
  );

  ipcMain.handle(
    'helper:stats:today-count',
    wrapHandler(async ({ novelPath }) => {
      try {
        const wordCount = await getWordsWrittenToday(novelPath);
        return {
          status: 'ok',
          data: { wordCount },
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          status: 'error',
          error: {
            code: 'TODAY_COUNT_ERROR',
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        };
      }
    })
  );

  // Wiki handlers
  ipcMain.handle(
    'helper:wiki:create',
    wrapHandler(async ({ novelPath, title, content }) => {
      return await createWikiPage(novelPath, title, content);
    })
  );

  ipcMain.handle(
    'helper:wiki:read',
    wrapHandler(async ({ novelPath, slug }) => {
      return await readWikiPage(novelPath, slug);
    })
  );

  ipcMain.handle(
    'helper:wiki:update',
    wrapHandler(async ({ novelPath, slug, content }) => {
      return await updateWikiPage(novelPath, slug, content);
    })
  );

  ipcMain.handle(
    'helper:wiki:delete',
    wrapHandler(async ({ novelPath, slug }) => {
      return await deleteWikiPage(novelPath, slug);
    })
  );

  ipcMain.handle(
    'helper:wiki:rename',
    wrapHandler(async ({ novelPath, oldSlug, newTitle }) => {
      return await renameWikiPage(novelPath, oldSlug, newTitle);
    })
  );

  ipcMain.handle(
    'helper:wiki:list',
    wrapHandler(async ({ novelPath }) => {
      return await listWikiPages(novelPath);
    })
  );

  // Dialog handler
  ipcMain.handle('app:selectNovelDirectory', async (event) => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Open Novel Directory',
      message: 'Select a novel directory',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return {
        status: 'error',
        error: {
          code: 'DIALOG_CANCELED',
          message: 'Dialog was canceled',
        },
        timestamp: new Date().toISOString(),
      };
    }

    return {
      status: 'ok',
      data: { novelPath: result.filePaths[0] },
      timestamp: new Date().toISOString(),
    };
  });

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
