import { app, ipcMain, dialog } from 'electron'
import fs from 'fs'
import { readdir, readFile, stat, writeFile } from 'fs/promises'
import path from 'path'
import { createNovel, getIndex, validateNovel, rebuildIndex, readChapter, writeChapter } from '../helper/src/index/index.js'
import { commitChapter, createManualCommit, getCommitHistory, listChangedFiles } from '../helper/src/git/commit.js';
import { getGitSettings, saveGitSettings } from '../helper/src/git/config.js';
import { pushToRemote } from '../helper/src/git/push.js';
import { calculateWordCount } from '../helper/src/stats/word-count.js';
import { getManuscriptWordCount } from '../helper/src/stats/manuscript-count.js';
import { getWordsWrittenToday } from '../helper/src/git/history.js';
import { exportManuscriptToPdf } from '../helper/src/export/pdf.js';
import { validateExportDependencies } from '../helper/src/export/validate-deps.js';
import { getExportLogs } from '../helper/src/export/logs.js';
import { createWikiPage, readWikiPage, updateWikiPage, deleteWikiPage, renameWikiPage } from '../helper/src/wiki/crud.js';
import { listWikiPages } from '../helper/src/wiki/list-pages.js';
import { rebuildSpellcheckDict, getSpellcheckDict, addWordToSpellcheckDict } from '../helper/src/wiki/rebuild-dict.js';
import { createSnapshot, listSnapshots, deleteSnapshot, restoreSnapshot } from '../helper/src/backup/snapshot.js';
import { loadLlmConfig, saveLlmConfig, validateLlmConfig } from './llm-config.js';
import { createLlmRuntimeManager } from './llm-runtime.js';
import { createMcpRuntimeManager } from './mcp-runtime.js';
import http from 'http';
/**
 * Register all IPC handlers
 * Formats responses as structured envelopes
 */

function wrapHandler(fn) {
  return async (event, payload) => {
    return await fn(payload);
  };
}

const llmRuntime = createLlmRuntimeManager();
const mcpRuntime = createMcpRuntimeManager();
let handlersRegistered = false;
let beforeQuitBound = false;

const LLM_RUNTIME_OVERRIDE_KEYS = ['executablePath', 'modelName', 'host', 'port', 'temperature', 'maxTokens'];

function pickLlmRuntimeOverrides(settings = {}) {
  if (!settings || typeof settings !== 'object') {
    return {};
  }

  return Object.fromEntries(
    LLM_RUNTIME_OVERRIDE_KEYS
      .filter((key) => Object.prototype.hasOwnProperty.call(settings, key))
      .map((key) => [key, settings[key]])
  );
}

async function resolveTrustedRuntimeConfig(settings) {
  const persisted = await loadLlmConfig(app);
  if (!settings) {
    return persisted;
  }
  const runtimeOverrides = pickLlmRuntimeOverrides(settings);
  return validateLlmConfig({
    ...persisted,
    ...runtimeOverrides,
  });
}

export function registerHandlers() {
  if (handlersRegistered) {
    return;
  }
  handlersRegistered = true;

  if (!beforeQuitBound) {
    app.on('before-quit', () => {
      void llmRuntime.stop();
      void mcpRuntime.stop();
    });
    beforeQuitBound = true;
  }

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

  ipcMain.handle(
    'helper:git:listChanges',
    wrapHandler(async ({ novelPath }) => {
      return await listChangedFiles(novelPath);
    })
  );

  ipcMain.handle(
    'helper:git:manualCommit',
    wrapHandler(async ({ novelPath, files, message }) => {
      return await createManualCommit(novelPath, files, message);
    })
  );

  ipcMain.handle(
    'helper:git:getConfig',
    wrapHandler(async ({ novelPath }) => {
      return await getGitSettings(novelPath);
    })
  );

  ipcMain.handle(
    'helper:git:saveConfig',
    wrapHandler(async ({ novelPath, settings }) => {
      return await saveGitSettings(novelPath, settings);
    })
  );

  ipcMain.handle(
    'helper:git:history',
    wrapHandler(async ({ novelPath, limit }) => {
      return await getCommitHistory(novelPath, limit);
    })
  );

  ipcMain.handle(
    'helper:git:push',
    wrapHandler(async ({ novelPath }) => {
      return await pushToRemote(novelPath);
    })
  );

  ipcMain.handle(
    'helper:export:pdf',
    wrapHandler(async ({ novelPath, metadata }) => {
      return await exportManuscriptToPdf(novelPath, metadata);
    })
  );

  ipcMain.handle(
    'helper:export:validateDeps',
    wrapHandler(async () => {
      return await validateExportDependencies();
    })
  );

  ipcMain.handle(
    'helper:export:getLogs',
    wrapHandler(async ({ novelPath, limit }) => {
      return await getExportLogs(novelPath, limit);
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
    wrapHandler(async ({ novelPath, title, content, tags }) => {
      return await createWikiPage(novelPath, title, content, tags);
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
    wrapHandler(async ({ novelPath, slug, content, tags }) => {
      return await updateWikiPage(novelPath, slug, content, tags);
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

  ipcMain.handle(
    'helper:wiki:rebuildDict',
    wrapHandler(async ({ novelPath }) => {
      return await rebuildSpellcheckDict(novelPath);
    })
  );

  ipcMain.handle(
    'helper:wiki:getSpellcheckDict',
    wrapHandler(async ({ novelPath }) => {
      return await getSpellcheckDict(novelPath);
    })
  );

  ipcMain.handle(
    'helper:wiki:addToDict',
    wrapHandler(async ({ novelPath, word }) => {
      return await addWordToSpellcheckDict(novelPath, word);
    })
  );

  // Snapshot (local backup) handlers
  ipcMain.handle(
    'helper:backup:createSnapshot',
    wrapHandler(async ({ novelPath, label }) => {
      return await createSnapshot(novelPath, label || null);
    })
  );

  ipcMain.handle(
    'helper:backup:listSnapshots',
    wrapHandler(async ({ novelPath }) => {
      return await listSnapshots(novelPath);
    })
  );

  ipcMain.handle(
    'helper:backup:deleteSnapshot',
    wrapHandler(async ({ novelPath, timestamp }) => {
      return await deleteSnapshot(novelPath, timestamp);
    })
  );

  ipcMain.handle(
    'helper:backup:restore',
    wrapHandler(async ({ novelPath, timestamp, snapshotId }) => {
      return await restoreSnapshot(novelPath, timestamp ?? snapshotId);
    })
  );

  ipcMain.handle(
    'helper:llm:getConfig',
    wrapHandler(async () => {
      try {
        const config = await loadLlmConfig(app);
        return {
          status: 'ok',
          data: config,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          status: 'error',
          error: {
            code: 'LLM_CONFIG_LOAD_ERROR',
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        };
      }
    })
  );

  ipcMain.handle(
    'helper:llm:saveConfig',
    wrapHandler(async ({ settings }) => {
      try {
        const config = await saveLlmConfig(app, settings || {});
        return {
          status: 'ok',
          data: config,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          status: 'error',
          error: {
            code: 'LLM_CONFIG_SAVE_ERROR',
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        };
      }
    })
  );

  ipcMain.handle(
    'helper:llm:startRuntime',
    wrapHandler(async ({ settings }) => {
      try {
        const runtimeConfig = await resolveTrustedRuntimeConfig(settings);
        const result = await llmRuntime.start(runtimeConfig);
        return {
          status: 'ok',
          data: result,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          status: 'error',
          error: {
            code: 'LLM_RUNTIME_START_ERROR',
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        };
      }
    })
  );

  ipcMain.handle(
    'helper:llm:stopRuntime',
    wrapHandler(async () => {
      try {
        const result = await llmRuntime.stop();
        return {
          status: 'ok',
          data: result,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          status: 'error',
          error: {
            code: 'LLM_RUNTIME_STOP_ERROR',
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        };
      }
    })
  );

  ipcMain.handle(
    'helper:llm:restartRuntime',
    wrapHandler(async ({ settings }) => {
      try {
        const runtimeConfig = await resolveTrustedRuntimeConfig(settings);
        const result = await llmRuntime.restart(runtimeConfig);
        return {
          status: 'ok',
          data: result,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          status: 'error',
          error: {
            code: 'LLM_RUNTIME_RESTART_ERROR',
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        };
      }
    })
  );

  ipcMain.handle(
    'helper:llm:health',
    wrapHandler(async () => {
      const health = await llmRuntime.health();
      return {
        status: 'ok',
        data: health,
        timestamp: new Date().toISOString(),
      };
    })
  );

  async function chatOllama(config, messages) {
    const postData = JSON.stringify({
      model: config.modelName,
      messages,
      stream: false,
      options: {
        temperature: config.temperature,
        num_predict: config.maxTokens,
      },
    });

    return new Promise((resolve, reject) => {
      const options = {
        hostname: config.host || '127.0.0.1',
        port: config.port || 11434,
        path: '/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 120000,
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const parsed = JSON.parse(data);
              resolve({ content: parsed.message?.content || '' });
            } else {
              reject(new Error(`Ollama returned ${res.statusCode}: ${data}`));
            }
          } catch (err) {
            reject(new Error(`Failed to parse Ollama response: ${err.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Ollama chat request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Ollama chat request timed out'));
      });

      req.write(postData);
      req.end();
    });
  }

  ipcMain.handle(
    'helper:llm:chat',
    wrapHandler(async ({ messages }) => {
      try {
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          throw new Error('messages are required');
        }

        const config = await loadLlmConfig(app);
        if (!config.modelName) {
          throw new Error('LLM model is not configured');
        }

        const response = await chatOllama(config, messages);
        return {
          status: 'ok',
          data: response.content,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          status: 'error',
          error: {
            code: 'LLM_CHAT_ERROR',
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        };
      }
    })
  );

  ipcMain.handle(
    'helper:mcp:startServer',
    wrapHandler(async ({ novelPath }) => {
      try {
        const result = await mcpRuntime.start({ novelPath });
        return {
          status: 'ok',
          data: result,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          status: 'error',
          error: {
            code: error.code || 'MCP_START_ERROR',
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        };
      }
    })
  );

  ipcMain.handle(
    'helper:mcp:stopServer',
    wrapHandler(async () => {
      try {
        const result = await mcpRuntime.stop();
        return {
          status: 'ok',
          data: result,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          status: 'error',
          error: {
            code: error.code || 'MCP_STOP_ERROR',
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        };
      }
    })
  );

  ipcMain.handle(
    'helper:mcp:health',
    wrapHandler(async () => {
      return {
        status: 'ok',
        data: mcpRuntime.health(),
        timestamp: new Date().toISOString(),
      };
    })
  );

  ipcMain.handle(
    'helper:mcp:callTool',
    wrapHandler(async ({ toolName, args, timeoutMs, retries }) => {
      try {
        const result = await mcpRuntime.callTool({
          toolName,
          args,
          timeoutMs,
          retries,
        });

        return {
          status: 'ok',
          data: result,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          status: 'error',
          error: {
            code: error.code || 'MCP_TOOL_CALL_ERROR',
            message: error.message,
            suggestion: 'Check helper:mcp:getLogs for details or verify tool arguments.',
          },
          timestamp: new Date().toISOString(),
        };
      }
    })
  );

  ipcMain.handle(
    'helper:mcp:getLogs',
    wrapHandler(async ({ limit }) => {
      return {
        status: 'ok',
        data: {
          logs: mcpRuntime.getLogs({ limit }),
        },
        timestamp: new Date().toISOString(),
      };
    })
  );

  ipcMain.handle('app:listNovels', async () => {
    try {
      const novelsRoot = path.join(app.getPath('home'), '.zuojia');

      if (!fs.existsSync(novelsRoot)) {
        return {
          status: 'ok',
          data: { novels: [] },
          timestamp: new Date().toISOString(),
        };
      }

      const entries = await readdir(novelsRoot, { withFileTypes: true });
      const novels = await Promise.all(
        entries
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => {
            const novelPath = path.join(novelsRoot, entry.name);
            const metaPath = path.join(novelPath, 'meta', 'last-accessed.json');
            let lastAccessed = null;

            try {
              const content = await readFile(metaPath, 'utf-8');
              const parsed = JSON.parse(content);
              lastAccessed = parsed.lastAccessed || null;
            } catch {
              try {
                const stats = await stat(novelPath);
                lastAccessed = stats.mtime.toISOString();
              } catch {
                lastAccessed = null;
              }
            }

            return {
              slug: entry.name,
              displayName: entry.name.replace(/[-_]+/g, ' '),
              novelPath,
              lastAccessed,
            };
          })
      );

      novels.sort((a, b) => {
        const aTime = a.lastAccessed ? Date.parse(a.lastAccessed) : 0;
        const bTime = b.lastAccessed ? Date.parse(b.lastAccessed) : 0;
        return bTime - aTime;
      });

      return {
        status: 'ok',
        data: { novels },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        error: {
          code: 'LIST_NOVELS_FAILED',
          message: error.message,
        },
        timestamp: new Date().toISOString(),
      };
    }
  });

  ipcMain.handle('app:markNovelOpened', async (event, { novelPath }) => {
    try {
      const metaDir = path.join(novelPath, 'meta');
      const metaPath = path.join(metaDir, 'last-accessed.json');

      if (!fs.existsSync(metaDir)) {
        return {
          status: 'error',
          error: {
            code: 'META_DIR_MISSING',
            message: 'Novel meta directory not found',
          },
          timestamp: new Date().toISOString(),
        };
      }

      const payload = { lastAccessed: new Date().toISOString() };
      await writeFile(metaPath, JSON.stringify(payload, null, 2));

      return {
        status: 'ok',
        data: payload,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        error: {
          code: 'MARK_NOVEL_OPENED_FAILED',
          message: error.message,
        },
        timestamp: new Date().toISOString(),
      };
    }
  });

  // Dialog handler
  ipcMain.handle('app:selectNovelDirectory', async (event) => {
    const defaultPath = path.join(app.getPath('home'), '.zuojia');
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Open Novel Directory',
      message: 'Select a novel directory',
      defaultPath,
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
  // - helper:git:pull
}
