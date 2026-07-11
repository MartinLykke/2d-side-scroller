import { CFG } from '../../config/config.js';
import { Game, state } from '../../core/state.js';

const SOURCE_MULTIPLIERS = {
  enemy: 1,
  boss: 0.78,
  chest: 0.85,
  location: 0.85,
  hunt: 0.75,
  passive: 0.68,
  lumber: 0.7,
  mine: 0.62,
};

export function expectedGoldForDay(day = Game.day || 1) {
  const baseLevel = state.base?.level || 1;
  const builtWalls = (state.walls || []).filter(w => w.commissioned && w.buildProgress >= 1).length;
  return 16 + day * 8 + Math.max(0, day - 5) * 5 + baseLevel * 6 + builtWalls * 3;
}

export function goldPressureMultiplier(source = "enemy") {
  const playerCoins = state.player?.coins || 0;
  const expected = expectedGoldForDay();
  let mult = 1;

  if (playerCoins > expected * 2.4) mult = 0.42;
  else if (playerCoins > expected * 1.6) mult = 0.62;
  else if (playerCoins > expected) mult = 0.82;

  if (source === "passive" || source === "lumber" || source === "mine") {
    if (playerCoins > expected) mult *= 0.72;
    if (playerCoins > expected * 2) mult *= 0.72;
  }

  return mult;
}

export function goldRewardAmount(rawAmount, source = "enemy") {
  const raw = Math.max(0, Number(rawAmount) || 0);
  if (raw <= 0) return 0;

  const sourceMult = SOURCE_MULTIPLIERS[source] ?? 1;
  const scaled = raw * sourceMult * goldPressureMultiplier(source);

  if (scaled < 1) return Math.random() < scaled ? 1 : 0;
  return Math.max(1, Math.round(scaled));
}

export function goldCoinChunks(amount, maxCoinValue = CFG.maxGoldCoinValue || 10) {
  let remaining = Math.max(0, Math.floor(amount));
  const chunks = [];
  const denoms = [maxCoinValue, 5, 1].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i).sort((a, b) => b - a);

  for (const denom of denoms) {
    while (remaining >= denom) {
      chunks.push(denom);
      remaining -= denom;
    }
  }
  return chunks;
}
