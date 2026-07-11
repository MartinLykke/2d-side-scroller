export const GUARD_SKILLS = {
  // ── Branch 1: Spear ──
  piercing_thrust: {
    id: "piercing_thrust", branch: 1, row: 1,
    name: "Piercing Thrust",
    desc: "Thrusts deal 50% more damage and pierce 2 enemies in a line.",
    cost: 1, requires: [],
  },
  impale_wall_climber: {
    id: "impale_wall_climber", branch: 1, row: 2,
    name: "Wall-Climber Spear",
    desc: "If an enemy climbs a wall: impale them and hurl them far away.",
    cost: 2, requires: ["piercing_thrust"],
  },
  whirlwind_strike: {
    id: "whirlwind_strike", branch: 1, row: 3,
    name: "Whirlwind Strike",
    desc: "Spin around and hit all nearby enemies — cooldown 4 sec.",
    cost: 3, requires: ["impale_wall_climber"],
  },

  // ── Branch 2: Shield ──
  shield_bash: {
    id: "shield_bash", branch: 2, row: 1,
    name: "Shield Bash",
    desc: "Press Q — a shield bash knocks the enemy back and stuns them for 1 sec.",
    cost: 1, requires: [],
  },
  shield_wall: {
    id: "shield_wall", branch: 2, row: 2,
    name: "Shield Wall",
    desc: "When hit: reflect 40% of the damage back to the attacker.",
    cost: 2, requires: ["shield_bash"],
  },
  unbreakable: {
    id: "unbreakable", branch: 2, row: 3,
    name: "Unbreakable",
    desc: "Max HP increases by 4, and takes 20% less damage from all sources.",
    cost: 3, requires: ["shield_wall"],
  },

  // ── Branch 3: Tactics ──
  guard_stance: {
    id: "guard_stance", branch: 3, row: 1,
    name: "Vigilant Stance",
    desc: "While standing still: reduce incoming damage by 30% and convert it to XP.",
    cost: 1, requires: [],
  },
  taunt: {
    id: "taunt", branch: 3, row: 2,
    name: "Taunt",
    desc: "Hit enemy: force them to attack you for the next sec instead of the base.",
    cost: 2, requires: ["guard_stance"],
  },
  rally_cry: {
    id: "rally_cry", branch: 3, row: 3,
    name: "Rally Cry",
    desc: "Press Q — all allied units gain +20% damage for 6 seconds.",
    cost: 3, requires: ["taunt"],
  },

  // ── Ultimates ──
  spear_titan: {
    id: "spear_titan", branch: 0, row: 4,
    name: "Spear Titan",
    desc: "The spear grows massively: 3× range, 4× damage, can cleave enemies.",
    cost: 5, requires: ["whirlwind_strike", "taunt"],
    ultimate: true,
  },
  fortress_guardian: {
    id: "fortress_guardian", branch: 0, row: 4,
    name: "Fortress Guardian",
    desc: "The shield covers 360°: blocks all projectiles, and nearby allies take -25% damage.",
    cost: 5, requires: ["unbreakable", "rally_cry"],
    ultimate: true,
  },
};
