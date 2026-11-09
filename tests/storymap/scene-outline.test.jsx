// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../src/lib/ipc-client', () => ({
  indexHandlers: {
    setChapterOrder: vi.fn().mockResolvedValue({ ok: true }),
  },
  storymapWindowHandlers: {
    notifyIndexUpdated: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

import { indexHandlers, storymapWindowHandlers } from '../../src/lib/ipc-client';
import { SceneOutlineView } from '../../src/components/StoryMap/SceneOutlineView';

const chapters = [
  { id: 'chapter-01.md', filename: 'chapter-01.md', title: 'Chapter 1', order: 0 },
  { id: 'chapter-02.md', filename: 'chapter-02.md', title: 'Chapter 2', order: 1 },
];

const scenes = [
  { id: 's1', title: 'Opening', chapterId: 'chapter-01.md', status: 'drafting', pov: 'Mara' },
  { id: 's2', title: 'Middle', chapterId: 'chapter-01.md', status: 'planned', pov: '' },
  { id: 's3', title: 'Climax', chapterId: 'chapter-02.md', status: 'planned', pov: 'Jon' },
  { id: 's4', title: 'Loose idea', chapterId: null, status: 'planned', pov: '' },
];

function renderOutline(overrides = {}) {
  const updateStorymap = vi.fn((updater) => {
    const current = { scenes: overrides.scenes ?? scenes };
    return typeof updater === 'function' ? updater(current) : updater;
  });
  const props = {
    novelPath: '/novels/test',
    chapters,
    scenes,
    currentSceneId: null,
    onSelectScene: vi.fn(),
    onOpenChapter: vi.fn(),
    onRefreshChapters: vi.fn().mockResolvedValue(undefined),
    updateStorymap,
    ...overrides,
  };
  const view = render(<SceneOutlineView {...props} />);
  return { ...view, props, updateStorymap: props.updateStorymap };
}

describe('SceneOutlineView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('groups scenes by chapter and shows unassigned scenes', () => {
    renderOutline();
    expect(screen.getByTestId('scene-outline-view')).toBeInTheDocument();
    expect(screen.getByTestId('outline-chapter-chapter-01.md')).toHaveTextContent('Opening');
    expect(screen.getByTestId('outline-chapter-chapter-01.md')).toHaveTextContent('Middle');
    expect(screen.getByTestId('outline-chapter-chapter-02.md')).toHaveTextContent('Climax');
    expect(screen.getByTestId('outline-unassigned')).toHaveTextContent('Loose idea');
  });

  it('reorders chapters through manuscript index and notifies main window', async () => {
    const { props } = renderOutline();
    fireEvent.click(screen.getByLabelText('Move chapter Chapter 1 down'));

    await waitFor(() => {
      expect(indexHandlers.setChapterOrder).toHaveBeenCalledWith('/novels/test', ['chapter-02.md', 'chapter-01.md']);
    });
    expect(storymapWindowHandlers.notifyIndexUpdated).toHaveBeenCalledWith('/novels/test');
    expect(props.onRefreshChapters).toHaveBeenCalled();
  });

  it('reorders scenes within a chapter and preserves assignments', () => {
    const { updateStorymap } = renderOutline();
    fireEvent.click(screen.getByLabelText('Move Opening down'));

    expect(updateStorymap).toHaveBeenCalled();
    const updater = updateStorymap.mock.calls[0][0];
    const next = updater({ scenes });
    expect(next.scenes.filter((s) => s.chapterId === 'chapter-01.md').map((s) => s.id)).toEqual(['s2', 's1']);
    expect(next.scenes.find((s) => s.id === 's3').chapterId).toBe('chapter-02.md');
  });

  it('moves a scene to another chapter', () => {
    const { updateStorymap } = renderOutline();
    fireEvent.change(screen.getByTestId('outline-scene-chapter-s1'), { target: { value: 'chapter-02.md' } });

    const updater = updateStorymap.mock.calls[0][0];
    const next = updater({ scenes });
    expect(next.scenes.find((s) => s.id === 's1').chapterId).toBe('chapter-02.md');
  });

  it('opens the linked draft chapter', () => {
    const { props } = renderOutline();
    fireEvent.click(screen.getByTestId('outline-open-chapter-chapter-01.md'));
    expect(props.onOpenChapter).toHaveBeenCalledWith('chapter-01.md');
  });
});
