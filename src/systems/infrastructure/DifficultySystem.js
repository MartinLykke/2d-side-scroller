import { difficultyProfile } from '../../config/difficulty.js';

export function currentDifficulty(game) {
  return difficultyProfile(game);
}

export function applyDifficulty(game, id) {
  const profile = difficultyProfile(id);
  if (!game) return profile;
  game.difficulty = profile.id;
  game.diffMult = profile.diffMult;
  game.targetFps = profile.performance.targetFps;
  return profile;
}
