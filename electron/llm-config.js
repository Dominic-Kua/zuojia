import fs from 'fs/promises';
import path from 'path';

export const DEFAULT_LLM_CONFIG = {
  provider: 'llama.cpp',
  modelFamily: 'Qwen/Qwen2.5-7B-Instruct',
  recommendedModelFile: 'Qwen2.5-7B-Instruct-Q4_K_M.gguf',
  modelSourceUrl:
    'https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf',
  modelSha256: '65b8fcd92af6b4fefa935c625d1ac27ea29dcb6ee14589c55a8f115ceaaa1423',
  executablePath: '',
  modelPath: '',
  threads: 4,
  contextSize: 4096,
  temperature: 0.7,
  host: '127.0.0.1',
  port: 8080,
  extraArgs: [],
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

  const threads = Math.trunc(asNumber(merged.threads, 'threads'));
  const contextSize = Math.trunc(asNumber(merged.contextSize, 'contextSize'));
  const temperature = asNumber(merged.temperature, 'temperature');
  const port = Math.trunc(asNumber(merged.port, 'port'));

  if (threads < 1 || threads > 256) {
    throw new Error('threads must be between 1 and 256');
  }

  if (contextSize < 256 || contextSize > 262144) {
    throw new Error('contextSize must be between 256 and 262144');
  }

  if (temperature < 0 || temperature > 2) {
    throw new Error('temperature must be between 0 and 2');
  }

  if (port < 1 || port > 65535) {
    throw new Error('port must be between 1 and 65535');
  }

  const host = String(merged.host || DEFAULT_LLM_CONFIG.host).trim();
  if (!host) {
    throw new Error('host must not be empty');
  }

  const extraArgs = Array.isArray(merged.extraArgs)
    ? merged.extraArgs.map((value) => String(value)).filter(Boolean)
    : [];

  const modelSourceUrl = String(merged.modelSourceUrl || DEFAULT_LLM_CONFIG.modelSourceUrl).trim();
  if (!/^https:\/\//.test(modelSourceUrl)) {
    throw new Error('modelSourceUrl must be an https URL');
  }

  const modelSha256 = String(merged.modelSha256 || DEFAULT_LLM_CONFIG.modelSha256).trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(modelSha256)) {
    throw new Error('modelSha256 must be a 64-character hex string');
  }

  return {
    ...merged,
    executablePath: String(merged.executablePath || '').trim(),
    modelPath: String(merged.modelPath || '').trim(),
    threads,
    contextSize,
    temperature,
    host,
    port,
    modelSourceUrl,
    modelSha256,
    extraArgs,
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
