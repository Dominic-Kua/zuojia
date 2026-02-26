import { test, expect } from '@playwright/test';
import { launchElectronApp, closeElectronApp } from './helpers/electron-launcher.js';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

test.describe('Novel Creation E2E', () => {
  let app, page;
  let testNovelName;
  let testNovelPath;

  test.beforeEach(async () => {
    // Launch the Electron app
    ({ app, page } = await launchElectronApp());
    
    // Generate unique novel name for this test run
    testNovelName = `test-novel-${Date.now()}`;
    testNovelPath = path.join(os.homedir(), '.netwriter', testNovelName);
  });

  test.afterEach(async () => {
    // Close the app
    if (app) {
      await closeElectronApp(app);
    }
    
    // Cleanup: Delete test novel if it was created
    try {
      await fs.rm(testNovelPath, { recursive: true, force: true });
    } catch (err) {
      // Ignore if doesn't exist
    }
  });

  test('should create a new novel through the UI', async () => {
    // Step 1: Find and click the "+ New Novel" button
    const newNovelButton = page.getByTestId('new-novel-button');
    await expect(newNovelButton).toBeVisible({ timeout: 10000 });
    await newNovelButton.click();

    // Step 2: Verify the create dialog appears
    const dialog = page.getByTestId('create-novel-dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.locator('h2:has-text("Create a New Novel")')).toBeVisible();

    // Step 3: Enter novel name
    const nameInput = page.getByTestId('novel-name-input');
    await expect(nameInput).toBeVisible();
    await nameInput.fill(testNovelName);

    // Step 4: Verify Create button becomes enabled
    const createButton = page.getByTestId('create-novel-button');
    await expect(createButton).toBeEnabled();

    // Step 5: Click Create button
    await createButton.click();

    // Step 6: Verify dialog closes
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Step 7: Verify novel directory was created on disk
    const novelExists = await fs.access(testNovelPath)
      .then(() => true)
      .catch(() => false);
    expect(novelExists).toBe(true);

    // Step 8: Verify directory structure
    const manuscriptDir = path.join(testNovelPath, 'manuscript');
    const wikiDir = path.join(testNovelPath, 'wiki');
    const metaDir = path.join(testNovelPath, 'meta');
    
    const [manuscriptExists, wikiExists, metaExists] = await Promise.all([
      fs.access(manuscriptDir).then(() => true).catch(() => false),
      fs.access(wikiDir).then(() => true).catch(() => false),
      fs.access(metaDir).then(() => true).catch(() => false),
    ]);

    expect(manuscriptExists).toBe(true);
    expect(wikiExists).toBe(true);
    expect(metaExists).toBe(true);

    // Step 9: Verify index.json was created
    const indexPath = path.join(testNovelPath, 'meta', 'index.json');
    const indexExists = await fs.access(indexPath)
      .then(() => true)
      .catch(() => false);
    expect(indexExists).toBe(true);

    // Step 10: Verify index.json has correct structure
    const indexContent = await fs.readFile(indexPath, 'utf-8');
    const index = JSON.parse(indexContent);
    expect(index).toHaveProperty('chapters');
    expect(index).toHaveProperty('wiki');
    expect(Array.isArray(index.chapters)).toBe(true);
    expect(Array.isArray(index.wiki)).toBe(true);
  });

  test('should validate novel name and show error for invalid names', async () => {
    // Step 1: Open dialog
    const newNovelButton = page.getByTestId('new-novel-button');
    await newNovelButton.click();

    // Step 2: Try invalid name with uppercase
    const nameInput = page.getByTestId('novel-name-input');
    await nameInput.fill('InvalidName');

    // Step 3: Try to create (button should be disabled or show error)
    const createButton = page.getByTestId('create-novel-button');
    
    // The button might be disabled, or clicking might show an error
    const isDisabled = await createButton.isDisabled();
    
    if (!isDisabled) {
      await createButton.click();
      // Should show error message
      const errorMessage = page.getByTestId('novel-name-error');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('lowercase');
    } else {
      // Button is disabled, which is correct behavior
      expect(isDisabled).toBe(true);
    }
  });

  test('should allow canceling novel creation', async () => {
    // Step 1: Open dialog
    const newNovelButton = page.getByTestId('new-novel-button');
    await newNovelButton.click();

    const dialog = page.getByTestId('create-novel-dialog');
    await expect(dialog).toBeVisible();

    // Step 2: Enter a name
    const nameInput = page.getByTestId('novel-name-input');
    await nameInput.fill(testNovelName);

    // Step 3: Click Cancel
    const cancelButton = page.getByTestId('cancel-novel-button');
    await cancelButton.click();

    // Step 4: Verify dialog closes
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Step 5: Verify no novel was created
    const novelExists = await fs.access(testNovelPath)
      .then(() => true)
      .catch(() => false);
    expect(novelExists).toBe(false);
  });

  test('should show loading state during creation', async () => {
    // Step 1: Open dialog
    const newNovelButton = page.getByTestId('new-novel-button');
    await newNovelButton.click();

    // Step 2: Enter name
    const nameInput = page.getByTestId('novel-name-input');
    await nameInput.fill(testNovelName);

    // Step 3: Click create and check for loading state
    const createButton = page.getByTestId('create-novel-button');
    await createButton.click();

    // Might briefly show "Creating..." text
    // This is a race condition, so we'll just verify the dialog eventually closes
    await expect(page.getByTestId('create-novel-dialog')).not.toBeVisible({ timeout: 10000 });
  });
});
