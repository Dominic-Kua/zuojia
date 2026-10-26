import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { closeElectronApp, launchElectronApp } from './helpers/electron-launcher.js';

const toggleShortcut = process.platform === 'darwin' ? 'Meta+Shift+F' : 'Control+Shift+F';

test.describe('Distraction-free focus mode', () => {
  let app;
  let page;
  let novelPath;

  test.beforeEach(async () => {
    ({ app, page } = await launchElectronApp());
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const novelName = `e2e-focus-mode-${Date.now()}`;
    novelPath = path.join(os.homedir(), '.zuojia', novelName);
    await page.getByTestId('new-novel-button').click();
    await page.getByTestId('novel-name-input').fill(novelName);
    await page.getByTestId('create-novel-button').click();
    await expect(page.getByTestId('create-novel-dialog')).not.toBeVisible();
    await expect(page.getByTestId('manuscript-editor')).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async () => {
    if (app) await closeElectronApp(app);
    await fs.rm(novelPath, { recursive: true, force: true }).catch(() => {});
  });

  test('hides chrome, keeps the caret, and restores the workspace', async () => {
    await page.getByTestId('manuscript-editor').click();
    await page.keyboard.type('Focus keeps this line.');
    await page.getByTestId('focus-mode-toggle').click();

    await expect(page.getByTestId('topbar')).toBeHidden();
    await expect(page.getByTestId('sidebar-section')).toBeHidden();
    await expect(page.locator('.manuscript-meta')).toBeHidden();
    await expect(page.getByTestId('focus-mode-exit')).toBeVisible();
    await expect(page.getByTestId('focus-mode-exit')).toContainText('Esc');
    await expect(page.getByTestId('focus-mode-hint')).toContainText('Esc');
    await expect(page.getByTestId('focus-mode-hint')).toBeHidden({ timeout: 6000 });

    await page.getByTestId('focus-mode-exit').click();
    await expect(page.getByTestId('topbar')).toBeVisible();
    await expect(page.locator('.manuscript-meta')).toBeVisible();
    await expect(page.getByTestId('focus-mode-exit')).not.toBeVisible();

    await page.keyboard.press('Escape');
    await page.getByTestId('focus-mode-toggle').click();
    await expect(page.getByTestId('topbar')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('topbar')).toBeVisible();

    await page.getByTestId('focus-mode-toggle').click();
    await expect(page.getByTestId('topbar')).toBeHidden();
    await page.keyboard.press(toggleShortcut);
    await expect(page.getByTestId('topbar')).toBeVisible();

    await expect(page.getByTestId('manuscript-editor')).toContainText('Focus keeps this line.');
  });

  test('works in dark theme and respects reduced motion', async () => {
    await page.getByTestId('theme-toggle-button').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByTestId('focus-mode-toggle').click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const transition = await page
      .getByTestId('focus-mode-exit')
      .evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(parseFloat(transition)).toBeLessThan(0.01);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('topbar')).toBeVisible();
  });
});
