import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test configuration defaults
const DEFAULT_CONFIG = {
  process: {
    serverPath: 'helper/src/mcp/project-synapse-bridge.js',
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

function createConfigFromEnv() {
  return {
    process: {
      serverPath: process.env.ZUOJIA_MCP_SERVER_PATH || DEFAULT_CONFIG.process.serverPath,
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

function createConfig(overrides = {}) {
  const base = createConfigFromEnv();
  
  // Deep merge
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

describe('MCP Configuration', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('createConfigFromEnv', () => {
    it('should return defaults when no env vars set', () => {
      const config = createConfigFromEnv();
      expect(config.mcpClient.maxRetries).toBe(3);
      expect(config.synapse.enabled).toBe(true);
      expect(config.synapse.fallbackToLocal).toBe(true);
    });

    it('should read synapse enabled from env', () => {
      process.env.ZUOJIA_MCP_SYNAPSE_ENABLED = 'false';
      const config = createConfigFromEnv();
      expect(config.synapse.enabled).toBe(false);
    });

    it('should read fallback to local from env', () => {
      process.env.ZUOJIA_MCP_FALLBACK_TO_LOCAL = 'false';
      const config = createConfigFromEnv();
      expect(config.synapse.fallbackToLocal).toBe(false);
    });

    it('should read log level from env', () => {
      process.env.ZUOJIA_MCP_LOG_LEVEL = 'debug';
      const config = createConfigFromEnv();
      expect(config.logging.logLevel).toBe('debug');
    });

    it('should read max retries from env', () => {
      process.env.ZUOJIA_MCP_MAX_RETRIES = '5';
      const config = createConfigFromEnv();
      expect(config.mcpClient.maxRetries).toBe(5);
    });

    it('should read tool timeout from env', () => {
      process.env.ZUOJIA_MCP_TOOL_TIMEOUT = '60000';
      const config = createConfigFromEnv();
      expect(config.mcpClient.callToolTimeoutMs).toBe(60000);
    });
  });

  describe('createConfig', () => {
    it('should create config with overrides', () => {
      const config = createConfig({
        mcpClient: { maxRetries: 7 },
        logging: { logLevel: 'warn' },
      });
      expect(config.mcpClient.maxRetries).toBe(7);
      expect(config.logging.logLevel).toBe('warn');
      expect(config.mcpClient.retryBaseDelay).toBe(1000);
    });
  });
});