import { CFG } from '../../config/config.js';
import { ENEMY_TYPES } from '../../config/enemies.js';
import { clamp, dist, rand, applyCrit } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnCoin, spawnParticles, floaty, critFloaty, spawnLocLoot } from '../world/SpawnSystem.js';
import { spawnLevelUpBeam } from '../../rendering/Effects.js';
import { killEnemy, killEnemyWithAnimation, spawnImpBlood } from '../../util/EnemyUtils.js';
import { startArcherShoot, SHOOT_RELEASE_TIME } from '../../rendering/sprites/Archer.js';
import { wallHeight } from '../../entities/Wall.js';
import { permanentDamageMultiplier } from '../infrastructure/RoguelikeSystem.js';
import { spawnFirePool } from '../ai/BossAI.js';

function arrowTrail(ar) {
  if (ar.enemyFireball) {
    spawnParticles(ar.x, ar.y, 3, "#ff6a20", 22, 20);
    if (Math.random() < 0.75) spawnParticles(ar.x, ar.y, 1, "#ffd060", 10, 24);
    if (Math.random() < 0.35) spawnParticles(ar.x, ar.y, 1, "#5a0710", 18, 8);
    return;
  }
  if (ar.fireArrow) {
    spawnParticles(ar.x, ar.y, 2, "#ff6a20", 16, 14);
    if (Math.random() < 0.55) spawnParticles(ar.x, ar.y, 1, "#ffd060", 9, 18);
  }
  if (ar.frostArrow) {
    spawnParticles(ar.x, ar.y, 2, "#bfefff", 14, 14);
    if (Math.random() < 0.5) spawnParticles(ar.x, ar.y, 1, "#ffffff", 8, 16);
  }
  if (ar.weaponId === "dark_bow") {
    if (Math.random() < 0.5) spawnParticles(ar.x, ar.y, 1, "#880099", 8, 5);
  } else if (ar.weaponId === "void_bow") {
    if (Math.random() < 0.6) spawnParticles(ar.x, ar.y, 1, "#6622cc", 10, 8);
  } else if (ar.weaponId === "dragons_bow") {
    spawnParticles(ar.x, ar.y, 2, "#ff6820", 15, 12);
    if (Math.random() < 0.4) spawnParticles(ar.x, ar.y, 1, "#ffcc40", 8, 8);
  }
}

const STUCK_ARROW_LIFE = 10;
const MIN_STUCK_ARROW_LIFE = 1;
const ARCHERS_FOR_MIN_ARROW_LIFE = 20;

function aliveArcherCount() {
  return state.units.reduce((count, u) => (
    count + (u.role === "archer" && u.hp > 0 && !u.dying ? 1 : 0)
  ), 0);
}

function stuckArrowLife() {
  const archerPressure = clamp(aliveArcherCount() / ARCHERS_FOR_MIN_ARROW_LIFE, 0, 1);
  return STUCK_ARROW_LIFE - (STUCK_ARROW_LIFE - MIN_STUCK_ARROW_LIFE) * archerPressure;
}

function stickArrowInEnemy(e, ar, enemyDrawY) {
  if (ar.ballista) return;
  if (!e.stuckArrows) e.stuckArrows = [];
  if (e.stuckArrows.length >= 5) e.stuckArrows.shift();
  const facing = e.dir < 0 ? -1 : 1;
  const drawYOff = e.aiState === "stacking" && e.impStackY !== undefined ? e.impStackY : (e.fy || 0);
  const localX = clamp((ar.x - e.x) * facing, -4, 9);
  const localY = clamp(ar.y - drawYOff, groundY - 29, groundY - 10);
  e.stuckArrows.push({
    x: localX,
    y: localY,
    a: Math.atan2(ar.vy, ar.vx) * facing,
    weaponId: ar.weaponId || null,
    t: stuckArrowLife(),
  });
}

function stickArrowInAnimal(a, ar) {
  if (!a.stuckArrows) a.stuckArrows = [];
  if (a.stuckArrows.length >= 5) a.stuckArrows.shift();
  a.stuckArrows.push({
    x: clamp(ar.x - a.x, -12, 12),
    y: groundY - (a.type === "bear" ? 26 : 14),
    a: Math.atan2(ar.vy, ar.vx),
    weaponId: ar.weaponId || null,
    t: stuckArrowLife(),
  });
}

// Ages out stuck arrows lodged in enemies/animals, and frozen arrows lying on the ground.
export function updateStuckArrows(dt) {
  const maxLife = stuckArrowLife();
  for (const e of state.enemies) {
    if (!e.stuckArrows || !e.stuckArrows.length) continue;
    for (let i = e.stuckArrows.length - 1; i >= 0; i--) {
      if (e.stuckArrows[i].t > maxLife) e.stuckArrows[i].t = maxLife;
      e.stuckArrows[i].t -= dt;
      if (e.stuckArrows[i].t <= 0) e.stuckArrows.splice(i, 1);
    }
  }
  for (const a of state.animals) {
    if (!a.stuckArrows || !a.stuckArrows.length) continue;
    for (let i = a.stuckArrows.length - 1; i >= 0; i--) {
      if (a.stuckArrows[i].t > maxLife) a.stuckArrows[i].t = maxLife;
      a.stuckArrows[i].t -= dt;
      if (a.stuckArrows[i].t <= 0) a.stuckArrows.splice(i, 1);
    }
  }
}

function enemyDrawYOffset(e) {
  return e.type === "imp" && e.aiState === "stacking" && e.impStackY !== undefined ? e.impStackY : (e.fy || 0);
}

export function shootArrow(x, y, target, sourceUnit = null, weaponId = null) {
  const targetType = target.type && ENEMY_TYPES[target.type];
  const tx = target.x, ty = targetType && targetType.flying ? groundY + (target.fy || -80) : groundY - 24;
  const dx = tx - x, dy = ty - y;
  const dist_h = Math.hypot(dx, dy);

  const flightTime = Math.max(0.12, dist_h / 400);
  const gravity = 420;

  let vx = dx / flightTime;
  let vy = (dy - 0.5 * gravity * flightTime * flightTime) / flightTime;

  // Archer units aren't perfectly accurate: slight random aim error, improving with level.
  if (sourceUnit && sourceUnit.role === "archer") {
    const level = sourceUnit.level || 1;
    const rangeMiss = clamp((dist_h - 260) / 620, 0, 1) * 0.2;
    const maxError = clamp(0.08 - level * 0.005 + rangeMiss, 0.018, 0.24); // radians
    const angErr = (Math.random() - 0.5) * 2 * maxError;
    const speed = Math.hypot(vx, vy);
    const ang = Math.atan2(vy, vx) + angErr;
    vx = Math.cos(ang) * speed;
    vy = Math.sin(ang) * speed;
  }

  // Archer units and player hold the arrow until the draw animation releases the string
  const delay = sourceUnit && (sourceUnit.role === "archer" || !sourceUnit.role) ? SHOOT_RELEASE_TIME : 0;

  const upgradeIds = sourceUnit?.weaponUpgrades ? sourceUnit.weaponUpgrades.map(u => u.id) : [];
  const frostArrow = upgradeIds.includes("frostbue") || upgradeIds.includes("faengslende_pile") || upgradeIds.includes("is_eksplosion");
  const rootArrow = upgradeIds.includes("faengslende_pile") || upgradeIds.includes("is_eksplosion");

  state.arrows.push({
    x, y,
    vx: vx,
    vy: vy,
    target,
    life: 1.2,
    hitKind: "enemy",
    sourceUnit,
    weaponId,
    delay,
    frostArrow,
    rootArrow,
  });
  if (!delay) Audio.bow();

  if (sourceUnit && sourceUnit.role === "archer") {
    startArcherShoot(sourceUnit);
  }

  if (weaponId === "dark_bow") spawnParticles(x, y, 8, "#880099", 40, 60);
  else if (weaponId === "void_bow") spawnParticles(x, y, 6, "#9933ff", 30, 50);
  else if (weaponId === "dragons_bow") { spawnParticles(x, y, 10, "#ff6620", 50, 80); spawnParticles(x, y, 5, "#ffcc40", 30, 60); }
}

export function updateArrows(dt) {
  const { arrows, enemies, animals, player, units } = state;
  updateStuckArrows(dt);
  const maxStuckArrowLife = stuckArrowLife();
  for (let i = arrows.length - 1; i >= 0; i--) {
    const ar = arrows[i];
    if (ar.stuck) {
      if (ar.stuckTimer > maxStuckArrowLife) ar.stuckTimer = maxStuckArrowLife;
      ar.stuckTimer -= dt;
      if (ar.stuckTimer <= 0) arrows.splice(i, 1);
      continue;
    }
    if (ar.delay > 0) {
      ar.delay -= dt;
      if (ar.delay <= 0) { ar.delay = 0; Audio.bow(); }
      continue;
    }
    ar.x += ar.vx * dt; ar.y += ar.vy * dt; ar.vy += 420 * dt;
    if (ar.life !== undefined) ar.life -= dt;
    arrowTrail(ar);
    let hit = false;
    const expiresInAir = ar.enemyFireball || ar.hitKind === "base";

    if (ar.hitKind === "enemy") {
      for (const e of enemies) {
        if (e.fleeing) continue;
        if (ar._hitEnemies && ar._hitEnemies.has(e)) continue;
        const et = ENEMY_TYPES[e.type];
        const enemyDrawY = et.flying ? groundY + (e.fy || -80) : groundY - 24 + enemyDrawYOffset(e);
        if (dist(ar.x, e.x) < et.w * 0.7 && Math.abs(ar.y - enemyDrawY) < (et.dragon ? 85 : 40)) {
          if (e.dying) {
            stickArrowInEnemy(e, ar, enemyDrawY);
            hit = true;
            break;
          }
          const baseDmg = (ar.dmgMult ? Math.round(ar.dmgMult) : 1) * permanentDamageMultiplier();
          const crit = applyCrit(baseDmg, CFG.critChance, CFG.critMultiplier);
          stickArrowInEnemy(e, ar, enemyDrawY);
          e.hp -= crit.damage; e.flash = 0.12; Audio.hit();
          if (crit.isCrit) critFloaty(e.x, crit.damage);
          else floaty(e.x, "-" + crit.damage, "#8a2a4a");
          spawnImpBlood(e, ar.powered || ar.ballista ? 1.7 : 1, enemyDrawY);
          if (ar.fireArrow) {
            e.burn = Math.max(e.burn || 0, 4);
            e.burnTick = 1;
            e.burnDmg = Math.max(e.burnDmg || 0, 1);
            e.ignited = true;
            spawnParticles(e.x, enemyDrawY, 12, "#ff6a20", 55, 70);
            spawnParticles(e.x, enemyDrawY, 7, "#ffd060", 35, 85);
          }
          if (ar.powered) { if (!et.noKnockback) e.knock = (e.knock||0) + Math.sign(e.x - ar.vx) * 400; spawnParticles(e.x, enemyDrawY, 10, "#ffcc60", 60, 80); }
          if (ar.frostArrow) {
            e.frost = Math.max(e.frost || 0, 2.5);
            spawnParticles(e.x, enemyDrawY, 10, "#bfefff", 60, 70);
            spawnParticles(e.x, enemyDrawY, 5, "#ffffff", 35, 90);
          }
          if (ar.rootArrow) {
            e.rooted = Math.max(e.rooted || 0, 3);
            spawnParticles(e.x, enemyDrawY, 12, "#8fd8ff", 30, 60);
          }
          if (ar.weaponId === "dark_bow") {
            spawnParticles(e.x, enemyDrawY, 12, "#aa44cc", 70, 90);
            spawnParticles(e.x, enemyDrawY, 6, "#440066", 40, 50);
            Game.screenShake = Math.max(Game.screenShake, 0.3);
          } else if (ar.weaponId === "void_bow") {
            spawnParticles(e.x, enemyDrawY, 10, "#9933ff", 60, 80);
            spawnParticles(e.x, enemyDrawY, 6, "#ddaaff", 30, 110);
            Game.screenShake = Math.max(Game.screenShake, 0.35);
          } else if (ar.weaponId === "dragons_bow") {
            spawnParticles(e.x, enemyDrawY, 18, "#ff6820", 100, 120);
            spawnParticles(e.x, enemyDrawY, 10, "#ff2200", 70, 90);
            spawnParticles(e.x, enemyDrawY, 8, "#ffdd60", 50, 100);
            Game.screenShake = Math.max(Game.screenShake, 0.55);
          } else {
            spawnParticles(e.x, enemyDrawY, 4, "#8a2a4a");
          }
          if (ar.ballista) { spawnParticles(e.x, enemyDrawY, 14, "#cc8840", 90, 100); Game.screenShake = Math.max(Game.screenShake, 0.3); if (!et.noKnockback) e.knock = (e.knock||0) + Math.sign(e.x - ar.vx) * 500; }
          if (ar.pierce > 0) {
            if (!ar._hitEnemies) ar._hitEnemies = new Set();
            ar._hitEnemies.add(e);
            ar.pierce--;
            hit = false;
          } else {
            hit = true;
          }
          if (ar.bouncing && ar.sourceUnit) {
            let nextTgt = null, nd = 400;
            for (const ne of enemies) {
              if (ne === e || ne.fleeing) continue;
              const d = dist(ar.x, ne.x); if (d < nd) { nd = d; nextTgt = ne; }
            }
            if (nextTgt) {
              const ang = Math.atan2(groundY - 24 - ar.y, nextTgt.x - ar.x);
              state.arrows.push({ x: ar.x, y: ar.y, vx: Math.cos(ang)*480, vy: Math.sin(ang)*480, target: nextTgt, life: 1.0, hitKind: "enemy", sourceUnit: ar.sourceUnit, fireArrow: ar.fireArrow, bouncing: false, pierce: 0 });
            }
          }
          if (e.hp <= 0) {
            if (ar.sourceUnit) {
              ar.sourceUnit.gold = (ar.sourceUnit.gold || 0) + et.reward;
              ar.sourceUnit.xp = (ar.sourceUnit.xp || 0) + 1;
              const xpNeeded = (ar.sourceUnit.level || 1) * 3;
              if (ar.sourceUnit.xp >= xpNeeded) {
                ar.sourceUnit.xp -= xpNeeded;
                ar.sourceUnit.level = (ar.sourceUnit.level || 1) + 1;
                state.archerSkillPoints = (state.archerSkillPoints || 0) + 1;
                spawnLevelUpBeam(ar.sourceUnit.x);
              }
              const knockDir = Math.sign(e.x - ar.x) || 1;
              killEnemyWithAnimation(e, knockDir);
            } else {
              killEnemy(e);
            }
          }
          if (hit) break;
        }
      }
    }

    if (!hit && ar.hitKind === "enemy") {
      for (const a of animals) {
        if (a.alive && !a.dying && dist(ar.x, a.x) < (a.type === "bear" ? 24 : 16) && ar.y > groundY - 36) {
          stickArrowInAnimal(a, ar);
          if (a.type === "bear") {
            // Bears are tough: they take arrow damage instead of dying outright
            a.hp -= ar.dmg || 1; a.flash = 0.15;
            spawnParticles(a.x, groundY - 30, 5, "#8a2a2a");
            if (a.hp > 0) { hit = true; break; }
          }
          a.dying = true; a.deathT = 0;
          spawnParticles(a.x, groundY - 20, 8, "#7a4a2a");
          const reward = a.type === "bear" ? 8 : a.type === "deer" ? 3 : 1;
          if (ar.sourceUnit?.role === "archer" && (a.type === "deer" || a.type === "rabbit")) {
            ar.sourceUnit.gold = (ar.sourceUnit.gold || 0) + reward;
            floaty(a.x, "+" + reward + " guld", "#f2c14e");
          } else {
            for (let k = 0; k < reward; k++) spawnCoin(a.x + rand(-15, 15), 1, groundY - 20, rand(-50, 50), rand(-220, -120));
            floaty(a.x, "+" + reward + "🪙", "#f2c14e");
          }
          hit = true; break;
        }
      }
    }

    if (!hit && ar.hitKind === "player" && !Game.inMine) {
      if (dist(ar.x, player.x) < 18 && Math.abs(ar.y - (groundY - 50)) < 50) {
        if (player.invuln <= 0 && !window._DEV_GOD_MODE) {
          player.hp -= ar.dmg || 1; player.invuln = CFG.playerInvuln; player.hurt = 0.35; player.hpShowTimer = 3;
          player.knock = (player.x < ar.x ? -1 : 1) * -120;
          if (ar.enemyFireball) {
            spawnParticles(player.x, groundY - 50, 16, "#ff6a20", 85, 95);
            spawnParticles(player.x, groundY - 50, 8, "#ffd060", 50, 90);
            Game.screenShake = Math.max(Game.screenShake, 0.22);
          } else {
            spawnParticles(player.x, groundY - 50, 4, "#c1453b");
          }
          Audio.hit();
        }
        hit = true;
      }
    }

    if (!hit && ar.hitKind === "unit") {
      for (const u of units) {
        if (u.hp <= 0 || u.dying || u.mine) continue;
        const uy = u.onWall && u.wall ? groundY - wallHeight(u.wall) - 18 : groundY - 30;
        if (dist(ar.x, u.x) < (ar.radius || 22) && Math.abs(ar.y - uy) < 46) {
          u.hp -= ar.dmg || 1;
          u.panic = 0.9;
          u.knock = (u.knock || 0) + Math.sign(u.x - ar.x || 1) * 90;
          spawnParticles(u.x, uy, 14, "#ff6a20", 75, 90);
          spawnParticles(u.x, uy, 6, "#ffd060", 42, 80);
          Game.screenShake = Math.max(Game.screenShake, 0.18);
          Audio.hit();
          hit = true;
          break;
        }
      }
    }

    if (!hit && ar.hitKind === "base" && (ar.y > groundY - 8 || ar.life <= 0)) {
      const base = state.base;
      const r = ar.radius || 90;
      if (dist(ar.x, base.x) < r + 40) {
        base.hp -= ar.dmg || 6; base.flash = 0.3;
        floaty(base.x, `-${ar.dmg || 6}🔥`, "#ff6a4a");
        if (base.hp < 0) base.hp = 0;
      }
      for (const u of units) {
        if (u.hp <= 0 || u.dying || u.mine) continue;
        if (dist(ar.x, u.x) < r * 0.7) {
          u.hp -= 1; u.panic = 1;
          u.knock = (u.knock || 0) + Math.sign(u.x - ar.x || 1) * 130;
        }
      }
      if (!Game.inMine && dist(ar.x, player.x) < r * 0.6 && player.jumpH <= 0 && player.invuln <= 0 && !window._DEV_GOD_MODE) {
        player.hp -= 1; player.invuln = CFG.playerInvuln; player.hurt = 0.35; player.hpShowTimer = 3;
        player.knock = (player.x < ar.x ? -1 : 1) * 160;
      }
      spawnParticles(ar.x, groundY - 14, 26, "#ff6a20", 140, 120);
      spawnParticles(ar.x, groundY - 14, 12, "#ffd060", 85, 130);
      spawnParticles(ar.x, groundY - 10, 8, "#5a0710", 90, 60);
      Game.screenShake = Math.max(Game.screenShake, 0.4);
      Audio.hit();
      hit = true;
    }

    if (ar.enemyFireball && (hit || ar.life <= 0 || ar.y > groundY - 6)) {
      spawnParticles(ar.x, Math.min(ar.y, groundY - 8), 16, "#ff6a20", 80, 90);
      spawnParticles(ar.x, Math.min(ar.y, groundY - 8), 7, "#ffd060", 45, 80);
      // Magma boulders splash into a burning pool that lingers on the ground
      if (ar.magma) spawnFirePool(ar.x);
    }
    if (hit || (expiresInAir && ar.life <= 0) || ar.y > groundY - 6) {
      // Real arrows (not fireballs/magma/base impacts) freeze in place so it's clear where they landed.
      if (!ar.enemyFireball && !hit) {
        ar.stuck = true;
        ar.stuckTimer = maxStuckArrowLife;
        ar.frozenAngle = Math.atan2(ar.vy, ar.vx);
        ar.y = Math.min(ar.y, groundY - 4);
        ar.vx = 0; ar.vy = 0;
      } else {
        arrows.splice(i, 1);
      }
    }
  }
}
