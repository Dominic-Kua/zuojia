import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for Netwriter E2E tests
 * Testing Electron application with Playwright
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  /* Maximum time one test can run for */
  timeout: 30 * 1000,
  
  /* Run tests in files in parallel */
  fullyParallel: false, // Electron tests should run serially
  
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Single worker for Electron tests */
  workers: 1,
  
  /* Reporter to use */
  reporter: [
    ['html', { outputFolder: '_bmad-output/test-artifacts/e2e-report' }],
    ['json', { outputFile: '_bmad-output/test-artifacts/e2e-results.json' }],
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
  outputDir: '_bmad-output/test-artifacts/e2e-results',
});
