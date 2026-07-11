import { ctx, groundY } from '../../core/canvas.js';
import { drawBoot } from '../DrawHelpers.js';
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

function drawSickle(hx, hy, a) {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(a);
  ctx.strokeStyle = C.wood;
  ctx.lineWidth = 2.1;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(10, 0); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.strokeStyle = C.steel;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(11, -4, 7, Math.PI * 0.15, Math.PI * 1.22); ctx.stroke();
  ctx.strokeStyle = C.steelDk;
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(11, -4, 5, Math.PI * 0.2, Math.PI * 1.15); ctx.stroke();
  ctx.restore();
}

export function drawFarmer(u) {
  const t = performance.now() / 1000;
  const moving = !!u.moving;
  const anim = u.anim || 0;
  const working = !moving && (u.workTimer || 0) > 0.25;

  ctx.save();
  ctx.translate(u.x, 0);
  if (u.dir < 0) ctx.scale(-1, 1);

  if (isClimbingEntity(u)) {
    drawClimbPose(u, C, { strawHat: true, apron: true });
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
  limb(-3, hipY, backFoot, groundY - 4, C.pants, 3.2);
  limb(backFoot, groundY - 4.5, backFoot + 0.4, groundY - 2, C.boots, 3.5);
  drawBoot(backFoot + 0.4, groundY, C.boots, 0.96);
  limb(3, hipY, frontFoot, groundY - 4, C.pants, 3.2);
  limb(frontFoot, groundY - 4.5, frontFoot + 0.4, groundY - 2, C.boots, 3.5);
  drawBoot(frontFoot + 0.4, groundY, C.boots, 0.96);

  ctx.fillStyle = C.tunic;
  ctx.beginPath();
  ctx.moveTo(-5.8 + lean, shY);
  ctx.lineTo(5.8 + lean, shY);
  ctx.lineTo(5, hipY + 4);
  ctx.lineTo(-5, hipY + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.tunicLt;
  ctx.fillRect(-4.6 + lean, shY + 1, 3, 6);

  ctx.fillStyle = C.apron;
  ctx.beginPath();
  ctx.moveTo(-4 + lean, shY + 3);
  ctx.lineTo(4 + lean, shY + 3);
  ctx.lineTo(5, hipY + 8);
  ctx.lineTo(-5, hipY + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.apronLt;
  ctx.fillRect(-3.4 + lean, shY + 5, 2.3, 6);
  ctx.strokeStyle = C.belt;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-3.5 + lean, shY + 3);
  ctx.lineTo(0 + lean, shY - 1);
  ctx.lineTo(3.5 + lean, shY + 3);
  ctx.stroke();
  ctx.fillStyle = C.belt;
  ctx.fillRect(-5, hipY - 1.4, 10, 2.3);
  ctx.fillStyle = C.buckle;
  ctx.fillRect(-1, hipY - 1.4, 2, 2.3);

  ctx.fillStyle = "#d8b85d";
  for (let k = 0; k < 3; k++) {
    const sx = -7 + k * 3.2;
    ctx.beginPath();
    ctx.moveTo(sx, hipY + 4);
    ctx.quadraticCurveTo(sx + 0.8, hipY + 0.8, sx + 1.6, hipY + 4);
    ctx.strokeStyle = "#d8b85d";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.fillStyle = C.skin;
  ctx.beginPath(); ctx.arc(lean * 0.35, headY, 4.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.hair;
  ctx.beginPath(); ctx.arc(lean * 0.35 - 0.4, headY - 1.5, 4.3, Math.PI * 0.95, Math.PI * 2.03); ctx.fill();
  ctx.fillStyle = C.straw;
  ctx.beginPath(); ctx.ellipse(lean * 0.35, headY - 4.8, 8.5, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.strawLt;
  ctx.beginPath(); ctx.arc(lean * 0.35, headY - 5.6, 4.2, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = C.belt;
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(lean * 0.35 - 4.3, headY - 4.8); ctx.lineTo(lean * 0.35 + 4.3, headY - 4.8); ctx.stroke();
  ctx.fillStyle = "#352417";
  ctx.beginPath(); ctx.arc(lean * 0.35 + 2, headY - 0.3, 0.65, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = C.scarf;
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
    limb(backSh.x, backSh.y, backSh.x - 1, shY + 10, C.skin, 2.6);
    limb(frontSh.x, frontSh.y, hand.x, hand.y, C.skin, 2.6);
    drawSickle(hand.x, hand.y, a);
  } else {
    const swing = moving ? Math.sin(anim) * 2.6 : breathe * 0.5;
    limb(backSh.x, backSh.y, backSh.x - 2 - swing, shY + 11, C.skin, 2.6);
    const hand = { x: frontSh.x + 2.5 + swing * 0.2, y: shY + 8 };
    limb(frontSh.x, frontSh.y, hand.x, hand.y, C.skin, 2.6);
    drawSickle(hand.x, hand.y, -2.35);
  }

  ctx.restore();
}
