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
//     comboDmg       – consecutive hits with the same weapon add flat damage
//     barrierOnKill  – kills grant brief player invulnerability
//   Ranged (arrow spawn + ProjectileSystem):
//     pierce         – arrows punch through N extra enemies
//     multishot      – chance to loose a second arrow at another enemy
//     fireArrows     – arrows ignite what they hit
//     explosiveR/explosiveFrac – arrows burst on impact
//     gravityArrow   – chance the impact drags nearby enemies in
//     instantReload  – chance the next shot is ready instantly
//     bounceArrow    – arrows ricochet once into a nearby enemy
//     chainArrow     – arrows call chain lightning on impact
//     powerArrow     – chance to fire a faster, harder power arrow
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
//     spellEcho      – chance to release a smaller second projectile/cast
//     meteorIce/meteorDouble – meteor staff specials
//
// New staff-specific keys include scorchChain, geyser, stormCloud,
// meteorFragments, runeTrap, shadowCurse, and voidScar.
//
// Procedural-only keys (introduced by ProceduralWeaponSystem, consumed by the
// same shared combat code as everything else):
//     lifeLink       – melee: heals a fraction of damage dealt as HP per hit
//     frenzyOnHit    – melee: consecutive hits stack a decaying attack-speed buff
//     echoShot       – ranged: chance a free, weaker echo arrow trails the shot
//     shatterCrit    – ranged: critical hits fragment into shards that seek nearby enemies
//     overcharge     – magic: consecutive casts escalate damage/blast radius, decays if you stop
//     soulSiphon     – magic: chance a direct spell hit heals 1 HP
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

// ---------- Unique upgrades, multiple epic + legendary picks per weapon ----------
export const UNIQUE_UPGRADES = {
  // --- Melee ---
  rusty_sword: [
    { id:"tetanus_bite",  tier:"epic",      name:"Tetanus Bite",     desc:"The rust festers: hits infect enemies, burning them over time", effect:{ burnHit:1, dmg:1 }, vfxCol:"#a8703a" },
    { id:"beggars_fortune",tier:"legendary",name:"Beggar's Fortune", desc:"Fate smiles on the humble blade: kills often shake loose extra gold", effect:{ goldOnKill:0.5, dmg:2 }, vfxCol:"#f2c14e" },
    { id:"jagged_memory", tier:"epic",      name:"Jagged Memory",    desc:"Broken notches spray rust shards, splashing damage around every hit", effect:{ splashFrac:0.22, splashR:70, dmg:1 }, vfxCol:"#b07a3a" },
    { id:"scrap_king",    tier:"legendary", name:"Scrap King",       desc:"Kills crown you in scrap-light, granting brief guard and extra coin chances", effect:{ barrierOnKill:0.6, goldOnKill:0.35, dmg:1 }, vfxCol:"#ffe080" },
  ],
  dagger: [
    { id:"cutthroat",     tier:"epic",      name:"Cutthroat",        desc:"Strike where it hurts: +20% critical chance", effect:{ critBonus:0.20 }, vfxCol:"#d8d8e0" },
    { id:"shadow_dance",  tier:"legendary", name:"Shadow Dance",     desc:"You blur between cuts: 50% chance every strike lands twice", effect:{ doubleStrike:0.5, speedBonus:0.1 }, vfxCol:"#aa44cc" },
    { id:"needlework",    tier:"epic",      name:"Needlework",       desc:"Rapid consecutive stabs build extra damage until the chain breaks", effect:{ comboDmg:1, speedBonus:0.05 }, vfxCol:"#ffffff" },
    { id:"thousand_cuts", tier:"legendary", name:"Thousand Cuts",    desc:"A storm of afterimages: combo damage climbs faster and strikes may repeat", effect:{ comboDmg:2, doubleStrike:0.35, speedBonus:0.08 }, vfxCol:"#cc88ff" },
  ],
  sword: [
    { id:"perfect_balance",tier:"epic",     name:"Perfect Balance",  desc:"A masterwork edge: faster swings and harder hits", effect:{ speedBonus:0.15, dmg:2 }, vfxCol:"#c8c8d0" },
    { id:"knights_oath",  tier:"legendary", name:"Knight's Oath",    desc:"35% chance a swing releases a spectral slash that cuts through the enemy line", effect:{ beamChance:0.35, beamFrac:0.8 }, vfxCol:"#9ecbff" },
    { id:"duelists_guard",tier:"epic",      name:"Duelist's Guard",  desc:"Clean kills raise your guard for a moment and sharpen your crits", effect:{ barrierOnKill:0.45, critBonus:0.12 }, vfxCol:"#b8d8ff" },
    { id:"silver_gale",   tier:"legendary", name:"Silver Gale",      desc:"The blade moves in two winds: strikes can echo and launch a silver wave", effect:{ doubleStrike:0.25, beamChance:0.28, beamFrac:0.85 }, vfxCol:"#d8f0ff" },
  ],
  longsword: [
    { id:"wide_arc",      tier:"epic",      name:"Wide Arc",         desc:"Sweeping swings: the cleave triggers on every hit, not just kills", effect:{ alwaysCleave:true }, vfxCol:"#d0d0e0" },
    { id:"colossus_cleave",tier:"legendary",name:"Colossus Cleave",  desc:"Every blow crashes outward, splashing half its damage and hurling enemies back", effect:{ splashFrac:0.5, splashR:110, knockBonus:120 }, vfxCol:"#ffd8a0" },
    { id:"reaching_edge", tier:"epic",      name:"Reaching Edge",    desc:"The sword lengthens with pale light, hitting farther and clipping nearby foes", effect:{ range:25, splashFrac:0.25, splashR:80 }, vfxCol:"#e8ecff" },
    { id:"worldsplitter", tier:"legendary", name:"Worldsplitter",    desc:"Huge cuts tear a horizon line through the battlefield", effect:{ beamChance:0.55, beamFrac:1.2, range:15 }, vfxCol:"#fff0c0" },
  ],
  war_axe: [
    { id:"berserkers_call",tier:"epic",     name:"Berserker's Call", desc:"Pain feeds fury: deal up to +60% damage the lower your health", effect:{ berserk:0.6 }, vfxCol:"#c04030" },
    { id:"skull_splitter", tier:"legendary",name:"Skull Splitter",   desc:"No lingering deaths: instantly finishes enemies below 25% health", effect:{ execute:0.25 }, vfxCol:"#ff4040" },
    { id:"red_wake",      tier:"epic",      name:"Red Wake",         desc:"Each chained chop bites deeper and leaves a burning wound", effect:{ comboDmg:1, burnHit:1 }, vfxCol:"#ff6040" },
    { id:"blood_moon",    tier:"legendary", name:"Blood Moon",       desc:"A kill erupts in crimson force and often feeds your wounds closed", effect:{ novaR:105, novaFrac:0.65, novaCol:"#c02030", healOnKill:0.6, berserk:0.25 }, vfxCol:"#ff3040" },
  ],
  war_hammer: [
    { id:"tremor",        tier:"epic",      name:"Tremor",           desc:"The slam pins enemies to the shaking ground", effect:{ rootHit:0.5, knockBonus:100 }, vfxCol:"#9a9aa8" },
    { id:"earthshatter",  tier:"legendary", name:"Earthshatter",     desc:"Every impact detonates the ground, splashing 70% damage in a wide crater", effect:{ splashFrac:0.7, splashR:140 }, vfxCol:"#c89050" },
    { id:"fault_line",    tier:"epic",      name:"Fault Line",       desc:"Hammer blows crack outward, rooting some enemies caught in the shock", effect:{ splashFrac:0.35, splashR:120, rootHit:0.2 }, vfxCol:"#b8a088" },
    { id:"gravity_maul",  tier:"legendary", name:"Gravity Maul",     desc:"The head falls like a star, pinning and hurling enemies with each hit", effect:{ splashFrac:0.6, splashR:130, rootHit:0.55, knockBonus:220 }, vfxCol:"#d8c0ff" },
  ],
  spear: [
    { id:"lunge_master",  tier:"epic",      name:"Lunge Master",     desc:"Longer, meaner thrusts: +30 range and +10% crit", effect:{ range:30, critBonus:0.10 }, vfxCol:"#e8dcb0" },
    { id:"impaler",       tier:"legendary", name:"Impaler",          desc:"Thrusts skewer enemies to the spot and bite deeper", effect:{ rootHit:0.65, dmg:3 }, vfxCol:"#b8a870" },
    { id:"barbed_hook",   tier:"epic",      name:"Barbed Hook",      desc:"Hooked thrusts snag enemies in place and reach farther", effect:{ rootHit:0.25, range:20, critBonus:0.08 }, vfxCol:"#d0b878" },
    { id:"dragon_pike",   tier:"legendary", name:"Dragon Pike",      desc:"A spear of heat and wind punches forward in a long radiant line", effect:{ beamChance:0.35, beamFrac:0.95, range:35, splashFrac:0.25, splashR:70 }, vfxCol:"#ffb060" },
  ],
  flame_sword: [
    { id:"inferno_edge",  tier:"epic",      name:"Inferno Edge",     desc:"The flames rage hotter: burns tick for double damage", effect:{ burnHit:2 }, vfxCol:"#ff9a40" },
    { id:"phoenix_heart", tier:"legendary", name:"Phoenix Heart",    desc:"Kills erupt in fire, and the blaze sometimes mends your wounds", effect:{ novaR:120, novaFrac:0.8, novaCol:"#ff7730", healOnKill:0.35 }, vfxCol:"#ffcc40" },
    { id:"emberbrand",    tier:"epic",      name:"Emberbrand",       desc:"Repeated cuts stoke the blade hotter and leave stronger burns", effect:{ comboDmg:1, burnHit:1.5 }, vfxCol:"#ffb040" },
    { id:"wildfire_crown",tier:"legendary", name:"Wildfire Crown",   desc:"Half-moon slashes fling royal fire while every hit brands the target", effect:{ beamChance:0.35, beamFrac:0.9, burnHit:3 }, vfxCol:"#ffe060" },
  ],
  ice_axe: [
    { id:"deep_freeze",   tier:"epic",      name:"Deep Freeze",      desc:"The chill sinks to the bone: longer chills, 25% chance to freeze solid", effect:{ frostHit:3, rootHit:0.25 }, vfxCol:"#bfefff" },
    { id:"glaciers_wrath",tier:"legendary", name:"Glacier's Wrath",  desc:"Chilled and frozen enemies shatter: +4 damage against them", effect:{ shatter:4 }, vfxCol:"#6abaff" },
    { id:"rimebreaker",   tier:"epic",      name:"Rimebreaker",      desc:"Frozen targets crack harder while every chop carries hoarfrost", effect:{ frostHit:2, shatter:2 }, vfxCol:"#d8fbff" },
    { id:"whiteout",      tier:"legendary", name:"Whiteout",         desc:"Kills burst into freezing mist, and hits can lock enemies in ice", effect:{ novaR:125, novaFrac:0.65, novaCol:"#bfefff", frostHit:4, rootHit:0.4 }, vfxCol:"#ffffff" },
  ],
  gilded_spear: [
    { id:"midas_touch",   tier:"epic",      name:"Midas Touch",      desc:"What it kills turns to gold: 65% chance of bonus coins", effect:{ goldOnKill:0.65 }, vfxCol:"#ffe080" },
    { id:"solar_lance",   tier:"legendary", name:"Solar Lance",      desc:"45% chance a thrust hurls a golden beam through everything in its path", effect:{ beamChance:0.45, beamFrac:1.0 }, vfxCol:"#f2c14e" },
    { id:"tax_collector", tier:"epic",      name:"Tax Collector",    desc:"Consecutive thrusts tally tribute and kills may spill extra coins", effect:{ comboDmg:1, goldOnKill:0.4 }, vfxCol:"#ffd15a" },
    { id:"auric_phalanx", tier:"legendary", name:"Auric Phalanx",    desc:"Golden afterimages guard you after kills and thrust radiant beams", effect:{ barrierOnKill:0.75, beamChance:0.35, beamFrac:0.9, goldOnKill:0.5 }, vfxCol:"#fff0a8" },
  ],
  shadow_axe: [
    { id:"umbral_feast",  tier:"epic",      name:"Umbral Feast",     desc:"The axe drinks: 45% chance kills restore 1 ❤", effect:{ healOnKill:0.45 }, vfxCol:"#aa44cc" },
    { id:"reapers_toll",  tier:"legendary", name:"Reaper's Toll",    desc:"Death claims the weak: instantly finishes enemies below 20% health", effect:{ execute:0.20 }, vfxCol:"#440066" },
    { id:"night_hunger",  tier:"epic",      name:"Night Hunger",     desc:"Chained blows feed the axe, and kills sometimes feed you", effect:{ comboDmg:1, healOnKill:0.3 }, vfxCol:"#7a22aa" },
    { id:"eclipse_reap",  tier:"legendary", name:"Eclipse Reap",     desc:"Weak enemies vanish into a dark burst that can restore your health", effect:{ execute:0.15, novaR:115, novaFrac:0.75, novaCol:"#440066", healOnKill:0.4 }, vfxCol:"#120018" },
  ],
  thunder_blade: [
    { id:"storm_conductor",tier:"epic",     name:"Storm Conductor",  desc:"The static discharge arcs two extra times between enemies", effect:{ chainBonus:2 }, vfxCol:"#eeccff" },
    { id:"thunderlords_verdict",tier:"legendary",name:"Thunderlord's Verdict", desc:"40% chance a strike calls a bolt from the sky down on your target", effect:{ skyBolt:0.4 }, vfxCol:"#ffffff" },
    { id:"static_edge",   tier:"epic",      name:"Static Edge",      desc:"The blade crackles sharper, chaining one extra arc and critting more often", effect:{ chainBonus:1, critBonus:0.12 }, vfxCol:"#cce8ff" },
    { id:"storm_avatar",  tier:"legendary", name:"Storm Avatar",     desc:"You become the storm: extra chain arcs and frequent sky strikes", effect:{ skyBolt:0.55, chainBonus:2, speedBonus:0.1 }, vfxCol:"#f8fbff" },
  ],
  kings_sword: [
    { id:"royal_decree",  tier:"epic",      name:"Royal Decree",     desc:"Authority radiates from every swing, splashing damage and scattering foes", effect:{ splashFrac:0.4, splashR:100, knockBonus:80 }, vfxCol:"#f2c14e" },
    { id:"crownfire",     tier:"legendary", name:"Crownfire",        desc:"Half your swings loose a golden wave, and fallen enemies pay tribute", effect:{ beamChance:0.5, beamFrac:1.0, goldOnKill:0.35 }, vfxCol:"#ffdd44" },
    { id:"bannerlord",    tier:"epic",      name:"Bannerlord",       desc:"Every hit can cleave the crowd, and kills briefly raise your royal guard", effect:{ alwaysCleave:true, barrierOnKill:0.6 }, vfxCol:"#ffe9a0" },
    { id:"royal_procession",tier:"legendary",name:"Royal Procession",desc:"Golden phantoms march with each wave and fallen enemies pay tribute", effect:{ beamChance:0.45, beamFrac:1.05, barrierOnKill:1.0, goldOnKill:0.4 }, vfxCol:"#fff6c8" },
  ],
  sunblade: [
    { id:"solar_flare",   tier:"epic",      name:"Solar Flare",      desc:"Daylight sears: hits set enemies ablaze with solar fire", effect:{ burnHit:2 }, vfxCol:"#ffee80" },
    { id:"supernova",     tier:"legendary", name:"Supernova",        desc:"Kills detonate in a blinding radiant explosion", effect:{ novaR:150, novaFrac:1.0, novaCol:"#ffdd44" }, vfxCol:"#fff8c0" },
    { id:"dawn_prism",    tier:"epic",      name:"Dawn Prism",       desc:"Prismatic cuts throw short rays and leave solar burns behind", effect:{ beamChance:0.25, beamFrac:0.75, burnHit:1 }, vfxCol:"#fff0a0" },
    { id:"daystar",       tier:"legendary", name:"Daystar",          desc:"The blade becomes a little sun: kills explode wider and shield you in light", effect:{ novaR:180, novaFrac:1.1, novaCol:"#ffef80", barrierOnKill:1.0 }, vfxCol:"#ffffff" },
  ],
  // --- Ranged ---
  short_bow: [
    { id:"hunters_instinct",tier:"epic",    name:"Hunter's Instinct", desc:"Read the wind: +15% crit and +40 range", effect:{ critBonus:0.15, range:40 }, vfxCol:"#c9b48a" },
    { id:"twin_strings",  tier:"legendary", name:"Twin Strings",     desc:"60% chance every draw looses a second arrow at another enemy", effect:{ multishot:0.6 }, vfxCol:"#bfefff" },
    { id:"thorn_fletching",tier:"epic",     name:"Thorn Fletching",  desc:"Arrows sprout binding thorns and may pin enemies where they stand", effect:{ rootHit:0.25, critBonus:0.08 }, vfxCol:"#9bd05a" },
    { id:"forest_choir",  tier:"legendary", name:"Forest Choir",     desc:"The bow hums with echoing strings: arrows can ricochet and split", effect:{ bounceArrow:true, multishot:0.35, powerArrow:0.15 }, vfxCol:"#d8ffd0" },
  ],
  long_bow: [
    { id:"eagle_eye",     tier:"epic",      name:"Eagle Eye",        desc:"See the artery: +18% crit and +60 range", effect:{ critBonus:0.18, range:60 }, vfxCol:"#e8e0c8" },
    { id:"windpiercer",   tier:"legendary", name:"Windpiercer",      desc:"Arrows scream through the line, punching through two extra enemies", effect:{ pierce:2 }, vfxCol:"#ffffff" },
    { id:"farwind_string",tier:"epic",      name:"Farwind String",   desc:"The string bends air itself, adding range and a once-per-shot ricochet", effect:{ bounceArrow:true, range:50 }, vfxCol:"#d8f0ff" },
    { id:"skyline_volley",tier:"legendary", name:"Skyline Volley",   desc:"Charged arrows fly like white comets and punch through the line", effect:{ powerArrow:0.35, pierce:1, critBonus:0.12 }, vfxCol:"#ffffff" },
  ],
  crossbow: [
    { id:"heavy_bolts",   tier:"epic",      name:"Heavy Bolts",      desc:"Forged iron bolts: +2 damage and they punch through one enemy", effect:{ dmg:2, pierce:1 }, vfxCol:"#c8ccd4" },
    { id:"repeater",      tier:"legendary", name:"Repeater Mechanism", desc:"40% chance the next bolt is loaded instantly", effect:{ instantReload:0.4 }, vfxCol:"#ffb060" },
    { id:"barbed_windlass",tier:"epic",     name:"Barbed Windlass",  desc:"Barbed bolts hit harder and can pin enemies to the ground", effect:{ dmg:2, rootHit:0.35 }, vfxCol:"#d0c0a0" },
    { id:"siege_engine",  tier:"legendary", name:"Siege Engine",     desc:"Some bolts launch as crushing power shots that pierce deep into the wave", effect:{ powerArrow:0.45, pierce:2, instantReload:0.2 }, vfxCol:"#ffe0a0" },
  ],
  void_bow: [
    { id:"event_horizon", tier:"epic",      name:"Event Horizon",    desc:"Half your arrows tear a rift that drags nearby enemies in", effect:{ gravityArrow:0.5 }, vfxCol:"#9933ff" },
    { id:"null_point",    tier:"legendary", name:"Null Point",       desc:"Arrows detonate into collapsing void, blasting everything nearby", effect:{ explosiveR:110, explosiveFrac:0.8 }, vfxCol:"#ddaaff" },
    { id:"rift_fletching",tier:"epic",      name:"Rift Fletching",   desc:"Arrows bend through tiny portals, ricocheting and pulling foes together", effect:{ bounceArrow:true, gravityArrow:0.35 }, vfxCol:"#bb66ff" },
    { id:"black_star",    tier:"legendary", name:"Black Star",       desc:"A miniature star rides each arrow, piercing before collapsing into a blast", effect:{ explosiveR:95, explosiveFrac:0.75, gravityArrow:0.4, pierce:1 }, vfxCol:"#f0c8ff" },
  ],
  dark_bow: [
    { id:"umbra_hook",    tier:"epic",      name:"Umbra Hook",       desc:"Shadow barbs drag the shot onward, letting arrows ricochet and steal life on kills", effect:{ bounceArrow:true, healOnKill:0.2 }, vfxCol:"#6a007a" },
    { id:"midnight_cascade",tier:"legendary",name:"Midnight Cascade",desc:"Every draw can fall into a cascade of shade-arrows and soul recovery", effect:{ multishot:0.45, bounceArrow:true, healOnKill:0.35 }, vfxCol:"#dd88ff" },
    { id:"twin_shadows",  tier:"epic",      name:"Twin Shadows",     desc:"A shade nocks beside you: 50% chance of a second arrow at another enemy", effect:{ multishot:0.5 }, vfxCol:"#880099" },
    { id:"soul_reaper",   tier:"legendary", name:"Soul Reaper",      desc:"The bow harvests what it slays: 30% chance kills restore 1 ❤", effect:{ healOnKill:0.3, dmg:2 }, vfxCol:"#aa44cc" },
  ],
  dragons_bow: [
    { id:"dragonfire_arrows",tier:"epic",   name:"Dragonfire Arrows", desc:"Every arrow carries dragonflame and sets enemies ablaze", effect:{ fireArrows:true }, vfxCol:"#ff6820" },
    { id:"dragons_roar",  tier:"legendary", name:"Dragon's Roar",    desc:"Arrows explode on impact like a gout of dragon breath", effect:{ explosiveR:120, explosiveFrac:1.0 }, vfxCol:"#ffcc40" },
    { id:"scale_piercers",tier:"epic",      name:"Scale Piercers",   desc:"Hardened burning arrows pierce through foes and leave dragonflame behind", effect:{ pierce:1, fireArrows:true, dmg:1 }, vfxCol:"#ff9a30" },
    { id:"wyrmstorm",     tier:"legendary", name:"Wyrmstorm",        desc:"Some arrows launch as blazing power shots that burst like dragon breath", effect:{ powerArrow:0.3, explosiveR:105, explosiveFrac:0.9, fireArrows:true }, vfxCol:"#ffe080" },
  ],
  // --- Magic ---
  fire_tome: [
    { id:"combustion",    tier:"epic",      name:"Combustion",       desc:"Burning enemies caught in the blast flare and pass the fire onward", effect:{ spellBurn:2, scorchChain:0.35 }, vfxCol:"#ff6a2a" },
    { id:"pyroclasm",     tier:"legendary", name:"Pyroclasm",        desc:"Fireballs leave friendly burning ground that cooks the enemy wave", effect:{ firePool:true, scorchChain:0.5 }, vfxCol:"#ffcc60" },
    { id:"ashen_pages",   tier:"epic",      name:"Ashen Embers",     desc:"The wand spits smaller flames that seed chain-burning embers", effect:{ spellEcho:0.25, spellBurn:1, scorchChain:0.2 }, vfxCol:"#ff9a50" },
    { id:"living_inferno",tier:"legendary", name:"Living Inferno",   desc:"Flames echo, linger, and turn every burning target into kindling", effect:{ spellEcho:0.45, firePool:true, spellBurn:2, scorchChain:0.65 }, vfxCol:"#ffe080" },
  ],
  hydro_tome: [
    { id:"riptide",       tier:"epic",      name:"Riptide",          desc:"Impacts burst into geysers that pin enemies in the undertow", effect:{ aoeBonus:30, spellFrost:1.5, geyser:1 }, vfxCol:"#4ab8e8" },
    { id:"maelstrom",     tier:"legendary", name:"Maelstrom",        desc:"The wave becomes a whirlpool, dragging foes in before the geyser breaks", effect:{ singularity:true, aoeBonus:25, geyser:1.15 }, vfxCol:"#a0e8ff" },
    { id:"glacial_current",tier:"epic",     name:"Glacial Current",  desc:"Cold echoing water erupts beneath survivors and locks their footing", effect:{ spellEcho:0.25, spellFrost:2, geyser:0.75 }, vfxCol:"#d8fbff" },
    { id:"tidal_crown",   tier:"legendary", name:"Tidal Crown",      desc:"Echoing royal waves collapse inward, then geyser through the crowd", effect:{ spellEcho:0.45, singularity:true, aoeBonus:35, geyser:1.6 }, vfxCol:"#ffffff" },
  ],
  lightning_tome: [
    { id:"overcharge",    tier:"epic",      name:"Overcharge",       desc:"The lightning arcs farther and leaves a crackling storm cloud behind", effect:{ chainBonus:2, stormCloud:1 }, vfxCol:"#f0e060" },
    { id:"tempest",       tier:"legendary", name:"Tempest",          desc:"The sky answers twice, then keeps hunting from a short-lived cloud", effect:{ extraBolt:true, stormCloud:1.35 }, vfxCol:"#ffffff" },
    { id:"static_memory", tier:"epic",      name:"Static Memory",    desc:"Residual charge echoes the cast and seeds a weaker follow-up cloud", effect:{ spellEcho:0.2, chainBonus:1, stormCloud:0.75 }, vfxCol:"#fff6a0" },
    { id:"thunderhead",   tier:"legendary", name:"Thunderhead",      desc:"A storm crown follows the staff, chaining hard and striking again", effect:{ extraBolt:true, chainBonus:3, spellEcho:0.25, stormCloud:1.6 }, vfxCol:"#f8fbff" },
  ],
  meteor_tome: [
    { id:"ice_meteor",    tier:"epic",      name:"Ice Meteor",       desc:"The meteor becomes an icy comet that freezes enemies and sheds shards", effect:{ meteorIce:true, meteorFragments:2 }, vfxCol:"#bfefff" },
    { id:"double_up",     tier:"epic",      name:"Double Up",        desc:"Casts less often, but calls twin meteors with a small fragment shower", effect:{ meteorDouble:true, meteorFragments:1 }, vfxCol:"#ff8840" },
    { id:"extinction_event",tier:"legendary",name:"Extinction Event", desc:"A vast crater leaves burning ground and sprays star-fragments outward", effect:{ aoeBonus:50, firePool:true, meteorFragments:3 }, vfxCol:"#ffd060" },
    { id:"glass_comet",   tier:"epic",      name:"Glass Comet",      desc:"Comets shed icy echoes and splinter into freezing glass", effect:{ meteorIce:true, spellEcho:0.2, meteorFragments:2 }, vfxCol:"#d8fbff" },
    { id:"starfall_covenant",tier:"legendary",name:"Starfall Covenant",desc:"The heavens answer with wider twin impacts and a fragment storm", effect:{ meteorDouble:true, aoeBonus:30, spellEcho:0.3, meteorFragments:3 }, vfxCol:"#fff0a0" },
  ],
  arcane_tome: [
    { id:"echo_cast",     tier:"epic",      name:"Echo Cast",        desc:"The weave repeats itself and leaves delayed glyph mines behind", effect:{ freeCast:0.3, runeTrap:0.8 }, vfxCol:"#cc44ff" },
    { id:"arcane_fission",tier:"legendary", name:"Arcane Fission",   desc:"Impacts split into arcane orbs and prime a detonating rune", effect:{ splitOrbs:3, runeTrap:1.1 }, vfxCol:"#ff88ff" },
    { id:"runic_afterimage",tier:"epic",    name:"Runic Afterimage", desc:"A violet afterimage follows the cast and sketches a small trap glyph", effect:{ spellEcho:0.35, runeTrap:0.65 }, vfxCol:"#f0a0ff" },
    { id:"infinite_glyph",tier:"legendary", name:"Infinite Glyph",   desc:"Glyphs split, echo, sometimes refund, and leave stronger rune mines", effect:{ splitOrbs:4, freeCast:0.2, spellEcho:0.25, runeTrap:1.5 }, vfxCol:"#ffffff" },
  ],
  shadow_tome: [
    { id:"creeping_dark", tier:"epic",      name:"Creeping Dark",    desc:"Shadows cling to enemies as a curse that ticks while they are slowed", effect:{ spellFrost:2.5, shadowCurse:1 }, vfxCol:"#660099" },
    { id:"ravenous_void", tier:"legendary", name:"Ravenous Void",    desc:"The darkness drags enemies inward and marks them for hungry shade", effect:{ singularity:true, aoeBonus:25, shadowCurse:1.25 }, vfxCol:"#aa44cc" },
    { id:"hollow_echo",   tier:"epic",      name:"Hollow Echo",      desc:"Shadow casts repeat as hollow bolts that curse and chill the crowd", effect:{ spellEcho:0.35, spellFrost:1, shadowCurse:0.8 }, vfxCol:"#2a003a" },
    { id:"nightfall_grimoire",tier:"legendary",name:"Nightfall Effigy",desc:"Dark impacts split, pull inward, and leave a stronger shade curse", effect:{ singularity:true, splitOrbs:2, spellEcho:0.35, shadowCurse:1.6 }, vfxCol:"#cc66ff" },
  ],
  void_tome: [
    { id:"singularity",   tier:"epic",      name:"Singularity",      desc:"Every impact collapses inward and leaves a violet scar on the lane", effect:{ singularity:true, voidScar:1 }, vfxCol:"#9922ff" },
    { id:"oblivion",      tier:"legendary", name:"Oblivion",         desc:"Reality splinters into orbs, refunds casts, and opens collapse scars", effect:{ splitOrbs:2, freeCast:0.25, voidScar:1.25 }, vfxCol:"#ddaaff" },
    { id:"eventide_pages",tier:"epic",      name:"Eventide Sigil",   desc:"The staff carves a second void sigil and tears a smaller scar", effect:{ spellEcho:0.25, aoeBonus:25, voidScar:0.8 }, vfxCol:"#c080ff" },
    { id:"total_collapse",tier:"legendary", name:"Total Collapse",   desc:"Reality collapses twice, pulling enemies into splitting void scars", effect:{ singularity:true, splitOrbs:3, freeCast:0.2, spellEcho:0.35, voidScar:1.6 }, vfxCol:"#ffffff" },
  ],
  // --- Biome-drop weapons ---
  splinter_bow: [
    { id:"rootmothers_embrace", tier:"legendary", name:"Rootmother's Embrace", desc:"Splinters pin enemies in place and arrows bite through the line", effect:{ splinterCount:2, splinterDmgFrac:0.18, rootHit:0.55, pierce:1 }, vfxCol:"#d6b15a" },
  ],
  lumberjack_axe: [
    { id:"heartwood_cleaver", tier:"legendary", name:"Heartwood Cleaver", desc:"Every chop tears a wider heartwood shock and yanks nearby enemies around", effect:{ splashFrac:0.35, splashR:35, knockBonus:120, alwaysCleave:true }, vfxCol:"#d18c45" },
  ],
  icicle_spear: [
    { id:"permafrost_pike", tier:"legendary", name:"Permafrost Pike", desc:"Frozen kills burst into a cold shockwave while the lance hits harder", effect:{ frostHit:2, rootHit:0.35, shatter:4, novaR:115, novaFrac:0.55, novaCol:"#bfefff" }, vfxCol:"#ffffff" },
  ],
  blizzard_chime: [
    { id:"glacial_rhapsody", tier:"legendary", name:"Glacial Rhapsody", desc:"The frost aura bites harder and every cast erupts into a larger freezing geyser", effect:{ aoeBonus:32, spellFrost:2.5, geyser:1.2, frostAura:0.45, frostAuraRadius:45 }, vfxCol:"#ffffff" },
  ],
  cactus_whip: [
    { id:"dune_stinger_whip", tier:"legendary", name:"Dune-Stinger Whip", desc:"Scorpion barbs spread poison down the line and snap faster", effect:{ poisonHit:2.5, slowHit:0.45, splashFrac:0.22, splashR:45, speedBonus:0.14 }, vfxCol:"#d9a642" },
  ],
  sandstorm_sling: [
    { id:"khamsin_wrath", tier:"legendary", name:"Khamsin Wrath", desc:"Shots burst into a dragging dust storm that blinds clustered enemies", effect:{ explosiveR:105, explosiveFrac:0.65, gravityArrow:0.45, sandBlind:2 }, vfxCol:"#ffe0a0" },
  ],
  acid_blowgun: [
    { id:"hydras_breath", tier:"legendary", name:"Hydra's Breath", desc:"The blowgun spits more darts and leaves acid eating through the wave", effect:{ multishot:0.65, poisonArrow:2.5, acidPool:1 }, vfxCol:"#b8ff7a" },
  ],
  gator_hammer: [
    { id:"apex_sovereign", tier:"legendary", name:"Apex Sovereign", desc:"The maul's mud-wave crushes weak enemies and throws the rest back", effect:{ execute:0.18, splashFrac:0.35, splashR:45, knockBonus:180 }, vfxCol:"#a6d36a" },
  ],
  obsidian_brand: [
    { id:"magma_overlord", tier:"legendary", name:"Magma Overlord", desc:"Overheated cuts throw a molten ground wave and burn everything they touch", effect:{ burnHit:2, heatStacks:-1, heatBurstRadius:50, beamChance:0.35, beamFrac:0.9 }, vfxCol:"#ffcc60" },
  ],
  magma_mortar: [
    { id:"volcanic_eruption", tier:"legendary", name:"Volcanic Eruption", desc:"Mortar shots break into a storm of lava fragments over a wider crater", effect:{ meteorFragments:3, aoeBonus:40, firePool:true, spellBurn:1 }, vfxCol:"#fff0a0" },
  ],
  shadow_scythe: [
    { id:"void_reaper", tier:"legendary", name:"Void Reaper", desc:"Reaping arcs send shadow blades through the line and feed you on kills", effect:{ beamChance:0.45, beamFrac:0.9, healOnKill:0.25, novaR:90, novaFrac:0.55, novaCol:"#5d2ca8" }, vfxCol:"#d0a4ff" },
  ],
  possessed_heart: [
    { id:"eldritch_catalyst", tier:"legendary", name:"Eldritch Catalyst", desc:"The heart opens into a stronger void beam that echoes and leaves deeper scars", effect:{ splitOrbs:2, spellEcho:0.35, voidScar:1, freeCast:0.15 }, vfxCol:"#f0c8ff" },
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
  const fx = { _tierRank: 0, _vfxCols: [], _ids: [] };
  if (!upgrades || !upgrades.length) return fx;
  for (const u of upgrades) {
    if (u.id) fx._ids.push(u.id);
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
