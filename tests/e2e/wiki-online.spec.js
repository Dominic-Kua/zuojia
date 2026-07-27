import { test, expect } from '@playwright/test';
import { launchElectronApp, closeElectronApp } from './helpers/electron-launcher.js';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

let TEST_NOVEL_NAME;
let TEST_NOVEL_PATH;

async function createTestNovelWithWiki() {
  await fs.mkdir(path.join(TEST_NOVEL_PATH, 'manuscript'), { recursive: true });
  await fs.mkdir(path.join(TEST_NOVEL_PATH, 'wiki'), { recursive: true });
  await fs.mkdir(path.join(TEST_NOVEL_PATH, 'meta'), { recursive: true });

  await fs.writeFile(
    path.join(TEST_NOVEL_PATH, 'meta', 'index.json'),
    JSON.stringify({
      title: TEST_NOVEL_NAME,
      chapters: [],
      wiki: [
        { slug: 'hero', title: 'The Hero' },
        { slug: 'world', title: 'The World' },
        { slug: 'conflict', title: 'The Conflict' },
      ],
    }, null, 2)
  );

  await fs.writeFile(
    path.join(TEST_NOVEL_PATH, 'wiki', 'hero.md'),
    `---
title: The Hero
tags: [character, protagonist]
---
# The Hero

The protagonist of our story is **Aria**, a young cartographer from the coastal city of Meridian.

## Key Traits
- Brave but impulsive
- Gifted with [[conflict|ancient power]]
- Born during the [[world|Great Convergence]]

## Relationships
- Mentor: [[world|Elder Kai]]
- Rival: [[conflict|Shadow Weaver]]
`
  );

  await fs.writeFile(
    path.join(TEST_NOVEL_PATH, 'wiki', 'world.md'),
    `---
title: The World
tags: [setting, geography]
---
# The World

The story takes place in **Aethermoor**, a world of floating islands connected by ancient bridges.

## Regions
- **Meridian**: Coastal city, home of [[hero|Aria]]
- **The Shattered Peaks**: Mountains where [[conflict|Shadow Weaver]] dwells
- **The Void Sea**: Mysterious ocean at the world's edge
`
  );

  await fs.writeFile(
    path.join(TEST_NOVEL_PATH, 'wiki', 'conflict.md'),
    `---
title: The Conflict
tags: [plot, antagonist]
---
# The Conflict

The **Shadow Weaver** seeks to collapse the remaining bridges between islands, isolating each community forever.
`
  );
}

async function openNovel(page) {
  const novelList = page.getByTestId('novel-list');
  await expect(novelList).toBeVisible({ timeout: 15000 });
  const novelItem = page.locator('.novel-list-item').filter({ hasText: TEST_NOVEL_NAME });
  await expect(novelItem).toBeVisible({ timeout: 10000 });
  const openButton = novelItem.locator('.novel-list-open');
  await openButton.click();
}

test.describe('Wiki Online E2E', () => {
  let app, page;

  test.beforeAll(async () => {
    TEST_NOVEL_NAME = `e2e-wiki-online-${Date.now()}`;
    TEST_NOVEL_PATH = path.join(os.homedir(), '.zuojia', TEST_NOVEL_NAME);
    await createTestNovelWithWiki();
  });

  test.beforeEach(async () => {
    ({ app, page } = await launchElectronApp());

    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    if (app) await closeElectronApp(app);
  });

  test.afterAll(async () => {
    try { await fs.rm(TEST_NOVEL_PATH, { recursive: true, force: true }); } catch {}
  });

  test('wiki shows Ready in LLM Chat after opening novel', async () => {
    await openNovel(page);

    const llmChatButton = page.getByTestId('llm-chat-button');
    await expect(llmChatButton).toBeVisible({ timeout: 30000 });
    await expect(llmChatButton).toBeEnabled({ timeout: 60000 });

    await llmChatButton.click();
    const chatOverlay = page.getByTestId('llm-chat-overlay');
    await expect(chatOverlay).toBeVisible({ timeout: 5000 });

    const wikiIndicator = page.locator('.mcp-status-indicator');
    await expect(wikiIndicator).toBeVisible({ timeout: 5000 });
    await expect(async () => {
      const text = await wikiIndicator.textContent();
      expect(text).toContain('Ready');
    }).toPass({ timeout: 90000, intervals: [2000] });
  });

  test('wiki query returns results through LLM Chat', async () => {
    await openNovel(page);

    const llmChatButton = page.getByTestId('llm-chat-button');
    await expect(llmChatButton).toBeVisible({ timeout: 30000 });
    await expect(llmChatButton).toBeEnabled({ timeout: 60000 });

    await llmChatButton.click();
    const chatOverlay = page.getByTestId('llm-chat-overlay');
    await expect(chatOverlay).toBeVisible({ timeout: 5000 });

    const wikiIndicator = page.locator('.mcp-status-indicator');
    await expect(async () => {
      const text = await wikiIndicator.textContent();
      expect(text).toContain('Ready');
    }).toPass({ timeout: 90000, intervals: [2000] });

    const chatInput = page.getByTestId('llm-chat-input');
    await expect(chatInput).toBeEnabled({ timeout: 30000 });

    await chatInput.fill('Who is Aria?');
    const sendButton = page.getByTestId('llm-send-button');
    await expect(sendButton).toBeEnabled({ timeout: 5000 });
    await sendButton.click();

    const assistantMessage = page.locator('.llm-message.assistant .llm-message-content').first();
    await expect(assistantMessage).toBeVisible({ timeout: 120000 });
    const responseText = await assistantMessage.textContent();
    expect(responseText.length).toBeGreaterThan(10);
    expect(responseText).not.toContain('Error');
  });
});
