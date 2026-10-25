import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { closeElectronApp, launchElectronApp } from './helpers/electron-launcher.js';

test.describe('Writing goals and progress', () => {
  let app;
  let page;
  let novelName;
  let novelPath;

  test.beforeEach(async () => {
    ({ app, page } = await launchElectronApp());
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    novelName = `e2e-writing-goals-${Date.now()}`;
    novelPath = path.join(os.homedir(), '.zuojia', novelName);
    await page.getByTestId('new-novel-button').click();
    await page.getByTestId('novel-name-input').fill(novelName);
    await page.getByTestId('create-novel-button').click();
    await expect(page.getByTestId('create-novel-dialog')).not.toBeVisible();
    await expect(page.getByTestId('writing-goal-edit')).toBeEnabled({ timeout: 10000 });
  });

  test.afterEach(async () => {
    if (app) await closeElectronApp(app);
    await fs.rm(novelPath, { recursive: true, force: true }).catch(() => {});
  });

  test('saves a goal, work schedule, planned day off, and reads progress history', async () => {
    await page.getByTestId('writing-goal-edit').click();
    await expect(page.getByTestId('writing-goal-dialog')).toBeVisible();
    await page.getByTestId('writing-goal-target').fill('50000');
    await page.getByTestId('writing-goal-date').fill('2026-12-31');
    await page.getByTestId('writing-goal-day-0').check();
    await page.getByTestId('writing-goal-day-off-input').fill('2026-12-25');
    await page.getByTestId('writing-goal-add-day-off').click();
    await page.getByTestId('writing-goal-save').click();

    await expect(page.getByTestId('writing-goal-summary')).toContainText('50,000');
    const persisted = await page.evaluate(async (pathValue) => {
      const [goal, history] = await Promise.all([
        window.electronAPI.invoke('helper:stats:writing-goal:get', { novelPath: pathValue }),
        window.electronAPI.invoke('helper:stats:writing-history', { novelPath: pathValue, days: 14 }),
      ]);
      return { goal, history };
    }, novelPath);

    expect(persisted.goal.data).toMatchObject({
      targetWords: 50000,
      targetDate: '2026-12-31',
      writingDays: [0, 1, 2, 3, 4, 5],
      plannedDaysOff: ['2026-12-25'],
    });
    expect(persisted.history.data).toHaveLength(14);
    await page.getByTestId('writing-goal-edit').click();
    await expect(page.getByTestId('writing-goal-history')).toBeVisible();
  });
});
