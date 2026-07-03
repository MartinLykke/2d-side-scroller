import { clamp, lerp, lerpColor, rgb, withA, shade } from '../util/math.js';
import { ctx, groundY } from '../core/canvas.js';

// ---------- Basic shapes ----------
export function groundShadow(x, w, a) {
  ctx.save(); ctx.globalAlpha=a; ctx.fillStyle="#0a0810";
  ctx.beginPath(); ctx.ellipse(x,groundY+2,w,w*0.26,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

export function roundedRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}

// ---------- Character drawing ----------
export function legs(x, baseYy, anim, spread, col) {
  ctx.strokeStyle=col; ctx.lineWidth=2.6; ctx.lineCap="round";
  const s=Math.sin(anim);
  ctx.beginPath(); ctx.moveTo(x-3,baseYy); ctx.lineTo(x-3+s*spread,groundY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+3,baseYy); ctx.lineTo(x+3-s*spread,groundY); ctx.stroke();
  ctx.lineCap="butt";
}

export function drawArm(x1,y1,x2,y2,col) {
  ctx.strokeStyle=col; ctx.lineWidth=2.5; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  ctx.lineCap="butt";
}

// ---------- Icons and UI elements ----------
export function drawTomeIcon(col, s) {
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

export function drawHpBar(x, y, w, frac, color) {
  frac=clamp(frac,0,1); if (frac>=0.999) return;
  ctx.fillStyle="rgba(0,0,0,0.55)"; ctx.fillRect(x-w/2-1,y-1,w+2,5);
  ctx.fillStyle=color; ctx.fillRect(x-w/2,y,w*frac,3);
}

export function drawFocusHalo(x, y, rx, ry, col, alpha) {
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

export function drawHeart(x, y, s, col) {
  ctx.fillStyle=col; ctx.beginPath();
  ctx.moveTo(x,y+s*0.9); ctx.bezierCurveTo(x-s*1.4,y-s*0.4,x-s*0.4,y-s*1.2,x,y-s*0.4);
  ctx.bezierCurveTo(x+s*0.4,y-s*1.2,x+s*1.4,y-s*0.4,x,y+s*0.9); ctx.fill();
}

// ---------- Color helpers ----------
export function stoneCol(dark) { return rgb(lerpColor([96,88,100],[24,22,28],dark)); }
export function stoneLt(dark)  { return rgb(lerpColor([136,128,142],[44,40,48],dark)); }
export function woodCol(dark)  { return rgb(lerpColor([100,74,44],[26,18,12],dark)); }

export function litWindow(dark) {
  const { FX } = window;
  const fl=(FX&&FX.flicker)||1;
  return 0.5+0.5*(dark>0.2?fl:0.32);
}
