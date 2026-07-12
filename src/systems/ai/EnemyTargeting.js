import { dist } from '../../util/math.js';
import { Game, state } from '../../core/state.js';
import { wallHeight } from '../../entities/Wall.js';
import { playerCombatLift } from './EnemyShared.js';

export function fireImpTarget(e, range) {
  let best = null, bd = range;
  const player = state.player;
  if (player && player.hp > 0 && !Game.inMine) {
    const d = dist(e.x, player.x);
    if (d < bd) { bd = d; best = player; }
  }
  for (const u of state.units) {
    if (u.hp <= 0 || u.dying || u.mine) continue;
    const d = dist(e.x, u.x);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

export function topDefendersForWall(w) {
  return state.units.filter(u =>
    (u.role === "guard" || u.role === "archer") &&
    u.hp > 0 &&
    !u.dying &&
    u.onWall &&
    u.wall === w
  );
}

export function nearestTopDefenderForWall(w, x = w.x, seeker = null) {
  let best = null, bd = 1e9;
  for (const u of topDefendersForWall(w)) {
    if (seeker && u.combatTarget && u.combatTarget !== seeker) continue;
    const d = dist(u.x, x);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

export function nearestGroundDefenderForImp(e, range = 220) {
  if (e.wallTopWall) {
    const topDefender = nearestTopDefenderForWall(e.wallTopWall, e.x, e);
    if (topDefender) return topDefender;
  }
  let best = null, bd = range;
  let bestOther = null, bod = range;
  for (const u of state.units) {
    if (u.hp <= 0 || u.dying || u.mine) continue;
    const d = dist(e.x, u.x);
    if (u.role === "guard") { if (d < bd) { bd = d; best = u; } }
    else if (!u.onWall) { if (d < bod) { bod = d; bestOther = u; } }
  }
  return best || bestOther;
}

export function wallTopImpForWall(w, except = null) {
  return state.enemies.find(e =>
    e !== except &&
    e.type === "imp" &&
    e.hp > 0 &&
    !e.dying &&
    !e.fleeing &&
    e.wallTopWall === w &&
    (e.aiState === "combat" || e.aiState === "impAttack" || e.aiState === "vaulting")
  );
}

export function ashPriestTarget(e, range) {
  let best = null, bd = range;
  const player = state.player;
  if (player && player.hp > 0 && !Game.inMine) {
    const d = dist(e.x, player.x);
    if (d < bd) { bd = d; best = player; }
  }
  for (const u of state.units) {
    if (u.hp <= 0 || u.dying || u.mine) continue;
    const d = dist(e.x, u.x);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}
