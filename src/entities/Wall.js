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
