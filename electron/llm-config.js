import fs from 'fs/promises';
import path from 'path';

export const DEFAULT_LLM_CONFIG = {
  provider: 'ollama',
  executablePath: '/opt/homebrew/bin/ollama',
  modelName: 'gemma4:e2b',
  host: '127.0.0.1',
  port: 11434,
  temperature: 0.7,
  maxTokens: 4096,
};

const CONFIG_FILE = 'llm-config.json';

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

  if (maxTokens !== undefined && (maxTokens < 1 || maxTokens > 1000000)) {
    throw new Error('maxTokens must be between 1 and 1000000');
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

  return {
    ...merged,
    executablePath,
    modelName,
    host,
    port,
    temperature,
    maxTokens,
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
