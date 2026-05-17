import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  listWikiPagesForMcp,
  getWikiPageForMcp,
  searchWikiPagesForMcp,
  getWikiBacklinksForMcp,
  buildWikiKnowledgeGraphForMcp,
} from '../helper/src/mcp/wiki-tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOOL_NAMES = new Set([
  'wiki_list_pages',
  'wiki_get_page',
  'wiki_search',
  'wiki_get_backlinks',
  'wiki_build_graph',
]);

function createTimeoutError(toolName, timeoutMs) {
  const error = new Error(`MCP tool ${toolName} timed out after ${timeoutMs}ms`);
  error.code = 'MCP_TOOL_TIMEOUT';
  return error;
}

async function executeWikiTool(novelPath, toolName, args = {}) {
  if (toolName === 'wiki_list_pages') {
    return listWikiPagesForMcp(novelPath, Number(args.limit || 200));
  }

  if (toolName === 'wiki_get_page') {
    return getWikiPageForMcp(novelPath, String(args.slug || ''));
  }

  if (toolName === 'wiki_search') {
    return searchWikiPagesForMcp(novelPath, String(args.query || ''), Number(args.limit || 10));
  }

  if (toolName === 'wiki_get_backlinks') {
    return getWikiBacklinksForMcp(novelPath, String(args.slug || ''), Number(args.limit || 200));
  }

  if (toolName === 'wiki_build_graph') {
    return buildWikiKnowledgeGraphForMcp(novelPath, Number(args.maxEdges || 500));
  }

  const error = new Error(`Unsupported MCP tool: ${toolName}`);
  error.code = 'MCP_UNKNOWN_TOOL';
  throw error;
}

function toToolError(result, toolName) {
  const message =
    result?.error?.message || `MCP tool ${toolName} returned an error response`;
  const error = new Error(message);
  error.code = result?.error?.code || 'MCP_TOOL_RESULT_ERROR';
  if (result?.error && typeof result.error === 'object') {
    error.details = result.error;
  }
  return error;
}

export function createMcpRuntimeManager({
  spawnFn = spawn,
  nowFn = () => Date.now(),
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  toolExecutor = executeWikiTool,
  maxLogs = 200,
} = {}) {
  let processRef = null;
  let startTime = null;
  let runtimeNovelPath = null;
  let lastError = null;
  const callLogs = [];

  function pushLog(entry) {
    callLogs.push(entry);
    if (callLogs.length > maxLogs) {
      callLogs.splice(0, callLogs.length - maxLogs);
    }
  }

  function isRunningProcess(proc) {
    return Boolean(proc) && proc.exitCode === null;
  }

  async function start({ novelPath }) {
    if (!novelPath || typeof novelPath !== 'string') {
      throw new Error('novelPath is required to start MCP runtime');
    }

    if (isRunningProcess(processRef) && runtimeNovelPath === novelPath) {
      return {
        status: 'running',
        pid: processRef.pid,
        novelPath: runtimeNovelPath,
        startedAt: new Date(startTime).toISOString(),
      };
    }

    if (isRunningProcess(processRef) && runtimeNovelPath !== novelPath) {
      await stop();
    }

    const serverPath = path.join(__dirname, '../helper/src/mcp/wiki-server.js');
    const child = spawnFn(process.execPath, [serverPath], {
      stdio: 'pipe',
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        ZUOJIA_NOVEL_PATH: novelPath,
      },
    });

    child.on('error', (error) => {
      lastError = error.message;
    });

    child.on('exit', (code, signal) => {
      if (processRef !== child) {
        return;
      }
      if (code !== 0) {
        lastError = `MCP server exited with code ${code} signal ${signal || 'none'}`;
      }
      processRef = null;
      runtimeNovelPath = null;
      startTime = null;
    });

    processRef = child;
    runtimeNovelPath = novelPath;
    startTime = nowFn();
    lastError = null;

    return {
      status: 'running',
      pid: child.pid,
      novelPath,
      startedAt: new Date(startTime).toISOString(),
    };
  }

  async function stop() {
    if (!isRunningProcess(processRef)) {
      return {
        status: 'stopped',
        alreadyStopped: true,
      };
    }

    const child = processRef;
    let resolveExit;
    const waitForExit = new Promise((resolve) => {
      resolveExit = resolve;
      if (child.exitCode !== null) {
        resolve();
        return;
      }
      child.once('exit', resolve);
    });

    try {
      child.kill('SIGTERM');
    } catch {
      // Ignore kill errors and continue waiting for exit.
    }

    const timeout = setTimeoutFn(() => {
      if (child.exitCode === null) {
        try {
          child.kill('SIGKILL');
        } catch {
          // Ignore kill errors.
        }
        setTimeoutFn(() => resolveExit(), 2000);
      }
    }, 5000);

    await waitForExit;
    clearTimeoutFn(timeout);

    if (processRef === child) {
      processRef = null;
      runtimeNovelPath = null;
      startTime = null;
    }

    return {
      status: 'stopped',
      alreadyStopped: false,
    };
  }

  async function callTool({ toolName, args = {}, timeoutMs = 5000, retries = 0 }) {
    if (!isRunningProcess(processRef) || !runtimeNovelPath) {
      const error = new Error('MCP runtime is not running');
      error.code = 'MCP_RUNTIME_NOT_RUNNING';
      throw error;
    }

    if (!TOOL_NAMES.has(toolName)) {
      const error = new Error(`Unsupported MCP tool: ${toolName}`);
      error.code = 'MCP_UNKNOWN_TOOL';
      throw error;
    }

    const attempts = Math.max(1, Number(retries || 0) + 1);

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const startedAt = nowFn();
      let timeoutId;

      try {
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeoutFn(() => reject(createTimeoutError(toolName, timeoutMs)), timeoutMs);
        });

        const result = await Promise.race([
          toolExecutor(runtimeNovelPath, toolName, args),
          timeoutPromise,
        ]);

        if (result?.status === 'error') {
          throw toToolError(result, toolName);
        }

        clearTimeoutFn(timeoutId);

        pushLog({
          timestamp: new Date().toISOString(),
          toolName,
          args,
          attempt,
          durationMs: Math.max(0, nowFn() - startedAt),
          status: result?.status || 'ok',
        });

        return result;
      } catch (error) {
        clearTimeoutFn(timeoutId);

        pushLog({
          timestamp: new Date().toISOString(),
          toolName,
          args,
          attempt,
          durationMs: Math.max(0, nowFn() - startedAt),
          status: 'error',
          error: error.message,
          code: error.code || 'MCP_TOOL_CALL_FAILED',
        });

        if (attempt >= attempts) {
          lastError = error.message;
          throw error;
        }
      }
    }

    const error = new Error(`MCP tool call failed for ${toolName}`);
    error.code = 'MCP_TOOL_CALL_FAILED';
    throw error;
  }

  function health() {
    if (!isRunningProcess(processRef)) {
      return {
        status: 'stopped',
        pid: null,
        novelPath: null,
        uptimeMs: 0,
        lastError,
      };
    }

    return {
      status: 'running',
      pid: processRef.pid,
      novelPath: runtimeNovelPath,
      uptimeMs: startTime ? Math.max(0, nowFn() - startTime) : 0,
      lastError,
    };
  }

  function getLogs({ limit = 50 } = {}) {
    const safeLimit = Math.max(1, Math.min(Number(limit || 50), 500));
    return callLogs.slice(-safeLimit);
  }

  return {
    start,
    stop,
    health,
    callTool,
    getLogs,
  };
}
