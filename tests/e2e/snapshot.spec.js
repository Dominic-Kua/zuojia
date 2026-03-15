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
    const editor = page.getByTestId('manuscript-editor');
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Set initial chapter content through the UI to avoid racing autosave.
    await editor.click();
    await page.keyboard.press('Meta+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('Original content.');
    await page.waitForTimeout(700);

    const snapshotResult = await page.evaluate(
      async ({ novelPath }) => window.electronAPI.invoke('helper:backup:createSnapshot', { novelPath, label: 'before-edit' }),
      { novelPath: testNovelPath }
    );
    expect(snapshotResult.status).toBe('ok');
    const { timestamp } = snapshotResult.data;

    // Overwrite chapter content via the UI to simulate later edits.
    await editor.click();
    await page.keyboard.press('Meta+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('Modified content.');
    await page.waitForTimeout(700);
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

test.describe('Story 4.1: Snapshot UI', () => {
  let app, page;
  let testNovelName;
  let testNovelPath;

  test.beforeEach(async () => {
    ({ app, page } = await launchElectronApp());

    testNovelName = `test-snapshot-ui-${Date.now()}`;
    testNovelPath = path.join(os.homedir(), '.netwriter', testNovelName);

    const newNovelButton = page.getByTestId('new-novel-button');
    await expect(newNovelButton).toBeVisible({ timeout: 10000 });
    await newNovelButton.click();

    const dialog = page.getByTestId('create-novel-dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const nameInput = page.getByTestId('novel-name-input');
    await nameInput.fill(testNovelName);

    await page.getByTestId('create-novel-button').click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test.afterEach(async () => {
    if (app) await closeElectronApp(app);
    try {
      await fs.rm(testNovelPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('snapshot button is visible in the manuscript toolbar', async () => {
    await expect(page.getByTestId('snapshot-button')).toBeVisible({ timeout: 5000 });
  });

  test('clicking snapshot button opens the dialog', async () => {
    await page.getByTestId('snapshot-button').click();
    await expect(page.getByTestId('snapshot-dialog')).toBeVisible({ timeout: 3000 });
  });

  test('dialog has a label input, submit, and cancel buttons', async () => {
    await page.getByTestId('snapshot-button').click();
    await expect(page.getByTestId('snapshot-label-input')).toBeVisible();
    await expect(page.getByTestId('snapshot-submit-button')).toBeVisible();
    await expect(page.getByTestId('snapshot-cancel-button')).toBeVisible();
  });

  test('cancel button closes the dialog without creating a snapshot', async () => {
    await page.getByTestId('snapshot-button').click();
    await page.getByTestId('snapshot-cancel-button').click();
    await expect(page.getByTestId('snapshot-dialog')).not.toBeVisible({ timeout: 3000 });

    const list = await page.evaluate(
      async ({ novelPath }) => window.electronAPI.invoke('helper:backup:listSnapshots', { novelPath }),
      { novelPath: testNovelPath }
    );
    expect(list.data.snapshots).toHaveLength(0);
  });

  test('submitting dialog with a label creates a snapshot and shows toast', async () => {
    await page.getByTestId('snapshot-button').click();
    await page.getByTestId('snapshot-label-input').fill('UI Test Snapshot');
    await page.getByTestId('snapshot-submit-button').click();

    // Dialog should close and toast appear
    await expect(page.getByTestId('snapshot-dialog')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('toast')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('toast-message')).toContainText('UI Test Snapshot');

    // Snapshot must exist on disk
    const list = await page.evaluate(
      async ({ novelPath }) => window.electronAPI.invoke('helper:backup:listSnapshots', { novelPath }),
      { novelPath: testNovelPath }
    );
    expect(list.data.snapshots).toHaveLength(1);
    expect(list.data.snapshots[0].label).toBe('UI Test Snapshot');
  });

  test('submitting dialog without a label creates a snapshot and shows toast', async () => {
    await page.getByTestId('snapshot-button').click();
    // No label filled in
    await page.getByTestId('snapshot-submit-button').click();

    await expect(page.getByTestId('snapshot-dialog')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('toast')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('toast-message')).toContainText('Snapshot created');
  });

  test('manage button opens the snapshot manager panel', async () => {
    await page.getByTestId('snapshot-manage-button').click();
    await expect(page.getByTestId('snapshot-manager')).toBeVisible({ timeout: 3000 });
  });

  test('snapshot manager lists existing snapshots', async () => {
    // Create a snapshot via IPC first
    await page.evaluate(
      async ({ novelPath }) => window.electronAPI.invoke('helper:backup:createSnapshot', { novelPath, label: 'Manager test' }),
      { novelPath: testNovelPath }
    );

    await page.getByTestId('snapshot-manage-button').click();
    await expect(page.getByTestId('snapshot-manager')).toBeVisible({ timeout: 3000 });

    // Wait for at least one entry
    await expect(page.locator('[data-testid^="snapshot-entry-"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('snapshot manager close button closes the panel', async () => {
    await page.getByTestId('snapshot-manage-button').click();
    await expect(page.getByTestId('snapshot-manager')).toBeVisible({ timeout: 3000 });

    await page.getByTestId('snapshot-manager-close').click();
    await expect(page.getByTestId('snapshot-manager')).not.toBeVisible({ timeout: 3000 });
  });
});

