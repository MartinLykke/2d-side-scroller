import { CFG, STATIONS_X } from '../../config/config.js';
import { ENEMY_TYPES } from '../../config/enemies.js';
import { clamp, dist, rand, pick } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnParticles, spawnCoin, floaty } from '../world/SpawnSystem.js';
import { shootArrow, killEnemy } from '../combat/Combat.js';
import { killEnemyWithAnimation, spawnImpBlood } from '../../util/EnemyUtils.js';
import { wallHeight } from '../../entities/Wall.js';
import { makeUnit } from '../../entities/Unit.js';
import { nearestChoppableTree, chopTree, nearestLog, deliverLog } from '../world/ForestSystem.js';

function hasSkill(id) { return state.archerSkills.includes(id); }

function archerShoot(u, x, h, tgt) {
  const skills = state.archerSkills;
  // Powershot: charge if standing still
  if (skills.includes("powershot")) {
    if (!u.moving) { u.powerTimer += 0.016; } else { u.powerTimer = 0; u.charged = false; }
    if (u.powerTimer >= 3) u.charged = true;
  }

  // Heavy Ballista overrides everything
  if (skills.includes("heavy_ballista")) {
    shootArrow(x, h, tgt, u);
    const arr = state.arrows[state.arrows.length - 1];
    if (arr) { arr.ballista = true; arr.vx *= 0.45; arr.vy *= 0.45; arr.pierce = 3; arr.dmgMult = 5; }
    u.shotCount = 0; u.charged = false; u.powerTimer = 0;
    return;
  }

  const isPowered = u.charged && skills.includes("powershot");
  u.shotCount = (u.shotCount || 0) + 1;
  const isFireArrow = skills.includes("fire_arrows") && u.shotCount % 4 === 0;

  shootArrow(x, h, tgt, u);
  const arr = state.arrows[state.arrows.length - 1];
  if (arr) {
    if (isFireArrow) arr.fireArrow = true;
    if (skills.includes("piercing_shot")) arr.pierce = 2;
    if (skills.includes("bouncing_volley")) arr.bouncing = true;
    if (isPowered) { arr.powered = true; arr.vx *= 1.5; arr.vy *= 1.5; arr.dmgMult = 3; arr.pierce = (arr.pierce||0) + 1; }
  }
  if (isPowered) { u.charged = false; u.powerTimer = 0; }

  // Double shot: second arrow with slight spread
  if (skills.includes("double_shot")) {
    const ang = Math.atan2(arr ? arr.vy : 0, arr ? arr.vx : 1);
    const sp = arr ? Math.hypot(arr.vx, arr.vy) : 560;
    const spread = 0.1;
    state.arrows.push({ ...arr,
      vx: Math.cos(ang + spread) * sp, vy: Math.sin(ang + spread) * sp,
      life: 1.2, fireArrow: isFireArrow,
      pierce: skills.includes("piercing_shot") ? 2 : 0,
      bouncing: skills.includes("bouncing_volley"),
    });
  }

  // Caltrops: drop when retreating
  if (skills.includes("caltrops") && Math.random() < 0.06) {
    state.caltrops.push({ x: u.x, life: 14 });
  }
}

export function nearestEnemy(x, range, includeFleeing = false) {
  let best = null, bd = range;
  for (const e of state.enemies) {
    if (!includeFleeing && e.fleeing) continue;
    const d = dist(x, e.x);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function moveToward(u, tx, speed, dt) {
  if (dist(u.x, tx) > 4) { u.dir = Math.sign(tx - u.x); u.x += u.dir * speed * dt; return false; }
  return true;
}

function archerWallCapacity(w) {
  return Math.max(2, w.level + 1);
}

function wallStandOffset(w, slot) {
  const cap = archerWallCapacity(w);
  const spacing = Math.min(16, Math.max(10, 56 / cap));
  return (slot - (cap - 1) / 2) * spacing;
}

function wallOccupancy(w) {
  return Game.wallSlots[w.x] || 0;
}

function reserveWallSlot(w) {
  if (!Game.wallSlots[w.x]) Game.wallSlots[w.x] = 0;
  const slot = Game.wallSlots[w.x]++;
  const cap = archerWallCapacity(w);
  return { slot, onWall: slot < cap };
}

function bestArcherWall(side) {
  let best = null, bestScore = 1e9;
  for (const w of state.walls) {
    if (!w.commissioned || w.hp <= 0 || w.buildProgress < 1 || w.side !== side) continue;
    const occ = wallOccupancy(w);
    const cap = archerWallCapacity(w);
    const overflow = Math.max(0, occ - cap + 1) * 1000;
    const score = overflow + occ * 40 - dist(w.x, CFG.baseX) * 0.01;
    if (score < bestScore) { best = w; bestScore = score; }
  }
  return best;
}

const ARCHER_CLIMB_SPEED = 1 / 3; // ~3 seconds to climb up or down a wall

function assignArcherPost(u, preferredSide, dt) {
  let wall = bestArcherWall(preferredSide);
  if (!wall) wall = bestArcherWall(-preferredSide);

  if (wall !== u.wall) u.wallClimbT = 0;
  u.wall = wall;

  if (!wall) {
    u.onWall = false;
    u.wallClimbT = 0;
    return CFG.baseX + preferredSide * 110;
  }

  const { slot, onWall: wantOnWall } = reserveWallSlot(wall);
  const postX = wantOnWall
    ? wall.x + wallStandOffset(wall, slot)
    : wall.x + Math.sign(CFG.baseX - wall.x) * (slot - archerWallCapacity(wall) + 1) * 26;

  // Archers must first walk to the foot of the wall before they can start climbing it
  const nearWall = dist(u.x, wall.x) < 60;
  const climbTarget = (wantOnWall && nearWall) ? 1 : 0;
  u.wallClimbT = clamp((u.wallClimbT || 0) + Math.sign(climbTarget - (u.wallClimbT || 0)) * ARCHER_CLIMB_SPEED * dt, 0, 1);
  if (Math.abs((u.wallClimbT || 0) - climbTarget) < 0.02) u.wallClimbT = climbTarget;
  u.onWall = u.wallClimbT >= 0.98;

  return postX;
}

function sunsetApproaching() {
  return Game.time > 0.56 && Game.time < 0.65 && !Game.isNight;
}

function peasantAI(u, dt) {
  if (sunsetApproaching() && dist(u.x, CFG.baseX) > 180) {
    moveToward(u, CFG.baseX, 120, dt); return;
  }
  if (dist(u.x, u.targetX) < 6 || Math.random() < 0.005)
    u.targetX = CFG.baseX + rand(-260, 260);
  moveToward(u, u.targetX, 30, dt);
}

function archerAI(u, dt) {
  // Nulstil den faste side, når det bliver dag igen
  if (!Game.isNight && !sunsetApproaching()) {
    u.fixedSide = null;
  }

  // Rally to legendary boss (Har højeste prioritet)
// --- FORBEDRET ARCHER BOSS LOGIK ---
  const lb = state.legendaryBoss;
  if (lb && !lb.fleeing) {
    const d = dist(u.x, lb.x);
    u.dir = Math.sign(lb.x - u.x) || u.dir;

    // Tjek om der er en sikker mur mellem skytten og bossen
    let wallDefending = null;
    for (const w of state.walls) {
      if (w.commissioned && w.hp > 0 && w.buildProgress >= 1) {
        // Hvis muren står mellem bueskytten og bossen
        if ((u.x < w.x && w.x < lb.x) || (lb.x < w.x && w.x < u.x)) {
          wallDefending = w;
          break;
        }
      }
    }

    if (wallDefending) {
      // Hvis vi har en mur som beskyttelse, så bliv på vores post/mur!
      const side = u.fixedSide || (u.x < CFG.baseX ? -1 : 1);
      const post = assignArcherPost(u, side, dt);
      moveToward(u, post, 84, dt);
    } else {
      // PANIK: Ingen mur beskytter os! Hold afstand (Kiting)
      const idealDist = 300;
      if (d < idealDist - 40) {
        // Bossen er for tæt på! Løb VÆK fra bossen
        u.dir = Math.sign(u.x - lb.x) || u.dir;
        u.x += u.dir * 110 * dt; // Løb hurtigt bagud
      } else if (d > idealDist + 40) {
        // For langt væk, gå tættere på indtil vi kan ramme
        moveToward(u, lb.x, 84, dt);
      }
    }

    // Skyd på bossen hvis inden for rækkevidde
    if (d < 580 && u.cooldown <= 0) {
      const shootH = u.onWall && u.wall && Math.abs(u.x - u.wall.x) < 40 ? wallHeight(u.wall) + 16 : 40;
      archerShoot(u, u.x, groundY - shootH, lb);
      u.cooldown = hasSkill("heavy_ballista") ? 2.2 : 0.75; // Lidt hurtigere skud mod bossen
      u.smokeReveal = 0.5;
    }
    return;
  }

  // Drop gold when near player
  if ((u.gold||0) > 0 && dist(u.x, state.player.x) < 90) {
    for (let g=0; g<u.gold; g++) spawnCoin(u.x+rand(-20,20), 1, groundY-20, rand(-50,50), rand(-200,-100));
    floaty(u.x, "+"+u.gold+"🪙", "#f2c14e");
    u.gold = 0;
  }
  // Drop gold when returning to base area
  if ((u.gold||0) > 0 && dist(u.x, CFG.baseX) < 80 && !nearestEnemy(u.x, 600)) {
    for (let g=0; g<u.gold; g++) spawnCoin(u.x+rand(-20,20), 1, groundY-20, rand(-40,40), rand(-180,-80));
    u.gold = 0;
  }

  const closeFoe = nearestEnemy(u.x, Game.isNight ? 620 : 500);

  // Smoke bomb: update smoked timer
  if (u.smoked > 0) u.smoked -= dt;
  if (u.smokeReveal > 0) u.smokeReveal -= dt;

  // Barrage: rapid-fire queue
  if (u.barrageCount > 0 && u.cooldown <= 0) {
    const tgt = nearestEnemy(u.x, 800, true);
    if (tgt) {
      const shootH = u.onWall && u.wall && Math.abs(u.x - u.wall.x) < 40 ? wallHeight(u.wall) + 16 : 40;
      archerShoot(u, u.x, groundY - shootH, tgt);
      u.dir = Math.sign(tgt.x - u.x) || u.dir;
    }
    u.barrageCount--;
    u.cooldown = 0.15;
    return;
  }

  // --- LOGIK FOR AFTEN OG NAT (PRE-NIGHT & NIGHT) ---
  if (Game.isNight || sunsetApproaching()) {
    // Tildel en fast side (højre/venstre) som ikke ændrer sig før næste dag
    const side = assignFixedSide(u);
    const post = assignArcherPost(u, side, dt);

    // Find kun fjender på skyttens EGEN tildelte side for at undgå at kigge mod den anden mur
    const sideFoe = state.enemies.find(e => !e.fleeing && Math.sign(e.x - CFG.baseX) === side && dist(u.x, e.x) < 520);

    // Bevægelse til posten
    if (!sideFoe || dist(u.x, sideFoe.x) > 150) {
      if (u.onWall && u.wall && hasSkill("grappling_hook") && dist(u.x, post) > 60) {
        u.x = post; u.wallClimbT = 1; u.onWall = true; // instant grapple
      } else {
        moveToward(u, post, Game.isNight ? 84 : 65, dt); // Lidt hurtigere om natten
      }
    }

    // Skyd hvis der er en fjende på din side
    if (sideFoe && u.cooldown <= 0) {
      const shootH = u.onWall && u.wall && Math.abs(u.x - u.wall.x) < 40 ? wallHeight(u.wall) + 16 : 40;
      archerShoot(u, u.x, groundY - shootH, sideFoe);
      u.cooldown = hasSkill("heavy_ballista") ? 2.2 : 0.8;
      u.dir = Math.sign(sideFoe.x - u.x) || u.dir;
      u.smokeReveal = 0.5;
    }
  } 
  // --- LOGIK FOR DAGTIMERNE ---
  else {
    // Hvis fjenden er faretruende tæt på om dagen, så ryk bagud og skyd
    const tooClose = nearestEnemy(u.x, 90);
    if (tooClose) {
      u.onWall = false; u.wall = null;
      u.dir = Math.sign(u.x - tooClose.x) || u.dir;
      u.x += u.dir * 100 * dt;
      if (u.cooldown <= 0) {
        archerShoot(u, u.x, groundY-36, tooClose);
        u.cooldown = hasSkill("heavy_ballista") ? 2.2 : 1.0;
        u.smokeReveal = 0.5;
      }
      return;
    }

    // No enemies about: hunt forest game for coin
    if (!closeFoe) {
      const prey = nearestAnimal(u.x, 460);
      if (prey) {
        u.onWall = false; u.wall = null;
        const d = dist(u.x, prey.x);
        if (d > 290) {
          moveToward(u, prey.x, 58, dt);
        } else {
          u.dir = Math.sign(prey.x - u.x) || u.dir;
          if (u.cooldown <= 0) {
            shootArrow(u.x, groundY - 36, prey, u);
            u.cooldown = 1.6;
          }
        }
        return;
      }
    }

    if (closeFoe) {
      u.onWall = false; u.wall = null;
      const d = dist(u.x, closeFoe.x);
      if (d > 240) moveToward(u, closeFoe.x, 64, dt);
      else {
        u.dir = Math.sign(closeFoe.x - u.x) || u.dir;
        if (u.cooldown <= 0) {
          archerShoot(u, u.x, groundY-36, closeFoe);
          u.cooldown = hasSkill("heavy_ballista") ? 2.2 : 1.1;
          u.smokeReveal = 0.5;
        }
      }
    } else {
      u.onWall = false; u.wall = null;
      const margin = 500;
      const outerEdge = u.patrolDir > 0 ? CFG.worldWidth - margin : margin;
      if (dist(u.x, outerEdge) < 60) u.patrolDir *= -1;
      u.dir = u.patrolDir;
      u.x += u.patrolDir * 58 * dt;
      
      if (hasSkill("powershot") && !u.moving) u.powerTimer = (u.powerTimer||0) + dt;
    }
  }
}

const BUILDER_TASK_SPEED = 200;

function builderAI(u, dt) {
  u.working = false;
  // Imps hunt builders, so any imp nearby sends the builder sprinting home.
  for (const e of state.enemies) {
    if (e.type !== "imp" || e.hp <= 0 || e.dying || e.fleeing) continue;
    if (dist(u.x, e.x) < 260) { u.panic = Math.max(u.panic || 0, 0.6); break; }
  }
  if (u.panic > 0) {
    if (u.pendingLog) { u.pendingLog.claimedBy = null; u.pendingLog = null; }
    if (u.carryLog) {
      u.carryLog.x = u.x;
      u.carryLog.lying = true;
      u.carryLog.claimedBy = null;
      u.carryLog.carriedBy = null;
      u.carryLog = null;
    } // drop the log and run
    u.dir = Math.sign(CFG.baseX - u.x) || u.dir;
    moveToward(u, CFG.baseX, 150, dt);
    return;
  }
  // A log already picked up gets carried home no matter what else is going on.
  if (u.carryLog) {
    if (moveToward(u, CFG.baseX, BUILDER_TASK_SPEED, dt)) {
      deliverLog(u.carryLog);
      u.carryLog = null;
    }
    return;
  }

  // Walls (build + repair) are always priority #1 for builders.
  let target = null, td = 1e9;
  for (const w of state.walls) {
    if (!w.commissioned) continue;
    if (!(w.buildProgress < 1 || w.hp < w.maxHp)) continue;
    const d = dist(u.x, w.x); if (d < td) { td = d; target = w; }
  }
  if (Game.isNight && target) {
    if (nearestEnemy(target.x, 220)) u.panic = 0.6;
  }
  if (u.panic > 0) {
    if (u.pendingLog) { u.pendingLog.claimedBy = null; u.pendingLog = null; }
    moveToward(u, CFG.baseX, 120, dt); return;
  }
  if (target) {
    if (moveToward(u, target.x, BUILDER_TASK_SPEED, dt)) {
      u.working = true;
      u.workTimer += dt;
      if (u.workTimer > 0.25) {
        u.workTimer = 0;
        if (target.buildProgress < 1) {
          target.buildProgress = clamp(target.buildProgress + 0.06, 0, 1);
          target.hp = target.maxHp * target.buildProgress;
          spawnParticles(target.x + rand(-8, 8), groundY - 20, 2, "#caa46a", 20, 30);
          Audio.build();
        } else if (target.hp < target.maxHp) {
          target.hp = clamp(target.hp + target.maxHp * 0.04, 0, target.maxHp);
          spawnParticles(target.x, groundY - 30, 1, "#caa46a", 15, 25);
        }
      }
    }
    return;
  }

  // No wall work pending: finish fetching a claimed log, or claim a new one.
  if (u.pendingLog && (u.pendingLog.chopped || u.pendingLog.carriedBy || u.pendingLog.claimedBy !== u)) u.pendingLog = null;
  if (u.pendingLog) {
    const log = u.pendingLog;
    if (moveToward(u, log.x, BUILDER_TASK_SPEED, dt)) {
      log.claimedBy = null;
      log.carriedBy = u;
      log.lying = false;
      u.carryLog = log; u.pendingLog = null;
    }
    return;
  }
  const freeLog = nearestLog(u.x);
  if (freeLog) { freeLog.claimedBy = u; u.pendingLog = freeLog; return; }

  // No logs waiting either: fell a marked forest tree, if any, while it's safe.
  const tree = nearestChoppableTree(u.x);
  if (Game.isNight && tree) {
    if (nearestEnemy(tree.x, 220)) u.panic = 0.6;
  }
  if (u.panic > 0) { moveToward(u, CFG.baseX, 120, dt); return; }

  if (sunsetApproaching() && !tree) {
    if (dist(u.x, CFG.baseX) > 180) { moveToward(u, CFG.baseX, 120, dt); return; }
  }
  if (!tree) {
    if (dist(u.x, u.targetX) < 8 || Math.random() < 0.004) u.targetX = CFG.baseX + rand(-160, 160);
    moveToward(u, u.targetX, 30, dt); return;
  }
  if (moveToward(u, tree.x, BUILDER_TASK_SPEED, dt)) {
    u.working = true;
    chopTree(tree, dt, u);
  } else {
    tree.beingChopped = false;
  }
}

function farmerAI(u, dt) {
  if (u.panic > 0) { moveToward(u, CFG.baseX, 150, dt); return; }
  if (sunsetApproaching() && dist(u.x, CFG.baseX) > 180) {
    moveToward(u, CFG.baseX, 120, dt); return;
  }
  const fx = STATIONS_X.farm;
  if (moveToward(u, fx, 36, dt)) {
    u.workTimer += dt;
    const lvl = state.farmLevel || 1;
    const interval = Math.max(1.2, 5 - (lvl - 1) * 0.85);
    if (u.workTimer > (Game.isNight ? 99 : interval)) {
      u.workTimer = 0;
      const coins = lvl >= 5 ? 3 : lvl >= 3 ? 2 : 1;
      for (let c = 0; c < coins; c++) spawnCoin(fx + rand(-24, 24), 1, groundY - 20, rand(-40, 40));
      spawnParticles(fx, groundY - 20, 4 + lvl, "#9bd05a", 20, 30);
    }
  }
}

function legacyGuardAI(u, dt) {
  // --- WALL PATROL: Go to furthest wall on own side (day and night) ---
  const guardSide = u.x < CFG.baseX ? -1 : 1;
  let furthestWall = null;
  let maxDist = -1;
  for (const w of state.walls) {
    if (!w.commissioned || w.hp <= 0 || w.buildProgress < 1) continue;
    // Check if wall is on guard's side
    const wallSide = w.x < CFG.baseX ? -1 : 1;
    if (wallSide !== guardSide) continue;
    const d = Math.abs(w.x - CFG.baseX);
    if (d > maxDist) { maxDist = d; furthestWall = w; }
  }
  if (furthestWall) {
    // Find position along wall - spread out guards by counting only gardes
    const allGardes = state.units.filter(gu => gu.role === "guard");
    const gardeIndex = allGardes.indexOf(u);
    const wallW = 40 + furthestWall.level * 10;
    const spacing = wallW / 2.5;
    const offset = (gardeIndex % 5) * spacing - wallW / 2; // Spread across 5 positions
    const targetX = furthestWall.x + offset;

    if (dist(u.x, targetX) > 25) {
      moveToward(u, targetX, 100, dt);
      return;
    }
    if (!u.onWall || u.wall !== furthestWall) {
      u.onWall = true;
      u.wall = furthestWall;
      return;
    }
    // Only attack enemies on the wall or very close to it
    const enemiesNear = state.enemies.filter(e => {
      if (e.fleeing) return false;
      if (dist(e.x, furthestWall.x) > 40) return false;
      // Only attack if enemy has stackPos (on wall) or is very close
      return e.stackPos !== undefined || dist(e.x, u.x) < 25;
    });
    for (const foe of enemiesNear) {
      if (u.cooldown <= 0) {
        foe.hp -= 1; foe.flash = 0.14;
        u.cooldown = 1.2; u.strike = 0.25;
        Audio.hit();
        spawnParticles(foe.x, groundY - 24, 4, "#8a2a4a", 40, 60);
        if (foe.hp <= 0) {
          if (u.role === "guard") {
            u.xp = (u.xp || 0) + 1;
            const xpNeeded = (u.level || 1) * 3;
            if (u.xp >= xpNeeded) {
              u.xp -= xpNeeded;
              u.level = (u.level || 1) + 1;
              state.guardSkillPoints = (state.guardSkillPoints || 0) + 1;
              floaty(u.x, `⬆ Niv.${u.level}! (+1ep 🛡️)`, "#f2c14e");
              spawnParticles(u.x, groundY - 30, 8, "#f2c14e", 50, 80);
            }
          }
          killEnemy(foe);
        }
        break;
      }
    }
    return;
  }

  // --- WALL DEFENSE: Climb walls to defend against enemies ---
  let needsWallDefense = null;
  for (const w of state.walls) {
    if (!w.commissioned || w.hp <= 0 || w.buildProgress < 1) continue;
    // Check if enemies are attacking this wall
    const enemiesNear = state.enemies.filter(e => dist(e.x, w.x) < 40 && !e.fleeing);
    if (enemiesNear.length > 0) {
      const wallD = dist(u.x, w.x);
      if (!needsWallDefense || wallD < dist(u.x, needsWallDefense.x)) {
        needsWallDefense = w;
      }
    }
  }

  if (needsWallDefense) {
    // Move toward the wall that needs defense
    if (dist(u.x, needsWallDefense.x) > 20) {
      moveToward(u, needsWallDefense.x, 100, dt);
      return;
    }
    // Try to climb the wall
    const onWall = u.onWall && u.wall === needsWallDefense;
    if (!onWall) {
      u.onWall = true;
      u.wall = needsWallDefense;
      u.wallClimbTimer = 0.5; // Small delay before defending
      return;
    }
    // While on wall, attack enemies below
    const enemiesNear = state.enemies.filter(e => dist(e.x, needsWallDefense.x) < 50 && !e.fleeing);

    // Check for impale opportunity (skill: impale_wall_climber)
    if (state.guardSkills.includes("impale_wall_climber")) {
      const climbingFoe = enemiesNear.find(e => e.type === "imp" && e.climbHeight && e.climbHeight > 0);
      if (climbingFoe && u.cooldown <= 0) {
        // Impale and throw the climbing imp far away
        climbingFoe.hp -= 5; // Extra damage from the impale
        climbingFoe.flash = 0.2;
        climbingFoe.knock = 280 * (Math.random() < 0.5 ? 1 : -1); // Throw it far in a random direction
        climbingFoe.climbHeight = 0; // Knock it off the wall
        u.cooldown = 1.2; u.strike = 0.35;
        Audio.hit();
        spawnParticles(climbingFoe.x, groundY - 24, 8, "#ff6a4a", 60, 100);
        if (climbingFoe.hp <= 0) {
          const et = ENEMY_TYPES[climbingFoe.type];
          u.xp = (u.xp || 0) + 1;
          const xpNeeded = (u.level || 1) * 3;
          if (u.xp >= xpNeeded) {
            u.xp -= xpNeeded;
            u.level = (u.level || 1) + 1;
            state.guardSkillPoints = (state.guardSkillPoints || 0) + 1;
            floaty(u.x, `⬆ Niv.${u.level}! (+1ep 🛡️)`, "#f2c14e");
            spawnParticles(u.x, groundY - 30, 8, "#f2c14e", 50, 80);
          }
          killEnemy(climbingFoe);
        }
        return;
      }
    }

    for (const foe of enemiesNear) {
      if (u.cooldown <= 0) {
        foe.hp -= 3; foe.flash = 0.14;
        u.cooldown = 0.7; u.strike = 0.25;
        Audio.hit();
        spawnParticles(foe.x, groundY - 24, 4, "#8a2a4a", 40, 60);
        if (foe.hp <= 0) {
          const et = ENEMY_TYPES[foe.type];
          u.xp = (u.xp || 0) + 1;
          const xpNeeded = (u.level || 1) * 3;
          if (u.xp >= xpNeeded) {
            u.xp -= xpNeeded;
            u.level = (u.level || 1) + 1;
            state.guardSkillPoints = (state.guardSkillPoints || 0) + 1;
            floaty(u.x, `⬆ Niv.${u.level}! (+1ep 🛡️)`, "#f2c14e");
            spawnParticles(u.x, groundY - 30, 8, "#f2c14e", 50, 80);
          }
          killEnemy(foe);
        }
        break;
      }
    }
    return;
  }

  // Come down from walls if no enemies attacking
  if (u.onWall) {
    u.onWall = false;
    u.wall = null;
  }

  // --- FORBEDRET GUARD BOSS LOGIK ---
  const lb = state.legendaryBoss;
  if (lb && !lb.fleeing) {
    const d = dist(u.x, lb.x);
    u.dir = Math.sign(lb.x - u.x) || u.dir;

    // Find den nærmeste mur på bossens side
    let frontlineWall = null;
    let bestWD = 1e9;
    for (const w of state.walls) {
      if (w.commissioned && w.hp > 0 && w.buildProgress >= 1) {
        const wd = dist(w.x, lb.x);
        if (wd < bestWD) { bestWD = wd; frontlineWall = w; }
      }
    }

    if (frontlineWall && dist(u.x, frontlineWall.x) > 150) {
      // Hvis vagten er langt væk fra frontlinje-muren, så ryk hen til den (lige foran den)
      const standX = frontlineWall.x + Math.sign(lb.x - frontlineWall.x) * 30; // Stå 30px foran muren
      moveToward(u, standX, 120, dt);
    } else {
      // Hvis bossen er inden for angrebsrækkevidde, eller vi ikke har flere mure: Angrib!
      if (d > 34) {
        u.x += u.dir * 120 * dt; // Gå kontrolleret mod bossen
      } else if (u.cooldown <= 0) {
        // Angrib bossen
        lb.hp -= 4; lb.flash = 0.12;
        u.cooldown = 0.6; u.strike = 0.25;
        Audio.hit();
        spawnParticles(lb.x, groundY - 30, 5, "#8a2a4a", 50, 70);
        if (lb.hp <= 0) killEnemy(lb);
      }
    }
    return;
  }

  // --- STANDARD MODSTANDER AI ---
  const foe = nearestEnemy(u.x, 300);
  if (foe) {
    const d = dist(u.x, foe.x);
    u.dir = Math.sign(foe.x - u.x) || u.dir;
    if (d > 34) {
      u.x += u.dir * 100 * dt;
    } else if (u.cooldown <= 0) {
      foe.hp -= 2; foe.flash = 0.14;
      u.cooldown = 0.85; u.strike = 0.25;
      Audio.hit();
      spawnParticles(foe.x, groundY - 24, 4, "#8a2a4a", 40, 60);
      if (foe.hp <= 0) {
        if (u.role === "guard") {
          u.xp = (u.xp || 0) + 1;
          const xpNeeded = (u.level || 1) * 3;
          if (u.xp >= xpNeeded) {
            u.xp -= xpNeeded;
            u.level = (u.level || 1) + 1;
            state.guardSkillPoints = (state.guardSkillPoints || 0) + 1;
            floaty(u.x, `⬆ Niv.${u.level}! (+1ep 🛡️)`, "#f2c14e");
            spawnParticles(u.x, groundY - 30, 8, "#f2c14e", 50, 80);
          }
        }
        killEnemy(foe);
      }
    }
    return;
  }

  // --- STANDARD PATRULJE (Hvis der ikke er fjender) ---
  const patrolL = CFG.baseX - 550, patrolR = CFG.baseX + 550;
  if (!u.patrolTarget || dist(u.x, u.patrolTarget) < 20)
    u.patrolTarget = clamp(CFG.baseX + (Math.random() < 0.5 ? -1 : 1) * rand(60, 450), patrolL, patrolR);
  moveToward(u, u.patrolTarget, 62, dt);
}

function grantGuardXP(u) {
  u.xp = (u.xp || 0) + 1;
  const xpNeeded = (u.level || 1) * 3;
  if (u.xp < xpNeeded) return;
  u.xp -= xpNeeded;
  u.level = (u.level || 1) + 1;
  state.guardSkillPoints = (state.guardSkillPoints || 0) + 1;
  floaty(u.x, `Niv.${u.level}! (+1ep)`, "#f2c14e");
  spawnParticles(u.x, groundY - 30, 8, "#f2c14e", 50, 80);
}

function guardDamageEnemy(u, foe, dmg, cooldown = 0.8) {
  if (!foe || foe.hp <= 0 || u.cooldown > 0) return false;
  foe.hp -= dmg;
  foe.flash = 0.14;
  spawnImpBlood(foe, 0.9 + dmg * 0.3);
  u.cooldown = cooldown;
  u.strike = 0.25;
  foe.combatTarget = u;
  if (foe.type === "imp" && (foe.aiState === "climbOver" || foe.wallTopWall || foe.breachedWall || u.aiState === "combat")) foe.aiState = "combat";
  Audio.hit();
  spawnParticles(foe.x, groundY - 24, 4, "#8a2a4a", 40, 60);
  if (foe.hp <= 0) {
    grantGuardXP(u);
    killEnemy(foe);
  }
  return true;
}

function guardImpaleWallImp(u, imp, wall) {
  if (!state.guardSkills.includes("impale_wall_climber")) return false;
  if (!u.onWall || u.wall !== wall || (u.impaleCd || 0) > 0) return false;
  if (!imp || imp.type !== "imp" || imp.hp <= 0 || imp.dying) return false;
  if (!(imp.wallTopWall === wall || imp.aiState === "climbOver")) return false;

  u.impaleCd = 5.5;
  u.cooldown = Math.max(u.cooldown, 0.9);
  u.strike = 0.45;
  u.dir = Math.sign(imp.x - u.x) || u.dir;

  const throwDir = Math.sign(imp.x - u.x) || -wall.side || u.dir || 1;
  imp.hp = -18;
  imp.fy = -Math.max(30, wallHeight(wall) - 10);
  imp.wallTopWall = null;
  imp.stackWallRef = null;
  imp.combatTarget = u;
  killEnemyWithAnimation(imp, throwDir);
  imp.deathKind = "impFallBack";
  imp.deathDuration = Math.max(imp.deathDuration || 0, 1.75);
  imp.knock = throwDir * 560;
  imp.deathVy = 90;
  imp.deathSpin = throwDir * 7.2;
  imp.deathGravity = 760;
  imp.deathFriction = 2.4;
  spawnImpBlood(imp, 4.2, groundY + (imp.fy || 0) - 18);
  spawnParticles(imp.x, groundY + (imp.fy || 0) - 18, 14, "#5a0710", 130, 120);
  Audio.hit();
  return true;
}

function guardWallPost(u, w) {
  const guards = state.units.filter(gu => gu.role === "guard");
  const idx = Math.max(0, guards.indexOf(u));
  const spread = Math.min(52, 24 + w.level * 8);
  return w.x + ((idx % 5) - 2) * (spread / 4);
}

function guardWallCapacity(w) {
  return Math.max(1, Math.min(5, w.level + 1));
}

function guardsAssignedToWall(w) {
  return state.units.filter(gu =>
    gu.role === "guard" &&
    gu.hp > 0 &&
    !gu.dying &&
    (gu.guardWall === w || gu.wall === w || (gu.combatTarget && gu.combatTarget.stackWallRef === w))
  );
}

function guardWallSlot(u, w) {
  const assigned = guardsAssignedToWall(w);
  if (!assigned.includes(u)) assigned.push(u);
  assigned.sort((a, b) => state.units.indexOf(a) - state.units.indexOf(b));
  return assigned.indexOf(u);
}

function guardHasWallSlot(u, w) {
  return guardWallSlot(u, w) < guardWallCapacity(w);
}

function guardWallTopX(u, w) {
  const cap = guardWallCapacity(w);
  const slot = Math.max(0, Math.min(cap - 1, guardWallSlot(u, w)));
  const spacing = Math.min(16, Math.max(10, 58 / cap));
  return w.x + (slot - (cap - 1) / 2) * spacing;
}

function guardDuelPositions(u, w) {
  const center = u.guardDuelCenterX ?? guardWallTopX(u, w);
  u.guardDuelCenterX = center;
  return {
    guardX: center - w.side * 11,
    impX: center + w.side * 11
  };
}

function clearGuardDuel(u) {
  u.guardDuelCenterX = null;
  u.guardDuelX = null;
  if (u.combatTarget && u.combatTarget.combatTarget === u) u.combatTarget.combatTarget = null;
}

function updateGuardWallClimb(u, w, wantsTop, dt) {
  u.guardWall = w;
  u.wall = w;
  const target = wantsTop ? 1 : 0;
  const speed = wantsTop ? 0.58 : 0.72;
  u.wallClimbT = clamp((u.wallClimbT || 0) + Math.sign(target - (u.wallClimbT || 0)) * speed * dt, 0, 1);
  if (Math.abs((u.wallClimbT || 0) - target) < 0.04) u.wallClimbT = target;
  u.onWall = u.wallClimbT >= 0.98;
}

function clearGuardWall(u, dt) {
  clearGuardDuel(u);
  if ((u.wallClimbT || 0) > 0) {
    if (!u.wall) {
      u.wallClimbT = 0;
      u.onWall = false;
      u.guardWall = null;
      return true;
    }
    updateGuardWallClimb(u, u.wall, false, dt);
    return false;
  }
  u.onWall = false;
  u.wall = null;
  u.guardWall = null;
  return true;
}

function nearestTopImpForWall(w, guard = null) {
  let best = null, bs = -1;
  for (const e of state.enemies) {
    if (e.type !== "imp" || e.fleeing || e.dying || e.hp <= 0) continue;
    if (e.stackWallRef !== w && e.wallTopWall !== w) continue;
    if (guard && e.combatTarget && e.combatTarget !== guard) continue;
    let score = e.aiState === "combat" ? 260 : e.aiState === "climbOver" ? 240 : e.aiState === "stacking" ? 120 : 0;
    if (guard && guard.combatTarget === e) score += 400;
    score += e.impIndex || 0;
    if (score > bs) { bs = score; best = e; }
  }
  return best;
}

function holdWallDuel(u, imp, wall, dt) {
  const duel = guardDuelPositions(u, wall);
  u.guardDuelX = duel.guardX;
  u.guardPostX = u.guardDuelCenterX;
  u.combatTarget = imp;
  imp.combatTarget = u;
  imp.duelGuardX = duel.guardX;
  imp.duelImpX = duel.impX;
  imp.duelWall = wall;
  if (dist(u.x, duel.guardX) > 2) moveToward(u, duel.guardX, 42, dt);
  u.dir = Math.sign(imp.x - u.x) || u.dir;
  imp.dir = Math.sign(u.x - imp.x) || imp.dir;
}

function densestGroundImpTarget(u) {
  let best = null, bestScore = -1;
  for (const e of state.enemies) {
    if (e.type !== "imp" || e.fleeing || e.dying || e.hp <= 0 || e.wallTopWall || e.aiState === "climbOver" || e.aiState === "stacking") continue;
    let nearby = 0;
    for (const other of state.enemies) {
      if (other.type !== "imp" || other.fleeing || other.dying || other.hp <= 0 || other.wallTopWall) continue;
      if (dist(e.x, other.x) < 90) nearby++;
    }
    const score = nearby * 100 - dist(u.x, e.x);
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best;
}

function nearestGuardWall(side) {
  let best = null, bd = -1;
  for (const w of state.walls) {
    if (!w.commissioned || w.hp <= 0 || w.buildProgress < 1 || w.side !== side) continue;
    const d = Math.abs(w.x - CFG.baseX);
    if (d > bd) { bd = d; best = w; }
  }
  return best;
}

function guardThreatScore(u, e) {
  if (e.fleeing || e.dying) return -1;
  let score = 260 - dist(u.x, e.x);
  if (e.type === "imp") {
    if (e.aiState === "combat") score += 260;
    if (e.wallTopWall) score += 250;
    if (e.aiState === "vaulting" || e.breachedWall) score += 230;
    if (e.aiState === "climbOver") score += 210;
    if (e.aiState === "stacking") score += 120 + (e.impIndex || 0) * 8;
  }
  if (Math.sign(e.x - CFG.baseX) === Math.sign(u.x - CFG.baseX)) score += 30;
  return score;
}

function chooseGuardTarget(u) {
  if (u.combatTarget && state.enemies.includes(u.combatTarget) && !u.combatTarget.fleeing && u.combatTarget.hp > 0) {
    return u.combatTarget;
  }
  let best = null, bs = -1;
  for (const e of state.enemies) {
    const score = guardThreatScore(u, e);
    if (score > bs) { bs = score; best = e; }
  }
  return bs > 0 ? best : null;
}

function guardAI(u, dt) {
  if (!u.aiState) u.aiState = "patrol";

  if (u.wall && u.onWall && guardHasWallSlot(u, u.wall)) {
    const wall = u.wall;
    const postX = guardWallTopX(u, wall);
    u.aiState = "guardWall";
    updateGuardWallClimb(u, wall, true, dt);
    const topThreat = nearestTopImpForWall(wall, u);
    if (topThreat) {
      holdWallDuel(u, topThreat, wall, dt);
      if (dist(u.x, topThreat.x) < 28) {
        if (guardImpaleWallImp(u, topThreat, wall)) return;
        guardDamageEnemy(u, topThreat, topThreat.aiState === "climbOver" ? 2 : 1, 0.85);
      }
    } else {
      clearGuardDuel(u);
      if (dist(u.x, postX) > 3) moveToward(u, postX, 46, dt);
      u.combatTarget = null;
    }
    return;
  }

  const target = chooseGuardTarget(u);
  if (target) {
    u.combatTarget = target;
    u.dir = Math.sign(target.x - u.x) || u.dir;

    const targetWall = target.stackWallRef || target.wallTopWall;
    if (targetWall && target.type === "imp" && (target.aiState === "stacking" || target.aiState === "climbOver" || target.wallTopWall)) {
      const slot = guardWallSlot(u, targetWall);
      const wantsTop = slot < guardWallCapacity(targetWall);
      if (!wantsTop) {
        const groundTarget = densestGroundImpTarget(u) || target;
        if (!clearGuardWall(u, dt)) return;
        u.combatTarget = groundTarget;
        const d = dist(u.x, groundTarget.x);
        u.dir = Math.sign(groundTarget.x - u.x) || u.dir;
        if (d > 18) moveToward(u, groundTarget.x, 118, dt);
        else guardDamageEnemy(u, groundTarget, 2, 0.8);
        return;
      }
      const postX = guardWallTopX(u, targetWall);
      if (dist(u.x, postX) > 8) {
        u.aiState = "defendWall";
        updateGuardWallClimb(u, targetWall, false, dt);
        moveToward(u, postX, 112, dt);
        return;
      }
      u.aiState = "defendWall";
      updateGuardWallClimb(u, targetWall, true, dt);
      if (u.onWall && dist(u.x, target.x) < 24 && (target.aiState === "climbOver" || target.wallTopWall || dist(target.x, targetWall.x) < 38)) {
        holdWallDuel(u, target, targetWall, dt);
        if (guardImpaleWallImp(u, target, targetWall)) return;
        const dmg = state.guardSkills.includes("impale_wall_climber") && target.aiState === "climbOver" ? 5 : 2;
        guardDamageEnemy(u, target, dmg, 0.75);
      }
      return;
    }

    if (!clearGuardWall(u, dt)) return;
    const d = dist(u.x, target.x);
    if (d > 18) {
      u.aiState = "engage";
      moveToward(u, target.x, 118, dt);
      return;
    }

    u.aiState = "combat";
    if (target.type === "imp") target.aiState = "combat";
    target.combatTarget = u;
    guardDamageEnemy(u, target, target.type === "imp" ? 2 : 3, target.type === "imp" ? 0.8 : 0.7);
    return;
  }

  clearGuardDuel(u);
  u.combatTarget = null;

  const lb = state.legendaryBoss;
  if (lb && !lb.fleeing) {
    if (!clearGuardWall(u, dt)) return;
    u.dir = Math.sign(lb.x - u.x) || u.dir;
    if (dist(u.x, lb.x) > 34) moveToward(u, lb.x, 105, dt);
    else guardDamageEnemy(u, lb, 4, 0.65);
    return;
  }

  const side = u.x < CFG.baseX ? -1 : 1;
  const wall = nearestGuardWall(side) || nearestGuardWall(-side);
  if (wall && (Game.isNight || sunsetApproaching())) {
    const topThreat = nearestTopImpForWall(wall, u);
    const slot = guardWallSlot(u, wall);
    const wantsTop = slot < guardWallCapacity(wall);
    if (!wantsTop) {
      const groundTarget = densestGroundImpTarget(u);
      if (groundTarget) {
        if (!clearGuardWall(u, dt)) return;
        u.aiState = "groundDefense";
        u.combatTarget = groundTarget;
        const d = dist(u.x, groundTarget.x);
        u.dir = Math.sign(groundTarget.x - u.x) || u.dir;
        if (d > 18) moveToward(u, groundTarget.x, 112, dt);
        else guardDamageEnemy(u, groundTarget, 2, 0.8);
        return;
      }
      u.aiState = "groundDefense";
      u.onWall = false;
      u.wall = null;
      u.guardWall = null;
      const holdX = CFG.baseX + (u.patrolDir || side || 1) * 130;
      moveToward(u, holdX, 62, dt);
      return;
    }
    const postX = guardWallTopX(u, wall);
    if (dist(u.x, postX) > 8) {
      u.aiState = "moveToWall";
      updateGuardWallClimb(u, wall, false, dt);
      moveToward(u, postX, 86, dt);
      return;
    }
    u.aiState = "guardWall";
    updateGuardWallClimb(u, wall, true, dt);
    if (u.onWall && topThreat && dist(u.x, topThreat.x) < 24) {
      holdWallDuel(u, topThreat, wall, dt);
      guardDamageEnemy(u, topThreat, topThreat.aiState === "climbOver" ? 2 : 1, 0.85);
    }
    return;
  }

  if (!clearGuardWall(u, dt)) return;
  u.aiState = "patrol";
  const patrolL = CFG.baseX - 550, patrolR = CFG.baseX + 550;
  if (!u.patrolTarget || dist(u.x, u.patrolTarget) < 20)
    u.patrolTarget = clamp(CFG.baseX + (Math.random() < 0.5 ? -1 : 1) * rand(60, 450), patrolL, patrolR);
  moveToward(u, u.patrolTarget, 62, dt);
}

function startUnitDeath(u) {
  if (u.dying) return;
  u.dying = true;
  u.deathT = 0;
  u.deathDuration = u.role === "guard" ? 1.45 : 1.25;
  u.deathDir = u.combatTarget ? Math.sign(u.x - u.combatTarget.x) || 1 : (u.dir || 1);
  u.deathSpin = (u.deathDir < 0 ? -1 : 1) * (u.role === "guard" ? 1.0 : 0.85);
  u.knock = (u.knock || 0) + u.deathDir * (u.role === "guard" ? 70 : 95);
  u.moving = false;
  u.working = false;
  u.combatTarget = null;
  spawnParticles(u.x, groundY - 30, u.role === "guard" ? 12 : 8, "#7a1f1f", 70, 80);
}

function getArcherSideCounts() {
  let left = 0, right = 0;
  for (const u of state.units) {
    if (u.role === 'archer' && u.fixedSide) {
      if (u.fixedSide === -1) left++;
      if (u.fixedSide === 1) right++;
    }
  }
  return { left, right };
}

function assignFixedSide(u) {
  // Hvis skytten allerede har en fast side for denne nat/aften, så hold fast i den
  if (u.fixedSide) return u.fixedSide;

  const counts = getArcherSideCounts();
  if (counts.left < counts.right) {
    u.fixedSide = -1;
  } else if (counts.right < counts.left) {
    u.fixedSide = 1;
  } else {
    // Hvis der er lige mange, vælg baseret på patrolDir eller tilfældighed
    u.fixedSide = u.patrolDir || (Math.random() < 0.5 ? -1 : 1);
  }
  return u.fixedSide;
}

// Dispatch table replaces the if/else chain in updateUnits.
const AI_HANDLERS = {
  archer:  archerAI,
  builder: builderAI,
  farmer:  farmerAI,
  peasant: peasantAI,
  guard:   guardAI,
};

export function updateUnits(dt) {
  const { units } = state;
  // Reset per-frame wall slot counter so archerAI can stagger archers across wall positions.
  Game.wallSlots = {};
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
    const px0 = u.x;
    u.cooldown -= dt;
    if (u.impaleCd > 0) u.impaleCd -= dt;
    if (u.panic > 0) u.panic -= dt;
    if (u.strike > 0) u.strike -= dt;
    if (u.dying) {
      u.deathT += dt;
      if (u.knock) { u.x = clamp(u.x + u.knock * dt, 120, CFG.worldWidth - 120); u.knock *= Math.max(0, 1 - 5 * dt); if (Math.abs(u.knock) < 2) u.knock = 0; }
      if (u.deathT >= (u.deathDuration || 1.25)) units.splice(i, 1);
      continue;
    }
    if (u.hp <= 0) { startUnitDeath(u); continue; }
    if (u.transform > 0) { u.transform -= dt; if (u.transform < 0) u.transform = 0; }
    if (u.knock) { u.x = clamp(u.x + u.knock * dt, 120, CFG.worldWidth - 120); u.knock *= 0.82; if (Math.abs(u.knock) < 6) u.knock = 0; }
    const handler = AI_HANDLERS[u.role];
    if (handler) handler(u, dt);
    u.moving = Math.abs(u.x - px0) > 0.04;
    u.moveSpeed = dt > 0 ? Math.abs(u.x - px0) / dt : 0;
    if (u.moving) u.anim += dt * (u.moveSpeed > 72 ? 11 : 8);
  }
}

function freePeasant() { return state.units.find(u => u.role === "peasant"); }

export function triggerBarrage() {
  if (!state.archerSkills.includes("barrage")) return;
  for (const u of state.units) {
    if (u.role === "archer") { u.barrageCount = 5; u.cooldown = 0; }
  }
  floaty(CFG.baseX, "🏹 Pilsregn!", "#f2c14e");
  Audio.bow();
}

export function updateCaltrops(dt) {
  const { caltrops, enemies } = state;
  for (let i = caltrops.length - 1; i >= 0; i--) {
    caltrops[i].life -= dt;
    if (caltrops[i].life <= 0) { caltrops.splice(i, 1); continue; }
    for (const e of enemies) {
      if (!e.fleeing && Math.abs(e.x - caltrops[i].x) < 16) {
        if (!e.slow || e.slow <= 0) {
          e.slow = 2;
          spawnParticles(e.x, groundY - 4, 3, "#888888", 20, 10);
        }
      }
    }
  }
}

export function updateAssignments() {
  if (state.pendingHammers > 0) {
    const p = freePeasant();
    if (p) { p.role = "builder"; p.hp = p.maxHp = 5; state.pendingHammers--; floaty(p.x, "🔨"); }
  }
  if (state.pendingFarmers > 0) {
    const p = freePeasant();
    if (p) { p.role = "farmer"; p.workTimer = 0; state.pendingFarmers--; floaty(p.x, "🌾"); }
  }
}

export function updateVagrants(dt) {
  const { vagrants, units, groundBows, groundHammers } = state;
  for (let i = vagrants.length - 1; i >= 0; i--) {
    const v = vagrants[i];

    if (!v.bowTarget && !v.hammerTarget) {
      let bestBow = null, bestD = 9999;
      for (const b of groundBows) {
        if (b.claimed) continue;
        const d = dist(v.x, b.x);
        if (d < bestD) { bestD = d; bestBow = b; }
      }
      if (bestBow) { bestBow.claimed = true; v.bowTarget = bestBow; }
    }

    if (v.bowTarget) {
      const bx = v.bowTarget.x;
      if (dist(v.x, bx) > 6) {
        v.vx = Math.sign(bx - v.x) * 58; v.x += v.vx * dt; v.anim += dt * 4;
      } else {
        const idx = groundBows.indexOf(v.bowTarget);
        if (idx !== -1) groundBows.splice(idx, 1);
        const u = makeUnit("archer", v.x);
        u.hp = u.maxHp = 6;
        u.transform = 0.55;
        u.dir = v.vx >= 0 ? 1 : -1;
        units.push(u);
        vagrants.splice(i, 1);
        floaty(v.x, "🏹 Bueskytte!");
        spawnParticles(v.x, groundY - 30, 14, "#9bd05a");
        Audio.upgrade();
      }
      continue;
    }

    if (!v.hammerTarget) {
      let bestHammer = null, bestD = 9999;
      for (const h of groundHammers) {
        if (h.claimed) continue;
        const d = dist(v.x, h.x);
        if (d < bestD) { bestD = d; bestHammer = h; }
      }
      if (bestHammer) { bestHammer.claimed = true; v.hammerTarget = bestHammer; }
    }

    if (v.hammerTarget) {
      const hx = v.hammerTarget.x;
      if (dist(v.x, hx) > 6) {
        v.vx = Math.sign(hx - v.x) * 58; v.x += v.vx * dt; v.anim += dt * 4;
      } else {
        const idx = groundHammers.indexOf(v.hammerTarget);
        if (idx !== -1) groundHammers.splice(idx, 1);
        const u = makeUnit("builder", v.x);
        u.hp = u.maxHp = 5;
        u.transform = 0.55;
        u.dir = v.vx >= 0 ? 1 : -1;
        units.push(u);
        vagrants.splice(i, 1);
        floaty(v.x, "🔨 Bygger!");
        spawnParticles(v.x, groundY - 30, 14, "#9bd05a");
        Audio.upgrade();
      }
      continue;
    }

    const target = v.targetX;
    const spd = v.speed || 38;
    if (dist(v.x, target) > 6) { v.vx = Math.sign(target - v.x) * spd; v.x += v.vx * dt; v.anim += dt * (spd > 80 ? 12 : 4); }
    else {
      v.vx = 0;
      if (dist(v.x, CFG.baseX) < 400) {
        units.push(makeUnit("peasant", v.x));
        vagrants.splice(i, 1);
        floaty(v.x, "🙋 Undersåt!");
        spawnParticles(v.x, groundY - 30, 8, "#cdbfa3");
        Audio.recruit();
      }
    }
  }
}

export function nearestAnimal(x, range) {
  let best = null, bd = range;
  for (const a of state.animals) {
    if (!a.alive || a.dying) continue;
    const d = dist(x, a.x);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}

// Bear: territorial predator. Chases and mauls any friendly character
// (player, units, vagrants) in sight. Ignores enemies entirely — and they
// ignore it, since it lives in the animals array, not the enemies array.
function updateBear(a, dt) {
  const { player, units, vagrants } = state;
  a.attackCd -= dt;
  if (a.attackAnim > 0) a.attackAnim -= dt;
  if (a.flash > 0) a.flash -= dt;

  // Sight: wider once already aggroed so victims can't juke it easily
  const sight = a.state === "chase" ? 430 : 320;
  let target = null, td = sight;
  if (player && player.hp > 0) { const d = dist(player.x, a.x); if (d < td) { td = d; target = player; } }
  for (const u of units) { const d = dist(u.x, a.x); if (d < td) { td = d; target = u; } }
  for (const v of vagrants) { const d = dist(v.x, a.x); if (d < td) { td = d; target = v; } }

  if (target) {
    a.state = "chase";
    a.dir = Math.sign(target.x - a.x) || a.dir;
    a.anim += dt * 9;
    if (td > 30) a.x += a.dir * 96 * dt;
    if (td < 36 && a.attackCd <= 0) {
      a.attackCd = 1.4;
      a.attackAnim = 0.4;
      Audio.hit();
      if (target === player) {
        if (player.invuln <= 0 && !window._DEV_GOD_MODE) {
          player.hp -= 1; player.invuln = CFG.playerInvuln; player.hurt = 0.35; player.hpShowTimer = 3;
          player.knock = Math.sign(player.x - a.x) * 160;
          spawnParticles(player.x, groundY - 50, 6, "#c1453b");
        }
      } else if (target.hp !== undefined) {
        target.hp -= 2; target.panic = 1;
        spawnParticles(target.x, groundY - 40, 6, "#c1453b");
      } else {
        // Vagrants have no hp — one swipe scares them off for good
        const idx = vagrants.indexOf(target);
        if (idx !== -1) { vagrants.splice(idx, 1); spawnParticles(target.x, groundY - 40, 8, "#c1453b"); floaty(target.x, "😱", "#cdbfa3"); }
      }
    }
  } else if (a.state === "chase") {
    a.state = "graze"; a.stateT = rand(2, 4);
  } else if (a.state === "walk") {
    a.stateT -= dt;
    a.anim += dt * 5;
    a.x += a.dir * 26 * dt;
    if (a.stateT <= 0) { a.state = "graze"; a.stateT = rand(3, 6); }
  } else { // graze / sniff around
    a.stateT -= dt;
    a.anim += dt * 3;
    if (a.stateT <= 0) { a.state = "walk"; a.stateT = rand(1.5, 3.5); a.dir = pick([-1, 1]); }
  }

  // Eating/sniffing head-bob reuses the shared grazing cycle
  a.headT -= dt;
  if (a.headT <= 0) { a.headUp = !a.headUp; a.headT = a.headUp ? rand(1, 2.2) : rand(2, 4.5); }
  const grazing = a.state === "graze" && !a.headUp;
  a.eatDown = clamp(a.eatDown + (grazing ? dt * 2 : -dt * 3), 0, 1);

  a.x = clamp(a.x, 800, CFG.worldWidth - 800);
}

export function updateAnimals(dt) {
  const { animals } = state;
  for (let i = animals.length - 1; i >= 0; i--) {
    const a = animals[i];
    if (!a.alive) { animals.splice(i, 1); continue; }

    // Dead: play the collapse, leave the body a moment, then remove
    if (a.dying) {
      a.deathT += dt;
      if (a.deathT > 5) a.alive = false;
      continue;
    }

    if (a.type === "bear") { updateBear(a, dt); continue; }

    const fleeing = a.state === "flee";
    a.anim += dt * (fleeing ? 10 : 6);

    // Spook when an archer or the player gets close
    let threat = null, td = 150;
    for (const u of state.units) {
      if (u.role !== "archer") continue;
      const d = dist(u.x, a.x); if (d < td) { td = d; threat = u; }
    }
    if (state.player) { const d = dist(state.player.x, a.x); if (d < td) { td = d; threat = state.player; } }
    if (threat) {
      a.state = "flee"; a.fleeT = 1.4;
      a.dir = Math.sign(a.x - threat.x) || 1;
    }

    if (a.state === "flee") {
      a.fleeT -= dt;
      // Deliberately slow enough that archers can pick them off
      if (a.type === "deer") {
        a.x += a.dir * 82 * dt;
      } else {
        // rabbit: erratic hopping — surges and near-stops
        a.x += a.dir * 68 * dt * (0.35 + Math.abs(Math.sin(a.anim * 0.9)));
      }
      if (a.fleeT <= 0) { a.state = "graze"; a.stateT = rand(2, 4); }
    } else if (a.state === "walk") {
      a.stateT -= dt;
      const hopPace = a.type === "rabbit" ? (0.3 + Math.abs(Math.sin(a.anim * 0.7))) : 1;
      a.x += a.dir * (a.type === "deer" ? 22 : 17) * dt * hopPace;
      if (a.stateT <= 0) { a.state = "graze"; a.stateT = rand(3, 6); }
    } else { // graze
      a.stateT -= dt;
      if (a.stateT <= 0) { a.state = "walk"; a.stateT = rand(1.5, 3.5); a.dir = pick([-1, 1]); }
    }

    // Eating cycle: head dips to the ground, lifts now and then to look around
    a.headT -= dt;
    if (a.headT <= 0) {
      a.headUp = !a.headUp;
      a.headT = a.headUp ? rand(1, 2.2) : rand(2, 4.5);
      if (a.type === "rabbit" && a.headUp && Math.random() < 0.6) a.scanT = rand(0.8, 1.6); // stand up and scan
      if (a.type === "deer" && Math.random() < 0.5) a.earFlick = 0.35;
    }
    const grazing = a.state === "graze" && !a.headUp;
    a.eatDown = clamp(a.eatDown + (grazing ? dt * 2.2 : -dt * 3), 0, 1);
    if (a.scanT > 0) a.scanT -= dt;
    a.scan = clamp((a.scan || 0) + (a.scanT > 0 ? dt * 5 : -dt * 5), 0, 1);
    if (a.earFlick > 0) a.earFlick -= dt;

    a.x = clamp(a.x, 800, CFG.worldWidth - 800);
  }
}
