const DEFAULT_SCALE = 1;
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const ZOOM_FACTOR = 1.1;

export function createViewState(options = {}) {
  const {
    initialOffset = { x: 0, y: 0 },
    initialScale = DEFAULT_SCALE,
    minScale = MIN_SCALE,
    maxScale = MAX_SCALE,
    zoomFactor = ZOOM_FACTOR,
  } = options;

  return {
    offset: { ...initialOffset },
    scale: initialScale,
    minScale,
    maxScale,
    zoomFactor,
  };
}

export function clampScale(view, scale) {
  return Math.max(view.minScale, Math.min(view.maxScale, scale));
}

export function worldToScreen(view, worldX, worldY) {
  return {
    x: worldX * view.scale + view.offset.x,
    y: worldY * view.scale + view.offset.y,
  };
}

export function screenToWorld(view, screenX, screenY) {
  return {
    x: (screenX - view.offset.x) / view.scale,
    y: (screenY - view.offset.y) / view.scale,
  };
}

export function panBy(view, dx, dy) {
  view.offset.x += dx;
  view.offset.y += dy;
  return view;
}

export function zoomAt(view, screenX, screenY, direction) {
  const factor = direction > 0 ? view.zoomFactor : 1 / view.zoomFactor;
  const newScale = clampScale(view, view.scale * factor);

  if (newScale === view.scale) {
    return view;
  }

  // Zoom toward the cursor: the world point under the cursor must stay under
  // the cursor after the scale change.
  const worldBefore = screenToWorld(view, screenX, screenY);
  view.scale = newScale;
  const screenAfter = worldToScreen(view, worldBefore.x, worldBefore.y);

  view.offset.x += screenX - screenAfter.x;
  view.offset.y += screenY - screenAfter.y;

  return view;
}

export function resetView(view) {
  view.offset.x = 0;
  view.offset.y = 0;
  view.scale = DEFAULT_SCALE;
  return view;
}

export function serializeView(view) {
  return JSON.stringify({
    offset: view.offset,
    scale: view.scale,
  });
}

export function deserializeView(json) {
  try {
    const parsed = JSON.parse(json);
    if (
      parsed &&
      typeof parsed.scale === 'number' &&
      parsed.offset &&
      typeof parsed.offset.x === 'number' &&
      typeof parsed.offset.y === 'number'
    ) {
      return createViewState({
        initialOffset: parsed.offset,
        initialScale: parsed.scale,
      });
    }
  } catch {
    // ignore
  }
  return createViewState();
}

export function loadViewForNovel(novelPath, viewName = 'sequential') {
  try {
    const raw = window.localStorage.getItem(`zuojia-storymap-view-${viewName}-${novelPath}`);
    if (raw) {
      return deserializeView(raw);
    }
  } catch {
    // ignore
  }
  return createViewState();
}

export function saveViewForNovel(novelPath, view, viewName = 'sequential') {
  try {
    window.localStorage.setItem(`zuojia-storymap-view-${viewName}-${novelPath}`, serializeView(view));
  } catch {
    // ignore
  }
}
