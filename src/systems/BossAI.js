import { CFG } from '../config/config.js';
import { dist, rand } from '../util/math.js';
import { groundY } from '../canvas.js';
import { state } from '../state.js';
import { Audio } from './Audio.js';
import { spawnParticles, floaty } from './SpawnSystem.js';
import { meleeHitPlayer } from './PlayerCombat.js';

function executeLegendaryAttack(e, t) {
  const { player, units, walls, legendaryEffects } = state;
  if (e.type === "legend1") {
    const r = 170;
    legendaryEffects.push({ type:"ring", x:e.x, radius:0, maxR:r, totalLife:0.7, life:0.7, col:"#ff6a00", width:12 });
    legendaryEffects.push({ type:"ring", x:e.x, radius:0, maxR:r*0.55, totalLife:0.5, life:0.5, col:"#ffaa00", width:7 });
    spawnParticles(e.x, groundY-8, 40, "#ff6a00", 240, 50);
    if (dist(e.x, player.x) < r && player.jumpH <= 0) meleeHitPlayer(e, t, 500);
    for (const u of units) { if (dist(e.x, u.x) < r) { u.hp -= 2; u.panic = 2.5; u.knock = Math.sign(u.x - e.x) * 380; spawnParticles(u.x, groundY-20, 5, "#ff6a00", 60, 80); } }
    for (const w of walls) { if (w.commissioned && w.hp > 0 && dist(e.x, w.x) < r) { w.hp -= 22; w.flash = 0.4; } }
    Audio.hit();
  } else if (e.type === "legend2") {
    e.chargeVx = Math.sign(state.base.x - e.x) * 680;
    legendaryEffects.push({ type:"ring", x:e.x, radius:0, maxR:120, totalLife:0.4, life:0.4, col:"#00c8ff", width:8 });
    spawnParticles(e.x, groundY-30, 20, "#00c8ff", 120, 60);
    Audio.hit();
  } else if (e.type === "legend3") {
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

export function updateLegendaryBoss(e, t, dt) {
  const { player, base, units } = state;
  e.anim += dt * (e.specialPhase === 1 ? 0.8 : e.specialPhase === 2 && e.type === "legend2" ? 7 : 2);
  if (e.flash > 0) e.flash -= dt;
  e.attackCd -= dt;

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

  if (e.specialPhase === 0) {
    const side = e.x < CFG.baseX ? -1 : 1;
    const wall = wallAtForBoss(side, e.x);
    if (wall && dist(e.x, wall.x) < t.w * 0.58) {
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
      e.dir = Math.sign(base.x - e.x) || e.dir;
      e.x += e.dir * t.speed * dt;
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

  if (e.specialPhase === 0 && dist(e.x, player.x) < t.w * 0.52 && player.jumpH <= 0 && e.attackCd <= 0) {
    meleeHitPlayer(e, t, 450); e.attackCd = 2.2;
  }
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

function wallAtForBoss(side, x) {
  let best = null;
  for (const w of state.walls) {
    if (!w.commissioned || w.hp <= 0 || w.side !== side) continue;
    if (side < 0 && w.x > x && w.x < CFG.baseX) { if (!best || w.x < best.x) best = w; }
    if (side > 0 && w.x < x && w.x > CFG.baseX) { if (!best || w.x > best.x) best = w; }
  }
  return best;
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
