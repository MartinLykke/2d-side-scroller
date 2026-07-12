import { ENEMY_TYPES } from '../config/enemies.js';
import { WEAPONS } from '../config/weapons.js';
import { groundY } from '../core/canvas.js';
import { Game, state } from '../core/state.js';
import { inject } from '../core/services.js';
import { spawnGoldReward, spawnParticles } from '../systems/world/SpawnSystem.js';
import { Audio } from '../systems/infrastructure/Audio.js';
import { registerEnemyKill } from '../systems/infrastructure/RoguelikeSystem.js';

const PORTAL_GUARDIAN_WEAPON_DROP_CHANCE = 0.25;
const PORTAL_GUARDIAN_WEAPON_RARITIES = [1, 2, 3];

function rollPortalGuardianWeaponDrop(e) {
  if (Math.random() > PORTAL_GUARDIAN_WEAPON_DROP_CHANCE) return;
  const candidates = Object.keys(WEAPONS).filter(id => PORTAL_GUARDIAN_WEAPON_RARITIES.includes(WEAPONS[id].rarity));
  if (!candidates.length) return;
  const weaponId = candidates[Math.floor(Math.random() * candidates.length)];
  state.lootItems.push({ x: e.x, weaponId, dropVy: -350, dropY: groundY - 150 });
}

export function spawnImpBlood(e, intensity = 1, y = null) {
  if (!e || e.type !== "imp") return;
  const yy = y ?? (groundY + (e.fy || 0) - 24);
  const power = Math.max(0.4, intensity);
  spawnParticles(e.x, yy, Math.ceil(5 * power), "#7a1020", 35 + power * 26, 36 + power * 32);
  spawnParticles(e.x, yy + 4, Math.ceil(3 * power), "#b12835", 24 + power * 20, 24 + power * 24);
  if (power > 1.4) spawnParticles(e.x, yy + 8, Math.ceil(2 * power), "#4b0710", 18 + power * 18, 18 + power * 16);
}

export function killEnemyWithAnimation(e, knockDirection = 0) {
  if (e.dying) return;
  const t = ENEMY_TYPES[e.type];
  const overkill = Math.max(0, -(e.hp || 0));
  const violence = Math.min(4, Math.sqrt(overkill) / 2.2);
  const brutal = violence > 1.25;
  // Mass factor relative to an imp: heavy enemies topple, light ones tumble
  const light = 1 / Math.sqrt((t.w || 22) / 22);

  // Start death animation (ragdoll: rotation integrated with angular velocity + bounces)
  e.dying = true;
  e.deathT = 0;
  e.deathDuration = (t.boss ? 1.7 : 1.05) + violence * 0.32;
  e.deathKind = brutal || Math.random() < 0.45 ? "impFallBack" : "impCrumple";
  e.deathDir = knockDirection || (e.dir ? -e.dir : 1);
  e.deathSpin = (e.deathDir < 0 ? -1 : 1) * (0.85 + Math.random() * 0.35 + violence * 1.7);
  e.knock = e.deathDir * (110 + Math.random() * 70 + violence * 210) * light;
  e.deathVy = (e.deathKind === "impFallBack" ? -(120 + Math.random() * 70 + violence * 110) : -(45 + Math.random() * 40)) * light;
  e.deathAngle = 0;
  e.deathAngVel = e.deathSpin * (e.deathKind === "impFallBack" ? 3.2 : 1.9) * (1 + violence * 0.5) * light;
  e.deathBounces = 0;
  e.flash = 0;
  if (t.flying) {
    e.deathDuration = Math.max(e.deathDuration, (e.fy !== undefined ? Math.abs(e.fy) : 80) / 260 + 0.35);
  }
  e.deathGravity = 420 + violence * 55;
  e.deathFriction = Math.max(1.8, 5.5 - violence * 0.75);
  e.overkillViolence = violence;

  // Spawn blood particles
  if (e.type === "imp") {
    spawnImpBlood(e, 2.2 + violence * 1.6);
    if (violence > 1.2) spawnImpBlood(e, 1.4 + violence, groundY + (e.fy || 0) - 12);
  } else {
    spawnParticles(e.x, groundY - 24, 15 + Math.floor(violence * 7), "#8a1a2a", 120 + violence * 55, 140 + violence * 60);
    spawnParticles(e.x, groundY - 20, 8 + Math.floor(violence * 4), "#aa3a4a", 80 + violence * 40, 100 + violence * 45);
  }

  Audio.enemyDie();
  registerEnemyKill(t.reward);
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
      if (e.flash > 0) e.flash -= dt;

      // Drop coins once during animation
      if (e.shouldDropCoins && e.deathT > 0.1) {
        spawnGoldReward(e.x, et.reward, et.boss ? "boss" : "enemy", { fromY: groundY - 28, spreadX: 22, vx: 80, vyMin: 120, vyMax: 260 });
        e.shouldDropCoins = false;
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
            if (e.type === "imp") spawnImpBlood(e, 0.5, groundY - 6);
            else spawnParticles(e.x, groundY - 10, 5, "#8a1a2a", 60, 60);
          } else {
            e.deathVy = 0;
            e.deathAngVel = (e.deathAngVel || 0) * 0.3;
          }
        }
      } else {
        // On the ground: rotation settles toward the nearest lying-flat angle, sliding stops
        const a = e.deathAngle || 0;
        const bias = (e.deathAngVel || e.deathSpin || 1) >= 0 ? 0.12 : -0.12;
        const rest = (Math.round((a + bias) / Math.PI - 0.5) + 0.5) * Math.PI + (bias > 0 ? 0.06 : -0.06);
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
