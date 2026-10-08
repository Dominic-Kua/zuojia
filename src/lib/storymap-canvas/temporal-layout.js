import { getChronologyOrdinal } from '../storymap-model';

const TEMPORAL_COLUMN_WIDTH = 200;
const TEMPORAL_ROW_HEIGHT = 80;
const LANE_HEIGHT = 120;
const DEFAULT_SPLIT_GAP_DAYS = 30;

function getPovCharacter(scene) {
  if (!scene.characters || typeof scene.characters !== 'string') return null;
  const first = scene.characters.split(',')[0].trim();
  return first || null;
}

export function computeTemporalLayout(scenes, options = {}) {
  const { split = false, splitGapDays = DEFAULT_SPLIT_GAP_DAYS } = options;

  const sorted = [...scenes].sort((a, b) => {
    const chronologyCompare = getChronologyOrdinal(a) - getChronologyOrdinal(b);
    if (chronologyCompare !== 0) return chronologyCompare;
    return a.id.localeCompare(b.id);
  });
  const ordinals = sorted.map(getChronologyOrdinal);

  const lanes = computeLanes(sorted);
  const laneIndex = new Map(lanes.map((lane, index) => [lane.name, index]));
  const splits = split ? computeSplits(ordinals, splitGapDays) : [{ startIndex: 0, endIndex: sorted.length - 1 }];

  const positions = new Map();
  const dateStacks = new Map();

  for (let sceneIndex = 0; sceneIndex < sorted.length; sceneIndex += 1) {
    const scene = sorted[sceneIndex];
    const pov = getPovCharacter(scene) || 'Unassigned';
    const lane = laneIndex.get(pov) ?? lanes.length - 1;
    const splitIndex = splits.findIndex((range) => sceneIndex >= range.startIndex && sceneIndex <= range.endIndex);
    const split = splits[Math.max(0, splitIndex)];
    const ordinal = ordinals[sceneIndex];
    const splitStartOrdinal = ordinals[split.startIndex];
    const dayIndexInSplit = [...new Set(ordinals.slice(split.startIndex, split.endIndex + 1))].indexOf(ordinal);
    const stackKey = `${splitIndex}-${pov}-${ordinal}`;
    const stack = dateStacks.get(stackKey) || 0;
    const x = dayIndexInSplit * TEMPORAL_COLUMN_WIDTH;
    const y = splitIndex * (lanes.length * LANE_HEIGHT + 60) + lane * LANE_HEIGHT + stack * TEMPORAL_ROW_HEIGHT;
    positions.set(scene.id, { x, y, lane, pov, splitIndex, splitStartOrdinal });
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

function computeSplits(ordinals, splitGapDays) {
  const splits = [];
  let startIndex = 0;
  for (let i = 1; i < ordinals.length; i += 1) {
    if (ordinals[i] - ordinals[i - 1] > splitGapDays) {
      splits.push({ startIndex, endIndex: i - 1 });
      startIndex = i;
    }
  }
  splits.push({ startIndex, endIndex: ordinals.length - 1 });
  return splits;
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

export function getTemporalPosition(layout, sceneId) {
  return layout.positions.get(sceneId) || { x: 0, y: 0, lane: 0, pov: 'Unassigned', splitIndex: 0 };
}
