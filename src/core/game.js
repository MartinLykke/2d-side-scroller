"use strict";

// ---------- Bootstrap ----------
import { CFG, WALL_SLOTS, PORTALS, STATIONS_X, FOREST } from '../config/config.js';
import { ARMORS } from '../config/armor.js';
import { clamp, clampCameraTarget, dist, lerp, rand } from '../util/math.js';
import { ctx, W, H, groundY, resize } from './canvas.js';
import { Game, state } from './state.js';

import { Audio } from '../systems/infrastructure/Audio.js';
import { keys } from '../systems/input/Input.js';
import { saveGame, hasSave, loadGame, deleteSave } from '../systems/infrastructure/SaveSystem.js';
import { updateSpawning, floaty, spawnParticles, planNight, spawnEnemy, portalGuardianWave } from '../systems/world/SpawnSystem.js';
import { updatePayment, updateCoins } from '../systems/economy/Economy.js';
import { updateForestTrees, updateForestCamps } from '../systems/world/ForestSystem.js';
import { updateBuildings } from '../systems/world/OutpostSystem.js';
import { updateUnits, updateAssignments, updateVagrants, updateAnimals, nearestEnemy, updateCaltrops } from '../systems/ai/AI.js';
import { updateEnemies, updateArrows, updatePlayerAttack, updateSpells } from '../systems/combat/Combat.js';
import { updateFirePools } from '../systems/ai/BossAI.js';
import { updateDyingEnemies } from '../util/EnemyUtils.js';

import { initFX, updateFX as updateFXEffects, biomeAt } from '../rendering/Effects.js';
import { render } from '../rendering/Renderer.js';
import { UI, DEV } from '../rendering/HUD.js';
import { updateArcherShoot } from '../rendering/sprites/Archer.js';

import { makePlayer } from '../entities/Player.js';
import { makeWall, wallReady, wallBackDir, wallLayout, wallClimbX, nearWallClimbBottom, nearWallClimbTop } from '../entities/Wall.js';
import { makeUnit } from '../entities/Unit.js';

import { WEAPON_SHOP, ARMOR_SHOP, updateShop, setPickupWeapon as setShopPickupWeapon } from '../systems/economy/ShopSystem.js';
import { updateCastleUpgradeMenu } from '../systems/economy/CastleUpgradeSystem.js';
import { mountSpeedMult, activeMount } from '../systems/economy/MountSystem.js';
import { upgradeBase, pickupWeapon, setBuildStations } from '../util/GameStateHelpers.js';
import { currentCoinCap } from '../util/DefenseStats.js';
import { addXP, checkUpgrade } from '../systems/economy/UpgradeSystem.js';
import { newGame, buildStations } from '../systems/infrastructure/GameInit.js';
import { initMeta, enterDeathHub, updateHub, updateHubTransition, renderHub, permanentDayLengthBonusSeconds } from '../systems/infrastructure/RoguelikeSystem.js';
import { applyDifficulty } from '../systems/infrastructure/DifficultySystem.js';
import { updateLootItems, updateWeaponPickup, updateChests, updateLootPhysics, setPickupWeapon as setLootPickupWeapon } from '../systems/economy/LootSystem.js';
import { updateAssault, performPhaseShift } from '../systems/world/AssaultSystem.js';
import { setupInputHandlers } from '../systems/input/InputHandler.js';
import { provide } from './services.js';
// Profiler uses window._perf (set by HUD toggle) to avoid ES module cache issues

// Setup callbacks between modules to avoid circular dependencies
setBuildStations(buildStations);
setShopPickupWeapon(pickupWeapon);
setLootPickupWeapon(pickupWeapon);

provide('keys', keys);
provide('godMode', false);
provide('floaty', floaty);
provide('weaponShop', WEAPON_SHOP);
provide('armorShop', ARMOR_SHOP);
provide('upgradeBase', upgradeBase);
provide('pickupWeapon', pickupWeapon);
provide('addXP', addXP);
provide('enterDeathHub', enterDeathHub);

// ---------- Update ----------
function updateTime(dt) {
  const timeScale = Game.isNight && Game.nightCleared ? (CFG.nightClearTimeScale || 1) : 1;
  const daylightBonus = permanentDayLengthBonusSeconds();
  const dayLength = !Game.isNight && Game.time <= CFG.phases.dusk
    ? CFG.dayLength + daylightBonus / CFG.phases.dusk
    : CFG.dayLength;
  Game.time += (dt / dayLength) * timeScale;
  if (Game.isNight && Game.nightCleared && Game.time > CFG.phases.night) {
    Game.time = 1;
  }
  if (Game.time >= 1) { Game.time -= 1; Game.day++; planNight(); ensureMorningFarmer(); }
  const t = Game.time;
  const nowNight = t > CFG.phases.dusk && t <= CFG.phases.night;
  if (nowNight && !Game.isNight) {
    Game.isNight=true; Game.nightCleared=false; Audio.horn(); Audio.portalSpawn(); Audio.setNight(true); startNightPortalWarning();
  }
  if (!nowNight && Game.isNight) {
    Game.isNight=false; Game.nightCleared=false; Audio.setNight(false); state.enemies.forEach(e=>e.fleeing=true);
  }
}

function ensureMorningFarmer() {
  if (!state.farmBuilt && (state.farmLevel || 0) <= 0) return;
  const hasAliveFarmer = state.units.some(u => u.role === "farmer" && u.hp > 0 && !u.dying);
  if (hasAliveFarmer) return;

  const farmer = makeUnit("farmer", STATIONS_X.farm + rand(-24, 24));
  farmer.transform = 0.55;
  farmer.workTimer = 0;
  state.units.push(farmer);
  if (state.pendingFarmers > 0) state.pendingFarmers--;
  spawnParticles(farmer.x, groundY - 28, 12, "#9bd05a", 65, 80);
  floaty(farmer.x, "A farmer arrives", "#9bd05a");
}

function updateNightClear() {
  if (!Game.isNight || Game.nightCleared || Game.nightSpawned < Game.nightQuota) return;
  const waveAlive = state.enemies.some(e => e.nightWave && !e.fleeing && !e.dying && e.hp > 0);
  if (waveAlive) return;
  Game.nightCleared = true;
  grantNightClearReward();
  floaty(state.base.x, "The wave is defeated - dawn approaches", "#ffd27a", 18);
}

const PLAYER_WALL_CLIMB_SPEED = 0.95;

function playerArmorAbility(player) {
  return player?.armor ? ARMORS[player.armor]?.ability : null;
}

function armorMoveMult(player) {
  return playerArmorAbility(player)?.moveMult || 1;
}

function armorRegenMult(player) {
  return playerArmorAbility(player)?.regenMult || 1;
}

function grantNightClearReward() {
  const { player, base, walls, units } = state;
  if (!player || !base) return;

  const gold = Math.max(2, Math.round(2 + Game.day * 0.8 + Math.min(7, (Game.nightQuota || 0) * 0.035)));
  const room = Math.max(0, currentCoinCap() - player.coins);
  const paidGold = Math.min(room, gold);
  if (paidGold > 0) {
    player.coins += paidGold;
    floaty(player.x, "+" + paidGold + " gold", "#f2c14e");
  }

  let healed = false;
  if (player.hp < player.maxHp) {
    player.hp = Math.min(player.maxHp, player.hp + 1);
    player.hpShowTimer = Math.max(player.hpShowTimer || 0, 2.2);
    healed = true;
  }
  for (const u of units) {
    if (u.hp > 0 && !u.dying && u.hp < u.maxHp) {
      u.hp = Math.min(u.maxHp, u.hp + 1);
      healed = true;
    }
  }

  const repair = Math.max(6, Math.round(7 + Game.day * 0.9));
  let repaired = false;
  if (base.hp < base.maxHp) {
    base.hp = Math.min(base.maxHp, base.hp + repair);
    base.flash = Math.max(base.flash || 0, 0.18);
    repaired = true;
  }
  for (const w of walls) {
    if (!w.commissioned || w.buildProgress < 1 || w.hp <= 0 || w.hp >= w.maxHp) continue;
    w.hp = Math.min(w.maxHp, w.hp + Math.ceil(repair * 0.55));
    w.flash = Math.max(w.flash || 0, 0.16);
    repaired = true;
  }

  if (healed || repaired) {
    spawnParticles(base.x, groundY - 45, 20, "#9bd05a", 100, 105);
    floaty(base.x, "Morning morale restored", "#9bd05a");
  }
}

function startPlayerDodge(player, move) {
  if (player.onWall || (player.wallClimbT || 0) > 0.02) return false;
  if ((player.jumpH || 0) > 1 || (player.jumpVy || 0) > 0) return false;
  if ((player.dodgeCd || 0) > 0 || (player.dodgeT || 0) > 0) return false;

  player.dodgeDir = move || player.dir || 1;
  player.dodgeT = CFG.playerDodgeTime;
  player.dodgeCd = CFG.playerDodgeCooldown * (playerArmorAbility(player)?.dodgeCdMult || 1);
  player.dodgeNearMiss = false;
  player.invuln = Math.max(player.invuln || 0, CFG.playerDodgeInvuln);
  player.knock = 0;
  player.wall = null;
  player.onWall = false;
  player.climbingWall = false;
  spawnParticles(player.x - player.dodgeDir * 12, groundY - 8, 9, "#cfe6f2", 58, 38);
  spawnParticles(player.x - player.dodgeDir * 6, groundY - 5, 5, "#6b5a45", 42, 24);
  return true;
}

function startNightPortalWarning() {
  const warnT = CFG.nightPortalWarningTime || 0;
  if (warnT <= 0) return;
  Game.nightPortalWarnT = warnT;
  Game.spawnTimer = Math.max(Game.spawnTimer || 0, warnT);
  for (const p of state.portals) {
    floaty(p.x, "Portal flares!", "#ff8a3d", 15);
    spawnParticles(p.x, groundY - 60, 18, "#ff6a20", 105, 130);
    spawnParticles(p.x, groundY - 90, 8, "#ffd060", 70, 115);
  }
}

function updateNightPortalWarning(dt) {
  if (!Game.isNight || (Game.nightPortalWarnT || 0) <= 0) return;
  Game.nightPortalWarnT = Math.max(0, Game.nightPortalWarnT - dt);
  for (const p of state.portals) {
    if (Math.random() < 0.85) spawnParticles(p.x + rand(-26, 26), groundY - rand(18, 120), 1, "#ff6a20", 28, 54);
    if (Math.random() < 0.25) spawnParticles(p.x + rand(-20, 20), groundY - rand(40, 150), 1, "#ffd060", 18, 75);
  }
}

function grantDodgeRiposte(player, enemy) {
  player.dodgeNearMiss = true;
  player.riposteT = CFG.dodgeRiposteTime || 3;
  player.attackCd = 0;
  player.dodgeCd = Math.min(player.dodgeCd || 0, 0.35);
  Game.momentumTimer = Math.max(Game.momentumTimer || 0, 2.2);
  Game.momentumLevel = Math.max(Game.momentumLevel || 0, 1);
  floaty(player.x, "Riposte!", "#ffd23e", 18);
  spawnParticles(player.x, groundY - 38, 14, "#ffd23e", 84, 92);
  spawnParticles(enemy.x, groundY - 22 + (enemy.fy || 0), 7, "#cfe6f2", 48, 65);
}

function checkDodgeRiposte(player) {
  if (player.dodgeNearMiss) return;
  const range = CFG.dodgeRiposteRange || 76;
  for (const e of state.enemies) {
    if (e.fleeing || e.dying || e.hp <= 0) continue;
    if (dist(player.x, e.x) < range) {
      grantDodgeRiposte(player, e);
      return;
    }
  }
}

function nearestPlayerWallAccess(player) {
  let best = null, bd = 1e9;
  for (const w of state.walls) {
    if (!wallReady(w) || !nearWallClimbBottom(w, player.x)) continue;
    const d = Math.abs(player.x - wallLayout(w).accessBottomX);
    if (d < bd) { bd = d; best = w; }
  }
  return best;
}

function updatePlayerWallClimb(player, dt, upHeld, downHeld) {
  const accessWall = nearestPlayerWallAccess(player);
  const oldWall = wallReady(player.wall) ? player.wall : null;
  const oldT = player.wallClimbT || (player.onWall ? 1 : 0);
  let wall = oldWall && oldT > 0.02 ? oldWall : accessWall;

  if (!wall) {
    player.wall = null;
    player.onWall = false;
    player.wallClimbT = 0;
    player.climbingWall = false;
    player.wallClimbTarget = 0;
    return false;
  }

  if (player.wall !== wall) {
    player.wall = wall;
    player.wallClimbT = 0;
    player.onWall = false;
    player.wallClimbTarget = 0;
  }

  const cur = player.wallClimbT || 0;
  const midClimb = cur > 0.02 && cur < 0.98;
  if (upHeld && ((cur <= 0.02 && nearWallClimbBottom(wall, player.x)) || midClimb)) {
    player.wallClimbTarget = 1;
  }
  if (downHeld && (midClimb || (cur >= 0.98 && nearWallClimbTop(wall, player.x)))) {
    player.wallClimbTarget = 0;
  }

  const target = player.wallClimbTarget ?? (player.onWall ? 1 : 0);
  const movingVertically = Math.abs(target - cur) > 0.002;
  if (movingVertically) {
    const step = PLAYER_WALL_CLIMB_SPEED * dt * Math.sign(target - cur);
    player.wallClimbT = clamp(cur + step, 0, 1);
    if (Math.abs(player.wallClimbT - target) < 0.03) player.wallClimbT = target;
    player.x = wallClimbX(wall, player.wallClimbT);
    player.vx = 0;
    player.jumpH = 0;
    player.jumpVy = 0;
    player.dir = wallBackDir(wall);
    player.bob = 0;
    player.climbAnim = (player.climbAnim || 0) + dt * 8;
  }

  player.onWall = (player.wallClimbT || 0) >= 0.98;
  player.climbingWall = movingVertically && !player.onWall;
  if (player.onWall && (player.wallClimbTarget ?? 1) === 1) {
    const layout = wallLayout(wall);
    player.x = clamp(player.x, layout.walkMinX, layout.walkMaxX);
  }
  if ((player.wallClimbT || 0) <= 0.02 && target === 0 && !upHeld) {
    player.wallClimbT = 0;
    player.onWall = false;
    player.climbingWall = false;
    player.wallClimbTarget = 0;
    if (accessWall !== wall) player.wall = null;
  }
  return player.climbingWall;
}

function updatePlayer(dt) {
  const { player } = state;
  const left=keys["a"]||keys["arrowleft"], right=keys["d"]||keys["arrowright"], sprint=keys["shift"];
  const up=keys["w"]||keys["arrowup"], down=keys["s"]||keys["arrowdown"];
  const dodgeHeld=keys["x"]||keys["control"];
  if (player.mudSlow > 0) player.mudSlow = Math.max(0, player.mudSlow - dt);
  const mudMult = player.mudSlow > 0 ? 0.55 : 1;
  const speed=(sprint?CFG.playerSprint:CFG.playerSpeed)*mountSpeedMult(player)*armorMoveMult(player)*mudMult;
  let move=0; if (left) move-=1; if (right) move+=1;
  player.dodgeCd = Math.max(0, (player.dodgeCd || 0) - dt);
  if (dodgeHeld && !player.dodgeLatch) startPlayerDodge(player, move);
  player.dodgeLatch = !!dodgeHeld;

  const dodging = (player.dodgeT || 0) > 0;
  if (dodging) {
    player.dodgeT = Math.max(0, player.dodgeT - dt);
    const t = CFG.playerDodgeTime > 0 ? player.dodgeT / CFG.playerDodgeTime : 0;
    const dodgeSpeed = CFG.playerDodgeSpeed * (0.45 + 0.55 * t);
    player.vx = (player.dodgeDir || player.dir || 1) * dodgeSpeed;
    player.dir = player.dodgeDir || player.dir || 1;
    player.invuln = Math.max(player.invuln || 0, 0.08);
    if (Math.random() < 0.55) spawnParticles(player.x - player.dir * 16, groundY - 6, 1, "#c9b48a", 24, 15);
  } else {
    player.vx=move*speed;
    if (move!==0) player.dir=move;
  }

  player.x=clamp(player.x+player.vx*dt, 120, CFG.worldWidth-120);
  if (dodging) checkDodgeRiposte(player);

  const strideTarget = dodging ? 20 : move!==0 ? (sprint?16:10) : 0;
  player.strideRate = (player.strideRate||0) + (strideTarget-(player.strideRate||0))*Math.min(1,dt*8);
  player.gallop += dt*player.strideRate;
  // Hoof dust kicked up behind a galloping mount
  if (activeMount(player) && move!==0 && (player.jumpH||0)<=0 && Math.random() < (sprint?14:5)*dt) {
    spawnParticles(player.x - player.dir*20, groundY - 4, 1, "#c9b48a", 28, 18);
  }
  // Walk bob is animated inside the sprite (torso/head only, feet planted);
  // translating the whole body here doubled the motion and caused sub-pixel shimmer.
  player.bob*=Math.exp(-9*dt);
  if (player.knock) {
    player.x=clamp(player.x+player.knock*dt,120,CFG.worldWidth-120);
    player.knock*=0.86;
    if (Math.abs(player.knock)<6) player.knock=0;
  }
  const climbing = dodging ? false : updatePlayerWallClimb(player, dt, up, down);
  if (!dodging && !climbing && (keys[" "] || keys["space"]) && player.jumpH <= 0 && player.jumpVy <= 0) {
    player.jumpVy = 560;
  }
  player.jumpH += player.jumpVy * dt;
  player.jumpVy -= 1400 * dt;
  if (player.jumpH <= 0) { player.jumpH = 0; if (player.jumpVy < 0) player.jumpVy = 0; }
  if (player.invuln>0) player.invuln-=dt;
  if (player.hurt>0) player.hurt-=dt;
  if (player.riposteT>0) player.riposteT-=dt;
  if (player.hpShowTimer>0) player.hpShowTimer-=dt;
  if (player.hp<player.maxHp) {
    if (!nearestEnemy(player.x,220)) {
      const regenTime = CFG.playerRegenTime * (1 - (player.permanentRegenBonus || 0)) * armorRegenMult(player);
      player.regen+=dt;
      if (player.regen>=Math.max(2.5, regenTime)) { player.regen=0; player.hp++; floaty(player.x,"+❤","#e0556a"); }
    }
    else player.regen=0;
  }
}

function updateParticles(dt) {
  const { particles } = state;
  for (let i=particles.length-1;i>=0;i--) {
    const p=particles[i];
    if (p.fly) {
      p.t += dt / p.life;
      const t = clamp(p.t, 0, 1);
      p.x = lerp(p.fromX, p.toX, t);
      p.y = lerp(p.fromY, p.toY, t) - Math.sin(t * Math.PI) * 50;
      if (p.t >= 1) { particles[i] = particles[particles.length - 1]; particles.pop(); }
      continue;
    }
    p.life-=dt;
    if (p.rot !== undefined) p.rot += (p.spin || 0) * dt;
    if (p.settled) {
      if (p.life<=0) { particles[i] = particles[particles.length - 1]; particles.pop(); }
      continue;
    }
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=(p.gravity ?? 240)*dt;
    if (p.drag) {
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy *= Math.max(0, 1 - p.drag * 0.22 * dt);
      if (Math.abs(p.vx) < 0.5) p.vx = 0;
    }
    if (p.groundY !== undefined && p.y >= p.groundY) {
      p.y = p.groundY;
      if (p.bounce && Math.abs(p.vy) > 90) {
        p.vy = -p.vy * p.bounce;
        p.vx *= 0.68;
        p.bounce *= 0.5;
      } else if (p.stain) {
        p.settled = true;
        p.vx = 0; p.vy = 0;
        p.life = Math.max(p.life, p.stainLife || 1.8);
        p.maxLife = Math.max(p.maxLife || 0, p.life);
        p.size *= p.stainScale || 1.6;
      } else {
        p.vx *= 0.35;
        p.vy = 0;
      }
    }
    if (p.life<=0) { particles[i] = particles[particles.length - 1]; particles.pop(); }
  }
}

function updateFloats(dt) {
  const { floatTexts } = state;
  for (let i=floatTexts.length-1;i>=0;i--) {
    const f=floatTexts[i]; f.life-=dt; f.y+=f.vy*dt; f.vy*=0.96;
    if (f.life<=0) { floatTexts[i] = floatTexts[floatTexts.length - 1]; floatTexts.pop(); }
  }
}

function updateMomentum(dt) {
  if ((Game.killStreakTimer || 0) > 0) {
    Game.killStreakTimer = Math.max(0, Game.killStreakTimer - dt);
    if (Game.killStreakTimer <= 0) Game.killStreak = 0;
  }
  if ((Game.momentumTimer || 0) > 0) {
    Game.momentumTimer = Math.max(0, Game.momentumTimer - dt);
    if (Game.momentumTimer <= 0) Game.momentumLevel = 0;
  }
}

function updateCamera() {
  const zoom = Game.zoom;
  const target=clampCameraTarget(state.player.x-W/2, CFG.worldWidth, W, zoom);
  Game.cam+=(target-Game.cam)*0.12;
}

function updatePortals() {
  if (Game.isNight) return;
  const { portals, player } = state;
  for (const p of portals) {
    if (p.destroyed) continue;
    if ((p.lastDayActivated||0) >= Game.day) continue;
    if (dist(player.x, p.x) < 300) {
      p.lastDayActivated = Game.day;
      const wave = portalGuardianWave();
      for (const type of wave) {
        const guardian = spawnEnemy(type, p);
        guardian.portalGuardian = true;
      }
    }
  }
}

function checkEndConditions() {
  const { base, player } = state;
  if (base.hp<=0 && Game.state==="play") {
    Game.state="defeat-pan";
    Game.defeatText="Your castle was razed to the ground. Darkness swallows the kingdom.";
    Game.defeatPanTimer=0;
    spawnParticles(base.x, groundY-60, 60, "#ff8a3d", 260, 320);
    spawnParticles(base.x, groundY-60, 40, "#ffd27a", 200, 260);
    spawnParticles(base.x, groundY-60, 50, "#5a5260", 300, 200);
    Game.screenShake = Math.max(Game.screenShake, 1);
    return;
  }
  if (player.hp<=0 && Game.state==="play") {
    Game.state="player-death";
    Game.deathTimer=0;
    Game.defeatText="The monarch fell in battle, and the crown rolled into the dirt. The kingdom is lost.";
    player.vx=0; player.swing=0; player.knock=0; player.hurt=0;
    Audio.death();
    spawnParticles(player.x, groundY-40, 26, "#a4262b", 190, 210);
    spawnParticles(player.x, groundY-40, 14, "#e0556a", 130, 170);
    spawnParticles(player.x, groundY-30, 18, "#d4a838", 110, 150); // the crown's gold scatters
    Game.screenShake = Math.max(Game.screenShake, 0.8);
    return;
  }
}

function updateAutosave(dt) {
  Game.autosaveTimer-=dt;
  if (Game.autosaveTimer<=0) { Game.autosaveTimer=5; saveGame(); }
}

function updateArcherAnimations(dt) {
  for (const u of state.units) {
    if (u.role === "archer") {
      updateArcherShoot(u, dt);
    }
  }
  updateArcherShoot(state.player, dt);
}

function update(dt) {
  const p = window._perf;
  if(p) p.begin("update.time");
  updateTime(dt);
  if(p) p.end("update.time");

  if(p) p.begin("update.player");
  updatePlayer(dt);
  updatePlayerAttack(dt);
  if(p) p.end("update.player");

  if(p) p.begin("update.economy");
  updatePayment(dt);
  if(p) p.end("update.economy");

  if(p) p.begin("update.forest");
  updateForestTrees(dt);
  updateForestCamps(dt);
  if(p) p.end("update.forest");

  if(p) p.begin("update.buildings");
  updateBuildings(dt);
  if(p) p.end("update.buildings");

  if(p) p.begin("update.units");
  updateVagrants(dt);
  updateAssignments();
  updateUnits(dt);
  updateArcherAnimations(dt);
  updateAnimals(dt);
  if(p) p.end("update.units");

  if(p) p.begin("update.portals");
  updatePortals();
  updateNightPortalWarning(dt);
  updateAssault(dt);
  if(p) p.end("update.portals");

  if(p) p.begin("update.enemies");
  updateCaltrops(dt);
  updateEnemies(dt);
  updateDyingEnemies(dt);
  updateFirePools(dt);
  if(p) p.end("update.enemies");

  if(p) p.begin("update.combat");
  updateArrows(dt);
  updateSpells(dt);
  if(p) p.end("update.combat");

  if(p) p.begin("update.loot");
  updateCoins(dt);
  updateLootItems(dt);
  updateChests(dt);
  updateLootPhysics(dt);
  updateWeaponPickup(dt);
  if(p) p.end("update.loot");

  if(p) p.begin("update.fx");
  updateParticles(dt);
  if (Game.screenShake > 0) Game.screenShake = Math.max(0, Game.screenShake - dt * 9);
  updateFloats(dt);
  if(p) p.end("update.fx");

  updateMomentum(dt);
  updateSpawning(dt);
  updateNightClear();
  checkUpgrade();
  updateShop();
  updateCastleUpgradeMenu();
  updateCamera();
  Audio.updateAmbientZones(state.player.x, CFG.baseX, FOREST.startDist);
  checkEndConditions();
  updateAutosave(dt);
}

// ---------- Game flow ----------
Game.start = function(continueGame) {
  Audio.init(); Audio.resume();
  const activeDiff = document.querySelector('.diff-btn.diff-active');
  const diff = activeDiff ? activeDiff.dataset.diff : 'normal';
  applyDifficulty(Game, diff);
  if (continueGame && hasSave()) { newGame(); loadGame(); }
  else newGame();
  import('../rendering/Effects.js').then(({clearTreeCache})=>clearTreeCache());
  Game.state="play";
  UI.startScreen.classList.add("hidden");
  UI.endScreen.classList.add("hidden");
  UI.hud.classList.remove("hidden");
  UI.refresh();
};

Game.togglePause = function() {
  if (Game.state==="play") { Game.state="pause"; UI.pauseScreen.classList.remove("hidden"); }
  else if (Game.state==="pause") { Game.state="play"; UI.pauseScreen.classList.add("hidden"); }
};

function endGame(text) {
  deleteSave();
  enterDeathHub(text);
}

function startRunFromPortal() {
  Game.start(false);
  Game.runStartAnim = 1.05;
  if (state.player) {
    state.player.invuln = Math.max(state.player.invuln || 0, 1);
    spawnParticles(state.player.x, groundY - 55, 34, "#8fd8ff", 160, 150);
    spawnParticles(state.player.x, groundY - 55, 16, "#d8f6ff", 90, 180);
  }
}

function drawRunStartOverlay(dt) {
  if (!Game.runStartAnim || Game.runStartAnim <= 0 || !state.player) return;
  const duration = 1.05;
  const t = clamp(1 - Game.runStartAnim / duration, 0, 1);
  const zoom = Game.zoom || 1;
  const sx = W / 2 + zoom * (state.player.x - W / 2 - Game.cam);
  const sy = groundY - 55;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const rg = ctx.createRadialGradient(sx, sy, 8, sx, sy, 260 * (1 - t) + 30);
  rg.addColorStop(0, `rgba(235,252,255,${0.72 * (1 - t)})`);
  rg.addColorStop(0.28, `rgba(90,190,255,${0.45 * (1 - t)})`);
  rg.addColorStop(1, "rgba(40,80,255,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  if (t < 0.22) {
    ctx.fillStyle = `rgba(235,252,255,${(0.22 - t) / 0.22 * 0.75})`;
    ctx.fillRect(0, 0, W, H);
  }
  Game.runStartAnim = Math.max(0, Game.runStartAnim - dt);
}

// Phase 2 transition: flash rises over the old world, the shift happens at
// full white, then the fade-out reveals the remade land plus the title card.
const PHASE_FLASH_IN = 0.8, PHASE_FLASH_OUT = 1.8, PHASE_TOTAL = 4.6;

function updatePhaseTransition(dt) {
  const pt = Game.phaseTransition;
  if (!pt) return;
  pt.t += dt;
  if (!pt.swapped && pt.t >= PHASE_FLASH_IN) {
    pt.swapped = true;
    performPhaseShift();
  }
  if (pt.t >= PHASE_TOTAL) Game.phaseTransition = null;
}

function drawPhaseOverlay() {
  const pt = Game.phaseTransition;
  if (!pt) return;
  const a = pt.t < PHASE_FLASH_IN
    ? pt.t / PHASE_FLASH_IN
    : Math.max(0, 1 - (pt.t - PHASE_FLASH_IN) / PHASE_FLASH_OUT);
  if (a > 0) {
    ctx.fillStyle = `rgba(214,196,255,${a})`;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(255,255,255,${a * 0.6})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (pt.swapped && pt.t > PHASE_FLASH_IN + 0.3) {
    const ta = clamp((pt.t - PHASE_FLASH_IN - 0.3) / 0.5, 0, 1) * clamp((PHASE_TOTAL - pt.t) / 0.8, 0, 1);
    const bi = biomeAt(CFG.baseX);
    const hollow = (Game.worldPhase || 1) >= 2;
    const title = hollow ? "PHASE II" : bi.name.toUpperCase();
    const subtitle = hollow
      ? "The Hollow has awakened - new horrors stir in the night"
      : "The world has shifted into " + bi.name;
    ctx.save();
    ctx.globalAlpha = ta;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "600 42px Georgia, serif";
    ctx.fillText(title, W / 2 + 2, H * 0.3 + 2);
    ctx.fillStyle = "#d8c9ff";
    ctx.fillText(title, W / 2, H * 0.3);
    ctx.font = "20px Georgia, serif";
    ctx.fillStyle = "#b9a8d8";
    ctx.fillText(subtitle, W / 2, H * 0.3 + 36);
    ctx.restore();
  }
}

function drawDeathOverlay() {
  if (Game.state !== "player-death") return;
  const t = Game.deathTimer || 0;

  // blood-red vignette closing in
  const v = clamp(t / 0.6, 0, 1);
  const rg = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.9);
  rg.addColorStop(0, "rgba(0,0,0,0)");
  rg.addColorStop(1, `rgba(80,4,14,${0.6 * v})`);
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);

  // fade to black before the hub
  const f = clamp((t - 2.4) / 1.0, 0, 1);
  if (f > 0) { ctx.fillStyle = `rgba(6,4,10,${f})`; ctx.fillRect(0, 0, W, H); }

  // title
  if (t > 0.9) {
    const a = clamp((t - 0.9) / 0.7, 0, 1) * (1 - f);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "600 38px Georgia, serif";
    ctx.fillText("The monarch has fallen", W / 2 + 2, H * 0.34 + 2);
    ctx.fillStyle = "#e8d8b8";
    ctx.fillText("The monarch has fallen", W / 2, H * 0.34);
    if (t > 1.5) {
      ctx.globalAlpha = clamp((t - 1.5) / 0.6, 0, 1) * (1 - f) * 0.85;
      ctx.font = "20px Georgia, serif";
      ctx.fillStyle = "#c9b89a";
      ctx.fillText("The embers carry you onward…", W / 2, H * 0.34 + 36);
    }
    ctx.restore();
  }
}

// ---------- Main loop ----------
let last = performance.now();
let uiRefreshElapsed = 1;
function loop(now) {
  const frameDt = Math.max(0, (now - last) / 1000);
  last = now;
  let dt = clamp(frameDt, 0, 0.05);
  DEV.updateFps(frameDt);

  const _p = window._perf;
  if(_p) _p.beginFrame();

  const gdt = dt * DEV.speedMult;
  updateFXEffects(gdt);

  if (Game.state === "play") {
    if(_p) _p.begin("update");
    if (!Game.upgradeMenuOpen) update(gdt);
    updatePhaseTransition(gdt);
    if(_p) _p.end("update");
    uiRefreshElapsed += frameDt;
    if (uiRefreshElapsed >= 0.08) {
      uiRefreshElapsed = 0;
      UI.refresh();
    }
  } else {
    uiRefreshElapsed = 1;
  }
  if (Game.state === "hub") {
    updateHub(gdt, startRunFromPortal);
    UI.hud.classList.add("hidden");
    UI.prompt.classList.add("hidden");
  }
  if (Game.state === "hub-transition") {
    updateHubTransition(gdt, startRunFromPortal);
    if (Game.state === "hub-transition") {
      UI.hud.classList.add("hidden");
      UI.prompt.classList.add("hidden");
    }
  }
  if (Game.state === "player-death") {
    Game.deathTimer += dt;
    const sdt = gdt * 0.35;
    updateParticles(sdt);
    updateFloats(sdt);
    updateDyingEnemies(sdt);
    if (Game.screenShake > 0) Game.screenShake = Math.max(0, Game.screenShake - dt * 9);
    const zoom = Game.zoom;
    const target = clampCameraTarget(state.player.x - W / 2, CFG.worldWidth, W, zoom);
    Game.cam += (target - Game.cam) * Math.min(1, dt * 3);
    if (Game.deathTimer > 3.4) endGame(Game.defeatText);
  }
  if (Game.state === "defeat-pan") {
    Game.defeatPanTimer += dt;
    const zoom = Game.zoom;
    const target = clampCameraTarget(state.base.x - W / 2, CFG.worldWidth, W, zoom);
    Game.cam += (target - Game.cam) * Math.min(1, dt * 2.5);
    if (Game.defeatPanTimer > 2.2) endGame(Game.defeatText);
  }
  if(_p) _p.begin("render");
  if (Game.state === "hub" || Game.state === "hub-transition") renderHub();
  else if (Game.state !== "menu") render();
  else renderMenuBackground();
  drawRunStartOverlay(dt);
  drawPhaseOverlay();
  drawDeathOverlay();
  if(_p) _p.end("render");

  if(_p) _p.endFrame();
  requestAnimationFrame(loop);
}

function renderMenuBackground() {
  Game.time = (Game.time + 0.00004) % 1;
  if (!state.player) {
    state.player = makePlayer();
    state.base   = { x:CFG.baseX, level:1, hp:CFG.baseMaxHp[1], maxHp:CFG.baseMaxHp[1], paid:0, flash:0 };
    state.walls  = WALL_SLOTS.map(makeWall);
    state.units=[]; state.vagrants=[]; state.enemies=[]; state.coins=[]; state.goldCollectors=[];
    state.arrows=[]; state.animals=[]; state.particles=[]; state.floatTexts=[];
    state.portals=PORTALS.map(p=>({...p}));
  }
  render();
}

// ---------- Boot ----------
resize();
initFX();
initMeta();
Game.cam = clampCameraTarget(CFG.baseX - W/2, CFG.worldWidth, W, Game.zoom || 1);
setupInputHandlers();
if (hasSave()) document.getElementById("btn-continue")?.classList.remove("hidden");
requestAnimationFrame(loop);
