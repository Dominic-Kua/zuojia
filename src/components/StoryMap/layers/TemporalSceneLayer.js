import { createSceneLayer } from './SceneLayer';
import { computeTemporalLayout, getTemporalPosition } from '../../../lib/storymap-canvas/temporal-layout';

export function createTemporalSceneLayer(options = {}) {
  const { getScenes = () => [], getChapters = () => [], getCurrentSceneId = () => null, isDark = false, split = false } = options;

  function getTemporalScenes() {
    const scenes = getScenes();
    const layout = computeTemporalLayout(scenes, { split });
    return scenes.map((scene) => {
      const pos = getTemporalPosition(layout, scene.id);
      return { ...scene, x: pos.x, y: pos.y };
    });
  }

  return createSceneLayer({
    getScenes: getTemporalScenes,
    getChapters,
    getCurrentSceneId,
    isDark,
  });
}
