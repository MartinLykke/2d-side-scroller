import { Game, state } from '../../core/state.js';
import { CFG, FOREST } from '../../config/config.js';
import { makeUnit } from '../../entities/Unit.js';
import { spawnVagrant, planNight, populateBiomeAnimals } from '../world/SpawnSystem.js';
import { addForestCamp, buildForest } from '../world/ForestSystem.js?v=biomeactive1';
import { buildStations } from './GameInit.js?v=biomeactive1';
import { permanentForestCampPlans } from './RoguelikeSystem.js';
import { autoSpendSkillPoints } from '../economy/SkillSystem.js';
import { ensureCastleUpgrades, baseMaxHpForLevel } from '../../util/DefenseStats.js';

const SAVE_KEY = "ashen_reign_save_v1";

export function saveGame() {
  if (Game.state !== "play") return;
  try {
    const { player, base, walls, units, vagrants, forestTrees } = state;
    const snap = {
      day: Game.day, time: Game.time, treeSeed: Game.treeSeed,
      activeBiome: Game.activeBiome || "forest",
      unlockedBiomes: Array.isArray(Game.unlockedBiomes) ? Game.unlockedBiomes : ["forest"],
      worldPhase: Game.worldPhase || 1,
      // A destroyed-but-not-yet-shifted portal is saved at 1 hp so a reload
      // during the victory celebration can't strand the run in phase 1.
      portals: (state.portals || []).map(p => ({
        hp: p.destroyed ? 1 : p.hp,
        maxHp: p.maxHp,
      })),
      coins: player.coins, px: player.x, hasCrown: player.hasCrown,
      hp: player.hp, weapon: player.weapon, armor: player.armor,
      weaponUpgrades: player.weaponUpgrades || [],
      inventory: player.inventory || [],
      mounts: player.mounts || [],
      mountId: player.mountId || null,
      level: player.level || 1, xp: player.xp || 0,
      base: { level: base.level, hp: base.hp, maxHp: base.maxHp },
      walls: walls.map(w => ({ commissioned: w.commissioned, level: w.level, hp: w.hp, maxHp: w.maxHp, buildProgress: w.buildProgress })),
      buildings: (state.buildings || []).map(b => ({ built: b.built, level: b.level })),
      chests: (state.chests || []).map(ch => ({
        x: ch.x,
        lootGold: ch.lootGold,
        weaponId: ch.weaponId || null,
        open: !!ch.open,
        openAnim: ch.openAnim || 0,
        market: !!ch.market,
      })),
      forestTrees: forestTrees.map(t => ({ marked: t.marked, chopped: t.chopped, chopProgress: t.chopProgress, lying: t.lying || !!t.carriedBy, regrowTimer: t.regrowTimer || 0 })),
      units: units
        .filter(u => !u.dying && u.hp > 0)
        .map(u => ({
          role: u.role,
          x: u.x,
          archerName: u.archerName,
          level: u.level,
          xp: u.xp,
          homeX: u.role === "hound" ? u.homeX : undefined,
        })),
      vagrants: vagrants.length,
      farm: state.farmBuilt,
      farmLevel: state.farmLevel,
      fortLevel: state.fortLevel || 0,
      castleUpgrades: ensureCastleUpgrades(),
      archerSkillPoints: state.archerSkillPoints || 0,
      archerSkills: state.archerSkills || [],
      arrowRainCd: state.arrowRainCd || 0,
      guardSkillPoints: state.guardSkillPoints || 0,
      guardSkills: state.guardSkills || [],
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
  } catch (e) {}
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

// Returns true if a save was found and loaded. Caller must have already
// called newGame() to reset state before invoking this.
export function loadGame() {
  try {
    const snap = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!snap) return false;

    Game.day = snap.day; Game.time = snap.time; Game.treeSeed = snap.treeSeed;
    Game.activeBiome = snap.activeBiome || "forest";
    Game.unlockedBiomes = Array.isArray(snap.unlockedBiomes) && snap.unlockedBiomes.length
      ? Array.from(new Set(["forest", ...snap.unlockedBiomes]))
      : ["forest"];
    Game.worldPhase = snap.worldPhase || 1;
    if (Game.worldPhase >= 2) {
      for (const p of state.portals) p.voidRift = true;
    } else if (snap.portals) {
      snap.portals.forEach((s, i) => {
        const p = state.portals[i];
        if (p && s && s.hp !== undefined && s.hp !== null) { p.hp = s.hp; p.maxHp = s.maxHp; }
      });
    }
    buildForest();
    state.animals.length = 0;
    populateBiomeAnimals(12, { nearX: Number.isFinite(snap.px) ? snap.px : CFG.baseX });
    const { player, base, walls, forestTrees } = state;
    if (snap.forestTrees) snap.forestTrees.forEach((s, i) => {
      if (!forestTrees[i]) return;
      Object.assign(forestTrees[i], s);
      if (s.chopped && !s.lying && !Object.prototype.hasOwnProperty.call(s, "regrowTimer")) {
        forestTrees[i].regrowTimer = FOREST.regrowMin + Math.random() * (FOREST.regrowMax - FOREST.regrowMin);
      }
    });
    for (const camp of permanentForestCampPlans()) addForestCamp(camp.x, camp.vagrants);
    player.coins = snap.coins; player.x = snap.px; player.hasCrown = snap.hasCrown;
    player.hp = snap.hp || CFG.playerMaxHp;
    player.weapon = snap.weapon || null;
    player.armor  = snap.armor  || null;
    player.weaponUpgrades = snap.weaponUpgrades || [];
    player.inventory = snap.inventory || [];
    player.mounts = snap.mounts || [];
    player.mountId = snap.mountId || null;
    player.lastMountId = player.mountId;
    player.level = snap.level || 1;
    player.xp = snap.xp || 0;
    state.fortLevel = snap.fortLevel || 0;
    state.castleUpgrades = snap.castleUpgrades || {};
    ensureCastleUpgrades();
    base.level = snap.base.level;
    base.maxHp = baseMaxHpForLevel(base.level);
    base.hp = Number.isFinite(snap.base.hp) ? Math.max(0, snap.base.hp) : base.maxHp;
    walls.forEach((w, i) => { const s = snap.walls[i]; if (s) Object.assign(w, s); });
    if (snap.buildings) snap.buildings.forEach((s, i) => { if (state.buildings[i]) Object.assign(state.buildings[i], s); });
    if (Array.isArray(snap.chests)) {
      state.chests = snap.chests
        .filter(ch => ch && Number.isFinite(ch.x))
        .map(ch => ({
          x: ch.x,
          lootGold: Math.max(0, Math.floor(ch.lootGold || 0)),
          weaponId: ch.weaponId || null,
          open: !!ch.open,
          openAnim: ch.openAnim || 0,
          market: !!ch.market,
        }));
    }
    state.units = snap.units
      .filter(s => ["archer", "builder", "farmer", "guard", "hound", "peasant"].includes(s.role))
      .map(s => {
        const u = makeUnit(s.role, s.x);
        if (s.archerName) u.archerName = s.archerName;
        if (s.level) u.level = s.level;
        if (s.xp) u.xp = s.xp;
        if (u.role === "hound") {
          const kennel = state.buildings.find(b => b.type === "kennel" && b.built);
          u.homeX = Number.isFinite(s.homeX) ? s.homeX : (kennel ? kennel.x : u.x);
        }
        return u;
      });
    state.vagrants = [];
    for (let i = 0; i < (snap.vagrants || 0); i++) spawnVagrant();
    state.farmBuilt = snap.farm;
    state.farmLevel = snap.farmLevel || (snap.farm ? 1 : 0);
    state.archerSkillPoints = snap.archerSkillPoints || 0;
    // smoke_bomb was replaced by hunters_mark; migrate old saves
    state.archerSkills = (snap.archerSkills || []).map(id => id === "smoke_bomb" ? "hunters_mark" : id);
    state.arrowRainCd = snap.arrowRainCd || 0;
    state.guardSkillPoints = snap.guardSkillPoints || 0;
    state.guardSkills = snap.guardSkills || [];
    autoSpendSkillPoints();
    Game.threatLevel = Math.max(1, snap.day || 1);
    buildStations(); // stations depend on the restored base level
    planNight();
    return true;
  } catch (e) { return false; }
}

export function deleteSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}
