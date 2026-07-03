import { clamp, lerp, lerpColor, rgb, withA, shade, atmo, hazeColor } from '../util/math.js';
import { CFG, STATIONS_X } from '../config/config.js';
import { ctx, W, H, groundY } from '../canvas.js';
import { Game, state } from '../state.js';
import { FX, biomeAt, getGroundTex, getDeco, windGust, windSway, drawTree } from './Effects.js';
import { wallHeight } from '../entities/Wall.js';
import { groundShadow, roundedRect, stoneCol, stoneLt, woodCol, litWindow, drawHpBar } from './DrawHelpers.js';
import { ENEMY_TYPES } from '../config/enemies.js';

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
  for (const f of tex.fringe) {
    if (f.x<camL||f.x>camR) continue;
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
  for (const it of items) { if (it.x<camL||it.x>camR) continue; drawDeco(it,biomeAt(it.x),dark); }
}

// ---------- Building pieces ----------
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
    if (ft.chopped) continue;
    if (ft.x < camL || ft.x > camR) continue;
    const b = biomeAt(ft.x);
    // stagger apparent depth so the dense forest reads as layered rows
    const depth = 0.05 + (Math.abs(Math.floor(ft.x / 60)) % 3) * 0.07;
    const light = atmo(b.treeL, haze, depth), dcol = atmo(b.treeD, haze, depth);

    if (ft.lying) { drawLog(ft.x, ft.fallDir, Math.max(60, ft.tree.h * 0.6)); continue; }

    if (ft.falling) {
      // Ease-in rotation around the trunk base for a weighty toppling feel.
      const ease = Math.sin(ft.fallAngle) * ft.fallAngle / (Math.PI / 2);
      ctx.save();
      ctx.translate(ft.x, groundY);
      ctx.rotate(ft.fallDir * ease * (Math.PI / 2));
      ctx.translate(-ft.x, -groundY);
      drawTree(ft.tree, ft.x, groundY + 4, light, dcol, depth, 0);
      ctx.restore();
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

function drawBoothBack(x, canopy, canopyD, post) {
  ctx.save();
  ctx.strokeStyle=post; ctx.lineWidth=4; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(x-24,groundY); ctx.lineTo(x-24,groundY-44); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+24,groundY); ctx.lineTo(x+24,groundY-44); ctx.stroke();
  ctx.lineCap="butt";
  ctx.fillStyle=canopyD;
  ctx.beginPath(); ctx.moveTo(x-30,groundY-42); ctx.lineTo(x+30,groundY-42); ctx.lineTo(x+25,groundY-54); ctx.lineTo(x-25,groundY-54); ctx.closePath(); ctx.fill();
  ctx.fillStyle=canopy;
  for (let i=-3;i<3;i++) {
    ctx.beginPath();
    ctx.moveTo(x-25+ (i+3.5)*(50/7)-3, groundY-54);
    ctx.lineTo(x-25+ (i+4.5)*(50/7)-3, groundY-54);
    ctx.lineTo(x-30+ (i+4.5)*(60/7), groundY-42);
    ctx.lineTo(x-30+ (i+3.5)*(60/7), groundY-42);
    ctx.closePath();
    if (i%2===0) ctx.fill();
  }
  ctx.fillStyle="rgba(0,0,0,0.2)";
  ctx.beginPath(); ctx.moveTo(x-25,groundY-54); ctx.lineTo(x-30,groundY-42); ctx.lineTo(x-22,groundY-42); ctx.lineTo(x-19,groundY-54); ctx.closePath(); ctx.fill();
  ctx.restore();
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
  drawBoothBack(x,"#8a3a34","#5f2622","#4a3520");
  drawBoothPerson(x-5,"#d8a878","#3a5a44","#264030");
  drawBoothCounter(x);
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
}

function drawHammerStation(x) {
  drawBoothBack(x,"#39547a","#243954","#4a3f2e");
  drawBoothPerson(x-5,"#c89468","#6a5030","#463420");
  drawBoothCounter(x);
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

export function drawStations() {
  drawBowStation(STATIONS_X.bow);
  drawHammerStation(STATIONS_X.hammer);
  const farmLvl = state.farmLevel || 0;
  drawStationIcon(STATIONS_X.farm, farmLvl>0?"🌾":"🌱");
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
  if (state.base && state.base.level >= 2) {
    drawStationIcon(STATIONS_X.shop,"🏪");
    ctx.fillStyle="#6a4a28"; ctx.fillRect(STATIONS_X.shop-22,groundY-32,44,32);
    ctx.fillStyle="#9a3a2a"; ctx.fillRect(STATIONS_X.shop-24,groundY-38,48,10);
    ctx.fillStyle="rgba(255,255,255,0.08)"; ctx.fillRect(STATIONS_X.shop-22,groundY-32,14,32);
  }
  if (state.base && state.base.level >= 3) {
    drawStationIcon(STATIONS_X.guard,"⚔");
    ctx.strokeStyle="#6a4a28"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(STATIONS_X.guard-18,groundY-8); ctx.lineTo(STATIONS_X.guard+18,groundY-8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(STATIONS_X.guard-14,groundY-8); ctx.lineTo(STATIONS_X.guard-14,groundY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(STATIONS_X.guard+14,groundY-8); ctx.lineTo(STATIONS_X.guard+14,groundY); ctx.stroke();
    ctx.strokeStyle="#9a9aaa"; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(STATIONS_X.guard-10,groundY-14); ctx.lineTo(STATIONS_X.guard-2,groundY-8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(STATIONS_X.guard+10,groundY-14); ctx.lineTo(STATIONS_X.guard+2,groundY-8); ctx.stroke();
  }
}

export function drawBackgroundWash(dark) {
  drawBackgroundReadabilityWash(dark);
}
