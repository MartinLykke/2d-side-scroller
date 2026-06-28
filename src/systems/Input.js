export const keys = {};

const PREVENT = new Set(["arrowleft","arrowright","arrowup","arrowdown"," "]);

window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if (PREVENT.has(e.key.toLowerCase())) e.preventDefault();
});
window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// Prevent page scroll/zoom on touch
document.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
document.addEventListener("touchstart", (e) => {
  if (e.target.closest("#touch-controls") || e.target === document.getElementById("game")) {
    e.preventDefault();
  }
}, { passive: false });

// Show touch controls on touch devices
function initTouchControls() {
  const tc = document.getElementById("touch-controls");
  if (!tc) return;

  tc.classList.remove("hidden");
  tc.classList.add("tc-visible");

  function bindBtn(id, key, onPress) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const press = () => { keys[key] = true; btn.classList.add("tc-pressed"); if (onPress) onPress(); };
    const release = () => { keys[key] = false; btn.classList.remove("tc-pressed"); };
    btn.addEventListener("touchstart", (e) => { e.preventDefault(); press(); }, { passive: false });
    btn.addEventListener("touchend",   (e) => { e.preventDefault(); release(); }, { passive: false });
    btn.addEventListener("touchcancel",(e) => { e.preventDefault(); release(); }, { passive: false });
  }

  bindBtn("tc-move-left",  "arrowleft");
  bindBtn("tc-move-right", "arrowright");
  bindBtn("tc-jump",       " ");
  bindBtn("tc-interact",   "s");
  bindBtn("tc-pickup",     "f");
}

const isTouchDevice = ("ontouchstart" in window || navigator.maxTouchPoints > 0) && window.matchMedia("(pointer: coarse)").matches;
if (isTouchDevice) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTouchControls);
  } else {
    initTouchControls();
  }
}
