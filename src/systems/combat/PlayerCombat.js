import { CFG } from '../../config/config.js';
import { WEAPONS, effectiveWeapon, BASTION_GUARD_RANGE } from '../../config/weapons.js';
import { mergeUpgradeEffects } from '../../config/weaponUpgrades.js';
import { ARMORS, ARMOR_RARITY_COL, armorBlockChance } from '../../config/armor.js';
import { ENEMY_TYPES } from '../../config/enemies.js';
import { animalDef } from '../../config/animals.js';
import { clamp, dist, rand, applyCrit } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { inject } from '../../core/services.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnGoldReward, spawnParticles, floaty, critFloaty } from '../world/SpawnSystem.js';
import { killEnemyWithAnimation, spawnImpBlood } from '../../util/EnemyUtils.js';
import { shootArrow } from './ProjectileSystem.js';
import { castSpell, chainLightning, pickAutoTarget, updateGlacialWake } from './SpellSystem.js';
import { startArcherShoot } from '../../rendering/sprites/Archer.js';
import { permanentDamageMultiplier } from '../infrastructure/RoguelikeSystem.js';
import { entityWallLift } from '../../entities/Wall.js';
import { playerMountLift } from '../economy/MountSystem.js';

// Per-weapon hit effects. `enemyTgt` is the struck enemy when it can carry a
// status effect (null for animals), so themed weapons apply burns/chills/etc.
function meleeWeaponImpact(weaponId, x, y, enemyTgt = null) {
  switch (weaponId) {
    case "rusty_sword":
      spawnParticles(x, y, 5, "#8a8a92", 45, 55);
      spawnParticles(x, y, 3, "#a8703a", 35, 40); // rust flakes
      break;
    case "dagger":
      spawnParticles(x, y, 4, "#d8d8e0", 55, 45);
      spawnParticles(x, y, 2, "#ffffff", 30, 65);
      break;
    case "sword":
      spawnParticles(x, y, 6, "#c8c8d0", 55, 65);
      spawnParticles(x, y, 3, "#ffffff", 30, 80);
      break;
    case "longsword":
      spawnParticles(x, y, 8, "#d0d0e0", 65, 75);
      spawnParticles(x, y, 4, "#ffffff", 35, 90);
      Game.screenShake = Math.max(Game.screenShake, 0.12);
      break;
    case "war_axe":
      spawnParticles(x, y, 9, "#c8b068", 70, 70);
      spawnParticles(x, y, 5, "#8a2a4a", 50, 55);
      spawnParticles(x, y, 3, "#ffffff", 30, 75);
      Game.screenShake = Math.max(Game.screenShake, 0.2);
      break;
    case "war_hammer":
      // Ground-shaking slam: dust wave that staggers nearby enemies
      spawnParticles(x, y, 12, "#9a9aa8", 85, 70);
      spawnParticles(x, groundY - 8, 10, "#7a6a52", 120, 45);
      spawnParticles(x, groundY - 6, 6, "#54483a", 150, 30);
      for (const e of state.enemies) {
        if (e === enemyTgt || e.fleeing || e.dying || e.hp <= 0) continue;
        if (dist(e.x, x) < 80 && !ENEMY_TYPES[e.type]?.noKnockback) {
          e.knock = (e.knock || 0) + Math.sign(e.x - x || 1) * 160;
          spawnParticles(e.x, groundY - 12, 3, "#7a6a52", 60, 40);
        }
      }
      Game.screenShake = Math.max(Game.screenShake, 0.4);
      break;
    case "spear":
      spawnParticles(x, y, 6, "#e8dcb0", 75, 40);
      spawnParticles(x, y, 3, "#ffffff", 40, 55);
      break;
    case "flame_sword":
      spawnParticles(x, y, 10, "#ff7730", 70, 90);
      spawnParticles(x, y, 6, "#ffcc40", 40, 70);
      spawnParticles(x, y, 4, "#ff2200", 50, 50);
      if (enemyTgt) {
        // sets the target alight (same burn the fire arrows use)
        enemyTgt.burn = Math.max(enemyTgt.burn || 0, 3);
        enemyTgt.burnTick = 1;
        enemyTgt.burnDmg = Math.max(enemyTgt.burnDmg || 0, 1);
        enemyTgt.ignited = true;
      }
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
      spawnParticles(x, y + 8, 5, "#220033", 35, 25); // dark mist pooling low
      Game.screenShake = Math.max(Game.screenShake, 0.3);
      break;
    case "thunder_blade":
      spawnParticles(x, y, 14, "#cc66ff", 90, 110);
      spawnParticles(x, y, 8, "#ffffff", 50, 140);
      spawnParticles(x, y, 6, "#aaaaff", 70, 80);
      chainLightning(x, 5, 1); // static discharge arcs to a nearby enemy
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
      spawnParticles(x, y - 12, 8, "#fff8c0", 40, 190); // radiant flare
      Game.screenShake = Math.max(Game.screenShake, 0.6);
      break;
    case "ice_axe":
      spawnParticles(x, y, 10, "#6abaff", 70, 80);
      spawnParticles(x, y, 6, "#bfefff", 45, 70);
      spawnParticles(x, y, 5, "#ffffff", 40, 60);
      if (enemyTgt) enemyTgt.frost = Math.max(enemyTgt.frost || 0, 1.8); // chills the target
      Game.screenShake = Math.max(Game.screenShake, 0.15);
      break;
    case "lumberjack_axe":
      spawnParticles(x, y, 10, "#b8884e", 70, 70);
      spawnParticles(x, y + 4, 8, "#d2b07a", 65, 45);
      Game.screenShake = Math.max(Game.screenShake, 0.2);
      break;
    case "icicle_spear":
      spawnParticles(x, y, 12, "#bfefff", 70, 95);
      spawnParticles(x, y, 6, "#ffffff", 42, 110);
      if (enemyTgt) enemyTgt.frost = Math.max(enemyTgt.frost || 0, 2.2);
      Game.screenShake = Math.max(Game.screenShake, 0.16);
      break;
    case "cactus_whip":
      spawnParticles(x, y, 10, "#7fe05a", 72, 70);
      spawnParticles(x, y + 6, 6, "#375d28", 45, 45);
      Game.screenShake = Math.max(Game.screenShake, 0.12);
      break;
    case "gator_hammer":
      spawnParticles(x, y, 14, "#6d8a42", 95, 75);
      spawnParticles(x, groundY - 8, 16, "#4b3a28", 145, 45);
      Game.screenShake = Math.max(Game.screenShake, 0.5);
      break;
    case "obsidian_brand":
      spawnParticles(x, y, 14, "#ff6a28", 92, 110);
      spawnParticles(x, y, 7, "#1c1618", 55, 65);
      if (enemyTgt) {
        enemyTgt.burn = Math.max(enemyTgt.burn || 0, 2.2);
        enemyTgt.burnTick = Math.min(enemyTgt.burnTick || 1, 0.7);
        enemyTgt.burnDmg = Math.max(enemyTgt.burnDmg || 0, 1);
        enemyTgt.ignited = true;
      }
      Game.screenShake = Math.max(Game.screenShake, 0.24);
      break;
    case "shadow_scythe":
      spawnParticles(x, y, 16, "#8c4cff", 90, 100);
      spawnParticles(x, y + 8, 10, "#160a2c", 60, 50);
      Game.screenShake = Math.max(Game.screenShake, 0.34);
      break;
    default:
      spawnParticles(x, y, 6, "#8a4a8a", 50, 60);
      break;
  }
}

// Sparse ambient particles drifting off elemental and legendary weapons while
// they're carried, so the fancy gear reads as magical even out of combat.
const WEAPON_AMBIENT = {
  flame_sword:    { rate: 5,   cols: ["#ff7730", "#ffcc40"] },
  ice_axe:        { rate: 3,   cols: ["#bfefff", "#ffffff"] },
  thunder_blade:  { rate: 4,   cols: ["#cc88ff", "#ffffff"] },
  shadow_axe:     { rate: 3,   cols: ["#aa44cc", "#440066"] },
  kings_sword:    { rate: 2.5, cols: ["#ffe9a0", "#f2c14e"] },
  sunblade:       { rate: 5,   cols: ["#ffee80", "#ffffff"] },
  dark_bow:       { rate: 3,   cols: ["#880099", "#aa44cc"] },
  void_bow:       { rate: 3,   cols: ["#9933ff", "#ddaaff"] },
  dragons_bow:    { rate: 4,   cols: ["#ff6820", "#ffcc40"] },
  splinter_bow:   { rate: 3,   cols: ["#8fd05a", "#d8ffd0"] },
  lumberjack_axe: { rate: 2,   cols: ["#b8884e", "#d2b07a"] },
  icicle_spear:   { rate: 4,   cols: ["#bfefff", "#ffffff"] },
  blizzard_chime: { rate: 5,   cols: ["#d8f8ff", "#ffffff"] },
  cactus_whip:    { rate: 3,   cols: ["#7fe05a", "#d8ff9a"] },
  sandstorm_sling:{ rate: 3,   cols: ["#d8b46a", "#ffe0a0"] },
  acid_blowgun:   { rate: 3,   cols: ["#7fe05a", "#b8ff7a"] },
  gator_hammer:   { rate: 2,   cols: ["#6d8a42", "#4b3a28"] },
  obsidian_brand: { rate: 5,   cols: ["#ff6a28", "#ffd060"] },
  magma_mortar:   { rate: 4,   cols: ["#ff7a2a", "#ffd060"] },
  shadow_scythe:  { rate: 4,   cols: ["#8c4cff", "#160a2c"] },
  possessed_heart:{ rate: 5,   cols: ["#c45cff", "#f0c8ff"] },
  fire_tome:      { rate: 3,   cols: ["#ff6a2a", "#ffcc60"] },
  hydro_tome:     { rate: 2.5, cols: ["#4ab8e8", "#a0e8ff"] },
  lightning_tome: { rate: 3,   cols: ["#f0e060", "#ffffff"] },
  meteor_tome:    { rate: 3,   cols: ["#ff8840", "#ffd060"] },
  arcane_tome:    { rate: 3,   cols: ["#cc44ff", "#ff88ff"] },
  shadow_tome:    { rate: 3,   cols: ["#8822cc", "#440066"] },
  void_tome:      { rate: 4,   cols: ["#9922ff", "#ddaaff"] },
  pale_censer:      { rate: 6,   cols: ["#7cf2a8", "#eaffe8"] },
  tuning_fork:      { rate: 5,   cols: ["#b06aff", "#ffffff"] },
  weeping_sapphire: { rate: 5.5, cols: ["#7fd8ff", "#e8fbff"] },
  fractured_monolith:{ rate: 4,  cols: ["#ff5a2a", "#1c1418"] },
  raven_scepter:    { rate: 4,   cols: ["#9a86c8", "#1a1024"] },
};

function mergeInnateEffects(wBase, upgrades) {
  const fx = mergeUpgradeEffects(upgrades || []);
  const innate = wBase?.innate || null;
  if (!innate) return fx;
  const merged = { ...fx, _vfxCols: [...(fx._vfxCols || [])], _ids: [...(fx._ids || [])] };
  for (const k in innate) {
    const v = innate[k];
    if (typeof v === "number") merged[k] = (merged[k] || 0) + v;
    else if (v === true) merged[k] = true;
    else merged[k] = v;
  }
  return merged;
}

function poisonEnemy(e, seconds, dmg = 1, col = "#7fe05a") {
  if (!e || !seconds) return;
  e.poison = Math.max(e.poison || 0, seconds);
  e.poisonTick = Math.min(e.poisonTick || 1, 0.55);
  e.poisonDmg = Math.max(e.poisonDmg || 0, dmg || 1);
  spawnParticles(e.x, groundY + (e.fy || 0) - 24, 7, col, 40, 60);
}

function triggerHeatBurst(player, primary, damage, fx, col) {
  const needed = Math.max(1, Math.round(fx.heatStacks || 0));
  if (!needed) return;
  const now = performance.now() / 1000;
  const heat = player.weaponHeat && player.weaponHeat.weapon === player.weapon && now - player.weaponHeat.t < 4
    ? player.weaponHeat
    : { weapon: player.weapon, n: 0, t: now };
  heat.n++;
  heat.t = now;
  player.weaponHeat = heat;
  if (heat.n < needed) {
    if (heat.n >= needed - 1) floaty(player.x, "Overheat ready", col, 12);
    return;
  }
  heat.n = 0;
  const radius = fx.heatBurstRadius || 120;
  const burstDmg = Math.max(1, Math.round(damage * (fx.heatBurstFrac || 0.65)));
  spawnParticles(primary.x, groundY - 22, 28, col, radius, 135);
  spawnParticles(primary.x, groundY - 18, 14, "#ffd060", radius * 0.7, 150);
  Game.screenShake = Math.max(Game.screenShake || 0, 0.48);
  Audio.explosion();
  for (const e of state.enemies) {
    if (e === primary || e.fleeing || e.dying || e.hp <= 0) continue;
    if (dist(e.x, primary.x) > radius) continue;
    e.hp -= burstDmg;
    e.flash = 0.14;
    e.burn = Math.max(e.burn || 0, 3);
    e.burnTick = Math.min(e.burnTick || 1, 0.55);
    e.burnDmg = Math.max(e.burnDmg || 0, 1);
    e.ignited = true;
    spawnImpBlood(e, 0.8 + burstDmg * 0.06, groundY + (e.fy || 0) - 24);
    floaty(e.x, "-" + burstDmg, col);
    if (!ENEMY_TYPES[e.type]?.noKnockback) e.knock = (e.knock || 0) + Math.sign(e.x - primary.x || 1) * 190;
    if (e.hp <= 0) killEnemyWithAnimation(e, Math.sign(e.x - primary.x) || 1);
  }
}

function updateWeaponAmbientFX(dt) {
  const { player } = state;
  if (!player.weapon || player.hp <= 0) return;
  const wBase = WEAPONS[player.weapon];
  // Generated weapons aren't in the curated ambient table — fall back to a
  // sparkle keyed off their rolled color once they're epic/legendary.
  const amb = WEAPON_AMBIENT[player.weapon] ||
    (wBase.generated && wBase.rarity >= 2 ? { rate: 1.4 + wBase.rarity * 0.9, cols: [wBase.col, "#ffffff"] } : null);
  const fx = mergeInnateEffects(wBase, player.weaponUpgrades);
  const upgCols = fx._vfxCols || [];
  if (!amb && !upgCols.length) return;
  const lift = entityWallLift(player) + (player.jumpH || 0) + playerMountLift(player);
  const handOff = WEAPONS[player.weapon].type === "melee" ? 14 : 10;
  const handX = () => player.x + (player.dir || 1) * handOff + rand(-4, 4);
  const handY = () => groundY - 30 - lift + rand(-8, 4);
  if (amb && Math.random() < amb.rate * dt) {
    spawnParticles(handX(), handY(), 1, amb.cols[Math.random() < 0.7 ? 0 : 1], 12, 22);
  }
  // Applied upgrades weave their own colors into the weapon's aura.
  if (upgCols.length && Math.random() < (1.5 + fx._tierRank * 1.2) * dt) {
    spawnParticles(handX(), handY(), 1, upgCols[Math.floor(Math.random() * upgCols.length)], 14, 26);
  }
  if (fx.frostAura) {
    const r = fx.frostAuraRadius || 175;
    let touched = 0;
    for (const e of state.enemies) {
      if (e.fleeing || e.dying || e.hp <= 0 || dist(e.x, player.x) > r) continue;
      e.slow = Math.max(e.slow || 0, fx.frostAura);
      if (Math.random() < dt * 5) spawnParticles(e.x, groundY + (e.fy || 0) - 24, 1, "#d8f8ff", 20, 42);
      touched++;
    }
    if (touched && Math.random() < dt * 8) spawnParticles(player.x + rand(-r * 0.35, r * 0.35), groundY - 10, 1, "#d8f8ff", 24, 55);
  }
}

function updateArmorPassiveFX(dt) {
  const { player } = state;
  if (!player || player.hp <= 0) return;
  if ((player.armorHealCd || 0) > 0) player.armorHealCd = Math.max(0, player.armorHealCd - dt);

  const armor = player.armor ? ARMORS[player.armor] : null;
  const amb = armor?.ability?.ambient;
  if (!amb) return;

  const lift = entityWallLift(player) + (player.jumpH || 0) + playerMountLift(player);
  if (Math.random() < amb.rate * dt) {
    const col = amb.cols[Math.floor(Math.random() * amb.cols.length)] || armor.col;
    const side = Math.random() < 0.5 ? -1 : 1;
    spawnParticles(player.x + side * rand(3, 13), groundY - 42 - lift + rand(-8, 10), 1, col, 12, 30);
  }
}

function armorBlockBurst(player, armor, lift) {
  const ability = armor?.ability;
  if (!ability) return;

  const col = ability.blockPulse?.col || armor.col;
  if (ability.readyAttackOnBlock) {
    player.attackCd = 0;
    player.riposteT = Math.max(player.riposteT || 0, 1.1);
    floaty(player.x, ability.name + "!", ARMOR_RARITY_COL[armor.rarity], 14);
  }
  if (ability.blockInvuln) player.invuln = Math.max(player.invuln || 0, ability.blockInvuln);
  if (ability.blockSpark) {
    spawnParticles(player.x, groundY - 44 - lift, 12, "#f2d28a", 92, 120);
    spawnParticles(player.x, groundY - 44 - lift, 5, "#ffffff", 50, 130);
  }
  if (ability.healOnBlock && player.hp < player.maxHp && (player.armorHealCd || 0) <= 0) {
    player.hp = Math.min(player.maxHp, player.hp + (ability.healOnBlock.amount || 1));
    player.hpShowTimer = Math.max(player.hpShowTimer || 0, 2.5);
    player.armorHealCd = ability.healOnBlock.cooldown || 10;
    floaty(player.x, "+" + (ability.healOnBlock.amount || 1) + "❤", "#fff2c0");
    spawnParticles(player.x, groundY - 42 - lift, 12, "#fff2c0", 70, 110);
  }

  const pulse = ability.blockPulse;
  if (!pulse) return;
  const radius = pulse.radius || 140;
  spawnParticles(player.x, groundY - 42 - lift, 12 + Math.round(radius / 18), col, radius * 0.55, 120);
  if (!ability.readyAttackOnBlock) floaty(player.x, ability.name + "!", col, armor.rarity >= 3 ? 16 : 14);
  let hit = 0;
  for (const e of state.enemies) {
    if (e.fleeing || e.dying || e.hp <= 0) continue;
    const d = dist(e.x, player.x);
    if (d > radius) continue;
    const et = ENEMY_TYPES[e.type] || {};
    const away = Math.sign(e.x - player.x) || 1;
    if (pulse.knock && !et.noKnockback) {
      const falloff = 1 - d / (radius * 1.45);
      const dir = pulse.knock < 0 ? -away : away;
      e.knock = (e.knock || 0) + dir * Math.abs(pulse.knock) * clamp(falloff, 0.35, 1);
    }
    if (pulse.damage) {
      e.hp -= pulse.damage;
      e.flash = Math.max(e.flash || 0, 0.14);
      floaty(e.x, "-" + pulse.damage, col);
    }
    if (pulse.burn) {
      e.burn = Math.max(e.burn || 0, pulse.burn);
      e.burnTick = Math.min(e.burnTick || 1, 0.45);
      e.burnDmg = Math.max(e.burnDmg || 0, pulse.burnDmg || 1);
      e.ignited = true;
    }
    if (pulse.frost) e.frost = Math.max(e.frost || 0, pulse.frost);
    if (pulse.root) e.rooted = Math.max(e.rooted || 0, pulse.root);
    if (pulse.slow) e.slow = Math.max(e.slow || 0, pulse.slow);
    spawnParticles(e.x, groundY + (e.fy || 0) - 24, 4, col, 42, 64);
    hit++;
    if (e.hp <= 0) killEnemyWithAnimation(e, away);
  }
  if (hit > 0) {
    Game.screenShake = Math.max(Game.screenShake || 0, Math.min(0.5, 0.12 + radius / 800));
    Audio.hit();
  }
}

// Central player-damage entry point: applies armor (block chance + heavy-hit
// shaving), i-frames, hurt flash, knockback and feedback. Returns the damage
// actually dealt (0 = the armor blocked the hit), or null when the player
// can't be hit right now (i-frames, god mode, already dead).
export function damagePlayer(rawDmg, opts = {}) {
  const { player } = state;
  if (player.hp <= 0 || player.invuln > 0 || inject('godMode')) return null;
  const armor = player.armor ? ARMORS[player.armor] : null;
  const def = armor ? (armor.defense || 0) : 0;
  let dmg = Math.max(1, Math.round(rawDmg - def / 3));
  const blocked = def > 0 && Math.random() < armorBlockChance(def);
  player.invuln = CFG.playerInvuln;
  player.hpShowTimer = 3;
  if (opts.knock) player.knock = opts.knock;
  const lift = entityWallLift(player) + (player.jumpH || 0) + playerMountLift(player);
  if (blocked) {
    floaty(player.x, "🛡 Blocked!", ARMOR_RARITY_COL[armor.rarity]);
    spawnParticles(player.x, groundY - 45 - lift, 8, "#cfd3d9", 90, 90);
    spawnParticles(player.x, groundY - 45 - lift, 4, armor.col, 60, 70);
    armorBlockBurst(player, armor, lift);
    Audio.hit();
    return 0;
  }
  player.hp -= dmg;
  player.hurt = 0.35;
  floaty(player.x, `−${dmg}❤`, "#ff6a4a");
  spawnParticles(player.x, groundY - 50 - lift, 6, "#c1453b");
  Audio.playerHit();
  return dmg;
}

export function meleeHitPlayer(e, t, knockForce) {
  const { player } = state;
  const lift = entityWallLift(player);
  if (lift > 20 && !e.wallTopWall && e.aiState !== "climbOver" && e.aiState !== "vaulting") return false;
  if ((e.blindedHits || 0) > 0) {
    e.blindedHits--;
    e.blind = Math.max(e.blind || 0, 0.7);
    e.attackAnim = Math.max(e.attackAnim || 0, 0.16);
    floaty(e.x, "Miss", "#d8b46a", 12);
    spawnParticles(e.x, groundY - 24 + (e.fy || 0), 7, "#d8b46a", 42, 45);
    return true;
  }
  const dealt = damagePlayer(t.meleeDmg, { knock: Math.sign(player.x - e.x) * knockForce });
  if (dealt === null) return false;
  // Imps snatch a coin when their hit actually lands — a block protects the purse too.
  if (dealt > 0 && player.coins > 0) {
    player.coins--;
    floaty(player.x + 16, "−1🪙", "#ff6a4a");
  }
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

function playerMomentumLevel() {
  return (Game.momentumTimer || 0) > 0 ? (Game.momentumLevel || 0) : 0;
}

function playerMomentumDamageMultiplier() {
  return 1 + playerMomentumLevel() * 0.04;
}

function playerMomentumCooldownMultiplier() {
  return Math.max(0.76, 1 - playerMomentumLevel() * 0.045);
}

function playerRiposteDamageMultiplier(player) {
  return (player.riposteT || 0) > 0 ? (CFG.dodgeRiposteDamageMult || 1.6) : 1;
}

function grantKillBarrier(player, seconds, col = "#ffffff") {
  if (!seconds || seconds <= 0) return;
  player.invuln = Math.max(player.invuln || 0, seconds);
  spawnParticles(player.x, groundY - 42, 10, col, 46, 90);
  spawnParticles(player.x, groundY - 42, 5, "#ffffff", 28, 95);
  floaty(player.x, "Guarded", col);
}

function finishRiposte(player, x) {
  if ((player.riposteT || 0) <= 0) return;
  player.riposteT = 0;
  Game.screenShake = Math.max(Game.screenShake || 0, 0.22);
  spawnParticles(x, groundY - 32, 16, "#ffd23e", 95, 115);
}

function cleaveNearbyEnemies(player, primary, damage) {
  const range = CFG.meleeCleaveRange || 84;
  const cleaveDmg = Math.max(1, Math.round(damage * (CFG.meleeCleaveDamageFrac || 0.4)));
  let hits = 0;
  for (const e of state.enemies) {
    if (e === primary || e.fleeing || e.dying || e.hp <= 0) continue;
    if (dist(e.x, primary.x) > range) continue;
    e.hp -= cleaveDmg;
    e.flash = 0.12;
    if (!ENEMY_TYPES[e.type]?.noKnockback) e.knock = (e.knock || 0) + Math.sign(e.x - player.x || 1) * 170;
    spawnImpBlood(e, 0.75 + cleaveDmg * 0.08, groundY + (e.fy || 0) - 24);
    spawnParticles(e.x, groundY + (e.fy || 0) - 24, 4, "#8a2a4a", 42, 56);
    floaty(e.x, "-" + cleaveDmg, "#c88a5a");
    hits++;
    if (e.hp <= 0) killEnemyWithAnimation(e, Math.sign(e.x - player.x) || 1);
  }
  if (hits > 0) {
    floaty(primary.x, "Cleave x" + hits, "#f2c14e");
    spawnParticles(primary.x, groundY - 24, 10 + hits * 3, "#c88a5a", 115, 80);
  }
}

// ---------- Upgrade-driven melee effects ----------

// Every-hit splash (Rending Strikes, Earthshatter, Royal Decree, ...).
function splashDamage(player, primary, damage, frac, range, col) {
  const splashDmg = Math.max(1, Math.round(damage * frac));
  let hits = 0;
  for (const e of state.enemies) {
    if (e === primary || e.fleeing || e.dying || e.hp <= 0) continue;
    if (dist(e.x, primary.x) > range) continue;
    e.hp -= splashDmg;
    e.flash = 0.12;
    if (!ENEMY_TYPES[e.type]?.noKnockback) e.knock = (e.knock || 0) + Math.sign(e.x - player.x || 1) * 140;
    spawnImpBlood(e, 0.6 + splashDmg * 0.06, groundY + (e.fy || 0) - 24);
    floaty(e.x, "-" + splashDmg, col);
    hits++;
    if (e.hp <= 0) killEnemyWithAnimation(e, Math.sign(e.x - player.x) || 1);
  }
  if (hits > 0) spawnParticles(primary.x, groundY - 20, 8 + hits * 3, col, 110, 70);
}

// A ground-hugging energy wave that cuts through the enemy line
// (Knight's Oath, Solar Lance, Crownfire).
function slashWave(player, dmg, col) {
  const dir = player.dir || 1;
  const reach = 190;
  const beamDmg = Math.max(1, Math.round(dmg));
  for (let s = 0; s < 14; s++) {
    const px = player.x + dir * (14 + (reach - 14) * (s / 13));
    spawnParticles(px, groundY - 26 + Math.sin(s * 1.7) * 5, 2, col, 26, 40);
    if (s % 3 === 0) spawnParticles(px, groundY - 26, 1, "#ffffff", 14, 55);
  }
  for (const e of state.enemies) {
    if (e.fleeing || e.dying || e.hp <= 0) continue;
    const dx = (e.x - player.x) * dir;
    if (dx < 0 || dx > reach) continue;
    const et = ENEMY_TYPES[e.type];
    if (et?.flying && (e.fy || -80) < -60) continue; // the wave hugs the ground
    e.hp -= beamDmg;
    e.flash = 0.14;
    spawnImpBlood(e, 0.8 + beamDmg * 0.06, groundY + (e.fy || 0) - 24);
    floaty(e.x, "-" + beamDmg, col);
    if (!et?.noKnockback) e.knock = (e.knock || 0) + dir * 180;
    if (e.hp <= 0) killEnemyWithAnimation(e, dir);
  }
  Game.screenShake = Math.max(Game.screenShake, 0.25);
  Audio.swordSwing();
}

// Kills detonate (Phoenix Heart, Supernova).
function killNova(x, dmg, fx) {
  const col = fx.novaCol || "#ff7730";
  const novaDmg = Math.max(1, Math.round(dmg * (fx.novaFrac || 0.8)));
  spawnParticles(x, groundY - 26, 26, col, fx.novaR, 130);
  spawnParticles(x, groundY - 26, 12, "#ffffff", fx.novaR * 0.6, 150);
  Game.screenShake = Math.max(Game.screenShake, 0.4);
  Audio.explosion();
  for (const e of state.enemies) {
    if (e.fleeing || e.dying || e.hp <= 0) continue;
    if (dist(e.x, x) > fx.novaR) continue;
    e.hp -= novaDmg;
    e.flash = 0.14;
    spawnImpBlood(e, 0.8, groundY + (e.fy || 0) - 24);
    floaty(e.x, "-" + novaDmg, col);
    if (e.hp <= 0) killEnemyWithAnimation(e, Math.sign(e.x - x) || 1);
  }
}

// A bolt from the sky crashes down on the struck enemy (Thunderlord's Verdict).
function skyBoltStrike(tgt, dmg) {
  const et = ENEMY_TYPES[tgt.type];
  const ey = groundY + (et?.flying ? (tgt.fy || -80) : -24);
  for (let yy = groundY - 320; yy < ey; yy += 9) {
    spawnParticles(tgt.x + rand(-6, 6), yy, 1, "#ffffff", 6, 6);
    if (Math.random() < 0.4) spawnParticles(tgt.x + rand(-10, 10), yy, 1, "#ccccff", 12, 8);
  }
  const boltDmg = Math.max(1, Math.round(dmg * 0.8));
  tgt.hp -= boltDmg;
  tgt.flash = 0.16;
  floaty(tgt.x, "-" + boltDmg + "⚡", "#eeccff");
  Game.screenShake = Math.max(Game.screenShake, 0.35);
  Audio.spell();
  chainLightning(tgt.x, dmg, 2);
}

// One full melee hit resolution: damage riders, execute, splash, kill payoffs.
function meleeStrike(player, tgt, tgtIsAnimal, wBase, fx, rawDmg, playerLift) {
  let dmg = rawDmg;
  if (fx.berserk && player.maxHp > 0) dmg *= 1 + fx.berserk * clamp(1 - player.hp / player.maxHp, 0, 1);
  const chilled = !tgtIsAnimal && ((tgt.frost || 0) > 0 || (tgt.rooted || 0) > 0);
  if (fx.shatter && chilled) dmg += fx.shatter;
  if (fx.comboDmg) {
    const now = performance.now() / 1000;
    const prev = player.weaponCombo;
    const sameChain = prev && prev.weapon === player.weapon && now - prev.t < 2.4;
    const combo = Math.min(5, sameChain ? (prev.n || 1) + 1 : 1);
    player.weaponCombo = { weapon: player.weapon, n: combo, t: now };
    if (combo > 1) {
      dmg += fx.comboDmg * (combo - 1);
      if (combo >= 3) {
        const col = fx._vfxCols?.length ? fx._vfxCols[fx._vfxCols.length - 1] : wBase.col;
        spawnParticles(tgt.x, groundY - 28 - playerLift, 4 + combo, col, 45, 70);
        floaty(tgt.x + 10, "Combo x" + combo, col);
      }
    }
  }
  const crit = applyCrit(dmg, CFG.critChance + (fx.critBonus || 0), CFG.critMultiplier);
  tgt.hp -= crit.damage;
  tgt.flash = 0.14;
  Audio.hit();
  meleeWeaponImpact(player.weapon, tgt.x, groundY - 28 - playerLift, tgtIsAnimal ? null : tgt);
  if (fx.shatter && chilled) {
    spawnParticles(tgt.x, groundY - 30, 12, "#bfefff", 80, 100);
    floaty(tgt.x, "❄ Shatter!", "#bfefff");
  }
  if (crit.isCrit) critFloaty(tgt.x, crit.damage);
  else floaty(tgt.x, "-" + crit.damage, wBase.col);

  if (tgtIsAnimal) {
    spawnParticles(tgt.x, groundY - 30, 5, "#8a2a2a");
    if (tgt.hp <= 0) {
      tgt.dying = true; tgt.deathT = 0;
      const animal = animalDef(tgt.type);
      spawnParticles(tgt.x, groundY - 20, 8, animal.blood || "#7a4a2a");
      const reward = spawnGoldReward(tgt.x, animal.reward || 1, "hunt", { spreadX: 15, fromY: groundY - 20, vx: 50, vyMin: 120, vyMax: 220 });
      if (reward > 0) floaty(tgt.x, "+" + reward + "🪙", "#f2c14e");
    }
    return;
  }

  if (fx.burnHit) {
    tgt.burn = Math.max(tgt.burn || 0, 3);
    tgt.burnTick = 1;
    tgt.burnDmg = Math.max(tgt.burnDmg || 0, fx.burnHit);
    tgt.ignited = true;
  }
  if (fx.frostHit) {
    tgt.frost = Math.max(tgt.frost || 0, fx.frostHit);
    spawnParticles(tgt.x, groundY - 28, 6, "#bfefff", 45, 60);
  }
  if (fx.rootHit && Math.random() < fx.rootHit) {
    tgt.rooted = Math.max(tgt.rooted || 0, 1.5);
    spawnParticles(tgt.x, groundY - 14, 8, "#8fd8ff", 26, 40);
  }
  if (fx.slowHit) tgt.slow = Math.max(tgt.slow || 0, fx.slowHit);
  if (fx.poisonHit) poisonEnemy(tgt, fx.poisonHit, fx.poisonDmg || 1, wBase.col);
  if (fx.heatStacks) triggerHeatBurst(player, tgt, crit.damage, fx, wBase.col);
  spawnImpBlood(tgt, 1 + crit.damage * 0.12, groundY - 28);
  const et = ENEMY_TYPES[tgt.type];
  if (!et.noKnockback) tgt.knock = (tgt.knock || 0) + Math.sign(tgt.x - player.x) * (220 + (fx.knockBonus || 0));
  if (fx.chainBonus && player.weapon === "thunder_blade") {
    chainLightning(tgt.x, Math.max(1, crit.damage * 0.55), fx.chainBonus);
  }
  if (fx.skyBolt && Math.random() < fx.skyBolt) skyBoltStrike(tgt, crit.damage);
  if (fx.execute && tgt.hp > 0 && !et.boss && tgt.hp <= (et.hp || 6) * fx.execute) {
    tgt.hp = 0;
    floaty(tgt.x, "☠ Executed!", "#ff4040");
    spawnParticles(tgt.x, groundY - 28, 14, "#ff4040", 70, 90);
  }
  if (fx.splashFrac) splashDamage(player, tgt, crit.damage, fx.splashFrac, fx.splashR || 90, wBase.col);
  if (fx.lifeLink && player.hp < player.maxHp) {
    player.lifeLinkAccum = (player.lifeLinkAccum || 0) + crit.damage * fx.lifeLink;
    if (player.lifeLinkAccum >= 1) {
      const heal = Math.min(Math.floor(player.lifeLinkAccum), player.maxHp - player.hp);
      player.lifeLinkAccum -= Math.floor(player.lifeLinkAccum);
      if (heal > 0) {
        player.hp += heal;
        player.hpShowTimer = Math.max(player.hpShowTimer || 0, 2);
        spawnParticles(player.x, groundY - 40, 3 + heal * 2, "#ff6a8a", 34, 55);
      }
    }
  }
  if (tgt.hp <= 0) {
    const knockDir = Math.sign(tgt.x - player.x) || 1;
    if (fx.novaR) killNova(tgt.x, crit.damage, fx);
    if (fx.healOnKill && player.hp < player.maxHp && Math.random() < fx.healOnKill) {
      player.hp = Math.min(player.maxHp, player.hp + 1);
      floaty(player.x, "+1❤", "#7be87b");
      spawnParticles(player.x, groundY - 40, 8, "#7be87b", 40, 70);
    }
    if (fx.goldOnKill && Math.random() < fx.goldOnKill) {
      const g = spawnGoldReward(tgt.x, 2, "hunt", { spreadX: 12, fromY: groundY - 24, vyMin: 120, vyMax: 200 });
      if (g > 0) floaty(tgt.x + 14, "+" + g + "🪙", "#f2c14e");
    }
    if (fx.barrierOnKill) {
      const col = fx._vfxCols?.length ? fx._vfxCols[fx._vfxCols.length - 1] : wBase.col;
      grantKillBarrier(player, fx.barrierOnKill, col);
    }
    cleaveNearbyEnemies(player, tgt, crit.damage);
    killEnemyWithAnimation(tgt, knockDir);
  } else if (fx.alwaysCleave) {
    cleaveNearbyEnemies(player, tgt, crit.damage);
  }
}

// Copy upgrade flags onto a freshly spawned player arrow.
function applyArrowUpgrades(ar, fx) {
  if (fx.pierce) ar.pierce = (ar.pierce || 0) + fx.pierce;
  if (fx.fireArrows) ar.fireArrow = true;
  if (fx.critBonus) ar.critBonus = fx.critBonus;
  if (fx.explosiveR) { ar.explosiveR = fx.explosiveR; ar.explosiveFrac = fx.explosiveFrac || 0.8; }
  if (fx.gravityArrow) ar.gravityChance = fx.gravityArrow;
  if (fx.frostHit) ar.frostArrow = true;
  if (fx.rootHit && Math.random() < fx.rootHit) ar.rootArrow = true;
  if (fx.splinterCount) {
    ar.splinterCount = Math.max(ar.splinterCount || 0, Math.round(fx.splinterCount));
    ar.splinterRadius = fx.splinterRadius || 135;
    ar.splinterDmgFrac = fx.splinterDmgFrac || 0.4;
  }
  if (fx.poisonArrow) {
    ar.poisonArrow = fx.poisonArrow;
    ar.poisonDmg = fx.poisonDmg || 1;
  }
  if (fx.acidPool) ar.acidPool = fx.acidPool;
  if (fx.sandBlind) {
    ar.sandBlind = Math.max(ar.sandBlind || 0, Math.round(fx.sandBlind));
    ar.sandBlindRadius = fx.sandBlindRadius || 75;
  }
  if (fx.slowHit) ar.slowHit = fx.slowHit;
  if (fx.healOnKill) ar.healOnKill = fx.healOnKill;
  if (fx.goldOnKill) ar.goldOnKill = fx.goldOnKill;
  if (fx.barrierOnKill) ar.barrierOnKill = fx.barrierOnKill;
  if (fx.bounceArrow) ar.bouncing = true;
  if (fx.chainArrow) ar.chainBounces = Math.max(ar.chainBounces || 0, fx.chainArrow);
  if (fx.shatterCrit) ar.shatterCrit = Math.max(ar.shatterCrit || 0, Math.round(fx.shatterCrit));
  if (fx.powerArrow && Math.random() < fx.powerArrow) {
    ar.powered = true;
    ar.vx *= 1.22;
    ar.vy *= 1.22;
    ar.pierce = (ar.pierce || 0) + 1;
    ar.dmgMult = Math.max(1, (ar.dmgMult || ar.dmg || 1) * 1.45);
    ar.dmg = Math.round(ar.dmgMult);
  }
  if (fx._vfxCols?.length) {
    ar.upgradeCol = fx._vfxCols[fx._vfxCols.length - 1];
    ar.upgradeRank = fx._tierRank || 1;
  }
}

// ---------- Autonomous foci ----------
// Four staffs pick their own target instead of hitting whatever is nearest.
// Each rule may legitimately return nothing — that means "hold fire", not
// "fall back to the default", which is what makes the Bastion Scepter dead
// weight out in the field.

function enemyEyeY(e) {
  return ENEMY_TYPES[e.type]?.flying ? groundY + (e.fy || -80) : groundY - 24 + (e.fy || 0);
}

function autoTargetEnemy(rule, player, range, fx) {
  const live = [];
  for (const e of state.enemies) {
    if (e.fleeing || e.dying || e.hp <= 0) continue;
    if (dist(player.x, e.x) > range) continue;
    live.push(e);
  }
  if (!live.length) return null;
  switch (rule) {
    // The Rupture Shard doesn't care about proximity or health.
    case "chaos":
      return live[Math.floor(Math.random() * live.length)];
    // The Gale-Staff wants whatever is furthest off the ground; when the whole
    // lane is grounded that ties, and the nearest body wins the tie-break.
    case "highest": {
      let best = null, bestY = Infinity, bd = Infinity;
      for (const e of live) {
        if ((e.galeH || 0) > 6) continue; // already up there
        const y = enemyEyeY(e), d = dist(player.x, e.x);
        if (y < bestY - 1 || (Math.abs(y - bestY) <= 1 && d < bd)) { bestY = y; bd = d; best = e; }
      }
      return best;
    }
    // The Bastion Scepter is silent unless you are holding the line, then it
    // answers whatever stands closest to the gates.
    case "gate": {
      const guard = BASTION_GUARD_RANGE + (fx?.bastionRange || 0);
      if (Math.abs(player.x - CFG.baseX) > guard) return null;
      let best = null, bd = Infinity;
      for (const e of live) {
        const d = Math.abs(e.x - CFG.baseX);
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    }
    default: {
      let best = null, bd = Infinity;
      for (const e of live) {
        const d = dist(player.x, e.x);
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    }
  }
}

// Paces walked between soul-larvae. Teleports (respawn, biome shift) jump the
// player far further than a frame of walking ever could, so they don't count.
const HIVE_STRIDE_PX = 130;
const HIVE_STRIDE_TELEPORT = 220;

function updateHiveStride(player, wBase, dt) {
  const prev = player.hiveLastX;
  player.hiveLastX = player.x;
  if (prev === undefined) return;
  const moved = Math.abs(player.x - prev);
  if (moved > HIVE_STRIDE_TELEPORT) return;
  const fx = mergeInnateEffects(wBase, player.weaponUpgrades);
  const stride = Math.max(45, HIVE_STRIDE_PX - (fx.hiveStride || 0));
  player.hiveStride = (player.hiveStride || 0) + moved;
  // the hive stirs as the charge builds
  if (player.hiveStride > stride * 0.6 && Math.random() < dt * 6) {
    spawnParticles(player.x + (player.dir || 1) * 16, groundY - 34, 1, "#9ef0b8", 12, 26);
  }
  if (player.hiveStride < stride || player.attackCd > 0) return;
  const w = effectiveWeapon(player.weapon, player.weaponUpgrades || []);
  const tgt = autoTargetEnemy("nearest", player, w.range, fx);
  if (!tgt) return;
  player.hiveStride = 0;
  player.dir = Math.sign(tgt.x - player.x) || player.dir;
  player.castAnim = 0.55;
  castSpell(player, wBase, tgt);
  player.attackCd = Math.max(0.25, w.speed * 0.5) * playerMomentumCooldownMultiplier();
}

export function updatePlayerAttack(dt) {
  const { player, enemies } = state;
  if (player.castAnim > 0) player.castAnim -= dt;
  updateWeaponAmbientFX(dt);
  updateArmorPassiveFX(dt);
  if (!player.weapon) return;
  if (player.weapon === "short_bow" && (player.weaponUpgrades || []).some(u => u.id === "ice_explosion")) {
    player.iceNovaCd = (player.iceNovaCd || 0) - dt;
    if (player.iceNovaCd <= 0) {
      triggerIceNova(player);
      player.iceNovaCd = 10;
    }
  }
  // The Weeping Sapphire never swings or casts — the staff dragging along the
  // ground is the whole weapon, so it runs on distance travelled, not a timer.
  if (WEAPONS[player.weapon].autoTarget === "trail") {
    updateGlacialWake(player, WEAPONS[player.weapon]);
    return;
  }
  if (player.swing > 0) player.swing -= dt;
  player.attackCd -= dt;
  const wBase = WEAPONS[player.weapon];
  // The Hive-King's Scepter has no firing clock at all — it sheds a larva
  // every few paces walked, so kiting is the reload.
  if (wBase.autoTarget === "stride") { updateHiveStride(player, wBase, dt); return; }
  if (player.attackCd > 0) return;
  const w = effectiveWeapon(player.weapon, player.weaponUpgrades || []);
  const fx = mergeInnateEffects(wBase, player.weaponUpgrades);

  // Self-driving casters choose their own mark — the crowded side of the lane,
  // the tightest cluster, the weakest straggler — so they skip the
  // nearest-enemy scan entirely.
  const bespokeAutoTarget = ["sweep", "densestSide", "cluster", "weakest"].includes(wBase.autoTarget);
  if (bespokeAutoTarget) {
    const mark = pickAutoTarget(player, wBase, w);
    if (!mark) return;
    player.dir = Math.sign(mark.x - player.x) || player.dir;
    player.castAnim = 0.55;
    castSpell(player, wBase, mark);
    finishRiposte(player, mark.x);
    let autoCd = w.speed;
    if (fx.freeCast && Math.random() < fx.freeCast) {
      autoCd = 0.1;
      floaty(player.x, "✨ Free cast", "#ffffff");
    }
    player.attackCd = autoCd * playerMomentumCooldownMultiplier();
    return;
  }

  let tgt = null, tgtIsAnimal = false;
  if (wBase.autoTarget) {
    // Autonomous foci choose their own victim; if their rule finds nobody they
    // simply hold their fire rather than falling back to "whatever is closest".
    tgt = autoTargetEnemy(wBase.autoTarget, player, w.range, fx);
    if (!tgt) return;
  } else {
    const canHuntAnimals = wBase.type === "ranged";
    let bd = w.range;
    for (const e of enemies) {
      if (e.fleeing || e.dying || e.hp <= 0) continue;
      const d = dist(player.x, e.x);
      if (d < bd) { bd = d; tgt = e; tgtIsAnimal = false; }
    }
    const hasEnemyTarget = !!tgt;
    for (const a of state.animals) {
      const isBear = a.type === "bear";
      if (!a.alive || a.dying) continue;
      if (!isBear && (!canHuntAnimals || hasEnemyTarget)) continue;
      const d = dist(player.x, a.x);
      if (d < bd) { bd = d; tgt = a; tgtIsAnimal = true; }
    }
  }
  if (!tgt) return;
  player.dir = Math.sign(tgt.x - player.x) || player.dir;
  player.swing = 0.32;
  const playerLift = entityWallLift(player) + (player.jumpH || 0) + playerMountLift(player);
  const riposteMult = playerRiposteDamageMultiplier(player);
  if (wBase.type === "melee") {
    Audio.swordSwing();
    const baseDmg = w.dmg * permanentDamageMultiplier() * playerMomentumDamageMultiplier() * riposteMult;
    meleeStrike(player, tgt, tgtIsAnimal, wBase, fx, baseDmg, playerLift);
    // Shadow Dance: a second, slightly weaker strike blurs in behind the first.
    if (!tgtIsAnimal && fx.doubleStrike && tgt.hp > 0 && !tgt.dying && Math.random() < fx.doubleStrike) {
      spawnParticles(tgt.x, groundY - 30, 8, "#aa44cc", 55, 80);
      floaty(tgt.x + 12, "x2", "#cc88ff");
      meleeStrike(player, tgt, false, wBase, fx, baseDmg * 0.7, playerLift);
    }
    if (fx.beamChance && Math.random() < fx.beamChance) {
      const beamCol = fx._vfxCols?.length ? fx._vfxCols[fx._vfxCols.length - 1] : wBase.col;
      slashWave(player, w.dmg * (fx.beamFrac || 0.8), beamCol);
    }
    if (fx.frenzyOnHit) {
      const now = performance.now() / 1000;
      const prev = player.frenzy;
      const chain = prev && now - prev.t < 2.2;
      const n = Math.min(5, chain ? (prev.n || 0) + 1 : 1);
      player.frenzy = { n, t: now, amt: fx.frenzyOnHit };
      if (n >= 3) {
        const col = fx._vfxCols?.length ? fx._vfxCols[fx._vfxCols.length - 1] : wBase.col;
        spawnParticles(player.x, groundY - 40 - playerLift, 3, col, 30, 45);
      }
    }
    finishRiposte(player, tgt.x);
  } else if (wBase.type === "ranged") {
    startArcherShoot(player);
    shootArrow(player.x, groundY - 30 - playerLift, tgt, player, player.weapon);
    const ar = state.arrows[state.arrows.length - 1];
    if (ar) {
      const arrowDmg = Math.max(1, w.dmg * playerMomentumDamageMultiplier() * riposteMult);
      ar.dmgMult = arrowDmg;
      ar.dmg = Math.round(arrowDmg);
      ar.playerShot = true;
      applyArrowUpgrades(ar, fx);
    }
    // Twin Strings / Split Nock: a second arrow streaks toward another enemy.
    if (fx.multishot && Math.random() < fx.multishot) {
      let second = null, sd = w.range + 120;
      for (const e of enemies) {
        if (e === tgt || e.fleeing || e.dying || e.hp <= 0) continue;
        const d = dist(player.x, e.x);
        if (d < sd) { sd = d; second = e; }
      }
      shootArrow(player.x, groundY - 34 - playerLift, second || tgt, player, player.weapon);
      const ar2 = state.arrows[state.arrows.length - 1];
      if (ar2 && ar2 !== ar) {
        const arrowDmg = Math.max(1, w.dmg * 0.8 * playerMomentumDamageMultiplier() * riposteMult);
        ar2.dmgMult = arrowDmg;
        ar2.dmg = Math.round(arrowDmg);
        ar2.playerShot = true;
        applyArrowUpgrades(ar2, fx);
        spawnParticles(player.x + (player.dir || 1) * 10, groundY - 34 - playerLift, 6, "#ffe9a0", 30, 50);
      }
    }
    // Echo Shot: a trailing copy of the arrow streaks in a beat later, free of cost.
    if (fx.echoShot && Math.random() < fx.echoShot) {
      shootArrow(player.x, groundY - 30 - playerLift, tgt, player, player.weapon);
      const ar3 = state.arrows[state.arrows.length - 1];
      if (ar3 && ar3 !== ar) {
        ar3.delay = (ar3.delay || 0) + 0.14;
        const echoDmg = Math.max(1, w.dmg * 0.55 * playerMomentumDamageMultiplier() * riposteMult);
        ar3.dmgMult = echoDmg;
        ar3.dmg = Math.round(echoDmg);
        ar3.playerShot = true;
        ar3.isEcho = true;
        applyArrowUpgrades(ar3, fx);
        spawnParticles(player.x, groundY - 30 - playerLift, 4, "#ffffff", 22, 36);
      }
    }
    finishRiposte(player, tgt.x);
  } else {
    player.castAnim = 0.55;
    castSpell(player, wBase, tgt);
    finishRiposte(player, tgt.x);
  }

  let cooldown = w.speed;
  if (wBase.spellType === "meteor") {
    cooldown *= fx.meteorDouble ? 3.4 : 2.5; // Double Up trades tempo for a second meteor
  }
  if (wBase.type === "melee" && player.frenzy && performance.now() / 1000 - player.frenzy.t < 2.2) {
    cooldown *= Math.max(0.4, 1 - player.frenzy.n * player.frenzy.amt);
  }
  if (wBase.type === "ranged" && fx.instantReload && Math.random() < fx.instantReload) {
    cooldown = 0.14;
    spawnParticles(player.x, groundY - 34 - playerLift, 5, "#ffb060", 28, 40);
  }
  if (wBase.type === "magic" && fx.freeCast && Math.random() < fx.freeCast) {
    cooldown = 0.1;
    floaty(player.x, "✨ Free cast", "#ffffff");
  }
  player.attackCd = cooldown * playerMomentumCooldownMultiplier();
}
