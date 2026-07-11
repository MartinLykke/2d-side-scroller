import { ctx, groundY } from '../../core/canvas.js';
import { drawBoot } from '../DrawHelpers.js';

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

export function isClimbingEntity(e) {
  const t = e ? (e.wallClimbT || 0) : 0;
  return !!(e && e.wall && (e.climbingWall || (t > 0.03 && t < 0.98)));
}

export function drawClimbPose(e, palette, options = {}) {
  const p = {
    skin: palette.skin || "#d3ac82",
    tunic: palette.tunic || palette.gambeson || "#5d6652",
    tunicLt: palette.tunicLt || palette.gambesonLt || "#6f7a62",
    pants: palette.pants || "#443c30",
    boots: palette.boots || "#2e2118",
    belt: palette.belt || palette.strap || "#3a2a18",
    metal: palette.steel || palette.metal || "#9aa2ae",
    metalDk: palette.steelDk || palette.metalDk || "#68707d",
    gold: palette.buckle || palette.boss || palette.gold || "#d4a838",
    hair: palette.hair || palette.beard || "#3a2818",
    cloak: palette.cloak || "#2e5d34",
    cloakDk: palette.cloakDk || "#1f4426",
    accent: palette.accent || palette.cloakLt || palette.cap || "#8a6338",
  };

  const t = performance.now() / 1000;
  const phase = e.climbAnim || ((e.wallClimbT || 0) * 10 + t * 0.6);
  const step = Math.sin(phase * 2.1);
  const bob = Math.sin(phase * 4.2) * 0.8;
  const scale = options.scale || 1;
  const hipY = groundY - 17 - bob;
  const shY = groundY - 31 - bob;
  const headY = groundY - 39 - bob;

  ctx.save();
  if (scale !== 1) {
    ctx.translate(0, groundY);
    ctx.scale(scale, scale);
    ctx.translate(0, -groundY);
  }

  if (options.cape || options.cloak) {
    const sway = Math.sin(phase * 1.7) * 1.8;
    ctx.fillStyle = options.capeColor || p.cloakDk;
    ctx.beginPath();
    ctx.moveTo(-5, shY + 1);
    ctx.lineTo(5, shY + 1);
    ctx.quadraticCurveTo(8 + sway, shY + 13, 5, groundY - 4);
    ctx.lineTo(0, groundY - 7);
    ctx.lineTo(-5 - sway * 0.4, groundY - 3);
    ctx.quadraticCurveTo(-7, shY + 12, -5, shY + 1);
    ctx.closePath();
    ctx.fill();
  }

  if (options.ladderHint) {
    ctx.strokeStyle = "rgba(74,50,24,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-9, groundY + 2); ctx.lineTo(-9, groundY - 58); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9, groundY + 2); ctx.lineTo(9, groundY - 58); ctx.stroke();
    ctx.lineWidth = 1.5;
    for (let y = groundY - 7; y > groundY - 55; y -= 11) {
      ctx.beginPath(); ctx.moveTo(-9, y); ctx.lineTo(9, y); ctx.stroke();
    }
  }

  const leftHandY = shY - 9 + Math.max(0, step) * 13;
  const rightHandY = shY - 9 + Math.max(0, -step) * 13;
  const leftFootY = groundY - 6 - Math.max(0, -step) * 12;
  const rightFootY = groundY - 6 - Math.max(0, step) * 12;

  // Back limbs first so the torso reads in front of the ladder work.
  limb(-4.5, shY + 3, -7.5, leftHandY, p.skin, 2.7);
  limb(3, hipY, 6.5, rightFootY, p.pants, 3.1);
  limb(6.5, rightFootY, 8, rightFootY + 3, p.boots, 3.4);
  drawBoot(8, rightFootY + 5, p.boots, 0.82);

  ctx.fillStyle = p.tunic;
  ctx.beginPath();
  ctx.moveTo(-5.5, shY);
  ctx.lineTo(5.5, shY);
  ctx.lineTo(4.5, hipY + 4);
  ctx.lineTo(-4.5, hipY + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.tunicLt;
  ctx.fillRect(-4.5, shY + 1.5, 2.8, 7);

  if (options.armor) {
    ctx.fillStyle = p.metal;
    ctx.beginPath();
    ctx.moveTo(-4.8, shY + 1);
    ctx.lineTo(4.8, shY + 1);
    ctx.lineTo(3.7, hipY + 1);
    ctx.lineTo(-3.7, hipY + 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(-3.6, shY + 2, 1.8, 6);
  }

  if (options.apron) {
    ctx.fillStyle = palette.apron || "#5d4426";
    ctx.beginPath();
    ctx.moveTo(-3.6, shY + 3);
    ctx.lineTo(3.6, shY + 3);
    ctx.lineTo(4.8, hipY + 7);
    ctx.lineTo(-4.8, hipY + 7);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = p.belt;
  ctx.fillRect(-5, hipY - 1.5, 10, 2.4);
  ctx.fillStyle = p.gold;
  ctx.fillRect(-1.2, hipY - 1.5, 2.4, 2.4);

  if (options.quiver) {
    ctx.save();
    ctx.translate(-7, shY + 8);
    ctx.rotate(0.45);
    ctx.fillStyle = palette.quiver || "#5a3a20";
    ctx.fillRect(-2.5, -9, 5, 15);
    ctx.strokeStyle = palette.shaft || "#c9b48a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-1.2, -9); ctx.lineTo(-2.2, -15);
    ctx.moveTo(1.2, -9); ctx.lineTo(1.8, -14);
    ctx.stroke();
    ctx.fillStyle = palette.fletch || "#8fae4a";
    ctx.beginPath(); ctx.moveTo(-2.2, -15); ctx.lineTo(-4.4, -17); ctx.lineTo(-1, -16); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(1.8, -14); ctx.lineTo(3.8, -16.5); ctx.lineTo(3.6, -13.8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  if (options.shield) {
    ctx.fillStyle = palette.shieldWood || "#4a5060";
    ctx.beginPath();
    ctx.arc(-8.5, shY + 10, 5.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.shieldRim || "#2c323e";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(-8.5, shY + 10, 5.8, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Front limbs and hands on alternating rungs.
  limb(4.5, shY + 3, 7.5, rightHandY, p.skin, 2.8);
  limb(-3, hipY, -6.5, leftFootY, p.pants, 3.1);
  limb(-6.5, leftFootY, -8, leftFootY + 3, p.boots, 3.4);
  drawBoot(-8, leftFootY + 5, p.boots, 0.82);

  ctx.fillStyle = p.skin;
  ctx.beginPath(); ctx.arc(-7.5, leftHandY, 1.7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(7.5, rightHandY, 1.7, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = p.skin;
  ctx.beginPath(); ctx.arc(0, headY, 4.8, 0, Math.PI * 2); ctx.fill();

  if (options.helm) {
    ctx.fillStyle = p.metal;
    ctx.beginPath(); ctx.arc(0, headY - 1.8, 5.1, Math.PI, 0); ctx.fill();
    ctx.fillStyle = p.metalDk;
    ctx.fillRect(-6.4, headY - 2.4, 12.8, 1.8);
    if (options.plume) {
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, headY - 5.6);
      ctx.quadraticCurveTo(-3, headY - 9, -7, headY - 7);
      ctx.stroke();
      ctx.lineCap = "butt";
    }
  } else if (options.hood) {
    ctx.fillStyle = p.cloak;
    ctx.beginPath();
    ctx.moveTo(3.5, headY - 4.4);
    ctx.quadraticCurveTo(-0.5, headY - 8.3, -5.5, headY - 3.5);
    ctx.quadraticCurveTo(-7.2, headY + 1.5, -4.7, headY + 5.4);
    ctx.lineTo(0.5, headY + 5);
    ctx.quadraticCurveTo(-3.4, headY + 0.5, -1.2, headY - 2.7);
    ctx.quadraticCurveTo(0.4, headY - 4.8, 3.5, headY - 4.4);
    ctx.closePath();
    ctx.fill();
  } else if (options.strawHat) {
    ctx.fillStyle = "#c9a85e";
    ctx.beginPath(); ctx.ellipse(0, headY - 4.7, 8.2, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#d8bc72";
    ctx.beginPath(); ctx.arc(0, headY - 5.4, 4.2, Math.PI, 0); ctx.fill();
  } else if (options.cap) {
    ctx.fillStyle = p.accent;
    ctx.beginPath(); ctx.arc(0, headY - 1.5, 4.8, Math.PI, 0); ctx.fill();
    ctx.fillRect(-4.8, headY - 2, 9.6, 1.6);
  } else {
    ctx.fillStyle = p.hair;
    ctx.beginPath(); ctx.arc(-0.4, headY - 1.6, 4.6, Math.PI * 0.95, Math.PI * 2.02); ctx.fill();
  }

  if (options.crown) {
    ctx.fillStyle = p.gold;
    ctx.fillRect(-5.5, headY - 6, 11, 2.4);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 4 - 1.3, headY - 5.8);
      ctx.lineTo(i * 4, headY - (i === 0 ? 12 : 10));
      ctx.lineTo(i * 4 + 1.3, headY - 5.8);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.fillStyle = "#2e2218";
  ctx.beginPath(); ctx.arc(1.8, headY - 0.4, 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
