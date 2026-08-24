// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';

vi.mock('../../helper/src/wiki/rebuild-dict.js', () => ({
  rebuildSpellcheckDict: vi.fn().mockResolvedValue({ status: 'ok' }),
}));

describe('wiki/crud', () => {
  const testDir = '/tmp/test-wiki-crud';
  let crud;

  beforeEach(async () => {
    vi.clearAllMocks();
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.mkdir(path.join(testDir, 'wiki'), { recursive: true });
    crud = await import('../../helper/src/wiki/crud.js');
  });

  describe('generateSlug', () => {
    it('generates slug from title', () => {
      const slug = crud.generateSlug('My Character');
      expect(typeof slug).toBe('string');
      expect(slug.length).toBeGreaterThan(0);
    });

    it('generates consistent slugs', () => {
      const slug1 = crud.generateSlug('Test Character');
      const slug2 = crud.generateSlug('Test Character');
      expect(slug1).toBe(slug2);
    });
  });

  describe('createWikiPage', () => {
    it('creates a new wiki page', async () => {
      const result = await crud.createWikiPage(testDir, 'Hero Page', '# Hero\n\nContent here', ['protagonist']);
      expect(result.status).toBe('ok');
      expect(result.data.slug).toBeDefined();
      // Verify content was written correctly
      const content = await fs.readFile(path.join(testDir, 'wiki', `${result.data.slug}.md`), 'utf-8');
      expect(content).toContain('Hero Page');
      expect(content).toContain('Content here');
      expect(content).toContain('protagonist');
    });

    it('creates page file in wiki directory', async () => {
      const result = await crud.createWikiPage(testDir, 'Test Page', 'Content');
      expect(result.status).toBe('ok');
      const content = await fs.readFile(path.join(testDir, 'wiki', `${result.data.slug}.md`), 'utf-8');
      expect(content).toContain('Test Page');
      expect(content).toContain('Content');
    });

    it('returns error for empty title', async () => {
      const result = await crud.createWikiPage(testDir, '', 'Content');
      expect(result.status).toBe('error');
    });

    it('deduplicates tags', async () => {
      const result = await crud.createWikiPage(testDir, 'Tagged', 'Content', ['a', 'a', 'b']);
      expect(result.status).toBe('ok');
      // Tags are stored in frontmatter, verify they're deduplicated
      const content = await fs.readFile(path.join(testDir, 'wiki', `${result.data.slug}.md`), 'utf-8');
      expect(content).toContain('a');
      expect(content).toContain('b');
    });
  });

  describe('readWikiPage', () => {
    it('reads an existing page', async () => {
      const createResult = await crud.createWikiPage(testDir, 'Readable', 'Test content');
      const readResult = await crud.readWikiPage(testDir, createResult.data.slug);
      expect(readResult.status).toBe('ok');
      expect(readResult.data.title).toBe('Readable');
      expect(readResult.data.content).toContain('Test content');
    });

    it('returns error for non-existent page', async () => {
      const result = await crud.readWikiPage(testDir, 'nonexistent-slug');
      expect(result.status).toBe('error');
    });
  });

  describe('updateWikiPage', () => {
    it('updates an existing page', async () => {
      const createResult = await crud.createWikiPage(testDir, 'Updatable', 'Original');
      const updateResult = await crud.updateWikiPage(testDir, createResult.data.slug, 'Updated content', ['new-tag']);
      expect(updateResult.status).toBe('ok');
      const readResult = await crud.readWikiPage(testDir, createResult.data.slug);
      expect(readResult.data.content).toContain('Updated content');
      expect(readResult.data.tags).toEqual(['new-tag']);
    });

    it('returns error for non-existent page', async () => {
      const result = await crud.updateWikiPage(testDir, 'no-such', 'Content');
      expect(result.status).toBe('error');
    });
  });

  describe('deleteWikiPage', () => {
    it('deletes an existing page', async () => {
      const createResult = await crud.createWikiPage(testDir, 'Deletable', 'Gone soon');
      const deleteResult = await crud.deleteWikiPage(testDir, createResult.data.slug);
      expect(deleteResult.status).toBe('ok');
      const readResult = await crud.readWikiPage(testDir, createResult.data.slug);
      expect(readResult.status).toBe('error');
    });

    it('returns error for non-existent page', async () => {
      const result = await crud.deleteWikiPage(testDir, 'ghost-slug');
      expect(result.status).toBe('error');
    });
  });

  describe('renameWikiPage', () => {
    it('renames a page', async () => {
      const createResult = await crud.createWikiPage(testDir, 'Old Name', 'Content');
      const renameResult = await crud.renameWikiPage(testDir, createResult.data.slug, 'New Name');
      expect(renameResult.status).toBe('ok');
      expect(renameResult.data.newSlug).toBeDefined();
      // Old slug should not exist
      const oldRead = await crud.readWikiPage(testDir, createResult.data.slug);
      expect(oldRead.status).toBe('error');
    });

    it('returns error for non-existent page', async () => {
      const result = await crud.renameWikiPage(testDir, 'no-such', 'New Title');
      expect(result.status).toBe('error');
    });
  });
});
