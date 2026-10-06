// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { createArcLayer } from '../../src/components/StoryMap/layers/ArcLayer';

describe('Multi-arc scenes', () => {
  const scenes = [
    { id: 's1', x: 0, y: 0, chronologyDate: '2026-01-01' },
    { id: 's2', x: 200, y: 0, chronologyDate: '2026-02-01' },
  ];
  const arcs = [
    { id: 'arc-1', name: 'A', color: { light: '#f00', dark: '#f00' } },
    { id: 'arc-2', name: 'B', color: { light: '#00f', dark: '#00f' } },
  ];
  const assignments = [
    { arcId: 'arc-1', sceneId: 's1' },
    { arcId: 'arc-1', sceneId: 's2' },
    { arcId: 'arc-2', sceneId: 's1' },
    { arcId: 'arc-2', sceneId: 's2' },
  ];

  it('renders threads for all arcs that include the same scene', () => {
    const layer = createArcLayer({
      getScenes: () => scenes,
      getArcs: () => arcs,
      getAssignments: () => assignments,
      getMode: () => 'sequential',
    });

    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      stroke: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
    };

    layer.render(ctx, { view: { offset: { x: 0, y: 0 }, scale: 1 } });
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
  });
});
