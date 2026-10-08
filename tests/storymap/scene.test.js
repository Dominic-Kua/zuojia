// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createScene, createEmptyStorymap, parseChronologyDate } from '../../src/lib/storymap-model';
import { createSceneLayer } from '../../src/components/StoryMap/layers/SceneLayer';

describe('storymap-model createScene', () => {
  it('creates a scene with defaults', () => {
    const scene = createScene();
    expect(scene.id).toMatch(/^scene-/);
    expect(scene.title).toBe('Untitled Scene');
    expect(scene.x).toBe(0);
    expect(scene.y).toBe(0);
    expect(scene.chapterId).toBeNull();
    expect(scene.chronologyDate).toBe('Day 0 Year 0');
    expect(scene.tension).toBe('');
  });

  it('creates a scene with overrides', () => {
    const scene = createScene({ title: 'Opening', x: 10, y: 20, chapterId: 'chapter-1', chronologyDate: 'Day -15 Year 3' });
    expect(scene.title).toBe('Opening');
    expect(scene.x).toBe(10);
    expect(scene.y).toBe(20);
    expect(scene.chapterId).toBe('chapter-1');
    expect(scene.chronologyDate).toBe('Day -15 Year 3');
  });

  it('parses signed relative chronology values from the beginning of the novel', () => {
    expect(parseChronologyDate('Day 0 Year 0')).toMatchObject({ day: 0, year: 0, ordinal: 0 });
    expect(parseChronologyDate('Day -5 Year 0').ordinal).toBe(-5);
    expect(parseChronologyDate('Day 2 Year -1').ordinal).toBe(-363);
    expect(parseChronologyDate('Day 0 Year 1').ordinal).toBe(365);
  });
});

describe('storymap SceneLayer', () => {
  const scenes = [
    { id: 'scene-1', title: 'Opening', x: 0, y: 0 },
    { id: 'scene-2', title: 'Closing', x: 200, y: 100 },
  ];

  it('renders scenes without crashing', () => {
    const layer = createSceneLayer({ getScenes: () => scenes });
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 50 }),
    };

    layer.render(ctx, { view: { offset: { x: 0, y: 0 }, scale: 1 }, width: 800, height: 600 });
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('resolves scene surface, text, and accent tokens to actual canvas colors in each theme', () => {
    const previous = {
      surface: document.documentElement.style.getPropertyValue('--manuscript-surface'),
      text: document.documentElement.style.getPropertyValue('--text-primary'),
      accent: document.documentElement.style.getPropertyValue('--accent'),
      secondary: document.documentElement.style.getPropertyValue('--text-secondary'),
    };
    const fillStyles = [];
    const strokeStyles = [];
    const ctx = {
      set fillStyle(value) { fillStyles.push(value); },
      set strokeStyle(value) { strokeStyles.push(value); },
      save: vi.fn(),
      restore: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 50 }),
    };

    try {
      const layer = createSceneLayer({ getScenes: () => [{ id: 'scene-1', title: 'Opening', x: 50, y: 50 }] });
      const render = () => layer.render(ctx, {
        view: { offset: { x: 0, y: 0 }, scale: 1 },
        width: 800,
        height: 600,
      });

      document.documentElement.style.setProperty('--manuscript-surface', '#fdfcf9');
      document.documentElement.style.setProperty('--text-primary', '#26271f');
      document.documentElement.style.setProperty('--accent', '#6e9a8f');
      document.documentElement.style.setProperty('--text-secondary', '#6b6a5e');
      render();
      expect(fillStyles).toContain('#fdfcf9');
      expect(fillStyles).toContain('#26271f');
      expect(strokeStyles).toContain('#6e9a8f');

      fillStyles.length = 0;
      strokeStyles.length = 0;
      document.documentElement.style.setProperty('--manuscript-surface', '#1f2224');
      document.documentElement.style.setProperty('--text-primary', '#e9e7df');
      document.documentElement.style.setProperty('--accent', '#85b5a9');
      document.documentElement.style.setProperty('--text-secondary', '#a5a499');
      render();
      expect(fillStyles).toContain('#1f2224');
      expect(fillStyles).toContain('#e9e7df');
      expect(strokeStyles).toContain('#85b5a9');
      expect(fillStyles.some((value) => value.startsWith('var('))).toBe(false);
      expect(strokeStyles.some((value) => value.startsWith('var('))).toBe(false);
    } finally {
      document.documentElement.style.setProperty('--manuscript-surface', previous.surface);
      document.documentElement.style.setProperty('--text-primary', previous.text);
      document.documentElement.style.setProperty('--accent', previous.accent);
      document.documentElement.style.setProperty('--text-secondary', previous.secondary);
    }
  });

  it('hit tests a scene node', () => {
    const layer = createSceneLayer({ getScenes: () => scenes });
    const view = { offset: { x: 0, y: 0 }, scale: 1 };
    // scene-1 center is at (0,0); node spans x:[-70,70], y:[-30,30]
    expect(layer.hitTest(view, 0, 0)?.id).toBe('scene-1');
    expect(layer.hitTest(view, 200, 100)?.id).toBe('scene-2');
    expect(layer.hitTest(view, 500, 500)).toBeNull();
  });
});

describe('useStorymap hook', () => {
  it('loads storymap on mount', async () => {
    const loadMock = vi.fn().mockResolvedValue(createEmptyStorymap());
    const saveMock = vi.fn().mockResolvedValue({ saved: true });

    vi.doMock('../../src/lib/ipc-client', () => ({
      storymapHandlers: {
        load: loadMock,
        save: saveMock,
      },
    }));

    const React = await import('react');
    const { renderHook, waitFor } = await import('@testing-library/react');
    const { useStorymap } = await import('../../src/hooks/useStorymap');

    const { result } = renderHook(() => useStorymap('/novels/test'));

    await waitFor(() => {
      expect(result.current.storymap).toEqual(createEmptyStorymap());
    });
    expect(loadMock).toHaveBeenCalledWith('/novels/test');

    vi.doUnmock('../../src/lib/ipc-client');
  });
});
