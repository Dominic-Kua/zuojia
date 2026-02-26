/**
 * Integration Test: Word Count Flow
 * Tests word count updates across the application
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { calculateWordCount } from '../../helper/src/stats/word-count.js';
import { getManuscriptWordCount } from '../../helper/src/stats/manuscript-count.js';
import { execSync } from 'child_process';

describe('Word Count Integration Flow', () => {
  let testNovelPath;
  let manuscriptPath;

  beforeEach(async () => {
    // Create temporary novel directory with git
    testNovelPath = path.join(os.tmpdir(), `netwriter-test-${Date.now()}`);
    manuscriptPath = path.join(testNovelPath, 'manuscript');
    
    await fs.mkdir(manuscriptPath, { recursive: true });
    await fs.mkdir(path.join(testNovelPath, 'wiki'), { recursive: true });
    await fs.mkdir(path.join(testNovelPath, 'meta'), { recursive: true });

    // Initialize git repo
    execSync('git init', { cwd: testNovelPath, stdio: 'ignore' });
    execSync('git config user.email "test@test.com"', { cwd: testNovelPath, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: testNovelPath, stdio: 'ignore' });
  });

  afterEach(async () => {
    // Clean up test directory
    if (testNovelPath) {
      await fs.rm(testNovelPath, { recursive: true, force: true });
    }
  });

  it('calculates accurate word counts across manuscript', async () => {
    // Create multiple chapter files
    await fs.writeFile(
      path.join(manuscriptPath, 'chapter-1.md'),
      'This is chapter one with exactly ten words here.'
    );
    await fs.writeFile(
      path.join(manuscriptPath, 'chapter-2.md'),
      'Chapter two has five words.'
    );
    await fs.writeFile(
      path.join(manuscriptPath, 'chapter-3.md'),
      'Final chapter brings three more.'
    );

    // Calculate individual chapter counts
    const ch1Content = await fs.readFile(path.join(manuscriptPath, 'chapter-1.md'), 'utf-8');
    const ch2Content = await fs.readFile(path.join(manuscriptPath, 'chapter-2.md'), 'utf-8');
    const ch3Content = await fs.readFile(path.join(manuscriptPath, 'chapter-3.md'), 'utf-8');

    const ch1Count = calculateWordCount(ch1Content);
    const ch2Count = calculateWordCount(ch2Content);
    const ch3Count = calculateWordCount(ch3Content);

    expect(ch1Count).toBe(9); // Actual count
    expect(ch2Count).toBe(5);
    expect(ch3Count).toBe(5); // Actual count

    // Calculate total manuscript count
    const totalCount = await getManuscriptWordCount(testNovelPath);
    expect(totalCount).toBe(19); // Actual count based on word-count algorithm
  });

  it('excludes wiki pages from manuscript count', async () => {
    // Create manuscript chapters
    await fs.writeFile(
      path.join(manuscriptPath, 'chapter-1.md'),
      'Chapter with ten words in the manuscript directory.'
    );

    // Create wiki pages (should be excluded)
    await fs.writeFile(path.join(testNovelPath, 'wiki', 'character.md'),
      '# Character\n\nThis wiki page has many words that should not count.'
    );

    const manuscriptCount = await getManuscriptWordCount(testNovelPath);
    expect(manuscriptCount).toBe(8); // Actual count
  });

  it.skip('tracks words written today via git', async () => {
    // TODO: Implement getWordsWrittenToday in helper/src/stats/today-count.js
    // Create initial content and commit
    await fs.writeFile(
      path.join(manuscriptPath, 'chapter-1.md'),
      'Initial content with five words'
    );
    execSync('git add .', { cwd: testNovelPath, stdio: 'ignore' });
    execSync('git commit -m "Initial"', { cwd: testNovelPath, stdio: 'ignore' });

    // Add more content (simulating today's work)
    await fs.writeFile(
      path.join(manuscriptPath, 'chapter-1.md'),
      'Initial content with five words plus six more added today'
    );
    execSync('git add .', { cwd: testNovelPath, stdio: 'ignore' });
    execSync('git commit -m "Today work"', { cwd: testNovelPath, stdio: 'ignore' });

    // Get today's word count
    // const todayCount = await getWordsWrittenToday(testNovelPath);
    // expect(todayCount).toBeGreaterThan(0); // Added words
  });

  it('updates counts atomically after save', async () => {
    // Initial state
    await fs.writeFile(
      path.join(manuscriptPath, 'chapter-1.md'),
      'Start with ten words in this chapter document'
    );

    const initialCount = await getManuscriptWordCount(testNovelPath);
    expect(initialCount).toBe(8);

    // Simulate autosave - update file
    await fs.writeFile(
      path.join(manuscriptPath, 'chapter-1.md'),
      'Start with ten words in this chapter document plus additional content'
    );

    // Recalculate
    const updatedCount = await getManuscriptWordCount(testNovelPath);
    expect(updatedCount).toBeGreaterThan(initialCount);
  });

  it('handles empty chapters gracefully', async () => {
    await fs.writeFile(path.join(manuscriptPath, 'chapter-1.md'), '');
    await fs.writeFile(path.join(manuscriptPath, 'chapter-2.md'), '   \n\n  ');
    await fs.writeFile(path.join(manuscriptPath, 'chapter-3.md'), 'Only chapter with words');

    const manuscriptCount = await getManuscriptWordCount(testNovelPath);
    expect(manuscriptCount).toBe(4);
  });

  it('excludes markdown formatting from count', async () => {
    const content = `
# Heading One

This is **bold** and this is *italic* text.

\`\`\`javascript
const code = "should be excluded";
\`\`\`

Regular text here.

[Link text](http://example.com) should count display text only.
    `;

    await fs.writeFile(path.join(manuscriptPath, 'chapter-1.md'), content);

    const totalCount = await getManuscriptWordCount(testNovelPath);
    
    // Actual count based on markdown stripping algorithm
    expect(totalCount).toBe(20);
  });

  it('handles large manuscripts efficiently', async () => {
    // Create 50 chapters with 100 words each
    const createPromises = [];
    for (let i = 1; i <= 50; i++) {
      const content = Array(100).fill('word').join(' ');
      createPromises.push(
        fs.writeFile(path.join(manuscriptPath, `chapter-${i}.md`), content)
      );
    }

    await Promise.all(createPromises);

    const startTime = Date.now();
    const totalCount = await getManuscriptWordCount(testNovelPath);
    const duration = Date.now() - startTime;

    expect(totalCount).toBe(5000); // 50 * 100
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });
});
