import { CFG } from '../config/config.js';

export function makePlayer() {
  return {
    x: CFG.baseX, vx: 0, dir: 1, coins: CFG.startCoins,
    gallop: 0, hasCrown: true, bob: 0,
    hp: CFG.playerMaxHp, maxHp: CFG.playerMaxHp,
    invuln: 0, hurt: 0, knock: 0, regen: 0,
    dodgeCd: 0, dodgeT: 0, dodgeDir: 1, dodgeLatch: false,
    dodgeNearMiss: false, riposteT: 0,
    weapon: null, attackCd: 0, swing: 0, armor: null,
    inventory: [],
    jumpH: 0, jumpVy: 0,
    xp: 0, level: 1, weaponUpgrades: [], pendingUpgrade: false,
  };
}
