export const WEEKDAY_OPTIONS = Object.freeze([
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]);

export function formatLocalDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function calculateWritingGoalProgress(goal, manuscriptCount, todayCount = 0, now = new Date()) {
  const targetWords = Number(goal?.targetWords);
  if (!goal || !Number.isSafeInteger(targetWords) || targetWords < 1 || !goal.targetDate) {
    return null;
  }

  const targetDate = new Date(`${goal.targetDate}T00:00:00`);
  if (Number.isNaN(targetDate.getTime()) || formatLocalDate(targetDate) !== goal.targetDate) {
    return null;
  }

  const currentWords = Math.max(0, Math.trunc(Number(manuscriptCount) || 0));
  const wordsRemaining = Math.max(0, targetWords - currentWords);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadline = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const writingDays = new Set(goal.writingDays || []);
  const plannedDaysOff = new Set(goal.plannedDaysOff || []);
  let writingDaysRemaining = 0;
  let isTodayWritingDay = false;

  for (const date = new Date(today); date <= deadline; date.setDate(date.getDate() + 1)) {
    const dateKey = formatLocalDate(date);
    if (!writingDays.has(date.getDay()) || plannedDaysOff.has(dateKey)) {
      continue;
    }
    writingDaysRemaining += 1;
    if (dateKey === formatLocalDate(today)) {
      isTodayWritingDay = true;
    }
  }

  const dailyWordTarget = writingDaysRemaining > 0
    ? Math.ceil(wordsRemaining / writingDaysRemaining)
    : wordsRemaining === 0 ? 0 : null;

  return {
    targetWords,
    currentWords,
    wordsRemaining,
    progressPercent: Math.min(100, Math.round((currentWords / targetWords) * 100)),
    writingDaysRemaining,
    dailyWordTarget,
    wordsRemainingToday: dailyWordTarget === null
      ? null
      : isTodayWritingDay ? Math.max(0, dailyWordTarget - Math.max(0, Number(todayCount) || 0)) : 0,
    isTodayWritingDay,
  };
}
