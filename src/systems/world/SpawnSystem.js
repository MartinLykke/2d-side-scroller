import { CFG } from '../../config/config.js';
import { ENEMY_TYPES, BOSS_SCHEDULE, BIOME_BOSS_TYPES, BIOME_ENEMY_POOLS } from '../../config/enemies.js?v=biomeactive1';
import { clamp, rand, pick } from '../../util/math.js';
import { groundY, W } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { goldCoinChunks, goldRewardAmount } from '../economy/EconomyBalance.js';
import { bountyRaiderCount, eliteChanceBonus, enemyVitalityMultiplier, nightQuotaMetaMultiplier, portalSpawnIntervalMultiplier } from '../infrastructure/RoguelikeSystem.js';
import { currentDifficulty } from '../infrastructure/DifficultySystem.js';
import { currentPopCap } from '../../util/DefenseStats.js';
import { activeBiomeId } from '../../rendering/Effects.js?v=biomeactive1';
import { BIOME_ANIMAL_POOLS, animalDef } from '../../config/animals.js';

const ANIMAL_SOFT_CAP = 18;
const BIOME_REPOPULATE_COUNT = 12;
const NEAR_ANIMAL_RADIUS = 1800;
const NEAR_ANIMAL_TARGET = 7;

function dayThreatProgress() {
  return Math.max(0, (Game.day || 1) - 2);
}

function difficulty() {
  return currentDifficulty(Game);
}

function currentParticleCap() {
  return difficulty().performance.particleCap;
}

function currentFloatTextCap() {
  return difficulty().performance.floatTextCap;
}

function nightSecondsRemaining() {
  return Math.max(0.1, (CFG.phases.night - (Game.time || 0)) * CFG.dayLength);
}

function nextNightSpawnInterval() {
  const remainingQuota = Math.max(1, (Game.nightQuota || 0) - (Game.nightSpawned || 0));
  const targetInterval = nightSecondsRemaining() / remainingQuota;
  const pressure = Math.min(0.45, Math.max(0, Game.day - 4) * 0.018);
  const interval = difficulty().performance.spawnInterval;
  const paced = targetInterval * rand(0.75, 1.2) * (1 - pressure);
  return clamp(paced, interval.min, interval.max) * portalSpawnIntervalMultiplier();
}

function enemyStrengthForDay(t) {
  const progress = dayThreatProgress();
  const lateProgress = Math.max(0, progress - 4);
  const endgameProgress = Math.max(0, progress - 8);
  const difficultyStrength = difficulty().enemyStrengthMult;
  const phase = (Game.worldPhase || 1) >= 2 ? 1.15 : 1;

  if (t.boss) {
    return {
      hp: clamp((1 + progress * 0.11 + lateProgress * 0.04) * difficultyStrength * phase, 1, 2.5),
      damage: clamp(1 + progress * 0.025, 1, 1.35),
      speed: clamp(1 + progress * 0.004, 1, 1.1),
    };
  }

  return {
    hp: clamp((1 + progress * 0.18 + lateProgress * 0.055 + endgameProgress * 0.04) * difficultyStrength * phase, 1, 4),
    damage: clamp(1 + progress * 0.035 + lateProgress * 0.01, 1, 1.65),
    speed: clamp(1 + progress * 0.008, 1, 1.18),
  };
}

function pushFloatText(f) {
  const cap = currentFloatTextCap();
  if (state.floatTexts.length >= cap) {
    state.floatTexts.splice(0, state.floatTexts.length - cap + 1);
  }
  state.floatTexts.push(f);
  return f;
}

export function spawnCoin(x, value = 1, fromY = -40, vx = 0, vy = -180) {
  const c = { x, y: fromY, vy, value, settled: false, life: 60, magnet: false, vx };
  state.coins.push(c);
  return c;
}

export function spawnGoldReward(x, amount, source = "enemy", opts = {}) {
  const actual = goldRewardAmount(amount, source);
  spawnGoldCoins(x, actual, opts);
  return actual;
}

export function spawnGoldCoins(x, amount, opts = {}) {
  const chunks = goldCoinChunks(amount, opts.maxCoinValue);
  for (const value of chunks) {
    const c = spawnCoin(
      x + rand(-(opts.spreadX || 22), opts.spreadX || 22),
      value,
      opts.fromY ?? groundY - 24,
      rand(-(opts.vx || 80), opts.vx || 80),
      rand(-(opts.vyMax || 260), -(opts.vyMin || 120))
    );
    if (opts.mine) c.mine = true;
  }
}

export function floaty(x, text, color = "#f2c14e", size = 15) {
  pushFloatText({ x, y: groundY - 90, text, color, life: 1.4, vy: -34, size });
}

// Combo-aware purchase text: buying again while the previous text is still on
// screen bumps a counter ("x2", "x3"…) and grows the text instead of stacking.
const purchaseCombos = {};
export function purchaseFloaty(key, x, baseText, color) {
  const c = purchaseCombos[key];
  if (c && state.floatTexts.includes(c.f)) {
    c.n++;
    c.f.text = `${baseText} x${c.n}`;
    c.f.size = Math.min(17 + c.n * 4, 38);
    c.f.life = c.f.maxLife = 1.6;
    c.f.y = groundY - 90 - Math.min(c.n * 3, 24);
    c.f.vy = -34;
  } else {
    const f = { x, y: groundY - 90, text: baseText, color, life: 1.6, maxLife: 1.6, vy: -34, size: 17, pop: true };
    pushFloatText(f);
    purchaseCombos[key] = { n: 1, f };
  }
}

export function critFloaty(x, dmg) {
  pushFloatText({
    x, y: groundY - 100, text: String(dmg), color: "#ffd23e",
    life: 1.1, maxLife: 1.1, vy: -150, size: 32, crit: true,
  });
}

export function spawnParticles(x, y, n, color, spread = 60, up = 80) {
  const cap = currentParticleCap();
  const count = Math.min(n, cap);
  const overflow = state.particles.length + count - cap;
  if (overflow > 0) state.particles.splice(0, overflow);
  for (let i = 0; i < count; i++)
    state.particles.push({
      x, y,
      vx: rand(-spread, spread), vy: rand(-up, -up * 0.2),
      life: rand(0.4, 0.9), color, size: rand(1.5, 3.5),
    });
}

export function spawnVagrant() {
  const { vagrants, units } = state;
  if (vagrants.length + units.length >= currentPopCap()) return;
  const side = pick([-1, 1]);
  const x = side < 0 ? rand(1600, 2400) : rand(CFG.worldWidth - 2400, CFG.worldWidth - 1600);
  vagrants.push({ x, vx: 0, targetX: CFG.baseX + rand(-260, 260), state: "wander", anim: rand(0, 6) });
}

function setAnimalFlight(a, targetX = null) {
  const dir = targetX == null ? pick([-1, 1]) : Math.sign(targetX - a.x) || 1;
  a.state = "fly";
  a.flyTargetX = clamp(targetX ?? a.x + dir * rand(650, 1300), 850, CFG.worldWidth - 850);
  a.cruiseFy = -rand(a.type === "eagle" ? 250 : 170, a.type === "eagle" ? 360 : 285);
  a.fy = a.cruiseFy * rand(0.55, 0.95);
  a.dir = Math.sign(a.flyTargetX - a.x) || dir;
}

export function makeAnimal(type, x, spawnState = null) {
  const def = animalDef(type);
  const stateName = spawnState || "graze";
  const a = {
    x, vx: 0, dir: pick([-1, 1]),
    state: stateName, stateT: stateName === "swim" ? rand(7, 16) : rand(2, 5),
    alive: true, anim: rand(0, 6), flee: 0, fleeT: 0, type,
    biome: def.biome, family: def.family,
    eatDown: 0, headT: rand(1, 3), scan: 0, earFlick: 0,
    fy: 0, flyTargetX: null, cruiseFy: 0, wingStretch: 0, diveT: 0,
    dying: false, deathT: 0,
  };
  if (def.family === "snake") a.slitherPhase = rand(0, 6);
  if (def.family === "scorpion") a.tailLift = rand(0.4, 1);
  if (def.family === "bird" && stateName === "fly") setAnimalFlight(a);
  return a;
}

function animalFocusX(opts = {}) {
  const x = Number.isFinite(opts.nearX)
    ? opts.nearX
    : (state.player && Number.isFinite(state.player.x) ? state.player.x : CFG.baseX);
  return clamp(x, 450, CFG.worldWidth - 450);
}

function animalNearRadius(opts = {}) {
  const visibleSpan = W > 0 ? W / Math.max(0.6, Game.zoom || 1) : 1300;
  return opts.radius || Math.max(NEAR_ANIMAL_RADIUS, visibleSpan * 1.25);
}

function nearbyAnimalCount(x, radius = NEAR_ANIMAL_RADIUS) {
  let n = 0;
  for (const a of state.animals) {
    if (!a.alive || a.dying) continue;
    if (Math.abs(a.x - x) <= radius) n++;
  }
  return n;
}

function trimDistantAnimalForSpawn(anchor, keepRadius) {
  if (state.animals.length < ANIMAL_SOFT_CAP) return true;
  for (let i = 0; i < state.animals.length; i++) {
    const a = state.animals[i];
    if (!a.alive || a.dying || Math.abs(a.x - anchor) > keepRadius) {
      state.animals.splice(i, 1);
      return true;
    }
  }
  return false;
}

function chooseAnimalSpawnX(opts = {}) {
  if (opts.near === false) return rand(800, CFG.worldWidth - 800);
  const anchor = animalFocusX(opts);
  const radius = animalNearRadius(opts);
  const minDistance = opts.minDistance || 260;

  for (let i = 0; i < 8; i++) {
    const dir = pick([-1, 1]);
    const x = clamp(anchor + dir * rand(minDistance, radius), 800, CFG.worldWidth - 800);
    if (Math.abs(x - anchor) >= minDistance * 0.75) return x;
  }
  return clamp(anchor + pick([-1, 1]) * minDistance, 800, CFG.worldWidth - 800);
}

function pickAnimalPond(opts = {}) {
  const ponds = state.ponds || [];
  if (!ponds.length) return null;
  if (opts.near === false) return pick(ponds);

  const anchor = animalFocusX(opts);
  const radius = animalNearRadius(opts);
  const nearby = ponds.filter(p => Math.abs(p.x - anchor) <= radius + p.hw);
  return nearby.length ? pick(nearby) : null;
}

export function spawnAnimal(opts = {}) {
  const near = opts.near ?? (Math.random() < 0.75);
  const focusX = animalFocusX(opts);
  const keepRadius = animalNearRadius(opts) * 1.35;
  if (state.animals.length >= ANIMAL_SOFT_CAP && (!near || !trimDistantAnimalForSpawn(focusX, keepRadius))) return null;

  const biomeId = activeBiomeId();
  const bears = state.animals.filter(a => a.type === "bear").length;
  if (biomeId === "forest" && bears < 2 && Math.random() < 0.12) return spawnBear();

  const pool = BIOME_ANIMAL_POOLS[biomeId] || BIOME_ANIMAL_POOLS.forest;
  const type = pick(pool);
  const def = animalDef(type);
  let x = chooseAnimalSpawnX({ ...opts, near }), spawnState = "graze";
  const p = def.water ? pickAnimalPond({ ...opts, near }) : null;
  if (p && Math.random() < (type === "duck" ? 0.8 : 0.55)) {
    x = p.x + rand(-p.hw * 0.5, p.hw * 0.5);
    spawnState = def.swims && !(def.canFly && Math.random() < 0.25) ? "swim" : "graze";
  }
  if (def.family === "bird" && type !== "duck" && Math.random() < 0.65) spawnState = "fly";
  const animal = makeAnimal(type, x, spawnState);
  state.animals.push(animal);
  return animal;
}

export function populateBiomeAnimals(count = BIOME_REPOPULATE_COUNT, opts = {}) {
  const target = Math.min(ANIMAL_SOFT_CAP, Math.max(0, count));
  const focusX = animalFocusX(opts);
  let tries = 0;
  while (state.animals.length < target && tries < target * 4) {
    tries++;
    spawnAnimal({
      ...opts,
      near: tries <= Math.ceil(target * 0.8),
      nearX: focusX,
      radius: opts.radius || 2200,
      minDistance: opts.minDistance || 180,
    });
  }
  state.animalTimer = rand(3, 6);
}

// Bears keep to the deep forest, well past the trees nearest the base
export function spawnBear() {
  const side = pick([-1, 1]);
  const x = clamp(CFG.baseX + side * rand(2600, CFG.baseX - 900), 900, CFG.worldWidth - 900);
  const bear = {
    x, vx: 0, dir: pick([-1, 1]),
    state: "graze", stateT: rand(2, 5), alive: true, anim: rand(0, 6),
    flee: 0, fleeT: 0, type: "bear", biome: activeBiomeId(), family: "bear",
    hp: 12, maxHp: 12, attackCd: 0, attackAnim: 0, flash: 0,
    chargeCd: 0, charging: 0,
    eatDown: 0, headT: rand(1, 3), scan: 0, earFlick: 0,
    dying: false, deathT: 0,
  };
  state.animals.push(bear);
  return bear;
}

export function spawnEnemy(type, portal) {
  if (!ENEMY_TYPES[type]) type = "imp";
  const t = ENEMY_TYPES[type];
  const strength = enemyStrengthForDay(t);
  const hp = Math.ceil(t.hp * enemyVitalityMultiplier() * strength.hp);
  const enemy = {
    x: portal.x, vx: 0, type, tag: type === "imp" || type === "fireImp" || type === "chainImp" ? "Imp" : "Enemy",
    hp, maxHp: hp,
    strengthHpMult: strength.hp,
    damageMult: strength.damage,
    speedMult: strength.speed,
    dir: portal.side > 0 ? -1 : 1,
    state: "advance", aiState: type === "imp" || type === "chainImp" ? "advance" : undefined, target: null, attackCd: 0,
    carry: 0, anim: rand(0, 6), flash: 0, attackAnim: 0, fleeing: false, portal,
    fy: t.flying ? -(t.fireball ? rand(105, 145) : 80 + rand(0, 30)) : 0,
    shootCd: (t.flying || t.caster) ? rand(0.5, t.fireball ? 1.4 : (t.shootInterval || 3)) : 0,
    poisonCd: t.rangedShoot ? rand(1, t.shootInterval || 5) : undefined,
    nightWave: Game.isNight,
  };
  if (type === "ashPriest") {
    Object.assign(enemy, {
      ashReady: false,
      ashScorchCd: rand(1.2, 3.2),
      ashWardCd: rand(1.5, 4.2),
      ashBurstCd: rand(2.0, 4.4),
      ashChannelT: 0,
      ashChannelMax: 0.72,
      ashCastFlash: 0,
      ashWardFlash: 0,
      ashBurstFlash: 0,
      attackKind: "",
    });
  }
  state.enemies.push(enemy);
  return enemy;
}

function bountyRaiderType() {
  const d = Game.day || 1;
  if ((Game.worldPhase || 1) >= 2) {
    if (d >= 4 && Math.random() < 0.35) return "voidBrute";
    if (d >= 3 && Math.random() < 0.55) return "voidWraith";
    return "shade";
  }
  if (activeBiomeId() !== "volcano") {
    return biomeWaveEnemyType(d, Math.random()) || portalGuardianType();
  }
  if (d >= 5 && Math.random() < 0.28) return "siegeImp";
  if (d >= 4 && Math.random() < 0.34) return "ashPriest";
  if (d >= 3 && Math.random() < 0.45) return "emberBrute";
  return "fireImp";
}

function poolEntryTypes(entry) {
  if (!entry) return [];
  return Array.isArray(entry) ? entry.filter(Boolean) : [entry];
}

function pickPoolEnemy(entry, fallback = null) {
  const choices = poolEntryTypes(entry).filter(type => ENEMY_TYPES[type]);
  return choices.length ? pick(choices) : fallback;
}

export function biomeWaveEnemyType(d, r) {
  const pool = BIOME_ENEMY_POOLS[activeBiomeId()];
  if (!pool) return null;

  const heavyChance = d >= 5 ? Math.min(0.2, 0.06 + (d - 4) * 0.018) : 0;
  const specialChance = d >= 3 ? Math.min(0.3, 0.1 + (d - 3) * 0.018) : 0;
  const standardChance = d >= 2 ? Math.min(0.42, 0.2 + (d - 2) * 0.02) : 0.12;

  if (pool.heavy && r < heavyChance) return pickPoolEnemy(pool.heavy);
  if (pool.special && r < heavyChance + specialChance) return pickPoolEnemy(pool.special);
  if (pool.standard && r < heavyChance + specialChance + standardChance) return pickPoolEnemy(pool.standard);
  return pickPoolEnemy(pool.basic) || pickPoolEnemy(pool.standard) || "imp";
}

// Daytime portal watchers: the basic denizen of the land the portal guards
// (a shade once the Hollow takes hold). Held to the pool's basic tier so
// wandering near a portal by day stays a light skirmish, not a heavy ambush.
export function portalGuardianType() {
  if ((Game.worldPhase || 1) >= 2) return "shade";
  const pool = BIOME_ENEMY_POOLS[activeBiomeId()];
  return (pool && pickPoolEnemy(pool.basic)) || "imp";
}

function spawnBountyRaider(portal) {
  const e = spawnEnemy(bountyRaiderType(), portal);
  e.bounty = true;
  e.maxHp = Math.ceil(e.maxHp * 1.28);
  e.hp = e.maxHp;
  e.bountyReward = 3 + Math.ceil((Game.day || 1) * 0.6);
  e.bountyGold = 4 + Math.ceil((Game.day || 1) * 0.8);
  e.flash = 0.25;
  spawnParticles(e.x, groundY - 32 + (e.fy || 0), 18, "#ff6a4a", 110, 120);
  spawnParticles(e.x, groundY - 24 + (e.fy || 0), 10, "#ffe07a", 70, 100);
  return e;
}

function biomeBossPortal(type, fallback = null) {
  const t = ENEMY_TYPES[type];
  if (!t?.biome) return fallback || pick(state.portals);
  if (fallback) return fallback;

  const side = pick([-1, 1]);
  const spread = t.flying ? 900 : 760;
  return { x: clamp(CFG.baseX + side * spread, 900, CFG.worldWidth - 900), side };
}

// Per-boss entrance rigging, run right after the boss entity is spawned.
const BOSS_RIGGERS = {
  fireDragon(drg, portal) {
    drg.patrolDir = portal.side > 0 ? -1 : 1;
    drg.dropCd = rand(3, 5);
    // Imps ride on the dragon's back and drop off over the base
    for (let k = 0; k < 4; k++) {
      const r = spawnEnemy("imp", portal);
      r.ridingDragon = drg;
      r.riderSeat = k;
      r.fy = (drg.fy || -110) - 52;
    }
  },
  magmaGolem(golem, portal) {
    Game.screenShake = Math.max(Game.screenShake || 0, 0.4);
    spawnParticles(portal.x, groundY - 20, 30, "#ff6a20", 160, 180);
    spawnParticles(portal.x, groundY - 10, 18, "#6b5a45", 200, 120);
  },
  voidTitan(titan, portal) {
    titan.dir = portal.side > 0 ? -1 : 1;
    Game.screenShake = Math.max(Game.screenShake || 0, 0.4);
    spawnParticles(portal.x, groundY - 20, 30, "#b9a0ff", 160, 180);
    spawnParticles(portal.x, groundY - 10, 18, "#8fe8ff", 200, 120);
  },
  voidSeraph(seraph, portal) {
    seraph.patrolDir = portal.side > 0 ? -1 : 1;
    seraph.dir = seraph.patrolDir;
    seraph.fy = -230;
    seraph.shootCd = rand(1.0, 1.8);
    seraph.seraphSummonCd = rand(4, 6);
    Game.screenShake = Math.max(Game.screenShake || 0, 0.32);
    spawnParticles(portal.x, groundY - 160, 34, "#8a5aff", 180, 220);
    spawnParticles(portal.x, groundY - 110, 18, "#d7f6ff", 120, 180);
  },
  forestStalker(stalker, portal) {
    stalker.dir = portal.side > 0 ? -1 : 1;
    stalker.specialCd = rand(2.8, 4.2);
    Game.screenShake = Math.max(Game.screenShake || 0, 0.28);
    spawnParticles(portal.x, groundY - 16, 24, "#6f8a42", 140, 120);
    spawnParticles(portal.x, groundY - 62, 18, "#b66bff", 115, 150);
  },
  skadiWrath(skadi, portal) {
    skadi.dir = portal.side > 0 ? -1 : 1;
    skadi.fy = -132;
    skadi.specialCd = rand(3.8, 5.2);
    skadi.cryoShieldCd = rand(6, 8);
    spawnParticles(portal.x, groundY - 130, 34, "#bfefff", 150, 210);
    spawnParticles(portal.x, groundY - 72, 18, "#1b2842", 130, 120);
  },
  duneBroodmother(brood, portal) {
    brood.dir = portal.side > 0 ? -1 : 1;
    brood.specialCd = rand(2.6, 3.8);
    brood.burrowT = 1.15;
    Game.screenShake = Math.max(Game.screenShake || 0, 0.2);
    spawnParticles(portal.x, groundY - 8, 34, "#d8b46a", 220, 90);
  },
  sunkenBehemoth(behemoth, portal) {
    behemoth.dir = portal.side > 0 ? -1 : 1;
    behemoth.specialCd = rand(4.2, 5.8);
    Game.screenShake = Math.max(Game.screenShake || 0, 0.35);
    spawnParticles(portal.x, groundY - 18, 34, "#4f6a34", 180, 130);
    spawnParticles(portal.x, groundY - 55, 14, "#b8ff7a", 90, 120);
  },
  ignitedCore(core, portal) {
    core.dir = portal.side > 0 ? -1 : 1;
    core.fy = -86;
    core.specialCd = rand(3.4, 4.6);
    core.coreHeat = 0.4;
    Game.screenShake = Math.max(Game.screenShake || 0, 0.4);
    spawnParticles(portal.x, groundY - 95, 38, "#ff6a28", 190, 230);
    spawnParticles(portal.x, groundY - 88, 18, "#fff0a0", 120, 240);
  },
  voidMindflayer(mindflayer, portal) {
    mindflayer.dir = portal.side > 0 ? -1 : 1;
    mindflayer.fy = -155;
    mindflayer.specialCd = rand(3.2, 4.8);
    mindflayer.goldDecayCd = 4.5;
    spawnParticles(portal.x, groundY - 145, 38, "#8c4cff", 180, 230);
    spawnParticles(portal.x, groundY - 105, 18, "#d7a8ff", 120, 190);
  },
};

export function spawnBoss(type, portal) {
  const spawnPortal = biomeBossPortal(type, portal);
  spawnEnemy(type, spawnPortal);
  const boss = state.enemies[state.enemies.length - 1];
  BOSS_RIGGERS[type]?.(boss, spawnPortal);
  return boss;
}

export function spawnFireDragon(portal) {
  return spawnBoss("fireDragon", portal);
}

export function spawnBiomeBoss(biomeId) {
  const type = BIOME_BOSS_TYPES[biomeId];
  if (!type) return null;
  return spawnBoss(type, biomeBossPortal(type));
}

export function planNight() {
  const d = Game.day;
  Game.threatLevel  = Math.max(1, d);
  // Hard mode doubles the count relative to normal; strength/type pressure stays separate.
  let quotaMult = difficulty().enemyCountMult;
  if ((Game.worldPhase || 1) >= 2) quotaMult *= 1.15; // the Hollow presses harder
  // Base horde scaling: 2x from day 1, ramping up ~10% per day (caps at 3.5x)
  const hordeMult = Math.min(3.5, 2 + Math.max(0, d - 1) * 0.1);
  // From round 3 onward, double the enemy count
  if (d >= 3) quotaMult *= 2;
  Game.nightQuota   = Math.round((3 + d * 3.5 + Math.pow(d * 0.7, 1.6) + Math.max(0, d - 8) * 2.25) * quotaMult * hordeMult * nightQuotaMetaMultiplier());
  Game.bountyRaidersRemaining = bountyRaiderCount();
  Game.nightQuota += Game.bountyRaidersRemaining || 0;
  Game.nightSpawned = 0;
  Game.spawnTimer   = 0;
  Game.nightCleared = false;

  // Never on the very first night; afterward, occasionally the horde only presses from one side.
  const livePortals = state.portals.filter(p => !p.destroyed);
  if (d > 1 && livePortals.length > 1 && Math.random() < 0.2) {
    const side = pick(livePortals).side;
    Game.oneSidedNightSide = side;
    Game.oneSidedAnnounce = { timer: 6, maxTimer: 6, side };
  } else {
    Game.oneSidedNightSide = null;
    Game.oneSidedAnnounce = null;
  }
}

function nightEnemyType() {
  const d = Game.day, r = Math.random();
  const difficultyPressure = difficulty().elitePressureMult;
  const eliteBonus = eliteChanceBonus();
  // Phase 2: the void rifts send the Hollow instead of the ember horde
  if ((Game.worldPhase || 1) >= 2) {
    if (Game.nightSpawned === 0) return d % 2 === 0 ? "voidSeraph" : "voidTitan";
    if (Game.nightSpawned === 1) return d % 2 === 0 ? "voidTitan" : "voidSeraph";
    const voidBruteChance = Math.min(0.32, 0.07 + d * 0.02 * difficultyPressure + eliteBonus);
    const wraithChance = Math.min(0.5, 0.12 + d * 0.03 * difficultyPressure + eliteBonus * 0.85);
    if (r < voidBruteChance) return "voidBrute";
    if (r < voidBruteChance + wraithChance) return "voidWraith";
    return "shade";
  }
  if (Game.nightSpawned === 0) {
    const biomeBoss = BIOME_BOSS_TYPES[activeBiomeId()];
    if (d >= 3 && biomeBoss) return biomeBoss;
    if (BOSS_SCHEDULE[d]) return BOSS_SCHEDULE[d];
  }
  // Second boss slot: legacy ember bosses only; biome bosses are tied to the
  // active world biome and use the first slot above.
  if (Game.nightSpawned === 1 && !BIOME_BOSS_TYPES[activeBiomeId()]) {
    const unlocked = Object.keys(BOSS_SCHEDULE).map(Number).filter(n => d >= n).sort((a, b) => b - a);
    if (unlocked.length >= 2) return BOSS_SCHEDULE[unlocked[1]];
  }
  const biomeType = biomeWaveEnemyType(d, r);
  if (biomeType) return biomeType;

  const flyingImpChance = Math.min(0.55, Math.max(0, d - 2) * 0.055 * difficultyPressure + eliteBonus * 0.85);
  const emberBruteChance = d >= 2 ? Math.min(0.34, (d - 1) * 0.035 * difficultyPressure + eliteBonus) : eliteBonus * 0.35;
  const ashPriestChance = d >= 4 ? Math.min(0.26, (d - 3) * 0.028 * difficultyPressure + eliteBonus * 0.65) : eliteBonus * 0.25;
  // Siege imps roll in from day 4: a slow, heavily-shielded battering column.
  const siegeImpChance = d >= 4 ? Math.min(0.22, (d - 3) * 0.03 * difficultyPressure + eliteBonus * 0.5) : 0;
  // Chain imps arrive from day 3 as wall-breach support for the horde.
  const chainImpChance = d >= 3 ? Math.min(0.16, (d - 2) * 0.028 * difficultyPressure + eliteBonus * 0.4) : 0;
  if (r < emberBruteChance) return "emberBrute";
  if (r < emberBruteChance + ashPriestChance) return "ashPriest";
  if (r < emberBruteChance + ashPriestChance + siegeImpChance) return "siegeImp";
  if (r < emberBruteChance + ashPriestChance + siegeImpChance + chainImpChance) return "chainImp";
  if (r < emberBruteChance + ashPriestChance + siegeImpChance + chainImpChance + flyingImpChance) return "fireImp";
  return "imp";
}

export function updateSpawning(dt) {
  state.animalTimer -= dt;
  if (state.animalTimer <= 0) {
    state.animalTimer = rand(3, 6);
    if (!Game.isNight && !Game.inMine) {
      const focusX = animalFocusX();
      spawnAnimal({
        near: nearbyAnimalCount(focusX, NEAR_ANIMAL_RADIUS) < NEAR_ANIMAL_TARGET || Math.random() < 0.75,
        nearX: focusX,
      });
    }
  }

  if (Game.isNight && Game.nightSpawned < Game.nightQuota) {
    Game.spawnTimer -= dt;
    if (Game.spawnTimer <= 0) {
      Game.spawnTimer = nextNightSpawnInterval();
      let livePortals = state.portals.filter(p => !p.destroyed);
      if (Game.oneSidedNightSide != null) {
        const sided = livePortals.filter(p => p.side === Game.oneSidedNightSide);
        if (sided.length) livePortals = sided;
      }
      const portal = pick(livePortals.length ? livePortals : state.portals);
      let spawned;
      const shouldSpawnBounty = (Game.bountyRaidersRemaining || 0) > 0 && Game.nightSpawned >= 1
        && (Game.nightSpawned % 4 === 0 || Game.nightSpawned + Game.bountyRaidersRemaining >= Game.nightQuota);
      if (shouldSpawnBounty) {
        Game.bountyRaidersRemaining--;
        spawned = spawnBountyRaider(portal);
      } else {
        const type = nightEnemyType();
        if (ENEMY_TYPES[type] && ENEMY_TYPES[type].boss) {
          spawned = spawnBoss(type, portal);
        } else {
          spawnEnemy(type, portal);
          spawned = state.enemies[state.enemies.length - 1];
        }
        if (ENEMY_TYPES[type] && ENEMY_TYPES[type].legendary) {
          const lb = spawned;
          lb.specialCd  = 3;
          lb.specialPhase = 0;
          lb.specialTimer = 0;
          state.legendaryBoss = lb;
          // Intro popup
          Game.legendaryIntro = { timer: 5.5, maxTimer: 5.5, bossType: type };
          // Rally all fighters
          for (const u of state.units) u.rallied = true;
          const bossCol = ENEMY_TYPES[type].eye || "#ff2020";
          for (let k = 0; k < 30; k++)
            state.particles.push({ x: CFG.baseX + rand(-120,120), y: groundY - rand(40,160), vx: rand(-60,60), vy: rand(-80,-20), life: rand(0.6,1.2), color: bossCol, size: rand(2,5) });
        }
      }
      Game.nightSpawned++;
    }
  }
}
