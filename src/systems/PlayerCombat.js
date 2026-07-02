import { CFG } from '../config/config.js';
import { WEAPONS, effectiveWeapon } from '../config/weapons.js';
import { ARMORS } from '../config/armor.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { dist, rand } from '../util/math.js';
import { groundY } from '../canvas.js';
import { Game, state } from '../state.js';
import { Audio } from './Audio.js';
import { spawnParticles, floaty } from './SpawnSystem.js';
import { killEnemy, killEnemyWithAnimation, spawnImpBlood } from '../util/EnemyUtils.js';
import { shootArrow } from './ProjectileSystem.js';
import { castSpell } from './SpellSystem.js';

function meleeWeaponImpact(weaponId, x, y) {
  switch (weaponId) {
    case "flame_sword":
      spawnParticles(x, y, 10, "#ff7730", 70, 90);
      spawnParticles(x, y, 6, "#ffcc40", 40, 70);
      spawnParticles(x, y, 4, "#ff2200", 50, 50);
      Game.screenShake = Math.max(Game.screenShake, 0.22);
      break;
    case "gilded_spear":
      spawnParticles(x, y, 12, "#f2c14e", 60, 130);
      spawnParticles(x, y, 6, "#ffffff", 30, 90);
      spawnParticles(x, y, 4, "#ffe080", 80, 60);
      Game.screenShake = Math.max(Game.screenShake, 0.18);
      break;
    case "shadow_axe":
      spawnParticles(x, y, 12, "#aa44cc", 80, 80);
      spawnParticles(x, y, 8, "#440066", 50, 50);
      spawnParticles(x, y, 4, "#ff88ff", 30, 100);
      Game.screenShake = Math.max(Game.screenShake, 0.3);
      break;
    case "thunder_blade":
      spawnParticles(x, y, 14, "#cc66ff", 90, 110);
      spawnParticles(x, y, 8, "#ffffff", 50, 140);
      spawnParticles(x, y, 6, "#aaaaff", 70, 80);
      Game.screenShake = Math.max(Game.screenShake, 0.42);
      break;
    case "kings_sword":
      spawnParticles(x, y, 20, "#f2c14e", 110, 130);
      spawnParticles(x, y, 10, "#ffffff", 70, 110);
      spawnParticles(x, y, 8, "#ff9940", 60, 90);
      Game.screenShake = Math.max(Game.screenShake, 0.48);
      break;
    case "sunblade":
      spawnParticles(x, y, 22, "#ffee80", 130, 150);
      spawnParticles(x, y, 14, "#ffffff", 80, 130);
      spawnParticles(x, y, 10, "#ff9940", 90, 100);
      spawnParticles(x, y, 6, "#ffcc00", 50, 170);
      Game.screenShake = Math.max(Game.screenShake, 0.6);
      break;
    case "ice_axe":
      spawnParticles(x, y, 10, "#6abaff", 70, 80);
      spawnParticles(x, y, 5, "#ffffff", 40, 60);
      break;
    default:
      spawnParticles(x, y, 6, "#8a4a8a", 50, 60);
      break;
  }
}

export function meleeHitPlayer(e, t, knockForce) {
  const { player } = state;
  if (player.invuln > 0 || window._DEV_GOD_MODE) return false;
  const armorDef = player.armor ? (ARMORS[player.armor]?.defense || 0) : 0;
  const dmg = Math.max(1, t.meleeDmg - armorDef);
  player.hp    -= dmg;
  player.invuln = CFG.playerInvuln;
  player.hurt   = 0.35; player.hpShowTimer = 3;
  player.knock  = Math.sign(player.x - e.x) * knockForce;
  spawnParticles(player.x, groundY - 50, 6, "#c1453b");
  if (player.coins > 0) {
    player.coins--;
    floaty(player.x, "−1🪙", "#ff6a4a");
  } else {
    floaty(player.x, `−${dmg}❤`, "#ff6a4a");
  }
  Audio.hit();
  return true;
}

export function updatePlayerAttack(dt) {
  const { player, enemies } = state;
  if (!player.weapon) return;
  if (player.swing > 0) player.swing -= dt;
  player.attackCd -= dt;
  if (player.attackCd > 0) return;
  const wBase = WEAPONS[player.weapon];
  const w = effectiveWeapon(player.weapon, player.weaponUpgrades || []);
  let tgt = null, bd = w.range;
  for (const e of enemies) {
    const d = dist(player.x, e.x);
    if (d < bd) { bd = d; tgt = e; }
  }
  if (!tgt) return;
  player.dir = Math.sign(tgt.x - player.x) || player.dir;
  player.swing = 0.32;
  if (wBase.type === "melee") {
    tgt.hp -= w.dmg; tgt.flash = 0.14; Audio.hit();
    meleeWeaponImpact(player.weapon, tgt.x, groundY - 28);
    spawnImpBlood(tgt, 1 + w.dmg * 0.12, groundY - 28);
    floaty(tgt.x, "-" + w.dmg, wBase.col);
    const et = ENEMY_TYPES[tgt.type];
    if (!et.noKnockback) tgt.knock = (tgt.knock || 0) + Math.sign(tgt.x - player.x) * 220;
    if (tgt.hp <= 0) {
      const knockDir = Math.sign(tgt.x - player.x) || 1;
      killEnemyWithAnimation(tgt, knockDir);
    }
  } else if (wBase.type === "ranged") {
    shootArrow(player.x, groundY - 72, tgt, null, player.weapon);
  } else {
    castSpell(player, wBase, tgt);
  }

  let cooldown = w.speed;
  if (wBase.spellType === "meteor") {
    cooldown *= 2.5;
  }
  player.attackCd = cooldown;
}
