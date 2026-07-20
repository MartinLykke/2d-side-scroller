import { CFG } from '../../config/config.js';
import { ENEMY_TYPES } from '../../config/enemies.js?v=biomeactive1';
import { dist, rand, applyCrit } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnParticles, floaty, spawnEnemy } from '../world/SpawnSystem.js?v=biomeactive1';
import { killEnemyWithAnimation, spawnImpBlood, killEnemy } from '../../util/EnemyUtils.js?v=biomeactive1';
import { entityWallLift, wallHeight, wallReady, wallRenderWidth } from '../../entities/Wall.js';
import { damagePlayer } from '../combat/PlayerCombat.js?v=biomeactive1';
import { approachSpeedMult, unopposedSprintMult } from './EnemyShared.js';

// All night-boss behavior lives here: the fire dragon (night 5), the magma
// colossus (night 10) and the ground hazards they leave behind. EnemyAI
// dispatches into updateBoss() so its own loop only handles regular enemies.

export function updateBoss(e, t, dt) {
  if (t.voidTitan)  { updateVoidTitan(e, t, dt); return true; }
  if (t.voidSeraph) { updateVoidSeraph(e, t, dt); return true; }
  if (t.dragon) { updateFireDragon(e, t, dt); return true; }
  if (t.golem)  { updateMagmaGolem(e, t, dt); return true; }
  if (t.biomeBoss) { updateBiomeBoss(e, t, dt); return true; }
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

  // Rushes in at high speed on its way to the base; once it reaches the
  // defenses (or clips a friendly unit/player) it settles into its normal
  // patrol speed for the fight.
  if (!e.reachedBase) {
    const nearPlayer = dist(e.x, state.player.x) < 140;
    const nearUnit = state.units.some(u => u.hp > 0 && !u.dying && dist(e.x, u.x) < 140);
    if ((e.x > L && e.x < R) || nearPlayer || nearUnit) e.reachedBase = true;
  }
  const speed = e.reachedBase ? t.speed : t.speed * 3;
  e.x += e.patrolDir * speed * dt;
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

// ---------- Biome bosses ----------
//
// These bosses are attached to the world biomes. They share the normal siege
// readability (walk to the next wall, telegraph, impact), but each has one
// biome-specific crisis and a direct counter from that biome's rare weapons.

const BIOME_WALL_ATTACK = { impact: 0.52, duration: 1.12, recover: 0.34 };
const BIOME_CASTS = {
  forestStalker: { kind: "roots", dur: 0.82 },
  skadiWrath: { kind: "deepFreeze", dur: 1.0 },
  duneBroodmother: { kind: "breach", dur: 0.72 },
  sunkenBehemoth: { kind: "consume", dur: 0.75 },
  ignitedCore: { kind: "lavaCracks", dur: 0.72 },
  voidMindflayer: { kind: "possess", dur: 0.86 },
};

function playerWeaponIs(...ids) {
  const weapon = state.player?.weapon;
  return !!weapon && ids.includes(weapon);
}

function pushBossRing(x, radius, col, life = 0.65, width = 6) {
  if (!state.legendaryEffects) state.legendaryEffects = [];
  state.legendaryEffects.push({ type: "ring", x, radius, life, totalLife: life, col, width });
}

function activeUnits(role = null) {
  return state.units.filter(u => u.hp > 0 && !u.dying && !u.mine && (!role || u.role === role));
}

function stunArchersNear(x, radius, duration, col, damage = 0) {
  for (const u of activeUnits("archer")) {
    if (dist(u.x, x) > radius) continue;
    u.stunned = Math.max(u.stunned || 0, duration);
    u.shootState = null;
    u.cooldown = Math.max(u.cooldown || 0, duration * 0.35);
    if (damage > 0) u.hp -= damage;
    spawnParticles(u.x, groundY - 50 - entityWallLift(u), 8, col, 42, 70);
    floaty(u.x, damage > 0 ? "-" + damage : "Stunned", col, 13);
  }
}

function rootBuildersInsideBase(duration) {
  for (const u of activeUnits()) {
    if (u.role !== "builder" && u.role !== "farmer" && u.role !== "miner") continue;
    if (Math.abs(u.x - CFG.baseX) > 760) continue;
    u.rooted = Math.max(u.rooted || 0, duration);
    u.panic = Math.max(u.panic || 0, 0.8);
    spawnParticles(u.x, groundY - 22, 6, "#6f8a42", 38, 42);
  }
}

function damageUnitsInRange(x, radius, dmg, col, opts = {}) {
  for (const u of activeUnits()) {
    const lift = entityWallLift(u);
    if (dist(u.x, x) > radius + lift * 0.25) continue;
    u.hp -= dmg;
    u.panic = Math.max(u.panic || 0, 0.8);
    if (opts.poison) {
      u.poison = Math.max(u.poison || 0, opts.poison);
      u.poisonDmg = Math.max(u.poisonDmg || 0, opts.poisonDmg || 1);
    }
    if (opts.root) u.rooted = Math.max(u.rooted || 0, opts.root);
    if (opts.stun) u.stunned = Math.max(u.stunned || 0, opts.stun);
    if (opts.knock) u.knock = (u.knock || 0) + Math.sign(u.x - x || 1) * opts.knock;
    spawnParticles(u.x, groundY - 34 - lift, 6, col, 48, 72);
    floaty(u.x, "-" + dmg, col, 13);
  }
}

function damageWallsInRange(x, radius, dmg, col) {
  for (const w of state.walls) {
    if (!wallReady(w) || dist(w.x, x) > radius) continue;
    w.hp -= dmg;
    w.flash = Math.max(w.flash || 0, 0.24);
    spawnParticles(w.x, groundY - wallHeight(w) * 0.48, 10, col, 80, 90);
    floaty(w.x, "-" + Math.round(dmg), col, 15);
    if (w.hp <= 0) killWallByBoss(w);
  }
}

function strongestWall() {
  let best = null, score = -1;
  for (const w of state.walls) {
    if (!wallReady(w)) continue;
    const s = (w.level || 1) * 1000 + (w.hp || 0);
    if (s > score) { best = w; score = s; }
  }
  return best;
}

function outerWallOnSide(side) {
  let best = null;
  for (const w of state.walls) {
    if (!wallReady(w) || w.side !== side) continue;
    if (!best || (side < 0 ? w.x < best.x : w.x > best.x)) best = w;
  }
  return best;
}

function damageBiomeBossWall(e, t, w, mult = 1, col = t.eye) {
  if (!wallReady(w)) return;
  let dmg = t.dmg * mult * (e.damageMult || 1);
  if (t.skadiWrath && (w.brittle || 0) > 0 && !playerWeaponIs("icicle_spear")) {
    dmg = Math.max(dmg, w.hp + 1);
    floaty(w.x, "SHATTER", "#bfefff", 18);
  }
  const crit = applyCrit(dmg, CFG.critChance, CFG.critMultiplier);
  const impactY = groundY - wallHeight(w) * 0.5;
  w.hp -= crit.damage;
  w.flash = Math.max(w.flash || 0, 0.28);
  w.bossImpact = Math.max(w.bossImpact || 0, 0.32);
  e.attackAnim = 0.38;
  Game.screenShake = Math.max(Game.screenShake || 0, 0.26 + mult * 0.08);
  spawnParticles(w.x, impactY, 14, col, 100, 105);
  spawnParticles(w.x, impactY + 6, 8, "#caa46a", 110, 80);
  floaty(w.x, "-" + Math.round(crit.damage), col, 16);
  Audio.hit();
  if (w.hp <= 0) killWallByBoss(w);
}

function damageBaseByBoss(e, t, mult = 1, col = t.eye) {
  const dmg = Math.round((t.baseDmg || t.dmg * 0.45) * mult * (e.damageMult || 1));
  state.base.hp = Math.max(0, state.base.hp - dmg);
  state.base.flash = Math.max(state.base.flash || 0, 0.32);
  e.attackAnim = 0.36;
  spawnParticles(state.base.x, groundY - 58, 18, col, 110, 130);
  floaty(state.base.x, "-" + dmg, col, 16);
  Game.screenShake = Math.max(Game.screenShake || 0, 0.28);
  Audio.hit();
}

function initBiomeBoss(e, t) {
  if (e.biomeBossInit) return;
  e.biomeBossInit = true;
  e.lastHp = e.hp;
  e.specialCd = e.specialCd ?? rand(3, 5);
  e.biomeMeleeCd = 0;
  e.biomeWallAttackT = undefined;
  e.biomeWallDidHit = false;
  e.biomeWallCooldown = 0;
  e.attackKind = "";
  e.enrageFlash = 0;
  e.biomeVulnerable = 0;
  if (t.skadiWrath) {
    e.cryoShield = 0;
    e.cryoShieldCd = e.cryoShieldCd ?? rand(6, 8);
  }
  if (t.voidMindflayer) e.goldDecayCd = e.goldDecayCd ?? 4.5;
}

function updateBiomeTimers(e, t, dt) {
  e.biomeMeleeCd = Math.max(0, (e.biomeMeleeCd || 0) - dt);
  e.biomeWallCooldown = Math.max(0, (e.biomeWallCooldown || 0) - dt);
  e.biomeVulnerable = Math.max(0, (e.biomeVulnerable || 0) - dt);
  e.blinded = Math.max(0, (e.blinded || 0) - dt);
  e.healLocked = Math.max(0, (e.healLocked || 0) - dt);
  e.tentacleCut = Math.max(0, (e.tentacleCut || 0) - dt);
  e.maskCracked = Math.max(0, (e.maskCracked || 0) - dt);
  e.biomeStunned = Math.max(0, (e.biomeStunned || 0) - dt);
  e.burrowT = Math.max(0, (e.burrowT || 0) - dt);
  e.enrageFlash = Math.max(0, (e.enrageFlash || 0) - dt);
  if (t.skadiWrath) {
    e.cryoShieldCd = Math.max(0, (e.cryoShieldCd || 0) - dt);
    e.cryoShield = Math.max(0, (e.cryoShield || 0) - dt);
    e.reflectFlash = Math.max(0, (e.reflectFlash || 0) - dt);
    if ((e.cryoShield || 0) <= 0 && e.cryoShieldCd <= 0) {
      e.cryoShield = playerWeaponIs("blizzard_chime") ? 1.8 : 5.2;
      e.cryoShieldCd = 30;
      e.attackKind = "cryoShield";
      spawnParticles(e.x, groundY + (e.fy || 0) - 35, 26, "#bfefff", 120, 150);
      pushBossRing(e.x, 170, "#bfefff", 0.7, 7);
      Audio.upgrade();
    }
  }
}

function reactToBiomeBossDamage(e, t) {
  const taken = Math.max(0, (e.lastHp ?? e.hp) - e.hp);
  if (taken <= 0) { e.lastHp = e.hp; return; }
  const weapon = state.player?.weapon;

  if (t.forestStalker) {
    if (weapon === "splinter_bow") {
      e.natureRootT = 0;
      for (const u of activeUnits()) {
        if ((u.rooted || 0) > 0) u.rooted = Math.max(0, u.rooted - 2.5);
      }
      spawnParticles(e.x, groundY - t.w * 0.8, 8, "#8fd05a", 80, 95);
    }
    if (weapon === "lumberjack_axe") {
      e.hp -= taken * 0.45;
      e.biomeVulnerable = Math.max(e.biomeVulnerable || 0, 3.0);
      e.biomeStunned = Math.max(e.biomeStunned || 0, 0.35);
      floaty(e.x, "Bark cracked", "#d2b07a", 14);
    } else if ((e.biomeVulnerable || 0) > 0) {
      e.hp -= taken * 0.22;
    }
  }

  if (t.skadiWrath) {
    if ((e.cryoShield || 0) > 0 && weapon !== "icicle_spear" && weapon !== "blizzard_chime") {
      e.hp = Math.min(e.maxHp, e.hp + taken * 0.55);
      stunArchersNear(e.x, 650, 1.25, "#bfefff", 1);
      floaty(e.x, "Reflected", "#bfefff", 14);
      e.reflectFlash = 0.35;
      pushBossRing(e.x, 120, "#eaf6ff", 0.4, 5);
      spawnParticles(e.x, groundY + (e.fy || 0) - 40, 9, "#eaf6ff", 110, 80);
    } else if ((e.cryoShield || 0) > 0 && weapon === "icicle_spear") {
      e.cryoShield = 0;
      e.biomeStunned = Math.max(e.biomeStunned || 0, 0.65);
      e.hp -= taken * 0.3;
      spawnParticles(e.x, groundY + (e.fy || 0) - 35, 18, "#ffffff", 100, 130);
      floaty(e.x, "Shield broken", "#d8f8ff", 15);
    }
  }

  if (t.duneBroodmother && weapon === "sandstorm_sling") {
    e.blinded = Math.max(e.blinded || 0, 3.2);
    spawnParticles(e.x, groundY - t.w * 0.48, 8, "#d8b46a", 95, 55);
  }

  if (t.sunkenBehemoth) {
    if (weapon === "acid_blowgun") {
      e.healLocked = Math.max(e.healLocked || 0, 4.2);
      spawnParticles(e.x, groundY - t.w * 0.4, 9, "#7fe05a", 85, 75);
    }
    if (weapon === "gator_hammer" && (e.suckT || 0) > 0) {
      e.suckT = 0;
      e.biomeStunned = Math.max(e.biomeStunned || 0, 0.9);
      e.hp -= taken * 0.25;
      floaty(e.x, "Suction broken", "#b8ff7a", 15);
    }
  }

  if (t.ignitedCore && (weapon === "obsidian_brand" || weapon === "magma_mortar")) {
    e.coreHeat = Math.min(1.4, (e.coreHeat || 0) + taken / Math.max(80, e.maxHp * 0.08));
    if ((e.supernovaT || 0) > 0) e.supernovaDamage = (e.supernovaDamage || 0) + taken * (weapon === "magma_mortar" ? 1.3 : 1.0);
    if (weapon === "obsidian_brand") e.hp -= taken * 0.18;
  }

  if (t.voidMindflayer) {
    if (weapon === "shadow_scythe") {
      e.tentacleCut = Math.max(e.tentacleCut || 0, 3.4);
      for (const u of activeUnits("archer")) u.possessed = Math.min(u.possessed || 0, 0.45);
      e.hp -= taken * 0.25;
      floaty(e.x, "Tentacles cut", "#8c4cff", 14);
    }
    if (weapon === "possessed_heart") {
      e.maskCracked = Math.max(e.maskCracked || 0, 3.6);
      e.hp -= taken * 0.18;
      if (e.hp < e.maxHp * 0.18) e.hp -= taken * 0.25;
      spawnParticles(e.x, groundY + (e.fy || 0) - 60, 10, "#f0c8ff", 80, 110);
    }
  }

  e.hp = Math.min(e.maxHp, e.hp);
  e.lastHp = e.hp;
}

function releaseForestRoots(e, t) {
  const wall = golemWallAhead(e);
  const x = wall ? wall.x : state.base.x;
  pushBossRing(x, 190, "#b66bff", 0.72, 7);
  spawnParticles(x, groundY - 16, 34, "#6f8a42", 180, 120);
  spawnParticles(x, groundY - 42, 18, "#b66bff", 130, 150);
  if (wall) damageBiomeBossWall(e, t, wall, 1.15, "#b66bff");
  else damageBaseByBoss(e, t, 0.78, "#b66bff");
  if (!playerWeaponIs("splinter_bow")) rootBuildersInsideBase(4.8);
  if (!playerWeaponIs("lumberjack_axe")) stunArchersNear(x, 220, 1.7, "#b66bff");
  e.natureRootT = 5;
  Game.screenShake = Math.max(Game.screenShake || 0, 0.48);
}

function releaseSkadiFreeze(e, t) {
  const wall = strongestWall();
  const col = "#bfefff";
  if (wall) {
    const shieldCounter = playerWeaponIs("icicle_spear");
    wall.hp -= Math.round(t.dmg * (shieldCounter ? 0.32 : 0.52));
    wall.flash = Math.max(wall.flash || 0, 0.34);
    if (!shieldCounter) {
      wall.brittle = Math.max(wall.brittle || 0, 12);
      floaty(wall.x, "Brittle", col, 16);
    } else {
      floaty(wall.x, "Freeze cracked", "#ffffff", 15);
    }
    const ix = wall.x, iy = groundY - wallHeight(wall) * 0.58;
    pushBossRing(ix, 160, col, 0.7, 8);
    pushBossRing(ix, 96, "#ffffff", 0.5, 5);
    spawnParticles(ix, iy, 30, col, 125, 150);
    spawnParticles(ix, iy, 12, "#ffffff", 70, 120);
    spawnParticles(ix, groundY - 6, 16, "#eaf6ff", 90, 60);
    if (wall.hp <= 0) killWallByBoss(wall);
  } else {
    damageBaseByBoss(e, t, 0.62, col);
  }
  if (!playerWeaponIs("blizzard_chime")) stunArchersNear(state.base.x, 760, 1.4, col);
  Game.screenShake = Math.max(Game.screenShake || 0, 0.34);
  Audio.fireball();
}

function spawnAcidBossPool(x, r = 78, life = 6) {
  if (!state.firePools) state.firePools = [];
  state.firePools.push({ x, r, life, maxLife: life, tick: rand(0.25, 0.55), ph: rand(0, 6), kind: "acid", dmg: 1 });
}

function releaseDuneBreach(e, t) {
  const side = e.x < state.base.x ? -1 : 1;
  const wall = outerWallOnSide(side);
  let targetX = wall ? wall.x + wall.side * 74 : state.base.x + side * 430;
  if ((e.blinded || 0) > 0) targetX += pick([-1, 1]) * rand(240, 410);
  e.x = Math.max(480, Math.min(CFG.worldWidth - 480, targetX));
  e.burrowT = 0.55;
  const miss = (e.blinded || 0) > 0;
  const r = miss ? 130 : 210;
  pushBossRing(e.x, r, "#df8a3a", 0.62, 7);
  spawnParticles(e.x, groundY - 8, 46, "#d8b46a", 260, 110);
  spawnParticles(e.x, groundY - 26, 18, "#df8a3a", 120, 130);
  damageWallsInRange(e.x, r, Math.round(t.dmg * (miss ? 0.25 : 0.72)), "#df8a3a");
  damageUnitsInRange(e.x, r * 0.85, miss ? 1 : 2, "#df8a3a", { poison: 3.5, poisonDmg: 1, knock: miss ? 80 : 180 });
  for (let k = 0; k < 4; k++) spawnAcidBossPool(e.x + rand(-260, 260), rand(58, 82), 5.5);
  Game.screenShake = Math.max(Game.screenShake || 0, miss ? 0.22 : 0.58);
  Audio.hit();
}

function updateBehemothSuction(e, t, dt) {
  if ((e.suckT || 0) <= 0) return false;
  e.suckT = Math.max(0, e.suckT - dt);
  e.attackKind = "consume";
  e.attackAnim = Math.max(e.attackAnim || 0, 0.18);
  e.suckTick = (e.suckTick || 0.45) - dt;
  const radius = e.enraged ? 410 : 350;
  const pull = (obj, speed) => {
    const d = Math.max(1, dist(obj.x, e.x));
    if (d > radius) return false;
    obj.x += Math.sign(e.x - obj.x || 1) * Math.min(speed * dt, d * 0.12);
    return true;
  };

  if (Math.random() < dt * 18) spawnParticles(e.x + rand(-radius * 0.8, radius * 0.8), groundY - rand(8, 44), 1, "#b8ff7a", 28, 52);
  pushBossRing(e.x, radius * 0.78, "#b8ff7a", 0.12, 4);

  for (let i = state.coins.length - 1; i >= 0; i--) {
    const c = state.coins[i];
    if (!pull(c, 290)) continue;
    c.magnet = true;
    if (dist(c.x, e.x) < 20) {
      state.coins.splice(i, 1);
      if ((e.healLocked || 0) <= 0) {
        const heal = Math.min(10, Math.max(2, c.value || 1));
        e.hp = Math.min(e.maxHp, e.hp + heal);
        floaty(e.x, "+" + heal, "#b8ff7a", 13);
      } else {
        spawnParticles(e.x, groundY - t.w * 0.45, 4, "#7fe05a", 48, 60);
      }
    }
  }

  for (const u of activeUnits()) {
    if (dist(u.x, e.x) > radius) continue;
    if (u.onWall) {
      u.stunned = Math.max(u.stunned || 0, 0.45);
    } else {
      pull(u, 180);
      u.panic = Math.max(u.panic || 0, 0.75);
    }
  }

  const p = state.player;
  if (p && p.hp > 0 && !Game.inMine && dist(p.x, e.x) < radius && (p.jumpH || 0) + entityWallLift(p) <= 45) {
    p.x += Math.sign(e.x - p.x || 1) * Math.min(155 * dt, dist(p.x, e.x) * 0.08);
  }

  if (e.suckTick <= 0) {
    e.suckTick = 0.55;
    damageUnitsInRange(e.x, 130, 1, "#b8ff7a", { poison: 2.8, poisonDmg: 1 });
    if (p && dist(p.x, e.x) < 120 && (p.jumpH || 0) + entityWallLift(p) <= 35) damagePlayer(1, { knock: Math.sign(p.x - e.x || 1) * 120 });
  }
  return e.suckT > 0;
}

function releaseBehemothConsumption(e) {
  e.suckT = playerWeaponIs("acid_blowgun") ? 2.0 : 3.6;
  e.suckTick = 0.22;
  spawnParticles(e.x, groundY - 52, 28, "#b8ff7a", 150, 150);
  pushBossRing(e.x, 360, "#b8ff7a", 0.7, 8);
  Audio.dragonRoar();
}

function releaseVolcanoCracks(e, t) {
  const span = e.enraged ? 520 : 420;
  const count = e.enraged ? 6 : 5;
  for (let k = 0; k < count; k++) {
    const x = state.base.x + rand(-span, span);
    spawnFirePool(x, rand(52, 72), 5.6);
    pushBossRing(x, 78, "#ff6a28", 0.32, 4);
    for (const u of activeUnits()) {
      if (u.role === "builder" && dist(u.x, x) < 120 && !playerWeaponIs("magma_mortar")) {
        u.rooted = Math.max(u.rooted || 0, 2.1);
      }
    }
  }
  damageWallsInRange(state.base.x, span, Math.round(t.dmg * 0.24), "#ff6a28");
  spawnParticles(state.base.x, groundY - 12, 34, "#ff6a28", 280, 130);
  Game.screenShake = Math.max(Game.screenShake || 0, 0.5);
  Audio.fireball();
}

function startSupernova(e) {
  e.supernovaUsed = true;
  e.supernovaT = 10;
  e.supernovaDamage = 0;
  e.attackKind = "supernova";
  e.coreHeat = 1;
  Game.screenShake = Math.max(Game.screenShake || 0, 0.5);
  spawnParticles(e.x, groundY + (e.fy || 0) - 38, 44, "#fff0a0", 170, 240);
  floaty(e.x, "SUPERNOVA", "#fff0a0", 20);
  Audio.dragonRoar();
}

function updateSupernova(e, t, dt) {
  if ((e.supernovaT || 0) <= 0) return false;
  e.supernovaT = Math.max(0, e.supernovaT - dt);
  e.attackKind = "supernova";
  e.attackAnim = Math.max(e.attackAnim || 0, 0.2);
  e.coreHeat = Math.max(e.coreHeat || 0, 0.6 + (1 - e.supernovaT / 10) * 0.8);
  if (Math.random() < dt * 28) spawnParticles(e.x + rand(-75, 75), groundY + (e.fy || 0) - rand(20, 105), 1, "#fff0a0", 45, 120);
  pushBossRing(e.x, 210 + (10 - e.supernovaT) * 16, "#ff6a28", 0.12, 5);
  if (e.supernovaT > 0) return true;

  const needed = e.maxHp * (playerWeaponIs("obsidian_brand", "magma_mortar") ? 0.055 : 0.08);
  if ((e.supernovaDamage || 0) >= needed) {
    e.biomeStunned = 2.1;
    e.biomeVulnerable = 3.5;
    spawnParticles(e.x, groundY + (e.fy || 0) - 42, 40, "#caa46a", 180, 180);
    floaty(e.x, "Core interrupted", "#fff0a0", 18);
  } else {
    const side = e.x < state.base.x ? -1 : 1;
    const wall = outerWallOnSide(side) || strongestWall();
    if (wall) {
      killWallByBoss(wall);
      floaty(wall.x, "ASHED", "#ff6a28", 20);
    } else {
      damageBaseByBoss(e, t, 1.2, "#ff6a28");
    }
    spawnParticles(state.base.x, groundY - 50, 48, "#ff6a28", 260, 250);
    Game.screenShake = Math.max(Game.screenShake || 0, 0.9);
  }
  e.attackKind = "";
  e.coreHeat = 0.3;
  return false;
}

function releaseVoidPossession(e, t) {
  const counter = playerWeaponIs("shadow_scythe");
  let n = 0;
  for (const u of activeUnits("archer")) {
    if (dist(u.x, e.x) > 950 && Math.abs(u.x - CFG.baseX) > 820) continue;
    u.possessed = Math.max(u.possessed || 0, counter ? 1.2 : 5.5);
    u.possessShotCd = rand(0.2, 0.8);
    n++;
    spawnParticles(u.x, groundY - 58 - entityWallLift(u), 10, "#8c4cff", 60, 90);
  }
  if (!n) damageBaseByBoss(e, t, 0.48, "#8c4cff");
  pushBossRing(e.x, 320, "#8c4cff", 0.72, 8);
  floaty(e.x, n ? "Mass possession" : "Void lash", "#d7a8ff", 17);
  Audio.upgrade();
}

function updateMindflayerAura(e, t, dt) {
  e.goldDecayCd = (e.goldDecayCd || 5) - dt;
  if (e.goldDecayCd <= 0) {
    e.goldDecayCd = playerWeaponIs("possessed_heart") ? 7.5 : 5.0;
    const p = state.player;
    if (p && (p.coins || 0) > 0) {
      const loss = Math.min(p.coins, Math.max(1, Math.ceil(p.coins * (playerWeaponIs("possessed_heart") ? 0.03 : 0.08))));
      p.coins -= loss;
      floaty(p.x, "-" + loss + " gold", "#8c4cff", 14);
      spawnParticles(p.x, groundY - 46, 12, "#8c4cff", 70, 90);
    }
  }

  for (const u of activeUnits("archer")) {
    if ((u.possessed || 0) <= 0) continue;
    u.possessShotCd = (u.possessShotCd || 0.6) - dt;
    u.dir = Math.sign(state.base.x - u.x) || u.dir;
    if (u.possessShotCd > 0) continue;
    u.possessShotCd = 0.85 + Math.random() * 0.35;
    const allies = activeUnits().filter(o => o !== u && dist(o.x, u.x) < 520);
    const target = allies[0] || state.base;
    if (target === state.base) {
      state.base.hp = Math.max(0, state.base.hp - 1);
      state.base.flash = Math.max(state.base.flash || 0, 0.18);
      spawnParticles(state.base.x, groundY - 60, 7, "#8c4cff", 70, 80);
    } else {
      target.hp -= 1;
      target.panic = Math.max(target.panic || 0, 0.7);
      spawnParticles(target.x, groundY - 40 - entityWallLift(target), 7, "#8c4cff", 55, 80);
    }
    floaty(u.x, "Possessed", "#d7a8ff", 12);
  }
}

function startBiomeCast(e, t) {
  const cfg = BIOME_CASTS[e.type];
  if (!cfg) return false;
  e.biomeCastT = 0;
  e.biomeCastDur = cfg.dur;
  e.biomeCastKind = cfg.kind;
  e.attackKind = cfg.kind;
  e.attackAnim = 0.45;
  // Lock the Deep Freeze aim point so the channelled beam angles down at the
  // target instead of firing off into the air.
  if (cfg.kind === "deepFreeze") { const fw = strongestWall(); e.freezeTargetX = fw ? fw.x : state.base.x; }
  spawnParticles(e.x, groundY + (e.fy || 0) - t.w * 0.55, 16, t.eye, 90, 110);
  return true;
}

function releaseBiomeCast(e, t) {
  switch (e.biomeCastKind) {
    case "roots": releaseForestRoots(e, t); break;
    case "deepFreeze": releaseSkadiFreeze(e, t); break;
    case "breach": releaseDuneBreach(e, t); break;
    case "consume": releaseBehemothConsumption(e, t); break;
    case "lavaCracks": releaseVolcanoCracks(e, t); break;
    case "possess": releaseVoidPossession(e, t); break;
  }
}

function updateBiomeCast(e, t, dt) {
  if (e.biomeCastT === undefined) return false;
  e.biomeCastT += dt;
  e.attackKind = e.biomeCastKind;
  e.attackAnim = Math.max(e.attackAnim || 0, 0.18);
  if (Math.random() < dt * 18) spawnParticles(e.x + rand(-t.w * 0.45, t.w * 0.45), groundY + (e.fy || 0) - rand(35, t.w), 1, t.eye, 38, 76);
  if (e.biomeCastT < (e.biomeCastDur || 0.8)) return true;
  releaseBiomeCast(e, t);
  e.biomeCastT = undefined;
  e.biomeCastKind = "";
  e.attackKind = "";
  e.specialCd = (t.shootInterval || 7) * (e.enraged ? 0.68 : 1) + rand(-0.8, 0.7);
  return true;
}

function startBiomeWallAttack(e, t, w) {
  e.biomeWall = w;
  e.biomeWallAttackT = 0;
  e.biomeWallDidHit = false;
  e.attackKind = "wall";
  e.attackAnim = 0.34;
}

function updateBiomeWallAttack(e, t, dt) {
  if (e.biomeWallAttackT === undefined) return false;
  e.biomeWallAttackT += dt;
  e.attackKind = "wall";
  if (t.forestStalker && e.biomeWallAttackT < BIOME_WALL_ATTACK.impact && Math.random() < dt * 22) {
    // dirt/leaves kicked up during the charge windup, ahead of the lowered antlers
    spawnParticles(e.x + e.dir * t.w * 0.4, groundY - rand(4, 16), 1, Math.random() < 0.5 ? "#6f8a42" : "#8a6a3a", 60, 60);
  }
  if (!e.biomeWallDidHit && e.biomeWallAttackT >= BIOME_WALL_ATTACK.impact) {
    e.biomeWallDidHit = true;
    const mult = t.forestStalker ? 1.25 : t.sunkenBehemoth ? 1.15 : t.voidMindflayer ? 0.82 : 1;
    damageBiomeBossWall(e, t, e.biomeWall, mult, t.eye);
    if (t.forestStalker) {
      stunArchersNear(e.biomeWall.x, 190, playerWeaponIs("lumberjack_axe") ? 0.45 : 1.35, "#b66bff");
      spawnParticles(e.biomeWall.x, groundY - 20, 16, "#8a6a3a", 130, 90);
      spawnParticles(e.biomeWall.x, groundY - 30, 10, "#b66bff", 90, 100);
    }
    if (t.duneBroodmother) spawnAcidBossPool(e.biomeWall.x + e.biomeWall.side * 28, 60, 4.5);
  }
  if (e.biomeWallAttackT < BIOME_WALL_ATTACK.duration) return true;
  e.biomeWallAttackT = undefined;
  e.biomeWall = null;
  e.biomeWallDidHit = false;
  e.biomeWallCooldown = BIOME_WALL_ATTACK.recover;
  e.attackKind = "";
  return true;
}

function biomeBossMeleePlayer(e, t) {
  const p = state.player;
  if (!p || p.hp <= 0 || Game.inMine || e.biomeMeleeCd > 0) return false;
  const reach = t.w * 0.55 + 38;
  if (dist(e.x, p.x) > reach) return false;
  if ((p.jumpH || 0) + entityWallLift(p) > (t.flying ? 130 : 55)) return false;
  e.biomeMeleeCd = t.sunkenBehemoth ? 1.25 : 0.95;
  e.attackAnim = 0.34;
  damagePlayer(t.meleeDmg || 2, { knock: Math.sign(p.x - e.x || 1) * (t.duneBroodmother ? 260 : 190) });
  spawnParticles(p.x, groundY - 42, 8, t.eye, 62, 78);
  return true;
}

function hoverBiomeBoss(e, t, dt) {
  if (!t.flying) { e.fy = Math.min(0, e.fy || 0); return; }
  const baseHover = t.skadiWrath ? -132 : t.ignitedCore ? -92 : -155;
  const hover = baseHover + Math.sin(e.anim * 0.62 + e.x * 0.005) * (t.ignitedCore ? 10 : 16);
  e.fy = (e.fy ?? hover) + (hover - (e.fy ?? hover)) * Math.min(1, dt * 1.8);
}

function moveBiomeBoss(e, t, dt) {
  const wallAhead = golemWallAhead(e);
  const p = state.player;
  const playerNearby = p && p.hp > 0 && !Game.inMine && dist(e.x, p.x) < (t.flying ? 720 : 560);
  let targetX = wallAhead ? golemWallStandX(wallAhead, t) : state.base.x;
  if (playerNearby && (!wallAhead || dist(e.x, p.x) < dist(e.x, wallAhead.x) - 80)) targetX = p.x;

  const remaining = targetX - e.x;
  e.dir = Math.sign(remaining) || e.dir;
  if (Math.abs(remaining) <= 2) return wallAhead;
  const slowMult = e.rooted > 0 ? 0.05 : (e.frost > 0 ? 0.45 : (e.slow > 0 ? 0.62 : 1));
  const statusMult = (e.blinded || 0) > 0 ? 0.72 : 1;
  const approachMult = approachSpeedMult(Math.abs(state.base.x - e.x));
  const sprintMult = unopposedSprintMult(e);
  const speed = t.speed * (e.enraged ? 1.22 : 1) * slowMult * statusMult * approachMult * sprintMult;
  const stepDist = Math.min(Math.abs(remaining), speed * dt);
  e.x += Math.sign(remaining) * stepDist;
  e.biomeWalkPhase = (e.biomeWalkPhase || 0) + dt * (t.flying ? 1.4 : 2.2) * slowMult;
  if (!t.flying && Math.sin(e.biomeWalkPhase * Math.PI * 2) > 0.94 && !e.biomeStep) {
    e.biomeStep = true;
    Game.screenShake = Math.max(Game.screenShake || 0, t.sunkenBehemoth ? 0.09 : 0.05);
    spawnParticles(e.x - e.dir * 20, groundY - 4, 3, t.color, 42, 34);
  } else if (Math.sin(e.biomeWalkPhase * Math.PI * 2) < 0.3) {
    e.biomeStep = false;
  }
  return wallAhead;
}

function updateBiomeBoss(e, t, dt) {
  initBiomeBoss(e, t);
  if (e.knock) e.knock = 0;
  if (t.fireImmune && e.burn) { e.burn = 0; e.ignited = false; e.burnDmg = 0; }
  hoverBiomeBoss(e, t, dt);
  updateBiomeTimers(e, t, dt);
  reactToBiomeBossDamage(e, t);

  if (e.hp <= 0) {
    killEnemyWithAnimation(e, Math.sign(e.x - (state.player?.x ?? state.base.x)) || 1);
    return;
  }
  e.lastHp = e.hp;

  if (!e.enraged && e.hp < e.maxHp * 0.42) {
    e.enraged = true;
    e.enrageFlash = 1.2;
    e.specialCd = Math.min(e.specialCd || 3, 1.1);
    spawnParticles(e.x, groundY + (e.fy || 0) - t.w * 0.55, 36, t.eye, 180, 220);
    Game.screenShake = Math.max(Game.screenShake || 0, 0.55);
    Audio.dragonRoar();
  }

  if (t.forestStalker && Math.random() < dt * (e.enraged ? 10 : 5)) {
    // Corruption mist wisping off the antlers — thicker and redder once enraged.
    spawnParticles(e.x + e.dir * t.w * 0.42, groundY - t.w * 0.92, 1, e.enraged ? "#8a4bd6" : "#b66bff", 22, 55);
  }
  if (t.voidMindflayer) updateMindflayerAura(e, t, dt);
  if (t.ignitedCore && !e.supernovaUsed && e.hp < e.maxHp * 0.5) startSupernova(e);
  if (updateSupernova(e, t, dt)) return;
  if (updateBehemothSuction(e, t, dt)) return;
  if ((e.biomeStunned || 0) > 0) {
    e.attackKind = "stunned";
    if (Math.random() < dt * 10) spawnParticles(e.x + rand(-t.w * 0.25, t.w * 0.25), groundY + (e.fy || 0) - t.w * 0.55, 1, t.eye, 30, 50);
    return;
  }

  e.specialCd -= dt;
  if (updateBiomeCast(e, t, dt)) return;
  if (updateBiomeWallAttack(e, t, dt)) return;
  if (biomeBossMeleePlayer(e, t)) return;

  const wallAhead = moveBiomeBoss(e, t, dt);
  if (wallAhead && Math.abs(e.x - golemWallStandX(wallAhead, t)) <= 3) {
    if (e.biomeWallCooldown <= 0) startBiomeWallAttack(e, t, wallAhead);
    return;
  }

  if (!wallAhead && dist(e.x, state.base.x) < t.w * 0.55 + 52 && e.biomeMeleeCd <= 0) {
    e.biomeMeleeCd = 1.15;
    damageBaseByBoss(e, t, 0.72, t.eye);
    return;
  }

  const p = state.player;
  const canSpecial = e.specialCd <= 0
    && (Math.abs(e.x - state.base.x) < 1650 || (p && !Game.inMine && dist(e.x, p.x) < 850));
  if (canSpecial) startBiomeCast(e, t);
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
    const isAcid = p.kind === "acid";
    const isMud = p.kind === "mud";
    const playerOwned = p.source === "player";
    p.life -= dt;
    const poolCol = isVoid ? "#8a5aff" : isAcid ? "#7fe05a" : isMud ? "#5f6f3a" : "#ff6a20";
    const poolHi = isVoid ? "#d7f6ff" : isAcid ? "#b8ff7a" : isMud ? "#b8b86a" : "#ffd060";
    if (Math.random() < dt * (isVoid ? 10 : 14)) spawnParticles(p.x + rand(-p.r * 0.8, p.r * 0.8), groundY - 4, 1, poolCol, 14, isVoid ? 62 : 42);
    if (Math.random() < dt * (isVoid ? 7 : 5))  spawnParticles(p.x + rand(-p.r * 0.6, p.r * 0.6), groundY - 6, 1, poolHi, 8, isVoid ? 72 : 52);
    if (isVoid && p.pull) {
      if (playerOwned) {
        for (const e of state.enemies) {
          if (e.fleeing || e.dying || e.hp <= 0) continue;
          if (dist(p.x, e.x) >= p.r * 1.2 || ENEMY_TYPES[e.type]?.noKnockback) continue;
          e.x += Math.sign(p.x - e.x || 1) * Math.min(85 * dt, Math.abs(p.x - e.x) * 0.1);
          e.slow = Math.max(e.slow || 0, 0.3);
        }
      } else {
        if (player && player.hp > 0 && !Game.inMine && dist(p.x, player.x) < p.r * 1.15
            && (player.jumpH || 0) + entityWallLift(player) <= 45) {
          player.x += Math.sign(p.x - player.x || 1) * Math.min(70 * dt, Math.abs(p.x - player.x) * 0.08);
        }
        for (const u of state.units) {
          if (u.hp <= 0 || u.dying || u.mine || u.onWall) continue;
          if (dist(p.x, u.x) < p.r * 1.1) u.x += Math.sign(p.x - u.x || 1) * Math.min(55 * dt, Math.abs(p.x - u.x) * 0.08);
        }
      }
    }
    p.tick -= dt;
    if (p.tick <= 0) {
      p.tick = isVoid ? 0.9 : 0.85;
      if (playerOwned) {
        p.tick = isVoid ? 0.58 : 0.66;
        for (const e of state.enemies) {
          if (e.fleeing || e.dying || e.hp <= 0 || dist(p.x, e.x) >= p.r) continue;
          const dmg = p.dmg || 1;
          const ey = groundY + (e.fy || 0) - 24;
          e.hp -= dmg;
          e.flash = Math.max(e.flash || 0, 0.1);
          if (isVoid) {
            e.slow = Math.max(e.slow || 0, 0.5);
          } else if (isAcid) {
            e.poison = Math.max(e.poison || 0, 2.2);
            e.poisonTick = Math.min(e.poisonTick || 1, 0.55);
            e.poisonDmg = Math.max(e.poisonDmg || 0, p.burnDmg || 1);
            e.slow = Math.max(e.slow || 0, 0.35);
          } else {
            e.burn = Math.max(e.burn || 0, 2.2);
            e.burnTick = Math.min(e.burnTick || 1, 0.6);
            e.burnDmg = Math.max(e.burnDmg || 0, p.burnDmg || 1);
            e.ignited = true;
          }
          spawnParticles(e.x, ey, 5, poolCol, 42, 58);
          spawnImpBlood(e, 0.35, ey);
          floaty(e.x, "-" + dmg, isVoid ? "#ddaaff" : isAcid ? "#7fe05a" : "#ff8840");
          if (e.hp <= 0) killEnemy(e);
        }
      } else {
        if (isMud) {
          if (player && dist(p.x, player.x) < p.r
              && (player.jumpH || 0) + entityWallLift(player) <= 20) {
            player.mudSlow = Math.max(player.mudSlow || 0, 0.6);
          }
          for (const u of state.units) {
            if (u.hp <= 0 || u.dying || u.onWall || u.mine) continue;
            if (dist(p.x, u.x) < p.r) {
              u.panic = Math.max(u.panic || 0, 0.4);
              u.cooldown = Math.max(u.cooldown || 0, 0.22);
            }
          }
          continue;
        }
        if (player && dist(p.x, player.x) < p.r
            && (player.jumpH || 0) + entityWallLift(player) <= 20) {
          if (damagePlayer(p.dmg || 1) !== null) spawnParticles(player.x, groundY - 40, 7, poolCol, 60, 80);
        }
        for (const u of state.units) {
          if (u.hp <= 0 || u.dying || u.onWall || u.mine) continue;
          if (dist(p.x, u.x) < p.r) {
            u.hp -= p.dmg || 1;
            u.panic = 1;
            spawnParticles(u.x, groundY - 30, 4, poolCol, 40, 60);
          }
        }
      }
    }
    if (p.life <= 0) pools.splice(i, 1);
  }
}
