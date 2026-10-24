import fs from 'fs/promises';
import path from 'path';
import { execFileSync, execSync } from 'child_process';
import { homedir } from 'os';

const BREW_CELLAR_NEO4J = '/opt/homebrew/Cellar/neo4j';
const APP_RESOURCES_NEO4J = '/Applications/Neo4j.app/Contents/Resources';
const USER_SUPPORT_NEO4J = path.join(homedir(), 'Library', 'Application Support', 'Neo4j');
const SPOTLIGHT_NEO4J_QUERY = 'kMDItemFSName == "neo4j" && kMDItemContentType == "public.unix-executable"';

async function isNeo4jHome(candidate) {
  try {
    await fs.access(path.join(candidate, 'bin', 'neo4j'));
    return true;
  } catch {
    return false;
  }
}

async function findNeo4jHomeAt(candidate, depth = 0) {
  if (await isNeo4jHome(candidate)) {
    return candidate;
  }
  if (depth === 0) {
    return null;
  }

  let entries;
  try {
    entries = await fs.readdir(candidate, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const home = await findNeo4jHomeAt(path.join(candidate, entry.name), depth - 1);
    if (home) {
      return home;
    }
  }

  return null;
}

async function findNeo4jWithSpotlight() {
  let matches;
  try {
    matches = execFileSync('mdfind', [SPOTLIGHT_NEO4J_QUERY], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
  if (typeof matches !== 'string') {
    return null;
  }

  for (const match of matches.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
    if (path.basename(match).toLowerCase() !== 'neo4j') {
      continue;
    }

    try {
      const realPath = await fs.realpath(match);
      const binDirectory = path.dirname(realPath);
      if (path.basename(binDirectory).toLowerCase() !== 'bin') {
        continue;
      }
      const home = path.dirname(binDirectory);
      if (await isNeo4jHome(home)) {
        return home;
      }
    } catch {
      // Ignore Spotlight results that have disappeared or cannot be resolved.
    }
  }

  return null;
}

export async function findNeo4jHome() {
  let entries;
  try {
    entries = await fs.readdir(BREW_CELLAR_NEO4J, { withFileTypes: true });
  } catch {
    entries = [];
  }

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
    if (await isNeo4jHome(libexec)) {
      return libexec;
    }
  }

  const appHome = await findNeo4jHomeAt(APP_RESOURCES_NEO4J);
  if (appHome) {
    return appHome;
  }

  const userHome = await findNeo4jHomeAt(USER_SUPPORT_NEO4J, 2);
  if (userHome) {
    return userHome;
  }

  try {
    const binPath = execSync('which neo4j', { encoding: 'utf-8' }).trim();
    const realPath = await fs.realpath(binPath);
    return path.dirname(realPath);
  } catch {
    return findNeo4jWithSpotlight();
  }
}
