import { CFG } from '../../config/config.js';
import { dist, rand, applyCrit } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnParticles, floaty, spawnEnemy } from '../world/SpawnSystem.js';
import { killEnemyWithAnimation } from '../../util/EnemyUtils.js';

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

function golemShockwave(e, t) {
  const { player } = state;
  Game.screenShake = Math.max(Game.screenShake || 0, 0.55);
  spawnParticles(e.x, groundY - 6, 26, "#6b5a45", 200, 130);
  spawnParticles(e.x, groundY - 8, 16, "#ff6a20", 150, 110);
  spawnParticles(e.x, groundY - 8, 8, "#ffd060", 90, 130);
  Audio.hit();

  if (player && player.hp > 0 && !Game.inMine && dist(e.x, player.x) < GOLEM_SHOCK_RANGE
      && player.jumpH <= 30 && player.invuln <= 0 && !window._DEV_GOD_MODE) {
    player.hp -= t.meleeDmg || 2;
    player.invuln = CFG.playerInvuln;
    player.hurt = 0.35;
    player.hpShowTimer = 3;
    player.knock = Math.sign(player.x - e.x || 1) * 300;
    spawnParticles(player.x, groundY - 50, 8, "#c1453b");
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

function golemSlamTarget(e) {
  const { base, player, walls } = state;
  for (const w of walls) {
    if (w.commissioned && w.hp > 0 && dist(e.x, w.x) < GOLEM_SLAM_RANGE) return { kind: "wall", obj: w };
  }
  if (dist(e.x, base.x) < GOLEM_SLAM_RANGE + 20) return { kind: "base", obj: base };
  if (player && player.hp > 0 && !Game.inMine && dist(e.x, player.x) < GOLEM_SLAM_RANGE - 14) return { kind: "player", obj: player };
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
  }
  if (e.hurlAnim > 0) e.hurlAnim = Math.max(0, e.hurlAnim - dt);
  if (e.coreFlare > 0) e.coreFlare = Math.max(0, e.coreFlare - dt);
  if (e.eruptionAnim > 0) e.eruptionAnim = Math.max(0, e.eruptionAnim - dt);

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

  // --- slam in progress ---
  if (e.slamT !== undefined) {
    e.slamT += dt;
    if (e.slamT >= GOLEM_SLAM_WINDUP) {
      e.attackAnim = 0.42; // renderer: arms crashing down
      e.attackKind = "slam";
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

  // --- start a slam? ---
  if (e.slamCd <= 0 && golemSlamTarget(e)) {
    e.slamT = 0;
    e.attackKind = "slam";
    return;
  }

  // --- magma volley: three boulders, staggered ---
  if (e.hurlCount > 0) {
    e.hurlT -= dt;
    if (e.hurlT <= 0) {
      golemHurlBoulder(e, t);
      e.hurlCount--;
      e.hurlT = 0.38;
    }
    return; // stands still while hurling
  }
  if (e.volleyCd <= 0 && Math.abs(e.x - base.x) < 950) {
    e.hurlCount = e.enraged ? 4 : 3;
    e.hurlT = 0.1;
    e.attackKind = "hurl";
    e.hurlAnim = 0.35;
    e.volleyCd = (t.shootInterval || 7) * (e.enraged ? 0.62 : 1) + rand(-0.6, 0.8);
    return;
  }

  // --- march toward the base with ground-shaking steps ---
  e.dir = Math.sign(base.x - e.x) || e.dir;
  const slowMult = e.rooted > 0 ? 0.05 : (e.frost > 0 ? 0.45 : (e.slow > 0 ? 0.6 : 1));
  const speed = t.speed * (e.enraged ? 1.45 : 1) * slowMult;
  e.x += e.dir * speed * dt;
  const stepPhase = Math.sin(e.anim * 2.4);
  if (stepPhase > 0.92 && !e.stepped) {
    e.stepped = true;
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
      if (player && player.hp > 0 && !Game.inMine && dist(p.x, player.x) < p.r
          && player.jumpH <= 20 && player.invuln <= 0 && !window._DEV_GOD_MODE) {
        player.hp -= 1;
        player.invuln = CFG.playerInvuln;
        player.hurt = 0.35;
        player.hpShowTimer = 3;
        spawnParticles(player.x, groundY - 40, 7, "#ff6a20", 60, 80);
        Audio.hit();
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
