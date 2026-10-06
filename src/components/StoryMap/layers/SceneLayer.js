import { getChapterColor } from '../../../lib/storymap-model';

const NODE_WIDTH = 140;
const NODE_HEIGHT = 60;
const NODE_RADIUS = 8;

function getScreenBounds(view, scene) {
  const x = scene.x * view.scale + view.offset.x;
  const y = scene.y * view.scale + view.offset.y;
  return {
    left: x - NODE_WIDTH / 2,
    top: y - NODE_HEIGHT / 2,
    right: x + NODE_WIDTH / 2,
    bottom: y + NODE_HEIGHT / 2,
  };
}

export function createSceneLayer(options = {}) {
  const {
    getScenes = () => [],
    getChapters = () => [],
    getCurrentSceneId = () => null,
    isDark = false,
    nodeWidth = NODE_WIDTH,
    nodeHeight = NODE_HEIGHT,
    nodeRadius = NODE_RADIUS,
    onSceneDrag = () => {},
  } = options;

  function getChapterById(chapterId) {
    return getChapters().find((c) => c.id === chapterId) || null;
  }

  let pulsePhase = 0;

  return {
    render(ctx, { view, width, height }) {
      const scenes = getScenes();
      for (const scene of scenes) {
        const bounds = getScreenBounds(view, scene);

        // Skip off-screen nodes.
        if (
          bounds.right < 0 ||
          bounds.left > width ||
          bounds.bottom < 0 ||
          bounds.top > height
        ) {
          continue;
        }

        const chapter = getChapterById(scene.chapterId);
        const chapterColor = getChapterColor(chapter, isDark);

        ctx.fillStyle = 'var(--surface)';
        ctx.strokeStyle = chapterColor || 'var(--accent)';
        ctx.lineWidth = 2;

        roundRect(ctx, bounds.left, bounds.top, nodeWidth, nodeHeight, nodeRadius);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'var(--text)';
        ctx.font = '13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const text = truncateText(ctx, scene.title, nodeWidth - 16);
        ctx.fillText(text, bounds.left + nodeWidth / 2, bounds.top + nodeHeight / 2);

        if (scene.id === getCurrentSceneId()) {
          drawCurrentMarker(ctx, bounds, nodeWidth, nodeHeight, pulsePhase);
        }
      }
      pulsePhase += 0.05;
    },

    hitTest(view, screenX, screenY) {
      const scenes = getScenes();
      for (let i = scenes.length - 1; i >= 0; i -= 1) {
        const bounds = getScreenBounds(view, scenes[i]);
        if (
          screenX >= bounds.left &&
          screenX <= bounds.right &&
          screenY >= bounds.top &&
          screenY <= bounds.bottom
        ) {
          return scenes[i];
        }
      }
      return null;
    },

    getDragOffset(view, scene, screenX, screenY) {
      const bounds = getScreenBounds(view, scene);
      return {
        dx: screenX - bounds.left - nodeWidth / 2,
        dy: screenY - bounds.top - nodeHeight / 2,
      };
    },
  };
}

function drawCurrentMarker(ctx, bounds, nodeWidth, nodeHeight, phase) {
  const cx = bounds.left + nodeWidth / 2;
  const cy = bounds.top + nodeHeight / 2;
  const pulse = 1 + Math.sin(phase) * 0.08;
  const rx = (nodeWidth / 2 + 6) * pulse;
  const ry = (nodeHeight / 2 + 6) * pulse;

  ctx.save();
  ctx.strokeStyle = 'var(--accent)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'var(--text-muted)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('You are here', cx, bounds.bottom + 14);
  ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function truncateText(ctx, text, maxWidth) {
  let width = ctx.measureText(text).width;
  if (width <= maxWidth) return text;

  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    const candidate = `${text.slice(0, mid)}…`;
    width = ctx.measureText(candidate).width;
    if (width <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return `${text.slice(0, low)}…`;
}
