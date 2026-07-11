import { ctx, groundY } from '../../core/canvas.js';
import { drawBoot } from '../DrawHelpers.js';

// ---------------------------------------------------------------------------
// Procedural guard (unlocked at base level 3): steel kettle helm, padded
// blue-grey gambeson, round shield on the off arm, spear in the lead hand.
// Spear rests planted when idle, levels while marching, thrusts on u.strike.
// Same local-space convention as Archer.js/Builder.js.
// ---------------------------------------------------------------------------

const C = {
  gambeson:   "#3e4e60",
  gambesonLt: "#4e5f73",
  pants:      "#333c48",
  boots:      "#26201a",
  skin:       "#c8a67e",
  steel:      "#9aa2b4",
  steelLt:    "#c0c6d6",
  steelDk:    "#6e7688",
  shieldWood: "#4a5060",
  shieldRim:  "#2c323e",
  boss:       "#f2c14e",
  haft:       "#7a5a2a",
  strap:      "#2a2018",
};

function limb(x1, y1, x2, y2, col, w) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.lineCap = "butt";
}

// Spear drawn from the grip along angle `a`; total reach ~26px past the hand
function drawSpear(hx, hy, a) {
  ctx.save();
  ctx.translate(hx, hy); ctx.rotate(a);
  ctx.strokeStyle = C.haft; ctx.lineWidth = 2.2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(20, 0); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = C.steelLt;
  ctx.beginPath(); ctx.moveTo(20, -2); ctx.lineTo(27, 0); ctx.lineTo(20, 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.steelDk; ctx.fillRect(18.5, -1.6, 2, 3.2);
  ctx.restore();
}

export function drawGuard(u) {
  const t = performance.now() / 1000;
  const moving = !!u.moving;
  const anim = u.anim || 0;
  // thrust progress: 0→1 snap out, then eases back
  const sp = u.strike > 0 ? 1 - u.strike / 0.25 : -1;
  const thrust = sp >= 0 ? Math.sin(Math.min(sp * 1.6, 1) * Math.PI) : 0;

  ctx.save();
  ctx.translate(u.x, 0);
  if (u.dir < 0) ctx.scale(-1, 1);

  const breathe = Math.sin(t * 1.7 + (u.x || 0) * 0.02);
  const bob = moving ? Math.abs(Math.sin(anim)) * 1.3 : breathe * 0.5 + 0.5;
  const lean = thrust * 3; // lunges into the stab
  const hipY  = groundY - 17 - bob * 0.4;
  const shY   = groundY - 30 - bob;
  const headY = groundY - 37.5 - bob;

  // --- legs ---
  const s = Math.sin(anim);
  const stride = moving ? 5 : 0;
  let backFoot = -3 + s * stride, frontFoot = 3 - s * stride;
  if (thrust > 0.1 && !moving) { backFoot = -5.5; frontFoot = 5 + lean * 0.6; }
  limb(-3, hipY, backFoot, groundY - 4, C.pants, 3.2);
  limb(backFoot, groundY - 4.5, backFoot + 0.5, groundY - 2, C.boots, 3.6);
  drawBoot(backFoot + 0.5, groundY, C.boots, 1);
  limb(3, hipY, frontFoot, groundY - 4, C.pants, 3.2);
  limb(frontFoot, groundY - 4.5, frontFoot + 0.5, groundY - 2, C.boots, 3.6);
  drawBoot(frontFoot + 0.5, groundY, C.boots, 1);

  // --- shield on the back arm (behind the torso) ---
  const shieldX = -6 + lean * 0.3;
  ctx.fillStyle = C.shieldWood;
  ctx.beginPath(); ctx.arc(shieldX, shY + 8, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.shieldRim; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(shieldX, shY + 8, 6.5, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = C.boss;
  ctx.beginPath(); ctx.arc(shieldX, shY + 8, 2.2, 0, Math.PI * 2); ctx.fill();
  // arm gripping it
  limb(-4 + lean, shY + 2, shieldX, shY + 7, C.skin, 2.5);

  // --- torso: padded gambeson with stitched rows ---
  ctx.fillStyle = C.gambeson;
  ctx.beginPath();
  ctx.moveTo(-5.5 + lean, shY);
  ctx.lineTo(5.5 + lean, shY);
  ctx.lineTo(5, hipY + 4);
  ctx.lineTo(-5, hipY + 4);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.gambesonLt; ctx.fillRect(-4.5 + lean, shY + 1, 3, 7);
  ctx.strokeStyle = "rgba(0,0,0,0.22)"; ctx.lineWidth = 1;
  for (let k = 1; k <= 3; k++) {
    const ry = shY + k * 3.6;
    ctx.beginPath(); ctx.moveTo(-5 + lean * (1 - k * 0.2), ry); ctx.lineTo(5 + lean * (1 - k * 0.2), ry); ctx.stroke();
  }
  // belt + gold buckle
  ctx.fillStyle = C.strap; ctx.fillRect(-4.5, hipY - 1.5, 9, 2.4);
  ctx.fillStyle = C.boss; ctx.fillRect(-1, hipY - 1.5, 2, 2.4);

  // --- head: kettle helm with wide brim, shaded face ---
  const hx = lean * 0.8;
  ctx.fillStyle = C.skin;
  ctx.beginPath(); ctx.arc(hx, headY, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(14,12,10,0.32)";
  ctx.beginPath(); ctx.arc(hx + 0.3, headY - 0.8, 3.8, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  ctx.fillStyle = C.steel;
  ctx.beginPath(); ctx.arc(hx, headY - 1.8, 4.8, Math.PI, 0); ctx.fill();
  ctx.fillRect(hx - 6.4, headY - 2.4, 12.8, 1.8); // brim
  ctx.fillStyle = C.steelLt; ctx.fillRect(hx - 6.4, headY - 2.4, 12.8, 0.8);
  // eye under the brim
  ctx.fillStyle = "#241c12";
  ctx.beginPath(); ctx.arc(hx + 2, headY + 0.4, 0.7, 0, Math.PI * 2); ctx.fill();

  // --- spear arm ---
  if (sp >= 0) {
    // thrust: level stab, hand drives forward
    const hand = { x: 5 + lean + thrust * 7, y: shY + 4 };
    limb(4 + lean, shY + 2, hand.x, hand.y, C.skin, 2.5);
    drawSpear(hand.x, hand.y, 0);
    // motion smear on the way out
    if (sp < 0.6) {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (0.6 - sp) * 0.8;
      ctx.strokeStyle = C.steelLt; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(hand.x + 6, hand.y); ctx.lineTo(hand.x + 24, hand.y); ctx.stroke();
      ctx.restore();
    }
  } else if (moving) {
    // marching: spear angled forward over the shoulder
    const swing = Math.sin(anim) * 1.5;
    const hand = { x: 5, y: shY + 5 + swing * 0.3 };
    limb(4, shY + 2, hand.x, hand.y, C.skin, 2.5);
    drawSpear(hand.x, hand.y, -0.5);
  } else {
    // at ease: spear planted upright, butt on the ground
    const hand = { x: 6.5, y: shY + 3 + breathe * 0.3 };
    limb(4, shY + 2, hand.x, hand.y, C.skin, 2.5);
    ctx.save();
    ctx.translate(7, groundY); ctx.rotate(-Math.PI / 2);
    ctx.strokeStyle = C.haft; ctx.lineWidth = 2.2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(34, 0); ctx.stroke(); ctx.lineCap = "butt";
    ctx.fillStyle = C.steelLt;
    ctx.beginPath(); ctx.moveTo(34, -2); ctx.lineTo(41, 0); ctx.lineTo(34, 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.steelDk; ctx.fillRect(32.5, -1.6, 2, 3.2);
    ctx.restore();
  }

  ctx.restore();
}
