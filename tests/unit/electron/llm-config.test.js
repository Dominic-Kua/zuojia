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
    vi.restoreAllMocks();
  });

  it('loads defaults when config file does not exist', async () => {
    const config = await loadLlmConfig(fakeApp(tempDir));
    expect(config).toEqual(DEFAULT_LLM_CONFIG);
  });

  it('saves and reloads validated config', async () => {
    await saveLlmConfig(fakeApp(tempDir), {
      executablePath: '/tmp/llama-server',
      modelName: 'test-model',
      modelDir: path.join(tempDir, 'models'),
      modelUrl: 'https://example.test/test-model.gguf',
      ngl: 6,
      ctxSize: 8192,
      temperature: 0.5,
      port: 8091,
      maxTokens: 2048,
    });

    const loaded = await loadLlmConfig(fakeApp(tempDir));
    expect(loaded.executablePath).toBe('/tmp/llama-server');
    expect(loaded.modelName).toBe('test-model');
    expect(loaded.modelDir).toBe(path.join(tempDir, 'models'));
    expect(loaded.modelUrl).toBe('https://example.test/test-model.gguf');
    expect(loaded.ngl).toBe(6);
    expect(loaded.ctxSize).toBe(8192);
    expect(loaded.temperature).toBe(0.5);
    expect(loaded.port).toBe(8091);
    expect(loaded.maxTokens).toBe(2048);
  });

  it('rejects invalid runtime values', () => {
    expect(() => validateLlmConfig({ ...DEFAULT_LLM_CONFIG, port: 0 })).toThrow('port');
    expect(() => validateLlmConfig({ ...DEFAULT_LLM_CONFIG, maxTokens: 0 })).toThrow('maxTokens');
    expect(() => validateLlmConfig({ ...DEFAULT_LLM_CONFIG, temperature: -1 })).toThrow('temperature');
    expect(() => validateLlmConfig({ ...DEFAULT_LLM_CONFIG, port: 99999 })).toThrow('port');
    expect(() => validateLlmConfig({ ...DEFAULT_LLM_CONFIG, host: ' ' })).toThrow('host');
    expect(() => validateLlmConfig({ ...DEFAULT_LLM_CONFIG, executablePath: ' ' })).toThrow('executablePath');
    expect(() => validateLlmConfig({ ...DEFAULT_LLM_CONFIG, modelName: '../escape' })).toThrow('modelName');
  });

  it('backs up invalid persisted config and falls back to defaults', async () => {
    const configPath = path.join(tempDir, 'llm-config.json');
    await fs.writeFile(configPath, JSON.stringify({ port: 70000 }), 'utf-8');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const loaded = await loadLlmConfig(fakeApp(tempDir));
    expect(loaded).toEqual(DEFAULT_LLM_CONFIG);

    const entries = await fs.readdir(tempDir);
    expect(entries.some((entry) => entry.startsWith('llm-config.json.invalid-') && entry.endsWith('.bak'))).toBe(true);
    expect(entries).not.toContain('llm-config.json');
    expect(warnSpy).toHaveBeenCalled();
  });
});
