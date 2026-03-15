import { test, expect } from '@playwright/test';
import { launchElectronApp, closeElectronApp } from './helpers/electron-launcher.js';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

/**
 * E2E Tests for Story 3.2: Wiki Link Syntax & Resolution
 * 
 * These tests verify that wiki links are detected, highlighted, and interactive
 * in the manuscript editor.
 *
 * Prerequisites:
 * - Electron app with novel loaded
 * - Wiki pages for testing
 *
 * These tests should be run with: npm run test:e2e
 */

test.describe('Wiki Link Syntax & Resolution E2E', () => {
  let app, page;
  let testNovelName;
  let testNovelPath;

  test.beforeEach(async () => {
    // Launch the Electron app
    ({ app, page } = await launchElectronApp());
    
    // Generate unique novel name for this test run
    testNovelName = `test-wiki-links-${Date.now()}`;
    testNovelPath = path.join(os.homedir(), '.netwriter', testNovelName);

    // Create a novel first
    const newNovelButton = page.getByTestId('new-novel-button');
    await expect(newNovelButton).toBeVisible({ timeout: 10000 });
    await newNovelButton.click();

    const dialog = page.getByTestId('create-novel-dialog');
    await expect(dialog).toBeVisible();

    const nameInput = page.getByTestId('novel-name-input');
    await nameInput.fill(testNovelName);

    const createButton = page.getByTestId('create-novel-button');
    await createButton.click();

    // Wait for dialog to close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Create a test wiki page "Alice"
    const wikiCreateButton = page.getByTestId('wiki-create-button');
    await expect(wikiCreateButton).toBeVisible({ timeout: 5000 });
    await wikiCreateButton.click();

    const createWikiDialog = page.getByTestId('create-wiki-dialog');
    await expect(createWikiDialog).toBeVisible();

    const wikiTitleInput = page.getByTestId('wiki-title-input');
    await wikiTitleInput.fill('Alice');

    const confirmCreateButton = page.getByTestId('confirm-create-wiki-button');
    await confirmCreateButton.click();

    // Wait for wiki page to be created and editor to appear
    await expect(createWikiDialog).not.toBeVisible({ timeout: 5000 });
    
    // Add some content to the wiki page
    const wikiEditor = page.getByTestId('wiki-editor');
    await expect(wikiEditor).toBeVisible({ timeout: 5000 });
    await wikiEditor.fill('Alice is the main protagonist of the story.');

    // Save the wiki page
    const wikiSaveButton = page.getByTestId('wiki-save-button');
    await wikiSaveButton.click();
    
    // Wait a moment for save to complete
    await page.waitForTimeout(500);
  });

  test.afterEach(async () => {
    // Close the app
    if (app) {
      await closeElectronApp(app);
    }
    
    // Cleanup: Delete test novel
    try {
      await fs.rm(testNovelPath, { recursive: true, force: true });
    } catch (err) {
      // Ignore if doesn't exist
    }
  });

  test('should detect and highlight wiki links in manuscript', async () => {
    // Get the manuscript editor
    const editor = page.getByTestId('manuscript-editor');
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Type a wiki link
    await editor.click();
    await page.keyboard.type('This is a story about [[Alice]].');

    // Wait a moment for rendering
    await page.waitForTimeout(300);

    // Check that the wiki link is highlighted with the .wiki-link class
    const wikiLink = editor.locator('.wiki-link');
    await expect(wikiLink).toBeVisible();
    await expect(wikiLink).toHaveAttribute('data-wiki-target', 'Alice');
  });

  test('should open wiki page when clicking a wiki link', async () => {
    // Get the manuscript editor
    const editor = page.getByTestId('manuscript-editor');
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Type a wiki link
    await editor.click();
    await page.keyboard.type('Story about [[Alice]].');

    // Wait for wiki link to render
    await page.waitForTimeout(300);

    // Click the wiki link
    const wikiLink = editor.locator('.wiki-link').first();
    await wikiLink.click();

    // Wait for popover or wiki page to open in sidebar
    // The wiki editor should now show the Alice page
    const wikiEditor = page.getByTestId('wiki-editor');
    await expect(wikiEditor).toBeVisible({ timeout: 5000 });
    
    // Verify the content of Alice page is displayed
    const content = await wikiEditor.inputValue();
    expect(content).toContain('Alice is the main protagonist');
  });

  test('should show create dialog for non-existent wiki page', async () => {
    // Get the manuscript editor
    const editor = page.getByTestId('manuscript-editor');
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Type a wiki link for a page that doesn't exist
    await editor.click();
    await page.keyboard.type('Meet [[Bob]] tomorrow.');

    // Wait for wiki link to render
    await page.waitForTimeout(300);

    // Click the wiki link
    const wikiLink = editor.locator('.wiki-link').first();
    await wikiLink.click();

    // Check that the create dialog appears
    const createDialog = page.getByTestId('wiki-link-create-dialog');
    await expect(createDialog).toBeVisible({ timeout: 5000 });
    
    // Verify it shows the correct target name
    await expect(createDialog).toContainText('Create "Bob"?');

    // Test cancel button
    const cancelButton = page.getByTestId('cancel-create-button');
    await cancelButton.click();
    await expect(createDialog).not.toBeVisible();
  });

  test('should create wiki page from broken link', async () => {
    // Get the manuscript editor
    const editor = page.getByTestId('manuscript-editor');
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Type a wiki link for a page that doesn't exist
    await editor.click();
    await page.keyboard.type('The villain [[Darklord]] appears.');

    // Wait for wiki link to render
    await page.waitForTimeout(300);

    // Click the wiki link
    const wikiLink = editor.locator('.wiki-link').first();
    await wikiLink.click();

    // Check that the create dialog appears
    const createDialog = page.getByTestId('wiki-link-create-dialog');
    await expect(createDialog).toBeVisible({ timeout: 5000 });

    // Click create button
    const createButton = page.getByTestId('create-wiki-button');
    await createButton.click();

    // Wait for dialog to close and wiki page to open
    await expect(createDialog).not.toBeVisible({ timeout: 5000 });

    // Verify the created page is opened in the sidebar editor (preview/edit mode may vary)
    const titleInput = page.locator('#wiki-title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await expect(titleInput).toHaveValue('darklord');

    // Switch to edit mode and verify editor content is accessible
    const editModeButton = page.getByRole('button', { name: 'Edit' });
    await editModeButton.click();
    const wikiEditor = page.getByTestId('wiki-editor');
    await expect(wikiEditor).toBeVisible({ timeout: 5000 });
    const content = await wikiEditor.inputValue();
    expect(content).toContain('Start documenting this wiki page');
  });

  test('should support [[page|display text]] syntax', async () => {
    // Get the manuscript editor
    const editor = page.getByTestId('manuscript-editor');
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Type a wiki link with custom display text
    await editor.click();
    await page.keyboard.type('Meet [[Alice|the hero]] today.');

    // Wait for wiki link to render
    await page.waitForTimeout(300);

    // Check that the wiki link shows the display text
    const wikiLink = editor.locator('.wiki-link').first();
    await expect(wikiLink).toBeVisible();
    await expect(wikiLink).toHaveAttribute('data-wiki-target', 'Alice');
    await expect(wikiLink).toHaveAttribute('data-wiki-display', 'the hero');
    
    // Verify the displayed text is the custom text
    const linkText = await wikiLink.textContent();
    expect(linkText).toBe('the hero');

    // Click the link to verify it still navigates to Alice
    await wikiLink.click();

    // Wait for wiki editor to show Alice's content
    const wikiEditor = page.getByTestId('wiki-editor');
    await expect(wikiEditor).toBeVisible({ timeout: 5000 });
    
    const content = await wikiEditor.inputValue();
    expect(content).toContain('Alice is the main protagonist');
  });

  test('should handle multiple wiki links in same chapter', async () => {
    // Create a second wiki page "Settings"
    const wikiCreateButton = page.getByTestId('wiki-create-button');
    await wikiCreateButton.click();

    const createWikiDialog = page.getByTestId('create-wiki-dialog');
    await expect(createWikiDialog).toBeVisible();

    const wikiTitleInput = page.getByTestId('wiki-title-input');
    await wikiTitleInput.fill('Settings');

    const confirmCreateButton = page.getByTestId('confirm-create-wiki-button');
    await confirmCreateButton.click();
    await expect(createWikiDialog).not.toBeVisible({ timeout: 5000 });

    const wikiEditor = page.getByTestId('wiki-editor');
    await wikiEditor.fill('A description of the world settings.');
    
    const wikiSaveButton = page.getByTestId('wiki-save-button');
    await wikiSaveButton.click();
    await page.waitForTimeout(500);

    // Get the manuscript editor
    const editor = page.getByTestId('manuscript-editor');
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Type multiple wiki links
    await editor.click();
    await page.keyboard.type('[[Alice]] lives in [[Settings]].');

    // Wait for wiki links to render
    await page.waitForTimeout(300);

    // Verify both links are rendered
    const wikiLinks = editor.locator('.wiki-link');
    await expect(wikiLinks).toHaveCount(2);

    // Verify each link has correct attributes
    const firstLink = wikiLinks.nth(0);
    await expect(firstLink).toHaveAttribute('data-wiki-target', 'Alice');

    const secondLink = wikiLinks.nth(1);
    await expect(secondLink).toHaveAttribute('data-wiki-target', 'Settings');

    // Click the second link
    await secondLink.click();

    // Verify Settings page opens
    const content = await wikiEditor.inputValue();
    expect(content).toContain('A description of the world settings');
  });
});
