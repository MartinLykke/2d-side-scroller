import { clamp, lerpColor, rgb, lerp, withA, shade } from '../util/math.js';
import { ctx, W, H, groundY } from '../canvas.js';
import { Game, state } from '../state.js';
import { WEAPONS } from '../config/weapons.js';
import { drawPlayer as drawPlayerBody } from './Player.js';
import { darkness, skyColors, drawStars, drawAurora, drawCelestial, drawClouds, drawBirds, getTrees, drawMountains, drawHills, drawTreeLayer, drawSunShafts, drawFogBand, drawLowFog, drawAmbientFront, drawLevelUpBeams, biomeAt, FX, windSway } from './Effects.js';

// Import all render modules
import { drawGroundTexture, drawGroundDeco, drawEntityShadows, drawPortals, drawWalls, drawBase, drawStations, drawBackgroundWash, drawForestTrees } from './RenderWorld.js';
import { drawVagrants, drawUnits, drawEnemies, drawAnimals } from './RenderEntities.js';
import { drawCoins, drawArrows, drawLootItems, drawChests, drawGroundBows, drawGroundHammers } from './RenderItems.js';
import { drawCaltrops, drawPoisonShots, drawLegendaryEffects, drawParticles, drawFloats, drawSpells, drawCampLight } from './RenderEffects.js';
import { drawLocations } from './RenderLocations.js';
import { drawWeaponPickupOverlay, drawInventoryOverlay, drawShopOverlay, drawUpgradeMenu, drawXpBar, drawLegendaryIntro } from './RenderUI.js';
import { roundedRect, drawFocusHalo, drawHeart, drawTomeIcon } from './DrawHelpers.js';

// Helper functions
function drawWeaponSwingArc(x, player) {
  if (!player.swing || player.swing <= 0 || !player.weapon) return;
  const w = player.weapon, prog = clamp(player.swing / 0.32, 0, 1);
  const dir = player.dir || 1;
  const baseY = groundY - 40 - (player.bob||0) - (player.jumpH||0);
  const WEAPON_ARC = {
    flame_sword:  { col:"#ff7730", glow:"#ffcc40", r:52, sw:6, a:0.8 },
    gilded_spear: { col:"#f2c14e", glow:"#ffffff", r:66, sw:4, a:0.85 },
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
  const startA = dir > 0 ? -Math.PI*0.7 : Math.PI*0.3;
  const endA   = dir > 0 ? Math.PI*0.1  : Math.PI*1.1;
  const sweepEnd = startA + (endA - startA) * (1 - prog);
  ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=prog*arc.a*0.5;
  ctx.strokeStyle=arc.glow; ctx.lineWidth=arc.sw*3;
  ctx.beginPath(); ctx.arc(0,baseY,arc.r,startA,sweepEnd); ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=prog*arc.a;
  ctx.strokeStyle=arc.col; ctx.lineWidth=arc.sw; ctx.lineCap="round";
  ctx.beginPath(); ctx.arc(0,baseY,arc.r,startA,sweepEnd); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawPlayer(dark) {
  const { player } = state;
  const x=player.x, bob=player.bob, gallop=player.gallop;
  drawWeaponSwingArc(x, player);
  ctx.save();
  if (player.invuln>0&&Math.floor(player.invuln*12)%2===0) ctx.globalAlpha=0.45;
  ctx.translate(x, -bob - player.jumpH);
  if (player.dir<0) ctx.scale(-1,1);

  // Draw player body using new detailed rendering
  drawPlayerBody(player, player.dir, Math.abs(player.vx) > 1, gallop);
  const px = 0;

  if (player.weapon) {
    const w=WEAPONS[player.weapon], sw=player.swing||0;
    ctx.save();
    if (w.type==="melee") {
      const baseAng=-0.22, swingOff=sw>0?-0.9*(sw/0.32):0;
      ctx.translate(px+10,groundY-42); ctx.rotate(baseAng+swingOff);
      const len=clamp(w.range*0.42,18,40);
      if (sw>0) {
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=clamp(sw/0.32,0,1)*0.42;
        ctx.strokeStyle=w.col; ctx.lineWidth=8;
        ctx.beginPath(); ctx.arc(12,2,len*0.9,-0.6,0.9); ctx.stroke(); ctx.restore();
      }
      ctx.strokeStyle=w.col; ctx.lineWidth=2.5; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(len,0); ctx.stroke();
      ctx.strokeStyle="rgba(0,0,0,0.5)"; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(-4,-3); ctx.lineTo(-4,3); ctx.stroke();
      if (w.rarity>=2) {
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.28+sw*0.4;
        ctx.strokeStyle=w.col; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(len,0); ctx.stroke(); ctx.restore();
      }
    } else if (w.type==="ranged") {
      ctx.strokeStyle=w.col; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(px+14,groundY-42,10,-1.25,1.25); ctx.stroke();
      ctx.strokeStyle="rgba(230,216,168,0.65)"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(px+14+10*Math.cos(-1.25),groundY-42+10*Math.sin(-1.25)); ctx.lineTo(px+14+10*Math.cos(1.25),groundY-42+10*Math.sin(1.25)); ctx.stroke();
    } else {
      const upgCount=(player.weaponUpgrades||[]).length;
      ctx.save(); ctx.translate(px+12,groundY-42);
      if (sw>0||upgCount>0) {
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=(sw>0?0.55*sw/0.32:0.18)+(upgCount*0.1);
        ctx.fillStyle=w.col; ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.fill(); ctx.restore();
      }
      drawTomeIcon(w.col, 1.15);
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
  if (player.hp <= 2 || player.hpShowTimer > 0) {
    const n=player.maxHp, gap=9, hy=groundY-86-bob-player.jumpH;
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

  drawAurora(dark); drawStars(dark); drawCelestial(top); drawClouds(dark,top); drawBirds(dark);

  const trees=getTrees();
  drawMountains(trees.mountains,dark);
  drawHills(trees.hills,dark);
  drawTreeLayer(trees.far,0.26,0.78,5);
  drawFogBand(groundY-150,110,dark,0.6);
  drawTreeLayer(trees.mid,0.46,0.50,9);
  drawTreeLayer(trees.near,0.70,0.28,14);
  drawSunShafts(dark);
  drawBackgroundWash(dark);

  const bi=biomeAt(Game.cam+W/2);
  // grass band -> warm earth -> dark loam
  const gg=ctx.createLinearGradient(0,groundY,0,H);
  gg.addColorStop(0,rgb(lerpColor(bi.gT,[14,16,26],dark)));
  gg.addColorStop(0.16,rgb(lerpColor(shade(bi.gT,0.88),[12,14,22],dark)));
  gg.addColorStop(0.34,rgb(lerpColor(lerpColor(bi.gB,[96,72,48],0.3),[9,11,18],dark)));
  gg.addColorStop(1,rgb(lerpColor(lerpColor(bi.gB,[44,32,24],0.5),[6,8,16],dark)));
  ctx.fillStyle=gg; ctx.fillRect(0,groundY,W,H-groundY);
  // sunlit grass lip
  ctx.fillStyle=withA(lerpColor(shade(bi.gT,1.3),[44,48,64],dark),0.6);
  ctx.fillRect(0,groundY,W,2);
  ctx.fillStyle=withA(lerpColor(shade(bi.gT,1.12),[30,34,48],dark),0.3);
  ctx.fillRect(0,groundY+2,W,3);

  const zoom=Game.zoom||1;
  const _sk=Game.screenShake||0;
  const _skx=_sk>0?(Math.random()-0.5)*_sk*12:0, _sky=_sk>0?(Math.random()-0.5)*_sk*7:0;
  ctx.save();
  ctx.translate(W/2+_skx, groundY+_sky); ctx.scale(zoom,zoom); ctx.translate(-W/2-Game.cam,-groundY);
  drawGroundTexture(dark); drawGroundDeco(dark); drawForestTrees(dark); drawLocations(dark);
  drawEntityShadows(); drawPortals(dark); drawWalls(dark); drawBase(dark);
  drawStations(); drawCoins(); drawGroundBows(); drawGroundHammers(); drawLootItems(); drawChests();
  drawAnimals(); drawVagrants(); drawCaltrops(); drawUnits(); drawEnemies(dark); drawLegendaryEffects();
  drawPlayer(dark); drawArrows(); drawPoisonShots(); drawSpells(); drawLevelUpBeams(); drawParticles(); drawCampLight(dark); drawFloats();
  ctx.restore();

  drawLowFog(dark,bi); drawAmbientFront(dark,bi);

  const v=ctx.createRadialGradient(W/2,groundY-60,W*0.18,W/2,groundY-60,W*0.82);
  v.addColorStop(0,"rgba(0,0,0,0)"); v.addColorStop(1,`rgba(4,3,12,${0.22+0.42*dark})`);
  ctx.fillStyle=v; ctx.fillRect(0,0,W,H);

  drawOffscreenIndicators();
  drawWeaponPickupOverlay();
  drawInventoryOverlay();
  drawShopOverlay();
  drawUpgradeMenu();
  if (Game.state === "play") drawXpBar();
  drawLegendaryIntro();
}
