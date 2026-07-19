import { CFG, STATIONS_X } from '../../config/config.js';
import { dist } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { spawnParticles, spawnGoldReward } from '../world/SpawnSystem.js?v=biomeboss1';
import { moveToward, sunsetApproaching } from './AIHelpers.js?v=biomeboss1';

export function farmerAI(u, dt) {
  if (u.panic > 0) { moveToward(u, CFG.baseX, 150, dt); return; }
  if (sunsetApproaching() && dist(u.x, CFG.baseX) > 180) {
    moveToward(u, CFG.baseX, 120, dt); return;
  }
  const fx = STATIONS_X.farm;
  if (moveToward(u, fx, 36, dt)) {
    u.workTimer += dt;
    const lvl = state.farmLevel || 1;
    const interval = Math.max(1.2, 5 - (lvl - 1) * 0.85);
    if (u.workTimer > (Game.isNight ? 99 : interval)) {
      u.workTimer = 0;
      const coins = lvl >= 5 ? 3 : lvl >= 3 ? 2 : 1;
      spawnGoldReward(fx, coins, "passive", { spreadX: 24, fromY: groundY - 20, vx: 40 });
      spawnParticles(fx, groundY - 20, 4 + lvl, "#9bd05a", 20, 30);
    }
  }
}
