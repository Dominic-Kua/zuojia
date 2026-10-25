import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { statsHandlers } from '../lib/ipc-client';
import { calculateWritingGoalProgress, formatLocalDate, WEEKDAY_OPTIONS } from '../lib/writing-goals';

function createDefaultTargetDate() {
  const date = new Date();
  date.setDate(date.getDate() + 90);
  return formatLocalDate(date);
}

function createGoalForm(goal) {
  return {
    targetWords: goal ? String(goal.targetWords) : '',
    targetDate: goal?.targetDate || createDefaultTargetDate(),
    writingDays: goal?.writingDays || [1, 2, 3, 4, 5],
    plannedDaysOff: goal?.plannedDaysOff || [],
  };
}

function formatGoalDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString();
}

export function WritingGoals({ novelPath, manuscriptCount = 0, todayCount = 0 }) {
  const [goal, setGoal] = useState(null);
  const [history, setHistory] = useState([]);
  const [todayKey, setTodayKey] = useState(() => formatLocalDate(new Date()));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(() => createGoalForm(null));
  const [dayOffInput, setDayOffInput] = useState('');

  const loadGoalData = useCallback(async () => {
    if (!novelPath) {
      setGoal(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const loadedGoal = await statsHandlers.writingGoal(novelPath);
      setGoal(loadedGoal || null);
      setError(null);
    } catch (loadError) {
      setError(loadError.message || 'Could not load writing progress');
    } finally {
      setIsLoading(false);
    }
  }, [novelPath]);

  const loadHistory = useCallback(async () => {
    if (!novelPath) {
      setHistory([]);
      return;
    }
    try {
      const loadedHistory = await statsHandlers.writingHistory(novelPath, 14);
      setHistory(Array.isArray(loadedHistory) ? loadedHistory : []);
    } catch (historyError) {
      setError(historyError.message || 'Could not load writing history');
    }
  }, [novelPath]);

  useEffect(() => {
    loadGoalData();
  }, [loadGoalData]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, todayCount, todayKey]);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentDate = formatLocalDate(new Date());
      setTodayKey((previousDate) => previousDate === currentDate ? previousDate : currentDate);
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const progress = useMemo(
    () => calculateWritingGoalProgress(goal, manuscriptCount, todayCount),
    [goal, manuscriptCount, todayCount, todayKey]
  );
  const formProgress = useMemo(() => calculateWritingGoalProgress({
    ...form,
    targetWords: Number(form.targetWords),
  }, manuscriptCount, todayCount), [form, manuscriptCount, todayCount, todayKey]);

  const handleOpen = () => {
    setForm(createGoalForm(goal));
    setDayOffInput('');
    setError(null);
    setShowDialog(true);
  };

  const handleToggleWritingDay = (day) => {
    setForm((current) => {
      const writingDays = new Set(current.writingDays);
      if (writingDays.has(day)) writingDays.delete(day);
      else writingDays.add(day);
      return { ...current, writingDays: [...writingDays].sort((a, b) => a - b) };
    });
  };

  const handleAddDayOff = () => {
    if (!dayOffInput) return;
    setForm((current) => ({
      ...current,
      plannedDaysOff: [...new Set([...current.plannedDaysOff, dayOffInput])].sort(),
    }));
    setDayOffInput('');
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const goalToSave = {
      targetWords: Number(form.targetWords),
      targetDate: form.targetDate,
      writingDays: [...form.writingDays].sort((a, b) => a - b),
      plannedDaysOff: [...form.plannedDaysOff].sort(),
    };
    setIsSaving(true);
    setError(null);
    try {
      const savedGoal = await statsHandlers.saveWritingGoal(novelPath, goalToSave);
      setGoal(savedGoal);
      setShowDialog(false);
      await loadHistory();
    } catch (saveError) {
      setError(saveError.message || 'Could not save writing goal');
    } finally {
      setIsSaving(false);
    }
  };

  const historyMaximum = Math.max(1, ...history.map((entry) => entry.wordsWritten));

  return (
    <>
      <div className="writing-goals-widget" data-testid="writing-goals-widget">
        {progress ? (
          <div className="writing-goal-summary" data-testid="writing-goal-summary">
            <span>Goal: {progress.currentWords.toLocaleString()} / {progress.targetWords.toLocaleString()}</span>
            <span>By {formatGoalDate(goal.targetDate)}</span>
            <span>Daily pace: {progress.dailyWordTarget === null
              ? 'No writing days remain'
              : `${progress.dailyWordTarget.toLocaleString()} words`}</span>
            <progress value={progress.progressPercent} max="100" aria-label="Writing goal progress" />
          </div>
        ) : null}
        <button
          type="button"
          className="btn ghost btn-sm"
          data-testid="writing-goal-edit"
          onClick={handleOpen}
          disabled={isLoading || !novelPath}
        >
          {isLoading ? 'Loading goal…' : goal ? 'Edit writing goal' : 'Set writing goal'}
        </button>
      </div>

      {showDialog && (
        <div className="snapshot-overlay" data-testid="writing-goal-overlay" onClick={() => !isSaving && setShowDialog(false)}>
          <form
            className="snapshot-dialog writing-goals-dialog"
            data-testid="writing-goal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="writing-goal-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleSave}
          >
            <h3 id="writing-goal-title">Writing goal</h3>
            <p>Set a manuscript target and a schedule that fits your writing routine.</p>

            <label className="settings-field" htmlFor="writing-goal-target">
              <span>Manuscript word-count target</span>
              <input
                id="writing-goal-target"
                data-testid="writing-goal-target"
                className="snapshot-label-input"
                type="number"
                min="1"
                step="1"
                value={form.targetWords}
                onChange={(event) => setForm((current) => ({ ...current, targetWords: event.target.value }))}
                required
              />
            </label>

            <label className="settings-field" htmlFor="writing-goal-date">
              <span>Target date</span>
              <input
                id="writing-goal-date"
                data-testid="writing-goal-date"
                className="snapshot-label-input"
                type="date"
                value={form.targetDate}
                onChange={(event) => setForm((current) => ({ ...current, targetDate: event.target.value }))}
                required
              />
            </label>

            <fieldset className="writing-goal-fieldset">
              <legend>Writing days</legend>
              <div className="writing-goal-weekdays">
                {WEEKDAY_OPTIONS.map(({ value, label }) => (
                  <label key={value} className="commit-file-option" htmlFor={`writing-goal-day-${value}`}>
                    <input
                      id={`writing-goal-day-${value}`}
                      data-testid={`writing-goal-day-${value}`}
                      type="checkbox"
                      checked={form.writingDays.includes(value)}
                      onChange={() => handleToggleWritingDay(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="settings-field">
              <span>Planned days off</span>
              <div className="writing-goal-day-off-input">
                <input
                  id="writing-goal-day-off-input"
                  data-testid="writing-goal-day-off-input"
                  className="snapshot-label-input"
                  type="date"
                  aria-label="Planned day off date"
                  value={dayOffInput}
                  onChange={(event) => setDayOffInput(event.target.value)}
                />
                <button
                  type="button"
                  className="btn ghost btn-sm"
                  data-testid="writing-goal-add-day-off"
                  onClick={handleAddDayOff}
                  disabled={!dayOffInput}
                >
                  Add day off
                </button>
              </div>
              {form.plannedDaysOff.length > 0 && (
                <ul className="writing-goal-days-off">
                  {form.plannedDaysOff.map((date) => (
                    <li key={date}>
                      <span>{formatGoalDate(date)}</span>
                      <button
                        type="button"
                        className="btn ghost btn-sm"
                        aria-label={`Remove day off ${date}`}
                        onClick={() => setForm((current) => ({
                          ...current,
                          plannedDaysOff: current.plannedDaysOff.filter((item) => item !== date),
                        }))}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {formProgress && (
              <div className="writing-goal-pace" data-testid="writing-goal-pace">
                <strong>
                  {formProgress.dailyWordTarget === null
                    ? 'No scheduled writing days remain before the target date.'
                    : `${formProgress.dailyWordTarget.toLocaleString()} words per writing day to reach the goal.`}
                </strong>
                {formProgress.isTodayWritingDay && formProgress.dailyWordTarget !== null && (
                  <span>Today remaining: {formProgress.wordsRemainingToday.toLocaleString()} words</span>
                )}
              </div>
            )}

            <div className="writing-goal-history" data-testid="writing-goal-history">
              <strong>Words written</strong>
              {history.length === 0 ? (
                <p>No writing history yet. Daily progress will appear here.</p>
              ) : (
                <ul>
                  {history.map((entry) => (
                    <li key={entry.date} data-testid={`writing-goal-history-${entry.date}`}>
                      <time dateTime={entry.date}>{formatGoalDate(entry.date)}</time>
                      <span className="writing-goal-history-bar" aria-hidden="true">
                        <span style={{ width: `${Math.round((entry.wordsWritten / historyMaximum) * 100)}%` }} />
                      </span>
                      <span>{entry.wordsWritten.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && <div className="snapshot-error" data-testid="writing-goal-error">{error}</div>}

            <div className="snapshot-dialog-actions">
              <button type="button" className="btn ghost" onClick={() => setShowDialog(false)} disabled={isSaving}>
                Cancel
              </button>
              <button type="submit" className="btn primary" data-testid="writing-goal-save" disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save goal'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
