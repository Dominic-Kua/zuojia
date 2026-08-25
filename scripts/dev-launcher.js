#!/usr/bin/env node

/**
 * Development launcher for 作家
 * 
 * This script:
 * 1. Starts the Vite dev server (frontend)
 * 2. Waits for Vite to be ready
 * 3. Starts Electron (with integrated Node.js helper)
 * 4. Handles clean shutdown of all processes when Electron closes
 */

import { spawn } from 'child_process';
import { createServer } from 'net';
import process from 'process';

const VITE_PORT = 5173;

let viteProcess = null;
let electronProcess = null;
let isShuttingDown = false;

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(prefix, message, color = colors.reset) {
  console.log(`${color}${colors.bright}[${prefix}]${colors.reset} ${message}`);
}

function checkPort(port) {
  return new Promise((resolve) => {
    const server = createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true); // Port is in use
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(false); // Port is free
    });
    
    server.listen(port, '127.0.0.1');
  });
}

function waitForPort(port, maxAttempts = 30, interval = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const check = async () => {
      attempts++;
      const isReady = await checkPort(port);
      
      if (isReady) {
        resolve();
      } else if (attempts >= maxAttempts) {
        reject(new Error(`Port ${port} not ready after ${maxAttempts} attempts`));
      } else {
        setTimeout(check, interval);
      }
    };
    
    check();
  });
}

async function startVite() {
  // Refuse to start if something else already owns the port — otherwise we'd
  // point Electron at an unknown server (waitForPort can't tell who answers).
  if (await checkPort(VITE_PORT)) {
    throw new Error(
      `Port ${VITE_PORT} is already in use. ` +
      'Stop the existing process (lsof -ti :5173 | xargs kill) and retry.'
    );
  }

  log('VITE', 'Starting Vite dev server...', colors.cyan);

  // Spawn the vite binary directly — going through `npm run` adds an
  // intermediate npm/sh layer that survives SIGTERM to this child, orphaning
  // vite and holding port 5173 after shutdown.
  viteProcess = spawn('node', ['node_modules/vite/bin/vite.js'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  
  viteProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      log('VITE', output, colors.cyan);
    }
  });
  
  viteProcess.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output && !output.includes('DeprecationWarning')) {
      log('VITE', output, colors.yellow);
    }
  });
  
  viteProcess.on('exit', (code) => {
    if (!isShuttingDown) {
      log('VITE', `Vite process exited with code ${code}`, colors.red);
      shutdown(code || 1);
    }
  });
  
  // Wait for Vite to be ready
  log('VITE', `Waiting for Vite to start on port ${VITE_PORT}...`, colors.cyan);
  await waitForPort(VITE_PORT);
  log('VITE', '✓ Vite is ready!', colors.green);
}

async function startElectron() {
  log('ELECTRON', 'Starting Electron...', colors.blue);
  
  electronProcess = spawn('electron', ['.'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });
  
  electronProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      log('ELECTRON', output, colors.blue);
    }
  });
  
  electronProcess.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output && !output.includes('DeprecationWarning')) {
      log('ELECTRON', output, colors.yellow);
    }
  });
  
  electronProcess.on('exit', (code) => {
    log('ELECTRON', `Electron exited with code ${code}`, colors.blue);
    shutdown(0); // Always exit cleanly when Electron closes
  });
  
  log('ELECTRON', '✓ Electron started!', colors.green);
}

function killProcess(proc, name) {
  if (!proc || proc.killed) {
    return Promise.resolve();
  }
  
  return new Promise((resolve) => {
    log(name, 'Sending SIGTERM...', colors.yellow);
    
    const timeout = setTimeout(() => {
      if (!proc.killed) {
        log(name, 'Force killing (SIGKILL)...', colors.red);
        proc.kill('SIGKILL');
      }
      resolve();
    }, 5000);
    
    proc.once('exit', () => {
      clearTimeout(timeout);
      log(name, 'Stopped', colors.green);
      resolve();
    });
    
    proc.kill('SIGTERM');
  });
}

async function shutdown(exitCode = 0) {
  if (isShuttingDown) {
    return;
  }
  
  isShuttingDown = true;
  log('LAUNCHER', 'Shutting down all processes...', colors.yellow);
  
  // Stop in reverse order: Electron, Vite
  await killProcess(electronProcess, 'ELECTRON');
  await killProcess(viteProcess, 'VITE');
  
  log('LAUNCHER', 'All processes stopped. Exiting.', colors.green);
  process.exit(exitCode);
}

// Handle process signals
process.on('SIGINT', () => {
  log('LAUNCHER', 'Received SIGINT (Ctrl+C)', colors.yellow);
  shutdown(0);
});

process.on('SIGTERM', () => {
  log('LAUNCHER', 'Received SIGTERM', colors.yellow);
  shutdown(0);
});

process.on('uncaughtException', (error) => {
  log('LAUNCHER', `Uncaught exception: ${error.message}`, colors.red);
  console.error(error);
  shutdown(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log('LAUNCHER', `Unhandled rejection: ${reason}`, colors.red);
  console.error(reason);
  shutdown(1);
});

// Main execution
async function main() {
  log('LAUNCHER', 'Starting zuojia development environment...', colors.green);
  
  try {
    await startVite();
    await startElectron();
    
    log('LAUNCHER', '✓ All services started successfully!', colors.green);
    log('LAUNCHER', 'Close the Electron window or press Ctrl+C to exit', colors.cyan);
  } catch (error) {
    log('LAUNCHER', `Failed to start: ${error.message}`, colors.red);
    console.error(error);
    shutdown(1);
  }
}

main();
