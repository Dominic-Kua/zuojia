// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyCanvasState } from '../../src/components/StoryMap/EmptyCanvasState';

describe('EmptyCanvasState', () => {
  it('renders prompt and Add Scene button', () => {
    render(<EmptyCanvasState onAddScene={vi.fn()} />);
    expect(screen.getByText(/No scenes yet/)).toBeInTheDocument();
    expect(screen.getByTestId('empty-add-scene-button')).toBeInTheDocument();
  });

  it('calls onAddScene when button clicked', () => {
    const onAddScene = vi.fn();
    render(<EmptyCanvasState onAddScene={onAddScene} />);
    fireEvent.click(screen.getByTestId('empty-add-scene-button'));
    expect(onAddScene).toHaveBeenCalled();
  });
});
