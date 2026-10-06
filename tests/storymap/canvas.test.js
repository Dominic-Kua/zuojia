// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createViewState,
  worldToScreen,
  screenToWorld,
  panBy,
  zoomAt,
  clampScale,
  serializeView,
  deserializeView,
  loadViewForNovel,
  saveViewForNovel,
} from '../../src/lib/storymap-canvas/view';
import { createLayerRegistry } from '../../src/lib/storymap-canvas/layer';

describe('storymap-canvas/view', () => {
  it('creates default view state', () => {
    const view = createViewState();
    expect(view.offset).toEqual({ x: 0, y: 0 });
    expect(view.scale).toBe(1);
    expect(view.minScale).toBe(0.25);
    expect(view.maxScale).toBe(4);
  });

  it('converts world and screen coordinates', () => {
    const view = createViewState({ initialOffset: { x: 100, y: 50 }, initialScale: 2 });
    expect(worldToScreen(view, 10, 20)).toEqual({ x: 120, y: 90 });
    expect(screenToWorld(view, 120, 90)).toEqual({ x: 10, y: 20 });
  });

  it('pans by offset', () => {
    const view = createViewState();
    panBy(view, 30, -15);
    expect(view.offset).toEqual({ x: 30, y: -15 });
  });

  it('zooms toward a screen point', () => {
    const view = createViewState();
    zoomAt(view, 100, 100, 1);
    expect(view.scale).toBeGreaterThan(1);
    expect(view.offset.x).not.toBe(0);
    expect(view.offset.y).not.toBe(0);
  });

  it('clamps scale to min/max', () => {
    const view = createViewState();
    expect(clampScale(view, 0.1)).toBe(0.25);
    expect(clampScale(view, 10)).toBe(4);
  });

  it('serializes and deserializes view state', () => {
    const view = createViewState({ initialOffset: { x: 12, y: 34 }, initialScale: 1.5 });
    const json = serializeView(view);
    const restored = deserializeView(json);
    expect(restored.offset).toEqual({ x: 12, y: 34 });
    expect(restored.scale).toBe(1.5);
  });

  it('falls back to defaults for invalid serialized view', () => {
    const restored = deserializeView('not-json');
    expect(restored.offset).toEqual({ x: 0, y: 0 });
    expect(restored.scale).toBe(1);
  });

  it('loads and saves view for a novel', () => {
    const storage = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    });

    const view = createViewState({ initialOffset: { x: 10, y: 20 }, initialScale: 1.2 });
    saveViewForNovel('/novels/test', view);
    const loaded = loadViewForNovel('/novels/test');
    expect(loaded.offset).toEqual({ x: 10, y: 20 });
    expect(loaded.scale).toBe(1.2);

    vi.unstubAllGlobals();
  });
});

describe('storymap-canvas/layer', () => {
  it('registers and renders layers', () => {
    const registry = createLayerRegistry();
    const calls = [];
    const layer = {
      render: (ctx, { view, width, height }) => {
        calls.push({ view, width, height });
      },
    };

    registry.register(layer);
    const ctx = { save: vi.fn(), restore: vi.fn(), clearRect: vi.fn() };
    const view = createViewState();
    registry.render(ctx, view, 800, 600);

    expect(calls).toHaveLength(1);
    expect(calls[0].view).toBe(view);
    expect(calls[0].width).toBe(800);
    expect(calls[0].height).toBe(600);
    expect(ctx.save).toHaveBeenCalledTimes(2);
    expect(ctx.restore).toHaveBeenCalledTimes(2);
  });

  it('throws when registering a layer without render', () => {
    const registry = createLayerRegistry();
    expect(() => registry.register({})).toThrow(/render function/);
  });
});
