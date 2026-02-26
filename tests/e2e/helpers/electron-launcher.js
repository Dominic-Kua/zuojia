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
      NODE_ENV: 'development'
    }
  });

  // Wait for the first window
  const page = await app.firstWindow();
  
  // Wait for app to be ready
  await page.waitForLoadState('domcontentloaded');
  
  return { app, page };
}

/**
 * Close the Electron app
 * @param {ElectronApplication} app
 */
export async function closeElectronApp(app) {
  await app.close();
}
