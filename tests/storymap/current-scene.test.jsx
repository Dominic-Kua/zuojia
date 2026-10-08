// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { createEmptyStorymap } from '../../src/lib/storymap-model';
import { createSceneLayer } from '../../src/components/StoryMap/layers/SceneLayer';

describe('current scene marker', () => {
  it('empty storymap has null currentSceneId', () => {
    const map = createEmptyStorymap();
    expect(map.currentSceneId).toBeNull();
  });

  it('renders marker for current scene', () => {
    const scenes = [
      { id: 'scene-1', title: 'A', x: 0, y: 0 },
      { id: 'scene-2', title: 'B', x: 200, y: 0 },
    ];
    const layer = createSceneLayer({
      getScenes: () => scenes,
      getCurrentSceneId: () => 'scene-1',
    });

    const ctx = {
      save: () => {},
      restore: () => {},
      fill: () => {},
      stroke: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      quadraticCurveTo: () => {},
      closePath: () => {},
      fillText: () => {},
      ellipse: vi.fn(),
      measureText: () => ({ width: 50 }),
    };

    layer.render(ctx, { view: { offset: { x: 0, y: 0 }, scale: 1 }, width: 800, height: 600 });
    expect(ctx.ellipse).toHaveBeenCalled();
  });
});
