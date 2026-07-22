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

  // --- Arcanum staffs: casting schools with bespoke projectiles ---
  // Each one drives a hand-written branch in SpellSystem.js (see the
  // "Arcanum staffs" section there) rather than the shared ballistic path.
  bramble_staff:   { name:"Thornroot Stave",   type:"magic", dmg:3, speed:1.15, range:325, rarity:2, col:"#7fc24a", spellType:"bramble",     aoeRadius:58 },
  prism_staff:     { name:"Prism Spire",       type:"magic", dmg:3, speed:1.0,  range:355, rarity:2, col:"#8fe8ff", spellType:"prism",       aoeRadius:44 },
  plague_staff:    { name:"Miasma Censer",     type:"magic", dmg:4, speed:1.5,  range:330, rarity:3, col:"#a8d84a", spellType:"spore",       aoeRadius:74 },
  gravity_staff:   { name:"Nullstone Scepter", type:"magic", dmg:4, speed:1.7,  range:390, rarity:3, col:"#7a3aff", spellType:"gravitywell", aoeRadius:96 },
  sanguine_staff:  { name:"Sanguine Rod",      type:"magic", dmg:3, speed:1.15, range:335, rarity:3, col:"#c0102a", spellType:"leech",       aoeRadius:34 },
  resonance_staff: { name:"Choirbell Staff",   type:"magic", dmg:5, speed:1.45, range:470, rarity:4, col:"#e8f8ff", spellType:"resonance",   aoeRadius:46 },

  // --- Autonomous foci: staffs that choose their own targets ---
  // `autoTarget` replaces the usual "hit whatever is closest" rule in
  // PlayerCombat's target picker; each one also drives its own casting school
  // in SpellSystem.js. `note` is the behavior line shown in the tooltip.
  rupture_shard:   { name:"The Rupture Shard",       type:"magic", dmg:3, speed:0.5,  range:560, rarity:3, col:"#c46bff", spellType:"fracture", aoeRadius:56, autoTarget:"chaos",
                     note:"Fires at random enemies anywhere in reach; every blast drags their neighbours inward." },
  gale_staff:      { name:"Gale-Staff of Aerion",    type:"magic", dmg:2, speed:2.2,  range:440, rarity:2, col:"#8fd8ff", spellType:"gale",     aoeRadius:78, autoTarget:"highest",
                     note:"Erupts beneath the highest enemy in the lane and hurls it into the sky." },
  bastion_scepter: { name:"The Bastion Scepter",     type:"magic", dmg:7, speed:0.45, range:700, rarity:3, col:"#f0b855", spellType:"bastion",  aoeRadius:64, autoTarget:"gate",
                     note:"Silent in the field. Near your own gates it hammers whatever stands closest to them." },
  hive_scepter:    { name:"The Hive-King's Scepter", type:"magic", dmg:2, speed:1.0,  range:400, rarity:4, col:"#9ef0b8", spellType:"larva",    aoeRadius:30, autoTarget:"stride",
                     note:"Sheds a soul-larva every few paces you walk. What a larva kills hatches and fights for you." },
};

// How far from the base gates the Bastion Scepter will answer at all.
export const BASTION_GUARD_RANGE = 430;

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
