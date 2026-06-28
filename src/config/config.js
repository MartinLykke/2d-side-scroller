export const CFG = {
  worldWidth: 14000,
  baseX: 7000,
  groundFrac: 0.80,
  dayLength: 160,
  phases: { day: 0.55, dusk: 0.65, night: 0.93 },
  payInterval: 0.11,
  payRange: 78,
  playerSpeed: 250,
  playerSprint: 430,
  maxCoinsCarry: 60,
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
};

export const STATIONS_X = {
  bow:    CFG.baseX - 130,
  hammer: CFG.baseX + 130,
  farm:   CFG.baseX - 300,
  shop:   CFG.baseX + 300,
  guard:  CFG.baseX + 220,
};

export const WALL_SLOTS = [
  { x: CFG.baseX - 560,  side: -1 },
  { x: CFG.baseX - 1020, side: -1 },
  { x: CFG.baseX + 560,  side:  1 },
  { x: CFG.baseX + 1020, side:  1 },
];

export const PORTALS = [
  { x: CFG.baseX - 1900, side: -1 },
  { x: CFG.baseX + 1900, side:  1 },
];
