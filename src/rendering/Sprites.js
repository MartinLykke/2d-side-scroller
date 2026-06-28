// Kenney "Tiny Dungeon" tileset (CC0) — 12 cols × 11 rows, 16×16 px per tile, no gaps
// https://kenney.nl/assets/tiny-dungeon

const TS = 16;
const COLS = 12;

let sheet = null;
export let ready = false;

export function loadSprites() {
  sheet = new Image();
  sheet.onload = () => { ready = true; };
  sheet.src = 'assets/dungeon.png';
}

// Draw tile n, centred horizontally at cx, bottom edge at bottomY, scaled to w×h.
export function spr(ctx, n, cx, bottomY, w, h) {
  if (!ready) return;
  const col = n % COLS, row = (n / COLS) | 0;
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, col * TS, row * TS, TS, TS, cx - w / 2, bottomY - h, w, h);
  ctx.imageSmoothingEnabled = prev;
}

// Tile index constants  (row × 12 + col)
export const T = {
  // ── Friendly characters ──────────────────────────────────────────
  PLAYER:    84,   // purple mage / king
  GUARD:     87,   // armoured blue knight
  ARCHER:    99,   // red-haired ranger
  BUILDER:  100,   // orange berserker → builder
  FARMER:    98,   // brown female → farmer
  VAGRANT:   88,   // tan villager
  VAGRANT2: 109,   // brown barbarian (alternate vagrant)

  // ── Enemy characters ─────────────────────────────────────────────
  IMP:      108,   // green goblin
  RUNNER:   111,   // orange orc runner
  WRAITH:   121,   // dark ghost
  CRAWLER:  122,   // blue slime creature
  RAIDER:    86,   // red warrior
  BRUTE:    123,   // red beast
  OGRE:     109,   // brown barbarian ogre (scaled up)
  DEMON:    110,   // red demon
  FLIER:    124,   // blue flying harpy
  NECRO:     97,   // dark-robed necromancer
  BOSS1:     96,   // dark knight boss
  BOSS2:     85,   // red fighter boss
  BOSS3:    110,   // demon (scaled)
  BOSS4:    123,   // beast (scaled)
};
