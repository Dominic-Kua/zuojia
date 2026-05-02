import { test, expect } from '@playwright/test';
import { launchElectronApp, closeElectronApp } from './helpers/electron-launcher.js';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

/**
 * E2E tests for Story 7.2: Restore via DiagnosticsPanel UI
 *
 * These tests create a real novel via the UI, then exercise the restore flow
 * through the Diagnostics panel UI (button → confirmation dialog → restore).
 * Filesystem assertions confirm that the manuscript is rolled back correctly.
 */

test.describe('Story 7.2: Restore via DiagnosticsPanel', () => {
  let app, page;
  let testNovelName;
  let testNovelPath;

  test.beforeEach(async () => {
    ({ app, page } = await launchElectronApp());

    testNovelName = `test-diagnostics-restore-${Date.now()}`;
    testNovelPath = path.join(os.homedir(), '.zuojia', testNovelName);

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

  test('should restore a snapshot via the Diagnostics UI and reload the editor', async () => {
    const chapterFile = path.join(testNovelPath, 'manuscript', 'chapter-01.md');
    const editor = page.getByTestId('manuscript-editor');
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Write original content through the UI and wait for autosave
    await editor.click();
    await page.keyboard.press('Meta+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('Original content.');
    await page.waitForTimeout(700);
    expect(await fs.readFile(chapterFile, 'utf-8')).toContain('Original content');

    // Create a snapshot through the IPC API
    const snapshotResult = await page.evaluate(
      async ({ novelPath }) =>
        window.electronAPI.invoke('helper:backup:createSnapshot', { novelPath, label: 'before-edit' }),
      { novelPath: testNovelPath }
    );
    expect(snapshotResult.status).toBe('ok');

    // Overwrite chapter content to simulate later edits
    await editor.click();
    await page.keyboard.press('Meta+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('Modified content.');
    await page.waitForTimeout(700);
    expect(await fs.readFile(chapterFile, 'utf-8')).toContain('Modified content');

    // Open the Diagnostics panel
    const diagnosticsButton = page.getByTestId('diagnostics-button');
    await expect(diagnosticsButton).toBeVisible({ timeout: 5000 });
    await diagnosticsButton.click();

    const diagnosticsDialog = page.getByTestId('diagnostics-dialog');
    await expect(diagnosticsDialog).toBeVisible({ timeout: 5000 });

    // Find and click the restore button for the snapshot
    const { timestamp } = snapshotResult.data;
    const restoreButton = page.getByTestId(`diagnostics-restore-backup-${timestamp}`);
    await expect(restoreButton).toBeVisible({ timeout: 5000 });
    await restoreButton.click();

    // Confirmation dialog must appear
    const confirmDialog = page.getByTestId('restore-confirm-dialog');
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    // Clicking the backdrop should dismiss the dialog
    await page.getByTestId('restore-confirm-overlay').click({ position: { x: 5, y: 5 } });
    await expect(confirmDialog).not.toBeVisible({ timeout: 3000 });

    // Re-open the restore confirmation for the actual restore
    await restoreButton.click();
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    // Confirm restore without a safety backup
    await page.getByTestId('restore-confirm-no').click();

    // The toast should confirm the restore
    await expect(page.getByTestId('restore-toast')).toBeVisible({ timeout: 10000 });

    // The manuscript file on disk must be back to the original content
    const restoredContent = await fs.readFile(chapterFile, 'utf-8');
    expect(restoredContent).toContain('Original content');
  });

  test('should restore with a pre-restore safety backup when "Yes — Back Up First" is chosen', async () => {
    const editor = page.getByTestId('manuscript-editor');
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Create a snapshot through the IPC API
    const snapshotResult = await page.evaluate(
      async ({ novelPath }) =>
        window.electronAPI.invoke('helper:backup:createSnapshot', { novelPath, label: 'safety-test' }),
      { novelPath: testNovelPath }
    );
    expect(snapshotResult.status).toBe('ok');
    const { timestamp } = snapshotResult.data;

    // Open the Diagnostics panel and restore with safety backup
    await page.getByTestId('diagnostics-button').click();
    await expect(page.getByTestId('diagnostics-dialog')).toBeVisible({ timeout: 5000 });

    await page.getByTestId(`diagnostics-restore-backup-${timestamp}`).click();
    await expect(page.getByTestId('restore-confirm-dialog')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('restore-confirm-yes').click();

    // Toast confirms success
    await expect(page.getByTestId('restore-toast')).toBeVisible({ timeout: 10000 });

    // The snapshot list must contain a second entry (the pre-restore safety backup)
    const listResult = await page.evaluate(
      async ({ novelPath }) =>
        window.electronAPI.invoke('helper:backup:listSnapshots', { novelPath }),
      { novelPath: testNovelPath }
    );
    expect(listResult.status).toBe('ok');
    expect(listResult.data.snapshots.length).toBeGreaterThanOrEqual(2);
    const labels = listResult.data.snapshots.map((s) => s.label);
    expect(labels).toContain('pre-restore safety backup');
  });
});
