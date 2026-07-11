export const WEAPONS = {
  // --- Tier 0: Common ---
  rusty_sword:   { name:"Rusty Sword",  type:"melee",  dmg:2,  speed:1.4,  range:55,  rarity:0, col:"#8a8a92" },
  dagger:        { name:"Dagger",           type:"melee",  dmg:2,  speed:0.55, range:40,  rarity:0, col:"#b0b0b8" },
  short_bow:     { name:"Short Bow",        type:"ranged", dmg:2,  speed:1.1,  range:280, rarity:0, col:"#8a5a2a" },
  // --- Tier 1: Uncommon ---
  sword:         { name:"Sword",          type:"melee",  dmg:3,  speed:1.1,  range:62,  rarity:1, col:"#c8c8d0" },
  longsword:     { name:"Longsword",      type:"melee",  dmg:4,  speed:1.0,  range:74,  rarity:1, col:"#d0d0e0" },
  war_axe:       { name:"War Axe",      type:"melee",  dmg:5,  speed:1.5,  range:52,  rarity:1, col:"#9a8a62" },
  war_hammer:    { name:"War Hammer",    type:"melee",  dmg:6,  speed:1.9,  range:46,  rarity:1, col:"#7a7a82" },
  spear:         { name:"Spear",           type:"melee",  dmg:3,  speed:1.0,  range:90,  rarity:1, col:"#b8a870" },
  long_bow:      { name:"Long Bow",        type:"ranged", dmg:3,  speed:1.4,  range:380, rarity:1, col:"#7a4a1a" },
  crossbow:      { name:"Crossbow",       type:"ranged", dmg:4,  speed:1.9,  range:320, rarity:1, col:"#6a4a1a" },
  fire_tome:     { name:"Fire Tome",        type:"magic",  dmg:2,  speed:1.3,  range:300, rarity:1, col:"#ff6a2a", spellType:"fireball",  aoeRadius:50 },
  hydro_tome:    { name:"Water Tome",       type:"magic",  dmg:2,  speed:0.65, range:270, rarity:1, col:"#4ab8e8", spellType:"waterjet",  aoeRadius:40 },
  // --- Tier 2: Rare ---
  flame_sword:   { name:"Flame Sword",    type:"melee",  dmg:6,  speed:1.0,  range:65,  rarity:2, col:"#ff6a2a" },
  ice_axe:       { name:"Ice Axe",         type:"melee",  dmg:5,  speed:1.2,  range:55,  rarity:2, col:"#6abaff" },
  gilded_spear:  { name:"Gilded Spear",  type:"melee",  dmg:5,  speed:1.0,  range:102, rarity:2, col:"#e8b840" },
  lightning_tome:{ name:"Lightning Tome",        type:"magic",  dmg:3,  speed:1.1,  range:340, rarity:2, col:"#f0e060", spellType:"lightning", aoeRadius:0 },
  meteor_tome:   { name:"Meteor Tome",     type:"magic",  dmg:4,  speed:2.0,  range:300, rarity:2, col:"#ff8840", spellType:"meteor",    aoeRadius:80 },
  // --- Tier 3: Epic (purple) ---
  shadow_axe:    { name:"Shadow Axe",     type:"melee",  dmg:7,  speed:1.2,  range:58,  rarity:3, col:"#aa44cc" },
  thunder_blade: { name:"Thunder Blade",    type:"melee",  dmg:8,  speed:1.0,  range:72,  rarity:3, col:"#cc66ff" },
  void_bow:      { name:"Void Bow",     type:"ranged", dmg:7,  speed:1.1,  range:420, rarity:3, col:"#9933ff" },
  arcane_tome:   { name:"Arcane Tome",     type:"magic",  dmg:4,  speed:0.9,  range:400, rarity:3, col:"#b080ff", spellType:"arcane",    aoeRadius:65 },
  shadow_tome:   { name:"Shadow Tome",     type:"magic",  dmg:5,  speed:1.4,  range:380, rarity:3, col:"#8822cc", spellType:"shadow",    aoeRadius:75 },
  // --- Tier 4: Legendary (gold) ---
  kings_sword:   { name:"King's Sword",  type:"melee",  dmg:7,  speed:1.0,  range:78,  rarity:4, col:"#f2c14e" },
  dark_bow:      { name:"Dark Bow",    type:"ranged", dmg:6,  speed:1.3,  range:450, rarity:4, col:"#cc88ff" },
  sunblade:      { name:"Sunblade",       type:"melee",  dmg:10, speed:0.9,  range:82,  rarity:4, col:"#ffdd44" },
  dragons_bow:   { name:"Dragon's Bow",       type:"ranged", dmg:9,  speed:1.2,  range:500, rarity:4, col:"#ff9922" },
  void_tome:     { name:"Void Tome",    type:"magic",  dmg:6,  speed:2.8,  range:460, rarity:4, col:"#e0a0ff", spellType:"void",      aoeRadius:90 },
};

export const RARITY_COL  = ["#c8c8c8","#9bd05a","#6ab4ff","#bb55ff","#f2c14e"];
export const RARITY_NAME = ["Common","Uncommon","Rare","Epic","Legendary"];

export const WEAPON_UPGRADES = {
  generic: [
    { id:"sharpened", name:"Sharpened",        desc:"More damage",            effect:{ dmg:2 } },
    { id:"extended",  name:"Extended",       desc:"Longer range",     effect:{ range:25 } },
    { id:"quickened", name:"Lightning Fast",       desc:"Faster attacks",      effect:{ speedBonus:0.15 } },
  ],
  melee: [
    { id:"heavy_blow",  name:"Crushing Blow", desc:"+4 damage",              effect:{ dmg:4 } },
    { id:"whirlwind",   name:"Whirlwind",  desc:"+20 px range",     effect:{ range:20 } },
    { id:"swift_melee", name:"Light Hand",      desc:"+25% faster attacks", effect:{ speedBonus:0.22 } },
  ],
  ranged: [
    { id:"piercing",   name:"Piercing",  desc:"+3 damage per arrow",      effect:{ dmg:3 } },
    { id:"rapid_fire", name:"Rapid Fire", desc:"+30% faster shooting",effect:{ speedBonus:0.28 } },
    { id:"longshot",   name:"Longshot",       desc:"+80 px range",     effect:{ range:80 } },
  ],
  magic: [
    { id:"amplified",  name:"Amplified Magic",desc:"+3 spell damage",    effect:{ dmg:3 } },
    { id:"quickcast",  name:"Quickcast",     desc:"+30% faster casting",   effect:{ speedBonus:0.25 } },
    { id:"wide_range", name:"Wide Range",desc:"+70 px range",     effect:{ range:70 } },
    { id:"critical",   name:"Critical Discharge",desc:"+5 spell damage",  effect:{ dmg:5 } },
  ],
  meteor_tome: [
    { id:"ice_meteor", name:"Ice Meteor", desc:"The meteor becomes an icy comet that freezes enemies in the explosion", effect:{ meteorIce:true } },
    { id:"double_up",  name:"Double Up", desc:"Casts less often, but calls down two meteors", effect:{ meteorDouble:true } },
  ],
};

// Dedicated "Aura & Control" branch for the Short Bow — offered one at a time, in order.
export const SHORT_BOW_BRANCH = [
  { id:"frost_bow",      name:"Frost Bow",         desc:"Each arrow significantly slows enemy movement speed.", effect:{ frostArrow:true } },
  { id:"binding_arrows", name:"Binding Arrows", desc:"Hit enemies are pinned to the ground for 3 seconds.", effect:{ rootArrow:true }, requires:"frost_bow" },
  { id:"ice_explosion", name:"Ice Explosion",     desc:"Ultimate: Creates a massive ice explosion that freezes all nearby enemies for 5 seconds.", effect:{ iceUltimate:true }, requires:"binding_arrows", ultimate:true },
];

export function effectiveWeapon(weaponId, upgrades) {
  const base = WEAPONS[weaponId];
  if (!upgrades || upgrades.length === 0) return base;
  let dmg = base.dmg, speed = base.speed, range = base.range;
  for (const u of upgrades) {
    if (u.effect.dmg)        dmg   += u.effect.dmg;
    if (u.effect.speedBonus) speed  = Math.max(0.25, speed - u.effect.speedBonus);
    if (u.effect.range)      range += u.effect.range;
  }
  return { ...base, dmg: Math.round(dmg * 10) / 10, speed: Math.round(speed * 100) / 100, range };
}
