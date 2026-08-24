import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const BREW_CELLAR_JAVA = '/opt/homebrew/Cellar/openjdk@21';

export async function findJavaHome() {
  // Respect env var first
  if (process.env.JAVA_HOME) {
    return process.env.JAVA_HOME;
  }

  try {
    const entries = await fs.readdir(BREW_CELLAR_JAVA, { withFileTypes: true });
    const versions = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => /^\d+\.\d+\.\d+/.test(name))
      .sort((a, b) => {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        return pb[0] - pa[0] || pb[1] - pa[1] || pb[2] - pa[2];
      });

    for (const ver of versions) {
      const home = path.join(BREW_CELLAR_JAVA, ver, 'libexec/openjdk.jdk/Contents/Home');
      try {
        await fs.access(home);
        return home;
      } catch {
        // path doesn't exist in this version dir, keep looking
      }
    }
  } catch {
    // Cellar dir doesn't exist
  }

  // Fallback: which java
  try {
    const binPath = execSync('which java', { encoding: 'utf-8' }).trim();
    const realBin = await fs.realpath(binPath);
    // java binary is typically in bin/ under JAVA_HOME
    return path.dirname(path.dirname(realBin));
  } catch {
    return null;
  }
}
