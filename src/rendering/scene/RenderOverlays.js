import { ctx, groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';

export function drawPortals(dark) {
  const T = performance.now() / 1000;
  for (const p of state.portals) {
    const x = p.x;
    const glow = Game.isNight ? 1 : 0.4;
    const gateW = 52, gateH = 140, archH = 34;
    const pillarW = 14;
    const baseY = groundY;

    ctx.save();

    // --- ground scorch mark ---
    const sg = ctx.createRadialGradient(x, baseY, 8, x, baseY, 90);
    sg.addColorStop(0, `rgba(80,10,0,${0.7 * glow})`);
    sg.addColorStop(0.5, `rgba(40,4,0,${0.3 * glow})`);
    sg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.ellipse(x, baseY + 4, 90, 14, 0, 0, Math.PI * 2); ctx.fill();

    // --- outer hellfire glow ---
    ctx.globalCompositeOperation = "lighter";
    const og = ctx.createRadialGradient(x, baseY - gateH * 0.45, 10, x, baseY - gateH * 0.45, gateW + 60);
    og.addColorStop(0, `rgba(255,80,20,${0.25 * glow})`);
    og.addColorStop(0.6, `rgba(200,30,0,${0.1 * glow})`);
    og.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.ellipse(x, baseY - gateH * 0.45, gateW + 60, gateH * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // --- stone pillars ---
    const stoneBase = "#2a1a12", stoneMid = "#3d2518", stoneHi = "#55301c";
    for (const side of [-1, 1]) {
      const px = x + side * gateW;
      ctx.fillStyle = stoneMid;
      ctx.fillRect(px - pillarW / 2, baseY - gateH, pillarW, gateH);
      ctx.fillStyle = stoneHi;
      ctx.fillRect(px - side * pillarW / 2, baseY - gateH, 3, gateH);
      ctx.fillStyle = stoneBase;
      ctx.fillRect(px + side * pillarW / 2 - 3, baseY - gateH, 3, gateH);

      const sy = baseY - gateH - 6;
      ctx.fillStyle = "#3a2a1e";
      ctx.beginPath(); ctx.arc(px, sy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1a0a04";
      ctx.beginPath(); ctx.arc(px - 3, sy - 1, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 3, sy - 1, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#0e0604";
      ctx.fillRect(px - 2, sy + 2, 4, 3);

      ctx.strokeStyle = `rgba(255,90,20,${0.4 + 0.3 * Math.sin(T * 2 + side)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px - 2, baseY - gateH + 20);
      ctx.lineTo(px + 1, baseY - gateH + 38);
      ctx.lineTo(px - 3, baseY - gateH + 56);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px + 2, baseY - gateH + 70);
      ctx.lineTo(px - 1, baseY - gateH + 88);
      ctx.stroke();

      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 3; k++) {
        const et = (T * 0.8 + k * 1.3 + side * 2) % 3;
        const ey = sy - et * 26;
        const ea = (1 - et / 3) * 0.8 * glow;
        ctx.fillStyle = `rgba(255,${140 + k * 30},20,${ea})`;
        ctx.beginPath();
        ctx.arc(px + Math.sin(T * 3 + k * 4 + side) * 6, ey, 1.5 + (1 - et / 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // --- archway (pointed gothic arch) ---
    ctx.fillStyle = stoneBase;
    ctx.beginPath();
    ctx.moveTo(x - gateW - pillarW / 2, baseY - gateH);
    ctx.quadraticCurveTo(x - gateW * 0.4, baseY - gateH - archH * 1.3, x, baseY - gateH - archH);
    ctx.quadraticCurveTo(x + gateW * 0.4, baseY - gateH - archH * 1.3, x + gateW + pillarW / 2, baseY - gateH);
    ctx.lineTo(x + gateW - pillarW / 2, baseY - gateH);
    ctx.quadraticCurveTo(x + gateW * 0.3, baseY - gateH - archH * 0.9, x, baseY - gateH - archH + 6);
    ctx.quadraticCurveTo(x - gateW * 0.3, baseY - gateH - archH * 0.9, x - gateW + pillarW / 2, baseY - gateH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = `rgba(255,60,10,${0.6 + 0.4 * Math.sin(T * 3)})`;
    ctx.beginPath(); ctx.arc(x, baseY - gateH - archH + 2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255,120,30,${0.3 + 0.2 * Math.sin(T * 3)})`;
    ctx.beginPath(); ctx.arc(x, baseY - gateH - archH + 2, 10, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // --- inner void (the portal opening) ---
    ctx.beginPath();
    ctx.moveTo(x - gateW + pillarW / 2 + 2, baseY);
    ctx.lineTo(x - gateW + pillarW / 2 + 2, baseY - gateH);
    ctx.quadraticCurveTo(x - gateW * 0.3, baseY - gateH - archH * 0.85, x, baseY - gateH - archH + 8);
    ctx.quadraticCurveTo(x + gateW * 0.3, baseY - gateH - archH * 0.85, x + gateW - pillarW / 2 - 2, baseY - gateH);
    ctx.lineTo(x + gateW - pillarW / 2 - 2, baseY);
    ctx.closePath();

    const ig = ctx.createLinearGradient(x, baseY, x, baseY - gateH - archH);
    ig.addColorStop(0, `rgba(200,50,10,${0.85 * glow})`);
    ig.addColorStop(0.3, `rgba(140,20,5,${0.7 * glow})`);
    ig.addColorStop(0.6, `rgba(60,5,0,${0.9 * glow})`);
    ig.addColorStop(1, "rgba(10,0,0,1)");
    ctx.fillStyle = ig; ctx.fill();

    ctx.save(); ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 7; k++) {
      const phase = T * 1.2 + k * 0.9;
      const fy = baseY - 10 - ((phase * 40) % (gateH + archH));
      const fx = x + Math.sin(phase * 2.1 + k) * (gateW * 0.5);
      const fr = 12 + Math.sin(phase * 3) * 6;
      const fa = (0.25 + 0.15 * Math.sin(phase * 4)) * glow;
      const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
      fg.addColorStop(0, `rgba(255,200,60,${fa})`);
      fg.addColorStop(0.4, `rgba(255,80,10,${fa * 0.6})`);
      fg.addColorStop(1, "rgba(120,10,0,0)");
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // --- fire flames licking out of the gate ---
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 10; k++) {
      const phase = T * 1.6 + k * 0.63;
      const t = (phase % 1.5) / 1.5;
      const fx = x + (k - 4.5) * (gateW * 0.18);
      const flameH = (30 + Math.sin(phase * 5) * 14) * (1 - t * 0.3);
      const fy = baseY - t * flameH;
      const fa = (1 - t) * 0.55 * glow;
      const fw = 5 + Math.sin(phase * 3.7) * 2;

      ctx.fillStyle = `rgba(255,${180 - t * 120},${40 - t * 30},${fa})`;
      ctx.beginPath();
      ctx.moveTo(fx - fw, baseY);
      ctx.quadraticCurveTo(fx - fw * 0.5, fy + flameH * 0.3, fx + Math.sin(phase) * 3, fy);
      ctx.quadraticCurveTo(fx + fw * 0.5, fy + flameH * 0.3, fx + fw, baseY);
      ctx.fill();
    }

    for (let side = -1; side <= 1; side += 2) {
      for (let k = 0; k < 3; k++) {
        const phase = T * 1.3 + k * 1.1 + side * 0.7;
        const t = (phase % 2) / 2;
        const fx = x + side * (gateW - 4) + Math.sin(phase * 2) * 4;
        const flameH = 40 + Math.sin(phase * 4.2) * 18;
        const fy = baseY - gateH * 0.15 - t * flameH;
        const fa = (1 - t) * 0.4 * glow;
        ctx.fillStyle = `rgba(255,${100 + k * 30},10,${fa})`;
        ctx.beginPath();
        ctx.moveTo(fx, baseY - gateH * 0.1);
        ctx.quadraticCurveTo(fx + side * 8, fy + flameH * 0.4, fx + side * 3 + Math.sin(phase) * 4, fy);
        ctx.quadraticCurveTo(fx - side * 3, fy + flameH * 0.5, fx, baseY - gateH * 0.1);
        ctx.fill();
      }
    }
    ctx.restore();

    // --- heat distortion shimmer above gate ---
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 5; k++) {
      const ht = (T * 0.6 + k * 0.5) % 2.5;
      const hy = baseY - gateH - archH - ht * 40;
      const ha = (1 - ht / 2.5) * 0.18 * glow;
      const hx = x + Math.sin(T * 2 + k * 1.8) * 16;
      ctx.fillStyle = `rgba(255,100,20,${ha})`;
      ctx.beginPath(); ctx.ellipse(hx, hy, 8 + k * 2, 3, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    ctx.restore();
  }
}
