import { clamp, lerp, lerpColor, rgb, withA, shade, hazeColor, atmo, dist } from '../util/math.js';
import { CFG, STATIONS_X } from '../config/config.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { WEAPONS, RARITY_COL, RARITY_NAME, WEAPON_UPGRADES, effectiveWeapon } from '../config/weapons.js';
import { ARMORS, ARMOR_RARITY_COL, ARMOR_RARITY_NAME } from '../config/armor.js';
import { LOC_DEFS } from '../config/locations.js';
import { ctx, W, H, groundY } from '../canvas.js';
import { Game, state } from '../state.js';
import {
  FX, biomeAt, skyColors, darkness, windGust, windSway,
  getTrees, getDeco, getGroundTex,
  drawTreeLayer, drawStars, drawAurora, drawCelestial, drawClouds, drawBirds,
  drawHills, drawMountains, drawFogBand, drawGodrays, drawLowFog, drawAmbientFront,
} from './Effects.js';
import { wallHeight } from '../entities/Wall.js';
import { spr, ready as spritesReady, T } from './Sprites.js';

// ---------- Shared helpers ----------
export function groundShadow(x, w, a) {
  ctx.save(); ctx.globalAlpha=a; ctx.fillStyle="#0a0810";
  ctx.beginPath(); ctx.ellipse(x,groundY+2,w,w*0.26,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}

function drawTomeIcon(col, s) {
  s = s || 1;
  roundedRect(-8*s, -11*s, 16*s, 17*s, 2*s);
  ctx.fillStyle = "rgba(20,14,28,0.85)"; ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.5*s; ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = s;
  ctx.beginPath(); ctx.moveTo(0, -11*s); ctx.lineTo(0, 6*s); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.75;
  const tg = ctx.createRadialGradient(0, -18*s, 1, 0, -18*s, 6*s);
  tg.addColorStop(0, col); tg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(0, -18*s, 6*s, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, -18*s, 2.5*s, 0, Math.PI*2); ctx.fill();
}

function drawHpBar(x, y, w, frac, color) {
  frac=clamp(frac,0,1); if (frac>=0.999) return;
  ctx.fillStyle="rgba(0,0,0,0.55)"; ctx.fillRect(x-w/2-1,y-1,w+2,5);
  ctx.fillStyle=color; ctx.fillRect(x-w/2,y,w*frac,3);
}

function drawFocusHalo(x, y, rx, ry, col, alpha) {
  ctx.save();
  ctx.globalCompositeOperation="lighter";
  const g=ctx.createRadialGradient(x,y,8,x,y,rx);
  g.addColorStop(0,withA(col,alpha));
  g.addColorStop(0.48,withA(col,alpha*0.28));
  g.addColorStop(1,withA(col,0));
  ctx.fillStyle=g;
  ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawHeart(x, y, s, col) {
  ctx.fillStyle=col; ctx.beginPath();
  ctx.moveTo(x,y+s*0.9); ctx.bezierCurveTo(x-s*1.4,y-s*0.4,x-s*0.4,y-s*1.2,x,y-s*0.4);
  ctx.bezierCurveTo(x+s*0.4,y-s*1.2,x+s*1.4,y-s*0.4,x,y+s*0.9); ctx.fill();
}

function legs(x, baseYy, anim, spread, col) {
  ctx.strokeStyle=col; ctx.lineWidth=2.6; ctx.lineCap="round";
  const s=Math.sin(anim);
  ctx.beginPath(); ctx.moveTo(x-3,baseYy); ctx.lineTo(x-3+s*spread,groundY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+3,baseYy); ctx.lineTo(x+3-s*spread,groundY); ctx.stroke();
  ctx.lineCap="butt";
}

function litWindow(dark) { const fl=(FX&&FX.flicker)||1; return 0.5+0.5*(dark>0.2?fl:0.32); }

// ---------- Ground ----------
function drawGroundTexture(dark) {
  const tex=getGroundTex(), camL=Game.cam-30, camR=Game.cam+W+30;
  for (const p of tex.patches) {
    if (p.x<camL||p.x>camR) continue;
    const b=biomeAt(p.x), col=lerpColor(p.light?shade(b.gT,1.16):shade(b.gT,0.8),[12,14,22],dark);
    ctx.fillStyle=withA(col,0.5); ctx.beginPath(); ctx.ellipse(p.x,groundY+7+p.dy,p.r,p.r*0.4,0,0,Math.PI*2); ctx.fill();
  }
  for (const p of tex.pebbles) {
    if (p.x<camL||p.x>camR) continue;
    ctx.fillStyle=withA(lerpColor([120,118,124],[40,40,52],dark),0.7); ctx.beginPath(); ctx.ellipse(p.x,groundY+9+p.dy,p.r,p.r*0.7,0,0,Math.PI*2); ctx.fill();
  }
  ctx.lineCap="round";
  for (const f of tex.fringe) {
    if (f.x<camL||f.x>camR) continue;
    const b=biomeAt(f.x), col=b.snow?lerpColor([226,233,243],[120,140,170],dark):lerpColor(shade(b.gT,1.04),[18,26,18],dark);
    const sway=windSway(f.ph,4);
    ctx.strokeStyle=rgb(col); ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(f.x,groundY+2); ctx.quadraticCurveTo(f.x+sway*0.5,groundY-f.h*0.6,f.x+sway,groundY-f.h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(f.x+3,groundY+2); ctx.quadraticCurveTo(f.x+3+sway*0.4,groundY-f.h*0.5,f.x+3+sway*0.8,groundY-f.h*0.8); ctx.stroke();
  }
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
      for (let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(x+i*3*s,groundY); ctx.quadraticCurveTo(x+i*3*s+sway*0.5,groundY-7*s,x+i*4*s+sway,groundY-12*s); ctx.stroke(); } break; }
    case "flower": {
      ctx.strokeStyle=rgb(g1); ctx.lineWidth=1.4*s; ctx.beginPath(); ctx.moveTo(x,groundY); ctx.quadraticCurveTo(x+sway*0.5,groundY-8*s,x+sway,groundY-13*s); ctx.stroke();
      ctx.fillStyle=it.flower; ctx.beginPath(); ctx.arc(x+sway,groundY-14*s,2.4*s,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="rgba(255,240,160,0.9)"; ctx.beginPath(); ctx.arc(x+sway,groundY-14*s,1*s,0,Math.PI*2); ctx.fill(); break; }
    case "stone": {
      ctx.fillStyle=rgb(lerpColor([110,112,120],[30,32,42],dark)); ctx.beginPath(); ctx.ellipse(x,groundY-3*s,6*s,4*s,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="rgba(255,255,255,0.12)"; ctx.beginPath(); ctx.ellipse(x-1.5*s,groundY-4.5*s,3*s,1.6*s,0,0,Math.PI*2); ctx.fill(); break; }
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
  }
  ctx.lineCap="butt";
}

function drawGroundDeco(dark) {
  const items=getDeco().items, camL=Game.cam-40, camR=Game.cam+W+40;
  for (const it of items) { if (it.x<camL||it.x>camR) continue; drawDeco(it,biomeAt(it.x),dark); }
}

// ---------- Building pieces ----------
function stoneCol(dark) { return rgb(lerpColor([96,88,100],[24,22,28],dark)); }
function stoneLt(dark)  { return rgb(lerpColor([136,128,142],[44,40,48],dark)); }
function woodCol(dark)  { return rgb(lerpColor([100,74,44],[26,18,12],dark)); }

function drawTorch(x, y) {
  const fl=(FX&&FX.flicker)||1;
  ctx.strokeStyle="#3a2a1a"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y-12); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.fillStyle=`rgba(255,150,50,0.55)`; ctx.beginPath(); ctx.arc(x,y-15,14*fl,0,Math.PI*2); ctx.fill(); ctx.restore();
  ctx.fillStyle="rgba(255,170,60,0.97)"; ctx.beginPath(); ctx.ellipse(x,y-15,3,6*fl,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(255,234,160,0.98)"; ctx.beginPath(); ctx.ellipse(x,y-15,1.5,3.4*fl,0,0,Math.PI*2); ctx.fill();
}

function drawCampfire(x) {
  const t=performance.now()/1000, fl=(FX&&FX.flicker)||1, wind=windGust()*0.3;
  ctx.fillStyle=`rgba(255,140,40,${0.5*fl})`; ctx.beginPath(); ctx.ellipse(x,groundY-3,13,4,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="#3a2a1a"; ctx.lineWidth=5; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(x-12,groundY-2); ctx.lineTo(x+10,groundY-7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+12,groundY-2); ctx.lineTo(x-10,groundY-7); ctx.stroke();
  ctx.lineCap="butt";
  const flame=(h,w,col,wob)=>{ const sway=Math.sin(t*8+wob)*2+wind; ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(x-w,groundY-6); ctx.quadraticCurveTo(x-w*0.6+sway,groundY-h*0.6,x+sway*1.4,groundY-h*fl); ctx.quadraticCurveTo(x+w*0.6+sway,groundY-h*0.6,x+w,groundY-6); ctx.quadraticCurveTo(x,groundY-2,x-w,groundY-6); ctx.fill(); };
  flame(34,11,"rgba(226,88,30,0.92)",0); flame(26,8,"rgba(255,150,40,0.95)",1.7);
  flame(17,5,"rgba(255,210,90,0.97)",3.1); flame(9,2.6,"rgba(255,244,200,0.98)",4.6);
}

function drawBackgroundReadabilityWash(dark) {
  const a=0.09+0.08*(1-dark);
  const g=ctx.createLinearGradient(0,groundY-260,0,groundY+20);
  g.addColorStop(0,"rgba(190,220,226,0)");
  g.addColorStop(0.58,`rgba(206,224,212,${a})`);
  g.addColorStop(1,`rgba(28,42,30,${0.08+dark*0.08})`);
  ctx.fillStyle=g;
  ctx.fillRect(0,Math.max(0,groundY-270),W,290);
}

function drawTent(x, col) {
  ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(x,groundY-44); ctx.lineTo(x-26,groundY); ctx.lineTo(x+26,groundY); ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.28)"; ctx.beginPath(); ctx.moveTo(x,groundY-44); ctx.lineTo(x+26,groundY); ctx.lineTo(x+8,groundY); ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,0.10)"; ctx.beginPath(); ctx.moveTo(x,groundY-44); ctx.lineTo(x-26,groundY); ctx.lineTo(x-12,groundY); ctx.closePath(); ctx.fill();
  ctx.strokeStyle="rgba(40,30,24,0.8)"; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(x,groundY-44); ctx.lineTo(x,groundY-54); ctx.stroke();
  const sway=windSway(x,3); ctx.fillStyle="#c1453b"; ctx.beginPath(); ctx.moveTo(x,groundY-54); ctx.lineTo(x+10+sway,groundY-51); ctx.lineTo(x,groundY-48); ctx.fill();
}
function drawHouse(x, h, l, d, dark) {
  const w=h*0.9;
  ctx.fillStyle=d; ctx.fillRect(x-w/2,groundY-h,w,h);
  ctx.fillStyle="rgba(255,255,255,0.06)"; ctx.fillRect(x-w/2,groundY-h,w*0.34,h);
  ctx.fillStyle=l; ctx.beginPath(); ctx.moveTo(x-w/2-5,groundY-h); ctx.lineTo(x,groundY-h-28); ctx.lineTo(x+w/2+5,groundY-h); ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.moveTo(x,groundY-h-28); ctx.lineTo(x+w/2+5,groundY-h); ctx.lineTo(x+w*0.2,groundY-h); ctx.closePath(); ctx.fill();
  ctx.fillStyle=`rgba(255,186,86,${litWindow(dark)})`; ctx.fillRect(x-6,groundY-h*0.55,12,14);
  ctx.fillStyle="rgba(36,24,16,0.85)"; ctx.fillRect(x-w*0.16,groundY-h*0.42,w*0.18,h*0.42);
}
function drawTower(x, h, l, d, dark) {
  const w=36;
  ctx.fillStyle=d; ctx.fillRect(x-w/2,groundY-h,w,h);
  ctx.fillStyle="rgba(255,255,255,0.06)"; ctx.fillRect(x-w/2,groundY-h,w*0.32,h);
  ctx.fillStyle=l; for (let i=0;i<3;i++) ctx.fillRect(x-w/2+i*(w/3),groundY-h-8,w/4,9);
  ctx.fillStyle=`rgba(255,186,86,${litWindow(dark)})`;
  ctx.fillRect(x-5,groundY-h*0.7,10,14); ctx.fillRect(x-5,groundY-h*0.4,10,14);
}
function drawKeep(x, h, l, d, dark) {
  const w=90;
  ctx.fillStyle=d; ctx.fillRect(x-w/2,groundY-h,w,h);
  ctx.fillStyle="rgba(255,255,255,0.05)"; ctx.fillRect(x-w/2,groundY-h,w*0.3,h);
  ctx.fillStyle=l; for (let i=0;i<5;i++) ctx.fillRect(x-w/2+i*(w/5),groundY-h-10,w/8,11);
  const sway=windSway(x*0.1,2.5); ctx.fillStyle="#c1453b";
  ctx.beginPath(); ctx.moveTo(x-8,groundY-h+10); ctx.lineTo(x+8,groundY-h+10); ctx.lineTo(x+8+sway,groundY-h+50); ctx.lineTo(x-8+sway,groundY-h+50); ctx.closePath(); ctx.fill();
  ctx.fillStyle="#f2c14e"; ctx.beginPath(); ctx.arc(x+sway*0.5,groundY-h+26,5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=`rgba(255,186,86,${litWindow(dark)})`; ctx.fillRect(x-6,groundY-h*0.6,12,18);
}

// ---------- World entities ----------
function drawFlag(x, color) {
  groundShadow(x,8,0.16);
  ctx.strokeStyle="#cdbfa3"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,groundY); ctx.lineTo(x,groundY-36); ctx.stroke();
  const sway=windSway(x,4); ctx.fillStyle=color;
  ctx.beginPath(); ctx.moveTo(x,groundY-36); ctx.quadraticCurveTo(x+10+sway,groundY-34,x+18+sway,groundY-30); ctx.quadraticCurveTo(x+10+sway,groundY-28,x,groundY-24); ctx.fill();
}

export function drawEntityShadows() {
  const { player, units, vagrants, enemies, animals } = state;
  if (player) groundShadow(player.x,22,0.24);
  for (const u of units)   groundShadow(u.x,11,0.2);
  for (const v of vagrants) groundShadow(v.x,11,0.2);
  for (const e of enemies)  groundShadow(e.x,ENEMY_TYPES[e.type].w*0.7,0.22);
  for (const a of animals)  if (a.alive) groundShadow(a.x,10,0.18);
}

export function drawPortals(dark) {
  for (const p of state.portals) {
    const x=p.x; ctx.save();
    ctx.fillStyle="#140f1e"; ctx.beginPath(); ctx.moveTo(x-70,groundY); ctx.quadraticCurveTo(x,groundY-130,x+70,groundY); ctx.fill();
    const glow=Game.isNight?1:0.35;
    const rg=ctx.createRadialGradient(x,groundY-50,4,x,groundY-50,46);
    rg.addColorStop(0,`rgba(255,60,90,${0.9*glow})`); rg.addColorStop(1,"rgba(120,10,40,0)");
    ctx.fillStyle=rg; ctx.beginPath(); ctx.ellipse(x,groundY-50,30,48,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(20,4,10,1)"; ctx.beginPath(); ctx.ellipse(x,groundY-46,14,30,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

export function drawWalls(dark) {
  const night=dark>0.25;
  for (const w of state.walls) {
    const x=w.x;
    if (!w.commissioned) { drawFlag(x,"#6fb3d6"); continue; }
    const h=wallHeight(w)*(0.3+0.7*clamp(w.buildProgress,0,1));
    const WW=[0,26,34,44,56,72,96][w.level]||26;
    if (w.flash>0) w.flash-=0.016;
    const flash=w.flash>0;
    const stoneColors=["","#7a5a36","#6b6b78","#555568","#484458","#3a3448"];
    const col=flash?"#e8d8a8":(stoneColors[w.level]||"#7a5a36");
    groundShadow(x,WW*0.7,0.26);

    if (w.level < 5) {
      // Standard wall
      roundedRect(x-WW/2,groundY-h,WW,h,4); ctx.fillStyle=col; ctx.fill();
      ctx.fillStyle="rgba(255,255,255,0.08)"; roundedRect(x-WW/2,groundY-h,WW*0.3,h,4); ctx.fill();
      ctx.fillStyle="rgba(0,0,0,0.18)"; ctx.fillRect(x+WW*0.28,groundY-h,WW*0.22,h);
      // Stone lines (from level 2+)
      if (w.level >= 2) {
        ctx.strokeStyle="rgba(0,0,0,0.22)"; ctx.lineWidth=1;
        for (let yy=groundY-h+8;yy<groundY-4;yy+=9) { ctx.beginPath(); ctx.moveTo(x-WW/2+2,yy); ctx.lineTo(x+WW/2-2,yy); ctx.stroke(); }
      }
      // Battlements
      ctx.fillStyle=col;
      const nM=w.level+2, mW=WW/(nM*2+1);
      for (let i=0;i<nM;i++) ctx.fillRect(x-WW/2+i*(mW*2),groundY-h-8,mW,9);
      // Arrow slits (level 3+)
      if (w.level >= 3) {
        ctx.fillStyle="rgba(0,0,0,0.55)";
        for (let k=0;k<w.level-1;k++) {
          const sx=x-WW/2+8+k*(WW-16)/(w.level-1);
          ctx.fillRect(sx,groundY-h*0.6,5,12);
        }
      }
      if (night&&w.buildProgress>0.6) drawTorch(x,groundY-h-4);
    } else {
      // Level 5: Wide archer rampart with two platforms and a ladder
      const tw = 96, th = h;
      const platY1 = groundY - th * 0.52;  // lower platform
      const platY2 = groundY - th;          // upper platform (top)
      const platW  = tw + 18;               // platforms overhang slightly
      const platH  = 9;

      // Main body
      ctx.fillStyle=col; ctx.fillRect(x-tw/2, groundY-th, tw, th);
      ctx.fillStyle="rgba(255,255,255,0.07)"; ctx.fillRect(x-tw/2, groundY-th, tw*0.22, th);
      ctx.fillStyle="rgba(0,0,0,0.16)"; ctx.fillRect(x+tw*0.3, groundY-th, tw*0.22, th);

      // Stone mortar lines
      ctx.strokeStyle="rgba(0,0,0,0.20)"; ctx.lineWidth=1;
      for (let yy=groundY-th+10; yy<groundY-4; yy+=11) {
        ctx.beginPath(); ctx.moveTo(x-tw/2+2,yy); ctx.lineTo(x+tw/2-2,yy); ctx.stroke();
      }

      // Arrow slits on lower section
      ctx.fillStyle="rgba(0,0,0,0.55)";
      ctx.fillRect(x-tw*0.28-2, groundY-th*0.28, 5, 13);
      ctx.fillRect(x+tw*0.18,   groundY-th*0.28, 5, 13);

      // Lower platform slab
      ctx.fillStyle=col; ctx.fillRect(x-platW/2, platY1, platW, platH);
      ctx.fillStyle="rgba(255,255,255,0.09)"; ctx.fillRect(x-platW/2, platY1, platW, 3);
      ctx.fillStyle="rgba(0,0,0,0.22)"; ctx.fillRect(x-platW/2, platY1+platH-2, platW, 2);
      // Lower platform battlements
      const mW1=platW/8;
      for (let i=0;i<4;i++) ctx.fillStyle=(i%2===0)?col:"rgba(0,0,0,0)";
      ctx.fillStyle=col;
      for (let i=0;i<4;i++) ctx.fillRect(x-platW/2+i*(mW1*2), platY1-8, mW1, 9);

      // Upper platform slab (battlements)
      ctx.fillStyle=col; ctx.fillRect(x-platW/2, platY2, platW, platH);
      ctx.fillStyle="rgba(255,255,255,0.09)"; ctx.fillRect(x-platW/2, platY2, platW, 3);
      ctx.fillStyle="rgba(0,0,0,0.22)"; ctx.fillRect(x-platW/2, platY2+platH-2, platW, 2);
      // Upper battlements
      const mW2=platW/10;
      ctx.fillStyle=col;
      for (let i=0;i<5;i++) ctx.fillRect(x-platW/2+i*(mW2*2), platY2-11, mW2, 12);

      // Ladder on right side: vertical rails + rungs
      const ladX = x + tw/2 - 6;
      const ladTop = platY2 + platH;
      const ladBot = groundY;
      ctx.strokeStyle="#5a3a1a"; ctx.lineWidth=3; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(ladX-5, ladBot); ctx.lineTo(ladX-5, ladTop); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ladX+5, ladBot); ctx.lineTo(ladX+5, ladTop); ctx.stroke();
      ctx.lineWidth=2;
      for (let ry=ladBot-6; ry>ladTop+4; ry-=11) {
        ctx.beginPath(); ctx.moveTo(ladX-5,ry); ctx.lineTo(ladX+5,ry); ctx.stroke();
      }
      // Second ladder: lower platform to upper
      const lad2Top = platY1;
      const lad2Bot = platY2 + platH;
      const lad2X   = x + tw/2 - 6;
      ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(lad2X-5,lad2Bot); ctx.lineTo(lad2X-5,lad2Top); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(lad2X+5,lad2Bot); ctx.lineTo(lad2X+5,lad2Top); ctx.stroke();
      ctx.lineWidth=2;
      for (let ry=lad2Bot-6; ry>lad2Top+4; ry-=11) {
        ctx.beginPath(); ctx.moveTo(lad2X-5,ry); ctx.lineTo(lad2X+5,ry); ctx.stroke();
      }

      if (night) {
        drawTorch(x-platW/2+6, platY1-2);
        drawTorch(x+platW/2-6, platY1-2);
        drawTorch(x, platY2-2);
      }
    }
    drawHpBar(x,groundY-h-18,WW+6,w.hp/w.maxHp,"#9bd05a");
  }
}

export function drawBase(dark) {
  const { base } = state;
  const x=base.x, lvl=base.level;
  if (base.flash>0) base.flash-=0.016;
  const flash=base.flash>0&&Math.floor(base.flash*20)%2===0;
  ctx.save(); groundShadow(x,lvl>=4?112:lvl>=2?82:48,0.3);
  const stoneL=flash?"#ffd0b0":"#5a5260", stoneD=flash?"#e0b090":"#403a48", night=dark>0.25;
  if (lvl===1) {
    drawTent(x-36,"#6a4a32"); drawTent(x+36,"#5a3f2a");
    if (night) { drawTorch(x-58,groundY); drawTorch(x+58,groundY); } drawCampfire(x);
  } else if (lvl===2) {
    drawHouse(x-60,54,stoneL,stoneD,dark); drawHouse(x+58,48,stoneL,stoneD,dark); drawTower(x,100,stoneL,stoneD,dark);
    if (night) { drawTorch(x-92,groundY); drawTorch(x+92,groundY); } drawCampfire(x-6);
  } else if (lvl===3) {
    drawHouse(x-90,60,stoneL,stoneD,dark); drawHouse(x+86,56,stoneL,stoneD,dark);
    drawTower(x-30,120,stoneL,stoneD,dark); drawTower(x+34,110,stoneL,stoneD,dark);
    if (night) { drawTorch(x-122,groundY); drawTorch(x+122,groundY); } drawCampfire(x);
  } else {
    drawTower(x-90,150,stoneL,stoneD,dark); drawTower(x+90,150,stoneL,stoneD,dark); drawKeep(x,180,stoneL,stoneD,dark);
    if (night) { drawTorch(x-132,groundY); drawTorch(x+132,groundY); } drawCampfire(x);
  }
  drawHpBar(x,groundY-(lvl>=4?200:lvl>=2?130:70),70,base.hp/base.maxHp,"#f2c14e");
  ctx.restore();
}

function drawStationIcon(x, emoji) {
  const bob=Math.sin(performance.now()/400+x)*3;
  ctx.save(); ctx.font="20px serif"; ctx.textAlign="center"; ctx.globalAlpha=0.92;
  ctx.fillText(emoji,x,groundY-48+bob);
  ctx.strokeStyle="rgba(120,100,70,0.6)"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(x,groundY); ctx.lineTo(x,groundY-28); ctx.stroke();
  ctx.restore();
}

export function drawStations() {
  drawStationIcon(STATIONS_X.bow,"🏹");
  drawStationIcon(STATIONS_X.hammer,"🔨");
  drawStationIcon(STATIONS_X.farm, state.farmBuilt?"🌾":"🌱");
  if (state.farmBuilt) {
    ctx.fillStyle="#6a4a28"; ctx.fillRect(STATIONS_X.farm-30,groundY-6,60,6);
    ctx.fillStyle="#9bd05a"; for (let i=0;i<5;i++) ctx.fillRect(STATIONS_X.farm-26+i*12,groundY-14,3,10);
  }
  if (state.base && state.base.level >= 2) {
    drawStationIcon(STATIONS_X.shop,"🏪");
    // Shop stall visual
    ctx.fillStyle="#6a4a28"; ctx.fillRect(STATIONS_X.shop-22,groundY-32,44,32);
    ctx.fillStyle="#9a3a2a"; ctx.fillRect(STATIONS_X.shop-24,groundY-38,48,10);
    ctx.fillStyle="rgba(255,255,255,0.08)"; ctx.fillRect(STATIONS_X.shop-22,groundY-32,14,32);
  }
  if (state.base && state.base.level >= 3) {
    drawStationIcon(STATIONS_X.guard,"⚔");
    // Guard recruitment rack
    ctx.strokeStyle="#6a4a28"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(STATIONS_X.guard-18,groundY-8); ctx.lineTo(STATIONS_X.guard+18,groundY-8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(STATIONS_X.guard-14,groundY-8); ctx.lineTo(STATIONS_X.guard-14,groundY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(STATIONS_X.guard+14,groundY-8); ctx.lineTo(STATIONS_X.guard+14,groundY); ctx.stroke();
    ctx.strokeStyle="#9a9aaa"; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(STATIONS_X.guard-10,groundY-14); ctx.lineTo(STATIONS_X.guard-2,groundY-8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(STATIONS_X.guard+10,groundY-14); ctx.lineTo(STATIONS_X.guard+2,groundY-8); ctx.stroke();
  }
}

export function drawCoins() {
  const t=performance.now();
  for (const c of state.coins) {
    const yy=c.settled?groundY-4-Math.sin(t/300+c.x)*1.5:c.y;
    if (c.settled) groundShadow(c.x,5,0.15);
    ctx.fillStyle="#f2c14e"; ctx.beginPath(); ctx.ellipse(c.x,yy,5,6,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#caa028"; ctx.beginPath(); ctx.ellipse(c.x,yy,2.4,3.4,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(255,250,210,0.9)"; ctx.beginPath(); ctx.ellipse(c.x-1.4,yy-1.8,1,1.6,0,0,Math.PI*2); ctx.fill();
  }
}

function drawArm(x1,y1,x2,y2,col) {
  ctx.strokeStyle=col; ctx.lineWidth=2.5; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  ctx.lineCap="butt";
}

function drawHumanoid(x, anim, bodyCol, headCol, tool, dir, moving) {
  ctx.save(); ctx.translate(x,0); if (dir<0) ctx.scale(-1,1);
  const bob=moving?Math.abs(Math.sin(anim))*1.2:0;
  const swing=moving?Math.sin(anim)*2.5:0;
  legs(0,groundY-15,anim,moving?5:0,bodyCol);
  ctx.fillStyle=bodyCol; roundedRect(-5,groundY-34-bob,10,20,4); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.18)"; roundedRect(2,groundY-34-bob,3,20,2); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,0.14)"; roundedRect(-4,groundY-33-bob,3,14,2); ctx.fill();
  ctx.fillStyle=headCol; ctx.beginPath(); ctx.arc(0,groundY-38-bob,5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.22)"; ctx.beginPath(); ctx.arc(-1,groundY-40-bob,5,Math.PI*1.05,Math.PI*2); ctx.fill();
  if (tool==="bow") {
    ctx.fillStyle="#7a7a8a"; ctx.beginPath(); ctx.arc(0,groundY-39-bob,5.5,Math.PI,0); ctx.fill();
    ctx.fillRect(-5.5,groundY-39-bob,11,3); ctx.fillStyle="#6a6a7a"; ctx.fillRect(-1,groundY-38-bob,2,5);
    ctx.fillStyle="#5a6a50"; roundedRect(-5,groundY-34-bob,10,20,4); ctx.fill();
    ctx.fillStyle="#6a7a5e"; ctx.fillRect(-4,groundY-34-bob,8,3);
    // Bow on right side
    ctx.strokeStyle="#8a5a2a"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(8,groundY-28-bob,9,-1.2,1.2); ctx.stroke();
    ctx.strokeStyle="rgba(230,216,168,0.8)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(8+Math.cos(-1.2)*9,groundY-28-bob+Math.sin(-1.2)*9); ctx.lineTo(8+Math.cos(1.2)*9,groundY-28-bob+Math.sin(1.2)*9); ctx.stroke();
    // Left arm: reaches forward to grip the bow
    drawArm(-4,groundY-31-bob, 8,groundY-28-bob, headCol);
    // Right arm: draws the bowstring back toward chest
    drawArm(4,groundY-31-bob, 1,groundY-29-bob, headCol);
  } else if (tool==="hammer") {
    // Leather apron
    ctx.fillStyle="#3a200a"; ctx.fillRect(-4,groundY-30-bob,8,4);
    ctx.fillStyle="#4a2e10";
    ctx.beginPath(); ctx.moveTo(-5,groundY-28-bob); ctx.lineTo(5,groundY-28-bob); ctx.lineTo(6,groundY-14-bob); ctx.lineTo(-6,groundY-14-bob); ctx.fill();
    ctx.fillStyle="#5a3a16"; ctx.fillRect(-3,groundY-26-bob,6,2);
    // Work cap over head
    ctx.fillStyle="#5a3a18"; ctx.beginPath(); ctx.arc(0,groundY-39-bob,6,Math.PI,0); ctx.fill();
    ctx.fillStyle="#3e2610"; ctx.fillRect(-8,groundY-39-bob,16,3);
    // Left arm: resting at side
    drawArm(-5,groundY-31-bob, -7,groundY-20-bob, headCol);
    // Right arm: holds hammer handle
    drawArm(5,groundY-31-bob, 9,groundY-34-bob, headCol);
    // Hammer
    ctx.strokeStyle="#7a5a2a"; ctx.lineWidth=2.5; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(9,groundY-34-bob); ctx.lineTo(12,groundY-21-bob); ctx.stroke();
    ctx.lineCap="butt";
    ctx.fillStyle="#9a9aaa"; ctx.fillRect(6,groundY-36-bob,9,5);
    ctx.fillStyle="#aaaabc"; ctx.fillRect(6,groundY-36-bob,9,2);
  } else if (tool==="scythe") {
    // Left arm: upper grip on shaft
    drawArm(-5,groundY-32-bob, 5,groundY-30-bob, headCol);
    // Right arm: lower grip on shaft
    drawArm(5,groundY-28-bob, 8,groundY-22-bob, headCol);
    ctx.fillStyle="#c9a24a"; ctx.beginPath(); ctx.ellipse(0,groundY-42-bob,8,2.6,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(0,groundY-43-bob,4,Math.PI,0); ctx.fill();
    ctx.strokeStyle="#6a4a2a"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(7,groundY-34-bob); ctx.lineTo(9,groundY-16-bob); ctx.stroke();
    ctx.strokeStyle="#bdbdc6"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(9,groundY-34-bob,6,Math.PI*1.1,Math.PI*1.9); ctx.stroke();
  } else {
    // Default: arms hanging with gentle walk swing
    drawArm(-5,groundY-31-bob, -7+swing,groundY-19-bob, headCol);
    drawArm(5,groundY-31-bob,   7-swing,groundY-19-bob, headCol);
  }
  ctx.restore();
}

export function drawVagrants() {
  for (const v of state.vagrants) {
    if (spritesReady) {
      const tile = (Math.floor(v.x * 0.01) % 2 === 0) ? T.VAGRANT : T.VAGRANT2;
      const bob = Math.abs(v.vx) > 1 ? Math.abs(Math.sin(v.anim)) * 2 : 0;
      ctx.save();
      ctx.translate(v.x, 0);
      if (v.vx < 0) ctx.scale(-1, 1);
      spr(ctx, tile, 0, groundY - bob, 24, 28);
      ctx.restore();
    } else {
      drawHumanoid(v.x, v.anim, "#4a4438", "#9a8a6a", null, v.vx>=0?1:-1, Math.abs(v.vx)>1);
    }
  }
}

export function drawUnits() {
  for (const u of state.units) {
    let body="#3a3550", head="#caa483", tool=null, tile=T.PLAYER;
    if (u.role==="archer")  { body="#2f5040"; tool="bow";    tile=T.ARCHER; }
    else if (u.role==="builder") { body="#6a4a28"; tool="hammer"; tile=T.BUILDER; }
    else if (u.role==="farmer")  { body="#5a6a2a"; tool="scythe"; tile=T.FARMER; }
    else if (u.role==="guard")   { body="#3a4a5a"; head="#b09a7a"; tile=T.GUARD; }
    const wallLift = u.onWall && u.wall ? Math.max(0, wallHeight(u.wall) - 14) : 0;

    if (spritesReady) {
      const bob = u.moving ? Math.abs(Math.sin(u.anim)) * 2 : 0;
      ctx.save();
      if (wallLift > 0) { ctx.translate(0, -wallLift); ctx.globalAlpha = 0.98; }
      ctx.translate(u.x, 0);
      if (u.dir < 0) ctx.scale(-1, 1);
      spr(ctx, tile, 0, groundY - bob, 28, 32);
      ctx.restore();
    } else {
      ctx.save();
      if (wallLift > 0) { ctx.translate(0, -wallLift); ctx.globalAlpha = 0.98; }
      drawHumanoid(u.x, u.anim, body, head, tool, u.dir, u.moving);
      if (u.role==="guard") {
        const bob=u.moving?Math.abs(Math.sin(u.anim))*1.2:0;
        ctx.save(); ctx.translate(u.x,0); if (u.dir<0) ctx.scale(-1,1);
        ctx.fillStyle="#4a5060"; roundedRect(8,groundY-34-bob,10,16,3); ctx.fill();
        ctx.fillStyle="#f2c14e"; ctx.beginPath(); ctx.arc(13,groundY-28-bob,2.5,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle="#b0b8c8"; ctx.lineWidth=2; ctx.lineCap="round";
        ctx.beginPath(); ctx.moveTo(-8,groundY-14-bob); ctx.lineTo(-8,groundY-30-bob); ctx.stroke();
        ctx.strokeStyle="#8a6a30"; ctx.lineWidth=3;
        ctx.beginPath(); ctx.moveTo(-5,groundY-22-bob); ctx.lineTo(-11,groundY-22-bob); ctx.stroke();
        ctx.fillStyle="#4a5060"; ctx.beginPath(); ctx.arc(0,groundY-38-bob,6,Math.PI,0); ctx.fill();
        ctx.fillRect(-6,groundY-40-bob,12,3);
        ctx.restore();
      }
      ctx.restore();
    }

    if (u.transform>0) {
      const p=u.transform/0.55;
      ctx.save(); ctx.globalAlpha=p*0.7; ctx.globalCompositeOperation="lighter";
      const grd=ctx.createRadialGradient(u.x,groundY-28-wallLift,2,u.x,groundY-28-wallLift,28*p);
      grd.addColorStop(0,"#ffffff"); grd.addColorStop(0.4,"#9bd05a"); grd.addColorStop(1,"transparent");
      ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(u.x,groundY-28-wallLift,28*p,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    if (u.hp<u.maxHp) drawHpBar(u.x,groundY-46-wallLift,16,u.hp/u.maxHp,"#9bd05a");
  }
}

function drawLegendaryBody(e, t, dark, T) {
  const w=t.w, bob=Math.abs(Math.sin(e.anim*1.4))*4;
  const windupFrac = e.specialPhase===1 ? Math.max(0,1-(e.specialTimer/(t.windupTime||1))) : 0;
  const flashCol = e.flash>0?"#ffffff":t.color;
  const isLegend2 = e.type==="legend2", isLegend3 = e.type==="legend3";

  // Ground shadow
  ctx.save(); ctx.globalAlpha=0.25; ctx.fillStyle="#000";
  ctx.beginPath(); ctx.ellipse(0,groundY-2,w*0.7,10,0,0,Math.PI*2); ctx.fill(); ctx.restore();

  // Pulsing outer aura
  ctx.save(); ctx.globalCompositeOperation="lighter";
  const aR=w*(1.35+0.14*Math.sin(T*1.7)+windupFrac*0.5);
  const ag=ctx.createRadialGradient(0,groundY-w*0.4,10,0,groundY-w*0.4,aR);
  ag.addColorStop(0,t.eye); ag.addColorStop(0.55,withA(t.eye,0.22)); ag.addColorStop(1,"rgba(0,0,0,0)");
  ctx.globalAlpha=0.2+0.1*Math.sin(T*1.5)+windupFrac*0.35;
  ctx.fillStyle=ag; ctx.beginPath(); ctx.ellipse(0,groundY-w*0.4,aR,aR*0.6,0,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // Legs (large)
  const s=Math.sin(e.anim*3), lw=Math.max(4,w*0.095);
  ctx.strokeStyle=flashCol; ctx.lineWidth=lw; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(-w*0.22,groundY-14-bob); ctx.lineTo(-w*0.22+s*8,groundY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*0.22,groundY-14-bob);  ctx.lineTo(w*0.22-s*8,groundY); ctx.stroke();
  ctx.lineCap="butt";

  // Arms (raised during windup)
  const armLift = windupFrac * 50;
  ctx.fillStyle=flashCol;
  ctx.beginPath(); ctx.moveTo(-w*0.5,groundY-w*0.6-bob); ctx.lineTo(-w*0.95,groundY-w*0.82-bob-armLift); ctx.lineTo(-w*0.72,groundY-w*0.38-bob); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w*0.5,groundY-w*0.6-bob);  ctx.lineTo(w*0.95,groundY-w*0.82-bob-armLift);  ctx.lineTo(w*0.72,groundY-w*0.38-bob);  ctx.closePath(); ctx.fill();

  // Body
  ctx.fillStyle=flashCol;
  roundedRect(-w/2,groundY-w-10-bob,w,w+10,w*0.28); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,0.05)"; roundedRect(-w/2,groundY-w-10-bob,w*0.28,w+10,w*0.28); ctx.fill();

  // Legend3: spinning void rings on body
  if (isLegend3) {
    ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.strokeStyle=t.eye; ctx.lineWidth=3;
    ctx.globalAlpha=0.38; ctx.beginPath(); ctx.ellipse(0,groundY-w*0.45-bob,w*0.68,w*0.27,T*0.65,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=0.22; ctx.beginPath(); ctx.ellipse(0,groundY-w*0.45-bob,w*0.88,w*0.34,-T*0.42,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }
  // Legend2: ice shards at base
  if (isLegend2) {
    ctx.save(); ctx.fillStyle=t.eye; ctx.globalAlpha=0.55;
    for (let ci=0;ci<5;ci++) { const cx=(ci/4-0.5)*w*0.9, ch=18+Math.sin(T*2+ci)*7; ctx.beginPath(); ctx.moveTo(cx-5,groundY); ctx.lineTo(cx,groundY-ch); ctx.lineTo(cx+5,groundY); ctx.fill(); }
    ctx.restore();
  }

  // Horns
  const hornCt = isLegend3?9:isLegend2?5:7;
  ctx.fillStyle=flashCol;
  for (let hi=0;hi<hornCt;hi++) {
    const hfrac=hi/(hornCt-1), hx=(hfrac-0.5)*w*0.94;
    const mid=Math.abs(hi-Math.floor(hornCt/2))<1.5;
    const hh=hi%2===0?40:24+(mid?16:0);
    ctx.beginPath(); ctx.moveTo(hx-5,groundY-w-8-bob); ctx.lineTo(hx,groundY-w-8-hh-bob); ctx.lineTo(hx+5,groundY-w-8-bob); ctx.fill();
  }

  // Eyes
  const eyeRows = isLegend3?3:isLegend2?2:1;
  for (let ei=0;ei<eyeRows;ei++) {
    const ey=groundY-w*(0.62-ei*0.2)-bob;
    ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.6+0.28*Math.sin(T*3+ei*2); ctx.fillStyle=t.eye;
    ctx.beginPath(); ctx.ellipse(-w*0.14,ey,w*0.13,w*0.08,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w*0.14,ey,w*0.13,w*0.08,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.fillStyle=t.eye;
    ctx.beginPath(); ctx.arc(-w*0.14,ey,w*0.045,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(w*0.14,ey,w*0.045,0,Math.PI*2); ctx.fill();
  }

  // Rune lines
  ctx.save(); ctx.globalAlpha=0.28+0.12*Math.sin(T*2.2); ctx.strokeStyle=t.eye; ctx.lineWidth=2;
  for (let ri=0;ri<4;ri++) {
    const ry=groundY-w*(0.18+ri*0.18)-bob;
    ctx.beginPath(); ctx.moveTo(-w*0.35,ry); ctx.lineTo(w*0.35,ry); ctx.stroke();
    if (ri%2===0) { ctx.beginPath(); ctx.moveTo(-w*0.25,ry-5); ctx.lineTo(-w*0.12,ry+5); ctx.moveTo(w*0.25,ry-5); ctx.lineTo(w*0.12,ry+5); ctx.stroke(); }
  }
  ctx.restore();
}

export function drawLegendaryEffects() {
  for (const ef of state.legendaryEffects) {
    if (ef.type !== "ring") continue;
    const alpha = Math.max(0, ef.life / ef.totalLife);
    ctx.save();
    ctx.globalAlpha = alpha * 0.75;
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = ef.col;
    ctx.lineWidth = (ef.width || 8) * alpha;
    ctx.beginPath();
    ctx.ellipse(ef.x, groundY - 6, ef.radius, ef.radius * 0.25, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.2;
    ctx.fillStyle = ef.col;
    ctx.beginPath();
    ctx.ellipse(ef.x, groundY - 6, ef.radius, ef.radius * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawEnemies(dark) {
  for (const e of state.enemies) {
    const t=ENEMY_TYPES[e.type];
    const drawYOff = e.fy || 0;
    const isLegend = t.legendary === true;
    const bossT = performance.now()/1000;

    const w=t.w, bob=Math.abs(Math.sin(e.anim*2))*2;
    const isBoss = e.type==="boss1"||e.type==="boss2"||e.type==="boss3"||e.type==="boss4";
    ctx.save(); ctx.translate(e.x, drawYOff); if (e.dir<0) ctx.scale(-1,1);
    if (isLegend) {
      drawLegendaryBody(e, t, dark, bossT);
    } else if (spritesReady) {
      const ETILE = {
        imp:T.IMP, runner:T.RUNNER, wraith:T.WRAITH, crawler:T.CRAWLER,
        raider:T.RAIDER, brute:T.BRUTE, ogre:T.OGRE, demon:T.DEMON,
        flier:T.FLIER, necro:T.NECRO,
        boss1:T.BOSS1, boss2:T.BOSS2, boss3:T.BOSS3, boss4:T.BOSS4,
      };
      const tile = ETILE[e.type] || T.IMP;
      const sh = Math.round(w * 1.35);

      // Boss pulsing aura
      if (isBoss) {
        ctx.save(); ctx.globalCompositeOperation="lighter";
        const aura=0.22+0.1*Math.sin(bossT*2+e.x); ctx.globalAlpha=aura;
        const ag=ctx.createRadialGradient(0,groundY-w*0.5,4,0,groundY-w*0.5,w*1.5);
        ag.addColorStop(0,t.eye); ag.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=ag; ctx.beginPath(); ctx.ellipse(0,groundY-w*0.5,w*1.5,w*0.9,0,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }

      // Sprite body
      spr(ctx, tile, 0, groundY - bob, w, sh);

      // White hit-flash overlay
      if (e.flash > 0) {
        ctx.save(); ctx.globalCompositeOperation="lighter";
        ctx.globalAlpha = Math.min(e.flash * 4, 0.85);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-w/2, groundY - bob - sh, w, sh);
        ctx.restore();
      }

      // Flying wings (keep visual for flier)
      if (t.flying) {
        ctx.fillStyle = withA(t.color, 0.55);
        const wingFlap = Math.sin(e.anim*4)*10;
        ctx.beginPath(); ctx.moveTo(-w*0.5,groundY-sh*0.6-bob); ctx.lineTo(-w*1.9,groundY-sh*0.6-bob-wingFlap); ctx.lineTo(-w*0.5,groundY-sh*0.3-bob); ctx.fill();
        ctx.beginPath(); ctx.moveTo(w*0.5,groundY-sh*0.6-bob); ctx.lineTo(w*1.9,groundY-sh*0.6-bob+wingFlap); ctx.lineTo(w*0.5,groundY-sh*0.3-bob); ctx.fill();
      }

      // Gold carry indicator
      if (e.carry>0) { ctx.fillStyle="#f2c14e"; ctx.beginPath(); ctx.arc(0,groundY-sh-4-bob,4,0,Math.PI*2); ctx.fill(); }
    } else {
      // ── Fallback programmatic drawing ──────────────────────────
      const s=Math.sin(e.anim*3);
      ctx.strokeStyle=e.flash>0?"#fff":t.color; ctx.lineWidth=Math.max(2,w*0.12); ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(-w*0.25,groundY-8-bob); ctx.lineTo(-w*0.25+s*5,groundY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w*0.25,groundY-8-bob); ctx.lineTo(w*0.25-s*5,groundY); ctx.stroke();
      ctx.lineCap="butt";
      if (isBoss) {
        ctx.save(); ctx.globalCompositeOperation="lighter";
        const aura=0.18+0.08*Math.sin(bossT*2+e.x); ctx.globalAlpha=aura;
        const ag=ctx.createRadialGradient(0,groundY-w*0.5,4,0,groundY-w*0.5,w*1.4);
        ag.addColorStop(0,t.eye); ag.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=ag; ctx.beginPath(); ctx.ellipse(0,groundY-w*0.5,w*1.4,w,0,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle=e.flash>0?"#ffffff":t.color;
      roundedRect(-w/2,groundY-w-6-bob,w,w+6,w*0.4); ctx.fill();
      if (e.type==="brute"||isBoss) {
        ctx.fillStyle=e.flash>0?"#fff":t.color;
        for (let i=-1;i<=1;i++) { const sx=i*w*0.28; ctx.beginPath(); ctx.moveTo(sx-3,groundY-w-2-bob); ctx.lineTo(sx,groundY-w-(isBoss?18:13)-bob); ctx.lineTo(sx+3,groundY-w-2-bob); ctx.fill(); }
      }
      ctx.fillStyle="rgba(255,255,255,0.06)"; roundedRect(-w/2,groundY-w-6-bob,w*0.34,w+6,w*0.4); ctx.fill();
      const ex=w*0.12, ex2=w*0.32, ey=groundY-w*0.6-bob;
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.4+0.35*dark+(isBoss?0.3:0); ctx.fillStyle=t.eye;
      ctx.beginPath(); ctx.arc(ex,ey,w*(isBoss?0.28:0.22),0,Math.PI*2); ctx.arc(ex2,ey,w*(isBoss?0.28:0.22),0,Math.PI*2); ctx.fill(); ctx.restore();
      ctx.fillStyle=t.eye; ctx.beginPath(); ctx.arc(ex,ey,w*0.09,0,Math.PI*2); ctx.arc(ex2,ey,w*0.09,0,Math.PI*2); ctx.fill();
      if (e.carry>0) { ctx.fillStyle="#f2c14e"; ctx.beginPath(); ctx.arc(0,groundY-w-12-bob,4,0,Math.PI*2); ctx.fill(); }
      if (t.flying) {
        ctx.fillStyle=withA(t.color, 0.7);
        const wingFlap=Math.sin(e.anim*4)*8;
        ctx.beginPath(); ctx.moveTo(-w*0.5,groundY-w*0.5-bob); ctx.lineTo(-w*1.8,groundY-w*0.5-bob-wingFlap); ctx.lineTo(-w*0.5,groundY-w*0.1-bob); ctx.fill();
        ctx.beginPath(); ctx.moveTo(w*0.5,groundY-w*0.5-bob); ctx.lineTo(w*1.8,groundY-w*0.5-bob+wingFlap); ctx.lineTo(w*0.5,groundY-w*0.1-bob); ctx.fill();
      }
    } // end else (programmatic fallback)
    ctx.restore();

    if (isLegend) {
      // Legend HP bar spans full width
      drawHpBar(e.x, groundY+drawYOff-t.w-28, t.w*0.85, e.hp/e.maxHp, "#ff2040");
      const T2=bossT;
      ctx.save(); ctx.textAlign="center";
      ctx.font="bold 15px Trebuchet MS";
      ctx.fillStyle="rgba(0,0,0,0.85)"; ctx.fillText(t.name, e.x+1, groundY+drawYOff-t.w-42);
      ctx.fillStyle=t.eye; ctx.fillText(t.name, e.x, groundY+drawYOff-t.w-43);
      ctx.font="11px Trebuchet MS";
      ctx.globalAlpha=0.65+0.25*Math.sin(T2*3);
      ctx.fillStyle="#f2c14e"; ctx.fillText("⚔ LEGENDARISK BOSS ⚔", e.x, groundY+drawYOff-t.w-58);
      ctx.restore();
      continue;
    }

    const sprH = spritesReady ? Math.round(t.w*1.35) : t.w;
    if (e.hp<e.maxHp) drawHpBar(e.x,groundY+drawYOff-sprH-4,t.w+(isBoss?12:4),e.hp/e.maxHp,isBoss?"#ff4080":"#d05a5a");
    if (isBoss) {
      ctx.save(); ctx.font="bold 12px Trebuchet MS"; ctx.textAlign="center";
      ctx.fillStyle="rgba(0,0,0,0.7)"; ctx.fillText(t.name||e.type, e.x+1, groundY+drawYOff-sprH-18);
      ctx.fillStyle=t.eye; ctx.fillText(t.name||e.type, e.x, groundY+drawYOff-sprH-19); ctx.restore();
    }
  }
}

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
  // Glow bloom
  ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=prog*arc.a*0.5;
  ctx.strokeStyle=arc.glow; ctx.lineWidth=arc.sw*3;
  ctx.beginPath(); ctx.arc(0,baseY,arc.r,startA,sweepEnd); ctx.stroke();
  ctx.restore();
  // Core arc
  ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=prog*arc.a;
  ctx.strokeStyle=arc.col; ctx.lineWidth=arc.sw; ctx.lineCap="round";
  ctx.beginPath(); ctx.arc(0,baseY,arc.r,startA,sweepEnd); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

export function drawPlayer(dark) {
  const { player } = state;
  const x=player.x, bob=player.bob, gallop=player.gallop;
  drawWeaponSwingArc(x, player);
  drawFocusHalo(x, groundY-36-bob-player.jumpH, 92, 52, [255,210,110], 0.11+0.12*dark);
  ctx.save();
  if (player.invuln>0&&Math.floor(player.invuln*12)%2===0) ctx.globalAlpha=0.45;
  ctx.translate(x, -bob - player.jumpH);
  if (player.dir<0) ctx.scale(-1,1);
  const px=0;

  if (spritesReady) {
    // Sprite body — 48×56 px
    spr(ctx, T.PLAYER, px, groundY, 48, 56);
    // Crown overlay
    if (player.hasCrown) {
      ctx.fillStyle="#f2c14e";
      ctx.beginPath();
      ctx.moveTo(px-6,groundY-55); ctx.lineTo(px-6,groundY-62); ctx.lineTo(px-2,groundY-58);
      ctx.lineTo(px+2,groundY-63); ctx.lineTo(px+6,groundY-58); ctx.lineTo(px+10,groundY-62);
      ctx.lineTo(px+10,groundY-55); ctx.closePath(); ctx.fill();
    }
  } else {
    // ── Fallback programmatic drawing ──────────────────────────
    const moving=Math.abs(player.vx)>1, s=moving?Math.sin(gallop*2):0;
    ctx.fillStyle="#2a2230"; ctx.strokeStyle="#2a2230"; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(px-14,groundY-26+bob); ctx.lineTo(px-14+s*8,groundY+bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px+12,groundY-26+bob); ctx.lineTo(px+12-s*8,groundY+bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px-8,groundY-26+bob); ctx.lineTo(px-8-s*8,groundY+bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px+18,groundY-26+bob); ctx.lineTo(px+18+s*8,groundY+bob); ctx.stroke();
    roundedRect(px-20,groundY-46,44,22,10); ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.08)"; roundedRect(px-17,groundY-44,18,7,5); ctx.fill();
    ctx.fillStyle="#5f3b28"; roundedRect(px-8,groundY-50,18,8,4); ctx.fill();
    ctx.fillStyle="#d1a75a"; ctx.fillRect(px-5,groundY-52,11,2);
    ctx.beginPath(); ctx.moveTo(px+18,groundY-44); ctx.lineTo(px+30,groundY-64); ctx.lineTo(px+40,groundY-62); ctx.lineTo(px+38,groundY-52); ctx.lineTo(px+26,groundY-40); ctx.closePath(); ctx.fill();
    const tail=windSway(px,4)+Math.sin(gallop)*2;
    ctx.beginPath(); ctx.moveTo(px-20,groundY-44); ctx.quadraticCurveTo(px-34-tail,groundY-40,px-30-tail,groundY-22); ctx.lineTo(px-24-tail*0.6,groundY-30); ctx.quadraticCurveTo(px-26,groundY-40,px-18,groundY-40); ctx.fill();
    ctx.strokeStyle="#1c1622"; ctx.lineWidth=2;
    for (let i=0;i<4;i++) { const tt=i/3, mx=lerp(px+20,px+33,tt), my=lerp(groundY-46,groundY-62,tt); ctx.beginPath(); ctx.moveTo(mx,my); ctx.lineTo(mx-4,my-3); ctx.stroke(); }
    ctx.fillStyle="#f2c14e"; ctx.beginPath(); ctx.arc(px+34,groundY-58,1.4,0,Math.PI*2); ctx.fill();
    const cape=(moving?Math.sin(gallop*2)*4:0)+windSway(px,3);
    ctx.fillStyle="#5a182e"; ctx.beginPath(); ctx.moveTo(px-4,groundY-66); ctx.quadraticCurveTo(px-16-cape,groundY-52,px-22-cape*1.4,groundY-32); ctx.lineTo(px-8,groundY-40); ctx.quadraticCurveTo(px-6,groundY-54,px+2,groundY-64); ctx.fill();
    ctx.fillStyle="#7a2440"; roundedRect(px-6,groundY-70,16,26,6); ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.12)"; roundedRect(px-4,groundY-68,4,18,3); ctx.fill();
    ctx.fillStyle="rgba(0,0,0,0.18)"; roundedRect(px+4,groundY-70,6,26,4); ctx.fill();
    ctx.fillStyle="#caa483"; ctx.beginPath(); ctx.arc(px+2,groundY-74,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#3a2e2a"; ctx.beginPath(); ctx.arc(px+4,groundY-75,1.1,0,Math.PI*2); ctx.fill();
    if (player.hasCrown) {
      ctx.fillStyle="#f2c14e"; ctx.beginPath();
      ctx.moveTo(px-4,groundY-80); ctx.lineTo(px-4,groundY-86); ctx.lineTo(px-1,groundY-82);
      ctx.lineTo(px+2,groundY-87); ctx.lineTo(px+5,groundY-82); ctx.lineTo(px+8,groundY-86); ctx.lineTo(px+8,groundY-80); ctx.closePath(); ctx.fill();
    }
  }

  // ── Weapon (drawn over sprite or fallback body) ──────────────
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

export function drawAnimals() {
  for (const a of state.animals) {
    if (!a.alive) continue;
    ctx.save(); ctx.translate(a.x,0); if (a.vx<0) ctx.scale(-1,1);
    const col=a.type==="deer"?"#6a4a2a":"#8a7a6a";
    ctx.fillStyle=col;
    const sz=a.type==="deer"?1.5:1;
    legs(0,groundY-8*sz,a.anim*1.5,4,col);
    roundedRect(-9*sz,groundY-18*sz,18*sz,12*sz,5); ctx.fill();
    ctx.beginPath(); ctx.arc(8*sz,groundY-20*sz,4*sz,0,Math.PI*2); ctx.fill();
    if (a.type==="deer") { ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(8*sz,groundY-24*sz); ctx.lineTo(6*sz,groundY-30*sz); ctx.moveTo(10*sz,groundY-24*sz); ctx.lineTo(12*sz,groundY-30*sz); ctx.stroke(); }
    ctx.restore();
  }
}

export function drawArrows() {
  const t = performance.now() / 1000;
  for (const ar of state.arrows) {
    const ang=Math.atan2(ar.vy,ar.vx);
    ctx.save(); ctx.translate(ar.x,ar.y); ctx.rotate(ang);
    const wid = ar.weaponId;
    if (wid === "dark_bow") {
      // Mørk pil med lilla glød og skygge-fjer
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.55;
      const dg=ctx.createRadialGradient(0,0,1,0,0,12);
      dg.addColorStop(0,"rgba(180,80,255,0.8)"); dg.addColorStop(1,"rgba(40,0,80,0)");
      ctx.fillStyle=dg; ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill(); ctx.restore();
      ctx.strokeStyle="#220033"; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(-22,0); ctx.lineTo(6,0); ctx.stroke();
      ctx.fillStyle="#9933cc"; ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(1,-3); ctx.lineTo(1,3); ctx.fill();
      // Skygge-fjer
      ctx.save(); ctx.globalAlpha=0.7; ctx.strokeStyle="#aa44ff"; ctx.lineWidth=1.5;
      for (let k=0;k<3;k++) { const bx=-8-k*4; ctx.beginPath(); ctx.moveTo(bx,0); ctx.lineTo(bx-4,-4); ctx.moveTo(bx,0); ctx.lineTo(bx-4,4); ctx.stroke(); } ctx.restore();
    } else if (wid === "void_bow") {
      // Lilla neon void-pil med distortion
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.7;
      const vg=ctx.createRadialGradient(0,0,2,0,0,14);
      vg.addColorStop(0,"rgba(160,60,255,0.9)"); vg.addColorStop(1,"rgba(60,0,140,0)");
      ctx.fillStyle=vg; ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=0.4*(0.7+0.3*Math.sin(t*18));
      const vg2=ctx.createRadialGradient(0,0,4,0,0,22);
      vg2.addColorStop(0,"rgba(255,180,255,0.5)"); vg2.addColorStop(1,"rgba(80,0,160,0)");
      ctx.fillStyle=vg2; ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.fill(); ctx.restore();
      ctx.strokeStyle="#dd99ff"; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.moveTo(-20,0); ctx.lineTo(7,0); ctx.stroke();
      ctx.fillStyle="#ffffff"; ctx.beginPath(); ctx.arc(7,0,2.5,0,Math.PI*2); ctx.fill();
    } else if (wid === "dragons_bow") {
      // Drage-ildpil — stor, orange/rød ildkugle
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.8;
      const frg=ctx.createRadialGradient(2,0,2,2,0,18);
      frg.addColorStop(0,"rgba(255,220,100,1)"); frg.addColorStop(0.4,"rgba(255,100,20,0.8)"); frg.addColorStop(1,"rgba(200,40,0,0)");
      ctx.fillStyle=frg; ctx.beginPath(); ctx.arc(2,0,18,0,Math.PI*2); ctx.fill();
      const flk=0.8+0.2*Math.sin(t*25); ctx.globalAlpha=0.5*flk;
      ctx.fillStyle="rgba(255,240,160,0.6)"; ctx.beginPath(); ctx.arc(2,0,10,0,Math.PI*2); ctx.fill(); ctx.restore();
      ctx.strokeStyle="#cc4400"; ctx.lineWidth=3.5;
      ctx.beginPath(); ctx.moveTo(-18,0); ctx.lineTo(5,0); ctx.stroke();
      ctx.fillStyle="#ffaa40"; ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(2,-4); ctx.lineTo(2,4); ctx.fill();
      // Ild-tænder langs skaftet
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.45;
      ctx.strokeStyle="#ff8820"; ctx.lineWidth=1;
      for (let k=0;k<4;k++) { const bx=-5-k*4; const fl=Math.sin(t*20+k)*3; ctx.beginPath(); ctx.moveTo(bx,0); ctx.lineTo(bx-2,-4+fl); ctx.stroke(); } ctx.restore();
    } else {
      // Standard pil
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.28;
      ctx.strokeStyle="#f2c14e"; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(-18,0); ctx.lineTo(3,0); ctx.stroke(); ctx.restore();
      ctx.strokeStyle="#e8d8a8"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(-7,0); ctx.lineTo(5,0); ctx.stroke();
      ctx.fillStyle="#e8d8a8"; ctx.beginPath(); ctx.moveTo(5,0); ctx.lineTo(1,-2); ctx.lineTo(1,2); ctx.fill();
    }
    ctx.restore();
  }
}

export function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha=p.fly?1:clamp(p.life*1.5,0,1);
    if (!p.fly && p.life>0.12) {
      ctx.save();
      ctx.globalCompositeOperation="lighter";
      ctx.globalAlpha=clamp(p.life,0,1)*0.18;
      ctx.fillStyle=p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size*2.2,0,Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.globalAlpha=p.fly?1:clamp(p.life*1.5,0,1);
    }
    ctx.fillStyle=p.color; ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
  }
  ctx.globalAlpha=1;
}

export function drawFloats() {
  ctx.textAlign="center";
  for (const f of state.floatTexts) {
    ctx.globalAlpha=clamp(f.life,0,1); ctx.font="bold 15px Trebuchet MS";
    ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillText(f.text,f.x+1,f.y+1);
    ctx.fillStyle=f.color; ctx.fillText(f.text,f.x,f.y);
  }
  ctx.globalAlpha=1;
}

export function drawCampLight(dark) {
  const { base } = state;
  drawFocusHalo(base.x, groundY-24, 170, 68, [255,158,70], 0.08+0.14*Math.max(dark,Game.isNight?1:0));
  for (const s of FX.smoke) { const k=s.t/s.life; ctx.globalAlpha=(1-k)*0.16; ctx.fillStyle="rgba(58,54,58,1)"; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill(); }
  ctx.globalAlpha=1;
  const warm=Math.max(0.22,dark,Game.isNight?0.55:0)*0.95;
  if (warm>0.05) {
    ctx.save(); ctx.globalCompositeOperation="lighter";
    const fl=FX.flicker, R=240*fl;
    const g=ctx.createRadialGradient(base.x,groundY-30,10,base.x,groundY-30,R);
    g.addColorStop(0,`rgba(255,172,72,${0.34*warm*fl})`); g.addColorStop(1,"rgba(255,120,40,0)");
    ctx.fillStyle=g; ctx.fillRect(base.x-R,groundY-30-R,R*2,R*2); ctx.restore();
  }
  ctx.save(); ctx.globalCompositeOperation="lighter";
  for (const e of FX.embers) { const k=e.t/e.life; ctx.globalAlpha=1-k; ctx.fillStyle=`rgba(255,${(170-90*k)|0},60,1)`; ctx.fillRect(e.x,e.y,e.s,e.s); }
  ctx.restore(); ctx.globalAlpha=1;
}

// ---------- Location drawings ----------
const LOC_DRAWERS = {
  camp(x, dark) {
    ctx.fillStyle=rgb(lerpColor([52,44,36],[16,14,18],dark)); ctx.beginPath(); ctx.ellipse(x,groundY-2,10,4,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=rgb(lerpColor([72,64,54],[20,18,22],dark)); ctx.beginPath(); ctx.ellipse(x,groundY-3,5.5,2,0,0,Math.PI*2); ctx.fill();
    const tc1=rgb(lerpColor([64,44,28],[18,12,8],dark));
    ctx.fillStyle=tc1; ctx.beginPath(); ctx.moveTo(x-36,groundY-34); ctx.lineTo(x-60,groundY); ctx.lineTo(x-14,groundY); ctx.closePath(); ctx.fill();
    ctx.fillStyle="rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.moveTo(x-36,groundY-34); ctx.lineTo(x-14,groundY); ctx.lineTo(x-26,groundY); ctx.closePath(); ctx.fill();
    ctx.fillStyle=rgb(lerpColor([48,34,20],[14,10,6],dark)); ctx.beginPath(); ctx.moveTo(x+44,groundY-28); ctx.lineTo(x+22,groundY); ctx.lineTo(x+64,groundY); ctx.closePath(); ctx.fill();
    ctx.fillStyle="rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.moveTo(x+44,groundY-28); ctx.lineTo(x+64,groundY); ctx.lineTo(x+52,groundY); ctx.closePath(); ctx.fill();
    ctx.fillStyle=woodCol(dark); ctx.fillRect(x+68,groundY-14,14,14); ctx.fillRect(x+82,groundY-10,10,10);
  },
  wagon(x, dark) {
    ctx.save(); ctx.translate(x,groundY-10); ctx.rotate(0.32);
    ctx.fillStyle=woodCol(dark); ctx.fillRect(-32,-12,64,22);
    ctx.strokeStyle=rgb(lerpColor([56,40,22],[14,10,6],dark)); ctx.lineWidth=2; ctx.strokeRect(-32,-12,64,22);
    ctx.strokeStyle=rgb(lerpColor([72,52,30],[20,14,8],dark)); ctx.lineWidth=1;
    for (let i=-3;i<=3;i++) { ctx.beginPath(); ctx.moveTo(i*9,-12); ctx.lineTo(i*9,10); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle=woodCol(dark); ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(x-38,groundY+4,14,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x+24,groundY-8,12,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle=woodCol(dark); ctx.fillRect(x+50,groundY-10,13,12);
  },
  grave(x, dark) {
    ctx.fillStyle=stoneCol(dark); ctx.fillRect(x-8,groundY-36,16,36);
    ctx.beginPath(); ctx.arc(x,groundY-36,8,Math.PI,0); ctx.fill();
    ctx.strokeStyle=stoneLt(dark); ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(x,groundY-32); ctx.lineTo(x,groundY-18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x-5,groundY-26); ctx.lineTo(x+5,groundY-26); ctx.stroke();
    const boneC=rgb(lerpColor([192,184,172],[56,52,48],dark)); ctx.fillStyle=boneC;
    ctx.beginPath(); ctx.ellipse(x-22,groundY-2,7,3,0.3,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x+18,groundY-1,5,2.5,-0.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=rgb(lerpColor([74,104,64],[20,30,18],dark)); ctx.beginPath(); ctx.ellipse(x,groundY-33,5,2,0,0,Math.PI*2); ctx.fill();
  },
  ruins(x, dark) {
    const c=stoneCol(dark), l=stoneLt(dark);
    const col=(cx,h,broken)=>{
      ctx.fillStyle=c; ctx.fillRect(cx-7,groundY-h,14,h); ctx.fillStyle=l; ctx.fillRect(cx-7,groundY-h,4,h);
      if (!broken) { ctx.fillStyle=c; ctx.fillRect(cx-10,groundY-h-6,20,6); }
      else { ctx.fillStyle=c; ctx.fillRect(cx-5,groundY-h-4,10,4); ctx.beginPath(); ctx.moveTo(cx-8,groundY-h); ctx.lineTo(cx+10,groundY-h-8); ctx.lineTo(cx+12,groundY-h+2); ctx.closePath(); ctx.fill(); }
    };
    col(x-58,66,true); col(x-24,82,false); col(x+22,70,true); col(x+56,58,false);
    ctx.fillStyle=c; for (const ox of [-42,-12,10,36]) { ctx.beginPath(); ctx.ellipse(x+ox,groundY-3,5+Math.abs(ox%7),3,0,0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle=rgb(lerpColor([74,104,64],[20,30,18],dark)); for (const ox of [-30,12,44]) { ctx.beginPath(); ctx.ellipse(x+ox,groundY-3,8,3,0,0,Math.PI*2); ctx.fill(); }
  },
  cave(x, dark) {
    ctx.fillStyle=rgb(lerpColor([42,38,48],[14,12,18],dark)); ctx.beginPath(); ctx.moveTo(x-88,groundY); ctx.quadraticCurveTo(x,groundY-96,x+88,groundY); ctx.closePath(); ctx.fill();
    ctx.fillStyle="#080410"; ctx.beginPath(); ctx.ellipse(x,groundY-26,26,34,0,Math.PI,0); ctx.fill();
    const ig=ctx.createRadialGradient(x,groundY-18,2,x,groundY-22,26); ig.addColorStop(0,"rgba(0,0,0,0.95)"); ig.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=ig; ctx.beginPath(); ctx.ellipse(x,groundY-26,26,34,0,Math.PI,0); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation="lighter"; const eg=0.45+dark*0.45;
    ctx.fillStyle=`rgba(255,60,60,${eg*0.65})`; ctx.beginPath(); ctx.arc(x-9,groundY-36,3,0,Math.PI*2); ctx.arc(x+7,groundY-36,3,0,Math.PI*2); ctx.fill(); ctx.restore();
    const bc=rgb(lerpColor([180,172,160],[52,48,44],dark)); ctx.fillStyle=bc;
    ctx.beginPath(); ctx.ellipse(x-40,groundY-2,8,3,0.2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x+34,groundY-1,6,2.5,-0.3,0,Math.PI*2); ctx.fill();
  },
  battlefield(x, dark) {
    const wd=woodCol(dark), mt=stoneCol(dark);
    const banner=(bx,lean)=>{ ctx.strokeStyle=wd; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(bx,groundY); ctx.lineTo(bx+lean,groundY-62); ctx.stroke(); ctx.fillStyle=rgb(lerpColor([90,30,30],[28,10,10],dark)); ctx.beginPath(); ctx.moveTo(bx+lean,groundY-62); ctx.lineTo(bx+lean+18,groundY-54); ctx.lineTo(bx+lean+12,groundY-44); ctx.lineTo(bx+lean,groundY-44); ctx.fill(); };
    banner(x-68,-8); banner(x+42,6);
    const sword=(sx,ang)=>{ ctx.save(); ctx.translate(sx,groundY); ctx.rotate(ang); ctx.strokeStyle=mt; ctx.lineWidth=2.5; ctx.lineCap="round"; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-30); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-5,-22); ctx.lineTo(5,-22); ctx.stroke(); ctx.restore(); };
    sword(x-36,-0.2); sword(x-8,0.15); sword(x+20,-0.1); sword(x+50,0.22);
    ctx.fillStyle=mt; ctx.beginPath(); ctx.ellipse(x-56,groundY-4,10,7,0.3,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=stoneLt(dark); ctx.lineWidth=1; ctx.beginPath(); ctx.ellipse(x-56,groundY-4,10,7,0.3,0,Math.PI*2); ctx.stroke();
  },
  watchtower(x, dark) {
    const c=stoneCol(dark), l=stoneLt(dark), tw=38;
    ctx.fillStyle=c; ctx.fillRect(x-tw/2,groundY-112,tw,112);
    ctx.fillStyle=l; ctx.fillRect(x-tw/2,groundY-112,tw*0.28,112);
    ctx.fillStyle="rgba(0,0,0,0.18)"; ctx.fillRect(x+tw*0.28,groundY-112,tw*0.22,112);
    ctx.fillStyle=c; ctx.beginPath(); ctx.moveTo(x-tw/2,groundY-112); ctx.lineTo(x+4,groundY-112); ctx.lineTo(x+10,groundY-88); ctx.lineTo(x-tw/2,groundY-88); ctx.closePath(); ctx.fill();
    for (const ox of [-28,-14,10,26]) { ctx.fillStyle=c; ctx.beginPath(); ctx.ellipse(x+ox+tw*0.5,groundY-4,6+Math.abs(ox%5),3.5,0,0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle=c; for (let i=0;i<2;i++) ctx.fillRect(x-tw/2+i*(tw*0.4),groundY-120,tw*0.18,9);
    ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillRect(x-4,groundY-74,8,12);
    ctx.strokeStyle=woodCol(dark); ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(x+tw/2,groundY); ctx.lineTo(x+tw/2+22,groundY-36); ctx.stroke();
    for (let i=0;i<4;i++) { const yy=groundY-i*9,xx=x+tw/2+i*6; ctx.beginPath(); ctx.moveTo(xx,yy); ctx.lineTo(xx+9,yy-4); ctx.stroke(); }
    if (dark>0.2) drawTorch(x-tw/2-6,groundY-58);
    ctx.fillStyle=woodCol(dark); ctx.fillRect(x-tw/2-18,groundY-14,16,13);
    ctx.strokeStyle=stoneLt(dark); ctx.lineWidth=1.5; ctx.strokeRect(x-tw/2-18,groundY-14,16,13);
    ctx.beginPath(); ctx.moveTo(x-tw/2-18,groundY-7); ctx.lineTo(x-tw/2-2,groundY-7); ctx.stroke();
  },
  altar(x, dark) {
    const c=stoneCol(dark);
    const stones=[[-62,0,8,28],[-46,-5,7,22],[20,-5,7,22],[36,0,8,28],[-8,-10,10,36],[14,0,8,20]];
    for (const [ox,dy,w,h] of stones) { ctx.fillStyle=c; ctx.fillRect(x+ox-w/2,groundY-h+dy,w,h-dy); }
    ctx.fillStyle=rgb(lerpColor([76,70,84],[20,18,24],dark)); ctx.fillRect(x-18,groundY-12,36,12);
    const ga=0.22+0.14*Math.sin(Game.windT*2.3);
    ctx.save(); ctx.globalCompositeOperation="lighter";
    const gr=ctx.createRadialGradient(x,groundY-8,4,x,groundY-8,56); gr.addColorStop(0,`rgba(100,140,255,${ga*2})`); gr.addColorStop(1,"rgba(60,80,255,0)");
    ctx.fillStyle=gr; ctx.beginPath(); ctx.ellipse(x,groundY-8,56,28,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=`rgba(100,140,255,${ga})`; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(x,groundY-2,40,0,Math.PI*2); ctx.stroke(); ctx.restore();
    ctx.fillStyle=rgb(lerpColor([60,94,74],[18,28,22],dark));
    for (const [ox] of stones) { ctx.beginPath(); ctx.ellipse(x+ox,groundY-1,4,2.5,0,0,Math.PI*2); ctx.fill(); }
  },
};

export function drawLocations(dark) {
  if (!state.locations) return;
  const { player, locations } = state;
  const camL=Game.cam-400, camR=Game.cam+W+400;
  const t=performance.now()/1000;
  const LOC_SCALE=1.55;
  for (const loc of locations) {
    if (loc.x<camL||loc.x>camR) continue;
    const locAlpha = loc.fadeAlpha !== undefined ? loc.fadeAlpha : 1;
    if (locAlpha <= 0) continue;

    ctx.save();
    ctx.globalAlpha = locAlpha;

    // Epic glow aura around location
    if (!loc.cleared) {
      const pulse=0.55+0.18*Math.sin(t*2.2+loc.x*0.001);
      ctx.save(); ctx.globalCompositeOperation="lighter";
      const hasEnemies = loc.preActivated && loc.remainingEnemies > 0;
      const glowCol = hasEnemies ? `rgba(220,60,60,${0.09*pulse})` : `rgba(80,140,255,${0.07*pulse})`;
      const gr=ctx.createRadialGradient(loc.x,groundY-20,20,loc.x,groundY-20,110);
      gr.addColorStop(0,glowCol); gr.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=gr; ctx.beginPath(); ctx.ellipse(loc.x,groundY-20,110,60,0,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(loc.x, groundY);
    ctx.scale(LOC_SCALE, LOC_SCALE);
    ctx.translate(-loc.x, -groundY);
    LOC_DRAWERS[loc.type]?.(loc.x, dark);
    ctx.restore();

    // Enemy count skulls above location
    if (loc.preActivated && !loc.cleared && loc.remainingEnemies > 0) {
      const skullY=groundY-170;
      ctx.save(); ctx.font="14px serif"; ctx.textAlign="center";
      const skullStr="💀".repeat(Math.min(loc.remainingEnemies,6))+(loc.remainingEnemies>6?"…":"");
      ctx.globalAlpha=0.85; ctx.fillText(skullStr,loc.x,skullY); ctx.restore();
    }
    if (loc.cleared) {
      ctx.save(); ctx.font="14px serif"; ctx.textAlign="center"; ctx.globalAlpha=0.7;
      ctx.fillText("✅",loc.x,groundY-160); ctx.restore();
    }


    ctx.restore(); // locAlpha save
  }
}

export function drawGroundBows() {
  if (!state.groundBows) return;
  const t=performance.now()/1000;
  for (const b of state.groundBows) {
    const bob=Math.sin(t*2.2+b.x*0.01)*2.5, yy=groundY-14+bob, alpha=b.claimed?0.35:0.7;
    groundShadow(b.x,8,0.18);
    ctx.save(); ctx.globalAlpha=alpha; ctx.translate(b.x,yy); ctx.rotate(-0.3+Math.sin(t*1.1+b.x*0.005)*0.06);
    ctx.strokeStyle="#8a5a2a"; ctx.lineWidth=2.5; ctx.lineCap="round"; ctx.beginPath(); ctx.arc(0,0,8,-1.2,1.2); ctx.stroke();
    ctx.strokeStyle="#e8d8a8"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(8*Math.cos(-1.2),8*Math.sin(-1.2)); ctx.lineTo(8*Math.cos(1.2),8*Math.sin(1.2)); ctx.stroke();
    ctx.restore();
    if (!b.claimed) {
      ctx.save(); ctx.globalAlpha=0.55+0.2*Math.sin(t*3+b.x*0.01); ctx.globalCompositeOperation="lighter";
      ctx.fillStyle="#9bd05a"; ctx.beginPath(); ctx.arc(b.x,yy,12,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
  }
}

export function drawGroundHammers() {
  if (!state.groundHammers) return;
  const t = performance.now()/1000;
  for (const h of state.groundHammers) {
    const bob = Math.sin(t*2.2+h.x*0.01)*2.5, yy = groundY-16+bob, alpha = h.claimed ? 0.35 : 0.72;
    groundShadow(h.x, 8, 0.18);
    ctx.save(); ctx.globalAlpha=alpha; ctx.translate(h.x, yy); ctx.rotate(0.3+Math.sin(t*1.1+h.x*0.005)*0.06);
    ctx.strokeStyle="#7a5a2a"; ctx.lineWidth=2.5; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(0,8); ctx.lineTo(0,-8); ctx.stroke();
    ctx.lineCap="butt";
    ctx.fillStyle="#9a9aaa"; ctx.fillRect(-5,-12,10,5);
    ctx.fillStyle="#bbbbcc"; ctx.fillRect(-5,-12,10,2);
    ctx.restore();
    if (!h.claimed) {
      ctx.save(); ctx.globalAlpha=0.5+0.2*Math.sin(t*3+h.x*0.01); ctx.globalCompositeOperation="lighter";
      ctx.fillStyle="#f2a230"; ctx.beginPath(); ctx.arc(h.x, yy, 13, 0, Math.PI*2); ctx.fill(); ctx.restore();
    }
  }
}

export function drawLootItems() {
  if (!state.lootItems) return;
  const t=performance.now()/1000;
  for (const it of state.lootItems) {
    const w=WEAPONS[it.weaponId], bob=Math.sin(t*2.5+it.x*0.01)*3;
    const yy = (it.dropY !== undefined) ? it.dropY : groundY-16+bob;
    const rc=RARITY_COL[w.rarity];
    const stillFalling = it.dropVy !== undefined && it.dropVy !== 0;
    const timeLeft = 10 - (it.despawnTimer || 0);
    const blinking = !stillFalling && timeLeft < 3;
    const blinkAlpha = blinking ? (0.4 + 0.6 * Math.abs(Math.sin(t * 8))) : 1;
    ctx.save(); ctx.globalAlpha = blinkAlpha;
    ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=(stillFalling?0.08:0.2)+0.12*Math.sin(t*3+it.x*0.004);
    ctx.fillStyle=rc; ctx.beginPath(); ctx.arc(it.x,yy,14,0,Math.PI*2); ctx.fill(); ctx.restore();
    if (!stillFalling) groundShadow(it.x,9,0.22);
    const spinAng = stillFalling ? (t*8 % (Math.PI*2)) : (-0.35+Math.sin(t*1.2+it.x*0.005)*0.07);
    ctx.save(); ctx.translate(it.x,yy); ctx.rotate(spinAng);
    ctx.strokeStyle=w.col; ctx.lineWidth=3; ctx.lineCap="round";
    if (w.type==="melee") {
      const len=clamp(w.range*0.28,12,26);
      ctx.beginPath(); ctx.moveTo(-len/2,0); ctx.lineTo(len/2,0); ctx.stroke();
      ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(-len*0.3,-5); ctx.lineTo(-len*0.3,5); ctx.stroke();
    } else if (w.type==="ranged") {
      ctx.beginPath(); ctx.arc(0,0,9,-1.3,1.3); ctx.stroke();
      ctx.strokeStyle="#e8d8a8"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(9*Math.cos(-1.3),9*Math.sin(-1.3)); ctx.lineTo(9*Math.cos(1.3),9*Math.sin(1.3)); ctx.stroke();
    } else {
      drawTomeIcon(w.col, 1);
    }
    ctx.restore();
    ctx.restore(); // blinkAlpha save
  }
}

export function drawChests() {
  if (!state.chests || !state.chests.length) return;
  const t=performance.now()/1000;
  const { player } = state;
  for (const ch of state.chests) {
    const x=ch.x, bob=Math.sin(t*2+x*0.01)*2.5, yy=groundY-18+bob;
    const near=dist(x,player.x)<64, oa=ch.openAnim||0;
    groundShadow(x,14,0.22);
    ctx.save(); ctx.translate(x,yy);
    // Chest glow when nearby
    if (near && !ch.open) {
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.25+0.12*Math.sin(t*4);
      ctx.fillStyle="#f2c14e"; ctx.beginPath(); ctx.arc(0,0,20,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    // Chest body
    const openY = ch.open ? -10*oa : 0;
    ctx.fillStyle=ch.open?"#6a4a22":"#7a5a28"; ctx.fillRect(-14,openY-10,28,20); // body
    ctx.fillStyle="rgba(255,255,255,0.09)"; ctx.fillRect(-14,openY-10,9,20);
    ctx.fillStyle="rgba(0,0,0,0.22)"; ctx.fillRect(8,openY-10,6,20);
    // Metal bands
    ctx.fillStyle="#9a8060"; ctx.fillRect(-14,openY-2,28,3); ctx.fillRect(-14,openY+5,28,2);
    // Lock
    ctx.fillStyle="#c0a060"; ctx.beginPath(); ctx.arc(0,openY,3.5,0,Math.PI*2); ctx.fill();
    // Lid
    const lidAngle = ch.open ? -Math.PI*0.55*oa : 0;
    ctx.save(); ctx.translate(0,openY-10); ctx.rotate(lidAngle);
    ctx.fillStyle=ch.open?"#8a6a30":"#9a7a34"; ctx.fillRect(-14,-10,28,10);
    ctx.fillStyle="rgba(255,255,255,0.09)"; ctx.fillRect(-14,-10,9,10);
    ctx.fillStyle="#9a8060"; ctx.fillRect(-14,-2,28,2);
    ctx.restore();
    ctx.restore();
    // "F" prompt
    if (near && !ch.open) {
      ctx.save(); ctx.font="bold 12px Trebuchet MS"; ctx.textAlign="center";
      const py=yy-bob-36, pa=0.7+0.28*Math.sin(t*3);
      ctx.globalAlpha=pa;
      ctx.fillStyle="rgba(0,0,0,0.55)"; ctx.fillText("[F] Åbn kiste",x+1,py+1);
      ctx.fillStyle="#f2c14e"; ctx.fillText("[F] Åbn kiste",x,py);
      ctx.restore();
    }
  }
}

export function drawOffscreenIndicators() {
  if (!Game.isNight) return;
  for (const e of state.enemies) {
    if (e.fleeing) continue;
    const sx=e.x-Game.cam;
    if (sx<0) { ctx.fillStyle="rgba(255,70,70,0.85)"; ctx.beginPath(); ctx.moveTo(14,groundY-60); ctx.lineTo(30,groundY-70); ctx.lineTo(30,groundY-50); ctx.fill(); }
    else if (sx>W) { ctx.fillStyle="rgba(255,70,70,0.85)"; ctx.beginPath(); ctx.moveTo(W-14,groundY-60); ctx.lineTo(W-30,groundY-70); ctx.lineTo(W-30,groundY-50); ctx.fill(); }
  }
}

// ---------- Weapon pickup overlay ----------
function drawWeaponPickupOverlay() {
  const wp = state.weaponPickup;
  if (!wp) return;
  const a = clamp(wp.timer / 1.0, 0, 1);
  if (a <= 0) return;
  const w = WEAPONS[wp.weaponId], rc = RARITY_COL[w.rarity];
  const cx = W/2, cy = H*0.32;
  const elapsed = 3.8 - wp.timer;
  const entryScale = elapsed < 0.25 ? (0.6 + 0.4 * (elapsed / 0.25)) : 1;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(cx, cy); ctx.scale(entryScale, entryScale); ctx.translate(-cx, -cy);
  // panel
  const panelW2 = w.rarity >= 3 ? 340 : 320, panelH2 = w.rarity >= 3 ? 134 : 124;
  roundedRect(cx-panelW2/2, cy-panelH2/2, panelW2, panelH2, 14);
  ctx.fillStyle = "rgba(12,10,20,0.92)"; ctx.fill();
  ctx.strokeStyle = rc + "dd"; ctx.lineWidth = w.rarity >= 3 ? 2.5 : 2; ctx.stroke();
  // glow (stronger for epic/legendary)
  ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=a*(w.rarity >= 3 ? 0.28 : 0.18);
  ctx.fillStyle=rc; roundedRect(cx-panelW2/2,cy-panelH2/2,panelW2,panelH2,14); ctx.fill();
  ctx.restore(); ctx.globalAlpha=a;
  // weapon icon (draw a simple stylised icon)
  ctx.save(); ctx.translate(cx-90, cy+4);
  if (w.type==="melee") {
    const len=clamp(w.range*0.55,26,46);
    ctx.strokeStyle=w.col; ctx.lineWidth=4; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(-len/2,-2); ctx.lineTo(len/2,-2); ctx.stroke();
    ctx.lineWidth=7; ctx.beginPath(); ctx.moveTo(-len*0.35,-10); ctx.lineTo(-len*0.35,6); ctx.stroke();
    if (w.rarity>=2) { ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.4; ctx.strokeStyle=w.col; ctx.lineWidth=8; ctx.beginPath(); ctx.moveTo(-len/2,-2); ctx.lineTo(len/2,-2); ctx.stroke(); ctx.restore(); }
  } else if (w.type==="ranged") {
    ctx.strokeStyle=w.col; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(0,0,16,-1.3,1.3); ctx.stroke();
    ctx.strokeStyle="#e8d8a8"; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(16*Math.cos(-1.3),16*Math.sin(-1.3)); ctx.lineTo(16*Math.cos(1.3),16*Math.sin(1.3)); ctx.stroke();
  } else {
    drawTomeIcon(w.col, 1.8);
  }
  ctx.restore();
  // text
  ctx.textAlign="left";
  ctx.font="bold 20px Trebuchet MS"; ctx.fillStyle=rc;
  ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillText(w.name, cx-39, cy-16);
  ctx.fillStyle=rc; ctx.fillText(w.name, cx-40, cy-17);
  ctx.font="13px Trebuchet MS"; ctx.fillStyle="rgba(255,255,255,0.75)";
  ctx.fillText(RARITY_NAME[w.rarity], cx-40, cy+4);
  ctx.fillText("Skade: "+w.dmg+"  Rækkevidde: "+w.range, cx-40, cy+22);
  ctx.fillStyle="rgba(200,200,200,0.5)"; ctx.font="11px Trebuchet MS"; ctx.textAlign="center";
  ctx.fillText("Våben samlet op", cx, cy+46);
  ctx.restore();
}

// ---------- Inventory overlay ----------
function drawInventoryOverlay() {
  if (!Game.inventoryOpen) return;
  const { player } = state;
  ctx.save();
  // background
  ctx.fillStyle="rgba(6,4,14,0.88)"; ctx.fillRect(0,0,W,H);
  roundedRect(W/2-280,H/2-180,560,360,18);
  ctx.fillStyle="rgba(20,16,36,0.97)"; ctx.fill();
  ctx.strokeStyle="rgba(200,180,120,0.35)"; ctx.lineWidth=2; ctx.stroke();
  // title
  ctx.textAlign="center"; ctx.font="bold 18px Trebuchet MS";
  ctx.fillStyle="#f0e6cf"; ctx.fillText("Inventar  [I – luk]", W/2, H/2-144);
  // divider
  ctx.strokeStyle="rgba(200,180,120,0.2)"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(W/2, H/2-128); ctx.lineTo(W/2, H/2+158); ctx.stroke();
  // ---- LEFT: character silhouette ----
  const charX=W/2-130, charY=H/2+60;
  ctx.save(); ctx.translate(charX, charY); ctx.scale(2.2, 2.2);
  // draw a static player-like figure
  ctx.fillStyle="#7a2440"; roundedRect(-6,-70,16,26,6); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.18)"; roundedRect(4,-70,6,26,4); ctx.fill();
  ctx.fillStyle="#caa483"; ctx.beginPath(); ctx.arc(2,-74,6,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#5a182e"; ctx.beginPath(); ctx.moveTo(-4,-66); ctx.quadraticCurveTo(-16,-52,-22,-32); ctx.lineTo(-8,-40); ctx.quadraticCurveTo(-6,-54,2,-64); ctx.fill();
  ctx.fillStyle="#2a2230"; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(-14,-26); ctx.lineTo(-14,0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(12,-26); ctx.lineTo(12,0); ctx.stroke();
  ctx.fillStyle="#2a2230"; roundedRect(-20,-46,44,22,10); ctx.fill();
  // weapon in hand
  if (player && player.weapon) {
    const ww=WEAPONS[player.weapon];
    if (ww.type==="melee") {
      const len=clamp(ww.range*0.35,14,28);
      ctx.save(); ctx.translate(10,-58); ctx.rotate(-0.22);
      ctx.strokeStyle=ww.col; ctx.lineWidth=2.5; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(len,0); ctx.stroke(); ctx.restore();
    } else if (ww.type==="ranged") {
      ctx.strokeStyle=WEAPONS[player.weapon].col; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(14,-58,9,-1.25,1.25); ctx.stroke();
    } else {
      ctx.save(); ctx.translate(12,-58); drawTomeIcon(ww.col, 1.1); ctx.restore();
    }
  }
  ctx.restore();
  ctx.textAlign="center"; ctx.font="bold 13px Trebuchet MS";
  ctx.fillStyle="#c8b890"; ctx.fillText("Monarch", charX, H/2+130);
  // HP hearts
  const n=player?player.maxHp:0, gap=10, hhy=H/2+148;
  for (let i=0;i<n;i++) drawHeart(charX-(n-1)*gap/2+i*gap, hhy, 4, (player&&i<player.hp)?"#e0556a":"rgba(255,255,255,0.2)");
  // ---- RIGHT: weapon info ----
  const rx=W/2+40;
  ctx.textAlign="left"; ctx.font="bold 14px Trebuchet MS"; ctx.fillStyle="rgba(200,180,120,0.6)";
  ctx.fillText("Udstyret våben", rx, H/2-105);
  if (player && player.weapon) {
    const ww=WEAPONS[player.weapon], rc=RARITY_COL[ww.rarity];
    const eff=effectiveWeapon(player.weapon, player.weaponUpgrades||[]);
    const upgs=player.weaponUpgrades||[];
    ctx.font="bold 20px Trebuchet MS"; ctx.fillStyle=rc;
    ctx.fillText(ww.name, rx, H/2-78);
    ctx.font="13px Trebuchet MS"; ctx.fillStyle="rgba(255,255,255,0.65)";
    ctx.fillText(RARITY_NAME[ww.rarity]+(upgs.length>0?" · "+upgs.length+" opgraderinger":""), rx, H/2-58);
    ctx.fillStyle="rgba(200,200,200,0.8)";
    ctx.fillText("Type:        "+(ww.type==="melee"?"Nærkamp":ww.type==="ranged"?"Bue":"Magi"), rx, H/2-32);
    const dmgBonus=eff.dmg-ww.dmg, rngBonus=eff.range-ww.range, spdDiff=Math.round((ww.speed-eff.speed)*100)/100;
    ctx.fillStyle="rgba(200,200,200,0.8)"; ctx.fillText("Skade:", rx, H/2-12);
    ctx.fillStyle="#f0e6cf"; ctx.fillText(eff.dmg+(dmgBonus>0?" (+"+dmgBonus+")":""), rx+90, H/2-12);
    ctx.fillStyle="rgba(200,200,200,0.8)"; ctx.fillText("Rækkevidde:", rx, H/2+10);
    ctx.fillStyle="#f0e6cf"; ctx.fillText(eff.range+" px"+(rngBonus>0?" (+"+rngBonus+")":""), rx+110, H/2+10);
    ctx.fillStyle="rgba(200,200,200,0.8)"; ctx.fillText("Hastighed:", rx, H/2+32);
    ctx.fillStyle="#f0e6cf"; ctx.fillText(eff.speed+"x"+(spdDiff>0?" (hurtigere)":""), rx+90, H/2+32);
    // big weapon icon
    ctx.save(); ctx.translate(rx+90, H/2+100);
    if (ww.type==="melee") {
      const len=clamp(ww.range*0.6,30,52);
      ctx.strokeStyle=ww.col; ctx.lineWidth=5; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(-len/2,-4); ctx.lineTo(len/2,-4); ctx.stroke();
      ctx.lineWidth=9; ctx.beginPath(); ctx.moveTo(-len*0.32,-14); ctx.lineTo(-len*0.32,8); ctx.stroke();
      if (ww.rarity>=2) { ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.35; ctx.strokeStyle=ww.col; ctx.lineWidth=10; ctx.beginPath(); ctx.moveTo(-len/2,-4); ctx.lineTo(len/2,-4); ctx.stroke(); ctx.restore(); }
    } else if (ww.type==="ranged") {
      ctx.strokeStyle=ww.col; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(0,0,20,-1.3,1.3); ctx.stroke();
      ctx.strokeStyle="#e8d8a8"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(20*Math.cos(-1.3),20*Math.sin(-1.3)); ctx.lineTo(20*Math.cos(1.3),20*Math.sin(1.3)); ctx.stroke();
    } else {
      drawTomeIcon(ww.col, 2.2);
    }
    ctx.restore();
  } else {
    ctx.font="15px Trebuchet MS"; ctx.fillStyle="rgba(200,200,200,0.4)";
    ctx.fillText("Intet våben udstyret", rx, H/2-60);
    ctx.font="12px Trebuchet MS"; ctx.fillStyle="rgba(200,200,200,0.3)";
    ctx.fillText("Find et våben i verden og", rx, H/2-30);
    ctx.fillText("tryk F for at samle det op.", rx, H/2-12);
  }
  ctx.restore();
}

// ---------- Shop overlay ----------
function drawArmorIcon(col, scale=1, canAfford=true) {
  const c = canAfford ? col : "rgba(100,100,100,0.6)";
  ctx.save(); ctx.scale(scale, scale);
  ctx.strokeStyle=c; ctx.lineWidth=2.5; ctx.lineJoin="round";
  ctx.beginPath();
  ctx.moveTo(-9,10); ctx.lineTo(-12,2); ctx.lineTo(-12,-6); ctx.lineTo(0,-10); ctx.lineTo(12,-6);
  ctx.lineTo(12,2); ctx.lineTo(9,10); ctx.lineTo(0,12); ctx.closePath();
  ctx.stroke();
  ctx.fillStyle=canAfford?col+"44":"rgba(80,80,80,0.2)"; ctx.fill();
  ctx.restore();
}

function drawShopOverlay() {
  if (!Game.shopOpen) return;
  const weaponList = window._WEAPON_SHOP;
  const armorList  = window._ARMOR_SHOP;
  if (!weaponList || !armorList) return;
  const tab = Game.shopTab || 0;
  const items = tab === 1 ? armorList : weaponList;
  const { player } = state;
  const cx=W/2, cy=H/2;
  const cols=5, cellW=120, cellH=90, padX=20, padY=20;
  const rows=Math.ceil(items.length/cols);
  const tabH=36;
  const panelW=cols*cellW+padX*2, panelH=rows*cellH+padY*2+48+tabH+58;
  ctx.save();
  // Dim background
  ctx.fillStyle="rgba(6,4,14,0.82)"; ctx.fillRect(0,0,W,H);
  // Panel
  roundedRect(cx-panelW/2,cy-panelH/2,panelW,panelH,16);
  ctx.fillStyle="rgba(18,14,32,0.97)"; ctx.fill();
  ctx.strokeStyle="rgba(200,180,120,0.4)"; ctx.lineWidth=2; ctx.stroke();
  // Title
  ctx.textAlign="center"; ctx.font="bold 18px Trebuchet MS";
  ctx.fillStyle="#f0e6cf"; ctx.fillText("🏪 Butik  [B – luk | ◀▶ naviger | T – skift fane | E – køb]", cx, cy-panelH/2+30);
  ctx.strokeStyle="rgba(200,180,120,0.2)"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(cx-panelW/2+16,cy-panelH/2+40); ctx.lineTo(cx+panelW/2-16,cy-panelH/2+40); ctx.stroke();
  // Tab headers
  const tabW = (panelW-padX*2)/2;
  const tabY = cy-panelH/2+44;
  const tabLabels = ["⚔ Våben","🛡 Rustning"];
  window._shopTabRects = [];
  for (let ti=0;ti<2;ti++) {
    const tx = cx-panelW/2+padX+ti*tabW;
    window._shopTabRects.push({ x:tx, y:tabY, w:tabW-4, h:tabH-6, tab:ti });
    roundedRect(tx, tabY, tabW-4, tabH-6, 6);
    ctx.fillStyle = ti===tab ? "rgba(242,193,78,0.22)" : "rgba(255,255,255,0.05)";
    ctx.fill();
    ctx.strokeStyle = ti===tab ? "#f2c14e" : "rgba(180,160,100,0.25)";
    ctx.lineWidth = ti===tab ? 2 : 1; ctx.stroke();
    ctx.textAlign="center"; ctx.font = (ti===tab?"bold ":"")+"14px Trebuchet MS";
    ctx.fillStyle = ti===tab ? "#f2c14e" : "#a09070";
    ctx.fillText(tabLabels[ti], tx+tabW*0.5-2, tabY+tabH*0.5-1);
  }
  // Items grid
  const gridTop = tabY + tabH;
  window._shopCells = [];
  for (let i=0;i<items.length;i++) {
    const it=items[i];
    const col=i%cols, row=Math.floor(i/cols);
    const ix=cx-panelW/2+padX+col*cellW, iy=gridTop+padY*0.5+row*cellH;
    window._shopCells.push({ x:ix, y:iy, w:cellW-6, h:cellH-6, idx:i });
    const selected=i===Game.shopIdx;
    const canAfford=player.coins>=it.price;
    // Cell background
    roundedRect(ix,iy,cellW-6,cellH-6,8);
    ctx.fillStyle=selected?"rgba(255,220,100,0.18)":"rgba(255,255,255,0.04)"; ctx.fill();
    if (selected) { ctx.strokeStyle="#f2c14e"; ctx.lineWidth=2; ctx.stroke(); }
    // Icon
    ctx.save(); ctx.translate(ix+cellW*0.35,iy+cellH*0.38);
    if (it.armorId) {
      const a = ARMORS[it.armorId];
      drawArmorIcon(a.col, 1.05, canAfford);
    } else {
      const w=WEAPONS[it.weaponId];
      if (w.type==="melee") {
        const len=clamp(w.range*0.28,14,24);
        ctx.strokeStyle=canAfford?w.col:"rgba(100,100,100,0.6)"; ctx.lineWidth=3; ctx.lineCap="round";
        ctx.beginPath(); ctx.moveTo(-len/2,0); ctx.lineTo(len/2,0); ctx.stroke();
        ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(-len*0.3,-6); ctx.lineTo(-len*0.3,6); ctx.stroke();
      } else if (w.type==="ranged") {
        ctx.strokeStyle=canAfford?w.col:"rgba(100,100,100,0.6)"; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.arc(0,0,10,-1.3,1.3); ctx.stroke();
        ctx.strokeStyle="#e8d8a8"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(10*Math.cos(-1.3),10*Math.sin(-1.3)); ctx.lineTo(10*Math.cos(1.3),10*Math.sin(1.3)); ctx.stroke();
      } else {
        ctx.globalAlpha = canAfford ? 1 : 0.4;
        drawTomeIcon(w.col, 0.95);
        ctx.globalAlpha = 1;
      }
    }
    ctx.lineCap="butt"; ctx.restore();
    // Name + price
    ctx.textAlign="center";
    const itemName = it.armorId ? ARMORS[it.armorId].name : WEAPONS[it.weaponId].name;
    const itemRar  = it.armorId ? ARMORS[it.armorId].rarity : WEAPONS[it.weaponId].rarity;
    const rc = it.armorId ? ARMOR_RARITY_COL[itemRar] : RARITY_COL[itemRar];
    ctx.font="bold 11px Trebuchet MS";
    ctx.fillStyle=canAfford?rc:"rgba(120,110,100,0.8)";
    ctx.fillText(itemName, ix+cellW*0.5-3, iy+cellH*0.72);
    ctx.font="12px Trebuchet MS";
    ctx.fillStyle=canAfford?"#f2c14e":"rgba(160,120,80,0.7)";
    ctx.fillText(it.price+"🪙", ix+cellW*0.5-3, iy+cellH*0.88);
  }
  // Selected item stats bar
  const selItem = items[Game.shopIdx];
  const statsY = cy + panelH/2 - 52;
  if (selItem) {
    ctx.strokeStyle = "rgba(200,180,120,0.18)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(cx-panelW/2+16, statsY-6); ctx.lineTo(cx+panelW/2-16, statsY-6); ctx.stroke();
    if (selItem.armorId) {
      const sa = ARMORS[selItem.armorId];
      ctx.textAlign="left"; ctx.font="bold 13px Trebuchet MS";
      ctx.fillStyle=ARMOR_RARITY_COL[sa.rarity];
      ctx.fillText(sa.name, cx-panelW/2+20, statsY+12);
      ctx.font="12px Trebuchet MS"; ctx.fillStyle="rgba(200,200,200,0.75)";
      ctx.fillText(ARMOR_RARITY_NAME[sa.rarity]+"  ·  Forsvar: +"+sa.defense+"  ·  "+sa.desc, cx-panelW/2+20, statsY+32);
    } else {
      const sw = WEAPONS[selItem.weaponId];
      ctx.textAlign="left"; ctx.font="bold 13px Trebuchet MS"; ctx.fillStyle=RARITY_COL[sw.rarity];
      ctx.fillText(sw.name, cx-panelW/2+20, statsY+12);
      ctx.font="12px Trebuchet MS"; ctx.fillStyle="rgba(200,200,200,0.75)";
      const typeLabel = sw.type==="melee"?"Nærkamp":sw.type==="ranged"?"Bue":"Magi";
      ctx.fillText(typeLabel+"  ·  Skade: "+sw.dmg+"  ·  Rækkevidde: "+sw.range+" px  ·  Hastighed: "+sw.speed+"x", cx-panelW/2+20, statsY+32);
    }
  }
  // Coin count
  ctx.textAlign="center"; ctx.font="13px Trebuchet MS";
  ctx.fillStyle="#f2c14e";
  ctx.fillText("Dine mønter: "+player.coins+"🪙", cx, cy+panelH/2-12);
  ctx.restore();
}

// ---------- Magic spells ----------
export function drawSpells() {
  if (!state.spells || !state.spells.length) return;
  const t = performance.now() / 1000;
  for (const sp of state.spells) {
    ctx.save(); ctx.translate(sp.x, sp.y);
    const age = sp.age || 0;
    switch (sp.spellType) {
      case "fireball": {
        // Ydre bloom-glød
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.55*(0.85+0.15*Math.sin(t*14));
        const fg2=ctx.createRadialGradient(0,0,2,0,0,24);
        fg2.addColorStop(0,"rgba(255,200,80,0.9)"); fg2.addColorStop(0.5,"rgba(255,80,10,0.5)"); fg2.addColorStop(1,"rgba(200,30,0,0)");
        ctx.fillStyle=fg2; ctx.beginPath(); ctx.arc(0,0,24,0,Math.PI*2); ctx.fill(); ctx.restore();
        // Indre kerne
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.9;
        const fg=ctx.createRadialGradient(0,0,1,0,0,13);
        fg.addColorStop(0,"rgba(255,240,180,1)"); fg.addColorStop(0.4,"rgba(255,120,40,0.85)"); fg.addColorStop(1,"rgba(220,40,0,0)");
        ctx.fillStyle=fg; ctx.beginPath(); ctx.arc(0,0,13,0,Math.PI*2); ctx.fill(); ctx.restore();
        // Drivende gnistrende kerne
        const flk=0.9+0.1*Math.sin(t*22); ctx.fillStyle="#ffe8a0";
        ctx.beginPath(); ctx.arc(0,0,5*flk,0,Math.PI*2); ctx.fill();
        // Ild-spids i flyveretning
        ctx.save(); ctx.globalAlpha=0.6; ctx.fillStyle="#ff6010";
        const ang2=Math.atan2(sp.vy,sp.vx);
        ctx.rotate(ang2); ctx.beginPath(); ctx.moveTo(14,0); ctx.lineTo(26,-5); ctx.lineTo(26,5); ctx.closePath(); ctx.fill(); ctx.restore();
        break;
      }
      case "meteor": {
        // Sten-krop med vinkelret ildspor
        const ang3=Math.atan2(sp.vy,sp.vx);
        ctx.save(); ctx.rotate(ang3);
        // Ildspor bag
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.7;
        const mtg=ctx.createLinearGradient(-38,0,8,0);
        mtg.addColorStop(0,"rgba(255,120,30,0)"); mtg.addColorStop(0.5,"rgba(255,160,60,0.6)"); mtg.addColorStop(1,"rgba(255,200,80,0.9)");
        ctx.fillStyle=mtg; ctx.beginPath(); ctx.ellipse(-15,0,28,9,0,0,Math.PI*2); ctx.fill(); ctx.restore();
        // Røgspor
        ctx.save(); ctx.globalAlpha=0.35;
        const smg=ctx.createLinearGradient(-50,0,0,0);
        smg.addColorStop(0,"rgba(80,60,50,0)"); smg.addColorStop(1,"rgba(110,80,60,0.7)");
        ctx.fillStyle=smg; ctx.beginPath(); ctx.ellipse(-20,0,32,14,0,0,Math.PI*2); ctx.fill(); ctx.restore();
        // Selve meteoren
        ctx.fillStyle="#5a3820"; ctx.beginPath(); ctx.ellipse(0,0,10,8,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#7a4a28"; ctx.beginPath(); ctx.ellipse(-3,-3,5,4,0,0,Math.PI*2); ctx.fill();
        // Ild-glød forrest
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.8;
        ctx.fillStyle="#ff9940"; ctx.beginPath(); ctx.arc(4,0,12,0,Math.PI*2); ctx.fill(); ctx.restore();
        ctx.restore();
        break;
      }
      case "waterjet": {
        // Stor vandboble med refleksion
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.45;
        const wg=ctx.createRadialGradient(0,0,2,0,0,18);
        wg.addColorStop(0,"rgba(180,230,255,0.8)"); wg.addColorStop(1,"rgba(30,100,200,0)");
        ctx.fillStyle=wg; ctx.beginPath(); ctx.arc(0,0,18,0,Math.PI*2); ctx.fill(); ctx.restore();
        ctx.save(); ctx.globalAlpha=0.85;
        ctx.fillStyle="#3ab0e8"; ctx.beginPath(); ctx.arc(0,0,9,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#b0eeff"; ctx.beginPath(); ctx.arc(-3,-3,4,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.arc(-2,-2,2,0,Math.PI*2); ctx.fill();
        ctx.restore();
        // Bølge-ringe
        ctx.save(); ctx.globalCompositeOperation="lighter";
        for (let ri=0;ri<2;ri++) {
          const rp=(age*3+ri*0.5)%1, rr=12+rp*16, ra=0.4*(1-rp);
          ctx.globalAlpha=ra; ctx.strokeStyle="#a0e8ff"; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.arc(0,0,rr,0,Math.PI*2); ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case "lightning": {
        // Plasma-bold med lyn-arme
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.85;
        const lg=ctx.createRadialGradient(0,0,2,0,0,16);
        lg.addColorStop(0,"rgba(255,255,220,1)"); lg.addColorStop(0.3,"rgba(200,160,255,0.7)"); lg.addColorStop(1,"rgba(100,60,255,0)");
        ctx.fillStyle=lg; ctx.beginPath(); ctx.arc(0,0,16,0,Math.PI*2); ctx.fill();
        // Ydre pulserende ring
        ctx.globalAlpha=0.4*(0.6+0.4*Math.sin(t*28));
        ctx.strokeStyle="#ffffff"; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(0,0,20,0,Math.PI*2); ctx.stroke(); ctx.restore();
        // Lynflager ud til siderne
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.8;
        ctx.strokeStyle="#eeeeff"; ctx.lineWidth=1.5;
        const numR=4;
        for (let ri=0;ri<numR;ri++) {
          const ra=(ri/numR)*Math.PI*2 + t*8;
          const lx1=Math.cos(ra)*8, ly1=Math.sin(ra)*8;
          const lx2=Math.cos(ra+0.3)*14+Math.sin(t*30+ri)*3, ly2=Math.sin(ra+0.3)*14+Math.cos(t*25+ri)*3;
          const lx3=Math.cos(ra)*20, ly3=Math.sin(ra)*20;
          ctx.beginPath(); ctx.moveTo(lx1,ly1); ctx.lineTo(lx2,ly2); ctx.lineTo(lx3,ly3); ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle="#ffffff"; ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2); ctx.fill();
        break;
      }
      case "arcane": {
        // Koncentreret stråle/bold af pink/magenta mystisk energi
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.85;
        const arcg=ctx.createRadialGradient(0,0,1,0,0,18);
        arcg.addColorStop(0,"rgba(255,180,255,1)"); arcg.addColorStop(0.35,"rgba(200,80,255,0.8)"); arcg.addColorStop(1,"rgba(80,0,160,0)");
        ctx.fillStyle=arcg; ctx.beginPath(); ctx.arc(0,0,18,0,Math.PI*2); ctx.fill();
        // Pulserende ydre ring
        ctx.globalAlpha=0.5*(0.6+0.4*Math.sin(t*16));
        const arcg2=ctx.createRadialGradient(0,0,12,0,0,28);
        arcg2.addColorStop(0,"rgba(255,100,255,0.5)"); arcg2.addColorStop(1,"rgba(120,0,200,0)");
        ctx.fillStyle=arcg2; ctx.beginPath(); ctx.arc(0,0,28,0,Math.PI*2); ctx.fill(); ctx.restore();
        // Roterende magiske rune-linjer
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.7; ctx.strokeStyle="#ff80ff"; ctx.lineWidth=1.5;
        for (let ri=0;ri<3;ri++) {
          const ra=t*6+ri*(Math.PI*2/3);
          ctx.beginPath(); ctx.arc(0,0,12,ra,ra+1.2); ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle="#ffe0ff"; ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
        break;
      }
      case "shadow": {
        // Mørk tåge-bold med pulserende lilla kerne
        ctx.save(); ctx.globalAlpha=0.7;
        const shg=ctx.createRadialGradient(0,0,2,0,0,20);
        shg.addColorStop(0,"rgba(30,0,50,0.95)"); shg.addColorStop(0.6,"rgba(60,0,90,0.7)"); shg.addColorStop(1,"rgba(20,0,40,0)");
        ctx.fillStyle=shg; ctx.beginPath(); ctx.arc(0,0,20,0,Math.PI*2); ctx.fill(); ctx.restore();
        // Skygge-kløer/arme
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.6;
        ctx.strokeStyle="#cc44ff"; ctx.lineWidth=2;
        for (let ci=0;ci<3;ci++) {
          const ca=t*5+ci*(Math.PI*2/3);
          const cx2=Math.cos(ca)*15, cy2=Math.sin(ca)*15;
          const mx=Math.cos(ca+0.4)*9, my=Math.sin(ca+0.4)*9;
          ctx.beginPath(); ctx.moveTo(mx,my); ctx.quadraticCurveTo(cx2*0.6,cy2*0.6,cx2,cy2); ctx.stroke();
        }
        ctx.restore();
        // Glødende kerne
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.85*(0.7+0.3*Math.sin(t*12));
        ctx.fillStyle="#cc44ff"; ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.fill(); ctx.restore();
        ctx.fillStyle="#ff80ff"; ctx.beginPath(); ctx.arc(0,0,2.5,0,Math.PI*2); ctx.fill();
        break;
      }
      case "void": {
        // Sort hul — indadtrækkende ringe og lys-distortion
        ctx.save(); ctx.globalAlpha=0.9;
        const vbg=ctx.createRadialGradient(0,0,1,0,0,24);
        vbg.addColorStop(0,"rgba(0,0,0,1)"); vbg.addColorStop(0.55,"rgba(20,0,40,0.9)"); vbg.addColorStop(1,"rgba(60,0,100,0)");
        ctx.fillStyle=vbg; ctx.beginPath(); ctx.arc(0,0,24,0,Math.PI*2); ctx.fill(); ctx.restore();
        // Gravitationsringe der trækker indad
        ctx.save(); ctx.globalCompositeOperation="lighter";
        for (let ri=0;ri<3;ri++) {
          const rp=((age*1.8 + ri*0.33)%1);
          const rr=22*(1-rp), ra=0.7*(1-rp);
          ctx.globalAlpha=ra; ctx.strokeStyle=ri===0?"#e060ff":ri===1?"#9933ff":"#cc88ff";
          ctx.lineWidth=1.5+ri*0.5;
          ctx.beginPath(); ctx.arc(0,0,rr,0,Math.PI*2); ctx.stroke();
        }
        ctx.restore();
        // Stjerneglimmer-kerne
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.95*(0.8+0.2*Math.sin(t*20));
        const vcg=ctx.createRadialGradient(0,0,0,0,0,8);
        vcg.addColorStop(0,"rgba(255,220,255,1)"); vcg.addColorStop(1,"rgba(120,0,200,0)");
        ctx.fillStyle=vcg; ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill(); ctx.restore();
        break;
      }
      default: {
        ctx.fillStyle=sp.col||"#ffffff"; ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.fill(); break;
      }
    }
    ctx.restore();
  }
}

// ---------- Upgrade menu ----------
function drawUpgradeMenu() {
  if (!Game.upgradeMenuOpen || !Game.upgradeOptions) return;
  const opts = Game.upgradeOptions;
  const { player } = state;
  if (!player || !player.weapon) return;
  const w = WEAPONS[player.weapon], rc = RARITY_COL[w.rarity];
  const cx = W/2, cy = H/2;
  ctx.save();
  ctx.fillStyle = "rgba(6,4,14,0.9)"; ctx.fillRect(0,0,W,H);
  ctx.textAlign = "center";
  ctx.font = "bold 20px Trebuchet MS"; ctx.fillStyle = "#f2c14e";
  ctx.fillText("⬆ Niveau " + player.level + "! Vælg en opgradering", cx, cy - 158);
  ctx.font = "13px Trebuchet MS"; ctx.fillStyle = rc;
  const upgs = (player.weaponUpgrades||[]).length;
  ctx.fillText(w.name + (upgs > 0 ? "  (+" + upgs + " opgraderinger)" : ""), cx, cy - 132);
  const cardW = 185, cardH = 168, gap = 14;
  const totalW = opts.length * cardW + (opts.length - 1) * gap;
  const sx = cx - totalW/2;
  const curEff = effectiveWeapon(player.weapon, player.weaponUpgrades || []);
  for (let i = 0; i < opts.length; i++) {
    const opt = opts[i], ox = sx + i*(cardW+gap), oy = cy - 78, sel = i === Game.upgradeIdx;
    const nxtEff = effectiveWeapon(player.weapon, [...(player.weaponUpgrades||[]), opt]);
    roundedRect(ox, oy, cardW, cardH, 12);
    ctx.fillStyle = sel ? "rgba(242,193,78,0.16)" : "rgba(255,255,255,0.04)"; ctx.fill();
    ctx.strokeStyle = sel ? "#f2c14e" : "rgba(200,180,120,0.22)"; ctx.lineWidth = sel ? 2 : 1; ctx.stroke();
    ctx.textAlign = "center";
    ctx.font = "bold 12px Trebuchet MS";
    ctx.fillStyle = sel ? "#f2c14e" : "#907860";
    ctx.fillText("[" + (i+1) + "]", ox+cardW/2, oy+22);
    ctx.font = "bold 15px Trebuchet MS";
    ctx.fillStyle = sel ? "#f0e6cf" : "#c8b890";
    ctx.fillText(opt.name, ox+cardW/2, oy+50);
    ctx.font = "11px Trebuchet MS"; ctx.fillStyle = "rgba(200,190,170,0.72)";
    ctx.fillText(opt.desc, ox+cardW/2, oy+70);
    let yy = oy + 96;
    if (opt.effect.dmg)        { ctx.fillStyle="#9bd05a"; ctx.font="12px Trebuchet MS"; ctx.fillText("Skade: " + curEff.dmg + " → " + nxtEff.dmg, ox+cardW/2, yy); yy+=20; }
    if (opt.effect.speedBonus) { ctx.fillStyle="#6ab4ff"; ctx.font="12px Trebuchet MS"; ctx.fillText("Hastighed: " + curEff.speed + " → " + nxtEff.speed + "x", ox+cardW/2, yy); yy+=20; }
    if (opt.effect.range)      { ctx.fillStyle="#f2c14e"; ctx.font="12px Trebuchet MS"; ctx.fillText("Rækkevidde: " + curEff.range + " → " + nxtEff.range + " px", ox+cardW/2, yy); yy+=20; }
  }
  ctx.textAlign = "center"; ctx.font = "11px Trebuchet MS"; ctx.fillStyle = "rgba(180,180,180,0.45)";
  ctx.fillText("◀▶ naviger  ·  E/Enter vælg  ·  1/2/3 direkte  ·  Esc annuller", cx, cy + cardH/2 + 46);
  ctx.restore();
}

// ---------- XP bar ----------
function drawXpBar() {
  const { player } = state;
  if (!player || !player.level) return;
  const xpNeeded = 60 + player.level * 45;
  const frac = clamp((player.xp||0) / xpNeeded, 0, 1);
  const bx = 20, by = H - 48, bw = 150, bh = 7;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.5)"; roundedRect(bx-6, by-22, bw+12, bh+30, 6); ctx.fill();
  ctx.font = "bold 11px Trebuchet MS"; ctx.textAlign = "left";
  ctx.fillStyle = "#f2c14e"; ctx.fillText("Niveau " + player.level, bx, by-7);
  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = "#9bd05a"; ctx.fillRect(bx, by, bw*frac, bh);
  ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth=1; ctx.strokeRect(bx, by, bw, bh);
  ctx.restore();
}

// ---------- Main render ----------
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
  drawGodrays(dark);
  drawTreeLayer(trees.near,0.70,0.28,14);
  drawBackgroundReadabilityWash(dark);

  const bi=biomeAt(Game.cam+W/2);
  const gg=ctx.createLinearGradient(0,groundY,0,H);
  gg.addColorStop(0,rgb(lerpColor(bi.gT,[14,16,26],dark)));
  gg.addColorStop(1,rgb(lerpColor(bi.gB,[6,8,16],dark)));
  ctx.fillStyle=gg; ctx.fillRect(0,groundY,W,H-groundY);
  ctx.fillStyle=withA(lerpColor(shade(bi.gT,1.25),[44,48,64],dark),0.55);
  ctx.fillRect(0,groundY,W,2);

  const zoom=Game.zoom||1;
  const _sk=Game.screenShake||0;
  const _skx=_sk>0?(Math.random()-0.5)*_sk*12:0, _sky=_sk>0?(Math.random()-0.5)*_sk*7:0;
  ctx.save();
  ctx.translate(W/2+_skx, groundY+_sky); ctx.scale(zoom,zoom); ctx.translate(-W/2-Game.cam,-groundY);
  drawGroundTexture(dark); drawGroundDeco(dark); drawLocations(dark);
  drawEntityShadows(); drawPortals(dark); drawWalls(dark); drawBase(dark);
  drawStations(); drawCoins(); drawGroundBows(); drawGroundHammers(); drawLootItems(); drawChests();
  drawAnimals(); drawVagrants(); drawUnits(); drawEnemies(dark); drawLegendaryEffects();
  drawPlayer(dark); drawArrows(); drawSpells(); drawParticles(); drawCampLight(dark); drawFloats();
  ctx.restore();

  drawTreeLayer(trees.fore,1.06,0.04,20,0.45);
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

function drawLegendaryBossHead(intro, cx, cy, size) {
  const t = ENEMY_TYPES[intro.bossType];
  if (!t) return;
  const T = performance.now()/1000;
  const w = size, col = t.color, eye = t.eye;
  // Aura
  ctx.save(); ctx.globalCompositeOperation="lighter";
  const ag=ctx.createRadialGradient(cx,cy,4,cx,cy,w*1.1);
  ag.addColorStop(0,eye); ag.addColorStop(1,"rgba(0,0,0,0)");
  ctx.globalAlpha=0.35+0.12*Math.sin(T*2); ctx.fillStyle=ag;
  ctx.beginPath(); ctx.arc(cx,cy,w*1.1,0,Math.PI*2); ctx.fill(); ctx.restore();
  // Body blob
  ctx.fillStyle=col;
  ctx.beginPath(); ctx.ellipse(cx,cy,w*0.55,w*0.65,0,0,Math.PI*2); ctx.fill();
  // Horns
  ctx.fillStyle=col;
  const hc=intro.bossType==="legend3"?7:intro.bossType==="legend2"?5:5;
  for(let i=0;i<hc;i++){const hx=cx+(i/(hc-1)-0.5)*w*0.9,hh=i%2===0?w*0.45:w*0.3;ctx.beginPath();ctx.moveTo(hx-4,cy-w*0.6);ctx.lineTo(hx,cy-w*0.6-hh);ctx.lineTo(hx+4,cy-w*0.6);ctx.fill();}
  // Eyes
  ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.fillStyle=eye;
  ctx.globalAlpha=0.7+0.25*Math.sin(T*4); ctx.beginPath();
  ctx.ellipse(cx-w*0.14,cy-w*0.05,w*0.13,w*0.09,0,0,Math.PI*2); ctx.fill();
  ctx.ellipse(cx+w*0.14,cy-w*0.05,w*0.13,w*0.09,0,0,Math.PI*2); ctx.fill();
  ctx.restore(); ctx.fillStyle=eye;
  ctx.beginPath(); ctx.arc(cx-w*0.14,cy-w*0.05,w*0.05,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+w*0.14,cy-w*0.05,w*0.05,0,Math.PI*2); ctx.fill();
}

function drawLegendaryIntro() {
  const intro = Game.legendaryIntro;
  if (!intro) return;
  const T = performance.now()/1000;
  intro.timer -= 1/60;
  if (intro.timer <= 0) { Game.legendaryIntro = null; return; }
  const max = intro.maxTimer;
  // Slide in from top, hold, fade out
  const slideIn = Math.min(1, (max - intro.timer) / 0.6);
  const fadeOut = intro.timer < 1.2 ? intro.timer / 1.2 : 1;
  const alpha = Math.min(slideIn, fadeOut);
  const yOff = (1 - slideIn) * -220;
  const cx = W/2, panW = Math.min(620, W-40), panH = 200;
  const py = H*0.12 + yOff;

  ctx.save(); ctx.globalAlpha = alpha;
  // Dark panel
  ctx.fillStyle="rgba(6,4,14,0.92)";
  roundedRect(cx-panW/2, py, panW, panH, 16); ctx.fill();
  // Border glow
  const ET = ENEMY_TYPES[intro.bossType];
  ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.5*alpha;
  ctx.strokeStyle=ET.eye; ctx.lineWidth=2;
  roundedRect(cx-panW/2, py, panW, panH, 16); ctx.stroke();
  ctx.restore();
  // Boss head on the left
  drawLegendaryBossHead(intro, cx-panW/2+110, py+panH/2, 72);
  // Text on the right
  const tx = cx-panW/2+210;
  ctx.fillStyle="rgba(255,255,255,0.35)"; ctx.font="11px Trebuchet MS"; ctx.textAlign="left";
  ctx.fillText("⚔ LEGENDARISK BOSS ANKOMMER", tx, py+38);
  ctx.fillStyle="#f2c14e"; ctx.font="bold 28px Trebuchet MS";
  ctx.fillText(ET.name, tx, py+74);
  ctx.fillStyle=ET.eye; ctx.font="13px Trebuchet MS";
  ctx.fillText("Dag " + Game.day + "  ·  Specielt angreb: " + (ET.attackName||""), tx, py+98);
  ctx.fillStyle="rgba(240,230,210,0.7)"; ctx.font="12px Trebuchet MS";
  const descs = {
    legend1:"Stamper jorden og sender en shockwave der ødelægger alt inden for 200px.",
    legend2:"Lader op og charger med lynhurtig fart og knuser alt i vejen.",
    legend3:"Udsender en kæmpemæssig tomhedspuls der rammer alt inden for 310px.",
  };
  ctx.fillText(descs[intro.bossType]||"", tx, py+120);
  // HP/size bar
  ctx.fillStyle="rgba(255,255,255,0.1)"; roundedRect(tx, py+140, panW-230, 12, 6); ctx.fill();
  ctx.fillStyle=ET.eye;
  const barW=(panW-230)*(intro.bossType==="legend3"?1:intro.bossType==="legend2"?0.7:0.45);
  roundedRect(tx, py+140, barW, 12, 6); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,0.5)"; ctx.font="10px Trebuchet MS"; ctx.textAlign="left";
  ctx.fillText("Liv: " + ET.hp, tx, py+168);
  ctx.restore();
}
