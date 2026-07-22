import { frameView } from './RenderFrame.js';

export function visibleWorldBounds(pad = 0) {
  return frameView(pad);
}
