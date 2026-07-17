import { clamp, lerpColor, rgb, lerp, withA, shade } from '../util/math.js';
import { ctx, W, H, groundY } from '../core/canvas.js';
import { Game, state } from '../core/state.js';
import { entityWallLift } from '../entities/Wall.js';
import { drawPlayer as drawPlayerBody } from './sprites/Player.js';
import { drawHeldWeapon } from './ItemRender.js';
import { drawMount } from './sprites/Mount.js';
import { activeMount, playerMountLift } from '../systems/economy/MountSystem.js';
import { darkness, skyColors, drawStars, drawClouds, drawCelestials, drawBirds, drawWildBirds, getTrees, drawHills, drawTreeLayer, drawLowFog, drawAmbientFront, drawLevelUpBeams, biomeAt, FX, windSway } from './Effects.js';

// Import all render modules
import { drawGroundTexture, drawGroundDeco, drawPonds, drawEntityShadows, drawPortals, drawWalls, drawBase, drawStations, drawForestTrees, drawForestCamps, drawBuildings } from './scene/RenderWorld.js';
import { drawEnemies } from './scene/RenderEntities.js';
import { drawVagrants, drawUnits, drawAnimals } from './scene/RenderUnits.js';
import { drawCoins, drawArrows, drawLootItems, drawChests, drawGroundBows, drawGroundHammers } from './scene/RenderItems.js';
import { drawCaltrops, drawPoisonShots, drawFirePools, drawLegendaryEffects, drawAegisStrikes, drawParticles, drawFloats, drawSpells, drawCampLight } from './scene/RenderEffects.js';
import { drawWeaponPickupOverlay, drawInventoryOverlay, drawShopOverlay, drawUpgradeMenu, drawXpBar, drawLegendaryIntro } from './scene/RenderUI.js';
import { drawMineCutaway } from './scene/RenderMine.js';
import { drawHeart } from './DrawHelpers.js';

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
  if (w.includes("spear")) { drawSpearThrustFX(dir, baseY, arc, prog); ctx.restore(); return; }
  if (w.includes("axe"))   { drawAxeChopFX(dir, baseY, arc, prog); ctx.restore(); return; }
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
  ctx.restore();
}

// Spear attack visual: forward speed-line streaks with a bright point at the
// tip, keyed to the thrust window of the held-weapon animation.
function drawSpearThrustFX(dir, baseY, arc, prog) {
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
}

// Axe attack visual: a steep overhead crescent keyed to the drop phase of the
// chop, with a small impact flash low in front on follow-through.
function drawAxeChopFX(dir, baseY, arc, prog) {
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
  for (const e of state.enemies) {
    if (e.fleeing) continue;
    const sx=e.x-Game.cam;
    if (sx<0) { ctx.fillStyle="rgba(255,70,70,0.85)"; ctx.beginPath(); ctx.moveTo(14,groundY-60); ctx.lineTo(30,groundY-70); ctx.lineTo(30,groundY-50); ctx.fill(); }
    else if (sx>W) { ctx.fillStyle="rgba(255,70,70,0.85)"; ctx.beginPath(); ctx.moveTo(W-14,groundY-60); ctx.lineTo(W-30,groundY-70); ctx.lineTo(W-30,groundY-50); ctx.fill(); }
  }
}

// Export for external use
export { drawEntityShadows };

// Main render function
export function render() {
  const dark=darkness();
  const [top,bot]=skyColors();
  const g=ctx.createLinearGradient(0,0,0,groundY+80);
  g.addColorStop(0,rgb(top)); g.addColorStop(0.62,rgb(lerpColor(top,bot,0.6))); g.addColorStop(1,rgb(bot));
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  drawStars(dark); drawCelestials(dark); drawClouds(dark,top); drawBirds(dark);

  const trees=getTrees();
  drawHills(trees.hills,dark);
  drawTreeLayer(trees.far,0.22,0.88,4,0.9);
  drawTreeLayer(trees.mid,0.38,0.64,7,0.95);
  drawTreeLayer(trees.near,0.70,0.30,14);

  const bi=biomeAt(Game.cam+W/2);
  // grass band -> warm earth -> dark loam
  const gg=ctx.createLinearGradient(0,groundY,0,H);
  gg.addColorStop(0,rgb(lerpColor(bi.gT,[14,16,26],dark)));
  gg.addColorStop(0.16,rgb(lerpColor(shade(bi.gT,0.88),[12,14,22],dark)));
  gg.addColorStop(0.34,rgb(lerpColor(lerpColor(bi.gB,[96,72,48],0.3),[9,11,18],dark)));
  gg.addColorStop(1,rgb(lerpColor(lerpColor(bi.gB,[44,32,24],0.5),[6,8,16],dark)));
  ctx.fillStyle=gg; ctx.fillRect(0,groundY,W,H-groundY);
  // dark seam just above the lip separates the play surface from the backdrop
  ctx.fillStyle=withA(lerpColor(shade(bi.gT,0.45),[6,8,14],dark),0.55);
  ctx.fillRect(0,groundY-1,W,1.5);
  // sunlit grass lip
  ctx.fillStyle=withA(lerpColor(shade(bi.gT,1.3),[44,48,64],dark),0.85);
  ctx.fillRect(0,groundY,W,2);
  ctx.fillStyle=withA(lerpColor(shade(bi.gT,1.12),[30,34,48],dark),0.4);
  ctx.fillRect(0,groundY+2,W,3);

  const zoom=Game.zoom||1;
  const _sk=Game.screenShake||0;
  const _skx=_sk>0?(Math.random()-0.5)*_sk*12:0, _sky=_sk>0?(Math.random()-0.5)*_sk*7:0;
  ctx.save();
  ctx.translate(W/2+_skx, groundY+_sky); ctx.scale(zoom,zoom); ctx.translate(-W/2-Game.cam,-groundY);
  drawGroundTexture(dark); drawGroundDeco(dark); drawPonds(dark); drawMineCutaway(drawPlayer, dark); drawForestCamps(dark); drawForestTrees(dark); drawWildBirds();
  drawEntityShadows(); drawPortals(dark); drawWalls(dark); drawBuildings(dark); drawBase(dark);
  drawStations(); drawCoins(); drawGroundBows(); drawGroundHammers(); drawLootItems(); drawChests();
  drawAnimals(); drawVagrants(); drawCaltrops(); drawFirePools(); drawUnits(); drawEnemies(dark); drawLegendaryEffects();
  if (!Game.inMine) drawPlayer(dark);
  drawArrows(); drawPoisonShots(); drawSpells(); drawAegisStrikes(); drawLevelUpBeams(); drawParticles(); drawCampLight(dark); drawFloats();
  ctx.restore();

  drawLowFog(dark,bi); drawAmbientFront(dark,bi);

  ctx.fillStyle=`rgba(4,3,12,${0.04+0.18*dark})`;
  ctx.fillRect(0,0,W,H);

  drawOffscreenIndicators();
  drawWeaponPickupOverlay();
  drawInventoryOverlay();
  drawShopOverlay();
  drawUpgradeMenu();
  if (Game.state === "play") drawXpBar();
  drawLegendaryIntro();
}
