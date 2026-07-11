import { state, Game } from '../../core/state.js';
import { LOC_DEFS } from '../../config/locations.js';
import { CFG } from '../../config/config.js';
import { ENEMY_TYPES } from '../../config/enemies.js';
import { W } from '../../core/canvas.js';
import { dist, rand, pick, mulberry32 } from '../../util/math.js';
import { floaty, spawnLocLoot, makeLocation } from './SpawnSystem.js';

export const LOC_FADE_DIST   = 900;
export const LOC_FADE_TIME   = 4.0;
export const LOC_RESPAWN_MIN = 90;
export const LOC_RESPAWN_MAX = 180;
export const LOC_RESPAWN_DIST = 1200;

let addXPFn = null;

function archerNearLocation(loc, trig) {
  return state.units.some(u => u.role === "archer" && u.hp > 0 && !u.dying && dist(u.x, loc.x) < trig);
}

function releaseLocationSurvivors(loc) {
  if (!loc.remainingVagrants) return;

  const popCap = CFG.popCapByLevel[state.base.level];
  const freeSlots = Math.max(0, popCap - (state.vagrants.length + state.units.length));
  if (freeSlots <= 0) {
    loc.blockedUntilExit = true;
    return;
  }

  const spawned = Math.min(loc.remainingVagrants, freeSlots);
  for (let j = 0; j < spawned; j++) {
    state.vagrants.push({ x: loc.x + rand(-60, 60), vx: 0, targetX: CFG.baseX + rand(-260, 260), state: "wander", anim: rand(0, 6), speed: 190 });
  }
  loc.remainingVagrants -= spawned;
  if (loc.remainingVagrants > 0) loc.blockedUntilExit = true;
}

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
      if      (roll < 0.55) type = pick(["camp", "wagon", "grave", "shack", "huntingstand", "fallenTree"]);
      else if (roll < 0.82) type = pick(["ruins", "cave", "battlefield", "mill", "ruinedwatchtower"]);
      else if (roll < 0.95) type = pick(["watchtower", "shrine", "abandonedfort"]);
      else                  type = "altar";
      locations.push(makeLocation(entry.x, type, r));
      state.locRespawnQueue.splice(i, 1);
    }
  }

  const screenL = Game.cam - 500, screenR = Game.cam + W + 500;
  for (let i = locations.length - 1; i >= 0; i--) {
    const loc = locations[i];
    const def = LOC_DEFS[loc.type];
    const nearLoc = dist(player.x, loc.x) < def.trig;
    // Archers can also discover locations holding survivors and recruit them
    const nearArcher = loc.remainingVagrants > 0 && archerNearLocation(loc, def.trig);
    if (loc.blockedUntilExit && !nearLoc && !nearArcher) loc.blockedUntilExit = false;

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
    if (!loc.triggered && (nearLoc || nearArcher)) {
      loc.triggered = true;
      if (addXPFn) addXPFn(25 + loc.enemyCount * 5);
      // Empty locations: spawn loot directly (no chest to open)
      if (loc.enemyCount === 0 && !loc.lootSpawned) {
        loc.cleared = true;
        spawnLocLoot(loc);
      }
    }

    if (loc.triggered && loc.remainingVagrants > 0 && (nearLoc || nearArcher) && !loc.blockedUntilExit) {
      releaseLocationSurvivors(loc);
    }
  }
}

export function preActivateLocation(loc, idx) {
  loc.preActivated = true;
  const def = LOC_DEFS[loc.type];
  if (loc.enemyCount === 0) {
    // No enemies - loot spawns when player walks by (triggered), not here
    return;
  }
  loc.remainingEnemies = loc.enemyCount;
  for (let i = 0; i < loc.enemyCount; i++) {
    const type = pick(def.etype), ex = loc.x + (i % 2 === 0 ? -1 : 1) * (28 + i * 18);
    state.enemies.push({ x: ex, vx: 0, type, hp: ENEMY_TYPES[type].hp, maxHp: ENEMY_TYPES[type].hp, dir: state.player.x < ex ? -1 : 1, attackCd: 0, carry: 0, anim: rand(0, 6), flash: 0, fleeing: false, portal: null, locIdx: idx, home: loc.x });
  }
}
