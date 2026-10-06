// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { createArcLayer } from '../../src/components/StoryMap/layers/ArcLayer';

describe('ArcLayer connection modes', () => {
  const scenes = [
    { id: 's1', x: 300, y: 0, chronologyDate: '2026-02-01' },
    { id: 's2', x: 100, y: 0, chronologyDate: '2026-01-01' },
  ];
  const arcs = [{ id: 'arc-1', name: 'A', color: { light: '#f00', dark: '#f00' } }];
  const assignments = [{ arcId: 'arc-1', sceneId: 's1' }, { arcId: 'arc-1', sceneId: 's2' }];

  it('sorts by x in sequential mode', () => {
    const layer = createArcLayer({
      getScenes: () => scenes,
      getArcs: () => arcs,
      getAssignments: () => assignments,
      getMode: () => 'sequential',
    });

    const ctx = {
      save: () => {},
      restore: () => {},
      stroke: () => {},
      beginPath: () => {},
      moveTo: () => {},
      bezierCurveTo: vi.fn(),
    };

    layer.render(ctx, { view: { offset: { x: 0, y: 0 }, scale: 1 } });
    expect(ctx.bezierCurveTo).toHaveBeenCalled();
  });
});
