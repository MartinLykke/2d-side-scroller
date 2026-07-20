import { DEV } from '../../rendering/HUD.js?v=biomevisual1';
import { inject } from '../../core/services.js';

export function setupDevPanel() {
  const panel = document.getElementById("dev-panel");
  if (!panel) return;

  const bind = (selector, handler) => {
    const el = panel.querySelector(selector);
    if (el) el.addEventListener("click", handler);
  };
  const bindAmountButtons = (prefix, handler) => {
    panel.querySelectorAll(`[data-dev^="${prefix}"]`).forEach(el => {
      const amount = Number(el.dataset.dev.slice(prefix.length));
      if (Number.isFinite(amount) && amount > 0) {
        el.addEventListener("click", () => handler(amount));
      }
    });
  };

  bind("#dev-close", () => DEV.toggle());

  // Gold & Embers
  bindAmountButtons("coins", n => DEV.addCoins(n));
  bindAmountButtons("embers", n => DEV.addEmbers(n));
  bind('[data-dev="resetUpgrades"]', () => DEV.resetUpgrades());
  bind('[data-dev="clearLeaderboard"]', () => DEV.clearLeaderboard());

  // Time
  bind('[data-dev="night"]',   () => DEV.skipToNight());
  bind('[data-dev="day"]',     () => DEV.skipToDay());
  bind('[data-dev="day10"]',   () => DEV.skipToDay10());
  bind('[data-dev="day15"]',   () => DEV.skipToDay15());
  bind('[data-dev="day20"]',   () => DEV.skipToDay20());

  // Base & Healing
  bind('[data-dev="upgradeBase"]', () => DEV.upgradeBase());
  bind('[data-dev="healAll"]',     () => DEV.healAll());
  bind('[data-dev="maxBase"]',     () => DEV.maxBaseLevel());
  bind('[data-dev="maxWalls"]',    () => DEV.maxWallLevels());
  bind('[data-dev="fortTier"]',    () => DEV.fortTierUp());

  // Spawn enemy
  bind('[data-dev="imp"]',          () => DEV.spawnEnemyNearBase('imp'));
  bind('[data-dev="fireImp"]',      () => DEV.spawnEnemyNearBase('fireImp'));
  bind('[data-dev="emberBrute"]',   () => DEV.spawnEnemyNearBase('emberBrute'));
  bind('[data-dev="ashPriest"]',    () => DEV.spawnEnemyNearBase('ashPriest'));
  bind('[data-dev="siegeImp"]',     () => DEV.spawnEnemyNearBase('siegeImp'));
  bind('[data-dev="chainImp"]',     () => DEV.spawnEnemyNearBase('chainImp'));
  bind('[data-dev="8imp"]',         () => DEV.spawn8ImpsRight());
  bind('[data-dev="dragon"]',       () => DEV.spawnFireDragonBoss());
  bind('[data-dev="magmaGolem"]',   () => DEV.spawnMagmaGolemBoss());
  bind('[data-dev="killAll"]',      () => DEV.killAll());
  bind('[data-dev="shade"]',        () => DEV.spawnEnemyNearBase('shade'));
  bind('[data-dev="voidWraith"]',   () => DEV.spawnEnemyNearBase('voidWraith'));
  bind('[data-dev="voidBrute"]',    () => DEV.spawnEnemyNearBase('voidBrute'));
  bind('[data-dev="voidTitan"]',    () => DEV.spawnVoidTitanBoss());
  bind('[data-dev="voidSeraph"]',   () => DEV.spawnVoidSeraphBoss());
  bind('[data-dev="forestBoss"]',      () => DEV.spawnBiomeBossDev('forest'));
  bind('[data-dev="frozenBoss"]',      () => DEV.spawnBiomeBossDev('frozen'));
  bind('[data-dev="desertBoss"]',      () => DEV.spawnBiomeBossDev('desert'));
  bind('[data-dev="swampBoss"]',       () => DEV.spawnBiomeBossDev('swamp'));
  bind('[data-dev="volcanoBoss"]',     () => DEV.spawnBiomeBossDev('volcano'));
  bind('[data-dev="corruptedBoss"]',   () => DEV.spawnBiomeBossDev('corrupted'));
  bind('[data-dev="startAssault"]', () => DEV.startAssaultDev());
  bind('[data-dev="crackPortals"]', () => DEV.crackPortals());
  bind('[data-dev="phase2"]',       () => DEV.beginPhase2());
  bind('[data-dev="biomeForest"]',    () => DEV.teleportBiome('forest'));
  bind('[data-dev="biomeFrozen"]',    () => DEV.teleportBiome('frozen'));
  bind('[data-dev="biomeDesert"]',    () => DEV.teleportBiome('desert'));
  bind('[data-dev="biomeSwamp"]',     () => DEV.teleportBiome('swamp'));
  bind('[data-dev="biomeVolcano"]',   () => DEV.teleportBiome('volcano'));
  bind('[data-dev="biomeCorrupted"]', () => DEV.teleportBiome('corrupted'));

  // Spawn unit
  bind('[data-dev="unitArcher"]',  () => DEV.spawnUnit('archer'));
  bind('[data-dev="unitBuilder"]', () => DEV.spawnUnit('builder'));
  bind('[data-dev="unitFarmer"]',  () => DEV.spawnUnit('farmer'));
  bind('[data-dev="unitGuard"]',   () => DEV.spawnUnit('guard'));
  bind('[data-dev="unitMiner"]',   () => DEV.spawnUnit('miner'));

  // Level units
  bind('[data-dev="archerLvl1"]',    () => DEV.levelUpUnits('archer', 1));
  bind('[data-dev="archerLvl5"]',    () => DEV.levelUpUnits('archer', 5));
  bind('[data-dev="guardLvl1"]',     () => DEV.levelUpUnits('guard', 1));
  bind('[data-dev="guardLvl5"]',     () => DEV.levelUpUnits('guard', 5));
  bind('[data-dev="skillPts5"]',     () => DEV.addSkillPoints(5));
  bind('[data-dev="archerAllSkills"]', () => DEV.grantArcherSkills());

  // Spawn animal
  bind('[data-dev="deer"]',   () => DEV.spawnAnimalNearBase('deer'));
  bind('[data-dev="rabbit"]', () => DEV.spawnAnimalNearBase('rabbit'));
  bind('[data-dev="duck"]',   () => DEV.spawnAnimalNearBase('duck'));
  bind('[data-dev="bear"]',   () => DEV.spawnAnimalNearBase('bear'));

  // Profiler
  bind('[data-dev="profiler"]',   () => DEV.toggleProfiler());

  // Player & Weapons
  bind('[data-dev="godMode"]',    () => DEV.toggleGodMode());
  bind('[data-dev="deathHub"]',   () => inject('enterDeathHub')?.('Dev test: the crown fell between worlds.'));
  bind('[data-dev="dropWeapon"]', () => DEV.dropWeapon());
  bind('[data-dev="removeArmor"]', () => DEV.removeArmor());
  bind('[data-dev="stableMount"]', () => DEV.stableMount());

  // Game speed
  bind('[data-dev="speed1"]', () => DEV.setSpeed(1));
  bind('[data-dev="speed2"]', () => DEV.setSpeed(2));
  bind('[data-dev="speed4"]', () => DEV.setSpeed(4));
}
