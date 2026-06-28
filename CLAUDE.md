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
- `state` — all mutable entity arrays (player, units, enemies, coins, walls, etc.)

Every module imports these directly; nothing is passed as arguments through update calls.

### Directory layout

| Path | Purpose |
|------|---------|
| `src/config/` | Pure data: `config.js` (CFG constants, WALL_SLOTS, PORTALS), `weapons.js`, `armor.js`, `enemies.js`, `locations.js` |
| `src/entities/` | Factory functions: `makePlayer()`, `makeUnit()`, `makeWall()` |
| `src/systems/` | Stateless update functions: `AI.js`, `Combat.js`, `Economy.js`, `SpawnSystem.js`, `Audio.js`, `Input.js`, `SaveSystem.js` |
| `src/rendering/` | Canvas drawing: `Renderer.js` (main draw), `HUD.js` (DOM HUD + DEV panel), `Effects.js` (particles, biomes, trees), `Sprites.js` (sprite loader, currently disabled) |
| `src/util/math.js` | Pure math helpers: `clamp`, `dist`, `lerp`, `rand`, `randInt`, `pick`, `pickR`, `mulberry32` |
| `src/canvas.js` | Canvas element, 2D context, and `resize()` |

### Key patterns

- **No circular imports**: `game.js` is the only file that imports from multiple layers. `AI.js` needs `keys` (from `Input.js`) — this is bridged via `window._KEYS` to avoid a cycle.
- **World coordinates**: The world is 14 000 px wide; the base sits at x=7000. Camera offset (`Game.cam`) is applied in the renderer. All entity positions are in world space.
- **Day/night cycle**: `Game.time` runs 0→1 over `CFG.dayLength` seconds. Night is `time > 0.65 && time <= 0.93`. Enemies spawn from portals at night according to a pre-planned quota (`planNight()` in `SpawnSystem.js`).
- **Stations**: Interactive ground markers (base, bow shop, hammer shop, farm, wall slots) are rebuilt each time the base upgrades via `buildStations()` in `game.js`. Payment is handled by `Economy.js` when the player holds `↓`/`S` nearby.
- **Sprites disabled**: `loadSprites()` is commented out in `game.js`. All rendering is procedural (canvas 2D shapes). The `assets_temp/` folder contains Kenney tile assets for future use.
- **Save system**: Auto-saves to `localStorage` every 5 seconds via `SaveSystem.js`.
