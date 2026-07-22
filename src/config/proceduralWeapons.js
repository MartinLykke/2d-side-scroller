// Pure data for procedurally generated weapons: name banks, affix pools,
// stat ranges and unique-upgrade themes. The generator itself (randomness,
// runtime registration into WEAPONS/UNIQUE_UPGRADES) lives in
// src/systems/economy/ProceduralWeaponSystem.js.
//
// Affix/theme effect keys reuse the exact vocabulary documented at the top
// of weaponUpgrades.js, so generated weapons plug into the same combat code
// as hand-authored ones with no special-casing required.

export const WEAPON_CATEGORIES = ["melee", "ranged", "magic"];

// Common -> Legendary, index matches WEAPONS rarity / RARITY_NAME / RARITY_COL.
export const RARITY_WEIGHTS = [42, 28, 17, 9, 4];

export const AFFIX_COUNT_BY_RARITY = [0, 1, 1, 2, 3];

export const PREFIXES = [
  ["Crude", "Worn", "Plain", "Chipped", "Rusted", "Simple", "Battered", "Dull"],
  ["Honed", "Iron", "Steel", "Sturdy", "Tempered", "Polished", "Balanced", "Reinforced"],
  ["Runed", "Frosted", "Gleaming", "Warded", "Ember-Kissed", "Silvered", "Etched", "Moonlit"],
  ["Voidtouched", "Stormwrought", "Ashbound", "Bloodforged", "Starlit", "Hexbound", "Wraithborn", "Cinderveil"],
  ["Godsforged", "Worldsplitting", "Eternal", "Doomcaller's", "Sundering", "Astral", "Apocalyptic", "Realmforged"],
];

export const PLAIN_SUFFIXES = ["of the Vanguard", "of the Watch", "of the Wilds", "of the Old Guard", "of the Wanderer", "of the Deep Roads", "of the Last Stand", "of Embercrest"];

// Rare flourish appended to legendary rolls (rarity 4) instead of a plain suffix.
export const EPITHETS = [
  "the Doomcaller", "the Worldbreaker", "the Last Ember", "the Hollow King",
  "the Unmaking", "the Skyrender", "the Deathless", "the Forsworn",
];

export const NOUNS = {
  melee: [
    { label: "Sword", slug: "sword" }, { label: "Axe", slug: "axe" },
    { label: "Hammer", slug: "hammer" }, { label: "Spear", slug: "spear" },
    { label: "Scythe", slug: "scythe" }, { label: "Whip", slug: "whip" },
    { label: "Dagger", slug: "dagger" }, { label: "Cleaver", slug: "cleaver" },
    { label: "Saber", slug: "saber" }, { label: "Mace", slug: "mace" },
    { label: "Flail", slug: "flail" }, { label: "Rapier", slug: "rapier" },
    { label: "Claymore", slug: "claymore" }, { label: "Glaive", slug: "glaive" },
    { label: "Trident", slug: "trident" },
  ],
  ranged: [
    { label: "Bow", slug: "bow" }, { label: "Longbow", slug: "longbow" },
    { label: "Warbow", slug: "warbow" }, { label: "Huntbow", slug: "huntbow" },
    { label: "Shortbow", slug: "shortbow" }, { label: "Recurve Bow", slug: "recurvebow" },
    { label: "Crossbow", slug: "crossbow" }, { label: "Sling", slug: "sling" },
    { label: "Blowgun", slug: "blowgun" }, { label: "Hand Cannon", slug: "handcannon" },
  ],
  magic: [
    { label: "Wand", slug: "wand" }, { label: "Staff", slug: "staff" },
    { label: "Rod", slug: "rod" }, { label: "Scepter", slug: "scepter" },
    { label: "Tome", slug: "tome" }, { label: "Grimoire", slug: "grimoire" },
    { label: "Orb", slug: "orb" },
  ],
};

// Flat per-category stat envelopes; only damage scales with rarity, speed
// and range vary by archetype (mirrors how the curated roster works — a
// dagger and a war hammer sit at opposite ends of the same rarity tier).
export const STAT_RANGES = {
  melee: { dmgByRarity: [[2, 3], [3, 5], [5, 7], [7, 9], [9, 12]], speed: [0.85, 1.9], range: [45, 105] },
  ranged: { dmgByRarity: [[2, 3], [3, 4], [4, 6], [6, 8], [8, 11]], speed: [1.0, 2.0], range: [260, 480] },
  magic: { dmgByRarity: [[2, 3], [2, 4], [3, 5], [4, 7], [6, 9]], speed: [0.6, 2.2], range: [270, 440] },
};

// ---------- Procedural spell "recipe" system (generated staffs only) ----------
// Five independent axes are rolled per generated magic weapon and combined at
// cast time in SpellSystem.js: a themed Element (palette + flavor), a
// projectile Form (shape/hit-pattern), a Travel behavior (per-frame motion),
// an Impact effect (what happens on hit/expiry), and a Flourish (particle +
// audio texture). None of this touches curated weapons — they keep their
// hand-tuned spellType switch in SpellSystem.js untouched; generated weapons
// are routed to the recipe system entirely via `spellRecipe` on their def.

// `cols` = [primary, secondary, tertiary] particle colors; `core` = bright
// flash/highlight color; `wandKind` reuses one of the hand-authored wand head
// shapes (DrawHelpers.js) that best fits the flavor; `pitch` seeds the cast
// sound's timbre (Hz).
export const SPELL_ELEMENTS = [
  // Legacy-compatible elements (share color language with the curated schools)
  { key: "fireball",  name: "Fire",    cols: ["#ff6a20", "#ffcc60", "#3a2418"], core: "#ffe8b0", wandKind: "cinder", pitch: 260 },
  { key: "waterjet",  name: "Tide",    cols: ["#2f9ed8", "#65d8ff", "#c8f7ff"], core: "#e8fbff", wandKind: "tide",   pitch: 520 },
  { key: "lightning", name: "Storm",   cols: ["#f0e060", "#ffffff", "#ccccff"], core: "#ffffff", wandKind: "storm",  pitch: 900 },
  { key: "meteor",    name: "Meteor",  cols: ["#ff8840", "#554432", "#ffcc60"], core: "#ffd060", wandKind: "meteor", pitch: 200 },
  { key: "arcane",    name: "Arcane",  cols: ["#cc44ff", "#ff88ff", "#f0e4ff"], core: "#f0e4ff", wandKind: "arcane", pitch: 620 },
  { key: "shadow",    name: "Shadow",  cols: ["#aa44cc", "#440066", "#110018"], core: "#e8d0ff", wandKind: "shadow", pitch: 220 },
  { key: "void",      name: "Void",    cols: ["#9922ff", "#ddaaff", "#550088"], core: "#e0a0ff", wandKind: "void",   pitch: 160 },
  // Brand new elements — flavors that don't exist anywhere else in the game
  { key: "crystal",   name: "Crystal", cols: ["#8fe8ff", "#e0fbff", "#3a7a90"], core: "#ffffff", wandKind: "arcane", pitch: 1100 },
  { key: "blood",     name: "Blood",   cols: ["#c0102a", "#7a0a1a", "#ff5060"], core: "#ff8a90", wandKind: "shadow", pitch: 190 },
  { key: "sonic",     name: "Sonic",   cols: ["#e8f8ff", "#a8d8ff", "#ffffff"], core: "#ffffff", wandKind: "storm",  pitch: 780 },
  { key: "plague",    name: "Plague",  cols: ["#7fbf3a", "#3a5a1a", "#c8e070"], core: "#d8ff9a", wandKind: "cinder", pitch: 240 },
  { key: "radiant",   name: "Radiant", cols: ["#ffe9a0", "#fff8d8", "#f2c14e"], core: "#ffffff", wandKind: "meteor", pitch: 980 },
  { key: "gravity",   name: "Gravity", cols: ["#3a1a5a", "#7a3aff", "#0a0612"], core: "#c8a0ff", wandKind: "void",   pitch: 140 },
];

export const SPELL_FORMS = [
  { key: "bolt",  name: "Bolt",           desc: "A single bolt streaks toward the target" },
  { key: "beam",  name: "Piercing Beam",  desc: "An instant beam pierces everything in its path" },
  { key: "orb",   name: "Bouncing Orb",   desc: "A slow orb bounces between nearby enemies" },
  { key: "ring",  name: "Expanding Ring", desc: "Detonates into a ring that grows outward from the impact" },
  { key: "darts", name: "Orbiting Darts", desc: "A cluster of darts spirals in toward the target" },
];

export const TRAVEL_BEHAVIORS = [
  { key: "steady",    name: "Steady",       desc: "Flies true" },
  { key: "accel",     name: "Accelerating", desc: "Gathers speed the longer it flies" },
  { key: "sine",      name: "Weaving",      desc: "Weaves in a sine-wave pattern" },
  { key: "boomerang", name: "Boomerang",    desc: "Arcs back toward the caster partway through its flight" },
  { key: "blink",     name: "Blinking",     desc: "Teleports forward in short hops" },
];

export const IMPACT_EFFECTS = [
  { key: "shrapnel",  name: "Shrapnel Burst", desc: "Shatters into shrapnel that sprays outward" },
  { key: "gravity",   name: "Gravity Well",   desc: "Opens a small well that pulls enemies in" },
  { key: "puddle",    name: "Toxic Puddle",   desc: "Leaves a corrosive puddle on the ground" },
  { key: "chain",     name: "Chain Jump",     desc: "Leaps to a second nearby enemy" },
  { key: "shockwave", name: "Shockwave",      desc: "Slams out a knockback shockwave" },
];

export const VISUAL_FLOURISHES = [
  { key: "haze",      name: "Heat Haze", desc: "Trails a shimmering heat haze" },
  { key: "hum",       name: "Humming",   desc: "Emits a rising, high-pitched hum" },
  { key: "heartbeat", name: "Heartbeat", desc: "Pulses with a slow heartbeat rhythm" },
  { key: "sparks",    name: "Sparking",  desc: "Sheds crackling sparks" },
  { key: "motes",     name: "Motewoven", desc: "Trailed by orbiting motes of light" },
];

// Innate affixes rolled onto a generated weapon on drop. `value(rarity)`
// returns a partial innate-effect object merged the same way biome-drop
// weapons' `innate` blocks are merged in PlayerCombat/SpellSystem.
export const AFFIX_POOL = {
  melee: [
    { key: "burn", suffix: "of Embers", col: "#ff9a40", value: r => ({ burnHit: 1 + r * 0.7 }) },
    { key: "frost", suffix: "of the Deep Freeze", col: "#bfefff", value: r => ({ frostHit: 1.5 + r * 0.6, ...(r >= 3 ? { rootHit: 0.15 } : {}) }) },
    { key: "splash", suffix: "of Ruin", col: "#ff8a5a", value: r => ({ splashFrac: 0.18 + r * 0.07, splashR: 60 + r * 15 }) },
    { key: "knockback", suffix: "of the Tempest", col: "#9a9aa8", value: r => ({ knockBonus: 60 + r * 35 }) },
    { key: "crit", suffix: "of Precision", col: "#ffe9a0", value: r => ({ critBonus: 0.06 + r * 0.03 }) },
    { key: "healOnKill", suffix: "of Vitality", col: "#d03a3a", value: r => ({ healOnKill: 0.15 + r * 0.08 }) },
    { key: "goldOnKill", suffix: "of Fortune", col: "#f2c14e", value: r => ({ goldOnKill: 0.2 + r * 0.1 }) },
    { key: "rootHit", suffix: "of Binding", col: "#8fd8ff", value: r => ({ rootHit: 0.15 + r * 0.08 }) },
    { key: "berserk", suffix: "of Fury", col: "#c04030", value: r => ({ berserk: 0.15 + r * 0.1 }) },
    { key: "comboDmg", suffix: "of the Relentless", col: "#ffffff", value: r => ({ comboDmg: 0.5 + r * 0.4 }) },
    { key: "poisonHit", suffix: "of Venom", col: "#7fe05a", value: r => ({ poisonHit: 2 + r * 0.8, poisonDmg: 1 }) },
    { key: "slowHit", suffix: "of the Mire", col: "#6d8a42", value: r => ({ slowHit: 0.35 + r * 0.1 }) },
    { key: "execute", suffix: "of Mercy", col: "#ff4040", value: r => ({ execute: 0.08 + r * 0.03 }) },
    { key: "doubleStrike", suffix: "of Mirrors", col: "#d8d8e0", value: r => ({ doubleStrike: 0.12 + r * 0.05 }) },
    { key: "barrierOnKill", suffix: "of Wardings", col: "#9ecbff", value: r => ({ barrierOnKill: 0.3 + r * 0.15 }) },
    { key: "lifeLink", suffix: "of the Leech", col: "#ff6a8a", value: r => ({ lifeLink: 0.1 + r * 0.04 }) },
    { key: "frenzyOnHit", suffix: "of Bloodrush", col: "#ff5030", value: r => ({ frenzyOnHit: 0.03 + r * 0.014 }) },
  ],
  ranged: [
    { key: "pierce", suffix: "of Piercing", col: "#e8e0c8", value: r => ({ pierce: r >= 4 ? 2 : 1 }) },
    { key: "multishot", suffix: "of the Volley", col: "#ffe9a0", value: r => ({ multishot: 0.15 + r * 0.08 }) },
    { key: "fireArrows", suffix: "of Cinderflight", col: "#ff6a2a", value: () => ({ fireArrows: true }) },
    { key: "explosive", suffix: "of Detonation", col: "#ffb060", value: r => ({ explosiveR: 60 + r * 15, explosiveFrac: 0.25 + r * 0.1 }) },
    { key: "gravityArrow", suffix: "of the Undertow", col: "#9933ff", value: r => ({ gravityArrow: 0.2 + r * 0.08 }) },
    { key: "instantReload", suffix: "of Haste", col: "#ffffff", value: r => ({ instantReload: 0.15 + r * 0.08 }) },
    { key: "bounceArrow", suffix: "of Ricochet", col: "#d8f0ff", value: () => ({ bounceArrow: true }) },
    { key: "powerArrow", suffix: "of Momentum", col: "#ffe0a0", value: r => ({ powerArrow: 0.12 + r * 0.06 }) },
    { key: "critBonus", suffix: "of Precision", col: "#c9b48a", value: r => ({ critBonus: 0.06 + r * 0.03 }) },
    { key: "rootHit", suffix: "of Binding", col: "#9bd05a", value: r => ({ rootHit: 0.15 + r * 0.06 }) },
    { key: "slowHit", suffix: "of Snaring", col: "#8a9a5a", value: r => ({ slowHit: 0.3 + r * 0.1 }) },
    { key: "poisonArrow", suffix: "of Venomtip", col: "#7fe05a", value: r => ({ poisonArrow: 2.5 + r * 0.9, poisonDmg: 1 }) },
    { key: "healOnKill", suffix: "of Vitality", col: "#d03a3a", value: r => ({ healOnKill: 0.15 + r * 0.07 }) },
    { key: "goldOnKill", suffix: "of Fortune", col: "#f2c14e", value: r => ({ goldOnKill: 0.2 + r * 0.1 }) },
    { key: "barrierOnKill", suffix: "of Sanctuary", col: "#9ecbff", value: r => ({ barrierOnKill: 0.3 + r * 0.15 }) },
    { key: "echoShot", suffix: "of the Second Wind", col: "#ffffff", value: r => ({ echoShot: 0.16 + r * 0.06 }) },
    { key: "shatterCrit", suffix: "of Shattering", col: "#e0f0ff", value: r => ({ shatterCrit: r >= 3 ? 2 : 1 }) },
  ],
  magic: [
    { key: "spellBurn", suffix: "of Cinder", col: "#ff6a2a", spellType: "fireball", value: r => ({ spellBurn: 1 + r * 0.6 }) },
    { key: "spellFrost", suffix: "of Frost", col: "#4ab8e8", spellType: "waterjet", value: r => ({ spellFrost: 1 + r * 0.6 }) },
    { key: "aoeBonus", suffix: "of the Wide Weave", col: "#b080ff", value: r => ({ aoeBonus: 20 + r * 10 }) },
    { key: "chainBonus", suffix: "of Chains", col: "#f0e060", spellType: "lightning", value: r => ({ chainBonus: 1 + Math.floor(r / 2) }) },
    { key: "extraBolt", suffix: "of Twin Bolts", col: "#ffffff", spellType: "lightning", value: () => ({ extraBolt: true }) },
    { key: "firePool", suffix: "of the Scorched Earth", col: "#ff8840", spellType: "meteor", value: () => ({ firePool: true }) },
    { key: "splitOrbs", suffix: "of Fragments", col: "#cc44ff", spellType: "arcane", value: r => ({ splitOrbs: 1 + Math.floor(r / 2) }) },
    { key: "singularity", suffix: "of the Void", col: "#9922ff", spellType: "void", value: () => ({ singularity: true }) },
    { key: "freeCast", suffix: "of the Endless Font", col: "#ffffff", value: r => ({ freeCast: 0.12 + r * 0.06 }) },
    { key: "spellEcho", suffix: "of Echoes", col: "#8822cc", spellType: "shadow", value: r => ({ spellEcho: 0.15 + r * 0.07 }) },
    { key: "overcharge", suffix: "of Escalation", col: "#ffb060", value: r => ({ overcharge: 0.08 + r * 0.04 }) },
    { key: "soulSiphon", suffix: "of the Hungry Star", col: "#ff6a8a", value: r => ({ soulSiphon: 0.15 + r * 0.06 }) },
    { key: "shadowCurse", suffix: "of Withering", col: "#aa44cc", spellType: "shadow", value: r => ({ shadowCurse: 0.6 + r * 0.3 }) },
    { key: "runeTrap", suffix: "of Snares", col: "#ff88ff", value: r => ({ runeTrap: 0.5 + r * 0.3 }) },
    { key: "scorchChain", suffix: "of Wildfire", col: "#ffcc60", spellType: "fireball", value: r => ({ scorchChain: 0.3 + r * 0.15 }) },
    { key: "geyser", suffix: "of the Deluge", col: "#a0e8ff", spellType: "waterjet", value: r => ({ geyser: 0.35 + r * 0.2 }) },
  ],
};

// Unique-upgrade themes: two are picked per generated weapon, each
// contributing one epic + one legendary pick (matching the 2-epic +
// 2-legendary shape of hand-authored UNIQUE_UPGRADES entries).
export const THEME_BANK = {
  melee: [
    { key: "ruin", name: "Ruin", desc: "Every hit splashes ruin around the target", legendName: "Utter Ruin", legendDesc: "A wider, harder-hitting splash that hurls enemies back", col: "#ff8a5a", epic: { splashFrac: 0.3, splashR: 85, dmg: 1 }, legendary: { splashFrac: 0.55, splashR: 120, knockBonus: 110 } },
    { key: "embercall", name: "Embercall", desc: "Hits ignite the target", legendName: "Wildfire Call", legendDesc: "Deeper burns, and kills erupt in flame", col: "#ff9a40", epic: { burnHit: 2 }, legendary: { burnHit: 3.5, novaR: 100, novaFrac: 0.6, novaCol: "#ff7730" } },
    { key: "frostbite", name: "Frostbite", desc: "Hits chill and sometimes root the target", legendName: "Absolute Zero", legendDesc: "Longer chills, stronger roots, bonus damage to frozen foes", col: "#bfefff", epic: { frostHit: 2.5, rootHit: 0.2 }, legendary: { frostHit: 3.5, rootHit: 0.4, shatter: 3 } },
    { key: "bloodletting", name: "Bloodletting", desc: "Kills have a chance to heal you", legendName: "Crimson Pact", legendDesc: "Stronger lifesteal, and pain feeds your fury", col: "#d03a3a", epic: { healOnKill: 0.35 }, legendary: { healOnKill: 0.55, berserk: 0.3 } },
    { key: "fury", name: "Fury", desc: "Deal more damage the lower your health", legendName: "Undying Fury", legendDesc: "Greater berserker damage, and finishes the wounded outright", col: "#c04030", epic: { berserk: 0.4 }, legendary: { berserk: 0.65, execute: 0.2 } },
    { key: "fortune", name: "Fortune's Edge", desc: "Kills often shake loose bonus gold", legendName: "King's Ransom", legendDesc: "More gold on kill, and the blade cuts deeper", col: "#f2c14e", epic: { goldOnKill: 0.4 }, legendary: { goldOnKill: 0.65, dmg: 2 } },
    { key: "reaper", name: "Reaper's Toll", desc: "Instantly finishes weakened enemies", legendName: "Grim Harvest", legendDesc: "Finishes tougher foes and detonates them in dark fire", col: "#aa44cc", epic: { execute: 0.18 }, legendary: { execute: 0.28, novaR: 90, novaFrac: 0.55, novaCol: "#440066" } },
    { key: "stormcall", name: "Stormcall", desc: "Strikes have a chance to call down lightning", legendName: "Herald of the Storm", legendDesc: "Lightning strikes more often, and combo damage climbs", col: "#eeccff", epic: { skyBolt: 0.3 }, legendary: { skyBolt: 0.5, comboDmg: 1 } },
    { key: "duelist", name: "Duelist's Flourish", desc: "A chance every strike lands twice", legendName: "Blade Dance", legendDesc: "Strikes twice more often, and lands more critical hits", col: "#d8d8e0", epic: { doubleStrike: 0.25 }, legendary: { doubleStrike: 0.45, critBonus: 0.15 } },
    { key: "guardian", name: "Guardian's Ward", desc: "Kills grant a brief moment of invulnerability", legendName: "Bulwark's Grace", legendDesc: "Longer guard after kills, plus a chance to heal", col: "#9ecbff", epic: { barrierOnKill: 0.4 }, legendary: { barrierOnKill: 0.7, healOnKill: 0.3 } },
    { key: "vampiric", name: "Vampiric Thirst", desc: "Every hit siphons a sliver of your target's life", legendName: "Undying Thirst", legendDesc: "Siphons far more life, and desperation feeds your fury", col: "#ff6a8a", epic: { lifeLink: 0.16 }, legendary: { lifeLink: 0.26, berserk: 0.2 } },
    { key: "bloodrush", name: "Bloodrush", desc: "Consecutive hits quicken your blade", legendName: "Crimson Tempo", legendDesc: "Frenzy builds faster and lands harder while raging", col: "#ff5030", epic: { frenzyOnHit: 0.06 }, legendary: { frenzyOnHit: 0.09, dmg: 2 } },
    { key: "venomcraft", name: "Venomcraft", desc: "Hits inject a festering poison", legendName: "Plague Bringer", legendDesc: "A far deadlier toxin that rots armor and flesh alike", col: "#7fe05a", epic: { poisonHit: 3, poisonDmg: 1 }, legendary: { poisonHit: 4.5, poisonDmg: 2, shatter: 2 } },
    { key: "executioner", name: "Executioner's Reach", desc: "A chance to finish weakened enemies outright", legendName: "Headsman's Verdict", legendDesc: "Finishes tougher foes, and the blade can fall twice", col: "#ff4040", epic: { execute: 0.16 }, legendary: { execute: 0.24, doubleStrike: 0.25 } },
    { key: "quagmire", name: "Quagmire", desc: "Hits mire the ground, slowing everything nearby", legendName: "The Bog Eternal", legendDesc: "A wider mire, and mired foes take a shattering blow", col: "#6d8a42", epic: { slowHit: 0.4, splashFrac: 0.15, splashR: 70 }, legendary: { slowHit: 0.6, splashFrac: 0.25, splashR: 95, shatter: 3 } },
  ],
  ranged: [
    { key: "skewer", name: "Skewer", desc: "Arrows punch through an extra enemy", legendName: "Impaling Volley", legendDesc: "Arrows punch through two enemies and hit harder", col: "#e8e0c8", epic: { pierce: 1 }, legendary: { pierce: 2, dmg: 2 } },
    { key: "volley", name: "Split Volley", desc: "A chance to loose a second arrow", legendName: "Storm of Arrows", legendDesc: "More frequent second shots, and sharper crits", col: "#ffe9a0", epic: { multishot: 0.35 }, legendary: { multishot: 0.55, critBonus: 0.1 } },
    { key: "cinderflight", name: "Cinderflight", desc: "Every arrow carries fire", legendName: "Inferno Flight", legendDesc: "Burning arrows that also burst on impact", col: "#ff6a2a", epic: { fireArrows: true }, legendary: { fireArrows: true, explosiveR: 80, explosiveFrac: 0.4 } },
    { key: "detonation", name: "Detonation", desc: "Arrows burst on impact", legendName: "Cataclysm Shot", legendDesc: "A bigger blast that also drags enemies inward", col: "#ffb060", epic: { explosiveR: 90, explosiveFrac: 0.6 }, legendary: { explosiveR: 120, explosiveFrac: 0.85, gravityArrow: 0.3 } },
    { key: "undertow", name: "Undertow", desc: "Impacts drag nearby enemies inward", legendName: "Gravity Well", legendDesc: "Stronger pull, and arrows punch through the line", col: "#9933ff", epic: { gravityArrow: 0.4 }, legendary: { gravityArrow: 0.6, pierce: 1 } },
    { key: "haste", name: "Hunter's Haste", desc: "A chance the next shot is ready instantly", legendName: "Relentless Hunt", legendDesc: "Faster reloads more often, plus quicker draws overall", col: "#ffffff", epic: { instantReload: 0.35 }, legendary: { instantReload: 0.55, speedBonus: 0.15 } },
    { key: "ricochet", name: "Ricochet", desc: "Arrows bounce once into a nearby enemy", legendName: "Wild Ricochet", legendDesc: "Arrows bounce and are more likely to split into a second shot", col: "#d8f0ff", epic: { bounceArrow: true }, legendary: { bounceArrow: true, multishot: 0.3 } },
    { key: "momentum", name: "Momentum", desc: "A chance to loose a faster, harder power arrow", legendName: "Unstoppable Momentum", legendDesc: "Power arrows fire more often and punch through targets", col: "#ffe0a0", epic: { powerArrow: 0.3 }, legendary: { powerArrow: 0.5, pierce: 1 } },
    { key: "leechshot", name: "Leeching Broadhead", desc: "Kills often restore health and shake loose gold", legendName: "Vulture's Due", legendDesc: "Both procs fire more often, and shots punch deeper", col: "#d03a3a", epic: { healOnKill: 0.3, goldOnKill: 0.3 }, legendary: { healOnKill: 0.45, goldOnKill: 0.45, pierce: 1 } },
    { key: "echoflight", name: "Echoflight", desc: "A trailing echo arrow follows every shot", legendName: "Twinned Flight", legendDesc: "The echo fires more often and hits nearly as hard", col: "#ffffff", epic: { echoShot: 0.4 }, legendary: { echoShot: 0.6, multishot: 0.2 } },
    { key: "shatterhead", name: "Shatterhead", desc: "Critical hits burst into seeking shards", legendName: "Prismatic Shatter", legendDesc: "More shards fly, and every shot bites a little harder", col: "#e0f0ff", epic: { shatterCrit: 2 }, legendary: { shatterCrit: 3, critBonus: 0.12 } },
    { key: "snaringshot", name: "Snaring Shot", desc: "Arrows slow and sometimes root their target", legendName: "Hunter's Snare", legendDesc: "A near-certain root, and rooted foes take bonus damage", col: "#9bd05a", epic: { slowHit: 0.4, rootHit: 0.25 }, legendary: { slowHit: 0.6, rootHit: 0.45, dmg: 2 } },
  ],
  magic: [
    { key: "cinder", name: "Cinder Weave", desc: "Spells ignite what they strike", legendName: "Pyroclasm Weave", legendDesc: "Deeper burns that leave the ground itself aflame", col: "#ff6a2a", epic: { spellBurn: 2 }, legendary: { spellBurn: 3, firePool: true } },
    { key: "frostweave", name: "Frost Weave", desc: "Spells chill enemies caught in the blast", legendName: "Glacial Weave", legendDesc: "Longer chills, plus a freezing geyser on impact", col: "#4ab8e8", epic: { spellFrost: 2 }, legendary: { spellFrost: 3, geyser: 0.8 } },
    { key: "wideweave", name: "Wide Weave", desc: "A larger blast radius", legendName: "Cataclysmic Weave", legendDesc: "Much larger blasts that fragment into extra orbs", col: "#b080ff", epic: { aoeBonus: 35 }, legendary: { aoeBonus: 55, splitOrbs: 1 } },
    { key: "chainweave", name: "Chain Weave", desc: "Lightning arcs extra times between enemies", legendName: "Tempest Weave", legendDesc: "More arcs, and the bolt strikes a second target outright", col: "#f0e060", epic: { chainBonus: 2 }, legendary: { chainBonus: 3, extraBolt: true } },
    { key: "fragmentweave", name: "Fragment Weave", desc: "Impacts burst into seeker orbs", legendName: "Shattered Weave", legendDesc: "More orbs, and casts occasionally cost no cooldown", col: "#cc44ff", epic: { splitOrbs: 2 }, legendary: { splitOrbs: 3, freeCast: 0.2 } },
    { key: "voidweave", name: "Void Weave", desc: "Blasts drag enemies toward the impact", legendName: "Collapse Weave", legendDesc: "A stronger pull that leaves a scar on the battlefield", col: "#9922ff", epic: { singularity: true }, legendary: { singularity: true, voidScar: 1 } },
    { key: "fontweave", name: "Endless Font", desc: "A chance a cast has no cooldown", legendName: "Boundless Font", legendDesc: "Free casts more often, plus a weaker echo cast", col: "#ffffff", epic: { freeCast: 0.25 }, legendary: { freeCast: 0.4, spellEcho: 0.2 } },
    { key: "echoweave", name: "Echo Weave", desc: "A chance to release a smaller second cast", legendName: "Endless Echo", legendDesc: "Echoes more often and hit a wider area", col: "#8822cc", epic: { spellEcho: 0.3 }, legendary: { spellEcho: 0.5, aoeBonus: 25 } },
    { key: "overload", name: "Overload", desc: "Consecutive casts escalate in power", legendName: "Critical Mass", legendDesc: "Escalates faster and detonates violently at max charge", col: "#ffb060", epic: { overcharge: 0.16 }, legendary: { overcharge: 0.24, aoeBonus: 20 } },
    { key: "hungering", name: "Hungering Weave", desc: "Spell hits draw back a sliver of life", legendName: "Starved Star", legendDesc: "Draws far more life, and a siphon can refund the cast", col: "#ff6a8a", epic: { soulSiphon: 0.28 }, legendary: { soulSiphon: 0.45, freeCast: 0.15 } },
    { key: "witherweave", name: "Wither Weave", desc: "Blasts curse enemies, withering them over time", legendName: "Withering Dark", legendDesc: "A deeper curse that slows cursed foes to a crawl", col: "#aa44cc", epic: { shadowCurse: 1.2 }, legendary: { shadowCurse: 2, slowHit: 0.3 } },
    { key: "snareweave", name: "Snare Weave", desc: "Impacts leave a hidden, detonating rune", legendName: "Warded Ground", legendDesc: "A bigger, harder-hitting rune that arms almost instantly", col: "#ff88ff", epic: { runeTrap: 1 }, legendary: { runeTrap: 1.6, aoeBonus: 15 } },
    { key: "cinderchain", name: "Cinder Chain", desc: "Fire spreads from burning enemies to their neighbors", legendName: "Wildfire Chain", legendDesc: "Fire spreads further and burns hotter as it jumps", col: "#ffcc60", epic: { scorchChain: 0.3 }, legendary: { scorchChain: 0.5, spellBurn: 1.5 } },
    { key: "tidalgeyser", name: "Tidal Geyser", desc: "Impacts erupt into a rooting geyser", legendName: "Maelstrom Geyser", legendDesc: "A far larger eruption that roots and staggers the line", col: "#a0e8ff", epic: { geyser: 0.5 }, legendary: { geyser: 0.85, aoeBonus: 20 } },
  ],
};
