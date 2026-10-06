// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { createArcLayer } from '../../src/components/StoryMap/layers/ArcLayer';

describe('ArcLayer hit testing', () => {
  const scenes = [
    { id: 's1', x: 0, y: 0, chronologyDate: '2026-01-01' },
    { id: 's2', x: 200, y: 0, chronologyDate: '2026-02-01' },
  ];
  const arcs = [{ id: 'arc-1', name: 'A', color: { light: '#f00', dark: '#f00' } }];
  const assignments = [{ arcId: 'arc-1', sceneId: 's1' }, { arcId: 'arc-1', sceneId: 's2' }];

  it('detects hover near thread', () => {
    const layer = createArcLayer({
      getScenes: () => scenes,
      getArcs: () => arcs,
      getAssignments: () => assignments,
      getMode: () => 'sequential',
    });

    const view = { offset: { x: 0, y: 0 }, scale: 1 };
    expect(layer.hitTestArc(view, 100, 2)).toBe('arc-1');
    expect(layer.hitTestArc(view, 100, 50)).toBeNull();
  });

  it('returns null for a single-scene arc', () => {
    const layer = createArcLayer({
      getScenes: () => [scenes[0]],
      getArcs: () => arcs,
      getAssignments: () => [{ arcId: 'arc-1', sceneId: 's1' }],
      getMode: () => 'sequential',
    });

    const view = { offset: { x: 0, y: 0 }, scale: 1 };
    expect(layer.hitTestArc(view, 0, 0)).toBeNull();
  });
});
