/**
 * Git history analysis utilities
 * @module git/history
 */

import path from 'path';
import fs from 'fs';
import { calculateWordCount } from '../stats/word-count.js';

/**
 * Get words written today by comparing current manuscript state to today's baseline
 * Stores a baseline at the start of each day to calculate the day's progress
 * 
 * @param {string} novelPath - Path to novel root directory
 * @returns {Promise<number>} Net words added since midnight (or since baseline was set)
 */
export async function getWordsWrittenToday(novelPath) {
  try {
    const manuscriptDir = path.join(novelPath, 'manuscript');

    // Check if manuscript directory exists
    if (!fs.existsSync(manuscriptDir)) {
      return 0;
    }

    // Get current word count of all files in manuscript/
    const currentWordCount = getDirectoryWordCount(manuscriptDir);

    // Get or initialize baseline
    const metaDir = path.join(novelPath, 'meta');
    const baselineFile = path.join(metaDir, 'today-baseline.json');

    let baseline = {
      date: createDateString(new Date()),
      wordCount: 0,
    };

    try {
      if (fs.existsSync(baselineFile)) {
        const data = fs.readFileSync(baselineFile, 'utf-8');
        baseline = JSON.parse(data);

        // Check if baseline is from today
        const today = createDateString(new Date());
        if (baseline.date !== today) {
          // It's a new day, update baseline to current count
          baseline = {
            date: today,
            wordCount: currentWordCount,
          };
          // Save new baseline
          if (!fs.existsSync(metaDir)) {
            fs.mkdirSync(metaDir, { recursive: true });
          }
          fs.writeFileSync(baselineFile, JSON.stringify(baseline, null, 2), 'utf-8');
          return 0;
        }
      } else {
        // No baseline file exists, create one with current count
        baseline = {
          date: createDateString(new Date()),
          wordCount: currentWordCount,
        };
        if (!fs.existsSync(metaDir)) {
          fs.mkdirSync(metaDir, { recursive: true });
        }
        fs.writeFileSync(baselineFile, JSON.stringify(baseline, null, 2), 'utf-8');
        return 0;
      }
    } catch (err) {
      console.error('Error managing baseline file:', err);
      // If we can't manage the file, assume baseline is 0
      baseline.wordCount = 0;
    }

    // Return the difference (current - baseline)
    const todayWordCount = Math.max(0, currentWordCount - baseline.wordCount);
    return todayWordCount;
  } catch (err) {
    console.error('Error calculating today word count:', err);
    return 0;
  }
}

/**
 * Create a date string in YYYY-MM-DD format
 * @param {Date} date - Date object
 * @returns {string} Date string
 */
function createDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate total word count for all markdown files in a directory
 * @param {string} dirPath - Path to directory
 * @returns {number} Total word count
 */
function getDirectoryWordCount(dirPath) {
  let totalCount = 0;

  try {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      if (file.endsWith('.md')) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isFile()) {
          const content = fs.readFileSync(filePath, 'utf-8');
          totalCount += calculateWordCount(content);
        }
      }
    }
  } catch (err) {
    console.error('Error reading directory word count:', err);
  }

  return totalCount;
}
