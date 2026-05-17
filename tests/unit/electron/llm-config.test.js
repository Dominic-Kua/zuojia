// @vitest-environment node

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadLlmConfig, saveLlmConfig, validateLlmConfig, DEFAULT_LLM_CONFIG } from '../../../electron/llm-config.js';

describe('llm-config', () => {
  let tempDir;

  const fakeApp = (root) => ({
    getPath(name) {
      if (name !== 'userData') throw new Error('unexpected path key');
      return root;
    },
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zuojia-llm-config-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('loads defaults when config file does not exist', async () => {
    const config = await loadLlmConfig(fakeApp(tempDir));
    expect(config).toEqual(DEFAULT_LLM_CONFIG);
  });

  it('saves and reloads validated config', async () => {
    await saveLlmConfig(fakeApp(tempDir), {
      executablePath: '/tmp/llama-server',
      modelPath: '/tmp/qwen2.5-7b-instruct-q4_k_m.gguf',
      threads: 6,
      contextSize: 8192,
      temperature: 0.5,
      port: 8091,
    });

    const loaded = await loadLlmConfig(fakeApp(tempDir));
    expect(loaded.executablePath).toBe('/tmp/llama-server');
    expect(loaded.modelPath).toBe('/tmp/qwen2.5-7b-instruct-q4_k_m.gguf');
    expect(loaded.threads).toBe(6);
    expect(loaded.contextSize).toBe(8192);
    expect(loaded.temperature).toBe(0.5);
    expect(loaded.port).toBe(8091);
    expect(loaded.modelSourceUrl).toMatch(/^https:\/\//);
    expect(loaded.modelSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects invalid runtime values', () => {
    expect(() => validateLlmConfig({ ...DEFAULT_LLM_CONFIG, threads: 0 })).toThrow('threads');
    expect(() => validateLlmConfig({ ...DEFAULT_LLM_CONFIG, contextSize: 0 })).toThrow('contextSize');
    expect(() => validateLlmConfig({ ...DEFAULT_LLM_CONFIG, temperature: -1 })).toThrow('temperature');
    expect(() => validateLlmConfig({ ...DEFAULT_LLM_CONFIG, port: 99999 })).toThrow('port');
    expect(() => validateLlmConfig({ ...DEFAULT_LLM_CONFIG, modelSourceUrl: 'http://insecure' })).toThrow(
      'modelSourceUrl'
    );
    expect(() => validateLlmConfig({ ...DEFAULT_LLM_CONFIG, modelSha256: 'deadbeef' })).toThrow(
      'modelSha256'
    );
  });

  it('backs up invalid persisted config and falls back to defaults', async () => {
    const configPath = path.join(tempDir, 'llm-config.json');
    await fs.writeFile(configPath, '{ invalid-json ', 'utf-8');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const loaded = await loadLlmConfig(fakeApp(tempDir));
    expect(loaded).toEqual(DEFAULT_LLM_CONFIG);

    const entries = await fs.readdir(tempDir);
    expect(entries.some((entry) => entry.startsWith('llm-config.json.invalid-') && entry.endsWith('.bak'))).toBe(true);
    expect(entries).not.toContain('llm-config.json');

    warnSpy.mockRestore();
  });
});
