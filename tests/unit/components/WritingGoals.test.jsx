import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { mockGetWritingGoal, mockSaveWritingGoal, mockWritingHistory } = vi.hoisted(() => ({
  mockGetWritingGoal: vi.fn(),
  mockSaveWritingGoal: vi.fn(),
  mockWritingHistory: vi.fn(),
}));

vi.mock('../../../src/lib/ipc-client', () => ({
  statsHandlers: {
    writingGoal: (...args) => mockGetWritingGoal(...args),
    saveWritingGoal: (...args) => mockSaveWritingGoal(...args),
    writingHistory: (...args) => mockWritingHistory(...args),
  },
}));

import { WritingGoals } from '../../../src/components/WritingGoals';

describe('WritingGoals', () => {
  const novelPath = '/tmp/test-novel';

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWritingGoal.mockResolvedValue(null);
    mockSaveWritingGoal.mockImplementation(async (_novelPath, goal) => goal);
    mockWritingHistory.mockResolvedValue([]);
  });

  it('shows the saved word goal, daily pace, and recent writing history', async () => {
    mockGetWritingGoal.mockResolvedValue({
      targetWords: 10000,
      targetDate: '2030-12-31',
      writingDays: [0, 1, 2, 3, 4, 5, 6],
      plannedDaysOff: [],
    });
    mockWritingHistory.mockResolvedValue([
      { date: '2026-10-23', wordsWritten: 250 },
      { date: '2026-10-24', wordsWritten: 600 },
    ]);
    await act(async () => {
      render(<WritingGoals novelPath={novelPath} manuscriptCount={6000} todayCount={600} />);
      await Promise.resolve();
    });

    expect(await screen.findByTestId('writing-goal-summary')).toHaveTextContent('10,000');
    expect(screen.getByTestId('writing-goal-summary')).toHaveTextContent(/Daily pace: [0-9,]+ words/);
    await act(async () => {
      await userEvent.setup().click(screen.getByTestId('writing-goal-edit'));
    });
    expect(screen.getByTestId('writing-goal-target')).toHaveValue(10000);
    expect(screen.getByTestId('writing-goal-date')).toHaveValue('2030-12-31');
    expect(await screen.findByTestId('writing-goal-history-2026-10-23')).toHaveTextContent('250');
  });

  it('saves a manuscript goal, weekly schedule, and planned day off', async () => {
    mockWritingHistory.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<WritingGoals novelPath={novelPath} manuscriptCount={1200} todayCount={50} />);

    await user.click(await screen.findByTestId('writing-goal-edit'));
    await user.clear(screen.getByTestId('writing-goal-target'));
    await user.type(screen.getByTestId('writing-goal-target'), '50000');
    await user.clear(screen.getByTestId('writing-goal-date'));
    await user.type(screen.getByTestId('writing-goal-date'), '2026-12-31');
    await user.click(screen.getByTestId('writing-goal-day-0'));
    await user.type(screen.getByTestId('writing-goal-day-off-input'), '2026-12-25');
    await user.click(screen.getByTestId('writing-goal-add-day-off'));
    await user.click(screen.getByTestId('writing-goal-save'));

    await waitFor(() => {
      expect(mockSaveWritingGoal).toHaveBeenCalledWith(novelPath, {
        targetWords: 50000,
        targetDate: '2026-12-31',
        writingDays: [0, 1, 2, 3, 4, 5],
        plannedDaysOff: ['2026-12-25'],
      });
    });
    expect(screen.queryByTestId('writing-goal-dialog')).not.toBeInTheDocument();
  });

  it('refreshes writing history when today\'s word count changes', async () => {
    const { rerender } = render(
      <WritingGoals novelPath={novelPath} manuscriptCount={1200} todayCount={0} />
    );
    await waitFor(() => expect(mockWritingHistory).toHaveBeenCalledTimes(1));
    mockWritingHistory.mockResolvedValue([{ date: '2026-10-24', wordsWritten: 75 }]);

    rerender(<WritingGoals novelPath={novelPath} manuscriptCount={1275} todayCount={75} />);

    await waitFor(() => expect(mockWritingHistory).toHaveBeenCalledTimes(2));
    await userEvent.setup().click(await screen.findByTestId('writing-goal-edit'));
    expect(await screen.findByTestId('writing-goal-history-2026-10-24')).toHaveTextContent('75');
  });
});
