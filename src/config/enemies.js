// dmg      = damage dealt to walls/base per hit
// meleeDmg = damage dealt to the player on a direct melee hit
export const ENEMY_TYPES = {
  imp:    { hp: 3,  speed: 60,  w: 16, color: "#3a2a4a", eye: "#ff5a3c", reward: 1,  dmg: 6,  meleeDmg: 1 },
  runner: { hp: 2,  speed: 112, w: 13, color: "#46243a", eye: "#ff8a3c", reward: 1,  dmg: 4,  meleeDmg: 1 },
  brute:  { hp: 11, speed: 42,  w: 26, color: "#2a2036", eye: "#ff3c3c", reward: 3,  dmg: 14, meleeDmg: 2 },
  boss:   { hp: 40, speed: 36,  w: 40, color: "#1f1830", eye: "#ff2a6a", reward: 12, dmg: 26, meleeDmg: 3 },
  ogre:   { hp: 18, speed: 30,  w: 30, color: "#263a20", eye: "#66ff44", reward: 4,  dmg: 18, meleeDmg: 1 },
  demon:  { hp: 7,  speed: 148, w: 14, color: "#6a1a1a", eye: "#ff1a1a", reward: 2,  dmg: 10, meleeDmg: 1 },
  flier:  { hp: 6,  speed: 70,  w: 18, color: "#1a2a5a", eye: "#44aaff", reward: 3,  dmg: 8,  meleeDmg: 1, flying: true },
  necro:  { hp: 28, speed: 32,  w: 32, color: "#2a1a3a", eye: "#aa44ff", reward: 7,  dmg: 22, meleeDmg: 2 },
};
