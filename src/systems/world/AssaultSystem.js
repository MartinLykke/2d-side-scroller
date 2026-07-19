import { CFG } from '../../config/config.js';
import { clamp, clampCameraTarget, dist, rand, randInt } from '../../util/math.js';
import { groundY, W } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnEnemy, spawnParticles, spawnGoldReward, floaty, planNight } from './SpawnSystem.js?v=biomeactive1';
import { shootArrow } from '../combat/Combat.js?v=biomeactive1';
import { moveToward, nearestEnemy } from '../ai/AIHelpers.js?v=biomeactive1';
import { buildForest } from './ForestSystem.js?v=biomeactive1';
import { activeBiomeId, nextBiomeId, setActiveBiome, clearTreeCache } from '../../rendering/Effects.js?v=biomeactive1';
import { addXP } from '../economy/UpgradeSystem.js?v=biomeweapons1';

// ── Portal assault ───────────────────────────────────────────────────────
// The player sounds the war horn (G): every archer and guard marches on the
// nearest portal. Getting close wakes a defense wave; survivors besiege the
// gate until it falls. Victory begins phase 2 — the Hollow.

const GUARD_MELEE_STAND = 46;    // guards hammer the pillars up close
const ARCHER_SIEGE_STAND = 300;  // archers volley from a stand-off line
const ARCHER_SIEGE_RANGE = 540;

function assaultFighters() {
  return state.units.filter(u =>
    u.assault && (u.role === "archer" || u.role === "guard") && u.hp > 0 && !u.dying);
}

function clearAssaultFlags() {
  for (const u of state.units) {
    if (!u.assault) continue;
    u.assault = false;
    u.assaultSlot = 0;
    u.combatTarget = null;
  }
}

function dismountUnit(u) {
  u.onWall = false;
  u.wall = null;
  u.guardWall = null;
  u.wallClimbT = 0;
  u.climbingWall = false;
  u.fixedSide = null;
  u.grapple = null;
  u.grappleLiftY = 0;
  u.combatTarget = null;
  u.panic = 0;
}

export function startAssault() {
  if (Game.state !== "play" || Game.inMine || !state.player) return;
  const px = state.player.x;
  if (state.assault) {
    floaty(px, "The assault is already underway!", "#cfe6f2");
    return;
  }
  if ((Game.worldPhase || 1) >= 2) {
    floaty(px, "The void rifts defy mortal weapons", "#b9a0ff");
    return;
  }
  if (Game.isNight || Game.time > CFG.phases.day) {
    floaty(px, "The army won't march after sundown", "#ff8a6a");
    return;
  }
  const fighters = state.units.filter(u =>
    (u.role === "archer" || u.role === "guard") && u.hp > 0 && !u.dying);
  if (!fighters.length) {
    floaty(px, "No archers or guards to send", "#ff8a6a");
    return;
  }

  const live = state.portals.filter(p => !p.destroyed);
  if (!live.length) return;
  let portal = live[0];
  for (const p of live) if (dist(px, p.x) < dist(px, portal.x)) portal = p;

  // Damage from a failed attempt sticks — the gate stays cracked.
  if (portal.hp === undefined) {
    portal.maxHp = CFG.portalHp + (Game.day - 1) * CFG.portalHpPerDay;
    portal.hp = portal.maxHp;
  }

  let archerSlot = 0, guardSlot = 0;
  for (const u of fighters) {
    dismountUnit(u);
    u.assault = true;
    u.assaultSlot = u.role === "guard" ? guardSlot++ : archerSlot++;
  }

  state.assault = {
    phase: "march", portal,
    waveSpawned: false, halfWaveSpawned: false,
    waveToSpawn: 0, spawnTimer: 0,
    celebrateT: 0, returnT: 0, cheerTimer: 0,
  };
  Audio.horn();
  floaty(state.base.x, "⚔ THE ASSAULT BEGINS!", "#f2c14e", 18);
  floaty(px, fighters.length + " fighters march on the portal", "#cfe6f2");
}

function defenderType() {
  const d = Game.day, r = Math.random();
  const brute = Math.min(0.3, 0.06 + d * 0.02);
  const priest = d >= 3 ? Math.min(0.22, 0.04 + d * 0.015) : 0;
  const flyer = Math.min(0.35, 0.08 + d * 0.02);
  if (r < brute) return "emberBrute";
  if (r < brute + priest) return "ashPriest";
  if (r < brute + priest + flyer) return "fireImp";
  return "imp";
}

function queueDefenseWave(a, count) {
  a.waveToSpawn += count;
  const p = a.portal;
  floaty(p.x, "The portal convulses!", "#ff8a3d", 16);
  spawnParticles(p.x, groundY - 70, 26, "#ff6a20", 150, 160);
  spawnParticles(p.x, groundY - 100, 12, "#ffd060", 90, 140);
  Audio.portalSpawn();
  Game.screenShake = Math.max(Game.screenShake || 0, 0.25);
}

function defenseWaveSize(fighterCount) {
  const raw = (7 + Game.day * 1.4 + fighterCount * 0.8) * (Game.diffMult || 1);
  return Math.min(26, Math.round(raw));
}

export function damagePortal(portal, dmg) {
  if (portal.destroyed || portal.hp === undefined) return;
  portal.hp -= dmg;
  portal.flash = 0.15;
  spawnParticles(portal.x + rand(-40, 40), groundY - rand(20, 120), 3, "#caa46a", 40, 50);
  spawnParticles(portal.x + rand(-30, 30), groundY - rand(30, 110), 2, "#ff8a3d", 30, 60);
}

function destroyPortal(a) {
  const p = a.portal;
  p.hp = 0;
  p.destroyed = true;
  a.phase = "celebrate";
  a.celebrateT = CFG.assaultCelebrateTime;
  a.waveToSpawn = 0;

  spawnParticles(p.x, groundY - 80, 60, "#ff8a3d", 280, 300);
  spawnParticles(p.x, groundY - 80, 40, "#ffd27a", 220, 260);
  spawnParticles(p.x, groundY - 60, 50, "#5a5260", 320, 220);
  Game.screenShake = Math.max(Game.screenShake || 0, 0.9);
  Audio.horn();
  floaty(p.x, "THE PORTAL IS DESTROYED!", "#ffd27a", 22);
  addXP(60);
  spawnGoldReward(p.x, 24 + Game.day * 2, "boss", { spreadX: 70, fromY: groundY - 40, vx: 120 });

  // The surviving defenders lose their anchor to this world and scatter.
  for (const e of state.enemies) {
    if (e.portalDefender) e.fleeing = true;
  }
}

function failAssault() {
  floaty(state.base.x, "The assault has broken — the army is lost", "#ff8a6a", 16);
  clearAssaultFlags();
  state.assault = null;
}

export function updateAssault(dt) {
  const a = state.assault;
  if (!a) return;
  const p = a.portal;
  if (p.flash > 0) p.flash -= dt;

  // Trickle the queued defense wave out of the portal.
  if (a.waveToSpawn > 0 && !p.destroyed) {
    a.spawnTimer -= dt;
    if (a.spawnTimer <= 0) {
      a.spawnTimer = rand(0.25, 0.6);
      const e = spawnEnemy(defenderType(), p);
      e.portalDefender = true;
      a.waveToSpawn--;
    }
  }

  const fighters = assaultFighters();

  if (a.phase === "march" || a.phase === "siege") {
    if (!fighters.length) { failAssault(); return; }

    let nearestDist = 1e9;
    for (const f of fighters) nearestDist = Math.min(nearestDist, dist(f.x, p.x));

    if (a.phase === "march" && nearestDist < CFG.assaultWakeRange) {
      a.phase = "siege";
      a.waveSpawned = true;
      queueDefenseWave(a, defenseWaveSize(fighters.length));
    }
    if (a.phase === "siege") {
      if (!a.halfWaveSpawned && p.hp <= p.maxHp * 0.5) {
        a.halfWaveSpawned = true;
        queueDefenseWave(a, Math.ceil(defenseWaveSize(fighters.length) / 2));
        floaty(p.x, "The portal shudders!", "#ff8a3d", 15);
      }
      if (p.hp <= 0) destroyPortal(a);
    }
    return;
  }

  if (a.phase === "celebrate") {
    a.celebrateT -= dt;
    a.cheerTimer -= dt;
    if (a.cheerTimer <= 0 && fighters.length) {
      a.cheerTimer = rand(0.25, 0.6);
      const u = fighters[randInt(0, fighters.length - 1)];
      u.strike = 0.3;
      spawnParticles(u.x, groundY - 44, 7, Math.random() < 0.5 ? "#f2c14e" : "#9bd05a", 60, 110);
      if (Math.random() < 0.3) floaty(u.x, "For the kingdom!", "#f2c14e");
    }
    if (a.celebrateT <= 0) {
      a.phase = "return";
      a.returnT = CFG.assaultReturnTime;
      floaty(p.x, "Home, to the kingdom!", "#cfe6f2", 15);
    }
    return;
  }

  if (a.phase === "return") {
    a.returnT -= dt;
    if (a.returnT <= 0 && !Game.phaseTransition) {
      Game.phaseTransition = { t: 0, swapped: false };
    }
  }
}

// Per-unit assault behavior. Returns true when the unit was handled here;
// false hands the frame to the normal role AI (used for close-quarters
// fighting, which the archer/guard combat logic already does well).
export function assaultUnitAI(u, dt) {
  const a = state.assault;
  const p = a.portal;
  const isGuard = u.role === "guard";
  const toBase = -p.side; // direction from the portal toward the base

  if (a.phase === "celebrate") {
    u.dir = Math.sign(p.x - u.x) || u.dir;
    u.combatTarget = null;
    return true;
  }

  if (a.phase === "return") {
    moveToward(u, CFG.baseX + ((u.assaultSlot % 7) - 3) * 34, 118, dt);
    return true;
  }

  // A foe already upon us is the role AI's fight (guards duel, archers kite).
  const engageRange = a.phase === "siege" ? (isGuard ? 240 : 620) : (isGuard ? 160 : 200);
  if (nearestEnemy(u.x, engageRange)) return false;

  if (isGuard) {
    const standX = p.x + toBase * (GUARD_MELEE_STAND + (u.assaultSlot % 4) * 22);
    if (!moveToward(u, standX, 126, dt)) return true;
    u.dir = Math.sign(p.x - u.x) || u.dir;
    if (a.phase === "siege" && u.cooldown <= 0 && !p.destroyed) {
      u.cooldown = 0.8;
      u.strike = 0.28;
      damagePortal(p, 3);
      Audio.hit();
    }
    return true;
  }

  const standX = p.x + toBase * (ARCHER_SIEGE_STAND + (u.assaultSlot % 5) * 30);
  moveToward(u, standX, 114, dt);
  if (a.phase === "siege" && u.cooldown <= 0 && !p.destroyed && dist(u.x, p.x) < ARCHER_SIEGE_RANGE) {
    u.dir = Math.sign(p.x - u.x) || u.dir;
    const heavy = state.archerSkills.includes("heavy_ballista");
    // The arrow is the visual (and can clip a defender en route); the siege
    // damage itself lands directly so portal DPS stays steady.
    shootArrow(u.x, groundY - 36, { x: p.x + rand(-26, 26), fy: -rand(35, 115) }, u);
    damagePortal(p, heavy ? 5 : 1);
    u.cooldown = heavy ? 2.2 : 0.9;
  }
  return true;
}

// ── Phase 2: the Hollow ─────────────────────────────────────────────────
// Runs at the peak of the transition flash (see game.js): the world is
// remade under cover of white, so the reveal shows the changed land.
export function performPhaseShift() {
  const nextBiome = nextBiomeId(activeBiomeId());
  if (nextBiome) {
    const biome = setActiveBiome(nextBiome, { reseed: true });
    Game.worldPhase = 1;
    state.assault = null;

    const { player } = state;
    player.x = CFG.baseX;
    player.knock = 0;
    player.invuln = Math.max(player.invuln || 0, 1.4);
    Game.inMine = false;
    Game.cam = clampCameraTarget(CFG.baseX - W / 2, CFG.worldWidth, W, Game.zoom || 1);

    for (const u of state.units) {
      if (u.assault) {
        u.assault = false;
        u.assaultSlot = 0;
        u.x = CFG.baseX + rand(-240, 240);
      }
      dismountUnit(u);
      if (u.pendingLog) { u.pendingLog.claimedBy = null; u.pendingLog = null; }
      if (u.carryLog) { u.carryLog.carriedBy = null; u.carryLog = null; }
    }

    state.enemies.length = 0;
    state.arrows.length = 0;
    state.legendaryBoss = null;
    state.firePools.length = 0;
    state.animals.length = 0;

    for (const p of state.portals) {
      p.destroyed = false;
      p.voidRift = false;
      p.hp = undefined;
      p.maxHp = undefined;
      p.flash = 0;
      p.lastDayActivated = Game.day;
    }

    buildForest();
    clearTreeCache();
    planNight();

    const col = biome.hot ? "#ff7a36" : biome.corrupt ? "#b66bff" : biome.snow ? "#cfe6f2" : biome.deco==="desert" ? "#d8b06a" : biome.deco==="swamp" ? "#9bd05a" : "#f2c14e";
    spawnParticles(CFG.baseX, groundY - 60, 42, col, 260, 220);
    spawnParticles(CFG.baseX, groundY - 80, 20, "#ffffff", 150, 190);
    floaty(state.base.x, "ENTERING " + biome.name.toUpperCase(), col, 20);
    Audio.horn();
    return;
  }

  Game.worldPhase = 2;
  state.assault = null;

  const { player } = state;
  player.x = CFG.baseX;
  player.knock = 0;
  player.invuln = Math.max(player.invuln || 0, 1.4);
  Game.inMine = false;
  Game.cam = clampCameraTarget(CFG.baseX - W / 2, CFG.worldWidth, W, Game.zoom || 1);

  for (const u of state.units) {
    if (u.assault) {
      u.assault = false;
      u.assaultSlot = 0;
      u.x = CFG.baseX + rand(-240, 240);
    }
    dismountUnit(u);
    // The forest is regrown below — drop any references into the old one.
    if (u.pendingLog) { u.pendingLog.claimedBy = null; u.pendingLog = null; }
    if (u.carryLog) { u.carryLog.carriedBy = null; u.carryLog = null; }
  }

  // The old world's horrors are swept away with it.
  state.enemies.length = 0;
  state.arrows.length = 0;
  state.legendaryBoss = null;
  state.firePools.length = 0;
  state.animals.length = 0;

  for (const p of state.portals) {
    p.destroyed = false;
    p.voidRift = true;
    p.hp = undefined;
    p.maxHp = undefined;
    p.flash = 0;
    p.lastDayActivated = Game.day; // no guardians the instant the world turns
  }

  // Twist the land: new silhouettes, new forest, void-tinted palette
  // (Effects.biomeAt and skyColors read Game.worldPhase).
  Game.treeSeed = randInt(1, 99999);
  buildForest();
  clearTreeCache();

  planNight();
  spawnParticles(CFG.baseX, groundY - 60, 40, "#b9a0ff", 260, 220);
  spawnParticles(CFG.baseX, groundY - 80, 22, "#8fe8ff", 180, 200);
  floaty(state.base.x, "THE HOLLOW AWAKENS", "#b9a0ff", 20);
  Audio.horn();
}
