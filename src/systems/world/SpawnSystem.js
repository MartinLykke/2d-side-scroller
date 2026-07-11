import { CFG, PORTALS, WALL_SLOTS, FOREST } from '../../config/config.js';
import { ENEMY_TYPES, BOSS_SCHEDULE } from '../../config/enemies.js';
import { LOC_DEFS } from '../../config/locations.js';
import { WEAPONS } from '../../config/weapons.js';
import { clamp, rand, pick, mulberry32 } from '../../util/math.js';
import { groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { goldCoinChunks, goldRewardAmount } from '../economy/EconomyBalance.js';

export function spawnCoin(x, value = 1, fromY = -40, vx = 0, vy = -180) {
  const c = { x, y: fromY, vy, value, settled: false, life: 60, magnet: false, vx };
  state.coins.push(c);
  return c;
}

export function spawnGoldReward(x, amount, source = "enemy", opts = {}) {
  const actual = goldRewardAmount(amount, source);
  spawnGoldCoins(x, actual, opts);
  return actual;
}

export function spawnGoldCoins(x, amount, opts = {}) {
  const chunks = goldCoinChunks(amount, opts.maxCoinValue);
  for (const value of chunks) {
    const c = spawnCoin(
      x + rand(-(opts.spreadX || 22), opts.spreadX || 22),
      value,
      opts.fromY ?? groundY - 24,
      rand(-(opts.vx || 80), opts.vx || 80),
      rand(-(opts.vyMax || 260), -(opts.vyMin || 120))
    );
    if (opts.mine) c.mine = true;
  }
}

export function floaty(x, text, color = "#f2c14e", size = 15) {
  state.floatTexts.push({ x, y: groundY - 90, text, color, life: 1.4, vy: -34, size });
}

// Combo-aware purchase text: buying again while the previous text is still on
// screen bumps a counter ("x2", "x3"…) and grows the text instead of stacking.
const purchaseCombos = {};
export function purchaseFloaty(key, x, baseText, color) {
  const c = purchaseCombos[key];
  if (c && state.floatTexts.includes(c.f)) {
    c.n++;
    c.f.text = `${baseText} x${c.n}`;
    c.f.size = Math.min(17 + c.n * 4, 38);
    c.f.life = c.f.maxLife = 1.6;
    c.f.y = groundY - 90 - Math.min(c.n * 3, 24);
    c.f.vy = -34;
  } else {
    const f = { x, y: groundY - 90, text: baseText, color, life: 1.6, maxLife: 1.6, vy: -34, size: 17, pop: true };
    state.floatTexts.push(f);
    purchaseCombos[key] = { n: 1, f };
  }
}

export function critFloaty(x, dmg) {
  state.floatTexts.push({
    x, y: groundY - 100, text: String(dmg), color: "#ffd23e",
    life: 1.1, maxLife: 1.1, vy: -150, size: 32, crit: true,
  });
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
  if (state.animals.length > 16) return;
  const bears = state.animals.filter(a => a.type === "bear").length;
  if (bears < 2 && Math.random() < 0.15) return spawnBear();
  // Deer and rabbits spawn across the forest; ducks hatch at the ponds
  const type = pick(["rabbit","rabbit","deer","deer","duck","duck"]);
  let x = rand(0, CFG.worldWidth), spawnState = "graze";
  const ponds = state.ponds || [];
  if (type === "duck" && ponds.length && Math.random() < 0.8) {
    const p = pick(ponds);
    x = p.x + rand(-p.hw * 0.5, p.hw * 0.5);
    spawnState = "swim";
  }
  state.animals.push({
    x, vx: 0, dir: pick([-1, 1]),
    state: spawnState, stateT: spawnState === "swim" ? rand(8, 18) : rand(2, 5), alive: true, anim: rand(0, 6),
    flee: 0, fleeT: 0, type,
    eatDown: 0, headT: rand(1, 3), scan: 0, earFlick: 0,
    fy: 0, flyTargetX: null, cruiseFy: 0, wingStretch: 0,
    dying: false, deathT: 0,
  });
}

// Bears keep to the deep forest, well past the trees nearest the base
export function spawnBear() {
  const side = pick([-1, 1]);
  const x = clamp(CFG.baseX + side * rand(2600, CFG.baseX - 900), 900, CFG.worldWidth - 900);
  state.animals.push({
    x, vx: 0, dir: pick([-1, 1]),
    state: "graze", stateT: rand(2, 5), alive: true, anim: rand(0, 6),
    flee: 0, fleeT: 0, type: "bear",
    hp: 12, maxHp: 12, attackCd: 0, attackAnim: 0, flash: 0,
    chargeCd: 0, charging: 0,
    eatDown: 0, headT: rand(1, 3), scan: 0, earFlick: 0,
    dying: false, deathT: 0,
  });
}

export function spawnEnemy(type, portal) {
  if (!ENEMY_TYPES[type]) type = "imp";
  const t = ENEMY_TYPES[type];
  const enemy = {
    x: portal.x, vx: 0, type, tag: type === "imp" || type === "fireImp" ? "Imp" : "Enemy",
    hp: t.hp, maxHp: t.hp,
    dir: portal.side > 0 ? -1 : 1,
    state: "advance", aiState: type === "imp" ? "advance" : undefined, target: null, attackCd: 0,
    carry: 0, anim: rand(0, 6), flash: 0, attackAnim: 0, fleeing: false, portal,
    fy: t.flying ? -(t.fireball ? rand(105, 145) : 80 + rand(0, 30)) : 0,
    shootCd: (t.flying || t.caster) ? rand(0.5, t.fireball ? 1.4 : (t.shootInterval || 3)) : 0,
    poisonCd: t.rangedShoot ? rand(1, t.shootInterval || 5) : undefined,
    nightWave: Game.isNight,
  };
  state.enemies.push(enemy);
  return enemy;
}

// Per-boss entrance rigging, run right after the boss entity is spawned.
const BOSS_RIGGERS = {
  fireDragon(drg, portal) {
    drg.patrolDir = portal.side > 0 ? -1 : 1;
    drg.dropCd = rand(3, 5);
    // Imps ride on the dragon's back and drop off over the base
    for (let k = 0; k < 4; k++) {
      const r = spawnEnemy("imp", portal);
      r.ridingDragon = drg;
      r.riderSeat = k;
      r.fy = (drg.fy || -110) - 52;
    }
  },
  magmaGolem(golem, portal) {
    Game.screenShake = Math.max(Game.screenShake || 0, 0.4);
    spawnParticles(portal.x, groundY - 20, 30, "#ff6a20", 160, 180);
    spawnParticles(portal.x, groundY - 10, 18, "#6b5a45", 200, 120);
  },
};

export function spawnBoss(type, portal) {
  spawnEnemy(type, portal);
  const boss = state.enemies[state.enemies.length - 1];
  BOSS_RIGGERS[type]?.(boss, portal);
  return boss;
}

export function spawnFireDragon(portal) {
  return spawnBoss("fireDragon", portal);
}

export function planNight() {
  const d = Game.day;
  Game.threatLevel  = Math.max(1, d);
  let quotaMult = Game.diffMult || 1;
  if (Game.diffMult > 1.5) quotaMult *= 1.35;
  // Base horde scaling: 2x from day 1, ramping up ~10% per day (caps at 3.5x)
  const hordeMult = Math.min(3.5, 2 + Math.max(0, d - 1) * 0.1);
  Game.nightQuota   = Math.round((3 + d * 3.5 + Math.pow(d * 0.7, 1.6) + Math.max(0, d - 8) * 2.25) * quotaMult * hordeMult);
  Game.nightSpawned = 0;
  Game.spawnTimer   = 0;
  Game.nightCleared = false;
}

function nightEnemyType() {
  const d = Game.day, r = Math.random();
  const hardMult = Game.diffMult > 1.5 ? 1.3 : 1;
  if (Game.nightSpawned === 0 && BOSS_SCHEDULE[d]) return BOSS_SCHEDULE[d];
  const flyingImpChance = Math.min(0.45, Math.max(0, d - 2) * 0.055 * hardMult);
  const emberBruteChance = d >= 2 ? Math.min(0.25, (d - 1) * 0.035 * hardMult) : 0;
  const ashPriestChance = d >= 4 ? Math.min(0.18, (d - 3) * 0.028 * hardMult) : 0;
  if (r < emberBruteChance) return "emberBrute";
  if (r < emberBruteChance + ashPriestChance) return "ashPriest";
  if (r < emberBruteChance + ashPriestChance + flyingImpChance) return "fireImp";
  return "imp";
}

export function updateSpawning(dt) {
  state.animalTimer -= dt;
  if (state.animalTimer <= 0) { state.animalTimer = rand(3, 6); if (!Game.isNight) spawnAnimal(); }

  if (Game.isNight && Game.nightSpawned < Game.nightQuota) {
    Game.spawnTimer -= dt;
    if (Game.spawnTimer <= 0) {
      const pressure = Math.min(0.55, Math.max(0, Game.day - 4) * 0.018);
      let diffSpeedUp = Game.diffMult > 1 ? 1 / Math.sqrt(Game.diffMult) : 1;
      if (Game.diffMult > 1.5) diffSpeedUp *= 0.7;
      // Halved interval so the doubled quota still fits inside the night window
      Game.spawnTimer = rand(0.3, 0.8) * (1 - pressure) * diffSpeedUp;
      const type = nightEnemyType();
      const portal = pick(state.portals);
      let spawned;
      if (ENEMY_TYPES[type] && ENEMY_TYPES[type].boss) {
        spawned = spawnBoss(type, portal);
      } else {
        spawnEnemy(type, portal);
        spawned = state.enemies[state.enemies.length - 1];
      }
      Game.nightSpawned++;
      if (ENEMY_TYPES[type] && ENEMY_TYPES[type].legendary) {
        const lb = spawned;
        lb.specialCd  = 3;
        lb.specialPhase = 0;
        lb.specialTimer = 0;
        state.legendaryBoss = lb;
        // Intro popup
        Game.legendaryIntro = { timer: 5.5, maxTimer: 5.5, bossType: type };
        // Rally all fighters
        for (const u of state.units) u.rallied = true;
        for (let k = 0; k < 30; k++)
          state.particles.push({ x: CFG.baseX + rand(-120,120), y: groundY - rand(40,160), vx: rand(-60,60), vy: rand(-80,-20), life: rand(0.6,1.2), color:"#ff2020", size: rand(2,5) });
      }
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
  let enemyCount = Math.floor(r() * (def.maxE + 1));
  if (Game.diffMult > 1.5) enemyCount = Math.ceil(enemyCount * 1.4);
  return {
    x, type,
    triggered: false,
    preActivated: false,
    cleared: enemyCount === 0,
    lootGold: goldAmt,
    weaponId,
    enemyCount,
    remainingEnemies: 0,
    remainingVagrants: def.vagrants || 0,
    blockedUntilExit: false,
    lootSpawned: false,
    ph: r() * 6,
  };
}

export function buildLocations() {
  state.locations = [];
}

export function spawnLocLoot(loc) {
  loc.lootSpawned = true;
  spawnGoldReward(loc.x, loc.lootGold, "location", { spreadX: 50, fromY: groundY - 20, vx: 70 });
  if (loc.weaponId) state.lootItems.push({ x: loc.x + rand(-24, 24), weaponId: loc.weaponId, dropVy: -340, dropY: groundY - 160 });
}
