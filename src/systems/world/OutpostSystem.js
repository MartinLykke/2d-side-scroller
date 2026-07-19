import { CFG, BUILDING_SLOTS } from '../../config/config.js';
import { ENEMY_TYPES } from '../../config/enemies.js?v=biomeboss1';
import { dist, rand } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { floaty, spawnGoldReward, spawnParticles } from './SpawnSystem.js?v=biomeboss1';
import { addXP } from '../economy/UpgradeSystem.js?v=biomeweapons1';
import { killEnemy } from '../../util/EnemyUtils.js?v=biomeboss1';
import { crownAegisStats } from '../../util/DefenseStats.js';
import { makeUnit } from '../../entities/Unit.js';

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
  if (b.type === "kennel") return "Ember kennel (keeps hounds nearby)";
  if (b.type === "trap_foundry") return "Trap foundry (lays snap traps)";
  if (b.type === "raven_roost") return "Omen roost (harasses elite enemies)";
  if (b.type === "market_cart") return "Pilgrim market (delivers supply chests)";
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

// Crown Aegis: the Royal Capital gets it for free, while the castle's Ember
// Lens branch can awaken and strengthen it earlier.
function updateCrownAegis(dt) {
  const base = state.base;
  const aegis = crownAegisStats();
  if (!base || !aegis) return;
  base.aegisTimer = (base.aegisTimer || 0) - dt;
  if (base.aegisTimer > 0) return;
  let best = null;
  for (const e of state.enemies) {
    if (e.fleeing || e.dying) continue;
    if (dist(e.x, base.x) > aegis.range) continue;
    if (!best || e.hp > best.hp) best = e;
  }
  if (!best) { base.aegisTimer = 0.25; return; }
  const bt = ENEMY_TYPES[best.type];
  const ey = bt && bt.flying ? groundY + (best.fy || -80) : groundY - 24;
  // golden bolt lashing out from the Crown Aegis beacon above the keep
  const now = performance.now() / 1000;
  const sourceY = groundY - (base.level >= CFG.maxBaseLevel ? 266 : 238);
  state.aegisStrikes.push({
    x1: base.x, y1: sourceY,
    x2: best.x, y2: ey,
    born: now, life: 0.45,
    seed: Math.random() * 100,
    r: aegis.radius,
  });
  base.aegisFlashUntil = now + 0.35;
  // pillar of embers falling from the sky onto the strike point
  for (let i = 0; i < 7; i++)
    spawnParticles(best.x + rand(-10, 10), ey - i * 24, 4, i % 2 ? "#ffd060" : "#ff6a20", 45, 60);
  spawnParticles(best.x, ey, 16, "#f2c14e", 95, 115);
  for (const e of state.enemies) {
    if (e.fleeing || e.dying) continue;
    if (Math.abs(e.x - best.x) > aegis.radius) continue;
    // full smite on the chosen target; enemies caught in the blast only take splash
    const dmg = e === best ? aegis.damage : aegis.splashDamage;
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
  base.aegisTimer = aegis.interval;
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

function updateKennel(b, dt) {
  b.timer = Math.max(0, (b.timer || 0) - dt);
  b.fireFlash = Math.max(0, (b.fireFlash || 0) - dt);
  const maxHounds = Math.max(1, b.level || 1);
  const hounds = state.units.filter(u => u.role === "hound" && u.hp > 0 && !u.dying && Math.abs((u.homeX || b.x) - b.x) < 12);
  if (hounds.length >= maxHounds || b.timer > 0) return;
  const h = makeUnit("hound", b.x + rand(-22, 22));
  h.homeX = b.x;
  h.transform = 0.55;
  state.units.push(h);
  b.timer = 18;
  b.fireFlash = 0.45;
  spawnParticles(b.x, groundY - 24, 12, "#ffb45f", 70, 80);
  Audio.recruit();
}

function trapFoundryX(b) {
  const aliveEnemy = state.enemies.find(e => !e.fleeing && !e.dying && e.hp > 0 && Math.abs(e.x - CFG.baseX) < 900);
  if (aliveEnemy) return aliveEnemy.x + rand(-34, 34);
  const slots = state.walls && state.walls.length
    ? state.walls.map(w => w.x)
    : [CFG.baseX - 520, CFG.baseX - 315, CFG.baseX + 315, CFG.baseX + 520];
  b.trapIdx = ((b.trapIdx || 0) + 1) % slots.length;
  return slots[b.trapIdx] + rand(-34, 34);
}

function updateTrapFoundry(b, dt) {
  b.timer = Math.max(0, (b.timer || 0) - dt);
  b.fireFlash = Math.max(0, (b.fireFlash || 0) - dt);
  const cap = 5 + (b.level || 1) * 3;
  if ((state.caltrops || []).length >= cap || b.timer > 0) return;
  const x = trapFoundryX(b);
  state.caltrops.push({
    x, y: groundY - 3, vx: 0, vy: 0,
    state: "armed",
    life: 24 + (b.level || 1) * 8,
    settle: 0.3,
    snapT: 0,
    rot: rand(-0.25, 0.25),
    spin: 0,
  });
  b.timer = Game.isNight ? Math.max(3.8, 6.2 - (b.level || 1) * 0.9) : 12;
  b.fireFlash = 0.22;
  spawnParticles(x, groundY - 7, 6, "#cfd3d9", 34, 18);
  Audio.hit();
}

function roostTarget(b) {
  let best = null, score = -1;
  for (const e of state.enemies) {
    if (e.fleeing || e.dying || e.hp <= 0) continue;
    if (dist(e.x, b.x) > 980) continue;
    const t = ENEMY_TYPES[e.type];
    let s = 1000 - dist(e.x, b.x);
    if (t?.boss) s += 450;
    if (t?.flying) s += 250;
    if (t?.caster || t?.siege || t?.chainImp) s += 180;
    if (e.bounty) s += 220;
    if (s > score) { score = s; best = e; }
  }
  return best;
}

function updateRavenRoost(b, dt) {
  b.timer = Math.max(0, (b.timer || 0) - dt);
  b.fireFlash = Math.max(0, (b.fireFlash || 0) - dt);
  if (b.timer > 0) return;
  const target = roostTarget(b);
  if (!target) { b.timer = 0.6; return; }
  const dmg = 1 + (b.level || 1);
  target.hp -= dmg;
  target.flash = 0.14;
  target.slow = Math.max(target.slow || 0, 0.9);
  target.hunterMark = Math.max(target.hunterMark || 0, 2.4);
  b.fireFlash = 0.35;
  b.timer = Math.max(2.6, 4.6 - (b.level || 1) * 0.7);
  spawnParticles(target.x, groundY + (target.fy || 0) - 26, 8, "#b9a7ff", 55, 70);
  floaty(target.x, "-" + dmg + " omen", "#b9a7ff");
  Audio.hit();
  if (target.hp <= 0) killEnemy(target);
}

const MARKET_WEAPONS = ["dagger", "short_bow", "spear", "crossbow", "fire_tome", "hydro_tome", "long_bow"];

function updateMarketCart(b, dt) {
  if (Game.isNight) return;
  b.timer = Math.max(0, (b.timer || 0) - dt);
  b.fireFlash = Math.max(0, (b.fireFlash || 0) - dt);
  const waiting = (state.chests || []).filter(ch => ch.market && !ch.open).length;
  if (waiting >= 2 || b.timer > 0) return;
  const level = b.level || 1;
  const weaponId = level >= 2 && Math.random() < 0.35
    ? MARKET_WEAPONS[Math.floor(Math.random() * MARKET_WEAPONS.length)]
    : null;
  state.chests.push({
    x: b.x + rand(-28, 28),
    lootGold: 8 + Game.day * 2 + level * 4,
    weaponId,
    open: false,
    openAnim: 0,
    market: true,
  });
  b.timer = Math.max(28, 52 - level * 9);
  b.fireFlash = 0.5;
  spawnGoldReward(b.x, 1 + level, "passive", { spreadX: 18, fromY: groundY - 20, vx: 30 });
  spawnParticles(b.x, groundY - 26, 14, "#7fd6a4", 60, 70);
  Audio.chest();
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
    else if (b.type === "kennel") updateKennel(b, dt);
    else if (b.type === "trap_foundry") updateTrapFoundry(b, dt);
    else if (b.type === "raven_roost") updateRavenRoost(b, dt);
    else if (b.type === "market_cart") updateMarketCart(b, dt);
  }
  updateCrownAegis(dt);
}
