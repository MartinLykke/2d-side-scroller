const DEFAULT_PERFORMANCE = Object.freeze({
  targetFps: 120,
  particleCap: 700,
  floatTextCap: 90,
  spawnInterval: Object.freeze({ min: 0.14, max: 1.4 }),
  renderRecoveryFrames: 30,
  aggressiveRenderBudget: false,
});

function freezeProfile(profile) {
  const performance = profile.performance || {};
  return Object.freeze({
    ...profile,
    performance: Object.freeze({
      ...DEFAULT_PERFORMANCE,
      ...performance,
      spawnInterval: Object.freeze({
        ...DEFAULT_PERFORMANCE.spawnInterval,
        ...(performance.spawnInterval || {}),
      }),
    }),
  });
}

export const DIFFICULTY_PROFILES = Object.freeze({
  easy: freezeProfile({
    id: "easy",
    diffMult: 0.65,
    enemyCountMult: 0.65,
    enemyStrengthMult: 1,
    elitePressureMult: 1,
  }),
  normal: freezeProfile({
    id: "normal",
    diffMult: 1,
    enemyCountMult: 1,
    enemyStrengthMult: 1,
    elitePressureMult: 1,
  }),
  hard: freezeProfile({
    id: "hard",
    diffMult: 1.65,
    enemyCountMult: 2,
    enemyStrengthMult: 1.12,
    elitePressureMult: 1.3,
    performance: {
      targetFps: 144,
      particleCap: 420,
      floatTextCap: 60,
      spawnInterval: { min: 0.08, max: 1.2 },
      renderRecoveryFrames: 60,
      aggressiveRenderBudget: true,
    },
  }),
});

export function difficultyIdFromMultiplier(diffMult = 1) {
  if (diffMult > 1.5) return "hard";
  if (diffMult < 0.85) return "easy";
  return "normal";
}

export function difficultyProfile(input = "normal") {
  const id = typeof input === "string"
    ? input
    : input?.difficulty || difficultyIdFromMultiplier(input?.diffMult);
  return DIFFICULTY_PROFILES[id] || DIFFICULTY_PROFILES.normal;
}
