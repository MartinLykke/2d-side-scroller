import { ctx, groundY } from '../canvas.js';

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
  const P = PALETTES[u.vtint];
  const t = performance.now() / 1000;
  const anim = u.anim || 0;

  ctx.save();
  ctx.translate(u.x, 0);
  if (dir < 0) ctx.scale(-1, 1);

  const breathe = Math.sin(t * 1.7 + (u.x || 0) * 0.025);
  const bob = moving ? Math.abs(Math.sin(anim)) * 1.3 : breathe * 0.5 + 0.5;
  const hipY  = groundY - 17 - bob * 0.4;
  const shY   = groundY - 30 - bob;
  const headY = groundY - 37 - bob;

  // --- legs ---
  const s = Math.sin(anim);
  const stride = moving ? 5 : 0;
  limb(-3, hipY, -3 + s * stride, groundY - 3, P.pants, 3);
  limb(-3 + s * stride, groundY - 3.5, -1.4 + s * stride, groundY, BOOTS, 3.4);
  limb(3, hipY, 3 - s * stride, groundY - 3, P.pants, 3);
  limb(3 - s * stride, groundY - 3.5, 4.6 - s * stride, groundY, BOOTS, 3.4);

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
  // rope belt with a hanging knot
  ctx.strokeStyle = ROPE; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-5, hipY - 1); ctx.lineTo(5, hipY - 1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1.5, hipY - 1); ctx.lineTo(2.2, hipY + 3); ctx.stroke();

  // --- arms: loose swing, hands hanging ---
  const swing = moving ? Math.sin(anim) * 3 : breathe * 0.6;
  limb(-4, shY + 2, -6 - swing, shY + 12, SKIN, 2.5);
  limb(4, shY + 2, 6 + swing, shY + 12, SKIN, 2.5);

  // --- head: bare with a mop of hair ---
  ctx.fillStyle = SKIN;
  ctx.beginPath(); ctx.arc(0, headY, 4.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.hair;
  ctx.beginPath(); ctx.arc(-0.4, headY - 1.6, 4.5, Math.PI * 0.95, Math.PI * 2.02); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-3.4, headY - 0.5, 1.4, 2.4, 0.3, 0, Math.PI * 2); ctx.fill(); // hair over the ear
  // simple eye dot so they read as facing somewhere
  ctx.fillStyle = "#3a2a1c";
  ctx.beginPath(); ctx.arc(2, headY - 0.4, 0.7, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}
