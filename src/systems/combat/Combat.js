// Re-export all combat-related functions from their respective modules
export { shootArrow, updateArrows } from './ProjectileSystem.js?v=biomeactive4';
export { killEnemy } from '../../util/EnemyUtils.js?v=biomeactive4';
export { updateEnemies } from '../ai/EnemyAI.js?v=biomeactive4';
export { castSpell, updateSpells } from './SpellSystem.js?v=biomeactive4';
export { updatePlayerAttack, meleeHitPlayer, damagePlayer } from './PlayerCombat.js?v=biomeactive4';

