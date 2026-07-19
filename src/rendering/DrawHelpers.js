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

// ---------- Wand & staff models ----------
// Each caster weapon keeps its old id but is drawn as a unique wand or staff.
const WAND_LOOKS = {
  fire_tome:      { len:30, wood:"#2c1410", woodLt:"#5a2a1c", trim:"#ff9a3a", gem:"#ff6a2a", core:"#ffe8b0", kind:"cinder" },
  hydro_tome:     { len:30, wood:"#7a6a52", woodLt:"#b3a488", trim:"#74d8ff", gem:"#3ec2f0", core:"#e8fbff", kind:"tide" },
  lightning_tome: { len:44, wood:"#3d3524", woodLt:"#6a5c38", trim:"#fff06a", gem:"#f0e060", core:"#ffffff", kind:"storm" },
  meteor_tome:    { len:44, wood:"#332014", woodLt:"#5c3a22", trim:"#ff8840", gem:"#4a2c1c", core:"#ffb060", kind:"meteor" },
  arcane_tome:    { len:44, wood:"#4a3a72", woodLt:"#7a62b3", trim:"#d19aff", gem:"#b080ff", core:"#f0e4ff", kind:"arcane" },
  shadow_tome:    { len:42, wood:"#1a1322", woodLt:"#382348", trim:"#9b4bd6", gem:"#8822cc", core:"#e8d0ff", kind:"shadow" },
  void_tome:      { len:46, wood:"#0b0812", woodLt:"#2a1638", trim:"#e0a0ff", gem:"#07050d", core:"#e0a0ff", kind:"void" },
  blizzard_chime: { len:42, wood:"#c8d8e8", woodLt:"#f0fbff", trim:"#bfefff", gem:"#d8f8ff", core:"#ffffff", kind:"storm" },
  magma_mortar:   { len:46, wood:"#221715", woodLt:"#5a3324", trim:"#ff7a2a", gem:"#2a1814", core:"#ffd060", kind:"meteor" },
  possessed_heart:{ len:38, wood:"#160a22", woodLt:"#3d1b5c", trim:"#c45cff", gem:"#24102f", core:"#f0c8ff", kind:"void" },
};
const DEFAULT_WAND = { len:38, wood:"#3a2448", woodLt:"#5c3d70", trim:"#d0a0ff", gem:"#b080ff", core:"#f0e4ff", kind:"arcane" };

// Distance from the model origin to the staff tip (model space, before scaling).
export function wandTipLength(weaponId) {
  return (WAND_LOOKS[weaponId] || DEFAULT_WAND).len * 0.58;
}

function drawWandShaft(look, top, bot) {
  if (look.kind === "shadow") {
    // twisted dark wood: two intertwined strands
    ctx.lineCap = "round";
    ctx.strokeStyle = look.wood; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(-0.6, bot); ctx.bezierCurveTo(2.4, bot * 0.4, -2.6, top * 0.35, 0.4, top + 2); ctx.stroke();
    ctx.strokeStyle = look.woodLt; ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.moveTo(0.8, bot); ctx.bezierCurveTo(-2.2, bot * 0.4, 2.6, top * 0.35, -0.5, top + 2); ctx.stroke();
    ctx.lineCap = "butt";
    return;
  }
  if (look.kind === "cinder") {
    // kinked charred branch with glowing ember cracks
    ctx.lineCap = "round";
    ctx.strokeStyle = look.wood; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(0.5, bot); ctx.lineTo(-1.2, bot * 0.3); ctx.lineTo(1, top * 0.45); ctx.lineTo(-0.4, top + 1.5); ctx.stroke();
    ctx.strokeStyle = look.trim; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(-0.4, bot * 0.5); ctx.lineTo(0.6, bot * 0.15); ctx.moveTo(0.2, top * 0.55); ctx.lineTo(-0.6, top * 0.75); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineCap = "butt";
    return;
  }
  // straight shaft: dark body with a lighter core stripe
  ctx.lineCap = "round";
  ctx.strokeStyle = look.wood; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(0, bot); ctx.lineTo(0, top + 1.5); ctx.stroke();
  ctx.strokeStyle = look.woodLt; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-0.4, bot - 1); ctx.lineTo(-0.4, top + 2.5); ctx.stroke();
  ctx.lineCap = "butt";
  if (look.kind === "tide") {
    // spiral shell inlay winding up the driftwood
    ctx.strokeStyle = look.trim; ctx.lineWidth = 0.9; ctx.globalAlpha = 0.9;
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const p = i / 14, y = bot - 2 + (top + 4 - (bot - 2)) * p;
      const x = Math.sin(p * Math.PI * 3.2) * 1.9;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawWandHead(look, top, t, cast) {
  const flick = 0.8 + 0.2 * Math.sin(t * 7 + 1.3);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  switch (look.kind) {
    case "cinder": {
      // teardrop flame gem licking off the charred tip
      const fs = 1 + cast * 0.35;
      ctx.save(); ctx.translate(0, top - 3); ctx.scale(fs, fs * flick);
      ctx.fillStyle = look.gem;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.bezierCurveTo(3.6, -2.2, 3.2, 2.2, 0, 4);
      ctx.bezierCurveTo(-3.2, 2.2, -3.6, -2.2, 0, -6);
      ctx.fill();
      ctx.fillStyle = look.core;
      ctx.beginPath(); ctx.ellipse(0, 0.8, 1.5, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // stray embers
      ctx.fillStyle = look.trim;
      ctx.beginPath(); ctx.arc(3.2, top - 8 - Math.sin(t * 5) * 1.5, 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-2.8, top - 6 + Math.cos(t * 4) * 1.2, 0.6, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "tide": {
      // curled wave prong cradling a sea pearl
      ctx.strokeStyle = look.woodLt; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, top + 1); ctx.bezierCurveTo(-4.5, top - 2, -4.5, top - 8, 0.5, top - 8.5); ctx.stroke();
      ctx.strokeStyle = look.trim; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, top); ctx.bezierCurveTo(-3.4, top - 2.4, -3.4, top - 7, 0.4, top - 7.5); ctx.stroke();
      ctx.fillStyle = look.gem;
      ctx.beginPath(); ctx.arc(0.8, top - 4.6, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = look.core;
      ctx.beginPath(); ctx.arc(-0.1, top - 5.6, 1, 0, Math.PI * 2); ctx.fill();
      // falling droplet
      ctx.fillStyle = look.trim; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(3.6, top - 0.5 + ((t * 6) % 3), 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case "storm": {
      // iron fork with a live spark arcing between the prongs
      ctx.strokeStyle = "#8a8a96"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, top + 1); ctx.quadraticCurveTo(-4, top - 2, -3.6, top - 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, top + 1); ctx.quadraticCurveTo(4, top - 2, 3.6, top - 8); ctx.stroke();
      ctx.fillStyle = "#b8b8c4";
      ctx.beginPath(); ctx.arc(-3.6, top - 8, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(3.6, top - 8, 1.2, 0, Math.PI * 2); ctx.fill();
      // zig-zag spark
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 11) + cast * 0.4;
      ctx.strokeStyle = look.core; ctx.lineWidth = 1.1;
      const j1 = Math.sin(t * 17) * 1.6, j2 = Math.cos(t * 13) * 1.6;
      ctx.beginPath();
      ctx.moveTo(-3.6, top - 8);
      ctx.lineTo(-1.2 + j1, top - 6.4); ctx.lineTo(1 + j2, top - 9.2); ctx.lineTo(3.6, top - 8);
      ctx.stroke();
      ctx.restore();
      // amber charge bead at the fork base
      ctx.fillStyle = look.gem;
      ctx.beginPath(); ctx.arc(0, top - 1, 1.8, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "meteor": {
      // cracked molten rock orb clasped by the staff
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.4 * flick + cast * 0.3;
      const mg = ctx.createRadialGradient(0, top - 5, 1, 0, top - 5, 9);
      mg.addColorStop(0, look.core); mg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(0, top - 5, 9, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = look.gem;
      ctx.beginPath(); ctx.arc(0, top - 5, 5.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = look.core; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-3.6, top - 7.4); ctx.lineTo(-0.6, top - 4.6); ctx.lineTo(-2.2, top - 2.2);
      ctx.moveTo(2, top - 8.6); ctx.lineTo(1, top - 5.2); ctx.lineTo(3.8, top - 3.6);
      ctx.stroke();
      // stone claws holding the orb
      ctx.strokeStyle = look.woodLt; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(-2.6, top + 1.5); ctx.quadraticCurveTo(-4.4, top - 1, -3.4, top - 3.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2.6, top + 1.5); ctx.quadraticCurveTo(4.4, top - 1, 3.4, top - 3.4); ctx.stroke();
      // drifting pebble
      ctx.fillStyle = look.trim;
      ctx.beginPath(); ctx.arc(5.4, top - 9 + Math.sin(t * 2.6) * 1.4, 0.9, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "arcane": {
      // crescent cradle with a floating, bobbing crystal
      const bob = Math.sin(t * 2.4) * 1.2;
      ctx.strokeStyle = look.woodLt; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(0, top - 5, 5.5, Math.PI * 0.72, Math.PI * 2.28); ctx.stroke();
      ctx.strokeStyle = look.trim; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.arc(0, top - 5, 5.5, Math.PI * 0.78, Math.PI * 2.22); ctx.stroke();
      ctx.save(); ctx.translate(0, top - 5 + bob); ctx.rotate(t * 0.9);
      ctx.fillStyle = look.gem;
      ctx.beginPath(); ctx.moveTo(0, -3.4); ctx.lineTo(2.3, 0); ctx.lineTo(0, 3.4); ctx.lineTo(-2.3, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = look.core;
      ctx.beginPath(); ctx.moveTo(0, -1.5); ctx.lineTo(1, 0); ctx.lineTo(0, 1.5); ctx.lineTo(-1, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
      // twinkle
      ctx.strokeStyle = look.core; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 5);
      ctx.beginPath(); ctx.moveTo(5.5, top - 11); ctx.lineTo(5.5, top - 8); ctx.moveTo(4, top - 9.5); ctx.lineTo(7, top - 9.5); ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case "shadow": {
      // claw talons gripping an unblinking eye orb
      ctx.strokeStyle = look.wood; ctx.lineWidth = 1.9;
      ctx.beginPath(); ctx.moveTo(-2.2, top + 2); ctx.quadraticCurveTo(-5, top - 2.5, -2.8, top - 7.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2.2, top + 2); ctx.quadraticCurveTo(5, top - 2.5, 2.8, top - 7.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, top + 1); ctx.lineTo(0, top - 2); ctx.stroke();
      ctx.fillStyle = look.gem;
      ctx.beginPath(); ctx.arc(0, top - 5, 4.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = look.core;
      ctx.beginPath(); ctx.ellipse(0, top - 5, 2.9, 1.7, 0, 0, Math.PI * 2); ctx.fill();
      // slit pupil that narrows while casting
      ctx.fillStyle = "#0c0614";
      ctx.beginPath(); ctx.ellipse(0, top - 5, Math.max(0.4, 1 - cast * 0.7), 1.6, 0, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "void": {
      // obsidian annulus holding a black orb with an orbiting mote
      ctx.strokeStyle = look.woodLt; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(0, top - 6, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = look.trim; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(0, top - 6, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = look.gem;
      ctx.beginPath(); ctx.arc(0, top - 6, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = look.core; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(0, top - 6, 3.4, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      const oa = t * 2.2;
      ctx.fillStyle = look.core;
      ctx.beginPath(); ctx.arc(Math.cos(oa) * 6, top - 6 + Math.sin(oa) * 6 * 0.4, 1.1, 0, Math.PI * 2); ctx.fill();
      break;
    }
  }
  ctx.lineCap = "butt"; ctx.lineJoin = "miter";
}

function wandUpgradeRank(fx) {
  return fx?._tierRank || 0;
}

function wandUpgradeColor(fx, fallback) {
  return fx?._vfxCols?.length ? fx._vfxCols[fx._vfxCols.length - 1] : (fx?._tierCol || fallback);
}

function drawWandOrbit(cx, cy, rx, ry, count, col, t, opts = {}) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < count; k++) {
    const a = t * (opts.speed || 1.9) + k * Math.PI * 2 / count + (opts.phase || 0);
    const p = (Math.sin(a) + 1) * 0.5;
    ctx.globalAlpha = (opts.alpha || 0.58) * (0.45 + p * 0.55);
    ctx.fillStyle = k % 3 === 0 ? "#ffffff" : col;
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, (opts.size || 1.2) + p * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawMagicUpgradeLayer(weaponId, look, top, bot, rank, col, t, cast) {
  if (rank < 2) return;
  const legendary = rank >= 3;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (weaponId === "fire_tome") {
    for (let k = 0; k < 4; k++) {
      const p = (t * 0.45 + k * 0.22) % 1;
      const y = bot - p * (bot - top + 4);
      const x = Math.sin(t * 4 + k) * 5;
      ctx.globalAlpha = (1 - p) * 0.55;
      ctx.strokeStyle = k % 2 ? "#ffcc60" : col;
      ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.arc(x, y, 2 + p * 2, 0.3, Math.PI * 1.45); ctx.stroke();
    }
    ctx.globalAlpha = 0.55 + 0.18 * Math.sin(t * 5);
    ctx.strokeStyle = legendary ? "#ffe080" : "#ff6a2a";
    ctx.lineWidth = legendary ? 1.35 : 0.9;
    ctx.beginPath();
    ctx.moveTo(-0.8, bot * 0.65); ctx.lineTo(1.1, bot * 0.22); ctx.lineTo(-0.6, top * 0.42); ctx.lineTo(0.9, top + 4);
    ctx.stroke();
    if (legendary) {
      const faceY = top - 7;
      ctx.fillStyle = "#240808";
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 4);
      ctx.beginPath(); ctx.arc(-1.5, faceY, 0.65, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(1.5, faceY, 0.65, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#240808"; ctx.lineWidth = 0.75;
      ctx.beginPath(); ctx.arc(0, faceY + 1.8, 1.5, 0.1, Math.PI - 0.1); ctx.stroke();
    }
  } else if (weaponId === "hydro_tome") {
    ctx.strokeStyle = legendary ? "#ffffff" : "#74d8ff";
    ctx.lineWidth = legendary ? 1.7 : 1.1;
    ctx.globalAlpha = 0.52 + 0.12 * Math.sin(t * 3.5);
    ctx.beginPath();
    for (let i = 0; i <= 18; i++) {
      const p = i / 18;
      const y = bot - p * (bot - top + 2);
      const x = Math.sin(p * Math.PI * 4 + t * 3.2) * (legendary ? 3.6 : 2.4);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    for (let k = 0; k < (legendary ? 8 : 5); k++) {
      const p = (t * 0.7 + k * 0.19) % 1;
      ctx.globalAlpha = 0.22 + 0.28 * (1 - p);
      ctx.fillStyle = k % 2 ? "#e8fbff" : "#74d8ff";
      ctx.beginPath(); ctx.ellipse(Math.sin(k * 2.1 + t) * 7, top - 4 + p * 20, 0.9, 1.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (legendary) {
      ctx.globalAlpha = 0.42 + 0.12 * Math.sin(t * 2.6);
      ctx.strokeStyle = "#a0e8ff"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, top - 6, 12, 4.5, t * 0.2, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#d8fbff";
      ctx.beginPath(); ctx.moveTo(-6, top - 11); ctx.lineTo(-2, top - 16); ctx.lineTo(0, top - 11); ctx.lineTo(3, top - 17); ctx.lineTo(7, top - 11); ctx.closePath(); ctx.fill();
    }
  } else if (weaponId === "void_tome") {
    ctx.globalAlpha = legendary ? 0.42 : 0.26;
    ctx.strokeStyle = col;
    ctx.lineWidth = legendary ? 1.4 : 0.9;
    for (let k = 0; k < (legendary ? 4 : 2); k++) {
      ctx.beginPath();
      ctx.ellipse(0, top - 6, 8 + k * 3.8, 4 + k * 1.4, t * 0.7 + k, 0, Math.PI * 2);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(0, top - 6, 1, 0, top - 6, legendary ? 20 : 13);
    g.addColorStop(0, "#030208");
    g.addColorStop(0.45, "rgba(80,20,120,0.75)");
    g.addColorStop(1, "rgba(224,160,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, top - 6, legendary ? 18 : 11, 0, Math.PI * 2); ctx.fill();
    drawWandOrbit(0, top - 6, legendary ? 17 : 11, legendary ? 8 : 5, legendary ? 9 : 5, col, t, { size: 1, alpha: 0.75, speed: legendary ? 2.8 : 1.9 });
  } else {
    ctx.globalAlpha = 0.3 + 0.12 * Math.sin(t * 3);
    ctx.strokeStyle = col;
    ctx.lineWidth = legendary ? 1.4 : 0.9;
    ctx.beginPath(); ctx.moveTo(-4, top + 2); ctx.quadraticCurveTo(4, (top + bot) * 0.5, -3, bot - 2); ctx.stroke();
    if (legendary) drawWandOrbit(0, top - 4, 12, 7, 5, col, t, { size: 1.1, alpha: 0.55 });
  }
  ctx.restore();
}

export function drawWandModel(weaponId, col, s = 1, opts = {}) {
  const look = WAND_LOOKS[weaponId] || { ...DEFAULT_WAND, trim: col || DEFAULT_WAND.trim };
  const cast = clamp(opts.cast ?? 0, 0, 1);
  const fx = opts.fx || null;
  const rank = wandUpgradeRank(fx);
  const upgCol = wandUpgradeColor(fx, look.trim);
  const glow = (opts.glow ?? 0) + cast * 0.5;
  const t = performance.now() / 1000;
  const top = -look.len * 0.58, bot = look.len * 0.42;
  ctx.save();
  ctx.scale(s, s);
  // halo around the head
  if (glow > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.16 + glow * 0.24;
    const g = ctx.createRadialGradient(0, top - 4, 2, 0, top - 4, 16 + glow * 10);
    g.addColorStop(0, look.trim);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, top - 4, 18 + glow * 9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (rank >= 2) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.1 + rank * 0.06 + 0.05 * Math.sin(t * 2.5);
    const g2 = ctx.createRadialGradient(0, top - 4, 1, 0, top - 4, 20 + rank * 8);
    g2.addColorStop(0, upgCol);
    g2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(0, top - 4, 22 + rank * 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  drawWandShaft(look, top, bot);
  drawMagicUpgradeLayer(weaponId, look, top, bot, rank, upgCol, t, cast);
  // metal ferrule under the head and a butt cap
  ctx.fillStyle = look.trim;
  roundedRect(-2, top + 1.5, 4, 2.4, 1);
  ctx.fill();
  ctx.fillStyle = look.woodLt;
  roundedRect(-1.8, bot - 1.5, 3.6, 2.6, 1.2);
  ctx.fill();
  // leather grip wrap just below middle
  ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 3.8;
  ctx.beginPath(); ctx.moveTo(0, bot * 0.28); ctx.lineTo(0, bot * 0.72); ctx.stroke();
  ctx.strokeStyle = look.woodLt; ctx.lineWidth = 0.8;
  for (let k = 0; k < 3; k++) {
    const y = bot * 0.34 + k * bot * 0.14;
    ctx.beginPath(); ctx.moveTo(-1.9, y); ctx.lineTo(1.9, y + 1.2); ctx.stroke();
  }
  drawWandHead(look, top, t, cast);
  if (rank >= 3) {
    drawWandOrbit(0, top - 5, weaponId === "void_tome" ? 18 : 12, weaponId === "hydro_tome" ? 5 : 8, weaponId === "void_tome" ? 7 : 4, upgCol, t, { size: 1.1, alpha: 0.45 });
  }
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
