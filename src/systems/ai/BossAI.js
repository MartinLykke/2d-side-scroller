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

function killWallByBoss(w) {
  w.hp = 0; w.level = 0; w.commissioned = false; w.buildProgress = 0;
  spawnParticles(w.x, groundY - 30, 20, "#caa46a", 100, 100);
}

// ---------- Fire pools (magma boulder impact hazard) ----------

export function spawnFirePool(x, r = 66, life = 7) {
  if (!state.firePools) state.firePools = [];
  state.firePools.push({ x, r, life, maxLife: life, tick: rand(0.3, 0.7), ph: rand(0, 6) });
}

export function updateFirePools(dt) {
  const pools = state.firePools;
  if (!pools || !pools.length) return;
  const { player } = state;
  for (let i = pools.length - 1; i >= 0; i--) {
    const p = pools[i];
    p.life -= dt;
    if (Math.random() < dt * 14) spawnParticles(p.x + rand(-p.r * 0.8, p.r * 0.8), groundY - 4, 1, "#ff6a20", 14, 42);
    if (Math.random() < dt * 5)  spawnParticles(p.x + rand(-p.r * 0.6, p.r * 0.6), groundY - 6, 1, "#ffd060", 8, 52);
    p.tick -= dt;
    if (p.tick <= 0) {
      p.tick = 0.85;
      if (player && dist(p.x, player.x) < p.r
          && (player.jumpH || 0) + entityWallLift(player) <= 20) {
        if (damagePlayer(1) !== null) spawnParticles(player.x, groundY - 40, 7, "#ff6a20", 60, 80);
      }
      for (const u of state.units) {
        if (u.hp <= 0 || u.dying || u.onWall || u.mine) continue;
        if (dist(p.x, u.x) < p.r) {
          u.hp -= 1;
          u.panic = 1;
          spawnParticles(u.x, groundY - 30, 4, "#ff6a20", 40, 60);
        }
      }
    }
    if (p.life <= 0) pools.splice(i, 1);
  }
}
