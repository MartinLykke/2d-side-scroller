import { state, Game } from '../../core/state.js';
import { WEAPONS } from '../../config/weapons.js';
import { ARMORS } from '../../config/armor.js';
import { dist } from '../../util/math.js';
import { Audio } from '../infrastructure/Audio.js';
import { floaty } from '../world/SpawnSystem.js';

export const WEAPON_SHOP = [
  { weaponId: 'rusty_sword',   price: 6,  tier: 1 },
  { weaponId: 'short_bow',     price: 9,  tier: 1 },
  { weaponId: 'sword',         price: 16, tier: 2 },
  { weaponId: 'crossbow',      price: 22, tier: 2 },
  { weaponId: 'war_axe',       price: 28, tier: 3 },
  { weaponId: 'long_bow',      price: 33, tier: 3 },
  { weaponId: 'flame_sword',   price: 48, tier: 4 },
  { weaponId: 'gilded_spear',  price: 44, tier: 4 },
  { weaponId: 'shadow_axe',    price: 58, tier: 4 },
  { weaponId: 'kings_sword',   price: 80, tier: 5 },
  { weaponId: 'dark_bow',      price: 75, tier: 5 },
  { weaponId: 'thunder_blade', price: 68, tier: 5 },
  { weaponId: 'void_bow',      price: 62, tier: 5 },
  { weaponId: 'sunblade',      price: 95, tier: 6 },
  { weaponId: 'dragons_bow',   price: 90, tier: 6 },
  { weaponId: 'void_tome',     price: 88, tier: 6 },
  { weaponId: 'fire_tome',     price: 14, tier: 2 },
  { weaponId: 'hydro_tome',    price: 12, tier: 2 },
  { weaponId: 'lightning_tome',price: 38, tier: 4 },
  { weaponId: 'meteor_tome',   price: 44, tier: 4 },
  { weaponId: 'arcane_tome',   price: 65, tier: 5 },
  { weaponId: 'shadow_tome',   price: 62, tier: 5 },
];

export const ARMOR_SHOP = [
  { armorId: 'leather_cap',      price: 6,  tier: 1 },
  { armorId: 'studded_vest',     price: 12, tier: 2 },
  { armorId: 'chainmail',        price: 18, tier: 2 },
  { armorId: 'scale_armor',      price: 28, tier: 3 },
  { armorId: 'plate_chestplate', price: 38, tier: 3 },
  { armorId: 'shadow_cloak',     price: 52, tier: 4 },
  { armorId: 'dragon_scale',     price: 65, tier: 4 },
  { armorId: 'void_armor',       price: 82, tier: 5 },
  { armorId: 'sun_plate',        price: 98, tier: 6 },
];

let pickupWeaponFn = null;

export function setPickupWeapon(fn) {
  pickupWeaponFn = fn;
}

export function shopTierUnlocked() {
  const lvl = state.base?.level || 1;
  if (lvl < 4) return 0;
  if (lvl >= 4) return 6;
  return 0;
}

export function tryOpenShop() {
  const shopSt = state.stations.find(s => s.id === "shop");
  if (shopSt && state.base.level >= 4 && dist(state.player.x, shopSt.x()) < 100) {
    Game.shopOpen = !Game.shopOpen;
    Game.shopIdx  = 0;
  }
}

export function currentShopList() {
  const tier = shopTierUnlocked();
  const list = Game.shopTab === 1 ? ARMOR_SHOP : WEAPON_SHOP;
  return list.filter(item => (item.tier || 1) <= tier);
}

export function tryBuyShopItem(item) {
  if (!item || state.player.coins < item.price) return;
  state.player.coins -= item.price;
  if (item.armorId) {
    state.player.armor = item.armorId;
    floaty(state.player.x, "🛡 " + ARMORS[item.armorId].name, "#9bd05a");
  } else if (item.weaponId) {
    if (pickupWeaponFn) pickupWeaponFn(item.weaponId);
    floaty(state.player.x, "🛒 " + WEAPONS[item.weaponId].name, "#9bd05a");
  }
}

export function handleShopKeys(k, e) {
  const list = currentShopList();
  if (k === "arrowleft")  { Game.shopIdx = Math.max(0, Game.shopIdx - 1); e.preventDefault(); }
  if (k === "arrowright") { Game.shopIdx = Math.min(list.length - 1, Game.shopIdx + 1); e.preventDefault(); }
  if (k === "t") { Game.shopTab = Game.shopTab === 0 ? 1 : 0; Game.shopIdx = 0; }
  if (k === "e" || k === "enter") tryBuyShopItem(list[Game.shopIdx]);
}
