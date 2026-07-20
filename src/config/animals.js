export const ANIMAL_TYPES = {
  deer: {
    name: "Deer", family: "deer", biome: "forest", reward: 3,
    walkSpeed: 22, fleeSpeed: 82, hitRadius: 16, hitHeight: 36, stuckSpan: 12,
    blood: "#7a4a2a",
  },
  rabbit: {
    name: "Rabbit", family: "rabbit", biome: "forest", reward: 1,
    walkSpeed: 17, fleeSpeed: 68, hitRadius: 14, hitHeight: 26, stuckSpan: 10,
    blood: "#7a4a2a",
  },
  duck: {
    name: "Duck", family: "duck", biome: "forest", reward: 2,
    walkSpeed: 15, fleeSpeed: 150, hitRadius: 16, hitHeight: 32, stuckSpan: 12,
    canFly: true, water: true, swims: true, blood: "#7a4a2a",
  },

  reindeer: {
    name: "Reindeer", family: "deer", biome: "frozen", reward: 3,
    walkSpeed: 24, fleeSpeed: 86, hitRadius: 18, hitHeight: 42, stuckSpan: 14,
    blood: "#794236",
  },
  snowHare: {
    name: "Hare", family: "rabbit", biome: "frozen", reward: 1,
    walkSpeed: 18, fleeSpeed: 74, hitRadius: 14, hitHeight: 28, stuckSpan: 10,
    blood: "#794236",
  },
  wolf: {
    name: "Wolf", family: "canine", biome: "frozen", reward: 3,
    walkSpeed: 31, fleeSpeed: 92, hitRadius: 20, hitHeight: 38, stuckSpan: 15,
    blood: "#7d3131",
  },
  kingfisher: {
    name: "Kingfisher", family: "bird", biome: "frozen", reward: 2,
    walkSpeed: 10, fleeSpeed: 175, hitRadius: 13, hitHeight: 26, stuckSpan: 9,
    canFly: true, water: true, blood: "#566a7d",
  },

  lizard: {
    name: "Lizard", family: "lizard", biome: "desert", reward: 1,
    walkSpeed: 21, fleeSpeed: 78, hitRadius: 16, hitHeight: 20, stuckSpan: 12,
    blood: "#6a5b28",
  },
  gazelle: {
    name: "Gazelle", family: "deer", biome: "desert", reward: 3,
    walkSpeed: 27, fleeSpeed: 104, hitRadius: 17, hitHeight: 38, stuckSpan: 13,
    blood: "#8a5632",
  },
  scorpion: {
    name: "Scorpion", family: "scorpion", biome: "desert", reward: 2,
    walkSpeed: 18, fleeSpeed: 66, hitRadius: 16, hitHeight: 18, stuckSpan: 12,
    blood: "#4f5122",
  },
  eagle: {
    name: "Eagle", family: "bird", biome: "desert", reward: 3,
    walkSpeed: 12, fleeSpeed: 190, hitRadius: 17, hitHeight: 30, stuckSpan: 11,
    canFly: true, blood: "#6a3920",
  },

  giantFrog: {
    name: "Giant Frog", family: "frog", biome: "swamp", reward: 2,
    walkSpeed: 14, fleeSpeed: 82, hitRadius: 19, hitHeight: 26, stuckSpan: 13,
    water: true, swims: true, blood: "#5a7528",
  },
  crocodile: {
    name: "Crocodile", family: "crocodile", biome: "swamp", reward: 4,
    walkSpeed: 12, fleeSpeed: 58, hitRadius: 30, hitHeight: 24, stuckSpan: 22,
    water: true, swims: true, blood: "#50612b",
  },
  moorhen: {
    name: "Moorhen", family: "moorhen", biome: "swamp", reward: 2,
    walkSpeed: 16, fleeSpeed: 120, hitRadius: 14, hitHeight: 28, stuckSpan: 10,
    canFly: true, water: true, swims: true, blood: "#5a3131",
  },
  snake: {
    name: "Snake", family: "snake", biome: "swamp", reward: 2,
    walkSpeed: 18, fleeSpeed: 74, hitRadius: 19, hitHeight: 17, stuckSpan: 15,
    blood: "#4f6122",
  },

  lavaLizard: {
    name: "Lava Lizard", family: "lizard", biome: "volcano", reward: 2,
    walkSpeed: 22, fleeSpeed: 82, hitRadius: 17, hitHeight: 21, stuckSpan: 12,
    blood: "#ff6a24",
  },
  magmaBird: {
    name: "Magma Bird", family: "bird", biome: "volcano", reward: 3,
    walkSpeed: 11, fleeSpeed: 178, hitRadius: 16, hitHeight: 30, stuckSpan: 11,
    canFly: true, blood: "#ff6a24",
  },
  boar: {
    name: "Boar", family: "boar", biome: "volcano", reward: 3,
    walkSpeed: 24, fleeSpeed: 86, hitRadius: 21, hitHeight: 34, stuckSpan: 16,
    blood: "#7a3326",
  },

  corruptedDeer: {
    name: "Corrupted Deer", family: "deer", biome: "corrupted", reward: 4,
    walkSpeed: 23, fleeSpeed: 84, hitRadius: 18, hitHeight: 42, stuckSpan: 14,
    blood: "#7b3aa8",
  },
  shadowWolf: {
    name: "Shadow Wolf", family: "canine", biome: "corrupted", reward: 4,
    walkSpeed: 34, fleeSpeed: 98, hitRadius: 21, hitHeight: 39, stuckSpan: 15,
    blood: "#8a46d6",
  },
  possessedRaven: {
    name: "Possessed Raven", family: "bird", biome: "corrupted", reward: 3,
    walkSpeed: 10, fleeSpeed: 185, hitRadius: 15, hitHeight: 28, stuckSpan: 10,
    canFly: true, blood: "#8a46d6",
  },

  bear: {
    name: "Bear", family: "bear", biome: "forest", reward: 8,
    walkSpeed: 30, fleeSpeed: 130, hitRadius: 34, hitHeight: 62, stuckSpan: 24,
    blood: "#8a2a2a",
  },
};

export const BIOME_ANIMAL_POOLS = {
  forest: ["rabbit", "rabbit", "deer", "deer", "duck", "duck"],
  frozen: ["snowHare", "snowHare", "reindeer", "reindeer", "wolf", "kingfisher"],
  desert: ["lizard", "lizard", "gazelle", "gazelle", "scorpion", "eagle"],
  swamp: ["giantFrog", "giantFrog", "crocodile", "moorhen", "moorhen", "snake"],
  volcano: ["lavaLizard", "lavaLizard", "magmaBird", "magmaBird", "boar"],
  corrupted: ["corruptedDeer", "corruptedDeer", "shadowWolf", "possessedRaven", "possessedRaven"],
};

export function animalDef(type) {
  return ANIMAL_TYPES[type] || ANIMAL_TYPES.rabbit;
}
