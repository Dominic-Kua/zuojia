import { test, expect } from '@playwright/test';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { execFileSync } from 'child_process';
import { closeElectronApp, launchElectronApp } from './helpers/electron-launcher.js';

test.describe('Story 4.5: Git Configuration', () => {
  let app;
  let page;
  let testNovelName;
  let testNovelPath;
  let remotePath;

  test.beforeEach(async () => {
    ({ app, page } = await launchElectronApp());

    testNovelName = `test-git-settings-${Date.now()}`;
    testNovelPath = path.join(os.homedir(), '.zuojia', testNovelName);
    remotePath = path.join(os.tmpdir(), `zuojia-remote-${Date.now()}.git`);

    execFileSync('git', ['init', '--bare', remotePath], { stdio: 'ignore' });

    const newNovelButton = page.getByTestId('new-novel-button');
    await expect(newNovelButton).toBeVisible({ timeout: 10000 });
    await newNovelButton.click();

    const dialog = page.getByTestId('create-novel-dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await page.getByTestId('novel-name-input').fill(testNovelName);
    await page.getByTestId('create-novel-button').click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test.afterEach(async () => {
    if (app) {
      await closeElectronApp(app);
    }

    await fs.rm(testNovelPath, { recursive: true, force: true }).catch(() => {});
    await fs.rm(remotePath, { recursive: true, force: true }).catch(() => {});
  });

  test('saves validated git settings to meta/config.yml', async () => {
    await page.getByTestId('settings-button').click();
    await expect(page.getByTestId('settings-dialog')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('git-remote-url-input').fill(remotePath);
    await page.getByTestId('git-branch-input').fill('main');
    await page.getByTestId('git-ssh-key-input').fill('~/.ssh/id_rsa');
    await page.getByTestId('git-settings-save').click();

    await expect(page.getByTestId('settings-dialog')).not.toBeVisible({ timeout: 5000 });

    const configPath = path.join(testNovelPath, 'meta', 'config.yml');
    const configContent = await fs.readFile(configPath, 'utf-8');
    expect(configContent).toContain(`remoteUrl: ${remotePath}`);
    expect(configContent).toContain('branch: main');
    expect(configContent).toContain('sshKeyPath: ~/.ssh/id_rsa');

    const configResult = await page.evaluate(
      async ({ novelPath }) => window.electronAPI.invoke('helper:git:getConfig', { novelPath }),
      { novelPath: testNovelPath }
    );

    expect(configResult.status).toBe('ok');
    expect(configResult.data.remoteUrl).toBe(remotePath);
    expect(configResult.data.branch).toBe('main');
  });
});