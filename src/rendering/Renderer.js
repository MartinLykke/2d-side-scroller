import { clamp, lerpColor, rgb, lerp, withA, shade } from '../util/math.js';
import { ctx, W, H, groundY } from '../core/canvas.js';
import { Game, state } from '../core/state.js';
import { WEAPONS } from '../config/weapons.js';
import { drawPlayer as drawPlayerBody } from './sprites/Player.js';
import { shootPose, ease, drawBow, limb } from './sprites/Archer.js';
import { darkness, skyColors, drawStars, drawClouds, drawBirds, getTrees, drawHills, drawTreeLayer, drawLowFog, drawAmbientFront, drawLevelUpBeams, biomeAt, FX, windSway } from './Effects.js';

// Import all render modules
import { drawGroundTexture, drawGroundDeco, drawEntityShadows, drawPortals, drawWalls, drawBase, drawStations, drawForestTrees, drawForestCamps, drawBuildings } from './scene/RenderWorld.js';
import { drawVagrants, drawUnits, drawEnemies, drawAnimals } from './scene/RenderEntities.js';
import { drawCoins, drawArrows, drawLootItems, drawChests, drawGroundBows, drawGroundHammers } from './scene/RenderItems.js';
import { drawCaltrops, drawPoisonShots, drawFirePools, drawLegendaryEffects, drawParticles, drawFloats, drawSpells, drawCampLight } from './scene/RenderEffects.js';
import { drawWeaponPickupOverlay, drawInventoryOverlay, drawShopOverlay, drawUpgradeMenu, drawXpBar, drawLegendaryIntro } from './scene/RenderUI.js';
import { drawHeart, drawTomeIcon } from './DrawHelpers.js';

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
  ctx.save(); ctx.globalAlpha=prog*arc.a*0.9;
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
      ctx.translate(px+8,groundY-22); ctx.rotate(baseAng+swingOff);
      const len=clamp(w.range*0.42,18,40);
      ctx.strokeStyle=w.col; ctx.lineWidth=2.5; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(len,0); ctx.stroke();
      ctx.strokeStyle="rgba(0,0,0,0.5)"; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(-4,-3); ctx.lineTo(-4,3); ctx.stroke();
      if (w.rarity>=2) {
        ctx.save(); ctx.globalAlpha=0.18+sw*0.25;
        ctx.strokeStyle=w.col; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(len,0); ctx.stroke(); ctx.restore();
      }
    } else if (w.type==="ranged") {
      const shoot=shootPose(player);
      const frontSh={x:px+5,y:groundY-28}, backSh={x:px-5,y:groundY-28};
      let aim=0.1, pull=0;
      if (shoot) {
        if (shoot.phase==="reach")        aim=ease(shoot.p)*0.4;
        else if (shoot.phase==="draw")    { aim=0.4+ease(shoot.p)*0.6; pull=ease(shoot.p); }
        else if (shoot.phase==="release") { aim=1; pull=1-shoot.p; }
        else                              aim=1-ease(shoot.p)*0.7;
      }
      const grip={x:frontSh.x+4+aim*7,y:frontSh.y+7-aim*8};
      let drawHand=null;
      if (shoot) {
        if (shoot.phase==="reach") { const p=ease(shoot.p); drawHand={x:backSh.x+2-p*6,y:backSh.y+8-p*14}; }
        else if (shoot.phase==="draw") { const p=ease(shoot.p); drawHand={x:(1-p)*(grip.x+4)+p*(px+1),y:(1-p)*(backSh.y-6)+p*(groundY-37+3)}; }
        else if (shoot.phase==="release") drawHand={x:px-1-shoot.p*3,y:groundY-37+3+shoot.p*2};
        else { const p=ease(shoot.p); drawHand={x:px-4-p*3,y:groundY-37+5+p*9}; }
        limb(backSh.x,backSh.y,drawHand.x,drawHand.y,"#d3ac82",2.5);
        if ((shoot.phase==="draw" && shoot.p>0.3) || shoot.phase==="release") {
          const nockX = shoot.phase==="draw" ? drawHand.x : grip.x+5;
          ctx.strokeStyle=w.col; ctx.lineWidth=1.4;
          ctx.beginPath(); ctx.moveTo(nockX,drawHand.y); ctx.lineTo(grip.x+9,grip.y); ctx.stroke();
          ctx.fillStyle="#b8bcc4";
          ctx.beginPath(); ctx.moveTo(grip.x+9,grip.y-1.6); ctx.lineTo(grip.x+12.5,grip.y); ctx.lineTo(grip.x+9,grip.y+1.6); ctx.closePath(); ctx.fill();
        }
      } else {
        limb(backSh.x,backSh.y,backSh.x-2,backSh.y+11,"#d3ac82",2.5);
      }
      drawBow(grip.x, grip.y, aim, pull, shoot && shoot.phase==="draw" ? drawHand : null);
      limb(frontSh.x,frontSh.y,grip.x,grip.y,"#d3ac82",2.6);
    } else {
      const upgCount=(player.weaponUpgrades||[]).length;
      ctx.save(); ctx.translate(px+9,groundY-22);
      if (sw>0||upgCount>0) {
        ctx.save(); ctx.globalAlpha=(sw>0?0.32*sw/0.32:0.12)+(upgCount*0.06);
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

  drawStars(dark); drawClouds(dark,top); drawBirds(dark);

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
  drawGroundTexture(dark); drawGroundDeco(dark); drawForestTrees(dark); drawForestCamps(dark);
  drawEntityShadows(); drawPortals(dark); drawWalls(dark); drawBuildings(dark); drawBase(dark);
  drawStations(); drawCoins(); drawGroundBows(); drawGroundHammers(); drawLootItems(); drawChests();
  drawAnimals(); drawVagrants(); drawCaltrops(); drawFirePools(); drawUnits(); drawEnemies(dark); drawLegendaryEffects();
  drawPlayer(dark); drawArrows(); drawPoisonShots(); drawSpells(); drawLevelUpBeams(); drawParticles(); drawCampLight(dark); drawFloats();
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
