import { state } from '../../core/state.js';
import { MOUNTS } from '../../config/mounts.js';
import { groundY } from '../../core/canvas.js';
import { spawnParticles, floaty } from '../world/SpawnSystem.js';
import { Audio } from '../infrastructure/Audio.js';

// Owned mounts live on player.mounts (ids); the ridden one is player.mountId.

export function playerOwnsMount(mountId) {
  return (state.player?.mounts || []).includes(mountId);
}

// The mount the player is visibly riding right now, or null.
export function activeMount(p = state.player) {
  if (!p || !p.mountId) return null;
  if (p.climbingWall) return null; // the horse waits below while you climb
  return MOUNTS[p.mountId] || null;
}

// Extra vertical lift the saddle adds under the player. Everything that
// positions the player's body/hands (weapon FX, arrow and spell origins,
// the render transform) adds this on top of wall lift + jump height.
export function playerMountLift(p = state.player) {
  const m = activeMount(p);
  return m ? m.lift : 0;
}

export function mountSpeedMult(p = state.player) {
  const m = activeMount(p);
  return m ? m.speedMult : 1;
}

function mountFX(p) {
  spawnParticles(p.x, groundY - 10, 8, "#c9b48a", 40, 30);
  Audio.upgrade();
}

// Buy flow: first purchase saddles up immediately.
export function acquireMount(mountId) {
  const p = state.player;
  if (!p) return;
  p.mounts = p.mounts || [];
  if (!p.mounts.includes(mountId)) p.mounts.push(mountId);
  p.mountId = mountId;
  mountFX(p);
  floaty(p.x, MOUNTS[mountId].name + " 🐴", MOUNTS[mountId].col);
}

// Toggle riding a specific owned mount (shop click), or with no argument the
// last mount ridden (H key).
export function toggleMount(mountId = null) {
  const p = state.player;
  if (!p) return;
  p.mounts = p.mounts || [];
  if (mountId === null) mountId = p.mountId || p.lastMountId || p.mounts[p.mounts.length - 1];
  if (!mountId || !p.mounts.includes(mountId)) return;
  if (p.mountId === mountId) {
    p.mountId = null;
    p.lastMountId = mountId;
    floaty(p.x, "Dismounted", "#c8c8c8");
    spawnParticles(p.x, groundY - 6, 5, "#c9b48a", 30, 20);
  } else {
    p.mountId = mountId;
    mountFX(p);
    floaty(p.x, MOUNTS[mountId].name + " 🐴", MOUNTS[mountId].col);
  }
}
