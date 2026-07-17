import { ctx, groundY } from '../../core/canvas.js';
import { MOUNTS } from '../../config/mounts.js';

// Horse drawn facing +x with hooves on y = gy. All proportions are in the
// game's stylized vector look; `run` is 0..1 movement blend, `phase` drives
// the leg cycle (the player's gallop counter), `m` is the mount def.
function drawHorse(m, gy, phase, run, breathe) {
  const b = m.body, bd = m.bodyDk, be = m.belly;
  const bodyY = gy - 17 - breathe * 0.5;   // body centerline
  const s1 = Math.sin(phase * 2);          // diagonal leg pairs
  const s2 = Math.sin(phase * 2 + Math.PI);
  const stride = 5.5 * run;
  const lift = 3 * run;

  // tail: flows back harder at speed
  ctx.strokeStyle = m.tail;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-16, bodyY - 4);
  ctx.quadraticCurveTo(-22 - run * 5, bodyY + 1 + Math.sin(phase) * 1.5, -24 - run * 8, bodyY + 9 - run * 4);
  ctx.stroke();

  // far legs (darker)
  const leg = (hipX, sw, liftP, col) => {
    const footX = hipX + sw * stride;
    const footY = gy - Math.max(0, liftP) * lift;
    const kneeX = hipX + sw * stride * 0.4;
    const kneeY = gy - 7 - Math.max(0, liftP) * lift * 0.6;
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hipX, bodyY + 4); ctx.lineTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
    ctx.fillStyle = "#1c1410";
    ctx.fillRect(footX - 1.8, footY - 2, 3.8, 2.2);
  };
  ctx.lineCap = "round";
  leg(-10, s2, Math.cos(phase * 2 + Math.PI), bd); // far hind
  leg(10, s1, Math.cos(phase * 2), bd);            // far front

  // body: barrel + rump + chest
  ctx.fillStyle = b;
  ctx.beginPath(); ctx.ellipse(0, bodyY, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-11, bodyY - 1.5, 7, 7, 0.2, 0, Math.PI * 2); ctx.fill(); // rump
  ctx.beginPath(); ctx.ellipse(11, bodyY - 1, 6.5, 7, -0.15, 0, Math.PI * 2); ctx.fill(); // chest
  // belly highlight
  ctx.fillStyle = be;
  ctx.globalAlpha = 0.6;
  ctx.beginPath(); ctx.ellipse(1, bodyY + 3.5, 11, 3.6, 0, 0, Math.PI); ctx.fill();
  ctx.globalAlpha = 1;

  // neck + head
  const headX = 17.5, headY = bodyY - 15 - breathe * 0.3;
  ctx.fillStyle = b;
  ctx.beginPath();
  ctx.moveTo(9, bodyY - 6);
  ctx.quadraticCurveTo(13, bodyY - 12, headX - 1.5, headY + 2.5);
  ctx.lineTo(headX + 2.5, headY + 5.5);
  ctx.quadraticCurveTo(15.5, bodyY - 3, 12, bodyY + 2);
  ctx.closePath(); ctx.fill();
  // head: wedge with muzzle
  ctx.beginPath();
  ctx.moveTo(headX - 3, headY - 3);
  ctx.quadraticCurveTo(headX + 2, headY - 5, headX + 5, headY - 2.5);
  ctx.lineTo(headX + 9.5, headY + 2.5);
  ctx.quadraticCurveTo(headX + 10, headY + 4.5, headX + 8, headY + 4.8);
  ctx.quadraticCurveTo(headX + 3, headY + 5.5, headX - 2, headY + 3.5);
  ctx.closePath(); ctx.fill();
  // muzzle shading + nostril
  ctx.fillStyle = bd;
  ctx.beginPath(); ctx.ellipse(headX + 8, headY + 3.4, 1.9, 1.5, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#140c08";
  ctx.beginPath(); ctx.arc(headX + 8.4, headY + 2.8, 0.55, 0, Math.PI * 2); ctx.fill();
  // eye
  ctx.fillStyle = "#180e08";
  ctx.beginPath(); ctx.ellipse(headX + 2.6, headY - 0.6, 1, 1.25, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath(); ctx.arc(headX + 2.3, headY - 1.1, 0.35, 0, Math.PI * 2); ctx.fill();
  // ears
  ctx.fillStyle = b;
  ctx.beginPath(); ctx.moveTo(headX - 1, headY - 3.5); ctx.lineTo(headX - 0.2, headY - 7.5); ctx.lineTo(headX + 1.8, headY - 3.8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = bd;
  ctx.beginPath(); ctx.moveTo(headX + 2.2, headY - 4); ctx.lineTo(headX + 3.4, headY - 7); ctx.lineTo(headX + 4.6, headY - 3.5); ctx.closePath(); ctx.fill();

  // mane down the neck ridge, streaming back at speed
  ctx.strokeStyle = m.mane;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(headX - 1, headY - 3);
  ctx.quadraticCurveTo(12 - run * 2, bodyY - 12 - run * 1.5, 8.5 - run * 3, bodyY - 6.5);
  ctx.stroke();
  // forelock
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(headX + 0.5, headY - 4); ctx.quadraticCurveTo(headX + 3, headY - 3, headX + 3.5, headY - 1); ctx.stroke();

  // near legs (full body color, over the barrel)
  leg(-9, s1, Math.cos(phase * 2), b);             // near hind
  leg(11, s2, Math.cos(phase * 2 + Math.PI), b);   // near front

  // saddle blanket + saddle where the rider sits
  ctx.fillStyle = m.blanket;
  ctx.beginPath();
  ctx.moveTo(-7.5, bodyY - 7);
  ctx.lineTo(6.5, bodyY - 7);
  ctx.lineTo(5.5, bodyY + 3);
  ctx.lineTo(-6.5, bodyY + 3);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(-6.5, bodyY + 0.5, 12, 2.2);
  ctx.fillStyle = m.saddle;
  ctx.beginPath();
  ctx.moveTo(-6, bodyY - 8.2);
  ctx.quadraticCurveTo(0, bodyY - 10.5, 5, bodyY - 8.2);
  ctx.quadraticCurveTo(5.8, bodyY - 6, 4.5, bodyY - 5);
  ctx.lineTo(-5.5, bodyY - 5);
  ctx.quadraticCurveTo(-6.8, bodyY - 6, -6, bodyY - 8.2);
  ctx.closePath(); ctx.fill();
  // pommel + cantle nubs
  ctx.fillStyle = "#d4a838";
  ctx.beginPath(); ctx.arc(4.8, bodyY - 8.6, 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-5.6, bodyY - 8.8, 1.1, 0, Math.PI * 2); ctx.fill();
  // girth strap + stirrup
  ctx.strokeStyle = "#3a2c1e";
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(0, bodyY - 5); ctx.lineTo(0.5, bodyY + 7.5); ctx.stroke();
  ctx.fillStyle = "#8a8a94";
  ctx.fillRect(-1, bodyY + 7.5, 3, 2);

  // rein from muzzle back toward the saddle
  ctx.strokeStyle = "#3a2c1e";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(headX + 7, headY + 3.8);
  ctx.quadraticCurveTo(headX - 2, headY + 8, 4, bodyY - 8);
  ctx.stroke();

  // ember mounts smoulder: glowing mane/hoof sparks
  if (m.ember) {
    const T = performance.now() / 1000;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.4 + 0.2 * Math.sin(T * 4);
    ctx.strokeStyle = "#ffb040";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(headX - 1, headY - 3);
    ctx.quadraticCurveTo(12 - run * 2, bodyY - 12 - run * 1.5, 8.5 - run * 3, bodyY - 6.5);
    ctx.stroke();
    for (let k = 0; k < 3; k++) {
      const wt = (T * 0.8 + k * 0.33) % 1;
      ctx.globalAlpha = (1 - wt) * 0.7;
      ctx.fillStyle = k % 2 ? "#ff6a20" : "#ffcc60";
      ctx.beginPath();
      ctx.arc(12 - wt * 6 + Math.sin((T + k) * 3) * 2, bodyY - 10 - wt * 12, 1.1 * (1 - wt) + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.lineCap = "butt";
}

// In-world: drawn INSIDE the player's render transform (already translated to
// the player and lifted by bob+jump+wall+mount and mirrored for direction).
// The true ground is therefore `lift` below local groundY.
export function drawMount(player, m) {
  const run = Math.min(1, Math.abs(player.vx || 0) / 260);
  const breathe = Math.sin(performance.now() / 1000 * 1.6);
  ctx.save();
  ctx.scale(m.scale, m.scale);
  drawHorse(m, (groundY + m.lift + (player.bob || 0)) / m.scale, player.gallop || 0, run, breathe);
  ctx.restore();
}

// Shop icon: a standing horse centered on (0, 0), scaled to fit a cell.
export function drawMountModel(mountId, s = 1) {
  const m = MOUNTS[mountId];
  if (!m) return;
  ctx.save();
  ctx.scale(s, s);
  ctx.translate(-2, 16);
  drawHorse(m, 0, 0.8, 0, 0);
  ctx.restore();
}
