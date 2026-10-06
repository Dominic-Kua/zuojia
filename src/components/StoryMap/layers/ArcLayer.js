import { getChapterColor } from '../../../lib/storymap-model';

const HIT_DISTANCE_PX = 8;
const BEZIER_SAMPLES = 20;

function cubicBezierPoint(t, p0, p1, p2, p3) {
  const u = 1 - t;
  const u2 = u * u;
  const u3 = u2 * u;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: u3 * p0.x + 3 * u2 * t * p1.x + 3 * u * t2 * p2.x + t3 * p3.x,
    y: u3 * p0.y + 3 * u2 * t * p1.y + 3 * u * t2 * p2.y + t3 * p3.y,
  };
}

function distanceToBezierSegment(px, py, a, c1, c2, b) {
  let min = Infinity;
  for (let i = 0; i <= BEZIER_SAMPLES; i += 1) {
    const p = cubicBezierPoint(i / BEZIER_SAMPLES, a, c1, c2, b);
    const d = Math.hypot(p.x - px, p.y - py);
    if (d < min) min = d;
  }
  return min;
}

export function createArcLayer(options = {}) {
  const {
    getScenes = () => [],
    getArcs = () => [],
    getAssignments = () => [],
    getMode = () => 'sequential',
    getActiveArcId = () => null,
    isDark = false,
  } = options;

  function getSceneById(sceneId) {
    return getScenes().find((s) => s.id === sceneId) || null;
  }

  function sortArcScenes(arcScenes, mode) {
    if (mode === 'chronological') {
      return [...arcScenes].sort(
        (a, b) => a.chronologyDate.localeCompare(b.chronologyDate) || a.id.localeCompare(b.id)
      );
    }
    return [...arcScenes].sort((a, b) => a.x - b.x || a.y - b.y);
  }

  function buildScreenPath(view, arcScenes) {
    const points = [];
    for (let i = 0; i < arcScenes.length - 1; i += 1) {
      const a = arcScenes[i];
      const b = arcScenes[i + 1];
      const ax = a.x * view.scale + view.offset.x;
      const ay = a.y * view.scale + view.offset.y;
      const bx = b.x * view.scale + view.offset.x;
      const by = b.y * view.scale + view.offset.y;
      const midX = (ax + bx) / 2;
      points.push({ a: { x: ax, y: ay }, c1: { x: midX, y: ay }, c2: { x: midX, y: by }, b: { x: bx, y: by } });
    }
    return points;
  }

  return {
    layerType: 'arc',

    render(ctx, { view }) {
      const arcs = getArcs();
      const assignments = getAssignments();
      const mode = getMode();
      const activeArcId = getActiveArcId();

      for (const arc of arcs) {
        const arcScenes = sortArcScenes(
          assignments
            .filter((a) => a.arcId === arc.id)
            .map((a) => getSceneById(a.sceneId))
            .filter(Boolean),
          mode
        );

        if (arcScenes.length < 2) continue;

        const color = getChapterColor(arc, isDark) || 'var(--accent)';
        const isActive = activeArcId === arc.id;
        const isDimmed = activeArcId && !isActive;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = isActive ? 5 : 3;
        ctx.globalAlpha = isDimmed ? 0.2 : 1;
        ctx.beginPath();

        for (let i = 0; i < arcScenes.length - 1; i += 1) {
          const a = arcScenes[i];
          const b = arcScenes[i + 1];
          const ax = a.x * view.scale + view.offset.x;
          const ay = a.y * view.scale + view.offset.y;
          const bx = b.x * view.scale + view.offset.x;
          const by = b.y * view.scale + view.offset.y;
          const midX = (ax + bx) / 2;

          if (i === 0) {
            ctx.moveTo(ax, ay);
          }
          ctx.bezierCurveTo(midX, ay, midX, by, bx, by);
        }

        ctx.stroke();
        ctx.restore();
      }
    },

    hitTestArc(view, screenX, screenY) {
      const arcs = getArcs();
      const assignments = getAssignments();
      const mode = getMode();
      let best = null;
      let bestDistance = Infinity;

      for (const arc of arcs) {
        const arcScenes = sortArcScenes(
          assignments
            .filter((a) => a.arcId === arc.id)
            .map((a) => getSceneById(a.sceneId))
            .filter(Boolean),
          mode
        );

        if (arcScenes.length < 2) continue;

        const segments = buildScreenPath(view, arcScenes);
        for (const seg of segments) {
          const d = distanceToBezierSegment(screenX, screenY, seg.a, seg.c1, seg.c2, seg.b);
          if (d < bestDistance) {
            bestDistance = d;
            best = arc.id;
          }
        }
      }

      return bestDistance <= HIT_DISTANCE_PX ? best : null;
    },
  };
}
