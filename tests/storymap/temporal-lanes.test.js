// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { computeTemporalLayout } from '../../src/lib/storymap-canvas/temporal-layout';

describe('temporal lanes', () => {
  it('assigns scenes to POV character lanes', () => {
    const scenes = [
      { id: 's1', chronologyDate: '2026-01-01', characters: 'Alice, Bob' },
      { id: 's2', chronologyDate: '2026-01-02', characters: 'Bob' },
    ];
    const layout = computeTemporalLayout(scenes);
    const p1 = layout.positions.get('s1');
    const p2 = layout.positions.get('s2');
    expect(p1.lane).not.toBe(p2.lane);
    expect(layout.lanes.map((l) => l.name)).toContain('Alice');
    expect(layout.lanes.map((l) => l.name)).toContain('Bob');
  });

  it('places scenes without characters in Unassigned lane', () => {
    const scenes = [{ id: 's1', chronologyDate: '2026-01-01', characters: '' }];
    const layout = computeTemporalLayout(scenes);
    const p1 = layout.positions.get('s1');
    expect(layout.lanes[p1.lane].name).toBe('Unassigned');
  });
});
