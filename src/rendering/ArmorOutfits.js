// Full-body armor outfits. Equipping armor no longer swaps just the chest
// plate — it reskins the entire player model. Each entry overrides the base
// palette keys used by sprites/Player.js (cape, cuirass, tabard, legs, boots,
// belt, trims); `gloves` turns the bare arms into gauntlets, `longCloak`
// switches the short royal cape into a floor-length cloak, `headgear` picks
// the climb-pose hat, and `aura` enables a whole-body ambient effect.
// drawHelmet() adds the matching helmet on the head and returns how far the
// ember crown must lift to sit above it.
import { ctx } from '../core/canvas.js';
import { clamp } from '../util/math.js';

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
  const b = clamp(Math.round((n & 255) * f), 0, 255);
  return `rgb(${r},${g},${b})`;
}

const OUTFITS = {
  // leather_cap is head-only: no body override, keeps the royal look.
  studded_vest: {
    pants: "#4a3520", boots: "#2e2118",
    armor: "#6a4a28", armorLt: "#8a6538", armorDk: "#3a2814",
    tabard: "#59422a", tabardDk: "#40301e",
    leather: "#3a2a18",
    headgear: "helm",
  },
  chainmail: {
    pants: "#4a4438", boots: "#332a20",
    armor: "#767c88", armorLt: "#a4aab6", armorDk: "#484c56",
    tabard: "#7a2430", tabardDk: "#571722",
    gloves: "#8a90a0",
    headgear: "helm",
  },
  scale_armor: {
    pants: "#3c4432", boots: "#2a3122",
    armor: "#5a7a4a", armorLt: "#7c9c6a", armorDk: "#374e2c",
    tabard: "#49573c", tabardDk: "#343f2b",
    gloves: "#4b6340",
    cape: "#3f5c36", capeDk: "#2a4024", capeLt: "#6f9160",
    headgear: "helm",
  },
  plate_chestplate: {
    pants: "#5a6068", boots: "#3c4048",
    armor: "#909098", armorLt: "#bcbcc4", armorDk: "#54545e",
    tabard: "#3a4a7a", tabardDk: "#293656",
    gloves: "#8a8a94",
    headgear: "helm",
  },
  shadow_cloak: {
    pants: "#2a1a3e", boots: "#1b1128",
    armor: "#3a2154", armorLt: "#5a3a80", armorDk: "#241238",
    tabard: "#31184a", tabardDk: "#200f30",
    leather: "#241534",
    gold: "#cfd3d9", goldDk: "#8a8f9a",
    gloves: "#32204a",
    cape: "#5a3080", capeDk: "#31184a", capeLt: "#a06ae0", longCloak: true,
    headgear: "hood", aura: true,
  },
  dragon_scale: {
    pants: "#5a2410", boots: "#38160a",
    armor: "#9a4a1a", armorLt: "#c86a2a", armorDk: "#5c2a0e",
    tabard: "#7a3010", tabardDk: "#521f08",
    leather: "#3f1d0c",
    gold: "#e8a030", goldDk: "#8a5a14",
    gloves: "#7c3a14",
    cape: "#6a1a10", capeDk: "#40100a", capeLt: "#d86a30", longCloak: true,
    headgear: "helm", aura: true,
  },
  void_armor: {
    pants: "#1e1030", boots: "#130a20",
    armor: "#191026", armorLt: "#3a2158", armorDk: "#0d0716",
    tabard: "#241536", tabardDk: "#150c22",
    leather: "#1c1028",
    gold: "#8a55e8", goldDk: "#5a35a0",
    gloves: "#241536",
    cape: "#3c2360", capeDk: "#1e1030", capeLt: "#8a55e8", longCloak: true,
    headgear: "helm", aura: true,
  },
  sun_plate: {
    pants: "#8a6a1e", boots: "#655010",
    armor: "#d4a820", armorLt: "#ffe08a", armorDk: "#8a6a14",
    tabard: "#f0e2ba", tabardDk: "#c8b088",
    leather: "#7a5c16",
    gold: "#fff2c0", goldDk: "#a87a14",
    gloves: "#c89a2a",
    cape: "#e8c860", capeDk: "#b08e2c", capeLt: "#fff2c0", longCloak: true,
    headgear: "helm", aura: true,
  },
};

export function armorOutfit(armorId) {
  return OUTFITS[armorId] || null;
}

// ---------- Helmets ----------
// All drawn at the head center (x, y), head radius 4.8, facing +x.
// Each returns the extra lift for the ember crown drawn on top.

function drawLeatherCapHelm(x, y) {
  const col = "#8a6a3a", dk = shade(col, 0.6);
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(x - 0.3, y - 1.2, 5.35, Math.PI * 0.86, Math.PI * 2.14); ctx.fill();
  // back neck-guard flap
  ctx.fillStyle = shade(col, 0.8);
  ctx.beginPath();
  ctx.moveTo(x - 5.2, y - 1);
  ctx.quadraticCurveTo(x - 6.4, y + 2.4, x - 4.6, y + 4.4);
  ctx.lineTo(x - 3.2, y + 2.2);
  ctx.quadraticCurveTo(x - 4.4, y + 0.8, x - 4.2, y - 1.4);
  ctx.closePath(); ctx.fill();
  // brim + stitches
  ctx.strokeStyle = dk; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x - 0.3, y - 1.1, 5.1, Math.PI * 0.92, Math.PI * 2.1); ctx.stroke();
  ctx.strokeStyle = "#e8d8a8"; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(x - 2.4, y - 5.6); ctx.quadraticCurveTo(x, y - 6.4, x + 2.4, y - 5.6); ctx.stroke();
  ctx.fillStyle = "#c84a36";
  ctx.beginPath();
  ctx.moveTo(x - 3.6, y - 5.4);
  ctx.quadraticCurveTo(x - 8.2, y - 9.2, x - 9.8, y - 5.4);
  ctx.quadraticCurveTo(x - 7.4, y - 6.3, x - 4.2, y - 4.5);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#f0d08a"; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(x - 4.4, y - 5.3); ctx.quadraticCurveTo(x - 7.2, y - 7.1, x - 9, y - 5.6); ctx.stroke();
  return 0.5;
}

function drawStuddedCapHelm(x, y) {
  const col = "#6a4a28", dk = shade(col, 0.58), lt = shade(col, 1.3);
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(x - 0.3, y - 1.2, 5.4, Math.PI * 0.88, Math.PI * 2.12); ctx.fill();
  // panel seam + sheen
  ctx.strokeStyle = dk; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x - 0.2, y - 6.5); ctx.quadraticCurveTo(x, y - 4, x - 0.1, y - 1.6); ctx.stroke();
  ctx.strokeStyle = "rgba(255,235,190,0.18)"; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(x - 1.2, y - 2.2, 3.6, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
  // reinforced brim band with brass rivets
  ctx.fillStyle = dk;
  ctx.beginPath(); ctx.arc(x - 0.3, y - 1.2, 5.4, Math.PI * 0.9, Math.PI * 2.1); ctx.arc(x - 0.3, y - 1.2, 3.9, Math.PI * 2.1, Math.PI * 0.9, true); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#d8c48a";
  for (let k = 0; k < 4; k++) {
    const a = Math.PI * (1.08 + k * 0.28);
    ctx.beginPath(); ctx.arc(x - 0.3 + Math.cos(a) * 4.6, y - 1.2 + Math.sin(a) * 4.6, 0.55, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = lt;
  ctx.beginPath(); ctx.arc(x - 0.3, y - 6.4, 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(col, 0.72);
  ctx.beginPath();
  ctx.moveTo(x + 3.7, y - 1.8);
  ctx.quadraticCurveTo(x + 6.5, y - 0.2, x + 5.2, y + 3.5);
  ctx.lineTo(x + 3.5, y + 2.4);
  ctx.quadraticCurveTo(x + 4.4, y + 0.2, x + 3.7, y - 1.8);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#d8c48a";
  ctx.beginPath(); ctx.arc(x + 4.7, y + 0.8, 0.45, 0, Math.PI * 2); ctx.fill();
  return 0.5;
}

function drawChainCoifHelm(x, y) {
  const col = "#888898", dk = shade(col, 0.55), lt = shade(col, 1.35);
  // full coif wrapping skull and neck
  const hood = () => {
    ctx.beginPath();
    ctx.arc(x - 0.4, y - 0.7, 5.6, 0, Math.PI * 2);
    ctx.moveTo(x - 5.8, y - 0.5);
    ctx.lineTo(x - 6.2, y + 4.8);
    ctx.lineTo(x + 3.6, y + 4.8);
    ctx.lineTo(x + 4.9, y + 0.5);
    ctx.closePath();
  };
  ctx.fillStyle = shade(col, 0.82);
  hood(); ctx.fill();
  ctx.save(); hood(); ctx.clip();
  for (let j = 0; j < 6; j++) {
    const off = (j % 2) * 0.9;
    for (let i = 0; i < 8; i++) {
      ctx.strokeStyle = ((i + j) % 3 === 0) ? lt : dk;
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.arc(x - 6 + off + i * 1.8, y - 5.4 + j * 1.9, 0.95, 0.15, Math.PI - 0.15); ctx.stroke();
    }
  }
  ctx.restore();
  // face opening — redraw the face inside it
  ctx.fillStyle = "#d3ac82";
  ctx.beginPath(); ctx.ellipse(x + 2, y - 0.2, 2.5, 3.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2d2116";
  ctx.beginPath(); ctx.arc(x + 1.8, y - 0.6, 0.75, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = dk; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(x + 2, y - 0.2, 2.6, 3.2, 0, 0, Math.PI * 2); ctx.stroke();
  // steel brow band
  ctx.strokeStyle = "#b8bcc4"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(x - 0.4, y - 0.9, 5.1, Math.PI * 1.16, Math.PI * 1.88); ctx.stroke();
  ctx.strokeStyle = lt; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(x - 0.8, y - 6.4); ctx.lineTo(x - 0.8, y - 1.1); ctx.stroke();
  ctx.fillStyle = "#b8bcc4";
  ctx.beginPath();
  ctx.moveTo(x + 3.1, y - 4.7);
  ctx.lineTo(x + 4.3, y - 0.7);
  ctx.lineTo(x + 2.5, y + 3.5);
  ctx.lineTo(x + 1.6, y - 0.8);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = dk; ctx.lineWidth = 0.6; ctx.stroke();
  return 0.5;
}

function drawScaleHelm(x, y) {
  const col = "#5a7a4a", dk = shade(col, 0.5), lt = shade(col, 1.3);
  // back-swept crest fin first so the dome overlaps its root
  ctx.fillStyle = shade(col, 0.72);
  ctx.beginPath();
  ctx.moveTo(x + 2.6, y - 5.2);
  ctx.lineTo(x + 0.8, y - 9);
  ctx.lineTo(x - 0.8, y - 6.2);
  ctx.lineTo(x - 2.6, y - 9.6);
  ctx.lineTo(x - 4, y - 5.8);
  ctx.lineTo(x - 5.6, y - 7.6);
  ctx.lineTo(x - 5.8, y - 3.6);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = lt; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(x + 2.2, y - 5.4); ctx.lineTo(x + 0.8, y - 8.4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 1.2, y - 6.4); ctx.lineTo(x - 2.5, y - 9); ctx.stroke();
  // scaled dome
  ctx.fillStyle = shade(col, 0.85);
  ctx.beginPath(); ctx.arc(x - 0.3, y - 1, 5.5, Math.PI * 0.86, Math.PI * 2.14); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(x - 0.3, y - 1, 5.5, Math.PI * 0.86, Math.PI * 2.14); ctx.clip();
  for (let j = 0; j < 3; j++) {
    const rowCol = shade(col, 1.15 - j * 0.15);
    for (let i = 0; i < 5; i++) {
      const sx = x - 5 + (j % 2) * 1.3 + i * 2.6, sy = y - 5.2 + j * 2.1;
      ctx.fillStyle = rowCol;
      ctx.beginPath(); ctx.arc(sx, sy, 1.35, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.arc(sx, sy, 1.35, 0, Math.PI); ctx.stroke();
    }
  }
  ctx.restore();
  // brass brow band + front cheek guard
  ctx.strokeStyle = "#c8a24e"; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(x - 0.3, y - 1, 5.1, Math.PI * 0.95, Math.PI * 2.06); ctx.stroke();
  ctx.fillStyle = shade(col, 0.78);
  ctx.beginPath();
  ctx.moveTo(x + 3.3, y - 1.6);
  ctx.quadraticCurveTo(x + 5.6, y - 0.4, x + 4.9, y + 2.8);
  ctx.lineTo(x + 3.2, y + 2.2);
  ctx.quadraticCurveTo(x + 3.9, y + 0.2, x + 3.3, y - 1.6);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#c8a24e"; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(x + 3.5, y - 1.2); ctx.quadraticCurveTo(x + 5.1, y - 0.2, x + 4.6, y + 2.4); ctx.stroke();
  shoulderSpike(x - 2.6, y - 4.8, x - 8.4, y - 7.9, 1.1, shade(col, 0.82), "#c8a24e");
  shoulderSpike(x + 1.6, y - 5.1, x + 6.9, y - 8.7, 1.0, shade(col, 0.88), "#c8a24e");
  return 3.5;
}

function drawGreathelm(x, y) {
  const col = "#909098", dk = shade(col, 0.55), lt = shade(col, 1.3);
  const t = performance.now() / 1000;
  // flowing red plume behind the dome
  const sway = Math.sin(t * 2.1) * 0.7;
  ctx.lineCap = "round";
  const plume = [["#5c1420", 3.2, 0], ["#8f2031", 2.4, 0.6], ["#d45555", 1.2, 1.1]];
  for (const [pc, pw, po] of plume) {
    ctx.strokeStyle = pc; ctx.lineWidth = pw;
    ctx.beginPath();
    ctx.moveTo(x - 0.6, y - 6.2);
    ctx.quadraticCurveTo(x - 4 + sway, y - 10 - po, x - 8.5 + sway, y - 6.5 - po);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  // full-face helm: dome + flat cheeks to the jaw
  const helm = () => {
    ctx.beginPath();
    ctx.moveTo(x - 5.4, y + 4.6);
    ctx.lineTo(x - 5.5, y - 1.6);
    ctx.bezierCurveTo(x - 5.5, y - 6.8, x + 5, y - 6.8, x + 5.2, y - 1.6);
    ctx.lineTo(x + 5.1, y + 3.4);
    ctx.quadraticCurveTo(x + 4.2, y + 4.8, x + 2.4, y + 4.9);
    ctx.closePath();
  };
  const grad = ctx.createLinearGradient(x - 5.5, y, x + 5.2, y);
  grad.addColorStop(0, shade(col, 0.72)); grad.addColorStop(0.55, col); grad.addColorStop(1, lt);
  ctx.fillStyle = grad;
  helm(); ctx.fill();
  ctx.strokeStyle = dk; ctx.lineWidth = 0.9; helm(); ctx.stroke();
  ctx.save(); helm(); ctx.clip();
  // crest ridge + rivet seam
  ctx.strokeStyle = lt; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x - 0.4, y - 6.8); ctx.quadraticCurveTo(x + 0.4, y - 3, x + 0.2, y + 0.5); ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.28)"; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x - 5.5, y + 0.6); ctx.lineTo(x + 5.2, y + 0.6); ctx.stroke();
  ctx.fillStyle = "#e8e8f0";
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x - 4 + k * 2.7, y + 1.8, 0.4, 0, Math.PI * 2); ctx.fill(); }
  // eye slit — dark with a light lower lip
  ctx.fillStyle = "#14141c";
  ctx.fillRect(x - 0.2, y - 1.9, 5.2, 1.5);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(x - 0.2, y - 0.4, 5.2, 0.5);
  // breathing holes
  ctx.fillStyle = "#2a2a34";
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x + 2 + (k % 2) * 1.5, y + 2.2 + k * 0.95, 0.42, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = shade(col, 0.82);
  ctx.beginPath();
  ctx.moveTo(x - 4.8, y - 3.7);
  ctx.quadraticCurveTo(x - 9.2, y - 5.1, x - 11.1, y - 1.9);
  ctx.quadraticCurveTo(x - 8.2, y - 1.1, x - 5.1, y + 0.9);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = lt; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(x - 5.4, y - 3.1); ctx.quadraticCurveTo(x - 8.4, y - 3.6, x - 10.3, y - 2.0); ctx.stroke();
  return 2.5;
}

function drawShadowHood(x, y) {
  const t = performance.now() / 1000;
  const col = "#3a2154", dk = shade(col, 0.55), lt = "#a06ae0";
  // deep hood with a ragged back hem
  ctx.fillStyle = dk;
  ctx.beginPath();
  ctx.moveTo(x + 4.4, y + 3.2);
  ctx.quadraticCurveTo(x + 5.6, y - 2.4, x + 2.4, y - 5.8);
  ctx.bezierCurveTo(x - 1, y - 8.6, x - 6, y - 6.4, x - 6.6, y - 1.4);
  ctx.quadraticCurveTo(x - 7, y + 2, x - 5.8, y + 4.6);
  ctx.lineTo(x - 4.2, y + 3.2);
  ctx.lineTo(x - 2.8, y + 5.2);
  ctx.lineTo(x - 1, y + 3.4);
  ctx.closePath(); ctx.fill();
  // inner rim
  ctx.strokeStyle = col; ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(x + 3.8, y + 2.6);
  ctx.quadraticCurveTo(x + 4.8, y - 2, x + 2, y - 5);
  ctx.stroke();
  // face swallowed by darkness
  ctx.fillStyle = "#0a0612";
  ctx.beginPath(); ctx.ellipse(x + 1.2, y - 0.6, 3.3, 3.7, -0.1, 0, Math.PI * 2); ctx.fill();
  // burning eyes
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 3.1);
  ctx.fillStyle = lt;
  ctx.beginPath(); ctx.arc(x + 0.4, y - 1.1, 0.62, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 2.8, y - 1.1, 0.62, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha *= 0.5;
  ctx.beginPath(); ctx.arc(x + 0.4, y - 1.1, 1.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 2.8, y - 1.1, 1.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // silver clasp under the chin
  ctx.fillStyle = "#cfd3d9";
  ctx.beginPath(); ctx.moveTo(x + 2.4, y + 2.6); ctx.lineTo(x + 3.4, y + 3.6); ctx.lineTo(x + 2.4, y + 4.6); ctx.lineTo(x + 1.4, y + 3.6); ctx.closePath(); ctx.fill();
  shoulderSpike(x - 2.6, y - 5.2, x - 5.8, y - 10.8, 1.05, "#241238", lt);
  shoulderSpike(x + 1.3, y - 5.1, x + 3.7, y - 10.1, 0.95, "#241238", lt);
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.18 + 0.12 * Math.sin(t * 2.7);
  ctx.fillStyle = lt;
  ctx.beginPath(); ctx.arc(x - 1.2, y - 8.6, 2.8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  return 2;
}

function drawDrakeHelm(x, y) {
  const t = performance.now() / 1000;
  const col = "#7a3210", dk = shade(col, 0.5);
  // swept-back bone horns behind the dome
  const horn = (x0, y0, cx1, cy1, x1, y1, w0) => {
    ctx.fillStyle = "#c8b088";
    ctx.beginPath();
    ctx.moveTo(x0, y0 + w0);
    ctx.quadraticCurveTo(cx1, cy1 + w0 * 0.5, x1, y1);
    ctx.quadraticCurveTo(cx1, cy1 - w0 * 0.5, x0, y0 - w0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#6a5230"; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(x0, y0 + w0 * 0.4); ctx.quadraticCurveTo(cx1, cy1, x1, y1); ctx.stroke();
  };
  horn(x - 2, y - 4.6, x - 5.5, y - 8.5, x - 8.2, y - 11.4, 1.5);
  horn(x + 1.8, y - 4.9, x - 0.4, y - 9.5, x - 2.4, y - 13, 1.3);
  // scaled dome
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(x - 0.3, y - 1, 5.5, Math.PI * 0.85, Math.PI * 2.15); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(x - 0.3, y - 1, 5.5, Math.PI * 0.85, Math.PI * 2.15); ctx.clip();
  for (let j = 0; j < 3; j++) {
    const rowCol = shade("#9a4a1a", 1.1 - j * 0.16);
    for (let i = 0; i < 5; i++) {
      const sx = x - 5 + (j % 2) * 1.3 + i * 2.6, sy = y - 5.4 + j * 2.1;
      ctx.fillStyle = rowCol;
      ctx.beginPath(); ctx.arc(sx, sy, 1.3, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = "rgba(30,10,4,0.4)"; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.arc(sx, sy, 1.3, 0, Math.PI); ctx.stroke();
    }
  }
  ctx.restore();
  // snout guard over the brow
  ctx.fillStyle = dk;
  ctx.beginPath();
  ctx.moveTo(x + 3, y - 3.2);
  ctx.quadraticCurveTo(x + 6.2, y - 1.8, x + 5.6, y + 0.8);
  ctx.lineTo(x + 3.8, y + 1.4);
  ctx.quadraticCurveTo(x + 4.4, y - 1, x + 2.6, y - 2.2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#e8a030"; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(x + 3.2, y - 2.6); ctx.quadraticCurveTo(x + 5.7, y - 1.4, x + 5.2, y + 0.6); ctx.stroke();
  // ember eye + hot nostril
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.65 + 0.3 * Math.sin(t * 4.2);
  ctx.fillStyle = "#ff8a30";
  ctx.beginPath(); ctx.arc(x + 2.2, y - 0.7, 0.75, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha *= 0.45;
  ctx.beginPath(); ctx.arc(x + 2.2, y - 0.7, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 4.2 + 1.4);
  ctx.fillStyle = "#ffb050";
  ctx.beginPath(); ctx.arc(x + 5.2, y + 0.2, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  shoulderSpike(x - 4.2, y - 2.2, x - 8.8, y - 4.3, 1.2, "#5c2a0e", "#e8a030");
  shoulderSpike(x + 3.8, y - 2.4, x + 8.2, y - 4.8, 1.1, "#5c2a0e", "#e8a030");
  return 3;
}

function drawVoidHelm(x, y) {
  const t = performance.now() / 1000;
  const col = "#5a2a9a", lt = "#b07aff";
  // crystalline horns
  const spike = (x0, y0, x1, y1, w) => {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    const nx = (-dy / L) * w, ny = (dx / L) * w;
    ctx.fillStyle = "#241536";
    ctx.beginPath();
    ctx.moveTo(x0 + nx, y0 + ny); ctx.lineTo(x1, y1); ctx.lineTo(x0 - nx, y0 - ny);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 3 + x0);
    ctx.fillStyle = lt;
    ctx.beginPath(); ctx.arc(x1, y1, 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  spike(x - 3.6, y - 4.2, x - 7.6, y - 9.6, 1.6);
  spike(x + 3, y - 4.6, x + 5.8, y - 10.2, 1.4);
  // faceted obsidian helm
  const helm = () => {
    ctx.beginPath();
    ctx.moveTo(x - 5.4, y + 3.2);
    ctx.lineTo(x - 5.6, y - 2.6);
    ctx.lineTo(x - 2.2, y - 6.4);
    ctx.lineTo(x + 2.6, y - 6.2);
    ctx.lineTo(x + 5.6, y - 2.2);
    ctx.lineTo(x + 5.3, y + 2.4);
    ctx.lineTo(x + 3, y + 4.4);
    ctx.lineTo(x - 3, y + 4.5);
    ctx.closePath();
  };
  ctx.fillStyle = "#150c22";
  helm(); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 0.9; helm(); ctx.stroke();
  ctx.save(); helm(); ctx.clip();
  // facet lines
  ctx.strokeStyle = shade(col, 0.72); ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(x - 2.2, y - 6.4); ctx.lineTo(x - 0.6, y - 1.4); ctx.lineTo(x - 3, y + 4.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 2.6, y - 6.2); ctx.lineTo(x + 1.2, y - 1.6); ctx.lineTo(x + 3, y + 4.4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 5.6, y - 2.6); ctx.lineTo(x - 0.6, y - 1.4); ctx.stroke();
  // glowing eye slit
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.6 + 0.35 * Math.sin(t * 3.4);
  ctx.fillStyle = lt;
  ctx.fillRect(x + 0.4, y - 1.7, 4.6, 1.15);
  ctx.globalAlpha *= 0.75;
  ctx.fillStyle = "#e8dcff";
  ctx.fillRect(x + 1.2, y - 1.45, 2.6, 0.6);
  ctx.restore();
  ctx.restore();
  // a void shard drifting above the crest
  const bobY = y - 10.6 + Math.sin(t * 2.2) * 0.9;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.55 + 0.3 * Math.sin(t * 2.6 + 1);
  ctx.fillStyle = lt;
  ctx.beginPath(); ctx.moveTo(x - 0.6, bobY - 1.5); ctx.lineTo(x + 0.4, bobY); ctx.lineTo(x - 0.6, bobY + 1.5); ctx.lineTo(x - 1.6, bobY); ctx.closePath(); ctx.fill();
  ctx.restore();
  for (let k = 0; k < 2; k++) {
    const sx = x + (k ? 3.6 : -4.2);
    const sy = y - 9.2 + Math.sin(t * 2.5 + k) * 0.7;
    shoulderSpike(sx, sy + 2.4, sx + (k ? 1.5 : -1.5), sy - 1.6, 0.7, "#241536", lt);
  }
  return 5;
}

function drawSunHelm(x, y) {
  const t = performance.now() / 1000;
  const col = "#d4a820", dk = shade(col, 0.6), lt = "#fff2c0";
  // halo behind the helm
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.4 + 0.14 * Math.sin(t * 2.2);
  ctx.strokeStyle = "#ffe9a0"; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.arc(x - 0.5, y - 1.6, 7.6, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha *= 0.55;
  ctx.save(); ctx.translate(x - 0.5, y - 1.6); ctx.rotate(t * 0.4);
  for (let k = 0; k < 8; k++) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath(); ctx.moveTo(7.6, 0); ctx.lineTo(9.6, 0); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
  // swept-back wing at the temple
  ctx.fillStyle = "#e8c14e";
  ctx.beginPath();
  ctx.moveTo(x - 1.4, y - 3.6);
  ctx.quadraticCurveTo(x - 6.5, y - 8.5, x - 9.4, y - 7.4);
  ctx.quadraticCurveTo(x - 7, y - 5.6, x - 6.4, y - 4);
  ctx.quadraticCurveTo(x - 4.4, y - 4.4, x - 3, y - 2.6);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = dk; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(x - 2.4, y - 3.8); ctx.quadraticCurveTo(x - 6, y - 6.8, x - 8.6, y - 6.9); ctx.stroke();
  ctx.fillStyle = lt;
  ctx.beginPath();
  ctx.moveTo(x - 2, y - 3.9);
  ctx.quadraticCurveTo(x - 5.4, y - 6.9, x - 7.6, y - 6.6);
  ctx.quadraticCurveTo(x - 5.4, y - 5.4, x - 4.6, y - 4.2);
  ctx.closePath(); ctx.fill();
  // golden dome + radiant face mask
  const helm = () => {
    ctx.beginPath();
    ctx.moveTo(x - 5.2, y + 3.8);
    ctx.lineTo(x - 5.4, y - 1.6);
    ctx.bezierCurveTo(x - 5.4, y - 6.9, x + 4.8, y - 6.9, x + 5.1, y - 1.6);
    ctx.lineTo(x + 5, y + 2.6);
    ctx.quadraticCurveTo(x + 4, y + 4.4, x + 2, y + 4.6);
    ctx.closePath();
  };
  const grad = ctx.createLinearGradient(x - 5.4, y - 6, x + 5, y + 4);
  grad.addColorStop(0, "#ffe08a"); grad.addColorStop(0.5, col); grad.addColorStop(1, "#a87a14");
  ctx.fillStyle = grad;
  helm(); ctx.fill();
  ctx.strokeStyle = dk; ctx.lineWidth = 0.8; helm(); ctx.stroke();
  ctx.save(); helm(); ctx.clip();
  // white-gold face plate with a serene slit
  ctx.fillStyle = lt;
  ctx.beginPath();
  ctx.moveTo(x + 1, y - 5.6); ctx.lineTo(x + 5.1, y - 2); ctx.lineTo(x + 5, y + 2.6);
  ctx.quadraticCurveTo(x + 4, y + 4.4, x + 2, y + 4.6); ctx.lineTo(x + 0.6, y + 4.4);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#8a5f0e"; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x + 1.4, y - 1.1); ctx.lineTo(x + 4.6, y - 1.1); ctx.stroke();
  // embossed sun on the crown of the dome
  ctx.fillStyle = lt;
  ctx.beginPath(); ctx.arc(x - 1.6, y - 4, 1.15, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#8a5f0e"; ctx.lineWidth = 0.5;
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3 + 0.3;
    ctx.beginPath();
    ctx.moveTo(x - 1.6 + Math.cos(a) * 1.5, y - 4 + Math.sin(a) * 1.5);
    ctx.lineTo(x - 1.6 + Math.cos(a) * 2.3, y - 4 + Math.sin(a) * 2.3);
    ctx.stroke();
  }
  // sweeping shine
  const sx = x - 6 + ((t * 9) % 13);
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.4;
  ctx.fillStyle = "#fffbe8"; ctx.fillRect(sx, y - 7, 1.1, 12);
  ctx.restore();
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.26 + 0.08 * Math.sin(t * 3);
  ctx.strokeStyle = lt; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.arc(x - 0.5, y - 1.6, 10.8, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  for (let k = 0; k < 5; k++) {
    const a = Math.PI * (1.1 + k * 0.18);
    ctx.beginPath();
    ctx.moveTo(x - 0.5 + Math.cos(a) * 10.3, y - 1.6 + Math.sin(a) * 10.3);
    ctx.lineTo(x - 0.5 + Math.cos(a) * 13.2, y - 1.6 + Math.sin(a) * 13.2);
    ctx.stroke();
  }
  ctx.restore();
  return 3.5;
}

export function drawHelmet(armorId, x, y) {
  switch (armorId) {
    case "leather_cap":      return drawLeatherCapHelm(x, y);
    case "studded_vest":     return drawStuddedCapHelm(x, y);
    case "chainmail":        return drawChainCoifHelm(x, y);
    case "scale_armor":      return drawScaleHelm(x, y);
    case "plate_chestplate": return drawGreathelm(x, y);
    case "shadow_cloak":     return drawShadowHood(x, y);
    case "dragon_scale":     return drawDrakeHelm(x, y);
    case "void_armor":       return drawVoidHelm(x, y);
    case "sun_plate":        return drawSunHelm(x, y);
  }
  return 0;
}

// ---------- Shoulders ----------
// Drawn after the base player pauldrons and before the arms, so the armor gets
// a stronger silhouette without hiding the weapon pose.
function pauldron(cx, cy, side, col, lt, dk, w = 8, h = 5) {
  ctx.fillStyle = dk;
  ctx.beginPath();
  ctx.moveTo(cx - side * 2.1, cy - h * 0.72);
  ctx.quadraticCurveTo(cx + side * w * 0.28, cy - h * 1.35, cx + side * w, cy - h * 0.25);
  ctx.lineTo(cx + side * (w * 0.82), cy + h * 0.85);
  ctx.quadraticCurveTo(cx + side * 1.5, cy + h * 1.15, cx - side * 2.2, cy + h * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(cx - side * 1.8, cy - h * 0.45);
  ctx.quadraticCurveTo(cx + side * w * 0.26, cy - h * 1.0, cx + side * (w * 0.82), cy - h * 0.08);
  ctx.lineTo(cx + side * (w * 0.64), cy + h * 0.48);
  ctx.quadraticCurveTo(cx + side * 1.2, cy + h * 0.78, cx - side * 1.8, cy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = lt;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx - side * 0.5, cy - h * 0.55);
  ctx.quadraticCurveTo(cx + side * w * 0.34, cy - h * 0.8, cx + side * w * 0.74, cy - h * 0.1);
  ctx.stroke();
}

function shoulderSpike(x0, y0, x1, y1, w, col, edge) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * w, ny = (dx / len) * w;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x0 + nx, y0 + ny);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x0 - nx, y0 - ny);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 0.7;
  ctx.stroke();
}

export function drawArmorShoulders(armorId, shX, shY, O = {}) {
  const t = performance.now() / 1000;
  const col = O.armor || "#596878";
  const lt = O.armorLt || shade(col, 1.25);
  const dk = O.armorDk || shade(col, 0.55);
  for (const side of [-1, 1]) {
    const sx = shX + side * 7.1;
    const sy = shY + 1.5;
    switch (armorId) {
      case "leather_cap":
        break;
      case "studded_vest": {
        pauldron(sx, sy, side, "#6a4a28", "#d8c48a", "#3a2814", 7.4, 4.5);
        ctx.fillStyle = "#e0c878";
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(sx + side * (1.5 + k * 2.0), sy - 2 + k * 1.1, 0.55, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "chainmail": {
        pauldron(sx, sy, side, "#8a90a0", "#dfe6f2", "#484c56", 7.6, 4.7);
        ctx.strokeStyle = "#cfd3d9";
        ctx.lineWidth = 0.65;
        for (let k = 0; k < 4; k++) {
          const x = sx + side * (1.2 + k * 1.7);
          ctx.beginPath();
          ctx.arc(x, sy + 4.2, 0.9, 0.1, Math.PI - 0.1);
          ctx.stroke();
        }
        break;
      }
      case "scale_armor": {
        pauldron(sx, sy, side, "#5a7a4a", "#a0c37c", "#374e2c", 8.2, 5.2);
        ctx.fillStyle = "#7c9c6a";
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(sx + side * (1.5 + k * 2.4), sy + 1.2 + k * 0.7, 1.25, Math.PI, Math.PI * 2);
          ctx.fill();
        }
        shoulderSpike(sx + side * 5.5, sy - 1.8, sx + side * 10.5, sy - 5.8, 1.2, "#6f9160", "#c8a24e");
        break;
      }
      case "plate_chestplate": {
        pauldron(sx, sy, side, "#a8a8b2", "#ffffff", "#54545e", 9.4, 5.8);
        ctx.fillStyle = "rgba(255,255,255,0.34)";
        ctx.beginPath();
        ctx.ellipse(sx + side * 2.8, sy - 1.9, 3.6, 1.0, side * -0.25, 0, Math.PI * 2);
        ctx.fill();
        shoulderSpike(sx + side * 7.2, sy - 0.4, sx + side * 12.4, sy - 3.2, 1.0, "#bcbcc4", "#f2e6c8");
        break;
      }
      case "shadow_cloak": {
        ctx.save();
        ctx.globalAlpha = 0.88;
        pauldron(sx, sy + Math.sin(t * 1.8 + side) * 0.5, side, "#3a2154", "#a06ae0", "#16091f", 9.2, 6.2);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.2 + 0.1 * Math.sin(t * 3 + side);
        ctx.fillStyle = "#a06ae0";
        ctx.beginPath();
        ctx.arc(sx + side * 6.8, sy - 1.8, 4.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        shoulderSpike(sx + side * 4.2, sy - 2.8, sx + side * 8.8, sy - 8.5, 1.1, "#241238", "#8a5ad0");
        break;
      }
      case "dragon_scale": {
        pauldron(sx, sy, side, "#9a4a1a", "#ffad48", "#5c2a0e", 9.6, 6.0);
        shoulderSpike(sx + side * 3.8, sy - 2.4, sx + side * 8.8, sy - 9.2, 1.45, "#c8b088", "#6a5230");
        shoulderSpike(sx + side * 6.8, sy + 0.2, sx + side * 12.2, sy - 3.8, 1.25, "#7a3210", "#e8a030");
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.35 + 0.22 * Math.sin(t * 4 + side);
        ctx.fillStyle = "#ff8a30";
        ctx.beginPath();
        ctx.arc(sx + side * 4.8, sy + 1.8, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case "void_armor": {
        pauldron(sx, sy, side, "#241536", "#b07aff", "#08040f", 9.8, 6.3);
        shoulderSpike(sx + side * 2.8, sy - 2.2, sx + side * 5.5, sy - 10.4, 1.5, "#241536", "#b07aff");
        shoulderSpike(sx + side * 6.5, sy - 0.8, sx + side * 12.4, sy - 6.5, 1.35, "#150c22", "#8a55e8");
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.45 + 0.35 * Math.sin(t * 3.1 + side);
        ctx.fillStyle = "#d9c4ff";
        ctx.fillRect(sx + side * 7.2, sy - 4.8, 0.9, 0.9);
        ctx.restore();
        break;
      }
      case "sun_plate": {
        pauldron(sx, sy, side, "#d4a820", "#fff2c0", "#8a6a14", 10.2, 6.1);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.18 + 0.08 * Math.sin(t * 2.4);
        ctx.fillStyle = "#ffe080";
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(sx + side * (3 + k * 2.4), sy - 1.2 + k);
          ctx.lineTo(sx + side * (9 + k * 2.2), sy - 6.8 + k * 0.4);
          ctx.lineTo(sx + side * (7.6 + k * 1.8), sy - 0.5 + k);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle = "#fff2c0";
        ctx.beginPath();
        ctx.arc(sx + side * 3.8, sy - 1.8, 1.1, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }
}

// ---------- Whole-body auras ----------
// Drawn behind the player body (before the cape) so the outfit reads as a
// transformation, not a sticker. (cx, cy) is the torso center.
export function drawArmorAura(armorId, cx, cy) {
  const t = performance.now() / 1000;
  switch (armorId) {
    case "shadow_cloak": {
      ctx.save();
      ctx.globalAlpha = 0.16 + 0.05 * Math.sin(t * 1.9);
      const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 30);
      g.addColorStop(0, "#3a2154"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 4; k++) {
        const p = (t * 0.5 + k * 0.25) % 1;
        ctx.globalAlpha = (1 - p) * 0.32;
        ctx.fillStyle = "#a06ae0";
        ctx.beginPath();
        ctx.arc(cx - 10 + k * 6.4 + Math.sin(t * 1.8 + k * 2) * 2.5, cy + 16 - p * 34, 0.9 + p * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case "dragon_scale": {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.1 + 0.04 * Math.sin(t * 3.2);
      const g = ctx.createRadialGradient(cx, cy, 3, cx, cy, 26);
      g.addColorStop(0, "#ff8a30"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill();
      for (let k = 0; k < 5; k++) {
        const p = (t * 0.7 + k * 0.2) % 1;
        ctx.globalAlpha = (1 - p) * 0.45;
        ctx.fillStyle = k % 2 ? "#ffb050" : "#ff7a20";
        ctx.beginPath();
        ctx.arc(cx - 9 + k * 4.6 + Math.sin(t * 3 + k * 1.7) * 2, cy + 14 - p * 30, 0.7 + p * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case "void_armor": {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.14 + 0.06 * Math.sin(t * 2.6);
      const g = ctx.createRadialGradient(cx, cy, 3, cx, cy, 28);
      g.addColorStop(0, "#8a55e8"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI * 2); ctx.fill();
      // twinkling star motes orbiting the body
      for (let k = 0; k < 6; k++) {
        const a = t * 0.6 + k * (Math.PI / 3);
        const rx = 13 + Math.sin(t * 1.3 + k * 2.4) * 3;
        ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t * 2.2 + k * 1.9));
        ctx.fillStyle = k % 3 === 0 ? "#b07aff" : "#ffffff";
        ctx.fillRect(cx + Math.cos(a) * rx, cy + Math.sin(a) * rx * 1.35, 0.9, 0.9);
      }
      ctx.restore();
      break;
    }
    case "sun_plate": {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.13 + 0.05 * Math.sin(t * 2);
      const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 30);
      g.addColorStop(0, "#ffe9a0"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.fill();
      // slow-turning light rays
      ctx.globalAlpha = 0.06;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.25);
      ctx.fillStyle = "#ffdf80";
      for (let k = 0; k < 5; k++) {
        ctx.rotate((Math.PI * 2) / 5);
        ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(2.4, -27); ctx.lineTo(-2.4, -27); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      // drifting glints
      for (let k = 0; k < 3; k++) {
        const p = (t * 0.45 + k * 0.33) % 1;
        ctx.globalAlpha = Math.sin(p * Math.PI) * 0.5;
        ctx.fillStyle = "#fff8d8";
        const gx = cx - 8 + k * 8, gy = cy + 12 - p * 26;
        ctx.fillRect(gx - 1.4, gy, 2.8, 0.6);
        ctx.fillRect(gx - 0.3, gy - 1.1, 0.6, 2.8);
      }
      ctx.restore();
      break;
    }
  }
}
