/**
 * Tests for wiki page CRUD operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  createWikiPage, 
  readWikiPage, 
  updateWikiPage, 
  deleteWikiPage,
  renameWikiPage 
} from '../src/wiki/crud.js';
import { listWikiPages } from '../src/wiki/list-pages.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Wiki CRUD Operations', () => {
  let testDir;

  beforeEach(async () => {
    // Create temp directory structure
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ä½å®¶-test-'));
    await fs.mkdir(path.join(testDir, 'wiki'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'meta'), { recursive: true });
  });

  afterEach(async () => {
    // Clean up
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('createWikiPage', () => {
    it('creates a new wiki page with slug from title', async () => {
      const result = await createWikiPage(testDir, 'Alice the Protagonist', '# Alice\n\nMain character.');

      expect(result.status).toBe('ok');
      expect(result.data.slug).toBe('alice-the-protagonist');
      
      // Verify file exists
      const filePath = path.join(testDir, 'wiki', 'alice-the-protagonist.md');
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('generates slug from title with special characters', async () => {
      const result = await createWikiPage(testDir, 'Bob\'s Place (The Tavern)', '# Bob\'s Place');

      expect(result.data.slug).toBe('bobs-place-the-tavern');
    });

    it('generates slug with only alphanumeric and hyphens', async () => {
      const result = await createWikiPage(testDir, 'City #1: New York!', '# City');

      expect(result.data.slug).toBe('city-1-new-york');
    });

    it('writes content to wiki file', async () => {
      const content = '# Alice\n\nProtagonist of the story.';
      await createWikiPage(testDir, 'Alice', content);

      const filePath = path.join(testDir, 'wiki', 'alice.md');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      expect(fileContent).toBe(content);
    });

    it('returns error if slug already exists', async () => {
      await createWikiPage(testDir, 'Alice', '# Alice');
      
      const result = await createWikiPage(testDir, 'Alice', '# Alice 2');
      
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('WIKI_PAGE_EXISTS');
    });

    it('returns error if title is empty', async () => {
      const result = await createWikiPage(testDir, '', '# Content');
      
      expect(result.status).toBe('error');
      expect(result.error.code).toBe('INVALID_TITLE');
    });

    it('returns error if novel path does not exist', async () => {
      const result = await createWikiPage('/nonexistent/path', 'Test', '# Test');
      
      expect(result.status).toBe('error');
    });
  });

  describe('readWikiPage', () => {
    it('reads existing wiki page content', async () => {
      const content = '# Alice\n\nMain character details.';
      await createWikiPage(testDir, 'Alice', content);

      const result = await readWikiPage(testDir, 'alice');

      expect(result.status).toBe('ok');
      expect(result.data.content).toBe(content);
    });

    it('returns error if page does not exist', async () => {
      const result = await readWikiPage(testDir, 'nonexistent');

      expect(result.status).toBe('error');
      expect(result.error.code).toBe('WIKI_PAGE_NOT_FOUND');
    });

    it('prevents path traversal attacks', async () => {
      const result = await readWikiPage(testDir, '../../../etc/passwd');

      expect(result.status).toBe('error');
      expect(result.error.code).toBe('INVALID_SLUG');
    });
  });

  describe('updateWikiPage', () => {
    it('updates existing wiki page content', async () => {
      await createWikiPage(testDir, 'Alice', '# Alice\n\nOriginal content.');

      const newContent = '# Alice\n\nUpdated content with more details.';
      const result = await updateWikiPage(testDir, 'alice', newContent);

      expect(result.status).toBe('ok');

      // Verify content was updated
      const readResult = await readWikiPage(testDir, 'alice');
      expect(readResult.data.content).toBe(newContent);
    });

    it('returns error if page does not exist', async () => {
      const result = await updateWikiPage(testDir, 'nonexistent', '# Test');

      expect(result.status).toBe('error');
      expect(result.error.code).toBe('WIKI_PAGE_NOT_FOUND');
    });

    it('cleans up temp file if rename fails', async () => {
      await createWikiPage(testDir, 'Alice', '# Alice\n\nOriginal content.');

      const renameSpy = vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('rename failed'));

      try {
        const result = await updateWikiPage(testDir, 'alice', '# Alice\n\nNew content.');

        expect(result.status).toBe('error');

        // Verify temp file was cleaned up
        const filePath = path.join(testDir, 'wiki', 'alice.md');
        const tempPath = `${filePath}.tmp`;
        const tempExists = await fs.access(tempPath).then(() => true).catch(() => false);
        expect(tempExists).toBe(false);
      } finally {
        renameSpy.mockRestore();
      }
    });
  });

  describe('deleteWikiPage', () => {
    it('deletes existing wiki page', async () => {
      await createWikiPage(testDir, 'Alice', '# Alice');

      const result = await deleteWikiPage(testDir, 'alice');

      expect(result.status).toBe('ok');

      // Verify file was deleted
      const filePath = path.join(testDir, 'wiki', 'alice.md');
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('returns error if page does not exist', async () => {
      const result = await deleteWikiPage(testDir, 'nonexistent');

      expect(result.status).toBe('error');
      expect(result.error.code).toBe('WIKI_PAGE_NOT_FOUND');
    });
  });

  describe('renameWikiPage', () => {
    it('renames wiki page with new slug', async () => {
      await createWikiPage(testDir, 'Alice', '# Alice\n\nContent.');

      const result = await renameWikiPage(testDir, 'alice', 'Alice the Hero');

      expect(result.status).toBe('ok');
      expect(result.data.newSlug).toBe('alice-the-hero');

      // Verify old file deleted
      const oldPath = path.join(testDir, 'wiki', 'alice.md');
      const oldExists = await fs.access(oldPath).then(() => true).catch(() => false);
      expect(oldExists).toBe(false);

      // Verify new file exists
      const newPath = path.join(testDir, 'wiki', 'alice-the-hero.md');
      const newExists = await fs.access(newPath).then(() => true).catch(() => false);
      expect(newExists).toBe(true);
    });

    it('preserves content when renaming', async () => {
      await createWikiPage(testDir, 'Alice', '# Alice\n\nOriginal content.');

      await renameWikiPage(testDir, 'alice', 'Alice Updated');

      const readResult = await readWikiPage(testDir, 'alice-updated');
      expect(readResult.data.content).toBe('# Alice Updated\n\nOriginal content.');
    });

    it('returns error if old page does not exist', async () => {
      const result = await renameWikiPage(testDir, 'nonexistent', 'New Name');

      expect(result.status).toBe('error');
      expect(result.error.code).toBe('WIKI_PAGE_NOT_FOUND');
    });

    it('returns error if new slug already exists', async () => {
      await createWikiPage(testDir, 'Alice', '# Alice');
      await createWikiPage(testDir, 'Bob', '# Bob');

      const result = await renameWikiPage(testDir, 'alice', 'Bob');

      expect(result.status).toBe('error');
      expect(result.error.code).toBe('WIKI_PAGE_EXISTS');
    });
  });
});

describe('listWikiPages', () => {
  let testDir;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ä½å®¶-test-'));
    await fs.mkdir(path.join(testDir, 'wiki'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('returns empty array when no wiki pages exist', async () => {
    const result = await listWikiPages(testDir);

    expect(result.status).toBe('ok');
    expect(result.data.pages).toEqual([]);
  });

  it('lists all wiki pages in directory', async () => {
    await createWikiPage(testDir, 'Alice', '# Alice\n\nContent.');
    await createWikiPage(testDir, 'Bob', '# Bob\n\nContent.');
    await createWikiPage(testDir, 'Charlie', '# Charlie\n\nContent.');

    const result = await listWikiPages(testDir);

    expect(result.status).toBe('ok');
    expect(result.data.pages).toHaveLength(3);
    expect(result.data.pages.map(p => p.slug)).toContain('alice');
    expect(result.data.pages.map(p => p.slug)).toContain('bob');
    expect(result.data.pages.map(p => p.slug)).toContain('charlie');
  });

  it('extracts title from first H1 in markdown', async () => {
    await createWikiPage(testDir, 'Alice', '# Alice the Protagonist\n\nContent.');

    const result = await listWikiPages(testDir);

    const alice = result.data.pages.find(p => p.slug === 'alice');
    expect(alice.title).toBe('Alice the Protagonist');
  });

  it('uses filename as title if no H1 found', async () => {
    await createWikiPage(testDir, 'Alice', 'Content without heading.');

    const result = await listWikiPages(testDir);

    const alice = result.data.pages.find(p => p.slug === 'alice');
    expect(alice.title).toBe('alice');
  });

  it('includes word count for each page', async () => {
    await createWikiPage(testDir, 'Alice', '# Alice\n\nThis is a test with ten words here now.');

    const result = await listWikiPages(testDir);

    const alice = result.data.pages.find(p => p.slug === 'alice');
    expect(alice.wordCount).toBeGreaterThan(0);
  });

  it('includes last modified timestamp', async () => {
    await createWikiPage(testDir, 'Alice', '# Alice\n\nContent.');

    const result = await listWikiPages(testDir);

    const alice = result.data.pages.find(p => p.slug === 'alice');
    expect(alice.lastModified).toBeDefined();
    expect(typeof alice.lastModified).toBe('string');
  });

  it('sorts pages alphabetically by title', async () => {
    await createWikiPage(testDir, 'Charlie', '# Charlie\n\nC');
    await createWikiPage(testDir, 'Alice', '# Alice\n\nA');
    await createWikiPage(testDir, 'Bob', '# Bob\n\nB');

    const result = await listWikiPages(testDir);

    const titles = result.data.pages.map(p => p.title);
    expect(titles).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('excludes non-markdown files', async () => {
    await createWikiPage(testDir, 'Alice', '# Alice');
    await fs.writeFile(path.join(testDir, 'wiki', 'notes.txt'), 'Text file');
    await fs.writeFile(path.join(testDir, 'wiki', 'image.jpg'), 'Binary');

    const result = await listWikiPages(testDir);

    expect(result.data.pages).toHaveLength(1);
    expect(result.data.pages[0].slug).toBe('alice');
  });

  it('excludes hidden files', async () => {
    await createWikiPage(testDir, 'Alice', '# Alice');
    await fs.writeFile(path.join(testDir, 'wiki', '.hidden.md'), '# Hidden');

    const result = await listWikiPages(testDir);

    expect(result.data.pages).toHaveLength(1);
    expect(result.data.pages[0].slug).toBe('alice');
  });
});
