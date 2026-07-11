import { ctx, groundY } from '../../core/canvas.js';
import { drawBoot } from '../DrawHelpers.js';

// ---------------------------------------------------------------------------
// Procedural builder: stocky craftsman with leather apron, flat cap and a
// work hammer — carried over the shoulder while walking, swung while working.
// Same local-space convention as Archer.js: translate(u.x,0), mirror for west.
// ---------------------------------------------------------------------------

const C = {
  tunic:   "#7a5836",
  tunicLt: "#8c6a44",
  apron:   "#5d4426",
  apronLt: "#6e5432",
  strap:   "#3a2a18",
  pants:   "#4f4636",
  boots:   "#2e2118",
  skin:    "#caa27a",
  cap:     "#4a3220",
  capLt:   "#5c4028",
  beard:   "#6a5238",
  handle:  "#7a5a2a",
  head:    "#9a9aaa",
  headLt:  "#b4b4c4",
  pouch:   "#6a4a28",
};

function limb(x1, y1, x2, y2, col, w) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.lineCap = "butt";
}

// Hammer drawn from the hand outward at angle `a` (radians, 0 = +x)
function drawHammer(hx, hy, a) {
  ctx.save();
  ctx.translate(hx, hy); ctx.rotate(a);
  ctx.strokeStyle = C.handle; ctx.lineWidth = 2.4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(11, 0); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = C.head; ctx.fillRect(8, -4.5, 6, 9);
  ctx.fillStyle = C.headLt; ctx.fillRect(8, -4.5, 6, 3);
  ctx.restore();
}

export function drawBuilder(u) {
  const t = performance.now() / 1000;
  const moving = !!u.moving;
  const working = !!u.working && !moving;
  const anim = u.anim || 0;

  ctx.save();
  ctx.translate(u.x, 0);
  if (u.dir < 0) ctx.scale(-1, 1);

  const breathe = Math.sin(t * 1.6 + (u.x || 0) * 0.02);
  const bob = moving ? Math.abs(Math.sin(anim)) * 1.4 : breathe * 0.5 + 0.5;
  // Working: the whole body dips into each hammer strike
  const swingT = (Math.sin(t * 9) + 1) / 2;          // 0 = raised, 1 = struck
  const dip = working ? swingT * 1.6 : 0;

  const hipY  = groundY - 17 - bob * 0.4 + dip * 0.4;
  const shY   = groundY - 29 - bob + dip;
  const headY = groundY - 36.5 - bob + dip;

  // --- Legs (sturdy stance) --------------------------------------------------
  const s = Math.sin(anim);
  const stride = moving ? 5.5 : 0;
  let backFoot = -3 + s * stride, frontFoot = 3 - s * stride;
  if (working) { backFoot = -5.5; frontFoot = 4.5; }
  limb(-3, hipY, backFoot, groundY - 4, C.pants, 3.4);
  limb(backFoot, groundY - 4.5, backFoot + 0.6, groundY - 2, C.boots, 3.8);
  drawBoot(backFoot + 0.6, groundY, C.boots, 1.05);
  limb(3, hipY, frontFoot, groundY - 4, C.pants, 3.4);
  limb(frontFoot, groundY - 4.5, frontFoot + 0.6, groundY - 2, C.boots, 3.8);
  drawBoot(frontFoot + 0.6, groundY, C.boots, 1.05);

  // --- Torso: broad tunic ------------------------------------------------------
  ctx.fillStyle = C.tunic;
  ctx.beginPath();
  ctx.moveTo(-6, shY);
  ctx.lineTo(6, shY);
  ctx.lineTo(5, hipY + 3);
  ctx.lineTo(-5, hipY + 3);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.tunicLt; ctx.fillRect(-5, shY + 1, 3, 5);
  // rolled-up sleeve hints at the shoulders
  ctx.fillStyle = C.tunicLt;
  ctx.fillRect(-6.5, shY + 0.5, 3, 4);
  ctx.fillRect(3.5, shY + 0.5, 3, 4);

  // --- Leather apron over the front -------------------------------------------
  ctx.fillStyle = C.apron;
  ctx.beginPath();
  ctx.moveTo(-3.5, shY + 2);
  ctx.lineTo(3.5, shY + 2);
  ctx.lineTo(5, hipY + 6);
  ctx.lineTo(-5, hipY + 6);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.apronLt;
  ctx.fillRect(-3, shY + 3.5, 2, 6);
  // neck strap + waist tie
  ctx.strokeStyle = C.strap; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-3, shY + 2); ctx.lineTo(0, shY - 2); ctx.lineTo(3, shY + 2); ctx.stroke();
  ctx.fillStyle = C.strap; ctx.fillRect(-5, hipY - 1.5, 10, 2.2);
  // belt pouch with nails
  ctx.fillStyle = C.pouch; ctx.fillRect(-6, hipY - 0.5, 4, 4.5);
  ctx.strokeStyle = C.headLt; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-5, hipY - 0.5); ctx.lineTo(-5.5, hipY - 2.5); ctx.moveTo(-3.5, hipY - 0.5); ctx.lineTo(-3.2, hipY - 2); ctx.stroke();

  // --- Head: tanned face, stubble beard, flat cap -------------------------------
  ctx.fillStyle = C.skin;
  ctx.beginPath(); ctx.arc(0, headY, 4.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.beard;
  ctx.beginPath(); ctx.arc(0.4, headY + 2.2, 3.4, -0.25, Math.PI + 0.25); ctx.fill();
  ctx.fillStyle = C.cap;
  ctx.beginPath(); ctx.arc(0, headY - 1.6, 4.7, Math.PI, 0); ctx.fill();
  ctx.fillRect(-4.7, headY - 2, 9.4, 1.6);
  ctx.fillStyle = C.capLt; ctx.fillRect(1, headY - 0.6, 5.5, 1.4); // brim toward facing dir

  // --- Arms + hammer -------------------------------------------------------------
  const frontSh = { x: 4, y: shY + 2 };
  const backSh  = { x: -4, y: shY + 2 };

  if (u.carryLog) {
    // both hands up steadying the log on the shoulder
    limb(backSh.x, backSh.y, -3, shY - 7, C.skin, 2.8);
    limb(frontSh.x, frontSh.y, 5, shY - 6, C.skin, 2.8);
  } else if (working) {
    // strike arc: raised behind the head, snapping down in front
    const a = -2.1 + swingT * 1.75;
    const hand = { x: frontSh.x + Math.cos(a) * 9, y: frontSh.y + Math.sin(a) * 9 };
    limb(backSh.x, backSh.y, backSh.x - 1, shY + 10, C.skin, 2.8); // off hand braced at side
    limb(frontSh.x, frontSh.y, hand.x, hand.y, C.skin, 2.8);
    drawHammer(hand.x, hand.y, a);
  } else {
    // hammer rests over the shoulder while idle/walking
    const swing = moving ? Math.sin(anim) * 2.5 : 0;
    limb(backSh.x, backSh.y, backSh.x - 2 - swing, shY + 10, C.skin, 2.8);
    const hand = { x: frontSh.x + 2, y: shY + 5 + breathe * 0.3 };
    limb(frontSh.x, frontSh.y, hand.x, hand.y, C.skin, 2.8);
    drawHammer(hand.x, hand.y, -2.55); // handle up over the shoulder, head behind the back
  }

  ctx.restore();
}
