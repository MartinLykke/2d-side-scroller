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
- Enemy spawning (imp, flying imp, dragon, 8-imp wave, kill all)
- Unit spawning (archer, builder, farmer, guard)
- Weapon grants (short bow, lightning tome, meteor tome), drop weapon, god mode
- Speed multiplier (×1, ×2, ×4)
- Live stats: FPS, day/time, enemy/unit/coin/particle counts, player position

The `DEV` object is defined in `src/rendering/HUD.js` and exposed on `window`.

## Game overview

**Kingdom: Crown of Embers** — a roguelike tower defense where the player defends a base from nightly enemy waves, recruits units, explores locations, and earns permanent meta-progression (embers) across runs.

### Core loop

1. **Day phase** — explore, recruit units, build/upgrade walls and buildings, buy weapons, fell trees
2. **Night phase** — enemies spawn from portals, attack base and walls; player and units fight back
3. **Between runs** — on death, earn embers based on performance; spend on permanent upgrades in the hub

### World layout

- 9000 px wide; base at x ≈ 4500
- Two enemy portals at edges (x=500, x=8500)
- Four wall slots (2 per side) around base
- Dense forest across the map except near base; trees can be felled to clear building slots
- Locations (camps, ruins, caves, etc.) spawn procedurally outside the forest

### Day/night cycle

- Days are 200 seconds (`CFG.dayLength`). `Game.time` runs 0→1.
- Phases: Day (0–0.55), Dusk (0.55–0.68), Night (0.68–0.85), Dawn (0.85–1.0)
- Enemies spawn during night from portals via pre-planned quotas (`planNight()`)
- Enemies flee at dawn

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
| `src/config/` | Pure data: `config.js`, `weapons.js`, `armor.js`, `enemies.js`, `locations.js`, `archerSkills.js`, `guardSkills.js` |
| `src/entities/` | Factory functions: `Player.js`, `Unit.js`, `Wall.js` |
| `src/systems/ai/` | Unit AI (`AI.js`), enemy behavior (`EnemyAI.js`) |
| `src/systems/combat/` | Combat orchestrator (`Combat.js`), player attacks (`PlayerCombat.js`), arrows (`ProjectileSystem.js`), spells (`SpellSystem.js`) |
| `src/systems/world/` | Spawning (`SpawnSystem.js`), forests (`ForestSystem.js`), locations (`LocationSystem.js`), outposts/buildings (`OutpostSystem.js`) |
| `src/systems/economy/` | Payments (`Economy.js`), shops (`ShopSystem.js`), loot (`LootSystem.js`), upgrades/leveling (`UpgradeSystem.js`) |
| `src/systems/input/` | Keyboard state (`Input.js`), event listeners (`InputHandler.js`) |
| `src/systems/infrastructure/` | Save/load (`SaveSystem.js`), audio (`Audio.js`), game init (`GameInit.js`), roguelike meta (`RoguelikeSystem.js`) |
| `src/rendering/` | Main draw orchestrator (`Renderer.js`), DOM HUD (`HUD.js`), particles/biomes (`Effects.js`), draw helpers (`DrawHelpers.js`) |
| `src/rendering/sprites/` | Entity sprite renderers: `Player.js`, `Archer.js`, `Guard.js`, `Builder.js`, `Villager.js`, `Animals.js` |
| `src/rendering/scene/` | Scene renderers: `RenderWorld.js`, `RenderEntities.js`, `RenderItems.js`, `RenderEffects.js`, `RenderLocations.js`, `RenderUI.js` |
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
| Fire Dragon | 320 | Boss (night 5+), flying, drops rider imps, legendary attacks |

Enemies spawn from portals, advance toward base, stack on walls. Flee at dawn.

## Economy & progression

### Base (levels 1–4)
| Level | HP | Capacity | Unlocks |
|-------|-----|----------|---------|
| 1 | 60 | 8 | — |
| 2 | 90 | 16 | Shop, farm, hammer, lumber camps |
| 3 | 130 | 26 | Towers, shrine, guards |
| 4 | 180 | 40 | Free lumber |

### Stations
Payment-gated purchases: hold ↓/S near a station. Payment rate accelerates with hold time (1→2→6 coins/tick). Coins refund if player walks away before completing. Stations are rebuilt on each base upgrade via `buildStations()` in `GameInit.js`.

### Walls (4 slots, levels 1–5)
Health scales 45→320 HP. Cost: 6→14→22→35→55🪙. Archers stand on walls with capacity per level.

### Buildings (5 slots)
| Building | Count | Cost | Unlock | Effect |
|----------|-------|------|--------|--------|
| Lumber Camp | 2 | 14🪙 | Base 2 | Auto-mark trees; +2🪙 per delivered log |
| Tower | 2 | 18/26/40🪙 | Base 3 | Auto-shoot enemies in 430 px range |
| Shrine | 1 | 22🪙 | Base 3 | Heal player+units in 190 px radius every 3.5s |

Buildings in forest require surrounding trees to be felled first.

### Weapons & armor
- 34 weapons across melee (7), ranged (8), magic tomes (9), with 4 rarity tiers
- 8 armor pieces providing defense (reduces incoming damage)
- Shop unlocked at base level 4; shop tier scales with base level
- Weapons also found in location chests

### Skill trees (K to open)
**Archer** — 3 branches (Pilen, Buen, Taktik) + 2 ultimates (Master Shadows, Heavy Ballista)
**Guard** — 3 branches (Spyd, Skjold, Taktik) + 2 ultimates (Spear Titan, Fortress Guardian)

Skill points earned from upgrades and building construction.

## Combat

- **Melee**: hold mouse to swing; arc visual; cooldown from weapon speed
- **Ranged**: aim-and-release sequence
- **Magic (tomes)**: cast spell toward cursor
- **Crit**: 15% chance for 1.5× damage
- Archers: fire arrows (every 4th shot ignites), piercing, bouncing volley, double shot, powershot (3s charge → 3× damage)
- Guards: piercing thrust, whirlwind, shield bash, rally cry (+20% damage to allies)

## Locations & exploration

17 location types across 4 tiers (easy/medium/hard/epic). Spawn procedurally outside the forest. Trigger on approach (90–180 px detection radius). Grant XP, spawn enemies, drop chests with gold and weapons. Fade out at 900 px distance and respawn after 90–180s. Survivors (vagrants) can be rescued from locations.

## Roguelike meta-progression

On death, the player enters a hub and earns **embers** based on run performance (kills × multiplier). 11 permanent upgrades purchasable with embers:
- Stat boosts: +HP, +damage, +starting gold, +regen speed
- Starter bonuses: +vagrants, +free bow, +skill points, +starting gold burst
- Run reward scaling: +ember multiplier

Meta data persisted in localStorage (`kingdom_embers_meta_v1`). Applied at game start via `applyPermanentUpgrades()`.

## Save system

Auto-saves every 5 seconds to localStorage (`kingdom_embers_save_v1`). Saves full game state: clock, player, base, walls, buildings, units, vagrants, locations, forest trees, farm, skill points. Continue button on start screen if save exists.

## Controls

| Key | Action |
|-----|--------|
| A/D or ←/→ | Move |
| Shift | Sprint |
| Space | Jump |
| ↓/S (hold) | Pay/recruit at station |
| F | Pick up weapon / open chest |
| B | Open shop (near base, lvl 4) |
| T | Switch shop tabs |
| E/Enter | Buy selected item |
| K | Skill tree |
| Q | Unit ability (barrage / rally cry) |
| I | Inventory |
| +/−/0 | Zoom in/out/reset |
| M | Mute |
| P | Dev panel |
| Esc | Pause / close menus |
| Mouse wheel | Zoom |
