import { test, expect } from '@playwright/test';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { execFileSync } from 'child_process';
import { launchElectronApp, closeElectronApp } from './helpers/electron-launcher.js';

let TEST_NOVEL_NAME;
let TEST_NOVEL_PATH;
let NON_GIT_NOVEL_NAME;
let NON_GIT_NOVEL_PATH;

async function createTestNovelWithGit() {
  await fs.mkdir(path.join(TEST_NOVEL_PATH, 'manuscript'), { recursive: true });
  await fs.mkdir(path.join(TEST_NOVEL_PATH, 'wiki'), { recursive: true });
  await fs.mkdir(path.join(TEST_NOVEL_PATH, 'meta'), { recursive: true });

  await fs.writeFile(
    path.join(TEST_NOVEL_PATH, 'meta', 'index.json'),
    JSON.stringify({
      title: TEST_NOVEL_NAME,
      chapters: ['chapter-01.md'],
      wiki: [
        { slug: 'hero', title: 'The Hero' },
      ],
    }, null, 2)
  );

  await fs.writeFile(
    path.join(TEST_NOVEL_PATH, 'wiki', 'hero.md'),
    '# The Hero\n\nA brave character.'
  );

  await fs.writeFile(
    path.join(TEST_NOVEL_PATH, 'manuscript', 'chapter-01.md'),
    '# Chapter 1\n\nOpening chapter.'
  );

  // Initialize git repo
  execFileSync('git', ['init'], { cwd: TEST_NOVEL_PATH, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: TEST_NOVEL_PATH, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: TEST_NOVEL_PATH, stdio: 'ignore' });
  execFileSync('git', ['add', '.'], { cwd: TEST_NOVEL_PATH, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: TEST_NOVEL_PATH, stdio: 'ignore' });
}

async function createNonGitTestNovel() {
  await fs.mkdir(path.join(NON_GIT_NOVEL_PATH, 'manuscript'), { recursive: true });
  await fs.mkdir(path.join(NON_GIT_NOVEL_PATH, 'wiki'), { recursive: true });
  await fs.mkdir(path.join(NON_GIT_NOVEL_PATH, 'meta'), { recursive: true });

  await fs.writeFile(
    path.join(NON_GIT_NOVEL_PATH, 'meta', 'index.json'),
    JSON.stringify({
      title: NON_GIT_NOVEL_NAME,
      chapters: [],
      wiki: [],
    }, null, 2)
  );

  await fs.writeFile(
    path.join(NON_GIT_NOVEL_PATH, 'manuscript', 'chapter-01.md'),
    '# Chapter 1\n\nTest.'
  );
}

async function openNovel(page) {
  const novelList = page.getByTestId('novel-list');
  await expect(novelList).toBeVisible({ timeout: 15000 });
  const novelItem = page.locator('.novel-list-item').filter({ hasText: TEST_NOVEL_NAME });
  await expect(novelItem).toBeVisible({ timeout: 10000 });
  const openButton = novelItem.locator('.novel-list-open');
  await openButton.click();
  
  // Wait for sidebar to load
  await expect(page.getByTestId('wiki-detach-button')).toBeVisible({ timeout: 10000 });
}

test.describe('Git Integration E2E', () => {
  let app, page;

  test.beforeAll(async () => {
    TEST_NOVEL_NAME = `e2e-git-integration-${Date.now()}`;
    TEST_NOVEL_PATH = path.join(os.homedir(), '.zuojia', TEST_NOVEL_NAME);
    NON_GIT_NOVEL_NAME = `e2e-non-git-${Date.now()}`;
    NON_GIT_NOVEL_PATH = path.join(os.homedir(), '.zuojia', NON_GIT_NOVEL_NAME);
    await createTestNovelWithGit();
    await createNonGitTestNovel();
  });

  test.beforeEach(async () => {
    ({ app, page } = await launchElectronApp());
    
    // Clear localStorage and reload to ensure clean state (wiki-detach-button
    // is hidden when wikiDetached=true from a prior session)
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
    try { await fs.rm(NON_GIT_NOVEL_PATH, { recursive: true, force: true }); } catch {}
  });

  test('sync status shows git repo info', async () => {
    // Wait for sidebar to be ready
    await expect(page.getByTestId('wiki-detach-button')).toBeVisible({ timeout: 10000 });
    
    // Branch should be visible for any git repo
    await expect(page.getByText(/Branch:/)).toBeVisible({ timeout: 5000 });
    
    // No remote configured should show (test repo has no remote)
    await expect(page.getByText('No remote configured')).toBeVisible({ timeout: 5000 });
  });

  test('dirty state indicator shows uncommitted changes', async () => {
    // Wait for sidebar to be ready
    await expect(page.getByTestId('wiki-detach-button')).toBeVisible({ timeout: 10000 });

    // Modify a file on disk to simulate an uncommitted change
    await fs.writeFile(
      path.join(TEST_NOVEL_PATH, 'manuscript', 'chapter-01.md'),
      '# Chapter 1\n\nModified content for dirty test.'
    );

    // Dirty state polls every 10s — wait for it to pick up the change
    await expect(page.getByText(/Uncommitted/)).toBeVisible({ timeout: 15000 });
  });

  test('git pull button not shown without remote', async () => {
    await expect(page.getByTestId('wiki-detach-button')).toBeVisible({ timeout: 10000 });
    
    // Pull button should NOT be visible (no remote configured)
    await expect(page.getByTestId('git-pull-button')).not.toBeVisible({ timeout: 3000 });
  });

  test('non-git repo shows proper state', async () => {
    // Close current novel and wait for the sidebar to fully disappear
    await page.getByTestId('close-novel-button').click();
    await expect(page.getByTestId('novel-list')).toBeVisible({ timeout: 10000 });
    
    // Open non-git novel
    const novelList = page.getByTestId('novel-list');
    await expect(novelList).toBeVisible({ timeout: 15000 });
    const novelItem = page.locator('.novel-list-item').filter({ hasText: NON_GIT_NOVEL_NAME });
    await expect(novelItem).toBeVisible({ timeout: 10000 });
    const openButton = novelItem.locator('.novel-list-open');
    await openButton.click();
    
    // Wait for sidebar to load
    await expect(page.getByRole('heading', { name: 'Wiki', exact: true })).toBeVisible({ timeout: 15000 });

    // Pull button should NOT be visible (no remote configured for non-git novel)
    await expect(page.getByTestId('git-pull-button')).not.toBeVisible({ timeout: 5000 });
  });
});