import { clamp, lerp, lerpColor, rgb, withA, shade, atmo, hazeColor } from '../../util/math.js';
import { CFG, STATIONS_X } from '../../config/config.js';
import { ctx, W, H, groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { FX, biomeAt, getGroundTex, getDeco, windGust, windSway, drawTree } from '../Effects.js';
import { wallHeight } from '../../entities/Wall.js';
import { groundShadow, roundedRect, stoneCol, stoneLt, woodCol, litWindow, drawHpBar } from '../DrawHelpers.js';
import { ENEMY_TYPES } from '../../config/enemies.js';

// ---------- Ground ----------
export function drawGroundTexture(dark) {
  const tex=getGroundTex(), camL=Game.cam-30, camR=Game.cam+W+30;
  for (const p of tex.patches) {
    if (p.x<camL||p.x>camR) continue;
    const b=biomeAt(p.x), col=lerpColor(p.light?shade(b.gT,1.16):shade(b.gT,0.8),[12,14,22],dark);
    ctx.fillStyle=withA(col,0.5); ctx.beginPath(); ctx.ellipse(p.x,groundY+7+p.dy,p.r,p.r*0.4,0,0,Math.PI*2); ctx.fill();
  }
  for (const p of tex.pebbles) {
    if (p.x<camL||p.x>camR) continue;
    ctx.fillStyle=withA(lerpColor([120,118,124],[40,40,52],dark),0.7); ctx.beginPath(); ctx.ellipse(p.x,groundY+9+p.dy,p.r,p.r*0.7,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=withA(lerpColor([200,200,206],[70,72,86],dark),0.35); ctx.beginPath(); ctx.ellipse(p.x-p.r*0.25,groundY+8.4+p.dy,p.r*0.5,p.r*0.3,0,0,Math.PI*2); ctx.fill();
  }
  // fine dirt speckles give the soil grain
  if (tex.specks) for (const s of tex.specks) {
    if (s.x<camL||s.x>camR) continue;
    const b=biomeAt(s.x);
    const col=s.light?lerpColor(shade(b.gB,1.5),[60,64,80],dark):lerpColor(shade(b.gB,0.55),[8,10,16],dark);
    ctx.fillStyle=withA(col,0.55);
    ctx.fillRect(s.x,groundY+s.dy,s.r*2,s.r);
  }
  ctx.lineCap="round";
  const plx=state.player?state.player.x:null;
  for (const f of tex.fringe) {
    if (f.x<camL||f.x>camR) continue;
    // thin out grass blades right in front of the player so the figure stays clear
    if (plx!==null) {
      const d=Math.abs(f.x-plx);
      if (d<70) { ctx.globalAlpha=Math.max(0.3,d/70); } else ctx.globalAlpha=1;
    }
    const b=biomeAt(f.x), col=b.snow?lerpColor([226,233,243],[120,140,170],dark):lerpColor(shade(b.gT,f.lt?1.28:1.04),[18,26,18],dark);
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

export function drawGroundDeco(dark) {
  const items=getDeco().items, camL=Game.cam-40, camR=Game.cam+W+40;
  const px=state.player?state.player.x:null;
  for (const it of items) {
    if (it.x<camL||it.x>camR) continue;
    // fade small clutter near the player so characters stay easy to spot
    const d=px===null?999:Math.abs(it.x-px);
    if (d<110) {
      ctx.save(); ctx.globalAlpha=Math.max(0.25,d/110);
      drawDeco(it,biomeAt(it.x),dark);
      ctx.restore();
    } else drawDeco(it,biomeAt(it.x),dark);
  }
}

// ---------- Building pieces ----------
function drawTorch(x, y) {
  const t=performance.now()/1000, fl=(FX&&FX.flicker)||1;
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

// Max-level castle: curtain wall, gatehouse, flanked towers with conical
// roofs, tall central keep with corner turrets, banners and gold-lit windows.
function drawGrandCastle(x, l, d, dark, night) {
  const wallH=64, wallW=340;
  const glow=litWindow(dark);
  const win=(wx,wy,ww,wh)=>{ // arched gold-lit window with stone sill
    ctx.fillStyle="#2a2530";
    ctx.beginPath(); ctx.moveTo(wx-ww/2-1,wy+wh); ctx.lineTo(wx-ww/2-1,wy+ww*0.5); ctx.arc(wx,wy+ww*0.5,ww/2+1,Math.PI,0); ctx.lineTo(wx+ww/2+1,wy+wh); ctx.closePath(); ctx.fill();
    ctx.fillStyle=`rgba(255,186,86,${glow})`;
    ctx.beginPath(); ctx.moveTo(wx-ww/2,wy+wh); ctx.lineTo(wx-ww/2,wy+ww*0.5); ctx.arc(wx,wy+ww*0.5,ww/2,Math.PI,0); ctx.lineTo(wx+ww/2,wy+wh); ctx.closePath(); ctx.fill();
    ctx.strokeStyle="rgba(30,24,34,0.75)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(wx,wy+1); ctx.lineTo(wx,wy+wh); ctx.stroke();
  };
  const crenel=(cx,cw,cy,n,mh=9)=>{ // battlement teeth with shadowed gaps
    const mW=cw/(n*2-1);
    ctx.fillStyle=d;
    for (let i=0;i<n;i++) ctx.fillRect(cx-cw/2+i*mW*2,cy-mh,mW,mh+1);
    ctx.fillStyle="rgba(255,255,255,0.08)";
    for (let i=0;i<n;i++) ctx.fillRect(cx-cw/2+i*mW*2,cy-mh,mW,2);
  };
  const stoneJoints=(sx,sy,sw,sh,step)=>{
    ctx.strokeStyle="rgba(0,0,0,0.18)"; ctx.lineWidth=1;
    for (let yy=sy+step; yy<sy+sh-3; yy+=step) { ctx.beginPath(); ctx.moveTo(sx+2,yy); ctx.lineTo(sx+sw-2,yy); ctx.stroke(); }
    for (let yy=sy+step,r=0; yy<sy+sh-3; yy+=step,r++) {
      for (let xx=sx+((r%2)?step*1.4:step*0.7); xx<sx+sw-4; xx+=step*1.4)
        { ctx.beginPath(); ctx.moveTo(xx,yy); ctx.lineTo(xx,Math.min(yy+step,sy+sh-2)); ctx.stroke(); }
    }
  };
  const banner=(bx,by,col)=>{
    const sway=windSway(bx,4);
    ctx.strokeStyle="#cdbfa3"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(bx,by-20); ctx.stroke();
    ctx.fillStyle=col;
    ctx.beginPath(); ctx.moveTo(bx,by-20);
    ctx.quadraticCurveTo(bx+11+sway,by-18,bx+19+sway,by-13.5);
    ctx.quadraticCurveTo(bx+11+sway,by-9,bx,by-7); ctx.closePath(); ctx.fill();
    ctx.fillStyle="rgba(0,0,0,0.15)";
    ctx.beginPath(); ctx.moveTo(bx,by-20); ctx.quadraticCurveTo(bx+9+sway,by-14,bx,by-7); ctx.closePath(); ctx.fill();
  };
  const cone=(cx,cy,r,hh)=>{ // slate turret roof with gold finial
    ctx.fillStyle="#25406a";
    ctx.beginPath(); ctx.moveTo(cx-r,cy); ctx.lineTo(cx,cy-hh); ctx.lineTo(cx+r,cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.moveTo(cx-r,cy); ctx.lineTo(cx,cy-hh); ctx.lineTo(cx-r*0.2,cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle="rgba(0,0,0,0.25)";
    ctx.beginPath(); ctx.moveTo(cx,cy-hh); ctx.lineTo(cx+r,cy); ctx.lineTo(cx+r*0.3,cy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle="rgba(0,0,0,0.2)"; ctx.lineWidth=1;
    for (let i=1;i<3;i++) { const fy=cy-hh*i/3, half=r*(1-i/3); ctx.beginPath(); ctx.moveTo(cx-half,fy); ctx.lineTo(cx+half,fy); ctx.stroke(); }
    ctx.fillStyle="#f2c14e"; ctx.beginPath(); ctx.arc(cx,cy-hh-2,2.4,0,Math.PI*2); ctx.fill();
  };

  // --- curtain wall behind everything ---
  ctx.fillStyle=d; ctx.fillRect(x-wallW/2,groundY-wallH,wallW,wallH);
  ctx.fillStyle="rgba(0,0,0,0.14)"; ctx.fillRect(x-wallW/2,groundY-wallH,wallW,6);
  stoneJoints(x-wallW/2,groundY-wallH,wallW,wallH,11);
  crenel(x-wallW/2+52,86,groundY-wallH,5);
  crenel(x+wallW/2-52,86,groundY-wallH,5);
  // arrow slits along the wall
  ctx.fillStyle="rgba(0,0,0,0.5)";
  for (const sx of [-140,-110,110,140]) ctx.fillRect(x+sx-2,groundY-wallH*0.62,4,13);

  // --- flanking towers ---
  for (const side of [-1,1]) {
    const tx=x+side*112, tw=52, th=178;
    ctx.fillStyle=d; ctx.fillRect(tx-tw/2,groundY-th,tw,th);
    ctx.fillStyle="rgba(255,255,255,0.07)"; ctx.fillRect(tx-tw/2,groundY-th,tw*0.3,th);
    ctx.fillStyle="rgba(0,0,0,0.18)"; ctx.fillRect(tx+tw*0.2,groundY-th,tw*0.3,th);
    stoneJoints(tx-tw/2,groundY-th,tw,th,12);
    // corbelled top ledge
    ctx.fillStyle=l; ctx.fillRect(tx-tw/2-5,groundY-th-6,tw+10,7);
    ctx.fillStyle="rgba(0,0,0,0.22)"; ctx.fillRect(tx-tw/2-5,groundY-th-1,tw+10,2);
    cone(tx,groundY-th-6,tw/2+6,34);
    win(tx,groundY-th*0.72,9,14); win(tx,groundY-th*0.42,9,14);
    ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillRect(tx-1.8,groundY-th*0.9,3.6,11);
  }

  // --- central keep ---
  const kw=104, kh=212, ky=groundY-kh;
  ctx.fillStyle=d; ctx.fillRect(x-kw/2,ky,kw,kh);
  ctx.fillStyle="rgba(255,255,255,0.06)"; ctx.fillRect(x-kw/2,ky,kw*0.28,kh);
  ctx.fillStyle="rgba(0,0,0,0.16)"; ctx.fillRect(x+kw*0.22,ky,kw*0.28,kh);
  stoneJoints(x-kw/2,ky,kw,kh,13);
  // string course lines dividing the keep into storeys
  ctx.fillStyle=l;
  ctx.fillRect(x-kw/2-3,ky+kh*0.33,kw+6,4);
  ctx.fillRect(x-kw/2-3,ky+kh*0.62,kw+6,4);
  // battlements + corner turrets
  ctx.fillStyle=l; ctx.fillRect(x-kw/2-6,ky-7,kw+12,8);
  crenel(x,kw-16,ky-7,5,10);
  for (const side of [-1,1]) {
    const ttx=x+side*(kw/2-2), tty=ky-4, tr=9;
    ctx.fillStyle=d; ctx.fillRect(ttx-tr,tty-26,tr*2,26);
    ctx.fillStyle=side<0?"rgba(255,255,255,0.09)":"rgba(0,0,0,0.18)";
    ctx.fillRect(ttx-tr,tty-26,tr*0.9,26);
    cone(ttx,tty-26,tr+3,20);
    win(ttx,tty-20,5,8);
  }
  // grand roof banner
  banner(x,ky-34,"#c1453b");
  banner(x-112,groundY-178-40,"#f2c14e");
  banner(x+112,groundY-178-40,"#f2c14e");
  // keep windows
  win(x,ky+kh*0.14,13,20);
  win(x-24,ky+kh*0.42,10,15); win(x+24,ky+kh*0.42,10,15);
  ctx.fillStyle="rgba(0,0,0,0.5)";
  ctx.fillRect(x-30,ky+kh*0.2,4,13); ctx.fillRect(x+26,ky+kh*0.2,4,13);

  // --- gatehouse arch with portcullis ---
  const gw=42, gh=56;
  ctx.fillStyle=l;
  ctx.beginPath(); ctx.moveTo(x-gw/2-6,groundY); ctx.lineTo(x-gw/2-6,groundY-gh+4); ctx.arc(x,groundY-gh+4,gw/2+6,Math.PI,0); ctx.lineTo(x+gw/2+6,groundY); ctx.closePath(); ctx.fill();
  ctx.fillStyle="#221a28";
  ctx.beginPath(); ctx.moveTo(x-gw/2,groundY); ctx.lineTo(x-gw/2,groundY-gh+6); ctx.arc(x,groundY-gh+6,gw/2,Math.PI,0); ctx.lineTo(x+gw/2,groundY); ctx.closePath(); ctx.fill();
  // wooden doors, warm-lit at the seam
  ctx.fillStyle="#4e3820";
  ctx.beginPath(); ctx.moveTo(x-gw/2+3,groundY); ctx.lineTo(x-gw/2+3,groundY-gh+9); ctx.arc(x,groundY-gh+9,gw/2-3,Math.PI,0); ctx.lineTo(x+gw/2-3,groundY); ctx.closePath(); ctx.fill();
  ctx.strokeStyle="rgba(0,0,0,0.3)"; ctx.lineWidth=1.2;
  for (const dxx of [-12,-4,4,12]) { ctx.beginPath(); ctx.moveTo(x+dxx,groundY); ctx.lineTo(x+dxx,groundY-gh+16); ctx.stroke(); }
  ctx.fillStyle=`rgba(255,186,86,${glow*0.7})`; ctx.fillRect(x-1,groundY-gh+16,2,gh-16);
  // iron portcullis raised in the arch
  ctx.strokeStyle="#3c3c46"; ctx.lineWidth=2;
  for (const dxx of [-14,-7,0,7,14]) { ctx.beginPath(); ctx.moveTo(x+dxx,groundY-gh+8); ctx.lineTo(x+dxx,groundY-gh+22); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x-gw/2+4,groundY-gh+15); ctx.lineTo(x+gw/2-4,groundY-gh+15); ctx.stroke();
  // gold keystone crest above the gate
  ctx.fillStyle="#f2c14e";
  ctx.beginPath(); ctx.moveTo(x,groundY-gh-14); ctx.lineTo(x+7,groundY-gh-4); ctx.lineTo(x,groundY-gh+4); ctx.lineTo(x-7,groundY-gh-4); ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.22)";
  ctx.beginPath(); ctx.moveTo(x,groundY-gh-14); ctx.lineTo(x+7,groundY-gh-4); ctx.lineTo(x,groundY-gh-4); ctx.closePath(); ctx.fill();

  // --- night dressing: wall sconces + window warm spill ---
  if (night) {
    drawTorch(x-gw/2-14,groundY-26); drawTorch(x+gw/2+14,groundY-26);
    drawTorch(x-112-32,groundY); drawTorch(x+112+32,groundY);
    ctx.save(); ctx.globalCompositeOperation="lighter";
    const wg=ctx.createRadialGradient(x,ky+kh*0.2,4,x,ky+kh*0.2,44);
    wg.addColorStop(0,"rgba(255,180,80,0.16)"); wg.addColorStop(1,"rgba(255,140,50,0)");
    ctx.fillStyle=wg; ctx.beginPath(); ctx.arc(x,ky+kh*0.2,44,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
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
  const camL = Game.cam - 60, camR = Game.cam + W + 60;
  for (const ft of state.forestTrees) {
    if (ft.x < camL || ft.x > camR) continue;
    if (ft.chopped || ft.carriedBy) continue;
    const b = biomeAt(ft.x);
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

    drawTree(ft.tree, ft.x, groundY + 4, light, dcol, depth, 16);
    // ferny undergrowth hugging the trunk base
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
    if (ft.marked) {
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
  const camL = Game.cam - 200, camR = Game.cam + W + 200;
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
    if (camp.triggered) continue;

    const x = camp.x;

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
      roundedRect(x-WW/2,groundY-h,WW,h,4); ctx.fillStyle=col; ctx.fill();
      ctx.fillStyle="rgba(255,255,255,0.08)"; roundedRect(x-WW/2,groundY-h,WW*0.3,h,4); ctx.fill();
      ctx.fillStyle="rgba(0,0,0,0.18)"; ctx.fillRect(x+WW*0.28,groundY-h,WW*0.22,h);
      if (w.level >= 2) {
        ctx.strokeStyle="rgba(0,0,0,0.22)"; ctx.lineWidth=1;
        for (let yy=groundY-h+8;yy<groundY-4;yy+=9) { ctx.beginPath(); ctx.moveTo(x-WW/2+2,yy); ctx.lineTo(x+WW/2-2,yy); ctx.stroke(); }
      }
      ctx.fillStyle=col;
      const nM=w.level+2, mW=WW/(nM*2+1);
      for (let i=0;i<nM;i++) ctx.fillRect(x-WW/2+i*(mW*2),groundY-h-8,mW,9);
      if (w.level >= 3) {
        ctx.fillStyle="rgba(0,0,0,0.55)";
        for (let k=0;k<w.level-1;k++) {
          const sx=x-WW/2+8+k*(WW-16)/(w.level-1);
          ctx.fillRect(sx,groundY-h*0.6,5,12);
        }
      }
      if (night&&w.buildProgress>0.6) drawTorch(x,groundY-h-4);
    } else {
      const tw = 96, th = h;
      const platY1 = groundY - th * 0.52;
      const platY2 = groundY - th;
      const platW  = tw + 18;
      const platH  = 9;

      ctx.fillStyle=col; ctx.fillRect(x-tw/2, groundY-th, tw, th);
      ctx.fillStyle="rgba(255,255,255,0.07)"; ctx.fillRect(x-tw/2, groundY-th, tw*0.22, th);
      ctx.fillStyle="rgba(0,0,0,0.16)"; ctx.fillRect(x+tw*0.3, groundY-th, tw*0.22, th);

      ctx.strokeStyle="rgba(0,0,0,0.20)"; ctx.lineWidth=1;
      for (let yy=groundY-th+10; yy<groundY-4; yy+=11) {
        ctx.beginPath(); ctx.moveTo(x-tw/2+2,yy); ctx.lineTo(x+tw/2-2,yy); ctx.stroke();
      }

      ctx.fillStyle="rgba(0,0,0,0.55)";
      ctx.fillRect(x-tw*0.28-2, groundY-th*0.28, 5, 13);
      ctx.fillRect(x+tw*0.18,   groundY-th*0.28, 5, 13);

      ctx.fillStyle=col; ctx.fillRect(x-platW/2, platY1, platW, platH);
      ctx.fillStyle="rgba(255,255,255,0.09)"; ctx.fillRect(x-platW/2, platY1, platW, 3);
      ctx.fillStyle="rgba(0,0,0,0.22)"; ctx.fillRect(x-platW/2, platY1+platH-2, platW, 2);
      ctx.fillStyle=col;
      for (let i=0;i<4;i++) ctx.fillRect(x-platW/2+i*(platW/8*2), platY1-8, platW/8, 9);

      ctx.fillStyle=col; ctx.fillRect(x-platW/2, platY2, platW, platH);
      ctx.fillStyle="rgba(255,255,255,0.09)"; ctx.fillRect(x-platW/2, platY2, platW, 3);
      ctx.fillStyle="rgba(0,0,0,0.22)"; ctx.fillRect(x-platW/2, platY2+platH-2, platW, 2);
      const mW2=platW/10;
      ctx.fillStyle=col;
      for (let i=0;i<5;i++) ctx.fillRect(x-platW/2+i*(mW2*2), platY2-11, mW2, 12);

      const ladX = x + (w.side > 0 ? -tw/2 + 6 : tw/2 - 6);
      const ladTop = platY2 + platH;
      const ladBot = groundY;
      ctx.strokeStyle="#5a3a1a"; ctx.lineWidth=3; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(ladX-5, ladBot); ctx.lineTo(ladX-5, ladTop); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ladX+5, ladBot); ctx.lineTo(ladX+5, ladTop); ctx.stroke();
      ctx.lineWidth=2;
      for (let ry=ladBot-6; ry>ladTop+4; ry-=11) {
        ctx.beginPath(); ctx.moveTo(ladX-5,ry); ctx.lineTo(ladX+5,ry); ctx.stroke();
      }
      const lad2Top = platY1;
      const lad2Bot = platY2 + platH;
      const lad2X   = x + (w.side > 0 ? -tw/2 + 6 : tw/2 - 6);
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
    if (night) { drawTorch(x-58,groundY); drawTorch(x+58,groundY); } drawCampfire(x,dark);
  } else if (lvl===2) {
    drawHouse(x-60,54,stoneL,stoneD,dark); drawHouse(x+58,48,stoneL,stoneD,dark); drawTower(x,100,stoneL,stoneD,dark);
    if (night) { drawTorch(x-92,groundY); drawTorch(x+92,groundY); } drawCampfire(x-6,dark);
  } else if (lvl===3) {
    drawHouse(x-90,60,stoneL,stoneD,dark); drawHouse(x+86,56,stoneL,stoneD,dark);
    drawTower(x-30,120,stoneL,stoneD,dark); drawTower(x+34,110,stoneL,stoneD,dark);
    if (night) { drawTorch(x-122,groundY); drawTorch(x+122,groundY); } drawCampfire(x,dark);
  } else {
    drawGrandCastle(x,stoneL,stoneD,dark,night);
  }
  drawHpBar(x,groundY-(lvl>=4?250:lvl>=2?130:70),70,base.hp/base.maxHp,"#f2c14e");
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
  } else {
    ctx.beginPath(); ctx.moveTo(-1,4.5); ctx.lineTo(1,4.5); ctx.lineTo(1,-2); ctx.lineTo(-1,-2); ctx.closePath(); ctx.fill();
    ctx.fillRect(-4.5,-5,9,3.6);
  }
  ctx.restore();
}

// Market stall that grows with the base: a rough plank hut at lvl 1, a
// striped wooden booth at lvl 2-3, and at lvl 4 a stone annex matching the
// castle masonry with crenellations, lit window and a cloth guild banner.
function drawWallStall(x, canopy, canopyD, emblem) {
  const lvl=state.base?state.base.level:1;

  if (lvl===1) {
    // makeshift stall: crooked posts, plain weathered cloth
    groundShadow(x, 32, 0.2);
    ctx.strokeStyle="#4a3520"; ctx.lineWidth=4; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(x-24,groundY); ctx.lineTo(x-26,groundY-40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+24,groundY); ctx.lineTo(x+25,groundY-38); ctx.stroke();
    ctx.lineCap="butt";
    ctx.fillStyle=canopyD;
    ctx.beginPath(); ctx.moveTo(x-31,groundY-38); ctx.lineTo(x+30,groundY-36); ctx.lineTo(x+26,groundY-48); ctx.lineTo(x-26,groundY-50); ctx.closePath(); ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.08)";
    ctx.beginPath(); ctx.moveTo(x-31,groundY-38); ctx.lineTo(x-26,groundY-50); ctx.lineTo(x-12,groundY-49.5); ctx.lineTo(x-18,groundY-37.5); ctx.closePath(); ctx.fill();
    // frayed hanging corner
    const sway=windSway(x,3);
    ctx.fillStyle=canopyD;
    ctx.beginPath(); ctx.moveTo(x+30,groundY-36); ctx.lineTo(x+26,groundY-48); ctx.lineTo(x+31+sway*0.5,groundY-28); ctx.closePath(); ctx.fill();
    // patch on the cloth
    ctx.fillStyle="rgba(232,216,184,0.5)"; ctx.fillRect(x-6,groundY-46,9,6);
    return;
  }

  if (lvl<4) {
    // timber booth: plank back wall, striped canopy; banner arrives at lvl 3
    const w=56, h=46, top=groundY-h;
    groundShadow(x, 36, 0.22);
    ctx.fillStyle="#6a4a2a"; ctx.fillRect(x-w/2,top,w,h);
    ctx.fillStyle="rgba(255,255,255,0.07)"; ctx.fillRect(x-w/2,top,w*0.3,h);
    ctx.fillStyle="rgba(0,0,0,0.16)"; ctx.fillRect(x+w*0.2,top,w*0.3,h);
    ctx.strokeStyle="rgba(0,0,0,0.22)"; ctx.lineWidth=1;
    for (let xx=x-w/2+9; xx<x+w/2-3; xx+=9) { ctx.beginPath(); ctx.moveTo(xx,top+2); ctx.lineTo(xx,groundY-2); ctx.stroke(); }
    // corner posts + plank roof ridge
    ctx.fillStyle="#4a3520"; ctx.fillRect(x-w/2-2,top-2,4,h+2); ctx.fillRect(x+w/2-2,top-2,4,h+2);
    ctx.fillStyle="#4a3520"; ctx.fillRect(x-w/2-4,top-5,w+8,5);
    if (lvl>=3) {
      // small cloth banner with gold emblem
      const sway=windSway(x,2)*0.4, by0=top-2;
      ctx.fillStyle=canopyD;
      ctx.beginPath(); ctx.moveTo(x-7,by0); ctx.lineTo(x+7,by0); ctx.lineTo(x+7+sway,by0+20); ctx.lineTo(x+sway,by0+24); ctx.lineTo(x-7+sway,by0+20); ctx.closePath(); ctx.fill();
      ctx.strokeStyle="#f2c14e"; ctx.lineWidth=1.1;
      ctx.beginPath(); ctx.moveTo(x-7,by0+1.5); ctx.lineTo(x+7,by0+1.5); ctx.stroke();
      drawStallEmblem(x+sway*0.6,by0+13,emblem);
    }
    // striped canopy sloping out from the wall
    const cy=top+12, cOut=13, cw=w+18;
    ctx.strokeStyle="#4a3520"; ctx.lineWidth=3; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(x-cw/2+2,groundY); ctx.lineTo(x-cw/2+2,cy+cOut-2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+cw/2-2,groundY); ctx.lineTo(x+cw/2-2,cy+cOut-2); ctx.stroke();
    ctx.lineCap="butt";
    for (let i=0;i<7;i++) {
      ctx.fillStyle=i%2?canopy:"#e8d8b8";
      const s0=x-cw/2+i*cw/7, s1=s0+cw/7;
      ctx.beginPath(); ctx.moveTo(s0+2,cy); ctx.lineTo(s1+2,cy); ctx.lineTo(s1,cy+cOut); ctx.lineTo(s0,cy+cOut); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle="rgba(0,0,0,0.14)"; ctx.fillRect(x-cw/2,cy+cOut-1.5,cw,2.5);
    if (lvl>=3) {
      ctx.fillStyle=canopyD;
      for (let i=0;i<9;i++) { ctx.beginPath(); ctx.arc(x-cw/2+cw/18+i*cw/9,cy+cOut+0.5,cw/18,0,Math.PI); ctx.fill(); }
    }
    return;
  }

  const stoneL="#5a5260", stoneD="#403a48";
  const w=62, h=52, top=groundY-h;
  groundShadow(x, 40, 0.24);
  // masonry back wall with joints
  ctx.fillStyle=stoneD; ctx.fillRect(x-w/2,top,w,h);
  ctx.fillStyle="rgba(255,255,255,0.07)"; ctx.fillRect(x-w/2,top,w*0.3,h);
  ctx.fillStyle="rgba(0,0,0,0.16)"; ctx.fillRect(x+w*0.2,top,w*0.3,h);
  ctx.strokeStyle="rgba(0,0,0,0.20)"; ctx.lineWidth=1;
  for (let yy=top+10; yy<groundY-4; yy+=10) { ctx.beginPath(); ctx.moveTo(x-w/2+2,yy); ctx.lineTo(x+w/2-2,yy); ctx.stroke(); }
  for (let yy=top+10,r=0; yy<groundY-8; yy+=10,r++)
    for (let xx=x-w/2+(r%2?7:14); xx<x+w/2-4; xx+=14)
      { ctx.beginPath(); ctx.moveTo(xx,yy); ctx.lineTo(xx,yy+10); ctx.stroke(); }
  // stone ledge + battlement teeth echoing the curtain wall
  ctx.fillStyle=stoneL; ctx.fillRect(x-w/2-3,top-6,w+6,7);
  ctx.fillStyle="rgba(0,0,0,0.22)"; ctx.fillRect(x-w/2-3,top-1,w+6,2);
  ctx.fillStyle=stoneD;
  for (let i=0;i<4;i++) ctx.fillRect(x-w/2-3+i*(w-2)/3,top-13,8,8);
  ctx.fillStyle="rgba(255,255,255,0.08)";
  for (let i=0;i<4;i++) ctx.fillRect(x-w/2-3+i*(w-2)/3,top-13,8,2);
  // lit arched window high on the wall
  const wy=top+8, ww=9;
  ctx.fillStyle="#2a2530";
  ctx.beginPath(); ctx.moveTo(x-ww/2-1,wy+13); ctx.lineTo(x-ww/2-1,wy+ww*0.5); ctx.arc(x,wy+ww*0.5,ww/2+1,Math.PI,0); ctx.lineTo(x+ww/2+1,wy+13); ctx.closePath(); ctx.fill();
  ctx.fillStyle=`rgba(255,186,86,${litWindow(Game.isNight?0.8:0)})`;
  ctx.beginPath(); ctx.moveTo(x-ww/2,wy+13); ctx.lineTo(x-ww/2,wy+ww*0.5); ctx.arc(x,wy+ww*0.5,ww/2,Math.PI,0); ctx.lineTo(x+ww/2,wy+13); ctx.closePath(); ctx.fill();
  // hanging guild banner with emblem (cloth, not a floating icon)
  const sway=windSway(x,2)*0.4;
  ctx.fillStyle=canopyD;
  ctx.beginPath(); ctx.moveTo(x-8,top-4); ctx.lineTo(x+8,top-4); ctx.lineTo(x+8+sway,wy+24); ctx.lineTo(x+sway,wy+29); ctx.lineTo(x-8+sway,wy+24); ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.moveTo(x+2,top-4); ctx.lineTo(x+8,top-4); ctx.lineTo(x+8+sway,wy+24); ctx.lineTo(x+2+sway,wy+26); ctx.closePath(); ctx.fill();
  ctx.strokeStyle="#f2c14e"; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.moveTo(x-8,top-2.5); ctx.lineTo(x+8,top-2.5); ctx.stroke();
  drawStallEmblem(x+sway*0.6,wy+16,emblem);
  // striped lean-to canopy slanting out from the stone ledge
  const cy=top+16, cOut=14;
  ctx.strokeStyle="#4a3520"; ctx.lineWidth=3; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(x-w/2-8,groundY); ctx.lineTo(x-w/2-8,cy+cOut-2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+w/2+8,groundY); ctx.lineTo(x+w/2+8,cy+cOut-2); ctx.stroke();
  ctx.lineCap="butt";
  const cw=w+22;
  for (let i=0;i<7;i++) {
    ctx.fillStyle=i%2?canopy:"#e8d8b8";
    const s0=x-cw/2+i*cw/7, s1=s0+cw/7;
    ctx.beginPath(); ctx.moveTo(s0+2,cy); ctx.lineTo(s1+2,cy); ctx.lineTo(s1,cy+cOut); ctx.lineTo(s0,cy+cOut); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle="rgba(0,0,0,0.14)"; ctx.fillRect(x-cw/2,cy+cOut-1.5,cw,2.5);
  ctx.fillStyle=canopyD;
  for (let i=0;i<9;i++) { ctx.beginPath(); ctx.arc(x-cw/2+cw/18+i*cw/9,cy+cOut+0.5,cw/18,0,Math.PI); ctx.fill(); }
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

// Timber-framed general store: plastered walls with dark beams, striped
// awning over a goods counter, hanging sign, barrels, crates and a lantern.
function drawShopBuilding(x) {
  const t=performance.now()/1000, fl=(FX&&FX.flicker)||1;
  const bw=76, bh=44, by=groundY-bh;
  groundShadow(x, 50, 0.26);
  // stone footing
  ctx.fillStyle="#565662"; ctx.fillRect(x-bw/2-2,groundY-6,bw+4,6);
  ctx.fillStyle="rgba(255,255,255,0.10)"; ctx.fillRect(x-bw/2-2,groundY-6,bw+4,1.6);
  // plastered wall
  ctx.fillStyle="#c9b795"; ctx.fillRect(x-bw/2,by,bw,bh-6);
  ctx.fillStyle="rgba(255,255,255,0.14)"; ctx.fillRect(x-bw/2,by,bw*0.3,bh-6);
  ctx.fillStyle="rgba(0,0,0,0.10)"; ctx.fillRect(x+bw*0.2,by,bw*0.3,bh-6);
  // dark timber frame
  ctx.fillStyle="#4a3623";
  ctx.fillRect(x-bw/2,by,4,bh-6); ctx.fillRect(x+bw/2-4,by,4,bh-6);
  ctx.fillRect(x-bw/2,by,bw,4); ctx.fillRect(x-3,by,6,bh-6);
  ctx.strokeStyle="#4a3623"; ctx.lineWidth=3.4; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(x-bw/2+4,by+5); ctx.lineTo(x-5,by+bh*0.55); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+bw/2-4,by+5); ctx.lineTo(x+5,by+bh*0.55); ctx.stroke();
  ctx.lineCap="butt";
  // steep shingled roof with overhang and chimney
  const peak=by-26;
  ctx.fillStyle="#8a3a2a";
  ctx.beginPath(); ctx.moveTo(x-bw/2-10,by+1); ctx.lineTo(x,peak); ctx.lineTo(x+bw/2+10,by+1); ctx.lineTo(x+bw/2+6,by+5); ctx.lineTo(x-bw/2-6,by+5); ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,0.10)";
  ctx.beginPath(); ctx.moveTo(x-bw/2-10,by+1); ctx.lineTo(x,peak); ctx.lineTo(x-bw*0.1,by+1); ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.20)";
  ctx.beginPath(); ctx.moveTo(x,peak); ctx.lineTo(x+bw/2+10,by+1); ctx.lineTo(x+bw*0.16,by+1); ctx.closePath(); ctx.fill();
  ctx.strokeStyle="rgba(0,0,0,0.18)"; ctx.lineWidth=1;
  for (let i=1;i<4;i++) { const fy=peak+(by+1-peak)*i/4, half=(bw/2+10)*i/4; ctx.beginPath(); ctx.moveTo(x-half,fy); ctx.lineTo(x+half,fy); ctx.stroke(); }
  ctx.fillStyle="#6a6a76"; ctx.fillRect(x+bw*0.22,peak+8,9,14);
  ctx.fillStyle="#4e4e5a"; ctx.fillRect(x+bw*0.22-1.5,peak+6,12,3);
  // curl of chimney smoke
  ctx.save(); ctx.globalAlpha=0.16;
  ctx.fillStyle="#d8d4cc";
  for (let i=0;i<3;i++) { const ph=(t*0.3+i/3)%1; ctx.beginPath(); ctx.arc(x+bw*0.28+Math.sin(t+i*2)*3+ph*6,peak+2-ph*20,2.5+ph*4,0,Math.PI*2); ctx.fill(); }
  ctx.restore();
  // upper window with shutters
  ctx.fillStyle=`rgba(255,186,86,${litWindow(Game.isNight?0.8:0)})`; ctx.fillRect(x-6,by+8,12,11);
  ctx.strokeStyle="#4a3623"; ctx.lineWidth=1.4; ctx.strokeRect(x-6,by+8,12,11);
  ctx.beginPath(); ctx.moveTo(x,by+8); ctx.lineTo(x,by+19); ctx.stroke();
  ctx.fillStyle="#5f4326"; ctx.fillRect(x-11,by+8,4,11); ctx.fillRect(x+7,by+8,4,11);
  // striped awning over the counter
  const awY=by+bh*0.42, awW=bw+16;
  ctx.strokeStyle="#4a3520"; ctx.lineWidth=3; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(x-awW/2+3,groundY); ctx.lineTo(x-awW/2+3,awY+10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+awW/2-3,groundY); ctx.lineTo(x+awW/2-3,awY+10); ctx.stroke();
  ctx.lineCap="butt";
  for (let i=0;i<7;i++) {
    ctx.fillStyle=i%2?"#b8452f":"#e8d8b8";
    const sx=x-awW/2+i*awW/7;
    ctx.beginPath(); ctx.moveTo(sx,awY+10); ctx.lineTo(sx+awW/7,awY+10); ctx.lineTo(sx+awW/7-3,awY-2); ctx.lineTo(sx-3+3,awY-2); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle="rgba(0,0,0,0.14)"; ctx.fillRect(x-awW/2-3,awY+9,awW+6,2.4);
  // scalloped edge
  ctx.fillStyle="#a03a28";
  for (let i=0;i<9;i++) { ctx.beginPath(); ctx.arc(x-awW/2+awW/18+i*awW/9,awY+11,awW/18,0,Math.PI); ctx.fill(); }
  // goods counter with wares
  ctx.fillStyle="#5f4326"; ctx.fillRect(x-26,groundY-16,52,16);
  ctx.fillStyle="#8a6338"; ctx.fillRect(x-26,groundY-16,52,4);
  ctx.strokeStyle="rgba(0,0,0,0.22)"; ctx.lineWidth=1;
  for (let i=-2;i<=2;i++) { ctx.beginPath(); ctx.moveTo(x+i*9,groundY-12); ctx.lineTo(x+i*9,groundY); ctx.stroke(); }
  // wares: apples, cheese, bottle, coin stack
  ctx.fillStyle="#c0392b";
  for (let i=0;i<3;i++) { ctx.beginPath(); ctx.arc(x-17+i*5,groundY-18.5,2.4,0,Math.PI*2); ctx.fill(); }
  ctx.fillStyle="#e8c14e"; ctx.beginPath(); ctx.moveTo(x-2,groundY-16.5); ctx.lineTo(x+8,groundY-16.5); ctx.lineTo(x+8,groundY-22); ctx.closePath(); ctx.fill();
  ctx.fillStyle="#3a6a4a"; ctx.fillRect(x+13,groundY-25,4,9); ctx.fillRect(x+14,groundY-27.5,2,3);
  ctx.fillStyle="#f2c14e";
  for (let i=0;i<3;i++) ctx.fillRect(x+21,groundY-18.5-i*2.6,6,2);
  // shopkeeper behind the counter
  drawBoothPerson(x-8,"#d8a878","#6a3a5a","#4a2840");
  // hanging sign on a bracket
  const swy=Math.sin(t*1.6+x)*0.06;
  ctx.strokeStyle="#3a2e20"; ctx.lineWidth=2.6;
  ctx.beginPath(); ctx.moveTo(x-bw/2,by+9); ctx.lineTo(x-bw/2-18,by+9); ctx.stroke();
  ctx.save(); ctx.translate(x-bw/2-12,by+9); ctx.rotate(swy);
  ctx.strokeStyle="#8a7a5a"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(-4,5); ctx.moveTo(4,0); ctx.lineTo(4,5); ctx.stroke();
  ctx.fillStyle="#6a4a2a"; roundedRect(-9,5,18,14,2); ctx.fill();
  ctx.strokeStyle="#f2c14e"; ctx.lineWidth=1; roundedRect(-7,7,14,10,1.6); ctx.stroke();
  ctx.fillStyle="#f2c14e"; ctx.beginPath(); ctx.arc(0,12,3.4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#6a4a2a"; ctx.beginPath(); ctx.arc(0,12,1.6,0,Math.PI*2); ctx.fill();
  ctx.restore();
  // barrel + crates flanking the shop
  const brX=x+bw/2+12;
  ctx.fillStyle="#7a5a34"; ctx.beginPath(); ctx.ellipse(brX,groundY-9,7,9.5,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,0.10)"; ctx.beginPath(); ctx.ellipse(brX-2,groundY-9,3,9,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="#3c3c46"; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.ellipse(brX,groundY-13,6.6,3,0,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(brX,groundY-5,6.9,3,0,0,Math.PI*2); ctx.stroke();
  const crX=x-bw/2-16;
  ctx.fillStyle="#8a6338"; ctx.fillRect(crX-8,groundY-11,16,11);
  ctx.strokeStyle="#5f4326"; ctx.lineWidth=1.4; ctx.strokeRect(crX-8,groundY-11,16,11);
  ctx.beginPath(); ctx.moveTo(crX-8,groundY-11); ctx.lineTo(crX+8,groundY); ctx.moveTo(crX+8,groundY-11); ctx.lineTo(crX-8,groundY); ctx.stroke();
  ctx.fillStyle="#9bd05a"; ctx.beginPath(); ctx.arc(crX-3,groundY-13,2.6,0,Math.PI*2); ctx.arc(crX+3,groundY-13.6,2.8,0,Math.PI*2); ctx.fill();
  // lantern glowing at the corner post at night
  if (Game.isNight) {
    const lx=x+awW/2-3, ly=awY+14;
    ctx.strokeStyle="#3a3a44"; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(lx,ly+4); ctx.stroke();
    ctx.fillStyle="#3a3a44"; ctx.fillRect(lx-3,ly+4,6,8);
    ctx.save(); ctx.globalCompositeOperation="lighter";
    const rg=ctx.createRadialGradient(lx,ly+8,1,lx,ly+8,22*fl);
    rg.addColorStop(0,"rgba(255,210,120,0.5)"); rg.addColorStop(1,"rgba(255,150,60,0)");
    ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(lx,ly+8,22*fl,0,Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.fillStyle="rgba(255,230,150,0.95)"; ctx.fillRect(lx-1.8,ly+5.5,3.6,5);
  }
}

export function drawStations() {
  drawBowStation(STATIONS_X.bow);
  drawHammerStation(STATIONS_X.hammer);
  const farmLvl = state.farmLevel || 0;
  if (state.base.level >= 2 && farmLvl === 0) drawFlag(STATIONS_X.farm, "#9bd05a");
  if (farmLvl >= 1) {
    const fx = STATIONS_X.farm;
    ctx.fillStyle="#6a4a28"; ctx.fillRect(fx-34,groundY-6,68,6);
    ctx.fillStyle="#9bd05a"; for (let i=0;i<6;i++) ctx.fillRect(fx-30+i*11,groundY-16,4,11);
    if (farmLvl >= 2) {
      ctx.fillStyle="#7a5030"; ctx.fillRect(fx+14,groundY-28,22,22);
      ctx.fillStyle="#8a3a18"; ctx.beginPath(); ctx.moveTo(fx+12,groundY-28); ctx.lineTo(fx+25,groundY-42); ctx.lineTo(fx+38,groundY-28); ctx.closePath(); ctx.fill();
      ctx.fillStyle="#5a3820"; ctx.fillRect(fx+20,groundY-21,8,15);
    }
    if (farmLvl >= 3) {
      ctx.fillStyle="#c8a030"; ctx.beginPath(); ctx.ellipse(fx-22,groundY-10,12,10,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#e0b840"; ctx.beginPath(); ctx.ellipse(fx-22,groundY-14,12,6,0,0,Math.PI); ctx.fill();
    }
    if (farmLvl >= 4) {
      ctx.fillStyle="#9a8060";
      ctx.beginPath(); ctx.moveTo(fx-14,groundY); ctx.lineTo(fx-8,groundY-52); ctx.lineTo(fx+8,groundY-52); ctx.lineTo(fx+14,groundY); ctx.closePath(); ctx.fill();
      ctx.fillStyle="#7a6050"; ctx.fillRect(fx-4,groundY-55,8,8);
      ctx.save(); ctx.translate(fx, groundY-58); ctx.strokeStyle="#6a5040"; ctx.lineWidth=3;
      for (let b=0;b<4;b++) { ctx.save(); ctx.rotate(b*Math.PI/2); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-20); ctx.stroke(); ctx.fillStyle="#9a8060"; ctx.fillRect(-3,-20,6,8); ctx.restore(); }
      ctx.restore();
    }
    if (farmLvl >= 5) {
      const spin = performance.now() / 800;
      ctx.save(); ctx.translate(fx, groundY-58);
      for (let b=0;b<4;b++) {
        ctx.save(); ctx.rotate(spin + b*Math.PI/2); ctx.strokeStyle="#7a6040"; ctx.lineWidth=3;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-22); ctx.stroke();
        ctx.fillStyle="#c09060"; ctx.beginPath(); ctx.moveTo(-4,-22); ctx.lineTo(4,-22); ctx.lineTo(2,-32); ctx.lineTo(-2,-32); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
  }
  if (state.base && state.base.level >= 2) drawShopBuilding(STATIONS_X.shop);
  if (state.base && state.base.level >= 3) {
    ctx.strokeStyle="#6a4a28"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(STATIONS_X.guard-18,groundY-8); ctx.lineTo(STATIONS_X.guard+18,groundY-8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(STATIONS_X.guard-14,groundY-8); ctx.lineTo(STATIONS_X.guard-14,groundY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(STATIONS_X.guard+14,groundY-8); ctx.lineTo(STATIONS_X.guard+14,groundY); ctx.stroke();
    ctx.strokeStyle="#9a9aaa"; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(STATIONS_X.guard-10,groundY-14); ctx.lineTo(STATIONS_X.guard-2,groundY-8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(STATIONS_X.guard+10,groundY-14); ctx.lineTo(STATIONS_X.guard+2,groundY-8); ctx.stroke();
  }
}

// ---------- Unlockable buildings (watchtower, lumber camp, shrine) ----------
function towerHeight(lvl) { return [0, 112, 138, 164][lvl] || 112; }

// Overgrown build spot: worn flag + hint to fell the surrounding trees.
function drawClearingHint(x) {
  drawFlag(x, "#8a6a3a");
  const bob=Math.sin(performance.now()/400+x)*3;
  ctx.save(); ctx.font="15px serif"; ctx.textAlign="center"; ctx.globalAlpha=0.9;
  ctx.fillText("🪓", x, groundY-46+bob);
  if (state.player && Math.abs(state.player.x-x)<150) {
    ctx.font="12px sans-serif"; ctx.fillStyle="rgba(255,240,200,0.9)";
    ctx.fillText("Ryd træerne for at bygge her", x, groundY-70);
  }
  ctx.restore();
}

function drawWatchtower(b, night) {
  const x=b.x, h=towerHeight(b.level);
  const platY=groundY-h;             // top of the leg structure / cabin floor
  const cabH=30, cabW=68;            // lookout cabin
  const cabY=platY-cabH;
  const woodD="#4a3420", wood="#6a4a2a", woodL="#8a6338", plank="#7a5a34";
  groundShadow(x, 48, 0.28);

  // --- stone footings ---
  ctx.fillStyle="#5a5a66";
  ctx.beginPath(); ctx.ellipse(x-26,groundY-3,9,5.5,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x+26,groundY-3,9,5.5,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,0.14)";
  ctx.beginPath(); ctx.ellipse(x-28,groundY-5,3.8,2.2,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x+24,groundY-5,3.8,2.2,0,0,Math.PI*2); ctx.fill();

  // --- tapered legs with shading ---
  const legTopL=x-19, legTopR=x+19, legBotL=x-27, legBotR=x+27;
  ctx.fillStyle=wood;
  ctx.beginPath(); ctx.moveTo(legBotL-3,groundY-4); ctx.lineTo(legTopL-2.5,platY+3); ctx.lineTo(legTopL+2.5,platY+3); ctx.lineTo(legBotL+3,groundY-4); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(legBotR-3,groundY-4); ctx.lineTo(legTopR-2.5,platY+3); ctx.lineTo(legTopR+2.5,platY+3); ctx.lineTo(legBotR+3,groundY-4); ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,0.10)";
  ctx.beginPath(); ctx.moveTo(legBotL-3,groundY-4); ctx.lineTo(legTopL-2.5,platY+3); ctx.lineTo(legTopL-0.5,platY+3); ctx.lineTo(legBotL-1,groundY-4); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(legBotR-3,groundY-4); ctx.lineTo(legTopR-2.5,platY+3); ctx.lineTo(legTopR-0.5,platY+3); ctx.lineTo(legBotR-1,groundY-4); ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.22)";
  ctx.beginPath(); ctx.moveTo(legBotL+1,groundY-4); ctx.lineTo(legTopL+0.5,platY+3); ctx.lineTo(legTopL+2.5,platY+3); ctx.lineTo(legBotL+3,groundY-4); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(legBotR+1,groundY-4); ctx.lineTo(legTopR+0.5,platY+3); ctx.lineTo(legTopR+2.5,platY+3); ctx.lineTo(legBotR+3,groundY-4); ctx.closePath(); ctx.fill();

  // cross-braces + horizontal ties (three tiers for the taller frame)
  ctx.strokeStyle=woodD; ctx.lineWidth=3; ctx.lineCap="round";
  const t1=groundY-h*0.24, t2=groundY-h*0.5, t3=groundY-h*0.76;
  ctx.beginPath(); ctx.moveTo(x-25,t1+10); ctx.lineTo(x+22,t2+6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+25,t1+10); ctx.lineTo(x-22,t2+6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x-22,t2+6); ctx.lineTo(x+20,t3+4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+22,t2+6); ctx.lineTo(x-20,t3+4); ctx.stroke();
  ctx.lineWidth=3.4;
  ctx.beginPath(); ctx.moveTo(x-25.5,t1+10); ctx.lineTo(x+25.5,t1+10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x-22.5,t2+6);  ctx.lineTo(x+22.5,t2+6);  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x-20.5,t3+4);  ctx.lineTo(x+20.5,t3+4);  ctx.stroke();
  ctx.lineCap="butt";

  // ladder up the right leg
  const ladX=x+32;
  ctx.strokeStyle="#5a3a1a"; ctx.lineWidth=2.4; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(ladX-4,groundY); ctx.lineTo(ladX-4,platY+6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ladX+4,groundY); ctx.lineTo(ladX+4,platY+6); ctx.stroke();
  ctx.lineWidth=1.8;
  for (let ry=groundY-7; ry>platY+10; ry-=9) { ctx.beginPath(); ctx.moveTo(ladX-4,ry); ctx.lineTo(ladX+4,ry); ctx.stroke(); }
  ctx.lineCap="butt";

  // --- platform with joists and overhang ---
  ctx.fillStyle="rgba(0,0,0,0.25)"; ctx.fillRect(x-cabW/2-4,platY+5,cabW+8,3);
  ctx.fillStyle=plank; ctx.fillRect(x-cabW/2-5,platY,cabW+10,6);
  ctx.fillStyle="rgba(255,255,255,0.12)"; ctx.fillRect(x-cabW/2-5,platY,cabW+10,2);
  ctx.strokeStyle="rgba(0,0,0,0.25)"; ctx.lineWidth=1;
  for (let i=1;i<6;i++) { const px2=x-cabW/2-5+i*(cabW+10)/6; ctx.beginPath(); ctx.moveTo(px2,platY); ctx.lineTo(px2,platY+6); ctx.stroke(); }

  // --- cabin: planked back wall + corner posts + railing ---
  ctx.fillStyle=wood; ctx.fillRect(x-cabW/2,cabY,cabW,cabH);
  ctx.fillStyle="rgba(255,255,255,0.07)"; ctx.fillRect(x-cabW/2,cabY,cabW*0.3,cabH);
  ctx.fillStyle="rgba(0,0,0,0.16)"; ctx.fillRect(x+cabW*0.2,cabY,cabW*0.3,cabH);
  ctx.strokeStyle="rgba(0,0,0,0.20)"; ctx.lineWidth=1;
  for (let yy=cabY+6; yy<platY-2; yy+=6) { ctx.beginPath(); ctx.moveTo(x-cabW/2+2,yy); ctx.lineTo(x+cabW/2-2,yy); ctx.stroke(); }
  ctx.fillStyle=woodD;
  ctx.fillRect(x-cabW/2-1.5,cabY-2,4,cabH+2); ctx.fillRect(x+cabW/2-2.5,cabY-2,4,cabH+2);
  // railing across the front
  const railY=platY-11;
  ctx.strokeStyle=woodL; ctx.lineWidth=2.6; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(x-cabW/2+1,railY); ctx.lineTo(x+cabW/2-1,railY); ctx.stroke();
  ctx.lineWidth=2;
  for (let i=-3;i<=3;i++) { ctx.beginPath(); ctx.moveTo(x+i*(cabW/6.6),railY+1); ctx.lineTo(x+i*(cabW/6.6),platY); ctx.stroke(); }
  ctx.lineCap="butt";

  // --- garrison of archers behind the railing (more per tower level) ---
  const aY=platY-1, nArch=Math.min(4,1+(b.level||1));
  const tunics=["#2e3e50","#503a2e","#3a5040","#4a3050"];
  for (let ai=0; ai<nArch; ai++) {
    const ax=x+(ai-(nArch-1)/2)*(cabW/(nArch+0.4));
    const breathe=Math.sin(performance.now()/700+x+ai*1.9)*0.8;
    ctx.fillStyle=tunics[ai%tunics.length]; roundedRect(ax-5,aY-19+breathe,10,15,3); ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.08)"; ctx.fillRect(ax-5,aY-19+breathe,3,15);
    ctx.fillStyle="#d8a878"; ctx.beginPath(); ctx.arc(ax,aY-23+breathe,4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#4a3420"; ctx.beginPath(); ctx.arc(ax,aY-24.4+breathe,4.2,Math.PI,0); ctx.fill();
    // quiver on the back
    ctx.fillStyle="#6a4222"; ctx.fillRect(ax-8,aY-18+breathe,3,9);
    ctx.strokeStyle="#c9b898"; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(ax-7.5,aY-18+breathe); ctx.lineTo(ax-6.5,aY-21+breathe); ctx.stroke();
    // bow at the ready, tipped forward when firing
    const aim=b.fireFlash>0?0.5:0;
    ctx.save(); ctx.translate(ax+7,aY-17+breathe); ctx.rotate(-0.2-aim);
    ctx.strokeStyle="#5a3a1a"; ctx.lineWidth=1.8;
    ctx.beginPath(); ctx.arc(0,0,7,Math.PI*0.55,Math.PI*1.45,true); ctx.stroke();
    ctx.strokeStyle="rgba(230,220,200,0.85)"; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(-1.5,-6.6); ctx.lineTo(-1.5,6.6); ctx.stroke();
    ctx.restore();
  }

  // --- pitched shingle roof with overhang ---
  const roofY=cabY, peak=roofY-18;
  ctx.fillStyle="#8a3a2a";
  ctx.beginPath(); ctx.moveTo(x-cabW/2-9,roofY); ctx.lineTo(x,peak); ctx.lineTo(x+cabW/2+9,roofY); ctx.lineTo(x+cabW/2+5,roofY+3.5); ctx.lineTo(x-cabW/2-5,roofY+3.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,0.10)";
  ctx.beginPath(); ctx.moveTo(x-cabW/2-9,roofY); ctx.lineTo(x,peak); ctx.lineTo(x-cabW*0.1,roofY); ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.20)";
  ctx.beginPath(); ctx.moveTo(x,peak); ctx.lineTo(x+cabW/2+9,roofY); ctx.lineTo(x+cabW*0.16,roofY); ctx.closePath(); ctx.fill();
  ctx.strokeStyle="rgba(0,0,0,0.18)"; ctx.lineWidth=1;
  for (let i=1;i<3;i++) {
    const fy=peak+(roofY-peak)*i/3, half=(cabW/2+9)*i/3;
    ctx.beginPath(); ctx.moveTo(x-half,fy); ctx.lineTo(x+half,fy); ctx.stroke();
  }

  // --- banner from the roof peak (gold lvl2, red lvl3) ---
  if (b.level>=2) {
    const sway=windSway(x,4);
    ctx.strokeStyle="#cdbfa3"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(x,peak); ctx.lineTo(x,peak-16); ctx.stroke();
    ctx.fillStyle=b.level>=3?"#c1453b":"#f2c14e";
    ctx.beginPath(); ctx.moveTo(x,peak-16);
    ctx.quadraticCurveTo(x+9+sway,peak-14.5,x+16+sway,peak-11);
    ctx.quadraticCurveTo(x+9+sway,peak-8.5,x,peak-6); ctx.closePath(); ctx.fill();
    ctx.fillStyle="rgba(0,0,0,0.15)";
    ctx.beginPath(); ctx.moveTo(x,peak-16); ctx.quadraticCurveTo(x+8+sway,peak-13,x,peak-6); ctx.closePath(); ctx.fill();
  }

  // --- lvl3 brazier hanging off the platform edge ---
  if (b.level>=3) {
    const fl=(FX&&FX.flicker)||1, bx=x-cabW/2-8, by=platY-4;
    ctx.strokeStyle="#3a3a44"; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.moveTo(x-cabW/2-2,platY+1); ctx.lineTo(bx,by); ctx.stroke();
    ctx.fillStyle="#3a3a44"; ctx.beginPath(); ctx.arc(bx,by,4.4,0,Math.PI,false); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation="lighter";
    ctx.fillStyle="rgba(255,140,40,0.55)"; ctx.beginPath(); ctx.arc(bx,by-4,10*fl,0,Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.fillStyle="rgba(255,170,60,0.95)"; ctx.beginPath(); ctx.ellipse(bx,by-4,2.6,4.8*fl,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(255,234,160,0.95)"; ctx.beginPath(); ctx.ellipse(bx,by-4,1.2,2.4*fl,0,0,Math.PI*2); ctx.fill();
  }

  // muzzle flash when an arrow leaves the tower
  if (b.fireFlash>0) {
    ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=b.fireFlash/0.15;
    ctx.fillStyle="#ffe8a0"; ctx.beginPath(); ctx.arc(x,aY-18,11,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  if (night) drawTorch(x+cabW/2+6, platY-2);
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

function drawShrine(b, dark) {
  const x=b.x, fl=(FX&&FX.flicker)||1;
  groundShadow(x, 26, 0.24);
  // stone plinth and pillars
  const stone="#6b6b78", stoneDk="#555568";
  ctx.fillStyle=stoneDk; ctx.fillRect(x-20,groundY-10,40,10);
  ctx.fillStyle=stone; ctx.fillRect(x-20,groundY-10,40,3);
  ctx.fillStyle=stone; ctx.fillRect(x-15,groundY-40,6,30); ctx.fillRect(x+9,groundY-40,6,30);
  ctx.fillStyle="rgba(255,255,255,0.10)"; ctx.fillRect(x-15,groundY-40,2,30); ctx.fillRect(x+9,groundY-40,2,30);
  ctx.fillStyle=stoneDk; ctx.fillRect(x-19,groundY-46,38,7);
  ctx.fillStyle=stone; ctx.fillRect(x-19,groundY-46,38,2.5);
  // floating light between the pillars
  ctx.save(); ctx.globalCompositeOperation="lighter";
  const rg=ctx.createRadialGradient(x,groundY-27,2,x,groundY-27,26+6*dark);
  rg.addColorStop(0,"rgba(140,220,255,0.75)"); rg.addColorStop(1,"rgba(80,150,255,0)");
  ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(x,groundY-27,26+6*dark,0,Math.PI*2); ctx.fill();
  ctx.restore();
  const bob=Math.sin(performance.now()/600+x)*2;
  ctx.fillStyle="rgba(220,245,255,0.95)";
  ctx.beginPath(); ctx.ellipse(x,groundY-27+bob,3.4,5.2*fl,0,0,Math.PI*2); ctx.fill();
}

export function drawBuildings(dark) {
  const night = dark > 0.25;
  const baseLvl = state.base ? state.base.level : 1;
  for (const b of (state.buildings || [])) {
    if (baseLvl < b.unlock) continue;
    if (!b.built) {
      if (b.needsClearing && !b.cleared) { drawClearingHint(b.x); continue; }
      const flagCol = b.type==="tower" ? "#c98a4a" : b.type==="lumber" ? "#8a9a5a" : "#8fd8ff";
      drawFlag(b.x, flagCol);
      drawStationIcon(b.x, b.type==="tower" ? "🏹" : b.type==="lumber" ? "🪵" : "⛲");
      continue;
    }
    if (b.type === "tower") drawWatchtower(b, night);
    else if (b.type === "lumber") drawLumberCamp(b, night);
    else if (b.type === "shrine") drawShrine(b, dark);
  }
}
