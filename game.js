/* =====================================================================
   KINGDOM — Crown of Embers
   A Kingdom-inspired 2D base-defense game. Vanilla JS + Canvas 2D.
   No build step, no external assets — all art drawn procedurally in a
   silhouette style; all sound synthesised with the Web Audio API.
   ===================================================================== */
"use strict";

/* ------------------------------------------------------------------ */
/*  CONFIG                                                             */
/* ------------------------------------------------------------------ */
const CFG = {
  worldWidth: 7600,
  baseX: 3800,
  groundFrac: 0.80,          // ground line as fraction of canvas height
  dayLength: 95,             // seconds per full day/night cycle
  phases: { day: 0.55, dusk: 0.66, night: 0.92 }, // upper bounds of t
  payInterval: 0.11,         // seconds between coins flying when paying
  payRange: 78,
  playerSpeed: 250,
  playerSprint: 430,
  maxCoinsCarry: 60,
  startCoins: 6,
  playerMaxHp: 5,
  playerInvuln: 0.9,       // seconds of i-frames after a hit
  playerRegenTime: 7,      // seconds to regenerate 1 heart when safe
  popCapByLevel: [0, 8, 16, 26, 40],   // index = base level
  baseUpgradeCost: [0, 12, 28, 55],    // cost to go from level i -> i+1
  baseMaxHp: [0, 60, 90, 130, 180],
  wallCost: 6,
  wallUpgradeCost: 14,
  wallHp: [0, 40, 90],       // by wall level
  bowCost: 4,
  hammerCost: 3,
  farmCost: 10,
};

const STATIONS_X = {
  bow: CFG.baseX - 130,
  hammer: CFG.baseX + 130,
  farm: CFG.baseX - 300,
};
const WALL_SLOTS = [
  { x: CFG.baseX - 560, side: -1 },
  { x: CFG.baseX - 1020, side: -1 },
  { x: CFG.baseX + 560, side: 1 },
  { x: CFG.baseX + 1020, side: 1 },
];
const PORTALS = [
  { x: CFG.baseX - 1900, side: -1 },
  { x: CFG.baseX + 1900, side: 1 },
];

/* ------------------------------------------------------------------ */
/*  WEAPONS                                                             */
/* ------------------------------------------------------------------ */
const WEAPONS = {
  rusty_sword:  { name:"Rustent sværd",  type:"melee",  dmg:2, speed:1.4, range:55,  rarity:0, col:"#8a8a92" },
  dagger:       { name:"Dolk",           type:"melee",  dmg:2, speed:0.55, range:40,  rarity:0, col:"#b0b0b8" },
  sword:        { name:"Sværd",          type:"melee",  dmg:3, speed:1.1,  range:62,  rarity:1, col:"#c8c8d0" },
  short_bow:    { name:"Kortbue",        type:"ranged", dmg:2, speed:1.1,  range:280, rarity:0, col:"#8a5a2a" },
  longsword:    { name:"Langsværd",      type:"melee",  dmg:4, speed:1.0,  range:74,  rarity:1, col:"#d0d0e0" },
  war_axe:      { name:"Krigsøkse",      type:"melee",  dmg:5, speed:1.5,  range:52,  rarity:1, col:"#9a8a62" },
  war_hammer:   { name:"Krigshammer",    type:"melee",  dmg:6, speed:1.9,  range:46,  rarity:1, col:"#7a7a82" },
  spear:        { name:"Spyd",           type:"melee",  dmg:3, speed:1.0,  range:90,  rarity:1, col:"#b8a870" },
  long_bow:     { name:"Langbue",        type:"ranged", dmg:3, speed:1.4,  range:380, rarity:1, col:"#7a4a1a" },
  crossbow:     { name:"Armbrøst",       type:"ranged", dmg:4, speed:1.9,  range:320, rarity:1, col:"#6a4a1a" },
  flame_sword:  { name:"Flammesværd",    type:"melee",  dmg:7, speed:1.0,  range:65,  rarity:2, col:"#ff6a2a" },
  ice_axe:      { name:"Isøkse",         type:"melee",  dmg:5, speed:1.2,  range:55,  rarity:2, col:"#6abaff" },
  gilded_spear: { name:"Forgyldt spyd",  type:"melee",  dmg:6, speed:1.0,  range:102, rarity:2, col:"#f2c14e" },
  kings_sword:  { name:"Kongens sværd",  type:"melee",  dmg:9, speed:1.0,  range:78,  rarity:3, col:"#f2c14e" },
  dark_bow:     { name:"Mørkets bue",    type:"ranged", dmg:6, speed:1.3,  range:450, rarity:3, col:"#8a2a9a" },
};
const RARITY_COL  = ["#c8c8c8","#9bd05a","#6ab4ff","#f2c14e"];
const RARITY_NAME = ["Almindelig","Ualmindelig","Sjælden","Legendarisk"];

/* ------------------------------------------------------------------ */
/*  EXPLORATION LOCATIONS                                               */
/* ------------------------------------------------------------------ */
const LOC_DEFS = {
  camp:        { name:"Forladt lejr",    emoji:"🌲", trig:130, maxE:2, goldR:[0,3],  wRar:[0,1], etype:["imp","runner"] },
  wagon:       { name:"Ødelagt vogn",    emoji:"🚛", trig:110, maxE:2, goldR:[1,4],  wRar:[0,1], etype:["imp","runner"] },
  grave:       { name:"Gammel grav",     emoji:"🪦", trig:90,  maxE:1, goldR:[0,2],  wRar:[0,1], etype:["imp"] },
  ruins:       { name:"Ruiner",          emoji:"🏛", trig:150, maxE:3, goldR:[2,6],  wRar:[1,2], etype:["imp","runner","brute"] },
  cave:        { name:"Grotte",          emoji:"🕳", trig:130, maxE:4, goldR:[4,10], wRar:[1,2], etype:["runner","brute"] },
  battlefield: { name:"Gammel slagmark", emoji:"⚔", trig:180, maxE:5, goldR:[3,8],  wRar:[1,2], etype:["imp","runner","brute"] },
  watchtower:  { name:"Vagttårn",        emoji:"🏰", trig:140, maxE:4, goldR:[2,6],  wRar:[2,3], etype:["imp","runner","brute"] },
  altar:       { name:"Mystisk alter",   emoji:"🧙", trig:120, maxE:6, goldR:[0,5],  wRar:[2,3], etype:["brute","boss"] },
};

/* ------------------------------------------------------------------ */
/*  UTIL                                                               */
/* ------------------------------------------------------------------ */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pickR = (r, arr) => arr[Math.floor(r() * arr.length)];
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dist = (a, b) => Math.abs(a - b);

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lerpColor(c1, c2, t) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

/* ------------------------------------------------------------------ */
/*  AUDIO  (synthesised, no files)                                     */
/* ------------------------------------------------------------------ */
const Audio = {
  ctx: null,
  enabled: true,
  master: null,
  ambGain: null,
  ambOsc: null,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      // ambient drone
      this.ambGain = this.ctx.createGain();
      this.ambGain.gain.value = 0.0;
      this.ambGain.connect(this.master);
      this.ambOsc = this.ctx.createOscillator();
      this.ambOsc.type = "sine";
      this.ambOsc.frequency.value = 110;
      const amb2 = this.ctx.createOscillator();
      amb2.type = "sine"; amb2.frequency.value = 110 * 1.5;
      const g2 = this.ctx.createGain(); g2.gain.value = 0.4;
      this.ambOsc.connect(this.ambGain);
      amb2.connect(g2); g2.connect(this.ambGain);
      this.ambOsc.start(); amb2.start();
    } catch (e) { this.ctx = null; }
  },
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); },
  blip(freq, dur, type = "square", vol = 0.3, slideTo = null) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },
  coin()    { this.blip(880, 0.09, "triangle", 0.25, 1320); },
  pay()     { this.blip(660, 0.06, "triangle", 0.18, 990); },
  build()   { this.blip(150, 0.12, "square", 0.25, 80); },
  bow()     { this.blip(420, 0.08, "sawtooth", 0.12, 180); },
  hit()     { this.blip(200, 0.07, "square", 0.2, 90); },
  enemyDie(){ this.blip(140, 0.18, "sawtooth", 0.22, 50); },
  recruit() { this.blip(523, 0.08, "triangle", 0.22); setTimeout(()=>this.blip(784,0.12,"triangle",0.22),80); },
  upgrade() { this.blip(523,0.1,"triangle",0.25); setTimeout(()=>this.blip(659,0.1,"triangle",0.25),90); setTimeout(()=>this.blip(880,0.16,"triangle",0.28),180); },
  horn()    { this.blip(160, 0.6, "sawtooth", 0.3, 130); setTimeout(()=>this.blip(120,0.8,"sawtooth",0.28,100),120); },
  setNight(isNight) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.ambGain.gain.cancelScheduledValues(t);
    this.ambGain.gain.linearRampToValueAtTime(isNight ? 0.10 : 0.04, t + 2);
    this.ambOsc.frequency.linearRampToValueAtTime(isNight ? 70 : 110, t + 2);
  },
  toggle() { this.enabled = !this.enabled; this.master && (this.master.gain.value = this.enabled ? 0.35 : 0); return this.enabled; },
};

/* ------------------------------------------------------------------ */
/*  INPUT                                                              */
/* ------------------------------------------------------------------ */
const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(e.key.toLowerCase())) e.preventDefault();
  if (e.key.toLowerCase() === "m") UI.toggleMute();
  if (e.key.toLowerCase() === "p" && Game.state === "play") Game.togglePause();
  else if (e.key.toLowerCase() === "p" && Game.state === "pause") Game.togglePause();
  if (e.key === "`") DEV.toggle();
});
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

/* ------------------------------------------------------------------ */
/*  CANVAS                                                             */
/* ------------------------------------------------------------------ */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let W = 0, H = 0, groundY = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  groundY = Math.floor(H * CFG.groundFrac);
  if (FX) initFX(); // regenerate screen-space atmosphere for the new size
}
window.addEventListener("resize", resize);

/* ------------------------------------------------------------------ */
/*  GAME STATE                                                         */
/* ------------------------------------------------------------------ */
const Game = {
  state: "menu",   // menu | play | pause | end
  time: 0,         // 0..1 within current day
  day: 1,
  isNight: false,
  cam: 0,
  treeSeed: 12345,
  spawnTimer: 0,
  nightQuota: 0,
  nightSpawned: 0,
  wasNight: false,
  goalReached: false,       // base reached castle
  surviveNightForWin: false,
  winNightActive: false,    // a qualifying night is in progress
  pendingWin: false,        // survived the qualifying night
  autosaveTimer: 0,
  windT: 0,                 // wind clock driving all sway/atmosphere
};

let player, base, units, vagrants, enemies, coins, arrows, animals, walls, particles, floatTexts, portals, stations, vagrantTimer, animalTimer, lootItems, locations, groundBows;

/* ----------  Entity factories  ---------- */
function makePlayer() {
  return { x: CFG.baseX, vx: 0, dir: 1, coins: CFG.startCoins, gallop: 0, hasCrown: true, bob: 0,
           hp: CFG.playerMaxHp, maxHp: CFG.playerMaxHp, invuln: 0, hurt: 0, knock: 0, regen: 0,
           weapon: null, attackCd: 0, swing: 0 };
}
function makeBase() {
  return { x: CFG.baseX, level: 1, hp: CFG.baseMaxHp[1], maxHp: CFG.baseMaxHp[1], paid: 0, flash: 0 };
}
function makeWall(slot) {
  return { x: slot.x, side: slot.side, level: 0, hp: 0, maxHp: 0, buildProgress: 0, commissioned: false, paid: 0, flash: 0 };
}

/* ------------------------------------------------------------------ */
/*  STATIONS (payable interaction points)                              */
/* ------------------------------------------------------------------ */
function buildStations() {
  stations = [];
  // Base upgrade
  stations.push({
    id: "base", x: () => base.x, paid: 0,
    cost: () => base.level < 4 ? CFG.baseUpgradeCost[base.level] : 0,
    label: () => base.level < 4 ? `Opgradér ${baseName(base.level)} → ${baseName(base.level+1)}` : "Slottet er fuldt udbygget",
    onPaid: () => upgradeBase(),
  });
  // Bow shop
  stations.push({
    id: "bow", x: () => STATIONS_X.bow, paid: 0,
    cost: () => CFG.bowCost,
    label: () => "Køb bue (skab en bueskytte)",
    onPaid: () => { groundBows.push({ x: STATIONS_X.bow + rand(-12, 12), claimed: false }); floaty(STATIONS_X.bow, "🏹 Bue klar!"); Audio.recruit(); },
  });
  // Hammer shop
  stations.push({
    id: "hammer", x: () => STATIONS_X.hammer, paid: 0,
    cost: () => CFG.hammerCost,
    label: () => "Køb hammer (skab en bygger)",
    onPaid: () => { state_pendingHammers++; floaty(STATIONS_X.hammer, "🔨 Hammer klar"); Audio.recruit(); },
  });
  // Farm
  stations.push({
    id: "farm", x: () => STATIONS_X.farm, paid: 0,
    cost: () => state_farmBuilt ? 0 : CFG.farmCost,
    label: () => state_farmBuilt ? "Gården producerer guld" : "Byg gård (passiv guldindkomst)",
    onPaid: () => { state_farmBuilt = true; state_pendingFarmers++; floaty(STATIONS_X.farm, "🌾 Gård bygget"); Audio.build(); },
  });
  // Walls
  walls.forEach((w) => {
    stations.push({
      id: "wall", wall: w, x: () => w.x, paid: 0,
      cost: () => {
        if (!w.commissioned) return CFG.wallCost;
        if (w.level < 2 && w.buildProgress >= 1) return CFG.wallUpgradeCost;
        return 0;
      },
      label: () => {
        if (!w.commissioned) return "Byg mur";
        if (w.buildProgress < 1) return "Bygges...";
        if (w.level < 2) return "Opgradér mur → sten";
        return "Mur (maks)";
      },
      onPaid: () => {
        if (!w.commissioned) { w.commissioned = true; w.level = 1; w.maxHp = CFG.wallHp[1]; w.hp = 0; w.buildProgress = 0; floaty(w.x, "🚧 Mur bestilt"); }
        else if (w.level < 2) { w.level = 2; w.maxHp = CFG.wallHp[2]; w.buildProgress = clamp(w.hp / w.maxHp, 0.2, 1); floaty(w.x, "⛰ Stenmur"); }
        Audio.build();
      },
    });
  });
}

// loosely-coupled assignment queues
let state_pendingBows = 0, state_pendingHammers = 0, state_pendingFarmers = 0, state_farmBuilt = false;

function baseName(lvl) { return ["—", "Lejr", "Lille landsby", "Stor landsby", "Slot"][lvl]; }

function upgradeBase() {
  if (base.level >= 4) return;
  base.level++;
  base.maxHp = CFG.baseMaxHp[base.level];
  base.hp = base.maxHp;
  base.flash = 1;
  floaty(base.x, "🏰 " + baseName(base.level) + "!");
  Audio.upgrade();
  if (base.level === 4) { Game.goalReached = true; Game.surviveNightForWin = true; }
}

/* ------------------------------------------------------------------ */
/*  SPAWNING HELPERS                                                   */
/* ------------------------------------------------------------------ */
function spawnCoin(x, value = 1, fromY = -40, vx = 0) {
  coins.push({ x, y: fromY, vy: -120, value, settled: false, life: 60, magnet: false, vx });
}
function floaty(x, text, color = "#f2c14e") {
  floatTexts.push({ x, y: groundY - 90, text, color, life: 1.4, vy: -34 });
}
function spawnParticles(x, y, n, color, spread = 60, up = 80) {
  for (let i = 0; i < n; i++)
    particles.push({ x, y, vx: rand(-spread, spread), vy: rand(-up, -up * 0.2), life: rand(0.4, 0.9), color, size: rand(1.5, 3.5) });
}

function spawnVagrant() {
  const total = vagrants.length + units.length;
  if (total >= CFG.popCapByLevel[base.level]) return;
  const side = pick([-1, 1]);
  const x = side < 0 ? rand(1600, 2400) : rand(CFG.worldWidth - 2400, CFG.worldWidth - 1600);
  vagrants.push({ x, vx: 0, targetX: CFG.baseX + rand(-260, 260), state: "wander", anim: rand(0, 6) });
}

function spawnAnimal() {
  if (animals.length > 6) return;
  const side = pick([-1, 1]);
  const x = side < 0 ? rand(1300, 2600) : rand(CFG.worldWidth - 2600, CFG.worldWidth - 1300);
  animals.push({ x, vx: rand(20, 40) * pick([-1, 1]), state: "graze", alive: true, anim: rand(0, 6), flee: 0, type: pick(["rabbit", "rabbit", "deer"]) });
}

function makeUnit(role, x) {
  return { role, x, vx: 0, dir: 1, state: "idle", targetX: x, hp: role === "archer" ? 6 : 5, maxHp: role === "archer" ? 6 : 5,
           cooldown: 0, anim: rand(0, 6), wall: null, retreating: false, workTimer: 0, panic: 0 };
}

/* ------------------------------------------------------------------ */
/*  ENEMIES                                                            */
/* ------------------------------------------------------------------ */
const ENEMY_TYPES = {
  imp:    { hp: 3,  speed: 60, w: 16, color: "#3a2a4a", eye: "#ff5a3c", reward: 1, dmg: 6 },
  runner: { hp: 2,  speed: 112, w: 13, color: "#46243a", eye: "#ff8a3c", reward: 1, dmg: 4 },
  brute:  { hp: 11, speed: 42, w: 26, color: "#2a2036", eye: "#ff3c3c", reward: 3, dmg: 14 },
  boss:   { hp: 40, speed: 36, w: 40, color: "#1f1830", eye: "#ff2a6a", reward: 12, dmg: 26 },
};
function spawnEnemy(type, portal) {
  const t = ENEMY_TYPES[type];
  enemies.push({
    x: portal.x, vx: 0, type, hp: t.hp, maxHp: t.hp, dir: portal.side > 0 ? -1 : 1,
    state: "advance", target: null, attackCd: 0, carry: 0, anim: rand(0, 6), flash: 0, fleeing: false, portal,
  });
}

function planNight() {
  const d = Game.day;
  Game.nightQuota = Math.round(3 + d * 2.2);
  Game.nightSpawned = 0;
  Game.spawnTimer = 0;
}
function nightEnemyType() {
  const d = Game.day;
  const r = Math.random();
  if (d >= 4 && Game.nightSpawned === 0 && Game.nightQuota >= 16 && d % 3 === 0) return "boss";
  if (d >= 3 && r < 0.18) return "brute";
  if (r < 0.35 + d * 0.02) return "runner";
  return "imp";
}

/* ------------------------------------------------------------------ */
/*  LOCATIONS                                                          */
/* ------------------------------------------------------------------ */
function buildLocations() {
  locations = [];
  const r = mulberry32((Game.treeSeed || 1) * 31 + 17);
  let x = 120;
  while (x < CFG.worldWidth - 120) {
    x += 380 + r() * 450;
    if (Math.abs(x - CFG.baseX) < 520) continue;
    if (x >= CFG.worldWidth - 120) break;
    const roll = r();
    if (roll < 0.50) { /* nothing */ }
    else if (roll < 0.75) { locations.push(makeLocation(x, pickR(r,["camp","wagon","grave"]), r)); }
    else if (roll < 0.90) { locations.push(makeLocation(x, pickR(r,["ruins","cave","battlefield"]), r)); }
    else if (roll < 0.98) { locations.push(makeLocation(x, "watchtower", r)); }
    else                  { locations.push(makeLocation(x, "altar", r)); }
  }
}

function makeLocation(x, type, r) {
  const def = LOC_DEFS[type];
  const goldAmt = Math.round(def.goldR[0] + r() * (def.goldR[1] - def.goldR[0]));
  let weaponId = null;
  if (r() < 0.70) {
    const rarMin = def.wRar[0], rarMax = def.wRar[1];
    const targetRar = rarMin + Math.floor(r() * (rarMax - rarMin + 1));
    const wList = Object.keys(WEAPONS).filter(k => WEAPONS[k].rarity === targetRar);
    if (wList.length) weaponId = wList[Math.floor(r() * wList.length)];
  }
  const enemyCount = Math.floor(r() * (def.maxE + 1));
  return { x, type, triggered:false, cleared:enemyCount===0, lootGold:goldAmt, weaponId, enemyCount, remainingEnemies:0, lootSpawned:false, ph:r()*6 };
}

function triggerLocation(loc, idx) {
  loc.triggered = true;
  const def = LOC_DEFS[loc.type];
  if (loc.enemyCount === 0) { spawnLocLoot(loc); return; }
  loc.remainingEnemies = loc.enemyCount;
  for (let i = 0; i < loc.enemyCount; i++) {
    const type = pick(def.etype);
    const ex = loc.x + (i % 2 === 0 ? -1 : 1) * (28 + i * 18);
    enemies.push({
      x:ex, vx:0, type, hp:ENEMY_TYPES[type].hp, maxHp:ENEMY_TYPES[type].hp,
      dir: player.x < ex ? -1 : 1, attackCd:0, carry:0, anim:rand(0,6),
      flash:0, fleeing:false, portal:null, locIdx:idx, home:loc.x,
    });
  }
  floaty(loc.x, LOC_DEFS[loc.type].emoji + " " + LOC_DEFS[loc.type].name + "!", "#ff8a6a");
}

function spawnLocLoot(loc) {
  loc.lootSpawned = true;
  if (loc.lootGold > 0) {
    for (let i = 0; i < loc.lootGold; i++) spawnCoin(loc.x + rand(-50,50), 1, -30, rand(-40,40));
  }
  if (loc.weaponId) {
    lootItems.push({ x:loc.x + rand(-24,24), weaponId:loc.weaponId });
    const w = WEAPONS[loc.weaponId];
    floaty(loc.x, "⚔ " + w.name + "!", RARITY_COL[w.rarity]);
  }
}

function pickupWeapon(weaponId) {
  if (player.weapon) lootItems.push({ x:player.x + rand(-20,20), weaponId:player.weapon });
  player.weapon = weaponId;
  const w = WEAPONS[weaponId];
  floaty(player.x, "⚔ " + w.name, RARITY_COL[w.rarity]);
  Audio.upgrade();
}

/* ------------------------------------------------------------------ */
/*  NEW GAME / RESET                                                   */
/* ------------------------------------------------------------------ */
function newGame() {
  player = makePlayer();
  base = makeBase();
  units = []; vagrants = []; enemies = []; coins = []; arrows = [];
  animals = []; particles = []; floatTexts = []; portals = PORTALS.map(p => ({ ...p }));
  walls = WALL_SLOTS.map(makeWall);
  state_pendingBows = 0; state_pendingHammers = 0; state_pendingFarmers = 0; state_farmBuilt = false;
  groundBows = [];
  Game.treeSeed = randInt(1, 99999);
  buildStations();
  lootItems = []; locations = []; buildLocations();
  Game.time = 0.06; Game.day = 1; Game.isNight = false; Game.wasNight = false;
  Game.goalReached = false; Game.surviveNightForWin = false;
  Game.winNightActive = false; Game.pendingWin = false;
  vagrantTimer = 1; animalTimer = 2; Game.autosaveTimer = 0;
  // seed world with a little starting gold + a couple of vagrants
  for (let i = 0; i < 6; i++) coins.push({ x: CFG.baseX + rand(-200, 200), y: groundY, vy: 0, value: 1, settled: true, life: 9999, magnet: false, vx: 0 });
  for (let i = 0; i < 3; i++) spawnVagrant();
  for (let i = 0; i < 4; i++) spawnAnimal();
  planNight();
}

/* ------------------------------------------------------------------ */
/*  UPDATE                                                             */
/* ------------------------------------------------------------------ */
function update(dt) {
  updateTime(dt);
  updatePlayer(dt);
  updatePlayerAttack(dt);
  updatePayment(dt);
  updateVagrants(dt);
  updateAssignments();
  updateUnits(dt);
  updateAnimals(dt);
  updateLocations(dt);
  updateEnemies(dt);
  updateArrows(dt);
  updateCoins(dt);
  updateLootItems(dt);
  updateParticles(dt);
  updateFloats(dt);
  updateSpawning(dt);
  updateCamera();
  checkEndConditions();
  updateAutosave(dt);
}

function updateTime(dt) {
  Game.time += dt / CFG.dayLength;
  if (Game.time >= 1) {
    Game.time -= 1;
    Game.day++;
    planNight();
    // dawn: win check handled in checkEnd; enemies flee
  }
  const t = Game.time;
  const nowNight = t > CFG.phases.dusk && t <= CFG.phases.night;
  if (nowNight && !Game.isNight) {
    Game.isNight = true; Audio.horn(); Audio.setNight(true);
    if (Game.surviveNightForWin) Game.winNightActive = true; // this night counts toward victory
  }
  if (!nowNight && Game.isNight) {
    Game.isNight = false; Audio.setNight(false); enemies.forEach(e => e.fleeing = true);
    if (Game.winNightActive) { Game.winNightActive = false; Game.pendingWin = true; } // survived it
  }
}

function phaseName() {
  const t = Game.time;
  if (t <= CFG.phases.day) return "Dag";
  if (t <= CFG.phases.dusk) return "Aften";
  if (t <= CFG.phases.night) return "Nat";
  return "Daggry";
}

function updatePlayer(dt) {
  const left = keys["a"] || keys["arrowleft"];
  const right = keys["d"] || keys["arrowright"];
  const sprint = keys["shift"];
  const speed = sprint ? CFG.playerSprint : CFG.playerSpeed;
  let move = 0;
  if (left) move -= 1;
  if (right) move += 1;
  player.vx = move * speed;
  player.x = clamp(player.x + player.vx * dt, 120, CFG.worldWidth - 120);
  if (move !== 0) { player.dir = move; player.gallop += dt * (sprint ? 16 : 10); player.bob = Math.abs(Math.sin(player.gallop)) * 3; }
  else { player.bob *= 0.9; } // stand still: don't advance the gait

  // knockback slide, i-frames, hurt flash, and slow regen when safe
  if (player.knock) { player.x = clamp(player.x + player.knock * dt, 120, CFG.worldWidth - 120); player.knock *= 0.86; if (Math.abs(player.knock) < 6) player.knock = 0; }
  if (player.invuln > 0) player.invuln -= dt;
  if (player.hurt > 0) player.hurt -= dt;
  if (player.hp < player.maxHp) {
    if (!nearestEnemy(player.x, 220)) { player.regen += dt; if (player.regen >= CFG.playerRegenTime) { player.regen = 0; player.hp++; floaty(player.x, "+❤", "#e0556a"); } }
    else player.regen = 0;
  }
}

/* ----------  Payment: stand near a station, coins fly out  -------- */
let payCooldown = 0, lastPaidStation = null;
function updatePayment(dt) {
  payCooldown -= dt;
  // find nearest station in range that currently costs something
  let near = null, nd = CFG.payRange;
  for (const s of stations) {
    const c = s.cost();
    if (c <= 0) continue;
    const d = dist(player.x, s.x());
    if (d < nd) { nd = d; near = s; }
  }
  // refund a different partially-paid station if we walked away
  if (lastPaidStation && lastPaidStation !== near && lastPaidStation.paid > 0) {
    for (let i = 0; i < lastPaidStation.paid; i++) spawnCoin(lastPaidStation.x() + rand(-20, 20), 1, -10);
    lastPaidStation.paid = 0;
  }
  if (!near) { lastPaidStation = null; return; }
  lastPaidStation = near;
  const payHeld = keys["arrowdown"] || keys["s"]; // pay only while the player chooses to
  if (player.coins > 0 && payHeld && payCooldown <= 0) {
    player.coins--;
    near.paid++;
    payCooldown = CFG.payInterval;
    flyingCoin(player.x, near.x());
    Audio.pay();
    if (near.paid >= near.cost()) {
      near.paid = 0;
      near.onPaid();
    }
  }
}
function flyingCoin(fromX, toX) {
  particles.push({ x: fromX, y: groundY - 60, vx: 0, vy: 0, life: 0.32, color: "#f2c14e", size: 3, toX, fromX, fromY: groundY - 60, toY: groundY - 50, t: 0, fly: true });
}

/* ----------  Vagrants migrate to base, wait to be recruited  ------ */
function updateVagrants(dt) {
  for (let i = vagrants.length - 1; i >= 0; i--) {
    const v = vagrants[i];

    // check if vagrant should pick up an unclaimed bow nearby
    if (!v.bowTarget) {
      let bestBow = null, bestD = 9999;
      for (const b of groundBows) {
        if (b.claimed) continue;
        const d = dist(v.x, b.x);
        if (d < bestD) { bestD = d; bestBow = b; }
      }
      if (bestBow) { bestBow.claimed = true; v.bowTarget = bestBow; }
    }

    if (v.bowTarget) {
      // run toward bow
      const bx = v.bowTarget.x;
      if (dist(v.x, bx) > 6) {
        v.vx = Math.sign(bx - v.x) * 58; v.x += v.vx * dt; v.anim += dt * 4;
      } else {
        // arrived — transform into archer
        const idx = groundBows.indexOf(v.bowTarget);
        if (idx !== -1) groundBows.splice(idx, 1);
        const u = makeUnit("archer", v.x);
        u.hp = u.maxHp = 6;
        u.transform = 0.55; // glow burst timer
        u.dir = v.vx >= 0 ? 1 : -1;
        units.push(u);
        vagrants.splice(i, 1);
        floaty(v.x, "🏹 Bueskytte!");
        spawnParticles(v.x, groundY - 30, 14, "#9bd05a");
        Audio.upgrade();
      }
      continue;
    }

    // normal wandering toward base
    const target = v.targetX;
    if (dist(v.x, target) > 6) { v.vx = Math.sign(target - v.x) * 38; v.x += v.vx * dt; v.anim += dt * 4; }
    else v.vx = 0;
  }
  // recruit: stand next to a vagrant and hold the pay key
  if (player.coins > 0 && (keys["arrowdown"] || keys["s"])) {
    for (let i = 0; i < vagrants.length; i++) {
      const v = vagrants[i];
      if (v.bowTarget) continue; // busy fetching a bow
      if (dist(player.x, v.x) < 46 && Math.abs(v.vx) < 1) {
        if (payCooldown <= 0) {
          player.coins--; payCooldown = CFG.payInterval; flyingCoin(player.x, v.x); Audio.recruit();
          units.push(makeUnit("peasant", v.x));
          vagrants.splice(i, 1);
          floaty(v.x, "🙋 Undersåt!");
          spawnParticles(v.x, groundY - 30, 8, "#cdbfa3");
        }
        break;
      }
    }
  }
}

/* ----------  Assign free peasants to roles  ----------------------- */
function updateAssignments() {
  if (state_pendingHammers > 0) {
    const p = freePeasant();
    if (p) { p.role = "builder"; p.hp = p.maxHp = 5; state_pendingHammers--; floaty(p.x, "🔨"); }
  }
  if (state_pendingFarmers > 0) {
    const p = freePeasant();
    if (p) { p.role = "farmer"; p.workTimer = 0; state_pendingFarmers--; floaty(p.x, "🌾"); }
  }
}
function freePeasant() { return units.find(u => u.role === "peasant"); }

/* ----------  Units AI (archer / builder / farmer / peasant)  ------ */
function updateUnits(dt) {
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
    const px0 = u.x;
    u.cooldown -= dt;
    if (u.panic > 0) u.panic -= dt;
    if (u.hp <= 0) { spawnParticles(u.x, groundY - 30, 8, "#7a1f1f"); units.splice(i, 1); continue; }

    if (u.transform > 0) { u.transform -= dt; if (u.transform < 0) u.transform = 0; }
    if (u.role === "archer") archerAI(u, dt);
    else if (u.role === "builder") builderAI(u, dt);
    else if (u.role === "farmer") farmerAI(u, dt);
    else peasantAI(u, dt);

    u.moving = Math.abs(u.x - px0) > 0.04;   // only animate the gait when walking
    if (u.moving) u.anim += dt * 8;
  }
}

function moveToward(u, tx, speed, dt) {
  if (dist(u.x, tx) > 4) { u.dir = Math.sign(tx - u.x); u.x += u.dir * speed * dt; return false; }
  return true;
}

function peasantAI(u, dt) {
  // mill about near base
  if (dist(u.x, u.targetX) < 6 || Math.random() < 0.005) u.targetX = CFG.baseX + rand(-260, 260);
  moveToward(u, u.targetX, 30, dt);
}

function nearestEnemy(x, range) {
  let best = null, bd = range;
  for (const e of enemies) {
    if (e.fleeing) continue;
    const d = dist(x, e.x);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function standingWalls() { return walls.filter(w => w.commissioned && w.hp > 0); }

function archerAI(u, dt) {
  if (Game.isNight) {
    // defend: march to the FRONT (outermost standing) wall on the threatened
    // side so the horde comes within range, then loose arrows.
    const threat = nearestEnemy(u.x, 99999);
    let post, wall = null;
    if (threat) {
      const side = threat.x < CFG.baseX ? -1 : 1;
      for (const w of walls) {
        if (!w.commissioned || w.hp <= 0 || w.side !== side) continue;
        if (!wall || dist(w.x, CFG.baseX) > dist(wall.x, CFG.baseX)) wall = w; // outermost
      }
      post = wall ? wall.x : CFG.baseX + side * 110;
    } else { post = u.x; }
    u.wall = wall;
    moveToward(u, post, 84, dt);
    const tgt = nearestEnemy(u.x, 440);
    if (tgt && u.cooldown <= 0) {
      shootArrow(u.x, groundY - (u.wall ? wallHeight(u.wall) + 16 : 40), tgt);
      u.cooldown = 0.8; u.dir = Math.sign(tgt.x - u.x) || u.dir;
    }
  } else {
    // day: attack nearby enemies first (location enemies), then hunt animals
    const dayFoe = nearestEnemy(u.x, 420);
    if (dayFoe) {
      if (dist(u.x, dayFoe.x) > 260) moveToward(u, dayFoe.x, 58, dt);
      else if (u.cooldown <= 0) { shootArrow(u.x, groundY - 36, dayFoe); u.cooldown = 1.1; u.dir = Math.sign(dayFoe.x - u.x) || u.dir; }
    } else {
      let prey = null, pd = 520;
      for (const a of animals) { if (!a.alive) continue; const d = dist(u.x, a.x); if (d < pd) { pd = d; prey = a; } }
      if (prey) {
        if (dist(u.x, prey.x) > 260) moveToward(u, prey.x, 55, dt);
        else if (u.cooldown <= 0) { shootArrow(u.x, groundY - 36, prey); u.cooldown = 1.3; u.dir = Math.sign(prey.x - u.x) || u.dir; }
      } else {
        if (dist(u.x, u.targetX) < 8 || Math.random() < 0.004) u.targetX = CFG.baseX + rand(-360, 360);
        moveToward(u, u.targetX, 34, dt);
      }
    }
  }
}

function builderAI(u, dt) {
  // find a wall that needs work (build or repair)
  let target = null, td = 1e9;
  for (const w of walls) {
    if (!w.commissioned) continue;
    const needs = w.buildProgress < 1 || w.hp < w.maxHp;
    if (!needs) continue;
    const d = dist(u.x, w.x);
    if (d < td) { td = d; target = w; }
  }
  // at night, flee to base if dangerous (enemy near the target wall)
  if (Game.isNight && target) {
    const threat = nearestEnemy(target.x, 220);
    if (threat) { u.panic = 0.6; }
  }
  if (u.panic > 0) { moveToward(u, CFG.baseX, 70, dt); return; }

  if (!target) { // idle
    if (dist(u.x, u.targetX) < 8 || Math.random() < 0.004) u.targetX = CFG.baseX + rand(-160, 160);
    moveToward(u, u.targetX, 30, dt);
    return;
  }
  if (moveToward(u, target.x, 48, dt)) {
    // hammering
    u.workTimer += dt;
    if (u.workTimer > 0.25) {
      u.workTimer = 0;
      if (target.buildProgress < 1) {
        target.buildProgress = clamp(target.buildProgress + 0.06, 0, 1);
        target.hp = target.maxHp * target.buildProgress;
        spawnParticles(target.x + rand(-8, 8), groundY - 20, 2, "#caa46a", 20, 30);
        Audio.build();
      } else if (target.hp < target.maxHp) {
        target.hp = clamp(target.hp + target.maxHp * 0.04, 0, target.maxHp);
        spawnParticles(target.x, groundY - 30, 1, "#caa46a", 15, 25);
      }
    }
  }
}

function farmerAI(u, dt) {
  const fx = STATIONS_X.farm;
  if (moveToward(u, fx, 36, dt)) {
    u.workTimer += dt;
    if (u.workTimer > (Game.isNight ? 99 : 5)) { // produce gold by day
      u.workTimer = 0;
      spawnCoin(CFG.baseX + rand(-40, 40), 1, -20);
      spawnParticles(fx, groundY - 20, 4, "#9bd05a", 20, 30);
    }
  }
}

/* ----------  Animals (hunting income)  ---------------------------- */
function updateAnimals(dt) {
  for (let i = animals.length - 1; i >= 0; i--) {
    const a = animals[i];
    if (!a.alive) { animals.splice(i, 1); continue; }
    a.anim += dt * 6;
    if (a.flee > 0) { a.flee -= dt; a.x += a.vx * 3 * dt; }
    else {
      a.x += a.vx * dt;
      if (Math.random() < 0.01) a.vx = rand(15, 40) * pick([-1, 1]);
    }
    a.x = clamp(a.x, 800, CFG.worldWidth - 800);
  }
}

/* ----------  Arrows  --------------------------------------------- */
function shootArrow(x, y, target) {
  const tx = target.x, ty = groundY - 24;
  const ang = Math.atan2(ty - y, tx - x);
  const sp = 560;
  arrows.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, target, life: 1.2, hitKind: ("hp" in target && "maxHp" in target && target.type) ? "enemy" : (target.alive !== undefined ? "animal" : "enemy") });
  Audio.bow();
}
function updateArrows(dt) {
  for (let i = arrows.length - 1; i >= 0; i--) {
    const ar = arrows[i];
    ar.x += ar.vx * dt; ar.y += ar.vy * dt; ar.vy += 420 * dt; ar.life -= dt;
    let hit = false;
    // enemy hit
    for (const e of enemies) {
      if (e.fleeing) continue;
      if (dist(ar.x, e.x) < ENEMY_TYPES[e.type].w * 0.7 && ar.y > groundY - 44) {
        e.hp--; e.flash = 0.12; Audio.hit(); spawnParticles(e.x, groundY - 24, 4, "#8a2a4a"); hit = true;
        if (e.hp <= 0) killEnemy(e);
        break;
      }
    }
    // animal hit
    if (!hit) {
      for (const a of animals) {
        if (a.alive && dist(ar.x, a.x) < 16 && ar.y > groundY - 36) {
          a.alive = false; spawnParticles(a.x, groundY - 20, 8, "#7a4a2a");
          const reward = a.type === "deer" ? 3 : 1;
          for (let k = 0; k < reward; k++) spawnCoin(a.x + rand(-15, 15), 1, -30, rand(-40, 40));
          floaty(a.x, "+" + reward + "🪙", "#f2c14e");
          hit = true; break;
        }
      }
    }
    if (hit || ar.life <= 0 || ar.y > groundY - 6) arrows.splice(i, 1);
  }
}
function killEnemy(e) {
  const t = ENEMY_TYPES[e.type];
  for (let k = 0; k < t.reward; k++) spawnCoin(e.x + rand(-18, 18), 1, -40, rand(-60, 60));
  spawnParticles(e.x, groundY - 24, 12, t.color === "#1f1830" ? "#ff2a6a" : "#6a2a4a", 80, 100);
  Audio.enemyDie();
  if (e.locIdx !== undefined && locations[e.locIdx]) {
    const loc = locations[e.locIdx];
    loc.remainingEnemies--;
    if (loc.remainingEnemies <= 0 && !loc.lootSpawned) { loc.cleared = true; spawnLocLoot(loc); }
  }
  const idx = enemies.indexOf(e); if (idx >= 0) enemies.splice(idx, 1);
}

/* ----------  Enemies AI  ----------------------------------------- */
function wallAt(side, x) {
  // first standing wall between x and base on the given side
  let best = null;
  for (const w of walls) {
    if (!w.commissioned || w.hp <= 0 || w.side !== side) continue;
    if (side < 0 && w.x > x && w.x < CFG.baseX) { if (!best || w.x < best.x) best = w; }
    if (side > 0 && w.x < x && w.x > CFG.baseX) { if (!best || w.x > best.x) best = w; }
  }
  return best;
}
function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const t = ENEMY_TYPES[e.type];
    if (e.home !== undefined) { updateLocEnemy(e, t, dt); continue; }
    e.anim += dt * 5;
    if (e.flash > 0) e.flash -= dt;
    e.attackCd -= dt;

    if (e.fleeing) {
      const tx = e.portal ? e.portal.x : (e.x < CFG.baseX ? 0 : CFG.worldWidth);
      e.dir = Math.sign(tx - e.x);
      e.x += e.dir * t.speed * 1.6 * dt;
      if (dist(e.x, tx) < 40) enemies.splice(i, 1);
      continue;
    }

    const side = e.x < CFG.baseX ? -1 : 1;
    const wall = wallAt(side, e.x);
    if (wall && dist(e.x, wall.x) < 30) {
      // attack the wall
      e.dir = Math.sign(wall.x - e.x) || e.dir;
      if (e.attackCd <= 0) {
        e.attackCd = 0.7;
        wall.hp -= t.dmg; wall.flash = 0.15;
        spawnParticles(wall.x, groundY - 30, 3, "#caa46a", 30, 30);
        Audio.hit();
        if (wall.hp <= 0) { wall.hp = 0; wall.level = 0; wall.commissioned = false; wall.buildProgress = 0; floaty(wall.x, "💥 Mur faldet!", "#ff6a4a"); spawnParticles(wall.x, groundY - 30, 16, "#caa46a", 80, 80); }
      }
      continue;
    }

    // attack nearby units
    let unitTgt = null, ud = 28;
    for (const u of units) { const d = dist(e.x, u.x); if (d < ud) { ud = d; unitTgt = u; } }
    if (unitTgt) {
      e.dir = Math.sign(unitTgt.x - e.x) || e.dir;
      if (e.attackCd <= 0) { e.attackCd = 0.8; unitTgt.hp -= 2; unitTgt.panic = 1; spawnParticles(unitTgt.x, groundY - 30, 3, "#7a1f1f"); Audio.hit(); }
      continue;
    }

    // reached base?
    if (dist(e.x, base.x) < 70) {
      e.dir = Math.sign(base.x - e.x) || e.dir;
      if (e.attackCd <= 0) {
        e.attackCd = 0.9;
        base.hp -= t.dmg; base.flash = 0.2;
        spawnParticles(base.x + rand(-30, 30), groundY - 30, 4, "#ff6a4a");
        Audio.hit();
        // steal a loose coin near base if any
        const c = coins.find(cc => cc.settled && dist(cc.x, base.x) < 120);
        if (c) { e.carry++; coins.splice(coins.indexOf(c), 1); e.fleeing = true; }
      }
      continue;
    }

    // reach the player: deal damage + knock the horse back (player has HP now)
    if (dist(e.x, player.x) < 30 && e.attackCd <= 0) {
      if (player.invuln <= 0 && !DEV.godMode) {
        const dmg = e.type === "boss" ? 3 : e.type === "brute" ? 2 : 1;
        player.hp -= dmg; player.invuln = CFG.playerInvuln; player.hurt = 0.35;
        player.knock = (player.x < e.x ? -1 : 1) * 230;
        spawnParticles(player.x, groundY - 50, 7, "#c1453b");
        if (player.coins > 0) { player.coins--; e.carry++; floaty(player.x, "−1🪙", "#ff6a4a"); }
        else floaty(player.x, "−" + dmg + "❤", "#ff6a4a");
        Audio.hit();
      }
      e.fleeing = true; e.attackCd = 1;  // bounce off and retreat — no chain-kills
      continue;
    }

    // advance toward base
    e.dir = Math.sign(base.x - e.x) || e.dir;
    e.x += e.dir * t.speed * dt;
  }
}

/* ----------  Coins  ---------------------------------------------- */
function updateCoins(dt) {
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    if (!c.settled) {
      c.vy += 520 * dt;
      c.y += c.vy * dt;
      c.x += (c.vx || 0) * dt;
      if (c.y >= groundY) { c.y = groundY; c.vy = 0; c.vx = 0; c.settled = true; }
    }
    // magnet to player when close
    const d = dist(c.x, player.x);
    if (c.settled && d < 90 && player.coins < CFG.maxCoinsCarry) {
      c.x += Math.sign(player.x - c.x) * 320 * dt;
      if (d < 22) {
        player.coins = clamp(player.coins + c.value, 0, CFG.maxCoinsCarry);
        coins.splice(i, 1);
        Audio.coin();
        spawnParticles(player.x, groundY - 50, 3, "#f2c14e", 30, 40);
        continue;
      }
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.fly) {
      p.t += dt / p.life;
      p.x = lerp(p.fromX, p.toX, clamp(p.t, 0, 1));
      p.y = lerp(p.fromY, p.toY, clamp(p.t, 0, 1)) - Math.sin(clamp(p.t, 0, 1) * Math.PI) * 50;
      if (p.t >= 1) particles.splice(i, 1);
      continue;
    }
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 240 * dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}
function updateFloats(dt) {
  for (let i = floatTexts.length - 1; i >= 0; i--) {
    const f = floatTexts[i];
    f.life -= dt; f.y += f.vy * dt; f.vy *= 0.96;
    if (f.life <= 0) floatTexts.splice(i, 1);
  }
}

/* ----------  Spawning loop  -------------------------------------- */
function updateSpawning(dt) {
  // vagrants by day
  vagrantTimer -= dt;
  if (vagrantTimer <= 0) { vagrantTimer = rand(10, 18); if (!Game.isNight) spawnVagrant(); }
  animalTimer -= dt;
  if (animalTimer <= 0) { animalTimer = rand(8, 14); if (!Game.isNight) spawnAnimal(); }

  // enemies at night
  if (Game.isNight && Game.nightSpawned < Game.nightQuota) {
    Game.spawnTimer -= dt;
    if (Game.spawnTimer <= 0) {
      Game.spawnTimer = rand(0.6, 1.6);
      const type = nightEnemyType();
      spawnEnemy(type, pick(portals));
      Game.nightSpawned++;
    }
  }
}

function updateLocations(dt) {
  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    if (loc.triggered) continue;
    if (dist(player.x, loc.x) < LOC_DEFS[loc.type].trig) triggerLocation(loc, i);
  }
}

function updateLootItems(dt) {
  for (let i = lootItems.length - 1; i >= 0; i--) {
    const it = lootItems[i];
    if (dist(it.x, player.x) < 34) { pickupWeapon(it.weaponId); lootItems.splice(i, 1); }
  }
}

function updatePlayerAttack(dt) {
  if (!player.weapon) return;
  if (player.swing > 0) player.swing -= dt;
  player.attackCd -= dt;
  if (player.attackCd > 0) return;
  const w = WEAPONS[player.weapon];
  const tgt = nearestEnemy(player.x, w.range);
  if (!tgt) return;
  player.dir = Math.sign(tgt.x - player.x) || player.dir;
  player.swing = 0.32;
  if (w.type === "melee") {
    tgt.hp -= w.dmg; tgt.flash = 0.14; Audio.hit();
    spawnParticles(tgt.x, groundY - 28, 4, w.col);
    if (tgt.hp <= 0) killEnemy(tgt);
  } else {
    shootArrow(player.x, groundY - 72, tgt);
  }
  player.attackCd = w.speed;
}

function updateLocEnemy(e, t, dt) {
  e.anim += dt * 5;
  if (e.flash > 0) e.flash -= dt;
  e.attackCd -= dt;
  const dp = dist(e.x, player.x);
  if (dp < 300) {
    const dir = Math.sign(player.x - e.x);
    e.dir = dir || e.dir;
    e.x += dir * t.speed * dt;
    if (dp < 32 && e.attackCd <= 0) {
      e.attackCd = 1.0;
      if (player.invuln <= 0 && !DEV.godMode) {
        const dmg = e.type==="boss"?3:e.type==="brute"?2:1;
        player.hp -= dmg; player.invuln = CFG.playerInvuln; player.hurt = 0.35;
        player.knock = (player.x < e.x ? -1 : 1) * 220;
        spawnParticles(player.x, groundY-50, 6, "#c1453b");
        if (player.coins > 0) { player.coins--; floaty(player.x,"−1🪙","#ff6a4a"); }
        else floaty(player.x,"−"+dmg+"❤","#ff6a4a");
        Audio.hit();
      }
    }
  } else if (dist(e.x, e.home) > 50) {
    const dir = Math.sign(e.home - e.x);
    e.dir = dir || e.dir;
    e.x += dir * t.speed * 0.45 * dt;
  }
}

function updateCamera() {
  const target = clamp(player.x - W / 2, 0, Math.max(0, CFG.worldWidth - W));
  Game.cam += (target - Game.cam) * 0.12;
}

function checkEndConditions() {
  if (base.hp <= 0) { endGame(false, "Dit slot blev jævnet med jorden. Mørket sluger riget."); return; }
  if (player.hp <= 0) { endGame(false, "Monarken faldt i kamp, og kronen rullede i mulden. Riget er fortabt."); return; }
  // win: survived a full night after the castle was completed
  if (Game.pendingWin) {
    endGame(true, "Dit slot står, og horderne er drevet tilbage. Riget er sikret — længe leve monarken!");
    return;
  }
}

function updateAutosave(dt) {
  Game.autosaveTimer -= dt;
  if (Game.autosaveTimer <= 0) { Game.autosaveTimer = 5; saveGame(); }
}

function wallHeight(w) { return w.level === 2 ? 64 : 42; }

/* ================================================================== */
/*  RENDER + ATMOSPHERE                                                */
/* ================================================================== */

/* ----------  colour helpers  ---------- */
const withA = (c, a) => `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
const shade = (c, f) => [clamp(c[0]*f,0,255), clamp(c[1]*f,0,255), clamp(c[2]*f,0,255)];
const hazeColor = (dark) => lerpColor([178, 198, 222], [22, 24, 48], dark);
const atmo = (c, haze, depth) => lerpColor(c, haze, clamp(depth, 0, 1) * 0.85);

/* ----------  BIOMES (req #15) — palette varies across the world  ---------- */
const BIOME_DEFS = [
  { c: 300,  name:"snow",   treeL:[206,219,235], treeD:[120,142,178], gT:[214,224,238], gB:[168,184,208], fog:[214,226,240], sky:[150,176,206], leaf:"#e7f0fb", deco:"snow",   snow:1, moss:0 },
  { c: 2050, name:"autumn", treeL:[200,124,52],  treeD:[112,58,32],   gT:[126,98,56],   gB:[80,60,38],    fog:[206,176,142], sky:[206,164,122], leaf:"#d9883c", deco:"autumn", snow:0, moss:0 },
  { c: 3800, name:"pine",   treeL:[86,128,78],   treeD:[32,58,42],    gT:[78,108,60],   gB:[42,66,42],    fog:[156,184,172], sky:[120,186,214], leaf:"#9bd05a", deco:"meadow", snow:0, moss:0 },
  { c: 5600, name:"dark",   treeL:[46,82,74],    treeD:[16,32,34],    gT:[40,60,50],    gB:[20,32,30],    fog:[78,108,108],  sky:[92,124,134],  leaf:"#3a7a5a", deco:"dark",   snow:0, moss:1 },
  { c: 7300, name:"swamp",  treeL:[92,100,58],   treeD:[40,46,30],    gT:[66,72,44],    gB:[36,42,28],    fog:[118,128,96],  sky:[122,132,108], leaf:"#8a9a4a", deco:"swamp",  snow:0, moss:1 },
];
function biomeAt(x) {
  const d = BIOME_DEFS;
  if (x <= d[0].c) return d[0];
  if (x >= d[d.length-1].c) return d[d.length-1];
  let i = 0; while (i < d.length-1 && !(x >= d[i].c && x <= d[i+1].c)) i++;
  const a = d[i], b = d[i+1], t = (x - a.c) / (b.c - a.c), near = t < 0.5 ? a : b;
  return {
    treeL: lerpColor(a.treeL,b.treeL,t), treeD: lerpColor(a.treeD,b.treeD,t),
    gT: lerpColor(a.gT,b.gT,t), gB: lerpColor(a.gB,b.gB,t),
    fog: lerpColor(a.fog,b.fog,t), sky: lerpColor(a.sky,b.sky,t),
    leaf: near.leaf, deco: near.deco, snow: near.snow, moss: near.moss,
  };
}

/* ----------  SKY / time of day (req #3, #12)  ---------- */
const SKY = {
  day:   [[120, 186, 214], [186, 216, 226]],
  dusk:  [[224, 128, 86], [86, 70, 116]],
  night: [[16, 15, 36], [34, 26, 56]],
  dawn:  [[126, 116, 156], [232, 174, 132]],
};
function skyColors() {
  const t = Game.time;
  const stops = [
    [0.00, SKY.day], [0.46, SKY.day], [0.58, SKY.dusk],
    [0.68, SKY.night], [0.90, SKY.night], [0.95, SKY.dawn], [1.0, SKY.day],
  ];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) { if (t >= stops[i][0] && t <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; } }
  const k = (t - a[0]) / Math.max(0.0001, (b[0] - a[0]));
  let top = lerpColor(a[1][0], b[1][0], k), bot = lerpColor(a[1][1], b[1][1], k);
  // tint toward the local biome's sky during daylight
  const bi = biomeAt(Game.cam + W / 2), w = 0.32 * (1 - darkness());
  top = lerpColor(top, bi.sky, w);
  bot = lerpColor(bot, shade(bi.sky, 1.12), w * 0.7);
  return [top, bot];
}
function darkness() {
  const t = Game.time;
  if (t <= 0.5) return 0;
  if (t <= 0.7) return (t - 0.5) / 0.2;
  if (t <= 0.9) return 1;
  if (t <= 0.96) return 1 - (t - 0.9) / 0.06;
  return 0;
}

/* ----------  WIND (req #14) — variable gusts drive sway everywhere  ---------- */
function windGust() { return Math.sin(Game.windT*0.5)*6 + Math.sin(Game.windT*1.3)*3 + Math.sin(Game.windT*0.21)*5; }
function windSway(phase, amp) {
  return (Math.sin(Game.windT*1.1 + phase)*0.7 + Math.sin(Game.windT*0.37 + phase)*0.3)
       * amp * (0.55 + 0.55*Math.abs(Math.sin(Game.windT*0.2 + phase*0.3)));
}

/* ----------  ATMOSPHERE / FX STATE (req #6, #8, #10)  ---------- */
let FX = null;
function initFX() {
  const R = Math.random;
  FX = {
    stars:  Array.from({length:180}, () => ({ x:R()*W, y:R()*groundY*0.82, s:R()*1.7+0.3, tw:R()*6 })),
    clouds: Array.from({length:7},   () => ({ x:R()*W, y:24+R()*groundY*0.42, s:0.6+R()*1.0, sp:5+R()*9, o:0.4+R()*0.4 })),
    birds:  Array.from({length:6},   () => ({ x:R()*W, y:55+R()*180, sp:16+R()*24, ph:R()*6, dir:R()<0.5?1:-1, scale:0.7+R()*0.6 })),
    butter: Array.from({length:10},  () => ({ x:R()*W, y:groundY-R()*120, ph:R()*6, c:["#f2c14e","#ece4d2","#d9883c","#cfe6f2","#e58fb0"][(R()*5)|0] })),
    flies:  Array.from({length:50},  () => ({ x:R()*W, y:groundY-R()*150, ph:R()*6 })),
    dust:   Array.from({length:64},  () => ({ x:R()*W, y:R()*H, z:0.3+R()*0.7, ph:R()*6 })),
    fall:   Array.from({length:54},  () => ({ x:R()*W, y:R()*H, sp:18+R()*44, sway:2+R()*6, ph:R()*6, rot:R()*6, active:false, snow:false, color:"#9bd05a" })),
    embers: [], smoke: [], flicker: 1,
  };
}
function updateFX(dt) {
  if (!FX) initFX();
  Game.windT += dt;
  const wind = windGust();
  FX.flicker = 0.74 + 0.24*Math.sin(Game.windT*9) + 0.12*Math.sin(Game.windT*23.3) + (Math.random()-0.5)*0.07;

  for (const c of FX.clouds) { c.x += (c.sp*0.18 + wind*0.35)*dt; if (c.x > W+180) c.x = -180; if (c.x < -180) c.x = W+180; }
  for (const b of FX.birds)  { b.x += b.sp*b.dir*dt; b.ph += dt*6; if (b.x > W+50) b.x = -50; if (b.x < -50) b.x = W+50; }
  for (const bf of FX.butter){ bf.ph += dt; bf.x += Math.sin(bf.ph*1.3)*22*dt + wind*0.25*dt; bf.y += Math.cos(bf.ph*1.7)*16*dt; bf.y = clamp(bf.y, groundY-150, groundY-10); if (bf.x<-20) bf.x=W+20; if (bf.x>W+20) bf.x=-20; }
  for (const f of FX.flies)  { f.ph += dt; f.x += Math.sin(f.ph)*11*dt; f.y += Math.cos(f.ph*1.3)*9*dt; f.y = clamp(f.y, groundY-165, groundY-6); if (f.x<0) f.x=W; if (f.x>W) f.x=0; }
  for (const d of FX.dust)   { d.ph += dt; d.x += (wind*d.z*0.7 + Math.sin(d.ph)*4)*dt; d.y += Math.cos(d.ph*0.7)*3*dt - 2*d.z*dt; if (d.y<0) d.y=H; if (d.y>H) d.y=0; if (d.x<0) d.x=W; if (d.x>W) d.x=0; }

  // falling leaves / snow, depending on the biome you're standing in (req #6)
  const cb = biomeAt(Game.cam + W/2), falling = cb.deco === "autumn" || cb.snow;
  for (const p of FX.fall) {
    if (!p.active) { if (falling && Math.random() < 0.025) { p.active=true; p.x=Math.random()*W; p.y=-12; p.snow=!!cb.snow; p.color=cb.snow?"#eef4fb":cb.leaf; } continue; }
    p.ph += dt; p.rot += dt*2.4; p.y += p.sp*dt*(p.snow?0.5:1); p.x += (Math.sin(p.ph*2)*p.sway + wind*1.3)*dt;
    if (p.y > H+12) p.active = false;
  }

  // campfire embers + smoke (req #8), anchored at the base
  if (typeof base !== "undefined" && base) {
    if (Math.random() < 0.7) FX.embers.push({ x: base.x+rand(-7,7), y: groundY-12, vx: rand(-9,9), vy: -rand(30,64), life: rand(0.7,1.7), t: 0, s: rand(1,2.4) });
    if (Math.random() < 0.3) FX.smoke.push({ x: base.x+rand(-5,5), y: groundY-28, vy: -rand(13,24), r: rand(5,9), life: rand(1.6,3), t: 0 });
  }
  for (let i=FX.embers.length-1;i>=0;i--){ const e=FX.embers[i]; e.t+=dt; e.x+=(e.vx+wind*0.5)*dt; e.y+=e.vy*dt; e.vy*=0.99; if (e.t>e.life) FX.embers.splice(i,1); }
  for (let i=FX.smoke.length-1;i>=0;i--){ const s=FX.smoke[i]; s.t+=dt; s.x+=(wind*0.9)*dt; s.y+=s.vy*dt; s.r+=8*dt; if (s.t>s.life) FX.smoke.splice(i,1); }
  if (FX.embers.length>140) FX.embers.splice(0, FX.embers.length-140);
  if (FX.smoke.length>70)  FX.smoke.splice(0, FX.smoke.length-70);
}

/* ----------  GROUND DECORATION (req #5) — grass, stones, flowers, stumps  ---------- */
let decoCache = null;
function getDeco() {
  if (decoCache && decoCache.seed === Game.treeSeed) return decoCache;
  const r = mulberry32((Game.treeSeed||1)*7 + 13);
  const items = [];
  for (let x = 60; x < CFG.worldWidth-60; x += 22 + r()*40) {
    const b = biomeAt(x), t = r();
    let kind;
    if (b.snow)               kind = t<0.68?"snowtuft":(t<0.86?"stone":"stump");
    else if (b.deco==="autumn") kind = t<0.42?"grass":(t<0.66?"leafpile":(t<0.82?"stone":(t<0.92?"flower":"stump")));
    else if (b.deco==="swamp")  kind = t<0.48?"reed":(t<0.74?"grass":(t<0.9?"mushroom":"stone"));
    else if (b.deco==="dark")   kind = t<0.52?"grass":(t<0.78?"fern":(t<0.91?"mushroom":"stone"));
    else                        kind = t<0.48?"grass":(t<0.7?"flower":(t<0.84?"stone":(t<0.94?"grass":"stump")));
    items.push({ x, kind, s: 0.7+r()*0.8, ph: r()*6, leaf: b.leaf, flower: ["#e58fb0","#f2c14e","#cfe6f2","#e87b5a"][(r()*4)|0] });
  }
  decoCache = { seed: Game.treeSeed, items };
  return decoCache;
}

/* ----------  soft contact shadow (req #11)  ---------- */
function groundShadow(x, w, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = "#0a0810";
  ctx.beginPath(); ctx.ellipse(x, groundY+2, w, w*0.26, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

/* ----------  TREES (req #1, #2) — 8 shapes, biome-driven, swaying  ---------- */
function pickType(b, r) {
  const t = r();
  if (b.snow)                 return t<0.5 ? "fir"  : t<0.8 ? "pine"    : t<0.92 ? "dead"  : "birch";
  if (b.deco === "autumn")    return t<0.4 ? "oak"  : t<0.66? "birch"   : t<0.85 ? "crooked": t<0.93? "bush" : "dead";
  if (b.deco === "dark")      return t<0.45? "fir"  : t<0.72? "pine"    : t<0.88 ? "crooked": "dead";
  if (b.deco === "swamp")     return t<0.4 ? "dead" : t<0.66? "crooked" : t<0.84 ? "oak"    : "bush";
  return                              t<0.4 ? "pine" : t<0.66? "fir"     : t<0.82 ? "oak"    : t<0.92? "widepine" : "birch";
}
function makeTree(x, baseH, r) {
  const b = biomeAt(x), type = pickType(b, r);
  const h = baseH * (0.7 + r()*0.7);
  const w = (type==="widepine"? h*0.72 : (type==="oak"||type==="bush")? h*0.85 : type==="dead"? h*0.42 : h*0.5) * (0.82 + r()*0.4);
  const tiers = 3 + ((r()*4)|0);
  const lean = (r()-0.5) * (type==="crooked"? 0.5 : 0.16);
  let clusters = null, branches = null;
  if (type==="oak"||type==="bush"||type==="crooked"||type==="birch") {
    clusters = [];
    const n = type==="bush"?4 : type==="birch"?3 : 6+((r()*3)|0);
    const cy = type==="bush"?0.46 : type==="birch"?0.85 : 0.76;
    for (let i=0;i<n;i++) clusters.push({ dx:(r()-0.5)*w*0.9, dy: cy - r()*0.36, r:(0.28+r()*0.22)*w });
  }
  if (type==="dead") {
    branches = [];
    const n = 3 + ((r()*4)|0);
    for (let i=0;i<n;i++) branches.push({ hf:0.38+r()*0.56, side:r()<0.5?-1:1, len:(0.18+r()*0.22)*h, up:0.3+r()*0.5, broken:r()<0.3 });
  }
  return { x, type, h, w, phase:r()*6, tiers, lean, broken:r()<0.2, snow: b.snow && r()<0.85, moss: b.moss && r()<0.6, clusters, branches };
}
function drawTree(t, cx, baseY, light, dark, depthDark, swayAmp) {
  const H = t.h, Wd = t.w, lean = t.lean;
  const sw = (hf) => windSway(t.phase, swayAmp)*Math.pow(clamp(hf,0,1),1.35) + lean*hf*Wd*0.7;
  const trunkCol = shade(dark, 0.68);
  if (depthDark < 0.5) groundShadow(cx, Wd*0.5*(1.15-depthDark), 0.16*(1-depthDark));

  if (t.type==="pine" || t.type==="fir" || t.type==="widepine") {
    ctx.fillStyle = withA(trunkCol,1);
    ctx.fillRect(cx-Wd*0.05, baseY-H*0.16, Wd*0.1, H*0.16);
    for (let i=0;i<t.tiers;i++) {
      const bhf=i/t.tiers, thf=(i+1)/t.tiers;
      const tw=Wd*(1-bhf*0.78)*0.5, by=baseY-bhf*H-H*0.05, ty=baseY-thf*H;
      const bx=cx+sw(bhf), tx=cx+sw(thf);
      ctx.fillStyle=withA(dark,1);
      ctx.beginPath(); ctx.moveTo(bx-tw,by); ctx.lineTo(bx+tw,by); ctx.lineTo(tx,ty); ctx.closePath(); ctx.fill();
      ctx.fillStyle=withA(light,0.5);
      ctx.beginPath(); ctx.moveTo(bx-tw,by); ctx.lineTo(bx-tw*0.16,by); ctx.lineTo(tx,ty); ctx.closePath(); ctx.fill();
      if (t.snow) { ctx.fillStyle="rgba(238,244,251,0.92)"; ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(tx-tw*0.5,by-(by-ty)*0.5); ctx.lineTo(tx+tw*0.5,by-(by-ty)*0.5); ctx.closePath(); ctx.fill(); }
    }
  } else if (t.type==="dead") {
    ctx.strokeStyle=withA(trunkCol,1); ctx.lineCap="round";
    ctx.lineWidth=Math.max(2,Wd*0.14);
    ctx.beginPath(); ctx.moveTo(cx,baseY); ctx.lineTo(cx+sw(1),baseY-H); ctx.stroke();
    for (const br of t.branches) {
      const yy=baseY-br.hf*H, xx=cx+sw(br.hf), ex=xx+br.side*br.len, ey=yy-br.len*br.up;
      ctx.lineWidth=Math.max(1.5,Wd*0.09);
      ctx.beginPath(); ctx.moveTo(xx,yy); ctx.lineTo(ex,ey);
      if (!br.broken) ctx.lineTo(ex+br.side*br.len*0.4, ey-br.len*0.5);
      ctx.stroke();
      if (t.snow) { ctx.strokeStyle="rgba(238,244,251,0.8)"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(xx,yy-2); ctx.lineTo(ex,ey-2); ctx.stroke(); ctx.strokeStyle=withA(trunkCol,1); }
    }
    ctx.lineCap="butt";
  } else {
    // leafy: oak / bush / crooked / birch
    const trunkH = t.type==="bush"? H*0.12 : t.type==="birch"? H*0.6 : H*0.42;
    const tw = Wd*0.09;
    const isBirch = t.type==="birch";
    ctx.strokeStyle=withA(isBirch? lerpColor(light,[232,234,236],0.55) : trunkCol, 1);
    ctx.lineWidth=Math.max(2, tw*2); ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(cx,baseY); ctx.lineTo(cx+sw(trunkH/H), baseY-trunkH); ctx.stroke();
    ctx.lineCap="butt";
    if (isBirch) { ctx.strokeStyle="rgba(40,44,48,0.45)"; ctx.lineWidth=1; for (let k=1;k<4;k++){ const yy=baseY-trunkH*k/4; ctx.beginPath(); ctx.moveTo(cx-tw,yy); ctx.lineTo(cx+tw*0.4,yy); ctx.stroke(); } }
    for (const cl of t.clusters) { const ox=cx+sw(cl.dy)+cl.dx, oy=baseY-cl.dy*H; ctx.fillStyle=withA(dark,1); ctx.beginPath(); ctx.arc(ox,oy,cl.r,0,Math.PI*2); ctx.fill(); }
    for (const cl of t.clusters) { const ox=cx+sw(cl.dy)+cl.dx, oy=baseY-cl.dy*H; ctx.fillStyle=withA(light,0.42); ctx.beginPath(); ctx.arc(ox-cl.r*0.3, oy-cl.r*0.32, cl.r*0.62,0,Math.PI*2); ctx.fill(); }
    if (t.snow) for (const cl of t.clusters) { const ox=cx+sw(cl.dy)+cl.dx, oy=baseY-cl.dy*H; ctx.fillStyle="rgba(238,244,251,0.85)"; ctx.beginPath(); ctx.arc(ox-cl.r*0.18, oy-cl.r*0.46, cl.r*0.5,0,Math.PI*2); ctx.fill(); }
  }
  if (t.broken && t.type!=="dead") { ctx.strokeStyle=withA(trunkCol,1); ctx.lineWidth=Math.max(1.5,Wd*0.07); ctx.beginPath(); ctx.moveTo(cx,baseY-H*0.34); ctx.lineTo(cx+Wd*0.4,baseY-H*0.28); ctx.stroke(); }
  if (t.moss) { ctx.fillStyle="rgba(74,116,84,0.55)"; ctx.beginPath(); ctx.ellipse(cx, baseY-H*0.04, Wd*0.12, H*0.05, 0, 0, Math.PI*2); ctx.fill(); }
}
function drawTreeLayer(trees, factor, depthDark, swayAmp, alpha = 1) {
  const dark = darkness(), haze = hazeColor(dark), off = Game.cam*factor;
  if (alpha < 1) { ctx.save(); ctx.globalAlpha = alpha; }
  for (const t of trees) {
    const px = t.x - off;
    if (px < -140 || px > W+140) continue;
    const b = biomeAt(t.x);
    drawTree(t, px, groundY+4, atmo(b.treeL,haze,depthDark), atmo(b.treeD,haze,depthDark), depthDark, swayAmp);
  }
  if (alpha < 1) ctx.restore();
}
let treeCache = null;
function getTrees() {
  if (treeCache && treeCache.seed === Game.treeSeed) return treeCache;
  const r = mulberry32(Game.treeSeed || 1);
  const far=[], mid=[], near=[], fore=[], hills=[];
  for (let x=-100; x<CFG.worldWidth+100; x+=110) far.push(makeTree(x+r()*80, 72, r));
  for (let x=-100; x<CFG.worldWidth+100; x+=86)  mid.push(makeTree(x+r()*64, 120, r));
  for (let x=-100; x<CFG.worldWidth+100; x+=70)  near.push(makeTree(x+r()*48, 178, r));
  for (let x=-100; x<CFG.worldWidth+100; x+=520) fore.push(makeTree(x+r()*220, 150, r));
  for (let x=-300; x<CFG.worldWidth+300; x+=170) hills.push({ x:x+r()*120, h:50+r()*130, w:200+r()*230 });
  treeCache = { seed: Game.treeSeed, far, mid, near, fore, hills };
  return treeCache;
}

function render() {
  const dark = darkness();
  const [top, bot] = skyColors();
  const g = ctx.createLinearGradient(0, 0, 0, groundY + 80);
  g.addColorStop(0, rgb(top)); g.addColorStop(0.62, rgb(lerpColor(top, bot, 0.6))); g.addColorStop(1, rgb(bot));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  drawAurora(dark);
  drawStars(dark);
  drawCelestial(top);
  drawClouds(dark, top);
  drawBirds(dark);

  const trees = getTrees();
  drawHills(trees.hills, dark);
  drawTreeLayer(trees.far, 0.26, 0.78, 5);     // farthest: light, bluish (req #2, #13)
  drawFogBand(groundY - 150, 110, dark, 0.6);
  drawTreeLayer(trees.mid, 0.46, 0.50, 9);     // mid: darker
  drawGodrays(dark);
  drawTreeLayer(trees.near, 0.70, 0.28, 14);   // near: darker still

  // ground (biome-tinted, req #3, #5)
  const bi = biomeAt(Game.cam + W / 2);
  const gg = ctx.createLinearGradient(0, groundY, 0, H);
  gg.addColorStop(0, rgb(lerpColor(bi.gT, [14, 16, 26], dark)));
  gg.addColorStop(1, rgb(lerpColor(bi.gB, [6, 8, 16], dark)));
  ctx.fillStyle = gg; ctx.fillRect(0, groundY, W, H - groundY);
  ctx.fillStyle = withA(lerpColor(shade(bi.gT, 1.25), [44, 48, 64], dark), 0.55);
  ctx.fillRect(0, groundY, W, 2);

  // world-space
  ctx.save();
  ctx.translate(-Game.cam, 0);
  drawGroundTexture(dark);
  drawGroundDeco(dark, bi);
  drawLocations(dark);
  drawEntityShadows();
  drawPortals(dark);
  drawWalls(dark);
  drawBase(dark);
  drawStations();
  drawCoins();
  drawGroundBows();
  drawLootItems();
  drawAnimals(dark);
  drawVagrants(dark);
  drawUnits(dark);
  drawEnemies(dark);
  drawPlayer(dark);
  drawArrows();
  drawParticles();
  drawCampLight(dark);
  drawFloats();
  ctx.restore();

  // foreground: sparse, short, semi-transparent so it frames without blocking (req #13)
  drawTreeLayer(trees.fore, 1.06, 0.04, 20, 0.45);

  drawLowFog(dark, bi);
  drawAmbientFront(dark, bi);

  const v = ctx.createRadialGradient(W/2, groundY-60, W*0.18, W/2, groundY-60, W*0.82);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, `rgba(4,3,12,${0.22 + 0.42*dark})`);
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);

  drawOffscreenIndicators();
}

/* ----------  sky furniture (req #12)  ---------- */
function drawStars(dark) {
  if (dark < 0.12) return;
  ctx.save();
  for (const s of FX.stars) {
    const tw = 0.5 + 0.5*Math.sin(performance.now()/600 + s.tw);
    ctx.globalAlpha = dark*tw; ctx.fillStyle = "rgba(255,255,238,1)";
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.restore();
}
function drawAurora(dark) {
  if (dark < 0.6) return;
  const a = (dark-0.6)/0.4 * 0.12;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let b = 0; b < 2; b++) {
    const baseY = 64 + b*42; ctx.beginPath();
    for (let x = 0; x <= W; x += 22) { const y = baseY + Math.sin(x*0.01 + Game.windT*0.3 + b)*22 + Math.sin(x*0.03 + Game.windT*0.5)*10; x===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y); }
    for (let x = W; x >= 0; x -= 22) ctx.lineTo(x, baseY + 64 + Math.sin(x*0.01 + Game.windT*0.3 + b)*22);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, baseY, 0, baseY+72);
    grad.addColorStop(0, `rgba(80,255,170,${a})`); grad.addColorStop(1, "rgba(80,180,255,0)");
    ctx.fillStyle = grad; ctx.fill();
  }
  ctx.restore();
}
let lastSun = { cx: 0, cy: 120, isMoon: false };
function drawCelestial(skyTop) {
  const t = Game.time;
  const isMoon = t > 0.6 && t < 0.95;
  let frac = isMoon ? (t-0.6)/0.35 : (t < 0.6 ? t/0.6 : (t-0.95)/0.05);
  frac = clamp(frac, 0, 1);
  const cx = lerp(W*0.12, W*0.88, frac), cy = groundY - 70 - Math.sin(frac*Math.PI)*(groundY*0.58);
  lastSun = { cx, cy, isMoon };
  ctx.save();
  if (isMoon) {
    const gl = ctx.createRadialGradient(cx, cy, 4, cx, cy, 84);
    gl.addColorStop(0, "rgba(210,224,255,0.4)"); gl.addColorStop(1, "rgba(210,224,255,0)");
    ctx.fillStyle = gl; ctx.fillRect(cx-90, cy-90, 180, 180);
    ctx.fillStyle = "rgba(238,240,228,0.97)"; ctx.beginPath(); ctx.arc(cx, cy, 24, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "rgba(206,214,204,0.5)";
    ctx.beginPath(); ctx.arc(cx-6, cy+5, 5, 0, Math.PI*2); ctx.arc(cx+8, cy-7, 3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = rgb(skyTop); ctx.beginPath(); ctx.arc(cx+9, cy-6, 22, 0, Math.PI*2); ctx.fill();
  } else {
    const warm = t < 0.12 || t > 0.93;
    const gl = ctx.createRadialGradient(cx, cy, 8, cx, cy, 155);
    gl.addColorStop(0, warm ? "rgba(255,168,88,0.5)" : "rgba(255,226,150,0.45)"); gl.addColorStop(1, "rgba(255,210,120,0)");
    ctx.fillStyle = gl; ctx.fillRect(cx-160, cy-160, 320, 320);
    ctx.fillStyle = warm ? "rgba(255,196,120,0.98)" : "rgba(255,232,156,0.98)";
    ctx.beginPath(); ctx.arc(cx, cy, 32, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}
function drawClouds(dark, top) {
  const a = (1-dark)*0.9; if (a <= 0.02) return;
  const col = lerpColor(top, [255,255,255], 0.5);
  ctx.save(); ctx.fillStyle = rgb(col);
  for (const c of FX.clouds) {
    ctx.globalAlpha = a*c.o; const s = c.s;
    for (const o of [[-30,4,18],[-6,-7,25],[20,2,20],[46,6,15]]) { ctx.beginPath(); ctx.ellipse(c.x+o[0]*s, c.y+o[1]*s, o[2]*s, o[2]*s*0.6, 0, 0, Math.PI*2); ctx.fill(); }
  }
  ctx.restore();
}
function drawBirds(dark) {
  const a = (1-dark)*0.8; if (a <= 0.05) return;
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = "#2a2a32"; ctx.lineWidth = 2; ctx.lineCap = "round";
  for (const b of FX.birds) {
    const flap = Math.sin(b.ph)*0.55, s = 6*b.scale;
    ctx.beginPath(); ctx.moveTo(b.x-s, b.y+flap*s); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x+s, b.y+flap*s); ctx.stroke();
  }
  ctx.restore(); ctx.lineCap = "butt";
}
function drawHills(hills, dark) {
  const haze = hazeColor(dark), off = Game.cam*0.12;
  for (const h of hills) {
    const px = h.x - off; if (px < -h.w || px > W + h.w) continue;
    const b = biomeAt(h.x);
    ctx.fillStyle = rgb(lerpColor(atmo(b.gT, haze, 0.9), b.snow ? [236,241,248] : haze, b.snow ? 0.5 : 0.22));
    ctx.beginPath(); ctx.moveTo(px-h.w, groundY+4); ctx.quadraticCurveTo(px, groundY+4-h.h, px+h.w, groundY+4); ctx.closePath(); ctx.fill();
    if (b.snow) { ctx.fillStyle = "rgba(245,248,252,0.7)"; ctx.beginPath(); ctx.moveTo(px-h.w*0.3, groundY+4-h.h*0.7); ctx.quadraticCurveTo(px, groundY+4-h.h, px+h.w*0.3, groundY+4-h.h*0.7); ctx.lineTo(px, groundY+4-h.h*0.45); ctx.closePath(); ctx.fill(); }
  }
}
function drawFogBand(y, h, dark, intensity) {
  const bi = biomeAt(Game.cam + W/2);
  const a = intensity*(0.16 + 0.1*Math.sin(Game.windT*0.2))*(1 - 0.4*dark);
  const col = lerpColor(bi.fog, [20,22,40], dark);
  const grad = ctx.createLinearGradient(0, y-h, 0, y+h);
  grad.addColorStop(0, withA(col,0)); grad.addColorStop(0.5, withA(col,a)); grad.addColorStop(1, withA(col,0));
  ctx.fillStyle = grad; ctx.fillRect(0, y-h, W, h*2);
}
function drawGodrays(dark) {
  if (dark > 0.55 || lastSun.isMoon) return;
  const a = 0.06*(1 - dark*1.6); if (a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const sx = lastSun.cx, sy = lastSun.cy, shift = Math.sin(Game.windT*0.3)*8;
  // beams originate from inside the sun's disc (radius ~30) and fan out below it
  for (let i = -2; i <= 2; i++) {
    const topx = sx + i*7 + shift*0.3, botx = sx + i*46 + shift, wTop = 9, wBot = 26;
    const grad = ctx.createLinearGradient(0, sy, 0, groundY);
    grad.addColorStop(0, `rgba(255,240,190,${a})`); grad.addColorStop(1, "rgba(255,240,190,0)");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(topx-wTop, sy); ctx.lineTo(topx+wTop, sy); ctx.lineTo(botx+wBot, groundY); ctx.lineTo(botx-wBot, groundY); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/* ----------  ground texture + decoration (req #5)  ---------- */
let groundTexCache = null;
function getGroundTex() {
  if (groundTexCache && groundTexCache.seed === Game.treeSeed) return groundTexCache;
  const r = mulberry32((Game.treeSeed || 1) * 13 + 7);
  const fringe = [], patches = [], pebbles = [];
  for (let x = 0; x < CFG.worldWidth; x += 12 + r() * 16) fringe.push({ x, h: 5 + r() * 9, ph: r() * 6 });
  for (let x = 0; x < CFG.worldWidth; x += 24 + r() * 38) patches.push({ x, dy: r() * 60, r: 9 + r() * 24, light: r() < 0.5 });
  for (let x = 0; x < CFG.worldWidth; x += 28 + r() * 56) pebbles.push({ x, dy: 8 + r() * 70, r: 1.4 + r() * 3 });
  groundTexCache = { seed: Game.treeSeed, fringe, patches, pebbles };
  return groundTexCache;
}
function drawGroundTexture(dark) {
  const tex = getGroundTex(), camL = Game.cam - 30, camR = Game.cam + W + 30;
  for (const p of tex.patches) {                       // mottled soil / grass patches
    if (p.x < camL || p.x > camR) continue;
    const b = biomeAt(p.x);
    const col = lerpColor(p.light ? shade(b.gT, 1.16) : shade(b.gT, 0.8), [12, 14, 22], dark);
    ctx.fillStyle = withA(col, 0.5);
    ctx.beginPath(); ctx.ellipse(p.x, groundY + 7 + p.dy, p.r, p.r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  }
  for (const p of tex.pebbles) {                        // scattered pebbles
    if (p.x < camL || p.x > camR) continue;
    ctx.fillStyle = withA(lerpColor([120, 118, 124], [40, 40, 52], dark), 0.7);
    ctx.beginPath(); ctx.ellipse(p.x, groundY + 9 + p.dy, p.r, p.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = "round";                                // grass fringe softens the top edge (sways)
  for (const f of tex.fringe) {
    if (f.x < camL || f.x > camR) continue;
    const b = biomeAt(f.x);
    const col = b.snow ? lerpColor([226, 233, 243], [120, 140, 170], dark) : lerpColor(shade(b.gT, 1.04), [18, 26, 18], dark);
    const sway = windSway(f.ph, 4);
    ctx.strokeStyle = rgb(col); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(f.x, groundY + 2); ctx.quadraticCurveTo(f.x + sway * 0.5, groundY - f.h * 0.6, f.x + sway, groundY - f.h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(f.x + 3, groundY + 2); ctx.quadraticCurveTo(f.x + 3 + sway * 0.4, groundY - f.h * 0.5, f.x + 3 + sway * 0.8, groundY - f.h * 0.8); ctx.stroke();
  }
  ctx.lineCap = "butt";
}
function drawGroundDeco(dark) {
  const items = getDeco().items, camL = Game.cam-40, camR = Game.cam+W+40;
  for (const it of items) { if (it.x < camL || it.x > camR) continue; drawDeco(it, biomeAt(it.x), dark); }
}
function drawDeco(it, b, dark) {
  const x = it.x, s = it.s, sway = windSway(it.ph, 5)*s*0.5;
  const g1 = lerpColor(shade(b.gT, 0.55), [8,12,18], dark);
  ctx.lineCap = "round";
  switch (it.kind) {
    case "grass": case "snowtuft": {
      const col = it.kind==="snowtuft" ? lerpColor([230,238,248],[120,140,170],dark) : g1;
      ctx.strokeStyle = rgb(col); ctx.lineWidth = 1.6*s;
      for (let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(x+i*3*s, groundY); ctx.quadraticCurveTo(x+i*3*s+sway*0.5, groundY-7*s, x+i*4*s+sway, groundY-12*s); ctx.stroke(); }
      break; }
    case "flower": {
      ctx.strokeStyle = rgb(g1); ctx.lineWidth = 1.4*s; ctx.beginPath(); ctx.moveTo(x, groundY); ctx.quadraticCurveTo(x+sway*0.5, groundY-8*s, x+sway, groundY-13*s); ctx.stroke();
      ctx.fillStyle = it.flower; ctx.beginPath(); ctx.arc(x+sway, groundY-14*s, 2.4*s, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "rgba(255,240,160,0.9)"; ctx.beginPath(); ctx.arc(x+sway, groundY-14*s, 1*s, 0, Math.PI*2); ctx.fill();
      break; }
    case "stone": {
      ctx.fillStyle = rgb(lerpColor([110,112,120],[30,32,42],dark)); ctx.beginPath(); ctx.ellipse(x, groundY-3*s, 6*s, 4*s, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.beginPath(); ctx.ellipse(x-1.5*s, groundY-4.5*s, 3*s, 1.6*s, 0, 0, Math.PI*2); ctx.fill();
      break; }
    case "stump": {
      ctx.fillStyle = rgb(lerpColor([96,68,40],[24,20,18],dark)); ctx.fillRect(x-5*s, groundY-8*s, 10*s, 8*s);
      ctx.fillStyle = rgb(lerpColor([132,98,60],[40,32,24],dark)); ctx.beginPath(); ctx.ellipse(x, groundY-8*s, 5*s, 2.2*s, 0, 0, Math.PI*2); ctx.fill();
      break; }
    case "leafpile": {
      ctx.fillStyle = rgb(lerpColor([150,90,40],[40,30,20],dark));
      for (let i=0;i<5;i++){ ctx.beginPath(); ctx.arc(x+(i-2)*3*s, groundY-2*s-(i%2)*2, 2.4*s, 0, Math.PI*2); ctx.fill(); }
      break; }
    case "reed": {
      ctx.strokeStyle = rgb(lerpColor([120,130,70],[20,28,20],dark)); ctx.lineWidth = 1.6*s;
      for (let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(x+i*3*s, groundY); ctx.quadraticCurveTo(x+i*3*s+sway, groundY-14*s, x+i*4*s+sway*1.4, groundY-22*s); ctx.stroke(); }
      break; }
    case "fern": {
      ctx.strokeStyle = rgb(lerpColor([46,90,60],[14,28,24],dark)); ctx.lineWidth = 1.4*s;
      for (let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(x, groundY); ctx.quadraticCurveTo(x+i*8*s+sway, groundY-8*s, x+i*14*s+sway, groundY-4*s); ctx.stroke(); }
      break; }
    case "mushroom": {
      ctx.fillStyle = rgb(lerpColor([200,200,190],[60,60,70],dark)); ctx.fillRect(x-1.2*s, groundY-6*s, 2.4*s, 6*s);
      ctx.fillStyle = b.deco==="swamp" ? "#9a6a3a" : "#c34b3a"; ctx.beginPath(); ctx.ellipse(x, groundY-6*s, 4*s, 3*s, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.beginPath(); ctx.arc(x-1.5*s, groundY-7*s, 0.7*s, 0, Math.PI*2); ctx.fill();
      break; }
  }
  ctx.lineCap = "butt";
}

/* ----------  contact shadows under everything (req #11)  ---------- */
function drawEntityShadows() {
  if (player) groundShadow(player.x, 22, 0.24);
  for (const u of units) groundShadow(u.x, 11, 0.2);
  for (const v of vagrants) groundShadow(v.x, 11, 0.2);
  for (const e of enemies) groundShadow(e.x, ENEMY_TYPES[e.type].w*0.7, 0.22);
  for (const a of animals) if (a.alive) groundShadow(a.x, 10, 0.18);
}

/* ----------  campfire light, embers & smoke cast over the base (req #4, #8)  ---------- */
function drawCampLight(dark) {
  for (const s of FX.smoke) { const k = s.t/s.life; ctx.globalAlpha = (1-k)*0.16; ctx.fillStyle = "rgba(58,54,58,1)"; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill(); }
  ctx.globalAlpha = 1;
  const warm = Math.max(dark, Game.isNight ? 0.55 : 0)*0.95;
  if (warm > 0.05) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const fl = FX.flicker, R = 240*fl;
    const g = ctx.createRadialGradient(base.x, groundY-30, 10, base.x, groundY-30, R);
    g.addColorStop(0, `rgba(255,172,72,${0.34*warm*fl})`); g.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = g; ctx.fillRect(base.x-R, groundY-30-R, R*2, R*2);
    ctx.restore();
  }
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (const e of FX.embers) { const k = e.t/e.life; ctx.globalAlpha = 1-k; ctx.fillStyle = `rgba(255,${(170-90*k)|0},60,1)`; ctx.fillRect(e.x, e.y, e.s, e.s); }
  ctx.restore(); ctx.globalAlpha = 1;
}

/* ----------  low-lying fog + foreground ambient particles (req #6, #10)  ---------- */
function drawLowFog(dark, bi) {
  const inten = bi.deco==="swamp" ? 0.5 : bi.snow ? 0.4 : bi.deco==="dark" ? 0.32 : 0.2;
  const a = inten*(0.5 + 0.2*Math.sin(Game.windT*0.3));
  const col = lerpColor(bi.fog, [18,20,36], dark);
  const grad = ctx.createLinearGradient(0, groundY-70, 0, groundY+30);
  grad.addColorStop(0, withA(col,0)); grad.addColorStop(0.7, withA(col,a*0.7)); grad.addColorStop(1, withA(col,a));
  ctx.fillStyle = grad; ctx.fillRect(0, groundY-70, W, 100);
  ctx.save(); ctx.globalAlpha = a*0.7; ctx.fillStyle = rgb(col);
  for (let i = 0; i < 4; i++) { const wx = ((Game.windT*12 + i*W/4) % (W+260)) - 130; ctx.beginPath(); ctx.ellipse(wx, groundY-18-i*6, 120, 17, 0, 0, Math.PI*2); ctx.fill(); }
  ctx.restore();
}
function drawAmbientFront(dark, bi) {
  ctx.save();
  for (const d of FX.dust) { ctx.globalAlpha = (0.10 + 0.16*d.z)*(0.5 + 0.5*(1-dark)); ctx.fillStyle = dark>0.5 ? "rgba(180,190,220,1)" : "rgba(255,250,230,1)"; const s = 1 + d.z*1.5; ctx.fillRect(d.x, d.y, s, s); }
  ctx.restore();
  if (dark < 0.5) { for (const bf of FX.butter) { const w = Math.abs(Math.sin(bf.ph*6)); ctx.globalAlpha = 1 - dark*2; if (ctx.globalAlpha <= 0) continue; ctx.fillStyle = bf.c; ctx.beginPath(); ctx.ellipse(bf.x-2, bf.y, 3, 1.4+w*1.6, 0, 0, Math.PI*2); ctx.ellipse(bf.x+2, bf.y, 3, 1.4+w*1.6, 0, 0, Math.PI*2); ctx.fill(); } ctx.globalAlpha = 1; }
  if (dark > 0.4) { ctx.save(); ctx.globalCompositeOperation = "lighter"; for (const f of FX.flies) { const tw = 0.4 + 0.6*Math.abs(Math.sin(f.ph*3)); ctx.globalAlpha = tw*dark; ctx.fillStyle = "rgba(190,255,120,0.9)"; ctx.beginPath(); ctx.arc(f.x, f.y, 1.7, 0, Math.PI*2); ctx.fill(); } ctx.restore(); }
  for (const p of FX.fall) { if (!p.active) continue; ctx.globalAlpha = 0.85; if (p.snow) { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI*2); ctx.fill(); } else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 1.5, 0, 0, Math.PI*2); ctx.fill(); ctx.restore(); } }
  ctx.globalAlpha = 1;
}

function drawPortals(dark) {
  for (const p of portals) {
    const x = p.x;
    ctx.save();
    // dark mound
    ctx.fillStyle = "#140f1e";
    ctx.beginPath();
    ctx.moveTo(x - 70, groundY);
    ctx.quadraticCurveTo(x, groundY - 130, x + 70, groundY);
    ctx.fill();
    // glowing rift
    const glow = Game.isNight ? 1 : 0.35;
    const rg = ctx.createRadialGradient(x, groundY - 50, 4, x, groundY - 50, 46);
    rg.addColorStop(0, `rgba(255,60,90,${0.9 * glow})`);
    rg.addColorStop(1, "rgba(120,10,40,0)");
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.ellipse(x, groundY - 50, 30, 48, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(20,4,10,1)`;
    ctx.beginPath(); ctx.ellipse(x, groundY - 46, 14, 30, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawWalls(dark) {
  const night = dark > 0.25;
  for (const w of walls) {
    const x = w.x;
    if (!w.commissioned) { drawFlag(x, "#6fb3d6"); continue; }
    const h = wallHeight(w) * (0.3 + 0.7 * clamp(w.buildProgress, 0, 1));
    const ww = w.level === 2 ? 34 : 26;
    if (w.flash > 0) w.flash -= 0.016;
    const flash = w.flash > 0;
    groundShadow(x, ww * 0.7, 0.26);
    ctx.fillStyle = flash ? "#e8d8a8" : (w.level === 2 ? "#6b6b78" : "#7a5a36");
    roundedRect(x - ww / 2, groundY - h, ww, h, 4); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.10)"; roundedRect(x - ww / 2, groundY - h, ww * 0.3, h, 4); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(x + ww * 0.28, groundY - h, ww * 0.22, h);
    ctx.strokeStyle = "rgba(0,0,0,0.22)"; ctx.lineWidth = 1;
    for (let yy = groundY - h + 8; yy < groundY - 4; yy += 9) { ctx.beginPath(); ctx.moveTo(x - ww / 2 + 2, yy); ctx.lineTo(x + ww / 2 - 2, yy); ctx.stroke(); }
    ctx.fillStyle = w.level === 2 ? "#5a5a66" : "#634828";
    for (let i = -1; i <= 1; i++) ctx.fillRect(x - ww / 2 + (i + 1) * (ww / 3), groundY - h - 6, ww / 4, 7);
    if (night && w.buildProgress > 0.6) drawTorch(x, groundY - h - 4);
    drawHpBar(x, groundY - h - 18, ww + 6, w.hp / w.maxHp, "#9bd05a");
  }
}
function drawFlag(x, color) {
  groundShadow(x, 8, 0.16);
  ctx.strokeStyle = "#cdbfa3"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x, groundY - 36); ctx.stroke();
  const sway = windSway(x, 4);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x, groundY - 36); ctx.quadraticCurveTo(x + 10 + sway, groundY - 34, x + 18 + sway, groundY - 30); ctx.quadraticCurveTo(x + 10 + sway, groundY - 28, x, groundY - 24); ctx.fill();
}

function drawBase(dark) {
  const x = base.x, lvl = base.level;
  if (base.flash > 0) base.flash -= 0.016;
  const flash = base.flash > 0 && Math.floor(base.flash * 20) % 2 === 0;
  ctx.save();
  groundShadow(x, lvl>=4 ? 112 : lvl>=2 ? 82 : 48, 0.3);
  const stoneL = flash ? "#ffd0b0" : "#5a5260";
  const stoneD = flash ? "#e0b090" : "#403a48";
  const night = dark > 0.25;

  if (lvl === 1) {
    drawTent(x - 36, "#6a4a32"); drawTent(x + 36, "#5a3f2a");
    if (night) { drawTorch(x - 58, groundY); drawTorch(x + 58, groundY); }
    drawCampfire(x);
  } else if (lvl === 2) {
    drawHouse(x - 60, 54, stoneL, stoneD, dark);
    drawHouse(x + 58, 48, stoneL, stoneD, dark);
    drawTower(x, 100, stoneL, stoneD, dark);
    if (night) { drawTorch(x - 92, groundY); drawTorch(x + 92, groundY); }
    drawCampfire(x - 6);
  } else if (lvl === 3) {
    drawHouse(x - 90, 60, stoneL, stoneD, dark);
    drawHouse(x + 86, 56, stoneL, stoneD, dark);
    drawTower(x - 30, 120, stoneL, stoneD, dark);
    drawTower(x + 34, 110, stoneL, stoneD, dark);
    if (night) { drawTorch(x - 122, groundY); drawTorch(x + 122, groundY); }
    drawCampfire(x);
  } else {
    drawTower(x - 90, 150, stoneL, stoneD, dark);
    drawTower(x + 90, 150, stoneL, stoneD, dark);
    drawKeep(x, 180, stoneL, stoneD, dark);
    if (night) { drawTorch(x - 132, groundY); drawTorch(x + 132, groundY); }
    drawCampfire(x);
  }
  drawHpBar(x, groundY - (lvl >= 4 ? 200 : lvl >= 2 ? 130 : 70), 70, base.hp / base.maxHp, "#f2c14e");
  ctx.restore();
}
function drawTent(x, col) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(x, groundY - 44); ctx.lineTo(x - 26, groundY); ctx.lineTo(x + 26, groundY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath(); ctx.moveTo(x, groundY - 44); ctx.lineTo(x + 26, groundY); ctx.lineTo(x + 8, groundY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.beginPath(); ctx.moveTo(x, groundY - 44); ctx.lineTo(x - 26, groundY); ctx.lineTo(x - 12, groundY); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(40,30,24,0.8)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, groundY - 44); ctx.lineTo(x, groundY - 54); ctx.stroke();
  const sway = windSway(x, 3);
  ctx.fillStyle = "#c1453b"; ctx.beginPath(); ctx.moveTo(x, groundY - 54); ctx.lineTo(x + 10 + sway, groundY - 51); ctx.lineTo(x, groundY - 48); ctx.fill();
}
function litWindow(dark) { const fl = (FX && FX.flicker) || 1; return 0.5 + 0.5 * (dark > 0.2 ? fl : 0.32); }
function drawHouse(x, h, l, d, dark) {
  const w = h * 0.9;
  ctx.fillStyle = d; ctx.fillRect(x - w / 2, groundY - h, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(x - w / 2, groundY - h, w * 0.34, h);
  ctx.fillStyle = l;
  ctx.beginPath(); ctx.moveTo(x - w / 2 - 5, groundY - h); ctx.lineTo(x, groundY - h - 28); ctx.lineTo(x + w / 2 + 5, groundY - h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.moveTo(x, groundY - h - 28); ctx.lineTo(x + w / 2 + 5, groundY - h); ctx.lineTo(x + w * 0.2, groundY - h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = `rgba(255,186,86,${litWindow(dark)})`; ctx.fillRect(x - 6, groundY - h * 0.55, 12, 14);
  ctx.fillStyle = "rgba(36,24,16,0.85)"; ctx.fillRect(x - w * 0.16, groundY - h * 0.42, w * 0.18, h * 0.42);
}
function drawTower(x, h, l, d, dark) {
  const w = 36;
  ctx.fillStyle = d; ctx.fillRect(x - w / 2, groundY - h, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(x - w / 2, groundY - h, w * 0.32, h);
  ctx.fillStyle = l;
  for (let i = 0; i < 3; i++) ctx.fillRect(x - w / 2 + i * (w / 3), groundY - h - 8, w / 4, 9);
  ctx.fillStyle = `rgba(255,186,86,${litWindow(dark)})`;
  ctx.fillRect(x - 5, groundY - h * 0.7, 10, 14);
  ctx.fillRect(x - 5, groundY - h * 0.4, 10, 14);
}
function drawKeep(x, h, l, d, dark) {
  const w = 90;
  ctx.fillStyle = d; ctx.fillRect(x - w / 2, groundY - h, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fillRect(x - w / 2, groundY - h, w * 0.3, h);
  ctx.fillStyle = l;
  for (let i = 0; i < 5; i++) ctx.fillRect(x - w / 2 + i * (w / 5), groundY - h - 10, w / 8, 11);
  const sway = windSway(x * 0.1, 2.5);
  ctx.fillStyle = "#c1453b";
  ctx.beginPath(); ctx.moveTo(x - 8, groundY - h + 10); ctx.lineTo(x + 8, groundY - h + 10); ctx.lineTo(x + 8 + sway, groundY - h + 50); ctx.lineTo(x - 8 + sway, groundY - h + 50); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#f2c14e"; ctx.beginPath(); ctx.arc(x + sway * 0.5, groundY - h + 26, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(255,186,86,${litWindow(dark)})`; ctx.fillRect(x - 6, groundY - h * 0.6, 12, 18);
}
function drawCampfire(x) {
  const t = performance.now()/1000;
  const fl = (FX && FX.flicker) || 1;
  const wind = windGust()*0.3;
  // ember bed glow
  ctx.fillStyle = `rgba(255,140,40,${0.5*fl})`;
  ctx.beginPath(); ctx.ellipse(x, groundY-3, 13, 4, 0, 0, Math.PI*2); ctx.fill();
  // crossed logs
  ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = 5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x-12, groundY-2); ctx.lineTo(x+10, groundY-7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+12, groundY-2); ctx.lineTo(x-10, groundY-7); ctx.stroke();
  ctx.lineCap = "butt";
  // layered animated flame (req #8)
  const flame = (h, w, col, wob) => {
    const sway = Math.sin(t*8 + wob)*2 + wind;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x-w, groundY-6);
    ctx.quadraticCurveTo(x-w*0.6 + sway, groundY-h*0.6, x + sway*1.4, groundY-h*fl);
    ctx.quadraticCurveTo(x+w*0.6 + sway, groundY-h*0.6, x+w, groundY-6);
    ctx.quadraticCurveTo(x, groundY-2, x-w, groundY-6);
    ctx.fill();
  };
  flame(34, 11, "rgba(226,88,30,0.92)", 0);
  flame(26, 8,  "rgba(255,150,40,0.95)", 1.7);
  flame(17, 5,  "rgba(255,210,90,0.97)", 3.1);
  flame(9, 2.6, "rgba(255,244,200,0.98)", 4.6);
}
function drawTorch(x, y) {
  const fl = (FX && FX.flicker) || 1;
  ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y-12); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = "rgba(255,150,50,0.55)"; ctx.beginPath(); ctx.arc(x, y-15, 14*fl, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "rgba(255,170,60,0.97)"; ctx.beginPath(); ctx.ellipse(x, y-15, 3, 6*fl, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = "rgba(255,234,160,0.98)"; ctx.beginPath(); ctx.ellipse(x, y-15, 1.5, 3.4*fl, 0, 0, Math.PI*2); ctx.fill();
}

function drawStations() {
  // bow & hammer & farm icons floating
  drawStationIcon(STATIONS_X.bow, "🏹");
  drawStationIcon(STATIONS_X.hammer, "🔨");
  drawStationIcon(STATIONS_X.farm, state_farmBuilt ? "🌾" : "🌱");
  if (state_farmBuilt) {
    // little field
    ctx.fillStyle = "#6a4a28";
    ctx.fillRect(STATIONS_X.farm - 30, groundY - 6, 60, 6);
    ctx.fillStyle = "#9bd05a";
    for (let i = 0; i < 5; i++) ctx.fillRect(STATIONS_X.farm - 26 + i * 12, groundY - 14, 3, 10);
  }
}
function drawStationIcon(x, emoji) {
  const bob = Math.sin(performance.now() / 400 + x) * 3;
  ctx.save();
  ctx.font = "20px serif"; ctx.textAlign = "center";
  ctx.globalAlpha = 0.92;
  ctx.fillText(emoji, x, groundY - 48 + bob);
  // post
  ctx.strokeStyle = "rgba(120,100,70,0.6)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x, groundY - 28); ctx.stroke();
  ctx.restore();
}

function drawCoins() {
  const t = performance.now();
  for (const c of coins) {
    const yy = c.settled ? groundY - 4 - Math.sin(t / 300 + c.x) * 1.5 : c.y;
    if (c.settled) groundShadow(c.x, 5, 0.15);
    ctx.fillStyle = "#f2c14e";
    ctx.beginPath(); ctx.ellipse(c.x, yy, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#caa028";
    ctx.beginPath(); ctx.ellipse(c.x, yy, 2.4, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,250,210,0.9)";
    ctx.beginPath(); ctx.ellipse(c.x - 1.4, yy - 1.8, 1, 1.6, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function legs(x, baseYy, anim, spread, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 2.6; ctx.lineCap = "round";
  const s = Math.sin(anim);
  ctx.beginPath(); ctx.moveTo(x - 3, baseYy); ctx.lineTo(x - 3 + s * spread, groundY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 3, baseYy); ctx.lineTo(x + 3 - s * spread, groundY); ctx.stroke();
  ctx.lineCap = "butt";
}

function drawPlayer(dark) {
  const x = player.x;
  const bob = player.bob;
  const gallop = player.gallop;
  ctx.save();
  if (player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 0) ctx.globalAlpha = 0.45; // i-frame blink
  ctx.translate(x, -bob);
  if (player.dir < 0) { ctx.scale(-1, 1); }
  const px = 0;
  // horse body (silhouette)
  ctx.fillStyle = "#2a2230";
  // legs (only stride while actually moving)
  const moving = Math.abs(player.vx) > 1;
  const s = moving ? Math.sin(gallop * 2) : 0;
  ctx.strokeStyle = "#2a2230"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(px - 14, groundY - 26 + bob); ctx.lineTo(px - 14 + s * 8, groundY + bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px + 12, groundY - 26 + bob); ctx.lineTo(px + 12 - s * 8, groundY + bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px - 8, groundY - 26 + bob); ctx.lineTo(px - 8 - s * 8, groundY + bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px + 18, groundY - 26 + bob); ctx.lineTo(px + 18 + s * 8, groundY + bob); ctx.stroke();
  // body
  roundedRect(px - 20, groundY - 46, 44, 22, 10); ctx.fill();
  // neck + head
  ctx.beginPath();
  ctx.moveTo(px + 18, groundY - 44);
  ctx.lineTo(px + 30, groundY - 64);
  ctx.lineTo(px + 40, groundY - 62);
  ctx.lineTo(px + 38, groundY - 52);
  ctx.lineTo(px + 26, groundY - 40);
  ctx.closePath(); ctx.fill();
  // tail (sways)
  const tail = windSway(px, 4) + Math.sin(gallop) * 2;
  ctx.beginPath(); ctx.moveTo(px - 20, groundY - 44); ctx.quadraticCurveTo(px - 34 - tail, groundY - 40, px - 30 - tail, groundY - 22); ctx.lineTo(px - 24 - tail * 0.6, groundY - 30); ctx.quadraticCurveTo(px - 26, groundY - 40, px - 18, groundY - 40); ctx.fill();
  // mane
  ctx.strokeStyle = "#1c1622"; ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) { const t = i / 3, mx = lerp(px + 20, px + 33, t), my = lerp(groundY - 46, groundY - 62, t); ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx - 4, my - 3); ctx.stroke(); }
  // horse eye
  ctx.fillStyle = "#f2c14e"; ctx.beginPath(); ctx.arc(px + 34, groundY - 58, 1.4, 0, Math.PI * 2); ctx.fill();
  // flowing royal cape (behind rider, sways with the gallop + wind)
  const cape = (moving ? Math.sin(gallop * 2) * 4 : 0) + windSway(px, 3);
  ctx.fillStyle = "#5a182e";
  ctx.beginPath();
  ctx.moveTo(px - 4, groundY - 66);
  ctx.quadraticCurveTo(px - 16 - cape, groundY - 52, px - 22 - cape * 1.4, groundY - 32);
  ctx.lineTo(px - 8, groundY - 40);
  ctx.quadraticCurveTo(px - 6, groundY - 54, px + 2, groundY - 64);
  ctx.fill();
  // rider (monarch) - cloak
  ctx.fillStyle = "#7a2440";
  roundedRect(px - 6, groundY - 70, 16, 26, 6); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.18)"; roundedRect(px + 4, groundY - 70, 6, 26, 4); ctx.fill();
  // head
  ctx.fillStyle = "#caa483";
  ctx.beginPath(); ctx.arc(px + 2, groundY - 74, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3a2e2a"; ctx.beginPath(); ctx.arc(px + 4, groundY - 75, 1.1, 0, Math.PI * 2); ctx.fill();
  // crown
  if (player.hasCrown) {
    ctx.fillStyle = "#f2c14e";
    ctx.beginPath();
    ctx.moveTo(px - 4, groundY - 80);
    ctx.lineTo(px - 4, groundY - 86); ctx.lineTo(px - 1, groundY - 82);
    ctx.lineTo(px + 2, groundY - 87); ctx.lineTo(px + 5, groundY - 82);
    ctx.lineTo(px + 8, groundY - 86); ctx.lineTo(px + 8, groundY - 80);
    ctx.closePath(); ctx.fill();
  }
  // weapon in hand
  if (player.weapon) {
    const w = WEAPONS[player.weapon];
    const sw = player.swing || 0;
    ctx.save();
    if (w.type === "melee") {
      const baseAng = -0.22, swingOff = sw > 0 ? -0.9 * (sw / 0.32) : 0;
      ctx.translate(px + 10, groundY - 58); ctx.rotate(baseAng + swingOff);
      const len = clamp(w.range * 0.42, 18, 40);
      ctx.strokeStyle = w.col; ctx.lineWidth = 2.5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(len,0); ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-4,-3); ctx.lineTo(-4,3); ctx.stroke();
      if (w.rarity >= 2) {
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.28+sw*0.4;
        ctx.strokeStyle=w.col; ctx.lineWidth=5;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(len,0); ctx.stroke(); ctx.restore();
      }
    } else {
      ctx.strokeStyle = w.col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px+14, groundY-58, 10, -1.25, 1.25); ctx.stroke();
      ctx.strokeStyle = "rgba(230,216,168,0.65)"; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px+14+10*Math.cos(-1.25), groundY-58+10*Math.sin(-1.25));
      ctx.lineTo(px+14+10*Math.cos(1.25),  groundY-58+10*Math.sin(1.25));
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
  // health hearts above the crown (req: player HP bar)
  const n = player.maxHp, gap = 9, hy = groundY - 98 - bob;
  for (let i = 0; i < n; i++) drawHeart(player.x - (n - 1) * gap / 2 + i * gap, hy, 4, i < player.hp ? "#e0556a" : "rgba(255,255,255,0.18)");
}
function drawHeart(x, y, s, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.4, x - s * 0.4, y - s * 1.2, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.4, y - s * 1.2, x + s * 1.4, y - s * 0.4, x, y + s * 0.9);
  ctx.fill();
}

function drawHumanoid(x, anim, bodyCol, headCol, tool, dir, moving) {
  ctx.save();
  ctx.translate(x, 0);
  if (dir < 0) ctx.scale(-1, 1);
  const bob = moving ? Math.abs(Math.sin(anim)) * 1.2 : 0;
  legs(0, groundY - 15, anim, moving ? 5 : 0, bodyCol);
  // body (stronger silhouette) + shaded side
  ctx.fillStyle = bodyCol; roundedRect(-5, groundY - 34 - bob, 10, 20, 4); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.18)"; roundedRect(2, groundY - 34 - bob, 3, 20, 2); ctx.fill();
  // head + simple hood/hair
  ctx.fillStyle = headCol; ctx.beginPath(); ctx.arc(0, groundY - 38 - bob, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.beginPath(); ctx.arc(-1, groundY - 40 - bob, 5, Math.PI * 1.05, Math.PI * 2); ctx.fill();
  if (tool === "bow") {
    // helmet (nasal helmet shape)
    ctx.fillStyle = "#7a7a8a"; ctx.beginPath(); ctx.arc(0, groundY - 39 - bob, 5.5, Math.PI, 0); ctx.fill();
    ctx.fillRect(-5.5, groundY - 39 - bob, 11, 3); // brim
    ctx.fillStyle = "#6a6a7a"; ctx.fillRect(-1, groundY - 38 - bob, 2, 5); // nasal guard
    // chest armor plate
    ctx.fillStyle = "#5a6a50"; roundedRect(-5, groundY - 34 - bob, 10, 20, 4); ctx.fill();
    ctx.fillStyle = "#6a7a5e"; ctx.fillRect(-4, groundY - 34 - bob, 8, 3); // gorget highlight
    // quiver
    ctx.fillStyle = "#6a4a2a"; ctx.fillRect(-7, groundY - 34 - bob, 3, 12);
    ctx.strokeStyle = "#e8d8a8"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-6, groundY - 35 - bob); ctx.lineTo(-5, groundY - 42 - bob); ctx.stroke();
    // bow
    ctx.strokeStyle = "#8a5a2a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(8, groundY - 28 - bob, 9, -1.2, 1.2); ctx.stroke();
    ctx.strokeStyle = "rgba(230,216,168,0.8)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(8 + Math.cos(-1.2) * 9, groundY - 28 - bob + Math.sin(-1.2) * 9); ctx.lineTo(8 + Math.cos(1.2) * 9, groundY - 28 - bob + Math.sin(1.2) * 9); ctx.stroke();
  } else if (tool === "hammer") {
    ctx.fillStyle = "rgba(0,0,0,0.2)"; roundedRect(-5, groundY - 26 - bob, 10, 10, 2); ctx.fill();   // apron
    ctx.strokeStyle = "#6a4a2a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(7, groundY - 30 - bob); ctx.lineTo(11, groundY - 22 - bob); ctx.stroke();
    ctx.fillStyle = "#8a8a92"; ctx.fillRect(6, groundY - 34 - bob, 8, 5);
  } else if (tool === "scythe") {
    ctx.fillStyle = "#c9a24a"; ctx.beginPath(); ctx.ellipse(0, groundY - 42 - bob, 8, 2.6, 0, 0, Math.PI * 2); ctx.fill();  // straw hat
    ctx.beginPath(); ctx.arc(0, groundY - 43 - bob, 4, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = "#6a4a2a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(7, groundY - 34 - bob); ctx.lineTo(9, groundY - 16 - bob); ctx.stroke();
    ctx.strokeStyle = "#bdbdc6"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(9, groundY - 34 - bob, 6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  }
  ctx.restore();
}

function drawVagrants(dark) {
  for (const v of vagrants) {
    drawHumanoid(v.x, v.anim, "#4a4438", "#9a8a6a", null, v.vx >= 0 ? 1 : -1, Math.abs(v.vx) > 1);
    // ragged hood marker
  }
}
function drawUnits(dark) {
  for (const u of units) {
    let body = "#3a3550", head = "#caa483", tool = null;
    if (u.role === "archer") { body = "#2f5040"; tool = "bow"; }
    else if (u.role === "builder") { body = "#6a4a28"; tool = "hammer"; }
    else if (u.role === "farmer") { body = "#5a6a2a"; tool = "scythe"; }
    drawHumanoid(u.x, u.anim, body, head, tool, u.dir, u.moving);
    if (u.transform > 0) {
      const p = u.transform / 0.55;
      ctx.save();
      ctx.globalAlpha = p * 0.7;
      ctx.globalCompositeOperation = "lighter";
      const grd = ctx.createRadialGradient(u.x, groundY - 28, 2, u.x, groundY - 28, 28 * p);
      grd.addColorStop(0, "#ffffff"); grd.addColorStop(0.4, "#9bd05a"); grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(u.x, groundY - 28, 28 * p, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (u.hp < u.maxHp) drawHpBar(u.x, groundY - 46, 16, u.hp / u.maxHp, "#9bd05a");
  }
}

function drawEnemies(dark) {
  for (const e of enemies) {
    const t = ENEMY_TYPES[e.type];
    ctx.save();
    ctx.translate(e.x, 0);
    if (e.dir < 0) ctx.scale(-1, 1);
    const w = t.w, bob = Math.abs(Math.sin(e.anim * 2)) * 2, s = Math.sin(e.anim * 3);
    ctx.strokeStyle = e.flash > 0 ? "#fff" : t.color; ctx.lineWidth = Math.max(2, w * 0.12); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-w * 0.25, groundY - 8 - bob); ctx.lineTo(-w * 0.25 + s * 5, groundY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 0.25, groundY - 8 - bob); ctx.lineTo(w * 0.25 - s * 5, groundY); ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = e.flash > 0 ? "#ffffff" : t.color;
    roundedRect(-w / 2, groundY - w - 6 - bob, w, w + 6, w * 0.4); ctx.fill();
    if (e.type === "brute" || e.type === "boss") {
      ctx.fillStyle = e.flash > 0 ? "#fff" : t.color;
      for (let i = -1; i <= 1; i++) { const sx = i * w * 0.28; ctx.beginPath(); ctx.moveTo(sx - 3, groundY - w - 2 - bob); ctx.lineTo(sx, groundY - w - 13 - bob); ctx.lineTo(sx + 3, groundY - w - 2 - bob); ctx.fill(); }
    }
    ctx.fillStyle = "rgba(255,255,255,0.06)"; roundedRect(-w / 2, groundY - w - 6 - bob, w * 0.34, w + 6, w * 0.4); ctx.fill();
    const ex = w * 0.12, ex2 = w * 0.32, ey = groundY - w * 0.6 - bob;
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.4 + 0.35 * dark; ctx.fillStyle = t.eye;
    ctx.beginPath(); ctx.arc(ex, ey, w * 0.22, 0, Math.PI * 2); ctx.arc(ex2, ey, w * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = t.eye;
    ctx.beginPath(); ctx.arc(ex, ey, w * 0.09, 0, Math.PI * 2); ctx.arc(ex2, ey, w * 0.09, 0, Math.PI * 2); ctx.fill();
    if (e.carry > 0) { ctx.fillStyle = "#f2c14e"; ctx.beginPath(); ctx.arc(0, groundY - w - 12 - bob, 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    if (e.hp < e.maxHp) drawHpBar(e.x, groundY - t.w - 16, t.w + 4, e.hp / e.maxHp, "#d05a5a");
  }
}

function drawAnimals(dark) {
  for (const a of animals) {
    if (!a.alive) continue;
    ctx.save(); ctx.translate(a.x, 0);
    if (a.vx < 0) ctx.scale(-1, 1);
    const col = a.type === "deer" ? "#6a4a2a" : "#8a7a6a";
    ctx.fillStyle = col;
    const sz = a.type === "deer" ? 1.5 : 1;
    legs(0, groundY - 8 * sz, a.anim * 1.5, 4, col);
    roundedRect(-9 * sz, groundY - 18 * sz, 18 * sz, 12 * sz, 5); ctx.fill();
    ctx.beginPath(); ctx.arc(8 * sz, groundY - 20 * sz, 4 * sz, 0, Math.PI * 2); ctx.fill();
    if (a.type === "deer") { ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(8 * sz, groundY - 24 * sz); ctx.lineTo(6 * sz, groundY - 30 * sz); ctx.moveTo(10 * sz, groundY - 24 * sz); ctx.lineTo(12 * sz, groundY - 30 * sz); ctx.stroke(); }
    ctx.restore();
  }
}

function drawArrows() {
  ctx.strokeStyle = "#e8d8a8"; ctx.lineWidth = 2;
  for (const ar of arrows) {
    const ang = Math.atan2(ar.vy, ar.vx);
    ctx.save(); ctx.translate(ar.x, ar.y); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(5, 0); ctx.stroke();
    ctx.fillStyle = "#e8d8a8"; ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(1, -2); ctx.lineTo(1, 2); ctx.fill();
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.fly ? 1 : clamp(p.life * 1.5, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}
function drawFloats() {
  ctx.textAlign = "center";
  for (const f of floatTexts) {
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.font = "bold 15px Trebuchet MS";
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillText(f.text, f.x + 1, f.y + 1);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawHpBar(x, y, w, frac, color) {
  frac = clamp(frac, 0, 1);
  if (frac >= 0.999) return;
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 5);
  ctx.fillStyle = color; ctx.fillRect(x - w / 2, y, w * frac, 3);
}

/* ------------------------------------------------------------------ */
/*  LOCATIONS + LOOT DRAWING                                           */
/* ------------------------------------------------------------------ */
function drawLocations(dark) {
  if (!locations) return;
  const camL = Game.cam - 220, camR = Game.cam + W + 220;
  for (const loc of locations) {
    if (loc.x < camL || loc.x > camR) continue;
    switch (loc.type) {
      case "camp":        drawLocCamp(loc.x, dark); break;
      case "wagon":       drawLocWagon(loc.x, dark); break;
      case "grave":       drawLocGrave(loc.x, dark); break;
      case "ruins":       drawLocRuins(loc.x, dark); break;
      case "cave":        drawLocCave(loc.x, dark); break;
      case "battlefield": drawLocBattlefield(loc.x, dark); break;
      case "watchtower":  drawLocWatchtower(loc.x, dark); break;
      case "altar":       drawLocAltar(loc.x, dark); break;
    }
    const d = dist(player.x, loc.x);
    if (d < 220) {
      const def = LOC_DEFS[loc.type];
      const a = clamp((220 - d) / 120, 0, 1);
      ctx.save(); ctx.globalAlpha = a;
      ctx.font = "bold 13px Trebuchet MS"; ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillText(def.emoji + " " + def.name, loc.x+1, groundY-80+1);
      ctx.fillStyle = (loc.triggered && !loc.cleared) ? "#ff8a6a" : "#f0e6cf";
      ctx.fillText(def.emoji + " " + def.name, loc.x, groundY-80);
      ctx.restore();
    }
  }
}

function stoneCol(dark) { return rgb(lerpColor([96,88,100],[24,22,28],dark)); }
function stoneLt(dark)  { return rgb(lerpColor([136,128,142],[44,40,48],dark)); }
function woodCol(dark)  { return rgb(lerpColor([100,74,44],[26,18,12],dark)); }

function drawLocCamp(x, dark) {
  ctx.fillStyle = rgb(lerpColor([52,44,36],[16,14,18],dark));
  ctx.beginPath(); ctx.ellipse(x,groundY-2,10,4,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = rgb(lerpColor([72,64,54],[20,18,22],dark));
  ctx.beginPath(); ctx.ellipse(x,groundY-3,5.5,2,0,0,Math.PI*2); ctx.fill();
  const tc1 = rgb(lerpColor([64,44,28],[18,12,8],dark));
  ctx.fillStyle = tc1;
  ctx.beginPath(); ctx.moveTo(x-36,groundY-34); ctx.lineTo(x-60,groundY); ctx.lineTo(x-14,groundY); ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.25)";
  ctx.beginPath(); ctx.moveTo(x-36,groundY-34); ctx.lineTo(x-14,groundY); ctx.lineTo(x-26,groundY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = rgb(lerpColor([48,34,20],[14,10,6],dark));
  ctx.beginPath(); ctx.moveTo(x+44,groundY-28); ctx.lineTo(x+22,groundY); ctx.lineTo(x+64,groundY); ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.25)";
  ctx.beginPath(); ctx.moveTo(x+44,groundY-28); ctx.lineTo(x+64,groundY); ctx.lineTo(x+52,groundY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = woodCol(dark);
  ctx.fillRect(x+68,groundY-14,14,14); ctx.fillRect(x+82,groundY-10,10,10);
}

function drawLocWagon(x, dark) {
  ctx.save(); ctx.translate(x,groundY-10); ctx.rotate(0.32);
  ctx.fillStyle = woodCol(dark); ctx.fillRect(-32,-12,64,22);
  ctx.strokeStyle = rgb(lerpColor([56,40,22],[14,10,6],dark)); ctx.lineWidth=2; ctx.strokeRect(-32,-12,64,22);
  ctx.strokeStyle = rgb(lerpColor([72,52,30],[20,14,8],dark)); ctx.lineWidth=1;
  for (let i=-3;i<=3;i++) { ctx.beginPath(); ctx.moveTo(i*9,-12); ctx.lineTo(i*9,10); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = woodCol(dark); ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(x-38,groundY+4,14,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(x+24,groundY-8,12,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle = woodCol(dark); ctx.fillRect(x+50,groundY-10,13,12);
}

function drawLocGrave(x, dark) {
  ctx.fillStyle = stoneCol(dark); ctx.fillRect(x-8,groundY-36,16,36);
  ctx.beginPath(); ctx.arc(x,groundY-36,8,Math.PI,0); ctx.fill();
  ctx.strokeStyle = stoneLt(dark); ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(x,groundY-32); ctx.lineTo(x,groundY-18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x-5,groundY-26); ctx.lineTo(x+5,groundY-26); ctx.stroke();
  const boneC = rgb(lerpColor([192,184,172],[56,52,48],dark));
  ctx.fillStyle = boneC;
  ctx.beginPath(); ctx.ellipse(x-22,groundY-2,7,3,0.3,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x+18,groundY-1,5,2.5,-0.2,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = rgb(lerpColor([74,104,64],[20,30,18],dark));
  ctx.beginPath(); ctx.ellipse(x,groundY-33,5,2,0,0,Math.PI*2); ctx.fill();
}

function drawLocRuins(x, dark) {
  const c = stoneCol(dark), l = stoneLt(dark);
  const col = (cx, h, broken) => {
    ctx.fillStyle=c; ctx.fillRect(cx-7,groundY-h,14,h);
    ctx.fillStyle=l; ctx.fillRect(cx-7,groundY-h,4,h);
    if (!broken) { ctx.fillStyle=c; ctx.fillRect(cx-10,groundY-h-6,20,6); }
    else { ctx.fillStyle=c; ctx.fillRect(cx-5,groundY-h-4,10,4);
      ctx.beginPath(); ctx.moveTo(cx-8,groundY-h); ctx.lineTo(cx+10,groundY-h-8); ctx.lineTo(cx+12,groundY-h+2); ctx.closePath(); ctx.fill(); }
  };
  col(x-58,66,true); col(x-24,82,false); col(x+22,70,true); col(x+56,58,false);
  ctx.fillStyle = c;
  for (const ox of [-42,-12,10,36]) { ctx.beginPath(); ctx.ellipse(x+ox,groundY-3,5+Math.abs(ox%7),3,0,0,Math.PI*2); ctx.fill(); }
  ctx.fillStyle = rgb(lerpColor([74,104,64],[20,30,18],dark));
  for (const ox of [-30,12,44]) { ctx.beginPath(); ctx.ellipse(x+ox,groundY-3,8,3,0,0,Math.PI*2); ctx.fill(); }
}

function drawLocCave(x, dark) {
  ctx.fillStyle = rgb(lerpColor([42,38,48],[14,12,18],dark));
  ctx.beginPath(); ctx.moveTo(x-88,groundY); ctx.quadraticCurveTo(x,groundY-96,x+88,groundY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#080410";
  ctx.beginPath(); ctx.ellipse(x,groundY-26,26,34,0,Math.PI,0); ctx.fill();
  const ig = ctx.createRadialGradient(x,groundY-18,2,x,groundY-22,26);
  ig.addColorStop(0,"rgba(0,0,0,0.95)"); ig.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=ig; ctx.beginPath(); ctx.ellipse(x,groundY-26,26,34,0,Math.PI,0); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation="lighter";
  const eg = 0.45 + dark * 0.45;
  ctx.fillStyle=`rgba(255,60,60,${eg*0.65})`;
  ctx.beginPath(); ctx.arc(x-9,groundY-36,3,0,Math.PI*2); ctx.arc(x+7,groundY-36,3,0,Math.PI*2); ctx.fill();
  ctx.restore();
  const bc = rgb(lerpColor([180,172,160],[52,48,44],dark));
  ctx.fillStyle=bc;
  ctx.beginPath(); ctx.ellipse(x-40,groundY-2,8,3,0.2,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x+34,groundY-1,6,2.5,-0.3,0,Math.PI*2); ctx.fill();
}

function drawLocBattlefield(x, dark) {
  const wd = woodCol(dark), mt = stoneCol(dark);
  const banner = (bx, lean) => {
    ctx.strokeStyle=wd; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(bx,groundY); ctx.lineTo(bx+lean,groundY-62); ctx.stroke();
    ctx.fillStyle=rgb(lerpColor([90,30,30],[28,10,10],dark));
    ctx.beginPath(); ctx.moveTo(bx+lean,groundY-62); ctx.lineTo(bx+lean+18,groundY-54); ctx.lineTo(bx+lean+12,groundY-44); ctx.lineTo(bx+lean,groundY-44); ctx.fill();
  };
  banner(x-68,-8); banner(x+42,6);
  const sword = (sx, ang) => {
    ctx.save(); ctx.translate(sx,groundY); ctx.rotate(ang);
    ctx.strokeStyle=mt; ctx.lineWidth=2.5; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5,-22); ctx.lineTo(5,-22); ctx.stroke();
    ctx.restore();
  };
  sword(x-36,-0.2); sword(x-8,0.15); sword(x+20,-0.1); sword(x+50,0.22);
  ctx.fillStyle=mt; ctx.beginPath(); ctx.ellipse(x-56,groundY-4,10,7,0.3,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=stoneLt(dark); ctx.lineWidth=1; ctx.beginPath(); ctx.ellipse(x-56,groundY-4,10,7,0.3,0,Math.PI*2); ctx.stroke();
}

function drawLocWatchtower(x, dark) {
  const c=stoneCol(dark), l=stoneLt(dark), tw=38;
  ctx.fillStyle=c; ctx.fillRect(x-tw/2,groundY-112,tw,112);
  ctx.fillStyle=l; ctx.fillRect(x-tw/2,groundY-112,tw*0.28,112);
  ctx.fillStyle="rgba(0,0,0,0.18)"; ctx.fillRect(x+tw*0.28,groundY-112,tw*0.22,112);
  ctx.fillStyle=c;
  ctx.beginPath(); ctx.moveTo(x-tw/2,groundY-112); ctx.lineTo(x+4,groundY-112); ctx.lineTo(x+10,groundY-88); ctx.lineTo(x-tw/2,groundY-88); ctx.closePath(); ctx.fill();
  for (const ox of [-28,-14,10,26]) { ctx.fillStyle=c; ctx.beginPath(); ctx.ellipse(x+ox+tw*0.5,groundY-4,6+Math.abs(ox%5),3.5,0,0,Math.PI*2); ctx.fill(); }
  ctx.fillStyle=c; for (let i=0;i<2;i++) ctx.fillRect(x-tw/2+i*(tw*0.4),groundY-120,tw*0.18,9);
  ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillRect(x-4,groundY-74,8,12);
  ctx.strokeStyle=woodCol(dark); ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(x+tw/2,groundY); ctx.lineTo(x+tw/2+22,groundY-36); ctx.stroke();
  for (let i=0;i<4;i++) { const yy=groundY-i*9,xx=x+tw/2+i*6; ctx.beginPath(); ctx.moveTo(xx,yy); ctx.lineTo(xx+9,yy-4); ctx.stroke(); }
  if (dark>0.2) drawTorch(x-tw/2-6,groundY-58);
  ctx.fillStyle=woodCol(dark); ctx.fillRect(x-tw/2-18,groundY-14,16,13);
  ctx.strokeStyle=stoneLt(dark); ctx.lineWidth=1.5; ctx.strokeRect(x-tw/2-18,groundY-14,16,13);
  ctx.beginPath(); ctx.moveTo(x-tw/2-18,groundY-7); ctx.lineTo(x-tw/2-2,groundY-7); ctx.stroke();
}

function drawLocAltar(x, dark) {
  const c=stoneCol(dark);
  const stones=[[-62,0,8,28],[-46,-5,7,22],[20,-5,7,22],[36,0,8,28],[-8,-10,10,36],[14,0,8,20]];
  for (const [ox,dy,w,h] of stones) { ctx.fillStyle=c; ctx.fillRect(x+ox-w/2,groundY-h+dy,w,h-dy); }
  ctx.fillStyle=rgb(lerpColor([76,70,84],[20,18,24],dark));
  ctx.fillRect(x-18,groundY-12,36,12);
  const ga=0.22+0.14*Math.sin(Game.windT*2.3);
  ctx.save(); ctx.globalCompositeOperation="lighter";
  const gr=ctx.createRadialGradient(x,groundY-8,4,x,groundY-8,56);
  gr.addColorStop(0,`rgba(100,140,255,${ga*2})`); gr.addColorStop(1,"rgba(60,80,255,0)");
  ctx.fillStyle=gr; ctx.beginPath(); ctx.ellipse(x,groundY-8,56,28,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=`rgba(100,140,255,${ga})`; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(x,groundY-2,40,0,Math.PI*2); ctx.stroke();
  ctx.restore();
  ctx.fillStyle=rgb(lerpColor([60,94,74],[18,28,22],dark));
  for (const [ox] of stones) { ctx.beginPath(); ctx.ellipse(x+ox,groundY-1,4,2.5,0,0,Math.PI*2); ctx.fill(); }
}

function drawGroundBows() {
  if (!groundBows) return;
  const t = performance.now() / 1000;
  for (const b of groundBows) {
    const bob = Math.sin(t * 2.2 + b.x * 0.01) * 2.5;
    const yy = groundY - 14 + bob;
    const alpha = b.claimed ? 0.35 : 0.7;
    groundShadow(b.x, 8, 0.18);
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(b.x, yy); ctx.rotate(-0.3 + Math.sin(t * 1.1 + b.x * 0.005) * 0.06);
    ctx.strokeStyle = "#8a5a2a"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(0, 0, 8, -1.2, 1.2); ctx.stroke();
    ctx.strokeStyle = "#e8d8a8"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(8 * Math.cos(-1.2), 8 * Math.sin(-1.2)); ctx.lineTo(8 * Math.cos(1.2), 8 * Math.sin(1.2)); ctx.stroke();
    ctx.restore();
    if (!b.claimed) {
      ctx.save(); ctx.globalAlpha = 0.55 + 0.2 * Math.sin(t * 3 + b.x * 0.01);
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "#9bd05a"; ctx.beginPath(); ctx.arc(b.x, yy, 12, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
}

function drawLootItems() {
  if (!lootItems) return;
  const t = performance.now() / 1000;
  for (const it of lootItems) {
    const w = WEAPONS[it.weaponId];
    const bob = Math.sin(t * 2.5 + it.x * 0.01) * 3;
    const yy = groundY - 16 + bob;
    const rc = RARITY_COL[w.rarity];
    ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.2+0.12*Math.sin(t*3+it.x*0.004);
    ctx.fillStyle=rc; ctx.beginPath(); ctx.arc(it.x,yy,14,0,Math.PI*2); ctx.fill(); ctx.restore();
    groundShadow(it.x,9,0.22);
    ctx.save(); ctx.translate(it.x,yy); ctx.rotate(-0.35+Math.sin(t*1.2+it.x*0.005)*0.07);
    ctx.strokeStyle=w.col; ctx.lineWidth=3; ctx.lineCap="round";
    if (w.type==="melee") {
      const len=clamp(w.range*0.28,12,26);
      ctx.beginPath(); ctx.moveTo(-len/2,0); ctx.lineTo(len/2,0); ctx.stroke();
      ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(-len*0.3,-5); ctx.lineTo(-len*0.3,5); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(0,0,9,-1.3,1.3); ctx.stroke();
      ctx.strokeStyle="#e8d8a8"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(9*Math.cos(-1.3),9*Math.sin(-1.3)); ctx.lineTo(9*Math.cos(1.3),9*Math.sin(1.3)); ctx.stroke();
    }
    ctx.restore();
    ctx.save(); ctx.font="10px Trebuchet MS"; ctx.textAlign="center";
    ctx.fillStyle="rgba(0,0,0,0.55)"; ctx.fillText(w.name,it.x+1,groundY-33+1);
    ctx.fillStyle=rc; ctx.fillText(w.name,it.x,groundY-33);
    ctx.restore();
  }
}

function drawOffscreenIndicators() {
  if (!Game.isNight) return;
  for (const e of enemies) {
    if (e.fleeing) continue;
    const sx = e.x - Game.cam;
    if (sx < 0) { ctx.fillStyle = "rgba(255,70,70,0.85)"; ctx.beginPath(); ctx.moveTo(14, groundY - 60); ctx.lineTo(30, groundY - 70); ctx.lineTo(30, groundY - 50); ctx.fill(); }
    else if (sx > W) { ctx.fillStyle = "rgba(255,70,70,0.85)"; ctx.beginPath(); ctx.moveTo(W - 14, groundY - 60); ctx.lineTo(W - 30, groundY - 70); ctx.lineTo(W - 30, groundY - 50); ctx.fill(); }
  }
}

/* ------------------------------------------------------------------ */
/*  UI                                                                 */
/* ------------------------------------------------------------------ */
const UI = {
  hud: document.getElementById("hud"),
  prompt: document.getElementById("prompt"),
  startScreen: document.getElementById("start-screen"),
  endScreen: document.getElementById("end-screen"),
  pauseScreen: document.getElementById("pause-screen"),
  muted: false,
  toggleMute() {
    Audio.init();
    this.muted = !Audio.toggle();
  },
  refresh() {
    document.getElementById("hud-day-text").textContent = "Dag " + Game.day;
    const ph = phaseName();
    document.getElementById("hud-phase-text").textContent = ph;
    document.getElementById("hud-phase-icon").textContent = (ph === "Nat") ? "🌙" : (ph === "Aften" ? "🌆" : ph === "Daggry" ? "🌅" : "☀");
    document.getElementById("hud-base-text").textContent = baseName(base.level);
    document.getElementById("hud-coins-text").textContent = player.coins + "/" + CFG.maxCoinsCarry;
    document.getElementById("hud-hp-text").textContent = Math.max(0, player.hp) + "/" + player.maxHp;
    const arch = units.filter(u => u.role === "archer").length;
    const build = units.filter(u => u.role === "builder").length;
    const peas = units.filter(u => u.role === "peasant").length + units.filter(u => u.role === "farmer").length;
    document.getElementById("hud-pop-text").textContent = (units.length + vagrants.length);
    document.getElementById("hud-arch-text").textContent = arch;
    document.getElementById("hud-build-text").textContent = build;

    // objective
    let obj;
    if (Game.surviveNightForWin) obj = "🎯 Slottet står! Overlev natten for at vinde.";
    else if (base.level < 4) obj = "🎯 Opgradér basen til Slot (niveau " + base.level + "/4)";
    else obj = "🎯 Forsvar riget!";
    if (Game.isNight) obj = "🌙 NAT — " + (Game.nightQuota - enemies.filter(e=>!e.fleeing).length > 0 ? "horden angriber!" : "hold linjen!");
    document.getElementById("hud-objective").textContent = obj;

    // weapon HUD
    const wEl = document.getElementById("hud-weapon-text");
    const wPill = document.getElementById("hud-weapon");
    if (player.weapon) {
      const w = WEAPONS[player.weapon];
      wEl.textContent = w.name + " (" + RARITY_NAME[w.rarity] + ")";
      wPill.style.borderColor = RARITY_COL[w.rarity] + "99";
      wPill.style.color = RARITY_COL[w.rarity];
    } else {
      wEl.textContent = "Intet våben";
      wPill.style.borderColor = ""; wPill.style.color = "";
    }

    // contextual prompt
    let near = null, nd = CFG.payRange;
    for (const s of stations) { const c = s.cost(); if (c <= 0) continue; const d = dist(player.x, s.x()); if (d < nd) { nd = d; near = s; } }
    let vagNear = vagrants.find(v => dist(player.x, v.x) < 46 && Math.abs(v.vx) < 1);
    const nearLoc = locations && locations.find(l => !l.triggered && dist(player.x, l.x) < LOC_DEFS[l.type].trig * 1.6);
    if (near) {
      this.prompt.classList.remove("hidden");
      const prog = near.paid > 0 ? ` (${near.paid}/${near.cost()})` : "";
      this.prompt.innerHTML = `${near.label()} &nbsp;<span class="cost">${near.cost()}🪙</span>${prog} &nbsp;<span class="hold">hold ↓/S</span>`;
    } else if (vagNear) {
      this.prompt.classList.remove("hidden");
      this.prompt.innerHTML = `Rekruttér undersåt &nbsp;<span class="cost">1🪙</span> &nbsp;<span class="hold">hold ↓/S</span>`;
    } else if (nearLoc) {
      const def = LOC_DEFS[nearLoc.type];
      this.prompt.classList.remove("hidden");
      this.prompt.innerHTML = `${def.emoji} <b>${def.name}</b> &nbsp;<span style="color:#ff8a6a">⚠ Fare forude — nærm dig for at udforske</span>`;
    } else this.prompt.classList.add("hidden");
  },
};

/* ------------------------------------------------------------------ */
/*  SAVE / LOAD                                                        */
/* ------------------------------------------------------------------ */
const SAVE_KEY = "kingdom_embers_save_v1";
function saveGame() {
  if (Game.state !== "play") return;
  try {
    const snap = {
      day: Game.day, time: Game.time, treeSeed: Game.treeSeed,
      coins: player.coins, px: player.x, hasCrown: player.hasCrown, hp: player.hp, weapon: player.weapon,
      locations: locations.map(l => ({ triggered:l.triggered, cleared:l.cleared, lootSpawned:l.lootSpawned })),
      base: { level: base.level, hp: base.hp, maxHp: base.maxHp },
      walls: walls.map(w => ({ commissioned: w.commissioned, level: w.level, hp: w.hp, maxHp: w.maxHp, buildProgress: w.buildProgress })),
      units: units.map(u => ({ role: u.role, x: u.x })),
      vagrants: vagrants.length,
      farm: state_farmBuilt,
      goal: Game.surviveNightForWin,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
  } catch (e) {}
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function loadGame() {
  try {
    const snap = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!snap) return false;
    newGame();
    Game.day = snap.day; Game.time = snap.time; Game.treeSeed = snap.treeSeed;
    player.coins = snap.coins; player.x = snap.px; player.hasCrown = snap.hasCrown;
    player.hp = snap.hp || CFG.playerMaxHp;
    player.weapon = snap.weapon || null;
    if (snap.locations) snap.locations.forEach((s,i) => { if (locations[i]) Object.assign(locations[i], s); });
    base.level = snap.base.level; base.hp = snap.base.hp; base.maxHp = snap.base.maxHp;
    walls.forEach((w, i) => { const s = snap.walls[i]; if (s) Object.assign(w, s); });
    units = snap.units.map(s => makeUnit(s.role, s.x));
    vagrants = []; for (let i = 0; i < (snap.vagrants || 0); i++) spawnVagrant();
    state_farmBuilt = snap.farm; Game.surviveNightForWin = snap.goal;
    Game.goalReached = snap.base.level >= 4;
    planNight();
    return true;
  } catch (e) { return false; }
}

/* ------------------------------------------------------------------ */
/*  GAME FLOW                                                          */
/* ------------------------------------------------------------------ */
Game.start = function (continueGame) {
  Audio.init(); Audio.resume();
  if (continueGame && hasSave()) loadGame();
  else newGame();
  treeCache = null;
  Game.state = "play";
  UI.startScreen.classList.add("hidden");
  UI.endScreen.classList.add("hidden");
  UI.hud.classList.remove("hidden");
};
Game.togglePause = function () {
  if (Game.state === "play") { Game.state = "pause"; UI.pauseScreen.classList.remove("hidden"); }
  else if (Game.state === "pause") { Game.state = "play"; UI.pauseScreen.classList.add("hidden"); }
};
function endGame(win, text) {
  Game.state = "end";
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  UI.hud.classList.add("hidden");
  UI.prompt.classList.add("hidden");
  UI.endScreen.classList.remove("hidden");
  document.getElementById("end-title").textContent = win ? "Sejr! 👑" : "Riget faldt";
  document.getElementById("end-title").style.color = win ? "#9bd05a" : "#c1453b";
  document.getElementById("end-text").textContent = text + ` (Du nåede dag ${Game.day}.)`;
  if (win) Audio.upgrade();
}

/* ------------------------------------------------------------------ */
/*  MAIN LOOP                                                          */
/* ------------------------------------------------------------------ */
let last = performance.now();
function loop(now) {
  let dt = (now - last) / 1000;
  last = now;
  dt = clamp(dt, 0, 0.05); // clamp big frame gaps

  DEV.updateStats(dt);

  const gdt = dt * DEV.speedMult; // speed multiplier applied after clamp
  updateFX(gdt); // atmosphere animates in every state (menu included)

  if (Game.state === "play") {
    update(gdt);
    UI.refresh();
  }
  if (Game.state !== "menu") render();
  else renderMenuBackground();

  requestAnimationFrame(loop);
}

function renderMenuBackground() {
  // gentle animated sky behind the menu
  Game.time = (Game.time + 0.00004) % 1;
  if (!player) { player = makePlayer(); base = makeBase(); walls = WALL_SLOTS.map(makeWall);
    units = []; vagrants = []; enemies = []; coins = []; arrows = []; animals = []; particles = []; floatTexts = [];
    portals = PORTALS.map(p => ({ ...p })); }
  render();
}

/* ------------------------------------------------------------------ */
/*  WIRE UP UI BUTTONS                                                 */
/* ------------------------------------------------------------------ */
document.getElementById("btn-start").addEventListener("click", () => Game.start(false));
document.getElementById("btn-continue").addEventListener("click", () => Game.start(true));
document.getElementById("btn-restart").addEventListener("click", () => Game.start(false));

// reveal continue if a save exists
if (hasSave()) document.getElementById("btn-continue").classList.remove("hidden");

/* ------------------------------------------------------------------ */
/*  DEV TOOLS                                                          */
/* ------------------------------------------------------------------ */
const DEV = {
  godMode: false,
  speedMult: 1,
  _fps: 60,

  toggle() {
    document.getElementById("dev-panel").classList.toggle("hidden");
  },

  addCoins(n) {
    if (Game.state !== "play") return;
    player.coins = clamp(player.coins + n, 0, CFG.maxCoinsCarry);
    floaty(player.x, "+" + n + "🪙", "#f2c14e");
  },

  skipToNight() {
    if (Game.state !== "play") return;
    Game.time = CFG.phases.dusk + 0.005;
    floaty(base.x, "→ Nat 🌙", "#cfe6f2");
  },

  skipToDay() {
    if (Game.state !== "play") return;
    Game.time = 0.02;
    Game.day++;
    planNight();
    if (enemies) enemies.forEach(e => e.fleeing = true);
    floaty(base.x, "→ Dag ☀", "#f2c14e");
  },

  upgradeBase() {
    if (Game.state !== "play" || base.level >= 4) return;
    upgradeBase();
  },

  healAll() {
    if (Game.state !== "play") return;
    player.hp = player.maxHp;
    base.hp = base.maxHp;
    if (units) units.forEach(u => u.hp = u.maxHp);
    if (walls) walls.forEach(w => { if (w.commissioned && w.buildProgress >= 1) w.hp = w.maxHp; });
    floaty(base.x, "💚 Helbredt!", "#9bd05a");
  },

  doSpawnEnemy(type) {
    if (Game.state !== "play") return;
    spawnEnemy(type, pick(portals));
    floaty(portals[0].x, "👹 " + type + "!", "#ff6a4a");
  },

  killAll() {
    if (Game.state !== "play") return;
    const n = enemies.length;
    enemies.length = 0;
    floaty(base.x, "💀 " + n + " fjender!", "#f2c14e");
  },

  toggleGodMode() {
    this.godMode = !this.godMode;
    const btn = document.getElementById("dev-god-btn");
    btn.textContent = "God mode: " + (this.godMode ? "🟢 TIL" : "⚫ FRA");
    btn.classList.toggle("dev-active", this.godMode);
    if (player) floaty(player.x, this.godMode ? "🛡 Uspårbar" : "🛡 Sårbar igen", "#cfe6f2");
  },

  setSpeed(mult) {
    this.speedMult = mult;
    document.querySelectorAll(".dev-speed-btn").forEach(b => b.classList.remove("dev-active"));
    document.getElementById("dev-spd-" + mult).classList.add("dev-active");
  },

  giveWeapon(weaponId) {
    if (Game.state !== "play") return;
    pickupWeapon(weaponId);
  },

  updateStats(dt) {
    this._fps += (1 / Math.max(dt, 0.001) - this._fps) * 0.08;
    const el = document.getElementById("dev-stats");
    if (!el || document.getElementById("dev-panel").classList.contains("hidden")) return;
    const arch  = units ? units.filter(u => u.role === "archer").length : 0;
    const build = units ? units.filter(u => u.role === "builder").length : 0;
    const farm  = units ? units.filter(u => u.role === "farmer").length : 0;
    el.innerHTML =
      `FPS: <b>${Math.round(this._fps)}</b> &nbsp;|&nbsp; Dag: <b>${Game.day}</b> &nbsp;t: <b>${Game.time.toFixed(3)}</b><br>` +
      `Fjender: <b>${enemies ? enemies.length : 0}</b> &nbsp;|&nbsp; Enheder: <b>${units ? units.length : 0}</b> (🏹${arch} 🔨${build} 🌾${farm})<br>` +
      `Mønter (jord): <b>${coins ? coins.length : 0}</b> &nbsp;|&nbsp; Partikler: <b>${particles ? particles.length : 0}</b><br>` +
      `Spiller X: <b>${player ? Math.round(player.x) : "-"}</b> &nbsp;|&nbsp; Kamera: <b>${Math.round(Game.cam)}</b>`;
  },
};

/* ------------------------------------------------------------------ */
/*  BOOT                                                               */
/* ------------------------------------------------------------------ */
resize();
initFX();
Game.cam = clamp(CFG.baseX - W / 2, 0, Math.max(0, CFG.worldWidth - W));
requestAnimationFrame(loop);
