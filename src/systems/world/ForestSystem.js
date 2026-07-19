import { CFG, FOREST } from '../../config/config.js';
import { clamp, dist, rand, mulberry32 } from '../../util/math.js';
import { Game, state } from '../../core/state.js';
import { groundY } from '../../core/canvas.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnParticles, spawnGoldReward } from './SpawnSystem.js';
import { biomeAt, makeTree } from '../../rendering/Effects.js?v=biomeactive1';
import { currentPopCap } from '../../util/DefenseStats.js';

const CAMP_SPACING = 1700;
const CAMP_TRIGGER = 120;
const CAMP_CLEAR_DIST = 125;
const CAMP_RESPAWN_MIN = 30;
const CAMP_RESPAWN_MAX = 60;
const CAMP_RESPAWN_DIST = 1050;

function makeForestCamp(x, r = Math.random) {
  return {
    x,
    vagrants: 1 + Math.floor(r() * 2),
    triggered: false,
    respawnTimer: 0,
    blockedUntilExit: false,
  };
}

function pickCampX() {
  for (let tries = 0; tries < 20; tries++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const nearForest = CFG.baseX + side * (FOREST.startDist + 450);
    const deepForest = side < 0 ? 260 : CFG.worldWidth - 260;
    const x = side < 0 ? rand(deepForest, nearForest) : rand(nearForest, deepForest);
    if (!nearPond(x, CAMP_CLEAR_DIST)) return x;
  }
  return CFG.baseX + (Math.random() < 0.5 ? -1 : 1) * (FOREST.startDist + 600);
}

function makeForestTree(x, r = Math.random) {
  // A handful of ancient giants tower over the canopy
  const ancient = r() < 0.14;
  return {
    x,
    tree: makeTree(x, ancient ? 280 + r() * 100 : 170 + r() * 80, r, { harvestable: true }),
    marked: false, chopped: false, beingChopped: false,
    chopProgress: 0,
    falling: false, fallDir: r() < 0.5 ? -1 : 1, fallAngle: 0, fallT: 0,
    lying: false, claimedBy: null, carriedBy: null,
    regrowTimer: 0,
  };
}

// ---------------- Ponds ----------------
// Small forest lakes of varied size. Purely shallow — everyone wades through;
// only ducks treat them as home. Regenerated deterministically from the tree
// seed, so they survive save/load without being stored.
const POND_TREE_MARGIN = 45; // trees stop this far short of the waterline

function makePonds(r) {
  const ponds = [];
  const count = 3 + Math.floor(r() * 3); // 3–5 per world
  const excludeLeft = CFG.baseX - FOREST.startDist - 220;
  const excludeRight = CFG.baseX + FOREST.startDist + 220;
  for (let tries = 0; tries < 80 && ponds.length < count; tries++) {
    const hw = 70 + r() * r() * 190; // half-width 70–260, small ponds most common
    const x = 1000 + r() * (CFG.worldWidth - 2000);
    const b = biomeAt(x);
    if (b.dry || b.hot || b.corrupt) continue;
    if (x + hw > excludeLeft && x - hw < excludeRight) continue; // keep the base area dry
    if (ponds.some(p => Math.abs(p.x - x) < p.hw + hw + 650)) continue;
    ponds.push({ x, hw, seed: Math.floor(r() * 1e9) });
  }
  return ponds;
}

function nearPond(x, margin = 0) {
  for (const p of (state.ponds || [])) if (Math.abs(x - p.x) < p.hw + margin) return p;
  return null;
}

// The pond the point is actually over the water of (not just the shore).
export function pondAt(x) {
  for (const p of (state.ponds || [])) if (Math.abs(x - p.x) < p.hw - 16) return p;
  return null;
}

export function nearestPond(x) {
  let best = null, bd = 1e9;
  for (const p of (state.ponds || [])) {
    const d = Math.abs(x - p.x);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

export function buildForest() {
  const r = mulberry32((Game.treeSeed || 1) + 777);
  const trees = [];
  const camps = [];
  const gapChance = 0.15;
  const excludeLeft = CFG.baseX - FOREST.startDist;
  const excludeRight = CFG.baseX + FOREST.startDist;

  // Ponds first, so camps and trees can keep clear of the water
  state.ponds = makePonds(r);

  // Place camps at intervals in the forest, both sides of base
  const campPositions = [];
  for (let x = excludeLeft - CAMP_SPACING; x > 200; x -= CAMP_SPACING + r() * 700) {
    campPositions.push(x + r() * 80 - 40);
  }
  for (let x = excludeRight + CAMP_SPACING; x < CFG.worldWidth - 200; x += CAMP_SPACING + r() * 700) {
    campPositions.push(x + r() * 80 - 40);
  }

  for (const cx of campPositions) {
    if (nearPond(cx, CAMP_CLEAR_DIST)) continue;
    camps.push(makeForestCamp(cx, r));
  }

  for (let x = FOREST.endDist; x < CFG.worldWidth - FOREST.endDist; x += FOREST.spacing) {
    if (x >= excludeLeft && x <= excludeRight) continue;
    if (r() < gapChance) continue;

    const offsetX = x + r() * (FOREST.spacing * 0.4) - (FOREST.spacing * 0.2);

    // Clear trees near camp positions
    let nearCamp = false;
    for (const c of camps) {
      if (Math.abs(offsetX - c.x) < CAMP_CLEAR_DIST) { nearCamp = true; break; }
    }
    if (nearCamp) continue;
    if (nearPond(offsetX, POND_TREE_MARGIN)) continue;

    trees.push(makeForestTree(offsetX, r));
  }

  state.forestTrees = trees;
  state.forestCamps = camps;
}

// Grow real, harvestable trees back into the clearing an abandoned camp
// leaves behind, so the forest closes up again.
function plantTreesAtCamp(x, r = Math.random) {
  for (let tx = x - CAMP_CLEAR_DIST + 15; tx < x + CAMP_CLEAR_DIST - 10; tx += FOREST.spacing * (0.85 + r() * 0.4)) {
    if (r() < 0.15) continue;
    state.forestTrees.push(makeForestTree(tx, r));
  }
}

// Remove standing trees around a (re)spawned camp so tents don't overlap them.
function clearTreesNearCamp(x) {
  for (const ft of (state.forestTrees || [])) {
    if (ft.chopped || ft.lying || ft.falling || ft.carriedBy) continue;
    if (Math.abs(ft.x - x) < CAMP_CLEAR_DIST) ft.chopped = true;
  }
}

export function addForestCamp(x, vagrants = 1) {
  state.forestCamps = state.forestCamps || [];
  let cx = x;
  const pond = nearPond(cx, CAMP_CLEAR_DIST);
  if (pond) cx += (cx < pond.x ? -1 : 1) * (pond.hw + CAMP_CLEAR_DIST + 18);
  const camp = makeForestCamp(cx);
  camp.vagrants = Math.max(1, Math.floor(vagrants));
  camp.mapped = true;
  clearTreesNearCamp(camp.x);
  state.forestCamps.push(camp);
  return camp;
}

const FALL_TIME = 0.85; // seconds for a felled tree to hit the ground

function regrowthBlocked(x) {
  for (const b of (state.buildings || [])) {
    if (!b.needsClearing) continue;
    if ((b.built || b.cleared) && Math.abs(b.x - x) < CFG.clearRadius + 18) return true;
  }
  for (const camp of (state.forestCamps || [])) {
    if (!camp.triggered && Math.abs(camp.x - x) < CAMP_CLEAR_DIST) return true;
  }
  return false;
}

function scheduleTreeRegrowth(tree) {
  tree.regrowTimer = rand(FOREST.regrowMin, FOREST.regrowMax);
}

function regrowTree(tree) {
  const fresh = makeForestTree(tree.x);
  Object.assign(tree, fresh);
  spawnParticles(tree.x, groundY - 10, 8, "#7fb45a", 22, 46);
}

export function updateForestCamps(dt) {
  const { player, forestCamps } = state;
  if (!forestCamps) return;
  for (const camp of forestCamps) {
    const nearCamp = dist(player.x, camp.x) < CAMP_TRIGGER;
    if (camp.blockedUntilExit && !nearCamp) camp.blockedUntilExit = false;

    if (camp.triggered) {
      camp.respawnTimer = (camp.respawnTimer || 0) - dt;
      if (camp.respawnTimer <= 0 && dist(player.x, camp.x) > CAMP_RESPAWN_DIST) {
        const oldX = camp.x;
        Object.assign(camp, makeForestCamp(pickCampX()));
        plantTreesAtCamp(oldX);
        clearTreesNearCamp(camp.x);
      }
      continue;
    }
    if (!nearCamp || camp.blockedUntilExit) continue;

    const popCap = currentPopCap();
    const freeSlots = Math.max(0, popCap - (state.vagrants.length + state.units.length));
    if (freeSlots <= 0) {
      camp.blockedUntilExit = true;
      continue;
    }

    const spawned = Math.min(camp.vagrants, freeSlots);
    for (let j = 0; j < spawned; j++) {
      state.vagrants.push({ x: camp.x + rand(-40, 40), vx: 0, targetX: CFG.baseX + rand(-260, 260), state: "wander", anim: rand(0, 6), speed: 190 });
    }
    camp.vagrants -= spawned;

    if (camp.vagrants <= 0) {
      camp.triggered = true;
      camp.respawnTimer = rand(CAMP_RESPAWN_MIN, CAMP_RESPAWN_MAX);
    } else {
      camp.blockedUntilExit = true;
    }
  }
}

export function updateForestTrees(dt) {
  const { forestTrees } = state;
  if (!forestTrees || !forestTrees.length) return;

  // Progress falling trees and regrow harvested ones after a randomized delay.
  for (const t of forestTrees) {
    if (t.chopped && !t.lying && !t.carriedBy && (t.regrowTimer || 0) > 0) {
      t.regrowTimer = Math.max(0, t.regrowTimer - dt);
      if (t.regrowTimer <= 0) {
        if (regrowthBlocked(t.x)) {
          scheduleTreeRegrowth(t);
        } else {
          regrowTree(t);
        }
      }
      continue;
    }

    if (!t.falling) continue;
    t.fallT = Math.min(1, (t.fallT || 0) + dt / FALL_TIME);
    const eased = t.fallT < 0.7
      ? 1.18 * t.fallT * t.fallT
      : 1 - Math.pow(1 - t.fallT, 3) * 0.08;
    t.fallAngle = clamp(eased, 0, 1) * (Math.PI / 2);
    if (t.fallT >= 1) {
      t.falling = false;
      t.lying = true;
      t.carriedBy = null;
    }
  }
}

// Returns the nearest unchopped, still-standing tree, or null.
// isSafe (optional) filters out spots the worker should avoid (e.g. bears).
export function nearestChoppableTree(x, isSafe) {
  const { forestTrees } = state;
  if (!forestTrees || !forestTrees.length) return null;
  let best = null, bd = 1e9;
  for (const t of forestTrees) {
    if (t.chopped || t.falling || t.lying || t.carriedBy) continue;
    if (isSafe && !isSafe(t.x)) continue;
    const d = dist(x, t.x);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

// Returns the nearest lying, unclaimed log ready to be carried home.
export function nearestLog(x, isSafe) {
  const { forestTrees } = state;
  if (!forestTrees || !forestTrees.length) return null;
  let best = null, bd = 1e9;
  for (const t of forestTrees) {
    if (!t.lying || t.claimedBy || t.carriedBy) continue;
    if (isSafe && !isSafe(t.x)) continue;
    const d = dist(x, t.x);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

export function chopTree(tree, dt, u) {
  tree.beingChopped = true;
  tree.chopProgress = clamp(tree.chopProgress + dt / FOREST.chopWork, 0, 1);
  if (Math.random() < 0.3) spawnParticles(tree.x + rand(-8, 8), groundY - 30, 1, "#8a6a3a", 15, 22);
  if (tree.chopProgress >= 1 && !tree.falling) {
    tree.beingChopped = false;
    tree.falling = true;
    tree.fallAngle = 0;
    tree.fallT = 0;
    spawnParticles(tree.x, groundY - 10, 10, "#8a6a3a", 40, 60);
    Audio.treeFall();
  }
}

// Deliver a carried log at the camp: reward the player and remove the log.
export function deliverLog(log) {
  log.chopped = true;
  log.lying = false;
  log.claimedBy = null;
  log.carriedBy = null;
  scheduleTreeRegrowth(log);
  const camps = (state.buildings || []).filter(b => b.type === "lumber" && b.built).length;
  const coins = 3 + camps * CFG.lumberLogBonus;
  spawnGoldReward(CFG.baseX, coins, "lumber", { spreadX: 24, fromY: groundY - 20, vx: 60 });
  Audio.build();
}
