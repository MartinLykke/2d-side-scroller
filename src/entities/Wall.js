export function makeWall(slot) {
  return {
    x: slot.x, side: slot.side,
    level: 0, hp: 0, maxHp: 0,
    buildProgress: 0, commissioned: false, paid: 0, flash: 0,
  };
}

export function wallHeight(w) {
  return w.level === 2 ? 64 : 42;
}
