export const CFG = {
  worldWidth: 9000,
  baseX: 4500,
  groundFrac: 0.80,
  dayLength: 200,
  phases: { day: 0.55, dusk: 0.68, night: 0.85 },
  payInterval: 0.11,
  payRange: 78,
  playerSpeed: 250,
  playerSprint: 430,
  maxCoinsCarry: 999999,
  startCoins: 6,
  playerMaxHp: 5,
  playerInvuln: 0.9,
  playerRegenTime: 7,
  popCapByLevel: [0, 8, 16, 26, 40],
  baseUpgradeCost: [0, 12, 28, 55],
  baseMaxHp: [0, 60, 90, 130, 180],
  wallCost: 6,
  wallUpgradeCosts: [14, 22, 35, 55],
  wallHp: [0, 45, 90, 150, 220, 320],
  bowCost: 4,
  hammerCost: 3,
  farmCost: 10,
  farmUpgradeCosts: [10, 16, 24, 38, 58],
  critChance: 0.15,
  critMultiplier: 1.5,
  // Buildings unlocked by base upgrades
  clearRadius: 65,          // forest must be felled this close before building
  towerCosts: [18, 26, 40], // watchtower build + upgrade costs (lvl 1-3)
  towerRange: 430,
  lumberCost: 14,
  lumberMarkInterval: 7,    // seconds between auto-marked trees
  lumberLogBonus: 2,        // extra coins per delivered log, per camp
  shrineCost: 22,
  shrineRange: 190,
  shrineHealTime: 3.5,
};

export const STATIONS_X = {
  bow:    CFG.baseX - 130,
  hammer: CFG.baseX + 130,
  farm:   CFG.baseX - 480,
  shop:   CFG.baseX + 300,
  guard:  CFG.baseX + 220,
};

export const WALL_SLOTS = [
  { x: CFG.baseX - 340,  side: -1 },
  { x: CFG.baseX - 620,  side: -1 },
  { x: CFG.baseX + 340,  side:  1 },
  { x: CFG.baseX + 620,  side:  1 },
];

// Free-standing buildings unlocked by base upgrades. Slots inside the forest
// require the surrounding trees to be felled before construction can start.
export const BUILDING_SLOTS = [
  { type: "lumber", x: CFG.baseX - 1010, unlock: 2, needsClearing: true },
  { type: "lumber", x: CFG.baseX + 1010, unlock: 2, needsClearing: true },
  { type: "tower",  x: CFG.baseX - 780,  unlock: 3, needsClearing: true },
  { type: "tower",  x: CFG.baseX + 780,  unlock: 3, needsClearing: true },
  { type: "shrine", x: CFG.baseX + 480,  unlock: 3 },
];

export const PORTALS = [
  { x: 80, side: -1 },
  { x: CFG.worldWidth - 80, side:  1 },
];

// Dense forest: spawns only beyond the outermost wall slots, harvestable by builders.
export const FOREST = {
  startDist: 720,   // must be just beyond the outermost wall slot
  endDist: 1250,    // stays clear of the portals
  spacing: 46,
  interactRange: 70,
  chopWork: 1.6,    // seconds of builder work to fell a tree
};
