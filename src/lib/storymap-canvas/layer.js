export function createLayerRegistry() {
  const layers = [];

  return {
    register(layer) {
      if (!layer || typeof layer.render !== 'function') {
        throw new Error('Layer must have a render function');
      }
      layers.push(layer);
      return () => {
        const index = layers.indexOf(layer);
        if (index !== -1) {
          layers.splice(index, 1);
        }
      };
    },

    render(ctx, viewState, width, height) {
      ctx.save();
      ctx.clearRect(0, 0, width, height);
      for (const layer of layers) {
        ctx.save();
        layer.render(ctx, { view: viewState, width, height });
        ctx.restore();
      }
      ctx.restore();
    },

    getLayers() {
      return layers.slice();
    },
  };
}
