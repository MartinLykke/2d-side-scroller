import { CFG } from '../../config/config.js';
import { dist, rand, applyCrit } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnParticles, floaty, spawnEnemy } from '../world/SpawnSystem.js';
import { killEnemyWithAnimation } from '../../util/EnemyUtils.js';
import { entityWallLift, wallHeight, wallReady, wallRenderWidth } from '../../entities/Wall.js';
import { damagePlayer } from '../combat/PlayerCombat.js';

// All night-boss behavior lives here: the fire dragon (night 5), the magma
// colossus (night 10) and the ground hazards they leave behind. EnemyAI
// dispatches into updateBoss() so its own loop only handles regular enemies.

export function updateBoss(e, t, dt) {
  if (t.voidTitan)  { updateVoidTitan(e, t, dt); return true; }
  if (t.voidSeraph) { updateVoidSeraph(e, t, dt); return true; }
  if (t.dragon) { updateFireDragon(e, t, dt); return true; }
  if (t.golem)  { updateMagmaGolem(e, t, dt); return true; }
  return false;
}

// ---------- Fire dragon (night 5) ----------

// Imps riding on the dragon hop off over the base; also used when it dies.
export function dropRiderFromDragon(e) {
  e.ridingDragon = null;
  e.riderSeat = undefined;
  e.leftStack = true;      // reuse the imp wall-drop gravity so it falls to the ground
  e.hasLeftStack = false;
  e.vy = 0;
  e.breachedWall = true;   // dropped inside the defenses: hunt guards/archers/base directly
  e.aiState = "advance";
}

function updateFireDragon(e, t, dt) {
  const { base } = state;
  const hover = -(185 + Math.sin(e.anim * 0.7) * 16);
  e.fy = (e.fy ?? hover) + (hover - (e.fy ?? hover)) * Math.min(1, dt * 1.6);

  // Fly side to side across the base until dead
  const L = CFG.baseX - 560, R = CFG.baseX + 560;
  if (!e.patrolDir) e.patrolDir = e.x < CFG.baseX ? 1 : -1;
  e.x += e.patrolDir * t.speed * dt;
  if (e.x > R) e.patrolDir = -1;
  if (e.x < L) e.patrolDir = 1;
  e.dir = e.patrolDir;

  if (Math.random() < 0.5)
    spawnParticles(e.x - e.dir * 50 + rand(-30, 30), groundY + e.fy + rand(-16, 22), 1, "#ff6a20", 22, 26);

  // Breathe a huge fireball from the mouth toward the base
  if (e.shootCd <= 0 && Math.abs(e.x - base.x) < 760) {
    const mouthX = e.x + e.dir * t.w * 0.62;
    const mouthY = groundY + e.fy - 26;
    const dx = base.x + rand(-45, 45) - mouthX;
    const flightT = Math.max(0.6, Math.min(1.4, Math.abs(dx) / 380));
    const dy = (groundY - 24) - mouthY;
    state.arrows.push({
      x: mouthX, y: mouthY,
      vx: dx / flightT,
      vy: (dy - 0.5 * 420 * flightT * flightT) / flightT,
      life: flightT + 0.4,
      hitKind: "base", enemyFireball: true, big: true,
      dmg: t.dmg, radius: 95,
    });
    e.shootCd = (t.shootInterval || 2.6) + rand(-0.4, 0.6);
    e.attackAnim = 0.45;
    spawnParticles(mouthX, mouthY, 14, "#ff6a20", 60, 50);
    spawnParticles(mouthX, mouthY, 7, "#ffd060", 34, 60);
    Game.screenShake = Math.max(Game.screenShake || 0, 0.12);
    Audio.fireball();
  }

  // Periodically drop a rider imp over the defenses
  e.dropCd = (e.dropCd ?? rand(2.5, 4)) - dt;
  if (e.dropCd <= 0) {
    if (Math.abs(e.x - base.x) < 520) {
      const riders = state.enemies.filter(r => r.ridingDragon === e && !r.dying);
      if (riders.length) {
        dropRiderFromDragon(riders[riders.length - 1]);
      }
      e.dropCd = rand(3, 5);
    } else {
      e.dropCd = 0.5;
    }
  }
}

// ---------- Magma colossus (night 10) ----------
//
// Ground boss with three mechanics:
//  1. Obsidian shell: cycles between armored (takes 35% damage) and an exposed
//     molten core (takes 160% damage). Modulated by tracking hp deltas so it
//     works uniformly for arrows, melee, spells and towers.
//  2. Vulkansk Nedslag: winds up and slams walls/base/player, sending a ground
//     shockwave that damages and knocks back everything nearby.
//  3. Magma volley: hurls arcs of magma boulders at the base that leave
//     burning fire pools on the ground.
// Below 35% HP it erupts once: faster, angrier, and it vents flying imps.

const GOLEM_ARMOR_TIME  = 7;
const GOLEM_CORE_TIME   = 3.5;
const GOLEM_SLAM_RANGE  = 92;
const GOLEM_SLAM_WINDUP = 0.85;
const GOLEM_SHOCK_RANGE = 170;
const GOLEM_WALL_CONTACT_PAD = 7;
const GOLEM_WALL_ATTACKS = {
  ram:   { impact: 0.48, duration: 1.12, damageMult: 1.0,  impactTime: 0.18, recoverTime: 0.48 },
  crush: { impact: 0.78, duration: 1.42, damageMult: 1.42, impactTime: 0.22, recoverTime: 0.58 },
};

// Bosses bypass EnemyAI's ordinary wall block so their custom behavior can
// own movement. Keep the selection here as well: the nearest intact wall on
// the boss's current side is always the first defense it must breach.
function golemWallAhead(e) {
  const side = e.x < CFG.baseX ? -1 : 1;
  let best = null;
  for (const w of state.walls) {
    if (!wallReady(w) || w.side !== side) continue;
    if (side < 0) {
      if (w.x < e.x || w.x >= CFG.baseX) continue;
      if (!best || w.x < best.x) best = w;
    } else {
      if (w.x > e.x || w.x <= CFG.baseX) continue;
      if (!best || w.x > best.x) best = w;
    }
  }
  return best;
}

function golemWallStandX(w, t) {
  const bodyClearance = wallRenderWidth(w) * 0.5 + t.w * 0.48 + GOLEM_WALL_CONTACT_PAD;
  return w.x + w.side * bodyClearance;
}

function damageGolemSiegeWall(e, t, w, kind) {
  if (!wallReady(w)) return;
  const attack = GOLEM_WALL_ATTACKS[kind] || GOLEM_WALL_ATTACKS.ram;
  const crit = applyCrit(t.dmg * attack.damageMult, CFG.critChance, CFG.critMultiplier);
  const faceX = w.x + w.side * (wallRenderWidth(w) * 0.48);
  const impactY = groundY - wallHeight(w) * (kind === 'crush' ? 0.74 : 0.48);

  w.hp -= crit.damage;
  w.flash = Math.max(w.flash || 0, 0.24);
  w.golemImpact = Math.max(w.golemImpact || 0, kind === 'crush' ? 0.42 : 0.32);
  w.golemImpactKind = kind;
  e.golemWallImpact = attack.impactTime;
  e.golemWallRecover = attack.recoverTime;
  e.attackAnim = 0.38;
  Game.screenShake = Math.max(Game.screenShake || 0, kind === 'crush' ? 0.58 : 0.38);

  spawnParticles(faceX, impactY, kind === 'crush' ? 22 : 14, '#caa46a', kind === 'crush' ? 150 : 110, kind === 'crush' ? 128 : 92);
  spawnParticles(faceX, impactY, kind === 'crush' ? 10 : 6, '#ff6a20', 76, 72);
  if (kind === 'crush') spawnParticles(faceX, impactY - 12, 5, '#ffd060', 54, 80);
  floaty(w.x, `-${Math.round(crit.damage)}`, '#ff6a4a', 17);
  Audio.hit();

  if (w.hp <= 0) killWallByBoss(w);
}

function startGolemWallAttack(e, w) {
  const index = e.golemWallAttackIndex || 0;
  const kind = index % 2 === 0 ? 'ram' : 'crush';
  e.golemWallAttackIndex = index + 1;
  e.golemSiegeWall = w;
  e.golemWallAttackKind = kind;
  e.golemWallAttackT = 0;
  e.golemWallDidHit = false;
  e.golemWallImpact = 0;
  e.golemWallRecover = 0;
  e.attackKind = kind === 'ram' ? 'wallRam' : 'wallCrush';
  e.hurlCount = 0;
  e.golemHurlCharge = 0;
  e.golemHurlRelease = 0;
  e.coreFlare = Math.max(e.coreFlare || 0, kind === 'crush' ? 0.42 : 0.24);
}

function updateGolemWallAttack(e, t, dt) {
  const kind = e.golemWallAttackKind || 'ram';
  const attack = GOLEM_WALL_ATTACKS[kind] || GOLEM_WALL_ATTACKS.ram;
  e.golemWallAttackT += dt;

  if (!e.golemWallDidHit && e.golemWallAttackT >= attack.impact) {
    e.golemWallDidHit = true;
    damageGolemSiegeWall(e, t, e.golemSiegeWall, kind);
  }

  if (e.golemWallAttackT >= attack.duration) {
    e.golemWallAttackT = undefined;
    e.golemWallAttackKind = '';
    e.golemWallDidHit = false;
    e.golemSiegeWall = null;
    e.golemWallAttackCooldown = 0.3;
    if (e.attackKind === 'wallRam' || e.attackKind === 'wallCrush') e.attackKind = '';
  }
}

function golemShockwave(e, t) {
  const { player } = state;
  Game.screenShake = Math.max(Game.screenShake || 0, 0.55);
  spawnParticles(e.x, groundY - 6, 26, "#6b5a45", 200, 130);
  spawnParticles(e.x, groundY - 8, 16, "#ff6a20", 150, 110);
  spawnParticles(e.x, groundY - 8, 8, "#ffd060", 90, 130);
  Audio.hit();

  if (player && dist(e.x, player.x) < GOLEM_SHOCK_RANGE
      && (player.jumpH || 0) + entityWallLift(player) <= 30) {
    damagePlayer(t.meleeDmg || 2, { knock: Math.sign(player.x - e.x || 1) * 300 });
  }
  for (const u of state.units) {
    if (u.hp <= 0 || u.dying || u.onWall || u.mine) continue;
    if (dist(e.x, u.x) < GOLEM_SHOCK_RANGE) {
      u.hp -= 2;
      u.panic = 1;
      u.knock = (u.knock || 0) + Math.sign(u.x - e.x || 1) * 220;
    }
  }
}

function golemSlamTarget(e, includeWalls = true) {
  const { base, player, walls } = state;
  if (includeWalls) {
    for (const w of walls) {
      if (w.commissioned && w.hp > 0 && dist(e.x, w.x) < GOLEM_SLAM_RANGE) return { kind: "wall", obj: w };
    }
  }
  if (dist(e.x, base.x) < GOLEM_SLAM_RANGE + 20) return { kind: "base", obj: base };
  if (player && player.hp > 0 && !Game.inMine && (player.jumpH || 0) + entityWallLift(player) <= 20 && dist(e.x, player.x) < GOLEM_SLAM_RANGE - 14) return { kind: "player", obj: player };
  return null;
}

function golemHurlBoulder(e, t) {
  const { base } = state;
  const launchY = groundY - t.w * 0.85;
  const targetX = base.x + rand(-280, 280);
  const dx = targetX - e.x;
  const flightT = Math.max(0.8, Math.min(1.7, Math.abs(dx) / 320));
  state.arrows.push({
    x: e.x + e.dir * 26, y: launchY,
    vx: dx / flightT,
    vy: (((groundY - 24) - launchY) - 0.5 * 420 * flightT * flightT) / flightT,
    life: flightT + 0.4,
    hitKind: "base", enemyFireball: true, magma: true,
    dmg: 7, radius: 70,
  });
  e.attackAnim = 0.45;
  e.attackKind = "hurl";
  e.hurlAnim = 0.58;
  // The renderer uses a short release phase instead of treating every boulder
  // as a generic attack flash. This gives the throw a readable follow-through.
  e.golemHurlRelease = 0.28;
  e.golemHurlCharge = 0;
  spawnParticles(e.x + e.dir * 26, launchY, 10, "#ff6a20", 50, 45);
  Audio.fireball();
}

function updateMagmaGolem(e, t, dt) {
  const { base } = state;

  // Living lava: fire can't burn it
  if (e.burn) { e.burn = 0; e.ignited = false; e.burnDmg = 0; }
  if (e.knock) e.knock = 0;

  // --- shell / core damage modulation (works for every damage source) ---
  if (e.lastHp === undefined) {
    e.lastHp = e.hp;
    e.coreOpen = false;
    e.coreTimer = GOLEM_ARMOR_TIME * 0.6; // first opening comes a bit early
    e.slamCd = 1.5;
    e.volleyCd = 3;
    e.hurlCount = 0;
    e.hurlAnim = 0;
    e.coreFlare = 0;
    e.eruptionAnim = 0;
    e.attackKind = "";
    // Visual state is intentionally separate from combat state. It lets the
    // stone plates settle and the core shutters slide instead of snapping.
    e.golemWalkPhase = e.anim * 0.52;
    e.golemWalkBlend = 0;
    e.golemStepImpact = 0;
    e.golemSlamImpact = 0;
    e.golemSlamRecover = 0;
    e.golemHurlCharge = 0;
    e.golemHurlRelease = 0;
    e.coreVisualOpen = 0;
    e.golemSiegeWall = null;
    e.golemWallAttackT = undefined;
    e.golemWallAttackKind = '';
    e.golemWallAttackIndex = 0;
    e.golemWallAttackCooldown = 0;
    e.golemWallImpact = 0;
    e.golemWallRecover = 0;
    e.golemWallDidHit = false;
  }
  if (e.hurlAnim > 0) e.hurlAnim = Math.max(0, e.hurlAnim - dt);
  if (e.coreFlare > 0) e.coreFlare = Math.max(0, e.coreFlare - dt);
  if (e.eruptionAnim > 0) e.eruptionAnim = Math.max(0, e.eruptionAnim - dt);
  e.coreVisualOpen += ((e.coreOpen ? 1 : 0) - e.coreVisualOpen) * Math.min(1, dt * 6.8);
  e.golemWalkBlend = Math.max(0, e.golemWalkBlend - dt * 3.6);
  e.golemStepImpact = Math.max(0, e.golemStepImpact - dt * 4.8);
  e.golemSlamImpact = Math.max(0, e.golemSlamImpact - dt);
  e.golemSlamRecover = Math.max(0, e.golemSlamRecover - dt);
  e.golemHurlRelease = Math.max(0, e.golemHurlRelease - dt);
  e.golemWallAttackCooldown = Math.max(0, (e.golemWallAttackCooldown || 0) - dt);
  e.golemWallImpact = Math.max(0, (e.golemWallImpact || 0) - dt);
  e.golemWallRecover = Math.max(0, (e.golemWallRecover || 0) - dt);

  const taken = e.lastHp - e.hp;
  if (taken > 0) {
    if (e.coreOpen) {
      e.hp -= taken * 0.6; // exposed core: 160% damage
      spawnParticles(e.x, groundY - t.w * 0.55, 5, "#ffd060", 60, 80);
    } else {
      e.hp += taken * 0.65; // obsidian shell: 35% damage
      spawnParticles(e.x, groundY - t.w * 0.55, 3, "#8a8a96", 40, 40);
    }
  }
  if (e.hp <= 0) {
    killEnemyWithAnimation(e, Math.sign(e.x - (state.player?.x ?? base.x)) || 1);
    return;
  }
  e.lastHp = e.hp;

  // --- shell cycle ---
  e.coreTimer -= dt;
  if (e.coreTimer <= 0) {
    e.coreOpen = !e.coreOpen;
    if (e.coreOpen) {
      e.coreTimer = e.enraged ? GOLEM_CORE_TIME + 0.8 : GOLEM_CORE_TIME;
      e.coreFlare = 0.85;
      spawnParticles(e.x, groundY - t.w * 0.55, 18, "#ffd060", 90, 110);
      Audio.upgrade();
    } else {
      e.coreTimer = e.enraged ? GOLEM_ARMOR_TIME * 0.55 : GOLEM_ARMOR_TIME;
      e.coreFlare = 0.28;
      spawnParticles(e.x, groundY - t.w * 0.55, 10, "#5a5260", 70, 60);
    }
  }

  // --- one-time eruption enrage ---
  if (!e.enraged && e.hp < e.maxHp * 0.35) {
    e.enraged = true;
    e.eruptionAnim = 1.4;
    e.coreFlare = 1.0;
    Game.screenShake = Math.max(Game.screenShake || 0, 0.7);
    spawnParticles(e.x, groundY - t.w * 0.6, 40, "#ff6a20", 220, 260);
    spawnParticles(e.x, groundY - t.w * 0.6, 20, "#ffd060", 140, 300);
    for (let k = 0; k < 3; k++) {
      spawnEnemy("fireImp", { x: e.x + rand(-40, 40), side: e.x < base.x ? -1 : 1 });
    }
    Audio.dragonRoar();
  }

  e.slamCd -= dt;
  e.volleyCd -= dt;
  const wallAhead = golemWallAhead(e);

  // --- slam in progress ---
  if (e.slamT !== undefined) {
    e.slamT += dt;
    if (e.slamT >= GOLEM_SLAM_WINDUP) {
      e.attackAnim = 0.42; // renderer: arms crashing down
      e.attackKind = "slam";
      e.golemSlamImpact = 0.2;
      e.golemSlamRecover = 0.5;
      const tgt = golemSlamTarget(e);
      if (tgt) {
        if (tgt.kind === "wall") {
          const crit = applyCrit(t.dmg * 1.4, CFG.critChance, CFG.critMultiplier);
          tgt.obj.hp -= crit.damage;
          tgt.obj.flash = 0.2;
          spawnParticles(tgt.obj.x, groundY - 40, 14, "#caa46a", 90, 90);
          floaty(tgt.obj.x, "-" + crit.damage, "#ff6a4a", 17);
          if (tgt.obj.hp <= 0) killWallByBoss(tgt.obj);
        } else if (tgt.kind === "base") {
          base.hp -= t.dmg * 0.7;
          base.flash = 0.3;
          floaty(base.x, `-${Math.round(t.dmg * 0.7)}💥`, "#ff6a4a");
          if (base.hp < 0) base.hp = 0;
        }
      }
      golemShockwave(e, t);
      e.slamT = undefined;
      e.slamCd = e.enraged ? 1.7 : 2.6;
    }
    return;
  }

  // --- dedicated siege behavior ---
  // A boss never reaches the generic EnemyAI wall block. Stop him at the
  // enemy-facing side of the next wall, then make each breach readable.
  if (e.golemWallAttackT !== undefined) {
    updateGolemWallAttack(e, t, dt);
    return;
  }
  if (wallAhead && Math.abs(e.x - golemWallStandX(wallAhead, t)) <= 2) {
    if (e.golemWallAttackCooldown <= 0) startGolemWallAttack(e, wallAhead);
    return;
  }

  // --- start a slam? ---
  if (e.slamCd <= 0 && golemSlamTarget(e, !wallAhead)) {
    e.slamT = 0;
    e.attackKind = "slam";
    return;
  }

  // --- magma volley: three boulders, staggered ---
  if (!wallAhead && e.hurlCount > 0) {
    e.golemHurlCharge = Math.min(1, (e.golemHurlCharge || 0) + dt * 6.5);
    e.hurlT -= dt;
    if (e.hurlT <= 0) {
      golemHurlBoulder(e, t);
      e.hurlCount--;
      e.hurlT = 0.38;
    }
    return; // stands still while hurling
  }
  if (!wallAhead && e.volleyCd <= 0 && Math.abs(e.x - base.x) < 950) {
    e.hurlCount = e.enraged ? 4 : 3;
    // Give the first boulder a visible lift-and-charge rather than spawning
    // it instantly as the volley state begins.
    e.hurlT = 0.42;
    e.attackKind = "hurl";
    e.hurlAnim = 0.35;
    e.golemHurlCharge = 0;
    e.volleyCd = (t.shootInterval || 7) * (e.enraged ? 0.62 : 1) + rand(-0.6, 0.8);
    return;
  }

  // --- march to the next defense (or the base) with ground-shaking steps ---
  // Clamp the final step to the stand-off coordinate. This is the actual
  // collision guard that prevents a low-FPS frame from tunneling through it.
  const marchTarget = wallAhead ? golemWallStandX(wallAhead, t) : base.x;
  const remaining = marchTarget - e.x;
  e.dir = Math.sign(remaining) || e.dir;
  const slowMult = e.rooted > 0 ? 0.05 : (e.frost > 0 ? 0.45 : (e.slow > 0 ? 0.6 : 1));
  const speed = t.speed * (e.enraged ? 1.45 : 1) * slowMult;
  const stepDist = Math.min(Math.abs(remaining), speed * dt);
  if (stepDist <= 0.01) return;
  e.x += Math.sign(remaining) * stepDist;
  e.golemWalkPhase = (e.golemWalkPhase || 0) + dt * (e.enraged ? 2.45 : 1.82) * slowMult;
  e.golemWalkBlend = Math.min(1, (e.golemWalkBlend || 0) + dt * 3.4);
  const stepPhase = Math.sin((e.golemWalkPhase || 0) * Math.PI * 2);
  if (stepPhase > 0.92 && !e.stepped) {
    e.stepped = true;
    e.golemStepImpact = 1;
    Game.screenShake = Math.max(Game.screenShake || 0, 0.09);
    spawnParticles(e.x - e.dir * 20, groundY - 3, 4, "#6b5a45", 45, 35);
    if (Math.random() < 0.6) spawnParticles(e.x, groundY - t.w * 0.4, 1, "#ff6a20", 20, 30);
  } else if (stepPhase < 0.5) {
    e.stepped = false;
  }
}

// ---------- Phase 2 void bosses ----------
//
// The Hollow bosses echo the dragon/golem readability (big windups, large
// silhouettes, distinct safe/danger moments) but use cold-space mechanics:
// gravity scars, collapsing rifts and summoned shades.

const VOID_TITAN_ARMOR_TIME = 6.2;
const VOID_TITAN_CORE_TIME = 3.2;
const VOID_TITAN_SLAM_WINDUP = 0.95;
const VOID_TITAN_SHOCK_RANGE = 188;
const VOID_TITAN_WALL_ATTACKS = {
  ram:   { impact: 0.5,  duration: 1.16, damageMult: 1.05, impactTime: 0.2,  recoverTime: 0.48 },
  crush: { impact: 0.82, duration: 1.5,  damageMult: 1.5,  impactTime: 0.24, recoverTime: 0.62 },
};

const SERAPH_PULSE_RADIUS = 270;
const SERAPH_LANCE_WINDUP = 0.58;
const SERAPH_PULSE_WINDUP = 0.92;
const SERAPH_SUMMON_WINDUP = 1.08;

function initVoidTitan(e) {
  if (e.voidTitanInit) return;
  e.voidTitanInit = true;
  e.lastHp = e.hp;
  e.coreOpen = false;
  e.coreTimer = VOID_TITAN_ARMOR_TIME * 0.55;
  e.coreVisualOpen = 0;
  e.coreFlare = 0;
  e.eruptionAnim = 0;
  e.slamCd = 2.0;
  e.voidRiftCd = 3.0;
  e.voidCollapseCd = 5.5;
  e.voidRiftCast = 0;
  e.voidCollapseT = undefined;
  e.voidRiftT = undefined;
  e.attackKind = "";

  // Reuse the animation channel names that drawVoidTitan already understands.
  e.golemWalkPhase = e.anim * 0.52;
  e.golemWalkBlend = 0;
  e.golemStepImpact = 0;
  e.golemSlamImpact = 0;
  e.golemSlamRecover = 0;
  e.golemHurlCharge = 0;
  e.golemHurlRelease = 0;
  e.golemSiegeWall = null;
  e.golemWallAttackT = undefined;
  e.golemWallAttackKind = "";
  e.golemWallAttackIndex = 0;
  e.golemWallAttackCooldown = 0;
  e.golemWallImpact = 0;
  e.golemWallRecover = 0;
  e.golemWallDidHit = false;
}

function damageVoidWall(w, amount, col = "#8a5aff") {
  if (!wallReady(w)) return;
  const crit = applyCrit(amount, CFG.critChance, CFG.critMultiplier);
  w.hp -= crit.damage;
  w.flash = Math.max(w.flash || 0, 0.22);
  w.golemImpact = Math.max(w.golemImpact || 0, 0.32);
  w.golemImpactKind = "void";
  spawnParticles(w.x, groundY - wallHeight(w) * 0.45, 14, "#caa46a", 95, 80);
  spawnParticles(w.x, groundY - wallHeight(w) * 0.45, 10, col, 72, 92);
  floaty(w.x, "-" + Math.round(crit.damage), col, 17);
  Audio.hit();
  if (w.hp <= 0) killWallByBoss(w);
}

function damageVoidSiegeWall(e, t, w, kind) {
  if (!wallReady(w)) return;
  const attack = VOID_TITAN_WALL_ATTACKS[kind] || VOID_TITAN_WALL_ATTACKS.ram;
  const faceX = w.x + w.side * (wallRenderWidth(w) * 0.48);
  const impactY = groundY - wallHeight(w) * (kind === "crush" ? 0.78 : 0.48);
  damageVoidWall(w, t.dmg * attack.damageMult, kind === "crush" ? "#d7f6ff" : "#8a5aff");
  e.golemWallImpact = attack.impactTime;
  e.golemWallRecover = attack.recoverTime;
  e.attackAnim = 0.42;
  Game.screenShake = Math.max(Game.screenShake || 0, kind === "crush" ? 0.62 : 0.42);
  spawnParticles(faceX, impactY, kind === "crush" ? 26 : 18, "#8a5aff", kind === "crush" ? 175 : 125, 130);
  spawnParticles(faceX, impactY - 10, kind === "crush" ? 12 : 7, "#d7f6ff", 80, 120);
}

function startVoidTitanWallAttack(e, w) {
  const index = e.golemWallAttackIndex || 0;
  const kind = index % 2 === 0 ? "ram" : "crush";
  e.golemWallAttackIndex = index + 1;
  e.golemSiegeWall = w;
  e.golemWallAttackKind = kind;
  e.golemWallAttackT = 0;
  e.golemWallDidHit = false;
  e.golemWallImpact = 0;
  e.golemWallRecover = 0;
  e.attackKind = kind === "ram" ? "wallRam" : "wallCrush";
  e.coreFlare = Math.max(e.coreFlare || 0, kind === "crush" ? 0.55 : 0.28);
}

function updateVoidTitanWallAttack(e, t, dt) {
  const kind = e.golemWallAttackKind || "ram";
  const attack = VOID_TITAN_WALL_ATTACKS[kind] || VOID_TITAN_WALL_ATTACKS.ram;
  e.golemWallAttackT += dt;
  if (!e.golemWallDidHit && e.golemWallAttackT >= attack.impact) {
    e.golemWallDidHit = true;
    damageVoidSiegeWall(e, t, e.golemSiegeWall, kind);
  }
  if (e.golemWallAttackT >= attack.duration) {
    e.golemWallAttackT = undefined;
    e.golemWallAttackKind = "";
    e.golemWallDidHit = false;
    e.golemSiegeWall = null;
    e.golemWallAttackCooldown = 0.28;
    if (e.attackKind === "wallRam" || e.attackKind === "wallCrush") e.attackKind = "";
  }
}

function voidTitanShockwave(e, t) {
  const { player } = state;
  Game.screenShake = Math.max(Game.screenShake || 0, 0.6);
  spawnParticles(e.x, groundY - 6, 28, "#150a2a", 220, 100);
  spawnParticles(e.x, groundY - 12, 22, "#8a5aff", 180, 150);
  spawnParticles(e.x, groundY - 16, 10, "#d7f6ff", 110, 170);
  state.legendaryEffects.push({ type: "ring", x: e.x, radius: VOID_TITAN_SHOCK_RANGE, life: 0.42, totalLife: 0.42, col: "#8a5aff", width: 7 });
  Audio.hit();

  if (player && dist(e.x, player.x) < VOID_TITAN_SHOCK_RANGE
      && (player.jumpH || 0) + entityWallLift(player) <= 35) {
    damagePlayer(t.meleeDmg || 2, { knock: Math.sign(player.x - e.x || 1) * 330 });
    player.rooted = Math.max(player.rooted || 0, 0.35);
  }
  for (const u of state.units) {
    if (u.hp <= 0 || u.dying || u.onWall || u.mine) continue;
    if (dist(e.x, u.x) < VOID_TITAN_SHOCK_RANGE) {
      u.hp -= 2;
      u.panic = 1;
      u.knock = (u.knock || 0) + Math.sign(u.x - e.x || 1) * 240;
    }
  }
}

function releaseVoidTitanSlam(e, t) {
  const tgt = golemSlamTarget(e);
  e.attackAnim = 0.45;
  e.attackKind = "slam";
  e.golemSlamImpact = 0.22;
  e.golemSlamRecover = 0.52;
  if (tgt) {
    if (tgt.kind === "wall") {
      damageVoidWall(tgt.obj, t.dmg * 1.35, "#d7f6ff");
    } else if (tgt.kind === "base") {
      const dmg = Math.round(t.dmg * 0.62);
      state.base.hp = Math.max(0, state.base.hp - dmg);
      state.base.flash = 0.34;
      floaty(state.base.x, "-" + dmg, "#b9a0ff");
    }
  }
  voidTitanShockwave(e, t);
}

function releaseVoidTitanRifts(e) {
  const targets = [];
  const player = state.player;
  if (player && player.hp > 0 && !Game.inMine && Math.abs(player.x - state.base.x) < 900) {
    targets.push(player.x);
  }
  const activeUnits = state.units.filter(u => u.hp > 0 && !u.dying && !u.mine && Math.abs(u.x - state.base.x) < 760);
  if (activeUnits.length) targets.push(activeUnits[Math.floor(Math.random() * activeUnits.length)].x);
  while (targets.length < (e.enraged ? 4 : 3)) {
    targets.push(state.base.x + rand(-340, 340));
  }
  for (const x of targets.slice(0, e.enraged ? 4 : 3)) {
    spawnVoidPool(x + rand(-35, 35), e.enraged ? 84 : 72, 5.2, { pull: true });
    state.legendaryEffects.push({ type: "ring", x, radius: e.enraged ? 106 : 92, life: 0.55, totalLife: 0.55, col: "#b9a0ff", width: 5 });
  }
  Game.screenShake = Math.max(Game.screenShake || 0, 0.32);
  spawnParticles(e.x, groundY - 95, 24, "#8a5aff", 140, 160);
  spawnParticles(e.x, groundY - 120, 12, "#d7f6ff", 80, 170);
  Audio.fireball();
}

function releaseVoidTitanCollapse(e, t) {
  const x = state.base.x + rand(-190, 190);
  const r = e.enraged ? 132 : 116;
  spawnVoidPool(x, r, e.enraged ? 6.8 : 6, { pull: true, dmg: 1 });
  state.legendaryEffects.push({ type: "ring", x, radius: r * 1.25, life: 0.82, totalLife: 0.82, col: "#d7f6ff", width: 9 });
  Game.screenShake = Math.max(Game.screenShake || 0, 0.72);

  if (dist(x, state.base.x) < r + 45) {
    const dmg = Math.round(t.dmg * 0.5);
    state.base.hp = Math.max(0, state.base.hp - dmg);
    state.base.flash = 0.38;
    floaty(state.base.x, "-" + dmg, "#b9a0ff");
  }
  for (const w of state.walls) {
    if (wallReady(w) && dist(x, w.x) < r) damageVoidWall(w, t.dmg * 0.42, "#b9a0ff");
  }
  const player = state.player;
  if (player && dist(x, player.x) < r * 0.75 && (player.jumpH || 0) + entityWallLift(player) <= 35) {
    damagePlayer(1, { knock: Math.sign(player.x - x || 1) * 210 });
  }
  spawnParticles(x, groundY - 28, 40, "#8a5aff", 230, 210);
  spawnParticles(x, groundY - 42, 18, "#d7f6ff", 130, 240);
  Audio.dragonRoar();
}

function updateVoidTitan(e, t, dt) {
  const { base } = state;
  initVoidTitan(e);
  if (e.burn) { e.burn = 0; e.ignited = false; e.burnDmg = 0; }
  if (e.knock) e.knock = 0;

  e.coreVisualOpen += ((e.coreOpen ? 1 : 0) - e.coreVisualOpen) * Math.min(1, dt * 7);
  e.golemWalkBlend = Math.max(0, e.golemWalkBlend - dt * 3.6);
  e.golemStepImpact = Math.max(0, e.golemStepImpact - dt * 4.8);
  e.golemSlamImpact = Math.max(0, e.golemSlamImpact - dt);
  e.golemSlamRecover = Math.max(0, e.golemSlamRecover - dt);
  e.golemHurlRelease = Math.max(0, e.golemHurlRelease - dt);
  e.golemWallAttackCooldown = Math.max(0, (e.golemWallAttackCooldown || 0) - dt);
  e.golemWallImpact = Math.max(0, (e.golemWallImpact || 0) - dt);
  e.golemWallRecover = Math.max(0, (e.golemWallRecover || 0) - dt);
  e.coreFlare = Math.max(0, (e.coreFlare || 0) - dt);
  e.eruptionAnim = Math.max(0, (e.eruptionAnim || 0) - dt);
  e.voidRiftCast = Math.max(0, (e.voidRiftCast || 0) - dt);

  const taken = e.lastHp - e.hp;
  if (taken > 0) {
    if (e.coreOpen) {
      e.hp -= taken * 0.45; // open star-core: 145% damage
      spawnParticles(e.x, groundY - t.w * 0.72, 6, "#d7f6ff", 66, 90);
    } else {
      e.hp += taken * 0.5; // sealed void plates: 50% damage
      spawnParticles(e.x, groundY - t.w * 0.66, 4, "#4a3578", 48, 42);
    }
  }
  if (e.hp <= 0) {
    killEnemyWithAnimation(e, Math.sign(e.x - (state.player?.x ?? base.x)) || 1);
    return;
  }
  e.lastHp = e.hp;

  e.coreTimer -= dt;
  if (e.coreTimer <= 0) {
    e.coreOpen = !e.coreOpen;
    if (e.coreOpen) {
      e.coreTimer = e.enraged ? VOID_TITAN_CORE_TIME + 0.5 : VOID_TITAN_CORE_TIME;
      e.coreFlare = 0.9;
      spawnParticles(e.x, groundY - t.w * 0.72, 20, "#d7f6ff", 100, 130);
      Audio.upgrade();
    } else {
      e.coreTimer = e.enraged ? VOID_TITAN_ARMOR_TIME * 0.55 : VOID_TITAN_ARMOR_TIME;
      e.coreFlare = 0.3;
      spawnParticles(e.x, groundY - t.w * 0.7, 12, "#5a4788", 78, 70);
    }
  }

  if (!e.enraged && e.hp < e.maxHp * 0.38) {
    e.enraged = true;
    e.eruptionAnim = 1.5;
    e.coreOpen = true;
    e.coreTimer = VOID_TITAN_CORE_TIME + 0.8;
    e.coreFlare = 1.1;
    Game.screenShake = Math.max(Game.screenShake || 0, 0.8);
    spawnParticles(e.x, groundY - t.w * 0.75, 46, "#8a5aff", 250, 285);
    spawnParticles(e.x, groundY - t.w * 0.8, 24, "#d7f6ff", 160, 320);
    for (let k = 0; k < 3; k++) {
      spawnEnemy(k === 0 ? "voidWraith" : "shade", { x: e.x + rand(-70, 70), side: e.x < base.x ? -1 : 1 });
    }
    Audio.dragonRoar();
  }

  e.slamCd -= dt;
  e.voidRiftCd -= dt;
  e.voidCollapseCd -= dt;
  const wallAhead = golemWallAhead(e);

  if (e.slamT !== undefined) {
    e.slamT += dt;
    if (e.slamT >= VOID_TITAN_SLAM_WINDUP) {
      releaseVoidTitanSlam(e, t);
      e.slamT = undefined;
      e.slamCd = e.enraged ? 1.9 : 2.7;
    }
    return;
  }

  if (e.voidRiftT !== undefined) {
    e.voidRiftT += dt;
    e.attackKind = "rift";
    e.voidRiftCast = Math.max(e.voidRiftCast || 0, 0.18);
    e.golemHurlCharge = Math.min(1, e.voidRiftT / 0.72);
    if (e.voidRiftT >= 0.72) {
      releaseVoidTitanRifts(e);
      e.voidRiftT = undefined;
      e.golemHurlCharge = 0;
      e.attackKind = "";
      e.voidRiftCd = e.enraged ? 3.8 : 4.9;
    }
    return;
  }

  if (e.voidCollapseT !== undefined) {
    e.voidCollapseT += dt;
    e.attackKind = "collapse";
    e.golemHurlCharge = Math.min(1, e.voidCollapseT / 1.05);
    if (e.voidCollapseT >= 1.05) {
      releaseVoidTitanCollapse(e, t);
      e.voidCollapseT = undefined;
      e.golemHurlCharge = 0;
      e.attackKind = "";
      e.voidCollapseCd = e.enraged ? 6.2 : 7.6;
    }
    return;
  }

  if (e.golemWallAttackT !== undefined) {
    updateVoidTitanWallAttack(e, t, dt);
    return;
  }
  if (wallAhead && Math.abs(e.x - golemWallStandX(wallAhead, t)) <= 2) {
    if (e.golemWallAttackCooldown <= 0) startVoidTitanWallAttack(e, wallAhead);
    return;
  }

  if (e.slamCd <= 0 && golemSlamTarget(e, !wallAhead)) {
    e.slamT = 0;
    e.attackKind = "slam";
    e.coreFlare = Math.max(e.coreFlare || 0, 0.35);
    return;
  }

  if (!wallAhead && e.voidCollapseCd <= 0 && Math.abs(e.x - base.x) < 930) {
    e.voidCollapseT = 0;
    e.attackKind = "collapse";
    e.coreFlare = Math.max(e.coreFlare || 0, 0.55);
    return;
  }
  if (!wallAhead && e.voidRiftCd <= 0 && Math.abs(e.x - base.x) < 980) {
    e.voidRiftT = 0;
    e.attackKind = "rift";
    e.coreFlare = Math.max(e.coreFlare || 0, 0.38);
    return;
  }

  const marchTarget = wallAhead ? golemWallStandX(wallAhead, t) : base.x;
  const remaining = marchTarget - e.x;
  e.dir = Math.sign(remaining) || e.dir;
  const slowMult = e.rooted > 0 ? 0.05 : (e.frost > 0 ? 0.45 : (e.slow > 0 ? 0.6 : 1));
  const speed = t.speed * (e.enraged ? 1.38 : 1) * slowMult;
  const stepDist = Math.min(Math.abs(remaining), speed * dt);
  if (stepDist <= 0.01) return;
  e.x += Math.sign(remaining) * stepDist;
  e.golemWalkPhase = (e.golemWalkPhase || 0) + dt * (e.enraged ? 2.6 : 1.9) * slowMult;
  e.golemWalkBlend = Math.min(1, (e.golemWalkBlend || 0) + dt * 3.4);
  const stepPhase = Math.sin((e.golemWalkPhase || 0) * Math.PI * 2);
  if (stepPhase > 0.92 && !e.stepped) {
    e.stepped = true;
    e.golemStepImpact = 1;
    Game.screenShake = Math.max(Game.screenShake || 0, 0.1);
    spawnParticles(e.x - e.dir * 22, groundY - 4, 5, "#150a2a", 55, 35);
    if (Math.random() < 0.7) spawnParticles(e.x, groundY - t.w * 0.55, 1, "#8a5aff", 24, 38);
  } else if (stepPhase < 0.5) {
    e.stepped = false;
  }
}

function initVoidSeraph(e, t) {
  if (e.voidSeraphInit) return;
  e.voidSeraphInit = true;
  e.fy = e.fy ?? -230;
  e.patrolDir = e.patrolDir || (e.x < CFG.baseX ? 1 : -1);
  e.shootCd = e.shootCd ?? rand(1.0, 1.8);
  e.seraphPulseCd = rand(4.6, 6.4);
  e.seraphSummonCd = e.seraphSummonCd ?? rand(5.5, 7.5);
  e.seraphLanceT = undefined;
  e.seraphPulseT = undefined;
  e.seraphSummonT = undefined;
  e.seraphLanceCharge = 0;
  e.seraphPulseFlash = 0;
  e.seraphSummonFlash = 0;
  e.seraphEnrage = 0;
  e.attackKind = "";
  e.lastHp = e.hp;
  e.dir = e.patrolDir;
}

function seraphFireLance(e, t) {
  const count = e.enraged ? 3 : 2;
  const launchY = groundY + (e.fy || -230) - t.w * 0.12;
  for (let k = 0; k < count; k++) {
    const targetX = state.base.x + rand(-260, 260) + (k - (count - 1) / 2) * 58;
    const dx = targetX - e.x;
    const flightT = Math.max(0.55, Math.min(1.25, Math.abs(dx) / 500));
    const dy = (groundY - 24) - launchY;
    state.arrows.push({
      x: e.x + e.dir * 42 + rand(-10, 10), y: launchY + rand(-8, 8),
      vx: dx / flightT,
      vy: (dy - 0.5 * 420 * flightT * flightT) / flightT,
      life: flightT + 0.4,
      hitKind: "base", enemyFireball: true, voidBolt: true, big: true,
      dmg: Math.max(7, Math.round(t.dmg * 0.55)), radius: e.enraged ? 92 : 78,
    });
  }
  e.attackAnim = 0.5;
  e.seraphLanceCharge = 0.18;
  spawnParticles(e.x + e.dir * 42, launchY, 20, "#8a5aff", 85, 85);
  spawnParticles(e.x + e.dir * 42, launchY, 10, "#d7f6ff", 48, 105);
  Game.screenShake = Math.max(Game.screenShake || 0, 0.18);
  Audio.fireball();
}

function seraphPulse(e, t) {
  const x = e.x;
  const r = e.enraged ? SERAPH_PULSE_RADIUS + 45 : SERAPH_PULSE_RADIUS;
  state.legendaryEffects.push({ type: "ring", x, radius: r, life: 0.7, totalLife: 0.7, col: "#d7f6ff", width: 9 });
  spawnVoidPool(x, e.enraged ? 118 : 96, 4.5, { pull: true });
  Game.screenShake = Math.max(Game.screenShake || 0, 0.52);

  if (dist(x, state.base.x) < r) {
    const dmg = Math.round(t.dmg * 0.34);
    state.base.hp = Math.max(0, state.base.hp - dmg);
    state.base.flash = 0.32;
    floaty(state.base.x, "-" + dmg, "#b9a0ff");
  }
  for (const w of state.walls) {
    if (wallReady(w) && dist(x, w.x) < r * 0.85) damageVoidWall(w, t.dmg * 0.28, "#8a5aff");
  }
  const player = state.player;
  if (player && player.hp > 0 && !Game.inMine && dist(x, player.x) < r
      && (player.jumpH || 0) + entityWallLift(player) <= 85) {
    damagePlayer(1, { knock: Math.sign(x - player.x || 1) * 190 });
  }
  for (const u of state.units) {
    if (u.hp <= 0 || u.dying || u.mine) continue;
    if (dist(x, u.x) < r) {
      u.hp -= 2;
      u.panic = 1;
      u.knock = (u.knock || 0) + Math.sign(x - u.x || 1) * 165;
    }
  }
  spawnParticles(x, groundY + (e.fy || -230), 36, "#8a5aff", 210, 220);
  spawnParticles(x, groundY + (e.fy || -230) - 16, 18, "#d7f6ff", 130, 245);
  Audio.dragonRoar();
}

function seraphSummon(e) {
  const side = e.x < state.base.x ? -1 : 1;
  const n = e.enraged ? 4 : 3;
  for (let k = 0; k < n; k++) {
    const type = k === 0 ? "voidWraith" : "shade";
    const s = spawnEnemy(type, { x: e.x + rand(-110, 110), side });
    if (type === "shade") {
      s.fy = -rand(18, 42);
      s.breachedWall = true;
    }
  }
  spawnVoidPool(e.x, 88, 4, { pull: true });
  spawnParticles(e.x, groundY + (e.fy || -230) + 12, 28, "#8a5aff", 160, 200);
  spawnParticles(e.x, groundY + (e.fy || -230) - 12, 14, "#d7f6ff", 100, 230);
  Game.screenShake = Math.max(Game.screenShake || 0, 0.32);
  Audio.upgrade();
}

function updateVoidSeraph(e, t, dt) {
  initVoidSeraph(e, t);
  if (e.knock) e.knock = 0;
  if (e.burn) { e.burn = 0; e.ignited = false; e.burnDmg = 0; }

  e.seraphLanceCharge = Math.max(0, (e.seraphLanceCharge || 0) - dt);
  e.seraphPulseFlash = Math.max(0, (e.seraphPulseFlash || 0) - dt);
  e.seraphSummonFlash = Math.max(0, (e.seraphSummonFlash || 0) - dt);
  e.seraphEnrage = Math.max(0, (e.seraphEnrage || 0) - dt);
  e.seraphPulseCd -= dt;
  e.seraphSummonCd -= dt;

  if (!e.enraged && e.hp < e.maxHp * 0.42) {
    e.enraged = true;
    e.seraphEnrage = 1.4;
    e.seraphPulseCd = 0.4;
    e.seraphSummonCd = 1.0;
    Game.screenShake = Math.max(Game.screenShake || 0, 0.7);
    spawnParticles(e.x, groundY + (e.fy || -230), 48, "#8a5aff", 250, 280);
    spawnParticles(e.x, groundY + (e.fy || -230) - 30, 24, "#d7f6ff", 150, 320);
    Audio.dragonRoar();
  }

  const hover = -(235 + (e.enraged ? 22 : 0) + Math.sin(e.anim * 0.55 + e.x * 0.01) * 20);
  e.fy = (e.fy ?? hover) + (hover - (e.fy ?? hover)) * Math.min(1, dt * 1.45);

  const L = CFG.baseX - 650, R = CFG.baseX + 650;
  if (Math.abs(e.x - CFG.baseX) > 760) {
    e.dir = Math.sign(CFG.baseX - e.x) || e.dir;
    e.x += e.dir * t.speed * dt;
  } else if (e.seraphLanceT === undefined && e.seraphPulseT === undefined && e.seraphSummonT === undefined) {
    e.x += e.patrolDir * t.speed * (e.enraged ? 1.25 : 1) * dt;
    if (e.x > R) e.patrolDir = -1;
    if (e.x < L) e.patrolDir = 1;
    e.dir = e.patrolDir;
  }

  if (Math.random() < 0.7) {
    spawnParticles(e.x + rand(-t.w * 0.32, t.w * 0.32), groundY + (e.fy || -230) + rand(-45, 35), 1, Math.random() < 0.5 ? "#8a5aff" : "#d7f6ff", 22, 42);
  }

  if (e.seraphLanceT !== undefined) {
    e.seraphLanceT += dt;
    e.attackKind = "lance";
    e.seraphLanceCharge = Math.max(e.seraphLanceCharge || 0, 0.28 + e.seraphLanceT / SERAPH_LANCE_WINDUP);
    if (e.seraphLanceT >= SERAPH_LANCE_WINDUP) {
      seraphFireLance(e, t);
      e.seraphLanceT = undefined;
      e.attackKind = "";
      e.shootCd = (t.shootInterval || 2.6) * (e.enraged ? 0.68 : 1) + rand(-0.25, 0.45);
    }
    return;
  }

  if (e.seraphPulseT !== undefined) {
    e.seraphPulseT += dt;
    e.attackKind = "pulse";
    e.seraphPulseFlash = Math.max(e.seraphPulseFlash || 0, e.seraphPulseT / SERAPH_PULSE_WINDUP);
    if (e.seraphPulseT >= SERAPH_PULSE_WINDUP) {
      seraphPulse(e, t);
      e.seraphPulseT = undefined;
      e.attackKind = "";
      e.seraphPulseCd = e.enraged ? rand(4.4, 5.5) : rand(5.8, 7.2);
    }
    return;
  }

  if (e.seraphSummonT !== undefined) {
    e.seraphSummonT += dt;
    e.attackKind = "summon";
    e.seraphSummonFlash = Math.max(e.seraphSummonFlash || 0, e.seraphSummonT / SERAPH_SUMMON_WINDUP);
    if (e.seraphSummonT >= SERAPH_SUMMON_WINDUP) {
      seraphSummon(e);
      e.seraphSummonT = undefined;
      e.attackKind = "";
      e.seraphSummonCd = (t.summonInterval || 8.5) * (e.enraged ? 0.62 : 1) + rand(-0.8, 0.8);
    }
    return;
  }

  if (e.seraphPulseCd <= 0 && Math.abs(e.x - state.base.x) < 560) {
    e.seraphPulseT = 0;
    e.attackKind = "pulse";
    e.attackAnim = 0.48;
    return;
  }
  if (e.seraphSummonCd <= 0) {
    e.seraphSummonT = 0;
    e.attackKind = "summon";
    e.attackAnim = 0.48;
    return;
  }
  if (e.shootCd <= 0 && Math.abs(e.x - state.base.x) < 880) {
    e.seraphLanceT = 0;
    e.attackKind = "lance";
    e.attackAnim = 0.38;
  }
}

function killWallByBoss(w) {
  w.hp = 0; w.level = 0; w.commissioned = false; w.buildProgress = 0;
  spawnParticles(w.x, groundY - 30, 20, "#caa46a", 100, 100);
}

// ---------- Fire pools (magma boulder impact hazard) ----------

export function spawnFirePool(x, r = 66, life = 7) {
  if (!state.firePools) state.firePools = [];
  state.firePools.push({ x, r, life, maxLife: life, tick: rand(0.3, 0.7), ph: rand(0, 6) });
}

export function spawnVoidPool(x, r = 74, life = 5, opts = {}) {
  if (!state.firePools) state.firePools = [];
  state.firePools.push({
    x, r, life, maxLife: life,
    tick: rand(0.35, 0.7), ph: rand(0, 6),
    kind: "void",
    pull: !!opts.pull,
    dmg: opts.dmg || 1,
  });
}

export function updateFirePools(dt) {
  const pools = state.firePools;
  if (!pools || !pools.length) return;
  const { player } = state;
  for (let i = pools.length - 1; i >= 0; i--) {
    const p = pools[i];
    const isVoid = p.kind === "void";
    p.life -= dt;
    if (Math.random() < dt * (isVoid ? 10 : 14)) spawnParticles(p.x + rand(-p.r * 0.8, p.r * 0.8), groundY - 4, 1, isVoid ? "#8a5aff" : "#ff6a20", 14, isVoid ? 62 : 42);
    if (Math.random() < dt * (isVoid ? 7 : 5))  spawnParticles(p.x + rand(-p.r * 0.6, p.r * 0.6), groundY - 6, 1, isVoid ? "#d7f6ff" : "#ffd060", 8, isVoid ? 72 : 52);
    if (isVoid && p.pull) {
      if (player && player.hp > 0 && !Game.inMine && dist(p.x, player.x) < p.r * 1.15
          && (player.jumpH || 0) + entityWallLift(player) <= 45) {
        player.x += Math.sign(p.x - player.x || 1) * Math.min(70 * dt, Math.abs(p.x - player.x) * 0.08);
      }
      for (const u of state.units) {
        if (u.hp <= 0 || u.dying || u.mine || u.onWall) continue;
        if (dist(p.x, u.x) < p.r * 1.1) u.x += Math.sign(p.x - u.x || 1) * Math.min(55 * dt, Math.abs(p.x - u.x) * 0.08);
      }
    }
    p.tick -= dt;
    if (p.tick <= 0) {
      p.tick = isVoid ? 0.9 : 0.85;
      if (player && dist(p.x, player.x) < p.r
          && (player.jumpH || 0) + entityWallLift(player) <= 20) {
        if (damagePlayer(p.dmg || 1) !== null) spawnParticles(player.x, groundY - 40, 7, isVoid ? "#8a5aff" : "#ff6a20", 60, 80);
      }
      for (const u of state.units) {
        if (u.hp <= 0 || u.dying || u.onWall || u.mine) continue;
        if (dist(p.x, u.x) < p.r) {
          u.hp -= p.dmg || 1;
          u.panic = 1;
          spawnParticles(u.x, groundY - 30, 4, isVoid ? "#8a5aff" : "#ff6a20", 40, 60);
        }
      }
    }
    if (p.life <= 0) pools.splice(i, 1);
  }
}
