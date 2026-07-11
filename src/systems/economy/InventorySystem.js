import { state } from '../../core/state.js';
import { Audio } from '../infrastructure/Audio.js';

// Inventory items are plain objects, so they serialize straight into saves:
//   { kind: "weapon", weaponId, upgrades: [...] }
//   { kind: "armor",  armorId }
// Storage has no weight limit — the UI grid simply grows with the items.

export function weaponLevel(upgrades) {
  return 1 + ((upgrades && upgrades.length) || 0);
}

export function ensureInventory(player = state.player) {
  if (player && !Array.isArray(player.inventory)) player.inventory = [];
  return player ? player.inventory : [];
}

export function playerOwnsWeapon(weaponId) {
  const p = state.player;
  if (!p) return false;
  if (p.weapon === weaponId) return true;
  return ensureInventory(p).some(it => it.kind === "weapon" && it.weaponId === weaponId);
}

export function playerOwnsArmor(armorId) {
  const p = state.player;
  if (!p) return false;
  if (p.armor === armorId) return true;
  return ensureInventory(p).some(it => it.kind === "armor" && it.armorId === armorId);
}

export function storeWeapon(weaponId, upgrades) {
  if (!weaponId) return;
  ensureInventory().push({ kind: "weapon", weaponId, upgrades: upgrades || [] });
}

export function storeArmor(armorId) {
  if (!armorId) return;
  ensureInventory().push({ kind: "armor", armorId });
}

// Equip a freshly acquired armor piece (shop/chest); the replaced piece is stored.
export function equipArmor(armorId) {
  const p = state.player;
  if (!p) return;
  if (p.armor) storeArmor(p.armor);
  p.armor = armorId;
  Audio.pickup();
}

export function unequipWeapon() {
  const p = state.player;
  if (!p || !p.weapon) return false;
  storeWeapon(p.weapon, p.weaponUpgrades || []);
  p.weapon = null;
  p.weaponUpgrades = [];
  Audio.pickup();
  return true;
}

export function unequipArmor() {
  const p = state.player;
  if (!p || !p.armor) return false;
  storeArmor(p.armor);
  p.armor = null;
  Audio.pickup();
  return true;
}

// Equip the inventory item at `index`, swapping with whatever is equipped.
export function equipFromInventory(index) {
  const p = state.player;
  const inv = ensureInventory(p);
  const it = inv[index];
  if (!p || !it) return false;
  inv.splice(index, 1);
  if (it.kind === "armor") {
    if (p.armor) storeArmor(p.armor);
    p.armor = it.armorId;
  } else {
    if (p.weapon) storeWeapon(p.weapon, p.weaponUpgrades || []);
    p.weapon = it.weaponId;
    p.weaponUpgrades = it.upgrades || [];
  }
  Audio.pickup();
  return true;
}
