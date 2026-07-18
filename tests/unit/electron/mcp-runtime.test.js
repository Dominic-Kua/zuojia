// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMcpRuntimeManager } from '../../../electron/mcp-runtime.js';

describe('mcp-runtime manager', () => {
  let childProcess;
  let spawnFn;
  let manager;

  beforeEach(() => {
    childProcess = {
      pid: 7788,
      exitCode: null,
      kill: vi.fn(() => {
        childProcess.exitCode = 0;
      }),
      on: vi.fn(),
      once: vi.fn((event, cb) => {
        if (event === 'exit') {
          cb(0, null);
        }
      }),
      stderr: { on: vi.fn() },
      stdout: { on: vi.fn() },
    };

    spawnFn = vi.fn(() => childProcess);

    manager = createMcpRuntimeManager({
      spawnFn,
      nowFn: () => 1000,
      toolExecutor: vi.fn(async (_novelPath, toolName) => ({
        status: 'ok',
        data: { toolName },
      })),
    });
  });

  it('starts and reports health', async () => {
    const started = await manager.start({ novelPath: '/tmp/story-novel' });

    expect(started.status).toBe('running');
    expect(started.novelPath).toBe('/tmp/story-novel');
    expect(spawnFn).toHaveBeenCalled();

    const health = manager.health();
    expect(health.status).toBe('running');
    expect(health.pid).toBe(7788);
  });

  it('stops the running server', async () => {
    await manager.start({ novelPath: '/tmp/story-novel' });

    const stopped = await manager.stop();
    expect(stopped.status).toBe('stopped');
    expect(childProcess.kill).toHaveBeenCalled();

    const health = manager.health();
    expect(health.status).toBe('stopped');
  });

  it('retries tool calls and logs attempts', async () => {
    const toolExecutor = vi
      .fn()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockResolvedValueOnce({ status: 'ok', data: { pages: [] } });

    manager = createMcpRuntimeManager({
      spawnFn,
      nowFn: () => 2000,
      toolExecutor,
    });

    await manager.start({ novelPath: '/tmp/story-novel' });

    const result = await manager.callTool({
      toolName: 'wiki_list_pages',
      args: { limit: 10 },
      retries: 1,
      timeoutMs: 2000,
    });

    expect(result.status).toBe('ok');
    expect(toolExecutor).toHaveBeenCalledTimes(2);

    const logs = manager.getLogs({ limit: 10 });
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs.at(-1).toolName).toBe('wiki_list_pages');
    expect(logs.at(-1).status).toBe('ok');
  });

  it('throws timeout error for stalled tool call', async () => {
    manager = createMcpRuntimeManager({
      spawnFn,
      nowFn: () => 3000,
      toolExecutor: vi.fn(() => new Promise(() => {})),
    });

    await manager.start({ novelPath: '/tmp/story-novel' });

    await expect(
      manager.callTool({
        toolName: 'wiki_search',
        args: { query: 'hero' },
        timeoutMs: 10,
        retries: 0,
      })
    ).rejects.toThrow('timed out');
  });

  it('retries when tool returns status error and logs failure', async () => {
    const toolExecutor = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'error',
        error: {
          code: 'WIKI_NOT_FOUND',
          message: 'Missing page',
        },
      })
      .mockResolvedValueOnce({ status: 'ok', data: { page: 'hero' } });

    manager = createMcpRuntimeManager({
      spawnFn,
      nowFn: () => 4000,
      toolExecutor,
    });

    await manager.start({ novelPath: '/tmp/story-novel' });

    const result = await manager.callTool({
      toolName: 'wiki_get_page',
      args: { slug: 'hero' },
      retries: 1,
      timeoutMs: 2000,
    });

    expect(result.status).toBe('ok');
    expect(toolExecutor).toHaveBeenCalledTimes(2);

    const logs = manager.getLogs({ limit: 10 });
    // Includes: init failure + retry delay + 2 tool calls = 4 logs
    expect(logs.length).toBe(4);
    // failureLog is 3rd from end (init failure, retry delay, failure, success)
    const failureLog = logs[logs.length - 3];
    const successLog = logs[logs.length - 1];
    expect(failureLog.status).toBe('error');
    expect(failureLog.code).toBe('WIKI_NOT_FOUND');
    expect(successLog.status).toBe('ok');
  });

  it('supports wiki_build_graph tool name', async () => {
    await manager.start({ novelPath: '/tmp/story-novel' });

    await expect(
      manager.callTool({
        toolName: 'wiki_build_graph',
        args: { maxEdges: 100 },
      })
    ).resolves.toEqual({
      status: 'ok',
      data: { toolName: 'wiki_build_graph' },
    });
  });

  it('stops cleanly when process exits right after listener registration', async () => {
    const raceChildProcess = {
      pid: 8877,
      exitCode: null,
      kill: vi.fn(),
      on: vi.fn(),
      once: vi.fn((event) => {
        if (event === 'exit') {
          raceChildProcess.exitCode = 0;
        }
      }),
      stderr: { on: vi.fn() },
      stdout: { on: vi.fn() },
    };
    const raceSpawnFn = vi.fn(() => raceChildProcess);

    manager = createMcpRuntimeManager({
      spawnFn: raceSpawnFn,
      nowFn: () => 5000,
      toolExecutor: vi.fn(async () => ({ status: 'ok' })),
    });

    await manager.start({ novelPath: '/tmp/story-novel' });

    await expect(manager.stop()).resolves.toEqual({
      status: 'stopped',
      alreadyStopped: false,
    });
  });
});
