const TEMPORAL_COLUMN_WIDTH = 200;
const TEMPORAL_ROW_HEIGHT = 80;
const LANE_HEIGHT = 120;
const DEFAULT_SPLIT_GAP_DAYS = 30;

function getPovCharacter(scene) {
  if (!scene.characters || typeof scene.characters !== 'string') return null;
  const first = scene.characters.split(',')[0].trim();
  return first || null;
}

function parseDate(date) {
  return new Date(date).getTime();
}

function daysBetween(a, b) {
  return Math.abs(parseDate(a) - parseDate(b)) / (1000 * 60 * 60 * 24);
}

export function computeTemporalLayout(scenes, options = {}) {
  const { split = false, splitGapDays = DEFAULT_SPLIT_GAP_DAYS } = options;

  const sorted = [...scenes].sort((a, b) => {
    const dateCompare = a.chronologyDate.localeCompare(b.chronologyDate);
    if (dateCompare !== 0) return dateCompare;
    return a.id.localeCompare(b.id);
  });

  const lanes = computeLanes(sorted);
  const laneIndex = new Map(lanes.map((lane, index) => [lane.name, index]));
  const splits = split ? computeSplits(sorted, splitGapDays) : [{ startIndex: 0, endIndex: sorted.length - 1 }];

  const positions = new Map();
  const dateStacks = new Map();

  for (const scene of sorted) {
    const pov = getPovCharacter(scene) || 'Unassigned';
    const lane = laneIndex.get(pov) ?? lanes.length - 1;
    const splitIndex = getSplitIndex(splits, scene.chronologyDate, sorted);
    const splitStartDate = sorted[splits[splitIndex].startIndex].chronologyDate;
    const dayIndexInSplit = getDayIndexInSplit(sorted, splits[splitIndex], scene.chronologyDate);
    const stackKey = `${splitIndex}-${pov}-${scene.chronologyDate}`;
    const stack = dateStacks.get(stackKey) || 0;
    const x = dayIndexInSplit * TEMPORAL_COLUMN_WIDTH;
    const y = splitIndex * (lanes.length * LANE_HEIGHT + 60) + lane * LANE_HEIGHT + stack * TEMPORAL_ROW_HEIGHT;
    positions.set(scene.id, { x, y, lane, pov, splitIndex, splitStartDate });
    dateStacks.set(stackKey, stack + 1);
  }

  return {
    positions,
    lanes,
    splits,
    columnWidth: TEMPORAL_COLUMN_WIDTH,
    rowHeight: TEMPORAL_ROW_HEIGHT,
    laneHeight: LANE_HEIGHT,
  };
}

function computeSplits(sortedScenes, splitGapDays) {
  const splits = [];
  let startIndex = 0;
  for (let i = 1; i < sortedScenes.length; i += 1) {
    if (daysBetween(sortedScenes[i - 1].chronologyDate, sortedScenes[i].chronologyDate) > splitGapDays) {
      splits.push({ startIndex, endIndex: i - 1 });
      startIndex = i;
    }
  }
  splits.push({ startIndex, endIndex: sortedScenes.length - 1 });
  return splits;
}

function getSplitIndex(splits, date, sortedScenes) {
  for (let i = 0; i < splits.length; i += 1) {
    const split = splits[i];
    const startDate = sortedScenes[split.startIndex].chronologyDate;
    const endDate = sortedScenes[split.endIndex]?.chronologyDate ?? startDate;
    if (date >= startDate && date <= endDate) return i;
  }
  return 0;
}

function getDayIndexInSplit(sortedScenes, split, date) {
  const dates = [...new Set(sortedScenes.slice(split.startIndex, split.endIndex + 1).map((s) => s.chronologyDate))];
  return dates.indexOf(date);
}

function computeLanes(sortedScenes) {
  const povs = new Set();
  for (const scene of sortedScenes) {
    const pov = getPovCharacter(scene);
    if (pov) povs.add(pov);
  }

  const lanes = Array.from(povs).sort().map((name) => ({ name }));
  lanes.push({ name: 'Unassigned' });
  return lanes;
}

function getDayIndex(sortedScenes, date) {
  const dates = [...new Set(sortedScenes.map((s) => s.chronologyDate))];
  return dates.indexOf(date);
}

export function getTemporalPosition(layout, sceneId) {
  return layout.positions.get(sceneId) || { x: 0, y: 0, lane: 0, pov: 'Unassigned', splitIndex: 0 };
}
