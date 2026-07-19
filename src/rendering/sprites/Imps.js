// Enemy imp sprite renderers: the ground imp (drawImp) and the flying fire imp
// (drawFireImp). Both draw in entity-local space: origin at the enemy's x with
// the ground at groundY, facing +x (drawEnemies mirrors the canvas for dir < 0).
// The death ragdoll rotation, fy translation and stack offsets are applied by
// the caller before these run.
import { ctx, groundY } from '../../core/canvas.js';

const TAU = Math.PI * 2;
const mix = (a, b, u) => a + (b - a) * u;
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

// Two-bone IK: middle joint of a limb spanning (x1,y1)→(x2,y2) with segment
// lengths l1/l2. bend=+1 pops the joint one side of the limb line, -1 the other.
function joint(x1, y1, x2, y2, l1, l2, bend) {
  const dx = x2 - x1, dy = y2 - y1;
  const d = Math.hypot(dx, dy) || 0.0001;
  const md = Math.min(d, (l1 + l2) * 0.999);
  const a = (l1 * l1 - l2 * l2 + md * md) / (2 * md);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { x: x1 + (dx / d) * a - (dy / d) * h * bend, y: y1 + (dy / d) * a + (dx / d) * h * bend };
}

// Tapered two-segment limb through an IK joint.
function limb(x1, y1, x2, y2, l1, l2, bend, w1, w2, color) {
  const j = joint(x1, y1, x2, y2, l1, l2, bend);
  ctx.strokeStyle = color; ctx.lineCap = "round";
  ctx.lineWidth = w1;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(j.x, j.y); ctx.stroke();
  ctx.lineWidth = w2;
  ctx.beginPath(); ctx.moveTo(j.x, j.y); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.lineCap = "butt";
  return j;
}

// Small fan of hooked claws at (x,y) around angle ang.
function claws(x, y, ang, len, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1.1; ctx.lineCap = "round";
  for (let k = -1; k <= 1; k++) {
    const a = ang + k * 0.38;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.6, y + Math.sin(a) * len * 0.6,
      x + Math.cos(a + 0.3) * len, y + Math.sin(a + 0.3) * len);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

// Per-frame movement tracker so gait/lean react to actual motion instead of
// guessing from AI state. Draw-only smoothing, stored on the entity.
function motion(e) {
  const px = e._sprPX;
  e._sprPX = e.x;
  const dx = px === undefined ? 0 : e.x - px;
  const fwd = Math.max(-1, Math.min(1, dx * (e.dir || 1) * 0.6));
  e._sprMv = (e._sprMv || 0) + (clamp01(Math.abs(dx) * 1.6) - (e._sprMv || 0)) * 0.16;
  e._sprLean = (e._sprLean || 0) + (fwd - (e._sprLean || 0)) * 0.12;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ground imp: a hunched knuckle-dragging devil. Digitigrade IK legs with a real
// run cycle, dragging claw arms, hinged jaw, pinnable bat ears, whip tail with
// a flame tip, plus dedicated poses for climbing stacks and being airborne.
// ─────────────────────────────────────────────────────────────────────────────
export function drawImp(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = e.dying ? clamp01(e.deathT / (e.deathDuration || 0.5)) : 0;
  motion(e);
  const run = e._sprMv || 0, lean = e._sprLean || 0;

  const body = flash ? "#fff" : "#932319";
  const bodyDk = flash ? "#fff" : "#511116";
  const bodyMid = flash ? "#fff" : "#b8422a";
  const limbFar = flash ? "#fff" : "#6d1a16";
  const hornCol = flash ? "#fff" : "#380d10";
  const ember = "#ff7a24";
  const hot = "#ffd060";

  const atkKind = e.impAttackKind || "claw";
  // Pounce is driven by the AI's own clock so pose and motion stay in sync.
  const pounce = atkKind === "pounce" && e.aiState === "impAttack" && !e.dying && e.impPounceP != null ? e.impPounceP : -1;
  const swingDur = atkKind === "tail" ? 0.35 : 0.25;
  const p = pounce >= 0 ? pounce : (e.attackAnim || 0) > 0 ? clamp01(1 - e.attackAnim / swingDur) : -1;
  const clawing = p >= 0 && atkKind !== "tail" && pounce < 0;

  const climbing = e.aiState === "stacking" || e.aiState === "climbOver";
  const scrambling = e.aiState === "climbOver";
  const thrown = e.aiState === "thrown";
  const vaulting = e.aiState === "vaulting" && (e.fy || 0) < -4;
  const climbSeed = (e.stackJoinOrder || 0) * 3.7;

  const ph = e.anim * 3;
  const bob = Math.abs(Math.sin(ph)) * 2.2 * run + Math.sin(T * 2.7 + e.x * 0.31) * 0.5;
  const lunge = clawing ? Math.sin(clamp01(p * 1.5) * Math.PI) * 5 : 0;

  // soft contact shadow that shrinks while airborne
  const off = e.fy || 0;
  if (!e.wallTopWall && !climbing && !e.dying) {
    const h = clamp01(-Math.min(0, off) / 70);
    ctx.save(); ctx.globalAlpha = 0.2 * (1 - h * 0.65);
    ctx.fillStyle = "#0c0406";
    ctx.beginPath(); ctx.ellipse(0, groundY - off - 1, 12 * (1 - h * 0.4), 2.8 * (1 - h * 0.4), 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // Whole-body pounce pose: coil low during windup, stretch flat into the leap,
  // dive nose-first at the end, then squash on landing.
  let pounceAir = -1;
  if (pounce >= 0) {
    const windup = 0.22;
    const pivotY = groundY - 6;
    let sx = 1, sy = 1, rot = 0;
    if (pounce < windup) {
      const c = (pounce / windup) ** 2;
      sx = 1 + 0.16 * c; sy = 1 - 0.3 * c; rot = 0.18 * c;
    } else {
      const lp = Math.min(1, (pounce - windup) / (1 - windup));
      pounceAir = Math.min(1, lp / 0.85);
      if (pounceAir < 1) {
        const stretch = Math.sin(pounceAir * Math.PI);
        sx = 1 + 0.3 * stretch; sy = 1 - 0.22 * stretch;
        rot = -0.55 + pounceAir * 1.05;
      } else {
        const sq = 1 - (lp - 0.85) / 0.15;
        sx = 1 + 0.34 * sq; sy = 1 - 0.38 * sq; rot = 0.12 * sq;
      }
    }
    ctx.save();
    ctx.translate(0, pivotY); ctx.rotate(rot); ctx.scale(sx, sy); ctx.translate(0, -pivotY);
  }
  const airborne = (pounceAir > 0 && pounceAir < 1) || vaulting || thrown;

  // ember streak trailing the leap
  if (pounceAir > 0 && pounceAir < 1) {
    const heat = Math.sin(pounceAir * Math.PI);
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.4 * heat;
    const trail = ctx.createLinearGradient(-34, 0, 4, 0);
    trail.addColorStop(0, "rgba(180,30,0,0)");
    trail.addColorStop(0.7, "rgba(255,120,30,0.5)");
    trail.addColorStop(1, "rgba(255,208,96,0.85)");
    ctx.fillStyle = trail;
    ctx.beginPath(); ctx.ellipse(-13, groundY - 15, 21, 6.5 + heat * 2, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // heat aura hugging the body
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (0.15 + 0.08 * Math.sin(T * 9 + e.x)) * (1 - dp);
  const aura = ctx.createRadialGradient(0, groundY - 17 - bob, 2, 0, groundY - 17 - bob, 26);
  aura.addColorStop(0, "rgba(255,120,30,0.55)");
  aura.addColorStop(1, "rgba(120,20,0,0)");
  ctx.fillStyle = aura; ctx.beginPath(); ctx.ellipse(0, groundY - 17 - bob, 20, 24, 0, 0, TAU); ctx.fill();
  ctx.restore();

  // drifting soot wisps rising off the shoulders
  ctx.save(); ctx.globalAlpha = 0.16 * (1 - dp);
  ctx.fillStyle = "#2a1512";
  for (let k = 0; k < 2; k++) {
    const wt = (T * 0.7 + k * 0.5 + e.x * 0.03) % 1;
    ctx.beginPath();
    ctx.arc(Math.sin((T + k * 2.4) * 2.2) * 4, groundY - 26 - bob - wt * 16, 2.6 * (1 - wt) + 1, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // ── whip tail (behind everything): rest wave, or a full overhead strike ──
  const tailStrike = atkKind === "tail" && p >= 0;
  const tBase = { x: -6, y: groundY - 11.5 - bob };
  let tTip, tCtrl;
  if (tailStrike) {
    // coil low behind → whip overhead → crack down in front
    const c = clamp01(p / 0.3), w = clamp01((p - 0.3) / 0.32), r = clamp01((p - 0.78) / 0.22);
    const coil = { x: -26, y: groundY - 7 };
    const over = { x: 0, y: groundY - 40 };
    const front = { x: 17, y: groundY - 20 };
    let tip = c < 1 ? { x: mix(-21, coil.x, c), y: mix(groundY - 20 - bob, coil.y, c) }
      : w < 0.5 ? { x: mix(coil.x, over.x, w * 2), y: mix(coil.y, over.y, w * 2) }
        : { x: mix(over.x, front.x, (w - 0.5) * 2), y: mix(over.y, front.y, (w - 0.5) * 2) };
    if (r > 0) tip = { x: mix(front.x, -21, r), y: mix(front.y, groundY - 20 - bob, r) };
    tTip = tip;
    // control point lags behind the tip so the tail bows like a real whip
    tCtrl = { x: mix(tBase.x, tip.x, 0.45) - (tip.x - tBase.x) * 0.22, y: mix(tBase.y, tip.y, 0.4) + 7 - w * 16 };
  } else {
    const wag = Math.sin(T * 4.6 + e.x * 0.1);
    tTip = { x: -21 - run * 2, y: groundY - 20 - bob - wag * 2.5 - run * 3 };
    tCtrl = { x: -14, y: groundY - 4 - bob + wag * 1.5 };
  }
  {
    // tapered segments along a quadratic curve with a travelling ripple
    const N = 7;
    let prev = tBase;
    ctx.lineCap = "round"; ctx.strokeStyle = bodyDk;
    for (let i = 1; i <= N; i++) {
      const u = i / N, v = 1 - u;
      const wx = v * v * tBase.x + 2 * v * u * tCtrl.x + u * u * tTip.x;
      const wy = v * v * tBase.y + 2 * v * u * tCtrl.y + u * u * tTip.y + Math.sin(T * 6 - u * 3.4) * 1.4 * u * (tailStrike ? 0.3 : 1);
      ctx.lineWidth = 3.2 - u * 2.2;
      ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(wx, wy); ctx.stroke();
      prev = { x: wx, y: wy };
    }
    ctx.lineCap = "butt";
    // arrowhead tip
    const ta = Math.atan2(tTip.y - tCtrl.y, tTip.x - tCtrl.x);
    ctx.fillStyle = hornCol;
    ctx.save(); ctx.translate(prev.x, prev.y); ctx.rotate(ta);
    ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(5, 0); ctx.lineTo(-2, 3); ctx.closePath(); ctx.fill();
    ctx.restore();
    // living flame licking off the tip
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.75 * (1 - dp);
    ctx.fillStyle = ember;
    ctx.beginPath(); ctx.ellipse(prev.x, prev.y - 4, 2.8, 4.8 + Math.sin(T * 13) * 1.3, 0.15, 0, TAU); ctx.fill();
    ctx.fillStyle = hot;
    ctx.beginPath(); ctx.ellipse(prev.x, prev.y - 4.5, 1.2, 2.4, 0.15, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ── legs: digitigrade, two-bone IK, feet plant and swing with real motion ──
  const hipY = groundY - 10.5 - bob;
  const legStep = (side) => {
    const phs = ph + side * Math.PI;
    let fx, fy;
    if (airborne) { fx = -8 - side * 4; fy = groundY - 4 - side * 2; }
    else if (scrambling) {
      const sc = Math.sin(T * 6 + climbSeed + side * Math.PI);
      fx = -1 + side * 3 + sc * 2.5;
      fy = groundY - 2 - Math.max(0, sc) * 5;
    }
    else if (climbing) {
      const cBob = Math.sin(T * 2.5 + climbSeed + side * 1.8) * 1.5;
      fx = -1 + side * 3 + cBob;
      fy = groundY - 1;
    }
    else if (clawing) { fx = side ? -5 : 3 + lunge * 0.4; fy = groundY; }
    else {
      const lift = Math.max(0, -Math.sin(phs)) * 3.6 * run;
      fx = -2.5 + Math.cos(phs) * 5.5 * run + (run < 0.1 ? (side ? -3.5 : 2) : 0);
      fy = groundY - lift;
    }
    return { hx: -3 + side * 1.2, hy: hipY + side * 0.4, fx, fy };
  };
  // far leg first, in shade
  for (const side of [1, 0]) {
    const L = legStep(side);
    const col = side ? limbFar : body;
    limb(L.hx, L.hy, L.fx, L.fy, 6.5, 7.5, 1, side ? 2.4 : 2.7, side ? 1.9 : 2.2, col);
    // clawed toes
    ctx.strokeStyle = col; ctx.lineWidth = side ? 1.7 : 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(L.fx, L.fy); ctx.lineTo(L.fx + 3.4, L.fy - 0.4); ctx.stroke();
    ctx.lineCap = "butt";
    claws(L.fx + 3.2, L.fy - 0.6, -0.25, 2.6, hornCol);
  }

  // far arm behind the torso
  const shY = groundY - 18.5 - bob;
  {
    let hx2, hy2;
    if (scrambling) {
      const armSc = Math.sin(T * 6 + climbSeed + 1.2);
      hx2 = 3 + armSc * 3; hy2 = groundY - 27 - bob - Math.max(0, armSc) * 4;
    }
    else if (climbing) {
      const armBob = Math.sin(T * 2.5 + climbSeed + 0.8) * 2;
      hx2 = 3 + armBob; hy2 = groundY - 27 - bob;
    }
    else if (airborne) { hx2 = 10; hy2 = groundY - 22 - bob; }
    else { hx2 = 6.5 + Math.cos(ph + Math.PI) * 2.5 * run; hy2 = groundY - 6.5 - bob * 0.5; }
    limb(3.2, shY + 0.5, hx2, hy2, 6, 8, 1, 2.2, 1.8, limbFar);
    claws(hx2, hy2, airborne ? 0.4 : 1.1, 2.8, limbFar);
  }

  // ── torso: hunched back, pale cracked belly, spine spikes, molten seams ──
  ctx.save();
  ctx.translate(lunge, 0);
  const coilR = clawing ? (p < 0.32 ? -0.14 * (p / 0.32) : 0.12 * Math.sin(clamp01((p - 0.32) / 0.5) * Math.PI)) : 0;
  const climbRot = scrambling ? -0.35 + Math.sin(T * 5.5 + climbSeed) * 0.12 : (climbing ? -0.3 : 0);
  ctx.translate(-2, hipY); ctx.rotate(lean * 0.14 + coilR + climbRot); ctx.translate(2, -hipY);

  const breathe = Math.sin(T * 3.1 + e.x * 0.2) * 0.45 * (1 - run * 0.5);
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, groundY - 14 - bob, 8.2 + breathe * 0.4, 9.6 + breathe, -0.3, 0, TAU); ctx.fill();
  // shaded hump along the back
  ctx.fillStyle = bodyDk; ctx.globalAlpha = flash ? 1 : 0.55;
  ctx.beginPath(); ctx.ellipse(-3.2, groundY - 17.5 - bob, 5.4, 6.4, -0.55, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  // pale cracked belly plate
  ctx.fillStyle = bodyMid;
  ctx.beginPath(); ctx.ellipse(2.5, groundY - 11.5 - bob, 4.6, 6 + breathe * 0.7, -0.28, 0, TAU); ctx.fill();
  ctx.strokeStyle = flash ? "#fff" : "#d8583a"; ctx.lineWidth = 0.8;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath(); ctx.moveTo(-0.5, groundY - 15.5 - bob + k * 3.2); ctx.lineTo(4.8, groundY - 14.9 - bob + k * 3.2); ctx.stroke();
  }
  // bony spikes riding the hump, shivering slightly
  ctx.fillStyle = hornCol;
  for (let k = 0; k < 4; k++) {
    const spx = -7 + k * 2.7, spy = groundY - 19.5 - bob + Math.abs(k - 1.2) * 1.15;
    const shiver = Math.sin(T * 7 + k * 2) * 0.3;
    ctx.beginPath(); ctx.moveTo(spx - 1.4, spy + 2.4); ctx.lineTo(spx + shiver, spy - 3.4 + k * 0.3); ctx.lineTo(spx + 1.4, spy + 2.4); ctx.closePath(); ctx.fill();
  }
  // molten seams glowing through the hide
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (0.32 + 0.2 * Math.sin(T * 4 + e.x)) * (1 - dp);
  ctx.strokeStyle = ember; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(-4.5, groundY - 9.5 - bob); ctx.lineTo(-1.5, groundY - 13 - bob); ctx.lineTo(-3.5, groundY - 16.5 - bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1, groundY - 18 - bob); ctx.lineTo(3.5, groundY - 15.5 - bob); ctx.stroke();
  ctx.restore();

  // ── head: skull + muzzle, hinged jaw, glow eyes, pinned ears, swept horns ──
  const hdx = 7.5 + (p >= 0 ? 1.6 : 0) + lean * 1.2;
  const hdy = groundY - 25 - bob * 0.85 + (climbing ? 3 : 0);
  // short thick neck
  ctx.strokeStyle = body; ctx.lineWidth = 4.6; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(3, groundY - 19 - bob); ctx.lineTo(hdx - 2, hdy + 2); ctx.stroke();
  ctx.lineCap = "butt";

  // ears: big bat membranes that pin flat back mid-attack
  const pin = p >= 0 || pounce >= 0 ? 1 : 0;
  const earTw = Math.sin(T * 4.3 + e.x * 0.7) > 0.9 ? 2.2 : 0;
  const earA = mix(-0.5, 0.32, pin); // tilt down/back when pinned
  for (const [ex0, ey0, sc, col] of [[hdx - 3.4, hdy - 4.4, 0.86, bodyDk], [hdx - 2.6, hdy - 5, 1, body]]) {
    ctx.fillStyle = col;
    ctx.save(); ctx.translate(ex0, ey0); ctx.rotate(earA);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-6 * sc, -6 * sc - earTw, -12.5 * sc, -4.5 * sc - earTw);
    ctx.quadraticCurveTo(-6.5 * sc, -0.5 * sc, 0, 2.6 * sc);
    ctx.closePath(); ctx.fill();
    if (col === body) { // inner-ear shading
      ctx.fillStyle = bodyDk; ctx.globalAlpha = flash ? 1 : 0.5;
      ctx.beginPath(); ctx.moveTo(-2, 0.2);
      ctx.quadraticCurveTo(-6 * sc, -3 * sc - earTw * 0.6, -10 * sc, -3.4 * sc - earTw * 0.8);
      ctx.quadraticCurveTo(-6 * sc, -0.4 * sc, -2, 1.6);
      ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // swept horns with hot tips
  ctx.strokeStyle = hornCol; ctx.lineCap = "round";
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(hdx - 0.5, hdy - 5.2); ctx.quadraticCurveTo(hdx - 1.5, hdy - 10.5, hdx - 5.5, hdy - 12.5); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(hdx + 3.4, hdy - 4.6); ctx.quadraticCurveTo(hdx + 3.6, hdy - 9.5, hdx + 0.8, hdy - 12); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.55 * (1 - dp);
  ctx.fillStyle = ember;
  ctx.beginPath(); ctx.arc(hdx - 5.5, hdy - 12.5, 1, 0, TAU); ctx.arc(hdx + 0.8, hdy - 12, 0.85, 0, TAU); ctx.fill();
  ctx.restore();

  // skull + jutting muzzle
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(hdx, hdy, 6.2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(hdx + 2, hdy - 3.4);
  ctx.quadraticCurveTo(hdx + 9.4, hdy - 2.6, hdx + 10.2, hdy + 0.8);
  ctx.lineTo(hdx + 2.5, hdy + 2.4); ctx.closePath(); ctx.fill();
  // brow ridge
  ctx.strokeStyle = bodyDk; ctx.lineWidth = 1.6; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(hdx - 0.5, hdy - 3.4); ctx.lineTo(hdx + 6.2, hdy - 3); ctx.stroke();
  ctx.lineCap = "butt";
  // nostril slit
  ctx.strokeStyle = bodyDk; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(hdx + 8.6, hdy - 0.4); ctx.lineTo(hdx + 9.6, hdy + 0.2); ctx.stroke();

  // hinged lower jaw: snarls open on attacks, mutters at idle, slack in death
  const jawA = e.dying ? 0.5
    : p >= 0 ? 0.72 * Math.sin(clamp01(p * 1.5) * Math.PI)
      : 0.1 + 0.09 * Math.sin(T * 2.1 + e.x);
  ctx.save(); ctx.translate(hdx + 2.2, hdy + 2); ctx.rotate(jawA);
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(4.5, 1.6, 7.6, 0.6); ctx.lineTo(6.8, 2.6); ctx.quadraticCurveTo(2.5, 3.6, 0, 2.2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = flash ? "#fff" : "#f0e0c0"; ctx.lineWidth = 0.9; ctx.lineCap = "round";
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(1.8 + k * 2, 0.9); ctx.lineTo(2.2 + k * 2, -0.9); ctx.stroke(); }
  ctx.lineCap = "butt";
  ctx.restore();
  // dark maw + ember glow inside when it gapes
  if (jawA > 0.18) {
    ctx.fillStyle = flash ? "#fff" : "#28070a";
    ctx.beginPath(); ctx.moveTo(hdx + 2.4, hdy + 1.6);
    ctx.quadraticCurveTo(hdx + 6.5, hdy + 1.6 + jawA * 4.5, hdx + 9.5, hdy + 1);
    ctx.quadraticCurveTo(hdx + 6, hdy + 0.6, hdx + 2.4, hdy + 1.6); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5 * clamp01(jawA * 2) * (1 - dp);
    ctx.fillStyle = ember; ctx.beginPath(); ctx.ellipse(hdx + 5.5, hdy + 1.8, 2.4, jawA * 2.6, 0, 0, TAU); ctx.fill();
    ctx.restore();
    // upper fangs over the maw
    ctx.strokeStyle = flash ? "#fff" : "#f0e0c0"; ctx.lineWidth = 0.9; ctx.lineCap = "round";
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(hdx + 3.4 + k * 2.1, hdy + 1.4); ctx.lineTo(hdx + 3.8 + k * 2.1, hdy + 2.6 + jawA * 1.6); ctx.stroke(); }
    ctx.lineCap = "butt";
  }

  // glowing eyes with slit pupils; blink now and then, dim in death
  const blink = Math.sin(T * 2.7 + e.x * 0.37) > 0.985 && !e.dying;
  const eyeA = (blink ? 0.15 : 0.7 + 0.25 * dark) * (1 - dp);
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = eyeA;
  ctx.fillStyle = hot;
  ctx.beginPath(); ctx.arc(hdx + 1.8, hdy - 1.4, 2.5, 0, TAU); ctx.arc(hdx + 5, hdy - 1, 2.1, 0, TAU); ctx.fill();
  ctx.restore();
  if (!blink) {
    ctx.fillStyle = hot; ctx.globalAlpha = 1 - dp * 0.7;
    ctx.beginPath(); ctx.arc(hdx + 1.8, hdy - 1.4, 1.3, 0, TAU); ctx.arc(hdx + 5, hdy - 1, 1.1, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = flash ? "#fff" : "#3a0a08"; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(hdx + 1.9, hdy - 2.5); ctx.lineTo(hdx + 1.9, hdy - 0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hdx + 5.1, hdy - 2); ctx.lineTo(hdx + 5.1, hdy - 0.1); ctx.stroke();
  } else {
    ctx.strokeStyle = hot; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hdx + 0.6, hdy - 1.4); ctx.lineTo(hdx + 3, hdy - 1.4); ctx.moveTo(hdx + 4, hdy - 1); ctx.lineTo(hdx + 6, hdy - 1); ctx.stroke();
  }

  // ── near arm: knuckle-drag at rest, big anticipation + swipe on attack ──
  const shX = 4.2;
  if (clawing || (pounce >= 0 && pounce < 0.95)) {
    // windup: claw coils up behind the head, then whips down through the target
    const pr = pounce >= 0 ? clamp01(pounce * 1.7) : p;
    const wind = clamp01(pr / 0.32), strike = clamp01((pr - 0.32) / 0.34);
    const a = strike <= 0 ? mix(0.9, -2.5, wind) : mix(-2.5, 0.75, 1 - (1 - strike) ** 2);
    const r = strike > 0 ? 12.5 : 10;
    const hx3 = shX + Math.cos(a) * r, hy3 = shY + Math.sin(a) * r;
    limb(shX, shY, hx3, hy3, 6.5, 8, 1, 2.6, 2.1, body);
    claws(hx3, hy3, a + 0.35, 3.6, hornCol);
    // ember smear following the slash
    if (strike > 0.15 && strike < 1) {
      const sm = Math.sin(strike * Math.PI);
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = sm * 0.8;
      ctx.strokeStyle = ember; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(shX + 1, shY, 12.5, -2.4, mix(-2.2, 0.8, strike)); ctx.stroke();
      ctx.globalAlpha = sm * 0.4; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(shX + 1, shY, 15.5, -2.3, mix(-2.15, 0.7, strike)); ctx.stroke();
      ctx.restore();
    }
  } else if (scrambling) {
    const nArmSc = Math.sin(T * 6 + climbSeed + Math.PI);
    const nx = 8 + nArmSc * 3.5, ny = groundY - 28 - bob - Math.max(0, nArmSc) * 5;
    limb(shX, shY, nx, ny, 6.5, 8, -1, 2.6, 2.1, body);
    claws(nx, ny, -1.4, 3, hornCol);
  } else if (climbing) {
    const nArmBob = Math.sin(T * 2.5 + climbSeed + 2.4) * 2;
    limb(shX, shY, 8 + nArmBob, groundY - 28 - bob, 6.5, 8, -1, 2.6, 2.1, body);
    claws(8 + nArmBob, groundY - 28 - bob, -1.4, 3, hornCol);
  } else if (airborne) {
    limb(shX, shY, 13.5, shY - 2, 6.5, 8, 1, 2.6, 2.1, body);
    claws(13.5, shY - 2, 0.2, 3.4, hornCol);
  } else {
    // idle/run: long arm hangs, knuckles brushing the dirt
    const hx3 = 8.5 + Math.cos(ph) * 2.5 * run, hy3 = groundY - 5.5 - bob * 0.5;
    limb(shX, shY, hx3, hy3, 6.5, 8, 1, 2.6, 2.1, body);
    claws(hx3, hy3, 1.15, 3, hornCol);
  }

  ctx.restore(); // torso/limb pose

  // stray embers drifting off the hide
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5 * (1 - dp);
  ctx.fillStyle = hot;
  for (let k = 0; k < 3; k++) {
    const ex = -3 + k * 4 + Math.sin(T * 5 + k) * 1.2;
    const ey = groundY - 18 - bob + Math.cos(T * 6 + k) * 4;
    ctx.beginPath(); ctx.arc(ex, ey, 0.9, 0, TAU); ctx.fill();
  }
  ctx.restore();

  if (pounce >= 0) ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Flying fire imp: pot-bellied bat-devil. Asymmetric wingbeat with membrane
// lag, whole-body banking from real velocity, a fireball windup (rears back,
// jaw hinges open, maw glow builds) and a recoil kick + smoke when it fires.
// ─────────────────────────────────────────────────────────────────────────────
export function drawFireImp(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = e.dying ? clamp01(e.deathT / (e.deathDuration || 0.5)) : 0;
  motion(e);
  const lean = e._sprLean || 0;

  const body = flash ? "#fff" : "#9b2418";
  const darkRed = flash ? "#fff" : "#431018";
  const belly = flash ? "#fff" : "#c4502a";
  const bone = flash ? "#fff" : "#2c0a10";
  const ember = "#ff6a20";
  const hot = "#ffd060";

  const y = groundY - t.w * 0.62;
  // fireball windup reads from the AI's shoot clock; recoil from attackAnim
  const cd = e.shootCd;
  const wind = !e.dying && cd !== undefined && cd > 0 && cd < 0.8 ? 1 - cd / 0.8 : 0;
  const recoil = e.dying ? 0 : clamp01((e.attackAnim || 0) / 0.38);

  // faint ground shadow far below
  if (!e.dying) {
    ctx.save(); ctx.globalAlpha = 0.1;
    ctx.fillStyle = "#0c0406";
    ctx.beginPath(); ctx.ellipse(0, groundY - (e.fy || 0) - 1, 10, 2.4, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // heat aura
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (0.2 + 0.13 * Math.sin(T * 9 + e.x)) * (1 - dp);
  const aura = ctx.createRadialGradient(0, y, 2, 0, y, 34);
  aura.addColorStop(0, "rgba(255,180,55,0.6)");
  aura.addColorStop(0.55, "rgba(255,70,15,0.25)");
  aura.addColorStop(1, "rgba(120,0,0,0)");
  ctx.fillStyle = aura; ctx.beginPath(); ctx.ellipse(0, y, 28, 22, 0, 0, TAU); ctx.fill();
  ctx.restore();

  // asymmetric wingbeat: snappy downstroke, floaty upstroke; goes limp in death
  const ph = e.anim * 5 + e.x * 0.01;
  const raw = Math.sin(ph);
  let wb = Math.sign(raw) * Math.pow(Math.abs(raw), raw > 0 ? 1.35 : 0.7);
  wb = wb * (1 - dp) + Math.sin(T * 40) * wind * 0.06;
  const lag = Math.cos(ph) * 2.4 * (1 - dp); // membrane trails a beat behind the bone

  // whole-body attitude: bank into travel, rear back on windup, kick on recoil
  const pitch = lean * 0.16 + Math.sin(T * 2.1 + e.x * 0.05) * 0.05 - wind * 0.26 - recoil * 0.2;
  ctx.save();
  ctx.translate(-recoil * 3.5, y + dp * 6); ctx.rotate(pitch); ctx.translate(0, -y);

  // one bat wing, swept up and back; near = the wing on the viewer's side
  const wing = (near) => {
    const s = near ? 1 : 0.86;
    const dpDroop = dp * 12;
    const ax = near ? -0.5 : -3, ay = y - 5 + (near ? 0 : 2.5);
    const fl = wb * (near ? 9.5 : 8);
    const ex = ax - 4.5 * s, ey = ay - 6.5 * s - fl * 0.45;
    const wx = ax - 12 * s, wy = ay - 9 * s - fl + dpDroop * 0.4;
    const tx = ax - 25 * s, ty = ay - 4 * s - fl * 1.75 + lag * 0.5 + dpDroop;
    const f1x = ax - 22 * s, f1y = ay + 3.5 * s - fl * 1.05 + lag * 0.8 + dpDroop;
    const f2x = ax - 15 * s, f2y = ay + 9.5 * s - fl * 0.5 + lag * 1.1 + dpDroop * 0.7;
    const rx = ax - 5 * s, ry = ay + 8 * s;
    ctx.save();
    if (!near) ctx.globalAlpha = 0.8;
    // membrane with scalloped, sagging trailing edge
    ctx.fillStyle = near ? darkRed : (flash ? "#fff" : "#310b12");
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(ex, ey, wx, wy);
    ctx.quadraticCurveTo((wx + tx) / 2 + 2, (wy + ty) / 2 - 2.5, tx, ty);
    ctx.quadraticCurveTo((tx + f1x) / 2 + 2.5, (ty + f1y) / 2 + 3, f1x, f1y);
    ctx.quadraticCurveTo((f1x + f2x) / 2 + 2.5, (f1y + f2y) / 2 + 3.5, f2x, f2y);
    ctx.quadraticCurveTo((f2x + rx) / 2 + 2, (f2y + ry) / 2 + 3, rx, ry);
    ctx.closePath(); ctx.fill();
    // arm + finger bones
    ctx.strokeStyle = bone; ctx.lineCap = "round";
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(ex, ey, wx, wy); ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(f1x, f1y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(f2x, f2y); ctx.stroke();
    // thumb claw at the wrist
    ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + 2.4, wy - 2.6); ctx.stroke();
    ctx.lineCap = "butt";
    // firelight veining through the membrane
    if (near) {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (0.3 + 0.12 * Math.sin(T * 8)) * (1 - dp);
      ctx.strokeStyle = ember; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(ax - 3, ay + 1); ctx.quadraticCurveTo((ax + tx) / 2, (ay + ty) / 2 + 3, tx + 4, ty + 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax - 3, ay + 3); ctx.quadraticCurveTo((ax + f1x) / 2, (ay + f1y) / 2 + 3, f1x + 3, f1y + 1); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  };
  wing(false);

  // barbed tail: travelling wave, stiffens straight back to counterweight a shot
  {
    const stiff = Math.max(wind, recoil * 0.6);
    const N = 6;
    let px2 = -6, py2 = y + 6;
    ctx.strokeStyle = darkRed; ctx.lineCap = "round";
    let lx = px2, ly = py2;
    for (let i = 1; i <= N; i++) {
      const u = i / N;
      const wave = Math.sin(T * 7 - u * 3.6) * 3.2 * u * (1 - stiff * 0.8) * (1 - dp * 0.7);
      const nx = -6 - u * 17 - stiff * u * 3;
      const ny = y + 6 + u * (7 - stiff * 9) - u * u * 9 + wave + dp * 10 * u;
      ctx.lineWidth = 2.6 - u * 1.7;
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(nx, ny); ctx.stroke();
      lx = nx; ly = ny;
    }
    ctx.lineCap = "butt";
    ctx.fillStyle = darkRed;
    ctx.beginPath(); ctx.moveTo(lx + 2.6, ly - 2); ctx.lineTo(lx - 3.4, ly - 0.6); ctx.lineTo(lx + 1.8, ly + 2.6); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.8 * (1 - dp);
    ctx.fillStyle = ember;
    ctx.beginPath(); ctx.ellipse(lx - 1, ly - 2.5, 2.2, 4.6 + Math.sin(T * 13) * 1.3, 0.35, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff8d0"; ctx.globalAlpha = 0.7 * (1 - dp);
    ctx.beginPath(); ctx.ellipse(lx - 1, ly - 2, 0.9, 2, 0.35, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // dangling digitigrade legs, kicking with each wingbeat
  for (const side of [1, 0]) {
    const col = side ? (flash ? "#fff" : "#6e1812") : body;
    const kick = Math.sin(ph - 0.9 + side * 0.7) * 2 * (1 - dp);
    const fx = 1 + side * 2.5 + kick * 0.5, fy2 = y + 17.5 + side + kick + dp * 3;
    limb(-1 + side * 2, y + 9 + side * 0.5, fx, fy2, 5, 5.5, -1, side ? 1.7 : 2, side ? 1.4 : 1.7, col);
    claws(fx, fy2, 1.35, 2.4, bone);
  }

  // pot-bellied body with a glowing furnace chest
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, y + 5, 9, 10, -0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = belly;
  ctx.beginPath(); ctx.ellipse(3, y + 5.5, 4.8, 6.8, -0.15, 0, TAU); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = (0.4 + 0.2 * Math.sin(T * 5 + e.x) + wind * 0.45 + recoil * 0.25) * (1 - dp);
  const chest = ctx.createRadialGradient(3, y + 4, 1, 3, y + 4, 7.5);
  chest.addColorStop(0, "rgba(255,220,110,0.9)"); chest.addColorStop(1, "rgba(200,40,0,0)");
  ctx.fillStyle = chest; ctx.beginPath(); ctx.arc(3, y + 4, 7.5, 0, TAU); ctx.fill();
  ctx.restore();
  // scale ridges on the back
  ctx.strokeStyle = flash ? "#fff" : "#6e1812"; ctx.lineWidth = 0.9;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath(); ctx.arc(-2.5, y + 3 + k * 3.4, 5.5, Math.PI * 0.7, Math.PI * 1.35); ctx.stroke();
  }
  // belly seams glowing with the furnace
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (0.3 + wind * 0.3) * (1 - dp);
  ctx.strokeStyle = ember; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(0.5, y + 1); ctx.lineTo(3.5, y + 4); ctx.lineTo(1.5, y + 8); ctx.stroke();
  ctx.restore();

  // grasping little arms: tucked at rest, spread wide during the windup
  {
    const spread = Math.max(wind, recoil * 0.5);
    const hxA = mix(12, 7, spread), hyA = mix(y + 3, y - 3, spread);
    limb(4.5, y, hxA, hyA, 5, 6, 1, 2, 1.7, body);
    claws(hxA, hyA, mix(0.9, -0.5, spread), 2.6, bone);
    const hxB = mix(7, 2, spread), hyB = mix(y + 8, y + 2, spread);
    limb(-2, y + 2, hxB, hyB, 5, 6, 1, 2, 1.7, flash ? "#fff" : "#7a1c14");
    claws(hxB, hyB, mix(1.1, -0.3, spread), 2.4, bone);
  }

  // ── head: rears back while charging, snaps forward on release ──
  const hdx = 6 + wind * 1.5 - recoil * 2, hdy = y - 6.5 - wind * 2;
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(hdx, hdy, 7.6, 0, TAU); ctx.fill();
  // swept horns with glowing tips
  ctx.strokeStyle = darkRed; ctx.lineCap = "round";
  ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(hdx - 2.5, hdy - 6); ctx.quadraticCurveTo(hdx - 5.5, hdy - 11.5, hdx - 10.5, hdy - 12.5); ctx.stroke();
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(hdx + 3, hdy - 6.6); ctx.quadraticCurveTo(hdx + 4.6, hdy - 12, hdx + 7.5, hdy - 14); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.55 * (1 - dp);
  ctx.fillStyle = ember;
  ctx.beginPath(); ctx.arc(hdx - 10.5, hdy - 12.5, 1, 0, TAU); ctx.arc(hdx + 7.5, hdy - 14, 0.9, 0, TAU); ctx.fill();
  ctx.restore();
  // flame crest flickering between the horns, flaring with the charge
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (0.7 + wind * 0.3) * (1 - dp);
  ctx.fillStyle = ember;
  ctx.beginPath(); ctx.ellipse(hdx - 1, hdy - 10 - Math.abs(Math.sin(T * 11)) * 2, 2.5, 4.4 + Math.sin(T * 11) * 1.3 + wind * 2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = hot;
  ctx.beginPath(); ctx.ellipse(hdx - 1, hdy - 9.5, 1.1, 2.2 + wind, 0, 0, TAU); ctx.fill();
  ctx.restore();
  // pointed ear
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.moveTo(hdx - 5.5, hdy - 2); ctx.lineTo(hdx - 13, hdy - 5 - wind * 2); ctx.lineTo(hdx - 6, hdy + 1.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = darkRed; ctx.globalAlpha = flash ? 1 : 0.5;
  ctx.beginPath(); ctx.moveTo(hdx - 6.5, hdy - 2); ctx.lineTo(hdx - 11.5, hdy - 4.2 - wind * 1.6); ctx.lineTo(hdx - 6.8, hdy + 0.6); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;

  // eyes flare white-hot as the shot charges
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (0.7 + dark * 0.25 + wind * 0.3) * (1 - dp);
  ctx.fillStyle = hot;
  ctx.beginPath(); ctx.arc(hdx + 2, hdy - 1.5, 2.4 + wind * 0.8, 0, TAU); ctx.arc(hdx + 6.4, hdy - 1, 2 + wind * 0.7, 0, TAU); ctx.fill();
  if (wind > 0.5) {
    ctx.fillStyle = "#fff6d8"; ctx.globalAlpha = (wind - 0.5) * 2 * 0.8;
    ctx.beginPath(); ctx.arc(hdx + 2, hdy - 1.5, 1, 0, TAU); ctx.arc(hdx + 6.4, hdy - 1, 0.9, 0, TAU); ctx.fill();
  }
  ctx.restore();
  if (!e.dying) {
    ctx.fillStyle = hot;
    ctx.beginPath(); ctx.arc(hdx + 2, hdy - 1.5, 1.1, 0, TAU); ctx.arc(hdx + 6.4, hdy - 1, 0.95, 0, TAU); ctx.fill();
  }

  // muzzle + hinged jaw: gapes open with the windup, slams shut on release
  const jawA = e.dying ? 0.55 : wind * 0.85 + recoil * 0.25 + 0.08 + 0.05 * Math.sin(T * 2.4 + e.x);
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.moveTo(hdx + 4, hdy - 0.5);
  ctx.quadraticCurveTo(hdx + 11, hdy + 0.2, hdx + 11.6, hdy + 2.6);
  ctx.lineTo(hdx + 4, hdy + 3.4); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.translate(hdx + 4.4, hdy + 3.2); ctx.rotate(jawA);
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(3.6, 1.4, 6.6, 0.6); ctx.lineTo(5.8, 2.4); ctx.quadraticCurveTo(2, 3.2, 0, 1.8); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = flash ? "#fff" : "#f0e0c0"; ctx.lineWidth = 0.85; ctx.lineCap = "round";
  for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.moveTo(1.6 + k * 2.2, 0.8); ctx.lineTo(2 + k * 2.2, -0.8); ctx.stroke(); }
  ctx.lineCap = "butt";
  ctx.restore();
  if (jawA > 0.18) {
    ctx.fillStyle = flash ? "#fff" : "#28070a";
    ctx.beginPath(); ctx.moveTo(hdx + 4.4, hdy + 2.4);
    ctx.quadraticCurveTo(hdx + 8.5, hdy + 2.4 + jawA * 5, hdx + 11.4, hdy + 2);
    ctx.quadraticCurveTo(hdx + 8, hdy + 1.4, hdx + 4.4, hdy + 2.4); ctx.fill();
  }

  // maw glow: builds through the windup, flashes and dies as the ball leaves
  const maw = Math.max(wind, recoil * recoil);
  if (maw > 0.05) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = maw;
    const mg = ctx.createRadialGradient(hdx + 13, hdy + 2, 1, hdx + 13, hdy + 2, 4 + wind * 9 + recoil * 5);
    mg.addColorStop(0, "rgba(255,245,150,1)");
    mg.addColorStop(0.5, "rgba(255,90,20,0.75)");
    mg.addColorStop(1, "rgba(180,20,0,0)");
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(hdx + 13, hdy + 2, 4 + wind * 9 + recoil * 5, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // smoke puffs curling off the maw after firing
  if (recoil > 0 && recoil < 0.9) {
    ctx.save(); ctx.globalAlpha = recoil * 0.5;
    ctx.fillStyle = "#2a1512";
    for (let k = 0; k < 3; k++) {
      const su = (1 - recoil) + k * 0.14;
      ctx.beginPath(); ctx.arc(hdx + 12 + su * 9, hdy + 1 - su * 7 + Math.sin(T * 6 + k) * 1.5, 1.4 + su * 2.4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  wing(true);
  ctx.restore(); // body attitude

  // embers drifting off the body
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.55 * (1 - dp);
  ctx.fillStyle = hot;
  for (let k = 0; k < 3; k++) {
    const et = (T * 0.8 + k * 0.37 + e.x * 0.01) % 1;
    ctx.beginPath(); ctx.arc(-6 + Math.sin((T + k) * 5) * 5 + k * 5, y + 8 - et * 26, 1.2 * (1 - et) + 0.3, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
