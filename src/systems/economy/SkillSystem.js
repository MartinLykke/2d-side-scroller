import { ARCHER_SKILLS } from '../../config/archerSkills.js';
import { GUARD_SKILLS } from '../../config/guardSkills.js';
import { state } from '../../core/state.js';

const SKILL_TREES = {
  archer: ARCHER_SKILLS,
  guard: GUARD_SKILLS,
};

function pointsKey(type) {
  return type === "guard" ? "guardSkillPoints" : "archerSkillPoints";
}

function unlockedKey(type) {
  return type === "guard" ? "guardSkills" : "archerSkills";
}

function normalizeSkillList(type) {
  const key = unlockedKey(type);
  state[key] = [...new Set(state[key] || [])];
  return state[key];
}

function skillSort(a, b) {
  const ask = a.skill;
  const bsk = b.skill;
  if (!!ask.ultimate !== !!bsk.ultimate) return ask.ultimate ? 1 : -1;
  if (ask.row !== bsk.row) return ask.row - bsk.row;
  if (ask.branch !== bsk.branch) return ask.branch - bsk.branch;
  if (ask.cost !== bsk.cost) return ask.cost - bsk.cost;
  return a.index - b.index;
}

function availableSkills(type) {
  const tree = SKILL_TREES[type];
  const unlocked = normalizeSkillList(type);
  const points = state[pointsKey(type)] || 0;
  return Object.values(tree)
    .map((skill, index) => ({ skill, index }))
    .filter(entry => !unlocked.includes(entry.skill.id))
    .filter(entry => points >= entry.skill.cost)
    .filter(entry => entry.skill.requires.every(id => unlocked.includes(id)))
    .sort(skillSort)
    .map(entry => entry.skill);
}

export function autoSpendSkillPoints(type = "both") {
  const types = type === "both" ? ["archer", "guard"] : [type];
  const purchased = [];

  for (const t of types) {
    if (!SKILL_TREES[t]) continue;
    normalizeSkillList(t);
    let changed = true;
    while (changed) {
      changed = false;
      const next = availableSkills(t)[0];
      if (!next) break;
      state[pointsKey(t)] = Math.max(0, (state[pointsKey(t)] || 0) - next.cost);
      state[unlockedKey(t)].push(next.id);
      purchased.push({ type: t, skill: next });
      changed = true;
    }
  }

  return purchased;
}

export function addSkillPoints(type, amount = 1) {
  if (!SKILL_TREES[type] || amount <= 0) return [];
  const key = pointsKey(type);
  state[key] = (state[key] || 0) + amount;
  return autoSpendSkillPoints(type);
}
