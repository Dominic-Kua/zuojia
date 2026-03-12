import { _electron as electron } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Launch the Electron app for E2E testing
 * @returns {Promise<{app: ElectronApplication, page: Page}>}
 */
export async function launchElectronApp() {
  const electronPath = path.join(__dirname, '../../../node_modules/.bin/electron');
  const appPath = path.join(__dirname, '../../../electron/main.cjs');

  const app = await electron.launch({
    executablePath: electronPath,
    args: [appPath],
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });

  // Wait for the first window
  const page = await app.firstWindow();
  
  // Capture console logs for debugging
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.error('PAGE ERROR:', error));
  
  // Wait for app to be ready - wait for React to render
  await page.waitForLoadState('domcontentloaded');
  
  // Debug: Get page content to see what's actually rendered
  const content = await page.content();
  console.log('Page HTML length:', content.length);
  console.log('Page has #root:', content.includes('id="root"'));
  
  // Wait for the React root to have content
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root && root.children.length > 0;
  }, { timeout: 10000 });
  
  // Give React a moment to hydrate
  await page.waitForTimeout(500);
  
  return { app, page };
}

/**
 * Close the Electron app
 * @param {ElectronApplication} app
 */
export async function closeElectronApp(app) {
  await app.close();
}
