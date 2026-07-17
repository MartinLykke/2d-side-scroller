# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

Serve with any static HTTP server from the repo root (no build step):

```
python -m http.server 8000
```

Then open `http://localhost:8000/` in Chrome. The entry point is `index.html`, which loads `src/core/game.js` as an ES module.

There are no dependencies, no bundler, no package.json, and no test suite.

## Dev tools (in-game)

Press `P` to open the dev panel. It exposes:
- Gold/ember injection (+10/50/1000 coins, +10/50/500 embers, reset meta)
- Time skips (skip to night, next day, jump to day 10/15/20)
- Base upgrade, max walls, full heal (player + units + base + walls)
- Enemy spawning (imp, flying imp, dragon, 8-imp wave, kill all; phase-2: shade, void wraith, hollow brute, void titan, null seraph)
- Assault & phase tools (start assault, crack portals to 10 hp, begin phase 2)
- Unit spawning (archer, builder, farmer, guard)
- Weapon grants (short bow, storm staff, meteor staff), drop weapon, god mode
- Mount grants (one button per mount) and stable-current-mount
- Speed multiplier (×1, ×2, ×4)
- Live stats: FPS, day/time, enemy/unit/coin/particle counts, player position

The `DEV` object is defined in `src/rendering/HUD.js` and exposed on `window`.

## Game overview

**Kingdom: Crown of Embers** — a roguelike tower defense where the player defends a base from nightly enemy waves, recruits units, and earns permanent meta-progression (embers) across runs.

### Core loop

1. **Day phase** — explore, recruit units, build/upgrade walls and buildings, buy weapons, fell trees
2. **Night phase** — enemies spawn from portals, attack base and walls; player and units fight back
3. **Between runs** — on death, earn embers based on performance; spend on permanent upgrades in the hub

### World layout

- 9000 px wide; base at x ≈ 4500
- Two enemy portals at edges (x=500, x=8500)
- Four wall slots (2 per side) around base
- Dense forest across the map except near base; trees can be felled to clear building slots
- Camps spawn in the forest with vagrants that can be rescued

### Day/night cycle

- Days are 200 seconds (`CFG.dayLength`). `Game.time` runs 0→1.
- Phases: Day (0–0.55), Dusk (0.55–0.68), Night (0.68–0.85), Dawn (0.85–1.0)
- Enemies spawn during night from portals via pre-planned quotas (`planNight()`)
- Enemies flee at dawn
- A HUD **Skip to dusk** button (`DEV.skipToDusk` in `HUD.js`, but player-facing) fast-forwards the day — after a cleared night it advances to the next day first — and pays out a discounted share (45%) of the skipped day's expected passive income

## Architecture

### Module graph

`src/core/game.js` is the orchestrator — it owns the game loop (`requestAnimationFrame`), calls all `update*` functions each tick (capped at 50ms delta), and wires up keyboard/mouse/button events. Everything else is a pure subsystem.

**Shared state** lives in `src/core/state.js` as two exported objects:
- `Game` — singleton game-clock and UI flags (day, phase, menus open, camera, zoom, etc.)
- `state` — all mutable entity arrays (player, units, enemies, coins, walls, loot items, buildings, etc.)

Every module imports these directly; nothing is passed as arguments through update calls.

### Directory layout

| Path | Purpose |
|------|---------|
| `src/core/` | Entry point (`game.js`), shared state (`state.js`), canvas setup (`canvas.js`) |
| `src/config/` | Pure data: `config.js`, `weapons.js`, `armor.js`, `enemies.js`, `archerSkills.js`, `guardSkills.js` |
| `src/entities/` | Factory functions: `Player.js`, `Unit.js`, `Wall.js` |
| `src/systems/ai/` | Unit AI (`AI.js`), enemy behavior (`EnemyAI.js`) |
| `src/systems/combat/` | Combat orchestrator (`Combat.js`), player attacks (`PlayerCombat.js`), arrows (`ProjectileSystem.js`), spells (`SpellSystem.js`) |
| `src/systems/world/` | Spawning (`SpawnSystem.js`), forests (`ForestSystem.js`), outposts/buildings (`OutpostSystem.js`) |
| `src/systems/economy/` | Payments (`Economy.js`), shops (`ShopSystem.js`), loot (`LootSystem.js`), upgrades/leveling (`UpgradeSystem.js`) |
| `src/systems/input/` | Keyboard state (`Input.js`), event listeners (`InputHandler.js`) |
| `src/systems/infrastructure/` | Save/load (`SaveSystem.js`), audio (`Audio.js`), game init (`GameInit.js`), roguelike meta (`RoguelikeSystem.js`) |
| `src/rendering/` | Main draw orchestrator (`Renderer.js`), DOM HUD (`HUD.js`), particles/biomes (`Effects.js`), draw helpers (`DrawHelpers.js`) |
| `src/rendering/sprites/` | Entity sprite renderers: `Player.js`, `Archer.js`, `Guard.js`, `Builder.js`, `Villager.js`, `Animals.js` |
| `src/rendering/scene/` | Scene renderers: `RenderWorld.js`, `RenderEntities.js`, `RenderItems.js`, `RenderEffects.js`, `RenderUI.js` |
| `src/util/` | Pure utilities: `math.js` (clamp, dist, lerp, rand, etc.), `GameStateHelpers.js`, `EnemyUtils.js` |

### Key patterns

- **Callback registration**: Modules register callbacks via functions like `setPickupWeapon()`, `setBuildStations()`, and `setAddXP()` to pass functions across modules without circular imports. `core/game.js` wires these up at startup.
- **Window globals**: Global state and functions exposed via `window` (e.g., `window._KEYS`, `window._DEV_GOD_MODE`, `window._WEAPON_SHOP`) to avoid circular import chains. Primarily used by AI systems and the dev panel.
- **Camera**: `Game.cam` is the world-space offset applied in the renderer. `Game.zoom` scales the viewport (0.35–2.5×, default 1.2×). All entity positions are in world space.

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

### Enemies
| Type | HP | Notes |
|------|----|-------|
| Imp | 6 | Basic melee, spawns in night quotas |
| Flying Imp | 8 | Flying, shoots fireballs at 430 px range |
| Ember Brute | 20 | Charger + stomper |
| Ash Priest | 14 | Fast caster: big splashing fireballs, scorch, wards, bursts |
| Fire Dragon | 320 | Boss (unlocks night 3), flying, drops rider imps, legendary attacks |
| Magma Colossus | 650 | Legendary golem boss (unlocks night 6), fire-immune |

`BOSS_SCHEDULE` (`src/config/enemies.js`) marks each boss's **unlock night**; after that it spawns every night, and once two bosses are unlocked both spawn each night (the top two tiers fill the first two spawn slots — see `nightEnemyType()` in `SpawnSystem.js`). Night quotas double from day 3 onward.

Phase 2 ("the Hollow", after a portal is destroyed) replaces the night roster:

| Type | HP | Notes |
|------|----|-------|
| Shade | 36 | Fast basic melee (replaces imp; does not wall-stack) |
| Void Wraith | 48 | Flying, fires void bolts (fireball mechanic, violet palette) |
| Hollow Brute | 120 | Charger + stomper (ember brute mechanics) |
| Void Titan | 3280 | Legendary boss (golem mechanics), "Reality Collapse" |
| Null Seraph | 2480 | Flying legendary boss, summons adds ("Black Star Choir") |

Every phase-2 night opens with **both** the Void Titan and the Null Seraph (order alternates by day parity), followed by the shade/wraith/brute quota.

Enemies spawn from portals, advance toward base, stack on walls. Flee at dawn.

## Portal assault & phase 2

Press `G` during the day (phase 1, needs ≥1 archer/guard) to sound the war horn: every archer and guard marches on the portal nearest the player (`src/systems/world/AssaultSystem.js`). Approaching within `CFG.assaultWakeRange` wakes a defense wave from the portal; a second half-wave spawns at 50% portal HP. Portal HP is `CFG.portalHp + (day-1) * CFG.portalHpPerDay`; damage persists across failed attempts. Guards melee the gate, archers volley from a stand-off line; when an enemy is in reach, the normal role AI takes the fight (assaultUnitAI returns false).

If the portal falls: celebration, march home, then a flash transition (`Game.phaseTransition` in game.js) calls `performPhaseShift()` — `Game.worldPhase = 2`, player + army teleport to base, enemies/animals cleared, both portals become void rifts, the forest is regrown with a new `treeSeed`, and the whole palette shifts violet (`applyWorldPhase` in `Effects.js`). Nights then spawn the Hollow roster with a 1.15× quota. `worldPhase` is saved; a run always starts back in phase 1.

## Economy & progression

### Base (levels 1–7)
| Level | Name | HP | Capacity | Unlocks |
|-------|------|-----|----------|---------|
| 1 | Camp | 60 | 8 | — |
| 2 | Small Village | 90 | 16 | Shop, farm, hammer, lumber camps |
| 3 | Large Village | 130 | 26 | Towers, shrine, guards, mine |
| 4 | Castle | 180 | 40 | Free lumber, +1 player max HP, repair station |
| 5 | Fortress | 250 | 52 | — |
| 6 | Citadel | 330 | 66 | Ballista emplacements |
| 7 | Royal Capital | 430 | 80 | Crown Aegis (castle smites nearby enemies), +1 player max HP, reinforce station |

Max level is `CFG.maxBaseLevel`. From level 4 on, the base station prioritizes repairs over the next upgrade.

### Stations
Payment-gated purchases: hold ↓/S near a station. Payment rate accelerates with hold time (1→2→6 coins/tick). Coins refund if player walks away before completing. Stations are rebuilt on each base upgrade via `buildStations()` in `GameInit.js`.

### Walls (4 slots, levels 1–5)
Health scales 45→320 HP. Cost: 6→14→22→35→55🪙. Archers stand on walls with capacity per level.

### Buildings (7 slots)
| Building | Count | Cost | Unlock | Effect |
|----------|-------|------|--------|--------|
| Lumber Camp | 2 | 14🪙 | Base 2 | Auto-mark trees; +2🪙 per delivered log |
| Tower | 2 | 18/26/40🪙 | Base 3 | Auto-shoot enemies in 430 px range |
| Shrine | 1 | 22🪙 | Base 3 | Heal player+units in 190 px radius every 3.5s |
| Ballista | 2 | 45/70🪙 | Base 6 | Heavy piercing bolts at the toughest enemy in 640 px range (lvl 1–2) |

Buildings in forest require surrounding trees to be felled first.

### Weapons & armor
- 34 weapons across melee (7), ranged (8), magic wands & staffs (9), with 4 rarity tiers
- 9 armor pieces providing defense (reduces incoming damage; defense also gives a chance to fully block a hit — `armorBlockChance` in `PlayerCombat.js`)
- Every armor has a unique **ability** (`ability` in `src/config/armor.js`): passive buffs (move speed, dodge cooldown, regen speed) and on-block effects — knockback/damage pulses with burn, frost, root, or pull; heal-on-block; riposte (block resets attack cooldown); extra block i-frames. Epic+ armors shed ambient particles (`updateArmorPassiveFX` in `PlayerCombat.js`)
- Shop unlocked at base level 4; shop tier scales with base level
- Weapons also found in chests

### Weapon upgrades
On level-up the player picks from 3 random upgrades (`src/config/weaponUpgrades.js`): generic tiers plus **unique upgrades per weapon** (2 epic + 2 legendary each). Effects span melee (combo damage, barrier-on-kill, beams, novas, execute…), ranged (pierce, bounce/chain/power arrows, gravity arrows…), and magic (bigger AoE, extra chains, seeker orbs, spell echo, singularity…). Upgrades carry a `vfxCol` woven into the held weapon's glow.

### Mounts
- 3 mounts (`src/config/mounts.js`) sold in the shop's Stable tab: Dun Pony (+35% speed), Chestnut Courser (+65%), Ember Warhorse (+100%)
- A mount multiplies walk and sprint speed and raises the rider by its `lift` (px). The steed draws inside the player's render transform (`Renderer.js`), so the body and held weapon ride it automatically; arrow/spell spawn origins add `playerMountLift()` (`src/systems/economy/MountSystem.js`)
- Owned mounts toggle ride/stable in the shop or with H in the field; no riding in the mine or while climbing walls
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

Meta data persisted in localStorage (`kingdom_embers_meta_v1`). Applied at game start via `applyPermanentUpgrades()`. In the hub, Enter/Space warps the player to the run portal to start the next run.

## Save system

Auto-saves every 5 seconds to localStorage (`kingdom_embers_save_v1`). Saves full game state: clock, player, base, walls, buildings, units, vagrants, forest trees, farm, skill points. Continue button on start screen if save exists.

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
| G | Sound the war horn (portal assault) |
| I | Inventory |
| +/−/0 | Zoom in/out/reset |
| M | Mute |
| P | Dev panel |
| Esc | Pause / close menus |
| Mouse wheel | Zoom |
