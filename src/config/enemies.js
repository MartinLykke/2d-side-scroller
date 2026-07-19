// dmg      = damage dealt to walls per hit (also base, unless baseDmg is set)
// baseDmg  = damage dealt to the base per hit (falls back to dmg)
// meleeDmg = damage dealt to the player on a direct melee hit
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

  // ── Phase 2: the Hollow ──────────────────────────────────────────────
  // After the hell portal falls, void rifts open and these spawn at night.
  shade: {
    name: "Shade", hp: 36, speed: 118, w: 24, color: "#241a38", eye: "#8fe8ff",
    reward: 2, dmg: 8, baseDmg: 3, meleeDmg: 1,
  },
  voidWraith: {
    name: "Void Wraith", hp: 48, speed: 70, w: 26, color: "#352a54", eye: "#b9a0ff",
    reward: 4, dmg: 10, meleeDmg: 2,
    flying: true, fireball: true, voidBolt: true, shootRange: 450, shootInterval: 2.6,
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
};
