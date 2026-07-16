import { W } from '../core/canvas.js';
import { Game } from '../core/state.js';

export function visibleWorldBounds(pad = 0) {
  const zoom = Game.zoom || 1;
  const halfVisible = W / (2 * zoom);
  const center = Game.cam + W / 2;
  return {
    left: center - halfVisible - pad,
    right: center + halfVisible + pad,
    center,
    width: halfVisible * 2,
  };
}

export function inViewX(x, pad = 0) {
  const view = visibleWorldBounds(pad);
  return x >= view.left && x <= view.right;
}
