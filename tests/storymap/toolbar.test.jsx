// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StoryMapToolbar } from '../../src/components/StoryMap/StoryMapToolbar';
import { KeyboardHelpOverlay } from '../../src/components/StoryMap/KeyboardHelpOverlay';

describe('StoryMapToolbar', () => {
  it('renders Add Scene and Help buttons', () => {
    render(<StoryMapToolbar onAddScene={vi.fn()} onShowHelp={vi.fn()} />);
    expect(screen.getByTestId('storymap-add-scene-button')).toBeInTheDocument();
    expect(screen.getByTestId('storymap-help-button')).toBeInTheDocument();
  });

  it('calls onAddScene when Add Scene clicked', () => {
    const onAddScene = vi.fn();
    render(<StoryMapToolbar onAddScene={onAddScene} onShowHelp={vi.fn()} />);
    fireEvent.click(screen.getByTestId('storymap-add-scene-button'));
    expect(onAddScene).toHaveBeenCalled();
  });

  it('disables Add Scene until the story map has loaded', () => {
    render(<StoryMapToolbar onAddScene={vi.fn()} onShowHelp={vi.fn()} addSceneDisabled />);
    expect(screen.getByTestId('storymap-add-scene-button')).toBeDisabled();
  });

  it('calls onShowHelp when Help clicked', () => {
    const onShowHelp = vi.fn();
    render(<StoryMapToolbar onAddScene={vi.fn()} onShowHelp={onShowHelp} />);
    fireEvent.click(screen.getByTestId('storymap-help-button'));
    expect(onShowHelp).toHaveBeenCalled();
  });
});

describe('KeyboardHelpOverlay', () => {
  it('renders shortcut list and closes on Escape', () => {
    const onClose = vi.fn();
    render(<KeyboardHelpOverlay onClose={onClose} />);
    expect(screen.getByTestId('keyboard-help-overlay')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
