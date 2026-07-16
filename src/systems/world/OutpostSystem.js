import { CFG, BUILDING_SLOTS } from '../../config/config.js';
import { ENEMY_TYPES } from '../../config/enemies.js';
import { dist, rand } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { floaty, spawnParticles } from './SpawnSystem.js';
import { addXP } from '../economy/UpgradeSystem.js';
import { killEnemy } from '../../util/EnemyUtils.js';

// Buildings unlocked by base upgrades: watchtowers, lumber camps, the healing
// shrine and (at base level 6) ballista emplacements. Forest slots must be
// cleared of trees before building.

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
  if (b.type === "ballista") return b.level >= 2 ? 0 : CFG.ballistaCosts[b.level];
  return 0;
}

export function buildingLabel(b) {
  if (b.type === "tower") {
    if (!b.built) return "Build watchtower (shoots enemies on its own)";
    if (b.level < 3) return `Upgrade watchtower (lvl ${b.level}→${b.level + 1})`;
    return "Watchtower (max level)";
  }
  if (b.type === "lumber") return "Build lumber camp (bonus gold per log)";
  if (b.type === "shrine") return "Build shrine (heals nearby)";
  if (b.type === "ballista") {
    if (!b.built) return "Build ballista (heavy piercing bolts)";
    if (b.level < 2) return `Upgrade ballista (lvl ${b.level}→${b.level + 1})`;
    return "Ballista (max level)";
  }
  return "";
}

export function payBuilding(b) {
  if (b.type === "tower") {
    b.built = true; b.level++;
    addXP(b.level === 1 ? 20 : 15);
  } else if (b.type === "lumber") {
    b.built = true; b.level = 1;
    addXP(15);
  } else if (b.type === "shrine") {
    b.built = true; b.level = 1;
    addXP(20);
  } else if (b.type === "ballista") {
    b.built = true; b.level++;
    addXP(b.level === 1 ? 25 : 20);
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

// Ballista emplacement: slow, but launches a massive piercing bolt at the
// toughest enemy in range (it exists to bring down dragons).
function updateBallista(b, dt) {
  b.fireFlash = Math.max(0, b.fireFlash - dt);
  b.timer -= dt;
  if (b.timer > 0) return;
  let best = null;
  for (const e of state.enemies) {
    if (e.fleeing || e.dying) continue;
    if (dist(e.x, b.x) > CFG.ballistaRange) continue;
    if (!best || e.hp > best.hp) best = e;
  }
  if (!best) { b.timer = 0.25; return; }
  const y = groundY - 52;
  const et = ENEMY_TYPES[best.type];
  const ty = et && et.flying ? groundY + (best.fy || -80) : groundY - 24;
  const dx = best.x - b.x, dy = ty - y;
  const ft = Math.max(0.3, Math.hypot(dx, dy) / 520);
  state.arrows.push({
    x: b.x, y,
    vx: dx / ft,
    vy: (dy - 0.5 * 420 * ft * ft) / ft,
    target: best, life: ft + 0.5, hitKind: "enemy",
    ballista: true, pierce: 3,
    dmgMult: b.level >= 2 ? 8 : 5,
  });
  Audio.bow();
  b.fireFlash = 0.2;
  b.timer = b.level >= 2 ? 2.2 : 3.0;
}

// Crown Aegis (base level 7): the royal capital itself smites the toughest
// enemy near the walls with a burning ember strike.
function updateCrownAegis(dt) {
  const base = state.base;
  if (!base || base.level < CFG.maxBaseLevel) return;
  base.aegisTimer = (base.aegisTimer || 0) - dt;
  if (base.aegisTimer > 0) return;
  let best = null;
  for (const e of state.enemies) {
    if (e.fleeing || e.dying) continue;
    if (dist(e.x, base.x) > CFG.aegisRange) continue;
    if (!best || e.hp > best.hp) best = e;
  }
  if (!best) { base.aegisTimer = 0.25; return; }
  const bt = ENEMY_TYPES[best.type];
  const ey = bt && bt.flying ? groundY + (best.fy || -80) : groundY - 24;
  // golden bolt lashing out from the Crown Aegis beacon above the keep
  const now = performance.now() / 1000;
  state.aegisStrikes.push({
    x1: base.x, y1: groundY - 266,
    x2: best.x, y2: ey,
    born: now, life: 0.45,
    seed: Math.random() * 100,
    r: CFG.aegisRadius,
  });
  base.aegisFlashUntil = now + 0.35;
  // pillar of embers falling from the sky onto the strike point
  for (let i = 0; i < 7; i++)
    spawnParticles(best.x + rand(-10, 10), ey - i * 24, 4, i % 2 ? "#ffd060" : "#ff6a20", 45, 60);
  spawnParticles(best.x, ey, 16, "#f2c14e", 95, 115);
  for (const e of state.enemies) {
    if (e.fleeing || e.dying) continue;
    if (Math.abs(e.x - best.x) > CFG.aegisRadius) continue;
    // full smite on the chosen target; enemies caught in the blast only take splash
    const dmg = e === best ? CFG.aegisDamage : CFG.aegisSplashDamage;
    e.hp -= dmg; e.flash = 0.15;
    e.burn = Math.max(e.burn || 0, 3);
    e.burnTick = 1;
    e.burnDmg = Math.max(e.burnDmg || 0, 1);
    e.ignited = true;
    floaty(e.x, "-" + dmg + "👑", "#f2c14e");
    if (e.hp <= 0) killEnemy(e);
  }
  Game.screenShake = Math.max(Game.screenShake, 0.3);
  Audio.hit();
  base.aegisTimer = CFG.aegisInterval;
}

function updateShrine(b, dt) {
  if (Math.random() < dt * 5) spawnParticles(b.x + rand(-22, 22), groundY - rand(12, 46), 1, "#8fd8ff", 8, 26);
  b.timer += dt;
  if (b.timer < CFG.shrineHealTime) return;
  b.timer = 0;
  let healed = false;
  const p = state.player;
  if (p && p.hp < p.maxHp && dist(p.x, b.x) < CFG.shrineRange) {
    p.hp++; floaty(p.x, "+❤ Shrine", "#8fd8ff"); healed = true;
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
    else if (b.type === "shrine") updateShrine(b, dt);
    else if (b.type === "ballista") updateBallista(b, dt);
  }
  updateCrownAegis(dt);
}
