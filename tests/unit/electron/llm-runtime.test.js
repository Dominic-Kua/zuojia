// @vitest-environment node

import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('child_process', () => ({ spawn: vi.fn() }));
vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
    mkdir: vi.fn(),
  },
}));
vi.mock('http', () => ({ default: { request: vi.fn() } }));

import fs from 'fs/promises';
import http from 'http';
import { createLlmRuntimeManager } from '../../../electron/llm-runtime.js';

let healthStatuses;

function createChildProcess(pid) {
  const child = new EventEmitter();
  child.pid = pid;
  child.exitCode = null;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn((signal) => {
    if (signal === 'SIGTERM') {
      child.exitCode = 0;
      queueMicrotask(() => child.emit('exit', 0, signal));
    }
    if (signal === 'SIGKILL') {
      child.exitCode = 137;
      queueMicrotask(() => child.emit('exit', 137, signal));
    }
    return true;
  });
  return child;
}

function createConfig(overrides = {}) {
  return {
    executablePath: '/tmp/llama-server',
    modelName: 'test-model',
    modelDir: '/tmp/models',
    host: '127.0.0.1',
    port: 8080,
    ngl: 32,
    ctxSize: 4096,
    ...overrides,
  };
}

describe('LLM runtime manager', () => {
  let childProcess;
  let spawnFn;
  let accessFn;
  let manager;

  beforeEach(() => {
    healthStatuses = [];
    fs.access.mockReset().mockResolvedValue(undefined);
    fs.stat.mockReset().mockResolvedValue({ size: 200_000_000 });
    fs.unlink.mockReset();
    fs.mkdir.mockReset();
    http.request.mockReset().mockImplementation((_options, onResponse) => {
      const request = new EventEmitter();
      request.destroy = vi.fn();
      request.end = () => {
        const statusCode = healthStatuses.shift() ?? 503;
        queueMicrotask(() => onResponse({ statusCode, resume: vi.fn() }));
      };
      return request;
    });

    childProcess = createChildProcess(4242);
    spawnFn = vi.fn(() => childProcess);
    accessFn = vi.fn().mockResolvedValue(undefined);
    manager = createLlmRuntimeManager({ spawnFn, accessFn, nowFn: () => 1000 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts llama-server with the resolved model and configured arguments', async () => {
    healthStatuses = [503, 200];

    const result = await manager.start(createConfig());

    expect(result).toMatchObject({
      status: 'running',
      pid: 4242,
      host: '127.0.0.1',
      port: 8080,
      modelName: 'test-model',
    });
    expect(spawnFn).toHaveBeenCalledWith(
      '/tmp/llama-server',
      [
        '-m', '/tmp/models/test-model.gguf',
        '--host', '127.0.0.1',
        '--port', '8080',
        '-ngl', '32',
        '-c', '4096',
      ],
      expect.objectContaining({ stdio: 'pipe' })
    );
    expect(accessFn).toHaveBeenCalledWith('/tmp/llama-server', expect.any(Number));
  });

  it('uses an already-running server without spawning another process', async () => {
    healthStatuses = [200];

    const result = await manager.start(createConfig());

    expect(result).toMatchObject({ status: 'running', host: '127.0.0.1', port: 8080 });
    expect(spawnFn).not.toHaveBeenCalled();
  });

  it('reports health for a managed process', async () => {
    healthStatuses = [503, 200];
    await manager.start(createConfig());

    expect(await manager.health()).toMatchObject({ status: 'running', pid: 4242, uptimeMs: 0 });
  });

  it('waits for process exit when stopping the runtime', async () => {
    healthStatuses = [503, 200];
    await manager.start(createConfig());

    const result = await manager.stop();

    expect(result.status).toBe('stopped');
    expect(childProcess.kill).toHaveBeenCalledWith('SIGTERM');
    healthStatuses = [503];
    expect((await manager.health()).status).toBe('stopped');
  });

  it('ignores stale exit events from a previous process', async () => {
    const firstProcess = createChildProcess(1001);
    const secondProcess = createChildProcess(1002);
    const children = [firstProcess, secondProcess];
    const staleSafeManager = createLlmRuntimeManager({
      spawnFn: vi.fn(() => children.shift()),
      accessFn,
      nowFn: () => 1000,
    });
    healthStatuses = [503, 200, 503, 200];

    await staleSafeManager.start(createConfig());
    await staleSafeManager.stop();
    await staleSafeManager.start(createConfig());
    firstProcess.emit('exit', 0, 'SIGTERM');

    expect((await staleSafeManager.health())).toMatchObject({ status: 'running', pid: 1002 });
  });

  it('fails before spawning when the executable is missing', async () => {
    healthStatuses = [503];
    const missingExecutable = createLlmRuntimeManager({
      spawnFn,
      accessFn: vi.fn().mockRejectedValue(new Error('ENOENT')),
      nowFn: () => 1000,
    });

    await expect(missingExecutable.start(createConfig())).rejects.toThrow(
      'llama-server executable is not accessible'
    );
    expect(spawnFn).not.toHaveBeenCalled();
  });
});
