import { CFG, STATIONS_X } from '../config/config.js';
import { clamp, dist, rand } from '../util/math.js';
import { groundY } from '../canvas.js';
import { Game, state } from '../state.js';
import { Audio } from './Audio.js';
import { spawnParticles, spawnCoin, floaty } from './SpawnSystem.js';
import { shootArrow } from './Combat.js';
import { wallHeight } from '../entities/Wall.js';
import { makeUnit } from '../entities/Unit.js';

export function nearestEnemy(x, range) {
  let best = null, bd = range;
  for (const e of state.enemies) {
    if (e.fleeing) continue;
    const d = dist(x, e.x);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function moveToward(u, tx, speed, dt) {
  if (dist(u.x, tx) > 4) { u.dir = Math.sign(tx - u.x); u.x += u.dir * speed * dt; return false; }
  return true;
}

function peasantAI(u, dt) {
  if (dist(u.x, u.targetX) < 6 || Math.random() < 0.005)
    u.targetX = CFG.baseX + rand(-260, 260);
  moveToward(u, u.targetX, 30, dt);
}

function archerAI(u, dt) {
  if (Game.isNight) {
    const threat = nearestEnemy(u.x, 99999);
    let post, wall = null;
    if (threat) {
      const side = threat.x < CFG.baseX ? -1 : 1;
      for (const w of state.walls) {
        if (!w.commissioned || w.hp <= 0 || w.side !== side) continue;
        if (!wall || dist(w.x, CFG.baseX) > dist(wall.x, CFG.baseX)) wall = w;
      }
      post = wall ? wall.x : CFG.baseX + side * 110;
    } else { post = u.x; }
    u.wall = wall;
    moveToward(u, post, 84, dt);
    const tgt = nearestEnemy(u.x, 440);
    if (tgt && u.cooldown <= 0) {
      shootArrow(u.x, groundY - (u.wall ? wallHeight(u.wall) + 16 : 40), tgt);
      u.cooldown = 0.8; u.dir = Math.sign(tgt.x - u.x) || u.dir;
    }
  } else {
    const dayFoe = nearestEnemy(u.x, 420);
    if (dayFoe) {
      if (dist(u.x, dayFoe.x) > 260) moveToward(u, dayFoe.x, 58, dt);
      else if (u.cooldown <= 0) { shootArrow(u.x, groundY - 36, dayFoe); u.cooldown = 1.1; u.dir = Math.sign(dayFoe.x - u.x) || u.dir; }
    } else {
      let prey = null, pd = 520;
      for (const a of state.animals) {
        if (!a.alive) continue;
        const d = dist(u.x, a.x); if (d < pd) { pd = d; prey = a; }
      }
      if (prey) {
        if (dist(u.x, prey.x) > 260) moveToward(u, prey.x, 55, dt);
        else if (u.cooldown <= 0) { shootArrow(u.x, groundY - 36, prey); u.cooldown = 1.3; u.dir = Math.sign(prey.x - u.x) || u.dir; }
      } else {
        if (dist(u.x, u.targetX) < 8 || Math.random() < 0.004) u.targetX = CFG.baseX + rand(-360, 360);
        moveToward(u, u.targetX, 34, dt);
      }
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
  if (u.panic > 0) { moveToward(u, CFG.baseX, 70, dt); return; }
  if (!target) {
    if (dist(u.x, u.targetX) < 8 || Math.random() < 0.004) u.targetX = CFG.baseX + rand(-160, 160);
    moveToward(u, u.targetX, 30, dt); return;
  }
  if (moveToward(u, target.x, 48, dt)) {
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
  const fx = STATIONS_X.farm;
  if (moveToward(u, fx, 36, dt)) {
    u.workTimer += dt;
    if (u.workTimer > (Game.isNight ? 99 : 5)) {
      u.workTimer = 0;
      spawnCoin(CFG.baseX + rand(-40, 40), 1, -20);
      spawnParticles(fx, groundY - 20, 4, "#9bd05a", 20, 30);
    }
  }
}

// Dispatch table replaces the if/else chain in updateUnits.
const AI_HANDLERS = {
  archer:  archerAI,
  builder: builderAI,
  farmer:  farmerAI,
  peasant: peasantAI,
};

export function updateUnits(dt) {
  const { units } = state;
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
    const px0 = u.x;
    u.cooldown -= dt;
    if (u.panic > 0) u.panic -= dt;
    if (u.hp <= 0) { spawnParticles(u.x, groundY - 30, 8, "#7a1f1f"); units.splice(i, 1); continue; }
    if (u.transform > 0) { u.transform -= dt; if (u.transform < 0) u.transform = 0; }
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
  const { vagrants, units, groundBows } = state;
  for (let i = vagrants.length - 1; i >= 0; i--) {
    const v = vagrants[i];

    if (!v.bowTarget) {
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

    const target = v.targetX;
    if (dist(v.x, target) > 6) { v.vx = Math.sign(target - v.x) * 38; v.x += v.vx * dt; v.anim += dt * 4; }
    else v.vx = 0;
  }

  // Recruit: hold pay key next to a standing vagrant
  const { player } = state;
  const keys = window._KEYS;
  if (player.coins > 0 && keys && (keys["arrowdown"] || keys["s"])) {
    for (let i = 0; i < vagrants.length; i++) {
      const v = vagrants[i];
      if (v.bowTarget) continue;
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
