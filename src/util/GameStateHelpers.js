import { state, Game } from '../state.js';
import { CFG } from '../config/config.js';
import { groundY } from '../canvas.js';
import { rand } from '../util/math.js';
import { Audio } from '../systems/Audio.js';
import { floaty, spawnParticles } from '../systems/SpawnSystem.js';
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
  floaty(base.x, "🏰 " + baseName(base.level) + "!");
  Audio.upgrade();

  if (base.level === 2) {
    setTimeout(() => floaty(base.x, "🏪 Marked og butik åbnet!", "#9bd05a"), 900);
    setTimeout(() => floaty(base.x, "🌾 Gårdsstation tilgængelig!", "#9bd05a"), 1800);
  } else if (base.level === 3) {
    setTimeout(() => floaty(base.x, "⚔ Rekrutteringshal åbnet!", "#f2c14e"), 900);
    setTimeout(() => floaty(base.x, "Ansæt garder til forsvar!", "#cdbfa3"), 1800);
  } else if (base.level === 4) {
    setTimeout(() => floaty(base.x, "👑 Kongelig Garde aktiveret!", "#f2c14e"), 900);
    setTimeout(() => floaty(base.x, "✨ Legendariske våben tilgængelige!", "#c69fff"), 1800);
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
  Audio.upgrade();
}
