import path from 'path';
import fs from 'fs';
import { writeFile } from 'fs/promises';
import { execFileSync, execSync } from 'child_process';
import { createSnapshot } from '../backup/snapshot.js';
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
    return createError(
      'GIT_INIT_FAILED',
      'Failed to initialize git repository',
      'Check file permissions and disk space',
      { error: err.message }
    );
  }
}

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

function parseChangedFiles(output) {
  if (!output || output.trim() === '') {
    return [];
  }

  return output
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter((file) => file.startsWith('manuscript/') && file.endsWith('.md'));
}

function validateSelectedFiles(novelPath, files) {
  if (!Array.isArray(files) || files.length === 0) {
    return createError(
      'NO_FILES_SELECTED',
      'No files selected for commit',
      'Select at least one changed chapter before committing'
    );
  }

  const novelRoot = path.resolve(novelPath);
  const manuscriptRoot = path.resolve(novelPath, 'manuscript');

  for (const file of files) {
    if (typeof file !== 'string' || file.trim().length === 0) {
      return createError(
        'INVALID_SELECTED_FILE',
        'Invalid file selection',
        'Only changed manuscript chapters can be committed'
      );
    }

    const resolved = path.resolve(novelRoot, file);
    if (!resolved.startsWith(manuscriptRoot) || !resolved.startsWith(novelRoot)) {
      return createError(
        'INVALID_PATH_TRAVERSAL',
        'Path traversal detected',
        'Selected files must stay inside the novel manuscript directory'
      );
    }
  }

  return null;
}

export async function listChangedFiles(novelPath) {
  try {
    const novelPathError = validateNovelPath(novelPath);
    if (novelPathError) {
      return novelPathError;
    }

    const initError = ensureGitRepo(novelPath);
    if (initError) {
      return initError;
    }

    const output = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: novelPath,
      encoding: 'utf-8',
    });

    return {
      status: 'ok',
      data: {
        files: parseChangedFiles(output),
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

export async function createManualCommit(novelPath, files, message) {
  try {
    const novelPathError = validateNovelPath(novelPath);
    if (novelPathError) {
      return novelPathError;
    }

    const selectedFileError = validateSelectedFiles(novelPath, files);
    if (selectedFileError) {
      return selectedFileError;
    }

    const commitMessage = typeof message === 'string' ? message.trim() : '';
    if (!commitMessage) {
      return createError(
        'INVALID_COMMIT_MESSAGE',
        'Commit message is required',
        'Enter a clear commit message before confirming'
      );
    }

    const initError = ensureGitRepo(novelPath);
    if (initError) {
      return initError;
    }

    const snapshotResult = await createSnapshot(novelPath, `pre-commit: ${commitMessage}`);
    if (!snapshotResult || snapshotResult.status === 'error') {
      return snapshotResult || createError(
        'SNAPSHOT_CREATE_FAILED',
        'Failed to create pre-commit snapshot',
        'Retry the commit after resolving snapshot failures'
      );
    }

    execFileSync('git', ['add', '--', ...files], { cwd: novelPath, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', commitMessage], { cwd: novelPath, stdio: 'ignore' });

    const hash = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: novelPath,
      encoding: 'utf-8',
    }).trim().slice(0, 7);
    const author = execFileSync('git', ['config', 'user.name'], {
      cwd: novelPath,
      encoding: 'utf-8',
    }).trim() || 'zuojia';

    return {
      status: 'ok',
      data: {
        files,
        message: commitMessage,
        hash,
        author,
        snapshot: snapshotResult.data,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return createError(
      'GIT_COMMIT_FAILED',
      'Failed to create commit',
      'Check git configuration and repository state',
      { error: err.message }
    );
  }
}

export async function getCommitHistory(novelPath, limit = 10) {
  try {
    const novelPathError = validateNovelPath(novelPath);
    if (novelPathError) {
      return novelPathError;
    }

    const initError = ensureGitRepo(novelPath);
    if (initError) {
      return initError;
    }

    let output = '';
    try {
      output = execFileSync('git', ['log', `-n${limit}`, '--pretty=format:%h|%s'], {
        cwd: novelPath,
        encoding: 'utf-8',
      });
    } catch (err) {
      const stderr = String(err.stderr || '');
      const stdout = String(err.stdout || '');
      const combined = `${stderr}\n${stdout}\n${err.message || ''}`;
      if (combined.includes('does not have any commits yet') || combined.includes('your current branch')) {
        return {
          status: 'ok',
          data: { commits: [] },
          timestamp: new Date().toISOString(),
        };
      }
      throw err;
    }

    const commits = output
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, ...messageParts] = line.split('|');
        return {
          hash,
          message: messageParts.join('|'),
        };
      });

    return {
      status: 'ok',
      data: { commits },
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return createError(
      'GIT_HISTORY_FAILED',
      'Failed to load git history',
      'Check git installation and repository state',
      { error: err.message }
    );
  }
}

/**
 * Commit chapter changes to git
 * @param {string} novelPath - Path to novel directory
 * @param {string} filename - Chapter filename (e.g., 'chapter-01.md')
 * @param {string} content - Chapter content
 * @returns {Promise<{status: string, data?: object, error?: object, timestamp: string}>}
 */
export async function commitChapter(novelPath, filename, content) {
  try {
    // Validate novel path exists
    if (!novelPath || !fs.existsSync(novelPath)) {
      return createError('INVALID_NOVEL_PATH', 'Novel path does not exist', 
        `Ensure the path "${novelPath}" exists and is a valid novel directory`);
    }

    // Validate filename is provided
    if (!filename) {
      return createError('INVALID_FILENAME', 'Filename is required',
        'Provide a valid chapter filename (e.g., "chapter-01.md")');
    }

    // Prevent path traversal
    const resolvedFilename = path.resolve(novelPath, 'manuscript', filename);
    const manuscriptDir = path.resolve(novelPath, 'manuscript');
    
    if (!resolvedFilename.startsWith(manuscriptDir)) {
      return createError('INVALID_PATH_TRAVERSAL', 'Path traversal detected',
        'Filename must be a simple filename without parent directory references');
    }

    // Write content to disk before staging
    try {
      await writeFile(resolvedFilename, content, 'utf-8');
    } catch (writeErr) {
      return createError('WRITE_FAILED', 'Failed to write chapter content',
        'Check file permissions and disk space', { error: writeErr.message });
    }

    // Initialize git if needed (check for local .git, not parent repos)
    const hasOwnGit = fs.existsSync(path.join(novelPath, '.git'));
    if (!hasOwnGit) {
      try {
        execSync('git init', { cwd: novelPath, stdio: 'ignore' });
        execSync('git config user.name "zuojia"', { cwd: novelPath, stdio: 'ignore' });
        execSync('git config user.email "zuojia@localhost"', { cwd: novelPath, stdio: 'ignore' });
      } catch (initErr) {
        return createError('GIT_INIT_FAILED', 'Failed to initialize git repository',
          'Check file permissions and disk space', { error: initErr.message });
      }
    }

    // Stage the chapter file
    const relativeFile = path.relative(novelPath, resolvedFilename);
    
    try {
      execSync(`git add "${relativeFile}"`, { cwd: novelPath, stdio: 'ignore' });
    } catch (addErr) {
      return createError('GIT_ADD_FAILED', 'Failed to stage chapter',
        'Check git configuration and file permissions', { error: addErr.message });
    }

    // Create commit with timestamp
    const timestamp = new Date().toISOString();
    const commitMessage = `autosave: ${filename}`;

    try {
      execSync(`git commit -m "${commitMessage}"`, { cwd: novelPath, stdio: 'ignore' });
    } catch (commitErr) {
      // Git commit can fail if there are no changes - that's okay
      if (!commitErr.message.includes('nothing to commit')) {
        return createError('GIT_COMMIT_FAILED', 'Failed to commit changes',
          'Check git configuration and repository state', { error: commitErr.message });
      }
    }

    // Get commit hash and author info
    let commitHash = '';
    let author = 'zuojia';
    
    try {
      commitHash = execSync('git rev-parse HEAD', { cwd: novelPath, encoding: 'utf-8' }).trim().slice(0, 7);
      author = execSync('git config user.name', { cwd: novelPath, encoding: 'utf-8' }).trim() || 'zuojia';
    } catch {
      // Ignore errors getting commit info - commit may not exist yet
    }

    return {
      status: 'ok',
      data: {
        filename,
        message: commitMessage,
        author,
        hash: commitHash,
        timestamp
      },
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return createError('SUBPROCESS_FAILED', 'Git commit operation failed',
      'Check git installation and repository state', { error: err.message });
  }
}
