import { test, expect } from '@playwright/test';
import { launchElectronApp, closeElectronApp } from './helpers/electron-launcher.js';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

async function createNovelThroughUI(page, novelName) {
  await page.getByTestId('new-novel-button').click();
  const dialog = page.getByTestId('create-novel-dialog');
  await expect(dialog).toBeVisible({ timeout: 5000 });
  await page.getByTestId('novel-name-input').fill(novelName);
  await page.getByTestId('create-novel-button').click();
  await expect(dialog).not.toBeVisible({ timeout: 10000 });
}

test.describe('Story Map E2E', () => {
  let app;
  let page;
  let storymapPage;
  let testNovelName;
  let testNovelPath;

  test.beforeEach(async () => {
    ({ app, page } = await launchElectronApp());
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    testNovelName = `test-storymap-${Date.now()}`;
    testNovelPath = path.join(os.homedir(), '.zuojia', testNovelName);

    await createNovelThroughUI(page, testNovelName);
  });

  test.afterEach(async () => {
    if (app) {
      await closeElectronApp(app);
    }
    try {
      await fs.rm(testNovelPath, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  test('opens the story map window without import errors', async () => {
    // Catch any runtime errors in the storymap window.
    const errors = [];

    page.on('dialog', async (dialog) => {
      // Default to accepting any unexpected native dialogs so tests don't hang.
      await dialog.accept();
    });

    const storymapWindowPromise = app.waitForEvent('window', { timeout: 10000 });
    await page.getByTestId('open-storymap-button').click();
    storymapPage = await storymapWindowPromise;

    storymapPage.on('pageerror', (err) => errors.push(err.message));
    storymapPage.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await expect(storymapPage.locator('[data-testid="storymap-window"]')).toBeVisible({ timeout: 10000 });
    await storymapPage.waitForTimeout(500);

    expect(errors).toEqual([]);
  });

  test('adds a scene and persists it to storymap.json', async () => {
    const storymapWindowPromise = app.waitForEvent('window', { timeout: 10000 });
    await page.getByTestId('open-storymap-button').click();
    storymapPage = await storymapWindowPromise;

    // Stub the date prompt so the test does not depend on native dialog handling.
    await storymapPage.evaluate(() => {
      window.prompt = () => '2026-01-01';
    });

    await expect(storymapPage.locator('[data-testid="storymap-empty-state"]')).toBeVisible({ timeout: 10000 });
    await storymapPage.getByTestId('storymap-add-scene-button').click();

    // Wait for persistence debounce and file write.
    const storymapPath = path.join(testNovelPath, 'meta', 'storymap.json');
    await expect.poll(async () => {
      try {
        const data = await fs.readFile(storymapPath, 'utf-8');
        const parsed = JSON.parse(data);
        return parsed.scenes?.length ?? 0;
      } catch {
        return 0;
      }
    }, { timeout: 10000 }).toBe(1);

    const storymapContent = await fs.readFile(storymapPath, 'utf-8');
    const storymap = JSON.parse(storymapContent);
    expect(storymap.scenes[0]).toMatchObject({
      title: expect.stringContaining('Scene'),
      chronologyDate: '2026-01-01',
    });
  });
});
