import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createError } from '../util/error.js';

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

function expandHome(filePath) {
  if (!filePath) {
    return filePath;
  }
  if (filePath === '~') {
    return process.env.HOME || filePath;
  }
  if (filePath.startsWith('~/')) {
    return path.join(process.env.HOME || '', filePath.slice(2));
  }
  return filePath;
}

function loadGitConfig(novelPath) {
  const configPath = path.join(novelPath, 'meta', 'config.yml');
  if (!fs.existsSync(configPath)) {
    return createError(
      'GIT_CONFIG_MISSING',
      'Git configuration file not found',
      'Create meta/config.yml with git remote settings before pushing'
    );
  }

  const parsed = parseConfig(fs.readFileSync(configPath, 'utf-8'));
  const gitConfig = parsed.git || {};
  const remoteUrl = gitConfig.remoteUrl || gitConfig.remote || null;
  const branch = gitConfig.branch || 'main';
  const sshKeyPath = expandHome(gitConfig.sshKeyPath || '~/.ssh/id_rsa');

  if (!remoteUrl) {
    return createError(
      'REMOTE_NOT_CONFIGURED',
      'Git remote is not configured',
      'Set git.remoteUrl in meta/config.yml before pushing'
    );
  }

  return {
    status: 'ok',
    data: { remoteUrl, branch, sshKeyPath },
  };
}

function ensureGitAvailable() {
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

function ensureSshAgentAvailable() {
  try {
    execFileSync('ssh-add', ['-l'], { stdio: 'ignore' });
    return null;
  } catch (err) {
    if (err && err.status === 1) {
      return createError(
        'SSH_AGENT_NO_IDENTITIES',
        'SSH agent has no identities loaded',
        'Add your SSH key to the running agent, for example: ssh-add ~/.ssh/id_rsa',
        { error: err.message }
      );
    }

    if (err && err.status === 2) {
      return createError(
        'SSH_AGENT_UNAVAILABLE',
        'SSH agent is not available',
        'Start an SSH agent and add your key, for example: ssh-add ~/.ssh/id_rsa',
        { error: err.message }
      );
    }

    return createError(
      'SSH_AGENT_CHECK_FAILED',
      'Unable to verify SSH agent status',
      'Check that ssh-add is available and that your SSH agent is configured correctly',
      { error: err.message }
    );
  }
}

function ensureSshKeyExists(sshKeyPath) {
  if (!sshKeyPath || !fs.existsSync(sshKeyPath)) {
    return createError(
      'SSH_KEY_NOT_FOUND',
      'Configured SSH key was not found',
      `Check that the SSH key exists at ${sshKeyPath}`
    );
  }

  return null;
}

function validateSshKeyPath(sshKeyPath) {
  if (!/^[a-zA-Z0-9._/~-]+$/.test(sshKeyPath)) {
    return createError(
      'INVALID_SSH_KEY_PATH',
      'SSH key path contains invalid characters',
      'The SSH key path must only contain letters, digits, dots, hyphens, underscores, forward slashes, and tildes'
    );
  }
  return null;
}

function getExecOptions(novelPath, sshKeyPath = null) {
  const env = { ...process.env };
  if (sshKeyPath) {
    // sshKeyPath has already been validated by validateSshKeyPath() to contain
    // only [a-zA-Z0-9._/~-], so no shell-special characters can appear inside
    // the double-quoted argument here.
    env.GIT_SSH_COMMAND = `ssh -i "${sshKeyPath}" -o IdentitiesOnly=yes`;
  }
  return {
    cwd: novelPath,
    encoding: 'utf-8',
    env,
  };
}

function getGitArgs(remoteUrl, args = []) {
  return ['-c', `remote.origin.url=${remoteUrl}`, ...args];
}

function ensureCleanWorkingTree(novelPath) {
  try {
    const output = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: novelPath,
      encoding: 'utf-8',
    });
    if (output.trim().length > 0) {
      return createError(
        'WORKING_TREE_DIRTY',
        'There are uncommitted changes in the working tree',
        'Create a commit before pushing so the remote backup is explicit and reproducible'
      );
    }
    return null;
  } catch (err) {
    return createError(
      'GIT_STATUS_FAILED',
      'Failed to inspect git status',
      'Check git installation and repository state',
      { error: err.message }
    );
  }
}

function isSshRemote(remoteUrl) {
  if (!remoteUrl || typeof remoteUrl !== 'string') {
    return false;
  }
  return remoteUrl.startsWith('git@') || remoteUrl.startsWith('ssh://');
}

function ensureGitRepoExists(novelPath) {
  const gitDir = path.join(novelPath, '.git');
  if (!fs.existsSync(gitDir)) {
    return createError(
      'GIT_REPO_NOT_FOUND',
      'No git repository found in the novel directory',
      'Create a commit first to initialize the git repository before pushing'
    );
  }
  return null;
}

function getPushCountForRemote(novelPath, remoteUrl, branch, sshKeyPath) {
  const options = getExecOptions(novelPath, sshKeyPath);
  try {
    const lsRemoteArgs = remoteUrl
      ? getGitArgs(remoteUrl, ['ls-remote', '--heads', 'origin', branch])
      : ['ls-remote', '--heads', 'origin', branch];
    const lsRemoteOutput = execFileSync('git', lsRemoteArgs, options).trim();

    if (lsRemoteOutput) {
      const [remoteHead] = lsRemoteOutput.split(/\s+/);
      return Number(execFileSync('git', ['rev-list', '--count', `${remoteHead}..HEAD`], options).trim());
    }

    return Number(execFileSync('git', ['rev-list', '--count', 'HEAD'], options).trim());
  } catch (err) {
    throw createError(
      'REMOTE_UNREACHABLE',
      'Failed to verify the configured remote',
      'Check the remote URL, SSH key, and network connectivity',
      { error: err.message }
    );
  }
}

export async function pushToRemote(novelPath) {
  try {
    const novelPathError = validateNovelPath(novelPath);
    if (novelPathError) {
      return novelPathError;
    }

    const repoError = ensureGitRepoExists(novelPath);
    if (repoError) {
      return repoError;
    }

    const configResult = loadGitConfig(novelPath);
    if (configResult.status === 'error') {
      return configResult;
    }

    const { remoteUrl, branch, sshKeyPath } = configResult.data;

    const gitError = ensureGitAvailable();
    if (gitError) {
      return gitError;
    }

    const useSsh = isSshRemote(remoteUrl);

    if (useSsh) {
      const keyPathError = validateSshKeyPath(sshKeyPath);
      if (keyPathError) {
        return keyPathError;
      }

      const sshAgentError = ensureSshAgentAvailable();
      if (sshAgentError) {
        return sshAgentError;
      }

      const sshKeyError = ensureSshKeyExists(sshKeyPath);
      if (sshKeyError) {
        return sshKeyError;
      }
    }

    const workingTreeError = ensureCleanWorkingTree(novelPath);
    if (workingTreeError) {
      return workingTreeError;
    }

    const effectiveSshKeyPath = useSsh ? sshKeyPath : null;
    const pushedCommits = getPushCountForRemote(novelPath, remoteUrl, branch, effectiveSshKeyPath);
    const options = getExecOptions(novelPath, effectiveSshKeyPath);
    execFileSync('git', getGitArgs(remoteUrl, ['push', 'origin', branch]), options);

    return {
      status: 'ok',
      data: {
        pushed: true,
        pushedCommits,
        branch,
        remoteUrl,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err?.status === 'error') {
      return err;
    }

    return createError(
      'GIT_PUSH_FAILED',
      'Failed to push commits to remote',
      'Check remote configuration, SSH credentials, and network connectivity',
      { error: err.message }
    );
  }
}