// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SceneNotesPanel } from '../../src/components/StoryMap/SceneNotesPanel';

describe('SceneNotesPanel wiki links', () => {
  const scene = {
    id: 's1',
    title: 'Scene 1',
    characters: '',
    notes: '',
    chapterId: null,
    tension: '',
  };
  const wikiPages = [
    { slug: 'alice', title: 'Alice' },
    { slug: 'bob', title: 'Bob' },
  ];

  it('shows wiki page dropdown when typing in characters field', () => {
    render(
      <SceneNotesPanel
        scene={scene}
        chapters={[]}
        wikiPages={wikiPages}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onCreateChapter={vi.fn()}
        onOpenWikiPage={vi.fn()}
      />
    );

    const input = screen.getByTestId('scene-characters-input');
    fireEvent.change(input, { target: { value: 'Ali' } });
    expect(screen.getByTestId('scene-wiki-dropdown')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('inserts a wiki link into notes when a dropdown item is clicked', () => {
    const onChange = vi.fn();
    render(
      <SceneNotesPanel
        scene={scene}
        chapters={[]}
        wikiPages={wikiPages}
        onChange={onChange}
        onClose={vi.fn()}
        onCreateChapter={vi.fn()}
        onOpenWikiPage={vi.fn()}
      />
    );

    const input = screen.getByTestId('scene-characters-input');
    fireEvent.change(input, { target: { value: 'Ali' } });
    fireEvent.mouseDown(screen.getByText('Alice'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ notes: '[[alice|Alice]]' }));
  });

  it('renders clickable wiki links from notes', () => {
    const onOpenWikiPage = vi.fn();
    render(
      <SceneNotesPanel
        scene={{ ...scene, notes: 'See [[alice|Alice]].' }}
        chapters={[]}
        wikiPages={wikiPages}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onCreateChapter={vi.fn()}
        onOpenWikiPage={onOpenWikiPage}
      />
    );

    const link = screen.getByText('Alice');
    fireEvent.click(link);
    expect(onOpenWikiPage).toHaveBeenCalledWith('alice');
  });
});
