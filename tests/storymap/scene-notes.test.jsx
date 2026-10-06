// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SceneNotesPanel } from '../../src/components/StoryMap/SceneNotesPanel';

describe('SceneNotesPanel', () => {
  const scene = {
    id: 'scene-1',
    title: 'Opening',
    location: '',
    characters: '',
    tension: 'medium',
    notes: '',
  };

  beforeEach(() => {
    vi.spyOn(window, 'addEventListener').mockImplementation(() => {});
    vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders scene title and fields', () => {
    render(<SceneNotesPanel scene={scene} onChange={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: /Notes for Opening/ })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Where does this scene happen/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Who appears/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Anything else/)).toBeInTheDocument();
  });

  it('calls onChange when a field changes', () => {
    const onChange = vi.fn();
    render(<SceneNotesPanel scene={scene} onChange={onChange} onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/Where does this scene happen/), {
      target: { value: 'Tavern' },
    });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ location: 'Tavern' }));
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<SceneNotesPanel scene={scene} onChange={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText(/Close scene notes/));
    expect(onClose).toHaveBeenCalled();
  });
});
