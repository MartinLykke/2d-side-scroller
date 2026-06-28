// dmg      = damage dealt to walls/base per hit
// meleeDmg = damage dealt to the player on a direct melee hit
export const ENEMY_TYPES = {
  // --- Early game (day 1-3) ---
  imp:     { hp: 3,  speed: 60,  w: 16, color: "#3a2a4a", eye: "#ff5a3c", reward: 1,  dmg: 6,  meleeDmg: 1 },
  runner:  { hp: 2,  speed: 112, w: 13, color: "#46243a", eye: "#ff8a3c", reward: 1,  dmg: 4,  meleeDmg: 1 },
  wraith:  { hp: 2,  speed: 88,  w: 13, color: "#1c1e30", eye: "#88b8ff", reward: 1,  dmg: 4,  meleeDmg: 1 },
  crawler: { hp: 5,  speed: 44,  w: 20, color: "#28301a", eye: "#88cc44", reward: 1,  dmg: 9,  meleeDmg: 1 },
  raider:  { hp: 6,  speed: 56,  w: 20, color: "#3a1c16", eye: "#ff7040", reward: 2,  dmg: 11, meleeDmg: 1 },
  // --- Mid game (day 3+) ---
  brute:   { hp: 11, speed: 42,  w: 26, color: "#2a2036", eye: "#ff3c3c", reward: 3,  dmg: 14, meleeDmg: 2 },
  ogre:    { hp: 18, speed: 30,  w: 30, color: "#263a20", eye: "#66ff44", reward: 4,  dmg: 18, meleeDmg: 1 },
  demon:   { hp: 7,  speed: 148, w: 14, color: "#6a1a1a", eye: "#ff1a1a", reward: 2,  dmg: 10, meleeDmg: 1 },
  flier:   { hp: 6,  speed: 70,  w: 18, color: "#1a2a5a", eye: "#44aaff", reward: 3,  dmg: 8,  meleeDmg: 1, flying: true },
  necro:   { hp: 28, speed: 32,  w: 32, color: "#2a1a3a", eye: "#aa44ff", reward: 7,  dmg: 22, meleeDmg: 2 },
  // --- Tiered bosses ---
  boss1:   { name:"Stenbjelder",    hp: 38,  speed: 34,  w: 40, color: "#2a1a3e", eye: "#ff40a0", reward: 9,  dmg: 20, meleeDmg: 2, noKnockback: true },
  boss2:   { name:"Blodridder",     hp: 75,  speed: 28,  w: 48, color: "#3c0808", eye: "#ff2020", reward: 16, dmg: 26, meleeDmg: 3, noKnockback: true },
  boss3:   { name:"Dødskæmper",     hp: 140, speed: 22,  w: 56, color: "#060620", eye: "#5020ff", reward: 26, dmg: 32, meleeDmg: 4, noKnockback: true },
  boss4:   { name:"Den Udødelige",  hp: 240, speed: 18,  w: 64, color: "#140a14", eye: "#ff20ee", reward: 40, dmg: 40, meleeDmg: 5, noKnockback: true },
};
