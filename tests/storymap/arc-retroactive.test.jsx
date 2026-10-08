// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArcPanel } from '../../src/components/StoryMap/ArcPanel';

describe('ArcPanel retroactive creation', () => {
  const arcs = [{ id: 'arc-1', name: 'Hero Arc', color: { light: '#f00', dark: '#f00' } }];

  it('disables Create from Selection when no scenes selected', () => {
    render(<ArcPanel arcs={arcs} selectedSceneIds={[]} onCreateArc={vi.fn()} onAssignScenes={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId('arc-panel-retroactive')).toBeDisabled();
  });

  it('opens retroactive form when button clicked', () => {
    render(<ArcPanel arcs={arcs} selectedSceneIds={['s1']} onCreateArc={vi.fn()} onAssignScenes={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('arc-panel-retroactive'));
    expect(screen.getByPlaceholderText(/New arc name/)).toBeInTheDocument();
  });
});
