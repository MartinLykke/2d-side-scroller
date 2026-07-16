// Weapon upgrade definitions: tiered pools (rare/epic/legendary) plus unique
// upgrades per weapon. Picked on player level-up in UpgradeSystem.js.
//
// Effect vocabulary (merged across applied upgrades by mergeUpgradeEffects):
//   Stats (applied in effectiveWeapon):
//     dmg, range, speedBonus
//   Melee (PlayerCombat):
//     critBonus      – added to crit chance (also player arrows)
//     doubleStrike   – chance to strike the same target twice
//     execute        – finishes non-boss enemies below this HP fraction
//     healOnKill     – chance to heal 1 HP on kill (melee + player arrows)
//     goldOnKill     – chance for bonus gold on kill (melee + player arrows)
//     splashFrac/splashR – every hit splashes frac damage in R px
//     alwaysCleave   – the on-kill cleave triggers on every hit
//     berserk        – up to +frac damage scaled by missing HP
//     shatter        – flat bonus damage vs chilled/rooted targets
//     burnHit        – ignites targets (value = burn damage per tick)
//     frostHit       – chills targets for value seconds
//     rootHit        – chance to pin the target for 1.5s
//     knockBonus     – extra knockback px
//     beamChance/beamFrac – chance to release a piercing slash wave
//     novaR/novaFrac/novaCol – kills explode
//     skyBolt        – chance to call lightning on the target
//   Ranged (arrow spawn + ProjectileSystem):
//     pierce         – arrows punch through N extra enemies
//     multishot      – chance to loose a second arrow at another enemy
//     fireArrows     – arrows ignite what they hit
//     explosiveR/explosiveFrac – arrows burst on impact
//     gravityArrow   – chance the impact drags nearby enemies in
//     instantReload  – chance the next shot is ready instantly
//   Magic (SpellSystem):
//     aoeBonus       – extra blast radius px
//     chainBonus     – extra chain-lightning bounces
//     extraBolt      – lightning also strikes a second enemy
//     spellBurn      – spells ignite (value = burn damage per tick)
//     spellFrost     – spells chill for value seconds
//     firePool       – impacts leave burning ground
//     splitOrbs      – impacts burst into N seeker orbs
//     singularity    – blasts drag enemies toward the impact point
//     freeCast       – chance a cast has no cooldown
//     meteorIce/meteorDouble – meteor tome specials
//
// Each upgrade may carry vfxCol: a color woven into the held weapon's glow and
// its ambient particles, so upgrades visibly change the weapon.

export const UPGRADE_TIERS = {
  rare:      { name: "Rare",      col: "#6ab4ff", weight: 62 },
  epic:      { name: "Epic",      col: "#bb55ff", weight: 28 },
  legendary: { name: "Legendary", col: "#f2c14e", weight: 10 },
};
export const TIER_RANK = { rare: 1, epic: 2, legendary: 3 };

// ---------- Shared pools (rare workhorse picks + a few type-wide epics) ----------
export const WEAPON_UPGRADES = {
  generic: [
    { id:"sharpened", tier:"rare", name:"Sharpened",      desc:"More damage",           effect:{ dmg:2 } },
    { id:"extended",  tier:"rare", name:"Extended",       desc:"Longer range",          effect:{ range:25 } },
    { id:"quickened", tier:"rare", name:"Lightning Fast", desc:"Faster attacks",        effect:{ speedBonus:0.15 } },
    { id:"keen_eye",  tier:"rare", name:"Keen Eye",       desc:"+10% critical chance",  effect:{ critBonus:0.10 } },
  ],
  melee: [
    { id:"heavy_blow",  tier:"rare", name:"Crushing Blow", desc:"+4 damage",               effect:{ dmg:4 } },
    { id:"whirlwind",   tier:"rare", name:"Whirlwind",     desc:"+20 px range",            effect:{ range:20 } },
    { id:"swift_melee", tier:"rare", name:"Light Hand",    desc:"+25% faster attacks",     effect:{ speedBonus:0.22 } },
    { id:"brute_force", tier:"rare", name:"Brute Force",   desc:"Hits knock enemies back much further", effect:{ knockBonus:140 } },
    { id:"rending",     tier:"epic", name:"Rending Strikes", desc:"Every hit splashes 30% damage to enemies around the target", effect:{ splashFrac:0.3, splashR:85 }, vfxCol:"#ff8a5a" },
    { id:"bloodthirst", tier:"epic", name:"Bloodthirst",   desc:"Kills have a 35% chance to restore 1 ❤", effect:{ healOnKill:0.35 }, vfxCol:"#d03a3a" },
  ],
  ranged: [
    { id:"piercing",   tier:"rare", name:"Piercing",   desc:"+3 damage per arrow",   effect:{ dmg:3 } },
    { id:"rapid_fire", tier:"rare", name:"Rapid Fire", desc:"+30% faster shooting",  effect:{ speedBonus:0.28 } },
    { id:"longshot",   tier:"rare", name:"Longshot",   desc:"+80 px range",          effect:{ range:80 } },
    { id:"skewer",     tier:"epic", name:"Skewer",     desc:"Arrows punch through one extra enemy", effect:{ pierce:1 }, vfxCol:"#e8e0c8" },
    { id:"split_nock", tier:"epic", name:"Split Nock", desc:"35% chance to loose a second arrow at another enemy", effect:{ multishot:0.35 }, vfxCol:"#ffe9a0" },
  ],
  magic: [
    { id:"amplified",  tier:"rare", name:"Amplified Magic",    desc:"+3 spell damage",      effect:{ dmg:3 } },
    { id:"quickcast",  tier:"rare", name:"Quickcast",          desc:"+30% faster casting",  effect:{ speedBonus:0.25 } },
    { id:"wide_range", tier:"rare", name:"Wide Range",         desc:"+70 px range",         effect:{ range:70 } },
    { id:"critical",   tier:"rare", name:"Critical Discharge", desc:"+5 spell damage",      effect:{ dmg:5 } },
    { id:"unstable",   tier:"epic", name:"Unstable Core",      desc:"+45 px blast radius",  effect:{ aoeBonus:45 }, vfxCol:"#ff88ff" },
    { id:"attunement", tier:"epic", name:"Attunement",         desc:"25% chance a cast has no cooldown", effect:{ freeCast:0.25 }, vfxCol:"#ffffff" },
  ],
};

// ---------- Unique upgrades, one epic + one legendary per weapon ----------
export const UNIQUE_UPGRADES = {
  // --- Melee ---
  rusty_sword: [
    { id:"tetanus_bite",  tier:"epic",      name:"Tetanus Bite",     desc:"The rust festers: hits infect enemies, burning them over time", effect:{ burnHit:1, dmg:1 }, vfxCol:"#a8703a" },
    { id:"beggars_fortune",tier:"legendary",name:"Beggar's Fortune", desc:"Fate smiles on the humble blade: kills often shake loose extra gold", effect:{ goldOnKill:0.5, dmg:2 }, vfxCol:"#f2c14e" },
  ],
  dagger: [
    { id:"cutthroat",     tier:"epic",      name:"Cutthroat",        desc:"Strike where it hurts: +20% critical chance", effect:{ critBonus:0.20 }, vfxCol:"#d8d8e0" },
    { id:"shadow_dance",  tier:"legendary", name:"Shadow Dance",     desc:"You blur between cuts: 50% chance every strike lands twice", effect:{ doubleStrike:0.5, speedBonus:0.1 }, vfxCol:"#aa44cc" },
  ],
  sword: [
    { id:"perfect_balance",tier:"epic",     name:"Perfect Balance",  desc:"A masterwork edge: faster swings and harder hits", effect:{ speedBonus:0.15, dmg:2 }, vfxCol:"#c8c8d0" },
    { id:"knights_oath",  tier:"legendary", name:"Knight's Oath",    desc:"35% chance a swing releases a spectral slash that cuts through the enemy line", effect:{ beamChance:0.35, beamFrac:0.8 }, vfxCol:"#9ecbff" },
  ],
  longsword: [
    { id:"wide_arc",      tier:"epic",      name:"Wide Arc",         desc:"Sweeping swings: the cleave triggers on every hit, not just kills", effect:{ alwaysCleave:true }, vfxCol:"#d0d0e0" },
    { id:"colossus_cleave",tier:"legendary",name:"Colossus Cleave",  desc:"Every blow crashes outward, splashing half its damage and hurling enemies back", effect:{ splashFrac:0.5, splashR:110, knockBonus:120 }, vfxCol:"#ffd8a0" },
  ],
  war_axe: [
    { id:"berserkers_call",tier:"epic",     name:"Berserker's Call", desc:"Pain feeds fury: deal up to +60% damage the lower your health", effect:{ berserk:0.6 }, vfxCol:"#c04030" },
    { id:"skull_splitter", tier:"legendary",name:"Skull Splitter",   desc:"No lingering deaths: instantly finishes enemies below 25% health", effect:{ execute:0.25 }, vfxCol:"#ff4040" },
  ],
  war_hammer: [
    { id:"tremor",        tier:"epic",      name:"Tremor",           desc:"The slam pins enemies to the shaking ground", effect:{ rootHit:0.5, knockBonus:100 }, vfxCol:"#9a9aa8" },
    { id:"earthshatter",  tier:"legendary", name:"Earthshatter",     desc:"Every impact detonates the ground, splashing 70% damage in a wide crater", effect:{ splashFrac:0.7, splashR:140 }, vfxCol:"#c89050" },
  ],
  spear: [
    { id:"lunge_master",  tier:"epic",      name:"Lunge Master",     desc:"Longer, meaner thrusts: +30 range and +10% crit", effect:{ range:30, critBonus:0.10 }, vfxCol:"#e8dcb0" },
    { id:"impaler",       tier:"legendary", name:"Impaler",          desc:"Thrusts skewer enemies to the spot and bite deeper", effect:{ rootHit:0.65, dmg:3 }, vfxCol:"#b8a870" },
  ],
  flame_sword: [
    { id:"inferno_edge",  tier:"epic",      name:"Inferno Edge",     desc:"The flames rage hotter: burns tick for double damage", effect:{ burnHit:2 }, vfxCol:"#ff9a40" },
    { id:"phoenix_heart", tier:"legendary", name:"Phoenix Heart",    desc:"Kills erupt in fire, and the blaze sometimes mends your wounds", effect:{ novaR:120, novaFrac:0.8, novaCol:"#ff7730", healOnKill:0.35 }, vfxCol:"#ffcc40" },
  ],
  ice_axe: [
    { id:"deep_freeze",   tier:"epic",      name:"Deep Freeze",      desc:"The chill sinks to the bone: longer chills, 25% chance to freeze solid", effect:{ frostHit:3, rootHit:0.25 }, vfxCol:"#bfefff" },
    { id:"glaciers_wrath",tier:"legendary", name:"Glacier's Wrath",  desc:"Chilled and frozen enemies shatter: +4 damage against them", effect:{ shatter:4 }, vfxCol:"#6abaff" },
  ],
  gilded_spear: [
    { id:"midas_touch",   tier:"epic",      name:"Midas Touch",      desc:"What it kills turns to gold: 65% chance of bonus coins", effect:{ goldOnKill:0.65 }, vfxCol:"#ffe080" },
    { id:"solar_lance",   tier:"legendary", name:"Solar Lance",      desc:"45% chance a thrust hurls a golden beam through everything in its path", effect:{ beamChance:0.45, beamFrac:1.0 }, vfxCol:"#f2c14e" },
  ],
  shadow_axe: [
    { id:"umbral_feast",  tier:"epic",      name:"Umbral Feast",     desc:"The axe drinks: 45% chance kills restore 1 ❤", effect:{ healOnKill:0.45 }, vfxCol:"#aa44cc" },
    { id:"reapers_toll",  tier:"legendary", name:"Reaper's Toll",    desc:"Death claims the weak: instantly finishes enemies below 20% health", effect:{ execute:0.20 }, vfxCol:"#440066" },
  ],
  thunder_blade: [
    { id:"storm_conductor",tier:"epic",     name:"Storm Conductor",  desc:"The static discharge arcs two extra times between enemies", effect:{ chainBonus:2 }, vfxCol:"#eeccff" },
    { id:"thunderlords_verdict",tier:"legendary",name:"Thunderlord's Verdict", desc:"40% chance a strike calls a bolt from the sky down on your target", effect:{ skyBolt:0.4 }, vfxCol:"#ffffff" },
  ],
  kings_sword: [
    { id:"royal_decree",  tier:"epic",      name:"Royal Decree",     desc:"Authority radiates from every swing, splashing damage and scattering foes", effect:{ splashFrac:0.4, splashR:100, knockBonus:80 }, vfxCol:"#f2c14e" },
    { id:"crownfire",     tier:"legendary", name:"Crownfire",        desc:"Half your swings loose a golden wave, and fallen enemies pay tribute", effect:{ beamChance:0.5, beamFrac:1.0, goldOnKill:0.35 }, vfxCol:"#ffdd44" },
  ],
  sunblade: [
    { id:"solar_flare",   tier:"epic",      name:"Solar Flare",      desc:"Daylight sears: hits set enemies ablaze with solar fire", effect:{ burnHit:2 }, vfxCol:"#ffee80" },
    { id:"supernova",     tier:"legendary", name:"Supernova",        desc:"Kills detonate in a blinding radiant explosion", effect:{ novaR:150, novaFrac:1.0, novaCol:"#ffdd44" }, vfxCol:"#fff8c0" },
  ],
  // --- Ranged ---
  short_bow: [
    { id:"hunters_instinct",tier:"epic",    name:"Hunter's Instinct", desc:"Read the wind: +15% crit and +40 range", effect:{ critBonus:0.15, range:40 }, vfxCol:"#c9b48a" },
    { id:"twin_strings",  tier:"legendary", name:"Twin Strings",     desc:"60% chance every draw looses a second arrow at another enemy", effect:{ multishot:0.6 }, vfxCol:"#bfefff" },
  ],
  long_bow: [
    { id:"eagle_eye",     tier:"epic",      name:"Eagle Eye",        desc:"See the artery: +18% crit and +60 range", effect:{ critBonus:0.18, range:60 }, vfxCol:"#e8e0c8" },
    { id:"windpiercer",   tier:"legendary", name:"Windpiercer",      desc:"Arrows scream through the line, punching through two extra enemies", effect:{ pierce:2 }, vfxCol:"#ffffff" },
  ],
  crossbow: [
    { id:"heavy_bolts",   tier:"epic",      name:"Heavy Bolts",      desc:"Forged iron bolts: +2 damage and they punch through one enemy", effect:{ dmg:2, pierce:1 }, vfxCol:"#c8ccd4" },
    { id:"repeater",      tier:"legendary", name:"Repeater Mechanism", desc:"40% chance the next bolt is loaded instantly", effect:{ instantReload:0.4 }, vfxCol:"#ffb060" },
  ],
  void_bow: [
    { id:"event_horizon", tier:"epic",      name:"Event Horizon",    desc:"Half your arrows tear a rift that drags nearby enemies in", effect:{ gravityArrow:0.5 }, vfxCol:"#9933ff" },
    { id:"null_point",    tier:"legendary", name:"Null Point",       desc:"Arrows detonate into collapsing void, blasting everything nearby", effect:{ explosiveR:110, explosiveFrac:0.8 }, vfxCol:"#ddaaff" },
  ],
  dark_bow: [
    { id:"twin_shadows",  tier:"epic",      name:"Twin Shadows",     desc:"A shade nocks beside you: 50% chance of a second arrow at another enemy", effect:{ multishot:0.5 }, vfxCol:"#880099" },
    { id:"soul_reaper",   tier:"legendary", name:"Soul Reaper",      desc:"The bow harvests what it slays: 30% chance kills restore 1 ❤", effect:{ healOnKill:0.3, dmg:2 }, vfxCol:"#aa44cc" },
  ],
  dragons_bow: [
    { id:"dragonfire_arrows",tier:"epic",   name:"Dragonfire Arrows", desc:"Every arrow carries dragonflame and sets enemies ablaze", effect:{ fireArrows:true }, vfxCol:"#ff6820" },
    { id:"dragons_roar",  tier:"legendary", name:"Dragon's Roar",    desc:"Arrows explode on impact like a gout of dragon breath", effect:{ explosiveR:120, explosiveFrac:1.0 }, vfxCol:"#ffcc40" },
  ],
  // --- Magic ---
  fire_tome: [
    { id:"combustion",    tier:"epic",      name:"Combustion",       desc:"Struck enemies keep burning long after the blast", effect:{ spellBurn:2 }, vfxCol:"#ff6a2a" },
    { id:"pyroclasm",     tier:"legendary", name:"Pyroclasm",        desc:"Fireballs leave the ground itself burning where they land", effect:{ firePool:true }, vfxCol:"#ffcc60" },
  ],
  hydro_tome: [
    { id:"riptide",       tier:"epic",      name:"Riptide",          desc:"The surge spreads wider and drenches enemies, slowing them", effect:{ aoeBonus:40, spellFrost:1.5 }, vfxCol:"#4ab8e8" },
    { id:"maelstrom",     tier:"legendary", name:"Maelstrom",        desc:"Impacts whirl into a vortex that drags enemies toward the center", effect:{ singularity:true, aoeBonus:25 }, vfxCol:"#a0e8ff" },
  ],
  lightning_tome: [
    { id:"overcharge",    tier:"epic",      name:"Overcharge",       desc:"The lightning arcs two extra times between enemies", effect:{ chainBonus:2 }, vfxCol:"#f0e060" },
    { id:"tempest",       tier:"legendary", name:"Tempest",          desc:"The sky answers twice: every cast also strikes a second enemy", effect:{ extraBolt:true }, vfxCol:"#ffffff" },
  ],
  meteor_tome: [
    { id:"ice_meteor",    tier:"epic",      name:"Ice Meteor",       desc:"The meteor becomes an icy comet that freezes enemies in the explosion", effect:{ meteorIce:true }, vfxCol:"#bfefff" },
    { id:"double_up",     tier:"epic",      name:"Double Up",        desc:"Casts less often, but calls down two meteors", effect:{ meteorDouble:true }, vfxCol:"#ff8840" },
    { id:"extinction_event",tier:"legendary",name:"Extinction Event", desc:"A vast crater: +50 px blast radius and the impact leaves burning ground", effect:{ aoeBonus:50, firePool:true }, vfxCol:"#ffd060" },
  ],
  arcane_tome: [
    { id:"echo_cast",     tier:"epic",      name:"Echo Cast",        desc:"The weave repeats itself: 30% chance a cast has no cooldown", effect:{ freeCast:0.3 }, vfxCol:"#cc44ff" },
    { id:"arcane_fission",tier:"legendary", name:"Arcane Fission",   desc:"Impacts split into three arcane orbs that streak into nearby enemies", effect:{ splitOrbs:3 }, vfxCol:"#ff88ff" },
  ],
  shadow_tome: [
    { id:"creeping_dark", tier:"epic",      name:"Creeping Dark",    desc:"Shadows cling to the struck, slowing everything in the blast", effect:{ spellFrost:2.5 }, vfxCol:"#660099" },
    { id:"ravenous_void", tier:"legendary", name:"Ravenous Void",    desc:"The darkness hungers, dragging enemies into the blast", effect:{ singularity:true, aoeBonus:25 }, vfxCol:"#aa44cc" },
  ],
  void_tome: [
    { id:"singularity",   tier:"epic",      name:"Singularity",      desc:"Every impact collapses inward, wrenching enemies to the center", effect:{ singularity:true }, vfxCol:"#9922ff" },
    { id:"oblivion",      tier:"legendary", name:"Oblivion",         desc:"Reality splinters: impacts burst into void orbs and casts sometimes cost nothing", effect:{ splitOrbs:2, freeCast:0.25 }, vfxCol:"#ddaaff" },
  ],
};

// Dedicated "Aura & Control" branch for the Short Bow — offered one at a time, in order.
export const SHORT_BOW_BRANCH = [
  { id:"frost_bow",      tier:"rare",      name:"Frost Bow",      desc:"Each arrow significantly slows enemy movement speed.", effect:{ frostArrow:true }, vfxCol:"#bfefff" },
  { id:"binding_arrows", tier:"epic",      name:"Binding Arrows", desc:"Hit enemies are pinned to the ground for 3 seconds.", effect:{ rootArrow:true }, requires:"frost_bow", vfxCol:"#8fd8ff" },
  { id:"ice_explosion",  tier:"legendary", name:"Ice Explosion",  desc:"Ultimate: Creates a massive ice explosion that freezes all nearby enemies for 5 seconds.", effect:{ iceUltimate:true }, requires:"binding_arrows", ultimate:true, vfxCol:"#ffffff" },
];

// Merge all applied upgrades into one flags object. Numbers sum, booleans OR,
// strings/objects take the last value. Also tracks the strongest tier and the
// vfx colors, used by the weapon renderer and ambient particles.
export function mergeUpgradeEffects(upgrades) {
  const fx = { _tierRank: 0, _vfxCols: [] };
  if (!upgrades || !upgrades.length) return fx;
  for (const u of upgrades) {
    const e = u.effect || {};
    for (const k in e) {
      const v = e[k];
      if (typeof v === "number") fx[k] = (fx[k] || 0) + v;
      else if (v === true) fx[k] = true;
      else fx[k] = v;
    }
    const rank = TIER_RANK[u.tier] || 1;
    if (rank > fx._tierRank) { fx._tierRank = rank; fx._tierCol = (UPGRADE_TIERS[u.tier] || UPGRADE_TIERS.rare).col; }
    if (u.vfxCol) fx._vfxCols.push(u.vfxCol);
  }
  return fx;
}

// Per-frame callers (renderer, ambient FX) reuse the merge until the upgrade
// list changes length.
const fxCache = new WeakMap();
export function cachedUpgradeEffects(upgrades) {
  if (!upgrades || !upgrades.length) return mergeUpgradeEffects(null);
  const hit = fxCache.get(upgrades);
  if (hit && hit.n === upgrades.length) return hit.fx;
  const fx = mergeUpgradeEffects(upgrades);
  fxCache.set(upgrades, { n: upgrades.length, fx });
  return fx;
}
