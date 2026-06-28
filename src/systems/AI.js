import { CFG, STATIONS_X } from '../config/config.js';
import { clamp, dist, rand } from '../util/math.js';
import { groundY } from '../canvas.js';
import { Game, state } from '../state.js';
import { Audio } from './Audio.js';
import { spawnParticles, spawnCoin, floaty } from './SpawnSystem.js';
import { shootArrow, killEnemy } from './Combat.js';
import { wallHeight } from '../entities/Wall.js';
import { makeUnit } from '../entities/Unit.js';

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

function assignArcherPost(u, preferredSide) {
  let wall = bestArcherWall(preferredSide);
  if (!wall) wall = bestArcherWall(-preferredSide);
  u.wall = wall;

  if (!wall) {
    u.onWall = false;
    return CFG.baseX + preferredSide * 110;
  }

  const { slot, onWall } = reserveWallSlot(wall);
  u.onWall = onWall;
  if (onWall) return wall.x + wallStandOffset(wall, slot);

  const innerDir = Math.sign(CFG.baseX - wall.x);
  const behind = slot - archerWallCapacity(wall);
  return wall.x + innerDir * (behind + 1) * 26;
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
  // Rally to legendary boss
  const lb = state.legendaryBoss;
  if (lb && !lb.fleeing) {
    const d = dist(u.x, lb.x);
    u.dir = Math.sign(lb.x - u.x) || u.dir;
    if (d > 320) moveToward(u, lb.x, 95, dt);
    if (d < 580 && u.cooldown <= 0) {
      shootArrow(u.x, groundY - 42, lb, u);
      u.cooldown = 0.65;
      u.dir = Math.sign(lb.x - u.x) || u.dir;
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

  if (Game.isNight) {
    const threat = closeFoe || nearestEnemy(CFG.baseX, 99999);
    const side = threat ? (threat.x < CFG.baseX ? -1 : 1) : (u.patrolDir > 0 ? 1 : -1);
    const post = assignArcherPost(u, side);
    const tgt = nearestEnemy(u.x, 520);
    if (!tgt || dist(u.x, tgt.x) > 150) moveToward(u, post, 84, dt);
    if (tgt && u.cooldown <= 0) {
      const shootH = u.onWall && u.wall ? wallHeight(u.wall) + 16 : 40;
      shootArrow(u.x, groundY - shootH, tgt, u);
      u.cooldown = 0.8;
      u.dir = Math.sign(tgt.x - u.x) || u.dir;
    }
  } else {
    // If enemy is dangerously close, back away while shooting
    const tooClose = nearestEnemy(u.x, 90);
    if (tooClose) {
      u.onWall = false; u.wall = null;
      u.dir = Math.sign(u.x - tooClose.x) || u.dir;
      u.x += u.dir * 100 * dt;
      if (u.cooldown <= 0) { shootArrow(u.x, groundY-36, tooClose, u); u.cooldown = 1.0; }
      return;
    }
    if (bestArcherWall(u.patrolDir) || bestArcherWall(-u.patrolDir)) {
      const side = closeFoe ? (closeFoe.x < CFG.baseX ? -1 : 1) : u.patrolDir;
      const post = assignArcherPost(u, side);
      moveToward(u, post, 58, dt);
      if (closeFoe && u.cooldown <= 0 && dist(u.x, closeFoe.x) < 540) {
        const shootH = u.onWall && u.wall ? wallHeight(u.wall) + 16 : 40;
        shootArrow(u.x, groundY - shootH, closeFoe, u);
        u.cooldown = 1.1;
        u.dir = Math.sign(closeFoe.x - u.x) || u.dir;
      }
      if (!closeFoe && Math.random() < 0.004) u.patrolDir *= -1;
    } else if (closeFoe) {
      u.onWall = false; u.wall = null;
      const d = dist(u.x, closeFoe.x);
      if (d > 240) moveToward(u, closeFoe.x, 64, dt);
      else {
        u.dir = Math.sign(closeFoe.x - u.x) || u.dir;
        if (u.cooldown <= 0) { shootArrow(u.x, groundY-36, closeFoe, u); u.cooldown = 1.1; }
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

function builderAI(u, dt) {
  let target = null, td = 1e9;
  for (const w of state.walls) {
    if (!w.commissioned) continue;
    if (!(w.buildProgress < 1 || w.hp < w.maxHp)) continue;
    const d = dist(u.x, w.x); if (d < td) { td = d; target = w; }
  }
  if (Game.isNight && target) {
    if (nearestEnemy(target.x, 220)) u.panic = 0.6;
  }
  if (u.panic > 0) { moveToward(u, CFG.baseX, 120, dt); return; }
  if (sunsetApproaching() && !target) {
    if (dist(u.x, CFG.baseX) > 180) { moveToward(u, CFG.baseX, 120, dt); return; }
  }
  if (!target) {
    if (dist(u.x, u.targetX) < 8 || Math.random() < 0.004) u.targetX = CFG.baseX + rand(-160, 160);
    moveToward(u, u.targetX, 30, dt); return;
  }
  if (moveToward(u, target.x, 90, dt)) {
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
}

function farmerAI(u, dt) {
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

function guardAI(u, dt) {
  // Rally to legendary boss
  const lb = state.legendaryBoss;
  if (lb && !lb.fleeing) {
    const d = dist(u.x, lb.x);
    u.dir = Math.sign(lb.x - u.x) || u.dir;
    if (d > 45) { u.x += u.dir * 175 * dt; return; }
    if (u.cooldown <= 0) {
      lb.hp -= 4; lb.flash = 0.12;
      u.cooldown = 0.55;
      Audio.hit();
      spawnParticles(lb.x, groundY - 30, 5, "#8a2a4a", 50, 70);
      if (lb.hp <= 0) killEnemy(lb);
    }
    return;
  }
  const foe = nearestEnemy(u.x, 300);
  if (foe) {
    const d = dist(u.x, foe.x);
    u.dir = Math.sign(foe.x - u.x) || u.dir;
    if (d > 34) {
      u.x += u.dir * 100 * dt;
    } else if (u.cooldown <= 0) {
      foe.hp -= 2; foe.flash = 0.14;
      u.cooldown = 0.85;
      Audio.hit();
      spawnParticles(foe.x, groundY - 24, 4, "#8a2a4a", 40, 60);
      if (foe.hp <= 0) killEnemy(foe);
    }
    return;
  }
  // Patrol between walls
  const patrolL = CFG.baseX - 550, patrolR = CFG.baseX + 550;
  if (!u.patrolTarget || dist(u.x, u.patrolTarget) < 20)
    u.patrolTarget = clamp(CFG.baseX + (Math.random() < 0.5 ? -1 : 1) * rand(60, 450), patrolL, patrolR);
  moveToward(u, u.patrolTarget, 62, dt);
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
    if (u.panic > 0) u.panic -= dt;
    if (u.hp <= 0) { spawnParticles(u.x, groundY - 30, 8, "#7a1f1f"); units.splice(i, 1); continue; }
    if (u.transform > 0) { u.transform -= dt; if (u.transform < 0) u.transform = 0; }
    if (u.knock) { u.x = clamp(u.x + u.knock * dt, 120, CFG.worldWidth - 120); u.knock *= 0.82; if (Math.abs(u.knock) < 6) u.knock = 0; }
    const handler = AI_HANDLERS[u.role];
    if (handler) handler(u, dt);
    u.moving = Math.abs(u.x - px0) > 0.04;
    if (u.moving) u.anim += dt * 8;
  }
}

function freePeasant() { return state.units.find(u => u.role === "peasant"); }

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
    else v.vx = 0;
  }

  // Recruit: hold pay key next to a standing vagrant
  const { player } = state;
  const keys = window._KEYS;
  if (player.coins > 0 && keys && (keys["arrowdown"] || keys["s"])) {
    for (let i = 0; i < vagrants.length; i++) {
      const v = vagrants[i];
      if (v.bowTarget || v.hammerTarget) continue;
      if (dist(player.x, v.x) < 46 && Math.abs(v.vx) < 1) {
        if (state.payCooldown <= 0) {
          player.coins--; state.payCooldown = CFG.payInterval;
          Audio.recruit();
          units.push(makeUnit("peasant", v.x));
          vagrants.splice(i, 1);
          floaty(v.x, "🙋 Undersåt!");
          spawnParticles(v.x, groundY - 30, 8, "#cdbfa3");
        }
        break;
      }
    }
  }
}

export function updateAnimals(dt) {
  const { animals } = state;
  for (let i = animals.length - 1; i >= 0; i--) {
    const a = animals[i];
    if (!a.alive) { animals.splice(i, 1); continue; }
    a.anim += dt * 6;
    if (a.flee > 0) { a.flee -= dt; a.x += a.vx * 3 * dt; }
    else {
      a.x += a.vx * dt;
      if (Math.random() < 0.01) a.vx = rand(15, 40) * (Math.random() < 0.5 ? -1 : 1);
    }
    a.x = clamp(a.x, 800, CFG.worldWidth - 800);
  }
}
