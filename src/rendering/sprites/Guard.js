import { ctx, groundY } from '../../core/canvas.js';
import { drawBoot } from '../DrawHelpers.js';
import { biomeHumanoidSkin, unitSkinVariant } from '../BiomeHumanoidSkins.js';
import { drawClimbPose, isClimbingEntity } from './FriendlyClimb.js';

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
function drawSpear(hx, hy, a, P = C) {
  ctx.save();
  ctx.translate(hx, hy); ctx.rotate(a);
  ctx.strokeStyle = P.haft; ctx.lineWidth = 2.2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(20, 0); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = P.steelLt;
  ctx.beginPath(); ctx.moveTo(20, -2); ctx.lineTo(27, 0); ctx.lineTo(20, 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.steelDk; ctx.fillRect(18.5, -1.6, 2, 3.2);
  if (P.detail === "frozen") {
    ctx.fillStyle = P.trim || "#eafaff";
    ctx.beginPath(); ctx.moveTo(21, -4); ctx.lineTo(30, 0); ctx.lineTo(21, 4); ctx.lineTo(23, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#9fdfff";
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(28, 0); ctx.moveTo(24, -2.2); ctx.lineTo(24, 2.2); ctx.stroke();
  } else if (P.detail === "desert") {
    ctx.fillStyle = P.accent || "#45b3aa";
    ctx.beginPath(); ctx.moveTo(14, -4); ctx.lineTo(19, -1.2); ctx.lineTo(14, 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.boss || "#efd383";
    ctx.fillRect(15.5, 1.8, 5, 1.4);
  } else if (P.detail === "swamp") {
    ctx.strokeStyle = P.accent || "#b4bd58";
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(-7, -1.5); ctx.quadraticCurveTo(5, -5, 21, -1.4); ctx.stroke();
    ctx.fillStyle = P.accent || "#b4bd58";
    ctx.beginPath(); ctx.moveTo(21, -2); ctx.lineTo(25, -5); ctx.lineTo(23, -1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(21, 2); ctx.lineTo(25, 5); ctx.lineTo(23, 1); ctx.closePath(); ctx.fill();
  } else if (P.detail === "volcano") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.glow || "#ff7a36";
    ctx.beginPath(); ctx.moveTo(20, -1.1); ctx.lineTo(28.5, 0); ctx.lineTo(20, 1.1); ctx.closePath(); ctx.fill();
    ctx.restore();
  } else if (P.detail === "corrupted") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = P.rune || "#d1a1ff";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(20, -3.5); ctx.quadraticCurveTo(29, 0, 20, 3.5); ctx.stroke();
    ctx.fillStyle = P.glow || "#9f68ff";
    ctx.beginPath(); ctx.arc(19, 0, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export function drawGuard(u) {
  const t = performance.now() / 1000;
  const moving = !!u.moving;
  const anim = u.anim || 0;
  const P = biomeHumanoidSkin("guard", u.x, C, unitSkinVariant(u));
  // thrust progress: 0→1 snap out, then eases back
  const sp = u.strike > 0 ? 1 - u.strike / 0.25 : -1;
  const thrust = sp >= 0 ? Math.sin(Math.min(sp * 1.6, 1) * Math.PI) : 0;

  ctx.save();
  ctx.translate(u.x, 0);
  if (u.dir < 0) ctx.scale(-1, 1);

  if (isClimbingEntity(u)) {
    drawClimbPose(u, P, { armor: true, helm: true, plume: true, shield: true });
    ctx.restore();
    return;
  }

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
  limb(-3, hipY, backFoot, groundY - 4, P.pants, 3.2);
  limb(backFoot, groundY - 4.5, backFoot + 0.5, groundY - 2, P.boots, 3.6);
  drawBoot(backFoot + 0.5, groundY, P.boots, 1);
  limb(3, hipY, frontFoot, groundY - 4, P.pants, 3.2);
  limb(frontFoot, groundY - 4.5, frontFoot + 0.5, groundY - 2, P.boots, 3.6);
  drawBoot(frontFoot + 0.5, groundY, P.boots, 1);

  // --- shield on the back arm (behind the torso) ---
  const shieldX = -6 + lean * 0.3;
  ctx.fillStyle = P.shieldWood;
  ctx.beginPath(); ctx.arc(shieldX, shY + 8, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = P.shieldRim; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(shieldX, shY + 8, 6.5, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = P.boss;
  ctx.beginPath(); ctx.arc(shieldX, shY + 8, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = P.accent || "rgba(242,193,78,0.8)";
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(shieldX - 3.5, shY + 8); ctx.lineTo(shieldX + 3.5, shY + 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(shieldX, shY + 4.5); ctx.lineTo(shieldX, shY + 11.5); ctx.stroke();
  if (P.detail === "frozen") {
    ctx.strokeStyle = P.trim || P.steelLt;
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(shieldX - 2.8, shY + 5.5); ctx.lineTo(shieldX + 2.8, shY + 10.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(shieldX + 2.8, shY + 5.5); ctx.lineTo(shieldX - 2.8, shY + 10.5); ctx.stroke();
  } else if (P.detail === "desert") {
    ctx.strokeStyle = P.accent;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(shieldX, shY + 8, 4.1, 0, Math.PI * 2); ctx.stroke();
  } else if (P.detail === "swamp") {
    ctx.fillStyle = P.accent;
    ctx.beginPath(); ctx.arc(shieldX - 2.7, shY + 10.2, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(shieldX + 2.9, shY + 6.8, 0.9, 0, Math.PI * 2); ctx.fill();
  } else if (P.detail === "volcano") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.glow;
    ctx.beginPath(); ctx.arc(shieldX, shY + 8, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (P.detail === "corrupted") {
    ctx.strokeStyle = P.rune;
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(shieldX, shY + 4.5); ctx.lineTo(shieldX + 2.4, shY + 8); ctx.lineTo(shieldX, shY + 11.5); ctx.lineTo(shieldX - 2.4, shY + 8); ctx.closePath(); ctx.stroke();
  }
  if (P.detail === "frozen") {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI / 3;
      ctx.beginPath();
      ctx.moveTo(shieldX + Math.cos(a) * 1.3, shY + 8 + Math.sin(a) * 1.3);
      ctx.lineTo(shieldX + Math.cos(a) * 5.1, shY + 8 + Math.sin(a) * 5.1);
      ctx.moveTo(shieldX - Math.cos(a) * 1.3, shY + 8 - Math.sin(a) * 1.3);
      ctx.lineTo(shieldX - Math.cos(a) * 5.1, shY + 8 - Math.sin(a) * 5.1);
      ctx.stroke();
    }
  } else if (P.detail === "desert") {
    ctx.fillStyle = P.boss;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(shieldX + Math.cos(a) * 3.5, shY + 8 + Math.sin(a) * 3.5);
      ctx.lineTo(shieldX + Math.cos(a + 0.18) * 5.8, shY + 8 + Math.sin(a + 0.18) * 5.8);
      ctx.lineTo(shieldX + Math.cos(a - 0.18) * 5.8, shY + 8 + Math.sin(a - 0.18) * 5.8);
      ctx.closePath(); ctx.fill();
    }
  } else if (P.detail === "swamp") {
    ctx.strokeStyle = "#d0d66c";
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(shieldX - 5, shY + 11); ctx.quadraticCurveTo(shieldX, shY + 4, shieldX + 5, shY + 10); ctx.stroke();
  } else if (P.detail === "volcano") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = P.glow;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(shieldX - 3, shY + 5); ctx.lineTo(shieldX - 0.5, shY + 8); ctx.lineTo(shieldX - 2, shY + 11); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(shieldX + 2.5, shY + 5.5); ctx.lineTo(shieldX + 0.6, shY + 8.6); ctx.lineTo(shieldX + 3.5, shY + 11); ctx.stroke();
    ctx.restore();
  } else if (P.detail === "corrupted") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.glow;
    ctx.beginPath(); ctx.ellipse(shieldX, shY + 8, 3.8, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#160d20";
    ctx.beginPath(); ctx.arc(shieldX + 0.8, shY + 8, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // arm gripping it
  limb(-4 + lean, shY + 2, shieldX, shY + 7, P.skin, 2.5);

  // --- torso: padded gambeson with stitched rows ---
  ctx.fillStyle = P.gambeson;
  ctx.beginPath();
  ctx.moveTo(-5.5 + lean, shY);
  ctx.lineTo(5.5 + lean, shY);
  ctx.lineTo(5, hipY + 4);
  ctx.lineTo(-5, hipY + 4);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.gambesonLt; ctx.fillRect(-4.5 + lean, shY + 1, 3, 7);
  ctx.strokeStyle = "rgba(0,0,0,0.22)"; ctx.lineWidth = 1;
  for (let k = 1; k <= 3; k++) {
    const ry = shY + k * 3.6;
    ctx.beginPath(); ctx.moveTo(-5 + lean * (1 - k * 0.2), ry); ctx.lineTo(5 + lean * (1 - k * 0.2), ry); ctx.stroke();
  }
  // belt + gold buckle
  ctx.fillStyle = P.strap; ctx.fillRect(-4.5, hipY - 1.5, 9, 2.4);
  ctx.fillStyle = P.boss; ctx.fillRect(-1, hipY - 1.5, 2, 2.4);
  ctx.fillStyle = P.steelDk;
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath();
    ctx.moveTo(k * 2, hipY + 1);
    ctx.lineTo(k * 2 + 1.4, hipY + 6);
    ctx.lineTo(k * 2 - 1.4, hipY + 6);
    ctx.closePath();
    ctx.fill();
  }
  if (P.detail === "frozen") {
    ctx.strokeStyle = P.trim || "#eafaff";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-5.4 + lean, shY + 1.4); ctx.quadraticCurveTo(lean, shY + 5.8, 5.4 + lean, shY + 1.4); ctx.stroke();
  } else if (P.detail === "desert") {
    ctx.fillStyle = P.accent;
    ctx.beginPath(); ctx.moveTo(-5 + lean, shY + 1); ctx.lineTo(5 + lean, hipY + 2); ctx.lineTo(3.5 + lean, hipY + 4); ctx.lineTo(-6 + lean, shY + 3); ctx.closePath(); ctx.fill();
  } else if (P.detail === "swamp") {
    ctx.fillStyle = P.accent;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(-4.5 + i * 3, hipY + 5.5 + (i % 2), 0.9, 0, Math.PI * 2); ctx.fill();
    }
  } else if (P.detail === "volcano") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.glow;
    ctx.beginPath(); ctx.arc(lean + 3, shY + 5.2, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(lean - 2.4, shY + 9.2, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (P.detail === "corrupted") {
    ctx.strokeStyle = P.rune;
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(lean - 3.5, shY + 3); ctx.lineTo(lean + 1.5, shY + 8); ctx.lineTo(lean - 1, hipY + 3); ctx.stroke();
  }

  // --- head: kettle helm with wide brim, shaded face ---
  const hx = lean * 0.8;
  ctx.fillStyle = P.skin;
  ctx.beginPath(); ctx.arc(hx, headY, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(14,12,10,0.32)";
  ctx.beginPath(); ctx.arc(hx + 0.3, headY - 0.8, 3.8, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  ctx.fillStyle = P.steel;
  ctx.beginPath(); ctx.arc(hx, headY - 1.8, 4.8, Math.PI, 0); ctx.fill();
  ctx.fillRect(hx - 6.4, headY - 2.4, 12.8, 1.8); // brim
  ctx.fillStyle = P.steelLt; ctx.fillRect(hx - 6.4, headY - 2.4, 12.8, 0.8);
  if (P.detail === "frozen") {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(hx - 5.4, headY - 0.6, 10.8, 1.5);
  } else if (P.detail === "volcano") {
    ctx.fillStyle = P.glow;
    ctx.beginPath(); ctx.arc(hx + 2.6, headY - 3.7, 0.9, 0, Math.PI * 2); ctx.fill();
  } else if (P.detail === "corrupted") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.glow;
    ctx.beginPath(); ctx.arc(hx + 2, headY + 0.4, 1.25, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = P.plume || "#8f3232";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(hx, headY - 6);
  ctx.quadraticCurveTo(hx - 4, headY - 9, hx - 8, headY - 6.5);
  ctx.stroke();
  ctx.lineCap = "butt";
  // eye under the brim
  ctx.fillStyle = "#241c12";
  ctx.beginPath(); ctx.arc(hx + 2, headY + 0.4, 0.7, 0, Math.PI * 2); ctx.fill();

  // --- spear arm ---
  if (sp >= 0) {
    // thrust: level stab, hand drives forward
    const hand = { x: 5 + lean + thrust * 7, y: shY + 4 };
    limb(4 + lean, shY + 2, hand.x, hand.y, P.skin, 2.5);
    drawSpear(hand.x, hand.y, 0, P);
    // motion smear on the way out
    if (sp < 0.6) {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (0.6 - sp) * 0.8;
      ctx.strokeStyle = P.steelLt; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(hand.x + 6, hand.y); ctx.lineTo(hand.x + 24, hand.y); ctx.stroke();
      ctx.restore();
    }
  } else if (moving) {
    // marching: spear angled forward over the shoulder
    const swing = Math.sin(anim) * 1.5;
    const hand = { x: 5, y: shY + 5 + swing * 0.3 };
    limb(4, shY + 2, hand.x, hand.y, P.skin, 2.5);
    drawSpear(hand.x, hand.y, -0.5, P);
  } else {
    // at ease: spear planted upright, butt on the ground
    const hand = { x: 6.5, y: shY + 3 + breathe * 0.3 };
    limb(4, shY + 2, hand.x, hand.y, P.skin, 2.5);
    ctx.save();
    ctx.translate(7, groundY); ctx.rotate(-Math.PI / 2);
    ctx.strokeStyle = P.haft; ctx.lineWidth = 2.2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(34, 0); ctx.stroke(); ctx.lineCap = "butt";
    ctx.fillStyle = P.steelLt;
    ctx.beginPath(); ctx.moveTo(34, -2); ctx.lineTo(41, 0); ctx.lineTo(34, 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.steelDk; ctx.fillRect(32.5, -1.6, 2, 3.2);
    ctx.restore();
  }

  ctx.restore();
}
