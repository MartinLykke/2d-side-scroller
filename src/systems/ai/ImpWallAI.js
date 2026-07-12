import { CFG } from '../../config/config.js';
import { dist, rand } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { state } from '../../core/state.js';
import { wallHeight, wallReady, wallRenderWidth } from '../../entities/Wall.js';
import { spawnParticles } from '../world/SpawnSystem.js';
import {
  IMP_STACK_STEP, IMP_ATTACH_RANGE, IMP_TOP_TRIGGER_PAD,
  IMP_STACK_EXTRA_SLOTS, IMP_QUEUE_SPACING, IMP_PYRAMID_BASE,
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
    imp.impStackX = ((idx % 2 === 0) ? -1 : 1) * Math.min(7, 2 + idx * 0.45);
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

function queueSlotForWall(w, idx) {
  let row = 0, rem = idx, width = IMP_PYRAMID_BASE;
  while (row < IMP_PYRAMID_BASE - 1 && rem >= width) { rem -= width; row++; width--; }
  let col = rem;
  if (row === IMP_PYRAMID_BASE - 1 && rem >= width) {
    row = 0;
    col = IMP_PYRAMID_BASE + (rem - width) + 1;
  }
  const x = wallOutsideX(w) + w.side * (IMP_ATTACH_RANGE + 16 + (col + row * 0.5) * IMP_QUEUE_SPACING);
  return { x, fy: -row * IMP_STACK_STEP };
}

export function moveImpToQueueSlot(e, t, dt, wall, idx) {
  const slot = queueSlotForWall(wall, idx);
  const dx = slot.x - e.x;
  if (Math.abs(dx) > 2) {
    e.dir = Math.sign(dx);
    e.x += e.dir * Math.min(t.speed * 0.85 * dt, Math.abs(dx));
  } else {
    e.x = slot.x;
    e.dir = -wall.side;
  }
  const nearSlot = Math.abs(slot.x - e.x) < IMP_QUEUE_SPACING;
  const targetFy = nearSlot ? slot.fy : Math.max(e.fy || 0, slot.fy);
  const dy = targetFy - (e.fy || 0);
  if (Math.abs(dy) > 1) {
    const rate = dy > 0 ? 260 : 110;
    e.fy = (e.fy || 0) + Math.sign(dy) * Math.min(Math.abs(dy), rate * dt);
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

  const wallHasTopImp = !!wallTopImpForWall(wall, e);
  if (isTop && stackTallEnough && !wallHasTopImp) setImpState(e, "climbOver");

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
  if (e.attackCd <= 0) {
    e.attackCd = 1.15;
    e.attackAnim = 0.18;
    damageWall(wall, Math.max(1, t.dmg * 0.12), 2);
  }
  return true;
}
