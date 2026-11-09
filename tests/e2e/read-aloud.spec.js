import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { closeElectronApp, launchElectronApp } from './helpers/electron-launcher.js';

const installSpeechMock = async (page) => {
  await page.addInitScript(() => {
    class MockUtterance {
      constructor(text) {
        this.text = text;
        this.rate = 1;
        this.voice = null;
        this.onstart = null;
        this.onend = null;
        this.onerror = null;
      }
    }

    const mock = {
      speaking: false,
      paused: false,
      getVoices: () => [
        { name: 'Alex', lang: 'en-US', default: true, localService: true, voiceURI: 'alex' },
        { name: 'Samantha', lang: 'en-US', default: false, localService: true, voiceURI: 'sam' },
      ],
      speak(utterance) {
        window.__ttsUtterances.push(utterance);
        this.speaking = true;
        this.paused = false;
        setTimeout(() => utterance.onstart?.(), 0);
      },
      cancel() {
        this.speaking = false;
        this.paused = false;
      },
      pause() {
        this.paused = true;
      },
      resume() {
        this.paused = false;
      },
      addEventListener() {},
      removeEventListener() {},
    };

    window.__ttsUtterances = [];
    Object.defineProperty(window, 'speechSynthesis', { value: mock, configurable: true, writable: true });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: MockUtterance, configurable: true, writable: true });
  });
};

test.describe('Read manuscript text aloud', () => {
  let app;
  let page;
  let novelPath;

  test.beforeEach(async () => {
    ({ app, page } = await launchElectronApp());
    await installSpeechMock(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const novelName = `e2e-read-aloud-${Date.now()}`;
    novelPath = path.join(os.homedir(), '.zuojia', novelName);
    await page.getByTestId('new-novel-button').click();
    await page.getByTestId('novel-name-input').fill(novelName);
    await page.getByTestId('create-novel-button').click();
    await expect(page.getByTestId('create-novel-dialog')).not.toBeVisible();

    // Read-aloud controls are hidden by default; enable them in Settings.
    await page.getByTestId('novel-menu').click();
    await page.getByTestId('settings-button').click();
    await page.getByTestId('settings-tab-appearance').click();
    await page.getByTestId('appearance-read-aloud-toggle').check();
    await page.getByTestId('settings-save').click();
    await expect(page.getByTestId('settings-dialog')).not.toBeVisible();

    await expect(page.getByTestId('read-aloud-controls')).toBeVisible({ timeout: 10000 });

    const editor = page.getByTestId('manuscript-editor');
    await editor.click();
    await page.keyboard.press('Meta+A');
    await page.keyboard.type('First sentence. Second sentence. Third sentence.');
    await expect(editor).toContainText('First sentence');
    // Let debounced save/state settle so read-aloud reads the current chapter text.
    await page.waitForTimeout(1700);
  });

  test.afterEach(async () => {
    if (app) await closeElectronApp(app);
    await fs.rm(novelPath, { recursive: true, force: true }).catch(() => {});
  });

  test('plays, follows, navigates, and configures chapter playback', async () => {
    await expect(page.getByTestId('read-aloud-status')).toContainText('Reads the selection');
    await expect(page.getByTestId('manuscript-editor')).toContainText('First sentence');

    await page.getByTestId('read-aloud-speed').selectOption('1.5');
    await page.getByTestId('read-aloud-voice').selectOption('Samantha');
    await page.getByTestId('read-aloud-play').click();

    await expect.poll(async () => page.evaluate(() => window.__ttsUtterances?.length || 0), { timeout: 5000 }).toBeGreaterThan(0);
    await expect(page.getByTestId('read-aloud-status')).toContainText('Reading 1/');
    await expect(page.getByTestId('manuscript-editor')).toHaveAttribute('data-reading-aloud', 'true');
    expect(await page.evaluate(() => window.__ttsUtterances[0].text)).toContain('First sentence');
    expect(await page.evaluate(() => window.__ttsUtterances[0].rate)).toBe(1.5);
    expect(await page.evaluate(() => window.__ttsUtterances[0].voice?.name)).toBe('Samantha');

    await page.getByTestId('read-aloud-next').click();
    await expect(page.getByTestId('read-aloud-status')).toContainText('Second sentence');

    await page.getByTestId('read-aloud-pause').click();
    await expect(page.getByTestId('read-aloud-play')).toContainText('Resume');
    await page.getByTestId('read-aloud-play').click();
    await expect(page.getByTestId('read-aloud-pause')).toBeVisible();

    await page.getByTestId('read-aloud-stop').click();
    await expect(page.getByTestId('read-aloud-status')).toContainText('Reads the selection');
    await expect(page.getByTestId('manuscript-editor')).not.toHaveAttribute('data-reading-aloud', 'true');
  });
});
