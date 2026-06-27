export const WEAPONS = {
  // --- Tier 0: Almindelig ---
  rusty_sword:   { name:"Rustent sværd",  type:"melee",  dmg:2,  speed:1.4,  range:55,  rarity:0, col:"#8a8a92" },
  dagger:        { name:"Dolk",           type:"melee",  dmg:2,  speed:0.55, range:40,  rarity:0, col:"#b0b0b8" },
  short_bow:     { name:"Kortbue",        type:"ranged", dmg:2,  speed:1.1,  range:280, rarity:0, col:"#8a5a2a" },
  // --- Tier 1: Ualmindelig ---
  sword:         { name:"Sværd",          type:"melee",  dmg:3,  speed:1.1,  range:62,  rarity:1, col:"#c8c8d0" },
  longsword:     { name:"Langsværd",      type:"melee",  dmg:4,  speed:1.0,  range:74,  rarity:1, col:"#d0d0e0" },
  war_axe:       { name:"Krigsøkse",      type:"melee",  dmg:5,  speed:1.5,  range:52,  rarity:1, col:"#9a8a62" },
  war_hammer:    { name:"Krigshammer",    type:"melee",  dmg:6,  speed:1.9,  range:46,  rarity:1, col:"#7a7a82" },
  spear:         { name:"Spyd",           type:"melee",  dmg:3,  speed:1.0,  range:90,  rarity:1, col:"#b8a870" },
  long_bow:      { name:"Langbue",        type:"ranged", dmg:3,  speed:1.4,  range:380, rarity:1, col:"#7a4a1a" },
  crossbow:      { name:"Armbrøst",       type:"ranged", dmg:4,  speed:1.9,  range:320, rarity:1, col:"#6a4a1a" },
  // --- Tier 2: Sjælden ---
  flame_sword:   { name:"Flammesværd",    type:"melee",  dmg:7,  speed:1.0,  range:65,  rarity:2, col:"#ff6a2a" },
  ice_axe:       { name:"Isøkse",         type:"melee",  dmg:5,  speed:1.2,  range:55,  rarity:2, col:"#6abaff" },
  gilded_spear:  { name:"Forgyldt spyd",  type:"melee",  dmg:6,  speed:1.0,  range:102, rarity:2, col:"#e8b840" },
  // --- Tier 3: Episk (lilla) ---
  shadow_axe:    { name:"Skyggeøkse",     type:"melee",  dmg:9,  speed:1.2,  range:58,  rarity:3, col:"#aa44cc" },
  thunder_blade: { name:"Tordenblade",    type:"melee",  dmg:11, speed:1.0,  range:72,  rarity:3, col:"#cc66ff" },
  void_bow:      { name:"Tomrumsbue",     type:"ranged", dmg:8,  speed:1.1,  range:420, rarity:3, col:"#9933ff" },
  // --- Tier 4: Legendarisk (guld) ---
  kings_sword:   { name:"Kongens sværd",  type:"melee",  dmg:9,  speed:1.0,  range:78,  rarity:4, col:"#f2c14e" },
  dark_bow:      { name:"Mørkets bue",    type:"ranged", dmg:6,  speed:1.3,  range:450, rarity:4, col:"#cc88ff" },
  sunblade:      { name:"Solblade",       type:"melee",  dmg:14, speed:0.9,  range:82,  rarity:4, col:"#ffdd44" },
  dragons_bow:   { name:"Drakebue",       type:"ranged", dmg:11, speed:1.2,  range:500, rarity:4, col:"#ff9922" },
};

export const RARITY_COL  = ["#c8c8c8","#9bd05a","#6ab4ff","#bb55ff","#f2c14e"];
export const RARITY_NAME = ["Almindelig","Ualmindelig","Sjælden","Episk","Legendarisk"];
