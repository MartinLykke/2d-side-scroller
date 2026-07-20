import { ctx, groundY } from '../../core/canvas.js';
import { drawBoot } from '../DrawHelpers.js';
import { biomeHumanoidSkin, unitSkinVariant } from '../BiomeHumanoidSkins.js';
import { drawClimbPose, isClimbingEntity } from './FriendlyClimb.js';

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
function drawHammer(hx, hy, a, P = C) {
  ctx.save();
  ctx.translate(hx, hy); ctx.rotate(a);
  ctx.strokeStyle = P.handle; ctx.lineWidth = 2.4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(11, 0); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = P.head; ctx.fillRect(8, -4.5, 6, 9);
  ctx.fillStyle = P.headLt; ctx.fillRect(8, -4.5, 6, 3);
  if (P.detail === "frozen") {
    ctx.fillStyle = P.trim || "#f3fbff";
    ctx.beginPath(); ctx.moveTo(14, -4.5); ctx.lineTo(19, -1.5); ctx.lineTo(14, 1.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(8.7, -4, 4.8, 1.4);
  } else if (P.detail === "desert") {
    ctx.fillStyle = P.trim || "#f1d58a";
    ctx.fillRect(7.6, -5.1, 7.2, 2);
    ctx.fillRect(7.6, 3.1, 7.2, 2);
    ctx.fillStyle = P.accent || "#47a8a0";
    ctx.beginPath(); ctx.arc(14.5, 0, 1.25, 0, Math.PI * 2); ctx.fill();
  } else if (P.detail === "swamp") {
    ctx.strokeStyle = P.trim || "#a9ba58";
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(-1, -1.5); ctx.quadraticCurveTo(5, -6, 14, -2); ctx.stroke();
    ctx.fillStyle = P.accent || "#c8d760";
    ctx.beginPath(); ctx.arc(13.5, 3.2, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(10.5, -3.4, 0.9, 0, Math.PI * 2); ctx.fill();
  } else if (P.detail === "volcano") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = P.glow || "#ff7a36";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(9, -3.2); ctx.lineTo(13.5, 2.8); ctx.moveTo(11, -4); ctx.lineTo(8.8, 4); ctx.stroke();
    ctx.restore();
  } else if (P.detail === "corrupted") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = P.rune || "#d1a1ff";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(11, 0, 3.2, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = P.glow || "#9f68ff";
    ctx.beginPath(); ctx.arc(14.2, 0, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export function drawBuilder(u) {
  const t = performance.now() / 1000;
  const moving = !!u.moving;
  const working = !!u.working && !moving;
  const anim = u.anim || 0;
  const P = biomeHumanoidSkin("builder", u.x, C, unitSkinVariant(u));

  ctx.save();
  ctx.translate(u.x, 0);
  if (u.dir < 0) ctx.scale(-1, 1);

  if (isClimbingEntity(u)) {
    drawClimbPose(u, P, { cap: true, apron: true });
    ctx.restore();
    return;
  }

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
  limb(-3, hipY, backFoot, groundY - 4, P.pants, 3.4);
  limb(backFoot, groundY - 4.5, backFoot + 0.6, groundY - 2, P.boots, 3.8);
  drawBoot(backFoot + 0.6, groundY, P.boots, 1.05);
  limb(3, hipY, frontFoot, groundY - 4, P.pants, 3.4);
  limb(frontFoot, groundY - 4.5, frontFoot + 0.6, groundY - 2, P.boots, 3.8);
  drawBoot(frontFoot + 0.6, groundY, P.boots, 1.05);

  // --- Torso: broad tunic ------------------------------------------------------
  ctx.fillStyle = P.tunic;
  ctx.beginPath();
  ctx.moveTo(-6, shY);
  ctx.lineTo(6, shY);
  ctx.lineTo(5, hipY + 3);
  ctx.lineTo(-5, hipY + 3);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.tunicLt; ctx.fillRect(-5, shY + 1, 3, 5);
  // rolled-up sleeve hints at the shoulders
  ctx.fillStyle = P.tunicLt;
  ctx.fillRect(-6.5, shY + 0.5, 3, 4);
  ctx.fillRect(3.5, shY + 0.5, 3, 4);

  // --- Leather apron over the front -------------------------------------------
  ctx.fillStyle = P.apron;
  ctx.beginPath();
  ctx.moveTo(-3.5, shY + 2);
  ctx.lineTo(3.5, shY + 2);
  ctx.lineTo(5, hipY + 6);
  ctx.lineTo(-5, hipY + 6);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.apronLt;
  ctx.fillRect(-3, shY + 3.5, 2, 6);
  // neck strap + waist tie
  ctx.strokeStyle = P.strap; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-3, shY + 2); ctx.lineTo(0, shY - 2); ctx.lineTo(3, shY + 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-5.2, shY + 1); ctx.lineTo(-1.4, hipY + 4); ctx.moveTo(5.2, shY + 1); ctx.lineTo(1.4, hipY + 4); ctx.stroke();
  ctx.fillStyle = P.strap; ctx.fillRect(-5, hipY - 1.5, 10, 2.2);
  // belt pouch with nails
  ctx.fillStyle = P.pouch; ctx.fillRect(-6, hipY - 0.5, 4, 4.5);
  ctx.strokeStyle = P.headLt; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-5, hipY - 0.5); ctx.lineTo(-5.5, hipY - 2.5); ctx.moveTo(-3.5, hipY - 0.5); ctx.lineTo(-3.2, hipY - 2); ctx.stroke();
  ctx.fillStyle = "#8f8f9c";
  ctx.fillRect(4.2, hipY + 0.2, 1.2, 4.5);
  ctx.fillRect(6, hipY + 0.8, 1.2, 3.8);
  if (P.detail === "frozen") {
    ctx.strokeStyle = P.trim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-5.8, shY + 1.5); ctx.quadraticCurveTo(0, shY + 5.5, 5.8, shY + 1.5); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(-4.8, hipY + 4.5, 9.6, 2);
  } else if (P.detail === "desert") {
    ctx.fillStyle = P.trim;
    ctx.fillRect(-5.4, shY + 4, 10.8, 2);
    ctx.fillStyle = P.accent || P.capLt;
    ctx.fillRect(-4.5, hipY + 2.2, 9, 1.6);
  } else if (P.detail === "swamp") {
    ctx.fillStyle = P.trim;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(-4.5 + i * 3, hipY + 4.5 + (i % 2), 1, 0, Math.PI * 2); ctx.fill();
    }
  } else if (P.detail === "volcano") {
    ctx.fillStyle = P.glow;
    ctx.beginPath(); ctx.arc(3.7, shY + 8.4, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,122,54,0.24)";
    ctx.fillRect(-4.8, hipY + 3, 9.6, 2);
  } else if (P.detail === "corrupted") {
    ctx.strokeStyle = P.rune; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(2.2, shY + 6.5); ctx.lineTo(4, shY + 9.2); ctx.lineTo(2.6, shY + 12); ctx.stroke();
  }
  if (P.detail === "frozen") {
    ctx.fillStyle = P.trim;
    ctx.beginPath(); ctx.ellipse(-6.8, shY + 3, 3.4, 2.2, -0.25, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(6.8, shY + 3, 3.4, 2.2, 0.25, 0, Math.PI * 2); ctx.fill();
  } else if (P.detail === "desert") {
    ctx.fillStyle = P.trim;
    ctx.beginPath(); ctx.moveTo(-6.2, shY + 1.5); ctx.lineTo(-10, shY + 13); ctx.lineTo(-5.4, shY + 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.accent || P.capLt;
    ctx.beginPath(); ctx.arc(5.3, shY + 5.2, 1.4, 0, Math.PI * 2); ctx.fill();
  } else if (P.detail === "swamp") {
    ctx.strokeStyle = P.trim;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(-7 + i * 3.5, shY + 2); ctx.quadraticCurveTo(-5 + i * 4, shY + 10, -7 + i * 3.5, hipY + 6); ctx.stroke();
    }
  } else if (P.detail === "volcano") {
    ctx.fillStyle = "#221719";
    ctx.fillRect(-4.4, hipY + 4.2, 8.8, 2.2);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.glow;
    ctx.beginPath(); ctx.arc(-2, hipY + 5.4, 0.9, 0, Math.PI * 2); ctx.arc(2, hipY + 5.4, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (P.detail === "corrupted") {
    ctx.strokeStyle = P.rune;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-5.5, hipY + 5); ctx.quadraticCurveTo(-8, hipY + 8, -5, hipY + 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5.5, hipY + 5); ctx.quadraticCurveTo(8, hipY + 8, 5, hipY + 10); ctx.stroke();
  }

  // --- Head: tanned face, stubble beard, flat cap -------------------------------
  ctx.fillStyle = P.skin;
  ctx.beginPath(); ctx.arc(0, headY, 4.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.beard;
  ctx.beginPath(); ctx.arc(0.4, headY + 2.2, 3.4, -0.25, Math.PI + 0.25); ctx.fill();
  ctx.fillStyle = P.cap;
  ctx.beginPath(); ctx.arc(0, headY - 1.6, 4.7, Math.PI, 0); ctx.fill();
  ctx.fillRect(-4.7, headY - 2, 9.4, 1.6);
  ctx.fillStyle = P.capLt; ctx.fillRect(1, headY - 0.6, 5.5, 1.4); // brim toward facing dir
  if (P.detail === "frozen") {
    ctx.strokeStyle = P.trim; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(0, headY - 2, 5.2, Math.PI, 0); ctx.stroke();
  } else if (P.detail === "desert") {
    ctx.fillStyle = P.trim;
    ctx.fillRect(-4.8, headY + 0.8, 9, 2.2);
  } else if (P.detail === "swamp") {
    ctx.fillStyle = P.trim;
    ctx.beginPath(); ctx.moveTo(-3.4, headY - 4.7); ctx.lineTo(-1.5, headY - 8.3); ctx.lineTo(0, headY - 4.5); ctx.closePath(); ctx.fill();
  } else if (P.detail === "volcano") {
    ctx.fillStyle = "rgba(255,122,54,0.8)";
    ctx.beginPath(); ctx.arc(2.5, headY - 3.4, 0.9, 0, Math.PI * 2); ctx.fill();
  } else if (P.detail === "corrupted") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.glow;
    ctx.beginPath(); ctx.arc(2.1, headY - 0.4, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // --- Arms + hammer -------------------------------------------------------------
  const frontSh = { x: 4, y: shY + 2 };
  const backSh  = { x: -4, y: shY + 2 };

  if (u.carryLog) {
    // both hands up steadying the log on the shoulder
    limb(backSh.x, backSh.y, -3, shY - 7, P.skin, 2.8);
    limb(frontSh.x, frontSh.y, 5, shY - 6, P.skin, 2.8);
  } else if (working) {
    // strike arc: raised behind the head, snapping down in front
    const a = -2.1 + swingT * 1.75;
    const hand = { x: frontSh.x + Math.cos(a) * 9, y: frontSh.y + Math.sin(a) * 9 };
    limb(backSh.x, backSh.y, backSh.x - 1, shY + 10, P.skin, 2.8); // off hand braced at side
    limb(frontSh.x, frontSh.y, hand.x, hand.y, P.skin, 2.8);
    drawHammer(hand.x, hand.y, a, P);
  } else {
    // hammer rests over the shoulder while idle/walking
    const swing = moving ? Math.sin(anim) * 2.5 : 0;
    limb(backSh.x, backSh.y, backSh.x - 2 - swing, shY + 10, P.skin, 2.8);
    const hand = { x: frontSh.x + 2, y: shY + 5 + breathe * 0.3 };
    limb(frontSh.x, frontSh.y, hand.x, hand.y, P.skin, 2.8);
    drawHammer(hand.x, hand.y, -2.55, P); // handle up over the shoulder, head behind the back
  }

  ctx.restore();
}
