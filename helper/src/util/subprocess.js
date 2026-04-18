import { spawn } from 'child_process';

export async function runSubprocess(command, args = [], options = {}) {
  const startedAt = Date.now();

  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      resolve({
        stdout,
        stderr: error.message,
        exitCode: 1,
        durationMs: Date.now() - startedAt,
      });
    });

    child.on('close', (exitCode) => {
      resolve({
        stdout,
        stderr,
        exitCode,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}