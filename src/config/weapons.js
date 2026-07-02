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
  fire_tome:     { name:"Ildtome",        type:"magic",  dmg:2,  speed:1.3,  range:300, rarity:1, col:"#ff6a2a", spellType:"fireball",  aoeRadius:50 },
  hydro_tome:    { name:"Vandtome",       type:"magic",  dmg:2,  speed:0.65, range:270, rarity:1, col:"#4ab8e8", spellType:"waterjet",  aoeRadius:40 },
  // --- Tier 2: Sjælden ---
  flame_sword:   { name:"Flammesværd",    type:"melee",  dmg:6,  speed:1.0,  range:65,  rarity:2, col:"#ff6a2a" },
  ice_axe:       { name:"Isøkse",         type:"melee",  dmg:5,  speed:1.2,  range:55,  rarity:2, col:"#6abaff" },
  gilded_spear:  { name:"Forgyldt spyd",  type:"melee",  dmg:5,  speed:1.0,  range:102, rarity:2, col:"#e8b840" },
  lightning_tome:{ name:"Lyntome",        type:"magic",  dmg:3,  speed:1.1,  range:340, rarity:2, col:"#f0e060", spellType:"lightning", aoeRadius:0 },
  meteor_tome:   { name:"Meteortome",     type:"magic",  dmg:4,  speed:2.0,  range:300, rarity:2, col:"#ff8840", spellType:"meteor",    aoeRadius:80 },
  // --- Tier 3: Episk (lilla) ---
  shadow_axe:    { name:"Skyggeøkse",     type:"melee",  dmg:7,  speed:1.2,  range:58,  rarity:3, col:"#aa44cc" },
  thunder_blade: { name:"Tordenblade",    type:"melee",  dmg:8,  speed:1.0,  range:72,  rarity:3, col:"#cc66ff" },
  void_bow:      { name:"Tomrumsbue",     type:"ranged", dmg:7,  speed:1.1,  range:420, rarity:3, col:"#9933ff" },
  arcane_tome:   { name:"Arkanetome",     type:"magic",  dmg:4,  speed:0.9,  range:400, rarity:3, col:"#b080ff", spellType:"arcane",    aoeRadius:65 },
  shadow_tome:   { name:"Skyggetome",     type:"magic",  dmg:5,  speed:1.4,  range:380, rarity:3, col:"#8822cc", spellType:"shadow",    aoeRadius:75 },
  // --- Tier 4: Legendarisk (guld) ---
  kings_sword:   { name:"Kongens sværd",  type:"melee",  dmg:7,  speed:1.0,  range:78,  rarity:4, col:"#f2c14e" },
  dark_bow:      { name:"Mørkets bue",    type:"ranged", dmg:6,  speed:1.3,  range:450, rarity:4, col:"#cc88ff" },
  sunblade:      { name:"Solblade",       type:"melee",  dmg:10, speed:0.9,  range:82,  rarity:4, col:"#ffdd44" },
  dragons_bow:   { name:"Drakebue",       type:"ranged", dmg:9,  speed:1.2,  range:500, rarity:4, col:"#ff9922" },
  void_tome:     { name:"Tomhedstome",    type:"magic",  dmg:6,  speed:2.8,  range:460, rarity:4, col:"#e0a0ff", spellType:"void",      aoeRadius:90 },
};

export const RARITY_COL  = ["#c8c8c8","#9bd05a","#6ab4ff","#bb55ff","#f2c14e"];
export const RARITY_NAME = ["Almindelig","Ualmindelig","Sjælden","Episk","Legendarisk"];

export const WEAPON_UPGRADES = {
  generic: [
    { id:"sharpened", name:"Skærpet",        desc:"Mere skade",            effect:{ dmg:2 } },
    { id:"extended",  name:"Forlænget",       desc:"Større rækkevidde",     effect:{ range:25 } },
    { id:"quickened", name:"Lynhurtig",       desc:"Hurtigere angreb",      effect:{ speedBonus:0.15 } },
  ],
  melee: [
    { id:"heavy_blow",  name:"Knusende slag", desc:"+4 skade",              effect:{ dmg:4 } },
    { id:"whirlwind",   name:"Hvirvelstorm",  desc:"+20 px rækkevidde",     effect:{ range:20 } },
    { id:"swift_melee", name:"Let hånd",      desc:"+25% hurtigere angreb", effect:{ speedBonus:0.22 } },
  ],
  ranged: [
    { id:"piercing",   name:"Gennemborende",  desc:"+3 skade pr. pil",      effect:{ dmg:3 } },
    { id:"rapid_fire", name:"Hurtigskydning", desc:"+30% hurtigere skydning",effect:{ speedBonus:0.28 } },
    { id:"longshot",   name:"Langskud",       desc:"+80 px rækkevidde",     effect:{ range:80 } },
  ],
  magic: [
    { id:"amplified",  name:"Forstærket magi",desc:"+3 trylleslagskade",    effect:{ dmg:3 } },
    { id:"quickcast",  name:"Hurtigkast",     desc:"+30% hurtigere kast",   effect:{ speedBonus:0.25 } },
    { id:"wide_range", name:"Bred rækkevidde",desc:"+70 px rækkevidde",     effect:{ range:70 } },
    { id:"critical",   name:"Kritisk udladning",desc:"+5 trylleslagskade",  effect:{ dmg:5 } },
  ],
  meteor_tome: [
    { id:"ice_meteor", name:"Ismeteor", desc:"Meteoren bliver til en iskold komet, der fryser fjender i eksplosionen", effect:{ meteorIce:true } },
    { id:"double_up",  name:"Dobbelt op", desc:"Kaster sjÃ¦ldnere, men kalder to meteorer ned", effect:{ meteorDouble:true } },
  ],
};

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
