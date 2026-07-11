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
  const lf=x-3+s*spread, rf=x+3-s*spread;
  ctx.beginPath(); ctx.moveTo(x-3,baseYy); ctx.lineTo(lf,groundY-2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+3,baseYy); ctx.lineTo(rf,groundY-2); ctx.stroke();
  ctx.lineCap="butt";
  drawBoot(lf,groundY,col,0.9);
  drawBoot(rf,groundY,col,0.9);
}

export function drawBoot(x, y, col, scale=1, dir=1) {
  ctx.save();
  ctx.fillStyle=col;
  roundedRect(x-2.7*scale, y-3.2*scale, 7.2*scale, 3.4*scale, 1.4*scale);
  ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.22)";
  ctx.fillRect(x-2.1*scale, y-0.8*scale, 6.4*scale, 1.1*scale);
  if (dir < 0) {
    ctx.fillRect(x-3.3*scale, y-2.2*scale, 1.6*scale, 1.2*scale);
  } else {
    ctx.fillRect(x+3.4*scale, y-2.2*scale, 1.6*scale, 1.2*scale);
  }
  ctx.restore();
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

const TOME_LOOKS = {
  fire_tome:      { cover:"#4a1810", spine:"#7b2416", page:"#f3d8a8", trim:"#ff9a3a", rune:"flame" },
  hydro_tome:     { cover:"#12384d", spine:"#1d6b85", page:"#d7f4ff", trim:"#74d8ff", rune:"wave" },
  lightning_tome: { cover:"#4c430c", spine:"#806c16", page:"#fff3b8", trim:"#fff06a", rune:"bolt" },
  meteor_tome:    { cover:"#2d1a10", spine:"#6a2b16", page:"#e6c49a", trim:"#ff8840", rune:"crack" },
  arcane_tome:    { cover:"#2c1b5c", spine:"#533090", page:"#eadfff", trim:"#d19aff", rune:"star" },
  shadow_tome:    { cover:"#17111f", spine:"#35154a", page:"#c4bad6", trim:"#9b4bd6", rune:"eye" },
  void_tome:      { cover:"#07050d", spine:"#241033", page:"#ddd7eb", trim:"#e0a0ff", rune:"void" },
};

function drawTomeRune(kind, trim) {
  ctx.strokeStyle = trim;
  ctx.fillStyle = trim;
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (kind) {
    case "flame":
      ctx.beginPath();
      ctx.moveTo(0, -5.2); ctx.bezierCurveTo(3, -2.6, 0.8, -0.7, 2.8, 2.8);
      ctx.bezierCurveTo(0.6, 1.4, -0.8, 3.9, -0.1, 5.1);
      ctx.bezierCurveTo(-3.8, 2.9, -2.4, -1.4, 0, -5.2);
      ctx.stroke();
      break;
    case "wave":
      ctx.beginPath();
      ctx.moveTo(-5, 1.5); ctx.quadraticCurveTo(-2.5, -2.5, 0, 1.5);
      ctx.quadraticCurveTo(2.5, 5, 5, 1.5);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, 4.5); ctx.quadraticCurveTo(-1, 2, 2, 4.4); ctx.stroke();
      break;
    case "bolt":
      ctx.beginPath();
      ctx.moveTo(1, -6); ctx.lineTo(-3, 0); ctx.lineTo(0.5, 0); ctx.lineTo(-1.2, 6); ctx.lineTo(4, -1.6); ctx.lineTo(0.5, -1.6);
      ctx.stroke();
      break;
    case "crack":
      ctx.beginPath();
      ctx.moveTo(-2.5, -6); ctx.lineTo(1.5, -2); ctx.lineTo(-1, 1); ctx.lineTo(3, 5.5);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(-4, 3, 1.3, 0, Math.PI * 2); ctx.fill();
      break;
    case "star":
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * Math.PI * 0.8;
        const x = Math.cos(a) * 5;
        const y = Math.sin(a) * 5;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 1.3, 0, Math.PI * 2); ctx.fill();
      break;
    case "eye":
      ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, Math.PI * 2); ctx.fill();
      break;
    case "void":
      ctx.beginPath(); ctx.arc(0, 0, 4.2, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, Math.PI * 2); ctx.fillStyle = "#06040a"; ctx.fill();
      break;
  }
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
}

export function drawTomeModel(weaponId, col, s = 1, opts = {}) {
  const look = TOME_LOOKS[weaponId] || { cover:"#23172e", spine:"#3a2448", page:"#eadfff", trim:col || "#d0a0ff", rune:"star" };
  const open = opts.open ?? 0.25;
  const glow = opts.glow ?? 0;
  const trim = look.trim || col || "#d0a0ff";
  ctx.save();
  ctx.scale(s, s);
  if (glow > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.18 + glow * 0.26;
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 24 + glow * 14);
    g.addColorStop(0, trim);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 26 + glow * 12, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  const spread = 2 + open * 4.5;
  const pageAlpha = Math.min(1, 0.25 + open * 1.2);
  ctx.save();
  ctx.rotate(-0.1 * open);
  roundedRect(-13 - spread, -10, 13, 18, 2.2);
  ctx.fillStyle = look.cover; ctx.fill();
  ctx.strokeStyle = trim; ctx.lineWidth = 1.1; ctx.stroke();
  ctx.globalAlpha = pageAlpha;
  roundedRect(-11 - spread, -8, 10, 14, 1.5);
  ctx.fillStyle = look.page; ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.24)"; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(-8 - spread, -5); ctx.lineTo(-3 - spread, -5); ctx.moveTo(-9 - spread, -1); ctx.lineTo(-3 - spread, -1); ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.rotate(0.1 * open);
  roundedRect(spread, -10, 13, 18, 2.2);
  ctx.fillStyle = look.cover; ctx.fill();
  ctx.strokeStyle = trim; ctx.lineWidth = 1.1; ctx.stroke();
  ctx.globalAlpha = pageAlpha;
  roundedRect(spread + 1, -8, 10, 14, 1.5);
  ctx.fillStyle = look.page; ctx.fill();
  ctx.globalAlpha = 1;
  ctx.translate(spread + 7, -0.5);
  drawTomeRune(look.rune, trim);
  ctx.restore();

  ctx.fillStyle = look.spine;
  roundedRect(-2.2, -11, 4.4, 20, 1.4);
  ctx.fill();
  ctx.strokeStyle = trim; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, 7); ctx.stroke();
  ctx.fillStyle = trim;
  ctx.beginPath(); ctx.arc(0, -7.2, 1.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 5.6, 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
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
