import { CFG } from '../config/config.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { dist, rand } from '../util/math.js';
import { groundY } from '../canvas.js';
import { state } from '../state.js';
import { Audio } from './Audio.js';
import { spawnParticles, floaty } from './SpawnSystem.js';
import { meleeHitPlayer } from './PlayerCombat.js';
import { killEnemy } from '../util/EnemyUtils.js';
import { updateLegendaryBoss } from './BossAI.js';

function wallAt(side, x) {
  let best = null;
  for (const w of state.walls) {
    if (!w.commissioned || w.hp <= 0 || w.side !== side) continue;
    if (side < 0 && w.x > x && w.x < CFG.baseX) { if (!best || w.x < best.x) best = w; }
    if (side > 0 && w.x < x && w.x > CFG.baseX) { if (!best || w.x > best.x) best = w; }
  }
  return best;
}

// Initialize enemy AI state
function initEnemyAI(e) {
  if (e.aiState === undefined) {
    e.aiState = "idle";
    e.stateTimer = 0;
    e.attackWindup = 0;
  }
}

// Transition to a new AI state
function changeState(e, newState, duration = 0) {
  e.aiState = newState;
  e.stateTimer = duration;
}

export function updateEnemies(dt) {
  const { enemies, units, base, player } = state;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const t = ENEMY_TYPES[e.type];

    initEnemyAI(e);

    if (e.home !== undefined) { updateLocEnemy(e, t, dt); continue; }
    if (t.legendary) {
      updateLegendaryBoss(e, t, dt);
      continue;
    }

    if (t.flying) {
      e.anim += dt * 5;
      if (e.flash > 0) e.flash -= dt;
      e.attackCd -= dt;
      if (e.shootCd !== undefined) e.shootCd -= dt;
      if (e.fleeing) {
        const tx = e.portal ? e.portal.x : (e.x < CFG.baseX ? 0 : CFG.worldWidth);
        e.dir = Math.sign(tx - e.x); e.x += e.dir * t.speed * 1.6 * dt;
        if (dist(e.x, tx) < 40) enemies.splice(i, 1);
        continue;
      }
      e.dir = Math.sign(base.x - e.x) || e.dir;
      e.x += e.dir * t.speed * dt;
      if (e.shootCd !== undefined && e.shootCd <= 0 && dist(e.x, player.x) < 380) {
        const arrowY = groundY + (e.fy || -80);
        state.arrows.push({ x: e.x, y: arrowY, vx: Math.sign(player.x - e.x) * 320, vy: 180, target: {x: player.x}, life: 1.5, hitKind: "player" });
        e.shootCd = 2.2;
        Audio.bow();
      }
      if (dist(e.x, player.x) < 28 && e.attackCd <= 0 && player.invuln <= 0 && !window._DEV_GOD_MODE) {
        player.hp -= 1; player.invuln = CFG.playerInvuln; player.hurt = 0.35; player.hpShowTimer = 3;
        spawnParticles(player.x, groundY - 50, 5, "#c1453b");
        Audio.hit();
        e.attackCd = 1.5; e.fleeing = true;
      }
      continue;
    }

    e.anim += dt * 5;
    if (e.flash > 0) e.flash -= dt;
    if (e.attackAnim > 0) e.attackAnim -= dt;
    e.attackCd -= dt;
    if (e.poisonCd !== undefined) e.poisonCd -= dt;

    // Handle knockback with recovery state
    if (e.knock) {
      e.x += e.knock * dt;
      e.knock *= Math.max(0, 1 - 9 * dt);
      if (Math.abs(e.knock) < 8) {
        e.knock = 0;
        // Enter recovery state after knockback
        if (e.aiState !== "recovery") changeState(e, "recovery", 0.35);
      }
    }

    if (e.burn > 0) {
      e.burn -= dt;
      e.burnTick = (e.burnTick || 0) - dt;
      if (e.burnTick <= 0) { e.hp--; e.flash = 0.08; e.burnTick = 0.5; spawnParticles(e.x, groundY-28, 1, "#ff6a20", 12, 8); if (e.hp<=0) { killEnemy(e); continue; } }
    }
    if (e.slow > 0) e.slow -= dt;

    // Update state timers
    if (e.stateTimer > 0) e.stateTimer -= dt;

    if (e.fleeing) {
      const tx = e.portal ? e.portal.x : (e.x < CFG.baseX ? 0 : CFG.worldWidth);
      e.dir = Math.sign(tx - e.x);
      e.x += e.dir * t.speed * 1.6 * dt;
      if (dist(e.x, tx) < 40) enemies.splice(i, 1);
      continue;
    }

    const side = e.x < CFG.baseX ? -1 : 1;
    const wall = wallAt(side, e.x);
    if (wall && dist(e.x, wall.x) < 30) {
      e.dir = Math.sign(wall.x - e.x) || e.dir;
      if (e.attackCd <= 0 && e.aiState !== "recovery") {
        changeState(e, "attacking", 0.5);
        e.attackCd = 0.7; e.attackAnim = 0.22;
        wall.hp -= t.dmg; wall.flash = 0.15;
        spawnParticles(wall.x, groundY - 30, 3, "#caa46a", 30, 30);
        Audio.hit();
        if (wall.hp <= 0) {
          wall.hp = 0; wall.level = 0; wall.commissioned = false; wall.buildProgress = 0;
          floaty(wall.x, "💥 Mur faldet!", "#ff6a4a");
          spawnParticles(wall.x, groundY - 30, 16, "#caa46a", 80, 80);
        }
      }
      continue;
    }

    if (e.aggroUnit && (!units.includes(e.aggroUnit) || dist(e.x, e.aggroUnit.x) > 340)) {
      e.aggroUnit = null;
    }

    if (dist(e.x, player.x) < 280 && e.carry === 0) {
      e.aggroPlayer = true;
      e.aggroTimer = 6;
    }

    if (e.aggroTimer > 0)
      e.aggroTimer -= dt;

    if (e.aggroPlayer && e.aggroTimer <= 0 && dist(e.x, player.x) > 700) {
      e.aggroPlayer = false;
    }

    if (e.aggroPlayer) {
      const d = dist(e.x, player.x);

      e.dir = Math.sign(player.x - e.x) || e.dir;

      // Handle attack state machine
      if (e.aiState === "recovery") {
        // Don't move or attack during recovery
        if (e.stateTimer <= 0) changeState(e, "chasing", 0);
      } else if (e.aiState === "attacking") {
        // Windup phase: stop moving, wait before attacking
        if (e.stateTimer <= 0) {
          if (d < 30 && player.jumpH <= 0 && player.invuln <= 0 && !window._DEV_GOD_MODE) {
            const hadCoins = player.coins > 0;
            if (meleeHitPlayer(e, t, 230) && hadCoins) e.carry++;
            changeState(e, "recovery", 0.4);
            e.attackCd = 1;
            e.attackAnim = 0.25;
          } else {
            changeState(e, "chasing", 0);
          }
        }
      } else {
        // Chasing phase: move towards player
        if (d > 24) e.x += e.dir * t.speed * 1.4 * dt;

        // Transition to attacking when close enough
        if (d < 30 && e.attackCd <= 0) {
          changeState(e, "attacking", 0.45 + Math.random() * 0.2);
        }
      }

      continue;
    }

    if (!e.aggroUnit) {
      let best = null, bd = 200;
      for (const u of units) { const d = dist(e.x, u.x); if (d < bd) { bd = d; best = u; } }
      if (best) e.aggroUnit = best;
    }
    if (e.aggroUnit) {
      const d = dist(e.x, e.aggroUnit.x);
      e.dir = Math.sign(e.aggroUnit.x - e.x) || e.dir;

      if (e.aiState === "recovery") {
        if (e.stateTimer <= 0) changeState(e, "chasing", 0);
      } else if (e.aiState === "attacking") {
        if (e.stateTimer <= 0) {
          const target = e.aggroUnit;
          if (target.role === "archer" && target.smoked > 0) {
            changeState(e, "chasing", 0);
          } else if (target.role === "archer" && target.smoked <= 0 && state.archerSkills.includes("smoke_bomb")) {
            target.smoked = 2.0;
            spawnParticles(target.x, groundY - 30, 20, "#aaaaaa", 70, 60);
            floaty(target.x, "💨 Røg!", "#cccccc");
            changeState(e, "recovery", 0.4);
            e.attackCd = 1.2; e.aggroUnit = null;
            Audio.hit();
          } else {
            changeState(e, "recovery", 0.4);
            e.attackCd = 0.8; e.attackAnim = 0.22;
            e.aggroUnit.hp -= 2; e.aggroUnit.panic = 1;
            spawnParticles(e.aggroUnit.x, groundY - 30, 3, "#7a1f1f");
            Audio.hit();
          }
        }
      } else {
        if (d > 32) e.x += e.dir * t.speed * 1.3 * dt;
        if (d < 40 && e.attackCd <= 0) {
          changeState(e, "attacking", 0.4 + Math.random() * 0.2);
        }
      }
      continue;
    }

    if (dist(e.x, base.x) < 70) {
      e.dir = Math.sign(base.x - e.x) || e.dir;
      if (e.attackCd <= 0 && e.aiState !== "recovery") {
        changeState(e, "attacking", 0.4);
        e.attackCd = 0.9; e.attackAnim = 0.22;
        base.hp -= t.dmg; base.flash = 0.2;
        spawnParticles(base.x + rand(-30, 30), groundY - 30, 4, "#ff6a4a");
        Audio.hit();
        const c = state.coins.find(cc => cc.settled && dist(cc.x, base.x) < 120);
        if (c) { e.carry++; state.coins.splice(state.coins.indexOf(c), 1); e.fleeing = true; }
      }
      continue;
    }


    if (t.rangedShoot && e.poisonCd <= 0 && dist(e.x, player.x) < t.shootRange && e.aiState !== "recovery") {
      const launchY = groundY - t.w * 0.7;
      const dx = player.x - e.x;
      const flightT = 1.4;
      const vx = dx / flightT;
      const vy = ((groundY - 40) - launchY - 0.5 * 500 * flightT * flightT) / flightT;
      state.poisonShots.push({ x: e.x, y: launchY, vx, vy, life: flightT + 0.4, landX: player.x, dmg: t.meleeDmg, sourceEnemy: e });
      e.poisonCd = t.shootInterval;
      e.attackAnim = 0.18;
      spawnParticles(e.x, launchY, 6, "#9944cc", 40, 30);
      Audio.bow();
    }

    // Default movement: walk towards base if not in a special state
    if (e.aiState !== "attacking" && e.aiState !== "recovery") {
      e.dir = Math.sign(base.x - e.x) || e.dir;
      const slowMult = e.slow > 0 ? 0.45 : 1;
      e.x += e.dir * t.speed * slowMult * dt;
    }
  }
}

function updateLocEnemy(e, t, dt) {
  const { player } = state;
  if (e.flash > 0) e.flash -= dt;
  e.attackCd -= dt;
  if (e.stateTimer > 0) e.stateTimer -= dt;

  if (e.knock) {
    e.x += e.knock * dt;
    e.knock *= Math.max(0, 1 - 9 * dt);
    if (Math.abs(e.knock) < 8) {
      e.knock = 0;
      if (e.aiState !== "recovery") changeState(e, "recovery", 0.35);
    }
  }

  const prevX = e.x;
  const dp = dist(e.x, player.x);

  if (dp < 300) {
    const dir = Math.sign(player.x - e.x);
    e.dir = dir || e.dir;

    if (e.aiState === "recovery") {
      if (e.stateTimer <= 0) changeState(e, "chasing", 0);
    } else if (e.aiState === "attacking") {
      if (e.stateTimer <= 0) {
        if (dp < 32 && player.jumpH <= 0 && player.invuln <= 0 && !window._DEV_GOD_MODE) {
          changeState(e, "recovery", 0.4);
          e.attackCd = 1.0;
          meleeHitPlayer(e, t, 220);
        } else {
          changeState(e, "chasing", 0);
        }
      }
    } else {
      e.x += dir * t.speed * dt;
      if (dp < 32 && e.attackCd <= 0) {
        changeState(e, "attacking", 0.4 + Math.random() * 0.2);
      }
    }
  } else if (dist(e.x, e.home) > 50) {
    const dir = Math.sign(e.home - e.x);
    e.dir = dir || e.dir;
    if (e.aiState !== "recovery") {
      e.x += dir * t.speed * 0.45 * dt;
    } else if (e.stateTimer <= 0) {
      changeState(e, "chasing", 0);
    }
  }
  if (Math.abs(e.x - prevX) > 0.02) e.anim += dt * 5;
}
