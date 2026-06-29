import { ENEMY_TYPES } from '../config/enemies.js';
import { groundY } from '../canvas.js';
import { Game, state } from '../state.js';
import { spawnCoin, spawnParticles, floaty } from '../systems/SpawnSystem.js';
import { Audio } from '../systems/Audio.js';

export function killEnemy(e) {
  const t = ENEMY_TYPES[e.type];
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
