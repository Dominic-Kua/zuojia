import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Wiki Link Syntax & Resolution E2E', () => {
  test('should detect and highlight wiki links in manuscript', async ({ page, app }) => {
    // Create a novel
    const novelPath = await app.evaluate(({ shell, os }) => {
      const { createNovel } = require('../../../helper/src/index/index.js');
      const testNovelPath = path.join(os.homedir(), '.netwriter', 'test-wiki-links');
      if (shell.execSync('test -d ' + testNovelPath + ' && echo 1 || echo 0').toString().trim() === '1') {
        shell.execSync('rm -rf ' + testNovelPath);
      }
      return createNovel('test-wiki-links').then(result => result.data.novelPath);
    });

    // Navigate to app
    await page.goto('http://127.0.0.1:5173');

    // Open the novel
    await page.click('button:has-text("Open")');
    await page.waitForTimeout(500);
    // Select the test novel directory
    // (In a real test, we'd use Electron's file picker mock)

    // Create a wiki page: "Alice"
    await page.click('[data-testid="wiki-tab"]');
    await page.click('button:has-text("+")');
    await page.fill('input[placeholder*="title"]', 'Alice');
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(500);

    // Switch back to manuscript
    await page.click('[data-testid="manuscript-tab"]');

    // Type content with wiki link
    const editor = await page.locator('.cm-content');
    await editor.click();
    await editor.type('Alice went to the forest. [[Alice]] is the protagonist.');

    // Check that [[Alice]] is highlighted
    const wikiLink = await page.locator('.wiki-link:has-text("Alice")');
    await expect(wikiLink).toBeVisible();
    await expect(wikiLink).toHaveCSS('color', /rgb/); // Should have distinct color
  });

  test('should open wiki page when clicking a wiki link', async ({ page, app }) => {
    // (Assume novel and wiki page setup from previous test)
    const editor = await page.locator('.cm-content');
    
    // Navigate to a wiki link
    const wikiLink = await page.locator('.wiki-link-clickable:has-text("Alice")');
    await wikiLink.click();

    // Wiki sidebar should show the Alice page
    const wikiEditor = await page.locator('[data-testid="wiki-editor"]');
    await expect(wikiEditor).toBeVisible();
    const wikiContent = await wikiEditor.textContent();
    expect(wikiContent).toContain('Alice');
  });

  test('should show link preview on hover', async ({ page, app }) => {
    const wikiLink = await page.locator('.wiki-link:has-text("Alice")');
    
    // Hover over the link
    await wikiLink.hover();
    await page.waitForTimeout(500);

    // Preview tooltip should appear
    const preview = await page.locator('[role="tooltip"]:has-text("Alice")');
    await expect(preview).toBeVisible();
    // Should show first 100 chars of page content
    const previewText = await preview.textContent();
    expect(previewText?.length).toBeLessThanOrEqual(100);
  });

  test('should show create dialog for non-existent wiki page', async ({ page, app }) => {
    const editor = await page.locator('.cm-content');
    await editor.click();
    await editor.type('Meet [[NonexistentCharacter]].');

    // Click the non-existent link
    const wikiLink = await page.locator('.wiki-link:has-text("NonexistentCharacter")');
    await wikiLink.click();

    // Create dialog should appear
    const dialog = await page.locator('text=Create.*NonexistentCharacter');
    await expect(dialog).toBeVisible();

    // Cancel dialog
    await page.click('button:has-text("Cancel")');
  });

  test('should handle ambiguous wiki links', async ({ page, app }) => {
    // Create multiple pages starting with "Alice"
    await page.click('[data-testid="wiki-tab"]');
    
    // Create "Alice the Protagonist"
    await page.click('button:has-text("+")');
    await page.fill('input[placeholder*="title"]', 'Alice the Protagonist');
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(300);

    // Create "Alice the Antagonist"
    await page.click('button:has-text("+")');
    await page.fill('input[placeholder*="title"]', 'Alice the Antagonist');
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(300);

    // Go back to manuscript
    await page.click('[data-testid="manuscript-tab"]');

    const editor = await page.locator('.cm-content');
    await editor.click();
    await editor.type('[[Alice]] is confusing.');

    // Click the ambiguous link
    const wikiLink = await page.locator('.wiki-link:has-text("Alice")');
    await wikiLink.click();

    // Disambiguation menu should appear
    const menu = await page.locator('[role="menu"]:has-text("Alice")');
    await expect(menu).toBeVisible();

    // Menu should show both matches
    const items = await menu.locator('li').all();
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  test('should support [[page|display text]] syntax', async ({ page, app }) => {
    const editor = await page.locator('.cm-content');
    await editor.click();
    await editor.type('Meet [[alice-protagonist|Alice]] in the story.');

    // Link should display "Alice" but target "alice-protagonist"
    const wikiLink = await page.locator('.wiki-link:has-text("Alice")');
    await expect(wikiLink).toBeVisible();

    // Clicking should open the correct page
    await wikiLink.click();
    const wikiEditor = await page.locator('[data-testid="wiki-editor"]');
    const titleText = await wikiEditor.locator('h1').textContent();
    expect(titleText).toContain('Alice the Protagonist');
  });
});
