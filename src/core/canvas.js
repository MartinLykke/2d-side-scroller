import { CFG } from '../config/config.js';

export const canvas  = document.getElementById("game");
export const ctx     = canvas.getContext("2d");
export let W = 0, H = 0, groundY = 0, DPR = 1;

// Called on boot and on every window resize.  Effects.js registers its own
// 'resize' listener to reinitialise FX after these values are updated.
const ZOOM = 1.3;

export function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  W   = Math.floor(window.innerWidth  / ZOOM);
  H   = Math.floor(window.innerHeight / ZOOM);
  canvas.width  = Math.floor(window.innerWidth  * DPR);
  canvas.height = Math.floor(window.innerHeight * DPR);
  canvas.style.width  = window.innerWidth  + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(DPR * ZOOM, 0, 0, DPR * ZOOM, 0, 0);
  groundY = Math.floor(H * CFG.groundFrac);
}
window.addEventListener("resize", resize);
