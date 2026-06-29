import { state, Game } from '../state.js';
import { CFG, WALL_SLOTS, PORTALS, STATIONS_X } from '../config/config.js';
import { groundY } from '../canvas.js';
import { rand, randInt, clamp } from '../util/math.js';
import { makePlayer } from '../entities/Player.js';
import { makeWall } from '../entities/Wall.js';
import { makeUnit } from '../entities/Unit.js';
import { Audio } from './Audio.js';
import { floaty, spawnCoin, spawnParticles, spawnAnimal, planNight, buildLocations } from './SpawnSystem.js';
import { upgradeBase } from '../util/GameStateHelpers.js';
import { addXP } from './UpgradeSystem.js';
import { baseName } from '../rendering/HUD.js';

export function buildStations() {

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
    cost:()=>state.farmLevel>=5?0:CFG.farmUpgradeCosts[state.farmLevel],
    label:()=>{
      if (state.farmLevel===0) return "Byg gård (passiv guldindkomst)";
      if (state.farmLevel>=5) return "Gård er fuldt opgraderet (niveau 5)";
      return `Opgradér gård niveau ${state.farmLevel}→${state.farmLevel+1}`;
    },
    onPaid:()=>{
      state.farmLevel++;
      state.farmBuilt = true;
      if (state.farmLevel===1) { state.pendingFarmers++; floaty(STATIONS_X.farm,"🌾 Gård bygget!"); }
      else floaty(STATIONS_X.farm,`🌾 Gård niveau ${state.farmLevel}!`,"#9bd05a");
      Audio.build();
    },
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

export function newGame() {
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
  state.farmLevel       = 0;
  state.poisonShots     = [];
  state.caltrops        = [];
  state.archerSkillPoints = 0;
  state.archerSkills    = [];
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
