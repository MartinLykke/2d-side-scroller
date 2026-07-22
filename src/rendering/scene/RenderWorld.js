import { clamp, lerp, lerpColor, rgb, withA, shade, atmo, hazeColor, mulberry32, rand } from '../../util/math.js';
import { CFG, STATIONS_X } from '../../config/config.js';
import { ctx, H, groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { FX, biomeAt, getGroundTex, getDeco, windGust, windSway, drawTree, makeTree } from '../Effects.js';
import { visibleWorldBounds } from '../Viewport.js';
import { wallHeight, wallRenderWidth, wallLayout, bridgeSpan } from '../../entities/Wall.js';
import { groundShadow, roundedRect, woodCol, litWindow, drawHpBar } from '../DrawHelpers.js';
import { ENEMY_TYPES } from '../../config/enemies.js';
import { renderBudget } from '../RenderFrame.js';
import { castleUpgradeLevel } from '../../util/DefenseStats.js';

// ---------- Ground ----------
// True when a ground doodad would sit inside a pond's water footprint.
function overPond(x, margin = 0) {
  for (const p of (state.ponds || [])) if (Math.abs(x - p.x) < p.hw + margin) return true;
  return false;
}

export function drawGroundTexture(dark) {
  const tex=getGroundTex(), view=visibleWorldBounds(30), camL=view.left, camR=view.right;
  const groundDetail = renderBudget().groundDetail;
  for (const p of tex.patches) {
    if (p.x<camL||p.x>camR) continue;
    const b=biomeAt(p.x);
    const swamp = b.deco==="swamp";
    const col=swamp
      ? lerpColor(p.light?[42,70,54]:[22,42,38],[6,12,16],dark)
      : lerpColor(p.light?shade(b.gT,1.16):shade(b.gT,0.8),[12,14,22],dark);
    ctx.fillStyle=withA(col,swamp?0.68:0.5); ctx.beginPath(); ctx.ellipse(p.x,groundY+7+p.dy,p.r,p.r*(swamp?0.32:0.4),0,0,Math.PI*2); ctx.fill();
    if (swamp && p.light && p.r > 14) {
      ctx.fillStyle=withA(lerpColor([80,104,66],[8,18,18],dark),0.32);
      ctx.beginPath(); ctx.ellipse(p.x,groundY+6+p.dy,p.r*0.72,p.r*0.14,0,0,Math.PI*2); ctx.fill();
    }
  }
  const pebbleStep = groundDetail === 0 ? 2 : 1;
  for (let i = 0; i < tex.pebbles.length; i += pebbleStep) {
    const p = tex.pebbles[i];
    if (p.x<camL||p.x>camR) continue;
    ctx.fillStyle=withA(lerpColor([120,118,124],[40,40,52],dark),0.7); ctx.beginPath(); ctx.ellipse(p.x,groundY+9+p.dy,p.r,p.r*0.7,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=withA(lerpColor([200,200,206],[70,72,86],dark),0.35); ctx.beginPath(); ctx.ellipse(p.x-p.r*0.25,groundY+8.4+p.dy,p.r*0.5,p.r*0.3,0,0,Math.PI*2); ctx.fill();
  }
  // fine dirt speckles give the soil grain
  if (groundDetail > 0 && tex.specks) for (const s of tex.specks) {
    if (s.x<camL||s.x>camR) continue;
    const b=biomeAt(s.x);
    const col=s.light?lerpColor(shade(b.gB,1.5),[60,64,80],dark):lerpColor(shade(b.gB,0.55),[8,10,16],dark);
    ctx.fillStyle=withA(col,0.55);
    ctx.fillRect(s.x,groundY+s.dy,s.r*2,s.r);
  }
  ctx.lineCap="round";
  const plx=state.player?state.player.x:null;
  // packed-earth courtyard: no grass between the camp and its built walls
  let clearL=CFG.baseX, clearR=CFG.baseX;
  for (const w of state.walls) {
    if (!w.commissioned || w.buildProgress < 0.95) continue;
    if (w.x < CFG.baseX) clearL=Math.min(clearL, w.x); else clearR=Math.max(clearR, w.x);
  }
  for (let i = 0; i < tex.fringe.length; i++) {
    if (groundDetail === 0 && (i & 1)) continue;
    const f = tex.fringe[i];
    if (f.x<camL||f.x>camR) continue;
    if (f.x>clearL && f.x<clearR) continue;
    if (overPond(f.x, -4)) continue; // no grass growing out of the water
    // thin out grass blades right in front of the player so the figure stays clear
    if (plx!==null) {
      const d=Math.abs(f.x-plx);
      if (d<70) { ctx.globalAlpha=Math.max(0.3,d/70); } else ctx.globalAlpha=1;
    }
    const b=biomeAt(f.x);
    if ((b.dry || b.hot || b.corrupt) && ((f.x * 17 + f.ph * 100) | 0) % 3 === 0) continue;
    const col=b.snow?lerpColor([226,233,243],[120,140,170],dark):
      b.deco==="desert"?lerpColor([188,144,78],[58,42,30],dark):
      b.deco==="volcano"?lerpColor([90,76,66],[24,20,22],dark):
      b.deco==="corrupted"?lerpColor([84,58,96],[20,16,28],dark):
      b.deco==="swamp"?lerpColor(f.lt?[92,116,58]:[42,82,64],[8,22,20],dark):
      lerpColor(shade(b.gT,f.lt?1.28:1.04),[18,26,18],dark);
    const sway=windSway(f.ph,4);
    ctx.strokeStyle=rgb(col); ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(f.x,groundY+2); ctx.quadraticCurveTo(f.x+sway*0.5,groundY-f.h*0.6,f.x+sway,groundY-f.h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(f.x+3,groundY+2); ctx.quadraticCurveTo(f.x+3+sway*0.4,groundY-f.h*0.5,f.x+3+sway*0.8,groundY-f.h*0.8); ctx.stroke();
    // pale inner blade for a two-tone tuft
    if (!b.snow) {
      ctx.strokeStyle=withA(lerpColor(shade(b.gT,1.45),[36,48,36],dark),0.8); ctx.lineWidth=1.1;
      ctx.beginPath(); ctx.moveTo(f.x+1.5,groundY+2); ctx.quadraticCurveTo(f.x+1.5+sway*0.45,groundY-f.h*0.55,f.x+1.5+sway*0.9,groundY-f.h*0.9); ctx.stroke();
    }
  }
  ctx.globalAlpha=1;
  ctx.lineCap="butt";
}

function drawDeco(it, b, dark) {
  const x=it.x, s=it.s, sway=windSway(it.ph,5)*s*0.5;
  const g1=lerpColor(shade(b.gT,0.55),[8,12,18],dark);
  ctx.lineCap="round";
  switch (it.kind) {
    case "grass": case "snowtuft": {
      const col=it.kind==="snowtuft"?lerpColor([230,238,248],[120,140,170],dark):g1;
      ctx.strokeStyle=rgb(col); ctx.lineWidth=1.6*s;
      for (let i=-2;i<=2;i++){ ctx.beginPath(); ctx.moveTo(x+i*2.4*s,groundY); ctx.quadraticCurveTo(x+i*2.4*s+sway*0.5,groundY-(7-Math.abs(i))*s,x+i*3.4*s+sway,groundY-(13-Math.abs(i)*2.5)*s); ctx.stroke(); }
      if (it.kind==="grass") {
        ctx.strokeStyle=withA(lerpColor(shade(b.gT,1.35),[30,44,30],dark),0.85); ctx.lineWidth=1*s;
        ctx.beginPath(); ctx.moveTo(x,groundY); ctx.quadraticCurveTo(x+sway*0.55,groundY-8*s,x+sway*1.1,groundY-14*s); ctx.stroke();
      } break; }
    case "flower": {
      ctx.strokeStyle=rgb(g1); ctx.lineWidth=1.4*s; ctx.beginPath(); ctx.moveTo(x,groundY); ctx.quadraticCurveTo(x+sway*0.5,groundY-8*s,x+sway,groundY-13*s); ctx.stroke();
      ctx.fillStyle=it.flower; ctx.beginPath(); ctx.arc(x+sway,groundY-14*s,2.4*s,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="rgba(255,240,160,0.9)"; ctx.beginPath(); ctx.arc(x+sway,groundY-14*s,1*s,0,Math.PI*2); ctx.fill(); break; }
    case "stone": {
      ctx.fillStyle=rgb(lerpColor([110,112,120],[30,32,42],dark)); ctx.beginPath(); ctx.ellipse(x,groundY-3*s,6*s,4*s,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="rgba(255,255,255,0.12)"; ctx.beginPath(); ctx.ellipse(x-1.5*s,groundY-4.5*s,3*s,1.6*s,0,0,Math.PI*2); ctx.fill(); break; }
    case "iceShard": {
      const base=lerpColor([178,214,236],[56,82,112],dark);
      const hi=lerpColor([242,250,255],[120,150,190],dark);
      for (let i=-1;i<=1;i++) {
        const h=(15+Math.abs(i)*4)*s, w=(4+Math.abs(i))*s, bx=x+i*5*s;
        ctx.fillStyle=rgb(base);
        ctx.beginPath(); ctx.moveTo(bx-w,groundY); ctx.lineTo(bx,groundY-h); ctx.lineTo(bx+w,groundY); ctx.closePath(); ctx.fill();
        ctx.fillStyle=withA(hi,0.45);
        ctx.beginPath(); ctx.moveTo(bx,groundY-h); ctx.lineTo(bx+w*0.32,groundY-2*s); ctx.lineTo(bx,groundY); ctx.closePath(); ctx.fill();
      } break; }
    case "sandstone": {
      ctx.fillStyle=rgb(lerpColor([178,126,68],[56,38,28],dark));
      ctx.beginPath(); ctx.ellipse(x,groundY-4*s,11*s,5*s,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=withA(lerpColor([230,180,104],[88,62,40],dark),0.7);
      ctx.fillRect(x-8*s,groundY-6*s,14*s,1.4*s);
      ctx.fillRect(x-5*s,groundY-2.5*s,10*s,1*s);
      break; }
    case "drygrass": {
      ctx.strokeStyle=rgb(lerpColor([168,132,70],[44,34,22],dark)); ctx.lineWidth=1.5*s;
      for (let i=-2;i<=2;i++) {
        const h=(10+Math.abs(i%2)*5)*s, bx=x+i*2.6*s;
        ctx.beginPath(); ctx.moveTo(bx,groundY+1); ctx.quadraticCurveTo(bx+sway*0.4,groundY-h*0.45,bx+i*2*s+sway*0.9,groundY-h); ctx.stroke();
      } break; }
    case "smallCactus": {
      const col=lerpColor([74,132,82],[24,62,42],dark);
      ctx.strokeStyle=rgb(col); ctx.lineCap="round"; ctx.lineWidth=4*s;
      ctx.beginPath(); ctx.moveTo(x,groundY); ctx.lineTo(x,groundY-18*s); ctx.stroke();
      ctx.lineWidth=2.8*s;
      ctx.beginPath(); ctx.moveTo(x,groundY-10*s); ctx.lineTo(x-8*s,groundY-10*s); ctx.lineTo(x-8*s,groundY-16*s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x,groundY-13*s); ctx.lineTo(x+7*s,groundY-13*s); ctx.lineTo(x+7*s,groundY-19*s); ctx.stroke();
      ctx.lineCap="butt";
      break; }
    case "dustPatch": {
      ctx.fillStyle=withA(lerpColor([224,182,110],[76,54,36],dark),0.34);
      ctx.beginPath(); ctx.ellipse(x,groundY-1*s,18*s,3.4*s,0,0,Math.PI*2); ctx.fill();
      break; }
    case "lavaCrack": {
      ctx.save(); ctx.globalCompositeOperation="lighter";
      ctx.strokeStyle=withA(lerpColor([255,112,34],[132,30,18],dark),0.82); ctx.lineWidth=2*s;
      ctx.beginPath(); ctx.moveTo(x-13*s,groundY-1); ctx.lineTo(x-4*s,groundY-5*s); ctx.lineTo(x+3*s,groundY-2*s); ctx.lineTo(x+14*s,groundY-7*s); ctx.stroke();
      ctx.strokeStyle=withA([255,206,86],0.55); ctx.lineWidth=0.9*s;
      ctx.beginPath(); ctx.moveTo(x-8*s,groundY-2*s); ctx.lineTo(x+6*s,groundY-4*s); ctx.stroke();
      ctx.restore();
      break; }
    case "ashVent": {
      ctx.fillStyle=rgb(lerpColor([58,52,48],[18,16,18],dark));
      ctx.beginPath(); ctx.ellipse(x,groundY-2*s,9*s,4*s,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=withA(lerpColor([190,180,166],[70,66,76],dark),0.18);
      const t=performance.now()/1000+it.ph;
      for (let i=0;i<3;i++) {
        const ph=(t*0.25+i*0.33)%1;
        ctx.beginPath(); ctx.arc(x+Math.sin(t+i)*4*s,groundY-12*s-ph*18*s,4*s+ph*5*s,0,Math.PI*2); ctx.fill();
      } break; }
    case "obsidian": {
      ctx.fillStyle=rgb(lerpColor([30,28,36],[8,8,14],dark));
      ctx.beginPath(); ctx.moveTo(x-6*s,groundY); ctx.lineTo(x-1*s,groundY-22*s); ctx.lineTo(x+8*s,groundY); ctx.closePath(); ctx.fill();
      ctx.fillStyle=withA(lerpColor([120,92,146],[40,30,60],dark),0.42);
      ctx.beginPath(); ctx.moveTo(x-1*s,groundY-22*s); ctx.lineTo(x+2*s,groundY-2*s); ctx.lineTo(x+8*s,groundY); ctx.closePath(); ctx.fill();
      break; }
    case "corruptShard": {
      ctx.save(); ctx.globalCompositeOperation="lighter";
      ctx.fillStyle=withA(lerpColor([176,88,255],[70,34,120],dark),0.82);
      ctx.beginPath(); ctx.moveTo(x-7*s,groundY); ctx.lineTo(x,groundY-26*s); ctx.lineTo(x+8*s,groundY); ctx.lineTo(x+1*s,groundY-4*s); ctx.closePath(); ctx.fill();
      ctx.fillStyle=withA([236,210,255],0.38);
      ctx.beginPath(); ctx.moveTo(x,groundY-24*s); ctx.lineTo(x+3*s,groundY-4*s); ctx.lineTo(x,groundY); ctx.closePath(); ctx.fill();
      ctx.restore();
      break; }
    case "deadRoot": {
      ctx.strokeStyle=rgb(lerpColor([72,50,38],[18,14,16],dark)); ctx.lineWidth=2*s; ctx.lineCap="round";
      for (let i=-1;i<=1;i++) {
        ctx.beginPath(); ctx.moveTo(x,groundY);
        ctx.quadraticCurveTo(x+i*9*s+sway*0.2,groundY-8*s,x+i*19*s,groundY-4*s);
        ctx.stroke();
      }
      ctx.lineCap="butt";
      break; }
    case "bogBubble": {
      ctx.fillStyle=withA(lerpColor([90,118,62],[18,28,20],dark),0.58);
      ctx.beginPath(); ctx.ellipse(x,groundY-1*s,13*s,4*s,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=withA(lerpColor([178,214,132],[70,96,70],dark),0.5); ctx.lineWidth=1*s;
      for (let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(x+(i-1)*5*s,groundY-5*s-(i%2)*2*s,2.4*s,0,Math.PI*2); ctx.stroke(); }
      break; }
    case "stump": {
      ctx.fillStyle=rgb(lerpColor([96,68,40],[24,20,18],dark)); ctx.fillRect(x-5*s,groundY-8*s,10*s,8*s);
      ctx.fillStyle=rgb(lerpColor([132,98,60],[40,32,24],dark)); ctx.beginPath(); ctx.ellipse(x,groundY-8*s,5*s,2.2*s,0,0,Math.PI*2); ctx.fill(); break; }
    case "leafpile": {
      ctx.fillStyle=rgb(lerpColor([150,90,40],[40,30,20],dark));
      for (let i=0;i<5;i++){ ctx.beginPath(); ctx.arc(x+(i-2)*3*s,groundY-2*s-(i%2)*2,2.4*s,0,Math.PI*2); ctx.fill(); } break; }
    case "reed": {
      ctx.strokeStyle=rgb(lerpColor([120,130,70],[20,28,20],dark)); ctx.lineWidth=1.6*s;
      for (let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(x+i*3*s,groundY); ctx.quadraticCurveTo(x+i*3*s+sway,groundY-14*s,x+i*4*s+sway*1.4,groundY-22*s); ctx.stroke(); } break; }
    case "fern": {
      ctx.strokeStyle=rgb(lerpColor([46,90,60],[14,28,24],dark)); ctx.lineWidth=1.4*s;
      for (let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(x,groundY); ctx.quadraticCurveTo(x+i*8*s+sway,groundY-8*s,x+i*14*s+sway,groundY-4*s); ctx.stroke(); } break; }
    case "mushroom": {
      ctx.fillStyle=rgb(lerpColor([200,200,190],[60,60,70],dark)); ctx.fillRect(x-1.2*s,groundY-6*s,2.4*s,6*s);
      ctx.fillStyle=b.deco==="swamp"?"#9a6a3a":"#c34b3a"; ctx.beginPath(); ctx.ellipse(x,groundY-6*s,4*s,3*s,0,Math.PI,0); ctx.fill();
      ctx.fillStyle="rgba(255,255,255,0.6)"; ctx.beginPath(); ctx.arc(x-1.5*s,groundY-7*s,0.7*s,0,Math.PI*2); ctx.fill(); break; }
    case "tallgrass": {
      // waist-high grass clump with nodding seed heads
      const col=lerpColor(shade(b.gT,0.8),[12,18,16],dark);
      const hi=lerpColor(shade(b.gT,1.3),[30,42,32],dark);
      ctx.lineWidth=1.6*s;
      for (let i=-2;i<=2;i++) {
        const h=(21-Math.abs(i)*3)*s, bx=x+i*2.8*s;
        ctx.strokeStyle=rgb(i%2?col:hi);
        ctx.beginPath(); ctx.moveTo(bx,groundY+1);
        ctx.quadraticCurveTo(bx+sway*0.7,groundY-h*0.55,bx+i*1.5*s+sway*1.4,groundY-h);
        ctx.stroke();
      }
      ctx.fillStyle=withA(lerpColor(shade(b.gT,1.5),[52,58,44],dark),0.9);
      for (const i of [-1,1]) {
        const h=(21-Math.abs(i)*3)*s;
        ctx.beginPath(); ctx.ellipse(x+i*1.5*s+sway*1.4,groundY-h,1.2*s,3*s,sway*0.03,0,Math.PI*2); ctx.fill();
      } break; }
    case "bush": {
      // low leafy shrub, sometimes berry-laden
      const dcol=lerpColor(shade(b.gT,0.5),[10,14,14],dark);
      const lcol=lerpColor(shade(b.gT,0.95),[20,28,24],dark);
      ctx.fillStyle=rgb(dcol);
      ctx.beginPath();
      ctx.arc(x-6*s,groundY-4*s,5.5*s,0,Math.PI*2);
      ctx.arc(x+5*s,groundY-4*s,6*s,0,Math.PI*2);
      ctx.arc(x,groundY-8*s,6.5*s,0,Math.PI*2);
      ctx.fill();
      ctx.fillStyle=rgb(lcol);
      ctx.beginPath();
      ctx.arc(x-4*s,groundY-8*s,4*s,0,Math.PI*2);
      ctx.arc(x+3*s,groundY-9.5*s,3.6*s,0,Math.PI*2);
      ctx.fill();
      if (it.berry) {
        ctx.fillStyle=rgb(lerpColor([204,62,72],[72,26,34],dark));
        for (let i=0;i<5;i++) {
          ctx.beginPath();
          ctx.arc(x+Math.sin(i*2.1+x)*6*s,groundY-4*s-((i*7+(x|0))%6)*s,1.1*s,0,Math.PI*2);
          ctx.fill();
        }
      } break; }
    case "sapling": {
      // young tree pushing up through the undergrowth
      ctx.strokeStyle=rgb(lerpColor([96,72,46],[26,22,18],dark)); ctx.lineWidth=1.8*s;
      ctx.beginPath(); ctx.moveTo(x,groundY+1);
      ctx.quadraticCurveTo(x+sway*0.4,groundY-9*s,x+sway,groundY-17*s); ctx.stroke();
      ctx.fillStyle=rgb(lerpColor(shade(b.gT,0.9),[16,24,20],dark));
      ctx.beginPath();
      ctx.arc(x+sway,groundY-19*s,4.6*s,0,Math.PI*2);
      ctx.arc(x+sway-3*s,groundY-15*s,3.2*s,0,Math.PI*2);
      ctx.arc(x+sway+3.4*s,groundY-15.5*s,3*s,0,Math.PI*2);
      ctx.fill();
      ctx.fillStyle=rgb(lerpColor(shade(b.gT,1.25),[30,40,30],dark));
      ctx.beginPath(); ctx.arc(x+sway-1*s,groundY-20*s,2.4*s,0,Math.PI*2); ctx.fill();
      break; }
  }
  ctx.lineCap="butt";
}

export function drawGroundDeco(dark) {
  const items=getDeco().items, view=visibleWorldBounds(40), camL=view.left, camR=view.right;
  const step = renderBudget().groundDetail === 0 ? 2 : 1;
  const px=state.player?state.player.x:null;
  for (let i = 0; i < items.length; i += step) {
    const it = items[i];
    if (it.x<camL||it.x>camR) continue;
    if (overPond(it.x, -2)) continue; // ponds get their own shoreline dressing
    // fade small clutter near the player so characters stay easy to spot
    const d=px===null?999:Math.abs(it.x-px);
    if (d<110) {
      ctx.save(); ctx.globalAlpha=Math.max(0.25,d/110);
      drawDeco(it,biomeAt(it.x),dark);
      ctx.restore();
    } else drawDeco(it,biomeAt(it.x),dark);
  }
}

// ---------- Ponds ----------
// Shallow forest ponds: mud bank, gradient water, drifting glints, lilypads,
// cattails on the shores, and ripple rings for anything wading through.
function pondRipple(x, y, r, alpha) {
  ctx.strokeStyle = `rgba(220,235,240,${alpha})`;
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.28, 0, 0, Math.PI * 2); ctx.stroke();
}

export function drawPonds(dark) {
  const ponds = state.ponds;
  if (!ponds || !ponds.length) return;
  const t = performance.now() / 1000;
  const view = visibleWorldBounds(80), camL = view.left, camR = view.right;

  for (const p of ponds) {
    if (p.x + p.hw < camL || p.x - p.hw > camR) continue;
    const biome = biomeAt(p.x);
    if (biome.dry || biome.hot || biome.corrupt) continue;
    const swamp = biome.deco==="swamp";
    const r = mulberry32(p.seed);
    const hw = p.hw;
    const sy = groundY + 1.5;                 // waterline sits just under the grass lip
    const depth = 13 + hw * 0.045;

    // mud bank ring under the water
    ctx.fillStyle = rgb(lerpColor([58, 44, 32], [14, 12, 14], dark));
    ctx.beginPath(); ctx.ellipse(p.x, sy + 1, hw + 14, depth + 5, 0, 0, Math.PI); ctx.fill();

    // water body: flat surface, curved bed
    const shallow = biome.snow
      ? lerpColor([204, 226, 238], [74, 94, 124], dark)
      : swamp ? lerpColor([76, 98, 58], [16, 28, 24], dark)
      : lerpColor([96, 138, 148], [24, 34, 52], dark);
    const deep = biome.snow
      ? lerpColor([150, 182, 210], [34, 48, 76], dark)
      : swamp ? lerpColor([18, 46, 38], [4, 12, 14], dark)
      : lerpColor([34, 66, 78], [8, 14, 26], dark);
    const wg = ctx.createLinearGradient(0, sy, 0, sy + depth);
    wg.addColorStop(0, rgb(shallow));
    wg.addColorStop(1, rgb(deep));
    ctx.fillStyle = wg;
    ctx.beginPath(); ctx.ellipse(p.x, sy, hw, depth, 0, 0, Math.PI); ctx.fill();

    // sky sheen along the surface
    ctx.fillStyle = withA(swamp ? lerpColor([150, 170, 92], [38, 58, 44], dark) : lerpColor([196, 224, 228], [90, 120, 160], dark), swamp ? 0.24 : 0.4);
    ctx.fillRect(p.x - hw + 4, sy, hw * 2 - 8, 1.6);
    if (biome.snow) {
      ctx.fillStyle = withA(lerpColor([232, 244, 250], [112, 138, 170], dark), 0.72);
      ctx.beginPath(); ctx.ellipse(p.x, sy + depth * 0.15, hw * 0.94, depth * 0.65, 0, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = withA(lerpColor([126, 174, 206], [48, 68, 96], dark), 0.45);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(p.x - hw * 0.55, sy + 4); ctx.lineTo(p.x - hw * 0.12, sy + 7); ctx.lineTo(p.x + hw * 0.08, sy + 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p.x + hw * 0.2, sy + 6); ctx.lineTo(p.x + hw * 0.58, sy + 3); ctx.stroke();
      continue;
    }
    // moon glint at night
    if (dark > 0.45) {
      ctx.fillStyle = `rgba(210,225,255,${0.16 * dark})`;
      ctx.beginPath(); ctx.ellipse(p.x + hw * 0.2, sy + 2.5, hw * 0.3, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    }

    // drifting light glints on the water
    for (let k = 0; k < 5; k++) {
      const ph = (t * 0.25 + k / 5 + r() * 0.3) % 1;
      const gx = p.x - hw * 0.8 + ph * hw * 1.6;
      const ga = Math.sin(ph * Math.PI) * (0.22 - dark * 0.1);
      if (ga <= 0.02) continue;
      ctx.strokeStyle = `rgba(230,244,246,${ga})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(gx - 6 - Math.sin(t * 1.3 + k * 2) * 3, sy + 2 + (k % 3) * 2.4);
      ctx.lineTo(gx + 6 + Math.sin(t * 1.7 + k) * 3, sy + 2 + (k % 3) * 2.4);
      ctx.stroke();
    }

    // idle ripple rings opening up here and there
    for (let k = 0; k < 3; k++) {
      const cyc = 3 + k;
      const ph = ((t + k * 1.7 + p.seed % 7) % cyc) / cyc;
      const rx = p.x + (r() * 2 - 1) * hw * 0.6;
      if (ph < 0.55) pondRipple(rx, sy + 2.5, 3 + ph * 22, (0.55 - ph) * 0.5);
    }

    // ---- seeded shoreline dressing ----
    // lilypads floating near the middle
    const pads = (swamp ? 4 : 2) + Math.floor(r() * (hw / (swamp ? 46 : 60)));
    for (let k = 0; k < pads; k++) {
      const px = p.x + (r() * 2 - 1) * hw * 0.62;
      const ps = 0.7 + r() * 0.7;
      const flower = r() < 0.3;
      const bob = Math.sin(t * 1.1 + px * 0.13) * 0.7;
      ctx.fillStyle = rgb(lerpColor(swamp ? [74, 102, 42] : [64, 108, 62], [18, 32, 26], dark));
      ctx.beginPath(); ctx.ellipse(px, sy + 1.5 + bob, 7 * ps, 2.6 * ps, 0, 0, Math.PI * 2); ctx.fill();
      // notch cut toward the stem
      ctx.fillStyle = rgb(shallow);
      ctx.beginPath(); ctx.moveTo(px, sy + 1.5 + bob);
      ctx.lineTo(px + 8 * ps, sy + 0.4 + bob); ctx.lineTo(px + 8 * ps, sy + 2.6 + bob);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = withA([255, 255, 255], 0.1);
      ctx.beginPath(); ctx.ellipse(px - 1.5 * ps, sy + 0.9 + bob, 3 * ps, 1 * ps, 0, 0, Math.PI * 2); ctx.fill();
      if (flower) { // the odd white lily flower
        ctx.fillStyle = rgb(lerpColor([238, 234, 220], [110, 115, 140], dark));
        ctx.beginPath(); ctx.arc(px - 2, sy - 0.8 + bob, 2.2 * ps, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#e8c050";
        ctx.beginPath(); ctx.arc(px - 2, sy - 0.8 + bob, 0.8 * ps, 0, Math.PI * 2); ctx.fill();
      }
    }

    // cattails and reeds hugging each shore
    for (const side of [-1, 1]) {
      const n = 2 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const rx = p.x + side * (hw - 6 + r() * 26);
        const rh = 20 + r() * 14;
        const cattail = r() < 0.6;
        const sway = windSway(rx * 0.3, 3);
        ctx.strokeStyle = rgb(lerpColor([106, 122, 62], [22, 30, 24], dark));
        ctx.lineWidth = 1.7;
        ctx.beginPath(); ctx.moveTo(rx, groundY + 2);
        ctx.quadraticCurveTo(rx + sway * 0.6, groundY - rh * 0.6, rx + sway, groundY - rh);
        ctx.stroke();
        if (cattail) { // brown cattail head
          ctx.fillStyle = rgb(lerpColor([104, 68, 40], [30, 22, 18], dark));
          ctx.beginPath(); ctx.ellipse(rx + sway, groundY - rh + 2, 1.7, 5, sway * 0.02, 0, Math.PI * 2); ctx.fill();
        }
        // slim leaf blade
        ctx.strokeStyle = rgb(lerpColor([88, 112, 58], [18, 26, 22], dark));
        ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(rx + 2, groundY + 2);
        ctx.quadraticCurveTo(rx + 5 + sway, groundY - rh * 0.5, rx + 9 + sway * 1.3, groundY - rh * 0.75);
        ctx.stroke();
      }
      // a wet shore stone or two
      if (r() < 0.7) {
        const stx = p.x + side * (hw + 6 + r() * 14);
        const sts = 0.7 + r() * 0.7;
        ctx.fillStyle = rgb(lerpColor([104, 104, 110], [28, 30, 40], dark));
        ctx.beginPath(); ctx.ellipse(stx, groundY + 1 - 2 * sts, 5.5 * sts, 3.6 * sts, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.13)";
        ctx.beginPath(); ctx.ellipse(stx - 1.4 * sts, groundY - 3 * sts, 2.6 * sts, 1.3 * sts, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ---- wading ripples: anything walking through the shallow water ----
    // check entities directly instead of building a temporary array each pond
    const checkWader = (wd) => {
      if (Math.abs(wd.x - p.x) >= hw - 12) return;
      const moving = Math.abs(wd.vx || 0) > 5;
      pondRipple(wd.x, sy + 2.5, 9 + Math.sin(t * 5 + wd.x) * 1.5, 0.34);
      pondRipple(wd.x - (wd.vx > 0 ? 8 : -8), sy + 2.5, 14, moving ? 0.2 : 0.08);
      if (moving && Math.random() < 0.25) {
        ctx.fillStyle = "rgba(215,235,240,0.45)";
        ctx.beginPath();
        ctx.arc(wd.x + (Math.random() * 12 - 6), sy - (1 + Math.random() * 4), 0.6 + Math.random() * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    if (state.player) checkWader(state.player);
    for (const u of state.units) checkWader(u);
    for (const v of state.vagrants) checkWader(v);
    for (const e of state.enemies) { if (!e.fy || e.fy >= -4) checkWader(e); }
    for (const a of state.animals) { if (a.alive && a.type !== "duck" && !(a.fy < 0)) checkWader(a); }
  }
}

// ---------- Building pieces ----------
function drawTorch(x, y) {
  const t=performance.now()/1000;
  // per-torch flicker phase so neighbouring torches don't pulse in unison
  const fl=0.74 + 0.24*Math.sin(t*9 + x*0.73) + 0.12*Math.sin(t*23.3 + x*1.91);
  const sway=Math.sin(t*7+x*0.7)*1.4+windGust()*0.6;
  const fy=y-16;
  // handle with wrapped head
  ctx.strokeStyle="#3a2a1a"; ctx.lineWidth=2.4; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y-12); ctx.stroke(); ctx.lineCap="butt";
  ctx.fillStyle="#5a4226"; ctx.fillRect(x-2.2,y-14,4.4,4);
  ctx.strokeStyle="rgba(0,0,0,0.35)"; ctx.lineWidth=0.8;
  ctx.beginPath(); ctx.moveTo(x-2.2,y-12.6); ctx.lineTo(x+2.2,y-11.4); ctx.stroke();
  // soft layered glow — wide faint halo + tighter warm core
  ctx.save(); ctx.globalCompositeOperation="lighter";
  let rg=ctx.createRadialGradient(x,fy,1,x,fy,30*fl);
  rg.addColorStop(0,"rgba(255,180,80,0.34)");
  rg.addColorStop(0.5,"rgba(255,120,40,0.13)");
  rg.addColorStop(1,"rgba(255,80,20,0)");
  ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(x,fy,30*fl,0,Math.PI*2); ctx.fill();
  rg=ctx.createRadialGradient(x,fy,0.5,x,fy,11*fl);
  rg.addColorStop(0,"rgba(255,220,140,0.55)");
  rg.addColorStop(1,"rgba(255,140,40,0)");
  ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(x,fy,11*fl,0,Math.PI*2); ctx.fill();
  ctx.restore();
  // teardrop flame, swaying, three tones
  const drop=(w,h,col)=>{ ctx.fillStyle=col; ctx.beginPath();
    ctx.moveTo(x,fy+h*0.45);
    ctx.quadraticCurveTo(x-w,fy+h*0.1,x+sway*0.5,fy-h*0.55);
    ctx.quadraticCurveTo(x+sway,fy-h*(0.9+0.25*fl),x+sway*0.9,fy-h*(0.9+0.25*fl));
    ctx.quadraticCurveTo(x+w,fy+h*0.1,x,fy+h*0.45); ctx.fill(); };
  drop(4.6,9,"rgba(255,120,30,0.92)");
  drop(3.2,6.6,"rgba(255,190,70,0.95)");
  drop(1.8,4,"rgba(255,244,200,0.98)");
  // rising ember spark
  const sp=(t*1.3+x*0.13)%1;
  ctx.fillStyle=`rgba(255,200,110,${0.8*(1-sp)})`;
  ctx.beginPath(); ctx.arc(x+Math.sin(t*5+x)*3,fy-8-sp*16,1.1,0,Math.PI*2); ctx.fill();
}

function drawCampfire(x, dark = 0) {
  const t=performance.now()/1000, fl=(FX&&FX.flicker)||1, wind=windGust()*0.3;
  // night-time light pool: wide warm dome + lit ground ellipse
  if (dark > 0.05) {
    ctx.save(); ctx.globalCompositeOperation="lighter";
    const R=110*(0.9+0.1*fl);
    let rg=ctx.createRadialGradient(x,groundY-14,4,x,groundY-14,R);
    rg.addColorStop(0,`rgba(255,160,60,${0.30*dark})`);
    rg.addColorStop(0.45,`rgba(255,110,35,${0.13*dark})`);
    rg.addColorStop(1,"rgba(255,70,20,0)");
    ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(x,groundY-14,R,0,Math.PI*2); ctx.fill();
    rg=ctx.createRadialGradient(x,groundY+2,4,x,groundY+2,80);
    rg.addColorStop(0,`rgba(255,170,80,${0.28*dark*fl})`);
    rg.addColorStop(1,"rgba(255,110,40,0)");
    ctx.fillStyle=rg; ctx.beginPath(); ctx.ellipse(x,groundY+2,80,20,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  // ring of stones around the pit
  ctx.fillStyle="#4e4e5a";
  for (let i=0;i<7;i++) {
    const a=(i/7)*Math.PI, sx=x+Math.cos(a)*17*(i%2?1:1.12);
    ctx.beginPath(); ctx.ellipse(sx,groundY-1.5+(i%2),3.6,2.5,0,0,Math.PI*2); ctx.fill();
  }
  ctx.fillStyle="rgba(255,150,60,0.25)";
  for (let i=0;i<7;i++) { const a=(i/7)*Math.PI; ctx.beginPath(); ctx.ellipse(x+Math.cos(a)*17,groundY-2.4+(i%2),1.8,1,0,0,Math.PI*2); ctx.fill(); }
  // glowing coal bed
  ctx.fillStyle=`rgba(255,110,30,${0.55*fl})`; ctx.beginPath(); ctx.ellipse(x,groundY-3,12,3.6,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=`rgba(255,210,120,${0.5*fl})`; ctx.beginPath(); ctx.ellipse(x,groundY-3,6,2,0,0,Math.PI*2); ctx.fill();
  // crossed logs with charred tips
  ctx.strokeStyle="#3a2a1a"; ctx.lineWidth=5; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(x-12,groundY-2); ctx.lineTo(x+10,groundY-7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+12,groundY-2); ctx.lineTo(x-10,groundY-7); ctx.stroke();
  ctx.strokeStyle="#181210"; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(x+4,groundY-5.6); ctx.lineTo(x+10,groundY-7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x-4,groundY-5.6); ctx.lineTo(x-10,groundY-7); ctx.stroke();
  ctx.lineCap="butt";
  const flame=(h,w,col,wob)=>{ const sway=Math.sin(t*8+wob)*2+wind; ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(x-w,groundY-6); ctx.quadraticCurveTo(x-w*0.6+sway,groundY-h*0.6,x+sway*1.4,groundY-h*fl); ctx.quadraticCurveTo(x+w*0.6+sway,groundY-h*0.6,x+w,groundY-6); ctx.quadraticCurveTo(x,groundY-2,x-w,groundY-6); ctx.fill(); };
  flame(34,11,"rgba(226,88,30,0.92)",0); flame(26,8,"rgba(255,150,40,0.95)",1.7);
  flame(17,5,"rgba(255,210,90,0.97)",3.1); flame(9,2.6,"rgba(255,244,200,0.98)",4.6);
  // inner flame glow
  ctx.save(); ctx.globalCompositeOperation="lighter";
  const fg=ctx.createRadialGradient(x,groundY-16,2,x,groundY-16,26*fl);
  fg.addColorStop(0,"rgba(255,190,90,0.35)"); fg.addColorStop(1,"rgba(255,120,40,0)");
  ctx.fillStyle=fg; ctx.beginPath(); ctx.arc(x,groundY-16,26*fl,0,Math.PI*2); ctx.fill();
  ctx.restore();
  // drifting embers
  for (let i=0;i<4;i++) {
    const ph=(t*0.55+i*0.25+x*0.01)%1;
    const ex=x+Math.sin(t*3+i*2.1)*(4+ph*10)+wind*ph*8, ey=groundY-10-ph*46;
    ctx.fillStyle=`rgba(255,${170+i*20},90,${0.85*(1-ph)})`;
    ctx.beginPath(); ctx.arc(ex,ey,1.3-ph*0.6,0,Math.PI*2); ctx.fill();
  }
  // wavering smoke above the flames
  ctx.save(); ctx.globalAlpha=0.14+0.06*dark;
  ctx.fillStyle="#c8c4bc";
  for (let i=0;i<3;i++) {
    const ph=(t*0.35+i/3)%1;
    ctx.beginPath(); ctx.arc(x+Math.sin(t*1.4+i*2)*6+wind*ph*14,groundY-36-ph*34,4+ph*7,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawTent(x, col) {
  ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(x,groundY-44); ctx.lineTo(x-26,groundY); ctx.lineTo(x+26,groundY); ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.28)"; ctx.beginPath(); ctx.moveTo(x,groundY-44); ctx.lineTo(x+26,groundY); ctx.lineTo(x+8,groundY); ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,0.10)"; ctx.beginPath(); ctx.moveTo(x,groundY-44); ctx.lineTo(x-26,groundY); ctx.lineTo(x-12,groundY); ctx.closePath(); ctx.fill();
  ctx.strokeStyle="rgba(40,30,24,0.8)"; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(x,groundY-44); ctx.lineTo(x,groundY-54); ctx.stroke();
  const sway=windSway(x,3); ctx.fillStyle="#c1453b"; ctx.beginPath(); ctx.moveTo(x,groundY-54); ctx.lineTo(x+10+sway,groundY-51); ctx.lineTo(x,groundY-48); ctx.fill();
}

// ---------- World entities ----------
function drawBuildMarker(x, color) {
  const t = performance.now() / 1000;
  const pulse = 0.55 + 0.45 * Math.sin(t * 2.2 + x * 0.3);

  groundShadow(x, 16, 0.22);
  const rg = ctx.createRadialGradient(x, groundY - 2, 2, x, groundY - 2, 22);
  rg.addColorStop(0, color);
  rg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalAlpha = 0.35 * pulse;
  ctx.fillStyle = rg;
  ctx.beginPath(); ctx.ellipse(x, groundY - 1, 24, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#5a5060";
  ctx.beginPath(); ctx.moveTo(x - 10, groundY); ctx.lineTo(x + 10, groundY); ctx.lineTo(x + 7, groundY - 8); ctx.lineTo(x - 7, groundY - 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#6a6270";
  ctx.beginPath(); ctx.moveTo(x - 7, groundY - 8); ctx.lineTo(x + 7, groundY - 8); ctx.lineTo(x + 4, groundY - 14); ctx.lineTo(x - 4, groundY - 14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#7a7482";
  ctx.beginPath(); ctx.moveTo(x - 4, groundY - 14); ctx.lineTo(x + 4, groundY - 14); ctx.lineTo(x + 1, groundY - 19); ctx.lineTo(x - 1, groundY - 19); ctx.closePath(); ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.7 * pulse;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, groundY - 20, 3.5, 0, Math.PI * 2); ctx.fill();
  const gg = ctx.createRadialGradient(x, groundY - 20, 1, x, groundY - 20, 9);
  gg.addColorStop(0, color); gg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gg;
  ctx.beginPath(); ctx.arc(x, groundY - 20, 9, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawEntityShadows() {
  const { player, units, vagrants, enemies, animals } = state;
  const view = visibleWorldBounds(160);
  const seen = x => x >= view.left && x <= view.right;
  const budget = renderBudget();
  if (player && seen(player.x)) groundShadow(player.x,22,0.24);
  for (const u of units)   { if (seen(u.x)) groundShadow(u.x,11,0.2); }
  for (const v of vagrants) { if (seen(v.x)) groundShadow(v.x,11,0.2); }
  let enemyShadowIndex = 0;
  for (const e of enemies)  {
    if (!seen(e.x)) continue;
    const type = ENEMY_TYPES[e.type];
    if (!type) continue;
    if (budget.shadowStride > 1 && !type.boss && !type.legendary && (enemyShadowIndex++ % budget.shadowStride) !== 0) continue;
    groundShadow(e.x,type.w*0.7,0.22);
  }
  for (const a of animals)  if (a.alive && seen(a.x)) groundShadow(a.x,10,0.18);
}

const PORTAL_SKINS = {
  forest: {
    kind: "forest",
    ground0: [80,10,0], ground1: [40,4,0], glow0: [255,80,20], glow1: [200,30,0],
    stoneBase: "#2a1a12", stoneMid: "#3d2518", stoneHi: "#55301c",
    ornament: "#3a2a1e", socket: "#1a0a04", mouth: "#0e0604",
    rune: [255,90,20], apex: [255,60,10], apexGlow: [255,120,30],
    inner0: [200,50,10], inner1: [140,20,5], inner2: [60,5,0], inner3: [10,0,0],
    swirlHot: [255,200,60], swirlMid: [255,80,10], swirlEnd: [120,10,0],
    flameHot: [255,190,48], flameCool: [255,55,12], sideHot: [255,140,24], sideCool: [180,40,8],
    shimmer: [255,100,20], hpBg: "#3a1208", hpGood: "#ff7a24", hpMid: "#ffb040", hpLow: "#ffe08a",
    hitA: "#caa46a", hitB: "#ff8a3d",
  },
  frozen: {
    kind: "frozen",
    ground0: [145,220,246], ground1: [64,118,158], glow0: [135,230,255], glow1: [60,150,230],
    stoneBase: "#3c5a70", stoneMid: "#9fc2d3", stoneHi: "#e6f7ff",
    ornament: "#d9f4ff", socket: "#45708a", mouth: "#2a4e66",
    rune: [155,236,255], apex: [190,246,255], apexGlow: [105,210,255],
    inner0: [138,232,255], inner1: [66,162,226], inner2: [18,58,104], inner3: [5,20,42],
    swirlHot: [235,255,255], swirlMid: [115,222,255], swirlEnd: [40,110,170],
    flameHot: [225,252,255], flameCool: [80,186,255], sideHot: [210,248,255], sideCool: [70,150,225],
    shimmer: [150,230,255], hpBg: "#18384f", hpGood: "#82dfff", hpMid: "#c5f4ff", hpLow: "#ffffff",
    hitA: "#d9f4ff", hitB: "#82dfff",
  },
  desert: {
    kind: "desert",
    ground0: [128,84,35], ground1: [95,58,24], glow0: [255,202,94], glow1: [214,132,46],
    stoneBase: "#6e4a28", stoneMid: "#b9874f", stoneHi: "#edc982",
    ornament: "#a56d37", socket: "#4a2c18", mouth: "#3a2112",
    rune: [255,222,128], apex: [255,205,86], apexGlow: [255,235,155],
    inner0: [226,142,42], inner1: [157,84,30], inner2: [68,36,20], inner3: [20,10,6],
    swirlHot: [255,234,142], swirlMid: [230,146,54], swirlEnd: [120,58,24],
    flameHot: [255,224,124], flameCool: [213,104,32], sideHot: [255,190,76], sideCool: [166,74,26],
    shimmer: [255,196,96], hpBg: "#5a3218", hpGood: "#f1b24f", hpMid: "#ffd27a", hpLow: "#fff0ba",
    hitA: "#e8c080", hitB: "#d89a45",
  },
  swamp: {
    kind: "swamp",
    ground0: [42,76,46], ground1: [16,42,30], glow0: [142,210,76], glow1: [48,126,76],
    stoneBase: "#17231e", stoneMid: "#314638", stoneHi: "#6f8b55",
    ornament: "#536b3f", socket: "#0b160f", mouth: "#06100a",
    rune: [178,255,106], apex: [168,238,88], apexGlow: [90,210,96],
    inner0: [118,180,70], inner1: [48,102,56], inner2: [14,44,34], inner3: [4,14,12],
    swirlHot: [210,255,122], swirlMid: [112,206,88], swirlEnd: [34,94,48],
    flameHot: [188,246,96], flameCool: [54,150,86], sideHot: [156,226,82], sideCool: [36,104,56],
    shimmer: [136,220,88], hpBg: "#173016", hpGood: "#9bd85a", hpMid: "#c8f082", hpLow: "#edffba",
    hitA: "#8ba85a", hitB: "#b8ff7a",
  },
  volcano: {
    kind: "volcano",
    ground0: [120,32,18], ground1: [42,16,14], glow0: [255,66,22], glow1: [190,24,0],
    stoneBase: "#151313", stoneMid: "#2f2b29", stoneHi: "#6f4030",
    ornament: "#3a302a", socket: "#080505", mouth: "#1a0804",
    rune: [255,92,28], apex: [255,80,20], apexGlow: [255,184,64],
    inner0: [255,92,24], inner1: [178,32,10], inner2: [70,10,6], inner3: [8,2,1],
    swirlHot: [255,226,90], swirlMid: [255,74,18], swirlEnd: [126,8,0],
    flameHot: [255,210,68], flameCool: [255,42,8], sideHot: [255,116,24], sideCool: [190,16,4],
    shimmer: [255,86,18], hpBg: "#421008", hpGood: "#ff6a24", hpMid: "#ffb13d", hpLow: "#ffe36a",
    hitA: "#6b5a45", hitB: "#ff6a20",
  },
  corrupted: {
    kind: "corrupted",
    ground0: [86,36,126], ground1: [30,14,54], glow0: [165,88,255], glow1: [86,36,180],
    stoneBase: "#171020", stoneMid: "#322244", stoneHi: "#6c4aa0",
    ornament: "#4a3268", socket: "#09040f", mouth: "#06020a",
    rune: [204,128,255], apex: [188,96,255], apexGlow: [224,172,255],
    inner0: [150,78,224], inner1: [82,34,145], inner2: [28,12,58], inner3: [5,2,12],
    swirlHot: [232,188,255], swirlMid: [166,78,255], swirlEnd: [70,20,142],
    flameHot: [218,162,255], flameCool: [118,54,220], sideHot: [190,112,255], sideCool: [76,26,170],
    shimmer: [174,96,255], hpBg: "#251036", hpGood: "#b66bff", hpMid: "#dca8ff", hpLow: "#f2dcff",
    hitA: "#a56bff", hitB: "#d7a8ff",
  },
};

function portalSkinAt(x) {
  const b = biomeAt(x);
  return PORTAL_SKINS[b.id] || PORTAL_SKINS.forest;
}

function drawPortalBiomeAccents(skin, x, baseY, gateW, gateH, archH, pillarW, T, glow) {
  ctx.save();
  if (skin.kind === "frozen") {
    ctx.fillStyle = "rgba(230,250,255,0.9)";
    ctx.beginPath();
    ctx.moveTo(x - gateW - pillarW / 2, baseY - gateH + 4);
    ctx.lineTo(x - gateW * 0.35, baseY - gateH - archH * 0.9);
    ctx.lineTo(x, baseY - gateH - archH - 6);
    ctx.lineTo(x + gateW * 0.35, baseY - gateH - archH * 0.9);
    ctx.lineTo(x + gateW + pillarW / 2, baseY - gateH + 4);
    ctx.lineTo(x + gateW - 8, baseY - gateH - 4);
    ctx.lineTo(x, baseY - gateH - archH + 4);
    ctx.lineTo(x - gateW + 8, baseY - gateH - 4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(160,226,255,0.82)";
    for (const ox of [-42, -18, 14, 38]) {
      ctx.beginPath();
      ctx.moveTo(x + ox, baseY - gateH - 3);
      ctx.lineTo(x + ox + 4, baseY - gateH - 22 - Math.abs(ox % 3) * 3);
      ctx.lineTo(x + ox + 9, baseY - gateH - 3);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(190,245,255,${0.12 * glow})`;
    ctx.beginPath(); ctx.ellipse(x, baseY - 16, 72, 10, 0, 0, Math.PI * 2); ctx.fill();
  } else if (skin.kind === "desert") {
    ctx.fillStyle = "rgba(194,142,70,0.78)";
    ctx.beginPath(); ctx.ellipse(x, baseY + 3, 84, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,222,138,0.55)";
    ctx.lineWidth = 1.2;
    for (const side of [-1, 1]) {
      const px = x + side * gateW;
      for (let k = 0; k < 4; k++) {
        const y = baseY - gateH + 28 + k * 24;
        ctx.beginPath(); ctx.moveTo(px - pillarW / 2 + 2, y); ctx.lineTo(px + pillarW / 2 - 2, y + side * 3); ctx.stroke();
      }
    }
  } else if (skin.kind === "swamp") {
    ctx.strokeStyle = "rgba(138,170,76,0.72)";
    ctx.lineWidth = 2; ctx.lineCap = "round";
    for (const ox of [-42, -20, 0, 22, 43]) {
      const sway = Math.sin(T * 1.4 + ox) * 3;
      ctx.beginPath();
      ctx.moveTo(x + ox, baseY - gateH - 8);
      ctx.quadraticCurveTo(x + ox + sway, baseY - gateH + 26, x + ox - sway * 0.3, baseY - gateH + 58);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(88,126,48,0.55)";
    ctx.beginPath(); ctx.ellipse(x, baseY + 2, 78, 12, 0, 0, Math.PI * 2); ctx.fill();
  } else if (skin.kind === "volcano") {
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(255,86,20,${0.55 + 0.18 * Math.sin(T * 3)})`;
    ctx.lineWidth = 2; ctx.lineCap = "round";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * 13, baseY);
      ctx.lineTo(x + side * 38, baseY + 3);
      ctx.lineTo(x + side * 68, baseY - 1);
      ctx.stroke();
    }
  } else if (skin.kind === "corrupted") {
    ctx.fillStyle = "#09040f";
    for (const side of [-1, 1]) {
      const px = x + side * (gateW + 8);
      ctx.beginPath();
      ctx.moveTo(px, baseY - gateH + 12);
      ctx.lineTo(px + side * 14, baseY - gateH + 44);
      ctx.lineTo(px, baseY - gateH + 76);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(190,112,255,${0.55 * glow})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, baseY - gateH * 0.5, 50 + Math.sin(T * 1.5) * 4, -0.8, 4.0); ctx.stroke();
  } else {
    ctx.strokeStyle = "rgba(90,50,24,0.65)";
    ctx.lineWidth = 2.4; ctx.lineCap = "round";
    for (const side of [-1, 1]) {
      const px = x + side * gateW;
      ctx.beginPath();
      ctx.moveTo(px - side * 8, baseY + 2);
      ctx.quadraticCurveTo(px - side * 16, baseY - 14, px - side * 4, baseY - 28);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawPortals(dark) {
  const T = performance.now() / 1000;
  const view = visibleWorldBounds(190);
  for (const p of state.portals) {
    const x = p.x;
    if (x < view.left || x > view.right) continue;
    if (p.voidRift) { drawVoidRift(p, x, T, dark); continue; }
    if (p.destroyed) { drawRuinedPortal(x, T); continue; }
    const glow = Game.isNight ? 1 : 0.4;
    const skin = portalSkinAt(x);
    const gateW = 52, gateH = 140, archH = 34;
    const pillarW = 14;
    const baseY = groundY;

    ctx.save();

    // --- ground scorch mark ---
    const sg = ctx.createRadialGradient(x, baseY, 8, x, baseY, 90);
    sg.addColorStop(0, withA(skin.ground0, 0.7 * glow));
    sg.addColorStop(0.5, withA(skin.ground1, 0.3 * glow));
    sg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.ellipse(x, baseY + 4, 90, 14, 0, 0, Math.PI * 2); ctx.fill();

    // --- outer hellfire glow ---
    ctx.globalCompositeOperation = "lighter";
    const og = ctx.createRadialGradient(x, baseY - gateH * 0.45, 10, x, baseY - gateH * 0.45, gateW + 60);
    og.addColorStop(0, withA(skin.glow0, 0.25 * glow));
    og.addColorStop(0.6, withA(skin.glow1, 0.1 * glow));
    og.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.ellipse(x, baseY - gateH * 0.45, gateW + 60, gateH * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // --- stone pillars ---
    const { stoneBase, stoneMid, stoneHi } = skin;
    for (const side of [-1, 1]) {
      const px = x + side * gateW;
      // main pillar body
      ctx.fillStyle = stoneMid;
      ctx.fillRect(px - pillarW / 2, baseY - gateH, pillarW, gateH);
      // inner edge highlight
      ctx.fillStyle = stoneHi;
      ctx.fillRect(px - side * pillarW / 2, baseY - gateH, 3, gateH);
      // outer edge shadow
      ctx.fillStyle = stoneBase;
      ctx.fillRect(px + side * pillarW / 2 - 3, baseY - gateH, 3, gateH);

      // skull ornament at top of each pillar
      const sy = baseY - gateH - 6;
      ctx.fillStyle = skin.ornament;
      ctx.beginPath(); ctx.arc(px, sy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin.socket;
      ctx.beginPath(); ctx.arc(px - 3, sy - 1, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 3, sy - 1, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin.mouth;
      ctx.fillRect(px - 2, sy + 2, 4, 3);

      // cracks / runes glowing on pillar
      ctx.strokeStyle = withA(skin.rune, 0.4 + 0.3 * Math.sin(T * 2 + side));
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px - 2, baseY - gateH + 20);
      ctx.lineTo(px + 1, baseY - gateH + 38);
      ctx.lineTo(px - 3, baseY - gateH + 56);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px + 2, baseY - gateH + 70);
      ctx.lineTo(px - 1, baseY - gateH + 88);
      ctx.stroke();

      // ember particles floating up from pillar tops
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 3; k++) {
        const et = (T * 0.8 + k * 1.3 + side * 2) % 3;
        const ey = sy - et * 26;
        const ea = (1 - et / 3) * 0.8 * glow;
        ctx.fillStyle = withA(lerpColor(skin.flameHot, skin.flameCool, k / 3), ea);
        ctx.beginPath();
        ctx.arc(px + Math.sin(T * 3 + k * 4 + side) * 6, ey, 1.5 + (1 - et / 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // --- archway (pointed gothic arch) ---
    ctx.fillStyle = stoneBase;
    ctx.beginPath();
    ctx.moveTo(x - gateW - pillarW / 2, baseY - gateH);
    ctx.quadraticCurveTo(x - gateW * 0.4, baseY - gateH - archH * 1.3, x, baseY - gateH - archH);
    ctx.quadraticCurveTo(x + gateW * 0.4, baseY - gateH - archH * 1.3, x + gateW + pillarW / 2, baseY - gateH);
    ctx.lineTo(x + gateW - pillarW / 2, baseY - gateH);
    ctx.quadraticCurveTo(x + gateW * 0.3, baseY - gateH - archH * 0.9, x, baseY - gateH - archH + 6);
    ctx.quadraticCurveTo(x - gateW * 0.3, baseY - gateH - archH * 0.9, x - gateW + pillarW / 2, baseY - gateH);
    ctx.closePath();
    ctx.fill();

    // glowing rune at arch apex
    ctx.fillStyle = withA(skin.apex, 0.6 + 0.4 * Math.sin(T * 3));
    ctx.beginPath(); ctx.arc(x, baseY - gateH - archH + 2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = withA(skin.apexGlow, 0.3 + 0.2 * Math.sin(T * 3));
    ctx.beginPath(); ctx.arc(x, baseY - gateH - archH + 2, 10, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    drawPortalBiomeAccents(skin, x, baseY, gateW, gateH, archH, pillarW, T, glow);

    // --- inner void (the portal opening) ---
    ctx.beginPath();
    ctx.moveTo(x - gateW + pillarW / 2 + 2, baseY);
    ctx.lineTo(x - gateW + pillarW / 2 + 2, baseY - gateH);
    ctx.quadraticCurveTo(x - gateW * 0.3, baseY - gateH - archH * 0.85, x, baseY - gateH - archH + 8);
    ctx.quadraticCurveTo(x + gateW * 0.3, baseY - gateH - archH * 0.85, x + gateW - pillarW / 2 - 2, baseY - gateH);
    ctx.lineTo(x + gateW - pillarW / 2 - 2, baseY);
    ctx.closePath();

    // deep hellish interior gradient
    const ig = ctx.createLinearGradient(x, baseY, x, baseY - gateH - archH);
    ig.addColorStop(0, withA(skin.inner0, 0.85 * glow));
    ig.addColorStop(0.3, withA(skin.inner1, 0.7 * glow));
    ig.addColorStop(0.6, withA(skin.inner2, 0.9 * glow));
    ig.addColorStop(1, withA(skin.inner3, 1));
    ctx.fillStyle = ig; ctx.fill();

    // swirling inner fire
    ctx.save(); ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 7; k++) {
      const phase = T * 1.2 + k * 0.9;
      const fy = baseY - 10 - ((phase * 40) % (gateH + archH));
      const fx = x + Math.sin(phase * 2.1 + k) * (gateW * 0.5);
      const fr = 12 + Math.sin(phase * 3) * 6;
      const fa = (0.25 + 0.15 * Math.sin(phase * 4)) * glow;
      const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
      fg.addColorStop(0, withA(skin.swirlHot, fa));
      fg.addColorStop(0.4, withA(skin.swirlMid, fa * 0.6));
      fg.addColorStop(1, withA(skin.swirlEnd, 0));
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // --- fire flames licking out of the gate ---
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 10; k++) {
      const phase = T * 1.6 + k * 0.63;
      const t = (phase % 1.5) / 1.5;
      const fx = x + (k - 4.5) * (gateW * 0.18);
      const flameH = (30 + Math.sin(phase * 5) * 14) * (1 - t * 0.3);
      const fy = baseY - t * flameH;
      const fa = (1 - t) * 0.55 * glow;
      const fw = 5 + Math.sin(phase * 3.7) * 2;

      ctx.fillStyle = withA(lerpColor(skin.flameHot, skin.flameCool, t), fa);
      ctx.beginPath();
      ctx.moveTo(fx - fw, baseY);
      ctx.quadraticCurveTo(fx - fw * 0.5, fy + flameH * 0.3, fx + Math.sin(phase) * 3, fy);
      ctx.quadraticCurveTo(fx + fw * 0.5, fy + flameH * 0.3, fx + fw, baseY);
      ctx.fill();
    }

    // bigger flame tongues on the sides
    for (let side = -1; side <= 1; side += 2) {
      for (let k = 0; k < 3; k++) {
        const phase = T * 1.3 + k * 1.1 + side * 0.7;
        const t = (phase % 2) / 2;
        const fx = x + side * (gateW - 4) + Math.sin(phase * 2) * 4;
        const flameH = 40 + Math.sin(phase * 4.2) * 18;
        const fy = baseY - gateH * 0.15 - t * flameH;
        const fa = (1 - t) * 0.4 * glow;
        ctx.fillStyle = withA(lerpColor(skin.sideHot, skin.sideCool, Math.min(1, t + k * 0.08)), fa);
        ctx.beginPath();
        ctx.moveTo(fx, baseY - gateH * 0.1);
        ctx.quadraticCurveTo(fx + side * 8, fy + flameH * 0.4, fx + side * 3 + Math.sin(phase) * 4, fy);
        ctx.quadraticCurveTo(fx - side * 3, fy + flameH * 0.5, fx, baseY - gateH * 0.1);
        ctx.fill();
      }
    }
    ctx.restore();

    // --- heat distortion shimmer above gate ---
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 5; k++) {
      const ht = (T * 0.6 + k * 0.5) % 2.5;
      const hy = baseY - gateH - archH - ht * 40;
      const ha = (1 - ht / 2.5) * 0.18 * glow;
      const hx = x + Math.sin(T * 2 + k * 1.8) * 16;
      ctx.fillStyle = withA(skin.shimmer, ha);
      ctx.beginPath(); ctx.ellipse(hx, hy, 8 + k * 2, 3, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // --- siege damage: hit flash + HP bar during an assault ---
    if ((p.flash || 0) > 0) {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(255,240,220,${Math.min(1, p.flash * 4) * 0.35})`;
      ctx.fillRect(x - gateW - pillarW, baseY - gateH - archH - 12, (gateW + pillarW) * 2, gateH + archH + 12);
      ctx.restore();
    }
    if (p.hp !== undefined && p.maxHp && p.hp < p.maxHp) {
      const bw = 110, bh = 8, by = baseY - gateH - archH - 34;
      const frac = Math.max(0, p.hp / p.maxHp);
      ctx.fillStyle = "rgba(10,6,4,0.75)";
      ctx.fillRect(x - bw / 2 - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = skin.hpBg;
      ctx.fillRect(x - bw / 2, by, bw, bh);
      ctx.fillStyle = frac > 0.5 ? skin.hpGood : frac > 0.25 ? skin.hpMid : skin.hpLow;
      ctx.fillRect(x - bw / 2, by, bw * frac, bh);
      ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1;
      ctx.strokeRect(x - bw / 2 - 0.5, by - 0.5, bw + 1, bh + 1);
    }

    ctx.restore();
  }
}

// Collapsed hell gate: broken pillar stumps, cooling rubble, drifting smoke.
function drawRuinedPortal(x, T) {
  const baseY = groundY, gateW = 52, pillarW = 14;
  const skin = portalSkinAt(x);
  ctx.save();

  // scorched ground, cooling from the old burn
  const sg = ctx.createRadialGradient(x, baseY, 8, x, baseY, 95);
  sg.addColorStop(0, withA(skin.ground1, 0.65));
  sg.addColorStop(0.6, withA(skin.ground0, 0.22));
  sg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.ellipse(x, baseY + 4, 95, 15, 0, 0, Math.PI * 2); ctx.fill();

  // shattered pillar stumps
  const { stoneBase, stoneMid } = skin;
  for (const side of [-1, 1]) {
    const px = x + side * gateW;
    const stumpH = side < 0 ? 44 : 26;
    ctx.fillStyle = stoneMid;
    ctx.beginPath();
    ctx.moveTo(px - pillarW / 2, baseY);
    ctx.lineTo(px - pillarW / 2, baseY - stumpH);
    ctx.lineTo(px - pillarW / 6, baseY - stumpH - 9);
    ctx.lineTo(px + pillarW / 3, baseY - stumpH + 4);
    ctx.lineTo(px + pillarW / 2, baseY);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = stoneBase;
    ctx.fillRect(px + side * pillarW / 2 - 3, baseY - stumpH + 6, 3, stumpH - 6);
  }

  // rubble field between the stumps
  ctx.fillStyle = stoneBase;
  for (let k = 0; k < 9; k++) {
    const rx = x + Math.sin(k * 37.3) * gateW * 0.9;
    const rs = 4 + ((k * 13) % 3) * 3;
    ctx.beginPath();
    ctx.moveTo(rx - rs, baseY);
    ctx.lineTo(rx - rs * 0.2, baseY - rs - (k % 2) * 3);
    ctx.lineTo(rx + rs, baseY);
    ctx.closePath(); ctx.fill();
  }

  // last embers dying in the rubble + thin smoke
  ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < 3; k++) {
    const ea = 0.25 + 0.2 * Math.sin(T * 2.4 + k * 2.2);
    ctx.fillStyle = withA(skin.flameHot, ea * 0.5);
    ctx.beginPath(); ctx.arc(x + (k - 1) * 26, baseY - 4, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  for (let k = 0; k < 4; k++) {
    const st = (T * 0.35 + k * 0.6) % 2.4;
    const sy = baseY - 8 - st * 46;
    ctx.fillStyle = `rgba(120,110,105,${(1 - st / 2.4) * 0.14})`;
    ctx.beginPath();
    ctx.ellipse(x + Math.sin(T + k * 2) * 10 + (k - 1.5) * 12, sy, 7 + st * 6, 4 + st * 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Phase 2 portal: a floating tear in reality, humming with void light.
function drawVoidRift(p, x, T, dark) {
  const baseY = groundY;
  const glow = Game.isNight ? 1 : 0.5;
  const riftH = 150, riftW = 30;
  const cy = baseY - riftH * 0.55;
  ctx.save();

  // drained, ashen ground under the tear
  const sg = ctx.createRadialGradient(x, baseY, 8, x, baseY, 90);
  sg.addColorStop(0, `rgba(40,26,66,${0.65 * glow})`);
  sg.addColorStop(0.6, `rgba(22,14,40,${0.3 * glow})`);
  sg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.ellipse(x, baseY + 4, 90, 14, 0, 0, Math.PI * 2); ctx.fill();

  // outer void glow
  ctx.globalCompositeOperation = "lighter";
  const og = ctx.createRadialGradient(x, cy, 6, x, cy, riftW + 70);
  og.addColorStop(0, `rgba(150,110,255,${0.3 * glow})`);
  og.addColorStop(0.6, `rgba(70,40,160,${0.14 * glow})`);
  og.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = og;
  ctx.beginPath(); ctx.ellipse(x, cy, riftW + 70, riftH * 0.85, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // the tear itself: a jagged black lens with a breathing violet rim
  const pulse = 1 + Math.sin(T * 1.7 + x * 0.01) * 0.06;
  const rim = `rgba(185,160,255,${(0.55 + 0.25 * Math.sin(T * 2.3)) * glow})`;
  for (const [w, col] of [[riftW * pulse + 5, rim], [riftW * pulse, "#08040f"]]) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, cy - riftH / 2);
    ctx.bezierCurveTo(x + w, cy - riftH * 0.22, x + w * 0.8, cy + riftH * 0.2, x, cy + riftH / 2);
    ctx.bezierCurveTo(x - w * 0.8, cy + riftH * 0.2, x - w, cy - riftH * 0.22, x, cy - riftH / 2);
    ctx.closePath(); ctx.fill();
  }

  // starlight inside the void
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < 6; k++) {
    const ph = T * 0.7 + k * 1.05;
    const fy = cy + Math.sin(ph) * riftH * 0.32;
    const fx = x + Math.sin(ph * 1.7 + k) * riftW * 0.4;
    const fa = (0.3 + 0.25 * Math.sin(ph * 3)) * glow;
    ctx.fillStyle = k % 2 ? `rgba(143,232,255,${fa})` : `rgba(185,160,255,${fa})`;
    ctx.beginPath(); ctx.arc(fx, fy, 1.4 + (k % 3) * 0.8, 0, Math.PI * 2); ctx.fill();
  }
  // motes drifting up out of the tear
  for (let k = 0; k < 5; k++) {
    const mt = (T * 0.5 + k * 0.47) % 2.2;
    const my = cy - riftH * 0.35 - mt * 55;
    const ma = (1 - mt / 2.2) * 0.5 * glow;
    ctx.fillStyle = `rgba(160,130,255,${ma})`;
    ctx.beginPath();
    ctx.arc(x + Math.sin(T * 1.4 + k * 3) * 18, my, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ground cracks leaking void light
  ctx.strokeStyle = `rgba(150,120,255,${(0.35 + 0.2 * Math.sin(T * 2)) * glow})`;
  ctx.lineWidth = 1.4;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + side * 12, baseY);
    ctx.lineTo(x + side * 34, baseY + 3);
    ctx.lineTo(x + side * 58, baseY + 1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLog(x, dir, len) {
  ctx.save();
  ctx.translate(x, groundY - 6);
  groundShadow(x, len * 0.6, 0.2);
  const barkD = "#4a3420", barkL = "#7a5a34", ring = "#c9a878";
  ctx.fillStyle = barkD; roundedRect(-len / 2, -7, len, 14, 6); ctx.fill();
  ctx.fillStyle = barkL; roundedRect(-len / 2, -7, len, 5, 4); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1;
  for (let i = -len / 2 + 8; i < len / 2 - 4; i += 10) { ctx.beginPath(); ctx.moveTo(i, -7); ctx.lineTo(i, 7); ctx.stroke(); }
  const capX = dir * len / 2;
  ctx.fillStyle = ring; ctx.beginPath(); ctx.ellipse(capX, 0, 4, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(90,60,30,0.6)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(capX, 0, 2.4, 4.2, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

export function drawForestTrees(dark) {
  const haze = hazeColor(dark);
  const view = visibleWorldBounds(220), camL = view.left, camR = view.right;
  const plx = state.player ? state.player.x : null;
  const fernRange = 500;
  const b = biomeAt(0);
  for (const ft of state.forestTrees) {
    if (ft.x < camL || ft.x > camR) continue;
    if (ft.chopped || ft.carriedBy) continue;
    // stagger apparent depth so the dense forest reads as layered rows
    const depth = 0.05 + (Math.abs(Math.floor(ft.x / 60)) % 3) * 0.07;
    const light = atmo(b.treeL, haze, depth), dcol = atmo(b.treeD, haze, depth);

    if (ft.lying) { drawLog(ft.x, ft.fallDir, Math.max(60, ft.tree.h * 0.6)); continue; }

    if (ft.falling) {
      const t = clamp(ft.fallT || ft.fallAngle / (Math.PI / 2), 0, 1);
      const bounce = t > 0.78 ? Math.sin((t - 0.78) * Math.PI * 11) * (1 - t) * 0.12 : 0;
      const angle = ft.fallDir * (ft.fallAngle + bounce);
      ctx.save();
      ctx.translate(ft.x, groundY);
      ctx.rotate(angle);
      ctx.translate(-ft.x, -groundY);
      drawTree(ft.tree, ft.x, groundY + 4, light, dcol, depth, 0);
      ctx.restore();
      if (t > 0.72) {
        const dust = clamp((t - 0.72) / 0.28, 0, 1);
        ctx.save();
        ctx.globalAlpha = (1 - dust) * 0.38;
        ctx.fillStyle = withA(shade(b.gB, 0.72), 0.9);
        for (let i = 0; i < 4; i++) {
          const px = ft.x + ft.fallDir * (34 + i * 24);
          ctx.beginPath();
          ctx.ellipse(px, groundY + 3 - dust * 10, 16 + i * 5, 5 + i * 1.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      continue;
    }

    const impactPulse = ft.chopImpactPulse || 0;
    if (impactPulse > 0) {
      const jitter = impactPulse * impactPulse * 1.8;
      ctx.save();
      ctx.translate(Math.sin(performance.now() / 18 + ft.x) * jitter, 0);
      drawTree(ft.tree, ft.x, groundY + 4, light, dcol, depth, 16);
      ctx.restore();
    } else {
      drawTree(ft.tree, ft.x, groundY + 4, light, dcol, depth, 16);
    }
    if (plx !== null && Math.abs(ft.x - plx) < fernRange) {
      ctx.save(); ctx.lineCap = "round";
      ctx.strokeStyle = withA(atmo(shade(b.gT, 0.62), haze, depth), 0.9); ctx.lineWidth = 1.6;
      for (let i = -2; i <= 2; i++) {
        const sway = windSway(ft.tree.phase + i, 3);
        const fh = 11 + ((i * i + (Math.abs(ft.x | 0) % 4)) % 3) * 4;
        ctx.beginPath(); ctx.moveTo(ft.x + i * 5, groundY + 2);
        ctx.quadraticCurveTo(ft.x + i * 7 + sway, groundY - fh * 0.55, ft.x + i * 10 + sway, groundY - fh);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (ft.marked || ft.beingChopped || ft.chopProgress > 0) {
      const bob = Math.sin(performance.now() / 300 + ft.x) * 3;
      ctx.save(); ctx.font = "16px serif"; ctx.textAlign = "center"; ctx.globalAlpha = 0.9;
      ctx.fillText(ft.beingChopped ? "🪓" : "🔖", ft.x, groundY - ft.tree.h - 14 + bob);
      ctx.restore();
      if (ft.chopProgress > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(ft.x - 14, groundY - ft.tree.h - 26, 28, 4);
        ctx.fillStyle = "#caa46a"; ctx.fillRect(ft.x - 14, groundY - ft.tree.h - 26, 28 * clamp(ft.chopProgress, 0, 1), 4);
      }
    }
  }
}

export function drawForestCamps(dark) {
  const view = visibleWorldBounds(260), camL = view.left, camR = view.right;
  const t = performance.now() / 1000;
  const fl = (FX && FX.flicker) || 1;
  const SKIN = "#d3ac82";
  const PALS = [
    { tunic: "#6e6250", pants: "#4a4234", hair: "#4a3826" },
    { tunic: "#5d6652", pants: "#443c30", hair: "#2e2418" },
    { tunic: "#71584a", pants: "#4c4438", hair: "#6a5a42" },
  ];

  for (const camp of (state.forestCamps || [])) {
    if (camp.x < camL || camp.x > camR) continue;

    const x = camp.x;
    const b = biomeAt(x);

    // backdrop trees so the camp sits nestled into the forest instead of a
    // bare clearing (real trees are removed within CAMP_CLEAR_DIST so tents
    // don't overlap them); matched to the surrounding forest's look
    if (!camp._bgTrees || camp._bgX !== x) {
      const r = mulberry32((Math.floor(x) * 31 + 7) >>> 0);
      const trees = [];
      const n = 4 + ((r() * 3) | 0);
      for (let i = 0; i < n; i++) {
        const tx = x + (i / (n - 1) - 0.5) * 230 + (r() - 0.5) * 50;
        trees.push({
          x: tx,
          tree: makeTree(tx, 170 + r() * 80, r, { harvestable: true }),
          depth: 0.05 + (Math.abs(Math.floor(tx / 60)) % 3) * 0.07,
        });
      }
      camp._bgTrees = trees;
      camp._bgX = x;
    }
    const haze = hazeColor(dark);
    for (const bt of camp._bgTrees) {
      drawTree(bt.tree, bt.x, groundY + 4, atmo(b.treeL, haze, bt.depth), atmo(b.treeD, haze, bt.depth), bt.depth, 16);
    }

    // tents tucked just behind the campfire
    const tentShade = rgb(lerpColor([96,78,58],[34,28,24],dark));
    const tentLight = rgb(lerpColor([154,122,82],[62,48,36],dark));
    const tentTrim = rgb(lerpColor([72,52,38],[22,18,16],dark));
    const tentAt = (tx, scale, flip = 1) => {
      groundShadow(tx, 28 * scale, 0.16);
      ctx.save();
      ctx.translate(tx, groundY - 5);
      ctx.scale(flip * scale, scale);
      ctx.fillStyle = tentShade;
      ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(0, -42); ctx.lineTo(34, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = tentLight;
      ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(0, -38); ctx.lineTo(7, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = tentTrim;
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(0, -31); ctx.lineTo(24, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = withA(lerpColor([210,170,105],[80,60,40],dark), 0.8); ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(0, -42); ctx.lineTo(0, 0); ctx.stroke();
      ctx.restore();
    };
    tentAt(x - 76, 0.82, 1);
    tentAt(x + 76, 0.72, -1);

    // campfire stone ring
    const stC = rgb(lerpColor([90,84,78],[28,26,24],dark));
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      ctx.fillStyle = stC;
      ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 8, groundY - 2 + Math.sin(a) * 3, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
    }

    // embers
    ctx.fillStyle = rgb(lerpColor([60,40,30],[20,14,10],dark));
    ctx.beginPath(); ctx.ellipse(x, groundY - 1, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();

    // emptied camp: tents and a cold fire pit remain until it respawns elsewhere
    if (camp.triggered) continue;

    ctx.save();
    ctx.fillStyle = withA(lerpColor(shade(b.gT, 0.55),[8,12,18],dark), 0.75);
    for (let i = -3; i <= 3; i++) {
      const px = x + i * 22 + Math.sin(t + i) * 2;
      ctx.beginPath(); ctx.ellipse(px, groundY - 3, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // fire glow
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const ga = 0.25 + 0.12 * Math.sin(t * 3.1);
    const gr = ctx.createRadialGradient(x, groundY - 10, 2, x, groundY - 8, 40);
    gr.addColorStop(0, `rgba(255,140,40,${ga})`); gr.addColorStop(1, "rgba(255,80,20,0)");
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, groundY - 8, 40, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // flames
    ctx.fillStyle = `rgba(255,160,50,${0.8 * fl})`;
    ctx.beginPath(); ctx.ellipse(x, groundY - 8, 3, 7 * fl, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,220,120,${0.9 * fl})`;
    ctx.beginPath(); ctx.ellipse(x, groundY - 8, 1.5, 4 * fl, 0, 0, Math.PI * 2); ctx.fill();

    // logs in fire
    ctx.strokeStyle = woodCol(dark); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x - 8, groundY - 2); ctx.lineTo(x + 3, groundY - 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 7, groundY - 1); ctx.lineTo(x - 2, groundY - 6); ctx.stroke();

    // sitting figures
    const spots = camp.vagrants === 1 ? [[-28,1]] : camp.vagrants === 2 ? [[-28,1],[28,-1]] : [[-28,1],[28,-1],[0,1]];
    for (let i = 0; i < Math.min(camp.vagrants, spots.length); i++) {
      const [ox, dir] = spots[i];
      const P = PALS[i % PALS.length];
      const sx = x + ox;
      const breathe = Math.sin(t * 1.4 + i * 2.1) * 0.4;

      ctx.save();
      ctx.translate(sx, 0);
      if (dir < 0) ctx.scale(-1, 1);

      const sitY = groundY - 8;
      ctx.strokeStyle = P.pants; ctx.lineWidth = 2.5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-3, sitY); ctx.lineTo(-6, sitY + 5); ctx.lineTo(-2, sitY + 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3, sitY); ctx.lineTo(6, sitY + 5); ctx.lineTo(2, sitY + 7); ctx.stroke();

      ctx.fillStyle = P.tunic;
      ctx.fillRect(-4, sitY - 10 + breathe, 8, 10);

      ctx.strokeStyle = SKIN; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-3, sitY - 5 + breathe); ctx.lineTo(-5, sitY + 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3, sitY - 5 + breathe); ctx.lineTo(5, sitY + 2); ctx.stroke();

      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.arc(0, sitY - 14 + breathe, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P.hair;
      ctx.beginPath(); ctx.arc(-0.4, sitY - 15.5 + breathe, 3.8, Math.PI * 0.95, Math.PI * 2.02); ctx.fill();

      ctx.lineCap = "butt";
      ctx.restore();
    }
  }
}

// Wooden fighting platform behind a wall (levels 1-4): plank deck on support
// posts at unit stand height, with stairs (low walls) or a ladder (tall
// walls) down to the ground on the base side. The level-5 castle wall draws
// its own two-tier walkway.
function drawWallPlatform(w, h, flash, skin = null) {
  const layout = wallLayout(w, h);
  const deckH = layout.deckHeight;
  if (deckH < 12) return;
  const d = layout.backDir;
  const depth = layout.depth;
  const x0 = layout.deckFrontX;
  const x1 = layout.deckRearX;
  const deckY = groundY - deckH;
  const wood  = flash ? "#e8d8a8" : (skin?.id === "frozen" ? "#8fb2c8" : skin?.id === "desert" ? "#9a6330" : skin?.id === "volcano" ? "#5a2c1d" : skin?.id === "corrupted" ? "#3a2138" : skin?.wood || "#6b4a26");
  const woodD = flash ? "#d8c090" : (skin?.id === "frozen" ? "#476c84" : skin?.id === "desert" ? "#6a3f1d" : skin?.id === "volcano" ? "#2a1510" : skin?.id === "corrupted" ? "#170b20" : skin?.gate || "#4c3216");

  ctx.save();

  // Support posts, cross-bracing and iron feet. These are shared by every
  // biome so the platform reads as one believable structure at a glance.
  ctx.fillStyle = woodD;
  const nPosts = Math.max(2, Math.round(depth / 32) + 1);
  for (let i = 0; i < nPosts; i++) {
    const px = x0 + d * (5 + i * (depth - 10) / (nPosts - 1));
    ctx.fillRect(px - 2, deckY + 5, 4, deckH - 5);
    ctx.fillStyle = "rgba(20,16,14,0.5)";
    ctx.fillRect(px - 3, groundY - 4, 6, 4);
    ctx.fillStyle = woodD;
  }
  ctx.strokeStyle = woodD; ctx.lineWidth = 3; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0 + d * 5, groundY - 2);
  ctx.lineTo(x1 - d * 5, deckY + 7);
  ctx.stroke();
  if (depth >= 48) {
    ctx.globalAlpha = 0.78;
    ctx.beginPath();
    ctx.moveTo(x0 + d * 10, deckY + 7);
    ctx.lineTo(x1 - d * 9, groundY - 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // plank deck
  const left = Math.min(x0, x1), wDeck = Math.abs(x1 - x0);
  ctx.fillStyle = wood; ctx.fillRect(left, deckY, wDeck, 7);
  ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.fillRect(left, deckY, wDeck, 2);
  ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(left, deckY + 5, wDeck, 2);
  ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1;
  for (let s = 10; s < depth - 4; s += 12) {
    const px = x0 + d * s;
    ctx.beginPath(); ctx.moveTo(px, deckY + 1); ctx.lineTo(px, deckY + 6); ctx.stroke();
    ctx.fillStyle = "rgba(220,205,170,0.38)";
    ctx.beginPath(); ctx.arc(px - d * 3, deckY + 3.2, 0.8, 0, Math.PI * 2); ctx.fill();
  }

  // Low railing with a deliberate gap at the stair/ladder landing.
  const railRearX = x1 - d * 15;
  const railInnerX = x1 - d * Math.max(24, depth * 0.62);
  ctx.fillStyle = woodD;
  ctx.fillRect(railRearX - 1.5, deckY - 15, 3, 15);
  ctx.fillRect(railInnerX - 1.5, deckY - 15, 3, 15);
  ctx.strokeStyle = woodD; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(railRearX, deckY - 12);
  ctx.lineTo(railInnerX, deckY - 12);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(235,220,185,0.22)";
  ctx.beginPath(); ctx.moveTo(railRearX, deckY - 13); ctx.lineTo(railInnerX, deckY - 13); ctx.stroke();

  if (layout.accessType === "stairs") {
    // staircase running from the rear deck edge down toward the base
    const run = Math.abs(layout.accessBottomX - layout.accessTopX);
    const steps = Math.max(3, Math.round(deckH / 9));
    ctx.strokeStyle = woodD; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(layout.accessBottomX, groundY - 1);
    ctx.lineTo(layout.accessTopX, deckY + 4);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.09)"; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(layout.accessBottomX - d * 2, groundY - 4);
    ctx.lineTo(layout.accessTopX - d * 2, deckY + 2);
    ctx.stroke();
    ctx.fillStyle = wood;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const px = layout.accessBottomX + (layout.accessTopX - layout.accessBottomX) * t;
      const py = groundY - deckH * t + 2;
      ctx.fillRect(px - 7, py, 14, 3.5);
      ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(px - 6, py, 12, 1);
      ctx.fillStyle = wood;
    }
  } else {
    // tall wall: ladder against the rear deck edge
    const ladX = layout.accessTopX;
    ctx.strokeStyle = woodD; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(ladX - 5, groundY); ctx.lineTo(ladX - 5, deckY - 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ladX + 5, groundY); ctx.lineTo(ladX + 5, deckY - 10); ctx.stroke();
    ctx.lineWidth = 2;
    for (let ry = groundY - 7; ry > deckY + 8; ry -= 10) {
      ctx.beginPath(); ctx.moveTo(ladX - 5, ry); ctx.lineTo(ladX + 5, ry); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath(); ctx.moveTo(ladX - 4, ry - 1); ctx.lineTo(ladX + 4, ry - 1); ctx.stroke();
      ctx.strokeStyle = woodD;
    }
    ctx.fillStyle = "rgba(35,30,28,0.72)";
    for (const sx of [-5, 5]) for (const sy of [groundY - 22, deckY + 16]) ctx.fillRect(ladX + sx - 2, sy - 1.5, 4, 3);
  }

  ctx.lineCap = "butt";
  ctx.restore();
}

// A small pointed rune diamond with a vertical scratch through it.
function drawRuneGlyph(x, y, s, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.7, y);
  ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.7, y);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y - s - 3); ctx.lineTo(x, y + s + 3); ctx.stroke();
}

function drawWallBlockLines(x, top, WW, h, skin, step = 10) {
  ctx.strokeStyle = skin.line || "rgba(0,0,0,0.22)";
  ctx.lineWidth = 1;
  for (let yy = top + step; yy < groundY - 4; yy += step) {
    ctx.beginPath(); ctx.moveTo(x - WW / 2 + 3, yy); ctx.lineTo(x + WW / 2 - 3, yy); ctx.stroke();
  }
  for (let yy = top + step, row = 0; yy < groundY - 8; yy += step, row++) {
    for (let xx = x - WW / 2 + ((row % 2) ? step * 1.25 : step * 0.55); xx < x + WW / 2 - 4; xx += step * 1.35) {
      ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, Math.min(yy + step, groundY - 4)); ctx.stroke();
    }
  }
}

function drawWallCrenels(x, y, WW, count, skin, flash, jagged = false) {
  const col = flash ? "#e8d8a8" : skin.wall;
  const mW = WW / (count * 2 + 1);
  ctx.fillStyle = col;
  for (let i = 0; i < count; i++) {
    const px = x - WW / 2 + mW + i * mW * 2;
    if (jagged) {
      ctx.beginPath(); ctx.moveTo(px, y + 1); ctx.lineTo(px + mW * 0.5, y - 10 - (i % 2) * 5); ctx.lineTo(px + mW, y + 1); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillRect(px, y - 9, mW, 10);
    }
  }
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  if (!jagged) for (let i = 0; i < count; i++) ctx.fillRect(x - WW / 2 + mW + i * mW * 2, y - 9, mW, 2);
}

function drawWallSlots(x, top, WW, h, n) {
  ctx.fillStyle = "rgba(0,0,0,0.52)";
  for (let k = 0; k < n; k++) {
    const sx = x - WW * 0.34 + (n === 1 ? WW * 0.34 : k * (WW * 0.68) / (n - 1));
    ctx.fillRect(sx - 2, top + h * 0.42, 4, Math.max(9, h * 0.16));
  }
}

function drawForestWall(w, h, WW, skin, flash, night) {
  const x = w.x, lvl = w.level, top = groundY - h;
  const col = flash ? "#e8d8a8" : (lvl === 1 ? skin.wood : skin.wall);
  if (lvl === 1) {
    const xs = [-18, -9, 0, 9, 18];
    ctx.fillStyle = "rgba(0,0,0,0.24)"; roundedRect(x - WW / 2 - 2, groundY - 7, WW + 4, 8, 3); ctx.fill();
    for (let i = 0; i < xs.length; i++) {
      const px = x + xs[i], wobble = i % 2 ? 3 : 0, pTop = top + wobble;
      ctx.fillStyle = i % 2 ? "#744c2a" : col;
      ctx.beginPath(); ctx.moveTo(px - 4.5, groundY - 2); ctx.lineTo(px - 4.5, pTop + 6); ctx.lineTo(px, pTop); ctx.lineTo(px + 4.5, pTop + 6); ctx.lineTo(px + 4.5, groundY - 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.09)"; ctx.fillRect(px - 3.4, pTop + 8, 2, groundY - pTop - 12);
    }
    ctx.strokeStyle = skin.gate; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x - WW / 2 + 2, groundY - h * 0.56); ctx.lineTo(x + WW / 2 - 2, groundY - h * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - WW / 2 + 3, groundY - h * 0.28); ctx.lineTo(x + WW / 2 - 3, groundY - h * 0.31); ctx.stroke();
    ctx.lineCap = "butt";
  } else if (lvl < 5) {
    roundedRect(x - WW / 2, top, WW, h, 4); ctx.fillStyle = col; ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.08)"; roundedRect(x - WW / 2, top, WW * 0.3, h, 4); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(x + WW * 0.28, top, WW * 0.22, h);
    drawWallBlockLines(x, top, WW, h, skin, 10);
    drawWallCrenels(x, top, WW, lvl + 2, skin, flash);
    if (lvl >= 3) drawWallSlots(x, top, WW, h, lvl - 1);
  } else {
    drawClassicTieredWall(w, h, WW, skin, flash, night);
  }
}

function drawIceShard(x, baseY, h, w, skin, flash) {
  ctx.fillStyle = flash ? "#e8d8a8" : skin.wallD;
  ctx.beginPath(); ctx.moveTo(x - w, baseY); ctx.lineTo(x - w * 0.22, baseY - h * 0.72); ctx.lineTo(x + w * 0.12, baseY - h); ctx.lineTo(x + w, baseY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = flash ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.24)";
  ctx.beginPath(); ctx.moveTo(x - w, baseY); ctx.lineTo(x + w * 0.12, baseY - h); ctx.lineTo(x - w * 0.08, baseY); ctx.closePath(); ctx.fill();
}

function drawFrozenWall(w, h, WW, skin, flash, night) {
  const x = w.x, lvl = w.level, top = groundY - h;
  if (lvl === 1) {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const px = x - WW * 0.42 + i * (WW * 0.84) / (n - 1);
      drawIceShard(px, groundY, h * (0.78 + (i % 2) * 0.18), WW * 0.13, skin, flash);
    }
  } else if (lvl < 5) {
    const bodyCol = flash ? "#e8d8a8" : skin.wall;
    roundedRect(x - WW / 2, top, WW, h, 5); ctx.fillStyle = bodyCol; ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.20)"; ctx.beginPath(); ctx.moveTo(x - WW / 2, top); ctx.lineTo(x - WW * 0.12, top); ctx.lineTo(x - WW * 0.3, groundY); ctx.lineTo(x - WW / 2, groundY); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = skin.line; ctx.lineWidth = 1.1;
    for (let i = 0; i < lvl + 2; i++) {
      const px = x - WW * 0.4 + i * (WW * 0.8) / (lvl + 1);
      ctx.beginPath(); ctx.moveTo(px, top + 4); ctx.lineTo(px + ((i % 2) ? 9 : -7), groundY - 4); ctx.stroke();
    }
    for (let i = 0; i < lvl + 1; i++) drawIceShard(x - WW * 0.42 + i * (WW * 0.84) / lvl, top + 2, 16 + lvl * 3, 5, skin, flash);
    if (lvl >= 3) drawWallSlots(x, top, WW, h, lvl - 1);
  } else {
    ctx.fillStyle = flash ? "#e8d8a8" : skin.wallD;
    roundedRect(x - WW / 2, top, WW, h, 4); ctx.fill();
    for (const [ox, sh, sw] of [[-30, h * 0.96, 15], [0, h * 1.18, 20], [30, h * 0.88, 14]]) drawIceShard(x + ox, groundY, sh, sw, skin, flash);
    ctx.fillStyle = skin.wallL; ctx.fillRect(x - WW / 2 - 8, groundY - h * 0.55, WW + 16, 8);
    ctx.fillRect(x - WW / 2 - 12, top, WW + 24, 9);
    drawWallCrenels(x, top, WW + 18, 5, skin, flash, true);
    if (night) { drawSkinLamp(x - 34, groundY - h * 0.55, skin, 0.55); drawSkinLamp(x + 34, top + 4, skin, 0.55); }
  }
}

function drawDesertWall(w, h, WW, skin, flash, night) {
  const x = w.x, lvl = w.level, top = groundY - h;
  const col = flash ? "#e8d8a8" : skin.wall;
  if (lvl === 1) {
    ctx.fillStyle = col; roundedRect(x - WW / 2, top + h * 0.18, WW, h * 0.82, 5); ctx.fill();
    ctx.fillStyle = skin.wallL; ctx.fillRect(x - WW / 2 - 4, top + h * 0.18 - 4, WW + 8, 7);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? skin.wallD : skin.wallL;
      ctx.fillRect(x - WW / 2 + 6 + i * (WW - 18) / 3, top + h * 0.05, 9, h * 0.2);
    }
  } else if (lvl < 5) {
    roundedRect(x - WW / 2, top, WW, h, 6); ctx.fillStyle = col; ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.fillRect(x - WW / 2, top, WW * 0.32, h);
    drawWallBlockLines(x, top, WW, h, skin, 13);
    ctx.fillStyle = skin.wallL; ctx.fillRect(x - WW / 2 - 4, top - 5, WW + 8, 8);
    for (let i = 0; i < lvl + 1; i++) {
      const px = x - WW * 0.38 + i * (WW * 0.76) / lvl;
      drawBiomeRoof(px, top - 6, 7 + lvl, 12 + lvl, skin);
    }
    if (lvl >= 3) drawWallSlots(x, top, WW, h, lvl - 1);
  } else {
    roundedRect(x - WW / 2 - 4, top, WW + 8, h, 6); ctx.fillStyle = col; ctx.fill();
    drawWallBlockLines(x, top, WW + 8, h, skin, 13);
    ctx.fillStyle = skin.wallL; ctx.fillRect(x - WW / 2 - 10, groundY - h * 0.52, WW + 20, 9);
    ctx.fillRect(x - WW / 2 - 14, top - 6, WW + 28, 10);
    for (const ox of [-38, 38]) {
      drawMasonryRect(x + ox, top - 20, 18, h + 20, skin, 0, 8);
      drawBiomeRoof(x + ox, top - 23, 12, 18, skin);
    }
    drawBiomeRoof(x, top - 8, 21, 25, skin);
  }
}

function drawSwampWall(w, h, WW, skin, flash, night) {
  const x = w.x, lvl = w.level, top = groundY - h;
  const deckY = lvl >= 5 ? groundY - h * 0.56 : top + Math.max(6, h * 0.16);
  ctx.strokeStyle = flash ? "#e8d8a8" : skin.wood; ctx.lineWidth = lvl >= 5 ? 6 : 4; ctx.lineCap = "round";
  const posts = lvl >= 5 ? [-42, -20, 0, 20, 42] : lvl === 1 ? [-18, 0, 18] : [-30, -10, 10, 30];
  for (const ox of posts) {
    ctx.beginPath(); ctx.moveTo(x + ox, groundY); ctx.lineTo(x + ox + windSway(x + ox, 2), top + 2); ctx.stroke();
  }
  ctx.lineCap = "butt";
  if (lvl === 1) {
    ctx.strokeStyle = skin.roofC; ctx.lineWidth = 3;
    for (const y of [groundY - h * 0.34, groundY - h * 0.62]) { ctx.beginPath(); ctx.moveTo(x - WW / 2 + 3, y); ctx.lineTo(x + WW / 2 - 3, y + windSway(y, 1)); ctx.stroke(); }
  } else {
    ctx.fillStyle = flash ? "#e8d8a8" : skin.wall;
    roundedRect(x - WW / 2, top + h * 0.16, WW, h * 0.84, 3); ctx.fill();
    ctx.fillStyle = skin.wood; ctx.fillRect(x - WW / 2 - 8, deckY, WW + 16, 8);
    ctx.fillStyle = skin.roofC; ctx.beginPath(); ctx.moveTo(x - WW / 2 - 10, top + h * 0.15); ctx.quadraticCurveTo(x, top - 10 - lvl * 2, x + WW / 2 + 10, top + h * 0.15); ctx.lineTo(x + WW / 2 + 3, top + h * 0.27); ctx.quadraticCurveTo(x, top + h * 0.2, x - WW / 2 - 3, top + h * 0.27); ctx.closePath(); ctx.fill();
    if (lvl >= 3) drawWallSlots(x, top + h * 0.16, WW, h * 0.84, lvl - 1);
    if (lvl >= 5) ctx.fillRect(x - WW / 2 - 12, top - 4, WW + 24, 8);
  }
  if (night && lvl >= 3) drawSkinLamp(x, top + h * 0.32, skin, 0.55);
}

function drawVolcanoWall(w, h, WW, skin, flash, night) {
  const x = w.x, lvl = w.level, top = groundY - h;
  const col = flash ? "#e8d8a8" : skin.wallD;
  if (lvl === 1) {
    for (let i = 0; i < 5; i++) {
      const px = x - WW * 0.42 + i * (WW * 0.84) / 4;
      ctx.fillStyle = i % 2 ? skin.wall : col;
      ctx.beginPath(); ctx.moveTo(px - 6, groundY); ctx.lineTo(px - 2, top + (i % 2) * 8); ctx.lineTo(px + 8, groundY); ctx.closePath(); ctx.fill();
    }
  } else if (lvl < 5) {
    roundedRect(x - WW / 2, top, WW, h, 2); ctx.fillStyle = col; ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(x - WW / 2, top, WW * 0.22, h);
    ctx.strokeStyle = skin.line; ctx.lineWidth = 1; for (let yy = top + 11; yy < groundY - 4; yy += 12) { ctx.beginPath(); ctx.moveTo(x - WW / 2 + 2, yy); ctx.lineTo(x + WW / 2 - 2, yy + ((yy / 12) % 2 ? 2 : -1)); ctx.stroke(); }
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = withA([255, 94, 24], 0.48); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x - WW * 0.35, top + h * 0.35); ctx.lineTo(x - WW * 0.06, top + h * 0.56); ctx.lineTo(x + WW * 0.33, top + h * 0.4); ctx.stroke();
    ctx.restore();
    drawWallCrenels(x, top, WW, lvl + 2, skin, flash, true);
  } else {
    roundedRect(x - WW / 2 - 2, top, WW + 4, h, 2); ctx.fillStyle = col; ctx.fill();
    for (let i = 0; i < 4; i++) {
      const y = groundY - h * (0.24 + i * 0.18);
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = withA([255, 86, 20], 0.45); ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(x - WW * 0.42, y); ctx.lineTo(x - WW * 0.12, y - 6); ctx.lineTo(x + WW * 0.4, y + 3); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = skin.wall; ctx.fillRect(x - WW / 2 - 10, groundY - h * 0.52, WW + 20, 9);
    ctx.fillRect(x - WW / 2 - 12, top, WW + 24, 10);
    drawWallCrenels(x, top, WW + 18, 5, skin, flash, true);
    if (night) drawSkinLamp(x, top + 15, skin, 0.6);
  }
}

function drawCorruptedWall(w, h, WW, skin, flash, night) {
  const x = w.x, lvl = w.level, top = groundY - h;
  const col = flash ? "#e8d8a8" : skin.wallD;
  if (lvl === 1) {
    ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      const px = x - WW * 0.42 + i * (WW * 0.84) / 4;
      ctx.beginPath(); ctx.moveTo(px, groundY); ctx.quadraticCurveTo(px + (i % 2 ? 10 : -9), top + h * 0.42, px + (i % 2 ? 2 : -2), top); ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.strokeStyle = withA([190, 112, 255], 0.42); ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(x - WW * 0.43, groundY - h * 0.48); ctx.lineTo(x + WW * 0.42, groundY - h * 0.54); ctx.stroke();
  } else if (lvl < 5) {
    for (let i = 0; i < lvl + 2; i++) {
      const px = x - WW * 0.45 + i * (WW * 0.9) / (lvl + 1);
      const lean = (i % 2 ? 1 : -1) * 0.08;
      ctx.save(); ctx.translate(px, groundY); ctx.rotate(lean);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-5, -h * 0.82); ctx.lineTo(1, -h - (i % 2) * 8); ctx.lineTo(8, -h * 0.7); ctx.lineTo(8, 0); ctx.closePath(); ctx.fill();
      if (lvl >= 3) drawRuneGlyph(0, -h * 0.52, 3.5, skin.accent2);
      ctx.restore();
    }
    ctx.fillStyle = withA([26, 8, 38], 0.86); roundedRect(x - WW / 2, groundY - 8, WW, 8, 3); ctx.fill();
  } else {
    roundedRect(x - WW / 2, top, WW, h, 3); ctx.fillStyle = col; ctx.fill();
    for (const ox of [-34, 0, 34]) {
      ctx.save(); ctx.translate(x + ox, groundY); ctx.rotate(ox * 0.002);
      ctx.fillStyle = ox === 0 ? skin.wall : skin.wallD;
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-6, -h * 0.78); ctx.lineTo(0, -h - (ox === 0 ? 26 : 10)); ctx.lineTo(12, -h * 0.72); ctx.lineTo(15, 0); ctx.closePath(); ctx.fill();
      drawRuneGlyph(0, -h * 0.58, 4.6, skin.accent2);
      ctx.restore();
    }
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = withA([190, 112, 255], 0.42); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(x, top + h * 0.38, WW * 0.48, 10, performance.now() / 4000, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}

function drawClassicTieredWall(w, h, WW, skin, flash, night) {
  const x = w.x;
  const col = flash ? "#e8d8a8" : skin.wall;
  const tw = 96, th = h;
  const platY1 = groundY - th * 0.52;
  const parapetY = groundY - th;
  const platW = tw + 18;
  const platH = 9;
  ctx.fillStyle = col; ctx.fillRect(x - tw / 2, groundY - th, tw, th);
  ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.fillRect(x - tw / 2, groundY - th, tw * 0.22, th);
  ctx.fillStyle = "rgba(0,0,0,0.16)"; ctx.fillRect(x + tw * 0.3, groundY - th, tw * 0.22, th);
  drawWallBlockLines(x, groundY - th, tw, th, skin, 11);
  drawWallSlots(x, groundY - th, tw, th, 2);
  ctx.fillStyle = col; ctx.fillRect(x - platW / 2, platY1, platW, platH);
  ctx.fillStyle = "rgba(255,255,255,0.09)"; ctx.fillRect(x - platW / 2, platY1, platW, 3);
  ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(x - platW / 2, platY1 + platH - 2, platW, 2);
  drawWallCrenels(x, platY1, platW, 4, skin, flash);
  // The top crenels are the parapet above the usable deck, rather than a
  // second invisible standing height.
  drawWallCrenels(x, parapetY, platW, 5, skin, flash);
  if (night) {
    drawSkinLamp(x - platW / 2 + 6, platY1 + 2, skin, 0.55);
    drawSkinLamp(x + platW / 2 - 6, platY1 + 2, skin, 0.55);
    drawSkinLamp(x, parapetY + 2, skin, 0.55);
  }
}

// Level-five walls vary dramatically by biome, but all use this same visible
// top deck and base-side ladder. This is the physical template used by player
// and unit movement in Wall.js.
function drawCastleWalkwayAccess(w, h, skin, flash, night) {
  const layout = wallLayout(w, h);
  const x = w.x;
  const deckY = groundY - layout.deckHeight;
  const deckW = layout.deckMaxX - layout.deckMinX;
  const col = flash ? "#e8d8a8" : skin.wall;
  const trim = flash ? "#f4e3b8" : skin.wallL;
  const rail = flash ? "#d8c090" : skin.gate;

  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.fillRect(layout.deckMinX - 2, deckY + 7, deckW + 4, 4);
  ctx.fillStyle = col;
  ctx.fillRect(layout.deckMinX - 3, deckY, deckW + 6, 8);
  ctx.fillStyle = trim;
  ctx.fillRect(layout.deckMinX - 3, deckY, deckW + 6, 2);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  for (const ox of [-43, -15, 15, 43]) {
    ctx.beginPath();
    ctx.moveTo(x + ox - 4, deckY + 8);
    ctx.lineTo(x + ox + 4, deckY + 8);
    ctx.lineTo(x + ox, deckY + 18);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "rgba(238,221,182,0.42)";
  for (let px = layout.deckMinX + 10; px < layout.deckMaxX - 5; px += 18) {
    ctx.beginPath(); ctx.arc(px, deckY + 4, 0.9, 0, Math.PI * 2); ctx.fill();
  }

  const ladX = layout.accessTopX;
  ctx.strokeStyle = rail; ctx.lineWidth = 3.2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(ladX - 5, groundY); ctx.lineTo(ladX - 5, deckY - 11); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ladX + 5, groundY); ctx.lineTo(ladX + 5, deckY - 11); ctx.stroke();
  ctx.lineWidth = 2;
  for (let ry = groundY - 7; ry > deckY + 4; ry -= 11) {
    ctx.beginPath(); ctx.moveTo(ladX - 5, ry); ctx.lineTo(ladX + 5, ry); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.moveTo(ladX - 4, ry - 1); ctx.lineTo(ladX + 4, ry - 1); ctx.stroke();
    ctx.strokeStyle = rail;
  }
  ctx.lineCap = "butt";
  ctx.fillStyle = skin.wallD;
  for (const sx of [-5, 5]) for (const sy of [groundY - 24, deckY + 18, deckY + 52]) {
    ctx.fillRect(ladX + sx - 2, sy - 1.5, 4, 3);
  }
  if (night) drawSkinLamp(x - layout.backDir * 28, deckY + 2, skin, 0.52);
}

function drawBiomeWall(w, h, WW, skin, flash, dark, night) {
  if (skin.id === "frozen") { drawFrozenWall(w, h, WW, skin, flash, night); return; }
  if (skin.id === "desert") { drawDesertWall(w, h, WW, skin, flash, night); return; }
  if (skin.id === "swamp") { drawSwampWall(w, h, WW, skin, flash, night); return; }
  if (skin.id === "volcano") { drawVolcanoWall(w, h, WW, skin, flash, night); return; }
  if (skin.id === "corrupted") { drawCorruptedWall(w, h, WW, skin, flash, night); return; }
  drawForestWall(w, h, WW, skin, flash, night);
}

// A loose detail template shared by all biome variants. Structural cues stay
// consistent (footing, edge braces, damage cracks), while the inner motifs are
// deliberately biome-specific.
function drawBiomeWallDetails(w, h, WW, skin, flash, night) {
  const x = w.x, top = groundY - h, lvl = w.level;
  const built = clamp(w.buildProgress, 0, 1);
  const edge = flash ? "#f3dfb0" : skin.wallD;
  const hi = flash ? "#fff0c8" : skin.wallL;
  ctx.save();
  ctx.globalAlpha = 0.35 + built * 0.65;

  // Footing and edge anchors make even organic level-one walls feel planted.
  ctx.fillStyle = edge;
  ctx.fillRect(x - WW / 2 - 3, groundY - 5, WW + 6, 5);
  ctx.fillStyle = "rgba(255,255,255,0.09)";
  ctx.fillRect(x - WW / 2 - 2, groundY - 5, WW + 4, 1.4);
  for (const side of [-1, 1]) {
    const ex = x + side * (WW / 2 + (lvl >= 4 ? 5 : 2));
    ctx.fillStyle = edge;
    ctx.beginPath();
    ctx.moveTo(ex - side * 3, groundY - 3);
    ctx.lineTo(ex + side * (6 + lvl), groundY - 3);
    ctx.lineTo(ex - side * 1, groundY - Math.min(h * 0.48, 38 + lvl * 3));
    ctx.closePath(); ctx.fill();
  }

  if (skin.id === "forest") {
    // Iron straps, hand-forged bolts and a little ivy between the courses.
    ctx.strokeStyle = skin.gate; ctx.lineWidth = 2.2;
    for (const ox of [-WW * 0.28, WW * 0.28]) {
      ctx.beginPath(); ctx.moveTo(x + ox, top + 8); ctx.lineTo(x + ox, groundY - 8); ctx.stroke();
      ctx.fillStyle = hi;
      for (const yy of [top + h * 0.3, top + h * 0.68]) {
        ctx.beginPath(); ctx.arc(x + ox, yy, 1.4, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (lvl >= 2) {
      ctx.strokeStyle = withA([72, 116, 54], 0.75); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x - WW * 0.46, top + h * 0.2);
      ctx.bezierCurveTo(x - WW * 0.18, top + h * 0.38, x - WW * 0.38, top + h * 0.67, x - WW * 0.08, groundY - 9); ctx.stroke();
      ctx.fillStyle = skin.accent;
      for (const [ox, oy] of [[-0.31,0.43],[-0.22,0.58],[-0.14,0.78]]) {
        ctx.beginPath(); ctx.ellipse(x + WW * ox, top + h * oy, 3, 1.5, -0.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (skin.id === "frozen") {
    // Layered frost, trapped air and small icicles under the coping.
    ctx.strokeStyle = hi; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x - WW * 0.42, top + h * 0.32);
    ctx.lineTo(x - WW * 0.12, top + h * 0.28); ctx.lineTo(x + WW * 0.08, top + h * 0.42);
    ctx.lineTo(x + WW * 0.4, top + h * 0.35); ctx.stroke();
    ctx.fillStyle = withA([225, 249, 255], 0.78);
    for (const ox of [-0.36, -0.12, 0.18, 0.39]) {
      const iy = top + 5 + Math.abs(ox) * 8;
      ctx.beginPath(); ctx.moveTo(x + WW * ox - 2, iy); ctx.lineTo(x + WW * ox + 1, iy + 9 + lvl * 2); ctx.lineTo(x + WW * ox + 3, iy); ctx.closePath(); ctx.fill();
    }
  } else if (skin.id === "desert") {
    // Sandstone relief band and glazed geometric inlays.
    const bandY = top + h * 0.56;
    ctx.fillStyle = edge; ctx.fillRect(x - WW * 0.48, bandY - 3, WW * 0.96, 7);
    ctx.fillStyle = hi;
    for (let i = -2; i <= 2; i++) {
      const px = x + i * Math.max(8, WW * 0.17);
      ctx.beginPath(); ctx.moveTo(px, bandY - 2.5); ctx.lineTo(px + 4, bandY + 0.5);
      ctx.lineTo(px, bandY + 3.5); ctx.lineTo(px - 4, bandY + 0.5); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = "rgba(78,50,26,0.42)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, top + h * 0.28, 7 + lvl, Math.PI, 0); ctx.stroke();
  } else if (skin.id === "swamp") {
    // Rope lashings, moss fringe and drainage pegs.
    ctx.strokeStyle = skin.roofD; ctx.lineWidth = 2;
    for (const ox of [-WW * 0.3, WW * 0.3]) {
      const cy = top + h * 0.44;
      ctx.beginPath(); ctx.moveTo(x + ox - 5, cy - 6); ctx.lineTo(x + ox + 5, cy + 6);
      ctx.moveTo(x + ox + 5, cy - 6); ctx.lineTo(x + ox - 5, cy + 6); ctx.stroke();
      ctx.fillStyle = skin.accent;
      ctx.beginPath(); ctx.arc(x + ox, cy, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = withA([92, 128, 67], 0.8); ctx.lineWidth = 2.4;
    for (let ox = -WW * 0.42; ox <= WW * 0.42; ox += Math.max(10, WW / 5)) {
      ctx.beginPath(); ctx.moveTo(x + ox, top + 7); ctx.quadraticCurveTo(x + ox + 3, top + 14, x + ox - 1, top + 20 + Math.abs(ox % 7)); ctx.stroke();
    }
  } else if (skin.id === "volcano") {
    // Riveted obsidian plates over a restrained ember seam.
    ctx.strokeStyle = skin.wallL; ctx.lineWidth = 2;
    ctx.strokeRect(x - WW * 0.34, top + h * 0.26, WW * 0.68, h * 0.42);
    ctx.fillStyle = hi;
    for (const ox of [-0.31, 0.31]) for (const oy of [0.3, 0.64]) {
      ctx.beginPath(); ctx.arc(x + WW * ox, top + h * oy, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = withA([255, 98, 28], night ? 0.8 : 0.55); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - WW * 0.3, groundY - 12);
    ctx.lineTo(x - WW * 0.08, groundY - 20); ctx.lineTo(x + WW * 0.06, groundY - 14); ctx.lineTo(x + WW * 0.3, groundY - 23); ctx.stroke();
    ctx.restore();
  } else if (skin.id === "corrupted") {
    // Asymmetric binding ribs and a pulsing ward at their meeting point.
    ctx.strokeStyle = skin.wallL; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(x - WW * 0.42, groundY - 8);
    ctx.quadraticCurveTo(x - WW * 0.2, top + h * 0.42, x, top + h * 0.5);
    ctx.quadraticCurveTo(x + WW * 0.26, top + h * 0.36, x + WW * 0.43, top + 9); ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha *= 0.55 + Math.sin(performance.now() / 420 + x) * 0.16;
    drawRuneGlyph(x, top + h * 0.5, 4 + lvl * 0.45, skin.accent2);
    ctx.restore();
  }

  // Damage adds readable cracks without changing collision geometry.
  const damage = w.maxHp > 0 ? clamp(1 - w.hp / w.maxHp, 0, 1) : 0;
  if (damage > 0.2) {
    ctx.strokeStyle = skin.id === "frozen" ? "rgba(235,252,255,0.72)" : "rgba(12,8,10,0.55)";
    ctx.lineWidth = 1.2 + damage;
    const cracks = damage > 0.62 ? 3 : damage > 0.38 ? 2 : 1;
    for (let i = 0; i < cracks; i++) {
      const cx = x + (i - (cracks - 1) / 2) * WW * 0.24;
      const cy = top + h * (0.28 + i * 0.16);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - 5, cy + 9); ctx.lineTo(cx + 2, cy + 15); ctx.lineTo(cx - 3, cy + 24); ctx.stroke();
    }
  }
  ctx.restore();
}

// Rampart bridge connecting the two wall platforms on one side once both
// slots are finished. Slopes to match differing wall levels so it reads as
// a single crossable span rather than two unrelated platforms.
function drawWallBridgeSpan(span) {
  const skin = baseSkinAt(span.outerX, false);
  const wood  = skin?.id === "frozen" ? "#8fb2c8" : skin?.id === "desert" ? "#9a6330" : skin?.id === "volcano" ? "#5a2c1d" : skin?.id === "corrupted" ? "#3a2138" : skin?.wood || "#6b4a26";
  const woodD = skin?.id === "frozen" ? "#476c84" : skin?.id === "desert" ? "#6a3f1d" : skin?.id === "volcano" ? "#2a1510" : skin?.id === "corrupted" ? "#170b20" : skin?.gate || "#4c3216";
  const x0 = span.outerX, y0 = groundY - span.outerY;
  const x1 = span.innerX, y1 = groundY - span.innerY;
  const len = Math.abs(x1 - x0);
  if (len < 4) return;
  const thickness = 7;

  ctx.save();

  // Support posts along the span, planted at the ground below each point.
  const nPosts = Math.max(2, Math.round(len / 60) + 1);
  ctx.fillStyle = woodD;
  for (let i = 0; i < nPosts; i++) {
    const t = i / (nPosts - 1);
    const px = x0 + (x1 - x0) * t;
    const py = y0 + (y1 - y0) * t;
    ctx.fillRect(px - 2, py + thickness, 4, groundY - (py + thickness));
  }

  // Plank deck, sloped between the two platform heights.
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  ctx.lineTo(x1, y1 + thickness); ctx.lineTo(x0, y0 + thickness);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 + 2); ctx.lineTo(x0, y0 + 2);
  ctx.closePath(); ctx.fill();

  // Plank seams
  ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1;
  const seams = Math.max(2, Math.round(len / 16));
  for (let i = 1; i < seams; i++) {
    const t = i / seams;
    const px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + thickness); ctx.stroke();
  }

  // Rope rail
  ctx.strokeStyle = woodD; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0, y0 - 13); ctx.lineTo(x1, y1 - 13); ctx.stroke();
  ctx.strokeStyle = "rgba(235,220,185,0.2)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, y0 - 14); ctx.lineTo(x1, y1 - 14); ctx.stroke();
  ctx.strokeStyle = woodD; ctx.lineWidth = 2;
  for (let i = 0; i <= nPosts; i++) {
    const t = i / nPosts;
    const px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 13); ctx.stroke();
  }

  ctx.restore();
}

export function drawWalls(dark) {
  const night=dark>0.25;
  const view = visibleWorldBounds(170);
  for (const w of state.walls) {
    const x=w.x;
    if (x < view.left || x > view.right) continue;
    const markerSkin = baseSkinAt(x, false);
    if (!w.commissioned) { drawBuildMarker(x, markerSkin.accent || "#6fb3d6"); continue; }
    const h=wallHeight(w)*(0.3+0.7*clamp(w.buildProgress,0,1));
    const WW=w.level>=5?96:wallRenderWidth(w);
    if (w.flash>0) w.flash-=0.016;
    if (w.golemImpact>0) w.golemImpact=Math.max(0,w.golemImpact-0.016);
    const flash=w.flash>0;
    const golemImpact=w.golemImpact||0;
    const skin = baseSkinAt(x, flash);
    groundShadow(x,WW*0.7,0.26);
    if (w.level<5) drawWallPlatform(w,h,flash,skin);
    drawBiomeWall(w, h, WW, skin, flash, dark, night);
    drawBiomeWallDetails(w,h,WW,skin,flash,night);
    if (w.level>=5) drawCastleWalkwayAccess(w,h,skin,flash,night);
    // Siege hits leave a brief molten fracture at the enemy-facing edge. It
    // makes the Colossus's ram and double-fist crush read as wall impacts,
    // rather than as a generic damage flash somewhere in the world.
    if (golemImpact>0.01) {
      const kind=w.golemImpactKind||'ram';
      const p=Math.min(1,golemImpact/(kind==='crush'?0.42:0.32));
      const faceX=x+w.side*(WW*0.5-1);
      const crackY=groundY-h*(kind==='crush'?0.74:0.48);
      ctx.save();
      ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=p*0.72;
      const glow=ctx.createRadialGradient(faceX,crackY,1,faceX,crackY,WW*0.58);
      glow.addColorStop(0,'rgba(255,228,150,0.9)');
      glow.addColorStop(0.28,'rgba(255,98,24,0.52)');
      glow.addColorStop(1,'rgba(150,20,0,0)');
      ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(faceX,crackY,WW*0.58,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ffb04a';
      for (let k=0;k<3;k++) {
        const sx=faceX+w.side*(6+k*7), sy=crackY+(k-1)*7;
        ctx.beginPath(); ctx.arc(sx,sy,2.2-k*0.28,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
      ctx.save(); ctx.globalAlpha=p*0.86;
      ctx.strokeStyle='#59200f'; ctx.lineWidth=2; ctx.lineCap='round';
      for (let k=0;k<3;k++) {
        const y=crackY+(k-1)*h*0.1;
        ctx.beginPath(); ctx.moveTo(faceX+w.side*2,y); ctx.lineTo(faceX-w.side*(WW*(0.24+k*0.07)),y+(k-1)*5); ctx.stroke();
      }
      ctx.restore();
    }
    drawHpBar(x,groundY-h-18,WW+6,w.hp/w.maxHp,"#9bd05a");
  }

  for (const side of [-1, 1]) {
    const span = bridgeSpan(side, state.walls);
    if (!span) continue;
    if (span.outerX < view.left - 200 || span.outerX > view.right + 200) continue;
    drawWallBridgeSpan(span);
  }
}

const BASE_BIOME_SKINS = {
  forest: {
    id: "forest", roof: "cone", wall: "#5a5260", wallD: "#403a48", wallL: "#766f7a",
    roofC: "#25406a", roofD: "#162b48", wood: "#5a3a1e", trim: "#cdbfa3",
    accent: "#9bd05a", accent2: "#f2c14e", banner: "#c1453b", gate: "#4e3820",
    window: [255, 186, 86], flame0: "#ff8a30", flame1: "#ffd060",
    aura: "rgba(155,208,90,0.13)", line: "rgba(0,0,0,0.20)",
  },
  frozen: {
    id: "frozen", roof: "ice", wall: "#a9c7d8", wallD: "#4c7086", wallL: "#e8f8ff",
    roofC: "#dff7ff", roofD: "#7bb8d8", wood: "#6c7d88", trim: "#f5fdff",
    accent: "#82dfff", accent2: "#ffffff", banner: "#65bde8", gate: "#466978",
    window: [170, 235, 255], flame0: "#75dcff", flame1: "#f0fdff",
    aura: "rgba(150,230,255,0.18)", line: "rgba(36,78,104,0.25)",
  },
  desert: {
    id: "desert", roof: "dome", wall: "#b9874f", wallD: "#6e4a28", wallL: "#edc982",
    roofC: "#d8a85c", roofD: "#8e5d2e", wood: "#6a3f1d", trim: "#ffe0a0",
    accent: "#f1b24f", accent2: "#ffd27a", banner: "#b95f34", gate: "#5a3218",
    window: [255, 216, 128], flame0: "#ffb24a", flame1: "#fff0ba",
    aura: "rgba(255,198,96,0.15)", line: "rgba(84,52,24,0.22)",
  },
  swamp: {
    id: "swamp", roof: "thatch", wall: "#314638", wallD: "#17231e", wallL: "#6f8b55",
    roofC: "#61713f", roofD: "#2a3a2a", wood: "#4d3821", trim: "#93a960",
    accent: "#9bd85a", accent2: "#d6f08a", banner: "#4f8d62", gate: "#2e2418",
    window: [190, 246, 104], flame0: "#7ad65a", flame1: "#edffba",
    aura: "rgba(120,180,74,0.17)", line: "rgba(6,18,12,0.28)",
  },
  volcano: {
    id: "volcano", roof: "jagged", wall: "#2f2b29", wallD: "#151313", wallL: "#6f4030",
    roofC: "#171317", roofD: "#080608", wood: "#4a2417", trim: "#aa5940",
    accent: "#ff6a24", accent2: "#ffb13d", banner: "#c74224", gate: "#28110c",
    window: [255, 106, 32], flame0: "#ff4a12", flame1: "#ffe36a",
    aura: "rgba(255,88,24,0.18)", line: "rgba(0,0,0,0.34)",
  },
  corrupted: {
    id: "corrupted", roof: "spire", wall: "#322244", wallD: "#171020", wallL: "#6c4aa0",
    roofC: "#241236", roofD: "#09040f", wood: "#3a2138", trim: "#a56bff",
    accent: "#b66bff", accent2: "#dca8ff", banner: "#7f4dbe", gate: "#130817",
    window: [210, 142, 255], flame0: "#9b56ff", flame1: "#f2dcff",
    aura: "rgba(178,96,255,0.18)", line: "rgba(0,0,0,0.36)",
  },
};

function baseSkinAt(x, flash) {
  const biome = biomeAt(x);
  const skin = BASE_BIOME_SKINS[biome?.id] || BASE_BIOME_SKINS.forest;
  if (!flash) return skin;
  return {
    ...skin,
    wall: "#ffd0b0",
    wallD: "#e0b090",
    wallL: "#fff0d0",
    roofC: "#ffd0b0",
    roofD: "#d09070",
    trim: "#fff1cf",
  };
}

function drawBaseGroundSeal(x, lvl, skin, dark) {
  const w = lvl >= 4 ? 265 : lvl >= 2 ? 178 : 105;
  ctx.save();
  ctx.fillStyle = skin.aura;
  ctx.beginPath(); ctx.ellipse(x, groundY + 3, w, 16 + lvl * 1.2, 0, 0, Math.PI * 2); ctx.fill();

  if (skin.id === "frozen") {
    ctx.fillStyle = withA(lerpColor([238,248,255], [95,130,160], dark), 0.72);
    for (const ox of [-84, -28, 44, 96]) {
      ctx.beginPath(); ctx.ellipse(x + ox, groundY - 2, 24, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else if (skin.id === "desert") {
    ctx.strokeStyle = withA(lerpColor([255,220,150], [88,58,34], dark), 0.42);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(x - w * 0.72 + i * 48, groundY + 2 + i % 2);
      ctx.quadraticCurveTo(x - w * 0.32 + i * 38, groundY - 5, x + w * 0.18 + i * 32, groundY + 3); ctx.stroke();
    }
  } else if (skin.id === "swamp") {
    ctx.fillStyle = withA(lerpColor([58,92,58], [6,16,14], dark), 0.46);
    for (const ox of [-96, -38, 52, 116]) {
      ctx.beginPath(); ctx.ellipse(x + ox, groundY + 2, 28, 8, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else if (skin.id === "volcano") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = withA([255, 94, 26], 0.48); ctx.lineWidth = 2;
    for (const ox of [-90, -18, 62]) {
      ctx.beginPath(); ctx.moveTo(x + ox - 18, groundY);
      ctx.lineTo(x + ox - 4, groundY - 5); ctx.lineTo(x + ox + 22, groundY - 1); ctx.stroke();
    }
    ctx.restore();
  } else if (skin.id === "corrupted") {
    const t = performance.now() / 1000;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = withA([196, 118, 255], 0.22 + 0.08 * Math.sin(t * 2.2));
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(x, groundY - 4, w * 0.58, 12, t * 0.08, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  } else {
    ctx.strokeStyle = withA([155, 208, 90], 0.28); ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.ellipse(x, groundY - 1, w * 0.62, 9, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawSkinLamp(x, y, skin, scale = 1) {
  const t = performance.now() / 1000;
  const r = 15 * scale + Math.sin(t * 8 + x) * 1.4;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y - 11 * scale, 1, x, y - 11 * scale, r * 2.1);
  g.addColorStop(0, withA(skin.window, 0.45));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 11 * scale, r * 2.1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = skin.flame0;
  ctx.beginPath(); ctx.ellipse(x, y - 10 * scale, 3.2 * scale, 7 * scale, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = skin.flame1;
  ctx.beginPath(); ctx.ellipse(x, y - 11 * scale, 1.5 * scale, 4 * scale, 0, 0, Math.PI * 2); ctx.fill();
}

function drawBiomeHearth(x, skin, dark, scale = 1) {
  const t = performance.now() / 1000;
  if (skin.id === "frozen") {
    ctx.fillStyle = withA([220, 248, 255], 0.75);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(x + i * 6 * scale - 4 * scale, groundY);
      ctx.lineTo(x + i * 6 * scale, groundY - (15 + Math.abs(i) * 4) * scale);
      ctx.lineTo(x + i * 6 * scale + 5 * scale, groundY); ctx.closePath(); ctx.fill();
    }
  } else if (skin.id === "swamp") {
    ctx.fillStyle = "#233522";
    ctx.beginPath(); ctx.ellipse(x, groundY - 2, 12 * scale, 4 * scale, 0, 0, Math.PI * 2); ctx.fill();
  } else if (skin.id === "volcano") {
    ctx.fillStyle = "#1b1412";
    ctx.beginPath(); ctx.ellipse(x, groundY - 2, 16 * scale, 5 * scale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = withA([255, 96, 24], 0.7); ctx.lineWidth = 2 * scale;
    ctx.beginPath(); ctx.moveTo(x - 11 * scale, groundY - 2); ctx.lineTo(x + 9 * scale, groundY - 5); ctx.stroke();
  } else if (skin.id === "corrupted") {
    ctx.fillStyle = "#100716";
    ctx.beginPath(); ctx.ellipse(x, groundY - 2, 15 * scale, 5 * scale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = withA([190, 110, 255], 0.38 + 0.14 * Math.sin(t * 3));
    ctx.beginPath(); ctx.arc(x, groundY - 13 * scale, 11 * scale, -0.7, 4.0); ctx.stroke();
    ctx.restore();
  } else {
    ctx.strokeStyle = skin.wood; ctx.lineWidth = 4 * scale; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x - 12 * scale, groundY - 2); ctx.lineTo(x + 10 * scale, groundY - 7 * scale); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 12 * scale, groundY - 2); ctx.lineTo(x - 10 * scale, groundY - 7 * scale); ctx.stroke();
    ctx.lineCap = "butt";
  }
  drawSkinLamp(x, groundY, skin, scale);
}

function drawBiomeShelter(x, skin, dark, scale = 1, flip = 1) {
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(flip * scale, scale);
  if (skin.id === "frozen") {
    ctx.fillStyle = skin.wall;
    ctx.beginPath(); ctx.moveTo(-30, 0); ctx.quadraticCurveTo(-26, -32, 0, -43);
    ctx.quadraticCurveTo(27, -31, 31, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.26)";
    ctx.beginPath(); ctx.moveTo(-25, -2); ctx.quadraticCurveTo(-18, -25, 0, -39); ctx.lineTo(-2, -2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = skin.line; ctx.lineWidth = 1.2;
    for (let y = -31; y < -6; y += 8) { ctx.beginPath(); ctx.moveTo(-20, y); ctx.lineTo(20, y + 3); ctx.stroke(); }
    ctx.fillStyle = skin.gate;
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-9, -15); ctx.quadraticCurveTo(0, -23, 9, -15); ctx.lineTo(9, 0); ctx.closePath(); ctx.fill();
  } else if (skin.id === "desert") {
    ctx.fillStyle = skin.wallD; ctx.fillRect(-24, -34, 48, 34);
    ctx.fillStyle = skin.wall; ctx.beginPath(); ctx.moveTo(-30, -34); ctx.lineTo(0, -52); ctx.lineTo(30, -34); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.moveTo(-30, -34); ctx.lineTo(0, -52); ctx.lineTo(-4, -34); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin.accent; ctx.fillRect(-25, -35, 50, 3);
    ctx.fillStyle = skin.gate; ctx.fillRect(-6, -18, 12, 18);
  } else if (skin.id === "swamp") {
    ctx.strokeStyle = skin.wood; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-14, -28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(14, -28); ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = skin.wood; ctx.fillRect(-27, -30, 54, 5);
    ctx.fillStyle = skin.wall; ctx.fillRect(-21, -57, 42, 29);
    ctx.fillStyle = skin.roofC;
    ctx.beginPath(); ctx.moveTo(-28, -57); ctx.lineTo(0, -73); ctx.lineTo(29, -57); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = skin.accent; ctx.lineWidth = 1.3;
    for (const ox of [-13, 0, 12]) { ctx.beginPath(); ctx.moveTo(ox, -57); ctx.quadraticCurveTo(ox + 3, -45, ox - 2, -35); ctx.stroke(); }
  } else if (skin.id === "volcano") {
    ctx.fillStyle = skin.wallD;
    ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-25, -38); ctx.lineTo(-5, -50); ctx.lineTo(24, -36); ctx.lineTo(30, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin.wall;
    ctx.beginPath(); ctx.moveTo(-25, -38); ctx.lineTo(-5, -50); ctx.lineTo(3, 0); ctx.lineTo(-30, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = skin.accent; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-4, -42); ctx.lineTo(5, -23); ctx.lineTo(1, -4); ctx.stroke();
    ctx.fillStyle = skin.gate; ctx.fillRect(-7, -18, 14, 18);
  } else if (skin.id === "corrupted") {
    ctx.fillStyle = skin.wallD;
    ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(-20, -40); ctx.lineTo(-2, -58); ctx.lineTo(23, -35); ctx.lineTo(28, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin.wall;
    ctx.beginPath(); ctx.moveTo(-20, -40); ctx.lineTo(-2, -58); ctx.lineTo(5, -3); ctx.lineTo(-28, 0); ctx.closePath(); ctx.fill();
    drawRuneGlyph(4, -27, 4, skin.accent2);
    ctx.fillStyle = skin.gate; ctx.fillRect(-6, -18, 12, 18);
  } else {
    ctx.fillStyle = skin.wallD; ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(-28, 0); ctx.lineTo(28, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin.wall; ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(-28, 0); ctx.lineTo(-8, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = skin.trim; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(0, -58); ctx.stroke();
    ctx.fillStyle = skin.banner; ctx.beginPath(); ctx.moveTo(0, -58); ctx.lineTo(12 + windSway(x, 2), -54); ctx.lineTo(0, -50); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawSkinWindow(x, y, w, h, skin, dark) {
  const glow = litWindow(dark);
  ctx.fillStyle = "#17131a";
  ctx.beginPath(); ctx.moveTo(x - w / 2 - 1, y + h); ctx.lineTo(x - w / 2 - 1, y + w * 0.45);
  ctx.arc(x, y + w * 0.45, w / 2 + 1, Math.PI, 0); ctx.lineTo(x + w / 2 + 1, y + h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = withA(skin.window, glow);
  ctx.beginPath(); ctx.moveTo(x - w / 2, y + h); ctx.lineTo(x - w / 2, y + w * 0.45);
  ctx.arc(x, y + w * 0.45, w / 2, Math.PI, 0); ctx.lineTo(x + w / 2, y + h); ctx.closePath(); ctx.fill();
}

function drawMasonryRect(x, y, w, h, skin, dark, rounded = 0) {
  const base = dark > 0.68 ? skin.wallD : skin.wall;
  ctx.fillStyle = base;
  if (rounded) { roundedRect(x - w / 2, y, w, h, rounded); ctx.fill(); }
  else ctx.fillRect(x - w / 2, y, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(x - w / 2, y, w * 0.28, h);
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.fillRect(x + w * 0.22, y, w * 0.28, h);
  ctx.strokeStyle = skin.line; ctx.lineWidth = 1;
  const step = skin.id === "desert" ? 13 : skin.id === "frozen" ? 14 : 11;
  for (let yy = y + step; yy < y + h - 4; yy += step) {
    ctx.beginPath(); ctx.moveTo(x - w / 2 + 3, yy); ctx.lineTo(x + w / 2 - 3, yy); ctx.stroke();
  }
  for (let yy = y + step, row = 0; yy < y + h - 4; yy += step, row++) {
    for (let xx = x - w / 2 + ((row % 2) ? step * 1.4 : step * 0.7); xx < x + w / 2 - 4; xx += step * 1.5) {
      ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, Math.min(yy + step, y + h - 2)); ctx.stroke();
    }
  }
}

function drawBiomeBattlements(cx, cw, cy, n, skin, mh = 9) {
  const mW = cw / (n * 2 - 1);
  ctx.fillStyle = skin.wall;
  if (skin.roof === "ice") {
    for (let i = 0; i < n; i++) {
      const x0 = cx - cw / 2 + i * mW * 2 + mW * 0.5;
      ctx.beginPath(); ctx.moveTo(x0 - mW * 0.62, cy); ctx.lineTo(x0, cy - mh - 5); ctx.lineTo(x0 + mW * 0.62, cy); ctx.closePath(); ctx.fill();
    }
    return;
  }
  if (skin.roof === "jagged" || skin.roof === "spire") {
    for (let i = 0; i < n; i++) {
      const x0 = cx - cw / 2 + i * mW * 2;
      ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x0 + mW * 0.45, cy - mh - (i % 2) * 5); ctx.lineTo(x0 + mW, cy); ctx.closePath(); ctx.fill();
    }
    return;
  }
  for (let i = 0; i < n; i++) ctx.fillRect(cx - cw / 2 + i * mW * 2, cy - mh, mW, mh + 1);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i < n; i++) ctx.fillRect(cx - cw / 2 + i * mW * 2, cy - mh, mW, 2);
}

function drawBiomeRoof(cx, cy, r, hh, skin) {
  ctx.fillStyle = skin.roofC;
  if (skin.roof === "dome") {
    ctx.beginPath(); ctx.ellipse(cx, cy, r, hh * 0.62, Math.PI, 0, Math.PI); ctx.lineTo(cx + r, cy); ctx.lineTo(cx - r, cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.ellipse(cx - r * 0.25, cy - 2, r * 0.38, hh * 0.42, Math.PI, 0, Math.PI); ctx.lineTo(cx, cy); ctx.lineTo(cx - r * 0.65, cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin.accent2; ctx.beginPath(); ctx.arc(cx, cy - hh * 0.62 - 2, 3, 0, Math.PI * 2); ctx.fill();
  } else if (skin.roof === "thatch") {
    ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.quadraticCurveTo(cx, cy - hh, cx + r, cy); ctx.lineTo(cx + r * 0.84, cy + 8); ctx.quadraticCurveTo(cx, cy + 2, cx - r * 0.84, cy + 8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = skin.roofD; ctx.lineWidth = 1.2;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(cx + i * r / 4, cy + 5); ctx.lineTo(cx + i * r / 7, cy - hh * 0.75); ctx.stroke(); }
  } else if (skin.roof === "ice") {
    ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx, cy - hh - 7); ctx.lineTo(cx + r, cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx, cy - hh - 7); ctx.lineTo(cx - r * 0.08, cy); ctx.closePath(); ctx.fill();
  } else if (skin.roof === "jagged") {
    ctx.fillStyle = skin.roofD;
    ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx - r * 0.42, cy - hh * 0.74); ctx.lineTo(cx - r * 0.1, cy - hh * 0.45);
    ctx.lineTo(cx + r * 0.15, cy - hh); ctx.lineTo(cx + r * 0.55, cy - hh * 0.55); ctx.lineTo(cx + r, cy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = skin.accent; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx + r * 0.12, cy - hh * 0.8); ctx.lineTo(cx + r * 0.03, cy - 3); ctx.stroke();
  } else if (skin.roof === "spire") {
    ctx.fillStyle = skin.roofD;
    ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx - r * 0.18, cy - hh * 0.6); ctx.lineTo(cx, cy - hh - 18); ctx.lineTo(cx + r * 0.24, cy - hh * 0.46); ctx.lineTo(cx + r, cy); ctx.closePath(); ctx.fill();
    drawRuneGlyph(cx, cy - hh * 0.55, 3.4, skin.accent2);
  } else {
    ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx, cy - hh); ctx.lineTo(cx + r, cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx, cy - hh); ctx.lineTo(cx - r * 0.18, cy); ctx.closePath(); ctx.fill();
  }
}

function drawBiomePennant(px, py, skin, col = skin.banner, size = 1) {
  const sway = windSway(px, 3) * size;
  ctx.strokeStyle = skin.trim; ctx.lineWidth = 1.5 * size;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 18 * size); ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(px, py - 18 * size);
  ctx.quadraticCurveTo(px + (10 + sway) * size, py - 16 * size, px + (17 + sway) * size, py - 12 * size);
  ctx.quadraticCurveTo(px + (10 + sway) * size, py - 8 * size, px, py - 6 * size); ctx.closePath(); ctx.fill();
}

function drawBiomeHouse(x, h, skin, dark, scale = 1) {
  const w = h * 0.9 * scale;
  h *= scale;
  if (skin.id === "swamp") {
    const top = groundY - h - 14;
    ctx.strokeStyle = skin.wood; ctx.lineWidth = 3;
    for (const ox of [-w * 0.35, w * 0.35]) { ctx.beginPath(); ctx.moveTo(x + ox, groundY); ctx.lineTo(x + ox * 0.86, top + h); ctx.stroke(); }
    ctx.fillStyle = skin.wood; ctx.fillRect(x - w / 2 - 6, top + h - 3, w + 12, 5);
    drawMasonryRect(x, top, w, h, skin, dark, 2);
    drawBiomeRoof(x, top, w * 0.58, 22 * scale, skin);
  } else if (skin.id === "desert") {
    drawMasonryRect(x, groundY - h, w, h, skin, dark, 5);
    ctx.fillStyle = skin.wallL; ctx.fillRect(x - w / 2 - 4, groundY - h - 5, w + 8, 8);
    drawBiomeRoof(x, groundY - h - 5, w * 0.32, 22 * scale, skin);
  } else if (skin.id === "corrupted") {
    ctx.save(); ctx.translate(x, groundY); ctx.rotate((x % 2 ? -0.035 : 0.035));
    drawMasonryRect(0, -h, w * 0.86, h, skin, dark, 3);
    drawBiomeRoof(0, -h, w * 0.5, 28 * scale, skin);
    drawSkinWindow(0, -h * 0.62, 10 * scale, 14 * scale, skin, dark);
    ctx.restore(); return;
  } else {
    drawMasonryRect(x, groundY - h, w, h, skin, dark, 3);
    drawBiomeRoof(x, groundY - h, w * 0.56, 28 * scale, skin);
  }
  drawSkinWindow(x, groundY - h * 0.58, 11 * scale, 14 * scale, skin, dark);
  ctx.fillStyle = skin.gate; ctx.fillRect(x - w * 0.14, groundY - h * 0.36, w * 0.2, h * 0.36);
}

function drawBiomeTower(x, h, skin, dark, narrow = false) {
  const w = narrow ? 30 : 38;
  drawMasonryRect(x, groundY - h, w, h, skin, dark, 2);
  ctx.fillStyle = skin.wallL; ctx.fillRect(x - w / 2 - 4, groundY - h - 6, w + 8, 7);
  if (skin.roof === "dome") {
    drawBiomeBattlements(x, w + 8, groundY - h - 6, 3, skin, 8);
    drawBiomeRoof(x, groundY - h - 10, w * 0.42, 20, skin);
  } else {
    drawBiomeRoof(x, groundY - h - 6, w / 2 + 8, skin.roof === "spire" ? 42 : 32, skin);
  }
  drawSkinWindow(x, groundY - h * 0.72, 8, 12, skin, dark);
  if (!narrow) drawSkinWindow(x, groundY - h * 0.43, 8, 12, skin, dark);
}

function drawForestVillage(x, lvl, skin, dark, night) {
  const fortified = lvl >= 3;
  if (fortified) {
    ctx.fillStyle = skin.wallD;
    roundedRect(x - 124, groundY - 36, 248, 36, 3); ctx.fill();
    drawBiomeBattlements(x, 220, groundY - 36, 8, skin, 7);
  }
  drawBiomeHouse(x - (fortified ? 92 : 60), fortified ? 60 : 54, skin, dark, 1);
  drawBiomeHouse(x + (fortified ? 88 : 58), fortified ? 56 : 48, skin, dark, 1);
  if (fortified) {
    drawBiomeTower(x - 30, 120, skin, dark);
    drawBiomeTower(x + 34, 110, skin, dark);
    drawBiomePennant(x - 122, groundY - 122, skin, skin.accent);
    drawBiomePennant(x + 122, groundY - 116, skin, skin.banner);
  } else {
    drawBiomeTower(x, 100, skin, dark);
  }
  drawBiomeHearth(x - (fortified ? 0 : 6), skin, dark, 0.9);
  if (night) {
    drawSkinLamp(x - (fortified ? 122 : 92), groundY, skin, 0.75);
    drawSkinLamp(x + (fortified ? 122 : 92), groundY, skin, 0.75);
  }
}

function drawFrozenVillage(x, lvl, skin, dark, night) {
  const ice = lerpColor([214, 238, 248], [70, 104, 136], dark);
  const deep = lerpColor([92, 142, 170], [22, 42, 66], dark);
  ctx.fillStyle = withA(ice, 0.72);
  ctx.beginPath(); ctx.ellipse(x, groundY - 2, lvl >= 3 ? 148 : 108, 14, 0, 0, Math.PI * 2); ctx.fill();
  for (const [ox, h, w] of (lvl >= 3 ? [[-86, 86, 24], [-36, 118, 30], [18, 98, 25], [70, 74, 19]] : [[-48, 82, 25], [28, 66, 22], [76, 48, 17]])) {
    ctx.fillStyle = rgb(deep);
    ctx.beginPath(); ctx.moveTo(x + ox - w, groundY); ctx.lineTo(x + ox - w * 0.22, groundY - h * 0.72); ctx.lineTo(x + ox + w * 0.2, groundY - h); ctx.lineTo(x + ox + w, groundY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.24)";
    ctx.beginPath(); ctx.moveTo(x + ox - w, groundY); ctx.lineTo(x + ox + w * 0.2, groundY - h); ctx.lineTo(x + ox - w * 0.08, groundY); ctx.closePath(); ctx.fill();
    drawSkinWindow(x + ox + w * 0.05, groundY - h * 0.48, 8, 13, skin, dark);
  }
  if (lvl >= 3) {
    ctx.strokeStyle = withA(skin.window, 0.48); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 118, groundY - 30); ctx.quadraticCurveTo(x, groundY - 72, x + 116, groundY - 30); ctx.stroke();
    for (const ox of [-122, 122]) drawBiomeRoof(x + ox, groundY - 36, 14, 30, skin);
  }
  drawBiomeHearth(x, skin, dark, 0.85);
  if (night) { drawSkinLamp(x - 96, groundY - 12, skin, 0.72); drawSkinLamp(x + 96, groundY - 12, skin, 0.72); }
}

function drawDesertVillage(x, lvl, skin, dark, night) {
  const palaceW = lvl >= 3 ? 238 : 156;
  const baseY = groundY - (lvl >= 3 ? 58 : 48);
  drawMasonryRect(x, baseY, palaceW, groundY - baseY, skin, dark, 6);
  ctx.fillStyle = skin.wallL; ctx.fillRect(x - palaceW / 2 - 5, baseY - 5, palaceW + 10, 8);
  drawBiomeRoof(x, baseY - 5, lvl >= 3 ? 44 : 34, lvl >= 3 ? 44 : 34, skin);
  for (const ox of (lvl >= 3 ? [-100, 100] : [-62, 62])) {
    drawMasonryRect(x + ox, groundY - 88, 28, 88, skin, dark, 9);
    drawBiomeRoof(x + ox, groundY - 90, 17, 23, skin);
  }
  if (lvl >= 3) {
    for (let i = -2; i <= 2; i++) {
      const px = x + i * 28;
      ctx.fillStyle = skin.wallL; ctx.fillRect(px - 4, baseY + 12, 8, groundY - baseY - 12);
      ctx.fillStyle = skin.wallD; ctx.beginPath(); ctx.arc(px, baseY + 12, 6, Math.PI, 0); ctx.fill();
    }
    drawBiomePennant(x - 122, groundY - 96, skin, skin.accent2);
    drawBiomePennant(x + 122, groundY - 96, skin, skin.banner);
  }
  drawBiomeHearth(x - palaceW * 0.38, skin, dark, 0.78);
  if (night) { drawSkinLamp(x - palaceW * 0.48, groundY - 10, skin, 0.7); drawSkinLamp(x + palaceW * 0.48, groundY - 10, skin, 0.7); }
}

function drawSwampVillage(x, lvl, skin, dark, night) {
  const deckY = groundY - (lvl >= 3 ? 48 : 34);
  const deckW = lvl >= 3 ? 250 : 160;
  ctx.strokeStyle = skin.wood; ctx.lineWidth = 5; ctx.lineCap = "round";
  for (const ox of (lvl >= 3 ? [-108, -54, 0, 54, 108] : [-58, 0, 58])) {
    ctx.beginPath(); ctx.moveTo(x + ox, groundY); ctx.lineTo(x + ox + windSway(x + ox, 2), deckY); ctx.stroke();
  }
  ctx.lineCap = "butt";
  ctx.fillStyle = skin.wood; ctx.fillRect(x - deckW / 2, deckY, deckW, 8);
  ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(x - deckW / 2, deckY, deckW, 2);
  for (const [ox, h, w] of (lvl >= 3 ? [[-78, 50, 48], [0, 66, 58], [78, 46, 44]] : [[-44, 42, 42], [44, 48, 44]])) {
    ctx.fillStyle = skin.wall; ctx.fillRect(x + ox - w / 2, deckY - h, w, h);
    drawBiomeRoof(x + ox, deckY - h, w * 0.68, 25, skin);
    drawSkinWindow(x + ox, deckY - h * 0.54, 9, 12, skin, dark);
  }
  if (lvl >= 3) {
    ctx.strokeStyle = skin.accent; ctx.lineWidth = 1.6;
    for (const ox of [-120, -35, 44, 118]) {
      ctx.beginPath(); ctx.moveTo(x + ox, deckY - 5); ctx.quadraticCurveTo(x + ox + windSway(ox, 6), deckY + 28, x + ox - 8, groundY - 4); ctx.stroke();
    }
  }
  drawBiomeHearth(x, skin, dark, 0.75);
  if (night) { drawSkinLamp(x - deckW * 0.45, deckY + 8, skin, 0.65); drawSkinLamp(x + deckW * 0.45, deckY + 8, skin, 0.65); }
}

function drawVolcanoVillage(x, lvl, skin, dark, night) {
  const w = lvl >= 3 ? 244 : 162;
  const h = lvl >= 3 ? 74 : 54;
  for (let i = 0; i < (lvl >= 3 ? 3 : 2); i++) {
    const sw = w - i * 48, sy = groundY - (i + 1) * h * 0.42;
    drawMasonryRect(x, sy, sw, h * 0.42, skin, dark, 1);
  }
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = withA([255, 94, 24], 0.62); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 46, groundY - h * 0.82); ctx.lineTo(x - 8, groundY - h * 1.08); ctx.lineTo(x + 44, groundY - h * 0.78); ctx.stroke();
  ctx.restore();
  for (const ox of (lvl >= 3 ? [-92, 92] : [-58, 58])) {
    ctx.fillStyle = skin.wallD;
    ctx.beginPath(); ctx.moveTo(x + ox - 16, groundY); ctx.lineTo(x + ox - 10, groundY - 90); ctx.lineTo(x + ox + 14, groundY - 106); ctx.lineTo(x + ox + 18, groundY); ctx.closePath(); ctx.fill();
    if (night || lvl >= 3) drawSkinLamp(x + ox + 2, groundY - 68, skin, 0.65);
  }
  drawBiomeHearth(x, skin, dark, 0.92);
}

function drawCorruptedVillage(x, lvl, skin, dark, night) {
  const t = performance.now() / 1000;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = withA([190, 110, 255], 0.23); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.ellipse(x, groundY - 18, lvl >= 3 ? 132 : 90, 22, t * 0.1, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  for (const [ox, h, w, lean] of (lvl >= 3 ? [[-86, 92, 28, -0.08], [-30, 132, 34, 0.04], [32, 112, 30, -0.03], [88, 76, 22, 0.08]] : [[-42, 92, 30, -0.06], [34, 72, 26, 0.06]])) {
    ctx.save(); ctx.translate(x + ox, groundY); ctx.rotate(lean);
    ctx.fillStyle = skin.wallD;
    ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w * 0.42, -h * 0.72); ctx.lineTo(0, -h); ctx.lineTo(w * 0.52, -h * 0.62); ctx.lineTo(w, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin.wall;
    ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(0, -h); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    drawRuneGlyph(0, -h * 0.55, 4.2, skin.accent2);
    ctx.restore();
  }
  if (lvl >= 3) {
    for (const ox of [-116, 118]) {
      ctx.fillStyle = withA([178, 96, 255], 0.72);
      ctx.beginPath(); ctx.moveTo(x + ox, groundY - 58); ctx.lineTo(x + ox + 8, groundY - 44); ctx.lineTo(x + ox, groundY - 30); ctx.lineTo(x + ox - 8, groundY - 44); ctx.closePath(); ctx.fill();
    }
  }
  drawBiomeHearth(x, skin, dark, 0.82);
  if (night) { drawSkinLamp(x - 94, groundY - 18, skin, 0.65); drawSkinLamp(x + 94, groundY - 18, skin, 0.65); }
}

function drawBiomeVillage(x, lvl, skin, dark, night) {
  if (skin.id === "frozen") { drawFrozenVillage(x, lvl, skin, dark, night); return; }
  if (skin.id === "desert") { drawDesertVillage(x, lvl, skin, dark, night); return; }
  if (skin.id === "swamp") { drawSwampVillage(x, lvl, skin, dark, night); return; }
  if (skin.id === "volcano") { drawVolcanoVillage(x, lvl, skin, dark, night); return; }
  if (skin.id === "corrupted") { drawCorruptedVillage(x, lvl, skin, dark, night); return; }
  drawForestVillage(x, lvl, skin, dark, night);
}

function drawBiomeCamp(x, skin, dark, night) {
  drawBiomeShelter(x - 36, skin, dark, 0.95, 1);
  drawBiomeShelter(x + 38, skin, dark, 0.86, -1);
  if (skin.id === "forest") {
    ctx.fillStyle = skin.wallD;
    roundedRect(x - 54, groundY - 15, 108, 15, 3); ctx.fill();
    drawBiomeBattlements(x, 98, groundY - 15, 5, skin, 5);
  }
  drawBiomeHearth(x, skin, dark, 1);
  if (night) {
    drawSkinLamp(x - 58, groundY, skin, 0.72);
    drawSkinLamp(x + 58, groundY, skin, 0.72);
  }
}

function drawBiomeGate(x, ground, skin, dark) {
  const gw = 44, gh = 58;
  ctx.fillStyle = skin.wallL;
  ctx.beginPath(); ctx.moveTo(x - gw / 2 - 7, ground); ctx.lineTo(x - gw / 2 - 7, ground - gh + 4);
  ctx.arc(x, ground - gh + 4, gw / 2 + 7, Math.PI, 0); ctx.lineTo(x + gw / 2 + 7, ground); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#171118";
  ctx.beginPath(); ctx.moveTo(x - gw / 2, ground); ctx.lineTo(x - gw / 2, ground - gh + 7);
  ctx.arc(x, ground - gh + 7, gw / 2, Math.PI, 0); ctx.lineTo(x + gw / 2, ground); ctx.closePath(); ctx.fill();
  ctx.fillStyle = skin.gate;
  ctx.beginPath(); ctx.moveTo(x - gw / 2 + 3, ground); ctx.lineTo(x - gw / 2 + 3, ground - gh + 11);
  ctx.arc(x, ground - gh + 11, gw / 2 - 3, Math.PI, 0); ctx.lineTo(x + gw / 2 - 3, ground); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.32)"; ctx.lineWidth = 1.2;
  for (const dxx of [-12, -4, 4, 12]) { ctx.beginPath(); ctx.moveTo(x + dxx, ground); ctx.lineTo(x + dxx, ground - gh + 17); ctx.stroke(); }
  ctx.fillStyle = withA(skin.window, litWindow(dark) * 0.65);
  ctx.fillRect(x - 1, ground - gh + 17, 2, gh - 17);
  ctx.fillStyle = skin.accent2;
  ctx.beginPath(); ctx.moveTo(x, ground - gh - 15); ctx.lineTo(x + 7, ground - gh - 4);
  ctx.lineTo(x, ground + 3 - gh); ctx.lineTo(x - 7, ground - gh - 4); ctx.closePath(); ctx.fill();
}

function drawStrongholdDressing(x, lvl, skin, dark, dims) {
  const t = performance.now() / 1000;
  if (skin.id === "forest") {
    ctx.strokeStyle = withA([112, 170, 82], 0.72); ctx.lineWidth = 1.8; ctx.lineCap = "round";
    for (const ox of [-142, -95, 96, 143]) {
      ctx.beginPath(); ctx.moveTo(x + ox, groundY - 8);
      ctx.quadraticCurveTo(x + ox + windSway(ox, 5), groundY - 42, x + ox * 0.86, groundY - 84); ctx.stroke();
    }
    ctx.lineCap = "butt";
  } else if (skin.id === "frozen") {
    ctx.fillStyle = "rgba(245,253,255,0.86)";
    for (const ox of [-146, -112, -44, 44, 112, 146]) {
      ctx.beginPath(); ctx.moveTo(x + ox - 4, groundY - dims.wallH - 2);
      ctx.lineTo(x + ox, groundY - dims.wallH - 18 - Math.abs(ox % 3));
      ctx.lineTo(x + ox + 4, groundY - dims.wallH - 2); ctx.closePath(); ctx.fill();
    }
  } else if (skin.id === "desert") {
    ctx.fillStyle = skin.accent2;
    ctx.beginPath(); ctx.arc(x, groundY - dims.keepH - 30, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = withA([255, 222, 128], 0.62); ctx.lineWidth = 1.4;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 14, groundY - dims.keepH - 30 + Math.sin(a) * 14);
      ctx.lineTo(x + Math.cos(a) * 22, groundY - dims.keepH - 30 + Math.sin(a) * 22); ctx.stroke();
    }
  } else if (skin.id === "swamp") {
    ctx.strokeStyle = withA([155, 208, 90], 0.7); ctx.lineWidth = 1.6; ctx.lineCap = "round";
    for (const ox of [-128, -72, 52, 130]) {
      ctx.beginPath(); ctx.moveTo(x + ox, groundY - dims.wallH);
      ctx.quadraticCurveTo(x + ox + windSway(ox, 4), groundY - dims.wallH * 0.52, x + ox - 4, groundY - 12); ctx.stroke();
    }
    ctx.lineCap = "butt";
  } else if (skin.id === "volcano") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = withA([255, 94, 24], 0.5 + 0.12 * Math.sin(t * 3));
    ctx.lineWidth = 1.8;
    for (const ox of [-110, -24, 36, 112]) {
      ctx.beginPath(); ctx.moveTo(x + ox, groundY - dims.wallH + 8);
      ctx.lineTo(x + ox + 9, groundY - dims.wallH * 0.55); ctx.lineTo(x + ox + 2, groundY - 9); ctx.stroke();
    }
    ctx.restore();
  } else if (skin.id === "corrupted") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const ox of [-136, -74, 74, 136]) {
      const y = groundY - dims.wallH - 36 + Math.sin(t * 2 + ox) * 4;
      ctx.fillStyle = withA([178, 96, 255], 0.62);
      ctx.beginPath(); ctx.moveTo(x + ox, y - 11); ctx.lineTo(x + ox + 6, y); ctx.lineTo(x + ox, y + 11); ctx.lineTo(x + ox - 6, y); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  if (lvl >= 5) {
    drawBiomePennant(x - dims.wallW / 2 + 10, groundY - dims.wallH - 2, skin, skin.accent);
    drawBiomePennant(x + dims.wallW / 2 - 10, groundY - dims.wallH - 2, skin, skin.banner);
  }
  if (lvl >= 6) {
    drawBiomePennant(x - dims.keepW * 0.48, groundY - dims.keepH - 44, skin, skin.accent2, 0.9);
    drawBiomePennant(x + dims.keepW * 0.48, groundY - dims.keepH - 44, skin, skin.accent2, 0.9);
  }
}

function drawRoyalBiomeBeacon(x, skin) {
  const t = performance.now() / 1000;
  const flare = state.base?.aegisFlashUntil ? Math.max(0, Math.min(1, (state.base.aegisFlashUntil - t) / 0.35)) : 0;
  const y = groundY - 266 + Math.sin(t * 2.2) * 2.5;
  const r = 25 + Math.sin(t * 7) * 2 + flare * 22;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 2, x, y, r);
  g.addColorStop(0, withA(skin.window, 0.8));
  g.addColorStop(0.55, withA(skin.window, 0.28));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = skin.accent2;
  ctx.beginPath();
  ctx.moveTo(x - 8, y + 15); ctx.lineTo(x - 8, y + 9); ctx.lineTo(x - 3.5, y + 12);
  ctx.lineTo(x, y + 7); ctx.lineTo(x + 3.5, y + 12); ctx.lineTo(x + 8, y + 9);
  ctx.lineTo(x + 8, y + 15); ctx.closePath(); ctx.fill();
  drawSkinLamp(x, y + 9, skin, 1.1);
}

function drawCrystalBody(cx, baseY, h, w, skin, dark) {
  const ice = lerpColor([188, 232, 248], [54, 90, 124], dark);
  const deep = lerpColor([100, 166, 202], [16, 38, 68], dark);
  ctx.fillStyle = rgb(deep);
  ctx.beginPath();
  ctx.moveTo(cx - w, baseY);
  ctx.lineTo(cx - w * 0.38, baseY - h * 0.74);
  ctx.lineTo(cx + w * 0.08, baseY - h);
  ctx.lineTo(cx + w * 0.62, baseY - h * 0.62);
  ctx.lineTo(cx + w, baseY);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = withA(ice, 0.48);
  ctx.beginPath();
  ctx.moveTo(cx - w, baseY);
  ctx.lineTo(cx + w * 0.08, baseY - h);
  ctx.lineTo(cx - w * 0.08, baseY);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = withA(skin.window, 0.35); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(cx + w * 0.08, baseY - h); ctx.lineTo(cx + w * 0.28, baseY - 5); ctx.stroke();
}

function drawFrozenCitadel(x, lvl, skin, dark, night) {
  const tier = lvl - 4;
  const baseW = 282 + tier * 22;
  const shelfY = groundY - 48 - tier * 5;
  ctx.fillStyle = withA(lerpColor([232, 246, 255], [74, 108, 138], dark), 0.74);
  ctx.beginPath(); ctx.ellipse(x, groundY - 4, baseW * 0.56, 18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = skin.wallD;
  ctx.beginPath();
  ctx.moveTo(x - baseW / 2, groundY);
  ctx.lineTo(x - baseW * 0.43, shelfY);
  ctx.lineTo(x + baseW * 0.42, shelfY - 2);
  ctx.lineTo(x + baseW / 2, groundY);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = withA([255,255,255], 0.16);
  ctx.beginPath(); ctx.moveTo(x - baseW * 0.43, shelfY); ctx.lineTo(x - baseW * 0.12, groundY); ctx.lineTo(x - baseW / 2, groundY); ctx.closePath(); ctx.fill();

  const shards = [
    [-112, 142 + tier * 8, 31],
    [-54, 192 + tier * 13, 38],
    [10, 226 + tier * 17, 46],
    [72, 166 + tier * 13, 34],
    [128, 118 + tier * 10, 25],
  ];
  for (const [ox, h, w] of shards) drawCrystalBody(x + ox, groundY, h, w, skin, dark);
  for (const [ox, h, w] of shards.slice(1, 4)) drawSkinWindow(x + ox + w * 0.05, groundY - h * 0.48, 9, 15, skin, dark);
  if (lvl >= 5) {
    ctx.strokeStyle = withA(skin.window, 0.5); ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(x - 148, shelfY - 10); ctx.quadraticCurveTo(x, shelfY - 64, x + 148, shelfY - 10); ctx.stroke();
  }
  if (lvl >= 6) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const ox of [-92, -28, 38, 98]) {
      const y = shelfY - 86 + Math.sin(performance.now() / 650 + ox) * 4;
      ctx.fillStyle = withA(skin.window, 0.58);
      ctx.beginPath(); ctx.moveTo(x + ox, y - 12); ctx.lineTo(x + ox + 7, y); ctx.lineTo(x + ox, y + 12); ctx.lineTo(x + ox - 7, y); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  if (lvl >= 7) drawRoyalBiomeBeacon(x, skin);
  if (night) { drawSkinLamp(x - 132, shelfY + 8, skin, 0.75); drawSkinLamp(x + 132, shelfY + 8, skin, 0.75); }
}

function drawDesertPalace(x, lvl, skin, dark, night) {
  const tier = lvl - 4;
  const baseW = 330 + tier * 22;
  const bodyH = 82 + tier * 5;
  const y = groundY - bodyH;
  drawMasonryRect(x, y, baseW, bodyH, skin, dark, 8);
  ctx.fillStyle = skin.wallL; ctx.fillRect(x - baseW / 2 - 6, y - 7, baseW + 12, 9);
  for (let i = -4; i <= 4; i++) {
    const px = x + i * (baseW / 10);
    ctx.fillStyle = skin.wallL; roundedRect(px - 5, y + 18, 10, bodyH - 18, 3); ctx.fill();
    ctx.fillStyle = skin.wallD; ctx.beginPath(); ctx.arc(px, y + 19, 7, Math.PI, 0); ctx.fill();
  }
  drawBiomeRoof(x, y - 7, 58 + tier * 5, 58 + tier * 4, skin);
  for (const side of [-1, 1]) {
    const mx = x + side * (126 + tier * 7);
    drawMasonryRect(mx, groundY - 154 - tier * 12, 34, 154 + tier * 12, skin, dark, 12);
    drawBiomeRoof(mx, groundY - 158 - tier * 12, 22, 32, skin);
    drawSkinWindow(mx, groundY - 120 - tier * 7, 8, 13, skin, dark);
  }
  if (lvl >= 5) {
    for (const ox of [-72, 72]) drawBiomeRoof(x + ox, y - 6, 30, 34, skin);
  }
  if (lvl >= 6) {
    ctx.strokeStyle = withA([255, 228, 138], 0.58); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(x, y - 66, 23, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 28, y - 66 + Math.sin(a) * 28);
      ctx.lineTo(x + Math.cos(a) * 40, y - 66 + Math.sin(a) * 40); ctx.stroke();
    }
  }
  if (lvl >= 7) drawRoyalBiomeBeacon(x, skin);
  if (night) { drawSkinLamp(x - baseW * 0.42, groundY - 18, skin, 0.72); drawSkinLamp(x + baseW * 0.42, groundY - 18, skin, 0.72); }
}

function drawSwampGroveFort(x, lvl, skin, dark, night) {
  const tier = lvl - 4;
  const mainY = groundY - 78 - tier * 6;
  const deckW = 302 + tier * 22;
  ctx.strokeStyle = skin.wood; ctx.lineWidth = 10; ctx.lineCap = "round";
  for (const ox of [-126, -64, 0, 64, 126]) {
    ctx.beginPath(); ctx.moveTo(x + ox + windSway(ox, 4), groundY + 2); ctx.lineTo(x + ox * 0.72, mainY - 14 - Math.abs(ox) * 0.16); ctx.stroke();
  }
  ctx.lineCap = "butt";
  ctx.fillStyle = skin.wood; roundedRect(x - deckW / 2, mainY, deckW, 12, 5); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(x - deckW / 2, mainY, deckW, 3);
  const huts = [
    [-104, 54, 56, mainY],
    [-24, 74 + tier * 8, 68, mainY - 24],
    [72, 58 + tier * 5, 58, mainY - 8],
  ];
  if (lvl >= 6) huts.push([132, 44, 44, mainY + 10]);
  for (const [ox, h, w, deckY] of huts) {
    ctx.fillStyle = skin.wall; roundedRect(x + ox - w / 2, deckY - h, w, h, 4); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.fillRect(x + ox + w * 0.18, deckY - h, w * 0.28, h);
    drawBiomeRoof(x + ox, deckY - h, w * 0.7, 30, skin);
    drawSkinWindow(x + ox, deckY - h * 0.56, 9, 13, skin, dark);
  }
  ctx.strokeStyle = withA(skin.accent, 0.76); ctx.lineWidth = 2; ctx.lineCap = "round";
  for (const ox of [-148, -86, -18, 46, 116, 154]) {
    ctx.beginPath(); ctx.moveTo(x + ox, mainY + 3); ctx.quadraticCurveTo(x + ox + windSway(ox, 8), mainY + 48, x + ox - 10, groundY - 3); ctx.stroke();
  }
  ctx.lineCap = "butt";
  if (lvl >= 7) drawRoyalBiomeBeacon(x, skin);
  if (night) { drawSkinLamp(x - 146, mainY + 13, skin, 0.68); drawSkinLamp(x + 146, mainY + 13, skin, 0.68); }
}

function drawVolcanoForgeCitadel(x, lvl, skin, dark, night) {
  const tier = lvl - 4;
  const layers = 4 + tier;
  for (let i = 0; i < layers; i++) {
    const w = 318 - i * 42;
    const h = 32 + i * 4;
    const y = groundY - (i + 1) * 28 - h * 0.18;
    drawMasonryRect(x, y, w, h, skin, dark, 1);
    if (i > 0) {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = withA([255, 86, 22], 0.42 + 0.06 * Math.sin(performance.now() / 420 + i));
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(x - w * 0.36, y + h * 0.55); ctx.lineTo(x - w * 0.08, y + h * 0.36); ctx.lineTo(x + w * 0.34, y + h * 0.6); ctx.stroke();
      ctx.restore();
    }
  }
  const topY = groundY - layers * 28 - 42;
  ctx.fillStyle = skin.wallD;
  ctx.beginPath(); ctx.moveTo(x - 54, topY + 44); ctx.lineTo(x - 22, topY - 26 - tier * 8); ctx.lineTo(x + 18, topY - 10); ctx.lineTo(x + 54, topY + 44); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, topY + 24, 4, x, topY + 24, 62 + tier * 8);
  g.addColorStop(0, withA([255, 204, 74], 0.55)); g.addColorStop(0.45, withA([255, 70, 18], 0.28)); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, topY + 24, 62 + tier * 8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  for (const side of [-1, 1]) {
    const sx = x + side * (124 + tier * 8);
    ctx.fillStyle = skin.wallD;
    ctx.beginPath(); ctx.moveTo(sx - 16, groundY); ctx.lineTo(sx - 10, groundY - 168 - tier * 12); ctx.lineTo(sx + 18, groundY - 188 - tier * 14); ctx.lineTo(sx + 22, groundY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(210,196,180,0.16)";
    for (let k = 0; k < 3; k++) {
      const ph = (performance.now() / 2600 + k / 3) % 1;
      ctx.beginPath(); ctx.arc(sx + side * ph * 18, groundY - 190 - tier * 14 - ph * 38, 5 + ph * 8, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (lvl >= 7) drawRoyalBiomeBeacon(x, skin);
  if (night) { drawSkinLamp(x - 116, groundY - 48, skin, 0.68); drawSkinLamp(x + 116, groundY - 48, skin, 0.68); }
}

function drawCorruptedNexus(x, lvl, skin, dark, night) {
  const tier = lvl - 4;
  const t = performance.now() / 1000;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = withA([174, 96, 255], 0.2 + 0.04 * Math.sin(t * 2));
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, groundY - 28, 150 + tier * 18, 26 + tier * 3, t * 0.08, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x, groundY - 88, 76 + tier * 8, 18, -t * 0.12, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  const spires = [
    [-118, 126 + tier * 7, 28, -0.08],
    [-48, 188 + tier * 14, 38, 0.04],
    [20, 226 + tier * 18, 46, -0.02],
    [90, 158 + tier * 10, 30, 0.08],
  ];
  for (const [ox, h, w, rot] of spires) {
    ctx.save(); ctx.translate(x + ox, groundY); ctx.rotate(rot);
    ctx.fillStyle = skin.wallD;
    ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w * 0.38, -h * 0.62); ctx.lineTo(0, -h); ctx.lineTo(w * 0.55, -h * 0.54); ctx.lineTo(w, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin.wall;
    ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(0, -h); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    drawRuneGlyph(0, -h * 0.52, 4.5 + tier, skin.accent2);
    ctx.restore();
  }
  ctx.strokeStyle = withA([95, 52, 132], 0.8); ctx.lineWidth = 2.6; ctx.lineCap = "round";
  for (const ox of [-150, -92, 78, 144]) {
    ctx.beginPath(); ctx.moveTo(x + ox, groundY - 2); ctx.quadraticCurveTo(x + ox * 0.68, groundY - 70, x + ox * 0.34, groundY - 116 - tier * 8); ctx.stroke();
  }
  ctx.lineCap = "butt";
  if (lvl >= 6) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const ox of [-92, -20, 54, 124]) {
      const y = groundY - 150 - tier * 6 + Math.sin(t * 2 + ox) * 5;
      ctx.fillStyle = withA([202, 128, 255], 0.58);
      ctx.beginPath(); ctx.moveTo(x + ox, y - 13); ctx.lineTo(x + ox + 8, y); ctx.lineTo(x + ox, y + 13); ctx.lineTo(x + ox - 8, y); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  if (lvl >= 7) drawRoyalBiomeBeacon(x, skin);
  if (night) { drawSkinLamp(x - 130, groundY - 38, skin, 0.7); drawSkinLamp(x + 130, groundY - 38, skin, 0.7); }
}

function drawBiomeStronghold(x, lvl, skin, dark, night) {
  if (skin.id === "frozen") { drawFrozenCitadel(x, lvl, skin, dark, night); return; }
  if (skin.id === "desert") { drawDesertPalace(x, lvl, skin, dark, night); return; }
  if (skin.id === "swamp") { drawSwampGroveFort(x, lvl, skin, dark, night); return; }
  if (skin.id === "volcano") { drawVolcanoForgeCitadel(x, lvl, skin, dark, night); return; }
  if (skin.id === "corrupted") { drawCorruptedNexus(x, lvl, skin, dark, night); return; }

  const tier = Math.max(0, lvl - 4);
  const dims = {
    wallW: 318 + tier * 18,
    wallH: 62 + tier * 5,
    keepW: 98 + tier * 7,
    keepH: 196 + tier * 16,
    towerW: 50 + tier * 2,
    towerH: 158 + tier * 10,
  };

  drawMasonryRect(x, groundY - dims.wallH, dims.wallW, dims.wallH, skin, dark, 2);
  ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.fillRect(x - dims.wallW / 2, groundY - dims.wallH, dims.wallW, 6);
  drawBiomeBattlements(x - dims.wallW / 2 + 54, 92, groundY - dims.wallH, 5, skin, 9);
  drawBiomeBattlements(x + dims.wallW / 2 - 54, 92, groundY - dims.wallH, 5, skin, 9);
  ctx.fillStyle = "rgba(0,0,0,0.48)";
  for (const sx of [-140, -110, 110, 140]) ctx.fillRect(x + sx - 2, groundY - dims.wallH * 0.62, 4, 13);

  if (lvl >= 5) {
    for (const side of [-1, 1]) {
      const bx = x + side * (dims.wallW / 2 - 16);
      drawMasonryRect(bx, groundY - dims.wallH - 34, 34, dims.wallH + 34, skin, dark, 2);
      drawBiomeBattlements(bx, 42, groundY - dims.wallH - 34, 3, skin, 8);
    }
  }

  for (const side of [-1, 1]) {
    const tx = x + side * 112;
    drawMasonryRect(tx, groundY - dims.towerH, dims.towerW, dims.towerH, skin, dark, 2);
    ctx.fillStyle = skin.wallL; ctx.fillRect(tx - dims.towerW / 2 - 5, groundY - dims.towerH - 6, dims.towerW + 10, 7);
    drawBiomeRoof(tx, groundY - dims.towerH - 6, dims.towerW / 2 + 7, skin.roof === "spire" ? 48 : 34, skin);
    drawSkinWindow(tx, groundY - dims.towerH * 0.72, 9, 14, skin, dark);
    drawSkinWindow(tx, groundY - dims.towerH * 0.42, 9, 14, skin, dark);
  }

  const ky = groundY - dims.keepH;
  drawMasonryRect(x, ky, dims.keepW, dims.keepH, skin, dark, 2);
  ctx.fillStyle = skin.wallL;
  ctx.fillRect(x - dims.keepW / 2 - 3, ky + dims.keepH * 0.33, dims.keepW + 6, 4);
  ctx.fillRect(x - dims.keepW / 2 - 3, ky + dims.keepH * 0.62, dims.keepW + 6, 4);
  ctx.fillRect(x - dims.keepW / 2 - 6, ky - 7, dims.keepW + 12, 8);
  drawBiomeBattlements(x, dims.keepW - 16, ky - 7, 5, skin, 10);

  for (const side of [-1, 1]) {
    const ttx = x + side * (dims.keepW / 2 - 2);
    drawMasonryRect(ttx, ky - 30, 18, 30, skin, dark, 1);
    drawBiomeRoof(ttx, ky - 30, 12, skin.roof === "spire" ? 30 : 20, skin);
  }

  if (lvl >= 6) {
    drawMasonryRect(x - 42, ky - 38, 24, 42, skin, dark, 1);
    drawMasonryRect(x + 42, ky - 38, 24, 42, skin, dark, 1);
    drawBiomeRoof(x - 42, ky - 38, 17, 34, skin);
    drawBiomeRoof(x + 42, ky - 38, 17, 34, skin);
  }

  drawBiomePennant(x, ky - 34, skin, skin.banner, 1.1);
  drawSkinWindow(x, ky + dims.keepH * 0.14, 13, 20, skin, dark);
  drawSkinWindow(x - 24, ky + dims.keepH * 0.42, 10, 15, skin, dark);
  drawSkinWindow(x + 24, ky + dims.keepH * 0.42, 10, 15, skin, dark);
  drawBiomeGate(x, groundY, skin, dark);
  drawStrongholdDressing(x, lvl, skin, dark, dims);

  if (night) {
    drawSkinLamp(x - 36, groundY - 26, skin, 0.8);
    drawSkinLamp(x + 36, groundY - 26, skin, 0.8);
    drawSkinLamp(x - 146, groundY - 1, skin, 0.72);
    drawSkinLamp(x + 146, groundY - 1, skin, 0.72);
  }
  if (lvl >= 7) drawRoyalBiomeBeacon(x, skin);
}

export function drawBase(dark) {
  const { base } = state;
  const x=base.x, lvl=base.level;
  if (base.flash>0) base.flash-=0.016;
  if (base.castleUpgradePulse>0) base.castleUpgradePulse-=0.016;
  const flash=base.flash>0&&Math.floor(base.flash*20)%2===0;
  const skin = baseSkinAt(x, flash);
  const night=dark>0.25;
  ctx.save(); groundShadow(x,lvl>=4?122:lvl>=2?88:52,0.3);
  drawBaseGroundSeal(x, lvl, skin, dark);
  if (lvl===1) {
    drawBiomeCamp(x, skin, dark, night);
  } else if (lvl===2 || lvl===3) {
    drawBiomeVillage(x, lvl, skin, dark, night);
  } else {
    drawBiomeStronghold(x, lvl, skin, dark, night);
    drawCastleUpgradeDressing(x,lvl,dark,skin);
  }
  drawHpBar(x,groundY-(lvl>=7?292:lvl>=4?250:lvl>=2?130:70),70,base.hp/base.maxHp,"#f2c14e");
  ctx.restore();
}

const TREB_WOOD = "#6a4a2a", TREB_WOOD_D = "#3f2c18", TREB_IRON = "#8a8a96", TREB_STONE = "#5a5a66", TREB_ROPE = "#cdbfa3";

// Timeline for the throwing arm: -1 = cocked & loaded, snaps to +1 (thrown)
// on release, then winches back down to -1 over a couple of seconds.
function trebuchetArmT(fireT, t) {
  if (!fireT) return -1;
  const since = t - fireT;
  if (since < 0.16) return lerp(-1, 1, 1 - Math.pow(1 - since / 0.16, 3));
  if (since < 2.3) return lerp(1, -1, (since - 0.16) / (2.3 - 0.16));
  return -1;
}

// Warwolf Cradle: a wall-mounted trebuchet — an A-frame cradle with a
// counterweighted throwing arm that snaps forward on release and winches
// back down to reload. footY is passed explicitly (rather than reading the
// module's groundY) so the same model can sit on the battlements in-world
// or spin idly as an animated preview icon in the Castle Council menu.
export function drawTrebuchetModel(cx, footY, side, scale, level, fireT, tNow) {
  const t = tNow ?? performance.now() / 1000;
  const armT = trebuchetArmT(fireT, t);
  const loaded = armT < -0.55;
  const angDeg = lerp(112, -26, (armT + 1) / 2) * side;
  const ang = angDeg * Math.PI / 180;
  const pivotY = -68;
  const longLen = 50 + level * 4, shortLen = 22 + level * 2;
  const dx = Math.sin(ang), dy = -Math.cos(ang);
  const longX = dx * longLen, longY = pivotY + dy * longLen;
  const shortX = -dx * shortLen, shortY = pivotY - dy * shortLen;

  ctx.save();
  ctx.translate(cx, footY);
  ctx.scale(scale, scale);

  ctx.fillStyle = TREB_STONE;
  ctx.beginPath(); ctx.ellipse(0, -2, 40, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.beginPath(); ctx.ellipse(-10, -4, 16, 4, 0, 0, Math.PI * 2); ctx.fill();

  // A-frame legs, front + back for a little depth
  ctx.lineCap = "round";
  ctx.strokeStyle = TREB_WOOD_D; ctx.lineWidth = 9;
  for (const off of [-13, 13]) { ctx.beginPath(); ctx.moveTo(off * 1.9, 0); ctx.lineTo(0, pivotY); ctx.stroke(); }
  ctx.strokeStyle = TREB_WOOD; ctx.lineWidth = 5;
  for (const off of [-13, 13]) { ctx.beginPath(); ctx.moveTo(off * 1.9, 0); ctx.lineTo(0, pivotY); ctx.stroke(); }
  ctx.strokeStyle = TREB_WOOD_D; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-20, -22); ctx.lineTo(20, -22); ctx.stroke();
  if (level >= 2) {
    ctx.strokeStyle = TREB_IRON; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-16, -40); ctx.lineTo(16, -40); ctx.stroke();
  }

  ctx.fillStyle = TREB_IRON;
  ctx.beginPath(); ctx.arc(0, pivotY, 5, 0, Math.PI * 2); ctx.fill();

  // the throwing arm: one rigid beam through the pivot — long sling end,
  // short counterweight end
  ctx.strokeStyle = TREB_WOOD; ctx.lineWidth = 6; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(shortX, shortY); ctx.lineTo(longX, longY); ctx.stroke();
  if (level >= 2) {
    ctx.strokeStyle = TREB_IRON; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(shortX * 0.5, (shortY + pivotY) / 2); ctx.lineTo(longX * 0.5, (longY + pivotY) / 2); ctx.stroke();
  }

  // counterweight box, swaying gently on its hanger
  const cwSwing = Math.sin(t * 1.6) * 0.12;
  ctx.save();
  ctx.translate(shortX, shortY);
  ctx.rotate(cwSwing);
  const cwSize = 12 + level * 2;
  ctx.fillStyle = TREB_WOOD_D;
  roundedRect(-cwSize / 2, 0, cwSize, cwSize + 6, 2); ctx.fill();
  ctx.strokeStyle = TREB_IRON; ctx.lineWidth = 1.5;
  roundedRect(-cwSize / 2, 0, cwSize, cwSize + 6, 2); ctx.stroke();
  ctx.restore();

  // sling + boulder at the long end, only while cocked and freshly loaded
  if (loaded) {
    const sx = longX + dx * 14, sy = longY + dy * 14;
    ctx.strokeStyle = TREB_ROPE; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(longX, longY); ctx.lineTo(sx, sy); ctx.stroke();
    ctx.fillStyle = "#7d7166";
    ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath(); ctx.arc(sx - 2, sy - 2, 3, 0, Math.PI * 2); ctx.fill();
  }

  // level 3: a war pennant flying from the apex of the twin-arm cradle
  if (level >= 3) {
    const sway = windSway(cx, 3);
    ctx.strokeStyle = TREB_ROPE; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, pivotY); ctx.lineTo(0, pivotY - 18); ctx.stroke();
    ctx.fillStyle = "#c1453b";
    ctx.beginPath(); ctx.moveTo(0, pivotY - 18);
    ctx.quadraticCurveTo(9 + sway, pivotY - 16, 15 + sway, pivotY - 12);
    ctx.quadraticCurveTo(9 + sway, pivotY - 8, 0, pivotY - 6); ctx.fill();
  }

  ctx.restore();
}

function drawCastleUpgradeDressing(x, lvl, dark, skin = BASE_BIOME_SKINS.forest) {
  const masonry = castleUpgradeLevel("masonry");
  const garrison = castleUpgradeLevel("garrison");
  const treasury = castleUpgradeLevel("treasury");
  const aegis = castleUpgradeLevel("aegis");
  const pulse = state.base?.castleUpgradePulse || 0;
  const t = performance.now() / 1000;

  if (masonry > 0) {
    const stone = masonry >= 3 ? skin.wallL : skin.wall;
    const hi = masonry >= 3 ? skin.trim : skin.wallL;
    for (const side of [-1, 1]) {
      for (let i = 0; i < masonry; i++) {
        const bx = x + side * (154 - i * 42);
        const h = 58 + i * 18;
        const w = 18 + i * 4;
        ctx.fillStyle = stone;
        ctx.beginPath();
        ctx.moveTo(bx - side * w * 0.35, groundY);
        ctx.lineTo(bx - side * w, groundY - h);
        ctx.lineTo(bx + side * w * 0.55, groundY - h);
        ctx.lineTo(bx + side * w * 0.9, groundY);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.beginPath();
        ctx.moveTo(bx - side * w, groundY - h);
        ctx.lineTo(bx - side * w * 0.55, groundY - h);
        ctx.lineTo(bx - side * w * 0.18, groundY);
        ctx.lineTo(bx - side * w * 0.35, groundY);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.fillStyle = hi;
    ctx.fillRect(x - 178, groundY - 8, 356, 8);
    if (masonry >= 2) {
      ctx.strokeStyle = "#2d3038"; ctx.lineWidth = 2.4;
      for (const y of [groundY - 47, groundY - 29]) {
        ctx.beginPath(); ctx.moveTo(x - 21, y); ctx.lineTo(x + 21, y); ctx.stroke();
      }
    }
    if (masonry >= 3) {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.12 + pulse * 0.2;
      ctx.strokeStyle = skin.trim; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, groundY - 12, 194, 24, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // Murder Holes: a cauldron perched on the outermost buttress each side,
    // tilting to pour boiling oil down onto the gate whenever it triggers.
    const oilAge = state.base?.oilPourT ? t - state.base.oilPourT : 999;
    const oilTilt = oilAge < 0.5 ? (1 - oilAge / 0.5) * 0.6 : 0;
    const oi = masonry - 1;
    for (const side of [-1, 1]) {
      const bx = x + side * (154 - oi * 42);
      const topY = groundY - (58 + oi * 18) - 6;
      ctx.save();
      ctx.translate(bx, topY);
      ctx.rotate(side * oilTilt);
      ctx.fillStyle = "#2d2620";
      ctx.beginPath(); ctx.ellipse(0, 2, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4a3a28";
      ctx.beginPath();
      ctx.moveTo(-9, 0); ctx.quadraticCurveTo(0, 10, 9, 0); ctx.lineTo(7, -8);
      ctx.quadraticCurveTo(0, -4, -7, -8); ctx.closePath(); ctx.fill();
      ctx.restore();
      if (oilAge < 0.5) {
        ctx.save(); ctx.globalAlpha = (1 - oilAge / 0.5) * 0.85;
        ctx.strokeStyle = "#5a3a1e"; ctx.lineWidth = 3; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(bx, topY + 6); ctx.lineTo(bx + side * 10, groundY - 4); ctx.stroke();
        ctx.restore();
      }
    }
  }

  if (garrison > 0) {
    const banner = (bx, by, col) => {
      const sway = windSway(bx, 3);
      ctx.strokeStyle = skin.trim; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - 20); ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(bx, by - 20);
      ctx.quadraticCurveTo(bx + 10 + sway, by - 18, bx + 18 + sway, by - 14);
      ctx.quadraticCurveTo(bx + 10 + sway, by - 10, bx, by - 7); ctx.closePath(); ctx.fill();
    };
    const posts = [-132, 132, -82, 82, -34, 34].slice(0, 2 + garrison * 2);
    for (const off of posts) {
      const py = Math.abs(off) > 100 ? groundY - 178 : groundY - 218;
      banner(x + off, py, garrison >= 3 ? skin.accent : skin.banner);
      ctx.fillStyle = "#202632";
      ctx.fillRect(x + off - 3, py + 2, 6, 12);
      ctx.fillStyle = "#c89468";
      ctx.beginPath(); ctx.arc(x + off, py - 2, 3.3, 0, Math.PI * 2); ctx.fill();
    }
    if (garrison >= 2) {
      ctx.strokeStyle = skin.trim; ctx.lineWidth = 1.4;
      for (const sx of [x - 196, x + 196]) {
        for (let i = 0; i < 3; i++) {
          ctx.beginPath(); ctx.moveTo(sx + i * 5, groundY - 2); ctx.lineTo(sx + i * 5 + 6, groundY - 34); ctx.stroke();
        }
      }
    }

    // War Drums: a drummer beating out a rally rhythm, sending a ring of
    // sound rolling out across the yard whenever the fervor triggers.
    const drumAge = state.base?.drumBeatT ? t - state.base.drumBeatT : 999;
    const dx = x - 60, dy = groundY;
    ctx.fillStyle = "#5a3a1e";
    roundedRect(dx - 9, dy - 22, 18, 16, 3); ctx.fill();
    ctx.strokeStyle = "#2d2018"; ctx.lineWidth = 1.5; ctx.strokeRect(dx - 9, dy - 22, 18, 16);
    ctx.fillStyle = "#e6d8b8";
    ctx.beginPath(); ctx.ellipse(dx, dy - 22, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = skin.wood || "#6a4a2a";
    ctx.beginPath(); ctx.ellipse(dx, dy - 34, 5, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(dx, dy - 46, 4.5, 0, Math.PI * 2); ctx.fill();
    const beat = drumAge < 1.2 ? Math.abs(Math.sin(drumAge * 14)) : Math.abs(Math.sin(t * 1.4)) * 0.3;
    ctx.strokeStyle = skin.wood || "#6a4a2a"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(dx - 4, dy - 38); ctx.lineTo(dx - 7, dy - 24 - beat * 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dx + 4, dy - 38); ctx.lineTo(dx + 7, dy - 24 - beat * 8); ctx.stroke();
    if (drumAge < 1.4) {
      const dk = clamp(drumAge / 1.4, 0, 1);
      ctx.save(); ctx.globalAlpha = (1 - dk) * 0.4;
      ctx.strokeStyle = "#9bd05a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(dx, dy - 10, 20 + dk * 90, 7 + dk * 20, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  if (treasury > 0) {
    ctx.fillStyle = treasury >= 3 ? skin.accent2 : skin.accent;
    const trimY = groundY - 69;
    ctx.fillRect(x - 26, trimY, 52, 3);
    ctx.fillRect(x - 24, groundY - 5, 48, 3);
    for (let i = 0; i < treasury; i++) {
      const cx = x - 72 + i * 72;
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.35 + 0.08 * Math.sin(t * 2 + i);
      ctx.fillStyle = skin.accent2;
      ctx.beginPath(); ctx.arc(cx, groundY - 82, 7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = skin.accent2;
      ctx.beginPath(); ctx.arc(cx, groundY - 82, 3.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#5a3a20";
      ctx.beginPath(); ctx.arc(cx, groundY - 82, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    if (treasury >= 2) {
      for (const sx of [x - 128, x + 128]) {
        ctx.fillStyle = "#5a3a20"; roundedRect(sx - 16, groundY - 18, 32, 18, 3); ctx.fill();
        ctx.fillStyle = "#8a5a24"; ctx.fillRect(sx - 16, groundY - 18, 32, 5);
        ctx.fillStyle = skin.accent2; ctx.fillRect(sx - 2, groundY - 14, 4, 9);
      }
    }

    // Greedwyrm's Hoard: a coiled coin-wyrm perched over the vault, spitting
    // a mouthful of coin whenever the hoard can't help but overflow.
    const hoardAge = state.base?.hoardBurstT ? t - state.base.hoardBurstT : 999;
    const wx = x, wy = groundY - 96, wobble = Math.sin(t * 1.8) * 2;
    ctx.strokeStyle = skin.accent2; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(wx - 14, wy + 8 + wobble);
    ctx.quadraticCurveTo(wx - 6, wy - 4 + wobble, wx + 2, wy + 2 + wobble);
    ctx.quadraticCurveTo(wx + 10, wy + 8 + wobble, wx + 6, wy - 2 + wobble);
    ctx.stroke();
    ctx.fillStyle = skin.accent2;
    ctx.beginPath(); ctx.arc(wx + 6, wy - 4 + wobble, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1a1310";
    ctx.beginPath(); ctx.arc(wx + 8, wy - 5 + wobble, 1.3, 0, Math.PI * 2); ctx.fill();
    if (hoardAge < 0.4) {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 1 - hoardAge / 0.4;
      ctx.fillStyle = "#fff4c8";
      ctx.beginPath(); ctx.arc(wx + 10, wy - 2 + wobble, 4 + hoardAge * 10, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (hoardAge < 0.7) {
      const hk = hoardAge / 0.7;
      for (let i = 0; i < 3; i++) {
        const kk = clamp(hk - i * 0.08, 0, 1);
        if (kk <= 0) continue;
        ctx.fillStyle = "#f2c14e";
        ctx.beginPath(); ctx.arc(wx + 10 + i * 6, wy - 2 + wobble - Math.sin(kk * Math.PI) * 26, 2.4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  if (aegis > 0) {
    const fy = groundY - (lvl >= 7 ? 266 : 238) + Math.sin(t * 2.1) * 2;
    const flare = state.base?.aegisFlashUntil ? Math.max(0, Math.min(1, (state.base.aegisFlashUntil - t) / 0.35)) : 0;
    const r = 18 + aegis * 5 + flare * 16 + pulse * 8;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(x, fy, 2, x, fy, r * 2.1);
    g.addColorStop(0, withA(skin.window, 0.75));
    g.addColorStop(0.45, withA(skin.window, 0.28));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, fy, r * 2.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = skin.accent; ctx.lineWidth = 1.5 + aegis * 0.4;
    ctx.beginPath(); ctx.ellipse(x, fy, r, r * 0.32, t * 0.35, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, fy, r * 0.72, r * 0.24, -t * 0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = skin.accent2;
    ctx.beginPath();
    ctx.moveTo(x, fy - 8 - aegis * 2);
    ctx.lineTo(x + 6 + aegis, fy);
    ctx.lineTo(x, fy + 8 + aegis * 2);
    ctx.lineTo(x - 6 - aegis, fy);
    ctx.closePath(); ctx.fill();
    if (aegis >= 2) {
      ctx.strokeStyle = withA(skin.window, 0.75); ctx.lineWidth = 1.4;
      for (const off of [-52, 52]) {
        ctx.beginPath(); ctx.moveTo(x, fy + 10); ctx.quadraticCurveTo(x + off * 0.45, fy + 44, x + off, groundY - 204); ctx.stroke();
      }
    }
  }

  const siege = castleUpgradeLevel("siege");
  if (siege > 0) {
    const fireT = state.base?.trebuchetFireT;
    if (siege >= 3) {
      groundShadow(x - 235, 46, 0.28); groundShadow(x + 235, 46, 0.28);
      drawTrebuchetModel(x - 235, groundY, -1, 0.7, siege, fireT, t);
      drawTrebuchetModel(x + 235, groundY, 1, 0.7, siege, fireT, t);
    } else {
      const side = state.base?.trebuchetSide || 1;
      groundShadow(x + side * 235, 46, 0.28);
      drawTrebuchetModel(x + side * 235, groundY, side, 0.7, siege, fireT, t);
    }
  }
}

function drawStationIcon(x, emoji) {
  const bob=Math.sin(performance.now()/400+x)*3;
  ctx.save(); ctx.font="18px serif"; ctx.textAlign="center"; ctx.globalAlpha=0.92;
  ctx.fillText(emoji,x,groundY-30+bob);
  ctx.restore();
}

function drawBoothPerson(x, skin, robe, robeD) {
  const y=groundY-6;
  ctx.save();
  ctx.fillStyle=robeD; ctx.fillRect(x-6,y-22,12,22);
  ctx.fillStyle=robe; ctx.fillRect(x-6,y-22,7,22);
  ctx.fillStyle=skin; ctx.fillRect(x-7,y-18,3.5,8); ctx.fillRect(x+3.5,y-18,3.5,8);
  ctx.beginPath(); ctx.arc(x,y-27,5,0,Math.PI*2); ctx.fillStyle=skin; ctx.fill();
  ctx.fillStyle=robeD; ctx.beginPath(); ctx.arc(x,y-28.4,5.3,Math.PI,0); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.arc(x+1.6,y-26,3.7,-0.4,2.6); ctx.fill();
  ctx.restore();
}

// Gold guild emblem painted on banner cloth: a bow or a smith's hammer.
function drawStallEmblem(ex, ey, emblem) {
  ctx.save(); ctx.translate(ex,ey); ctx.strokeStyle="#f2c14e"; ctx.fillStyle="#f2c14e"; ctx.lineWidth=1.5;
  if (emblem==="bow") {
    ctx.beginPath(); ctx.arc(0,0,4.5,Math.PI*0.6,Math.PI*1.4,true); ctx.stroke();
    ctx.lineWidth=0.9; ctx.beginPath(); ctx.moveTo(-1.5,-4); ctx.lineTo(-1.5,4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-1.5,0); ctx.lineTo(5,0); ctx.stroke();
  } else if (emblem==="hammer") {
    ctx.beginPath(); ctx.moveTo(-1,4.5); ctx.lineTo(1,4.5); ctx.lineTo(1,-2); ctx.lineTo(-1,-2); ctx.closePath(); ctx.fill();
    ctx.fillRect(-4.5,-5,9,3.6);
  } else if (emblem==="cleric") {
    ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,-3.5); ctx.lineTo(0,3.5); ctx.moveTo(-3.5,0); ctx.lineTo(3.5,0); ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(0,-6); ctx.lineTo(6,-3); ctx.lineTo(5,3);
    ctx.quadraticCurveTo(3,7,0,8);
    ctx.quadraticCurveTo(-3,7,-5,3);
    ctx.lineTo(-6,-3); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,-4); ctx.lineTo(0,5); ctx.stroke();
  }
  ctx.restore();
}

// Market stall that grows with the base: a rough plank hut at lvl 1, a
// striped wooden booth at lvl 2-3, and at lvl 4 a stone annex matching the
// castle masonry with crenellations, lit window and a cloth guild banner.
function drawBiomeWallStall(x, canopy, canopyD, emblem, skin) {
  const lvl = state.base ? state.base.level : 1;
  const built = lvl >= 4;
  const w = built ? 74 : lvl >= 2 ? 66 : 58;
  const h = built ? 62 : lvl >= 2 ? 52 : 44;
  const top = groundY - h;
  groundShadow(x, built ? 42 : 34, 0.22);

  if (skin.id === "frozen") {
    ctx.fillStyle = skin.wallD; roundedRect(x - w / 2, top + 8, w, h - 8, 4); ctx.fill();
    ctx.fillStyle = withA([235, 250, 255], 0.72);
    ctx.beginPath(); ctx.moveTo(x - w / 2 - 8, top + 10); ctx.lineTo(x - w * 0.22, top - 18); ctx.lineTo(x + w * 0.18, top - 7); ctx.lineTo(x + w / 2 + 8, top + 10); ctx.closePath(); ctx.fill();
    for (const ox of [-w * 0.38, w * 0.34]) {
      ctx.fillStyle = withA([220,248,255], 0.85);
      ctx.beginPath(); ctx.moveTo(x + ox - 5, groundY); ctx.lineTo(x + ox, top + 2); ctx.lineTo(x + ox + 6, groundY); ctx.closePath(); ctx.fill();
    }
  } else if (skin.id === "desert") {
    ctx.fillStyle = skin.wall; roundedRect(x - w / 2, top + 12, w, h - 12, 5); ctx.fill();
    ctx.fillStyle = canopyD;
    ctx.beginPath(); ctx.moveTo(x - w / 2 - 10, top + 14); ctx.quadraticCurveTo(x, top - 30, x + w / 2 + 10, top + 14); ctx.lineTo(x + w / 2 + 4, top + 22); ctx.quadraticCurveTo(x, top + 4, x - w / 2 - 4, top + 22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = canopy;
    ctx.beginPath(); ctx.moveTo(x - 10, top - 11); ctx.quadraticCurveTo(x, top - 29, x + 12, top - 10); ctx.lineTo(x + 3, top + 15); ctx.lineTo(x - 5, top + 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin.accent2; ctx.fillRect(x - w / 2 - 4, top + 20, w + 8, 3);
  } else if (skin.id === "swamp") {
    ctx.strokeStyle = skin.wood; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x - w * 0.38, groundY); ctx.lineTo(x - w * 0.28, top + 13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w * 0.38, groundY); ctx.lineTo(x + w * 0.26, top + 13); ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = skin.wood; ctx.fillRect(x - w / 2, top + 20, w, 7);
    ctx.fillStyle = skin.wall; roundedRect(x - w * 0.38, top + 2, w * 0.76, 24, 3); ctx.fill();
    ctx.fillStyle = skin.roofC;
    ctx.beginPath(); ctx.moveTo(x - w / 2 - 8, top + 2); ctx.quadraticCurveTo(x, top - 21, x + w / 2 + 8, top + 2); ctx.lineTo(x + w / 2 + 2, top + 12); ctx.quadraticCurveTo(x, top + 6, x - w / 2 - 2, top + 12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = skin.accent; ctx.lineWidth = 1.2;
    for (const ox of [-22, 0, 20]) { ctx.beginPath(); ctx.moveTo(x + ox, top + 8); ctx.quadraticCurveTo(x + ox + windSway(ox, 3), top + 28, x + ox - 2, groundY - 4); ctx.stroke(); }
  } else if (skin.id === "volcano") {
    ctx.fillStyle = skin.wallD;
    ctx.beginPath(); ctx.moveTo(x - w / 2, groundY); ctx.lineTo(x - w * 0.44, top + 12); ctx.lineTo(x - w * 0.08, top - 16); ctx.lineTo(x + w * 0.42, top + 10); ctx.lineTo(x + w / 2, groundY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin.wall; ctx.beginPath(); ctx.moveTo(x - w * 0.44, top + 12); ctx.lineTo(x - w * 0.08, top - 16); ctx.lineTo(x, groundY); ctx.lineTo(x - w / 2, groundY); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = withA([255, 94, 24], 0.52); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x - 20, top + 12); ctx.lineTo(x - 4, top + 34); ctx.lineTo(x + 22, top + 20); ctx.stroke();
    ctx.restore();
  } else if (skin.id === "corrupted") {
    ctx.fillStyle = skin.wallD;
    ctx.beginPath(); ctx.moveTo(x - w / 2, groundY); ctx.lineTo(x - w * 0.36, top + 8); ctx.lineTo(x - 2, top - 24); ctx.lineTo(x + w * 0.38, top + 10); ctx.lineTo(x + w / 2, groundY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin.wall; ctx.beginPath(); ctx.moveTo(x - w * 0.36, top + 8); ctx.lineTo(x - 2, top - 24); ctx.lineTo(x + 3, groundY); ctx.lineTo(x - w / 2, groundY); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    drawRuneGlyph(x + 3, top + 20, 4.6, skin.accent2);
    ctx.restore();
  } else {
    ctx.strokeStyle = skin.wood; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x - w / 2 + 7, groundY); ctx.lineTo(x - w / 2 + 5, top + 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w / 2 - 7, groundY); ctx.lineTo(x + w / 2 - 5, top + 10); ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = built ? skin.wallD : skin.wood; roundedRect(x - w / 2, top + 12, w, h - 12, 3); ctx.fill();
    drawBiomeRoof(x, top + 12, w * 0.56, built ? 32 : 24, skin);
  }

  const sway = windSway(x, 2) * 0.4;
  ctx.fillStyle = canopyD;
  ctx.beginPath(); ctx.moveTo(x - 9, top + 12); ctx.lineTo(x + 9, top + 12); ctx.lineTo(x + 8 + sway, top + 40); ctx.lineTo(x + sway, top + 46); ctx.lineTo(x - 8 + sway, top + 40); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = skin.accent2; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x - 9, top + 14); ctx.lineTo(x + 9, top + 14); ctx.stroke();
  drawStallEmblem(x + sway * 0.6, top + 29, emblem);
  if (Game.isNight) drawSkinLamp(x + w / 2 - 5, top + 32, skin, 0.55);
}

function drawWallStall(x, canopy, canopyD, emblem) {
  drawBiomeWallStall(x, canopy, canopyD, emblem, baseSkinAt(CFG.baseX, false));
}

function drawBoothCounter(x) {
  ctx.save();
  const woodL="#8a6338", woodD="#5f4326";
  ctx.fillStyle=woodD; ctx.fillRect(x-21,groundY-18,42,18);
  ctx.fillStyle=woodL; ctx.fillRect(x-21,groundY-18,42,5);
  ctx.strokeStyle="rgba(0,0,0,0.22)"; ctx.lineWidth=1;
  for (let i=-2;i<=2;i++) { ctx.beginPath(); ctx.moveTo(x+i*7.5,groundY-13); ctx.lineTo(x+i*7.5,groundY); ctx.stroke(); }
  ctx.restore();
}

function drawBowStation(x) {
  drawWallStall(x,"#8a3a34","#5f2622","bow");
  drawBoothPerson(x-5,"#d8a878","#3a5a44","#264030");
  drawBoothCounter(x);
  // bows on display
  ctx.save();
  ctx.translate(x+9,groundY-18);
  for (let i=0;i<2;i++) {
    const bx=i*6-3, ang=(i-0.5)*0.5;
    ctx.save(); ctx.translate(bx,-2); ctx.rotate(ang);
    ctx.strokeStyle="#6a4222"; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.arc(0,0,6.5,Math.PI*0.5,Math.PI*1.5); ctx.stroke();
    ctx.strokeStyle="rgba(230,220,200,0.8)"; ctx.lineWidth=0.6;
    ctx.beginPath(); ctx.moveTo(0,-6.5); ctx.lineTo(0,6.5); ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle="#7a5a30"; ctx.lineWidth=1;
  for (let i=0;i<3;i++) { ctx.beginPath(); ctx.moveTo(-9+i*2,-1); ctx.lineTo(-3+i*2,-6); ctx.stroke(); }
  ctx.fillStyle="#c0392b";
  for (let i=0;i<3;i++) { ctx.beginPath(); ctx.moveTo(-3+i*2,-6); ctx.lineTo(-4.4+i*2,-7.4); ctx.lineTo(-1.6+i*2,-7.4); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  // quiver barrel bristling with arrows beside the counter
  const qx=x-32;
  ctx.fillStyle="#6a4a2a"; ctx.beginPath(); ctx.ellipse(qx,groundY-6,5.5,7,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="#3c3c46"; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.ellipse(qx,groundY-9,5.2,2.2,0,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle="#8a6a3a"; ctx.lineWidth=1;
  for (let i=-2;i<=2;i++) { ctx.beginPath(); ctx.moveTo(qx+i*1.6,groundY-11); ctx.lineTo(qx+i*2.6,groundY-22-Math.abs(i)); ctx.stroke(); }
  ctx.fillStyle="#c9b898";
  for (let i=-2;i<=2;i++) { ctx.beginPath(); ctx.arc(qx+i*2.6,groundY-22.5-Math.abs(i),1.2,0,Math.PI*2); ctx.fill(); }
}

function drawHammerStation(x) {
  drawWallStall(x,"#39547a","#243954","hammer");
  drawBoothPerson(x-5,"#c89468","#6a5030","#463420");
  drawBoothCounter(x);
  // anvil on a stump beside the counter
  const ax=x+34;
  ctx.fillStyle="#5a4228"; ctx.fillRect(ax-5,groundY-8,10,8);
  ctx.fillStyle="#4e4e5a"; ctx.fillRect(ax-7,groundY-13,14,5);
  ctx.beginPath(); ctx.moveTo(ax+7,groundY-13); ctx.lineTo(ax+11,groundY-11.5); ctx.lineTo(ax+7,groundY-9.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,0.18)"; ctx.fillRect(ax-7,groundY-13,14,1.5);
  ctx.save();
  ctx.translate(x+9,groundY-18);
  ctx.strokeStyle="#5a4028"; ctx.lineWidth=2.2; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(-6,-1); ctx.lineTo(1,-11); ctx.stroke();
  ctx.fillStyle="#7a7a82"; ctx.save(); ctx.translate(1,-11); ctx.rotate(-0.5);
  ctx.fillRect(-5,-3.5,10,7); ctx.fillStyle="rgba(255,255,255,0.15)"; ctx.fillRect(-5,-3.5,10,2);
  ctx.restore();
  ctx.strokeStyle="#5a4028"; ctx.lineWidth=1.8;
  ctx.beginPath(); ctx.moveTo(4,-0.5); ctx.lineTo(10,-9); ctx.stroke();
  ctx.fillStyle="#8a8a92"; ctx.beginPath(); ctx.arc(10,-9,2.2,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#9a6a3a"; ctx.beginPath(); ctx.ellipse(-9,-1,4,2.1,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#c0392b"; ctx.fillRect(-11,-9,3.5,8.5);
  ctx.fillStyle="rgba(255,255,255,0.15)"; ctx.fillRect(-11,-9,1.4,8.5);
  ctx.lineCap="butt";
  ctx.restore();
}

function drawGuardStation(x) {
  const t=performance.now()/1000, fl=(FX&&FX.flicker)||1;
  drawWallStall(x,"#7a2830","#4a1f2a","shield");
  drawBoothPerson(x-8,"#c89468","#31465f","#223145");
  drawBoothCounter(x);

  // shield and helm laid out like real stock, so the station reads as a guard post.
  ctx.save();
  ctx.translate(x+10,groundY-19);
  ctx.fillStyle="#4e5f78";
  ctx.beginPath();
  ctx.moveTo(0,-9); ctx.lineTo(10,-5); ctx.lineTo(8,4);
  ctx.quadraticCurveTo(5,11,0,13);
  ctx.quadraticCurveTo(-5,11,-8,4);
  ctx.lineTo(-10,-5); ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,0.14)";
  ctx.beginPath(); ctx.moveTo(-7,-4); ctx.lineTo(0,-7); ctx.lineTo(0,10); ctx.quadraticCurveTo(-4,8,-6,3); ctx.closePath(); ctx.fill();
  ctx.strokeStyle="#c9b898"; ctx.lineWidth=1.3;
  ctx.beginPath(); ctx.moveTo(0,-7); ctx.lineTo(0,10); ctx.stroke();
  ctx.fillStyle="#9a9aaa";
  ctx.beginPath(); ctx.arc(-16,-1,6,Math.PI,0); ctx.lineTo(-10,4); ctx.lineTo(-22,4); ctx.closePath(); ctx.fill();
  ctx.fillStyle="#6a6a76"; ctx.fillRect(-20,2,8,3);
  ctx.restore();

  // spear rack on one side, training dummy on the other.
  const rackX=x-34;
  ctx.strokeStyle="#5a4028"; ctx.lineWidth=2.2; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(rackX-8,groundY); ctx.lineTo(rackX+8,groundY-22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(rackX+8,groundY); ctx.lineTo(rackX-8,groundY-22); ctx.stroke();
  ctx.lineWidth=1.8;
  for (let i=0;i<3;i++) {
    const sx=rackX-6+i*6;
    ctx.beginPath(); ctx.moveTo(sx,groundY-3); ctx.lineTo(sx+2,groundY-34-i*2); ctx.stroke();
    ctx.fillStyle="#b8bcc4";
    ctx.beginPath(); ctx.moveTo(sx+2,groundY-39-i*2); ctx.lineTo(sx-1,groundY-33-i*2); ctx.lineTo(sx+5,groundY-34-i*2); ctx.closePath(); ctx.fill();
  }
  ctx.lineCap="butt";

  const dX=x+38;
  ctx.fillStyle="#5a3a24"; ctx.fillRect(dX-3,groundY-31,6,31);
  ctx.fillStyle="#7a5030"; ctx.beginPath(); ctx.arc(dX,groundY-37,7,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#6a4428"; ctx.fillRect(dX-11,groundY-31,22,16);
  ctx.strokeStyle="#4a2e1e"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(dX-10,groundY-23); ctx.lineTo(dX+10,groundY-23); ctx.stroke();
  ctx.fillStyle="#c1453b"; ctx.fillRect(dX-8,groundY-30,16,3);

  if (Game.isNight) {
    const bx=x+29, by=groundY-18;
    ctx.fillStyle="#3a3a44";
    ctx.beginPath(); ctx.arc(bx,by,5,0,Math.PI,false); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation="lighter";
    const rg=ctx.createRadialGradient(bx,by-4,1,bx,by-4,22*fl);
    rg.addColorStop(0,"rgba(255,190,90,0.45)"); rg.addColorStop(1,"rgba(255,100,30,0)");
    ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(bx,by-4,22*fl,0,Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.fillStyle="rgba(255,160,60,0.95)";
    ctx.beginPath(); ctx.ellipse(bx,by-5,2.5,5*fl,0,0,Math.PI*2); ctx.fill();
  }
}

function drawShopGoods(x, skin) {
  ctx.fillStyle = skin.gate; ctx.fillRect(x - 28, groundY - 17, 56, 17);
  ctx.fillStyle = skin.wood; ctx.fillRect(x - 28, groundY - 17, 56, 4);
  ctx.strokeStyle = "rgba(0,0,0,0.24)"; ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + i * 9, groundY - 13); ctx.lineTo(x + i * 9, groundY); ctx.stroke(); }
  ctx.fillStyle = skin.id === "frozen" ? "#dff7ff" : skin.id === "volcano" ? "#ff6a24" : skin.id === "corrupted" ? "#b66bff" : "#c0392b";
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x - 18 + i * 5, groundY - 19, 2.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = skin.accent2; ctx.beginPath(); ctx.moveTo(x - 3, groundY - 16.5); ctx.lineTo(x + 8, groundY - 16.5); ctx.lineTo(x + 8, groundY - 22); ctx.closePath(); ctx.fill();
  ctx.fillStyle = skin.id === "swamp" ? "#8fb35a" : "#3a6a4a"; ctx.fillRect(x + 13, groundY - 25, 4, 9); ctx.fillRect(x + 14, groundY - 27.5, 2, 3);
  ctx.fillStyle = skin.accent2;
  for (let i = 0; i < 3; i++) ctx.fillRect(x + 21, groundY - 18.5 - i * 2.6, 6, 2);
  drawBoothPerson(x - 8, "#d8a878", skin.banner, skin.gate);
}

function drawShopSign(x, y, skin) {
  const swy = Math.sin(performance.now() / 620 + x) * 0.07;
  ctx.save(); ctx.translate(x, y); ctx.rotate(swy);
  ctx.strokeStyle = skin.trim; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-5, 6); ctx.moveTo(5, 0); ctx.lineTo(5, 6); ctx.stroke();
  ctx.fillStyle = skin.wallD; roundedRect(-11, 6, 22, 16, 2.4); ctx.fill();
  ctx.strokeStyle = skin.accent2; ctx.lineWidth = 1; roundedRect(-8, 8, 16, 12, 1.8); ctx.stroke();
  ctx.fillStyle = skin.accent2; ctx.beginPath(); ctx.arc(0, 14, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = skin.wallD; ctx.beginPath(); ctx.arc(0, 14, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawShopCrates(x, skin) {
  const brX = x + 52;
  ctx.fillStyle = skin.wood; ctx.beginPath(); ctx.ellipse(brX, groundY - 9, 7, 9.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = skin.line; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.ellipse(brX, groundY - 13, 6.6, 3, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(brX, groundY - 5, 6.9, 3, 0, 0, Math.PI * 2); ctx.stroke();
  const crX = x - 54;
  ctx.fillStyle = skin.id === "frozen" ? skin.wall : skin.wood; ctx.fillRect(crX - 8, groundY - 11, 16, 11);
  ctx.strokeStyle = skin.line; ctx.lineWidth = 1.4; ctx.strokeRect(crX - 8, groundY - 11, 16, 11);
  ctx.beginPath(); ctx.moveTo(crX - 8, groundY - 11); ctx.lineTo(crX + 8, groundY); ctx.moveTo(crX + 8, groundY - 11); ctx.lineTo(crX - 8, groundY); ctx.stroke();
}

function drawBiomeShopBuilding(x, skin) {
  const t = performance.now() / 1000;
  const fl = (FX && FX.flicker) || 1;
  groundShadow(x, 58, 0.26);

  if (skin.id === "frozen") {
    const bw = 92, by = groundY - 48;
    ctx.fillStyle = skin.wallD; roundedRect(x - bw / 2, by + 8, bw, 40, 6); ctx.fill();
    ctx.fillStyle = withA([235, 250, 255], 0.76);
    ctx.beginPath(); ctx.moveTo(x - bw / 2 - 10, by + 10); ctx.lineTo(x - 20, by - 28); ctx.lineTo(x + 8, by - 16); ctx.lineTo(x + bw / 2 + 10, by + 10); ctx.closePath(); ctx.fill();
    drawSkinWindow(x + 5, by + 16, 12, 12, skin, 0.7);
    drawShopSign(x - 50, by + 10, skin);
  } else if (skin.id === "desert") {
    const bw = 104, by = groundY - 54;
    ctx.fillStyle = skin.wall; roundedRect(x - bw / 2, by + 10, bw, 44, 7); ctx.fill();
    for (const ox of [-38, 38]) { ctx.fillStyle = skin.wallL; roundedRect(x + ox - 5, by + 13, 10, 41, 4); ctx.fill(); }
    ctx.fillStyle = skin.banner;
    ctx.beginPath(); ctx.moveTo(x - bw / 2 - 12, by + 12); ctx.quadraticCurveTo(x, by - 42, x + bw / 2 + 12, by + 12); ctx.lineTo(x + bw / 2 + 4, by + 24); ctx.quadraticCurveTo(x, by + 5, x - bw / 2 - 4, by + 24); ctx.closePath(); ctx.fill();
    drawBiomeRoof(x, by + 2, 34, 34, skin);
    drawShopSign(x - 58, by + 18, skin);
  } else if (skin.id === "swamp") {
    const deckY = groundY - 28, bw = 98;
    ctx.strokeStyle = skin.wood; ctx.lineWidth = 4; ctx.lineCap = "round";
    for (const ox of [-42, 0, 42]) { ctx.beginPath(); ctx.moveTo(x + ox, groundY); ctx.lineTo(x + ox + windSway(ox, 2), deckY); ctx.stroke(); }
    ctx.lineCap = "butt";
    ctx.fillStyle = skin.wood; ctx.fillRect(x - bw / 2, deckY, bw, 7);
    ctx.fillStyle = skin.wall; roundedRect(x - 40, deckY - 42, 80, 42, 4); ctx.fill();
    drawBiomeRoof(x, deckY - 42, 54, 28, skin);
    ctx.strokeStyle = skin.accent; ctx.lineWidth = 1.2;
    for (const ox of [-34, -4, 28]) { ctx.beginPath(); ctx.moveTo(x + ox, deckY - 38); ctx.quadraticCurveTo(x + ox + windSway(ox, 4), deckY - 12, x + ox - 2, groundY - 5); ctx.stroke(); }
    drawShopSign(x - 50, deckY - 34, skin);
  } else if (skin.id === "volcano") {
    const bw = 96, by = groundY - 58;
    ctx.fillStyle = skin.wallD;
    ctx.beginPath(); ctx.moveTo(x - bw / 2, groundY); ctx.lineTo(x - 42, by + 8); ctx.lineTo(x - 8, by - 26); ctx.lineTo(x + 44, by + 6); ctx.lineTo(x + bw / 2, groundY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin.wall; ctx.beginPath(); ctx.moveTo(x - 42, by + 8); ctx.lineTo(x - 8, by - 26); ctx.lineTo(x + 4, groundY); ctx.lineTo(x - bw / 2, groundY); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = withA([255, 94, 24], 0.58); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 28, by + 15); ctx.lineTo(x - 2, by + 38); ctx.lineTo(x + 30, by + 18); ctx.stroke();
    ctx.restore();
    drawShopSign(x - 52, by + 18, skin);
  } else if (skin.id === "corrupted") {
    const bw = 92, by = groundY - 62;
    ctx.fillStyle = skin.wallD;
    ctx.beginPath(); ctx.moveTo(x - bw / 2, groundY); ctx.lineTo(x - 35, by + 8); ctx.lineTo(x - 2, by - 34); ctx.lineTo(x + 38, by + 12); ctx.lineTo(x + bw / 2, groundY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin.wall; ctx.beginPath(); ctx.moveTo(x - 35, by + 8); ctx.lineTo(x - 2, by - 34); ctx.lineTo(x + 3, groundY); ctx.lineTo(x - bw / 2, groundY); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = withA([190, 112, 255], 0.32 + Math.sin(t * 2) * 0.06); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x + 5, by + 28, 40, 10, t * 0.2, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    drawShopSign(x - 52, by + 14, skin);
  } else {
    const bw = 94, by = groundY - 50;
    ctx.fillStyle = skin.wood; roundedRect(x - bw / 2, by + 12, bw, 38, 4); ctx.fill();
    ctx.fillStyle = skin.wallD; roundedRect(x - bw / 2 + 9, by + 18, bw - 18, 32, 3); ctx.fill();
    drawBiomeRoof(x, by + 14, bw * 0.62, 34, skin);
    ctx.strokeStyle = withA([112, 170, 82], 0.7); ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x - 45, groundY); ctx.quadraticCurveTo(x - 34, by - 4, x - 6, by - 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 46, groundY); ctx.quadraticCurveTo(x + 38, by, x + 8, by - 22); ctx.stroke();
    ctx.lineCap = "butt";
    drawShopSign(x - 54, by + 16, skin);
  }

  drawShopGoods(x, skin);
  drawShopCrates(x, skin);
  if (Game.isNight) drawSkinLamp(x + 43, groundY - 33, skin, 0.72 * fl);
}

function drawShopBuilding(x) {
  drawBiomeShopBuilding(x, baseSkinAt(CFG.baseX, false));
}

const FARM_BIOME_SKINS = {
  forest: {
    id: "forest", wall: "#5a5260", wallD: "#403a48", wallL: "#766f7a", roofC: "#25406a", roofD: "#162b48",
    wood: "#5a3a1e", trim: "#cdbfa3", accent: "#9bd05a", accent2: "#f2c14e", banner: "#c1453b", gate: "#4e3820",
    lamp: [255, 186, 86],
  },
  frozen: {
    id: "frozen", wall: "#a9c7d8", wallD: "#4c7086", wallL: "#e8f8ff", roofC: "#dff7ff", roofD: "#7bb8d8",
    wood: "#6c7d88", trim: "#f5fdff", accent: "#82dfff", accent2: "#ffffff", banner: "#65bde8", gate: "#466978",
    lamp: [170, 235, 255],
  },
  desert: {
    id: "desert", wall: "#b9874f", wallD: "#6e4a28", wallL: "#edc982", roofC: "#d8a85c", roofD: "#8e5d2e",
    wood: "#6a3f1d", trim: "#ffe0a0", accent: "#f1b24f", accent2: "#ffd27a", banner: "#b95f34", gate: "#5a3218",
    lamp: [255, 216, 128],
  },
  swamp: {
    id: "swamp", wall: "#314638", wallD: "#17231e", wallL: "#6f8b55", roofC: "#61713f", roofD: "#2a3a2a",
    wood: "#4d3821", trim: "#93a960", accent: "#9bd85a", accent2: "#d6f08a", banner: "#4f8d62", gate: "#2e2418",
    lamp: [190, 246, 104],
  },
  volcano: {
    id: "volcano", wall: "#2f2b29", wallD: "#151313", wallL: "#6f4030", roofC: "#171317", roofD: "#080608",
    wood: "#4a2417", trim: "#aa5940", accent: "#ff6a24", accent2: "#ffb13d", banner: "#c74224", gate: "#28110c",
    lamp: [255, 106, 32],
  },
  corrupted: {
    id: "corrupted", wall: "#322244", wallD: "#171020", wallL: "#6c4aa0", roofC: "#241236", roofD: "#09040f",
    wood: "#3a2138", trim: "#a56bff", accent: "#b66bff", accent2: "#dca8ff", banner: "#7f4dbe", gate: "#130817",
    lamp: [210, 142, 255],
  },
};

function farmSkinAt(x) {
  return FARM_BIOME_SKINS[biomeAt(x)?.id] || FARM_BIOME_SKINS.forest;
}

function drawFarmRoof(x, y, skin) {
  ctx.fillStyle = skin.roofD;
  if (skin.id === "desert") {
    ctx.beginPath(); ctx.arc(x, y + 2, 25, Math.PI, 0); ctx.lineTo(x + 25, y + 5); ctx.lineTo(x - 25, y + 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin.roofC;
    ctx.beginPath(); ctx.arc(x - 2, y + 1, 21, Math.PI, 0); ctx.lineTo(x + 19, y + 4); ctx.lineTo(x - 23, y + 4); ctx.closePath(); ctx.fill();
  } else if (skin.id === "corrupted" || skin.id === "volcano") {
    ctx.beginPath(); ctx.moveTo(x - 28, y + 5); ctx.lineTo(x - 7, y - 13); ctx.lineTo(x, y - 28); ctx.lineTo(x + 10, y - 11); ctx.lineTo(x + 28, y + 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin.roofC;
    ctx.beginPath(); ctx.moveTo(x - 25, y + 2); ctx.lineTo(x, y - 24); ctx.lineTo(x + 5, y + 2); ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(x - 29, y + 5); ctx.lineTo(x, y - 24); ctx.lineTo(x + 29, y + 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin.roofC;
    ctx.beginPath(); ctx.moveTo(x - 25, y + 2); ctx.lineTo(x, y - 20); ctx.lineTo(x + 4, y + 2); ctx.closePath(); ctx.fill();
    if (skin.id === "frozen") {
      ctx.fillStyle = skin.trim;
      ctx.beginPath(); ctx.moveTo(x - 29, y + 5); ctx.lineTo(x, y - 24); ctx.lineTo(x - 4, y + 5); ctx.closePath(); ctx.fill();
    }
  }
}

function drawFarmLamp(x, y, skin, scale = 1) {
  const [r, g, b] = skin.lamp;
  const flicker = (FX && FX.flicker) || 1;
  ctx.strokeStyle = skin.wood; ctx.lineWidth = 1.4 * scale;
  ctx.beginPath(); ctx.moveTo(x, y - 5 * scale); ctx.lineTo(x, y); ctx.stroke();
  ctx.fillStyle = skin.wallD; roundedRect(x - 3 * scale, y, 6 * scale, 9 * scale, 1.4 * scale); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(x, y + 4 * scale, 1, x, y + 4 * scale, 20 * scale * flicker);
  glow.addColorStop(0, `rgba(${r},${g},${b},0.52)`); glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y + 4 * scale, 20 * scale * flicker, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fillRect(x - 1.3 * scale, y + 1.5 * scale, 2.6 * scale, 5 * scale);
}

function drawFarmCrop(x, y, skin, phase, mature) {
  const sway = Math.sin(performance.now() / 650 + phase) * (mature ? 1.3 : 0.7);
  ctx.save();
  ctx.translate(x, y);
  if (skin.id === "frozen") {
    ctx.fillStyle = skin.accent;
    ctx.beginPath(); ctx.moveTo(sway, -4 - mature * 4); ctx.lineTo(-3, 0); ctx.lineTo(0, -11 - mature * 4); ctx.lineTo(3, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin.trim;
    ctx.beginPath(); ctx.moveTo(0, -10 - mature * 4); ctx.lineTo(1.2, -4); ctx.lineTo(-0.8, -3); ctx.closePath(); ctx.fill();
  } else if (skin.id === "desert") {
    ctx.strokeStyle = "#588b43"; ctx.lineWidth = 2.2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sway * 0.4, -8 - mature * 3); ctx.stroke();
    if (mature) {
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(-4, -8); ctx.moveTo(0, -7); ctx.lineTo(4, -11); ctx.stroke();
    }
    ctx.fillStyle = skin.accent2;
    ctx.beginPath(); ctx.arc(sway * 0.4, -9 - mature * 3, 1.7, 0, Math.PI * 2); ctx.fill();
  } else if (skin.id === "swamp") {
    ctx.strokeStyle = skin.accent; ctx.lineWidth = 1.8; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sway, -7, sway * 0.6, -12 - mature * 3); ctx.stroke();
    ctx.fillStyle = skin.accent2;
    ctx.beginPath(); ctx.ellipse(-2.5, -7, 3.2, 1.5, -0.55, 0, Math.PI * 2); ctx.fill();
    if (mature) { ctx.beginPath(); ctx.ellipse(3, -11, 3.4, 1.6, 0.55, 0, Math.PI * 2); ctx.fill(); }
  } else if (skin.id === "volcano") {
    ctx.strokeStyle = skin.wallL; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sway * 0.4, -8 - mature * 3); ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = skin.accent;
    ctx.beginPath(); ctx.arc(sway * 0.4, -10 - mature * 3, mature ? 2.8 : 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = skin.accent2;
    ctx.beginPath(); ctx.arc(sway * 0.4 - 0.5, -11 - mature * 3, 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (skin.id === "corrupted") {
    ctx.strokeStyle = skin.accent; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-3, -4, 4 + sway, -8, sway, -12 - mature * 2); ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = skin.accent2;
    ctx.beginPath(); ctx.ellipse(sway, -13 - mature * 2, mature ? 3.2 : 2.2, mature ? 4.5 : 3, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else {
    ctx.strokeStyle = "#769b42"; ctx.lineWidth = 1.7; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sway, -8, sway * 0.6, -12 - mature * 3); ctx.stroke();
    ctx.strokeStyle = skin.accent2; ctx.lineWidth = 1.2;
    for (let k = 0; k < (mature ? 4 : 2); k++) {
      const yy = -7 - k * 2;
      ctx.beginPath(); ctx.moveTo(sway * 0.4, yy); ctx.lineTo(-3, yy - 2); ctx.moveTo(sway * 0.4, yy - 0.5); ctx.lineTo(3, yy - 2.5); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawFarmPlot(x, lvl, skin) {
  const fieldCol = skin.id === "frozen" ? "#718da0"
    : skin.id === "desert" ? "#8d5e31"
    : skin.id === "swamp" ? "#26382d"
    : skin.id === "volcano" ? "#211918"
    : skin.id === "corrupted" ? "#24172e"
    : "#49351f";
  const furrowCol = skin.id === "frozen" ? withA([220, 245, 255], 0.36)
    : skin.id === "volcano" ? withA([255, 92, 28], 0.22)
    : skin.id === "corrupted" ? withA([190, 112, 255], 0.3)
    : "rgba(15,10,7,0.28)";

  ctx.fillStyle = skin.wood;
  roundedRect(x - 62, groundY - 13, 124, 13, 3); ctx.fill();
  ctx.fillStyle = fieldCol;
  roundedRect(x - 57, groundY - 11, 114, 9, 2); ctx.fill();
  ctx.strokeStyle = furrowCol; ctx.lineWidth = 1;
  for (let row = 0; row < 3; row++) {
    const yy = groundY - 9 + row * 3;
    ctx.beginPath(); ctx.moveTo(x - 53, yy); ctx.lineTo(x + 53, yy); ctx.stroke();
  }

  const cropCount = 5 + Math.min(3, lvl);
  for (let i = 0; i < cropCount; i++) {
    const cx = x - 48 + i * (96 / Math.max(1, cropCount - 1));
    drawFarmCrop(cx, groundY - 10, skin, i * 1.7, lvl >= 3);
  }

  // Low split-rail fence, recolored to the settlement material.
  ctx.fillStyle = skin.wood;
  ctx.fillRect(x - 66, groundY - 21, 4, 21);
  ctx.fillRect(x + 62, groundY - 21, 4, 21);
  ctx.fillRect(x - 66, groundY - 19, 132, 3);
  ctx.fillStyle = skin.trim;
  ctx.fillRect(x - 65, groundY - 19, 130, 0.8);
}

function drawFarmStorehouse(x, skin) {
  const bx = x + 43;
  const floorY = groundY - (skin.id === "swamp" ? 5 : 0);
  if (skin.id === "swamp") {
    ctx.strokeStyle = skin.wood; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(bx - 13, groundY); ctx.lineTo(bx - 11, floorY - 30); ctx.moveTo(bx + 13, groundY); ctx.lineTo(bx + 11, floorY - 30); ctx.stroke();
  }
  ctx.fillStyle = skin.wallD;
  roundedRect(bx - 22, floorY - 35, 44, 35, 3); ctx.fill();
  ctx.fillStyle = skin.wall;
  roundedRect(bx - 18, floorY - 32, 31, 32, 2); ctx.fill();
  ctx.fillStyle = skin.gate;
  roundedRect(bx - 5, floorY - 20, 12, 20, 2); ctx.fill();
  ctx.strokeStyle = skin.trim; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(bx + 1, floorY - 19); ctx.lineTo(bx + 1, floorY - 1); ctx.stroke();
  drawFarmRoof(bx, floorY - 34, skin);

  ctx.fillStyle = skin.accent;
  ctx.beginPath(); ctx.arc(bx - 12, floorY - 20, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = skin.wallD;
  ctx.beginPath(); ctx.arc(bx - 12, floorY - 20, 2, 0, Math.PI * 2); ctx.fill();
  if (Game.isNight) drawFarmLamp(bx + 17, floorY - 17, skin, 0.55);
}

function drawFarmHarvest(x, skin) {
  const hx = x - 39;
  if (skin.id === "frozen") {
    ctx.fillStyle = skin.wallD; roundedRect(hx - 12, groundY - 12, 24, 12, 3); ctx.fill();
    ctx.fillStyle = skin.roofC;
    for (const ox of [-7, 0, 7]) { ctx.beginPath(); ctx.moveTo(hx + ox - 4, groundY - 12); ctx.lineTo(hx + ox, groundY - 23); ctx.lineTo(hx + ox + 4, groundY - 12); ctx.closePath(); ctx.fill(); }
  } else if (skin.id === "desert") {
    ctx.fillStyle = skin.wall; ctx.beginPath(); ctx.ellipse(hx - 6, groundY - 8, 8, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx + 6, groundY - 7, 7, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = skin.trim; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(hx - 6, groundY - 8, 6, 0.4, 2.7); ctx.stroke();
  } else if (skin.id === "swamp") {
    ctx.fillStyle = skin.wood; roundedRect(hx - 14, groundY - 11, 28, 11, 3); ctx.fill();
    ctx.fillStyle = skin.accent;
    for (const ox of [-8, -2, 5, 10]) { ctx.beginPath(); ctx.arc(hx + ox, groundY - 13 - Math.abs(ox % 3), 3.2, 0, Math.PI * 2); ctx.fill(); }
  } else if (skin.id === "volcano" || skin.id === "corrupted") {
    ctx.fillStyle = skin.wallD; roundedRect(hx - 14, groundY - 10, 28, 10, 3); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = skin.accent;
    for (const ox of [-8, 0, 8]) { ctx.beginPath(); ctx.arc(hx + ox, groundY - 13 - Math.abs(ox) * 0.12, 3.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  } else {
    ctx.fillStyle = "#b88b32"; roundedRect(hx - 15, groundY - 14, 30, 14, 5); ctx.fill();
    ctx.strokeStyle = "#e2bd58"; ctx.lineWidth = 1;
    for (const yy of [groundY - 11, groundY - 6]) { ctx.beginPath(); ctx.moveTo(hx - 13, yy); ctx.lineTo(hx + 13, yy); ctx.stroke(); }
    ctx.strokeStyle = skin.wood; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(hx, groundY - 14); ctx.lineTo(hx, groundY); ctx.stroke();
  }
}

function drawFarmMill(x, lvl, skin) {
  const mx = x - 5, hubY = groundY - 58;
  ctx.fillStyle = skin.wallD;
  ctx.beginPath(); ctx.moveTo(mx - 13, groundY); ctx.lineTo(mx - 8, hubY + 4); ctx.lineTo(mx + 8, hubY + 4); ctx.lineTo(mx + 13, groundY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = skin.wall;
  ctx.beginPath(); ctx.moveTo(mx - 7, groundY - 3); ctx.lineTo(mx - 4, hubY + 8); ctx.lineTo(mx + 3, hubY + 8); ctx.lineTo(mx + 5, groundY - 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = skin.roofD;
  ctx.beginPath(); ctx.moveTo(mx - 10, hubY + 5); ctx.lineTo(mx, hubY - 8); ctx.lineTo(mx + 10, hubY + 5); ctx.closePath(); ctx.fill();

  const spin = lvl >= 5 ? performance.now() / 850 : -0.35;
  ctx.save(); ctx.translate(mx, hubY);
  for (let b = 0; b < 4; b++) {
    ctx.save(); ctx.rotate(spin + b * Math.PI / 2);
    ctx.strokeStyle = skin.wood; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -25); ctx.stroke();
    ctx.fillStyle = skin.id === "frozen" ? skin.roofC : skin.id === "volcano" ? skin.wallL : skin.trim;
    ctx.globalAlpha = skin.id === "corrupted" ? 0.75 : 0.9;
    ctx.beginPath(); ctx.moveTo(-3, -8); ctx.lineTo(-5, -25); ctx.lineTo(3, -31); ctx.lineTo(4, -10); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = skin.accent2;
  ctx.beginPath(); ctx.arc(0, 0, 4.2, 0, Math.PI * 2); ctx.fill();
  if (skin.id === "volcano" || skin.id === "corrupted") {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.35;
    ctx.fillStyle = skin.accent; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}

function drawBiomeFarm(x, lvl) {
  const skin = farmSkinAt(x);
  groundShadow(x, 78, 0.24);
  if (lvl >= 4) drawFarmMill(x, lvl, skin);
  if (lvl >= 2) drawFarmStorehouse(x, skin);
  drawFarmPlot(x, lvl, skin);
  if (lvl >= 3) drawFarmHarvest(x, skin);
  if (lvl >= 5) {
    ctx.strokeStyle = skin.wood; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x - 68, groundY - 20); ctx.lineTo(x - 68, groundY - 47); ctx.stroke();
    ctx.fillStyle = skin.banner;
    ctx.beginPath(); ctx.moveTo(x - 67, groundY - 46); ctx.lineTo(x - 49, groundY - 41); ctx.lineTo(x - 67, groundY - 35); ctx.closePath(); ctx.fill();
    if (Game.isNight) drawFarmLamp(x - 58, groundY - 20, skin, 0.58);
  }
}

function drawClericStation(x) {
  drawWallStall(x,"#d4c27d","#756642","cleric");
  drawBoothPerson(x-7,"#d5ae82","#ddd3b8","#756b68");
  drawBoothCounter(x);

  ctx.save();
  ctx.translate(x+10,groundY-20);
  ctx.fillStyle="#3c765f"; ctx.fillRect(-8,-3,16,4);
  ctx.fillStyle="#d7c68a"; ctx.fillRect(-7,-7,14,4);
  ctx.strokeStyle="#f0e7bd"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,-7); ctx.lineTo(0,-3); ctx.stroke();
  ctx.restore();

  const sx=x-34;
  ctx.strokeStyle="#70512e"; ctx.lineWidth=2.5; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(sx,groundY-2); ctx.lineTo(sx,groundY-38); ctx.stroke();
  ctx.lineCap="butt";
  ctx.strokeStyle="#e0bd58"; ctx.lineWidth=1.8;
  ctx.beginPath(); ctx.arc(sx,groundY-43,5,0,Math.PI*2); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation="lighter";
  ctx.fillStyle="#8fe8c2"; ctx.beginPath(); ctx.arc(sx,groundY-43,2.2,0,Math.PI*2); ctx.fill();
  if (Game.isNight) {
    const g=ctx.createRadialGradient(sx,groundY-43,1,sx,groundY-43,18);
    g.addColorStop(0,"rgba(143,232,194,0.42)"); g.addColorStop(1,"rgba(143,232,194,0)");
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(sx,groundY-43,18,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

export function drawStations() {
  const view = visibleWorldBounds(180);
  const seen = x => x >= view.left && x <= view.right;
  if (seen(STATIONS_X.bow)) drawBowStation(STATIONS_X.bow);
  if (state.base && state.base.level >= 2 && seen(STATIONS_X.hammer)) drawHammerStation(STATIONS_X.hammer);
  const farmLvl = state.farmLevel || 0;
  if (state.base.level >= 2 && farmLvl === 0 && seen(STATIONS_X.farm)) drawBuildMarker(STATIONS_X.farm, "#9bd05a");
  if (farmLvl >= 1 && seen(STATIONS_X.farm)) {
    drawBiomeFarm(STATIONS_X.farm, farmLvl);
  }
  if (state.base && state.base.level >= 2 && seen(STATIONS_X.shop)) drawShopBuilding(STATIONS_X.shop);
  if (state.base && state.base.level >= 3 && seen(STATIONS_X.guard)) drawGuardStation(STATIONS_X.guard);
  if (state.base && state.base.level >= 3 && seen(STATIONS_X.cleric)) drawClericStation(STATIONS_X.cleric);
}

// ---------- Unlockable buildings ----------
// Lumber camp, ember kennel, trap foundry, omen roost and pilgrim market.
// Forest slots show a clearing hint until the trees around them are felled.
function drawClearingHint(x) {
  drawBuildMarker(x, "#8a6a3a");
  const bob=Math.sin(performance.now()/400+x)*3;
  ctx.save(); ctx.font="15px serif"; ctx.textAlign="center"; ctx.globalAlpha=0.9;
  ctx.fillText("🪓", x, groundY-46+bob);
  if (state.player && Math.abs(state.player.x-x)<150) {
    ctx.font="12px sans-serif"; ctx.fillStyle="rgba(255,240,200,0.9)";
    ctx.fillText("Clear the trees to build here", x, groundY-70);
  }
  ctx.restore();
}

function drawLumberCamp(b, night) {
  const x=b.x;
  groundShadow(x, 34, 0.22);
  drawTent(x-26, "#5a4630");
  // stacked logs
  const logCol="#7a5a34", ringCol="#c9a878";
  const stack=[[14,-6],[26,-6],[20,-14]];
  for (const [lx,ly] of stack) {
    ctx.fillStyle=logCol; ctx.beginPath(); ctx.arc(x+lx,groundY+ly,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=ringCol; ctx.beginPath(); ctx.arc(x+lx,groundY+ly,3.4,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="rgba(90,60,30,0.6)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(x+lx,groundY+ly,1.6,0,Math.PI*2); ctx.stroke();
  }
  // chopping block with axe
  ctx.fillStyle="#6a4a28"; ctx.fillRect(x+38,groundY-9,12,9);
  ctx.save(); ctx.translate(x+44,groundY-9); ctx.rotate(-0.6);
  ctx.strokeStyle="#5a4028"; ctx.lineWidth=2.2; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-13); ctx.stroke();
  ctx.fillStyle="#9aa0aa"; ctx.beginPath(); ctx.moveTo(-1,-13); ctx.lineTo(6,-15); ctx.lineTo(6,-9); ctx.closePath(); ctx.fill();
  ctx.restore();
  if (night) drawTorch(x+52, groundY);
}

function drawKennel(b, night) {
  const x = b.x, t = performance.now() / 1000;
  groundShadow(x, 34, 0.22);
  ctx.fillStyle = "#5d3b24";
  roundedRect(x - 26, groundY - 28, 52, 28, 4); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundedRect(x - 24, groundY - 27, 17, 26, 4); ctx.fill();
  ctx.fillStyle = "#7a4f2e";
  ctx.beginPath(); ctx.moveTo(x - 34, groundY - 28); ctx.lineTo(x, groundY - 58); ctx.lineTo(x + 34, groundY - 28); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath(); ctx.moveTo(x, groundY - 58); ctx.lineTo(x + 34, groundY - 28); ctx.lineTo(x + 11, groundY - 28); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#ffb45f"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - 34, groundY - 28); ctx.lineTo(x, groundY - 58); ctx.lineTo(x + 34, groundY - 28); ctx.stroke();
  ctx.fillStyle = "#15100d";
  ctx.beginPath(); ctx.arc(x, groundY - 2, 12, Math.PI, 0); ctx.lineTo(x + 12, groundY); ctx.lineTo(x - 12, groundY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#ffb45f";
  for (let i = 0; i < Math.max(1, b.level || 1); i++) {
    ctx.beginPath(); ctx.arc(x - 8 + i * 16, groundY - 38 + Math.sin(t * 4 + i) * 1.5, 2.4, 0, Math.PI * 2); ctx.fill();
  }
  if (b.fireFlash > 0) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = Math.min(0.5, b.fireFlash);
    const g = ctx.createRadialGradient(x, groundY - 22, 2, x, groundY - 22, 42);
    g.addColorStop(0, "rgba(255,180,95,0.7)"); g.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, groundY - 22, 42, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (night) drawTorch(x + 31, groundY);
}

function drawTrapFoundry(b, night) {
  const x = b.x, t = performance.now() / 1000;
  groundShadow(x, 38, 0.24);
  ctx.fillStyle = "#49464f";
  ctx.fillRect(x - 28, groundY - 18, 56, 18);
  ctx.fillStyle = "#5d5963";
  ctx.fillRect(x - 22, groundY - 27, 44, 10);
  ctx.fillStyle = "rgba(255,255,255,0.09)";
  ctx.fillRect(x - 22, groundY - 27, 14, 10);
  ctx.strokeStyle = "#2f2d34"; ctx.lineWidth = 2;
  ctx.strokeRect(x - 28, groundY - 18, 56, 18);
  ctx.fillStyle = "#34323a";
  ctx.fillRect(x - 6, groundY - 54, 12, 28);
  ctx.strokeStyle = "#cfd3d9"; ctx.lineWidth = 2.2; ctx.lineCap = "round";
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(x + s * 3, groundY - 34); ctx.quadraticCurveTo(x + s * 22, groundY - 43, x + s * 27, groundY - 61); ctx.stroke();
  }
  ctx.lineCap = "butt";
  if (b.fireFlash > 0 || Math.sin(t * 8 + x) > 0.7) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "#ffe07a";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(x + rand(-12, 12), groundY - 36 + rand(-14, 4), 1.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  if (night) drawTorch(x - 34, groundY);
}

function drawRavenRoost(b, night) {
  const x = b.x, t = performance.now() / 1000;
  groundShadow(x, 26, 0.2);
  ctx.strokeStyle = "#2f2533"; ctx.lineWidth = 6; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x, groundY - 88); ctx.stroke();
  ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(x, groundY - 58); ctx.lineTo(x - 36, groundY - 76); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, groundY - 48); ctx.lineTo(x + 34, groundY - 69); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, groundY - 74); ctx.lineTo(x + 20, groundY - 96); ctx.stroke();
  ctx.lineCap = "butt";
  const birds = Math.max(1, b.level || 1);
  for (let i = 0; i < birds; i++) {
    const bx = x - 27 + i * 54;
    const by = groundY - 78 - i * 3 + Math.sin(t * 3 + i) * 1.5;
    ctx.fillStyle = b.fireFlash > 0 ? "#d8f6ff" : "#171221";
    ctx.beginPath(); ctx.ellipse(bx, by, 9, 5, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx - 8, by); ctx.lineTo(bx - 17, by - 4); ctx.lineTo(bx - 8, by - 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#b9a7ff";
    ctx.beginPath(); ctx.arc(bx + 3, by - 1, 1.2, 0, Math.PI * 2); ctx.fill();
  }
  if (b.fireFlash > 0) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = Math.min(0.5, b.fireFlash * 1.6);
    const g = ctx.createRadialGradient(x, groundY - 78, 2, x, groundY - 78, 68);
    g.addColorStop(0, "rgba(185,167,255,0.65)"); g.addColorStop(1, "rgba(80,60,180,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, groundY - 78, 68, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (night) drawTorch(x + 20, groundY - 10);
}

function drawMarketCart(b, night) {
  const x = b.x, t = performance.now() / 1000;
  groundShadow(x, 48, 0.22);
  ctx.fillStyle = "#7a4f2e";
  roundedRect(x - 36, groundY - 30, 72, 28, 4); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(x - 34, groundY - 29, 22, 26);
  ctx.fillStyle = "#b65a35";
  ctx.beginPath(); ctx.moveTo(x - 43, groundY - 30); ctx.lineTo(x - 24, groundY - 56); ctx.lineTo(x + 24, groundY - 56); ctx.lineTo(x + 43, groundY - 30); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.moveTo(x + 24, groundY - 56); ctx.lineTo(x + 43, groundY - 30); ctx.lineTo(x + 5, groundY - 30); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#7fd6a4"; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x - 43, groundY - 30); ctx.lineTo(x - 24, groundY - 56); ctx.lineTo(x + 24, groundY - 56); ctx.lineTo(x + 43, groundY - 30); ctx.stroke();
  ctx.fillStyle = "#2f2118";
  for (const wx of [-24, 24]) {
    ctx.beginPath(); ctx.arc(x + wx, groundY - 2, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#c9a878"; ctx.beginPath(); ctx.arc(x + wx, groundY - 2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2f2118";
  }
  ctx.fillStyle = "#f2c14e";
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.arc(x - 10 + i * 10, groundY - 38 + Math.sin(t * 2 + i) * 1.2, 3, 0, Math.PI * 2); ctx.fill();
  }
  if (b.fireFlash > 0) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = Math.min(0.55, b.fireFlash);
    const g = ctx.createRadialGradient(x, groundY - 35, 2, x, groundY - 35, 55);
    g.addColorStop(0, "rgba(127,214,164,0.6)"); g.addColorStop(1, "rgba(40,160,110,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, groundY - 35, 55, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (night) drawTorch(x + 40, groundY - 9);
}

export function drawBuildings(dark) {
  const night = dark > 0.25;
  const baseLvl = state.base ? state.base.level : 1;
  const view = visibleWorldBounds(210);
  for (const b of (state.buildings || [])) {
    if (baseLvl < b.unlock) continue;
    if (b.x < view.left || b.x > view.right) continue;
    if (!b.built) {
      if (b.needsClearing && !b.cleared) { drawClearingHint(b.x); continue; }
      const markerCol = b.type==="lumber" ? "#8a9a5a" : b.type==="kennel" ? "#ffb45f" : b.type==="trap_foundry" ? "#cfd3d9" : b.type==="raven_roost" ? "#b9a7ff" : b.type==="market_cart" ? "#7fd6a4" : "#8fd8ff";
      drawBuildMarker(b.x, markerCol);
      drawStationIcon(b.x, b.type==="lumber" ? "🪵" : b.type==="kennel" ? "H" : b.type==="trap_foundry" ? "T" : b.type==="raven_roost" ? "R" : b.type==="market_cart" ? "M" : "⛺");
      continue;
    }
    if (b.type === "lumber") drawLumberCamp(b, night);
    else if (b.type === "kennel") drawKennel(b, night);
    else if (b.type === "trap_foundry") drawTrapFoundry(b, night);
    else if (b.type === "raven_roost") drawRavenRoost(b, night);
    else if (b.type === "market_cart") drawMarketCart(b, night);
  }
}
