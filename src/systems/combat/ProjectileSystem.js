import { CFG } from '../../config/config.js';
import { ENEMY_TYPES } from '../../config/enemies.js?v=biomeactive1';
import { clamp, dist, rand, applyCrit } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnGoldReward, spawnParticles, floaty, critFloaty } from '../world/SpawnSystem.js?v=biomeactive1';
import { spawnLevelUpBeam } from '../../rendering/Effects.js?v=biomeactive1';
import { killEnemy, killEnemyWithAnimation, spawnImpBlood } from '../../util/EnemyUtils.js?v=biomeactive1';
import { startArcherShoot, SHOOT_RELEASE_TIME } from '../../rendering/sprites/Archer.js';
import { entityWallLift } from '../../entities/Wall.js';
import { permanentDamageMultiplier } from '../infrastructure/RoguelikeSystem.js';
import { spawnFirePool, spawnVoidPool } from '../ai/BossAI.js?v=biomeactive1';
import { damagePlayer } from './PlayerCombat.js?v=biomeactive1';
import { chainLightning } from './SpellSystem.js?v=biomeactive1';
import { addSkillPoints } from '../economy/SkillSystem.js';
import { playerMountLift } from '../economy/MountSystem.js';
import { animalDef } from '../../config/animals.js';

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
  if (ar.splinterCount) {
    if (Math.random() < 0.65) spawnParticles(ar.x, ar.y, 1, "#8fd05a", 10, 10);
  }
  if (ar.poisonArrow) {
    spawnParticles(ar.x, ar.y, 1, "#7fe05a", 10, 12);
    if (Math.random() < 0.35) spawnParticles(ar.x, ar.y, 1, "#b8ff7a", 6, 16);
  }
  if (ar.sandBlind) {
    spawnParticles(ar.x, ar.y, 2, "#d8b46a", 16, 10);
    if (Math.random() < 0.45) spawnParticles(ar.x, ar.y, 1, "#ffe0a0", 9, 12);
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
  } else if (ar.weaponId === "acid_blowgun") {
    if (Math.random() < 0.65) spawnParticles(ar.x, ar.y, 1, "#7fe05a", 9, 8);
  } else if (ar.weaponId === "sandstorm_sling") {
    if (Math.random() < 0.65) spawnParticles(ar.x, ar.y, 1, "#d8b46a", 10, 8);
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

let currentStuckArrowLife = STUCK_ARROW_LIFE;

function refreshStuckArrowLife() {
  const archerPressure = clamp(aliveArcherCount() / ARCHERS_FOR_MIN_ARROW_LIFE, 0, 1);
  currentStuckArrowLife = STUCK_ARROW_LIFE - (STUCK_ARROW_LIFE - MIN_STUCK_ARROW_LIFE) * archerPressure;
  return currentStuckArrowLife;
}

function stuckArrowLife() {
  return currentStuckArrowLife;
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
  const drawYOff = e.fy || 0;
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
  const def = animalDef(a.type);
  const airborne = (a.fy || 0) < -10; // duck hit mid-flight: arrow rides the body down
  const stickSpan = def.stuckSpan || (a.type === "bear" ? 24 : 12);
  a.stuckArrows.push({
    x: clamp(ar.x - a.x, -stickSpan, stickSpan),
    rel: airborne,
    y: airborne ? -10 : groundY - Math.max(12, (def.hitHeight || 36) * 0.58),
    a: Math.atan2(ar.vy, ar.vx),
    weaponId: ar.weaponId || null,
    upgradeCol: ar.upgradeCol || null,
    upgradeRank: ar.upgradeRank || 0,
    t: stuckArrowLife(),
  });
}

// Ages out stuck arrows lodged in enemies/animals, and frozen arrows lying on the ground.
export function updateStuckArrows(dt, maxLife = stuckArrowLife()) {
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
  return e.fy || 0;
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

const ARROW_ENEMY_SCAN_X = 180;

function buildEnemyXIndex(enemies) {
  const indexed = [];
  for (const e of enemies) {
    if (e.fleeing || !Number.isFinite(e.x)) continue;
    indexed.push(e);
  }
  indexed.sort((a, b) => a.x - b.x);
  return indexed;
}

function enemyIndexStart(index, minX) {
  let lo = 0, hi = index.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (index[mid].x < minX) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function poisonEnemy(e, seconds, dmg = 1) {
  if (!e || !seconds) return;
  e.poison = Math.max(e.poison || 0, seconds);
  e.poisonTick = Math.min(e.poisonTick || 1, 0.55);
  e.poisonDmg = Math.max(e.poisonDmg || 0, dmg || 1);
}

function spawnAcidPool(x, strength = 1) {
  if (!state.firePools) state.firePools = [];
  const life = 2.4 + strength * 0.45;
  state.firePools.push({
    x,
    r: 46 + strength * 18,
    life,
    maxLife: life,
    tick: rand(0.3, 0.55),
    ph: rand(0, 6),
    source: "player",
    kind: "acid",
    dmg: 1,
    burnDmg: 1,
    col: "#7fe05a",
  });
}

function blindDustBurst(ar, primary, index, y) {
  const radius = ar.sandBlindRadius || 80;
  const count = ar.sandBlind || 1;
  let blinded = 0;
  spawnParticles(ar.x, y, 16, "#d8b46a", radius, 80);
  spawnParticles(ar.x, y, 8, "#ffe0a0", radius * 0.55, 95);
  const start = enemyIndexStart(index, ar.x - radius);
  for (let ni = start; ni < index.length; ni++) {
    const ne = index[ni];
    if (ne.x > ar.x + radius) break;
    if (ne.fleeing || ne.dying || ne.hp <= 0 || dist(ne.x, ar.x) > radius) continue;
    ne.blindedHits = Math.max(ne.blindedHits || 0, count);
    ne.blind = Math.max(ne.blind || 0, 3.2);
    ne.slow = Math.max(ne.slow || 0, ar.slowHit || 0.45);
    blinded++;
  }
  if (blinded > 0) floaty(primary.x, "Blinded x" + blinded, "#d8b46a");
}

function splinterArrowBurst(ar, primary, index, damage, y) {
  const count = ar.splinterCount || 0;
  if (!count) return;
  const radius = ar.splinterRadius || 135;
  const splinterDmg = Math.max(1, Math.round(damage * (ar.splinterDmgFrac || 0.4)));
  let hit = 0;
  spawnParticles(primary.x, y, 14, "#8fd05a", radius * 0.55, 85);
  spawnParticles(primary.x, y, 8, "#d2b07a", radius * 0.4, 70);
  const start = enemyIndexStart(index, primary.x - radius);
  for (let ni = start; ni < index.length && hit < count; ni++) {
    const ne = index[ni];
    if (ne.x > primary.x + radius) break;
    if (ne === primary || ne.fleeing || ne.dying || ne.hp <= 0 || dist(ne.x, primary.x) > radius) continue;
    ne.hp -= splinterDmg;
    ne.flash = Math.max(ne.flash || 0, 0.12);
    if (ar.rootArrow) ne.rooted = Math.max(ne.rooted || 0, 1.5);
    spawnParticles(ne.x, groundY + (ne.fy || 0) - 24, 7, "#8fd05a", 40, 56);
    spawnImpBlood(ne, 0.55 + splinterDmg * 0.05, groundY + (ne.fy || 0) - 24);
    floaty(ne.x, "-" + splinterDmg, "#8fd05a");
    if (ne.hp <= 0) killEnemyWithAnimation(ne, Math.sign(ne.x - primary.x) || 1);
    hit++;
  }
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
    if (u.hp <= 0 || u.dying) continue;
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

  if (player && player.hp > 0) {
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
  else if (weaponId === "splinter_bow") spawnParticles(x, y, 7, "#8fd05a", 35, 45);
  else if (weaponId === "sandstorm_sling") spawnParticles(x, y, 7, "#d8b46a", 42, 38);
  else if (weaponId === "acid_blowgun") spawnParticles(x, y, 5, "#7fe05a", 30, 38);
}

export function updateArrows(dt) {
  const { arrows, enemies, animals, player, units } = state;
  const maxStuckArrowLife = refreshStuckArrowLife();
  updateStuckArrows(dt, maxStuckArrowLife);
  const enemyXIndex = arrows.length ? buildEnemyXIndex(enemies) : [];
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
      const minX = ar.x - ARROW_ENEMY_SCAN_X;
      const maxX = ar.x + ARROW_ENEMY_SCAN_X;
      for (let ei = enemyIndexStart(enemyXIndex, minX); ei < enemyXIndex.length; ei++) {
        const e = enemyXIndex[ei];
        if (e.x > maxX) break;
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
          // Siege Imp's plank shield deflects frontal arrows — unless it's
          // mid-ram (shield lowered), or the shot is a ballista bolt/powershot
          // heavy enough to punch through. Flank it or shoot the back.
          if (et.shieldBlock && !e.shieldDown && !ar.ballista && !ar.powered &&
              (ar.x - e.x) * (e.dir || 1) > -4) {
            spawnParticles(ar.x, enemyDrawY, 5, "#c9b48a", 42, 44);
            spawnParticles(ar.x, enemyDrawY, 3, "#9aa2ae", 30, 52);
            Audio.hit();
            hit = true;
            break;
          }
          if (et.arrowHeavyOnly && !ar.ballista && !ar.powered) {
            spawnParticles(ar.x, enemyDrawY, 6, et.eye || "#ff6a28", 42, 40);
            spawnParticles(ar.x, enemyDrawY, 4, "#111018", 32, 36);
            floaty(e.x, "Deflected", et.eye || "#ff6a28", 12);
            Audio.hit();
            hit = true;
            break;
          }
          if (et.arrowFarImmuneRange && !ar.ballista && !ar.powered && ar.sourceUnit
              && dist(ar.sourceUnit.x || ar.x, e.x) > et.arrowFarImmuneRange) {
            spawnParticles(ar.x, enemyDrawY, 8, "#d8b46a", 58, 42);
            floaty(e.x, "Dust veil", "#d8b46a", 12);
            Audio.hit();
            hit = true;
            break;
          }
          if (et.arrowArmor && !ar.ballista && !ar.powered && (e.arrowArmor ?? et.arrowArmor) > 0) {
            e.arrowArmor = (e.arrowArmor ?? et.arrowArmor) - 1;
            e.flash = 0.1;
            spawnParticles(ar.x, enemyDrawY, 7, "#8a5a30", 44, 42);
            if (e.arrowArmor <= 0) floaty(e.x, "Mask cracked", "#f2c14e", 12);
            Audio.hit();
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
          if (ar.slowHit) e.slow = Math.max(e.slow || 0, ar.slowHit);
          if (ar.poisonArrow) {
            poisonEnemy(e, ar.poisonArrow, ar.poisonDmg || 1);
            spawnParticles(e.x, enemyDrawY, 12, "#7fe05a", 58, 70);
            spawnParticles(e.x, enemyDrawY, 5, "#b8ff7a", 32, 80);
          }
          if (ar.sandBlind) blindDustBurst(ar, e, enemyXIndex, enemyDrawY);
          if (ar.splinterCount) splinterArrowBurst(ar, e, enemyXIndex, crit.damage, enemyDrawY);
          if (ar.acidPool) spawnAcidPool(ar.x, ar.acidPool);
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
          } else if (ar.weaponId === "splinter_bow") {
            spawnParticles(e.x, enemyDrawY, 10, "#8fd05a", 62, 75);
            spawnParticles(e.x, enemyDrawY, 5, "#d2b07a", 42, 55);
          } else if (ar.weaponId === "sandstorm_sling") {
            spawnParticles(e.x, enemyDrawY, 12, "#d8b46a", 68, 65);
            spawnParticles(e.x, enemyDrawY, 6, "#ffe0a0", 42, 75);
          } else if (ar.weaponId === "acid_blowgun") {
            spawnParticles(e.x, enemyDrawY, 10, "#7fe05a", 58, 75);
            spawnParticles(e.x, enemyDrawY, 5, "#b8ff7a", 36, 85);
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
            const blastStart = enemyIndexStart(enemyXIndex, ar.x - ar.explosiveR);
            for (let ni = blastStart; ni < enemyXIndex.length; ni++) {
              const ne = enemyXIndex[ni];
              if (ne.x > ar.x + ar.explosiveR) break;
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
            const gravityRadius = 150;
            const gravityStart = enemyIndexStart(enemyXIndex, ar.x - gravityRadius);
            for (let ni = gravityStart; ni < enemyXIndex.length; ni++) {
              const ne = enemyXIndex[ni];
              if (ne.x > ar.x + gravityRadius) break;
              if (ne === e || ne.fleeing || ne.dying || ne.hp <= 0) continue;
              const d = dist(ne.x, ar.x);
              if (d > gravityRadius || d < 8) continue;
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
            const bounceStart = enemyIndexStart(enemyXIndex, ar.x - nd);
            for (let ni = bounceStart; ni < enemyXIndex.length; ni++) {
              const ne = enemyXIndex[ni];
              if (ne.x > ar.x + nd) break;
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
                splinterCount: ar.splinterCount, splinterRadius: ar.splinterRadius, splinterDmgFrac: ar.splinterDmgFrac,
                poisonArrow: ar.poisonArrow, poisonDmg: ar.poisonDmg, acidPool: ar.acidPool,
                sandBlind: ar.sandBlind, sandBlindRadius: ar.sandBlindRadius, slowHit: ar.slowHit,
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
        const def = animalDef(a.type);
        const airborne = (a.fy || 0) < -10;
        const hitHeight = def.hitHeight || (a.type === "bear" ? 62 : 36);
        const inY = airborne ? Math.abs(ar.y - (groundY + a.fy)) < Math.max(22, hitHeight * 0.82) : ar.y > groundY - hitHeight;
        if (a.alive && !a.dying && dist(ar.x, a.x) < (def.hitRadius || (a.type === "bear" ? 34 : 16)) && inY) {
          stickArrowInAnimal(a, ar);
          if (a.type === "bear") {
            // Bears are tough: they take arrow damage instead of dying outright
            a.hp -= ar.dmg || 1; a.flash = 0.15;
            spawnParticles(a.x, groundY - 30, 5, "#8a2a2a");
            if (a.hp > 0) { hit = true; break; }
          }
          a.dying = true; a.deathT = 0;
          spawnParticles(a.x, groundY + (a.fy || 0) - 20, 8, airborne ? "#c9c2b4" : (def.blood || "#7a4a2a"));
          const reward = def.reward || 1;
          const actual = spawnGoldReward(a.x, reward, "hunt", { spreadX: 15, fromY: groundY - 20, vx: 50, vyMin: 120, vyMax: 220 });
          if (actual > 0) floaty(a.x, "+" + actual + "🪙", "#f2c14e");
          hit = true; break;
        }
      }
    }

    if (!hit && ar.hitKind === "player") {
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
        if (u.hp <= 0 || u.dying) continue;
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
        if (u.hp <= 0 || u.dying) continue;
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
