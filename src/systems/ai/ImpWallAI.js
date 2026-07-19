import { CFG } from '../../config/config.js';
import { dist, rand } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { state } from '../../core/state.js';
import { wallHeight, wallReady, wallRenderWidth } from '../../entities/Wall.js';
import { spawnParticles } from '../world/SpawnSystem.js';
import {
  IMP_STACK_STEP, IMP_ATTACH_RANGE, IMP_TOP_TRIGGER_PAD,
  IMP_STACK_EXTRA_SLOTS,
  IMP_POUNCE_WALL_LOCKOUT, WALL_DUEL_GAP,
  nextImpStackSequence, mix, wallOutsideX, wallInsideX,
  changeState, damageWall, wallAt, unopposedSprintMult
} from './EnemyShared.js';
import { topDefendersForWall, nearestTopDefenderForWall, wallTopImpForWall, nearestGroundDefenderForImp } from './EnemyTargeting.js';
import { updateImpCombat, startImpVault, clearImpDuel } from './ImpCombatAI.js';

export function setImpState(e, next) {
  if (e.aiState !== next) changeState(e, next, 0);
}

export function breakImpStack(e) {
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

export function markImpBreachedWall(e, wall = null) {
  e.breachedWall = true;
  e.breachedWallRef = wall || null;
}

export function clearImpWallBreach(e) {
  e.breachedWall = false;
  e.breachedWallRef = null;
}

export function impWallBreachBypassesWall(e, wall) {
  if (!e.breachedWall) return false;
  if (e.breachedWallRef && wall && wall !== e.breachedWallRef) {
    clearImpWallBreach(e);
    return false;
  }
  return true;
}

export function clearImpStackDrop(e) {
  e.leftStack = false;
  e.hasLeftStack = false;
  e.leftStackWall = null;
}

export function impStackDropBypassesWall(e, wall) {
  if (!e.leftStack) return false;
  if (e.leftStackWall && wall && wall !== e.leftStackWall && e.hasLeftStack) {
    clearImpStackDrop(e);
    return false;
  }
  return true;
}

export function impPounceBlockedByWall(e, target) {
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

export function impPlayerBlockedByWall(e, player) {
  const wall = wallAt(e.x < CFG.baseX ? -1 : 1, e.x);
  if (!wall || impWallBreachBypassesWall(e, wall)) return false;
  const half = Math.max(24, wallRenderWidth(wall) / 2);
  const playerOutsideWall = (player.x - wall.x) * wall.side > half + 6;
  return !playerOutsideWall;
}

export function impDefenderBlockedByWall(e, defender) {
  const wall = wallAt(e.x < CFG.baseX ? -1 : 1, e.x);
  if (!wall || impWallBreachBypassesWall(e, wall)) return false;
  const half = Math.max(24, wallRenderWidth(wall) / 2);
  const defenderOutsideWall = (defender.x - wall.x) * wall.side > half + 6;
  return !defenderOutsideWall;
}

export function impStackForWall(w) {
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
    const seed = (imp.stackJoinOrder || 0) * 7.13;
    imp.impStackX = ((idx % 2 === 0) ? -1 : 1) * Math.min(8, 2.5 + idx * 0.5) + Math.sin(seed) * 2;
  });
  return stack;
}

export function impStackCapacity(w) {
  const neededForWallTop = Math.ceil(Math.max(1, wallHeight(w) - IMP_TOP_TRIGGER_PAD) / IMP_STACK_STEP);
  return Math.max(2, neededForWallTop + IMP_STACK_EXTRA_SLOTS);
}

export function impQueueForWall(w) {
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

export function moveImpToQueueSlot(e, t, dt, wall, idx) {
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

export function sendImpToStackQueue(e, w) {
  if (e.queueWallRef !== w) {
    e.queueWallRef = w;
    e.queueJoinOrder = nextImpStackSequence();
  }
  e.stackWallRef = null;
  e.impIndex = undefined;
  e.stackPos = undefined;
  e.impStackY = 0;
  setImpState(e, "stackQueue");
}

export function assignImpToStack(e, w) {
  if (e.stackWallRef !== w) {
    e.stackWallRef = w;
    e.stackJoinOrder = nextImpStackSequence();
  }
  setImpState(e, "stacking");
}

export function updateImpWall(e, t, dt) {
  const side = e.x < CFG.baseX ? -1 : 1;
  const wall = wallAt(side, e.x);
  const wallBypassed = impWallBreachBypassesWall(e, wall);
  if (!wall || wallBypassed) {
    breakImpStack(e);
    setImpState(e, "advance");
    return false;
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
    e.queueWallRef = null;
    e.queueIndex = undefined;
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
      if (topDefendersForWall(wall).length > 0) {
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
    damageWall(wall, Math.max(1, t.dmg * 0.12), 2);
  }
  return true;
}
