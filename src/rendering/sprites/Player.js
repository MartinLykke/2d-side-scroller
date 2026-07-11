import { ctx, groundY } from '../../core/canvas.js';
import { drawBoot } from '../DrawHelpers.js';
import { drawClimbPose, isClimbingEntity } from './FriendlyClimb.js';
import { armorCapeColors, drawTorsoArmor, drawHeadArmor } from '../ItemRender.js';

const C = {
  skin: "#d3ac82",
  hair: "#3c2c1c",
  beard: "#5a3d24",
  boots: "#3a2c1e",
  leather: "#5a3a24",
  pants: "#443c30",
  armor: "#596878",
  armorDk: "#2a3440",
  armorLt: "#8794a2",
  gold: "#d4a838",
  goldDk: "#8a6a2a",
  tunic: "#65594e",
  tunicLt: "#776a5e",
  patch: "#4b4035",
  rope: "#a08a58",
  playerRed: "#8f2031",
  playerRedDk: "#5c1420",
  playerRedLt: "#d45555",
  tabard: "#65594e",
  tabardDk: "#4b4035",
  cape: "#8f2031",
  capeDk: "#5c1420",
  capeLt: "#d45555",
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

function drawCape(shX, shY, hipY, moving, run, airborne, gallop, capeCols = null) {
  const t = performance.now() / 1000;
  const strideWave = Math.sin(gallop * 1.4);
  const flow = airborne ? -12 : run ? -10 - strideWave * 2 : moving ? -6 + strideWave * 1.5 : Math.sin(t * 1.3) * 1.5;
  const lift = airborne ? -4 : 0;
  const capeDk = capeCols?.capeDk || C.capeDk;
  const cape   = capeCols?.cape   || C.cape;
  const capeLt = capeCols?.capeLt || C.capeLt;
  const longCloak = !!capeCols;

  ctx.fillStyle = capeDk;
  ctx.beginPath();
  ctx.moveTo(shX - 5.5, shY - 1.5);
  ctx.lineTo(shX + 3.5, shY - 1);
  if (longCloak) {
    ctx.bezierCurveTo(shX + flow * 0.1, shY + 8, shX + flow * 0.65, hipY + 3, shX + flow, groundY - 1 + lift);
    ctx.lineTo(shX + flow * 0.55, groundY - 4 + lift);
    ctx.lineTo(shX + flow * 0.25 - 7, groundY - 1 + lift);
    ctx.bezierCurveTo(shX - 10 + flow * 0.25, hipY + 1, shX - 10, shY + 6, shX - 5.5, shY - 1.5);
  } else {
    ctx.bezierCurveTo(shX + flow * 0.18, shY + 5, shX + flow * 0.45, hipY + 1, shX + flow * 0.62, hipY + 8 + lift);
    ctx.lineTo(shX + flow * 0.28 - 3, hipY + 5 + lift);
    ctx.bezierCurveTo(shX - 7, hipY + 2, shX - 8, shY + 5, shX - 5.5, shY - 1.5);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = cape;
  ctx.beginPath();
  ctx.moveTo(shX - 3.2, shY - 0.8);
  if (longCloak) {
    ctx.bezierCurveTo(shX + flow * 0.08, shY + 7, shX + flow * 0.42, hipY + 5, shX + flow * 0.66, groundY - 6 + lift);
    ctx.lineTo(shX + flow * 0.35 - 3, groundY - 5 + lift);
    ctx.bezierCurveTo(shX - 7 + flow * 0.12, hipY + 2, shX - 7, shY + 7, shX - 3.2, shY - 0.8);
  } else {
    ctx.bezierCurveTo(shX + flow * 0.08, shY + 5, shX + flow * 0.26, hipY + 2, shX + flow * 0.42, hipY + 5 + lift);
    ctx.lineTo(shX + flow * 0.18 - 1.5, hipY + 4 + lift);
    ctx.bezierCurveTo(shX - 5.5, hipY + 1, shX - 5.5, shY + 5, shX - 3.2, shY - 0.8);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = capeLt;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(shX - 2, shY + 0.5);
  ctx.quadraticCurveTo(shX - 4 + flow * 0.12, shY + 6, shX - 4 + flow * 0.18, longCloak ? hipY + 8 : hipY + 4);
  ctx.lineTo(shX - 1 + flow * 0.14, longCloak ? hipY + 4 : hipY + 2);
  ctx.quadraticCurveTo(shX + 1 + flow * 0.06, shY + 4, shX, shY + 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawHead(headX, headY, hurt, armorId = null) {
  ctx.fillStyle = C.skin;
  ctx.beginPath(); ctx.arc(headX, headY, 4.8, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = C.hair;
  ctx.beginPath(); ctx.arc(headX - 0.4, headY - 1.6, 4.7, Math.PI * 0.95, Math.PI * 2.04); ctx.fill();
  ctx.beginPath(); ctx.ellipse(headX - 3.5, headY - 0.4, 1.5, 2.5, 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(255,240,200,0.12)";
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(headX - 1.2, headY - 2.4, 3.1, Math.PI * 1.08, Math.PI * 1.68); ctx.stroke();

  ctx.fillStyle = "#2d2116";
  ctx.beginPath(); ctx.arc(headX + 1.8, headY - 0.6, 0.75, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(90,50,30,0.55)";
  ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(headX + 0.7, headY + 0.2); ctx.lineTo(headX + 1.5, headY + 1.7); ctx.stroke();

  if (armorId) drawHeadArmor(armorId, headX, headY);

  // Tiny ember-crown mark: enough to find the player, not enough to break the vagrant silhouette.
  const crownY = headY - 6;
  ctx.fillStyle = C.gold;
  ctx.fillRect(headX - 3.4, crownY, 6.8, 1.5);
  ctx.beginPath(); ctx.moveTo(headX - 2.4, crownY); ctx.lineTo(headX - 1.2, crownY - 3); ctx.lineTo(headX, crownY); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(headX, crownY); ctx.lineTo(headX + 1.2, crownY - 4); ctx.lineTo(headX + 2.4, crownY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.jewel;
  ctx.beginPath(); ctx.arc(headX + 0.7, crownY + 0.6, 0.55, 0, Math.PI * 2); ctx.fill();

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
  const capeCols = armorCapeColors(p.armor);
  if (isClimbingEntity(p)) {
    drawClimbPose(p, {
      skin: C.skin,
      tunic: C.tabard,
      tunicLt: capeCols?.capeLt || C.capeLt,
      pants: C.pants,
      boots: C.boots,
      belt: C.leather,
      steel: C.armor,
      steelDk: C.armorDk,
      buckle: C.gold,
      hair: C.hair,
      cloak: capeCols?.cape || C.cape,
      cloakDk: capeCols?.capeDk || C.capeDk,
      accent: capeCols?.capeLt || C.capeLt,
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

  drawCape(shX, shY, hipY, moving, run, airborne, gallop, capeCols);

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

  // Equipped armor is drawn over the cuirass/tabard (arms render on top).
  if (p.armor) drawTorsoArmor(p.armor, shX, shY, hipY);

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

  drawHead(headX, headY, hurt, p.armor);
  ctx.restore();
}
