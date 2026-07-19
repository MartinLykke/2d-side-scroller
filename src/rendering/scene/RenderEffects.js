import { clamp } from '../../util/math.js';
import { ctx, groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { FX } from '../Effects.js';
import { visibleWorldBounds } from '../Viewport.js';
import { renderBudget } from '../RenderFrame.js';

// Caltrop drawn as a small snap trap: two jagged jaws on a base plate.
// open: 1 = armed/open (jaws lie flat), 0 = snapped shut.
function drawTrapJaws(x, y, open, rot) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);

  // bundplade + fjederled i midten
  ctx.fillStyle = "#3a3a40";
  ctx.beginPath(); ctx.ellipse(0, 0.5, 7.5, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#55555e";
  ctx.fillRect(-1.5, -2, 3, 2.5);

  const jawAngle = 0.12 + open * 1.28; // almost vertical → laid out flat
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 2, -0.5);
    ctx.rotate(s * jawAngle);
    // jaw arc
    ctx.strokeStyle = "#8a8a94"; ctx.lineWidth = 1.8; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-s * 3.2, -5, -s * 1.2, -9);
    ctx.stroke();
    // teeth on the inside of the jaw
    ctx.fillStyle = "#b8b8c2";
    for (let k = 0; k < 3; k++) {
      const p = 0.25 + k * 0.3;
      const tx = -s * 3.2 * 2 * p * (1 - p) - s * 1.2 * p * p;
      const ty = -5 * 2 * p * (1 - p) - 9 * p * p;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - s * 2.4, ty - 1);
      ctx.lineTo(tx - s * 0.4, ty - 2.2);
      ctx.closePath(); ctx.fill();
    }
    ctx.lineCap = "butt";
    ctx.restore();
  }
  ctx.restore();
}

export function drawCaltrops() {
  if (!state.caltrops || !state.caltrops.length) return;
  const T = performance.now() / 1000;
  const view = visibleWorldBounds(80);
  ctx.save();
  for (const c of state.caltrops) {
    if (c.x < view.left || c.x > view.right) continue;
    let open = 1, alpha = 1, y = groundY - 3, rot = 0;

    if (c.state === "fall") {
      // thrown trap spins half-open through the air
      open = 0.4; y = c.y; rot = c.rot;
    } else if (c.state === "snap") {
      // snaps shut in an instant, jolts upward, then fades out
      const shut = Math.min(1, c.snapT / 0.09);
      open = 1 - shut;
      y -= Math.sin(shut * Math.PI) * 2.5;
      alpha = Math.min(1, (1.2 - c.snapT) / 0.45);
    } else {
      // armed: small settle-hop after landing + fade as lifetime runs out
      alpha = Math.min(1, c.life / 2);
      if (c.settle > 0) {
        const b = c.settle / 0.3;
        y -= Math.abs(Math.sin(b * Math.PI * 2)) * b * 2;
        open = 0.4 + (1 - b) * 0.6;
      }
    }

    ctx.globalAlpha = alpha * 0.9;
    drawTrapJaws(c.x, y, open, rot);

    // faint warning glint on the tooth tips while the trap is armed
    if (c.state === "armed" && !(c.settle > 0)) {
      const blink = Math.max(0, Math.sin(T * 3 + c.x * 0.05));
      ctx.globalAlpha = alpha * blink * 0.5;
      ctx.fillStyle = "#e8e8f0";
      ctx.beginPath(); ctx.arc(c.x - 6.5, groundY - 6, 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(c.x + 6.5, groundY - 6, 0.9, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

// Burning magma pools left by the colossus' boulder volleys
export function drawFirePools() {
  if (!state.firePools || !state.firePools.length) return;
  const T = performance.now() / 1000;
  const view = visibleWorldBounds(220);
  for (const p of state.firePools) {
    if (p.x < view.left || p.x > view.right) continue;
    const fade = Math.min(1, p.life / 1.2) * Math.min(1, (p.maxLife - p.life) / 0.3 + 0.2);
    const isVoid = p.kind === "void";
    ctx.save();
    // molten puddle / collapsing void scar
    ctx.globalAlpha = 0.85 * fade;
    const pg = ctx.createRadialGradient(p.x, groundY - 2, 2, p.x, groundY - 2, p.r);
    if (isVoid) {
      pg.addColorStop(0, "rgba(215,246,255,0.9)");
      pg.addColorStop(0.26, "rgba(138,90,255,0.78)");
      pg.addColorStop(0.68, "rgba(30,12,70,0.62)");
      pg.addColorStop(1, "rgba(3,1,12,0)");
    } else {
      pg.addColorStop(0, "rgba(255,214,96,0.95)");
      pg.addColorStop(0.4, "rgba(255,106,32,0.8)");
      pg.addColorStop(0.8, "rgba(150,30,8,0.55)");
      pg.addColorStop(1, "rgba(60,10,4,0)");
    }
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.ellipse(p.x, groundY - 2, p.r, p.r * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    // flickering flame tongues or inward-falling starlight teeth
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 5; k++) {
      const fx = p.x + Math.sin(p.ph + k * 2.4) * p.r * 0.6;
      const fh = (7 + Math.sin(T * (9 + k) + p.ph + k) * 3.5) * fade;
      ctx.globalAlpha = 0.5 * fade;
      ctx.fillStyle = isVoid ? "#8a5aff" : "#ff6a20";
      if (isVoid) {
        const tx = p.x + (fx - p.x) * (0.7 + 0.15 * Math.sin(T * 2 + k));
        ctx.beginPath();
        ctx.moveTo(fx, groundY - 4);
        ctx.lineTo(tx - 3, groundY - 10 - fh);
        ctx.lineTo(tx + 3, groundY - 10 - fh);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.beginPath(); ctx.ellipse(fx, groundY - 4 - fh * 0.5, 3.2, fh, Math.sin(T * 4 + k) * 0.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 0.45 * fade;
      ctx.fillStyle = isVoid ? "#d7f6ff" : "#ffd060";
      ctx.beginPath(); ctx.ellipse(fx, groundY - 3 - fh * 0.35, isVoid ? 1.8 : 1.4, fh * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    // ground glow
    ctx.globalAlpha = 0.3 * fade;
    const glow = ctx.createRadialGradient(p.x, groundY - 6, 4, p.x, groundY - 6, p.r * 1.5);
    glow.addColorStop(0, isVoid ? "rgba(138,90,255,0.72)" : "rgba(255,140,40,0.7)");
    glow.addColorStop(1, isVoid ? "rgba(20,5,60,0)" : "rgba(120,20,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.ellipse(p.x, groundY - 8, p.r * 1.5, p.r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    if (isVoid) {
      ctx.globalAlpha = 0.48 * fade;
      ctx.strokeStyle = "#d7f6ff"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(p.x, groundY - 3, p.r * (0.7 + Math.sin(T * 3 + p.ph) * 0.04), p.r * 0.11, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawSpellFields() {
  if (!state.spellFields || !state.spellFields.length) return;
  const T = performance.now() / 1000;
  const view = visibleWorldBounds(240);
  for (const f of state.spellFields) {
    if (f.x + (f.r || 0) < view.left || f.x - (f.r || 0) > view.right) continue;
    const fade = clamp(f.life / (f.maxLife || 1), 0, 1);
    ctx.save();
    if (f.type === "storm") {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.38 * fade;
      const cloud = ctx.createRadialGradient(f.x, f.y, 8, f.x, f.y, f.r * 0.75);
      cloud.addColorStop(0, "rgba(255,255,255,0.62)");
      cloud.addColorStop(0.32, "rgba(190,190,255,0.42)");
      cloud.addColorStop(1, "rgba(80,70,150,0)");
      ctx.fillStyle = cloud;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * 0.58, 20 + Math.sin(T * 4 + f.ph) * 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = f.col || "#ffffff";
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.55 * fade;
      for (let i = 0; i < 4; i++) {
        const px = f.x + Math.sin(T * 2.7 + f.ph + i * 1.9) * f.r * 0.45;
        ctx.beginPath();
        ctx.moveTo(px, f.y + 6);
        ctx.lineTo(px + Math.sin(T * 8 + i) * 8, f.y + 24);
        ctx.lineTo(px - Math.cos(T * 7 + i) * 6, f.y + 38);
        ctx.stroke();
      }
    } else if (f.type === "rune") {
      const armed = clamp(1 - Math.max(0, f.arm || 0) / 0.34, 0, 1);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = (0.22 + armed * 0.34) * fade;
      const rg = ctx.createRadialGradient(f.x, groundY - 8, 3, f.x, groundY - 8, f.r);
      rg.addColorStop(0, f.col || "#ff88ff");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.ellipse(f.x, groundY - 5, f.r, f.r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = (0.55 + armed * 0.35) * fade;
      ctx.strokeStyle = f.col || "#ff88ff";
      ctx.lineWidth = 1.3 + armed;
      ctx.beginPath(); ctx.ellipse(f.x, groundY - 6, f.r * (0.48 + Math.sin(T * 3 + f.ph) * 0.03), f.r * 0.12, 0, 0, Math.PI * 2); ctx.stroke();
      for (let k = 0; k < 4; k++) {
        const a = T * 0.9 + f.ph + k * Math.PI * 0.5;
        const x1 = f.x + Math.cos(a) * f.r * 0.18;
        const y1 = groundY - 6 + Math.sin(a) * f.r * 0.05;
        const x2 = f.x + Math.cos(a) * f.r * 0.38;
        const y2 = groundY - 6 + Math.sin(a) * f.r * 0.11;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    }
    ctx.restore();
  }
}

export function drawPoisonShots() {
  if (!state.poisonShots || !state.poisonShots.length) return;
  const view = visibleWorldBounds(90);
  for (const s of state.poisonShots) {
    const shotVisible = s.x >= view.left && s.x <= view.right;
    const landVisible = s.landX >= view.left && s.landX <= view.right;
    if (!shotVisible && !landVisible) continue;
    const age = Math.max(0, 1 - s.life / 1.8);
    ctx.save(); ctx.globalAlpha = 0.25 + 0.2 * age;
    ctx.strokeStyle = "#88cc44"; ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.ellipse(s.landX, groundY - 4, 24, 7, 0, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    ctx.save(); ctx.translate(s.x, s.y);
    ctx.fillStyle = "#7744cc";
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI*2); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.55;
    ctx.fillStyle="#aa66ff";
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.fillStyle="#88cc44"; ctx.globalAlpha=0.7;
    ctx.beginPath(); ctx.arc(-2, -2, 3, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

export function drawLegendaryEffects() {
  const view = visibleWorldBounds(260);
  for (let i = state.legendaryEffects.length - 1; i >= 0; i--) {
    const ef = state.legendaryEffects[i];
    if (ef.type !== "ring") continue;
    ef.life -= 1 / 60;
    if (ef.life <= 0) { state.legendaryEffects.splice(i, 1); continue; }
    if (ef.x + (ef.radius || 0) < view.left || ef.x - (ef.radius || 0) > view.right) continue;
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

// Crown Aegis strikes: a crackling golden bolt lashing from the beacon above
// the keep down onto the smitten enemy, with an impact flash and a ground
// ring marking the splash radius. Purely visual — entries expire by age.
export function drawAegisStrikes() {
  const arr = state.aegisStrikes;
  if (!arr || !arr.length) return;
  const now = performance.now() / 1000;
  const view = visibleWorldBounds(280);
  for (let i = arr.length - 1; i >= 0; i--) {
    const s = arr[i];
    const age = now - s.born;
    if (age > s.life) { arr.splice(i, 1); continue; }
    const xMin = Math.min(s.x1, s.x2) - (s.r || 0);
    const xMax = Math.max(s.x1, s.x2) + (s.r || 0);
    if (xMax < view.left || xMin > view.right) continue;
    const k = age / s.life;
    const fade = 1 - k;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    // jagged bolt drawn in three passes: outer glow, gold body, white-hot core
    const segs = 7;
    for (const [w, col, a] of [
      [10, "rgba(255,140,40,1)", 0.3],
      [4.5, "rgba(255,208,96,1)", 0.75],
      [1.8, "rgba(255,246,214,1)", 1],
    ]) {
      ctx.globalAlpha = fade * a;
      ctx.strokeStyle = col;
      ctx.lineWidth = w * (1 - k * 0.55);
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      for (let j = 1; j < segs; j++) {
        const p = j / segs;
        const off = Math.sin(s.seed * 17 + j * 5.3 + k * 7) * 14 * Math.sin(p * Math.PI);
        ctx.lineTo(s.x1 + (s.x2 - s.x1) * p + off, s.y1 + (s.y2 - s.y1) * p);
      }
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    // impact flash blooming out from the strike point
    const fr = 16 + k * 44;
    const ig = ctx.createRadialGradient(s.x2, s.y2, 2, s.x2, s.y2, fr);
    ig.addColorStop(0, `rgba(255,240,190,${0.85 * fade})`);
    ig.addColorStop(0.5, `rgba(255,160,50,${0.4 * fade})`);
    ig.addColorStop(1, "rgba(255,110,20,0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = ig;
    ctx.beginPath(); ctx.arc(s.x2, s.y2, fr, 0, Math.PI * 2); ctx.fill();
    // shock ring expanding to the splash radius on the ground
    ctx.globalAlpha = fade * 0.65;
    ctx.strokeStyle = "#f2c14e";
    ctx.lineWidth = 2.5 * fade + 0.5;
    ctx.beginPath();
    ctx.ellipse(s.x2, groundY - 5, 10 + k * (s.r - 10), (10 + k * (s.r - 10)) * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawParticles(mineLayer = false) {
  const view = visibleWorldBounds(120);
  const particles = state.particles || [];
  const every = Math.max(1, renderBudget().particlesEvery || 1);
  for (let i = 0; i < particles.length; i += every) {
    const p = particles[i];
    if (!!p.mine !== mineLayer) continue;
    if (p.x < view.left || p.x > view.right) continue;
    const alpha = p.fly ? 1 : (p.maxLife ? clamp(p.life / p.maxLife, 0, 1) : clamp(p.life * 1.5, 0, 1));
    ctx.globalAlpha = alpha * (p.alpha ?? 1);
    ctx.fillStyle = p.color;
    if (p.stain && p.settled) {
      ctx.save();
      ctx.globalAlpha *= 0.72;
      ctx.translate(p.x, p.y + (p.stainYOffset || 0));
      ctx.rotate(p.rot || 0);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * (p.sx || 1.9), p.size * (p.sy || 0.45), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (p.streak) {
      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - (p.vx || 0) * 0.035, p.y - (p.vy || 0) * 0.035);
      ctx.stroke();
      ctx.restore();
    } else if (p.rot !== undefined || p.kind === "chunk") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot || 0);
      ctx.fillRect(-p.size * 0.7, -p.size * 0.45, p.size * 1.4, p.size * 0.9);
      ctx.restore();
    } else if (p.shape === "circle") {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.55, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
    }
  }
  ctx.globalAlpha=1;
}

export function drawFloats(mineLayer = false) {
  ctx.textAlign="center";
  let lastSz = 0;
  const view = visibleWorldBounds(180);
  for (const f of state.floatTexts) {
    if (!!f.mine !== mineLayer) continue;
    if (f.x < view.left || f.x > view.right) continue;
    const sz = f.size || 15;
    ctx.globalAlpha=clamp(f.life,0,1);
    if (f.crit) {
      // Pop in oversized during the first 0.2s, then settle and fade while rising
      const pop = 1 + Math.max(0, f.life - (f.maxLife - 0.2)) * 4;
      ctx.font = `italic 900 ${Math.round(sz * pop)}px Georgia, 'Times New Roman', serif`;
      ctx.lineWidth = 4; ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(70,25,0,0.85)";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
      lastSz = 0;
      continue;
    }
    let drawSz = sz;
    if (f.pop && f.maxLife) {
      // brief overshoot each time the text is (re)triggered
      drawSz = Math.round(sz * (1 + Math.max(0, f.life - (f.maxLife - 0.18)) * 2.2));
    }
    if (drawSz !== lastSz) { ctx.font=`bold ${drawSz}px Trebuchet MS`; lastSz = drawSz; }
    ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillText(f.text,f.x+1,f.y+1);
    ctx.fillStyle=f.color; ctx.fillText(f.text,f.x,f.y);
  }
  ctx.globalAlpha=1;
}

export function drawSpells() {
  if (!state.spells || !state.spells.length) return;
  const t = performance.now() / 1000;
  const view = visibleWorldBounds(260);

  for (const sp of state.spells) {
    if (sp.x < view.left || sp.x > view.right) continue;
    ctx.save();
    ctx.translate(sp.x, sp.y);
    const age = sp.age || 0;
    if (sp.upgradeCol) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.22 + Math.min(0.18, (sp.upgradeRank || 1) * 0.04);
      const ug = ctx.createRadialGradient(0, 0, 2, 0, 0, 26 + (sp.upgradeRank || 1) * 7);
      ug.addColorStop(0, sp.upgradeCol);
      ug.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ug;
      ctx.beginPath(); ctx.arc(0, 0, 34 + (sp.upgradeRank || 1) * 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    switch (sp.spellType) {
      case "fireball": {
        const ang = Math.atan2(sp.vy, sp.vx);
        ctx.save(); ctx.rotate(ang);

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.6 * (0.8 + 0.2 * Math.sin(t * 30));
        const fg2 = ctx.createRadialGradient(0, 0, 5, -10, 0, 45);
        fg2.addColorStop(0, "rgba(255,200,80,1)");
        fg2.addColorStop(0.4, "rgba(255,60,0,0.6)");
        fg2.addColorStop(1, "rgba(150,0,0,0)");
        ctx.fillStyle = fg2;
        ctx.beginPath(); ctx.arc(-10, 0, 45, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        ctx.fillStyle = "#ff4400";
        ctx.beginPath();
        ctx.moveTo(15, 0); ctx.lineTo(-25, 12); ctx.lineTo(-40, 0); ctx.lineTo(-25, -12);
        ctx.closePath(); ctx.fill();

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(5, 0, 8, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        ctx.restore();
        break;
      }

      case "meteor": {
        const ang3 = Math.atan2(sp.vy, sp.vx);
        ctx.save();
        ctx.rotate(ang3);

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.9;
        const mtg = ctx.createLinearGradient(-100, 0, 20, 0);
        mtg.addColorStop(0, "rgba(100, 10, 0, 0)");
        mtg.addColorStop(0.4, "rgba(255, 60, 10, 0.6)");
        mtg.addColorStop(0.8, "rgba(255, 180, 50, 0.9)");
        mtg.addColorStop(1, "rgba(255, 255, 180, 1)");

        ctx.fillStyle = mtg;
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-40, 25);
        ctx.lineTo(-100, 5);
        ctx.lineTo(-100, -5);
        ctx.lineTo(-40, -25);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = "#2b170a";
        ctx.beginPath();
        ctx.moveTo(22, 3);
        ctx.lineTo(10, 18);
        ctx.lineTo(-10, 16);
        ctx.lineTo(-24, 6);
        ctx.lineTo(-20, -12);
        ctx.lineTo(-4, -20);
        ctx.lineTo(14, -14);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#170a03";
        ctx.beginPath();
        ctx.moveTo(-5, -5); ctx.lineTo(-20, 2); ctx.lineTo(-10, 12);
        ctx.closePath(); ctx.fill();

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const flicker = Math.abs(Math.sin(t * 40)) * 0.3;
        ctx.globalAlpha = 0.7 + flicker;

        const coreGlow = ctx.createRadialGradient(18, 0, 2, 10, 0, 40);
        coreGlow.addColorStop(0, "rgba(255, 255, 255, 1)");
        coreGlow.addColorStop(0.2, "rgba(255, 200, 50, 0.9)");
        coreGlow.addColorStop(0.6, "rgba(255, 50, 0, 0.4)");
        coreGlow.addColorStop(1, "rgba(200, 0, 0, 0)");

        ctx.fillStyle = coreGlow;
        ctx.beginPath();
        ctx.arc(15, 0, 45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = "#ffcc00";
        for (let i = 0; i < 5; i++) {
            const sparkX = -30 - ((age * 120 + i * 25) % 80);
            const sparkY = Math.sin(t * 15 + i) * 20;
            ctx.beginPath(); ctx.arc(sparkX, sparkY, Math.random() * 2 + 1, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
        break;
      }

      case "waterjet": {
        const ang = Math.atan2(sp.vy, sp.vx);
        ctx.save();
        ctx.rotate(ang);

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.48;
        const wake = ctx.createLinearGradient(-58, 0, 20, 0);
        wake.addColorStop(0, "rgba(38, 148, 210, 0)");
        wake.addColorStop(0.45, "rgba(66, 190, 240, 0.36)");
        wake.addColorStop(1, "rgba(214, 252, 255, 0.92)");
        ctx.fillStyle = wake;
        const wobble = Math.sin(t * 18 + age * 12) * 2;
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.bezierCurveTo(10, -8, -18, -12 + wobble, -52, -5);
        ctx.lineTo(-52, 5);
        ctx.bezierCurveTo(-18, 12 - wobble, 10, 8, 22, 0);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 0.86;
        const core = ctx.createLinearGradient(-42, 0, 18, 0);
        core.addColorStop(0, "rgba(36, 128, 205, 0.05)");
        core.addColorStop(0.45, "rgba(38, 156, 220, 0.72)");
        core.addColorStop(1, "rgba(170, 244, 255, 0.98)");
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.bezierCurveTo(4, -5.5, -20, -7.5, -42, -3.2);
        ctx.lineTo(-42, 3.2);
        ctx.bezierCurveTo(-20, 7.5, 4, 5.5, 18, 0);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(232, 255, 255, 0.82)";
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        for (let wi = 0; wi < 2; wi++) {
          const off = wi ? 3.4 : -2.7;
          ctx.globalAlpha = wi ? 0.55 : 0.72;
          ctx.beginPath();
          ctx.moveTo(-38, off * 0.45);
          ctx.quadraticCurveTo(-16, off + Math.sin(t * 13 + wi) * 1.6, 14, off * 0.2);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = "#efffff";
        ctx.beginPath(); ctx.ellipse(14, 0, 6.5, 3.8, 0, 0, Math.PI * 2); ctx.fill();
        for (let di = 0; di < 6; di++) {
          const dp = (age * 5.4 + di * 0.19) % 1;
          const dx = -18 - dp * 44;
          const dy = Math.sin(t * 9 + di * 1.7) * (3 + di % 2 * 2);
          ctx.globalAlpha = 0.55 * (1 - dp);
          ctx.beginPath(); ctx.arc(dx, dy, 1.3 + (di % 3) * 0.4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();

        ctx.restore();
        break;
      }
      case "arcane": {
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.9;
        const arcg=ctx.createRadialGradient(0,0,2,0,0,25);
        arcg.addColorStop(0,"rgba(255,255,255,1)"); arcg.addColorStop(0.3,"rgba(255,50,255,0.9)"); arcg.addColorStop(1,"rgba(80,0,200,0)");
        ctx.fillStyle=arcg; ctx.beginPath(); ctx.arc(0,0,25,0,Math.PI*2); ctx.fill();

        ctx.globalAlpha=0.7*(0.5+0.5*Math.sin(t*20));
        ctx.strokeStyle="#ff55ff"; ctx.lineWidth=2.5;
        for (let ri=0;ri<4;ri++) {
          const ra=t*8+ri*(Math.PI*2/4);
          ctx.beginPath(); ctx.arc(0,0,16,ra,ra+1.0); ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle="#ffffff"; ctx.beginPath(); ctx.arc(0,0,7,0,Math.PI*2); ctx.fill();
        break;
      }
      case "shadow": {
        ctx.save(); ctx.globalAlpha=0.85;
        const shg=ctx.createRadialGradient(0,0,5,0,0,30);
        shg.addColorStop(0,"rgba(0,0,0,1)"); shg.addColorStop(0.5,"rgba(40,0,60,0.8)"); shg.addColorStop(1,"rgba(10,0,20,0)");
        ctx.fillStyle=shg; ctx.beginPath(); ctx.arc(0,0,30,0,Math.PI*2); ctx.fill(); ctx.restore();

        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.8;
        ctx.strokeStyle="#aa22ff"; ctx.lineWidth=3;
        for (let ci=0;ci<4;ci++) {
          const ca=-t*6+ci*(Math.PI*2/4);
          const cx2=Math.cos(ca)*22, cy2=Math.sin(ca)*22;
          const mx=Math.cos(ca+0.6)*12, my=Math.sin(ca+0.6)*12;
          ctx.beginPath(); ctx.moveTo(mx,my); ctx.quadraticCurveTo(cx2*0.8,cy2*0.8,cx2,cy2); ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle="#aa22ff"; ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill();
        break;
      }
      case "void": {
        ctx.save(); ctx.globalAlpha=0.95;
        const vbg=ctx.createRadialGradient(0,0,2,0,0,35);
        vbg.addColorStop(0,"rgba(0,0,0,1)"); vbg.addColorStop(0.4,"rgba(15,0,30,0.9)"); vbg.addColorStop(1,"rgba(40,0,80,0)");
        ctx.fillStyle=vbg; ctx.beginPath(); ctx.arc(0,0,35,0,Math.PI*2); ctx.fill(); ctx.restore();

        ctx.save(); ctx.globalCompositeOperation="lighter";
        for (let ri=0;ri<4;ri++) {
          const rp=((age*2.5 + ri*0.25)%1);
          const rr=30*(1-rp), ra=0.8*(1-rp);
          ctx.globalAlpha=ra; ctx.strokeStyle=ri%2===0?"#ff44ff":"#8822ff";
          ctx.lineWidth=2+ri;
          ctx.beginPath(); ctx.arc(0,0,rr,0,Math.PI*2); ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle="#ffffff"; ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill();
        break;
      }
      default: {
        ctx.fillStyle=sp.col||"#ffffff"; ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill(); break;
      }
    }
    ctx.restore();
  }
}

export function drawCampLight(dark) {
  const { base } = state;
  const view = visibleWorldBounds(280);
  for (const s of FX.smoke) {
    if (s.x < view.left || s.x > view.right) continue;
    const k=s.t/s.life; ctx.globalAlpha=(1-k)*0.16; ctx.fillStyle="rgba(58,54,58,1)"; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
  const warm=Math.max(dark,Game.isNight?0.55:0)*0.95;
  if (warm>0.05 && base && base.x >= view.left && base.x <= view.right) {
    ctx.save(); ctx.globalCompositeOperation="lighter";
    const fl=FX.flicker, R=240*fl;
    const g=ctx.createRadialGradient(base.x,groundY-30,10,base.x,groundY-30,R);
    g.addColorStop(0,`rgba(255,172,72,${0.34*warm*fl})`); g.addColorStop(1,"rgba(255,120,40,0)");
    ctx.fillStyle=g; ctx.fillRect(base.x-R,groundY-30-R,R*2,R*2); ctx.restore();
  }
  ctx.save(); ctx.globalCompositeOperation="lighter";
  for (const e of FX.embers) {
    if (e.x < view.left || e.x > view.right) continue;
    const k=e.t/e.life; ctx.globalAlpha=1-k; ctx.fillStyle=`rgba(255,${(170-90*k)|0},60,1)`; ctx.fillRect(e.x,e.y,e.s,e.s);
  }
  ctx.restore(); ctx.globalAlpha=1;
}
