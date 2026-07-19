// dmg      = damage dealt to walls per hit (also base, unless baseDmg is set)
// baseDmg  = damage dealt to the base per hit (falls back to dmg)
// meleeDmg = damage dealt to the player on a direct melee hit
export const BIOME_BOSS_TYPES = {
  forest: "forestStalker",
  frozen: "skadiWrath",
  desert: "duneBroodmother",
  swamp: "sunkenBehemoth",
  volcano: "ignitedCore",
  corrupted: "voidMindflayer",
};

export const ENEMY_TYPES = {
  imp: { hp: 6, speed: 95, w: 22, color: "#8f221c", eye: "#ffd060", reward: 1, dmg: 6, baseDmg: 2, meleeDmg: 1 },
  fireImp: { name: "Flying Imp", hp: 8, speed: 64, w: 25, color: "#9b2418", eye: "#ffd060", reward: 3, dmg: 9, meleeDmg: 2, flying: true, fireball: true, shootRange: 430, shootInterval: 2.8 },
  emberBrute: {
    name: "Ember Brute", hp: 45, speed: 46, w: 50, color: "#5a1a10", eye: "#ff8a30",
    reward: 7, dmg: 11, meleeDmg: 2,
    charger: true, chargeMin: 5, chargeMax: 8, chargeRangeMin: 140, chargeRangeMax: 420,
    stomper: true, stompMin: 4.5, stompMax: 7, stompRadius: 95,
  },
  ashPriest: {
    name: "Ash Priest", hp: 14, speed: 110, w: 34, color: "#412225", eye: "#ffc060",
    reward: 4, dmg: 8, baseDmg: 3, meleeDmg: 2,
    caster: true, shootRange: 520, shootInterval: 3.4,
    ashFireballScale: 2.45, ashFireballRadius: 54, ashFireballSplash: 104, ashFireballDmg: 2,
    scorchRange: 265, scorchInterval: 4.8,
    wardRange: 285, wardInterval: 7.2,
    burstRadius: 112, burstInterval: 5.8,
  },
  chainImp: {
    name: "Chain Imp", hp: 10, speed: 106, w: 22, color: "#5f4436", eye: "#ffd84a",
    reward: 3, dmg: 2, baseDmg: 1, meleeDmg: 1,
    // Support unit: hangs back, hooks a grappling chain onto a wall so the imp
    // horde can climb it and vault far faster than building a stack. Physically
    // weak — killing it (or the chain) drops any imps mid-climb.
    chainImp: true, hookRange: 240, hookWindup: 0.95,
  },
  siegeImp: {
    name: "Siege Imp", hp: 58, speed: 34, w: 46, color: "#8a3520", eye: "#ffd060",
    reward: 9, dmg: 22, baseDmg: 8, meleeDmg: 2,
    // A huge shield up front deflects frontal arrows; heavy enough to ignore knockback.
    siege: true, shieldBlock: true, noKnockback: true,
    // Scrap platform on its back: loose imps can climb aboard and ride to the walls.
    platform: true, riderSeats: 3,
    // Ram cadence when braced against a wall/gate.
    ramWindup: 0.72, ramInterval: 1.55, ramRange: 58,
  },
  fireDragon: { name: "Fire Dragon", hp: 320, speed: 88, w: 120, color: "#7a1408", eye: "#ffd060", reward: 70, dmg: 14, meleeDmg: 2, flying: true, boss: true, dragon: true, noKnockback: true, shootInterval: 2.6, attackName: "Fire Breath" },
  magmaGolem: {
    name: "Magma Colossus", hp: 650, speed: 40, w: 130, color: "#3a2a26", eye: "#ffb040",
    reward: 130, dmg: 24, meleeDmg: 2,
    boss: true, golem: true, legendary: true, noKnockback: true, fireImmune: true,
    shootInterval: 7, attackName: "Volcanic Impact",
  },
  forestStalker: {
    name: "The Great Horned Stalker", hp: 720, speed: 56, w: 128, color: "#2d3f28", eye: "#b66bff",
    reward: 120, dmg: 22, baseDmg: 12, meleeDmg: 2,
    boss: true, legendary: true, biomeBoss: true, biome: "forest", forestStalker: true, noKnockback: true,
    shootInterval: 6.8, attackName: "Nature's Reclamation",
  },
  skadiWrath: {
    name: "Skadi's Wrath", hp: 820, speed: 54, w: 118, color: "#121927", eye: "#bfefff",
    reward: 130, dmg: 21, baseDmg: 10, meleeDmg: 2,
    boss: true, legendary: true, biomeBoss: true, biome: "frozen", skadiWrath: true, noKnockback: true, flying: true,
    shootInterval: 7.4, attackName: "Deep Freeze",
  },
  duneBroodmother: {
    name: "Broodmother of the Dunes", hp: 900, speed: 62, w: 132, color: "#c9ad72", eye: "#df8a3a",
    reward: 135, dmg: 23, baseDmg: 12, meleeDmg: 3,
    boss: true, legendary: true, biomeBoss: true, biome: "desert", duneBroodmother: true, noKnockback: true,
    shootInterval: 6.6, attackName: "Subterranean Breach",
  },
  sunkenBehemoth: {
    name: "The Sunken Behemoth", hp: 1080, speed: 38, w: 150, color: "#40542f", eye: "#b8ff7a",
    reward: 145, dmg: 25, baseDmg: 14, meleeDmg: 3,
    boss: true, legendary: true, biomeBoss: true, biome: "swamp", sunkenBehemoth: true, noKnockback: true,
    shootInterval: 8.2, attackName: "The Great Consumption",
  },
  ignitedCore: {
    name: "The Ignited Core", hp: 980, speed: 52, w: 126, color: "#21171a", eye: "#fff0a0",
    reward: 155, dmg: 26, baseDmg: 15, meleeDmg: 3,
    boss: true, legendary: true, biomeBoss: true, biome: "volcano", ignitedCore: true, noKnockback: true, fireImmune: true, flying: true,
    shootInterval: 6.2, attackName: "Supernova",
  },
  voidMindflayer: {
    name: "Mind-Flayer of the Void", hp: 1120, speed: 58, w: 128, color: "#160b28", eye: "#d7a8ff",
    reward: 175, dmg: 18, baseDmg: 9, meleeDmg: 3,
    boss: true, legendary: true, biomeBoss: true, biome: "corrupted", voidMindflayer: true, noKnockback: true, flying: true,
    shootInterval: 6.8, attackName: "Mass Possession",
  },

  // ── Phase 2: the Hollow ──────────────────────────────────────────────
  // After the hell portal falls, void rifts open and these spawn at night.
  shade: {
    name: "Shade", hp: 36, speed: 118, w: 24, color: "#241a38", eye: "#8fe8ff",
    reward: 2, dmg: 8, baseDmg: 3, meleeDmg: 1,
    // Shadow Claws: quick, low-damage double swings with a touch more reach.
    clawRange: 40, clawInterval: 0.55, clawDmg: 1,
    // Void Shift: flickers, then goes incorporeal — can't attack, takes far less
    // arrow damage (magic/explosions still hurt), keeps advancing.
    shiftInterval: 6.5, shiftWarn: 0.65, shiftDuration: 2.0, shiftArrowDR: 0.7,
    // Shadow Lunge: crouch-and-leap at a nearby defender; stuck & exposed on a miss.
    lungeRange: 150, lungeInterval: 4.5, lungeDmg: 3, lungeStun: 0.7,
    // Darken Structure: mist over a wall so void allies chew through it faster.
    darkenDuration: 5, darkenBonus: 0.55,
    // Death Shadow: a small lingering patch that hastens enemies who stand in it.
    deathShadowRadius: 58, deathShadowLife: 4,
  },
  voidWraith: {
    name: "Void Wrath", hp: 48, speed: 70, w: 26, color: "#352a54", eye: "#b9a0ff",
    reward: 4, dmg: 10, meleeDmg: 2,
    flying: true, fireball: true, voidBolt: true, shootRange: 450, shootInterval: 2.9,
    // Void Bolt marks its target; stacked marks make void allies hit harder.
    voidMarkDuration: 4, voidMarkPerStack: 0.18, voidMarkMax: 3,
    // Gravity Burst: a delayed collapse that drags defenders together.
    gravityInterval: 8, gravityDelay: 0.9, gravityRadius: 150, gravityLife: 2.4,
    // Void Rain: roots itself, then showers slow-fields across the ground below.
    rainInterval: 11, rainChannel: 1.4, rainDrops: 5, rainPoolLife: 3.2,
    // Rift Shield: below this HP fraction it raises a ring that eats a few frontal shots.
    riftShieldHpFrac: 0.42, riftShieldBlocks: 4,
    // Call of the Void: a long-cooldown pulse that snaps nearby Shades into Void Shift.
    callInterval: 13, callRange: 360,
  },
  voidBrute: {
    name: "Hollow Brute", hp: 120, speed: 50, w: 52, color: "#1c1430", eye: "#66e0ff",
    reward: 7, dmg: 13, meleeDmg: 2,
    charger: true, chargeMin: 4.5, chargeMax: 7.5, chargeRangeMin: 140, chargeRangeMax: 420,
    stomper: true, stompMin: 4, stompMax: 6.5, stompRadius: 100,
  },
  voidTitan: {
    name: "Void Titan", hp: 3280, speed: 43, w: 132, color: "#181226", eye: "#9be8ff",
    reward: 160, dmg: 26, meleeDmg: 3,
    boss: true, voidTitan: true, legendary: true, noKnockback: true,
    shootInterval: 7, attackName: "Reality Collapse",
  },
  voidSeraph: {
    name: "Null Seraph", hp: 2480, speed: 78, w: 150, color: "#0b0718", eye: "#d7f6ff",
    reward: 180, dmg: 18, meleeDmg: 3,
    boss: true, flying: true, voidSeraph: true, legendary: true, noKnockback: true,
    shootInterval: 2.6, summonInterval: 8.5, attackName: "Black Star Choir",
  },
};

// Which boss spawns as the first enemy of a given night.
// SpawnSystem consults this table, so adding a boss night is a one-line change.
// Bosses unlock on these nights and then spawn every night thereafter.
// nightEnemyType() handles the recurring logic; this table marks the unlock day.
export const BOSS_SCHEDULE = {
  3: "fireDragon",
  6: "magmaGolem",
  5: "forestStalker",
  8: "skadiWrath",
  10: "duneBroodmother",
  12: "sunkenBehemoth",
  14: "ignitedCore",
  16: "voidMindflayer",
};
