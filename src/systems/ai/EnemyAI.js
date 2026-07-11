import { CFG } from '../../config/config.js';
import { ENEMY_TYPES } from '../../config/enemies.js';
import { clamp, lerp, dist, rand, applyCrit } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnParticles, floaty, critFloaty } from '../world/SpawnSystem.js';
import { meleeHitPlayer } from '../combat/PlayerCombat.js';
import { killEnemy, spawnImpBlood } from '../../util/EnemyUtils.js';
import { wallHeight, wallWidth, entityWallLift } from '../../entities/Wall.js';
import { updateBoss, dropRiderFromDragon } from './BossAI.js';

const IMP_STACK_STEP = 18;
const IMP_ATTACH_RANGE = 34;
const IMP_TOP_TRIGGER_PAD = 18;
const IMP_STACK_EXTRA_SLOTS = 2;
const IMP_QUEUE_SPACING = 18;
const IMP_PYRAMID_BASE = 4; // bottom-row width of the waiting pyramid
const WALL_DUEL_GAP = 22;
let impStackSequence = 1;

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
  if (!Game.inMine && dist(e.x, player.x) < UNOPPOSED_RANGE) return 1;
  for (const u of units) {
    if (u.hp <= 0 || u.dying || u.mine) continue;
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
  if (e.rooted > 0) return 0.02;
  if (e.frost > 0) return 0.3;
  if (e.slow > 0) return 0.45;
  return 1;
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
}

function breakImpStack(e) {
  e.stackWallRef = null;
  e.queueWallRef = null;
  e.queueIndex = undefined;
  e.stackJoinOrder = null;
  e.impIndex = undefined;
  e.stackPos = undefined;
  e.climbProgress = undefined;
  e.impStackY = 0;
}

// Heavier enemies (ember brute) get a slower, more telegraphed swing so their
// bulk reads clearly instead of flashing through the generic attack pose.
function swingMult(e) {
  return e.type === "emberBrute" ? 2.6 : 1;
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

function impPlayerBlockedByWall(e, player) {
  const wall = wallAt(e.x < CFG.baseX ? -1 : 1, e.x);
  if (!wall || e.breachedWall) return false;
  const half = Math.max(24, wallWidth(wall) / 2);
  const playerOutsideWall = (player.x - wall.x) * wall.side > half + 6;
  return !playerOutsideWall;
}

function impStackForWall(w) {
  const stack = state.enemies.filter(e =>
    e.type === "imp" &&
    !e.fleeing &&
    !e.dying &&
    e.stackWallRef === w &&
    (e.aiState === "stacking" || e.aiState === "climbOver")
  );
  stack.sort((a, b) => (a.stackJoinOrder || 0) - (b.stackJoinOrder || 0));
  stack.forEach((imp, idx) => {
    imp.impIndex = idx;
    imp.stackPos = idx;
    imp.climbProgress = 1;
    imp.impStackY = -idx * IMP_STACK_STEP;
    imp.impStackX = ((idx % 2 === 0) ? -1 : 1) * Math.min(7, 2 + idx * 0.45);
  });
  return stack;
}

function impStackCapacity(w) {
  const neededForWallTop = Math.ceil(Math.max(1, wallHeight(w) - IMP_TOP_TRIGGER_PAD) / IMP_STACK_STEP);
  return Math.max(2, neededForWallTop + IMP_STACK_EXTRA_SLOTS);
}

function impQueueForWall(w) {
  const queued = state.enemies.filter(e =>
    e.type === "imp" &&
    !e.fleeing &&
    !e.dying &&
    e.queueWallRef === w &&
    e.aiState === "stackQueue"
  );
  queued.sort((a, b) => (a.queueJoinOrder || 0) - (b.queueJoinOrder || 0));
  queued.forEach((imp, idx) => { imp.queueIndex = idx; });
  return queued;
}

function sendImpToStackQueue(e, w) {
  if (e.queueWallRef !== w) {
    e.queueWallRef = w;
    e.queueJoinOrder = impStackSequence++;
  }
  e.stackWallRef = null;
  e.impIndex = undefined;
  e.stackPos = undefined;
  e.impStackY = 0;
  setImpState(e, "stackQueue");
}

// Waiting imps form a pyramid just behind the stack: bottom row fills first
// (nearest the wall = front of queue), upper rows stand on the shoulders of the
// row below. Overflow beyond the pyramid lines up on the ground behind it.
function queueSlotForWall(w, idx) {
  let row = 0, rem = idx, width = IMP_PYRAMID_BASE;
  while (row < IMP_PYRAMID_BASE - 1 && rem >= width) { rem -= width; row++; width--; }
  let col = rem;
  if (row === IMP_PYRAMID_BASE - 1 && rem >= width) { // pyramid full → ground line behind
    row = 0;
    col = IMP_PYRAMID_BASE + (rem - width) + 1;
  }
  const x = wallOutsideX(w) + w.side * (IMP_ATTACH_RANGE + 16 + (col + row * 0.5) * IMP_QUEUE_SPACING);
  return { x, fy: -row * IMP_STACK_STEP };
}

// Move a queued imp toward its pyramid slot; stands perfectly still once there.
function moveImpToQueueSlot(e, t, dt, wall, idx) {
  const slot = queueSlotForWall(wall, idx);
  const dx = slot.x - e.x;
  if (Math.abs(dx) > 2) {
    e.dir = Math.sign(dx);
    e.x += e.dir * Math.min(t.speed * 0.85 * dt, Math.abs(dx));
  } else {
    e.x = slot.x;
    e.dir = -wall.side;
  }
  // Climb/hop vertically only when roughly over the slot; drop quickly, climb slower.
  const nearSlot = Math.abs(slot.x - e.x) < IMP_QUEUE_SPACING;
  const targetFy = nearSlot ? slot.fy : Math.max(e.fy || 0, slot.fy);
  const dy = targetFy - (e.fy || 0);
  if (Math.abs(dy) > 1) {
    const rate = dy > 0 ? 260 : 110; // dy>0 = falling down, dy<0 = hopping up
    e.fy = (e.fy || 0) + Math.sign(dy) * Math.min(Math.abs(dy), rate * dt);
  } else {
    e.fy = targetFy;
  }
}

function assignImpToStack(e, w) {
  if (e.stackWallRef !== w) {
    e.stackWallRef = w;
    e.stackJoinOrder = impStackSequence++;
  }
  setImpState(e, "stacking");
}

function nearestGuardForImp(e, range = 220) {
  if (e.wallTopWall) {
    const topGuard = nearestTopGuardForWall(e.wallTopWall, e.x, e);
    if (topGuard) return topGuard;
  }
  let best = null, bd = range;
  let bestOther = null, bod = range;
  for (const u of state.units) {
    if (u.hp <= 0 || u.dying || u.mine) continue;
    const d = dist(e.x, u.x);
    if (u.role === "guard") { if (d < bd) { bd = d; best = u; } }
    else if (!u.onWall) { if (d < bod) { bod = d; bestOther = u; } }
  }
  // Guards are the preferred duel target; stray workers get hunted when no guard is close.
  return best || bestOther;
}

function topGuardsForWall(w) {
  return state.units.filter(u => u.role === "guard" && u.hp > 0 && !u.dying && u.onWall && u.wall === w);
}

function nearestTopGuardForWall(w, x = w.x, seeker = null) {
  let best = null, bd = 1e9;
  for (const u of topGuardsForWall(w)) {
    if (seeker && u.combatTarget && u.combatTarget !== seeker) continue;
    const d = dist(u.x, x);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

function clearImpDuel(e) {
  if (e.combatTarget && e.combatTarget.combatTarget === e) e.combatTarget.combatTarget = null;
  e.duelGuardX = null;
  e.duelImpX = null;
  e.duelWall = null;
}

function claimWallDuel(e, guard, wall) {
  const center = guard.guardDuelCenterX ?? guard.guardPostX ?? guard.x;
  const guardX = center - wall.side * (WALL_DUEL_GAP * 0.5);
  const impX = center + wall.side * (WALL_DUEL_GAP * 0.5);
  guard.guardDuelCenterX = center;
  guard.guardDuelX = guardX;
  guard.combatTarget = e;
  e.combatTarget = guard;
  e.duelGuardX = guardX;
  e.duelImpX = impX;
  e.duelWall = wall;
  return { guardX, impX };
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
function damageWall(wall, baseDmg, particleCount = 3) {
  const crit = applyCrit(baseDmg, CFG.critChance, CFG.critMultiplier);
  wall.hp -= crit.damage;
  wall.flash = 0.15;
  spawnParticles(wall.x, groundY - 30, particleCount, "#caa46a", 30, 30);
  if (crit.isCrit) critFloaty(wall.x, crit.damage);
  Audio.hit();
  if (wall.hp <= 0) killWall(wall);
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
    dmg: t.meleeDmg || 2,
    radius: 28,
  });
  e.shootCd = t.shootInterval || 2.8;
  e.attackAnim = 0.38;
  spawnParticles(e.x, launchY, 10, "#ff6a20", 42, 40);
  spawnParticles(e.x, launchY, 5, "#ffd060", 26, 54);
  Audio.bow();
}

function fireImpTarget(e, range) {
  let best = null, bd = range;
  const player = state.player;
  if (player && player.hp > 0 && !Game.inMine) {
    const d = dist(e.x, player.x);
    if (d < bd) { bd = d; best = player; }
  }
  for (const u of state.units) {
    if (u.hp <= 0 || u.dying || u.mine) continue;
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

function chooseImpAttack(d) {
  if (d > 38 && d < 118 && Math.random() < 0.45) return "pounce";
  if (d > 20 && d < 52 && Math.random() < 0.34) return "tail";
  if (d < 34) return "claw";
  return "pounce"; // too far for a claw to connect — leap the gap instead
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
  if (!player || player.hp <= 0 || Game.inMine || e.wallTopWall || e.aiState === "climbOver" || e.aiState === "stacking" || e.aiState === "stackQueue") return false;
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
    beginImpAttack(e, "player", player, chooseImpAttack(d));
    return true;
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
  let guard = e.combatTarget;
  if (e.wallTopWall && (!guard || guard.hp <= 0 || !state.units.includes(guard) || !guard.onWall || guard.wall !== e.wallTopWall || (guard.combatTarget && guard.combatTarget !== e))) {
    clearImpDuel(e);
    guard = nearestTopGuardForWall(e.wallTopWall, e.x, e);
    e.combatTarget = guard;
  }
  if (e.wallTopWall && !guard) {
    if (topGuardsForWall(e.wallTopWall).length === 0) startImpVault(e, e.wallTopWall);
    else {
      e.fy = -wallHeight(e.wallTopWall);
      const waitX = e.wallTopWall.x + e.wallTopWall.side * 20;
      e.dir = -e.wallTopWall.side;
      if (dist(e.x, waitX) > 3) e.x += Math.sign(waitX - e.x) * Math.min(t.speed * 0.35 * dt, dist(e.x, waitX));
    }
    return true;
  }
  if (!guard || guard.hp <= 0 || !state.units.includes(guard)) {
    guard = nearestGuardForImp(e, e.breachedWall ? 260 : 140);
    e.combatTarget = guard;
  }
  if (!guard) {
    setImpState(e, e.breachedWall ? "vaulting" : "advance");
    return false;
  }
  // Give up on workers that outrun the chase and get back to the assault.
  if (guard.role !== "guard" && dist(e.x, guard.x) > 260) {
    e.combatTarget = null;
    setImpState(e, e.breachedWall ? "vaulting" : "advance");
    return false;
  }

  let targetX = guard.x;
  if (e.wallTopWall) {
    e.fy = -wallHeight(e.wallTopWall);
    const duel = claimWallDuel(e, guard, e.wallTopWall);
    targetX = duel.impX;
    guard.x += Math.sign(duel.guardX - guard.x) * Math.min(42 * dt, Math.abs(duel.guardX - guard.x));
    guard.dir = Math.sign(e.x - guard.x) || guard.dir;
  }
  e.dir = Math.sign((e.wallTopWall ? (e.duelGuardX ?? guard.x) : guard.x) - e.x) || e.dir;
  const d = dist(e.x, e.wallTopWall ? (e.duelGuardX ?? guard.x) : guard.x);
  if (d < 112 && e.attackCd <= 0) {
    beginImpAttack(e, "guard", guard, chooseImpAttack(d));
    return true;
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
  if (guard.role === "guard") {
    guard.aiState = "combat";
    guard.combatTarget = e;
  } else {
    guard.panic = Math.max(guard.panic || 0, 0.6);
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
    e.breachedWall = true;
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
  breakImpStack(imp);
  imp.thrownT = 0;
  imp.thrownStartX = imp.x;
  imp.thrownStartY = imp.fy || 0;
  imp.thrownEndX = wallInsideX(wall) - wall.side * rand(0, 40);
  imp.thrownPeak = wallHeight(wall) + rand(40, 70);
  imp.knock = 0;
  changeState(imp, "thrown", 0);
  spawnParticles(e.x, groundY - 40, 8, "#ff6a20", 60, 50);
  floaty(e.x, "THROW!", "#ff6a20");
  Audio.hit();
}

function updateImp(e, t, dt) {
  if (e.aiState === "thrown") return updateThrownImp(e, t, dt);
  if (e.knock && (e.aiState === "stacking" || e.aiState === "climbOver")) {
    breakImpStack(e);
    setImpState(e, "recovery");
  }

  if (e.aiState === "recovery") {
    e.impStackY = 0;
    if (e.stateTimer <= 0) setImpState(e, e.breachedWall ? "vaulting" : "advance");
    return true;
  }

  if (e.aiState === "impAttack") return updateImpAttack(e, t, dt);
  if (e.aiState === "combat") return updateImpCombat(e, t, dt);

  if (updateImpPlayerCombat(e, t, dt)) return true;

  // Any unit caught in the open gets hunted down (guards duel, workers get chased).
  if ((e.aiState === "advance" || !e.aiState) && e.carry === 0) {
    let b = null, bd = 150;
    for (const u of state.units) {
      if (u.hp <= 0 || u.dying || u.onWall || u.mine) continue;
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
    if (w && topGuardsForWall(w).length > 0) {
      e.wallTopWall = w;
      e.vaultWall = null;
      e.combatTarget = nearestTopGuardForWall(w, e.x, e);
      setImpState(e, "combat");
      return updateImpCombat(e, t, dt);
    }
    e.breachedWall = true;
    if (w) {
      e.vaultT = Math.min(1, (e.vaultT || 0) + dt * 0.95);
      const endX = wallInsideX(w);
      const topY = -wallHeight(w);
      e.x = mix(e.vaultStartX ?? w.x, endX, e.vaultT);
      e.fy = mix(e.vaultStartY ?? topY, 0, e.vaultT) - Math.sin(e.vaultT * Math.PI) * 12;
      if (e.vaultT < 1) return true;
      e.vaultWall = null;
      e.fy = 0;
    } else {
      e.fy = Math.min(0, (e.fy || 0) + 120 * dt);
    }
    // Landed inside — if another wall still stands between here and the base,
    // this breach only applies to the wall just crossed, not the next one.
    if ((e.fy || 0) >= 0) {
      const nextWall = wallAt(e.x < CFG.baseX ? -1 : 1, e.x);
      if (nextWall) {
        e.breachedWall = false;
        setImpState(e, "advance");
        return false;
      }
    }
    const guard = nearestGuardForImp(e, 260);
    if (guard) {
      e.combatTarget = guard;
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
  if (!wall || e.breachedWall) {
    breakImpStack(e);
    setImpState(e, "advance");
    return false;
  }

  const attachX = wallOutsideX(wall);
  const activeStack = impStackForWall(wall);
  const cap = impStackCapacity(wall);
  const hasStack = activeStack.length > 0;
  const activeQueue = impQueueForWall(wall);
  if (e.aiState === "stackQueue") {
    const stackHasRoom = activeStack.length < cap;
    const isFront = activeQueue[0] === e;
    if (!stackHasRoom || !isFront) {
      const queueIdx = Math.max(0, e.queueIndex || activeQueue.indexOf(e));
      moveImpToQueueSlot(e, t, dt, wall, queueIdx);
      return true;
    }
    e.queueWallRef = null;
    e.queueIndex = undefined;
    e.fy = 0;
  }
  const incomingStack = state.enemies.some(other =>
    other !== e &&
    other.type === "imp" &&
    other.stackWallRef === wall &&
    !other.fleeing &&
    !other.dying &&
    (other.aiState === "stacking" || other.aiState === "climbOver")
  );
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
  e.fy = e.impStackY || 0;
  e.dir = -wall.side;

  if (isTop && stackTallEnough) setImpState(e, "climbOver");

  if (e.aiState === "climbOver") {
    if (e.climbStartX === undefined) e.climbStartX = e.x;
    e.climbT = Math.min(1, (e.climbT || 0) + dt * 0.85);
    e.fy = -wallHeight(wall) + Math.sin(e.climbT * Math.PI) * -6;
    e.x = mix(e.climbStartX, wall.x, e.climbT);
    if (e.climbT >= 1) {
      breakImpStack(e);
      e.wallTopWall = wall;
      e.x = wall.x;
      e.fy = -wallHeight(wall);
      const guard = nearestTopGuardForWall(wall, e.x, e);
      if (guard) {
        e.combatTarget = guard;
        setImpState(e, "combat");
        return updateImpCombat(e, t, dt);
      }
      if (topGuardsForWall(wall).length > 0) {
        setImpState(e, "combat");
        return updateImpCombat(e, t, dt);
      }
      startImpVault(e, wall);
    }
    return true;
  }

  e.climbT = 0;
  e.climbStartX = undefined;
  if (e.attackCd <= 0) {
    e.attackCd = 1.15;
    e.attackAnim = 0.18;
    damageWall(wall, Math.max(1, t.dmg * 0.12), 2);
  }
  return true;
}

export function updateEnemies(dt) {
  const { enemies, units, base, player } = state;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const t = ENEMY_TYPES[e.type];

    if (!t) { enemies.splice(i, 1); continue; }
    if (e.dying) continue;
    initEnemyAI(e);

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

    if (e.home !== undefined) { updateLocEnemy(e, t, dt); continue; }

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
          e.x += e.dir * t.speed * 0.65 * dt;
        }
        if (Math.random() < 0.75) spawnParticles(e.x + rand(-8, 8), groundY + (e.fy || -120) + rand(-8, 8), 1, "#ff6a20", 16, 24);
        continue;
      }
      e.dir = Math.sign(base.x - e.x) || e.dir;
      e.x += e.dir * t.speed * unopposedSprintMult(e) * approachSpeedMult(Math.abs(base.x - e.x)) * dt;
      if (!Game.inMine && e.shootCd !== undefined && e.shootCd <= 0 && dist(e.x, player.x) < 380) {
        const arrowY = groundY + (e.fy || -80);
        state.arrows.push({ x: e.x, y: arrowY, vx: Math.sign(player.x - e.x) * 320, vy: 180, target: {x: player.x}, life: 1.5, hitKind: "player" });
        e.shootCd = 2.2;
        Audio.bow();
      }
      if (!Game.inMine && dist(e.x, player.x) < 28 && Math.abs((groundY + (e.fy || -80)) - (groundY - 50 - playerCombatLift())) < 72 && e.attackCd <= 0 && player.invuln <= 0 && !window._DEV_GOD_MODE) {
        player.hp -= 1; player.invuln = CFG.playerInvuln; player.hurt = 0.35; player.hpShowTimer = 3;
        spawnParticles(player.x, groundY - 50 - playerCombatLift(), 5, "#c1453b");
        Audio.hit();
        e.attackCd = 1.5; e.fleeing = true;
      }
      continue;
    }

    e.anim += dt * 5;
    if (e.flash > 0) e.flash -= dt;
    if (e.attackAnim > 0) e.attackAnim -= dt;
    e.attackCd -= dt;
    if (e.poisonCd !== undefined) e.poisonCd -= dt;

    // Imp falling when leaving wall/stack
    if (e.type === "imp" && e.leftStack && !e.hasLeftStack) {
      if (e.fy === undefined) e.fy = -60; // Start slightly airborne, as if hopping off the wall
      if (e.vy === undefined) e.vy = 0;
      e.climbProgress = undefined; // Clear climb animation
      e.stackPos = undefined;

      e.vy += 600 * dt; // Gravity (positive = falling down)
      e.fy += e.vy * dt; // fy rises toward 0 (down on screen, since negative fy is up)

      // Stop at ground level
      if (e.fy >= 0) {
        e.fy = 0;
        e.vy = 0;
        e.hasLeftStack = true; // Mark as permanently left stack
      }
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
        const burnY = groundY + (e.aiState === "stacking" && e.impStackY !== undefined ? e.impStackY : (e.fy || 0)) - 22;
        if (Math.random() < 0.9) spawnParticles(e.x + rand(-6, 6), burnY + rand(-8, 8), 1, "#ff6a20", 18, 34);
        if (Math.random() < 0.45) spawnParticles(e.x + rand(-5, 5), burnY + rand(-10, 4), 1, "#ffd060", 10, 42);
      }
      e.burnTick = (e.burnTick || 0) - dt;
      if (e.burnTick <= 0) {
        const burnDmg = e.burnDmg || 1;
        e.hp -= burnDmg; e.flash = 0.08; e.burnTick = 1;
        const burnY = groundY + (e.aiState === "stacking" && e.impStackY !== undefined ? e.impStackY : (e.fy || 0)) - 24;
        spawnParticles(e.x, burnY, 7, "#ff6a20", 40, 55);
        spawnParticles(e.x, burnY, 3, "#ffd060", 25, 65);
        spawnImpBlood(e, 0.45, burnY);
        if (e.hp<=0) { killEnemy(e); continue; }
      }
      if (e.burn <= 0) { e.burn = 0; e.ignited = false; e.burnDmg = 0; }
    }
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

      if (e.charging) {
        e.chargeT = (e.chargeT || 0) + dt;
        e.x += e.chargeDir * t.speed * 3.2 * dt;
        if (Math.random() < 0.6) spawnParticles(e.x - e.chargeDir * 10, groundY - 6, 2, "#ff6a20", 40, 40);
        const hitPlayer = !Game.inMine && dist(e.x, player.x) < 34 && player.invuln <= 0 && !window._DEV_GOD_MODE;
        if (hitPlayer) {
          meleeHitPlayer(e, { ...t, meleeDmg: (t.meleeDmg || 1) + 1 }, 340);
          e.charging = false;
          e.attackCd = 0.9;
          changeState(e, "recovery", 0.5);
        } else if (e.chargeT >= 0.9) {
          e.charging = false;
          changeState(e, "recovery", 0.3);
        }
      } else if (t.charger && !Game.inMine && !e.fleeing && e.chargeCd <= 0 && e.aiState !== "recovery") {
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

      if (t.stomper && !e.charging && e.stompCd <= 0) {
        e.stompCd = rand(t.stompMin, t.stompMax);
        const radius = t.stompRadius || 90;
        let hitSomething = false;
        if (!Game.inMine && player.hp > 0 && dist(e.x, player.x) < radius && playerCombatLift() <= 20 && player.invuln <= 0 && !window._DEV_GOD_MODE) {
          player.hp -= Math.max(1, (t.meleeDmg || 1));
          player.invuln = CFG.playerInvuln; player.hurt = 0.35; player.hpShowTimer = 3;
          player.knock = Math.sign(player.x - e.x || 1) * 260;
          spawnParticles(player.x, groundY - 50 - playerCombatLift(), 6, "#c1453b");
          hitSomething = true;
        }
        for (const u of units) {
          if (u.hp <= 0 || u.dying || u.mine || u.onWall) continue;
          if (dist(e.x, u.x) < radius) {
            const crit = applyCrit(2, CFG.critChance, CFG.critMultiplier);
            u.hp -= crit.damage; u.panic = 1;
            u.knock = (u.knock || 0) + Math.sign(u.x - e.x || 1) * 180;
            spawnParticles(u.x, groundY - 30, 3, "#7a1f1f");
            if (crit.isCrit) critFloaty(u.x, crit.damage); else floaty(u.x, "-" + crit.damage, "#7a1f1f");
            hitSomething = true;
          }
        }
        for (const w of state.walls) {
          if (!w.commissioned || w.hp <= 0) continue;
          if (dist(e.x, w.x) < radius) { damageWall(w, t.dmg * 0.35, 4); hitSomething = true; }
        }
        if (hitSomething || dist(e.x, base.x) < radius) {
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

    if (e.type === "imp" && updateImp(e, t, dt)) continue;

    const side = e.x < CFG.baseX ? -1 : 1;
    const wall = wallAt(side, e.x);
    // Skip wall logic entirely once an imp has climbed over (leftStack is permanent)
    if (wall && dist(e.x, wall.x) < 30 && !e.leftStack) {
      e.dir = Math.sign(wall.x - e.x) || e.dir;

      // Imp climbing behavior: stack on each other
      if (e.type === "imp") {
        // Track which wall this imp is queued at, and the order it joined the stack.
        // Using join order (instead of re-sorting by x every frame) keeps each imp's
        // stack slot stable even while x jitters from attack/knockback animation -
        // otherwise the "top" slot flickers between imps and climbProgress never
        // reaches 1, so no imp ever finishes climbing over.
        if (e.stackWallRef !== wall) {
          e.stackWallRef = wall;
          e.stackJoinTime = performance.now();
        }

        // Find all nearby imps at the same wall that haven't left the stack
        const stackImps = [e];
        for (const other of enemies) {
          if (other !== e && other.type === "imp" && other.stackWallRef === wall && dist(other.x, wall.x) < 40 && !other.fleeing && !other.leftStack) {
            stackImps.push(other);
          }
        }
        stackImps.sort((a, b) => a.stackJoinTime - b.stackJoinTime);

        const myStackPos = stackImps.indexOf(e);
        if (e.stackPos !== myStackPos) {
          e.stackPos = myStackPos;
          e.climbProgress = 0; // Reset climb when position changes
        }
        // Gradual climb up the stack
        if (e.climbProgress !== undefined && e.climbProgress < 1) {
          e.climbProgress = Math.min(1, e.climbProgress + dt * 0.6); // Slower climb speed
        }

        // Imps needed: level 1-4 = level+1, level 5+ = 7
        const impsNeeded = wall.level >= 5 ? 7 : (wall.level || 1) + 1;
        const canClimbOver = stackImps.length >= impsNeeded;

        // Check for units on the wall
        const wallUnitsNearby = units.filter(u => u.onWall && u.wall === wall);

        if (canClimbOver && myStackPos === stackImps.length - 1) {
          // Only the very top imp climbs over
          // First let it finish climbing animation (climbProgress === 1)
          if (e.climbProgress >= 1) {
            // Clear stack rendering once at full height
            if (e.stackPos !== undefined) {
              e.stackPos = undefined;
              e.climbProgress = undefined;
              e.fy = 0; // Reset Y offset to normal
            }
            if (wallUnitsNearby.length > 0) {
              // Attack units on the wall
              if (e.attackCd <= 0 && e.aiState !== "recovery") {
                changeState(e, "attacking", 0.5);
                e.attackCd = 0.7; e.attackAnim = 0.22;
                for (const u of wallUnitsNearby) {
                  const crit = applyCrit(t.dmg, CFG.critChance, CFG.critMultiplier);
                  u.hp -= crit.damage; u.panic = 1;
                  spawnParticles(u.x, groundY - 30, 3, "#7a1f1f");
                  if (crit.isCrit) critFloaty(u.x, crit.damage);
                  else floaty(u.x, "-" + crit.damage, "#7a1f1f");
                }
                Audio.hit();
              }
            } else {
              // No units on wall - climb over and move on
              e.x += e.dir * t.speed * 2 * dt;
              e.leftStack = true;
            }
          }
        } else {
          // Bottom/middle imps attack the wall
          if (e.attackCd <= 0 && e.aiState !== "recovery") {
            changeState(e, "attacking", 0.5);
            e.attackCd = 0.7; e.attackAnim = 0.22;
            damageWall(wall, t.dmg * 0.5);
          }
        }
      } else {
        // Non-imp wall behavior
        if (e.attackCd <= 0 && e.aiState !== "recovery") {
          changeState(e, "attacking", 0.5);
          e.attackCd = 0.7; e.attackAnim = 0.22 * swingMult(e);
          damageWall(wall, t.dmg);
        }
      }
      continue;
    }

    if (e.aggroUnit && (!units.includes(e.aggroUnit) || dist(e.x, e.aggroUnit.x) > 340)) {
      e.aggroUnit = null;
    }

    if (!Game.inMine && dist(e.x, player.x) < 280 && e.carry === 0) {
      e.aggroPlayer = true;
      e.aggroTimer = 6;
    }
    if (Game.inMine) e.aggroPlayer = false;

    if (e.aggroTimer > 0)
      e.aggroTimer -= dt;

    if (e.aggroPlayer && e.aggroTimer <= 0 && dist(e.x, player.x) > 700) {
      e.aggroPlayer = false;
    }

    if (e.aggroPlayer) {
      const d = dist(e.x, player.x);

      e.dir = Math.sign(player.x - e.x) || e.dir;

      // Handle attack state machine
      if (e.aiState === "recovery") {
        // Don't move or attack during recovery
        if (e.stateTimer <= 0) changeState(e, "chasing", 0);
      } else if (e.aiState === "attacking") {
        // Windup phase: stop moving, wait before attacking
        if (e.stateTimer <= 0) {
          if (d < 30 && playerCombatLift() <= 4 && player.invuln <= 0 && !window._DEV_GOD_MODE) {
            const hadCoins = player.coins > 0;
            if (meleeHitPlayer(e, t, 230) && hadCoins) e.carry++;
            changeState(e, "recovery", 0.4);
            e.attackCd = 1;
            e.attackAnim = 0.25 * swingMult(e);
          } else {
            changeState(e, "chasing", 0);
          }
        }
      } else {
        // Chasing phase: move towards player
        const chaseMult = debuffSpeedMult(e);
        if (d > 24) e.x += e.dir * t.speed * 1.4 * chaseMult * dt;

        // Transition to attacking when close enough
        if (d < 30 && e.attackCd <= 0) {
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
      for (const u of units) { if (u.mine) continue; const d = dist(e.x, u.x); if (d < bd) { bd = d; best = u; } }
      if (best) e.aggroUnit = best;
    }
    if (e.aggroUnit) {
      const d = dist(e.x, e.aggroUnit.x);
      e.dir = Math.sign(e.aggroUnit.x - e.x) || e.dir;

      if (e.aiState === "recovery") {
        if (e.stateTimer <= 0) changeState(e, "chasing", 0);
      } else if (e.aiState === "attacking") {
        if (e.stateTimer <= 0) {
          changeState(e, "recovery", 0.4);
          e.attackCd = 0.8; e.attackAnim = 0.22 * swingMult(e);
          const crit = applyCrit(2, CFG.critChance, CFG.critMultiplier);
          e.aggroUnit.hp -= crit.damage; e.aggroUnit.panic = 1;
          spawnParticles(e.aggroUnit.x, groundY - 30, 3, "#7a1f1f");
          if (crit.isCrit) critFloaty(e.aggroUnit.x, crit.damage);
          else floaty(e.aggroUnit.x, "-" + crit.damage, "#7a1f1f");
          Audio.hit();
        }
      } else {
        const unitChaseMult = debuffSpeedMult(e);
        if (d > 32) e.x += e.dir * t.speed * 1.3 * unitChaseMult * dt;
        if (d < 40 && e.attackCd <= 0) {
          changeState(e, "attacking", 0.4 + Math.random() * 0.2);
        }
      }
      continue;
    }

    if (dist(e.x, base.x) < 70) {
      e.dir = Math.sign(base.x - e.x) || e.dir;
      if (e.attackCd <= 0 && e.aiState !== "recovery") {
        changeState(e, "attacking", 0.4);
        e.attackCd = 0.9; e.attackAnim = 0.22 * swingMult(e);
        const crit = applyCrit(t.baseDmg ?? t.dmg, CFG.critChance, CFG.critMultiplier);
        base.hp -= crit.damage; base.flash = 0.2;
        spawnParticles(base.x + rand(-30, 30), groundY - 30, 4, "#ff6a4a");
        if (crit.isCrit) critFloaty(base.x, crit.damage);
        else floaty(base.x, "-" + crit.damage, "#ff6a4a");
        Audio.hit();
      }
      continue;
    }


    if (!Game.inMine && t.rangedShoot && e.poisonCd <= 0 && dist(e.x, player.x) < t.shootRange && e.aiState !== "recovery") {
      const launchY = groundY - t.w * 0.7;
      const dx = player.x - e.x;
      const flightT = 1.4;
      const vx = dx / flightT;
      const vy = ((groundY - 40) - launchY - 0.5 * 500 * flightT * flightT) / flightT;
      state.poisonShots.push({ x: e.x, y: launchY, vx, vy, life: flightT + 0.4, landX: player.x, dmg: t.meleeDmg, sourceEnemy: e });
      e.poisonCd = t.shootInterval;
      e.attackAnim = 0.18;
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

function updateLocEnemy(e, t, dt) {
  const { player } = state;
  if (e.flash > 0) e.flash -= dt;
  e.attackCd -= dt;
  if (e.stateTimer > 0) e.stateTimer -= dt;

  if (e.knock) {
    e.x += e.knock * dt;
    e.knock *= Math.max(0, 1 - 9 * dt);
    if (Math.abs(e.knock) < 8) {
      e.knock = 0;
      if (e.aiState !== "recovery") changeState(e, "recovery", 0.35);
    }
  }

  const prevX = e.x;
  const dp = dist(e.x, player.x);

  if (dp < 300 && !Game.inMine) {
    const dir = Math.sign(player.x - e.x);
    e.dir = dir || e.dir;

    if (e.aiState === "recovery") {
      if (e.stateTimer <= 0) changeState(e, "chasing", 0);
    } else if (e.aiState === "attacking") {
      if (e.stateTimer <= 0) {
        if (dp < 32 && playerCombatLift() <= 4 && player.invuln <= 0 && !window._DEV_GOD_MODE) {
          changeState(e, "recovery", 0.4);
          e.attackCd = 1.0;
          meleeHitPlayer(e, t, 220);
        } else {
          changeState(e, "chasing", 0);
        }
      }
    } else {
      e.x += dir * t.speed * dt;
      if (dp < 32 && e.attackCd <= 0) {
        changeState(e, "attacking", 0.4 + Math.random() * 0.2);
      }
    }
  } else if (dist(e.x, e.home) > 50) {
    const dir = Math.sign(e.home - e.x);
    e.dir = dir || e.dir;
    if (e.aiState !== "recovery") {
      e.x += dir * t.speed * 0.45 * dt;
    } else if (e.stateTimer <= 0) {
      changeState(e, "chasing", 0);
    }
  }
  if (Math.abs(e.x - prevX) > 0.02) e.anim += dt * 5;
}
