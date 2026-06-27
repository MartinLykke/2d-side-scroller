import { CFG } from '../config/config.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { WEAPONS } from '../config/weapons.js';
import { clamp, dist, rand } from '../util/math.js';
import { groundY } from '../canvas.js';
import { Game, state } from '../state.js';
import { Audio } from './Audio.js';
import { spawnCoin, spawnParticles, floaty, spawnLocLoot } from './SpawnSystem.js';

// ---------- Arrow shooting ----------
// All callers shoot at enemies; hitKind defaults to "enemy".
// Flying enemies push "player"-targeted arrows directly into state.arrows.
export function shootArrow(x, y, target) {
  const tx = target.x, ty = groundY - 24;
  const ang = Math.atan2(ty - y, tx - x);
  const sp  = 560;
  state.arrows.push({
    x, y,
    vx: Math.cos(ang) * sp,
    vy: Math.sin(ang) * sp,
    target,
    life: 1.2,
    hitKind: "enemy",
  });
  Audio.bow();
}

export function updateArrows(dt) {
  const { arrows, enemies, animals, player } = state;
  for (let i = arrows.length - 1; i >= 0; i--) {
    const ar = arrows[i];
    ar.x += ar.vx * dt; ar.y += ar.vy * dt; ar.vy += 420 * dt; ar.life -= dt;
    let hit = false;

    if (ar.hitKind !== "player") {
      for (const e of enemies) {
        if (e.fleeing) continue;
        const et = ENEMY_TYPES[e.type];
        const enemyDrawY = et.flying ? groundY + (e.fy || -80) : groundY - 24;
        if (dist(ar.x, e.x) < et.w * 0.7 && Math.abs(ar.y - enemyDrawY) < 40) {
          e.hp--; e.flash = 0.12; Audio.hit();
          spawnParticles(e.x, enemyDrawY, 4, "#8a2a4a");
          hit = true;
          if (e.hp <= 0) killEnemy(e);
          break;
        }
      }
    }

    if (!hit && ar.hitKind !== "player") {
      for (const a of animals) {
        if (a.alive && dist(ar.x, a.x) < 16 && ar.y > groundY - 36) {
          a.alive = false;
          spawnParticles(a.x, groundY - 20, 8, "#7a4a2a");
          const reward = a.type === "deer" ? 3 : 1;
          for (let k = 0; k < reward; k++) spawnCoin(a.x + rand(-15, 15), 1, -30, rand(-40, 40));
          floaty(a.x, "+" + reward + "🪙", "#f2c14e");
          hit = true; break;
        }
      }
    }

    if (!hit && ar.hitKind === "player") {
      if (dist(ar.x, player.x) < 18 && Math.abs(ar.y - (groundY - 50)) < 50) {
        if (player.invuln <= 0 && !window._DEV_GOD_MODE) {
          player.hp -= 1; player.invuln = CFG.playerInvuln; player.hurt = 0.35;
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
  for (let k = 0; k < t.reward; k++) spawnCoin(e.x + rand(-18, 18), 1, -40, rand(-60, 60));
  spawnParticles(e.x, groundY - 24, 12, t.color === "#1f1830" ? "#ff2a6a" : "#6a2a4a", 80, 100);
  Audio.enemyDie();

  if (e.locIdx !== undefined && state.locations[e.locIdx]) {
    const loc = state.locations[e.locIdx];
    loc.remainingEnemies--;
    if (loc.remainingEnemies <= 0 && !loc.lootSpawned) {
      loc.cleared = true;
      spawnLocLoot(loc);
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
  player.hp    -= t.meleeDmg;
  player.invuln = CFG.playerInvuln;
  player.hurt   = 0.35;
  player.knock  = Math.sign(player.x - e.x) * knockForce;
  spawnParticles(player.x, groundY - 50, 6, "#c1453b");
  if (player.coins > 0) {
    player.coins--;
    floaty(player.x, "−1🪙", "#ff6a4a");
  } else {
    floaty(player.x, `−${t.meleeDmg}❤`, "#ff6a4a");
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
        player.hp -= 1; player.invuln = CFG.playerInvuln; player.hurt = 0.35;
        spawnParticles(player.x, groundY - 50, 5, "#c1453b");
        Audio.hit();
        e.attackCd = 1.5; e.fleeing = true;
      }
      continue;
    }

    e.anim += dt * 5;
    if (e.flash > 0) e.flash -= dt;
    e.attackCd -= dt;

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
        e.attackCd = 0.7;
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

    let unitTgt = null, ud = 28;
    for (const u of units) { const d = dist(e.x, u.x); if (d < ud) { ud = d; unitTgt = u; } }
    if (unitTgt) {
      e.dir = Math.sign(unitTgt.x - e.x) || e.dir;
      if (e.attackCd <= 0) {
        e.attackCd = 0.8;
        unitTgt.hp -= 2; unitTgt.panic = 1;
        spawnParticles(unitTgt.x, groundY - 30, 3, "#7a1f1f");
        Audio.hit();
      }
      continue;
    }

    if (dist(e.x, base.x) < 70) {
      e.dir = Math.sign(base.x - e.x) || e.dir;
      if (e.attackCd <= 0) {
        e.attackCd = 0.9;
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
      e.attackCd = 1;
      continue;
    }

    e.dir = Math.sign(base.x - e.x) || e.dir;
    e.x += e.dir * t.speed * dt;
  }
}

function updateLocEnemy(e, t, dt) {
  const { player } = state;
  e.anim += dt * 5;
  if (e.flash > 0) e.flash -= dt;
  e.attackCd -= dt;
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
}

// ---------- Player attack ----------
export function updatePlayerAttack(dt) {
  const { player, enemies } = state;
  if (!player.weapon) return;
  if (player.swing > 0) player.swing -= dt;
  player.attackCd -= dt;
  if (player.attackCd > 0) return;
  const w = WEAPONS[player.weapon];
  let tgt = null, bd = w.range;
  for (const e of enemies) {
    if (e.fleeing) continue;
    const d = dist(player.x, e.x);
    if (d < bd) { bd = d; tgt = e; }
  }
  if (!tgt) return;
  player.dir = Math.sign(tgt.x - player.x) || player.dir;
  player.swing = 0.32;
  if (w.type === "melee") {
    tgt.hp -= w.dmg; tgt.flash = 0.14; Audio.hit();
    spawnParticles(tgt.x, groundY - 28, 4, w.col);
    if (tgt.hp <= 0) killEnemy(tgt);
  } else {
    shootArrow(player.x, groundY - 72, tgt);
  }
  player.attackCd = w.speed;
}
