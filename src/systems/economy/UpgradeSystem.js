import { state, Game } from '../../core/state.js';
import { WEAPONS } from '../../config/weapons.js';
import { WEAPON_UPGRADES, UNIQUE_UPGRADES, SHORT_BOW_BRANCH, UPGRADE_TIERS, TIER_RANK } from '../../config/weaponUpgrades.js';
import { groundY } from '../../core/canvas.js';
import { floaty, spawnParticles } from '../world/SpawnSystem.js';
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

// Weighted tier roll. Pity nudges the odds toward epic/legendary for every
// level-up that didn't offer a legendary, so long dry streaks self-correct.
function rollTier(pity) {
  const wR = UPGRADE_TIERS.rare.weight;
  const wE = UPGRADE_TIERS.epic.weight + pity * 2;
  const wL = UPGRADE_TIERS.legendary.weight + pity * 4;
  let r = Math.random() * (wR + wE + wL);
  if ((r -= wL) < 0) return "legendary";
  if ((r -= wE) < 0) return "epic";
  return "rare";
}

function pickFromTier(pool, tier) {
  const candidates = pool.filter(u => (u.tier || "rare") === tier);
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function checkUpgrade() {
  const { player } = state;
  if (!player || !player.pendingUpgrade || Game.upgradeMenuOpen) return;
  player.pendingUpgrade = false;
  if (!player.weapon) return;
  const wDef = WEAPONS[player.weapon];
  const applied = (player.weaponUpgrades || []).map(u => u.id);

  // The short bow walks its dedicated branch first, one node at a time.
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
    ...(UNIQUE_UPGRADES[player.weapon] || []).map(u => ({ ...u, unique: true })),
  ].filter(u => !applied.includes(u.id));
  if (pool.length === 0) return;

  const pity = player.upgradePity || 0;
  const options = [];
  for (let slot = 0; slot < 3 && options.length < pool.length; slot++) {
    const remaining = pool.filter(u => !options.includes(u));
    if (!remaining.length) break;
    let tier = rollTier(pity);
    // Fall down through tiers if the rolled one is exhausted, then up.
    let pick = pickFromTier(remaining, tier);
    if (!pick) {
      const order = ["legendary", "epic", "rare"];
      const below = order.slice(order.indexOf(tier) + 1);
      const above = order.slice(0, order.indexOf(tier)).reverse();
      for (const t of [...below, ...above]) {
        pick = pickFromTier(remaining, t);
        if (pick) break;
      }
    }
    if (pick) options.push(pick);
  }
  if (!options.length) return;

  // Show the shiniest card in the middle when there are three.
  options.sort((a, b) => (TIER_RANK[a.tier] || 1) - (TIER_RANK[b.tier] || 1));
  if (options.length === 3) [options[1], options[2]] = [options[2], options[1]];

  if (options.some(u => u.tier === "legendary")) player.upgradePity = 0;
  else player.upgradePity = pity + 1;

  Game.upgradeOptions = options;
  Game.upgradeMenuOpen = true;
  Game.upgradeIdx = Math.min(1, options.length - 1);
}

export function applyUpgrade(idx) {
  const opt = Game.upgradeOptions?.[idx];
  if (!opt) { Game.upgradeMenuOpen = false; return; }
  const { player } = state;
  if (!player.weaponUpgrades) player.weaponUpgrades = [];
  player.weaponUpgrades.push(opt);
  Game.upgradeMenuOpen = false;

  // The rarer the pick, the bigger the moment.
  const tier = opt.tier || "rare";
  const col = opt.vfxCol || UPGRADE_TIERS[tier].col;
  if (tier === "legendary") {
    Audio.levelUp();
    Game.screenShake = Math.max(Game.screenShake || 0, 0.5);
    spawnParticles(player.x, groundY - 40, 30, "#f2c14e", 140, 160);
    spawnParticles(player.x, groundY - 40, 18, col, 100, 190);
    spawnParticles(player.x, groundY - 30, 12, "#ffffff", 70, 210);
    floaty(player.x, "🌟 " + opt.name + "!", "#f2c14e");
  } else if (tier === "epic") {
    Audio.upgrade();
    Game.screenShake = Math.max(Game.screenShake || 0, 0.2);
    spawnParticles(player.x, groundY - 40, 18, UPGRADE_TIERS.epic.col, 100, 130);
    spawnParticles(player.x, groundY - 40, 8, col, 70, 150);
    floaty(player.x, "✦ " + opt.name, UPGRADE_TIERS.epic.col);
  } else {
    Audio.upgrade();
    spawnParticles(player.x, groundY - 40, 10, UPGRADE_TIERS.rare.col, 70, 100);
    floaty(player.x, opt.name, UPGRADE_TIERS.rare.col);
  }
}
