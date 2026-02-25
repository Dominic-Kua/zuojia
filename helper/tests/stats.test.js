/**
 * Tests for word count statistics utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { calculateWordCount } from '../src/stats/word-count.js';
import { getManuscriptWordCount } from '../src/stats/manuscript-count.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('calculateWordCount', () => {
  it('counts words in simple text', () => {
    const text = 'The quick brown fox jumps over the lazy dog';
    expect(calculateWordCount(text)).toBe(9);
  });

  it('counts words in markdown with formatting', () => {
    const text = 'This is **bold** and *italic* text.';
    expect(calculateWordCount(text)).toBe(6);
  });

  it('excludes code blocks from count', () => {
    const text = `
Before code block has three words.

\`\`\`javascript
const code = 'this should not be counted';
console.log('ten words here in code block');
\`\`\`

After code block has three words.
`;
    expect(calculateWordCount(text)).toBe(12); // 3 + 3 + 3 + 3 = 12 (only outside code)
  });

  it('excludes inline code from count', () => {
    const text = 'Use the `Array.map()` function to transform arrays.';
    expect(calculateWordCount(text)).toBe(6); // inline code not counted
  });

  it('excludes YAML front matter', () => {
    const text = `---
title: Chapter 1
date: 2026-02-25
---

Content after front matter has five words.`;
    expect(calculateWordCount(text)).toBe(7);
  });

  it('counts hyphenated words as single words', () => {
    const text = 'She was a well-known author of science-fiction novels.';
    expect(calculateWordCount(text)).toBe(8); // "well-known" and "science-fiction" each count as 1
  });

  it('handles empty string', () => {
    expect(calculateWordCount('')).toBe(0);
  });

  it('handles whitespace only', () => {
    expect(calculateWordCount('   \n\n  \t  ')).toBe(0);
  });

  it('counts contractions as single words', () => {
    const text = "Don't worry, it's going to be fine.";
    expect(calculateWordCount(text)).toBe(7);
  });

  it('excludes markdown links but counts display text', () => {
    const text = 'Check out [this link](https://example.com) for more.';
    expect(calculateWordCount(text)).toBe(6); // "Check out this link for more"
  });

  it('excludes HTML tags', () => {
    const text = 'This is <em>emphasized</em> text.';
    expect(calculateWordCount(text)).toBe(4);
  });
});

describe('getManuscriptWordCount', () => {
  let testDir;

  beforeEach(async () => {
    // Create temp directory structure
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'netwriter-test-'));
    await fs.mkdir(path.join(testDir, 'manuscript'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'wiki'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'meta'), { recursive: true });
  });

  afterEach(async () => {
    // Clean up
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('counts words across multiple chapter files', async () => {
    // Create test chapters
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-1.md'),
      'This is chapter one with ten words in it.'
    );
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-2.md'),
      'Chapter two has five words.'
    );

    const count = await getManuscriptWordCount(testDir);
    expect(count).toBe(14); // 9 + 5
  });

  it('excludes non-markdown files', async () => {
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-1.md'),
      'Ten words in this chapter file right here for sure.'
    );
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'notes.txt'),
      'These words should not be counted.'
    );
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'image.jpg'),
      'binary content'
    );

    const count = await getManuscriptWordCount(testDir);
    expect(count).toBe(10);
  });

  it('excludes wiki directory', async () => {
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-1.md'),
      'Five words in chapter one.'
    );
    await fs.writeFile(
      path.join(testDir, 'wiki', 'character.md'),
      'Ten words here in wiki file should not count.'
    );

    const count = await getManuscriptWordCount(testDir);
    expect(count).toBe(5);
  });

  it('excludes hidden files and git directory', async () => {
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-1.md'),
      'Five words in visible chapter.'
    );
    await fs.writeFile(
      path.join(testDir, 'manuscript', '.hidden.md'),
      'Hidden file words should not count.'
    );

    const count = await getManuscriptWordCount(testDir);
    expect(count).toBe(5);
  });

  it('returns 0 for empty manuscript directory', async () => {
    const count = await getManuscriptWordCount(testDir);
    expect(count).toBe(0);
  });

  it('handles manuscript directory with subdirectories', async () => {
    await fs.mkdir(path.join(testDir, 'manuscript', 'part-1'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'part-1', 'chapter-1.md'),
      'Five words in nested chapter.'
    );
    await fs.writeFile(
      path.join(testDir, 'manuscript', 'chapter-2.md'),
      'Three words here.'
    );

    const count = await getManuscriptWordCount(testDir);
    expect(count).toBe(8);
  });

  it('throws error if novel path does not exist', async () => {
    await expect(
      getManuscriptWordCount('/nonexistent/path')
    ).rejects.toThrow();
  });

  it('throws error if manuscript directory does not exist', async () => {
    await fs.rm(path.join(testDir, 'manuscript'), { recursive: true });
    await expect(
      getManuscriptWordCount(testDir)
    ).rejects.toThrow();
  });
});
