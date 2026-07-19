import { ENEMY_TYPES } from '../config/enemies.js';
import { WEAPONS } from '../config/weapons.js';
import { groundY } from '../core/canvas.js';
import { Game, state } from '../core/state.js';
import { inject } from '../core/services.js';
import { spawnGoldReward, spawnParticles, floaty } from '../systems/world/SpawnSystem.js';
import { Audio } from '../systems/infrastructure/Audio.js';
import { registerEnemyKill } from '../systems/infrastructure/RoguelikeSystem.js';

const PORTAL_GUARDIAN_WEAPON_DROP_CHANCE = 0.25;
const PORTAL_GUARDIAN_WEAPON_RARITIES = [1, 2, 3];
const MAX_DEATH_PARTICLES = 700;

const DEFAULT_DEATH_PROFILE = {
  blood: ["#5a0710", "#7a1020", "#b12835"],
  chunks: ["#401012", "#6a1a18", "#9a2d24"],
  mass: 1,
};

const ENEMY_DEATH_PROFILES = {
  imp: {
    blood: ["#4b0710", "#7a1020", "#b12835"],
    chunks: ["#3a070c", "#6d1a16", "#b8422a"],
    mass: 0.72,
  },
  fireImp: {
    blood: ["#4b0710", "#8a1a18", "#c43a24"],
    chunks: ["#431018", "#7a1c14", "#ff6a20"],
    ember: true,
    mass: 0.62,
  },
  emberBrute: {
    blood: ["#3a0706", "#6a1710", "#a83620"],
    chunks: ["#2a0a08", "#5a1a10", "#8a3018"],
    ember: true,
    mass: 2.15,
  },
  ashPriest: {
    blood: ["#3a070b", "#64121a", "#8a2a30"],
    chunks: ["#2a1d1f", "#412225", "#7a3230"],
    ash: true,
    mass: 1.08,
  },
  siegeImp: {
    blood: ["#3a0a08", "#6a1c12", "#a83a20"],
    chunks: ["#2a0a08", "#5a2416", "#8a4a2a", "#6b5a45"],
    ember: true,
    mass: 3.0,
  },
  fireDragon: {
    blood: ["#3a0706", "#7a1408", "#b02a18"],
    chunks: ["#351008", "#7a1408", "#d64a20"],
    ember: true,
    mass: 5.2,
  },
  magmaGolem: {
    gore: false,
    blood: ["#ff6a20", "#ffd060", "#3a2a26"],
    chunks: ["#211918", "#3a2a26", "#6b5a45", "#ff6a20"],
    lava: true,
    mass: 7,
  },
  // Phase 2: the Hollow bleeds cold violet light instead of blood
  shade: {
    blood: ["#1a1030", "#31215a", "#5a3f96"],
    chunks: ["#120a24", "#241a38", "#4a3578"],
    mass: 0.7,
  },
  voidWraith: {
    blood: ["#1e1438", "#3a2a64", "#6a4fb0"],
    chunks: ["#160e2c", "#352a54", "#5a48a0"],
    mass: 0.65,
  },
  voidBrute: {
    blood: ["#160e2c", "#2a1c50", "#4a3590"],
    chunks: ["#100a20", "#1c1430", "#3a2a68"],
    mass: 2.2,
  },
  voidTitan: {
    gore: false,
    blood: ["#8a5aff", "#8fe8ff", "#241a38"],
    chunks: ["#0e0a1c", "#241a38", "#4a3578", "#8a5aff"],
    mass: 7,
  },
  voidSeraph: {
    gore: false,
    blood: ["#8a5aff", "#d7f6ff", "#0b0718"],
    chunks: ["#080414", "#241a38", "#5a4788", "#d7f6ff"],
    mass: 5.8,
  },
};

const HUMAN_BLOOD = ["#5a0710", "#8a1f1f", "#c1453b"];

function randRange(a, b) {
  return a + Math.random() * (b - a);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function deathProfile(e) {
  return ENEMY_DEATH_PROFILES[e?.type] || DEFAULT_DEATH_PROFILE;
}

function pushDeathParticle(p) {
  const life = p.life ?? randRange(0.35, 0.9);
  const overflow = state.particles.length + 1 - MAX_DEATH_PARTICLES;
  if (overflow > 0) state.particles.splice(0, overflow);
  state.particles.push({ ...p, life, maxLife: p.maxLife || life });
}

function deathImpactY(e, t, y = null) {
  if (y !== null && y !== undefined) return y;
  const fy = e?.fy || 0;
  const h = (t?.dragon || t?.voidSeraph) ? t.w * 0.35 : (t?.golem || t?.voidTitan) ? t.w * 0.56 : Math.min(54, (t?.w || 24) * 0.78);
  return groundY + fy - h;
}

function spawnBloodSpray(x, y, dir = 1, power = 1, colors = HUMAN_BLOOD, opts = {}) {
  const d = dir || 1;
  const count = Math.ceil(opts.count ?? (5 + power * 4));
  const speed = opts.speed ?? (70 + power * 58);
  const up = opts.up ?? (85 + power * 45);
  for (let i = 0; i < count; i++) {
    const forward = Math.random() < (opts.forwardBias ?? 0.78) ? d : -d;
    const vx = forward * randRange(speed * 0.25, speed) + randRange(-speed * 0.24, speed * 0.24);
    const vy = randRange(-up, -up * 0.12);
    const stain = Math.random() < (opts.stainChance ?? 0.46);
    pushDeathParticle({
      x: x + randRange(-4, 4),
      y: y + randRange(-5, 5),
      vx, vy,
      color: pick(colors),
      size: randRange(1.4, 3.2 + power * 0.35),
      gravity: opts.gravity ?? 520,
      drag: 0.75,
      groundY: groundY - randRange(0, 2.5),
      stain,
      stainLife: randRange(1.5, 3.6 + power * 0.3),
      stainScale: randRange(1.35, 2.25),
      streak: power > 0.75 && Math.random() < 0.55,
      rot: randRange(0, Math.PI),
      spin: randRange(-7, 7),
      life: randRange(0.45, 0.95 + power * 0.12),
    });
  }
}

function spawnGroundBlood(x, dir = 1, power = 1, colors = HUMAN_BLOOD, count = 4) {
  const d = dir || 1;
  for (let i = 0; i < count; i++) {
    pushDeathParticle({
      x: x + d * randRange(4, 22 + power * 24) + randRange(-18, 18),
      y: groundY - randRange(0, 1.5),
      vx: 0, vy: 0,
      color: pick(colors),
      size: randRange(2.6, 6.4 + power * 1.8),
      stain: true,
      settled: true,
      sx: randRange(1.4, 2.8),
      sy: randRange(0.25, 0.58),
      rot: randRange(-0.25, 0.25),
      life: randRange(2.0, 4.6 + power * 0.5),
      alpha: randRange(0.52, 0.84),
    });
  }
}

function spawnDeathChunks(x, y, dir = 1, power = 1, profile = DEFAULT_DEATH_PROFILE, count = 5) {
  const colors = profile.chunks || profile.blood || DEFAULT_DEATH_PROFILE.chunks;
  const d = dir || 1;
  for (let i = 0; i < count; i++) {
    const speed = randRange(45, 105 + power * 55);
    pushDeathParticle({
      x: x + randRange(-6, 6),
      y: y + randRange(-8, 6),
      vx: d * randRange(speed * 0.2, speed) + randRange(-speed * 0.6, speed * 0.45),
      vy: randRange(-(85 + power * 55), -25),
      color: pick(colors),
      size: randRange(2.4, 5.2 + power * 0.9),
      kind: "chunk",
      gravity: profile.lava ? 620 : 560,
      drag: 0.45,
      groundY: groundY - randRange(0, 2),
      bounce: profile.lava ? 0.18 : 0.24,
      rot: randRange(0, Math.PI),
      spin: randRange(-10, 10),
      life: randRange(0.75, 1.65 + power * 0.15),
    });
  }
}

function overkillViolence(overkill, maxHp) {
  if (overkill <= 0) return 0;
  const hp = Math.max(1, maxHp || 1);
  return clamp(Math.sqrt(overkill / hp) * 2.2 + Math.sqrt(overkill) * 0.18, 0, 5);
}

function violenceTier(violence) {
  if (violence >= 3.25) return 3;
  if (violence >= 1.45) return 2;
  if (violence >= 0.45) return 1;
  return 0;
}

function chooseDeathKind(e, t, violence, tier) {
  if (t.voidTitan) return tier >= 2 ? "golemShatter" : "golemCollapse";
  if (t.voidSeraph) return tier >= 2 ? "dragonCrash" : "wingShear";
  if (t.golem) return tier >= 2 ? "golemShatter" : "golemCollapse";
  if (t.dragon) return tier >= 2 ? "dragonCrash" : "dragonFall";
  if (e.type === "fireImp") return tier >= 2 ? "wingShear" : "wingFold";
  if (e.type === "emberBrute") return tier >= 2 ? "heavySlam" : "heavyKneel";
  if (e.type === "siegeImp") return tier >= 2 ? "heavySlam" : "heavyKneel";
  if (e.type === "ashPriest") return tier >= 3 ? "ashBurst" : tier >= 1 ? "ashSpin" : "ashFold";
  if (tier >= 3) return "impBurst";
  if (tier >= 2) return "impLaunch";
  if (tier >= 1) return "impFallBack";
  return Math.random() < 0.5 ? "impCrumple" : "impFallBack";
}

function spawnEnemyDeathEffects(e, t, profile, violence, tier) {
  const y = deathImpactY(e, t);
  const dir = e.deathDir || (e.dir ? -e.dir : 1);
  const power = 1 + violence * 0.58;
  if (profile.gore === false) {
    spawnDeathChunks(e.x, y, dir, power, profile, 12 + Math.floor(violence * 4));
    spawnParticles(e.x, y, 16 + Math.floor(violence * 6), "#ff6a20", 130 + violence * 30, 130 + violence * 38);
    spawnParticles(e.x, groundY - 8, 14 + Math.floor(violence * 3), "#3a2a26", 170 + violence * 45, 62);
    return;
  }
  spawnBloodSpray(e.x, y, dir, power, profile.blood, {
    count: 8 + Math.floor(violence * 5),
    speed: 80 + violence * 58,
    up: 90 + violence * 46,
  });
  spawnBloodSpray(e.x, y + 9, -dir, power * 0.55, profile.blood, {
    count: 4 + Math.floor(violence * 2),
    speed: 45 + violence * 24,
    up: 54 + violence * 20,
    forwardBias: 0.56,
  });
  spawnGroundBlood(e.x, dir, power, profile.blood, 3 + tier * 2);
  if (tier >= 2) spawnDeathChunks(e.x, y, dir, power, profile, 3 + tier * 2);
  if (tier >= 3) {
    spawnBloodSpray(e.x, y - 4, dir, power * 1.15, profile.blood, {
      count: 12,
      speed: 160 + violence * 50,
      up: 130 + violence * 45,
      stainChance: 0.35,
    });
  }
  if (profile.ember) {
    spawnParticles(e.x, y, 8 + Math.floor(violence * 4), "#ff6a20", 70 + violence * 30, 100 + violence * 40);
    spawnParticles(e.x, y - 5, 4 + Math.floor(violence * 2), "#ffd060", 45 + violence * 20, 115);
  }
  if (profile.ash) {
    spawnParticles(e.x, y, 12 + Math.floor(violence * 3), "#3a2a26", 100 + violence * 30, 70 + violence * 20);
  }
}

export function spawnHumanBlood(u, intensity = 1, dir = 0, y = null) {
  if (!u) return;
  const d = dir || (u.dir ? -u.dir : 1);
  const yy = y ?? (groundY - 30);
  const power = Math.max(0.45, intensity);
  spawnBloodSpray(u.x, yy, d, power, HUMAN_BLOOD, {
    count: Math.ceil(5 + power * 4),
    speed: 58 + power * 44,
    up: 70 + power * 36,
  });
  if (power > 1.05) spawnGroundBlood(u.x, d, power, HUMAN_BLOOD, Math.ceil(2 + power * 1.3));
}

function rollPortalGuardianWeaponDrop(e) {
  if (Math.random() > PORTAL_GUARDIAN_WEAPON_DROP_CHANCE) return;
  const candidates = Object.keys(WEAPONS).filter(id => PORTAL_GUARDIAN_WEAPON_RARITIES.includes(WEAPONS[id].rarity));
  if (!candidates.length) return;
  const weaponId = candidates[Math.floor(Math.random() * candidates.length)];
  state.lootItems.push({ x: e.x, weaponId, dropVy: -350, dropY: groundY - 150 });
}

export function spawnImpBlood(e, intensity = 1, y = null) {
  if (!e) return;
  const t = ENEMY_TYPES[e.type];
  const profile = deathProfile(e);
  const yy = deathImpactY(e, t, y);
  const power = Math.max(0.4, intensity);
  if (profile.gore === false) {
    if (power > 0.8) spawnDeathChunks(e.x, yy, e.dir || 1, power * 0.45, profile, Math.ceil(2 + power));
    if (power > 1.2) spawnParticles(e.x, yy, Math.ceil(3 * power), "#ff6a20", 34 + power * 12, 38 + power * 20);
    return;
  }
  const dir = e.lastHitDir || (e.combatTarget ? Math.sign(e.x - e.combatTarget.x) || 1 : (e.dir ? -e.dir : 1));
  spawnBloodSpray(e.x, yy, dir, power * 0.6, profile.blood, {
    count: Math.ceil(3 + power * 3),
    speed: 36 + power * 28,
    up: 42 + power * 26,
    stainChance: 0.34,
  });
  if (power > 1.35) spawnGroundBlood(e.x, dir, power * 0.55, profile.blood, Math.ceil(power));
}

function registerMomentumKill(e, t) {
  const player = state.player;
  if (Game.state !== "play" || !player || !t) return;
  const chainActive = (Game.killStreakTimer || 0) > 0;
  Game.killStreak = chainActive ? (Game.killStreak || 0) + 1 : 1;
  Game.killStreakTimer = 4.0;

  const nextLevel = Math.min(5, Math.floor((Game.killStreak || 0) / 3));
  if (nextLevel <= 0) return;

  const oldLevel = Game.momentumLevel || 0;
  Game.momentumLevel = Math.max(oldLevel, nextLevel);
  Game.momentumTimer = Math.max(Game.momentumTimer || 0, 4.5 + Game.momentumLevel * 0.4);

  if (Game.momentumLevel > oldLevel) {
    floaty(player.x, "Momentum x" + Game.momentumLevel, "#ffd23e", 18);
    spawnParticles(player.x, groundY - 45, 12 + Game.momentumLevel * 2, "#ffd23e", 80, 90);
  }
}

export function killEnemyWithAnimation(e, knockDirection = 0) {
  if (e.dying) return;
  const t = ENEMY_TYPES[e.type];
  const profile = deathProfile(e);
  const overkill = Math.max(0, -(e.hp || 0));
  const violence = overkillViolence(overkill, e.maxHp || t.hp);
  const tier = violenceTier(violence);
  const deathKind = chooseDeathKind(e, t, violence, tier);
  const mass = profile.mass || Math.max(0.55, (t.w || 22) / 22);
  const light = 1 / Math.sqrt(mass);
  const dir = knockDirection || (e.dir ? -e.dir : 1);

  // Start death animation. Overkill controls the tier: stumble, tumble, launch, rupture.
  e.dying = true;
  e.deathT = 0;
  e.deathDuration = (t.boss ? 1.85 : 1.08) + violence * 0.3;
  e.deathKind = deathKind;
  e.deathDir = dir;
  e.deathSpin = (dir < 0 ? -1 : 1) * (0.72 + Math.random() * 0.42 + violence * 1.08);
  e.knock = dir * (deathKind === "golemCollapse" || deathKind === "golemShatter" ? 16 + violence * 12 : 82 + Math.random() * 52 + violence * 175) * light;
  e.deathAngle = 0;
  e.deathRestAngle = (dir < 0 ? -1 : 1) * (deathKind === "heavyKneel" || deathKind === "golemCollapse" ? 0.82 : 1.58);
  e.deathAngVel = e.deathSpin * (deathKind === "impCrumple" || deathKind === "heavyKneel" ? 1.4 : 2.8 + tier * 0.85) * light;
  e.deathBounces = 0;
  e.flash = 0;
  if (t.flying) {
    e.deathVy = deathKind === "wingFold" ? 58 + violence * 38 : 96 + violence * 62;
    e.deathGravity = 560 + violence * 90;
    e.deathDuration = Math.max(e.deathDuration, Math.abs(e.fy || -90) / 230 + 0.72 + violence * 0.12);
  } else if (deathKind === "heavyKneel" || deathKind === "golemCollapse") {
    e.deathVy = -(26 + violence * 18) * light;
    e.deathGravity = 660 + violence * 55;
  } else if (deathKind === "heavySlam" || deathKind === "golemShatter") {
    e.deathVy = -(70 + violence * 32) * light;
    e.deathGravity = 760 + violence * 85;
  } else if (deathKind === "impCrumple" || deathKind === "ashFold") {
    e.deathVy = -(26 + Math.random() * 22 + violence * 16) * light;
    e.deathGravity = 620 + violence * 42;
  } else {
    e.deathVy = -(92 + Math.random() * 58 + violence * 72) * light;
    e.deathGravity = 690 + violence * 76;
  }
  if (t.flying) {
    e.deathAngVel *= deathKind === "wingShear" || deathKind === "dragonCrash" ? 1.55 : 1.15;
  }
  if (t.boss) {
    e.deathDuration += 0.55;
    e.deathAngVel *= (t.golem || t.voidTitan) ? 0.32 : 0.55;
  }
  e.deathFriction = Math.max(1.45, 5.3 - violence * 0.68);
  e.overkillViolence = violence;
  e.deathTier = tier;
  e.deathFadeStart = tier >= 3 ? 0.5 : 0.76;
  e.deathBurstAt = tier >= 3 && !t.boss && profile.gore !== false ? randRange(0.16, 0.28) : 0;
  if (deathKind === "golemShatter") e.deathBurstAt = randRange(0.32, 0.5);

  spawnEnemyDeathEffects(e, t, profile, violence, tier);
  if (violence > 0.4 || t.boss) {
    Game.screenShake = Math.max(Game.screenShake || 0, Math.min(t.boss ? 0.9 : 0.55, 0.1 + violence * 0.1 + (t.boss ? 0.38 : 0)));
  }

  Audio.enemyDie();
  registerEnemyKill(t.reward);
  registerMomentumKill(e, t);
  const addXP = inject('addXP');
  if (addXP) addXP(t.reward * 8);

  if (t.legendary && state.legendaryBoss === e) {
    state.legendaryBoss = null;
    state.legendaryEffects = [];
    for (const u of state.units) u.rallied = false;
    spawnParticles(e.x, groundY - 80, 80, t.eye, 300, 250);
  }

  if (e.portalGuardian) rollPortalGuardianWeaponDrop(e);
  if (e.type === "fireDragon") {
    state.lootItems.push({ x: e.x, weaponId: "meteor_tome", dropVy: -350, dropY: groundY - 150 });
  }
  if (e.type === "magmaGolem") {
    state.lootItems.push({ x: e.x, weaponId: "sunblade", dropVy: -350, dropY: groundY - 150 });
  }
  if (e.type === "voidTitan") {
    state.lootItems.push({ x: e.x, weaponId: "void_bow", dropVy: -350, dropY: groundY - 150 });
  }
  if (e.type === "voidSeraph") {
    state.lootItems.push({ x: e.x, weaponId: "void_tome", dropVy: -350, dropY: groundY - 150 });
  }

  // Coins are dropped during the death animation
  e.shouldDropCoins = true;
}

export function killEnemy(e) {
  if (e.dying) return;
  const knockDir = e.combatTarget ? Math.sign(e.x - e.combatTarget.x) || 1 : (e.dir ? -e.dir : 1);
  killEnemyWithAnimation(e, knockDir);
}

export function updateDyingEnemies(dt) {
  const t = ENEMY_TYPES;
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (e.dying) {
      e.deathT += dt;
      const et = t[e.type];
      const profile = deathProfile(e);
      if (e.flash > 0) e.flash -= dt;

      // Drop coins once during animation
      if (e.shouldDropCoins && e.deathT > 0.1) {
        spawnGoldReward(e.x, et.reward, et.boss ? "boss" : "enemy", { fromY: groundY - 28, spreadX: 22, vx: 80, vyMin: 120, vyMax: 260 });
        e.shouldDropCoins = false;
      }

      if (e.deathBurstAt && !e.deathBurstDone && e.deathT >= e.deathBurstAt) {
        e.deathBurstDone = true;
        const y = deathImpactY(e, et);
        if (profile.gore === false) {
          spawnDeathChunks(e.x, y, e.deathDir || 1, 1.6 + (e.overkillViolence || 0), profile, 14 + Math.floor((e.overkillViolence || 0) * 4));
          spawnParticles(e.x, y, 22, "#ff6a20", 190, 170);
        } else {
          spawnBloodSpray(e.x, y, e.deathDir || 1, 1.3 + (e.overkillViolence || 0) * 0.65, profile.blood, {
            count: 14 + Math.floor((e.overkillViolence || 0) * 5),
            speed: 150 + (e.overkillViolence || 0) * 55,
            up: 130 + (e.overkillViolence || 0) * 45,
          });
          spawnDeathChunks(e.x, y, e.deathDir || 1, 1 + (e.overkillViolence || 0) * 0.5, profile, 5 + Math.floor((e.overkillViolence || 0) * 2));
        }
      }

      if ((e.overkillViolence || 0) > 1 && profile.gore !== false && Math.random() < dt * (2 + (e.overkillViolence || 0))) {
        spawnBloodSpray(e.x, deathImpactY(e, et), e.deathDir || 1, 0.55 + (e.overkillViolence || 0) * 0.12, profile.blood, {
          count: 1,
          speed: 34 + (e.overkillViolence || 0) * 14,
          up: 40,
          stainChance: 0.7,
        });
      }

      // Ragdoll physics during death (all enemy types)
      if (e.knock) { e.x += e.knock * dt; e.knock *= Math.max(0, 1 - (e.deathFriction || 5.5) * dt); if (Math.abs(e.knock) < 2) e.knock = 0; }
      const airborne = (e.fy || 0) < 0 || (e.deathVy || 0) < 0;
      if (airborne) {
        // Free tumble while airborne
        e.deathVy = (e.deathVy || 0) + (e.deathGravity || 420) * dt;
        e.fy = (e.fy || 0) + e.deathVy * dt;
        e.deathAngle = (e.deathAngle || 0) + (e.deathAngVel || 0) * dt;
        if (e.fy >= 0) {
          e.fy = 0;
          if (e.deathVy > 100 && (e.deathBounces || 0) < 2) {
            // Bounce: lose energy, keep tumbling slower
            e.deathVy = -e.deathVy * 0.35;
            e.deathBounces = (e.deathBounces || 0) + 1;
            e.deathAngVel = (e.deathAngVel || 0) * 0.5;
            e.knock = (e.knock || 0) * 0.6;
            e.deathDuration = Math.max(e.deathDuration, e.deathT + 0.55);
            if (profile.gore === false) {
              spawnDeathChunks(e.x, groundY - 10, e.deathDir || 1, 0.75, profile, 5);
              spawnParticles(e.x, groundY - 8, 7, "#3a2a26", 75, 42);
            } else {
              spawnBloodSpray(e.x, groundY - 10, e.deathDir || 1, 0.8 + (e.overkillViolence || 0) * 0.12, profile.blood, {
                count: 4 + Math.floor((e.overkillViolence || 0) * 1.5),
                speed: 58,
                up: 42,
              });
              spawnGroundBlood(e.x, e.deathDir || 1, 0.9 + (e.overkillViolence || 0) * 0.15, profile.blood, 2);
            }
          } else {
            e.deathVy = 0;
            e.deathAngVel = (e.deathAngVel || 0) * 0.3;
          }
        }
      } else {
        // On the ground: rotation settles toward the nearest lying-flat angle, sliding stops
        const a = e.deathAngle || 0;
        const rest = e.deathRestAngle ?? ((e.deathAngVel || e.deathSpin || 1) >= 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
        e.deathAngle = a + (rest - a) * Math.min(1, 9 * dt);
        e.deathAngVel = (e.deathAngVel || 0) * Math.max(0, 1 - 8 * dt);
        if (e.knock) e.knock *= Math.max(0, 1 - 7 * dt);
      }

      if (e.deathT >= e.deathDuration) {
        state.enemies.splice(i, 1);
      }
    }
  }
}
