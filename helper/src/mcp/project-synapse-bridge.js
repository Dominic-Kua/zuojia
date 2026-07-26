#!/usr/bin/env node
/**
 * Project Synapse MCP Bridge for Zuojia
 * Bridges Zuojia's Node.js MCP interface to the Project Synapse MCP server.
 * Spawns `uv run` to start Synapse, proxies JSON-RPC over stdio.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

let logFile = null;

function log(level, msg) {
  const line = `${new Date().toISOString()} [SynapseBridge] [${level}] ${msg}\n`;
  process.stderr.write(line);
  if (logFile) {
    try {
      fs.appendFileSync(logFile, line);
    } catch {}
  }
}

function isJsonRpc(line) {
  try {
    const parsed = JSON.parse(line);
    return (
      parsed &&
      parsed.jsonrpc === '2.0' &&
      ('id' in parsed || 'method' in parsed || 'error' in parsed)
    );
  } catch {
    return false;
  }
}

function main() {
  const novelPath = process.env.ZUOJIA_NOVEL_PATH;
  if (!novelPath) {
    const err = { jsonrpc: '2.0', error: { code: -32600, message: 'Missing ZUOJIA_NOVEL_PATH' }, id: null };
    process.stdout.write(JSON.stringify(err) + '\n');
    process.exit(1);
  }

  try {
    const zuojiaDir = path.join(novelPath, '.zuojia');
    fs.mkdirSync(zuojiaDir, { recursive: true });
    logFile = path.join(zuojiaDir, 'bridge.log');
    fs.writeFileSync(logFile, '');
  } catch {}

  const synapsePath = process.env.SYNAPSE_PATH || path.join(process.env.HOME, 'code', 'project-synapse-mcp');
  if (!fs.existsSync(path.join(synapsePath, 'pyproject.toml'))) {
    const err = { jsonrpc: '2.0', error: { code: -32603, message: 'Project Synapse not found at ' + synapsePath }, id: null };
    process.stdout.write(JSON.stringify(err) + '\n');
    process.exit(1);
  }

  const env = { ...process.env };
  env.NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
  env.NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
  env.NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'neo4j';
  env.NEO4J_DATABASE = process.env.NEO4J_DATABASE || 'wiki';
  env.WIKI_VAULT_PATH = path.join(novelPath, 'wiki');
  const homeDir = (typeof process.env.HOME === 'string' && process.env.HOME) || '';
  const extraPaths = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    homeDir ? `${homeDir}/.local/bin` : '',
    homeDir ? `${homeDir}/.cargo/bin` : '',
  ].filter(Boolean);
  env.PATH = [...extraPaths, process.env.PATH || ''].join(':');

  log('INFO', `Starting Synapse from ${synapsePath}, novel=${novelPath}, db=${env.NEO4J_DATABASE}`);

  const child = spawn('uv', ['run', '--directory', synapsePath, 'python', '-m', 'synapse_mcp.server'], {
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  child.on('error', (err) => {
    log('ERROR', `Failed to start Synapse: ${err.message}`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    log('INFO', `Synapse exited code=${code} signal=${signal}`);
    process.exit(code ?? 1);
  });

  // Proxy parent stdin → child stdin
  process.stdin.on('data', (chunk) => {
    if (child.stdin.destroyed) return;
    child.stdin.write(chunk);
  });
  process.stdin.on('end', () => {
    if (!child.stdin.destroyed) child.stdin.end();
  });

  // Proxy child stdout → parent stdout (JSON-RPC only)
  let stdoutBuf = '';
  child.stdout.on('data', (chunk) => {
    stdoutBuf += chunk.toString();
    const lines = stdoutBuf.split('\n');
    stdoutBuf = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && isJsonRpc(trimmed)) {
        process.stdout.write(line + '\n');
      } else if (trimmed) {
        log('DEBUG', `Synapse stdout (filtered): ${trimmed}`);
      }
    }
  });
  child.stdout.on('end', () => {
    if (stdoutBuf.trim()) {
      if (isJsonRpc(stdoutBuf.trim())) {
        process.stdout.write(stdoutBuf + '\n');
      } else {
        log('DEBUG', `Synapse stdout (filtered): ${stdoutBuf.trim()}`);
      }
    }
  });

  // Proxy child stderr → stderr for logging
  let stderrBuf = '';
  child.stderr.on('data', (chunk) => {
    stderrBuf += chunk.toString();
    const lines = stderrBuf.split('\n');
    stderrBuf = lines.pop();
    for (const line of lines) {
      if (line.trim()) log('DEBUG', `Synapse stderr: ${line.trim()}`);
    }
  });
  child.stderr.on('end', () => {
    if (stderrBuf.trim()) log('DEBUG', `Synapse stderr: ${stderrBuf.trim()}`);
  });

  // Graceful shutdown
  let shuttingDown = false;
  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    log('INFO', `Received ${signal}, shutting down...`);
    if (!child.stdin.destroyed) child.stdin.end();
    try { child.kill('SIGTERM'); } catch {}
    setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
      process.exit(0);
    }, 5000);
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
