# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

Serve with any static HTTP server from the repo root (no build step):

```
python -m http.server 8000
```

Then open `http://localhost:8000/` in Chrome. The entry point is `index.html`, which loads `src/game.js` as an ES module.

There are no dependencies, no bundler, no package.json, and no test suite.

## Dev tools (in-game)

Press `P` to open the dev panel. It exposes:
- Gold injection, time skips (including jump to day 10/15/20)
- Base upgrade, enemy spawning, god mode
- Weapon/armor grants, speed multiplier

The `DEV` object is defined in `src/rendering/HUD.js` and exposed on `window`.

## Architecture

### Module graph

`src/game.js` is the orchestrator — it owns the game loop (`requestAnimationFrame`), calls all `update*` functions each tick, and wires up keyboard/mouse/button events. Everything else is a pure subsystem.

**Shared state** lives in `src/state.js` as two exported objects:
- `Game` — singleton game-clock and UI flags (day, phase, menus open, camera, etc.)
- `state` — all mutable entity arrays (player, units, enemies, coins, walls, loot items, etc.)

Every module imports these directly; nothing is passed as arguments through update calls. Module interdependencies are managed via callback registration functions to avoid circular imports.

### Directory layout

| Path | Purpose |
|------|---------|
| `src/config/` | Pure data: `config.js` (CFG constants, WALL_SLOTS, PORTALS, STATIONS_X), `weapons.js`, `armor.js`, `enemies.js`, `locations.js`, `archerSkills.js` |
| `src/entities/` | Factory functions: `Player.js`, `Unit.js`, `Wall.js` |
| `src/systems/` | Game logic and update functions |
| `src/rendering/` | Canvas drawing: `Renderer.js` (main draw), `HUD.js` (DOM HUD + DEV panel), `Effects.js` (particles, biomes, trees) |
| `src/util/` | Pure utilities: `math.js` (clamp, dist, lerp, rand, etc.), `GameStateHelpers.js`, `EnemyUtils.js` |
| `src/canvas.js` | Canvas element, 2D context, and `resize()` |

#### Systems breakdown

| System | Purpose |
|--------|---------|
| `GameInit.js` | Game initialization and station building (`buildStations()`) |
| `InputHandler.js` | Event listener setup for buttons, keyboard, and mouse |
| `Input.js` | Keyboard state tracking (keys object) |
| `SpawnSystem.js` | Entity spawning: enemies, coins, particles, animals, loot, locations |
| `AI.js` | Unit AI, targeting, assignments, caltrop placement |
| `Combat.js` | Enemy movement, arrow/spell updates, legendary boss attacks, poison effects |
| `PlayerCombat.js` | Player melee attacks, projectiles via `shootArrow()` and `castSpell()` |
| `ProjectileSystem.js` | Arrow physics and enemy impact logic |
| `SpellSystem.js` | Spell casting and AoE effects (chain lightning, fireburst, etc.) |
| `EnemyAI.js` | Enemy behavior and decision-making |
| `BossAI.js` | Legendary boss-specific behavior and attacks |
| `LootSystem.js` | Loot items, chests, weapon pickups, and item physics |
| `ShopSystem.js` | Weapon and armor shop management and purchasing |
| `UpgradeSystem.js` | Player leveling, skill tree upgrades, and weapon progression |
| `LocationSystem.js` | Location spawning, respawning, exploration, and loot drops |
| `Economy.js` | Payment handling at stations (upgrades, bow recruitment, etc.) |
| `SpawnSystem.js` | Night planning, enemy wave quotas |
| `SaveSystem.js` | Auto-save to localStorage |
| `Audio.js` | Sound effects and music |

### Key patterns

- **Callback registration for dependency injection**: Modules register callbacks via functions like `setPickupWeapon()`, `setBuildStations()`, and `setAddXP()` to pass functions to other modules without creating circular imports. The main module (`game.js`) wires these up at startup.
- **Window globals for cross-module access**: Global state and functions are exposed via `window` (e.g., `window._KEYS`, `window._DEV_GOD_MODE`, `window._WEAPON_SHOP`) to avoid circular import chains. These are primarily used by AI systems and the dev panel.
- **World coordinates**: The world is 14,000 px wide; the base sits at x=7000. Camera offset (`Game.cam`) is applied in the renderer. All entity positions are in world space.
- **Day/night cycle**: `Game.time` runs 0→1 over `CFG.dayLength` seconds. Night phases are defined by `CFG.phases.dusk` and `CFG.phases.night`. Enemies spawn from portals at night according to a pre-planned quota via `planNight()` in `SpawnSystem.js`.
- **Stations and economy**: Interactive ground markers (base, bow shop, armor shop, wall slots) are rebuilt each time the base upgrades via `buildStations()` in `GameInit.js`. Payment is handled by `Economy.js` when the player holds `↓`/`S` nearby.
- **Entity spawning**: All particles, coins, enemies, and loot are spawned through `SpawnSystem.js` functions to maintain a single source of truth for entity creation.
- **Save system**: Auto-saves to `localStorage` every 5 seconds via `SaveSystem.js`.
- **Loot and location system**: Locations are spawned dynamically, fade when near the player, and respawn at intervals. Looted items and defeated boss loot are dropped at the location and can be picked up.
