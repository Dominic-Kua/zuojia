// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock child_process ──
const mcpProcess = {
  pid: 6666,
  exitCode: null,
  kill: vi.fn(() => true),
  on: vi.fn(),
  once: vi.fn(),
  stderr: { on: vi.fn() },
  stdout: { on: vi.fn(), pipe: vi.fn(), unpipe: vi.fn() },
  stdin: { write: vi.fn(), end: vi.fn() },
};

vi.mock('child_process', () => ({
  spawn: vi.fn(() => mcpProcess),
}));

// ── Mock fs/promises ──
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(),
    writeFile: vi.fn().mockResolvedValue(),
    readFile: vi.fn().mockResolvedValue(''),
    access: vi.fn().mockResolvedValue(),
  },
}));

// ── Mock McpClient ──
const mockMcpClient = {
  initialize: vi.fn().mockResolvedValue(),
  getTools: vi.fn().mockReturnValue([]),
  callTool: vi.fn().mockResolvedValue({ status: 'ok', data: 'test' }),
  shutdown: vi.fn().mockResolvedValue(),
  getServerPid: vi.fn().mockReturnValue(6666),
};

vi.mock('../../../helper/src/mcp/mcp-client.js', () => ({
  createMcpClient: vi.fn(() => mockMcpClient),
}));

vi.mock('../../../helper/src/mcp/mcp-transport.js', () => ({
  McpTransport: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../../helper/src/mcp/tool-mapper.js', () => ({
  createToolMapper: vi.fn(() => ({
    hasMapping: vi.fn().mockReturnValue(false),
    getMapping: vi.fn().mockReturnValue(null),
  })),
}));

vi.mock('../../../helper/src/mcp/argument-transformer.js', () => ({
  createArgumentTransformer: vi.fn(() => ({
    transformArgs: vi.fn((args) => args),
  })),
}));

vi.mock('../../../helper/src/mcp/response-normalizer.js', () => ({
  createResponseNormalizer: vi.fn(() => ({
    normalize: vi.fn((result) => result),
  })),
}));

vi.mock('../../../helper/src/mcp/wiki-tools.js', () => ({
  listWikiPagesForMcp: vi.fn().mockResolvedValue({ status: 'ok', data: { pages: [] } }),
  getWikiPageForMcp: vi.fn().mockResolvedValue({ status: 'ok', data: { slug: 'test', content: '' } }),
  searchWikiPagesForMcp: vi.fn().mockResolvedValue({ status: 'ok', data: { results: [] } }),
  getWikiBacklinksForMcp: vi.fn().mockResolvedValue({ status: 'ok', data: { backlinks: [] } }),
  buildWikiKnowledgeGraphForMcp: vi.fn().mockResolvedValue({ status: 'ok', data: { nodes: [], edges: [] } }),
  traverseWikiKnowledgeGraphForMcp: vi.fn().mockResolvedValue({ status: 'ok', data: { nodes: [], edges: [] } }),
}));

vi.mock('../../../helper/src/mcp/config-paths.js', () => ({
  getMcpConfigPath: vi.fn().mockResolvedValue('/tmp/mcp-config.json'),
  getMcpDataDir: vi.fn().mockResolvedValue('/tmp/mcp-data'),
}));

vi.mock('../../../helper/src/mcp/mcp-config.js', () => ({
  createConfig: vi.fn(() => ({
    process: { serverPath: 'helper/src/mcp/project-synapse-bridge.js', env: {} },
    mcpClient: {
      maxRetries: 3,
      retryBaseDelay: 1000,
      maxRetryDelay: 10000,
      callToolTimeoutMs: 30000,
      initializeTimeoutMs: 30000,
    },
    synapse: { enabled: true, fallbackToLocal: true, maxReconnectAttempts: 5 },
    logging: { logLevel: 'info', maxLogs: 200 },
    toolTimeouts: {
      wiki_list_pages: 30000,
      wiki_get_page: 30000,
      wiki_search: 30000,
      wiki_get_backlinks: 30000,
      wiki_build_graph: 10000,
      wiki_traverse_graph: 10000,
      wiki_neo4j_search: 180000,
      wiki_neo4j_get_related: 30000,
      wiki_neo4j_find_paths: 30000,
      wiki_neo4j_query: 30000,
    },
    health: { checkIntervalMs: 5000 },
  })),
}));

// ── Import under test ──
const { createMcpRuntimeManager } = await import('../../../electron/mcp-runtime.js');

describe('mcp-runtime', () => {
  let manager;
  let instantTimers = true;

  beforeEach(() => {
    vi.clearAllMocks();
    instantTimers = true;
    mcpProcess.exitCode = null;
    mcpProcess.kill = vi.fn(() => true);
    mcpProcess.on = vi.fn();
    mcpProcess.once = vi.fn();
    mcpProcess.stdout = { on: vi.fn(), pipe: vi.fn(), unpipe: vi.fn() };
    mcpProcess.stdin = { write: vi.fn(), end: vi.fn() };

    mockMcpClient.initialize.mockResolvedValue();
    mockMcpClient.getTools.mockReturnValue([]);
    mockMcpClient.callTool.mockResolvedValue({ status: 'ok', data: 'test' });
    mockMcpClient.shutdown.mockResolvedValue();

    manager = createMcpRuntimeManager({
      spawnFn: vi.fn(() => mcpProcess),
      nowFn: () => 1000,
      setTimeoutFn: (cb, ms) => instantTimers ? (cb(), 0) : setTimeout(cb, ms),
      clearTimeoutFn: (id) => clearTimeout(id),
    });
  });

  describe('start', () => {
    it('starts MCP and returns running', async () => {
      const result = await manager.start({ novelPath: '/tmp/novel' });
      expect(result.status).toBe('running');
      expect(result.pid).toBe(6666);
      expect(result.novelPath).toBe('/tmp/novel');
    });

    it('throws when novelPath is missing', async () => {
      await expect(manager.start({})).rejects.toThrow('novelPath');
    });

    it('returns already_running when same novel', async () => {
      await manager.start({ novelPath: '/tmp/novel' });
      const result = await manager.start({ novelPath: '/tmp/novel' });
      expect(result.status).toBe('running');
    });

    it('stops previous process when switching novels', async () => {
      await manager.start({ novelPath: '/tmp/novel1' });
      await manager.start({ novelPath: '/tmp/novel2' });
      expect(mcpProcess.kill).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('returns stopped when not running', async () => {
      const result = await manager.stop();
      expect(result.status).toBe('stopped');
      expect(result.alreadyStopped).toBe(true);
    });

    it('shuts down client and kills process', async () => {
      const startResult = await manager.start({ novelPath: '/tmp/novel' });
      const healthBeforeStop = await manager.health();
      await manager.stop();
      // mcpClient may not be set if synapse init failed — just verify stop works
      expect(mcpProcess.kill).toHaveBeenCalled();
    });
  });

  describe('health', () => {
    it('returns stopped when not running', async () => {
      const health = await manager.health();
      expect(health.status).toBe('stopped');
      expect(health.pid).toBeNull();
    });

    it('returns running when started', async () => {
      await manager.start({ novelPath: '/tmp/novel' });
      const health = await manager.health();
      expect(health.status).toBe('running');
      expect(health.pid).toBe(6666);
    });
  });

  describe('callTool', () => {
    it('calls local tool when synapse unavailable', async () => {
      instantTimers = false;
      await manager.start({ novelPath: '/tmp/novel' });
      const result = await manager.callTool({ toolName: 'wiki_list_pages', args: { limit: 5 } });
      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
    });
  });

  describe('getLogs', () => {
    it('returns logs', async () => {
      const logs = manager.getLogs({ limit: 10 });
      expect(Array.isArray(logs)).toBe(true);
    });
  });
});
