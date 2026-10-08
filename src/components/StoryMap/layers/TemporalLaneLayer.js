import { resolveColorWithAlpha, resolveCssVariable } from '../../../lib/theme';
import { computeTemporalLayout } from '../../../lib/storymap-canvas/temporal-layout';

export function createTemporalLaneLayer(options = {}) {
  const { getScenes = () => [], split = false } = options;

  return {
    render(ctx, { view, width, height }) {
      const scenes = getScenes();
      if (scenes.length === 0) return;

      const layout = computeTemporalLayout(scenes, { split });
      const laneHeight = layout.laneHeight;
      const splitHeight = layout.lanes.length * laneHeight + 60;

      ctx.save();
      ctx.fillStyle = resolveColorWithAlpha('--text-muted', 0.08, 'rgba(128, 128, 128, 0.08)');
      ctx.strokeStyle = resolveColorWithAlpha('--divider', 0.5, 'rgba(128, 128, 128, 0.5)');
      ctx.lineWidth = 1;
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const laneLabelColor = resolveCssVariable('--text-secondary') || '#6B6A5E';

      for (let splitIdx = 0; splitIdx < layout.splits.length; splitIdx += 1) {
        for (let i = 0; i < layout.lanes.length; i += 1) {
          const lane = layout.lanes[i];
          const y = (splitIdx * splitHeight + i * laneHeight) * view.scale + view.offset.y;

          if (i % 2 === 0) {
            ctx.fillRect(0, y, width, laneHeight * view.scale);
          }

          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();

          ctx.fillStyle = laneLabelColor;
          ctx.fillText(lane.name, 8, y + 6);
          ctx.fillStyle = resolveColorWithAlpha('--text-muted', 0.08, 'rgba(128, 128, 128, 0.08)');
        }
      }

      ctx.restore();
    },
  };
}
