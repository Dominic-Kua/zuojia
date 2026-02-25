/**
 * Git history analysis utilities
 * @module git/history
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { calculateWordCount } from '../stats/word-count.js';

/**
 * Get words written today by analyzing git diffs since midnight
 * Compares current state with state at midnight (start of day)
 * Only counts manuscript/ files, excludes wiki/
 * 
 * @param {string} novelPath - Path to novel root directory
 * @returns {Promise<number>} Net words added today (added words only, not subtracting deleted)
 */
export async function getWordsWrittenToday(novelPath) {
  // Check if git repo exists
  const gitPath = path.join(novelPath, '.git');
  if (!fs.existsSync(gitPath)) {
    return 0;
  }

  try {
    // Get midnight timestamp (start of today)
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const midnightISO = midnight.toISOString();

    // Check if there are any commits
    let hasCommits = false;
    try {
      execSync('git rev-parse HEAD', {
        cwd: novelPath,
        stdio: 'pipe',
      });
      hasCommits = true;
    } catch (err) {
      // No commits yet
      return 0;
    }

    if (!hasCommits) {
      return 0;
    }

    // Check if there are commits since midnight
    let commitsSinceMidnight = false;
    try {
      const logResult = execSync(
        `git log --since="${midnightISO}" --oneline`,
        {
          cwd: novelPath,
          encoding: 'utf-8',
          stdio: 'pipe',
        }
      );
      commitsSinceMidnight = logResult.trim().length > 0;
    } catch (err) {
      // Error getting log
      return 0;
    }

    if (!commitsSinceMidnight) {
      return 0;
    }

    // Get diff of manuscript files since midnight
    // We'll compare against the state at midnight
    let diffOutput = '';
    try {
      diffOutput = execSync(
        `git diff --unified=0 --since="${midnightISO}" HEAD -- manuscript/`,
        {
          cwd: novelPath,
          encoding: 'utf-8',
          stdio: 'pipe',
        }
      );
    } catch (err) {
      // If diff fails, try getting diff from first commit today to HEAD
      try {
        const firstCommitToday = execSync(
          `git log --reverse --since="${midnightISO}" --format=%H --max-count=1`,
          {
            cwd: novelPath,
            encoding: 'utf-8',
            stdio: 'pipe',
          }
        ).trim();

        if (firstCommitToday) {
          // Get the commit before first commit today
          try {
            const commitBefore = execSync(
              `git rev-parse ${firstCommitToday}^`,
              {
                cwd: novelPath,
                encoding: 'utf-8',
                stdio: 'pipe',
              }
            ).trim();

            diffOutput = execSync(
              `git diff --unified=0 ${commitBefore}..HEAD -- manuscript/`,
              {
                cwd: novelPath,
                encoding: 'utf-8',
                stdio: 'pipe',
              }
            );
          } catch (err) {
            // First commit might be initial commit (no parent)
            // In this case, show all content as added
            diffOutput = execSync(
              `git diff --unified=0 4b825dc642cb6eb9a060e54bf8d69288fbee4904..HEAD -- manuscript/`,
              {
                cwd: novelPath,
                encoding: 'utf-8',
                stdio: 'pipe',
              }
            );
          }
        }
      } catch (err) {
        return 0;
      }
    }

    // Parse diff to count added words
    let addedWords = 0;
    
    // Split diff into lines
    const lines = diffOutput.split('\n');

    for (const line of lines) {
      // Added lines start with +
      if (line.startsWith('+') && !line.startsWith('+++')) {
        // Remove the + prefix
        const content = line.substring(1);
        const wordCount = calculateWordCount(content);
        addedWords += wordCount;
      }
    }

    return addedWords;
  } catch (err) {
    console.error('Error analyzing git history:', err);
    return 0;
  }
}
