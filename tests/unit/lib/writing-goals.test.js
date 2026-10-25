import { describe, expect, it } from 'vitest';
import { WEEKDAY_OPTIONS, calculateWritingGoalProgress } from '../../../src/lib/writing-goals.js';

describe('WEEKDAY_OPTIONS', () => {
  it('orders the week starting on Monday while keeping Date#getDay values', () => {
    expect(WEEKDAY_OPTIONS.map(({ label }) => label)).toEqual([
      'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
    ]);
    expect(WEEKDAY_OPTIONS.map(({ value }) => value)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });
});

describe('calculateWritingGoalProgress', () => {
  it('calculates a daily pace using scheduled writing days and planned days off', () => {
    const goal = {
      targetWords: 10000,
      targetDate: '2026-10-30',
      writingDays: [1, 2, 3, 4, 5],
      plannedDaysOff: ['2026-10-27'],
    };

    const progress = calculateWritingGoalProgress(goal, 6000, 600, new Date(2026, 9, 26));

    expect(progress).toEqual({
      targetWords: 10000,
      currentWords: 6000,
      wordsRemaining: 4000,
      progressPercent: 60,
      writingDaysRemaining: 4,
      dailyWordTarget: 1000,
      wordsRemainingToday: 400,
      isTodayWritingDay: true,
    });
  });

  it('does not count today as a writing day when it is scheduled off', () => {
    const goal = {
      targetWords: 10000,
      targetDate: '2026-10-30',
      writingDays: [1, 2, 3, 4, 5],
      plannedDaysOff: ['2026-10-26'],
    };

    const progress = calculateWritingGoalProgress(goal, 5000, 900, new Date(2026, 9, 26));

    expect(progress.writingDaysRemaining).toBe(4);
    expect(progress.dailyWordTarget).toBe(1250);
    expect(progress.wordsRemainingToday).toBe(0);
    expect(progress.isTodayWritingDay).toBe(false);
  });

  it('handles completed goals and deadlines with no remaining writing days', () => {
    const goal = {
      targetWords: 1000,
      targetDate: '2026-10-26',
      writingDays: [0],
      plannedDaysOff: ['2026-10-26'],
    };

    const completed = calculateWritingGoalProgress(goal, 1200, 0, new Date(2026, 9, 26));
    expect(completed.progressPercent).toBe(100);
    expect(completed.wordsRemaining).toBe(0);
    expect(completed.dailyWordTarget).toBe(0);

    const overdue = calculateWritingGoalProgress(goal, 500, 0, new Date(2026, 9, 27));
    expect(overdue.writingDaysRemaining).toBe(0);
    expect(overdue.dailyWordTarget).toBeNull();
    expect(overdue.wordsRemainingToday).toBeNull();
  });

  it('returns null when there is no goal', () => {
    expect(calculateWritingGoalProgress(null, 100, 10, new Date(2026, 9, 26))).toBeNull();
  });
});
