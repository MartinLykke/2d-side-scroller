import { ctx, groundY } from '../../core/canvas.js';
import { drawBoot } from '../DrawHelpers.js';
import { biomeHumanoidSkin } from '../BiomeHumanoidSkins.js';
import { drawClimbPose, isClimbingEntity } from './FriendlyClimb.js';

// ---------------------------------------------------------------------------
// Procedural villager: the plain folk — vagrants wandering in and peasants
// waiting to be given a trade. Simple patched tunic, rope belt, bare head.
// Same local-space convention as Archer.js/Builder.js.
// ---------------------------------------------------------------------------

// Small wardrobe variation so a crowd doesn't look cloned
const PALETTES = [
  { tunic: "#6e6250", tunicLt: "#80735e", pants: "#4a4234", hair: "#4a3826" },
  { tunic: "#5d6652", tunicLt: "#6f7a62", pants: "#443c30", hair: "#2e2418" },
  { tunic: "#71584a", tunicLt: "#84685a", pants: "#4c4438", hair: "#6a5a42" },
  { tunic: "#65594e", tunicLt: "#776a5e", pants: "#3e382e", hair: "#3c2c1c" },
];
const SKIN = "#d3ac82", BOOTS = "#3a2c1e", ROPE = "#a08a58";

function limb(x1, y1, x2, y2, col, w) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.lineCap = "butt";
}

// Works for units (u.dir/u.moving) and vagrants (pass dir/moving explicitly)
export function drawVillager(u, dir = u.dir, moving = u.moving) {
  if (u.vtint === undefined) u.vtint = Math.floor(Math.random() * PALETTES.length);
  const P = biomeHumanoidSkin("villager", u.x, PALETTES[u.vtint], u.vtint);
  const t = performance.now() / 1000;
  const anim = u.anim || 0;

  ctx.save();
  ctx.translate(u.x, 0);
  if (dir < 0) ctx.scale(-1, 1);

  if (isClimbingEntity(u)) {
    drawClimbPose(u, {
      ...P,
      skin: P.skin || SKIN,
      boots: P.boots || BOOTS,
      belt: P.rope || ROPE,
    });
    ctx.restore();
    return;
  }

  const breathe = Math.sin(t * 1.7 + (u.x || 0) * 0.025);
  const bob = moving ? Math.abs(Math.sin(anim)) * 1.3 : breathe * 0.5 + 0.5;
  const hipY  = groundY - 17 - bob * 0.4;
  const shY   = groundY - 30 - bob;
  const headY = groundY - 37 - bob;

  // --- legs ---
  const s = Math.sin(anim);
  const stride = moving ? 5 : 0;
  const backFoot = -3 + s * stride;
  const frontFoot = 3 - s * stride;
  limb(-3, hipY, backFoot, groundY - 4, P.pants, 3);
  limb(backFoot, groundY - 4.5, backFoot + 0.5, groundY - 2, P.boots, 3.4);
  drawBoot(backFoot + 0.5, groundY, P.boots, 0.92);
  limb(3, hipY, frontFoot, groundY - 4, P.pants, 3);
  limb(frontFoot, groundY - 4.5, frontFoot + 0.5, groundY - 2, P.boots, 3.4);
  drawBoot(frontFoot + 0.5, groundY, P.boots, 0.92);

  // --- tunic ---
  ctx.fillStyle = P.tunic;
  ctx.beginPath();
  ctx.moveTo(-5.5, shY);
  ctx.lineTo(5.5, shY);
  ctx.lineTo(5, hipY + 4);
  ctx.lineTo(-5, hipY + 4);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.tunicLt; ctx.fillRect(-4.5, shY + 1, 3, 7); // worn highlight
  // a patch sewn on
  ctx.fillStyle = "rgba(0,0,0,0.14)"; ctx.fillRect(1, shY + 8, 3.2, 3.2);
  ctx.strokeStyle = "rgba(230,220,180,0.35)";
  ctx.lineWidth = 0.7;
  ctx.strokeRect(1, shY + 8, 3.2, 3.2);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(-5.8, shY + 1.5, 2.2, 4.6);
  ctx.fillRect(3.6, shY + 1.5, 2.2, 4.6);
  // rope belt with a hanging knot
  ctx.strokeStyle = P.rope; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-5, hipY - 1); ctx.lineTo(5, hipY - 1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1.5, hipY - 1); ctx.lineTo(2.2, hipY + 3); ctx.stroke();
  ctx.strokeStyle = "rgba(80,55,35,0.55)";
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-4.8, shY + 2); ctx.lineTo(4.4, hipY + 3); ctx.stroke();
  ctx.fillStyle = "#6b4b2c";
  ctx.fillRect(4.3, hipY + 0.5, 3.4, 5);
  if (P.detail === "frozen") {
    ctx.strokeStyle = P.trim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-5.2, shY + 1.5); ctx.quadraticCurveTo(0, shY + 5.5, 5.2, shY + 1.5); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(-5.5, hipY + 3, 11, 2);
  } else if (P.detail === "desert") {
    ctx.fillStyle = P.accent;
    ctx.fillRect(-5.5, hipY + 1.5, 11, 1.7);
    ctx.fillStyle = "rgba(255,230,160,0.35)";
    ctx.fillRect(-4.5, shY + 3.5, 9, 2);
  } else if (P.detail === "swamp") {
    ctx.fillStyle = P.accent;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(-4 + i * 4, hipY + 4 + (i % 2), 1.1, 0, Math.PI * 2); ctx.fill();
    }
  } else if (P.detail === "volcano") {
    ctx.fillStyle = P.glow;
    ctx.beginPath(); ctx.arc(3.4, shY + 9.2, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,122,54,0.22)";
    ctx.fillRect(-5.2, hipY + 2.5, 10.4, 2.2);
  } else if (P.detail === "corrupted") {
    ctx.strokeStyle = P.rune; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(2.5, shY + 8); ctx.lineTo(4.3, shY + 10); ctx.lineTo(2.9, shY + 12); ctx.stroke();
  } else {
    ctx.fillStyle = P.accent;
    ctx.beginPath(); ctx.arc(-4.2, shY + 6, 1.4, 0, Math.PI * 2); ctx.fill();
  }
  if (P.detail === "frozen") {
    ctx.fillStyle = P.trim;
    ctx.beginPath(); ctx.ellipse(-6.2, shY + 3, 3.2, 2.1, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(6.2, shY + 3, 3.2, 2.1, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(230,248,255,0.72)";
    ctx.fillRect(-4.8, hipY + 4.2, 9.6, 1.8);
  } else if (P.detail === "desert") {
    ctx.fillStyle = P.trim;
    ctx.beginPath(); ctx.moveTo(-6, shY + 1); ctx.lineTo(-10, shY + 12); ctx.lineTo(-5.2, shY + 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.accent;
    ctx.fillRect(-5, hipY - 3.5, 10, 2);
  } else if (P.detail === "swamp") {
    ctx.strokeStyle = P.trim;
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(-5.5 + i * 3.4, shY + 2.5); ctx.lineTo(-6.5 + i * 3.4, hipY + 6); ctx.stroke();
    }
  } else if (P.detail === "volcano") {
    ctx.fillStyle = "#201618";
    ctx.fillRect(-5.2, hipY + 3.8, 10.4, 2.2);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.glow;
    ctx.beginPath(); ctx.arc(-2.4, hipY + 4.9, 0.8, 0, Math.PI * 2); ctx.arc(2.4, hipY + 4.9, 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (P.detail === "corrupted") {
    ctx.strokeStyle = P.rune;
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(-5.4, hipY + 4); ctx.quadraticCurveTo(-8, hipY + 7, -5.6, hipY + 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5.4, hipY + 4); ctx.quadraticCurveTo(8, hipY + 7, 5.6, hipY + 10); ctx.stroke();
  }

  // --- arms: loose swing, hands hanging ---
  const swing = moving ? Math.sin(anim) * 3 : breathe * 0.6;
  limb(-4, shY + 2, -6 - swing, shY + 12, P.skin, 2.5);
  limb(4, shY + 2, 6 + swing, shY + 12, P.skin, 2.5);
  if (P.detail === "frozen") {
    ctx.fillStyle = P.trim;
    ctx.beginPath(); ctx.arc(-6 - swing, shY + 12, 1.9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6 + swing, shY + 12, 1.9, 0, Math.PI * 2); ctx.fill();
  } else if (P.detail === "swamp") {
    ctx.fillStyle = P.accent;
    ctx.beginPath(); ctx.arc(-6 - swing, shY + 10, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6 + swing, shY + 10, 0.9, 0, Math.PI * 2); ctx.fill();
  }

  // --- head: bare with a mop of hair ---
  ctx.fillStyle = P.skin;
  ctx.beginPath(); ctx.arc(0, headY, 4.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.hair;
  ctx.beginPath(); ctx.arc(-0.4, headY - 1.6, 4.5, Math.PI * 0.95, Math.PI * 2.02); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-3.4, headY - 0.5, 1.4, 2.4, 0.3, 0, Math.PI * 2); ctx.fill(); // hair over the ear
  ctx.strokeStyle = "rgba(255,240,200,0.12)";
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(-1.2, headY - 2.3, 3.2, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
  if (P.detail === "frozen") {
    ctx.strokeStyle = P.trim;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(-0.5, headY - 2.5, 5.3, Math.PI * 1.02, Math.PI * 1.85); ctx.stroke();
  } else if (P.detail === "desert") {
    ctx.fillStyle = P.trim;
    ctx.beginPath();
    ctx.moveTo(-5, headY - 4);
    ctx.quadraticCurveTo(0, headY - 8, 5, headY - 4);
    ctx.lineTo(4.2, headY - 1.2);
    ctx.quadraticCurveTo(0, headY - 3.2, -4.8, headY - 1.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = P.accent;
    ctx.fillRect(-4.4, headY + 1.2, 8.6, 2.2);
  } else if (P.detail === "swamp") {
    ctx.fillStyle = P.accent;
    ctx.beginPath(); ctx.moveTo(-3.8, headY - 5.2); ctx.lineTo(-1.5, headY - 9); ctx.lineTo(0.5, headY - 4.8); ctx.closePath(); ctx.fill();
  } else if (P.detail === "volcano") {
    ctx.fillStyle = "rgba(255,122,54,0.8)";
    ctx.beginPath(); ctx.arc(1.2, headY - 5.3, 0.9, 0, Math.PI * 2); ctx.fill();
  } else if (P.detail === "corrupted") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.glow;
    ctx.beginPath(); ctx.arc(2, headY - 0.4, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // simple eye dot so they read as facing somewhere
  ctx.fillStyle = "#3a2a1c";
  ctx.beginPath(); ctx.arc(2, headY - 0.4, 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(80,50,30,0.55)";
  ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(0.6, headY + 0.2); ctx.lineTo(1.2, headY + 1.3); ctx.stroke();

  ctx.restore();
}
