import { CFG, BUILDING_SLOTS } from '../../config/config.js';
import { ENEMY_TYPES } from '../../config/enemies.js?v=biomeactive4';
import { dist, rand } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { floaty, spawnGoldReward, spawnParticles } from './SpawnSystem.js?v=biomeactive4';
import { addXP } from '../economy/UpgradeSystem.js?v=biomeweapons1';
import { killEnemy } from '../../util/EnemyUtils.js?v=biomeactive4';
import { crownAegisStats, trebuchetStats, murderHoleStats, warDrumStats, hoardBurstStats } from '../../util/DefenseStats.js';
import { makeUnit } from '../../entities/Unit.js';

// Free-standing buildings unlocked by base upgrades. Forest slots must be
// cleared of trees before building.

export function makeBuildings() {
  return BUILDING_SLOTS.map(s => ({
    ...s, built: false, level: 0, timer: 0, fireFlash: 0,
    cleared: !s.needsClearing,
  }));
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
  if (b.type === "lumber") return b.built ? 0 : CFG.lumberCost;
  return 0;
}

export function buildingLabel(b) {
  if (b.type === "lumber") return "Build lumber camp (bonus gold per log)";
  if (b.type === "kennel") return "Ember kennel (keeps hounds nearby)";
  if (b.type === "trap_foundry") return "Trap foundry (lays snap traps)";
  if (b.type === "raven_roost") return "Omen roost (harasses elite enemies)";
  if (b.type === "market_cart") return "Pilgrim market (delivers supply chests)";
  return "";
}

export function payBuilding(b) {
  if (b.type === "lumber") {
    b.built = true; b.level = 1;
    addXP(15);
  }
  spawnParticles(b.x, groundY - 30, 14, "#e8d8a8", 60, 80);
  Audio.build();
}

// Murder Holes: machicolations along the gatehouse dump boiling oil on any
// foe that reaches the door, scorching and slowing everyone caught beneath.
function updateMurderHoles(dt) {
  const base = state.base;
  const stats = murderHoleStats();
  if (!base || !stats) return;
  base.oilTimer = (base.oilTimer || 0) - dt;
  if (base.oilTimer > 0) return;
  const caught = state.enemies.filter(e => !e.fleeing && !e.dying && Math.abs(e.x - base.x) <= stats.range);
  if (!caught.length) { base.oilTimer = 0.4; return; }
  base.oilPourT = performance.now() / 1000;
  for (const e of caught) {
    e.hp -= stats.damage; e.flash = 0.15;
    e.slow = Math.max(e.slow || 0, stats.slowDuration);
    floaty(e.x, "-" + stats.damage + " 🔥", "#f2a230");
    spawnParticles(e.x, groundY - 16, 5, "#5a3a1e", 45, 40);
    if (e.hp <= 0) killEnemy(e);
  }
  spawnParticles(base.x - 154, groundY - 60, 8, "#cfae7a", 55, 60);
  spawnParticles(base.x + 154, groundY - 60, 8, "#cfae7a", 55, 60);
  Audio.hit();
  base.oilTimer = stats.interval;
}

// War Drums: a drum tower beats a war rhythm that spurs the whole garrison
// (units already get this fervor from the Royal Rally ability — the drums
// just grant it automatically, on a timer, without pulling anyone home).
function updateWarDrums(dt) {
  const base = state.base;
  const stats = warDrumStats();
  if (!base || !stats) return;
  base.drumTimer = (base.drumTimer || 0) - dt;
  if (base.drumTimer > 0) return;
  const roused = state.units.filter(u => u.hp > 0 && !u.dying);
  if (!roused.length) { base.drumTimer = 1.2; return; }
  base.drumBeatT = performance.now() / 1000;
  for (const u of roused) u.rallyBoostT = Math.max(u.rallyBoostT || 0, stats.duration);
  floaty(base.x, "War Drums! (" + roused.length + ")", "#9bd05a");
  spawnParticles(base.x, groundY - 100, 14, "#9bd05a", 90, 70);
  Audio.horn();
  base.drumTimer = stats.interval;
}

// Greedwyrm's Hoard: the coiled wyrm atop the vault periodically can't help
// itself and spits a mouthful of coin out onto the castle steps.
function updateHoardBurst(dt) {
  const base = state.base;
  const stats = hoardBurstStats();
  if (!base || !stats) return;
  base.hoardTimer = (base.hoardTimer || 0) - dt;
  if (base.hoardTimer > 0) return;
  base.hoardBurstT = performance.now() / 1000;
  const amount = stats.gold + Math.floor((Game.day || 1) / 3);
  spawnGoldReward(base.x, amount, "passive", { spreadX: 26, fromY: groundY - 70, vx: 40, vyMin: 160, vyMax: 300 });
  spawnParticles(base.x, groundY - 78, 12, "#f2c14e", 80, 90);
  Audio.chest();
  base.hoardTimer = stats.interval;
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

// Warwolf Cradle: a wall-mounted trebuchet lobs boulders at the toughest
// enemy still approaching the base. The strongest rank hurls one boulder
// down each flank at once, echoing the two-portal layout of the map.
function trebuchetPickTarget(range, side) {
  let best = null;
  for (const e of state.enemies) {
    if (e.fleeing || e.dying) continue;
    const dx = e.x - state.base.x;
    if (side < 0 && dx > 0) continue;
    if (side > 0 && dx < 0) continue;
    if (Math.abs(dx) > range) continue;
    if (!best || e.hp > best.hp) best = e;
  }
  return best;
}

function launchTrebuchetShot(base, stats, target) {
  const side = target.x >= base.x ? 1 : -1;
  const bt = ENEMY_TYPES[target.type];
  const ey = bt && bt.flying ? groundY + (target.fy || -80) : groundY - 24;
  const now = performance.now() / 1000;
  state.trebuchetShots.push({
    x1: base.x + side * 96, y1: groundY - 150,
    x2: target.x, y2: ey,
    born: now, life: stats.travelTime,
    dmg: stats.damage, splash: stats.splashDamage, radius: stats.radius,
    side, seed: Math.random() * 100,
    impacted: false, impactAt: 0,
  });
  base.trebuchetFireT = now;
  base.trebuchetSide = side;
}

function applyTrebuchetImpact(s) {
  spawnParticles(s.x2, s.y2, 8, "#6b5a46", 55, 60);
  spawnParticles(s.x2, s.y2, 18, "#cfae7a", 110, 130);
  Game.screenShake = Math.max(Game.screenShake, 0.45);
  Audio.hit();
  for (const e of state.enemies) {
    if (e.fleeing || e.dying) continue;
    const d = Math.abs(e.x - s.x2);
    if (d > s.radius) continue;
    const dmg = d < 26 ? s.dmg : s.splash;
    e.hp -= dmg; e.flash = 0.15;
    floaty(e.x, "-" + dmg + " 🪨", "#cfae7a");
    if (e.hp <= 0) killEnemy(e);
  }
}

function updateTrebuchetShots() {
  const now = performance.now() / 1000;
  for (const s of state.trebuchetShots) {
    if (s.impacted || now - s.born < s.life) continue;
    s.impacted = true;
    s.impactAt = now;
    applyTrebuchetImpact(s);
  }
  for (let i = state.trebuchetShots.length - 1; i >= 0; i--) {
    const s = state.trebuchetShots[i];
    if (s.impacted && now - s.impactAt > 0.6) state.trebuchetShots.splice(i, 1);
  }
}

function updateTrebuchet(dt) {
  const base = state.base;
  const stats = trebuchetStats();
  updateTrebuchetShots();
  if (!base || !stats) return;
  base.trebuchetTimer = (base.trebuchetTimer || 0) - dt;
  if (base.trebuchetTimer > 0) return;
  const targets = stats.dual
    ? [trebuchetPickTarget(stats.range, -1), trebuchetPickTarget(stats.range, 1)].filter(Boolean)
    : [trebuchetPickTarget(stats.range, 0)].filter(Boolean);
  if (!targets.length) { base.trebuchetTimer = 0.4; return; }
  for (const target of targets) launchTrebuchetShot(base, stats, target);
  base.trebuchetTimer = stats.interval;
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
    if (b.type === "kennel") updateKennel(b, dt);
    else if (b.type === "trap_foundry") updateTrapFoundry(b, dt);
    else if (b.type === "raven_roost") updateRavenRoost(b, dt);
    else if (b.type === "market_cart") updateMarketCart(b, dt);
  }
  updateMurderHoles(dt);
  updateWarDrums(dt);
  updateHoardBurst(dt);
  updateCrownAegis(dt);
  updateTrebuchet(dt);
}
