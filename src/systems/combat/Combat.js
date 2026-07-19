// Re-export all combat-related functions from their respective modules
export { shootArrow, updateArrows } from './ProjectileSystem.js?v=biomeboss1';
export { killEnemy } from '../../util/EnemyUtils.js?v=biomeboss1';
export { updateEnemies } from '../ai/EnemyAI.js?v=biomeboss1';
export { castSpell, updateSpells } from './SpellSystem.js?v=biomeboss1';
export { updatePlayerAttack, meleeHitPlayer, damagePlayer } from './PlayerCombat.js?v=biomeboss1';

