// dmg      = damage dealt to walls/base per hit
// meleeDmg = damage dealt to the player on a direct melee hit
export const ENEMY_TYPES = {
  imp: { hp: 6, speed: 60, w: 22, color: "#8f221c", eye: "#ffd060", reward: 1, dmg: 6, meleeDmg: 1 },
  fireImp: { name: "Flying Imp", hp: 8, speed: 64, w: 25, color: "#9b2418", eye: "#ffd060", reward: 3, dmg: 9, meleeDmg: 2, flying: true, fireball: true, shootRange: 430, shootInterval: 2.8 },
  fireDragon: { name: "Ilddragen", hp: 320, speed: 88, w: 120, color: "#7a1408", eye: "#ffd060", reward: 70, dmg: 14, meleeDmg: 2, flying: true, boss: true, dragon: true, noKnockback: true, shootInterval: 2.6, attackName: "Ildånde" },
  magmaGolem: {
    name: "Magmakolossen", hp: 650, speed: 40, w: 130, color: "#3a2a26", eye: "#ffb040",
    reward: 130, dmg: 24, meleeDmg: 2,
    boss: true, golem: true, legendary: true, noKnockback: true, fireImmune: true,
    shootInterval: 7, attackName: "Vulkansk Nedslag",
  },
};

// Which boss spawns as the first enemy of a given night.
// SpawnSystem consults this table, so adding a boss night is a one-line change.
export const BOSS_SCHEDULE = {
  5: "fireDragon",
  10: "magmaGolem",
};
