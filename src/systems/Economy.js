import { CFG } from '../config/config.js';
import { clamp, dist, rand } from '../util/math.js';
import { groundY } from '../canvas.js';
import { Game, state } from '../state.js';
import { Audio } from './Audio.js';
import { spawnCoin, spawnParticles } from './SpawnSystem.js';

function flyingCoin(fromX, toX) {
  state.particles.push({
    x: fromX, y: groundY - 60, vx: 0, vy: 0, life: 0.32,
    color: "#f2c14e", size: 3,
    toX, fromX, fromY: groundY - 60, toY: groundY - 50, t: 0, fly: true,
  });
}

function paymentBatchSize(station) {
  const remaining = Math.max(0, station.cost() - station.paid);
  if (state.payHoldTime < 0.35 || remaining < 8) return 1;
  if (state.payHoldTime < 0.85) return Math.min(2, remaining);
  if (remaining >= 35) return Math.min(6, remaining);
  if (remaining >= 20) return Math.min(4, remaining);
  return Math.min(3, remaining);
}

export function updatePayment(dt) {
  const { player, stations } = state;
  const keys = window._KEYS || {};
  state.payCooldown -= dt;

  let near = null, nd = CFG.payRange;
  for (const s of stations) {
    const c = s.cost();
    if (c <= 0) continue;
    const d = dist(player.x, s.x());
    if (d < nd) { nd = d; near = s; }
  }

  if (state.lastPaidStation && state.lastPaidStation !== near && state.lastPaidStation.paid > 0) {
    for (let i = 0; i < state.lastPaidStation.paid; i++)
      spawnCoin(state.lastPaidStation.x() + rand(-20, 20), 1, -10);
    state.lastPaidStation.paid = 0;
  }

  if (!near) { state.lastPaidStation = null; state.payHoldTime = 0; return; }
  if (state.lastPaidStation !== near) state.payHoldTime = 0;
  state.lastPaidStation = near;

  const payHeld = keys["arrowdown"] || keys["s"];
  if (!payHeld) state.payHoldTime = 0;
  else state.payHoldTime += dt;

  if (player.coins > 0 && payHeld && state.payCooldown <= 0) {
    const batch = Math.min(player.coins, paymentBatchSize(near));
    for (let i = 0; i < batch; i++) {
      player.coins--;
      near.paid++;
      flyingCoin(player.x + rand(-6, 6), near.x());
    }
    state.payCooldown = CFG.payInterval * (batch > 1 ? 0.75 : 1);
    Audio.pay();
    if (near.paid >= near.cost()) {
      near.paid = 0;
      state.payHoldTime = 0;
      near.onPaid();
    }
  }
}

export function updateCoins(dt) {
  const { coins, player } = state;
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    if (!c.settled) {
      c.vy += 520 * dt;
      c.y  += c.vy * dt;
      c.x  += (c.vx || 0) * dt;
      if (c.y >= groundY) { c.y = groundY; c.vy = 0; c.vx = 0; c.settled = true; }
    }
    const d = dist(c.x, player.x);
    if (c.settled && d < 90 && player.coins < CFG.maxCoinsCarry) {
      c.x += Math.sign(player.x - c.x) * 320 * dt;
      if (d < 22) {
        player.coins = clamp(player.coins + c.value, 0, CFG.maxCoinsCarry);
        coins.splice(i, 1);
        Audio.coin();
        spawnParticles(player.x, groundY - 50, 3, "#f2c14e", 30, 40);
      }
    }
  }
}
