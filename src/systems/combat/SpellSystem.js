import { WEAPONS, effectiveWeapon } from '../../config/weapons.js?v=biomeweapons1';
import { mergeUpgradeEffects } from '../../config/weaponUpgrades.js?v=biomeweapons1';
import { CFG } from '../../config/config.js';
import { dist, rand, applyCrit } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnParticles, floaty, critFloaty, spawnGoldReward } from '../world/SpawnSystem.js?v=biomeboss1';
import { killEnemy, spawnImpBlood } from '../../util/EnemyUtils.js?v=biomeboss1';
import { ENEMY_TYPES } from '../../config/enemies.js?v=biomeboss1';
import { permanentDamageMultiplier } from '../infrastructure/RoguelikeSystem.js';
import { entityWallLift } from '../../entities/Wall.js';
import { playerMountLift } from '../economy/MountSystem.js';

function spellGravity(spellType) {
  return spellType === "meteor" ? 650 : spellType === "waterjet" ? 80 : 280;
}

function playerTomeCastOrigin(player, pulse = 0) {
  const dir = player.dir || 1;
  const lift = entityWallLift(player) + (player.jumpH || 0) + (player.bob || 0) + playerMountLift(player);
  return {
    x: player.x + dir * (18 + pulse * 8),
    y: groundY - 31 - pulse * 5 - lift,
  };
}

function targetImpactY(target) {
  const targetType = target?.type && ENEMY_TYPES[target.type];
  if (targetType?.flying) return groundY + (target.fy || -80);

  return groundY - 24 + (target?.fy || 0);
}

function playerMomentumDamageMultiplier() {
  const level = (Game.momentumTimer || 0) > 0 ? (Game.momentumLevel || 0) : 0;
  return 1 + level * 0.04;
}

function playerRiposteDamageMultiplier(player) {
  return (player?.riposteT || 0) > 0 ? (CFG.dodgeRiposteDamageMult || 1.6) : 1;
}

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

function payWeaponCastCost(player, fx, col) {
  const goldCost = Math.max(0, Math.round(fx.castGoldCost || 0));
  if (!goldCost) return true;
  if ((player.coins || 0) >= goldCost) {
    player.coins -= goldCost;
    floaty(player.x, "-" + goldCost + " coin", col, 12);
    return true;
  }
  const hpCost = Math.max(0, Math.round(fx.castHpCost || 0));
  if (hpCost && player.hp > hpCost) {
    player.hp -= hpCost;
    player.hurt = Math.max(player.hurt || 0, 0.25);
    player.hpShowTimer = Math.max(player.hpShowTimer || 0, 2.2);
    spawnParticles(player.x, groundY - 42, 10, col, 55, 85);
    floaty(player.x, "-" + hpCost + " hp", col, 12);
    return true;
  }
  floaty(player.x, "Needs coin or life", col, 12);
  return false;
}

// Spell damage against a bear (bears live in state.animals, not enemies).
function damageBear(a, dmg, col) {
  const crit = applyCrit(dmg, CFG.critChance, CFG.critMultiplier);
  a.hp -= crit.damage; a.flash = 0.14;
  spawnParticles(a.x, groundY - 30, 5, "#8a2a2a");
  if (crit.isCrit) critFloaty(a.x, crit.damage);
  else floaty(a.x, "-" + crit.damage, col);
  if (a.hp <= 0 && !a.dying) {
    a.dying = true; a.deathT = 0;
    spawnParticles(a.x, groundY - 20, 8, "#7a4a2a");
    const reward = spawnGoldReward(a.x, 8, "hunt", { spreadX: 15, fromY: groundY - 20, vx: 50, vyMin: 120, vyMax: 220 });
    if (reward > 0) floaty(a.x, "+" + reward + "🪙", "#f2c14e");
  }
  return crit.damage;
}

function dealAoE(x, dmg, radius, col) {
  for (const a of state.animals) {
    if (a.type === "bear" && a.alive && !a.dying && dist(a.x, x) < radius) {
      damageBear(a, dmg, col);
    }
  }
  for (const e of state.enemies) {
    if (!e.fleeing && !e.dying && dist(e.x, x) < radius) {
      const crit = applyCrit(dmg, CFG.critChance, CFG.critMultiplier);
      e.hp -= crit.damage; e.flash = 0.14;
      spawnImpBlood(e, 0.9 + crit.damage * 0.08);
      if (crit.isCrit) critFloaty(e.x, crit.damage);
      else floaty(e.x, "-" + crit.damage, col);
      if (e.hp <= 0) killEnemy(e);
    }
  }
  spawnParticles(x, groundY - 10, 14, col, 100, 90);
}

function projectileDir(sp) {
  const speed = Math.hypot(sp.vx || 0, sp.vy || 0) || 1;
  return { x: (sp.vx || 0) / speed, y: (sp.vy || 0) / speed };
}

function spawnWaterDroplet(x, y, color) {
  spawnParticles(x, y, 1, color, 1, 1);
  return state.particles[state.particles.length - 1] || null;
}

function spawnWaterSpray(x, y, n, dirX, dirY, intensity = 1) {
  const sideX = -dirY;
  const sideY = dirX;
  const colors = ["#4ab8e8", "#7fdcff", "#d8fbff"];
  for (let i = 0; i < n; i++) {
    const p = spawnWaterDroplet(x + rand(-3, 3), y + rand(-3, 3), colors[(Math.random() * colors.length) | 0]);
    if (!p) continue;
    const back = rand(26, 82) * intensity;
    const side = rand(-34, 34) * intensity;
    p.vx = -dirX * back + sideX * side + rand(-8, 8);
    p.vy = -dirY * back + sideY * side + rand(-8, 8);
    p.life = rand(0.22, 0.52);
    p.size = rand(1.1, 2.8);
  }
}

function spawnWaterBurst(x, y, n, dirX, dirY, intensity = 1) {
  const sideX = -dirY;
  const sideY = dirX;
  const colors = ["#2f9ed8", "#65d8ff", "#c8f7ff", "#ffffff"];
  for (let i = 0; i < n; i++) {
    const p = spawnWaterDroplet(x + rand(-5, 5), y + rand(-5, 5), colors[(Math.random() * colors.length) | 0]);
    if (!p) continue;
    const forward = rand(18, 94) * intensity;
    const side = rand(-110, 110) * intensity;
    p.vx = dirX * forward + sideX * side + rand(-18, 18);
    p.vy = dirY * forward + sideY * side - rand(28, 115) * intensity;
    p.life = rand(0.26, 0.7);
    p.size = rand(1.4, 3.7);
  }
}

function meteorCrashImpact(sp, x, y = groundY - 8) {
  const impactY = Math.min(y, groundY - 8);
  const icy = sp.iceMeteor;
  const crash = { ...sp, x };
  spellGroundImpact(crash);
  spellEnemyImpact({ ...sp, spellType: "meteor" }, x, impactY);
  spawnParticles(x, impactY, 34, icy ? "#bfefff" : "#ff8840", 180, 180);
  spawnParticles(x, impactY + 6, 26, icy ? "#7ab8d8" : "#3a2418", 210, 120);
  spawnParticles(x, groundY - 5, 20, icy ? "#4a7a9a" : "#1d1510", 240, 45);
  spawnParticles(x, groundY - 18, 12, icy ? "#ffffff" : "#ffd060", 150, 170);
  for (let k = -1; k <= 1; k += 2) {
    spawnParticles(x + k * 18, groundY - 6, 10, icy ? "#a8d8ee" : "#5b3a22", 190, 38);
    spawnParticles(x + k * 34, groundY - 4, 6, icy ? "#e8fbff" : "#ff6a20", 170, 30);
  }
  // an icy comet quenches instead of igniting the ground
  if (!icy) {
    spawnPlayerSpellPool(x, Math.max(24, (sp.aoeRadius || 70) * 0.45), 2.2, { dmg: 1, burnDmg: 1 });
  }
  if (sp.meteorFragments && !sp.isFragment) spawnMeteorFragments(sp, x, impactY);
  Game.screenShake = Math.max(Game.screenShake, 0.95);
}

function ensureSpellFields() {
  if (!state.spellFields) state.spellFields = [];
  return state.spellFields;
}

function spawnPlayerSpellPool(x, r, life, opts = {}) {
  if (!state.firePools) state.firePools = [];
  state.firePools.push({
    x, r, life, maxLife: life,
    tick: rand(0.28, 0.62), ph: rand(0, 6),
    source: "player",
    kind: opts.kind || null,
    pull: !!opts.pull,
    dmg: opts.dmg || 1,
    burnDmg: opts.burnDmg || 1,
    col: opts.col,
  });
}

function spellDamageEnemy(e, dmg, col, opts = {}) {
  if (!e || e.fleeing || e.dying || e.hp <= 0) return false;
  const amount = Math.max(1, Math.round(dmg));
  const y = opts.y ?? targetImpactY(e);
  e.hp -= amount;
  e.flash = Math.max(e.flash || 0, 0.12);
  if (opts.blood !== false) spawnImpBlood(e, 0.45 + amount * 0.05, y);
  if (opts.float !== false) floaty(e.x, "-" + amount, col);
  if (opts.particles !== false) spawnParticles(e.x, y, opts.particleCount || 5, col, opts.spread || 44, opts.life || 62);
  if (e.hp <= 0) killEnemy(e);
  return true;
}

function enemiesNearX(x, radius) {
  return state.enemies.filter(e => !e.fleeing && !e.dying && e.hp > 0 && dist(e.x, x) < radius);
}

function flareBurningEnemies(sp, x, y, radius) {
  const strength = sp.scorchChain || 0;
  if (!strength || sp.spellType !== "fireball") return;
  const r = Math.max(radius || 70, 70);
  const col = sp.upgradeCol || "#ffcc60";
  let flares = 0;
  for (const e of enemiesNearX(x, r)) {
    const alreadyBurning = (e.burn || 0) > 0 || e.ignited;
    if (!alreadyBurning && Math.random() > strength * 0.55) continue;
    e.burn = Math.max(e.burn || 0, 2.6 + strength);
    e.burnTick = Math.min(e.burnTick || 1, 0.35);
    e.burnDmg = Math.max(e.burnDmg || 0, 1 + Math.floor(strength * 2));
    e.ignited = true;
    if (alreadyBurning) spellDamageEnemy(e, sp.dmg * (0.22 + strength * 0.18), col, { particleCount: 8, spread: 64 });
    for (const ne of enemiesNearX(e.x, 115 + strength * 35)) {
      if (ne === e) continue;
      ne.burn = Math.max(ne.burn || 0, 1.8 + strength * 0.6);
      ne.burnTick = Math.min(ne.burnTick || 1, 0.55);
      ne.burnDmg = Math.max(ne.burnDmg || 0, 1);
      ne.ignited = true;
      if (Math.random() < 0.35) spawnParticles(ne.x, targetImpactY(ne), 3, col, 32, 48);
    }
    flares++;
  }
  if (flares > 0) {
    spawnParticles(x, y ?? groundY - 24, 12 + flares * 2, col, r * 0.8, 115);
    Game.screenShake = Math.max(Game.screenShake, 0.16 + Math.min(0.18, flares * 0.025));
  }
}

function eruptGeyser(sp, x, y, radius) {
  const strength = sp.geyser || 0;
  if (!strength || sp.spellType !== "waterjet") return;
  const r = Math.max(58, (radius || 55) * (0.75 + strength * 0.12));
  const dmg = Math.max(1, sp.dmg * (0.18 + strength * 0.14));
  const col = sp.upgradeCol || "#a0e8ff";
  let hit = 0;
  spawnParticles(x, groundY - 10, 18, "#4ab8e8", r * 0.75, 100);
  spawnParticles(x, groundY - 46, 12, "#d8fbff", r * 0.35, 150);
  for (const e of enemiesNearX(x, r)) {
    const et = ENEMY_TYPES[e.type] || {};
    spellDamageEnemy(e, dmg, col, { particleCount: 6, spread: 46 });
    e.frost = Math.max(e.frost || 0, 0.8 + strength * 0.45);
    e.rooted = Math.max(e.rooted || 0, Math.min(1.8, 0.35 + strength * 0.32));
    if (!et.noKnockback) e.knock = (e.knock || 0) + Math.sign(e.x - x || 1) * (90 + strength * 55);
    hit++;
  }
  if (hit > 0) {
    floaty(x, "Geyser x" + hit, col);
    Audio.hit();
    Game.screenShake = Math.max(Game.screenShake, 0.18 + Math.min(0.2, hit * 0.025));
  }
}

function spawnStormCloud(x, y, dmg, strength, col) {
  if (!strength) return;
  ensureSpellFields().push({
    type: "storm",
    x,
    y: Math.min(y - 118, groundY - 150),
    r: 130 + strength * 28,
    dmg: Math.max(1, dmg * (0.34 + strength * 0.06)),
    life: 1.8 + strength * 0.75,
    maxLife: 1.8 + strength * 0.75,
    tick: 0.22,
    ph: rand(0, 6),
    col: col || "#ffffff",
  });
}

function spawnRuneTrap(sp, x, y) {
  const strength = sp.runeTrap || 0;
  if (!strength || sp.isSplitOrb) return;
  const life = 1.1 + strength * 0.35;
  ensureSpellFields().push({
    type: "rune",
    x,
    y: Math.min(y ?? groundY - 10, groundY - 8),
    r: 58 + strength * 22,
    dmg: Math.max(1, sp.dmg * (0.32 + strength * 0.08)),
    life,
    maxLife: life,
    arm: 0.34,
    ph: rand(0, 6),
    col: sp.upgradeCol || "#ff88ff",
  });
}

function curseEnemies(sp, x, radius) {
  const strength = sp.shadowCurse || 0;
  if (!strength || sp.spellType !== "shadow") return;
  const r = Math.max(radius || 70, 70);
  const col = sp.upgradeCol || "#aa44cc";
  let marked = 0;
  for (const e of enemiesNearX(x, r)) {
    e.shadowCurse = Math.max(e.shadowCurse || 0, 2.3 + strength * 0.65);
    e.shadowCurseTick = Math.min(e.shadowCurseTick || 0.6, 0.45);
    e.shadowCurseDmg = Math.max(e.shadowCurseDmg || 0, sp.dmg * (0.12 + strength * 0.035));
    e.slow = Math.max(e.slow || 0, 0.55 + strength * 0.1);
    spawnParticles(e.x, targetImpactY(e), 5, col, 36, 58);
    marked++;
  }
  if (marked > 0) floaty(x, "Cursed x" + marked, col);
}

function spawnVoidScar(sp, x) {
  const strength = sp.voidScar || 0;
  if (!strength || sp.isSplitOrb) return;
  spawnPlayerSpellPool(x, Math.max(46, (sp.aoeRadius || 70) * (0.48 + strength * 0.08)), 2.4 + strength * 0.75, {
    kind: "void",
    pull: true,
    dmg: Math.max(1, Math.round(sp.dmg * (0.16 + strength * 0.04))),
    col: sp.upgradeCol || "#ddaaff",
  });
}

function spawnMeteorFragments(sp, x, y) {
  const n = Math.max(1, Math.min(5, Math.round(sp.meteorFragments || 0)));
  const icy = sp.iceMeteor;
  for (let i = 0; i < n; i++) {
    const off = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    const startX = x + off * rand(36, 76) + rand(-20, 20);
    state.spells.push({
      x: startX,
      y: groundY - rand(520, 760),
      vx: -off * rand(35, 90) + rand(-24, 24),
      vy: rand(430, 560),
      spellType: "meteor",
      dmg: Math.max(1, sp.dmg * 0.28),
      life: 1.75,
      col: icy ? "#bfefff" : sp.col,
      aoeRadius: Math.max(24, (sp.aoeRadius || 70) * 0.34),
      age: 0,
      isFragment: true,
      iceMeteor: icy,
      burnDps: sp.burnDps ? Math.max(1, sp.burnDps * 0.5) : 0,
      frostS: sp.frostS ? Math.max(0.7, sp.frostS * 0.55) : 0,
      upgradeCol: sp.upgradeCol,
      upgradeRank: sp.upgradeRank,
    });
  }
  spawnParticles(x, y ?? groundY - 20, 14, icy ? "#d8fbff" : "#ffd060", 95, 130);
}

function updateShadowCurses(dt) {
  for (const e of state.enemies) {
    if (!e.shadowCurse || e.dying || e.hp <= 0) continue;
    e.shadowCurse -= dt;
    e.shadowCurseTick = (e.shadowCurseTick || 0) - dt;
    const y = targetImpactY(e);
    if (Math.random() < dt * 7) spawnParticles(e.x + rand(-7, 7), y + rand(-8, 5), 1, "#440066", 22, 28);
    if (e.shadowCurseTick <= 0) {
      e.shadowCurseTick = 0.72;
      spellDamageEnemy(e, e.shadowCurseDmg || 1, "#aa44cc", { particleCount: 6, spread: 40 });
    }
    if (e.shadowCurse <= 0) {
      e.shadowCurse = 0;
      e.shadowCurseDmg = 0;
    }
  }
}

function detonateRuneField(f, idx) {
  let hit = 0;
  for (const e of enemiesNearX(f.x, f.r)) {
    spellDamageEnemy(e, f.dmg, f.col, { particleCount: 8, spread: 58 });
    hit++;
  }
  spawnParticles(f.x, groundY - 12, 22, f.col, f.r * 0.95, 125);
  spawnParticles(f.x, groundY - 20, 8, "#ffffff", f.r * 0.45, 130);
  state.legendaryEffects.push({ type: "ring", x: f.x, radius: f.r, life: 0.42, totalLife: 0.42, col: f.col, width: 5 });
  if (hit > 0) Audio.explosion();
  Game.screenShake = Math.max(Game.screenShake, hit ? 0.28 : 0.15);
  state.spellFields.splice(idx, 1);
}

function updateSpellFields(dt) {
  updateShadowCurses(dt);
  const fields = state.spellFields;
  if (!fields || !fields.length) return;
  for (let i = fields.length - 1; i >= 0; i--) {
    const f = fields[i];
    f.life -= dt;
    f.age = (f.age || 0) + dt;
    if (f.type === "storm") {
      if (Math.random() < dt * 12) spawnParticles(f.x + rand(-f.r * 0.55, f.r * 0.55), f.y + rand(-10, 8), 1, f.col, 18, 45);
      f.tick -= dt;
      if (f.tick <= 0) {
        f.tick = rand(0.42, 0.7);
        let target = null, td = f.r;
        for (const e of enemiesNearX(f.x, f.r)) {
          const d = Math.abs(e.x - f.x);
          if (d < td) { td = d; target = e; }
        }
        if (target) {
          const ey = targetImpactY(target);
          for (let yy = f.y; yy < ey; yy += 13) {
            spawnParticles(target.x + rand(-7, 7), yy, 1, "#ffffff", 5, 5);
            if (Math.random() < 0.35) spawnParticles(target.x + rand(-11, 11), yy, 1, f.col, 10, 8);
          }
          spellDamageEnemy(target, f.dmg, f.col, { y: ey, particleCount: 8, spread: 56 });
          chainLightning(target.x, f.dmg, 1);
          Audio.spell();
        }
      }
    } else if (f.type === "rune") {
      f.arm -= dt;
      if (Math.random() < dt * 10) spawnParticles(f.x + rand(-f.r * 0.35, f.r * 0.35), groundY - 8, 1, f.col, 10, 30);
      if (f.arm <= 0 && enemiesNearX(f.x, f.r * 0.88).length) {
        detonateRuneField(f, i);
        continue;
      }
    }
    if (f.life <= 0) {
      if (f.type === "rune") detonateRuneField(f, i);
      else fields.splice(i, 1);
    }
  }
}

// Upgrade riders carried by a spell, applied around an impact point:
// lingering burns, clinging chill, freezing comets, gravity wells, burning
// ground and fission orbs.
function applySpellField(sp, x, y) {
  const r = Math.max(sp.aoeRadius || 0, 60);
  const hasStatus = sp.burnDps || sp.frostS || sp.iceMeteor || sp.pull;
  if (hasStatus) {
    for (const e of state.enemies) {
      if (e.fleeing || e.dying || e.hp <= 0) continue;
      const d = dist(e.x, x);
      if (d > r) continue;
      if (sp.burnDps) {
        e.burn = Math.max(e.burn || 0, 3);
        e.burnTick = 1;
        e.burnDmg = Math.max(e.burnDmg || 0, sp.burnDps);
        e.ignited = true;
      }
      if (sp.frostS) {
        e.frost = Math.max(e.frost || 0, sp.frostS);
        if (Math.random() < 0.6) spawnParticles(e.x, groundY - 26, 3, "#bfefff", 30, 50);
      }
      if (sp.iceMeteor) {
        e.frost = Math.max(e.frost || 0, 4);
        e.rooted = Math.max(e.rooted || 0, 2);
        spawnParticles(e.x, groundY - 26, 6, "#bfefff", 40, 60);
      }
      if (sp.pull && d > 8 && !ENEMY_TYPES[e.type]?.noKnockback) {
        e.knock = (e.knock || 0) - Math.sign(e.x - x) * 280;
      }
    }
  }
  if (sp.pull) {
    spawnParticles(x, y ?? groundY - 20, 16, sp.col, r * 0.8, 90);
    Game.screenShake = Math.max(Game.screenShake, 0.25);
  }
  if (sp.firePool && !sp.iceMeteor) {
    spawnPlayerSpellPool(x, Math.max(30, r * 0.55), 3.5, { dmg: 1, burnDmg: Math.max(1, sp.burnDps || 1), col: sp.upgradeCol || sp.col });
  }
  flareBurningEnemies(sp, x, y, r);
  eruptGeyser(sp, x, y, r);
  spawnRuneTrap(sp, x, y);
  curseEnemies(sp, x, r);
  spawnVoidScar(sp, x);
  if (sp.split && !sp.isSplitOrb) spawnSplitOrbs(sp, x, y ?? groundY - 30);
}

// Arcane Fission / Oblivion: the impact bursts into smaller orbs that arc out
// and detonate where they land.
function spawnSplitOrbs(sp, x, y) {
  const n = sp.split;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1; // spread -1..1
    state.spells.push({
      x, y: Math.min(y, groundY - 30),
      vx: t * rand(150, 230) + rand(-30, 30),
      vy: -rand(200, 330),
      spellType: sp.spellType,
      dmg: Math.max(1, Math.round(sp.dmg * 0.4)),
      life: 1.5,
      col: sp.col,
      aoeRadius: Math.max(30, (sp.aoeRadius || 60) * 0.5),
      age: 0,
      isSplitOrb: true,
      upgradeCol: sp.upgradeCol,
      upgradeRank: sp.upgradeRank,
    });
  }
  spawnParticles(x, y, 12, sp.col, 60, 100);
}

export function chainLightning(x, dmg, bounces) {
  if (bounces <= 0) return;
  let nearest = null, nd = 250;
  for (const e of state.enemies) {
    const d = dist(e.x, x);
    if (!e.fleeing && d < nd && d > 10) { nd = d; nearest = e; }
  }
  if (!nearest) return;

  const enemyDrawY = targetImpactY(nearest);

  let curX = x;
  let curY = enemyDrawY;
  const steps = 6;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const baseTargetX = nearest.x;
    const baseTargetY = enemyDrawY;

    const bendY = (i === steps) ? 0 : rand(-15, 15);
    const nxtX = curX + (baseTargetX - x) / steps;
    const nxtY = (baseTargetY * t) + (enemyDrawY * (1 - t)) + bendY;

    const dSeg = Math.hypot(nxtX - curX, nxtY - curY);
    const pSteps = Math.ceil(dSeg / 5);
    for (let s = 0; s <= pSteps; s++) {
      const st = s / pSteps;
      const px = curX + (nxtX - curX) * st;
      const py = curY + (nxtY - curY) * st;
      spawnParticles(px, py, 1, "#ffffff", 6, 6);
      if (Math.random() < 0.3) spawnParticles(px, py, 1, "#ccccff", 12, 8);
    }
    curX = nxtX;
    curY = nxtY;
  }

  const baseDmg = Math.max(1, Math.floor(dmg * 0.6));
  const crit = applyCrit(baseDmg, CFG.critChance, CFG.critMultiplier);
  nearest.hp -= crit.damage;
  nearest.flash = 0.14;
  Audio.hit();
  spawnParticles(nearest.x, enemyDrawY, 10, "#ccccff", 60, 80);
  spawnImpBlood(nearest, 1 + crit.damage * 0.05, enemyDrawY);
  if (crit.isCrit) critFloaty(nearest.x, crit.damage);
  else floaty(nearest.x, "-" + crit.damage, "#ccccff");

  if (nearest.hp <= 0) {
    killEnemy(nearest);
  } else {
    chainLightning(nearest.x, dmg * 0.6, bounces - 1);
  }
}

export function castSpell(player, wBase, tgt) {
  const ew = effectiveWeapon(player.weapon, player.weaponUpgrades || []);
  const fx = mergeInnateEffects(wBase, player.weaponUpgrades || []);
  if (!payWeaponCastCost(player, fx, wBase.col)) return;
  const dmgMult = permanentDamageMultiplier() * playerMomentumDamageMultiplier() * playerRiposteDamageMultiplier(player);
  const aoeR = (wBase.aoeRadius || 0) + (ew.range - wBase.range) * 0.2 + (fx.aoeBonus || 0);
  const castOrigin = playerTomeCastOrigin(player);
  const upgradeCol = fx._vfxCols?.length ? fx._vfxCols[fx._vfxCols.length - 1] : null;
  const upgradeRank = fx._tierRank || 0;

  const tgtIsBear = tgt.type === "bear" && state.animals.includes(tgt);

  if (wBase.spellType === "lightning") {
    const enemyY = targetImpactY(tgt);
    if (tgtIsBear) {
      damageBear(tgt, ew.dmg * dmgMult, wBase.col);
      Audio.spell();
    } else {
      const crit = applyCrit(ew.dmg * dmgMult, CFG.critChance, CFG.critMultiplier);
      tgt.hp -= crit.damage;
      tgt.flash = 0.14;
      Audio.spell();
      spawnImpBlood(tgt, 1 + ew.dmg * 0.07, enemyY);
    }
    spellEnemyImpact({ spellType: "lightning" }, tgt.x, enemyY);

    let currentX = tgt.x + rand(-20, 20);
    let currentY = groundY - 1000;
    const segments = 20;

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const targetBaseX = tgt.x;
      const targetBaseY = enemyY;

      const bendX = (i === segments) ? 0 : rand(-35, 35);
      const nextX = (targetBaseX * t) + (currentX * (1 - t)) + bendX;
      const nextY = currentY + ((targetBaseY - (groundY - 1000)) / segments);

      const segDist = Math.hypot(nextX - currentX, nextY - currentY);
      const steps = Math.ceil(segDist / 6);
      for (let s = 0; s <= steps; s++) {
        const st = s / steps;
        const px = currentX + (nextX - currentX) * st;
        const py = currentY + (nextY - currentY) * st;
        spawnParticles(px, py, 1, "#ffffff", 5, 5);
        if (Math.random() < 0.4) spawnParticles(px, py, 1, "#ccccff", 12, 10);
      }
      currentX = nextX;
      currentY = nextY;
    }

    chainLightning(tgt.x, ew.dmg * dmgMult, 1 + (fx.chainBonus || 0));
    if (fx.stormCloud) {
      spawnStormCloud(tgt.x, enemyY, ew.dmg * dmgMult, fx.stormCloud, upgradeCol || wBase.col);
    }

    // Tempest: the sky answers twice — a second bolt hunts another enemy
    if (fx.extraBolt) {
      let second = null, sd = ew.range;
      for (const e of state.enemies) {
        if (e === tgt || e.fleeing || e.dying || e.hp <= 0) continue;
        const d = dist(player.x, e.x);
        if (d < sd) { sd = d; second = e; }
      }
      if (second) {
        const ey2 = targetImpactY(second);
        for (let yy = groundY - 700; yy < ey2; yy += 12) {
          spawnParticles(second.x + rand(-8, 8), yy, 1, "#ffffff", 5, 5);
          if (Math.random() < 0.35) spawnParticles(second.x + rand(-14, 14), yy, 1, "#ccccff", 10, 8);
        }
        const crit2 = applyCrit(ew.dmg * dmgMult * 0.8, CFG.critChance, CFG.critMultiplier);
        second.hp -= crit2.damage;
        second.flash = 0.14;
        spawnImpBlood(second, 1 + ew.dmg * 0.06, ey2);
        if (crit2.isCrit) critFloaty(second.x, crit2.damage);
        else floaty(second.x, "-" + crit2.damage, wBase.col);
        spellEnemyImpact({ spellType: "lightning" }, second.x, ey2);
        chainLightning(second.x, ew.dmg * dmgMult * 0.8, 1 + (fx.chainBonus || 0));
        if (second.hp <= 0) killEnemy(second);
      }
    }

    if (fx.spellEcho && Math.random() < fx.spellEcho) {
      const echoCol = fx._vfxCols?.length ? fx._vfxCols[fx._vfxCols.length - 1] : wBase.col;
      spawnParticles(tgt.x, enemyY, 12, echoCol, 58, 90);
      spawnParticles(tgt.x, enemyY, 5, "#ffffff", 30, 100);
      chainLightning(tgt.x, Math.max(1, ew.dmg * dmgMult * 0.7), 2 + (fx.chainBonus || 0));
    }

    if (!tgtIsBear && tgt.hp <= 0) killEnemy(tgt);

    castBurstFX(wBase, castOrigin.x, castOrigin.y, player.dir || 1, 0);
    Audio.spell();
    return;
  }

  let startX = castOrigin.x;
  let startY = castOrigin.y;
  let targetX = tgt.x;
  let targetY = targetImpactY(tgt);
  let spd = wBase.spellType === "waterjet" ? 480 : 330;
  let life = 2.2;
  let vx;
  let vy;

  if (wBase.spellType === "meteor") {
    const dir = Math.sign(tgt.x - player.x) || 1;
    startX = player.x - (250 * dir);
    startY = groundY - 1500;
    spd = 650;
    targetX = tgt.x + (210 * dir);
    targetY = groundY - 28;
    life = 4.0;
    const ang = Math.atan2(targetY - startY, targetX - startX);
    vx = Math.cos(ang) * spd;
    vy = Math.sin(ang) * spd;
  } else {
    const grav = spellGravity(wBase.spellType || "arcane");
    const dx = targetX - startX;
    const dy = targetY - startY;
    const flightTime = Math.max(0.12, Math.hypot(dx, dy) / spd);
    vx = dx / flightTime;
    vy = (dy - 0.5 * grav * flightTime * flightTime) / flightTime;
  }

  const spell = {
    x: startX,
    y: startY,
    vx,
    vy,
    spellType: wBase.spellType || "arcane",
    dmg: ew.dmg * dmgMult,
    life: life,
    col: wBase.col,
    aoeRadius: aoeR,
    age: 0,
    // upgrade riders resolved on impact
    burnDps: fx.spellBurn || 0,
    frostS: fx.spellFrost || 0,
    firePool: !!fx.firePool,
    split: fx.splitOrbs || 0,
    pull: !!fx.singularity,
    iceMeteor: !!fx.meteorIce && wBase.spellType === "meteor",
    scorchChain: fx.scorchChain || 0,
    geyser: fx.geyser || 0,
    runeTrap: fx.runeTrap || 0,
    shadowCurse: fx.shadowCurse || 0,
    voidScar: fx.voidScar || 0,
    meteorFragments: fx.meteorFragments || 0,
    upgradeCol,
    upgradeRank,
  };
  state.spells.push(spell);

  if (fx.spellEcho && Math.random() < fx.spellEcho) {
    const dir = Math.sign(tgt.x - player.x) || player.dir || 1;
    const echo = {
      ...spell,
      x: startX - dir * 18,
      y: startY - 8,
      vx: vx * 0.9 + rand(-38, 38),
      vy: vy * 0.88 - 70,
      dmg: Math.max(1, spell.dmg * 0.55),
      life: life + 0.25,
      aoeRadius: Math.max(24, aoeR * 0.65),
      scorchChain: spell.scorchChain * 0.65,
      geyser: spell.geyser * 0.65,
      runeTrap: spell.runeTrap * 0.55,
      shadowCurse: spell.shadowCurse * 0.65,
      voidScar: spell.voidScar * 0.55,
      meteorFragments: Math.floor(spell.meteorFragments * 0.5),
      isEcho: true,
    };
    state.spells.push(echo);
    spawnParticles(castOrigin.x, castOrigin.y, 8, upgradeCol || wBase.col, 42, 75);
  }

  // Double Up: a twin meteor trails the first, landing a beat behind it
  if (wBase.spellType === "meteor" && fx.meteorDouble) {
    const dir = Math.sign(tgt.x - player.x) || 1;
    state.spells.push({ ...spell, x: startX - 90 * dir, y: startY - 140, life: life + 0.4 });
  }

  {
    const d = projectileDir({ vx, vy });
    castBurstFX(wBase, castOrigin.x, castOrigin.y, d.x, d.y);
  }
  Audio.spell();
}

export function updateSpells(dt) {
  updateSpellFields(dt);
  if (!state.spells || !state.spells.length) return;
  const { spells, enemies } = state;
  for (let i = spells.length - 1; i >= 0; i--) {
    const sp = spells[i];
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    sp.age = (sp.age || 0) + dt;
    const grav = spellGravity(sp.spellType);
    sp.vy += grav * dt;
    sp.life -= dt;

    spellTrail(sp);

    const hitGround = sp.y > groundY - 8;
    if (sp.life <= 0 || hitGround) {
      if (sp.aoeRadius > 0 && hitGround) {
        if (sp.spellType === "meteor") meteorCrashImpact(sp, sp.x, groundY - 8);
        else spellGroundImpact(sp);
        dealAoE(sp.x, sp.dmg, sp.aoeRadius, sp.col);
        applySpellField(sp, sp.x, groundY - 20);
        Audio.explosion();
      }
      spells.splice(i, 1);
      continue;
    }
    let hit = false;
    for (const e of enemies) {
      if (e.fleeing) continue;
      const et = ENEMY_TYPES[e.type];
      const ey = targetImpactY(e);
      if (dist(sp.x, e.x) < et.w * 0.75 && Math.abs(sp.y - ey) < 44) {
        e.hp -= sp.dmg; e.flash = 0.14; Audio.hit();
        if (sp.spellType === "meteor") {
          meteorCrashImpact(sp, e.x, ey);
          if (sp.aoeRadius > 0) {
            dealAoE(e.x, sp.dmg, sp.aoeRadius, sp.col);
            Audio.explosion();
          }
        } else {
          spellEnemyImpact(sp, e.x, ey);
        }
        spawnImpBlood(e, 1 + sp.dmg * 0.08, ey);
        if (!et.noKnockback) e.knock = (e.knock || 0) + Math.sign(e.x - sp.vx) * 140;
        applySpellField(sp, e.x, ey);
        if (e.hp <= 0 && !e.dying) killEnemy(e);
        else if (sp.aoeRadius > 0 && sp.spellType !== "meteor") dealAoE(sp.x, Math.max(1, Math.floor(sp.dmg * 0.65)), sp.aoeRadius, sp.col);
        if (sp.spellType === "lightning") chainLightning(sp.x, sp.dmg, 1);
        hit = true; break;
      }
    }
    if (!hit) {
      for (const a of state.animals) {
        if (a.type !== "bear" || !a.alive || a.dying) continue;
        const ay = groundY + (a.fy || 0) - 34;
        if (dist(sp.x, a.x) < 40 && Math.abs(sp.y - ay) < 56) {
          Audio.hit();
          if (sp.spellType === "meteor") {
            meteorCrashImpact(sp, a.x, ay);
            if (sp.aoeRadius > 0) { dealAoE(a.x, sp.dmg, sp.aoeRadius, sp.col); Audio.explosion(); }
          } else {
            spellEnemyImpact(sp, a.x, ay);
            damageBear(a, sp.dmg, sp.col);
            if (sp.aoeRadius > 0) dealAoE(sp.x, Math.max(1, Math.floor(sp.dmg * 0.65)), sp.aoeRadius, sp.col);
          }
          applySpellField(sp, a.x, ay);
          hit = true; break;
        }
      }
    }
    if (hit) spells.splice(i, 1);
  }
}

function spellTrail(sp) {
  if (sp.upgradeCol && Math.random() < (sp.upgradeRank >= 3 ? 0.85 : 0.55)) {
    spawnParticles(sp.x, sp.y, 1, sp.upgradeCol, 14 + (sp.upgradeRank || 1) * 4, 14);
  }
  switch (sp.spellType) {
    case "fireball":
      if (Math.random() < 0.7) spawnParticles(sp.x, sp.y, 1, "#ff6a20", 12, 10);
      if (Math.random() < 0.3) spawnParticles(sp.x, sp.y, 1, "#ffcc60", 6, 14);
      if (Math.random() < 0.25) spawnParticles(sp.x, sp.y, 1, "#3a3a44", 8, 22); // smoke wisp
      break;
    case "meteor":
      if (sp.iceMeteor) {
        // frozen comet: crystalline shards and a misty vapor tail
        spawnParticles(sp.x, sp.y, 2, "#bfefff", 18, 14);
        if (Math.random() < 0.5) spawnParticles(sp.x, sp.y, 1, "#7ab8d8", 22, 10);
        if (Math.random() < 0.4) spawnParticles(sp.x, sp.y, 1, "#ffffff", 14, 20);
        break;
      }
      spawnParticles(sp.x, sp.y, 2, "#ff7730", 18, 14);
      if (Math.random() < 0.5) spawnParticles(sp.x, sp.y, 1, "#554432", 22, 10);
      if (Math.random() < 0.45) spawnParticles(sp.x, sp.y, 1, "#2a2a30", 18, 24); // smoke column
      if (Math.random() < 0.3) spawnParticles(sp.x, sp.y, 1, "#ffd060", 12, 18);  // shed embers
      break;
    case "waterjet":
      {
        const d = projectileDir(sp);
        if (Math.random() < 0.8) spawnWaterSpray(sp.x - d.x * 12, sp.y - d.y * 12, 2, d.x, d.y, 0.75);
        if (Math.random() < 0.3) spawnWaterSpray(sp.x - d.x * 22, sp.y - d.y * 22, 1, d.x, d.y, 1.0);
      }
      break;
    case "arcane":
      if (Math.random() < 0.6) spawnParticles(sp.x, sp.y, 1, "#cc44ff", 16, 14);
      if (Math.random() < 0.3) spawnParticles(sp.x, sp.y, 1, "#ff88ff", 8, 18);
      if (Math.random() < 0.2) spawnParticles(sp.x, sp.y, 1, "#ffffff", 6, 20);   // glittering motes
      break;
    case "shadow":
      if (Math.random() < 0.6) spawnParticles(sp.x, sp.y, 1, "#660099", 12, 8);
      if (Math.random() < 0.3) spawnParticles(sp.x, sp.y, 1, "#aa44cc", 8, 12);
      if (Math.random() < 0.25) spawnParticles(sp.x, sp.y, 1, "#110018", 14, 6);  // inky residue
      break;
    case "void":
      if (Math.random() < 0.7) spawnParticles(sp.x, sp.y, 1, "#9922ff", 14, 12);
      if (Math.random() < 0.4) spawnParticles(sp.x, sp.y, 1, "#550088", 20, 8);
      if (Math.random() < 0.2) spawnParticles(sp.x, sp.y, 1, "#ffffff", 8, 16);   // star flecks
      break;
  }
}

// Burst of magic at the caster's hands, flavored per school.
function castBurstFX(wBase, x, y, dirX = 1, dirY = 0) {
  spawnParticles(x, y, 10, wBase.col, 50, 70);
  switch (wBase.spellType) {
    case "fireball":  spawnParticles(x, y, 5, "#ffcc60", 35, 60); break;
    case "waterjet":  spawnWaterBurst(x, y, 8, dirX, dirY, 0.55); break;
    case "lightning": spawnParticles(x, y, 6, "#ffffff", 40, 85); break;
    case "meteor":
      spawnParticles(x, y, 6, "#ffd060", 40, 70);
      Game.screenShake = Math.max(Game.screenShake, 0.12);
      break;
    case "arcane":    spawnParticles(x, y, 5, "#ff88ff", 35, 65); break;
    case "shadow":    spawnParticles(x, y, 5, "#440066", 35, 45); break;
    case "void":
      spawnParticles(x, y, 6, "#ddaaff", 40, 70);
      spawnParticles(x, y, 3, "#ffffff", 25, 80);
      break;
  }
}

function spellEnemyImpact(sp, x, y) {
  switch (sp.spellType) {
    case "fireball":
      spawnParticles(x, y, 14, "#ff6a20", 80, 100);
      spawnParticles(x, y, 8, "#ffcc60", 50, 80);
      spawnParticles(x, y, 4, "#ff2200", 60, 60);
      Game.screenShake = Math.max(Game.screenShake, 0.18);
      break;
    case "meteor":
      spawnParticles(x, y, 18, "#ff8840", 100, 120);
      spawnParticles(x, y, 10, "#554432", 70, 80);
      spawnParticles(x, y, 6, "#ffcc60", 60, 100);
      Game.screenShake = Math.max(Game.screenShake, 0.4);
      break;
    case "waterjet":
      {
        const d = projectileDir(sp);
        spawnWaterBurst(x, y, 22, d.x, d.y, 1.0);
        spawnParticles(x, y, 8, "#d8fbff", 42, 80);
      }
      break;
    case "lightning":
      spawnParticles(x, y, 14, "#ccccff", 80, 110);
      spawnParticles(x, y, 8, "#ffffff", 40, 130);
      Game.screenShake = Math.max(Game.screenShake, 0.28);
      break;
    case "arcane":
      spawnParticles(x, y, 16, "#cc44ff", 90, 120);
      spawnParticles(x, y, 8, "#ff88ff", 50, 100);
      spawnParticles(x, y, 5, "#ffffff", 30, 80);
      Game.screenShake = Math.max(Game.screenShake, 0.32);
      break;
    case "shadow":
      spawnParticles(x, y, 14, "#aa44cc", 70, 90);
      spawnParticles(x, y, 8, "#440066", 50, 60);
      spawnParticles(x, y, 5, "#ff88ff", 30, 80);
      Game.screenShake = Math.max(Game.screenShake, 0.3);
      break;
    case "void":
      spawnParticles(x, y, 20, "#9922ff", 100, 140);
      spawnParticles(x, y, 12, "#ddaaff", 60, 120);
      spawnParticles(x, y, 8, "#550088", 80, 80);
      Game.screenShake = Math.max(Game.screenShake, 0.5);
      break;
    default:
      spawnParticles(x, y, 8, sp.col, 70, 90);
      break;
  }
}

function spellGroundImpact(sp) {
  switch (sp.spellType) {
    case "fireball":
      spawnParticles(sp.x, groundY - 8, 16, "#ff6a20", 90, 100);
      spawnParticles(sp.x, groundY - 8, 8, "#ffcc40", 60, 80);
      break;
    case "meteor":
      spawnParticles(sp.x, groundY - 8, 28, "#ff8840", 130, 140);
      spawnParticles(sp.x, groundY - 8, 16, "#554432", 100, 100);
      spawnParticles(sp.x, groundY - 8, 10, "#ffcc60", 80, 120);
      Game.screenShake = Math.max(Game.screenShake, 0.65);
      break;
    case "waterjet":
      {
        const d = projectileDir(sp);
        spawnWaterBurst(sp.x, groundY - 8, 28, d.x, Math.min(d.y, -0.15), 1.05);
        spawnParticles(sp.x, groundY - 8, 10, "#d8fbff", 95, 75);
      }
      break;
    case "arcane":
      spawnParticles(sp.x, groundY - 8, 20, "#cc44ff", 100, 130);
      spawnParticles(sp.x, groundY - 8, 10, "#ff88ff", 60, 100);
      Game.screenShake = Math.max(Game.screenShake, 0.35);
      break;
    case "shadow":
      spawnParticles(sp.x, groundY - 8, 18, "#aa44cc", 90, 100);
      spawnParticles(sp.x, groundY - 8, 10, "#220033", 60, 70);
      Game.screenShake = Math.max(Game.screenShake, 0.3);
      break;
    case "void":
      spawnParticles(sp.x, groundY - 8, 30, "#9922ff", 120, 160);
      spawnParticles(sp.x, groundY - 8, 18, "#ddaaff", 80, 140);
      spawnParticles(sp.x, groundY - 8, 12, "#ffffff", 50, 120);
      Game.screenShake = Math.max(Game.screenShake, 0.7);
      break;
  }
}
