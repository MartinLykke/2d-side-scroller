import { CFG } from '../../config/config.js';
import { clamp, dist, rand } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnParticles } from '../world/SpawnSystem.js?v=biomeboss1';
import { killEnemy } from '../combat/Combat.js?v=biomeboss1';
import { killEnemyWithAnimation, spawnImpBlood } from '../../util/EnemyUtils.js?v=biomeboss1';
import { wallHeight, wallStandX, wallBackDir } from '../../entities/Wall.js';
import { permanentDamageMultiplier } from '../infrastructure/RoguelikeSystem.js';
import { addSkillPoints } from '../economy/SkillSystem.js';
import { floaty, nearestEnemy, moveToward, sunsetApproaching } from './AIHelpers.js?v=biomeboss1';

function grantGuardXP(u) {
  u.xp = (u.xp || 0) + 1;
  const xpNeeded = (u.level || 1) * 3;
  if (u.xp < xpNeeded) return;
  u.xp -= xpNeeded;
  u.level = (u.level || 1) + 1;
  addSkillPoints("guard", 1);
  floaty(u.x, `Niv.${u.level}! (+1ep)`, "#f2c14e");
  spawnParticles(u.x, groundY - 30, 8, "#f2c14e", 50, 80);
}

function lastStandActive() {
  const base = state.base;
  return !!(base && Game.isNight && base.hp > 0 && base.maxHp > 0 && base.hp / base.maxHp <= (CFG.lastStandBaseHpFrac || 0.34));
}

function guardDamageBonus(u) {
  return ((u.rallyBoostT || 0) > 0 ? 1 : 0) + (lastStandActive() ? 1 : 0);
}

function guardDamageEnemy(u, foe, dmg, cooldown = 0.8) {
  if (!foe || foe.hp <= 0 || u.cooldown > 0) return false;
  foe.hp -= (dmg + guardDamageBonus(u)) * permanentDamageMultiplier();
  foe.flash = 0.14;
  spawnImpBlood(foe, 0.9 + dmg * 0.3);
  u.cooldown = cooldown;
  u.strike = 0.25;
  foe.combatTarget = u;
  if (foe.type === "imp" && (foe.aiState === "climbOver" || foe.wallTopWall || foe.breachedWall || u.aiState === "combat")) foe.aiState = "combat";
  Audio.hit();
  spawnParticles(foe.x, groundY - 24, 4, "#8a2a4a", 40, 60);
  if (foe.hp <= 0) {
    grantGuardXP(u);
    killEnemy(foe);
  }
  return true;
}

function guardImpaleWallImp(u, imp, wall) {
  if (!state.guardSkills.includes("impale_wall_climber")) return false;
  if (!u.onWall || u.wall !== wall || (u.impaleCd || 0) > 0) return false;
  if (!imp || imp.type !== "imp" || imp.hp <= 0 || imp.dying) return false;
  if (!(imp.wallTopWall === wall || imp.aiState === "climbOver")) return false;

  u.impaleCd = 5.5;
  u.cooldown = Math.max(u.cooldown, 0.9);
  u.strike = 0.45;
  u.dir = Math.sign(imp.x - u.x) || u.dir;

  const throwDir = Math.sign(imp.x - u.x) || -wall.side || u.dir || 1;
  imp.hp = -18;
  imp.fy = -Math.max(30, wallHeight(wall) - 10);
  imp.wallTopWall = null;
  imp.stackWallRef = null;
  imp.combatTarget = u;
  killEnemyWithAnimation(imp, throwDir);
  imp.deathKind = "impFallBack";
  imp.deathDuration = Math.max(imp.deathDuration || 0, 1.75);
  imp.knock = throwDir * 560;
  imp.deathVy = 90;
  imp.deathSpin = throwDir * 7.2;
  imp.deathGravity = 760;
  imp.deathFriction = 2.4;
  spawnImpBlood(imp, 4.2, groundY + (imp.fy || 0) - 18);
  spawnParticles(imp.x, groundY + (imp.fy || 0) - 18, 14, "#5a0710", 130, 120);
  Audio.hit();
  return true;
}

function guardWallPost(u, w) {
  const guards = state.units.filter(gu => gu.role === "guard");
  const idx = Math.max(0, guards.indexOf(u));
  const spread = Math.min(52, 24 + w.level * 8);
  return w.x + ((idx % 5) - 2) * (spread / 4);
}

function guardWallCapacity(w) {
  return Math.max(1, Math.min(5, w.level + 1));
}

function guardsAssignedToWall(w) {
  return state.units.filter(gu =>
    gu.role === "guard" &&
    gu.hp > 0 &&
    !gu.dying &&
    (gu.guardWall === w || gu.wall === w || (gu.combatTarget && gu.combatTarget.stackWallRef === w))
  );
}

function guardWallSlot(u, w) {
  const assigned = guardsAssignedToWall(w);
  if (!assigned.includes(u)) assigned.push(u);
  assigned.sort((a, b) => state.units.indexOf(a) - state.units.indexOf(b));
  return assigned.indexOf(u);
}

function guardHasWallSlot(u, w) {
  return guardWallSlot(u, w) < guardWallCapacity(w);
}

function guardWallTopX(u, w) {
  const cap = guardWallCapacity(w);
  const slot = Math.max(0, Math.min(cap - 1, guardWallSlot(u, w)));
  const spacing = Math.min(16, Math.max(10, 58 / cap));
  return w.x + (slot - (cap - 1) / 2) * spacing;
}

function guardWallStandX(u, w) {
  const cap = guardWallCapacity(w);
  const slot = Math.max(0, Math.min(cap - 1, guardWallSlot(u, w)));
  return wallStandX(w, slot) + wallBackDir(w) * 6;
}

function guardDuelPositions(u, w) {
  const center = u.guardDuelCenterX ?? guardWallTopX(u, w);
  u.guardDuelCenterX = center;
  return {
    guardX: center - w.side * 11,
    impX: center + w.side * 11
  };
}

function clearGuardDuel(u) {
  u.guardDuelCenterX = null;
  u.guardDuelX = null;
  if (u.combatTarget && u.combatTarget.combatTarget === u) u.combatTarget.combatTarget = null;
}

function updateGuardWallClimb(u, w, wantsTop, dt) {
  u.guardWall = w;
  u.wall = w;
  const target = wantsTop ? 1 : 0;
  const speed = wantsTop ? 0.58 : 0.72;
  const climbBefore = u.wallClimbT || 0;
  u.wallClimbT = clamp((u.wallClimbT || 0) + Math.sign(target - (u.wallClimbT || 0)) * speed * dt, 0, 1);
  if (Math.abs((u.wallClimbT || 0) - target) < 0.04) u.wallClimbT = target;
  u.onWall = u.wallClimbT >= 0.98;
  u.climbingWall = Math.abs((u.wallClimbT || 0) - climbBefore) > 0.001 && !u.onWall;
  if ((u.wallClimbT || 0) <= 0.02 || u.onWall) u.climbingWall = false;
  if (u.climbingWall) u.climbAnim = (u.climbAnim || 0) + dt * 8;
}

function clearGuardWall(u, dt) {
  clearGuardDuel(u);
  if ((u.wallClimbT || 0) > 0) {
    if (!u.wall) {
      u.wallClimbT = 0;
      u.onWall = false;
      u.guardWall = null;
      u.climbingWall = false;
      return true;
    }
    updateGuardWallClimb(u, u.wall, false, dt);
    return false;
  }
  u.onWall = false;
  u.wall = null;
  u.guardWall = null;
  u.climbingWall = false;
  return true;
}

function nearestTopImpForWall(w, guard = null) {
  let best = null, bs = -1;
  for (const e of state.enemies) {
    if (e.type !== "imp" || e.fleeing || e.dying || e.hp <= 0) continue;
    if (e.stackWallRef !== w && e.wallTopWall !== w) continue;
    if (guard && e.combatTarget && e.combatTarget !== guard) continue;
    let score = e.aiState === "combat" ? 260 : e.aiState === "climbOver" ? 240 : e.aiState === "stacking" ? 120 : 0;
    if (guard && guard.combatTarget === e) score += 400;
    score += e.impIndex || 0;
    if (score > bs) { bs = score; best = e; }
  }
  return best;
}

function holdWallDuel(u, imp, wall, dt) {
  const duel = guardDuelPositions(u, wall);
  u.guardDuelX = duel.guardX;
  u.guardPostX = u.guardDuelCenterX;
  u.combatTarget = imp;
  imp.combatTarget = u;
  imp.duelGuardX = duel.guardX;
  imp.duelImpX = duel.impX;
  imp.duelWall = wall;
  if (dist(u.x, duel.guardX) > 2) moveToward(u, duel.guardX, 42, dt);
  u.dir = Math.sign(imp.x - u.x) || u.dir;
  imp.dir = Math.sign(u.x - imp.x) || imp.dir;
}

function densestGroundImpTarget(u) {
  let best = null, bestScore = -1;
  for (const e of state.enemies) {
    if (e.type !== "imp" || e.fleeing || e.dying || e.hp <= 0 || e.wallTopWall || e.aiState === "climbOver" || e.aiState === "stacking") continue;
    let nearby = 0;
    for (const other of state.enemies) {
      if (other.type !== "imp" || other.fleeing || other.dying || other.hp <= 0 || other.wallTopWall) continue;
      if (dist(e.x, other.x) < 90) nearby++;
    }
    const score = nearby * 100 - dist(u.x, e.x);
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best;
}

function nearestGuardWall(side) {
  let best = null, bd = -1;
  for (const w of state.walls) {
    if (!w.commissioned || w.hp <= 0 || w.buildProgress < 1 || w.side !== side) continue;
    const d = Math.abs(w.x - CFG.baseX);
    if (d > bd) { bd = d; best = w; }
  }
  return best;
}

function guardThreatScore(u, e) {
  if (e.fleeing || e.dying) return -1;
  let score = 260 - dist(u.x, e.x);
  if (e.type === "imp") {
    if (e.aiState === "combat") score += 260;
    if (e.wallTopWall) score += 250;
    if (e.aiState === "vaulting" || e.breachedWall) score += 230;
    if (e.aiState === "climbOver") score += 210;
    if (e.aiState === "stacking") score += 120 + (e.impIndex || 0) * 8;
  }
  if (Math.sign(e.x - CFG.baseX) === Math.sign(u.x - CFG.baseX)) score += 30;
  return score;
}

function chooseGuardTarget(u) {
  if (u.combatTarget && state.enemies.includes(u.combatTarget) && !u.combatTarget.fleeing && u.combatTarget.hp > 0) {
    return u.combatTarget;
  }
  let best = null, bs = -1;
  for (const e of state.enemies) {
    const score = guardThreatScore(u, e);
    if (score > bs) { bs = score; best = e; }
  }
  return bs > 0 ? best : null;
}

export function guardAI(u, dt) {
  if (!u.aiState) u.aiState = "patrol";

  if (u.wall && u.onWall && guardHasWallSlot(u, u.wall)) {
    const wall = u.wall;
    const postX = guardWallStandX(u, wall);
    u.aiState = "guardWall";
    updateGuardWallClimb(u, wall, true, dt);
    const topThreat = nearestTopImpForWall(wall, u);
    if (topThreat) {
      holdWallDuel(u, topThreat, wall, dt);
      if (dist(u.x, topThreat.x) < 28) {
        if (guardImpaleWallImp(u, topThreat, wall)) return;
        guardDamageEnemy(u, topThreat, topThreat.aiState === "climbOver" ? 2 : 1, 0.85);
      }
    } else {
      clearGuardDuel(u);
      if (dist(u.x, postX) > 3) moveToward(u, postX, 46, dt);
      u.combatTarget = null;
    }
    return;
  }

  const target = chooseGuardTarget(u);
  if (target) {
    u.combatTarget = target;
    u.dir = Math.sign(target.x - u.x) || u.dir;

    const targetWall = target.stackWallRef || target.wallTopWall;
    if (targetWall && target.type === "imp" && (target.aiState === "stacking" || target.aiState === "climbOver" || target.wallTopWall)) {
      const slot = guardWallSlot(u, targetWall);
      const wantsTop = slot < guardWallCapacity(targetWall);
      if (!wantsTop) {
        const groundTarget = densestGroundImpTarget(u) || target;
        if (!clearGuardWall(u, dt)) return;
        u.combatTarget = groundTarget;
        const d = dist(u.x, groundTarget.x);
        u.dir = Math.sign(groundTarget.x - u.x) || u.dir;
        if (d > 18) moveToward(u, groundTarget.x, 118, dt);
        else guardDamageEnemy(u, groundTarget, 2, 0.8);
        return;
      }
      const postX = guardWallTopX(u, targetWall);
      if (dist(u.x, postX) > 8) {
        u.aiState = "defendWall";
        updateGuardWallClimb(u, targetWall, false, dt);
        moveToward(u, postX, 112, dt);
        return;
      }
      u.aiState = "defendWall";
      updateGuardWallClimb(u, targetWall, true, dt);
      if (u.onWall && dist(u.x, target.x) < 24 && (target.aiState === "climbOver" || target.wallTopWall || dist(target.x, targetWall.x) < 38)) {
        holdWallDuel(u, target, targetWall, dt);
        if (guardImpaleWallImp(u, target, targetWall)) return;
        const dmg = state.guardSkills.includes("impale_wall_climber") && target.aiState === "climbOver" ? 5 : 2;
        guardDamageEnemy(u, target, dmg, 0.75);
      }
      return;
    }

    if (!clearGuardWall(u, dt)) return;
    const d = dist(u.x, target.x);
    if (d > 18) {
      u.aiState = "engage";
      moveToward(u, target.x, 118, dt);
      return;
    }

    u.aiState = "combat";
    if (target.type === "imp") target.aiState = "combat";
    target.combatTarget = u;
    guardDamageEnemy(u, target, target.type === "imp" ? 2 : 3, target.type === "imp" ? 0.8 : 0.7);
    return;
  }

  clearGuardDuel(u);
  u.combatTarget = null;

  const lb = state.legendaryBoss;
  if (lb && !lb.fleeing) {
    if (!clearGuardWall(u, dt)) return;
    u.dir = Math.sign(lb.x - u.x) || u.dir;
    if (dist(u.x, lb.x) > 34) moveToward(u, lb.x, 105, dt);
    else guardDamageEnemy(u, lb, 4, 0.65);
    return;
  }

  const side = u.x < CFG.baseX ? -1 : 1;
  const wall = nearestGuardWall(side) || nearestGuardWall(-side);
  if (wall && (Game.isNight || sunsetApproaching())) {
    const topThreat = nearestTopImpForWall(wall, u);
    const slot = guardWallSlot(u, wall);
    const wantsTop = slot < guardWallCapacity(wall);
    if (!wantsTop) {
      const groundTarget = densestGroundImpTarget(u);
      if (groundTarget) {
        if (!clearGuardWall(u, dt)) return;
        u.aiState = "groundDefense";
        u.combatTarget = groundTarget;
        const d = dist(u.x, groundTarget.x);
        u.dir = Math.sign(groundTarget.x - u.x) || u.dir;
        if (d > 18) moveToward(u, groundTarget.x, 112, dt);
        else guardDamageEnemy(u, groundTarget, 2, 0.8);
        return;
      }
      u.aiState = "groundDefense";
      u.onWall = false;
      u.wall = null;
      u.guardWall = null;
      const holdX = CFG.baseX + (u.patrolDir || side || 1) * 130;
      moveToward(u, holdX, 62, dt);
      return;
    }
    const postX = topThreat ? guardWallTopX(u, wall) : guardWallStandX(u, wall);
    if (dist(u.x, postX) > 8) {
      u.aiState = "moveToWall";
      updateGuardWallClimb(u, wall, false, dt);
      moveToward(u, postX, 86, dt);
      return;
    }
    u.aiState = "guardWall";
    updateGuardWallClimb(u, wall, true, dt);
    if (u.onWall && topThreat && dist(u.x, topThreat.x) < 24) {
      holdWallDuel(u, topThreat, wall, dt);
      guardDamageEnemy(u, topThreat, topThreat.aiState === "climbOver" ? 2 : 1, 0.85);
    }
    return;
  }

  if (!clearGuardWall(u, dt)) return;
  u.aiState = "patrol";
  const patrolL = CFG.baseX - 550, patrolR = CFG.baseX + 550;
  if (!u.patrolTarget || dist(u.x, u.patrolTarget) < 20)
    u.patrolTarget = clamp(CFG.baseX + (Math.random() < 0.5 ? -1 : 1) * rand(60, 450), patrolL, patrolR);
  moveToward(u, u.patrolTarget, 62, dt);
}
