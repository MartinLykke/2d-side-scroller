import { ctx, groundY } from '../../core/canvas.js';
import { drawBoot } from '../DrawHelpers.js';
import { drawClimbPose, isClimbingEntity } from './FriendlyClimb.js';

const C = {
  skin: "#d3ac82",
  hair: "#342414",
  beard: "#5a3d24",
  boots: "#2f2419",
  leather: "#3a2a1a",
  pants: "#352b24",
  armor: "#596878",
  armorDk: "#2a3440",
  armorLt: "#8794a2",
  gold: "#d4a838",
  goldDk: "#8a6a2a",
  tabard: "#8f2031",
  tabardDk: "#5c1420",
  cape: "#b91c32",
  capeDk: "#74131f",
  capeLt: "#e85a5a",
  jewel: "#ff6a9a",
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

function plate(x, y, w, h, color, trim = true) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.45, y);
  ctx.lineTo(x + w * 0.45, y);
  ctx.lineTo(x + w * 0.34, y + h);
  ctx.lineTo(x - w * 0.34, y + h);
  ctx.closePath();
  ctx.fill();
  if (trim) {
    ctx.strokeStyle = C.armorDk;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

function drawCape(shX, shY, hipY, moving, run, airborne, gallop) {
  const t = performance.now() / 1000;
  const strideWave = Math.sin(gallop * 1.4);
  const flow = airborne ? -15 : run ? -13 - strideWave * 2.5 : moving ? -7 + strideWave * 2 : Math.sin(t * 1.3) * 2;
  const lift = airborne ? -4 : 0;

  ctx.fillStyle = C.capeDk;
  ctx.beginPath();
  ctx.moveTo(shX - 5, shY - 3);
  ctx.lineTo(shX + 3, shY - 2);
  ctx.bezierCurveTo(shX + flow * 0.1, shY + 8, shX + flow * 0.65, hipY + 3, shX + flow, groundY - 1 + lift);
  ctx.lineTo(shX + flow * 0.55, groundY - 4 + lift);
  ctx.lineTo(shX + flow * 0.25 - 7, groundY - 1 + lift);
  ctx.bezierCurveTo(shX - 10 + flow * 0.25, hipY + 1, shX - 10, shY + 6, shX - 5, shY - 3);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = C.cape;
  ctx.beginPath();
  ctx.moveTo(shX - 3, shY - 2);
  ctx.bezierCurveTo(shX + flow * 0.08, shY + 7, shX + flow * 0.42, hipY + 5, shX + flow * 0.66, groundY - 6 + lift);
  ctx.lineTo(shX + flow * 0.35 - 3, groundY - 5 + lift);
  ctx.bezierCurveTo(shX - 7 + flow * 0.12, hipY + 2, shX - 7, shY + 7, shX - 3, shY - 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = C.capeLt;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(shX - 2, shY);
  ctx.quadraticCurveTo(shX - 5 + flow * 0.18, shY + 8, shX - 5 + flow * 0.25, hipY + 8);
  ctx.lineTo(shX - 1 + flow * 0.18, hipY + 4);
  ctx.quadraticCurveTo(shX + 1 + flow * 0.08, shY + 6, shX, shY);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawHead(headX, headY, hurt) {
  ctx.fillStyle = C.skin;
  ctx.beginPath(); ctx.arc(headX, headY, 5.2, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = C.hair;
  ctx.beginPath(); ctx.arc(headX - 0.5, headY - 1.8, 5.1, Math.PI * 0.92, Math.PI * 2.08); ctx.fill();
  ctx.beginPath(); ctx.ellipse(headX - 3.9, headY - 0.2, 1.7, 2.8, 0.25, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(headX + 3.5, headY - 0.5, 1.2, 2.2, -0.2, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = C.beard;
  ctx.beginPath();
  ctx.arc(headX + 0.3, headY + 2.5, 3.7, -0.15, Math.PI + 0.15);
  ctx.fill();

  ctx.fillStyle = "#2d2116";
  ctx.beginPath(); ctx.arc(headX + 1.8, headY - 0.6, 0.75, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(80,44,28,0.55)";
  ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.arc(headX + 3.2, headY + 1.3, 0.8, 0.1, Math.PI * 0.8); ctx.stroke();
  ctx.strokeStyle = "rgba(90,50,30,0.55)";
  ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(headX + 0.7, headY + 0.2); ctx.lineTo(headX + 1.5, headY + 1.7); ctx.stroke();

  // Crown band and points.
  const crownY = headY - 6.1;
  ctx.fillStyle = C.goldDk;
  ctx.beginPath(); ctx.ellipse(headX, crownY + 0.5, 6.8, 2.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.gold;
  ctx.fillRect(headX - 6.2, crownY - 0.6, 12.4, 2.6);
  for (let i = -2; i <= 2; i++) {
    const peak = i === 0 ? 8.5 : 6.2;
    const x = headX + i * 3.1;
    ctx.beginPath();
    ctx.moveTo(x - 1.25, crownY - 0.4);
    ctx.lineTo(x, crownY - peak);
    ctx.lineTo(x + 1.25, crownY - 0.4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = C.jewel;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath(); ctx.arc(headX + i * 3.3, crownY + 0.55, 0.75 + (i === 0 ? 0.25 : 0), 0, Math.PI * 2); ctx.fill();
  }

  if (hurt > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = Math.min(0.6, hurt * 1.4);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(headX, headY, 5.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

export function drawPlayer(p, dir = p.dir, moving = p.moving, gallop = p.gallop || 0) {
  if (isClimbingEntity(p)) {
    drawClimbPose(p, {
      skin: C.skin,
      tunic: C.tabard,
      tunicLt: C.capeLt,
      pants: C.pants,
      boots: C.boots,
      belt: C.leather,
      steel: C.armor,
      steelDk: C.armorDk,
      buckle: C.gold,
      hair: C.hair,
      cloak: C.cape,
      cloakDk: C.capeDk,
      accent: C.capeLt,
      gold: C.gold,
    }, { armor: true, cape: true, crown: true, scale: 1.06 });
    return;
  }

  const t = performance.now() / 1000;
  const vx = Math.abs(p.vx || 0);
  const run = moving && vx > 300;
  const airborne = (p.jumpH || 0) > 2;
  const hurt = p.hurt || 0;
  const attack = Math.max(0, Math.min(1, (p.swing || 0) / 0.32));

  ctx.save();
  if (hurt > 0) {
    ctx.translate(0, groundY);
    ctx.rotate(Math.sin(t * 50) * hurt * 0.015);
    ctx.translate(0, -groundY);
  }

  const breathe = Math.sin(t * 1.7);
  const stride = Math.sin(gallop * 2);
  const bob = airborne ? 0 : moving ? Math.abs(stride) * (run ? 1.8 : 1.2) : breathe * 0.45 + 0.45;
  const lean = airborne ? 1.8 : run ? 3 : attack ? 1.5 : 0;
  const hipY = groundY - 17 - bob * 0.35;
  const shX = lean;
  const shY = groundY - 31 - bob;
  const headX = shX + (run ? 1.5 : 0) + attack * 0.6;
  const headY = groundY - 39 - bob;

  drawCape(shX, shY, hipY, moving, run, airborne, gallop);

  // Legs with animated run, jump tuck, knee plates and boot cuffs.
  const strideAmt = airborne ? 0 : moving ? (run ? 8 : 5.4) : 0;
  let backFoot = -3 + stride * strideAmt;
  let frontFoot = 3 - stride * strideAmt;
  let backKneeY = groundY - 4;
  let frontKneeY = groundY - 4;
  if (airborne) {
    backFoot = -6;
    frontFoot = 6;
    backKneeY = groundY - 12 - Math.max(0, p.jumpVy || 0) * 0.006;
    frontKneeY = groundY - 7;
  }
  if (attack > 0 && !moving) {
    backFoot = -6;
    frontFoot = 5.5 + attack * 2;
  }

  limb(-3, hipY, backFoot, backKneeY, C.pants, 3.7);
  limb(backFoot, backKneeY - 0.5, backFoot + 0.5, groundY - 2, C.boots, 3.9);
  drawBoot(backFoot + 0.6, groundY, C.boots, 1.06);
  limb(3, hipY, frontFoot, frontKneeY, C.pants, 3.7);
  limb(frontFoot, frontKneeY - 0.5, frontFoot + 0.5, groundY - 2, C.boots, 3.9);
  drawBoot(frontFoot + 0.6, groundY, C.boots, 1.06);

  ctx.fillStyle = C.armorDk;
  ctx.beginPath(); ctx.ellipse(backFoot, backKneeY - 2.5, 2.2, 1.6, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(frontFoot, frontKneeY - 2.5, 2.2, 1.6, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.goldDk;
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(backFoot - 3, groundY - 6); ctx.lineTo(backFoot + 3, groundY - 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(frontFoot - 3, groundY - 6); ctx.lineTo(frontFoot + 3, groundY - 6); ctx.stroke();

  // Scabbard and cloak clasp behind the torso.
  ctx.save();
  ctx.translate(shX - 6, shY + 6);
  ctx.rotate(0.55);
  ctx.strokeStyle = C.leather;
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, 18); ctx.stroke();
  ctx.strokeStyle = C.goldDk;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-2.5, 1); ctx.lineTo(2.5, 1); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.restore();

  // Torso: layered cuirass, red tabard, gold trims.
  plate(shX, shY, 14, 20, C.armor);
  ctx.fillStyle = C.armorLt;
  ctx.beginPath();
  ctx.moveTo(shX - 4.8, shY + 2);
  ctx.quadraticCurveTo(shX - 2.6, shY + 6, shX - 2.2, hipY + 2);
  ctx.lineTo(shX - 4.8, hipY + 1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.armorDk;
  ctx.lineWidth = 0.9;
  for (let k = -1; k <= 1; k++) {
    ctx.beginPath();
    ctx.moveTo(shX + k * 4, shY + 2);
    ctx.lineTo(shX + k * 2.7, hipY + 2);
    ctx.stroke();
  }
  ctx.fillStyle = C.tabard;
  ctx.beginPath();
  ctx.moveTo(shX - 3.2, shY + 5);
  ctx.lineTo(shX + 3.2, shY + 5);
  ctx.lineTo(2.4, hipY + 9);
  ctx.lineTo(0, hipY + 6.5);
  ctx.lineTo(-2.4, hipY + 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.tabardDk;
  ctx.beginPath();
  ctx.moveTo(shX + 1.4, shY + 6);
  ctx.lineTo(shX + 3.2, shY + 6);
  ctx.lineTo(1.4, hipY + 7);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = C.leather;
  ctx.fillRect(-6, hipY - 2, 12, 3);
  ctx.fillStyle = C.gold;
  ctx.fillRect(-2.2, hipY - 2.3, 4.4, 3.6);
  ctx.strokeStyle = C.goldDk;
  ctx.lineWidth = 0.8;
  ctx.strokeRect(-2.2, hipY - 2.3, 4.4, 3.6);

  // Pauldrons and arms with bracers. The weapon overlay adds the weapon hand,
  // but these base arms give idle/run/jump poses weight.
  const armSwing = airborne ? -3 : moving ? Math.sin(gallop * 2) * (run ? 4 : 2.6) : breathe * 0.7;
  ctx.fillStyle = C.armor;
  ctx.beginPath(); ctx.ellipse(shX - 7, shY + 2, 3.2, 4.1, -0.35, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(shX + 7, shY + 2, 3.2, 4.1, 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.gold;
  ctx.beginPath(); ctx.ellipse(shX - 7, shY + 0.8, 2.1, 1.2, -0.35, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(shX + 7, shY + 0.8, 2.1, 1.2, 0.35, 0, Math.PI * 2); ctx.fill();

  const leftHand = { x: shX - 8 - armSwing, y: shY + 13 + (airborne ? -3 : 0) };
  const rightHand = { x: shX + 8 + armSwing + attack * 1.5, y: shY + 13 - attack * 3 };
  limb(shX - 5.5, shY + 3, leftHand.x, leftHand.y, C.skin, 3);
  limb(shX + 5.5, shY + 3, rightHand.x, rightHand.y, C.skin, 3);
  ctx.fillStyle = C.armor;
  ctx.beginPath(); ctx.ellipse(leftHand.x + 0.4, leftHand.y - 2.2, 2.1, 3.2, -0.35, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(rightHand.x - 0.4, rightHand.y - 2.2, 2.1, 3.2, 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.goldDk;
  ctx.fillRect(leftHand.x - 2, leftHand.y - 4.1, 4, 1);
  ctx.fillRect(rightHand.x - 2, rightHand.y - 4.1, 4, 1);

  ctx.fillStyle = C.gold;
  ctx.beginPath(); ctx.arc(shX - 3.4, shY - 1.4, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(shX + 3.4, shY - 1.4, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.goldDk;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(shX - 3.4, shY - 1.2); ctx.quadraticCurveTo(shX, shY + 2.4, shX + 3.4, shY - 1.2); ctx.stroke();

  drawHead(headX, headY, hurt);
  ctx.restore();
}
