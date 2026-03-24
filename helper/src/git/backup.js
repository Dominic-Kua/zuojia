import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createError } from '../util/error.js';

function ensureGitRepo(novelPath) {
  const gitDir = path.join(novelPath, '.git');
  if (fs.existsSync(gitDir)) {
    return null;
  }

  try {
    execFileSync('git', ['init'], { cwd: novelPath, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.name', 'zuojia'], { cwd: novelPath, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'zuojia@localhost'], { cwd: novelPath, stdio: 'ignore' });
    return null;
  } catch (err) {
    return createError('GIT_INIT_FAILED', 'Failed to initialize git repository',
      'Check file permissions and disk space', { error: err.message });
  }
}

function getChangedFiles(novelPath) {
  const output = execFileSync('git', ['status', '--porcelain'], { cwd: novelPath, encoding: 'utf-8' });
  if (!output || output.trim() === '') {
    return [];
  }

  return output
    .split('\n')
    .filter(line => line.trim())
    .map((line) => line.slice(3).trim());
}

function buildCommitMessage(files) {
  const timestamp = new Date().toISOString();
  const fileList = files.length > 0 ? files.join(', ') : 'none';
  return {
    message: `backup: ${timestamp} | files: ${fileList}`,
    timestamp,
  };
}

export async function backupAndPush(novelPath) {
  try {
    if (!novelPath || !fs.existsSync(novelPath)) {
      return createError('INVALID_NOVEL_PATH', 'Novel path does not exist',
        `Ensure the path "${novelPath}" exists and is a valid novel directory`);
    }

    const initError = ensureGitRepo(novelPath);
    if (initError) {
      return initError;
    }

    let files = [];
    try {
      files = getChangedFiles(novelPath);
    } catch (err) {
      return createError('GIT_STATUS_FAILED', 'Failed to read git status',
        'Check git installation and repository state', { error: err.message });
    }

    let committed = false;
    let commitMessage = null;

    if (files.length > 0) {
      try {
        execFileSync('git', ['add', '-A'], { cwd: novelPath, stdio: 'ignore' });
      } catch (err) {
        return createError('GIT_ADD_FAILED', 'Failed to stage changes',
          'Check git configuration and file permissions', { error: err.message });
      }

      const commitMeta = buildCommitMessage(files);
      commitMessage = commitMeta.message;

      try {
        execFileSync('git', ['commit', '-m', commitMessage], { cwd: novelPath, stdio: 'ignore' });
        committed = true;
      } catch (err) {
        if (!err.message.includes('nothing to commit')) {
          return createError('GIT_COMMIT_FAILED', 'Failed to commit changes',
            'Check git configuration and repository state', { error: err.message });
        }
      }
    }

    try {
      execFileSync('git', ['push'], { cwd: novelPath, stdio: 'ignore' });
    } catch (err) {
      return createError('GIT_PUSH_FAILED', 'Failed to push changes',
        'Check remote configuration and network connectivity', { error: err.message });
    }

    return {
      status: 'ok',
      data: {
        committed,
        pushed: true,
        files,
        message: commitMessage,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return createError('BACKUP_FAILED', 'Backup operation failed',
      'Check git installation and repository state', { error: err.message });
  }
}
