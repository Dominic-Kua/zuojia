import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createError } from '../util/error.js';
import {
  ensureGitAvailable,
  ensureSshKeyExists,
  getExecOptions,
  isSshRemote,
  loadGitConfig,
  validateSshKeyPath,
} from './config.js';
import { confirmRemote, isRemoteConfirmed } from './trusted-remotes.js';

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

function getGitArgs(remoteUrl, args = []) {
  return ['-c', `remote.origin.url=${remoteUrl}`, ...args];
}

// Generated/ignorable paths that must not block a push. New repos exclude
// these via .gitignore; this filter covers existing repos created before
// the gitignore existed (same set as backup staging exclusions).
const PUSH_IGNORED_DIR_PREFIXES = ['meta/backups/', 'meta/exports/', 'meta/logs/'];
const PUSH_IGNORED_BASENAMES = ['.DS_Store'];

function isPushIgnorablePath(file) {
  const normalized = file.replace(/\\/g, '/');
  if (PUSH_IGNORED_BASENAMES.includes(path.basename(normalized))) {
    return true;
  }
  return PUSH_IGNORED_DIR_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function getBlockingChanges(output) {
  if (!output || output.trim().length === 0) {
    return [];
  }

  return output
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      // Rename entries look like `R  old -> new`; the new path is what matters.
      const arrow = line.indexOf(' -> ');
      const entry = arrow >= 0 ? line.slice(arrow + 4) : line.slice(3);
      return entry.trim().replace(/^"|"$/g, '');
    })
    .filter((file) => file.length > 0 && !isPushIgnorablePath(file));
}

function ensureCleanWorkingTree(novelPath) {
  try {
    const output = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: novelPath,
      encoding: 'utf-8',
    });
    if (getBlockingChanges(output).length > 0) {
      return createError(
        'WORKING_TREE_DIRTY',
        'There are uncommitted changes in the working tree',
        'Commit your changes (Commit button) before pushing so the remote backup is explicit and reproducible'
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
    // `--` before the branch is belt-and-suspenders alongside branch
    // charset validation: a value that cannot start with `-` can never be
    // parsed as a flag.
    const lsRemoteArgs = remoteUrl
      ? getGitArgs(remoteUrl, ['ls-remote', '--heads', 'origin', '--', branch])
      : ['ls-remote', '--heads', 'origin', '--', branch];
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

export async function pushToRemote(novelPath, { confirmRemote: confirm = false } = {}) {
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

    // Trust-on-first-use: the config (and therefore the remote) may have
    // arrived inside a shared/cloned novel. The first push to an
    // unconfirmed remote stops here so the UI can show the user exactly
    // where their novel is about to go; confirming records it app-side
    // (outside the novel) so later pushes proceed silently.
    if (confirm) {
      confirmRemote(novelPath, remoteUrl, branch);
    } else if (!isRemoteConfirmed(novelPath, remoteUrl)) {
      return createError(
        'REMOTE_UNCONFIRMED',
        'Push remote has not been confirmed for this novel',
        `Confirm that you want to push to ${remoteUrl} on branch ${branch}`,
        { remoteUrl, branch }
      );
    }

    const gitError = ensureGitAvailable();
    if (gitError) {
      return gitError;
    }

    const useSsh = isSshRemote(remoteUrl);

    // sshKeyPath is null when the key field is blank (auto): ssh uses the
    // agent, ssh config, and default key files (id_ed25519, id_rsa, ...).
    // Only an explicitly configured key is pinned and pre-checked here.
    if (useSsh && sshKeyPath) {
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
    // `-u` sets the upstream on first push so later plain `git push`/`pull`
    // keep working; when an upstream is already set this is a no-op.
    execFileSync('git', getGitArgs(remoteUrl, ['push', '-u', 'origin', '--', branch]), options);

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