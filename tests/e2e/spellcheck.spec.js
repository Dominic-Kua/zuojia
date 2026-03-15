import { test, expect } from '@playwright/test';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { closeElectronApp, launchElectronApp } from './helpers/electron-launcher.js';

test.describe('Spellcheck Dictionary E2E', () => {
  let app;
  let page;
  let testNovelName;
  let testNovelPath;

  async function createNovel() {
    const newNovelButton = page.getByTestId('new-novel-button');
    await expect(newNovelButton).toBeVisible({ timeout: 10000 });
    await newNovelButton.click();

    const dialog = page.getByTestId('create-novel-dialog');
    await expect(dialog).toBeVisible();

    await page.getByTestId('novel-name-input').fill(testNovelName);
    await page.getByTestId('create-novel-button').click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('manuscript-editor')).toBeVisible({ timeout: 5000 });
  }

  async function clearAndTypeManuscript(text) {
    const editor = page.getByTestId('manuscript-editor');
    await editor.click();
    await page.keyboard.press('Meta+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(text);
    await page.waitForTimeout(700);
  }

  async function createWikiPage(title) {
    await page.getByTestId('wiki-create-button').click();
    await expect(page.getByTestId('create-wiki-dialog')).toBeVisible();
    await page.getByTestId('wiki-title-input').fill(title);
    await page.getByTestId('confirm-create-wiki-button').click();
    await expect(page.getByTestId('create-wiki-dialog')).not.toBeVisible({ timeout: 5000 });
  }

  async function renameCurrentWikiPage(title) {
    const titleInput = page.locator('#wiki-title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill(title);
    await page.waitForTimeout(1200);
  }

  async function deleteWikiPage(slug) {
    const pageItem = page.locator(`[data-testid="wiki-page-item-${slug}"]`);
    await pageItem.hover();
    await page.getByTestId(`wiki-delete-button-${slug}`).click();
    await page.getByTestId(`wiki-confirm-delete-${slug}`).click();
    await page.waitForTimeout(700);
  }

  async function waitForIssues(words) {
    await expect.poll(async () => {
      return await page.locator('[data-testid="spellcheck-issue"]').allTextContents();
    }).toEqual(words);
  }

  test.beforeEach(async () => {
    ({ app, page } = await launchElectronApp());
    testNovelName = `test-spellcheck-${Date.now()}`;
    testNovelPath = path.join(os.homedir(), '.netwriter', testNovelName);
    await createNovel();
  });

  test.afterEach(async () => {
    if (app) {
      await closeElectronApp(app);
    }

    try {
      await fs.rm(testNovelPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup failures for temp novels.
    }
  });

  test('should suppress wiki page names from spellcheck', async () => {
    await createWikiPage('Frodo Baggins');
    await clearAndTypeManuscript('Frodo Baggins meets Alise in the Shire.');

    const issueTexts = await page.locator('[data-testid="spellcheck-issue"]').allTextContents();
    expect(issueTexts).toContain('Alise');
    expect(issueTexts).not.toContain('Frodo');
    expect(issueTexts).not.toContain('Baggins');
  });

  test('should disable native browser spellcheck in the manuscript editor', async () => {
    const nativeSpellcheckEnabled = await page.evaluate(() => {
      const editor = document.querySelector('[data-testid="manuscript-editor"]');
      return editor ? editor.spellcheck : null;
    });

    expect(nativeSpellcheckEnabled).toBe(false);
  });

  test('should rebuild dictionary when wiki pages are created', async () => {
    await clearAndTypeManuscript('Shadowfax arrives at dawn.');
    await waitForIssues(['Shadowfax']);

    await createWikiPage('Shadowfax');

    await expect.poll(async () => {
      return await page.locator('[data-testid="spellcheck-issue"]').allTextContents();
    }).toEqual([]);
  });

  test('should handle special characters in wiki titles', async () => {
    await createWikiPage("Bob's Tavern (The Inn)");
    await clearAndTypeManuscript('Bob Tavern Inn welcomes Alise.');

    const issueTexts = await page.locator('[data-testid="spellcheck-issue"]').allTextContents();
    expect(issueTexts).toContain('Alise');
    expect(issueTexts).not.toContain('Bob');
    expect(issueTexts).not.toContain('Tavern');
    expect(issueTexts).not.toContain('Inn');
  });

  test('should reload dictionary after renaming wiki page', async () => {
    await createWikiPage('CharacterA');
    await clearAndTypeManuscript('CharacterA meets CharacterB.');
    await waitForIssues(['CharacterB']);

    await renameCurrentWikiPage('CharacterB');

    const issueTexts = await page.locator('[data-testid="spellcheck-issue"]').allTextContents();
    expect(issueTexts).toContain('CharacterA');
    expect(issueTexts).not.toContain('CharacterB');
  });

  test('should remove deleted wiki page from dictionary', async () => {
    await createWikiPage('TemporaryName');
    await clearAndTypeManuscript('TemporaryName leaves the scene.');
    await waitForIssues([]);

    await deleteWikiPage('temporaryname');

    await waitForIssues(['TemporaryName']);
  });

  test('should handle manuscript with multiple wiki references', async () => {
    await createWikiPage('Aragorn');
    await createWikiPage('Gondor');
    await createWikiPage('Minas Tirith');
    await clearAndTypeManuscript('Aragorn rides to Gondor before Alise reaches Minas Tirith.');

    const issueTexts = await page.locator('[data-testid="spellcheck-issue"]').allTextContents();
    expect(issueTexts).toEqual(['Alise']);
  });

  test('should show suggested corrections for misspelled words', async () => {
    await clearAndTypeManuscript('Alise will acheive victory.');

    const aliseIssue = page.locator('[data-testid="spellcheck-issue-item"]').filter({ hasText: 'Alise' });
    const acheiveIssue = page.locator('[data-testid="spellcheck-issue-item"]').filter({ hasText: 'acheive' });

    await expect(aliseIssue.getByRole('button', { name: 'Alice' })).toBeVisible();
    await expect(acheiveIssue.getByRole('button', { name: 'achieve' })).toBeVisible();
  });

  test('should apply a suggested correction from the spellcheck panel', async () => {
    await clearAndTypeManuscript('Alise will acheive victory.');

    const acheiveIssue = page.locator('[data-testid="spellcheck-issue-item"]').filter({ hasText: 'acheive' });
    await acheiveIssue.getByRole('button', { name: 'achieve' }).click();

    await expect(page.getByTestId('manuscript-editor')).toContainText('Alise will achieve victory.');

    await expect.poll(async () => {
      return await page.locator('[data-testid="spellcheck-issue"]').allTextContents();
    }).toEqual(['Alise']);
  });
});
