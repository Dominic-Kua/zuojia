// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLlmRuntimeManager } from '../../../electron/llm-runtime.js';

describe('llm-runtime manager', () => {
  let childProcess;
  let spawnFn;
  let manager;

  beforeEach(() => {
    childProcess = {
      pid: 4242,
      killed: false,
      kill: vi.fn(() => {
        childProcess.killed = true;
      }),
      on: vi.fn(),
      once: vi.fn(),
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

  it('starts runtime with expected llama.cpp args', async () => {
    const result = await manager.start({
      executablePath: '/tmp/llama-server',
      modelPath: '/tmp/qwen.gguf',
      threads: 4,
      contextSize: 4096,
      temperature: 0.7,
      port: 8080,
      host: '127.0.0.1',
      extraArgs: ['--mlock'],
    });

    expect(result.status).toBe('running');
    expect(spawnFn).toHaveBeenCalledWith(
      '/tmp/llama-server',
      expect.arrayContaining(['--model', '/tmp/qwen.gguf', '--threads', '4', '--ctx-size', '4096']),
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

  it('stops a running process', async () => {
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
    expect(childProcess.kill).toHaveBeenCalled();
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
