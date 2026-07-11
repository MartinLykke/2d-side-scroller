// dmg      = damage dealt to walls per hit (also base, unless baseDmg is set)
// baseDmg  = damage dealt to the base per hit (falls back to dmg)
// meleeDmg = damage dealt to the player on a direct melee hit
export const ENEMY_TYPES = {
  imp: { hp: 6, speed: 95, w: 22, color: "#8f221c", eye: "#ffd060", reward: 1, dmg: 6, baseDmg: 2, meleeDmg: 1 },
  fireImp: { name: "Flying Imp", hp: 8, speed: 64, w: 25, color: "#9b2418", eye: "#ffd060", reward: 3, dmg: 9, meleeDmg: 2, flying: true, fireball: true, shootRange: 430, shootInterval: 2.8 },
  emberBrute: {
    name: "Ember Brute", hp: 20, speed: 46, w: 50, color: "#5a1a10", eye: "#ff8a30",
    reward: 5, dmg: 11, meleeDmg: 2,
    charger: true, chargeMin: 5, chargeMax: 8, chargeRangeMin: 140, chargeRangeMax: 420,
    stomper: true, stompMin: 4.5, stompMax: 7, stompRadius: 95,
  },
  ashPriest: {
    name: "Ash Priest", hp: 14, speed: 52, w: 34, color: "#412225", eye: "#ffc060",
    reward: 4, dmg: 8, baseDmg: 3, meleeDmg: 2,
    caster: true, shootRange: 520, shootInterval: 3.4,
    scorchRange: 265, scorchInterval: 4.8,
    wardRange: 285, wardInterval: 7.2,
    burstRadius: 112, burstInterval: 5.8,
  },
  fireDragon: { name: "Fire Dragon", hp: 320, speed: 88, w: 120, color: "#7a1408", eye: "#ffd060", reward: 70, dmg: 14, meleeDmg: 2, flying: true, boss: true, dragon: true, noKnockback: true, shootInterval: 2.6, attackName: "Fire Breath" },
  magmaGolem: {
    name: "Magma Colossus", hp: 650, speed: 40, w: 130, color: "#3a2a26", eye: "#ffb040",
    reward: 130, dmg: 24, meleeDmg: 2,
    boss: true, golem: true, legendary: true, noKnockback: true, fireImmune: true,
    shootInterval: 7, attackName: "Volcanic Impact",
  },
};

// Which boss spawns as the first enemy of a given night.
// SpawnSystem consults this table, so adding a boss night is a one-line change.
export const BOSS_SCHEDULE = {
  5: "fireDragon",
  10: "magmaGolem",
};
