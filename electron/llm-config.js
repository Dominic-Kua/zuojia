import fs from 'fs/promises';
import path from 'path';
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
} from './llm-defaults.js';

export const DEFAULT_LLM_CONFIG = {
  provider: 'llamacpp',
  executablePath: LLM_EXECUTABLE_PATH,
  modelName: LLM_MODEL_NAME,
  modelUrl: LLM_MODEL_URL,
  modelDir: '',  // resolved at runtime to {userData}/models/
  host: LLM_HOST,
  port: LLM_PORT,
  temperature: LLM_TEMPERATURE,
  maxTokens: LLM_MAX_TOKENS,
  ngl: LLM_NGL,
  ctxSize: LLM_CTX_SIZE,
};

const CONFIG_FILE = LLM_CONFIG_FILE;

function asNumber(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`${field} must be a number`);
  }
  return n;
}

export function validateLlmConfig(input = {}) {
  const merged = {
    ...DEFAULT_LLM_CONFIG,
    ...input,
  };

  const port = Math.trunc(asNumber(merged.port, 'port'));
  const temperature = asNumber(merged.temperature, 'temperature');
  const maxTokens = merged.maxTokens !== undefined ? Math.trunc(asNumber(merged.maxTokens, 'maxTokens')) : undefined;

  if (port < 1 || port > 65535) {
    throw new Error('port must be between 1 and 65535');
  }

  if (temperature < 0 || temperature > 2) {
    throw new Error('temperature must be between 0 and 2');
  }

  if (maxTokens !== undefined && (maxTokens < 1 || maxTokens > LLM_MAX_ALLOWED_TOKENS)) {
    throw new Error(`maxTokens must be between 1 and ${LLM_MAX_ALLOWED_TOKENS}`);
  }

  const host = String(merged.host || DEFAULT_LLM_CONFIG.host).trim();
  if (!host) {
    throw new Error('host must not be empty');
  }

  const executablePath = String(merged.executablePath || DEFAULT_LLM_CONFIG.executablePath).trim();
  if (!executablePath) {
    throw new Error('executablePath must not be empty');
  }

  const modelName = String(merged.modelName || DEFAULT_LLM_CONFIG.modelName).trim();
  if (!modelName) {
    throw new Error('modelName must not be empty');
  }

  const modelUrl = String(merged.modelUrl || DEFAULT_LLM_CONFIG.modelUrl).trim();
  const modelDir = String(merged.modelDir || DEFAULT_LLM_CONFIG.modelDir).trim();
  const ngl = Math.trunc(asNumber(merged.ngl ?? DEFAULT_LLM_CONFIG.ngl, 'ngl'));
  const ctxSize = Math.trunc(asNumber(merged.ctxSize ?? DEFAULT_LLM_CONFIG.ctxSize, 'ctxSize'));

  return {
    ...merged,
    executablePath,
    modelName,
    modelUrl,
    modelDir,
    host,
    port,
    temperature,
    maxTokens,
    ngl,
    ctxSize,
  };
}

function configPathForApp(appLike) {
  return path.join(appLike.getPath('userData'), CONFIG_FILE);
}

export async function loadLlmConfig(appLike) {
  const configPath = configPathForApp(appLike);

  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return validateLlmConfig(parsed);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { ...DEFAULT_LLM_CONFIG };
    }

    console.warn(`Failed to load persisted LLM config from ${configPath}: ${error.message}`);
    const backupPath = `${configPath}.invalid-${Date.now()}.bak`;

    try {
      await fs.rename(configPath, backupPath);
      console.warn(`Moved invalid LLM config to backup: ${backupPath}`);
    } catch (backupError) {
      console.warn(`Failed to back up invalid LLM config: ${backupError.message}`);
    }

    return { ...DEFAULT_LLM_CONFIG };
  }
}

export async function saveLlmConfig(appLike, config) {
  const validated = validateLlmConfig(config);
  const configPath = configPathForApp(appLike);

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(validated, null, 2)}\n`, 'utf-8');

  return validated;
}
