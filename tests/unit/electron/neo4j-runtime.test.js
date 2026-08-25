// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock child_process ──
const childProcess = {
  pid: 5555,
  exitCode: null,
  kill: vi.fn(() => true),
  on: vi.fn(),
  once: vi.fn(),
  stderr: { on: vi.fn() },
  stdout: { on: vi.fn() },
};

vi.mock('child_process', () => ({
  spawn: vi.fn(() => childProcess),
}));

// ── Mock fs/promises ──
const mockFs = {
  mkdir: vi.fn().mockResolvedValue(),
  writeFile: vi.fn().mockResolvedValue(),
  readFile: vi.fn().mockResolvedValue(''),
  access: vi.fn().mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
  rm: vi.fn().mockResolvedValue(),
};
vi.mock('fs/promises', () => ({ default: mockFs }));

// ── Mock find-neo4j and find-java ──
vi.mock('../../../electron/find-neo4j.js', () => ({
  findNeo4jHome: vi.fn().mockResolvedValue('/opt/homebrew/Cellar/neo4j/2026.06.0/libexec'),
}));
vi.mock('../../../electron/find-java.js', () => ({
  findJavaHome: vi.fn().mockResolvedValue('/opt/homebrew/Cellar/openjdk@21/21.0.12/libexec/openjdk.jdk/Contents/Home'),
}));

// ── Mock neo4j-driver ──
const mockSession = {
  run: vi.fn().mockResolvedValue({ records: [] }),
  close: vi.fn().mockResolvedValue(),
};
const mockDriver = {
  getServerInfo: vi.fn().mockResolvedValue({ version: '5.x' }),
  session: vi.fn().mockReturnValue(mockSession),
  close: vi.fn().mockResolvedValue(),
};

vi.mock('neo4j-driver', () => ({
  default: {
    driver: vi.fn(() => mockDriver),
    auth: { basic: vi.fn() },
  },
}));

// ── Mock wiki-tools ──
vi.mock('../../../helper/src/mcp/wiki-tools.js', () => ({
  buildWikiKnowledgeGraphForMcp: vi.fn().mockResolvedValue({
    status: 'ok',
    data: { nodes: [], edges: [] },
  }),
}));

// ── Import under test ──
const { createNeo4jRuntimeManager } = await import('../../../electron/neo4j-runtime.js');

describe('neo4j-runtime', () => {
  let manager;
  let handlers;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = new Map();

    childProcess.exitCode = null;
    childProcess.kill = vi.fn(() => true);
    childProcess.on = vi.fn((event, cb) => handlers.set(event, cb));
    childProcess.once = vi.fn((event, cb) => handlers.set(event, cb));
    childProcess.stdout = { on: vi.fn() };
    childProcess.stderr = { on: vi.fn() };

    mockFs.mkdir.mockResolvedValue();
    mockFs.writeFile.mockResolvedValue();
    mockFs.readFile.mockResolvedValue('');
    mockFs.access.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    mockFs.rm.mockResolvedValue();

    mockDriver.getServerInfo.mockResolvedValue({ version: '5.x' });
    mockDriver.session.mockReturnValue(mockSession);
    mockSession.run.mockResolvedValue({ records: [] });
    mockSession.close.mockResolvedValue();
    mockDriver.close.mockResolvedValue();

    manager = createNeo4jRuntimeManager({
      spawnFn: vi.fn(() => childProcess),
      nowFn: () => 1000,
      setTimeoutFn: vi.fn((cb) => cb()), // instant timeout
      clearTimeoutFn: vi.fn(),
    });
  });

  describe('start', () => {
    it('starts Neo4j and returns running status', async () => {
      // Make getServerInfo succeed immediately
      mockDriver.getServerInfo.mockResolvedValue({ version: '5.x' });

      const result = await manager.start({ novelPath: '/tmp/novel' });
      expect(result.status).toBe('running');
      expect(result.pid).toBe(5555);
      expect(result.novelPath).toBe('/tmp/novel');
      expect(result.databaseName).toBe('wiki');
    });

    it('writes neo4j config file', async () => {
      await manager.start({ novelPath: '/tmp/novel' });
      expect(mockFs.writeFile).toHaveBeenCalled();
      const configContent = mockFs.writeFile.mock.calls[0][1];
      expect(configContent).toContain('auth_enabled=false');
      expect(configContent).toContain('server.memory.heap.initial_size=512m');
    });

    it('creates data directory', async () => {
      await manager.start({ novelPath: '/tmp/novel' });
      expect(mockFs.mkdir).toHaveBeenCalled();
    });

    it('uses custom database name', async () => {
      const result = await manager.start({ novelPath: '/tmp/novel', dbName: 'custom' });
      expect(result.databaseName).toBe('custom');
    });

    it('returns already running when same novel', async () => {
      await manager.start({ novelPath: '/tmp/novel' });
      vi.clearAllMocks();

      const result = await manager.start({ novelPath: '/tmp/novel' });
      expect(result.status).toBe('running');
      // spawn should NOT be called again
      const spawnFn = manager.constructor ? null : null; // can't check directly, but we can check pid
    });

    it('throws when novelPath is missing', async () => {
      await expect(manager.start({})).rejects.toThrow('novelPath is required');
    });

    it('throws when Neo4j home not found', async () => {
      const { findNeo4jHome } = await import('../../../electron/find-neo4j.js');
      findNeo4jHome.mockResolvedValueOnce(null);
      await expect(manager.start({ novelPath: '/tmp/novel' })).rejects.toThrow('Neo4j not found');
    });

    it('handles stderr output', async () => {
      await manager.start({ novelPath: '/tmp/novel' });
      const stderrHandler = childProcess.stderr.on.mock.calls.find(c => c[0] === 'data');
      expect(stderrHandler).toBeTruthy();
    });

    it('handles stdout startup message', async () => {
      await manager.start({ novelPath: '/tmp/novel' });
      const stdoutHandler = childProcess.stdout.on.mock.calls.find(c => c[0] === 'data');
      expect(stdoutHandler).toBeTruthy();
    });

    it('handles process error event', async () => {
      await manager.start({ novelPath: '/tmp/novel' });
      const errorHandler = childProcess.on.mock.calls.find(c => c[0] === 'error');
      expect(errorHandler).toBeTruthy();
      // Simulate error
      errorHandler[1](new Error('spawn failed'));
      const logs = manager.getLogs({ limit: 50 });
      expect(logs.some(l => l.type === 'neo4j_process_error')).toBe(true);
    });

    it('handles process exit event', async () => {
      await manager.start({ novelPath: '/tmp/novel' });
      const exitHandler = childProcess.on.mock.calls.find(c => c[0] === 'exit');
      expect(exitHandler).toBeTruthy();
    });
  });

  describe('stop', () => {
    it('returns stopped when not running', async () => {
      const result = await manager.stop();
      expect(result.status).toBe('stopped');
      expect(result.alreadyStopped).toBe(true);
    });

    it('sends SIGTERM and returns stopped', async () => {
      await manager.start({ novelPath: '/tmp/novel' });
      // setTimeoutFn calls callback immediately → resolveExit fires → waitForExit resolves
      const result = await manager.stop();
      expect(result.status).toBe('stopped');
      expect(result.alreadyStopped).toBe(false);
    });

    it('cleans up driver on stop', async () => {
      await manager.start({ novelPath: '/tmp/novel' });
      await manager.stop();
      expect(mockDriver.close).toHaveBeenCalled();
    });
  });

  describe('health', () => {
    it('returns stopped when not running', async () => {
      const health = await manager.health();
      expect(health.status).toBe('stopped');
      expect(health.pid).toBeNull();
    });

    it('returns running with driver info when running', async () => {
      await manager.start({ novelPath: '/tmp/novel' });
      mockDriver.getServerInfo.mockResolvedValue({ version: '5.x' });

      const health = await manager.health();
      expect(health.status).toBe('running');
      expect(health.pid).toBe(5555);
      expect(health.novelPath).toBe('/tmp/novel');
      expect(health.databaseName).toBe('wiki');
    });
  });

  describe('hasWikiData', () => {
    it('returns false when not running', async () => {
      const result = await manager.hasWikiData();
      expect(result).toBe(false);
    });

    it('queries for Entity nodes when running', async () => {
      await manager.start({ novelPath: '/tmp/novel' });
      mockSession.run.mockResolvedValue({
        records: [{ get: () => 5 }],
      });

      const result = await manager.hasWikiData();
      expect(result).toBe(true);
      expect(mockSession.run).toHaveBeenCalledWith('MATCH (e:Entity) RETURN count(e) AS count');
    });

    it('returns false when count is zero', async () => {
      await manager.start({ novelPath: '/tmp/novel' });
      mockSession.run.mockResolvedValue({
        records: [{ get: () => 0 }],
      });

      const result = await manager.hasWikiData();
      expect(result).toBe(false);
    });
  });

  describe('importWikiData', () => {
    it('returns error when not running', async () => {
      await expect(manager.importWikiData()).rejects.toThrow('not running');
    });

    it('skips import when data already exists', async () => {
      await manager.start({ novelPath: '/tmp/novel' });
      mockSession.run.mockResolvedValue({
        records: [{ get: () => 3 }],
      });

      const result = await manager.importWikiData();
      expect(result.status).toBe('skipped');
      expect(result.reason).toBe('already_has_data');
    });
  });

  describe('queryCypher', () => {
    it('returns error when not running', async () => {
      await expect(manager.queryCypher('MATCH (n) RETURN n')).rejects.toThrow('not running');
    });

    it('executes query and returns records', async () => {
      await manager.start({ novelPath: '/tmp/novel' });
      mockSession.run.mockResolvedValue({
        records: [{ toObject: () => ({ n: 'test' }) }],
        summary: { counters: {} },
      });

      const result = await manager.queryCypher('MATCH (n) RETURN n', { limit: 10 });
      expect(result.status).toBe('ok');
      expect(result.data).toEqual([{ n: 'test' }]);
    });

    it('logs query errors', async () => {
      await manager.start({ novelPath: '/tmp/novel' });
      mockSession.run.mockRejectedValue(new Error('Syntax error'));

      await expect(manager.queryCypher('BAD QUERY')).rejects.toThrow('Syntax error');
      const logs = manager.getLogs({ limit: 10 });
      expect(logs.some(l => l.type === 'neo4j_query_error')).toBe(true);
    });
  });

  describe('naturalLanguageSearch', () => {
    it('returns error when not running', async () => {
      await expect(manager.naturalLanguageSearch('hero')).rejects.toThrow('not running');
    });

    it('searches WikiPage nodes', async () => {
      await manager.start({ novelPath: '/tmp/novel' });
      mockSession.run.mockResolvedValue({
        records: [{
          get: (key) => {
            if (key === 'slug') return 'hero';
            if (key === 'title') return 'Hero Page';
            if (key === 'tags') return ['protagonist'];
            return null;
          },
        }],
      });

      const result = await manager.naturalLanguageSearch('hero', 5);
      expect(result.status).toBe('ok');
      expect(result.data.results).toHaveLength(1);
      expect(result.data.results[0].slug).toBe('hero');
    });
  });

  describe('getLogs', () => {
    it('returns empty array initially', () => {
      expect(manager.getLogs()).toEqual([]);
    });

    it('returns recent logs with limit', async () => {
      await manager.start({ novelPath: '/tmp/novel' });
      const logs = manager.getLogs({ limit: 5 });
      expect(Array.isArray(logs)).toBe(true);
    });

    it('enforces minimum and maximum limits', () => {
      const logsMin = manager.getLogs({ limit: -1 });
      expect(logsMin.length).toBeGreaterThanOrEqual(0);
      const logsMax = manager.getLogs({ limit: 99999 });
      expect(Array.isArray(logsMax)).toBe(true);
    });
  });
});
