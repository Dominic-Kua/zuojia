import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  getWritingGoal,
  getWritingHistory,
  recordWritingProgress,
  saveWritingGoal,
} from '../src/stats/writing-goals.js';

describe('writing goal persistence', () => {
  let novelPath;

  beforeEach(async () => {
    novelPath = await fs.mkdtemp(path.join(os.tmpdir(), 'zuojia-writing-goals-'));
  });

  afterEach(async () => {
    await fs.rm(novelPath, { recursive: true, force: true });
  });

  it('returns no goal until the author saves one', async () => {
    const result = await getWritingGoal(novelPath);

    expect(result).toMatchObject({ status: 'ok', data: null });
  });

  it('saves and reloads a validated goal', async () => {
    const goal = {
      targetWords: 80000,
      targetDate: '2026-12-31',
      writingDays: [1, 3, 5],
      plannedDaysOff: ['2026-11-27'],
    };

    const saved = await saveWritingGoal(novelPath, goal);
    const loaded = await getWritingGoal(novelPath);

    expect(saved).toMatchObject({ status: 'ok', data: goal });
    expect(loaded).toMatchObject({ status: 'ok', data: goal });
  });

  it('rejects invalid targets and writing schedules', async () => {
    const result = await saveWritingGoal(novelPath, {
      targetWords: 0,
      targetDate: '2026-12-31',
      writingDays: [],
      plannedDaysOff: [],
    });

    expect(result.status).toBe('error');
    expect(result.error.code).toBe('INVALID_WRITING_GOAL');
  });

  it('keeps the best daily total and fills missing days with zeroes', async () => {
    await recordWritingProgress(novelPath, '2026-10-24', 100);
    await recordWritingProgress(novelPath, '2026-10-24', 175);
    await recordWritingProgress(novelPath, '2026-10-24', 80);

    const history = await getWritingHistory(novelPath, 3, new Date(2026, 9, 24));

    expect(history).toMatchObject({ status: 'ok' });
    expect(history.data).toEqual([
      { date: '2026-10-22', wordsWritten: 0 },
      { date: '2026-10-23', wordsWritten: 0 },
      { date: '2026-10-24', wordsWritten: 175 },
    ]);
  });
});
