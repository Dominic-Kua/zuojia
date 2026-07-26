// @vitest-environment node

import { describe, it, expect } from 'vitest';
import {
  LLM_EXECUTABLE_PATH,
  LLM_MODEL_NAME,
  LLM_MODEL_URL,
  LLM_HOST,
  LLM_PORT,
  LLM_TEMPERATURE,
  LLM_MAX_TOKENS,
  LLM_NGL,
  LLM_CTX_SIZE,
  LLM_CONFIG_FILE,
  LLM_MAX_ALLOWED_TOKENS,
} from '../../../electron/llm-defaults.js';

describe('llm-defaults', () => {
  it('exports executable path', () => {
    expect(LLM_EXECUTABLE_PATH).toBe('/opt/homebrew/bin/llama-server');
  });

  it('exports model info', () => {
    expect(LLM_MODEL_NAME).toBe('gemma-4-E2B-it-Q3_K_S');
    expect(LLM_MODEL_URL).toContain('huggingface.co');
    expect(LLM_MODEL_URL).toContain('gemma-4-E2B-it-Q3_K_S.gguf');
  });

  it('exports server defaults', () => {
    expect(LLM_HOST).toBe('127.0.0.1');
    expect(LLM_PORT).toBe(8080);
  });

  it('exports inference defaults', () => {
    expect(LLM_TEMPERATURE).toBe(0.7);
    expect(LLM_MAX_TOKENS).toBe(4096);
    expect(LLM_NGL).toBe(99);
    expect(LLM_CTX_SIZE).toBe(0);
  });

  it('exports config and validation constants', () => {
    expect(LLM_CONFIG_FILE).toBe('llm-config.json');
    expect(LLM_MAX_ALLOWED_TOKENS).toBe(1_000_000);
  });
});
