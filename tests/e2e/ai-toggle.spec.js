import { test, expect } from '@playwright/test';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { launchElectronApp, closeElectronApp } from './helpers/electron-launcher.js';

let TEST_NOVEL_NAME;
let TEST_NOVEL_PATH;

async function createTestNovel() {
  await fs.mkdir(path.join(TEST_NOVEL_PATH, 'manuscript'), { recursive: true });
  await fs.mkdir(path.join(TEST_NOVEL_PATH, 'wiki'), { recursive: true });
  await fs.mkdir(path.join(TEST_NOVEL_PATH, 'meta'), { recursive: true });

  await fs.writeFile(
    path.join(TEST_NOVEL_PATH, 'meta', 'index.json'),
    JSON.stringify({
      title: TEST_NOVEL_NAME,
      chapters: ['chapter-01.md'],
      wiki: [],
    }, null, 2)
  );

  await fs.writeFile(
    path.join(TEST_NOVEL_PATH, 'manuscript', 'chapter-01.md'),
    '# Chapter 1\n\nOpening chapter.'
  );
}

async function openNovel(page) {
  const novelList = page.getByTestId('novel-list');
  await expect(novelList).toBeVisible({ timeout: 15000 });
  const novelItem = page.locator('.novel-list-item').filter({ hasText: TEST_NOVEL_NAME });
  await expect(novelItem).toBeVisible({ timeout: 10000 });
  await novelItem.locator('.novel-list-open').click();
  // Sidebar ready signals the novel is open
  await expect(page.getByTestId('wiki-detach-button')).toBeVisible({ timeout: 10000 });
}

test.describe('AI Toggle E2E', () => {
  let app, page;

  test.beforeAll(async () => {
    TEST_NOVEL_NAME = `e2e-ai-toggle-${Date.now()}`;
    TEST_NOVEL_PATH = path.join(os.homedir(), '.zuojia', TEST_NOVEL_NAME);
    await createTestNovel();
  });

  test.beforeEach(async () => {
    ({ app, page } = await launchElectronApp());

    // Clear localStorage and reload to ensure clean state
    await page.evaluate(() => {
      window.localStorage.clear();
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    if (app) await closeElectronApp(app);
  });

  test.afterAll(async () => {
    try { await fs.rm(TEST_NOVEL_PATH, { recursive: true, force: true }); } catch {}
  });

  test('toggle defaults to on with chat visible', async () => {
    const toggle = page.getByTestId('ai-toggle-button');
    await expect(toggle).toBeVisible({ timeout: 5000 });
    await expect(toggle).toHaveText('AI On');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await openNovel(page);
    await expect(page.getByTestId('llm-chat-button')).toBeVisible({ timeout: 10000 });
  });

  test('toggling off hides chat and persists across reload', async () => {
    await openNovel(page);

    const toggle = page.getByTestId('ai-toggle-button');
    await toggle.click();
    await expect(toggle).toHaveText('AI Off');
    await expect(page.getByTestId('llm-chat-button')).not.toBeVisible({ timeout: 5000 });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('ai-toggle-button')).toHaveText('AI Off');
  });

  test('toggling back on restores chat', async () => {
    await openNovel(page);

    const toggle = page.getByTestId('ai-toggle-button');
    await toggle.click();
    await expect(page.getByTestId('llm-chat-button')).not.toBeVisible({ timeout: 5000 });

    await toggle.click();
    await expect(toggle).toHaveText('AI On');
    await expect(page.getByTestId('llm-chat-button')).toBeVisible({ timeout: 10000 });
  });
});
