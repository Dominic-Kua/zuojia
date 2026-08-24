import { test, expect } from '@playwright/test';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { closeElectronApp, launchElectronApp } from './helpers/electron-launcher.js';

test.describe('Story 4.2: Manual Commit Flow', () => {
  let app;
  let page;
  let testNovelName;
  let testNovelPath;

  test.beforeEach(async () => {
    ({ app, page } = await launchElectronApp());

    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    testNovelName = `test-commit-${Date.now()}`;
    testNovelPath = path.join(os.homedir(), '.zuojia', testNovelName);

    const newNovelButton = page.getByTestId('new-novel-button');
    await expect(newNovelButton).toBeVisible({ timeout: 10000 });
    await newNovelButton.click();

    const dialog = page.getByTestId('create-novel-dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await page.getByTestId('novel-name-input').fill(testNovelName);
    await page.getByTestId('create-novel-button').click();
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
      // Ignore cleanup failures for temp novels.
    }
  });

  test('creates a manual commit with a pre-commit snapshot and updates sidebar history', async () => {
    await expect.poll(
      async () => {
        const chapterWrite = await page.evaluate(
          async ({ novelPath }) => window.electronAPI.invoke('helper:chapter:write', {
            novelPath,
            filename: 'chapter-01.md',
            content: '# Chapter 1\n\nSmoke test commit content',
          }),
          { novelPath: testNovelPath }
        );

        return chapterWrite.status;
      },
      {
        timeout: 10000,
        intervals: [250, 500, 1000],
      }
    ).toBe('ok');

    await page.getByTestId('commit-button').click();
    await expect(page.getByTestId('commit-dialog')).toBeVisible({ timeout: 5000 });

    const changedFile = page.getByLabel('manuscript/chapter-01.md');
    await expect(changedFile).toBeVisible({ timeout: 5000 });
    await expect(changedFile).toBeChecked();

    await page.getByTestId('commit-message-input').fill('Checkpoint save');
    await page.getByTestId('commit-confirm').click();

    await expect(page.getByTestId('commit-toast')).toContainText('Committed', { timeout: 5000 });
    await expect(page.getByTestId('commit-toast')).toContainText('Checkpoint save');

    await expect(page.getByTestId('commit-history-list')).toContainText('Checkpoint save', { timeout: 5000 });

    const logResult = await page.evaluate(
      async ({ novelPath }) => window.electronAPI.invoke('helper:git:history', { novelPath, limit: 1 }),
      { novelPath: testNovelPath }
    );

    expect(logResult.status).toBe('ok');
    expect(logResult.data.commits[0].message).toBe('Checkpoint save');

    const backupsDir = path.join(testNovelPath, 'meta', 'backups');
    const backupEntries = await fs.readdir(backupsDir);
    expect(backupEntries.length).toBeGreaterThan(0);
  });
});