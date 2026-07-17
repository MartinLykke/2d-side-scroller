import { frameView, inFrameViewX } from './RenderFrame.js';

export function visibleWorldBounds(pad = 0) {
  return frameView(pad);
}

export function inViewX(x, pad = 0) {
  return inFrameViewX(x, pad);
}
