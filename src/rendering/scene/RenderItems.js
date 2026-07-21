import { clamp, dist } from '../../util/math.js';
import { WEAPONS, RARITY_COL } from '../../config/weapons.js?v=biomeweapons1';
import { ctx, groundY } from '../../core/canvas.js';
import { state } from '../../core/state.js';
import { groundShadow } from '../DrawHelpers.js?v=biomeweapons1';
import { drawWeaponModel } from '../ItemRender.js?v=biomeweapons1';
import { visibleWorldBounds } from '../Viewport.js';

const STUCK_ARROW_FADE_TIME = 0.55;

function stuckArrowAlpha(ar) {
  return clamp(ar.stuckTimer / Math.min(STUCK_ARROW_FADE_TIME, ar.stuckMaxTimer || STUCK_ARROW_FADE_TIME), 0, 1);
}

function drawStuckArrowShaft(ar, alpha) {
  ctx.globalAlpha = alpha;
  const wid = ar.weaponId;
  if (ar.ballista) {
    // Heavy ballista bolt lodged in the ground
    ctx.strokeStyle = "#4a3a28"; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(-16,0); ctx.lineTo(7,0); ctx.stroke();
    ctx.fillStyle = "#9aa2ae";
    ctx.beginPath(); ctx.moveTo(7,-3); ctx.lineTo(14,0); ctx.lineTo(7,3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#8f2a24";
    ctx.beginPath(); ctx.moveTo(-16,0); ctx.lineTo(-21,-4); ctx.lineTo(-13.5,-1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-16,0); ctx.lineTo(-21,4); ctx.lineTo(-13.5,1); ctx.closePath(); ctx.fill();
    return;
  }
  const magic = wid === "void_bow" || wid === "dark_bow" || wid === "dragons_bow" || ar.upgradeCol;
  if (ar.upgradeCol) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.26 * alpha;
    ctx.strokeStyle = ar.upgradeCol; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(5, 0); ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = ar.powered ? "#e8c060" : magic ? "#e8d8ff" : "#c9b48a";
  ctx.lineWidth = magic ? 1.7 : 1.4;
  ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(5,0); ctx.stroke();
  ctx.fillStyle = "#b8bcc4";
  ctx.beginPath(); ctx.moveTo(5,-1.6); ctx.lineTo(8.5,0); ctx.lineTo(5,1.6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = ar.powered ? "#ffcc44" : magic ? "#c69fff" : "#8fae4a";
  ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(-13,-2.6); ctx.lineTo(-8.5,-0.6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(-13,2.6); ctx.lineTo(-8.5,0.6); ctx.closePath(); ctx.fill();
  drawArrowBranchCoating(ar, performance.now() / 1000, alpha);
}

function drawArrowBranchCoating(ar, t, alpha = 1) {
  if (!ar.frostArrow && !ar.rootArrow) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (ar.frostArrow) {
    ctx.globalAlpha = alpha * (0.36 + 0.16 * Math.sin(t * 12 + ar.x * 0.01));
    ctx.strokeStyle = "#bfefff";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(8, 0); ctx.stroke();
    ctx.fillStyle = "#ffffff";
    for (let k = 0; k < 4; k++) {
      const x = -8 + k * 4.6;
      const y = k % 2 ? 2.2 : -2.2;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 2, y); ctx.lineTo(x - 1, y * 0.55); ctx.closePath(); ctx.fill();
    }
  }
  if (ar.rootArrow) {
    ctx.globalAlpha = alpha * 0.62;
    ctx.strokeStyle = ar.frostArrow ? "#d8fbff" : "#8fd8ff";
    ctx.lineWidth = 0.9;
    for (let k = 0; k < 5; k++) {
      const x = -12 + k * 4.6;
      ctx.beginPath(); ctx.ellipse(x, Math.sin(t * 8 + k) * 0.5, 1.7, 2.4, 0.75, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawCoins() {
  const t=performance.now();
  const view = visibleWorldBounds(80);
  for (const c of state.coins) {
    if (c.x < view.left || c.x > view.right) continue;
    const v = c.value || 1;
    // Tier look: 1 = small gold, 5 = larger amber with rim, 10+ = big pale-gold with glow ring
    const sc = v >= 10 ? 1.6 : v >= 5 ? 1.3 : 1;
    const body = v >= 10 ? "#ffe9a0" : v >= 5 ? "#f0a63a" : "#f2c14e";
    const inner = v >= 10 ? "#e3b53c" : v >= 5 ? "#b06f1a" : "#caa028";
    const yy=c.settled?groundY-4*sc-Math.sin(t/300+c.x)*1.5:c.y;
    if (c.settled) groundShadow(c.x,5*sc,0.15);
    if (v >= 10) {
      // soft glow so high-value coins pop
      const g=ctx.createRadialGradient(c.x,yy,2,c.x,yy,14);
      g.addColorStop(0,"rgba(255,230,140,0.5)"); g.addColorStop(1,"rgba(255,230,140,0)");
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(c.x,yy,14,0,Math.PI*2); ctx.fill();
    }
    ctx.fillStyle=body; ctx.beginPath(); ctx.ellipse(c.x,yy,5*sc,6*sc,0,0,Math.PI*2); ctx.fill();
    if (v >= 5) {
      ctx.strokeStyle = v >= 10 ? "#fff6d0" : "#ffd98a"; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.ellipse(c.x,yy,5*sc-1,6*sc-1,0,0,Math.PI*2); ctx.stroke();
    }
    ctx.fillStyle=inner; ctx.beginPath(); ctx.ellipse(c.x,yy,2.4*sc,3.4*sc,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(255,250,210,0.9)"; ctx.beginPath(); ctx.ellipse(c.x-1.4*sc,yy-1.8*sc,1*sc,1.6*sc,0,0,Math.PI*2); ctx.fill();
  }
}

export function drawGoldCollectors() {
  if (!state.goldCollectors || !state.goldCollectors.length) return;
  const t = performance.now() / 1000;
  const view = visibleWorldBounds(100);
  for (const w of state.goldCollectors) {
    if (w.x < view.left || w.x > view.right) continue;
    const y = w.y || groundY - 56;
    const flash = clamp((w.flash || 0) / 0.24, 0, 1);
    groundShadow(w.x, 8 + flash * 5, 0.12 + flash * 0.08);
    ctx.save();
    ctx.translate(w.x, y);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, 24 + flash * 14);
    glow.addColorStop(0, `rgba(255,232,150,${0.55 + flash * 0.35})`);
    glow.addColorStop(0.5, "rgba(242,193,78,0.22)");
    glow.addColorStop(1, "rgba(242,193,78,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, 24 + flash * 14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#ffe9a3";
    ctx.beginPath(); ctx.ellipse(0, 0, 6.5 + flash * 1.5, 7.5 + flash * 1.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#c98524";
    ctx.beginPath(); ctx.ellipse(0, 0, 2.5, 4.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#fff6c8";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, 10, t * 2, t * 2 + Math.PI * 1.35); ctx.stroke();

    ctx.fillStyle = w.target ? "#ffffff" : "#f2c14e";
    for (let i = 0; i < 2; i++) {
      const a = t * 4 + i * Math.PI + (w.bob || 0);
      ctx.beginPath(); ctx.arc(Math.cos(a) * 12, Math.sin(a) * 6, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

export function drawArrows() {
  const t = performance.now() / 1000;
  const view = visibleWorldBounds(300);
  for (const ar of state.arrows) {
    if (ar.delay > 0) continue; // still nocked on the archer's bow
    if (ar.x < view.left || ar.x > view.right) continue;
    const ang = ar.stuck ? (ar.frozenAngle || 0) : Math.atan2(ar.vy,ar.vx);
    ctx.save(); ctx.translate(ar.x,ar.y); ctx.rotate(ang);
    const wid = ar.weaponId;
    if (ar.stuck) {
      drawStuckArrowShaft(ar, stuckArrowAlpha(ar));
      ctx.restore();
      continue;
    }
    if (ar.upgradeCol) {
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.28 + Math.min(0.18, (ar.upgradeRank || 1) * 0.04);
      const ug=ctx.createRadialGradient(0,0,1,0,0,15 + (ar.upgradeRank || 1) * 4);
      ug.addColorStop(0, ar.upgradeCol); ug.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle=ug; ctx.beginPath(); ctx.arc(0,0,20 + (ar.upgradeRank || 1) * 3,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
    drawArrowBranchCoating(ar, t);
    if (ar.magma) {
      // The colossus throws dense, cracked chunks of the mountain — not a
      // generic fireball. The short ash wake keeps the projectile readable at
      // speed without making it look weightless.
      const spin = t * 8 + ar.x * 0.012;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.42 + 0.12 * Math.sin(t * 11 + ar.x);
      const wake = ctx.createLinearGradient(-42, 0, 9, 0);
      wake.addColorStop(0, "rgba(125,18,0,0)");
      wake.addColorStop(0.58, "rgba(244,75,24,0.2)");
      wake.addColorStop(1, "rgba(255,174,64,0.62)");
      ctx.fillStyle = wake;
      ctx.beginPath(); ctx.ellipse(-18, 0, 28, 6.5, 0, 0, Math.PI * 2); ctx.fill();
      const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, 19);
      glow.addColorStop(0, "rgba(255,96,22,0.34)");
      glow.addColorStop(0.4, "rgba(224,55,14,0.3)");
      glow.addColorStop(1, "rgba(130,15,0,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.save(); ctx.rotate(spin);
      ctx.fillStyle = "#0b0e12";
      ctx.beginPath();
      ctx.moveTo(-12, -8); ctx.lineTo(2, -13); ctx.lineTo(13, -5); ctx.lineTo(11, 8);
      ctx.lineTo(1, 12); ctx.lineTo(-13, 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#3a424b";
      ctx.beginPath();
      ctx.moveTo(-8, -7); ctx.lineTo(2, -10); ctx.lineTo(9, -4); ctx.lineTo(5, 3);
      ctx.lineTo(-2, 1); ctx.lineTo(-9, 6); ctx.lineTo(-10, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#080a0d"; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.88;
      ctx.strokeStyle = "#f45a21"; ctx.lineWidth = 1.55; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-6, 1); ctx.lineTo(-1, -2); ctx.lineTo(3, 2); ctx.lineTo(7, -1); ctx.stroke();
      ctx.strokeStyle = "rgba(255,229,152,0.75)"; ctx.lineWidth = 0.65; ctx.stroke();
      ctx.restore();
      ctx.restore();
      ctx.restore();
      continue;
    }
    if (ar.enemyFireball) {
      const sc = ar.scale || (ar.big ? 2.1 : 1);
      // Void wraith bolts burn cold violet; everything else is hellfire orange
      const pal = ar.voidBolt
        ? { core: "rgba(220,240,255,1)", mid: "rgba(150,110,255,0.85)", edge: "rgba(50,20,120,0)", dot: "#b9e8ff", tail: "#8a5aff" }
        : { core: "rgba(255,245,150,1)", mid: "rgba(255,105,20,0.85)", edge: "rgba(160,20,0,0)", dot: "#ffd060", tail: "#ff5a16" };
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.scale(sc, sc);
      const pulse = 0.85 + 0.15 * Math.sin(t * 24 + ar.x);
      const fg=ctx.createRadialGradient(0,0,2,0,0,20 * pulse);
      fg.addColorStop(0,pal.core);
      fg.addColorStop(0.35,pal.mid);
      fg.addColorStop(1,pal.edge);
      ctx.fillStyle=fg; ctx.beginPath(); ctx.arc(0,0,20 * pulse,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=pal.dot; ctx.beginPath(); ctx.arc(4,0,5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=pal.tail; ctx.beginPath(); ctx.moveTo(-18,0); ctx.quadraticCurveTo(-7,-10,3,-3); ctx.quadraticCurveTo(-7,8,-18,0); ctx.fill();
      if (ar.big) {
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = ar.voidBolt ? "#d7f6ff" : "#ff8a30"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-30,0); ctx.quadraticCurveTo(-16,-7+Math.sin(t*30)*3,-4,-2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-30,0); ctx.quadraticCurveTo(-16,7+Math.sin(t*26)*3,-4,2); ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
      continue;
    }
    if (ar.ballista) {
      // Massive iron-tipped siege bolt with a speed-shred wake
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.35;
      const bw=ctx.createLinearGradient(-34,0,0,0);
      bw.addColorStop(0,"rgba(255,150,60,0)"); bw.addColorStop(1,"rgba(255,190,110,0.55)");
      ctx.fillStyle=bw; ctx.beginPath(); ctx.ellipse(-16,0,18,3.5,0,0,Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle="#3a2c1c"; ctx.lineWidth=4;
      ctx.beginPath(); ctx.moveTo(-18,0); ctx.lineTo(8,0); ctx.stroke();
      ctx.strokeStyle="#6b4f2e"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(-18,0); ctx.lineTo(8,0); ctx.stroke();
      // iron bands
      ctx.strokeStyle="#9aa2ae"; ctx.lineWidth=4;
      ctx.beginPath(); ctx.moveTo(-4,-2); ctx.lineTo(-4,2); ctx.moveTo(-12,-2); ctx.lineTo(-12,2); ctx.stroke();
      // heavy head
      ctx.fillStyle="#b8bfc9";
      ctx.beginPath(); ctx.moveTo(8,-3.4); ctx.lineTo(17,0); ctx.lineTo(8,3.4); ctx.closePath(); ctx.fill();
      ctx.fillStyle="#7a828e";
      ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(17,0); ctx.lineTo(8,3.4); ctx.closePath(); ctx.fill();
      // crimson vanes
      ctx.fillStyle="#8f2a24";
      ctx.beginPath(); ctx.moveTo(-18,0); ctx.lineTo(-24,-4.4); ctx.lineTo(-15,-1); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-18,0); ctx.lineTo(-24,4.4); ctx.lineTo(-15,1); ctx.closePath(); ctx.fill();
      ctx.restore();
      continue;
    }
    if (ar.powered) {
      // Power shot: white-hot golden arrow with a comet glow
      ctx.save(); ctx.globalCompositeOperation="lighter";
      const pg=ctx.createRadialGradient(2,0,1,2,0,16);
      pg.addColorStop(0,"rgba(255,250,220,0.95)");
      pg.addColorStop(0.4,"rgba(255,204,68,0.7)");
      pg.addColorStop(1,"rgba(200,120,0,0)");
      ctx.fillStyle=pg; ctx.beginPath(); ctx.arc(2,0,16,0,Math.PI*2); ctx.fill();
      const tail=ctx.createLinearGradient(-30,0,0,0);
      tail.addColorStop(0,"rgba(255,180,40,0)"); tail.addColorStop(1,"rgba(255,220,110,0.6)");
      ctx.fillStyle=tail; ctx.beginPath(); ctx.ellipse(-14,0,16,3,0,0,Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle="#ffe9a0"; ctx.lineWidth=2.2;
      ctx.beginPath(); ctx.moveTo(-12,0); ctx.lineTo(6,0); ctx.stroke();
      ctx.fillStyle="#fff6d0";
      ctx.beginPath(); ctx.moveTo(6,-2); ctx.lineTo(10.5,0); ctx.lineTo(6,2); ctx.closePath(); ctx.fill();
      ctx.fillStyle="#ffcc44";
      ctx.beginPath(); ctx.moveTo(-12,0); ctx.lineTo(-15.5,-3); ctx.lineTo(-10,-0.7); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-12,0); ctx.lineTo(-15.5,3); ctx.lineTo(-10,0.7); ctx.closePath(); ctx.fill();
      ctx.restore();
      continue;
    }
    if (ar.fireArrow) {
      ctx.save(); ctx.globalCompositeOperation="lighter";
      const fg=ctx.createRadialGradient(1,0,1,1,0,17);
      fg.addColorStop(0,"rgba(255,230,110,0.95)");
      fg.addColorStop(0.45,"rgba(255,100,20,0.65)");
      fg.addColorStop(1,"rgba(180,20,0,0)");
      ctx.fillStyle=fg; ctx.beginPath(); ctx.arc(1,0,17,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=0.7;
      ctx.strokeStyle="#ff7a20"; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(-18,0); ctx.lineTo(5,0); ctx.stroke();
      ctx.restore();
    }
    if (wid === "acid_blowgun") {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.55;
      const ag = ctx.createRadialGradient(0,0,1,0,0,11);
      ag.addColorStop(0,"rgba(184,255,122,0.8)"); ag.addColorStop(1,"rgba(50,120,35,0)");
      ctx.fillStyle=ag; ctx.beginPath(); ctx.arc(0,0,11,0,Math.PI*2); ctx.fill(); ctx.restore();
      ctx.strokeStyle="#5b3a24"; ctx.lineWidth=1.8;
      ctx.beginPath(); ctx.moveTo(-14,0); ctx.lineTo(6,0); ctx.stroke();
      ctx.fillStyle="#7fe05a"; ctx.beginPath(); ctx.moveTo(6,-1.6); ctx.lineTo(11,0); ctx.lineTo(6,1.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle="#b8ff7a"; ctx.beginPath(); ctx.arc(3,0,1.3,0,Math.PI*2); ctx.fill();
    } else if (wid === "sandstorm_sling") {
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.5;
      const sg=ctx.createRadialGradient(0,0,1,0,0,15);
      sg.addColorStop(0,"rgba(255,224,160,0.75)"); sg.addColorStop(1,"rgba(120,80,30,0)");
      ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(0,0,15,0,Math.PI*2); ctx.fill(); ctx.restore();
      ctx.fillStyle="#d8b46a"; ctx.beginPath(); ctx.ellipse(0,0,5.2,4.2,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#ffe0a0"; ctx.beginPath(); ctx.arc(-1.2,-1.2,1.2,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="rgba(255,224,160,0.65)"; ctx.lineWidth=1.1;
      ctx.beginPath(); ctx.arc(-5,0,8,-0.7,0.7); ctx.stroke();
    } else if (wid === "splinter_bow") {
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.42;
      const lg=ctx.createRadialGradient(0,0,1,0,0,13);
      lg.addColorStop(0,"rgba(143,208,90,0.8)"); lg.addColorStop(1,"rgba(30,100,30,0)");
      ctx.fillStyle=lg; ctx.beginPath(); ctx.arc(0,0,13,0,Math.PI*2); ctx.fill(); ctx.restore();
      ctx.strokeStyle="#8d673a"; ctx.lineWidth=1.7;
      ctx.beginPath(); ctx.moveTo(-12,0); ctx.lineTo(6,0); ctx.stroke();
      ctx.fillStyle="#c9b48a"; ctx.beginPath(); ctx.moveTo(6,-1.8); ctx.lineTo(11,0); ctx.lineTo(6,1.8); ctx.closePath(); ctx.fill();
      ctx.fillStyle="#8fd05a";
      for (let k=0;k<3;k++) { const bx=-8+k*4; ctx.beginPath(); ctx.ellipse(bx, k%2?-2.2:2.2, 1.2, 2.4, 0.7, 0, Math.PI*2); ctx.fill(); }
    } else if (wid === "dark_bow") {
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.55;
      const dg=ctx.createRadialGradient(0,0,1,0,0,12);
      dg.addColorStop(0,"rgba(180,80,255,0.8)"); dg.addColorStop(1,"rgba(40,0,80,0)");
      ctx.fillStyle=dg; ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill(); ctx.restore();
      ctx.strokeStyle="#220033"; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(-22,0); ctx.lineTo(6,0); ctx.stroke();
      ctx.fillStyle="#9933cc"; ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(1,-3); ctx.lineTo(1,3); ctx.fill();
      ctx.save(); ctx.globalAlpha=0.7; ctx.strokeStyle="#aa44ff"; ctx.lineWidth=1.5;
      for (let k=0;k<3;k++) { const bx=-8-k*4; ctx.beginPath(); ctx.moveTo(bx,0); ctx.lineTo(bx-4,-4); ctx.moveTo(bx,0); ctx.lineTo(bx-4,4); ctx.stroke(); } ctx.restore();
    } else if (wid === "void_bow") {
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
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.8;
      const frg=ctx.createRadialGradient(2,0,2,2,0,18);
      frg.addColorStop(0,"rgba(255,220,100,1)"); frg.addColorStop(0.4,"rgba(255,100,20,0.8)"); frg.addColorStop(1,"rgba(200,40,0,0)");
      ctx.fillStyle=frg; ctx.beginPath(); ctx.arc(2,0,18,0,Math.PI*2); ctx.fill();
      const flk=0.8+0.2*Math.sin(t*25); ctx.globalAlpha=0.5*flk;
      ctx.fillStyle="rgba(255,240,160,0.6)"; ctx.beginPath(); ctx.arc(2,0,10,0,Math.PI*2); ctx.fill(); ctx.restore();
      ctx.strokeStyle="#cc4400"; ctx.lineWidth=3.5;
      ctx.beginPath(); ctx.moveTo(-18,0); ctx.lineTo(5,0); ctx.stroke();
      ctx.fillStyle="#ffaa40"; ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(2,-4); ctx.lineTo(2,4); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.45;
      ctx.strokeStyle="#ff8820"; ctx.lineWidth=1;
      for (let k=0;k<4;k++) { const bx=-5-k*4; const fl=Math.sin(t*20+k)*3; ctx.beginPath(); ctx.moveTo(bx,0); ctx.lineTo(bx-2,-4+fl); ctx.stroke(); } ctx.restore();
    } else if (wid === "crossbow") {
      // Stubby iron-tipped bolt with a faint slipstream
      ctx.save(); ctx.globalAlpha=0.3;
      ctx.strokeStyle="#c8ccd4"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(-16,0); ctx.lineTo(-7,0); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle="#4a3a26"; ctx.lineWidth=2.2;
      ctx.beginPath(); ctx.moveTo(-8,0); ctx.lineTo(4,0); ctx.stroke();
      ctx.fillStyle="#cfd3d9";
      ctx.beginPath(); ctx.moveTo(4,-2.2); ctx.lineTo(9,0); ctx.lineTo(4,2.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle="#8f2a24";
      ctx.beginPath(); ctx.moveTo(-8,0); ctx.lineTo(-11,-2.2); ctx.lineTo(-7,-0.5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-8,0); ctx.lineTo(-11,2.2); ctx.lineTo(-7,0.5); ctx.closePath(); ctx.fill();
    } else {
      // Same arrow the archer nocks: wooden shaft, steel head, fletching
      // colored per bow (green default, crimson for the long bow)
      const fletch = wid === "long_bow" ? "#b04a3a" : "#8fae4a";
      ctx.strokeStyle="#c9b48a"; ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(5,0); ctx.stroke();
      ctx.fillStyle="#b8bcc4";
      ctx.beginPath(); ctx.moveTo(5,-1.6); ctx.lineTo(8.5,0); ctx.lineTo(5,1.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle=fletch;
      ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(-13,-2.6); ctx.lineTo(-8.5,-0.6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(-13,2.6); ctx.lineTo(-8.5,0.6); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

export function drawLootItems() {
  if (!state.lootItems) return;
  const t=performance.now()/1000;
  const view = visibleWorldBounds(120);
  for (const it of state.lootItems) {
    if (it.x < view.left || it.x > view.right) continue;
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
    const spinAng = stillFalling ? (t*8 % (Math.PI*2)) : (-0.1+Math.sin(t*1.2+it.x*0.005)*0.07);
    ctx.save(); ctx.translate(it.x,yy); ctx.rotate(spinAng);
    drawWeaponModel(it.weaponId, 0.66, { glow: stillFalling ? 0.05 : 0.1, upgrades: it.upgrades });
    ctx.restore();
    if (!stillFalling && it.upgrades && it.upgrades.length > 0) {
      ctx.font="bold 9px Trebuchet MS"; ctx.textAlign="center";
      ctx.fillStyle="rgba(0,0,0,0.55)"; ctx.fillText("Lvl "+(1+it.upgrades.length), it.x+1, yy-19);
      ctx.fillStyle=rc; ctx.fillText("Lvl "+(1+it.upgrades.length), it.x, yy-20);
    }
    ctx.restore();
  }
}

export function drawChests() {
  if (!state.chests || !state.chests.length) return;
  const t=performance.now()/1000;
  const { player } = state;
  const view = visibleWorldBounds(140);
  for (const ch of state.chests) {
    if (ch.x < view.left || ch.x > view.right) continue;
    const x=ch.x, bob=Math.sin(t*2+x*0.01)*2.5, yy=groundY-18+bob;
    const near=dist(x,player.x)<64, oa=ch.openAnim||0;
    groundShadow(x,14,0.22);
    ctx.save(); ctx.translate(x,yy);
    if (near && !ch.open) {
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.25+0.12*Math.sin(t*4);
      ctx.fillStyle="#f2c14e"; ctx.beginPath(); ctx.arc(0,0,20,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    const openY = ch.open ? -10*oa : 0;
    ctx.fillStyle=ch.open?"#6a4a22":"#7a5a28"; ctx.fillRect(-14,openY-10,28,20);
    ctx.fillStyle="rgba(255,255,255,0.09)"; ctx.fillRect(-14,openY-10,9,20);
    ctx.fillStyle="rgba(0,0,0,0.22)"; ctx.fillRect(8,openY-10,6,20);
    ctx.fillStyle="#9a8060"; ctx.fillRect(-14,openY-2,28,3); ctx.fillRect(-14,openY+5,28,2);
    ctx.fillStyle="#c0a060"; ctx.beginPath(); ctx.arc(0,openY,3.5,0,Math.PI*2); ctx.fill();
    const lidAngle = ch.open ? -Math.PI*0.55*oa : 0;
    ctx.save(); ctx.translate(0,openY-10); ctx.rotate(lidAngle);
    ctx.fillStyle=ch.open?"#8a6a30":"#9a7a34"; ctx.fillRect(-14,-10,28,10);
    ctx.fillStyle="rgba(255,255,255,0.09)"; ctx.fillRect(-14,-10,9,10);
    ctx.fillStyle="#9a8060"; ctx.fillRect(-14,-2,28,2);
    ctx.restore();
    ctx.restore();
    if (near && !ch.open) {
      ctx.save(); ctx.font="bold 12px Trebuchet MS"; ctx.textAlign="center";
      const py=yy-bob-36, pa=0.7+0.28*Math.sin(t*3);
      ctx.globalAlpha=pa;
      ctx.fillStyle="rgba(0,0,0,0.55)"; ctx.fillText("[F] Open chest",x+1,py+1);
      ctx.fillStyle="#f2c14e"; ctx.fillText("[F] Open chest",x,py);
      ctx.restore();
    }
  }
}

// Shared purchase-feedback visuals for freshly bought station items.
// Returns the drop-in y-offset (item falls and bounces during the first second).
function purchaseFX(item, x, yy, t, color) {
  const age = item.born != null ? t - item.born : 99;
  let dropOff = 0;
  if (age < 1) {
    const p = Math.min(age / 0.45, 1);
    dropOff = -(1 - p) * (1 - p) * 90;                       // fall from above
    if (age > 0.45 && age < 0.75) dropOff = -Math.sin((age - 0.45) / 0.3 * Math.PI) * 10; // bounce
  }
  if (age < 0.9) {
    // expanding flash ring at landing
    const rp = Math.max(0, (age - 0.35) / 0.55);
    if (rp > 0) {
      ctx.save(); ctx.globalAlpha = (1 - rp) * 0.8; ctx.strokeStyle = color; ctx.lineWidth = 3 * (1 - rp) + 1;
      ctx.beginPath(); ctx.arc(x, yy, 10 + rp * 42, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  }
  if (!item.claimed) {
    // vertical beacon so the item is easy to spot
    const pulse = 0.16 + 0.08 * Math.sin(t * 2.4 + x * 0.01);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const g = ctx.createLinearGradient(0, yy - 130, 0, yy);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, color);
    ctx.globalAlpha = pulse; ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 4, yy - 130); ctx.lineTo(x + 4, yy - 130);
    ctx.lineTo(x + 11, yy); ctx.lineTo(x - 11, yy); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  return dropOff;
}

export function drawGroundBows() {
  if (!state.groundBows) return;
  const t=performance.now()/1000;
  const view = visibleWorldBounds(120);
  for (const b of state.groundBows) {
    if (b.x < view.left || b.x > view.right) continue;
    const bob=Math.sin(t*2.2+b.x*0.01)*2.5, yy=groundY-14+bob, alpha=b.claimed?0.35:0.7;
    groundShadow(b.x,8,0.18);
    const dropOff = purchaseFX(b, b.x, yy, t, "#9bd05a");
    ctx.save(); ctx.globalAlpha=alpha; ctx.translate(b.x,yy+dropOff); ctx.rotate(-0.3+Math.sin(t*1.1+b.x*0.005)*0.06);
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
  const view = visibleWorldBounds(120);
  for (const h of state.groundHammers) {
    if (h.x < view.left || h.x > view.right) continue;
    const bob = Math.sin(t*2.2+h.x*0.01)*2.5, yy = groundY-16+bob, alpha = h.claimed ? 0.35 : 0.72;
    groundShadow(h.x, 8, 0.18);
    const dropOff = purchaseFX(h, h.x, yy, t, "#f2a230");
    ctx.save(); ctx.globalAlpha=alpha; ctx.translate(h.x, yy+dropOff); ctx.rotate(0.3+Math.sin(t*1.1+h.x*0.005)*0.06);
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
