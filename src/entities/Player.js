import { CFG } from '../config/config.js';

export function makePlayer() {
  return {
    x: CFG.baseX, vx: 0, dir: 1, coins: CFG.startCoins,
    gallop: 0, hasCrown: true, bob: 0,
    hp: CFG.playerMaxHp, maxHp: CFG.playerMaxHp,
    invuln: 0, hurt: 0, knock: 0, regen: 0,
    weapon: null, attackCd: 0, swing: 0,
  };
}
