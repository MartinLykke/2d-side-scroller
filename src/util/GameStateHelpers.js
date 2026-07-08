import { state, Game } from '../core/state.js';
import { CFG } from '../config/config.js';
import { groundY } from '../core/canvas.js';
import { rand } from './math.js';
import { Audio } from '../systems/infrastructure/Audio.js';
import { floaty, spawnParticles } from '../systems/world/SpawnSystem.js';
import { baseName } from '../rendering/HUD.js';

let buildStationsFn = null;

export function setBuildStations(fn) {
  buildStationsFn = fn;
}

export function upgradeBase() {
  const { base } = state;
  if (base.level >= 4) return;
  base.level++;
  base.maxHp = CFG.baseMaxHp[base.level];
  base.hp    = base.maxHp;
  base.flash = 1;
  Audio.upgrade();

  if (base.level === 4) {
    state.player.maxHp++;
    state.player.hp = Math.min(state.player.hp + 1, state.player.maxHp);
    state.player.hasCrown = true;
    spawnParticles(base.x, groundY - 80, 24, "#f2c14e", 120, 160);
  }
  if (buildStationsFn) buildStationsFn();
}

export function pickupWeapon(weaponId) {
  const { player, lootItems } = state;
  if (player.weapon) lootItems.push({ x: player.x + rand(-60, 60), weaponId: player.weapon });
  player.weapon = weaponId;
  player.weaponUpgrades = [];
  state.weaponPickup = { weaponId, timer: 3.8 };
  Audio.pickup();
}
