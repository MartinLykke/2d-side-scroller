import { CFG } from '../../config/config.js';
import { clamp, dist, lerp } from '../../util/math.js';
import { ctx, W, H, groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { keys } from '../input/Input.js';
import { Audio } from './Audio.js';
import { makeUnit } from '../../entities/Unit.js';
import { addSkillPoints } from '../economy/SkillSystem.js';

const META_KEY = "kingdom_embers_meta_v1";
const LEADERBOARD_MAX_ENTRIES = 5;
const HUB = {
  width: 4300,
  spawnX: 520,
  portalX: 3940,
};
const HUB_TRANSITION_TIME = 1.15;
const HUB_UPGRADE_LABELS = {
  heart: "Max HP",
  blade: "Damage",
  purse: "Starting gold",
  ember: "More embers",
  regen: "Regen",
  wanderer_lantern: "Vagrant",
  grave_bow: "Starting bow",
  oath_sparks: "Skill points",
  moon_cache: "Gold cache",
  old_crew: "Starting crew",
  stone_oath: "Starting walls",
  crowned_camp: "Base lvl 2",
  ghost_bow: "Short bow",
  builder_cache: "Hammer cache",
  armory_token: "Starter armor",
  war_banner: "Starting guard",
  relic_compass: "Loot rarity",
  dawn_masonry: "Fortified start",
  blood_moon: "Bigger hordes",
  hungry_portals: "Faster portals",
  ashen_elites: "Elite enemies",
  iron_hide: "Enemy vitality",
};

export const META_UPGRADES = [
  {
    id: "heart",
    tier: "basic",
    name: "Seal of Blood",
    desc: "+1 max HP per rank",
    max: 5,
    x: 640,
    color: "#d95b72",
    icon: "HP",
    cost: lvl => 8 + lvl * 7,
  },
  {
    id: "blade",
    tier: "basic",
    name: "Ash-Honed Weapon",
    desc: "+8% damage to you and all allies per rank",
    max: 6,
    x: 750,
    color: "#f2c14e",
    icon: "DMG",
    cost: lvl => 10 + lvl * 9,
  },
  {
    id: "purse",
    tier: "basic",
    name: "Grave King's Purse",
    desc: "+3 starting gold per rank",
    max: 5,
    x: 860,
    color: "#e6b64a",
    icon: "GOLD",
    cost: lvl => 7 + lvl * 6,
  },
  {
    id: "ember",
    tier: "basic",
    name: "Glowing Crown",
    desc: "+10% extra run reward per rank",
    max: 4,
    x: 970,
    color: "#8fd8ff",
    icon: "SOUL",
    cost: lvl => 14 + lvl * 12,
  },
  {
    id: "regen",
    tier: "basic",
    name: "Moonwell",
    desc: "faster healing out of combat",
    max: 4,
    x: 1080,
    color: "#9bd05a",
    icon: "REGEN",
    cost: lvl => 9 + lvl * 8,
  },
  {
    id: "wanderer_lantern",
    tier: "epic",
    name: "Wayward Lantern",
    desc: "+1 extra vagrant at run start",
    max: 2,
    x: 1330,
    color: "#b9a7ff",
    icon: "VAG",
    cost: lvl => 24 + lvl * 18,
  },
  {
    id: "grave_bow",
    tier: "epic",
    name: "Grave Bow",
    desc: "+1 loose bow at camp start",
    max: 2,
    x: 1440,
    color: "#7fd6a4",
    icon: "BOW",
    cost: lvl => 26 + lvl * 20,
  },
  {
    id: "oath_sparks",
    tier: "epic",
    name: "Oath Flames",
    desc: "+1 archer and guard skill point",
    max: 2,
    x: 1550,
    color: "#ff9bd2",
    icon: "EP",
    cost: lvl => 30 + lvl * 24,
  },
  {
    id: "moon_cache",
    tier: "epic",
    name: "Moon Cache",
    desc: "+12 starting gold and a small shower of sparks",
    max: 1,
    x: 1660,
    color: "#d9e8ff",
    icon: "CACHE",
    cost: () => 42,
  },
  {
    id: "old_crew",
    tier: "legendary",
    name: "The First Oath",
    desc: "start with 1 archer and 1 builder",
    max: 1,
    x: 1950,
    color: "#ffcf5a",
    icon: "CREW",
    cost: () => 90,
  },
  {
    id: "stone_oath",
    tier: "legendary",
    name: "Stone Oath",
    desc: "start with 2 level 1 walls",
    max: 1,
    x: 2060,
    color: "#c6c6d8",
    icon: "WALL",
    cost: () => 100,
  },
  {
    id: "crowned_camp",
    tier: "legendary",
    name: "Crowned Camp",
    desc: "start every run with base level 2",
    max: 1,
    x: 2170,
    color: "#f2c14e",
    icon: "BASE",
    cost: () => 125,
  },
  {
    id: "ghost_bow",
    tier: "legendary",
    name: "Ghost Bow",
    desc: "start with a short bow yourself",
    max: 1,
    x: 2280,
    color: "#8fd8ff",
    icon: "HERO",
    cost: () => 115,
  },
  {
    id: "builder_cache",
    tier: "relic",
    name: "Smith's Cache",
    desc: "+1 loose hammer at camp start per rank",
    max: 2,
    x: 2550,
    color: "#f2a230",
    icon: "HAMMER",
    cost: lvl => 38 + lvl * 32,
  },
  {
    id: "armory_token",
    tier: "relic",
    name: "Armory Writ",
    desc: "start with leather armor, then chainmail",
    max: 2,
    x: 2660,
    color: "#9ecbff",
    icon: "ARMOR",
    cost: lvl => 44 + lvl * 42,
  },
  {
    id: "war_banner",
    tier: "relic",
    name: "War Banner",
    desc: "+1 guard at run start per rank",
    max: 2,
    x: 2770,
    color: "#ffcf5a",
    icon: "GUARD",
    cost: lvl => 58 + lvl * 48,
  },
  {
    id: "relic_compass",
    tier: "relic",
    name: "Relic Compass",
    desc: "+1 location loot rarity per rank",
    max: 2,
    x: 2880,
    color: "#d9e8ff",
    icon: "LOOT",
    cost: lvl => 66 + lvl * 54,
  },
  {
    id: "dawn_masonry",
    tier: "relic",
    name: "Dawn Masonry",
    desc: "+18 base HP and +10 wall HP per rank",
    max: 3,
    x: 2990,
    color: "#c6c6d8",
    icon: "FORT",
    cost: lvl => 50 + lvl * 40,
  },
  {
    id: "blood_moon",
    tier: "curse",
    name: "Blood Moon Pact",
    desc: "+12% night horde size and +8% embers per rank",
    max: 5,
    x: 3270,
    color: "#ff5d6c",
    icon: "HORDE",
    cost: lvl => 30 + lvl * 24,
  },
  {
    id: "hungry_portals",
    tier: "curse",
    name: "Hungry Portals",
    desc: "portals spawn 10% faster and +6% embers per rank",
    max: 4,
    x: 3380,
    color: "#ff8a3d",
    icon: "PORTAL",
    cost: lvl => 34 + lvl * 28,
  },
  {
    id: "ashen_elites",
    tier: "curse",
    name: "Ashen Elites",
    desc: "more elite enemies and +6% embers per rank",
    max: 4,
    x: 3490,
    color: "#b9a7ff",
    icon: "ELITE",
    cost: lvl => 38 + lvl * 30,
  },
  {
    id: "iron_hide",
    tier: "curse",
    name: "Iron Hide",
    desc: "+10% enemy HP and +7% embers per rank",
    max: 4,
    x: 3600,
    color: "#c6c6d8",
    icon: "HARD",
    cost: lvl => 42 + lvl * 34,
  },
];

function defaultMeta() {
  return {
    embers: 0,
    upgrades: {},
    totalRuns: 0,
    bestDay: 1,
    totalKills: 0,
    lastReward: 0,
    lastDay: 1,
    lastKills: 0,
    leaderboard: [],
    lastLeaderboardEntryId: null,
    lastLeaderboardRank: 0,
  };
}

function scoreValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function compareLeaderboardEntries(a, b) {
  return (b.score - a.score)
    || (b.day - a.day)
    || (b.kills - a.kills)
    || (b.reward - a.reward)
    || (a.timestamp - b.timestamp);
}

function normalizeLeaderboard(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry, i) => {
      if (!entry || typeof entry !== "object") return null;
      const score = Math.max(0, Math.floor(scoreValue(entry.score)));
      if (score <= 0) return null;
      const timestamp = Math.max(0, Math.floor(scoreValue(entry.timestamp, Date.now())));
      return {
        id: typeof entry.id === "string" && entry.id ? entry.id : `legacy-${timestamp}-${i}`,
        score,
        day: Math.max(1, Math.floor(scoreValue(entry.day, 1))),
        kills: Math.max(0, Math.floor(scoreValue(entry.kills))),
        reward: Math.max(0, Math.floor(scoreValue(entry.reward))),
        baseLevel: Math.max(1, Math.floor(scoreValue(entry.baseLevel, 1))),
        coins: Math.max(0, Math.floor(scoreValue(entry.coins))),
        run: Math.max(1, Math.floor(scoreValue(entry.run, i + 1))),
        timestamp,
      };
    })
    .filter(Boolean)
    .sort(compareLeaderboardEntries)
    .slice(0, LEADERBOARD_MAX_ENTRIES);
}

function currentRunScore(reward) {
  const day = Math.max(1, Math.floor(Game.day || 1));
  const dayProgress = Math.max(0, day - 1) + clamp(Game.time || 0, 0, 1);
  const kills = Math.max(0, Math.floor(Game.runKills || 0));
  const baseLevel = Math.max(1, Math.floor(state.base?.level || 1));
  const coins = Math.max(0, Math.floor(state.player?.coins || 0));
  const embers = Math.max(0, Math.floor(reward || 0));
  const baseProgress = Math.max(0, baseLevel - 1);
  return Math.max(0, Math.floor(dayProgress * 900 + kills * 40 + baseProgress * 240 + coins * 2 + embers * 12));
}

function makeLeaderboardEntry(runNumber, reward) {
  const timestamp = Date.now();
  return {
    id: `run-${timestamp}-${Math.floor(Math.random() * 100000)}`,
    score: currentRunScore(reward),
    day: Math.max(1, Math.floor(Game.day || 1)),
    kills: Math.max(0, Math.floor(Game.runKills || 0)),
    reward: Math.max(0, Math.floor(reward || 0)),
    baseLevel: Math.max(1, Math.floor(state.base?.level || 1)),
    coins: Math.max(0, Math.floor(state.player?.coins || 0)),
    run: Math.max(1, Math.floor(runNumber || 1)),
    timestamp,
  };
}

function recordLeaderboardRun(meta, reward, runNumber) {
  const leaderboard = normalizeLeaderboard(meta.leaderboard);
  const entry = makeLeaderboardEntry(runNumber, reward);
  const qualifies = leaderboard.length === 0
    || leaderboard.some(old => entry.score > old.score);

  meta.lastLeaderboardEntryId = null;
  meta.lastLeaderboardRank = 0;

  if (!qualifies) {
    meta.leaderboard = leaderboard;
    return 0;
  }

  meta.leaderboard = normalizeLeaderboard([...leaderboard, entry]);
  const rank = meta.leaderboard.findIndex(old => old.id === entry.id) + 1;
  if (rank > 0) {
    meta.lastLeaderboardEntryId = entry.id;
    meta.lastLeaderboardRank = rank;
  }
  return rank;
}

function formatLeaderboardScore(score) {
  return Math.max(0, Math.floor(scoreValue(score))).toLocaleString("en-US");
}

export function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return defaultMeta();
    const parsed = JSON.parse(raw);
    const meta = { ...defaultMeta(), ...(parsed && typeof parsed === "object" ? parsed : {}) };
    meta.leaderboard = normalizeLeaderboard(meta.leaderboard);
    return meta;
  } catch (e) {
    return defaultMeta();
  }
}

export function saveMeta(meta = Game.meta) {
  try {
    const next = { ...defaultMeta(), ...(meta || {}) };
    next.leaderboard = normalizeLeaderboard(next.leaderboard);
    if (meta) meta.leaderboard = next.leaderboard;
    localStorage.setItem(META_KEY, JSON.stringify(next));
  } catch (e) {}
}

export function initMeta() {
  Game.meta = loadMeta();
  Game.runKills = 0;
}

export function metaLevel(id) {
  return Game.meta?.upgrades?.[id] || 0;
}

export function permanentDamageMultiplier() {
  return 1 + metaLevel("blade") * 0.08;
}

export function permanentRewardMultiplier() {
  return 1
    + metaLevel("ember") * 0.10
    + metaLevel("blood_moon") * 0.08
    + metaLevel("hungry_portals") * 0.06
    + metaLevel("ashen_elites") * 0.06
    + metaLevel("iron_hide") * 0.07;
}

export function permanentBaseHpBonus() {
  return metaLevel("dawn_masonry") * 18;
}

export function permanentWallHpBonus() {
  return metaLevel("dawn_masonry") * 10;
}

export function nightQuotaMetaMultiplier() {
  return 1 + metaLevel("blood_moon") * 0.12;
}

export function portalSpawnIntervalMultiplier() {
  return Math.max(0.48, 1 - metaLevel("hungry_portals") * 0.10);
}

export function eliteChanceBonus() {
  return metaLevel("ashen_elites") * 0.035;
}

export function locationThreatMultiplier() {
  return 1 + metaLevel("ashen_elites") * 0.18;
}

export function enemyVitalityMultiplier() {
  return 1 + metaLevel("iron_hide") * 0.10;
}

export function applyPermanentUpgrades(player) {
  const hpBonus = metaLevel("heart");
  player.maxHp = CFG.playerMaxHp + hpBonus;
  player.hp = player.maxHp;
  player.coins = CFG.startCoins + metaLevel("purse") * 3;
  player.permanentRegenBonus = metaLevel("regen") * 0.12;
}

export function applyPermanentWorldUpgrades() {
  Game.permanentBaseHpBonus = permanentBaseHpBonus();
  Game.permanentWallHpBonus = permanentWallHpBonus();

  const baseLevel = metaLevel("crowned_camp") > 0 ? 2 : 1;
  if (state.base && baseLevel > state.base.level) {
    state.base.level = baseLevel;
    state.base.maxHp = CFG.baseMaxHp[baseLevel];
    state.base.hp = state.base.maxHp;
  }
  if (state.base && Game.permanentBaseHpBonus > 0) {
    state.base.maxHp += Game.permanentBaseHpBonus;
    state.base.hp += Game.permanentBaseHpBonus;
  }

  if (state.player) {
    state.player.coins += metaLevel("moon_cache") * 12;
    if (metaLevel("ghost_bow") > 0) state.player.weapon = "short_bow";
    const armorRank = metaLevel("armory_token");
    if (armorRank > 0) state.player.armor = armorRank > 1 ? "chainmail" : "leather_cap";
  }
  Game.rarityBonus = (Game.rarityBonus || 0) + metaLevel("relic_compass");

  const extraVagrants = metaLevel("wanderer_lantern");
  for (let i = 0; i < extraVagrants; i++) {
    state.vagrants.push({
      x: CFG.baseX + 160 + i * 44,
      vx: 0,
      targetX: CFG.baseX + 120 + i * 40,
      state: "wander",
      anim: i * 1.7,
    });
  }

  const bows = metaLevel("grave_bow");
  for (let i = 0; i < bows; i++) {
    state.groundBows.push({ x: CFG.baseX - 160 - i * 36, claimed: false });
  }

  const hammers = metaLevel("builder_cache");
  for (let i = 0; i < hammers; i++) {
    state.groundHammers.push({ x: CFG.baseX + 170 + i * 34, claimed: false });
  }

  const skillPoints = metaLevel("oath_sparks");
  addSkillPoints("archer", skillPoints);
  addSkillPoints("guard", skillPoints);

  if (metaLevel("old_crew") > 0) {
    const archer = makeUnit("archer", CFG.baseX - 90);
    archer.level = 1;
    const builder = makeUnit("builder", CFG.baseX + 90);
    builder.level = 1;
    state.units.push(archer, builder);
  }

  const guards = metaLevel("war_banner");
  for (let i = 0; i < guards; i++) {
    const guard = makeUnit("guard", CFG.baseX + 130 + i * 38);
    guard.level = 1;
    state.units.push(guard);
  }

  if (metaLevel("stone_oath") > 0 && state.walls?.length >= 4) {
    for (const w of [state.walls[0], state.walls[2]]) {
      w.commissioned = true;
      w.level = 1;
      w.maxHp = CFG.wallHp[1] + (Game.permanentWallHpBonus || 0);
      w.hp = w.maxHp;
      w.buildProgress = 1;
    }
  }
}

export function registerEnemyKill(reward = 1) {
  if (Game.state !== "play" && Game.state !== "defeat-pan") return;
  Game.runKills = (Game.runKills || 0) + Math.max(1, reward);
}

export function finishRunReward() {
  const dayScore = Math.max(1, Game.day || 1) * 2;
  const killScore = Math.floor((Game.runKills || 0) * 0.75);
  const coinScore = Math.floor((state.player?.coins || 0) / 6);
  const baseScore = (state.base?.level || 1) * 2;
  return Math.max(5, Math.floor((dayScore + killScore + coinScore + baseScore) * permanentRewardMultiplier()));
}

export function enterDeathHub(message = "") {
  const meta = Game.meta || loadMeta();
  const reward = finishRunReward();
  const runNumber = (meta.totalRuns || 0) + 1;
  meta.embers = (meta.embers || 0) + reward;
  meta.totalRuns = runNumber;
  meta.bestDay = Math.max(meta.bestDay || 1, Game.day || 1);
  meta.totalKills = (meta.totalKills || 0) + (Game.runKills || 0);
  meta.lastReward = reward;
  meta.lastDay = Game.day || 1;
  meta.lastKills = Game.runKills || 0;
  recordLeaderboardRun(meta, reward, runNumber);
  Game.meta = meta;
  saveMeta(meta);

  state.player = state.player || { x: HUB.spawnX, vx: 0, dir: 1, coins: meta.embers, gallop: 0, bob: 0, jumpH: 0, jumpVy: 0 };
  Object.assign(state.player, {
    x: HUB.spawnX, vx: 0, dir: 1, coins: meta.embers, gallop: 0, bob: 0,
    hp: 1, maxHp: 1, invuln: 0, hurt: 0, knock: 0, regen: 0, jumpH: 0, jumpVy: 0,
    weapon: null, weaponUpgrades: [], pendingUpgrade: false,
  });
  state.base = { x: HUB.spawnX - 220, level: 1, hp: 1, maxHp: 1 };
  state.units = []; state.vagrants = []; state.enemies = []; state.coins = []; state.arrows = [];
  state.animals = []; state.walls = []; state.portals = []; state.lootItems = []; state.chests = [];
  state.groundBows = []; state.groundHammers = []; state.spells = []; state.caltrops = [];
  state.particles = []; state.floatTexts = [];
  state.stations = buildMetaStations();
  Game.hubMessage = message;
  Game.hubT = 0;
  Game.state = "hub";
  Game.zoom = 1.2;
  Game.cam = clamp(state.player.x - W / 2, 0, Math.max(0, HUB.width - W / Game.zoom));
}

function buildMetaStations() {
  return META_UPGRADES.map(upg => ({
    id: "meta-" + upg.id,
    metaUpgrade: upg,
    paid: 0,
    x: () => upg.x,
    cost: () => {
      const lvl = metaLevel(upg.id);
      return lvl >= upg.max ? 0 : upg.cost(lvl);
    },
    label: () => {
      const lvl = metaLevel(upg.id);
      if (lvl >= upg.max) return `${upg.name} is fully awakened (${lvl}/${upg.max})`;
      return `${upg.name} ${lvl}/${upg.max}: ${upg.desc}`;
    },
    onPaid: () => {
      const lvl = metaLevel(upg.id);
      if (lvl >= upg.max) return;
      Game.meta.upgrades[upg.id] = lvl + 1;
      Game.meta.embers = state.player.coins;
      saveMeta(Game.meta);
      Audio.upgrade();
      hubFloat(upg.x, `${upg.name} ${lvl + 1}/${upg.max}`, upg.color);
    },
  }));
}

function hubFloat(x, text, color = "#f2c14e") {
  state.floatTexts.push({ x, y: groundY - 92, text, color, life: 1.35, vy: -30, size: 15 });
}

function updateHubPlayer(dt) {
  const p = state.player;
  const left = keys["a"] || keys["arrowleft"], right = keys["d"] || keys["arrowright"], sprint = keys["shift"];
  const speed = sprint ? CFG.playerSprint : CFG.playerSpeed;
  let move = 0; if (left) move -= 1; if (right) move += 1;
  p.vx = move * speed;
  p.x = clamp(p.x + p.vx * dt, 120, HUB.width - 120);
  if (move !== 0) p.dir = move;
  const strideTarget = move !== 0 ? (sprint ? 16 : 10) : 0;
  p.strideRate = (p.strideRate || 0) + (strideTarget - (p.strideRate || 0)) * Math.min(1, dt * 8);
  p.gallop += dt * p.strideRate;
  if (move !== 0) {
    const bounce = (0.5 - 0.5 * Math.cos(p.gallop * 4)) * 2.6;
    p.bob += (bounce - p.bob) * Math.min(1, dt * 14);
  }
  else p.bob *= Math.exp(-9 * dt);
  if ((keys[" "] || keys["space"]) && p.jumpH <= 0 && p.jumpVy <= 0) p.jumpVy = 560;
  p.jumpH += p.jumpVy * dt;
  p.jumpVy -= 1400 * dt;
  if (p.jumpH <= 0) { p.jumpH = 0; if (p.jumpVy < 0) p.jumpVy = 0; }

  p.ghostTrail = p.ghostTrail || [];
  if (move !== 0) {
    p.trailTimer = (p.trailTimer || 0) - dt;
    if (p.trailTimer <= 0) {
      p.ghostTrail.push({ x: p.x, h: p.jumpH || 0, dir: p.dir, life: 0.32 });
      p.trailTimer = 0.055;
    }
    if (Math.random() < dt * 16) {
      state.particles.push({
        x: p.x - p.dir * 8 + (Math.random() - 0.5) * 12,
        y: groundY - 26 - (p.jumpH || 0) - Math.random() * 14,
        vx: -p.dir * (18 + Math.random() * 34),
        vy: -(8 + Math.random() * 28),
        life: 0.4 + Math.random() * 0.35, maxLife: 0.75, float: true,
        color: Math.random() < 0.6 ? "#aee8ff" : "#d8f6ff",
        size: 1.4 + Math.random() * 2,
      });
    }
  }
  for (let i = p.ghostTrail.length - 1; i >= 0; i--) {
    p.ghostTrail[i].life -= dt;
    if (p.ghostTrail[i].life <= 0) p.ghostTrail.splice(i, 1);
  }
}

function nearestHubStation() {
  let near = null, nd = CFG.payRange;
  for (const s of state.stations) {
    const c = s.cost();
    if (c <= 0) continue;
    const d = dist(state.player.x, s.x());
    if (d < nd) { nd = d; near = s; }
  }
  return near;
}

function nearestHubUpgrade(range = 115) {
  let near = null, nd = range;
  for (const upg of META_UPGRADES) {
    const d = dist(state.player.x, upg.x);
    if (d < nd) { nd = d; near = upg; }
  }
  return near;
}

function updateHubPayment(dt) {
  const p = state.player;
  state.payCooldown = Math.max(0, (state.payCooldown || 0) - dt);

  for (const s of state.stations) {
    if (s.paid > 0) {
      p.coins += s.paid;
      s.paid = 0;
    }
  }

  const near = nearestHubStation();
  if (!near) {
    state.payHoldTime = 0;
    state.lastPaidStation = null;
    return;
  }

  const payHeld = keys["arrowdown"] || keys["s"];
  if (!payHeld) {
    state.payHoldTime = 0;
    return;
  }

  state.payHoldTime += dt;
  if (state.payCooldown > 0 || state.payHoldTime < 0.18) return;

  const cost = near.cost();
  if (p.coins < cost) {
    hubFloat(near.x(), "Not enough embers", "#ff8a6a");
    state.payCooldown = 0.55;
    return;
  }

  p.coins -= cost;
  Game.meta.embers = p.coins;
  near.onPaid();
  saveMeta(Game.meta);
  state.payHoldTime = 0;
  state.payCooldown = 0.35;
}

function updateHubParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    if (p.fly) {
      p.t += dt / p.life;
      p.x = lerp(p.fromX, p.toX, clamp(p.t, 0, 1));
      p.y = lerp(p.fromY, p.toY, clamp(p.t, 0, 1)) - Math.sin(clamp(p.t, 0, 1) * Math.PI) * 50;
      if (p.t >= 1) state.particles.splice(i, 1);
      continue;
    }
    if (p.float) {
      p.life -= dt;
      p.x += p.vx * dt + Math.sin(p.life * 3.2 + i) * 12 * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) state.particles.splice(i, 1);
      continue;
    }
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 240 * dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
  for (let i = state.floatTexts.length - 1; i >= 0; i--) {
    const f = state.floatTexts[i];
    f.life -= dt; f.y += f.vy * dt; f.vy *= 0.96;
    if (f.life <= 0) state.floatTexts.splice(i, 1);
  }
}

export function updateHub(dt, startNewRun) {
  Game.hubT = (Game.hubT || 0) + dt;
  Game.time = 0.83;
  updateHubPlayer(dt);
  updateHubPayment(dt);
  Game.meta.embers = state.player.coins;
  if (Math.random() < dt * 7) {
    state.particles.push({
      x: state.player.x + (Math.random() - 0.5) * 1500,
      y: groundY - 10 - Math.random() * 280,
      vx: (Math.random() - 0.5) * 8,
      vy: -(6 + Math.random() * 15),
      life: 2.2 + Math.random() * 2.2, maxLife: 4.4, float: true,
      color: Math.random() < 0.55 ? "#8fd8ff" : (Math.random() < 0.5 ? "#f2c14e" : "#d8f6ff"),
      size: 1 + Math.random() * 1.8,
    });
  }
  updateHubParticles(dt);
  const zoom = Game.zoom || 1.2;
  Game.cam += (clamp(state.player.x - W / 2, 0, Math.max(0, HUB.width - W / zoom)) - Game.cam) * 0.12;
  if (state.player.x > HUB.portalX - 32) {
    saveMeta(Game.meta);
    Game.state = "hub-transition";
    Game.hubTransitionT = 0;
    Game.hubTransitionFromX = state.player.x;
    state.player.vx = 0;
    state.player.jumpH = 0;
    state.player.jumpVy = 0;
    state.payHoldTime = 0;
    Audio.upgrade();
  }
}

export function updateHubTransition(dt, startNewRun) {
  Game.hubT = (Game.hubT || 0) + dt;
  Game.hubTransitionT = (Game.hubTransitionT || 0) + dt;
  Game.time = 0.83;

  const t = clamp(Game.hubTransitionT / HUB_TRANSITION_TIME, 0, 1);
  const eased = 1 - Math.pow(1 - t, 3);
  const p = state.player;
  p.x = lerp(Game.hubTransitionFromX || p.x, HUB.portalX, eased);
  p.dir = 1;
  p.jumpH = Math.sin(t * Math.PI) * 34;

  if (Math.random() < 0.75) {
    const a = Math.random() * Math.PI * 2;
    const r = 32 + Math.random() * 80 * (1 - t * 0.4);
    state.particles.push({
      x: HUB.portalX + Math.cos(a) * r,
      y: groundY - 70 + Math.sin(a) * r * 0.75,
      vx: -Math.cos(a) * (40 + 150 * t),
      vy: -Math.sin(a) * (20 + 90 * t),
      life: 0.45 + Math.random() * 0.28,
      color: Math.random() < 0.55 ? "#8fd8ff" : "#d8f6ff",
      size: 2 + Math.random() * 3,
    });
  }

  updateHubParticles(dt);
  const zoom = Game.zoom || 1.2;
  Game.cam += (clamp(HUB.portalX - W / 2, 0, Math.max(0, HUB.width - W / zoom)) - Game.cam) * 0.1;

  if (t >= 1) {
    saveMeta(Game.meta);
    startNewRun();
  }
}

function upgradeLabel(upg) {
  return HUB_UPGRADE_LABELS[upg.id] || upg.icon || upg.name;
}

function ghostBodyPath(t, sway = 1) {
  const w1 = Math.sin(t * 5.5) * 3.2 * sway;
  const w2 = Math.sin(t * 5.5 + 2.1) * 3.2 * sway;
  const w3 = Math.sin(t * 5.5 + 4.2) * 3.2 * sway;
  ctx.beginPath();
  ctx.moveTo(-17, 2);
  ctx.quadraticCurveTo(-20, -32, -9, -46);
  ctx.quadraticCurveTo(0, -55, 9, -46);
  ctx.quadraticCurveTo(20, -32, 17, 2);
  ctx.quadraticCurveTo(13, 12 + w1, 8, 3);
  ctx.quadraticCurveTo(4, 14 + w2, 0, 4);
  ctx.quadraticCurveTo(-4, 14 + w3, -8, 3);
  ctx.quadraticCurveTo(-13, 11 + w1, -17, 2);
  ctx.closePath();
}

function drawHubPlayer() {
  const p = state.player;
  const t = Game.hubT || 0;
  const hover = Math.sin(t * 2.6 + p.x * 0.02) * 4.5;
  const y = groundY - 40 - (p.jumpH || 0) + hover;
  const moving = Math.abs(p.vx) > 10;

  // ground glow beneath the ghost
  ctx.save();
  ctx.fillStyle = "rgba(120,200,255,0.16)";
  ctx.beginPath(); ctx.ellipse(p.x, groundY + 2, 22, 5.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const gg = ctx.createRadialGradient(p.x, groundY, 2, p.x, groundY, 34);
  gg.addColorStop(0, "rgba(140,215,255,0.22)");
  gg.addColorStop(1, "rgba(60,130,255,0)");
  ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(p.x, groundY, 34, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();

  // afterimages while moving
  if (p.ghostTrail) {
    for (const g of p.ghostTrail) {
      const a = clamp(g.life / 0.32, 0, 1) * 0.16;
      ctx.save();
      ctx.translate(g.x, groundY - 40 - g.h + hover);
      if (g.dir < 0) ctx.scale(-1, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = "#8fd8ff";
      ghostBodyPath(t, 0);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.save();
  ctx.translate(p.x, y);
  if (p.dir < 0) ctx.scale(-1, 1);
  if (moving) ctx.rotate(clamp(Math.abs(p.vx) / 430, 0, 1) * 0.14);

  // spirit aura
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const aura = ctx.createRadialGradient(0, -22, 4, 0, -22, 52);
  aura.addColorStop(0, `rgba(210,248,255,${0.32 + Math.sin(t * 3.4) * 0.07})`);
  aura.addColorStop(1, "rgba(90,170,255,0)");
  ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(0, -22, 52, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // trailing spirit tail behind the body
  ctx.save();
  ctx.globalAlpha = moving ? 0.4 : 0.24;
  ctx.strokeStyle = "#aee8ff";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  const tl = moving ? 30 : 16;
  ctx.beginPath();
  ctx.moveTo(-12, -8);
  ctx.quadraticCurveTo(-16 - tl * 0.5, -2 + Math.sin(t * 6) * 5, -14 - tl, 6 + Math.sin(t * 6 + 1.4) * 6);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-10, -22);
  ctx.quadraticCurveTo(-14 - tl * 0.4, -20 + Math.sin(t * 6 + 0.8) * 4, -12 - tl * 0.8, -12 + Math.sin(t * 6 + 2.2) * 5);
  ctx.stroke();
  ctx.restore();

  // main cloak
  ctx.fillStyle = "rgba(196,238,255,0.62)";
  ghostBodyPath(t, 1);
  ctx.fill();

  // inner luminous core
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const core = ctx.createRadialGradient(2, -26, 2, 2, -26, 26);
  core.addColorStop(0, "rgba(240,252,255,0.5)");
  core.addColorStop(1, "rgba(140,215,255,0)");
  ctx.fillStyle = core;
  ghostBodyPath(t, 1);
  ctx.fill();
  ctx.restore();

  // edge highlight
  ctx.strokeStyle = "rgba(226,248,255,0.5)";
  ctx.lineWidth = 1.4;
  ghostBodyPath(t, 1);
  ctx.stroke();

  // hood hollow + face
  ctx.fillStyle = "rgba(10,22,40,0.82)";
  ctx.beginPath(); ctx.ellipse(3, -35, 9.5, 10.5, 0.1, 0, Math.PI * 2); ctx.fill();
  const blink = Math.sin(t * 0.9 + 1.3) > 0.985 ? 0.15 : 1;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const eg = ctx.createRadialGradient(3, -36, 1, 3, -36, 12);
  eg.addColorStop(0, "rgba(160,230,255,0.55)");
  eg.addColorStop(1, "rgba(80,170,255,0)");
  ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(3, -36, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#d8f6ff";
  ctx.beginPath();
  ctx.ellipse(-0.5, -37, 2, 2.6 * blink, 0, 0, Math.PI * 2);
  ctx.ellipse(7, -37, 2, 2.6 * blink, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // wisp arms
  ctx.strokeStyle = "rgba(210,248,255,0.42)";
  ctx.lineWidth = 3; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(14, -26); ctx.quadraticCurveTo(24, -18 + Math.sin(t * 4) * 3, 21, -8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-14, -26); ctx.quadraticCurveTo(-24, -18 + Math.sin(t * 4 + 1) * 3, -21, -8); ctx.stroke();

  // small soul flame hovering by the front hand
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const fx = 24, fy = -12 + Math.sin(t * 5) * 2.5;
  const fg = ctx.createRadialGradient(fx, fy, 1, fx, fy, 10);
  fg.addColorStop(0, "rgba(220,250,255,0.9)");
  fg.addColorStop(0.5, "rgba(120,205,255,0.45)");
  fg.addColorStop(1, "rgba(60,140,255,0)");
  ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(fx, fy, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#eafcff";
  ctx.beginPath(); ctx.arc(fx, fy, 2.6 + Math.sin(t * 8) * 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // floating ember crown
  const cy = -56 - Math.sin(t * 3.1) * 2.5;
  ctx.save();
  ctx.translate(0, cy);
  ctx.rotate(Math.sin(t * 1.7) * 0.06);
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const cg = ctx.createRadialGradient(0, 0, 2, 0, 0, 20);
  cg.addColorStop(0, "rgba(255,214,110,0.5)");
  cg.addColorStop(1, "rgba(255,160,50,0)");
  ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#f2c14e";
  ctx.beginPath();
  ctx.moveTo(-10, 4); ctx.lineTo(-10, -3); ctx.lineTo(-5, -10); ctx.lineTo(-2, -3);
  ctx.lineTo(0, -12); ctx.lineTo(2, -3); ctx.lineTo(5, -10); ctx.lineTo(10, -3); ctx.lineTo(10, 4);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#ffe9a3"; ctx.fillRect(-10, 2, 20, 2.4);
  ctx.fillStyle = "#8fd8ff";
  ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawNpc(x) {
  const t = Game.hubT || 0;
  const bob = Math.sin(t * 2.3) * 2;
  ctx.save();
  ctx.translate(x, groundY + bob);
  ctx.fillStyle = "rgba(0,0,0,0.32)"; ctx.beginPath(); ctx.ellipse(0, 2, 24, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(0, -62, 4, 0, -62, 54);
  g.addColorStop(0, "rgba(150,220,255,0.28)"); g.addColorStop(1, "rgba(70,120,255,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -62, 54, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#151423"; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.quadraticCurveTo(-15, -52, 0, -78); ctx.quadraticCurveTo(18, -52, 18, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#25223a"; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(-9, -48, 0, -72); ctx.quadraticCurveTo(10, -48, 10, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#8fd8ff"; ctx.beginPath(); ctx.arc(-4, -55, 2, 0, Math.PI * 2); ctx.arc(5, -55, 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#8fd8ff"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(18, -34); ctx.lineTo(38, -92); ctx.stroke();
  ctx.fillStyle = "#d8f6ff"; ctx.beginPath(); ctx.arc(38, -96, 5 + Math.sin(t * 5) * 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawRelicFlame(x, y, s, color, t) {
  const lean = Math.sin(t * 5.2 + x) * s * 0.9;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 7);
  ctx.quadraticCurveTo(x - s * 5 + lean, y - s * 1, x, y - s * 10);
  ctx.quadraticCurveTo(x + s * 6 + lean, y - s * 1, x, y + s * 7);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.moveTo(x, y + s * 3);
  ctx.quadraticCurveTo(x - s * 2 + lean * 0.4, y - s * 1, x, y - s * 5);
  ctx.quadraticCurveTo(x + s * 2 + lean * 0.4, y - s * 1, x, y + s * 3);
  ctx.closePath();
  ctx.fill();
}

function drawUpgradeRelic(upg, lvl, maxed, affordable, spin, t) {
  const color = maxed ? "#ffe2a0" : upg.color;
  const lit = maxed || affordable;
  const iconAlpha = lit ? 1 : 0.74;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.rotate(t * 0.58 + upg.x * 0.01);
  ctx.strokeStyle = color + (lit ? "99" : "55");
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(0, -25); ctx.lineTo(20, 0); ctx.lineTo(0, 25); ctx.lineTo(-20, 0); ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = color + "44";
  ctx.beginPath();
  ctx.ellipse(0, 0, 25, 8, 0, 0, Math.PI * 2);
  ctx.ellipse(0, 0, 8, 25, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + t * 0.9;
    ctx.fillStyle = i < lvl ? color : "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 27, Math.sin(a) * 9, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = "rgba(10,9,18,0.78)";
  ctx.strokeStyle = color + (lit ? "aa" : "66");
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -25);
  ctx.lineTo(18, -11);
  ctx.lineTo(19, 12);
  ctx.lineTo(0, 25);
  ctx.lineTo(-19, 12);
  ctx.lineTo(-18, -11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = lit ? 0.32 + Math.abs(spin) * 0.16 : 0.18;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(14, -8);
  ctx.lineTo(0, 0);
  ctx.lineTo(-14, -8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.globalAlpha = iconAlpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;

  switch (upg.id) {
    case "heart":
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 13);
      ctx.bezierCurveTo(-19, 0, -16, -15, -5, -12);
      ctx.bezierCurveTo(-1, -11, 0, -7, 0, -6);
      ctx.bezierCurveTo(0, -7, 2, -11, 6, -12);
      ctx.bezierCurveTo(17, -15, 20, 0, 0, 13);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,238,238,0.7)";
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-7, -5); ctx.quadraticCurveTo(-1, -1, 0, 8); ctx.stroke();
      break;
    case "blade":
      ctx.save();
      ctx.rotate(-0.58);
      ctx.fillStyle = "#dfe8f2";
      ctx.beginPath();
      ctx.moveTo(0, -19); ctx.lineTo(6, 5); ctx.lineTo(0, 15); ctx.lineTo(-6, 5); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.strokeStyle = "#fff6c8"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 12); ctx.stroke();
      ctx.strokeStyle = "#84613a"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-9, 8); ctx.lineTo(9, 8); ctx.stroke();
      ctx.strokeStyle = "#5b3928"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, 21); ctx.stroke();
      ctx.restore();
      break;
    case "purse":
      ctx.fillStyle = "#8a5630";
      ctx.beginPath();
      ctx.moveTo(-12, -3); ctx.quadraticCurveTo(-19, 9, -9, 17); ctx.lineTo(9, 17);
      ctx.quadraticCurveTo(19, 9, 12, -3); ctx.quadraticCurveTo(6, 2, 0, 2); ctx.quadraticCurveTo(-6, 2, -12, -3);
      ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.strokeStyle = "#d8a64c"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-11, -5); ctx.quadraticCurveTo(0, -10, 11, -5); ctx.stroke();
      ctx.fillStyle = "#f2c14e";
      for (const x of [-5, 2, 8]) { ctx.beginPath(); ctx.arc(x, 8 + (x % 2), 3, 0, Math.PI * 2); ctx.fill(); }
      break;
    case "ember":
      ctx.fillStyle = "#f2c14e";
      ctx.beginPath();
      ctx.moveTo(-15, 5); ctx.lineTo(-14, -4); ctx.lineTo(-8, -12); ctx.lineTo(-4, -4);
      ctx.lineTo(0, -15); ctx.lineTo(4, -4); ctx.lineTo(8, -12); ctx.lineTo(14, -4); ctx.lineTo(15, 5);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffe9a3"; ctx.fillRect(-15, 4, 30, 4);
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      drawRelicFlame(0, 6, 1.05, "#8fd8ff", t);
      ctx.restore();
      break;
    case "regen":
      ctx.fillStyle = "#162c2b";
      ctx.beginPath(); ctx.ellipse(0, 10, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#9bd05a";
      ctx.beginPath(); ctx.ellipse(0, 7, 11, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#dce6ff";
      ctx.beginPath(); ctx.arc(-2, -8, 10, -1.2, 1.45 * Math.PI); ctx.fill();
      ctx.fillStyle = "rgba(10,9,18,0.86)";
      ctx.beginPath(); ctx.arc(3, -11, 10, -1.2, 1.45 * Math.PI); ctx.fill();
      break;
    case "wanderer_lantern":
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, -9, 10, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = "#211a28"; ctx.fillRect(-10, -8, 20, 22);
      ctx.strokeStyle = "#7b6a8d"; ctx.strokeRect(-10, -8, 20, 22);
      ctx.fillStyle = "#2e2737"; ctx.fillRect(-13, -12, 26, 5);
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const lg = ctx.createRadialGradient(0, 3, 1, 0, 3, 16);
      lg.addColorStop(0, "rgba(255,244,190,0.9)");
      lg.addColorStop(1, color + "00");
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(0, 3, 16, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#fff2bc"; ctx.fillRect(-3, -3, 6, 11);
      break;
    case "grave_bow":
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-12, -18); ctx.quadraticCurveTo(8, 0, -12, 18); ctx.stroke();
      ctx.strokeStyle = "rgba(230,255,238,0.75)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-12, -18); ctx.lineTo(-12, 18); ctx.stroke();
      ctx.strokeStyle = "#d8f6ff"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(13, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(7, -4); ctx.moveTo(13, 0); ctx.lineTo(7, 4); ctx.stroke();
      break;
    case "oath_sparks":
      ctx.fillStyle = "#241c2b";
      ctx.beginPath(); ctx.moveTo(-15, 14); ctx.lineTo(15, 14); ctx.lineTo(11, -5); ctx.lineTo(-11, -5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 1;
      for (const x of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 3, 9); ctx.stroke(); }
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      drawRelicFlame(-7, -8, 0.75, "#ff9bd2", t);
      drawRelicFlame(7, -8, 0.75, "#b9a7ff", t + 0.7);
      ctx.restore();
      break;
    case "moon_cache":
      ctx.fillStyle = "#24324c";
      ctx.fillRect(-15, -1, 30, 17);
      ctx.fillStyle = "#304161";
      ctx.fillRect(-17, -7, 34, 8);
      ctx.strokeStyle = "#d9e8ff"; ctx.lineWidth = 1.4; ctx.strokeRect(-15, -1, 30, 17);
      ctx.fillStyle = "#f2c14e";
      for (const x of [-8, 0, 8]) { ctx.beginPath(); ctx.arc(x, -9, 3.2, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = "#d9e8ff";
      ctx.beginPath(); ctx.arc(0, 6, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#24324c";
      ctx.beginPath(); ctx.arc(3, 4, 5, 0, Math.PI * 2); ctx.fill();
      break;
    case "old_crew":
      for (const x of [-7, 8]) {
        ctx.fillStyle = x < 0 ? "#7fd6a4" : "#d9c38f";
        ctx.beginPath(); ctx.arc(x, -8, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 7, 12); ctx.quadraticCurveTo(x, -1, x + 7, 12); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = "#ffcf5a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-18, 15); ctx.quadraticCurveTo(0, 20, 18, 15); ctx.stroke();
      ctx.fillStyle = "#ffcf5a"; ctx.fillRect(-8, 13, 16, 3);
      break;
    case "stone_oath":
      ctx.fillStyle = "#8f8f9f";
      for (let row = 0; row < 3; row++) {
        const y = -7 + row * 8;
        const offset = row % 2 ? -7 : 0;
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(offset - 16 + i * 14, y, 12, 6);
          ctx.strokeStyle = "#393746"; ctx.lineWidth = 0.8; ctx.strokeRect(offset - 16 + i * 14, y, 12, 6);
        }
      }
      ctx.strokeStyle = color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-19, 18); ctx.lineTo(19, 18); ctx.stroke();
      break;
    case "crowned_camp":
      ctx.fillStyle = "#72523a";
      ctx.beginPath(); ctx.moveTo(-18, 15); ctx.lineTo(0, -10); ctx.lineTo(18, 15); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = "#241827";
      ctx.beginPath(); ctx.moveTo(-5, 15); ctx.lineTo(0, 0); ctx.lineTo(6, 15); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f2c14e";
      ctx.beginPath(); ctx.moveTo(-8, -13); ctx.lineTo(-5, -19); ctx.lineTo(0, -14); ctx.lineTo(5, -19); ctx.lineTo(8, -13); ctx.closePath(); ctx.fill();
      break;
    case "ghost_bow":
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(210,248,255,0.52)";
      ctx.beginPath(); ctx.arc(4, -4, 11, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = "rgba(10,20,35,0.85)";
      ctx.beginPath(); ctx.ellipse(5, -5, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-14, -18); ctx.quadraticCurveTo(8, 0, -14, 18); ctx.stroke();
      ctx.strokeStyle = "#d8f6ff"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-14, -18); ctx.lineTo(-14, 18); ctx.moveTo(-19, 1); ctx.lineTo(15, -5); ctx.stroke();
      break;
    case "builder_cache":
      ctx.save();
      ctx.rotate(-0.62);
      ctx.fillStyle = "#6f4a2a";
      ctx.fillRect(-3, -4, 6, 25);
      ctx.fillStyle = "#c8a060";
      ctx.fillRect(-13, -13, 26, 10);
      ctx.strokeStyle = color; ctx.lineWidth = 1.3; ctx.strokeRect(-13, -13, 26, 10);
      ctx.restore();
      ctx.fillStyle = "#f2a230";
      ctx.beginPath(); ctx.arc(9, 10, 3, 0, Math.PI * 2); ctx.fill();
      break;
    case "armory_token":
      ctx.fillStyle = "#27344a";
      ctx.beginPath();
      ctx.moveTo(0, -17); ctx.lineTo(15, -10); ctx.lineTo(12, 9); ctx.quadraticCurveTo(0, 19, -12, 9); ctx.lineTo(-15, -10); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.strokeStyle = "#dfe8f2"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(0, 14); ctx.moveTo(-9, -5); ctx.quadraticCurveTo(0, 1, 9, -5); ctx.stroke();
      break;
    case "war_banner":
      ctx.strokeStyle = "#d9c38f"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-9, 18); ctx.lineTo(-9, -18); ctx.stroke();
      ctx.fillStyle = "#7d2530";
      ctx.beginPath(); ctx.moveTo(-8, -17); ctx.lineTo(15, -12); ctx.lineTo(10, 3); ctx.lineTo(-8, -2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(1, -11); ctx.lineTo(5, -5); ctx.lineTo(1, 1); ctx.lineTo(-3, -5); ctx.closePath(); ctx.fill();
      break;
    case "relic_compass":
      ctx.fillStyle = "#1b2235";
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffcf5a";
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(5, 3); ctx.lineTo(0, 0); ctx.lineTo(-5, 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#8fd8ff";
      ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(5, -3); ctx.lineTo(0, 0); ctx.lineTo(-5, -3); ctx.closePath(); ctx.fill();
      break;
    case "dawn_masonry":
      ctx.fillStyle = "#777486";
      ctx.fillRect(-16, 3, 32, 15);
      ctx.fillStyle = "#8c899c";
      for (let i = 0; i < 3; i++) ctx.fillRect(-15 + i * 11, -7, 9, 9);
      ctx.strokeStyle = "#34313e"; ctx.lineWidth = 1;
      ctx.strokeRect(-16, 3, 32, 15);
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "#ffe28a";
      ctx.beginPath(); ctx.arc(0, -14, 7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      break;
    case "blood_moon":
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "#ff5d6c";
      ctx.beginPath(); ctx.arc(0, -1, 16, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = "rgba(10,9,18,0.88)";
      ctx.beginPath(); ctx.arc(7, -5, 15, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#ffd0d6"; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(0, -1, 16, 0.32 * Math.PI, 1.68 * Math.PI); ctx.stroke();
      break;
    case "hungry_portals":
      ctx.strokeStyle = color; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(-15, 15); ctx.quadraticCurveTo(0, -21, 15, 15); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "#ffd0a0"; ctx.lineWidth = 1.3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.ellipse(0, 1, 5 + i * 4, 12 + i * 2, t * 0.4 + i, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
      break;
    case "ashen_elites":
      ctx.fillStyle = "#2a2033";
      ctx.beginPath(); ctx.moveTo(-14, 7); ctx.lineTo(-8, -14); ctx.lineTo(0, -18); ctx.lineTo(8, -14); ctx.lineTo(14, 7); ctx.lineTo(6, 17); ctx.lineTo(-6, 17); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "#ffd060";
      ctx.beginPath(); ctx.arc(-5, 0, 2, 0, Math.PI * 2); ctx.arc(5, 0, 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#d8d1ff"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(-19, -17); ctx.moveTo(10, -10); ctx.lineTo(19, -17); ctx.stroke();
      break;
    case "iron_hide":
      ctx.fillStyle = "#555b67";
      ctx.beginPath();
      ctx.moveTo(0, -18); ctx.lineTo(14, -9); ctx.lineTo(12, 9); ctx.quadraticCurveTo(0, 18, -12, 9); ctx.lineTo(-14, -9); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.strokeStyle = "#e7edf6"; ctx.lineWidth = 1;
      for (const x of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x, 9); ctx.stroke(); }
      break;
    default:
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(13, 0); ctx.lineTo(0, 17); ctx.lineTo(-13, 0); ctx.closePath(); ctx.fill();
      break;
  }

  ctx.globalAlpha = 1;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = "rgba(255,255,255,0.36)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-13, -17);
  ctx.quadraticCurveTo(-4, -23, 10, -16);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawAltar(upg) {
  const lvl = metaLevel(upg.id);
  const maxed = lvl >= upg.max;
  const t = Game.hubT || 0;
  const cost = maxed ? 0 : upg.cost(lvl);
  const affordable = !maxed && (state.player?.coins || 0) >= cost;
  const near = state.player && dist(state.player.x, upg.x) < 95;
  const pulse = 0.62 + Math.sin(t * 3 + upg.x) * 0.14;
  ctx.save();
  ctx.translate(upg.x, groundY);
  ctx.textAlign = "center";

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.beginPath(); ctx.ellipse(0, 1, 40, 7, 0, 0, Math.PI * 2); ctx.fill();

  // stepped stone base
  ctx.fillStyle = "#28243a"; ctx.fillRect(-32, -9, 64, 9);
  ctx.fillStyle = "#353048"; ctx.fillRect(-25, -18, 50, 9);
  ctx.fillStyle = "#413b56"; ctx.fillRect(-18, -27, 36, 9);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fillRect(-32, -9, 64, 1.6); ctx.fillRect(-25, -18, 50, 1.6); ctx.fillRect(-18, -27, 36, 1.6);

  // pillar with carved rune line
  ctx.fillStyle = "#4c455f"; ctx.fillRect(-8, -54, 16, 27);
  ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(-8, -54, 4, 27);
  ctx.fillStyle = "#575070"; ctx.fillRect(-11, -58, 22, 5);
  ctx.strokeStyle = upg.color + (maxed ? "55" : "88");
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, -50); ctx.lineTo(0, -31); ctx.moveTo(-4, -44); ctx.lineTo(4, -44); ctx.moveTo(-3, -37); ctx.lineTo(3, -37); ctx.stroke();

  // rank pips on the top step
  for (let i = 0; i < upg.max; i++) {
    const px = (i - (upg.max - 1) / 2) * 8.5;
    ctx.fillStyle = i < lvl ? upg.color : "rgba(255,255,255,0.14)";
    ctx.beginPath(); ctx.moveTo(px, -25.5); ctx.lineTo(px + 2.6, -22.5); ctx.lineTo(px, -19.5); ctx.lineTo(px - 2.6, -22.5); ctx.closePath(); ctx.fill();
  }

  // relic glow
  const gy = -76 + Math.sin(t * 2 + upg.x * 0.6) * 3;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = maxed ? 0.2 : (affordable ? pulse + 0.18 : pulse * 0.55);
  const rg = ctx.createRadialGradient(0, gy, 3, 0, gy, 40);
  rg.addColorStop(0, upg.color); rg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, gy, 40, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // floating relic: each upgrade now has a readable object, with the old shine kept as a rotating seal.
  const spin = Math.sin(t * 1.9 + upg.x * 0.3);
  ctx.save();
  ctx.translate(0, gy);
  drawUpgradeRelic(upg, lvl, maxed, affordable, spin, t);
  ctx.restore();

  if (maxed) {
    // golden halo ring for fully awakened seals
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(255,222,140,0.7)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, gy, 20 + Math.sin(t * 2.4) * 1.5, 7, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  } else {
    // orbiting sparks
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 2; i++) {
      const a = t * 1.6 + i * Math.PI + upg.x;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath(); ctx.arc(Math.cos(a) * 21, gy + Math.sin(a) * 8, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // rank text
  ctx.fillStyle = maxed ? "#ffe9a3" : "#cfc6b0";
  ctx.font = "11px sans-serif";
  ctx.fillText(`${lvl}/${upg.max}`, 0, gy - 26);

  // readable upgrade plaque
  const plaqueLabel = upgradeLabel(upg);
  const costText = maxed ? "MAX" : `${cost} embers`;
  ctx.fillStyle = near ? "rgba(12,10,20,0.86)" : "rgba(12,10,20,0.68)";
  ctx.fillRect(-44, 8, 88, 35);
  ctx.strokeStyle = upg.color + (near ? "cc" : "66");
  ctx.lineWidth = near ? 1.6 : 1;
  ctx.strokeRect(-44, 8, 88, 35);
  ctx.fillStyle = near ? "#f7eed4" : "#d8d1bf";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText(plaqueLabel, 0, 22);
  ctx.fillStyle = maxed ? "#ffe9a3" : (affordable ? "#bff5c8" : "#cfc6b0");
  ctx.font = "10px sans-serif";
  ctx.fillText(`${lvl}/${upg.max} - ${costText}`, 0, 37);

  // name + cost tag when the player is near
  if (near) {
    ctx.fillStyle = "rgba(10,9,18,0.82)";
    const label = maxed ? upg.name : `${upg.name} - ${cost}`;
    ctx.font = "bold 12px sans-serif";
    const tw = ctx.measureText(label).width + 18;
    ctx.fillRect(-tw / 2, gy - 58, tw, 20);
    ctx.strokeStyle = upg.color + "aa"; ctx.lineWidth = 1;
    ctx.strokeRect(-tw / 2, gy - 58, tw, 20);
    ctx.fillStyle = maxed ? "#ffe9a3" : (affordable ? "#eafcd8" : "#ff9d84");
    ctx.fillText(label, 0, gy - 44);
  }

  ctx.restore();
}

const HUB_TIERS = [
  {
    rank: "I",
    title: "EMBER FOUNDATIONS",
    x0: 575, x1: 1145, cx: 860, width: 316, color: "#9bd05a",
  },
  {
    rank: "II",
    title: "WAYFARER OATHS",
    x0: 1265, x1: 1725, cx: 1495, width: 304, color: "#b9a7ff",
  },
  {
    rank: "III",
    title: "ROYAL LEGACIES",
    x0: 1885, x1: 2345, cx: 2115, width: 316, color: "#f2c14e",
  },
  {
    rank: "IV",
    title: "CROWN RELICS",
    x0: 2490, x1: 3050, cx: 2770, width: 316, color: "#d9e8ff",
  },
  {
    rank: "V",
    title: "DREAD PACTS",
    x0: 3210, x1: 3660, cx: 3435, width: 300, color: "#ff5d6c",
  },
];

function drawBrazier(x, color, t) {
  ctx.save();
  ctx.translate(x, groundY);
  ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(0, 1, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#332e44"; ctx.fillRect(-5, -30, 10, 30);
  ctx.fillStyle = "#443e58"; ctx.fillRect(-9, -36, 18, 7);
  ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.fillRect(-5, -30, 2.4, 30);
  const flick = Math.sin(t * 7.3 + x) * 0.5 + Math.sin(t * 11.7 + x * 2) * 0.3;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const fg = ctx.createRadialGradient(0, -44, 2, 0, -44, 26 + flick * 4);
  fg.addColorStop(0, color + "cc");
  fg.addColorStop(0.45, color + "44");
  fg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, -44, 26 + flick * 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.moveTo(-4, -37);
  ctx.quadraticCurveTo(-5 + flick, -46, 0, -52 - flick * 3);
  ctx.quadraticCurveTo(5 + flick, -46, 4, -37);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawTierPlazas() {
  const t = Game.hubT || 0;
  ctx.save();
  ctx.textAlign = "center";
  for (const tier of HUB_TIERS) {
    // raised stone platform
    ctx.fillStyle = "#221e30";
    ctx.fillRect(tier.x0 - 28, groundY - 4, tier.x1 - tier.x0 + 56, 26);
    ctx.fillStyle = "#2b2640";
    ctx.fillRect(tier.x0 - 22, groundY - 4, tier.x1 - tier.x0 + 44, 4);
    ctx.strokeStyle = tier.color + "40"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(tier.x0 - 22, groundY - 3); ctx.lineTo(tier.x1 + 22, groundY - 3); ctx.stroke();
    // paving joints
    ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1;
    for (let x = tier.x0; x < tier.x1; x += 56) {
      ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x - 5, groundY + 20); ctx.stroke();
    }

    // ambient light shaft over the plaza
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const sg = ctx.createRadialGradient(tier.cx, groundY - 120, 10, tier.cx, groundY - 120, 260);
    sg.addColorStop(0, tier.color + "16");
    sg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(tier.cx, groundY - 120, 260, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    drawBrazier(tier.x0 - 46, tier.color, t);
    drawBrazier(tier.x1 + 46, tier.color, t);

    // carved tier directory
    const bw = tier.width || 304;
    const bh = 78;
    const bx = tier.cx - bw / 2;
    const by = groundY - 222 + Math.sin(t * 1.1 + tier.cx) * 1.4;

    ctx.fillStyle = "#151220";
    ctx.beginPath();
    ctx.moveTo(bx + 18, by + 12);
    ctx.quadraticCurveTo(tier.cx, by - 14, bx + bw - 18, by + 12);
    ctx.lineTo(bx + bw, by + bh - 14);
    ctx.lineTo(bx + bw - 18, by + bh);
    ctx.lineTo(bx + 18, by + bh);
    ctx.lineTo(bx, by + bh - 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.beginPath();
    ctx.moveTo(bx + 22, by + 14);
    ctx.quadraticCurveTo(tier.cx, by - 5, bx + bw - 22, by + 14);
    ctx.lineTo(bx + bw - 32, by + 28);
    ctx.lineTo(bx + 32, by + 28);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = tier.color + "99"; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(bx + 18, by + 12);
    ctx.quadraticCurveTo(tier.cx, by - 14, bx + bw - 18, by + 12);
    ctx.lineTo(bx + bw, by + bh - 14);
    ctx.lineTo(bx + bw - 18, by + bh);
    ctx.lineTo(bx + 18, by + bh);
    ctx.lineTo(bx, by + bh - 14);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = tier.color + "33"; ctx.lineWidth = 1;
    ctx.strokeRect(bx + 9, by + 24, bw - 18, bh - 34);

    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const rg = ctx.createRadialGradient(tier.cx, by + 26, 3, tier.cx, by + 26, bw * 0.45);
    rg.addColorStop(0, tier.color + "33");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.ellipse(tier.cx, by + 36, bw * 0.45, 34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#211b2d";
    ctx.beginPath(); ctx.arc(bx + 28, by + 34, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = tier.color + "aa"; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.fillStyle = tier.color;
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(tier.rank, bx + 28, by + 38);

    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = tier.color;
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(tier.title, tier.cx + 14, by + 43, bw - 78);
    ctx.restore();

    ctx.strokeStyle = tier.color + "55"; ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const rx = bx + 50 + i * ((bw - 72) / 4);
      ctx.beginPath();
      ctx.moveTo(rx - 4, by + bh - 10);
      ctx.lineTo(rx, by + bh - 15);
      ctx.lineTo(rx + 4, by + bh - 10);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBluePortal(x) {
  const t = Game.hubT || 0;
  ctx.save();
  ctx.translate(x, groundY);
  ctx.fillStyle = "#071627"; ctx.beginPath(); ctx.moveTo(-86, 0); ctx.quadraticCurveTo(0, -175, 86, 0); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const rg = ctx.createRadialGradient(0, -72, 8, 0, -72, 82 + Math.sin(t * 2) * 5);
  rg.addColorStop(0, "rgba(210,248,255,0.95)");
  rg.addColorStop(0.35, "rgba(70,170,255,0.68)");
  rg.addColorStop(1, "rgba(40,70,255,0)");
  ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(0, -70, 44, 74, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#76d8ff"; ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(0, -70, 24 + i * 10 + Math.sin(t * 2 + i) * 3, 48 + i * 5, t * 0.3 + i, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function ledgerPanelPath(x, y, w, h, r = 14) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawLedgerCrown(x, y, s, t) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 2.4) * 1.4);
  ctx.scale(s, s);
  ctx.rotate(Math.sin(t * 1.7) * 0.05);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(0, -2, 2, 0, -2, 22);
  glow.addColorStop(0, "rgba(255,226,150,0.58)");
  glow.addColorStop(1, "rgba(255,160,50,0)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, -2, 22, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#f2c14e";
  ctx.beginPath();
  ctx.moveTo(-13, 6); ctx.lineTo(-12, -3); ctx.lineTo(-7, -11); ctx.lineTo(-3, -3);
  ctx.lineTo(0, -14); ctx.lineTo(3, -3); ctx.lineTo(7, -11); ctx.lineTo(12, -3); ctx.lineTo(13, 6);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#ffe9a3";
  ctx.fillRect(-13, 4, 26, 3);
  ctx.fillStyle = "#8fd8ff";
  ctx.beginPath(); ctx.arc(0, -1, 2.1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawHubLeaderboard() {
  const entries = normalizeLeaderboard(Game.meta?.leaderboard || []);
  const t = Game.hubT || 0;
  const w = 362;
  const rowH = 36;
  const h = 94 + Math.max(1, entries.length) * rowH;
  const x = HUB.spawnX;
  const y = groundY - h - 96 - h * 0.3 + Math.sin(t * 1.15) * 5;
  const left = -w / 2;
  const lastId = Game.meta?.lastLeaderboardEntryId;
  const lastRank = Game.meta?.lastLeaderboardRank || 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath(); ctx.ellipse(0, h + 67, w * 0.33, 13, 0, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const aura = ctx.createRadialGradient(0, h * 0.46, 20, 0, h * 0.46, w * 0.72);
  aura.addColorStop(0, "rgba(143,216,255,0.2)");
  aura.addColorStop(0.5, "rgba(242,193,78,0.08)");
  aura.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.ellipse(0, h * 0.48, w * 0.74, h * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(143,216,255,0.28)";
  ctx.lineWidth = 1.1;
  for (const sx of [-w * 0.34, w * 0.34]) {
    ctx.beginPath();
    ctx.moveTo(sx, -20 + Math.sin(t * 1.8 + sx) * 2);
    ctx.quadraticCurveTo(sx * 0.95, -6, sx * 0.88, 14);
    ctx.stroke();
  }

  const body = ctx.createLinearGradient(0, 0, 0, h);
  body.addColorStop(0, "rgba(18,18,31,0.86)");
  body.addColorStop(0.55, "rgba(9,13,24,0.78)");
  body.addColorStop(1, "rgba(12,10,18,0.88)");
  ledgerPanelPath(left, 0, w, h, 18);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = "rgba(143,216,255,0.74)";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = "rgba(242,193,78,0.28)";
  ctx.lineWidth = 1;
  ledgerPanelPath(left + 8, 8, w - 16, h - 16, 14);
  ctx.stroke();
  for (let i = 0; i < 10; i++) {
    const a = t * 0.35 + i * Math.PI * 0.2;
    const px = Math.cos(a) * (w * 0.44);
    const py = h * 0.48 + Math.sin(a * 1.7) * (h * 0.38);
    ctx.fillStyle = i % 2 ? "rgba(143,216,255,0.5)" : "rgba(242,193,78,0.42)";
    ctx.beginPath(); ctx.arc(px, py, 1.1 + (i % 3) * 0.35, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  drawLedgerCrown(left + 32, 31, 0.72, t);
  ctx.textAlign = "left";
  ctx.fillStyle = "#f2c14e";
  ctx.font = "600 17px Georgia, serif";
  ctx.fillText("EMBER LEDGER", left + 58, 30);
  ctx.fillStyle = lastRank > 0 ? "#ffe9a3" : "#9fdfff";
  ctx.font = "10px sans-serif";
  const sub = lastRank > 0 ? `NEW ENTRY - RANK ${lastRank}` : "TOP RUNS ETCHED IN ASH";
  ctx.fillText(sub, left + 60, 48, w - 82);

  ctx.strokeStyle = "rgba(143,216,255,0.26)";
  ctx.beginPath();
  ctx.moveTo(left + 20, 62);
  ctx.lineTo(left + w - 20, 62);
  ctx.stroke();

  const top = 74;
  if (entries.length === 0) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#cfc6b0";
    ctx.font = "12px sans-serif";
    ctx.fillText("No runs are etched yet", 0, top + 23);
    ctx.restore();
    return;
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const rowTop = top + i * rowH;
    const isNew = entry.id === lastId;
    const isFirst = i === 0;
    const rowAlpha = isNew ? 0.2 + Math.sin(t * 5.5) * 0.06 : (isFirst ? 0.12 : 0.065);

    ledgerPanelPath(left + 14, rowTop - 2, w - 28, rowH - 6, 8);
    ctx.fillStyle = isNew ? `rgba(242,193,78,${rowAlpha})` : `rgba(143,216,255,${rowAlpha})`;
    ctx.fill();
    ctx.strokeStyle = isNew ? "rgba(255,226,150,0.72)" : "rgba(143,216,255,0.22)";
    ctx.lineWidth = isNew ? 1.2 : 0.8;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = isFirst ? "#ffe9a3" : "#8fd8ff";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(`#${i + 1}`, left + 35, rowTop + 18);

    ctx.textAlign = "left";
    ctx.fillStyle = isNew ? "#fff1b8" : "#f7eed4";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(formatLeaderboardScore(entry.score), left + 64, rowTop + 15, 128);
    ctx.fillStyle = "#bfb7a6";
    ctx.font = "10px sans-serif";
    ctx.fillText(`Day ${entry.day}  ${entry.kills} slain  Base ${entry.baseLevel}`, left + 64, rowTop + 29, 190);

    ctx.textAlign = "right";
    ctx.fillStyle = isNew ? "#ffe9a3" : "#9fdfff";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(`+${entry.reward}`, left + w - 28, rowTop + 15);
    ctx.fillStyle = "#8fddff";
    ctx.font = "9px sans-serif";
    ctx.fillText("embers", left + w - 28, rowTop + 28);
  }

  ctx.restore();
}

function drawHubText() {
  ctx.save();
  ctx.fillStyle = "rgba(7,9,16,0.54)";
  ctx.fillRect(0, 0, W, 78);
  ctx.fillStyle = "#f2c14e";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(`Embers: ${Game.meta?.embers || 0}`, 24, 32);
  ctx.fillStyle = "#cfc6b0";
  ctx.font = "13px sans-serif";
  const reward = Game.meta?.lastReward || 0;
  ctx.fillText(`Last run: day ${Game.meta?.lastDay || 1}, ${Game.meta?.lastKills || 0} slain, +${reward} embers. Head right into the blue portal when you are ready.`, 24, 56);
  ctx.restore();
}

function drawHubPrompt() {
  if (Game.state === "hub-transition") return;
  const nearUpgrade = nearestHubUpgrade();
  const portalNear = dist(state.player.x, HUB.portalX) < 120;
  const npcNear = dist(state.player.x, 430) < 110;
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "14px sans-serif";
  if (nearUpgrade) {
    const lvl = metaLevel(nearUpgrade.id);
    const maxed = lvl >= nearUpgrade.max;
    const cost = maxed ? 0 : nearUpgrade.cost(lvl);
    const coins = state.player?.coins || 0;
    const affordable = !maxed && coins >= cost;
    const panelW = Math.min(790, W - 48);
    const panelH = 74;
    const x = W / 2 - panelW / 2;
    const y = H - panelH - 20;
    const progressW = 170;
    const progress = nearUpgrade.max > 0 ? lvl / nearUpgrade.max : 1;

    ctx.fillStyle = "rgba(10,9,18,0.88)";
    ctx.fillRect(x, y, panelW, panelH);
    ctx.strokeStyle = nearUpgrade.color + "cc";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, panelW, panelH);

    ctx.textAlign = "left";
    ctx.fillStyle = nearUpgrade.color;
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(`${upgradeLabel(nearUpgrade)} - ${nearUpgrade.name}`, x + 18, y + 24);
    ctx.fillStyle = "#f3dfb5";
    ctx.font = "13px sans-serif";
    ctx.fillText(`Effect: ${nearUpgrade.desc}`, x + 18, y + 46);

    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x + 18, y + 56, progressW, 8);
    ctx.fillStyle = nearUpgrade.color;
    ctx.fillRect(x + 18, y + 56, progressW * progress, 8);
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.strokeRect(x + 18, y + 56, progressW, 8);

    ctx.textAlign = "right";
    ctx.fillStyle = "#d8d1bf";
    ctx.font = "12px sans-serif";
    ctx.fillText(`Rank ${lvl}/${nearUpgrade.max}`, x + panelW - 18, y + 24);
    ctx.fillStyle = maxed ? "#ffe9a3" : (affordable ? "#bff5c8" : "#ff9d84");
    ctx.font = "bold 13px sans-serif";
    const buyText = maxed ? "Fully upgraded" : affordable ? `Price: ${cost} embers - hold down/S` : `Price: ${cost} embers - missing ${cost - coins}`;
    ctx.fillText(buyText, x + panelW - 18, y + 50);
  } else if (portalNear) {
    ctx.fillStyle = "#bfefff";
    ctx.fillText("Enter the portal to start a new run", W / 2, H - 46);
  } else if (npcNear) {
    ctx.fillStyle = "#cfe6f2";
    ctx.fillText("The Veiled One: Every death is a key. Pay at the seals, crown-bearer.", W / 2, H - 46);
  }
  ctx.restore();
}

function drawHubTransitionOverlay() {
  if (Game.state !== "hub-transition") return;
  const t = clamp((Game.hubTransitionT || 0) / HUB_TRANSITION_TIME, 0, 1);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const x = W * 0.72;
  const y = groundY - 82;
  const rg = ctx.createRadialGradient(x, y, 10, x, y, W * (0.18 + t * 0.75));
  rg.addColorStop(0, `rgba(225,250,255,${0.35 + t * 0.55})`);
  rg.addColorStop(0.25, `rgba(80,185,255,${0.18 + t * 0.34})`);
  rg.addColorStop(1, "rgba(30,70,255,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  if (t > 0.72) {
    ctx.fillStyle = `rgba(230,250,255,${(t - 0.72) / 0.28})`;
    ctx.fillRect(0, 0, W, H);
  }
}

export function renderHub() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#090817");
  sky.addColorStop(0.55, "#171529");
  sky.addColorStop(1, "#0b0b12");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(160,220,255,0.7)";
  for (let i = 0; i < 70; i++) {
    const x = (i * 173 + 41) % W;
    const y = (i * 67 + 19) % Math.max(1, groundY - 120);
    ctx.globalAlpha = 0.25 + ((i % 5) * 0.1);
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#17131b"; ctx.fillRect(0, groundY, W, H - groundY);
  ctx.fillStyle = "#252033"; ctx.fillRect(0, groundY, W, 3);

  const zoom = Game.zoom || 1.2;
  ctx.save();
  ctx.translate(W / 2, groundY); ctx.scale(zoom, zoom); ctx.translate(-W / 2 - Game.cam, -groundY);
  ctx.fillStyle = "#1b1722"; ctx.fillRect(0, groundY - 1, HUB.width, H - groundY + 1);
  ctx.strokeStyle = "rgba(143,216,255,0.18)"; ctx.lineWidth = 2;
  for (let x = 220; x < HUB.width; x += 180) {
    ctx.beginPath(); ctx.moveTo(x, groundY + 8); ctx.lineTo(x + 70, groundY + 22); ctx.stroke();
  }
  drawHubLeaderboard();
  drawNpc(430);
  drawTierPlazas();
  for (const upg of META_UPGRADES) drawAltar(upg);
  drawBluePortal(HUB.portalX);
  for (const p of state.particles) {
    ctx.fillStyle = p.color || "#f2c14e";
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size || 3, 0, Math.PI * 2); ctx.fill();
  }
  drawHubPlayer();
  for (const f of state.floatTexts) {
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.fillStyle = f.color || "#fff";
    ctx.font = `${f.size || 14}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  drawHubText();
  drawHubPrompt();
  drawHubTransitionOverlay();
}
