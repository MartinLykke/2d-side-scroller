"use strict";

// ---------- Bootstrap ----------
import { CFG, WALL_SLOTS, PORTALS, STATIONS_X } from './config/config.js';
import { WEAPONS, RARITY_COL, WEAPON_UPGRADES } from './config/weapons.js';
import { ARMORS, ARMOR_RARITY_COL } from './config/armor.js';
import { ENEMY_TYPES } from './config/enemies.js';
import { LOC_DEFS } from './config/locations.js';
import { clamp, dist, lerp, rand, randInt, pick, pickR, mulberry32 } from './util/math.js';
import { canvas, ctx, W, H, groundY, resize } from './canvas.js';
import { Game, state } from './state.js';

import { Audio } from './systems/Audio.js';
import { keys } from './systems/Input.js';
import { saveGame, hasSave, loadGame, deleteSave } from './systems/SaveSystem.js';
import { updateSpawning, planNight, spawnCoin, floaty, spawnParticles, spawnVagrant, spawnAnimal, spawnEnemy, buildLocations, spawnLocLoot, makeLocation } from './systems/SpawnSystem.js';
import { updatePayment, updateCoins } from './systems/Economy.js';
import { updateUnits, updateAssignments, updateVagrants, updateAnimals, nearestEnemy } from './systems/AI.js';
import { updateEnemies, updateArrows, updatePlayerAttack, updateSpells, killEnemy, updateLegendaryEffects } from './systems/Combat.js';

import { FX, initFX, updateFX, biomeAt } from './rendering/Effects.js';
import { render, drawEntityShadows } from './rendering/Renderer.js';
import { loadSprites } from './rendering/Sprites.js';
import { UI, DEV, baseName } from './rendering/HUD.js';

import { makePlayer } from './entities/Player.js';
import { makeWall, wallHeight } from './entities/Wall.js';
import { makeUnit } from './entities/Unit.js';

// Make keys available to AI system via window (avoids a circular dep)
window._KEYS = keys;
window._DEV_GOD_MODE = false;
window._floaty = floaty;

const WEAPON_SHOP = [
  { weaponId: 'rusty_sword',   price: 6,  tier: 1 },
  { weaponId: 'short_bow',     price: 9,  tier: 1 },
  { weaponId: 'sword',         price: 16, tier: 2 },
  { weaponId: 'crossbow',      price: 22, tier: 2 },
  { weaponId: 'war_axe',       price: 28, tier: 3 },
  { weaponId: 'long_bow',      price: 33, tier: 3 },
  { weaponId: 'flame_sword',   price: 48, tier: 4 },
  { weaponId: 'gilded_spear',  price: 44, tier: 4 },
  { weaponId: 'shadow_axe',    price: 58, tier: 4 },
  { weaponId: 'kings_sword',   price: 80, tier: 5 },
  { weaponId: 'dark_bow',      price: 75, tier: 5 },
  { weaponId: 'thunder_blade', price: 68, tier: 5 },
  { weaponId: 'void_bow',      price: 62, tier: 5 },
  { weaponId: 'sunblade',      price: 95, tier: 6 },
  { weaponId: 'dragons_bow',   price: 90, tier: 6 },
  { weaponId: 'void_tome',     price: 88, tier: 6 },
  { weaponId: 'fire_tome',     price: 14, tier: 2 },
  { weaponId: 'hydro_tome',    price: 12, tier: 2 },
  { weaponId: 'lightning_tome',price: 38, tier: 4 },
  { weaponId: 'meteor_tome',   price: 44, tier: 4 },
  { weaponId: 'arcane_tome',   price: 65, tier: 5 },
  { weaponId: 'shadow_tome',   price: 62, tier: 5 },
];
const ARMOR_SHOP = [
  { armorId: 'leather_cap',      price: 6,  tier: 1 },
  { armorId: 'studded_vest',     price: 12, tier: 2 },
  { armorId: 'chainmail',        price: 18, tier: 2 },
  { armorId: 'scale_armor',      price: 28, tier: 3 },
  { armorId: 'plate_chestplate', price: 38, tier: 3 },
  { armorId: 'shadow_cloak',     price: 52, tier: 4 },
  { armorId: 'dragon_scale',     price: 65, tier: 4 },
  { armorId: 'void_armor',       price: 82, tier: 5 },
  { armorId: 'sun_plate',        price: 98, tier: 6 },
];
window._WEAPON_SHOP = WEAPON_SHOP;
window._ARMOR_SHOP  = ARMOR_SHOP;
// Legacy alias used by old renderer path
window._SHOP_ITEMS = WEAPON_SHOP;

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

  if (base.level === 2) {
    setTimeout(() => floaty(base.x, "🏪 Marked og butik åbnet!", "#9bd05a"), 900);
    setTimeout(() => floaty(base.x, "🌾 Gårdsstation tilgængelig!", "#9bd05a"), 1800);
  } else if (base.level === 3) {
    setTimeout(() => floaty(base.x, "⚔ Rekrutteringshal åbnet!", "#f2c14e"), 900);
    setTimeout(() => floaty(base.x, "Ansæt garder til forsvar!", "#cdbfa3"), 1800);
  } else if (base.level === 4) {
    setTimeout(() => floaty(base.x, "👑 Kongelig Garde aktiveret!", "#f2c14e"), 900);
    setTimeout(() => floaty(base.x, "✨ Legendariske våben tilgængelige!", "#c69fff"), 1800);
    state.player.maxHp++;
    state.player.hp = Math.min(state.player.hp + 1, state.player.maxHp);
    state.player.hasCrown = true;
    spawnParticles(base.x, groundY - 80, 24, "#f2c14e", 120, 160);
  }
  buildStations();
}
window._upgradeBase = upgradeBase;

function pickupWeapon(weaponId) {
  const { player, lootItems } = state;
  if (player.weapon) lootItems.push({ x: player.x + rand(-60, 60), weaponId: player.weapon });
  player.weapon = weaponId;
  player.weaponUpgrades = [];
  state.weaponPickup = { weaponId, timer: 3.8 };
  Audio.upgrade();
}
window._pickupWeapon = pickupWeapon;

// ---------- XP & Level-up ----------
function xpToNext(level) { return 60 + level * 45; }

function addXP(amount) {
  const { player } = state;
  if (!player || Game.state !== "play") return;
  player.xp = (player.xp || 0) + amount;
  floaty(player.x, "+" + amount + " xp", "#9bd05a");
  while (player.xp >= xpToNext(player.level || 1)) {
    player.xp -= xpToNext(player.level || 1);
    player.level = (player.level || 1) + 1;
    player.pendingUpgrade = true;
    floaty(player.x, "⬆ Niveau " + player.level + "!", "#f2c14e");
    Audio.upgrade();
  }
}
window._addXP = addXP;

function checkUpgrade() {
  const { player } = state;
  if (!player || !player.pendingUpgrade || Game.upgradeMenuOpen) return;
  player.pendingUpgrade = false;
  if (!player.weapon) return;
  const wDef = WEAPONS[player.weapon];
  const pool = [
    ...(WEAPON_UPGRADES.generic || []),
    ...(WEAPON_UPGRADES[wDef.type] || []),
  ];
  const applied = (player.weaponUpgrades || []).map(u => u.id);
  const available = pool.filter(u => !applied.includes(u.id));
  if (available.length === 0) { floaty(player.x, "Våben fuldt opgraderet!", "#f2c14e"); return; }
  const shuffled = available.slice().sort(() => Math.random() - 0.5);
  Game.upgradeOptions = shuffled.slice(0, Math.min(3, shuffled.length));
  Game.upgradeMenuOpen = true;
  Game.upgradeIdx = 0;
}

function applyUpgrade(idx) {
  const opt = Game.upgradeOptions?.[idx];
  if (!opt) { Game.upgradeMenuOpen = false; return; }
  const { player } = state;
  if (!player.weaponUpgrades) player.weaponUpgrades = [];
  player.weaponUpgrades.push(opt);
  Game.upgradeMenuOpen = false;
  floaty(player.x, "⬆ " + opt.name + "!", "#f2c14e");
  Audio.upgrade();
}

// ---------- Stations ----------
function buildStations() {
  const { base, walls } = state;
  state.stations = [];

  state.stations.push({
    id:"base", x:()=>base.x, paid:0,
    cost:()=>base.level<4?CFG.baseUpgradeCost[base.level]:0,
    label:()=>base.level<4?`Opgradér ${baseName(base.level)} → ${baseName(base.level+1)}`:"Slottet er fuldt udbygget",
    onPaid:()=>{ upgradeBase(); addXP(30); },
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
    onPaid:()=>{ state.groundHammers.push({ x:STATIONS_X.hammer+rand(-12,12), claimed:false }); floaty(STATIONS_X.hammer,"🔨 Hammer klar!"); Audio.recruit(); },
  });
  state.stations.push({
    id:"farm", x:()=>STATIONS_X.farm, paid:0,
    cost:()=>state.farmBuilt?0:CFG.farmCost,
    label:()=>state.farmBuilt?"Gården producerer guld":"Byg gård (passiv guldindkomst)",
    onPaid:()=>{ state.farmBuilt=true; state.pendingFarmers++; floaty(STATIONS_X.farm,"🌾 Gård bygget"); Audio.build(); },
  });
  state.stations.push({
    id:"shop", x:()=>STATIONS_X.shop, paid:0,
    cost:()=>0,
    label:()=>"🏪 Butik",
    onPaid:()=>{},
  });
  if (state.base.level >= 3) {
    state.stations.push({
      id:"guard", x:()=>STATIONS_X.guard, paid:0,
      cost:()=> state.units.length + state.vagrants.length >= CFG.popCapByLevel[state.base.level] ? 0 : 8,
      label:()=> state.units.length + state.vagrants.length >= CFG.popCapByLevel[state.base.level]
        ? "Befolkningsgrænse nået"
        : "Rekruttér garde (8🪙) – nærkampenhed",
      onPaid:()=>{
        if (state.units.length + state.vagrants.length >= CFG.popCapByLevel[state.base.level]) { floaty(STATIONS_X.guard, "Befolkningsgrænse nået!", "#ff8a6a"); return; }
        const u = makeUnit("guard", STATIONS_X.guard + rand(-20, 20));
        u.hp = u.maxHp = 8; u.transform = 0.55;
        state.units.push(u);
        floaty(STATIONS_X.guard, "⚔ Garde rekrutteret!", "#f2c14e");
        Audio.recruit();
      },
    });
  }
  walls.forEach(w=>{
    state.stations.push({
      id:"wall", wall:w, x:()=>w.x, paid:0,
      cost:()=>{
        if (!w.commissioned) return CFG.wallCost;
        if (w.buildProgress < 1) return 0;
        if (w.level < 5) return CFG.wallUpgradeCosts[w.level - 1];
        return 0;
      },
      label:()=>{
        if (!w.commissioned) return "Byg mur";
        if (w.buildProgress < 1) return "Bygges...";
        if (w.level < 5) return `Opgradér mur (lvl ${w.level}→${w.level+1})`;
        return "Mur (maks niveau 5)";
      },
      onPaid:()=>{
        if (!w.commissioned) {
          w.commissioned=true; w.level=1; w.maxHp=CFG.wallHp[1]; w.hp=0; w.buildProgress=0;
          floaty(w.x,"🚧 Mur bestilt"); addXP(15);
        } else if (w.level < 5) {
          w.level++; w.maxHp=CFG.wallHp[w.level];
          w.buildProgress=clamp(w.hp/w.maxHp,0.2,1);
          floaty(w.x,`⬆ Mur niveau ${w.level}`,"#9bd05a"); addXP(20);
        }
        Audio.build();
      },
    });
  });
}

// ---------- New game ----------
function newGame() {
  // Entity arrays
  state.player     = makePlayer();
  state.base       = { x: CFG.baseX, level: 1, hp: CFG.baseMaxHp[1], maxHp: CFG.baseMaxHp[1], paid: 0, flash: 0 };
  state.units      = [];
  state.vagrants   = [];
  state.enemies    = [];
  state.coins      = [];
  state.arrows     = [];
  state.animals    = [];
  state.particles  = [];
  state.floatTexts = [];
  state.portals    = PORTALS.map(p => ({ ...p }));
  state.walls      = WALL_SLOTS.map(makeWall);

  // Timers and flags
  state.pendingHammers  = 0;
  state.pendingFarmers  = 0;
  state.farmBuilt       = false;
  state.groundBows      = [];
  state.groundHammers   = [];
  state.lootItems       = [];
  state.chests          = [];
  state.legendaryBoss   = null;
  state.legendaryEffects= [];
  state.spells          = [];
  state.weaponPickup    = null;
  state.payCooldown     = 0;
  state.payHoldTime     = 0;
  state.lastPaidStation = null;
  state.vagrantTimer    = 1;
  state.animalTimer     = 2;

  // World generation
  Game.treeSeed = randInt(1, 99999);
  buildStations();
  buildLocations();

  // Game clock
  Game.time              = 0.06;
  Game.day               = 1;
  Game.isNight           = false;
  Game.wasNight          = false;
  Game.threatLevel       = 1;
  Game.autosaveTimer     = 0;
  Game.zoom              = 1;
  Game.legendaryIntro    = null;

  // Seed starting coins and population
  for (let i = 0; i < 6; i++)
    state.coins.push({ x: CFG.baseX + rand(-200, 200), y: groundY, vy: 0, value: 1, settled: true, life: 9999, magnet: false, vx: 0 });
  for (let i = 0; i < 2; i++)
    state.vagrants.push({ x: CFG.baseX + rand(-320, 320), vx: 0, targetX: CFG.baseX + rand(-260, 260), state: "wander", anim: rand(0, 6) });
  for (let i = 0; i < 4; i++) spawnAnimal();
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
  if (player.hp<player.maxHp) {
    if (!nearestEnemy(player.x,220)) { player.regen+=dt; if (player.regen>=CFG.playerRegenTime) { player.regen=0; player.hp++; floaty(player.x,"+❤","#e0556a"); } }
    else player.regen=0;
  }
}

const LOC_FADE_DIST   = 900;   // px away before cleared loc starts fading
const LOC_FADE_TIME   = 4.0;   // seconds of fade before removal
const LOC_RESPAWN_MIN = 90;    // seconds before a cleared spot can respawn
const LOC_RESPAWN_MAX = 180;
const LOC_RESPAWN_DIST = 1200; // must be this far away to respawn

function updateLocations(dt) {
  if (!state.locRespawnQueue) state.locRespawnQueue = [];
  const { locations, player } = state;

  // Tick respawn queue
  for (let i = state.locRespawnQueue.length - 1; i >= 0; i--) {
    const entry = state.locRespawnQueue[i];
    entry.timer -= dt;
    if (entry.timer <= 0 && dist(player.x, entry.x) > LOC_RESPAWN_DIST) {
      const r = mulberry32((Game.treeSeed || 1) * 13 + entry.x);
      const roll = r();
      let type;
      if      (roll < 0.55) type = pickR(r, ["camp","wagon","grave"]);
      else if (roll < 0.85) type = pickR(r, ["ruins","cave","battlefield"]);
      else if (roll < 0.97) type = "watchtower";
      else                  type = "altar";
      locations.push(makeLocation(entry.x, type, r));
      state.locRespawnQueue.splice(i, 1);
    }
  }

  const screenL = Game.cam - 500, screenR = Game.cam + W + 500;
  for (let i = locations.length - 1; i >= 0; i--) {
    const loc = locations[i];

    // Cleared location fade-out when player walks away
    if (loc.cleared && loc.lootSpawned) {
      const far = dist(player.x, loc.x) > LOC_FADE_DIST;
      if (far) {
        loc.fadeTimer = (loc.fadeTimer || 0) + dt;
        loc.fadeAlpha = Math.max(0, 1 - loc.fadeTimer / LOC_FADE_TIME);
        if (loc.fadeTimer >= LOC_FADE_TIME) {
          state.locRespawnQueue.push({ x: loc.x, timer: rand(LOC_RESPAWN_MIN, LOC_RESPAWN_MAX) });
          locations.splice(i, 1);
          continue;
        }
      } else {
        loc.fadeTimer = Math.max(0, (loc.fadeTimer || 0) - dt * 2);
        loc.fadeAlpha = Math.max(0, 1 - loc.fadeTimer / LOC_FADE_TIME);
      }
    }

    if (!loc.preActivated && loc.x >= screenL && loc.x <= screenR) preActivateLocation(loc, i);
    if (!loc.triggered && dist(player.x, loc.x) < LOC_DEFS[loc.type].trig) {
      loc.triggered = true;
      const def = LOC_DEFS[loc.type];
      floaty(loc.x, def.emoji + " " + def.name + "!", "#ff8a6a");
      addXP(25 + loc.enemyCount * 5);
      // Release survivors when player arrives
      const vcount = def.vagrants || 0;
      let spawned = 0;
      for (let j=0; j<vcount; j++) {
        if (state.vagrants.length + state.units.length >= CFG.popCapByLevel[state.base.level]) break;
        state.vagrants.push({ x: loc.x + rand(-60,60), vx:0, targetX: CFG.baseX + rand(-260,260), state:"wander", anim:rand(0,6), speed:190 });
        spawned++;
      }
      if (spawned > 0) setTimeout(()=>floaty(loc.x, `🙋 ${spawned} overlevende!`, "#cdbfa3"), 400);
      // Empty locations: spawn loot directly (no chest to open)
      if (loc.enemyCount === 0 && !loc.lootSpawned) {
        loc.cleared = true;
        spawnLocLoot(loc);
      }
    }
  }
}

function preActivateLocation(loc, idx) {
  loc.preActivated = true;
  const def = LOC_DEFS[loc.type];
  if (loc.enemyCount === 0) {
    // No enemies — loot spawns when player walks by (triggered), not here
    return;
  }
  loc.remainingEnemies = loc.enemyCount;
  for (let i=0; i<loc.enemyCount; i++) {
    const type=pick(def.etype), ex=loc.x+(i%2===0?-1:1)*(28+i*18);
    state.enemies.push({ x:ex, vx:0, type, hp:ENEMY_TYPES[type].hp, maxHp:ENEMY_TYPES[type].hp, dir:state.player.x<ex?-1:1, attackCd:0, carry:0, anim:rand(0,6), flash:0, fleeing:false, portal:null, locIdx:idx, home:loc.x });
  }
}

function updateLootItems(dt) {
  const { lootItems, player } = state;
  for (let i=lootItems.length-1;i>=0;i--) {
    const it=lootItems[i];
    if (it.dropVy === undefined) {
      it.despawnTimer = (it.despawnTimer || 0) + dt;
      if (it.despawnTimer >= 10) { lootItems.splice(i,1); continue; }
    }
    if (dist(it.x,player.x)<50) {
      if (!player.weapon || keys["f"]) { pickupWeapon(it.weaponId); lootItems.splice(i,1); break; }
    }
  }
}

function updateWeaponPickup(dt) {
  if (state.weaponPickup) { state.weaponPickup.timer -= dt; if (state.weaponPickup.timer <= 0) state.weaponPickup = null; }
}

function updateChests(dt) {
  const { chests, player, lootItems } = state;
  for (let i = chests.length - 1; i >= 0; i--) {
    const ch = chests[i];
    if (ch.open) {
      ch.openAnim += dt * 2.5;
      if (ch.openAnim >= 1) {
        for (let k = 0; k < ch.lootGold; k++)
          spawnCoin(ch.x + rand(-40, 40), 1, groundY - 20, rand(-100, 100), rand(-300, -160));
        if (ch.weaponId)
          lootItems.push({ x: ch.x + rand(-20, 20), weaponId: ch.weaponId, dropVy: -380, dropY: groundY - 180 });
        spawnParticles(ch.x, groundY - 24, 20, "#f2c14e", 120, 150);
        chests.splice(i, 1);
      }
    } else if (dist(ch.x, player.x) < 64 && keys['f']) {
      ch.open = true;
      Audio.upgrade();
      floaty(ch.x, "📦 Kiste åbnet!", "#f2c14e");
    }
  }
}

function updateLootPhysics(dt) {
  for (const it of state.lootItems) {
    if (it.dropVy !== undefined) {
      it.dropVy += 900 * dt;
      it.dropY += it.dropVy * dt;
      if (it.dropY >= groundY - 16) { it.dropY = groundY - 16; it.dropVy = 0; }
    }
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
  updateEnemies(dt);
  updateArrows(dt);
  updateSpells(dt);
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
  updateFX(gdt);

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

// ---------- UI buttons ----------
document.getElementById("btn-start").addEventListener("click", ()=>Game.start(false));
document.getElementById("btn-continue").addEventListener("click", ()=>Game.start(true));
document.getElementById("btn-restart").addEventListener("click", ()=>Game.start(false));

if (hasSave()) document.getElementById("btn-continue").classList.remove("hidden");

// ---------- Keyboard input ----------
function tryOpenShop() {
  const shopSt = state.stations.find(s => s.id === "shop");
  if (shopSt && state.base.level >= 2 && dist(state.player.x, shopSt.x()) < 100) {
    Game.shopOpen = !Game.shopOpen;
    Game.shopIdx  = 0;
  }
}

function currentShopList() {
  return Game.shopTab === 1 ? ARMOR_SHOP : WEAPON_SHOP;
}

function tryBuyShopItem(item) {
  if (!item || state.player.coins < item.price) return;
  state.player.coins -= item.price;
  if (item.armorId) {
    state.player.armor = item.armorId;
    floaty(state.player.x, "🛡 " + ARMORS[item.armorId].name, "#9bd05a");
  } else if (item.weaponId) {
    pickupWeapon(item.weaponId);
    floaty(state.player.x, "🛒 " + WEAPONS[item.weaponId].name, "#9bd05a");
  }
}

function handleShopKeys(k, e) {
  const list = currentShopList();
  if (k === "arrowleft")  { Game.shopIdx = Math.max(0, Game.shopIdx - 1); e.preventDefault(); }
  if (k === "arrowright") { Game.shopIdx = Math.min(list.length - 1, Game.shopIdx + 1); e.preventDefault(); }
  if (k === "t") { Game.shopTab = Game.shopTab === 0 ? 1 : 0; Game.shopIdx = 0; }
  if (k === "e" || k === "enter") tryBuyShopItem(list[Game.shopIdx]);
}

// Expose for renderer click detection
window._tryBuyShopItem = tryBuyShopItem;
window._currentShopList = currentShopList;

document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('diff-active'));
    btn.classList.add('diff-active');
  });
});

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "m") UI.toggleMute();
  if (k === "p") DEV.toggle();
  if (k === "escape") {
    Game.inventoryOpen = false; Game.shopOpen = false; Game.upgradeMenuOpen = false;
    if (Game.state === "play" || Game.state === "pause") Game.togglePause();
  }

  if (Game.state !== "play") return;

  if (Game.upgradeMenuOpen) {
    if (k === "1") { applyUpgrade(0); e.preventDefault(); return; }
    if (k === "2") { applyUpgrade(1); e.preventDefault(); return; }
    if (k === "3") { applyUpgrade(2); e.preventDefault(); return; }
    if (k === "arrowleft")  { Game.upgradeIdx = Math.max(0, Game.upgradeIdx - 1); e.preventDefault(); return; }
    if (k === "arrowright") { Game.upgradeIdx = Math.min((Game.upgradeOptions?.length || 1) - 1, Game.upgradeIdx + 1); e.preventDefault(); return; }
    if (k === "e" || k === "enter") { applyUpgrade(Game.upgradeIdx); e.preventDefault(); return; }
    e.preventDefault(); return;
  }

  if (k === "i") { Game.inventoryOpen = !Game.inventoryOpen; Game.shopOpen = false; }
  if (k === "b" && !Game.inventoryOpen) tryOpenShop();
  if (Game.shopOpen) handleShopKeys(k, e);
  if (k === "+" || k === "=") { Game.zoom = Math.min(2.5, Game.zoom + 0.15); e.preventDefault(); }
  if (k === "-" || k === "_") { Game.zoom = Math.max(0.35, Game.zoom - 0.15); e.preventDefault(); }
  if (k === "0") { Game.zoom = 1; e.preventDefault(); }
});

canvas.addEventListener("wheel", e => {
  e.preventDefault();
  Game.zoom = Math.max(0.35, Math.min(2.5, Game.zoom - e.deltaY * 0.0012));
}, { passive: false });

canvas.addEventListener("mousedown", e => {
  if (!Game.shopOpen) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top)  * scaleY;
  // Check tab header clicks (written to window by renderer each frame)
  if (window._shopTabRects) {
    for (const tr of window._shopTabRects) {
      if (mx >= tr.x && mx <= tr.x+tr.w && my >= tr.y && my <= tr.y+tr.h) {
        Game.shopTab = tr.tab; Game.shopIdx = 0; return;
      }
    }
  }
  // Check item cell clicks
  if (window._shopCells) {
    for (const cell of window._shopCells) {
      if (mx >= cell.x && mx <= cell.x+cell.w && my >= cell.y && my <= cell.y+cell.h) {
        Game.shopIdx = cell.idx;
        tryBuyShopItem(currentShopList()[cell.idx]);
        return;
      }
    }
  }
});

// ---------- Boot ----------
resize();
initFX();
// loadSprites(); // sprites disabled — enable when better art is ready
Game.cam = clamp(CFG.baseX - W/2, 0, Math.max(0, CFG.worldWidth - W));
requestAnimationFrame(loop);
