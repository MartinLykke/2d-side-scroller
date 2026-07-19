import { W } from '../core/canvas.js';
import { Game, state } from '../core/state.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import {
  RENDER_BUDGETS,
  budgetDetailRank,
  chooseRenderBudget,
  renderRecoveryFrames,
  targetRenderFps,
} from './RenderBudgetPolicy.js';

let heldBudget = RENDER_BUDGETS.high;
let recoveryFrames = 0;
let lastFrameMs = 0;
let fpsEstimate = 144;

let frame = {
  id: 0,
  now: 0,
  views: new Map(),
  budget: heldBudget,
  load: { score: 0, enemies: 0, entities: 0, fps: 144, targetFps: 144 },
};

function computeView(pad) {
  const zoom = Game.zoom || 1;
  const halfVisible = W / (2 * zoom);
  const center = Game.cam + W / 2;
  return {
    left: center - halfVisible - pad,
    right: center + halfVisible + pad,
    center,
    width: halfVisible * 2,
  };
}

function countVisibleX(items, left, right, predicate = null) {
  if (!items || !items.length) return 0;
  let count = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const x = item?.x;
    if (!Number.isFinite(x) || x < left || x > right) continue;
    if (predicate && !predicate(item)) continue;
    count++;
  }
  return count;
}

function estimateRenderLoad(baseView) {
  const left = baseView.left - 700;
  const right = baseView.right + 700;
  let enemies = 0;
  let enemyWeight = 0;

  for (const e of state.enemies || []) {
    if (!e || !Number.isFinite(e.x) || e.x < left || e.x > right) continue;
    const t = ENEMY_TYPES[e.type];
    enemies++;
    enemyWeight += t?.boss || t?.legendary ? 7 : t?.flying ? 2.1 : 1.4;
    if (e.dying) enemyWeight += 0.6;
  }

  const units = countVisibleX(state.units, left, right, u => !u.mine);
  const vagrants = countVisibleX(state.vagrants, left, right);
  const animals = countVisibleX(state.animals, left, right, a => a.alive);
  const arrows = countVisibleX(state.arrows, left, right);
  const coins = countVisibleX(state.coins, left, right, c => !c.mine);
  const particles = countVisibleX(state.particles, left, right, p => !p.mine);
  const floats = countVisibleX(state.floatTexts, left, right, f => !f.mine);
  const spells = countVisibleX(state.spells, left, right);

  const entities = enemies + units + vagrants + animals + arrows + coins + spells;
  const score =
    enemyWeight +
    units * 1.1 +
    vagrants * 0.7 +
    animals * 0.85 +
    arrows * 0.45 +
    coins * 0.18 +
    particles * 0.12 +
    floats * 0.22 +
    spells * 1.2;

  return { score, enemies, entities, particles };
}

function settleBudget(load) {
  const target = chooseRenderBudget(load, Game);
  if (budgetDetailRank(target) < budgetDetailRank(heldBudget)) {
    heldBudget = target;
    recoveryFrames = 0;
    return heldBudget;
  }
  if (target.level === heldBudget.level) {
    recoveryFrames = 0;
    return heldBudget;
  }

  recoveryFrames++;
  const needed = Math.max(renderRecoveryFrames(Game), 90);
  if (recoveryFrames > needed) {
    heldBudget = target;
    recoveryFrames = 0;
  }
  return heldBudget;
}

export function beginRenderFrame() {
  const nowMs = performance.now();
  if (lastFrameMs > 0) {
    const dtMs = Math.max(1, nowMs - lastFrameMs);
    const instantFps = Math.min(240, 1000 / dtMs);
    fpsEstimate += (instantFps - fpsEstimate) * 0.12;
  }
  lastFrameMs = nowMs;

  frame = {
    id: frame.id + 1,
    now: nowMs / 1000,
    views: new Map(),
    budget: heldBudget,
    load: frame.load,
  };
  const baseView = computeView(0);
  frame.views.set(0, baseView);
  frame.load = estimateRenderLoad(baseView);
  frame.load.fps = fpsEstimate;
  frame.load.targetFps = targetRenderFps(Game);
  frame.budget = settleBudget(frame.load);
  return frame;
}

export function frameView(pad = 0) {
  let view = frame.views.get(pad);
  if (!view) {
    view = computeView(pad);
    frame.views.set(pad, view);
  }
  return view;
}

export function inFrameViewX(x, pad = 0) {
  const view = frameView(pad);
  return x >= view.left && x <= view.right;
}

export function frameNow() {
  return frame.now || performance.now() / 1000;
}

export function renderBudget() {
  return frame.budget || RENDER_BUDGETS.high;
}

export function renderLoad() {
  return frame.load;
}
