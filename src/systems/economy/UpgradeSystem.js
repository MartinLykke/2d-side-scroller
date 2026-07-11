import { state, Game } from '../../core/state.js';
import { WEAPONS, WEAPON_UPGRADES, SHORT_BOW_BRANCH } from '../../config/weapons.js';
import { floaty } from '../world/SpawnSystem.js';
import { Audio } from '../infrastructure/Audio.js';

export function xpToNext(level) {
  return 60 + level * 45;
}

export function addXP(amount) {
  const { player } = state;
  if (!player || Game.state !== "play") return;
  player.xp = (player.xp || 0) + amount;
  floaty(player.x, "+" + amount + " xp", "#9bd05a");
  while (player.xp >= xpToNext(player.level || 1)) {
    player.xp -= xpToNext(player.level || 1);
    player.level = (player.level || 1) + 1;
    player.pendingUpgrade = true;
    floaty(player.x, "⬆ Level " + player.level + "!", "#f2c14e");
    Audio.levelUp();
  }
}

export function checkUpgrade() {
  const { player } = state;
  if (!player || !player.pendingUpgrade || Game.upgradeMenuOpen) return;
  player.pendingUpgrade = false;
  if (!player.weapon) return;
  const wDef = WEAPONS[player.weapon];
  const applied = (player.weaponUpgrades || []).map(u => u.id);

  if (player.weapon === "short_bow") {
    const next = SHORT_BOW_BRANCH.find(u => !applied.includes(u.id) && (!u.requires || applied.includes(u.requires)));
    if (next) {
      Game.upgradeOptions = [next];
      Game.upgradeMenuOpen = true;
      Game.upgradeIdx = 0;
      return;
    }
  }

  const pool = [
    ...(WEAPON_UPGRADES.generic || []),
    ...(WEAPON_UPGRADES[wDef.type] || []),
    ...(WEAPON_UPGRADES[player.weapon] || []),
  ];
  const available = pool.filter(u => !applied.includes(u.id));
  if (available.length === 0) return;
  const shuffled = available.slice().sort(() => Math.random() - 0.5);
  Game.upgradeOptions = shuffled.slice(0, Math.min(3, shuffled.length));
  Game.upgradeMenuOpen = true;
  Game.upgradeIdx = 0;
}

export function applyUpgrade(idx) {
  const opt = Game.upgradeOptions?.[idx];
  if (!opt) { Game.upgradeMenuOpen = false; return; }
  const { player } = state;
  if (!player.weaponUpgrades) player.weaponUpgrades = [];
  player.weaponUpgrades.push(opt);
  Game.upgradeMenuOpen = false;
  Audio.upgrade();
}
