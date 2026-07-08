import { CFG } from '../../config/config.js';
import { WEAPONS, effectiveWeapon } from '../../config/weapons.js';
import { ARMORS } from '../../config/armor.js';
import { ENEMY_TYPES } from '../../config/enemies.js';
import { dist, rand, applyCrit } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnCoin, spawnParticles, floaty, critFloaty } from '../world/SpawnSystem.js';
import { killEnemy, killEnemyWithAnimation, spawnImpBlood } from '../../util/EnemyUtils.js';
import { shootArrow } from './ProjectileSystem.js';
import { castSpell } from './SpellSystem.js';
import { startArcherShoot } from '../../rendering/sprites/Archer.js';
import { permanentDamageMultiplier } from '../infrastructure/RoguelikeSystem.js';

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
  if (Game.inMine || player.invuln > 0 || window._DEV_GOD_MODE) return false;
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
  Audio.playerHit();
  return true;
}

function triggerIceNova(player) {
  const { enemies } = state;
  Audio.spell();
  Game.screenShake = Math.max(Game.screenShake, 0.6);
  spawnParticles(player.x, groundY - 40, 40, "#bfefff", 160, 140);
  spawnParticles(player.x, groundY - 40, 20, "#ffffff", 100, 160);
  spawnParticles(player.x, groundY - 40, 15, "#6abaff", 120, 100);
  for (const e of enemies) {
    if (e.fleeing || e.dying) continue;
    if (dist(player.x, e.x) < 320) {
      e.rooted = Math.max(e.rooted || 0, 5);
      e.frost = Math.max(e.frost || 0, 5);
      spawnParticles(e.x, groundY - 30, 10, "#bfefff", 70, 80);
      spawnParticles(e.x, groundY - 30, 5, "#ffffff", 40, 90);
    }
  }
}

export function updatePlayerAttack(dt) {
  const { player, enemies } = state;
  if (!player.weapon) return;
  if (Game.inMine) { if (player.swing > 0) player.swing -= dt; player.attackCd -= dt; return; }
  if (player.weapon === "short_bow" && (player.weaponUpgrades || []).some(u => u.id === "is_eksplosion")) {
    player.iceNovaCd = (player.iceNovaCd || 0) - dt;
    if (player.iceNovaCd <= 0) {
      triggerIceNova(player);
      player.iceNovaCd = 10;
    }
  }
  if (player.swing > 0) player.swing -= dt;
  player.attackCd -= dt;
  if (player.attackCd > 0) return;
  const wBase = WEAPONS[player.weapon];
  const w = effectiveWeapon(player.weapon, player.weaponUpgrades || []);
  let tgt = null, bd = w.range, tgtIsAnimal = false;
  for (const e of enemies) {
    const d = dist(player.x, e.x);
    if (d < bd) { bd = d; tgt = e; tgtIsAnimal = false; }
  }
  for (const a of state.animals) {
    if (a.type !== "bear" || !a.alive || a.dying) continue;
    const d = dist(player.x, a.x);
    if (d < bd) { bd = d; tgt = a; tgtIsAnimal = true; }
  }
  if (!tgt) return;
  player.dir = Math.sign(tgt.x - player.x) || player.dir;
  player.swing = 0.32;
  if (wBase.type === "melee") {
    const crit = applyCrit(w.dmg * permanentDamageMultiplier(), CFG.critChance, CFG.critMultiplier);
    tgt.hp -= crit.damage; tgt.flash = 0.14; Audio.swordSwing(); Audio.hit();
    meleeWeaponImpact(player.weapon, tgt.x, groundY - 28);
    if (crit.isCrit) critFloaty(tgt.x, crit.damage);
    else floaty(tgt.x, "-" + crit.damage, wBase.col);
    if (tgtIsAnimal) {
      spawnParticles(tgt.x, groundY - 30, 5, "#8a2a2a");
      if (tgt.hp <= 0) {
        tgt.dying = true; tgt.deathT = 0;
        spawnParticles(tgt.x, groundY - 20, 8, "#7a4a2a");
        const reward = 8;
        for (let k = 0; k < reward; k++) spawnCoin(tgt.x + rand(-15, 15), 1, groundY - 20, rand(-50, 50), rand(-220, -120));
        floaty(tgt.x, "+" + reward + "🪙", "#f2c14e");
      }
    } else {
      spawnImpBlood(tgt, 1 + crit.damage * 0.12, groundY - 28);
      const et = ENEMY_TYPES[tgt.type];
      if (!et.noKnockback) tgt.knock = (tgt.knock || 0) + Math.sign(tgt.x - player.x) * 220;
      if (tgt.hp <= 0) {
        const knockDir = Math.sign(tgt.x - player.x) || 1;
        killEnemyWithAnimation(tgt, knockDir);
      }
    }
  } else if (wBase.type === "ranged") {
    startArcherShoot(player);
    shootArrow(player.x, groundY - 30, tgt, player, player.weapon);
  } else {
    castSpell(player, wBase, tgt);
  }

  let cooldown = w.speed;
  if (wBase.spellType === "meteor") {
    cooldown *= 2.5;
  }
  player.attackCd = cooldown;
}
