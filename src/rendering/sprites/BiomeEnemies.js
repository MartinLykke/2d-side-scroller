// Biome enemy sprite renderers. One export per biome enemy type; each draws in
// entity-local space (origin at the enemy's x, ground at groundY, facing +x —
// drawEnemies mirrors the canvas for dir < 0). Death ragdoll rotation, the fy
// fly-height translation and stack offsets are applied by the caller before
// these run, so the renderers only add their own idle/attack animation on top.
//
// Shared animation state read off the entity:
//   e.anim        gait phase          e.flash    hit-flash (white)
//   e.attackAnim  >0 during a swing    e.dying    death (deathT/deathDuration)
//   e.arrowArmor  masked-greed mask hp e.carry    stolen gold (>0)
//   e.spawnCd     breeder/weaver timer e.w        murk-abomination growth
//   e.burrowedWall/burrowT             e.goldEatCd
import { ctx, groundY } from '../../core/canvas.js';
import { gait, attackPose, ease } from './EnemyRig.js';

const TAU = Math.PI * 2;
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, u) => a + (b - a) * u;
const smooth = v => { v = clamp01(v); return v * v * (3 - 2 * v); };
const col = (flash, c) => (flash ? "#fff" : c);

function deathP(e) { return e.dying ? clamp01(e.deathT / (e.deathDuration || 0.5)) : 0; }

function contactShadow(r, alpha = 0.2, y = groundY - 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#0a0a0c";
  ctx.beginPath(); ctx.ellipse(0, y, r, r * 0.24, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

// Cooldown-driven anticipation for casters. The actual release/recoil still
// comes from attackPose(), so a shot has the same decisive impact timing as a
// ground swipe. `cd` is the AI countdown that reaches zero at release.
function cooldownCharge(cd, window = 0.85) {
  return cd != null && cd > 0 && cd < window ? ease(1 - cd / window) : 0;
}

function castMotion(e, cd, window = 0.85) {
  const A = attackPose(e);
  const wind = Math.max(A.winding ? A.wind : 0, cooldownCharge(cd, window));
  // attackAnim starts on release, so recoil must be strongest at p=0 and then
  // settle; attackPose.ext is intentionally impact-late for physical strikes.
  const recoil = A.striking ? 1 - ease(Math.max(0, A.p)) : 0;
  const release = A.striking ? clamp01(1 - A.p / 0.36) : 0;
  return { A, wind, recoil, release };
}

// Shared flying-imp language: asymmetric downstroke, membrane/robe lag, hover
// bob and a bank derived from real update-loop velocity rather than draw calls.
function flightMotion(e, T, wingRate = 4.5, cd = null, castWindow = 0.85) {
  const g = gait(e);
  const C = castMotion(e, cd, castWindow);
  const ph = g.phase * wingRate + e.x * 0.01;
  const raw = Math.sin(ph);
  const wing = Math.sign(raw) * Math.pow(Math.abs(raw), raw > 0 ? 1.35 : 0.7);
  const lag = Math.cos(ph - 0.45);
  const hover = Math.sin(T * 2.05 + e.x * 0.055) * (2.2 + (1 - g.run) * 1.8);
  const bank = g.lean * 0.17 - C.wind * 0.2 - C.recoil * 0.16;
  return { ...g, ...C, ph, wing, lag, hover, bank };
}

// Two-bone IK middle joint for a limb spanning (x1,y1)→(x2,y2).
function joint(x1, y1, x2, y2, l1, l2, bend) {
  const dx = x2 - x1, dy = y2 - y1;
  const d = Math.hypot(dx, dy) || 0.0001;
  const md = Math.min(d, (l1 + l2) * 0.999);
  const a = (l1 * l1 - l2 * l2 + md * md) / (2 * md);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { x: x1 + (dx / d) * a - (dy / d) * h * bend, y: y1 + (dy / d) * a + (dx / d) * h * bend };
}
function limb(x1, y1, x2, y2, l1, l2, bend, w1, w2, color) {
  const j = joint(x1, y1, x2, y2, l1, l2, bend);
  ctx.strokeStyle = color; ctx.lineCap = "round";
  ctx.lineWidth = w1; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(j.x, j.y); ctx.stroke();
  ctx.lineWidth = w2; ctx.beginPath(); ctx.moveTo(j.x, j.y); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.lineCap = "butt";
  return j;
}
function claws(x, y, ang, len, color, w = 1.1) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = "round";
  for (let k = -1; k <= 1; k++) {
    const a = ang + k * 0.38;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.6, y + Math.sin(a) * len * 0.6,
      x + Math.cos(a + 0.3) * len, y + Math.sin(a + 0.3) * len);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}
function poly(pts) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}
// Additive glow blob.
function glow(x, y, r, c0, c1, alpha) {
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x, y, 0.5, x, y, r);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════
// FOREST
// ═══════════════════════════════════════════════════════════════════════════

// Greedlet — small, fast, hunched thief. Big grabby hands, a satchel on its
// hip, beady eyes. Snatches dropped gold (e.carry) and scurries. When carrying
// loot a coin glints in its clutched hands and its eyes go greedy-wide.
export function drawGreedlet(e, t, dark) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = deathP(e);
  const g = gait(e), run = g.run, lean = g.lean;
  const A = attackPose(e);
  const reach = A.ext;                              // −0.4 coil → 1 snatch → 0 settle
  const carrying = (e.carry || 0) > 0;

  const hide = col(flash, "#5f2f1a");
  const hideDk = col(flash, "#3a1c10");
  const belly = col(flash, "#8a6a3c");
  const ear = col(flash, "#4a2414");

  const ph = (e.anim || 0) * 3.4;
  const step = Math.sin(ph);
  const plant = Math.pow(Math.abs(step), 3);        // sharp dip as each foot lands
  // weight: bob from foot-plant when scurrying, a slow breath when still, a
  // crouch as it winds up to pounce on loot, and a little pop on the snatch.
  const bob = plant * 2.4 * (0.35 + run)
            + Math.sin(T * 3 + e.x) * 0.4 * (1 - run)
            - A.wind * 3.2
            + Math.max(0, reach) * 1.4;
  // spine: hunches forward when moving, rears back to wind up, lunges on impact
  const spine = lean * 0.16 - A.wind * 0.24 + Math.max(0, reach) * 0.15;

  contactShadow(9, (0.2 - dp * 0.12) * (1 - Math.max(0, reach) * 0.25));

  const hipY = groundY - 8 - bob;
  const shY = groundY - 15 - bob;

  // Whip tail gives the tiny silhouette the same readable secondary motion as
  // the ground imp. It lags the run, stiffens during the snatch, and ends in a
  // leaf-shaped barb that identifies the forest strain at a glance.
  {
    const stiff = Math.max(A.wind, A.swing * 0.7);
    let px = -4, py = hipY - 1;
    ctx.strokeStyle = hideDk; ctx.lineCap = "round";
    for (let k = 1; k <= 5; k++) {
      const u = k / 5;
      const nx = -4 - u * 13 - stiff * u * 2;
      const ny = hipY - 1 + u * 5 - u * u * 5 + Math.sin(ph - u * 3.2) * 2.8 * u * (1 - stiff);
      ctx.lineWidth = 2.2 - u * 1.1;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
      px = nx; py = ny;
    }
    ctx.lineCap = "butt"; ctx.fillStyle = ear;
    ctx.save(); ctx.translate(px, py); ctx.rotate(-0.25 + Math.sin(ph - 2.7) * 0.15);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-3.8, -3.2, -6, -0.4); ctx.quadraticCurveTo(-3.3, 3, 0, 1); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  // ── legs: digitigrade scramble; planted foot shoves back, swing foot lifts ──
  for (const side of [1, 0]) {
    const phs = ph + side * Math.PI;
    const sw = Math.sin(phs);
    const lift = Math.max(0, -sw) * 3.6 * (0.35 + run);
    const push = sw * 4.6 * (0.3 + run);             // planted foot travels backward
    const fx = -1 + push + (side ? -2 : 2);
    const col1 = side ? hideDk : hide;
    limb(-2 + side * 2, hipY, fx, groundY - lift, 4.6, 5, 1, side ? 1.9 : 2.3, side ? 1.5 : 1.9, col1);
    // little clawed foot, toes point the way it's heading
    ctx.strokeStyle = col1; ctx.lineWidth = 1.4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(fx, groundY - lift); ctx.lineTo(fx + 2.8, groundY - lift + 0.3); ctx.stroke();
    ctx.lineCap = "butt";
  }

  // ── far arm (behind the body): the grabbing hand — cocks high, then snatches
  //    far forward with a wide clutch. This is the greedlet's signature gesture. ──
  {
    const fhx = 5 + reach * 13 + Math.cos(ph + Math.PI) * 1.3 * run;
    const fhy = groundY - 8 - bob + (reach < 0 ? reach * 4 : Math.max(0, reach) * 2.5);
    limb(2, shY, fhx, fhy, 4.6, 5.4, 1, 2, 1.6, hideDk);
    // claws splay wide while cocked, snap into a tight clutch at the grab
    const clawLen = 2.4 + (reach < 0 ? -reach * 1.4 : 0) + Math.max(0, reach) * 0.6;
    claws(fhx, fhy, 0.9 - Math.max(0, reach) * 0.7, clawLen, hideDk, 1.1);
  }

  // ── body: pot-bellied hunch, flexes on the spine pivot ──
  ctx.save();
  ctx.translate(-1, hipY); ctx.rotate(spine); ctx.translate(1, -hipY);

  // satchel rides the far hip, swings against the lean, bulges when loot-heavy
  const sack = carrying ? 3.4 : 2.4;
  const sackSwing = -lean * 1.4 - Math.max(0, reach) * 1.2;
  ctx.fillStyle = col(flash, "#4a3a24");
  ctx.beginPath(); ctx.ellipse(-5 + sackSwing, groundY - 6.5 - bob, sack, sack + 1, 0.2, 0, TAU); ctx.fill();
  ctx.strokeStyle = col(flash, "#2e2416"); ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-6.5, groundY - 15 - bob); ctx.lineTo(-4 + sackSwing, groundY - 8.5 - bob); ctx.stroke();

  // torso — belly squashes a touch on each foot-plant so it reads soft and heavy
  const squash = 1 + plant * 0.12 * run;
  ctx.fillStyle = hide;
  ctx.beginPath(); ctx.ellipse(0, groundY - 11 - bob, 7.4, 8 * squash, -0.28, 0, TAU); ctx.fill();
  ctx.fillStyle = hideDk; ctx.globalAlpha = flash ? 1 : 0.5;
  ctx.beginPath(); ctx.ellipse(-3, groundY - 13.5 - bob, 4.6, 5.4, -0.5, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = belly;
  ctx.beginPath(); ctx.ellipse(2.4, groundY - 9 - bob, 4, 5.2 * squash, -0.2, 0, TAU); ctx.fill();
  // Ragged crossed straps and a bright brass clasp break up the flat torso.
  ctx.strokeStyle = col(flash, "#2b180e"); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-3, groundY - 16 - bob); ctx.lineTo(3.5, groundY - 6 - bob); ctx.stroke();
  ctx.fillStyle = col(flash, "#c49a45"); ctx.beginPath(); ctx.arc(1.4, groundY - 10.2 - bob, 1, 0, TAU); ctx.fill();

  // ── head: snout thrusts on the snatch; big ears flop with real lag ──
  const hdx = 6.5 + lean * 1.2 + Math.max(0, reach) * 2.6, hdy = groundY - 19 - bob * 0.8;
  ctx.strokeStyle = hide; ctx.lineWidth = 3.4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(2, groundY - 16 - bob); ctx.lineTo(hdx - 2, hdy + 2); ctx.stroke();
  ctx.lineCap = "butt";
  // ears — bounce a beat behind the body bob (secondary motion); pin on wind-up,
  // flick forward on the grab, jitter greedily when clutching loot
  const earLag = Math.sin(ph - 0.7) * (0.14 + run * 0.4);
  const earBase = -0.15 + earLag - A.wind * 0.5 + Math.max(0, reach) * 0.35
                + (carrying ? Math.sin(T * 18 + e.x) * 0.06 : 0);
  for (const s of [-1, 1]) {
    ctx.fillStyle = ear;
    ctx.save(); ctx.translate(hdx - 2, hdy - 3); ctx.rotate(earBase + s * 0.5);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-7, -2, -9 - s, 2);
    ctx.quadraticCurveTo(-4, 1, 0, 3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = hide;
  ctx.beginPath(); ctx.arc(hdx, hdy, 5, 0, TAU); ctx.fill();
  // snout
  ctx.beginPath(); ctx.moveTo(hdx + 1, hdy - 1.5);
  ctx.quadraticCurveTo(hdx + 7, hdy - 0.5, hdx + 7.5, hdy + 1.6);
  ctx.lineTo(hdx + 1.5, hdy + 2.8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = hideDk;
  ctx.beginPath(); ctx.arc(hdx + 7, hdy + 1, 0.9, 0, TAU); ctx.fill();
  // eyes — greedy-wide when loot is in hand or a snatch is landing
  const eyeR = carrying || reach > 0.5 ? 1.9 : 1.4;
  glow(hdx + 2.5, hdy - 1.5, eyeR + 1.5, e.eye || t.eye || "#ffd060", "rgba(255,208,96,0)", (0.4 + 0.3 * dark) * (1 - dp));
  ctx.fillStyle = col(flash, t.eye || "#ffd060");
  ctx.beginPath(); ctx.arc(hdx + 2.4, hdy - 1.5, eyeR, 0, TAU); ctx.arc(hdx + 5, hdy - 1, eyeR * 0.85, 0, TAU); ctx.fill();
  if (!e.dying) { ctx.fillStyle = "#2a1000"; ctx.beginPath(); ctx.arc(hdx + 2.6, hdy - 1.4, 0.6, 0, TAU); ctx.arc(hdx + 5.1, hdy - 0.9, 0.55, 0, TAU); ctx.fill(); }

  // ── near arm: clutches a stolen coin, or joins the two-clawed snatch ──
  const nhx = 7 + reach * 9 + (carrying ? 0 : Math.cos(ph) * 1.1 * run);
  const nhy = groundY - 8 - bob - (carrying ? 3 : 0) + Math.max(0, reach) * 2.5;
  limb(3, shY, nhx, nhy, 4.5, 5, -1, 2, 1.6, hide);
  claws(nhx, nhy, carrying ? -1.4 : 0.9 - Math.max(0, reach) * 0.5, 2.4, hideDk, 1);
  // a little dust flick where the claws snap shut on impact
  if (A.hit > 0.35 && !carrying && !e.dying) {
    ctx.save(); ctx.globalAlpha = (A.hit - 0.35) * 0.9;
    ctx.strokeStyle = "rgba(210,190,150,0.8)"; ctx.lineWidth = 1;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(nhx + 2, nhy + k * 2);
      ctx.lineTo(nhx + 5 + A.hit * 3, nhy + k * 3.5);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (carrying) {
    glow(nhx, nhy - 1, 4, "#ffe89a", "rgba(255,180,40,0)", 0.6 * (1 - dp));
    ctx.fillStyle = "#ffd45a"; ctx.beginPath(); ctx.arc(nhx, nhy - 1, 2, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff3c0"; ctx.beginPath(); ctx.arc(nhx - 0.5, nhy - 1.6, 0.7, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// Masked Greed — bulky forest warrior behind a thick carved bark mask that
// eats the first arrows (e.arrowArmor 3→0). The mask visibly cracks and finally
// splits off; only then does the raw face show. Hefts a crude club.
export function drawMaskedGreed(e, t, dark) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = deathP(e);
  const g = gait(e), run = g.run, lean = g.lean;
  const A = attackPose(e);
  const raise = A.raise;                       // 1 = club loaded overhead, 0 = slammed
  const lunge = A.striking ? 1 - raise : 0;    // pitches in as the club drives down

  const hide = col(flash, "#4b2f20");
  const hideDk = col(flash, "#2e1c12");
  const bark = col(flash, "#7a5a34");
  const barkDk = col(flash, "#4e3a20");
  const barkHi = col(flash, "#9a774a");

  const armor = e.arrowArmor ?? t.arrowArmor ?? 3;  // 3 pristine .. 0 gone
  const cracks = Math.max(0, 3 - armor);              // 0..3 crack stages
  const maskGone = armor <= 0;

  const ph = (e.anim || 0) * 2.4;
  const step = Math.sin(ph);
  const plant = Math.pow(Math.abs(step), 3);          // heavy dip as a boot lands
  const bob = plant * 2.1 * (0.35 + run)
            + Math.sin(T * 1.7 + e.x) * 0.5 * (1 - run)
            - A.wind * 1.6                            // braces down hoisting the club
            + A.hit * 1.8;                            // jolts on impact
  // torso coils back to load the swing, then whips forward through the slam
  const torsoTip = lean * 0.1 - A.wind * 0.18 + lunge * 0.24;

  contactShadow(13, 0.22 - dp * 0.12);

  // impact shock: dust and a crack where the club lands in front
  if (A.hit > 0.4 && !e.dying) {
    ctx.save(); ctx.globalAlpha = (A.hit - 0.4) * 1.1;
    ctx.strokeStyle = "rgba(180,150,110,0.7)"; ctx.lineWidth = 1.4; ctx.lineCap = "round";
    for (let k = 0; k < 4; k++) { const a = -0.3 + k * 0.35; ctx.beginPath(); ctx.moveTo(15, groundY - 1); ctx.lineTo(15 + Math.cos(a) * 8, groundY - 1 - Math.sin(a) * 7); ctx.stroke(); }
    ctx.lineCap = "butt"; ctx.restore();
  }

  // heavy plodding legs — planted boot shoves back, swing boot lifts off the mud
  const hipY = groundY - 13 - bob;
  for (const side of [1, 0]) {
    const phs = ph + side * Math.PI;
    const sw = Math.sin(phs);
    const lift = Math.max(0, -sw) * 3.2 * (0.3 + run);
    const push = sw * 4 * (0.3 + run);
    const fx = -2 + side * 6 + push;
    const legC = side ? hideDk : hide;
    limb(-4 + side * 6, hipY, fx, groundY - lift, 7, 7.5, 1, side ? 3 : 3.6, side ? 2.5 : 3, legC);
    ctx.fillStyle = legC;
    ctx.beginPath(); ctx.ellipse(fx + 1.5, groundY - lift - 0.5, 3.4, 2, 0, 0, TAU); ctx.fill();
  }

  // far arm braces the club shaft
  const shY = groundY - 26 - bob;
  limb(-2, shY, -8, groundY - 16 - bob, 7, 7, 1, 2.8, 2.2, hideDk);

  // torso: broad, muscular
  ctx.save();
  ctx.translate(-1, hipY); ctx.rotate(torsoTip); ctx.translate(1, -hipY);
  ctx.fillStyle = hide;
  poly([[-8, groundY - 13 - bob], [-10, groundY - 26 - bob], [-4, groundY - 31 - bob],
        [8, groundY - 31 - bob], [11, groundY - 24 - bob], [9, groundY - 13 - bob]]);
  ctx.fill();
  ctx.fillStyle = hideDk; ctx.globalAlpha = flash ? 1 : 0.4;
  poly([[-8, groundY - 13 - bob], [-10, groundY - 26 - bob], [-4, groundY - 30 - bob], [-3, groundY - 14 - bob]]);
  ctx.fill(); ctx.globalAlpha = 1;
  // fur tufts on shoulders
  ctx.fillStyle = col(flash, "#3a2414");
  for (let k = 0; k < 4; k++) { const sx = -8 + k * 5; ctx.beginPath(); ctx.moveTo(sx, groundY - 30 - bob); ctx.lineTo(sx + 1, groundY - 34 - bob); ctx.lineTo(sx + 2.5, groundY - 30 - bob); ctx.fill(); }

  // head + mask — ducks forward into the slam
  const hdx = 3 + lean * 1 + lunge * 3, hdy = groundY - 36 - bob + lunge * 2;
  ctx.fillStyle = hide;
  ctx.beginPath(); ctx.arc(hdx, hdy, 6, 0, TAU); ctx.fill();
  if (maskGone) {
    // raw enraged face once the mask is gone
    glow(hdx + 1, hdy - 1, 3.5, t.eye || "#ffcf6a", "rgba(255,200,80,0)", (0.5 + 0.3 * dark) * (1 - dp));
    ctx.fillStyle = col(flash, t.eye || "#ffcf6a");
    ctx.beginPath(); ctx.ellipse(hdx - 1, hdy - 1, 1.6, 1, 0.2, 0, TAU); ctx.ellipse(hdx + 3.5, hdy - 1, 1.6, 1, -0.2, 0, TAU); ctx.fill();
    // bared teeth
    ctx.fillStyle = "#e8dcc0";
    poly([[hdx - 2, hdy + 3], [hdx + 5, hdy + 3], [hdx + 4, hdy + 5], [hdx - 1, hdy + 5]]); ctx.fill();
    ctx.strokeStyle = hideDk; ctx.lineWidth = 0.5;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(hdx - 1 + k * 2, hdy + 3); ctx.lineTo(hdx - 1 + k * 2, hdy + 5); ctx.stroke(); }
    // A split half-mask remains tied to the shoulder so the armor break is a
    // persistent model change, not simply a texture vanishing between frames.
    ctx.strokeStyle = barkDk; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(hdx - 4, hdy + 4); ctx.quadraticCurveTo(-7, shY + 2, -8, shY + 8); ctx.stroke();
    ctx.fillStyle = bark;
    poly([[-11, shY + 5], [-6, shY + 4], [-5, shY + 11], [-9, shY + 14], [-12, shY + 10]]); ctx.fill();
    ctx.strokeStyle = "#120a03"; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-10, shY + 6); ctx.lineTo(-7, shY + 9); ctx.lineTo(-9, shY + 13); ctx.stroke();
  } else {
    // carved bark war-mask: broad, snarling, with knot-eyes
    ctx.fillStyle = bark;
    poly([[hdx - 7, hdy - 2], [hdx - 6, hdy - 8], [hdx + 1, hdy - 9], [hdx + 8, hdy - 6],
          [hdx + 9, hdy + 1], [hdx + 6, hdy + 7], [hdx + 1, hdy + 8], [hdx - 5, hdy + 5]]);
    ctx.fill();
    // wood grain
    ctx.strokeStyle = barkDk; ctx.lineWidth = 0.6;
    for (let k = -1; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(hdx - 6, hdy - 3 + k * 3.2); ctx.quadraticCurveTo(hdx + 1, hdy - 4 + k * 3.2, hdx + 8, hdy - 2 + k * 3.2); ctx.stroke(); }
    ctx.fillStyle = barkHi; ctx.globalAlpha = 0.5;
    poly([[hdx - 6, hdy - 7], [hdx + 1, hdy - 8], [hdx + 2, hdy - 6], [hdx - 5, hdy - 5]]); ctx.fill();
    ctx.globalAlpha = 1;
    // angry hollow eye-knots glowing behind the mask
    glow(hdx - 2, hdy - 1, 2.6, t.eye || "#ffcf6a", "rgba(255,180,40,0)", 0.5 * (1 - dp));
    glow(hdx + 5, hdy - 1, 2.4, t.eye || "#ffcf6a", "rgba(255,180,40,0)", 0.5 * (1 - dp));
    ctx.fillStyle = "#160c04";
    poly([[hdx - 4, hdy - 2], [hdx - 1, hdy - 3], [hdx - 1, hdy - 1], [hdx - 4, hdy]]); ctx.fill();
    poly([[hdx + 3, hdy - 3], [hdx + 6, hdy - 2], [hdx + 6, hdy], [hdx + 3, hdy - 1]]); ctx.fill();
    ctx.fillStyle = col(flash, t.eye || "#ffcf6a");
    ctx.beginPath(); ctx.arc(hdx - 2.5, hdy - 1.6, 0.7, 0, TAU); ctx.arc(hdx + 4.5, hdy - 1.4, 0.7, 0, TAU); ctx.fill();
    // carved snarling mouth with tusks
    ctx.fillStyle = "#140b04";
    poly([[hdx - 3, hdy + 3], [hdx + 6, hdy + 3], [hdx + 4, hdy + 6], [hdx - 1, hdy + 6]]); ctx.fill();
    ctx.fillStyle = barkHi;
    ctx.beginPath(); ctx.moveTo(hdx - 2, hdy + 3.5); ctx.lineTo(hdx - 3, hdy + 6); ctx.lineTo(hdx - 0.5, hdy + 3.5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hdx + 5, hdy + 3.5); ctx.lineTo(hdx + 6, hdy + 6); ctx.lineTo(hdx + 3.5, hdy + 3.5); ctx.fill();
    // damage cracks accumulate as arrows land
    if (cracks > 0) {
      ctx.strokeStyle = "#120a03"; ctx.lineWidth = 0.9; ctx.lineCap = "round";
      if (cracks >= 1) { ctx.beginPath(); ctx.moveTo(hdx + 8, hdy - 5); ctx.lineTo(hdx + 3, hdy - 1); ctx.lineTo(hdx + 5, hdy + 3); ctx.stroke(); }
      if (cracks >= 2) { ctx.beginPath(); ctx.moveTo(hdx - 6, hdy - 6); ctx.lineTo(hdx - 2, hdy + 1); ctx.lineTo(hdx - 4, hdy + 5); ctx.stroke(); }
      if (cracks >= 3) { ctx.beginPath(); ctx.moveTo(hdx + 1, hdy - 9); ctx.lineTo(hdx, hdy + 8); ctx.stroke(); ctx.beginPath(); ctx.moveTo(hdx - 3, hdy); ctx.lineTo(hdx + 5, hdy - 1); ctx.stroke(); }
      ctx.lineCap = "butt";
    }
  }

  // near arm hoists a heavy knotted club: loads high overhead, then a committed
  // overhead smash. `raise` drives the whole arc (loaded → slammed → rebound).
  {
    // idle sway when not attacking; otherwise the arm rides the load/slam
    const a = A.active ? mix(0.7, -2.5, raise) : (0.7 + Math.sin(T * 2 + e.x) * 0.05);
    const r = 12;
    const hx = 5 + Math.cos(a) * r, hy = groundY - 24 - bob + Math.sin(a) * r;
    // motion smear behind a fast downswing (drawn first so the club sits on top)
    const smear = A.striking && raise < 0.5 ? 0.5 - raise : 0;
    if (smear > 0.05) {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = smear * 0.5;
      ctx.strokeStyle = "#8a6a3a"; ctx.lineWidth = 6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(2, groundY - 26 - bob, 24, -2.0, 0.9); ctx.stroke();
      ctx.lineCap = "butt"; ctx.restore();
    }
    limb(4, shY, hx, hy, 7, 8, 1, 3, 2.4, hide);
    // a big knotted warclub — the hero of the attack, so it reads lit and chunky
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(a + 1.2);
    // shaft (lit front face + shaded back edge)
    ctx.fillStyle = bark; ctx.beginPath(); ctx.moveTo(-2.6, 0); ctx.lineTo(2.6, 0); ctx.lineTo(3.6, 17); ctx.lineTo(-3.6, 17); ctx.closePath(); ctx.fill();
    ctx.fillStyle = barkDk; ctx.beginPath(); ctx.moveTo(0.8, 0); ctx.lineTo(2.6, 0); ctx.lineTo(3.6, 17); ctx.lineTo(1.4, 17); ctx.closePath(); ctx.fill();
    // knotted head
    ctx.fillStyle = bark; ctx.beginPath(); ctx.ellipse(0, 19, 6.6, 7.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = barkHi; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.ellipse(-2.3, 16.5, 2.6, 3.2, -0.3, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = "#160c04"; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.ellipse(0, 19, 6.6, 7.6, 0, 0, TAU); ctx.stroke();
    // jutting spikes
    ctx.fillStyle = barkDk;
    for (const [sx, sy, ex, ey] of [[-6, 17, -10, 15], [6, 18, 10, 17], [-2, 26, -3, 30], [4, 25, 7, 28], [-6, 22, -10, 24]]) {
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(sx + 1.5, sy + 2.5); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

// Floater — spectral drifting jelly-ghost that ignores walls and swoops to
// snatch defenders. Translucent bell, trailing tendrils, hollow glowing eyes.
// Carries off a small captive form when e.carry is set.
export function drawFloater(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = deathP(e);
  const w = t.w;
  const F = flightMotion(e, T, 3.7, e.shootCd, 0.85);

  // floats: internal lift so it reads airborne even if fy stays near ground
  const y = groundY - w * 1.0 + F.hover;
  const swoop = F.wind * 0.45 + F.recoil;
  const carrying = (e.carry || 0) > 0;

  const ghost = col(flash, "#8fb0b8");
  const ghostDk = col(flash, "#4a6068");
  const ghostHi = col(flash, "#d7eef0");

  const spectralFin = near => {
    const beat = near ? F.wing : Math.sin(F.ph + 0.62);
    const ax = near ? -w * 0.1 : -w * 0.16, ay = y - w * 0.1 + (near ? 0 : 2);
    const fl = beat * w * (near ? 0.28 : 0.22);
    ctx.save(); ctx.globalAlpha *= near ? 0.72 : 0.42;
    ctx.fillStyle = near ? ghost : ghostDk;
    ctx.beginPath(); ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(ax - w * 0.42, ay - w * 0.34 - fl, ax - w * 0.72, ay - w * 0.08 - fl + F.lag * 2);
    ctx.quadraticCurveTo(ax - w * 0.54, ay + w * 0.04 + F.lag * 2, ax - w * 0.4, ay + w * 0.22);
    ctx.quadraticCurveTo(ax - w * 0.2, ay + w * 0.08, ax, ay + w * 0.12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ghostHi; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - w * 0.68, ay - w * 0.08 - fl + F.lag * 2); ctx.stroke();
    ctx.restore();
  };

  // eerie aura
  glow(0, y, w * 0.9, "rgba(150,200,210,0.5)", "rgba(60,90,100,0)", (0.2 + 0.08 * Math.sin(T * 2)) * (1 - dp));

  ctx.save();
  ctx.globalAlpha = (flash ? 1 : 0.78) * (1 - dp * 0.4);
  ctx.translate(-F.recoil * 4, swoop * 5);
  ctx.rotate(F.bank);

  spectralFin(false);

  // trailing tendrils
  ctx.strokeStyle = ghostDk; ctx.lineCap = "round";
  for (let k = 0; k < 5; k++) {
    const bx = -w * 0.28 + k * (w * 0.14);
    const len = w * (0.5 + (k % 2) * 0.25);
    ctx.lineWidth = 2.4 - k * 0.2;
    ctx.beginPath(); ctx.moveTo(bx, y + 2);
    const wob = Math.sin(T * 3 - k * 0.8) * 3 - F.lean * (4 + k * 0.8);
    ctx.quadraticCurveTo(bx + wob, y + len * 0.6, bx + Math.sin(T * 2.5 - k) * 5, y + len);
    ctx.stroke();
  }
  ctx.lineCap = "butt";

  // captive being carried off
  if (carrying) {
    ctx.save(); ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#3a3550"; ctx.beginPath(); ctx.ellipse(2, y + w * 0.7, 4, 6, 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = "#caa483"; ctx.beginPath(); ctx.arc(2, y + w * 0.55, 2.6, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // translucent bell body
  const squash = 1 + Math.sin(T * 2.4) * 0.06 + F.wind * 0.12 - F.recoil * 0.16;
  ctx.fillStyle = ghost;
  ctx.beginPath(); ctx.ellipse(0, y, w * 0.5, w * 0.5 * squash, 0, Math.PI, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, y, w * 0.5, w * 0.32, 0, 0, Math.PI); ctx.fill();
  // inner shading + rim light
  ctx.fillStyle = ghostDk; ctx.globalAlpha *= 0.5;
  ctx.beginPath(); ctx.ellipse(-w * 0.12, y - w * 0.12, w * 0.26, w * 0.28, -0.3, 0, TAU); ctx.fill();
  ctx.globalAlpha = (flash ? 1 : 0.78) * (1 - dp * 0.4);
  ctx.fillStyle = "rgba(220,240,245,0.5)";
  ctx.beginPath(); ctx.ellipse(w * 0.15, y - w * 0.16, w * 0.14, w * 0.2, 0.2, 0, TAU); ctx.fill();
  // Cartilage ribs and a crowned bell edge keep the translucent mass legible.
  ctx.strokeStyle = ghostHi; ctx.lineWidth = 0.8; ctx.globalAlpha *= 0.72;
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath(); ctx.moveTo(k * w * 0.1, y - w * 0.34); ctx.quadraticCurveTo(k * w * 0.14, y - w * 0.05, k * w * 0.09, y + w * 0.12); ctx.stroke();
  }
  ctx.globalAlpha = (flash ? 1 : 0.78) * (1 - dp * 0.4);
  ctx.fillStyle = ghostDk;
  for (let k = -2; k <= 2; k++) {
    const sx = k * w * 0.17;
    poly([[sx - 2, y - w * 0.38], [sx, y - w * (0.5 + (k % 2 ? 0.05 : 0))], [sx + 2, y - w * 0.38]]); ctx.fill();
  }

  spectralFin(true);

  // hollow glowing eyes + gaping wail-mouth (opens on swoop)
  const ey = y - w * 0.02;
  glow(-w * 0.14, ey, 3, t.eye || "#cfe6f2", "rgba(180,220,240,0)", (0.6 + 0.3 * dark) * (1 - dp));
  glow(w * 0.14, ey, 3, t.eye || "#cfe6f2", "rgba(180,220,240,0)", (0.6 + 0.3 * dark) * (1 - dp));
  ctx.fillStyle = col(flash, t.eye || "#cfe6f2");
  ctx.beginPath(); ctx.ellipse(-w * 0.14, ey, 2, 3, 0, 0, TAU); ctx.ellipse(w * 0.14, ey, 2, 3, 0, 0, TAU); ctx.fill();
  const mouth = 2 + Math.max(F.wind, F.recoil) * 4;
  ctx.fillStyle = "rgba(20,40,50,0.6)";
  ctx.beginPath(); ctx.ellipse(0, y + w * 0.16, 2 + F.recoil * 2, mouth, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

// Breeder — enormous bloated forest tick: a mobile catapult that lobs boulders
// (e.siegeShootCd) and periodically belches out greedlets (e.spawnCd). Tiny
// legs under a heaving, sac-covered belly; a huge maw that gapes to spawn.
export function drawBreeder(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = deathP(e);
  const w = t.w;
  const g = gait(e);
  const A = attackPose(e);

  const hide = col(flash, "#5a3d2e");
  const hideDk = col(flash, "#38251b");
  const legHi = col(flash, "#7b5740");
  const sac = col(flash, "#7a5a3a");
  const sacGlow = "#c98a4a";

  const spawnCd = e.spawnCd ?? 9;
  const spawnWind = cooldownCharge(spawnCd, 1.15);
  const spawnRelease = A.kind === "spawn" && A.striking ? 1 - ease(Math.max(0, A.p)) : 0;
  const spawnP = Math.max(spawnWind, spawnRelease);
  const lobWind = cooldownCharge(e.siegeShootCd, 1.05);
  const lobRelease = A.kind === "lob" && A.striking ? 1 - ease(Math.max(0, A.p)) : 0;
  const lobP = A.kind === "lob" && A.striking ? clamp01(A.p / 0.72) : 0;

  const breath = Math.sin(T * 1.6 + e.x * 0.1) * 0.06 + spawnWind * 0.14 - spawnRelease * 0.05;
  const stride = Math.sin(g.phase * 1.3);
  const plant = Math.pow(Math.abs(stride), 5) * g.run;
  const bob = plant * 2.1 + lobRelease * 1.6;
  const rear = lobWind * 0.16 - lobRelease * 0.12;

  contactShadow(w * 0.5, 0.26 - dp * 0.14);

  // Six articulated tick legs visibly bow under the abdomen. The far bank is
  // thinner/darker, while the near bank plants broad hooked feet on each beat.
  for (const side of [-1, 1]) {
    ctx.strokeStyle = side < 0 ? hideDk : legHi;
    ctx.lineCap = "round";
    for (let k = 0; k < 3; k++) {
      const lx = -w * 0.27 + k * (w * 0.27);
      const wave = Math.sin(g.phase * 1.3 + k * 2.05 + (side < 0 ? Math.PI : 0));
      const step = wave * 5 * (0.25 + g.run);
      const strain = Math.max(spawnWind, lobWind) * (k === 1 ? 3.4 : 2);
      const hipX = lx, hipY = groundY - w * (0.27 + side * 0.018) + strain;
      const footX = lx + step + side * w * 0.11;
      const footY = groundY - 2 - Math.max(0, -wave) * 2.5 * g.run;
      const knee = limb(hipX, hipY, footX, footY, w * 0.2, w * 0.23, side, side < 0 ? 3.2 : 4.2, side < 0 ? 2.3 : 3.1, side < 0 ? hideDk : legHi);
      ctx.fillStyle = side < 0 ? hideDk : legHi;
      ctx.beginPath(); ctx.arc(knee.x, knee.y, side < 0 ? 2.5 : 3.1, 0, TAU); ctx.fill();
      ctx.strokeStyle = hideDk; ctx.lineWidth = 1.6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(footX - 1, footY); ctx.lineTo(footX + side * 5, footY + 1); ctx.stroke();
    }
  }
  ctx.lineCap = "butt";

  // vast bloated belly
  const cy = groundY - w * 0.47 - bob;
  const rx = w * 0.5 * (1 + breath), ry = w * 0.4 * (1 + breath * 0.6);
  ctx.save();
  ctx.translate(0, cy); ctx.rotate(rear); ctx.translate(-lobRelease * w * 0.035, -cy);
  ctx.fillStyle = hide;
  ctx.beginPath(); ctx.ellipse(0, cy, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = hideDk; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, cy, rx, ry, 0, 0, TAU); ctx.stroke();
  // back shading
  ctx.fillStyle = hideDk; ctx.globalAlpha = flash ? 1 : 0.45;
  ctx.beginPath(); ctx.ellipse(-w * 0.14, cy - w * 0.1, rx * 0.7, ry * 0.7, -0.2, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;

  // Permanent dorsal saddle and pivot make the siege organ part of the model,
  // even between shots.
  ctx.fillStyle = hideDk;
  poly([[-w * 0.34, cy - ry * 0.72], [-w * 0.24, cy - ry - 4], [-w * 0.05, cy - ry - 1], [w * 0.02, cy - ry * 0.68]]); ctx.fill();
  ctx.strokeStyle = sacGlow; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.65;
  ctx.beginPath(); ctx.moveTo(-w * 0.25, cy - ry * 0.64); ctx.lineTo(-w * 0.23, cy - ry - 2); ctx.lineTo(-w * 0.08, cy - ry); ctx.stroke();
  ctx.globalAlpha = 1;

  // Chitin belly bands keep the bloated sac visually supported and flex apart
  // during the heave instead of behaving like painted marks on a balloon.
  ctx.strokeStyle = col(flash, "#8d6741"); ctx.lineWidth = 2.2; ctx.globalAlpha = 0.72;
  for (let k = -1; k <= 1; k++) {
    const bx = k * w * 0.17;
    ctx.beginPath(); ctx.moveTo(bx - w * 0.04, cy - ry * 0.76); ctx.quadraticCurveTo(bx + w * 0.05, cy, bx - w * 0.02, cy + ry * 0.82); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // pulsing egg-sacs across the hide
  for (let k = 0; k < 7; k++) {
    const a = k * 0.9 + 0.3, sr = rx * (0.5 + (k % 3) * 0.12);
    const sx = Math.cos(a) * sr * 0.8, sy = cy + Math.sin(a) * ry * 0.7;
    const pulse = 0.6 + 0.4 * Math.sin(T * 3 + k * 1.3);
    ctx.fillStyle = sac;
    ctx.beginPath(); ctx.arc(sx, sy, 3 + pulse, 0, TAU); ctx.fill();
    glow(sx, sy, 4, `rgba(201,138,74,${0.3 * pulse})`, "rgba(120,60,20,0)", (0.4 + spawnP * 0.3) * (1 - dp));
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.arc(sx + 0.8, sy + 0.8, 1, 0, TAU); ctx.fill();
  }

  // head/maw on the front, gapes wide to belch spawn
  const hx = rx * 0.72, hy = cy + ry * 0.2;
  ctx.fillStyle = hideDk;
  ctx.beginPath(); ctx.ellipse(hx, hy, w * 0.2, w * 0.22, 0, 0, TAU); ctx.fill();
  const gape = 2 + spawnP * (w * 0.18);
  if (spawnP > 0.05) glow(hx + w * 0.12, hy, gape + 3, "rgba(255,180,90,0.7)", "rgba(180,60,10,0)", spawnP * (1 - dp));
  ctx.fillStyle = "#180d06";
  ctx.beginPath(); ctx.ellipse(hx + w * 0.1, hy, w * 0.1 + spawnP * 4, gape, 0, 0, TAU); ctx.fill();
  // mandible teeth
  ctx.fillStyle = col(flash, "#d8c0a0");
  for (let k = 0; k < 4; k++) {
    const ang = -0.6 + k * 0.4;
    const tx = hx + w * 0.1 + Math.cos(ang) * (w * 0.14), ty = hy + Math.sin(ang) * (gape + 2);
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + 3, ty); ctx.lineTo(tx + 1.5, ty + Math.sign(Math.sin(ang)) * 3 + 1); ctx.fill();
  }
  // little eyes above the maw
  glow(hx - 2, hy - w * 0.18, 2.6, t.eye || "#f2c14e", "rgba(240,190,60,0)", (0.5 + 0.3 * dark) * (1 - dp));
  ctx.fillStyle = col(flash, t.eye || "#f2c14e");
  ctx.beginPath(); ctx.arc(hx - 4, hy - w * 0.19, 1.4, 0, TAU); ctx.arc(hx, hy - w * 0.2, 1.4, 0, TAU); ctx.fill();

  // The rear shell is a living catapult: two chitin struts brace a sinew cup,
  // load the boulder against the abdomen, then snap forward on release.
  if (lobWind > 0.02 || lobRelease > 0.02) {
    const bx = -w * 0.16 + lobP * w * 0.92;
    const by = cy - ry - 5 - lobWind * 13 - Math.sin(lobP * Math.PI) * 16;
    const pivotX = -w * 0.25, pivotY = cy - ry * 0.35;
    const attached = 1 - smooth(clamp01(lobP / 0.2));
    const armX = mix(pivotX + w * 0.43, bx - 2, attached);
    const armY = mix(cy - ry - 7, by + 2, attached);
    ctx.strokeStyle = hideDk; ctx.lineCap = "round";
    ctx.lineWidth = 4.2;
    ctx.beginPath(); ctx.moveTo(pivotX - 4, pivotY + 5); ctx.lineTo(armX, armY); ctx.stroke();
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(pivotX + 7, pivotY + 7); ctx.lineTo(armX + 5, armY + 2); ctx.stroke();
    if (attached > 0.05) {
      ctx.strokeStyle = sacGlow; ctx.lineWidth = 1.2; ctx.globalAlpha = attached;
      ctx.beginPath(); ctx.moveTo(armX - 2, armY); ctx.lineTo(bx - 5, by + 3); ctx.moveTo(armX + 3, armY + 1); ctx.lineTo(bx + 5, by + 3); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.lineCap = "butt";
    ctx.fillStyle = sacGlow; ctx.beginPath(); ctx.arc(pivotX, pivotY, 3.2, 0, TAU); ctx.fill();
    ctx.fillStyle = col(flash, "#6a6258");
    ctx.beginPath(); ctx.arc(bx, by, 7 + lobWind * 1.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = col(flash, "#3e3933"); ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(bx, by, 7 + lobWind * 1.5, 0, TAU); ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.arc(bx + 2, by + 2, 3, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════
// FROZEN
// ═══════════════════════════════════════════════════════════════════════════

// Frost-Sprite — a small darting shard-elemental of jagged ice. Sharp faceted
// crystal body, glittering motes, a cold cyan core. Coils and hurls itself at
// walls to freeze them (e.attackAnim).
export function drawFrostSprite(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = deathP(e);
  const w = t.w;
  const g = gait(e);
  const A = attackPose(e);

  const ice = col(flash, "#bfefff");
  const iceDk = col(flash, "#6fb8d8");
  const iceHi = col(flash, "#eafcff");

  const hover = Math.sin(T * 4 + e.x * 0.2) * (3 - g.run * 1.5) + Math.abs(Math.sin(g.phase * 4.4)) * g.run * 1.5;
  const y = groundY - w * 0.7 + hover;
  const lunge = A.ext;
  const spin = T * 2.4 + e.x + A.wind * 1.4;

  glow(0, y, w * 0.9, "rgba(180,240,255,0.5)", "rgba(80,150,200,0)", (0.25 + Math.max(0, lunge) * 0.3) * (1 - dp));

  // A short cold streak makes its high-speed travel and wall-dart readable.
  if ((g.run > 0.35 || A.swing > 0.15) && !e.dying) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.18 + g.run * 0.18 + A.swing * 0.24;
    const trail = ctx.createLinearGradient(-w, 0, 2, 0);
    trail.addColorStop(0, "rgba(160,225,255,0)"); trail.addColorStop(1, "rgba(225,250,255,0.7)");
    ctx.fillStyle = trail; ctx.beginPath(); ctx.ellipse(-w * 0.35, y, w * 0.75, w * 0.16, 0, 0, TAU); ctx.fill(); ctx.restore();
  }

  ctx.save();
  ctx.translate(Math.max(0, lunge) * 8 + g.lean * 2.5, A.wind * 2);
  ctx.translate(0, y); ctx.rotate(Math.sin(spin) * 0.25 + lunge * 0.45 + g.lean * 0.18); ctx.scale(1 + Math.max(0, lunge) * 0.18, 1 - Math.max(0, lunge) * 0.12); ctx.translate(0, -y);

  // radiating ice shards
  ctx.fillStyle = iceDk;
  for (let k = 0; k < 6; k++) {
    const a = spin + k * (TAU / 6);
    const r = w * 0.5 + (k % 2) * w * 0.14;
    poly([[Math.cos(a) * w * 0.2, y + Math.sin(a) * w * 0.2],
          [Math.cos(a) * r, y + Math.sin(a) * r],
          [Math.cos(a + 0.4) * w * 0.22, y + Math.sin(a + 0.4) * w * 0.22]]);
    ctx.fill();
  }
  // faceted crystal core
  ctx.fillStyle = ice;
  poly([[0, y - w * 0.4], [w * 0.3, y - w * 0.06], [w * 0.16, y + w * 0.34],
        [-w * 0.16, y + w * 0.34], [-w * 0.3, y - w * 0.06]]);
  ctx.fill();
  ctx.fillStyle = iceHi; ctx.globalAlpha = 0.7;
  poly([[0, y - w * 0.4], [w * 0.3, y - w * 0.06], [0, y]]); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = iceDk;
  poly([[0, y - w * 0.4], [-w * 0.3, y - w * 0.06], [0, y]]); ctx.fill();

  // glowing cold heart + eyes
  glow(0, y, w * 0.22, "rgba(255,255,255,0.9)", "rgba(150,220,255,0)", 0.7 * (1 - dp));
  ctx.fillStyle = col(flash, t.eye || "#ffffff");
  ctx.beginPath(); ctx.arc(-w * 0.1, y - w * 0.04, 1.4, 0, TAU); ctx.arc(w * 0.1, y - w * 0.04, 1.4, 0, TAU); ctx.fill();
  ctx.restore();

  // glitter motes
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (1 - dp) * 0.8;
  for (let k = 0; k < 4; k++) {
    const a = T * 2 + k * 1.7;
    ctx.fillStyle = k % 2 ? iceHi : ice;
    ctx.beginPath(); ctx.arc(Math.cos(a) * w * 0.6, y + Math.sin(a * 1.3) * w * 0.5, 0.9, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// Ice-Golem — a slow, massive walking iceberg. Translucent blue-white blocks
// of ice, a bright frozen core, jagged shoulders; its broad body physically
// screens smaller enemies. Heavy, deliberate gait; slams with a boulder-fist.
export function drawIceGolem(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = deathP(e);
  const w = t.w;
  const g = gait(e);
  const A = attackPose(e);

  const ice = col(flash, "#8ebbd5");
  const iceDk = col(flash, "#416f8d");
  const iceEdge = col(flash, "#294b66");
  const iceHi = col(flash, "#d8f3ff");
  const core = "#9fe9ff";

  const run = g.run;
  const ph = g.phase * 1.1;
  const stride = Math.sin(ph);
  const foot = Math.pow(Math.abs(stride), 5);
  const bodyDrop = foot * 2.5 * run + A.hit * 2.8;
  const slabShift = Math.sin(ph * 0.5) * 1.8 * run;

  contactShadow(w * 0.5, 0.26 - dp * 0.14);

  const SCALE = 1;
  const y = groundY;
  const hipY = y - w * 0.3 - bodyDrop;

  // frost aura
  glow(0, y - w * 0.5, w * 0.78, "rgba(155,220,245,0.3)", "rgba(55,105,145,0)", (0.13 + 0.04 * Math.sin(T * 2)) * (1 - dp));

  // legs: thick ice pillars
  for (const side of [1, 0]) {
    const phs = ph + side * Math.PI;
    const lift = Math.max(0, -Math.sin(phs)) * 3 * (0.3 + run);
    const fx = -w * 0.16 + side * w * 0.32;
    const kneeX = fx * 0.7;
    ctx.strokeStyle = iceEdge; ctx.lineCap = "round"; ctx.lineWidth = w * 0.2;
    ctx.beginPath(); ctx.moveTo(-w * 0.08 + side * w * 0.16, hipY); ctx.lineTo(kneeX, y - w * 0.14 - lift); ctx.lineTo(fx, y - lift); ctx.stroke();
    ctx.strokeStyle = side ? iceDk : ice; ctx.lineWidth = w * 0.145;
    ctx.beginPath(); ctx.moveTo(-w * 0.08 + side * w * 0.16, hipY); ctx.lineTo(kneeX, y - w * 0.14 - lift); ctx.lineTo(fx, y - lift); ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = side ? iceDk : ice;
    poly([[fx - w * 0.12, y - lift - w * 0.05], [fx + w * 0.1, y - lift - w * 0.05], [fx + w * 0.08, y - lift], [fx - w * 0.14, y - lift]]); ctx.fill();
    ctx.strokeStyle = iceEdge; ctx.lineWidth = 1.3; ctx.stroke();
  }

  // Far fist joins the near one for the signature two-handed overhead slam.
  {
    const a = A.active ? mix(2.4, -1.25, A.raise) : 2.05 + Math.sin(T * 1.3) * 0.04;
    const sx = -w * 0.27, sy = y - w * 0.62 - bodyDrop;
    const hx = sx + Math.cos(a) * w * 0.48, hy = sy + Math.sin(a) * w * 0.48;
    ctx.strokeStyle = iceEdge; ctx.lineCap = "round"; ctx.lineWidth = w * 0.19;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = iceDk; ctx.lineWidth = w * 0.135;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke(); ctx.lineCap = "butt";
    ctx.fillStyle = iceDk; ctx.strokeStyle = iceEdge; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(hx, hy, w * 0.15, 0, TAU); ctx.fill(); ctx.stroke();
  }

  // torso: stacked ice slabs
  ctx.save();
  ctx.translate(0, hipY); ctx.rotate(g.lean * 0.07 - A.wind * 0.06 + A.hit * 0.09); ctx.translate(0, -hipY);
  ctx.fillStyle = ice;
  poly([[-w * 0.3, y - w * 0.28], [-w * 0.36, y - w * 0.62], [-w * 0.2, y - w * 0.74],
        [w * 0.22, y - w * 0.74], [w * 0.38, y - w * 0.6], [w * 0.32, y - w * 0.28]]);
  ctx.fill(); ctx.strokeStyle = iceEdge; ctx.lineWidth = 1.6; ctx.stroke();
  // internal facets
  ctx.fillStyle = iceHi; ctx.globalAlpha = 0.5;
  poly([[-w * 0.1, y - w * 0.7], [w * 0.14, y - w * 0.66], [0.02 * w, y - w * 0.4], [-w * 0.16, y - w * 0.44]]); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = iceDk; ctx.globalAlpha = flash ? 1 : 0.5;
  poly([[-w * 0.3, y - w * 0.28], [-w * 0.36, y - w * 0.62], [-w * 0.22, y - w * 0.6], [-w * 0.2, y - w * 0.3]]); ctx.fill();
  ctx.globalAlpha = 1;
  // Offset armor slabs create actual planes and shadow gaps around the core.
  ctx.fillStyle = iceDk;
  poly([[-w * 0.31 + slabShift, y - w * 0.6], [-w * 0.13 + slabShift, y - w * 0.68], [-w * 0.07, y - w * 0.52], [-w * 0.24, y - w * 0.43]]); ctx.fill();
  ctx.fillStyle = iceHi; ctx.globalAlpha = flash ? 1 : 0.62;
  poly([[w * 0.11 - slabShift * 0.5, y - w * 0.68], [w * 0.31 - slabShift * 0.5, y - w * 0.59], [w * 0.23, y - w * 0.42], [w * 0.06, y - w * 0.5]]); ctx.fill();
  ctx.globalAlpha = 1;
  // Independent slab seams grind past one another as the weight shifts.
  ctx.strokeStyle = iceDk; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-w * 0.31 + slabShift, y - w * 0.58); ctx.lineTo(w * 0.31 + slabShift, y - w * 0.55); ctx.stroke();
  ctx.strokeStyle = iceHi; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(-w * 0.27 - slabShift * 0.6, y - w * 0.4); ctx.lineTo(w * 0.3 - slabShift * 0.6, y - w * 0.42); ctx.stroke();
  // jagged shoulder spikes
  ctx.fillStyle = iceHi;
  for (const [sx, sy, h] of [[-w * 0.3, y - w * 0.66, w * 0.2], [w * 0.28, y - w * 0.68, w * 0.24], [0, y - w * 0.78, w * 0.16]]) {
    poly([[sx - w * 0.06, sy], [sx, sy - h], [sx + w * 0.06, sy]]); ctx.fill();
  }
  // glowing frozen core
  glow(0, y - w * 0.5, w * (0.17 + A.hit * 0.09), "rgba(200,245,255,0.95)", "rgba(90,180,225,0)", (0.52 + 0.12 * Math.sin(T * 3) + A.hit * 0.3) * (1 - dp));
  ctx.strokeStyle = iceEdge; ctx.lineWidth = 2.2; ctx.globalAlpha = 0.8;
  for (let k = 0; k < 4; k++) {
    const a = Math.PI * 0.25 + k * Math.PI * 0.5;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * w * 0.105, y - w * 0.5 + Math.sin(a) * w * 0.105); ctx.lineTo(Math.cos(a) * w * 0.17, y - w * 0.5 + Math.sin(a) * w * 0.17); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = core; ctx.globalAlpha = (1 - dp) * 0.9;
  ctx.beginPath(); ctx.arc(0, y - w * 0.5, w * 0.09, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;

  // head: blocky ice skull with cold eyes
  const hdy = y - w * 0.82;
  ctx.fillStyle = ice;
  poly([[-w * 0.12, hdy + w * 0.1], [-w * 0.1, hdy - w * 0.06], [0, hdy - w * 0.11], [w * 0.1, hdy - w * 0.06], [w * 0.12, hdy + w * 0.1], [0, hdy + w * 0.14]]); ctx.fill();
  ctx.strokeStyle = iceEdge; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.fillStyle = iceHi; ctx.globalAlpha = 0.55;
  poly([[0, hdy - w * 0.11], [w * 0.1, hdy - w * 0.06], [0, hdy + w * 0.04]]); ctx.fill(); ctx.globalAlpha = 1;
  glow(-w * 0.05, hdy, 3, t.eye || "#eaf8ff", "rgba(200,240,255,0)", (0.6 + 0.3 * dark) * (1 - dp));
  glow(w * 0.05, hdy, 3, t.eye || "#eaf8ff", "rgba(200,240,255,0)", (0.6 + 0.3 * dark) * (1 - dp));
  ctx.fillStyle = col(flash, t.eye || "#eaf8ff");
  ctx.beginPath(); ctx.arc(-w * 0.05, hdy, w * 0.03, 0, TAU); ctx.arc(w * 0.05, hdy, w * 0.03, 0, TAU); ctx.fill();

  // near arm: heavy ice-boulder fist, overhead slam
  {
    const a = A.active ? mix(0.62, -2.35, A.raise) : (0.9 + Math.sin(T * 1.5 + e.x) * 0.05);
    const r = w * 0.5;
    const hx = w * 0.24 + Math.cos(a) * r, hy = y - w * 0.6 + Math.sin(a) * r;
    ctx.strokeStyle = iceEdge; ctx.lineCap = "round"; ctx.lineWidth = w * 0.21;
    ctx.beginPath(); ctx.moveTo(w * 0.28, y - w * 0.62); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = ice; ctx.lineWidth = w * 0.155;
    ctx.beginPath(); ctx.moveTo(w * 0.28, y - w * 0.62); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = iceDk; ctx.strokeStyle = iceEdge; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(hx, hy, w * 0.16, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = iceHi;
    for (let k = 0; k < 3; k++) { const sa = a + (k - 1) * 0.5; poly([[hx + Math.cos(sa) * w * 0.1, hy + Math.sin(sa) * w * 0.1], [hx + Math.cos(sa) * w * 0.24, hy + Math.sin(sa) * w * 0.24], [hx + Math.cos(sa + 0.3) * w * 0.1, hy + Math.sin(sa + 0.3) * w * 0.1]]); ctx.fill(); }
  }
  ctx.restore();

  if (A.hit > 0.28 && !e.dying) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (A.hit - 0.28) * 0.85;
    ctx.strokeStyle = iceHi; ctx.lineWidth = 1.5;
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(13, y - 1); ctx.lineTo(13 + 10 + Math.abs(k) * 3, y - 3 + k * 4); ctx.stroke(); }
    ctx.restore();
  }
}

// Blizzard Witch — a hooded ice-mage that hovers behind the line and conjures a
// local snowstorm (t.blizzardAura). Tattered frost robes, a jagged staff, a
// swirling snow vortex around her; face is a dark hood with two cold eyes.
export function drawBlizzardWitch(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = deathP(e);
  const w = t.w;
  const F = flightMotion(e, T, 3.8, e.shootCd, 0.95);

  const robe = col(flash, "#1b2842");
  const robeDk = col(flash, "#0e1526");
  const robeHi = col(flash, "#31456e");
  const frost = "#d8f8ff";

  const y = groundY - w * 1.0 + F.hover;
  const castP = Math.max(F.wind, F.recoil);
  const cast = castP > 0.02;
  const sway = Math.sin(T * 1.4 + e.x) * 0.08 + F.bank;

  // swirling snow aura
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (0.16 + castP * 0.2) * (1 - dp);
  const ag = ctx.createRadialGradient(0, y, w * 0.2, 0, y, w * 1.1);
  ag.addColorStop(0, "rgba(216,248,255,0.5)"); ag.addColorStop(1, "rgba(120,180,220,0)");
  ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(0, y, w * 1.1, 0, TAU); ctx.fill();
  ctx.restore();
  // orbiting snowflakes
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (1 - dp) * (0.5 + castP * 0.4);
  ctx.fillStyle = frost;
  for (let k = 0; k < 8; k++) {
    const a = T * (cast ? 3 : 1.6) + k * (TAU / 8);
    const r = w * (0.7 + 0.3 * Math.sin(T * 2 + k));
    ctx.beginPath(); ctx.arc(Math.cos(a) * r, y + Math.sin(a) * r * 0.7, 1.2, 0, TAU); ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = (1 - dp * 0.4);
  ctx.translate(-F.recoil * 3, y); ctx.rotate(sway); ctx.translate(0, -y);

  // flowing robe (no legs — trails into mist)
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-w * 0.28, y - w * 0.5);
  ctx.quadraticCurveTo(-w * 0.42, y + w * 0.2, -w * 0.24 + Math.sin(T * 3) * 4, y + w * 0.5);
  ctx.quadraticCurveTo(0, y + w * 0.36, w * 0.24 + Math.sin(T * 3 + 1) * 4, y + w * 0.5);
  ctx.quadraticCurveTo(w * 0.42, y + w * 0.2, w * 0.28, y - w * 0.5);
  ctx.closePath(); ctx.fill();
  // robe shading + frost hem
  ctx.fillStyle = robeDk; ctx.globalAlpha *= 0.6;
  ctx.beginPath(); ctx.moveTo(-w * 0.28, y - w * 0.5); ctx.quadraticCurveTo(-w * 0.42, y + w * 0.2, -w * 0.24, y + w * 0.5); ctx.quadraticCurveTo(-w * 0.1, y + w * 0.36, -w * 0.06, y - w * 0.5); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = (1 - dp * 0.4);
  ctx.strokeStyle = frost; ctx.lineWidth = 1; ctx.globalAlpha = 0.4 * (1 - dp);
  ctx.beginPath(); ctx.moveTo(-w * 0.22, y + w * 0.46); ctx.quadraticCurveTo(0, y + w * 0.34, w * 0.22, y + w * 0.46); ctx.stroke();
  ctx.globalAlpha = (1 - dp * 0.4);
  // Layered frost-tabard with small runic slashes breaks up the robe slab.
  ctx.fillStyle = robeHi; ctx.globalAlpha *= 0.55;
  poly([[-w * 0.08, y - w * 0.28], [w * 0.08, y - w * 0.28], [w * 0.13, y + w * 0.34], [0, y + w * 0.25], [-w * 0.13, y + w * 0.34]]); ctx.fill();
  ctx.globalAlpha = (1 - dp * 0.4); ctx.strokeStyle = frost; ctx.lineWidth = 0.8;
  for (let k = 0; k < 3; k++) { const ry = y - w * 0.08 + k * w * 0.13; ctx.beginPath(); ctx.moveTo(-3, ry); ctx.lineTo(0, ry + 3); ctx.lineTo(3, ry - 1); ctx.stroke(); }

  // hood + shoulders
  ctx.fillStyle = robeHi;
  poly([[-w * 0.28, y - w * 0.44], [-w * 0.1, y - w * 0.62], [w * 0.1, y - w * 0.62], [w * 0.28, y - w * 0.44], [w * 0.16, y - w * 0.3], [-w * 0.16, y - w * 0.3]]); ctx.fill();
  ctx.fillStyle = frost;
  for (const s of [-1, 1]) {
    poly([[s * w * 0.2, y - w * 0.42], [s * w * 0.38, y - w * 0.68], [s * w * 0.3, y - w * 0.38]]); ctx.fill();
  }
  // hood cowl
  ctx.fillStyle = robe;
  ctx.beginPath(); ctx.moveTo(-w * 0.16, y - w * 0.5); ctx.quadraticCurveTo(0, y - w * 0.78, w * 0.16, y - w * 0.5); ctx.quadraticCurveTo(w * 0.1, y - w * 0.44, 0, y - w * 0.46); ctx.quadraticCurveTo(-w * 0.1, y - w * 0.44, -w * 0.16, y - w * 0.5); ctx.fill();
  ctx.fillStyle = frost;
  for (const [ox, h] of [[-w * 0.08,w * 0.12],[0,w * 0.18],[w * 0.08,w * 0.13]]) {
    poly([[ox - 2, y - w * 0.66], [ox, y - w * 0.66 - h], [ox + 2, y - w * 0.66]]); ctx.fill();
  }
  // dark face void with cold eyes
  ctx.fillStyle = "#050810";
  ctx.beginPath(); ctx.ellipse(0, y - w * 0.52, w * 0.11, w * 0.13, 0, 0, TAU); ctx.fill();
  glow(-w * 0.04, y - w * 0.52, 2.4, t.eye || "#d8f8ff", "rgba(200,248,255,0)", (0.7 + 0.3 * dark) * (1 - dp));
  glow(w * 0.04, y - w * 0.52, 2.4, t.eye || "#d8f8ff", "rgba(200,248,255,0)", (0.7 + 0.3 * dark) * (1 - dp));
  ctx.fillStyle = col(flash, t.eye || "#d8f8ff");
  ctx.beginPath(); ctx.ellipse(-w * 0.04, y - w * 0.52, 1.2, 2, 0, 0, TAU); ctx.ellipse(w * 0.04, y - w * 0.52, 1.2, 2, 0, 0, TAU); ctx.fill();

  // staff arm raised, ice-crystal tip flaring on cast
  const raise = F.wind * 0.55 - F.recoil * 0.18;
  const hx = w * 0.3, hy = y - w * 0.36 - raise * w * 0.2;
  ctx.strokeStyle = robeDk; ctx.lineCap = "round"; ctx.lineWidth = w * 0.06;
  ctx.beginPath(); ctx.moveTo(w * 0.14, y - w * 0.36); ctx.lineTo(hx, hy); ctx.stroke();
  // staff shaft
  ctx.strokeStyle = col(flash, "#5a4a3a"); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(hx, hy + w * 0.3); ctx.lineTo(hx + 2, hy - w * 0.3); ctx.stroke();
  ctx.lineCap = "butt";
  // crystal head
  const ctx0 = hx + 2, cty = hy - w * 0.3;
  glow(ctx0, cty, w * 0.18 + castP * 4, "rgba(216,248,255,0.9)", "rgba(120,200,240,0)", (0.5 + castP * 0.5) * (1 - dp));
  ctx.fillStyle = frost;
  poly([[ctx0, cty - w * 0.16], [ctx0 + w * 0.08, cty], [ctx0, cty + w * 0.1], [ctx0 - w * 0.08, cty]]); ctx.fill();
  ctx.fillStyle = col(flash, "#8bcfe9");
  poly([[ctx0 - 2, cty - 1], [ctx0 - w * 0.13, cty - w * 0.11], [ctx0 - w * 0.08, cty + w * 0.04]]); ctx.fill();
  poly([[ctx0 + 2, cty], [ctx0 + w * 0.14, cty - w * 0.09], [ctx0 + w * 0.09, cty + w * 0.05]]); ctx.fill();

  // Free hand gathers the storm inward, then punches forward on release.
  const fhx = -w * (0.27 - F.recoil * 0.16), fhy = y - w * (0.31 + F.wind * 0.18);
  ctx.strokeStyle = robeDk; ctx.lineCap = "round"; ctx.lineWidth = w * 0.055;
  ctx.beginPath(); ctx.moveTo(-w * 0.13, y - w * 0.35); ctx.quadraticCurveTo(-w * 0.22, y - w * 0.42, fhx, fhy); ctx.stroke();
  ctx.lineCap = "butt";
  glow(fhx, fhy, 2.5 + castP * 3, frost, "rgba(120,200,240,0)", (0.25 + castP * 0.5) * (1 - dp));
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════
// DESERT
// ═══════════════════════════════════════════════════════════════════════════

// Sand-Scuttler — a fast, many-legged desert insect that burrows under weak
// walls (e.burrowedWall / burrowT). Armored scarab shell, skittering legs,
// mandibles, a segmented abdomen. Sinks into a spray of sand while burrowing.
export function drawSandScuttler(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = deathP(e);
  const w = t.w;
  const g = gait(e);
  const A = attackPose(e);

  const shell = col(flash, "#b48642");
  const shellDk = col(flash, "#7a5628");
  const shellHi = col(flash, "#d8ae66");
  const legc = col(flash, "#5e4220");

  const burrow = clamp01((e.burrowT || 0) / 1.15);
  const sink = burrow * w * 0.6;
  const y = groundY - w * 0.28 + sink;
  const skitter = g.phase * 6;

  contactShadow(w * 0.42, (0.2 - dp * 0.1) * (1 - burrow * 0.6));

  // sand spray while burrowing
  if (burrow > 0.05) {
    ctx.save(); ctx.globalAlpha = burrow * 0.7;
    ctx.fillStyle = shellHi;
    for (let k = 0; k < 8; k++) {
      const a = k * 0.8, r = w * 0.4 * burrow;
      ctx.beginPath(); ctx.arc(Math.cos(a) * r, groundY - Math.abs(Math.sin(a)) * r * 0.5, 1.5 * burrow + 0.5, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = (1 - burrow * 0.5) * (1 - dp * 0.3);

  // many skittering legs (3 per side)
  ctx.strokeStyle = legc; ctx.lineCap = "round"; ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    for (const s of [-1, 1]) {
      const bx = -w * 0.2 + k * w * 0.2;
      const step = Math.sin(skitter + k * 1.5 + (s > 0 ? Math.PI : 0)) * 3 * (0.3 + g.run);
      const kx = bx + s * w * 0.28, ky = y + w * 0.14;
      const fx = bx + s * w * 0.44 + step, fy = groundY - Math.max(0, Math.sin(skitter + k * 1.5) * 2) * g.run + sink;
      ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.fillStyle = shellDk; ctx.beginPath(); ctx.arc(kx, ky, 1.25, 0, TAU); ctx.fill();
    }
  }
  ctx.lineCap = "butt";

  ctx.translate(Math.max(0, A.ext) * 6 + g.lean * 1.5, A.wind * 1.5);

  // segmented abdomen
  ctx.fillStyle = shell;
  ctx.beginPath(); ctx.ellipse(-w * 0.2, y, w * 0.34, w * 0.28, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = shellDk; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(-w * 0.2, y, w * 0.34, w * 0.28, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = shellDk; ctx.lineWidth = 1;
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(-w * 0.18, y, w * 0.1 + k * w * 0.06, -0.9, 0.9); ctx.stroke(); }

  // domed carapace (front)
  ctx.fillStyle = shell;
  ctx.beginPath(); ctx.ellipse(w * 0.12, y - w * 0.02, w * 0.32, w * 0.29, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = shellDk; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(w * 0.12, y - w * 0.02, w * 0.32, w * 0.29, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = shellHi; ctx.globalAlpha *= 0.6;
  ctx.beginPath(); ctx.ellipse(w * 0.08, y - w * 0.1, w * 0.16, w * 0.12, -0.3, 0, TAU); ctx.fill();
  ctx.globalAlpha = (1 - burrow * 0.5) * (1 - dp * 0.3);
  // carapace split line
  ctx.strokeStyle = shellDk; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w * 0.12, y - w * 0.26); ctx.lineTo(w * 0.14, y + w * 0.2); ctx.stroke();

  // head + mandibles
  const hx = w * 0.36, hy = y + w * 0.04;
  ctx.fillStyle = shellDk;
  ctx.beginPath(); ctx.ellipse(hx, hy, w * 0.15, w * 0.12, 0, 0, TAU); ctx.fill();
  // Sand-sensing antennae sweep forward independently of the mandibles.
  ctx.strokeStyle = shellDk; ctx.lineWidth = 1.1; ctx.lineCap = "round";
  for (const s of [-1, 1]) {
    const feel = Math.sin(T * 3.2 + s * 1.7) * 2;
    ctx.beginPath(); ctx.moveTo(hx + w * 0.05, hy - s * w * 0.04); ctx.quadraticCurveTo(hx + w * 0.18, hy - s * (w * 0.12 + feel), hx + w * 0.27, hy - s * (w * 0.1 + feel)); ctx.stroke();
  }
  ctx.lineCap = "butt";
  const chomp = Math.abs(Math.sin(T * 8 + e.x)) * 1.5 + A.wind * 3.5 + A.swing * 1.2;
  ctx.strokeStyle = col(flash, "#3a2812"); ctx.lineWidth = 1.6; ctx.lineCap = "round";
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(hx + w * 0.06, hy + s * w * 0.04);
    ctx.quadraticCurveTo(hx + w * 0.16, hy + s * (w * 0.02 + chomp), hx + w * 0.22, hy + s * 1); ctx.stroke();
  }
  ctx.lineCap = "butt";
  // eyes
  glow(hx, hy - w * 0.06, 2, t.eye || "#ffe08a", "rgba(255,220,120,0)", (0.5 + 0.3 * dark) * (1 - dp));
  ctx.fillStyle = col(flash, t.eye || "#ffe08a");
  ctx.beginPath(); ctx.arc(hx - w * 0.02, hy - w * 0.06, 1.3, 0, TAU); ctx.arc(hx + w * 0.05, hy - w * 0.05, 1.3, 0, TAU); ctx.fill();
  ctx.restore();
}

// Dust-Wraith — a hovering desert spirit wrapped in a churning dust cloud that
// makes it immune to distant arrows. A vague sand-formed face and grasping
// tatters emerge from a constantly swirling veil of dust.
export function drawDustWraith(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = deathP(e);
  const w = t.w;
  const F = flightMotion(e, T, 3.5, e.shootCd, 0.9);

  const dust = col(flash, "#c6a368");
  const dustDk = col(flash, "#8a6c40");
  const dustLt = col(flash, "#e6cc94");

  const y = groundY - w * 0.95 + F.hover;

  // thick churning dust veil (the immunity cloud)
  ctx.save();
  for (let k = 0; k < 3; k++) {
    const rot = T * (0.6 + k * 0.3) * (k % 2 ? -1 : 1);
    ctx.globalAlpha = (0.3 - k * 0.06) * (flash ? 1.4 : 1) * (1 - dp);
    ctx.fillStyle = k % 2 ? dustDk : dust;
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * TAU + rot;
      const r = w * (0.7 - k * 0.12) * (1 + 0.18 * Math.sin(a * 3 + T * (3 + F.wind * 4) + k)) * (1 - F.wind * 0.12 + F.recoil * 0.18);
      const px = Math.cos(a) * r - F.recoil * 4, py = y + Math.sin(a) * r * 0.85;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // sand face core
  ctx.save(); ctx.globalAlpha = (1 - dp * 0.4);
  ctx.translate(-F.recoil * 4, y); ctx.rotate(F.bank); ctx.translate(0, -y);
  ctx.fillStyle = dustLt;
  ctx.beginPath(); ctx.ellipse(0, y, w * 0.26, w * 0.32, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = dustDk; ctx.globalAlpha *= 0.5;
  ctx.beginPath(); ctx.ellipse(-w * 0.06, y + w * 0.04, w * 0.16, w * 0.2, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = (1 - dp * 0.4);
  // Layered sand-mask plates and brow crest give the storm a carved ancient
  // face instead of three holes floating in a cloud.
  ctx.fillStyle = dustDk;
  poly([[-w * 0.23, y - w * 0.12], [-w * 0.1, y - w * 0.35], [-w * 0.04, y - w * 0.18], [-w * 0.12, y + w * 0.16]]); ctx.fill();
  poly([[w * 0.23, y - w * 0.12], [w * 0.1, y - w * 0.35], [w * 0.04, y - w * 0.18], [w * 0.12, y + w * 0.16]]); ctx.fill();
  ctx.strokeStyle = dustLt; ctx.lineWidth = 0.9; ctx.globalAlpha *= 0.65;
  for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(-w * 0.18, y + k * 5); ctx.quadraticCurveTo(0, y - 3 + k * 5, w * 0.18, y + k * 5); ctx.stroke(); }
  ctx.globalAlpha = (1 - dp * 0.4);

  // hollow eyes + wailing hollow
  glow(-w * 0.09, y - w * 0.04, 2.6, t.eye || "#fff0a0", "rgba(255,240,160,0)", (0.6 + 0.3 * dark) * (1 - dp));
  glow(w * 0.09, y - w * 0.04, 2.6, t.eye || "#fff0a0", "rgba(255,240,160,0)", (0.6 + 0.3 * dark) * (1 - dp));
  ctx.fillStyle = "#2a1e0c";
  ctx.beginPath(); ctx.ellipse(-w * 0.09, y - w * 0.04, 2, 3.2, 0.2, 0, TAU); ctx.ellipse(w * 0.09, y - w * 0.04, 2, 3.2, -0.2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, y + w * 0.16, 2.4 + F.recoil * 1.5, 3.6 + Math.sin(T * 3) * 1.5 + F.wind * 3, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = col(flash, t.eye || "#fff0a0");
  ctx.beginPath(); ctx.arc(-w * 0.09, y - w * 0.04, 1, 0, TAU); ctx.arc(w * 0.09, y - w * 0.04, 1, 0, TAU); ctx.fill();

  // grasping dust-tatter arms
  ctx.strokeStyle = dust; ctx.lineCap = "round"; ctx.lineWidth = 3;
  for (const s of [-1, 1]) {
    const reach = Math.sin(T * 2 + s) * 4 - F.wind * 5;
    const hx = s * w * 0.42 + F.recoil * w * 0.34, hy = y + w * 0.24 - F.wind * w * 0.18;
    ctx.beginPath(); ctx.moveTo(s * w * 0.18, y + w * 0.06);
    ctx.quadraticCurveTo(s * w * 0.4, y + w * 0.1 + reach, hx, hy);
    ctx.stroke();
    claws(hx, hy, s > 0 ? -0.35 : -2.75, 3.4 + F.recoil * 1.5, dustLt, 1);
  }
  ctx.lineCap = "butt";
  ctx.restore();

  // sand grains sloughing off
  ctx.save(); ctx.globalAlpha = (1 - dp) * 0.5;
  ctx.fillStyle = dustLt;
  for (let k = 0; k < 5; k++) {
    const ft = (T * 0.9 + k * 0.3) % 1;
    ctx.beginPath(); ctx.arc(Math.sin(T * 2 + k * 2) * w * 0.5, y + ft * w * 0.6, 0.9 * (1 - ft) + 0.4, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// Behemoth Scorpion — a huge armored desert scorpion. Segmented plated back,
// two big shearing claws that snip at barricades, eight legs, and a segmented
// tail arcing overhead that stabs down (e.attackAnim / builderSting).
export function drawBehemothScorpion(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = deathP(e);
  const w = t.w;
  const g = gait(e);
  const A = attackPose(e);

  const shell = col(flash, "#7a5738");
  const shellDk = col(flash, "#4e371f");
  const shellHi = col(flash, "#9c7146");
  const legc = col(flash, "#3e2c18");
  const venom = "#df8a3a";

  const y = groundY - w * 0.2;
  const walk = g.phase * 3;
  const sting = A.hit;
  const snip = A.active ? clamp01(A.wind * 0.95 + (1 - A.hit) * 0.15) : 0.35 + 0.2 * Math.sin(T * 4 + e.x);

  contactShadow(w * 0.55, 0.24 - dp * 0.12);

  // eight legs
  ctx.strokeStyle = legc; ctx.lineCap = "round"; ctx.lineWidth = 3.1;
  for (let k = 0; k < 4; k++) {
    for (const s of [-1, 1]) {
      const bx = -w * 0.24 + k * w * 0.14;
      const wave = Math.sin(walk + k * 1.15 + (s > 0 ? Math.PI : 0));
      const step = wave * 4.8 * (0.28 + g.run);
      const fx = bx + s * w * 0.3 + step;
      const kx = bx + s * w * 0.18, ky = y + w * 0.02;
      const lift = Math.max(0, -wave) * 2.8 * g.run;
      ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(kx, ky - lift * 0.4); ctx.lineTo(fx, groundY - lift); ctx.stroke();
      ctx.fillStyle = shellDk; ctx.beginPath(); ctx.arc(kx, ky - lift * 0.4, 2.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = legc; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(fx, groundY - lift); ctx.lineTo(fx + s * 5, groundY - lift + 1); ctx.stroke();
      ctx.lineWidth = 3.1;
    }
  }
  ctx.lineCap = "butt";

  // tail: segmented, curls overhead, stabs on attack
  {
    const base = { x: -w * 0.34, y: y - w * 0.1 };
    const coil = Math.max(A.wind, A.raise);
    const idle = Math.sin(T * 1.5) * w * 0.025;
    const p1 = { x: -w * (0.5 + coil * 0.05), y: y - w * (0.48 + coil * 0.12) };
    const p2 = { x: w * (0.12 + coil * 0.08), y: y - w * (0.72 + coil * 0.12) };
    const tip = {
      x: mix(w * 0.24, w * 0.38, sting),
      y: mix(y - w * (0.5 + coil * 0.22) + idle, groundY - 2, sting),
    };
    const segs = 7;
    let px = base.x, py = base.y, prevX = px, prevY = py;
    ctx.strokeStyle = shell; ctx.lineCap = "round";
    for (let i = 1; i <= segs; i++) {
      const u = i / segs, v = 1 - u;
      const nx = v * v * v * base.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * tip.x;
      const ny = v * v * v * base.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * tip.y;
      ctx.lineWidth = (segs - i) * 1.3 + 2;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
      ctx.fillStyle = shellDk; ctx.beginPath(); ctx.arc(nx, ny, (segs - i) * 0.6 + 1, 0, TAU); ctx.fill();
      prevX = px; prevY = py;
      px = nx; py = ny;
    }
    ctx.lineCap = "butt";
    // venom stinger
    const ang = Math.atan2(py - prevY, px - prevX);
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
    ctx.fillStyle = shellDk; ctx.beginPath(); ctx.moveTo(0, -3); ctx.quadraticCurveTo(10, -2, 13, 2); ctx.quadraticCurveTo(8, 1, 0, 3); ctx.fill();
    glow(11, 1, 3 + sting * 3, venom, "rgba(223,138,58,0)", (0.5 + sting * 0.4) * (1 - dp));
    ctx.restore();
    if (sting > 0.3) { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = sting * 0.5; ctx.fillStyle = venom; ctx.beginPath(); ctx.arc(px + Math.cos(ang) * 12, py + Math.sin(ang) * 12, 2, 0, TAU); ctx.fill(); ctx.restore(); }
  }

  // plated body
  ctx.fillStyle = shell;
  ctx.beginPath(); ctx.ellipse(-w * 0.06, y - w * 0.06, w * 0.34, w * 0.24, -0.05, 0, TAU); ctx.fill();
  ctx.strokeStyle = shellDk; ctx.lineWidth = 1.7; ctx.stroke();
  // back plates
  ctx.fillStyle = shellDk;
  for (let k = 0; k < 5; k++) {
    const sx = -w * 0.22 + k * w * 0.14;
    poly([[sx - w * 0.025, y - w * 0.04], [sx + w * 0.025, y - w * (0.21 + (k % 2) * 0.04)], [sx + w * 0.105, y - w * 0.05]]); ctx.fill();
    ctx.fillStyle = shellHi; ctx.globalAlpha = flash ? 1 : 0.62;
    poly([[sx + w * 0.025, y - w * (0.21 + (k % 2) * 0.04)], [sx + w * 0.105, y - w * 0.05], [sx + w * 0.075, y - w * 0.14]]); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = shellDk;
  }
  ctx.fillStyle = shellHi; ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.ellipse(-w * 0.02, y - w * 0.14, w * 0.2, w * 0.1, -0.1, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;

  // head + eyes
  const hx = w * 0.24, hy = y - w * 0.02;
  ctx.fillStyle = shell; ctx.beginPath(); ctx.ellipse(hx, hy, w * 0.14, w * 0.12, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = shellDk; ctx.lineWidth = 1.4; ctx.stroke();
  glow(hx, hy - w * 0.04, 2.4, t.eye || "#df8a3a", "rgba(223,138,58,0)", (0.5 + 0.3 * dark) * (1 - dp));
  ctx.fillStyle = col(flash, t.eye || "#df8a3a");
  ctx.beginPath(); ctx.arc(hx + w * 0.02, hy - w * 0.05, 1.3, 0, TAU); ctx.arc(hx + w * 0.08, hy - w * 0.04, 1.3, 0, TAU); ctx.fill();

  // Two oversized shearing claws: each has a plated forearm, a round wrist
  // joint and two separately rotating serrated halves that visibly clack shut.
  for (const s of [1, -1]) {
    const cx = w * (0.39 + (s < 0 ? 0.015 : 0)), cy = y + s * w * 0.075;
    const armK = cx - w * 0.14;
    ctx.strokeStyle = shellDk; ctx.lineCap = "round"; ctx.lineWidth = w * 0.115;
    ctx.beginPath(); ctx.moveTo(w * 0.15, hy); ctx.lineTo(armK, cy); ctx.lineTo(cx, cy); ctx.stroke();
    ctx.strokeStyle = s > 0 ? shell : shellHi; ctx.lineWidth = w * 0.078;
    ctx.beginPath(); ctx.moveTo(w * 0.15, hy); ctx.lineTo(armK, cy); ctx.lineTo(cx, cy); ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = shellDk; ctx.beginPath(); ctx.arc(armK, cy, w * 0.07, 0, TAU); ctx.fill();
    const open = 0.08 + snip * (s > 0 ? 0.48 : 0.38);
    ctx.save(); ctx.translate(cx, cy);
    for (const jaw of [-1, 1]) {
      ctx.save(); ctx.rotate(jaw * open);
      ctx.fillStyle = shellDk;
      poly([[0, -w * 0.045], [w * 0.16, -w * 0.07], [w * 0.245, -w * 0.015], [w * 0.17, w * 0.045], [0, w * 0.04]]); ctx.fill();
      ctx.fillStyle = shellHi; ctx.globalAlpha = flash ? 1 : 0.55;
      poly([[w * 0.025, -w * 0.03], [w * 0.15, -w * 0.048], [w * 0.19, -w * 0.012], [w * 0.075, 0]]); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = legc;
      for (let tooth = 0; tooth < 2; tooth++) {
        const tx = w * (0.125 + tooth * 0.045);
        poly([[tx, w * 0.028], [tx + w * 0.024, w * 0.065], [tx + w * 0.038, w * 0.025]]); ctx.fill();
      }
      ctx.restore();
    }
    ctx.fillStyle = shellHi; ctx.beginPath(); ctx.arc(0, 0, w * 0.052, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SWAMP
// ═══════════════════════════════════════════════════════════════════════════

// Bog-Crawler — a low, fast amphibian caked in dripping mud that bursts into a
// slow-pool when it dies (deathMud). Wide toad mouth, four splayed legs, a
// glistening slime-slick back that drips as it scrambles.
export function drawBogCrawler(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = deathP(e);
  const w = t.w;
  const g = gait(e);
  const A = attackPose(e);

  const mud = col(flash, "#3f5a34");
  const mudDk = col(flash, "#25391f");
  const slime = col(flash, "#6a8a44");
  const belly = col(flash, "#8aa858");

  const y = groundY - w * 0.16;
  const scramble = g.phase * 5;
  const hop = Math.abs(Math.sin(scramble)) * 3 * g.run;
  const lunge = A.ext;

  contactShadow(w * 0.4, 0.22 - dp * 0.12);

  // death: swelling mud puddle underneath
  if (dp > 0.3) {
    ctx.save(); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = (dp - 0.3) / 0.7 * 0.6;
    ctx.fillStyle = mudDk;
    ctx.beginPath(); ctx.ellipse(0, groundY, w * 0.5 * dp, w * 0.16 * dp, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(Math.max(0, lunge) * 8 + g.lean * 2, A.wind * 2);

  // splayed legs
  ctx.strokeStyle = mudDk; ctx.lineCap = "round"; ctx.lineWidth = 3.2;
  for (let k = 0; k < 2; k++) {
    for (const s of [-1, 1]) {
      const bx = -w * 0.16 + k * w * 0.3;
      const step = Math.sin(scramble + k * 2 + (s > 0 ? 1.5 : 0)) * 3 * (0.3 + g.run);
      const fx = bx + s * w * 0.3 + step;
      ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx + s * w * 0.2, y + w * 0.1 - hop); ctx.lineTo(fx, groundY); ctx.stroke();
      // webbed foot
      ctx.fillStyle = slime; ctx.beginPath(); ctx.ellipse(fx, groundY, 3.2, 1.4, s * 0.12, 0, TAU); ctx.fill();
    }
  }
  ctx.lineCap = "butt";

  // squat body
  ctx.fillStyle = mud;
  ctx.beginPath(); ctx.ellipse(0, y - hop * 0.3, w * 0.43, w * 0.27, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = mudDk; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(0, y - hop * 0.3, w * 0.43, w * 0.27, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = belly; ctx.globalAlpha = flash ? 1 : 0.52;
  ctx.beginPath(); ctx.ellipse(w * 0.12, y + w * 0.08 - hop * 0.3, w * 0.28, w * 0.11, 0.08, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  // slimy highlight
  ctx.fillStyle = slime; ctx.globalAlpha *= 0.6;
  ctx.beginPath(); ctx.ellipse(-w * 0.06, y - w * 0.1 - hop * 0.3, w * 0.2, w * 0.1, -0.2, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  // Mud warts and a ragged reed-like dorsal crest enrich the low silhouette.
  ctx.fillStyle = mudDk;
  for (let k = 0; k < 5; k++) { const wx = -w * 0.2 + k * w * 0.1; ctx.beginPath(); ctx.arc(wx, y - w * 0.12 - hop * 0.3, 1.6, 0, TAU); ctx.fill(); }
  ctx.fillStyle = slime;
  for (let k = 0; k < 4; k++) {
    const sx = -w * 0.24 + k * w * 0.14, sh = w * (0.1 + (k % 2) * 0.055);
    poly([[sx - 1.8, y - w * 0.2 - hop * 0.3], [sx, y - w * 0.2 - sh - hop * 0.3], [sx + 2, y - w * 0.2 - hop * 0.3]]); ctx.fill();
  }

  // wide toad head + gaping mouth
  const hx = w * 0.28, hy = y - hop * 0.3;
  ctx.fillStyle = mud;
  ctx.beginPath(); ctx.ellipse(hx, hy, w * 0.22, w * 0.18, 0, 0, TAU); ctx.fill();
  const gape = 1.5 + A.wind * w * 0.08 + Math.max(0, lunge) * w * 0.14;
  ctx.fillStyle = "#160f0a";
  ctx.beginPath(); ctx.ellipse(hx + w * 0.08, hy + w * 0.04, w * 0.1, gape, 0, 0, TAU); ctx.fill();
  // Elastic tongue lashes out at contact, selling the swipe as amphibian rather
  // than a generic whole-body bump.
  if (A.hit > 0.12) {
    ctx.strokeStyle = col(flash, "#b95d62"); ctx.lineWidth = 2.2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(hx + w * 0.12, hy + w * 0.04); ctx.quadraticCurveTo(hx + w * 0.3, hy - 2, hx + w * (0.32 + A.hit * 0.22), hy + 1); ctx.stroke();
    ctx.lineCap = "butt"; ctx.fillStyle = col(flash, "#d98284");
    ctx.beginPath(); ctx.ellipse(hx + w * (0.32 + A.hit * 0.22), hy + 1, 2.4, 1.5, 0, 0, TAU); ctx.fill();
  }
  // bulging eyes on top
  for (const s of [-1, 1]) {
    const ex = hx - w * 0.02, ey = hy - w * 0.12 + s * w * 0.04;
    ctx.fillStyle = belly; ctx.beginPath(); ctx.arc(ex, ey, w * 0.05, 0, TAU); ctx.fill();
    ctx.fillStyle = col(flash, t.eye || "#b8ff7a");
    glow(ex, ey, 2, t.eye || "#b8ff7a", "rgba(184,255,122,0)", (0.5 + 0.3 * dark) * (1 - dp));
    ctx.beginPath(); ctx.arc(ex + w * 0.01, ey, w * 0.02, 0, TAU); ctx.fill();
  }

  // dripping slime
  ctx.save(); ctx.globalAlpha = (1 - dp) * 0.6; ctx.fillStyle = slime;
  for (let k = 0; k < 3; k++) {
    const dt2 = (T * 0.8 + k * 0.4) % 1;
    ctx.beginPath(); ctx.ellipse(-w * 0.16 + k * w * 0.16, y + w * 0.1 + dt2 * w * 0.2, 1.2, 2 + dt2 * 2, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

// Spore-Spitter — a bloated fungal creature lurking in the fog that lobs acid
// spore-pods at walls (rangedShoot / e.siegeShootCd). A mushroom-cap head over
// a sac-body ringed with venting gills; the sacs swell and fire on attack.
export function drawSporeSpitter(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = deathP(e);
  const w = t.w;
  const g = gait(e);
  const A = attackPose(e);

  const flesh = col(flash, "#566c36");
  const fleshDk = col(flash, "#34411f");
  const cap = col(flash, "#7a4a4a");
  const capDk = col(flash, "#4e2e2e");
  const spore = "#caff7a";

  const y = groundY - w * 0.24;
  const charge = Math.max(cooldownCharge(e.siegeShootCd, 0.95), cooldownCharge(e.poisonCd, 0.8));
  const fire = A.striking ? 1 - ease(Math.max(0, A.p)) : 0;
  const sway = Math.sin(T * 1.4 + e.x * 0.1) * 0.06 - charge * 0.12 + fire * 0.16;
  const swell = 1 + charge * 0.12 + Math.sin(T * 2) * 0.03;
  const bob = Math.abs(Math.sin(g.phase * 2)) * 1.5 * g.run;

  contactShadow(w * 0.4, 0.22 - dp * 0.12);

  // Four root-like legs take the recoil. Their knees fold forward while the
  // reservoirs charge, making the grounded caster feel planted rather than idle.
  ctx.strokeStyle = fleshDk; ctx.lineCap = "round"; ctx.lineWidth = 3.1;
  for (let k = 0; k < 2; k++) {
    for (const s of [-1, 1]) {
      const bx = -w * 0.15 + k * w * 0.27;
      const wave = Math.sin(g.phase * 2 + k * 2.1 + (s > 0 ? Math.PI : 0));
      const step = wave * 2.8 * (0.3 + g.run) - fire * 2;
      const footX = bx + s * w * 0.16 + step;
      ctx.beginPath(); ctx.moveTo(bx, y + w * 0.08); ctx.lineTo(bx + s * w * 0.11, y + w * 0.22 + charge * 2); ctx.lineTo(footX, groundY); ctx.stroke();
      ctx.fillStyle = fleshDk; ctx.beginPath(); ctx.ellipse(footX, groundY - 1, 3.5, 1.4, s * 0.15, 0, TAU); ctx.fill();
    }
  }
  ctx.lineCap = "butt";

  ctx.save();
  ctx.translate(-fire * 4, y); ctx.rotate(sway + g.lean * 0.06); ctx.translate(0, -y);

  // Three rear spore reservoirs inflate in sequence and feed a visible throat.
  for (let k = 0; k < 3; k++) {
    const pulse = clamp01(charge * 1.35 - k * 0.14);
    const sx = -w * (0.27 + k * 0.075), sy = y - bob - w * (0.16 - k * 0.12);
    ctx.fillStyle = col(flash, k === 1 ? "#718d3c" : "#647c37");
    ctx.beginPath(); ctx.ellipse(sx, sy, w * (0.15 + pulse * 0.035), w * (0.17 + pulse * 0.05), -0.3 + k * 0.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = fleshDk; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = col(flash, "#9ab653"); ctx.globalAlpha = 0.45 + pulse * 0.35;
    ctx.beginPath(); ctx.arc(sx, sy, w * (0.08 + pulse * 0.035), -1.4, 1.1); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Bulbous stalk-body with a lighter underside and fibrous vertical ribs.
  ctx.fillStyle = flesh;
  ctx.beginPath(); ctx.ellipse(0, y - bob, w * 0.36 * swell, w * 0.34 * swell, -0.05, 0, TAU); ctx.fill();
  ctx.strokeStyle = fleshDk; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = fleshDk; ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.ellipse(-w * 0.06, y + w * 0.06 - bob, w * 0.24, w * 0.18, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = col(flash, "#7f984f"); ctx.lineWidth = 1.1; ctx.globalAlpha = 0.52;
  for (let k = -1; k <= 1; k++) {
    ctx.beginPath(); ctx.moveTo(k * w * 0.1, y - w * 0.25 - bob); ctx.quadraticCurveTo(k * w * 0.15, y - bob, k * w * 0.09, y + w * 0.22 - bob); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // venting spore sacs on the flanks (glow as it charges)
  for (let k = 0; k < 4; k++) {
    const a = -0.6 + k * 0.5, r = w * 0.28 * swell;
    const sx = Math.cos(a) * r, sy = y - bob + Math.sin(a) * r * 0.7;
    const pl = 0.5 + 0.5 * Math.sin(T * 4 + k) + charge;
    ctx.fillStyle = col(flash, "#6f8a3a");
    ctx.beginPath(); ctx.arc(sx, sy, 2.6 + charge * 1.5, 0, TAU); ctx.fill();
    glow(sx, sy, 4, `rgba(202,255,122,${0.3 * clamp01(pl)})`, "rgba(120,180,40,0)", (0.4 + charge * 0.4) * (1 - dp));
  }

  // A neck bellows under the cap; it shortens on recoil and visibly connects the
  // swollen reservoirs to the forward spitting nozzle.
  const hy = y - w * 0.38 - bob;
  ctx.fillStyle = col(flash, "#718747");
  poly([[-w * 0.14, hy + w * 0.04], [w * 0.16, hy + w * 0.02], [w * 0.22, hy + w * 0.22], [-w * 0.1, hy + w * 0.2]]); ctx.fill();
  ctx.strokeStyle = fleshDk; ctx.lineWidth = 1.2;
  for (let k = 0; k < 4; k++) {
    const gy = hy + w * (0.07 + k * 0.035);
    ctx.beginPath(); ctx.moveTo(-w * 0.09, gy); ctx.lineTo(w * 0.17, gy + fire * 1.5); ctx.stroke();
  }

  // Mushroom cap head: broad silhouette, spotted crown and visible underside gills.
  ctx.fillStyle = cap;
  ctx.beginPath(); ctx.ellipse(0, hy, w * 0.37, w * 0.21, 0, Math.PI, TAU); ctx.fill();
  ctx.strokeStyle = capDk; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = col(flash, "#c48b83"); ctx.globalAlpha = 0.68;
  ctx.beginPath(); ctx.ellipse(0, hy + 1, w * 0.34, w * 0.095, 0, 0, Math.PI); ctx.fill();
  ctx.strokeStyle = capDk; ctx.lineWidth = 0.9;
  for (let k = -3; k <= 3; k++) {
    ctx.beginPath(); ctx.moveTo(0, hy + 1); ctx.lineTo(k * w * 0.105, hy + w * 0.085); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = capDk;
  for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(-w * 0.21 + k * w * 0.105, hy - w * (0.035 + (k % 2) * 0.035), w * 0.032, 0, TAU); ctx.fill(); }
  ctx.fillStyle = col(flash, "#c98a8a"); ctx.globalAlpha = 0.6;
  ctx.beginPath(); ctx.ellipse(-w * 0.06, hy - w * 0.06, w * 0.12, w * 0.05, 0, Math.PI, TAU); ctx.fill();
  ctx.globalAlpha = 1;

  // Face beneath the cap: the mouth is a muscular cannon-nozzle, not a dot.
  glow(-w * 0.06, hy + w * 0.1, 2.2, t.eye || "#caff7a", "rgba(202,255,122,0)", (0.5 + 0.3 * dark) * (1 - dp));
  glow(w * 0.06, hy + w * 0.1, 2.2, t.eye || "#caff7a", "rgba(202,255,122,0)", (0.5 + 0.3 * dark) * (1 - dp));
  ctx.fillStyle = col(flash, t.eye || "#caff7a");
  ctx.beginPath(); ctx.arc(-w * 0.06, hy + w * 0.1, 1.4, 0, TAU); ctx.arc(w * 0.06, hy + w * 0.1, 1.4, 0, TAU); ctx.fill();
  const mx = w * (0.23 + fire * 0.05), my = hy + w * 0.17;
  ctx.strokeStyle = fleshDk; ctx.lineCap = "round"; ctx.lineWidth = w * (0.14 + charge * 0.035);
  ctx.beginPath(); ctx.moveTo(w * 0.08, my); ctx.lineTo(mx, my); ctx.stroke();
  ctx.strokeStyle = col(flash, "#819b4e"); ctx.lineWidth = w * (0.09 + charge * 0.025); ctx.stroke(); ctx.lineCap = "butt";
  const maw = w * (0.055 + charge * 0.04 + fire * 0.025);
  ctx.fillStyle = "#1a220e";
  ctx.beginPath(); ctx.ellipse(mx, my, maw * 0.75, maw, 0, 0, TAU); ctx.fill();
  if (charge > 0.2 || fire) glow(mx + 1, my, 3 + charge * 5 + fire * 3, "rgba(202,255,122,0.8)", "rgba(120,180,40,0)", (charge + fire) * (1 - dp));
  // A released pod and conical spore blast make the firing frame unmistakable.
  if (fire > 0.08) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = fire * (1 - dp);
    const blast = ctx.createLinearGradient(mx, 0, mx + w * 0.5, 0);
    blast.addColorStop(0, "rgba(202,255,122,0.55)"); blast.addColorStop(1, "rgba(150,210,70,0)");
    ctx.fillStyle = blast; poly([[mx, my - maw], [mx + w * 0.48, my - w * 0.13], [mx + w * 0.48, my + w * 0.13], [mx, my + maw]]); ctx.fill();
    ctx.fillStyle = spore; ctx.beginPath(); ctx.arc(mx + w * (0.18 + (1 - fire) * 0.22), my - Math.sin(fire * Math.PI) * w * 0.09, w * 0.055, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // drifting spore motes
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (1 - dp) * 0.4;
  ctx.fillStyle = spore;
  for (let k = 0; k < 4; k++) { const ft = (T * 0.5 + k * 0.28) % 1; ctx.beginPath(); ctx.arc(Math.sin(T + k * 2) * w * 0.4, y - bob - ft * w * 0.5, 0.9 * (1 - ft) + 0.4, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// Murk-Abomination — a hulking horror of rotten roots and swamp-mud that sucks
// up dropped gold to heal and swell (goldEater grows e.w). A mound of tangled
// roots, glowing sickly eyes deep inside, gold flecks embedded in its bulk that
// flare when it feeds (e.goldEatCd / flash).
export function drawMurkAbomination(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = deathP(e);
  const w = e.w || t.w;   // grows as it eats gold
  const grown = clamp01(((e.w || t.w) - t.w) / (t.w * 0.25));
  const g = gait(e);
  const A = attackPose(e);

  const root = col(flash, "#304632");
  const rootDk = col(flash, "#142319");
  const rootLt = col(flash, "#6b845b");
  const mud = col(flash, "#28351f");

  const y = groundY - w * 0.02;
  const feedP = clamp01((e.feedPulse || 0) / 0.55);
  const feedSwell = Math.sin(feedP * Math.PI);
  const heave = Math.sin(T * 1.2 + e.x * 0.1) * 0.055 + 1 + feedSwell * 0.11;
  const bob = Math.abs(Math.sin(g.phase * 1.1)) * 1.8 * g.run;
  const lunge = Math.max(0, A.ext);
  const engulf = Math.max(A.wind * 0.65, A.swing);
  const squashX = 1 + A.wind * 0.1 + lunge * 0.18 + feedSwell * 0.08;
  const squashY = 1 - A.wind * 0.08 - lunge * 0.14 + feedSwell * 0.05;

  contactShadow(w * 0.5, 0.26 - dp * 0.14);

  ctx.save();
  ctx.translate(lunge * w * 0.09 + g.lean * 2, groundY);
  ctx.scale(squashX, squashY);
  ctx.translate(0, -groundY - A.wind * 2);

  // dripping mud mound base
  ctx.fillStyle = mud;
  ctx.beginPath(); ctx.ellipse(0, groundY - w * 0.16, w * 0.5, w * 0.2, 0, Math.PI, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, groundY - w * 0.14, w * 0.5, w * 0.14, 0, 0, Math.PI); ctx.fill();

  // main root-tangle body
  const rx = w * 0.42 * heave, ry = w * 0.44 - bob;
  ctx.fillStyle = root;
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI + (i / 16) * Math.PI;
    const rr = 1 + 0.14 * Math.sin(a * 4 + T * 1.5) + 0.08 * Math.sin(a * 7 - T);
    const px = Math.cos(a) * rx * rr, py = (groundY - w * 0.32) + Math.sin(a) * ry * rr;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.lineTo(rx, groundY - w * 0.14); ctx.lineTo(-rx, groundY - w * 0.14);
  ctx.closePath(); ctx.fill();

  // Translucent outer membrane and a broad wet highlight establish gelatinous
  // material before any surface detail is added.
  ctx.strokeStyle = col(flash, "#78906a"); ctx.lineWidth = 1.7; ctx.globalAlpha = 0.58;
  ctx.stroke();
  ctx.fillStyle = col(flash, "#809873"); ctx.globalAlpha = 0.16;
  ctx.beginPath(); ctx.ellipse(-w * 0.12, groundY - w * 0.48 - bob, rx * 0.62, ry * 0.54, -0.38, 0, TAU); ctx.fill();
  ctx.strokeStyle = col(flash, "#abc09e"); ctx.lineWidth = 1.4; ctx.globalAlpha = 0.45;
  ctx.beginPath(); ctx.arc(-w * 0.15, groundY - w * 0.52 - bob, w * 0.18, 3.55, 5.05); ctx.stroke();
  ctx.globalAlpha = 1;

  // A soft pseudopod pours forward during the lunge, widening around the prey
  // before the mouth cavity opens. It has no hinge or bone-like joint.
  if (engulf > 0.04) {
    ctx.fillStyle = root; ctx.globalAlpha = 0.78;
    ctx.beginPath(); ctx.ellipse(rx * 0.7 + engulf * w * 0.13, groundY - w * 0.25 - bob, w * (0.18 + engulf * 0.1), w * (0.12 + engulf * 0.055), -0.08, 0, TAU); ctx.fill();
    ctx.strokeStyle = rootLt; ctx.lineWidth = 1.1; ctx.globalAlpha = 0.42;
    ctx.beginPath(); ctx.ellipse(rx * 0.7 + engulf * w * 0.13, groundY - w * 0.25 - bob, w * (0.18 + engulf * 0.1), w * (0.12 + engulf * 0.055), -0.08, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Surface filaments ride the jelly ripple; they are suspended inside the
  // mass rather than hinged limbs, keeping the creature boneless.
  ctx.strokeStyle = rootDk; ctx.lineCap = "round"; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.48;
  for (let k = 0; k < 7; k++) {
    const a = -2.4 + k * 0.34;
    const bx = Math.cos(a) * rx * 0.7, by = (groundY - w * 0.34) + Math.sin(a) * ry * 0.7;
    const wob = Math.sin(T * 2 + k + A.wind * 2) * (4 + engulf * 3);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + wob, by - w * 0.055, bx + wob * 0.5, by - w * 0.12); ctx.stroke();
  }
  ctx.lineCap = "butt"; ctx.globalAlpha = 1;
  // moss highlights
  ctx.fillStyle = rootLt; ctx.globalAlpha = 0.5;
  for (let k = 0; k < 5; k++) { const a = -1.8 + k * 0.5; ctx.beginPath(); ctx.ellipse(Math.cos(a) * rx * 0.5, (groundY - w * 0.4) + Math.sin(a) * ry * 0.4, w * 0.06, w * 0.03, a, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;

  // Bubbles and swallowed debris drift at different rates inside the mass.
  ctx.save(); ctx.globalAlpha = (flash ? 0.9 : 0.34) * (1 - dp);
  for (let k = 0; k < 6; k++) {
    const a = T * (0.22 + k * 0.018) + k * 1.37;
    const bx = Math.sin(a * 1.7) * rx * (0.25 + (k % 3) * 0.16);
    const by = groundY - w * (0.25 + ((a * 0.12 + k * 0.16) % 0.35));
    ctx.strokeStyle = k % 2 ? rootLt : "#b0c6a1"; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(bx, by, 1.4 + (k % 3) * 0.55, 0, TAU); ctx.stroke();
  }
  ctx.fillStyle = col(flash, "#655a3c"); ctx.globalAlpha = 0.42;
  poly([[-w * 0.23, groundY - w * 0.3], [-w * 0.13, groundY - w * 0.36], [-w * 0.09, groundY - w * 0.27]]); ctx.fill();
  ctx.restore();

  // Concentric gelatin ripples travel across the surface after a step or meal.
  ctx.save(); ctx.globalAlpha = (0.11 + feedSwell * 0.22 + g.run * 0.08) * (1 - dp);
  ctx.strokeStyle = rootLt; ctx.lineWidth = 1.2;
  for (let k = 0; k < 3; k++) {
    const rp = (T * (0.55 + g.run * 0.35) + k / 3) % 1;
    ctx.beginPath(); ctx.ellipse(w * 0.05, groundY - w * 0.36 - bob, rx * rp, ry * rp * 0.62, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();

  // embedded gold flecks (more as it grows), flaring only when it really feeds
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const flecks = 4 + Math.round(grown * 6);
  for (let k = 0; k < flecks; k++) {
    const a = k * 1.3 + 0.5, gr = rx * (0.3 + (k % 3) * 0.2);
    const gx = Math.cos(a) * gr, gy = (groundY - w * 0.34) + Math.sin(a) * ry * 0.6;
    ctx.globalAlpha = (0.4 + feedSwell * 0.6) * (1 - dp);
    ctx.fillStyle = "#ffd45a"; ctx.beginPath(); ctx.arc(gx, gy, 1.2 + feedSwell * 1.5, 0, TAU); ctx.fill();
  }
  ctx.restore();

  // deep sickly eyes
  const ey = groundY - w * 0.4 - bob;
  glow(-w * 0.1, ey, 3.5, t.eye || "#b8ff7a", "rgba(184,255,122,0)", (0.6 + feedSwell * 0.3 + 0.2 * dark) * (1 - dp));
  glow(w * 0.1, ey, 3.5, t.eye || "#b8ff7a", "rgba(184,255,122,0)", (0.6 + feedSwell * 0.3 + 0.2 * dark) * (1 - dp));
  ctx.fillStyle = col(flash, t.eye || "#b8ff7a");
  ctx.beginPath(); ctx.ellipse(-w * 0.1, ey, 2, 2.6, 0, 0, TAU); ctx.ellipse(w * 0.1, ey, 2, 2.6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#0c1806"; ctx.beginPath(); ctx.ellipse(-w * 0.1, ey, 0.8, 1.6, 0, 0, TAU); ctx.ellipse(w * 0.1, ey, 0.8, 1.6, 0, 0, TAU); ctx.fill();

  // The mouth stretches as a soft engulfing cavity, not a hinged jaw.
  const maw = w * (0.045 + engulf * 0.15);
  ctx.fillStyle = "#0a1204";
  ctx.beginPath(); ctx.ellipse(w * (0.02 + lunge * 0.08), groundY - w * 0.24 - bob, w * (0.1 + engulf * 0.09), maw, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = rootLt; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.55;
  ctx.beginPath(); ctx.ellipse(w * (0.02 + lunge * 0.08), groundY - w * 0.24 - bob, w * (0.13 + engulf * 0.1), maw * 1.25, 0, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════
// VOLCANO
// ═══════════════════════════════════════════════════════════════════════════

// Ash-Fiend — a small glowing coal-imp that sprints unstoppably at the wall and
// detonates (explodeOnDeath / explodeOnWall). Cracked ash crust over a molten
// core that brightens as it nears its target; trailing embers, blazing eyes.
export function drawAshFiend(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = deathP(e);
  const w = t.w;
  const g = gait(e);
  const A = attackPose(e);
  const run = g.run, lean = g.lean;

  const ash = col(flash, "#54231b");
  const ashDk = col(flash, "#260d0a");
  const ember = "#ff6a20";
  const hot = "#ffb040";

  // internal heat: rises with speed and as it "primes"
  const prime = e.dying ? Math.sin(clamp01(dp / 0.45) * Math.PI * 0.5) : 0;
  const heat = 0.5 + 0.3 * Math.sin(T * (8 + prime * 12) + e.x) + run * 0.4 + prime * 0.8;
  const ph = g.phase * 4;
  const bob = Math.abs(Math.sin(ph)) * 2 * (0.4 + run);
  const y = groundY;

  contactShadow(w * 0.4, 0.16 - dp * 0.1);
  // heat haze / trailing embers
  glow(0, y - w * 0.4 - bob, w * (0.7 + prime * 0.35), `rgba(255,120,30,${0.3 + run * 0.15 + prime * 0.25})`, "rgba(120,20,0,0)", (0.4 + heat * 0.2) * (1 - dp * 0.7));
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (1 - dp) * 0.7;
  for (let k = 0; k < 4; k++) {
    const et = (T * 1.4 + k * 0.3) % 1;
    ctx.fillStyle = k % 2 ? ember : hot;
    ctx.beginPath(); ctx.arc(-w * 0.3 - et * w * 0.4, y - w * 0.3 - et * w * 0.3, (1 - et) * 1.6 + 0.4, 0, TAU); ctx.fill();
  }
  ctx.restore();

  // Whip-tail trails the sprint like the ground imp's, then stiffens into a
  // glowing fuse as the kamikaze body primes.
  ctx.strokeStyle = ashDk; ctx.lineCap = "round";
  let tx = -w * 0.12, ty = y - w * 0.34 - bob;
  for (let k = 1; k <= 5; k++) {
    const u = k / 5;
    const nx = -w * (0.12 + u * 0.5);
    const ny = y - w * (0.34 - u * 0.1) - bob + Math.sin(T * 9 - u * 4) * 3 * u * (1 - prime);
    ctx.lineWidth = 2.4 - u * 1.3; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(nx, ny); ctx.stroke(); tx = nx; ty = ny;
  }
  ctx.lineCap = "butt";
  glow(tx, ty, 3 + prime * 4, hot, "rgba(255,70,0,0)", (0.55 + prime * 0.4) * (1 - dp * 0.5));

  // scrambling legs
  ctx.strokeStyle = ashDk; ctx.lineCap = "round"; ctx.lineWidth = 2.8;
  for (const s of [-1, 1]) {
    const phs = ph + (s > 0 ? Math.PI : 0);
    const lift = Math.max(0, -Math.sin(phs)) * 3.5 * (0.4 + run);
    const fx = s * w * 0.16 + Math.cos(phs) * w * 0.12 * (0.4 + run);
    ctx.beginPath(); ctx.moveTo(s * w * 0.08, y - w * 0.3 - bob); ctx.lineTo(fx, y - lift); ctx.stroke();
  }
  ctx.lineCap = "butt";

  ctx.save();
  ctx.translate(Math.max(0, A.ext) * 6, y - w * 0.3 - bob); ctx.rotate(lean * 0.2 - A.wind * 0.18 + A.swing * 0.14); ctx.scale(1 + prime * 0.2, 1 + prime * 0.12); ctx.translate(0, -(y - w * 0.3 - bob));

  // Layered clinker plates and shoulder spikes keep the glow from reducing the
  // fiend to an orange dot at gameplay scale.
  ctx.fillStyle = ashDk;
  poly([[-w * 0.24, y - w * 0.5 - bob], [-w * 0.42, y - w * 0.65 - bob], [-w * 0.31, y - w * 0.36 - bob]]); ctx.fill();
  poly([[w * 0.21, y - w * 0.5 - bob], [w * 0.38, y - w * 0.66 - bob], [w * 0.32, y - w * 0.35 - bob]]); ctx.fill();

  // hunched coal body
  ctx.fillStyle = ash;
  ctx.beginPath(); ctx.ellipse(0, y - w * 0.38 - bob, w * 0.4, w * 0.42, -0.2, 0, TAU); ctx.fill();
  ctx.strokeStyle = ashDk; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.ellipse(0, y - w * 0.38 - bob, w * 0.4, w * 0.42, -0.2, 0, TAU); ctx.stroke();
  // molten core
  glow(w * 0.02, y - w * 0.34 - bob, w * 0.22, "rgba(255,200,90,0.95)", "rgba(255,80,10,0)", (0.5 + heat * 0.3) * (1 - dp));
  // cracked crust seams
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (0.4 + heat * 0.3) * (1 - dp);
  ctx.strokeStyle = ember; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-w * 0.12, y - w * 0.5 - bob); ctx.lineTo(-w * 0.02, y - w * 0.36 - bob); ctx.lineTo(-w * 0.14, y - w * 0.24 - bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.14, y - w * 0.44 - bob); ctx.lineTo(w * 0.04, y - w * 0.32 - bob); ctx.stroke();
  ctx.restore();

  // little grasping arms flung back mid-run
  ctx.strokeStyle = ash; ctx.lineCap = "round"; ctx.lineWidth = 3.1;
  for (const s of [-1, 1]) {
    const hx = s * w * 0.4 - run * w * 0.1 + A.swing * w * 0.2, hy = y - w * 0.29 - bob;
    ctx.beginPath(); ctx.moveTo(s * w * 0.1, y - w * 0.42 - bob); ctx.lineTo(hx, hy); ctx.stroke();
    claws(hx, hy, s > 0 ? 0.7 : 2.4, 3.8, hot, 1.1);
  }
  ctx.lineCap = "butt";

  // head: cracked skull with blazing eyes + open shrieking maw
  const hdx = w * 0.06 + lean * 1, hdy = y - w * 0.56 - bob;
  ctx.fillStyle = ash; ctx.beginPath(); ctx.arc(hdx, hdy, w * 0.23, 0, TAU); ctx.fill();
  ctx.strokeStyle = ashDk; ctx.lineWidth = 1.2; ctx.stroke();
  // horns
  ctx.strokeStyle = ashDk; ctx.lineCap = "round"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(hdx - w * 0.06, hdy - w * 0.1); ctx.lineTo(hdx - w * 0.14, hdy - w * 0.24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hdx + w * 0.06, hdy - w * 0.1); ctx.lineTo(hdx + w * 0.12, hdy - w * 0.24); ctx.stroke();
  ctx.lineCap = "butt";
  glow(hdx, hdy, w * 0.14, "rgba(255,160,60,0.8)", "rgba(255,80,10,0)", (0.4 + heat * 0.3) * (1 - dp));
  ctx.fillStyle = col(flash, t.eye || "#ffb040");
  ctx.beginPath(); ctx.arc(hdx - w * 0.04, hdy - w * 0.02, 1.6, 0, TAU); ctx.arc(hdx + w * 0.06, hdy - w * 0.01, 1.6, 0, TAU); ctx.fill();
  // gaping maw glowing from within
  ctx.fillStyle = "#180804";
  ctx.beginPath(); ctx.ellipse(hdx + w * 0.02, hdy + w * 0.08, w * 0.06, w * 0.05 + Math.abs(Math.sin(T * 6)) * 1.5, 0, 0, TAU); ctx.fill();
  glow(hdx + w * 0.02, hdy + w * 0.08, 3, "rgba(255,180,60,0.8)", "rgba(255,60,0,0)", 0.6 * (1 - dp));
  ctx.restore();
}

// Magma-Gargoyle — a winged volcanic-stone gargoyle that perches on defences
// and spits lava (flying / fireball / e.shootCd). Craggy grey-black stone body
// laced with molten veins, leathery stone wings, a lava-glowing maw on windup.
export function drawMagmaGargoyle(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = deathP(e);
  const w = t.w;
  const F = flightMotion(e, T, 4.5, e.shootCd, 0.85);

  const stone = col(flash, "#493234");
  const stoneDk = col(flash, "#211416");
  const stoneHi = col(flash, "#735053");
  const lava = "#ff7a24";
  const hot = "#ffd060";

  const y = groundY - w * 0.85 + F.hover;
  const wind = F.wind;
  const recoil = F.recoil;
  const heat = 0.4 + 0.2 * Math.sin(T * 4 + e.x) + wind * 0.5 + recoil * 0.3;

  // wingbeat
  const ph = F.ph;

  glow(0, y, w * 0.7, `rgba(255,110,30,${0.2 + heat * 0.1})`, "rgba(120,20,0,0)", (0.3) * (1 - dp));

  // far wing
  const wing = (near) => {
    const s = near ? 1 : 0.85;
    const beat = near ? F.wing : Math.sin(F.ph + 0.58);
    const fl = beat * (near ? 10 : 8) * (1 - dp);
    const lag = F.lag * (near ? 2.4 : 1.8);
    ctx.save();
    if (!near) ctx.globalAlpha = 0.75 * (1 - dp * 0.4);
    else ctx.globalAlpha = (1 - dp * 0.4);
    ctx.fillStyle = near ? stone : stoneDk;
    const ax = -w * 0.1, ay = y - w * 0.14;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(ax - w * 0.4 * s, ay - w * 0.34 * s - fl, ax - w * 0.62 * s, ay - w * 0.12 * s - fl * 0.6 + lag);
    ctx.lineTo(ax - w * 0.5 * s, ay + w * 0.02 - fl * 0.3 + lag);
    ctx.lineTo(ax - w * 0.42 * s, ay + w * 0.18);
    ctx.lineTo(ax - w * 0.28 * s, ay + w * 0.08);
    ctx.lineTo(ax - w * 0.16 * s, ay + w * 0.2);
    ctx.lineTo(ax - w * 0.04, ay + w * 0.08);
    ctx.closePath(); ctx.fill();
    // wing bones + molten veining
    ctx.strokeStyle = stoneDk; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(ax - w * 0.4 * s, ay - w * 0.34 * s - fl, ax - w * 0.62 * s, ay - w * 0.12 * s - fl * 0.6 + lag); ctx.stroke();
    ctx.lineCap = "butt";
    if (near) { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.3 * (1 - dp); ctx.strokeStyle = lava; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(ax, ay + 2); ctx.lineTo(ax - w * 0.3 * s, ay - fl * 0.4); ctx.stroke(); ctx.restore(); }
    ctx.restore();
  };
  wing(false);

  // dangling clawed legs
  ctx.strokeStyle = stone; ctx.lineCap = "round"; ctx.lineWidth = w * 0.09;
  for (const s of [-1, 1]) {
    const kick = Math.sin(ph + (s > 0 ? 0.6 : 0)) * 2;
    const fx = s * w * 0.1 + kick, fy = y + w * 0.34;
    ctx.beginPath(); ctx.moveTo(s * w * 0.06, y + w * 0.14); ctx.lineTo(fx, fy); ctx.stroke();
    claws(fx, fy, 1.5, w * 0.1, stoneDk, 1.4);
  }
  ctx.lineCap = "butt";

  // tail
  ctx.strokeStyle = stone; ctx.lineCap = "round"; ctx.lineWidth = w * 0.08;
  ctx.beginPath(); ctx.moveTo(-w * 0.06, y + w * 0.06); ctx.quadraticCurveTo(-w * 0.3, y + w * 0.2, -w * 0.26, y + w * 0.4 + Math.sin(T * 3) * 3); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = stoneDk; ctx.save(); ctx.translate(-w * 0.26, y + w * 0.4); ctx.rotate(1.2); ctx.beginPath(); ctx.moveTo(-3, -3); ctx.lineTo(5, 0); ctx.lineTo(-3, 3); ctx.fill(); ctx.restore();

  ctx.save(); ctx.globalAlpha = (1 - dp * 0.4);
  ctx.translate(-recoil * 3, y); ctx.rotate(F.bank); ctx.translate(0, -y);
  // hunched craggy body
  ctx.fillStyle = stone;
  ctx.beginPath(); ctx.ellipse(0, y + w * 0.02, w * 0.34, w * 0.37, -0.1, 0, TAU); ctx.fill();
  ctx.strokeStyle = stoneDk; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, y + w * 0.02, w * 0.34, w * 0.37, -0.1, 0, TAU); ctx.stroke();
  // Faceted clinker plates catch a little light while the furnace cracks remain dark.
  ctx.fillStyle = stoneHi; ctx.globalAlpha = 0.5;
  poly([[-w * 0.26, y - w * 0.08], [-w * 0.08, y - w * 0.28], [w * 0.02, y - w * 0.05], [-w * 0.12, y + w * 0.13]]); ctx.fill();
  poly([[w * 0.07, y - w * 0.23], [w * 0.28, y - w * 0.08], [w * 0.19, y + w * 0.16], [w * 0.02, y + w * 0.02]]); ctx.fill();
  ctx.globalAlpha = (1 - dp * 0.4);
  ctx.fillStyle = stoneHi; ctx.globalAlpha *= 0.5;
  ctx.beginPath(); ctx.ellipse(w * 0.06, y - w * 0.06, w * 0.1, w * 0.14, -0.1, 0, TAU); ctx.fill();
  ctx.globalAlpha = (1 - dp * 0.4);
  // molten chest veins
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (0.3 + heat * 0.2) * (1 - dp);
  ctx.strokeStyle = lava; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-w * 0.06, y - w * 0.1); ctx.lineTo(w * 0.02, y + w * 0.02); ctx.lineTo(-w * 0.04, y + w * 0.14); ctx.stroke();
  ctx.restore();

  // Long stone forearms frame the furnace chest; both brace back during the
  // inhale and snap forward with the lava-spit recoil.
  for (const s of [-1, 1]) {
    const hx = s * w * 0.38 + recoil * w * 0.18, hy = y + w * 0.14 - wind * w * 0.13;
    limb(s * w * 0.2, y - w * 0.04, hx, hy, w * 0.18, w * 0.18, s, w * 0.105, w * 0.075, s < 0 ? stoneDk : stone);
    claws(hx, hy, s > 0 ? 0.45 : 2.65, w * 0.12, stoneDk, 1.3);
  }

  // head: horned stone gargoyle, lava maw
  const hdx = w * 0.16 + wind * 2 - recoil * 2, hdy = y - w * 0.3 - wind * 2;
  ctx.fillStyle = stone; ctx.beginPath(); ctx.arc(hdx, hdy, w * 0.23, 0, TAU); ctx.fill();
  ctx.strokeStyle = stoneDk; ctx.lineWidth = 1.3; ctx.stroke();
  // horns
  ctx.fillStyle = stoneDk;
  poly([[hdx - w * 0.1, hdy - w * 0.08], [hdx - w * 0.22, hdy - w * 0.24], [hdx - w * 0.06, hdy - w * 0.12]]); ctx.fill();
  poly([[hdx + w * 0.1, hdy - w * 0.08], [hdx + w * 0.22, hdy - w * 0.22], [hdx + w * 0.06, hdy - w * 0.12]]); ctx.fill();
  // eyes
  glow(hdx, hdy - w * 0.02, 2.6, t.eye || "#ff7a24", "rgba(255,122,36,0)", (0.5 + wind * 0.3 + 0.2 * dark) * (1 - dp));
  ctx.fillStyle = col(flash, t.eye || "#ff7a24");
  ctx.beginPath(); ctx.arc(hdx - w * 0.05, hdy - w * 0.02, 1.6, 0, TAU); ctx.arc(hdx + w * 0.05, hdy - w * 0.02, 1.6, 0, TAU); ctx.fill();
  // lava maw builds on windup
  const jaw = wind * 0.9 + recoil * 0.3 + 0.1;
  ctx.fillStyle = "#160804";
  ctx.beginPath(); ctx.ellipse(hdx + w * 0.04, hdy + w * 0.09, w * 0.06, w * 0.03 + jaw * w * 0.06, 0, 0, TAU); ctx.fill();
  const maw = Math.max(wind, recoil * recoil);
  if (maw > 0.05) glow(hdx + w * 0.08, hdy + w * 0.09, 3 + wind * 7 + recoil * 4, "rgba(255,220,120,0.9)", "rgba(255,80,10,0)", maw * (1 - dp));
  ctx.restore();

  wing(true);
}

// Obsidian Juggernaut — a colossal warrior forged from volcanic glass; ordinary
// arrows shatter off it (arrowHeavyOnly). Massive faceted black obsidian plates
// with razor edges and deep molten seams; a slow, ground-shaking gait.
export function drawObsidianJuggernaut(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = deathP(e);
  const w = t.w;
  const g = gait(e);
  const A = attackPose(e);

  const obs = col(flash, "#16141a");
  const obsMid = col(flash, "#2a2630");
  const obsHi = col(flash, "#453f52");
  const edge = col(flash, "#6a6478");
  const lava = "#ff6a28";
  const hot = "#ffb050";

  const run = g.run;
  const ph = g.phase * 0.95;
  const stride = Math.sin(ph);
  const foot = Math.pow(Math.abs(stride), 6);
  const drop = foot * 2.6 * run + A.hit * 3.2;
  const heat = 0.4 + 0.2 * Math.sin(T * 3 + e.x);
  const y = groundY;
  const hipY = y - w * 0.32 - drop;

  contactShadow(w * 0.52, 0.28 - dp * 0.14);
  glow(0, y - w * 0.5, w * 0.5, `rgba(255,100,20,${0.12 + heat * 0.06})`, "rgba(80,10,0,0)", (0.3) * (1 - dp));

  const seg = (x1, y1, x2, y2, w1, w2, c) => {
    const dx = x2 - x1, dyy = y2 - y1, L = Math.hypot(dx, dyy) || 1;
    const nx = -dyy / L, ny = dx / L;
    ctx.fillStyle = c;
    poly([[x1 + nx * w1, y1 + ny * w1], [x2 + nx * w2, y2 + ny * w2], [x2 - nx * w2, y2 - ny * w2], [x1 - nx * w1, y1 - ny * w1]]);
    ctx.fill();
  };
  const seam = (pts, wd, a) => {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a * (0.6 + heat * 0.4) * (1 - dp);
    ctx.strokeStyle = lava; ctx.lineWidth = wd; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
    ctx.restore();
  };

  // legs: thick glass pillars
  for (const side of [1, 0]) {
    const phs = ph + side * Math.PI;
    const lift = Math.max(0, -Math.sin(phs)) * 2.6 * (0.3 + run);
    const fx = -w * 0.16 + side * w * 0.32;
    seg(-w * 0.08 + side * w * 0.16, hipY, fx, y - lift, w * 0.1, w * 0.09, side ? obs : obsMid);
    ctx.fillStyle = side ? obs : obsMid;
    poly([[fx - w * 0.12, y - lift - w * 0.05], [fx + w * 0.1, y - lift - w * 0.05], [fx + w * 0.08, y - lift], [fx - w * 0.14, y - lift]]); ctx.fill();
    seam([[-w * 0.02 + side * w * 0.16, hipY + w * 0.04], [fx, y - lift - w * 0.06]], 0.9, 0.4);
  }

  // Far arm braces the load, then crashes down with the main fist.
  {
    const a = A.active ? mix(0.75, -2.0, A.raise) : 2.0;
    const sx = -w * 0.26, sy = y - w * 0.62 - drop;
    const hx = sx + Math.cos(a) * w * 0.48, hy = sy + Math.sin(a) * w * 0.48;
    seg(sx, sy, hx, hy, w * 0.08, w * 0.07, obs);
    ctx.fillStyle = obs; poly([[hx - w * 0.11, hy - w * 0.08], [hx + w * 0.11, hy - w * 0.05], [hx + w * 0.08, hy + w * 0.11], [hx - w * 0.1, hy + w * 0.09]]); ctx.fill();
  }

  ctx.save();
  ctx.translate(0, hipY); ctx.rotate(g.lean * 0.06 - A.wind * 0.07 + A.hit * 0.1); ctx.translate(0, -hipY);

  // faceted torso
  ctx.fillStyle = obsMid;
  poly([[-w * 0.3, y - w * 0.3], [-w * 0.36, y - w * 0.64], [-w * 0.18, y - w * 0.78],
        [w * 0.22, y - w * 0.78], [w * 0.4, y - w * 0.62], [w * 0.34, y - w * 0.3]]);
  ctx.fill();
  // sharp facet highlights
  ctx.fillStyle = obsHi; ctx.globalAlpha = 0.7;
  poly([[-w * 0.04, y - w * 0.74], [w * 0.16, y - w * 0.66], [w * 0.02, y - w * 0.4], [-w * 0.1, y - w * 0.5]]); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = obs;
  poly([[-w * 0.3, y - w * 0.3], [-w * 0.36, y - w * 0.64], [-w * 0.2, y - w * 0.6], [-w * 0.18, y - w * 0.32]]); ctx.fill();
  // razor edge glints
  ctx.strokeStyle = edge; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.moveTo(-w * 0.18, y - w * 0.78); ctx.lineTo(w * 0.22, y - w * 0.78); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.22, y - w * 0.78); ctx.lineTo(w * 0.4, y - w * 0.62); ctx.stroke();
  ctx.globalAlpha = 1;
  // jagged obsidian shoulder shards
  ctx.fillStyle = obs;
  for (const [sx, sy, h] of [[-w * 0.32, y - w * 0.66, w * 0.24], [w * 0.34, y - w * 0.64, w * 0.28], [0, y - w * 0.82, w * 0.18]]) {
    poly([[sx - w * 0.06, sy], [sx + w * 0.02, sy - h], [sx + w * 0.08, sy]]); ctx.fill();
  }
  // molten seams across the body
  seam([[-w * 0.16, y - w * 0.32], [-w * 0.06, y - w * 0.52], [-w * 0.14, y - w * 0.7]], 1.4, 0.8);
  seam([[w * 0.12, y - w * 0.3], [w * 0.04, y - w * 0.5], [w * 0.12, y - w * 0.68]], 1.4, 0.8);
  seam([[-w * 0.14, y - w * 0.5], [w * 0.12, y - w * 0.5]], 1.1, 0.6);
  // molten core
  glow(0, y - w * 0.5, w * 0.14, "rgba(255,140,40,0.9)", "rgba(200,40,0,0)", (0.5 + heat * 0.3) * (1 - dp));

  // head: angular glass helm with burning eyes
  const hdy = y - w * 0.86;
  ctx.fillStyle = obs;
  poly([[-w * 0.12, hdy + w * 0.1], [-w * 0.1, hdy - w * 0.06], [0, hdy - w * 0.1], [w * 0.1, hdy - w * 0.06], [w * 0.12, hdy + w * 0.1], [0, hdy + w * 0.14]]); ctx.fill();
  ctx.fillStyle = obsHi; ctx.globalAlpha = 0.5;
  poly([[-w * 0.02, hdy - w * 0.08], [w * 0.08, hdy - w * 0.04], [0, hdy + w * 0.06]]); ctx.fill();
  ctx.globalAlpha = 1;
  glow(-w * 0.05, hdy, 3, t.eye || "#ff6a28", "rgba(255,106,40,0)", (0.6 + 0.3 * dark) * (1 - dp));
  glow(w * 0.05, hdy, 3, t.eye || "#ff6a28", "rgba(255,106,40,0)", (0.6 + 0.3 * dark) * (1 - dp));
  ctx.fillStyle = col(flash, t.eye || "#ff6a28");
  poly([[-w * 0.08, hdy - w * 0.01], [-w * 0.02, hdy - w * 0.02], [-w * 0.03, hdy + w * 0.02], [-w * 0.08, hdy + w * 0.02]]); ctx.fill();
  poly([[w * 0.08, hdy - w * 0.01], [w * 0.02, hdy - w * 0.02], [w * 0.03, hdy + w * 0.02], [w * 0.08, hdy + w * 0.02]]); ctx.fill();

  // near arm: massive glass fist, overhead smash
  {
    const a = A.active ? mix(0.62, -2.4, A.raise) : (0.95 + Math.sin(T * 1.3 + e.x) * 0.04);
    const r = w * 0.52;
    const hx = w * 0.26 + Math.cos(a) * r, hy = y - w * 0.6 + Math.sin(a) * r;
    seg(w * 0.3, y - w * 0.62, hx, hy, w * 0.1, w * 0.09, obsMid);
    ctx.fillStyle = obs;
    poly([[hx - w * 0.14, hy - w * 0.1], [hx + w * 0.14, hy - w * 0.06], [hx + w * 0.1, hy + w * 0.14], [hx - w * 0.14, hy + w * 0.1]]); ctx.fill();
    ctx.fillStyle = obsHi; ctx.globalAlpha = 0.5; poly([[hx - w * 0.06, hy - w * 0.06], [hx + w * 0.08, hy - w * 0.02], [hx, hy + w * 0.06]]); ctx.fill(); ctx.globalAlpha = 1;
    seam([[hx - w * 0.08, hy], [hx + w * 0.08, hy]], 1, 0.6);
    if (A.striking && A.raise < 0.7) { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (0.7 - A.raise) * 0.55; ctx.strokeStyle = lava; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w * 0.26, y - w * 0.6, r, -2.2, 0.5); ctx.stroke(); ctx.restore(); }
  }
  ctx.restore();

  if (A.hit > 0.3 && !e.dying) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (A.hit - 0.3) * 0.8;
    ctx.strokeStyle = lava; ctx.lineWidth = 1.6;
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(15, y - 1); ctx.lineTo(27 + Math.abs(k) * 3, y - 2 + k * 4); ctx.stroke(); }
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CORRUPTED
// ═══════════════════════════════════════════════════════════════════════════

// Shadow-Stalker — a near-invisible corruption-wraith seen only as a shimmer in
// the air until it strikes (stealth / panicTouch). A barely-there silhouette
// with a distortion halo, two cold violet eyes, and clawed hands that solidify
// as it lunges; touch corrupts defenders into fleeing.
export function drawShadowStalker(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = deathP(e);
  const g = gait(e);
  const A = attackPose(e);
  const run = g.run, lean = g.lean;

  // solidity: mostly transparent, snaps solid on attack / flash
  const strike = Math.max(A.wind * 0.45, A.swing);
  const solidity = flash ? 1 : clamp01(0.22 + strike * 0.7 + run * 0.12);

  const body = col(flash, "#1b1228");
  const bodyMid = col(flash, "#2e2044");
  const violet = t.eye || "#9f72ff";

  const drift = Math.sin(T * 2.4 + e.x * 0.13);
  const y = groundY - 4 + drift * 1.5;
  const ph = g.phase * 2.6;
  const lunge = Math.max(0, A.ext) * 9;

  // faint contact ripple
  contactShadow(11, 0.1 * solidity);

  // shimmer distortion halo (always visible even when body isn't)
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = (0.1 + (1 - solidity) * 0.12) * (1 - dp);
  const sg = ctx.createRadialGradient(0, y - 16, 2, 0, y - 16, 22);
  sg.addColorStop(0, "rgba(120,90,180,0.5)"); sg.addColorStop(1, "rgba(30,15,50,0)");
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(Math.sin(T * 5) * 2, y - 16, 16, 22, 0, 0, TAU); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = solidity * (1 - dp * 0.4);
  ctx.translate(lunge, 0);

  // wispy legs fading into smoke
  ctx.strokeStyle = body; ctx.lineCap = "round"; ctx.lineWidth = 2.6;
  for (const s of [-1, 1]) {
    const phs = ph + (s > 0 ? Math.PI : 0);
    const fx = s * 4 + Math.cos(phs) * 3 * (0.3 + run);
    ctx.beginPath(); ctx.moveTo(s * 2, y - 10); ctx.lineTo(fx, y - 1 + Math.sin(T * 4 + s) * 1); ctx.stroke();
  }
  ctx.lineCap = "butt";

  // thin hunched body
  ctx.save();
  ctx.translate(-1, y - 10); ctx.rotate(lean * 0.16 - A.wind * 0.2 + A.swing * 0.16); ctx.translate(1, -(y - 10));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-4, y - 8);
  ctx.quadraticCurveTo(-6, y - 20, -1, y - 26);
  ctx.quadraticCurveTo(5, y - 22, 5, y - 10);
  ctx.quadraticCurveTo(3, y - 4, -4, y - 8);
  ctx.fill();
  // trailing smoke wisps
  ctx.fillStyle = bodyMid; ctx.globalAlpha = solidity * 0.6 * (1 - dp);
  for (let k = 0; k < 3; k++) {
    const sway = Math.sin(T * 3 + k) * 2;
    ctx.beginPath(); ctx.moveTo(-2, y - 18 + k * 2); ctx.quadraticCurveTo(-8 - k * 2 + sway, y - 12 + k * 3, -6 + sway, y - 2); ctx.quadraticCurveTo(-3, y - 8, -2, y - 16); ctx.fill();
  }
  ctx.globalAlpha = solidity * (1 - dp * 0.4);

  // head: smooth featureless with two violet eyes
  const hdx = 3 + lean * 1.2 + strike * 1.4, hdy = y - 26;
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(hdx, hdy, 4.4, 5, -0.1, 0, TAU); ctx.fill();
  // eyes — the one thing always bright
  ctx.restore();
  ctx.globalAlpha = clamp01(solidity + 0.5) * (1 - dp);
  const hx2 = 3 + lean * 1.2 + strike * 1.4, hy2 = y - 26;
  glow(hx2 - 1.5, hy2, 2.4, violet, "rgba(159,114,255,0)", (0.7 + 0.3 * dark) * (1 - dp));
  glow(hx2 + 2, hy2, 2.4, violet, "rgba(159,114,255,0)", (0.7 + 0.3 * dark) * (1 - dp));
  ctx.fillStyle = col(flash, violet);
  ctx.beginPath(); ctx.ellipse(hx2 - 1.5, hy2, 1, 1.8, 0.2, 0, TAU); ctx.ellipse(hx2 + 2, hy2, 1, 1.8, -0.2, 0, TAU); ctx.fill();
  ctx.globalAlpha = solidity * (1 - dp * 0.4);

  // clawed arm, solidifies and slashes on strike
  {
    const a = A.active ? mix(-2.2, 0.7, A.swing) : (0.9 + Math.sin(T * 2 + e.x) * 0.1);
    const r = 10 + strike * 3;
    const hx = 4 + Math.cos(a) * r, hy = y - 16 + Math.sin(a) * r;
    ctx.strokeStyle = body; ctx.lineCap = "round"; ctx.lineWidth = 2.4 + strike;
    ctx.beginPath(); ctx.moveTo(2, y - 18); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.lineCap = "butt";
    claws(hx, hy, a + 0.3, 3.5 + strike * 1.5, col(flash, "#c9a8ff"), 1.2);
    // corruption smear on the slash
    if (A.hit > 0.2) { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = A.hit * 0.55; ctx.strokeStyle = violet; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(3, y - 16, r, -2, 0.6); ctx.stroke(); ctx.restore(); }
  }
  ctx.restore();
}

// Rift-Weaver — a hovering cultist that tears open dimensional rifts to
// teleport enemies past the wall (flying / breeder spawns e.spawnCd). Hooded,
// weightless, spectral weaving hands conjuring a violet rift disc that widens
// as a summon nears.
export function drawRiftWeaver(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = deathP(e);
  const w = t.w;
  const F = flightMotion(e, T, 3.6, e.shootCd, 0.95);

  const robe = col(flash, "#2b1740");
  const robeDk = col(flash, "#180a28");
  const robeHi = col(flash, "#432465");
  const violet = t.eye || "#d7a8ff";

  const y = groundY - w * 1.0 + F.hover;
  const spawnCd = e.spawnCd ?? 8;
  const spawnWind = cooldownCharge(spawnCd, 1.6);
  const spawnRelease = F.A.kind === "spawn" && F.A.striking ? 1 - ease(Math.max(0, F.A.p)) : 0;
  const weaving = spawnWind > 0.02 || spawnRelease > 0.02;
  const riftP = weaving ? Math.max(spawnWind, spawnRelease) : 0.15 + 0.1 * Math.sin(T * 2);
  const sway = Math.sin(T * 1.3 + e.x) * 0.08 + F.bank;

  // the rift disc conjured in front
  if (riftP > 0.05) {
    const rr = w * (0.2 + riftP * 0.45);
    const rx = w * 0.5, ry = y + w * 0.1;
    ctx.save();
    glow(rx, ry, rr * 1.4, `rgba(215,168,255,${0.4 * riftP})`, "rgba(80,20,120,0)", riftP * (1 - dp));
    ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = riftP * (1 - dp);
    // swirling rift ring
    ctx.strokeStyle = violet; ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      ctx.globalAlpha = riftP * (0.6 - k * 0.15) * (1 - dp);
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * TAU + T * (2 + k) * (k % 2 ? -1 : 1);
        const r = rr * (1 - k * 0.22) * (1 + 0.12 * Math.sin(a * 3 + T * 4));
        const px = rx + Math.cos(a) * r, py = ry + Math.sin(a) * r * 0.5;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
    }
    // dark core
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = riftP * 0.8 * (1 - dp);
    ctx.fillStyle = "#0a0416"; ctx.beginPath(); ctx.ellipse(rx, ry, rr * 0.5, rr * 0.28, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = (1 - dp * 0.4);
  ctx.translate(-F.recoil * 3, y); ctx.rotate(sway); ctx.translate(0, -y);

  // flowing robe trailing into nothing
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-w * 0.24, y - w * 0.4);
  ctx.quadraticCurveTo(-w * 0.34, y + w * 0.24, -w * 0.16 + Math.sin(T * 3) * 4, y + w * 0.52);
  ctx.quadraticCurveTo(0, y + w * 0.38, w * 0.16 + Math.sin(T * 3 + 1) * 4, y + w * 0.52);
  ctx.quadraticCurveTo(w * 0.34, y + w * 0.24, w * 0.24, y - w * 0.4);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = robeDk; ctx.globalAlpha *= 0.6;
  ctx.beginPath(); ctx.moveTo(-w * 0.24, y - w * 0.4); ctx.quadraticCurveTo(-w * 0.34, y + w * 0.24, -w * 0.16, y + w * 0.52); ctx.quadraticCurveTo(-w * 0.04, y + w * 0.38, -w * 0.02, y - w * 0.4); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = (1 - dp * 0.4);
  // runic hem glow
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (0.3 + riftP * 0.3) * (1 - dp);
  ctx.strokeStyle = violet; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-w * 0.16, y + w * 0.48); ctx.quadraticCurveTo(0, y + w * 0.36, w * 0.16, y + w * 0.48); ctx.stroke();
  ctx.restore();

  // hood + shoulders
  ctx.fillStyle = robeHi;
  poly([[-w * 0.24, y - w * 0.36], [-w * 0.08, y - w * 0.54], [w * 0.08, y - w * 0.54], [w * 0.24, y - w * 0.36], [w * 0.14, y - w * 0.24], [-w * 0.14, y - w * 0.24]]); ctx.fill();
  ctx.fillStyle = robe;
  ctx.beginPath(); ctx.moveTo(-w * 0.14, y - w * 0.44); ctx.quadraticCurveTo(0, y - w * 0.7, w * 0.14, y - w * 0.44); ctx.quadraticCurveTo(w * 0.08, y - w * 0.38, 0, y - w * 0.4); ctx.quadraticCurveTo(-w * 0.08, y - w * 0.38, -w * 0.14, y - w * 0.44); ctx.fill();
  // dark hood void + three eyes (corrupted)
  ctx.fillStyle = "#08040e";
  ctx.beginPath(); ctx.ellipse(0, y - w * 0.46, w * 0.1, w * 0.12, 0, 0, TAU); ctx.fill();
  glow(0, y - w * 0.47, 3, violet, "rgba(215,168,255,0)", (0.7 + 0.3 * dark) * (1 - dp));
  ctx.fillStyle = col(flash, violet);
  ctx.beginPath(); ctx.arc(-w * 0.04, y - w * 0.48, 1.1, 0, TAU); ctx.arc(w * 0.04, y - w * 0.48, 1.1, 0, TAU); ctx.arc(0, y - w * 0.43, 1, 0, TAU); ctx.fill();

  // spectral weaving hands, tracing the rift
  ctx.strokeStyle = robeDk; ctx.lineCap = "round"; ctx.lineWidth = w * 0.05;
  for (const s of [1, -1]) {
    const wv = weaving ? Math.sin(T * (8 + spawnWind * 5) + s) * 4 : Math.sin(T * 2 + s) * 2;
    const hx = w * (0.2 + s * 0.06) + F.recoil * w * 0.12, hy = y - w * (0.1 + spawnWind * 0.12) + wv;
    ctx.beginPath(); ctx.moveTo(s > 0 ? w * 0.1 : -w * 0.1, y - w * 0.28); ctx.quadraticCurveTo(w * 0.16, y - w * 0.24, hx, hy); ctx.stroke();
    glow(hx, hy, 3 + riftP * 2, violet, "rgba(215,168,255,0)", (0.4 + riftP * 0.4) * (1 - dp));
    ctx.fillStyle = col(flash, "#e8d0ff"); ctx.beginPath(); ctx.arc(hx, hy, 1.6, 0, TAU); ctx.fill();
  }
  ctx.lineCap = "butt";
  ctx.restore();
}

// The Amalgam — a nightmare of fused, screaming souls: a churning mass of
// glowing violet faces and grasping arms. Each wall-strike (coinShock) sends a
// shock ring outward and the faces wail. Slow, lurching, ever-shifting bulk.
export function drawAmalgam(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = deathP(e);
  const w = t.w;
  const g = gait(e);
  const A = attackPose(e);

  const fleshDk = col(flash, "#21162f");
  const flesh = col(flash, "#3a2850");
  const fleshLt = col(flash, "#54386f");
  const violet = t.eye || "#d7a8ff";
  const soul = "#b98aff";

  const y = groundY - w * 0.02;
  const churn = T * 1.5;
  const bob = Math.abs(Math.sin(g.phase * 1.1)) * 1.8 * g.run;
  const shock = A.striking ? clamp01(A.p * 1.3) : -1;
  const lash = A.swing;

  contactShadow(w * 0.5, 0.24 - dp * 0.12);

  // outgoing coin-shock ring on a strike
  if (shock >= 0 && shock < 1) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (1 - shock) * 0.6 * (1 - dp);
    ctx.strokeStyle = violet; ctx.lineWidth = 3 * (1 - shock) + 1;
    ctx.beginPath(); ctx.ellipse(0, groundY - 2, w * 0.3 + shock * w * 0.9, w * 0.1 + shock * w * 0.3, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  // aura
  glow(0, y - w * 0.34, w * 0.6, `rgba(160,110,220,${0.2 + (shock > 0 ? (1 - shock) * 0.3 : 0)})`, "rgba(60,20,100,0)", 0.4 * (1 - dp));

  ctx.save();
  ctx.translate(lash * w * 0.06 + g.lean * 2, groundY);
  ctx.scale(1 + A.wind * 0.08 + lash * 0.12, 1 - A.wind * 0.06 - lash * 0.09);
  ctx.translate(0, -groundY);

  // A complete, lobed outline replaces the old flat-bottomed mound: fused
  // shoulders, hips and torsos continually trade places around the perimeter.
  const bodyY = y - w * 0.3 - bob;
  ctx.fillStyle = fleshDk;
  ctx.beginPath();
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * TAU;
    const rr = 1 + 0.12 * Math.sin(a * 3 + churn + lash * 2) + 0.075 * Math.sin(a * 7 - churn * 1.3);
    const px = Math.cos(a) * w * 0.46 * rr, py = bodyY + Math.sin(a) * w * 0.38 * rr;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = col(flash, "#120a1c"); ctx.lineWidth = 1.8; ctx.stroke();

  // Overlapping anatomy lobes make the volume a knot of bodies, not a single
  // rubber surface. Their slow offset is the constant background writhing.
  ctx.fillStyle = flesh; ctx.globalAlpha = 0.72;
  for (let k = 0; k < 5; k++) {
    const a = k * 1.41 + churn * (k % 2 ? -0.12 : 0.1);
    const lx = Math.cos(a) * w * 0.21, ly = bodyY + Math.sin(a) * w * 0.17;
    ctx.beginPath(); ctx.ellipse(lx, ly, w * (0.16 + (k % 2) * 0.035), w * (0.18 + ((k + 1) % 2) * 0.035), a * 0.35, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = fleshLt; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.28;
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath(); ctx.arc(k * w * 0.08, bodyY + w * 0.07, w * (0.11 + Math.abs(k) * 0.012), 3.55, 5.9); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Half-submerged hands repeatedly press through the skin before sinking.
  for (let k = 0; k < 4; k++) {
    const ph3 = churn * 1.15 + k * 1.7;
    const emerge = clamp01(0.35 + Math.sin(ph3) * 0.65);
    const hx = Math.cos(k * 2.05 + 0.5) * w * 0.31;
    const hy = bodyY + Math.sin(k * 1.8) * w * 0.2;
    ctx.globalAlpha = emerge * 0.72;
    ctx.fillStyle = fleshLt; ctx.beginPath(); ctx.ellipse(hx, hy, w * 0.045, w * 0.065, ph3 * 0.12, 0, TAU); ctx.fill();
    claws(hx, hy - w * 0.035, -1.55 + Math.sin(ph3) * 0.25, w * 0.055, fleshLt, 1.1);
  }
  ctx.globalAlpha = 1;

  // fused screaming faces surfacing and sinking
  ctx.save();
  for (let k = 0; k < 7; k++) {
    const ph2 = churn * 0.7 + k * 1.3;
    const surf = Math.sin(ph2);
    if (surf < -0.2) continue;
    const fx = Math.cos(k * 1.9 + churn * 0.3) * w * 0.29;
    const fy = bodyY - w * 0.02 + Math.sin(k * 2.3) * w * 0.22;
    const s = 0.5 + surf * 0.5;
    const wail = shock > 0 && shock < 0.6 ? 1 : 0.3 + 0.3 * Math.sin(T * 3 + k);
    ctx.globalAlpha = clamp01(s) * (1 - dp * 0.4);
    // face
    ctx.fillStyle = fleshLt;
    ctx.beginPath(); ctx.ellipse(fx, fy, w * 0.08 * s, w * 0.1 * s, 0, 0, TAU); ctx.fill();
    // hollow eyes + wailing mouth
    glow(fx, fy - w * 0.02, 2 * s, violet, "rgba(215,168,255,0)", 0.5 * s * (1 - dp));
    ctx.fillStyle = "#0c0616";
    ctx.beginPath(); ctx.arc(fx - w * 0.03 * s, fy - w * 0.02 * s, w * 0.012 * s + 0.4, 0, TAU); ctx.arc(fx + w * 0.03 * s, fy - w * 0.02 * s, w * 0.012 * s + 0.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(fx, fy + w * 0.04 * s, w * 0.018 * s + 0.4, (w * 0.02 * s + 0.4) * (0.6 + wail), 0, 0, TAU); ctx.fill();
  }
  ctx.restore();

  // Several fused arms coil together, then lash at once on the shared impact.
  ctx.save();
  ctx.strokeStyle = flesh; ctx.lineCap = "round";
  const armSides = [-1, 1, -0.58, 0.62, 0.16];
  for (let k = 0; k < armSides.length; k++) {
    const s = armSides[k];
    const reach = 0.5 + 0.5 * Math.sin(churn + k * 1.47);
    const bx = s * w * 0.2, by = bodyY;
    const coilBack = A.wind * w * (0.08 + (k % 2) * 0.025);
    const hx = s * w * (0.32 + reach * 0.1) - coilBack + lash * w * (0.28 + k * 0.018);
    const hy = by + w * 0.1 - reach * w * 0.14 + A.wind * (k - 2) * 2 - lash * w * (0.04 + (k % 3) * 0.025);
    ctx.globalAlpha = (0.7 + reach * 0.3) * (1 - dp * 0.4);
    ctx.lineWidth = w * (0.038 + (k % 2) * 0.01);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(s * w * 0.28 - coilBack * 0.5 + lash * w * 0.12, by - w * 0.05, hx, hy); ctx.stroke();
    // grasping hand
    claws(hx, hy, s > 0 ? -0.5 : (s < 0 ? -2.6 : -1.5), w * 0.08, fleshLt, 1.4);
  }
  ctx.restore();

  // the dominant central eye/maw
  const ey = y - w * 0.36 - bob;
  glow(0, ey, w * 0.16, violet, "rgba(215,168,255,0)", (0.5 + 0.2 * dark + (shock > 0 ? (1 - shock) * 0.3 : 0)) * (1 - dp));
  ctx.fillStyle = col(flash, violet);
  ctx.beginPath(); ctx.ellipse(0, ey, w * 0.05, w * 0.07, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#0a0414"; ctx.beginPath(); ctx.ellipse(0, ey, w * 0.02, w * 0.04, 0, 0, TAU); ctx.fill();
  // drifting soul motes
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (1 - dp) * 0.5; ctx.fillStyle = soul;
  for (let k = 0; k < 4; k++) { const ft = (T * 0.5 + k * 0.28) % 1; ctx.beginPath(); ctx.arc(Math.sin(churn + k * 2) * w * 0.4, ey - ft * w * 0.5, 1 * (1 - ft) + 0.4, 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.restore();
}
