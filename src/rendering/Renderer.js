import { clamp, lerpColor, rgb, lerp, withA, shade } from '../util/math.js';
import { ctx, W, H, groundY } from '../core/canvas.js';
import { Game, state } from '../core/state.js';
import { entityWallLift } from '../entities/Wall.js';
import { drawPlayer as drawPlayerBody } from './sprites/Player.js';
import { drawHeldWeapon } from './ItemRender.js?v=biomeweapons1';
import { cachedUpgradeEffects } from '../config/weaponUpgrades.js?v=biomeweapons1';
import { drawMount } from './sprites/Mount.js';
import { activeMount, playerMountLift } from '../systems/economy/MountSystem.js';
import { darkness, skyColors, drawStars, drawClouds, drawCelestials, drawBirds, drawWildBirds, getTrees, drawHills, drawTreeLayer, drawLowFog, drawAmbientFront, drawLevelUpBeams, biomeAt, FX, windSway } from './Effects.js?v=biomeactive4';

// Import all render modules
import { drawGroundTexture, drawGroundDeco, drawPonds, drawEntityShadows, drawPortals, drawWalls, drawBase, drawStations, drawForestTrees, drawForestCamps, drawBuildings } from './scene/RenderWorld.js?v=biomevisual4';
import { drawEnemies } from './scene/RenderEntities.js?v=forestboss1';
import { drawVagrants, drawUnits, drawAnimals } from './scene/RenderUnits.js?v=biomevisual4';
import { drawCoins, drawGoldCollectors, drawArrows, drawLootItems, drawChests, drawGroundBows, drawGroundHammers } from './scene/RenderItems.js?v=biomeweapons1';
import { drawCaltrops, drawPoisonShots, drawFirePools, drawSpellFields, drawLegendaryEffects, drawAegisStrikes, drawTrebuchetShots, drawParticles, drawFloats, drawSpells, drawCampLight } from './scene/RenderEffects.js?v=biomeactive4';
import { drawWeaponPickupOverlay, drawInventoryOverlay, drawShopOverlay, drawCastleUpgradeOverlay, drawUpgradeMenu, drawXpBar, drawLegendaryIntro, drawOneSidedAnnounce } from './scene/RenderUI.js?v=forestboss1';
import { drawHeart } from './DrawHelpers.js?v=biomeweapons1';
import { beginRenderFrame } from './RenderFrame.js';
// Profiler uses window._perf (set by HUD toggle)

// Helper functions
function drawWeaponSwingArc(x, player) {
  if (!player.swing || player.swing <= 0 || !player.weapon) return;
  const w = player.weapon, prog = clamp(player.swing / 0.32, 0, 1);
  const dir = player.dir || 1;
  const lift = entityWallLift(player) + playerMountLift(player);
  const baseY = groundY - 40 - (player.bob||0) - (player.jumpH||0) - lift;
  const WEAPON_ARC = {
    rusty_sword:  { col:"#9a9aa2", glow:null,      r:44, sw:4, a:0.5 },
    dagger:       { col:"#d0d0d8", glow:null,      r:34, sw:3, a:0.55 },
    sword:        { col:"#d8d8e0", glow:null,      r:50, sw:4, a:0.6 },
    longsword:    { col:"#e0e0f0", glow:"#ffffff", r:58, sw:5, a:0.65 },
    war_axe:      { col:"#d8c078", glow:null,      r:44, sw:6, a:0.7 },
    war_hammer:   { col:"#a8a8b8", glow:null,      r:40, sw:8, a:0.7 },
    spear:        { col:"#e8dcb0", glow:null,      r:72, sw:3, a:0.7 },
    flame_sword:  { col:"#ff7730", glow:"#ffcc40", r:52, sw:6, a:0.8 },
    gilded_spear: { col:"#f2c14e", glow:"#ffffff", r:78, sw:4, a:0.85 },
    shadow_axe:   { col:"#aa44cc", glow:"#ff88ff", r:48, sw:7, a:0.75 },
    kings_sword:  { col:"#f2c14e", glow:"#ffffff", r:60, sw:8, a:0.9 },
    thunder_blade:{ col:"#cc66ff", glow:"#aaaaff", r:56, sw:7, a:0.9 },
    sunblade:     { col:"#ffee60", glow:"#ffffff", r:68, sw:9, a:1.0 },
    ice_axe:      { col:"#6abaff", glow:"#ffffff", r:46, sw:5, a:0.7 },
  };
  const arc = WEAPON_ARC[w];
  if (!arc) return;
  ctx.save();
  ctx.translate(x, 0);
  if (w.includes("spear")) { drawSpearThrustFX(player, dir, baseY, arc, prog); ctx.restore(); return; }
  if (w.includes("axe"))   { drawAxeChopFX(dir, baseY, arc, prog, player); ctx.restore(); return; }
  const startA = dir > 0 ? -Math.PI*0.7 : Math.PI*0.3;
  const endA   = dir > 0 ? Math.PI*0.1  : Math.PI*1.1;
  const sweepEnd = startA + (endA - startA) * (1 - prog);
  if (arc.glow) {
    // soft light bleed behind the blade streak
    ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=prog*arc.a*0.35;
    ctx.strokeStyle=arc.glow; ctx.lineWidth=arc.sw+6; ctx.lineCap="round";
    ctx.beginPath(); ctx.arc(0,baseY,arc.r,startA,sweepEnd); ctx.stroke();
    ctx.restore();
  }
  ctx.save(); ctx.globalAlpha=prog*arc.a*0.9;
  ctx.strokeStyle=arc.col; ctx.lineWidth=arc.sw; ctx.lineCap="round";
  ctx.beginPath(); ctx.arc(0,baseY,arc.r,startA,sweepEnd); ctx.stroke();
  // trailing edge highlight so the sweep reads as motion
  ctx.globalAlpha=prog*arc.a*0.55;
  ctx.strokeStyle="#ffffff"; ctx.lineWidth=Math.max(1.2,arc.sw*0.35);
  ctx.beginPath(); ctx.arc(0,baseY,arc.r,sweepEnd-0.32*prog,sweepEnd); ctx.stroke();
  ctx.restore();
  // Legendary upgrade arc overlay — extra glow + spark at the sweep tip
  const upgFx = cachedUpgradeEffects(player.weaponUpgrades);
  if (upgFx._tierRank >= 3 && upgFx._vfxCols?.length) {
    const vCol = upgFx._vfxCols[upgFx._vfxCols.length - 1];
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = prog * 0.4;
    ctx.strokeStyle = vCol; ctx.lineWidth = arc.sw + 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(0, baseY, arc.r + 2, startA, sweepEnd); ctx.stroke();
    const tipAx = (arc.r + 2) * Math.cos(sweepEnd);
    const tipAy = baseY + (arc.r + 2) * Math.sin(sweepEnd);
    ctx.fillStyle = "#ffffff"; ctx.globalAlpha = prog * 0.8;
    ctx.beginPath(); ctx.arc(tipAx, tipAy, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (upgFx._tierRank >= 2) {
    const vCol = upgFx._vfxCols?.length ? upgFx._vfxCols[upgFx._vfxCols.length - 1] : arc.col;
    const tipAx = (arc.r + 2) * Math.cos(sweepEnd);
    const tipAy = baseY + (arc.r + 2) * Math.sin(sweepEnd);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    if (w === "dagger") {
      ctx.globalAlpha = prog * (upgFx._tierRank >= 3 ? 0.38 : 0.22);
      ctx.strokeStyle = upgFx._tierRank >= 3 ? "#bb55ff" : "#8a1020";
      ctx.lineWidth = 2;
      for (let k = 0; k < (upgFx._tierRank >= 3 ? 4 : 2); k++) {
        ctx.beginPath(); ctx.arc(0, baseY + k * 1.4 - 2, arc.r + k * 3, startA + k * 0.06, sweepEnd + k * 0.05); ctx.stroke();
      }
    } else if (w === "flame_sword" && upgFx._tierRank >= 3) {
      ctx.globalAlpha = prog * 0.33;
      ctx.strokeStyle = "#ffe080"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tipAx - dir * 18, tipAy - 10);
      ctx.quadraticCurveTo(tipAx - dir * 2, tipAy - 28, tipAx + dir * 24, tipAy - 8);
      ctx.moveTo(tipAx - dir * 18, tipAy + 10);
      ctx.quadraticCurveTo(tipAx - dir * 2, tipAy + 28, tipAx + dir * 24, tipAy + 8);
      ctx.stroke();
    } else if (w === "longsword" && upgFx._tierRank >= 3) {
      ctx.globalAlpha = prog * 0.35;
      ctx.strokeStyle = "#d8c0ff"; ctx.lineWidth = 1.4;
      for (let k = 0; k < 4; k++) {
        const cx = dir * (20 + k * 13);
        ctx.beginPath();
        ctx.moveTo(cx, groundY - 3);
        ctx.lineTo(cx + dir * (8 + k * 2), groundY - 7 - k * 1.5);
        ctx.moveTo(cx + dir * 3, groundY - 3);
        ctx.lineTo(cx + dir * (12 + k), groundY - 1);
        ctx.stroke();
      }
    } else if (w === "war_hammer") {
      const ring = Math.sin((1 - prog) * Math.PI);
      ctx.globalAlpha = ring * (upgFx._tierRank >= 3 ? 0.36 : 0.22);
      ctx.strokeStyle = upgFx._tierRank >= 3 ? "#b080ff" : vCol;
      ctx.lineWidth = upgFx._tierRank >= 3 ? 3 : 2;
      ctx.beginPath(); ctx.ellipse(dir * 34, groundY - 5, 20 + ring * 42, 5 + ring * 8, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (w === "thunder_blade" && upgFx._tierRank >= 3) {
      ctx.globalAlpha = prog * 0.58;
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tipAx, baseY - 105);
      ctx.lineTo(tipAx + Math.sin(prog * 12) * 9, baseY - 65);
      ctx.lineTo(tipAx - Math.cos(prog * 10) * 7, baseY - 28);
      ctx.lineTo(tipAx, tipAy);
      ctx.stroke();
    } else if (w === "rusty_sword" && upgFx._tierRank >= 3) {
      ctx.globalAlpha = prog * 0.5;
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = k % 2 ? "#9bd05a" : "#d7b04a";
        ctx.beginPath(); ctx.arc(tipAx - dir * k * 4, tipAy + Math.sin(k) * 6, 1.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

// Spear attack visual: forward speed-line streaks with a bright point at the
// tip, keyed to the thrust window of the held-weapon animation.
function drawSpearThrustFX(player, dir, baseY, arc, prog) {
  const attackP = 1 - prog;
  const t = clamp((attackP - 0.3) / 0.35, 0, 1);
  if (t <= 0) return;
  const a = Math.sin(Math.min(1, t * 1.25) * Math.PI);
  const y = baseY + 14;
  const reach = arc.r + 26;
  const tipX = dir * (14 + t * reach);
  if (arc.glow) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a * arc.a * 0.4;
    ctx.strokeStyle = arc.glow; ctx.lineWidth = arc.sw + 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(dir * 10, y); ctx.lineTo(tipX, y); ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = a * arc.a * 0.9;
  ctx.strokeStyle = arc.col; ctx.lineWidth = arc.sw; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(dir * (14 + t * reach * 0.35), y); ctx.lineTo(tipX, y); ctx.stroke();
  // flanking speed lines
  ctx.globalAlpha = a * arc.a * 0.5;
  ctx.lineWidth = Math.max(1, arc.sw * 0.5);
  ctx.beginPath(); ctx.moveTo(dir * (6 + t * reach * 0.25), y - 5); ctx.lineTo(dir * (10 + t * reach * 0.8), y - 5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(dir * (6 + t * reach * 0.25), y + 5); ctx.lineTo(dir * (10 + t * reach * 0.8), y + 5); ctx.stroke();
  // bright point at the tip
  ctx.globalAlpha = a * arc.a * 0.8;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(tipX, y, Math.max(1.5, arc.sw * 0.5), 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Legendary upgrade thrust overlay
  const spUpgFx = cachedUpgradeEffects(player?.weaponUpgrades);
  if (spUpgFx?._tierRank >= 3 && spUpgFx._vfxCols?.length) {
    const vC = spUpgFx._vfxCols[spUpgFx._vfxCols.length - 1];
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a * 0.5;
    ctx.strokeStyle = vC; ctx.lineWidth = arc.sw + 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(dir * 14, y); ctx.lineTo(tipX, y); ctx.stroke();
    ctx.fillStyle = "#ffffff"; ctx.globalAlpha = a * 0.7;
    ctx.beginPath(); ctx.arc(tipX, y, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (player.weapon === "spear" && spUpgFx?._tierRank >= 3) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = a * 0.34;
    ctx.strokeStyle = "#ffb060"; ctx.lineWidth = 7; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(dir * 20, y); ctx.lineTo(tipX + dir * 26, y); ctx.stroke();
    ctx.globalAlpha = a * 0.75;
    ctx.fillStyle = "#ffdd60";
    ctx.beginPath(); ctx.arc(tipX + dir * 7, y - 3, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(tipX + dir * 7, y + 3, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// Axe attack visual: a steep overhead crescent keyed to the drop phase of the
// chop, with a small impact flash low in front on follow-through.
function drawAxeChopFX(dir, baseY, arc, prog, player = null) {
  const attackP = 1 - prog;
  const t = clamp((attackP - 0.42) / 0.3, 0, 1);
  if (t <= 0) return;
  const e = t * t * (3 - 2 * t);
  const fade = attackP > 0.72 ? clamp(1 - (attackP - 0.72) / 0.28, 0, 1) : 1;
  // Continuous angles so the partial sweep interpolates cleanly; the mirrored
  // sweep must run anticlockwise to still pass over the top of the head.
  const a0 = dir > 0 ? -Math.PI * 0.82 : -Math.PI * 0.18;
  const a1 = dir > 0 ? Math.PI * 0.18 : -Math.PI * 1.18;
  const sweepEnd = a0 + (a1 - a0) * e;
  const ccw = dir < 0;
  if (arc.glow) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = fade * arc.a * 0.35;
    ctx.strokeStyle = arc.glow; ctx.lineWidth = arc.sw + 6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(0, baseY, arc.r, a0, sweepEnd, ccw); ctx.stroke();
    ctx.restore();
  }
  const fx = cachedUpgradeEffects(player?.weaponUpgrades);
  if (fx?._tierRank >= 2) {
    const col = fx._vfxCols?.length ? fx._vfxCols[fx._vfxCols.length - 1] : arc.col;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    if (player?.weapon === "war_axe") {
      ctx.globalAlpha = fade * (fx._tierRank >= 3 ? 0.42 : 0.25);
      ctx.strokeStyle = fx._tierRank >= 3 ? "#c02030" : "#a01828";
      ctx.lineWidth = fx._tierRank >= 3 ? arc.sw + 4 : arc.sw + 1;
      ctx.beginPath(); ctx.arc(0, baseY, arc.r + 6, a0, sweepEnd, ccw); ctx.stroke();
      if (fx._tierRank >= 3) {
        ctx.globalAlpha = fade * 0.24;
        ctx.fillStyle = "#8a1020";
        ctx.beginPath(); ctx.arc(dir * 22, baseY - 4, arc.r * 0.65, -1.2, 1.2); ctx.arc(dir * 29, baseY - 4, arc.r * 0.48, 1.2, -1.2, true); ctx.fill();
      }
    } else if (player?.weapon === "ice_axe") {
      ctx.globalAlpha = fade * (fx._tierRank >= 3 ? 0.45 : 0.28);
      ctx.strokeStyle = "#bfefff"; ctx.lineWidth = arc.sw + (fx._tierRank >= 3 ? 5 : 2);
      ctx.beginPath(); ctx.arc(0, baseY, arc.r + 4, a0, sweepEnd, ccw); ctx.stroke();
      if (fx._tierRank >= 3) {
        for (let k = 0; k < 8; k++) {
          const a2 = t * 2 + k * Math.PI / 4;
          ctx.fillStyle = k % 2 ? "#ffffff" : "#bfefff";
          ctx.beginPath(); ctx.arc(dir * 18 + Math.cos(a2) * 30, baseY + Math.sin(a2) * 18, 1.2, 0, Math.PI * 2); ctx.fill();
        }
      }
    } else if (fx._tierRank >= 3) {
      ctx.globalAlpha = fade * 0.28;
      ctx.strokeStyle = col; ctx.lineWidth = arc.sw + 3;
      ctx.beginPath(); ctx.arc(0, baseY, arc.r + 5, a0, sweepEnd, ccw); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = fade * arc.a * 0.9;
  ctx.strokeStyle = arc.col; ctx.lineWidth = arc.sw; ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(0, baseY, arc.r, a0, sweepEnd, ccw); ctx.stroke();
  // leading edge highlight so the drop reads as motion
  ctx.globalAlpha = fade * arc.a * 0.55;
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = Math.max(1.2, arc.sw * 0.35);
  ctx.beginPath(); ctx.arc(0, baseY, arc.r, sweepEnd + (ccw ? 0.3 : -0.3) * e, sweepEnd, ccw); ctx.stroke();
  // impact flash where the head lands
  if (t >= 1) {
    const ix = dir * arc.r * Math.cos(Math.PI * 0.18);
    const iy = baseY + arc.r * Math.sin(Math.PI * 0.18);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = fade * arc.a * 0.7;
    ctx.strokeStyle = arc.glow || "#ffffff"; ctx.lineWidth = 1.6;
    for (let k = 0; k < 4; k++) {
      const sa = -Math.PI * 0.15 - k * 0.5 + dir * 0.2;
      ctx.beginPath();
      ctx.moveTo(ix + Math.cos(sa) * 4, iy + Math.sin(sa) * 4);
      ctx.lineTo(ix + Math.cos(sa) * (9 + fade * 4), iy + Math.sin(sa) * (9 + fade * 4));
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPlayer(dark) {
  const { player } = state;
  const x=player.x, bob=player.bob, gallop=player.gallop;
  const wallLift = entityWallLift(player);
  const mount = Game.state==="player-death" ? null : activeMount(player);
  const mountLift = mount ? mount.lift : 0;
  const dying = Game.state==="player-death";
  if (!dying) drawWeaponSwingArc(x, player);
  ctx.save();
  if (!dying && player.invuln>0&&Math.floor(player.invuln*12)%2===0) ctx.globalAlpha=0.45;
  ctx.translate(x, -bob - player.jumpH - wallLift - mountLift);
  if (player.dir<0) ctx.scale(-1,1);
  // The steed sits under the same transform, so body + held weapon ride it.
  if (mount) drawMount(player, mount);
  if (dying) {
    // Collapse backwards: knees buckle briefly, then topple around the feet
    const t = Game.deathTimer || 0;
    const fall = clamp((t - 0.35) / 0.75, 0, 1);
    const eased = 1 - (1 - fall) * (1 - fall);
    const sag = clamp(t / 0.35, 0, 1) * 4;
    ctx.translate(0, sag);
    ctx.translate(0, groundY);
    ctx.rotate(-eased * 1.45 + Math.sin(Math.min(t, 1.1) * 22) * 0.02 * (1 - eased));
    ctx.translate(0, -groundY);
  }

  // Draw player body using new detailed rendering. Mounted, the walk cycle is
  // suppressed (the horse animates instead) and the legs take the seated pose.
  drawPlayerBody(player, player.dir, mount ? false : Math.abs(player.vx) > 1, mount ? 0 : gallop, mount);

  if (player.weapon && !dying) drawHeldWeapon(player);
  ctx.restore();
  if (!dying && (player.hp <= 2 || player.hpShowTimer > 0)) {
    const n=player.maxHp, gap=9, hy=groundY-86-bob-player.jumpH-wallLift-mountLift;
    for (let i=0;i<n;i++) drawHeart(player.x-(n-1)*gap/2+i*gap, hy, 4, i<player.hp?"#e0556a":"rgba(255,255,255,0.18)");
  }
}

function drawOffscreenIndicators() {
  if (!Game.isNight) return;
  let left = false, right = false;
  for (const e of state.enemies) {
    if (e.fleeing) continue;
    const sx=e.x-Game.cam;
    if (sx<0) left = true;
    else if (sx>W) right = true;
    if (left && right) break;
  }
  ctx.fillStyle="rgba(255,70,70,0.85)";
  if (left) { ctx.beginPath(); ctx.moveTo(14,groundY-60); ctx.lineTo(30,groundY-70); ctx.lineTo(30,groundY-50); ctx.fill(); }
  if (right) { ctx.beginPath(); ctx.moveTo(W-14,groundY-60); ctx.lineTo(W-30,groundY-70); ctx.lineTo(W-30,groundY-50); ctx.fill(); }
}

// Export for external use
export { drawEntityShadows };

// Main render function
export function render() {
  beginRenderFrame();
  const p = window._perf;
  const dark=darkness();
  const [top,bot]=skyColors();
  const g=ctx.createLinearGradient(0,0,0,groundY+80);
  g.addColorStop(0,rgb(top)); g.addColorStop(0.62,rgb(lerpColor(top,bot,0.6))); g.addColorStop(1,rgb(bot));
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  if(p) p.begin("draw.sky");
  drawStars(dark); drawCelestials(dark); drawClouds(dark,top); drawBirds(dark);
  if(p) p.end("draw.sky");

  if(p) p.begin("draw.trees");
  const trees=getTrees();
  drawHills(trees.hills,dark);
  drawTreeLayer(trees.far,0.22,0.88,4,0.9);
  drawTreeLayer(trees.mid,0.38,0.64,7,0.95);
  drawTreeLayer(trees.near,0.70,0.30,14);
  if(p) p.end("draw.trees");

  const bi=biomeAt(Game.cam+W/2);
  const gg=ctx.createLinearGradient(0,groundY,0,H);
  gg.addColorStop(0,rgb(lerpColor(bi.gT,[14,16,26],dark)));
  gg.addColorStop(0.16,rgb(lerpColor(shade(bi.gT,0.88),[12,14,22],dark)));
  gg.addColorStop(0.34,rgb(lerpColor(lerpColor(bi.gB,[96,72,48],0.3),[9,11,18],dark)));
  gg.addColorStop(1,rgb(lerpColor(lerpColor(bi.gB,[44,32,24],0.5),[6,8,16],dark)));
  ctx.fillStyle=gg; ctx.fillRect(0,groundY,W,H-groundY);
  ctx.fillStyle=withA(lerpColor(shade(bi.gT,0.45),[6,8,14],dark),0.55);
  ctx.fillRect(0,groundY-1,W,1.5);
  ctx.fillStyle=withA(lerpColor(shade(bi.gT,1.3),[44,48,64],dark),0.85);
  ctx.fillRect(0,groundY,W,2);
  ctx.fillStyle=withA(lerpColor(shade(bi.gT,1.12),[30,34,48],dark),0.4);
  ctx.fillRect(0,groundY+2,W,3);

  const zoom=Game.zoom||1;
  const _sk=Game.screenShake||0;
  const _skx=_sk>0?(Math.random()-0.5)*_sk*12:0, _sky=_sk>0?(Math.random()-0.5)*_sk*7:0;
  ctx.save();
  ctx.translate(W/2+_skx, groundY+_sky); ctx.scale(zoom,zoom); ctx.translate(-W/2-Game.cam,-groundY);

  if(p) p.begin("draw.terrain");
  drawGroundTexture(dark); drawGroundDeco(dark); drawPonds(dark); drawForestCamps(dark); drawForestTrees(dark); drawWildBirds();
  if(p) p.end("draw.terrain");

  if(p) p.begin("draw.structures");
  drawEntityShadows(); drawPortals(dark); drawWalls(dark); drawBuildings(dark); drawBase(dark);
  drawStations(); drawCoins(); drawGoldCollectors(); drawGroundBows(); drawGroundHammers(); drawLootItems(); drawChests();
  if(p) p.end("draw.structures");

  if(p) p.begin("draw.entities");
  drawAnimals(); drawVagrants(); drawCaltrops(); drawFirePools(); drawSpellFields(); drawUnits(); drawEnemies(dark); drawLegendaryEffects();
  drawPlayer(dark);
  if(p) p.end("draw.entities");

  if(p) p.begin("draw.fx");
  drawArrows(); drawPoisonShots(); drawSpells(); drawAegisStrikes(); drawTrebuchetShots(); drawLevelUpBeams(); drawParticles(); drawCampLight(dark); drawFloats();
  if(p) p.end("draw.fx");

  ctx.restore();

  if(p) p.begin("draw.post");
  drawLowFog(dark,bi); drawAmbientFront(dark,bi);
  ctx.fillStyle=`rgba(4,3,12,${0.04+0.18*dark})`;
  ctx.fillRect(0,0,W,H);
  if(p) p.end("draw.post");

  if(p) p.begin("draw.ui");
  drawOffscreenIndicators();
  drawWeaponPickupOverlay();
  drawInventoryOverlay();
  drawShopOverlay();
  drawCastleUpgradeOverlay();
  drawUpgradeMenu();
  if (Game.state === "play" && !Game.castleOpen) drawXpBar();
  drawLegendaryIntro();
  drawOneSidedAnnounce();
  if(p) p.end("draw.ui");
}
