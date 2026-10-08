// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArcManagementModal } from '../../src/components/StoryMap/ArcManagementModal';

describe('ArcManagementModal', () => {
  const arc = { id: 'arc-1', name: 'Hero', color: { light: '#f00', dark: '#f00' } };
  const arcs = [arc, { id: 'arc-2', name: 'Villain', color: { light: '#00f', dark: '#00f' } }];
  const scenes = [
    { id: 's1', title: 'Opening' },
    { id: 's2', title: 'Twist' },
  ];
  const assignments = [
    { arcId: 'arc-1', sceneId: 's1' },
    { arcId: 'arc-1', sceneId: 's2' },
  ];

  it('renames an arc', () => {
    const onRename = vi.fn();
    render(
      <ArcManagementModal
        arc={arc}
        arcs={arcs}
        scenes={scenes}
        assignments={assignments}
        onClose={vi.fn()}
        onRename={onRename}
        onDelete={vi.fn()}
        onMerge={vi.fn()}
        onSplit={vi.fn()}
        onChangeColor={vi.fn()}
      />
    );

    const input = screen.getByDisplayValue('Hero');
    fireEvent.change(input, { target: { value: 'Hero Journey' } });
    fireEvent.click(screen.getByTestId('arc-rename-submit'));
    expect(onRename).toHaveBeenCalledWith('arc-1', 'Hero Journey');
  });

  it('deletes an arc after the in-app confirmation', () => {
    const onDelete = vi.fn();
    render(
      <ArcManagementModal
        arc={arc}
        arcs={arcs}
        scenes={scenes}
        assignments={assignments}
        onClose={vi.fn()}
        onRename={vi.fn()}
        onDelete={onDelete}
        onMerge={vi.fn()}
        onSplit={vi.fn()}
        onChangeColor={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Delete Arc/i }));
    expect(screen.getByText(/Delete this arc\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('arc-delete-confirm'));
    expect(onDelete).toHaveBeenCalledWith('arc-1');
  });
});
