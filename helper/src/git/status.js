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

function getGitDir(novelPath) {
  return path.join(novelPath, '.git');
}

export function isGitRepo(novelPath) {
  try {
    const novelPathError = validateNovelPath(novelPath);
    if (novelPathError) return novelPathError;

    const gitDir = getGitDir(novelPath);
    if (!fs.existsSync(gitDir)) {
      return {
        status: 'ok',
        data: { isRepo: false },
        timestamp: new Date().toISOString(),
      };
    }

    // Verify it's actually a git repo
    execFileSync('git', ['rev-parse', '--git-dir'], {
      cwd: novelPath,
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    return {
      status: 'ok',
      data: { isRepo: true },
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      status: 'ok',
      data: { isRepo: false },
      timestamp: new Date().toISOString(),
    };
  }
}

export function getGitStatus(novelPath) {
  try {
    const novelPathError = validateNovelPath(novelPath);
    if (novelPathError) return novelPathError;

    const gitDir = getGitDir(novelPath);
    if (!fs.existsSync(gitDir)) {
      return createError(
        'GIT_REPO_NOT_FOUND',
        'No git repository found in the novel directory',
        'Create a commit first to initialize the git repository'
      );
    }

    const output = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: novelPath,
      encoding: 'utf-8',
    });

    const lines = output.trim().split('\n').filter(line => line.length > 0);
    const changes = lines.map(line => ({
      status: line.slice(0, 2),
      file: line.slice(3),
    }));

    return {
      status: 'ok',
      data: {
        changes,
        changeCount: changes.length,
        hasChanges: changes.length > 0,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return createError(
      'GIT_STATUS_FAILED',
      'Failed to inspect git status',
      'Check git installation and repository state',
      { error: err.message }
    );
  }
}

export function getDirtyState(novelPath) {
  try {
    const novelPathError = validateNovelPath(novelPath);
    if (novelPathError) return novelPathError;

    const gitDir = getGitDir(novelPath);
    if (!fs.existsSync(gitDir)) {
      return {
        status: 'ok',
        data: {
          isRepo: false,
          dirtyCount: 0,
          files: [],
        },
        timestamp: new Date().toISOString(),
      };
    }

    const output = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: novelPath,
      encoding: 'utf-8',
    });

    const lines = output.trim().split('\n').filter(line => line.length > 0);
    const dirtyCount = lines.length;
    const files = lines.map(line => ({
      status: line.slice(0, 2),
      file: line.slice(3),
    }));

    return {
      status: 'ok',
      data: {
        isRepo: true,
        dirtyCount,
        files,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return createError(
      'GIT_DIRTY_STATE_FAILED',
      'Failed to get dirty state',
      'Check git installation and repository state',
      { error: err.message }
    );
  }
}

export function getSyncStatus(novelPath) {
  try {
    const novelPathError = validateNovelPath(novelPath);
    if (novelPathError) return novelPathError;

    const gitDir = getGitDir(novelPath);
    if (!fs.existsSync(gitDir)) {
      return {
        status: 'ok',
        data: {
          isRepo: false,
          lastPush: null,
          ahead: 0,
          behind: 0,
          hasRemote: false,
          branch: null,
          upstreamBranch: null,
        },
        timestamp: new Date().toISOString(),
      };
    }

    // Get current branch
    let branch;
    try {
      branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: novelPath,
        encoding: 'utf-8',
      }).trim();
    } catch {
      branch = 'main';
    }

    // Check if there's a remote
    let hasRemote = false;
    let remoteUrl = null;
    try {
      remoteUrl = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
        cwd: novelPath,
        encoding: 'utf-8',
      }).trim();
      hasRemote = !!remoteUrl;
    } catch {
      hasRemote = false;
    }

    if (!hasRemote) {
      return {
        status: 'ok',
        data: {
          isRepo: true,
          lastPush: null,
          ahead: 0,
          behind: 0,
          hasRemote: false,
          branch,
          upstreamBranch: null,
        },
        timestamp: new Date().toISOString(),
      };
    }

    // Get upstream branch
    let upstreamBranch = null;
    try {
      upstreamBranch = execFileSync('git', ['rev-parse', '--abbrev-ref', '@{u}'], {
        cwd: novelPath,
        encoding: 'utf-8',
      }).trim();
    } catch {
      // No upstream configured
    }

    // Get ahead/behind counts
    let ahead = 0;
    let behind = 0;
    if (upstreamBranch) {
      try {
        const output = execFileSync('git', ['rev-list', '--left-right', '--count', `${upstreamBranch}...HEAD`], {
          cwd: novelPath,
          encoding: 'utf-8',
        }).trim();
        const [behindStr, aheadStr] = output.split('\t');
        behind = parseInt(behindStr, 10) || 0;
        ahead = parseInt(aheadStr, 10) || 0;
      } catch {
        // Could not determine ahead/behind
      }
    }

    // Get last push time from reflog
    let lastPush = null;
    try {
      const reflog = execFileSync('git', ['reflog', '--date=iso', '--format=%gd %gs %cr', '-n', '10'], {
        cwd: novelPath,
        encoding: 'utf-8',
      }).trim();
      
      // Look for push entries
      for (const line of reflog.split('\n')) {
        if (line.includes('push') || line.includes('push from')) {
          const match = line.match(/^(\S+)\s+(\S+)\s+(.+)$/);
          if (match) {
            lastPush = match[2]; // timestamp
            break;
          }
        }
      }
      
      if (!lastPush) {
        // Get the latest commit date as fallback
        const latestCommit = execFileSync('git', ['log', '-1', '--format=%ci', branch], {
          cwd: novelPath,
          encoding: 'utf-8',
        }).trim();
        if (latestCommit) lastPush = latestCommit;
      }
    } catch {
      // Ignore reflog errors
    }

    return {
      status: 'ok',
      data: {
        isRepo: true,
        lastPush,
        ahead,
        behind,
        hasRemote: true,
        branch,
        upstreamBranch,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return createError(
      'GIT_SYNC_STATUS_FAILED',
      'Failed to get sync status',
      'Check git installation and repository state',
      { error: err.message }
    );
  }
}

export function pullFromRemote(novelPath) {
  try {
    const novelPathError = validateNovelPath(novelPath);
    if (novelPathError) return novelPathError;

    const gitDir = getGitDir(novelPath);
    if (!fs.existsSync(gitDir)) {
      return createError(
        'GIT_REPO_NOT_FOUND',
        'No git repository found in the novel directory',
        'Create a commit first to initialize the git repository before pulling'
      );
    }

    // Check if there's a remote
    let hasRemote = false;
    try {
      const remoteUrl = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
        cwd: novelPath,
        encoding: 'utf-8',
      }).trim();
      hasRemote = !!remoteUrl;
    } catch {
      hasRemote = false;
    }

    if (!hasRemote) {
      return createError(
        'NO_REMOTE_CONFIGURED',
        'No remote repository configured',
        'Configure a remote with: git remote add origin <url>'
      );
    }

    // Check for uncommitted changes
    const statusOutput = execFileSync('git', ['status', '--porcelain'], {
      cwd: novelPath,
      encoding: 'utf-8',
    }).trim();

    if (statusOutput) {
      return createError(
        'WORKING_TREE_DIRTY',
        'There are uncommitted changes in the working tree',
        'Commit or stash your changes before pulling'
      );
    }

    // Execute pull
    const output = execFileSync('git', ['pull', 'origin'], {
      cwd: novelPath,
      encoding: 'utf-8',
    }).trim();

    // Check if any files were updated
    const filesUpdated = output && !output.includes('Already up to date.') && !output.includes('Already up-to-date.');

    return {
      status: 'ok',
      data: {
        success: true,
        output,
        filesUpdated,
        branch: execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
          cwd: novelPath,
          encoding: 'utf-8',
        }).trim(),
      },
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return createError(
      'GIT_PULL_FAILED',
      'Failed to pull from remote',
      'Check remote configuration, network connectivity, and merge conflicts',
      { error: err.message }
    );
  }
}