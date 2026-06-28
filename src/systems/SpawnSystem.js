import { CFG, PORTALS, WALL_SLOTS } from '../config/config.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { LOC_DEFS } from '../config/locations.js';
import { WEAPONS } from '../config/weapons.js';
import { clamp, rand, pick, pickR, mulberry32 } from '../util/math.js';
import { groundY } from '../canvas.js';
import { Game, state } from '../state.js';

export function spawnCoin(x, value = 1, fromY = -40, vx = 0) {
  state.coins.push({ x, y: fromY, vy: -120, value, settled: false, life: 60, magnet: false, vx });
}

export function floaty(x, text, color = "#f2c14e") {
  state.floatTexts.push({ x, y: groundY - 90, text, color, life: 1.4, vy: -34 });
}

export function spawnParticles(x, y, n, color, spread = 60, up = 80) {
  for (let i = 0; i < n; i++)
    state.particles.push({
      x, y,
      vx: rand(-spread, spread), vy: rand(-up, -up * 0.2),
      life: rand(0.4, 0.9), color, size: rand(1.5, 3.5),
    });
}

export function spawnVagrant() {
  const { vagrants, units } = state;
  if (vagrants.length + units.length >= CFG.popCapByLevel[state.base.level]) return;
  const side = pick([-1, 1]);
  const x = side < 0 ? rand(1600, 2400) : rand(CFG.worldWidth - 2400, CFG.worldWidth - 1600);
  vagrants.push({ x, vx: 0, targetX: CFG.baseX + rand(-260, 260), state: "wander", anim: rand(0, 6) });
}

export function spawnAnimal() {
  if (state.animals.length > 6) return;
  const side = pick([-1, 1]);
  const x = side < 0 ? rand(1300, 2600) : rand(CFG.worldWidth - 2600, CFG.worldWidth - 1300);
  state.animals.push({
    x, vx: rand(20, 40) * pick([-1, 1]),
    state: "graze", alive: true, anim: rand(0, 6),
    flee: 0, type: pick(["rabbit","rabbit","deer"]),
  });
}

export function spawnEnemy(type, portal) {
  const t = ENEMY_TYPES[type];
  state.enemies.push({
    x: portal.x, vx: 0, type,
    hp: t.hp, maxHp: t.hp,
    dir: portal.side > 0 ? -1 : 1,
    state: "advance", target: null, attackCd: 0,
    carry: 0, anim: rand(0, 6), flash: 0, fleeing: false, portal,
    fy: t.flying ? -(80 + rand(0, 30)) : 0,
    shootCd: t.flying ? rand(0.5, 2) : 0,
  });
}

export function planNight() {
  const d = Game.day;
  Game.threatLevel  = Math.max(1, d);
  Game.nightQuota   = Math.round((3 + d * 3.5 + Math.pow(d * 0.7, 1.6) + Math.max(0, d - 8) * 2.25) * (Game.diffMult || 1));
  Game.nightSpawned = 0;
  Game.spawnTimer   = 0;
}

function nightEnemyType() {
  const d = Game.day, r = Math.random();
  const late = Math.max(0, d - 6);
  if (d >= 4 && Game.nightSpawned === 0 && Game.nightQuota >= 20 && d % Math.max(2, 4 - Math.floor(late / 8)) === 0) return "boss";
  if (d >= 6 && r < Math.min(0.30, 0.07 + late * 0.012)) return "necro";
  if (d >= 5 && r < Math.min(0.28, 0.10 + late * 0.010)) return "demon";
  if (d >= 4 && r < Math.min(0.24, 0.13 + late * 0.006)) return "flier";
  if (d >= 3 && r < Math.min(0.30, 0.18 + late * 0.006)) return "ogre";
  if (d >= 3 && r < Math.min(0.34, 0.22 + late * 0.006)) return "brute";
  if (d <= 2 && r < 0.28) return "wraith";
  if (d <= 2 && r < 0.52) return "crawler";
  if (d <= 3 && r < 0.22) return "raider";
  if (r < 0.40 + d * 0.02) return "runner";
  return "imp";
}

export function updateSpawning(dt) {
  state.animalTimer -= dt;
  if (state.animalTimer <= 0) { state.animalTimer = rand(8, 14); if (!Game.isNight) spawnAnimal(); }

  if (Game.isNight && Game.nightSpawned < Game.nightQuota) {
    Game.spawnTimer -= dt;
    if (Game.spawnTimer <= 0) {
      const pressure = Math.min(0.55, Math.max(0, Game.day - 4) * 0.018);
      Game.spawnTimer = rand(0.6, 1.6) * (1 - pressure);
      spawnEnemy(nightEnemyType(), pick(state.portals));
      Game.nightSpawned++;
    }
  }
}

export function makeLocation(x, type, r) {
  const def = LOC_DEFS[type];
  const goldAmt = Math.round(def.goldR[0] + r() * (def.goldR[1] - def.goldR[0]));
  let weaponId = null;
  if (r() < 0.70) {
    const rarMin = def.wRar[0], rarMax = def.wRar[1];
    const bonus = Game.rarityBonus || 0;
    const targetRar = clamp(rarMin + Math.floor(r() * (rarMax - rarMin + 1)) + bonus, 0, 4);
    const wList = Object.keys(WEAPONS).filter(k => WEAPONS[k].rarity === targetRar);
    if (wList.length) weaponId = wList[Math.floor(r() * wList.length)];
  }
  const enemyCount = Math.floor(r() * (def.maxE + 1));
  return { x, type, triggered: false, cleared: enemyCount === 0, lootGold: goldAmt, weaponId, enemyCount, remainingEnemies: 0, lootSpawned: false, ph: r() * 6 };
}

export function buildLocations() {
  state.locations = [];
  const r = mulberry32((Game.treeSeed || 1) * 31 + 17);
  let x = 120;
  while (x < CFG.worldWidth - 120) {
    x += 380 + r() * 450;
    if (Math.abs(x - CFG.baseX) < 520) continue;
    if (x >= CFG.worldWidth - 120) break;
    const roll = r();
    if      (roll < 0.50) { /* nothing */ }
    else if (roll < 0.75) { state.locations.push(makeLocation(x, pickR(r,["camp","wagon","grave"]), r)); }
    else if (roll < 0.90) { state.locations.push(makeLocation(x, pickR(r,["ruins","cave","battlefield"]), r)); }
    else if (roll < 0.98) { state.locations.push(makeLocation(x, "watchtower", r)); }
    else                  { state.locations.push(makeLocation(x, "altar", r)); }
  }
}

export function spawnLocLoot(loc) {
  loc.lootSpawned = true;
  for (let i = 0; i < loc.lootGold; i++) spawnCoin(loc.x + rand(-50, 50), 1, -30, rand(-40, 40));
  if (loc.weaponId) state.lootItems.push({ x: loc.x + rand(-24, 24), weaponId: loc.weaponId });
}
