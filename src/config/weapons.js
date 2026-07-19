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
  fire_tome:     { name:"Cinder Wand",      type:"magic",  dmg:2,  speed:1.3,  range:300, rarity:1, col:"#ff6a2a", spellType:"fireball",  aoeRadius:50 },
  hydro_tome:    { name:"Tide Wand",        type:"magic",  dmg:2,  speed:0.65, range:270, rarity:1, col:"#4ab8e8", spellType:"waterjet",  aoeRadius:40 },
  // --- Tier 2: Rare ---
  flame_sword:   { name:"Flame Sword",    type:"melee",  dmg:6,  speed:1.0,  range:65,  rarity:2, col:"#ff6a2a" },
  ice_axe:       { name:"Ice Axe",         type:"melee",  dmg:5,  speed:1.2,  range:55,  rarity:2, col:"#6abaff" },
  gilded_spear:  { name:"Gilded Spear",  type:"melee",  dmg:5,  speed:1.0,  range:102, rarity:2, col:"#e8b840" },
  lightning_tome:{ name:"Storm Staff",           type:"magic",  dmg:3,  speed:1.1,  range:340, rarity:2, col:"#f0e060", spellType:"lightning", aoeRadius:0 },
  meteor_tome:   { name:"Meteor Staff",    type:"magic",  dmg:4,  speed:2.0,  range:300, rarity:2, col:"#ff8840", spellType:"meteor",    aoeRadius:80 },
  // --- Tier 3: Epic (purple) ---
  shadow_axe:    { name:"Shadow Axe",     type:"melee",  dmg:7,  speed:1.2,  range:58,  rarity:3, col:"#aa44cc" },
  thunder_blade: { name:"Thunder Blade",    type:"melee",  dmg:8,  speed:1.0,  range:72,  rarity:3, col:"#cc66ff" },
  void_bow:      { name:"Void Bow",     type:"ranged", dmg:7,  speed:1.1,  range:420, rarity:3, col:"#9933ff" },
  arcane_tome:   { name:"Arcane Staff",    type:"magic",  dmg:4,  speed:0.9,  range:400, rarity:3, col:"#b080ff", spellType:"arcane",    aoeRadius:65 },
  shadow_tome:   { name:"Shadow Staff",    type:"magic",  dmg:5,  speed:1.4,  range:380, rarity:3, col:"#8822cc", spellType:"shadow",    aoeRadius:75 },
  // --- Tier 4: Legendary (gold) ---
  kings_sword:   { name:"King's Sword",  type:"melee",  dmg:7,  speed:1.0,  range:78,  rarity:4, col:"#f2c14e" },
  dark_bow:      { name:"Dark Bow",    type:"ranged", dmg:6,  speed:1.3,  range:450, rarity:4, col:"#cc88ff" },
  sunblade:      { name:"Sunblade",       type:"melee",  dmg:10, speed:0.9,  range:82,  rarity:4, col:"#ffdd44" },
  dragons_bow:   { name:"Dragon's Bow",       type:"ranged", dmg:9,  speed:1.2,  range:500, rarity:4, col:"#ff9922" },
  void_tome:     { name:"Void Staff",   type:"magic",  dmg:6,  speed:2.8,  range:460, rarity:4, col:"#e0a0ff", spellType:"void",      aoeRadius:90 },

  // --- Biome enemy drops ---
  splinter_bow:      { name:"Splinter Bow",         type:"ranged", dmg:4,  speed:1.25, range:390, rarity:3, col:"#8fd05a", biomeOnly:true, biome:"forest", innate:{ splinterCount:3, splinterRadius:145, splinterDmgFrac:0.45 } },
  lumberjack_axe:    { name:"Lumberjack's Hatchet", type:"melee",  dmg:6,  speed:1.25, range:66,  rarity:2, col:"#b8884e", biomeOnly:true, biome:"forest", innate:{ splashFrac:0.24, splashR:78, alwaysCleave:true, knockBonus:60 } },

  icicle_spear:      { name:"Icicle Lance",         type:"melee",  dmg:6,  speed:1.05, range:112, rarity:3, col:"#bfefff", biomeOnly:true, biome:"frozen", innate:{ frostHit:2.4, rootHit:0.18, shatter:2 } },
  blizzard_chime:    { name:"Blizzard Chime",       type:"magic",  dmg:2,  speed:1.7,  range:330, rarity:3, col:"#d8f8ff", biomeOnly:true, biome:"frozen", spellType:"waterjet", aoeRadius:72, innate:{ spellFrost:2.4, geyser:0.65, frostAura:0.45, frostAuraRadius:175 } },

  cactus_whip:       { name:"Cactus Whip",          type:"melee",  dmg:4,  speed:0.85, range:118, rarity:3, col:"#6fba46", biomeOnly:true, biome:"desert", innate:{ poisonHit:3.5, poisonDmg:1, slowHit:0.7, alwaysCleave:true } },
  sandstorm_sling:   { name:"Sandstorm Sling",      type:"ranged", dmg:4,  speed:1.15, range:360, rarity:3, col:"#d8b46a", biomeOnly:true, biome:"desert", innate:{ sandBlind:2, sandBlindRadius:90, slowHit:0.8 } },

  acid_blowgun:      { name:"Acid Blowgun",         type:"ranged", dmg:3,  speed:0.65, range:335, rarity:3, col:"#7fe05a", biomeOnly:true, biome:"swamp", innate:{ poisonArrow:4.2, poisonDmg:1, slowHit:0.35 } },
  gator_hammer:      { name:"Gator Maul",           type:"melee",  dmg:9,  speed:2.05, range:60,  rarity:3, col:"#6d8a42", biomeOnly:true, biome:"swamp", innate:{ knockBonus:260, splashFrac:0.35, splashR:105, execute:0.12 } },

  obsidian_brand:    { name:"Obsidian Brand",       type:"melee",  dmg:7,  speed:0.95, range:74,  rarity:4, col:"#ff6a28", biomeOnly:true, biome:"volcano", innate:{ burnHit:1, heatStacks:5, heatBurstRadius:125, heatBurstFrac:0.75 } },
  magma_mortar:      { name:"Magma Mortar",         type:"magic",  dmg:5,  speed:2.4,  range:360, rarity:4, col:"#ff7a2a", biomeOnly:true, biome:"volcano", spellType:"meteor", aoeRadius:92, innate:{ spellBurn:2, firePool:true, meteorFragments:1 } },

  shadow_scythe:     { name:"Shadow Scythe",        type:"melee",  dmg:8,  speed:1.2,  range:88,  rarity:4, col:"#8c4cff", biomeOnly:true, biome:"corrupted", innate:{ healOnKill:0.45, slowHit:1.0, splashFrac:0.22, splashR:95 } },
  possessed_heart:   { name:"Possessed Heart",      type:"magic",  dmg:7,  speed:1.55, range:430, rarity:4, col:"#c45cff", biomeOnly:true, biome:"corrupted", spellType:"void", aoeRadius:78, innate:{ singularity:true, voidScar:1, castGoldCost:1, castHpCost:1 } },
};

export const BIOME_WEAPON_DROPS = {
  forest: ["splinter_bow", "lumberjack_axe"],
  frozen: ["icicle_spear", "blizzard_chime"],
  desert: ["cactus_whip", "sandstorm_sling"],
  swamp: ["acid_blowgun", "gator_hammer"],
  volcano: ["obsidian_brand", "magma_mortar"],
  corrupted: ["shadow_scythe", "possessed_heart"],
};

export const RARITY_COL  = ["#c8c8c8","#9bd05a","#6ab4ff","#bb55ff","#f2c14e"];
export const RARITY_NAME = ["Common","Uncommon","Rare","Epic","Legendary"];

// Upgrade pools (tiers, unique upgrades, short-bow branch) live in weaponUpgrades.js.

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
