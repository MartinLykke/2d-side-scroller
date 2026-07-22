import { ctx, groundY } from '../../core/canvas.js';
import { drawBoot } from '../DrawHelpers.js';
import { biomeHumanoidSkin, unitSkinVariant } from '../BiomeHumanoidSkins.js';

const C = {
  robe: "#d9d2b6",
  robeLt: "#f0ead1",
  robeDk: "#756b68",
  sash: "#2f7a69",
  sashLt: "#65b99d",
  pants: "#514b48",
  boots: "#302823",
  skin: "#d2aa7f",
  hair: "#6b533d",
  wood: "#70512e",
  gold: "#e0bd58",
  glow: "#8fe8c2",
};

const BIOME_COLORS = {
  frozen: { robe: "#dcecf0", robeLt: "#f7fdff", robeDk: "#728591", sash: "#4d9eb8", sashLt: "#8ee4ef", glow: "#a8f2ff" },
  desert: { robe: "#ddc28c", robeLt: "#f0d9a4", robeDk: "#8a6340", sash: "#278c86", sashLt: "#62c5ba", glow: "#7fe6cc" },
  swamp: { robe: "#899078", robeLt: "#aeb99a", robeDk: "#4c5442", sash: "#677e3c", sashLt: "#a8c864", glow: "#b9dc78" },
  volcano: { robe: "#70473d", robeLt: "#956052", robeDk: "#332828", sash: "#b4472c", sashLt: "#f07845", glow: "#ff9a55" },
  corrupted: { robe: "#57465f", robeLt: "#806493", robeDk: "#292231", sash: "#7445a0", sashLt: "#bd78e8", glow: "#b784ff" },
};

function limb(x1, y1, x2, y2, col, width) {
  ctx.strokeStyle = col;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.lineCap = "butt";
}

function drawStaff(x, y, P, cast) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.14 - cast * 0.2);
  ctx.strokeStyle = P.wood;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, 17); ctx.lineTo(0, -17); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.strokeStyle = P.gold;
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(0, -21, 5, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = P.glow;
  ctx.beginPath(); ctx.arc(0, -21, 2.2 + cast * 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawCleric(u) {
  const t = performance.now() / 1000;
  const moving = !!u.moving;
  const anim = u.anim || 0;
  const base = biomeHumanoidSkin("cleric", u.x, C, unitSkinVariant(u));
  const P = { ...base, ...(BIOME_COLORS[base.biomeId] || {}) };
  const cast = Math.max(0, u.healFlash || 0) / 0.58;
  const bob = moving ? Math.abs(Math.sin(anim)) * 1.25 : Math.sin(t * 1.7 + u.x * 0.02) * 0.45 + 0.45;
  const hipY = groundY - 17 - bob * 0.35;
  const shY = groundY - 30 - bob;
  const headY = groundY - 38 - bob;
  const stride = moving ? Math.sin(anim) * 5 : 0;

  ctx.save();
  ctx.translate(u.x, 0);
  if (u.dir < 0) ctx.scale(-1, 1);

  limb(-3, hipY, -3 + stride, groundY - 4, P.pants, 3.1);
  drawBoot(-3 + stride, groundY, P.boots, 0.95);
  limb(3, hipY, 3 - stride, groundY - 4, P.pants, 3.1);
  drawBoot(3 - stride, groundY, P.boots, 0.95);

  ctx.fillStyle = P.robeDk;
  ctx.beginPath(); ctx.moveTo(-5, shY + 2); ctx.lineTo(5, shY + 2); ctx.lineTo(8, groundY - 4); ctx.lineTo(-8, groundY - 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.robe;
  ctx.beginPath(); ctx.moveTo(-5.8, shY); ctx.lineTo(5.8, shY); ctx.lineTo(5, hipY + 5); ctx.lineTo(-5, hipY + 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.robeLt;
  ctx.beginPath(); ctx.moveTo(-4.7, shY + 1); ctx.lineTo(-1.2, shY + 1); ctx.lineTo(-2, hipY + 4); ctx.lineTo(-4.4, hipY + 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.sash;
  ctx.beginPath(); ctx.moveTo(-4, shY + 3); ctx.lineTo(-1.7, shY + 1); ctx.lineTo(5.5, hipY + 5); ctx.lineTo(3.2, hipY + 7); ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.sashLt;
  ctx.fillRect(-5, hipY - 1, 10, 2);

  ctx.fillStyle = P.skin;
  ctx.beginPath(); ctx.arc(0, headY, 4.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.hair;
  ctx.beginPath(); ctx.arc(-0.5, headY - 1.6, 4.5, Math.PI * 0.92, Math.PI * 2.02); ctx.fill();
  ctx.fillStyle = P.robeLt;
  ctx.beginPath(); ctx.arc(0, headY - 3.6, 5.5, Math.PI, 0); ctx.lineTo(4.5, headY - 0.5); ctx.lineTo(-4.5, headY - 0.5); ctx.closePath(); ctx.fill();

  const staffHandY = shY + 8 - cast * 2;
  limb(4.5, shY + 2, 9, staffHandY, P.skin, 2.5);
  drawStaff(10, staffHandY, P, cast);
  const openHandX = -8 - cast * 3;
  limb(-4.5, shY + 2, openHandX, shY + 8 - cast * 4, P.skin, 2.5);

  if (cast > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = cast * 0.65;
    const glow = ctx.createRadialGradient(10, staffHandY - 21, 1, 10, staffHandY - 21, 22);
    glow.addColorStop(0, P.glow);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(10, staffHandY - 21, 22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  if (P.hollow) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = P.rune; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, shY + 9, 3, 0.2, Math.PI * 1.8); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
