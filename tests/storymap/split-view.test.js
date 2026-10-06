// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { computeTemporalLayout } from '../../src/lib/storymap-canvas/temporal-layout';

describe('split view', () => {
  it('creates one split when all dates are close', () => {
    const scenes = [
      { id: 's1', chronologyDate: '2026-01-01', characters: '' },
      { id: 's2', chronologyDate: '2026-01-10', characters: '' },
    ];
    const layout = computeTemporalLayout(scenes, { split: true });
    expect(layout.splits.length).toBe(1);
  });

  it('creates multiple splits when gaps exceed threshold', () => {
    const scenes = [
      { id: 's1', chronologyDate: '2026-01-01', characters: '' },
      { id: 's2', chronologyDate: '2026-06-01', characters: '' },
    ];
    const layout = computeTemporalLayout(scenes, { split: true });
    expect(layout.splits.length).toBe(2);
  });

  it('places scenes in different splits', () => {
    const scenes = [
      { id: 's1', chronologyDate: '2026-01-01', characters: '' },
      { id: 's2', chronologyDate: '2026-06-01', characters: '' },
    ];
    const layout = computeTemporalLayout(scenes, { split: true });
    const p1 = layout.positions.get('s1');
    const p2 = layout.positions.get('s2');
    expect(p1.splitIndex).not.toBe(p2.splitIndex);
  });
});
