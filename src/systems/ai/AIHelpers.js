import { CFG } from '../../config/config.js';
import { dist } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { spawnParticles, floaty as showFloaty } from '../world/SpawnSystem.js';

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
  return Game.time > 0.48 && Game.time < 0.65 && !Game.isNight;
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
    if (!c.settled || c.mine) continue;
    if (state.player && dist(c.x, state.player.x) < 90) continue;
    if (Math.abs(c.x - CFG.baseX) < BASE_COIN_ZONE) continue;
    const d = dist(x, c.x);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function startUnitDeath(u) {
  if (u.dying) return;
  u.dying = true;
  u.deathT = 0;
  u.deathDuration = u.role === "guard" ? 1.45 : 1.25;
  u.deathDir = u.combatTarget ? Math.sign(u.x - u.combatTarget.x) || 1 : (u.dir || 1);
  u.deathSpin = (u.deathDir < 0 ? -1 : 1) * (u.role === "guard" ? 1.0 : 0.85);
  u.knock = (u.knock || 0) + u.deathDir * (u.role === "guard" ? 70 : 95);
  u.moving = false;
  u.working = false;
  u.combatTarget = null;
  spawnParticles(u.x, groundY - 30, u.role === "guard" ? 12 : 8, "#7a1f1f", 70, 80);
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
