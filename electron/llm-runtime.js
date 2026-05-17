import { spawn } from 'child_process';
import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';

async function assertAccessible(accessFn, filePath, mode, label) {
  try {
    await accessFn(filePath, mode);
  } catch {
    throw new Error(`${label} is not accessible: ${filePath}`);
  }
}

function buildArgs(config) {
  const args = [
    '--model',
    config.modelPath,
    '--threads',
    String(config.threads),
    '--ctx-size',
    String(config.contextSize),
    '--temp',
    String(config.temperature),
    '--host',
    config.host,
    '--port',
    String(config.port),
  ];

  if (Array.isArray(config.extraArgs) && config.extraArgs.length > 0) {
    args.push(...config.extraArgs);
  }

  return args;
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

    if (isRunningProcess(processRef)) {
      return {
        status: 'running',
        pid: processRef.pid,
        startedAt: new Date(startTime).toISOString(),
      };
    }

    await assertAccessible(accessFn, config.executablePath, fsConstants.X_OK, 'llama.cpp executable');
    await assertAccessible(accessFn, config.modelPath, fsConstants.R_OK, 'model file');

    const args = buildArgs(config);
    const child = spawnFn(config.executablePath, args, {
      stdio: 'pipe',
      env: {
        ...process.env,
      },
    });

    child.on('error', (error) => {
      lastError = error.message;
    });

    child.on('exit', (code, signal) => {
      if (processRef !== child) {
        return;
      }
      if (code !== 0) {
        lastError = `llama.cpp exited with code ${code} signal ${signal || 'none'}`;
      }
      processRef = null;
      startTime = null;
    });

    processRef = child;
    startTime = nowFn();
    lastError = null;

    return {
      status: 'running',
      pid: child.pid,
      args,
      startedAt: new Date(startTime).toISOString(),
    };
  }

  async function stop() {
    if (!isRunningProcess(processRef)) {
      return {
        status: 'stopped',
        alreadyStopped: true,
      };
    }

    const child = processRef;
    let resolveExit;
    const waitForExit = new Promise((resolve) => {
      resolveExit = resolve;
      child.once('exit', () => resolve());
    });

    try {
      child.kill('SIGTERM');
    } catch {
      // Ignore kill errors; we'll still wait for exit.
    }

    const timeout = setTimeout(() => {
      if (child.exitCode === null) {
        try {
          child.kill('SIGKILL');
        } catch {
          // Ignore kill errors.
        }
        setTimeout(() => resolveExit(), 2000);
      }
    }, 5000);

    await waitForExit;
    clearTimeout(timeout);

    if (processRef === child) {
      processRef = null;
      startTime = null;
    }

    return {
      status: 'stopped',
      alreadyStopped: false,
    };
  }

  async function restart(config) {
    await stop();
    return start(config);
  }

  function health() {
    if (!isRunningProcess(processRef)) {
      return {
        status: 'stopped',
        pid: null,
        uptimeMs: 0,
        lastError,
      };
    }

    return {
      status: 'running',
      pid: processRef.pid,
      uptimeMs: startTime ? Math.max(0, nowFn() - startTime) : 0,
      lastError,
    };
  }

  return {
    start,
    stop,
    restart,
    health,
  };
}
