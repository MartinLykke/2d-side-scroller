import { clamp, lerp } from '../../util/math.js';
import { ctx, groundY } from '../../core/canvas.js';
import { state } from '../../core/state.js';
import { visibleWorldBounds } from '../Viewport.js';

// ---------------------------------------------------------------------------
// Procedural forest game: deer and rabbit.
// States come from updateAnimals: "graze" (eating, occasional look-up),
// "walk", "flee" (hunted), plus a.dying/a.deathT for the collapse.
// Local space: translate(a.x,0), mirror for dir<0 — east pose authored.
// ---------------------------------------------------------------------------

const ease = p => p * p * (3 - 2 * p);
const STUCK_ARROW_FADE_TIME = 0.55;

function fadeAlpha(a) {
  return a.deathT > 3.5 ? clamp(1 - (a.deathT - 3.5) / 1.5, 0, 1) : 1;
}

function stuckArrowAlpha(ar) {
  return clamp(ar.t / Math.min(STUCK_ARROW_FADE_TIME, ar.maxT || STUCK_ARROW_FADE_TIME), 0, 1);
}

// ---------------- Deer ----------------
const DEER = { body: "#7a5636", belly: "#93714a", limb: "#5f4228", ear: "#c9a684", antler: "#8a7050" };

function drawDeer(a) {
  const t = performance.now() / 1000;
  const flee = a.state === "flee" && !a.dying;
  const walk = a.state === "walk" && !a.dying;
  const dp = a.dying ? ease(Math.min(a.deathT / 1.1, 1)) : 0; // collapse progress

  ctx.save();
  ctx.translate(a.x, 0);
  if (a.dir < 0) ctx.scale(-1, 1);
  ctx.globalAlpha = fadeAlpha(a);

  // gallop: body bounds and stretches; walk: gentle sway
  const g = a.anim;
  const hop = flee ? Math.abs(Math.sin(g * 0.8)) * 5 * (1 - dp) : 0;
  const stretch = flee ? 1 + Math.sin(g * 1.6) * 0.09 : 1;
  const sway = walk ? Math.sin(g) * 0.6 : 0;

  // death: body sinks and tips, legs fold, neck curls back to the flank
  const bodyY = lerp(groundY - 16 - hop + sway, groundY - 6.5, dp);
  const bodyRot = dp * 0.45;

  // --- legs (thin, elegant) ---
  if (dp < 1) {
    const fold = dp * 8; // legs pull in as she collapses
    ctx.strokeStyle = DEER.limb; ctx.lineWidth = 1.8; ctx.lineCap = "round";
    for (const [ax, phase] of [[7, 0], [9.5, Math.PI], [-7, Math.PI], [-9.5, 0]]) {
      let footX = ax, lift = 0;
      if (flee) {
        // gallop: pairs swing together and tuck under the body
        const sw = Math.sin(g * 1.6 + (ax > 0 ? 0 : Math.PI));
        footX = ax + sw * 7;
        lift = Math.max(0, -Math.cos(g * 1.6 + (ax > 0 ? 0 : Math.PI))) * 5;
      } else if (walk) {
        footX = ax + Math.sin(g + phase) * 3.5;
      }
      ctx.beginPath();
      ctx.moveTo(ax * 0.9, bodyY + 3);
      ctx.lineTo(footX, groundY - lift - fold);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
  }

  // --- body ---
  ctx.fillStyle = DEER.body;
  ctx.beginPath(); ctx.ellipse(0, bodyY, 12 * stretch, 5.5, -bodyRot, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = DEER.belly;
  ctx.beginPath(); ctx.ellipse(1, bodyY + 2.2, 8.5 * stretch, 3, -bodyRot, 0, Math.PI * 2); ctx.fill();
  // tail nub
  ctx.fillStyle = DEER.ear;
  ctx.beginPath(); ctx.ellipse(-11.5 * stretch, bodyY - 2 + dp * 2, 2, 2.8, 0.5, 0, Math.PI * 2); ctx.fill();

  // --- neck + head ---
  // Head position: up-alert, stretched forward at a gallop, down at the grass,
  // or curled back against the body when dying.
  const eat = ease(a.eatDown || 0);
  const upHead = flee ? { x: 17, y: bodyY - 9 } : { x: 15, y: bodyY - 13 };
  const downHead = { x: 17.5, y: groundY - 3.5 };
  let head = { x: lerp(upHead.x, downHead.x, eat), y: lerp(upHead.y, downHead.y, eat) };
  if (dp > 0) head = { x: lerp(head.x, 4, dp), y: lerp(head.y, groundY - 7.5, dp) };
  const neckBase = { x: 9 * stretch, y: bodyY - 1.5 };

  ctx.strokeStyle = DEER.body; ctx.lineWidth = 3.6; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(neckBase.x, neckBase.y);
  ctx.quadraticCurveTo(
    lerp(neckBase.x + 4, neckBase.x + 6, eat), lerp(head.y + 4, bodyY - 6, dp > 0 ? dp : eat * 0.4),
    head.x, head.y
  );
  ctx.stroke();
  ctx.lineCap = "butt";

  // head + snout
  const nibble = eat > 0.85 ? Math.sin(t * 14) * 0.5 : 0;
  ctx.fillStyle = DEER.body;
  ctx.beginPath(); ctx.arc(head.x, head.y, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(head.x + 3.2, head.y + 1 + nibble * 0.3, 2.6, 1.6, eat * 0.5, 0, Math.PI * 2); ctx.fill();
  // jaw nibbling line
  if (eat > 0.85 && !a.dying) {
    ctx.strokeStyle = DEER.limb; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(head.x + 2, head.y + 2.2); ctx.lineTo(head.x + 4.5, head.y + 2.6 + nibble); ctx.stroke();
  }
  // eye
  ctx.fillStyle = "#241a10";
  ctx.beginPath(); ctx.arc(head.x + 0.8, head.y - 0.8, 0.8, 0, Math.PI * 2); ctx.fill();

  // ear with occasional flick
  const flick = a.earFlick > 0 ? Math.sin(a.earFlick * 28) * 0.5 : 0;
  ctx.save();
  ctx.translate(head.x - 1.5, head.y - 2.5); ctx.rotate(-0.7 + flick - eat * 0.3);
  ctx.fillStyle = DEER.body;
  ctx.beginPath(); ctx.ellipse(0, -2.5, 1.4, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = DEER.ear;
  ctx.beginPath(); ctx.ellipse(0, -2.3, 0.7, 1.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // small antlers
  ctx.strokeStyle = DEER.antler; ctx.lineWidth = 1.2; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(head.x + 0.5, head.y - 2.5); ctx.lineTo(head.x - 1, head.y - 7);
  ctx.moveTo(head.x - 0.4, head.y - 4.8); ctx.lineTo(head.x - 2.6, head.y - 6.5);
  ctx.moveTo(head.x + 1.5, head.y - 2.8); ctx.lineTo(head.x + 3, head.y - 7);
  ctx.moveTo(head.x + 2.2, head.y - 4.8); ctx.lineTo(head.x + 4.4, head.y - 6.2);
  ctx.stroke();
  ctx.lineCap = "butt";

  ctx.restore();
}

// ---------------- Rabbit ----------------
const RAB = { body: "#8a7a6a", belly: "#a89684", earIn: "#bb9088", tail: "#e8e0d4", eye: "#241a10" };

function drawRabbit(a) {
  const t = performance.now() / 1000;
  const flee = a.state === "flee" && !a.dying;
  const walk = a.state === "walk" && !a.dying;
  const scan = a.dying ? 0 : ease(a.scan || 0);   // standing upright, ears up
  const dp = a.dying ? ease(Math.min(a.deathT / 0.3, 1)) : 0; // fast flip

  ctx.save();
  ctx.translate(a.x, 0);
  if (a.dir < 0) ctx.scale(-1, 1);
  ctx.globalAlpha = fadeAlpha(a);

  const g = a.anim;
  // hop: airtime plus a squash on landing (exaggerated at a sprint)
  const hopAmp = flee ? 7 : walk ? 3.5 : 0;
  const cyc = Math.sin(g * (flee ? 1.1 : 0.8));
  const hop = Math.abs(cyc) * hopAmp;
  const squash = hopAmp > 0 ? (1 - Math.abs(cyc)) * (flee ? 0.3 : 0.18) : 0;

  if (dp > 0) {
    // quick flip onto the side, pivoting at the ground contact point
    ctx.translate(0, groundY - 4 + dp * 2);
    ctx.rotate(-dp * 1.55);
    ctx.translate(0, -(groundY - 4));
  } else {
    ctx.translate(0, -hop);
    ctx.translate(0, groundY - 4); ctx.scale(1 + squash, 1 - squash); ctx.translate(0, -(groundY - 4));
  }

  // body: round at rest, stretched flat mid-leap, upright when scanning
  const bodyRx = flee ? 7.2 + Math.abs(cyc) * 1.5 : lerp(6, 4.2, scan);
  const bodyRy = flee ? 3.6 : lerp(4.2, 6.4, scan);
  const bodyY = lerp(groundY - 5.5, groundY - 8, scan);
  ctx.fillStyle = RAB.body;
  ctx.beginPath(); ctx.ellipse(0, bodyY, bodyRx, bodyRy, flee ? -0.1 : 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = RAB.belly;
  ctx.beginPath(); ctx.ellipse(lerp(1, 1.5, scan), bodyY + 1.5, bodyRx * 0.6, bodyRy * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  // fluffy tail
  ctx.fillStyle = RAB.tail;
  ctx.beginPath(); ctx.arc(-bodyRx + 0.5, bodyY - 1 + scan * 3, 1.8, 0, Math.PI * 2); ctx.fill();

  // feet: big hind foot + small forepaw
  ctx.strokeStyle = RAB.body; ctx.lineWidth = 1.8; ctx.lineCap = "round";
  if (dp > 0) {
    // legs curled up
    for (const [lx, ly] of [[-2, groundY - 4], [1, groundY - 3], [3.5, groundY - 4]]) {
      ctx.beginPath(); ctx.arc(lx, ly, 1.6, 0.4, Math.PI + 0.6); ctx.stroke();
    }
  } else if (flee) {
    const kick = cyc * 5;
    ctx.beginPath(); ctx.moveTo(-4, bodyY + 2); ctx.lineTo(-6 - Math.max(0, -kick), groundY - Math.max(0, kick * 0.6)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4.5, bodyY + 2); ctx.lineTo(6 + Math.max(0, kick * 0.5), groundY - Math.max(0, -kick * 0.4)); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-3.5, bodyY + 3); ctx.lineTo(-5, groundY); ctx.stroke();
    if (scan < 0.5) { ctx.beginPath(); ctx.moveTo(4, bodyY + 3); ctx.lineTo(4.8, groundY); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(2.5, bodyY + 3); ctx.lineTo(4, bodyY + 5.5); ctx.stroke(); } // forepaws tucked up
  }
  ctx.lineCap = "butt";

  // head: nibbling low, or lifted high when scanning; nose always twitching
  const eat = a.dying ? 0 : ease(a.eatDown || 0) * (1 - scan);
  const nib = eat > 0.5 ? Math.sin(t * 20) * 0.5 : 0;
  const head = {
    x: lerp(lerp(5.2, 6.8, eat), 2, scan),
    y: lerp(lerp(bodyY - 3.5, groundY - 3, eat), bodyY - 7.5, scan),
  };
  ctx.fillStyle = RAB.body;
  ctx.beginPath(); ctx.arc(head.x, head.y + nib * 0.4, 3.1, 0, Math.PI * 2); ctx.fill();
  // nose twitch
  const tw = Math.sin(t * 15 + a.x * 0.1) * 0.4;
  ctx.fillStyle = RAB.earIn;
  ctx.beginPath(); ctx.arc(head.x + 2.9, head.y + 0.4 + tw, 0.7, 0, Math.PI * 2); ctx.fill();
  // eye
  ctx.fillStyle = RAB.eye;
  ctx.beginPath(); ctx.arc(head.x + 0.9, head.y - 0.8, 0.8, 0, Math.PI * 2); ctx.fill();

  // big ears: fully upright on scan, swept back at a sprint, relaxed otherwise
  const earA = flee ? 1.9 : lerp(0.55, 0.05, scan); // lean angle back from vertical
  for (const k of [0, 1]) {
    ctx.save();
    ctx.translate(head.x - 1 + k * 1.6, head.y - 2.2);
    ctx.rotate(-earA - k * 0.22 + (a.dying ? 0.6 : 0));
    ctx.fillStyle = RAB.body;
    ctx.beginPath(); ctx.ellipse(0, -4.2, 1.3, 4.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = RAB.earIn;
    ctx.beginPath(); ctx.ellipse(0, -4, 0.6, 3.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

// ---------------- Duck (mallard) ----------------
// Ground: waddles, dabbles tail-up, occasional wing flutter. Air: flies with
// big flapping wings; shot down mid-flight it tumbles out of the sky.
const DUCK = {
  head: "#2e7d46", headShine: "#4aa763", ring: "#ece6d6", breast: "#6b4530",
  body: "#8f7a5e", belly: "#cfc5ae", wing: "#70604a", wingDark: "#4e4234",
  speculum: "#3f6fd8", bill: "#e8a83a", foot: "#e08a30", eye: "#1a1208", tail: "#3a3226",
};

// One wing authored pointing straight up from the shoulder; caller rotates it
function duckWing(len, color, withSpeculum) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-5.5, -len * 0.45, -2.2, -len);   // leading edge to tip
  ctx.quadraticCurveTo(2.6, -len * 0.55, 3.4, -1);       // trailing feather edge
  ctx.closePath();
  ctx.fill();
  // feather slits along the trailing edge
  ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0.6, -len * 0.25); ctx.lineTo(-1.4, -len * 0.8);
  ctx.moveTo(1.8, -len * 0.2); ctx.lineTo(0.2, -len * 0.6);
  ctx.stroke();
  if (withSpeculum) {
    ctx.fillStyle = DUCK.speculum;
    ctx.beginPath(); ctx.ellipse(0.6, -len * 0.28, 1.5, len * 0.17, 0.15, 0, Math.PI * 2); ctx.fill();
  }
}

function drawDuckHead(headX, headY, eat, nib) {
  // green neck from the shoulder up to the head
  const neckBase = { x: 5, y: -1.5 };
  ctx.strokeStyle = DUCK.head; ctx.lineWidth = 3.2; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(neckBase.x, neckBase.y);
  ctx.quadraticCurveTo(headX - 2, lerp(-6, headY + 2, eat), headX, headY);
  ctx.stroke();
  ctx.lineCap = "butt";
  // white neck ring, drawn perpendicular a bit up the neck
  const dx = headX - neckBase.x, dy = headY - neckBase.y;
  const dl = Math.hypot(dx, dy) || 1;
  const bx = neckBase.x + dx * 0.32, by = neckBase.y + dy * 0.32;
  ctx.strokeStyle = DUCK.ring; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(bx - (dy / dl) * 1.8, by + (dx / dl) * 1.8);
  ctx.lineTo(bx + (dy / dl) * 1.8, by - (dx / dl) * 1.8);
  ctx.stroke();
  // head with an iridescent sheen
  ctx.fillStyle = DUCK.head;
  ctx.beginPath(); ctx.arc(headX, headY + nib * 0.3, 2.9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = DUCK.headShine;
  ctx.beginPath(); ctx.ellipse(headX - 0.6, headY - 1.1, 1.7, 1, -0.4, 0, Math.PI * 2); ctx.fill();
  // bill
  ctx.fillStyle = DUCK.bill;
  ctx.save();
  ctx.translate(headX + 2.7, headY + 0.7 + nib * 0.5); ctx.rotate(eat * 0.5);
  ctx.beginPath(); ctx.ellipse(0, 0, 2.5, 1.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // eye
  ctx.fillStyle = DUCK.eye;
  ctx.beginPath(); ctx.arc(headX + 0.9, headY - 0.7, 0.8, 0, Math.PI * 2); ctx.fill();
}

function drawDuck(a) {
  const t = performance.now() / 1000;
  const flying = a.state === "fly" && !a.dying;
  const falling = a.dying && a.fy < 0;
  const dp = a.dying && !falling ? ease(Math.min(a.deathT / 0.6, 1)) : 0;

  ctx.save();
  ctx.translate(a.x, 0);
  if (a.dir < 0) ctx.scale(-1, 1);
  ctx.globalAlpha = fadeAlpha(a);

  if (falling) {
    // tumbling out of the sky, wings limp above the body
    ctx.translate(0, groundY + a.fy);
    ctx.rotate(a.spin || 0);
    ctx.fillStyle = DUCK.wingDark;
    ctx.beginPath(); ctx.ellipse(-1, -6, 2.1, 6.2, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = DUCK.wing;
    ctx.beginPath(); ctx.ellipse(2, -5, 1.8, 5.4, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = DUCK.body;
    ctx.beginPath(); ctx.ellipse(0, 0, 8.5, 4.4, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = DUCK.belly;
    ctx.beginPath(); ctx.ellipse(0.5, 1.6, 5.5, 2.3, 0.2, 0, Math.PI * 2); ctx.fill();
    // head dangling on a slack neck
    ctx.strokeStyle = DUCK.head; ctx.lineWidth = 2.8; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(7, 0.5); ctx.quadraticCurveTo(10, 3, 10.5, 6); ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = DUCK.head;
    ctx.beginPath(); ctx.arc(10.6, 6.5, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = DUCK.bill;
    ctx.beginPath(); ctx.ellipse(12.8, 8, 2.2, 1, 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }

  if (flying) {
    const bodyY = groundY + a.fy + Math.sin(a.anim * 0.9) * 1.6;
    const flapNear = -0.35 - Math.sin(a.anim) * 0.85;
    const flapFar  = -0.35 - Math.sin(a.anim - 0.55) * 0.85;

    // far wing behind the body
    ctx.save();
    ctx.translate(0.5, bodyY - 2); ctx.rotate(flapFar);
    duckWing(11, DUCK.wingDark, false);
    ctx.restore();

    // pointed tail
    ctx.fillStyle = DUCK.tail;
    ctx.beginPath();
    ctx.moveTo(-8, bodyY - 1.5); ctx.lineTo(-14, bodyY - 0.5); ctx.lineTo(-8.5, bodyY + 1.8);
    ctx.closePath(); ctx.fill();

    // streamlined body
    ctx.fillStyle = DUCK.body;
    ctx.beginPath(); ctx.ellipse(0, bodyY, 10.5, 4, 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = DUCK.belly;
    ctx.beginPath(); ctx.ellipse(-1, bodyY + 1.7, 6.2, 2, 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = DUCK.breast;
    ctx.beginPath(); ctx.ellipse(6, bodyY + 1, 3.2, 2.2, 0.2, 0, Math.PI * 2); ctx.fill();
    // feet tucked flat under the tail
    ctx.strokeStyle = DUCK.foot; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-4, bodyY + 3.2); ctx.lineTo(-7.5, bodyY + 3.6); ctx.stroke();

    // stretched neck and head
    const headX = 14.5, headY = bodyY - 3.2;
    ctx.strokeStyle = DUCK.head; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(8, bodyY - 1); ctx.lineTo(headX - 1, headY + 0.5); ctx.stroke();
    ctx.lineCap = "butt";
    ctx.strokeStyle = DUCK.ring; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(10, bodyY - 3.4); ctx.lineTo(10.8, bodyY + 0.4); ctx.stroke();
    ctx.fillStyle = DUCK.head;
    ctx.beginPath(); ctx.arc(headX, headY, 2.9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = DUCK.headShine;
    ctx.beginPath(); ctx.ellipse(headX - 0.5, headY - 1.1, 1.7, 1, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = DUCK.bill;
    ctx.beginPath(); ctx.ellipse(headX + 3.1, headY + 0.3, 2.5, 1.1, 0.08, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = DUCK.eye;
    ctx.beginPath(); ctx.arc(headX + 0.9, headY - 0.7, 0.8, 0, Math.PI * 2); ctx.fill();

    // near wing in front, with the blue speculum flashing
    ctx.save();
    ctx.translate(2.5, bodyY - 1.5); ctx.rotate(flapNear);
    duckWing(12, DUCK.wing, true);
    ctx.restore();

    ctx.restore();
    return;
  }

  // ---- swimming on a pond ----
  if (a.state === "swim" && !a.dying) {
    const bob = Math.sin(t * 1.7 + a.x * 0.05) * 0.8;
    const eat = ease(a.eatDown || 0);            // tail-up dabble, head under water
    const bodyY = groundY - 0.5 + bob + eat * 1.5;

    // trailing V wake
    ctx.strokeStyle = "rgba(225,240,244,0.3)"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8, bodyY + 3.5); ctx.lineTo(-22, bodyY + 1.5);
    ctx.moveTo(-8, bodyY + 4.5); ctx.lineTo(-22, bodyY + 6.5);
    ctx.stroke();

    ctx.save();
    ctx.translate(0, bodyY);
    ctx.rotate(eat * 0.95);                      // bottoms-up while dabbling

    // perky up-curled tail
    ctx.fillStyle = DUCK.tail;
    ctx.beginPath();
    ctx.moveTo(-7.5, -0.5);
    ctx.quadraticCurveTo(-11.5, -2, -12.5, -5.5);
    ctx.lineTo(-8.8, 0.8);
    ctx.closePath(); ctx.fill();

    // plump body riding the water
    ctx.fillStyle = DUCK.body;
    ctx.beginPath(); ctx.ellipse(0, 0, 8.5, 4.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = DUCK.breast;
    ctx.beginPath(); ctx.ellipse(5.5, 0.4, 2.7, 2.7, 0, 0, Math.PI * 2); ctx.fill();

    // folded wing with speculum stripe
    ctx.fillStyle = DUCK.wing;
    ctx.beginPath(); ctx.ellipse(-1.5, -0.9, 5.2, 2.5, 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = DUCK.ring; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-5.6, -0.4); ctx.lineTo(-2.4, -0.7); ctx.stroke();
    ctx.strokeStyle = DUCK.speculum; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-5.4, -0.4); ctx.lineTo(-2.6, -0.7); ctx.stroke();

    if (a.wingStretch > 0) { // flap-and-shake on the water
      ctx.save();
      ctx.translate(1.2, -2);
      ctx.rotate(-0.5 + Math.sin(a.wingStretch * 22) * 0.7);
      duckWing(10, DUCK.wing, true);
      ctx.restore();
    }

    // head: proud above water, or rooting below the surface
    const nib = eat > 0.85 ? Math.sin(t * 16) * 0.5 : 0;
    drawDuckHead(lerp(6.5, 10, eat), lerp(-9, 2.5, eat), eat, nib);
    ctx.restore();

    // waterline lapping over the hull hides the legs entirely
    ctx.fillStyle = "rgba(70,110,122,0.75)";
    ctx.beginPath(); ctx.ellipse(0, groundY + 3.4, 12.5, 2.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(215,235,240,0.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, groundY + 1.6, 10.5, 1.6, 0, 0, Math.PI * 2); ctx.stroke();
    // splash beads while dabbling
    if (eat > 0.7) {
      ctx.fillStyle = "rgba(220,238,242,0.6)";
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(4 + Math.sin(t * 9 + k * 2.1) * 5, groundY - 1 - Math.abs(Math.sin(t * 7 + k)) * 4, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
    return;
  }

  // ---- on the ground ----
  const g = a.anim;
  const walk = a.state === "walk";
  const waddle = walk ? Math.sin(g * 1.4) : 0;
  const eat = a.dying ? 0 : ease(a.eatDown || 0);
  const bodyY = lerp(groundY - 7.5 - (walk ? Math.abs(waddle) * 1.1 : 0), groundY - 4.5, dp);

  // orange legs with little webbed feet, stepping on the waddle beat
  if (dp < 1) {
    ctx.strokeStyle = DUCK.foot; ctx.lineWidth = 1.6; ctx.lineCap = "round";
    for (const [ax, phase] of [[-2, 0], [2, Math.PI]]) {
      let fx = ax, lift = 0;
      if (walk) { fx = ax + Math.sin(g * 1.4 + phase) * 2.6; lift = Math.max(0, Math.cos(g * 1.4 + phase)) * 2; }
      ctx.beginPath(); ctx.moveTo(ax * 0.6, bodyY + 2.5); ctx.lineTo(fx, groundY - lift); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx, groundY - lift); ctx.lineTo(fx + 2.6, groundY - lift); ctx.stroke();
    }
    ctx.lineCap = "butt";
  }

  // body group: waddle rock, tail-up dabble tip, death flop-forward
  ctx.save();
  ctx.translate(0, bodyY);
  ctx.rotate(waddle * 0.08 + eat * 0.42 + dp * 1.45);
  if (dp > 0) ctx.translate(0, dp * 2);

  // perky up-curled tail
  ctx.fillStyle = DUCK.tail;
  ctx.beginPath();
  ctx.moveTo(-7.5, -0.5);
  ctx.quadraticCurveTo(-11.5, -2, -12.5, -5.5);
  ctx.lineTo(-8.8, 0.8);
  ctx.closePath(); ctx.fill();

  // plump body
  ctx.fillStyle = DUCK.body;
  ctx.beginPath(); ctx.ellipse(0, 0, 8.5, 4.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = DUCK.belly;
  ctx.beginPath(); ctx.ellipse(0.5, 1.9, 6, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = DUCK.breast;
  ctx.beginPath(); ctx.ellipse(5.5, 0.4, 2.7, 2.7, 0, 0, Math.PI * 2); ctx.fill();

  // folded wing on the flank with speculum stripe
  ctx.fillStyle = DUCK.wing;
  ctx.beginPath(); ctx.ellipse(-1.5, -0.9, 5.2, 2.5, 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = DUCK.ring; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-5.6, -0.4); ctx.lineTo(-2.4, -0.7); ctx.stroke();
  ctx.strokeStyle = DUCK.speculum; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-5.4, -0.4); ctx.lineTo(-2.6, -0.7); ctx.stroke();

  // standing wing flutter: quick open-wing flaps on the spot
  if (a.wingStretch > 0 && !a.dying) {
    ctx.save();
    ctx.translate(1.2, -2);
    ctx.rotate(-0.5 + Math.sin(a.wingStretch * 22) * 0.7);
    duckWing(10, DUCK.wing, true);
    ctx.restore();
  }

  // head: upright, or rooting in the grass while dabbling
  const nib = eat > 0.85 ? Math.sin(t * 16) * 0.5 : 0;
  drawDuckHead(lerp(6.5, 9.5, eat), lerp(-9, -2.5, eat), eat, nib);

  ctx.restore();
  ctx.restore();
}

// ---------------- Bear ----------------
// Big shaggy grizzly, roughly twice the bulk of a human. Authored facing +x
// with the origin at (a.x, groundY): ground is y=0, up is negative y.
// AI drives it via a.moving (actually covering ground this frame), a.charging,
// and a.attackAnim/attackDur/strikeAt (windup → paw lands at the strike frame).
const BEAR = {
  coat: "#4e3a25", coatDark: "#382a19", shag: "#2e2213",
  nose: "#16100a", eye: "#100b06", eyeHighlight: "#c7ad86",
  claw: "#d9cfba", mouth: "#42120b", teeth: "#e6ddc8",
};

// Deterministic per-tuft jitter so the shaggy edges don't flicker per frame
function tuftJitter(i) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Soft fur fringe hanging below (sign=1) or lifting above (sign=-1) the
// line from (x0,y0) to (x1,y1).
function furFringe(x0, y0, x1, y1, len, sign, color, seed) {
  const n = Math.max(4, Math.round(Math.abs(x1 - x0) / 5.5));
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1.1, Math.min(2.4, len * 0.24));
  ctx.globalAlpha *= 0.82;
  for (let i = 0; i < n; i++) {
    const mid = (i + 0.5) / n;
    const bx = lerp(x0, x1, mid), by = lerp(y0, y1, mid);
    const l = len * (0.42 + tuftJitter(i + seed) * 0.42);
    const sway = (tuftJitter(i + seed + 31) - 0.5) * 3.2;
    const curl = (tuftJitter(i + seed + 67) - 0.5) * 2.2;
    ctx.beginPath();
    ctx.moveTo(bx - sway * 0.15, by);
    ctx.quadraticCurveTo(
      bx + curl,
      by + sign * l * 0.52,
      bx + sway,
      by + sign * l
    );
    ctx.stroke();
  }
  ctx.restore();
}

// Short downward strokes over the flank that read as hanging fur
const BEAR_FLANK_FUR = [
  [-32, 2, 6], [-22, 7, 7], [-10, 3, 7], [2, 8, 6], [12, 4, 6],
  [-26, -6, 6], [-14, -3, 6], [0, -7, 6], [10, -5, 5], [20, 0, 5],
];

// One articulated leg: haunch → joint → broad paw. Hind legs hock backward,
// front legs bend slightly forward.
function bearLeg(topX, topY, footX, footY, front, color) {
  const kx = (topX + footX) / 2 + (front ? 3 : -5);
  const ky = (topY + footY) / 2 + 3;
  ctx.strokeStyle = color; ctx.lineCap = "round";
  ctx.lineWidth = 11;
  ctx.beginPath(); ctx.moveTo(topX, topY); ctx.lineTo(kx, ky); ctx.stroke();
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(footX, footY - 3); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(footX + 2, footY - 2.6, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
}

// Front limb hanging curled against the chest while the bear rears up
function bearTuckedLeg(sx, sy, color) {
  ctx.strokeStyle = color; ctx.lineCap = "round";
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 6, sy + 9); ctx.stroke();
  ctx.lineWidth = 7.5;
  ctx.beginPath(); ctx.moveTo(sx + 6, sy + 9); ctx.lineTo(sx + 2, sy + 16); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(sx + 1.5, sy + 17, 4.5, 3, 0.4, 0, Math.PI * 2); ctx.fill();
}

// Low-slung head: heavy brow, short snout, small ears — menace over detail.
// jaw 0..1 opens the mouth; alert deepens the eye socket; earsBack flattens ears.
function drawBearHead(hx, hy, jaw, alert, earsBack) {
  // prominent round ears riding the domed crown
  ctx.fillStyle = BEAR.coatDark;
  const earY = hy - 9.5 + earsBack * 3;
  ctx.beginPath(); ctx.arc(hx - 5.5, earY, 3.9, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx + 2.5, earY - 0.5 + earsBack, 3.6, 0, Math.PI * 2); ctx.fill();

  // broad skull with a short, deep, blunt muzzle — no rat taper
  ctx.fillStyle = BEAR.coat;
  ctx.beginPath();
  ctx.moveTo(hx - 10, hy - 5.5);
  ctx.quadraticCurveTo(hx - 4, hy - 10.5, hx + 4, hy - 9.5);   // domed crown
  ctx.quadraticCurveTo(hx + 10, hy - 8.5, hx + 13, hy - 4);    // brow into the muzzle
  ctx.quadraticCurveTo(hx + 15.5, hy - 1.5, hx + 15.5, hy + 1); // steep blunt nose front
  ctx.lineTo(hx + 15, hy + 3.5);
  ctx.quadraticCurveTo(hx + 9, hy + 6, hx + 3, hy + 6);        // deep upper jaw
  ctx.quadraticCurveTo(hx - 8, hy + 7.5, hx - 11, hy + 1);     // heavy cheek and jowl
  ctx.closePath();
  ctx.fill();
  // jaw scruff
  furFringe(hx - 9, hy + 6, hx + 3, hy + 6.2, 4, 1, BEAR.shag, 57);

  // nose
  ctx.fillStyle = BEAR.nose;
  ctx.beginPath(); ctx.ellipse(hx + 14, hy + 0.4, 2.6, 2.2, 0.25, 0, Math.PI * 2); ctx.fill();

  if (jaw > 0.05) {
    const drop = jaw * 6.5;
    // open gape with a couple of fangs
    ctx.fillStyle = BEAR.mouth;
    ctx.beginPath();
    ctx.moveTo(hx + 3, hy + 5);
    ctx.quadraticCurveTo(hx + 9, hy + 4.4, hx + 15, hy + 3.3);
    ctx.lineTo(hx + 12, hy + 4.5 + drop);
    ctx.quadraticCurveTo(hx + 6, hy + 5.5 + drop, hx + 3, hy + 4.8 + drop * 0.6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = BEAR.teeth;
    ctx.beginPath(); ctx.moveTo(hx + 13.6, hy + 3.5); ctx.lineTo(hx + 12.4, hy + 6.4); ctx.lineTo(hx + 11.2, hy + 3.8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx + 11.6, hy + 4.4 + drop); ctx.lineTo(hx + 10.6, hy + 1.6 + drop); ctx.lineTo(hx + 9.4, hy + 4.6 + drop); ctx.closePath(); ctx.fill();
    // lower jaw
    ctx.strokeStyle = BEAR.coat; ctx.lineWidth = 3.6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(hx + 2, hy + 5.4); ctx.quadraticCurveTo(hx + 7, hy + 5.8 + drop, hx + 12.5, hy + 4.8 + drop); ctx.stroke();
    ctx.lineCap = "butt";
  } else {
    // shut: a single grim mouth line
    ctx.strokeStyle = BEAR.nose; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(hx + 13.5, hy + 3); ctx.quadraticCurveTo(hx + 9, hy + 4.8, hx + 5, hy + 4.6) ; ctx.stroke();
  }

  // heavy brow over a small sunken eye
  ctx.strokeStyle = BEAR.coatDark; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(hx + 1.5, hy - 6); ctx.lineTo(hx + 7, hy - 4.2); ctx.stroke();
  if (alert) {
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath(); ctx.ellipse(hx + 5, hy - 2.5, 3.2, 2.3, -0.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = BEAR.eye;
  ctx.beginPath(); ctx.ellipse(hx + 5, hy - 2.6, 1.35, 1.05, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.fillStyle = BEAR.eyeHighlight;
  ctx.globalAlpha *= 0.55;
  ctx.beginPath(); ctx.arc(hx + 5.35, hy - 2.95, 0.32, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBear(a) {
  const t = performance.now() / 1000;
  const chase = a.state === "chase" && !a.dying;
  const charging = chase && a.charging > 0;
  const moving = !!a.moving && !a.dying;
  const gallop = chase && moving;
  const dp = a.dying ? ease(Math.min(a.deathT / 1.3, 1)) : 0;

  // Swipe phases, timed to the AI: rear up until the strike frame, then the
  // paw slams down through the arc and the body drops with it.
  const dur = a.attackDur || 0.55;
  const strikeP = 1 - (a.strikeAt || 0.26) / dur;
  const ap = a.attackAnim > 0 && !a.dying ? 1 - a.attackAnim / dur : 0;
  let rear = 0, swipe = 0;
  if (ap > 0) {
    if (ap < strikeP) {
      rear = ease(ap / strikeP);
      swipe = -1.1 * rear;                                   // paw cocked up and back
    } else {
      const s = (ap - strikeP) / (1 - strikeP);
      rear = 1 - ease(Math.min(1, s * 1.7));
      swipe = -1.1 + ease(Math.min(1, s * 1.25)) * 2.1;      // slashes down through
    }
  }

  ctx.save();
  ctx.translate(a.x, groundY);
  if (a.dir < 0) ctx.scale(-1, 1);
  ctx.globalAlpha = fadeAlpha(a);

  // soft ground shadow sells the bulk
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath(); ctx.ellipse(2, -1, 42 - rear * 8, 5, 0, 0, Math.PI * 2); ctx.fill();

  const g = a.anim;
  const bound = gallop ? Math.abs(Math.sin(g * 0.9)) * (charging ? 8 : 6) : 0;
  const walkRoll = !chase && moving ? Math.sin(g * 1.5) * 1.4 : 0;
  const breathe = !moving && ap === 0 && !a.dying ? Math.sin(t * 1.7) * 0.9 : 0;
  const sniff = a.dying || chase || ap > 0 ? 0 : ease(a.eatDown || 0);

  // torso center height; sinks onto the ground when dying
  const torsoY = lerp(-37 - bound + walkRoll + breathe * 0.6 + (charging ? 5 : 0), -17, dp);
  const hip = { x: -26, y: torsoY + 6 };

  // ---- leg poses ----
  // Walk: 4-beat amble with real lift and plant. Gallop: hind pair drives,
  // front pair reaches. Dying: legs fold under the body.
  const legPose = (base, front, near) => {
    if (dp > 0) return { footX: base * 0.7, footY: -2 - dp * 3 };
    let footX = base, lift = 0;
    if (gallop) {
      const ph = (front ? 2.4 : 0) + (near ? 0.25 : 0);
      footX = base + Math.sin(g * 0.9 + ph) * (front ? 11 : 12);
      lift = Math.max(0, Math.cos(g * 0.9 + ph)) * 9;
    } else if (moving) {
      const ph = front ? (near ? Math.PI * 1.5 : Math.PI * 0.5) : (near ? Math.PI : 0);
      footX = base + Math.sin(g * 1.5 + ph) * 7;
      lift = Math.max(0, Math.cos(g * 1.5 + ph)) * 4.5;
    }
    return { footX, footY: -lift };
  };
  const hindFar = legPose(-30, false, false);
  const hindNear = legPose(-21, false, true);
  const frontFar = legPose(26, true, false);
  const frontNear = legPose(17, true, true);

  // far hind leg, planted outside the rear-up rotation
  bearLeg(hip.x - 3, hip.y, hindFar.footX, hindFar.footY, false, BEAR.coatDark);

  // ---- body group: rears up around the hip during a swipe ----
  ctx.save();
  ctx.translate(hip.x, hip.y);
  ctx.rotate(-rear * 0.5 + (gallop ? Math.sin(g * 0.9) * 0.05 : 0) + (charging ? 0.06 : 0) + dp * 0.15);
  ctx.translate(-hip.x, -hip.y);

  // far front leg
  if (rear > 0.05) bearTuckedLeg(24, torsoY + 2, BEAR.coatDark);
  else bearLeg(24, torsoY + 4, frontFar.footX, frontFar.footY, true, BEAR.coatDark);

  // shaggy under-layer, slightly bigger and darker than the coat
  ctx.fillStyle = BEAR.coatDark;
  ctx.beginPath(); ctx.ellipse(-24, torsoY + 1, 19, 15, 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, torsoY + 0.5, 27, 16.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(15, torsoY - 8, 15, 12, -0.15, 0, Math.PI * 2); ctx.fill();
  // back-line fur wisps over the rump and hump
  furFringe(-40, torsoY - 7, -12, torsoY - 14, 6, -1, BEAR.coatDark, 17);
  furFringe(-12, torsoY - 14, 24, torsoY - 17, 6, -1, BEAR.coatDark, 71);

  // main coat: rump low, heavy shoulder hump, deep chest
  ctx.fillStyle = BEAR.coat;
  ctx.beginPath(); ctx.ellipse(-24, torsoY, 17.5, 14, 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, torsoY - 1, 25, 15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(14, torsoY - 10, 13.5, 10, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(24, torsoY + 2, 12, 11.5, 0, 0, Math.PI * 2); ctx.fill();
  // stubby tail tuft
  ctx.fillStyle = BEAR.coatDark;
  ctx.beginPath(); ctx.ellipse(-41, torsoY - 3, 3.5, 4.5, 0.5, 0, Math.PI * 2); ctx.fill();

  // hanging belly shag
  furFringe(-36, torsoY + 11, 28, torsoY + 12, 8, 1, BEAR.shag, 3);
  // flank fur strokes
  ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 1.2; ctx.lineCap = "round";
  for (const [fx, fy, fl] of BEAR_FLANK_FUR) {
    ctx.beginPath();
    ctx.moveTo(fx, torsoY + fy);
    ctx.quadraticCurveTo(fx - 1, torsoY + fy + fl * 0.6, fx - 3, torsoY + fy + fl);
    ctx.stroke();
  }
  ctx.lineCap = "butt";

  // ---- neck + head ----
  const carried = { x: 42, y: torsoY - 4 };
  let head;
  if (a.dying) head = { x: lerp(carried.x, 40, dp), y: lerp(carried.y, -9, dp) };
  else if (charging) head = { x: 46, y: torsoY + 2 };
  else head = { x: lerp(carried.x, 46, sniff), y: lerp(carried.y, -10, sniff) };

  ctx.fillStyle = BEAR.coat;
  ctx.beginPath();
  ctx.moveTo(16, torsoY - 15);
  ctx.quadraticCurveTo(30, torsoY - 13, head.x - 2, head.y - 6);
  ctx.lineTo(head.x + 2, head.y + 5);
  ctx.quadraticCurveTo(28, torsoY + 9, 20, torsoY + 11);
  ctx.closePath(); ctx.fill();
  // throat ruff
  furFringe(26, torsoY + 8, head.x - 2, head.y + 5, 6, 1, BEAR.shag, 41);

  // roaring during the swipe, snarling when squared up or charging
  const jaw = ap > 0 ? rear
    : chase && !moving ? 0.55 + Math.sin(t * 2.2) * 0.12
    : charging ? 0.45 : 0;
  drawBearHead(head.x, head.y, jaw, chase || ap > 0, charging ? 1 : 0);

  // ---- near front limb: swipe arm while attacking, normal leg otherwise ----
  if (ap > 0) {
    ctx.save();
    ctx.translate(18, torsoY - 2);
    ctx.rotate(swipe);
    // motion-blur arc through the fast part of the slash
    if (ap >= strikeP && ap < strikeP + 0.3) {
      ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(0, 0, 33, -0.9 - swipe, 0.4, false); ctx.stroke();
    }
    ctx.strokeStyle = BEAR.coat; ctx.lineCap = "round";
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(16, 6); ctx.stroke();
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(16, 6); ctx.lineTo(30, 9); ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = BEAR.coatDark;
    ctx.beginPath(); ctx.ellipse(31, 9.5, 6.5, 4.5, 0.3, 0, Math.PI * 2); ctx.fill();
    // splayed claws
    ctx.strokeStyle = BEAR.claw; ctx.lineWidth = 2; ctx.lineCap = "round";
    for (let c = 0; c < 4; c++) {
      const ca = -0.35 + c * 0.3;
      ctx.beginPath();
      ctx.moveTo(31 + Math.cos(ca) * 6, 9.5 + Math.sin(ca) * 4.5);
      ctx.lineTo(31 + Math.cos(ca) * 14, 9.5 + Math.sin(ca) * 11);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.restore();
  } else if (rear > 0.05) {
    bearTuckedLeg(15, torsoY + 3, BEAR.coat);
  } else {
    bearLeg(16, torsoY + 5, frontNear.footX, frontNear.footY, true, BEAR.coat);
  }

  ctx.restore(); // end body group

  // near hind leg in front of the body
  bearLeg(hip.x + 5, hip.y + 1, hindNear.footX, hindNear.footY, false, BEAR.coat);

  // hit flash
  if (a.flash > 0) {
    ctx.globalAlpha = Math.min(1, a.flash * 5) * 0.55 * fadeAlpha(a);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.ellipse(4, torsoY - 3, 38, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = fadeAlpha(a);
  }

  ctx.restore();

  // hp bar
  if (!a.dying && a.hp !== undefined && a.hp < a.maxHp) {
    const w = 40, frac = Math.max(0, a.hp / a.maxHp);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(a.x - w / 2, groundY - 78, w, 4);
    ctx.fillStyle = frac > 0.4 ? "#9bd05a" : "#c1453b";
    ctx.fillRect(a.x - w / 2, groundY - 78, w * frac, 4);
  }
}

function drawStuckArrows(a) {
  if (!a.stuckArrows || !a.stuckArrows.length) return;
  for (const ar of a.stuckArrows) {
    const alpha = stuckArrowAlpha(ar);
    if (alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    // rel arrows (ducks hit mid-flight) ride the body as it falls
    ctx.translate(a.x + ar.x, ar.rel ? groundY + (a.fy || 0) + ar.y : ar.y);
    ctx.rotate(ar.a || 0);
    if (ar.upgradeCol) {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.26 * alpha;
      ctx.strokeStyle = ar.upgradeCol; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(5, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = ar.upgradeCol ? "#e8d8ff" : "#c9b48a"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(5, 0); ctx.stroke();
    ctx.fillStyle = "#b8bcc4";
    ctx.beginPath(); ctx.moveTo(5, -1.6); ctx.lineTo(8, 0); ctx.lineTo(5, 1.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = ar.upgradeCol || "#8fae4a";
    ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-17, -2.3); ctx.lineTo(-14, -0.3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-17, 2.3); ctx.lineTo(-14, 0.3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

export function drawAnimals() {
  const view = visibleWorldBounds(180);
  for (const a of state.animals) {
    if (!a.alive) continue;
    if (a.x < view.left || a.x > view.right) continue;
    if (a.type === "deer") drawDeer(a);
    else if (a.type === "bear") drawBear(a);
    else if (a.type === "duck") drawDuck(a);
    else drawRabbit(a);
    drawStuckArrows(a);
  }
}
