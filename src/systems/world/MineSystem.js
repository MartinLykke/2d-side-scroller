import { CFG, MINE } from '../../config/config.js';
import { clamp, dist, rand } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { floaty, spawnCoin, spawnParticles } from './SpawnSystem.js';

// The mine lives directly under the base and reuses the surface coordinate
// space: same x-axis, same ground line. Game.inMine only switches which scene
// is rendered and which layer of stations/coins/effects the player interacts
// with. Miners are regular units flagged with u.mine = true.

// The mine starts as a single small chamber. Each end wall holds one "frontier"
// vein embedded in the rock; mining it out pushes that wall outward (see
// expandMine below), which is what makes the tunnel grow over time.
export function initMineVeins() {
  state.mineActiveLeft = MINE.startLeft;
  state.mineActiveRight = MINE.startRight;
  state.mineVeins = [
    { x: MINE.startLeft, side: -1, ore: CFG.mineVeinOre, maxOre: CFG.mineVeinOre, respawnT: 0, workPulse: 0 },
    { x: MINE.startRight, side: 1, ore: CFG.mineVeinOre, maxOre: CFG.mineVeinOre, respawnT: 0, workPulse: 0 },
  ];
}

function expandMine(v) {
  const maxed = v.side < 0
    ? state.mineActiveLeft <= MINE.left
    : state.mineActiveRight >= MINE.right;
  if (maxed) {
    // Frontier reached the hard bounds of the mine: just respawn in place.
    v.respawnT = rand(50, 80);
    return;
  }
  if (v.side < 0) {
    state.mineActiveLeft = Math.max(MINE.left, state.mineActiveLeft - CFG.mineExpandStep);
    v.x = state.mineActiveLeft;
  } else {
    state.mineActiveRight = Math.min(MINE.right, state.mineActiveRight + CFG.mineExpandStep);
    v.x = state.mineActiveRight;
  }
  v.ore = v.maxOre;
  v.respawnT = 0;
  mineParticles(v.x, groundY - 40, 16, "#8a7a66", 90, 70);
  mineParticles(v.x, groundY - 40, 8, "#f2c14e", 70, 60);
  Audio.build();
}

// Tag the most recently spawned floaty/particles as mine-layer so they only
// render underground.
export function mineFloaty(x, text, color) {
  floaty(x, text, color);
  state.floatTexts[state.floatTexts.length - 1].mine = true;
}

function mineParticles(x, y, n, color, spread, up) {
  const before = state.particles.length;
  spawnParticles(x, y, n, color, spread, up);
  for (let i = before; i < state.particles.length; i++) state.particles[i].mine = true;
}

export function nearMineEntrance() {
  return state.mineBuilt && dist(state.player.x, MINE.entranceX) < 70;
}

export function tryToggleMine() {
  if (!state.mineBuilt || Game.state !== "play") return false;
  if (!Game.inMine) {
    if (dist(state.player.x, MINE.entranceX) < 70) {
      Game.inMine = true;
      state.player.x = MINE.entranceX;
      state.player.knock = 0;
      Audio.build();
      return true;
    }
  } else if (dist(state.player.x, MINE.entranceX) < 70) {
    Game.inMine = false;
    state.player.x = MINE.entranceX;
    state.player.knock = 0;
    Audio.build();
    return true;
  }
  return false;
}

function looseMineCoins() {
  let n = 0;
  for (const c of state.coins) if (c.mine) n++;
  return n;
}

function pickVein(u) {
  let best = null, bd = 1e9;
  for (const v of state.mineVeins) {
    if (v.ore <= 0) continue;
    let crowd = 0;
    for (const o of state.units)
      if (o !== u && o.role === "miner" && !o.dying && o.veinTarget === v) crowd++;
    if (crowd >= 2) continue;
    const d = dist(u.x, v.x);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

export function minerAI(u, dt) {
  u.working = false;
  u.x = clamp(u.x, state.mineActiveLeft + 16, state.mineActiveRight - 16);

  if (u.veinTarget && (u.veinTarget.ore <= 0 || !state.mineVeins.includes(u.veinTarget)))
    u.veinTarget = null;
  if (!u.veinTarget) u.veinTarget = pickVein(u);

  if (!u.veinTarget) {
    // Nothing to dig: loiter around the mine shaft
    if (dist(u.x, u.targetX) < 8 || Math.random() < 0.004)
      u.targetX = clamp(CFG.baseX + rand(-260, 260), state.mineActiveLeft + 40, state.mineActiveRight - 40);
    if (dist(u.x, u.targetX) > 4) { u.dir = Math.sign(u.targetX - u.x); u.x += u.dir * 26 * dt; }
    return;
  }

  const v = u.veinTarget;
  if (dist(u.x, v.x) > 20) {
    u.dir = Math.sign(v.x - u.x);
    u.x += u.dir * 55 * dt;
    return;
  }

  // At the vein: swing the pickaxe
  u.working = true;
  u.dir = Math.sign(v.x - u.x) || u.dir;
  u.anim += dt * 9;
  if (looseMineCoins() >= CFG.mineMaxLooseCoins) return; // gold piling up uncollected
  u.workTimer += dt;
  v.workPulse = 0.2;
  if (u.workTimer >= CFG.minerInterval) {
    u.workTimer = 0;
    v.ore--;
    const c = spawnCoin(v.x + rand(-14, 14), 1, groundY - 26, rand(-40, 40), rand(-160, -90));
    c.mine = true;
    mineParticles(v.x, groundY - 20, 6, "#f2c14e", 40, 60);
    mineParticles(v.x, groundY - 22, 4, "#8a7a66", 50, 40);
    if (Game.inMine) Audio.coin();
    if (v.ore <= 0) {
      u.veinTarget = null;
      expandMine(v);
    }
  }
}

export function updateMine(dt) {
  if (!state.mineBuilt) return;
  for (const v of state.mineVeins) {
    if (v.workPulse > 0) v.workPulse -= dt;
    if (v.ore <= 0 && v.respawnT > 0) {
      v.respawnT -= dt;
      if (v.respawnT <= 0) {
        v.ore = v.maxOre;
      }
    }
  }
}
