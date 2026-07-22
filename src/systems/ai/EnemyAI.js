import { CFG } from '../../config/config.js';
import { ENEMY_TYPES } from '../../config/enemies.js?v=biomeactive4';
import { clamp, lerp, dist, rand, applyCrit } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { inject } from '../../core/services.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnParticles, floaty, critFloaty, spawnEnemy } from '../world/SpawnSystem.js?v=biomeactive4';
import { meleeHitPlayer, damagePlayer } from '../combat/PlayerCombat.js?v=biomeactive4';
import { killEnemy, spawnImpBlood } from '../../util/EnemyUtils.js?v=biomeactive4';
import { wallHeight, wallReady, wallRenderWidth, entityWallLift } from '../../entities/Wall.js';
import { updateBoss, dropRiderFromDragon, spawnFirePool } from './BossAI.js?v=biomeactive4';
import { updateBruteRig } from '../../rendering/sprites/Brute.js?v=biomeactive4';

const IMP_STACK_STEP = 18;
const IMP_ATTACH_RANGE = 34;
const IMP_TOP_TRIGGER_PAD = 18;
const IMP_STACK_EXTRA_SLOTS = 2;
const WALL_DUEL_GAP = 22;
const IMP_POUNCE_WALL_LOCKOUT = 92;
let impStackSequence = 1;
const impWallCache = new Map();

function clearImpWallCache() {
  impWallCache.clear();
}

function impWallCacheEntry(w) {
  let entry = impWallCache.get(w);
  if (!entry) {
    entry = { stack: null, queue: null };
    impWallCache.set(w, entry);
  }
  return entry;
}

function invalidateImpWallCache(w) {
  if (w) impWallCache.delete(w);
}

function scaledEnemyType(e, t) {
  const damageMult = e.damageMult || 1;
  const speedMult = e.speedMult || 1;
  if (damageMult === 1 && speedMult === 1) return t;
  const scaled = { ...t, speed: t.speed * speedMult };
  if (t.dmg !== undefined) scaled.dmg = t.dmg * damageMult;
  if (t.baseDmg !== undefined) scaled.baseDmg = t.baseDmg * damageMult;
  if (t.meleeDmg !== undefined) scaled.meleeDmg = t.meleeDmg * damageMult;
  if (t.ashFireballDmg !== undefined) scaled.ashFireballDmg = t.ashFireballDmg * damageMult;
  return scaled;
}

function playerCombatLift() {
  const p = state.player;
  return p ? (p.jumpH || 0) + entityWallLift(p) : 0;
}

function mix(a, b, t) {
  return lerp(a, b, clamp(t, 0, 1));
}

const APPROACH_SLOW_RANGE = 260;
const APPROACH_FAR_MULT = 2.0;
const APPROACH_NEAR_MULT = 0.55;
function approachSpeedMult(distToBase) {
  if (distToBase >= APPROACH_SLOW_RANGE) return APPROACH_FAR_MULT;
  return mix(APPROACH_NEAR_MULT, APPROACH_FAR_MULT, distToBase / APPROACH_SLOW_RANGE);
}

// Enemies far from any opposition (player or living unit) sprint toward the
// base so slow types like the ember brute actually arrive before dawn.
const UNOPPOSED_RANGE = 260;
const UNOPPOSED_SPRINT_MULT = 2.4;
function unopposedSprintMult(e) {
  const { player, units } = state;
  if (dist(e.x, player.x) < UNOPPOSED_RANGE) return 1;
  for (const u of units) {
    if (u.hp <= 0 || u.dying) continue;
    if (dist(e.x, u.x) < UNOPPOSED_RANGE) return 1;
  }
  return UNOPPOSED_SPRINT_MULT;
}

function fleeToPortal(e, t, dt) {
  const tx = e.portal ? e.portal.x : (e.x < CFG.baseX ? 0 : CFG.worldWidth);
  e.dir = Math.sign(tx - e.x);
  e.x += e.dir * t.speed * 1.6 * dt;
  return dist(e.x, tx) < 40;
}

function debuffSpeedMult(e) {
  let m = 1;
  if (e.rooted > 0) m = 0.02;
  else if (e.frost > 0) m = 0.3;
  else if (e.slow > 0) m = 0.45;
  // Glacial Wake: crossing the sapphire's ice trail cripples a leg for good.
  // Unlike frost/slow this never ticks down, so it stacks under the timed ones.
  if (e.glacialMark) m *= 0.5;
  if (e.emberFrenzy > 0) m *= 1.18;
  return m;
}

function tickPoisonAndBlind(e, dt) {
  if (e.blind > 0) {
    e.blind -= dt;
    if (e.blind <= 0) {
      e.blind = 0;
      e.blindedHits = 0;
    }
  }
  if (!(e.poison > 0)) return false;
  e.poison -= dt;
  e.poisonTick = (e.poisonTick || 0) - dt;
  const py = groundY + (e.fy || 0) - 24;
  if (Math.random() < dt * 7) spawnParticles(e.x + rand(-6, 6), py + rand(-7, 5), 1, "#7fe05a", 20, 35);
  if (e.poisonTick <= 0) {
    const dmg = e.poisonDmg || 1;
    e.hp -= dmg;
    e.flash = Math.max(e.flash || 0, 0.08);
    e.poisonTick = 0.85;
    spawnParticles(e.x, py, 7, "#7fe05a", 44, 62);
    spawnParticles(e.x, py, 3, "#b8ff7a", 28, 72);
    spawnImpBlood(e, 0.35, py);
    floaty(e.x, "-" + dmg, "#7fe05a", 12);
    if (e.hp <= 0) {
      killEnemy(e);
      return true;
    }
  }
  if (e.poison <= 0) {
    e.poison = 0;
    e.poisonDmg = 0;
  }
  return false;
}

function wallAt(side, x) {
  let best = null;
  for (const w of state.walls) {
    if (!w.commissioned || w.hp <= 0 || w.side !== side) continue;
    if (side < 0 && w.x > x && w.x < CFG.baseX) { if (!best || w.x < best.x) best = w; }
    if (side > 0 && w.x < x && w.x > CFG.baseX) { if (!best || w.x > best.x) best = w; }
  }
  return best;
}

// Initialize enemy AI state
function initEnemyAI(e) {
  if (e.aiState === undefined) {
    e.aiState = "idle";
    e.stateTimer = 0;
    e.attackWindup = 0;
  }
}

// Transition to a new AI state
function changeState(e, newState, duration = 0) {
  e.aiState = newState;
  e.stateTimer = duration;
  // Remember how long the pre-strike telegraph lasts so the renderer (via
  // attackPose) can play a real wind-up coil during "attacking", instead of
  // only ever seeing the follow-through once the blow has already landed.
  if (newState === "attacking") e.windupDur = duration;
}

// Framerate-independent gait signal, written here and read by EnemyRig.gait().
// This replaces the old render-side motion() that mutated _bPX/_bMv/_bLean while
// drawing — which made a culled or slow-framerate enemy's walk cycle stutter,
// since it depended on how often (and how) the entity happened to be painted.
function updateEnemyGait(e, dt) {
  const prevX = e._gx;
  e._gx = e.x;
  const moved = prevX === undefined ? 0 : e.x - prevX;
  const inst = Math.abs(moved) / Math.max(dt, 1e-4);
  const s = Math.min(1, dt * 12);
  e.moveSpeed = (e.moveSpeed || 0) + (inst - (e.moveSpeed || 0)) * s;
  e.moving = e.moveSpeed > 10;
  const fwd = clamp(moved * (e.dir || 1) / Math.max(dt, 1e-4) / 220, -1, 1);
  e.gaitLean = (e.gaitLean || 0) + (fwd - (e.gaitLean || 0)) * Math.min(1, dt * 8);
  // Safety net: capture a freshly-triggered attack's full duration even if the
  // site that set attackAnim didn't declare one, so attackPose's progress is
  // always measured against the real length (never a per-renderer guess).
  if ((e.attackAnim || 0) > (e.attackDur || 0) + 1e-4) e.attackDur = e.attackAnim;
  // The brute carries a stateful procedural rig; tick it here (with every other
  // enemy) so culling can never stall its gait mid-stride.
  if (e.type === "brute") updateBruteRig(e, dt);
}

// Begin an attack: sets the countdown AND records its full duration + shape so
// the renderer can drive a normalized wind-up → impact → recovery pose.
//   dur     total strike time (seconds)
//   kind    optional pose label ("bash" | "swipe" | "spit" | "lob" | "slam" | …)
//   impact  0..1 point in the strike where the blow lands (default in EnemyRig)
//   max     when true, don't shorten an already-longer strike in progress
// The brute owns a richer strike vocabulary than the generic bash/swipe pair,
// and alternates variations so consecutive blows never replay the same motion.
// Remapping here keeps every call site generic — no per-type branches upstream.
const BRUTE_KINDS = {
  bash:  ["bruteWallSmash", "bruteWallSmash"], // horizontal structure strike
  swipe: ["bruteSweep", "bruteHammer"], // players and friendly units
  lob:   ["bruteThrow", "bruteThrow"],
};
function bruteAttackKind(e, kind) {
  const pair = BRUTE_KINDS[kind];
  if (!pair) return kind;
  e._bruteAlt = (e._bruteAlt || 0) ^ 1;
  return pair[e._bruteAlt];
}

// Pick a Brute's variation when its windup begins, not when the hit lands.
// The renderer can then coil into the same pose family that will actually
// strike, avoiding the visible sweep-to-hammer snap at the end of a telegraph.
function prepareEnemyAttack(e, kind) {
  if (e.type !== "brute") return kind;
  const resolved = bruteAttackKind(e, kind);
  e._preparedAttackFamily = kind;
  e._preparedAttackKind = resolved;
  e.attackKind = resolved;
  return resolved;
}

function clearPreparedEnemyAttack(e) {
  delete e._preparedAttackFamily;
  delete e._preparedAttackKind;
}

function startEnemyAttack(e, dur, { kind = "swipe", impact, max = false } = {}) {
  if (e.type === "brute") {
    if (e._preparedAttackFamily === kind && e._preparedAttackKind) {
      kind = e._preparedAttackKind;
      clearPreparedEnemyAttack(e);
    } else {
      kind = bruteAttackKind(e, kind);
    }
    // Never begin the next telegraph while the previous pose is still easing
    // through its recovery frames.
    e.attackCd = Math.max(e.attackCd || 0, dur);
  }
  e.attackAnim = max ? Math.max(e.attackAnim || 0, dur) : dur;
  e.attackDur = dur;
  e.attackKind = kind;
  if (impact !== undefined) e.attackImpact = impact;
  else if (e.attackImpact !== undefined) delete e.attackImpact;
}

function breakImpStack(e) {
  invalidateImpWallCache(e.stackWallRef);
  invalidateImpWallCache(e.queueWallRef);
  e.stackWallRef = null;
  e.queueWallRef = null;
  e.queueIndex = undefined;
  e.stackJoinOrder = null;
  e.impIndex = undefined;
  e.stackPos = undefined;
  e.climbProgress = undefined;
  e.climbStartY = undefined;
  e.impStackY = 0;
}

function markImpBreachedWall(e, wall = null) {
  e.breachedWall = true;
  e.breachedWallRef = wall || null;
}

function clearImpWallBreach(e) {
  e.breachedWall = false;
  e.breachedWallRef = null;
}

function impWallBreachBypassesWall(e, wall) {
  if (!e.breachedWall) return false;
  if (e.breachedWallRef && wall && wall !== e.breachedWallRef) {
    clearImpWallBreach(e);
    return false;
  }
  return true;
}

function clearImpStackDrop(e) {
  e.leftStack = false;
  e.hasLeftStack = false;
  e.leftStackWall = null;
  e.wallDropT = 0;
  e.wallDropStartFy = undefined;
  e.wallDropLand = 0;
}

function impStackDropBypassesWall(e, wall) {
  if (!e.leftStack) return false;
  if (e.leftStackWall && wall && wall !== e.leftStackWall && e.hasLeftStack) {
    clearImpStackDrop(e);
    return false;
  }
  return true;
}

// Heavier enemies get a slower, more telegraphed swing so their bulk reads
// clearly instead of flashing through the generic pose. This only stretches the
// *visual* strike window (attackDur); attack cadence (attackCd) is unchanged.
const SWING_MULT = {
  brute: 4.6,
  voidBrute: 2.6,
  amalgam: 2.4, obsidianJuggernaut: 2.4, murkAbomination: 2.3,
  iceGolem: 2.2, behemothScorpion: 2.2, breeder: 2.1,
  maskedGreed: 1.5,
};
function swingMult(e) {
  return SWING_MULT[e.type] || 1;
}

// Most enemies are tiny enough that the historical centre-distance thresholds
// work. The Brute is pose-driven, though: its hands reach far beyond its feet,
// so engagement must use the authored reach instead of forcing its centre on
// top of the target before it is allowed to swing.
function meleeReach(e, t, fallback) {
  return e.type === "brute" ? (t.meleeReach || 74) : fallback;
}

function wallAttackRange(e, t, wall) {
  if (e.type !== "brute") return 30;
  return Math.max(30, wallRenderWidth(wall) * 0.5 + (t.wallReach || 58));
}

function baseAttackRange(e, t) {
  return e.type === "brute" ? (t.baseReach || 94) : 70;
}

function setImpState(e, next) {
  if (e.aiState !== next) changeState(e, next, 0);
}

function wallOutsideX(w) {
  return w.x + w.side * 30;
}

function wallInsideX(w) {
  return w.x - w.side * 48;
}

function impPounceBlockedByWall(e, target) {
  if (e.wallTopWall) return true;
  const landX = target ? e.x + Math.max(-96, Math.min(96, target.x - e.x)) : e.x;
  const leapLo = Math.min(e.x, landX);
  const leapHi = Math.max(e.x, landX);
  for (const w of state.walls) {
    if (!wallReady(w)) continue;
    const half = Math.max(24, wallRenderWidth(w) / 2);
    const lockout = half + IMP_POUNCE_WALL_LOCKOUT;
    if (Math.abs(e.x - w.x) <= lockout) return true;
    if (target && Math.abs(target.x - w.x) <= lockout) return true;
    if (leapLo <= w.x + half + 8 && leapHi >= w.x - half - 8) return true;
  }
  return false;
}

function impPlayerBlockedByWall(e, player) {
  const wall = wallAt(e.x < CFG.baseX ? -1 : 1, e.x);
  if (!wall || impWallBreachBypassesWall(e, wall)) return false;
  const half = Math.max(24, wallRenderWidth(wall) / 2);
  const playerOutsideWall = (player.x - wall.x) * wall.side > half + 6;
  return !playerOutsideWall;
}

function impDefenderBlockedByWall(e, defender) {
  const wall = wallAt(e.x < CFG.baseX ? -1 : 1, e.x);
  if (!wall || impWallBreachBypassesWall(e, wall)) return false;
  const half = Math.max(24, wallRenderWidth(wall) / 2);
  const defenderOutsideWall = (defender.x - wall.x) * wall.side > half + 6;
  return !defenderOutsideWall;
}

function impStackForWall(w) {
  const entry = impWallCacheEntry(w);
  if (entry.stack) return entry.stack;

  const stack = [];
  for (const e of state.enemies) {
    if (e.type !== "imp" || e.fleeing || e.dying || e.stackWallRef !== w) continue;
    if (e.aiState !== "stacking" && e.aiState !== "climbOver") continue;
    stack.push(e);
  }
  stack.sort((a, b) => (a.stackJoinOrder || 0) - (b.stackJoinOrder || 0));
  stack.forEach((imp, idx) => {
    imp.impIndex = idx;
    imp.stackPos = idx;
    imp.climbProgress = 1;
    imp.impStackY = -idx * IMP_STACK_STEP;
    const seed = (imp.stackJoinOrder || 0) * 7.13;
    imp.impStackX = ((idx % 2 === 0) ? -1 : 1) * Math.min(8, 2.5 + idx * 0.5) + Math.sin(seed) * 2;
  });
  entry.stack = stack;
  return stack;
}

function impStackCapacity(w) {
  const neededForWallTop = Math.ceil(Math.max(1, wallHeight(w) - IMP_TOP_TRIGGER_PAD) / IMP_STACK_STEP);
  return Math.max(2, neededForWallTop + IMP_STACK_EXTRA_SLOTS);
}

function impQueueForWall(w) {
  const entry = impWallCacheEntry(w);
  if (entry.queue) return entry.queue;

  const queued = [];
  for (const e of state.enemies) {
    if (e.type !== "imp" || e.fleeing || e.dying || e.queueWallRef !== w) continue;
    if (e.aiState !== "stackQueue") continue;
    queued.push(e);
  }
  queued.sort((a, b) => (a.queueJoinOrder || 0) - (b.queueJoinOrder || 0));
  queued.forEach((imp, idx) => { imp.queueIndex = idx; });
  entry.queue = queued;
  return queued;
}

function sendImpToStackQueue(e, w) {
  const oldStackWall = e.stackWallRef;
  const oldQueueWall = e.queueWallRef;
  if (e.queueWallRef !== w) {
    e.queueWallRef = w;
    e.queueJoinOrder = impStackSequence++;
  }
  e.stackWallRef = null;
  e.impIndex = undefined;
  e.stackPos = undefined;
  e.impStackY = 0;
  setImpState(e, "stackQueue");
  invalidateImpWallCache(oldStackWall);
  invalidateImpWallCache(oldQueueWall);
  invalidateImpWallCache(w);
}

const IMP_MOB_ROW_WIDTH = 3;
const IMP_MOB_ROW_DEPTH = 22;
const IMP_MOB_LANE_SPREAD = 16;

function queueSlotForWall(w, idx, joinOrder) {
  const row = Math.floor(idx / IMP_MOB_ROW_WIDTH);
  const col = idx % IMP_MOB_ROW_WIDTH;
  const seed = (joinOrder || idx) * 5.17;
  const jitterX = Math.sin(seed) * 5;
  const jitterDepth = Math.sin(seed * 1.7) * 4;
  const laneOff = (col - (IMP_MOB_ROW_WIDTH - 1) / 2) * IMP_MOB_LANE_SPREAD + jitterX;
  const depth = IMP_ATTACH_RANGE + 14 + row * IMP_MOB_ROW_DEPTH + jitterDepth;
  const x = wallOutsideX(w) + w.side * depth + laneOff;
  return { x, fy: 0 };
}

function moveImpToQueueSlot(e, t, dt, wall, idx) {
  const slot = queueSlotForWall(wall, idx, e.queueJoinOrder);
  const T = performance.now() / 1000;
  const fidgetSeed = (e.queueJoinOrder || 0) * 3.91;
  const fidgetX = Math.sin(T * 1.4 + fidgetSeed) * 3.5;
  const fidgetTargetX = slot.x + fidgetX;

  const dx = fidgetTargetX - e.x;
  if (Math.abs(dx) > 2) {
    e.dir = Math.sign(dx);
    e.x += e.dir * Math.min(t.speed * 0.85 * dt, Math.abs(dx));
  } else {
    e.x = fidgetTargetX;
    e.dir = -wall.side;
  }
  const targetFy = 0;
  if ((e.fy || 0) < -1) {
    e.fy = (e.fy || 0) + Math.min(-(e.fy || 0), 180 * dt);
  } else {
    e.fy = targetFy;
  }
}

function assignImpToStack(e, w) {
  const oldStackWall = e.stackWallRef;
  const oldQueueWall = e.queueWallRef;
  if (e.stackWallRef !== w) {
    e.stackWallRef = w;
    e.stackJoinOrder = impStackSequence++;
  }
  setImpState(e, "stacking");
  invalidateImpWallCache(oldStackWall);
  invalidateImpWallCache(oldQueueWall);
  invalidateImpWallCache(w);
}

function nearestGroundDefenderForImp(e, range = 220) {
  if (e.wallTopWall) {
    const topDefender = nearestTopDefenderForWall(e.wallTopWall, e.x, e);
    if (topDefender) return topDefender;
  }
  let best = null, bd = range;
  let bestOther = null, bod = range;
  for (const u of state.units) {
    if (u.hp <= 0 || u.dying) continue;
    const d = dist(e.x, u.x);
    if (u.role === "guard") { if (d < bd) { bd = d; best = u; } }
    else if (!u.onWall) { if (d < bod) { bod = d; bestOther = u; } }
  }
  // Guards are the preferred duel target; stray workers get hunted when no guard is close.
  return best || bestOther;
}

function isTopDefenderForWall(u, w) {
  return (u.role === "guard" || u.role === "archer") &&
    u.hp > 0 &&
    !u.dying &&
    u.onWall &&
    u.wall === w;
}

function hasTopDefenderForWall(w) {
  for (const u of state.units) {
    if (isTopDefenderForWall(u, w)) return true;
  }
  return false;
}

function nearestTopDefenderForWall(w, x = w.x, seeker = null) {
  let best = null, bd = 1e9;
  for (const u of state.units) {
    if (!isTopDefenderForWall(u, w)) continue;
    if (seeker && u.combatTarget && u.combatTarget !== seeker) continue;
    const d = dist(u.x, x);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

function wallTopImpForWall(w, except = null) {
  return state.enemies.find(e =>
    e !== except &&
    e.type === "imp" &&
    e.hp > 0 &&
    !e.dying &&
    !e.fleeing &&
    e.wallTopWall === w &&
    (e.aiState === "combat" || e.aiState === "impAttack" || e.aiState === "vaulting")
  );
}

function clearImpDuel(e) {
  if (e.combatTarget && e.combatTarget.combatTarget === e) e.combatTarget.combatTarget = null;
  e.duelGuardX = null;
  e.duelImpX = null;
  e.duelWall = null;
}

function claimWallDuel(e, defender, wall) {
  const center = defender.guardDuelCenterX ?? defender.guardPostX ?? defender.archerPostX ?? defender.x;
  const defenderX = center - wall.side * (WALL_DUEL_GAP * 0.5);
  const impX = center + wall.side * (WALL_DUEL_GAP * 0.5);
  defender.guardDuelCenterX = center;
  defender.guardDuelX = defenderX;
  defender.combatTarget = e;
  e.combatTarget = defender;
  e.duelGuardX = defenderX;
  e.duelImpX = impX;
  e.duelWall = wall;
  return { guardX: defenderX, impX };
}

function startImpVault(e, w) {
  clearImpDuel(e);
  breakImpStack(e);
  e.wallTopWall = null;
  e.vaultWall = w;
  e.vaultT = 0;
  e.vaultStartX = e.x;
  e.vaultStartY = e.fy || -wallHeight(w);
  setImpState(e, "vaulting");
}

function killWall(w) {
  w.hp = 0; w.level = 0; w.commissioned = false; w.buildProgress = 0;
  spawnParticles(w.x, groundY - 30, 16, "#caa46a", 80, 80);
}

// Shared wall-chipping attack: crit roll, hit feedback and collapse check.
function damageWall(wall, baseDmg, particleCount = 3, attacker = null) {
  const attackerType = attacker ? ENEMY_TYPES[attacker.type] : null;
  if ((attacker?.blindedHits || 0) > 0) {
    attacker.blindedHits--;
    attacker.blind = Math.max(attacker.blind || 0, 0.7);
    attacker.attackAnim = Math.max(attacker.attackAnim || 0, 0.16);
    floaty(attacker.x, "Miss", "#d8b46a", 12);
    spawnParticles(attacker.x, groundY - 24 + (attacker.fy || 0), 7, "#d8b46a", 42, 45);
    return;
  }
  const freezeMult = (wall.frozenT || 0) > 0 && !attackerType?.wallFreezeOnHit ? 2 : 1;
  const crit = applyCrit(baseDmg * freezeMult, CFG.critChance, CFG.critMultiplier);
  wall.hp -= crit.damage;
  wall.flash = 0.15;
  spawnParticles(wall.x, groundY - 30, particleCount, "#caa46a", 30, 30);
  if (attackerType?.wallFreezeOnHit) {
    wall.frozenT = Math.max(wall.frozenT || 0, attackerType.wallFreezeOnHit);
    spawnParticles(wall.x, groundY - 34, 10, "#bfefff", 52, 56);
    floaty(wall.x, "Frozen", "#cfe6f2", 13);
  }
  if (attackerType?.coinShock && state.player?.coins > 0) {
    const lost = Math.min(state.player.coins, 1 + Math.floor((Game.day || 1) / 5));
    state.player.coins -= lost;
    floaty(state.player.x, "-" + lost + " coins", attackerType.eye || "#d7a8ff", 13);
  }
  if (crit.isCrit) critFloaty(wall.x, crit.damage);
  Audio.hit();
  if (wall.hp <= 0) killWall(wall);
  if (attackerType?.explodeOnWall && attacker && !attacker.dying) {
    spawnFirePool(attacker.x, 58, 3.8);
    spawnParticles(attacker.x, groundY - 18, 28, attackerType.eye || "#ff7a24", 120, 135);
    attacker.hp = 0;
    killEnemy(attacker);
  }
}

function clearBruteStructureAttack(e, recover = true) {
  e._bruteStructureTarget = null;
  e._bruteStructureKind = null;
  e._bruteStructureHit = false;
  if (recover) changeState(e, "recovery", 0.55);
}

function bruteStructureTargetAlive(target, kind) {
  if (!target) return false;
  if (kind === "wall") return target.commissioned && target.hp > 0;
  return target.hp > 0;
}

// Stateful structure strike for the Brute. Damage lands halfway through the
// horizontal smash instead of at animation start, and the whole strike plus
// recovery completes before another can begin. This prevents the old 0.7s
// restart loop that repeatedly snapped the wall animation back to frame zero.
function updateBruteStructureAttack(e, t, target, kind) {
  const duration = t.structureAttackDuration || 1.3;
  const cadence = Math.max(duration + 0.55, t.structureAttackCadence || 2.15);
  const active = e._bruteStructureTarget === target && e._bruteStructureKind === kind;

  if (active) {
    const remaining = Math.max(0, e.attackAnim || 0);
    const progress = clamp(1 - remaining / duration, 0, 1);
    if (!e._bruteStructureHit && progress >= 0.52) {
      const reach = kind === "wall" ? wallAttackRange(e, t, target) : baseAttackRange(e, t);
      // Small forgiveness keeps a moving/knocked target from dodging after the
      // fists have visibly entered its face, while still rejecting true misses.
      if (bruteStructureTargetAlive(target, kind) && dist(e.x, target.x) <= reach + 18) {
        if (kind === "wall") {
          damageWall(target, t.dmg, 6, e);
        } else {
          const crit = applyCrit(t.baseDmg ?? t.dmg, CFG.critChance, CFG.critMultiplier);
          target.hp = Math.max(0, target.hp - crit.damage);
          target.flash = 0.2;
          spawnParticles(target.x + rand(-30, 30), groundY - 42, 7, "#ff6a4a", 48, 42);
          if (crit.isCrit) critFloaty(target.x, crit.damage);
          else floaty(target.x, "-" + crit.damage, "#ff6a4a");
          Audio.hit();
        }
      }
      e._bruteStructureHit = true;
    }

    if (remaining <= 0) clearBruteStructureAttack(e);
    return true;
  }

  if (!bruteStructureTargetAlive(target, kind)) return false;
  if (e.aiState === "recovery") {
    if (e.stateTimer > 0) return true;
    changeState(e, "chasing", 0);
  }
  if (e.attackCd <= 0) {
    e._bruteStructureTarget = target;
    e._bruteStructureKind = kind;
    e._bruteStructureHit = false;
    e.attackCd = cadence;
    changeState(e, "attacking", 0);
    startEnemyAttack(e, duration, { kind: "bash", impact: 0.52 });
  }
  return true;
}

function shootEnemyFireball(e, t, target) {
  const launchY = groundY + (e.fy || -120) - 4;
  const targetY = target === state.player ? groundY - 50 - playerCombatLift() : groundY - 30 - entityWallLift(target);
  const dx = target.x - e.x;
  const dy = targetY - launchY;
  const flightT = Math.max(0.55, Math.min(1.25, Math.abs(dx) / 330));
  state.arrows.push({
    x: e.x,
    y: launchY,
    vx: dx / flightT,
    vy: (dy - 0.5 * 420 * flightT * flightT) / flightT,
    target,
    life: flightT + 0.35,
    hitKind: target === state.player ? "player" : "unit",
    enemyFireball: true,
    voidBolt: !!t.voidBolt,
    dmg: t.meleeDmg || 2,
    radius: 28,
  });
  e.shootCd = t.shootInterval || 2.8;
  startEnemyAttack(e, 0.38, { kind: t.voidBolt ? "voidCast" : "fireCast", impact: 0.18 });
  spawnParticles(e.x, launchY, 10, t.voidBolt ? "#8a5aff" : "#ff6a20", 42, 40);
  spawnParticles(e.x, launchY, 5, t.voidBolt ? "#b9e8ff" : "#ffd060", 26, 54);
  Audio.bow();
}

function fireImpTarget(e, range) {
  let best = null, bd = range;
  const player = state.player;
  if (player && player.hp > 0) {
    const d = dist(e.x, player.x);
    if (d < bd) { bd = d; best = player; }
  }
  for (const u of state.units) {
    if (u.hp <= 0 || u.dying) continue;
    const d = dist(e.x, u.x);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

function impAttackGuard(e, t, guard) {
  if (!guard || guard.hp <= 0 || guard.dying) return;
  if (e.attackCd > 0 || e.aiState === "recovery") return;
  e.attackCd = 0.75;
  e.attackAnim = 0.25;
  const crit = applyCrit(t.meleeDmg || 1, CFG.critChance, CFG.critMultiplier);
  guard.hp -= crit.damage;
  guard.panic = 0.25;
  guard.aiState = "combat";
  guard.combatTarget = e;
  guard.strike = Math.max(guard.strike || 0, 0.12);
  spawnParticles(guard.x, groundY - 30, 3, "#7a1f1f");
  if (crit.isCrit) critFloaty(guard.x, crit.damage);
  else floaty(guard.x, "-" + crit.damage, "#7a1f1f");
  Audio.hit();
}

function beginImpAttack(e, targetKind, target, kind) {
  if (e.attackCd > 0 || e.aiState === "recovery" || e.aiState === "impAttack") return false;
  if (!kind || (kind === "pounce" && impPounceBlockedByWall(e, target))) return false;
  e.impAttackKind = kind;
  e.impAttackTargetKind = targetKind;
  e.impAttackTarget = targetKind === "player" ? null : target;
  e.impAttackT = 0;
  e.impAttackHit = false;
  e.impPounceLaunched = false;
  e.impPounceLanded = false;
  e.impAttackStartX = e.x;
  e.impAttackStartY = e.fy || 0;
  e.impAttackLandX = kind === "pounce" && target ? e.x + Math.max(-96, Math.min(96, target.x - e.x)) : e.x;
  e.attackAnim = kind === "pounce" ? 0.55 : kind === "tail" ? 0.35 : 0.25;
  e.attackCd = kind === "pounce" ? 1.35 : kind === "tail" ? 1.0 : 0.78;
  setImpState(e, "impAttack");
  return true;
}

function impAttackTarget(e) {
  if (e.impAttackTargetKind === "player") return state.player;
  return e.impAttackTarget;
}

function hitImpAttackTarget(e, t, target, kind) {
  if (!target || e.impAttackHit) return;
  e.impAttackHit = true;
  e.attackAnim = Math.max(e.attackAnim || 0, 0.22);
  if (e.impAttackTargetKind === "player") {
    meleeHitPlayer(e, { ...t, meleeDmg: kind === "pounce" ? Math.max(1, (t.meleeDmg || 1) + 1) : (t.meleeDmg || 1) }, kind === "pounce" ? 260 : 190);
  } else if (target.hp > 0 && !target.dying) {
    const baseDmg = kind === "tail" ? 1 : kind === "pounce" ? 2 : (t.meleeDmg || 1);
    const crit = applyCrit(baseDmg, CFG.critChance, CFG.critMultiplier);
    target.hp -= crit.damage;
    target.panic = 0.35;
    target.knock = (target.knock || 0) + Math.sign(target.x - e.x) * (kind === "pounce" ? 120 : 55);
    spawnParticles(target.x, groundY - 30, kind === "pounce" ? 5 : 3, "#7a1f1f");
    if (crit.isCrit) critFloaty(target.x, crit.damage);
    else floaty(target.x, "-" + crit.damage, "#7a1f1f");
    Audio.hit();
  }
}

function chooseImpAttack(e, target, d) {
  const canPounce = !impPounceBlockedByWall(e, target);
  if (canPounce && d > 38 && d < 118 && Math.random() < 0.45) return "pounce";
  if (d > 20 && d < 52 && Math.random() < 0.34) return "tail";
  if (d < 34) return "claw";
  return canPounce ? "pounce" : null; // too far for a claw to connect — leap the gap instead
}

function updateImpAttack(e, t, dt) {
  const target = impAttackTarget(e);
  if (!target || target.hp <= 0 || target.dying) {
    e.fy = e.impAttackStartY || 0;
    e.impPounceP = null;
    e.impPounceLaunched = false;
    e.impPounceLanded = false;
    setImpState(e, e.breachedWall ? "vaulting" : "advance");
    return true;
  }

  const kind = e.impAttackKind || "claw";
  const total = kind === "pounce" ? 0.74 : kind === "tail" ? 0.42 : 0.34;
  e.impAttackT = Math.min(total, (e.impAttackT || 0) + dt);
  const p = e.impAttackT / total;
  e.dir = Math.sign(target.x - e.x) || e.dir;

  if (kind === "pounce") {
    const windup = 0.22;
    e.impPounceP = p;
    if (p < windup) {
      e.fy = e.impAttackStartY || 0;
    } else {
      const lp = Math.min(1, (p - windup) / (1 - windup));
      // airborne through 85% of the leap, the rest is a landing crouch on the ground
      const air = Math.min(1, lp / 0.85);
      e.x = mix(e.impAttackStartX || e.x, e.impAttackLandX || e.x, air);
      e.fy = (e.impAttackStartY || 0) - Math.sin(air * Math.PI) * 54;
      if (!e.impPounceLaunched) {
        e.impPounceLaunched = true;
        spawnParticles(e.impAttackStartX || e.x, groundY - 4, 5, "#6b5a45", 40, 45);
      }
      if (air >= 1 && !e.impPounceLanded) {
        e.impPounceLanded = true;
        spawnParticles(e.x, groundY - 3, 7, "#6b5a45", 55, 55);
        Audio.hit?.();
      }
      if (lp > 0.55 && dist(e.x, target.x) < 40) hitImpAttackTarget(e, t, target, kind);
    }
  } else {
    if (dist(e.x, target.x) > (kind === "tail" ? 44 : 26) && p < 0.45) {
      e.x += e.dir * t.speed * 0.45 * dt;
    }
    const hitAt = kind === "tail" ? 0.52 : 0.48;
    const range = kind === "tail" ? 48 : 34;
    if (p >= hitAt && dist(e.x, target.x) < range) hitImpAttackTarget(e, t, target, kind);
  }

  if (e.impAttackT >= total) {
    e.fy = e.wallTopWall ? -wallHeight(e.wallTopWall) : 0;
    e.impPounceP = null;
    e.impPounceLaunched = false;
    e.impPounceLanded = false;
    e.impAttackKind = null;
    e.impAttackTarget = null;
    e.impAttackTargetKind = null;
    e.impAttackLandX = null;
    setImpState(e, e.wallTopWall ? "combat" : e.breachedWall ? "vaulting" : "advance");
  }
  return true;
}

function updateImpPlayerCombat(e, t, dt) {
  const player = state.player;
  if (!player || player.hp <= 0 || e.wallTopWall || e.aiState === "climbOver" || e.aiState === "stacking" || e.aiState === "stackQueue" || e.aiState === "climbChain") return false;
  if (playerCombatLift() > 20) return false;
  const d = dist(e.x, player.x);
  const near = d < 130 && e.carry === 0;
  if (!near && e.aiState !== "attackPlayer") return false;
  if (d > 240 || e.breachedWall) {
    if (e.aiState === "attackPlayer") setImpState(e, "advance");
    return false;
  }
  if (impPlayerBlockedByWall(e, player)) {
    if (e.aiState === "attackPlayer") setImpState(e, "advance");
    return false;
  }

  breakImpStack(e);
  setImpState(e, "attackPlayer");
  e.dir = Math.sign(player.x - e.x) || e.dir;
  if (d < 112 && e.attackCd <= 0 && playerCombatLift() <= 4) {
    const attackKind = chooseImpAttack(e, player, d);
    if (beginImpAttack(e, "player", player, attackKind)) return true;
  }
  if (d > 27) {
    // Sprint burst: the closer it gets, the harder it pushes — punishes kiting
    const sprint = 1.6 + 1.6 * Math.max(0, 1 - d / 240);
    e.x += e.dir * t.speed * sprint * dt;
    e.anim += dt * 4;
    if (Math.random() < 0.3) spawnParticles(e.x - e.dir * 8, groundY - 4, 1, "#6b5a45", 20, 26);
    return true;
  }
  return true;
}

function updateImpCombat(e, t, dt) {
  let defender = e.combatTarget;
  if (e.wallTopWall && (!defender || defender.hp <= 0 || !state.units.includes(defender) || !defender.onWall || defender.wall !== e.wallTopWall || (defender.combatTarget && defender.combatTarget !== e))) {
    clearImpDuel(e);
    defender = nearestTopDefenderForWall(e.wallTopWall, e.x, e);
    e.combatTarget = defender;
  }
  if (e.wallTopWall && !defender) {
    if (!hasTopDefenderForWall(e.wallTopWall)) startImpVault(e, e.wallTopWall);
    else {
      e.fy = -wallHeight(e.wallTopWall);
      const waitX = e.wallTopWall.x + e.wallTopWall.side * 20;
      e.dir = -e.wallTopWall.side;
      if (dist(e.x, waitX) > 3) e.x += Math.sign(waitX - e.x) * Math.min(t.speed * 0.35 * dt, dist(e.x, waitX));
    }
    return true;
  }
  if (!defender || defender.hp <= 0 || !state.units.includes(defender)) {
    defender = nearestGroundDefenderForImp(e, e.breachedWall ? 260 : 140);
    e.combatTarget = defender;
  }
  if (!defender) {
    setImpState(e, e.breachedWall ? "vaulting" : "advance");
    return false;
  }
  // Can't chase defenders blocked by walls (unless imp has breached)
  if (impDefenderBlockedByWall(e, defender)) {
    e.combatTarget = null;
    setImpState(e, e.breachedWall ? "vaulting" : "advance");
    return false;
  }
  // Give up on workers that outrun the chase and get back to the assault.
  if (defender.role !== "guard" && defender.role !== "archer" && dist(e.x, defender.x) > 260) {
    e.combatTarget = null;
    setImpState(e, e.breachedWall ? "vaulting" : "advance");
    return false;
  }

  let targetX = defender.x;
  if (e.wallTopWall) {
    e.fy = -wallHeight(e.wallTopWall);
    const duel = claimWallDuel(e, defender, e.wallTopWall);
    targetX = duel.impX;
    defender.x += Math.sign(duel.guardX - defender.x) * Math.min(42 * dt, Math.abs(duel.guardX - defender.x));
    defender.dir = Math.sign(e.x - defender.x) || defender.dir;
  }
  e.dir = Math.sign((e.wallTopWall ? (e.duelGuardX ?? defender.x) : defender.x) - e.x) || e.dir;
  const d = dist(e.x, e.wallTopWall ? (e.duelGuardX ?? defender.x) : defender.x);
  if (d < 112 && e.attackCd <= 0) {
    const attackKind = chooseImpAttack(e, defender, d);
    if (beginImpAttack(e, "guard", defender, attackKind)) return true;
  }
  if (e.wallTopWall && dist(e.x, targetX) > 2) {
    e.x += Math.sign(targetX - e.x) * Math.min(t.speed * 0.55 * dt, dist(e.x, targetX));
    return true;
  }
  if (!e.wallTopWall && d > 22) {
    // Sprint at prey on the ground; kick up dust so it reads as a burst
    e.x += e.dir * t.speed * 2.6 * dt;
    e.anim += dt * 4;
    if (Math.random() < 0.3) spawnParticles(e.x - e.dir * 8, groundY - 4, 1, "#6b5a45", 20, 26);
    return true;
  }

  setImpState(e, "combat");
  if (defender.role === "guard" || defender.role === "archer") {
    defender.aiState = "combat";
    defender.combatTarget = e;
  } else {
    defender.panic = Math.max(defender.panic || 0, 0.6);
  }
  return true;
}

// Imp hurled over a wall by an ember brute: ballistic arc, lands inside as breached
function updateThrownImp(e, t, dt) {
  e.thrownT = Math.min(1, (e.thrownT || 0) + dt * 1.05);
  e.x = mix(e.thrownStartX, e.thrownEndX, e.thrownT);
  e.fy = mix(e.thrownStartY || 0, 0, e.thrownT) - Math.sin(e.thrownT * Math.PI) * (e.thrownPeak || 90);
  e.dir = Math.sign(e.thrownEndX - e.thrownStartX) || e.dir;
  if (Math.random() < 0.3) spawnParticles(e.x, groundY + e.fy, 1, "#6b5a45", 14, 20);
  if (e.thrownT >= 1) {
    e.fy = 0;
    markImpBreachedWall(e, e.thrownWall);
    e.thrownWall = null;
    spawnParticles(e.x, groundY - 6, 6, "#6b5a45", 40, 30);
    changeState(e, "recovery", 0.4);
  }
  return true;
}

const BRUTE_THROW_WALL_RANGE = 240;
const BRUTE_THROW_IMP_RANGE = 130;

function findThrowableImp(brute) {
  let best = null, bd = BRUTE_THROW_IMP_RANGE;
  for (const o of state.enemies) {
    if (o.type !== "imp" || o.fleeing || o.dying || o.ridingDragon) continue;
    if (o.stackWallRef || o.wallTopWall || o.leftStack || o.breachedWall) continue;
    if (o.aiState === "stacking" || o.aiState === "climbOver" || o.aiState === "stackQueue" || o.aiState === "thrown" || o.aiState === "vaulting") continue;
    const d = dist(brute.x, o.x);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

// Special attack: near the base, the brute grabs a loose imp and hurls it over
// the nearest wall so it lands on the inside.
function updateBruteThrow(e, t, dt) {
  if (e.throwCd === undefined) e.throwCd = rand(2, 4);
  e.throwCd -= dt;
  if (e.throwCd > 0 || e.charging || e.fleeing || e.aiState === "recovery") return;
  const side = e.x < CFG.baseX ? -1 : 1;
  const wall = wallAt(side, e.x);
  if (!wall || dist(e.x, wall.x) > BRUTE_THROW_WALL_RANGE) return;
  const imp = findThrowableImp(e);
  if (!imp) return;
  e.throwCd = rand(5, 9);
  e.attackAnim = 0.3 * swingMult(e);
  e.throwAnim = 0.55; // render-only: drives the distinct grab→wind-up→hurl pose
  e.throwDir = Math.sign(wall.x - e.x) || e.dir;
  breakImpStack(imp);
  imp.thrownT = 0;
  imp.thrownStartX = imp.x;
  imp.thrownStartY = imp.fy || 0;
  imp.thrownEndX = wallInsideX(wall) - wall.side * rand(0, 40);
  imp.thrownPeak = wallHeight(wall) + rand(40, 70);
  imp.thrownWall = wall;
  imp.knock = 0;
  changeState(imp, "thrown", 0);
  spawnParticles(e.x, groundY - 40, 8, "#ff6a20", 60, 50);
  floaty(e.x, "THROW!", "#ff6a20");
  Audio.hit();
}

function ashTargetY(target) {
  if (target === state.player) return groundY - 50 - playerCombatLift();
  return groundY - 30 - entityWallLift(target);
}

function ashPriestTarget(e, range) {
  let best = null, bd = range;
  const player = state.player;
  if (player && player.hp > 0) {
    const d = dist(e.x, player.x);
    if (d < bd) { bd = d; best = player; }
  }
  for (const u of state.units) {
    if (u.hp <= 0 || u.dying) continue;
    const d = dist(e.x, u.x);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

function ashPriestSiegeTarget(e, range) {
  const side = e.x < CFG.baseX ? -1 : 1;
  const wall = wallAt(side, e.x);
  if (wall && dist(e.x, wall.x) < range) return { kind: "wall", obj: wall, x: wall.x };
  if (state.base && dist(e.x, state.base.x) < range) return { kind: "base", obj: state.base, x: state.base.x };
  return null;
}

function shootAshLance(e, t, target) {
  const launchY = groundY - t.w * 1.15;
  const targetY = ashTargetY(target);
  const dx = target.x - e.x;
  const dy = targetY - launchY;
  const flightT = Math.max(0.55, Math.min(1.25, Math.abs(dx) / 390));
  state.arrows.push({
    x: e.x + e.dir * 10,
    y: launchY,
    vx: dx / flightT,
    vy: (dy - 0.5 * 420 * flightT * flightT) / flightT,
    target,
    life: flightT + 0.35,
    hitKind: target === state.player ? "player" : "unit",
    enemyFireball: true,
    ashLance: true,
    ashFireball: true,
    big: true,
    scale: t.ashFireballScale || 2.35,
    dmg: t.ashFireballDmg || t.meleeDmg || 2,
    radius: t.ashFireballRadius || 54,
    splashRadius: t.ashFireballSplash || 96,
  });
  e.shootCd = (t.shootInterval || 3.4) + rand(-0.35, 0.55);
  e.ashCastFlash = 0.34;
  e.attackKind = "lance";
  e.attackAnim = 0.34;
  spawnParticles(e.x + e.dir * 10, launchY, 8, "#ff7a24", 34, 44);
  spawnParticles(e.x + e.dir * 6, launchY + 4, 4, "#3a2220", 30, 26);
  Audio.fireball();
}

function beginAshScorch(e, t, target) {
  e.ashRitualTarget = target;
  e.ashChannelT = 0.72;
  e.ashChannelMax = 0.72;
  e.ashScorchCd = (t.scorchInterval || 4.8) + rand(-0.45, 0.75);
  e.attackKind = "scorch";
  e.attackAnim = 0.7;
  e.aggroPlayer = false;
  e.aggroUnit = null;
}

function finishAshScorch(e, t) {
  const target = e.ashRitualTarget;
  e.ashRitualTarget = null;
  if (!target) return;
  if (target.kind === "wall") {
    const wall = target.obj;
    if (!wall || !wall.commissioned || wall.hp <= 0) return;
    damageWall(wall, Math.max(2, t.dmg * 0.72), 9, e);
    spawnFirePool(wall.x - wall.side * 18, 46, 3.8);
    floaty(wall.x, "Scorched", "#ff7a24", 14);
  } else if (target.kind === "base") {
    const base = target.obj;
    if (!base || base.hp <= 0) return;
    const crit = applyCrit(t.baseDmg ?? 3, CFG.critChance, CFG.critMultiplier);
    base.hp -= crit.damage;
    base.flash = 0.24;
    if (base.hp < 0) base.hp = 0;
    spawnFirePool(base.x + rand(-56, 56), 52, 4.1);
    spawnParticles(base.x + rand(-28, 28), groundY - 32, 12, "#ff6a20", 80, 95);
    if (crit.isCrit) critFloaty(base.x, crit.damage);
    else floaty(base.x, "-" + crit.damage, "#ff6a4a");
    Audio.hit();
  }
}

function kindleAshAlly(e, t) {
  let best = null, bd = t.wardRange || 285;
  for (const other of state.enemies) {
    if (other === e || other.dying || other.fleeing || other.hp <= 0) continue;
    const ot = ENEMY_TYPES[other.type];
    if (!ot || ot.boss) continue;
    if ((other.emberWard || 0) > 1.2 && other.hp >= other.maxHp) continue;
    const d = dist(e.x, other.x);
    if (d < bd) { bd = d; best = other; }
  }
  if (!best) return false;
  best.hp = Math.min(best.maxHp + 5, best.hp + 5);
  best.emberWard = 5.2;
  best.emberFrenzy = 5.2;
  best.flash = Math.max(best.flash || 0, 0.08);
  e.ashWardCd = (t.wardInterval || 7.2) + rand(-0.7, 0.9);
  e.ashWardFlash = 0.45;
  e.attackKind = "ward";
  e.attackAnim = 0.4;
  e.dir = Math.sign(best.x - e.x) || e.dir;
  spawnParticles(e.x, groundY - 42, 10, "#ffc060", 48, 70);
  spawnParticles(best.x, groundY - 30 + (best.fy || 0), 12, "#ff8a30", 56, 80);
  floaty(best.x, "+Kindled", "#ffc060", 14);
  Audio.upgrade();
  return true;
}

function ashPriestBurst(e, t) {
  const radius = t.burstRadius || 112;
  e.ashBurstCd = (t.burstInterval || 5.8) + rand(-0.55, 0.75);
  e.ashBurstFlash = 0.48;
  e.attackKind = "burst";
  e.attackAnim = 0.42;
  let hit = false;
  const player = state.player;
  if (player && player.hp > 0 && dist(e.x, player.x) < radius && playerCombatLift() <= 24) {
    if (damagePlayer(1, { knock: Math.sign(player.x - e.x || 1) * 230 }) !== null) hit = true;
  }
  for (const u of state.units) {
    if (u.hp <= 0 || u.dying || u.onWall) continue;
    if (dist(e.x, u.x) < radius) {
      const crit = applyCrit(1, CFG.critChance, CFG.critMultiplier);
      u.hp -= crit.damage;
      u.panic = 1;
      u.knock = (u.knock || 0) + Math.sign(u.x - e.x || 1) * 150;
      spawnParticles(u.x, groundY - 30, 4, "#6e3428", 44, 55);
      if (crit.isCrit) critFloaty(u.x, crit.damage);
      else floaty(u.x, "-" + crit.damage, "#9a4a34");
      hit = true;
    }
  }
  spawnParticles(e.x, groundY - 18, 26, "#3a2a26", 150, 92);
  spawnParticles(e.x, groundY - 22, 14, "#ff7a24", 95, 110);
  if (hit) Game.screenShake = Math.max(Game.screenShake || 0, 0.24);
  Audio.hit();
}

function moveAshPriestTowardSiege(e, t, dt) {
  const target = ashPriestSiegeTarget(e, 9999);
  if (!target) {
    e.dir = Math.sign(state.base.x - e.x) || e.dir;
    e.x += e.dir * t.speed * debuffSpeedMult(e) * unopposedSprintMult(e) * approachSpeedMult(Math.abs(state.base.x - e.x)) * dt;
    return;
  }
  const side = e.x < CFG.baseX ? -1 : 1;
  const standOff = Math.max(120, Math.min(205, (t.scorchRange || 265) - 52));
  const desiredX = target.x + side * standOff;
  const dx = desiredX - e.x;
  e.dir = Math.sign(target.x - e.x) || e.dir;
  if (Math.abs(dx) > 12) {
    e.x += Math.sign(dx) * t.speed * debuffSpeedMult(e) * unopposedSprintMult(e) * dt;
  } else if (Math.random() < dt * 7) {
    spawnParticles(e.x + rand(-10, 10), groundY - 8, 1, "#3a2a26", 12, 18);
  }
}

function updateAshPriest(e, t, dt) {
  if (!e.ashReady) {
    e.ashReady = true;
    e.shootCd = e.shootCd || rand(0.8, t.shootInterval || 3.4);
    e.ashScorchCd = rand(1.2, 3.2);
    e.ashWardCd = rand(1.5, 4.2);
    e.ashBurstCd = rand(2.0, 4.4);
    e.ashChannelT = 0;
    e.ashChannelMax = 0.72;
  }

  e.shootCd -= dt;
  e.ashScorchCd -= dt;
  e.ashWardCd -= dt;
  e.ashBurstCd -= dt;
  if (e.ashCastFlash > 0) e.ashCastFlash -= dt;
  if (e.ashWardFlash > 0) e.ashWardFlash -= dt;
  if (e.ashBurstFlash > 0) e.ashBurstFlash -= dt;

  if (e.ashChannelT > 0) {
    e.ashChannelT -= dt;
    const target = e.ashRitualTarget;
    if (target) e.dir = Math.sign(target.x - e.x) || e.dir;
    const p = 1 - Math.max(0, e.ashChannelT) / (e.ashChannelMax || 0.72);
    if (Math.random() < 0.9) {
      const tx = target?.x ?? e.x;
      spawnParticles(e.x + rand(-8, 8), groundY - 44 - p * 18, 1, "#ff7a24", 22, 50);
      spawnParticles(tx + rand(-24, 24), groundY - 8, 1, "#3a2a26", 26, 28);
    }
    if (e.ashChannelT <= 0) {
      finishAshScorch(e, t);
      e.ashChannelT = 0;
      e.attackKind = "";
    }
    return true;
  }

  const closeThreat = ashPriestTarget(e, t.burstRadius || 112);
  if (closeThreat && e.ashBurstCd <= 0) {
    e.dir = Math.sign(closeThreat.x - e.x) || e.dir;
    ashPriestBurst(e, t);
    return true;
  }

  if (e.ashWardCd <= 0 && kindleAshAlly(e, t)) return true;

  const siege = ashPriestSiegeTarget(e, t.scorchRange || 265);
  if (siege && e.ashScorchCd <= 0) {
    beginAshScorch(e, t, siege);
    return true;
  }

  const target = ashPriestTarget(e, t.shootRange || 520);
  if (target) {
    const d = dist(e.x, target.x);
    e.dir = Math.sign(target.x - e.x) || e.dir;
    if (d < 170) {
      e.x -= e.dir * t.speed * 0.8 * debuffSpeedMult(e) * dt;
    } else if (d > 365) {
      e.x += e.dir * t.speed * 0.75 * debuffSpeedMult(e) * dt;
    }
    if (e.shootCd <= 0 && d < (t.shootRange || 520)) shootAshLance(e, t, target);
    if (Math.random() < dt * 8) spawnParticles(e.x - e.dir * 8 + rand(-5, 5), groundY - 6, 1, "#3a2a26", 12, 18);
    return true;
  }

  moveAshPriestTowardSiege(e, t, dt);
  return true;
}

function updateImp(e, t, dt) {
  if (e.aiState === "thrown") return updateThrownImp(e, t, dt);
  if (e.knock && (e.aiState === "stacking" || e.aiState === "climbOver" || e.aiState === "climbChain")) {
    const wasChain = e.aiState === "climbChain";
    breakImpStack(e);
    if (wasChain) {
      e.chainClimbWall = null;
      if ((e.fy || 0) < -2) { e.leftStack = true; e.hasLeftStack = false; e.vy = 0; }
    }
    setImpState(e, "recovery");
  }

  if (e.aiState === "recovery") {
    e.impStackY = 0;
    if (e.stateTimer <= 0) setImpState(e, e.breachedWall ? "vaulting" : "advance");
    return true;
  }

  if (e.aiState === "impAttack") return updateImpAttack(e, t, dt);
  if (e.aiState === "combat") return updateImpCombat(e, t, dt);
  if (e.aiState === "climbChain") return updateImpChainClimb(e, t, dt);

  if (updateImpPlayerCombat(e, t, dt)) return true;

  // Any unit caught in the open gets hunted down (guards duel, workers get chased).
  if ((e.aiState === "advance" || !e.aiState) && e.carry === 0) {
    let b = null, bd = 150;
    for (const u of state.units) {
      if (u.hp <= 0 || u.dying || u.onWall) continue;
      if (impDefenderBlockedByWall(e, u)) continue;
      const d = dist(e.x, u.x);
      if (d < bd) { bd = d; b = u; }
    }
    if (b) {
      e.combatTarget = b;
      return updateImpCombat(e, t, dt);
    }
  }

  if (e.aiState === "vaulting") {
    const w = e.vaultWall;
    if (w && hasTopDefenderForWall(w)) {
      e.wallTopWall = w;
      e.vaultWall = null;
      e.combatTarget = nearestTopDefenderForWall(w, e.x, e);
      setImpState(e, "combat");
      return updateImpCombat(e, t, dt);
    }
    if (w) markImpBreachedWall(e, w);
    if (w) {
      e.vaultT = Math.min(1, (e.vaultT || 0) + dt * 0.95);
      const endX = wallInsideX(w);
      const topY = -wallHeight(w);
      e.x = mix(e.vaultStartX ?? w.x, endX, e.vaultT);
      e.fy = mix(e.vaultStartY ?? topY, 0, e.vaultT) - Math.sin(e.vaultT * Math.PI) * 12;
      if (e.vaultT < 1) return true;
      e.vaultWall = null;
      e.fy = 0;
      e.wallDropLand = 0.18;
      spawnParticles(e.x, groundY - 4, 5, "#6b5a45", 32, 24);
    } else {
      e.fy = Math.min(0, (e.fy || 0) + 120 * dt);
    }
    // Landed inside — if another wall still stands between here and the base,
    // this breach only applies to the wall just crossed, not the next one.
    if ((e.fy || 0) >= 0) {
      const nextWall = wallAt(e.x < CFG.baseX ? -1 : 1, e.x);
      if (nextWall && !impWallBreachBypassesWall(e, nextWall)) {
        setImpState(e, "advance");
        return false;
      }
    }
    const defender = nearestGroundDefenderForImp(e, 260);
    if (defender) {
      e.combatTarget = defender;
      return updateImpCombat(e, t, dt);
    }
    if (dist(e.x, state.base.x) < 70) {
      e.dir = Math.sign(state.base.x - e.x) || e.dir;
      if (e.attackCd <= 0) {
        e.attackCd = 0.9;
        e.attackAnim = 0.22 * swingMult(e);
        const crit = applyCrit(t.baseDmg ?? t.dmg, CFG.critChance, CFG.critMultiplier);
        state.base.hp -= crit.damage; state.base.flash = 0.2;
        spawnParticles(state.base.x + rand(-30, 30), groundY - 30, 4, "#ff6a4a");
        if (crit.isCrit) critFloaty(state.base.x, crit.damage);
        else floaty(state.base.x, "-" + crit.damage, "#ff6a4a");
        Audio.hit();
      }
      return true;
    }
    e.dir = Math.sign(state.base.x - e.x) || e.dir;
    e.x += e.dir * t.speed * dt;
    return true;
  }

  const side = e.x < CFG.baseX ? -1 : 1;
  const wall = wallAt(side, e.x);
  const wallBypassed = impWallBreachBypassesWall(e, wall);
  if (!wall || wallBypassed) {
    breakImpStack(e);
    setImpState(e, "advance");
    return false;
  }

  // A chain imp's grappling line is a fast climbing route: once close enough,
  // commit to the chain instead of building a slow stack.
  if (chainForWall(wall) && Math.abs(e.x - wallOutsideX(wall)) < 260) {
    breakImpStack(e);
    e.chainClimbWall = wall;
    e.climbChainT = 0;
    e.climbChainSlot = rand(-3, 3);   // hug the hanging chain line
    setImpState(e, "climbChain");
    return updateImpChainClimb(e, t, dt);
  }

  const attachX = wallOutsideX(wall);
  const activeStack = impStackForWall(wall);
  const cap = impStackCapacity(wall);
  const activeQueue = impQueueForWall(wall);
  if (e.aiState === "stackQueue") {
    const stackHasRoom = activeStack.length < cap;
    const isFront = activeQueue[0] === e;
    if (!stackHasRoom || !isFront) {
      const queueIdx = Math.max(0, e.queueIndex || activeQueue.indexOf(e));
      moveImpToQueueSlot(e, t, dt, wall, queueIdx);
      return true;
    }
    const oldQueueWall = e.queueWallRef;
    e.queueWallRef = null;
    e.queueIndex = undefined;
    invalidateImpWallCache(oldQueueWall);
  }
  const incomingStack = activeStack.some(other => other !== e);
  const reachedWall = Math.abs(e.x - attachX) <= IMP_ATTACH_RANGE || Math.abs(e.x - wall.x) <= 24;

  if (!reachedWall && !incomingStack) {
    breakImpStack(e);
    setImpState(e, "advance");
    e.dir = Math.sign(attachX - e.x) || e.dir;
    e.x += e.dir * t.speed * unopposedSprintMult(e) * dt;
    return true;
  }

  if (!reachedWall && incomingStack) {
    setImpState(e, "advance");
    e.dir = Math.sign(attachX - e.x) || e.dir;
    e.x += e.dir * t.speed * 1.05 * unopposedSprintMult(e) * dt;
    return true;
  }

  if (activeStack.length >= cap && e.stackWallRef !== wall) {
    sendImpToStackQueue(e, wall);
    const queue = impQueueForWall(wall);
    moveImpToQueueSlot(e, t, dt, wall, e.queueIndex ?? Math.max(0, queue.indexOf(e)));
    return true;
  }

  assignImpToStack(e, wall);
  const stack = impStackForWall(wall);
  const top = stack[stack.length - 1];
  const threshold = Math.max(1, wallHeight(wall) - IMP_TOP_TRIGGER_PAD);
  const isTop = top === e;
  const stackTallEnough = ((e.impIndex || 0) + 1) * IMP_STACK_STEP >= threshold;

  const stackX = attachX + (e.impStackX || 0);
  const attachDx = stackX - e.x;
  if (Math.abs(attachDx) > 1) e.x += Math.sign(attachDx) * Math.min(Math.abs(attachDx), t.speed * 1.25 * dt);
  else e.x = stackX;
  e.vx = 0;
  const targetFy = e.impStackY || 0;
  const fyDiff = targetFy - (e.fy || 0);
  if (Math.abs(fyDiff) > 1) {
    const rate = fyDiff > 0 ? 180 : 65;
    e.fy = (e.fy || 0) + Math.sign(fyDiff) * Math.min(Math.abs(fyDiff), rate * dt);
  } else {
    e.fy = targetFy;
  }
  e.dir = -wall.side;

  const wallHasTopImp = !!wallTopImpForWall(wall, e);
  if (isTop && stackTallEnough && !wallHasTopImp) setImpState(e, "climbOver");

  if (e.aiState === "climbOver") {
    if (e.climbStartX === undefined) {
      e.climbStartX = e.x;
      e.climbStartY = e.fy || 0;
    }
    e.climbT = Math.min(1, (e.climbT || 0) + dt * 0.8);
    const ct = e.climbT;
    const eased = ct < 0.5 ? 2 * ct * ct : 1 - (-2 * ct + 2) ** 2 / 2;
    e.fy = mix(e.climbStartY || 0, -wallHeight(wall), eased) - Math.sin(eased * Math.PI) * 14;
    e.x = mix(e.climbStartX, wall.x, eased);
    if (e.climbT >= 1) {
      breakImpStack(e);
      e.wallTopWall = wall;
      e.x = wall.x;
      e.fy = -wallHeight(wall);
      const defender = nearestTopDefenderForWall(wall, e.x, e);
      if (defender) {
        e.combatTarget = defender;
        setImpState(e, "combat");
        return updateImpCombat(e, t, dt);
      }
      if (hasTopDefenderForWall(wall)) {
        setImpState(e, "combat");
        return updateImpCombat(e, t, dt);
      }
      startImpVault(e, wall);
    }
    return true;
  }

  e.climbT = 0;
  e.climbStartX = undefined;
  e.climbStartY = undefined;
  if (e.attackCd <= 0) {
    e.attackCd = 1.15;
    e.attackAnim = 0.18;
    damageWall(wall, Math.max(1, t.dmg * 0.12), 2, e);
  }
  return true;
}

// ── Chain Imp ─────────────────────────────────────────────────────────────────
// A lean support imp that hangs back and hooks a grappling chain onto a wall.
// While the chain is live, the rest of the imp horde climbs it to vault the wall
// far faster than stacking. The chain lives on the chain imp entity — kill it
// (or knock a climber loose) and any imps mid-climb drop back outside.
const CHAIN_STANDOFF = 92;          // how far out from the wall the chain imp braces
const IMP_CHAIN_CLIMB_RATE = 1.5;   // full climb in ~0.67s — much faster than a stack

// The live chain (if any) a given wall currently has hooked to it.
function chainForWall(w) {
  if (!w) return null;
  for (const e of state.enemies) {
    if (e.type !== "chainImp" || e.dying || e.fleeing) continue;
    if (e.chainWall === w && e.aiState === "holding") return e;
  }
  return null;
}

// Nearest standing wall on the imp's side that isn't already chained by someone else.
function chainImpTargetWall(e) {
  const side = e.x < CFG.baseX ? -1 : 1;
  let best = null, bd = 1e9;
  for (const w of state.walls) {
    if (!wallReady(w) || w.side !== side) continue;
    const holder = chainForWall(w);
    if (holder && holder !== e) continue;
    const d = Math.abs(e.x - w.x);
    if (d < bd) { bd = d; best = w; }
  }
  return best;
}

// An imp scrambling up a chain: scoot to the anchor, race up the line, then
// vault over the top exactly like a stack-topping imp would.
function updateImpChainClimb(e, t, dt) {
  const w = e.chainClimbWall;
  if (!w || !wallReady(w) || !chainForWall(w)) {
    // chain cut or its imp is dead — drop back down outside the wall
    e.chainClimbWall = null;
    e.climbChainT = 0;
    if ((e.fy || 0) < -2) { e.leftStack = true; e.hasLeftStack = false; e.vy = 0; }
    setImpState(e, e.breachedWall ? "vaulting" : "advance");
    return true;
  }
  const anchorX = wallOutsideX(w) + (e.climbChainSlot || 0);
  if ((e.climbChainT || 0) <= 0 && Math.abs(e.x - anchorX) > 2) {
    e.dir = Math.sign(anchorX - e.x) || e.dir;
    e.x += Math.sign(anchorX - e.x) * Math.min(Math.abs(anchorX - e.x), t.speed * 1.5 * dt);
    e.fy = 0;
    return true;
  }
  e.x = anchorX;
  e.dir = -w.side;
  e.climbChainT = Math.min(1, (e.climbChainT || 0) + dt * IMP_CHAIN_CLIMB_RATE);
  const ct = e.climbChainT;
  const eased = ct * ct * (3 - 2 * ct);
  e.fy = mix(0, -wallHeight(w), eased);
  if (Math.random() < 0.25) spawnParticles(e.x, groundY + (e.fy || 0), 1, "#6b5a45", 10, 16);
  if (ct >= 1) {
    breakImpStack(e);
    e.chainClimbWall = null;
    e.climbChainT = 0;
    e.wallTopWall = null;
    e.x = w.x;
    e.fy = -wallHeight(w);
    const defender = nearestTopDefenderForWall(w, e.x, e);
    if (defender) { e.combatTarget = defender; setImpState(e, "combat"); return updateImpCombat(e, t, dt); }
    if (hasTopDefenderForWall(w)) { setImpState(e, "combat"); return updateImpCombat(e, t, dt); }
    startImpVault(e, w);
  }
  return true;
}

function updateChainImp(e, t, dt) {
  const { base } = state;

  // Holding a live chain: crouch at the standoff point and keep it taut.
  if (e.aiState === "holding") {
    const w = e.chainWall;
    if (!w || !wallReady(w)) { e.chainWall = null; e.chainAttached = false; setImpState(e, "advance"); }
    else {
      const standX = wallOutsideX(w) + w.side * CHAIN_STANDOFF;
      if (Math.abs(e.x - standX) > 3) {
        e.dir = Math.sign(standX - e.x) || e.dir;
        e.x += Math.sign(standX - e.x) * Math.min(Math.abs(standX - e.x), t.speed * 0.7 * dt);
      } else e.dir = -w.side;
      if (Math.random() < dt * 3) spawnParticles(e.x, groundY - 8, 1, "#6b5a45", 10, 14);
      return true;
    }
  }

  // Winding up the throw: plant feet, spin the hook, then bite it into the wall.
  if (e.aiState === "hooking") {
    const w = e.chainWall;
    const rival = chainForWall(w);
    if (!w || !wallReady(w) || (rival && rival !== e)) { e.chainWall = null; setImpState(e, "advance"); return true; }
    e.dir = -w.side;
    e.hookT = (e.hookT || 0) + dt;
    e.attackAnim = Math.max(e.attackAnim || 0, 0.2);
    if (Math.random() < 0.6) spawnParticles(e.x + e.dir * 6, groundY - 30, 1, "#8a6a3a", 22, 30);
    if (e.hookT >= (t.hookWindup || 0.95)) {
      e.chainAttached = true;
      setImpState(e, "holding");
      const hy = groundY - wallHeight(w);
      spawnParticles(wallOutsideX(w), hy, 12, "#caa46a", 60, 55);
      spawnParticles(wallOutsideX(w), hy, 5, "#ffd48a", 40, 40);
      floaty(e.x, "Hooked!", "#caa46a", 13);
      Audio.hit();
    }
    return true;
  }

  // Seek a wall to exploit; if there's none, loiter behind the horde.
  const wall = chainImpTargetWall(e);
  if (!wall) {
    e.dir = Math.sign(base.x - e.x) || e.dir;
    e.x += e.dir * t.speed * 0.5 * debuffSpeedMult(e) * dt;
    return true;
  }
  e.chainWall = wall;
  const standX = wallOutsideX(wall) + wall.side * CHAIN_STANDOFF;
  e.dir = Math.sign(wall.x - e.x) || e.dir;
  if (Math.abs(e.x - standX) > 6) {
    e.x += Math.sign(standX - e.x) * t.speed * debuffSpeedMult(e) * unopposedSprintMult(e) * dt;
    return true;
  }
  e.hookT = 0;
  e.attackAnim = 0.4;
  setImpState(e, "hooking");
  return true;
}

// ── Siege Imp ────────────────────────────────────────────────────────────────
// A slow, heavily-shielded battering unit. Its plank shield deflects frontal
// arrows (handled in ProjectileSystem); loose imps climb aboard the scrap
// platform on its back and ride to the walls; braced against a wall or gate it
// lowers the shield and slams the ram home on a windup→strike cadence.
const SIEGE_RIDER_BOARD_RANGE = 155;
const SIEGE_DUST = "#6b5a45";

// A rider hops off the platform, falling to the ground with the wall-drop gravity.
function dropSiegeRider(imp, breached) {
  imp.ridingSiege = null;
  imp.riderSeat = undefined;
  imp.leftStack = true;      // reuse the imp wall-drop gravity so it falls to the ground
  imp.hasLeftStack = false;
  imp.vy = 0;
  if (breached) markImpBreachedWall(imp);
  setImpState(imp, "advance");
}

function siegeRiderCount(e) {
  let n = 0;
  for (const r of state.enemies) if (r.ridingSiege === e && !r.dying) n++;
  return n;
}

// Pull nearby loose imps up onto the platform, filling open seats.
function recruitSiegeRiders(e, t) {
  const seats = t.riderSeats || 3;
  const taken = new Set();
  for (const r of state.enemies) if (r.ridingSiege === e && !r.dying && r.riderSeat !== undefined) taken.add(r.riderSeat);
  if (taken.size >= seats) return;
  for (const o of state.enemies) {
    if (o.type !== "imp" || o.fleeing || o.dying || o.ridingSiege || o.ridingDragon) continue;
    if (o.breachedWall || o.wallTopWall || o.stackWallRef || o.queueWallRef || o.leftStack) continue;
    if (o.aiState === "stacking" || o.aiState === "climbOver" || o.aiState === "stackQueue" ||
        o.aiState === "thrown" || o.aiState === "vaulting" || o.aiState === "combat" || o.aiState === "impAttack") continue;
    if (Math.sign(o.x - e.x) === e.dir) continue;             // in front and racing ahead — leave it be
    if (dist(e.x, o.x) > SIEGE_RIDER_BOARD_RANGE) continue;
    let seat = -1;
    for (let k = 0; k < seats; k++) if (!taken.has(k)) { seat = k; break; }
    if (seat < 0) break;
    taken.add(seat);
    o.ridingSiege = e;
    o.riderSeat = seat;
    breakImpStack(o);
    spawnParticles(o.x, groundY - 20, 4, SIEGE_DUST, 24, 32);
    if (taken.size >= seats) break;
  }
}

function updateSiegeImp(e, t, dt) {
  const { base } = state;
  if (e.ramCd === undefined) e.ramCd = t.ramInterval || 1.55;
  if (e.ramCd > 0) e.ramCd -= dt;
  if (e.ramWind > 0) e.ramWind -= dt;

  e.dir = Math.sign(base.x - e.x) || e.dir || 1;

  // Recruit riders on the march (never once it's committed to a wall)
  if (e.riderScanCd === undefined) e.riderScanCd = rand(0.3, 0.9);
  e.riderScanCd -= dt;
  if (e.riderScanCd <= 0) {
    e.riderScanCd = rand(0.6, 1.2);
    if (!e.siegeDisembark && siegeRiderCount(e) < (t.riderSeats || 3)) recruitSiegeRiders(e, t);
  }

  const side = e.x < CFG.baseX ? -1 : 1;
  const wall = wallAt(side, e.x);
  const ramRange = t.ramRange || 58;

  // Pick a ram target: a wall in the way, else the base once we've closed on it.
  let target = null;
  if (wall && dist(e.x, wall.x) < ramRange) target = { kind: "wall", obj: wall, x: wall.x };
  else if (!wall && dist(e.x, base.x) < ramRange + 44) target = { kind: "base", obj: base, x: base.x };

  if (target) {
    e.siegeDisembark = true;                                  // riders storm off to swarm the wall
    e.dir = Math.sign(target.x - e.x) || e.dir;
    if (e.ramWind > 0) {
      e.shieldDown = true;                                    // shield lowered, ram hauled back
      if (e.ramWind <= dt && !e.ramStruck) {
        e.ramStruck = true;
        if (target.kind === "wall") {
          const w = target.obj;
          if (w.commissioned && w.hp > 0) damageWall(w, t.dmg, 10, e);
          spawnParticles(target.x - side * 8, groundY - 26, 12, SIEGE_DUST, 72, 62);
          spawnParticles(target.x - side * 8, groundY - 30, 6, "#ff8a30", 50, 70);
        } else {
          const b = target.obj;
          if (b.hp > 0) {
            const crit = applyCrit(t.baseDmg ?? t.dmg, CFG.critChance, CFG.critMultiplier);
            b.hp -= crit.damage; b.flash = 0.3; if (b.hp < 0) b.hp = 0;
            if (crit.isCrit) critFloaty(b.x, crit.damage);
            else floaty(b.x, "-" + crit.damage, "#ff6a4a");
            spawnParticles(b.x + rand(-30, 30), groundY - 30, 8, "#ff6a4a", 90, 80);
          }
        }
        Game.screenShake = Math.max(Game.screenShake || 0, 0.42);
        Audio.hit();
        e.attackAnim = 0.32;
      }
    } else if (e.ramCd <= 0) {
      e.ramWind = t.ramWindup || 0.72;                        // begin a fresh wind-up
      e.ramCd = (t.ramInterval || 1.55) + (t.ramWindup || 0.72);
      e.ramStruck = false;
      e.attackAnim = 0.5;
      spawnParticles(e.x, groundY - 8, 6, SIEGE_DUST, 40, 32);
    } else {
      e.shieldDown = false;                                   // shield back up between slams
    }
    return true;
  }

  // Still marching: shield raised, heavy stomping steps.
  e.shieldDown = false;
  const slow = debuffSpeedMult(e);
  const sprint = unopposedSprintMult(e);
  e.x += e.dir * t.speed * slow * sprint * approachSpeedMult(Math.abs(base.x - e.x)) * dt;
  if (Math.random() < 0.12) spawnParticles(e.x - e.dir * 14, groundY - 3, 1, SIEGE_DUST, 16, 14);
  return true;
}

function nearestBiomeSiegeTarget(e, range) {
  let best = null, bd = range;
  for (const w of state.walls) {
    if (!w.commissioned || w.hp <= 0) continue;
    const d = dist(e.x, w.x);
    if (d < bd) { bd = d; best = { kind: "wall", x: w.x, obj: w }; }
  }
  const base = state.base;
  if (base?.hp > 0) {
    const d = dist(e.x, base.x);
    if (d < bd) best = { kind: "base", x: base.x, obj: base };
  }
  return best;
}

function updateBiomeCommon(e, t, dt) {
  if (t.blizzardAura) {
    let chilled = 0;
    for (const u of state.units) {
      if (u.role !== "archer" || u.hp <= 0 || u.dying || dist(e.x, u.x) > t.blizzardAura) continue;
      u.cooldown = Math.max(u.cooldown || 0, 0.18);
      chilled++;
    }
    if (chilled && Math.random() < dt * 8) spawnParticles(e.x + rand(-20, 20), groundY + (e.fy || -120), 1, "#d8f8ff", 34, 48);
  }

  if (t.goldEater) {
    if (e.feedPulse > 0) e.feedPulse = Math.max(0, e.feedPulse - dt);
    e.goldEatCd = (e.goldEatCd || 0) - dt;
    if (e.goldEatCd <= 0) {
      e.goldEatCd = 0.55;
      let best = -1, bd = 95;
      for (let i = 0; i < state.coins.length; i++) {
        const c = state.coins[i];
        const d = dist(e.x, c.x);
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) {
        const c = state.coins.splice(best, 1)[0];
        e.hp = Math.min((e.maxHp || t.hp) + 24, (e.hp || 0) + 8 + (c.value || 1));
        e.maxHp = Math.max(e.maxHp || t.hp, e.hp);
        e.w = Math.min((e.w || t.w) + 1.4, (t.w || 70) * 1.25);
        e.feedPulse = 0.55;
        e.flash = Math.max(e.flash || 0, 0.12);
        spawnParticles(c.x, groundY - 18, 10, t.eye || "#b8ff7a", 44, 68);
        floaty(e.x, "+fed", t.eye || "#b8ff7a", 12);
      }
    }
  }

  if (t.breeder) {
    e.spawnCd = (e.spawnCd || rand(2.5, t.spawnInterval || 8)) - dt;
    if (e.spawnCd <= 0 && state.enemies.length < 180) {
      e.spawnCd = (t.spawnInterval || 8) + rand(-1, 1.4);
      const count = t.spawnCount || 2;
      for (let k = 0; k < count; k++) {
        const child = spawnEnemy(t.spawnType || "imp", {
          x: e.x - (e.dir || 1) * rand(24, 68),
          side: e.portal?.side || (e.x < CFG.baseX ? -1 : 1),
        });
        child.portal = e.portal || child.portal;
        child.fy = 0;
        child.spawnedByBiomeEnemy = true;
      }
      startEnemyAttack(e, 0.4, { kind: "spawn", impact: 0.45 });
      spawnParticles(e.x, groundY - 28 + (e.fy || 0), 18, t.eye || "#f2c14e", 72, 80);
      Audio.portalSpawn();
    }
  }

  if (t.rangedSiege) {
    e.siegeShootCd = (e.siegeShootCd ?? rand(1.2, t.shootInterval || 4)) - dt;
    const target = nearestBiomeSiegeTarget(e, t.shootRange || 480);
    if (target) {
      e.dir = Math.sign(target.x - e.x) || e.dir;
      if (e.siegeShootCd <= 0) {
        e.siegeShootCd = (t.shootInterval || 4) + rand(-0.35, 0.6);
        startEnemyAttack(e, 0.34, { kind: "lob", impact: 0.4 });
        if (target.kind === "wall") {
          damageWall(target.obj, Math.max(2, (t.dmg || 6) * 0.65), 7, e);
          target.obj.sporeT = Math.max(target.obj.sporeT || 0, t.biome === "swamp" ? 5.5 : 0);
        } else {
          const crit = applyCrit(t.baseDmg ?? Math.max(2, (t.dmg || 6) * 0.4), CFG.critChance, CFG.critMultiplier);
          target.obj.hp = Math.max(0, target.obj.hp - crit.damage);
          target.obj.flash = 0.22;
          if (crit.isCrit) critFloaty(target.obj.x, crit.damage);
          else floaty(target.obj.x, "-" + crit.damage, t.eye || "#ff6a4a");
        }
        spawnParticles(e.x, groundY - t.w * 0.7 + (e.fy || 0), 8, t.eye || "#caff7a", 56, 46);
        Audio.bow();
      }
      // Holding the firing line: bail out of the melee/march logic, but keep the
      // idle gait and attack countdown ticking. Without this the enemy froze its
      // walk cycle and stayed locked in the just-fired pose (attackAnim never
      // decayed), because the early return skipped the per-branch anim tick.
      if (dist(e.x, target.x) < (t.shootRange || 480) * 0.72) {
        e.anim += dt * 2.6;
        if (e.flash > 0) e.flash -= dt;
        if (e.attackAnim > 0) e.attackAnim -= dt;
        return true;
      }
    }
  }

  return false;
}

export function updateEnemies(dt) {
  const { enemies, units, base, player } = state;
  clearImpWallCache();
  for (const w of state.walls) {
    if (w.frozenT > 0) w.frozenT = Math.max(0, w.frozenT - dt);
    if (w.sporeT > 0) {
      w.sporeT = Math.max(0, w.sporeT - dt);
      w.sporeTick = (w.sporeTick || 0) - dt;
      if (w.sporeTick <= 0 && w.commissioned && w.hp > 0) {
        w.sporeTick = 1;
        damageWall(w, 1, 2, null);
        spawnParticles(w.x + rand(-18, 18), groundY - 30, 3, "#b8ff7a", 28, 34);
      }
    }
  }
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const baseType = ENEMY_TYPES[e.type];

    if (!baseType) { enemies.splice(i, 1); continue; }
    const t = scaledEnemyType(e, baseType);
    if (e.dying) {
      // The brute's rig is otherwise only ticked by updateEnemyGait, which is
      // skipped for dying enemies below — without this it would freeze mid-pose
      // the instant it died, and the ragdoll transform in RenderEntities would
      // just rotate that frozen pose rather than let the body collapse.
      if (e.type === "brute") updateBruteRig(e, dt);
      continue;
    }
    initEnemyAI(e);
    updateEnemyGait(e, dt);
    if (e.emberWard > 0) e.emberWard = Math.max(0, e.emberWard - dt);
    if (e.emberFrenzy > 0) e.emberFrenzy = Math.max(0, e.emberFrenzy - dt);
    if (updateBiomeCommon(e, t, dt)) continue;

    // Imps riding on the fire dragon's back stay seated until dropped
    if (e.ridingDragon) {
      const drg = e.ridingDragon;
      if (drg.dying || !enemies.includes(drg)) {
        dropRiderFromDragon(e);
      } else {
        e.anim += dt * 2;
        if (e.flash > 0) e.flash -= dt;
        const seat = e.riderSeat || 0;
        e.x = drg.x - drg.dir * (seat * 27 - 16);
        e.fy = (drg.fy || -110) - 50 + (seat % 2) * 4 + Math.sin((drg.anim || 0) * 0.7 + seat) * 2;
        e.dir = drg.dir;
        continue;
      }
    }

    // Imps riding the Siege Imp's back platform form a moving tower until it
    // reaches the walls (or dies), then they pile off to join the assault.
    if (e.ridingSiege) {
      const sIm = e.ridingSiege;
      if (sIm.dying || !enemies.includes(sIm) || sIm.siegeDisembark) {
        dropSiegeRider(e, sIm.breachedWall);
      } else {
        e.anim += dt * 2;
        if (e.flash > 0) e.flash -= dt;
        const seat = e.riderSeat || 0;
        e.dir = sIm.dir;
        e.x = sIm.x - sIm.dir * (9 + seat * 3);
        e.fy = -50 - seat * 15 + Math.sin((sIm.anim || 0) * 0.8 + seat * 1.7) * 1.5;
        continue;
      }
    }

    // Night bosses run their own state machines in BossAI.js
    if (t.boss) {
      e.anim += dt * (t.flying ? 5 : 2.6);
      if (e.flash > 0) e.flash -= dt;
      if (e.attackAnim > 0) e.attackAnim -= dt;
      e.attackCd -= dt;
      if (e.shootCd !== undefined) e.shootCd -= dt;
      if (e.slow > 0) e.slow -= dt;
      if (e.frost > 0) e.frost -= dt;
      if (e.rooted > 0) e.rooted -= dt;
      if (tickPoisonAndBlind(e, dt)) continue;
      if (e.fleeing) {
        if (fleeToPortal(e, t, dt)) enemies.splice(i, 1);
        continue;
      }
      updateBoss(e, t, dt);
      continue;
    }

    if (t.flying) {
      e.anim += dt * 5;
      if (e.flash > 0) e.flash -= dt;
      if (e.attackAnim > 0) e.attackAnim -= dt;
      e.attackCd -= dt;
      if (e.shootCd !== undefined) e.shootCd -= dt;
      if (e.slow > 0) e.slow -= dt;
      if (e.frost > 0) e.frost -= dt;
      if (e.rooted > 0) e.rooted -= dt;
      if (tickPoisonAndBlind(e, dt)) continue;
      if (e.fleeing) {
        if (fleeToPortal(e, t, dt)) enemies.splice(i, 1);
        continue;
      }
      if (t.fireball) {
        const target = fireImpTarget(e, t.shootRange || 420);
        const hoverY = -(118 + Math.sin(e.anim * 0.9 + e.x * 0.01) * 18);
        e.fy += (hoverY - (e.fy || hoverY)) * Math.min(1, dt * 1.8);
        if (target) {
          const desiredX = target.x - Math.sign(target.x - e.x || e.dir || 1) * 245;
          const dx = desiredX - e.x;
          e.dir = Math.sign(target.x - e.x) || e.dir;
          if (Math.abs(dx) > 18) e.x += Math.sign(dx) * t.speed * 0.72 * dt;
          if (e.shootCd <= 0 && dist(e.x, target.x) < (t.shootRange || 420)) shootEnemyFireball(e, t, target);
        } else {
          e.dir = Math.sign(base.x - e.x) || e.dir;
          e.x += e.dir * t.speed * unopposedSprintMult(e) * approachSpeedMult(Math.abs(base.x - e.x)) * dt;
        }
        if (Math.random() < 0.75) spawnParticles(e.x + rand(-8, 8), groundY + (e.fy || -120) + rand(-8, 8), 1, "#ff6a20", 16, 24);
        continue;
      }
      e.dir = Math.sign(base.x - e.x) || e.dir;
      e.x += e.dir * t.speed * unopposedSprintMult(e) * approachSpeedMult(Math.abs(base.x - e.x)) * dt;
      if (e.shootCd !== undefined && e.shootCd <= 0 && dist(e.x, player.x) < 380) {
        const arrowY = groundY + (e.fy || -80);
        state.arrows.push({ x: e.x, y: arrowY, vx: Math.sign(player.x - e.x) * 320, vy: 180, target: {x: player.x}, life: 1.5, hitKind: "player" });
        e.shootCd = 2.2;
        startEnemyAttack(e, 0.34, { kind: "cast", impact: 0.18 });
        Audio.bow();
      }
      if (dist(e.x, player.x) < 28 && Math.abs((groundY + (e.fy || -80)) - (groundY - 50 - playerCombatLift())) < 72 && e.attackCd <= 0) {
        if (damagePlayer(1) !== null) { e.attackCd = 1.5; e.fleeing = true; }
      }
      continue;
    }

    e.anim += dt * 5;
    if (e.flash > 0) e.flash -= dt;
    if (e.attackAnim > 0) e.attackAnim -= dt;
    e.attackCd -= dt;
    if (e.burrowT > 0) e.burrowT = Math.max(0, e.burrowT - dt);
    if (e.poisonCd !== undefined) e.poisonCd -= dt;

    // Imp falling when leaving wall/stack
    if (e.type === "imp" && e.leftStack && !e.hasLeftStack) {
      if (e.fy === undefined) e.fy = -60; // Start slightly airborne, as if hopping off the wall
      if (e.vy === undefined) e.vy = 0;
      if (e.wallDropStartFy === undefined) e.wallDropStartFy = Math.min(-12, e.fy || -60);
      e.wallDropT = (e.wallDropT || 0) + dt;
      e.climbProgress = undefined; // Clear climb animation
      e.stackPos = undefined;

      e.vy += 600 * dt; // Gravity (positive = falling down)
      e.fy += e.vy * dt; // fy rises toward 0 (down on screen, since negative fy is up)

      // Stop at ground level
      if (e.fy >= 0) {
        e.fy = 0;
        e.vy = 0;
        e.hasLeftStack = true; // Mark as permanently left stack
        e.wallDropLand = 0.22;
        e.wallDropT = 0;
        e.wallDropStartFy = undefined;
        spawnParticles(e.x, groundY - 4, 5, "#6b5a45", 32, 24);
      }
    } else if (e.type === "imp" && (e.wallDropLand || 0) > 0) {
      e.wallDropLand = Math.max(0, (e.wallDropLand || 0) - dt);
    }

    // Handle knockback with recovery state (thrown imps keep their arc)
    if (e.knock && e.aiState !== "thrown") {
      e.x += e.knock * dt;
      e.knock *= Math.max(0, 1 - 9 * dt);
      if (Math.abs(e.knock) < 8) {
        e.knock = 0;
        // Enter recovery state after knockback
        if (e.aiState !== "recovery") changeState(e, "recovery", 0.35);
      }
    }

    if (e.burn > 0) {
      e.burn -= dt;
      if (e.type === "imp") {
        const burnY = groundY + (e.fy || 0) - 22;
        if (Math.random() < 0.9) spawnParticles(e.x + rand(-6, 6), burnY + rand(-8, 8), 1, "#ff6a20", 18, 34);
        if (Math.random() < 0.45) spawnParticles(e.x + rand(-5, 5), burnY + rand(-10, 4), 1, "#ffd060", 10, 42);
      }
      e.burnTick = (e.burnTick || 0) - dt;
      if (e.burnTick <= 0) {
        const burnDmg = e.burnDmg || 1;
        e.hp -= burnDmg; e.flash = 0.08; e.burnTick = 1;
        const burnY = groundY + (e.fy || 0) - 24;
        spawnParticles(e.x, burnY, 7, "#ff6a20", 40, 55);
        spawnParticles(e.x, burnY, 3, "#ffd060", 25, 65);
        spawnImpBlood(e, 0.45, burnY);
        if (e.hp<=0) { killEnemy(e); continue; }
      }
      if (e.burn <= 0) { e.burn = 0; e.ignited = false; e.burnDmg = 0; }
    }
    if (tickPoisonAndBlind(e, dt)) continue;
    if (e.slow > 0) e.slow -= dt;
    if (e.frost > 0) {
      e.frost -= dt;
      if (Math.random() < 0.5) spawnParticles(e.x, groundY - 26, 1, "#bfefff", 14, 26);
    }
    if (e.rooted > 0) {
      e.rooted -= dt;
      if (Math.random() < 0.4) spawnParticles(e.x, groundY - 12, 1, "#8fd8ff", 10, 18);
    }

    // Update state timers
    if (e.stateTimer > 0) e.stateTimer -= dt;

    // Ember brute: heavy ground brawler with two signature fire attacks —
    // a shoulder charge that closes distance fast, and a ground stomp AOE.
    if (t.charger || t.stomper) {
      if (e.chargeCd === undefined) e.chargeCd = rand(t.chargeMin, t.chargeMax);
      if (e.stompCd === undefined) e.stompCd = rand(t.stompMin, t.stompMax);
      if (e.chargeFlash > 0) e.chargeFlash -= dt;
      if (e.stompFlash > 0) e.stompFlash -= dt;
      if (e.throwAnim > 0) e.throwAnim -= dt;

      if (e.charging) {
        e.chargeT = (e.chargeT || 0) + dt;
        e.x += e.chargeDir * t.speed * 3.2 * dt;
        if (Math.random() < 0.6) spawnParticles(e.x - e.chargeDir * 10, groundY - 6, 2, "#ff6a20", 40, 40);
        const hitPlayer = dist(e.x, player.x) < 34 && player.invuln <= 0 && !inject('godMode');
        if (hitPlayer) {
          meleeHitPlayer(e, { ...t, meleeDmg: (t.meleeDmg || 1) + 1 }, 340);
          e.charging = false;
          e.attackCd = 0.9;
          changeState(e, "recovery", 0.5);
        } else if (e.chargeT >= 0.9) {
          e.charging = false;
          changeState(e, "recovery", 0.3);
        }
      } else if (t.charger && !e.fleeing && e.chargeCd <= 0 && e.aiState !== "recovery") {
        const d = dist(e.x, player.x);
        if (d > t.chargeRangeMin && d < t.chargeRangeMax) {
          e.charging = true;
          e.chargeT = 0;
          e.chargeDir = Math.sign(player.x - e.x) || e.dir;
          e.chargeCd = rand(t.chargeMin, t.chargeMax);
          e.attackAnim = 0.3;
          e.chargeFlash = 0.3;
          spawnParticles(e.x, groundY - 10, 10, "#ff6a20", 50, 40);
          Audio.hit();
        }
      }

      if (t.stomper && !e.charging && e.stompCd <= 0 && !(e.type === "brute" && e._bruteStructureTarget)) {
        e.stompCd = rand(t.stompMin, t.stompMax);
        const radius = t.stompRadius || 90;
        let hitSomething = false;
        if (dist(e.x, player.x) < radius && playerCombatLift() <= 20) {
          if (damagePlayer(t.meleeDmg || 1, { knock: Math.sign(player.x - e.x || 1) * 260 }) !== null) hitSomething = true;
        }
        for (const u of units) {
          if (u.hp <= 0 || u.dying || u.onWall) continue;
          if (dist(e.x, u.x) < radius) {
            const crit = applyCrit(2, CFG.critChance, CFG.critMultiplier);
            u.hp -= crit.damage; u.panic = 1;
            u.knock = (u.knock || 0) + Math.sign(u.x - e.x || 1) * 180;
            spawnParticles(u.x, groundY - 30, 3, "#7a1f1f");
            if (crit.isCrit) critFloaty(u.x, crit.damage); else floaty(u.x, "-" + crit.damage, "#7a1f1f");
            hitSomething = true;
          }
        }
        // A ground shockwave remains an anti-personnel move for the Brute. It
        // no longer substitutes for visibly punching a wall or the base.
        if (e.type !== "brute") {
          for (const w of state.walls) {
            if (!w.commissioned || w.hp <= 0) continue;
            if (dist(e.x, w.x) < radius) { damageWall(w, t.dmg * 0.35, 4, e); hitSomething = true; }
          }
        }
        if (hitSomething || (e.type !== "brute" && dist(e.x, base.x) < radius)) {
          e.stompFlash = 0.35;
          Game.screenShake = Math.max(Game.screenShake || 0, 0.35);
          spawnParticles(e.x, groundY - 6, 20, "#ff6a20", 140, 90);
          spawnParticles(e.x, groundY - 8, 10, "#6b5a45", 100, 70);
          Audio.hit();
        }
      }

      updateBruteThrow(e, t, dt);
    }
    if (e.charging) continue;

    if (e.fleeing) {
      if (fleeToPortal(e, t, dt)) enemies.splice(i, 1);
      continue;
    }

    if (e.type === "ashPriest" && updateAshPriest(e, t, dt)) continue;

    if (e.type === "siegeImp" && updateSiegeImp(e, t, dt)) continue;

    if (e.type === "chainImp" && updateChainImp(e, t, dt)) continue;

    if (e.type === "imp" && updateImp(e, t, dt)) continue;

    // Finish an already-committed Brute structure strike even if the impact
    // destroys the wall and wallAt() stops returning it on the following tick.
    if (e.type === "brute" && e._bruteStructureTarget) {
      updateBruteStructureAttack(e, t, e._bruteStructureTarget, e._bruteStructureKind);
      continue;
    }

    const side = e.x < CFG.baseX ? -1 : 1;
    const wall = wallAt(side, e.x);
    const stackDropBypassesWall = e.type === "imp" && impStackDropBypassesWall(e, wall);
    if (wall && t.burrower && wall.level < 3 && dist(e.x, wall.x) < 34) {
      e.x = wallInsideX(wall);
      e.burrowedWall = wall;
      // Reappear from below the ground after crossing the weak wall. The timer
      // is update-owned so the emergence continues even while off-screen.
      e.burrowT = 1.15;
      e.fy = 0;
      e.aggroPlayer = false;
      spawnParticles(wall.x + wall.side * 12, groundY - 4, 18, "#d8b46a", 70, 38);
      floaty(wall.x, "Burrow!", "#d8b46a", 13);
      continue;
    }
    if (wall && e.type !== "imp" && dist(e.x, wall.x) < wallAttackRange(e, t, wall) && !stackDropBypassesWall) {
      e.dir = Math.sign(wall.x - e.x) || e.dir;
      if (e.type === "brute") {
        updateBruteStructureAttack(e, t, wall, "wall");
        continue;
      }
      if (e.attackCd <= 0 && e.aiState !== "recovery") {
        changeState(e, "attacking", 0.5);
        e.attackCd = 0.7; startEnemyAttack(e, 0.22 * swingMult(e), { kind: "bash", impact: 0.22 });
        damageWall(wall, t.dmg, 3, e);
      }
      continue;
    }

    if (e.aggroUnit && (!units.includes(e.aggroUnit) || dist(e.x, e.aggroUnit.x) > 340)) {
      e.aggroUnit = null;
    }

    if (dist(e.x, player.x) < 280 && e.carry === 0) {
      e.aggroPlayer = true;
      e.aggroTimer = 6;
    }

    if (e.aggroTimer > 0)
      e.aggroTimer -= dt;

    if (e.aggroPlayer && e.aggroTimer <= 0 && dist(e.x, player.x) > 700) {
      e.aggroPlayer = false;
    }

    if (e.aggroPlayer) {
      const d = dist(e.x, player.x);
      const reach = meleeReach(e, t, 30);

      e.dir = Math.sign(player.x - e.x) || e.dir;

      // Handle attack state machine
      if (e.aiState === "recovery") {
        // Don't move or attack during recovery
        if (e.stateTimer <= 0) changeState(e, "chasing", 0);
      } else if (e.aiState === "attacking") {
        // Windup phase: stop moving, wait before attacking
        if (e.stateTimer <= 0) {
          if (d <= reach + 8 && playerCombatLift() <= 4 && player.invuln <= 0 && !inject('godMode')) {
            const hadCoins = player.coins > 0;
            if (meleeHitPlayer(e, t, 230) && hadCoins) e.carry++;
            changeState(e, "recovery", 0.4);
            e.attackCd = 1;
            startEnemyAttack(e, 0.25 * swingMult(e), { kind: "swipe" });
          } else {
            clearPreparedEnemyAttack(e);
            changeState(e, "chasing", 0);
          }
        }
      } else {
        // Chasing phase: move towards player
        const chaseMult = debuffSpeedMult(e);
        if (d > reach * 0.82) e.x += e.dir * t.speed * 1.4 * chaseMult * dt;

        // Transition to attacking when close enough
        if (d <= reach && e.attackCd <= 0) {
          prepareEnemyAttack(e, "swipe");
          changeState(e, "attacking", 0.45 + Math.random() * 0.2);
        }
      }

      continue;
    }

    // Imps fight units through their own attack system (updateImpCombat); the generic
    // aggro state machine conflicts with updateImp resetting aiState every frame.
    if (e.type === "imp") e.aggroUnit = null;
    if (!e.aggroUnit && e.type !== "imp") {
      let best = null, bd = 200;
      for (const u of units) { const d = dist(e.x, u.x); if (d < bd) { bd = d; best = u; } }
      if (best) e.aggroUnit = best;
    }
    if (e.aggroUnit) {
      const d = dist(e.x, e.aggroUnit.x);
      const reach = meleeReach(e, t, 40);
      e.dir = Math.sign(e.aggroUnit.x - e.x) || e.dir;

      if (e.aiState === "recovery") {
        if (e.stateTimer <= 0) changeState(e, "chasing", 0);
      } else if (e.aiState === "attacking") {
        if (e.stateTimer <= 0) {
          if (d > reach + 10) {
            clearPreparedEnemyAttack(e);
            changeState(e, "chasing", 0);
            continue;
          }
          changeState(e, "recovery", 0.4);
          e.attackCd = 0.8; startEnemyAttack(e, 0.22 * swingMult(e), { kind: "swipe" });
          const crit = applyCrit(2, CFG.critChance, CFG.critMultiplier);
          e.aggroUnit.hp -= crit.damage; e.aggroUnit.panic = 1;
          spawnParticles(e.aggroUnit.x, groundY - 30, 3, "#7a1f1f");
          if (crit.isCrit) critFloaty(e.aggroUnit.x, crit.damage);
          else floaty(e.aggroUnit.x, "-" + crit.damage, "#7a1f1f");
          Audio.hit();
        }
      } else {
        const unitChaseMult = debuffSpeedMult(e);
        if (d > reach * 0.82) e.x += e.dir * t.speed * 1.3 * unitChaseMult * dt;
        if (d <= reach && e.attackCd <= 0) {
          prepareEnemyAttack(e, "swipe");
          changeState(e, "attacking", 0.4 + Math.random() * 0.2);
        }
      }
      continue;
    }

    if (dist(e.x, base.x) < baseAttackRange(e, t)) {
      e.dir = Math.sign(base.x - e.x) || e.dir;
      if (e.type === "brute") {
        updateBruteStructureAttack(e, t, base, "base");
        continue;
      }
      if (e.attackCd <= 0 && e.aiState !== "recovery") {
        changeState(e, "attacking", 0.4);
        e.attackCd = 0.9; startEnemyAttack(e, 0.22 * swingMult(e), { kind: "bash", impact: 0.22 });
        const crit = applyCrit(t.baseDmg ?? t.dmg, CFG.critChance, CFG.critMultiplier);
        base.hp -= crit.damage; base.flash = 0.2;
        spawnParticles(base.x + rand(-30, 30), groundY - 30, 4, "#ff6a4a");
        if (crit.isCrit) critFloaty(base.x, crit.damage);
        else floaty(base.x, "-" + crit.damage, "#ff6a4a");
        Audio.hit();
      }
      continue;
    }


    if (t.rangedShoot && e.poisonCd <= 0 && dist(e.x, player.x) < t.shootRange && e.aiState !== "recovery") {
      const launchY = groundY - t.w * 0.7;
      const dx = player.x - e.x;
      const flightT = 1.4;
      const vx = dx / flightT;
      const vy = ((groundY - 40) - launchY - 0.5 * 500 * flightT * flightT) / flightT;
      state.poisonShots.push({ x: e.x, y: launchY, vx, vy, life: flightT + 0.4, landX: player.x, dmg: t.meleeDmg, sourceEnemy: e });
      e.poisonCd = t.shootInterval;
      startEnemyAttack(e, 0.3, { kind: "spit", impact: 0.42 });
      spawnParticles(e.x, launchY, 6, "#9944cc", 40, 30);
      Audio.bow();
    }

    // Default movement: walk towards base if not in a special state
    if (e.aiState !== "attacking" && e.aiState !== "recovery") {
      e.dir = Math.sign(base.x - e.x) || e.dir;
      const slowMult = debuffSpeedMult(e);
      const sprintMult = t.boss ? 1 : unopposedSprintMult(e);
      e.x += e.dir * t.speed * slowMult * sprintMult * approachSpeedMult(Math.abs(base.x - e.x)) * dt;
    }
  }
}
