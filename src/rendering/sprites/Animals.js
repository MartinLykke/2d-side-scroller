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

function fadeAlpha(a) {
  return a.deathT > 3.5 ? clamp(1 - (a.deathT - 3.5) / 1.5, 0, 1) : 1;
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
    // quick flip onto the side
    ctx.translate(0, dp * 2);
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

// ---------------- Bear ----------------
const BEAR = { body: "#5a4028", dark: "#463020", belly: "#6e5236", muzzle: "#8a6a48", claw: "#2c2018", eye: "#1a120a" };

function drawBear(a) {
  const t = performance.now() / 1000;
  const chase = a.state === "chase" && !a.dying;
  const walk = a.state === "walk" && !a.dying;
  const dp = a.dying ? ease(Math.min(a.deathT / 1.3, 1)) : 0;
  // Ny angrebslogik: en hurtig svirpende bevægelse
  const atk = a.attackAnim > 0 ? Math.sin(ease(a.attackAnim / 0.4) * Math.PI * 1.5) : 0; // Gør slaget mere dynamisk
  const rear = a.attackAnim > 0 ? Math.sin(ease(a.attackAnim / 0.4) * Math.PI) * 0.3 : 0; // Let løft af kroppen

  ctx.save();
  ctx.translate(a.x, 0);
  if (a.dir < 0) ctx.scale(-1, 1);
  ctx.globalAlpha = fadeAlpha(a);

  const g = a.anim;
  const lope = chase ? Math.abs(Math.sin(g * 0.9)) * 3 * (1 - dp) : 0;
  const roll = walk ? Math.sin(g * 0.8) * 0.9 : 0;
  const sniff = a.dying ? 0 : ease(a.eatDown || 0);

  // Justeret bodyY for kortere ben
  const baseGround = groundY - 6; // Bjørnen er tættere på jorden
  const bodyY = lerp(baseGround - 14 - lope + roll - rear * 15, groundY - 5, dp);
  const bodyRot = -rear * 0.5 + dp * 0.4;

  // --- legs: KORTERE OG TYKKERE ---
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
      // Frontbenene løftes slet ikke ved almindelig gang/løb, kun ved angreb
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

  // --- NYT: Angrebsarm med klo (tegnes separat for at svinge) ---
  if (a.attackAnim > 0) {
    ctx.save();
    // Flyt transformationspunktet til skulderen
    ctx.translate(7, bodyY - 2);
    // Roter armen baseret på 'atk' (0 -> 1.5 PI)
    ctx.rotate(atk * 1.8 - 0.5);

    // Overarm
    ctx.strokeStyle = BEAR.body; ctx.lineWidth = 7; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, 0); ctx.stroke();

    // Underarm og pote
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(22, 5); ctx.stroke();

    // Kløer (stikker ud fra poten)
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
      // Standard frontben (hvis ikke angriber)
      ctx.strokeStyle = BEAR.dark; ctx.lineWidth = 7; ctx.lineCap = "round";
      const baseFrontLegX = 8;
      const fPhase = 0; // fast fase når den ikke løber
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

export function drawAnimals() {
  for (const a of state.animals) {
    if (!a.alive) continue;
    if (a.type === "deer") drawDeer(a);
    else if (a.type === "bear") drawBear(a);
    else drawRabbit(a);
  }
}
