import { spawn } from 'child_process';
import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import http from 'http';
import path from 'path';

async function assertAccessible(accessFn, filePath, mode, label) {
  try {
    await accessFn(filePath, mode);
  } catch {
    throw new Error(`${label} is not accessible: ${filePath}`);
  }
}

function getModelPath(config) {
  const dir = config.modelDir || path.join(
    process.env.HOME || '~',
    '.zuojia', 'models'
  );
  return path.join(dir, `${config.modelName}.gguf`);
}

async function ensureModel(config, { log }) {
  const modelPath = getModelPath(config);

  try {
    await fs.access(modelPath, fsConstants.R_OK);
    const stat = await fs.stat(modelPath);
    if (stat.size < 100_000_000) {
      log(`Model file too small (${(stat.size / 1048576).toFixed(1)}MB) — re-downloading`);
      await fs.unlink(modelPath);
    } else {
      log(`Model already exists: ${modelPath} (${(stat.size / 1073741824).toFixed(2)} GB)`);
      return modelPath;
    }
  } catch {
    // Model not found — download it
  }

  const modelDir = path.dirname(modelPath);
  await fs.mkdir(modelDir, { recursive: true });

  log(`Downloading model from ${config.modelUrl}...`);

  // Download via curl spawned with an argument array (never through a shell,
  // so config values can't inject commands)
  try {
    await new Promise((resolve, reject) => {
      const child = spawn('curl', ['-fL', '-o', modelPath, String(config.modelUrl)], {
        stdio: 'ignore',
      });
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('Model download timed out after 600 seconds'));
      }, 600000);
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on('exit', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`curl exited with code ${code}`));
      });
    });
  } catch (err) {
    throw new Error(`Model download failed: ${err.message}`);
  }

  // Verify download
  try {
    await fs.access(modelPath, fsConstants.R_OK);
    const stat = await fs.stat(modelPath);
    if (stat.size < 1000000) {
      throw new Error(`Downloaded file too small (${stat.size} bytes) — likely incomplete`);
    }
    log(`Model downloaded: ${modelPath} (${(stat.size / 1073741824).toFixed(2)} GB)`);
    return modelPath;
  } catch (err) {
    throw new Error(`Model download failed: ${err.message}`);
  }
}

async function checkHealth(host, port) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: host,
      port,
      path: '/health',
      method: 'GET',
      timeout: 3000,
    }, (res) => {
      resolve({ status: res.statusCode >= 200 && res.statusCode < 400 ? 'running' : 'error' });
      res.resume();
    });

    req.on('error', () => resolve({ status: 'stopped' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'stopped' }); });
    req.end();
  });
}

export function createLlmRuntimeManager({
  spawnFn = spawn,
  accessFn = fs.access,
  nowFn = () => Date.now(),
  setTimeoutFn = setTimeout,
} = {}) {
  let processRef = null;
  let startTime = null;
  let lastError = null;
  let runtimeModelPath = null;

  const logs = [];
  const maxLogs = 100;

  function pushLog(entry) {
    logs.push(entry);
    if (logs.length > maxLogs) logs.shift();
    if (entry.level === 'error') {
      console.error(`[LLM] ${entry.message}`);
    } else {
      console.log(`[LLM] ${entry.message}`);
    }
  }

  function isRunningProcess(proc) {
    return Boolean(proc) && proc.exitCode === null;
  }

  async function start(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('runtime config is required');
    }

    // Check if already running on this port
    const existingHealth = await checkHealth(config.host, config.port);
    if (existingHealth.status === 'running') {
      pushLog({ timestamp: new Date().toISOString(), message: `llama-server already running on port ${config.port}` });
      return {
        status: 'running',
        host: config.host,
        port: config.port,
        modelName: config.modelName,
      };
    }

    if (isRunningProcess(processRef)) {
      return {
        status: 'running',
        pid: processRef.pid,
        host: config.host,
        port: config.port,
        modelName: config.modelName,
        startedAt: new Date(startTime).toISOString(),
      };
    }

    // Ensure model is downloaded
    runtimeModelPath = await ensureModel(config, { log: (msg) => pushLog({ timestamp: new Date().toISOString(), message: msg }) });

    // Build llama-server args
    const args = [
      '-m', runtimeModelPath,
      '--host', config.host || '127.0.0.1',
      '--port', String(config.port || 8080),
      '-ngl', String(config.ngl ?? 99),
    ];

    if (config.ctxSize && config.ctxSize > 0) {
      args.push('-c', String(config.ctxSize));
    }

    pushLog({ timestamp: new Date().toISOString(), message: `Spawning llama-server: ${config.executablePath} ${args.join(' ')}` });

    try {
      await assertAccessible(accessFn, config.executablePath, fsConstants.X_OK, 'llama-server executable');
    } catch (err) {
      pushLog({ timestamp: new Date().toISOString(), type: 'llm_error', message: err.message, level: 'error' });
      throw err;
    }

    const child = spawnFn(config.executablePath, args, {
      stdio: 'pipe',
      env: { ...process.env },
    });

    child.stdout.on('data', (data) => {
      const output = data.toString();
      pushLog({ timestamp: new Date().toISOString(), type: 'llm_stdout', message: output.trim() });
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      pushLog({ timestamp: new Date().toISOString(), type: 'llm_stderr', message: output.trim() });
    });

    child.on('error', (error) => {
      lastError = error.message;
      pushLog({ timestamp: new Date().toISOString(), type: 'llm_process_error', message: error.message, level: 'error' });
    });

    child.on('exit', (code, signal) => {
      if (processRef !== child) return;
      pushLog({ timestamp: new Date().toISOString(), type: 'llm_exit', message: `Exited code=${code} signal=${signal || 'none'}` });
      processRef = null;
      startTime = null;
      lastError = code !== 0 ? `Exited with code ${code}` : null;
    });

    processRef = child;
    startTime = nowFn();
    lastError = null;

    // Poll /health until ready (max 60 seconds)
    const host = config.host || '127.0.0.1';
    const port = config.port || 8080;
    const deadline = nowFn() + 60000;

    while (nowFn() < deadline) {
      if (!isRunningProcess(processRef)) {
        throw new Error('llama-server process terminated during startup');
      }

      const health = await checkHealth(host, port);
      if (health.status === 'running') {
        pushLog({ timestamp: new Date().toISOString(), message: `llama-server ready on ${host}:${port}` });
        return {
          status: 'running',
          pid: processRef.pid,
          host,
          port,
          modelName: config.modelName,
          startedAt: new Date(startTime).toISOString(),
        };
      }

      await new Promise((r) => setTimeoutFn(r, 1000));
    }

    // Timed out
    const err = new Error('llama-server failed to become ready within 60 seconds');
    lastError = err.message;
    pushLog({ timestamp: new Date().toISOString(), type: 'llm_error', message: err.message, level: 'error' });
    if (isRunningProcess(processRef)) {
      processRef.kill('SIGKILL');
    }
    processRef = null;
    startTime = null;
    throw err;
  }

  async function stop() {
    if (!isRunningProcess(processRef)) {
      return { status: 'stopped', pid: null, stoppedAt: new Date().toISOString() };
    }

    processRef.kill('SIGTERM');
    const exitPromise = new Promise((resolve) => {
      processRef.on('exit', resolve);
    });

    const timeout = setTimeoutFn(() => {
      if (isRunningProcess(processRef)) {
        processRef.kill('SIGKILL');
      }
    }, 5000);

    try {
      await exitPromise;
    } finally {
      clearTimeout(timeout);
    }

    const stoppedAt = new Date().toISOString();
    processRef = null;
    startTime = null;
    lastError = null;
    runtimeModelPath = null;

    return { status: 'stopped', pid: null, stoppedAt };
  }

  async function restart(config) {
    if (isRunningProcess(processRef)) {
      await stop();
    }
    return start(config);
  }

  async function health() {
    if (isRunningProcess(processRef)) {
      return {
        status: 'running',
        pid: processRef.pid,
        uptimeMs: startTime ? Math.max(0, nowFn() - startTime) : 0,
        lastError,
      };
    }

    // Check if llama-server is running externally on default port
    const apiHealth = await checkHealth('127.0.0.1', 8080);
    if (apiHealth.status === 'running') {
      return { status: 'running', pid: null, uptimeMs: 0, lastError: null };
    }

    return { status: 'stopped', pid: null, uptimeMs: 0, lastError };
  }

  function getLogs({ limit = 50 } = {}) {
    return logs.slice(-limit);
  }

  return { start, stop, restart, health, getLogs };
}
