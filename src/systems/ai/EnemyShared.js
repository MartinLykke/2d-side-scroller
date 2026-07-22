import { clamp, lerp, dist } from '../../util/math.js';
import { state } from '../../core/state.js';
import { entityWallLift } from '../../entities/Wall.js';

// Small helpers shared between the boss AI and the enemy targeting code.
// EnemyAI.js keeps its own copies of the wall/stack helpers it needs.

const APPROACH_SLOW_RANGE = 260;
const APPROACH_FAR_MULT = 2.0;
const APPROACH_NEAR_MULT = 0.55;

const UNOPPOSED_RANGE = 260;
const UNOPPOSED_SPRINT_MULT = 2.4;

// Enemies close fast from far away and ease off as they near the base, so a
// charge reads as a deliberate approach rather than a straight-line sprint.
export function approachSpeedMult(distToBase) {
  if (distToBase >= APPROACH_SLOW_RANGE) return APPROACH_FAR_MULT;
  return lerp(APPROACH_NEAR_MULT, APPROACH_FAR_MULT, clamp(distToBase / APPROACH_SLOW_RANGE, 0, 1));
}

// With nobody defending nearby, an enemy breaks into a full sprint.
export function unopposedSprintMult(e) {
  const { player, units } = state;
  if (dist(e.x, player.x) < UNOPPOSED_RANGE) return 1;
  for (const u of units) {
    if (u.hp <= 0 || u.dying) continue;
    if (dist(e.x, u.x) < UNOPPOSED_RANGE) return 1;
  }
  return UNOPPOSED_SPRINT_MULT;
}

// How high off the ground the player currently is (jump + wall standing),
// used to decide whether a ground attack can actually reach them.
export function playerCombatLift() {
  const p = state.player;
  return p ? (p.jumpH || 0) + entityWallLift(p) : 0;
}
