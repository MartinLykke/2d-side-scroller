import { state, Game } from '../../core/state.js';
import { CFG, WALL_SLOTS, PORTALS, STATIONS_X } from '../../config/config.js';
import { groundY } from '../../core/canvas.js';
import { rand, randInt, clamp } from '../../util/math.js';
import { makePlayer } from '../../entities/Player.js';
import { makeWall } from '../../entities/Wall.js';
import { makeUnit } from '../../entities/Unit.js';
import { Audio } from './Audio.js';
import { spawnParticles, populateBiomeAnimals, planNight, purchaseFloaty } from '../world/SpawnSystem.js';
import { addForestCamp, buildForest } from '../world/ForestSystem.js?v=biomeactive4';
import { makeBuildings, buildingCost, buildingLabel, payBuilding } from '../world/OutpostSystem.js?v=biomeactive4';
import { upgradeBase } from '../../util/GameStateHelpers.js?v=biomeweapons1';
import { addXP } from '../economy/UpgradeSystem.js?v=biomeweapons1';
import { baseName } from '../../rendering/HUD.js?v=biomevisual4';
import { applyPermanentUpgrades, applyPermanentWorldUpgrades, permanentForestCampPlans } from './RoguelikeSystem.js';
import { currentPopCap, wallMaxHpForLevel } from '../../util/DefenseStats.js';

function missingDefenseHp() {
  let missing = Math.max(0, state.base.maxHp - state.base.hp);
  for (const w of state.walls || []) {
    if (!w.commissioned || w.buildProgress < 1) continue;
    missing += Math.max(0, w.maxHp - w.hp);
  }
  return missing;
}

function repairDefenseCost() {
  const missing = missingDefenseHp();
  if (missing <= 0) return 0;
  return CFG.repairAllCost + Math.ceil(missing / 24);
}

function canReinforceDefenses() {
  if ((state.base?.level || 1) < CFG.maxBaseLevel || missingDefenseHp() > 0) return false;
  if (state.base.hp < state.base.maxHp + 30) return true;
  return (state.walls || []).some(w =>
    w.commissioned &&
    w.buildProgress >= 1 &&
    w.hp < Math.ceil(w.maxHp * 1.35)
  );
}

function reinforceDefenseCost() {
  if (!canReinforceDefenses()) return 0;
  return CFG.reinforceCostBase + Game.day * CFG.reinforceCostPerDay;
}

function baseStationCost(base) {
  // Once the castle stands (lvl 4+), repairs take priority over further expansion.
  if (base.level >= 4 && repairDefenseCost() > 0) return repairDefenseCost();
  if (base.level < CFG.maxBaseLevel) return CFG.baseUpgradeCost[base.level];
  return reinforceDefenseCost();
}

function baseStationLabel(base) {
  if (base.level >= 4 && repairDefenseCost() > 0) return "Repair castle and walls";
  if (base.level < CFG.maxBaseLevel) return `Upgrade ${baseName(base.level)} -> ${baseName(base.level + 1)}`;
  if (reinforceDefenseCost() > 0) return "Reinforce defenses";
  return "The royal capital is fully secured";
}

function payBaseStation(base) {
  const needsRepair = base.level >= 4 && repairDefenseCost() > 0;
  if (!needsRepair && base.level < CFG.maxBaseLevel) {
    upgradeBase();
    addXP(30);
    return;
  }
  if (repairDefenseCost() > 0) {
    base.hp = Math.max(base.hp, base.maxHp);
    for (const w of state.walls || []) {
      if (w.commissioned && w.buildProgress >= 1) w.hp = Math.max(w.hp, w.maxHp);
    }
    spawnParticles(base.x, groundY - 40, 18, "#9bd05a", 80, 90);
    Audio.build();
    return;
  }
  if (reinforceDefenseCost() > 0) {
    base.hp = Math.min(base.maxHp + 30, Math.max(base.hp, base.maxHp) + 20);
    for (const w of state.walls || []) {
      if (!w.commissioned || w.buildProgress < 1) continue;
      const cap = Math.ceil(w.maxHp * 1.35);
      w.hp = Math.min(cap, Math.max(w.hp, w.maxHp) + Math.ceil(w.maxHp * 0.25));
    }
    spawnParticles(base.x, groundY - 70, 24, "#cfe6f2", 120, 110);
    Audio.build();
  }
}

export function buildStations() {

  const { base, walls } = state;
  state.stations = [];

  state.stations.push({
    id:"base", x:()=>base.x, paid:0, instantPurchase:true,
    cost:()=>baseStationCost(base),
    label:()=>baseStationLabel(base),
    onPaid:()=>payBaseStation(base),
  });
  state.stations.push({
    id:"bow", x:()=>STATIONS_X.bow, paid:0, instantPurchase:true,
    cost:()=>CFG.bowCost,
    label:()=>"Buy bow (creates an archer)",
    onPaid:()=>{
      const bx = STATIONS_X.bow+rand(-12,12);
      state.groundBows.push({ x:bx, claimed:false, born:performance.now()/1000 });
      purchaseFloaty("bow", bx, "🏹 Bow purchased!", "#9bd05a");
      spawnParticles(bx, groundY-20, 18, "#9bd05a", 80, 140);
      Audio.recruit();
    },
  });
  if (state.base.level >= 2) {
    state.stations.push({
      id:"hammer", x:()=>STATIONS_X.hammer, paid:0, instantPurchase:true,
      cost:()=>CFG.hammerCost,
      label:()=>"Buy hammer (creates a builder)",
      onPaid:()=>{
        const hx = STATIONS_X.hammer+rand(-12,12);
        state.groundHammers.push({ x:hx, claimed:false, born:performance.now()/1000 });
        purchaseFloaty("hammer", hx, "🔨 Hammer purchased!", "#f2a230");
        spawnParticles(hx, groundY-20, 18, "#f2a230", 80, 140);
        Audio.recruit();
      },
    });
  }
  if (state.base.level >= 2) {
    state.stations.push({
      id:"farm", x:()=>STATIONS_X.farm, paid:0, instantPurchase:true,
      cost:()=>state.farmLevel>=5?0:CFG.farmUpgradeCosts[state.farmLevel],
      label:()=>{
        if (state.farmLevel===0) return "Build farm (passive gold income)";
        if (state.farmLevel>=5) return "Farm is fully upgraded (level 5)";
        return `Upgrade farm level ${state.farmLevel}→${state.farmLevel+1}`;
      },
      onPaid:()=>{
        state.farmLevel++;
        state.farmBuilt = true;
        if (state.farmLevel===1 && !state.units.some(u => u.role === "farmer" && u.hp > 0 && !u.dying)) {
          const u = makeUnit("farmer", STATIONS_X.farm + rand(-24, 24));
          u.transform = 0.55;
          u.workTimer = 0;
          state.units.push(u);
          spawnParticles(u.x, groundY - 28, 12, "#9bd05a", 65, 80);
          Audio.recruit();
        }
        Audio.build();
      },
    });
  }
  if (state.base.level >= 2) {
    state.stations.push({
      id:"shop", x:()=>STATIONS_X.shop, paid:0,
      cost:()=>0,
      label:()=>"🏪 Shop",
      onPaid:()=>{},
    });
  }
  if (state.base.level >= 3) {
    state.stations.push({
      id:"guard", x:()=>STATIONS_X.guard, paid:0, instantPurchase:true,
      cost:()=> state.units.length + state.vagrants.length >= currentPopCap() ? 0 : CFG.guardCost,
      label:()=> state.units.length + state.vagrants.length >= currentPopCap()
        ? "Population cap reached"
        : `Recruit guard (${CFG.guardCost} coins) - melee unit`,
      onPaid:()=>{
        if (state.units.length + state.vagrants.length >= currentPopCap()) return;
        const u = makeUnit("guard", STATIONS_X.guard + rand(-20, 20));
        u.hp = u.maxHp = 8; u.transform = 0.55;
        state.units.push(u);
        Audio.recruit();
      },
    });
  }
  walls.forEach(w=>{
    state.stations.push({
      id:"wall", wall:w, x:()=>w.x, paid:0, instantPurchase:true,
      cost:()=>{
        if (!w.commissioned) return CFG.wallCost;
        if (w.buildProgress < 1) return 0;
        if (w.level < 5) return CFG.wallUpgradeCosts[w.level - 1];
        return 0;
      },
      label:()=>{
        if (!w.commissioned) return "Build wall";
        if (w.buildProgress < 1) return "Under construction...";
        if (w.level < 5) return `Upgrade wall (lvl ${w.level}→${w.level+1})`;
        return "Wall (max level 5)";
      },
      onPaid:()=>{
        if (!w.commissioned) {
          w.commissioned=true; w.level=1; w.maxHp=wallMaxHpForLevel(1); w.hp=0; w.buildProgress=0;
          addXP(15);
        } else if (w.level < 5) {
          w.level++; w.maxHp=wallMaxHpForLevel(w.level);
          w.buildProgress=clamp(w.hp/w.maxHp,0.2,1);
          addXP(20);
        }
        Audio.build();
      },
    });
  });
  for (const b of (state.buildings || [])) {
    state.stations.push({
      id:"building", building:b, x:()=>b.x, paid:0,
      instantPurchase:true,
      cost:()=>buildingCost(b),
      label:()=>buildingLabel(b),
      onPaid:()=>payBuilding(b),
    });
  }
}

export function newGame() {
  // Entity arrays
  state.player     = makePlayer();
  applyPermanentUpgrades(state.player);
  state.base       = { x: CFG.baseX, level: 1, hp: CFG.baseMaxHp[1], maxHp: CFG.baseMaxHp[1], paid: 0, flash: 0 };
  state.units      = [];
  state.vagrants   = [];
  state.enemies    = [];
  state.coins      = [];
  state.goldCollectors = [];
  state.arrows     = [];
  state.animals    = [];
  state.particles  = [];
  state.floatTexts = [];
  state.portals    = PORTALS.map(p => ({ ...p }));
  state.walls      = WALL_SLOTS.map(makeWall);
  state.buildings  = makeBuildings();

  // Timers and flags
  state.pendingHammers  = 0;
  state.pendingFarmers  = 0;
  Game.permanentBaseHpBonus = 0;
  Game.permanentWallHpBonus = 0;
  state.farmBuilt       = false;
  state.farmLevel       = 0;
  state.poisonShots     = [];
  state.caltrops        = [];
  state.archerSkillPoints = 0;
  state.archerSkills    = [];
  state.guardSkillPoints = 0;
  state.guardSkills     = [];
  state.rallyCd         = 0;
  state.rallyT          = 0;
  state.arrowRainCd     = 0;
  state.groundBows      = [];
  state.groundHammers   = [];
  state.lootItems       = [];
  state.chests          = [];
  state.legendaryBoss   = null;
  state.legendaryEffects= [];
  state.aegisStrikes    = [];
  state.trebuchetShots  = [];
  state.firePools       = [];
  state.spells          = [];
  state.spellFields     = [];
  state.weaponPickup    = null;
  state.payCooldown     = 0;
  state.payHoldTime     = 0;
  state.lastPaidStation = null;
  state.vagrantTimer    = 1;
  state.animalTimer     = 2;
  state.assault         = null;
  state.castleUpgrades  = { masonry: 0, garrison: 0, treasury: 0, aegis: 0, siege: 0 };
  Game.activeBiome      = "forest";
  Game.unlockedBiomes   = ["forest"];
  Game.worldPhase       = 1;
  Game.phaseTransition  = null;

  applyPermanentWorldUpgrades();

  // World generation
  Game.treeSeed = randInt(1, 99999);
  buildStations();
  buildForest();
  for (const camp of permanentForestCampPlans()) addForestCamp(camp.x, camp.vagrants);

  // Game clock
  Game.time              = 0.06;
  Game.day               = 1;
  Game.isNight           = false;
  Game.wasNight          = false;
  Game.threatLevel       = 1;
  Game.autosaveTimer     = 0;
  Game.zoom              = 1.2;
  Game.legendaryIntro    = null;
  Game.castleOpen        = false;
  Game.castleIdx         = 0;
  Game.runKills          = 0;
  Game.killStreak        = 0;
  Game.killStreakTimer   = 0;
  Game.momentumLevel     = 0;
  Game.momentumTimer     = 0;
  Game.lastStandDay      = 0;
  Game.nightPortalWarnT  = 0;
  Game.bountyRaidersRemaining = 0;

  // Seed starting population
  for (let i = 0; i < 2; i++)
    state.units.push(makeUnit("peasant", CFG.baseX + rand(-180, 180)));
  while (state.pendingFarmers > 0) {
    const peasant = state.units.find(u => u.role === "peasant");
    if (!peasant) break;
    peasant.role = "farmer";
    peasant.workTimer = 0;
    peasant.transform = 0.55;
    state.pendingFarmers--;
  }
  populateBiomeAnimals(12, { nearX: CFG.baseX });
  planNight();
}
