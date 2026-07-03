import { ENEMY_TYPES } from '../config/enemies.js';
import { groundY } from '../core/canvas.js';
import { Game, state } from '../core/state.js';
import { spawnCoin, spawnParticles, floaty } from '../systems/world/SpawnSystem.js';
import { Audio } from '../systems/infrastructure/Audio.js';
import { registerEnemyKill } from '../systems/infrastructure/RoguelikeSystem.js';

export function spawnImpBlood(e, intensity = 1, y = null) {
  if (!e || e.type !== "imp") return;
  const yy = y ?? (groundY + (e.fy || 0) - 24);
  const power = Math.max(0.4, intensity);
  spawnParticles(e.x, yy, Math.ceil(5 * power), "#7a1020", 35 + power * 26, 36 + power * 32);
  spawnParticles(e.x, yy + 4, Math.ceil(3 * power), "#b12835", 24 + power * 20, 24 + power * 24);
  if (power > 1.4) spawnParticles(e.x, yy + 8, Math.ceil(2 * power), "#4b0710", 18 + power * 18, 18 + power * 16);
}

export function killEnemyWithAnimation(e, knockDirection = 0) {
  if (e.dying) return;
  const t = ENEMY_TYPES[e.type];
  const overkill = Math.max(0, -(e.hp || 0));
  const violence = e.type === "imp" ? Math.min(4, Math.sqrt(overkill) / 2.2) : 0;
  const brutal = violence > 1.25;

  // Start death animation
  e.dying = true;
  e.deathT = 0;
  e.deathDuration = e.type === "imp" ? 1.05 + violence * 0.32 : 0.5;
  e.deathKind = e.type === "imp" ? (brutal || Math.random() < 0.45 ? "impFallBack" : "impCrumple") : "fall";
  e.deathDir = knockDirection || (e.dir ? -e.dir : 1);
  e.deathSpin = e.type === "imp" ? (e.deathDir < 0 ? -1 : 1) * (0.85 + Math.random() * 0.35 + violence * 1.7) : 1;
  e.knock = e.type === "imp" ? e.deathDir * (110 + Math.random() * 70 + violence * 210) : knockDirection * 600;
  e.deathVy = e.type === "imp" && e.deathKind === "impFallBack" ? -(85 + Math.random() * 50 + violence * 95) : 0;
  if (t.flying) {
    e.deathDuration = Math.max(e.deathDuration, (e.fy !== undefined ? Math.abs(e.fy) : 80) / 260 + 0.35);
  }
  e.deathGravity = 420 + violence * 55;
  e.deathFriction = Math.max(1.8, 5.5 - violence * 0.75);
  e.overkillViolence = violence;

  // Spawn blood particles
  if (e.type === "imp") {
    spawnImpBlood(e, 2.2 + violence * 1.6);
    if (violence > 1.2) spawnImpBlood(e, 1.4 + violence, groundY + (e.fy || 0) - 12);
  } else {
    spawnParticles(e.x, groundY - 24, 15 + Math.floor(violence * 7), "#8a1a2a", 120 + violence * 55, 140 + violence * 60);
    spawnParticles(e.x, groundY - 20, 8 + Math.floor(violence * 4), "#aa3a4a", 80 + violence * 40, 100 + violence * 45);
  }

  Audio.enemyDie();
  registerEnemyKill(t.reward);
  if (window._addXP) window._addXP(t.reward * 8);

  if (t.legendary && state.legendaryBoss === e) {
    state.legendaryBoss = null;
    state.legendaryEffects = [];
    for (const u of state.units) u.rallied = false;
    spawnParticles(e.x, groundY - 80, 80, t.eye, 300, 250);
    if (window._floaty) window._floaty(e.x, "⚔ " + t.name + " besejret!", "#f2c14e");
  }

  if (e.type === "fireDragon") {
    state.lootItems.push({ x: e.x, weaponId: "meteor_tome", dropVy: -350, dropY: groundY - 150 });
    if (window._floaty) window._floaty(e.x, "⚔ Meteortome droppet!", "#f2c14e");
  }
  if (e.type === "magmaGolem") {
    state.lootItems.push({ x: e.x, weaponId: "sunblade", dropVy: -350, dropY: groundY - 150 });
    if (window._floaty) window._floaty(e.x, "⚔ Solblade droppet!", "#f2c14e");
  }

  // Coins are dropped during the death animation
  e.shouldDropCoins = true;
}

export function killEnemy(e) {
  if (e.type === "imp" && !e.dying) {
    const knockDir = e.combatTarget ? Math.sign(e.x - e.combatTarget.x) || 1 : (e.dir ? -e.dir : 1);
    killEnemyWithAnimation(e, knockDir);
    return;
  }
  const t = ENEMY_TYPES[e.type];
  registerEnemyKill(t.reward);
  for (let k = 0; k < t.reward; k++) spawnCoin(e.x + Math.random() * 44 - 22, 1, groundY - 28, Math.random() * 160 - 80, Math.random() * 120 - 260);
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
  const idx = state.enemies.indexOf(e);
  if (idx >= 0) state.enemies.splice(idx, 1);
}

export function updateDyingEnemies(dt) {
  const t = ENEMY_TYPES;
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (e.dying) {
      e.deathT += dt;
      const et = t[e.type];

      // Drop coins once during animation
      if (e.shouldDropCoins && e.deathT > 0.1) {
        for (let k = 0; k < et.reward; k++) spawnCoin(e.x + Math.random() * 44 - 22, 1, groundY - 28, Math.random() * 160 - 80, Math.random() * 120 - 260);
        e.shouldDropCoins = false;
      }

      // Knockback physics during death
      if (e.type === "imp") {
        if (e.knock) { e.x += e.knock * dt; e.knock *= Math.max(0, 1 - (e.deathFriction || 5.5) * dt); if (Math.abs(e.knock) < 2) e.knock = 0; }
        if (e.deathVy) {
          e.deathVy += (e.deathGravity || 420) * dt;
          e.fy = Math.min(0, (e.fy || 0) + e.deathVy * dt);
          if (e.fy >= 0) { e.fy = 0; e.deathVy = 0; }
        }
      } else if (e.knock) {
        e.x += e.knock * dt; e.knock *= 0.9; if (Math.abs(e.knock) < 2) e.knock = 0;
      }

      // Flying enemies tumble to the ground as they die
      if (et.flying && e.fy !== undefined && e.fy < 0) {
        e.deathVy = (e.deathVy || 0) + (e.deathGravity || 420) * dt;
        e.fy = Math.min(0, e.fy + e.deathVy * dt);
        if (e.fy >= 0) { e.fy = 0; e.deathVy = 0; }
      }

      if (e.deathT >= e.deathDuration) {
        state.enemies.splice(i, 1);
      }
    }
  }
}
