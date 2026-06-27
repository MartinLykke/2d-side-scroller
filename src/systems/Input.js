export const keys = {};

const PREVENT = new Set(["arrowleft","arrowright","arrowup","arrowdown"," "]);

window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if (PREVENT.has(e.key.toLowerCase())) e.preventDefault();
});
window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});
