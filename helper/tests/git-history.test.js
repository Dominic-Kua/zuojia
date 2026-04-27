/**
 * Tests for git history analysis utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getWordsWrittenToday } from '../src/git/history.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('getWordsWrittenToday', () => {
  let testDir;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zuojia-test-'));
    await fs.mkdir(path.join(testDir, 'manuscript'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'meta'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  /**
   * Write a today-baseline.json with the given word count
   */
  async function writeBaseline(novelPath, wordCount) {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const baselineFile = path.join(novelPath, 'meta', 'today-baseline.json');
    await fs.writeFile(baselineFile, JSON.stringify({ date: dateStr, wordCount }), 'utf-8');
  }

  it('returns 0 when no baseline exists (creates baseline at current state)', async () => {
    const count = await getWordsWrittenToday(testDir);
    expect(count).toBe(0);
  });

  it('counts words added since baseline', async () => {
    await writeBaseline(testDir, 5);
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-1.md'),
      'Ten words in this brand new chapter file here.'
    );

    const count = await getWordsWrittenToday(testDir);
    expect(count).toBe(4); // 9 current - 5 baseline = 4
  });

  it('counts words added across multiple files since baseline', async () => {
    await writeBaseline(testDir, 0);
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-1.md'),
      'Five words in chapter one.'
    );
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-2.md'),
      'Five words in chapter two.'
    );

    const count = await getWordsWrittenToday(testDir);
    expect(count).toBe(10); // 10 - 0 = 10
  });

  it('handles new files added since baseline', async () => {
    await writeBaseline(testDir, 0);
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-1.md'),
      'Ten words in this brand new chapter file here.'
    );

    const count = await getWordsWrittenToday(testDir);
    expect(count).toBe(9); // "Ten words in this brand new chapter file here" = 9 words
  });

  it('excludes wiki files from today count', async () => {
    await fs.mkdir(path.join(testDir, 'wiki'), { recursive: true });
    await writeBaseline(testDir, 0);

    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-1.md'),
      'Five words in chapter file.'
    );
    await fs.writeFile(
      path.join(testDir, 'wiki', 'character.md'),
      'Ten words in wiki file should not count.'
    );

    const count = await getWordsWrittenToday(testDir);
    expect(count).toBe(5); // only manuscript words count
  });

  it('returns 0 when word count equals baseline', async () => {
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-1.md'),
      'Five words in chapter file.'
    );
    await writeBaseline(testDir, 5);

    const count = await getWordsWrittenToday(testDir);
    expect(count).toBe(0);
  });

  it('returns 0 when word count is less than baseline (words deleted)', async () => {
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-1.md'),
      'Three words.'
    );
    await writeBaseline(testDir, 10);

    const count = await getWordsWrittenToday(testDir);
    expect(count).toBe(0); // Math.max(0, 2 - 10) = 0
  });

  it('returns 0 when no manuscript directory exists', async () => {
    const noManuscriptDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zuojia-nodir-'));

    const count = await getWordsWrittenToday(noManuscriptDir);
    expect(count).toBe(0);

    await fs.rm(noManuscriptDir, { recursive: true, force: true });
  });

  it('returns 0 and resets baseline when baseline is from a previous day', async () => {
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-1.md'),
      'Five words in chapter file.'
    );
    const baselineFile = path.join(testDir, 'meta', 'today-baseline.json');
    await fs.writeFile(
      baselineFile,
      JSON.stringify({ date: '2000-01-01', wordCount: 0 }),
      'utf-8'
    );

    const count = await getWordsWrittenToday(testDir);
    expect(count).toBe(0); // New day resets baseline -> returns 0
  });
});
