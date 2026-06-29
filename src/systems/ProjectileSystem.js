import { CFG } from '../config/config.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { dist, rand } from '../util/math.js';
import { groundY } from '../canvas.js';
import { Game, state } from '../state.js';
import { Audio } from './Audio.js';
import { spawnCoin, spawnParticles, floaty, spawnLocLoot } from './SpawnSystem.js';
import { spawnLevelUpBeam } from '../rendering/Effects.js';
import { killEnemy } from '../util/EnemyUtils.js';

function arrowTrail(ar) {
  if (ar.weaponId === "dark_bow") {
    if (Math.random() < 0.5) spawnParticles(ar.x, ar.y, 1, "#880099", 8, 5);
  } else if (ar.weaponId === "void_bow") {
    if (Math.random() < 0.6) spawnParticles(ar.x, ar.y, 1, "#6622cc", 10, 8);
  } else if (ar.weaponId === "dragons_bow") {
    spawnParticles(ar.x, ar.y, 2, "#ff6820", 15, 12);
    if (Math.random() < 0.4) spawnParticles(ar.x, ar.y, 1, "#ffcc40", 8, 8);
  }
}

export function shootArrow(x, y, target, sourceUnit = null, weaponId = null) {
  const tx = target.x, ty = groundY - 24;
  const dx = tx - x, dy = ty - y;
  const dist_h = Math.hypot(dx, dy);

  const flightTime = dist_h / 400;
  const gravity = 420;

  const vx = dx / flightTime;
  const vy = (dy - 0.5 * gravity * flightTime * flightTime) / flightTime;

  state.arrows.push({
    x, y,
    vx: vx,
    vy: vy,
    target,
    life: 1.2,
    hitKind: "enemy",
    sourceUnit,
    weaponId,
  });
  Audio.bow();
  if (weaponId === "dark_bow") spawnParticles(x, y, 8, "#880099", 40, 60);
  else if (weaponId === "void_bow") spawnParticles(x, y, 6, "#9933ff", 30, 50);
  else if (weaponId === "dragons_bow") { spawnParticles(x, y, 10, "#ff6620", 50, 80); spawnParticles(x, y, 5, "#ffcc40", 30, 60); }
}

export function updateArrows(dt) {
  const { arrows, enemies, animals, player } = state;
  for (let i = arrows.length - 1; i >= 0; i--) {
    const ar = arrows[i];
    ar.x += ar.vx * dt; ar.y += ar.vy * dt; ar.vy += 420 * dt; ar.life -= dt;
    arrowTrail(ar);
    let hit = false;

    if (ar.hitKind !== "player") {
      for (const e of enemies) {
        if (e.fleeing) continue;
        if (ar._hitEnemies && ar._hitEnemies.includes(e)) continue;
        const et = ENEMY_TYPES[e.type];
        const enemyDrawY = et.flying ? groundY + (e.fy || -80) : groundY - 24;
        if (dist(ar.x, e.x) < et.w * 0.7 && Math.abs(ar.y - enemyDrawY) < 40) {
          const dmg = ar.dmgMult ? Math.round(ar.dmgMult) : 1;
          e.hp -= dmg; e.flash = 0.12; Audio.hit();
          if (ar.fireArrow) { e.burn = 3; e.burnTick = 0.5; spawnParticles(e.x, enemyDrawY, 5, "#ff6a20", 30, 40); }
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
              spawnParticles(e.x, enemyDrawY, 12, et.color, 80, 100);
              Audio.enemyDie();
              if (window._addXP) window._addXP(et.reward * 8);
              if (e.locIdx !== undefined && state.locations[e.locIdx]) {
                const loc = state.locations[e.locIdx];
                loc.remainingEnemies--;
                if (loc.remainingEnemies <= 0 && !loc.lootSpawned) {
                  loc.cleared = true; loc.lootSpawned = true;
                  state.chests.push({ x: loc.x, lootGold: loc.lootGold, weaponId: loc.weaponId, open: false, openAnim: 0, life: 1 });
                  if (window._floaty) window._floaty(loc.x, "📦 Kiste!", "#f2c14e");
                }
              }
              if (state.legendaryBoss === e) { state.legendaryBoss = null; state.legendaryEffects = []; for (const u of state.units) u.rallied = false; }
              const idx = state.enemies.indexOf(e); if (idx >= 0) state.enemies.splice(idx, 1);
            } else {
              killEnemy(e);
            }
          }
          if (hit) break;
        }
      }
    }

    if (!hit && ar.hitKind !== "player") {
      for (const a of animals) {
        if (a.alive && dist(ar.x, a.x) < 16 && ar.y > groundY - 36) {
          a.alive = false;
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
          player.hp -= 1; player.invuln = CFG.playerInvuln; player.hurt = 0.35; player.hpShowTimer = 3;
          player.knock = (player.x < ar.x ? -1 : 1) * -120;
          spawnParticles(player.x, groundY - 50, 4, "#c1453b");
          Audio.hit();
        }
        hit = true;
      }
    }

    if (hit || ar.life <= 0 || ar.y > groundY - 6) arrows.splice(i, 1);
  }
}
