import { WEAPONS, effectiveWeapon } from '../../config/weapons.js?v=biomeweapons1';
import { mergeUpgradeEffects } from '../../config/weaponUpgrades.js?v=biomeweapons1';
import { CFG } from '../../config/config.js';
import { dist, rand, applyCrit } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnParticles, floaty, critFloaty, spawnGoldReward } from '../world/SpawnSystem.js?v=biomeactive4';
import { killEnemy, spawnImpBlood } from '../../util/EnemyUtils.js?v=biomeactive4';
import { ENEMY_TYPES } from '../../config/enemies.js?v=biomeactive4';
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

// Soul Siphon: a chance for a direct spell hit to draw back a sliver of life.
function trySoulSiphon(player, chance, col) {
  if (!chance || !player || player.hp <= 0 || player.hp >= player.maxHp) return;
  if (Math.random() >= chance) return;
  player.hp = Math.min(player.maxHp, player.hp + 1);
  player.hpShowTimer = Math.max(player.hpShowTimer || 0, 2);
  spawnParticles(player.x, groundY - 40, 6, col || "#ff6a8a", 40, 70);
  floaty(player.x, "+1❤", "#ff9ab0");
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
  updateArcanumStatuses(dt);
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
    } else if (f.type === "expandring") {
      f.r += (f.maxR / f.maxLife) * dt;
      const band = 24;
      for (const e of enemiesNearX(f.x, f.r + band)) {
        if (f.hit.has(e)) continue;
        if (Math.abs(e.x - f.x) < f.r - band) continue; // hasn't reached it yet
        f.hit.add(e);
        spellDamageEnemy(e, f.dmg, f.col, { particleCount: 7, spread: 44 });
        const et = ENEMY_TYPES[e.type] || {};
        if (!et.noKnockback) e.knock = (e.knock || 0) + Math.sign(e.x - f.x || 1) * 150;
      }
      if (Math.random() < dt * 24) {
        const a = Math.random() < 0.5 ? -1 : 1;
        spawnParticles(f.x + a * f.r, groundY - 8, 1, f.col, 16, 34);
      }
    } else if (f.type === "bramble") {
      f.sprout = Math.min(1, (f.sprout || 0) + dt * 3.5);
      if (Math.random() < dt * 7) spawnParticles(f.x + rand(-f.r, f.r) * 0.8, groundY - rand(2, 20), 1, "#4f7a2a", 12, 32);
      f.lashT -= dt;
      if (f.lashT <= 0 && f.sprout >= 1) {
        f.lashT = 0.55;
        let lashed = 0;
        for (const e of enemiesNearX(f.x, f.r)) {
          spellDamageEnemy(e, f.dmg, f.col, { particleCount: 6, spread: 42 });
          e.slow = Math.max(e.slow || 0, 0.55 + f.slow);
          if (f.root && Math.random() < f.root) e.rooted = Math.max(e.rooted || 0, 1.2);
          lashed++;
        }
        if (lashed) {
          if (f.siphon) trySoulSiphon(state.player, f.siphon, f.col);
          spawnParticles(f.x, groundY - 28, 6 + lashed * 2, "#9bd05a", f.r * 0.7, 95);
          Audio.hit();
        }
      }
    } else if (f.type === "spore") {
      f.x += (f.drift || 0) * dt;
      f.y = Math.min(f.y - 5 * dt, groundY - 34);
      if (Math.random() < dt * 16) spawnParticles(f.x + rand(-f.r, f.r) * 0.75, f.y + rand(-22, 26), 1, "#7fbf3a", 14, 34);
      f.tick -= dt;
      if (f.tick <= 0) {
        f.tick = 0.75;
        for (const e of enemiesNearX(f.x, f.r)) {
          spellDamageEnemy(e, f.dmg, f.col, { particleCount: 4, spread: 30, float: false });
          infectEnemy(e, f);
        }
      }
    } else if (f.type === "well") {
      // haul everything inside the horizon toward the core
      for (const e of enemiesNearX(f.x, f.r * 1.15)) {
        if (ENEMY_TYPES[e.type]?.noKnockback) continue;
        e.x += Math.sign(f.x - e.x || 1) * Math.min(150 * f.pull * dt, Math.abs(f.x - e.x) * 0.12);
        if (f.root) e.rooted = Math.max(e.rooted || 0, 0.25);
        else e.slow = Math.max(e.slow || 0, 0.45);
      }
      if (Math.random() < dt * 30) {
        const a = rand(0, Math.PI * 2), rr = f.r * rand(0.5, 1.1);
        spawnParticles(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * 0.5, 1, f.col, 10, 40);
      }
      f.tick -= dt;
      if (f.tick <= 0) {
        f.tick = 0.32;
        for (const e of enemiesNearX(f.x, f.r)) spellDamageEnemy(e, f.dmg, f.col, { particleCount: 3, spread: 26, float: false });
      }
    } else if (f.type === "leech") {
      const h = f.host;
      if (!h || h.fleeing || h.dying || h.hp <= 0) {
        const next = f.jumps > 0 ? nearestEnemyTo(f.x, 240, h) : null;
        if (next) {
          f.jumps--;
          f.host = next;
          f.life = Math.min(f.maxLife, f.life + 1.2);
          spawnParticles((f.x + next.x) / 2, targetImpactY(next), 10, "#c0102a", 60, 70);
          floaty(next.x, "Leapt", f.col, 11);
        } else {
          f.life = 0;
        }
      } else {
        f.x = h.x;
        f.y = targetImpactY(h) - 6;
        if (Math.random() < dt * 11) spawnParticles(f.x + rand(-7, 7), f.y + rand(-7, 7), 1, "#c0102a", 14, 26);
        f.tick -= dt;
        if (f.tick <= 0) {
          f.tick = 0.55;
          spellDamageEnemy(h, f.dmg, f.col, { y: f.y, particleCount: 5, spread: 34 });
          if (f.heal) trySoulSiphon(state.player, f.heal, f.col);
        }
      }
    }
    if (f.life <= 0) {
      if (f.type === "rune") detonateRuneField(f, i);
      else if (f.type === "well") {
        implodeGravityWell(f);
        // Dying Star: the collapse comes twice
        if (f.repeat) { f.repeat = false; f.crush *= 0.6; f.life = f.maxLife = 0.55; f.tick = 0.32; }
        else fields.splice(i, 1);
      } else fields.splice(i, 1);
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
      palette: sp.palette,
      core: sp.core,
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

// ---------- Procedural spell recipe system (generated staffs) ----------
// Everything below is reached only via wBase.spellRecipe (set exclusively by
// ProceduralWeaponSystem.js). Curated weapons never touch this code.

function paletteCols(sp) {
  return sp.palette || [sp.col];
}

// Per-flourish extra trail texture — audio for the cast itself lives in
// Audio.spellFlourish, called once from castProceduralSpell.
function flourishTrailFX(sp) {
  const cols = paletteCols(sp);
  switch (sp.flourish) {
    case "haze":
      if (Math.random() < 0.5) spawnParticles(sp.x + rand(-4, 4), sp.y + rand(-4, 4), 1, cols[cols.length - 1], 10, 34);
      break;
    case "heartbeat": {
      const pulse = (Math.sin((sp.age || 0) * 6) + 1) / 2;
      if (pulse > 0.82 && Math.random() < 0.6) spawnParticles(sp.x, sp.y, 2, cols[0], 16 + pulse * 12, 22);
      break;
    }
    case "sparks":
      if (Math.random() < 0.55) spawnParticles(sp.x + rand(-3, 3), sp.y + rand(-3, 3), 1, "#ffffff", 18, 10);
      break;
    case "motes": {
      const a = (sp.age || 0) * 6.5;
      spawnParticles(sp.x + Math.cos(a) * 7, sp.y + Math.sin(a) * 7, 1, cols[1] || cols[0], 6, 18);
      break;
    }
    // "hum" is a pure audio flourish — no extra particles.
  }
}

function paletteSpellTrail(sp) {
  const cols = paletteCols(sp);
  if (Math.random() < 0.7) spawnParticles(sp.x, sp.y, 1, cols[0], 13, 12);
  if (Math.random() < 0.32) spawnParticles(sp.x, sp.y, 1, cols[1] || cols[0], 8, 16);
  if (Math.random() < 0.18) spawnParticles(sp.x, sp.y, 1, sp.core || "#ffffff", 6, 20);
  flourishTrailFX(sp);
}

function paletteSpellImpact(sp, x, y) {
  const cols = paletteCols(sp);
  spawnParticles(x, y, 16, cols[0], 90, 110);
  spawnParticles(x, y, 8, cols[1] || cols[0], 55, 90);
  spawnParticles(x, y, 5, sp.core || "#ffffff", 35, 100);
  Game.screenShake = Math.max(Game.screenShake, 0.28);
}

function paletteGroundImpact(sp) {
  const cols = paletteCols(sp);
  spawnParticles(sp.x, groundY - 8, 20, cols[0], 100, 120);
  spawnParticles(sp.x, groundY - 8, 10, cols[1] || cols[0], 65, 100);
  Game.screenShake = Math.max(Game.screenShake, 0.36);
}

// Per-frame position update for a recipe spell: applies its Travel behavior
// (and, for the Orbiting Darts form, a decaying spiral wobble) on top of a
// flat gravity arc.
function applyProceduralMotion(sp, dt) {
  let boost = 1;
  if (sp.behavior === "accel") boost = 1 + Math.min(1.8, (sp.age || 0) * 1.1);
  sp.x += sp.vx * dt * boost;
  sp.y += sp.vy * dt * boost;
  sp.vy += 260 * dt;

  if (sp.behavior === "sine") {
    const lateral = Math.cos((sp.age || 0) * 10) * 320;
    sp.x += -(sp.dirY || 0) * lateral * dt;
    sp.y += (sp.dirX || 0) * lateral * dt;
  } else if (sp.behavior === "boomerang") {
    if (!sp.boomeranged && (sp.age || 0) > (sp.totalLife || sp.life) * 0.42) {
      sp.vx *= -1.15; sp.vy *= -1.15;
      sp.boomeranged = true;
      spawnParticles(sp.x, sp.y, 10, sp.col, 40, 60);
    }
  } else if (sp.behavior === "blink") {
    sp.blinkTimer = (sp.blinkTimer ?? 0) - dt;
    if (sp.blinkTimer <= 0) {
      sp.blinkTimer = 0.11;
      sp.x += (sp.dirX || 0) * 70;
      sp.y += (sp.dirY || 0) * 70;
      spawnParticles(sp.x, sp.y, 6, sp.col, 30, 40);
    }
  }

  if (sp.form === "darts") {
    const amp = Math.max(0, 1 - (sp.age || 0) / (sp.totalLife || sp.life)) * 260;
    const wobble = Math.sin((sp.age || 0) * 14 + (sp.dartPhase || 0)) * amp;
    sp.x += -(sp.dirY || 0) * wobble * dt;
    sp.y += (sp.dirX || 0) * wobble * dt;
  }
}

function genericChainJump(x, dmg, col, bounces, exclude = null) {
  if (bounces <= 0) return;
  let nearest = null, nd = 260;
  for (const e of state.enemies) {
    if (e === exclude || e.fleeing || e.dying || e.hp <= 0) continue;
    const d = dist(e.x, x);
    if (d < nd && d > 6) { nd = d; nearest = e; }
  }
  if (!nearest) return;
  const y = targetImpactY(nearest);
  spawnParticles((x + nearest.x) / 2, y, 10, col, 70, 80);
  spawnParticles(nearest.x, y, 6, "#ffffff", 40, 60);
  spellDamageEnemy(nearest, dmg, col, { particleCount: 8, spread: 55 });
  if (nearest.hp > 0) genericChainJump(nearest.x, dmg * 0.7, col, bounces - 1, nearest);
}

function genericShockwave(x, r, col, dmg) {
  let hit = 0;
  for (const e of enemiesNearX(x, r)) {
    const et = ENEMY_TYPES[e.type] || {};
    if (!et.noKnockback) e.knock = (e.knock || 0) + Math.sign(e.x - x || 1) * 260;
    spellDamageEnemy(e, Math.max(1, dmg * 0.3), col, { particleCount: 5, spread: 40 });
    hit++;
  }
  spawnParticles(x, groundY - 14, 16, col, r * 0.7, 100);
  state.legendaryEffects.push({ type: "ring", x, radius: r, life: 0.4, totalLife: 0.4, col, width: 5 });
  if (hit) Audio.hit();
  Game.screenShake = Math.max(Game.screenShake, hit ? 0.3 : 0.16);
}

function spawnExpandingRing(sp, x, y) {
  const maxR = Math.max(90, (sp.aoeRadius || 70) * 2.2);
  const life = 0.75;
  ensureSpellFields().push({
    type: "expandring",
    x, y: Math.min(y, groundY - 10),
    r: 0, maxR, life, maxLife: life,
    dmg: Math.max(1, Math.round(sp.dmg * 0.8)),
    col: paletteCols(sp)[0],
    hit: new Set(),
  });
  spawnParticles(x, Math.min(y, groundY - 10), 14, paletteCols(sp)[0], 40, 90);
}

// What happens when a recipe spell lands (its Impact axis). Ring-form spells
// bypass this entirely — their "impact" IS the expanding ring.
function triggerProceduralImpact(sp, x, y) {
  const r = Math.max(sp.aoeRadius || 60, 50);
  const col = paletteCols(sp)[0];
  switch (sp.impact) {
    case "shrapnel": {
      const n = 3 + (sp.upgradeRank >= 3 ? 2 : 0);
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
        state.spells.push({
          x, y: Math.min(y, groundY - 30),
          vx: t * rand(150, 230) + rand(-30, 30), vy: -rand(180, 300),
          spellType: sp.spellType, dmg: Math.max(1, Math.round(sp.dmg * 0.35)),
          life: 1.1, col, palette: sp.palette, core: sp.core,
          aoeRadius: Math.max(24, r * 0.35), age: 0, isFragment: true,
        });
      }
      spawnParticles(x, y, 14, col, 70, 100);
      break;
    }
    case "gravity":
      spawnPlayerSpellPool(x, Math.max(46, r * 0.55), 2.6, { kind: "void", pull: true, dmg: Math.max(1, Math.round(sp.dmg * 0.2)), col });
      Game.screenShake = Math.max(Game.screenShake, 0.28);
      break;
    case "puddle":
      spawnPlayerSpellPool(x, Math.max(40, r * 0.5), 3.4, { kind: "acid", dmg: 1, burnDmg: 1, col });
      break;
    case "chain":
      genericChainJump(x, Math.max(1, sp.dmg * 0.6), col, 2);
      break;
    case "shockwave":
      genericShockwave(x, r, col, sp.dmg);
      break;
  }
}

function findBounceTarget(sp, exclude) {
  let best = null, bd = 260;
  for (const e of state.enemies) {
    if (e === exclude || e.fleeing || e.dying || e.hp <= 0) continue;
    if (sp._hitEnemies && sp._hitEnemies.has(e)) continue;
    const d = dist(e.x, sp.x);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// Resolves a recipe spell striking an enemy. Returns true if the spell
// should be removed (most forms), false to keep it flying (Bouncing Orb).
function resolveProceduralEnemyHit(sp, e, ey, et) {
  const dmg = Math.max(1, Math.round(sp.dmg));
  e.hp -= dmg; e.flash = 0.14; Audio.hit();
  spawnImpBlood(e, 1 + dmg * 0.08, ey);
  if (!et.noKnockback) e.knock = (e.knock || 0) + Math.sign(e.x - sp.x || 1) * 140;
  if (sp.soulSiphon) trySoulSiphon(state.player, sp.soulSiphon, sp.upgradeCol || paletteCols(sp)[0]);
  spellEnemyImpact(sp, e.x, ey);
  applySpellField(sp, e.x, ey);
  if (e.hp <= 0 && !e.dying) killEnemy(e);

  if (sp.form === "orb" && sp.bounceLeft > 0) {
    if (!sp._hitEnemies) sp._hitEnemies = new Set();
    sp._hitEnemies.add(e);
    const next = findBounceTarget(sp, e);
    if (next) {
      sp.bounceLeft--;
      const nEy = targetImpactY(next);
      const ang = Math.atan2(nEy - sp.y, next.x - sp.x);
      const speed = Math.max(220, Math.hypot(sp.vx, sp.vy));
      sp.vx = Math.cos(ang) * speed;
      sp.vy = Math.sin(ang) * speed;
      sp.dirX = Math.cos(ang); sp.dirY = Math.sin(ang);
      sp.dmg = Math.max(1, sp.dmg * 0.8);
      return false;
    }
  }

  if (sp.form === "ring") spawnExpandingRing(sp, e.x, ey);
  else triggerProceduralImpact(sp, e.x, ey);
  return true;
}

// Piercing Beam form resolves instantly — no traveling projectile at all.
function resolveBeamCast(player, wBase, tgt, fx, baseDmg, aoeR, castOrigin, palette, core, upgradeCol, upgradeRank, recipe) {
  const dir = Math.sign(tgt.x - player.x) || player.dir || 1;
  const range = Math.max(220, wBase.range || 320);
  const beamY = targetImpactY(tgt);
  const startX = castOrigin.x, endX = castOrigin.x + dir * range;
  const lo = Math.min(startX, endX), hi = Math.max(startX, endX);
  for (let i = 0; i <= 16; i++) {
    const p = i / 16;
    const px = startX + (endX - startX) * p, py = castOrigin.y + (beamY - castOrigin.y) * p;
    spawnParticles(px, py, 1, palette[0], 8, 10);
    if (Math.random() < 0.4) spawnParticles(px, py, 1, core, 6, 14);
  }
  const riderSp = {
    spellType: wBase.spellType, col: palette[0], palette, core, aoeRadius: aoeR,
    burnDps: fx.spellBurn || 0, frostS: fx.spellFrost || 0, firePool: !!fx.firePool,
    pull: !!fx.singularity, scorchChain: fx.scorchChain || 0, geyser: fx.geyser || 0,
    runeTrap: fx.runeTrap || 0, shadowCurse: fx.shadowCurse || 0, voidScar: fx.voidScar || 0,
    dmg: baseDmg, upgradeCol, upgradeRank,
  };
  let hits = 0;
  for (const e of state.enemies) {
    if (e.fleeing || e.dying || e.hp <= 0) continue;
    if (e.x < lo || e.x > hi) continue;
    const ey = targetImpactY(e);
    const dmg = Math.max(1, Math.round(baseDmg * (hits === 0 ? 1 : 0.7)));
    spellDamageEnemy(e, dmg, palette[0], { y: ey, particleCount: 8, spread: 55 });
    applySpellField(riderSp, e.x, ey);
    if (fx.soulSiphon) trySoulSiphon(player, fx.soulSiphon, upgradeCol || palette[0]);
    hits++;
  }
  if (hits > 0) {
    Game.screenShake = Math.max(Game.screenShake, 0.3);
    Audio.hit();
    triggerProceduralImpact({ dmg: baseDmg, aoeRadius: aoeR, impact: recipe.impact, palette, core, upgradeRank }, endX, beamY);
  }
  spawnParticles(endX, beamY, 14, palette[0], 60, 90);
}

function castProceduralSpell(player, wBase, tgt, fx, ctx) {
  const { ew, dmgMult, aoeR, castOrigin, upgradeCol, upgradeRank } = ctx;
  const recipe = wBase.spellRecipe;
  const palette = wBase.spellPalette || [wBase.col];
  const core = wBase.spellCore || "#ffffff";
  const baseDmg = ew.dmg * dmgMult;
  const targetY = targetImpactY(tgt);

  Audio.spell();
  Audio.spellFlourish(recipe.flourish, wBase.spellPitch || 500);
  castBurstFX(wBase, castOrigin.x, castOrigin.y, player.dir || 1, 0);

  if (recipe.form === "beam") {
    resolveBeamCast(player, wBase, tgt, fx, baseDmg, aoeR, castOrigin, palette, core, upgradeCol, upgradeRank, recipe);
    return;
  }

  const spd = 360;
  const dx = tgt.x - castOrigin.x, dy = targetY - castOrigin.y;
  const dirLen = Math.hypot(dx, dy) || 1;
  const dirX = dx / dirLen, dirY = dy / dirLen;
  const flightTime = Math.max(0.12, dirLen / spd);
  const vx = dx / flightTime, vy = (dy - 0.5 * 260 * flightTime * flightTime) / flightTime;

  const baseSpell = {
    spellType: wBase.spellType, col: wBase.col, palette, core,
    aoeRadius: aoeR, age: 0,
    form: recipe.form, behavior: recipe.behavior, impact: recipe.impact, flourish: recipe.flourish,
    soulSiphon: fx.soulSiphon || 0,
    // Same upgrade riders the legacy path honors (spellBurn, spellFrost,
    // firePool, singularity, splitOrbs, scorchChain, geyser, runeTrap,
    // shadowCurse, voidScar) — applied via applySpellField on every hit so
    // themed unique upgrades stay meaningful on a recipe-driven staff too.
    burnDps: fx.spellBurn || 0,
    frostS: fx.spellFrost || 0,
    firePool: !!fx.firePool,
    split: fx.splitOrbs || 0,
    pull: !!fx.singularity,
    scorchChain: fx.scorchChain || 0,
    geyser: fx.geyser || 0,
    runeTrap: fx.runeTrap || 0,
    shadowCurse: fx.shadowCurse || 0,
    voidScar: fx.voidScar || 0,
    upgradeCol, upgradeRank,
  };

  if (recipe.form === "darts") {
    const speed = Math.hypot(vx, vy);
    const baseAng = Math.atan2(vy, vx);
    for (let i = 0; i < 3; i++) {
      const ang = baseAng + (i - 1) * 0.3;
      state.spells.push({
        ...baseSpell,
        x: castOrigin.x, y: castOrigin.y,
        vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
        dirX: Math.cos(ang), dirY: Math.sin(ang),
        dmg: Math.max(1, baseDmg * 0.45),
        life: flightTime + 0.6,
        totalLife: flightTime + 0.6,
        dartPhase: i * 2.4,
      });
    }
    return;
  }

  const spell = {
    ...baseSpell,
    x: castOrigin.x, y: castOrigin.y, vx, vy, dirX, dirY,
    dmg: baseDmg,
    life: flightTime + 0.7,
    totalLife: flightTime + 0.7,
    bounceLeft: recipe.form === "orb" ? (2 + (upgradeRank >= 3 ? 2 : upgradeRank >= 2 ? 1 : 0)) : 0,
  };
  state.spells.push(spell);
}

// ---------- Arcanum staffs: hand-built casting schools ----------
// Six curated staffs whose projectiles behave nothing like the shared
// ballistic path: a seeding thorn pod, a refracting crystal shard, a
// contagion flask, an anchored gravity well, a clinging blood leech and a
// travelling bell wave. castArcanumSpell spawns them, updateArcanumSpell
// drives them per frame. Every impact still funnels through applySpellField,
// so the generic magic upgrades (burn, frost, rune traps, split orbs…) keep
// working on them exactly as they do on the older staffs.

const ARCANUM_SPELLS = new Set([
  "bramble", "prism", "refract", "spore", "gravitywell", "leech", "resonance",
  "fracture", "gale", "bastion", "larva",
]);

function nearestEnemyTo(x, maxD = 300, exclude = null) {
  let best = null, bd = maxD;
  for (const e of state.enemies) {
    if (e === exclude || e.fleeing || e.dying || e.hp <= 0) continue;
    const d = dist(e.x, x);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// What a flying arcanum projectile is touching right now: an enemy, a bear,
// or nothing. `exclude` lets piercing rays skip what they already bit.
function arcanumContact(sp, exclude = null, yTol = 44, wScale = 0.75) {
  for (const e of state.enemies) {
    if (e.fleeing || e.dying || e.hp <= 0) continue;
    if (exclude && exclude.has(e)) continue;
    const et = ENEMY_TYPES[e.type] || {};
    const ey = targetImpactY(e);
    if (dist(sp.x, e.x) < (et.w || 22) * wScale && Math.abs(sp.y - ey) < yTol) return { e, ey, et };
  }
  for (const a of state.animals) {
    if (a.type !== "bear" || !a.alive || a.dying) continue;
    const ay = groundY + (a.fy || 0) - 34;
    if (dist(sp.x, a.x) < 40 && Math.abs(sp.y - ay) < 56) return { bear: a, ey: ay };
  }
  return null;
}

// Shared "this projectile just landed on something" resolution.
function arcanumStrike(sp, hit, dmg, col, opts = {}) {
  const x = hit.e ? hit.e.x : hit.bear.x;
  const y = hit.ey;
  if (hit.bear) {
    damageBear(hit.bear, dmg, col);
  } else {
    spellDamageEnemy(hit.e, dmg, col, { y, particleCount: opts.particles ?? 8, spread: opts.spread ?? 52 });
    const knock = opts.knock ?? 120;
    if (knock && !(hit.et || {}).noKnockback) hit.e.knock = (hit.e.knock || 0) + Math.sign(hit.e.x - sp.x || 1) * knock;
  }
  if (sp.soulSiphon) trySoulSiphon(state.player, sp.soulSiphon, sp.upgradeCol || col);
  spellEnemyImpact(sp, x, y);
  applySpellField(sp, x, y);
  Audio.hit();
  return { x, y };
}

function ballisticVelocity(fromX, fromY, toX, toY, speed, grav) {
  const dx = toX - fromX, dy = toY - fromY;
  const flight = Math.max(0.12, Math.hypot(dx, dy) / speed);
  return { vx: dx / flight, vy: (dy - 0.5 * grav * flight * flight) / flight, flight };
}

// ----- Thornroot Stave: a seed pod that sprouts lashing thorn thickets -----

function spawnBramblePatch(sp, x, opts = {}) {
  const life = (opts.life ?? 3.4) + (sp.brambleLife || 0);
  ensureSpellFields().push({
    type: "bramble",
    x,
    r: opts.r ?? Math.max(46, sp.aoeRadius || 58),
    dmg: Math.max(1, sp.dmg * (opts.dmgFrac ?? 0.42) * (1 + (sp.brambleLash || 0))),
    root: sp.brambleRoot || 0,
    slow: sp.slowHit || 0,
    siphon: sp.soulSiphon || 0,
    col: sp.upgradeCol || "#7fc24a",
    life, maxLife: life,
    lashT: 0.3,
    sprout: 0,
    ph: rand(0, 6),
  });
  spawnParticles(x, groundY - 12, opts.burst ?? 14, "#4f7a2a", 70, 90);
  spawnParticles(x, groundY - 22, Math.round((opts.burst ?? 14) * 0.5), "#9bd05a", 55, 120);
}

function updateBramblePod(sp, dt) {
  sp.x += sp.vx * dt;
  sp.y += sp.vy * dt;
  sp.vy += 340 * dt;
  sp.spin = (sp.spin || 0) + dt * 7;
  // seedlings drop out of the pod as it flies and take root behind it
  if (sp.seeds > 0) {
    sp.seedT = (sp.seedT || 0) - dt;
    if (sp.seedT <= 0) {
      sp.seedT = 0.15;
      sp.seeds--;
      spawnBramblePatch(sp, sp.x, { r: 34, life: 2, dmgFrac: 0.2, burst: 5 });
    }
  }
  const hit = arcanumContact(sp);
  const grounded = sp.y > groundY - 10;
  if (hit || grounded || sp.life <= 0) {
    const x = hit ? arcanumStrike(sp, hit, sp.dmg, "#9bd05a", { knock: 90 }).x : sp.x;
    if (!hit) { spellGroundImpact(sp); applySpellField(sp, x, groundY - 20); }
    spawnBramblePatch(sp, x);
    if (sp.brambleTwin) spawnBramblePatch(sp, x + (sp.vx >= 0 ? 1 : -1) * 95, { r: 42, dmgFrac: 0.32 });
    Audio.explosion();
    return true;
  }
  return false;
}

// ----- Prism Spire: a shard that splinters into piercing rays -----

function spawnRefractRay(sp, x, y, ang, dmg, canSplit) {
  const spd = 660;
  state.spells.push({
    x, y,
    vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
    spellType: "refract", arcanum: true,
    dmg: Math.max(1, dmg),
    life: 0.42, age: 0,
    col: "#d8f8ff",
    aoeRadius: 0,
    canSplit,
    _hit: new Set(),
    burnDps: sp.burnDps, frostS: sp.frostS, firePool: sp.firePool,
    pull: sp.pull, runeTrap: sp.runeTrap, voidScar: sp.voidScar,
    soulSiphon: sp.soulSiphon,
    upgradeCol: sp.upgradeCol, upgradeRank: sp.upgradeRank,
  });
}

function refractShard(sp, x, y) {
  const n = Math.max(2, 3 + (sp.refractRays || 0));
  const base = Math.atan2(sp.vy, sp.vx);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    spawnRefractRay(sp, x, y, base + t * 1.45, sp.dmg * 0.45, !!sp.refractSplit);
  }
  state.legendaryEffects.push({ type: "ring", x, radius: 46, life: 0.3, totalLife: 0.3, col: "#d8f8ff", width: 3 });
  spawnParticles(x, y, 16, "#8fe8ff", 95, 115);
  spawnParticles(x, y, 8, "#ffffff", 55, 130);
  Audio.spell();
}

function updatePrismShard(sp, dt) {
  sp.x += sp.vx * dt;
  sp.y += sp.vy * dt;
  sp.vy += 110 * dt;
  sp.spin = (sp.spin || 0) + dt * 9;
  const hit = arcanumContact(sp);
  if (hit) {
    const at = arcanumStrike(sp, hit, sp.dmg, "#d8f8ff", { knock: 70 });
    refractShard(sp, at.x, at.y);
    return true;
  }
  if (sp.y > groundY - 8 || sp.life <= 0) {
    spellGroundImpact(sp);
    refractShard(sp, sp.x, Math.min(sp.y, groundY - 16));
    return true;
  }
  return false;
}

function updateRefractRay(sp, dt) {
  sp.x += sp.vx * dt;
  sp.y += sp.vy * dt;
  if (!sp._hit) sp._hit = new Set();
  const hit = arcanumContact(sp, sp._hit, 38, 0.85);
  if (hit) {
    if (hit.e) sp._hit.add(hit.e);
    arcanumStrike(sp, hit, sp.dmg, "#d8f8ff", { knock: 40, particles: 6, spread: 38 });
    // Kaleidoscope: the ray bends again the moment it bites
    if (sp.canSplit && !sp.hasSplit) {
      sp.hasSplit = true;
      const ang = Math.atan2(sp.vy, sp.vx);
      spawnRefractRay(sp, sp.x, sp.y, ang - 0.55, sp.dmg * 0.6, false);
      spawnRefractRay(sp, sp.x, sp.y, ang + 0.55, sp.dmg * 0.6, false);
    }
  }
  if (sp.y > groundY - 6) {
    spawnParticles(sp.x, groundY - 8, 6, "#d8f8ff", 45, 70);
    return true;
  }
  return sp.life <= 0;
}

// ----- Miasma Censer: a spore flask that seeds a spreading contagion -----

function burstSporeCloud(sp, x, y, scale = 1) {
  const life = (3.8 + (sp.sporeLife || 0)) * scale;
  ensureSpellFields().push({
    type: "spore",
    x, y: Math.min(y, groundY - 34),
    r: Math.max(44, (sp.aoeRadius || 74) * scale),
    dmg: Math.max(1, sp.dmg * 0.3),
    plagueDmg: 1 + (sp.plagueDmg || 0),
    slow: sp.sporeSlow || 0,
    spread: sp.sporeSpread || 0,
    bloom: !!sp.sporeBloom,
    col: sp.upgradeCol || "#a8d84a",
    life, maxLife: life,
    tick: 0.3,
    drift: rand(-9, 9),
    ph: rand(0, 6),
  });
  spawnParticles(x, y, Math.round(22 * scale), "#7fbf3a", 90, 110);
  spawnParticles(x, y, Math.round(12 * scale), "#c8e070", 60, 130);
  Audio.explosion();
  Game.screenShake = Math.max(Game.screenShake, 0.2 * scale);
}

function infectEnemy(e, f) {
  e.poison = Math.max(e.poison || 0, 3.6);
  e.poisonTick = Math.min(e.poisonTick || 1, 0.5);
  e.poisonDmg = Math.max(e.poisonDmg || 0, f.plagueDmg || 1);
  e.plague = Math.max(e.plague || 0, 4.5);
  e.plagueDmg = f.plagueDmg || 1;
  e.plagueSpread = Math.max(e.plagueSpread || 0, f.spread || 0);
  e.plagueBloom = e.plagueBloom || !!f.bloom;
  e.plagueR = Math.max(e.plagueR || 0, (f.r || 60) * 0.55);
  e.plagueCol = f.col;
  if (f.slow) e.slow = Math.max(e.slow || 0, f.slow);
}

function updateSporeFlask(sp, dt) {
  sp.x += sp.vx * dt;
  sp.y += sp.vy * dt;
  sp.vy += 460 * dt;
  sp.spin = (sp.spin || 0) + dt * 8;
  const hit = arcanumContact(sp);
  const grounded = sp.y > groundY - 10;
  if (hit || grounded || sp.life <= 0) {
    const at = hit ? arcanumStrike(sp, hit, sp.dmg, "#a8d84a", { knock: 70 }) : { x: sp.x, y: groundY - 30 };
    if (!hit) { spellGroundImpact(sp); applySpellField(sp, sp.x, groundY - 20); }
    burstSporeCloud(sp, at.x, at.y);
    return true;
  }
  return false;
}

// Contagion between bodies, plus the burst a plagued corpse leaves behind.
function updatePlagueContagion(dt) {
  for (const e of state.enemies) {
    if (!(e.plague > 0)) continue;
    if (e.dying || e.hp <= 0) {
      if (e.plagueBloom && !e.plagueBloomed) {
        e.plagueBloomed = true;
        burstSporeCloud({
          aoeRadius: e.plagueR || 50, dmg: (e.plagueDmg || 1) * 2,
          sporeSpread: e.plagueSpread || 0, sporeBloom: true,
          plagueDmg: (e.plagueDmg || 1) - 1, upgradeCol: e.plagueCol,
        }, e.x, targetImpactY(e), 0.62);
      }
      e.plague = 0;
      continue;
    }
    e.plague -= dt;
    if (Math.random() < dt * 6) spawnParticles(e.x + rand(-8, 8), targetImpactY(e) + rand(-12, 6), 1, "#7fbf3a", 14, 26);
    if (e.plagueSpread > 0) {
      e.plagueSpreadT = (e.plagueSpreadT || rand(0.4, 1.1)) - dt;
      if (e.plagueSpreadT <= 0) {
        e.plagueSpreadT = 1.1;
        for (const ne of enemiesNearX(e.x, 95)) {
          if (ne === e || ne.plague > 0) continue;
          if (Math.random() > e.plagueSpread) continue;
          infectEnemy(ne, { plagueDmg: e.plagueDmg, spread: e.plagueSpread, bloom: e.plagueBloom, r: e.plagueR, col: e.plagueCol });
          spawnParticles((e.x + ne.x) / 2, targetImpactY(ne), 7, "#a8d84a", 40, 60);
          floaty(ne.x, "Infected", e.plagueCol || "#a8d84a", 11);
          break; // the plague only jumps to one neighbour per tick
        }
      }
    }
    if (e.plague <= 0) e.plague = 0;
  }
}

// ----- Nullstone Scepter: a core that anchors, hauls the wave in, implodes -----

function anchorGravityWell(sp, x, y) {
  const life = 1.35 + (sp.wellDuration || 0);
  ensureSpellFields().push({
    type: "well",
    x, y: Math.min(y, groundY - 26),
    r: Math.max(70, sp.aoeRadius || 96),
    dmg: Math.max(1, sp.dmg * 0.22),
    crush: sp.dmg * (1.5 + (sp.wellCrush || 0)),
    pull: 1 + (sp.wellPull || 0),
    root: !!sp.wellRoot,
    repeat: !!sp.wellRepeat,
    rider: sp,
    col: sp.upgradeCol || "#c8a0ff",
    life, maxLife: life,
    tick: 0.32,
    ph: rand(0, 6),
  });
  spawnParticles(x, y, 18, "#7a3aff", 70, 90);
  spawnParticles(x, y, 8, "#c8a0ff", 40, 120);
  Audio.spell();
  Game.screenShake = Math.max(Game.screenShake, 0.22);
}

function implodeGravityWell(f) {
  const dmg = Math.max(1, f.crush);
  let hit = 0;
  for (const e of enemiesNearX(f.x, f.r)) {
    const et = ENEMY_TYPES[e.type] || {};
    spellDamageEnemy(e, dmg, f.col, { particleCount: 10, spread: 72 });
    if (!et.noKnockback) e.knock = (e.knock || 0) + Math.sign(e.x - f.x || 1) * 320;
    hit++;
  }
  if (f.rider) applySpellField(f.rider, f.x, f.y);
  state.legendaryEffects.push({ type: "ring", x: f.x, radius: f.r, life: 0.45, totalLife: 0.45, col: f.col, width: 6 });
  spawnParticles(f.x, f.y, 26, "#7a3aff", 135, 145);
  spawnParticles(f.x, f.y, 14, "#ffffff", 85, 165);
  spawnParticles(f.x, groundY - 8, 16, "#3a1a5a", 120, 60);
  if (hit) { floaty(f.x, "Collapse x" + hit, f.col); Audio.explosion(); }
  Game.screenShake = Math.max(Game.screenShake, 0.55);
}

function updateNullstoneCore(sp, dt) {
  sp.x += sp.vx * dt;
  sp.y += sp.vy * dt;
  sp.travel = (sp.travel || 0) + Math.hypot(sp.vx, sp.vy) * dt;
  const hit = arcanumContact(sp);
  if (hit || sp.travel >= sp.reach || sp.y > groundY - 14 || sp.life <= 0) {
    const at = hit ? arcanumStrike(sp, hit, sp.dmg * 0.5, "#c8a0ff", { knock: 0, particles: 6 }) : { x: sp.x, y: sp.y };
    anchorGravityWell(sp, at.x, Math.min(at.y, groundY - 26));
    return true;
  }
  return false;
}

// ----- Sanguine Rod: a homing leech that clings on and drains -----

function attachLeech(sp, host) {
  const life = 3 + (sp.leechLife || 0);
  ensureSpellFields().push({
    type: "leech",
    host,
    x: host.x, y: targetImpactY(host) - 6,
    r: 0,
    dmg: Math.max(1, sp.dmg * (0.32 + (sp.leechDmg || 0))),
    heal: sp.leechHeal || 0,
    jumps: sp.leechJumps || 0,
    col: sp.upgradeCol || "#ff5060",
    life, maxLife: life,
    tick: 0.5,
    ph: rand(0, 6),
  });
  spawnParticles(host.x, targetImpactY(host), 12, "#c0102a", 55, 70);
  floaty(host.x, "Latched", "#ff8a90", 11);
}

function updateLeechOrb(sp, dt) {
  // steer toward whatever is closest — the leech wants a host, not a lane
  const tgt = nearestEnemyTo(sp.x, 460);
  if (tgt) {
    const want = Math.atan2(targetImpactY(tgt) - sp.y, tgt.x - sp.x);
    const cur = Math.atan2(sp.vy, sp.vx);
    let d = want - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const spd = Math.hypot(sp.vx, sp.vy) || 320;
    const a = cur + Math.sign(d) * Math.min(Math.abs(d), 6 * dt);
    sp.vx = Math.cos(a) * spd;
    sp.vy = Math.sin(a) * spd;
  } else {
    sp.vy += 150 * dt;
  }
  sp.x += sp.vx * dt;
  sp.y += sp.vy * dt;
  const hit = arcanumContact(sp);
  if (hit) {
    arcanumStrike(sp, hit, sp.dmg, "#ff5060", { knock: 60 });
    if (hit.e && !hit.e.dying && hit.e.hp > 0) attachLeech(sp, hit.e);
    return true;
  }
  if (sp.y > groundY - 8 || sp.life <= 0) {
    spawnParticles(sp.x, Math.min(sp.y, groundY - 8), 10, "#7a0a1a", 55, 60);
    return true;
  }
  return false;
}

// ----- Choirbell Staff: a struck note that rolls through the lane -----

function shatterResonance(sp, e, depth = 0) {
  const ey = targetImpactY(e);
  e.resonance = 0;
  e.resonanceT = 0;
  const dmg = Math.max(2, sp.dmg * 1.9);
  spellDamageEnemy(e, dmg, "#ffffff", { y: ey, particleCount: 16, spread: 95 });
  state.legendaryEffects.push({ type: "ring", x: e.x, radius: 92, life: 0.38, totalLife: 0.38, col: "#e8f8ff", width: 4 });
  spawnParticles(e.x, ey, 18, "#e8f8ff", 110, 120);
  floaty(e.x, "Shatter!", "#ffffff", 14);
  Audio.explosion();
  Game.screenShake = Math.max(Game.screenShake, 0.34);
  for (const ne of enemiesNearX(e.x, 92)) {
    if (ne === e) continue;
    const net = ENEMY_TYPES[ne.type] || {};
    spellDamageEnemy(ne, Math.max(1, sp.dmg * 0.5), "#e8f8ff", { particleCount: 5, spread: 40 });
    if (!net.noKnockback) ne.knock = (ne.knock || 0) + Math.sign(ne.x - e.x || 1) * 210 * (sp.force || 1);
    // Carillon of Ruin: the note carries into everything still standing
    if (sp.chorus && depth < 2) addResonance(sp, ne, 1, depth + 1);
  }
}

function addResonance(sp, e, n = 1, depth = 0) {
  if (!e || e.dying || e.hp <= 0 || e.fleeing) return;
  e.resonance = (e.resonance || 0) + n;
  e.resonanceT = 3.5;
  spawnParticles(e.x, targetImpactY(e) - 14, 2 + e.resonance * 2, "#e8f8ff", 26, 46);
  if (e.resonance >= (sp.needed || 3)) shatterResonance(sp, e, depth);
  else floaty(e.x, "♪".repeat(e.resonance), "#a8d8ff", 11);
}

function updateResonanceWave(sp, dt) {
  sp.x += sp.vx * dt;
  sp.travel = (sp.travel || 0) + Math.abs(sp.vx) * dt;
  if (!sp._hit) sp._hit = new Set();
  for (const e of state.enemies) {
    if (e.fleeing || e.dying || e.hp <= 0 || sp._hit.has(e)) continue;
    const et = ENEMY_TYPES[e.type] || {};
    if (Math.abs(e.x - sp.x) > (et.w || 22) * 0.7 + 12) continue;
    sp._hit.add(e);
    // sound doesn't care how high a thing flies — every body in the column rings
    const ey = targetImpactY(e);
    arcanumStrike(sp, { e, ey, et }, sp.dmg, "#e8f8ff", { knock: 95 * (sp.force || 1), particles: 7 });
    addResonance(sp, e, 1);
  }
  if (Math.random() < dt * 20) spawnParticles(sp.x + rand(-6, 6), groundY - rand(20, 96), 1, "#e8f8ff", 18, 34);
  if (sp.travel >= sp.reach || sp.life <= 0) {
    // Echo Chamber: the note rebounds and sweeps back the way it came
    if (sp.echo && !sp.echoed) {
      sp.echoed = true;
      sp.vx *= -1;
      sp.travel = 0;
      sp.life = Math.max(sp.life, 1.5);
      sp._hit = new Set();
      spawnParticles(sp.x, groundY - 60, 16, "#e8f8ff", 70, 100);
      Audio.spell();
      return false;
    }
    spawnParticles(sp.x, groundY - 55, 10, "#a8d8ff", 55, 80);
    return true;
  }
  return false;
}

function updateResonanceDecay(dt) {
  for (const e of state.enemies) {
    if (!(e.resonanceT > 0)) continue;
    e.resonanceT -= dt;
    if (e.resonanceT <= 0) { e.resonance = 0; e.resonanceT = 0; }
    else if (Math.random() < dt * 3) spawnParticles(e.x + rand(-9, 9), targetImpactY(e) - 16, 1, "#a8d8ff", 12, 26);
  }
}

// ----- The Rupture Shard: chaotic bolts that pick their own victims -----
// The shard never aims. Every bolt is flung at a body chosen at random, and
// each impact folds space inward — so the more of the horde is on screen, the
// more reliably the chaos both connects and herds the wave into a clump.

function randomLiveEnemy(x, maxD, exclude = null) {
  const pool = [];
  for (const e of state.enemies) {
    if (e === exclude || e.fleeing || e.dying || e.hp <= 0) continue;
    if (dist(e.x, x) > maxD) continue;
    pool.push(e);
  }
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

// The micro-shockwave every blast leaves behind: neighbours slide toward the
// point of impact. This is the whole reason to keep the screen full.
function quantumRupture(sp, x, y) {
  const strength = 1 + (sp.rupturePull || 0);
  const r = Math.max(70, sp.aoeRadius || 56) * (1 + (sp.rupturePull || 0) * 0.3);
  const col = sp.upgradeCol || "#c46bff";
  let caught = 0;
  for (const e of enemiesNearX(x, r)) {
    if (ENEMY_TYPES[e.type]?.noKnockback) continue;
    const dx = x - e.x;
    if (Math.abs(dx) < 5) continue;
    e.x += Math.sign(dx) * Math.min(Math.abs(dx) * 0.38 * strength, 72 * strength);
    e.slow = Math.max(e.slow || 0, 0.3);
    caught++;
  }
  state.legendaryEffects.push({ type: "ring", x, radius: r, life: 0.26, totalLife: 0.26, col, width: 2 + strength });
  spawnParticles(x, y, 10 + caught * 2, "#c46bff", r * 0.7, 105);
  spawnParticles(x, y, 5, "#ffffff", 32, 135);
  if (caught >= 2) floaty(x, "Fracture x" + caught, "#e0a0ff", 12);
}

function spawnRuptureRift(sp, x, y) {
  const life = 0.85 + (sp.rift || 0) * 0.4;
  ensureSpellFields().push({
    type: "rift",
    x, y: Math.min(y, groundY - 28),
    r: Math.max(58, (sp.aoeRadius || 56) * 0.95),
    dmg: Math.max(1, sp.dmg * 0.4),
    burst: Math.max(2, sp.dmg * (1 + (sp.rift || 0) * 0.55)),
    pull: 1 + (sp.rupturePull || 0),
    col: sp.upgradeCol || "#c46bff",
    life, maxLife: life,
    tick: 0.24,
    ph: rand(0, 6),
  });
  spawnParticles(x, y, 12, "#7a2aff", 62, 95);
}

function burstRuptureRift(f) {
  for (const e of enemiesNearX(f.x, f.r)) {
    spellDamageEnemy(e, f.burst, f.col, { particleCount: 9, spread: 66 });
    if (!ENEMY_TYPES[e.type]?.noKnockback) e.knock = (e.knock || 0) + Math.sign(e.x - f.x || 1) * 240;
  }
  state.legendaryEffects.push({ type: "ring", x: f.x, radius: f.r * 1.15, life: 0.34, totalLife: 0.34, col: f.col, width: 5 });
  spawnParticles(f.x, f.y, 22, "#c46bff", 120, 135);
  spawnParticles(f.x, f.y, 10, "#ffffff", 70, 160);
  Audio.explosion();
  Game.screenShake = Math.max(Game.screenShake, 0.32);
}

function splinterFracture(sp, x, y) {
  for (let i = 0; i < 2; i++) {
    const ang = rand(0, Math.PI * 2);
    state.spells.push({
      ...sp,
      x, y,
      vx: Math.cos(ang) * 470, vy: Math.sin(ang) * 470,
      dmg: Math.max(1, sp.dmg * 0.5),
      mark: randomLiveEnemy(x, 560, sp.mark),
      life: 1.1,
      cascade: 0, splinter: false, rift: 0,
      _hit: new Set(),
    });
  }
  spawnParticles(x, y, 12, "#ff7ad8", 72, 125);
}

function updateFractureBolt(sp, dt) {
  const mark = sp.mark && !sp.mark.dying && !sp.mark.fleeing && sp.mark.hp > 0 ? sp.mark : null;
  sp.mark = mark || randomLiveEnemy(sp.x, 620);
  const spd = Math.hypot(sp.vx, sp.vy) || 520;
  if (sp.mark) {
    // it steers at its victim, but never in a straight line — the shard's aim
    // is a suggestion the bolt keeps arguing with
    const want = Math.atan2(targetImpactY(sp.mark) - sp.y, sp.mark.x - sp.x);
    const cur = Math.atan2(sp.vy, sp.vx);
    let d = want - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const a = cur + Math.sign(d) * Math.min(Math.abs(d), 9 * dt) + rand(-0.2, 0.2);
    sp.vx = Math.cos(a) * spd;
    sp.vy = Math.sin(a) * spd;
  }
  sp.jitterX = rand(-3.5, 3.5); // render-only tremor
  sp.jitterY = rand(-3.5, 3.5);
  sp.x += sp.vx * dt;
  sp.y += sp.vy * dt;
  if (!sp._hit) sp._hit = new Set();
  const hit = arcanumContact(sp, sp._hit, 46);
  if (hit) {
    if (hit.e) sp._hit.add(hit.e);
    const at = arcanumStrike(sp, hit, sp.dmg, "#c46bff", { knock: 0, particles: 10, spread: 62 });
    quantumRupture(sp, at.x, at.y);
    if (sp.rift) spawnRuptureRift(sp, at.x, at.y);
    if (sp.splinter) splinterFracture(sp, at.x, at.y);
    // Cascade Failure: it simply picks someone else and keeps going
    if (sp.cascade > 0) {
      const next = randomLiveEnemy(sp.x, 620, hit.e || null);
      if (next) {
        sp.cascade--;
        sp.mark = next;
        sp.dmg = Math.max(1, sp.dmg * 0.78);
        sp.life = Math.max(sp.life, 0.9);
        spawnParticles(sp.x, sp.y, 9, "#ff7ad8", 58, 115);
        return false;
      }
    }
    return true;
  }
  if (sp.y > groundY - 8 || sp.life <= 0) {
    spellGroundImpact(sp);
    const gy = Math.min(sp.y, groundY - 16);
    applySpellField(sp, sp.x, gy);
    quantumRupture(sp, sp.x, gy);
    if (sp.rift) spawnRuptureRift(sp, sp.x, gy);
    return true;
  }
  return false;
}

// ----- Gale-Staff of Aerion: a burst of wind under whatever flies highest -----
// Barely damages anything. It takes the enemy furthest off the ground and puts
// it much further off the ground, and everything it clips on the way up goes
// with it — the whole payoff is the walk back down.

const GALE_GRAVITY = 1150;

// `galeH` is height above wherever the body was standing. Enemy AI rewrites
// e.fy every frame, but spells update after enemies, so re-asserting it here
// wins; on landing we write the base height back once and let the AI have it.
function loftEnemy(e, power, sp, depth = 0) {
  if (!e || e.dying || e.fleeing || e.hp <= 0) return false;
  const col = sp.upgradeCol || "#8fd8ff";
  if (ENEMY_TYPES[e.type]?.noKnockback) {
    // too heavy to lift — it just gets battered where it stands
    spellDamageEnemy(e, Math.max(1, sp.dmg * 0.9), col, { particleCount: 8, spread: 52 });
    spawnParticles(e.x, targetImpactY(e), 10, "#d8f8ff", 74, 95);
    return false;
  }
  if ((e.galeH || 0) > 6) return false; // already up there
  e.galeBase = e.fy || 0;
  e.galeH = 1;
  e.galeVy = power;
  e.galePeak = 0;
  e.galeDmg = sp.dmg;
  e.galeShear = sp.galeShear || 0;
  e.galeSlam = sp.galeSlam || 0;
  e.galeCol = col;
  e.galeDepth = depth;
  e.galeShearT = 0.25;
  e.rooted = Math.max(e.rooted || 0, 0.2);
  spawnParticles(e.x, groundY - 10, 12, "#d8f8ff", 62, 135);
  if (depth === 0) floaty(e.x, "Airborne!", "#8fd8ff", 12);
  return true;
}

function galeLanding(e) {
  const col = e.galeCol || "#8fd8ff";
  const fall = e.galePeak || 0;
  e.fy = e.galeBase || 0;
  e.galeH = 0;
  e.galeVy = 0;
  e.rooted = Math.max(e.rooted || 0, 0.45); // dazed where it lands
  spawnParticles(e.x, groundY - 6, 14, "#c8b89a", 92, 62);
  spawnParticles(e.x, groundY - 12, 8, col, 62, 95);
  Audio.hit();
  const impact = Math.max(1, (e.galeDmg || 2) * (0.4 + Math.min(1.6, fall / 190)) * (1 + (e.galeSlam || 0)));
  // Skybreaker: the ground gives out under the landing
  if (e.galeSlam) {
    Game.screenShake = Math.max(Game.screenShake, 0.3);
    state.legendaryEffects.push({ type: "ring", x: e.x, radius: 96, life: 0.32, totalLife: 0.32, col, width: 4 });
    for (const ne of enemiesNearX(e.x, 96)) {
      if (ne === e) continue;
      spellDamageEnemy(ne, Math.max(1, impact * 0.5), col, { particleCount: 5, spread: 42 });
      if (ENEMY_TYPES[ne.type]?.noKnockback) continue;
      ne.knock = (ne.knock || 0) + Math.sign(ne.x - e.x || 1) * 190;
      ne.rooted = Math.max(ne.rooted || 0, 0.5);
    }
  }
  e.galeShear = 0; e.galeSlam = 0; e.galePeak = 0;
  spellDamageEnemy(e, impact, col, { particleCount: 8, spread: 56 });
}

function updateGaleLofts(dt) {
  for (const e of state.enemies) {
    if (!(e.galeH > 0)) continue;
    if (e.dying || e.fleeing || e.hp <= 0) { e.galeH = 0; e.galeVy = 0; continue; }
    e.galeVy -= GALE_GRAVITY * dt;
    e.galeH += e.galeVy * dt;
    e.galePeak = Math.max(e.galePeak || 0, e.galeH);
    // anything it clips on the way up is carried along with it
    if (e.galeVy > 80 && (e.galeDepth || 0) < 2) {
      for (const ne of enemiesNearX(e.x, 34)) {
        if (ne === e || (ne.galeH || 0) > 6) continue;
        loftEnemy(ne, e.galeVy * 0.72, {
          dmg: e.galeDmg, galeShear: e.galeShear, galeSlam: e.galeSlam, upgradeCol: e.galeCol,
        }, (e.galeDepth || 0) + 1);
      }
    }
    // Razor Wind: the air has edges
    if (e.galeShear > 0) {
      e.galeShearT = (e.galeShearT || 0.25) - dt;
      if (e.galeShearT <= 0) {
        e.galeShearT = 0.3;
        spellDamageEnemy(e, Math.max(1, (e.galeDmg || 2) * 0.35 * e.galeShear), e.galeCol, {
          y: groundY + (e.galeBase || 0) - e.galeH, particleCount: 4, spread: 32, float: false,
        });
      }
    }
    if (e.galeH <= 0) { galeLanding(e); continue; }
    e.fy = (e.galeBase || 0) - e.galeH;
    e.rooted = Math.max(e.rooted || 0, 0.12); // nothing walks while it is off the ground
    if (Math.random() < dt * 14) spawnParticles(e.x + rand(-11, 11), groundY + e.fy + rand(-6, 16), 1, "#d8f8ff", 24, 42);
  }
}

function eruptGale(sp, x) {
  const power = 470 + (sp.galeForce || 0) * 300;
  const r = Math.max(56, sp.aoeRadius || 78);
  const col = sp.upgradeCol || "#8fd8ff";
  let lifted = 0;
  for (const e of enemiesNearX(x, r)) if (loftEnemy(e, power * rand(0.86, 1.1), sp)) lifted++;
  // Updraft: the column keeps blowing after the burst
  if (sp.galeCyclone) {
    const life = 1.6 + sp.galeCyclone;
    ensureSpellFields().push({
      type: "updraft",
      x, y: groundY - 70,
      r: r * 0.85,
      dmg: sp.dmg,
      power: power * 0.8,
      shear: sp.galeShear || 0,
      slam: sp.galeSlam || 0,
      col,
      life, maxLife: life,
      tick: 0.35,
      ph: rand(0, 6),
    });
  }
  state.legendaryEffects.push({ type: "ring", x, radius: r, life: 0.3, totalLife: 0.3, col, width: 3 });
  spawnParticles(x, groundY - 8, 24, "#d8f8ff", r, 150);
  spawnParticles(x, groundY - 4, 12, "#c8b89a", r * 0.8, 70);
  Audio.explosion();
  Game.screenShake = Math.max(Game.screenShake, lifted ? 0.24 : 0.12);
  if (lifted > 1) floaty(x, "Gale x" + lifted, col, 13);
}

function updateGaleLance(sp, dt) {
  sp.x += sp.vx * dt;
  sp.y += sp.vy * dt;
  if (Math.random() < dt * 45) spawnParticles(sp.x + rand(-16, 16), sp.y + rand(-18, 18), 1, "#d8f8ff", 28, 44);
  const reached = sp.vx >= 0 ? sp.x >= sp.destX : sp.x <= sp.destX;
  if (reached || sp.life <= 0) {
    eruptGale(sp, sp.x);
    // Eye of Aerion: a second storm opens under the next body still standing
    if (sp.galeTwin) {
      const second = highestEnemyNear(sp.x, 420, 90);
      if (second) eruptGale({ ...sp, galeTwin: false }, second.x);
    }
    return true;
  }
  return false;
}

// The body furthest off the ground within reach, ignoring anything already
// lofted or standing too close to `x` to count as a second target.
function highestEnemyNear(x, maxD, minSep = 0) {
  let best = null, bestY = Infinity, bd = Infinity;
  for (const e of state.enemies) {
    if (e.fleeing || e.dying || e.hp <= 0 || (e.galeH || 0) > 6) continue;
    const d = dist(e.x, x);
    if (d > maxD || d < minSep) continue;
    const y = targetImpactY(e);
    if (y < bestY - 1 || (Math.abs(y - bestY) <= 1 && d < bd)) { bestY = y; bd = d; best = e; }
  }
  return best;
}

// ----- The Bastion Scepter: a last line, and nothing else -----
// Refuses to fire away from the gates (that check lives in the target picker).
// Inside the ring it drops explosive masonry on whatever is nearest the base,
// and always shoves the wreckage outward rather than into your walls.

function bastionBurst(sp, x, y) {
  const col = sp.upgradeCol || "#ffd88a";
  const r = Math.max(52, sp.aoeRadius || 64) * (1 + (sp.quake || 0) * 0.35);
  let slain = 0;
  for (const e of enemiesNearX(x, r)) {
    const before = e.hp;
    spellDamageEnemy(e, Math.max(1, sp.dmg * 0.62), col, { particleCount: 6, spread: 48 });
    if (before > 0 && e.hp <= 0) slain++;
    if (ENEMY_TYPES[e.type]?.noKnockback) continue;
    e.knock = (e.knock || 0) + Math.sign(e.x - CFG.baseX || 1) * (150 + (sp.quake || 0) * 130);
    if (sp.quake && Math.random() < 0.5) e.rooted = Math.max(e.rooted || 0, 1.1);
  }
  state.legendaryEffects.push({ type: "ring", x, radius: r, life: 0.28, totalLife: 0.28, col, width: 2 + (sp.quake || 0) * 2 });
  spawnParticles(x, y, 16, "#b8a488", r * 0.8, 90);
  spawnParticles(x, y, 9, col, r * 0.6, 120);
  Audio.explosion();
  Game.screenShake = Math.max(Game.screenShake, 0.2 + (sp.quake || 0) * 0.15);
  // Hearth Eternal: the watchfire feeds on what dies in front of it
  if (sp.ward && slain) {
    const base = state.base;
    if (base && base.hp < base.maxHp) {
      base.hp = Math.min(base.maxHp, base.hp + slain);
      base.flash = 0.3;
      floaty(base.x, "+" + slain + " gate", "#ffe9a0", 13);
      spawnParticles(base.x, groundY - 60, 12, "#ffd88a", 70, 110);
    }
    const p = state.player;
    if (p) {
      p.invuln = Math.max(p.invuln || 0, 0.55);
      spawnParticles(p.x, groundY - 42, 10, "#fff0c0", 50, 95);
    }
  }
}

function updateBastionStone(sp, dt) {
  sp.x += sp.vx * dt;
  sp.y += sp.vy * dt;
  sp.vy += 420 * dt;
  sp.spin = (sp.spin || 0) + dt * (sp.vx >= 0 ? 7 : -7);
  const hit = arcanumContact(sp);
  const grounded = sp.y > groundY - 10;
  if (hit || grounded || sp.life <= 0) {
    const at = hit
      ? arcanumStrike(sp, hit, sp.dmg, "#ffd88a", { knock: 120 })
      : { x: sp.x, y: groundY - 18 };
    if (!hit) { spellGroundImpact(sp); applySpellField(sp, at.x, at.y); }
    bastionBurst(sp, at.x, at.y);
    return true;
  }
  return false;
}

// ----- The Hive-King's Scepter: kiting as a resource -----
// Larvae are shed by walking (see updateHiveStride in PlayerCombat). A larva
// rots and slows its host; when the host dies — by any hand — it hatches into
// something that fights for you for a few seconds.

function attachSoulLarva(sp, host) {
  const life = 7 + (sp.hatchLife || 0);
  ensureSpellFields().push({
    type: "larva",
    host,
    x: host.x, y: targetImpactY(host) - 8,
    r: 0,
    dmg: Math.max(1, sp.dmg * (0.28 + (sp.larvaVenom || 0) * 0.16)),
    slow: 0.35 + (sp.larvaVenom || 0) * 0.2,
    hunger: sp.larvaHunger || 0,
    swarm: !!sp.larvaSwarm,
    hatchLife: sp.hatchLife || 0,
    bite: Math.max(1, sp.dmg * (0.75 + (sp.hatchLife || 0) * 0.12)),
    col: sp.upgradeCol || "#9ef0b8",
    life, maxLife: life,
    tick: 0.6,
    ph: rand(0, 6),
  });
  host.slow = Math.max(host.slow || 0, 0.35 + (sp.larvaVenom || 0) * 0.2);
  spawnParticles(host.x, targetImpactY(host), 12, "#9ef0b8", 52, 78);
  floaty(host.x, "Painted", "#c8ffd8", 11);
}

function hatchSoulMinion(f, x) {
  const life = 5 + (f.hatchLife || 0);
  const kind = Math.random() < 0.5 ? "imp" : "beetle";
  ensureSpellFields().push({
    type: "hatchling",
    x, y: groundY - 18,
    r: 0,
    kind,
    dmg: Math.max(1, f.bite || 2),
    dir: Math.random() < 0.5 ? -1 : 1,
    col: f.col || "#9ef0b8",
    life, maxLife: life,
    tick: 0.2,
    lunge: 0,
    anim: rand(0, 6),
    ph: rand(0, 6),
  });
  spawnParticles(x, groundY - 24, 16, f.col || "#9ef0b8", 72, 115);
  spawnParticles(x, groundY - 24, 8, "#ffffff", 42, 135);
  Audio.spell();
}

function updateLarvaOrb(sp, dt) {
  const mark = sp.mark && !sp.mark.dying && !sp.mark.fleeing && sp.mark.hp > 0 ? sp.mark : null;
  sp.mark = mark || nearestEnemyTo(sp.x, 520);
  if (sp.mark) {
    const want = Math.atan2(targetImpactY(sp.mark) - sp.y, sp.mark.x - sp.x);
    const cur = Math.atan2(sp.vy, sp.vx);
    let d = want - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const spd = Math.hypot(sp.vx, sp.vy) || 300;
    const a = cur + Math.sign(d) * Math.min(Math.abs(d), 7 * dt);
    sp.vx = Math.cos(a) * spd;
    sp.vy = Math.sin(a) * spd + Math.sin((sp.age || 0) * 14) * 26; // it swims rather than flies
  } else {
    sp.vy += 180 * dt;
  }
  sp.x += sp.vx * dt;
  sp.y += sp.vy * dt;
  const hit = arcanumContact(sp);
  if (hit) {
    arcanumStrike(sp, hit, Math.max(1, sp.dmg * 0.4), "#9ef0b8", { knock: 20, particles: 6, spread: 34 });
    if (hit.e && !hit.e.dying && hit.e.hp > 0) attachSoulLarva(sp, hit.e);
    return true;
  }
  if (sp.y > groundY - 8 || sp.life <= 0) {
    spawnParticles(sp.x, Math.min(sp.y, groundY - 8), 8, "#4fbf7a", 48, 60);
    return true;
  }
  return false;
}

export function updateArcanumStatuses(dt) {
  updatePlagueContagion(dt);
  updateResonanceDecay(dt);
  updateGaleLofts(dt);
}

// Per-frame driver. Returns true when the projectile is spent.
function updateArcanumSpell(sp, dt) {
  switch (sp.spellType) {
    case "bramble":     return updateBramblePod(sp, dt);
    case "prism":       return updatePrismShard(sp, dt);
    case "refract":     return updateRefractRay(sp, dt);
    case "spore":       return updateSporeFlask(sp, dt);
    case "gravitywell": return updateNullstoneCore(sp, dt);
    case "leech":       return updateLeechOrb(sp, dt);
    case "resonance":   return updateResonanceWave(sp, dt);
    case "fracture":    return updateFractureBolt(sp, dt);
    case "gale":        return updateGaleLance(sp, dt);
    case "bastion":     return updateBastionStone(sp, dt);
    case "larva":       return updateLarvaOrb(sp, dt);
  }
  return true;
}

function castArcanumSpell(player, wBase, tgt, fx, ctx) {
  const { ew, dmgMult, aoeR, castOrigin, upgradeCol, upgradeRank } = ctx;
  const dmg = ew.dmg * dmgMult;
  const targetY = targetImpactY(tgt);
  const dir = Math.sign(tgt.x - player.x) || player.dir || 1;

  // Every arcanum projectile carries the same generic upgrade riders the
  // older staffs do, so applySpellField can resolve them on impact.
  const base = {
    arcanum: true,
    spellType: wBase.spellType,
    col: wBase.col,
    dmg,
    aoeRadius: aoeR,
    age: 0,
    burnDps: fx.spellBurn || 0,
    frostS: fx.spellFrost || 0,
    firePool: !!fx.firePool,
    split: fx.splitOrbs || 0,
    pull: !!fx.singularity,
    scorchChain: fx.scorchChain || 0,
    geyser: fx.geyser || 0,
    runeTrap: fx.runeTrap || 0,
    shadowCurse: fx.shadowCurse || 0,
    voidScar: fx.voidScar || 0,
    soulSiphon: fx.soulSiphon || 0,
    upgradeCol, upgradeRank,
  };

  const shots = [];
  const push = (extra) => shots.push({ ...base, ...extra });

  switch (wBase.spellType) {
    case "bramble": {
      const b = ballisticVelocity(castOrigin.x, castOrigin.y, tgt.x, targetY, 400, 340);
      push({
        x: castOrigin.x, y: castOrigin.y, vx: b.vx, vy: b.vy,
        life: b.flight + 1.2,
        seeds: 2 + (fx.brambleSeeds || 0), seedT: 0.12,
        brambleLife: fx.brambleLife || 0, brambleLash: fx.brambleLash || 0,
        brambleRoot: fx.brambleRoot || 0, brambleTwin: !!fx.brambleTwin,
        slowHit: fx.slowHit || 0,
      });
      break;
    }
    case "prism": {
      const b = ballisticVelocity(castOrigin.x, castOrigin.y, tgt.x, targetY, 560, 110);
      push({
        x: castOrigin.x, y: castOrigin.y, vx: b.vx, vy: b.vy,
        life: b.flight + 0.8,
        refractRays: fx.refractRays || 0, refractSplit: !!fx.refractSplit,
      });
      break;
    }
    case "spore": {
      const b = ballisticVelocity(castOrigin.x, castOrigin.y, tgt.x, targetY, 380, 460);
      push({
        x: castOrigin.x, y: castOrigin.y, vx: b.vx, vy: b.vy,
        life: b.flight + 1.1,
        sporeLife: fx.sporeLife || 0, sporeSpread: 0.25 + (fx.sporeSpread || 0),
        sporeSlow: fx.sporeSlow || 0, plagueDmg: fx.plagueDmg || 0, sporeBloom: !!fx.sporeBloom,
      });
      break;
    }
    case "gravitywell": {
      const dx = tgt.x - castOrigin.x, dy = targetY - 40 - castOrigin.y;
      const len = Math.max(60, Math.hypot(dx, dy));
      push({
        x: castOrigin.x, y: castOrigin.y,
        vx: (dx / len) * 620, vy: (dy / len) * 620,
        reach: len, life: len / 620 + 0.6,
        wellDuration: fx.wellDuration || 0, wellPull: fx.wellPull || 0,
        wellCrush: fx.wellCrush || 0, wellRoot: !!fx.wellRoot, wellRepeat: !!fx.wellRepeat,
      });
      break;
    }
    case "leech": {
      const n = 1 + (fx.leechSwarm || 0);
      const baseAng = Math.atan2(targetY - castOrigin.y, tgt.x - castOrigin.x);
      for (let i = 0; i < n; i++) {
        const off = n === 1 ? 0 : ((i / (n - 1)) * 2 - 1) * 0.5;
        push({
          x: castOrigin.x, y: castOrigin.y,
          vx: Math.cos(baseAng + off) * 340, vy: Math.sin(baseAng + off) * 340,
          dmg: dmg * (n > 1 ? 0.62 : 1),
          life: 2.4,
          leechHeal: fx.leechHeal || 0, leechDmg: fx.leechDmg || 0,
          leechLife: fx.leechLife || 0, leechJumps: 1 + (fx.leechJumps || 0),
        });
      }
      break;
    }
    case "resonance": {
      push({
        x: castOrigin.x + dir * 14, y: groundY - 62,
        vx: dir * 330, vy: 0,
        reach: ew.range + 70, life: 2.6,
        needed: Math.max(1, 3 - (fx.resonanceTune || 0)),
        force: 1 + (fx.waveForce || 0),
        echo: !!fx.waveEcho, chorus: !!fx.chorusShatter,
        _hit: new Set(),
      });
      break;
    }
  }

  // Echoing casts release a weaker second projectile (the bell wave has its
  // own rebound instead, so it sits this one out).
  if (fx.spellEcho && wBase.spellType !== "resonance" && shots.length && Math.random() < fx.spellEcho) {
    const lead = shots[0];
    shots.push({
      ...lead,
      _hit: undefined,
      x: lead.x - dir * 16, y: lead.y - 9,
      vx: lead.vx * 0.92 + rand(-30, 30), vy: lead.vy * 0.9 - 55,
      dmg: Math.max(1, lead.dmg * 0.55),
      aoeRadius: Math.max(22, aoeR * 0.65),
      isEcho: true,
    });
    spawnParticles(castOrigin.x, castOrigin.y, 8, upgradeCol || wBase.col, 42, 75);
  }

  for (const s of shots) {
    if (s._hit === undefined) delete s._hit;
    state.spells.push(s);
  }
  castBurstFX(wBase, castOrigin.x, castOrigin.y, dir, 0);
  Audio.spell();
  Audio.arcanumCast(wBase.spellType);
}

export function castSpell(player, wBase, tgt) {
  const ew = effectiveWeapon(player.weapon, player.weaponUpgrades || []);
  const fx = mergeInnateEffects(wBase, player.weaponUpgrades || []);
  if (!payWeaponCastCost(player, fx, wBase.col)) return;
  let overchargeMult = 1;
  if (fx.overcharge) {
    const now = performance.now() / 1000;
    const prev = player.spellOvercharge;
    const chain = prev && prev.weapon === player.weapon && now - prev.t < 3.2;
    const n = Math.min(4, chain ? (prev.n || 0) + 1 : 1);
    player.spellOvercharge = { weapon: player.weapon, n, t: now };
    overchargeMult = 1 + (n - 1) * fx.overcharge;
    if (n >= 2) floaty(player.x, "Overcharge x" + n, wBase.col, 12);
  }
  const dmgMult = permanentDamageMultiplier() * playerMomentumDamageMultiplier() * playerRiposteDamageMultiplier(player) * overchargeMult;
  const aoeR = ((wBase.aoeRadius || 0) + (ew.range - wBase.range) * 0.2 + (fx.aoeBonus || 0)) * (1 + (overchargeMult - 1) * 0.6);
  const castOrigin = playerTomeCastOrigin(player);
  const upgradeCol = fx._vfxCols?.length ? fx._vfxCols[fx._vfxCols.length - 1] : null;
  const upgradeRank = fx._tierRank || 0;

  // Generated staffs carry a full 5-axis spell recipe (element/form/behavior/
  // impact/flourish) and are routed entirely away from the hand-tuned
  // spellType switch below — curated weapons never set spellRecipe.
  if (wBase.spellRecipe) {
    castProceduralSpell(player, wBase, tgt, fx, { ew, dmgMult, aoeR, castOrigin, upgradeCol, upgradeRank });
    return;
  }

  // The arcanum staffs each drive their own projectile school.
  if (ARCANUM_SPELLS.has(wBase.spellType)) {
    castArcanumSpell(player, wBase, tgt, fx, { ew, dmgMult, aoeR, castOrigin, upgradeCol, upgradeRank });
    return;
  }

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
    if (fx.soulSiphon) trySoulSiphon(player, fx.soulSiphon, upgradeCol || wBase.col);
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
    soulSiphon: fx.soulSiphon || 0,
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
    sp.age = (sp.age || 0) + dt;
    if (sp.arcanum) {
      sp.life -= dt;
      spellTrail(sp);
      if (updateArcanumSpell(sp, dt)) spells.splice(i, 1);
      continue;
    }
    if (sp.form) {
      applyProceduralMotion(sp, dt);
    } else {
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      const grav = spellGravity(sp.spellType);
      sp.vy += grav * dt;
    }
    sp.life -= dt;

    spellTrail(sp);

    const hitGround = sp.y > groundY - 8;
    if (sp.life <= 0 || hitGround) {
      if (sp.form) {
        if (hitGround) {
          if (sp.form === "ring") {
            spawnExpandingRing(sp, sp.x, groundY - 8);
            applySpellField(sp, sp.x, groundY - 20);
          } else if (sp.aoeRadius > 0) {
            spellGroundImpact(sp);
            triggerProceduralImpact(sp, sp.x, groundY - 8);
            applySpellField(sp, sp.x, groundY - 20);
            Audio.explosion();
          }
        }
        spells.splice(i, 1);
        continue;
      }
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
        if (sp.form) {
          hit = resolveProceduralEnemyHit(sp, e, ey, et);
          break;
        }
        e.hp -= sp.dmg; e.flash = 0.14; Audio.hit();
        if (sp.soulSiphon) trySoulSiphon(state.player, sp.soulSiphon, sp.upgradeCol || sp.col);
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
  if (sp.palette) { paletteSpellTrail(sp); return; }
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
    case "bramble":
      if (Math.random() < 0.6) spawnParticles(sp.x, sp.y, 1, "#4f7a2a", 12, 16);
      if (Math.random() < 0.35) spawnParticles(sp.x, sp.y, 1, "#9bd05a", 8, 22);  // shed leaves
      if (Math.random() < 0.2) spawnParticles(sp.x, sp.y, 1, "#c8e070", 6, 26);   // drifting pollen
      break;
    case "prism":
      if (Math.random() < 0.55) spawnParticles(sp.x, sp.y, 1, "#8fe8ff", 10, 18);
      if (Math.random() < 0.3) spawnParticles(sp.x, sp.y, 1, "#ffffff", 5, 24);   // caught light
      break;
    case "refract":
      spawnParticles(sp.x, sp.y, 1, "#d8f8ff", 4, 10);
      if (Math.random() < 0.4) spawnParticles(sp.x, sp.y, 1, "#ffffff", 3, 14);
      break;
    case "spore":
      if (Math.random() < 0.7) spawnParticles(sp.x, sp.y, 1, "#7fbf3a", 14, 20);
      if (Math.random() < 0.3) spawnParticles(sp.x, sp.y, 1, "#3a5a1a", 18, 14);  // sour smoke
      break;
    case "gravitywell":
      if (Math.random() < 0.75) spawnParticles(sp.x, sp.y, 1, "#3a1a5a", 16, 10);
      if (Math.random() < 0.35) spawnParticles(sp.x, sp.y, 1, "#7a3aff", 10, 20);
      break;
    case "leech":
      if (Math.random() < 0.7) spawnParticles(sp.x, sp.y, 1, "#c0102a", 12, 14);
      if (Math.random() < 0.3) spawnParticles(sp.x, sp.y, 1, "#ff5060", 7, 20);   // arterial spray
      break;
    case "resonance":
      // the wave's own ripples are drawn per-frame in updateResonanceWave
      break;
  }
}

// Burst of magic at the caster's hands, flavored per school.
function castBurstFX(wBase, x, y, dirX = 1, dirY = 0) {
  spawnParticles(x, y, 10, wBase.col, 50, 70);
  if (wBase.spellPalette) {
    spawnParticles(x, y, 6, wBase.spellPalette[1] || wBase.col, 40, 80);
    spawnParticles(x, y, 3, wBase.spellCore || "#ffffff", 25, 90);
    return;
  }
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
    case "bramble":
      spawnParticles(x, y, 6, "#9bd05a", 34, 60);
      spawnParticles(x, y, 3, "#c8e070", 22, 75);
      break;
    case "prism":
      spawnParticles(x, y, 6, "#8fe8ff", 38, 70);
      spawnParticles(x, y, 4, "#ffffff", 22, 85);
      break;
    case "spore":
      spawnParticles(x, y, 7, "#7fbf3a", 38, 55);
      spawnParticles(x, y, 3, "#3a5a1a", 26, 40);
      break;
    case "gravitywell":
      spawnParticles(x, y, 7, "#7a3aff", 36, 65);
      spawnParticles(x, y, 3, "#c8a0ff", 20, 80);
      Game.screenShake = Math.max(Game.screenShake, 0.1);
      break;
    case "leech":
      spawnParticles(x, y, 6, "#c0102a", 34, 55);
      spawnParticles(x, y, 3, "#ff5060", 20, 70);
      break;
    case "resonance":
      spawnParticles(x, y, 8, "#e8f8ff", 48, 80);
      spawnParticles(x, y, 4, "#ffffff", 26, 95);
      break;
  }
}

function spellEnemyImpact(sp, x, y) {
  if (sp.palette) { paletteSpellImpact(sp, x, y); return; }
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
    case "bramble":
      spawnParticles(x, y, 14, "#4f7a2a", 75, 95);
      spawnParticles(x, y, 8, "#9bd05a", 55, 110);
      Game.screenShake = Math.max(Game.screenShake, 0.16);
      break;
    case "prism":
      spawnParticles(x, y, 14, "#8fe8ff", 85, 105);
      spawnParticles(x, y, 8, "#ffffff", 45, 130);
      Game.screenShake = Math.max(Game.screenShake, 0.2);
      break;
    case "refract":
      spawnParticles(x, y, 7, "#d8f8ff", 45, 70);
      spawnParticles(x, y, 3, "#ffffff", 25, 95);
      break;
    case "spore":
      spawnParticles(x, y, 14, "#7fbf3a", 80, 90);
      spawnParticles(x, y, 8, "#c8e070", 50, 110);
      spawnParticles(x, y, 5, "#3a5a1a", 60, 55);
      Game.screenShake = Math.max(Game.screenShake, 0.18);
      break;
    case "gravitywell":
      spawnParticles(x, y, 14, "#3a1a5a", 70, 80);
      spawnParticles(x, y, 8, "#7a3aff", 45, 110);
      Game.screenShake = Math.max(Game.screenShake, 0.2);
      break;
    case "leech":
      spawnParticles(x, y, 14, "#c0102a", 70, 85);
      spawnParticles(x, y, 7, "#ff5060", 45, 100);
      Game.screenShake = Math.max(Game.screenShake, 0.16);
      break;
    case "resonance":
      spawnParticles(x, y, 14, "#e8f8ff", 85, 115);
      spawnParticles(x, y, 6, "#ffffff", 45, 140);
      Game.screenShake = Math.max(Game.screenShake, 0.22);
      break;
    default:
      spawnParticles(x, y, 8, sp.col, 70, 90);
      break;
  }
}

function spellGroundImpact(sp) {
  if (sp.palette) { paletteGroundImpact(sp); return; }
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
    case "bramble":
      spawnParticles(sp.x, groundY - 8, 18, "#4f7a2a", 95, 90);
      spawnParticles(sp.x, groundY - 8, 10, "#6d4a24", 70, 60);   // torn-up soil
      Game.screenShake = Math.max(Game.screenShake, 0.22);
      break;
    case "prism":
      spawnParticles(sp.x, groundY - 8, 16, "#8fe8ff", 100, 120);
      spawnParticles(sp.x, groundY - 8, 8, "#ffffff", 60, 140);
      Game.screenShake = Math.max(Game.screenShake, 0.24);
      break;
    case "spore":
      spawnParticles(sp.x, groundY - 8, 20, "#7fbf3a", 100, 95);
      spawnParticles(sp.x, groundY - 8, 10, "#3a5a1a", 75, 60);
      Game.screenShake = Math.max(Game.screenShake, 0.22);
      break;
    case "gravitywell":
      spawnParticles(sp.x, groundY - 8, 18, "#3a1a5a", 90, 80);
      spawnParticles(sp.x, groundY - 8, 10, "#7a3aff", 60, 120);
      Game.screenShake = Math.max(Game.screenShake, 0.26);
      break;
    case "leech":
      spawnParticles(sp.x, groundY - 8, 14, "#7a0a1a", 80, 60);
      spawnParticles(sp.x, groundY - 8, 7, "#c0102a", 55, 90);
      break;
  }
}
