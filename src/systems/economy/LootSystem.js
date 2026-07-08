import { state, Game } from '../../core/state.js';
import { groundY } from '../../core/canvas.js';
import { dist, rand } from '../../util/math.js';
import { keys } from '../input/Input.js';
import { spawnCoin, spawnParticles, floaty } from '../world/SpawnSystem.js';
import { Audio } from '../infrastructure/Audio.js';

let pickupWeaponFn = null;

export function setPickupWeapon(fn) {
  pickupWeaponFn = fn;
}

export function updateLootItems(dt) {
  const { lootItems, player } = state;
  for (let i=lootItems.length-1;i>=0;i--) {
    const it=lootItems[i];
    if (it.dropVy === undefined) {
      it.despawnTimer = (it.despawnTimer || 0) + dt;
      if (it.despawnTimer >= 10) { lootItems.splice(i,1); continue; }
    }
    if (!Game.inMine && dist(it.x,player.x)<50) {
      if (!player.weapon || keys["f"]) {
        if (pickupWeaponFn) pickupWeaponFn(it.weaponId);
        lootItems.splice(i,1);
        break;
      }
    }
  }
}

export function updateWeaponPickup(dt) {
  if (state.weaponPickup) { state.weaponPickup.timer -= dt; if (state.weaponPickup.timer <= 0) state.weaponPickup = null; }
}

export function updateChests(dt) {
  const { chests, player, lootItems } = state;

  for (let i = chests.length - 1; i >= 0; i--) {
    const ch = chests[i];
    if (ch.open) {
      ch.openAnim += dt * 2.5;
      if (ch.openAnim >= 1) {
        for (let k = 0; k < ch.lootGold; k++)
          spawnCoin(ch.x + rand(-40, 40), 1, groundY - 20, rand(-100, 100), rand(-300, -160));
        if (ch.weaponId)
          lootItems.push({ x: ch.x + rand(-20, 20), weaponId: ch.weaponId, dropVy: -380, dropY: groundY - 180 });
        spawnParticles(ch.x, groundY - 24, 20, "#f2c14e", 120, 150);
        chests.splice(i, 1);
      }
    } else if (!Game.inMine && dist(ch.x, player.x) < 64 && keys['f']) {
      ch.open = true;
      Audio.chest();
    }
  }
}

export function updateLootPhysics(dt) {
  for (const it of state.lootItems) {
    if (it.dropVy !== undefined) {
      it.dropVy += 900 * dt;
      it.dropY += it.dropVy * dt;
      if (it.dropY >= groundY - 16) { it.dropY = groundY - 16; it.dropVy = 0; }
    }
  }
}
