import { state, Game } from '../state.js';
import { LOC_DEFS } from '../config/locations.js';
import { CFG } from '../config/config.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { W } from '../canvas.js';
import { dist, rand, pick, mulberry32 } from '../util/math.js';
import { floaty, spawnLocLoot, makeLocation } from './SpawnSystem.js';

export const LOC_FADE_DIST   = 900;
export const LOC_FADE_TIME   = 4.0;
export const LOC_RESPAWN_MIN = 90;
export const LOC_RESPAWN_MAX = 180;
export const LOC_RESPAWN_DIST = 1200;

let addXPFn = null;

export function setAddXP(fn) {
  addXPFn = fn;
}

export function updateLocations(dt) {

  if (!state.locRespawnQueue) state.locRespawnQueue = [];
  const { locations, player } = state;

  // Tick respawn queue
  for (let i = state.locRespawnQueue.length - 1; i >= 0; i--) {
    const entry = state.locRespawnQueue[i];
    entry.timer -= dt;
    if (entry.timer <= 0 && dist(player.x, entry.x) > LOC_RESPAWN_DIST) {
      const r = mulberry32((Game.treeSeed || 1) * 13 + entry.x);
      const roll = r();
      let type;
      if      (roll < 0.55) type = pick(["camp","wagon","grave","shack","huntingstand","fallenTree"]);
      else if (roll < 0.82) type = pick(["ruins","cave","battlefield","mill","ruinedwatchtower"]);
      else if (roll < 0.95) type = pick(["watchtower","shrine","abandonedfort"]);
      else                  type = "altar";
      locations.push(makeLocation(entry.x, type, r));
      state.locRespawnQueue.splice(i, 1);
    }
  }

  const screenL = Game.cam - 500, screenR = Game.cam + W + 500;
  for (let i = locations.length - 1; i >= 0; i--) {
    const loc = locations[i];

    // Cleared location fade-out when player walks away
    if (loc.cleared && loc.lootSpawned) {
      const far = dist(player.x, loc.x) > LOC_FADE_DIST;
      if (far) {
        loc.fadeTimer = (loc.fadeTimer || 0) + dt;
        loc.fadeAlpha = Math.max(0, 1 - loc.fadeTimer / LOC_FADE_TIME);
        if (loc.fadeTimer >= LOC_FADE_TIME) {
          state.locRespawnQueue.push({ x: loc.x, timer: rand(LOC_RESPAWN_MIN, LOC_RESPAWN_MAX) });
          locations.splice(i, 1);
          continue;
        }
      } else {
        loc.fadeTimer = Math.max(0, (loc.fadeTimer || 0) - dt * 2);
        loc.fadeAlpha = Math.max(0, 1 - loc.fadeTimer / LOC_FADE_TIME);
      }
    }

    if (!loc.preActivated && loc.x >= screenL && loc.x <= screenR) preActivateLocation(loc, i);
    if (!loc.triggered && dist(player.x, loc.x) < LOC_DEFS[loc.type].trig) {
      loc.triggered = true;
      const def = LOC_DEFS[loc.type];
      floaty(loc.x, def.emoji + " " + def.name + "!", "#ff8a6a");
      if (addXPFn) addXPFn(25 + loc.enemyCount * 5);
      // Release survivors when player arrives
      const vcount = def.vagrants || 0;
      let spawned = 0;
      for (let j=0; j<vcount; j++) {
        if (state.vagrants.length + state.units.length >= CFG.popCapByLevel[state.base.level]) break;
        state.vagrants.push({ x: loc.x + rand(-60,60), vx:0, targetX: CFG.baseX + rand(-260,260), state:"wander", anim:rand(0,6), speed:190 });
        spawned++;
      }
      if (spawned > 0) setTimeout(()=>floaty(loc.x, `🙋 ${spawned} overlevende!`, "#cdbfa3"), 400);
      // Empty locations: spawn loot directly (no chest to open)
      if (loc.enemyCount === 0 && !loc.lootSpawned) {
        loc.cleared = true;
        spawnLocLoot(loc);
      }
    }
  }
}

export function preActivateLocation(loc, idx) {
  loc.preActivated = true;
  const def = LOC_DEFS[loc.type];
  if (loc.enemyCount === 0) {
    // No enemies — loot spawns when player walks by (triggered), not here
    return;
  }
  loc.remainingEnemies = loc.enemyCount;
  for (let i=0; i<loc.enemyCount; i++) {
    const type=pick(def.etype), ex=loc.x+(i%2===0?-1:1)*(28+i*18);
    state.enemies.push({ x:ex, vx:0, type, hp:ENEMY_TYPES[type].hp, maxHp:ENEMY_TYPES[type].hp, dir:state.player.x<ex?-1:1, attackCd:0, carry:0, anim:rand(0,6), flash:0, fleeing:false, portal:null, locIdx:idx, home:loc.x });
  }
}
