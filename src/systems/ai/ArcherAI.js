import { CFG } from '../../config/config.js';
import { ENEMY_TYPES } from '../../config/enemies.js?v=biomeactive1';
import { clamp, dist, rand } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnParticles, spawnGoldCoins } from '../world/SpawnSystem.js?v=biomeactive1';
import { shootArrow, killEnemy } from '../combat/Combat.js?v=biomeactive1';
import { spawnImpBlood } from '../../util/EnemyUtils.js?v=biomeactive1';
import {
  wallHeight, wallStandX, wallBackDir, wallRenderWidth, wallPlatformDepth,
  wallLayout, wallClimbX, overWallPlatform
} from '../../entities/Wall.js';
import { permanentDamageMultiplier } from '../infrastructure/RoguelikeSystem.js';
import { addSkillPoints } from '../economy/SkillSystem.js';
import {
  floaty, hasSkill, nearestEnemy, nearestThreatOnSide,
  moveToward, sunsetApproaching, nearestAnimal, nearestGroundCoin, assignFixedSide
} from './AIHelpers.js?v=biomeweapons1';

// ── Archer shoot ─────────────────────────────────────────────────────────
function archerShoot(u, x, h, tgt) {
  const skills = state.archerSkills;
  const arrowBonus = ((u.rallyBoostT || 0) > 0 ? 1 : 0) + (lastStandActive() ? 1 : 0);

  if (skills.includes("heavy_ballista")) {
    shootArrow(x, h, tgt, u, null, { projectileSpeed: 620, lifePadding: 0.6 });
    const arr = state.arrows[state.arrows.length - 1];
    if (arr) { arr.ballista = true; arr.pierce = 3; arr.dmgMult = 5 + arrowBonus; }
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
    if (arrowBonus > 0) arr.dmgMult = (arr.dmgMult || 1) + arrowBonus;
    if (isPowered) { arr.powered = true; arr.vx *= 1.5; arr.vy *= 1.5; arr.dmgMult = 3; arr.pierce = (arr.pierce||0) + 1; }
    if (isPowered && arrowBonus > 0) arr.dmgMult += arrowBonus;
  }
  if (isPowered) {
    u.charged = false; u.powerTimer = 0;
    u.powerFlash = 0.4;
    Game.screenShake = Math.max(Game.screenShake, 0.15);
    spawnParticles(x, h, 14, "#ffcc44", 80, 90);
    spawnParticles(x, h, 8, "#fff2b0", 50, 110);
  }

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

function lastStandActive() {
  const base = state.base;
  return !!(base && Game.isNight && base.hp > 0 && base.maxHp > 0 && base.hp / base.maxHp <= (CFG.lastStandBaseHpFrac || 0.34));
}

function defenderMeleeBonus(u) {
  return ((u.rallyBoostT || 0) > 0 ? 1 : 0) + (lastStandActive() ? 1 : 0);
}

// ── XP & melee ───────────────────────────────────────────────────────────
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
  foe.hp -= (dmg + defenderMeleeBonus(u)) * permanentDamageMultiplier();
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
const CALTROP_COOLDOWN    = 10;
const CALTROP_HOME_RADIUS = 700;
const CALTROP_PLACE_TIME  = 0.7;
const CALTROP_DROP_AT     = 0.5;
const ARCHER_DAY_SIGHT = 720;
const ARCHER_NIGHT_SIGHT = 820;
const ARCHER_HUNT_SIGHT = 820;
const ARCHER_HUNT_SHOOT_RANGE = 760;

function tryPlaceCaltrop(u, foe) {
  if (!hasSkill("caltrops") || (u.caltropCd || 0) > 0) return false;
  if (dist(u.x, CFG.baseX) < CALTROP_HOME_RADIUS) return false;
  if (u.onWall || !foe) return false;
  const t = ENEMY_TYPES[foe.type];
  if (t && t.flying) return false;
  if (dist(u.x, foe.x) > 240) return false;
  u.caltropCd = CALTROP_COOLDOWN;
  u.placingTrap = 0.0001;
  u.trapDropped = false;
  u.shootState = null;
  u.dir = Math.sign(foe.x - u.x) || u.dir;
  return true;
}

// ── Grappling hook ───────────────────────────────────────────────────────
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

// ── Wall assignment ──────────────────────────────────────────────────────
const ARCHER_CLIMB_SPEED = 1 / 3;

function archerWallCapacity(w) {
  return Math.max(2, w.level + 1);
}

function guardWallOccupancy(w) {
  return state.units.filter(unit =>
    unit.role === "guard" &&
    unit.hp > 0 &&
    !unit.dying &&
    (unit.wall === w || unit.guardWall === w) &&
    ((unit.wallClimbT || 0) > 0.02 || unit.wallApproach)
  ).length;
}

function wallOccupancy(w) {
  return Game.wallSlots[w.x] ?? guardWallOccupancy(w);
}

function reserveWallSlot(w) {
  if (Game.wallSlots[w.x] == null) Game.wallSlots[w.x] = guardWallOccupancy(w);
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

function assignArcherPost(u, preferredSide, dt) {
  let wall = bestArcherWall(preferredSide);
  if (!wall) wall = bestArcherWall(-preferredSide);

  if (wall !== u.wall) {
    u.wallClimbT = 0;
    u.wallApproach = false;
  }
  u.wall = wall;

  if (!wall) {
    u.onWall = false;
    u.wallClimbT = 0;
    u.climbingWall = false;
    u.wallApproach = false;
    return CFG.baseX + preferredSide * 110;
  }

  const { slot, onWall: wantOnWall } = reserveWallSlot(wall);
  const postX = wantOnWall
    ? wallStandX(wall, slot)
    : wall.x + wallBackDir(wall) * (wallRenderWidth(wall) / 2 + wallPlatformDepth(wall) + 30 + (slot - archerWallCapacity(wall)) * 26);
  u.archerPostX = postX;

  const layout = wallLayout(wall);
  const climbBefore = u.wallClimbT || 0;
  let climbTarget = wantOnWall ? 1 : 0;

  // Reach the visible foot/top of the access before changing elevation.
  // This keeps ordinary archers on the stairs/ladder; grappling-hook archers
  // still intentionally bypass it in updateGrapple().
  if (wantOnWall && climbBefore <= 0.02 && Math.abs(u.x - layout.accessBottomX) > 5) {
    u.wallClimbT = 0;
    u.onWall = false;
    u.climbingWall = false;
    u.wallApproach = true;
    return layout.accessBottomX;
  }
  if (!wantOnWall && climbBefore >= 0.98 && Math.abs(u.x - layout.accessTopX) > 5) {
    u.wallClimbT = 1;
    u.onWall = true;
    u.climbingWall = false;
    u.wallApproach = true;
    return layout.accessTopX;
  }

  u.wallApproach = false;
  u.wallClimbT = clamp(climbBefore + Math.sign(climbTarget - climbBefore) * ARCHER_CLIMB_SPEED * dt, 0, 1);
  if (Math.abs((u.wallClimbT || 0) - climbTarget) < 0.02) u.wallClimbT = climbTarget;
  u.onWall = u.wallClimbT >= 0.98;
  u.climbingWall = Math.abs((u.wallClimbT || 0) - climbBefore) > 0.001 && !u.onWall;
  if ((u.wallClimbT || 0) <= 0.02 || u.onWall) u.climbingWall = false;
  if (u.climbingWall) {
    u.x = wallClimbX(wall, u.wallClimbT);
    u.climbAnim = (u.climbAnim || 0) + dt * 8;
    return u.x;
  }

  if (!wantOnWall && (u.wallClimbT || 0) <= 0.02) {
    u.onWall = false;
    return postX;
  }

  return postX;
}

function leaveArcherWall(u, dt) {
  if (!u.wall || (u.wallClimbT || 0) <= 0.02) {
    u.wall = null;
    u.wallClimbT = 0;
    u.onWall = false;
    u.climbingWall = false;
    u.wallApproach = false;
    return true;
  }
  if (!u.wall.commissioned || u.wall.hp <= 0 || u.wall.buildProgress < 1) {
    u.wall = null;
    u.wallClimbT = 0;
    u.onWall = false;
    u.climbingWall = false;
    u.wallApproach = false;
    return true;
  }

  const layout = wallLayout(u.wall);
  const before = u.wallClimbT || 0;
  if (before >= 0.98 && Math.abs(u.x - layout.accessTopX) > 5) {
    u.wallApproach = true;
    u.climbingWall = false;
    moveToward(u, layout.accessTopX, 58, dt);
    return false;
  }

  u.wallApproach = false;
  u.wallClimbT = clamp(before - ARCHER_CLIMB_SPEED * 1.25 * dt, 0, 1);
  if (u.wallClimbT < 0.02) u.wallClimbT = 0;
  u.x = wallClimbX(u.wall, u.wallClimbT);
  u.onWall = false;
  u.climbingWall = u.wallClimbT > 0.02;
  if (u.climbingWall) {
    u.climbAnim = (u.climbAnim || 0) + dt * 8;
    return false;
  }
  u.wall = null;
  return true;
}

// ── Gold drop ────────────────────────────────────────────────────────────
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

// ── Separation ───────────────────────────────────────────────────────────
function separateFromArchers(u, dt) {
  for (const o of state.units) {
    if (o === u || o.role !== "archer" || o.onWall || o.mine) continue;
    const d = o.x - u.x;
    if (Math.abs(d) < 46) u.x -= (Math.sign(d) || (state.units.indexOf(u) > state.units.indexOf(o) ? 1 : -1)) * 42 * dt;
  }
}

// ── Main archer AI ───────────────────────────────────────────────────────
export function archerAI(u, dt) {
  if ((u.gold || 0) > 0 && dist(u.x, state.player.x) < 120) {
    dropArcherGoldToPlayer(u);
  }

  if (u.grapple) { updateGrapple(u, dt); return; }
  if (updateArcherWallMelee(u, dt)) return;

  // Ground melee: if an imp is actively attacking this archer, fight back with the dagger
  if (!u.onWall && u.combatTarget && u.combatTarget.hp > 0 && !u.combatTarget.dying && !u.combatTarget.fleeing
      && state.enemies.includes(u.combatTarget)) {
    const foe = u.combatTarget;
    const d = dist(u.x, foe.x);
    if (d < 50) {
      u.dir = Math.sign(foe.x - u.x) || u.dir;
      archerDaggerDamageEnemy(u, foe, 1, 0.58);
      return;
    }
    if (d >= 50) clearArcherMelee(u);
  }

  if (u.shootState) {
    u.moving = false;
    u.moveSpeed = 0;
    return;
  }

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
    return;
  }

  if (!Game.isNight && !sunsetApproaching()) {
    u.fixedSide = null;
  }

  // Rally to legendary boss
  const lb = state.legendaryBoss;
  if (lb && !lb.fleeing) {
    const d = dist(u.x, lb.x);
    u.dir = Math.sign(lb.x - u.x) || u.dir;

    let wallDefending = null;
    for (const w of state.walls) {
      if (w.commissioned && w.hp > 0 && w.buildProgress >= 1) {
        if ((u.x < w.x && w.x < lb.x) || (lb.x < w.x && w.x < u.x)) {
          wallDefending = w;
          break;
        }
      }
    }

    // Keep the wall-climb state machine advancing every frame so archers
    // resolve onto (or back off) the wall instead of freezing mid-climb while
    // they trade shots with the boss.
    let settled = true;
    if (wallDefending) {
      const side = u.fixedSide || (u.x < CFG.baseX ? -1 : 1);
      const post = assignArcherPost(u, side, dt);
      settled = !u.climbingWall && !u.wallApproach && Math.abs(u.x - post) <= 12;
      if (!settled) moveToward(u, post, 84, dt);
    } else {
      const idealDist = 300;
      if (d < idealDist - 40) {
        u.dir = Math.sign(u.x - lb.x) || u.dir;
        u.x += u.dir * 110 * dt;
      } else if (d > idealDist + 40) {
        moveToward(u, lb.x, 84, dt);
      }
    }

    // Loose an arrow only once settled — never fire while mid-climb.
    if (settled && !u.climbingWall && !u.wallApproach && d < 580 && u.cooldown <= 0) {
      const shootH = u.onWall && u.wall && overWallPlatform(u.wall, u.x) ? wallHeight(u.wall) + 16 : 40;
      archerShoot(u, u.x, groundY - shootH, lb);
      u.cooldown = hasSkill("heavy_ballista") ? 2.2 : 0.75;
      u.smokeReveal = 0.5;
    }
    return;
  }

  const closeFoe = nearestEnemy(u.x, Game.isNight ? ARCHER_NIGHT_SIGHT : ARCHER_DAY_SIGHT);

  if (u.smokeReveal > 0) u.smokeReveal -= dt;

  // Barrage
  if (u.barrageCount > 0 && u.cooldown <= 0 && !u.climbingWall && !u.wallApproach) {
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

  // Night / dusk
  if (Game.isNight || sunsetApproaching()) {
    const side = assignFixedSide(u);
    const post = assignArcherPost(u, side, dt);

    const sideFoe = nearestThreatOnSide(u.x, ARCHER_NIGHT_SIGHT, side);

    if (sideFoe && u.cooldown <= 0 && !u.climbingWall && !u.wallApproach) {
      const shootH = u.onWall && u.wall && overWallPlatform(u.wall, u.x) ? wallHeight(u.wall) + 16 : 40;
      archerShoot(u, u.x, groundY - shootH, sideFoe);
      u.cooldown = hasSkill("heavy_ballista") ? 2.2 : 0.8;
      u.dir = Math.sign(sideFoe.x - u.x) || u.dir;
      u.smokeReveal = 0.5;
    } else if (!sideFoe && u.cooldown <= 0 && !u.climbingWall && !u.wallApproach) {
      const prey = nearestAnimal(u.x, ARCHER_HUNT_SHOOT_RANGE);
      if (prey && prey.type !== "bear") {
        const shootH = u.onWall && u.wall && overWallPlatform(u.wall, u.x) ? wallHeight(u.wall) + 16 : 40;
        shootArrow(u.x, groundY - shootH, prey, u);
        u.cooldown = 1.6;
        u.dir = Math.sign(prey.x - u.x) || u.dir;
      } else {
        if (!sideFoe || dist(u.x, sideFoe.x) > 150) {
          if (tryStartGrapple(u, u.wall, post)) return;
          moveToward(u, post, Game.isNight ? 84 : 65, dt);
        }
      }
    } else {
      if (!sideFoe || dist(u.x, sideFoe.x) > 150) {
        if (tryStartGrapple(u, u.wall, post)) return;
        moveToward(u, post, Game.isNight ? 84 : 65, dt);
      }
    }
  }
  // Day
  else {
    if (!leaveArcherWall(u, dt)) return;
    const tooClose = nearestEnemy(u.x, 90);
    if (tooClose) {
      u.onWall = false; u.wall = null;
      if (tryPlaceCaltrop(u, tooClose)) return;
      u.dir = Math.sign(u.x - tooClose.x) || u.dir;
      if (u.cooldown <= 0) {
        archerShoot(u, u.x, groundY-36, tooClose);
        u.cooldown = hasSkill("heavy_ballista") ? 2.2 : 1.0;
        u.smokeReveal = 0.5;
      } else {
        u.x += u.dir * 100 * dt;
      }
      return;
    }

    if (!closeFoe) {
      const prey = nearestAnimal(u.x, ARCHER_HUNT_SIGHT);
      if (prey) {
        u.onWall = false; u.wall = null;
        const d = dist(u.x, prey.x);
        if (prey.type === "bear") {
          u.dir = Math.sign(prey.x - u.x) || u.dir;
          if (d < 430 && u.cooldown <= 0) {
            shootArrow(u.x, groundY - 36, prey, u);
            u.cooldown = 1.6;
          } else if (d < 250) {
            u.x += Math.sign(u.x - prey.x) * 110 * dt;
          } else if (d > 380) {
            moveToward(u, prey.x, 58, dt);
          }
        } else {
          u.dir = Math.sign(prey.x - u.x) || u.dir;
          if (d < ARCHER_HUNT_SHOOT_RANGE && u.cooldown <= 0) {
            shootArrow(u.x, groundY - 36, prey, u);
            u.cooldown = 1.6;
          } else if (d > 330) {
            moveToward(u, prey.x, 58, dt);
          }
        }
        separateFromArchers(u, dt);
        return;
      }

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
        if (u.cooldown <= 0) {
          archerShoot(u, u.x, groundY-36, closeFoe);
          u.cooldown = hasSkill("heavy_ballista") ? 2.2 : 1.2;
          u.smokeReveal = 0.5;
        } else {
          moveToward(u, closeFoe.x, 64, dt);
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
