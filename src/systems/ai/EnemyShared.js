import { CFG } from '../../config/config.js';
import { clamp, lerp, dist, applyCrit } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnParticles, critFloaty } from '../world/SpawnSystem.js';
import { wallReady, wallRenderWidth, entityWallLift } from '../../entities/Wall.js';

export const IMP_STACK_STEP = 18;
export const IMP_ATTACH_RANGE = 34;
export const IMP_TOP_TRIGGER_PAD = 18;
export const IMP_STACK_EXTRA_SLOTS = 2;
export const IMP_QUEUE_SPACING = 18;
export const IMP_PYRAMID_BASE = 4;
export const WALL_DUEL_GAP = 22;
export const IMP_POUNCE_WALL_LOCKOUT = 92;

const APPROACH_SLOW_RANGE = 260;
const APPROACH_FAR_MULT = 2.0;
const APPROACH_NEAR_MULT = 0.55;

const UNOPPOSED_RANGE = 260;
const UNOPPOSED_SPRINT_MULT = 2.4;

export let impStackSequence = 1;
export function nextImpStackSequence() { return impStackSequence++; }

export function mix(a, b, t) {
  return lerp(a, b, clamp(t, 0, 1));
}

export function approachSpeedMult(distToBase) {
  if (distToBase >= APPROACH_SLOW_RANGE) return APPROACH_FAR_MULT;
  return mix(APPROACH_NEAR_MULT, APPROACH_FAR_MULT, distToBase / APPROACH_SLOW_RANGE);
}

export function unopposedSprintMult(e) {
  const { player, units } = state;
  if (!Game.inMine && dist(e.x, player.x) < UNOPPOSED_RANGE) return 1;
  for (const u of units) {
    if (u.hp <= 0 || u.dying || u.mine) continue;
    if (dist(e.x, u.x) < UNOPPOSED_RANGE) return 1;
  }
  return UNOPPOSED_SPRINT_MULT;
}

export function fleeToPortal(e, t, dt) {
  const tx = e.portal ? e.portal.x : (e.x < CFG.baseX ? 0 : CFG.worldWidth);
  e.dir = Math.sign(tx - e.x);
  e.x += e.dir * t.speed * 1.6 * dt;
  return dist(e.x, tx) < 40;
}

export function debuffSpeedMult(e) {
  let m = 1;
  if (e.rooted > 0) m = 0.02;
  else if (e.frost > 0) m = 0.3;
  else if (e.slow > 0) m = 0.45;
  if (e.emberFrenzy > 0) m *= 1.18;
  return m;
}

export function wallAt(side, x) {
  let best = null;
  for (const w of state.walls) {
    if (!w.commissioned || w.hp <= 0 || w.side !== side) continue;
    if (side < 0 && w.x > x && w.x < CFG.baseX) { if (!best || w.x < best.x) best = w; }
    if (side > 0 && w.x < x && w.x > CFG.baseX) { if (!best || w.x > best.x) best = w; }
  }
  return best;
}

export function initEnemyAI(e) {
  if (e.aiState === undefined) {
    e.aiState = "idle";
    e.stateTimer = 0;
    e.attackWindup = 0;
  }
}

export function changeState(e, newState, duration = 0) {
  e.aiState = newState;
  e.stateTimer = duration;
}

export function swingMult(e) {
  return e.type === "emberBrute" ? 2.6 : 1;
}

export function killWall(w) {
  w.hp = 0; w.level = 0; w.commissioned = false; w.buildProgress = 0;
  spawnParticles(w.x, groundY - 30, 16, "#caa46a", 80, 80);
}

export function damageWall(wall, baseDmg, particleCount = 3) {
  const crit = applyCrit(baseDmg, CFG.critChance, CFG.critMultiplier);
  wall.hp -= crit.damage;
  wall.flash = 0.15;
  spawnParticles(wall.x, groundY - 30, particleCount, "#caa46a", 30, 30);
  if (crit.isCrit) critFloaty(wall.x, crit.damage);
  Audio.hit();
  if (wall.hp <= 0) killWall(wall);
}

export function playerCombatLift() {
  const p = state.player;
  return p ? (p.jumpH || 0) + entityWallLift(p) : 0;
}

export function wallOutsideX(w) {
  return w.x + w.side * 30;
}

export function wallInsideX(w) {
  return w.x - w.side * 48;
}
