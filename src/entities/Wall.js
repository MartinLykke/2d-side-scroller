export function makeWall(slot) {
  return {
    tag: "Wall", x: slot.x, side: slot.side,
    level: 0, hp: 0, maxHp: 0,
    buildProgress: 0, commissioned: false, paid: 0, flash: 0,
  };
}

export function wallHeight(w) {
  return [0, 44, 64, 86, 112, 150][w.level] || 44;
}

export function wallWidth(w) {
  return [0, 40, 50, 60, 70, 80][w.level] || 40;
}

// Width of the wall body as drawn by the renderer (level 5 draws its own
// 96px castle wall and ignores this).
export function wallRenderWidth(w) {
  return [0, 42, 34, 44, 56, 72][w.level] || 42;
}

// Direction from the wall toward the base — the safe side where the
// fighting platform and its stairs/ladder live.
export function wallBackDir(w) {
  return -w.side || -1;
}

// How far the rear fighting platform extends behind the wall body.
export function wallPlatformDepth(w) {
  const cap = Math.max(2, w.level + 1);
  return 14 + cap * 12;
}

// Height of the platform deck surface above the ground. Matches the lift
// applied to units standing on a wall (wallHeight - 14), so their feet
// rest on the deck.
export function wallDeckHeight(w) {
  return Math.max(0, wallHeight(w) - 14);
}

// World x for a unit standing in a given platform slot behind the wall.
export function wallStandX(w, slot) {
  if (w.level >= 5) {
    // the castle wall has its own wide walkway centered on the wall body
    const cap = Math.max(2, w.level + 1);
    const spacing = Math.min(16, Math.max(10, 56 / cap));
    return w.x + (slot - (cap - 1) / 2) * spacing;
  }
  return w.x + wallBackDir(w) * (wallRenderWidth(w) / 2 + 8 + slot * 12);
}

// True when x sits over the wall body or its rear platform.
export function overWallPlatform(w, x) {
  if (w.level >= 5) return Math.abs(x - w.x) < 70;
  const half = wallRenderWidth(w) / 2;
  const rel = (x - w.x) * wallBackDir(w); // positive = toward base
  return rel > -half - 6 && rel < half + wallPlatformDepth(w) + 10;
}
