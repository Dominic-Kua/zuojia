import { test, expect } from '@playwright/test';
import { launchElectronApp, closeElectronApp } from './helpers/electron-launcher.js';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

async function createNovelThroughUI(page, novelName) {
  await page.getByTestId('new-novel-button').click();
  const dialog = page.getByTestId('create-novel-dialog');
  await expect(dialog).toBeVisible({ timeout: 5000 });
  await page.getByTestId('novel-name-input').fill(novelName);
  await page.getByTestId('create-novel-button').click();
  await expect(dialog).not.toBeVisible({ timeout: 10000 });
}

async function openStorymap(app, page) {
  const windowPromise = app.waitForEvent('window', { timeout: 10000 });
  await page.getByTestId('open-storymap-button').click();
  const storymapPage = await windowPromise;
  storymapPage.storymapRuntimeErrors = [];
  storymapPage.on('pageerror', (error) => storymapPage.storymapRuntimeErrors.push(error.message));
  storymapPage.on('console', (message) => {
    if (message.type() === 'error') storymapPage.storymapRuntimeErrors.push(message.text());
  });
  await expect(storymapPage.getByTestId('storymap-window')).toBeVisible({ timeout: 10000 });
  return storymapPage;
}

async function readStorymap(novelPath) {
  const filePath = path.join(novelPath, 'meta', 'storymap.json');
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { scenes: [], chapters: [], arcs: [], sceneArcAssignments: [], currentSceneId: null };
    }
    throw error;
  }
}

async function waitForStorymap(novelPath, predicate) {
  await expect.poll(async () => predicate(await readStorymap(novelPath)), { timeout: 10000 }).toBe(true);
  return readStorymap(novelPath);
}

async function moveSceneTo(storymapPage, novelPath, sceneId, targetX, targetY) {
  const scene = (await readStorymap(novelPath)).scenes.find((item) => item.id === sceneId);
  const canvas = storymapPage.getByTestId('storymap-canvas');
  const box = await canvas.boundingBox();
  const start = { x: box.x + scene.x, y: box.y + scene.y };
  await storymapPage.mouse.move(start.x, start.y);
  await storymapPage.mouse.down();
  await storymapPage.mouse.move(box.x + targetX, box.y + targetY, { steps: 8 });
  await storymapPage.mouse.up();
  await expect.poll(async () => {
    const updated = (await readStorymap(novelPath)).scenes.find((item) => item.id === sceneId);
    return Math.hypot(updated.x - targetX, updated.y - targetY);
  }, { timeout: 10000 }).toBeLessThan(2);
}

async function addScene(storymapPage, novelPath, chronology = { day: 0, year: 0 }, entryPoint = 'toolbar') {
  const before = await readStorymap(novelPath);
  const addButtonTestId = entryPoint === 'empty-state' ? 'empty-add-scene-button' : 'storymap-add-scene-button';
  await storymapPage.getByTestId(addButtonTestId).click();
  await expect(storymapPage.getByTestId('storymap-action-dialog')).toBeVisible();
  await storymapPage.getByTestId('storymap-chronology-day-input').fill(String(chronology.day));
  await storymapPage.getByTestId('storymap-chronology-year-input').fill(String(chronology.year));
  await storymapPage.getByTestId('storymap-action-confirm').click();
  await expect.poll(async () => (await readStorymap(novelPath)).scenes.length, { timeout: 10000 })
    .toBe(before.scenes.length + 1);
  const scene = (await readStorymap(novelPath)).scenes.at(-1);

  // Separate created nodes so subsequent canvas clicks target one unambiguously.
  const targetX = 500 + before.scenes.length * 180;
  const targetY = 240 + before.scenes.length * 100;
  await moveSceneTo(storymapPage, novelPath, scene.id, targetX, targetY);
  return scene.id;
}

async function clickScene(storymapPage, novelPath, sceneId, modifiers = []) {
  const scene = (await readStorymap(novelPath)).scenes.find((item) => item.id === sceneId);
  const canvas = storymapPage.getByTestId('storymap-canvas');
  const box = await canvas.boundingBox();
  for (const modifier of modifiers) await storymapPage.keyboard.down(modifier);
  await storymapPage.mouse.click(box.x + scene.x, box.y + scene.y);
  for (const modifier of modifiers.slice().reverse()) await storymapPage.keyboard.up(modifier);
}

async function createArc(storymapPage, name) {
  if (!(await storymapPage.getByTestId('arc-panel').isVisible().catch(() => false))) {
    await storymapPage.getByRole('button', { name: 'Arcs', exact: true }).click();
  }
  await expect(storymapPage.getByTestId('arc-panel')).toBeVisible();
  const before = await readStorymapFromPage(storymapPage);
  await storymapPage.getByTestId('arc-panel-create').click();
  await storymapPage.getByTestId('arc-panel-name-input').fill(name);
  await storymapPage.getByTestId('arc-panel-form-confirm').click();
  await expect.poll(async () => (await readStorymapFromPage(storymapPage)).arcs.length, { timeout: 10000 })
    .toBe(before.arcs.length + 1);
  return (await readStorymapFromPage(storymapPage)).arcs.at(-1);
}

async function readStorymapFromPage(storymapPage) {
  const novelPath = await storymapPage.evaluate(() => new URLSearchParams(window.location.search).get('novelPath'));
  return readStorymap(novelPath);
}

function hexToRgb(hex) {
  const digits = hex.replace('#', '');
  return [0, 2, 4].map((start) => parseInt(digits.slice(start, start + 2), 16));
}

async function canvasHasColorNear(storymapPage, x, y, expectedHex, tolerance = 35) {
  return storymapPage.evaluate(({ centerX, centerY, expected, maxDistance }) => {
    const canvas = document.querySelector('[data-testid="storymap-canvas"]');
    const ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    const px = Math.round(centerX * ratio);
    const py = Math.round(centerY * ratio);
    for (let offsetY = -3; offsetY <= 3; offsetY += 1) {
      for (let offsetX = -3; offsetX <= 3; offsetX += 1) {
        const rgb = Array.from(ctx.getImageData(px + offsetX, py + offsetY, 1, 1).data).slice(0, 3);
        const distance = Math.hypot(rgb[0] - expected[0], rgb[1] - expected[1], rgb[2] - expected[2]);
        if (distance <= maxDistance) return true;
      }
    }
    return false;
  }, { centerX: x, centerY: y, expected: hexToRgb(expectedHex), maxDistance: tolerance });
}

async function openArcManager(storymapPage, arc) {
  const item = storymapPage.getByTestId(`arc-panel-item-${arc.id}`);
  await item.locator('.arc-name').click({ button: 'right' });
  await expect(storymapPage.getByTestId('arc-management-modal')).toBeVisible();
}

test.describe('Story Map E2E', () => {
  let app;
  let page;
  let storymapPage;
  let novelName;
  let novelPath;

  test.beforeEach(async () => {
    ({ app, page } = await launchElectronApp());
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    novelName = `test-storymap-${Date.now()}`;
    novelPath = path.join(os.homedir(), '.zuojia', novelName);
    await createNovelThroughUI(page, novelName);
  });

  test.afterEach(async () => {
    if (app) await closeElectronApp(app);
    await fs.rm(novelPath, { recursive: true, force: true }).catch(() => {});
  });

  test('opens cleanly and shows the empty-canvas prompt', async () => {
    storymapPage = await openStorymap(app, page);
    await expect(storymapPage.getByTestId('storymap-empty-state'))
      .toContainText('No scenes yet. Drop your first idea here.');
    await storymapPage.getByRole('button', { name: 'Arcs', exact: true }).click();
    await expect(storymapPage.getByTestId('arc-panel'))
      .toContainText('No arcs yet. Select scenes and create one.');
    await storymapPage.getByRole('button', { name: 'Close arc panel' }).click();
    await storymapPage.waitForTimeout(200);
    expect(storymapPage.storymapRuntimeErrors).toEqual([]);
  });

  test('creates, moves, edits, marks current, and deletes scenes with persistence', async () => {
    await fs.rm(path.join(novelPath, 'meta', 'storymap.json'), { force: true });
    const storymapExistedBeforeOpen = await fs.access(path.join(novelPath, 'meta', 'storymap.json'))
      .then(() => true)
      .catch(() => false);
    expect(storymapExistedBeforeOpen).toBe(false);
    storymapPage = await openStorymap(app, page);
    await expect(storymapPage.getByTestId('storymap-empty-state')).toBeVisible();
    const sceneId = await addScene(storymapPage, novelPath, { day: -14, year: 0 }, 'empty-state');

    let data = await readStorymap(novelPath);
    expect(data.scenes[0]).toMatchObject({ id: sceneId, chronologyDate: 'Day -14 Year 0' });

    const original = data.scenes[0];
    await moveSceneTo(storymapPage, novelPath, sceneId, original.x + 80, original.y + 50);
    await clickScene(storymapPage, novelPath, sceneId);
    const notesPanel = storymapPage.getByTestId('scene-notes-panel');
    await expect(notesPanel).toBeVisible();

    await storymapPage.locator('input[placeholder="Where does this scene happen?"]').fill('Old observatory');
    await storymapPage.getByTestId('scene-characters-input').fill('Mara');
    await notesPanel.getByPlaceholder(/What issue does this scene/).fill('Whether revenge will protect Mara or consume her.');
    await notesPanel.locator('textarea').fill('She discovers the hidden letter.');
    await notesPanel.getByRole('button', { name: 'Mark as current' }).click();

    data = await waitForStorymap(novelPath, (current) => {
      const scene = current.scenes.find((item) => item.id === sceneId);
      return scene?.location === 'Old observatory'
        && scene.characters === 'Mara'
        && scene.tension === 'Whether revenge will protect Mara or consume her.'
        && scene.notes === 'She discovers the hidden letter.'
        && current.currentSceneId === sceneId;
    });
    expect(data.currentSceneId).toBe(sceneId);

    await storymapPage.keyboard.press('Delete');
    await expect(storymapPage.getByTestId('storymap-action-dialog')).toBeVisible();
    await storymapPage.getByRole('button', { name: 'Delete Scene', exact: true }).click();
    data = await waitForStorymap(novelPath, (current) => current.scenes.length === 0);
    expect(data.currentSceneId).toBeNull();
  });

  test('uses the novel chapter list and refreshes it when the novel gains a chapter', async () => {
    storymapPage = await openStorymap(app, page);
    const sceneId = await addScene(storymapPage, novelPath);
    await clickScene(storymapPage, novelPath, sceneId);

    const novelIndexPath = path.join(novelPath, 'meta', 'index.json');
    const initialIndex = JSON.parse(await fs.readFile(novelIndexPath, 'utf-8'));
    let chapterSelect = storymapPage.locator('[data-testid="scene-notes-panel"] select').first();
    await expect(chapterSelect.locator('option')).toHaveCount(initialIndex.chapters.length + 1);
    const firstChapter = initialIndex.chapters[0];
    await chapterSelect.selectOption(firstChapter.filename);
    let data = await waitForStorymap(novelPath, (current) => current.scenes[0]?.chapterId === firstChapter.filename);

    await page.getByRole('button', { name: 'Add chapter' }).click();
    await expect.poll(async () => {
      const index = JSON.parse(await fs.readFile(novelIndexPath, 'utf-8'));
      return index.chapters.length;
    }).toBe(initialIndex.chapters.length + 1);
    const updatedIndex = JSON.parse(await fs.readFile(novelIndexPath, 'utf-8'));
    const newChapter = updatedIndex.chapters.at(-1);

    await storymapPage.close();
    storymapPage = await openStorymap(app, page);
    await clickScene(storymapPage, novelPath, sceneId);
    chapterSelect = storymapPage.locator('[data-testid="scene-notes-panel"] select').first();
    await expect.poll(async () => chapterSelect.locator('option').count()).toBe(updatedIndex.chapters.length + 1);
    await chapterSelect.selectOption(newChapter.filename);
    data = await waitForStorymap(novelPath, (current) => current.scenes[0]?.chapterId === newChapter.filename);
    expect(data.scenes[0].x).toBe((updatedIndex.chapters.length - 1) * 300);
    const beforeViews = JSON.stringify(data.scenes);

    await storymapPage.getByRole('button', { name: 'Temporal', exact: true }).click();
    await expect(storymapPage.getByRole('button', { name: 'Split', exact: true })).toBeVisible();
    await storymapPage.getByRole('button', { name: 'Split', exact: true }).click();
    await expect(storymapPage.getByRole('button', { name: 'Split', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await storymapPage.getByRole('button', { name: 'Sequential', exact: true }).click();

    expect(JSON.stringify((await readStorymap(novelPath)).scenes)).toBe(beforeViews);
  });

  test('creates and assigns a prospective arc, supports multi-arc membership and connection modes', async () => {
    storymapPage = await openStorymap(app, page);
    const firstSceneId = await addScene(storymapPage, novelPath, { day: 0, year: -200 });
    const secondSceneId = await addScene(storymapPage, novelPath, { day: 0, year: 2026 });
    const arc = await createArc(storymapPage, 'Revenge thread');

    await clickScene(storymapPage, novelPath, firstSceneId, ['Control']);
    await clickScene(storymapPage, novelPath, secondSceneId, ['Control']);
    const arcRow = storymapPage.getByTestId(`arc-panel-item-${arc.id}`);
    await arcRow.getByRole('button', { name: 'Assign' }).click();

    await expect.poll(async () => (await readStorymap(novelPath)).sceneArcAssignments.length, { timeout: 10000 })
      .toBe(2);

    await clickScene(storymapPage, novelPath, firstSceneId, ['Control']);
    await storymapPage.getByTestId('arc-panel-retroactive').click();
    await storymapPage.locator('input[placeholder="New arc name"]').fill('Second thread');
    await storymapPage.getByRole('button', { name: 'Confirm', exact: true }).click();

    let data = await waitForStorymap(novelPath, (current) => current.arcs.length === 2);
    expect(data.sceneArcAssignments.filter((item) => item.sceneId === firstSceneId)).toHaveLength(2);
    const positionsBeforeModeChange = data.scenes.map(({ id, x, y }) => ({ id, x, y }));

    await storymapPage.getByRole('group', { name: 'Arc connection mode' }).getByRole('button', { name: 'Chronological' }).click();
    await expect(storymapPage.getByRole('group', { name: 'Arc connection mode' }).getByRole('button', { name: 'Chronological' }))
      .toHaveAttribute('aria-pressed', 'true');
    await storymapPage.getByRole('group', { name: 'Arc connection mode' }).getByRole('button', { name: 'Sequential' }).click();

    data = await readStorymap(novelPath);
    expect(data.scenes.map(({ id, x, y }) => ({ id, x, y }))).toEqual(positionsBeforeModeChange);
  });

  test('creates an arc retroactively and can assign a selection to an existing arc', async () => {
    storymapPage = await openStorymap(app, page);
    const firstSceneId = await addScene(storymapPage, novelPath);
    const secondSceneId = await addScene(storymapPage, novelPath);

    const arc = await createArc(storymapPage, 'Found family');
    await clickScene(storymapPage, novelPath, firstSceneId, ['Control']);
    await clickScene(storymapPage, novelPath, secondSceneId, ['Control']);
    await storymapPage.getByTestId('arc-panel-retroactive').click();
    await storymapPage.locator('select').filter({ has: storymapPage.locator(`option[value="${arc.id}"]`) }).selectOption(arc.id);
    await storymapPage.getByRole('button', { name: 'Confirm', exact: true }).click();

    const data = await waitForStorymap(novelPath, (current) => current.sceneArcAssignments.length === 2);
    expect(data.arcs).toHaveLength(1);
    expect(data.sceneArcAssignments.every((item) => item.arcId === arc.id)).toBe(true);
  });

  test('renames, recolors, and deletes an arc while preserving its scenes', async () => {
    storymapPage = await openStorymap(app, page);
    const sceneId = await addScene(storymapPage, novelPath);
    const arc = await createArc(storymapPage, 'Old title');

    await expect(storymapPage.getByTestId(`arc-panel-item-${arc.id}`)).toContainText("It'll wait.");
    await openArcManager(storymapPage, arc);
    await storymapPage.locator('.arc-management-modal input[type="text"]').fill('New title');
    await storymapPage.getByTestId('arc-rename-submit').click();
    await expect.poll(async () => (await readStorymap(novelPath)).arcs[0]?.name).toBe('New title');

    await openArcManager(storymapPage, arc);
    await storymapPage.getByRole('button', { name: 'Color', exact: true }).click();
    await storymapPage.getByRole('button', { name: 'Color 3' }).click();
    let data = await waitForStorymap(novelPath, (current) => current.arcs[0]?.color?.name === 'gold');
    expect(data.arcs[0].color.name).toBe('gold');

    await openArcManager(storymapPage, arc);
    await storymapPage.getByRole('button', { name: 'Delete Arc' }).click();
    await storymapPage.getByTestId('arc-delete-confirm').click();
    data = await waitForStorymap(novelPath, (current) => current.arcs.length === 0);
    expect(data.scenes.map((scene) => scene.id)).toContain(sceneId);
  });

  test('merges arcs and splits selected scenes into a new arc', async () => {
    storymapPage = await openStorymap(app, page);
    const firstSceneId = await addScene(storymapPage, novelPath);
    const secondSceneId = await addScene(storymapPage, novelPath);
    const firstArc = await createArc(storymapPage, 'Thread A');
    const secondArc = await createArc(storymapPage, 'Thread B');

    await clickScene(storymapPage, novelPath, firstSceneId, ['Control']);
    await storymapPage.getByTestId(`arc-panel-item-${firstArc.id}`).getByRole('button', { name: 'Assign' }).click();
    await clickScene(storymapPage, novelPath, secondSceneId, ['Control']);
    await storymapPage.getByTestId(`arc-panel-item-${secondArc.id}`).getByRole('button', { name: 'Assign' }).click();

    await openArcManager(storymapPage, firstArc);
    await storymapPage.getByRole('button', { name: 'Merge', exact: true }).first().click();
    await storymapPage.locator('.arc-management-modal .modal-body select').selectOption(secondArc.id);
    await storymapPage.locator('.arc-management-modal .modal-body form button[type="submit"]').click();

    let data = await waitForStorymap(novelPath, (current) => current.arcs.length === 1);
    expect(data.sceneArcAssignments).toHaveLength(2);
    expect(data.sceneArcAssignments.every((item) => item.arcId === secondArc.id)).toBe(true);

    await openArcManager(storymapPage, secondArc);
    await storymapPage.getByRole('button', { name: 'Split', exact: true }).click();
    await storymapPage.locator('.arc-management-modal input[type="text"]').fill('Thread B split');
    await storymapPage.locator('.arc-management-modal .checkbox-row').filter({ hasText: 'Scene 1' }).locator('input').check();
    await storymapPage.locator('.arc-management-modal .modal-body form button[type="submit"]').click();

    data = await waitForStorymap(novelPath, (current) => current.arcs.length === 2);
    expect(data.sceneArcAssignments).toHaveLength(2);
    expect(new Set(data.sceneArcAssignments.map((item) => item.arcId)).size).toBe(2);
  });

  test('renders arc hover focus and restores the canvas after leaving the thread', async () => {
    storymapPage = await openStorymap(app, page);
    const firstSceneId = await addScene(storymapPage, novelPath);
    const secondSceneId = await addScene(storymapPage, novelPath);
    const arc = await createArc(storymapPage, 'Hover me');

    await clickScene(storymapPage, novelPath, firstSceneId, ['Control']);
    await clickScene(storymapPage, novelPath, secondSceneId, ['Control']);
    await storymapPage.getByTestId(`arc-panel-item-${arc.id}`).getByRole('button', { name: 'Assign' }).click();

    const data = await readStorymap(novelPath);
    const first = data.scenes.find((scene) => scene.id === firstSceneId);
    const second = data.scenes.find((scene) => scene.id === secondSceneId);
    const box = await storymapPage.getByTestId('storymap-canvas').boundingBox();
    await storymapPage.mouse.move(box.x + (first.x + second.x) / 2, box.y + (first.y + second.y) / 2);
    await expect(storymapPage.locator('.arc-hover-tooltip')).toHaveText('Hover me');
    await clickScene(storymapPage, novelPath, secondSceneId);
    await expect(storymapPage.getByTestId('scene-notes-panel')).toHaveCount(0);
    await storymapPage.mouse.move(box.x + 20, box.y + 20);
    await expect(storymapPage.locator('.arc-hover-tooltip')).toHaveCount(0);
    await clickScene(storymapPage, novelPath, secondSceneId);
    await expect(storymapPage.getByTestId('scene-notes-panel')).toBeVisible();
  });

  test('deleting an assigned scene removes its thread membership but preserves the arc', async () => {
    storymapPage = await openStorymap(app, page);
    const sceneId = await addScene(storymapPage, novelPath);
    const arc = await createArc(storymapPage, 'Still waiting');
    await clickScene(storymapPage, novelPath, sceneId, ['Control']);
    await storymapPage.getByTestId(`arc-panel-item-${arc.id}`).getByRole('button', { name: 'Assign' }).click();
    await expect.poll(async () => (await readStorymap(novelPath)).sceneArcAssignments.length).toBe(1);

    await clickScene(storymapPage, novelPath, sceneId);
    await storymapPage.keyboard.press('Delete');
    await storymapPage.getByRole('button', { name: 'Delete Scene', exact: true }).click();
    const data = await waitForStorymap(novelPath, (current) => current.scenes.length === 0);
    expect(data.sceneArcAssignments).toEqual([]);
    expect(data.arcs).toHaveLength(1);
    await expect(storymapPage.getByTestId(`arc-panel-item-${arc.id}`)).toContainText("It'll wait.");
  });

  test('pans and zooms the canvas and restores the saved view after reopening', async () => {
    storymapPage = await openStorymap(app, page);
    const canvas = storymapPage.getByTestId('storymap-canvas');
    const box = await canvas.boundingBox();
    const storageKey = `zuojia-storymap-view-sequential-${novelPath}`;

    await storymapPage.mouse.move(box.x + box.width - 100, box.y + box.height - 100);
    await storymapPage.mouse.down();
    await storymapPage.mouse.move(box.x + box.width - 40, box.y + box.height - 60, { steps: 5 });
    await storymapPage.mouse.up();
    await storymapPage.mouse.move(box.x + box.width - 100, box.y + box.height - 100);
    await storymapPage.mouse.wheel(0, -120);

    const storedView = await storymapPage.evaluate((key) => localStorage.getItem(key), storageKey);
    expect(JSON.parse(storedView).offset).not.toEqual({ x: 0, y: 0 });
    expect(JSON.parse(storedView).scale).toBeGreaterThan(1);

    await storymapPage.close();
    storymapPage = await openStorymap(app, page);
    const restoredView = await storymapPage.evaluate((key) => localStorage.getItem(key), storageKey);
    expect(JSON.parse(restoredView)).toEqual(JSON.parse(storedView));
  });

  test('keyboard shortcuts create scenes, toggle views and open the arc panel', async () => {
    storymapPage = await openStorymap(app, page);
    await expect(storymapPage.getByTestId('storymap-empty-state')).toBeVisible();
    await storymapPage.keyboard.press('n');
    await expect(storymapPage.getByTestId('storymap-action-dialog')).toBeVisible();
    await expect(storymapPage.getByTestId('storymap-chronology-day-input')).toHaveValue('0');
    await expect(storymapPage.getByTestId('storymap-chronology-year-input')).toHaveValue('0');
    await storymapPage.getByTestId('storymap-chronology-day-input').fill('0');
    await storymapPage.getByTestId('storymap-chronology-year-input').fill('0');
    await storymapPage.getByTestId('storymap-action-confirm').click();
    await expect.poll(async () => (await readStorymap(novelPath)).scenes.length).toBe(1);

    await storymapPage.keyboard.press('t');
    await expect(storymapPage.getByRole('button', { name: 'Temporal', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await storymapPage.keyboard.press('s');
    await expect(storymapPage.getByRole('button', { name: 'Split', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await storymapPage.keyboard.press('a');
    await expect(storymapPage.getByTestId('arc-panel')).toBeVisible();
    await storymapPage.keyboard.press('a');
    await expect(storymapPage.getByTestId('arc-panel')).toHaveCount(0);

    await storymapPage.keyboard.press('?');
    await expect(storymapPage.getByTestId('keyboard-help-overlay')).toBeVisible();
    await storymapPage.keyboard.press('Escape');
    await expect(storymapPage.getByTestId('keyboard-help-overlay')).toHaveCount(0);
  });

  test('follows the main application light/dark theme', async () => {
    storymapPage = await openStorymap(app, page);
    await expect.poll(async () => storymapPage.locator('html').getAttribute('data-theme')).toBe('light');

    await page.getByRole('button', { name: 'Dark Mode' }).click();
    await expect.poll(async () => storymapPage.locator('html').getAttribute('data-theme')).toBe('dark');

    await page.getByRole('button', { name: 'Light Mode' }).click();
    await expect.poll(async () => storymapPage.locator('html').getAttribute('data-theme')).toBe('light');
  });

  test('renders readable scene surfaces and colored arc threads in light and dark themes', async () => {
    storymapPage = await openStorymap(app, page);
    const firstSceneId = await addScene(storymapPage, novelPath);
    const secondSceneId = await addScene(storymapPage, novelPath);
    const arc = await createArc(storymapPage, 'Visible thread');
    await clickScene(storymapPage, novelPath, firstSceneId, ['Control']);
    await clickScene(storymapPage, novelPath, secondSceneId, ['Control']);
    await storymapPage.getByTestId(`arc-panel-item-${arc.id}`).getByRole('button', { name: 'Assign' }).click();

    let data = await waitForStorymap(novelPath, (current) => current.sceneArcAssignments.length === 2);
    const first = data.scenes.find((scene) => scene.id === firstSceneId);
    const second = data.scenes.find((scene) => scene.id === secondSceneId);
    const scenePixel = { x: first.x + 45, y: first.y + 20 };
    const arcPixel = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    const lightArcColor = data.arcs.find((item) => item.id === arc.id).color.light;

    await expect.poll(() => canvasHasColorNear(storymapPage, scenePixel.x, scenePixel.y, '#fdfcf9', 15)).toBe(true);
    await expect.poll(() => canvasHasColorNear(storymapPage, arcPixel.x, arcPixel.y, lightArcColor, 40)).toBe(true);

    await page.getByRole('button', { name: 'Dark Mode' }).click();
    await expect.poll(async () => storymapPage.locator('html').getAttribute('data-theme')).toBe('dark');
    data = await readStorymap(novelPath);
    const darkArcColor = data.arcs.find((item) => item.id === arc.id).color.dark;
    await expect.poll(() => canvasHasColorNear(storymapPage, scenePixel.x, scenePixel.y, '#1f2224', 15)).toBe(true);
    await expect.poll(() => canvasHasColorNear(storymapPage, arcPixel.x, arcPixel.y, darkArcColor, 40)).toBe(true);
  });

  test('creates wiki links from scene notes, navigates to a page, and marks missing links broken', async () => {
    const createResult = await page.evaluate(async ({ novelPath: targetPath }) => window.electronAPI.invoke(
      'helper:wiki:create',
      { novelPath: targetPath, title: 'Alice', content: '# Alice\nA character page.' }
    ), { novelPath });
    expect(createResult.status).toBe('ok');
    await page.evaluate((targetPath) => window.dispatchEvent(new CustomEvent('zuojia:wiki-pages-updated', {
      detail: { novelPath: targetPath },
    })), novelPath);
    await expect(page.getByText('Alice', { exact: true }).first()).toBeVisible({ timeout: 10000 });

    storymapPage = await openStorymap(app, page);
    const sceneId = await addScene(storymapPage, novelPath);
    await clickScene(storymapPage, novelPath, sceneId);
    await storymapPage.getByTestId('scene-characters-input').fill('Ali');
    await expect(storymapPage.getByTestId('scene-wiki-dropdown')).toBeVisible();
    await storymapPage.getByTestId('scene-wiki-dropdown').getByRole('option', { name: 'Alice' }).click();
    await expect.poll(async () => (await readStorymap(novelPath)).scenes[0]?.notes)
      .toContain('[[alice|Alice]]');
    const noteWikiLink = storymapPage.locator('.scene-notes-wiki-rendered a.wiki-link');
    await expect(noteWikiLink).toHaveText('Alice');
    await noteWikiLink.click();
    await expect(page.getByTestId('wiki-preview')).toContainText('A character page.', { timeout: 10000 });

    // A non-existent target remains visible as a broken link in the notes preview.
    await clickScene(storymapPage, novelPath, sceneId);
    await storymapPage.locator('[data-testid="scene-notes-panel"] textarea').fill('See [[missing-page|Missing Page]].');
    await expect(storymapPage.locator('.wiki-link-broken')).toHaveText('Missing Page');
  });

  test('persists scenes and arc data after closing and reopening the map window', async () => {
    storymapPage = await openStorymap(app, page);
    const sceneId = await addScene(storymapPage, novelPath);
    const arc = await createArc(storymapPage, 'Persistent thread');
    await clickScene(storymapPage, novelPath, sceneId, ['Control']);
    await storymapPage.getByTestId(`arc-panel-item-${arc.id}`).getByRole('button', { name: 'Assign' }).click();
    await waitForStorymap(novelPath, (current) => current.sceneArcAssignments.length === 1);

    await clickScene(storymapPage, novelPath, sceneId);
    await storymapPage.getByTestId('scene-notes-panel').locator('textarea').fill('Survives closing the map.');
    await waitForStorymap(novelPath, (current) => current.scenes[0]?.notes === 'Survives closing the map.');
    const beforeClose = await readStorymap(novelPath);
    const persistedPosition = beforeClose.scenes.find((scene) => scene.id === sceneId);

    await storymapPage.close();
    storymapPage = await openStorymap(app, page);
    const data = await readStorymap(novelPath);
    expect(data.scenes).toHaveLength(1);
    expect(data.scenes[0]).toMatchObject({
      x: persistedPosition.x,
      y: persistedPosition.y,
      notes: 'Survives closing the map.',
    });
    expect(data.arcs[0].name).toBe('Persistent thread');
    expect(data.sceneArcAssignments).toHaveLength(1);
  });
});
