import path from 'path';
import fs from 'fs';
import { writeFile } from 'fs/promises';
import { execSync } from 'child_process';
import { createError } from '../util/error.js';

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
