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
    chronologyDate = new Date().toISOString().slice(0, 10),
    chapterId = null,
    location = '',
    characters = '',
    tension = 'medium',
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
