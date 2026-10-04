import { test, expect } from '@playwright/test';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { launchElectronApp, closeElectronApp } from './helpers/electron-launcher.js';

let TEST_NOVEL_NAME;
let TEST_NOVEL_PATH;

// 1x1 transparent PNG
const DOT_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function createTestNovelWithEmbeds() {
  await fs.mkdir(path.join(TEST_NOVEL_PATH, 'manuscript'), { recursive: true });
  await fs.mkdir(path.join(TEST_NOVEL_PATH, 'wiki'), { recursive: true });
  await fs.mkdir(path.join(TEST_NOVEL_PATH, 'meta'), { recursive: true });

  await fs.writeFile(
    path.join(TEST_NOVEL_PATH, 'meta', 'index.json'),
    JSON.stringify({
      title: TEST_NOVEL_NAME,
      chapters: [],
      wiki: [{ slug: 'embeds', title: 'Embeds' }],
    }, null, 2)
  );

  await fs.writeFile(
    path.join(TEST_NOVEL_PATH, 'wiki', 'dot.png'),
    Buffer.from(DOT_PNG_BASE64, 'base64')
  );

  await fs.writeFile(
    path.join(TEST_NOVEL_PATH, 'wiki', 'embeds.md'),
    [
      '# Embeds',
      '',
      '![[dot.png|Test dot]]',
      '',
      '[[File:dot.png|File style]]',
      '',
      '![[../../secret.txt]]',
      '',
      '![[/etc/hosts]]',
      '',
      '![[%2e%2e/secret.txt]]',
      '',
    ].join('\n')
  );
}

async function openNovel(page) {
  const novelList = page.getByTestId('novel-list');
  await expect(novelList).toBeVisible({ timeout: 15000 });
  const novelItem = page.locator('.novel-list-item').filter({ hasText: TEST_NOVEL_NAME });
  await expect(novelItem).toBeVisible({ timeout: 10000 });
  await novelItem.locator('.novel-list-open').click();
  await expect(page.getByTestId('wiki-detach-button')).toBeVisible({ timeout: 10000 });
}

test.describe('Wiki Embeds E2E', () => {
  let app, page;

  test.beforeAll(async () => {
    TEST_NOVEL_NAME = `e2e-wiki-embeds-${Date.now()}`;
    TEST_NOVEL_PATH = path.join(os.homedir(), '.zuojia', TEST_NOVEL_NAME);
    await createTestNovelWithEmbeds();
  });

  test.beforeEach(async () => {
    ({ app, page } = await launchElectronApp());

    await page.evaluate(() => {
      window.localStorage.clear();
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await openNovel(page);
  });

  test.afterEach(async () => {
    if (app) await closeElectronApp(app);
  });

  test.afterAll(async () => {
    try { await fs.rm(TEST_NOVEL_PATH, { recursive: true, force: true }); } catch {}
  });

  test('legitimate image embeds render, traversal embeds are blocked', async () => {
    // Open the Embeds wiki page (preview mode is the default)
    await page.getByText('Embeds').first().click();
    const preview = page.locator('.wiki-preview-body');
    await expect(preview).toBeVisible({ timeout: 5000 });

    // Legit embeds: file:// imgs under the novel wiki dir
    const legitImgs = preview.locator('img[src*="dot.png"]');
    await expect(legitImgs.first()).toBeVisible({ timeout: 5000 });
    expect(await legitImgs.count()).toBe(2);
    for (const src of await legitImgs.evaluateAll((els) => els.map((e) => e.getAttribute('src')))) {
      expect(src.startsWith('file://')).toBe(true);
      expect(src).toContain('/wiki/dot.png');
      expect(src).not.toContain('..');
    }

    // Traversal / absolute / encoded-traversal embeds: no img, blocked placeholder instead
    const allSrcs = await preview.locator('img').evaluateAll((els) => els.map((e) => e.getAttribute('src')));
    for (const src of allSrcs) {
      expect(src).not.toContain('..');
      expect(src).not.toContain('/etc/');
      expect(src).not.toContain('secret');
    }
    const blocked = preview.locator('.wiki-embed-blocked');
    expect(await blocked.count()).toBe(3);
  });
});
