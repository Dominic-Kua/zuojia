// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLlmRuntimeManager } from '../../../electron/llm-runtime.js';

// TODO(#code-review-2026-08-24): whole suite is skipped — reinstate or delete.
// Tracked in docs/code-review-findings-2026-08-24.md (H17).
describe.skip('llm-runtime manager', () => {
  let childProcess;
  let spawnFn;
  let manager;
  let handlers;

  beforeEach(() => {
    handlers = new Map();
    childProcess = {
      pid: 4242,
      exitCode: null,
      kill: vi.fn((signal) => {
        if (signal === 'SIGTERM') {
          setTimeout(() => {
            childProcess.exitCode = 0;
            handlers.get('exit')?.(0, signal);
          }, 0);
          return true;
        }
        if (signal === 'SIGKILL') {
          childProcess.exitCode = 137;
          handlers.get('exit')?.(137, signal);
          return true;
        }
        return true;
      }),
      on: vi.fn((event, callback) => {
        handlers.set(event, callback);
      }),
      once: vi.fn((event, callback) => {
        handlers.set(event, callback);
      }),
      stderr: { on: vi.fn() },
      stdout: { on: vi.fn() },
    };

    spawnFn = vi.fn(() => childProcess);

    manager = createLlmRuntimeManager({
      spawnFn,
      accessFn: vi.fn(async () => {}),
      nowFn: () => 1000,
    });
  });

  it.skip('starts runtime with expected llama.cpp args', async () => {
    // TODO: Update for ollama
    const result = await manager.start({
      executablePath: '/tmp/ollama',
      modelName: 'gemma4:e2b',
      host: '127.0.0.1',
      port: 11434,
      temperature: 0.7,
      maxTokens: 4096,
    });

    expect(result.status).toBe('running');
    expect(spawnFn).toHaveBeenCalledWith(
      '/tmp/ollama',
      ['serve'],
      expect.objectContaining({ stdio: 'pipe' })
    );
  });

  it('returns health state when running', async () => {
    await manager.start({
      executablePath: '/tmp/llama-server',
      modelPath: '/tmp/qwen.gguf',
      threads: 4,
      contextSize: 4096,
      temperature: 0.7,
      port: 8080,
      host: '127.0.0.1',
      extraArgs: [],
    });

    const health = manager.health();
    expect(health.status).toBe('running');
    expect(health.pid).toBe(4242);
  });

  it('waits for process exit when stopping runtime', async () => {
    await manager.start({
      executablePath: '/tmp/llama-server',
      modelPath: '/tmp/qwen.gguf',
      threads: 4,
      contextSize: 4096,
      temperature: 0.7,
      port: 8080,
      host: '127.0.0.1',
      extraArgs: [],
    });

    const result = await manager.stop();
    expect(result.status).toBe('stopped');
    expect(childProcess.kill).toHaveBeenCalledWith('SIGTERM');
    expect(manager.health().status).toBe('stopped');
  });

  it('ignores stale exit events from a previous process', async () => {
    const firstHandlers = new Map();
    const secondHandlers = new Map();
    let spawnCount = 0;
    const firstChild = {
      pid: 1001,
      exitCode: null,
      kill: vi.fn((signal) => {
        if (signal === 'SIGTERM') {
          firstChild.exitCode = 0;
          firstHandlers.get('exit')?.(0, signal);
          return true;
        }
        return true;
      }),
      on: vi.fn((event, callback) => {
        firstHandlers.set(event, callback);
      }),
      once: vi.fn((event, callback) => {
        firstHandlers.set(event, callback);
      }),
      stderr: { on: vi.fn() },
      stdout: { on: vi.fn() },
    };
    const secondChild = {
      pid: 1002,
      exitCode: null,
      kill: vi.fn(() => true),
      on: vi.fn((event, callback) => {
        secondHandlers.set(event, callback);
      }),
      once: vi.fn((event, callback) => {
        secondHandlers.set(event, callback);
      }),
      stderr: { on: vi.fn() },
      stdout: { on: vi.fn() },
    };

    const staleSafeManager = createLlmRuntimeManager({
      spawnFn: vi.fn(() => {
        spawnCount += 1;
        return spawnCount === 1 ? firstChild : secondChild;
      }),
      accessFn: vi.fn(async () => {}),
      nowFn: () => 1000,
    });

    await staleSafeManager.start({
      executablePath: '/tmp/llama-server',
      modelPath: '/tmp/qwen.gguf',
      threads: 4,
      contextSize: 4096,
      temperature: 0.7,
      port: 8080,
      host: '127.0.0.1',
      extraArgs: [],
    });
    await staleSafeManager.stop();

    await staleSafeManager.start({
      executablePath: '/tmp/llama-server',
      modelPath: '/tmp/qwen.gguf',
      threads: 4,
      contextSize: 4096,
      temperature: 0.7,
      port: 8080,
      host: '127.0.0.1',
      extraArgs: [],
    });

    firstHandlers.get('exit')?.(0, 'SIGTERM');
    const health = staleSafeManager.health();
    expect(health.status).toBe('running');
    expect(health.pid).toBe(1002);
  });

  it('fails start when executable is missing', async () => {
    const missingCheck = vi.fn(async () => {
      throw new Error('ENOENT');
    });

    const failingManager = createLlmRuntimeManager({
      spawnFn,
      accessFn: missingCheck,
      nowFn: () => 1000,
    });

    await expect(
      failingManager.start({
        executablePath: '/tmp/missing-llama-server',
        modelPath: '/tmp/qwen.gguf',
        threads: 4,
        contextSize: 4096,
        temperature: 0.7,
        port: 8080,
        host: '127.0.0.1',
        extraArgs: [],
      })
    ).rejects.toThrow('executable');
  });
});
