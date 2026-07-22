import { CFG } from '../../config/config.js';
import { clamp, dist } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnParticles, floaty } from '../world/SpawnSystem.js';
import { entityWallLift } from '../../entities/Wall.js';
import { moveToward, nearestEnemy } from './AIHelpers.js';

const HEAL_RANGE = 108;
const SEEK_RANGE = 680;
const HEAL_COOLDOWN = 2.6;
const DANGER_RANGE = 155;

function targetLift(target) {
  return entityWallLift(target) + (target.jumpH || 0);
}

function bestPatient(u) {
  let best = null;
  let bestScore = -Infinity;
  const candidates = [state.player, ...state.units];

  for (const target of candidates) {
    if (!target || target.hp <= 0 || target.dying || target.hp >= target.maxHp) continue;
    const d = dist(u.x, target.x);
    if (d > SEEK_RANGE) continue;
    const missing = target.maxHp - target.hp;
    const urgency = missing / Math.max(1, target.maxHp);
    const playerPriority = target === state.player ? 18 : 0;
    const score = urgency * 320 + missing * 24 + playerPriority - d * 0.18;
    if (score > bestScore) {
      best = target;
      bestScore = score;
    }
  }
  return best;
}

function fleeFromThreat(u, threat, dt) {
  const threatSide = Math.sign(threat.x - CFG.baseX) || 1;
  const refugeX = clamp(CFG.baseX - threatSide * 190, CFG.baseX - 280, CFG.baseX + 280);
  u.healTarget = null;
  u.panic = Math.max(u.panic || 0, 0.35);
  moveToward(u, refugeX, 170, dt);
}

function performHeal(u, target) {
  target.hp = Math.min(target.maxHp, target.hp + 1);
  target.flash = Math.max(target.flash || 0, 0.12);
  if (target === state.player) target.hpShowTimer = Math.max(target.hpShowTimer || 0, 1.8);

  u.cooldown = HEAL_COOLDOWN;
  u.healFlash = 0.58;
  u.healTarget = target;
  u.dir = Math.sign(target.x - u.x) || u.dir;

  const lift = targetLift(target);
  spawnParticles(target.x, groundY - 32 - lift, 12, "#8fe8c2", 54, 76);
  spawnParticles(u.x + u.dir * 8, groundY - 34, 7, "#f5e7a1", 38, 58);
  floaty(target.x, "+1", "#8fe8c2");
  Audio.spell();
}

export function clericAI(u, dt) {
  const threat = nearestEnemy(u.x, DANGER_RANGE);
  if (threat) {
    fleeFromThreat(u, threat, dt);
    return;
  }

  const patient = bestPatient(u);
  u.healTarget = patient;
  if (patient) {
    const d = dist(u.x, patient.x);
    if (d > HEAL_RANGE) {
      moveToward(u, patient.x, 112, dt);
      return;
    }
    u.dir = Math.sign(patient.x - u.x) || u.dir;
    if (u.cooldown <= 0) performHeal(u, patient);
    return;
  }

  u.healTarget = null;
  const homeX = Number.isFinite(u.homeX) ? u.homeX : CFG.baseX - 180;
  if (dist(u.x, homeX) > 36) moveToward(u, homeX, 72, dt);
}
