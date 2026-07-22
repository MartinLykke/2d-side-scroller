// Phase 2 ("the Hollow") enemy sprites: shade, void wraith, hollow brute and
// the void titan boss. All draw in entity-local space: origin at the enemy's
// x with the ground at groundY, facing +x (drawEnemies mirrors for dir < 0).
// Death ragdoll rotation and fy translation are applied by the caller.
import { ctx, groundY } from '../../core/canvas.js';
import { wallHeight } from '../../entities/Wall.js';

const TAU = Math.PI * 2;
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const mix = (a, b, u) => a + (b - a) * u;
const smooth = v => { v = clamp01(v); return v * v * (3 - 2 * v); };

// Shared palette: cold void stone lit from within by starlight
const VOID = {
  dk: "#120a24",
  body: "#241a38",
  mid: "#3a2a5c",
  hi: "#5a4788",
  cyan: "#8fe8ff",
  violet: "#b9a0ff",
  deep: "#8a5aff",
};

function col(flash, c) { return flash ? "#fff" : c; }

function contactShadow(r, alpha = 0.2) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#060310";
  ctx.beginPath(); ctx.ellipse(0, groundY - 1, r, r * 0.24, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

// Slow star-motes drifting up off the body — the Hollow's equivalent of embers.
function voidMotes(T, x0, y0, n, rise, spread, seed = 0) {
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < n; k++) {
    const wt = (T * 0.4 + k * 0.37 + seed) % 1;
    const mx = x0 + Math.sin((T + k * 2.1 + seed) * 1.3) * spread;
    const my = y0 - wt * rise;
    ctx.globalAlpha = (1 - wt) * 0.55;
    ctx.fillStyle = k % 2 ? VOID.cyan : VOID.violet;
    ctx.beginPath(); ctx.arc(mx, my, 1.1 * (1 - wt) + 0.4, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────
// Shade: a thin, hunched thing of black smoke and flickering solid darkness.
// Long claw arms nearly scrape the ground; a smooth faceless head with two
// narrow eyes and a jagged glowing "mouth" crack that opens on attacks. Two
// readable states — solid (sharp, clawed) and shifted (transparent, smeary
// with smoke). It reads e.voidShift / e.shiftWarn / e.lungeP / e.shadeStuck.
// ─────────────────────────────────────────────────────────────────────────
export function drawShade(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;

  // ── state: solid vs void-shifted (with a pre-shift flicker warning) ──
  const shifted = (e.voidShift || 0) > 0 && !e.dying;
  const warn = (e.shiftWarn || 0) > 0 && !e.dying;
  const flicker = warn ? (Math.sin(T * 34) > 0 ? 0.5 : 1) : 1;
  const solidity = shifted ? 0.32 : 1;                 // how corporeal it looks
  const bodyAlpha = clamp01(solidity * flicker);

  const body = col(flash, VOID.body);
  const bodyDk = col(flash, VOID.dk);
  const bodyMid = col(flash, VOID.mid);

  // ── attack / lunge posing ──
  const lungeP = clamp01(e.lungeP ?? -1) >= 0 ? clamp01(e.lungeP) : -1;
  const swingRemain = Math.max(0, e.attackAnim || 0);
  const p = swingRemain > 0 ? 1 - Math.min(1, swingRemain / 0.25) : -1;
  const stuck = (e.shadeStuck || 0) > 0 && !e.dying;
  const attacking = p >= 0 || lungeP >= 0;
  const lunge = lungeP >= 0 ? Math.sin(lungeP * Math.PI) * 12 : (p >= 0 ? Math.sin(clamp01(p * 1.4) * Math.PI) * 6 : 0);
  const crouch = lungeP >= 0 && lungeP < 0.25 ? (0.25 - lungeP) * 20 : 0;

  const drift = Math.sin(T * 2.2 + e.x * 0.13);
  const hover = drift * 1.6 + 1.5;         // glides a touch above the ground
  const gait = Math.sin(e.anim * 2.4);
  const y = groundY - 4 + hover;

  contactShadow(11, 0.12 * solidity);

  ctx.save();
  ctx.globalAlpha = bodyAlpha;
  ctx.translate(lunge, crouch);

  // when shifted, a blurry smear halo behind the body sells the incorporeal look
  if (shifted) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.14;
    const sg = ctx.createRadialGradient(0, y - 16, 2, 0, y - 16, 20);
    sg.addColorStop(0, "rgba(100,80,150,0.6)"); sg.addColorStop(1, "rgba(20,10,40,0)");
    ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(0, y - 16, 18, 22, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // torn shadow-cloak: overlapping streamers dissolving into drifting particles
  for (let k = 0; k < 4; k++) {
    const back = -(4 + k * 4);
    const sway = Math.sin(T * 3 + k * 1.7) * 2.4 + gait * (1.4 + k * 0.5) + (shifted ? Math.sin(T * 6 + k) * 3 : 0);
    ctx.fillStyle = k % 2 ? bodyDk : body;
    ctx.globalAlpha = bodyAlpha * (shifted ? 0.6 : 1);
    ctx.beginPath();
    ctx.moveTo(3, y - 18);
    ctx.quadraticCurveTo(back * 0.4, y - 10 + k, back + sway, y + 2 - k * 1.2);
    ctx.quadraticCurveTo(back * 0.5 + 3, y - 6, 5 - k, y - 14);
    ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = bodyAlpha;

  // feet fade into smoke rather than clear toes
  ctx.save(); ctx.globalAlpha = bodyAlpha * 0.5;
  ctx.fillStyle = bodyDk;
  for (let k = 0; k < 3; k++) {
    const fx = -3 + k * 3 + Math.sin(T * 4 + k) * 1.2;
    ctx.beginPath(); ctx.ellipse(fx, y - 1, 2.2, 1.3, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();

  // hunched thin torso
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-5, y - 8);
  ctx.quadraticCurveTo(-7, y - 22, 0, y - 27);
  ctx.quadraticCurveTo(7, y - 24, 6, y - 12);
  ctx.quadraticCurveTo(2, y - 4, -5, y - 8);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = bodyMid;
  ctx.beginPath(); ctx.ellipse(1.5, y - 16, 3, 6, -0.2, 0, TAU); ctx.fill();

  // smooth faceless head
  const hx = 4, hy = y - 29;
  ctx.fillStyle = shifted ? bodyDk : body;
  ctx.beginPath(); ctx.ellipse(hx, hy, 5.2, 6, -0.1, 0, TAU); ctx.fill();
  // two narrow glowing eyes
  const eyeGlow = (shifted ? 0.9 : 0.6) + 0.3 * dark + (attacking ? 0.35 : 0) + Math.sin(T * 5 + e.x) * 0.08;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = clamp01(eyeGlow) * (warn ? flicker : 1);
  ctx.fillStyle = t.eye;
  ctx.beginPath();
  ctx.ellipse(hx + 0.5, hy - 0.6, 1.9, 0.85, -0.3, 0, TAU);
  ctx.ellipse(hx + 4.5, hy - 1, 1.6, 0.8, -0.3, 0, TAU);
  ctx.fill();
  ctx.restore();
  // jagged glowing mouth-crack opening when it attacks
  const maw = attacking ? Math.sin(clamp01((lungeP >= 0 ? lungeP : p) * 1.3) * Math.PI) : 0;
  if (maw > 0.05) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = maw * 0.9;
    ctx.strokeStyle = t.eye; ctx.lineWidth = 1 + maw * 1.2; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(hx - 3, hy + 2.4);
    ctx.lineTo(hx - 1, hy + 3 + maw * 1.5);
    ctx.lineTo(hx + 1.5, hy + 2.2);
    ctx.lineTo(hx + 3.5, hy + 3.2 + maw);
    ctx.lineTo(hx + 5, hy + 2.4);
    ctx.stroke();
    ctx.restore();
  }

  // long raking claw arms (crisp when solid, faint when shifted)
  ctx.strokeStyle = body; ctx.lineWidth = 2.2; ctx.lineCap = "round";
  ctx.globalAlpha = bodyAlpha * (shifted ? 0.55 : 1);
  if (attacking && !shifted) {
    // both claws stretch and rake forward through the target with a cyan smear
    const pr = lungeP >= 0 ? lungeP : p;
    const sw = Math.sin(clamp01(pr * 1.3) * Math.PI);
    const a = -1.9 + pr * 2.7;
    const reach = 14 + (lungeP >= 0 ? 4 : 0);           // arms stretch on the strike
    const rx = 4 + Math.cos(a) * reach, ry = y - 18 + Math.sin(a) * reach;
    ctx.beginPath(); ctx.moveTo(3, y - 19); ctx.lineTo(rx, ry); ctx.stroke();
    ctx.strokeStyle = bodyDk; ctx.lineWidth = 1.1;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath(); ctx.moveTo(rx, ry);
      ctx.lineTo(rx + Math.cos(a + 0.9 + k * 0.3) * 5, ry + Math.sin(a + 0.9 + k * 0.3) * 5);
      ctx.stroke();
    }
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = sw * 0.7;
    ctx.strokeStyle = VOID.cyan; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(3, y - 18, reach + 1, -2.1, 0.7); ctx.stroke();
    ctx.restore();
  } else {
    const dangle = Math.sin(e.anim * 2.4) * 1.6 + drift * 0.8 + (stuck ? 3 : 0);
    ctx.beginPath(); ctx.moveTo(3, y - 19); ctx.quadraticCurveTo(9, y - 12, 11 + dangle, y - 3); ctx.stroke();
    ctx.strokeStyle = bodyDk; ctx.lineWidth = 1.1;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.moveTo(11 + dangle, y - 3);
      ctx.lineTo(12.5 + dangle + k * 0.6, y + 0.6 + k * 0.8); ctx.stroke();
    }
    ctx.strokeStyle = col(flash, VOID.mid); ctx.lineWidth = 1.9;
    ctx.beginPath(); ctx.moveTo(-3, y - 17); ctx.quadraticCurveTo(-8, y - 11, -8 - dangle, y - 4); ctx.stroke();
  }
  ctx.lineCap = "butt";
  ctx.globalAlpha = bodyAlpha;

  // extra smoke streaks while shifted
  if (shifted) {
    ctx.save(); ctx.globalAlpha = 0.4;
    ctx.strokeStyle = bodyMid; ctx.lineWidth = 1.4; ctx.lineCap = "round";
    for (let k = 0; k < 3; k++) {
      const o = Math.sin(T * 3 + k * 2) * 4;
      ctx.beginPath(); ctx.moveTo(-4 + k * 4, y - 6); ctx.quadraticCurveTo(-8 + k * 4 + o, y - 16, -6 + k * 4 + o, y - 26); ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.restore();
  }

  voidMotes(T, -2, y - 12, shifted ? 5 : 3, 26, shifted ? 7 : 4, e.x * 0.01);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────
// Void Wrath: a legless caster floating on a twisting tail of smoke, its thin
// skeletal torso ringed by cracked armour shards that orbit without touching.
// A broken helm hides all but one bright eye; two long arms cup a void sphere
// before it casts, and two tears in space flex like wings behind its shoulders.
// Reads e.attackAnim (Void Bolt), e.rainChannel, e.callFlash, e.riftShield(+Max).
// ─────────────────────────────────────────────────────────────────────────
export function drawVoidWraith(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const body = col(flash, VOID.body);
  const bodyDk = col(flash, VOID.dk);
  const bodyMid = col(flash, VOID.mid);
  const ink = col(flash, "#0b0620");

  const castRemain = Math.max(0, e.attackAnim || 0);
  const cast = castRemain > 0 ? 1 - Math.min(1, castRemain / 0.38) : -1;
  const rain = clamp01(e.rainChannel || 0);            // Void Rain: arms raised overhead
  const callF = clamp01(e.callFlash || 0);             // Call of the Void: outward pulse
  const bob = Math.sin(T * 2.1 + e.x * 0.07) * 2.2;
  const y = groundY - 22 + bob;
  const gather = Math.max(cast >= 0 ? Math.sin(clamp01(cast * 1.25) * Math.PI) : 0, rain);

  // ── space-tear "wings": two rifts that stretch and contract behind it ──
  const flex = 0.7 + 0.3 * Math.sin(e.anim * 2.2);
  for (const side of [-1, 1]) {
    const rx = side * 9, ry = y - 20;
    const rw = 4 + flex * 3, rh = 15 + flex * 7 + rain * 6;
    ctx.save();
    ctx.translate(rx, ry); ctx.rotate(side * 0.3);
    // the tear itself — a black lens
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.ellipse(0, 0, rw, rh, 0, 0, TAU); ctx.fill();
    // pale violet/white rim
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.4 + 0.25 * flex;
    ctx.strokeStyle = VOID.violet; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(0, 0, rw, rh, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = "#d7f6ff"; ctx.lineWidth = 0.6; ctx.globalAlpha *= 0.7;
    ctx.beginPath(); ctx.ellipse(0, 0, rw * 0.6, rh * 0.8, 0, 0, TAU); ctx.stroke();
    ctx.restore();
    // debris pulled toward the rift before vanishing
    ctx.fillStyle = bodyMid;
    for (let k = 0; k < 3; k++) {
      const wt = (T * 0.8 + k * 0.33 + side) % 1;
      const dx2 = side * (14 - wt * 14), dy2 = -8 + k * 6 - wt * 4;
      ctx.globalAlpha = (1 - wt) * 0.5;
      ctx.beginPath(); ctx.arc(dx2, dy2, 1.1 * (1 - wt) + 0.4, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── smoke tail below the waist (no legs) ──
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-5, y - 6);
  ctx.quadraticCurveTo(-7 + Math.sin(T * 3.1) * 3, y + 6, -2 + Math.sin(T * 2.4) * 4, y + 18);
  ctx.quadraticCurveTo(0, y + 24, 2 + Math.sin(T * 2.7 + 1) * 4, y + 16);
  ctx.quadraticCurveTo(6 + Math.sin(T * 3.3) * 3, y + 5, 5, y - 6);
  ctx.closePath(); ctx.fill();
  ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = bodyDk;
  for (let k = 0; k < 3; k++) {
    const wt = (T * 0.5 + k * 0.34) % 1;
    ctx.beginPath(); ctx.arc(Math.sin(T * 2 + k) * 4, y + 18 + wt * 12, 2.4 * (1 - wt) + 0.6, 0, TAU); ctx.fill();
  }
  ctx.restore();

  // ── thin skeletal torso ──
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-5, y - 6);
  ctx.quadraticCurveTo(-7, y - 20, 0, y - 25);
  ctx.quadraticCurveTo(7, y - 20, 5, y - 6);
  ctx.quadraticCurveTo(0, y - 2, -5, y - 6);
  ctx.closePath(); ctx.fill();
  // rib hint
  ctx.strokeStyle = bodyDk; ctx.lineWidth = 0.9;
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-3.5, y - 9 - k * 4); ctx.lineTo(3.5, y - 9 - k * 4); ctx.stroke(); }

  // ── orbiting cracked armour shards (do not touch the body) ──
  ctx.fillStyle = bodyMid;
  for (let k = 0; k < 4; k++) {
    const a = T * (0.5 + k * 0.05) + k * (TAU / 4);
    const ox = Math.cos(a) * (13 + (k % 2) * 3), oy = y - 15 + Math.sin(a) * (10 + (k % 2) * 2);
    const sr = 3 + (k % 2);
    ctx.save(); ctx.translate(ox, oy); ctx.rotate(a * 1.3);
    ctx.fillStyle = k % 2 ? bodyDk : bodyMid;
    ctx.beginPath(); ctx.moveTo(-sr, sr * 0.7); ctx.lineTo(0, -sr); ctx.lineTo(sr, sr * 0.8); ctx.lineTo(sr * 0.3, sr * 0.9); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.4;
    ctx.strokeStyle = VOID.violet; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(-sr, sr * 0.7); ctx.lineTo(0, -sr); ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  // ── broken helm: an empty black hollow with one bright eye ──
  const hx = 2, hy = y - 29;
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(hx - 6, hy + 4);
  ctx.quadraticCurveTo(hx - 6.5, hy - 7, hx + 1, hy - 8);
  ctx.quadraticCurveTo(hx + 8, hy - 6.5, hx + 6.5, hy + 3.5);
  ctx.quadraticCurveTo(hx + 1, hy + 6, hx - 6, hy + 4);
  ctx.closePath(); ctx.fill();
  // chipped crown of the broken helmet
  ctx.strokeStyle = bodyMid; ctx.lineWidth = 1.2; ctx.lineJoin = "miter";
  ctx.beginPath();
  ctx.moveTo(hx - 5, hy - 4); ctx.lineTo(hx - 3.5, hy - 8); ctx.lineTo(hx - 1.5, hy - 5);
  ctx.lineTo(hx + 1, hy - 8.5); ctx.lineTo(hx + 3, hy - 5.5); ctx.lineTo(hx + 5.5, hy - 7);
  ctx.stroke();
  // single bright eye (with a faint cluster of sparks around it)
  const eyeGlow = 0.7 + 0.3 * dark + (cast >= 0 ? 0.3 : 0) + rain * 0.3;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = clamp01(eyeGlow);
  const eg = ctx.createRadialGradient(hx + 2, hy - 1, 0.5, hx + 2, hy - 1, 5);
  eg.addColorStop(0, "rgba(230,248,255,1)"); eg.addColorStop(0.5, "rgba(150,110,255,0.6)"); eg.addColorStop(1, "rgba(40,20,110,0)");
  ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(hx + 2, hy - 1, 5, 0, TAU); ctx.fill();
  ctx.fillStyle = "#eaf6ff"; ctx.beginPath(); ctx.arc(hx + 2, hy - 1, 1.5, 0, TAU); ctx.fill();
  ctx.fillStyle = t.eye;
  for (let k = 0; k < 3; k++) { const a = T * 2 + k * 2.1; ctx.globalAlpha = clamp01(eyeGlow) * 0.5; ctx.beginPath(); ctx.arc(hx + 2 + Math.cos(a) * 3, hy - 1 + Math.sin(a) * 2, 0.7, 0, TAU); ctx.fill(); }
  ctx.restore();

  // ── arms: long, pointed fingers; cup a void sphere before a cast ──
  ctx.strokeStyle = bodyMid; ctx.lineWidth = 2; ctx.lineCap = "round";
  if (rain > 0.02) {
    // Void Rain: both arms thrust overhead around a growing sphere
    const handY = y - 34 - rain * 4;
    ctx.beginPath(); ctx.moveTo(2, y - 20); ctx.quadraticCurveTo(5, y - 30, 3, handY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2, y - 20); ctx.quadraticCurveTo(-5, y - 30, -1, handY); ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5 + rain * 0.5;
    const g = ctx.createRadialGradient(1, handY - 2, 0.5, 1, handY - 2, 6 + rain * 8);
    g.addColorStop(0, "rgba(230,248,255,0.95)"); g.addColorStop(0.4, "rgba(150,110,255,0.6)"); g.addColorStop(1, "rgba(60,30,140,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(1, handY - 2, 6 + rain * 8, 0, TAU); ctx.fill();
    ctx.restore();
  } else if (cast >= 0) {
    const reach = gather;
    const handX = 8 + reach * 5, handY = y - 16 - reach * 2;
    ctx.beginPath(); ctx.moveTo(2, y - 19); ctx.quadraticCurveTo(6, y - 20, handX, handY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y - 17); ctx.quadraticCurveTo(5, y - 15, handX - 1.5, handY + 3); ctx.stroke();
    // pointed fingers
    ctx.lineWidth = 1;
    for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(handX, handY + 1); ctx.lineTo(handX + 3 + k, handY + 1 + k * 1.6); ctx.stroke(); }
    ctx.lineWidth = 2;
    // void sphere condensing between the palms — black core, pale rim
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5 + reach * 0.5;
    const g = ctx.createRadialGradient(handX + 3, handY + 1.5, 0.5, handX + 3, handY + 1.5, 7 + reach * 4);
    g.addColorStop(0, "rgba(20,10,40,0.9)"); g.addColorStop(0.4, "rgba(150,110,255,0.7)"); g.addColorStop(1, "rgba(60,30,140,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(handX + 3, handY + 1.5, 7 + reach * 4, 0, TAU); ctx.fill();
    ctx.restore();
  } else {
    const sway = Math.sin(T * 2.4) * 1.2;
    ctx.beginPath(); ctx.moveTo(2, y - 19); ctx.quadraticCurveTo(8, y - 14, 6 + sway, y - 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2, y - 18); ctx.quadraticCurveTo(-8, y - 13, -6 - sway, y - 5); ctx.stroke();
  }
  ctx.lineCap = "butt";

  // ── Rift Shield: a rotating ring of broken space with cracks per block used ──
  if ((e.riftShield || 0) > 0) {
    const maxB = e.riftShieldMax || t.riftShieldBlocks || 4;
    const used = clamp01((maxB - e.riftShield) / maxB);
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5 + 0.2 * Math.sin(T * 6);
    ctx.strokeStyle = "#b9a0ff"; ctx.lineWidth = 2;
    for (let k = 0; k < 8; k++) {
      const a0 = k * TAU / 8 + T * 0.8;
      // segments "crack" (go dim/short) as blocks are consumed
      const broken = k / 8 < used;
      ctx.globalAlpha = broken ? 0.12 : 0.5 + 0.2 * Math.sin(T * 6 + k);
      ctx.beginPath(); ctx.arc(1, y - 15, 20, a0, a0 + 0.55); ctx.stroke();
    }
    ctx.restore();
  }

  // ── Call of the Void: an expanding pulse ring ──
  if (callF > 0.02) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = callF * 0.7;
    ctx.strokeStyle = "#d7f6ff"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(1, y - 15, (1 - callF) * 60 + 8, 0, TAU); ctx.stroke();
    ctx.strokeStyle = VOID.violet; ctx.lineWidth = 1.4; ctx.globalAlpha = callF * 0.5;
    ctx.beginPath(); ctx.arc(1, y - 15, (1 - callF) * 44 + 6, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  voidMotes(T, 0, y - 8, 4, 30, 6, e.x * 0.02);
}

// ─────────────────────────────────────────────────────────────────────────
// Hollow brute: the ember brute's silhouette carved from void stone —
// crystal shards for horns, a caged star for a heart, cyan charge trail.
// Reads the same charger/stomper fields the AI animates.
// ─────────────────────────────────────────────────────────────────────────
export function drawVoidBrute(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const bob = Math.abs(Math.sin(e.anim * 0.9)) * 2;
  const y = groundY - bob;
  const body = col(flash, VOID.body);
  const bodyDk = col(flash, VOID.dk);
  const bodyMid = col(flash, VOID.mid);
  const charging = !!e.charging;
  const chargeFlash = Math.max(0, e.chargeFlash || 0);
  const stompFlash = Math.max(0, e.stompFlash || 0);
  const swingDur = 0.62;
  const swingRemain = Math.max(0, e.attackAnim || 0);
  const swingT = charging ? Math.min((e.chargeT || 0) * 1.1, 1) : (swingRemain > 0 ? 1 - Math.min(1, swingRemain / swingDur) : -1);
  const lunge = charging ? 6 : (swingRemain > 0 ? Math.sin(Math.min(swingT * 1.3, 1) * Math.PI) * 5 : 0);
  const lean = charging ? 0.28 : 0;

  const SCALE = 2.5;
  ctx.save();
  ctx.translate(0, groundY); ctx.scale(SCALE, SCALE); ctx.translate(0, -groundY);

  // shockwave ring when a stomp lands
  if (stompFlash > 0) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = stompFlash / 0.35;
    ctx.strokeStyle = VOID.cyan; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, groundY - 2, 30 * (1.4 - stompFlash), 9, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  // charge windup aura
  if (chargeFlash > 0 || charging) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = charging ? 0.45 : chargeFlash / 0.3 * 0.45;
    const aura = ctx.createRadialGradient(0, y - 18, 2, 0, y - 18, 26);
    aura.addColorStop(0, "rgba(150,110,255,0.7)");
    aura.addColorStop(1, "rgba(30,10,80,0)");
    ctx.fillStyle = aura; ctx.beginPath(); ctx.ellipse(0, y - 18, 22, 26, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  voidMotes(T, -2, y - 8, 5, 34, 8, e.x * 0.03);

  // stubby stone legs, wide stance
  const s = Math.sin(e.anim * 1.3);
  ctx.strokeStyle = body; ctx.lineWidth = 3.4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-6, groundY - 12 - bob); ctx.lineTo(-9 + s * 3, groundY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, groundY - 12 - bob); ctx.lineTo(9 - s * 3, groundY); ctx.stroke();
  ctx.lineCap = "butt";

  ctx.save();
  ctx.translate(lunge, 0);
  ctx.rotate(lean);

  // hunched slab torso
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, y - 17, 12, 13, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = bodyMid;
  ctx.beginPath(); ctx.ellipse(1, y - 15, 6.5, 8.5, -0.15, 0, TAU); ctx.fill();

  // crystal shards jutting from the back and shoulders
  ctx.fillStyle = bodyDk;
  for (const [sx, sy, h, w2] of [[-9, y - 22, 9, 3], [-5, y - 27, 12, 3.4], [0, y - 29, 8, 2.6]]) {
    ctx.beginPath(); ctx.moveTo(sx - w2, sy); ctx.lineTo(sx - w2 * 0.2, sy - h); ctx.lineTo(sx + w2, sy + 1); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.4 + 0.2 * Math.sin(T * 3 + sx);
    ctx.strokeStyle = VOID.violet; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(sx - w2, sy); ctx.lineTo(sx - w2 * 0.2, sy - h); ctx.stroke();
    ctx.restore();
  }

  // caged star burning in the chest — flares on attacks and stomps
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = clamp01(0.55 + 0.25 * Math.sin(T * 3 + e.x) + atkF * 0.3 + stompFlash);
  ctx.fillStyle = VOID.cyan;
  ctx.beginPath(); ctx.arc(1, y - 15, 3.4, 0, TAU); ctx.fill();
  ctx.globalAlpha *= 0.5;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(1, y - 15, 1.4, 0, TAU); ctx.fill();
  ctx.restore();

  // glowing fracture lines across the stone
  ctx.strokeStyle = "rgba(150,110,255,0.45)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-6, y - 12); ctx.lineTo(-2, y - 18); ctx.lineTo(-5, y - 24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, y - 10); ctx.lineTo(3, y - 16); ctx.lineTo(7, y - 21); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.4 + 0.25 * Math.sin(T * 5 + e.x);
  ctx.strokeStyle = VOID.deep; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(-6, y - 12); ctx.lineTo(-2, y - 18); ctx.lineTo(-5, y - 24); ctx.stroke();
  ctx.restore();

  // heavy-browed head with shard horns
  const hx = 5, hy = y - 28;
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(hx, hy, 9.5, 0, TAU); ctx.fill();
  ctx.fillStyle = bodyDk;
  ctx.beginPath(); ctx.moveTo(hx - 7, hy - 3.5); ctx.lineTo(hx + 8.5, hy - 6); ctx.lineTo(hx + 7, hy - 0.5); ctx.lineTo(hx - 7, hy + 1); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(hx - 3, hy - 7); ctx.lineTo(hx - 1.5, hy - 15); ctx.lineTo(hx + 1.5, hy - 7); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(hx + 5.5, hy - 7); ctx.lineTo(hx + 8, hy - 14); ctx.lineTo(hx + 9.5, hy - 5.5); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5;
  ctx.fillStyle = VOID.violet;
  ctx.beginPath(); ctx.arc(hx - 1.5, hy - 14.5, 1, 0, TAU); ctx.arc(hx + 8, hy - 13.5, 0.9, 0, TAU); ctx.fill();
  ctx.restore();

  // eyes: a single wide starlit visor slit that narrows when it winds up
  const eyeGlow = clamp01(0.6 + 0.25 * dark + Math.max(0, swingT) * 0.3 + (charging ? 0.25 : 0));
  const squint = swingT >= 0 || charging ? 0.7 : 1.1;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = eyeGlow;
  ctx.fillStyle = t.eye;
  ctx.beginPath(); ctx.ellipse(hx + 4.5, hy - 1, 4.6, squint, -0.06, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = bodyDk;
  ctx.beginPath(); ctx.arc(hx + 5.4, hy - 1, 0.9, 0, TAU); ctx.fill();

  // huge slamming fists — mirrors the ember brute's double-hammer swing
  const shoLX = -4, shoRX = 4, shoY = y - 20;
  ctx.strokeStyle = body; ctx.lineWidth = 3.4; ctx.lineCap = "round";
  if (swingT >= 0) {
    const p = Math.min(swingT * 1.4, 1);
    const swing = Math.sin(p * Math.PI);
    const aR = -2.7 + p * 3.6;
    const rx = shoRX + Math.cos(aR) * 15, ry = shoY + Math.sin(aR) * 15;
    ctx.beginPath(); ctx.moveTo(shoRX, shoY); ctx.lineTo(rx, ry); ctx.stroke();
    ctx.fillStyle = bodyDk; ctx.beginPath(); ctx.arc(rx, ry, 3.6, 0, TAU); ctx.fill();
    const aL = Math.PI + 2.7 - p * 3.6;
    const lx = shoLX + Math.cos(aL) * 13, ly = shoY + Math.sin(aL) * 13;
    ctx.beginPath(); ctx.moveTo(shoLX, shoY); ctx.lineTo(lx, ly); ctx.stroke();
    ctx.fillStyle = bodyDk; ctx.beginPath(); ctx.arc(lx, ly, 3.2, 0, TAU); ctx.fill();
    // cold light smear trailing the swing
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = swing * 0.7;
    ctx.strokeStyle = VOID.cyan; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(shoRX, shoY, 16, -2.8, 0.9); ctx.stroke();
    ctx.globalAlpha = swing * 0.35; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(shoRX, shoY, 20, -2.6, 0.7); ctx.stroke();
    ctx.restore();
  } else {
    const dangle = Math.sin(e.anim * 2) * 2;
    ctx.beginPath(); ctx.moveTo(shoRX, shoY); ctx.lineTo(shoRX + 6 + dangle, shoY + 10); ctx.stroke();
    ctx.fillStyle = bodyDk; ctx.beginPath(); ctx.arc(shoRX + 6 + dangle, shoY + 10, 3.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(shoLX, shoY); ctx.lineTo(shoLX - 6 - dangle, shoY + 10); ctx.stroke();
    ctx.fillStyle = bodyDk; ctx.beginPath(); ctx.arc(shoLX - 6 - dangle, shoY + 10, 3.2, 0, TAU); ctx.fill();
  }
  ctx.lineCap = "butt";
  ctx.restore();
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────
// Void titan: a shattered colossus whose slabs float apart on seams of
// starlight. Runs on the golem AI, so it reads the same animation fields
// (walk phase, slam windup/impact, core open/flare, wall ram/crush leans).
// ─────────────────────────────────────────────────────────────────────────
export function drawVoidTitan(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const w = t.w;
  const flash = e.flash > 0 && !e.dying;
  const stone = col(flash, "#100b20");
  const stone2 = col(flash, "#221a3c");
  const stone3 = col(flash, "#352a54");
  const rim = col(flash, "#5a4788");
  const seam = e.enraged ? "#ff5a8a" : VOID.deep;
  const core = e.enraged ? "#ffb9d0" : VOID.cyan;

  const coreOpenVisual = smooth(e.coreVisualOpen ?? (e.coreOpen ? 1 : 0));
  const coreFlare = clamp01(e.coreFlare || 0);
  const eruptionP = clamp01((e.eruptionAnim || 0) / 1.4);
  const windupP = e.slamT !== undefined ? smooth(clamp01(e.slamT / 0.85)) : 0;
  const riftGlow = clamp01(e.voidRiftCast || 0);
  const collapseP = e.voidCollapseT !== undefined ? smooth(clamp01(e.voidCollapseT / 1.05)) : 0;
  const spellLift = Math.max(riftGlow, collapseP);
  const slamP = smooth(clamp01((e.golemSlamImpact || 0) / 0.2));
  const hurlHold = clamp01(e.golemHurlCharge || 0);
  const siegeKind = e.golemWallAttackKind || '';
  const siegeT = e.golemWallAttackT;
  const siegeActive = siegeT !== undefined && !!siegeKind;
  const siegePhase = (start, duration) => siegeActive ? smooth((siegeT - start) / duration) : 0;
  const ramLean = siegeActive && siegeKind === 'ram'
    ? (siegeT < 0.48 ? -siegePhase(0, 0.48) : (siegeT < 0.59 ? -1 + 2 * siegePhase(0.48, 0.11) : 1 - siegePhase(0.59, 0.53)))
    : 0;
  const crushLean = siegeActive && siegeKind === 'crush'
    ? (siegeT < 0.7 ? -siegePhase(0, 0.7) * 0.52 : (1 - siegePhase(0.82, 0.6)) * siegePhase(0.7, 0.12) * 0.46)
    : 0;
  const walkBlend = clamp01(e.golemWalkBlend || 0);
  const step = Math.sin((e.golemWalkPhase || 0) * TAU) * walkBlend;
  const stride = step * w * 0.07 * (1 - windupP * 0.8 - slamP * 0.9);
  const stepImpact = clamp01(e.golemStepImpact || 0);
  const bob = Math.abs(step) * 4 - windupP * w * 0.05 + slamP * w * 0.04 + stepImpact * 1.8;
  const lean = ramLean * 0.22 + crushLean * 0.3 + windupP * -0.08;
  const energy = coreOpenVisual + coreFlare + eruptionP + hurlHold + spellLift;

  // deep shadow pooled under something that heavy
  ctx.save(); ctx.globalAlpha = 0.3;
  ctx.fillStyle = "#04020c";
  ctx.beginPath(); ctx.ellipse(0, groundY - 1, w * 0.5, w * 0.1, 0, 0, TAU); ctx.fill();
  ctx.restore();

  // impact shockwave when a slam lands
  if (slamP > 0) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = slamP;
    ctx.strokeStyle = core; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(0, groundY - 2, w * (0.9 - slamP * 0.35), w * 0.14, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  // pillar legs with a ponderous stride
  for (const side of [-1, 1]) {
    const lx = side * w * 0.2 + (side > 0 ? stride : -stride);
    ctx.fillStyle = side < 0 ? stone : stone2;
    ctx.beginPath();
    ctx.moveTo(lx - w * 0.09, groundY);
    ctx.lineTo(lx - w * 0.07, groundY - w * 0.3);
    ctx.lineTo(lx + w * 0.09, groundY - w * 0.32);
    ctx.lineTo(lx + w * 0.11, groundY);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rim; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(lx + w * 0.06, groundY - w * 0.3); ctx.lineTo(lx + w * 0.08, groundY - w * 0.04); ctx.stroke();
  }

  ctx.save();
  const pivotY = groundY - w * 0.34;
  ctx.translate(0, pivotY - bob * 0.3); ctx.rotate(lean); ctx.translate(0, -pivotY);
  ctx.translate(0, -bob);

  // hips: a cracked slab floating just above the legs
  ctx.fillStyle = stone2;
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, groundY - w * 0.3);
  ctx.lineTo(-w * 0.26, groundY - w * 0.42);
  ctx.lineTo(w * 0.28, groundY - w * 0.44);
  ctx.lineTo(w * 0.32, groundY - w * 0.31);
  ctx.closePath(); ctx.fill();

  // starlight seam between hips and torso — the slabs don't touch
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.35 + 0.25 * Math.sin(T * 2.2) + energy * 0.4;
  ctx.fillStyle = seam;
  ctx.fillRect(-w * 0.24, groundY - w * 0.465, w * 0.5, w * 0.02);
  ctx.restore();

  // torso monolith
  const ty = groundY - w * 0.47;
  ctx.fillStyle = stone;
  ctx.beginPath();
  ctx.moveTo(-w * 0.34, ty);
  ctx.lineTo(-w * 0.3, ty - w * 0.34);
  ctx.lineTo(-w * 0.1, ty - w * 0.42);
  ctx.lineTo(w * 0.24, ty - w * 0.4);
  ctx.lineTo(w * 0.36, ty - w * 0.12);
  ctx.lineTo(w * 0.3, ty + w * 0.02);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = stone3;
  ctx.beginPath();
  ctx.moveTo(-w * 0.28, ty - w * 0.02);
  ctx.lineTo(-w * 0.25, ty - w * 0.3);
  ctx.lineTo(-w * 0.08, ty - w * 0.37);
  ctx.lineTo(-w * 0.02, ty - w * 0.05);
  ctx.closePath(); ctx.fill();

  // fracture veins crawling across the chest
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.4 + 0.25 * Math.sin(T * 3.1) + energy * 0.4;
  ctx.strokeStyle = seam; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-w * 0.18, ty - w * 0.05);
  ctx.lineTo(-w * 0.08, ty - w * 0.16);
  ctx.lineTo(-w * 0.14, ty - w * 0.27);
  ctx.moveTo(w * 0.16, ty - w * 0.05);
  ctx.lineTo(w * 0.08, ty - w * 0.18);
  ctx.lineTo(w * 0.16, ty - w * 0.3);
  ctx.stroke();
  ctx.restore();

  // the star core: caged behind plates, blazing when the AI opens it
  const cx = w * 0.03, cy = ty - w * 0.2;
  const coreR = w * 0.055 + coreOpenVisual * w * 0.045 + coreFlare * w * 0.03;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = clamp01(0.5 + 0.2 * Math.sin(T * 4) + coreOpenVisual * 0.4 + coreFlare);
  const cg = ctx.createRadialGradient(cx, cy, 1, cx, cy, coreR * 3);
  cg.addColorStop(0, "rgba(235,250,255,0.95)");
  cg.addColorStop(0.35, e.enraged ? "rgba(255,120,160,0.6)" : "rgba(143,232,255,0.6)");
  cg.addColorStop(1, "rgba(40,20,110,0)");
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.arc(cx, cy, coreR * 3, 0, TAU); ctx.fill();
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, TAU); ctx.fill();
  ctx.restore();
  // cage plates converge as the core closes
  ctx.fillStyle = stone2;
  for (let k = 0; k < 4; k++) {
    const a = k * (TAU / 4) + T * 0.2;
    const gap = coreR * (1.4 + coreOpenVisual * 1.6);
    ctx.save();
    ctx.translate(cx + Math.cos(a) * gap, cy + Math.sin(a) * gap);
    ctx.rotate(a);
    ctx.fillRect(-w * 0.008, -w * 0.045, w * 0.024, w * 0.09);
    ctx.restore();
  }

  // orbiting shard debris pulled around the shoulders
  ctx.fillStyle = stone3;
  for (let k = 0; k < 5; k++) {
    const a = T * (0.5 + k * 0.09) + k * 2.2;
    const ox = Math.cos(a) * w * (0.42 + (k % 3) * 0.05);
    const oy = ty - w * 0.24 + Math.sin(a) * w * 0.14;
    const sr = w * 0.02 + (k % 3) * w * 0.008;
    ctx.save(); ctx.translate(ox, oy); ctx.rotate(a * 1.4);
    ctx.beginPath(); ctx.moveTo(-sr, sr); ctx.lineTo(0, -sr * 1.5); ctx.lineTo(sr, sr * 0.8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // spell orb: the Titan cups a collapsing star before rifts open.
  if (spellLift > 0.04 || hurlHold > 0.04) {
    const hold = Math.max(spellLift, hurlHold);
    const ox = w * 0.18, oy = ty - w * (0.45 + collapseP * 0.1);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = clamp01(0.28 + hold * 0.72);
    const rg = ctx.createRadialGradient(ox, oy, 2, ox, oy, w * (0.16 + hold * 0.16));
    rg.addColorStop(0, "rgba(235,250,255,0.96)");
    rg.addColorStop(0.35, "rgba(138,90,255,0.7)");
    rg.addColorStop(1, "rgba(20,5,70,0)");
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(ox, oy, w * (0.16 + hold * 0.1), 0, TAU); ctx.fill();
    ctx.strokeStyle = collapseP > 0 ? "#d7f6ff" : seam;
    ctx.lineWidth = 2 + hold * 3;
    ctx.beginPath(); ctx.ellipse(ox, oy, w * (0.2 + hold * 0.12), w * (0.055 + hold * 0.03), T * 1.4, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(ox, oy, w * (0.13 + hold * 0.08), w * (0.18 + hold * 0.09), -T * 1.1, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  // arms: hang like siege chains, rise together for slams and void casting
  for (const side of [-1, 1]) {
    const shoX = side * w * 0.3, shoY = ty - w * 0.3;
    const raise = Math.max(windupP * (side > 0 ? 1 : 0.85), spellLift * (side > 0 ? 0.9 : 0.78));
    const handA = mix(1.35, -1.85, raise) + slamP * 3.1;
    const handX = shoX + Math.cos(side > 0 ? handA : Math.PI - handA) * w * 0.3;
    const handY = shoY + Math.sin(handA) * w * 0.3 + slamP * w * 0.1;
    ctx.strokeStyle = side < 0 ? stone : stone2;
    ctx.lineWidth = w * 0.085; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(shoX, shoY); ctx.lineTo(handX, handY); ctx.stroke();
    ctx.lineCap = "butt";
    // knuckle boulder
    ctx.fillStyle = side < 0 ? stone2 : stone3;
    ctx.beginPath(); ctx.arc(handX, handY, w * 0.075, 0, TAU); ctx.fill();
    if (windupP > 0.15 || hurlHold > 0.1) {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = clamp01(windupP * 0.6 + hurlHold * 0.7);
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(handX, handY, w * 0.04, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  // head: a split crystal crown with one burning eye slit
  const hx = w * 0.1, hy = ty - w * 0.47;
  ctx.fillStyle = stone2;
  ctx.beginPath();
  ctx.moveTo(hx - w * 0.11, hy + w * 0.06);
  ctx.lineTo(hx - w * 0.07, hy - w * 0.1);
  ctx.lineTo(hx + w * 0.02, hy - w * 0.15);
  ctx.lineTo(hx + w * 0.11, hy - w * 0.06);
  ctx.lineTo(hx + w * 0.12, hy + w * 0.06);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = stone;
  ctx.beginPath();
  ctx.moveTo(hx - w * 0.02, hy - w * 0.14);
  ctx.lineTo(hx + w * 0.005, hy - w * 0.24);
  ctx.lineTo(hx + w * 0.04, hy - w * 0.13);
  ctx.closePath(); ctx.fill();
  const eyeGlow = clamp01(0.65 + 0.25 * dark + energy * 0.4);
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = eyeGlow;
  ctx.fillStyle = t.eye;
  ctx.beginPath(); ctx.ellipse(hx + w * 0.035, hy - w * 0.02, w * 0.055, w * 0.016, -0.05, 0, TAU); ctx.fill();
  ctx.restore();

  ctx.restore();

  // eruption / enrage: motes stream upward off the whole frame
  voidMotes(T, 0, groundY - w * 0.5, e.enraged ? 8 : 5, w * 0.6, w * 0.3, e.x * 0.01);
}

// Null Seraph: a cathedral-sized void angel. It is not a dragon with a new
// paint job; the silhouette is vertical, ritualistic and full of floating
// blade-wings. The AI writes seraphLanceCharge, seraphPulseFlash,
// seraphSummonFlash, seraphWallCharge and seraphEnrage so each attack has a
// readable pose.
export function drawVoidSeraph(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const w = t.w;
  const flash = e.flash > 0 && !e.dying;
  const ink = col(flash, "#080414");
  const slab = col(flash, "#17102c");
  const robe = col(flash, "#241a42");
  const violet = col(flash, "#8a5aff");
  const star = col(flash, "#d7f6ff");
  const yc = groundY - 34 + Math.sin(T * 1.7 + e.x * 0.01) * 4;
  const flap = Math.sin(e.anim * 1.25);
  const lance = clamp01(e.seraphLanceCharge || 0);
  const pulse = clamp01(e.seraphPulseFlash || 0);
  const summon = clamp01(e.seraphSummonFlash || 0);
  const wallChoir = clamp01(e.seraphWallCharge || 0);
  const wallImpact = clamp01((e.seraphWallImpact || 0) / 0.34);
  const enrage = clamp01(e.seraphEnrage || 0);
  const cast = Math.max(lance, pulse, summon, wallChoir, wallImpact, enrage * 0.85);
  const crownSpin = T * (e.enraged ? 0.9 : 0.55);

  const poly = pts => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  };

  // Huge soft eclipse around the body, strongest while it casts.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.14 + dark * 0.08 + cast * 0.18;
  const aura = ctx.createRadialGradient(0, yc - w * 0.18, 8, 0, yc - w * 0.18, w * 1.28);
  aura.addColorStop(0, "rgba(215,246,255,0.45)");
  aura.addColorStop(0.34, "rgba(138,90,255,0.28)");
  aura.addColorStop(1, "rgba(10,3,35,0)");
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.ellipse(0, yc - w * 0.08, w * 0.95, w * 0.82, 0, 0, TAU); ctx.fill();
  ctx.restore();

  // A distant ground shadow sells its altitude.
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#03010a";
  ctx.beginPath(); ctx.ellipse(0, groundY + 4, w * 0.42, w * 0.07, 0, 0, TAU); ctx.fill();
  ctx.restore();

  // Broken halo, drawn behind the head. It rotates faster in enrage.
  ctx.save();
  ctx.translate(0, yc - w * 0.82);
  ctx.rotate(crownSpin);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (let k = 0; k < 7; k++) {
    const a0 = k * TAU / 7 + 0.08;
    const a1 = a0 + 0.42 + Math.sin(T * 2 + k) * 0.05;
    ctx.globalAlpha = 0.24 + cast * 0.22 + (k % 2) * 0.1;
    ctx.strokeStyle = k % 2 ? violet : star;
    ctx.lineWidth = 3.2 + (k % 3);
    ctx.beginPath(); ctx.arc(0, 0, w * (0.25 + (k % 2) * 0.035), a0, a1); ctx.stroke();
  }
  ctx.lineCap = "butt";
  ctx.restore();

  // Six angular blade-wings. The back set moves opposite the front set, so it
  // reads as a choir of blades rather than flapping leather.
  for (const layer of [0, 1]) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const rootX = side * w * (0.08 + k * 0.035);
        const rootY = yc - w * (0.42 - k * 0.03);
        const reach = w * (0.5 + k * 0.14 + layer * 0.08);
        const lift = w * (0.42 - k * 0.07);
        const fold = flap * side * (0.05 + k * 0.025) + (layer ? -0.06 : 0.05);
        // Fallen Choir folds every blade toward the wall before releasing a
        // single converging ray. In local space the current target is +x.
        const tipX = mix(side * reach, w * (0.48 + k * 0.12 + layer * 0.06), wallChoir);
        const tipY = mix(rootY - lift * (0.8 + fold), rootY + w * (0.16 + k * 0.08), wallChoir);
        const lowX = side * (reach * 0.62);
        const lowY = rootY + w * (0.13 + k * 0.07) + fold * w * 0.16;
        ctx.save();
        ctx.globalAlpha = layer ? 0.58 : 0.88;
        ctx.fillStyle = layer ? ink : slab;
        poly([[rootX, rootY], [tipX, tipY], [lowX, lowY], [rootX + side * w * 0.025, rootY + w * 0.08]]);
        ctx.fill();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = (layer ? 0.25 : 0.42) + cast * 0.18;
        ctx.strokeStyle = k % 2 ? violet : star;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(rootX, rootY); ctx.lineTo(tipX, tipY); ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Tattered lower vestments: long strips pulled downward by impossible gravity.
  for (let k = 0; k < 7; k++) {
    const off = (k - 3) * w * 0.045;
    const drift = Math.sin(T * 2.1 + k * 1.4) * w * 0.025;
    ctx.fillStyle = k % 2 ? ink : robe;
    ctx.beginPath();
    ctx.moveTo(off - w * 0.025, yc - w * 0.1);
    ctx.quadraticCurveTo(off + drift, yc + w * 0.25, off * 0.65 - drift, yc + w * (0.52 + (k % 3) * 0.07));
    ctx.quadraticCurveTo(off + w * 0.035, yc + w * 0.28, off + w * 0.028, yc - w * 0.08);
    ctx.closePath(); ctx.fill();
  }

  // Tall armored torso: a hollow reliquary with a bright star caged inside.
  ctx.fillStyle = robe;
  poly([[-w * 0.18, yc - w * 0.52], [-w * 0.25, yc - w * 0.18], [-w * 0.13, yc + w * 0.05],
        [w * 0.04, yc + w * 0.08], [w * 0.22, yc - w * 0.14], [w * 0.18, yc - w * 0.5],
        [w * 0.04, yc - w * 0.62]]);
  ctx.fill();
  ctx.fillStyle = ink;
  poly([[-w * 0.08, yc - w * 0.47], [-w * 0.15, yc - w * 0.2], [-w * 0.04, yc - w * 0.03],
        [w * 0.1, yc - w * 0.18], [w * 0.08, yc - w * 0.48]]);
  ctx.fill();
  // Rib bars curve over the caged star.
  ctx.strokeStyle = "#3a2a64"; ctx.lineWidth = w * 0.025; ctx.lineCap = "round";
  for (let k = 0; k < 4; k++) {
    const ry = yc - w * (0.41 - k * 0.07);
    ctx.beginPath();
    ctx.moveTo(-w * 0.1, ry);
    ctx.quadraticCurveTo(w * 0.02, ry + w * 0.035, w * 0.13, ry - w * 0.01);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  const heartX = w * 0.02, heartY = yc - w * 0.3;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = clamp01(0.56 + dark * 0.2 + cast * 0.45 + Math.sin(T * 5) * 0.08);
  const hg = ctx.createRadialGradient(heartX, heartY, 1, heartX, heartY, w * (0.18 + cast * 0.06));
  hg.addColorStop(0, "rgba(245,255,255,1)");
  hg.addColorStop(0.38, "rgba(138,90,255,0.72)");
  hg.addColorStop(1, "rgba(20,4,70,0)");
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(heartX, heartY, w * (0.16 + cast * 0.04), 0, TAU); ctx.fill();
  ctx.fillStyle = star; ctx.beginPath(); ctx.arc(heartX, heartY, w * 0.035, 0, TAU); ctx.fill();
  ctx.restore();

  // Arms change with the ritual: lance points forward, pulse spreads wide,
  // summon draws both claws down, and Fallen Choir aims both blades at the wall.
  const shoulderY = yc - w * 0.44;
  const handBaseY = yc - w * 0.26;
  const drawArmBlade = (side) => {
    const spread = pulse * side * w * 0.42;
    const lift = lance * -w * 0.08 + summon * w * 0.18 + wallChoir * w * 0.09;
    const reach = lance * side * w * 0.42 + wallChoir * (w * 0.5 - side * w * 0.18);
    const sx = side * w * 0.14, sy = shoulderY;
    const ex = side * w * 0.18 + spread + reach;
    const ey = handBaseY + lift + Math.sin(T * 2 + side) * 3;
    ctx.strokeStyle = slab; ctx.lineWidth = w * 0.04; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(side * w * 0.24, sy + w * 0.12, ex, ey); ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = ink;
    poly([[ex - side * w * 0.018, ey - w * 0.02], [ex + side * w * 0.13, ey - w * (0.08 + lance * 0.08)],
          [ex + side * w * 0.04, ey + w * 0.05]]);
    ctx.fill();
    if (lance > 0.15 && side > 0) {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = lance;
      ctx.strokeStyle = star; ctx.lineWidth = 3 + lance * 5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + side * w * (0.36 + lance * 0.22), ey - w * 0.02); ctx.stroke();
      ctx.lineCap = "butt";
      ctx.restore();
    }
  };
  drawArmBlade(-1);
  drawArmBlade(1);

  // Attack-specific readable VFX.
  if (pulse > 0.04) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = pulse * 0.65;
    ctx.strokeStyle = star; ctx.lineWidth = 4;
    for (let k = 0; k < 3; k++) {
      const rr = w * (0.28 + pulse * 0.36 + k * 0.12);
      ctx.beginPath(); ctx.ellipse(0, yc - w * 0.2, rr, rr * 0.36, 0, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
  if (summon > 0.04) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = summon * 0.72;
    ctx.strokeStyle = violet; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, groundY + 2, w * (0.24 + summon * 0.36), w * 0.07, 0, 0, TAU); ctx.stroke();
    for (let k = 0; k < 5; k++) {
      const sx = (k - 2) * w * 0.09 + Math.sin(T * 3 + k) * 3;
      ctx.beginPath(); ctx.moveTo(sx, groundY); ctx.lineTo(sx * 0.5, yc + w * 0.16 - summon * w * 0.08); ctx.stroke();
    }
    ctx.restore();
  }
  if ((wallChoir > 0.04 || wallImpact > 0.02) && e.seraphWallTarget) {
    const targetX = (e.seraphWallTarget.x - e.x) * (e.dir || 1);
    // The caller translates flying enemies by fy, so cancel that lift to pin
    // the ray to the real wall instead of letting its endpoint hover in space.
    const targetY = groundY - (e.fy || 0) - wallHeight(e.seraphWallTarget) * 0.58;
    const sourceX = w * 0.12, sourceY = yc - w * 0.28;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    if (wallChoir > 0.04) {
      ctx.strokeStyle = wallChoir > 0.82 ? star : violet;
      ctx.globalAlpha = 0.28 + wallChoir * 0.58;
      ctx.lineWidth = 2 + wallChoir * 9;
      ctx.beginPath(); ctx.moveTo(sourceX, sourceY); ctx.lineTo(targetX, targetY); ctx.stroke();
      ctx.lineWidth = 1.5;
      for (let k = -1; k <= 1; k++) {
        const spread = (1 - wallChoir) * (36 + Math.abs(k) * 24);
        ctx.globalAlpha = 0.18 + wallChoir * 0.34;
        ctx.beginPath(); ctx.moveTo(k * w * 0.22, yc - w * 0.42); ctx.lineTo(targetX, targetY + k * spread); ctx.stroke();
      }
    }
    if (wallImpact > 0.02) {
      ctx.strokeStyle = star; ctx.globalAlpha = wallImpact * 0.85;
      for (let k = 0; k < 3; k++) {
        const rr = (1 - wallImpact) * (46 + k * 22) + 18;
        ctx.lineWidth = 5 - k;
        ctx.beginPath(); ctx.arc(targetX, targetY, rr, 0, TAU); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Head: a tiny, severe mask under the halo makes the scale unsettling.
  const hx = w * 0.04, hy = yc - w * 0.69;
  ctx.fillStyle = ink;
  poly([[hx - w * 0.1, hy + w * 0.08], [hx - w * 0.07, hy - w * 0.08], [hx + w * 0.01, hy - w * 0.14],
        [hx + w * 0.12, hy - w * 0.04], [hx + w * 0.1, hy + w * 0.1], [hx - w * 0.02, hy + w * 0.14]]);
  ctx.fill();
  ctx.fillStyle = slab;
  poly([[hx - w * 0.065, hy + w * 0.055], [hx - w * 0.035, hy - w * 0.055], [hx + w * 0.045, hy - w * 0.07],
        [hx + w * 0.085, hy + w * 0.03], [hx + w * 0.035, hy + w * 0.09], [hx - w * 0.045, hy + w * 0.085]]);
  ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = clamp01(0.68 + dark * 0.22 + cast * 0.3);
  ctx.fillStyle = star;
  ctx.beginPath(); ctx.ellipse(hx + w * 0.026, hy + w * 0.012, w * 0.075, w * 0.014, -0.05, 0, TAU); ctx.fill();
  ctx.restore();

  // Crown spikes orbit in front of the halo.
  ctx.fillStyle = ink;
  for (let k = 0; k < 5; k++) {
    const a = crownSpin + k * TAU / 5;
    const rx = hx + Math.cos(a) * w * 0.17;
    const ry = hy - w * 0.07 + Math.sin(a) * w * 0.035;
    const len = w * (0.065 + (k % 2) * 0.035);
    ctx.save(); ctx.translate(rx, ry); ctx.rotate(a + Math.PI / 2);
    poly([[-w * 0.012, 0], [0, -len], [w * 0.014, 0], [0, len * 0.25]]);
    ctx.fill();
    ctx.restore();
  }

  if (enrage > 0.02) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = enrage * 0.9;
    ctx.strokeStyle = "#d7f6ff"; ctx.lineWidth = 2.5;
    for (let k = 0; k < 10; k++) {
      const a = k * TAU / 10 + T;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * w * 0.22, yc - w * 0.32 + Math.sin(a) * w * 0.14);
      ctx.lineTo(Math.cos(a) * w * 0.78, yc - w * 0.32 + Math.sin(a) * w * 0.44);
      ctx.stroke();
    }
    ctx.restore();
  }

  voidMotes(T, 0, yc - w * 0.25, e.enraged ? 10 : 7, w * 0.9, w * 0.38, e.x * 0.015);
}
