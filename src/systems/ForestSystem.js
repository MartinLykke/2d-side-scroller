import { CFG, FOREST } from '../config/config.js';
import { clamp, dist, rand, mulberry32 } from '../util/math.js';
import { Game, state } from '../state.js';
import { groundY } from '../canvas.js';
import { Audio } from './Audio.js';
import { spawnParticles, spawnCoin, floaty } from './SpawnSystem.js';
import { makeTree } from '../rendering/Effects.js';

// Dense forest fills the whole map with occasional gaps.
// Players mark a tree (S / ArrowDown while nearby) and builders fell it
// once their higher-priority wall work is done.
export function buildForest() {
  const r = mulberry32((Game.treeSeed || 1) + 777);
  const trees = [];
  const gapChance = 0.15; // 15% chance to leave a gap
  const excludeLeft = CFG.baseX - FOREST.startDist;
  const excludeRight = CFG.baseX + FOREST.startDist;

  for (let x = 100; x < CFG.worldWidth - FOREST.endDist; x += FOREST.spacing) {
    // Skip trees in the exclusion zone around the base
    if (x >= excludeLeft && x <= excludeRight) continue;

    // Randomly skip trees to create gaps
    if (r() < gapChance) continue;

    // Add slight random offset to x position
    const offsetX = x + r() * (FOREST.spacing * 0.4) - (FOREST.spacing * 0.2);
    const tree = makeTree(offsetX, 130 + r() * 60, r);
    trees.push({
      x: offsetX, tree,
      marked: false, chopped: false, beingChopped: false,
      chopProgress: 0,
      falling: false, fallDir: Math.random() < 0.5 ? -1 : 1, fallAngle: 0,
      lying: false, claimedBy: null,
    });
  }

  state.forestTrees = trees;
}

const FALL_TIME = 0.85; // seconds for a felled tree to hit the ground

export function updateForestTrees(dt) {
  const { player, forestTrees } = state;
  if (!forestTrees || !forestTrees.length) return;

  // Progress any trees currently falling over; once down they become a log.
  for (const t of forestTrees) {
    if (!t.falling) continue;
    t.fallAngle = Math.min(1, t.fallAngle + dt / FALL_TIME) * (Math.PI / 2);
    if (t.fallAngle >= Math.PI / 2 - 0.001) {
      t.falling = false;
      t.lying = true;
      floaty(t.x, "🪵 Træ fældet!", "#caa46a");
    }
  }

  const keys = window._KEYS || {};
  const interact = keys["arrowdown"] || keys["s"];
  if (!interact) return;
  let nearest = null, nd = FOREST.interactRange;
  for (const t of forestTrees) {
    if (t.chopped || t.marked || t.falling || t.lying) continue;
    const d = dist(player.x, t.x);
    if (d < nd) { nd = d; nearest = t; }
  }
  if (nearest) {
    nearest.marked = true;
    floaty(nearest.x, "🪓 Træ markeret", "#9bd05a");
  }
}

// Returns the nearest marked, unchopped, still-standing tree, or null.
export function nearestChoppableTree(x) {
  const { forestTrees } = state;
  if (!forestTrees || !forestTrees.length) return null;
  let best = null, bd = 1e9;
  for (const t of forestTrees) {
    if (t.chopped || t.falling || t.lying || !t.marked) continue;
    const d = dist(x, t.x);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

// Returns the nearest lying, unclaimed log ready to be carried home.
export function nearestLog(x) {
  const { forestTrees } = state;
  if (!forestTrees || !forestTrees.length) return null;
  let best = null, bd = 1e9;
  for (const t of forestTrees) {
    if (!t.lying || t.claimedBy) continue;
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
    spawnParticles(tree.x, groundY - 10, 10, "#8a6a3a", 40, 60);
    Audio.build();
  }
}

// Deliver a carried log at the camp: reward the player and remove the log.
export function deliverLog(log) {
  log.chopped = true;
  log.lying = false;
  log.claimedBy = null;
  for (let i = 0; i < 3; i++) spawnCoin(CFG.baseX + rand(-24, 24), 1, groundY - 20, rand(-60, 60));
  floaty(CFG.baseX, "🪵 Træstamme leveret!", "#caa46a");
  Audio.build();
}
