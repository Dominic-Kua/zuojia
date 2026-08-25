// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock dependencies ──
const mockNeo4jRuntime = {
  start: vi.fn(),
  stop: vi.fn(),
  health: vi.fn(),
  hasWikiData: vi.fn(),
};

const mockMcpRuntime = {
  start: vi.fn(),
  stop: vi.fn(),
  health: vi.fn(),
  callTool: vi.fn(),
};

const mockLlmRuntime = {
  start: vi.fn(),
  stop: vi.fn(),
  health: vi.fn(),
};

const mockApp = {
  getPath: vi.fn(() => '/tmp/fake-user-data'),
};

vi.mock('child_process', () => ({
  execSync: vi.fn(() => ''),
}));

vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
    readdir: vi.fn(),
    readFile: vi.fn(),
  },
}));

vi.mock('../../../electron/llm-config.js', () => ({
  loadLlmConfig: vi.fn().mockResolvedValue({
    executablePath: '/opt/homebrew/bin/llama-server',
    modelName: 'gemma4',
    host: '127.0.0.1',
    port: 8080,
  }),
}));

// ── Import under test ──
const { createOrchestrator } = await import('../../../electron/orchestrator.js');

describe('orchestrator', () => {
  let orchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNeo4jRuntime.health.mockResolvedValue({ status: 'stopped' });
    mockMcpRuntime.health.mockResolvedValue({ status: 'stopped' });
    mockLlmRuntime.health.mockResolvedValue({ status: 'stopped' });
    mockNeo4jRuntime.start.mockResolvedValue({ status: 'running', pid: 1001 });
    mockMcpRuntime.start.mockResolvedValue({ status: 'running', pid: 1002, usingSynapse: false });
    mockLlmRuntime.start.mockResolvedValue({ status: 'running', pid: 1003 });
    mockNeo4jRuntime.stop.mockResolvedValue({ status: 'stopped' });
    mockMcpRuntime.stop.mockResolvedValue({ status: 'stopped' });
    mockLlmRuntime.stop.mockResolvedValue({ status: 'stopped' });
    mockNeo4jRuntime.hasWikiData.mockResolvedValue(false);

    orchestrator = createOrchestrator(mockNeo4jRuntime, mockMcpRuntime, mockLlmRuntime, mockApp);
  });

  describe('startAll', () => {
    it('starts all services successfully', async () => {
      const fsp = await import('fs/promises');
      fsp.default.access.mockRejectedValue(new Error('ENOENT')); // wiki dir missing

      const result = await orchestrator.startAll({ novelPath: '/tmp/novel' });
      expect(result.status).toBe('ok');
      expect(result.novelPath).toBe('/tmp/novel');
      expect(result.neo4j.status).toBe('running');
      expect(result.mcp.status).toBe('running');
      expect(result.llm.status).toBe('running');
      expect(result.ingest.status).toBe('skipped');
    });

    it('returns already_running when same novel is already started', async () => {
      const fsp = await import('fs/promises');
      fsp.default.access.mockRejectedValue(new Error('ENOENT'));

      await orchestrator.startAll({ novelPath: '/tmp/novel' });
      const result = await orchestrator.startAll({ novelPath: '/tmp/novel' });
      expect(result.status).toBe('already_running');
      expect(result.novelPath).toBe('/tmp/novel');
    });

    it('stops previous services and starts new novel', async () => {
      const fsp = await import('fs/promises');
      fsp.default.access.mockRejectedValue(new Error('ENOENT'));

      await orchestrator.startAll({ novelPath: '/tmp/novel-1' });
      vi.clearAllMocks();
      // Re-setup mocks needed for the second startAll
      mockNeo4jRuntime.health.mockResolvedValue({ status: 'stopped' });
      mockMcpRuntime.health.mockResolvedValue({ status: 'stopped' });
      mockLlmRuntime.health.mockResolvedValue({ status: 'stopped' });
      mockNeo4jRuntime.start.mockResolvedValue({ status: 'running', pid: 2001 });
      mockMcpRuntime.start.mockResolvedValue({ status: 'running', pid: 2002 });
      mockLlmRuntime.start.mockResolvedValue({ status: 'running', pid: 2003 });
      mockNeo4jRuntime.stop.mockResolvedValue({ status: 'stopped' });
      mockMcpRuntime.stop.mockResolvedValue({ status: 'stopped' });
      mockLlmRuntime.stop.mockResolvedValue({ status: 'stopped' });

      const result = await orchestrator.startAll({ novelPath: '/tmp/novel-2' });
      expect(result.status).toBe('ok');
      expect(result.novelPath).toBe('/tmp/novel-2');
    });

    it('skips MCP start when Neo4j fails to start', async () => {
      mockNeo4jRuntime.start.mockRejectedValue(new Error('Neo4j not found'));

      const result = await orchestrator.startAll({ novelPath: '/tmp/novel' });
      expect(result.status).toBe('ok'); // orchestrator doesn't throw, reports errors in result
      expect(result.neo4j.status).toBe('error');
      // MCP step 1 killed it, but step 4 was skipped since Neo4j is not running
      expect(result.mcp.status).toBe('killed');
      expect(mockMcpRuntime.start).not.toHaveBeenCalled();
    });

    it('skips wiki ingest when MCP fails to start', async () => {
      mockMcpRuntime.start.mockRejectedValue(new Error('MCP spawn fail'));

      const result = await orchestrator.startAll({ novelPath: '/tmp/novel' });
      expect(result.mcp.status).toBe('error');
      expect(result.ingest.status).toBe('skipped');
    });

    it('starts LLM even when other services fail', async () => {
      mockNeo4jRuntime.start.mockRejectedValue(new Error('neo4j fail'));
      mockMcpRuntime.health.mockResolvedValue({ status: 'stopped' });

      const result = await orchestrator.startAll({ novelPath: '/tmp/novel' });
      expect(result.neo4j.status).toBe('error');
      // LLM should still be started
      expect(mockLlmRuntime.start).toHaveBeenCalled();
    });

    it('skips LLM start when health returns running', async () => {
      const fsp = await import('fs/promises');
      fsp.default.access.mockRejectedValue(new Error('ENOENT'));
      mockLlmRuntime.health.mockResolvedValue({ status: 'running', pid: 9999 });

      const result = await orchestrator.startAll({ novelPath: '/tmp/novel' });
      // Note: spread { status: 'already_running', ...llmHealth } overwrites status
      // because llmHealth.status is 'running'. This is current behavior.
      expect(result.llm.pid).toBe(9999);
      expect(mockLlmRuntime.start).not.toHaveBeenCalled();
    });

    it('skips wiki ingest when wiki directory does not exist', async () => {
      const fsp = await import('fs/promises');
      fsp.default.access.mockRejectedValue(new Error('ENOENT'));

      const result = await orchestrator.startAll({ novelPath: '/tmp/novel' });
      expect(result.ingest.status).toBe('skipped');
      expect(result.ingest.reason).toBe('no_wiki_dir');
    });

    it('skips wiki ingest when Neo4j already has data', async () => {
      const fsp = await import('fs/promises');
      fsp.default.access.mockResolvedValue(); // wiki dir exists
      mockNeo4jRuntime.hasWikiData.mockResolvedValue(true);

      const result = await orchestrator.startAll({ novelPath: '/tmp/novel' });
      expect(result.ingest.status).toBe('skipped');
      expect(result.ingest.reason).toBe('already_has_data');
    });

    it('ingests wiki data when wiki dir exists and Neo4j is empty', async () => {
      const fsp = await import('fs/promises');
      // wiki dir exists
      fsp.default.access.mockImplementation((p) => {
        if (String(p).includes('wiki')) return Promise.resolve();
        throw new Error('ENOENT');
      });
      fsp.default.readdir.mockResolvedValue([
        { name: 'hero.md', isDirectory: () => false, isFile: () => true },
      ]);
      fsp.default.readFile.mockResolvedValue('# Hero\nSome content');
      mockNeo4jRuntime.hasWikiData.mockResolvedValue(false);
      mockMcpRuntime.callTool.mockResolvedValue({ status: 'ok' });

      const result = await orchestrator.startAll({ novelPath: '/tmp/novel' });
      expect(result.ingest.status).toBe('ok');
      expect(result.ingest.filesIngested).toBe(1);
      expect(result.ingest.totalFiles).toBe(1);
    });

    it('skips empty wiki files during ingest', async () => {
      const fsp = await import('fs/promises');
      fsp.default.access.mockImplementation((p) => {
        if (String(p).includes('wiki')) return Promise.resolve();
        throw new Error('ENOENT');
      });
      fsp.default.readdir.mockResolvedValue([
        { name: 'empty.md', isDirectory: () => false, isFile: () => true },
      ]);
      fsp.default.readFile.mockResolvedValue('   '); // empty content
      mockNeo4jRuntime.hasWikiData.mockResolvedValue(false);

      const result = await orchestrator.startAll({ novelPath: '/tmp/novel' });
      expect(result.ingest.filesIngested).toBe(0);
      expect(result.ingest.errors).toBe(0);
    });

    it('counts ingest errors but continues', async () => {
      const fsp = await import('fs/promises');
      fsp.default.access.mockImplementation((p) => {
        if (String(p).includes('wiki')) return Promise.resolve();
        throw new Error('ENOENT');
      });
      fsp.default.readdir.mockResolvedValue([
        { name: 'ok.md', isDirectory: () => false, isFile: () => true },
        { name: 'bad.md', isDirectory: () => false, isFile: () => true },
      ]);
      fsp.default.readFile.mockImplementation((p) => {
        if (String(p).includes('bad')) return Promise.resolve('content');
        return Promise.resolve('content');
      });
      mockNeo4jRuntime.hasWikiData.mockResolvedValue(false);
      mockMcpRuntime.callTool
        .mockResolvedValueOnce({ status: 'ok' })
        .mockRejectedValueOnce(new Error('ingest fail'));

      const result = await orchestrator.startAll({ novelPath: '/tmp/novel' });
      expect(result.ingest.filesIngested).toBe(1);
      expect(result.ingest.errors).toBe(1);
    });

    it('ingests from subdirectories recursively', async () => {
      const fsp = await import('fs/promises');
      fsp.default.access.mockImplementation((p) => {
        if (String(p).includes('wiki')) return Promise.resolve();
        throw new Error('ENOENT');
      });
      // First call: wiki dir
      fsp.default.readdir.mockResolvedValueOnce([
        { name: 'subdir', isDirectory: () => true, isFile: () => false },
      ]);
      // Second call: subdir
      fsp.default.readdir.mockResolvedValueOnce([
        { name: 'page.md', isDirectory: () => false, isFile: () => true },
      ]);
      fsp.default.readFile.mockResolvedValue('# Page');
      mockNeo4jRuntime.hasWikiData.mockResolvedValue(false);
      mockMcpRuntime.callTool.mockResolvedValue({ status: 'ok' });

      const result = await orchestrator.startAll({ novelPath: '/tmp/novel' });
      expect(result.ingest.totalFiles).toBe(1);
      expect(result.ingest.filesIngested).toBe(1);
    });

    it('skips hidden directories during wiki ingest', async () => {
      const fsp = await import('fs/promises');
      fsp.default.access.mockImplementation((p) => {
        if (String(p).includes('wiki')) return Promise.resolve();
        throw new Error('ENOENT');
      });
      fsp.default.readdir.mockResolvedValue([
        { name: '.git', isDirectory: () => true, isFile: () => false },
        { name: 'page.md', isDirectory: () => false, isFile: () => true },
      ]);
      fsp.default.readFile.mockResolvedValue('# Page');
      mockNeo4jRuntime.hasWikiData.mockResolvedValue(false);
      mockMcpRuntime.callTool.mockResolvedValue({ status: 'ok' });

      const result = await orchestrator.startAll({ novelPath: '/tmp/novel' });
      expect(result.ingest.totalFiles).toBe(1); // .git skipped
    });

    it('catches hasWikiData check failure and ingests anyway', async () => {
      const fsp = await import('fs/promises');
      fsp.default.access.mockImplementation((p) => {
        if (String(p).includes('wiki')) return Promise.resolve();
        throw new Error('ENOENT');
      });
      fsp.default.readdir.mockResolvedValue([
        { name: 'page.md', isDirectory: () => false, isFile: () => true },
      ]);
      fsp.default.readFile.mockResolvedValue('# Page');
      mockNeo4jRuntime.hasWikiData.mockRejectedValue(new Error('driver closed'));
      mockMcpRuntime.callTool.mockResolvedValue({ status: 'ok' });

      const result = await orchestrator.startAll({ novelPath: '/tmp/novel' });
      // Should still ingest when check fails
      expect(result.ingest.filesIngested).toBe(1);
    });
  });

  describe('stopAll', () => {
    it('stops all services in reverse order', async () => {
      await orchestrator.startAll({ novelPath: '/tmp/novel' });
      vi.clearAllMocks();

      const result = await orchestrator.stopAll();
      expect(result.llm.status).toBe('stopped');
      expect(result.mcp.status).toBe('stopped');
      expect(result.neo4j.status).toBe('stopped');
      // Verify stop order: LLM first, then MCP, then Neo4j
      const llmStopOrder = mockLlmRuntime.stop.mock.invocationCallOrder[0];
      const mcpStopOrder = mockMcpRuntime.stop.mock.invocationCallOrder[0];
      const neo4jStopOrder = mockNeo4jRuntime.stop.mock.invocationCallOrder[0];
      expect(llmStopOrder).toBeLessThan(mcpStopOrder);
      expect(mcpStopOrder).toBeLessThan(neo4jStopOrder);
    });

    it('handles stop failures gracefully', async () => {
      await orchestrator.startAll({ novelPath: '/tmp/novel' });
      vi.clearAllMocks();

      mockLlmRuntime.stop.mockRejectedValue(new Error('llm stop fail'));
      mockMcpRuntime.stop.mockRejectedValue(new Error('mcp stop fail'));
      mockNeo4jRuntime.stop.mockRejectedValue(new Error('neo4j stop fail'));

      const result = await orchestrator.stopAll();
      expect(result.llm.status).toBe('error');
      expect(result.mcp.status).toBe('error');
      expect(result.neo4j.status).toBe('error');
    });

    it('can be called when nothing is running', async () => {
      const result = await orchestrator.stopAll();
      expect(result.llm.status).toBe('stopped');
      expect(result.mcp.status).toBe('stopped');
      expect(result.neo4j.status).toBe('stopped');
    });
  });

  describe('status', () => {
    it('returns status of all services', async () => {
      await orchestrator.startAll({ novelPath: '/tmp/novel' });
      vi.clearAllMocks();

      mockNeo4jRuntime.health.mockResolvedValue({ status: 'running', pid: 1001 });
      mockMcpRuntime.health.mockResolvedValue({ status: 'running', pid: 1002 });
      mockLlmRuntime.health.mockResolvedValue({ status: 'running', pid: 1003 });

      const result = await orchestrator.status();
      expect(result.neo4j.status).toBe('running');
      expect(result.mcp.status).toBe('running');
      expect(result.llm.status).toBe('running');
      expect(result.currentNovelPath).toBe('/tmp/novel');
    });
  });
});
