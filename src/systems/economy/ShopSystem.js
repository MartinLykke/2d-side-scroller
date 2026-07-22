import { state, Game } from '../../core/state.js';
import { inject } from '../../core/services.js';
import { WEAPONS } from '../../config/weapons.js?v=biomeweapons1';
import { ARMORS } from '../../config/armor.js';
import { dist } from '../../util/math.js';
import { Audio } from '../infrastructure/Audio.js';
import { equipArmor, playerOwnsWeapon, playerOwnsArmor } from './InventorySystem.js';
import { MOUNTS } from '../../config/mounts.js';
import { playerOwnsMount, acquireMount, toggleMount } from './MountSystem.js';

// Grid width shared with the shop overlay renderer.
export const SHOP_COLS = 5;
// Walk this far from the shopkeeper and the shop closes on its own.
const SHOP_CLOSE_RANGE = 150;

export const WEAPON_SHOP = [
  { weaponId: 'rusty_sword',   price: 5,  tier: 1 },
  { weaponId: 'short_bow',     price: 7,  tier: 1 },
  { weaponId: 'sword',         price: 13, tier: 2 },
  { weaponId: 'crossbow',      price: 18, tier: 2 },
  { weaponId: 'war_axe',       price: 23, tier: 3 },
  { weaponId: 'long_bow',      price: 27, tier: 3 },
  { weaponId: 'flame_sword',   price: 39, tier: 4 },
  { weaponId: 'gilded_spear',  price: 36, tier: 4 },
  { weaponId: 'shadow_axe',    price: 47, tier: 4 },
  { weaponId: 'kings_sword',   price: 64, tier: 5 },
  { weaponId: 'dark_bow',      price: 60, tier: 5 },
  { weaponId: 'thunder_blade', price: 55, tier: 5 },
  { weaponId: 'void_bow',      price: 50, tier: 5 },
  { weaponId: 'sunblade',      price: 76, tier: 6 },
  { weaponId: 'dragons_bow',   price: 72, tier: 6 },
  { weaponId: 'void_tome',     price: 70, tier: 6 },
  { weaponId: 'fire_tome',     price: 11, tier: 2 },
  { weaponId: 'hydro_tome',    price: 10, tier: 2 },
  { weaponId: 'lightning_tome',price: 31, tier: 4 },
  { weaponId: 'meteor_tome',   price: 36, tier: 4 },
  { weaponId: 'arcane_tome',   price: 52, tier: 5 },
  { weaponId: 'shadow_tome',   price: 50, tier: 5 },
  // Arcanum staffs
  { weaponId: 'bramble_staff',  price: 26, tier: 3 },
  { weaponId: 'prism_staff',    price: 29, tier: 3 },
  { weaponId: 'plague_staff',   price: 44, tier: 4 },
  { weaponId: 'sanguine_staff', price: 46, tier: 4 },
  { weaponId: 'gravity_staff',  price: 56, tier: 5 },
  { weaponId: 'resonance_staff',price: 74, tier: 6 },
  // Self-driving casters — they aim themselves, so they cost a premium
  { weaponId: 'pale_censer',      price: 46, tier: 5 },
  { weaponId: 'weeping_sapphire', price: 44, tier: 5 },
  { weaponId: 'raven_scepter',    price: 54, tier: 5 },
  { weaponId: 'tuning_fork',      price: 74, tier: 6 },
  { weaponId: 'fractured_monolith',price: 80, tier: 6 },
];

export const ARMOR_SHOP = [
  { armorId: 'leather_cap',      price: 5,  tier: 1 },
  { armorId: 'studded_vest',     price: 10, tier: 2 },
  { armorId: 'chainmail',        price: 15, tier: 2 },
  { armorId: 'scale_armor',      price: 23, tier: 3 },
  { armorId: 'plate_chestplate', price: 31, tier: 3 },
  { armorId: 'shadow_cloak',     price: 42, tier: 4 },
  { armorId: 'dragon_scale',     price: 52, tier: 4 },
  { armorId: 'void_armor',       price: 66, tier: 5 },
  { armorId: 'sun_plate',        price: 78, tier: 6 },
];

export const MOUNT_SHOP = [
  { mountId: 'dun_pony',         price: 20, tier: 1 },
  { mountId: 'chestnut_courser', price: 45, tier: 3 },
  { mountId: 'ember_warhorse',   price: 85, tier: 6 },
];

let pickupWeaponFn = null;

export function setPickupWeapon(fn) {
  pickupWeaponFn = fn;
}

export function shopTierUnlocked() {
  const lvl = state.base?.level || 1;
  if (lvl < 2) return 0;
  if (lvl >= 4) return 6;
  return 1;
}

export function tryOpenShop() {
  const shopSt = state.stations.find(s => s.id === "shop");
  if (shopSt && state.base.level >= 2 && dist(state.player.x, shopSt.x()) < 100) {
    Game.shopOpen = !Game.shopOpen;
    Game.shopIdx  = 0;
  }
}

// Called every tick: the shop closes itself when the player walks away.
export function updateShop() {
  if (!Game.shopOpen) return;
  const shopSt = state.stations.find(s => s.id === "shop");
  if (!shopSt || state.base.level < 2 ||
      dist(state.player.x, shopSt.x()) > SHOP_CLOSE_RANGE) {
    Game.shopOpen = false;
  }
}

export function currentShopList() {
  const tier = shopTierUnlocked();
  const list = Game.shopTab === 2 ? MOUNT_SHOP : Game.shopTab === 1 ? ARMOR_SHOP : WEAPON_SHOP;
  return list.filter(item => (item.tier || 1) <= tier);
}

export function isShopItemOwned(item) {
  if (!item) return false;
  if (item.mountId) return playerOwnsMount(item.mountId);
  return item.armorId ? playerOwnsArmor(item.armorId) : playerOwnsWeapon(item.weaponId);
}

export function tryBuyShopItem(item) {
  if (!item) return;
  const floaty = inject('floaty');
  if (isShopItemOwned(item)) {
    // Owned mounts toggle between riding and stabling instead of re-buying.
    if (item.mountId) { toggleMount(item.mountId); return; }
    if (floaty) floaty(state.player.x, "Already owned", "#c8c8c8");
    return;
  }
  if (state.player.coins < item.price) {
    if (floaty) floaty(state.player.x, "Not enough gold", "#ff6a4a");
    return;
  }
  state.player.coins -= item.price;
  if (item.mountId) {
    acquireMount(item.mountId); // plays its own mount-up feedback
    return;
  }
  if (item.armorId) {
    equipArmor(item.armorId);
    if (floaty) floaty(state.player.x, ARMORS[item.armorId].name + " equipped 🛡", "#9bd05a");
  } else if (item.weaponId) {
    if (pickupWeaponFn) pickupWeaponFn(item.weaponId);
  }
  Audio.upgrade();
}

export function handleShopKeys(k, e) {
  const list = currentShopList();
  const last = Math.max(0, list.length - 1);
  if (k === "arrowleft")  { Game.shopIdx = Math.max(0, Game.shopIdx - 1); e.preventDefault(); }
  if (k === "arrowright") { Game.shopIdx = Math.min(last, Game.shopIdx + 1); e.preventDefault(); }
  if (k === "arrowup")    { Game.shopIdx = Math.max(0, Game.shopIdx - SHOP_COLS); e.preventDefault(); }
  if (k === "arrowdown")  { Game.shopIdx = Math.min(last, Game.shopIdx + SHOP_COLS); e.preventDefault(); }
  if (k === "t") { Game.shopTab = ((Game.shopTab || 0) + 1) % 3; Game.shopIdx = 0; }
  if (k === "e" || k === "enter") tryBuyShopItem(list[Game.shopIdx]);
}
