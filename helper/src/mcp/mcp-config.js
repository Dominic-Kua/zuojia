/**
 * MCP Configuration Module
 * Centralized configuration for MCP runtime with environment variable support
 */

const DEFAULT_CONFIG = {
  process: {
    pythonCommand: 'python3.13',
    serverPath: 'helper/src/mcp/project-synapse-bridge.py',
    env: {
      ZUOJIA_NOVEL_PATH: '',
      NEO4J_URI: 'bolt://localhost:7687',
      NEO4J_USER: 'neo4j',
      NEO4J_PASSWORD: 'neo4j',
    },
  },
  mcpClient: {
    maxRetries: 3,
    retryBaseDelay: 1000,
    maxRetryDelay: 10000,
    callToolTimeoutMs: 5000,
    initializeTimeoutMs: 10000,
  },
  synapse: {
    enabled: true,
    fallbackToLocal: true,
    maxReconnectAttempts: 5,
  },
  logging: {
    logLevel: 'info',
    maxLogs: 200,
  },
};

/**
 * Create configuration from environment variables
 * @returns {Object} Configuration object
 */
export function createConfigFromEnv() {
  return {
    process: {
      pythonCommand: process.env.ZUOJIA_MCP_PYTHON_CMD || 'python3.13',
      serverPath: process.env.ZUOJIA_MCP_SERVER_PATH || 'helper/src/mcp/project-synapse-bridge.py',
      env: {
        ZUOJIA_NOVEL_PATH: process.env.ZUOJIA_NOVEL_PATH || '',
        NEO4J_URI: process.env.NEO4J_URI || 'bolt://localhost:7687',
        NEO4J_USER: process.env.NEO4J_USER || 'neo4j',
        NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || 'neo4j',
      },
    },
    mcpClient: {
      maxRetries: parseInt(process.env.ZUOJIA_MCP_MAX_RETRIES, 10) || 3,
      retryBaseDelay: parseInt(process.env.ZUOJIA_MCP_RETRY_BASE_DELAY, 10) || 1000,
      maxRetryDelay: parseInt(process.env.ZUOJIA_MCP_MAX_RETRY_DELAY, 10) || 10000,
      callToolTimeoutMs: parseInt(process.env.ZUOJIA_MCP_TOOL_TIMEOUT, 10) || 5000,
      initializeTimeoutMs: parseInt(process.env.ZUOJIA_MCP_INIT_TIMEOUT, 10) || 10000,
    },
    synapse: {
      enabled: process.env.ZUOJIA_MCP_SYNAPSE_ENABLED !== 'false',
      fallbackToLocal: process.env.ZUOJIA_MCP_FALLBACK_TO_LOCAL !== 'false',
      maxReconnectAttempts: parseInt(process.env.ZUOJIA_MCP_MAX_RECONNECT, 10) || 5,
    },
    logging: {
      logLevel: process.env.ZUOJIA_MCP_LOG_LEVEL || 'info',
      maxLogs: parseInt(process.env.ZUOJIA_MCP_MAX_LOGS, 10) || 200,
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