import { ctx, groundY } from '../../core/canvas.js';
import { drawBoot } from '../DrawHelpers.js';
import { drawClimbPose, isClimbingEntity } from './FriendlyClimb.js';
import { drawTorsoArmor } from '../ItemRender.js';
import { armorOutfit, drawHelmet, drawArmorAura } from '../ArmorOutfits.js';

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

function drawHead(headX, headY, hurt, armorId = null) {
  const x = headX, y = headY;

  // Skull with a small nose bump on the leading edge for a real profile.
  ctx.fillStyle = C.skin;
  ctx.beginPath(); ctx.arc(x, y, 4.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 4.3, y - 0.6);
  ctx.quadraticCurveTo(x + 5.7, y + 0.7, x + 4.1, y + 1.5);
  ctx.closePath(); ctx.fill();
  // jaw shading
  ctx.fillStyle = "rgba(90,55,30,0.14)";
  ctx.beginPath(); ctx.arc(x + 0.5, y + 1.6, 3.3, Math.PI * 0.12, Math.PI * 0.85); ctx.fill();

  // Swept-back hair: clean hairline at the brow, mass over crown and nape.
  ctx.fillStyle = C.hair;
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
  ctx.fillStyle = C.skin;
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
  ctx.strokeStyle = C.hair;
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
  // Equipped armor reskins the entire model: cape, cuirass, tabard, legs,
  // boots, trims and (via `gloves`) the bare arms.
  const outfit = armorOutfit(p.armor);
  const O = outfit ? { ...C, ...outfit } : C;
  if (isClimbingEntity(p)) {
    drawClimbPose(p, {
      skin: C.skin,
      tunic: O.tabard,
      tunicLt: O.capeLt,
      pants: O.pants,
      boots: O.boots,
      belt: O.leather,
      steel: O.armor,
      steelDk: O.armorDk,
      buckle: O.gold,
      hair: C.hair,
      cloak: O.cape,
      cloakDk: O.capeDk,
      accent: O.capeLt,
      gold: C.gold,
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

  drawCape(shX, shY, hipY, moveB, runB, airB, gallop, O, !!outfit?.longCloak);

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
  limb(shX + 0.3, shY + 1.5, headX + 0.2, headY + 3.6, C.skin, 3.2);

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
  const armCol = outfit?.gloves || C.skin;
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

  drawHead(headX, headY, hurt, p.armor);
  ctx.restore();
}
