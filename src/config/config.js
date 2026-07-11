export const CFG = {
  worldWidth: 9000,
  baseX: 4500,
  groundFrac: 0.80,
  dayLength: 200,
  nightClearTimeScale: 10,
  phases: { day: 0.55, dusk: 0.68, night: 0.90 },
  payInterval: 0.11,
  payRange: 78,
  playerSpeed: 250,
  playerSprint: 430,
  maxCoinsCarry: 300,
  maxGoldCoinValue: 10,
  startCoins: 6,
  playerMaxHp: 5,
  playerInvuln: 0.9,
  playerRegenTime: 7,
  popCapByLevel: [0, 8, 16, 26, 40],
  baseUpgradeCost: [0, 10, 24, 45],
  baseMaxHp: [0, 60, 90, 130, 180],
  wallCost: 5,
  wallUpgradeCosts: [11, 18, 28, 44],
  wallHp: [0, 45, 90, 150, 220, 320],
  bowCost: 4,
  hammerCost: 3,
  guardCost: 7,
  farmCost: 8,
  farmUpgradeCosts: [8, 13, 20, 31, 46],
  critChance: 0.15,
  critMultiplier: 1.5,
  // Buildings unlocked by base upgrades
  clearRadius: 65,          // forest must be felled this close before building
  towerCosts: [15, 22, 34], // watchtower build + upgrade costs (lvl 1-3)
  towerRange: 430,
  lumberCost: 11,
  lumberLogBonus: 2,        // extra coins per delivered log, per camp
  shrineCost: 18,
  shrineRange: 190,
  shrineHealTime: 3.5,
  // Mine (unlocked at base level 3): underground gold digging below the base
  mineCost: 24,
  minerCost: 5,
  minerInterval: 3.5,     // seconds of digging per gold coin
  mineVeinOre: 6,         // coins per vein before it is exhausted
  mineMaxLooseCoins: 80,  // miners stop digging when this much gold lies uncollected
  mineExpandStep: 170,    // how far a tunnel wall pushes out when its vein is exhausted
  repairAllCost: 14,
  reinforceCostBase: 26,
  reinforceCostPerDay: 2,
};

export const STATIONS_X = {
  bow:    CFG.baseX - 130,
  hammer: CFG.baseX + 130,
  farm:   CFG.baseX - 480,
  shop:   CFG.baseX + 445, // between the two right wall slots (mirrors the farm on the left)
  guard:  CFG.baseX + 220,
  mine:   CFG.baseX - 250,
};

// Underground mine below the base. Shares the surface x-coordinate space and
// ground line — only the rendered scene differs. The ladder sits at the same
// x as the surface entrance.
export const MINE = {
  left:  CFG.baseX - 660,
  right: CFG.baseX + 660,
  // The mine starts as one small chamber around the entrance/station and
  // widens outward (see MineSystem.expandMine) as the frontier veins embedded
  // in its end walls are dug out, up to left/right above.
  startLeft:  STATIONS_X.mine - 90,
  startRight: CFG.baseX - 40 + 110,
  entranceX: STATIONS_X.mine,
  stationX:  CFG.baseX - 40,
  depth: 136, // mine floor sits this far below the surface ground line
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
  { type: "shrine", x: CFG.baseX + 530,  unlock: 3 },
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
