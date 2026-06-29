"use strict";

// ---------- Bootstrap ----------
import { CFG, WALL_SLOTS, PORTALS, STATIONS_X } from './config/config.js';
import { clamp, dist, lerp, rand, randInt, pick } from './util/math.js';
import { canvas, ctx, W, H, groundY, resize } from './canvas.js';
import { Game, state } from './state.js';

import { Audio } from './systems/Audio.js';
import { keys } from './systems/Input.js';
import { saveGame, hasSave, loadGame, deleteSave } from './systems/SaveSystem.js';
import { updateSpawning, floaty, spawnParticles, spawnAnimal, planNight, buildLocations, spawnEnemy } from './systems/SpawnSystem.js';
import { updatePayment, updateCoins } from './systems/Economy.js';
import { updateUnits, updateAssignments, updateVagrants, updateAnimals, nearestEnemy, updateCaltrops } from './systems/AI.js';
import { updateEnemies, updateArrows, updatePlayerAttack, updateSpells, updateLegendaryEffects, updatePoisonShots } from './systems/Combat.js';

import { FX, initFX, updateFX as updateFXEffects, biomeAt } from './rendering/Effects.js';
import { render, drawEntityShadows } from './rendering/Renderer.js';
import { UI, DEV, baseName } from './rendering/HUD.js';

import { makePlayer } from './entities/Player.js';
import { makeWall } from './entities/Wall.js';
import { makeUnit } from './entities/Unit.js';

import { WEAPON_SHOP, ARMOR_SHOP, setPickupWeapon as setShopPickupWeapon } from './systems/ShopSystem.js';
import { upgradeBase, pickupWeapon, setBuildStations } from './util/GameStateHelpers.js';
import { addXP, checkUpgrade } from './systems/UpgradeSystem.js';
import { newGame, buildStations } from './systems/GameInit.js';
import { updateLocations, setAddXP } from './systems/LocationSystem.js';
import { updateLootItems, updateWeaponPickup, updateChests, updateLootPhysics, setPickupWeapon as setLootPickupWeapon } from './systems/LootSystem.js';
import { setupInputHandlers } from './systems/InputHandler.js';

// Setup callbacks between modules to avoid circular dependencies
setBuildStations(buildStations);
setShopPickupWeapon(pickupWeapon);
setLootPickupWeapon(pickupWeapon);
setAddXP(addXP);

// Make keys and shop data available to other systems via window
window._KEYS = keys;
window._DEV_GOD_MODE = false;
window._floaty = floaty;
window._WEAPON_SHOP = WEAPON_SHOP;
window._ARMOR_SHOP  = ARMOR_SHOP;
window._SHOP_ITEMS = WEAPON_SHOP;
window._upgradeBase = upgradeBase;
window._pickupWeapon = pickupWeapon;
window._addXP = addXP;

// ---------- Update ----------
function updateTime(dt) {
  Game.time += dt / CFG.dayLength;
  if (Game.time >= 1) { Game.time -= 1; Game.day++; planNight(); }
  const t = Game.time;
  const nowNight = t > CFG.phases.dusk && t <= CFG.phases.night;
  if (nowNight && !Game.isNight) {
    Game.isNight=true; Audio.horn(); Audio.setNight(true);
  }
  if (!nowNight && Game.isNight) {
    Game.isNight=false; Audio.setNight(false); state.enemies.forEach(e=>e.fleeing=true);
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
  if ((keys[" "] || keys["space"]) && player.jumpH <= 0 && player.jumpVy <= 0) {
    player.jumpVy = 560;
  }
  player.jumpH += player.jumpVy * dt;
  player.jumpVy -= 1400 * dt;
  if (player.jumpH <= 0) { player.jumpH = 0; if (player.jumpVy < 0) player.jumpVy = 0; }
  if (player.invuln>0) player.invuln-=dt;
  if (player.hurt>0) player.hurt-=dt;
  if (player.hpShowTimer>0) player.hpShowTimer-=dt;
  if (player.hp<player.maxHp) {
    if (!nearestEnemy(player.x,220)) { player.regen+=dt; if (player.regen>=CFG.playerRegenTime) { player.regen=0; player.hp++; floaty(player.x,"+❤","#e0556a"); } }
    else player.regen=0;
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

function updateFloats(dt) {
  const { floatTexts } = state;
  for (let i=floatTexts.length-1;i>=0;i--) {
    const f=floatTexts[i]; f.life-=dt; f.y+=f.vy*dt; f.vy*=0.96;
    if (f.life<=0) floatTexts.splice(i,1);
  }
}

function updateCamera() {
  const zoom = Game.zoom;
  const target=clamp(state.player.x-W/2, 0, Math.max(0, CFG.worldWidth - W/zoom));
  Game.cam+=(target-Game.cam)*0.12;
}

function updatePortals() {
  if (Game.isNight) return;
  const { portals, player } = state;
  for (const p of portals) {
    if ((p.lastDayActivated||0) >= Game.day) continue;
    if (dist(player.x, p.x) < 300) {
      p.lastDayActivated = Game.day;
      const count = 2 + (Game.day > 5 ? 1 : 0);
      for (let i=0; i<count; i++) spawnEnemy(pick(["imp","runner","crawler","raider"]), p);
      floaty(p.x, "⚠ Portalvagter!", "#ff8a6a");
    }
  }
}

function checkEndConditions() {
  const { base, player } = state;
  if (base.hp<=0 && Game.state==="play") {
    Game.state="defeat-pan";
    Game.defeatText="Dit slot blev jævnet med jorden. Mørket sluger riget.";
    Game.defeatPanTimer=0;
    return;
  }
  if (player.hp<=0) { endGame("Monarken faldt i kamp, og kronen rullede i mulden. Riget er fortabt."); return; }
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
  updateLocations(dt);
  updatePortals();
  updateCaltrops(dt);
  updateEnemies(dt);
  updateArrows(dt);
  updateSpells(dt);
  updatePoisonShots(dt);
  updateLegendaryEffects(dt);
  updateCoins(dt);
  updateLootItems(dt);
  updateChests(dt);
  updateLootPhysics(dt);
  updateWeaponPickup(dt);
  updateParticles(dt);
  if (Game.screenShake > 0) Game.screenShake = Math.max(0, Game.screenShake - dt * 9);
  updateFloats(dt);
  updateSpawning(dt);
  checkUpgrade();
  updateCamera();
  checkEndConditions();
  updateAutosave(dt);
}

// ---------- Game flow ----------
Game.start = function(continueGame) {
  Audio.init(); Audio.resume();
  const activeDiff = document.querySelector('.diff-btn.diff-active');
  const diff = activeDiff ? activeDiff.dataset.diff : 'normal';
  if (diff === 'easy')      { Game.diffMult = 0.65; Game.rarityBonus = 1; }
  else if (diff === 'hard') { Game.diffMult = 1.65; Game.rarityBonus = 1; }
  else                      { Game.diffMult = 1.0;  Game.rarityBonus = 0; }
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

function endGame(text) {
  Game.state="end"; deleteSave();
  UI.hud.classList.add("hidden"); UI.prompt.classList.add("hidden");
  UI.endScreen.classList.remove("hidden");
  document.getElementById("end-title").textContent = "Riget faldt";
  document.getElementById("end-title").style.color  = "#c1453b";
  document.getElementById("end-text").textContent   = text+` (Du nåede dag ${Game.day}.)`;
}

// ---------- Main loop ----------
let last = performance.now();
function loop(now) {
  let dt = (now - last) / 1000;
  last = now;
  dt = clamp(dt, 0, 0.05);

  DEV.updateStats(dt);
  const gdt = dt * DEV.speedMult;
  updateFXEffects(gdt);

  if (Game.state === "play") { if (!Game.upgradeMenuOpen) update(gdt); UI.refresh(); }
  if (Game.state === "defeat-pan") {
    Game.defeatPanTimer += dt;
    const zoom = Game.zoom;
    const target = clamp(state.base.x - W / (2 * zoom), 0, Math.max(0, CFG.worldWidth - W / zoom));
    Game.cam += (target - Game.cam) * Math.min(1, dt * 2.5);
    if (Game.defeatPanTimer > 2.2) endGame(Game.defeatText);
  }
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

// ---------- Boot ----------
resize();
initFX();
Game.cam = clamp(CFG.baseX - W/2, 0, Math.max(0, CFG.worldWidth - W));
setupInputHandlers();
requestAnimationFrame(loop);
