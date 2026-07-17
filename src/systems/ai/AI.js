import { CFG, STATIONS_X } from '../../config/config.js';
import { ENEMY_TYPES } from '../../config/enemies.js';
import { ARROW_RAIN_COOLDOWN } from '../../config/archerSkills.js';
import { clamp, dist, rand, pick } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnParticles, spawnGoldCoins, spawnGoldReward, floaty as showFloaty } from '../world/SpawnSystem.js';
import { shootArrow, killEnemy, damagePlayer } from '../combat/Combat.js';
import { killEnemyWithAnimation, spawnImpBlood, spawnHumanBlood } from '../../util/EnemyUtils.js';
import { wallHeight, wallStandX, wallBackDir, wallRenderWidth, wallPlatformDepth, overWallPlatform, entityWallLift } from '../../entities/Wall.js';
import { makeUnit } from '../../entities/Unit.js';
import { nearestChoppableTree, chopTree, nearestLog, deliverLog, pondAt, nearestPond } from '../world/ForestSystem.js';
import { minerAI } from '../world/MineSystem.js';
import { permanentDamageMultiplier } from '../infrastructure/RoguelikeSystem.js';
import { addSkillPoints } from '../economy/SkillSystem.js';
import { archerAI as archerRoleAI } from './ArcherAI.js';
import { builderAI as builderRoleAI } from './BuilderAI.js';
import { farmerAI as farmerRoleAI } from './FarmerAI.js';
import { guardAI as guardRoleAI } from './GuardAI.js';
import { assaultUnitAI } from '../world/AssaultSystem.js';

function hasSkill(id) { return state.archerSkills.includes(id); }

function floaty(x, text, color) {
  if (typeof text === "string" && text.includes("Unders")) return;
  showFloaty(x, text, color);
}

function archerShoot(u, x, h, tgt) {
  const skills = state.archerSkills;

  // Heavy Ballista overrides everything
  if (skills.includes("heavy_ballista")) {
    shootArrow(x, h, tgt, u, null, { projectileSpeed: 620, lifePadding: 0.6 });
    const arr = state.arrows[state.arrows.length - 1];
    if (arr) { arr.ballista = true; arr.pierce = 3; arr.dmgMult = 5; }
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
  if (isPowered) {
    u.charged = false; u.powerTimer = 0;
    u.powerFlash = 0.4; // release flash on the sprite
    Game.screenShake = Math.max(Game.screenShake, 0.15);
    spawnParticles(x, h, 14, "#ffcc44", 80, 90);
    spawnParticles(x, h, 8, "#fff2b0", 50, 110);
  }

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
}

function grantArcherXP(u) {
  u.xp = (u.xp || 0) + 1;
  const xpNeeded = (u.level || 1) * 3;
  if (u.xp < xpNeeded) return;
  u.xp -= xpNeeded;
  u.level = (u.level || 1) + 1;
  addSkillPoints("archer", 1);
  floaty(u.x, `Niv.${u.level}! (+1ep)`, "#f2c14e");
  spawnParticles(u.x, groundY - 30, 8, "#f2c14e", 50, 80);
}

function archerDaggerDamageEnemy(u, foe, dmg = 1, cooldown = 0.58) {
  if (!foe || foe.hp <= 0 || u.cooldown > 0) return false;
  foe.hp -= dmg * permanentDamageMultiplier();
  foe.flash = 0.12;
  foe.combatTarget = u;
  if (foe.type === "imp" && (foe.wallTopWall || foe.aiState === "climbOver")) foe.aiState = "combat";
  u.cooldown = cooldown;
  u.strike = 0.22;
  u.meleeMode = 0.32;
  u.shootState = null;
  u.shootTimer = 0;
  u.charged = false;
  u.powerTimer = 0;
  spawnImpBlood(foe, 0.75 + dmg * 0.25, groundY + (foe.fy || 0) - 18);
  spawnParticles(foe.x, groundY + (foe.fy || 0) - 18, 4, "#8a2a4a", 36, 52);
  Audio.hit();
  if (foe.hp <= 0) {
    grantArcherXP(u);
    killEnemy(foe);
  }
  return true;
}

function clearArcherMelee(u) {
  if (u.combatTarget && u.combatTarget.combatTarget === u) u.combatTarget.combatTarget = null;
  u.combatTarget = null;
  u.guardDuelCenterX = null;
  u.guardDuelX = null;
  if (u.aiState === "combat") u.aiState = null;
}

function updateArcherWallMelee(u, dt) {
  const foe = u.combatTarget;
  if (!u.onWall || !u.wall || !foe || foe.type !== "imp" || foe.hp <= 0 || foe.dying || foe.fleeing || foe.wallTopWall !== u.wall) {
    if (u.combatTarget && (!foe || foe.hp <= 0 || foe.dying || foe.wallTopWall !== u.wall)) clearArcherMelee(u);
    return false;
  }

  u.aiState = "combat";
  u.meleeMode = Math.max(u.meleeMode || 0, 0.08);
  u.shootState = null;
  u.shootTimer = 0;
  u.placingTrap = 0;
  u.barrageCount = 0;
  u.dir = Math.sign(foe.x - u.x) || u.dir;
  foe.combatTarget = u;

  const targetX = u.guardDuelX ?? (u.guardDuelCenterX != null ? u.guardDuelCenterX - u.wall.side * 11 : u.x);
  if (dist(u.x, targetX) > 2) moveToward(u, targetX, 44, dt);
  if (dist(u.x, foe.x) < 32) archerDaggerDamageEnemy(u, foe, 1, 0.58);
  return true;
}

// ── Caltrops ─────────────────────────────────────────────────────────────
// Only placed in the field (outside the base walls), with a cooldown per archer.
const CALTROP_COOLDOWN    = 10;  // sec. between each trap per archer
const CALTROP_HOME_RADIUS = 700; // the walls end at baseX±620 — beyond that is "in the field"
const CALTROP_PLACE_TIME  = 0.7; // sec. placing animation
const CALTROP_DROP_AT     = 0.5; // how far into the animation the trap is released
const ARCHER_DAY_SIGHT = 720;
const ARCHER_NIGHT_SIGHT = 820;
const ARCHER_HUNT_SIGHT = 820;
const ARCHER_HUNT_SHOOT_RANGE = 760;

function tryPlaceCaltrop(u, foe) {
  if (!hasSkill("caltrops") || (u.caltropCd || 0) > 0) return false;
  if (dist(u.x, CFG.baseX) < CALTROP_HOME_RADIUS) return false; // aldrig hjemme ved basen
  if (u.onWall || !foe) return false;
  const t = ENEMY_TYPES[foe.type];
  if (t && t.flying) return false; // flying enemies do not step in traps
  if (dist(u.x, foe.x) > 240) return false;
  u.caltropCd = CALTROP_COOLDOWN;
  u.placingTrap = 0.0001; // animationsfremdrift 0→1
  u.trapDropped = false;
  u.shootState = null;
  u.dir = Math.sign(foe.x - u.x) || u.dir;
  return true;
}

// ── Grappling hook ───────────────────────────────────────────────────────
// Instead of walking behind the wall and slowly climbing, the archer fires a
// hook at the wall top and is yanked up along the rope.
// Phases: "throw" (hook flies out) → "pull" (archer zips up the rope).
const GRAPPLE_THROW_TIME = 0.22;
const GRAPPLE_PULL_TIME  = 0.42;
const GRAPPLE_RANGE      = 260;

function tryStartGrapple(u, w, postX) {
  if (!hasSkill("grappling_hook") || u.grapple || (u.grappleCd || 0) > 0) return false;
  if (!w || w.hp <= 0 || w.buildProgress < 1) return false;
  if (u.onWall || (u.wallClimbT || 0) > 0.1) return false;
  const d = dist(u.x, postX);
  if (d < 26 || d > GRAPPLE_RANGE) return false;
  u.grapple = {
    phase: "throw", t: 0,
    fromX: u.x, toX: postX, wall: w,
    lift: Math.max(0, wallHeight(w) - 14),
  };
  u.shootState = null;
  u.dir = Math.sign(postX - u.x) || u.dir;
  Audio.bowLoad();
  return true;
}

function updateGrapple(u, dt) {
  const g = u.grapple;
  const w = g.wall;
  // Wall destroyed mid-flight: drop back down
  if (!w || w.hp <= 0 || !w.commissioned) {
    u.grapple = null; u.grappleLiftY = 0;
    u.wallClimbT = 0; u.onWall = false;
    return;
  }
  g.lift = Math.max(0, wallHeight(w) - 14);

  if (g.phase === "throw") {
    g.t += dt / GRAPPLE_THROW_TIME;
    u.dir = Math.sign(g.toX - u.x) || u.dir;
    if (g.t >= 1) { g.phase = "pull"; g.t = 0; Audio.bow(); }
    return;
  }

  // "pull": zip along the rope in a shallow arc
  g.t += dt / GRAPPLE_PULL_TIME;
  const p = Math.min(g.t, 1);
  const e = p * p * (3 - 2 * p);
  u.x = g.fromX + (g.toX - g.fromX) * e;
  u.grappleLiftY = g.lift * e + Math.sin(p * Math.PI) * 12;
  if (Math.random() < 0.4) spawnParticles(u.x, groundY - u.grappleLiftY - 10, 1, "#c9b48a", 14, 12);
  if (g.t >= 1) {
    u.grapple = null; u.grappleLiftY = 0;
    u.wall = w; u.wallClimbT = 1; u.onWall = true;
    u.grappleCd = 2.5;
    spawnParticles(u.x, groundY - g.lift - 4, 9, "#caa46a", 45, 45);
    Audio.build();
  }
}

export function nearestEnemy(x, range, includeFleeing = false) {
  let best = null, bd = range;
  for (const e of state.enemies) {
    if (!includeFleeing && e.fleeing) continue;
    if (e.dying || e.hp <= 0) continue;
    const d = dist(x, e.x);
    if (d < bd) { bd = d; best = e; }
  }
  for (const a of state.animals) {
    if (a.type !== "bear" || !a.alive || a.dying || a.hp <= 0) continue;
    const d = dist(x, a.x);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}

function nearestThreatOnSide(x, range, side, includeFleeing = false) {
  let best = null, bd = range;
  for (const e of state.enemies) {
    if (!includeFleeing && e.fleeing) continue;
    if (e.dying || e.hp <= 0 || Math.sign(e.x - CFG.baseX) !== side) continue;
    const d = dist(x, e.x);
    if (d < bd) { bd = d; best = e; }
  }
  for (const a of state.animals) {
    if (a.type !== "bear" || !a.alive || a.dying || a.hp <= 0) continue;
    if (Math.sign(a.x - CFG.baseX) !== side) continue;
    const d = dist(x, a.x);
    if (d < bd) { bd = d; best = a; }
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
    u.climbingWall = false;
    return CFG.baseX + preferredSide * 110;
  }

  const { slot, onWall: wantOnWall } = reserveWallSlot(wall);
  const postX = wantOnWall
    ? wallStandX(wall, slot)
    : wall.x + wallBackDir(wall) * (wallRenderWidth(wall) / 2 + wallPlatformDepth(wall) + 30 + (slot - archerWallCapacity(wall)) * 26);
  u.archerPostX = postX;

  // Archers must first reach the platform (stairs/ladder zone) behind the
  // wall before they can start climbing up onto it
  const nearWall = overWallPlatform(wall, u.x);
  const climbTarget = (wantOnWall && nearWall) ? 1 : 0;
  const climbBefore = u.wallClimbT || 0;
  u.wallClimbT = clamp((u.wallClimbT || 0) + Math.sign(climbTarget - (u.wallClimbT || 0)) * ARCHER_CLIMB_SPEED * dt, 0, 1);
  if (Math.abs((u.wallClimbT || 0) - climbTarget) < 0.02) u.wallClimbT = climbTarget;
  u.onWall = u.wallClimbT >= 0.98;
  u.climbingWall = Math.abs((u.wallClimbT || 0) - climbBefore) > 0.001 && !u.onWall;
  if ((u.wallClimbT || 0) <= 0.02 || u.onWall) u.climbingWall = false;
  if (u.climbingWall) u.climbAnim = (u.climbAnim || 0) + dt * 8;

  return postX;
}

function sunsetApproaching() {
  return Game.time > 0.48 && Game.time < 0.65 && !Game.isNight;
}

function dropArcherGoldToPlayer(u) {
  const gold = Math.floor(u.gold || 0);
  if (gold <= 0 || !state.player) return;

  const dx = state.player.x - u.x;
  spawnGoldCoins(u.x, gold, {
    spreadX: 10,
    fromY: groundY - 28,
    vx: Math.min(360, Math.abs(dx * 2) + 85),
    vyMin: 170,
    vyMax: 250,
  });
  floaty(u.x, "+" + gold + " gold", "#f2c14e");
  u.gold = 0;
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
  if ((u.gold || 0) > 0 && dist(u.x, state.player.x) < 120) {
    dropArcherGoldToPlayer(u);
  }

  // Mid-grapple: the flight owns the archer until landing
  if (u.grapple) { updateGrapple(u, dt); return; }

  if (updateArcherWallMelee(u, dt)) return;

  // Powershot: charge while standing still, lose the charge when moving
  if (hasSkill("powershot") && !hasSkill("heavy_ballista")) {
    if (!u.moving && !u.placingTrap) {
      u.powerTimer = (u.powerTimer || 0) + dt;
      if (u.powerTimer >= 3 && !u.charged) {
        u.charged = true;
        spawnParticles(u.x, groundY - 34, 10, "#ffcc44", 40, 60);
      }
    } else {
      u.powerTimer = 0;
      u.charged = false;
    }
  }

  // Placing animation for caltrop: the archer kneels and sets the trap
  if (u.placingTrap > 0) {
    u.placingTrap += dt / CALTROP_PLACE_TIME;
    if (!u.trapDropped && u.placingTrap >= CALTROP_DROP_AT) {
      u.trapDropped = true;
      state.caltrops.push({
        x: u.x + u.dir * 9, y: groundY - 13,
        vx: u.dir * 30, vy: -30,
        state: "fall", rot: 0, spin: u.dir * 7,
        life: 14, settle: 0, snapT: 0,
      });
    }
    if (u.placingTrap >= 1) u.placingTrap = 0;
    return; // stands still while the trap is placed
  }

  // Reset the fixed side when day returns
  if (!Game.isNight && !sunsetApproaching()) {
    u.fixedSide = null;
  }

  // Rally to legendary boss (has highest priority)
// --- FORBEDRET ARCHER BOSS LOGIK ---
  const lb = state.legendaryBoss;
  if (lb && !lb.fleeing) {
    const d = dist(u.x, lb.x);
    u.dir = Math.sign(lb.x - u.x) || u.dir;

    // Check whether there is a safe wall between the archer and the boss
    let wallDefending = null;
    for (const w of state.walls) {
      if (w.commissioned && w.hp > 0 && w.buildProgress >= 1) {
        // If the wall stands between the archer and the boss
        if ((u.x < w.x && w.x < lb.x) || (lb.x < w.x && w.x < u.x)) {
          wallDefending = w;
          break;
        }
      }
    }

    if (wallDefending) {
      // If we have a wall for protection, stay at our post/wall!
      const side = u.fixedSide || (u.x < CFG.baseX ? -1 : 1);
      const post = assignArcherPost(u, side, dt);
      moveToward(u, post, 84, dt);
    } else {
      // PANIC: No wall protects us! Keep distance (kiting)
      const idealDist = 300;
      if (d < idealDist - 40) {
        // The boss is too close! Run AWAY from the boss
        u.dir = Math.sign(u.x - lb.x) || u.dir;
        u.x += u.dir * 110 * dt; // Run quickly backwards
      } else if (d > idealDist + 40) {
        // Too far away, move closer until we can hit
        moveToward(u, lb.x, 84, dt);
      }
    }

    // Shoot at the boss if within range
    if (d < 580 && u.cooldown <= 0) {
      const shootH = u.onWall && u.wall && overWallPlatform(u.wall, u.x) ? wallHeight(u.wall) + 16 : 40;
      archerShoot(u, u.x, groundY - shootH, lb);
      u.cooldown = hasSkill("heavy_ballista") ? 2.2 : 0.75; // Slightly faster shots against the boss
      u.smokeReveal = 0.5;
    }
    return;
  }

  const closeFoe = nearestEnemy(u.x, Game.isNight ? ARCHER_NIGHT_SIGHT : ARCHER_DAY_SIGHT);

  // Master of Shadows: brief visibility window after each shot
  if (u.smokeReveal > 0) u.smokeReveal -= dt;

  // Barrage: rapid-fire queue
  if (u.barrageCount > 0 && u.cooldown <= 0) {
    const tgt = nearestEnemy(u.x, 800, true);
    if (tgt) {
      const shootH = u.onWall && u.wall && overWallPlatform(u.wall, u.x) ? wallHeight(u.wall) + 16 : 40;
      archerShoot(u, u.x, groundY - shootH, tgt);
      u.dir = Math.sign(tgt.x - u.x) || u.dir;
    }
    u.barrageCount--;
    u.cooldown = 0.15;
    return;
  }

  // --- LOGIC FOR DUSK AND NIGHT (PRE-NIGHT & NIGHT) ---
  if (Game.isNight || sunsetApproaching()) {
    // Assign a fixed side (right/left) that does not change until the next day
    const side = assignFixedSide(u);
    const post = assignArcherPost(u, side, dt);

    // Only find enemies on the archer's OWN assigned side to avoid facing the other wall
    const sideFoe = nearestThreatOnSide(u.x, ARCHER_NIGHT_SIGHT, side);

    // Movement to the post — grapplers zip up, the rest walk and climb
    if (!sideFoe || dist(u.x, sideFoe.x) > 150) {
      if (tryStartGrapple(u, u.wall, post)) return;
      moveToward(u, post, Game.isNight ? 84 : 65, dt); // Slightly faster at night
    }

    // Shoot if there is an enemy on your side
    if (sideFoe && u.cooldown <= 0) {
      const shootH = u.onWall && u.wall && overWallPlatform(u.wall, u.x) ? wallHeight(u.wall) + 16 : 40;
      archerShoot(u, u.x, groundY - shootH, sideFoe);
      u.cooldown = hasSkill("heavy_ballista") ? 2.2 : 0.8;
      u.dir = Math.sign(sideFoe.x - u.x) || u.dir;
      u.smokeReveal = 0.5;
    } else if (!sideFoe && u.cooldown <= 0) {
      // No threats around: pick off game animals in range without leaving the post
      const prey = nearestAnimal(u.x, ARCHER_HUNT_SHOOT_RANGE);
      if (prey && prey.type !== "bear") {
        const shootH = u.onWall && u.wall && overWallPlatform(u.wall, u.x) ? wallHeight(u.wall) + 16 : 40;
        shootArrow(u.x, groundY - shootH, prey, u);
        u.cooldown = 1.6;
        u.dir = Math.sign(prey.x - u.x) || u.dir;
      }
    }
  }
  // --- LOGIK FOR DAGTIMERNE ---
  else {
    // If the enemy is dangerously close during the day, fall back and shoot
    const tooClose = nearestEnemy(u.x, 90);
    if (tooClose) {
      u.onWall = false; u.wall = null;
      if (tryPlaceCaltrop(u, tooClose)) return;
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
      const prey = nearestAnimal(u.x, ARCHER_HUNT_SIGHT);
      if (prey) {
        u.onWall = false; u.wall = null;
        const d = dist(u.x, prey.x);
        if (prey.type === "bear") {
          // Kite the bear: face it, back off when it closes, shoot on the
          // move, and fan out so the party isn't mauled in one spot
          u.dir = Math.sign(prey.x - u.x) || u.dir;
          if (d < 250) u.x += Math.sign(u.x - prey.x) * 110 * dt;
          else if (d > 380) moveToward(u, prey.x, 58, dt);
          if (d < 430 && u.cooldown <= 0) {
            shootArrow(u.x, groundY - 36, prey, u);
            u.cooldown = 1.6;
          }
        } else {
          u.dir = Math.sign(prey.x - u.x) || u.dir;
          if (d > 330) moveToward(u, prey.x, 58, dt);
          if (d < ARCHER_HUNT_SHOOT_RANGE && u.cooldown <= 0) {
            shootArrow(u.x, groundY - 36, prey, u);
            u.cooldown = 1.6;
          }
        }
        separateFromArchers(u, dt);
        return;
      }

      // Collect gold dropped from hunts before resuming patrol
      const coin = nearestGroundCoin(u.x, ARCHER_HUNT_SIGHT);
      if (coin) {
        u.onWall = false; u.wall = null;
        moveToward(u, coin.x, 58, dt);
        return;
      }
    }

    if (closeFoe) {
      u.onWall = false; u.wall = null;
      const d = dist(u.x, closeFoe.x);
      if (d > 240) {
        moveToward(u, closeFoe.x, 64, dt);
        if (u.cooldown <= 0) {
          archerShoot(u, u.x, groundY-36, closeFoe);
          u.cooldown = hasSkill("heavy_ballista") ? 2.2 : 1.2;
          u.smokeReveal = 0.5;
        }
      } else {
        if (d < 200 && tryPlaceCaltrop(u, closeFoe)) return;
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
    }
  }
}

// Ground archers shoulder apart so a hunting party fans out instead of
// stacking on a single pixel
function separateFromArchers(u, dt) {
  for (const o of state.units) {
    if (o === u || o.role !== "archer" || o.onWall || o.mine) continue;
    const d = o.x - u.x;
    if (Math.abs(d) < 46) u.x -= (Math.sign(d) || (state.units.indexOf(u) > state.units.indexOf(o) ? 1 : -1)) * 42 * dt;
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
  // Bears maul builders too. Refresh panic every frame while one is close (or
  // actively chasing within its 430px chase sight) so the builder keeps
  // running instead of turning back the moment the 1s hit-panic decays.
  for (const a of state.animals) {
    if (a.type !== "bear" || !a.alive || a.dying || a.hp <= 0) continue;
    const d = dist(u.x, a.x);
    if (d < 300 || (a.state === "chase" && d < 480)) {
      u.panic = Math.max(u.panic || 0, 0.6);
      u.bearThreatX = a.x; // keep running from here until panic fully fades
      break;
    }
  }
  if (u.panic <= 0) u.bearThreatX = null;
  if (u.panic > 0) {
    if (u.pendingLog) { u.pendingLog.claimedBy = null; u.pendingLog = null; }
    if (u.carryLog) {
      u.carryLog.x = u.x;
      u.carryLog.lying = true;
      u.carryLog.claimedBy = null;
      u.carryLog.carriedBy = null;
      u.carryLog = null;
    } // drop the log and run
    // Run home for safety, but a bear will chase all the way to base and
    // maul a builder standing still there — while it's still within its
    // 430px chase sight, keep running directly away until it disengages.
    const bearOnHeels = u.bearThreatX != null && dist(u.x, u.bearThreatX) < 480;
    const fleeTo = bearOnHeels
      ? clamp(u.x + Math.sign(u.x - u.bearThreatX || 1) * 600, 200, CFG.worldWidth - 200)
      : CFG.baseX;
    u.dir = Math.sign(fleeTo - u.x) || u.dir;
    // Flee faster than a charging bear's average pace, or it runs them down
    moveToward(u, fleeTo, 220, dt);
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
  // Don't pick work sites next to a bear — harvest somewhere else instead.
  const awayFromBears = (x) => {
    for (const a of state.animals) {
      if (a.type !== "bear" || !a.alive || a.dying || a.hp <= 0) continue;
      if (dist(x, a.x) < 380) return false;
    }
    return true;
  };
  const freeLog = nearestLog(u.x, awayFromBears);
  if (freeLog) { freeLog.claimedBy = u; u.pendingLog = freeLog; return; }

  // No logs waiting either: fell the nearest available forest tree while it's safe.
  const tree = nearestChoppableTree(u.x, awayFromBears);
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
      spawnGoldReward(fx, coins, "passive", { spreadX: 24, fromY: groundY - 20, vx: 40 });
      spawnParticles(fx, groundY - 20, 4 + lvl, "#9bd05a", 20, 30);
    }
  }
}

function grantGuardXP(u) {
  u.xp = (u.xp || 0) + 1;
  const xpNeeded = (u.level || 1) * 3;
  if (u.xp < xpNeeded) return;
  u.xp -= xpNeeded;
  u.level = (u.level || 1) + 1;
  addSkillPoints("guard", 1);
  floaty(u.x, `Niv.${u.level}! (+1ep)`, "#f2c14e");
  spawnParticles(u.x, groundY - 30, 8, "#f2c14e", 50, 80);
}

function guardDamageEnemy(u, foe, dmg, cooldown = 0.8) {
  if (!foe || foe.hp <= 0 || u.cooldown > 0) return false;
  foe.hp -= dmg * permanentDamageMultiplier();
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

// Idle standing post on the fighting platform behind the wall. Guards step
// forward to the crest (guardWallTopX / duel positions) only when an imp is
// coming over the top.
function guardWallStandX(u, w) {
  const cap = guardWallCapacity(w);
  const slot = Math.max(0, Math.min(cap - 1, guardWallSlot(u, w)));
  return wallStandX(w, slot) + wallBackDir(w) * 6;
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
  const climbBefore = u.wallClimbT || 0;
  u.wallClimbT = clamp((u.wallClimbT || 0) + Math.sign(target - (u.wallClimbT || 0)) * speed * dt, 0, 1);
  if (Math.abs((u.wallClimbT || 0) - target) < 0.04) u.wallClimbT = target;
  u.onWall = u.wallClimbT >= 0.98;
  u.climbingWall = Math.abs((u.wallClimbT || 0) - climbBefore) > 0.001 && !u.onWall;
  if ((u.wallClimbT || 0) <= 0.02 || u.onWall) u.climbingWall = false;
  if (u.climbingWall) u.climbAnim = (u.climbAnim || 0) + dt * 8;
}

function clearGuardWall(u, dt) {
  clearGuardDuel(u);
  if ((u.wallClimbT || 0) > 0) {
    if (!u.wall) {
      u.wallClimbT = 0;
      u.onWall = false;
      u.guardWall = null;
      u.climbingWall = false;
      return true;
    }
    updateGuardWallClimb(u, u.wall, false, dt);
    return false;
  }
  u.onWall = false;
  u.wall = null;
  u.guardWall = null;
  u.climbingWall = false;
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
    const postX = guardWallStandX(u, wall);
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
    const postX = topThreat ? guardWallTopX(u, wall) : guardWallStandX(u, wall);
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
  const overkill = Math.max(0, -(u.hp || 0));
  const violence = Math.min(3.8, Math.sqrt(overkill / Math.max(1, u.maxHp || 5)) * 2.35 + Math.sqrt(overkill) * 0.18);
  const lift = entityWallLift(u) + (u.grappleLiftY || 0);
  const deathDir = u.combatTarget ? Math.sign(u.x - u.combatTarget.x) || 1 : (u.knock ? Math.sign(u.knock) || 1 : (u.dir || 1));
  const heavy = u.role === "guard";
  const airborne = lift > 16 || violence > 1.4;
  u.dying = true;
  u.deathT = 0;
  u.deathDuration = (heavy ? 1.65 : 1.38) + violence * 0.22 + lift / 260;
  u.deathKind = lift > 16 ? "fallFromWall" : violence > 2.4 ? "violentThrow" : heavy ? "guardCollapse" : u.role === "archer" ? "archerCollapse" : "workerCollapse";
  u.deathDir = deathDir;
  u.deathSpin = (deathDir < 0 ? -1 : 1) * (heavy ? 0.8 : 1.05 + violence * 0.28);
  u.deathFy = -lift;
  u.deathVy = airborne ? -(heavy ? 34 : 54) - violence * (heavy ? 22 : 42) : 0;
  u.deathGravity = heavy ? 760 : 820;
  u.deathAngle = 0;
  u.deathRestAngle = deathDir * (heavy ? 1.18 : 1.48);
  u.deathAngVel = u.deathSpin * (airborne ? 3.2 + violence * 0.75 : 1.45);
  u.deathBounces = 0;
  u.deathFriction = Math.max(2, 4.7 - violence * 0.45);
  u.overkillViolence = violence;
  u.knock = (u.knock || 0) + deathDir * ((heavy ? 58 : 82) + violence * (heavy ? 34 : 62));
  u.moving = false;
  u.working = false;
  u.grapple = null;
  u.grappleLiftY = 0;
  u.onWall = false;
  u.wall = null;
  u.guardWall = null;
  u.climbingWall = false;
  u.carryLog = false;
  u.combatTarget = null;
  spawnHumanBlood(u, 1.05 + violence * 0.7 + (heavy ? 0.2 : 0), deathDir, groundY - lift - 30);
  if (violence > 1.6 || lift > 40) spawnHumanBlood(u, 0.7 + violence * 0.35, -deathDir, groundY - lift - 22);
  Game.screenShake = Math.max(Game.screenShake || 0, Math.min(0.28, 0.06 + violence * 0.055 + lift / 900));
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
  // If the archer already has a fixed side for this night/dusk, stick to it
  if (u.fixedSide) return u.fixedSide;

  const counts = getArcherSideCounts();
  if (counts.left < counts.right) {
    u.fixedSide = -1;
  } else if (counts.right < counts.left) {
    u.fixedSide = 1;
  } else {
    // If counts are equal, choose based on patrolDir or randomness
    u.fixedSide = u.patrolDir || (Math.random() < 0.5 ? -1 : 1);
  }
  return u.fixedSide;
}

// Dispatch table replaces the if/else chain in updateUnits.
const AI_HANDLERS = {
  archer:  archerRoleAI,
  builder: builderRoleAI,
  farmer:  farmerRoleAI,
  peasant: peasantAI,
  guard:   guardRoleAI,
  miner:   minerAI,
};

function lastStandActive() {
  const base = state.base;
  if (!base || !Game.isNight || base.hp <= 0 || base.maxHp <= 0) return false;
  return base.hp / base.maxHp <= (CFG.lastStandBaseHpFrac || 0.34);
}

function updateRallyTimers(dt) {
  if ((state.rallyCd || 0) > 0) state.rallyCd = Math.max(0, state.rallyCd - dt);
  if ((state.rallyT || 0) > 0) state.rallyT = Math.max(0, state.rallyT - dt);
}

function updateLastStandNotice(active) {
  if (!active || Game.lastStandDay === Game.day) return;
  Game.lastStandDay = Game.day;
  floaty(state.base.x, "Last stand!", "#ff8a3d");
  spawnParticles(state.base.x, groundY - 70, 24, "#ff8a3d", 140, 120);
  Audio.horn();
}

function unitCooldownRate(u, activeLastStand) {
  let rate = 1;
  if ((u.rallyBoostT || 0) > 0) rate += 0.45;
  if (activeLastStand && (u.role === "archer" || u.role === "guard")) rate += CFG.lastStandCooldownBonus || 0.35;
  return rate;
}

function updateUnitBuffTimers(u, dt) {
  if ((u.rallyHomeT || 0) > 0) u.rallyHomeT = Math.max(0, u.rallyHomeT - dt);
  if ((u.rallyBoostT || 0) > 0) u.rallyBoostT = Math.max(0, u.rallyBoostT - dt);
}

function rallyUnitHome(u, dt) {
  if ((u.rallyHomeT || 0) <= 0 || u.mine) return false;
  const target = u.rallyTargetX ?? CFG.baseX;
  if (dist(u.x, CFG.baseX) <= (CFG.rallyHomeRadius || 320)) return false;
  u.panic = 0;
  u.onWall = false;
  u.wall = null;
  u.guardWall = null;
  moveToward(u, target, 156, dt);
  return true;
}

export function updateUnits(dt) {
  const { units } = state;
  if (state.arrowRainCd > 0) state.arrowRainCd = Math.max(0, state.arrowRainCd - dt);
  updateRallyTimers(dt);
  const activeLastStand = lastStandActive();
  updateLastStandNotice(activeLastStand);
  // Reset per-frame wall slot counter so archerAI can stagger archers across wall positions.
  Game.wallSlots = {};
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
    const px0 = u.x;
    updateUnitBuffTimers(u, dt);
    u.cooldown -= dt * unitCooldownRate(u, activeLastStand);
    if (u.impaleCd > 0) u.impaleCd -= dt;
    if (u.caltropCd > 0) u.caltropCd -= dt;
    if (u.grappleCd > 0) u.grappleCd -= dt;
    if (u.powerFlash > 0) u.powerFlash -= dt;
    if (u.meleeMode > 0) u.meleeMode -= dt;
    if (u.panic > 0) u.panic -= dt;
    if (u.strike > 0) u.strike -= dt;
    if (u.dying) {
      u.deathT += dt;
      const violence = u.overkillViolence || 0;
      if (u.knock) {
        u.x = clamp(u.x + u.knock * dt, 120, CFG.worldWidth - 120);
        u.knock *= Math.max(0, 1 - (u.deathFriction || 4.2) * dt);
        if (Math.abs(u.knock) < 2) u.knock = 0;
      }
      const falling = (u.deathFy || 0) < 0 || (u.deathVy || 0) < 0;
      if (falling) {
        u.deathVy = (u.deathVy || 0) + (u.deathGravity || 800) * dt;
        u.deathFy = Math.min(0, (u.deathFy || 0) + u.deathVy * dt);
        u.deathAngle = (u.deathAngle || 0) + (u.deathAngVel || 0) * dt;
        if ((u.deathFy || 0) >= 0) {
          u.deathFy = 0;
          if (u.deathVy > 170 && (u.deathBounces || 0) < 1 && violence > 1.2) {
            u.deathVy = -u.deathVy * 0.24;
            u.deathBounces = (u.deathBounces || 0) + 1;
            u.deathAngVel = (u.deathAngVel || 0) * 0.45;
            u.knock = (u.knock || 0) * 0.48;
            u.deathDuration = Math.max(u.deathDuration || 1.25, u.deathT + 0.48);
            spawnHumanBlood(u, 0.75 + violence * 0.22, u.deathDir || 1, groundY - 10);
          } else {
            u.deathVy = 0;
            u.deathAngVel = (u.deathAngVel || 0) * 0.24;
            spawnHumanBlood(u, 0.45 + violence * 0.12, u.deathDir || 1, groundY - 12);
          }
        }
      } else {
        const rest = u.deathRestAngle || ((u.deathDir || 1) * 1.35);
        u.deathAngle = (u.deathAngle || 0) + (rest - (u.deathAngle || 0)) * Math.min(1, 8 * dt);
        u.deathAngVel = (u.deathAngVel || 0) * Math.max(0, 1 - 8 * dt);
      }
      if (violence > 1.35 && Math.random() < dt * (1.4 + violence)) {
        spawnHumanBlood(u, 0.38 + violence * 0.08, u.deathDir || 1, groundY + (u.deathFy || 0) - 25);
      }
      if (u.deathT >= (u.deathDuration || 1.25)) units.splice(i, 1);
      continue;
    }
    if (u.hp <= 0) { startUnitDeath(u); continue; }
    if (u.transform > 0) { u.transform -= dt; if (u.transform < 0) u.transform = 0; }
    if (u.knock) { u.x = clamp(u.x + u.knock * dt, 120, CFG.worldWidth - 120); u.knock *= 0.82; if (Math.abs(u.knock) < 6) u.knock = 0; }
    if (rallyUnitHome(u, dt)) {
      u.moving = Math.abs(u.x - px0) > 0.04;
      u.moveSpeed = dt > 0 ? Math.abs(u.x - px0) / dt : 0;
      if (u.moving) u.anim += dt * 12;
      continue;
    }
    // Portal assault: marching/sieging fighters follow the assault plan; when
    // it returns false a foe is in reach and the normal role AI takes the fight.
    if (state.assault && u.assault && (u.role === "archer" || u.role === "guard")
        && assaultUnitAI(u, dt)) {
      u.moving = Math.abs(u.x - px0) > 0.04;
      u.moveSpeed = dt > 0 ? Math.abs(u.x - px0) / dt : 0;
      if (u.moving) u.anim += dt * (u.moveSpeed > 72 ? 11 : 8);
      continue;
    }
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
  if ((state.arrowRainCd || 0) > 0) {
    const x = state.player?.x ?? state.base?.x ?? CFG.baseX;
    floaty(x, "Arrow Rain ready in " + Math.ceil(state.arrowRainCd) + "s", "#cfe6f2");
    return;
  }
  let triggered = false;
  for (const u of state.units) {
    if (u.role === "archer" && u.hp > 0 && !u.dying) {
      u.barrageCount = 5;
      u.cooldown = 0;
      triggered = true;
    }
  }
  if (!triggered) {
    const x = state.player?.x ?? state.base?.x ?? CFG.baseX;
    floaty(x, "No archers", "#ff8a6a");
    return;
  }
  state.arrowRainCd = ARROW_RAIN_COOLDOWN;
  Audio.bow();
}

export function triggerRoyalRally() {
  if (Game.state !== "play") return;
  if ((state.rallyCd || 0) > 0) {
    const x = state.player?.x ?? state.base?.x ?? CFG.baseX;
    floaty(x, "Rally ready in " + Math.ceil(state.rallyCd) + "s", "#cfe6f2");
    return;
  }

  let rallied = 0;
  const spread = 180;
  for (const u of state.units) {
    if (u.hp <= 0 || u.dying || u.mine) continue;
    const side = u.x < CFG.baseX ? -1 : 1;
    u.rallyHomeT = CFG.rallyDuration || 4.8;
    u.rallyBoostT = (CFG.rallyDuration || 4.8) + 1.2;
    u.rallyTargetX = CFG.baseX + side * rand(60, spread);
    u.panic = 0;
    u.cooldown = Math.max(0, (u.cooldown || 0) - 0.45);
    rallied++;
  }
  if (!rallied) {
    const x = state.player?.x ?? state.base?.x ?? CFG.baseX;
    floaty(x, "No subjects to rally", "#ff8a6a");
    return;
  }

  state.rallyT = CFG.rallyDuration || 4.8;
  state.rallyCd = CFG.rallyCooldown || 24;
  floaty(state.base.x, "Royal Rally! (" + rallied + ")", "#9bd05a");
  spawnParticles(state.base.x, groundY - 58, 22, "#9bd05a", 130, 115);
  Audio.horn();
}

export function updateCaltrops(dt) {
  const { caltrops, enemies } = state;
  for (let i = caltrops.length - 1; i >= 0; i--) {
    const c = caltrops[i];

    // Thrown trap falls in a small arc before it lands and arms itself
    if (c.state === "fall") {
      c.vy += 760 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.spin * dt;
      if (c.y >= groundY - 3) {
        c.y = groundY - 3;
        c.state = "armed";
        c.settle = 0.3;
        spawnParticles(c.x, groundY - 4, 5, "#9a8a6a", 30, 14);
      }
      continue;
    }

    if (c.settle > 0) c.settle -= dt;

    // Triggered trap: the jaws have snapped shut, hold for a moment, then it is spent
    if (c.state === "snap") {
      c.snapT += dt;
      if (c.snapT >= 1.2) caltrops.splice(i, 1);
      continue;
    }

    c.life -= dt;
    if (c.life <= 0) { caltrops.splice(i, 1); continue; }

    for (const e of enemies) {
      if (e.fleeing || e.dying || e.hp <= 0) continue;
      const t = ENEMY_TYPES[e.type];
      if (t && t.flying) continue;
      if (Math.abs(e.x - c.x) < 15) {
        c.state = "snap";
        c.snapT = 0;
        e.slow = 2;
        Audio.hit();
        spawnParticles(c.x, groundY - 8, 8, "#c9c9c9", 70, 30);
        spawnParticles(c.x, groundY - 6, 4, "#8a1c10", 50, 22);
        break;
      }
    }
  }
}

export function updateAssignments() {
  if (state.pendingHammers > 0) {
    const p = freePeasant();
    if (p) { p.role = "builder"; p.hp = p.maxHp = 5; state.pendingHammers--; }
  }
  if (state.pendingFarmers > 0) {
    const p = freePeasant();
    if (p) { p.role = "farmer"; p.workTimer = 0; state.pendingFarmers--; }
  }
}

function claimNearest(entity, items, targetKey) {
  if (entity[targetKey]) return;
  let best = null, bd = 9999;
  for (const item of items) {
    if (item.claimed) continue;
    const d = dist(entity.x, item.x);
    if (d < bd) { bd = d; best = item; }
  }
  if (best) { best.claimed = true; entity[targetKey] = best; }
}

const PICKUP_ROLES = {
  bowTarget:    { arr: "groundBows",    role: "archer",  hp: 6 },
  hammerTarget: { arr: "groundHammers", role: "builder", hp: 5 },
};

function walkToPickup(entity, targetKey, speed, dt) {
  const target = entity[targetKey];
  if (!target) return false;
  if (dist(entity.x, target.x) > 6) {
    entity.vx = Math.sign(target.x - entity.x) * speed;
    entity.x += entity.vx * dt;
    entity.anim += dt * (speed > 80 ? 9 : 4);
    return true;
  }
  const cfg = PICKUP_ROLES[targetKey];
  const arr = state[cfg.arr];
  const idx = arr.indexOf(target);
  if (idx !== -1) arr.splice(idx, 1);
  const u = makeUnit(cfg.role, entity.x);
  u.hp = u.maxHp = cfg.hp;
  u.transform = 0.55;
  u.dir = entity.vx >= 0 ? 1 : -1;
  spawnParticles(entity.x, groundY - 30, 14, "#9bd05a");
  Audio.upgrade();
  return u;
}

export function updateVagrants(dt) {
  const { vagrants, units, groundBows, groundHammers } = state;
  for (let i = vagrants.length - 1; i >= 0; i--) {
    const v = vagrants[i];

    if (!v.bowTarget && !v.hammerTarget) {
      claimNearest(v, groundBows, "bowTarget");
      if (!v.bowTarget) claimNearest(v, groundHammers, "hammerTarget");
    }

    for (const key of ["bowTarget", "hammerTarget"]) {
      if (!v[key]) continue;
      const result = walkToPickup(v, key, 58, dt);
      if (result === true) break;
      if (result) { units.push(result); vagrants.splice(i, 1); }
      break;
    }
    if (vagrants[i] !== v) continue;
    if (v.bowTarget || v.hammerTarget) continue;

    const target = v.targetX;
    const spd = v.speed || 38;
    if (dist(v.x, target) > 6) { v.vx = Math.sign(target - v.x) * spd; v.x += v.vx * dt; v.anim += dt * (spd > 80 ? 12 : 4); }
    else {
      v.vx = 0;
      if (dist(v.x, CFG.baseX) < 400) {
        units.push(makeUnit("peasant", v.x));
        vagrants.splice(i, 1);
        spawnParticles(v.x, groundY - 30, 8, "#cdbfa3");
        Audio.recruit();
      }
    }
  }

  // Idle peasants at base also walk to any unclaimed bow/hammer to become an archer/builder.
  for (const p of units) {
    if (p.role !== "peasant" || p.bowTarget || p.hammerTarget) continue;
    claimNearest(p, groundBows, "bowTarget");
    if (!p.bowTarget) claimNearest(p, groundHammers, "hammerTarget");
  }

  for (let i = units.length - 1; i >= 0; i--) {
    const p = units[i];
    if (p.role !== "peasant") continue;
    for (const key of ["bowTarget", "hammerTarget"]) {
      if (!p[key]) continue;
      const result = walkToPickup(p, key, 130, dt);
      if (result === true) break;
      if (result) units[i] = result;
      break;
    }
  }
}

// Nearest settled ground coin an archer could walk to. Coins inside the
// player's magnet range (90 px) are left for the player to hoover up, and
// coins inside the base perimeter (behind the outermost wall slots) belong
// to the player too.
const BASE_COIN_ZONE = 640; // outermost wall slot is baseX ± 620
function nearestGroundCoin(x, range) {
  let best = null, bd = range;
  for (const c of state.coins) {
    if (!c.settled || c.mine) continue;
    if (state.player && dist(c.x, state.player.x) < 90) continue;
    if (Math.abs(c.x - CFG.baseX) < BASE_COIN_ZONE) continue;
    const d = dist(x, c.x);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
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
const BEAR_WALL_STOP = 46;
// Swipe timing: the paw lands partway through the animation, so a windup is
// visible and prey can still dodge. The sprite reads these off the animal
// (attackDur / strikeAt are stamped on it in bearBeginStrike).
const BEAR_ATTACK_DUR = 0.55;
const BEAR_STRIKE_AT = 0.26;   // remaining anim time when the paw lands
const BEAR_REACH = 52;         // horizontal paw reach
const BEAR_AIR_REACH = 42;     // swipe height — a well-timed jump clears it

function activeBearWall(w) {
  return w.commissioned && w.hp > 0 && w.buildProgress >= 1;
}

function wallBetweenBearAndTarget(fromX, toX) {
  let best = null, bd = 1e9;
  for (const w of state.walls) {
    if (!activeBearWall(w)) continue;
    if (!((fromX < w.x && w.x <= toX) || (fromX > w.x && w.x >= toX))) continue;
    const d = Math.abs(w.x - fromX);
    if (d < bd) { bd = d; best = w; }
  }
  return best;
}

function wallBlockingBearStep(fromX, toX) {
  let best = null, bd = 1e9;
  for (const w of state.walls) {
    if (!activeBearWall(w)) continue;
    const leftStop = w.x - BEAR_WALL_STOP;
    const rightStop = w.x + BEAR_WALL_STOP;
    const blockedFromLeft = fromX <= leftStop && toX >= leftStop;
    const blockedFromRight = fromX >= rightStop && toX <= rightStop;
    if (!blockedFromLeft && !blockedFromRight) continue;
    const d = Math.abs(w.x - fromX);
    if (d < bd) { bd = d; best = w; }
  }
  return best;
}

function bearWallStopX(w, fromX) {
  return w.x + (fromX < w.x ? -BEAR_WALL_STOP : BEAR_WALL_STOP);
}

function moveBear(a, dx) {
  const fromX = a.x;
  const toX = clamp(fromX + dx, 800, CFG.worldWidth - 800);
  const wall = wallBlockingBearStep(fromX, toX);
  if (!wall) {
    a.x = toX;
    return null;
  }
  a.x = bearWallStopX(wall, fromX);
  a.charging = 0;
  return wall;
}

function collapseBearWall(w) {
  w.hp = 0;
  w.level = 0;
  w.commissioned = false;
  w.buildProgress = 0;
  spawnParticles(w.x, groundY - 30, 16, "#caa46a", 80, 80);
}

// Start a swipe: the bear plants itself, rears, and the paw lands at
// BEAR_STRIKE_AT — damage happens in bearResolveStrike, not here.
function bearBeginStrike(a, target, wall) {
  a.charging = 0;
  a.attackCd = 1.6;
  a.attackAnim = BEAR_ATTACK_DUR;
  a.attackDur = BEAR_ATTACK_DUR;
  a.strikeAt = BEAR_STRIKE_AT;
  a.strikeTarget = target || null;
  a.strikeWall = wall || null;
  a.struck = false;
}

function bearResolveStrike(a) {
  const { player, vagrants } = state;
  const target = a.strikeTarget, wall = a.strikeWall;
  a.strikeTarget = a.strikeWall = null;

  if (wall) {
    if (!activeBearWall(wall) || dist(a.x, wall.x) > BEAR_WALL_STOP + 16) return;
    wall.hp -= 2;
    wall.flash = 0.15;
    spawnParticles(wall.x, groundY - 30, 5, "#caa46a", 38, 42);
    floaty(wall.x, "-2", "#caa46a");
    Audio.hit();
    if (wall.hp <= 0) collapseBearWall(wall);
    return;
  }
  if (!target) return;
  if (dist(target.x, a.x) > BEAR_REACH + 18) return; // prey slipped out of the arc

  if (target === player) {
    if (player.hp <= 0 || Game.inMine) return;
    // The swipe only reaches so high — an airborne player is out of range
    if ((player.jumpH || 0) + entityWallLift(player) > BEAR_AIR_REACH) return;
    damagePlayer(1, { knock: Math.sign(player.x - a.x) * 190 });
    Audio.hit();
  } else if (target.hp !== undefined) {
    if (entityWallLift(target) > BEAR_AIR_REACH) return;
    target.hp -= 2; target.panic = 1;
    spawnParticles(target.x, groundY - 40, 6, "#c1453b");
    Audio.hit();
  } else {
    // Vagrants have no hp — one swipe scares them off for good
    const idx = vagrants.indexOf(target);
    if (idx !== -1) {
      const corpse = makeUnit("peasant", target.x);
      corpse.dir = target.vx ? Math.sign(target.vx) || 1 : (target.dir || 1);
      corpse.hp = -2;
      corpse.maxHp = 5;
      corpse.knock = Math.sign(target.x - a.x || 1) * 120;
      state.units.push(corpse);
      startUnitDeath(corpse);
      vagrants.splice(idx, 1);
      Audio.hit();
    }
  }
}

function bearAttackWall(a, wall, dt) {
  a.state = "chase";
  a.dir = Math.sign(wall.x - a.x) || a.dir;
  if (a.attackAnim <= 0 && dist(a.x, bearWallStopX(wall, a.x)) > 5) {
    a.anim += dt * 9;
    a.moving = true;
    moveBear(a, a.dir * 130 * dt);
  }
  if (dist(a.x, wall.x) > BEAR_WALL_STOP + 10 || a.attackCd > 0 || a.attackAnim > 0) return;
  bearBeginStrike(a, null, wall);
}

function updateBear(a, dt) {
  const { player, units, vagrants } = state;
  a.attackCd -= dt;
  a.moving = false;
  if (a.attackAnim > 0) {
    a.attackAnim -= dt;
    if (!a.struck && a.attackAnim <= (a.strikeAt || BEAR_STRIKE_AT)) {
      a.struck = true;
      bearResolveStrike(a);
    }
  }
  if (a.flash > 0) a.flash -= dt;

  // Sight: wider once already aggroed so victims can't juke it easily
  const sight = a.state === "chase" ? 430 : 320;
  let target = null, td = sight;
  if (player && player.hp > 0 && !Game.inMine && !(player.onWall && player.wall && activeBearWall(player.wall))) { const d = dist(player.x, a.x); if (d < td) { td = d; target = player; } }
  for (const u of units) {
    if (u.mine || (u.onWall && u.wall && activeBearWall(u.wall))) continue;
    const d = dist(u.x, a.x);
    if (d < td) { td = d; target = u; }
  }
  for (const v of vagrants) { const d = dist(v.x, a.x); if (d < td) { td = d; target = v; } }

  a.chargeCd = (a.chargeCd || 0) - dt;
  if (target) {
    const blockingWall = wallBetweenBearAndTarget(a.x, target.x);
    if (blockingWall) {
      bearAttackWall(a, blockingWall, dt);
      return;
    }

    a.state = "chase";
    if (a.attackAnim > 0) {
      // Planted mid-swipe — no movement, no run cycle
    } else if (a.charging > 0) {
      // Burst of speed that runs down kiting archers
      a.dir = Math.sign(target.x - a.x) || a.dir;
      a.charging -= dt;
      a.anim += dt * 16;
      a.moving = true;
      moveBear(a, a.dir * 330 * dt);
      spawnParticles(a.x - a.dir * 20, groundY - 8, 1, "#8a7a5c");
    } else if (td > BEAR_REACH - 8) {
      a.dir = Math.sign(target.x - a.x) || a.dir;
      a.anim += dt * 9;
      a.moving = true;
      moveBear(a, a.dir * 130 * dt);
      // Wind up a charge when prey is near but out of paw reach
      if (td > 100 && td < 260 && a.chargeCd <= 0) {
        a.charging = 0.6;
        a.chargeCd = 4.5;
      }
    } else {
      // Squared up over its prey: stand and fight instead of jogging in place
      a.dir = Math.sign(target.x - a.x) || a.dir;
      a.anim += dt * 2;
    }
    if (td < BEAR_REACH && a.attackCd <= 0 && a.attackAnim <= 0) {
      bearBeginStrike(a, target, null);
    }
  } else if (a.state === "chase") {
    a.state = "graze"; a.stateT = rand(2, 4); a.charging = 0;
  } else if (a.state === "walk") {
    a.stateT -= dt;
    a.anim += dt * 5;
    a.moving = true;
    if (moveBear(a, a.dir * 30 * dt)) {
      a.dir *= -1;
      a.state = "graze";
      a.stateT = rand(2, 4);
    }
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

// Duck: waddles and dabbles like the other game, but takes wing when spooked
// or on a whim — sometimes crossing right over the base, where archers get a
// crack at shooting it down mid-flight.
const DUCK_FLY_SPEED = 150;

function duckTakeOff(a, targetX) {
  a.state = "fly";
  a.flyTargetX = clamp(targetX, 850, CFG.worldWidth - 850);
  a.cruiseFy = -rand(230, 330);
  a.dir = Math.sign(a.flyTargetX - a.x) || 1;
  a.eatDown = 0;
  a.wingStretch = 0;
  spawnParticles(a.x, groundY - 10, 4, "#c9c2b4", 40, 60);
}

// Where a spooked or wandering duck flies: usually straight to a pond.
function duckFlightTarget(a, awayDir = 0) {
  const ponds = state.ponds || [];
  const options = ponds.filter(p =>
    Math.abs(p.x - a.x) > 350 &&
    (!awayDir || Math.sign(p.x - a.x) === awayDir || Math.abs(p.x - a.x) > 1600));
  if (options.length && Math.random() < 0.75) {
    const p = pick(options);
    return p.x + rand(-p.hw * 0.5, p.hw * 0.5);
  }
  const dir = awayDir || pick([-1, 1]);
  return a.x + dir * rand(600, 1100);
}

function updateDuck(a, dt) {
  const flying = a.state === "fly";
  const swimming = a.state === "swim";
  a.anim += dt * (flying ? 13 : swimming ? 3 : 6);

  if (flying) {
    // Glide toward cruise height, then sink toward the ground near the goal
    const remaining = Math.abs(a.flyTargetX - a.x);
    const targetFy = remaining < 420 ? 0 : a.cruiseFy;
    a.fy += (targetFy - a.fy) * Math.min(1, dt * 2.2);
    a.dir = Math.sign(a.flyTargetX - a.x) || a.dir; // never overshoot into an endless cruise
    a.x += a.dir * DUCK_FLY_SPEED * dt;
    if (remaining < 40 && a.fy > -16) {
      a.fy = 0;
      if (pondAt(a.x)) { // splash down onto the water
        a.state = "swim"; a.stateT = rand(8, 18);
        spawnParticles(a.x, groundY - 4, 6, "#bcd8de", 45, 55);
      } else {
        a.state = "graze"; a.stateT = rand(2, 5);
        spawnParticles(a.x, groundY - 8, 3, "#c9c2b4", 30, 40);
      }
    }
    a.x = clamp(a.x, 800, CFG.worldWidth - 800);
    return;
  }

  // Spooked ducks escape by air, not by foot — from land or water alike
  let threat = null, td = 150;
  for (const u of state.units) {
    if (u.role !== "archer") continue;
    const d = dist(u.x, a.x); if (d < td) { td = d; threat = u; }
  }
  if (state.player) { const d = dist(state.player.x, a.x); if (d < td) { td = d; threat = state.player; } }
  if (threat) {
    if (swimming) spawnParticles(a.x, groundY - 4, 5, "#bcd8de", 50, 60);
    duckTakeOff(a, duckFlightTarget(a, Math.sign(a.x - threat.x) || 1));
    return;
  }

  if (swimming) {
    const pond = pondAt(a.x);
    if (!pond) { a.state = "walk"; a.stateT = rand(1.5, 3); return; }
    // paddle a lazy back-and-forth, turning at the banks
    a.x += a.dir * 13 * dt * (0.6 + Math.abs(Math.sin(a.anim * 0.7)) * 0.4);
    if (Math.abs(a.x - pond.x) > pond.hw - 30) a.dir = Math.sign(pond.x - a.x) || 1;
    a.stateT -= dt;
    if (a.stateT <= 0) {
      if (Math.random() < 0.15) { duckTakeOff(a, duckFlightTarget(a)); return; }
      a.stateT = rand(6, 14);
      if (Math.random() < 0.5) a.dir *= -1;
    }
  } else if (a.state === "walk") {
    a.stateT -= dt;
    a.x += a.dir * 15 * dt * (0.5 + Math.abs(Math.sin(a.anim * 0.55))); // waddle pace
    if (pondAt(a.x)) { // waddled into the water — settle in for a swim
      a.state = "swim"; a.stateT = rand(8, 18);
      spawnParticles(a.x, groundY - 4, 4, "#bcd8de", 35, 40);
    } else if (a.stateT <= 0) { a.state = "graze"; a.stateT = rand(3, 6); }
  } else { // graze / dabble
    a.stateT -= dt;
    if (a.stateT <= 0) {
      // A duck on dry land heads back to water before long
      const home = nearestPond(a.x);
      if (home && Math.abs(home.x - a.x) < 520 && Math.random() < 0.6) {
        a.state = "walk"; a.stateT = rand(4, 8);
        a.dir = Math.sign(home.x - a.x) || 1;
      } else if (Math.random() < 0.35) {
        // …or simply takes wing — often clear across the base
        const overBase = Math.random() < 0.35;
        const target = overBase
          ? CFG.baseX + (a.x < CFG.baseX ? 1 : -1) * rand(500, 1500)
          : duckFlightTarget(a);
        duckTakeOff(a, target);
        return;
      } else {
        a.state = "walk"; a.stateT = rand(1.5, 3.5); a.dir = pick([-1, 1]);
      }
    }
  }

  // Dabbling cycle: tail tips up while the head roots in the grass
  a.headT -= dt;
  if (a.headT <= 0) {
    a.headUp = !a.headUp;
    a.headT = a.headUp ? rand(1, 2.2) : rand(2, 4.5);
    if (a.headUp && Math.random() < 0.35) a.wingStretch = 0.9; // wing flutter on the spot
  }
  // grazing on land, or tipping tail-up to dabble on the water
  const grazing = (a.state === "graze" || a.state === "swim") && !a.headUp;
  a.eatDown = clamp(a.eatDown + (grazing ? dt * 2.2 : -dt * 3), 0, 1);
  if (a.wingStretch > 0) a.wingStretch -= dt;

  a.x = clamp(a.x, 800, CFG.worldWidth - 800);
}

export function updateAnimals(dt) {
  const { animals } = state;
  for (let i = animals.length - 1; i >= 0; i--) {
    const a = animals[i];
    if (!a.alive) { animals.splice(i, 1); continue; }

    // Dead: play the collapse, leave the body a moment, then remove
    if (a.dying) {
      // A duck shot out of the sky tumbles to the ground first
      if (a.fy < 0) {
        a.fallV = (a.fallV || 40) + 1100 * dt;
        a.fy = Math.min(0, a.fy + a.fallV * dt);
        a.x += a.dir * 30 * dt;
        a.spin = (a.spin || 0) + dt * 8;
        if (a.fy >= 0) spawnParticles(a.x, groundY - 8, 8, "#c9c2b4", 55, 70);
        continue;
      }
      a.deathT += dt;
      if (a.deathT > 5) a.alive = false;
      continue;
    }

    if (a.type === "bear") { updateBear(a, dt); continue; }
    if (a.type === "duck") { updateDuck(a, dt); continue; }

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
