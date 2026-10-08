// @vitest-environment node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import {
  mkdtemp,
  rm,
  mkdir,
  readFile,
  writeFile,
  rename,
} from 'fs/promises';
import os from 'os';
import { getChronologyOrdinal } from '../../src/lib/storymap-model.js';

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    writeFile: vi.fn(actual.writeFile),
    rename: vi.fn(actual.rename),
  };
});

describe('storymap/store', () => {
  let store;
  let testHome;
  let novelsRoot;

  beforeEach(async () => {
    testHome = await mkdtemp(path.join(os.tmpdir(), 'zuojia-storymap-test-'));
    novelsRoot = path.join(testHome, '.zuojia');
    process.env.ZUOJIA_NOVELS_ROOT = novelsRoot;
    process.env.ZUOJIA_STORYMAP_DEBOUNCE_MS = '50';
    store = await import('../../helper/src/storymap/store.js');
    vi.clearAllMocks();
  });

  afterEach(async () => {
    delete process.env.ZUOJIA_NOVELS_ROOT;
    delete process.env.ZUOJIA_STORYMAP_DEBOUNCE_MS;
    await rm(testHome, { recursive: true, force: true });
  });

  function novelPath(slug) {
    return path.join(novelsRoot, slug);
  }

  it('loads an existing storymap file', async () => {
    const np = novelPath('existing-novel');
    const filePath = path.join(np, 'meta', 'storymap.json');
    const existing = {
      version: 1,
      scenes: [{ id: 'scene-1', title: 'Opening' }],
      chapters: [{ id: 'chapter-1', title: 'Chapter 1' }],
      arcs: [{ id: 'arc-1', name: 'Hero Arc' }],
      sceneArcAssignments: [{ sceneId: 'scene-1', arcId: 'arc-1' }],
      currentSceneId: null,
    };
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(existing, null, 2), 'utf-8');

    const result = await store.loadStorymap(np);
    expect(result).toEqual(existing);
  });

  it('migrates legacy calendar dates to relative chronology from the earliest scene', async () => {
    const np = novelPath('legacy-chronology');
    const filePath = path.join(np, 'meta', 'storymap.json');
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify({
      version: 1,
      scenes: [
        { id: 'later', chronologyDate: '1825-01-11' },
        { id: 'start', chronologyDate: '1825-01-01' },
      ],
    }), 'utf-8');

    const result = await store.loadStorymap(np);
    const start = result.scenes.find((scene) => scene.id === 'start');
    const later = result.scenes.find((scene) => scene.id === 'later');
    expect(start.chronologyDate).toBe('Day 0 Year 0');
    expect(later.chronologyDate).toBe('Day 10 Year 0');
    expect(getChronologyOrdinal(later) - getChronologyOrdinal(start)).toBe(10);
  });

  it('returns an empty storymap when file is missing', async () => {
    const np = novelPath('missing-novel');
    const result = await store.loadStorymap(np);
    expect(result).toEqual(store.createEmptyStorymap());
  });

  it('returns an empty storymap when file contains invalid JSON', async () => {
    const np = novelPath('corrupt-novel');
    const filePath = path.join(np, 'meta', 'storymap.json');
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, '{ not json', 'utf-8');

    await expect(store.loadStorymap(np)).rejects.toThrow(/STORYMAP_LOAD_FAILED/);
  });

  it('saves a storymap to disk', async () => {
    const np = novelPath('save-novel');
    const data = {
      version: 1,
      scenes: [{ id: 'scene-2', title: 'Closing' }],
      chapters: [],
      arcs: [{ id: 'arc-2', name: 'Villain Arc' }],
      sceneArcAssignments: [],
      currentSceneId: null,
    };

    const result = await store.saveStorymap(np, data);
    expect(result.saved).toBe(true);

    const filePath = path.join(np, 'meta', 'storymap.json');
    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed).toEqual(data);
  });

  it('rejects invalid storymap data when saving', async () => {
    const np = novelPath('invalid-data-novel');
    await expect(store.saveStorymap(np, null)).rejects.toThrow(/INVALID_INPUT/);
    await expect(store.saveStorymap(np, [])).rejects.toThrow(/INVALID_INPUT/);
  });

  it('rejects paths outside ~/.zuojia', async () => {
    const badPath = path.join(os.homedir(), 'evil-novel');
    await expect(store.loadStorymap(badPath)).rejects.toThrow(/INVALID_INPUT/);
    await expect(store.saveStorymap(badPath, {})).rejects.toThrow(/INVALID_INPUT/);
  });

  it('debounces rapid saves to a single write', async () => {
    const np = novelPath('debounce-novel');
    const promises = [];
    for (let i = 0; i < 5; i += 1) {
      promises.push(store.debouncedSaveStorymap(np, { scenes: [{ id: `scene-${i}` }] }));
    }
    await Promise.all(promises);

    expect(writeFile).toHaveBeenCalledTimes(1);

    const filePath = path.join(np, 'meta', 'storymap.json');
    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.scenes[0].id).toBe('scene-4');
  });

  it('flushes pending debounced saves', async () => {
    const np = novelPath('flush-novel');
    const promise = store.debouncedSaveStorymap(np, { scenes: [{ id: 'scene-flush' }] });
    const flushed = await store.flushDebouncedStorymapSaves();
    expect(flushed).toBeUndefined();
    await promise;

    const filePath = path.join(np, 'meta', 'storymap.json');
    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.scenes[0].id).toBe('scene-flush');
  });
});
