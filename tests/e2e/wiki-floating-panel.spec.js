import { test, expect } from '@playwright/test';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { launchElectronApp, closeElectronApp } from './helpers/electron-launcher.js';

const TEST_NOVEL_NAME = `e2e-wiki-floating-${Date.now()}`;
const TEST_NOVEL_PATH = path.join(os.homedir(), '.zuojia', TEST_NOVEL_NAME);

async function createTestNovelWithWiki() {
  await fs.mkdir(path.join(TEST_NOVEL_PATH, 'manuscript'), { recursive: true });
  await fs.mkdir(path.join(TEST_NOVEL_PATH, 'wiki'), { recursive: true });
  await fs.mkdir(path.join(TEST_NOVEL_PATH, 'meta'), { recursive: true });

  await fs.writeFile(
    path.join(TEST_NOVEL_PATH, 'meta', 'index.json'),
    JSON.stringify({
      title: TEST_NOVEL_NAME,
      chapters: [],
      wiki: [
        { slug: 'hero', title: 'The Hero' },
        { slug: 'world', title: 'The World' },
      ],
    }, null, 2)
  );

  await fs.writeFile(
    path.join(TEST_NOVEL_PATH, 'wiki', 'hero.md'),
    `# The Hero\n\nA brave cartographer named Aria.`
  );

  await fs.writeFile(
    path.join(TEST_NOVEL_PATH, 'wiki', 'world.md'),
    `# The World\n\nAethermoor - floating islands.`
  );
}

async function openNovel(page) {
  const novelList = page.getByTestId('novel-list');
  await expect(novelList).toBeVisible({ timeout: 15000 });
  const novelItem = page.locator('.novel-list-item').filter({ hasText: TEST_NOVEL_NAME });
  await expect(novelItem).toBeVisible({ timeout: 10000 });
  const openButton = novelItem.locator('.novel-list-open');
  await openButton.click();
  
  // Wait for sidebar to load and wiki pages to appear - check for detach button which is always visible in docked state
  await expect(page.getByTestId('wiki-detach-button')).toBeVisible({ timeout: 10000 });
}

test.describe('Wiki Floating Panel E2E', () => {
  let app, page;

  test.beforeAll(async () => {
    await createTestNovelWithWiki();
  });

  test.beforeEach(async () => {
    ({ app, page } = await launchElectronApp());
    
    // Clear localStorage and reload to ensure clean state
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

  test('sidebar has Detach button', async () => {
    const detachButton = page.getByTestId('wiki-detach-button');
    await expect(detachButton).toBeVisible({ timeout: 5000 });
    await expect(detachButton).toBeEnabled({ timeout: 5000 });
  });

  test('clicking Detach creates floating panel', async () => {
    const detachButton = page.getByTestId('wiki-detach-button');
    await detachButton.click();

    // Floating panel should appear
    const floatingPanel = page.getByTestId('wiki-floating-panel');
    await expect(floatingPanel).toBeVisible({ timeout: 5000 });

    // Panel should have titlebar with Dock button
    const dockButton = page.getByTestId('wiki-dock-button');
    await expect(dockButton).toBeVisible({ timeout: 5000 });

    // Original sidebar should be collapsed
    const sidebar = page.getByTestId('sidebar-section');
    await expect(sidebar).toHaveClass(/collapsed/);
  });

  test('clicking Dock returns wiki to sidebar', async () => {
    const detachButton = page.getByTestId('wiki-detach-button');
    await detachButton.click();

    const floatingPanel = page.getByTestId('wiki-floating-panel');
    await expect(floatingPanel).toBeVisible({ timeout: 5000 });

    const dockButton = page.getByTestId('wiki-dock-button');
    await dockButton.click();

    // Floating panel should disappear
    await expect(floatingPanel).not.toBeVisible({ timeout: 5000 });

    // Sidebar should no longer be collapsed
    const sidebar = page.getByTestId('sidebar-section');
    await expect(sidebar).not.toHaveClass(/collapsed/);
  });

  test('floating panel is draggable', async () => {
    const detachButton = page.getByTestId('wiki-detach-button');
    await detachButton.click();

    const titlebar = page.getByTestId('wiki-floating-panel-titlebar');
    await expect(titlebar).toBeVisible({ timeout: 5000 });

    // Get initial position
    const panel = page.getByTestId('wiki-floating-panel');
    const initialBox = await panel.boundingBox();
    expect(initialBox).toBeTruthy();

    // Drag the panel
    await titlebar.dragTo(page.locator('body'), {
      sourcePosition: { x: 10, y: 10 },
      targetPosition: { x: 150, y: 150 },
    });

    // Panel should have moved
    const newBox = await panel.boundingBox();
    expect(newBox).toBeTruthy();
    // Position should have changed (allowing for some variance)
    const dx = Math.abs(newBox.x - initialBox.x);
    const dy = Math.abs(newBox.y - initialBox.y);
    expect(dx + dy).toBeGreaterThan(10);
  });

  test('floating panel position persists across detach/dock', async () => {
    const detachButton = page.getByTestId('wiki-detach-button');
    await detachButton.click();

    const titlebar = page.getByTestId('wiki-floating-panel-titlebar');
    await titlebar.dragTo(page.locator('body'), {
      sourcePosition: { x: 10, y: 10 },
      targetPosition: { x: 200, y: 200 },
    });

    const panel = page.getByTestId('wiki-floating-panel');
    const boxBefore = await panel.boundingBox();

    // Dock and detach again
    const dockButton = page.getByTestId('wiki-dock-button');
    await dockButton.click();

    await detachButton.click();

    const boxAfter = await panel.boundingBox();
    
    // Position should be preserved (allowing for small variance)
    expect(Math.abs(boxAfter.x - boxBefore.x)).toBeLessThan(10);
    expect(Math.abs(boxAfter.y - boxBefore.y)).toBeLessThan(10);
  });

  test('floating panel maintains wiki content', async () => {
    const detachButton = page.getByTestId('wiki-detach-button');
    await detachButton.click();

    const floatingPanel = page.getByTestId('wiki-floating-panel');
    await expect(floatingPanel).toBeVisible({ timeout: 5000 });

    // Wiki page list should be present in floating panel
    const wikiPageList = floatingPanel.locator('.wiki-pages-list');
    await expect(wikiPageList).toBeVisible({ timeout: 5000 });

    // Wiki pages should be clickable
    const heroPage = floatingPanel.getByText('The Hero');
    await expect(heroPage).toBeVisible({ timeout: 5000 });
    await heroPage.click();

    // Editor should show content
    const wikiPreview = floatingPanel.locator('.wiki-preview-body');
    await expect(wikiPreview).toBeVisible({ timeout: 5000 });
    await expect(wikiPreview).toContainText('Aria', { timeout: 5000 });
  });
});