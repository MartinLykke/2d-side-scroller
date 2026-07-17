import { currentDifficulty } from '../systems/infrastructure/DifficultySystem.js';

export const RENDER_BUDGETS = Object.freeze({
  high: Object.freeze({
    level: "high",
    enemySpriteDetail: 2,
    minorHealthBars: true,
    particlesEvery: 1,
    shadowStride: 1,
    groundDetail: 2,
    ambientEvery: 1,
  }),
  medium: Object.freeze({
    level: "medium",
    enemySpriteDetail: 1,
    minorHealthBars: false,
    particlesEvery: 2,
    shadowStride: 2,
    groundDetail: 1,
    ambientEvery: 2,
  }),
  low: Object.freeze({
    level: "low",
    enemySpriteDetail: 0,
    minorHealthBars: false,
    particlesEvery: 3,
    shadowStride: 3,
    groundDetail: 0,
    ambientEvery: 3,
  }),
});

const DETAIL_RANK = Object.freeze({ low: 0, medium: 1, high: 2 });

export function budgetDetailRank(budget) {
  return DETAIL_RANK[budget?.level || budget] ?? DETAIL_RANK.high;
}

export function targetRenderFps(game) {
  return currentDifficulty(game).performance.targetFps;
}

export function renderRecoveryFrames(game) {
  return currentDifficulty(game).performance.renderRecoveryFrames;
}

export function chooseRenderBudget(load, game) {
  const performance = currentDifficulty(game).performance;
  const targetFps = load.targetFps || performance.targetFps;
  const fpsGap = targetFps - (load.fps || targetFps);

  if (performance.aggressiveRenderBudget) {
    if (fpsGap >= 20 || load.enemies >= 34 || load.entities >= 72 || load.score >= 118 || load.particles >= 260) return RENDER_BUDGETS.low;
    if (fpsGap >= 6 || load.enemies >= 14 || load.entities >= 34 || load.score >= 54 || load.particles >= 130) return RENDER_BUDGETS.medium;
    return RENDER_BUDGETS.high;
  }

  if (fpsGap >= 28) return RENDER_BUDGETS.low;
  if (fpsGap >= 12) return RENDER_BUDGETS.medium;
  if (load.enemies >= 42 || load.entities >= 90 || load.score >= 170) return RENDER_BUDGETS.low;
  if (load.enemies >= 26 || load.entities >= 58 || load.score >= 105) return RENDER_BUDGETS.medium;
  return RENDER_BUDGETS.high;
}
