import { test, expect } from '@playwright/test';
import { launchElectronApp, closeElectronApp } from './helpers/electron-launcher.js';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

/**
 * E2E tests for Story 4.1: Snapshot (Local Backup)
 *
 * These tests create a real novel via the UI, then exercise snapshot operations
 * through the IPC API (window.electronAPI.invoke). Filesystem assertions confirm
 * that backup directories and restored file contents are correct.
 */

test.describe('Story 4.1: Snapshot (Local Backup)', () => {
  let app, page;
  let testNovelName;
  let testNovelPath;

  /** Launch the app and create a fresh test novel before each test. */
  test.beforeEach(async () => {
    ({ app, page } = await launchElectronApp());

    testNovelName = `test-snapshot-${Date.now()}`;
    testNovelPath = path.join(os.homedir(), '.netwriter', testNovelName);

    const newNovelButton = page.getByTestId('new-novel-button');
    await expect(newNovelButton).toBeVisible({ timeout: 10000 });
    await newNovelButton.click();

    const dialog = page.getByTestId('create-novel-dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const nameInput = page.getByTestId('novel-name-input');
    await nameInput.fill(testNovelName);

    const createButton = page.getByTestId('create-novel-button');
    await createButton.click();

    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    const novelExists = await fs.access(testNovelPath).then(() => true).catch(() => false);
    expect(novelExists).toBe(true);
  });

  test.afterEach(async () => {
    if (app) {
      await closeElectronApp(app);
    }
    try {
      await fs.rm(testNovelPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('should create a snapshot with a label', async () => {
    const result = await page.evaluate(
      async ({ novelPath, label }) => window.electronAPI.invoke('helper:backup:createSnapshot', { novelPath, label }),
      { novelPath: testNovelPath, label: 'End of Chapter 5' }
    );

    expect(result.status).toBe('ok');
    expect(result.data.label).toBe('End of Chapter 5');
    expect(result.data.timestamp).toBeDefined();

    // Snapshot directory must exist on disk and contain the sanitised label
    const snapshotExists = await fs.access(result.data.path).then(() => true).catch(() => false);
    expect(snapshotExists).toBe(true);
    expect(result.data.path).toContain('End_of_Chapter_5');

    // Manifest must be written with correct metadata
    const manifest = JSON.parse(
      await fs.readFile(path.join(result.data.path, 'snapshot-manifest.json'), 'utf-8')
    );
    expect(manifest.label).toBe('End of Chapter 5');
    expect(manifest.novelPath).toBe(testNovelPath);
  });

  test('should create a snapshot without a label', async () => {
    const result = await page.evaluate(
      async ({ novelPath }) => window.electronAPI.invoke('helper:backup:createSnapshot', { novelPath }),
      { novelPath: testNovelPath }
    );

    expect(result.status).toBe('ok');
    expect(result.data.label).toBeNull();
    expect(result.data.timestamp).toBeDefined();

    // Directory name should be the timestamp only (no hyphen suffix)
    const dirName = path.basename(result.data.path);
    expect(dirName).toBe(result.data.timestamp.toString());
  });

  test('should list snapshots sorted newest first', async () => {
    // Create two snapshots sequentially; natural IPC round-trip latency provides
    // sufficient timestamp separation without an explicit sleep.
    const first = await page.evaluate(
      async ({ novelPath }) => window.electronAPI.invoke('helper:backup:createSnapshot', { novelPath, label: 'first' }),
      { novelPath: testNovelPath }
    );
    expect(first.status).toBe('ok');

    const second = await page.evaluate(
      async ({ novelPath }) => window.electronAPI.invoke('helper:backup:createSnapshot', { novelPath, label: 'second' }),
      { novelPath: testNovelPath }
    );
    expect(second.status).toBe('ok');

    const listResult = await page.evaluate(
      async ({ novelPath }) => window.electronAPI.invoke('helper:backup:listSnapshots', { novelPath }),
      { novelPath: testNovelPath }
    );

    expect(listResult.status).toBe('ok');
    expect(listResult.data.snapshots).toHaveLength(2);

    // List must be sorted newest-first (timestamps non-increasing)
    const timestamps = listResult.data.snapshots.map((s) => s.timestamp);
    expect(timestamps[0]).toBeGreaterThanOrEqual(timestamps[1]);

    // Each entry must carry essential metadata
    for (const snap of listResult.data.snapshots) {
      expect(snap.timestamp).toBeDefined();
      expect(snap.label).toBeDefined();
      expect(snap.size).toBeGreaterThan(0);
      expect(snap.created).toBeDefined();
    }
  });

  test('should restore a snapshot, reverting manuscript changes', async () => {
    const chapterFile = path.join(testNovelPath, 'manuscript', 'chapter-01.md');
    const originalContent = '# Chapter 1\n\nOriginal content.';

    // Write an initial chapter file and create a snapshot
    await fs.writeFile(chapterFile, originalContent, 'utf-8');

    const snapshotResult = await page.evaluate(
      async ({ novelPath }) => window.electronAPI.invoke('helper:backup:createSnapshot', { novelPath, label: 'before-edit' }),
      { novelPath: testNovelPath }
    );
    expect(snapshotResult.status).toBe('ok');
    const { timestamp } = snapshotResult.data;

    // Overwrite the chapter to simulate later edits
    await fs.writeFile(chapterFile, '# Chapter 1\n\nModified content.', 'utf-8');
    expect(await fs.readFile(chapterFile, 'utf-8')).toContain('Modified content');

    // Restore the snapshot
    const restoreResult = await page.evaluate(
      async ({ novelPath, snapshotId }) => window.electronAPI.invoke('helper:backup:restore', { novelPath, snapshotId }),
      { novelPath: testNovelPath, snapshotId: timestamp }
    );
    expect(restoreResult.status).toBe('ok');
    expect(restoreResult.data.restored).toBe(true);

    // Chapter must be back to the snapshotted version
    const restored = await fs.readFile(chapterFile, 'utf-8');
    expect(restored).toContain('Original content');

    // Backups directory must still exist after restore
    const backupsDir = path.join(testNovelPath, 'meta', 'backups');
    const backupsExist = await fs.access(backupsDir).then(() => true).catch(() => false);
    expect(backupsExist).toBe(true);
  });

  test('should delete a snapshot and remove it from the list', async () => {
    const snapshotResult = await page.evaluate(
      async ({ novelPath }) => window.electronAPI.invoke('helper:backup:createSnapshot', { novelPath, label: 'to-delete' }),
      { novelPath: testNovelPath }
    );
    expect(snapshotResult.status).toBe('ok');
    const { timestamp, path: snapshotPath } = snapshotResult.data;

    // Snapshot directory must exist before deletion
    expect(await fs.access(snapshotPath).then(() => true).catch(() => false)).toBe(true);

    const deleteResult = await page.evaluate(
      async ({ novelPath, timestamp }) => window.electronAPI.invoke('helper:backup:deleteSnapshot', { novelPath, timestamp }),
      { novelPath: testNovelPath, timestamp }
    );
    expect(deleteResult.status).toBe('ok');
    expect(deleteResult.data.deleted).toBe(true);

    // Directory must no longer exist on disk
    expect(await fs.access(snapshotPath).then(() => true).catch(() => false)).toBe(false);

    // List must now be empty
    const listResult = await page.evaluate(
      async ({ novelPath }) => window.electronAPI.invoke('helper:backup:listSnapshots', { novelPath }),
      { novelPath: testNovelPath }
    );
    expect(listResult.data.snapshots).toHaveLength(0);
  });

  test('should return an error when snapshot creation fails', async () => {
    // Make the meta directory read-only to trigger a write failure
    const metaDir = path.join(testNovelPath, 'meta');
    await fs.chmod(metaDir, 0o444);

    let result;
    try {
      result = await page.evaluate(
        async ({ novelPath }) => window.electronAPI.invoke('helper:backup:createSnapshot', { novelPath, label: 'fail-test' }),
        { novelPath: testNovelPath }
      );
    } finally {
      // Restore permissions so afterEach cleanup can remove the directory
      await fs.chmod(metaDir, 0o755);
    }

    expect(result.status).toBe('error');
    expect(result.error).toBeDefined();
    expect(result.error.code).toBeDefined();
  });

  test('should include manuscript, wiki and meta directories in the snapshot', async () => {
    // Create test content in all three directories
    await fs.writeFile(path.join(testNovelPath, 'manuscript', 'chapter-01.md'), '# Chapter 1');
    await fs.mkdir(path.join(testNovelPath, 'wiki'), { recursive: true });
    await fs.writeFile(path.join(testNovelPath, 'wiki', 'alice.md'), '# Alice');

    const result = await page.evaluate(
      async ({ novelPath }) => window.electronAPI.invoke('helper:backup:createSnapshot', { novelPath, label: 'all-dirs' }),
      { novelPath: testNovelPath }
    );
    expect(result.status).toBe('ok');

    const snapshotPath = result.data.path;

    // All three directories must be present in the snapshot
    for (const dir of ['manuscript', 'wiki', 'meta']) {
      const dirExists = await fs.access(path.join(snapshotPath, dir)).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);
    }

    // Specific files must have been copied
    const chapterCopied = await fs.access(path.join(snapshotPath, 'manuscript', 'chapter-01.md')).then(() => true).catch(() => false);
    expect(chapterCopied).toBe(true);

    const wikiCopied = await fs.access(path.join(snapshotPath, 'wiki', 'alice.md')).then(() => true).catch(() => false);
    expect(wikiCopied).toBe(true);
  });

  test('should create unique snapshot directories for rapid successive snapshots', async () => {
    // Create two snapshots in quick succession
    const [r1, r2] = await Promise.all([
      page.evaluate(
        async ({ novelPath }) => window.electronAPI.invoke('helper:backup:createSnapshot', { novelPath, label: 'snap-a' }),
        { novelPath: testNovelPath }
      ),
      page.evaluate(
        async ({ novelPath }) => window.electronAPI.invoke('helper:backup:createSnapshot', { novelPath, label: 'snap-b' }),
        { novelPath: testNovelPath }
      ),
    ]);

    expect(r1.status).toBe('ok');
    expect(r2.status).toBe('ok');

    // Paths must be different even when created simultaneously
    expect(r1.data.path).not.toBe(r2.data.path);

    // Both snapshot directories must exist on disk
    const [e1, e2] = await Promise.all([
      fs.access(r1.data.path).then(() => true).catch(() => false),
      fs.access(r2.data.path).then(() => true).catch(() => false),
    ]);
    expect(e1).toBe(true);
    expect(e2).toBe(true);
  });
});

