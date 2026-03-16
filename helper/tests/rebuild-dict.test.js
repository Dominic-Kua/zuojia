/**
 * Tests for spellcheck dictionary rebuild
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rebuildSpellcheckDict } from '../src/wiki/rebuild-dict.js';
import { createWikiPage } from '../src/wiki/crud.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Spellcheck Dictionary Rebuild', () => {
  let testDir;

  beforeEach(async () => {
    // Create temp directory structure
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ä½å®¶-spellcheck-test-'));
    await fs.mkdir(path.join(testDir, 'wiki'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'meta'), { recursive: true });
  });

  afterEach(async () => {
    // Clean up
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('rebuildSpellcheckDict', () => {
    it('creates empty dictionary when no wiki pages exist', async () => {
      const result = await rebuildSpellcheckDict(testDir);

      expect(result.status).toBe('ok');
      expect(result.data.count).toBe(0);
      expect(result.data.words).toEqual([]);

      // Verify file was created
      const dictPath = path.join(testDir, 'meta', 'spellcheck-dict.json');
      const file = await fs.readFile(dictPath, 'utf-8');
      const dict = JSON.parse(file);
      expect(dict.words).toEqual([]);
      expect(dict.timestamp).toBeDefined();
    });

    it('extracts wiki page titles into dictionary', async () => {
      // Create some wiki pages with proper H1 headings
      await createWikiPage(testDir, 'Alice the Protagonist', '# Alice the Protagonist\n\nMain character.');
      await createWikiPage(testDir, 'Frodo Baggins', '# Frodo Baggins\n\nHobbit hero.');
      await createWikiPage(testDir, 'The Shire', '# The Shire\n\nHobbit homeland.');

      const result = await rebuildSpellcheckDict(testDir);

      expect(result.status).toBe('ok');
      expect(result.data.count).toBe(7); // Alice, the, Protagonist, Frodo, Baggins, The, Shire
      expect(result.data.words).toContain('Alice');
      expect(result.data.words).toContain('the');
      expect(result.data.words).toContain('Protagonist');
      expect(result.data.words).toContain('Frodo');
      expect(result.data.words).toContain('Baggins');
      expect(result.data.words).toContain('The');
      expect(result.data.words).toContain('Shire');
    });

    it('normalizes words by splitting on whitespace and punctuation', async () => {
      await createWikiPage(testDir, "Bob's Place (The Tavern)", "# Bob's Place (The Tavern)\n\nContent");

      const result = await rebuildSpellcheckDict(testDir);

      expect(result.status).toBe('ok');
      // Should extract individual words: Bob, Place, The, Tavern  
      // (punctuation removed but word boundaries preserved)
      expect(result.data.words).toContain('Bob');
      expect(result.data.words).toContain('Place');
      expect(result.data.words).toContain('The');
      expect(result.data.words).toContain('Tavern');
    });

    it('deduplicates words from multiple titles', async () => {
      await createWikiPage(testDir, 'Alice', '# Alice\n\nContent1');
      await createWikiPage(testDir, 'Alice and Bob', '# Alice and Bob\n\nContent2');

      const result = await rebuildSpellcheckDict(testDir);

      const aliceCount = result.data.words.filter(w => w === 'Alice').length;
      expect(aliceCount).toBe(1); // Should appear only once
    });

    it('writes dictionary in correct format', async () => {
      await createWikiPage(testDir, 'Mordor', 'content');
      await createWikiPage(testDir, 'Aragorn', 'content');

      await rebuildSpellcheckDict(testDir);

      const dictPath = path.join(testDir, 'meta', 'spellcheck-dict.json');
      const file = await fs.readFile(dictPath, 'utf-8');
      const dict = JSON.parse(file);

      expect(dict).toHaveProperty('words');
      expect(dict).toHaveProperty('timestamp');
      expect(dict).toHaveProperty('count');
      expect(Array.isArray(dict.words)).toBe(true);
      expect(dict.count).toBe(dict.words.length);
    });

    it('handles wiki directory not existing', async () => {
      const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ä½å®¶-empty-'));
      await fs.mkdir(path.join(emptyDir, 'meta'), { recursive: true });
      // Don't create wiki directory

      const result = await rebuildSpellcheckDict(emptyDir);

      expect(result.status).toBe('ok');
      expect(result.data.count).toBe(0);

      await fs.rm(emptyDir, { recursive: true, force: true });
    });

    it('returns error if novel path does not exist', async () => {
      const result = await rebuildSpellcheckDict('/nonexistent/path');

      expect(result.status).toBe('error');
    });

    it('updates existing dictionary', async () => {
      // Create initial pages
      await createWikiPage(testDir, 'Alice', '# Alice\n\nContent');
      await rebuildSpellcheckDict(testDir);

      // Add new page
      await createWikiPage(testDir, 'Bob', '# Bob\n\nContent');
      const result = await rebuildSpellcheckDict(testDir);

      expect(result.data.count).toBe(2);
      expect(result.data.words).toContain('Alice');
      expect(result.data.words).toContain('Bob');
    });

    it('includes timestamp in dictionary', async () => {
      await rebuildSpellcheckDict(testDir);

      const dictPath = path.join(testDir, 'meta', 'spellcheck-dict.json');
      const file = await fs.readFile(dictPath, 'utf-8');
      const dict = JSON.parse(file);

      expect(dict.timestamp).toBeDefined();
      expect(typeof dict.timestamp).toBe('number');
      expect(dict.timestamp).toBeGreaterThan(0);
    });
  });
});
