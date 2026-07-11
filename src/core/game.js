"use strict";

// ---------- Bootstrap ----------
import { CFG, WALL_SLOTS, PORTALS, STATIONS_X, MINE, FOREST } from '../config/config.js';
import { clamp, dist, lerp, rand, randInt, pick } from '../util/math.js';
import { canvas, ctx, W, H, groundY, resize } from './canvas.js';
import { Game, state } from './state.js';

import { Audio } from '../systems/infrastructure/Audio.js';
import { keys } from '../systems/input/Input.js';
import { saveGame, hasSave, loadGame, deleteSave } from '../systems/infrastructure/SaveSystem.js';
import { updateSpawning, floaty, spawnParticles, spawnAnimal, planNight, spawnEnemy } from '../systems/world/SpawnSystem.js';
import { updatePayment, updateCoins } from '../systems/economy/Economy.js';
import { updateForestTrees, updateForestCamps } from '../systems/world/ForestSystem.js';
import { updateMine } from '../systems/world/MineSystem.js';
import { updateBuildings } from '../systems/world/OutpostSystem.js';
import { updateUnits, updateAssignments, updateVagrants, updateAnimals, nearestEnemy, updateCaltrops } from '../systems/ai/AI.js';
import { updateEnemies, updateArrows, updatePlayerAttack, updateSpells } from '../systems/combat/Combat.js';
import { updateFirePools } from '../systems/ai/BossAI.js';
import { updateDyingEnemies } from '../util/EnemyUtils.js';

import { FX, initFX, updateFX as updateFXEffects, biomeAt } from '../rendering/Effects.js';
import { render, drawEntityShadows } from '../rendering/Renderer.js';
import { UI, DEV, baseName } from '../rendering/HUD.js';
import { updateArcherShoot } from '../rendering/sprites/Archer.js';

import { makePlayer } from '../entities/Player.js';
import { makeWall } from '../entities/Wall.js';
import { makeUnit } from '../entities/Unit.js';

import { WEAPON_SHOP, ARMOR_SHOP, setPickupWeapon as setShopPickupWeapon } from '../systems/economy/ShopSystem.js';
import { upgradeBase, pickupWeapon, setBuildStations } from '../util/GameStateHelpers.js';
import { addXP, checkUpgrade } from '../systems/economy/UpgradeSystem.js';
import { newGame, buildStations } from '../systems/infrastructure/GameInit.js';
import { initMeta, enterDeathHub, updateHub, updateHubTransition, renderHub } from '../systems/infrastructure/RoguelikeSystem.js';
import { updateLootItems, updateWeaponPickup, updateChests, updateLootPhysics, setPickupWeapon as setLootPickupWeapon } from '../systems/economy/LootSystem.js';
import { setupInputHandlers } from '../systems/input/InputHandler.js';

// Setup callbacks between modules to avoid circular dependencies
setBuildStations(buildStations);
setShopPickupWeapon(pickupWeapon);
setLootPickupWeapon(pickupWeapon);
// Make keys and shop data available to other systems via window
window._KEYS = keys;
window._DEV_GOD_MODE = false;
window._floaty = floaty;
window._WEAPON_SHOP = WEAPON_SHOP;
window._ARMOR_SHOP  = ARMOR_SHOP;

window._upgradeBase = upgradeBase;
window._pickupWeapon = pickupWeapon;
window._addXP = addXP;
window._enterDeathHub = enterDeathHub;

// ---------- Update ----------
function updateTime(dt) {
  const timeScale = Game.isNight && Game.nightCleared ? (CFG.nightClearTimeScale || 1) : 1;
  Game.time += (dt / CFG.dayLength) * timeScale;
  if (Game.isNight && Game.nightCleared && Game.time > CFG.phases.night) {
    Game.time = CFG.phases.night + 0.0001;
  }
  if (Game.time >= 1) { Game.time -= 1; Game.day++; planNight(); }
  const t = Game.time;
  const nowNight = t > CFG.phases.dusk && t <= CFG.phases.night;
  if (nowNight && !Game.isNight) {
    Game.isNight=true; Game.nightCleared=false; Audio.horn(); Audio.portalSpawn(); Audio.setNight(true);
  }
  if (!nowNight && Game.isNight) {
    Game.isNight=false; Game.nightCleared=false; Audio.setNight(false); state.enemies.forEach(e=>e.fleeing=true);
  }
}

function updateNightClear() {
  if (!Game.isNight || Game.nightCleared || Game.nightSpawned < Game.nightQuota) return;
  const waveAlive = state.enemies.some(e => e.nightWave && !e.fleeing && !e.dying && e.hp > 0);
  if (waveAlive) return;
  Game.nightCleared = true;
  floaty(state.base.x, "The wave is defeated - dawn approaches", "#ffd27a", 18);
}

function updatePlayer(dt) {
  const { player } = state;
  const left=keys["a"]||keys["arrowleft"], right=keys["d"]||keys["arrowright"], sprint=keys["shift"];
  const speed=sprint?CFG.playerSprint:CFG.playerSpeed;
  let move=0; if (left) move-=1; if (right) move+=1;
  player.vx=move*speed;
  if (Game.inMine) player.x=clamp(player.x+player.vx*dt, state.mineActiveLeft+24, state.mineActiveRight-24);
  else player.x=clamp(player.x+player.vx*dt, 120, CFG.worldWidth-120);
  if (move!==0) { player.dir=move; player.gallop+=dt*(sprint?16:10); player.bob=Math.abs(Math.sin(player.gallop))*3; }
  else player.bob*=0.9;
  if (player.knock) { player.x=clamp(player.x+player.knock*dt,120,CFG.worldWidth-120); player.knock*=0.86; if (Math.abs(player.knock)<6) player.knock=0; }
  if ((keys[" "] || keys["space"]) && player.jumpH <= 0 && player.jumpVy <= 0) {
    player.jumpVy = 560;
  }
  player.jumpH += player.jumpVy * dt;
  player.jumpVy -= 1400 * dt;
  // low tunnel ceiling: cap the jump while underground
  if (Game.inMine && player.jumpH > 46) { player.jumpH = 46; if (player.jumpVy > 0) player.jumpVy = 0; }
  if (player.jumpH <= 0) { player.jumpH = 0; if (player.jumpVy < 0) player.jumpVy = 0; }
  if (player.invuln>0) player.invuln-=dt;
  if (player.hurt>0) player.hurt-=dt;
  if (player.hpShowTimer>0) player.hpShowTimer-=dt;
  if (player.hp<player.maxHp) {
    if (!nearestEnemy(player.x,220)) {
      const regenTime = CFG.playerRegenTime * (1 - (player.permanentRegenBonus || 0));
      player.regen+=dt;
      if (player.regen>=Math.max(2.5, regenTime)) { player.regen=0; player.hp++; floaty(player.x,"+❤","#e0556a"); }
    }
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
  // keep the mine floor on screen while the player is underground
  if (Game.inMine && Game.zoom > 1.25) Game.zoom = 1.25;
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
      for (let i=0; i<count; i++) spawnEnemy("imp", p);
    }
  }
}

function checkEndConditions() {
  const { base, player } = state;
  if (base.hp<=0 && Game.state==="play") {
    Game.inMine=false;
    Game.state="defeat-pan";
    Game.defeatText="Your castle was razed to the ground. Darkness swallows the kingdom.";
    Game.defeatPanTimer=0;
    spawnParticles(base.x, groundY-60, 60, "#ff8a3d", 260, 320);
    spawnParticles(base.x, groundY-60, 40, "#ffd27a", 200, 260);
    spawnParticles(base.x, groundY-60, 50, "#5a5260", 300, 200);
    Game.screenShake = Math.max(Game.screenShake, 1);
    return;
  }
  if (player.hp<=0 && Game.state==="play") {
    Game.inMine=false;
    Game.state="player-death";
    Game.deathTimer=0;
    Game.defeatText="The monarch fell in battle, and the crown rolled into the dirt. The kingdom is lost.";
    player.vx=0; player.swing=0; player.knock=0; player.hurt=0;
    Audio.death();
    spawnParticles(player.x, groundY-40, 26, "#a4262b", 190, 210);
    spawnParticles(player.x, groundY-40, 14, "#e0556a", 130, 170);
    spawnParticles(player.x, groundY-30, 18, "#d4a838", 110, 150); // the crown's gold scatters
    Game.screenShake = Math.max(Game.screenShake, 0.8);
    return;
  }
}

function updateAutosave(dt) {
  Game.autosaveTimer-=dt;
  if (Game.autosaveTimer<=0) { Game.autosaveTimer=5; saveGame(); }
}

function updateArcherAnimations(dt) {
  for (const u of state.units) {
    if (u.role === "archer") {
      updateArcherShoot(u, dt);
    }
  }
  updateArcherShoot(state.player, dt);
}

function update(dt) {
  updateTime(dt);
  updatePlayer(dt);
  updatePlayerAttack(dt);
  updatePayment(dt);
  updateForestTrees(dt);
  updateMine(dt);
  updateBuildings(dt);
  updateVagrants(dt);
  updateAssignments();
  updateUnits(dt);
  updateArcherAnimations(dt);
  updateAnimals(dt);
  updateForestCamps(dt);
  updatePortals();
  updateCaltrops(dt);
  updateEnemies(dt);
  updateDyingEnemies(dt);
  updateFirePools(dt);
  updateArrows(dt);
  updateSpells(dt);

  updateCoins(dt);
  updateLootItems(dt);
  updateChests(dt);
  updateLootPhysics(dt);
  updateWeaponPickup(dt);
  updateParticles(dt);
  if (Game.screenShake > 0) Game.screenShake = Math.max(0, Game.screenShake - dt * 9);
  updateFloats(dt);
  updateSpawning(dt);
  updateNightClear();
  checkUpgrade();
  updateCamera();
  Audio.updateAmbientZones(state.player.x, CFG.baseX, FOREST.startDist);
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
  import('../rendering/Effects.js').then(({clearTreeCache})=>clearTreeCache());
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
  deleteSave();
  enterDeathHub(text);
}

function startRunFromPortal() {
  Game.start(false);
  Game.runStartAnim = 1.05;
  if (state.player) {
    state.player.invuln = Math.max(state.player.invuln || 0, 1);
    spawnParticles(state.player.x, groundY - 55, 34, "#8fd8ff", 160, 150);
    spawnParticles(state.player.x, groundY - 55, 16, "#d8f6ff", 90, 180);
  }
}

function drawRunStartOverlay(dt) {
  if (!Game.runStartAnim || Game.runStartAnim <= 0 || !state.player) return;
  const duration = 1.05;
  const t = clamp(1 - Game.runStartAnim / duration, 0, 1);
  const zoom = Game.zoom || 1;
  const sx = W / 2 + zoom * (state.player.x - W / 2 - Game.cam);
  const sy = groundY - 55;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const rg = ctx.createRadialGradient(sx, sy, 8, sx, sy, 260 * (1 - t) + 30);
  rg.addColorStop(0, `rgba(235,252,255,${0.72 * (1 - t)})`);
  rg.addColorStop(0.28, `rgba(90,190,255,${0.45 * (1 - t)})`);
  rg.addColorStop(1, "rgba(40,80,255,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  if (t < 0.22) {
    ctx.fillStyle = `rgba(235,252,255,${(0.22 - t) / 0.22 * 0.75})`;
    ctx.fillRect(0, 0, W, H);
  }
  Game.runStartAnim = Math.max(0, Game.runStartAnim - dt);
}

function drawDeathOverlay() {
  if (Game.state !== "player-death") return;
  const t = Game.deathTimer || 0;

  // blood-red vignette closing in
  const v = clamp(t / 0.6, 0, 1);
  const rg = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.9);
  rg.addColorStop(0, "rgba(0,0,0,0)");
  rg.addColorStop(1, `rgba(80,4,14,${0.6 * v})`);
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);

  // fade to black before the hub
  const f = clamp((t - 2.4) / 1.0, 0, 1);
  if (f > 0) { ctx.fillStyle = `rgba(6,4,10,${f})`; ctx.fillRect(0, 0, W, H); }

  // title
  if (t > 0.9) {
    const a = clamp((t - 0.9) / 0.7, 0, 1) * (1 - f);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "600 38px Georgia, serif";
    ctx.fillText("The monarch has fallen", W / 2 + 2, H * 0.34 + 2);
    ctx.fillStyle = "#e8d8b8";
    ctx.fillText("The monarch has fallen", W / 2, H * 0.34);
    if (t > 1.5) {
      ctx.globalAlpha = clamp((t - 1.5) / 0.6, 0, 1) * (1 - f) * 0.85;
      ctx.font = "20px Georgia, serif";
      ctx.fillStyle = "#c9b89a";
      ctx.fillText("The embers carry you onward…", W / 2, H * 0.34 + 36);
    }
    ctx.restore();
  }
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
  if (Game.state === "hub") {
    updateHub(gdt, startRunFromPortal);
    UI.hud.classList.add("hidden");
    UI.prompt.classList.add("hidden");
  }
  if (Game.state === "hub-transition") {
    updateHubTransition(gdt, startRunFromPortal);
    if (Game.state === "hub-transition") {
      UI.hud.classList.add("hidden");
      UI.prompt.classList.add("hidden");
    }
  }
  if (Game.state === "player-death") {
    Game.deathTimer += dt;
    // slow-motion aftermath: only ambient bits keep moving
    const sdt = gdt * 0.35;
    updateParticles(sdt);
    updateFloats(sdt);
    updateDyingEnemies(sdt);
    if (Game.screenShake > 0) Game.screenShake = Math.max(0, Game.screenShake - dt * 9);
    const zoom = Game.zoom;
    const target = clamp(state.player.x - W / 2, 0, Math.max(0, CFG.worldWidth - W / zoom));
    Game.cam += (target - Game.cam) * Math.min(1, dt * 3);
    if (Game.deathTimer > 3.4) endGame(Game.defeatText);
  }
  if (Game.state === "defeat-pan") {
    Game.defeatPanTimer += dt;
    const zoom = Game.zoom;
    const target = clamp(state.base.x - W / (2 * zoom), 0, Math.max(0, CFG.worldWidth - W / zoom));
    Game.cam += (target - Game.cam) * Math.min(1, dt * 2.5);
    if (Game.defeatPanTimer > 2.2) endGame(Game.defeatText);
  }
  if (Game.state === "hub" || Game.state === "hub-transition") renderHub();
  else if (Game.state !== "menu") render();
  else renderMenuBackground();
  drawRunStartOverlay(dt);
  drawDeathOverlay();

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
initMeta();
Game.cam = clamp(CFG.baseX - W/2, 0, Math.max(0, CFG.worldWidth - W));
setupInputHandlers();
if (hasSave()) document.getElementById("btn-continue")?.classList.remove("hidden");
requestAnimationFrame(loop);
