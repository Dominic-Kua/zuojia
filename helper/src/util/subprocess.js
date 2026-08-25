import { spawn } from 'child_process';

const DEFAULT_TIMEOUT_MS = 120000;
const MAX_CAPTURED_OUTPUT_BYTES = 10 * 1024 * 1024;

export async function runSubprocess(command, args = [], options = {}) {
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return await new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    const appendCapped = (target, chunk) => {
      // Cap captured output so chatty subprocesses cannot exhaust memory
      if (target === 'stdout') {
        stdoutBytes += chunk.length;
        if (stdoutBytes <= MAX_CAPTURED_OUTPUT_BYTES) {
          stdout += chunk.toString();
        }
      } else {
        stderrBytes += chunk.length;
        if (stderrBytes <= MAX_CAPTURED_OUTPUT_BYTES) {
          stderr += chunk.toString();
        }
      }
    };

    child.stdout.on('data', (chunk) => appendCapped('stdout', chunk));

    child.stderr.on('data', (chunk) => appendCapped('stderr', chunk));

    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr: error.message,
        exitCode: 1,
        durationMs: Date.now() - startedAt,
      });
    });

    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      if (timedOut) {
        stderr += `\nSubprocess timed out after ${timeoutMs}ms and was killed (${signal || 'SIGTERM'})`;
      }
      resolve({
        stdout,
        stderr,
        exitCode: timedOut ? 1 : exitCode,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}
