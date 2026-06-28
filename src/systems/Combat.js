import { CFG } from '../config/config.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { WEAPONS, effectiveWeapon } from '../config/weapons.js';
import { ARMORS } from '../config/armor.js';
import { clamp, dist, rand } from '../util/math.js';
import { groundY } from '../canvas.js';
import { Game, state } from '../state.js';
import { Audio } from './Audio.js';
import { spawnCoin, spawnParticles, floaty, spawnLocLoot } from './SpawnSystem.js';

// ---------- Arrow shooting ----------
// All callers shoot at enemies; hitKind defaults to "enemy".
// Flying enemies push "player"-targeted arrows directly into state.arrows.
export function shootArrow(x, y, target, sourceUnit = null) {
  const tx = target.x, ty = groundY - 24;
  const ang = Math.atan2(ty - y, tx - x);
  const sp  = 560;
  state.arrows.push({
    x, y,
    vx: Math.cos(ang) * sp,
    vy: Math.sin(ang) * sp,
    target,
    life: 1.2,
    hitKind: "enemy",
    sourceUnit,
  });
  Audio.bow();
}

export function updateArrows(dt) {
  const { arrows, enemies, animals, player } = state;
  for (let i = arrows.length - 1; i >= 0; i--) {
    const ar = arrows[i];
    ar.x += ar.vx * dt; ar.y += ar.vy * dt; ar.vy += 420 * dt; ar.life -= dt;
    let hit = false;

    if (ar.hitKind !== "player") {
      for (const e of enemies) {
        if (e.fleeing) continue;
        const et = ENEMY_TYPES[e.type];
        const enemyDrawY = et.flying ? groundY + (e.fy || -80) : groundY - 24;
        if (dist(ar.x, e.x) < et.w * 0.7 && Math.abs(ar.y - enemyDrawY) < 40) {
          e.hp--; e.flash = 0.12; Audio.hit();
          spawnParticles(e.x, enemyDrawY, 4, "#8a2a4a");
          hit = true;
          if (e.hp <= 0) {
            if (ar.sourceUnit) {
              // Archer kill: collect gold into unit, no coin drop
              ar.sourceUnit.gold = (ar.sourceUnit.gold || 0) + et.reward;
              spawnParticles(e.x, enemyDrawY, 12, et.color, 80, 100);
              Audio.enemyDie();
              if (window._addXP) window._addXP(et.reward * 8);
              if (e.locIdx !== undefined && state.locations[e.locIdx]) {
                const loc = state.locations[e.locIdx];
                loc.remainingEnemies--;
                if (loc.remainingEnemies <= 0 && !loc.lootSpawned) {
                  loc.cleared = true; loc.lootSpawned = true;
                  state.chests.push({ x: loc.x, lootGold: loc.lootGold, weaponId: loc.weaponId, open: false, openAnim: 0, life: 1 });
                  if (window._floaty) window._floaty(loc.x, "📦 Kiste!", "#f2c14e");
                }
              }
              if (state.legendaryBoss === e) { state.legendaryBoss = null; state.legendaryEffects = []; for (const u of state.units) u.rallied = false; }
              const idx = state.enemies.indexOf(e); if (idx >= 0) state.enemies.splice(idx, 1);
            } else {
              killEnemy(e);
            }
          }
          break;
        }
      }
    }

    if (!hit && ar.hitKind !== "player") {
      for (const a of animals) {
        if (a.alive && dist(ar.x, a.x) < 16 && ar.y > groundY - 36) {
          a.alive = false;
          spawnParticles(a.x, groundY - 20, 8, "#7a4a2a");
          const reward = a.type === "deer" ? 3 : 1;
          for (let k = 0; k < reward; k++) spawnCoin(a.x + rand(-15, 15), 1, groundY - 20, rand(-50, 50), rand(-220, -120));
          floaty(a.x, "+" + reward + "🪙", "#f2c14e");
          hit = true; break;
        }
      }
    }

    if (!hit && ar.hitKind === "player") {
      if (dist(ar.x, player.x) < 18 && Math.abs(ar.y - (groundY - 50)) < 50) {
        if (player.invuln <= 0 && !window._DEV_GOD_MODE) {
          player.hp -= 1; player.invuln = CFG.playerInvuln; player.hurt = 0.35;
          player.knock = (player.x < ar.x ? -1 : 1) * -120;
          spawnParticles(player.x, groundY - 50, 4, "#c1453b");
          Audio.hit();
        }
        hit = true;
      }
    }

    if (hit || ar.life <= 0 || ar.y > groundY - 6) arrows.splice(i, 1);
  }
}

export function killEnemy(e) {
  const t = ENEMY_TYPES[e.type];
  for (let k = 0; k < t.reward; k++) spawnCoin(e.x + rand(-22, 22), 1, groundY - 28, rand(-80, 80), rand(-260, -140));
  spawnParticles(e.x, groundY - 24, 12, t.color === "#1f1830" ? "#ff2a6a" : "#6a2a4a", 80, 100);
  Audio.enemyDie();
  if (window._addXP) window._addXP(t.reward * 8);
  if (t.legendary && state.legendaryBoss === e) {
    state.legendaryBoss = null;
    state.legendaryEffects = [];
    for (const u of state.units) u.rallied = false;
    spawnParticles(e.x, groundY - 80, 80, t.eye, 300, 250);
    if (window._floaty) window._floaty(e.x, "⚔ " + t.name + " besejret!", "#f2c14e");
  }

  if (e.locIdx !== undefined && state.locations[e.locIdx]) {
    const loc = state.locations[e.locIdx];
    loc.remainingEnemies--;
    if (loc.remainingEnemies <= 0 && !loc.lootSpawned) {
      loc.cleared = true;
      loc.lootSpawned = true;
      state.chests.push({ x: loc.x, lootGold: loc.lootGold, weaponId: loc.weaponId, open: false, openAnim: 0, life: 1 });
      if (window._floaty) window._floaty(loc.x, "📦 Kiste!", "#f2c14e");
    }
  }
  const idx = state.enemies.indexOf(e);
  if (idx >= 0) state.enemies.splice(idx, 1);
}

// ---------- Shared damage helper ----------
// Applies one melee hit from enemy `e` (of type `t`) to the player.
// Returns true if the hit connected (i.e. player was not invulnerable).
function meleeHitPlayer(e, t, knockForce) {
  const { player } = state;
  if (player.invuln > 0 || window._DEV_GOD_MODE) return false;
  const armorDef = player.armor ? (ARMORS[player.armor]?.defense || 0) : 0;
  const dmg = Math.max(1, t.meleeDmg - armorDef);
  player.hp    -= dmg;
  player.invuln = CFG.playerInvuln;
  player.hurt   = 0.35;
  player.knock  = Math.sign(player.x - e.x) * knockForce;
  spawnParticles(player.x, groundY - 50, 6, "#c1453b");
  if (player.coins > 0) {
    player.coins--;
    floaty(player.x, "−1🪙", "#ff6a4a");
  } else {
    floaty(player.x, `−${dmg}❤`, "#ff6a4a");
  }
  Audio.hit();
  return true;
}

// ---------- Enemy AI ----------
function wallAt(side, x) {
  let best = null;
  for (const w of state.walls) {
    if (!w.commissioned || w.hp <= 0 || w.side !== side) continue;
    if (side < 0 && w.x > x && w.x < CFG.baseX) { if (!best || w.x < best.x) best = w; }
    if (side > 0 && w.x < x && w.x > CFG.baseX) { if (!best || w.x > best.x) best = w; }
  }
  return best;
}

export function updateEnemies(dt) {
  const { enemies, units, base, player } = state;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const t = ENEMY_TYPES[e.type];
    if (e.home !== undefined) { updateLocEnemy(e, t, dt); continue; }
    if (t.legendary)          { updateLegendaryBoss(e, t, dt); continue; }

    if (t.flying) {
      e.anim += dt * 5;
      if (e.flash > 0) e.flash -= dt;
      e.attackCd -= dt;
      if (e.shootCd !== undefined) e.shootCd -= dt;
      if (e.fleeing) {
        const tx = e.portal ? e.portal.x : (e.x < CFG.baseX ? 0 : CFG.worldWidth);
        e.dir = Math.sign(tx - e.x); e.x += e.dir * t.speed * 1.6 * dt;
        if (dist(e.x, tx) < 40) enemies.splice(i, 1);
        continue;
      }
      // Fly toward base
      e.dir = Math.sign(base.x - e.x) || e.dir;
      e.x += e.dir * t.speed * dt;
      // Shoot arrow at player if in range
      if (e.shootCd !== undefined && e.shootCd <= 0 && dist(e.x, player.x) < 380) {
        const arrowY = groundY + (e.fy || -80);
        state.arrows.push({ x: e.x, y: arrowY, vx: Math.sign(player.x - e.x) * 320, vy: 180, target: {x: player.x}, life: 1.5, hitKind: "player" });
        e.shootCd = 2.2;
        Audio.bow();
      }
      // Damage player if directly overhead
      if (dist(e.x, player.x) < 28 && e.attackCd <= 0 && player.invuln <= 0 && !window._DEV_GOD_MODE) {
        player.hp -= 1; player.invuln = CFG.playerInvuln; player.hurt = 0.35;
        spawnParticles(player.x, groundY - 50, 5, "#c1453b");
        Audio.hit();
        e.attackCd = 1.5; e.fleeing = true;
      }
      continue;
    }

    e.anim += dt * 5;
    if (e.flash > 0) e.flash -= dt;
    e.attackCd -= dt;
    if (e.knock) { e.x += e.knock * dt; e.knock *= Math.max(0, 1 - 9 * dt); if (Math.abs(e.knock) < 8) e.knock = 0; }

    if (e.fleeing) {
      const tx = e.portal ? e.portal.x : (e.x < CFG.baseX ? 0 : CFG.worldWidth);
      e.dir = Math.sign(tx - e.x);
      e.x += e.dir * t.speed * 1.6 * dt;
      if (dist(e.x, tx) < 40) enemies.splice(i, 1);
      continue;
    }

    const side = e.x < CFG.baseX ? -1 : 1;
    const wall = wallAt(side, e.x);
    if (wall && dist(e.x, wall.x) < 30) {
      e.dir = Math.sign(wall.x - e.x) || e.dir;
      if (e.attackCd <= 0) {
        e.attackCd = 0.7;
        wall.hp -= t.dmg; wall.flash = 0.15;
        spawnParticles(wall.x, groundY - 30, 3, "#caa46a", 30, 30);
        Audio.hit();
        if (wall.hp <= 0) {
          wall.hp = 0; wall.level = 0; wall.commissioned = false; wall.buildProgress = 0;
          floaty(wall.x, "💥 Mur faldet!", "#ff6a4a");
          spawnParticles(wall.x, groundY - 30, 16, "#caa46a", 80, 80);
        }
      }
      continue;
    }

    // Persistent aggro: clear stale target, then try to acquire within 200px
    if (e.aggroUnit && (!units.includes(e.aggroUnit) || dist(e.x, e.aggroUnit.x) > 340)) {
      e.aggroUnit = null;
    }
    if (!e.aggroUnit) {
      let best = null, bd = 200;
      for (const u of units) { const d = dist(e.x, u.x); if (d < bd) { bd = d; best = u; } }
      if (best) e.aggroUnit = best;
    }
    if (e.aggroUnit) {
      const d = dist(e.x, e.aggroUnit.x);
      e.dir = Math.sign(e.aggroUnit.x - e.x) || e.dir;
      if (d > 32) e.x += e.dir * t.speed * dt;
      if (d < 40 && e.attackCd <= 0) {
        e.attackCd = 0.8;
        e.aggroUnit.hp -= 2; e.aggroUnit.panic = 1;
        spawnParticles(e.aggroUnit.x, groundY - 30, 3, "#7a1f1f");
        Audio.hit();
      }
      continue;
    }

    if (dist(e.x, base.x) < 70) {
      e.dir = Math.sign(base.x - e.x) || e.dir;
      if (e.attackCd <= 0) {
        e.attackCd = 0.9;
        base.hp -= t.dmg; base.flash = 0.2;
        spawnParticles(base.x + rand(-30, 30), groundY - 30, 4, "#ff6a4a");
        Audio.hit();
        const c = state.coins.find(cc => cc.settled && dist(cc.x, base.x) < 120);
        if (c) { e.carry++; state.coins.splice(state.coins.indexOf(c), 1); e.fleeing = true; }
      }
      continue;
    }

    if (dist(e.x, player.x) < 30 && player.jumpH <= 0 && e.attackCd <= 0) {
      const hadCoins = player.coins > 0;
      if (meleeHitPlayer(e, t, 230) && hadCoins) e.carry++;
      e.fleeing = true;
      e.attackCd = 1;
      continue;
    }

    e.dir = Math.sign(base.x - e.x) || e.dir;
    e.x += e.dir * t.speed * dt;
  }
}

function updateLocEnemy(e, t, dt) {
  const { player } = state;
  if (e.flash > 0) e.flash -= dt;
  e.attackCd -= dt;
  if (e.knock) { e.x += e.knock * dt; e.knock *= Math.max(0, 1 - 9 * dt); if (Math.abs(e.knock) < 8) e.knock = 0; }
  const prevX = e.x;
  const dp = dist(e.x, player.x);
  if (dp < 300) {
    const dir = Math.sign(player.x - e.x);
    e.dir = dir || e.dir;
    e.x += dir * t.speed * dt;
    if (dp < 32 && e.attackCd <= 0 && player.jumpH <= 0) {
      e.attackCd = 1.0;
      meleeHitPlayer(e, t, 220);
    }
  } else if (dist(e.x, e.home) > 50) {
    const dir = Math.sign(e.home - e.x);
    e.dir = dir || e.dir;
    e.x += dir * t.speed * 0.45 * dt;
  }
  if (Math.abs(e.x - prevX) > 0.02) e.anim += dt * 5;
}

// ---------- Magic spells ----------
function dealAoE(x, dmg, radius, col) {
  for (const e of state.enemies) {
    if (!e.fleeing && dist(e.x, x) < radius) {
      e.hp -= dmg; e.flash = 0.14;
      if (e.hp <= 0) killEnemy(e);
    }
  }
  spawnParticles(x, groundY - 10, 14, col, 100, 90);
}

function chainLightning(x, dmg, bounces) {
  if (bounces <= 0) return;
  let nearest = null, nd = 220;
  for (const e of state.enemies) {
    const d = dist(e.x, x);
    if (!e.fleeing && d < nd && d > 10) { nd = d; nearest = e; }
  }
  if (!nearest) return;
  nearest.hp -= Math.max(1, Math.floor(dmg * 0.6)); nearest.flash = 0.14;
  spawnParticles(nearest.x, groundY - 24, 5, "#ffffaa", 50, 70);
  if (nearest.hp <= 0) killEnemy(nearest);
  else chainLightning(nearest.x, dmg * 0.6, bounces - 1);
}

function castSpell(player, wBase, tgt) {
  const sy = groundY - 72;
  const ang = Math.atan2((groundY - 28) - sy, tgt.x - player.x);
  const spd = wBase.spellType === "waterjet" ? 480 : wBase.spellType === "meteor" ? 180 : 330;
  const ew = effectiveWeapon(player.weapon, player.weaponUpgrades || []);
  const aoeR = (wBase.aoeRadius || 0) + (ew.range - wBase.range) * 0.2;
  state.spells.push({
    x: player.x, y: sy,
    vx: Math.cos(ang) * spd,
    vy: Math.sin(ang) * spd,
    spellType: wBase.spellType || "arcane",
    dmg: ew.dmg,
    life: 2.2,
    col: wBase.col,
    aoeRadius: aoeR,
  });
  // Cast glow at player position
  spawnParticles(player.x, sy, 10, wBase.col, 50, 70);
  Audio.bow();
}

export function updateSpells(dt) {
  if (!state.spells || !state.spells.length) return;
  const { spells, enemies } = state;
  for (let i = spells.length - 1; i >= 0; i--) {
    const sp = spells[i];
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    const grav = sp.spellType === "meteor" ? 650 : sp.spellType === "waterjet" ? 80 : 280;
    sp.vy += grav * dt;
    sp.life -= dt;
    const hitGround = sp.y > groundY - 8;
    if (sp.life <= 0 || hitGround) {
      if (sp.aoeRadius > 0 && hitGround) dealAoE(sp.x, sp.dmg, sp.aoeRadius, sp.col);
      spells.splice(i, 1);
      continue;
    }
    let hit = false;
    for (const e of enemies) {
      if (e.fleeing) continue;
      const et = ENEMY_TYPES[e.type];
      if (dist(sp.x, e.x) < et.w * 0.75 && Math.abs(sp.y - (groundY + (e.fy || 0) - 24)) < 44) {
        e.hp -= sp.dmg; e.flash = 0.14; Audio.hit();
        spawnParticles(e.x, groundY + (e.fy || 0) - 24, 8, sp.col, 70, 90);
        if (!et.noKnockback) e.knock = (e.knock || 0) + Math.sign(e.x - sp.vx) * 140;
        if (e.hp <= 0) killEnemy(e);
        else if (sp.aoeRadius > 0) dealAoE(sp.x, Math.max(1, Math.floor(sp.dmg * 0.65)), sp.aoeRadius, sp.col);
        if (sp.spellType === "lightning") chainLightning(sp.x, sp.dmg, 1);
        hit = true; break;
      }
    }
    if (hit) spells.splice(i, 1);
  }
}

// ---------- Player attack ----------
export function updatePlayerAttack(dt) {
  const { player, enemies } = state;
  if (!player.weapon) return;
  if (player.swing > 0) player.swing -= dt;
  player.attackCd -= dt;
  if (player.attackCd > 0) return;
  const wBase = WEAPONS[player.weapon];
  const w = effectiveWeapon(player.weapon, player.weaponUpgrades || []);
  let tgt = null, bd = w.range;
  for (const e of enemies) {
    if (e.fleeing) continue;
    const d = dist(player.x, e.x);
    if (d < bd) { bd = d; tgt = e; }
  }
  if (!tgt) return;
  player.dir = Math.sign(tgt.x - player.x) || player.dir;
  player.swing = 0.32;
  if (wBase.type === "melee") {
    tgt.hp -= w.dmg; tgt.flash = 0.14; Audio.hit();
    spawnParticles(tgt.x, groundY - 28, 6, wBase.col, 50, 60);
    floaty(tgt.x, "-" + w.dmg, wBase.col);
    const et = ENEMY_TYPES[tgt.type];
    if (!et.noKnockback) tgt.knock = (tgt.knock || 0) + Math.sign(tgt.x - player.x) * 220;
    if (tgt.hp <= 0) killEnemy(tgt);
  } else if (wBase.type === "ranged") {
    shootArrow(player.x, groundY - 72, tgt);
  } else {
    castSpell(player, wBase, tgt);
  }
  player.attackCd = w.speed;
}

// ---------- Legendary boss AI ----------
function executeLegendaryAttack(e, t) {
  const { player, units, walls, legendaryEffects } = state;
  if (e.type === "legend1") {
    // Ground stomp: shockwave AoE, damages player+units+walls
    const r = 170;
    legendaryEffects.push({ type:"ring", x:e.x, radius:0, maxR:r, totalLife:0.7, life:0.7, col:"#ff6a00", width:12 });
    legendaryEffects.push({ type:"ring", x:e.x, radius:0, maxR:r*0.55, totalLife:0.5, life:0.5, col:"#ffaa00", width:7 });
    spawnParticles(e.x, groundY-8, 40, "#ff6a00", 240, 50);
    if (dist(e.x, player.x) < r && player.jumpH <= 0) meleeHitPlayer(e, t, 500);
    for (const u of units) { if (dist(e.x, u.x) < r) { u.hp -= 2; u.panic = 2.5; spawnParticles(u.x, groundY-20, 5, "#ff6a00", 60, 80); } }
    for (const w of walls) { if (w.commissioned && w.hp > 0 && dist(e.x, w.x) < r) { w.hp -= 22; w.flash = 0.4; } }
    Audio.hit();
  } else if (e.type === "legend2") {
    // Charge: set high velocity toward base
    e.chargeVx = Math.sign(state.base.x - e.x) * 680;
    legendaryEffects.push({ type:"ring", x:e.x, radius:0, maxR:120, totalLife:0.4, life:0.4, col:"#00c8ff", width:8 });
    spawnParticles(e.x, groundY-30, 20, "#00c8ff", 120, 60);
    Audio.hit();
  } else if (e.type === "legend3") {
    // Void pulse: massive ring, heavy AoE
    const r = 310;
    legendaryEffects.push({ type:"ring", x:e.x, radius:0, maxR:r,      totalLife:1.1, life:1.1, col:"#cc00ff", width:16 });
    legendaryEffects.push({ type:"ring", x:e.x, radius:0, maxR:r*0.6,  totalLife:0.8, life:0.8, col:"#8800aa", width:9  });
    legendaryEffects.push({ type:"ring", x:e.x, radius:0, maxR:r*0.25, totalLife:0.5, life:0.5, col:"#ffffff", width:5  });
    spawnParticles(e.x, groundY-40, 60, "#cc00ff", 350, 120);
    if (dist(e.x, player.x) < r && player.jumpH <= 0) meleeHitPlayer(e, t, 600);
    for (const u of units) { if (dist(e.x, u.x) < r) { u.hp -= 3; u.panic = 3; spawnParticles(u.x, groundY-20, 6, "#cc00ff", 80, 100); } }
    for (const w of walls) { if (w.commissioned && w.hp > 0 && dist(e.x, w.x) < r) { w.hp -= 38; w.flash = 0.5; } }
    Audio.hit();
  }
}

function updateLegendaryBoss(e, t, dt) {
  const { player, base, units } = state;
  e.anim += dt * (e.specialPhase === 1 ? 0.8 : e.specialPhase === 2 && e.type === "legend2" ? 7 : 2);
  if (e.flash > 0) e.flash -= dt;
  e.attackCd -= dt;

  // Special attack state machine
  if (e.specialPhase === 0) {
    e.specialCd -= dt;
    if (e.specialCd <= 0) {
      e.specialPhase = 1;
      e.specialTimer = t.windupTime;
      if (window._floaty) window._floaty(e.x, "⚠ " + t.attackName, t.eye);
      spawnParticles(e.x, groundY - t.w * 0.5, 12, t.eye, 80, 40);
    }
  } else if (e.specialPhase === 1) {
    e.specialTimer -= dt;
    if (Math.random() < 0.35) spawnParticles(e.x + rand(-t.w*0.35, t.w*0.35), groundY - 10, 2, t.eye, 50, 20);
    if (e.specialTimer <= 0) { e.specialPhase = 2; e.specialTimer = t.execTime; executeLegendaryAttack(e, t); }
  } else if (e.specialPhase === 2) {
    e.specialTimer -= dt;
    // legend2 charge movement
    if (e.type === "legend2" && e.chargeVx) {
      e.x += e.chargeVx * dt;
      spawnParticles(e.x - Math.sign(e.chargeVx)*30, groundY - 40, 3, t.eye, 60, 40);
      if (dist(e.x, player.x) < t.w*0.55 && player.jumpH <= 0 && player.invuln <= 0 && e.attackCd <= 0) {
        meleeHitPlayer(e, t, 700); e.attackCd = 0.4;
      }
      for (const u of units) { if (dist(e.x, u.x) < t.w*0.45) { u.hp -= 3; u.panic = 2.5; } }
    }
    if (e.specialTimer <= 0) { e.specialPhase = 0; e.specialCd = t.specialCooldown; e.chargeVx = 0; }
  }

  // Movement + wall/base targeting (only in idle phase)
  if (e.specialPhase === 0) {
    const side = e.x < CFG.baseX ? -1 : 1;
    const wall = wallAt(side, e.x);
    if (wall && dist(e.x, wall.x) < t.w * 0.58) {
      // Attack wall — don't advance
      e.dir = Math.sign(wall.x - e.x) || e.dir;
      if (e.attackCd <= 0) {
        e.attackCd = 1.1;
        wall.hp -= t.dmg; wall.flash = 0.2;
        spawnParticles(wall.x, groundY - 30, 8, "#caa46a", 70, 60);
        Audio.hit();
        if (wall.hp <= 0) {
          wall.hp = 0; wall.level = 0; wall.commissioned = false; wall.buildProgress = 0;
          floaty(wall.x, "💥 Mur faldet!", "#ff6a4a");
          spawnParticles(wall.x, groundY - 30, 24, "#caa46a", 110, 100);
        }
      }
    } else {
      // Advance toward base
      e.dir = Math.sign(base.x - e.x) || e.dir;
      e.x += e.dir * t.speed * dt;
      // Attack base when adjacent
      if (dist(e.x, base.x) < t.w * 0.58 && e.attackCd <= 0) {
        e.attackCd = 1.8;
        base.hp -= t.dmg; base.flash = 0.3;
        spawnParticles(base.x + rand(-30, 30), groundY - 30, 8, "#ff6a4a", 70, 70);
        floaty(base.x, `-${t.dmg}`, "#ff6a4a");
        Audio.hit();
        if (base.hp < 0) base.hp = 0;
      }
    }
  } else if (e.specialPhase === 2 && e.type !== "legend2") {
    // Hold position during non-charge executions
  }

  // Basic melee vs player
  if (e.specialPhase === 0 && dist(e.x, player.x) < t.w * 0.52 && player.jumpH <= 0 && e.attackCd <= 0) {
    meleeHitPlayer(e, t, 450); e.attackCd = 2.2;
  }
  // Basic melee vs units
  if (e.specialPhase === 0 && e.attackCd <= 0) {
    for (const u of units) {
      if (dist(e.x, u.x) < t.w * 0.5) {
        u.hp -= t.meleeDmg * 2; u.panic = 1.5;
        spawnParticles(u.x, groundY - 30, 6, "#c1453b", 60, 80);
        Audio.hit(); e.attackCd = 1.8; break;
      }
    }
  }
}

export function updateLegendaryEffects(dt) {
  const { legendaryEffects } = state;
  for (let i = legendaryEffects.length - 1; i >= 0; i--) {
    const ef = legendaryEffects[i];
    ef.life -= dt;
    if (ef.life <= 0) { legendaryEffects.splice(i, 1); continue; }
    if (ef.type === "ring") ef.radius = ef.maxR * (1 - ef.life / ef.totalLife);
  }
}
