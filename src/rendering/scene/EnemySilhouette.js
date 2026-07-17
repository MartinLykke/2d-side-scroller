import { ctx, groundY } from '../../core/canvas.js';
import { roundedRect } from '../DrawHelpers.js';

const TAU = Math.PI * 2;

export function shouldDrawEnemySilhouette(e, t, budget) {
  if (!budget || budget.enemySpriteDetail >= 2) return false;
  if (!e || !t || t.boss || t.legendary || e.dying || e.hunterMark > 0) return false;
  return e.type === "imp" || e.type === "fireImp";
}

function drawBurnHint(e, y) {
  if (!(e.burn > 0)) return;
  const pulse = 0.6 + 0.25 * Math.sin((e.anim || 0) * 8 + e.x);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.35 * pulse;
  ctx.fillStyle = "#ff6a20";
  ctx.beginPath();
  ctx.ellipse(0, y - 8, 10, 15, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawFastImp(e, t, dark) {
  const w = t.w;
  const flash = e.flash > 0 && !e.dying;
  const bob = Math.abs(Math.sin((e.anim || 0) * 2.8)) * 1.8;
  const step = Math.sin((e.anim || 0) * 3.1);
  const body = flash ? "#ffffff" : t.color || "#932319";
  const shade = flash ? "#ffffff" : "#551018";
  const eye = t.eye || "#ffd060";

  drawBurnHint(e, groundY - bob);

  ctx.strokeStyle = shade;
  ctx.lineWidth = Math.max(2, w * 0.11);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-w * 0.18, groundY - 8 - bob);
  ctx.lineTo(-w * 0.26 + step * 3, groundY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.18, groundY - 8 - bob);
  ctx.lineTo(w * 0.24 - step * 3, groundY);
  ctx.stroke();
  ctx.lineCap = "butt";

  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.moveTo(-w * 0.22, groundY - 15 - bob);
  ctx.quadraticCurveTo(-w * 0.72, groundY - 24 - bob, -w * 0.42, groundY - 7 - bob);
  ctx.strokeStyle = shade;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = body;
  roundedRect(-w * 0.34, groundY - w - 5 - bob, w * 0.68, w + 6, w * 0.24);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  roundedRect(-w * 0.34, groundY - w - 5 - bob, w * 0.24, w + 6, w * 0.18);
  ctx.fill();

  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.moveTo(-w * 0.18, groundY - w - 2 - bob);
  ctx.lineTo(-w * 0.08, groundY - w - 13 - bob);
  ctx.lineTo(w * 0.01, groundY - w - 2 - bob);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.08, groundY - w - 2 - bob);
  ctx.lineTo(w * 0.2, groundY - w - 12 - bob);
  ctx.lineTo(w * 0.24, groundY - w - 1 - bob);
  ctx.fill();

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.55 + dark * 0.25;
  ctx.fillStyle = eye;
  ctx.beginPath();
  ctx.arc(w * 0.08, groundY - w * 0.56 - bob, w * 0.1, 0, TAU);
  ctx.arc(w * 0.24, groundY - w * 0.54 - bob, w * 0.08, 0, TAU);
  ctx.fill();
  ctx.restore();

  if (e.carry > 0) {
    ctx.fillStyle = "#f2c14e";
    ctx.beginPath();
    ctx.arc(0, groundY - w - 13 - bob, 4, 0, TAU);
    ctx.fill();
  }
}

function drawFastFlyingImp(e, t, dark) {
  const w = t.w;
  const flash = e.flash > 0 && !e.dying;
  const y = groundY - w * 0.62;
  const flap = Math.sin((e.anim || 0) * 5);
  const body = flash ? "#ffffff" : t.color || "#9b2418";
  const wing = flash ? "#ffffff" : "#431018";
  const eye = t.eye || "#ffd060";

  drawBurnHint(e, y);

  ctx.fillStyle = wing;
  ctx.beginPath();
  ctx.moveTo(-w * 0.18, y - 4);
  ctx.lineTo(-w * 1.08, y - 13 - flap * 8);
  ctx.lineTo(-w * 0.46, y + 9);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.1, y - 3);
  ctx.lineTo(w * 0.88, y - 9 + flap * 7);
  ctx.lineTo(w * 0.42, y + 8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, y + 3, w * 0.34, w * 0.42, -0.18, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.ellipse(w * 0.08, y + 5, w * 0.14, w * 0.22, -0.12, 0, TAU);
  ctx.fill();

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(w * 0.23, y - w * 0.24, w * 0.22, 0, TAU);
  ctx.fill();
  ctx.fillStyle = wing;
  ctx.beginPath();
  ctx.moveTo(w * 0.1, y - w * 0.43);
  ctx.lineTo(-w * 0.1, y - w * 0.72);
  ctx.lineTo(w * 0.18, y - w * 0.49);
  ctx.fill();

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.6 + dark * 0.25;
  ctx.fillStyle = eye;
  ctx.beginPath();
  ctx.arc(w * 0.25, y - w * 0.26, w * 0.08, 0, TAU);
  ctx.arc(w * 0.39, y - w * 0.24, w * 0.065, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawEnemySilhouette(e, t, dark) {
  if (e.type === "fireImp" || t.flying) drawFastFlyingImp(e, t, dark);
  else drawFastImp(e, t, dark);
}
