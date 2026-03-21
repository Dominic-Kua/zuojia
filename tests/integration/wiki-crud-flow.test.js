/**
 * Integration Test: Wiki CRUD Flow
 * Tests the complete wiki page lifecycle from creation to deletion
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createWikiPage, readWikiPage, updateWikiPage, deleteWikiPage } from '../../helper/src/wiki/crud.js';
import { listWikiPages } from '../../helper/src/wiki/list-pages.js';

describe('Wiki CRUD Integration Flow', () => {
  let testNovelPath;

  beforeEach(async () => {
    // Create temporary novel directory
    testNovelPath = path.join(os.tmpdir(), `zuojia-test-${Date.now()}`);
    await fs.mkdir(path.join(testNovelPath, 'wiki'), { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    if (testNovelPath) {
      await fs.rm(testNovelPath, { recursive: true, force: true });
    }
  });

  it('completes full wiki CRUD lifecycle', async () => {
    // 1. CREATE: Create a new wiki page
    const createResult = await createWikiPage(
      testNovelPath,
      'Alice the Protagonist',
      '# Alice the Protagonist\n\nMain character of the story.'
    );

    expect(createResult.status).toBe('ok');
    expect(createResult.data.slug).toBe('alice-the-protagonist');

    // Verify file exists on disk
    const wikiPath = path.join(testNovelPath, 'wiki', 'alice-the-protagonist.md');
    const fileExists = await fs.access(wikiPath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    // 2. READ: Read the created page
    const readResult = await readWikiPage(testNovelPath, 'alice-the-protagonist');
    expect(readResult.status).toBe('ok');
    expect(readResult.data.content).toContain('Main character');

    // 3. LIST: Verify page appears in list
    const listResult = await listWikiPages(testNovelPath);
    expect(listResult.status).toBe('ok');
    expect(listResult.data.pages).toHaveLength(1);
    expect(listResult.data.pages[0].slug).toBe('alice-the-protagonist');
    expect(listResult.data.pages[0].title).toBe('Alice the Protagonist');

    // 4. UPDATE: Modify the page
    const updateResult = await updateWikiPage(
      testNovelPath,
      'alice-the-protagonist',
      '# Alice the Protagonist\n\nMain character. Age: 25.'
    );
    expect(updateResult.status).toBe('ok');

    // Verify update persisted
    const readAfterUpdate = await readWikiPage(testNovelPath, 'alice-the-protagonist');
    expect(readAfterUpdate.data.content).toContain('Age: 25');

    // 5. CREATE MORE: Add another page
    await createWikiPage(
      testNovelPath,
      'Wonderland',
      '# Wonderland\n\nThe magical setting.'
    );

    // Verify list now has 2 pages
    const list2 = await listWikiPages(testNovelPath);
    expect(list2.data.pages).toHaveLength(2);

    // 6. DELETE: Remove a page
    const deleteResult = await deleteWikiPage(testNovelPath, 'alice-the-protagonist');
    expect(deleteResult.status).toBe('ok');

    // Verify file deleted from disk
    const fileExistsAfterDelete = await fs.access(wikiPath).then(() => true).catch(() => false);
    expect(fileExistsAfterDelete).toBe(false);

    // Verify list now has 1 page
    const list3 = await listWikiPages(testNovelPath);
    expect(list3.data.pages).toHaveLength(1);
    expect(list3.data.pages[0].slug).toBe('wonderland');
  });

  it('handles errors gracefully in flow', async () => {
    // Try to read non-existent page
    const readResult = await readWikiPage(testNovelPath, 'non-existent');
    expect(readResult.status).toBe('error');
    expect(readResult.error).toBeTruthy();

    // Try to update non-existent page
    const updateResult = await updateWikiPage(testNovelPath, 'non-existent', 'content');
    expect(updateResult.status).toBe('error');

    // Try to delete non-existent page
    const deleteResult = await deleteWikiPage(testNovelPath, 'non-existent');
    expect(deleteResult.status).toBe('error');

    // Try to create page with empty title
    const createResult = await createWikiPage(testNovelPath, '', 'content');
    expect(createResult.status).toBe('error');
    expect(createResult.error).toBeTruthy();
  });

  it('handles concurrent operations correctly', async () => {
    // Create multiple pages concurrently
    const createPromises = [
      createWikiPage(testNovelPath, 'Page 1', '# Page 1'),
      createWikiPage(testNovelPath, 'Page 2', '# Page 2'),
      createWikiPage(testNovelPath, 'Page 3', '# Page 3'),
    ];

    const results = await Promise.all(createPromises);
    expect(results.every(r => r.status === 'ok')).toBe(true);

    // Verify all pages exist
    const listResult = await listWikiPages(testNovelPath);
    expect(listResult.data.pages).toHaveLength(3);
  });

  it('preserves data integrity during update failures', async () => {
    // Create a page
    await createWikiPage(testNovelPath, 'Test Page', '# Original Content');

    // Mock file system to simulate failure during update
    const originalContent = await readWikiPage(testNovelPath, 'test-page');

    // Attempt update with simulated failure (invalid path)
    const updateResult = await updateWikiPage(testNovelPath + '/invalid', 'test-page', 'New Content');
    expect(updateResult.status).toBe('error');

    // Verify original content still intact
    const contentAfterFailure = await readWikiPage(testNovelPath, 'test-page');
    expect(contentAfterFailure.data.content).toBe(originalContent.data.content);
  });
});
