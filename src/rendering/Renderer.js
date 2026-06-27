import { clamp, lerp, lerpColor, rgb, withA, shade, hazeColor, atmo, dist } from '../util/math.js';
import { CFG, STATIONS_X } from '../config/config.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { WEAPONS, RARITY_COL } from '../config/weapons.js';
import { LOC_DEFS } from '../config/locations.js';
import { ctx, W, H, groundY } from '../canvas.js';
import { Game, state } from '../state.js';
import {
  FX, biomeAt, skyColors, darkness, windGust, windSway,
  getTrees, getDeco, getGroundTex,
  drawTreeLayer, drawStars, drawAurora, drawCelestial, drawClouds, drawBirds,
  drawHills, drawFogBand, drawGodrays, drawLowFog, drawAmbientFront,
} from './Effects.js';
import { wallHeight } from '../entities/Wall.js';

// ---------- Shared helpers ----------
export function groundShadow(x, w, a) {
  ctx.save(); ctx.globalAlpha=a; ctx.fillStyle="#0a0810";
  ctx.beginPath(); ctx.ellipse(x,groundY+2,w,w*0.26,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}

function drawHpBar(x, y, w, frac, color) {
  frac=clamp(frac,0,1); if (frac>=0.999) return;
  ctx.fillStyle="rgba(0,0,0,0.55)"; ctx.fillRect(x-w/2-1,y-1,w+2,5);
  ctx.fillStyle=color; ctx.fillRect(x-w/2,y,w*frac,3);
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
    const ww=w.level===2?34:26;
    if (w.flash>0) w.flash-=0.016;
    const flash=w.flash>0;
    groundShadow(x,ww*0.7,0.26);
    ctx.fillStyle=flash?"#e8d8a8":(w.level===2?"#6b6b78":"#7a5a36");
    roundedRect(x-ww/2,groundY-h,ww,h,4); ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.10)"; roundedRect(x-ww/2,groundY-h,ww*0.3,h,4); ctx.fill();
    ctx.fillStyle="rgba(0,0,0,0.18)"; ctx.fillRect(x+ww*0.28,groundY-h,ww*0.22,h);
    ctx.strokeStyle="rgba(0,0,0,0.22)"; ctx.lineWidth=1;
    for (let yy=groundY-h+8;yy<groundY-4;yy+=9) { ctx.beginPath(); ctx.moveTo(x-ww/2+2,yy); ctx.lineTo(x+ww/2-2,yy); ctx.stroke(); }
    ctx.fillStyle=w.level===2?"#5a5a66":"#634828";
    for (let i=-1;i<=1;i++) ctx.fillRect(x-ww/2+(i+1)*(ww/3),groundY-h-6,ww/4,7);
    if (night&&w.buildProgress>0.6) drawTorch(x,groundY-h-4);
    drawHpBar(x,groundY-h-18,ww+6,w.hp/w.maxHp,"#9bd05a");
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

function drawHumanoid(x, anim, bodyCol, headCol, tool, dir, moving) {
  ctx.save(); ctx.translate(x,0); if (dir<0) ctx.scale(-1,1);
  const bob=moving?Math.abs(Math.sin(anim))*1.2:0;
  legs(0,groundY-15,anim,moving?5:0,bodyCol);
  ctx.fillStyle=bodyCol; roundedRect(-5,groundY-34-bob,10,20,4); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.18)"; roundedRect(2,groundY-34-bob,3,20,2); ctx.fill();
  ctx.fillStyle=headCol; ctx.beginPath(); ctx.arc(0,groundY-38-bob,5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.22)"; ctx.beginPath(); ctx.arc(-1,groundY-40-bob,5,Math.PI*1.05,Math.PI*2); ctx.fill();
  if (tool==="bow") {
    ctx.fillStyle="#7a7a8a"; ctx.beginPath(); ctx.arc(0,groundY-39-bob,5.5,Math.PI,0); ctx.fill();
    ctx.fillRect(-5.5,groundY-39-bob,11,3); ctx.fillStyle="#6a6a7a"; ctx.fillRect(-1,groundY-38-bob,2,5);
    ctx.fillStyle="#5a6a50"; roundedRect(-5,groundY-34-bob,10,20,4); ctx.fill();
    ctx.fillStyle="#6a7a5e"; ctx.fillRect(-4,groundY-34-bob,8,3);
    ctx.fillStyle="#6a4a2a"; ctx.fillRect(-7,groundY-34-bob,3,12);
    ctx.strokeStyle="#e8d8a8"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(-6,groundY-35-bob); ctx.lineTo(-5,groundY-42-bob); ctx.stroke();
    ctx.strokeStyle="#8a5a2a"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(8,groundY-28-bob,9,-1.2,1.2); ctx.stroke();
    ctx.strokeStyle="rgba(230,216,168,0.8)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(8+Math.cos(-1.2)*9,groundY-28-bob+Math.sin(-1.2)*9); ctx.lineTo(8+Math.cos(1.2)*9,groundY-28-bob+Math.sin(1.2)*9); ctx.stroke();
  } else if (tool==="hammer") {
    ctx.fillStyle="rgba(0,0,0,0.2)"; roundedRect(-5,groundY-26-bob,10,10,2); ctx.fill();
    ctx.strokeStyle="#6a4a2a"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(7,groundY-30-bob); ctx.lineTo(11,groundY-22-bob); ctx.stroke();
    ctx.fillStyle="#8a8a92"; ctx.fillRect(6,groundY-34-bob,8,5);
  } else if (tool==="scythe") {
    ctx.fillStyle="#c9a24a"; ctx.beginPath(); ctx.ellipse(0,groundY-42-bob,8,2.6,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(0,groundY-43-bob,4,Math.PI,0); ctx.fill();
    ctx.strokeStyle="#6a4a2a"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(7,groundY-34-bob); ctx.lineTo(9,groundY-16-bob); ctx.stroke();
    ctx.strokeStyle="#bdbdc6"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(9,groundY-34-bob,6,Math.PI*1.1,Math.PI*1.9); ctx.stroke();
  }
  ctx.restore();
}

export function drawVagrants() {
  for (const v of state.vagrants)
    drawHumanoid(v.x,v.anim,"#4a4438","#9a8a6a",null,v.vx>=0?1:-1,Math.abs(v.vx)>1);
}

export function drawUnits() {
  for (const u of state.units) {
    let body="#3a3550", head="#caa483", tool=null;
    if (u.role==="archer")  { body="#2f5040"; tool="bow"; }
    else if (u.role==="builder") { body="#6a4a28"; tool="hammer"; }
    else if (u.role==="farmer")  { body="#5a6a2a"; tool="scythe"; }
    drawHumanoid(u.x,u.anim,body,head,tool,u.dir,u.moving);
    if (u.transform>0) {
      const p=u.transform/0.55;
      ctx.save(); ctx.globalAlpha=p*0.7; ctx.globalCompositeOperation="lighter";
      const grd=ctx.createRadialGradient(u.x,groundY-28,2,u.x,groundY-28,28*p);
      grd.addColorStop(0,"#ffffff"); grd.addColorStop(0.4,"#9bd05a"); grd.addColorStop(1,"transparent");
      ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(u.x,groundY-28,28*p,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    if (u.hp<u.maxHp) drawHpBar(u.x,groundY-46,16,u.hp/u.maxHp,"#9bd05a");
  }
}

export function drawEnemies(dark) {
  for (const e of state.enemies) {
    const t=ENEMY_TYPES[e.type];
    ctx.save(); ctx.translate(e.x,0); if (e.dir<0) ctx.scale(-1,1);
    const w=t.w, bob=Math.abs(Math.sin(e.anim*2))*2, s=Math.sin(e.anim*3);
    ctx.strokeStyle=e.flash>0?"#fff":t.color; ctx.lineWidth=Math.max(2,w*0.12); ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(-w*0.25,groundY-8-bob); ctx.lineTo(-w*0.25+s*5,groundY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w*0.25,groundY-8-bob); ctx.lineTo(w*0.25-s*5,groundY); ctx.stroke();
    ctx.lineCap="butt";
    ctx.fillStyle=e.flash>0?"#ffffff":t.color;
    roundedRect(-w/2,groundY-w-6-bob,w,w+6,w*0.4); ctx.fill();
    if (e.type==="brute"||e.type==="boss") {
      ctx.fillStyle=e.flash>0?"#fff":t.color;
      for (let i=-1;i<=1;i++) { const sx=i*w*0.28; ctx.beginPath(); ctx.moveTo(sx-3,groundY-w-2-bob); ctx.lineTo(sx,groundY-w-13-bob); ctx.lineTo(sx+3,groundY-w-2-bob); ctx.fill(); }
    }
    ctx.fillStyle="rgba(255,255,255,0.06)"; roundedRect(-w/2,groundY-w-6-bob,w*0.34,w+6,w*0.4); ctx.fill();
    const ex=w*0.12, ex2=w*0.32, ey=groundY-w*0.6-bob;
    ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.4+0.35*dark; ctx.fillStyle=t.eye;
    ctx.beginPath(); ctx.arc(ex,ey,w*0.22,0,Math.PI*2); ctx.arc(ex2,ey,w*0.22,0,Math.PI*2); ctx.fill(); ctx.restore();
    ctx.fillStyle=t.eye; ctx.beginPath(); ctx.arc(ex,ey,w*0.09,0,Math.PI*2); ctx.arc(ex2,ey,w*0.09,0,Math.PI*2); ctx.fill();
    if (e.carry>0) { ctx.fillStyle="#f2c14e"; ctx.beginPath(); ctx.arc(0,groundY-w-12-bob,4,0,Math.PI*2); ctx.fill(); }
    ctx.restore();
    if (e.hp<e.maxHp) drawHpBar(e.x,groundY-t.w-16,t.w+4,e.hp/e.maxHp,"#d05a5a");
  }
}

export function drawPlayer(dark) {
  const { player } = state;
  const x=player.x, bob=player.bob, gallop=player.gallop;
  ctx.save();
  if (player.invuln>0&&Math.floor(player.invuln*12)%2===0) ctx.globalAlpha=0.45;
  ctx.translate(x,-bob); if (player.dir<0) ctx.scale(-1,1);
  const px=0, moving=Math.abs(player.vx)>1, s=moving?Math.sin(gallop*2):0;
  ctx.fillStyle="#2a2230"; ctx.strokeStyle="#2a2230"; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(px-14,groundY-26+bob); ctx.lineTo(px-14+s*8,groundY+bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px+12,groundY-26+bob); ctx.lineTo(px+12-s*8,groundY+bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px-8,groundY-26+bob); ctx.lineTo(px-8-s*8,groundY+bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px+18,groundY-26+bob); ctx.lineTo(px+18+s*8,groundY+bob); ctx.stroke();
  roundedRect(px-20,groundY-46,44,22,10); ctx.fill();
  ctx.beginPath(); ctx.moveTo(px+18,groundY-44); ctx.lineTo(px+30,groundY-64); ctx.lineTo(px+40,groundY-62); ctx.lineTo(px+38,groundY-52); ctx.lineTo(px+26,groundY-40); ctx.closePath(); ctx.fill();
  const tail=windSway(px,4)+Math.sin(gallop)*2;
  ctx.beginPath(); ctx.moveTo(px-20,groundY-44); ctx.quadraticCurveTo(px-34-tail,groundY-40,px-30-tail,groundY-22); ctx.lineTo(px-24-tail*0.6,groundY-30); ctx.quadraticCurveTo(px-26,groundY-40,px-18,groundY-40); ctx.fill();
  ctx.strokeStyle="#1c1622"; ctx.lineWidth=2;
  for (let i=0;i<4;i++) { const t=i/3, mx=lerp(px+20,px+33,t), my=lerp(groundY-46,groundY-62,t); ctx.beginPath(); ctx.moveTo(mx,my); ctx.lineTo(mx-4,my-3); ctx.stroke(); }
  ctx.fillStyle="#f2c14e"; ctx.beginPath(); ctx.arc(px+34,groundY-58,1.4,0,Math.PI*2); ctx.fill();
  const cape=(moving?Math.sin(gallop*2)*4:0)+windSway(px,3);
  ctx.fillStyle="#5a182e"; ctx.beginPath(); ctx.moveTo(px-4,groundY-66); ctx.quadraticCurveTo(px-16-cape,groundY-52,px-22-cape*1.4,groundY-32); ctx.lineTo(px-8,groundY-40); ctx.quadraticCurveTo(px-6,groundY-54,px+2,groundY-64); ctx.fill();
  ctx.fillStyle="#7a2440"; roundedRect(px-6,groundY-70,16,26,6); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.18)"; roundedRect(px+4,groundY-70,6,26,4); ctx.fill();
  ctx.fillStyle="#caa483"; ctx.beginPath(); ctx.arc(px+2,groundY-74,6,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#3a2e2a"; ctx.beginPath(); ctx.arc(px+4,groundY-75,1.1,0,Math.PI*2); ctx.fill();
  if (player.hasCrown) {
    ctx.fillStyle="#f2c14e"; ctx.beginPath();
    ctx.moveTo(px-4,groundY-80); ctx.lineTo(px-4,groundY-86); ctx.lineTo(px-1,groundY-82);
    ctx.lineTo(px+2,groundY-87); ctx.lineTo(px+5,groundY-82); ctx.lineTo(px+8,groundY-86); ctx.lineTo(px+8,groundY-80); ctx.closePath(); ctx.fill();
  }
  if (player.weapon) {
    const w=WEAPONS[player.weapon], sw=player.swing||0;
    ctx.save();
    if (w.type==="melee") {
      const baseAng=-0.22, swingOff=sw>0?-0.9*(sw/0.32):0;
      ctx.translate(px+10,groundY-58); ctx.rotate(baseAng+swingOff);
      const len=clamp(w.range*0.42,18,40);
      ctx.strokeStyle=w.col; ctx.lineWidth=2.5; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(len,0); ctx.stroke();
      ctx.strokeStyle="rgba(0,0,0,0.5)"; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(-4,-3); ctx.lineTo(-4,3); ctx.stroke();
      if (w.rarity>=2) {
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.28+sw*0.4;
        ctx.strokeStyle=w.col; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(len,0); ctx.stroke(); ctx.restore();
      }
    } else {
      ctx.strokeStyle=w.col; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(px+14,groundY-58,10,-1.25,1.25); ctx.stroke();
      ctx.strokeStyle="rgba(230,216,168,0.65)"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(px+14+10*Math.cos(-1.25),groundY-58+10*Math.sin(-1.25)); ctx.lineTo(px+14+10*Math.cos(1.25),groundY-58+10*Math.sin(1.25)); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
  const n=player.maxHp, gap=9, hy=groundY-98-bob;
  for (let i=0;i<n;i++) drawHeart(player.x-(n-1)*gap/2+i*gap, hy, 4, i<player.hp?"#e0556a":"rgba(255,255,255,0.18)");
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
  ctx.strokeStyle="#e8d8a8"; ctx.lineWidth=2;
  for (const ar of state.arrows) {
    const ang=Math.atan2(ar.vy,ar.vx);
    ctx.save(); ctx.translate(ar.x,ar.y); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(-7,0); ctx.lineTo(5,0); ctx.stroke();
    ctx.fillStyle="#e8d8a8"; ctx.beginPath(); ctx.moveTo(5,0); ctx.lineTo(1,-2); ctx.lineTo(1,2); ctx.fill();
    ctx.restore();
  }
}

export function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha=p.fly?1:clamp(p.life*1.5,0,1);
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
  for (const s of FX.smoke) { const k=s.t/s.life; ctx.globalAlpha=(1-k)*0.16; ctx.fillStyle="rgba(58,54,58,1)"; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill(); }
  ctx.globalAlpha=1;
  const warm=Math.max(dark,Game.isNight?0.55:0)*0.95;
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
  const camL=Game.cam-220, camR=Game.cam+W+220;
  for (const loc of locations) {
    if (loc.x<camL||loc.x>camR) continue;
    LOC_DRAWERS[loc.type]?.(loc.x, dark);
    const d=dist(player.x,loc.x);
    if (d<220) {
      const def=LOC_DEFS[loc.type], a=clamp((220-d)/120,0,1);
      ctx.save(); ctx.globalAlpha=a; ctx.font="bold 13px Trebuchet MS"; ctx.textAlign="center";
      ctx.fillStyle="rgba(0,0,0,0.55)"; ctx.fillText(def.emoji+" "+def.name,loc.x+1,groundY-80+1);
      ctx.fillStyle=(loc.triggered&&!loc.cleared)?"#ff8a6a":"#f0e6cf";
      ctx.fillText(def.emoji+" "+def.name,loc.x,groundY-80);
      ctx.restore();
    }
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

export function drawLootItems() {
  if (!state.lootItems) return;
  const t=performance.now()/1000;
  for (const it of state.lootItems) {
    const w=WEAPONS[it.weaponId], bob=Math.sin(t*2.5+it.x*0.01)*3, yy=groundY-16+bob, rc=RARITY_COL[w.rarity];
    ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.2+0.12*Math.sin(t*3+it.x*0.004);
    ctx.fillStyle=rc; ctx.beginPath(); ctx.arc(it.x,yy,14,0,Math.PI*2); ctx.fill(); ctx.restore();
    groundShadow(it.x,9,0.22);
    ctx.save(); ctx.translate(it.x,yy); ctx.rotate(-0.35+Math.sin(t*1.2+it.x*0.005)*0.07);
    ctx.strokeStyle=w.col; ctx.lineWidth=3; ctx.lineCap="round";
    if (w.type==="melee") {
      const len=clamp(w.range*0.28,12,26);
      ctx.beginPath(); ctx.moveTo(-len/2,0); ctx.lineTo(len/2,0); ctx.stroke();
      ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(-len*0.3,-5); ctx.lineTo(-len*0.3,5); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(0,0,9,-1.3,1.3); ctx.stroke();
      ctx.strokeStyle="#e8d8a8"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(9*Math.cos(-1.3),9*Math.sin(-1.3)); ctx.lineTo(9*Math.cos(1.3),9*Math.sin(1.3)); ctx.stroke();
    }
    ctx.restore();
    ctx.save(); ctx.font="10px Trebuchet MS"; ctx.textAlign="center";
    ctx.fillStyle="rgba(0,0,0,0.55)"; ctx.fillText(w.name,it.x+1,groundY-33+1);
    ctx.fillStyle=rc; ctx.fillText(w.name,it.x,groundY-33); ctx.restore();
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

// ---------- Main render ----------
export function render() {
  const dark=darkness();
  const [top,bot]=skyColors();
  const g=ctx.createLinearGradient(0,0,0,groundY+80);
  g.addColorStop(0,rgb(top)); g.addColorStop(0.62,rgb(lerpColor(top,bot,0.6))); g.addColorStop(1,rgb(bot));
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  drawAurora(dark); drawStars(dark); drawCelestial(top); drawClouds(dark,top); drawBirds(dark);

  const trees=getTrees();
  drawHills(trees.hills,dark);
  drawTreeLayer(trees.far,0.26,0.78,5);
  drawFogBand(groundY-150,110,dark,0.6);
  drawTreeLayer(trees.mid,0.46,0.50,9);
  drawGodrays(dark);
  drawTreeLayer(trees.near,0.70,0.28,14);

  const bi=biomeAt(Game.cam+W/2);
  const gg=ctx.createLinearGradient(0,groundY,0,H);
  gg.addColorStop(0,rgb(lerpColor(bi.gT,[14,16,26],dark)));
  gg.addColorStop(1,rgb(lerpColor(bi.gB,[6,8,16],dark)));
  ctx.fillStyle=gg; ctx.fillRect(0,groundY,W,H-groundY);
  ctx.fillStyle=withA(lerpColor(shade(bi.gT,1.25),[44,48,64],dark),0.55);
  ctx.fillRect(0,groundY,W,2);

  ctx.save(); ctx.translate(-Game.cam,0);
  drawGroundTexture(dark); drawGroundDeco(dark); drawLocations(dark);
  drawEntityShadows(); drawPortals(dark); drawWalls(dark); drawBase(dark);
  drawStations(); drawCoins(); drawGroundBows(); drawLootItems();
  drawAnimals(); drawVagrants(); drawUnits(); drawEnemies(dark);
  drawPlayer(dark); drawArrows(); drawParticles(); drawCampLight(dark); drawFloats();
  ctx.restore();

  drawTreeLayer(trees.fore,1.06,0.04,20,0.45);
  drawLowFog(dark,bi); drawAmbientFront(dark,bi);

  const v=ctx.createRadialGradient(W/2,groundY-60,W*0.18,W/2,groundY-60,W*0.82);
  v.addColorStop(0,"rgba(0,0,0,0)"); v.addColorStop(1,`rgba(4,3,12,${0.22+0.42*dark})`);
  ctx.fillStyle=v; ctx.fillRect(0,0,W,H);

  drawOffscreenIndicators();
}
