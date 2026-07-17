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
  playerDodgeSpeed: 760,
  playerDodgeTime: 0.18,
  playerDodgeCooldown: 1.15,
  playerDodgeInvuln: 0.24,
  dodgeRiposteRange: 78,
  dodgeRiposteTime: 3.2,
  dodgeRiposteDamageMult: 1.65,
  meleeCleaveRange: 86,
  meleeCleaveDamageFrac: 0.42,
  rallyCooldown: 24,
  rallyDuration: 4.8,
  rallyHomeRadius: 320,
  lastStandBaseHpFrac: 0.34,
  lastStandCooldownBonus: 0.35,
  nightPortalWarningTime: 1.35,
  maxCoinsCarry: 300,
  coinMagnetRange: 115,
  coinSprintMagnetBonus: 35,
  coinMomentumMagnetBonus: 30,
  coinPickupRange: 24,
  maxGoldCoinValue: 10,
  startCoins: 6,
  playerMaxHp: 5,
  playerInvuln: 0.9,
  playerRegenTime: 7,
  maxBaseLevel: 7,
  popCapByLevel: [0, 8, 16, 26, 40, 52, 66, 80],
  baseUpgradeCost: [0, 10, 24, 45, 90, 150, 230],
  baseMaxHp: [0, 60, 90, 130, 180, 250, 330, 430],
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
  // Ballista emplacements (unlocked at base level 6): heavy piercing bolts
  ballistaCosts: [45, 70],  // build + upgrade cost (lvl 1-2)
  ballistaRange: 640,
  // Crown Aegis (base level 7): the castle smites enemies near the walls
  aegisRange: 620,
  aegisInterval: 3.0,
  aegisDamage: 6,
  aegisSplashDamage: 2,   // reduced damage to enemies caught near the primary target
  aegisRadius: 80,
  // Portal assault (G): archers + guards march on a portal to destroy it
  portalHp: 300,
  portalHpPerDay: 12,        // portals harden as the days pass
  assaultWakeRange: 650,     // approach distance that triggers the defense wave
  assaultCelebrateTime: 4.2, // seconds of cheering after the portal falls
  assaultReturnTime: 2.2,    // seconds of marching home before the phase shift
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
  // Appended after the original slots so old saves (indexed by slot) still load.
  { type: "ballista", x: CFG.baseX - 900, unlock: 6, needsClearing: true },
  { type: "ballista", x: CFG.baseX + 900, unlock: 6, needsClearing: true },
];

export const PORTALS = [
  { x: 180, side: -1 },
  { x: CFG.worldWidth - 180, side:  1 },
];

// Dense forest: spawns only beyond the outermost wall slots, harvestable by builders.
export const FOREST = {
  startDist: 720,   // must be just beyond the outermost wall slot
  endDist: 1250,    // stays clear of the portals
  spacing: 46,
  interactRange: 70,
  chopWork: 1.6,    // seconds of builder work to fell a tree
  regrowMin: 90,    // seconds after a delivered log before the tree returns
  regrowMax: 190,
};
