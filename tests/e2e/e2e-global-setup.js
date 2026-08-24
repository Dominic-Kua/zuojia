import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// NOTE: deliberately NOT using import.meta.url here — Playwright transpiles
// globalSetup files, which repoints module URLs at its transform cache.
// Playwright always runs with cwd set to the directory containing
// playwright.config.js (the repo root).
const ROOT = process.cwd();

/**
 * Ensures the renderer build (dist/) is fresh before e2e tests run.
 * The Electron launcher loads dist/index.html in production mode, so a stale
 * build would silently test old code instead of current source.
 */
export default async function globalSetup() {
  const distEntry = path.join(ROOT, 'dist', 'index.html');
  const srcDirs = [
    path.join(ROOT, 'src'),
    path.join(ROOT, 'public'),
    path.join(ROOT, 'index.html'),
    path.join(ROOT, 'vite.config.ts'),
    path.join(ROOT, 'package.json'),
  ];

  const distMtime = fs.existsSync(distEntry)
    ? fs.statSync(distEntry).mtimeMs
    : -Infinity;
  const newestSrcMtime = Math.max(
    ...srcDirs.map((p) => {
      if (!fs.existsSync(p)) return -Infinity;
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        let newest = stat.mtimeMs;
        const stack = [p];
        while (stack.length > 0) {
          const dir = stack.pop();
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              stack.push(full);
            } else {
              const s = fs.statSync(full);
              if (s.mtimeMs > newest) newest = s.mtimeMs;
            }
          }
        }
        return newest;
      }
      return stat.mtimeMs;
    })
  );

  if (!fs.existsSync(distEntry) || newestSrcMtime > distMtime) {
    console.log('[e2e-setup] Renderer build is stale or missing — rebuilding dist/...');
    execSync('npx vite build', {
      cwd: ROOT,
      stdio: 'inherit',
    });
    console.log('[e2e-setup] Build complete.');
  } else {
    console.log('[e2e-setup] dist/ is up to date.');
  }
}
