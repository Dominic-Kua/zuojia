// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import {
  createChapter,
  createScene,
  snapSceneToChapter,
  getChapterColor,
  CHAPTER_COLORS,
  CHAPTER_COLUMN_WIDTH,
} from '../../src/lib/storymap-model';
import { createChapterLayer } from '../../src/components/StoryMap/layers/ChapterLayer';

describe('storymap-model chapters', () => {
  it('creates a chapter with a color from the palette', () => {
    const chapter = createChapter({ title: 'Chapter 1', order: 0 });
    expect(chapter.title).toBe('Chapter 1');
    expect(chapter.order).toBe(0);
    expect(CHAPTER_COLORS).toContainEqual(chapter.color);
  });

  it('cycles colors when order exceeds palette length', () => {
    const chapter = createChapter({ order: CHAPTER_COLORS.length });
    expect(chapter.color).toEqual(CHAPTER_COLORS[0]);
  });

  it('returns chapter color for theme', () => {
    const chapter = createChapter({ order: 0 });
    expect(getChapterColor(chapter, false)).toBe(chapter.color.light);
    expect(getChapterColor(chapter, true)).toBe(chapter.color.dark);
  });

  it('snaps scene x to chapter column', () => {
    const scene = createScene({ x: 123, y: 456 });
    const chapter = createChapter({ order: 2 });
    const snapped = snapSceneToChapter(scene, chapter);
    expect(snapped.chapterId).toBe(chapter.id);
    expect(snapped.x).toBe(2 * CHAPTER_COLUMN_WIDTH);
    expect(snapped.y).toBe(456);
  });
});

describe('ChapterLayer', () => {
  it('renders chapter bands without crashing', () => {
    const chapters = [
      createChapter({ title: 'Ch 1', order: 0 }),
      createChapter({ title: 'Ch 2', order: 1 }),
    ];
    const layer = createChapterLayer({ getChapters: () => chapters });
    const ctx = {
      save: () => {},
      restore: () => {},
      fillRect: () => {},
      fillText: () => {},
    };

    layer.render(ctx, { view: { offset: { x: 0, y: 0 }, scale: 1 }, width: 800, height: 600 });
  });
});
