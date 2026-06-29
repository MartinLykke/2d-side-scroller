import { CFG } from '../config/config.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { WEAPONS, effectiveWeapon } from '../config/weapons.js';
import { ARMORS } from '../config/armor.js';
import { clamp, dist, rand } from '../util/math.js';
import { groundY } from '../canvas.js';
import { Game, state } from '../state.js';

// Weapon-specific melee impact visual burst + screen shake
function meleeWeaponImpact(weaponId, x, y) {
  switch (weaponId) {
    case "flame_sword":
      spawnParticles(x, y, 10, "#ff7730", 70, 90);
      spawnParticles(x, y, 6, "#ffcc40", 40, 70);
      spawnParticles(x, y, 4, "#ff2200", 50, 50);
      Game.screenShake = Math.max(Game.screenShake, 0.22);
      break;
    case "gilded_spear":
      spawnParticles(x, y, 12, "#f2c14e", 60, 130);
      spawnParticles(x, y, 6, "#ffffff", 30, 90);
      spawnParticles(x, y, 4, "#ffe080", 80, 60);
      Game.screenShake = Math.max(Game.screenShake, 0.18);
      break;
    case "shadow_axe":
      spawnParticles(x, y, 12, "#aa44cc", 80, 80);
      spawnParticles(x, y, 8, "#440066", 50, 50);
      spawnParticles(x, y, 4, "#ff88ff", 30, 100);
      Game.screenShake = Math.max(Game.screenShake, 0.3);
      break;
    case "thunder_blade":
      spawnParticles(x, y, 14, "#cc66ff", 90, 110);
      spawnParticles(x, y, 8, "#ffffff", 50, 140);
      spawnParticles(x, y, 6, "#aaaaff", 70, 80);
      Game.screenShake = Math.max(Game.screenShake, 0.42);
      break;
    case "kings_sword":
      spawnParticles(x, y, 20, "#f2c14e", 110, 130);
      spawnParticles(x, y, 10, "#ffffff", 70, 110);
      spawnParticles(x, y, 8, "#ff9940", 60, 90);
      Game.screenShake = Math.max(Game.screenShake, 0.48);
      break;
    case "sunblade":
      spawnParticles(x, y, 22, "#ffee80", 130, 150);
      spawnParticles(x, y, 14, "#ffffff", 80, 130);
      spawnParticles(x, y, 10, "#ff9940", 90, 100);
      spawnParticles(x, y, 6, "#ffcc00", 50, 170);
      Game.screenShake = Math.max(Game.screenShake, 0.6);
      break;
    case "ice_axe":
      spawnParticles(x, y, 10, "#6abaff", 70, 80);
      spawnParticles(x, y, 5, "#ffffff", 40, 60);
      break;
    default:
      spawnParticles(x, y, 6, "#8a4a8a", 50, 60);
      break;
  }
}

// Spawn trailing particles for special projectile weapons
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
import { Audio } from './Audio.js';
import { spawnCoin, spawnParticles, floaty, spawnLocLoot } from './SpawnSystem.js';
import { spawnLevelUpBeam } from '../rendering/Effects.js';

// ---------- Arrow shooting ----------
// All callers shoot at enemies; hitKind defaults to "enemy".
// Flying enemies push "player"-targeted arrows directly into state.arrows.
export function shootArrow(x, y, target, sourceUnit = null, weaponId = null) {
  const tx = target.x, ty = groundY - 24;
  const dx = tx - x, dy = ty - y;
  const dist_h = Math.hypot(dx, dy);

  // Arc trajectory: longer distances get more upward aim for a parabolic path
  const flightTime = dist_h / 400;
  const gravity = 420;

  // Calculate velocity to reach target with arc (aiming higher)
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
  // Afskydnings-effekt for specielle buer
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
          // Weapon-specific arrow impact
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
          // Ballista heavy visual
          if (ar.ballista) { spawnParticles(e.x, enemyDrawY, 14, "#cc8840", 90, 100); Game.screenShake = Math.max(Game.screenShake, 0.3); if (!et.noKnockback) e.knock = (e.knock||0) + Math.sign(e.x - ar.vx) * 500; }
          // Pierce / bounce logic
          if (ar.pierce > 0) {
            if (!ar._hitEnemies) ar._hitEnemies = [];
            ar._hitEnemies.push(e);
            ar.pierce--;
            hit = false; // keep arrow alive
          } else {
            hit = true;
          }
          // Bouncing: fire child arrow toward next nearest enemy
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
              // Archer kill: XP + gold
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

export function killEnemy(e) {
  const t = ENEMY_TYPES[e.type];
  for (let k = 0; k < t.reward; k++) spawnCoin(e.x + rand(-22, 22), 1, groundY - 28, rand(-80, 80), rand(-260, -140));
  spawnParticles(e.x, groundY - 24, 12, t.color === "#1f1830" ? "#ff2a6a" : "#6a2a4a", 80, 100);
  Audio.enemyDie();
  if (window._addXP) window._addXP(t.reward * 8);
  if (t.legendary && state.legendaryBoss === e) {
    state.legendaryBoss = null;
    state.legendaryEffects = [];
    for (const u of state.units) u.rallied = false;
    spawnParticles(e.x, groundY - 80, 80, t.eye, 300, 250);
    if (window._floaty) window._floaty(e.x, "⚔ " + t.name + " besejret!", "#f2c14e");
  }

  if (e.locIdx !== undefined && state.locations[e.locIdx]) {
    const loc = state.locations[e.locIdx];
    loc.remainingEnemies--;
    if (loc.remainingEnemies <= 0 && !loc.lootSpawned) {
      loc.cleared = true;
      loc.lootSpawned = true;
      state.chests.push({ x: loc.x, lootGold: loc.lootGold, weaponId: loc.weaponId, open: false, openAnim: 0, life: 1 });
      if (window._floaty) window._floaty(loc.x, "📦 Kiste!", "#f2c14e");
    }
  }
  const idx = state.enemies.indexOf(e);
  if (idx >= 0) state.enemies.splice(idx, 1);
}

// ---------- Shared damage helper ----------
// Applies one melee hit from enemy `e` (of type `t`) to the player.
// Returns true if the hit connected (i.e. player was not invulnerable).
function meleeHitPlayer(e, t, knockForce) {
  const { player } = state;
  if (player.invuln > 0 || window._DEV_GOD_MODE) return false;
  const armorDef = player.armor ? (ARMORS[player.armor]?.defense || 0) : 0;
  const dmg = Math.max(1, t.meleeDmg - armorDef);
  player.hp    -= dmg;
  player.invuln = CFG.playerInvuln;
  player.hurt   = 0.35; player.hpShowTimer = 3;
  player.knock  = Math.sign(player.x - e.x) * knockForce;
  spawnParticles(player.x, groundY - 50, 6, "#c1453b");
  if (player.coins > 0) {
    player.coins--;
    floaty(player.x, "−1🪙", "#ff6a4a");
  } else {
    floaty(player.x, `−${dmg}❤`, "#ff6a4a");
  }
  Audio.hit();
  return true;
}

// ---------- Enemy AI ----------
function wallAt(side, x) {
  let best = null;
  for (const w of state.walls) {
    if (!w.commissioned || w.hp <= 0 || w.side !== side) continue;
    if (side < 0 && w.x > x && w.x < CFG.baseX) { if (!best || w.x < best.x) best = w; }
    if (side > 0 && w.x < x && w.x > CFG.baseX) { if (!best || w.x > best.x) best = w; }
  }
  return best;
}

export function updateEnemies(dt) {
  const { enemies, units, base, player } = state;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const t = ENEMY_TYPES[e.type];
    if (e.home !== undefined) { updateLocEnemy(e, t, dt); continue; }
    if (t.legendary)          { updateLegendaryBoss(e, t, dt); continue; }

    if (t.flying) {
      e.anim += dt * 5;
      if (e.flash > 0) e.flash -= dt;
      e.attackCd -= dt;
      if (e.shootCd !== undefined) e.shootCd -= dt;
      if (e.fleeing) {
        const tx = e.portal ? e.portal.x : (e.x < CFG.baseX ? 0 : CFG.worldWidth);
        e.dir = Math.sign(tx - e.x); e.x += e.dir * t.speed * 1.6 * dt;
        if (dist(e.x, tx) < 40) enemies.splice(i, 1);
        continue;
      }
      // Fly toward base
      e.dir = Math.sign(base.x - e.x) || e.dir;
      e.x += e.dir * t.speed * dt;
      // Shoot arrow at player if in range
      if (e.shootCd !== undefined && e.shootCd <= 0 && dist(e.x, player.x) < 380) {
        const arrowY = groundY + (e.fy || -80);
        state.arrows.push({ x: e.x, y: arrowY, vx: Math.sign(player.x - e.x) * 320, vy: 180, target: {x: player.x}, life: 1.5, hitKind: "player" });
        e.shootCd = 2.2;
        Audio.bow();
      }
      // Damage player if directly overhead
      if (dist(e.x, player.x) < 28 && e.attackCd <= 0 && player.invuln <= 0 && !window._DEV_GOD_MODE) {
        player.hp -= 1; player.invuln = CFG.playerInvuln; player.hurt = 0.35; player.hpShowTimer = 3;
        spawnParticles(player.x, groundY - 50, 5, "#c1453b");
        Audio.hit();
        e.attackCd = 1.5; e.fleeing = true;
      }
      continue;
    }

    e.anim += dt * 5;
    if (e.flash > 0) e.flash -= dt;
    if (e.attackAnim > 0) e.attackAnim -= dt;
    e.attackCd -= dt;
    if (e.poisonCd !== undefined) e.poisonCd -= dt;
    if (e.knock) { e.x += e.knock * dt; e.knock *= Math.max(0, 1 - 9 * dt); if (Math.abs(e.knock) < 8) e.knock = 0; }
    // Burn (fire arrows)
    if (e.burn > 0) {
      e.burn -= dt;
      e.burnTick = (e.burnTick || 0) - dt;
      if (e.burnTick <= 0) { e.hp--; e.flash = 0.08; e.burnTick = 0.5; spawnParticles(e.x, groundY-28, 1, "#ff6a20", 12, 8); if (e.hp<=0) { killEnemy(e); continue; } }
    }
    // Slow (caltrops)
    if (e.slow > 0) e.slow -= dt;

    if (e.fleeing) {
      const tx = e.portal ? e.portal.x : (e.x < CFG.baseX ? 0 : CFG.worldWidth);
      e.dir = Math.sign(tx - e.x);
      e.x += e.dir * t.speed * 1.6 * dt;
      if (dist(e.x, tx) < 40) enemies.splice(i, 1);
      continue;
    }

    const side = e.x < CFG.baseX ? -1 : 1;
    const wall = wallAt(side, e.x);
    if (wall && dist(e.x, wall.x) < 30) {
      e.dir = Math.sign(wall.x - e.x) || e.dir;
      if (e.attackCd <= 0) {
        e.attackCd = 0.7; e.attackAnim = 0.22;
        wall.hp -= t.dmg; wall.flash = 0.15;
        spawnParticles(wall.x, groundY - 30, 3, "#caa46a", 30, 30);
        Audio.hit();
        if (wall.hp <= 0) {
          wall.hp = 0; wall.level = 0; wall.commissioned = false; wall.buildProgress = 0;
          floaty(wall.x, "💥 Mur faldet!", "#ff6a4a");
          spawnParticles(wall.x, groundY - 30, 16, "#caa46a", 80, 80);
        }
      }
      continue;
    }

    // Persistent aggro: clear stale target, then try to acquire within 200px
    if (e.aggroUnit && (!units.includes(e.aggroUnit) || dist(e.x, e.aggroUnit.x) > 340)) {
      e.aggroUnit = null;
    }
    if (!e.aggroUnit) {
      let best = null, bd = 200;
      for (const u of units) { const d = dist(e.x, u.x); if (d < bd) { bd = d; best = u; } }
      if (best) e.aggroUnit = best;
    }
    if (e.aggroUnit) {
      const d = dist(e.x, e.aggroUnit.x);
      e.dir = Math.sign(e.aggroUnit.x - e.x) || e.dir;
      if (d > 32) e.x += e.dir * t.speed * dt;
      if (d < 40 && e.attackCd <= 0) {
        const target = e.aggroUnit;
        // Smoke bomb: intercept melee hit on archers
        if (target.role === "archer" && target.smoked > 0) { e.attackCd = 0.8; continue; }
        if (target.role === "archer" && target.smoked <= 0 && state.archerSkills.includes("smoke_bomb")) {
          target.smoked = 2.0;
          spawnParticles(target.x, groundY - 30, 20, "#aaaaaa", 70, 60);
          floaty(target.x, "💨 Røg!", "#cccccc");
          e.attackCd = 1.2; e.aggroUnit = null;
          Audio.hit();
          continue;
        }
        e.attackCd = 0.8; e.attackAnim = 0.22;
        e.aggroUnit.hp -= 2; e.aggroUnit.panic = 1;
        spawnParticles(e.aggroUnit.x, groundY - 30, 3, "#7a1f1f");
        Audio.hit();
      }
      continue;
    }

    if (dist(e.x, base.x) < 70) {
      e.dir = Math.sign(base.x - e.x) || e.dir;
      if (e.attackCd <= 0) {
        e.attackCd = 0.9; e.attackAnim = 0.22;
        base.hp -= t.dmg; base.flash = 0.2;
        spawnParticles(base.x + rand(-30, 30), groundY - 30, 4, "#ff6a4a");
        Audio.hit();
        const c = state.coins.find(cc => cc.settled && dist(cc.x, base.x) < 120);
        if (c) { e.carry++; state.coins.splice(state.coins.indexOf(c), 1); e.fleeing = true; }
      }
      continue;
    }

    if (dist(e.x, player.x) < 30 && player.jumpH <= 0 && e.attackCd <= 0) {
      const hadCoins = player.coins > 0;
      if (meleeHitPlayer(e, t, 230) && hadCoins) e.carry++;
      e.fleeing = true;
      e.attackCd = 1; e.attackAnim = 0.25;
      continue;
    }

    // Ranged poison shot for large enemies
    if (t.rangedShoot && e.poisonCd <= 0 && dist(e.x, player.x) < t.shootRange) {
      const launchY = groundY - t.w * 0.7;
      const dx = player.x - e.x;
      const flightT = 1.4;
      const vx = dx / flightT;
      const vy = ((groundY - 40) - launchY - 0.5 * 500 * flightT * flightT) / flightT;
      state.poisonShots.push({ x: e.x, y: launchY, vx, vy, life: flightT + 0.4, landX: player.x, dmg: t.meleeDmg, sourceEnemy: e });
      e.poisonCd = t.shootInterval;
      e.attackAnim = 0.18;
      spawnParticles(e.x, launchY, 6, "#9944cc", 40, 30);
      Audio.bow();
    }

    e.dir = Math.sign(base.x - e.x) || e.dir;
    const slowMult = e.slow > 0 ? 0.45 : 1;
    e.x += e.dir * t.speed * slowMult * dt;
  }
}

function updateLocEnemy(e, t, dt) {
  const { player } = state;
  if (e.flash > 0) e.flash -= dt;
  e.attackCd -= dt;
  if (e.knock) { e.x += e.knock * dt; e.knock *= Math.max(0, 1 - 9 * dt); if (Math.abs(e.knock) < 8) e.knock = 0; }
  const prevX = e.x;
  const dp = dist(e.x, player.x);
  if (dp < 300) {
    const dir = Math.sign(player.x - e.x);
    e.dir = dir || e.dir;
    e.x += dir * t.speed * dt;
    if (dp < 32 && e.attackCd <= 0 && player.jumpH <= 0) {
      e.attackCd = 1.0;
      meleeHitPlayer(e, t, 220);
    }
  } else if (dist(e.x, e.home) > 50) {
    const dir = Math.sign(e.home - e.x);
    e.dir = dir || e.dir;
    e.x += dir * t.speed * 0.45 * dt;
  }
  if (Math.abs(e.x - prevX) > 0.02) e.anim += dt * 5;
}

// ---------- Magic spells ----------
function dealAoE(x, dmg, radius, col) {
  for (const e of state.enemies) {
    if (!e.fleeing && dist(e.x, x) < radius) {
      e.hp -= dmg; e.flash = 0.14;
      if (e.hp <= 0) killEnemy(e);
    }
  }
  spawnParticles(x, groundY - 10, 14, col, 100, 90);
}

function chainLightning(x, dmg, bounces) {
  if (bounces <= 0) return;
  let nearest = null, nd = 250; // Søgeradius for næste fjende
  for (const e of state.enemies) {
    const d = dist(e.x, x);
    if (!e.fleeing && d < nd && d > 10) { nd = d; nearest = e; }
  }
  if (!nearest) return;

  const enemyDrawY = groundY - 24; 

  // --- VISUEL ZIGZAG STRØMBRO MELLEM FJENDER ---
  let curX = x;
  let curY = enemyDrawY;
  const steps = 6; // Antal led i kædelynet
  
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const baseTargetX = nearest.x;
    const baseTargetY = enemyDrawY;
    
    const knækY = (i === steps) ? 0 : rand(-15, 15);
    const nxtX = curX + (baseTargetX - x) / steps;
    const nxtY = (baseTargetY * t) + (enemyDrawY * (1 - t)) + knækY;
    
    // Fyld partikler ind i leddet
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
  // ---------------------------------------------

  nearest.hp -= Math.max(1, Math.floor(dmg * 0.6)); 
  nearest.flash = 0.14;
  Audio.hit();
  spawnParticles(nearest.x, enemyDrawY, 10, "#ccccff", 60, 80);

  if (nearest.hp <= 0) {
    killEnemy(nearest);
  } else {
    // Fortsæt kæden (bounces - 1)
    chainLightning(nearest.x, dmg * 0.6, bounces - 1);
  }
}

function castSpell(player, wBase, tgt) {
  const ew = effectiveWeapon(player.weapon, player.weaponUpgrades || []);
  const aoeR = (wBase.aoeRadius || 0) + (ew.range - wBase.range) * 0.2;

  if (wBase.spellType === "lightning") {
    // 1. Gør skade med det samme på primært mål
    tgt.hp -= ew.dmg; 
    tgt.flash = 0.14; 
    Audio.hit();
    
    const enemyY = groundY - 24;
    spellEnemyImpact({ spellType: "lightning" }, tgt.x, enemyY);

    // 2. Generer en flot ZIGZAG-EFFEKT fra himlen ned til fjenden
    let currentX = tgt.x + rand(-20, 20); // starter lidt forskudt i skyerne
    let currentY = groundY - 1000;         // Højt oppe over skærmen
    const segments = 20;                   // Hvor mange knæk lynet har
    
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      // Træk en ret linje mod fjendens fod/center
      const targetBaseX = tgt.x;
      const targetBaseY = enemyY;
      
      // Lav et tilfældigt zigzag-knæk (undtagen det sidste segment, som skal ramme fjenden præcist)
      const knækX = (i === segments) ? 0 : rand(-35, 35);
      const nextX = (targetBaseX * t) + (currentX * (1 - t)) + knækX;
      const nextY = currentY + ((targetBaseY - (groundY - 1000)) / segments);
      
      // Fyld ud med partikler mellem hvert knæk for at gøre linjen synlig og ubrudt
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

    // 3. Aktivér kædelynet (bounces) videre fra fjendens position
    chainLightning(tgt.x, ew.dmg, 1);

    if (tgt.hp <= 0) killEnemy(tgt);
    
    // Spiller glød
    spawnParticles(player.x, groundY - 72, 10, wBase.col, 50, 70);
    Audio.bow();
    return; // Stop her! Lynet skal ikke tilføjes til state.spells
  }

  // --- STANDARD LOGIK FOR ANDRE SPELLS (Meteor, Fireball, osv.) ---
  let startX = player.x;
  let startY = groundY - 72;
  let targetX = tgt.x;
  let targetY = groundY - 28;
  let spd = wBase.spellType === "waterjet" ? 480 : 330;
  let life = 2.2;

  if (wBase.spellType === "meteor") {
    const dir = Math.sign(tgt.x - player.x) || 1;
    startX = player.x - (250 * dir); 
    startY = groundY - 1500; 
    spd = 650; 
    targetX = tgt.x + (210 * dir); 
    life = 4.0;
  } 

  const ang = Math.atan2(targetY - startY, targetX - startX);

  state.spells.push({
    x: startX, 
    y: startY,
    vx: Math.cos(ang) * spd,
    vy: Math.sin(ang) * spd,
    spellType: wBase.spellType || "arcane",
    dmg: ew.dmg,
    life: life,
    col: wBase.col,
    aoeRadius: aoeR,
    age: 0,
  });

  spawnParticles(player.x, groundY - 72, 10, wBase.col, 50, 70);
  Audio.bow();
}

export function updateSpells(dt) {
  if (!state.spells || !state.spells.length) return;
  const { spells, enemies } = state;
  for (let i = spells.length - 1; i >= 0; i--) {
    const sp = spells[i];
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    sp.age = (sp.age || 0) + dt;
    const grav = sp.spellType === "meteor" ? 650 : sp.spellType === "waterjet" ? 80 : 280;
    sp.vy += grav * dt;
    sp.life -= dt;

    // Trailing particles per frame
    spellTrail(sp);

    const hitGround = sp.y > groundY - 8;
    if (sp.life <= 0 || hitGround) {
      if (sp.aoeRadius > 0 && hitGround) {
        spellGroundImpact(sp);
        dealAoE(sp.x, sp.dmg, sp.aoeRadius, sp.col);
      }
      spells.splice(i, 1);
      continue;
    }
    let hit = false;
    for (const e of enemies) {
      if (e.fleeing) continue;
      const et = ENEMY_TYPES[e.type];
      const ey = groundY + (e.fy || 0) - 24;
      if (dist(sp.x, e.x) < et.w * 0.75 && Math.abs(sp.y - ey) < 44) {
        e.hp -= sp.dmg; e.flash = 0.14; Audio.hit();
        spellEnemyImpact(sp, e.x, ey);
        if (!et.noKnockback) e.knock = (e.knock || 0) + Math.sign(e.x - sp.vx) * 140;
        if (e.hp <= 0) killEnemy(e);
        else if (sp.aoeRadius > 0) dealAoE(sp.x, Math.max(1, Math.floor(sp.dmg * 0.65)), sp.aoeRadius, sp.col);
        if (sp.spellType === "lightning") chainLightning(sp.x, sp.dmg, 1);
        hit = true; break;
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

// ---------- Player attack ----------
export function updatePlayerAttack(dt) {
  const { player, enemies } = state;
  if (!player.weapon) return;
  if (player.swing > 0) player.swing -= dt;
  player.attackCd -= dt;
  if (player.attackCd > 0) return;
  const wBase = WEAPONS[player.weapon];
  const w = effectiveWeapon(player.weapon, player.weaponUpgrades || []);
  let tgt = null, bd = w.range;
  for (const e of enemies) {
    const d = dist(player.x, e.x);
    if (d < bd) { bd = d; tgt = e; }
  }
  if (!tgt) return;
  player.dir = Math.sign(tgt.x - player.x) || player.dir;
  player.swing = 0.32;
if (wBase.type === "melee") {
    tgt.hp -= w.dmg; tgt.flash = 0.14; Audio.hit();
    meleeWeaponImpact(player.weapon, tgt.x, groundY - 28);
    floaty(tgt.x, "-" + w.dmg, wBase.col);
    const et = ENEMY_TYPES[tgt.type];
    if (!et.noKnockback) tgt.knock = (tgt.knock || 0) + Math.sign(tgt.x - player.x) * 220;
    if (tgt.hp <= 0) killEnemy(tgt);
  } else if (wBase.type === "ranged") {
    shootArrow(player.x, groundY - 72, tgt, null, player.weapon);
  } else {
    castSpell(player, wBase, tgt);
  }
  
  // --- KONTROL AF SPELL COOLDOWN ---
  let cooldown = w.speed;
  if (wBase.spellType === "meteor") {
    cooldown *= 2.5; // Gør meteoren 2.5 gange langsommere at kaste. Justér tallet efter behov!
  }
  player.attackCd = cooldown;
}

// ---------- Legendary boss AI ----------
function executeLegendaryAttack(e, t) {
  const { player, units, walls, legendaryEffects } = state;
  if (e.type === "legend1") {
    // Ground stomp: shockwave AoE, damages player+units+walls
    const r = 170;
    legendaryEffects.push({ type:"ring", x:e.x, radius:0, maxR:r, totalLife:0.7, life:0.7, col:"#ff6a00", width:12 });
    legendaryEffects.push({ type:"ring", x:e.x, radius:0, maxR:r*0.55, totalLife:0.5, life:0.5, col:"#ffaa00", width:7 });
    spawnParticles(e.x, groundY-8, 40, "#ff6a00", 240, 50);
    if (dist(e.x, player.x) < r && player.jumpH <= 0) meleeHitPlayer(e, t, 500);
    for (const u of units) { if (dist(e.x, u.x) < r) { u.hp -= 2; u.panic = 2.5; u.knock = Math.sign(u.x - e.x) * 380; spawnParticles(u.x, groundY-20, 5, "#ff6a00", 60, 80); } }
    for (const w of walls) { if (w.commissioned && w.hp > 0 && dist(e.x, w.x) < r) { w.hp -= 22; w.flash = 0.4; } }
    Audio.hit();
  } else if (e.type === "legend2") {
    // Charge: set high velocity toward base
    e.chargeVx = Math.sign(state.base.x - e.x) * 680;
    legendaryEffects.push({ type:"ring", x:e.x, radius:0, maxR:120, totalLife:0.4, life:0.4, col:"#00c8ff", width:8 });
    spawnParticles(e.x, groundY-30, 20, "#00c8ff", 120, 60);
    Audio.hit();
  } else if (e.type === "legend3") {
    // Void pulse: massive ring, heavy AoE
    const r = 310;
    legendaryEffects.push({ type:"ring", x:e.x, radius:0, maxR:r,      totalLife:1.1, life:1.1, col:"#cc00ff", width:16 });
    legendaryEffects.push({ type:"ring", x:e.x, radius:0, maxR:r*0.6,  totalLife:0.8, life:0.8, col:"#8800aa", width:9  });
    legendaryEffects.push({ type:"ring", x:e.x, radius:0, maxR:r*0.25, totalLife:0.5, life:0.5, col:"#ffffff", width:5  });
    spawnParticles(e.x, groundY-40, 60, "#cc00ff", 350, 120);
    if (dist(e.x, player.x) < r && player.jumpH <= 0) meleeHitPlayer(e, t, 600);
    for (const u of units) { if (dist(e.x, u.x) < r) { u.hp -= 3; u.panic = 3; u.knock = Math.sign(u.x - e.x) * 450; spawnParticles(u.x, groundY-20, 6, "#cc00ff", 80, 100); } }
    for (const w of walls) { if (w.commissioned && w.hp > 0 && dist(e.x, w.x) < r) { w.hp -= 38; w.flash = 0.5; } }
    Audio.hit();
  }
}

function updateLegendaryBoss(e, t, dt) {
  const { player, base, units } = state;
  e.anim += dt * (e.specialPhase === 1 ? 0.8 : e.specialPhase === 2 && e.type === "legend2" ? 7 : 2);
  if (e.flash > 0) e.flash -= dt;
  e.attackCd -= dt;

  // Special attack state machine
  if (e.specialPhase === 0) {
    e.specialCd -= dt;
    if (e.specialCd <= 0) {
      e.specialPhase = 1;
      e.specialTimer = t.windupTime;
      if (window._floaty) window._floaty(e.x, "⚠ " + t.attackName, t.eye);
      spawnParticles(e.x, groundY - t.w * 0.5, 12, t.eye, 80, 40);
    }
  } else if (e.specialPhase === 1) {
    e.specialTimer -= dt;
    if (Math.random() < 0.35) spawnParticles(e.x + rand(-t.w*0.35, t.w*0.35), groundY - 10, 2, t.eye, 50, 20);
    if (e.specialTimer <= 0) { e.specialPhase = 2; e.specialTimer = t.execTime; executeLegendaryAttack(e, t); }
  } else if (e.specialPhase === 2) {
    e.specialTimer -= dt;
    // legend2 charge movement
    if (e.type === "legend2" && e.chargeVx) {
      e.x += e.chargeVx * dt;
      spawnParticles(e.x - Math.sign(e.chargeVx)*30, groundY - 40, 3, t.eye, 60, 40);
      if (dist(e.x, player.x) < t.w*0.55 && player.jumpH <= 0 && player.invuln <= 0 && e.attackCd <= 0) {
        meleeHitPlayer(e, t, 700); e.attackCd = 0.4;
      }
      for (const u of units) { if (dist(e.x, u.x) < t.w*0.45) { u.hp -= 3; u.panic = 2.5; u.knock = Math.sign(u.x - e.x) * 350; } }
    }
    if (e.specialTimer <= 0) { e.specialPhase = 0; e.specialCd = t.specialCooldown; e.chargeVx = 0; }
  }

  // Movement + wall/base targeting (only in idle phase)
  if (e.specialPhase === 0) {
    const side = e.x < CFG.baseX ? -1 : 1;
    const wall = wallAt(side, e.x);
    if (wall && dist(e.x, wall.x) < t.w * 0.58) {
      // Attack wall — don't advance
      e.dir = Math.sign(wall.x - e.x) || e.dir;
      if (e.attackCd <= 0) {
        e.attackCd = 1.1;
        wall.hp -= t.dmg; wall.flash = 0.2;
        spawnParticles(wall.x, groundY - 30, 8, "#caa46a", 70, 60);
        Audio.hit();
        if (wall.hp <= 0) {
          wall.hp = 0; wall.level = 0; wall.commissioned = false; wall.buildProgress = 0;
          floaty(wall.x, "💥 Mur faldet!", "#ff6a4a");
          spawnParticles(wall.x, groundY - 30, 24, "#caa46a", 110, 100);
        }
      }
    } else {
      // Advance toward base
      e.dir = Math.sign(base.x - e.x) || e.dir;
      e.x += e.dir * t.speed * dt;
      // Attack base when adjacent
      if (dist(e.x, base.x) < t.w * 0.58 && e.attackCd <= 0) {
        e.attackCd = 1.8;
        base.hp -= t.dmg; base.flash = 0.3;
        spawnParticles(base.x + rand(-30, 30), groundY - 30, 8, "#ff6a4a", 70, 70);
        floaty(base.x, `-${t.dmg}`, "#ff6a4a");
        Audio.hit();
        if (base.hp < 0) base.hp = 0;
      }
    }
  } else if (e.specialPhase === 2 && e.type !== "legend2") {
    // Hold position during non-charge executions
  }

  // Basic melee vs player
  if (e.specialPhase === 0 && dist(e.x, player.x) < t.w * 0.52 && player.jumpH <= 0 && e.attackCd <= 0) {
    meleeHitPlayer(e, t, 450); e.attackCd = 2.2;
  }
  // Basic melee vs units
  if (e.specialPhase === 0 && e.attackCd <= 0) {
    for (const u of units) {
      if (dist(e.x, u.x) < t.w * 0.5) {
        u.hp -= t.meleeDmg * 2; u.panic = 1.5;
        u.knock = Math.sign(u.x - e.x) * 220;
        spawnParticles(u.x, groundY - 30, 6, "#c1453b", 60, 80);
        Audio.hit(); e.attackCd = 1.8; break;
      }
    }
  }
}

export function updatePoisonShots(dt) {
  const shots = state.poisonShots;
  if (!shots || !shots.length) return;
  const { player } = state;
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 500 * dt;
    s.life -= dt;
    if (s.y >= groundY - 10 || s.life <= 0) {
      spawnParticles(s.x, groundY - 8, 10, "#88cc44", 60, 50);
      spawnParticles(s.x, groundY - 8, 6, "#aa44ff", 40, 30);
      if (dist(s.x, player.x) < 44 && player.jumpH <= 0 && player.invuln <= 0 && !window._DEV_GOD_MODE) {
        const dmg = s.dmg || 1;
        player.hp -= dmg;
        player.invuln = CFG.playerInvuln; player.hurt = 0.35; player.hpShowTimer = 3;
        player.knock = Math.sign(player.x - s.x) * 160;
        spawnParticles(player.x, groundY - 50, 6, "#88cc44");
        floaty(player.x, `−${dmg}☠`, "#88cc44");
        Audio.hit();
      }
      shots.splice(i, 1);
    }
  }
}

export function updateLegendaryEffects(dt) {
  const { legendaryEffects } = state;
  for (let i = legendaryEffects.length - 1; i >= 0; i--) {
    const ef = legendaryEffects[i];
    ef.life -= dt;
    if (ef.life <= 0) { legendaryEffects.splice(i, 1); continue; }
    if (ef.type === "ring") ef.radius = ef.maxR * (1 - ef.life / ef.totalLife);
  }
}
