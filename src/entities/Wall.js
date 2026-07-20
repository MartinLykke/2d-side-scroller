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

export function wallReady(w) {
  return !!w && w.commissioned && w.hp > 0 && w.buildProgress >= 1 && w.level > 0;
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

// Shared physical/rendering template for every biome wall. Biomes are free to
// change materials and decoration, but the usable deck and its access route
// always come from this geometry so characters cannot climb through scenery.
export function wallLayout(w, renderedHeight = wallHeight(w)) {
  const d = wallBackDir(w);
  const renderWidth = w.level >= 5 ? 96 : wallRenderWidth(w);
  const deckHeight = Math.max(0, renderedHeight - 14);

  if (w.level >= 5) {
    const deckHalf = 57; // matches the 114px two-tier castle walkway
    const accessX = w.x + d * 42;
    return {
      backDir: d,
      renderWidth,
      deckHeight,
      deckFrontX: w.x - d * deckHalf,
      deckRearX: w.x + d * deckHalf,
      deckMinX: w.x - deckHalf,
      deckMaxX: w.x + deckHalf,
      walkMinX: w.x - deckHalf + 4,
      walkMaxX: w.x + deckHalf - 4,
      accessType: "ladder",
      accessTopX: accessX,
      accessBottomX: accessX,
      accessHalfWidth: 15,
    };
  }

  const depth = wallPlatformDepth(w);
  const deckFrontX = w.x + d * (renderWidth / 2 - 2);
  const deckRearX = deckFrontX + d * depth;
  const stairs = deckHeight <= 56;
  const accessTopX = stairs ? deckRearX : deckRearX - d * 5;
  const accessBottomX = stairs ? deckRearX + d * deckHeight : accessTopX;
  const bodyFrontX = w.x - d * (renderWidth / 2 + 4);
  return {
    backDir: d,
    renderWidth,
    depth,
    deckHeight,
    deckFrontX,
    deckRearX,
    deckMinX: Math.min(deckFrontX, deckRearX),
    deckMaxX: Math.max(deckFrontX, deckRearX),
    walkMinX: Math.min(bodyFrontX, deckRearX) + 3,
    walkMaxX: Math.max(bodyFrontX, deckRearX) - 3,
    accessType: stairs ? "stairs" : "ladder",
    accessTopX,
    accessBottomX,
    accessHalfWidth: stairs ? 14 : 15,
  };
}

export function wallPlatformRearX(w) {
  return wallLayout(w).deckRearX;
}

export function wallClimbAnchorX(w) {
  return wallLayout(w).accessBottomX;
}

export function wallClimbTopX(w) {
  return wallLayout(w).accessTopX;
}

// X coordinate along the visible access route. Stairs travel diagonally from
// their foot to the deck; ladders remain vertical.
export function wallClimbX(w, t) {
  const layout = wallLayout(w);
  const p = Math.max(0, Math.min(1, t || 0));
  return layout.accessBottomX + (layout.accessTopX - layout.accessBottomX) * p;
}

export function nearWallClimbBottom(w, x) {
  if (!wallReady(w)) return false;
  const layout = wallLayout(w);
  return Math.abs(x - layout.accessBottomX) <= layout.accessHalfWidth;
}

export function nearWallClimbTop(w, x) {
  if (!wallReady(w)) return false;
  const layout = wallLayout(w);
  return Math.abs(x - layout.accessTopX) <= layout.accessHalfWidth;
}

export function nearWallClimbAnchor(w, x) {
  return nearWallClimbBottom(w, x) || nearWallClimbTop(w, x);
}

export function nearWallClimbAccess(w, x) {
  return nearWallClimbAnchor(w, x);
}

export function entityWallLift(entity) {
  if (!entity || !wallReady(entity.wall)) return 0;
  const t = Math.max(0, Math.min(1, entity.wallClimbT || (entity.onWall ? 1 : 0)));
  return wallDeckHeight(entity.wall) * t;
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
  const layout = wallLayout(w);
  return x >= layout.walkMinX && x <= layout.walkMaxX;
}
