// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { createArc, ARC_COLORS } from '../../src/lib/storymap-model';

describe('createArc', () => {
  it('creates an arc with default color', () => {
    const arc = createArc({ name: 'Hero Arc' });
    expect(arc.name).toBe('Hero Arc');
    expect(arc.id).toMatch(/^arc-/);
    expect(ARC_COLORS).toContainEqual(arc.color);
  });
});
