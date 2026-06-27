import { CFG } from './config/config.js';

export const canvas  = document.getElementById("game");
export const ctx     = canvas.getContext("2d");
export let W = 0, H = 0, groundY = 0, DPR = 1;

// Called on boot and on every window resize.  Effects.js registers its own
// 'resize' listener to reinitialise FX after these values are updated.
export function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W   = window.innerWidth;
  H   = window.innerHeight;
  canvas.width  = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width  = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  groundY = Math.floor(H * CFG.groundFrac);
}
window.addEventListener("resize", resize);
