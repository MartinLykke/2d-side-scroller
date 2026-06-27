"use strict";

// ---------- Bootstrap ----------
import { CFG, WALL_SLOTS, PORTALS, STATIONS_X } from './config/config.js';
import { WEAPONS, RARITY_COL } from './config/weapons.js';
import { ENEMY_TYPES } from './config/enemies.js';
import { LOC_DEFS } from './config/locations.js';
import { clamp, dist, rand, randInt, pick } from './util/math.js';
import { canvas, ctx, W, H, groundY, resize } from './canvas.js';
import { Game, state } from './state.js';

import { Audio } from './systems/Audio.js';
import { keys } from './systems/Input.js';
import { saveGame, hasSave, loadGame, deleteSave } from './systems/SaveSystem.js';
import { updateSpawning, planNight, spawnCoin, floaty, spawnParticles, spawnVagrant, spawnAnimal, spawnEnemy, buildLocations, spawnLocLoot } from './systems/SpawnSystem.js';
import { updatePayment, updateCoins } from './systems/Economy.js';
import { updateUnits, updateAssignments, updateVagrants, updateAnimals, nearestEnemy } from './systems/AI.js';
import { updateEnemies, updateArrows, updatePlayerAttack, killEnemy } from './systems/Combat.js';

import { FX, initFX, updateFX, biomeAt } from './rendering/Effects.js';
import { render, drawEntityShadows } from './rendering/Renderer.js';
import { UI, DEV, baseName } from './rendering/HUD.js';

import { makePlayer } from './entities/Player.js';
import { makeWall, wallHeight } from './entities/Wall.js';
import { makeUnit } from './entities/Unit.js';

// Make keys available to AI system via window (avoids a circular dep)
window._KEYS = keys;
window._DEV_GOD_MODE = false;

// ---------- Game state helpers (exposed for DEV) ----------
function upgradeBase() {
  const { base } = state;
  if (base.level >= 4) return;
  base.level++;
  base.maxHp = CFG.baseMaxHp[base.level];
  base.hp    = base.maxHp;
  base.flash = 1;
  floaty(base.x, "🏰 " + baseName(base.level) + "!");
  Audio.upgrade();
  if (base.level === 4) { Game.goalReached = true; Game.surviveNightForWin = true; }
}
window._upgradeBase = upgradeBase;

function pickupWeapon(weaponId) {
  const { player, lootItems } = state;
  if (player.weapon) lootItems.push({ x: player.x + rand(-20, 20), weaponId: player.weapon });
  player.weapon = weaponId;
  const w = WEAPONS[weaponId];
  floaty(player.x, "⚔ " + w.name, RARITY_COL[w.rarity]);
  Audio.upgrade();
}
window._pickupWeapon = pickupWeapon;

// ---------- Stations ----------
function buildStations() {
  const { base, walls } = state;
  state.stations = [];

  state.stations.push({
    id:"base", x:()=>base.x, paid:0,
    cost:()=>base.level<4?CFG.baseUpgradeCost[base.level]:0,
    label:()=>base.level<4?`Opgradér ${baseName(base.level)} → ${baseName(base.level+1)}`:"Slottet er fuldt udbygget",
    onPaid:()=>upgradeBase(),
  });
  state.stations.push({
    id:"bow", x:()=>STATIONS_X.bow, paid:0,
    cost:()=>CFG.bowCost,
    label:()=>"Køb bue (skab en bueskytte)",
    onPaid:()=>{ state.groundBows.push({ x:STATIONS_X.bow+rand(-12,12), claimed:false }); floaty(STATIONS_X.bow,"🏹 Bue klar!"); Audio.recruit(); },
  });
  state.stations.push({
    id:"hammer", x:()=>STATIONS_X.hammer, paid:0,
    cost:()=>CFG.hammerCost,
    label:()=>"Køb hammer (skab en bygger)",
    onPaid:()=>{ state.pendingHammers++; floaty(STATIONS_X.hammer,"🔨 Hammer klar"); Audio.recruit(); },
  });
  state.stations.push({
    id:"farm", x:()=>STATIONS_X.farm, paid:0,
    cost:()=>state.farmBuilt?0:CFG.farmCost,
    label:()=>state.farmBuilt?"Gården producerer guld":"Byg gård (passiv guldindkomst)",
    onPaid:()=>{ state.farmBuilt=true; state.pendingFarmers++; floaty(STATIONS_X.farm,"🌾 Gård bygget"); Audio.build(); },
  });
  walls.forEach(w=>{
    state.stations.push({
      id:"wall", wall:w, x:()=>w.x, paid:0,
      cost:()=>{ if (!w.commissioned) return CFG.wallCost; if (w.level<2&&w.buildProgress>=1) return CFG.wallUpgradeCost; return 0; },
      label:()=>{ if (!w.commissioned) return "Byg mur"; if (w.buildProgress<1) return "Bygges..."; if (w.level<2) return "Opgradér mur → sten"; return "Mur (maks)"; },
      onPaid:()=>{
        if (!w.commissioned) { w.commissioned=true; w.level=1; w.maxHp=CFG.wallHp[1]; w.hp=0; w.buildProgress=0; floaty(w.x,"🚧 Mur bestilt"); }
        else if (w.level<2) { w.level=2; w.maxHp=CFG.wallHp[2]; w.buildProgress=clamp(w.hp/w.maxHp,0.2,1); floaty(w.x,"⛰ Stenmur"); }
        Audio.build();
      },
    });
  });
}

// ---------- New game ----------
function newGame() {
  state.player   = makePlayer();
  state.base     = { x:CFG.baseX, level:1, hp:CFG.baseMaxHp[1], maxHp:CFG.baseMaxHp[1], paid:0, flash:0 };
  state.units    = []; state.vagrants = []; state.enemies = []; state.coins  = [];
  state.arrows   = []; state.animals  = []; state.particles=[]; state.floatTexts=[];
  state.portals  = PORTALS.map(p=>({...p}));
  state.walls    = WALL_SLOTS.map(makeWall);
  state.pendingHammers = 0; state.pendingFarmers = 0; state.farmBuilt = false;
  state.groundBows     = []; state.lootItems      = [];
  state.payCooldown    = 0;  state.lastPaidStation = null;
  state.vagrantTimer   = 1;  state.animalTimer     = 2;

  Game.treeSeed = randInt(1, 99999);
  buildStations(); buildLocations();

  Game.time=0.06; Game.day=1; Game.isNight=false; Game.wasNight=false;
  Game.goalReached=false; Game.surviveNightForWin=false;
  Game.winNightActive=false; Game.pendingWin=false; Game.autosaveTimer=0;

  // seed starting coins + vagrants
  for (let i=0;i<6;i++) state.coins.push({ x:CFG.baseX+rand(-200,200), y:groundY, vy:0, value:1, settled:true, life:9999, magnet:false, vx:0 });
  for (let i=0;i<3;i++) spawnVagrant();
  for (let i=0;i<4;i++) spawnAnimal();
  planNight();
}

// ---------- Update ----------
function updateTime(dt) {
  Game.time += dt / CFG.dayLength;
  if (Game.time >= 1) { Game.time -= 1; Game.day++; planNight(); }
  const t = Game.time;
  const nowNight = t > CFG.phases.dusk && t <= CFG.phases.night;
  if (nowNight && !Game.isNight) {
    Game.isNight=true; Audio.horn(); Audio.setNight(true);
    if (Game.surviveNightForWin) Game.winNightActive=true;
  }
  if (!nowNight && Game.isNight) {
    Game.isNight=false; Audio.setNight(false); state.enemies.forEach(e=>e.fleeing=true);
    if (Game.winNightActive) { Game.winNightActive=false; Game.pendingWin=true; }
  }
}

function updatePlayer(dt) {
  const { player } = state;
  const left=keys["a"]||keys["arrowleft"], right=keys["d"]||keys["arrowright"], sprint=keys["shift"];
  const speed=sprint?CFG.playerSprint:CFG.playerSpeed;
  let move=0; if (left) move-=1; if (right) move+=1;
  player.vx=move*speed;
  player.x=clamp(player.x+player.vx*dt, 120, CFG.worldWidth-120);
  if (move!==0) { player.dir=move; player.gallop+=dt*(sprint?16:10); player.bob=Math.abs(Math.sin(player.gallop))*3; }
  else player.bob*=0.9;
  if (player.knock) { player.x=clamp(player.x+player.knock*dt,120,CFG.worldWidth-120); player.knock*=0.86; if (Math.abs(player.knock)<6) player.knock=0; }
  if (player.invuln>0) player.invuln-=dt;
  if (player.hurt>0) player.hurt-=dt;
  if (player.hp<player.maxHp) {
    if (!nearestEnemy(player.x,220)) { player.regen+=dt; if (player.regen>=CFG.playerRegenTime) { player.regen=0; player.hp++; floaty(player.x,"+❤","#e0556a"); } }
    else player.regen=0;
  }
}

function updateLocations() {
  const { locations, player } = state;
  for (let i=0;i<locations.length;i++) {
    const loc=locations[i];
    if (loc.triggered) continue;
    if (dist(player.x,loc.x)<LOC_DEFS[loc.type].trig) triggerLocation(loc,i);
  }
}

function triggerLocation(loc, idx) {
  loc.triggered=true;
  const def=LOC_DEFS[loc.type];
  if (loc.enemyCount===0) { spawnLocLoot(loc); return; }
  loc.remainingEnemies=loc.enemyCount;
  for (let i=0;i<loc.enemyCount;i++) {
    const type=pick(def.etype), ex=loc.x+(i%2===0?-1:1)*(28+i*18);
    state.enemies.push({ x:ex, vx:0, type, hp:ENEMY_TYPES[type].hp, maxHp:ENEMY_TYPES[type].hp, dir:state.player.x<ex?-1:1, attackCd:0, carry:0, anim:rand(0,6), flash:0, fleeing:false, portal:null, locIdx:idx, home:loc.x });
  }
  floaty(loc.x, LOC_DEFS[loc.type].emoji+" "+LOC_DEFS[loc.type].name+"!", "#ff8a6a");
}

function updateLootItems() {
  const { lootItems, player } = state;
  for (let i=lootItems.length-1;i>=0;i--) {
    const it=lootItems[i];
    if (dist(it.x,player.x)<34) { pickupWeapon(it.weaponId); lootItems.splice(i,1); }
  }
}

function updateParticles(dt) {
  const { particles } = state;
  for (let i=particles.length-1;i>=0;i--) {
    const p=particles[i];
    if (p.fly) { p.t+=dt/p.life; p.x=lerp(p.fromX,p.toX,clamp(p.t,0,1)); p.y=lerp(p.fromY,p.toY,clamp(p.t,0,1))-Math.sin(clamp(p.t,0,1)*Math.PI)*50; if (p.t>=1) particles.splice(i,1); continue; }
    p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=240*dt;
    if (p.life<=0) particles.splice(i,1);
  }
}

function lerp(a,b,t) { return a+(b-a)*t; }

function updateFloats(dt) {
  const { floatTexts } = state;
  for (let i=floatTexts.length-1;i>=0;i--) {
    const f=floatTexts[i]; f.life-=dt; f.y+=f.vy*dt; f.vy*=0.96;
    if (f.life<=0) floatTexts.splice(i,1);
  }
}

function updateCamera() {
  const target=clamp(state.player.x-W/2, 0, Math.max(0,CFG.worldWidth-W));
  Game.cam+=(target-Game.cam)*0.12;
}

function checkEndConditions() {
  const { base, player } = state;
  if (base.hp<=0) { endGame(false,"Dit slot blev jævnet med jorden. Mørket sluger riget."); return; }
  if (player.hp<=0) { endGame(false,"Monarken faldt i kamp, og kronen rullede i mulden. Riget er fortabt."); return; }
  if (Game.pendingWin) { endGame(true,"Dit slot står, og horderne er drevet tilbage. Riget er sikret — længe leve monarken!"); }
}

function updateAutosave(dt) {
  Game.autosaveTimer-=dt;
  if (Game.autosaveTimer<=0) { Game.autosaveTimer=5; saveGame(); }
}

function update(dt) {
  updateTime(dt);
  updatePlayer(dt);
  updatePlayerAttack(dt);
  updatePayment(dt);
  updateVagrants(dt);
  updateAssignments();
  updateUnits(dt);
  updateAnimals(dt);
  updateLocations();
  updateEnemies(dt);
  updateArrows(dt);
  updateCoins(dt);
  updateLootItems();
  updateParticles(dt);
  updateFloats(dt);
  updateSpawning(dt);
  updateCamera();
  checkEndConditions();
  updateAutosave(dt);
}

// ---------- Game flow ----------
Game.start = function(continueGame) {
  Audio.init(); Audio.resume();
  if (continueGame && hasSave()) { newGame(); loadGame(); }
  else newGame();
  import('./rendering/Effects.js').then(({clearTreeCache})=>clearTreeCache());
  Game.state="play";
  UI.startScreen.classList.add("hidden");
  UI.endScreen.classList.add("hidden");
  UI.hud.classList.remove("hidden");
};

Game.togglePause = function() {
  if (Game.state==="play") { Game.state="pause"; UI.pauseScreen.classList.remove("hidden"); }
  else if (Game.state==="pause") { Game.state="play"; UI.pauseScreen.classList.add("hidden"); }
};

function endGame(win, text) {
  Game.state="end"; deleteSave();
  UI.hud.classList.add("hidden"); UI.prompt.classList.add("hidden");
  UI.endScreen.classList.remove("hidden");
  document.getElementById("end-title").textContent = win?"Sejr! 👑":"Riget faldt";
  document.getElementById("end-title").style.color  = win?"#9bd05a":"#c1453b";
  document.getElementById("end-text").textContent   = text+` (Du nåede dag ${Game.day}.)`;
  if (win) Audio.upgrade();
}

// ---------- Main loop ----------
let last = performance.now();
function loop(now) {
  let dt = (now - last) / 1000;
  last = now;
  dt = clamp(dt, 0, 0.05);

  DEV.updateStats(dt);
  const gdt = dt * DEV.speedMult;
  updateFX(gdt);

  if (Game.state === "play") { update(gdt); UI.refresh(); }
  if (Game.state !== "menu") render();
  else renderMenuBackground();

  requestAnimationFrame(loop);
}

function renderMenuBackground() {
  Game.time = (Game.time + 0.00004) % 1;
  if (!state.player) {
    state.player = makePlayer();
    state.base   = { x:CFG.baseX, level:1, hp:CFG.baseMaxHp[1], maxHp:CFG.baseMaxHp[1], paid:0, flash:0 };
    state.walls  = WALL_SLOTS.map(makeWall);
    state.units=[]; state.vagrants=[]; state.enemies=[]; state.coins=[];
    state.arrows=[]; state.animals=[]; state.particles=[]; state.floatTexts=[];
    state.portals=PORTALS.map(p=>({...p}));
  }
  render();
}

// ---------- UI buttons ----------
document.getElementById("btn-start").addEventListener("click", ()=>Game.start(false));
document.getElementById("btn-continue").addEventListener("click", ()=>Game.start(true));
document.getElementById("btn-restart").addEventListener("click", ()=>Game.start(false));

if (hasSave()) document.getElementById("btn-continue").classList.remove("hidden");

// Keyboard shortcuts for M (mute), P (pause), ` (dev)
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k==="m") UI.toggleMute();
  if (k==="p") { if (Game.state==="play"||Game.state==="pause") Game.togglePause(); }
  if (e.key==="`") DEV.toggle();
});

// ---------- Boot ----------
resize();
initFX();
Game.cam = clamp(CFG.baseX - W/2, 0, Math.max(0, CFG.worldWidth - W));
requestAnimationFrame(loop);
