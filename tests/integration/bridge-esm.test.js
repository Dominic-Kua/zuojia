/**
 * Integration test for Project Synapse Bridge
 * Verifies the ESM bridge actually spawns and can communicate over JSON-RPC.
 * This catches regressions like the CJS→ESM migration bug.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const BRIDGE_PATH = path.resolve(__dirname, '../../helper/src/mcp/project-synapse-bridge.js');
const SYNAPSE_DIR = path.join(process.env.HOME, 'code', 'project-synapse-mcp');
const HAS_SYNAPSE = fs.existsSync(path.join(SYNAPSE_DIR, 'pyproject.toml'));
const TMP_NOVEL = '/tmp/zuojia-bridge-test';

function spawnBridge(opts = {}) {
  const novelPath = opts.novelPath || TMP_NOVEL;
  const env = {
    ...process.env,
    ZUOJIA_NOVEL_PATH: novelPath,
    NEO4J_URI: 'bolt://localhost:7687',
    NEO4J_USER: 'neo4j',
    NEO4J_PASSWORD: 'neo4j',
    NEO4J_DATABASE: 'wiki',
    PATH: ['/opt/homebrew/bin', '/usr/local/bin', `${process.env.HOME}/.local/bin`, process.env.PATH || ''].join(':'),
  };
  if (opts.synapsePath) env.SYNAPSE_PATH = opts.synapsePath;

  return new Promise((resolve, reject) => {
    const child = spawn('node', [BRIDGE_PATH], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });

    let stdout = '';
    let stderr = '';
    let resolved = false;

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      // Check for JSON-RPC response
      const lines = stdout.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.jsonrpc === '2.0' && !resolved) {
            resolved = true;
            resolve({ child, stdout, stderr, response: parsed });
            return;
          }
        } catch {}
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        resolve({ child, stdout, stderr, error: err });
      }
    });

    child.on('exit', (code, signal) => {
      if (!resolved) {
        resolved = true;
        resolve({ child, stdout, stderr, exitCode: code, signal });
      }
    });

    // Timeout safety
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        child.kill('SIGTERM');
        resolve({ child, stdout, stderr, timeout: true });
      }
    }, opts.timeoutMs || 8000);
  });
}

describe('Project Synapse Bridge (ESM integration)', () => {
  beforeAll(() => {
    fs.mkdirSync(path.join(TMP_NOVEL, '.zuojia'), { recursive: true });
    fs.mkdirSync(path.join(TMP_NOVEL, 'wiki'), { recursive: true });
  });

  afterAll(() => {
    try { fs.rmSync(TMP_NOVEL, { recursive: true, force: true }); } catch {}
  });

  it('rejects when ZUOJIA_NOVEL_PATH is missing', async () => {
    const result = await new Promise((resolve) => {
      const child = spawn('node', [BRIDGE_PATH], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      });
      let stdout = '';
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.on('exit', (code) => { resolve({ stdout, exitCode: code }); });
      setTimeout(() => { child.kill('SIGTERM'); resolve({ stdout, exitCode: null }); }, 5000);
    });

    // Bridge should output a JSON-RPC error and exit non-zero
    expect(result.exitCode).not.toBe(0);
    const lines = result.stdout.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    const parsed = JSON.parse(lastLine);
    expect(parsed.error.message).toContain('Missing ZUOJIA_NOVEL_PATH');
  });

  it('rejects when Synapse is not found', async () => {
    const result = await spawnBridge({
      novelPath: TMP_NOVEL,
      synapsePath: '/nonexistent/path',
    });

    expect(result.exitCode).not.toBe(0);
    const lines = result.stdout.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    const parsed = JSON.parse(lastLine);
    expect(parsed.error.message).toContain('Project Synapse not found');
  });

  it('spawns without crashing (ESM syntax valid)', async () => {
    // Force "Synapse not found" error by pointing to nonexistent path.
    // The critical check: no SyntaxError or ERR_REQUIRE_ESM in stderr.
    const result = await spawnBridge({
      novelPath: TMP_NOVEL,
      synapsePath: '/nonexistent/synapse',
      timeoutMs: 5000,
    });

    expect(result.stderr).not.toContain('SyntaxError');
    expect(result.stderr).not.toContain('ERR_REQUIRE_ESM');
    expect(result.stderr).not.toContain('Cannot use import statement');
  });

  it.skipIf(!HAS_SYNAPSE)('connects to Synapse and responds to JSON-RPC initialize', async () => {
    // Send an initialize request through stdin
    const novelPath = TMP_NOVEL;
    const env = {
      ...process.env,
      ZUOJIA_NOVEL_PATH: novelPath,
      NEO4J_URI: 'bolt://localhost:7687',
      NEO4J_USER: 'neo4j',
      NEO4J_PASSWORD: 'neo4j',
      NEO4J_DATABASE: 'wiki',
      PATH: ['/opt/homebrew/bin', '/usr/local/bin', `${process.env.HOME}/.local/bin`, process.env.PATH || ''].join(':'),
    };

    const result = await new Promise((resolve) => {
      const child = spawn('node', [BRIDGE_PATH], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000,
      });

      let stdout = '';
      let resolved = false;

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
        const lines = stdout.split('\n');
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line.trim());
            if (parsed.jsonrpc === '2.0' && !resolved) {
              resolved = true;
              child.kill('SIGTERM');
              resolve({ response: parsed, stdout });
              return;
            }
          } catch {}
        }
      });

      child.on('exit', () => {
        if (!resolved) resolve({ response: null, stdout, exitCode: true });
      });

      // Wait for bridge to start, then send initialize
      setTimeout(() => {
        if (!resolved) {
          const initRequest = JSON.stringify({
            jsonrpc: '2.0',
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              clientInfo: { name: 'zuojia-test', version: '1.0.0' },
            },
            id: 1,
          });
          child.stdin.write(initRequest + '\n');
        }
      }, 3000);

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill('SIGTERM');
          resolve({ response: null, stdout, timeout: true });
        }
      }, 25000);
    });

    expect(result.response).not.toBeNull();
    expect(result.response.result).toBeDefined();
    expect(result.response.result.serverInfo).toBeDefined();
  }, 30000);

  it.skipIf(!HAS_SYNAPSE)('survives SIGTERM gracefully', async () => {
    const novelPath = TMP_NOVEL;
    const env = {
      ...process.env,
      ZUOJIA_NOVEL_PATH: novelPath,
      NEO4J_URI: 'bolt://localhost:7687',
      NEO4J_USER: 'neo4j',
      NEO4J_PASSWORD: 'neo4j',
      NEO4J_DATABASE: 'wiki',
      PATH: ['/opt/homebrew/bin', '/usr/local/bin', `${process.env.HOME}/.local/bin`, process.env.PATH || ''].join(':'),
    };

    const result = await new Promise((resolve) => {
      const child = spawn('node', [BRIDGE_PATH], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 15000,
      });

      child.on('exit', (code, signal) => {
        resolve({ exitCode: code, signal });
      });

      // Let it start, then kill it
      setTimeout(() => {
        child.kill('SIGTERM');
      }, 2000);

      setTimeout(() => resolve({ timeout: true }), 12000);
    });

    // Should exit cleanly (0 or null signal), not hang
    expect(result.timeout).toBeFalsy();
  }, 15000);
});
