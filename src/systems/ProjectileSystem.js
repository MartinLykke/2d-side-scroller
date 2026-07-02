import { CFG } from '../config/config.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { clamp, dist, rand } from '../util/math.js';
import { groundY } from '../canvas.js';
import { Game, state } from '../state.js';
import { Audio } from './Audio.js';
import { spawnCoin, spawnParticles, floaty, spawnLocLoot } from './SpawnSystem.js';
import { spawnLevelUpBeam } from '../rendering/Effects.js';
import { killEnemy, killEnemyWithAnimation, spawnImpBlood } from '../util/EnemyUtils.js';
import { startArcherShoot, SHOOT_RELEASE_TIME } from '../rendering/Archer.js';
import { wallHeight } from '../entities/Wall.js';

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
  if (ar.weaponId === "dark_bow") {
    if (Math.random() < 0.5) spawnParticles(ar.x, ar.y, 1, "#880099", 8, 5);
  } else if (ar.weaponId === "void_bow") {
    if (Math.random() < 0.6) spawnParticles(ar.x, ar.y, 1, "#6622cc", 10, 8);
  } else if (ar.weaponId === "dragons_bow") {
    spawnParticles(ar.x, ar.y, 2, "#ff6820", 15, 12);
    if (Math.random() < 0.4) spawnParticles(ar.x, ar.y, 1, "#ffcc40", 8, 8);
  }
}

function stickArrowInEnemy(e, ar, enemyDrawY) {
  if (e.type !== "imp" || ar.ballista) return;
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
  });
}

function enemyDrawYOffset(e) {
  return e.type === "imp" && e.aiState === "stacking" && e.impStackY !== undefined ? e.impStackY : (e.fy || 0);
}

export function shootArrow(x, y, target, sourceUnit = null, weaponId = null) {
  const tx = target.x, ty = groundY - 24;
  const dx = tx - x, dy = ty - y;
  const dist_h = Math.hypot(dx, dy);

  const flightTime = dist_h / 400;
  const gravity = 420;

  const vx = dx / flightTime;
  const vy = (dy - 0.5 * gravity * flightTime * flightTime) / flightTime;

  // Archer units hold the arrow until the draw animation releases the string
  const delay = sourceUnit && sourceUnit.role === "archer" ? SHOOT_RELEASE_TIME : 0;

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
  for (let i = arrows.length - 1; i >= 0; i--) {
    const ar = arrows[i];
    if (ar.delay > 0) {
      ar.delay -= dt;
      if (ar.delay <= 0) { ar.delay = 0; Audio.bow(); }
      continue;
    }
    ar.x += ar.vx * dt; ar.y += ar.vy * dt; ar.vy += 420 * dt; ar.life -= dt;
    arrowTrail(ar);
    let hit = false;

    if (ar.hitKind === "enemy") {
      for (const e of enemies) {
        if (e.fleeing) continue;
        if (ar._hitEnemies && ar._hitEnemies.includes(e)) continue;
        const et = ENEMY_TYPES[e.type];
        const enemyDrawY = et.flying ? groundY + (e.fy || -80) : groundY - 24 + enemyDrawYOffset(e);
        if (dist(ar.x, e.x) < et.w * 0.7 && Math.abs(ar.y - enemyDrawY) < 40) {
          if (e.dying) {
            stickArrowInEnemy(e, ar, enemyDrawY);
            hit = true;
            break;
          }
          const dmg = ar.dmgMult ? Math.round(ar.dmgMult) : 1;
          stickArrowInEnemy(e, ar, enemyDrawY);
          e.hp -= dmg; e.flash = 0.12; Audio.hit();
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
            if (!ar._hitEnemies) ar._hitEnemies = [];
            ar._hitEnemies.push(e);
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
                const fname = (ar.sourceUnit.archerName || "Bueskytte").split(" ")[0];
                floaty(ar.sourceUnit.x, `⬆ ${fname} Niv.${ar.sourceUnit.level}! (+1ep 🏹)`, "#f2c14e");
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
        if (a.alive && !a.dying && dist(ar.x, a.x) < 16 && ar.y > groundY - 36) {
          a.dying = true; a.deathT = 0;
          spawnParticles(a.x, groundY - 20, 8, "#7a4a2a");
          const reward = a.type === "deer" ? 3 : 1;
          for (let k = 0; k < reward; k++) spawnCoin(a.x + rand(-15, 15), 1, groundY - 20, rand(-50, 50), rand(-220, -120));
          floaty(a.x, "+" + reward + "🪙", "#f2c14e");
          hit = true; break;
        }
      }
    }

    if (!hit && ar.hitKind === "player") {
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
        if (u.hp <= 0 || u.dying) continue;
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

    if (ar.enemyFireball && (hit || ar.life <= 0 || ar.y > groundY - 6)) {
      spawnParticles(ar.x, Math.min(ar.y, groundY - 8), 16, "#ff6a20", 80, 90);
      spawnParticles(ar.x, Math.min(ar.y, groundY - 8), 7, "#ffd060", 45, 80);
    }
    if (hit || ar.life <= 0 || ar.y > groundY - 6) arrows.splice(i, 1);
  }
}
