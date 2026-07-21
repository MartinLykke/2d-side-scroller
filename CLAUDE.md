# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

Serve with any static HTTP server from the repo root (no build step):

```
python -m http.server 8000
```

Then open `http://localhost:8000/` in Chrome. The entry point is `index.html`, which loads `src/core/game.js` as an ES module.

There are no dependencies, no bundler, no package.json, and no test suite.

> Note: the game is titled **Ashen Reign**. Some legacy identifiers still carry the old "Kingdom / Crown of Embers" name — the `<title>` in `index.html`, the start-screen copy, and the localStorage keys (`kingdom_embers_save_v1`, `kingdom_embers_meta_v1`). Treat those strings as historical; don't rename them without migrating saves.

## Dev tools (in-game)

Press `P` to open the dev panel. It exposes:
- **Run setup**: gold (+10/50/1000🪙), embers (+10/50/500🔥), time skips (→ night, → day, jump to day 10/15/20), reset upgrades, clear leaderboard
- **Kingdom**: upgrade base, max base, max walls, fort tier +1 (Runeforge)
- **World**: switch the active biome (Forest, Frozen Wastes, Desert, Swamp, Volcano, Corrupted Lands)
- **Spawn**:
  - Enemies (imp, flying imp, ember brute, ash priest, siege imp, chain imp, 8× imp, dragon, magma colossus, kill all)
  - The Hollow / phase 2 (shade, void wraith, hollow brute, void titan, null seraph)
  - Biome bosses (forest stalker, skadi's wrath, dune broodmother, sunken behemoth, ignited core, void mind-flayer)
  - Assault & phases (start assault, crack portals, begin biome shift)
  - Units (archer, builder, farmer, guard)
  - Wildlife (deer, rabbit, duck, bear)
- **Progression**: archer/guard level ups, +5 skill points, unlock all archer skills
- **Player loadout**: death hub, weapon grants + drop, armor grants + remove, mount grants + dismount
- **Quickbar**: profiler toggle, god mode, full heal, speed multiplier (×1/×2/×4)
- **Live stats**: FPS, day/time, enemy/unit/coin/particle counts, player position

The `DEV` object is defined in `src/rendering/HUD.js` and exposed on `window`.

## Game overview

**Ashen Reign** — a roguelike tower defense where the player defends a base from nightly enemy waves, recruits units, marches out to shatter enemy portals to advance the land through a sequence of **biomes**, and earns permanent meta-progression (embers) across runs.

### Core loop

1. **Day phase** — explore, recruit units, build/upgrade walls and buildings, buy weapons, fell trees
2. **Night phase** — enemies spawn from portals, attack base and walls; player and units fight back
3. **Break a portal (G)** — march your army on a portal; destroying it shifts the world to the **next biome** (new palette, new enemy roster, new biome boss and weapon drops). After the final biome, the next break triggers **the Hollow** (phase 2)
4. **Between runs** — on death, earn embers based on performance; spend on permanent upgrades in the hub

### World layout

- 9000 px wide; base at x ≈ 4500
- Two enemy portals at the edges (x≈180, x≈8820)
- Four wall slots (2 per side) around base
- Dense biome flora across the map except near the base; trees can be felled to clear building slots
- Camps spawn in the forest with vagrants that can be rescued

### Biomes

The whole map uses **one active biome at a time** (`Game.activeBiome`); switching biome remakes the entire landscape rather than moving through world-space bands. Biome data lives in `BIOME_DEFS` / `BIOME_ORDER` (`src/rendering/Effects.js`), enemy rosters in `BIOME_ENEMY_POOLS` / `BIOME_BOSS_TYPES` (`src/config/enemies.js`), and weapon drops in `BIOME_WEAPON_DROPS` (`src/config/weapons.js`).

Progression order (`BIOME_ORDER`): **forest → frozen → desert → swamp → volcano → corrupted**. A run starts in **forest**. Each destroyed portal advances one biome (`performPhaseShift()` → `setActiveBiome(nextBiomeId(...))`); after **corrupted**, the next break flips `Game.worldPhase = 2` (the Hollow). `activeBiome`, `unlockedBiomes`, and `worldPhase` are saved, but a run always begins in forest / phase 1.

Each biome has a themed palette (`Effects.js`), a four-enemy pool (basic / standard / special / heavy), one legendary biome boss (spawns from day 3 in the boss slot), and two exclusive weapon drops.

### Day/night cycle

- Days are 200 seconds (`CFG.dayLength`). `Game.time` runs 0→1.
- Phases (`CFG.phases`): Day (0–0.55), Dusk (0.55–0.68), Night (0.68–0.90), Dawn (0.90–1.0)
- Enemies spawn during night from portals via pre-planned quotas (`planNight()`)
- Enemies flee at dawn
- A HUD **Skip to dusk** button (`DEV.skipToDusk` in `HUD.js`, but player-facing) fast-forwards the day — after a cleared night it advances to the next day first — and pays out a discounted share (45%) of the skipped day's expected passive income
- **One-sided nights**: occasionally (day > 1) the horde presses from only one portal side; a banner announces it at nightfall (`Game.oneSidedNightSide`)
- **Bounty raiders**: some nights seed a few tougher, gold-rich raiders into the quota (`bountyRaiderCount()`, `Game.bountyRaidersRemaining`)

### Difficulty

Chosen on the start screen (Easy / Normal / Hard). Profiles in `src/config/difficulty.js` (`DIFFICULTY_PROFILES`) tune `enemyCountMult`, `enemyStrengthMult`, `elitePressureMult`, and a per-difficulty performance budget (target FPS, particle/float-text caps, spawn interval). Hard doubles enemy counts, adds +12% strength and +30% elite pressure, and runs an aggressive render budget.

## Architecture

### Module graph

`src/core/game.js` is the orchestrator — it owns the game loop (`requestAnimationFrame`), calls all `update*` functions each tick (capped at 50ms delta), and wires up keyboard/mouse/button events. Everything else is a pure subsystem.

**Shared state** lives in `src/core/state.js` as two exported objects:
- `Game` — singleton game-clock and UI flags (day, phase, menus open, camera, zoom, `activeBiome`, `worldPhase`, etc.)
- `state` — all mutable entity arrays (player, units, enemies, coins, walls, loot items, buildings, etc.)

Every module imports these directly; nothing is passed as arguments through update calls.

### Directory layout

| Path | Purpose |
|------|---------|
| `src/core/` | Entry point (`game.js`), shared state (`state.js`), canvas setup (`canvas.js`) |
| `src/config/` | Pure data: `config.js`, `weapons.js`, `weaponUpgrades.js`, `armor.js`, `enemies.js`, `difficulty.js`, `fortifications.js`, `mounts.js`, `archerSkills.js`, `guardSkills.js` |
| `src/entities/` | Factory functions: `Player.js`, `Unit.js`, `Wall.js` |
| `src/systems/ai/` | Unit AI (`AI.js`), enemy behavior (`EnemyAI.js`), per-role AIs (`ArcherAI`, `GuardAI`, `BuilderAI`, `FarmerAI`, `BossAI`, `ImpCombatAI`, `AIHelpers`) |
| `src/systems/combat/` | Combat orchestrator (`Combat.js`), player attacks (`PlayerCombat.js`), arrows (`ProjectileSystem.js`), spells (`SpellSystem.js`) |
| `src/systems/world/` | Spawning (`SpawnSystem.js`), forests (`ForestSystem.js`), outposts/buildings (`OutpostSystem.js`), portal assault + biome shift (`AssaultSystem.js`), fortifications (`FortificationSystem.js`) |
| `src/systems/economy/` | Payments (`Economy.js`), shops (`ShopSystem.js`), loot (`LootSystem.js`), upgrades/leveling (`UpgradeSystem.js`), mounts (`MountSystem.js`), castle upgrades (`CastleUpgradeSystem.js`) |
| `src/systems/input/` | Keyboard state (`Input.js`), event listeners (`InputHandler.js`), dev panel (`DevPanel.js`) |
| `src/systems/infrastructure/` | Save/load (`SaveSystem.js`), audio (`Audio.js`), game init (`GameInit.js`), roguelike meta + leaderboard (`RoguelikeSystem.js`) |
| `src/rendering/` | Main draw orchestrator (`Renderer.js`), DOM HUD (`HUD.js`), particles/biomes (`Effects.js`), item/weapon rendering (`ItemRender.js`), draw helpers (`DrawHelpers.js`) |
| `src/rendering/sprites/` | Entity sprite renderers: `Player.js`, `Archer.js`, `Guard.js`, `Builder.js`, `Villager.js`, `Animals.js` |
| `src/rendering/scene/` | Scene renderers: `RenderWorld.js`, `RenderEntities.js`, `RenderItems.js`, `RenderEffects.js`, `RenderPrimitives.js`, `RenderUI.js` |
| `src/util/` | Pure utilities: `math.js` (clamp, dist, lerp, rand, etc.), `GameStateHelpers.js`, `EnemyUtils.js` |

### Key patterns

- **Callback registration**: Modules register callbacks via functions like `setPickupWeapon()`, `setBuildStations()`, and `setAddXP()` to pass functions across modules without circular imports. `core/game.js` wires these up at startup.
- **Window globals**: Global state and functions exposed via `window` (e.g., `window._KEYS`, `window._DEV_GOD_MODE`, `window._WEAPON_SHOP`) to avoid circular import chains. Primarily used by AI systems and the dev panel.
- **Camera**: `Game.cam` is the world-space offset applied in the renderer. `Game.zoom` scales the viewport (0.35–2.5×, default 1.2×). All entity positions are in world space.
- **Cache-busting imports**: modules import each other with a `?v=biomeactive1` query suffix; bump it (and the one on the `<script>` tag in `index.html`) together when forcing a cache refresh.

## Entities

### Player
- 5 HP, sprint 430 px/s, walk 250 px/s, jump velocity 560, gravity 1400
- Equips one weapon + one armor. Weapons have damage, speed, range, and rarity tier.
- On level-up, offered 3 random weapon upgrades to choose from.
- Regen +1 HP/7s when not in combat (boosted by roguelike upgrades).
- Invulnerability 0.9s after hit.

### Units (4 roles)
| Role | HP | Cost | Unlock | Behavior |
|------|----|------|--------|----------|
| Archer | 6 | 4🪙 | — | Ranged; stand on walls; named; own XP/level; skill tree |
| Builder | 5 | 3🪙 | — | Fell marked trees, carry logs to base for gold |
| Farmer | 5 | — | Base lvl 2 | Passive gold generation; 1 spawned per farm upgrade |
| Guard | 8 | 8🪙 | Base lvl 3 | Melee; patrol and engage; skill tree |

### Enemies — phase 1 core roster
| Type | HP | Notes |
|------|----|-------|
| Imp | 6 | Basic melee, spawns in night quotas |
| Flying Imp | 8 | Flying, shoots fireballs at 430 px range |
| Ember Brute | 45 | Charger + stomper |
| Ash Priest | 14 | Fast caster: big splashing fireballs, scorch, wards, bursts |
| Chain Imp | 10 | Support (from day 3): hooks a grappling chain onto a wall so imps climb it; kill it or the chain to drop climbers |
| Siege Imp | 58 | Heavy (from day 4): front shield deflects frontal arrows, carries a platform of rider imps, rams gates |
| Fire Dragon | 320 | Legacy boss (`BOSS_SCHEDULE` day 3), flying, drops rider imps, "Fire Breath" |
| Magma Colossus | 650 | Legacy legendary boss (day 6), fire-immune, "Volcanic Impact" |

`BOSS_SCHEDULE` (`src/config/enemies.js`) is the **legacy non-biome** boss calendar (fire dragon / magma colossus). When a biome boss is defined for the active biome it takes the first boss slot (from day 3); the legacy schedule only fills a slot in biomes with no biome boss. Night quotas double from day 3 onward and scale with a horde multiplier (`planNight()`); `nightEnemyType()` in `SpawnSystem.js` picks each spawn.

### Enemies — biome rosters
Each biome contributes a basic / standard / special / heavy pool (`BIOME_ENEMY_POOLS`) plus one legendary biome boss (`BIOME_BOSS_TYPES`):

| Biome | basic | standard | special | heavy | Boss (HP) |
|-------|-------|----------|---------|-------|-----------|
| Forest | Greedlet | Masked Greed | Floater | Breeder | The Great Horned Stalker (720) — "Nature's Reclamation" |
| Frozen | Frost-Sprite | Ice-Golem | Blizzard Witch | Ice-Golem | Skadi's Wrath (820) — "Deep Freeze" |
| Desert | Sand-Scuttler | Dust-Wraith | Behemoth Scorpion | Behemoth Scorpion | Broodmother of the Dunes (900) — "Subterranean Breach" |
| Swamp | Bog-Crawler | Spore-Spitter | Murk-Abomination | Murk-Abomination | The Sunken Behemoth (1080) — "The Great Consumption" |
| Volcano | Ash-Fiend | Magma Gargoyle | Obsidian Juggernaut | Obsidian Juggernaut | The Ignited Core (980) — "Supernova" |
| Corrupted | Shadow-Stalker | Rift-Weaver | The Amalgam | The Amalgam | Mind-Flayer of the Void (1120) — "Mass Possession" |

Biome enemies carry themed traits — e.g. greedlets steal gold, frost-sprites freeze walls, sand-scuttlers burrow, ash-fiends explode on death, obsidian juggernauts are fire-immune and shrug off light arrows, shadow-stalkers stealth, breeders/rift-weavers spawn adds. See `ENEMY_TYPES` in `src/config/enemies.js` for the full flag set.

### Enemies — phase 2 ("the Hollow")
After the final biome's portal falls, void rifts open and these replace the night roster:

| Type | HP | Notes |
|------|----|-------|
| Shade | 36 | Fast basic melee; void-shift (incorporeal), lunges, darkens walls (replaces imp; does not wall-stack) |
| Void Wrath | 48 | Flying, fires void bolts that mark targets; gravity bursts, void rain, rift shield |
| Hollow Brute | 120 | Charger + stomper (ember brute mechanics) |
| Void Titan | 3280 | Legendary boss (golem mechanics), "Reality Collapse" |
| Null Seraph | 2480 | Flying legendary boss, summons adds ("Black Star Choir") |

Every phase-2 night opens with **both** the Void Titan and the Null Seraph (order alternates by day parity), followed by the shade/wraith/brute quota, with a 1.15× quota multiplier.

Enemies spawn from portals, advance toward base, stack on walls. Flee at dawn.

### Wildlife
Passive/ambient animals roam during the day (`state.animals`): deer, rabbits, ducks — and **bears**, which are dangerous. Spawned via `spawnAnimal()`; dev buttons can force each.

## Portal assault & biome shift

Press `G` during the day (phase 1, needs ≥1 archer/guard) to sound the war horn: every archer and guard marches on the portal nearest the player (`src/systems/world/AssaultSystem.js`). Approaching within `CFG.assaultWakeRange` wakes a defense wave from the portal; a second half-wave spawns at 50% portal HP. Portal HP is `CFG.portalHp + (day-1) * CFG.portalHpPerDay`; damage persists across failed attempts. Guards melee the gate, archers volley from a stand-off line; when an enemy is in reach, the normal role AI takes the fight. Assaults are disabled in phase 2 (the void rifts can't be assaulted).

If the portal falls: celebration, march home, then a flash transition (`Game.phaseTransition` in `game.js`) calls `performPhaseShift()`:
- **If a next biome exists** — `setActiveBiome(next, {reseed:true})`, world stays phase 1, player + army teleport to base, enemies/animals/arrows cleared, portals reset, forest rebuilt for the new biome, palette + flora swap. Banner: "ENTERING <BIOME>".
- **After the final biome** — `Game.worldPhase = 2`, portals become void rifts, forest regrown with a new `treeSeed`, palette shifts violet (`applyWorldPhase` in `Effects.js`), the Hollow roster begins. Banner: "THE HOLLOW AWAKENS".

`activeBiome` / `worldPhase` are saved; a run always starts back in forest / phase 1.

## Economy & progression

### Base (levels 1–7)
| Level | Name | HP | Capacity | Unlocks |
|-------|------|-----|----------|---------|
| 1 | Camp | 60 | 8 | — |
| 2 | Small Village | 90 | 16 | Shop, farm, hammer, lumber camps |
| 3 | Large Village | 130 | 26 | Towers, shrine, guards, Runeforge |
| 4 | Castle | 180 | 40 | Free lumber, +1 player max HP, repair station |
| 5 | Fortress | 250 | 52 | — |
| 6 | Citadel | 330 | 66 | Ballista emplacements |
| 7 | Royal Capital | 430 | 80 | Crown Aegis (castle smites nearby enemies), +1 player max HP, reinforce station |

Max level is `CFG.maxBaseLevel`. From level 4 on, the base station prioritizes repairs over the next upgrade.

### Stations
Payment-gated purchases: hold ↓/S near a station. Payment rate accelerates with hold time (1→2→6 coins/tick). Coins refund if player walks away before completing. Stations are rebuilt on each base upgrade via `buildStations()` in `GameInit.js`. Station x-positions are in `STATIONS_X` (`config.js`): bow, hammer, farm, shop, guard, runeforge.

### Walls (4 slots, levels 1–5)
Health scales 45→320 HP (`CFG.wallHp`). Cost 5🪙 to raise; upgrades 11→18→28→44🪙 (`CFG.wallUpgradeCosts`). Archers stand on walls with capacity per level.

### The Runeforge (fortifications)
A linear arcane upgrade track bought at the runeforge obelisk (unlocks at base lvl 3). Six tiers in `src/config/fortifications.js` (`FORT_TRACK`), purchased in order: Ember Wards → Stoneskin Masonry (+25% wall/base HP) → Frost Wards → Greater Ember Wards → Crown Sigil (damage ring) → Bulwark of the Ancients (+50% defense HP, walls reflect damage). `fortHpMultAt()` supplies the HP multiplier; logic in `FortificationSystem.js`.

### Buildings (7 slots)
| Building | Count | Cost | Unlock | Effect |
|----------|-------|------|--------|--------|
| Lumber Camp | 2 | 11🪙 | Base 2 | Auto-mark trees; +2🪙 per delivered log |
| Tower | 2 | 15/22/34🪙 | Base 3 | Auto-shoot enemies in 430 px range |
| Shrine | 1 | 18🪙 | Base 3 | Heal player+units in 190 px radius every 3.5s |
| Ballista | 2 | 45/70🪙 | Base 6 | Heavy piercing bolts at the toughest enemy in 640 px range (lvl 1–2) |

Buildings in forest require surrounding trees to be felled first.

### Weapons & armor
- **39 weapons** (`src/config/weapons.js`) across melee, ranged, and magic (wands & staffs), in 5 rarity tiers (Common→Legendary). This includes **12 biome-only drops** (2 per biome, `BIOME_WEAPON_DROPS`) with unique innate effects — e.g. Splinter Bow (forest), Icicle Lance (frozen), Cactus Whip (desert), Gator Maul (swamp), Obsidian Brand (volcano), Shadow Scythe / Possessed Heart (corrupted).
- 9 armor pieces providing defense (reduces incoming damage; defense also gives a chance to fully block a hit — `armorBlockChance` in `PlayerCombat.js`)
- Every armor has a unique **ability** (`ability` in `src/config/armor.js`): passive buffs (move speed, dodge cooldown, regen speed) and on-block effects — knockback/damage pulses with burn, frost, root, or pull; heal-on-block; riposte (block resets attack cooldown); extra block i-frames. Epic+ armors shed ambient particles (`updateArmorPassiveFX` in `PlayerCombat.js`)
- Shop unlocked at base level 4; shop tier scales with base level
- Weapons also found in chests and dropped by biome enemies

### Weapon upgrades
On level-up the player picks from 3 random upgrades (`src/config/weaponUpgrades.js`): generic tiers plus **unique upgrades per weapon** (2 epic + 2 legendary each). Effects span melee (combo damage, barrier-on-kill, beams, novas, execute…), ranged (pierce, bounce/chain/power arrows, gravity arrows…), and magic (bigger AoE, extra chains, seeker orbs, spell echo, rune traps, singularity…). Upgrades carry a `vfxCol` woven into the held weapon's glow.

### Mounts
- 3 mounts (`src/config/mounts.js`) sold in the shop's Stable tab: Dun Pony (+35% speed), Chestnut Courser (+65%), Ember Warhorse (+100%)
- A mount multiplies walk and sprint speed and raises the rider by its `lift` (px). The steed draws inside the player's render transform (`Renderer.js`), so the body and held weapon ride it automatically; arrow/spell spawn origins add `playerMountLift()` (`src/systems/economy/MountSystem.js`)
- Owned mounts toggle ride/stable in the shop or with H in the field; no riding while climbing walls
- Hitboxes are unchanged while mounted (the mount is speed + visuals only)
- Ownership and the ridden mount persist in the save

### Skill trees (K to open)
**Archer** — 3 branches (Pilen, Buen, Taktik) + 2 ultimates (Master Shadows, Heavy Ballista)
**Guard** — 3 branches (Spyd, Skjold, Taktik) + 2 ultimates (Spear Titan, Fortress Guardian)

Skill points earned from upgrades and building construction.

## Combat

- **Melee**: hold mouse to swing; arc visual; cooldown from weapon speed
- **Ranged**: aim-and-release sequence
- **Magic (wands & staffs)**: cast spell toward cursor
- **Crit**: 15% chance for 1.5× damage
- Archers: fire arrows (every 4th shot ignites), piercing, bouncing volley, double shot, powershot (3s charge → 3× damage)
- Guards: piercing thrust, whirlwind, shield bash, rally cry (+20% damage to allies)

## Roguelike meta-progression

On death, the player enters a hub and earns **embers** based on run performance (kills × multiplier). 11 permanent upgrades purchasable with embers:
- Stat boosts: +HP, +damage, +starting gold, +regen speed
- Starter bonuses: +vagrants, +free bow, +skill points, +starting gold burst
- Run reward scaling: +ember multiplier

The hub also shows a **leaderboard** of past runs (`RoguelikeSystem.js`, `recordLeaderboardRun()` / `drawHubLeaderboard()`). Meta data (including the leaderboard) persisted in localStorage (`kingdom_embers_meta_v1`). Applied at game start via `applyPermanentUpgrades()`. In the hub, Enter/Space warps the player to the run portal to start the next run.

## Save system

Auto-saves every 5 seconds to localStorage (`kingdom_embers_save_v1`). Saves full game state: clock, player, base, walls, buildings, units, vagrants, forest trees, farm, skill points, fortifications, `activeBiome` / `unlockedBiomes` / `worldPhase`. Continue button on start screen if save exists.

## Controls

| Key | Action |
|-----|--------|
| A/D or ←/→ | Move |
| Shift | Sprint |
| Space | Jump |
| X/Ctrl | Dodge roll (i-frames; dodging through an enemy primes a riposte) |
| ↓/S (hold) | Pay/recruit at station |
| F | Pick up weapon / open chest |
| B | Open shop (near base, lvl 4) |
| T | Switch shop tabs (weapons / armor / stable) |
| H | Mount / dismount your steed |
| E/Enter | Buy selected item |
| K | Skill tree |
| Q | Unit ability (barrage / rally cry) |
| G | Sound the war horn (portal assault → biome shift) |
| I | Inventory |
| +/−/0 | Zoom in/out/reset |
| M | Mute |
| P | Dev panel |
| Esc | Pause / close menus |
| Mouse wheel | Zoom |
