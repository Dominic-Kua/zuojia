/**
 * Additional edge case and boundary tests for completed features
 * These tests focus on scenarios that might not be covered in the main test suites
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { mkdir, rm, writeFile, chmod } from 'fs/promises';
import { createNovel, readChapter, writeChapter, rebuildIndex } from '../src/index/index.js';
import { createWikiPage, updateWikiPage, generateSlug } from '../src/wiki/crud.js';
import { rebuildSpellcheckDict } from '../src/wiki/rebuild-dict.js';
import { calculateWordCount } from '../src/stats/word-count.js';

const TEST_DIR = path.join(process.cwd(), 'test-edge-cases-' + Date.now());

describe('Edge Cases and Boundary Tests', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  describe('Novel Creation Edge Cases', () => {
    it('should handle very long novel names (up to 255 chars)', async () => {
      const longName = 'a'.repeat(255);
      const result = await createNovel(longName, TEST_DIR);
      
      expect(result.status).toBe('ok');
    });

    it('should reject novel names over 255 characters', async () => {
      const tooLongName = 'a'.repeat(256);
      const result = await createNovel(tooLongName, TEST_DIR);
      
      expect(result.status).toBe('error');
    });

    it('should handle novel names with only whitespace', async () => {
      const result = await createNovel('   ', TEST_DIR);
      
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('INVALID_NOVEL_NAME');
    });

    it('should handle novel names with leading/trailing whitespace', async () => {
      const result = await createNovel('  My Novel  ', TEST_DIR);
      
      expect(result.status).toBe('ok');
      // Should trim whitespace
      expect(result.data.novelPath).not.toContain('  ');
    });

    it('should handle novel names with unicode characters', async () => {
      const unicodeName = '小説-Роман-رواية';
      const result = await createNovel(unicodeName, TEST_DIR);
      
      expect(result.status).toBe('ok');
    });

    it('should handle novel names with emojis', async () => {
      const emojiName = 'My Novel 📖✨';
      const result = await createNovel(emojiName, TEST_DIR);
      
      expect(result.status).toBe('ok');
    });

    it('should handle numeric-only novel names', async () => {
      const result = await createNovel('12345', TEST_DIR);
      
      expect(result.status).toBe('ok');
    });

    it('should handle novel names with dots', async () => {
      const result = await createNovel('my.novel.v2', TEST_DIR);
      
      expect(result.status).toBe('ok');
    });
  });

  describe('Chapter Content Edge Cases', () => {
    let novelPath;

    beforeEach(async () => {
      const result = await createNovel('test-novel', TEST_DIR);
      novelPath = result.data.novelPath;
    });

    it('should handle empty chapter content', async () => {
      const result = await writeChapter(novelPath, 'empty.md', '');
      
      expect(result.status).toBe('ok');
      
      const readResult = await readChapter(novelPath, 'empty.md');
      expect(readResult.data.content).toBe('');
    });

    it('should handle very large chapter content (1MB+)', async () => {
      // Generate 1MB of content
      const largeContent = 'Lorem ipsum dolor sit amet. '.repeat(40000); // ~1.1MB
      
      const result = await writeChapter(novelPath, 'large.md', largeContent);
      
      expect(result.status).toBe('ok');
      
      const readResult = await readChapter(novelPath, 'large.md');
      expect(readResult.data.content).toBe(largeContent);
    });

    it('should handle chapter content with only newlines', async () => {
      const result = await writeChapter(novelPath, 'newlines.md', '\n\n\n\n\n');
      
      expect(result.status).toBe('ok');
    });

    it('should handle chapter content with null bytes', async () => {
      const contentWithNull = 'Content\x00with\x00null';
      const result = await writeChapter(novelPath, 'null.md', contentWithNull);
      
      expect(result.status).toBe('ok');
    });

    it('should handle chapter content with all unicode categories', async () => {
      const unicodeContent = `
        Latin: Hello World
        CJK: 你好世界 こんにちは世界
        Arabic: مرحبا بالعالم
        Emoji: 🌍🌎🌏
        Math: ∑∫∂∇
        Symbols: ™®©
      `;
      
      const result = await writeChapter(novelPath, 'unicode.md', unicodeContent);
      
      expect(result.status).toBe('ok');
      
      const readResult = await readChapter(novelPath, 'unicode.md');
      expect(readResult.data.content).toBe(unicodeContent);
    });

    it('should handle chapter content with Windows line endings (CRLF)', async () => {
      const crlfContent = 'Line 1\r\nLine 2\r\nLine 3';
      const result = await writeChapter(novelPath, 'crlf.md', crlfContent);
      
      expect(result.status).toBe('ok');
    });

    it('should handle chapter content with mixed line endings', async () => {
      const mixedContent = 'Line 1\nLine 2\r\nLine 3\rLine 4';
      const result = await writeChapter(novelPath, 'mixed.md', mixedContent);
      
      expect(result.status).toBe('ok');
    });
  });

  describe('Wiki Slug Generation Edge Cases', () => {
    it('should handle titles with only special characters', async () => {
      const slug = generateSlug('!!!???@@@');
      
      expect(slug).toBeTruthy();
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    });

    it('should handle titles with mixed scripts', async () => {
      const slug = generateSlug('Hello世界مرحبا');
      
      expect(slug).toBeTruthy();
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    });

    it('should handle very long titles (500+ chars)', async () => {
      const longTitle = 'This is a very long title '.repeat(20);
      const slug = generateSlug(longTitle);
      
      // Should preserve full length (user decision: don't truncate)
      expect(slug.length).toBeGreaterThan(400);
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    });

    it('should handle titles with consecutive spaces', async () => {
      const slug = generateSlug('Alice    the    Protagonist');
      
      expect(slug).toBe('alice-the-protagonist');
      // Should not have consecutive hyphens
      expect(slug).not.toContain('--');
    });

    it('should handle titles starting/ending with spaces', async () => {
      const slug = generateSlug('   Alice   ');
      
      expect(slug).toBe('alice');
      expect(slug).not.toMatch(/^-/);
      expect(slug).not.toMatch(/-$/);
    });

    it('should handle titles with numbers', async () => {
      const slug = generateSlug('Chapter 42');
      
      expect(slug).toBe('chapter-42');
    });

    it('should handle titles that are already valid slugs', async () => {
      const slug = generateSlug('already-a-slug');
      
      expect(slug).toBe('already-a-slug');
    });
  });

  describe('Word Count Edge Cases', () => {
    it('should handle extremely long words (1000+ chars)', async () => {
      const longWord = 'a'.repeat(1000);
      const count = calculateWordCount(longWord);
      
      expect(count).toBe(1);
    });

    it('should handle text with only numbers', async () => {
      const numbers = '123 456 789 012 345';
      const count = calculateWordCount(numbers);
      
      expect(count).toBe(5);
    });

    it('should handle text with mixture of languages', async () => {
      const mixed = 'Hello world 你好世界 مرحبا';
      const count = calculateWordCount(mixed);
      
      // Should count all segments
      expect(count).toBeGreaterThan(0);
    });

    it('should handle text with only punctuation', async () => {
      const punctuation = '!!! ??? ... --- +++';
      const count = calculateWordCount(punctuation);
      
      expect(count).toBe(0);
    });

    it('should handle text with markdown tables', async () => {
      const table = `
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
      `;
      const count = calculateWordCount(table);
      
      // Should count words in table
      expect(count).toBeGreaterThan(0);
    });

    it('should handle text with repeated words', async () => {
      const repeated = 'word word word word word';
      const count = calculateWordCount(repeated);
      
      expect(count).toBe(5);
    });

    it('should handle text with contractions and possessives', async () => {
      const text = "I'm Bob's friend. We're going to Alice's place.";
      const count = calculateWordCount(text);
      
      // Contractions should count as single words
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('Spellcheck Dictionary Edge Cases', () => {
    let novelPath;

    beforeEach(async () => {
      const result = await createNovel('test-novel', TEST_DIR);
      novelPath = result.data.novelPath;
    });

    it('should handle wiki page with extremely long title', async () => {
      const longTitle = 'The Very Long Title That Goes On And On And Contains Many Words That Will Be Extracted Into The Spellcheck Dictionary';
      await createWikiPage(novelPath, longTitle, '# ' + longTitle + '\n\nContent');
      
      const result = await rebuildSpellcheckDict(novelPath);
      
      expect(result.status).toBe('ok');
      expect(result.data.words.length).toBeGreaterThan(10);
    });

    it('should handle wiki page titles with numbers', async () => {
      await createWikiPage(novelPath, 'Chapter 42', '# Chapter 42\n\nContent');
      
      const result = await rebuildSpellcheckDict(novelPath);
      
      expect(result.status).toBe('ok');
      expect(result.data.words).toContain('Chapter');
      expect(result.data.words).toContain('42');
    });

    it('should handle wiki page titles with hyphens', async () => {
      await createWikiPage(novelPath, 'Spider-Man', '# Spider-Man\n\nContent');
      
      const result = await rebuildSpellcheckDict(novelPath);
      
      expect(result.status).toBe('ok');
      // Should preserve hyphenated words or split them
      expect(result.data.words.length).toBeGreaterThan(0);
    });

    it('should handle wiki page titles with apostrophes', async () => {
      await createWikiPage(novelPath, "Bob's Place", "# Bob's Place\n\nContent");
      
      const result = await rebuildSpellcheckDict(novelPath);
      
      expect(result.status).toBe('ok');
      expect(result.data.words.length).toBeGreaterThan(0);
    });

    it('should handle duplicate words across multiple pages', async () => {
      await createWikiPage(novelPath, 'Alice the Hero', '# Alice the Hero\n\nContent');
      await createWikiPage(novelPath, 'Alice the Brave', '# Alice the Brave\n\nContent');
      
      const result = await rebuildSpellcheckDict(novelPath);
      
      expect(result.status).toBe('ok');
      // Should deduplicate common words
      const aliceCount = result.data.words.filter(w => w === 'Alice').length;
      expect(aliceCount).toBe(1);
    });

    it('should handle wiki pages with no H1 heading', async () => {
      const slug = generateSlug('No Heading Page');
      const wikiPath = path.join(novelPath, 'wiki', slug + '.md');
      await mkdir(path.join(novelPath, 'wiki'), { recursive: true });
      await writeFile(wikiPath, 'Just content without a title heading');
      
      const result = await rebuildSpellcheckDict(novelPath);
      
      // Should handle gracefully, may return empty dictionary
      expect(result.status).toBe('ok');
    });

    it('should handle wiki pages with multiple H1 headings', async () => {
      const slug = generateSlug('Multiple Headings');
      const wikiPath = path.join(novelPath, 'wiki', slug + '.md');
      await mkdir(path.join(novelPath, 'wiki'), { recursive: true });
      await writeFile(wikiPath, '# First Title\n\nContent\n\n# Second Title\n\nMore content');
      
      const result = await rebuildSpellcheckDict(novelPath);
      
      expect(result.status).toBe('ok');
      // Should use first H1
      expect(result.data.words).toContain('First');
    });
  });

  describe('Index Rebuild Edge Cases', () => {
    let novelPath;

    beforeEach(async () => {
      const result = await createNovel('test-novel', TEST_DIR);
      novelPath = result.data.novelPath;
    });

    it('should handle many chapters (1000+)', async () => {
      const manuscriptDir = path.join(novelPath, 'manuscript');
      
      // Create 1000 empty chapters
      const createPromises = [];
      for (let i = 0; i < 1000; i++) {
        const filename = `chapter-${i.toString().padStart(4, '0')}.md`;
        createPromises.push(
          writeFile(path.join(manuscriptDir, filename), `# Chapter ${i}\n\nContent`)
        );
      }
      await Promise.all(createPromises);
      
      const startTime = Date.now();
      const result = await rebuildIndex(novelPath);
      const endTime = Date.now();
      
      expect(result.status).toBe('ok');
      expect(result.data.chapters).toHaveLength(1000);
      // Should complete in reasonable time (per acceptance criteria: <100ms for 100-200 chapters)
      // For 1000 chapters, allow up to 2000ms (machine-agnostic threshold)
      expect(endTime - startTime).toBeLessThan(2000);
    });

    it('should handle chapters with no content', async () => {
      await writeChapter(novelPath, 'empty.md', '');
      
      const result = await rebuildIndex(novelPath);
      
      expect(result.status).toBe('ok');
      const emptyChapter = result.data.chapters.find(c => c.filename === 'empty.md');
      expect(emptyChapter).toBeDefined();
      expect(emptyChapter.wordCount).toBe(0);
    });

    it('should handle chapters with very long titles', async () => {
      const longTitle = '# ' + 'Long Title Word '.repeat(50);
      await writeChapter(novelPath, 'long-title.md', longTitle + '\n\nContent');
      
      const result = await rebuildIndex(novelPath);
      
      expect(result.status).toBe('ok');
      const chapter = result.data.chapters.find(c => c.filename === 'long-title.md');
      expect(chapter).toBeDefined();
      expect(chapter.title.length).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Operations', () => {
    let novelPath;

    beforeEach(async () => {
      const result = await createNovel('test-novel', TEST_DIR);
      novelPath = result.data.novelPath;
    });

    it('should handle concurrent chapter writes', async () => {
      const writes = [];
      for (let i = 0; i < 10; i++) {
        writes.push(
          writeChapter(novelPath, `chapter-${i}.md`, `# Chapter ${i}\n\nContent ${i}`)
        );
      }
      
      const results = await Promise.all(writes);
      
      results.forEach(result => {
        expect(result.status).toBe('ok');
      });
    });

    it('should handle concurrent wiki page creation', async () => {
      const creates = [];
      for (let i = 0; i < 10; i++) {
        creates.push(
          createWikiPage(novelPath, `Page ${i}`, `# Page ${i}\n\nContent ${i}`)
        );
      }
      
      const results = await Promise.all(creates);
      
      results.forEach(result => {
        expect(result.status).toBe('ok');
      });
    });

    it('should handle concurrent index rebuilds', async () => {
      const rebuilds = [];
      for (let i = 0; i < 5; i++) {
        rebuilds.push(rebuildIndex(novelPath));
      }
      
      const results = await Promise.all(rebuilds);
      
      // At least some should succeed
      const successCount = results.filter(r => r.status === 'ok').length;
      expect(successCount).toBeGreaterThan(0);
    });
  });
});
