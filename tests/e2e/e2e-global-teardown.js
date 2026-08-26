import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Global teardown: sweep orphaned test novel directories from ~/.zuojia/.
 *
 * E2E tests create timestamped novels (e.g. e2e-git-integration-*, test-novel-*).
 * If a test crashes or times out, its afterAll/afterEach cleanup may not run.
 * This safety net deletes any directories matching the test naming conventions.
 */
export default async function globalTeardown() {
  const zuojiaDir = path.join(os.homedir(), '.zuojia');
  if (!fs.existsSync(zuojiaDir)) return;

  const TEST_PREFIXES = ['e2e-', 'test-'];
  let removed = 0;

  for (const entry of fs.readdirSync(zuojiaDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const isTestNovel = TEST_PREFIXES.some((p) => entry.name.startsWith(p));
    if (!isTestNovel) continue;

    const fullPath = path.join(zuojiaDir, entry.name);
    try {
      fs.rmSync(fullPath, { recursive: true, force: true });
      removed++;
    } catch {
      // Best-effort — don't fail the teardown if a directory is locked
    }
  }

  if (removed > 0) {
    console.log(`[e2e-teardown] Removed ${removed} orphaned test novel(s) from ${zuojiaDir}`);
  }
}
