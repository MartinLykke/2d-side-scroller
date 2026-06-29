// Re-export all combat-related functions from their respective modules
export { shootArrow, updateArrows } from './ProjectileSystem.js';
export { killEnemy } from '../util/EnemyUtils.js';
export { updateEnemies } from './EnemyAI.js';
export { castSpell, updateSpells } from './SpellSystem.js';
export { updatePlayerAttack, meleeHitPlayer } from './PlayerCombat.js';
export { updatePoisonShots, updateLegendaryEffects, updateLegendaryBoss } from './BossAI.js';
