import { CFG } from '../../config/config.js';
import { dist, rand, applyCrit } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnParticles, floaty, critFloaty } from '../world/SpawnSystem.js';
import { meleeHitPlayer } from '../combat/PlayerCombat.js?v=biomeweapons1';
import { wallHeight } from '../../entities/Wall.js';
import {
  mix, changeState, wallAt, wallInsideX, playerCombatLift,
  WALL_DUEL_GAP, unopposedSprintMult
} from './EnemyShared.js';
import {
  setImpState, breakImpStack, markImpBreachedWall,
  impPounceBlockedByWall, impPlayerBlockedByWall, impDefenderBlockedByWall,
  impWallBreachBypassesWall
} from './ImpWallAI.js';
import { topDefendersForWall, nearestTopDefenderForWall, nearestGroundDefenderForImp } from './EnemyTargeting.js';

export function clearImpDuel(e) {
  if (e.combatTarget && e.combatTarget.combatTarget === e) e.combatTarget.combatTarget = null;
  e.duelGuardX = null;
  e.duelImpX = null;
  e.duelWall = null;
}

function claimWallDuel(e, defender, wall) {
  const center = defender.guardDuelCenterX ?? defender.guardPostX ?? defender.archerPostX ?? defender.x;
  const defenderX = center - wall.side * (WALL_DUEL_GAP * 0.5);
  const impX = center + wall.side * (WALL_DUEL_GAP * 0.5);
  defender.guardDuelCenterX = center;
  defender.guardDuelX = defenderX;
  defender.combatTarget = e;
  e.combatTarget = defender;
  e.duelGuardX = defenderX;
  e.duelImpX = impX;
  e.duelWall = wall;
  return { guardX: defenderX, impX };
}

export function startImpVault(e, w) {
  clearImpDuel(e);
  breakImpStack(e);
  e.wallTopWall = null;
  e.vaultWall = w;
  e.vaultT = 0;
  e.vaultStartX = e.x;
  e.vaultStartY = e.fy || -wallHeight(w);
  setImpState(e, "vaulting");
}

function chooseImpAttack(e, target, d) {
  const canPounce = !impPounceBlockedByWall(e, target);
  if (canPounce && d > 38 && d < 118 && Math.random() < 0.45) return "pounce";
  if (d > 20 && d < 52 && Math.random() < 0.34) return "tail";
  if (d < 34) return "claw";
  return canPounce ? "pounce" : null;
}

function beginImpAttack(e, targetKind, target, kind) {
  if (e.attackCd > 0 || e.aiState === "recovery" || e.aiState === "impAttack") return false;
  if (!kind || (kind === "pounce" && impPounceBlockedByWall(e, target))) return false;
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

export function updateImpAttack(e, t, dt) {
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

export function updateImpPlayerCombat(e, t, dt) {
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
    const attackKind = chooseImpAttack(e, player, d);
    if (beginImpAttack(e, "player", player, attackKind)) return true;
  }
  if (d > 27) {
    const sprint = 1.6 + 1.6 * Math.max(0, 1 - d / 240);
    e.x += e.dir * t.speed * sprint * dt;
    e.anim += dt * 4;
    if (Math.random() < 0.3) spawnParticles(e.x - e.dir * 8, groundY - 4, 1, "#6b5a45", 20, 26);
    return true;
  }
  return true;
}

export function updateImpCombat(e, t, dt) {
  let defender = e.combatTarget;
  if (e.wallTopWall && (!defender || defender.hp <= 0 || !state.units.includes(defender) || !defender.onWall || defender.wall !== e.wallTopWall || (defender.combatTarget && defender.combatTarget !== e))) {
    clearImpDuel(e);
    defender = nearestTopDefenderForWall(e.wallTopWall, e.x, e);
    e.combatTarget = defender;
  }
  if (e.wallTopWall && !defender) {
    if (topDefendersForWall(e.wallTopWall).length === 0) startImpVault(e, e.wallTopWall);
    else {
      e.fy = -wallHeight(e.wallTopWall);
      const waitX = e.wallTopWall.x + e.wallTopWall.side * 20;
      e.dir = -e.wallTopWall.side;
      if (dist(e.x, waitX) > 3) e.x += Math.sign(waitX - e.x) * Math.min(t.speed * 0.35 * dt, dist(e.x, waitX));
    }
    return true;
  }
  if (!defender || defender.hp <= 0 || !state.units.includes(defender)) {
    defender = nearestGroundDefenderForImp(e, e.breachedWall ? 260 : 140);
    e.combatTarget = defender;
  }
  if (!defender) {
    setImpState(e, e.breachedWall ? "vaulting" : "advance");
    return false;
  }
  if (impDefenderBlockedByWall(e, defender)) {
    e.combatTarget = null;
    setImpState(e, e.breachedWall ? "vaulting" : "advance");
    return false;
  }
  if (defender.role !== "guard" && defender.role !== "archer" && dist(e.x, defender.x) > 260) {
    e.combatTarget = null;
    setImpState(e, e.breachedWall ? "vaulting" : "advance");
    return false;
  }

  let targetX = defender.x;
  if (e.wallTopWall) {
    e.fy = -wallHeight(e.wallTopWall);
    const duel = claimWallDuel(e, defender, e.wallTopWall);
    targetX = duel.impX;
    defender.x += Math.sign(duel.guardX - defender.x) * Math.min(42 * dt, Math.abs(duel.guardX - defender.x));
    defender.dir = Math.sign(e.x - defender.x) || defender.dir;
  }
  e.dir = Math.sign((e.wallTopWall ? (e.duelGuardX ?? defender.x) : defender.x) - e.x) || e.dir;
  const d = dist(e.x, e.wallTopWall ? (e.duelGuardX ?? defender.x) : defender.x);
  if (d < 112 && e.attackCd <= 0) {
    const attackKind = chooseImpAttack(e, defender, d);
    if (beginImpAttack(e, "guard", defender, attackKind)) return true;
  }
  if (e.wallTopWall && dist(e.x, targetX) > 2) {
    e.x += Math.sign(targetX - e.x) * Math.min(t.speed * 0.55 * dt, dist(e.x, targetX));
    return true;
  }
  if (!e.wallTopWall && d > 22) {
    e.x += e.dir * t.speed * 2.6 * dt;
    e.anim += dt * 4;
    if (Math.random() < 0.3) spawnParticles(e.x - e.dir * 8, groundY - 4, 1, "#6b5a45", 20, 26);
    return true;
  }

  setImpState(e, "combat");
  if (defender.role === "guard" || defender.role === "archer") {
    defender.aiState = "combat";
    defender.combatTarget = e;
  } else {
    defender.panic = Math.max(defender.panic || 0, 0.6);
  }
  return true;
}

export function impAttackGuard(e, t, guard) {
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

export function updateThrownImp(e, t, dt) {
  e.thrownT = Math.min(1, (e.thrownT || 0) + dt * 1.05);
  e.x = mix(e.thrownStartX, e.thrownEndX, e.thrownT);
  e.fy = mix(e.thrownStartY || 0, 0, e.thrownT) - Math.sin(e.thrownT * Math.PI) * (e.thrownPeak || 90);
  e.dir = Math.sign(e.thrownEndX - e.thrownStartX) || e.dir;
  if (Math.random() < 0.3) spawnParticles(e.x, groundY + e.fy, 1, "#6b5a45", 14, 20);
  if (e.thrownT >= 1) {
    e.fy = 0;
    markImpBreachedWall(e, e.thrownWall);
    e.thrownWall = null;
    spawnParticles(e.x, groundY - 6, 6, "#6b5a45", 40, 30);
    changeState(e, "recovery", 0.4);
  }
  return true;
}

export function updateImpVault(e, t, dt) {
  const w = e.vaultWall;
  if (w && topDefendersForWall(w).length > 0) {
    e.wallTopWall = w;
    e.vaultWall = null;
    e.combatTarget = nearestTopDefenderForWall(w, e.x, e);
    setImpState(e, "combat");
    return updateImpCombat(e, t, dt);
  }
  if (w) markImpBreachedWall(e, w);
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
  if ((e.fy || 0) >= 0) {
    const nextWall = wallAt(e.x < CFG.baseX ? -1 : 1, e.x);
    if (nextWall && !impWallBreachBypassesWall(e, nextWall)) {
      setImpState(e, "advance");
      return false;
    }
  }
  const defender = nearestGroundDefenderForImp(e, 260);
  if (defender) {
    e.combatTarget = defender;
    return updateImpCombat(e, t, dt);
  }
  if (dist(e.x, state.base.x) < 70) {
    e.dir = Math.sign(state.base.x - e.x) || e.dir;
    if (e.attackCd <= 0) {
      e.attackCd = 0.9;
      e.attackAnim = 0.22;
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
