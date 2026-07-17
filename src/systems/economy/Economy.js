import { CFG } from '../../config/config.js';
import { clamp, dist, rand } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { inject } from '../../core/services.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnCoin, spawnParticles } from '../world/SpawnSystem.js';

function flyingCoin(fromX, toX) {
  state.particles.push({
    x: fromX, y: groundY - 60, vx: 0, vy: 0, life: 0.32,
    color: "#f2c14e", size: 3,
    toX, fromX, fromY: groundY - 60, toY: groundY - 50, t: 0, fly: true,
    mine: Game.inMine,
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

function completeInstantPurchase(station, player) {
  const cost = station.cost();
  const remaining = Math.max(0, cost - (station.paid || 0));
  if (remaining <= 0 || player.coins < remaining) return false;

  player.coins -= remaining;
  station.paid = 0;
  state.payCooldown = CFG.payInterval;
  flyingCoin(player.x + rand(-6, 6), station.x());
  Audio.pay();
  station.onPaid();
  return true;
}

export function updatePayment(dt) {
  const { player, stations } = state;
  const keys = inject('keys') || {};
  state.payCooldown -= dt;

  if (player.onWall || (player.wallClimbT || 0) > 0.02) {
    state.payHoldTime = 0;
    return;
  }

  let near = null, nd = CFG.payRange;
  for (const s of stations) {
    if (!!s.mineLayer !== Game.inMine) continue; // stations only reachable on the player's layer
    const c = s.cost();
    if (c <= 0) continue;
    const d = dist(player.x, s.x());
    if (d < nd) { nd = d; near = s; }
  }

  if (state.lastPaidStation && state.lastPaidStation !== near && state.lastPaidStation.paid > 0) {
    for (let i = 0; i < state.lastPaidStation.paid; i++) {
      const c = spawnCoin(state.lastPaidStation.x() + rand(-20, 20), 1, groundY - 20, rand(-30, 30), rand(-160, -80));
      c.mine = !!state.lastPaidStation.mineLayer;
    }
    state.lastPaidStation.paid = 0;
  }

  if (!near) { state.lastPaidStation = null; state.payHoldTime = 0; return; }
  if (state.lastPaidStation !== near) state.payHoldTime = 0;
  state.lastPaidStation = near;

  const payHeld = keys["arrowdown"] || keys["s"];
  const payStarted = payHeld && state.payHoldTime <= 0;
  if (!payHeld) state.payHoldTime = 0;
  else state.payHoldTime += dt;

  if (near.instantPurchase) {
    if (payStarted && state.payCooldown <= 0) completeInstantPurchase(near, player);
    return;
  }

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

function playerCoinMagnetRange() {
  const p = state.player;
  let range = CFG.coinMagnetRange || 90;
  if (Math.abs(p.vx || 0) > CFG.playerSpeed + 20) range += CFG.coinSprintMagnetBonus || 0;
  if ((Game.momentumTimer || 0) > 0) {
    const momentum = Math.min(CFG.coinMomentumMagnetBonus || 0, (Game.momentumLevel || 0) * 8);
    range += momentum;
  }
  if (Game.nightCleared || (!Game.isNight && Game.time < CFG.phases.day)) range += 18;
  return range;
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
    if (!!c.mine !== Game.inMine) continue; // only pick up coins on the player's layer
    const d = dist(c.x, player.x);
    const magnetRange = playerCoinMagnetRange();
    if (c.settled && d < magnetRange && player.coins < CFG.maxCoinsCarry) {
      const dx = player.x - c.x;
      const pull = 340 + Math.max(0, magnetRange - d) * 3.6;
      c.x += Math.sign(dx) * Math.min(Math.abs(dx), pull * dt);
      if (d < (CFG.coinPickupRange || 22)) {
        player.coins = clamp(player.coins + c.value, 0, CFG.maxCoinsCarry);
        coins.splice(i, 1);
        Audio.coin();
        spawnParticles(player.x, groundY - 50, 3, "#f2c14e", 30, 40);
      }
      continue;
    }
    // Archers scoop up coins they walk past (out of the player's magnet range),
    // then hand the gold to the player when nearby (see dropArcherGoldToPlayer)
    if (c.settled && !c.mine) {
      for (const u of state.units) {
        if (u.role !== "archer" || u.hp <= 0 || u.dying || u.mine) continue;
        if (dist(c.x, u.x) < 26) {
          u.gold = (u.gold || 0) + c.value;
          coins.splice(i, 1);
          spawnParticles(u.x, groundY - 30, 3, "#f2c14e", 30, 40);
          break;
        }
      }
    }
  }
}
