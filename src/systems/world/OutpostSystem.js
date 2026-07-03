import { CFG, BUILDING_SLOTS } from '../../config/config.js';
import { ENEMY_TYPES } from '../../config/enemies.js';
import { dist, rand } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { floaty, spawnParticles } from './SpawnSystem.js';
import { addXP } from '../economy/UpgradeSystem.js';

// Buildings unlocked by base upgrades: watchtowers, lumber camps and the
// healing shrine. Forest slots must be cleared of trees before building.

export function makeBuildings() {
  return BUILDING_SLOTS.map(s => ({
    ...s, built: false, level: 0, timer: 0, fireFlash: 0,
    cleared: !s.needsClearing,
  }));
}

export function towerHeight(lvl) {
  return [0, 112, 138, 164][lvl] || 112;
}

// True when no standing tree blocks the spot.
export function areaCleared(x, r = CFG.clearRadius) {
  const trees = state.forestTrees || [];
  for (const t of trees) {
    if (t.chopped || t.lying || t.falling || t.carriedBy) continue;
    if (Math.abs(t.x - x) < r) return false;
  }
  return true;
}

export function buildingCost(b) {
  if (state.base.level < b.unlock) return 0;
  if (!b.cleared) return 0;
  if (b.type === "tower")  return b.level >= 3 ? 0 : CFG.towerCosts[b.level];
  if (b.type === "lumber") return b.built ? 0 : CFG.lumberCost;
  if (b.type === "shrine") return b.built ? 0 : CFG.shrineCost;
  return 0;
}

export function buildingLabel(b) {
  if (b.type === "tower") {
    if (!b.built) return "Byg vagttårn (skyder selv fjender)";
    if (b.level < 3) return `Opgradér vagttårn (lvl ${b.level}→${b.level + 1})`;
    return "Vagttårn (maks niveau)";
  }
  if (b.type === "lumber") return "Byg skovhuggerlejr (markerer træer, bonusguld pr. stamme)";
  if (b.type === "shrine") return "Byg helligdom (helbreder i nærheden)";
  return "";
}

export function payBuilding(b) {
  if (b.type === "tower") {
    b.built = true; b.level++;
    floaty(b.x, b.level === 1 ? "🏹 Vagttårn bygget!" : `⬆ Vagttårn niveau ${b.level}!`, "#f2c14e");
    addXP(b.level === 1 ? 20 : 15);
  } else if (b.type === "lumber") {
    b.built = true; b.level = 1;
    floaty(b.x, "🪵 Skovhuggerlejr bygget!", "#caa46a");
    addXP(15);
  } else if (b.type === "shrine") {
    b.built = true; b.level = 1;
    floaty(b.x, "✨ Helligdom rejst!", "#8fd8ff");
    addXP(20);
  }
  spawnParticles(b.x, groundY - 30, 14, "#e8d8a8", 60, 80);
  Audio.build();
}

function updateTower(b, dt) {
  b.fireFlash = Math.max(0, b.fireFlash - dt);
  b.timer -= dt;
  if (b.timer > 0) return;
  let best = null, bd = CFG.towerRange;
  for (const e of state.enemies) {
    if (e.fleeing || e.dying) continue;
    const d = dist(e.x, b.x);
    if (d < bd) { bd = d; best = e; }
  }
  if (!best) { b.timer = 0.2; return; }
  const y = groundY - towerHeight(b.level) + 4;
  const et = ENEMY_TYPES[best.type];
  const ty = et && et.flying ? groundY + (best.fy || -80) : groundY - 24;
  const dx = best.x - b.x, dy = ty - y;
  const ft = Math.max(0.3, Math.hypot(dx, dy) / 430);
  state.arrows.push({
    x: b.x, y,
    vx: dx / ft,
    vy: (dy - 0.5 * 420 * ft * ft) / ft,
    target: best, life: ft + 0.4, hitKind: "enemy",
    dmgMult: b.level >= 2 ? 2 : 1,
    fireArrow: b.level >= 3,
  });
  Audio.bow();
  b.fireFlash = 0.15;
  b.timer = [0, 1.8, 1.4, 1.0][b.level] || 1.8;
}

function updateLumber(b, dt) {
  b.timer -= dt;
  if (b.timer > 0) return;
  b.timer = CFG.lumberMarkInterval;
  let best = null, bd = 560;
  for (const t of state.forestTrees || []) {
    if (t.chopped || t.marked || t.falling || t.lying || t.carriedBy) continue;
    const d = dist(t.x, b.x);
    if (d < bd) { bd = d; best = t; }
  }
  if (best) { best.marked = true; floaty(best.x, "🪓 Skovhugger markerer", "#9bd05a"); }
}

function updateShrine(b, dt) {
  if (Math.random() < dt * 5) spawnParticles(b.x + rand(-22, 22), groundY - rand(12, 46), 1, "#8fd8ff", 8, 26);
  b.timer += dt;
  if (b.timer < CFG.shrineHealTime) return;
  b.timer = 0;
  let healed = false;
  const p = state.player;
  if (p && p.hp < p.maxHp && dist(p.x, b.x) < CFG.shrineRange) {
    p.hp++; floaty(p.x, "+❤ Helligdom", "#8fd8ff"); healed = true;
  }
  for (const u of state.units) {
    if (u.hp < u.maxHp && dist(u.x, b.x) < CFG.shrineRange) { u.hp = Math.min(u.maxHp, u.hp + 1); healed = true; }
  }
  if (healed) spawnParticles(b.x, groundY - 32, 12, "#bfefff", 40, 70);
}

export function updateBuildings(dt) {
  if (!state.buildings) return;
  // Forest slots become buildable once the trees around them are felled.
  for (const b of state.buildings) if (b.needsClearing && !b.cleared) b.cleared = areaCleared(b.x);

  for (const b of state.buildings) {
    if (!b.built) continue;
    if (b.type === "tower") updateTower(b, dt);
    else if (b.type === "lumber") updateLumber(b, dt);
    else if (b.type === "shrine") updateShrine(b, dt);
  }
}
