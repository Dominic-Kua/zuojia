import { spawn } from 'child_process';
import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import http from 'http';
import https from 'https';

async function assertAccessible(accessFn, filePath, mode, label) {
  try {
    await accessFn(filePath, mode);
  } catch {
    throw new Error(`${label} is not accessible: ${filePath}`);
  }
}

async function checkOllamaHealth(config) {
  return new Promise((resolve) => {
    const options = {
      hostname: config.host,
      port: config.port,
      path: '/api/tags',
      method: 'GET',
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve({ status: 'running' });
      } else {
        resolve({ status: 'error', error: `API returned ${res.statusCode}` });
      }
      res.resume();
    });

    req.on('error', (error) => {
      resolve({ status: 'stopped', error: error.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 'stopped', error: 'Request timeout' });
    });

    req.end();
  });
}

async function checkModelExists(config) {
  return new Promise((resolve) => {
    const options = {
      hostname: config.host,
      port: config.port,
      path: '/api/tags',
      method: 'GET',
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const modelExists = parsed.models?.some(model => model.name === config.modelName);
          resolve({ exists: modelExists === true });
        } catch (error) {
          resolve({ exists: false, error: error.message });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ exists: false, error: error.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ exists: false, error: 'Request timeout' });
    });

    req.end();
  });
}

async function startOllamaProcess(config) {
  await assertAccessible(fs.access, config.executablePath, fsConstants.X_OK, 'ollama executable');
  
  const child = spawn(config.executablePath, ['serve'], {
    stdio: 'pipe',
    env: {
      ...process.env,
    },
  });

  child.on('error', (error) => {
    console.error('Ollama process error:', error);
  });

  child.on('exit', (code, signal) => {
    console.log(`Ollama process exited with code ${code} signal ${signal || 'none'}`);
  });

  // Wait a bit for ollama to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  return child;
}

async function pullModel(config) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ name: config.modelName });
    
    const options = {
      hostname: config.host,
      port: config.port,
      path: '/api/pull',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 60000, // 60 seconds timeout for model pull
    };

    const req = http.request(options, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        res.on('data', (chunk) => {
          console.log('Model pull progress:', chunk.toString());
        });
        res.on('end', () => {
          resolve(true);
        });
      } else {
        reject(new Error(`Failed to pull model: ${res.statusCode} ${res.statusMessage}`));
      }
    });

    req.on('error', (error) => {
      reject(new Error(`Failed to pull model: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Model pull request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

export function createLlmRuntimeManager({
  spawnFn = spawn,
  accessFn = fs.access,
  nowFn = () => Date.now(),
} = {}) {
  let processRef = null;
  let startTime = null;
  let lastError = null;

  function isRunningProcess(proc) {
    return Boolean(proc) && proc.exitCode === null;
  }

  async function start(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('runtime config is required');
    }

    // First check if ollama is already running
    const health = await checkOllamaHealth(config);
    if (health.status === 'running') {
      // Check if model exists
      const modelCheck = await checkModelExists(config);
      if (!modelCheck.exists) {
        console.log(`Model "${config.modelName}" not found, pulling...`);
        await pullModel(config);
      }
      
      return {
        status: 'running',
        host: config.host,
        port: config.port,
        modelName: config.modelName,
      };
    }

    // Start ollama process
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

    try {
      processRef = await startOllamaProcess(config);
      startTime = nowFn();
      lastError = null;

      // Wait a bit more for ollama to fully start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Pull the model
      await pullModel(config);

      return {
        status: 'running',
        pid: processRef.pid,
        host: config.host,
        port: config.port,
        modelName: config.modelName,
        startedAt: new Date(startTime).toISOString(),
      };
    } catch (error) {
      if (processRef) {
        processRef.kill();
        processRef = null;
        startTime = null;
      }
      throw error;
    }
  }

  async function stop() {
    if (!isRunningProcess(processRef)) {
      return {
        status: 'stopped',
        pid: null,
        stoppedAt: new Date().toISOString(),
      };
    }

    processRef.kill('SIGTERM');
    let exitResolve;
    const exitPromise = new Promise((resolve) => {
      exitResolve = resolve;
    });

    processRef.on('exit', exitResolve);

    const timeout = setTimeout(() => {
      processRef.kill('SIGKILL');
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

    return {
      status: 'stopped',
      pid: null,
      stoppedAt,
    };
  }

  async function restart(config) {
    if (isRunningProcess(processRef)) {
      await stop();
    }
    return start(config);
  }

  async function health() {
    // Check if we have a running process first
    if (isRunningProcess(processRef)) {
      return {
        status: 'running',
        pid: processRef.pid,
        uptimeMs: startTime ? Math.max(0, nowFn() - startTime) : 0,
        lastError,
      };
    }

    // Check if ollama is running via API
    const apiHealth = await checkOllamaHealth({
      host: '127.0.0.1',
      port: 11434,
    });
    
    if (apiHealth.status === 'running') {
      return {
        status: 'running',
        pid: null,
        uptimeMs: 0,
        lastError: null,
      };
    }
    
    return {
      status: 'stopped',
      pid: null,
      uptimeMs: 0,
      lastError: apiHealth.error,
    };
  }

  return {
    start,
    stop,
    restart,
    health,
  };
}