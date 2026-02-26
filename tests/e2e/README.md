# End-to-End Testing Guide for Netwriter

## Overview

This guide explains how to set up and run end-to-end tests for Netwriter using Playwright with Electron.

## Installation

```bash
npm install --save-dev @playwright/test playwright
```

## Configuration

Create `playwright.config.js` in the project root:

```javascript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: false, // Electron tests should run serially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for Electron
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
});
```

## Test Structure

```

tests/e2e/
├── fixtures/          # Test data (novels, wiki pages)
├── helpers/           # Test utilities
├── novel-creation.spec.js
├── wiki-workflow.spec.js
└── word-count.spec.js
```

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/wiki-workflow.spec.js

# Run with UI (debug mode)
npx playwright test --ui

# Generate HTML report
npx playwright show-report
```

## Example Test

```javascript
import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test.describe('Wiki Workflow', () => {
  let electronApp;
  let page;

  test.beforeAll(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../electron/main.cjs')]
    });
    page = await electronApp.firstWindow();
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('create and edit wiki page', async () => {
    // Click "+ New Wiki Page" button
    await page.click('[data-testid="new-wiki-button"]');
    
    // Fill in wiki title
    await page.fill('[data-testid="wiki-title-input"]', 'Test Character');
    await page.click('[data-testid="wiki-create-button"]');
    
    // Verify page appears in list
    await expect(page.locator('text=Test Character')).toBeVisible();
    
    // Click to open editor
    await page.click('text=Test Character');
    
    // Edit content
    await page.fill('[data-testid="wiki-editor"]', '# Test Character\\n\\nDescription here');
    
    // Save
    await page.click('[data-testid="wiki-save-button"]');
    
    // Verify saved
    await expect(page.locator('text=All changes saved')).toBeVisible();
  });
});
```

## Best Practices

1. **Use data-testid attributes** for reliable selectors
2. **Clean up test data** after each test
3. **Wait for elements** before interacting
4. **Take screenshots** on failure for debugging
5. **Test keyboard shortcuts** in addition to clicks

## Debugging Tips

- Use `await page.pause()` to pause execution
- Use `page.screenshot({ path: 'debug.png' })` to capture state
- Enable verbose logging: `DEBUG=pw:api npm run test:e2e`
- Use Playwright Inspector: `PWDEBUG=1 npm run test:e2e`

## CI/CD Integration

Add to `.github/workflows/test.yml`:

```yaml
- name: Run E2E Tests
  run: |
    xvfb-run --auto-servernum npm run test:e2e
```

## Test Data Management

Store test fixtures in `tests/e2e/fixtures/`:

```
fixtures/
├── test-novel/
│   ├── manuscript/
│   │   ├── chapter-1.md
│   │   └── chapter-2.md
│   ├── wiki/
│   │   └── character.md
│   └── meta/
│       └── index.json
```

Load fixtures in tests:

```javascript
import { copyFile } from 'fs/promises';

test.beforeEach(async () => {
  // Copy fixture to temp location
  await copyFile('tests/e2e/fixtures/test-novel', tmpDir);
});
```

## Known Issues & Workarounds

1. **Electron startup delay:** Add `await page.waitForLoadState('networkidle')`
2. **IPC timing:** Use `await page.waitForFunction()` for IPC completion
3. **File system operations:** Add explicit waits after save operations

## Next Steps

1. Implement Playwright configuration
2. Add data-testid attributes to components
3. Create test fixtures
4. Write E2E tests for each story
5. Integrate with CI/CD pipeline
