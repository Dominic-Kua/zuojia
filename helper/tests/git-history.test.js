/**
 * Tests for git history analysis utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getWordsWrittenToday } from '../src/git/history.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Write a today-baseline.json with the given word count into the novel's meta dir.
 */
async function writeBaseline(novelPath, wordCount) {
  const metaDir = path.join(novelPath, 'meta');
  await fs.mkdir(metaDir, { recursive: true });
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  await fs.writeFile(
    path.join(metaDir, 'today-baseline.json'),
    JSON.stringify({ date: dateStr, wordCount }, null, 2)
  );
}

describe('getWordsWrittenToday', () => {
  let testDir;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zuojia-test-'));
    await fs.mkdir(path.join(testDir, 'manuscript'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('returns 0 when no baseline or manuscript exists', async () => {
    await fs.rm(path.join(testDir, 'manuscript'), { recursive: true, force: true });
    const count = await getWordsWrittenToday(testDir);
    expect(count).toBe(0);
  });

  it('counts words added since baseline', async () => {
    await writeBaseline(testDir, 5);
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-1.md'),
      'Initial five words in file. Added five more words here.'
    );
    const count = await getWordsWrittenToday(testDir);
    expect(count).toBe(5); // 10 words - 5 baseline = 5 net
  });

  it('returns 0 when current word count matches baseline', async () => {
    await writeBaseline(testDir, 7);
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-1.md'),
      'Start with ten words. Added three words.'
    );
    const count = await getWordsWrittenToday(testDir);
    expect(count).toBe(0);
  });

  it('counts words across multiple files', async () => {
    await writeBaseline(testDir, 0);
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-1.md'),
      'Five words in chapter one. Three more.'
    );
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-2.md'),
      'Five words in chapter two. Four more here.'
    );
    const count = await getWordsWrittenToday(testDir);
    expect(count).toBe(15); // 7 + 8 words across files - 0 baseline = 15 net
  });

  it('returns 0 when word count has decreased since baseline', async () => {
    await writeBaseline(testDir, 20);
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-1.md'),
      'Five words in file.'
    );
    const count = await getWordsWrittenToday(testDir);
    expect(count).toBe(0);
  });

  it('handles new files with no prior baseline', async () => {
    await writeBaseline(testDir, 0);
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-1.md'),
      'Nine words in this brand new chapter file here.'
    );
    const count = await getWordsWrittenToday(testDir);
    expect(count).toBe(9);
  });

  it('excludes wiki files from today count', async () => {
    await writeBaseline(testDir, 0);
    await fs.mkdir(path.join(testDir, 'wiki'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-1.md'),
      'Five words in chapter file.'
    );
    await fs.writeFile(
      path.join(testDir, 'wiki', 'character.md'),
      'Ten words in wiki file should not count.'
    );
    const count = await getWordsWrittenToday(testDir);
    expect(count).toBe(5);
  });

  it('creates baseline when none exists and returns 0', async () => {
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-1.md'),
      'Five words in file.'
    );
    const count = await getWordsWrittenToday(testDir);
    expect(count).toBe(0);
  });
});
