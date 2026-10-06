import { resolveColorWithAlpha } from '../../../lib/theme';

const GRID_SIZE = 100;

export function createGridLayer(options = {}) {
  const { gridSize = GRID_SIZE } = options;

  return {
    render(ctx, { view, width, height }) {
      const topLeft = screenToWorld(view, 0, 0);
      const bottomRight = screenToWorld(view, width, height);

      const startX = Math.floor(topLeft.x / gridSize) * gridSize;
      const endX = Math.ceil(bottomRight.x / gridSize) * gridSize;
      const startY = Math.floor(topLeft.y / gridSize) * gridSize;
      const endY = Math.ceil(bottomRight.y / gridSize) * gridSize;

      ctx.strokeStyle = resolveColorWithAlpha('--text-faint', 0.2, 'rgba(128, 128, 128, 0.2)');
      ctx.lineWidth = 1 / view.scale;
      ctx.beginPath();

      for (let x = startX; x <= endX; x += gridSize) {
        const screenX = x * view.scale + view.offset.x;
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, height);
      }

      for (let y = startY; y <= endY; y += gridSize) {
        const screenY = y * view.scale + view.offset.y;
        ctx.moveTo(0, screenY);
        ctx.lineTo(width, screenY);
      }

      ctx.stroke();
    },
  };
}

function screenToWorld(view, screenX, screenY) {
  return {
    x: (screenX - view.offset.x) / view.scale,
    y: (screenY - view.offset.y) / view.scale,
  };
}
