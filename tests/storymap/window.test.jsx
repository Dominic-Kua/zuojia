// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

const CanvasViewMock = vi.fn(({ children }) => (
  <div data-testid="storymap-canvas-view">{children}</div>
));

vi.mock('../../src/components/StoryMap/CanvasView', () => ({
  CanvasView: CanvasViewMock,
}));

describe('storymap window', () => {
  let originalLocation;

  beforeEach(() => {
    originalLocation = window.location;
    delete window.location;
    window.location = {
      ...originalLocation,
      search: '?view=storymap&novelPath=/Users/test/.zuojia/my-novel',
    };
  });

  afterEach(() => {
    window.location = originalLocation;
    vi.resetModules();
  });

  it('StoryMapApp loads the storymap for the novelPath query param', async () => {
    const loadMock = vi.fn().mockResolvedValue({
      version: 1,
      scenes: [{ id: 'scene-1', title: 'Opening' }],
      chapters: [],
      arcs: [],
      sceneArcAssignments: [],
    });

    vi.doMock('../../src/lib/ipc-client', () => ({
      storymapHandlers: {
        load: loadMock,
        save: vi.fn(),
      },
      storymapWindowHandlers: {
        open: vi.fn(),
      },
    }));

    const { StoryMapApp } = await import('../../src/components/StoryMap/StoryMapApp');
    render(<StoryMapApp />);

    await waitFor(() => {
      expect(loadMock).toHaveBeenCalledWith('/Users/test/.zuojia/my-novel');
    });

    expect(screen.getByTestId('storymap-canvas-view')).toBeInTheDocument();
  });

  it('StoryMapApp shows an error when novelPath is missing', async () => {
    window.location = {
      ...originalLocation,
      search: '?view=storymap',
    };

    vi.doMock('../../src/lib/ipc-client', () => ({
      storymapHandlers: {
        load: vi.fn(),
        save: vi.fn(),
      },
      storymapWindowHandlers: {
        open: vi.fn(),
      },
    }));

    const { StoryMapApp } = await import('../../src/components/StoryMap/StoryMapApp');
    render(<StoryMapApp />);

    expect(await screen.findByText(/No novel is loaded/)).toBeInTheDocument();
  });
});
