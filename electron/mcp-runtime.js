import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  listWikiPagesForMcp,
  getWikiPageForMcp,
  searchWikiPagesForMcp,
  getWikiBacklinksForMcp,
  buildWikiKnowledgeGraphForMcp,
  traverseWikiKnowledgeGraphForMcp,
} from '../helper/src/mcp/wiki-tools.js';
import { createMcpClient } from '../helper/src/mcp/mcp-client.js';
import { McpTransport } from '../helper/src/mcp/mcp-transport.js';
import { createToolMapper } from '../helper/src/mcp/tool-mapper.js';
import { createArgumentTransformer } from '../helper/src/mcp/argument-transformer.js';
import { createResponseNormalizer } from '../helper/src/mcp/response-normalizer.js';
import { createConfig } from '../helper/src/mcp/mcp-config.js';
import { NEO4J_BOLT_URI, NEO4J_USERNAME, NEO4J_DATABASE } from './neo4j-defaults.js';
import { PATH_ENRICHMENT } from './platform-paths.js';
import {
  SIGTERM_TO_SIGKILL_MS,
  GRACEFUL_EXIT_FALLBACK_MS,
  WIKI_DEFAULT_LIMIT,
} from './constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOOL_NAMES = new Set([
  'wiki_list_pages',
  'wiki_get_page',
  'wiki_search',
  'wiki_get_backlinks',
  'wiki_build_graph',
  'wiki_traverse_graph',
  'wiki_neo4j_search',
  'wiki_neo4j_get_related',
  'wiki_neo4j_find_paths',
  'wiki_neo4j_query',
  'ingest_text',
]);

const RETRYABLE_ERROR_CODES = new Set([
  'MCP_RUNTIME_NOT_RUNNING',
  'MCP_TOOL_TIMEOUT',
  'MCP_CONNECTION_ERROR',
  'MCP_SERVER_DISCONNECTED',
  'MCP_TOOL_CALL_FAILED',
  'ECONNRESET',
  'EPIPE',
  'ENOTCONN',
  'ETIMEDOUT',
]);

const NON_RETRYABLE_ERROR_CODES = new Set([
  'MCP_UNKNOWN_TOOL',
  'MCP_TOOL_RESULT_ERROR',
  'MCP_CLIENT_DESTROYED',
  'MCP_INITIALIZATION_FAILED',
]);

function createTimeoutError(toolName, timeoutMs) {
  const error = new Error(`MCP tool ${toolName} timed out after ${timeoutMs}ms`);
  error.code = 'MCP_TOOL_TIMEOUT';
  return error;
}

async function executeWikiTool(novelPath, toolName, args = {}) {
  if (toolName === 'wiki_list_pages') {
    return listWikiPagesForMcp(novelPath, Number(args.limit || WIKI_DEFAULT_LIMIT));
  }

  if (toolName === 'wiki_get_page') {
    return getWikiPageForMcp(novelPath, String(args.slug || ''));
  }

  if (toolName === 'wiki_search') {
    return searchWikiPagesForMcp(novelPath, String(args.query || ''), Number(args.limit || 10));
  }

  if (toolName === 'wiki_get_backlinks') {
    return getWikiBacklinksForMcp(novelPath, String(args.slug || ''), Number(args.limit || WIKI_DEFAULT_LIMIT));
  }

  if (toolName === 'wiki_build_graph') {
    return buildWikiKnowledgeGraphForMcp(novelPath, Number(args.maxEdges || 500));
  }

  if (toolName === 'wiki_traverse_graph') {
    return traverseWikiKnowledgeGraphForMcp(novelPath, {
      startSlug: String(args.startSlug || ''),
      targetSlug: String(args.targetSlug || ''),
      maxDepth: Number(args.maxDepth || 3),
      maxEdges: Number(args.maxEdges || 2000),
    });
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

function isRetryableError(error) {
  if (!error?.code) return true;
  if (NON_RETRYABLE_ERROR_CODES.has(error.code)) return false;
  if (RETRYABLE_ERROR_CODES.has(error.code)) return true;
  // Default to retryable for unknown errors
  return true;
}

function getRetryDelay(attempt, baseDelay = 1000, maxDelay = 10000) {
  const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
  // Add jitter (±10%)
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
}
  
  export function createMcpRuntimeManager({
  spawnFn = spawn,
  nowFn = () => Date.now(),
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  toolExecutor = executeWikiTool,
  config = createConfig(),
} = {}) {
  const mcpClientConfig = config.mcpClient;
  const processConfig = config.process;
  const synapseConfig = config.synapse;
  const loggingConfig = config.logging;
  const healthConfig = config.health;
  const maxLogs = loggingConfig.maxLogs;
  const retryConfig = {
    baseDelay: mcpClientConfig.retryBaseDelay,
    maxDelay: mcpClientConfig.retryMaxDelay,
    maxRetries: mcpClientConfig.maxRetries,
  };
  const toolTimeouts = config.toolTimeouts;

  let processRef = null;
  let startTime = null;
  let runtimeNovelPath = null;
  let lastError = null;
  const callLogs = [];
  
  let mcpClient = null;
  let mcpTransport = null;
  let toolMapper = null;
  let argumentTransformer = null;
  let responseNormalizer = null;
  let isUsingSynapse = false;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = synapseConfig.maxReconnectAttempts;

  function pushLog(entry) {
    if (loggingConfig.logLevel === 'debug' || entry.type !== 'debug') {
      callLogs.push(entry);
      if (callLogs.length > maxLogs) {
        callLogs.splice(0, callLogs.length - maxLogs);
      }
    }
  }

  function isRunningProcess(proc) {
    return Boolean(proc) && proc.exitCode === null;
  }

  function getToolTimeout(toolName) {
    return toolTimeouts[toolName] || mcpClientConfig.callToolTimeoutMs;
  }

  async function initializeMcpClient(child) {
    if (!synapseConfig.enabled) {
      isUsingSynapse = false;
      pushLog({
        timestamp: new Date().toISOString(),
        type: 'mcp_client_init_skipped',
        reason: 'synapse_disabled_in_config',
      });
      return false;
    }

    try {
      if (!child.stdout || !child.stdin) {
        isUsingSynapse = false;
        pushLog({
          timestamp: new Date().toISOString(),
          type: 'mcp_client_init_failed',
          error: 'Child process missing stdio pipes',
        });
        return false;
      }
      
      mcpTransport = new McpTransport(child);
      
      mcpClient = createMcpClient({
        transport: mcpTransport,
        clientInfo: { name: 'zuojia', version: '0.1.0' },
      });
      
      await mcpClient.initialize();
      
      toolMapper = createToolMapper();
      argumentTransformer = createArgumentTransformer(toolMapper);
      responseNormalizer = createResponseNormalizer();
      
      isUsingSynapse = true;
      reconnectAttempts = 0;
      
      pushLog({
        timestamp: new Date().toISOString(),
        type: 'mcp_client_initialized',
        tools: mcpClient.getTools().map(t => t.name),
      });
      
      return true;
    } catch (error) {
      pushLog({
        timestamp: new Date().toISOString(),
        type: 'mcp_client_init_failed',
        error: error.message,
      });
      isUsingSynapse = false;
      return false;
    }
  }

  async function reconnectMcpClient() {
    if (reconnectAttempts >= synapseConfig.maxReconnectAttempts) {
      pushLog({
        timestamp: new Date().toISOString(),
        type: 'mcp_reconnect_failed',
        error: 'Max reconnect attempts reached',
        attempts: reconnectAttempts,
      });
      isUsingSynapse = false;
      return false;
    }

    reconnectAttempts++;
    
    if (!processRef || !isRunningProcess(processRef)) {
      return false;
    }

    pushLog({
      timestamp: new Date().toISOString(),
      type: 'mcp_reconnecting',
      attempt: reconnectAttempts,
    });

    try {
      // Clean up old client
      if (mcpClient) {
        try {
          await mcpClient.shutdown();
        } catch {
          // Ignore
        }
      }
      
      // Reinitialize
      return await initializeMcpClient(processRef);
    } catch (error) {
      pushLog({
        timestamp: new Date().toISOString(),
        type: 'mcp_reconnect_failed',
        attempt: reconnectAttempts,
        error: error.message,
      });
      return false;
    }
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

    const serverPath = process.resourcesPath
      ? path.join(process.resourcesPath, 'helper', 'src', 'mcp', 'project-synapse-bridge.js')
      : path.join(__dirname, '../helper/src/mcp/project-synapse-bridge.js');
    const neo4j_pass = process.env.NEO4J_PASSWORD;
    const child = spawnFn('node', [serverPath], {
      stdio: 'pipe',
      env: {
        ...process.env,
        PATH: [...PATH_ENRICHMENT, process.env.PATH || ''].join(':'),
        ZUOJIA_NOVEL_PATH: novelPath,
        NEO4J_URI: NEO4J_BOLT_URI,
        NEO4J_USER: NEO4J_USERNAME,
        NEO4J_PASSWORD: neo4j_pass,
        NEO4J_DATABASE: NEO4J_DATABASE,
      },
    });

    child.on('error', (error) => {
      lastError = error.message;
      pushLog({
        timestamp: new Date().toISOString(),
        type: 'process_error',
        error: error.message,
      });
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
      mcpClient = null;
      mcpTransport = null;
      toolMapper = null;
      argumentTransformer = null;
      responseNormalizer = null;
      isUsingSynapse = false;
      reconnectAttempts = 0;
      
      pushLog({
        timestamp: new Date().toISOString(),
        type: 'process_exit',
        code,
        signal: signal || 'none',
      });
    });

    processRef = child;
    runtimeNovelPath = novelPath;
    startTime = nowFn();
    lastError = null;

    await initializeMcpClient(child);

    return {
      status: 'running',
      pid: child.pid,
      novelPath,
      startedAt: new Date(startTime).toISOString(),
      usingSynapse: isUsingSynapse,
    };
  }

  async function stop() {
    if (!isRunningProcess(processRef)) {
      return {
        status: 'stopped',
        alreadyStopped: true,
      };
    }

    if (mcpClient) {
      try {
        await mcpClient.shutdown();
      } catch {
        // Ignore shutdown errors
      }
      mcpClient = null;
    }

    const child = processRef;
    let resolveExit;
    const waitForExit = new Promise((resolve) => {
      resolveExit = resolve;
      child.once('exit', resolve);
      if (child.exitCode !== null) {
        resolve();
      }
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
        setTimeoutFn(() => resolveExit(), GRACEFUL_EXIT_FALLBACK_MS);
      }
    }, SIGTERM_TO_SIGKILL_MS);

    await waitForExit;
    clearTimeoutFn(timeout);

    if (processRef === child) {
      processRef = null;
      runtimeNovelPath = null;
      startTime = null;
      mcpClient = null;
      mcpTransport = null;
      toolMapper = null;
      argumentTransformer = null;
      responseNormalizer = null;
      isUsingSynapse = false;
      reconnectAttempts = 0;
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

    const maxRetries = Math.max(0, Number(retries || 0));
    const maxAttempts = maxRetries + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const startedAt = nowFn();
      let timeoutId;

      try {
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeoutFn(() => reject(createTimeoutError(toolName, timeoutMs)), timeoutMs);
        });

        let result;

        // Check if we should use Synapse
        const canUseSynapse = isUsingSynapse && Boolean(mcpClient) && Boolean(toolMapper) && toolMapper.hasMapping(toolName);
        console.log(`[MCP] callTool "${toolName}" attempt=${attempt}, canUseSynapse=${canUseSynapse}, isUsingSynapse=${isUsingSynapse}, hasClient=${!!mcpClient}, hasMapping=${toolMapper ? toolMapper.hasMapping(toolName) : false}`);
        
        if (canUseSynapse) {
          // Use Project Synapse via MCP client
          const synapseTool = toolMapper.mapTool(toolName);
          const synapseArgs = argumentTransformer.transform(toolName, args);
          console.log(`[MCP] → Synapse tool="${synapseTool}", args=${JSON.stringify(synapseArgs).slice(0, 200)}`);
          
          const synapseResult = await Promise.race([
            mcpClient.callTool(synapseTool, synapseArgs, timeoutMs),
            timeoutPromise,
          ]);
          
          result = responseNormalizer.normalize(toolName, synapseResult);
          console.log(`[MCP] ← Synapse response: status=${result?.status}, data keys=${result?.data ? Object.keys(result.data) : 'none'}`);
          
          // If Synapse returns error, try fallback to local tools
          if (result?.status === 'error') {
            const error = toToolError(result, toolName);
            
            // If error is retryable and we have retries left, try fallback
            if (isRetryableError(error) && attempt < maxAttempts) {
              pushLog({
                timestamp: new Date().toISOString(),
                toolName,
                args,
                attempt,
                status: 'error',
                error: error.message,
                code: error.code,
                action: 'falling_back_to_local',
              });
              
              // Try local tool executor as fallback
              result = await Promise.race([
                toolExecutor(runtimeNovelPath, toolName, args),
                timeoutPromise,
              ]);
            }
          }
        } else {
          // Fallback to local wiki tools
          console.log(`[MCP] → Local tool "${toolName}" (Synapse unavailable)`);
          result = await Promise.race([
            toolExecutor(runtimeNovelPath, toolName, args),
            timeoutPromise,
          ]);
          console.log(`[MCP] ← Local result: status=${result?.status}, data=${JSON.stringify(result?.data).slice(0, 200)}`);
        }

        if (result?.status === 'error') {
          const err = toToolError(result, toolName);
          console.error(`[MCP] Tool "${toolName}" returned error: ${err.message} (code=${err.code})`);
          throw err;
        }

        clearTimeoutFn(timeoutId);

        pushLog({
          timestamp: new Date().toISOString(),
          toolName,
          args,
          attempt,
          durationMs: Math.max(0, nowFn() - startedAt),
          status: result?.status || 'ok',
          viaSynapse: canUseSynapse,
        });

        return result;
      } catch (error) {
        clearTimeoutFn(timeoutId);

        const isRetryable = isRetryableError(error);
        const isLastAttempt = attempt >= maxAttempts;

        pushLog({
          timestamp: new Date().toISOString(),
          toolName,
          args,
          attempt,
          durationMs: Math.max(0, nowFn() - startedAt),
          status: 'error',
          error: error.message,
          code: error.code || 'MCP_TOOL_CALL_FAILED',
          retryable: isRetryable,
          isLastAttempt,
        });

        // If Synapse failed with connection error, try to reconnect
        if (isRetryable && error.code?.startsWith('MCP_CONNECTION') && canUseSynapse) {
          await reconnectMcpClient();
        }

        // If retryable and not last attempt, wait before retrying
        if (isRetryable && !isLastAttempt) {
          const delay = getRetryDelay(attempt, retryConfig.baseDelay, retryConfig.maxDelay);
          pushLog({
            timestamp: new Date().toISOString(),
            toolName,
            attempt,
            action: 'retry_delay',
            delayMs: delay,
          });
          await new Promise(resolve => setTimeoutFn(resolve, delay));
          continue;
        }

        if (isLastAttempt) {
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
        usingSynapse: false,
        reconnectAttempts,
      };
    }

    return {
      status: 'running',
      pid: processRef.pid,
      novelPath: runtimeNovelPath,
      uptimeMs: startTime ? Math.max(0, nowFn() - startTime) : 0,
      lastError,
      usingSynapse: isUsingSynapse,
      synapseTools: isUsingSynapse && mcpClient ? mcpClient.getTools().map(t => t.name) : [],
      reconnectAttempts,
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