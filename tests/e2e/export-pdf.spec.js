import { test, expect } from '@playwright/test';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { execFileSync } from 'child_process';
import { closeElectronApp, launchElectronApp } from './helpers/electron-launcher.js';

test.describe('Story 5.1: PDF Export', () => {
  let app;
  let page;
  let testNovelName;
  let testNovelPath;
  let tempBinDir;

  test.beforeEach(async () => {
    tempBinDir = path.join(os.tmpdir(), `zuojia-export-bin-${Date.now()}`);
    await fs.mkdir(tempBinDir, { recursive: true });

    const pandocPath = execFileSync('bash', ['-lc', 'command -v pandoc'], { encoding: 'utf-8' }).trim();
    const nodePath = execFileSync('bash', ['-lc', 'command -v node'], { encoding: 'utf-8' }).trim();
    await fs.symlink(pandocPath, path.join(tempBinDir, 'pandoc'));

    ({ app, page } = await launchElectronApp({
      env: {
        PATH: `${tempBinDir}:${path.dirname(nodePath)}:/usr/bin:/bin`,
      },
    }));

    testNovelName = `test-export-${Date.now()}`;
    testNovelPath = path.join(os.homedir(), '.zuojia', testNovelName);

    const newNovelButton = page.getByTestId('new-novel-button');
    await expect(newNovelButton).toBeVisible({ timeout: 10000 });
    await newNovelButton.click();

    const dialog = page.getByTestId('create-novel-dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await page.getByTestId('novel-name-input').fill(testNovelName);
    await page.getByTestId('create-novel-button').click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    const chapterWrite = await page.evaluate(
      async ({ novelPath }) => window.electronAPI.invoke('helper:chapter:write', {
        novelPath,
        filename: 'chapter-01.md',
        content: '# Chapter 1\n\nExport me',
      }),
      { novelPath: testNovelPath }
    );

    expect(chapterWrite.status).toBe('ok');
    await page.evaluate(
      async ({ novelPath }) => window.electronAPI.invoke('helper:index:rebuild', { novelPath }),
      { novelPath: testNovelPath }
    );
  });

  test.afterEach(async () => {
    if (app) {
      await closeElectronApp(app);
    }

    await fs.rm(testNovelPath, { recursive: true, force: true }).catch(() => {});
    await fs.rm(tempBinDir, { recursive: true, force: true }).catch(() => {});
  });

  test('shows dependency guidance when TeX is unavailable', async () => {
    await page.getByTestId('export-button').click();
    await expect(page.getByTestId('export-dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('export-chapter-list')).toContainText('Chapter 1');

    await page.getByTestId('export-confirm').click();

    await expect(page.getByTestId('export-error')).toContainText('TeX');
    await expect(page.getByTestId('export-error')).toContainText('mactex-no-gui');
  });

  test('shows empty state when no export logs exist', async () => {
    await page.getByTestId('export-button').click();
    await expect(page.getByTestId('export-dialog')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('export-view-logs-button').click();

    const logsPanel = page.getByTestId('export-logs-panel');
    await expect(logsPanel).toBeVisible({ timeout: 3000 });
    await expect(logsPanel).toContainText('No export logs yet.');
  });

  test('shows log entries when export logs exist on disk', async () => {
    // Pre-seed a log file so we can verify the UI without running a real export
    const logsDir = path.join(testNovelPath, 'meta', 'logs');
    await fs.mkdir(logsDir, { recursive: true });
    await fs.writeFile(
      path.join(logsDir, 'export-2026-04-01T00-00-00-000Z.log'),
      'command: pandoc ...\nexit: 0',
      'utf-8'
    );

    await page.getByTestId('export-button').click();
    await expect(page.getByTestId('export-dialog')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('export-view-logs-button').click();

    const logsPanel = page.getByTestId('export-logs-panel');
    await expect(logsPanel).toBeVisible({ timeout: 3000 });
    await expect(logsPanel).toContainText('export-2026-04-01T00-00-00-000Z.log');
  });
});