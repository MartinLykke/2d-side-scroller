import { state } from '../core/state.js';
import { CFG } from '../config/config.js';
import { groundY } from '../core/canvas.js';
import { Audio } from '../systems/infrastructure/Audio.js';
import { floaty, spawnParticles } from '../systems/world/SpawnSystem.js';
import { storeWeapon } from '../systems/economy/InventorySystem.js';
import { baseName } from '../rendering/HUD.js?v=biomeactive1';
import { baseMaxHpForLevel } from './DefenseStats.js';

let buildStationsFn = null;

export function setBuildStations(fn) {
  buildStationsFn = fn;
}

export function upgradeBase() {
  const { base } = state;
  if (base.level >= CFG.maxBaseLevel) return;
  base.level++;
  base.maxHp = baseMaxHpForLevel(base.level);
  base.hp    = base.maxHp;
  base.flash = 1;
  Audio.upgrade();

  if (base.level === 4) {
    state.player.maxHp++;
    state.player.hp = Math.min(state.player.hp + 1, state.player.maxHp);
    state.player.hasCrown = true;
    spawnParticles(base.x, groundY - 80, 24, "#f2c14e", 120, 160);
  }
  if (base.level === CFG.maxBaseLevel) {
    state.player.maxHp++;
    state.player.hp = Math.min(state.player.hp + 1, state.player.maxHp);
    floaty(base.x, "👑 Crown Aegis awakened!", "#f2c14e");
    spawnParticles(base.x, groundY - 120, 36, "#f2c14e", 150, 190);
    spawnParticles(base.x, groundY - 160, 18, "#ff6a20", 90, 140);
  }
  if (buildStationsFn) buildStationsFn();
}

export function pickupWeapon(weaponId, upgrades) {
  const { player } = state;
  // The swapped-out weapon keeps its upgrades and goes into the inventory.
  if (player.weapon) storeWeapon(player.weapon, player.weaponUpgrades || []);
  player.weapon = weaponId;
  player.weaponUpgrades = upgrades || [];
  state.weaponPickup = { weaponId, timer: 3.8 };
  Audio.pickup();
}
