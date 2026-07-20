import { ctx, groundY } from '../../core/canvas.js';
import { drawBoot } from '../DrawHelpers.js';
import { biomeHumanoidSkin, unitSkinVariant } from '../BiomeHumanoidSkins.js';
import { drawClimbPose, isClimbingEntity } from './FriendlyClimb.js';

const C = {
  tunic: "#5d6a34",
  tunicLt: "#738046",
  apron: "#80623a",
  apronLt: "#9a7848",
  pants: "#4a3f2d",
  boots: "#33261a",
  skin: "#d2aa7f",
  straw: "#c9a85e",
  strawLt: "#dbc579",
  belt: "#4a2f18",
  buckle: "#d4a838",
  scarf: "#b85b3a",
  wood: "#6a4a28",
  steel: "#c2c5c8",
  steelDk: "#8a8d92",
  hair: "#5a3a24",
};

function limb(x1, y1, x2, y2, col, w) {
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.lineCap = "butt";
}

function drawSickle(hx, hy, a, P = C) {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(a);
  ctx.strokeStyle = P.wood;
  ctx.lineWidth = 2.1;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(10, 0); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.strokeStyle = P.steel;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(11, -4, 7, Math.PI * 0.15, Math.PI * 1.22); ctx.stroke();
  ctx.strokeStyle = P.steelDk;
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(11, -4, 5, Math.PI * 0.2, Math.PI * 1.15); ctx.stroke();
  if (P.detail === "frozen") {
    ctx.strokeStyle = P.trim;
    ctx.lineWidth = 1;
    for (const a2 of [0.35, 0.7, 1.02]) {
      const x = 11 + Math.cos(a2) * 7, y = -4 + Math.sin(a2) * 7;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2.5, y + 3.5); ctx.stroke();
    }
  } else if (P.detail === "desert") {
    ctx.fillStyle = P.accent;
    ctx.fillRect(2, -1.5, 3.5, 3);
  } else if (P.detail === "swamp") {
    ctx.strokeStyle = P.trim;
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(2, -1.4); ctx.quadraticCurveTo(8, -6, 14, -6); ctx.stroke();
  } else if (P.detail === "volcano") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = P.glow; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(11, -4, 6, Math.PI * 0.2, Math.PI * 0.95); ctx.stroke();
    ctx.restore();
  } else if (P.detail === "corrupted") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.glow;
    ctx.beginPath(); ctx.arc(5, 0, 1.25, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawFarmerHeadgear(P, x, y) {
  if (P.detail === "frozen") {
    ctx.fillStyle = P.straw;
    ctx.beginPath(); ctx.arc(x, y - 4, 5.5, Math.PI, 0); ctx.fill();
    ctx.fillStyle = P.strawLt;
    ctx.beginPath(); ctx.ellipse(x, y - 3.5, 6.8, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.accent;
    ctx.beginPath(); ctx.arc(x + 4.8, y - 6.8, 1.35, 0, Math.PI * 2); ctx.fill();
  } else if (P.detail === "desert") {
    ctx.fillStyle = P.straw;
    ctx.beginPath(); ctx.arc(x, y - 2.4, 5.2, Math.PI, 0); ctx.fill();
    ctx.fillStyle = P.strawLt;
    ctx.fillRect(x - 5.6, y - 3.3, 11.2, 2.3);
    ctx.fillStyle = P.accent;
    ctx.fillRect(x - 5.7, y - 1.3, 10.5, 1.7);
    ctx.fillStyle = P.straw;
    ctx.beginPath(); ctx.moveTo(x - 5, y - 1); ctx.lineTo(x - 7.4, y + 6); ctx.lineTo(x - 3.2, y + 3.8); ctx.closePath(); ctx.fill();
  } else if (P.detail === "swamp") {
    ctx.fillStyle = P.straw;
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 3.7); ctx.lineTo(x - 3.5, y - 6); ctx.lineTo(x - 1, y - 9);
    ctx.lineTo(x + 2, y - 6); ctx.lineTo(x + 9, y - 3.5); ctx.lineTo(x + 3, y - 1.8);
    ctx.lineTo(x - 4, y - 1.9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = P.trim; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 6, y - 4); ctx.lineTo(x + 6, y - 3.2); ctx.stroke();
    ctx.fillStyle = P.accent;
    ctx.beginPath(); ctx.ellipse(x + 2, y - 8.5, 1.4, 3, 0.45, 0, Math.PI * 2); ctx.fill();
  } else if (P.detail === "volcano") {
    ctx.fillStyle = P.straw;
    ctx.beginPath();
    ctx.moveTo(x - 6.5, y - 2.2); ctx.lineTo(x - 3.3, y - 8.5); ctx.lineTo(x, y - 11.5);
    ctx.lineTo(x + 4.8, y - 6); ctx.lineTo(x + 6.5, y - 2.2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.strawLt;
    ctx.fillRect(x - 6.7, y - 3.3, 13.4, 2.2);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = P.glow; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 1, y - 9.8); ctx.lineTo(x + 1, y - 6.8); ctx.lineTo(x - 0.4, y - 4); ctx.stroke();
    ctx.restore();
  } else if (P.detail === "corrupted") {
    ctx.fillStyle = P.straw;
    ctx.beginPath();
    ctx.moveTo(x - 6.5, y - 2); ctx.quadraticCurveTo(x - 4, y - 10, x + 1, y - 12);
    ctx.quadraticCurveTo(x + 6, y - 7, x + 6.5, y - 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.strawLt;
    ctx.beginPath(); ctx.ellipse(x, y - 2.4, 7.6, 2.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = P.rune; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(x + 0.5, y - 6.8, 2.5, 0.2, Math.PI * 1.8); ctx.stroke();
    ctx.restore();
  } else {
    ctx.fillStyle = P.straw;
    ctx.beginPath(); ctx.ellipse(x, y - 4.8, 8.5, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.strawLt;
    ctx.beginPath(); ctx.arc(x, y - 5.6, 4.2, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = P.belt;
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(x - 4.3, y - 4.8); ctx.lineTo(x + 4.3, y - 4.8); ctx.stroke();
  }
}

export function drawFarmer(u) {
  const t = performance.now() / 1000;
  const moving = !!u.moving;
  const anim = u.anim || 0;
  const working = !moving && (u.workTimer || 0) > 0.25;
  const P = biomeHumanoidSkin("farmer", u.x, C, unitSkinVariant(u));

  ctx.save();
  ctx.translate(u.x, 0);
  if (u.dir < 0) ctx.scale(-1, 1);

  if (isClimbingEntity(u)) {
    drawClimbPose(u, P, { strawHat: P.detail === "forest", cap: P.detail !== "forest", apron: true });
    ctx.restore();
    return;
  }

  const breathe = Math.sin(t * 1.65 + (u.x || 0) * 0.02);
  const bob = moving ? Math.abs(Math.sin(anim)) * 1.25 : breathe * 0.45 + 0.45;
  const harvest = working ? (Math.sin(t * 5.8) + 1) * 0.5 : 0;
  const lean = harvest * 2.5;
  const hipY = groundY - 17 - bob * 0.35 + harvest * 2;
  const shY = groundY - 30 - bob + harvest * 3;
  const headY = groundY - 37.5 - bob + harvest * 2;

  const s = Math.sin(anim);
  const stride = moving ? 5 : 0;
  let backFoot = -3 + s * stride;
  let frontFoot = 3 - s * stride;
  if (harvest > 0.2) { backFoot = -6; frontFoot = 5; }
  limb(-3, hipY, backFoot, groundY - 4, P.pants, 3.2);
  limb(backFoot, groundY - 4.5, backFoot + 0.4, groundY - 2, P.boots, 3.5);
  drawBoot(backFoot + 0.4, groundY, P.boots, 0.96);
  limb(3, hipY, frontFoot, groundY - 4, P.pants, 3.2);
  limb(frontFoot, groundY - 4.5, frontFoot + 0.4, groundY - 2, P.boots, 3.5);
  drawBoot(frontFoot + 0.4, groundY, P.boots, 0.96);

  ctx.fillStyle = P.tunic;
  ctx.beginPath();
  ctx.moveTo(-5.8 + lean, shY);
  ctx.lineTo(5.8 + lean, shY);
  ctx.lineTo(5, hipY + 4);
  ctx.lineTo(-5, hipY + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = P.tunicLt;
  ctx.fillRect(-4.6 + lean, shY + 1, 3, 6);

  ctx.fillStyle = P.apron;
  ctx.beginPath();
  ctx.moveTo(-4 + lean, shY + 3);
  ctx.lineTo(4 + lean, shY + 3);
  ctx.lineTo(5, hipY + 8);
  ctx.lineTo(-5, hipY + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = P.apronLt;
  ctx.fillRect(-3.4 + lean, shY + 5, 2.3, 6);
  ctx.strokeStyle = P.belt;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-3.5 + lean, shY + 3);
  ctx.lineTo(0 + lean, shY - 1);
  ctx.lineTo(3.5 + lean, shY + 3);
  ctx.stroke();
  ctx.fillStyle = P.belt;
  ctx.fillRect(-5, hipY - 1.4, 10, 2.3);
  ctx.fillStyle = P.buckle;
  ctx.fillRect(-1, hipY - 1.4, 2, 2.3);

  ctx.fillStyle = P.accent;
  for (let k = 0; k < 3; k++) {
    const sx = -7 + k * 3.2;
    ctx.beginPath();
    ctx.moveTo(sx, hipY + 4);
    ctx.quadraticCurveTo(sx + 0.8, hipY + 0.8, sx + 1.6, hipY + 4);
    ctx.strokeStyle = P.accent;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (P.detail === "frozen") {
    ctx.strokeStyle = P.trim; ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.moveTo(-4.5, hipY + 5); ctx.lineTo(4.5, hipY + 5); ctx.stroke();
  } else if (P.detail === "desert") {
    ctx.fillStyle = P.accent; ctx.fillRect(-4.4 + lean, shY + 7, 1.6, 8);
  } else if (P.detail === "swamp") {
    ctx.fillStyle = P.accent;
    ctx.beginPath(); ctx.ellipse(-3.6, hipY + 3, 1.3, 2.6, 0.6, 0, Math.PI * 2); ctx.fill();
  } else if (P.detail === "volcano") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = P.glow; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(1 + lean, shY + 5); ctx.lineTo(-1 + lean, shY + 10); ctx.lineTo(2 + lean, hipY + 2); ctx.stroke();
    ctx.restore();
  } else if (P.detail === "corrupted") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = P.rune; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(lean, shY + 9, 2.6, 0.2, Math.PI * 1.8); ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = P.skin;
  ctx.beginPath(); ctx.arc(lean * 0.35, headY, 4.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.hair;
  ctx.beginPath(); ctx.arc(lean * 0.35 - 0.4, headY - 1.5, 4.3, Math.PI * 0.95, Math.PI * 2.03); ctx.fill();
  drawFarmerHeadgear(P, lean * 0.35, headY);
  ctx.fillStyle = "#352417";
  ctx.beginPath(); ctx.arc(lean * 0.35 + 2, headY - 0.3, 0.65, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = P.scarf;
  ctx.beginPath();
  ctx.moveTo(-4.4 + lean, shY - 0.4);
  ctx.quadraticCurveTo(lean, shY + 3.2, 4.4 + lean, shY - 0.4);
  ctx.lineTo(2.2 + lean, shY + 4);
  ctx.lineTo(-1.8 + lean, shY + 2.8);
  ctx.closePath();
  ctx.fill();

  const frontSh = { x: 4 + lean, y: shY + 2 };
  const backSh = { x: -4 + lean, y: shY + 2 };
  if (harvest > 0.05) {
    const a = -1.15 + harvest * 1.2;
    const hand = { x: frontSh.x + Math.cos(a) * 9, y: frontSh.y + 6 + Math.sin(a) * 8 };
    limb(backSh.x, backSh.y, backSh.x - 1, shY + 10, P.skin, 2.6);
    limb(frontSh.x, frontSh.y, hand.x, hand.y, P.skin, 2.6);
    drawSickle(hand.x, hand.y, a, P);
  } else {
    const swing = moving ? Math.sin(anim) * 2.6 : breathe * 0.5;
    limb(backSh.x, backSh.y, backSh.x - 2 - swing, shY + 11, P.skin, 2.6);
    const hand = { x: frontSh.x + 2.5 + swing * 0.2, y: shY + 8 };
    limb(frontSh.x, frontSh.y, hand.x, hand.y, P.skin, 2.6);
    drawSickle(hand.x, hand.y, -2.35, P);
  }

  ctx.restore();
}
