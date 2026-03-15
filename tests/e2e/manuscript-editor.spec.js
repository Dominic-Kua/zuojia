import { test, expect } from '@playwright/test'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'
import { closeElectronApp, launchElectronApp } from './helpers/electron-launcher.js'

test.describe('Manuscript Editor E2E', () => {
  let app
  let page
  let testNovelName
  let testNovelPath

  async function createNovel() {
    const newNovelButton = page.getByTestId('new-novel-button')
    await expect(newNovelButton).toBeVisible({ timeout: 10000 })
    await newNovelButton.click()

    const dialog = page.getByTestId('create-novel-dialog')
    await expect(dialog).toBeVisible()

    await page.getByTestId('novel-name-input').fill(testNovelName)
    await page.getByTestId('create-novel-button').click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('manuscript-editor')).toBeVisible({ timeout: 5000 })
  }

  test.beforeEach(async () => {
    ({ app, page } = await launchElectronApp())
    testNovelName = `test-manuscript-${Date.now()}`
    testNovelPath = path.join(os.homedir(), '.netwriter', testNovelName)
    await createNovel()
  })

  test.afterEach(async () => {
    if (app) {
      await closeElectronApp(app)
    }

    try {
      await fs.rm(testNovelPath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup failures for temp novels.
    }
  })

  test('keeps typing at the current caret position after delayed editor refresh', async () => {
    const editor = page.getByTestId('manuscript-editor')
    await expect(editor).toBeVisible({ timeout: 5000 })

    await editor.click()
    await page.keyboard.press('Meta+A')
    await page.keyboard.press('Backspace')

    await page.keyboard.type('Hello')
    await page.waitForTimeout(700)
    await page.keyboard.type(' world')
    await page.waitForTimeout(700)

    await expect.poll(async () => {
      return await editor.evaluate((node) => node.textContent)
    }).toBe('Hello world')
  })
})