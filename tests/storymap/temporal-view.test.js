// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { computeTemporalLayout } from '../../src/lib/storymap-canvas/temporal-layout';

describe('temporal layout', () => {
  it('orders scenes by chronology date along x', () => {
    const scenes = [
      { id: 'scene-2', chronologyDate: '2026-02-01' },
      { id: 'scene-1', chronologyDate: '2026-01-01' },
      { id: 'scene-3', chronologyDate: '2026-03-01' },
    ];
    const layout = computeTemporalLayout(scenes);
    const p1 = layout.positions.get('scene-1');
    const p2 = layout.positions.get('scene-2');
    const p3 = layout.positions.get('scene-3');
    expect(p1.x).toBeLessThan(p2.x);
    expect(p2.x).toBeLessThan(p3.x);
  });

  it('stacks scenes with the same date vertically', () => {
    const scenes = [
      { id: 'scene-1', chronologyDate: '2026-01-01' },
      { id: 'scene-2', chronologyDate: '2026-01-01' },
    ];
    const layout = computeTemporalLayout(scenes);
    const p1 = layout.positions.get('scene-1');
    const p2 = layout.positions.get('scene-2');
    expect(p1.x).toBe(p2.x);
    expect(p1.y).not.toBe(p2.y);
  });

  it('orders signed day/year values relative to Day 0 Year 0', () => {
    const scenes = [
      { id: 'future', chronologyDate: 'Day 1 Year 1' },
      { id: 'start', chronologyDate: 'Day 0 Year 0' },
      { id: 'before', chronologyDate: 'Day -1 Year 0' },
      { id: 'previous-year', chronologyDate: 'Day 0 Year -1' },
    ];
    const layout = computeTemporalLayout(scenes);
    expect(layout.positions.get('previous-year').x).toBeLessThan(layout.positions.get('before').x);
    expect(layout.positions.get('before').x).toBeLessThan(layout.positions.get('start').x);
    expect(layout.positions.get('start').x).toBeLessThan(layout.positions.get('future').x);
  });
});
