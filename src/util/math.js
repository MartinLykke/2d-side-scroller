export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (a, b) => Math.abs(a - b);
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function cameraBounds(worldWidth, viewportWidth, zoom = 1) {
  const z = Math.max(0.001, zoom || 1);
  const halfView = viewportWidth / (2 * z);
  const screenCenter = viewportWidth / 2;
  const min = halfView - screenCenter;
  const max = worldWidth - screenCenter - halfView;
  if (min <= max) return { min, max };
  const centered = worldWidth / 2 - screenCenter;
  return { min: centered, max: centered };
}

export function clampCameraTarget(target, worldWidth, viewportWidth, zoom = 1) {
  const { min, max } = cameraBounds(worldWidth, viewportWidth, zoom);
  return clamp(target, min, max);
}


export function applyCrit(damage, critChance, critMultiplier) {
  if (Math.random() < critChance) {
    return { damage: Math.round(damage * critMultiplier), isCrit: true };
  }
  return { damage: Math.round(damage), isCrit: false };
}

export function lerpColor(c1, c2, t) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}
export const rgb   = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
export const withA = (c, a) => `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
export const shade = (c, f) => [clamp(c[0]*f,0,255), clamp(c[1]*f,0,255), clamp(c[2]*f,0,255)];
export const hazeColor = (dark) => lerpColor([178,198,222],[22,24,48],dark);
export const atmo = (c, haze, depth) => lerpColor(c, haze, clamp(depth,0,1)*0.85);

export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
