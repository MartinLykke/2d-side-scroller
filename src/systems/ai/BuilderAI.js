import { CFG } from '../../config/config.js';
import { clamp, dist, rand } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnParticles } from '../world/SpawnSystem.js';
import { nearestChoppableTree, chopTree, nearestLog, deliverLog } from '../world/ForestSystem.js';
import { nearestEnemy, moveToward, sunsetApproaching } from './AIHelpers.js';

const BUILDER_TASK_SPEED = 200;

export function builderAI(u, dt) {
  u.working = false;
  for (const e of state.enemies) {
    if (e.type !== "imp" || e.hp <= 0 || e.dying || e.fleeing) continue;
    if (dist(u.x, e.x) < 260) { u.panic = Math.max(u.panic || 0, 0.6); break; }
  }
  for (const a of state.animals) {
    if (a.type !== "bear" || !a.alive || a.dying || a.hp <= 0) continue;
    const d = dist(u.x, a.x);
    if (d < 300 || (a.state === "chase" && d < 480)) {
      u.panic = Math.max(u.panic || 0, 0.6);
      u.bearThreatX = a.x;
      break;
    }
  }
  if (u.panic <= 0) u.bearThreatX = null;
  if (u.panic > 0) {
    if (u.pendingLog) { u.pendingLog.claimedBy = null; u.pendingLog = null; }
    if (u.carryLog) {
      u.carryLog.x = u.x;
      u.carryLog.lying = true;
      u.carryLog.claimedBy = null;
      u.carryLog.carriedBy = null;
      u.carryLog = null;
    }
    const bearOnHeels = u.bearThreatX != null && dist(u.x, u.bearThreatX) < 480;
    const fleeTo = bearOnHeels
      ? clamp(u.x + Math.sign(u.x - u.bearThreatX || 1) * 600, 200, CFG.worldWidth - 200)
      : CFG.baseX;
    u.dir = Math.sign(fleeTo - u.x) || u.dir;
    moveToward(u, fleeTo, 220, dt);
    return;
  }
  if (u.carryLog) {
    if (moveToward(u, CFG.baseX, BUILDER_TASK_SPEED, dt)) {
      deliverLog(u.carryLog);
      u.carryLog = null;
    }
    return;
  }

  let target = null, td = 1e9;
  for (const w of state.walls) {
    if (!w.commissioned) continue;
    if (!(w.buildProgress < 1 || w.hp < w.maxHp)) continue;
    const d = dist(u.x, w.x); if (d < td) { td = d; target = w; }
  }
  if (Game.isNight && target) {
    if (nearestEnemy(target.x, 220)) u.panic = 0.6;
  }
  if (u.panic > 0) {
    if (u.pendingLog) { u.pendingLog.claimedBy = null; u.pendingLog = null; }
    moveToward(u, CFG.baseX, 120, dt); return;
  }
  if (target) {
    if (moveToward(u, target.x, BUILDER_TASK_SPEED, dt)) {
      u.working = true;
      u.workTimer += dt;
      if (u.workTimer > 0.25) {
        u.workTimer = 0;
        if (target.buildProgress < 1) {
          target.buildProgress = clamp(target.buildProgress + 0.06, 0, 1);
          target.hp = target.maxHp * target.buildProgress;
          spawnParticles(target.x + rand(-8, 8), groundY - 20, 2, "#caa46a", 20, 30);
          Audio.build();
        } else if (target.hp < target.maxHp) {
          target.hp = clamp(target.hp + target.maxHp * 0.04, 0, target.maxHp);
          spawnParticles(target.x, groundY - 30, 1, "#caa46a", 15, 25);
        }
      }
    }
    return;
  }

  if (u.pendingLog && (u.pendingLog.chopped || u.pendingLog.carriedBy || u.pendingLog.claimedBy !== u)) u.pendingLog = null;
  if (u.pendingLog) {
    const log = u.pendingLog;
    if (moveToward(u, log.x, BUILDER_TASK_SPEED, dt)) {
      log.claimedBy = null;
      log.carriedBy = u;
      log.lying = false;
      u.carryLog = log; u.pendingLog = null;
    }
    return;
  }
  const awayFromBears = (x) => {
    for (const a of state.animals) {
      if (a.type !== "bear" || !a.alive || a.dying || a.hp <= 0) continue;
      if (dist(x, a.x) < 380) return false;
    }
    return true;
  };
  const freeLog = nearestLog(u.x, awayFromBears);
  if (freeLog) { freeLog.claimedBy = u; u.pendingLog = freeLog; return; }

  const tree = nearestChoppableTree(u.x, awayFromBears);
  if (Game.isNight && tree) {
    if (nearestEnemy(tree.x, 220)) u.panic = 0.6;
  }
  if (u.panic > 0) { moveToward(u, CFG.baseX, 120, dt); return; }

  if (sunsetApproaching() && !tree) {
    if (dist(u.x, CFG.baseX) > 180) { moveToward(u, CFG.baseX, 120, dt); return; }
  }
  if (!tree) {
    if (dist(u.x, u.targetX) < 8 || Math.random() < 0.004) u.targetX = CFG.baseX + rand(-160, 160);
    moveToward(u, u.targetX, 30, dt); return;
  }
  if (moveToward(u, tree.x, BUILDER_TASK_SPEED, dt)) {
    u.working = true;
    chopTree(tree, dt, u);
  } else {
    tree.beingChopped = false;
  }
}
