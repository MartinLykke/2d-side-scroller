import { clamp, lerp } from '../../util/math.js';
import { ctx, groundY } from '../../core/canvas.js';
import { state } from '../../core/state.js';

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
const BEAR = { body: "#5a4028", dark: "#463020", belly: "#6e5236", muzzle: "#8a6a48", claw: "#2c2018", eye: "#1a120a" };

function drawBear(a) {
  const t = performance.now() / 1000;
  const chase = a.state === "chase" && !a.dying;
  const walk = a.state === "walk" && !a.dying;
  const dp = a.dying ? ease(Math.min(a.deathT / 1.3, 1)) : 0;
  // New attack logic: a quick swiping motion
  const atk = a.attackAnim > 0 ? Math.sin(ease(a.attackAnim / 0.4) * Math.PI * 1.5) : 0; // Makes the strike more dynamic
  const rear = a.attackAnim > 0 ? Math.sin(ease(a.attackAnim / 0.4) * Math.PI) * 0.3 : 0; // Slight lift of the body

  ctx.save();
  ctx.translate(a.x, 0);
  if (a.dir < 0) ctx.scale(-1, 1);
  ctx.globalAlpha = fadeAlpha(a);

  const g = a.anim;
  const lope = chase ? Math.abs(Math.sin(g * 0.9)) * 3 * (1 - dp) : 0;
  const roll = walk ? Math.sin(g * 0.8) * 0.9 : 0;
  const sniff = a.dying ? 0 : ease(a.eatDown || 0);

  // Justeret bodyY for kortere ben
  const baseGround = groundY - 6; // The bear sits closer to the ground
  const bodyY = lerp(baseGround - 14 - lope + roll - rear * 15, groundY - 5, dp);
  const bodyRot = -rear * 0.5 + dp * 0.4;

  // --- legs: SHORTER AND THICKER ---
  if (dp < 1) {
    const fold = dp * 6;
    ctx.strokeStyle = BEAR.dark; ctx.lineWidth = 7; ctx.lineCap = "round"; // Tykkere ben
    // Definér benpositioner (x, fase)
    const legPositions = [[9, 0], [11, Math.PI], [-7, Math.PI], [-9, 0]];

    for (let i = 0; i < legPositions.length; i++) {
      const [ax, phase] = legPositions[i];
      let footX = ax, lift = 0, fPhase = phase;

      if (chase) {
        const sw = Math.sin(g * 2.2 + fPhase);
        footX = ax + sw * 5;
        lift = Math.max(0, -Math.cos(g * 2.2 + fPhase)) * 3;
      } else if (walk) {
        footX = ax + Math.sin(g * 1.8 + fPhase) * 2.5;
      }

      const front = ax > 0;
      // Front legs are not lifted at all during normal walking/running, only when attacking
      const z = front ? groundY - lift - fold : groundY - lift - fold;

      ctx.beginPath();
      // Hofte/skulder til fod
      ctx.moveTo(ax * 0.7, bodyY + 2);
      ctx.lineTo(footX, z);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
  }

  // --- body: med skulderhump ---
  ctx.save();
  ctx.translate(0, bodyY); ctx.rotate(-bodyRot);
  ctx.fillStyle = BEAR.body;
  ctx.beginPath(); ctx.ellipse(0, 0, 17, 9.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(5, -6.5, 7.5, 5, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = BEAR.belly;
  ctx.beginPath(); ctx.ellipse(0, 4, 11, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = BEAR.dark;
  ctx.beginPath(); ctx.arc(-16.5, -2, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // --- head ---
  const upHead = { x: 19, y: bodyY - 8 };
  const downHead = { x: 21, y: baseGround - 6 };
  const head = a.dying
    ? { x: lerp(upHead.x, 14, dp), y: lerp(upHead.y, baseGround - 6, dp) }
    : { x: lerp(upHead.x, downHead.x, sniff * (1 - atk)), y: lerp(upHead.y, downHead.y, sniff * (1 - atk)) };

  // thick neck
  ctx.strokeStyle = BEAR.body; ctx.lineWidth = 8; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(11, bodyY - 3); ctx.lineTo(head.x - 3, head.y + 1); ctx.stroke();
  ctx.lineCap = "butt";

  // skull + muzzle
  ctx.fillStyle = BEAR.body;
  ctx.beginPath(); ctx.arc(head.x, head.y, 5.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = BEAR.muzzle;
  ctx.beginPath(); ctx.ellipse(head.x + 5, head.y + 1.5, 3.4, 2.3, 0.1, 0, Math.PI * 2); ctx.fill();
  // nose
  ctx.fillStyle = BEAR.eye;
  ctx.beginPath(); ctx.arc(head.x + 7.8, head.y + 1, 1.1, 0, Math.PI * 2); ctx.fill();
  // eye
  ctx.fillStyle = chase ? "#7a1a10" : BEAR.eye;
  ctx.beginPath(); ctx.arc(head.x + 1.5, head.y - 1.5, 1, 0, Math.PI * 2); ctx.fill();
  // round ears
  ctx.fillStyle = BEAR.body;
  ctx.beginPath(); ctx.arc(head.x - 2.5, head.y - 4.5, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(head.x + 1.5, head.y - 5.2, 2, 0, Math.PI * 2); ctx.fill();

  // --- NEW: Attack arm with claw (drawn separately so it can swing) ---
  if (a.attackAnim > 0) {
    ctx.save();
    // Flyt transformationspunktet til skulderen
    ctx.translate(7, bodyY - 2);
    // Rotate the arm based on 'atk' (0 -> 1.5 PI)
    ctx.rotate(atk * 1.8 - 0.5);

    // Overarm
    ctx.strokeStyle = BEAR.body; ctx.lineWidth = 7; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, 0); ctx.stroke();

    // Forearm and paw
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(22, 5); ctx.stroke();

    // Claws (protruding from the paw)
    if (atk > 0.5) {
        ctx.strokeStyle = BEAR.claw; ctx.lineWidth = 2;
        const clawLen = 6 + Math.sin(atk*Math.PI)*3;
        for (let c = 0; c < 3; c++) {
            ctx.beginPath();
            ctx.moveTo(22 + c*1, 5 + c*0.5);
            ctx.lineTo(22 + clawLen + c*0.5, 8 + c*1);
            ctx.stroke();
        }
    }
    ctx.restore();
  } else {
      // Standard front legs (when not attacking)
      ctx.strokeStyle = BEAR.dark; ctx.lineWidth = 7; ctx.lineCap = "round";
      const baseFrontLegX = 8;
      const fPhase = 0; // fixed phase when not running
      const fX = chase ? baseFrontLegX + Math.sin(g * 2.2 + fPhase)*5 : baseFrontLegX;
      const fZ = chase ? groundY - Math.max(0, -Math.cos(g * 2.2 + fPhase))*3 : groundY;

      ctx.beginPath();
      ctx.moveTo(baseFrontLegX*0.7, bodyY + 2);
      ctx.lineTo(fX, fZ);
      ctx.stroke();
  }

  // hit flash
  if (a.flash > 0) {
    ctx.globalAlpha = Math.min(1, a.flash * 5) * 0.55 * fadeAlpha(a);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.ellipse(2, bodyY - 2, 20, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = fadeAlpha(a);
  }

  ctx.restore();

  // hp bar
  if (!a.dying && a.hp !== undefined && a.hp < a.maxHp) {
    const w = 30, frac = Math.max(0, a.hp / a.maxHp);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(a.x - w / 2, baseGround - 42, w, 3.5);
    ctx.fillStyle = frac > 0.4 ? "#9bd05a" : "#c1453b";
    ctx.fillRect(a.x - w / 2, baseGround - 42, w * frac, 3.5);
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
    ctx.strokeStyle = "#c9b48a"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(5, 0); ctx.stroke();
    ctx.fillStyle = "#b8bcc4";
    ctx.beginPath(); ctx.moveTo(5, -1.6); ctx.lineTo(8, 0); ctx.lineTo(5, 1.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#8fae4a";
    ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-17, -2.3); ctx.lineTo(-14, -0.3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-17, 2.3); ctx.lineTo(-14, 0.3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

export function drawAnimals() {
  for (const a of state.animals) {
    if (!a.alive) continue;
    if (a.type === "deer") drawDeer(a);
    else if (a.type === "bear") drawBear(a);
    else if (a.type === "duck") drawDuck(a);
    else drawRabbit(a);
    drawStuckArrows(a);
  }
}
