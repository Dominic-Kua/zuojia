import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { execFileSync, execFile as execFileRaw } from 'child_process';
import { promisify } from 'util';
import { createError } from '../util/error.js';
import { expandHome } from '../util/path-helpers.js';

const execFile = promisify(execFileRaw);

const REMOTE_VALIDATION_TIMEOUT_MS = 15000;

export const DEFAULT_GIT_SETTINGS = {
  remoteUrl: '',
  branch: 'main',
  sshKeyPath: '~/.ssh/id_rsa',
};

function validateNovelPath(novelPath) {
  if (!novelPath || !fs.existsSync(novelPath)) {
    return createError(
      'INVALID_NOVEL_PATH',
      'Novel path does not exist',
      `Ensure the path "${novelPath}" exists and is a valid novel directory`
    );
  }

  return null;
}

function parseConfig(content) {
  const config = {};
  let currentSection = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/\t/g, '    ');
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    if (!line.startsWith(' ')) {
      const [key, ...rest] = trimmed.split(':');
      const value = rest.join(':').trim();
      if (value === '') {
        currentSection = key.trim();
        config[currentSection] = config[currentSection] || {};
      } else {
        currentSection = null;
        config[key.trim()] = value.replace(/^['"]|['"]$/g, '');
      }
      continue;
    }

    if (!currentSection) {
      continue;
    }

    const [key, ...rest] = trimmed.split(':');
    config[currentSection][key.trim()] = rest.join(':').trim().replace(/^['"]|['"]$/g, '');
  }

  return config;
}

function normalizeGitSettings(settings = {}) {
  return {
    remoteUrl: String(settings.remoteUrl || settings.remote || '').trim(),
    branch: String(settings.branch || DEFAULT_GIT_SETTINGS.branch).trim() || DEFAULT_GIT_SETTINGS.branch,
    sshKeyPath: String(settings.sshKeyPath || DEFAULT_GIT_SETTINGS.sshKeyPath).trim() || DEFAULT_GIT_SETTINGS.sshKeyPath,
  };
}

function serializeConfig(config) {
  const lines = [];
  for (const [key, value] of Object.entries(config)) {
    if (value !== null && typeof value === 'object') {
      lines.push(`${key}:`);
      for (const [subKey, subValue] of Object.entries(value)) {
        lines.push(`  ${subKey}: ${subValue}`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

export function getGitConfigPath(novelPath) {
  return path.join(novelPath, 'meta', 'config.yml');
}

export function getGitConfigCandidates(novelPath) {
  return [
    path.join(novelPath, 'meta', 'config.yml'),
    path.join(novelPath, 'meta', 'config.yaml'),
  ];
}

function readExistingConfigFile(novelPath) {
  for (const candidate of getGitConfigCandidates(novelPath)) {
    if (fs.existsSync(candidate)) {
      return {
        configPath: candidate,
        content: fs.readFileSync(candidate, 'utf-8'),
      };
    }
  }
  return null;
}

async function readExistingConfigFileAsync(novelPath) {
  for (const candidate of getGitConfigCandidates(novelPath)) {
    if (fs.existsSync(candidate)) {
      return {
        configPath: candidate,
        content: await fsPromises.readFile(candidate, 'utf-8'),
      };
    }
  }
  return null;
}

/**
 * Read the git remote configured natively (`git remote` / git config)
 * instead of requiring meta/config.yml to duplicate it.
 * Returns '' when no remote is configured or git fails.
 */
export function getNativeGitRemoteUrl(novelPath) {
  try {
    const remoteUrl = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      cwd: novelPath,
      encoding: 'utf-8',
    }).trim();
    return remoteUrl || '';
  } catch {
    return '';
  }
}

/**
 * Current checked-out branch (e.g. `main`, `feature/foo`).
 * Returns '' when it cannot be determined (no repo, detached HEAD, ...).
 */
export function getNativeCurrentBranch(novelPath) {
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: novelPath,
      encoding: 'utf-8',
    }).trim();
    if (!branch || branch === 'HEAD') {
      return '';
    }
    return branch;
  } catch {
    return '';
  }
}

/**
 * Upstream branch name (e.g. `main` from `origin/main`) when the current
 * branch tracks a remote. Returns '' when no upstream is set.
 */
export function getNativeUpstreamBranch(novelPath) {
  try {
    const upstream = execFileSync('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], {
      cwd: novelPath,
      encoding: 'utf-8',
    }).trim();
    if (!upstream) {
      return '';
    }
    // Upstream is usually `<remote>/<branch>`; the branch is what we push.
    const slash = upstream.indexOf('/');
    if (slash >= 0) {
      return upstream.slice(slash + 1) || '';
    }
    return upstream;
  } catch {
    return '';
  }
}

export function isSshRemote(remoteUrl) {
  if (!remoteUrl || typeof remoteUrl !== 'string') {
    return false;
  }

  return remoteUrl.startsWith('git@') || remoteUrl.startsWith('ssh://');
}

export function validateSshKeyPath(sshKeyPath) {
  if (!/^[a-zA-Z0-9._/~-]+$/.test(sshKeyPath)) {
    return createError(
      'INVALID_SSH_KEY_PATH',
      'SSH key path contains invalid characters',
      'The SSH key path must only contain letters, digits, dots, hyphens, underscores, forward slashes, and tildes'
    );
  }

  return null;
}

export function ensureSshKeyExists(sshKeyPath) {
  if (!sshKeyPath || !fs.existsSync(sshKeyPath)) {
    return createError(
      'SSH_KEY_NOT_FOUND',
      'Configured SSH key was not found',
      `Check that the SSH key exists at ${sshKeyPath}`
    );
  }

  return null;
}

export function getExecOptions(novelPath, sshKeyPath = null) {
  const env = { ...process.env };
  if (sshKeyPath) {
    env.GIT_SSH_COMMAND = `ssh -i "${sshKeyPath}" -o IdentitiesOnly=yes`;
  }

  return {
    cwd: novelPath,
    encoding: 'utf-8',
    env,
  };
}

export function ensureGitAvailable() {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return null;
  } catch (err) {
    return createError(
      'GIT_UNAVAILABLE',
      'Git is not available on this system',
      'Install Git and ensure it is available in your shell PATH',
      { error: err.message }
    );
  }
}

async function validateRemoteReachable(novelPath, remoteUrl, sshKeyPath) {
  const gitError = ensureGitAvailable();
  if (gitError) {
    return gitError;
  }

  const useSsh = isSshRemote(remoteUrl);
  let effectiveSshKeyPath = null;

  if (useSsh) {
    const keyPathError = validateSshKeyPath(sshKeyPath);
    if (keyPathError) {
      return keyPathError;
    }

    effectiveSshKeyPath = expandHome(sshKeyPath);
    const sshKeyError = ensureSshKeyExists(effectiveSshKeyPath);
    if (sshKeyError) {
      return sshKeyError;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REMOTE_VALIDATION_TIMEOUT_MS);

  try {
    await execFile('git', ['ls-remote', remoteUrl], {
      ...getExecOptions(novelPath, effectiveSshKeyPath),
      signal: controller.signal,
    });
    return {
      status: 'ok',
      data: {
        sshKeyPath: effectiveSshKeyPath,
      },
    };
  } catch (err) {
    if (err.code === 'ABORT_ERR' || err.name === 'AbortError') {
      return createError(
        'REMOTE_TIMEOUT',
        'Remote validation timed out',
        'Check the remote URL, SSH key, and network connectivity',
        { error: 'Connection timed out' }
      );
    }
    return createError(
      'REMOTE_UNREACHABLE',
      'Remote could not be reached',
      'Check the remote URL, SSH key, and network connectivity',
      { error: err.message }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getGitSettings(novelPath) {
  const novelPathError = validateNovelPath(novelPath);
  if (novelPathError) {
    return novelPathError;
  }

  const existing = await readExistingConfigFileAsync(novelPath);
  if (!existing) {
    // No config file yet: inherit from the linked git repo when possible so
    // the Settings form pre-fills the actual remote/branch instead of blanks.
    const remoteUrl = getNativeGitRemoteUrl(novelPath);
    const branch = getNativeCurrentBranch(novelPath) || DEFAULT_GIT_SETTINGS.branch;
    return {
      status: 'ok',
      data: {
        remoteUrl,
        branch,
        sshKeyPath: DEFAULT_GIT_SETTINGS.sshKeyPath,
      },
      timestamp: new Date().toISOString(),
    };
  }

  const parsed = parseConfig(existing.content);
  const fileSettings = parsed.git || {};
  const normalized = normalizeGitSettings(fileSettings);

  // Fill blanks from the native git repo so an existing remote/branch is
  // inherited without forcing the user to duplicate it in meta/config.yml.
  if (!normalized.remoteUrl) {
    normalized.remoteUrl = getNativeGitRemoteUrl(novelPath);
  }
  const rawBranch = String(fileSettings.branch || '').trim();
  if (!rawBranch) {
    normalized.branch = getNativeCurrentBranch(novelPath) || normalized.branch;
  }

  return {
    status: 'ok',
    data: normalized,
    timestamp: new Date().toISOString(),
  };
}

function noRemoteConfiguredError() {
  return createError(
    'REMOTE_NOT_CONFIGURED',
    'Git remote is not configured',
    'No git remote found. Open Settings → Git Settings and enter a Remote URL, ' +
      'or link this folder with: git remote add origin <url>. ' +
      'An existing checkout with an upstream is used automatically.'
  );
}

export function loadGitConfig(novelPath) {
  const novelPathError = validateNovelPath(novelPath);
  if (novelPathError) {
    return novelPathError;
  }

  const existing = readExistingConfigFile(novelPath);
  const parsed = existing ? parseConfig(existing.content) : {};
  const fileSettings = parsed.git || {};
  const config = normalizeGitSettings(fileSettings);

  // Inherit from the existing git repo when meta/config.yml(yaml) is missing
  // or leaves fields blank: use `origin` remote and current/upstream branch.
  if (!config.remoteUrl) {
    config.remoteUrl = getNativeGitRemoteUrl(novelPath);
  }

  const rawBranch = String(fileSettings.branch || '').trim();
  if (!rawBranch) {
    config.branch =
      getNativeCurrentBranch(novelPath) ||
      getNativeUpstreamBranch(novelPath) ||
      config.branch ||
      DEFAULT_GIT_SETTINGS.branch;
  }

  if (!config.remoteUrl) {
    return noRemoteConfiguredError();
  }

  return {
    status: 'ok',
    data: {
      ...config,
      sshKeyPath: expandHome(config.sshKeyPath),
    },
  };
}

export async function saveGitSettings(novelPath, settings) {
  const novelPathError = validateNovelPath(novelPath);
  if (novelPathError) {
    return novelPathError;
  }

  const normalized = normalizeGitSettings(settings);
  if (!normalized.remoteUrl) {
    return createError(
      'REMOTE_NOT_CONFIGURED',
      'Git remote is not configured',
      'Enter a remote URL before saving your git settings'
    );
  }

  const remoteValidation = await validateRemoteReachable(novelPath, normalized.remoteUrl, normalized.sshKeyPath);
  if (remoteValidation.status === 'error') {
    return remoteValidation;
  }

  const existing = await readExistingConfigFileAsync(novelPath);
  const configPath = existing?.configPath || getGitConfigPath(novelPath);
  await fsPromises.mkdir(path.dirname(configPath), { recursive: true });

  let existingConfig = {};
  if (existing) {
    existingConfig = parseConfig(existing.content);
  }

  existingConfig.git = {
    remoteUrl: normalized.remoteUrl,
    branch: normalized.branch,
    sshKeyPath: normalized.sshKeyPath,
  };

  await fsPromises.writeFile(configPath, serializeConfig(existingConfig), 'utf-8');

  return {
    status: 'ok',
    data: normalized,
    timestamp: new Date().toISOString(),
  };
}