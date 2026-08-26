import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for 作家 E2E tests
 * Testing Electron application with Playwright
 */
export default defineConfig({
  testDir: './tests/e2e',

  /* Rebuild dist/ if source is newer — e2e runs against the built renderer */
  globalSetup: './tests/e2e/e2e-global-setup.js',

  /* Sweep orphaned test novels (e2e-*, test-*) from ~/.zuojia/ after each run */
  globalTeardown: './tests/e2e/e2e-global-teardown.js',

  
  /* Maximum time one test can run for */
  timeout: 30 * 1000,
  
  /* Run tests in files in parallel */
  fullyParallel: false, // Electron tests should run serially
  
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  
  /* Retry once locally too — service-backed specs (Neo4j/LLM) are
     timing-sensitive when run back-to-back */
  retries: process.env.CI ? 2 : 1,
  
  /* Single worker for Electron tests */
  workers: 1,
  
  /* Reporter to use */
  reporter: [
    ['html', { outputFolder: 'playwright-report/e2e-report' }],
    ['json', { outputFile: 'playwright-report/e2e-results.json' }],
    ['list']
  ],
  
  /* Shared settings for all tests */
  use: {
    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    
    /* Keep video on failure only */
    video: 'retain-on-failure',
    
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for Electron */
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.js',
    },
  ],

  /* Output folders */
  outputDir: 'test-results/e2e',
});
