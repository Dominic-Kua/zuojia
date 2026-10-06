import { CHAPTER_COLUMN_WIDTH, getChapterColor } from '../../../lib/storymap-model';

export function createChapterLayer(options = {}) {
  const { getChapters = () => [], isDark = false } = options;

  return {
    render(ctx, { view, width, height }) {
      const chapters = getChapters();
      if (chapters.length === 0) return;

      ctx.save();
      for (const chapter of chapters) {
        const x = chapter.order * CHAPTER_COLUMN_WIDTH * view.scale + view.offset.x;
        const color = getChapterColor(chapter, isDark);
        if (color) {
          ctx.fillStyle = `${color}1a`; // ~10% opacity hex
        } else {
          ctx.fillStyle = 'rgba(128, 128, 128, 0.1)';
        }
        ctx.fillRect(x - (CHAPTER_COLUMN_WIDTH * view.scale) / 2, 0, CHAPTER_COLUMN_WIDTH * view.scale, height);

        ctx.fillStyle = 'var(--text-muted)';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(chapter.title, x, 20);
      }
      ctx.restore();
    },
  };
}
