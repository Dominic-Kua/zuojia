import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { createError } from '../util/error.js';

const GOAL_FILE = 'writing-goal.json';
const HISTORY_FILE = 'writing-history.json';

function localDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

async function validateNovelPath(novelPath) {
  if (
    typeof novelPath !== 'string' ||
    !path.isAbsolute(novelPath) ||
    novelPath.split(path.sep).includes('..')
  ) {
    return createError('INVALID_NOVEL_PATH', 'Novel path must be an absolute path without parent-directory references');
  }
  try {
    await fs.access(novelPath);
    return null;
  } catch {
    return createError('INVALID_NOVEL_PATH', 'Novel path does not exist');
  }
}

function normalizeGoal(goal) {
  if (!goal || typeof goal !== 'object') {
    throw new Error('Writing goal must be an object');
  }
  const targetWords = Number(goal.targetWords);
  if (!Number.isSafeInteger(targetWords) || targetWords < 1) {
    throw new Error('Target word count must be a positive whole number');
  }
  if (!isDateString(goal.targetDate)) {
    throw new Error('Target date must be a valid date');
  }
  if (
    !Array.isArray(goal.writingDays) ||
    goal.writingDays.length === 0 ||
    goal.writingDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  ) {
    throw new Error('Choose at least one valid writing day');
  }
  const plannedDaysOff = goal.plannedDaysOff ?? [];
  if (!Array.isArray(plannedDaysOff) || plannedDaysOff.some((date) => !isDateString(date))) {
    throw new Error('Planned days off must be valid dates');
  }
  return {
    targetWords,
    targetDate: goal.targetDate,
    writingDays: [...new Set(goal.writingDays)].sort((a, b) => a - b),
    plannedDaysOff: [...new Set(plannedDaysOff)].sort(),
  };
}

async function readHistoryFile(historyPath) {
  try {
    const content = await fs.readFile(historyPath, 'utf-8');
    const parsed = JSON.parse(content);
    if (!parsed || !Array.isArray(parsed.entries)) {
      throw new Error('Writing history has an invalid format');
    }
    if (parsed.entries.some((entry) =>
      !entry || !isDateString(entry.date) || !Number.isSafeInteger(entry.wordsWritten) || entry.wordsWritten < 0
    )) {
      throw new Error('Writing history contains an invalid entry');
    }
    return parsed.entries;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeJsonAtomically(filePath, value) {
  const temporaryPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}-${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.unlink(temporaryPath).catch(() => {});
  }
}

export async function getWritingGoal(novelPath) {
  const pathError = await validateNovelPath(novelPath);
  if (pathError) return pathError;

  const goalPath = path.join(novelPath, 'meta', GOAL_FILE);
  try {
    const parsed = JSON.parse(await fs.readFile(goalPath, 'utf-8'));
    return { status: 'ok', data: normalizeGoal(parsed), timestamp: new Date().toISOString() };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { status: 'ok', data: null, timestamp: new Date().toISOString() };
    }
    return createError('READ_WRITING_GOAL_FAILED', 'Failed to read the writing goal', null, { error: error.message });
  }
}

export async function saveWritingGoal(novelPath, goal) {
  const pathError = await validateNovelPath(novelPath);
  if (pathError) return pathError;

  let normalizedGoal;
  try {
    normalizedGoal = normalizeGoal(goal);
  } catch (error) {
    return createError('INVALID_WRITING_GOAL', error.message);
  }

  const metaPath = path.join(novelPath, 'meta');
  const goalPath = path.join(metaPath, GOAL_FILE);
  try {
    await fs.mkdir(metaPath, { recursive: true });
    await writeJsonAtomically(goalPath, normalizedGoal);
    return { status: 'ok', data: normalizedGoal, timestamp: new Date().toISOString() };
  } catch (error) {
    return createError('SAVE_WRITING_GOAL_FAILED', 'Failed to save the writing goal', null, { error: error.message });
  }
}

export async function recordWritingProgress(novelPath, date, wordsWritten) {
  const pathError = await validateNovelPath(novelPath);
  if (pathError) return pathError;
  if (!isDateString(date) || !Number.isSafeInteger(wordsWritten) || wordsWritten < 0) {
    return createError('INVALID_WRITING_PROGRESS', 'Writing progress requires a valid date and non-negative word count');
  }

  const metaPath = path.join(novelPath, 'meta');
  const historyPath = path.join(metaPath, HISTORY_FILE);
  try {
    await fs.mkdir(metaPath, { recursive: true });
    const entries = await readHistoryFile(historyPath);
    const history = new Map(entries.map((entry) => [entry.date, entry.wordsWritten]));
    const existing = history.get(date);
    history.set(date, Math.max(existing ?? 0, wordsWritten));
    if (existing !== undefined && existing === history.get(date)) {
      return { status: 'ok', data: { date, wordsWritten: existing }, timestamp: new Date().toISOString() };
    }
    const normalizedEntries = [...history.entries()]
      .map(([entryDate, count]) => ({ date: entryDate, wordsWritten: count }))
      .sort((a, b) => a.date.localeCompare(b.date));
    await writeJsonAtomically(historyPath, { entries: normalizedEntries });
    return { status: 'ok', data: { date, wordsWritten: history.get(date) }, timestamp: new Date().toISOString() };
  } catch (error) {
    return createError('RECORD_WRITING_PROGRESS_FAILED', 'Failed to record writing progress', null, { error: error.message });
  }
}

export async function getWritingHistory(novelPath, days = 14, now = new Date()) {
  const pathError = await validateNovelPath(novelPath);
  if (pathError) return pathError;
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return createError('INVALID_HISTORY_RANGE', 'Writing history range must be between 1 and 365 days');
  }

  try {
    const entries = await readHistoryFile(path.join(novelPath, 'meta', HISTORY_FILE));
    const wordsByDate = new Map(entries.map((entry) => [entry.date, entry.wordsWritten]));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const history = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
      const dateKey = localDateString(date);
      history.push({ date: dateKey, wordsWritten: wordsByDate.get(dateKey) ?? 0 });
    }
    return { status: 'ok', data: history, timestamp: new Date().toISOString() };
  } catch (error) {
    return createError('READ_WRITING_HISTORY_FAILED', 'Failed to read writing history', null, { error: error.message });
  }
}
