// dmg      = damage dealt to walls/base per hit
// meleeDmg = damage dealt to the player on a direct melee hit
export const ENEMY_TYPES = {
  // --- Early game (day 1-3) ---
  imp:     { hp: 3,  speed: 60,  w: 22, color: "#3a2a4a", eye: "#ff5a3c", reward: 1,  dmg: 6,  meleeDmg: 1 },
  runner:  { hp: 2,  speed: 112, w: 19, color: "#46243a", eye: "#ff8a3c", reward: 1,  dmg: 4,  meleeDmg: 1 },
  wraith:  { hp: 2,  speed: 88,  w: 19, color: "#1c1e30", eye: "#88b8ff", reward: 1,  dmg: 4,  meleeDmg: 1 },
  crawler: { hp: 5,  speed: 44,  w: 27, color: "#28301a", eye: "#88cc44", reward: 1,  dmg: 9,  meleeDmg: 1 },
  raider:  { hp: 6,  speed: 56,  w: 27, color: "#3a1c16", eye: "#ff7040", reward: 2,  dmg: 11, meleeDmg: 1 },
  // --- Mid game (day 3+) ---
  brute:   { hp: 11, speed: 42,  w: 34, color: "#2a2036", eye: "#ff3c3c", reward: 3,  dmg: 14, meleeDmg: 2 },
  ogre:    { hp: 18, speed: 30,  w: 40, color: "#263a20", eye: "#66ff44", reward: 4,  dmg: 18, meleeDmg: 1 },
  demon:   { hp: 7,  speed: 148, w: 20, color: "#6a1a1a", eye: "#ff1a1a", reward: 2,  dmg: 10, meleeDmg: 1 },
  flier:   { hp: 6,  speed: 70,  w: 24, color: "#1a2a5a", eye: "#44aaff", reward: 3,  dmg: 8,  meleeDmg: 1, flying: true },
  necro:   { hp: 28, speed: 32,  w: 42, color: "#2a1a3a", eye: "#aa44ff", reward: 7,  dmg: 22, meleeDmg: 2 },
  // --- Tiered bosses ---
  boss1:   { name:"Stenbjelder",    hp: 38,  speed: 34,  w: 62,  color: "#2a1a3e", eye: "#ff40a0", reward: 9,  dmg: 20, meleeDmg: 2, noKnockback: true },
  boss2:   { name:"Blodridder",     hp: 75,  speed: 28,  w: 78,  color: "#3c0808", eye: "#ff2020", reward: 16, dmg: 26, meleeDmg: 3, noKnockback: true },
  boss3:   { name:"Dødskæmper",     hp: 140, speed: 22,  w: 96,  color: "#060620", eye: "#5020ff", reward: 26, dmg: 32, meleeDmg: 4, noKnockback: true },
  boss4:   { name:"Den Udødelige",  hp: 240, speed: 18,  w: 116, color: "#140a14", eye: "#ff20ee", reward: 40, dmg: 40, meleeDmg: 5, noKnockback: true },
  // --- Legendary bosses (days 10 / 15 / 20) ---
  legend1: { name:"Skæbnebæreren",       hp:1400, speed:24, w:160, color:"#1a0a08", eye:"#ff6a00", reward:120, dmg:45, meleeDmg:5, noKnockback:true, legendary:true, specialCooldown:6,  windupTime:1.0, execTime:0.5, attackName:"JORDSTAMP" },
  legend2: { name:"Gravvolden",          hp:2800, speed:18, w:190, color:"#04041e", eye:"#00c8ff", reward:200, dmg:55, meleeDmg:6, noKnockback:true, legendary:true, specialCooldown:7,  windupTime:0.6, execTime:1.8, attackName:"LADNING"   },
  legend3: { name:"Den Evige Fordømmelse",hp:5000,speed:13, w:220, color:"#0a0010", eye:"#cc00ff", reward:320, dmg:70, meleeDmg:8, noKnockback:true, legendary:true, specialCooldown:9,  windupTime:1.4, execTime:0.4, attackName:"TOMHEDSPULS"},
};
