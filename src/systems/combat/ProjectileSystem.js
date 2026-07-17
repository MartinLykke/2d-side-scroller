import { CFG } from '../../config/config.js';
import { ENEMY_TYPES } from '../../config/enemies.js';
import { clamp, dist, rand, applyCrit } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnGoldReward, spawnParticles, floaty, critFloaty } from '../world/SpawnSystem.js';
import { spawnLevelUpBeam } from '../../rendering/Effects.js';
import { killEnemy, killEnemyWithAnimation, spawnImpBlood } from '../../util/EnemyUtils.js';
import { startArcherShoot, SHOOT_RELEASE_TIME } from '../../rendering/sprites/Archer.js';
import { entityWallLift } from '../../entities/Wall.js';
import { permanentDamageMultiplier } from '../infrastructure/RoguelikeSystem.js';
import { spawnFirePool, spawnVoidPool } from '../ai/BossAI.js';
import { damagePlayer } from './PlayerCombat.js';
import { chainLightning } from './SpellSystem.js';
import { addSkillPoints } from '../economy/SkillSystem.js';
import { playerMountLift } from '../economy/MountSystem.js';

function arrowTrail(ar) {
  if (ar.enemyFireball) {
    const hot = ar.voidBolt ? "#8a5aff" : "#ff6a20";
    const core = ar.voidBolt ? "#d7f6ff" : "#ffd060";
    const smoke = ar.voidBolt ? "#160a38" : "#5a0710";
    const scale = ar.scale || (ar.big ? 1.5 : 1);
    spawnParticles(ar.x, ar.y, ar.ashFireball ? 5 : 3, hot, 22 * scale, ar.voidBolt ? 30 : 20);
    if (Math.random() < 0.75) spawnParticles(ar.x, ar.y, 1, core, 10 * scale, ar.voidBolt ? 34 : 24);
    if (Math.random() < 0.35) spawnParticles(ar.x, ar.y, 1, smoke, 18 * scale, 8);
    return;
  }
  if (ar.fireArrow) {
    spawnParticles(ar.x, ar.y, 2, "#ff6a20", 16, 14);
    if (Math.random() < 0.55) spawnParticles(ar.x, ar.y, 1, "#ffd060", 9, 18);
  }
  if (ar.powered) {
    spawnParticles(ar.x, ar.y, 2, "#ffcc44", 18, 16);
    if (Math.random() < 0.6) spawnParticles(ar.x, ar.y, 1, "#fff2b0", 10, 22);
  }
  if (ar.ballista) {
    if (Math.random() < 0.8) spawnParticles(ar.x, ar.y, 1, "#9aa2ae", 14, 10);
    if (Math.random() < 0.4) spawnParticles(ar.x, ar.y, 1, "#ffb060", 10, 14);
  }
  if (ar.frostArrow) {
    spawnParticles(ar.x, ar.y, 2, "#bfefff", 14, 14);
    if (Math.random() < 0.5) spawnParticles(ar.x, ar.y, 1, "#ffffff", 8, 16);
  }
  if (ar.upgradeCol) {
    const rate = ar.upgradeRank >= 3 ? 0.85 : 0.55;
    if (Math.random() < rate) spawnParticles(ar.x, ar.y, 1, ar.upgradeCol, 12 + (ar.upgradeRank || 1) * 3, 12);
  }
  if (ar.weaponId === "dark_bow") {
    if (Math.random() < 0.5) spawnParticles(ar.x, ar.y, 1, "#880099", 8, 5);
  } else if (ar.weaponId === "void_bow") {
    if (Math.random() < 0.6) spawnParticles(ar.x, ar.y, 1, "#6622cc", 10, 8);
  } else if (ar.weaponId === "dragons_bow") {
    spawnParticles(ar.x, ar.y, 2, "#ff6820", 15, 12);
    if (Math.random() < 0.4) spawnParticles(ar.x, ar.y, 1, "#ffcc40", 8, 8);
  } else if (ar.weaponId === "crossbow") {
    if (Math.random() < 0.4) spawnParticles(ar.x, ar.y, 1, "#c8ccd4", 8, 5); // bolt slipstream
  } else if (ar.weaponId === "long_bow") {
    if (Math.random() < 0.25) spawnParticles(ar.x, ar.y, 1, "#e8e0c8", 6, 5); // faint air streak
  }
}

const STUCK_ARROW_LIFE = 10;
const MIN_STUCK_ARROW_LIFE = 1;
const ARCHERS_FOR_MIN_ARROW_LIFE = 20;

function aliveArcherCount() {
  return state.units.reduce((count, u) => (
    count + (u.role === "archer" && u.hp > 0 && !u.dying ? 1 : 0)
  ), 0);
}

function stuckArrowLife() {
  const archerPressure = clamp(aliveArcherCount() / ARCHERS_FOR_MIN_ARROW_LIFE, 0, 1);
  return STUCK_ARROW_LIFE - (STUCK_ARROW_LIFE - MIN_STUCK_ARROW_LIFE) * archerPressure;
}

function grantArrowBarrier(seconds, col = "#ffffff") {
  const player = state.player;
  if (!player || !seconds || seconds <= 0) return;
  player.invuln = Math.max(player.invuln || 0, seconds);
  spawnParticles(player.x, groundY - 42, 10, col, 46, 90);
  spawnParticles(player.x, groundY - 42, 5, "#ffffff", 28, 95);
  floaty(player.x, "Guarded", col);
}

function stickArrowInEnemy(e, ar, enemyDrawY) {
  if (ar.ballista) return;
  if (!e.stuckArrows) e.stuckArrows = [];
  if (e.stuckArrows.length >= 5) e.stuckArrows.shift();
  const facing = e.dir < 0 ? -1 : 1;
  const drawYOff = e.aiState === "stacking" && e.impStackY !== undefined ? e.impStackY : (e.fy || 0);
  const localX = clamp((ar.x - e.x) * facing, -4, 9);
  const localY = clamp(ar.y - drawYOff, groundY - 29, groundY - 10);
  e.stuckArrows.push({
    x: localX,
    y: localY,
    a: Math.atan2(ar.vy, ar.vx) * facing,
    weaponId: ar.weaponId || null,
    upgradeCol: ar.upgradeCol || null,
    upgradeRank: ar.upgradeRank || 0,
    t: stuckArrowLife(),
  });
}

function stickArrowInAnimal(a, ar) {
  if (!a.stuckArrows) a.stuckArrows = [];
  if (a.stuckArrows.length >= 5) a.stuckArrows.shift();
  const airborne = (a.fy || 0) < -10; // duck hit mid-flight: arrow rides the body down
  const stickSpan = a.type === "bear" ? 24 : 12;
  a.stuckArrows.push({
    x: clamp(ar.x - a.x, -stickSpan, stickSpan),
    rel: airborne,
    y: airborne ? -10 : groundY - (a.type === "bear" ? 36 : 14),
    a: Math.atan2(ar.vy, ar.vx),
    weaponId: ar.weaponId || null,
    upgradeCol: ar.upgradeCol || null,
    upgradeRank: ar.upgradeRank || 0,
    t: stuckArrowLife(),
  });
}

// Ages out stuck arrows lodged in enemies/animals, and frozen arrows lying on the ground.
export function updateStuckArrows(dt) {
  const maxLife = stuckArrowLife();
  for (const e of state.enemies) {
    if (e.hunterMark > 0) e.hunterMark -= dt;
    if (!e.stuckArrows || !e.stuckArrows.length) continue;
    for (let i = e.stuckArrows.length - 1; i >= 0; i--) {
      if (e.stuckArrows[i].t > maxLife) e.stuckArrows[i].t = maxLife;
      e.stuckArrows[i].t -= dt;
      if (e.stuckArrows[i].t <= 0) e.stuckArrows.splice(i, 1);
    }
  }
  for (const a of state.animals) {
    if (!a.stuckArrows || !a.stuckArrows.length) continue;
    for (let i = a.stuckArrows.length - 1; i >= 0; i--) {
      if (a.stuckArrows[i].t > maxLife) a.stuckArrows[i].t = maxLife;
      a.stuckArrows[i].t -= dt;
      if (a.stuckArrows[i].t <= 0) a.stuckArrows.splice(i, 1);
    }
  }
}

function enemyDrawYOffset(e) {
  return e.type === "imp" && e.aiState === "stacking" && e.impStackY !== undefined ? e.impStackY : (e.fy || 0);
}

function playerBlastY(player) {
  const lift = entityWallLift(player) + (player.jumpH || 0) + playerMountLift(player);
  return groundY - 50 - lift;
}

function unitBlastY(u) {
  return groundY - 30 - entityWallLift(u) - (u.jumpH || 0);
}

function inAshBlast(ar, x, y, blastY, radius) {
  const dx = dist(ar.x, x);
  const dy = Math.abs(blastY - y);
  return Math.hypot(dx, dy * 0.65) < radius;
}

function detonateAshFireball(ar) {
  if (!ar.ashFireball || ar.ashBlastDone) return false;
  ar.ashBlastDone = true;

  const { player, units } = state;
  const radius = ar.splashRadius || ar.radius || 96;
  const dmg = Math.max(1, ar.dmg || 1);
  const blastY = Math.min(ar.y, groundY - 12);
  let hit = false;

  for (const u of units) {
    if (u.hp <= 0 || u.dying || u.mine) continue;
    const uy = unitBlastY(u);
    if (!inAshBlast(ar, u.x, uy, blastY, radius)) continue;
    u.hp -= dmg;
    u.flash = Math.max(u.flash || 0, 0.16);
    u.panic = Math.max(u.panic || 0, 1.1);
    u.knock = (u.knock || 0) + Math.sign(u.x - ar.x || 1) * 170;
    spawnParticles(u.x, uy, 14, "#ff6a20", 88, 100);
    spawnParticles(u.x, uy, 6, "#ffd060", 50, 105);
    floaty(u.x, "-" + dmg, "#ff6a4a");
    hit = true;
  }

  if (player && player.hp > 0 && !Game.inMine) {
    const py = playerBlastY(player);
    if (inAshBlast(ar, player.x, py, blastY, radius)) {
      const dealt = damagePlayer(dmg, { knock: Math.sign(player.x - ar.x || 1) * 210 });
      if (dealt !== null) {
        spawnParticles(player.x, py, 16, "#ff6a20", 92, 105);
        spawnParticles(player.x, py, 8, "#ffd060", 54, 115);
        hit = true;
      }
    }
  }

  spawnParticles(ar.x, blastY, 30, "#ff6a20", radius * 0.95, 135);
  spawnParticles(ar.x, blastY, 14, "#ffd060", radius * 0.55, 150);
  spawnParticles(ar.x, Math.min(blastY + 6, groundY - 6), 12, "#5a0710", radius * 0.7, 70);
  state.legendaryEffects.push({ type: "ring", x: ar.x, radius, life: 0.45, totalLife: 0.45, col: "#ff7a24", width: 6 });
  Game.screenShake = Math.max(Game.screenShake || 0, hit ? 0.46 : 0.34);
  Audio.hit();
  return hit;
}

export function shootArrow(x, y, target, sourceUnit = null, weaponId = null, opts = {}) {
  const targetType = target.type && ENEMY_TYPES[target.type];
  const airborne = (targetType && targetType.flying) || (target.fy || 0) < -10; // flying enemy or a duck on the wing
  const tx = target.x, ty = airborne ? groundY + (target.fy || -80) : groundY - 24;
  const dx = tx - x, dy = ty - y;
  const dist_h = Math.hypot(dx, dy);

  const projectileSpeed = opts.projectileSpeed || (weaponId === "crossbow" ? 620 : 400);
  const flightTime = Math.max(0.12, dist_h / projectileSpeed);
  const gravity = 420;

  let vx = dx / flightTime;
  let vy = (dy - 0.5 * gravity * flightTime * flightTime) / flightTime;

  // Archer units aren't perfectly accurate: slight random aim error, improving with level.
  if (sourceUnit && sourceUnit.role === "archer") {
    const level = sourceUnit.level || 1;
    const rangeMiss = clamp((dist_h - 260) / 620, 0, 1) * 0.2;
    const maxError = clamp(0.08 - level * 0.005 + rangeMiss, 0.018, 0.24); // radians
    const angErr = (Math.random() - 0.5) * 2 * maxError;
    const speed = Math.hypot(vx, vy);
    const ang = Math.atan2(vy, vx) + angErr;
    vx = Math.cos(ang) * speed;
    vy = Math.sin(ang) * speed;
  }

  // Archer units and player hold the arrow until the draw animation releases the string
  const delay = sourceUnit && (sourceUnit.role === "archer" || !sourceUnit.role) ? SHOOT_RELEASE_TIME : 0;

  const upgradeIds = sourceUnit?.weaponUpgrades ? sourceUnit.weaponUpgrades.map(u => u.id) : [];
  const frostArrow = upgradeIds.includes("frost_bow") || upgradeIds.includes("binding_arrows") || upgradeIds.includes("ice_explosion");
  const rootArrow = upgradeIds.includes("binding_arrows") || upgradeIds.includes("ice_explosion");

  state.arrows.push({
    x, y,
    vx: vx,
    vy: vy,
    target,
    life: opts.lifePadding !== undefined ? flightTime + opts.lifePadding : 1.2,
    hitKind: "enemy",
    sourceUnit,
    weaponId,
    delay,
    frostArrow,
    rootArrow,
  });
  if (!delay) Audio.bow();

  if (sourceUnit && sourceUnit.role === "archer") {
    startArcherShoot(sourceUnit);
  }

  if (weaponId === "dark_bow") spawnParticles(x, y, 8, "#880099", 40, 60);
  else if (weaponId === "void_bow") spawnParticles(x, y, 6, "#9933ff", 30, 50);
  else if (weaponId === "dragons_bow") { spawnParticles(x, y, 10, "#ff6620", 50, 80); spawnParticles(x, y, 5, "#ffcc40", 30, 60); }
  else if (weaponId === "crossbow") spawnParticles(x, y, 4, "#c8ccd4", 35, 30); // string snap kick
}

export function updateArrows(dt) {
  const { arrows, enemies, animals, player, units } = state;
  updateStuckArrows(dt);
  const maxStuckArrowLife = stuckArrowLife();
  for (let i = arrows.length - 1; i >= 0; i--) {
    const ar = arrows[i];
    if (ar.stuck) {
      if (ar.stuckTimer > maxStuckArrowLife) ar.stuckTimer = maxStuckArrowLife;
      ar.stuckTimer -= dt;
      if (ar.stuckTimer <= 0) arrows.splice(i, 1);
      continue;
    }
    if (ar.delay > 0) {
      ar.delay -= dt;
      if (ar.delay <= 0) { ar.delay = 0; Audio.bow(); }
      // Update arrow position during draw delay to track player/archer movement
      if (ar.sourceUnit) {
        ar.x = ar.sourceUnit.x;
        if (ar.sourceUnit === player) {
          const lift = entityWallLift(player) + (player.jumpH || 0) + playerMountLift(player);
          ar.y = groundY - 30 - lift;
        } else if (ar.sourceUnit.role === "archer") {
          const lift = entityWallLift(ar.sourceUnit) + (ar.sourceUnit.jumpH || 0);
          ar.y = groundY - 30 - lift;
        }
      }
      continue;
    }
    ar.x += ar.vx * dt; ar.y += ar.vy * dt; ar.vy += 420 * dt;
    if (ar.life !== undefined) ar.life -= dt;
    arrowTrail(ar);
    let hit = false;
    const expiresInAir = ar.enemyFireball || ar.hitKind === "base";

    if (ar.hitKind === "enemy") {
      for (const e of enemies) {
        if (e.fleeing) continue;
        if (ar._hitEnemies && ar._hitEnemies.has(e)) continue;
        const et = ENEMY_TYPES[e.type];
        const enemyDrawY = et.flying ? groundY + (e.fy || -80) : groundY - 24 + enemyDrawYOffset(e);
        if (dist(ar.x, e.x) < et.w * 0.7 && Math.abs(ar.y - enemyDrawY) < (et.dragon ? 85 : 40)) {
          if (e.dying) {
            // Piercing and ballista shots plow straight through corpses
            if (ar.pierce > 0 || ar.ballista) continue;
            stickArrowInEnemy(e, ar, enemyDrawY);
            hit = true;
            break;
          }
          const markBonus = ar.sourceUnit && e.hunterMark > 0 ? 1 : 0;
          if (ar.sourceUnit?.role === "archer" && state.archerSkills.includes("hunters_mark")) {
            if (!(e.hunterMark > 0)) spawnParticles(e.x, enemyDrawY - 18, 6, "#ff5a3a", 30, 45);
            e.hunterMark = 5;
          }
          const baseDmg = ((ar.dmgMult ? Math.round(ar.dmgMult) : 1) + markBonus) * permanentDamageMultiplier();
          const crit = applyCrit(baseDmg, CFG.critChance + (ar.critBonus || 0), CFG.critMultiplier);
          stickArrowInEnemy(e, ar, enemyDrawY);
          e.hp -= crit.damage; e.flash = 0.12; Audio.hit();
          if (crit.isCrit) critFloaty(e.x, crit.damage);
          else floaty(e.x, "-" + crit.damage, "#8a2a4a");
          spawnImpBlood(e, ar.powered || ar.ballista ? 1.7 : 1, enemyDrawY);
          if (ar.fireArrow) {
            e.burn = Math.max(e.burn || 0, 4);
            e.burnTick = 1;
            e.burnDmg = Math.max(e.burnDmg || 0, 1);
            e.ignited = true;
            spawnParticles(e.x, enemyDrawY, 12, "#ff6a20", 55, 70);
            spawnParticles(e.x, enemyDrawY, 7, "#ffd060", 35, 85);
          }
          if (ar.powered) {
            if (!et.noKnockback) e.knock = (e.knock||0) + (Math.sign(ar.vx) || 1) * 400;
            spawnParticles(e.x, enemyDrawY, 16, "#ffcc60", 90, 100);
            spawnParticles(e.x, enemyDrawY, 8, "#fff2b0", 55, 120);
            Game.screenShake = Math.max(Game.screenShake, 0.35);
          }
          if (ar.frostArrow) {
            e.frost = Math.max(e.frost || 0, 2.5);
            spawnParticles(e.x, enemyDrawY, 10, "#bfefff", 60, 70);
            spawnParticles(e.x, enemyDrawY, 5, "#ffffff", 35, 90);
          }
          if (ar.rootArrow) {
            e.rooted = Math.max(e.rooted || 0, 3);
            spawnParticles(e.x, enemyDrawY, 12, "#8fd8ff", 30, 60);
          }
          if (ar.weaponId === "dark_bow") {
            spawnParticles(e.x, enemyDrawY, 12, "#aa44cc", 70, 90);
            spawnParticles(e.x, enemyDrawY, 6, "#440066", 40, 50);
            Game.screenShake = Math.max(Game.screenShake, 0.3);
          } else if (ar.weaponId === "void_bow") {
            spawnParticles(e.x, enemyDrawY, 10, "#9933ff", 60, 80);
            spawnParticles(e.x, enemyDrawY, 6, "#ddaaff", 30, 110);
            Game.screenShake = Math.max(Game.screenShake, 0.35);
          } else if (ar.weaponId === "dragons_bow") {
            spawnParticles(e.x, enemyDrawY, 18, "#ff6820", 100, 120);
            spawnParticles(e.x, enemyDrawY, 10, "#ff2200", 70, 90);
            spawnParticles(e.x, enemyDrawY, 8, "#ffdd60", 50, 100);
            Game.screenShake = Math.max(Game.screenShake, 0.55);
          } else if (ar.weaponId === "crossbow") {
            spawnParticles(e.x, enemyDrawY, 7, "#c8ccd4", 55, 55);
            spawnParticles(e.x, enemyDrawY, 4, "#8a2a4a", 40, 45);
            Game.screenShake = Math.max(Game.screenShake, 0.1);
          } else if (ar.weaponId === "long_bow") {
            spawnParticles(e.x, enemyDrawY, 5, "#8a2a4a", 40, 50);
            spawnParticles(e.x, enemyDrawY, 3, "#e8e0c8", 25, 40);
          } else {
            spawnParticles(e.x, enemyDrawY, 4, "#8a2a4a");
          }
          if (ar.ballista) { spawnParticles(e.x, enemyDrawY, 14, "#cc8840", 90, 100); spawnParticles(e.x, enemyDrawY, 8, "#9aa2ae", 70, 60); Game.screenShake = Math.max(Game.screenShake, 0.4); if (!et.noKnockback) e.knock = (e.knock||0) + (Math.sign(ar.vx) || 1) * 500; }
          // Upgrade: Dragon's Roar / Null Point — the arrow detonates on impact
          if (ar.explosiveR) {
            const cols = ar.weaponId === "void_bow" ? ["#9933ff", "#ddaaff"] : ["#ff6820", "#ffcc40"];
            const burstDmg = Math.max(1, Math.round((ar.dmg || 1) * (ar.explosiveFrac || 0.8)));
            spawnParticles(ar.x, enemyDrawY, 18, cols[0], ar.explosiveR, 110);
            spawnParticles(ar.x, enemyDrawY, 10, cols[1], ar.explosiveR * 0.6, 130);
            Game.screenShake = Math.max(Game.screenShake, 0.35);
            Audio.explosion();
            for (const ne of enemies) {
              if (ne === e || ne.fleeing || ne.dying || ne.hp <= 0) continue;
              if (dist(ne.x, ar.x) > ar.explosiveR) continue;
              ne.hp -= burstDmg;
              ne.flash = 0.12;
              spawnImpBlood(ne, 0.7, groundY + (ne.fy || 0) - 24);
              floaty(ne.x, "-" + burstDmg, cols[0]);
              if (ne.hp <= 0) killEnemyWithAnimation(ne, Math.sign(ne.x - ar.x) || 1);
            }
          }
          // Upgrade: Event Horizon — the impact tears a rift that drags enemies in
          if (ar.gravityChance && Math.random() < ar.gravityChance) {
            spawnParticles(ar.x, enemyDrawY, 14, "#9933ff", 60, 80);
            spawnParticles(ar.x, enemyDrawY, 8, "#ddaaff", 30, 100);
            for (const ne of enemies) {
              if (ne === e || ne.fleeing || ne.dying || ne.hp <= 0) continue;
              const d = dist(ne.x, ar.x);
              if (d > 150 || d < 8) continue;
              if (!ENEMY_TYPES[ne.type]?.noKnockback) ne.knock = (ne.knock || 0) - Math.sign(ne.x - ar.x) * 260;
              spawnParticles(ne.x, groundY + (ne.fy || 0) - 24, 3, "#9933ff", 20, 30);
            }
            Game.screenShake = Math.max(Game.screenShake, 0.2);
          }
          if (ar.chainBounces) {
            const col = ar.upgradeCol || "#ccccff";
            spawnParticles(ar.x, enemyDrawY, 10, col, 52, 80);
            spawnParticles(ar.x, enemyDrawY, 5, "#ffffff", 30, 95);
            chainLightning(e.x, Math.max(1, crit.damage * 0.65), ar.chainBounces);
          }
          if (ar.pierce > 0) {
            if (!ar._hitEnemies) ar._hitEnemies = new Set();
            ar._hitEnemies.add(e);
            ar.pierce--;
            hit = false;
          } else {
            hit = true;
          }
          if (ar.bouncing && ar.sourceUnit) {
            ar.bouncing = false; // one ricochet per arrow
            let nextTgt = null, nd = 400;
            for (const ne of enemies) {
              if (ne === e || ne.fleeing || ne.dying || ne.hp <= 0) continue;
              const d = dist(ar.x, ne.x); if (d < nd) { nd = d; nextTgt = ne; }
            }
            if (nextTgt) {
              const net = ENEMY_TYPES[nextTgt.type];
              const nty = net && net.flying ? groundY + (nextTgt.fy || -80) : groundY - 24;
              const ang = Math.atan2(nty - ar.y, nextTgt.x - ar.x);
              spawnParticles(ar.x, ar.y, 6, "#ffe9a0", 50, 60);
              state.arrows.push({
                x: ar.x, y: ar.y, vx: Math.cos(ang)*480, vy: Math.sin(ang)*480 - 40,
                target: nextTgt, life: 1.0, hitKind: "enemy", sourceUnit: ar.sourceUnit,
                fireArrow: ar.fireArrow, frostArrow: ar.frostArrow, rootArrow: ar.rootArrow,
                bouncing: false, pierce: 0, weaponId: ar.weaponId,
                dmg: ar.dmg, dmgMult: ar.dmgMult, critBonus: ar.critBonus,
                playerShot: ar.playerShot, powered: ar.powered,
                explosiveR: ar.explosiveR, explosiveFrac: ar.explosiveFrac,
                gravityChance: ar.gravityChance, chainBounces: ar.chainBounces,
                healOnKill: ar.healOnKill, goldOnKill: ar.goldOnKill, barrierOnKill: ar.barrierOnKill,
                upgradeCol: ar.upgradeCol, upgradeRank: ar.upgradeRank,
                _hitEnemies: new Set([e]), // never re-hit the enemy it bounced off
              });
            }
          }
          if (e.hp <= 0) {
            if (ar.sourceUnit?.role === "archer") {
              ar.sourceUnit.xp = (ar.sourceUnit.xp || 0) + 1;
              const xpNeeded = (ar.sourceUnit.level || 1) * 3;
              if (ar.sourceUnit.xp >= xpNeeded) {
                ar.sourceUnit.xp -= xpNeeded;
                ar.sourceUnit.level = (ar.sourceUnit.level || 1) + 1;
                addSkillPoints("archer", 1);
                spawnLevelUpBeam(ar.sourceUnit.x);
                if (ar.barrierOnKill) grantArrowBarrier(ar.barrierOnKill, ar.upgradeCol || "#ffffff");
              }
              const knockDir = Math.sign(e.x - ar.x) || 1;
              killEnemyWithAnimation(e, knockDir);
            } else {
              // Soul Reaper / golden fortune: player arrow kills pay off
              if (ar.playerShot) {
                if (ar.healOnKill && player.hp < player.maxHp && Math.random() < ar.healOnKill) {
                  player.hp = Math.min(player.maxHp, player.hp + 1);
                  floaty(player.x, "+1❤", "#7be87b");
                  spawnParticles(player.x, groundY - 40, 8, "#7be87b", 40, 70);
                }
                if (ar.goldOnKill && Math.random() < ar.goldOnKill) {
                  const g = spawnGoldReward(e.x, 2, "hunt", { spreadX: 12, fromY: groundY - 24, vyMin: 120, vyMax: 200 });
                  if (g > 0) floaty(e.x + 14, "+" + g + "🪙", "#f2c14e");
                }
              }
              const knockDir = Math.sign(e.x - ar.x) || 1;
              killEnemyWithAnimation(e, knockDir);
            }
          }
          if (hit) break;
        }
      }
    }

    if (!hit && ar.hitKind === "enemy") {
      for (const a of animals) {
        const airborne = (a.fy || 0) < -10;
        const inY = airborne ? Math.abs(ar.y - (groundY + a.fy)) < 24 : ar.y > groundY - (a.type === "bear" ? 62 : 36);
        if (a.alive && !a.dying && dist(ar.x, a.x) < (a.type === "bear" ? 34 : 16) && inY) {
          stickArrowInAnimal(a, ar);
          if (a.type === "bear") {
            // Bears are tough: they take arrow damage instead of dying outright
            a.hp -= ar.dmg || 1; a.flash = 0.15;
            spawnParticles(a.x, groundY - 30, 5, "#8a2a2a");
            if (a.hp > 0) { hit = true; break; }
          }
          a.dying = true; a.deathT = 0;
          spawnParticles(a.x, groundY + (a.fy || 0) - 20, 8, airborne ? "#c9c2b4" : "#7a4a2a");
          const reward = a.type === "bear" ? 8 : a.type === "deer" ? 3 : a.type === "duck" ? 2 : 1;
          const actual = spawnGoldReward(a.x, reward, "hunt", { spreadX: 15, fromY: groundY - 20, vx: 50, vyMin: 120, vyMax: 220 });
          if (actual > 0) floaty(a.x, "+" + actual + "🪙", "#f2c14e");
          hit = true; break;
        }
      }
    }

    if (!hit && ar.hitKind === "player" && !Game.inMine) {
      const playerY = playerBlastY(player);
      const hitRadius = ar.ashFireball ? (ar.radius || 54) : 18;
      const hitHeight = ar.ashFireball ? 62 : 50;
      if (dist(ar.x, player.x) < hitRadius && Math.abs(ar.y - playerY) < hitHeight) {
        if (ar.ashFireball) {
          detonateAshFireball(ar);
        } else if (damagePlayer(ar.dmg || 1, { knock: (player.x < ar.x ? -1 : 1) * -120 }) !== null && ar.enemyFireball) {
          spawnParticles(player.x, playerY, 16, ar.voidBolt ? "#8a5aff" : "#ff6a20", 85, 95);
          spawnParticles(player.x, playerY, 8, ar.voidBolt ? "#d7f6ff" : "#ffd060", 50, 90);
          Game.screenShake = Math.max(Game.screenShake, 0.22);
        }
        hit = true;
      }
    }

    if (!hit && ar.hitKind === "unit") {
      for (const u of units) {
        if (u.hp <= 0 || u.dying || u.mine) continue;
        const uy = unitBlastY(u);
        const hitHeight = ar.ashFireball ? 62 : 46;
        if (dist(ar.x, u.x) < (ar.radius || 22) && Math.abs(ar.y - uy) < hitHeight) {
          if (ar.ashFireball) {
            detonateAshFireball(ar);
          } else {
            u.hp -= ar.dmg || 1;
            u.panic = 0.9;
            u.knock = (u.knock || 0) + Math.sign(u.x - ar.x || 1) * 90;
            spawnParticles(u.x, uy, 14, ar.voidBolt ? "#8a5aff" : "#ff6a20", 75, 90);
            spawnParticles(u.x, uy, 6, ar.voidBolt ? "#d7f6ff" : "#ffd060", 42, 80);
            Game.screenShake = Math.max(Game.screenShake, 0.18);
            Audio.hit();
          }
          hit = true;
          break;
        }
      }
    }

    if (!hit && ar.hitKind === "base" && (ar.y > groundY - 8 || ar.life <= 0)) {
      const base = state.base;
      const r = ar.radius || 90;
      if (dist(ar.x, base.x) < r + 40) {
        base.hp -= ar.dmg || 6; base.flash = 0.3;
        floaty(base.x, `-${ar.dmg || 6}🔥`, "#ff6a4a");
        if (base.hp < 0) base.hp = 0;
      }
      for (const u of units) {
        if (u.hp <= 0 || u.dying || u.mine) continue;
        if (dist(ar.x, u.x) < r * 0.7) {
          u.hp -= 1; u.panic = 1;
          u.knock = (u.knock || 0) + Math.sign(u.x - ar.x || 1) * 130;
        }
      }
      if (dist(ar.x, player.x) < r * 0.6 && (player.jumpH || 0) + entityWallLift(player) <= 20) {
        damagePlayer(1, { knock: (player.x < ar.x ? -1 : 1) * 160 });
      }
      spawnParticles(ar.x, groundY - 14, 26, ar.voidBolt ? "#8a5aff" : "#ff6a20", 140, 120);
      spawnParticles(ar.x, groundY - 14, 12, ar.voidBolt ? "#d7f6ff" : "#ffd060", 85, 130);
      spawnParticles(ar.x, groundY - 10, 8, ar.voidBolt ? "#160a38" : "#5a0710", 90, 60);
      if (ar.voidBolt) spawnVoidPool(ar.x, Math.max(58, r * 0.62), 4.2, { pull: true });
      Game.screenShake = Math.max(Game.screenShake, 0.4);
      Audio.hit();
      hit = true;
    }

    if (ar.enemyFireball && (hit || ar.life <= 0 || ar.y > groundY - 6)) {
      if (ar.ashFireball) detonateAshFireball(ar);
      const impactRadius = ar.ashFireball ? (ar.splashRadius || 96) : 80;
      spawnParticles(ar.x, Math.min(ar.y, groundY - 8), ar.ashFireball ? 22 : 16, ar.voidBolt ? "#8a5aff" : "#ff6a20", impactRadius, 90);
      spawnParticles(ar.x, Math.min(ar.y, groundY - 8), ar.ashFireball ? 10 : 7, ar.voidBolt ? "#d7f6ff" : "#ffd060", impactRadius * 0.55, 80);
      // Magma boulders splash into a burning pool that lingers on the ground
      if (ar.magma) spawnFirePool(ar.x);
      if (ar.voidBolt && ar.hitKind !== "base") spawnVoidPool(ar.x, ar.big ? 72 : 48, ar.big ? 4.2 : 2.6, { pull: !!ar.big });
    }
    if (hit || (expiresInAir && ar.life <= 0) || ar.y > groundY - 6) {
      // Real arrows (not fireballs/magma/base impacts) freeze in place so it's clear where they landed.
      if (!ar.enemyFireball && !hit) {
        ar.stuck = true;
        ar.stuckTimer = maxStuckArrowLife;
        ar.frozenAngle = Math.atan2(ar.vy, ar.vx);
        ar.y = Math.min(ar.y, groundY - 4);
        ar.vx = 0; ar.vy = 0;
      } else {
        arrows.splice(i, 1);
      }
    }
  }
}
