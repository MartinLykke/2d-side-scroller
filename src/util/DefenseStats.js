import { CFG } from '../config/config.js';
import { CASTLE_UPGRADE_IDS } from '../config/castleUpgrades.js';
import { fortHpMultAt } from '../config/fortifications.js';
import { Game, state } from '../core/state.js';

const CASTLE_HP_BONUS = [0, 45, 95, 155];
const CASTLE_POP_BONUS = [0, 4, 9, 15];
const CASTLE_COIN_BONUS = [0, 60, 140, 240];

export function ensureCastleUpgrades() {
  if (!state.castleUpgrades || typeof state.castleUpgrades !== "object") state.castleUpgrades = {};
  for (const id of CASTLE_UPGRADE_IDS) {
    const v = Number(state.castleUpgrades[id] || 0);
    state.castleUpgrades[id] = Math.max(0, Math.min(3, Math.floor(Number.isFinite(v) ? v : 0)));
  }
  return state.castleUpgrades;
}

export function castleUpgradeLevel(id) {
  return ensureCastleUpgrades()[id] || 0;
}

export function castleMasonryHpBonus() {
  return CASTLE_HP_BONUS[castleUpgradeLevel("masonry")] || 0;
}

export function currentPopCap(baseLevel = state.base?.level || 1) {
  return (CFG.popCapByLevel[baseLevel] || 0) + (CASTLE_POP_BONUS[castleUpgradeLevel("garrison")] || 0);
}

export function currentCoinCap() {
  return CFG.maxCoinsCarry + (CASTLE_COIN_BONUS[castleUpgradeLevel("treasury")] || 0);
}

export function defenseHpMult() {
  return fortHpMultAt(state.fortLevel || 0);
}

export function baseMaxHpForLevel(level = state.base?.level || 1) {
  const baseHp = CFG.baseMaxHp[level] || CFG.baseMaxHp[1] || 60;
  const bonus = (Game.permanentBaseHpBonus || 0) + castleMasonryHpBonus();
  return Math.round((baseHp + bonus) * defenseHpMult());
}

export function wallMaxHpForLevel(level) {
  return Math.round(((CFG.wallHp[level] || 0) + (Game.permanentWallHpBonus || 0)) * defenseHpMult());
}

export function reapplyDefenseMaxHp() {
  const base = state.base;
  if (!base) return;
  const nextBaseMax = baseMaxHpForLevel(base.level);
  base.hp += Math.max(0, nextBaseMax - (base.maxHp || 0));
  base.maxHp = nextBaseMax;
  for (const w of state.walls || []) {
    if (!w.commissioned || w.level < 1) continue;
    const nextWallMax = wallMaxHpForLevel(w.level);
    w.hp += Math.max(0, nextWallMax - (w.maxHp || 0));
    w.maxHp = nextWallMax;
  }
}

export function crownAegisStats() {
  const base = state.base;
  if (!base) return null;
  const lens = castleUpgradeLevel("aegis");
  const royal = base.level >= CFG.maxBaseLevel;
  if (!royal && lens <= 0) return null;
  const power = Math.max(lens, royal ? 1 : 0);
  return {
    level: power,
    range: CFG.aegisRange + lens * 55,
    interval: Math.max(1.55, CFG.aegisInterval - lens * 0.35),
    damage: CFG.aegisDamage + lens * 2 + (royal ? 1 : 0),
    splashDamage: CFG.aegisSplashDamage + Math.floor(lens / 2),
    radius: CFG.aegisRadius + lens * 12,
  };
}
