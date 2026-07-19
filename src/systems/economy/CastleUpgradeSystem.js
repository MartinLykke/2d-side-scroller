import { Game, state } from '../../core/state.js';
import { CFG } from '../../config/config.js';
import { CASTLE_UPGRADES, CASTLE_UPGRADE_MAP } from '../../config/castleUpgrades.js';
import { groundY } from '../../core/canvas.js';
import { clamp, dist } from '../../util/math.js';
import { ensureCastleUpgrades, reapplyDefenseMaxHp, currentCoinCap } from '../../util/DefenseStats.js';
import { spawnParticles, floaty } from '../world/SpawnSystem.js';
import { Audio } from '../infrastructure/Audio.js';
import { addXP } from './UpgradeSystem.js';

export const CASTLE_MENU_RANGE = 155;

export function canOpenCastleUpgrades() {
  return !!(
    Game.state === "play" &&
    !Game.inMine &&
    state.base &&
    state.player &&
    state.base.level >= 4 &&
    dist(state.player.x, state.base.x) < CASTLE_MENU_RANGE
  );
}

export function tryOpenCastleUpgrades() {
  if (!canOpenCastleUpgrades()) return false;
  Game.castleOpen = !Game.castleOpen;
  Game.castleIdx = clamp(Game.castleIdx || 0, 0, CASTLE_UPGRADES.length - 1);
  if (Game.castleOpen) {
    Game.inventoryOpen = false;
    Game.shopOpen = false;
  }
  return true;
}

export function closeCastleUpgrades() {
  Game.castleOpen = false;
}

export function updateCastleUpgradeMenu() {
  if (Game.castleOpen && !canOpenCastleUpgrades()) closeCastleUpgrades();
}

export function selectedCastleUpgrade() {
  Game.castleIdx = clamp(Game.castleIdx || 0, 0, CASTLE_UPGRADES.length - 1);
  return CASTLE_UPGRADES[Game.castleIdx];
}

export function castleUpgradeCost(id) {
  const up = CASTLE_UPGRADE_MAP[id];
  const lvl = ensureCastleUpgrades()[id] || 0;
  return up?.costs?.[lvl] || 0;
}

export function buyCastleUpgrade(id = selectedCastleUpgrade()?.id) {
  const up = CASTLE_UPGRADE_MAP[id];
  const levels = ensureCastleUpgrades();
  if (!up) return false;
  const lvl = levels[id] || 0;
  if (lvl >= 3) {
    floaty(state.base.x, up.name + " is complete", up.col);
    return false;
  }
  const cost = castleUpgradeCost(id);
  if (!state.player || state.player.coins < cost) {
    floaty(state.player?.x || state.base.x, "Not enough gold", "#ff6a4a");
    return false;
  }

  state.player.coins -= cost;
  levels[id] = lvl + 1;
  if (id === "masonry") reapplyDefenseMaxHp();
  if (id === "treasury") state.player.coins = Math.min(state.player.coins, currentCoinCap());
  state.base.flash = Math.max(state.base.flash || 0, 0.8);
  state.base.castleUpgradePulse = 0.9;
  spawnParticles(state.base.x, groundY - 118, 26, up.col, 120, 150);
  spawnParticles(state.player.x, groundY - 40, 10, up.col, 70, 90);
  floaty(state.base.x, up.name + " " + levels[id] + "/3", up.col, 17);
  addXP(18 + levels[id] * 6);
  Audio.upgrade();
  return true;
}
