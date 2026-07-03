import { ctx, groundY } from '../../core/canvas.js';

// The player: a regal warrior-king with armor and crown, drawn in the villager style
// Uses the same local-space convention as Archer/Builder/Villager

const SKIN = "#d3ac82", BOOTS = "#3a2c1e";
const ARMOR_PRIMARY = "#4a5a6a";
const ARMOR_ACCENT = "#2a3a4a";
const ARMOR_GOLD = "#d4a838";
const CAPE_COLOR = "#c41e3a";
const CAPE_LT = "#e85a5a";

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

export function drawPlayer(p, dir = p.dir, moving = p.moving, gallop = p.gallop || 0) {
  const t = performance.now() / 1000;

  ctx.save();

  const breathe = Math.sin(t * 1.7);
  const bob = moving ? Math.abs(Math.sin(gallop * 2)) * 1.3 : breathe * 0.5 + 0.5;
  const hipY = groundY - 17 - bob * 0.4;
  const shY = groundY - 30 - bob;
  const headY = groundY - 37 - bob;

  // --- legs with boots ---
  const s = Math.sin(gallop * 2);
  const stride = moving ? 5 : 0;
  limb(-3, hipY, -3 + s * stride, groundY - 3, "#3a2a1a", 3.5);
  limb(-3 + s * stride, groundY - 3.5, -1.4 + s * stride, groundY, BOOTS, 3.5);
  limb(3, hipY, 3 - s * stride, groundY - 3, "#3a2a1a", 3.5);
  limb(3 - s * stride, groundY - 3.5, 4.6 - s * stride, groundY, BOOTS, 3.5);

  // --- armor: chest plate ---
  ctx.fillStyle = ARMOR_PRIMARY;
  ctx.beginPath();
  ctx.moveTo(-6.5, shY);
  ctx.lineTo(6.5, shY);
  ctx.lineTo(6, hipY + 4);
  ctx.lineTo(-6, hipY + 4);
  ctx.closePath();
  ctx.fill();

  // armor shine/highlight
  ctx.fillStyle = ARMOR_ACCENT;
  ctx.beginPath();
  ctx.moveTo(-5.5, shY + 1);
  ctx.quadraticCurveTo(-4, shY + 4, -3, hipY + 2);
  ctx.lineTo(-5, hipY + 3);
  ctx.closePath();
  ctx.fill();

  // armor edges/grooves
  ctx.strokeStyle = ARMOR_ACCENT;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-5, shY + 2);
  ctx.lineTo(-5, hipY + 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, shY + 1);
  ctx.lineTo(0, hipY + 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(5, shY + 2);
  ctx.lineTo(5, hipY + 2);
  ctx.stroke();

  // golden belt buckle
  ctx.fillStyle = ARMOR_GOLD;
  ctx.beginPath();
  ctx.rect(-2.5, hipY - 1, 5, 2.5);
  ctx.fill();
  ctx.strokeStyle = "#8a6a2a";
  ctx.lineWidth = 0.6;
  ctx.stroke();

  // --- armor shoulders ---
  ctx.fillStyle = ARMOR_PRIMARY;
  ctx.beginPath();
  ctx.ellipse(-7, shY + 2, 2, 4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(7, shY + 2, 2, 4, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // shoulder trim
  ctx.fillStyle = ARMOR_GOLD;
  ctx.beginPath();
  ctx.ellipse(-7, shY + 1.5, 1.2, 1.5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(7, shY + 1.5, 1.2, 1.5, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // --- arms: armored with hands showing ---
  const swing = moving ? Math.sin(gallop * 2) * 3 : breathe * 0.6;
  limb(-5.5, shY + 2, -7 - swing, shY + 12, SKIN, 2.8);
  limb(5.5, shY + 2, 7 + swing, shY + 12, SKIN, 2.8);

  // arm guards (armor on forearms)
  ctx.fillStyle = ARMOR_PRIMARY;
  ctx.beginPath();
  ctx.ellipse(-7 - swing * 0.5, shY + 10, 1.8, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(7 + swing * 0.5, shY + 10, 1.8, 3, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // --- cape flowing behind ---
  const capeWave = Math.sin(t * 1.2) * 2;
  ctx.fillStyle = CAPE_COLOR;
  ctx.beginPath();
  ctx.moveTo(-4, shY - 3);
  ctx.quadraticCurveTo(-12 - capeWave, shY + 4, -14 - capeWave * 1.5, hipY + 5);
  ctx.lineTo(-8, hipY + 2);
  ctx.quadraticCurveTo(-6 - capeWave * 0.5, shY + 2, -2, shY - 2);
  ctx.closePath();
  ctx.fill();

  // cape highlight
  ctx.fillStyle = CAPE_LT;
  ctx.beginPath();
  ctx.moveTo(-4, shY - 2);
  ctx.quadraticCurveTo(-8 - capeWave, shY + 2, -10 - capeWave, shY + 6);
  ctx.lineTo(-6, shY + 3);
  ctx.closePath();
  ctx.fill();

  // --- head: noble visage ---
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.arc(0, headY, 5, 0, Math.PI * 2);
  ctx.fill();

  // hair
  ctx.fillStyle = "#3a2818";
  ctx.beginPath();
  ctx.arc(-0.4, headY - 1.8, 4.8, Math.PI * 0.92, Math.PI * 2.08);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-3.6, headY - 0.2, 1.6, 2.6, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // eyes
  ctx.fillStyle = "#3a2a1c";
  ctx.beginPath();
  ctx.arc(1.8, headY - 0.5, 0.8, 0, Math.PI * 2);
  ctx.fill();

  // --- crown: regal golden crown ---
  ctx.fillStyle = ARMOR_GOLD;
  // crown band
  ctx.beginPath();
  ctx.ellipse(0, headY - 5.5, 6.2, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // crown points/peaks
  const crownPoints = 5;
  for (let i = 0; i < crownPoints; i++) {
    const angle = (i / crownPoints) * Math.PI;
    const x = Math.sin(angle) * 6.5;
    const peakHeight = i === Math.floor(crownPoints / 2) ? 9 : 6;
    ctx.beginPath();
    ctx.moveTo(x - 1.2, headY - 5.5);
    ctx.lineTo(x, headY - 5.5 - peakHeight);
    ctx.lineTo(x + 1.2, headY - 5.5);
    ctx.closePath();
    ctx.fill();
  }

  // crown jewels
  ctx.fillStyle = "#ff6a9a";
  for (let i = 0; i < 3; i++) {
    const jx = (i - 1) * 3;
    ctx.beginPath();
    ctx.arc(jx, headY - 5.8, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // crown shine
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.beginPath();
  ctx.ellipse(-1.5, headY - 7, 1.5, 1, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
