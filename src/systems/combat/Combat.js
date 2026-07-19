// Re-export all combat-related functions from their respective modules
export { shootArrow, updateArrows } from './ProjectileSystem.js?v=biomeactive1';
export { killEnemy } from '../../util/EnemyUtils.js?v=biomeactive1';
export { updateEnemies } from '../ai/EnemyAI.js?v=biomeactive1';
export { castSpell, updateSpells } from './SpellSystem.js?v=biomeactive1';
export { updatePlayerAttack, meleeHitPlayer, damagePlayer } from './PlayerCombat.js?v=biomeactive1';

