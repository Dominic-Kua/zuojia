import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const BREW_CELLAR_NEO4J = '/opt/homebrew/Cellar/neo4j';

export async function findNeo4jHome() {
  try {
    const entries = await fs.readdir(BREW_CELLAR_NEO4J, { withFileTypes: true });
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
      const libexec = path.join(BREW_CELLAR_NEO4J, ver, 'libexec');
      try {
        await fs.access(libexec);
        return libexec;
      } catch {
        // libexec doesn't exist in this version dir, keep looking
      }
    }
  } catch {
    // Cellar dir doesn't exist
  }

  // Fallback: which neo4j
  try {
    const binPath = execSync('which neo4j', { encoding: 'utf-8' }).trim();
    const realPath = await fs.realpath(binPath);
    return path.dirname(realPath);
  } catch {
    return null;
  }
}
