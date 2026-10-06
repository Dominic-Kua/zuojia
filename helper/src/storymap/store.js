/**
 * Pure storymap persistence module.
 * No Electron imports — usable from the main process and from tests.
 */

import {
  mkdir,
  readFile,
  realpath,
  rename,
  unlink,
  writeFile,
} from 'fs/promises';
import os from 'os';
import path from 'path';
import { createEmptyStorymap, STORYMAP_VERSION } from '../../../src/lib/storymap-model.js';

const rawDebounceMs = Number(process.env.ZUOJIA_STORYMAP_DEBOUNCE_MS);
const DEBOUNCE_MS = Number.isFinite(rawDebounceMs) && rawDebounceMs > 0 ? rawDebounceMs : 300;

function getNovelsRoot() {
  const root = process.env.ZUOJIA_NOVELS_ROOT || path.join(os.homedir(), '.zuojia');
  return path.resolve(root);
}

async function resolveStorymapFilePath(novelPath) {
  if (typeof novelPath !== 'string' || !path.isAbsolute(novelPath)) {
    throw new Error('INVALID_INPUT: novelPath must be an absolute filesystem path');
  }

  const novelsRoot = getNovelsRoot();
  let realNovelPath;
  try {
    realNovelPath = await realpath(novelPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      // The novel directory may not exist yet; validate the parent instead.
      realNovelPath = novelPath;
    } else {
      throw err;
    }
  }

  const realRoot = await realpath(novelsRoot).catch(() => novelsRoot);
  const rel = path.relative(realRoot, realNovelPath);

  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`INVALID_INPUT: novelPath must be under ${novelsRoot}`);
  }

  return path.join(realNovelPath, 'meta', 'storymap.json');
}

/**
 * Validate and normalize a storymap payload.
 * Accepts scenes, chapters, arcs, and scene-to-arc assignments,
 * including arcs with zero scenes. Missing array fields are defaulted
 * to empty arrays so later epics can read the shape reliably.
 */
export function validateStorymap(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }

  return {
    version: Number.isFinite(data.version) ? data.version : STORYMAP_VERSION,
    scenes: Array.isArray(data.scenes) ? data.scenes : [],
    chapters: Array.isArray(data.chapters) ? data.chapters : [],
    arcs: Array.isArray(data.arcs) ? data.arcs : [],
    sceneArcAssignments: Array.isArray(data.sceneArcAssignments) ? data.sceneArcAssignments : [],
    currentSceneId: typeof data.currentSceneId === 'string' ? data.currentSceneId : null,
  };
}

/**
 * Load the storymap for a novel. Returns an empty map if the file
 * does not exist yet.
 */
export async function loadStorymap(novelPath) {
  const filePath = await resolveStorymapFilePath(novelPath);

  try {
    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    const validated = validateStorymap(parsed);
    return validated ?? createEmptyStorymap();
  } catch (err) {
    if (err.code === 'ENOENT') {
      return createEmptyStorymap();
    }
    if (err instanceof SyntaxError) {
      throw new Error(`STORYMAP_LOAD_FAILED: ${filePath} contains invalid JSON`, { cause: err });
    }
    throw new Error(`STORYMAP_LOAD_FAILED: could not read ${filePath}`, { cause: err });
  }
}

/**
 * Save the storymap for a novel. Writes atomically (temp file + rename)
 * and creates the meta directory if needed.
 */
export async function saveStorymap(novelPath, data) {
  const filePath = await resolveStorymapFilePath(novelPath);
  const validated = validateStorymap(data);
  if (!validated) {
    throw new Error('INVALID_INPUT: storymap data must be a non-null object');
  }

  let serialized;
  try {
    serialized = JSON.stringify(validated, null, 2);
  } catch (err) {
    throw new Error('STORYMAP_SERIALIZE_FAILED: data cannot be serialized to JSON', { cause: err });
  }

  const metaDir = path.dirname(filePath);
  await mkdir(metaDir, { recursive: true });

  const randomSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tempPath = `${filePath}.tmp-${randomSuffix}`;

  try {
    await writeFile(tempPath, serialized, 'utf-8');
    await rename(tempPath, filePath);
  } catch (err) {
    await unlink(tempPath).catch(() => {});
    throw new Error(`STORYMAP_SAVE_FAILED: could not write ${filePath}`, { cause: err });
  }

  return { saved: true };
}

const debounceState = new Map();

/**
 * Debounced wrapper around saveStorymap. Calls for the same novelPath
 * are coalesced; only the final state is written once the debounce window
 * expires. All callers in the same window receive the same result.
 */
export function debouncedSaveStorymap(novelPath, data) {
  if (typeof novelPath !== 'string') {
    return Promise.reject(new Error('INVALID_INPUT: novelPath must be a string'));
  }

  let state = debounceState.get(novelPath);
  if (!state) {
    state = {
      timer: null,
      promise: null,
      latestData: null,
      resolve: null,
      reject: null,
      inFlight: false,
    };
    debounceState.set(novelPath, state);
  }

  state.latestData = data;

  if (state.timer) {
    clearTimeout(state.timer);
  }

  if (!state.promise) {
    state.promise = new Promise((resolve, reject) => {
      state.resolve = resolve;
      state.reject = reject;
    });
  }

  state.timer = setTimeout(async () => {
    if (state.inFlight) {
      // If a previous save is still running, wait for it before starting the next one.
      await state.promise.catch(() => {});
    }

    debounceState.delete(novelPath);
    const dataToSave = state.latestData;
    state.inFlight = true;

    try {
      const result = await saveStorymap(novelPath, dataToSave);
      state.resolve(result);
    } catch (err) {
      state.reject(err);
    } finally {
      state.inFlight = false;
    }
  }, DEBOUNCE_MS);

  return state.promise;
}

export async function flushDebouncedStorymapSaves() {
  const entries = Array.from(debounceState.entries());
  debounceState.clear();

  for (const [novelPath, state] of entries) {
    if (state.timer) {
      clearTimeout(state.timer);
    }
    try {
      await saveStorymap(novelPath, state.latestData);
      state.resolve({ saved: true });
    } catch (err) {
      state.reject(err);
      throw err;
    }
  }
}

export { createEmptyStorymap };
