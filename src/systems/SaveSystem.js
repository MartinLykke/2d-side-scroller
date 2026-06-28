import { Game, state } from '../state.js';
import { CFG } from '../config/config.js';
import { makeUnit } from '../entities/Unit.js';
import { spawnVagrant, planNight } from './SpawnSystem.js';

const SAVE_KEY = "kingdom_embers_save_v1";

export function saveGame() {
  if (Game.state !== "play") return;
  try {
    const { player, base, walls, units, vagrants, locations } = state;
    const snap = {
      day: Game.day, time: Game.time, treeSeed: Game.treeSeed,
      coins: player.coins, px: player.x, hasCrown: player.hasCrown,
      hp: player.hp, weapon: player.weapon, armor: player.armor,
      locations: locations.map(l => ({ triggered: l.triggered, cleared: l.cleared, lootSpawned: l.lootSpawned })),
      base: { level: base.level, hp: base.hp, maxHp: base.maxHp },
      walls: walls.map(w => ({ commissioned: w.commissioned, level: w.level, hp: w.hp, maxHp: w.maxHp, buildProgress: w.buildProgress })),
      units: units.map(u => ({ role: u.role, x: u.x })),
      vagrants: vagrants.length,
      farm: state.farmBuilt,
      farmLevel: state.farmLevel,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
  } catch (e) {}
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

// Returns true if a save was found and loaded. Caller must have already
// called newGame() to reset state before invoking this.
export function loadGame() {
  try {
    const snap = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!snap) return false;

    Game.day = snap.day; Game.time = snap.time; Game.treeSeed = snap.treeSeed;
    const { player, base, walls, locations } = state;
    player.coins = snap.coins; player.x = snap.px; player.hasCrown = snap.hasCrown;
    player.hp = snap.hp || CFG.playerMaxHp;
    player.weapon = snap.weapon || null;
    player.armor  = snap.armor  || null;

    if (snap.locations) snap.locations.forEach((s, i) => { if (locations[i]) Object.assign(locations[i], s); });
    base.level = snap.base.level; base.hp = snap.base.hp; base.maxHp = snap.base.maxHp;
    walls.forEach((w, i) => { const s = snap.walls[i]; if (s) Object.assign(w, s); });
    state.units = snap.units.map(s => makeUnit(s.role, s.x));
    state.vagrants = [];
    for (let i = 0; i < (snap.vagrants || 0); i++) spawnVagrant();
    state.farmBuilt = snap.farm;
    state.farmLevel = snap.farmLevel || (snap.farm ? 1 : 0);
    Game.threatLevel = Math.max(1, snap.day || 1);
    planNight();
    return true;
  } catch (e) { return false; }
}

export function deleteSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}
