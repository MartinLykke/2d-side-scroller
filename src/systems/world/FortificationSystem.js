import { state, Game } from '../../core/state.js';
import { FORT_TRACK, fortHpMultAt } from '../../config/fortifications.js';
import { groundY } from '../../core/canvas.js';
import { rand } from '../../util/math.js';
import { wallReady, wallHeight, wallRenderWidth } from '../../entities/Wall.js';
import { spawnParticles, floaty } from './SpawnSystem.js?v=biomeactive4';
import { killEnemy } from '../../util/EnemyUtils.js?v=biomeactive4';
import { Audio } from '../infrastructure/Audio.js';
import { reapplyDefenseMaxHp } from '../../util/DefenseStats.js';

export function fortLevel() {
  return state.fortLevel || 0;
}

export function fortHas(id) {
  const idx = FORT_TRACK.findIndex(f => f.id === id);
  return idx >= 0 && idx < fortLevel();
}

export function fortNext() {
  return FORT_TRACK[fortLevel()] || null;
}

export function fortDefenseHpMult() {
  return fortHpMultAt(fortLevel());
}

export function purchaseFortUpgrade() {
  const f = fortNext();
  if (!f) return false;
  state.fortLevel = fortLevel() + 1;
  if (f.id === "stone" || f.id === "bulwark") reapplyDefenseMaxHp();
  if (f.id === "sigil") { state.sigilPulseT = 1; state.sigilPulse = 0; }
  floaty(state.player.x, `✨ ${f.name} attuned!`, f.col);
  spawnParticles(state.player.x, groundY - 40, 22, f.col, 110, 130);
  for (const w of state.walls || []) {
    if (wallReady(w)) spawnParticles(w.x, groundY - wallHeight(w) * 0.6, 10, f.col, 60, 80);
  }
  return true;
}

// Called whenever an enemy melees a wall. Ignites the attacker (ember wards)
// and reflects a share of the blow (bulwark thorns).
export function fortOnWallStruck(wall, attacker, dmg) {
  if (!attacker || attacker.hp === undefined || attacker.dying) return;
  if (fortHas("ember2")) {
    attacker.burn = Math.max(attacker.burn || 0, 4);
    attacker.burnDmg = Math.max(attacker.burnDmg || 0, 2);
    attacker.ignited = true;
  } else if (fortHas("ember1")) {
    attacker.burn = Math.max(attacker.burn || 0, 3);
    attacker.burnDmg = Math.max(attacker.burnDmg || 0, 1);
    attacker.ignited = true;
  }
  if (fortHas("bulwark")) {
    attacker.hp -= Math.max(1, Math.round(dmg * 0.3));
    attacker.flash = 0.1;
    spawnParticles(attacker.x, groundY + (attacker.fy || 0) - 22, 4, "#9be8c0", 40, 60);
    if (attacker.hp <= 0) killEnemy(attacker);
  }
}

const FROST_AURA_RANGE = 140;
const SIGIL_RANGE = 300;
const SIGIL_INTERVAL = 5;
const SIGIL_DMG = 3;

export function updateFortifications(dt) {
  if (Game.state !== "play" || !fortLevel()) return;

  const hasFrost = fortHas("frost");
  const emberTier = fortHas("ember2") ? 2 : fortHas("ember1") ? 1 : 0;

  for (const w of state.walls || []) {
    if (!wallReady(w)) continue;
    const h = wallHeight(w);
    // ambient ward dressing: drifting embers / frost motes at the wall
    if (emberTier && Math.random() < 0.06 * emberTier) {
      spawnParticles(w.x + w.side * (wallRenderWidth(w) / 2 - 2) + rand(-4, 4),
        groundY - rand(8, h * 0.8), 1, emberTier === 2 ? "#ff6a20" : "#ff8a3d", 12, 46);
    }
    if (hasFrost && Math.random() < 0.05) {
      spawnParticles(w.x + rand(-30, 30), groundY - rand(2, 14), 1, "#bfefff", 10, 22);
    }
    if (hasFrost) {
      for (const e of state.enemies) {
        if (e.dying || e.hp <= 0) continue;
        if (Math.abs(e.x - w.x) < FROST_AURA_RANGE) e.slow = Math.max(e.slow || 0, 0.35);
      }
    }
  }

  if (fortHas("sigil")) {
    state.sigilSpin = (state.sigilSpin || 0) + dt;
    if (state.sigilPulse > 0) state.sigilPulse -= dt;
    state.sigilPulseT = (state.sigilPulseT || SIGIL_INTERVAL) - dt;
    if (state.sigilPulseT <= 0) {
      state.sigilPulseT = SIGIL_INTERVAL;
      let hit = false;
      for (const e of state.enemies) {
        if (e.dying || e.hp <= 0) continue;
        if (Math.abs(e.x - state.base.x) < SIGIL_RANGE) {
          e.hp -= SIGIL_DMG;
          e.flash = 0.12;
          spawnParticles(e.x, groundY + (e.fy || 0) - 24, 6, "#c9a2ff", 50, 70);
          hit = true;
          if (e.hp <= 0) killEnemy(e);
        }
      }
      if (hit) {
        state.sigilPulse = 0.9;
        Audio.hit();
      }
    }
  }
}
