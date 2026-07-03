import { CFG } from '../../config/config.js';
import { clamp, dist, lerp } from '../../util/math.js';
import { ctx, W, H, groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { keys } from '../input/Input.js';
import { Audio } from './Audio.js';
import { makeUnit } from '../../entities/Unit.js';

const META_KEY = "kingdom_embers_meta_v1";
const HUB = {
  width: 3000,
  spawnX: 520,
  portalX: 2640,
};
const HUB_TRANSITION_TIME = 1.15;

export const META_UPGRADES = [
  {
    id: "heart",
    tier: "basic",
    name: "Blodets Segl",
    desc: "+1 max liv per rang",
    max: 5,
    x: 720,
    color: "#d95b72",
    icon: "HP",
    cost: lvl => 8 + lvl * 7,
  },
  {
    id: "blade",
    tier: "basic",
    name: "Askeslebet Våben",
    desc: "+8% skade per rang",
    max: 6,
    x: 840,
    color: "#f2c14e",
    icon: "DMG",
    cost: lvl => 10 + lvl * 9,
  },
  {
    id: "purse",
    tier: "basic",
    name: "Gravkongens Pung",
    desc: "+3 startguld per rang",
    max: 5,
    x: 960,
    color: "#e6b64a",
    icon: "GOLD",
    cost: lvl => 7 + lvl * 6,
  },
  {
    id: "ember",
    tier: "basic",
    name: "Glødende Krone",
    desc: "+10% ekstra run-belønning per rang",
    max: 4,
    x: 1080,
    color: "#8fd8ff",
    icon: "SOUL",
    cost: lvl => 14 + lvl * 12,
  },
  {
    id: "regen",
    tier: "basic",
    name: "Månebrønd",
    desc: "hurtigere heling udenfor kamp",
    max: 4,
    x: 1200,
    color: "#9bd05a",
    icon: "REGEN",
    cost: lvl => 9 + lvl * 8,
  },
  {
    id: "wanderer_lantern",
    tier: "epic",
    name: "Vildfaren Lygte",
    desc: "+1 ekstra vagabond ved run-start",
    max: 2,
    x: 1450,
    color: "#b9a7ff",
    icon: "VAG",
    cost: lvl => 24 + lvl * 18,
  },
  {
    id: "grave_bow",
    tier: "epic",
    name: "Gravbue",
    desc: "+1 løs bue ved lejrens start",
    max: 2,
    x: 1570,
    color: "#7fd6a4",
    icon: "BOW",
    cost: lvl => 26 + lvl * 20,
  },
  {
    id: "oath_sparks",
    tier: "epic",
    name: "Edsflammer",
    desc: "+1 bue- og vagt-evnepoint",
    max: 2,
    x: 1690,
    color: "#ff9bd2",
    icon: "EP",
    cost: lvl => 30 + lvl * 24,
  },
  {
    id: "moon_cache",
    tier: "epic",
    name: "Månecache",
    desc: "+12 startguld og et lille gnistregn",
    max: 1,
    x: 1810,
    color: "#d9e8ff",
    icon: "CACHE",
    cost: () => 42,
  },
  {
    id: "old_crew",
    tier: "legendary",
    name: "Den Første Ed",
    desc: "start med 1 bueskytte og 1 bygger",
    max: 1,
    x: 2060,
    color: "#ffcf5a",
    icon: "CREW",
    cost: () => 90,
  },
  {
    id: "stone_oath",
    tier: "legendary",
    name: "Steneden",
    desc: "start med 2 niveau 1 mure",
    max: 1,
    x: 2180,
    color: "#c6c6d8",
    icon: "WALL",
    cost: () => 100,
  },
  {
    id: "crowned_camp",
    tier: "legendary",
    name: "Kronet Lejr",
    desc: "start hvert run med base niveau 2",
    max: 1,
    x: 2300,
    color: "#f2c14e",
    icon: "BASE",
    cost: () => 125,
  },
  {
    id: "ghost_bow",
    tier: "legendary",
    name: "Spøgelsespil",
    desc: "start selv med en kortbue",
    max: 1,
    x: 2420,
    color: "#8fd8ff",
    icon: "HERO",
    cost: () => 115,
  },
];

function defaultMeta() {
  return { embers: 0, upgrades: {}, totalRuns: 0, bestDay: 1, totalKills: 0, lastReward: 0, lastDay: 1, lastKills: 0 };
}

export function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return defaultMeta();
    return { ...defaultMeta(), ...JSON.parse(raw) };
  } catch (e) {
    return defaultMeta();
  }
}

export function saveMeta(meta = Game.meta) {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta || defaultMeta())); } catch (e) {}
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
  return 1 + metaLevel("ember") * 0.10;
}

export function applyPermanentUpgrades(player) {
  const hpBonus = metaLevel("heart");
  player.maxHp = CFG.playerMaxHp + hpBonus;
  player.hp = player.maxHp;
  player.coins = CFG.startCoins + metaLevel("purse") * 3;
  player.permanentRegenBonus = metaLevel("regen") * 0.12;
}

export function applyPermanentWorldUpgrades() {
  const baseLevel = metaLevel("crowned_camp") > 0 ? 2 : 1;
  if (state.base && baseLevel > state.base.level) {
    state.base.level = baseLevel;
    state.base.maxHp = CFG.baseMaxHp[baseLevel];
    state.base.hp = state.base.maxHp;
  }

  if (state.player) {
    state.player.coins += metaLevel("moon_cache") * 12;
    if (metaLevel("ghost_bow") > 0) state.player.weapon = "short_bow";
  }

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

  const skillPoints = metaLevel("oath_sparks");
  state.archerSkillPoints = (state.archerSkillPoints || 0) + skillPoints;
  state.guardSkillPoints = (state.guardSkillPoints || 0) + skillPoints;

  if (metaLevel("old_crew") > 0) {
    const archer = makeUnit("archer", CFG.baseX - 90);
    archer.level = 1;
    const builder = makeUnit("builder", CFG.baseX + 90);
    builder.level = 1;
    state.units.push(archer, builder);
  }

  if (metaLevel("stone_oath") > 0 && state.walls?.length >= 4) {
    for (const w of [state.walls[0], state.walls[2]]) {
      w.commissioned = true;
      w.level = 1;
      w.maxHp = CFG.wallHp[1];
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
  meta.embers = (meta.embers || 0) + reward;
  meta.totalRuns = (meta.totalRuns || 0) + 1;
  meta.bestDay = Math.max(meta.bestDay || 1, Game.day || 1);
  meta.totalKills = (meta.totalKills || 0) + (Game.runKills || 0);
  meta.lastReward = reward;
  meta.lastDay = Game.day || 1;
  meta.lastKills = Game.runKills || 0;
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
      if (lvl >= upg.max) return `${upg.name} er fuldt vækket (${lvl}/${upg.max})`;
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
  if (move !== 0) { p.dir = move; p.gallop += dt * (sprint ? 16 : 10); p.bob = Math.abs(Math.sin(p.gallop)) * 3; }
  else p.bob *= 0.9;
  if ((keys[" "] || keys["space"]) && p.jumpH <= 0 && p.jumpVy <= 0) p.jumpVy = 560;
  p.jumpH += p.jumpVy * dt;
  p.jumpVy -= 1400 * dt;
  if (p.jumpH <= 0) { p.jumpH = 0; if (p.jumpVy < 0) p.jumpVy = 0; }
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
    hubFloat(near.x(), "Ikke nok sjæleglød", "#ff8a6a");
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

function drawHubPlayer() {
  const p = state.player;
  const t = Game.hubT || 0;
  const y = groundY - 34 - (p.jumpH || 0) + Math.sin(t * 3 + p.x * 0.02) * 5;
  ctx.save();
  ctx.translate(p.x, y);
  if (p.dir < 0) ctx.scale(-1, 1);
  ctx.fillStyle = "rgba(120,200,255,0.18)";
  ctx.beginPath(); ctx.ellipse(0, 42 + (p.jumpH || 0), 20, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const aura = ctx.createRadialGradient(0, -20, 4, 0, -20, 46);
  aura.addColorStop(0, "rgba(210,248,255,0.38)");
  aura.addColorStop(1, "rgba(90,170,255,0)");
  ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(0, -20, 46, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "rgba(205,242,255,0.76)";
  ctx.beginPath();
  ctx.moveTo(-16, -4);
  ctx.quadraticCurveTo(-15, -38, 0, -52);
  ctx.quadraticCurveTo(15, -38, 16, -4);
  ctx.quadraticCurveTo(10, 7, 5, -1);
  ctx.quadraticCurveTo(0, 12, -5, -1);
  ctx.quadraticCurveTo(-10, 7, -16, -4);
  ctx.fill();
  ctx.fillStyle = "rgba(35,55,78,0.8)";
  ctx.beginPath(); ctx.arc(-5, -31, 2.4, 0, Math.PI * 2); ctx.arc(5, -31, 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(35,55,78,0.55)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, -22, 4, 0.1, Math.PI - 0.1); ctx.stroke();
  ctx.fillStyle = "#f2c14e";
  ctx.beginPath(); ctx.moveTo(-9, -48); ctx.lineTo(-4, -58); ctx.lineTo(0, -49); ctx.lineTo(4, -58); ctx.lineTo(9, -48); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(210,248,255,0.45)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-20, -24); ctx.quadraticCurveTo(-32, -14, -20, -5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(20, -24); ctx.quadraticCurveTo(32, -14, 20, -5); ctx.stroke();
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

function drawAltar(upg) {
  const lvl = metaLevel(upg.id);
  const maxed = lvl >= upg.max;
  const pulse = 0.75 + Math.sin((Game.hubT || 0) * 3 + upg.x) * 0.12;
  ctx.save();
  ctx.translate(upg.x, groundY);
  ctx.fillStyle = "rgba(0,0,0,0.32)"; ctx.beginPath(); ctx.ellipse(0, 0, 42, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3a3646"; ctx.fillRect(-28, -22, 56, 22);
  ctx.fillStyle = "#555064"; ctx.fillRect(-22, -34, 44, 12);
  ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(-22, -34, 14, 34);
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = maxed ? 0.25 : pulse;
  const rg = ctx.createRadialGradient(0, -58, 3, 0, -58, 38);
  rg.addColorStop(0, upg.color); rg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, -58, 38, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = maxed ? "#d8e8ea" : upg.color;
  ctx.beginPath(); ctx.moveTo(0, -82); ctx.lineTo(18, -58); ctx.lineTo(0, -42); ctx.lineTo(-18, -58); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#161620"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center";
  ctx.fillText(upg.icon, 0, -55);
  ctx.fillStyle = "#d8caa8"; ctx.font = "12px sans-serif";
  ctx.fillText(`${lvl}/${upg.max}`, 0, -95);
  ctx.restore();
}

function drawTierLabels() {
  const labels = [
    { text: "BASIC", x: 960, color: "#9bd05a" },
    { text: "EPIC", x: 1630, color: "#b9a7ff" },
    { text: "LEGENDARY", x: 2240, color: "#f2c14e" },
  ];
  ctx.save();
  ctx.textAlign = "center";
  for (const l of labels) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const rg = ctx.createRadialGradient(l.x, groundY - 130, 4, l.x, groundY - 130, 90);
    rg.addColorStop(0, l.color + "55");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(l.x, groundY - 130, 90, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.fillStyle = "rgba(10,9,16,0.72)";
    ctx.fillRect(l.x - 72, groundY - 158, 144, 25);
    ctx.strokeStyle = l.color + "aa";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(l.x - 72, groundY - 158, 144, 25);
    ctx.fillStyle = l.color;
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(l.text, l.x, groundY - 140);
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

function drawHubText() {
  ctx.save();
  ctx.fillStyle = "rgba(7,9,16,0.54)";
  ctx.fillRect(0, 0, W, 78);
  ctx.fillStyle = "#f2c14e";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(`Sjæleglød: ${Game.meta?.embers || 0}`, 24, 32);
  ctx.fillStyle = "#cfc6b0";
  ctx.font = "13px sans-serif";
  const reward = Game.meta?.lastReward || 0;
  ctx.fillText(`Sidste run: dag ${Game.meta?.lastDay || 1}, ${Game.meta?.lastKills || 0} faldne, +${reward} glød. Gå til højre ind i den blå portal når du er klar.`, 24, 56);
  ctx.restore();
}

function drawHubPrompt() {
  if (Game.state === "hub-transition") return;
  const near = nearestHubStation();
  const portalNear = dist(state.player.x, HUB.portalX) < 120;
  const npcNear = dist(state.player.x, 430) < 110;
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "14px sans-serif";
  if (near) {
    ctx.fillStyle = "rgba(12,10,18,0.72)";
    ctx.fillRect(W / 2 - 340, H - 70, 680, 38);
    ctx.fillStyle = "#f3dfb5";
    ctx.fillText(`${near.label()} - ${near.cost()} glød - hold ned/S`, W / 2, H - 46);
  } else if (portalNear) {
    ctx.fillStyle = "#bfefff";
    ctx.fillText("Gå ind i portalen for at starte et nyt run", W / 2, H - 46);
  } else if (npcNear) {
    ctx.fillStyle = "#cfe6f2";
    ctx.fillText("Den Tilslørede: Hver død er en nøgle. Betal ved seglene, kronbærer.", W / 2, H - 46);
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
  drawNpc(430);
  drawTierLabels();
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
