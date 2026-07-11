// Shared item rendering: detailed weapon & armor models used by the shop,
// inventory, ground loot, the pickup overlay and the player paper-doll.
// Also owns the "weapon held in the player's hands" drawing so the world
// renderer and the inventory preview share one implementation.
import { clamp, lerp } from '../util/math.js';
import { ctx, groundY } from '../core/canvas.js';
import { WEAPONS, RARITY_COL } from '../config/weapons.js';
import { ARMORS, ARMOR_RARITY_COL } from '../config/armor.js';
import { shootPose, ease, drawBow, limb } from './sprites/Archer.js';
import { drawTomeModel, roundedRect } from './DrawHelpers.js';

export const WEAPON_TYPE_LABEL = { melee: "Melee", ranged: "Bow", magic: "Magic" };

// ---------- Small helpers ----------
function rarityHalo(rarity, col, r, extra = 0) {
  const a = [0, 0.10, 0.16, 0.24, 0.32][rarity] + extra;
  if (a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r);
  g.addColorStop(0, col);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = a;
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------- Weapon piece models ----------
function drawSwordLikeWeapon(weaponId, w, len) {
  const isLegend = w.rarity >= 3 || weaponId === "sunblade" || weaponId === "kings_sword";
  const bladeW = weaponId === "dagger" ? 2.5 : weaponId === "longsword" || weaponId === "kings_sword" ? 4.2 : 3.5;
  ctx.save();
  if (isLegend) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.28;
    ctx.strokeStyle = w.col; ctx.lineWidth = bladeW + 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke(); ctx.restore();
  }
  const bladeGrad = ctx.createLinearGradient(2, -3, len, 3);
  bladeGrad.addColorStop(0, "#f3f0df");
  bladeGrad.addColorStop(0.45, w.col);
  bladeGrad.addColorStop(1, "#ffffff");
  ctx.fillStyle = bladeGrad;
  ctx.beginPath();
  ctx.moveTo(1, -bladeW * 0.45);
  ctx.lineTo(len - 4, -bladeW * 0.65);
  ctx.lineTo(len + 3, 0);
  ctx.lineTo(len - 4, bladeW * 0.65);
  ctx.lineTo(1, bladeW * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(30,25,20,0.45)"; ctx.lineWidth = 0.7; ctx.stroke();
  ctx.strokeStyle = "#2c2117"; ctx.lineWidth = 3; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(2, 0); ctx.stroke();
  ctx.strokeStyle = "#d4a838"; ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(-3, -5); ctx.lineTo(-3, 5); ctx.stroke();
  ctx.fillStyle = "#f2c14e";
  ctx.beginPath(); ctx.arc(-7.5, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawAxeWeaponModel(weaponId, w, len) {
  const headX = len - 1;
  const legendary = w.rarity >= 3;
  const isIce = weaponId === "ice_axe";
  const isShadow = weaponId === "shadow_axe";
  const haft = isShadow ? "#37213f" : "#6a4524";
  const haftHi = isShadow ? "#6f3f83" : "#a7743a";
  const metalDark = isShadow ? "#251530" : isIce ? "#345c7e" : "#4e4d48";
  const edge = isShadow ? "#e2a7ff" : isIce ? "#e7fbff" : "#fff0c6";

  ctx.save();
  if (legendary || isIce) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = isShadow ? 0.28 : 0.18;
    ctx.strokeStyle = w.col;
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(headX - 4, -1); ctx.lineTo(headX + 9, -1); ctx.stroke();
    ctx.restore();
  }

  ctx.strokeStyle = haft;
  ctx.lineWidth = 4.2;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(headX - 4, 0); ctx.stroke();
  ctx.strokeStyle = haftHi;
  ctx.lineWidth = 1.1;
  ctx.globalAlpha = 0.55;
  ctx.beginPath(); ctx.moveTo(-6, -1.2); ctx.lineTo(headX - 6, -1.2); ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = metalDark;
  roundedRect(headX - 7, -4.2, 8.5, 8.4, 1.8); ctx.fill();
  ctx.strokeStyle = "#1c1712";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  const bladeGrad = ctx.createLinearGradient(headX - 8, -12, headX + 13, 11);
  bladeGrad.addColorStop(0, edge);
  bladeGrad.addColorStop(0.38, w.col);
  bladeGrad.addColorStop(0.76, metalDark);
  bladeGrad.addColorStop(1, edge);

  ctx.fillStyle = bladeGrad;
  ctx.beginPath();
  ctx.moveTo(headX - 6.5, -10.5);
  ctx.quadraticCurveTo(headX + 7, -11.5, headX + 13.5, -3.2);
  ctx.quadraticCurveTo(headX + 8.6, -1.1, headX + 12.8, 2.6);
  ctx.quadraticCurveTo(headX + 6.4, 11.4, headX - 6.5, 10.4);
  ctx.quadraticCurveTo(headX - 1.7, 4.5, headX - 1.8, 0);
  ctx.quadraticCurveTo(headX - 1.7, -4.5, headX - 6.5, -10.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(20,16,13,0.48)";
  ctx.lineWidth = 0.85;
  ctx.stroke();

  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.15;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(headX + 10.2, -5.9);
  ctx.quadraticCurveTo(headX + 14.2, -1.1, headX + 10.1, 5.9);
  ctx.stroke();

  ctx.fillStyle = metalDark;
  ctx.beginPath();
  ctx.moveTo(headX - 7.4, 0);
  ctx.lineTo(headX - 13.5, -3.1);
  ctx.lineTo(headX - 11.8, 0);
  ctx.lineTo(headX - 13.5, 3.1);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = isIce ? "#bff4ff" : isShadow ? "#b86cff" : "#d8b25a";
  ctx.lineWidth = 1.25;
  ctx.beginPath(); ctx.moveTo(headX - 4.5, -6.3); ctx.lineTo(headX + 2.8, 0); ctx.lineTo(headX - 4.5, 6.3); ctx.stroke();

  ctx.fillStyle = "#25190f";
  ctx.beginPath(); ctx.arc(-8, 0, 2.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawMeleeWeaponModel(weaponId, w, len) {
  if (weaponId.includes("spear")) {
    ctx.strokeStyle = "#7a542c"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(len + 8, 0); ctx.stroke();
    ctx.fillStyle = w.col;
    ctx.beginPath(); ctx.moveTo(len + 13, 0); ctx.lineTo(len + 3, -4.5); ctx.lineTo(len + 5, 0); ctx.lineTo(len + 3, 4.5); ctx.closePath(); ctx.fill();
    return;
  }
  if (weaponId.includes("axe")) {
    drawAxeWeaponModel(weaponId, w, len);
    return;
  }
  if (weaponId.includes("hammer")) {
    ctx.strokeStyle = "#5a3920"; ctx.lineWidth = 3.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(len - 6, 0); ctx.stroke();
    ctx.fillStyle = w.col;
    roundedRect(len - 6, -7, 13, 14, 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.fillRect(len - 4, -6, 8, 3);
    return;
  }
  drawSwordLikeWeapon(weaponId, w, len);
}

function drawHeldCrossbow(hx, hy, aim, pull, recoil, loaded, col) {
  const rot = (1 - aim) * 0.45 - recoil * 0.08;
  ctx.save();
  ctx.translate(hx - recoil * 4, hy);
  ctx.rotate(rot);
  ctx.fillStyle = "#5b3517";
  roundedRect(-13, -3, 28, 6, 1.8); ctx.fill();
  ctx.fillStyle = "#8a5a2a";
  ctx.beginPath(); ctx.moveTo(-11, 2.4); ctx.lineTo(-16, 8); ctx.lineTo(-9, 6); ctx.lineTo(-3, 2.4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#2f2116"; ctx.fillRect(-5, -1.2, 11, 2.4);
  const flex = pull * 2.5;
  ctx.strokeStyle = col || "#b8bcc4"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(10 - flex, -11); ctx.quadraticCurveTo(19, -4.5, 13, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(10 - flex, 11); ctx.quadraticCurveTo(19, 4.5, 13, 0); ctx.stroke();
  const nutX = 9 - pull * 14;
  ctx.strokeStyle = "#e8d8a8"; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(10 - flex, -11); ctx.lineTo(nutX, 0); ctx.lineTo(10 - flex, 11); ctx.stroke();
  ctx.strokeStyle = "#cfd3d9"; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-8, -4.5); ctx.lineTo(-8, 4.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(-8, 0, 2.7, 0, Math.PI * 2); ctx.stroke();
  if (loaded) {
    ctx.strokeStyle = "#33200f"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(nutX - 1, -1.8); ctx.lineTo(18, -1.8); ctx.stroke();
    ctx.fillStyle = "#cfd3d9";
    ctx.beginPath(); ctx.moveTo(18, -4); ctx.lineTo(23, -1.8); ctx.lineTo(18, 0.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#8fae4a";
    ctx.beginPath(); ctx.moveTo(nutX - 1, -1.8); ctx.lineTo(nutX - 4, -4); ctx.lineTo(nutX + 1.5, -2.5); ctx.closePath(); ctx.fill();
  }
  if (recoil > 0) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = recoil * 0.35;
    ctx.fillStyle = "#ffe0a0"; ctx.beginPath(); ctx.ellipse(20, -1.8, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawBowModel(weaponId, w) {
  const r = clamp(w.range * 0.048, 13, 23);
  const woodDark = weaponId === "void_bow" ? "#3a1a5a" : weaponId === "dark_bow" ? "#2a1236" : weaponId === "dragons_bow" ? "#5a1e08" : "#5f3d1c";
  // limbs (double stroke for depth)
  ctx.strokeStyle = woodDark; ctx.lineWidth = 4.2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(0, 0, r, -1.28, 1.28); ctx.stroke();
  ctx.strokeStyle = w.col; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(0, 0, r, -1.25, 1.25); ctx.stroke();
  // recurve tip hooks + caps
  const tx = r * Math.cos(1.25), ty = r * Math.sin(1.25);
  ctx.strokeStyle = woodDark; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(tx, -ty); ctx.lineTo(tx - 3.4, -ty - 2.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - 3.4, ty + 2.6); ctx.stroke();
  ctx.fillStyle = "#e8d8a8";
  ctx.beginPath(); ctx.arc(tx - 3, -ty - 2.4, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(tx - 3, ty + 2.4, 1.4, 0, Math.PI * 2); ctx.fill();
  // string + nocked arrow
  ctx.strokeStyle = "#e8d8a8"; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(tx - 3, -ty - 2.4); ctx.lineTo(tx - 3, ty + 2.4); ctx.stroke();
  ctx.strokeStyle = "#c9b48a"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(tx - 3, 0); ctx.lineTo(r + 5, 0); ctx.stroke();
  ctx.fillStyle = "#b8bcc4";
  ctx.beginPath(); ctx.moveTo(r + 5, -1.9); ctx.lineTo(r + 9, 0); ctx.lineTo(r + 5, 1.9); ctx.closePath(); ctx.fill();
  // leather grip wrap at the belly
  ctx.strokeStyle = "#3a281a"; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(0, 0, r, -0.18, 0.18); ctx.stroke();
  ctx.strokeStyle = "#7a5a34"; ctx.lineWidth = 1;
  for (let k = -1; k <= 1; k++) {
    ctx.beginPath(); ctx.arc(0, 0, r, k * 0.11 - 0.035, k * 0.11 + 0.035); ctx.stroke();
  }
  // magic bows shimmer along the limbs
  if (w.rarity >= 3) {
    const t = performance.now() / 1000;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.3 + 0.16 * Math.sin(t * 3.2);
    ctx.strokeStyle = w.col; ctx.lineWidth = 5.5;
    ctx.beginPath(); ctx.arc(0, 0, r, -1.2, 1.2); ctx.stroke();
    ctx.restore();
  }
}

// A display model of any weapon, centered on the origin. `s` scales the
// whole model (≈44 px tall at s=1). opts.glow adds extra halo strength.
export function drawWeaponModel(weaponId, s = 1, opts = {}) {
  const w = WEAPONS[weaponId];
  if (!w) return;
  ctx.save();
  ctx.scale(s, s);
  rarityHalo(w.rarity, RARITY_COL[w.rarity], 26, opts.glow || 0);
  if (w.type === "melee") {
    const len = clamp(w.range * 0.42, 16, 40);
    ctx.rotate(-0.72);
    ctx.translate(-(len - 4) / 2, 0);
    drawMeleeWeaponModel(weaponId, w, len);
  } else if (weaponId === "crossbow") {
    drawHeldCrossbow(-2, 0, 1, 0, 0, true, w.col);
  } else if (w.type === "ranged") {
    ctx.translate(-4, 0);
    drawBowModel(weaponId, w);
  } else {
    drawTomeModel(weaponId, w.col, 0.92, { open: opts.open ?? 0.4, glow: (opts.glow || 0) + (w.rarity >= 3 ? 0.25 : 0.1) });
  }
  ctx.restore();
}

// ---------- Armor piece models ----------
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
  const b = clamp(Math.round((n & 255) * f), 0, 255);
  return `rgb(${r},${g},${b})`;
}

// Cuirass silhouette used by most chest pieces: broad shoulders, waist taper.
function cuirassPath(wTop = 14, wBot = 10, top = -15, bot = 13) {
  ctx.beginPath();
  ctx.moveTo(-wTop, top + 3);
  ctx.quadraticCurveTo(-wTop - 1.5, top + 9, -wTop + 2.2, 2);
  ctx.quadraticCurveTo(-wBot - 1, 7, -wBot, bot - 2);
  ctx.quadraticCurveTo(0, bot + 2, wBot, bot - 2);
  ctx.quadraticCurveTo(wBot + 1, 7, wTop - 2.2, 2);
  ctx.quadraticCurveTo(wTop + 1.5, top + 9, wTop, top + 3);
  ctx.quadraticCurveTo(wTop * 0.55, top - 1, wTop * 0.32, top);
  ctx.quadraticCurveTo(0, top + 4.5, -wTop * 0.32, top);
  ctx.quadraticCurveTo(-wTop * 0.55, top - 1, -wTop, top + 3);
  ctx.closePath();
}

function scaleRows(cols, rows, x0, y0, stepX, stepY, r, baseCol, opts = {}) {
  for (let j = 0; j < rows; j++) {
    const off = (j % 2) * stepX * 0.5;
    const rowCol = shade(baseCol, 1.12 - j * 0.07);
    for (let i = 0; i < cols; i++) {
      const x = x0 + off + i * stepX, y = y0 + j * stepY;
      ctx.fillStyle = rowCol;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = opts.edge || "rgba(0,0,0,0.35)"; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI); ctx.stroke();
      if (opts.glint) {
        ctx.fillStyle = opts.glint;
        ctx.beginPath(); ctx.arc(x - r * 0.3, y + r * 0.35, r * 0.22, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

function ringMesh(x0, y0, x1, y1, step, colLight, colDark) {
  for (let j = 0, y = y0; y < y1; y += step, j++) {
    const off = (j % 2) * step * 0.5;
    for (let x = x0 + off; x < x1; x += step) {
      ctx.strokeStyle = (Math.floor(x * 7 + j) % 3 === 0) ? colLight : colDark;
      ctx.lineWidth = 0.75;
      ctx.beginPath(); ctx.arc(x, y, step * 0.52, 0.15, Math.PI - 0.15); ctx.stroke();
    }
  }
}

function drawLeatherCapModel(a) {
  const col = a.col, dk = shade(col, 0.62), lt = shade(col, 1.3);
  // rounded dome with a short brim and a neck flap
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-13, 4);
  ctx.bezierCurveTo(-13.5, -9, -6, -14.5, 0.5, -14.5);
  ctx.bezierCurveTo(8, -14.5, 13.5, -8, 13, 3);
  ctx.lineTo(-13, 4);
  ctx.closePath(); ctx.fill();
  // panel seams
  ctx.strokeStyle = dk; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -14.2); ctx.quadraticCurveTo(0.5, -6, 0, 3.4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-6.4, -12.4); ctx.quadraticCurveTo(-7.4, -5, -6.8, 3.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6.9, -12.2); ctx.quadraticCurveTo(8, -5, 7.2, 3.2); ctx.stroke();
  // stitching along the seams
  ctx.strokeStyle = "#e8d8a8"; ctx.lineWidth = 0.6;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath(); ctx.moveTo(-2.6, -11 + k * 3.4); ctx.lineTo(-1.2, -11.4 + k * 3.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1.4, -11.4 + k * 3.4); ctx.lineTo(2.8, -11 + k * 3.4); ctx.stroke();
  }
  // brim band with buckle
  ctx.fillStyle = dk;
  roundedRect(-14, 2.5, 28, 5.4, 2.4); ctx.fill();
  ctx.fillStyle = lt;
  ctx.fillRect(-14, 3.1, 28, 1.1);
  ctx.fillStyle = "#c8a24e";
  roundedRect(-2.4, 3.1, 4.8, 4.2, 1); ctx.fill();
  ctx.strokeStyle = "#6a4a1a"; ctx.lineWidth = 0.8;
  ctx.strokeRect(-1.4, 4.1, 2.8, 2.2);
  // neck flap + rivets
  ctx.fillStyle = shade(col, 0.8);
  ctx.beginPath(); ctx.moveTo(6, 7.6); ctx.quadraticCurveTo(11, 10, 12.5, 14); ctx.lineTo(5, 14); ctx.quadraticCurveTo(3.6, 10, 4.6, 7.8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#d8c48a";
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(-10 + k * 10, 5.2, 0.75, 0, Math.PI * 2); ctx.fill(); }
  // soft top sheen
  ctx.fillStyle = "rgba(255,240,200,0.14)";
  ctx.beginPath(); ctx.ellipse(-3.5, -10.5, 5.5, 2.6, -0.5, 0, Math.PI * 2); ctx.fill();
}

function drawStuddedVestModel(a) {
  const col = a.col, dk = shade(col, 0.6), lt = shade(col, 1.28);
  cuirassPath(13, 9.5, -15, 13);
  ctx.fillStyle = col; ctx.fill();
  ctx.strokeStyle = dk; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.save(); cuirassPath(13, 9.5, -15, 13); ctx.clip();
  // side shading + top light
  ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(6, -16, 10, 32);
  ctx.fillStyle = "rgba(255,235,190,0.12)"; ctx.fillRect(-13, -15, 6, 30);
  // front opening with cross lacing
  ctx.strokeStyle = dk; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 14); ctx.stroke();
  ctx.strokeStyle = "#e0cfa0"; ctx.lineWidth = 0.9;
  for (let k = 0; k < 5; k++) {
    const y = -9.5 + k * 4.6;
    ctx.beginPath(); ctx.moveTo(-2.6, y); ctx.lineTo(2.6, y + 2.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2.6, y); ctx.lineTo(-2.6, y + 2.4); ctx.stroke();
  }
  // stud rows
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 3; i++) {
      const y = -9 + j * 5.4;
      ctx.fillStyle = "#d8d8e2";
      ctx.beginPath(); ctx.arc(-9.5 + i * 2.9, y, 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(4.6 + i * 2.9, y, 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath(); ctx.arc(-9.8 + i * 2.9, y - 0.3, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(4.3 + i * 2.9, y - 0.3, 0.3, 0, Math.PI * 2); ctx.fill();
    }
  }
  // bottom hem
  ctx.fillStyle = dk; ctx.fillRect(-12, 11.4, 24, 3.2);
  ctx.fillStyle = lt; ctx.fillRect(-12, 11.4, 24, 0.8);
  ctx.restore();
  // shoulder straps + buckles
  ctx.fillStyle = dk;
  roundedRect(-11.5, -16.5, 6.5, 4.6, 1.6); ctx.fill();
  roundedRect(5, -16.5, 6.5, 4.6, 1.6); ctx.fill();
  ctx.fillStyle = "#c8a24e";
  ctx.fillRect(-9.4, -15.6, 2.2, 2.6); ctx.fillRect(7.2, -15.6, 2.2, 2.6);
}

function drawChainmailModel(a) {
  const col = a.col, dk = shade(col, 0.55), lt = shade(col, 1.35);
  // hauberk with short sleeves
  ctx.fillStyle = shade(col, 0.82);
  cuirassPath(13.5, 10, -15, 14);
  ctx.fill();
  ctx.fillStyle = shade(col, 0.72);
  ctx.beginPath(); ctx.ellipse(-14, -9, 4.6, 6, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(14, -9, 4.6, 6, 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.save(); cuirassPath(13.5, 10, -15, 14); ctx.clip();
  ringMesh(-14, -13.4, 14, 14, 2.5, lt, dk);
  // diagonal sheen
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.14;
  ctx.rotate(-0.5);
  ctx.fillStyle = "#dfe6ff"; ctx.fillRect(-20, -3, 40, 5);
  ctx.restore();
  ctx.restore();
  // sleeve rings
  ctx.save();
  ctx.beginPath(); ctx.ellipse(-14, -9, 4.6, 6, -0.5, 0, Math.PI * 2); ctx.clip();
  ringMesh(-18.6, -15, -9.4, -3, 2.4, lt, dk); ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.ellipse(14, -9, 4.6, 6, 0.5, 0, Math.PI * 2); ctx.clip();
  ringMesh(9.4, -15, 18.6, -3, 2.4, lt, dk); ctx.restore();
  // reinforced collar and zig-zag hem
  ctx.strokeStyle = "#4c4c58"; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(-4.6, -14.4); ctx.quadraticCurveTo(0, -10.8, 4.6, -14.4); ctx.stroke();
  ctx.strokeStyle = lt; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-4.6, -13.6); ctx.quadraticCurveTo(0, -10, 4.6, -13.6); ctx.stroke();
  ctx.strokeStyle = dk; ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let x = -10; x <= 10; x += 2.5) { ctx.lineTo(x, 13.8 + ((x / 2.5) % 2 === 0 ? 0 : 1.6)); }
  ctx.stroke();
}

function drawScaleArmorModel(a, palette = null, ember = false) {
  const col = a.col, dk = shade(col, 0.55);
  cuirassPath(13.5, 10, -15, 13);
  ctx.fillStyle = shade(col, 0.7); ctx.fill();
  ctx.strokeStyle = dk; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.save(); cuirassPath(13.5, 10, -15, 13); ctx.clip();
  scaleRows(10, 8, -14, -12, 3.3, 3.4, 2.1, palette || col, {
    glint: ember ? "rgba(255,210,120,0.55)" : "rgba(255,255,255,0.28)",
  });
  if (ember) {
    // heat shimmer between the scales
    const t = performance.now() / 1000;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 5; k++) {
      const gx = -9 + k * 4.6, gy = 8 - ((t * 6 + k * 3.1) % 16);
      ctx.globalAlpha = 0.28 + 0.2 * Math.sin(t * 5 + k * 2);
      ctx.fillStyle = "#ff9a3a";
      ctx.beginPath(); ctx.arc(gx, gy, 1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
  // leather shoulder yoke + gold waist trim
  ctx.fillStyle = "#4a351f";
  ctx.beginPath(); ctx.moveTo(-13.5, -12.4); ctx.quadraticCurveTo(0, -17.6, 13.5, -12.4); ctx.lineTo(12, -9.6); ctx.quadraticCurveTo(0, -14.4, -12, -9.6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#c8a24e";
  ctx.fillRect(-10.5, 11, 21, 2.4);
  ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(-10.5, 11, 21, 0.7);
}

function drawPlateChestModel(a) {
  const col = a.col, dk = shade(col, 0.58), lt = shade(col, 1.34);
  const grad = ctx.createLinearGradient(-13, 0, 13, 0);
  grad.addColorStop(0, shade(col, 1.18)); grad.addColorStop(0.5, col); grad.addColorStop(1, shade(col, 0.7));
  cuirassPath(14, 10, -15.5, 13.5);
  ctx.fillStyle = grad; ctx.fill();
  ctx.strokeStyle = dk; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.save(); cuirassPath(14, 10, -15.5, 13.5); ctx.clip();
  // center ridge + pec embossing
  ctx.strokeStyle = lt; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(0, -13.8); ctx.lineTo(0, 8); ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(1.1, -13.4); ctx.lineTo(1.1, 8); ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(-10.5, -6.5); ctx.quadraticCurveTo(-4.5, -2.5, -1.4, -7.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(10.5, -6.5); ctx.quadraticCurveTo(4.5, -2.5, 1.4, -7.5); ctx.stroke();
  // fauld strips at the waist
  for (let k = 0; k < 2; k++) {
    ctx.fillStyle = k % 2 ? shade(col, 0.85) : shade(col, 1.05);
    roundedRect(-10.5 + k, 8.2 + k * 2.9, 21 - k * 2, 2.6, 1.2); ctx.fill();
  }
  // mirror shine
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.2; ctx.rotate(-0.55);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(-22, -1, 44, 3.4);
  ctx.restore();
  ctx.restore();
  // gorget + rivets
  ctx.fillStyle = shade(col, 0.86);
  ctx.beginPath(); ctx.moveTo(-5, -15.3); ctx.quadraticCurveTo(0, -11.4, 5, -15.3); ctx.lineTo(4, -12.6); ctx.quadraticCurveTo(0, -9.4, -4, -12.6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#f2e6c8";
  for (const [rx, ry] of [[-11.6, -10.5], [11.6, -10.5], [-9.2, 4], [9.2, 4]]) {
    ctx.beginPath(); ctx.arc(rx, ry, 0.8, 0, Math.PI * 2); ctx.fill();
  }
}

function drawShadowCloakModel(a) {
  const t = performance.now() / 1000;
  const col = a.col, dk = shade(col, 0.42), lt = shade(col, 1.55);
  // outer aura
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.22 + 0.08 * Math.sin(t * 2.2);
  const g = ctx.createRadialGradient(0, -2, 3, 0, -2, 24);
  g.addColorStop(0, lt); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -2, 24, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // flowing cloak body with ragged hem
  const sway = Math.sin(t * 1.8) * 1.4;
  ctx.fillStyle = dk;
  ctx.beginPath();
  ctx.moveTo(-9.5, -10);
  ctx.bezierCurveTo(-13.5, -2, -13 + sway, 6, -11 + sway, 13.5);
  ctx.lineTo(-7.5 + sway, 10.5); ctx.lineTo(-4.5 + sway, 14.5); ctx.lineTo(-1 + sway * 0.6, 10.8);
  ctx.lineTo(2.5 + sway * 0.6, 14.8); ctx.lineTo(5.8 + sway, 10.6); ctx.lineTo(9.5 + sway, 13.8);
  ctx.bezierCurveTo(12.5 + sway, 5, 13, -3, 9.5, -10);
  ctx.closePath(); ctx.fill();
  // inner layer
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-7.5, -10.5);
  ctx.bezierCurveTo(-10.5, -3, -10 + sway * 0.7, 5, -8 + sway * 0.7, 11.5);
  ctx.quadraticCurveTo(0 + sway * 0.4, 9.4, 7 + sway * 0.7, 11.2);
  ctx.bezierCurveTo(9.5 + sway * 0.7, 4, 10, -4, 7.5, -10.5);
  ctx.closePath(); ctx.fill();
  // hood
  ctx.fillStyle = dk;
  ctx.beginPath();
  ctx.moveTo(-8.5, -9);
  ctx.bezierCurveTo(-10, -16.5, -4.5, -20.5, 0, -20.5);
  ctx.bezierCurveTo(4.5, -20.5, 10, -16.5, 8.5, -9);
  ctx.quadraticCurveTo(0, -13.5, -8.5, -9);
  ctx.closePath(); ctx.fill();
  // hood opening — pitch dark
  ctx.fillStyle = "#0a0612";
  ctx.beginPath(); ctx.ellipse(0, -12.6, 4.8, 4.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 3.1);
  ctx.fillStyle = lt;
  ctx.beginPath(); ctx.arc(-1.6, -12.8, 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(1.6, -12.8, 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // silver clasp + stitch shimmer
  ctx.fillStyle = "#cfd3d9";
  ctx.beginPath(); ctx.moveTo(0, -8.6); ctx.lineTo(1.8, -6.6); ctx.lineTo(0, -4.6); ctx.lineTo(-1.8, -6.6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = lt; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.moveTo(-7.5, -9.5); ctx.quadraticCurveTo(-8.8 + sway * 0.4, 0, -7.4 + sway * 0.7, 10.4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(7.5, -9.5); ctx.quadraticCurveTo(8.8 + sway * 0.4, 0, 7 + sway * 0.7, 10.2); ctx.stroke();
  ctx.globalAlpha = 1;
  // drifting wisps
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < 4; k++) {
    const p = (t * 0.55 + k * 0.25) % 1;
    ctx.globalAlpha = (1 - p) * 0.4;
    ctx.fillStyle = lt;
    ctx.beginPath(); ctx.arc(-8 + k * 5.4 + Math.sin(t * 2 + k) * 2, 12 - p * 22, 1 + p * 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawVoidArmorModel(a) {
  const t = performance.now() / 1000;
  const col = a.col, dk = shade(col, 0.4), lt = "#b07aff";
  // pulsing outer glow
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.26 + 0.1 * Math.sin(t * 2.6);
  const g = ctx.createRadialGradient(0, -1, 2, 0, -1, 25);
  g.addColorStop(0, lt); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -1, 25, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // angular obsidian plate
  ctx.fillStyle = "#191026";
  ctx.beginPath();
  ctx.moveTo(-13.5, -12); ctx.lineTo(-5, -15.5); ctx.lineTo(5, -15.5); ctx.lineTo(13.5, -12);
  ctx.lineTo(11, -2); ctx.lineTo(9.5, 12.5); ctx.lineTo(0, 15); ctx.lineTo(-9.5, 12.5); ctx.lineTo(-11, -2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke();
  // plate facets
  ctx.strokeStyle = shade(col, 0.75); ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(-11, -2); ctx.lineTo(-3.5, 1); ctx.lineTo(-9.5, 12.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(11, -2); ctx.lineTo(3.5, 1); ctx.lineTo(9.5, 12.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-5, -15.5); ctx.lineTo(-3.5, 1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(5, -15.5); ctx.lineTo(3.5, 1); ctx.stroke();
  // void core: a tiny starfield in the chest
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, -3.5, 4.6, 5.4, 0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = "#05030c"; ctx.fillRect(-6, -10, 12, 14);
  for (let k = 0; k < 8; k++) {
    const sx = Math.sin(k * 12.9898) * 4.2, sy = -3.5 + Math.cos(k * 78.233) * 4.6;
    ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + k * 1.7));
    ctx.fillStyle = k % 3 === 0 ? lt : "#ffffff";
    ctx.fillRect(sx, sy, 0.9, 0.9);
  }
  ctx.restore();
  ctx.strokeStyle = lt; ctx.lineWidth = 1.1;
  ctx.save(); ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 3.4);
  ctx.beginPath(); ctx.ellipse(0, -3.5, 4.6, 5.4, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  // glowing runes on the facets
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = lt; ctx.lineWidth = 0.9;
  const runes = [[-7.5, 5], [7.5, 5], [0, 9.5]];
  for (let k = 0; k < runes.length; k++) {
    ctx.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(t * 2.4 + k * 2.1));
    const [rx, ry] = runes[k];
    ctx.beginPath(); ctx.moveTo(rx - 1.4, ry + 1.6); ctx.lineTo(rx, ry - 1.8); ctx.lineTo(rx + 1.4, ry + 1.6); ctx.moveTo(rx - 0.8, ry + 0.4); ctx.lineTo(rx + 0.8, ry + 0.4);
    ctx.stroke();
  }
  ctx.restore();
  // shoulder spikes
  ctx.fillStyle = "#241536";
  ctx.beginPath(); ctx.moveTo(-13.5, -12); ctx.lineTo(-17.5, -17.5); ctx.lineTo(-10.5, -13.8); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(13.5, -12); ctx.lineTo(17.5, -17.5); ctx.lineTo(10.5, -13.8); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-17.5, -17.5); ctx.lineTo(-10.5, -13.8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(17.5, -17.5); ctx.lineTo(10.5, -13.8); ctx.stroke();
}

function drawSunPlateModel(a) {
  const t = performance.now() / 1000;
  const col = a.col, dk = shade(col, 0.6), lt = "#ffefad";
  // radiant halo with slow-turning rays
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.3 + 0.08 * Math.sin(t * 2);
  const g = ctx.createRadialGradient(0, -1, 3, 0, -1, 26);
  g.addColorStop(0, "#ffe9a0"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -1, 26, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.16;
  ctx.save(); ctx.rotate(t * 0.3);
  ctx.fillStyle = "#ffdf80";
  for (let k = 0; k < 6; k++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(2.6, -25); ctx.lineTo(-2.6, -25); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.restore();
  // golden cuirass
  const grad = ctx.createLinearGradient(-13, -14, 13, 13);
  grad.addColorStop(0, "#ffe08a"); grad.addColorStop(0.45, col); grad.addColorStop(1, "#a87a14");
  cuirassPath(14, 10, -15.5, 13.5);
  ctx.fillStyle = grad; ctx.fill();
  ctx.strokeStyle = dk; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.save(); cuirassPath(14, 10, -15.5, 13.5); ctx.clip();
  // embossed sun: core + rays
  ctx.strokeStyle = "#8a5f0e"; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.arc(0, -2, 4.4, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = lt;
  ctx.beginPath(); ctx.arc(0, -2, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e8a81e";
  ctx.beginPath(); ctx.arc(0.7, -1.3, 2.2, 0, Math.PI * 2); ctx.fill();
  for (let k = 0; k < 8; k++) {
    const a2 = k * Math.PI / 4 + 0.12;
    const x1 = Math.cos(a2) * 5.6, y1 = -2 + Math.sin(a2) * 5.6;
    const x2 = Math.cos(a2) * (k % 2 ? 8.2 : 10), y2 = -2 + Math.sin(a2) * (k % 2 ? 8.2 : 10);
    ctx.strokeStyle = "#8a5f0e"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = lt; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(x1 - 0.4, y1 - 0.4); ctx.lineTo(x2 - 0.4, y2 - 0.4); ctx.stroke();
  }
  // filigree at the waist
  ctx.strokeStyle = "#8a5f0e"; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(-10, 9.6); ctx.quadraticCurveTo(-5, 7.4, 0, 9.6); ctx.quadraticCurveTo(5, 11.8, 10, 9.6); ctx.stroke();
  // sweeping shine
  const sx = ((t * 26) % 60) - 30;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.4; ctx.rotate(-0.5);
  const sg = ctx.createLinearGradient(sx - 5, 0, sx + 5, 0);
  sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(0.5, "rgba(255,252,230,0.85)"); sg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sg; ctx.fillRect(sx - 5, -24, 10, 48);
  ctx.restore();
  ctx.restore();
  // gorget + ruby studs
  ctx.fillStyle = "#e8b83a";
  ctx.beginPath(); ctx.moveTo(-5, -15.3); ctx.quadraticCurveTo(0, -11.2, 5, -15.3); ctx.lineTo(4, -12.5); ctx.quadraticCurveTo(0, -9.2, -4, -12.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#d8352a";
  for (const [rx, ry] of [[-11.4, -10], [11.4, -10]]) {
    ctx.beginPath(); ctx.arc(rx, ry, 1.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff9a8a";
    ctx.beginPath(); ctx.arc(rx - 0.35, ry - 0.35, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#d8352a";
  }
}

// A display model of any armor piece, centered on the origin (≈40 px tall
// at s=1). Highly detailed; epic/legendary pieces animate.
export function drawArmorModel(armorId, s = 1, opts = {}) {
  const a = ARMORS[armorId];
  if (!a) return;
  ctx.save();
  ctx.scale(s, s);
  rarityHalo(a.rarity, ARMOR_RARITY_COL[a.rarity], 27, opts.glow || 0);
  switch (armorId) {
    case "leather_cap":      drawLeatherCapModel(a); break;
    case "studded_vest":     drawStuddedVestModel(a); break;
    case "chainmail":        drawChainmailModel(a); break;
    case "scale_armor":      drawScaleArmorModel(a); break;
    case "plate_chestplate": drawPlateChestModel(a); break;
    case "shadow_cloak":     drawShadowCloakModel(a); break;
    case "dragon_scale":     drawScaleArmorModel(a, a.col, true); break;
    case "void_armor":       drawVoidArmorModel(a); break;
    case "sun_plate":        drawSunPlateModel(a); break;
    default:                 drawStuddedVestModel(a); break;
  }
  ctx.restore();
}

// ---------- Armor worn on the player's body ----------
// Optional cape recolor for cloak-like armors (used by sprites/Player.js).
export function armorCapeColors(armorId) {
  if (armorId === "shadow_cloak") return { cape: "#5a3080", capeDk: "#31184a", capeLt: "#a06ae0" };
  if (armorId === "void_armor")   return { cape: "#3c2360", capeDk: "#1e1030", capeLt: "#8a55e8" };
  return null;
}

// Torso overlay drawn on top of the player's cuirass/tabard. Coordinates
// match sprites/Player.js: shoulders at (shX, shY), hips at hipY, x≈0 center.
export function drawTorsoArmor(armorId, shX, shY, hipY) {
  const a = ARMORS[armorId];
  if (!a) return;
  const t = performance.now() / 1000;
  const torso = () => {
    ctx.beginPath();
    ctx.moveTo(shX - 6.6, shY + 0.6);
    ctx.lineTo(shX + 6.6, shY + 0.6);
    ctx.lineTo(shX + 5.1, hipY + 2.6);
    ctx.lineTo(shX - 5.1, hipY + 2.6);
    ctx.closePath();
  };
  switch (armorId) {
    case "leather_cap":
      return; // head piece only — handled by drawHeadArmor
    case "studded_vest": {
      torso(); ctx.fillStyle = a.col; ctx.fill();
      ctx.strokeStyle = shade(a.col, 0.55); ctx.lineWidth = 0.8; ctx.stroke();
      ctx.save(); torso(); ctx.clip();
      ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(shX + 2.5, shY, 5, 20);
      ctx.strokeStyle = shade(a.col, 0.5); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(shX, shY + 1); ctx.lineTo(shX * 0.6, hipY + 2.6); ctx.stroke();
      ctx.fillStyle = "#d8d8e2";
      for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) {
        ctx.beginPath(); ctx.arc(shX - 4.4 + i * 8.4, shY + 4 + j * 3.8, 0.65, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      break;
    }
    case "chainmail": {
      torso(); ctx.fillStyle = shade(a.col, 0.8); ctx.fill();
      ctx.save(); torso(); ctx.clip();
      ringMesh(shX - 7, shY + 1, shX + 7, hipY + 3, 1.9, shade(a.col, 1.35), shade(a.col, 0.55));
      ctx.restore();
      ctx.strokeStyle = shade(a.col, 0.5); ctx.lineWidth = 0.8; torso(); ctx.stroke();
      break;
    }
    case "scale_armor":
    case "dragon_scale": {
      const ember = armorId === "dragon_scale";
      torso(); ctx.fillStyle = shade(a.col, 0.65); ctx.fill();
      ctx.save(); torso(); ctx.clip();
      scaleRows(7, 6, shX - 7, shY + 2.2, 2.4, 2.7, 1.5, a.col, {
        glint: ember ? "rgba(255,205,110,0.5)" : "rgba(255,255,255,0.25)",
      });
      if (ember) {
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 4);
        ctx.fillStyle = "#ff8a30";
        ctx.beginPath(); ctx.arc(shX, shY + 8, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      ctx.strokeStyle = shade(a.col, 0.45); ctx.lineWidth = 0.8; torso(); ctx.stroke();
      break;
    }
    case "plate_chestplate": {
      const grad = ctx.createLinearGradient(shX - 6, 0, shX + 6, 0);
      grad.addColorStop(0, shade(a.col, 1.18)); grad.addColorStop(0.5, a.col); grad.addColorStop(1, shade(a.col, 0.68));
      torso(); ctx.fillStyle = grad; ctx.fill();
      ctx.strokeStyle = shade(a.col, 0.5); ctx.lineWidth = 0.8; ctx.stroke();
      ctx.save(); torso(); ctx.clip();
      ctx.strokeStyle = shade(a.col, 1.35); ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(shX, shY + 1); ctx.lineTo(shX, hipY + 2); ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(shX - 5, shY + 5.4); ctx.quadraticCurveTo(shX, shY + 7.4, shX + 5, shY + 5.4); ctx.stroke();
      ctx.fillStyle = shade(a.col, 0.9);
      ctx.fillRect(shX - 5.4, hipY - 1.4, 10.8, 1.7);
      ctx.restore();
      ctx.fillStyle = "#f2e6c8";
      ctx.beginPath(); ctx.arc(shX - 5, shY + 2.4, 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(shX + 5, shY + 2.4, 0.55, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "shadow_cloak": {
      // shoulder mantle + clasp; the cape itself is recolored via armorCapeColors
      ctx.fillStyle = "#3a2154";
      ctx.beginPath();
      ctx.moveTo(shX - 8.4, shY + 2.2);
      ctx.quadraticCurveTo(shX, shY - 3.4, shX + 8.4, shY + 2.2);
      ctx.lineTo(shX + 6.2, shY + 7.6);
      ctx.quadraticCurveTo(shX, shY + 3.6, shX - 6.2, shY + 7.6);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#8a5ad0"; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(shX - 7.6, shY + 3.4); ctx.quadraticCurveTo(shX, shY - 1.6, shX + 7.6, shY + 3.4); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#cfd3d9";
      ctx.beginPath(); ctx.moveTo(shX, shY + 2.4); ctx.lineTo(shX + 1.5, shY + 4.2); ctx.lineTo(shX, shY + 6); ctx.lineTo(shX - 1.5, shY + 4.2); ctx.closePath(); ctx.fill();
      break;
    }
    case "void_armor": {
      torso(); ctx.fillStyle = "#191026"; ctx.fill();
      ctx.strokeStyle = a.col; ctx.lineWidth = 0.9; ctx.stroke();
      ctx.save(); torso(); ctx.clip();
      ctx.strokeStyle = shade(a.col, 0.8); ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(shX - 6, shY + 6); ctx.lineTo(shX - 2, shY + 8); ctx.lineTo(shX - 4.5, hipY + 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(shX + 6, shY + 6); ctx.lineTo(shX + 2, shY + 8); ctx.lineTo(shX + 4.5, hipY + 2); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 3);
      ctx.strokeStyle = "#b07aff"; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.ellipse(shX, shY + 7, 2.2, 2.7, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#05030c";
      ctx.beginPath(); ctx.ellipse(shX, shY + 7, 2.2, 2.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e0ccff";
      ctx.fillRect(shX - 0.7, shY + 6, 0.7, 0.7); ctx.fillRect(shX + 0.8, shY + 8, 0.6, 0.6);
      ctx.restore();
      ctx.restore();
      break;
    }
    case "sun_plate": {
      const grad = ctx.createLinearGradient(shX - 6, shY, shX + 6, hipY);
      grad.addColorStop(0, "#ffe08a"); grad.addColorStop(0.5, a.col); grad.addColorStop(1, "#a87a14");
      torso(); ctx.fillStyle = grad; ctx.fill();
      ctx.strokeStyle = "#8a5f0e"; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.save(); torso(); ctx.clip();
      ctx.fillStyle = "#fff2c0";
      ctx.beginPath(); ctx.arc(shX, shY + 7, 1.7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#8a5f0e"; ctx.lineWidth = 0.7;
      for (let k = 0; k < 8; k++) {
        const a2 = k * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(shX + Math.cos(a2) * 2.4, shY + 7 + Math.sin(a2) * 2.4);
        ctx.lineTo(shX + Math.cos(a2) * 4.2, shY + 7 + Math.sin(a2) * 4.2);
        ctx.stroke();
      }
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.35;
      const sx2 = shX - 8 + ((t * 10) % 16);
      ctx.fillStyle = "#fffbe8"; ctx.fillRect(sx2, shY, 1.6, 20);
      ctx.restore();
      ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.16 + 0.06 * Math.sin(t * 2.4);
      const g2 = ctx.createRadialGradient(shX, shY + 7, 1, shX, shY + 7, 13);
      g2.addColorStop(0, "#ffe9a0"); g2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(shX, shY + 7, 13, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      break;
    }
  }
}

// Head overlay (drawn between hair and crown so the crown stays on top).
export function drawHeadArmor(armorId, headX, headY) {
  if (armorId !== "leather_cap") return;
  const a = ARMORS.leather_cap;
  const col = a.col, dk = shade(col, 0.6);
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(headX - 0.3, headY - 1.2, 5.35, Math.PI * 0.86, Math.PI * 2.14); ctx.fill();
  // back neck-guard flap
  ctx.fillStyle = shade(col, 0.8);
  ctx.beginPath();
  ctx.moveTo(headX - 5.2, headY - 1);
  ctx.quadraticCurveTo(headX - 6.4, headY + 2.4, headX - 4.6, headY + 4.4);
  ctx.lineTo(headX - 3.2, headY + 2.2);
  ctx.quadraticCurveTo(headX - 4.4, headY + 0.8, headX - 4.2, headY - 1.4);
  ctx.closePath(); ctx.fill();
  // brim + stitches
  ctx.strokeStyle = dk; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(headX - 0.3, headY - 1.1, 5.1, Math.PI * 0.92, Math.PI * 2.1); ctx.stroke();
  ctx.strokeStyle = "#e8d8a8"; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(headX - 2.4, headY - 5.6); ctx.quadraticCurveTo(headX, headY - 6.4, headX + 2.4, headY - 5.6); ctx.stroke();
}

// ---------- Weapon held in the player's hands ----------
// Extracted from Renderer.js so the inventory paper-doll can reuse it.
const PLAYER_SKIN = "#d3ac82";
const PLAYER_BRACER = "#596878";
const PLAYER_GOLD = "#8a6a2a";

function heldBowLook(weaponId, w) {
  const woodDark =
    weaponId === "void_bow" ? "#3a1a5a" :
    weaponId === "dark_bow" ? "#2a1236" :
    weaponId === "dragons_bow" ? "#5a1e08" :
    "#5f3d1c";
  return {
    radius: clamp(w.range * 0.035, 11, 16.5),
    wood: w.col,
    tip: woodDark,
    string: w.rarity >= 3 ? "#f1dcff" : "#e8d8a8",
    grip: "#3a281a",
    glow: w.rarity >= 3 ? w.col : null,
    glowAlpha: w.rarity >= 4 ? 0.34 : 0.24,
  };
}

function drawPlayerWeaponArm(x1, y1, x2, y2, width = 3) {
  limb(x1, y1, x2, y2, PLAYER_SKIN, width);
  ctx.fillStyle = PLAYER_BRACER;
  ctx.beginPath(); ctx.ellipse(x2 - 0.4, y2 - 1.8, 2.1, 3.1, 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PLAYER_GOLD;
  ctx.fillRect(x2 - 2.1, y2 - 4.1, 4.2, 0.95);
}

export function drawHeldWeapon(player, px = 0) {
  if (!player.weapon) return;
  const w = WEAPONS[player.weapon], sw = player.swing || 0;
  ctx.save();
  if (w.type === "melee") {
    const attackP = sw > 0 ? 1 - clamp(sw / 0.32, 0, 1) : 0;
    const slash = ease(attackP);
    const wind = sw > 0 ? Math.sin(attackP * Math.PI) : 0;
    const angle = sw > 0 ? lerp(-1.12, 0.64, slash) : -0.3;
    const grip = {
      x: px + 8 + Math.sin(slash * Math.PI) * 5 + slash * 7,
      y: groundY - 22 - wind * 10 + slash * 1.5,
    };
    const rearGrip = {
      x: grip.x - Math.cos(angle) * 6,
      y: grip.y - Math.sin(angle) * 6,
    };
    drawPlayerWeaponArm(px - 5, groundY - 28, rearGrip.x, rearGrip.y, 2.8);
    drawPlayerWeaponArm(px + 5, groundY - 28, grip.x, grip.y, 3);
    ctx.save();
    ctx.translate(grip.x, grip.y);
    ctx.rotate(angle);
    const len = clamp(w.range * 0.48, 18, 46);
    drawMeleeWeaponModel(player.weapon, w, len);
    ctx.restore();
  } else if (w.type === "ranged") {
    const shoot = shootPose(player);
    const frontSh = { x: px + 5, y: groundY - 28 }, backSh = { x: px - 5, y: groundY - 28 };
    let aim = 0.1, pull = 0;
    if (shoot) {
      if (shoot.phase === "reach")        aim = ease(shoot.p) * 0.4;
      else if (shoot.phase === "draw")    { aim = 0.4 + ease(shoot.p) * 0.6; pull = ease(shoot.p); }
      else if (shoot.phase === "release") { aim = 1; pull = 1 - shoot.p; }
      else                                aim = 1 - ease(shoot.p) * 0.7;
    }
    const grip = { x: frontSh.x + 4 + aim * 7, y: frontSh.y + 7 - aim * 8 };
    let drawHand = null;
    if (player.weapon === "crossbow") {
      let recoil = 0;
      if (shoot?.phase === "release") recoil = 1 - shoot.p;
      else if (shoot?.phase === "recoil") recoil = 1 - ease(shoot.p);
      if (shoot?.phase === "reach") { const p = ease(shoot.p); drawHand = { x: backSh.x - 1 - p * 5, y: backSh.y + 9 - p * 9 }; }
      else if (shoot?.phase === "draw") { const p = ease(shoot.p); drawHand = { x: backSh.x + 1 + p * 5, y: backSh.y + 6 - p * 7 }; }
      else if (shoot?.phase === "release") drawHand = { x: backSh.x + 7, y: backSh.y - 1 + shoot.p * 4 };
      else if (shoot?.phase === "recoil") { const p = ease(shoot.p); drawHand = { x: backSh.x + 5 - p * 3, y: backSh.y + 1 + p * 8 }; }
      else drawHand = { x: backSh.x - 1, y: backSh.y + 10 };
      drawPlayerWeaponArm(backSh.x, backSh.y, drawHand.x, drawHand.y, 2.6);
      drawPlayerWeaponArm(frontSh.x, frontSh.y, grip.x + 4 - recoil * 3, grip.y, 2.8);
      drawHeldCrossbow(grip.x + 6, grip.y, aim, pull, recoil, true, w.col);
    } else {
      if (shoot) {
        if (shoot.phase === "reach") { const p = ease(shoot.p); drawHand = { x: backSh.x + 2 - p * 6, y: backSh.y + 8 - p * 14 }; }
        else if (shoot.phase === "draw") { const p = ease(shoot.p); drawHand = { x: (1 - p) * (grip.x + 4) + p * (px + 1), y: (1 - p) * (backSh.y - 6) + p * (groundY - 37 + 3) }; }
        else if (shoot.phase === "release") drawHand = { x: px - 1 - shoot.p * 3, y: groundY - 37 + 3 + shoot.p * 2 };
        else { const p = ease(shoot.p); drawHand = { x: px - 4 - p * 3, y: groundY - 37 + 5 + p * 9 }; }
        limb(backSh.x, backSh.y, drawHand.x, drawHand.y, "#d3ac82", 2.5);
        if ((shoot.phase === "draw" && shoot.p > 0.3) || shoot.phase === "release") {
          const nockX = shoot.phase === "draw" ? drawHand.x : grip.x + 5;
          ctx.strokeStyle = w.col; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(nockX, drawHand.y); ctx.lineTo(grip.x + 9, grip.y); ctx.stroke();
          ctx.fillStyle = "#b8bcc4";
          ctx.beginPath(); ctx.moveTo(grip.x + 9, grip.y - 1.6); ctx.lineTo(grip.x + 12.5, grip.y); ctx.lineTo(grip.x + 9, grip.y + 1.6); ctx.closePath(); ctx.fill();
        }
      } else {
        limb(backSh.x, backSh.y, backSh.x - 2, backSh.y + 11, "#d3ac82", 2.5);
      }
      drawBow(grip.x, grip.y, aim, pull, shoot && shoot.phase === "draw" ? drawHand : null, heldBowLook(player.weapon, w));
      limb(frontSh.x, frontSh.y, grip.x, grip.y, "#d3ac82", 2.6);
    }
  } else {
    const upgCount = (player.weaponUpgrades || []).length;
    const castT = clamp((player.castAnim || 0) / 0.55, 0, 1);
    const castP = 1 - castT;
    const pulse = castT > 0 ? Math.sin(castP * Math.PI) : 0;
    const book = { x: px + 9 + pulse * 6, y: groundY - 22 - pulse * 10 };
    const channel = { x: px + 18 + pulse * 8, y: groundY - 31 - pulse * 5 };
    drawPlayerWeaponArm(px - 5, groundY - 28, book.x - 5, book.y + 5, 2.7);
    drawPlayerWeaponArm(px + 5, groundY - 28, channel.x, channel.y, 2.8);
    if (pulse > 0 || upgCount > 0) {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.18 + pulse * 0.34 + upgCount * 0.035;
      ctx.strokeStyle = w.col; ctx.lineWidth = 2.2;
      for (let r = 0; r < 2; r++) {
        ctx.beginPath(); ctx.arc(channel.x, channel.y, 9 + r * 8 + pulse * 8, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.save(); ctx.translate(book.x, book.y); ctx.rotate(-0.18 + pulse * 0.22);
    drawTomeModel(player.weapon, w.col, 0.68, { open: 0.45 + pulse * 0.55, glow: pulse + upgCount * 0.08 });
    ctx.restore();
  }
  ctx.restore();
}
