import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MenuDropdown } from '../../../src/components/MenuDropdown.jsx';

describe('MenuDropdown', () => {
  it('keeps panel content mounted while closed so dialogs inside remain stable', async () => {
    const user = userEvent.setup();
    render(
      <MenuDropdown label="Novel" testId="novel-menu">
        <button type="button" data-testid="inside-action">Export</button>
      </MenuDropdown>
    );

    const panel = screen.getByTestId('novel-menu-panel');
    expect(panel).toHaveAttribute('hidden');
    expect(screen.getByTestId('inside-action')).toBeInTheDocument();

    await user.click(screen.getByTestId('novel-menu'));
    expect(panel).not.toHaveAttribute('hidden');

    await user.keyboard('{Escape}');
    expect(panel).toHaveAttribute('hidden');
    expect(screen.getByTestId('inside-action')).toBeInTheDocument();
  });

  it('closes for explicit close actions', async () => {
    const user = userEvent.setup();
    render(
      <MenuDropdown label="View" testId="view-menu">
        <button type="button" data-testid="close-me" data-menu-close="true">Theme</button>
      </MenuDropdown>
    );

    await user.click(screen.getByTestId('view-menu'));
    expect(screen.getByTestId('view-menu-panel')).not.toHaveAttribute('hidden');
    await user.click(screen.getByTestId('close-me'));
    expect(screen.getByTestId('view-menu-panel')).toHaveAttribute('hidden');
  });
});
