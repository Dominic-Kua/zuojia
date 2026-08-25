/**
 * MCP Configuration Module
 * Centralized configuration for MCP runtime with environment variable support
 */

import { NEO4J_BOLT_URI, NEO4J_USERNAME, NEO4J_PASSWORD } from '../../../electron/neo4j-defaults.js';
import {
  TOOL_CALL_TIMEOUT_MS,
  BASE_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  EMBEDDING_TOOL_TIMEOUT_MS,
  WIKI_DEFAULT_LIMIT,
  NEO4J_STARTUP_TIMEOUT_MS,
} from '../../../electron/constants.js';

const DEFAULT_CONFIG = {
  process: {
    serverPath: 'helper/src/mcp/project-synapse-bridge.js',
    env: {
      ZUOJIA_NOVEL_PATH: '',
      NEO4J_URI: NEO4J_BOLT_URI,
      NEO4J_USER: NEO4J_USERNAME,
      NEO4J_PASSWORD: NEO4J_PASSWORD,
    },
  },
  mcpClient: {
    maxRetries: 3,
    retryBaseDelay: BASE_RETRY_DELAY_MS,
    maxRetryDelay: MAX_RETRY_DELAY_MS,
    callToolTimeoutMs: EMBEDDING_TOOL_TIMEOUT_MS,
    initializeTimeoutMs: EMBEDDING_TOOL_TIMEOUT_MS,
  },
  synapse: {
    enabled: true,
    fallbackToLocal: true,
    maxReconnectAttempts: 5,
  },
  logging: {
    logLevel: 'info',
    maxLogs: WIKI_DEFAULT_LIMIT,
  },
  // Tool-specific timeouts (in ms)
  toolTimeouts: {
    wiki_list_pages: TOOL_CALL_TIMEOUT_MS,
    wiki_get_page: TOOL_CALL_TIMEOUT_MS,
    wiki_search: TOOL_CALL_TIMEOUT_MS,
    wiki_get_backlinks: TOOL_CALL_TIMEOUT_MS,
    wiki_build_graph: MAX_RETRY_DELAY_MS,
    wiki_traverse_graph: MAX_RETRY_DELAY_MS,
    wiki_neo4j_search: EMBEDDING_TOOL_TIMEOUT_MS,
    wiki_neo4j_get_related: NEO4J_STARTUP_TIMEOUT_MS,
    wiki_neo4j_find_paths: NEO4J_STARTUP_TIMEOUT_MS,
    wiki_neo4j_query: NEO4J_STARTUP_TIMEOUT_MS,
  },
};

/**
 * Create configuration from environment variables
 * @returns {Object} Configuration object
 */
export function createConfigFromEnv() {
  return {
    process: {
      serverPath: process.env.ZUOJIA_MCP_SERVER_PATH || 'helper/src/mcp/project-synapse-bridge.js',
      env: {
        ZUOJIA_NOVEL_PATH: process.env.ZUOJIA_NOVEL_PATH || '',
        NEO4J_URI: process.env.NEO4J_URI || NEO4J_BOLT_URI,
        NEO4J_USER: process.env.NEO4J_USER || NEO4J_USERNAME,
        NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || NEO4J_PASSWORD,
      },
    },
    mcpClient: {
      maxRetries: parseInt(process.env.ZUOJIA_MCP_MAX_RETRIES, 10) || 3,
      retryBaseDelay: parseInt(process.env.ZUOJIA_MCP_RETRY_BASE_DELAY, 10) || BASE_RETRY_DELAY_MS,
      maxRetryDelay: parseInt(process.env.ZUOJIA_MCP_MAX_RETRY_DELAY, 10) || MAX_RETRY_DELAY_MS,
      callToolTimeoutMs: parseInt(process.env.ZUOJIA_MCP_TOOL_TIMEOUT, 10) || EMBEDDING_TOOL_TIMEOUT_MS,
      initializeTimeoutMs: parseInt(process.env.ZUOJIA_MCP_INIT_TIMEOUT, 10) || EMBEDDING_TOOL_TIMEOUT_MS,
    },
    synapse: {
      enabled: process.env.ZUOJIA_MCP_SYNAPSE_ENABLED !== 'false',
      fallbackToLocal: process.env.ZUOJIA_MCP_FALLBACK_TO_LOCAL !== 'false',
      maxReconnectAttempts: parseInt(process.env.ZUOJIA_MCP_MAX_RECONNECT, 10) || 5,
    },
    logging: {
      logLevel: process.env.ZUOJIA_MCP_LOG_LEVEL || 'info',
      maxLogs: parseInt(process.env.ZUOJIA_MCP_MAX_LOGS, 10) || WIKI_DEFAULT_LIMIT,
    },
  };
}

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

/**
 * Create configuration with optional overrides
 * @param {Object} overrides - Configuration overrides
 * @returns {Object} Complete configuration
 */
export function createConfig(overrides = {}) {
  const base = createConfigFromEnv();
  
  function merge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = merge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
  
  return merge(base, overrides);
}