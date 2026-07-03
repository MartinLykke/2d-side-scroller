import { CFG, FOREST } from '../../config/config.js';
import { clamp, dist, rand, mulberry32 } from '../../util/math.js';
import { Game, state } from '../../core/state.js';
import { groundY } from '../../core/canvas.js';
import { Audio } from '../infrastructure/Audio.js';
import { spawnParticles, spawnCoin, floaty } from './SpawnSystem.js';
import { makeTree } from '../../rendering/Effects.js';

const CAMP_SPACING = 600;
const CAMP_TRIGGER = 120;
const CAMP_CLEAR_DIST = 140;

export function buildForest() {
  const r = mulberry32((Game.treeSeed || 1) + 777);
  const trees = [];
  const camps = [];
  const gapChance = 0.15;
  const excludeLeft = CFG.baseX - FOREST.startDist;
  const excludeRight = CFG.baseX + FOREST.startDist;

  // Place camps at intervals in the forest, both sides of base
  const campPositions = [];
  for (let x = excludeLeft - CAMP_SPACING; x > 200; x -= CAMP_SPACING + r() * 300) {
    campPositions.push(x + r() * 80 - 40);
  }
  for (let x = excludeRight + CAMP_SPACING; x < CFG.worldWidth - 200; x += CAMP_SPACING + r() * 300) {
    campPositions.push(x + r() * 80 - 40);
  }

  for (const cx of campPositions) {
    const vcount = 1 + Math.floor(r() * 3);
    camps.push({ x: cx, vagrants: vcount, triggered: false });
  }

  for (let x = 100; x < CFG.worldWidth - FOREST.endDist; x += FOREST.spacing) {
    if (x >= excludeLeft && x <= excludeRight) continue;
    if (r() < gapChance) continue;

    const offsetX = x + r() * (FOREST.spacing * 0.4) - (FOREST.spacing * 0.2);

    // Clear trees near camp positions
    let nearCamp = false;
    for (const c of camps) {
      if (Math.abs(offsetX - c.x) < CAMP_CLEAR_DIST) { nearCamp = true; break; }
    }
    if (nearCamp) continue;

    const tree = makeTree(offsetX, 170 + r() * 80, r, { harvestable: true });
    trees.push({
      x: offsetX, tree,
      marked: false, chopped: false, beingChopped: false,
      chopProgress: 0,
      falling: false, fallDir: Math.random() < 0.5 ? -1 : 1, fallAngle: 0, fallT: 0,
      lying: false, claimedBy: null, carriedBy: null,
    });
  }

  state.forestTrees = trees;
  state.forestCamps = camps;
}

const FALL_TIME = 0.85; // seconds for a felled tree to hit the ground

export function updateForestCamps(dt) {
  const { player, forestCamps } = state;
  if (!forestCamps) return;
  for (const camp of forestCamps) {
    if (camp.triggered) continue;
    if (dist(player.x, camp.x) < CAMP_TRIGGER) {
      camp.triggered = true;
      let spawned = 0;
      for (let j = 0; j < camp.vagrants; j++) {
        if (state.vagrants.length + state.units.length >= CFG.popCapByLevel[state.base.level]) break;
        state.vagrants.push({ x: camp.x + rand(-40, 40), vx: 0, targetX: CFG.baseX + rand(-260, 260), state: "wander", anim: rand(0, 6), speed: 190 });
        spawned++;
      }
      if (spawned > 0) floaty(camp.x, `🙋 ${spawned} overlevende!`, "#cdbfa3");
    }
  }
}

export function updateForestTrees(dt) {
  const { player, forestTrees } = state;
  if (!forestTrees || !forestTrees.length) return;

  // Progress any trees currently falling over; once down they become a log.
  for (const t of forestTrees) {
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
      floaty(t.x, "🪵 Træ fældet!", "#caa46a");
    }
  }

  const keys = window._KEYS || {};
  const interact = keys["arrowdown"] || keys["s"];
  if (!interact) return;
  let nearest = null, nd = FOREST.interactRange;
  for (const t of forestTrees) {
    if (t.chopped || t.marked || t.falling || t.lying || t.carriedBy) continue;
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
    if (t.chopped || t.falling || t.lying || t.carriedBy || !t.marked) continue;
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
    if (!t.lying || t.claimedBy || t.carriedBy) continue;
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
    Audio.build();
  }
}

// Deliver a carried log at the camp: reward the player and remove the log.
export function deliverLog(log) {
  log.chopped = true;
  log.lying = false;
  log.claimedBy = null;
  log.carriedBy = null;
  const camps = (state.buildings || []).filter(b => b.type === "lumber" && b.built).length;
  const coins = 3 + camps * CFG.lumberLogBonus;
  for (let i = 0; i < coins; i++) spawnCoin(CFG.baseX + rand(-24, 24), 1, groundY - 20, rand(-60, 60));
  floaty(CFG.baseX, "🪵 Træstamme leveret!", "#caa46a");
  Audio.build();
}
