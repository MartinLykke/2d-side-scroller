import { CFG } from '../config/config.js';
import { CASTLE_UPGRADE_IDS, CASTLE_UPGRADE_MAP } from '../config/castleUpgrades.js';
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

export function castleUpgradeUnlockLevel(id) {
  return CASTLE_UPGRADE_MAP[id]?.unlockLevel || 4;
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

export function baseMaxHpForLevel(level = state.base?.level || 1) {
  const baseHp = CFG.baseMaxHp[level] || CFG.baseMaxHp[1] || 60;
  const bonus = (Game.permanentBaseHpBonus || 0) + castleMasonryHpBonus();
  return Math.round(baseHp + bonus);
}

export function wallMaxHpForLevel(level) {
  return Math.round((CFG.wallHp[level] || 0) + (Game.permanentWallHpBonus || 0));
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

export function murderHoleStats() {
  const lvl = castleUpgradeLevel("masonry");
  if (!state.base || lvl <= 0) return null;
  return {
    level: lvl,
    range: CFG.murderHoleRange + (lvl - 1) * 25,
    interval: Math.max(1.5, CFG.murderHoleInterval - (lvl - 1) * 0.8),
    damage: CFG.murderHoleDamage + (lvl - 1) * 2,
    slowDuration: CFG.murderHoleSlowDuration + (lvl - 1) * 0.5,
  };
}

export function warDrumStats() {
  const lvl = castleUpgradeLevel("garrison");
  if (!state.base || lvl <= 0) return null;
  return {
    level: lvl,
    interval: Math.max(8, CFG.warDrumInterval - (lvl - 1) * 3),
    duration: CFG.warDrumBuffDuration + (lvl - 1) * 1.5,
  };
}

export function hoardBurstStats() {
  const lvl = castleUpgradeLevel("treasury");
  if (!state.base || lvl <= 0) return null;
  return {
    level: lvl,
    interval: Math.max(9, CFG.hoardBurstInterval - (lvl - 1) * 4),
    gold: CFG.hoardBurstGold + (lvl - 1) * 3,
  };
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

export function trebuchetStats() {
  const base = state.base;
  const lvl = castleUpgradeLevel("siege");
  if (!base || lvl <= 0) return null;
  return {
    level: lvl,
    dual: lvl >= 3,
    range: CFG.trebuchetRange + (lvl - 1) * 130,
    interval: Math.max(3.0, CFG.trebuchetInterval - (lvl - 1) * 1.1),
    damage: CFG.trebuchetDamage + (lvl - 1) * 7,
    splashDamage: CFG.trebuchetSplashDamage + (lvl - 1) * 3,
    radius: CFG.trebuchetRadius + (lvl - 1) * 25,
    travelTime: CFG.trebuchetTravelTime,
  };
}
