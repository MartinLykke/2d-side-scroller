import { CFG } from '../../config/config.js';
import { dist } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { floaty as showFloaty } from '../world/SpawnSystem.js?v=biomeactive4';
import { entityWallLift, wallReady, wallCritical, bridgeSpan } from '../../entities/Wall.js';
import { spawnHumanBlood } from '../../util/EnemyUtils.js?v=biomeactive4';

export function floaty(x, text, color) {
  if (typeof text === "string" && text.includes("Unders")) return;
  showFloaty(x, text, color);
}

export function hasSkill(id) { return state.archerSkills.includes(id); }

export function nearestEnemy(x, range, includeFleeing = false) {
  let best = null, bd = range;
  for (const e of state.enemies) {
    if (!includeFleeing && e.fleeing) continue;
    if (e.dying || e.hp <= 0) continue;
    const d = dist(x, e.x);
    if (d < bd) { bd = d; best = e; }
  }
  for (const a of state.animals) {
    if (a.type !== "bear" || !a.alive || a.dying || a.hp <= 0) continue;
    const d = dist(x, a.x);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}

export function nearestThreatOnSide(x, range, side, includeFleeing = false) {
  let best = null, bd = range;
  for (const e of state.enemies) {
    if (!includeFleeing && e.fleeing) continue;
    if (e.dying || e.hp <= 0 || Math.sign(e.x - CFG.baseX) !== side) continue;
    const d = dist(x, e.x);
    if (d < bd) { bd = d; best = e; }
  }
  for (const a of state.animals) {
    if (a.type !== "bear" || !a.alive || a.dying || a.hp <= 0) continue;
    if (Math.sign(a.x - CFG.baseX) !== side) continue;
    const d = dist(x, a.x);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}

export function moveToward(u, tx, speed, dt) {
  if (dist(u.x, tx) > 4) { u.dir = Math.sign(tx - u.x); u.x += u.dir * speed * dt; return false; }
  return true;
}

export function sunsetApproaching() {
  const recallTime = Math.max(0, CFG.phases.day - 0.07);
  return !Game.isNight && Game.time >= recallTime && Game.time <= CFG.phases.dusk;
}

export function nearestAnimal(x, range) {
  let best = null, bd = range;
  for (const a of state.animals) {
    if (!a.alive || a.dying) continue;
    const d = dist(x, a.x);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}

export function nearestGroundCoin(x, range) {
  const BASE_COIN_ZONE = 640;
  let best = null, bd = range;
  for (const c of state.coins) {
    if (!c.settled) continue;
    if (state.player && dist(c.x, state.player.x) < 90) continue;
    if (Math.abs(c.x - CFG.baseX) < BASE_COIN_ZONE) continue;
    const d = dist(x, c.x);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function startUnitDeath(u) {
  if (u.dying) return;
  const overkill = Math.max(0, -(u.hp || 0));
  const violence = Math.min(3.8, Math.sqrt(overkill / Math.max(1, u.maxHp || 5)) * 2.35 + Math.sqrt(overkill) * 0.18);
  const lift = entityWallLift(u) + (u.grappleLiftY || 0);
  const deathDir = u.combatTarget ? Math.sign(u.x - u.combatTarget.x) || 1 : (u.knock ? Math.sign(u.knock) || 1 : (u.dir || 1));
  const heavy = u.role === "guard";
  const airborne = lift > 16 || violence > 1.4;
  u.dying = true;
  u.deathT = 0;
  u.deathDuration = (heavy ? 1.65 : 1.38) + violence * 0.22 + lift / 260;
  u.deathKind = lift > 16 ? "fallFromWall" : violence > 2.4 ? "violentThrow" : heavy ? "guardCollapse" : u.role === "archer" ? "archerCollapse" : "workerCollapse";
  u.deathDir = deathDir;
  u.deathSpin = (deathDir < 0 ? -1 : 1) * (heavy ? 0.8 : 1.05 + violence * 0.28);
  u.deathFy = -lift;
  u.deathVy = airborne ? -(heavy ? 34 : 54) - violence * (heavy ? 22 : 42) : 0;
  u.deathGravity = heavy ? 760 : 820;
  u.deathAngle = 0;
  u.deathRestAngle = deathDir * (heavy ? 1.18 : 1.48);
  u.deathAngVel = u.deathSpin * (airborne ? 3.2 + violence * 0.75 : 1.45);
  u.deathBounces = 0;
  u.deathFriction = Math.max(2, 4.7 - violence * 0.45);
  u.overkillViolence = violence;
  u.knock = (u.knock || 0) + deathDir * ((heavy ? 58 : 82) + violence * (heavy ? 34 : 62));
  u.moving = false;
  u.working = false;
  u.grapple = null;
  u.grappleLiftY = 0;
  u.onWall = false;
  u.wall = null;
  u.guardWall = null;
  u.climbingWall = false;
  u.carryLog = false;
  u.combatTarget = null;
  spawnHumanBlood(u, 1.05 + violence * 0.7 + (heavy ? 0.2 : 0), deathDir, groundY - lift - 30);
  if (violence > 1.6 || lift > 40) spawnHumanBlood(u, 0.7 + violence * 0.35, -deathDir, groundY - lift - 22);
  Game.screenShake = Math.max(Game.screenShake || 0, Math.min(0.28, 0.06 + violence * 0.055 + lift / 900));
}

export function getArcherSideCounts() {
  let left = 0, right = 0;
  for (const u of state.units) {
    if (u.role === 'archer' && u.fixedSide) {
      if (u.fixedSide === -1) left++;
      if (u.fixedSide === 1) right++;
    }
  }
  return { left, right };
}

// ── Rampart bridge crossing ──────────────────────────────────────────────
// A defender fleeing a failing or overrun outer wall crosses the elevated
// bridge straight onto the safer wall closer to the base, instead of
// climbing down to the ground and walking over. Call from a wall-bound
// unit's own AI once it decides its current wall is unsafe; returns false
// (does nothing) when no bridge exists or the inner wall isn't actually safe.
export function tryStartBridgeFlee(u, fromWall) {
  if (!fromWall || !u.onWall || (u.wallClimbT || 0) < 0.98) return false;
  const span = bridgeSpan(fromWall.side, state.walls);
  if (!span || span.outer !== fromWall || wallCritical(span.inner)) return false;
  u.bridge = {
    toWall: span.inner,
    fromX: u.x, fromY: entityWallLift(u),
    toX: span.innerX, toY: span.innerY,
    t: 0,
  };
  u.bridgeLiftY = u.bridge.fromY;
  u.wallApproach = false;
  u.climbingWall = false;
  u.shootState = null;
  u.shootTimer = 0;
  return true;
}

// Advances an in-progress bridge crossing. Returns true once the crossing is
// resolved (arrived, or aborted because the destination wall gave out) —
// callers should bail out for the rest of this frame while it returns false.
export function updateBridgeCross(u, dt, speed = 150) {
  const b = u.bridge;
  if (!b) return true;
  if (!wallReady(b.toWall)) {
    u.bridge = null;
    u.bridgeLiftY = 0;
    u.onWall = false;
    u.wall = null;
    u.wallClimbT = 0;
    return true;
  }
  const span = Math.abs(b.toX - b.fromX) || 1;
  b.t = Math.min(1, (b.t || 0) + (speed * dt) / span);
  u.x = b.fromX + (b.toX - b.fromX) * b.t;
  u.bridgeLiftY = b.fromY + (b.toY - b.fromY) * b.t;
  u.dir = Math.sign(b.toX - b.fromX) || u.dir;
  if (b.t < 1) return false;
  u.wall = b.toWall;
  u.onWall = true;
  u.wallClimbT = 1;
  u.climbingWall = false;
  u.wallApproach = false;
  u.bridge = null;
  u.bridgeLiftY = 0;
  return true;
}

export function assignFixedSide(u) {
  if (u.fixedSide) return u.fixedSide;
  const counts = getArcherSideCounts();
  if (counts.left < counts.right) {
    u.fixedSide = -1;
  } else if (counts.right < counts.left) {
    u.fixedSide = 1;
  } else {
    u.fixedSide = u.patrolDir || (Math.random() < 0.5 ? -1 : 1);
  }
  return u.fixedSide;
}
