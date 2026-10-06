import React, { useEffect, useRef, useState } from 'react';
import {
  createViewState,
  loadViewForNovel,
  saveViewForNovel,
  panBy,
  zoomAt,
} from '../../lib/storymap-canvas/view';
import { createLayerRegistry } from '../../lib/storymap-canvas/layer';
import { createGridLayer } from './layers/GridLayer';

const CLICK_THRESHOLD_PX = 4;

export function CanvasView({ novelPath, layers = [], theme = 'light', viewName = 'sequential', onSceneDrag, onSceneSelect, onBackgroundClick, children }) {
  const canvasRef = useRef(null);
  const hostRef = useRef(null);
  const viewRef = useRef(createViewState());
  const layersRef = useRef(createLayerRegistry());
  const rafRef = useRef(null);
  const dragRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!novelPath) return;

    viewRef.current = loadViewForNovel(novelPath, viewName);
    const registry = createLayerRegistry();
    registry.register(createGridLayer());
    for (const layer of layers) {
      registry.register(layer);
    }
    layersRef.current = registry;

    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function resizeCanvas() {
      const rect = host.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      requestRender();
    }

    function render() {
      const rect = host.getBoundingClientRect();
      layersRef.current.render(ctx, viewRef.current, rect.width, rect.height);
    }

    function requestRender() {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        render();
      });
    }

    function hitTestScene(screenX, screenY) {
      for (let i = layers.length - 1; i >= 0; i -= 1) {
        const layer = layers[i];
        if (typeof layer.hitTest === 'function') {
          const hit = layer.hitTest(viewRef.current, screenX, screenY);
          if (hit) return { scene: hit, layer };
        }
      }
      return null;
    }

    function handlePointerDown(event) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const hit = hitTestScene(x, y);
      if (hit) {
        const offset = hit.layer.getDragOffset
          ? hit.layer.getDragOffset(viewRef.current, hit.scene, x, y)
          : { dx: 0, dy: 0 };
        dragRef.current = {
          type: 'scene',
          scene: hit.scene,
          startScreen: { x, y },
          lastScreen: { x, y },
          totalMovement: 0,
          offset,
        };
        canvas.style.cursor = 'grabbing';
      } else {
        dragRef.current = {
          type: 'pan',
          startScreen: { x, y },
          lastScreen: { x, y },
          totalMovement: 0,
        };
        canvas.style.cursor = 'grabbing';
      }
      canvas.setPointerCapture(event.pointerId);
    }

    function handlePointerMove(event) {
      if (!dragRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const dx = x - dragRef.current.lastScreen.x;
      const dy = y - dragRef.current.lastScreen.y;
      dragRef.current.totalMovement += Math.hypot(dx, dy);
      dragRef.current.lastScreen = { x, y };

      if (dragRef.current.type === 'pan') {
        panBy(viewRef.current, dx, dy);
        requestRender();
      } else if (dragRef.current.type === 'scene') {
        if (onSceneDrag) {
          onSceneDrag(dragRef.current.scene, dx / viewRef.current.scale, dy / viewRef.current.scale);
        }
      }
    }

    function handlePointerUp(event) {
      if (!dragRef.current) return;
      const { type, scene, startScreen, totalMovement } = dragRef.current;
      dragRef.current = null;
      canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = 'grab';
      saveViewForNovel(novelPath, viewRef.current, viewName);

      if (totalMovement <= CLICK_THRESHOLD_PX) {
        if (type === 'scene' && onSceneSelect) {
          onSceneSelect(scene);
        } else if (type === 'pan' && onBackgroundClick) {
          onBackgroundClick(startScreen.x, startScreen.y);
        }
      }
    }

    function handleWheel(event) {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      zoomAt(viewRef.current, x, y, event.deltaY < 0 ? 1 : -1);
      saveViewForNovel(novelPath, viewRef.current, viewName);
      requestRender();
    }

    resizeCanvas();
    setIsReady(true);

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(host);

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      for (const layer of layers) {
        // registry.register returns unregister, but we don't track them here.
      }
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerUp);
      canvas.removeEventListener('wheel', handleWheel);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [novelPath, layers, theme, viewName, onSceneDrag, onSceneSelect, onBackgroundClick]);

  return (
    <div ref={hostRef} className="storymap-canvas-host">
      <canvas
        ref={canvasRef}
        className="storymap-canvas"
        data-testid="storymap-canvas"
        style={{ cursor: 'grab' }}
      />
      {isReady && children}
    </div>
  );
}
