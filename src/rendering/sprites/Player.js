import { ctx, groundY } from '../../core/canvas.js';
import { drawBoot } from '../DrawHelpers.js';
import { drawClimbPose, isClimbingEntity } from './FriendlyClimb.js';
import { drawTorsoArmor } from '../ItemRender.js';
import { armorOutfit, drawHelmet, drawArmorAura, drawArmorShoulders } from '../ArmorOutfits.js';
import { biomeHumanoidSkin } from '../BiomeHumanoidSkins.js';

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

function plate(x, y, w, h, color, trimCol = C.armorDk) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.45, y);
  ctx.lineTo(x + w * 0.45, y);
  ctx.lineTo(x + w * 0.34, y + h);
  ctx.lineTo(x - w * 0.34, y + h);
  ctx.closePath();
  ctx.fill();
  if (trimCol) {
    ctx.strokeStyle = trimCol;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

function drawCape(shX, shY, hipY, moveB, runB, airB, gallop, O, longCloak) {
  const t = performance.now() / 1000;
  const strideWave = Math.sin(gallop * 1.4);
  const idleFlow = Math.sin(t * 1.3) * 1.5;
  const walkFlow = -6 + strideWave * 1.5;
  const runFlow = -10 - strideWave * 2;
  let flow = idleFlow + (walkFlow + (runFlow - walkFlow) * runB - idleFlow) * moveB;
  flow += (-12 - flow) * airB;
  const lift = -4 * airB;
  const capeDk = O.capeDk;
  const cape   = O.cape;
  const capeLt = O.capeLt;

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

function drawHead(headX, headY, hurt, armorId = null, P = C) {
  const x = headX, y = headY;

  // Skull with a small nose bump on the leading edge for a real profile.
  ctx.fillStyle = P.skin;
  ctx.beginPath(); ctx.arc(x, y, 4.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 4.3, y - 0.6);
  ctx.quadraticCurveTo(x + 5.7, y + 0.7, x + 4.1, y + 1.5);
  ctx.closePath(); ctx.fill();
  // jaw shading
  ctx.fillStyle = "rgba(90,55,30,0.14)";
  ctx.beginPath(); ctx.arc(x + 0.5, y + 1.6, 3.3, Math.PI * 0.12, Math.PI * 0.85); ctx.fill();

  // Swept-back hair: clean hairline at the brow, mass over crown and nape.
  ctx.fillStyle = P.hair;
  ctx.beginPath();
  ctx.moveTo(x + 3.2, y - 3.5);
  ctx.quadraticCurveTo(x + 1.4, y - 5.8, x - 1, y - 5.4);
  ctx.quadraticCurveTo(x - 5.2, y - 4.6, x - 5.0, y - 0.5);
  ctx.quadraticCurveTo(x - 5.4, y + 2.2, x - 4.2, y + 3.2);
  ctx.quadraticCurveTo(x - 3.8, y + 1.5, x - 2.8, y - 0.5);
  ctx.quadraticCurveTo(x - 2.4, y - 2.6, x + 0.5, y - 3.0);
  ctx.quadraticCurveTo(x + 2, y - 3.0, x + 3.2, y - 3.5);
  ctx.closePath(); ctx.fill();
  // hair sheen
  ctx.strokeStyle = "rgba(255,240,200,0.16)";
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.arc(x - 0.9, y - 2.3, 3.3, Math.PI * 1.05, Math.PI * 1.62); ctx.stroke();

  // Ear
  ctx.fillStyle = P.skin;
  ctx.beginPath(); ctx.ellipse(x - 1.7, y + 0.7, 1.0, 1.35, 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(90,55,30,0.4)";
  ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.arc(x - 1.8, y + 0.7, 0.55, Math.PI * 1.3, Math.PI * 0.5); ctx.stroke();

  // Short stubble along the jaw
  ctx.strokeStyle = "rgba(90,61,36,0.5)";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(x + 0.9, y + 1.1, 3.3, Math.PI * 0.16, Math.PI * 0.72); ctx.stroke();
  ctx.lineCap = "butt";

  // Eye with a brow line, small mouth, nose shading
  ctx.strokeStyle = P.hair;
  ctx.lineWidth = 0.85;
  ctx.beginPath(); ctx.moveTo(x + 1.1, y - 1.9); ctx.lineTo(x + 3.3, y - 1.6); ctx.stroke();
  ctx.fillStyle = "#2d2116";
  ctx.beginPath(); ctx.ellipse(x + 2.2, y - 0.5, 0.62, 0.88, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(120,75,45,0.55)";
  ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(x + 4.6, y + 1.5); ctx.lineTo(x + 3.7, y + 1.7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 2.6, y + 2.5); ctx.lineTo(x + 3.9, y + 2.3); ctx.stroke();

  // Equipped helmets paint over hair/face; each returns how far the crown lifts.
  const crownLift = armorId ? drawHelmet(armorId, headX, headY) : 0;

  // Tiny ember-crown mark: enough to find the player, not enough to break the vagrant silhouette.
  const crownY = headY - 6 - crownLift;
  ctx.fillStyle = P.gold;
  ctx.fillRect(headX - 3.4, crownY, 6.8, 1.5);
  ctx.beginPath(); ctx.moveTo(headX - 2.4, crownY); ctx.lineTo(headX - 1.2, crownY - 3); ctx.lineTo(headX, crownY); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(headX, crownY); ctx.lineTo(headX + 1.2, crownY - 4); ctx.lineTo(headX + 2.4, crownY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.jewel;
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

function drawBiomeBackSilhouette(P, shX, shY, hipY, headX, headY, moveB, runB, airB, gallop) {
  const t = performance.now() / 1000;
  const stride = Math.sin(gallop * 1.4);
  const flow = -2.5 - moveB * (4 + runB * 6) - airB * 4 + stride * moveB * 1.4 + Math.sin(t * 1.7) * 0.8;
  ctx.save();
  ctx.lineCap = "round";

  if (P.detail === "frozen") {
    // Translucent crystal mantle: long shards make a sovereign silhouette.
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = P.accent;
    for (const [ox, len, w] of [[-7,31,5],[-2,38,6],[4,28,4]]) {
      ctx.beginPath();
      ctx.moveTo(shX + ox - w, shY + 3);
      ctx.lineTo(shX + ox + w, shY + 4);
      ctx.lineTo(shX + flow * 0.35 + ox, shY + len);
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = P.trim; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(shX - 9, shY + 2); ctx.lineTo(shX + flow * 0.35 - 7, shY + 34); ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = P.glow;
    for (let i = 0; i < 3; i++) {
      const a = t * (0.7 + i * 0.12) + i * 2.1;
      ctx.globalAlpha = 0.35 + i * 0.08;
      ctx.beginPath(); ctx.arc(shX + Math.cos(a) * (10 + i * 2), shY + 10 + Math.sin(a) * 12, 0.9 + i * 0.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  } else if (P.detail === "desert") {
    // Sun halo and two long royal scarves that stream independently.
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.3;
    ctx.strokeStyle = P.gold; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(headX - 1, headY - 1, 10, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      ctx.beginPath(); ctx.moveTo(headX - 1 + Math.cos(a) * 12, headY - 1 + Math.sin(a) * 12); ctx.lineTo(headX - 1 + Math.cos(a) * 15, headY - 1 + Math.sin(a) * 15); ctx.stroke();
    }
    ctx.restore();
    for (let i = 0; i < 2; i++) {
      ctx.strokeStyle = i ? P.accent : P.trim;
      ctx.lineWidth = i ? 3.2 : 2.5;
      ctx.beginPath();
      ctx.moveTo(headX - 4 - i * 2, headY + 2 + i * 2);
      ctx.bezierCurveTo(shX - 10, shY + 10 + i * 4, shX + flow - 9 - i * 5, hipY + i * 5, shX + flow - 15 - i * 4, groundY - 8 + i * 4);
      ctx.stroke();
    }
  } else if (P.detail === "swamp") {
    // Bark antlers and dripping moss turn the player into a bog monarch.
    ctx.strokeStyle = P.goldDk;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(headX - 3, headY - 4); ctx.lineTo(headX - 8, headY - 13); ctx.lineTo(headX - 7, headY - 20);
    ctx.moveTo(headX - 8, headY - 13); ctx.lineTo(headX - 14, headY - 16);
    ctx.moveTo(headX + 1, headY - 5); ctx.lineTo(headX + 5, headY - 14); ctx.lineTo(headX + 4, headY - 19);
    ctx.moveTo(headX + 5, headY - 14); ctx.lineTo(headX + 10, headY - 17);
    ctx.stroke();
    ctx.strokeStyle = P.trim; ctx.lineWidth = 2;
    for (const [ox, len] of [[-8,25],[-3,33],[3,23]]) {
      ctx.beginPath(); ctx.moveTo(shX + ox, shY + 3); ctx.bezierCurveTo(shX + ox + flow * 0.3, shY + 13, shX + flow + ox, hipY + 8, shX + flow + ox - 2, shY + len); ctx.stroke();
    }
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = P.accent;
    for (let i = 0; i < 3; i++) {
      const a = t * (0.9 + i * 0.1) + i * 2.3;
      ctx.globalAlpha = 0.28 + Math.sin(t * 3 + i) * 0.08;
      ctx.beginPath(); ctx.arc(shX - 3 + Math.cos(a) * (13 + i * 2), shY + 11 + Math.sin(a) * 8, 1.25, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  } else if (P.detail === "volcano") {
    // Obsidian fins frame a molten mantle; drifting embers sell the heat.
    ctx.fillStyle = P.capeDk;
    for (const [ox, top, w] of [[-8,-15,5],[-2,-22,6],[5,-12,4]]) {
      ctx.beginPath(); ctx.moveTo(shX + ox - w, shY + 5); ctx.lineTo(shX + ox, shY + top); ctx.lineTo(shX + ox + w, shY + 5); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = P.cape;
    ctx.beginPath();
    ctx.moveTo(shX - 6, shY + 2); ctx.lineTo(shX + 4, shY + 3);
    ctx.bezierCurveTo(shX + flow - 2, shY + 13, shX + flow - 9, hipY + 8, shX + flow - 5, groundY - 2);
    ctx.lineTo(shX + flow + 2, hipY + 7); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = P.glow;
    for (let i = 0; i < 4; i++) {
      const rise = (t * (12 + i * 2) + i * 9) % 30;
      const ex = shX + flow * 0.5 - 8 + i * 5 + Math.sin(t * 3 + i) * 2;
      ctx.globalAlpha = 0.75 * (1 - rise / 30);
      ctx.beginPath(); ctx.arc(ex, hipY + 10 - rise, 1.2 + (i % 2) * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  } else if (P.detail === "corrupted") {
    // Broken void halo, floating shards and tentacle-cloak silhouette.
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = P.rune; ctx.lineWidth = 2; ctx.globalAlpha = 0.42;
    ctx.beginPath(); ctx.arc(headX - 2, headY - 2, 13, -0.2, 1.7); ctx.stroke();
    ctx.beginPath(); ctx.arc(headX - 2, headY - 2, 13, 2.05, 4.9); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = P.capeLt; ctx.lineWidth = 2.8;
    for (let i = 0; i < 3; i++) {
      const wave = Math.sin(t * 2.2 + i * 1.8) * 3;
      ctx.beginPath();
      ctx.moveTo(shX - 5 + i * 3, shY + 4);
      ctx.bezierCurveTo(shX + flow - 5 - i * 3, shY + 11 + wave, shX + flow - 12 + i * 2, hipY + 7, shX + flow - 8 - i * 5, groundY - 4 - i * 3);
      ctx.stroke();
    }
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = P.glow;
    for (let i = 0; i < 4; i++) {
      const a = t * (0.8 + i * 0.06) + i * Math.PI / 2;
      const rx = headX - 2 + Math.cos(a) * (15 + (i % 2) * 4);
      const ry = headY + 2 + Math.sin(a) * 11;
      ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.moveTo(rx, ry - 3); ctx.lineTo(rx + 2, ry); ctx.lineTo(rx, ry + 3); ctx.lineTo(rx - 2, ry); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawBiomeRegalia(P, shX, shY, hipY, headX, headY, armorId) {
  const detail = P.detail;
  const t = performance.now() / 1000;
  ctx.save();
  ctx.lineCap = "round";

  if (detail === "forest") {
    // Keep the original understated forest model: one living-leaf badge.
    ctx.fillStyle = P.trim;
    ctx.beginPath(); ctx.ellipse(shX + 2.6, shY + 7, 1.8, 3.5, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = P.goldDk;
    ctx.lineWidth = 0.65;
    ctx.beginPath(); ctx.moveTo(shX + 1.4, shY + 9.3); ctx.lineTo(shX + 4, shY + 4.7); ctx.stroke();
  } else if (detail === "frozen") {
    // Ice-blade shoulders, fur gorget, and a tall crystal diadem.
    ctx.strokeStyle = P.trim; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(shX - 6, shY + 0.2); ctx.quadraticCurveTo(shX, shY + 5.6, shX + 6, shY + 0.2); ctx.stroke();
    ctx.fillStyle = P.accent;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(shX + side * 5, shY + 2); ctx.lineTo(shX + side * 11, shY - 6); ctx.lineTo(shX + side * 9, shY + 4); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = P.trim;
    for (const [ox, h] of [[-4,5],[0,9],[4,6]]) {
      ctx.beginPath(); ctx.moveTo(headX + ox - 1.5, headY - 6); ctx.lineTo(headX + ox, headY - 6 - h); ctx.lineTo(headX + ox + 1.5, headY - 6); ctx.closePath(); ctx.fill();
    }
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = P.glow; ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.arc(shX, shY + 8, 2.2 + Math.sin(t * 4) * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  } else if (detail === "desert") {
    // Winged gold shoulders, lapis sash, sun disc, and royal face-wrap.
    ctx.fillStyle = P.gold;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(shX + side * 4.5, shY + 1); ctx.lineTo(shX + side * 12, shY - 2); ctx.lineTo(shX + side * 9, shY + 4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = P.goldDk; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(shX + side * 6, shY + 1); ctx.lineTo(shX + side * 10.5, shY); ctx.stroke();
    }
    ctx.strokeStyle = P.accent; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(shX - 4.8, shY + 3.5); ctx.lineTo(shX + 3.8, hipY + 4); ctx.stroke();
    ctx.fillStyle = P.gold;
    ctx.beginPath(); ctx.arc(shX + 4.4, shY + 3.2, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.accent;
    ctx.beginPath(); ctx.arc(shX + 4.4, shY + 3.2, 0.9, 0, Math.PI * 2); ctx.fill();
    if (!armorId) {
      ctx.fillStyle = P.trim;
      ctx.beginPath(); ctx.moveTo(headX - 5.2, headY - 3.8); ctx.quadraticCurveTo(headX, headY - 7.8, headX + 5.3, headY - 3.8); ctx.lineTo(headX + 4.3, headY - 1.6); ctx.lineTo(headX - 4.8, headY - 1.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = P.accent; ctx.fillRect(headX - 4.8, headY + 1.2, 9.4, 1.6);
    }
  } else if (detail === "swamp") {
    // Bark pauldrons, luminous heart-seed, and hanging moss crown.
    ctx.fillStyle = P.goldDk;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(shX + side * 4, shY + 1); ctx.lineTo(shX + side * 11, shY - 4); ctx.lineTo(shX + side * 9, shY + 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = P.trim;
      ctx.beginPath(); ctx.ellipse(shX + side * 9, shY - 1, 1.8, 3.8, side * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P.goldDk;
    }
    ctx.strokeStyle = P.trim; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(shX - 4.5, shY + 3); ctx.bezierCurveTo(shX + 5, shY + 5, shX - 4, hipY, shX + 4.5, hipY + 5); ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = P.accent; ctx.globalAlpha = 0.75;
    ctx.beginPath(); ctx.arc(shX, shY + 8, 2.1 + Math.sin(t * 3) * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  } else if (detail === "volcano") {
    // Obsidian shoulder horns, molten fissures and a horned ember crown.
    ctx.fillStyle = P.capeDk;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(shX + side * 4, shY + 2); ctx.lineTo(shX + side * 10, shY - 8); ctx.lineTo(shX + side * 9, shY + 5); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = P.capeDk;
    ctx.beginPath(); ctx.moveTo(headX - 4, headY - 5); ctx.lineTo(headX - 8, headY - 13); ctx.lineTo(headX - 1.5, headY - 7); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(headX + 4, headY - 5); ctx.lineTo(headX + 8, headY - 13); ctx.lineTo(headX + 1.5, headY - 7); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = P.glow; ctx.lineWidth = 1.15;
    ctx.beginPath(); ctx.moveTo(shX - 2, shY + 1); ctx.lineTo(shX + 1.4, shY + 6); ctx.lineTo(shX - 0.5, shY + 9); ctx.lineTo(shX + 3, shY + 14); ctx.stroke();
    ctx.fillStyle = P.accent2; ctx.beginPath(); ctx.arc(shX + 6.7, shY - 1.8, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (detail === "corrupted") {
    // Void-crystal pauldrons, split mask, chest rune and floating crown.
    ctx.fillStyle = P.capeDk;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(shX + side * 4, shY + 3); ctx.lineTo(shX + side * 11, shY - 9); ctx.lineTo(shX + side * 9, shY + 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = P.accent;
      ctx.beginPath(); ctx.moveTo(shX + side * 8, shY); ctx.lineTo(shX + side * 12, shY - 5); ctx.lineTo(shX + side * 10, shY + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = P.capeDk;
    }
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = P.rune; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(shX, shY + 8, 3.4, 0.25, Math.PI * 1.72); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(shX - 2.6, shY + 5.7); ctx.lineTo(shX + 2.7, shY + 10.5); ctx.stroke();
    if (!armorId) {
      ctx.fillStyle = P.glow;
      ctx.beginPath(); ctx.arc(headX + 2.2, headY - 0.5, 1.15, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = P.rune; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(headX - 1, headY - 4); ctx.lineTo(headX + 4.5, headY + 3); ctx.stroke();
    }
    for (const [ox, oy] of [[-5,-10],[0,-14],[5,-10]]) {
      const floatY = Math.sin(t * 2.4 + ox) * 0.8;
      ctx.fillStyle = P.accent2;
      ctx.beginPath(); ctx.moveTo(headX + ox, headY + oy - 2 + floatY); ctx.lineTo(headX + ox + 1.8, headY + oy + floatY); ctx.lineTo(headX + ox, headY + oy + 2 + floatY); ctx.lineTo(headX + ox - 1.8, headY + oy + floatY); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  if (P.hollow) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = P.rune; ctx.globalAlpha = 0.72; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.ellipse(headX, headY - 11, 8.5, 2.6, 0, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = t * 1.3 + i * Math.PI * 2 / 3;
      ctx.fillStyle = P.glow;
      ctx.beginPath(); ctx.arc(headX + Math.cos(a) * 8, headY - 11 + Math.sin(a) * 2.3, 1.1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

// `riding` is the mount def (from MOUNTS) when the player sits a steed, else
// null — it swaps the walking legs for a seated pose reaching the stirrup.
export function drawPlayer(p, dir = p.dir, moving = p.moving, gallop = p.gallop || 0, riding = null) {
  // Equipped armor reskins the entire model: cape, cuirass, tabard, legs,
  // boots, trims and (via `gloves`) the bare arms.
  const P = biomeHumanoidSkin("player", p.x, C);
  const outfit = armorOutfit(p.armor);
  // Armor is a full-body appearance. Fall back to the neutral player palette
  // before applying it so no biome color or model detail bleeds through.
  const B = outfit ? C : P;
  const O = outfit ? { ...C, ...outfit } : P;
  if (isClimbingEntity(p)) {
    drawClimbPose(p, {
      skin: B.skin,
      tunic: O.tabard,
      tunicLt: O.capeLt,
      pants: O.pants,
      boots: O.boots,
      belt: O.leather,
      steel: O.armor,
      steelDk: O.armorDk,
      buckle: O.gold,
      hair: B.hair,
      cloak: O.cape,
      cloakDk: O.capeDk,
      accent: O.capeLt,
      gold: B.gold,
    }, {
      armor: true, cape: true, crown: true, scale: 1.06,
      helm: outfit?.headgear === "helm",
      hood: outfit?.headgear === "hood",
      plume: p.armor === "plate_chestplate",
    });
    return;
  }

  const t = performance.now() / 1000;
  const vx = Math.abs(p.vx || 0);
  const run = moving && vx > 300;
  const airborne = (p.jumpH || 0) > 2;
  const hurt = p.hurt || 0;
  const attack = Math.max(0, Math.min(1, (p.swing || 0) / 0.32));

  // Eased pose blends so walk/run/jump transitions flow instead of snapping.
  const anim = p._anim || (p._anim = { move: 0, run: 0, air: 0, last: t });
  const adt = Math.min(0.1, Math.max(0, t - anim.last));
  anim.last = t;
  anim.move += ((moving ? 1 : 0) - anim.move) * (1 - Math.exp(-12 * adt));
  anim.run += ((run ? 1 : 0) - anim.run) * (1 - Math.exp(-9 * adt));
  anim.air += ((airborne ? 1 : 0) - anim.air) * (1 - Math.exp(-14 * adt));
  const moveB = anim.move, runB = anim.run, airB = anim.air;

  ctx.save();
  if (hurt > 0) {
    ctx.translate(0, groundY);
    ctx.rotate(Math.sin(t * 50) * hurt * 0.015);
    ctx.translate(0, -groundY);
  }

  const breathe = Math.sin(t * 1.7);
  const cycle = gallop * 2;
  const stride = Math.sin(cycle);
  const idleBob = breathe * 0.45 + 0.45;
  const strideBob = (0.5 - 0.5 * Math.cos(cycle * 2)) * (1.2 + 0.7 * runB);
  const bob = (idleBob + (strideBob - idleBob) * moveB) * (1 - airB);
  const lean = airB * 1.8 + (runB * 3 + attack * 1.5 * (1 - moveB)) * (1 - airB);
  const hipY = groundY - 17 - bob * 0.35;
  const shX = lean;
  const shY = groundY - 31 - bob;
  const headX = shX + runB * 1.5 + attack * 0.6;
  const headY = groundY - 39 - bob;

  // Legendary/epic outfits radiate an ambient aura behind the whole body.
  if (outfit?.aura) drawArmorAura(p.armor, shX, shY + 8);

  if (!outfit) drawBiomeBackSilhouette(P, shX, shY, hipY, headX, headY, moveB, runB, airB, gallop);
  const biomeLongCloak = !outfit && (P.detail === "frozen" || P.detail === "volcano" || P.detail === "corrupted");
  drawCape(shX, shY, hipY, moveB, runB, airB, gallop, O, !!outfit?.longCloak || biomeLongCloak);

  if (riding) {
    // Seated pose: hips rest on the saddle (local groundY - 17), the thigh
    // runs forward along it and the shin drops down the near flank to the
    // stirrup, which hangs 9.5*scale above the hooves at groundY + lift.
    const stirrupY = groundY + riding.lift - 9.5 * riding.scale;
    // far leg, shaded darker so it reads as the other side of the horse
    ctx.save();
    ctx.globalAlpha = 0.55;
    limb(-3, hipY + 1, 5, groundY - 6, O.pants, 3.6);
    limb(5, groundY - 6.5, 6.5, stirrupY - 1, O.boots, 3.2);
    ctx.restore();
    // near leg
    limb(-2, hipY + 1, 7.5, groundY - 6, O.pants, 3.9);
    limb(7.5, groundY - 6.5, 9, stirrupY - 1, O.boots, 3.5);
    drawBoot(9.5, stirrupY + 1, O.boots, 1.06);
    // boot cuff
    ctx.strokeStyle = O.leather;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(6.8, stirrupY - 5); ctx.lineTo(11.4, stirrupY - 5); ctx.stroke();
  } else {
  // Legs with animated run, jump tuck, knee plates and boot cuffs.
  // Feet lift in an arc during the swing phase so strides step instead of sliding.
  const strideAmt = (5.4 + 2.6 * runB) * moveB * (1 - airB);
  const liftAmt = (2.4 + 1.8 * runB) * moveB * (1 - airB);
  const swingPhase = Math.cos(cycle);
  let backFoot = -3 + stride * strideAmt;
  let frontFoot = 3 - stride * strideAmt;
  let backLift = Math.max(0, swingPhase) * liftAmt * (1 - airB);
  let frontLift = Math.max(0, -swingPhase) * liftAmt * (1 - airB);
  let backKneeY = groundY - 4 - backLift * 0.8;
  let frontKneeY = groundY - 4 - frontLift * 0.8;
  backFoot += (-6 - backFoot) * airB;
  frontFoot += (6 - frontFoot) * airB;
  backKneeY += ((groundY - 12 - Math.max(0, p.jumpVy || 0) * 0.006) - backKneeY) * airB;
  frontKneeY += ((groundY - 7) - frontKneeY) * airB;
  const attackPose = attack * (1 - moveB) * (1 - airB);
  if (attackPose > 0) {
    backFoot += (-6 - backFoot) * attackPose;
    frontFoot += (5.5 + attack * 2 - frontFoot) * attackPose;
    backLift *= 1 - attackPose;
    frontLift *= 1 - attackPose;
  }

  limb(-3, hipY, backFoot, backKneeY, O.pants, 3.9);
  limb(backFoot, backKneeY - 0.5, backFoot + 0.5, groundY - 2 - backLift, O.boots, 3.5);
  drawBoot(backFoot + 0.6, groundY - backLift, O.boots, 1.06);
  limb(3, hipY, frontFoot, frontKneeY, O.pants, 3.9);
  limb(frontFoot, frontKneeY - 0.5, frontFoot + 0.5, groundY - 2 - frontLift, O.boots, 3.5);
  drawBoot(frontFoot + 0.6, groundY - frontLift, O.boots, 1.06);

  // Subtle boot cuffs where shaft meets leg (no bulky knee pads).
  ctx.strokeStyle = O.leather;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(backFoot - 2.2, groundY - 5.6 - backLift); ctx.lineTo(backFoot + 2.6, groundY - 5.6 - backLift); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(frontFoot - 2.2, groundY - 5.6 - frontLift); ctx.lineTo(frontFoot + 2.6, groundY - 5.6 - frontLift); ctx.stroke();
  }

  // Scabbard and cloak clasp behind the torso.
  ctx.save();
  ctx.translate(shX - 6, shY + 6);
  ctx.rotate(0.55);
  ctx.strokeStyle = O.leather;
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, 18); ctx.stroke();
  ctx.strokeStyle = O.goldDk;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-2.5, 1); ctx.lineTo(2.5, 1); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.restore();

  // Neck connecting head to torso (drawn first so the cuirass overlaps it).
  limb(shX + 0.3, shY + 1.5, headX + 0.2, headY + 3.6, B.skin, 3.2);

  // Torso: cuirass with side shadow, chest highlight and a center ridge.
  plate(shX, shY, 14, 20, O.armor, O.armorDk);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(shX - 6.3, shY);
  ctx.lineTo(shX + 6.3, shY);
  ctx.lineTo(shX + 4.8, hipY + 3);
  ctx.lineTo(shX - 4.8, hipY + 3);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.fillRect(shX + 2.8, shY - 1, 5, 22);
  ctx.fillStyle = O.armorLt;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(shX - 4.6, shY + 1.5);
  ctx.quadraticCurveTo(shX - 1, shY + 4.5, shX - 1.6, hipY + 1);
  ctx.lineTo(shX - 4.4, hipY + 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = O.armorDk;
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(shX + 0.6, shY + 1); ctx.lineTo(shX + 0.4, hipY + 2); ctx.stroke();
  ctx.restore();

  // Gorget at the collar.
  ctx.fillStyle = O.armorLt;
  ctx.beginPath();
  ctx.moveTo(shX - 3.4, shY - 0.7);
  ctx.lineTo(shX + 3.4, shY - 0.7);
  ctx.lineTo(shX + 2.6, shY + 1.9);
  ctx.lineTo(shX - 2.6, shY + 1.9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = O.armorDk;
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // Slim tabard hanging from the chest, with a shaded fold.
  ctx.fillStyle = O.tabard;
  ctx.beginPath();
  ctx.moveTo(shX - 2.4, shY + 6);
  ctx.lineTo(shX + 2.4, shY + 6);
  ctx.lineTo(1.9, hipY + 8);
  ctx.lineTo(0, hipY + 6);
  ctx.lineTo(-1.9, hipY + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = O.tabardDk;
  ctx.beginPath();
  ctx.moveTo(shX + 1, shY + 6.5);
  ctx.lineTo(shX + 2.4, shY + 6.5);
  ctx.lineTo(1.4, hipY + 6.6);
  ctx.closePath();
  ctx.fill();

  // Belt with a modest buckle.
  ctx.fillStyle = O.leather;
  ctx.fillRect(-5.4, hipY - 1.6, 10.8, 2.6);
  ctx.fillStyle = O.gold;
  ctx.fillRect(-1.6, hipY - 1.9, 3.2, 3.2);
  ctx.fillStyle = O.goldDk;
  ctx.fillRect(-0.8, hipY - 1.1, 1.6, 1.6);

  // Equipped armor is drawn over the cuirass/tabard (arms render on top).
  if (p.armor) drawTorsoArmor(p.armor, shX, shY, hipY);

  // Pauldrons and arms with bracers. The weapon overlay adds the weapon hand,
  // but these base arms give idle/run/jump poses weight.
  const strideSwing = stride * (2.6 + 1.4 * runB);
  const armSwing = (breathe * 0.7 + (strideSwing - breathe * 0.7) * moveB) * (1 - airB) - 3 * airB;
  const armCol = outfit?.gloves || B.skin;
  ctx.fillStyle = O.armor;
  ctx.beginPath(); ctx.ellipse(shX - 6.8, shY + 1.6, 3.0, 3.7, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(shX + 6.8, shY + 1.6, 3.0, 3.7, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = O.armorDk;
  ctx.beginPath(); ctx.ellipse(shX - 6.9, shY + 4, 2.3, 1.4, -0.3, 0, Math.PI); ctx.fill();
  ctx.beginPath(); ctx.ellipse(shX + 6.9, shY + 4, 2.3, 1.4, 0.3, 0, Math.PI); ctx.fill();
  ctx.strokeStyle = O.armorLt;
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.arc(shX - 6.8, shY + 1.4, 2.3, Math.PI * 1.08, Math.PI * 1.88); ctx.stroke();
  ctx.beginPath(); ctx.arc(shX + 6.8, shY + 1.4, 2.3, Math.PI * 1.14, Math.PI * 1.94); ctx.stroke();
  if (p.armor) drawArmorShoulders(p.armor, shX, shY, O);

  // Arms counter-swing (opposite arm to leg); the forward hand rises slightly.
  const counter = armSwing * moveB * (1 - airB);
  let lhx = shX - 8 - armSwing * (1 - moveB) + counter;
  let lhy = shY + 13 - Math.max(0, counter) * 0.35;
  let rhx = shX + 8 + armSwing * (1 - moveB) - counter + attack * 1.5;
  let rhy = shY + 13 - Math.max(0, -counter) * 0.35 - attack * 3;
  lhx += (shX - 5 - lhx) * airB;
  lhy += (shY + 10 - lhy) * airB;
  rhx += (shX + 5 - rhx) * airB;
  const leftHand = { x: lhx, y: lhy };
  const rightHand = { x: rhx, y: rhy };
  limb(shX - 5.5, shY + 3, leftHand.x, leftHand.y, armCol, 3);
  limb(shX + 5.5, shY + 3, rightHand.x, rightHand.y, armCol, 3);
  ctx.fillStyle = O.armor;
  ctx.beginPath(); ctx.ellipse(leftHand.x + 0.4, leftHand.y - 2.2, 1.9, 2.9, -0.35, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(rightHand.x - 0.4, rightHand.y - 2.2, 1.9, 2.9, 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = O.goldDk;
  ctx.fillRect(leftHand.x - 1.8, leftHand.y - 4, 3.6, 0.9);
  ctx.fillRect(rightHand.x - 1.8, rightHand.y - 4, 3.6, 0.9);

  // Single cape brooch instead of the necklace-like double clasp.
  ctx.fillStyle = O.gold;
  ctx.beginPath(); ctx.arc(shX - 2.8, shY + 0.4, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = O.goldDk;
  ctx.lineWidth = 0.7;
  ctx.stroke();

  drawHead(headX, headY, hurt, p.armor, B);
  if (!outfit) drawBiomeRegalia(P, shX, shY, hipY, headX, headY, p.armor);
  ctx.restore();
}
