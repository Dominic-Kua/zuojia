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

// Transports that make git itself execute a command. `ext::` runs an
// arbitrary shell command as the transport (documented git behavior), so a
// remote URL with this scheme is remote code execution the moment git
// touches it — even for a read-only `ls-remote`. `fd::` reads from a file
// descriptor another process controls. Everything else (https://, http://,
// ssh://, scp-like `git@host:path`, plain `host:path`, local paths,
// file://) is inert as a transport, including self-hosted hosts and LAN
// addresses, so only these two prefixes are rejected.
const FORBIDDEN_REMOTE_URL_PREFIXES = ['ext::', 'fd::'];

export function validateRemoteUrlScheme(remoteUrl) {
  const normalized = String(remoteUrl || '').trim().toLowerCase();
  if (FORBIDDEN_REMOTE_URL_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return createError(
      'UNSAFE_REMOTE_URL',
      'Remote URL uses a forbidden transport',
      'Only https://, http://, ssh://, scp-like (git@host:path), plain host:path, local paths, and file:// remotes are accepted. ext:: and fd:: transports can execute arbitrary commands and are never used.'
    );
  }
  return null;
}

// Branch names flow into `git push` / `git ls-remote` argument lists. Argv
// form stops shell injection but a value starting with `-` is still parsed
// as a git flag (e.g. `--upload-pack=<cmd>`), so branches are restricted to
// the characters real branch names use and may never start with a dash.
// (`..`, `@{`, trailing slashes, and `.lock` suffixes are also rejected per
// git check-ref-format, since they are never valid in a branch ref.)
export function validateBranchName(branch) {
  const name = String(branch || '').trim();
  if (
    !/^[A-Za-z0-9._/-]+$/.test(name) ||
    name.startsWith('-') ||
    name.includes('..') ||
    name.includes('@{') ||
    name.endsWith('/') ||
    name.endsWith('.lock')
  ) {
    return createError(
      'INVALID_BRANCH_NAME',
      'Branch name contains invalid characters',
      'Branch names may only contain letters, digits, dots, underscores, slashes, and hyphens (and may not start with a hyphen)'
    );
  }
  return null;
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

/**
 * Resolve the effective SSH key for an SSH remote (path validation only;
 * existence is checked by the caller so push can report agent problems first).
 *
 * - Blank (auto): returns { keyPath: null } so git/ssh uses the agent,
 *   ssh config, and default key files (id_ed25519, id_rsa, ...). No
 *   filesystem probing, no forced `-i` flag.
 * - Explicit path: validated and returned expanded.
 * - Legacy default (`~/.ssh/id_rsa`) that is missing on disk: treated as
 *   auto instead of failing, healing configs written when id_rsa was the
 *   hardcoded default.
 */
export function resolveSshKeyPath(rawSshKeyPath) {
  const trimmed = String(rawSshKeyPath || '').trim();
  if (!trimmed) {
    return { keyPath: null };
  }

  const expanded = expandHome(trimmed);
  if (trimmed === DEFAULT_GIT_SETTINGS.sshKeyPath && !fs.existsSync(expanded)) {
    return { keyPath: null };
  }

  const keyPathError = validateSshKeyPath(trimmed);
  if (keyPathError) {
    return { error: keyPathError };
  }

  return { keyPath: expanded };
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

  // Checked before any git process sees the URL: `ext::` would execute
  // during this very validation run.
  const schemeError = validateRemoteUrlScheme(remoteUrl);
  if (schemeError) {
    return schemeError;
  }

  const useSsh = isSshRemote(remoteUrl);
  let effectiveSshKeyPath = null;

  if (useSsh) {
    const resolved = resolveSshKeyPath(sshKeyPath);
    if (resolved.error) {
      return resolved.error;
    }

    effectiveSshKeyPath = resolved.keyPath;
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
    // sshKeyPath stays blank (= auto: ssh-agent / default keys) so ed25519,
    // rsa, and agent-only setups all work without extra configuration.
    const remoteUrl = getNativeGitRemoteUrl(novelPath);
    const branch = getNativeCurrentBranch(novelPath) || DEFAULT_GIT_SETTINGS.branch;
    return {
      status: 'ok',
      data: {
        remoteUrl,
        branch,
        sshKeyPath: '',
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
  // Blank means "auto" (agent / default keys); a legacy id_rsa default that
  // no longer exists on disk is likewise treated as auto.
  const rawSshKey = String(fileSettings.sshKeyPath || '').trim();
  if (!rawSshKey) {
    normalized.sshKeyPath = '';
  } else {
    const resolved = resolveSshKeyPath(rawSshKey);
    normalized.sshKeyPath = resolved.error ? rawSshKey : (resolved.keyPath ? rawSshKey : '');
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

  // meta/config.yml travels with shared/cloned novels, so values read from
  // it (or inherited from a foreign git checkout) are untrusted until
  // validated here — every push/pull/status consumer goes through this.
  const schemeError = validateRemoteUrlScheme(config.remoteUrl);
  if (schemeError) {
    return schemeError;
  }
  const branchError = validateBranchName(config.branch);
  if (branchError) {
    return branchError;
  }

  // Blank means "auto" (ssh-agent / default keys such as id_ed25519 or
  // id_rsa); only an explicitly configured key is pinned via `-i`.
  const resolvedSshKey = resolveSshKeyPath(fileSettings.sshKeyPath);
  if (resolvedSshKey.error) {
    return resolvedSshKey.error;
  }

  return {
    status: 'ok',
    data: {
      ...config,
      sshKeyPath: resolvedSshKey.keyPath,
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

  const schemeError = validateRemoteUrlScheme(normalized.remoteUrl);
  if (schemeError) {
    return schemeError;
  }
  const branchError = validateBranchName(normalized.branch);
  if (branchError) {
    return branchError;
  }

  // Resolve against the raw key field so blank stays "auto" instead of being
  // forced to the legacy id_rsa default.
  const resolvedSshKey = resolveSshKeyPath(settings.sshKeyPath);
  if (resolvedSshKey.error) {
    return resolvedSshKey.error;
  }
  if (resolvedSshKey.keyPath) {
    const sshKeyError = ensureSshKeyExists(resolvedSshKey.keyPath);
    if (sshKeyError) {
      return sshKeyError;
    }
  }
  normalized.sshKeyPath = resolvedSshKey.keyPath ? String(settings.sshKeyPath).trim() : '';

  const remoteValidation = await validateRemoteReachable(novelPath, normalized.remoteUrl, resolvedSshKey.keyPath);
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