/**
 * Shared storymap data model helpers.
 * Pure functions — no Electron or DOM dependencies.
 */

export const STORYMAP_VERSION = 1;

export function createEmptyStorymap() {
  return {
    version: STORYMAP_VERSION,
    scenes: [],
    chapters: [],
    arcs: [],
    sceneArcAssignments: [],
    currentSceneId: null,
  };
}

let sceneCounter = 0;
let chapterCounter = 0;
let arcCounter = 0;

export function createSceneId(timestamp = Date.now()) {
  return `scene-${timestamp}-${sceneCounter++}`;
}

export function createChapterId(timestamp = Date.now()) {
  return `chapter-${timestamp}-${chapterCounter++}`;
}

export function createArcId(timestamp = Date.now()) {
  return `arc-${timestamp}-${arcCounter++}`;
}

export function createArc(options = {}) {
  const { name = 'Untitled Arc', color = ARC_COLORS[0] } = options;
  return {
    id: createArcId(),
    name,
    color,
  };
}

export function formatChronologyDate(day, year) {
  return `Day ${day} Year ${year}`;
}

export function parseChronologyDate(value) {
  if (typeof value !== 'string') {
    return { day: 0, year: 0, ordinal: 0, key: formatChronologyDate(0, 0) };
  }

  const relative = value.match(/^Day\s+([+-]?\d+)\s+Year\s+([+-]?\d+)$/i);
  if (relative) {
    const day = Number(relative[1]);
    const year = Number(relative[2]);
    return { day, year, ordinal: year * 365 + day, key: formatChronologyDate(day, year) };
  }

  // Read dates created by earlier storymap versions. The store migrates them
  // relative to the earliest legacy scene when loading a saved map.
  const isLegacyDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const timestamp = isLegacyDate ? Date.parse(`${value}T00:00:00Z`) : NaN;
  if (Number.isFinite(timestamp)) {
    return {
      day: 0,
      year: 0,
      ordinal: Math.floor(timestamp / 86_400_000),
      key: value,
    };
  }

  return { day: 0, year: 0, ordinal: 0, key: formatChronologyDate(0, 0) };
}

export function getChronologyOrdinal(scene) {
  return parseChronologyDate(scene?.chronologyDate).ordinal;
}

export const CHAPTER_COLORS = [
  { name: 'sage', light: '#7da27e', dark: '#9bc09c' },
  { name: 'clay', light: '#c17a5c', dark: '#d99a7a' },
  { name: 'slate', light: '#6e8da0', dark: '#8fb0c4' },
  { name: 'wheat', light: '#c7a85c', dark: '#e0c47a' },
  { name: 'plum', light: '#9b7aa0', dark: '#b89bbd' },
  { name: 'rust', light: '#b35a4a', dark: '#cf7a6a' },
  { name: 'moss', light: '#6a8f5a', dark: '#8ab07a' },
  { name: 'indigo', light: '#5d6fa8', dark: '#7d8fc8' },
];

export const ARC_COLORS = [
  { name: 'crimson', light: '#c44569', dark: '#e66767' },
  { name: 'teal', light: '#2d8a8a', dark: '#4ecdc4' },
  { name: 'gold', light: '#b38f00', dark: '#f7d794' },
  { name: 'violet', light: '#7d5ba6', dark: '#a29bfe' },
  { name: 'emerald', light: '#3d8b5d', dark: '#55efc4' },
  { name: 'coral', light: '#d66d58', dark: '#fab1a0' },
];

export const CHAPTER_COLUMN_WIDTH = 300;

export function createChapter(options = {}) {
  const {
    title = `Chapter ${(options.order ?? 0) + 1}`,
    color = CHAPTER_COLORS[(options.order ?? 0) % CHAPTER_COLORS.length],
    order = 0,
  } = options;

  return {
    id: createChapterId(),
    title,
    color,
    order,
  };
}

export function getChapterColor(chapter, isDark = false) {
  if (!chapter || !chapter.color) return null;
  return isDark ? chapter.color.dark : chapter.color.light;
}

export function snapSceneToChapter(scene, chapter) {
  if (!chapter) return scene;
  return {
    ...scene,
    chapterId: chapter.id,
    x: chapter.order * CHAPTER_COLUMN_WIDTH,
  };
}

export function createScene(options = {}) {
  const {
    title = 'Untitled Scene',
    x = 0,
    y = 0,
    chronologyDate = formatChronologyDate(0, 0),
    chapterId = null,
    location = '',
    characters = '',
    tension = '',
    notes = '',
  } = options;

  return {
    id: createSceneId(),
    title,
    x,
    y,
    chronologyDate,
    chapterId,
    location,
    characters,
    tension,
    notes,
  };
}
