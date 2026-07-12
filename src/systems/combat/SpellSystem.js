import { WEAPONS, effectiveWeapon } from '../../config/weapons.js';
import { CFG } from '../../config/config.js';
import { dist, rand, applyCrit } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnParticles, floaty, critFloaty, spawnGoldReward } from '../world/SpawnSystem.js';
import { killEnemy, spawnImpBlood } from '../../util/EnemyUtils.js';
import { ENEMY_TYPES } from '../../config/enemies.js';
import { permanentDamageMultiplier } from '../infrastructure/RoguelikeSystem.js';
import { entityWallLift } from '../../entities/Wall.js';

function spellGravity(spellType) {
  return spellType === "meteor" ? 650 : spellType === "waterjet" ? 80 : 280;
}

function targetImpactY(target) {
  const targetType = target?.type && ENEMY_TYPES[target.type];
  if (targetType?.flying) return groundY + (target.fy || -80);

  const stackY = target?.type === "imp" && target.aiState === "stacking" && target.impStackY !== undefined
    ? target.impStackY
    : (target?.fy || 0);
  return groundY - 24 + stackY;
}

function playerMomentumDamageMultiplier() {
  const level = (Game.momentumTimer || 0) > 0 ? (Game.momentumLevel || 0) : 0;
  return 1 + level * 0.04;
}

function playerRiposteDamageMultiplier(player) {
  return (player?.riposteT || 0) > 0 ? (CFG.dodgeRiposteDamageMult || 1.6) : 1;
}

// Spell damage against a bear (bears live in state.animals, not enemies).
function damageBear(a, dmg, col) {
  const crit = applyCrit(dmg, CFG.critChance, CFG.critMultiplier);
  a.hp -= crit.damage; a.flash = 0.14;
  spawnParticles(a.x, groundY - 30, 5, "#8a2a2a");
  if (crit.isCrit) critFloaty(a.x, crit.damage);
  else floaty(a.x, "-" + crit.damage, col);
  if (a.hp <= 0 && !a.dying) {
    a.dying = true; a.deathT = 0;
    spawnParticles(a.x, groundY - 20, 8, "#7a4a2a");
    const reward = spawnGoldReward(a.x, 8, "hunt", { spreadX: 15, fromY: groundY - 20, vx: 50, vyMin: 120, vyMax: 220 });
    if (reward > 0) floaty(a.x, "+" + reward + "🪙", "#f2c14e");
  }
  return crit.damage;
}

function dealAoE(x, dmg, radius, col) {
  for (const a of state.animals) {
    if (a.type === "bear" && a.alive && !a.dying && dist(a.x, x) < radius) {
      damageBear(a, dmg, col);
    }
  }
  for (const e of state.enemies) {
    if (!e.fleeing && !e.dying && dist(e.x, x) < radius) {
      const crit = applyCrit(dmg, CFG.critChance, CFG.critMultiplier);
      e.hp -= crit.damage; e.flash = 0.14;
      spawnImpBlood(e, 0.9 + crit.damage * 0.08);
      if (crit.isCrit) critFloaty(e.x, crit.damage);
      else floaty(e.x, "-" + crit.damage, col);
      if (e.hp <= 0) killEnemy(e);
    }
  }
  spawnParticles(x, groundY - 10, 14, col, 100, 90);
}

function meteorCrashImpact(sp, x, y = groundY - 8) {
  const impactY = Math.min(y, groundY - 8);
  const crash = { ...sp, x };
  spellGroundImpact(crash);
  spellEnemyImpact({ ...sp, spellType: "meteor" }, x, impactY);
  spawnParticles(x, impactY, 34, "#ff8840", 180, 180);
  spawnParticles(x, impactY + 6, 26, "#3a2418", 210, 120);
  spawnParticles(x, groundY - 5, 20, "#1d1510", 240, 45);
  spawnParticles(x, groundY - 18, 12, "#ffd060", 150, 170);
  for (let k = -1; k <= 1; k += 2) {
    spawnParticles(x + k * 18, groundY - 6, 10, "#5b3a22", 190, 38);
    spawnParticles(x + k * 34, groundY - 4, 6, "#ff6a20", 170, 30);
  }
  if (!state.firePools) state.firePools = [];
  state.firePools.push({ x, r: Math.max(24, (sp.aoeRadius || 70) * 0.45), life: 2.2, maxLife: 2.2, tick: rand(0.3, 0.7), ph: rand(0, 6) });
  Game.screenShake = Math.max(Game.screenShake, 0.95);
}

function chainLightning(x, dmg, bounces) {
  if (bounces <= 0) return;
  let nearest = null, nd = 250;
  for (const e of state.enemies) {
    const d = dist(e.x, x);
    if (!e.fleeing && d < nd && d > 10) { nd = d; nearest = e; }
  }
  if (!nearest) return;

  const enemyDrawY = targetImpactY(nearest);

  let curX = x;
  let curY = enemyDrawY;
  const steps = 6;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const baseTargetX = nearest.x;
    const baseTargetY = enemyDrawY;

    const bendY = (i === steps) ? 0 : rand(-15, 15);
    const nxtX = curX + (baseTargetX - x) / steps;
    const nxtY = (baseTargetY * t) + (enemyDrawY * (1 - t)) + bendY;

    const dSeg = Math.hypot(nxtX - curX, nxtY - curY);
    const pSteps = Math.ceil(dSeg / 5);
    for (let s = 0; s <= pSteps; s++) {
      const st = s / pSteps;
      const px = curX + (nxtX - curX) * st;
      const py = curY + (nxtY - curY) * st;
      spawnParticles(px, py, 1, "#ffffff", 6, 6);
      if (Math.random() < 0.3) spawnParticles(px, py, 1, "#ccccff", 12, 8);
    }
    curX = nxtX;
    curY = nxtY;
  }

  const baseDmg = Math.max(1, Math.floor(dmg * 0.6));
  const crit = applyCrit(baseDmg, CFG.critChance, CFG.critMultiplier);
  nearest.hp -= crit.damage;
  nearest.flash = 0.14;
  Audio.hit();
  spawnParticles(nearest.x, enemyDrawY, 10, "#ccccff", 60, 80);
  spawnImpBlood(nearest, 1 + crit.damage * 0.05, enemyDrawY);
  if (crit.isCrit) critFloaty(nearest.x, crit.damage);
  else floaty(nearest.x, "-" + crit.damage, "#ccccff");

  if (nearest.hp <= 0) {
    killEnemy(nearest);
  } else {
    chainLightning(nearest.x, dmg * 0.6, bounces - 1);
  }
}

export function castSpell(player, wBase, tgt) {
  const ew = effectiveWeapon(player.weapon, player.weaponUpgrades || []);
  const dmgMult = permanentDamageMultiplier() * playerMomentumDamageMultiplier() * playerRiposteDamageMultiplier(player);
  const aoeR = (wBase.aoeRadius || 0) + (ew.range - wBase.range) * 0.2;
  const casterLift = entityWallLift(player) + (player.jumpH || 0);
  const casterY = groundY - 72 - casterLift;

  const tgtIsBear = tgt.type === "bear" && state.animals.includes(tgt);

  if (wBase.spellType === "lightning") {
    const enemyY = targetImpactY(tgt);
    if (tgtIsBear) {
      damageBear(tgt, ew.dmg * dmgMult, wBase.col);
      Audio.spell();
    } else {
      const crit = applyCrit(ew.dmg * dmgMult, CFG.critChance, CFG.critMultiplier);
      tgt.hp -= crit.damage;
      tgt.flash = 0.14;
      Audio.spell();
      spawnImpBlood(tgt, 1 + ew.dmg * 0.07, enemyY);
    }
    spellEnemyImpact({ spellType: "lightning" }, tgt.x, enemyY);

    let currentX = tgt.x + rand(-20, 20);
    let currentY = groundY - 1000;
    const segments = 20;

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const targetBaseX = tgt.x;
      const targetBaseY = enemyY;

      const bendX = (i === segments) ? 0 : rand(-35, 35);
      const nextX = (targetBaseX * t) + (currentX * (1 - t)) + bendX;
      const nextY = currentY + ((targetBaseY - (groundY - 1000)) / segments);

      const segDist = Math.hypot(nextX - currentX, nextY - currentY);
      const steps = Math.ceil(segDist / 6);
      for (let s = 0; s <= steps; s++) {
        const st = s / steps;
        const px = currentX + (nextX - currentX) * st;
        const py = currentY + (nextY - currentY) * st;
        spawnParticles(px, py, 1, "#ffffff", 5, 5);
        if (Math.random() < 0.4) spawnParticles(px, py, 1, "#ccccff", 12, 10);
      }
      currentX = nextX;
      currentY = nextY;
    }

    chainLightning(tgt.x, ew.dmg * dmgMult, 1);

    if (!tgtIsBear && tgt.hp <= 0) killEnemy(tgt);

    spawnParticles(player.x, casterY, 10, wBase.col, 50, 70);
    Audio.spell();
    return;
  }

  let startX = player.x;
  let startY = casterY;
  let targetX = tgt.x;
  let targetY = targetImpactY(tgt);
  let spd = wBase.spellType === "waterjet" ? 480 : 330;
  let life = 2.2;
  let vx;
  let vy;

  if (wBase.spellType === "meteor") {
    const dir = Math.sign(tgt.x - player.x) || 1;
    startX = player.x - (250 * dir);
    startY = groundY - 1500;
    spd = 650;
    targetX = tgt.x + (210 * dir);
    targetY = groundY - 28;
    life = 4.0;
    const ang = Math.atan2(targetY - startY, targetX - startX);
    vx = Math.cos(ang) * spd;
    vy = Math.sin(ang) * spd;
  } else {
    const grav = spellGravity(wBase.spellType || "arcane");
    const dx = targetX - startX;
    const dy = targetY - startY;
    const flightTime = Math.max(0.12, Math.hypot(dx, dy) / spd);
    vx = dx / flightTime;
    vy = (dy - 0.5 * grav * flightTime * flightTime) / flightTime;
  }

  state.spells.push({
    x: startX,
    y: startY,
    vx,
    vy,
    spellType: wBase.spellType || "arcane",
    dmg: ew.dmg * dmgMult,
    life: life,
    col: wBase.col,
    aoeRadius: aoeR,
    age: 0,
  });

  spawnParticles(player.x, casterY, 10, wBase.col, 50, 70);
  Audio.spell();
}

export function updateSpells(dt) {
  if (!state.spells || !state.spells.length) return;
  const { spells, enemies } = state;
  for (let i = spells.length - 1; i >= 0; i--) {
    const sp = spells[i];
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    sp.age = (sp.age || 0) + dt;
    const grav = spellGravity(sp.spellType);
    sp.vy += grav * dt;
    sp.life -= dt;

    spellTrail(sp);

    const hitGround = sp.y > groundY - 8;
    if (sp.life <= 0 || hitGround) {
      if (sp.aoeRadius > 0 && hitGround) {
        if (sp.spellType === "meteor") meteorCrashImpact(sp, sp.x, groundY - 8);
        else spellGroundImpact(sp);
        dealAoE(sp.x, sp.dmg, sp.aoeRadius, sp.col);
        Audio.explosion();
      }
      spells.splice(i, 1);
      continue;
    }
    let hit = false;
    for (const e of enemies) {
      if (e.fleeing) continue;
      const et = ENEMY_TYPES[e.type];
      const ey = targetImpactY(e);
      if (dist(sp.x, e.x) < et.w * 0.75 && Math.abs(sp.y - ey) < 44) {
        e.hp -= sp.dmg; e.flash = 0.14; Audio.hit();
        if (sp.spellType === "meteor") {
          meteorCrashImpact(sp, e.x, ey);
          if (sp.aoeRadius > 0) {
            dealAoE(e.x, sp.dmg, sp.aoeRadius, sp.col);
            Audio.explosion();
          }
        } else {
          spellEnemyImpact(sp, e.x, ey);
        }
        spawnImpBlood(e, 1 + sp.dmg * 0.08, ey);
        if (!et.noKnockback) e.knock = (e.knock || 0) + Math.sign(e.x - sp.vx) * 140;
        if (e.hp <= 0 && !e.dying) killEnemy(e);
        else if (sp.aoeRadius > 0 && sp.spellType !== "meteor") dealAoE(sp.x, Math.max(1, Math.floor(sp.dmg * 0.65)), sp.aoeRadius, sp.col);
        if (sp.spellType === "lightning") chainLightning(sp.x, sp.dmg, 1);
        hit = true; break;
      }
    }
    if (!hit) {
      for (const a of state.animals) {
        if (a.type !== "bear" || !a.alive || a.dying) continue;
        const ay = groundY + (a.fy || 0) - 24;
        if (dist(sp.x, a.x) < 30 && Math.abs(sp.y - ay) < 44) {
          Audio.hit();
          if (sp.spellType === "meteor") {
            meteorCrashImpact(sp, a.x, ay);
            if (sp.aoeRadius > 0) { dealAoE(a.x, sp.dmg, sp.aoeRadius, sp.col); Audio.explosion(); }
          } else {
            spellEnemyImpact(sp, a.x, ay);
            damageBear(a, sp.dmg, sp.col);
            if (sp.aoeRadius > 0) dealAoE(sp.x, Math.max(1, Math.floor(sp.dmg * 0.65)), sp.aoeRadius, sp.col);
          }
          hit = true; break;
        }
      }
    }
    if (hit) spells.splice(i, 1);
  }
}

function spellTrail(sp) {
  switch (sp.spellType) {
    case "fireball":
      if (Math.random() < 0.7) spawnParticles(sp.x, sp.y, 1, "#ff6a20", 12, 10);
      if (Math.random() < 0.3) spawnParticles(sp.x, sp.y, 1, "#ffcc60", 6, 14);
      break;
    case "meteor":
      spawnParticles(sp.x, sp.y, 2, "#ff7730", 18, 14);
      if (Math.random() < 0.5) spawnParticles(sp.x, sp.y, 1, "#554432", 22, 10);
      break;
    case "waterjet":
      if (Math.random() < 0.5) spawnParticles(sp.x, sp.y, 1, "#4ab8e8", 14, 8);
      break;
    case "arcane":
      if (Math.random() < 0.6) spawnParticles(sp.x, sp.y, 1, "#cc44ff", 16, 14);
      if (Math.random() < 0.3) spawnParticles(sp.x, sp.y, 1, "#ff88ff", 8, 18);
      break;
    case "shadow":
      if (Math.random() < 0.6) spawnParticles(sp.x, sp.y, 1, "#660099", 12, 8);
      if (Math.random() < 0.3) spawnParticles(sp.x, sp.y, 1, "#aa44cc", 8, 12);
      break;
    case "void":
      if (Math.random() < 0.7) spawnParticles(sp.x, sp.y, 1, "#9922ff", 14, 12);
      if (Math.random() < 0.4) spawnParticles(sp.x, sp.y, 1, "#550088", 20, 8);
      break;
  }
}

function spellEnemyImpact(sp, x, y) {
  switch (sp.spellType) {
    case "fireball":
      spawnParticles(x, y, 14, "#ff6a20", 80, 100);
      spawnParticles(x, y, 8, "#ffcc60", 50, 80);
      spawnParticles(x, y, 4, "#ff2200", 60, 60);
      Game.screenShake = Math.max(Game.screenShake, 0.18);
      break;
    case "meteor":
      spawnParticles(x, y, 18, "#ff8840", 100, 120);
      spawnParticles(x, y, 10, "#554432", 70, 80);
      spawnParticles(x, y, 6, "#ffcc60", 60, 100);
      Game.screenShake = Math.max(Game.screenShake, 0.4);
      break;
    case "waterjet":
      spawnParticles(x, y, 12, "#4ab8e8", 80, 90);
      spawnParticles(x, y, 6, "#a0e8ff", 50, 60);
      break;
    case "lightning":
      spawnParticles(x, y, 14, "#ccccff", 80, 110);
      spawnParticles(x, y, 8, "#ffffff", 40, 130);
      Game.screenShake = Math.max(Game.screenShake, 0.28);
      break;
    case "arcane":
      spawnParticles(x, y, 16, "#cc44ff", 90, 120);
      spawnParticles(x, y, 8, "#ff88ff", 50, 100);
      spawnParticles(x, y, 5, "#ffffff", 30, 80);
      Game.screenShake = Math.max(Game.screenShake, 0.32);
      break;
    case "shadow":
      spawnParticles(x, y, 14, "#aa44cc", 70, 90);
      spawnParticles(x, y, 8, "#440066", 50, 60);
      spawnParticles(x, y, 5, "#ff88ff", 30, 80);
      Game.screenShake = Math.max(Game.screenShake, 0.3);
      break;
    case "void":
      spawnParticles(x, y, 20, "#9922ff", 100, 140);
      spawnParticles(x, y, 12, "#ddaaff", 60, 120);
      spawnParticles(x, y, 8, "#550088", 80, 80);
      Game.screenShake = Math.max(Game.screenShake, 0.5);
      break;
    default:
      spawnParticles(x, y, 8, sp.col, 70, 90);
      break;
  }
}

function spellGroundImpact(sp) {
  switch (sp.spellType) {
    case "fireball":
      spawnParticles(sp.x, groundY - 8, 16, "#ff6a20", 90, 100);
      spawnParticles(sp.x, groundY - 8, 8, "#ffcc40", 60, 80);
      break;
    case "meteor":
      spawnParticles(sp.x, groundY - 8, 28, "#ff8840", 130, 140);
      spawnParticles(sp.x, groundY - 8, 16, "#554432", 100, 100);
      spawnParticles(sp.x, groundY - 8, 10, "#ffcc60", 80, 120);
      Game.screenShake = Math.max(Game.screenShake, 0.65);
      break;
    case "waterjet":
      spawnParticles(sp.x, groundY - 8, 18, "#4ab8e8", 110, 100);
      spawnParticles(sp.x, groundY - 8, 10, "#a0e8ff", 70, 70);
      break;
    case "arcane":
      spawnParticles(sp.x, groundY - 8, 20, "#cc44ff", 100, 130);
      spawnParticles(sp.x, groundY - 8, 10, "#ff88ff", 60, 100);
      Game.screenShake = Math.max(Game.screenShake, 0.35);
      break;
    case "shadow":
      spawnParticles(sp.x, groundY - 8, 18, "#aa44cc", 90, 100);
      spawnParticles(sp.x, groundY - 8, 10, "#220033", 60, 70);
      Game.screenShake = Math.max(Game.screenShake, 0.3);
      break;
    case "void":
      spawnParticles(sp.x, groundY - 8, 30, "#9922ff", 120, 160);
      spawnParticles(sp.x, groundY - 8, 18, "#ddaaff", 80, 140);
      spawnParticles(sp.x, groundY - 8, 12, "#ffffff", 50, 120);
      Game.screenShake = Math.max(Game.screenShake, 0.7);
      break;
  }
}
