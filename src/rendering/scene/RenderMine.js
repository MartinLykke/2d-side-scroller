import { ctx, groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { MINE } from '../../config/config.js';
import { groundShadow } from '../DrawHelpers.js';
import { drawCoins } from './RenderItems.js';
import { drawParticles, drawFloats } from './RenderEffects.js';

// Cutaway mine below the base, drawn inside the world camera transform of
// Renderer.render() so surface and mine share one screen. Everything here is
// drawn in "local" mine space where the mine floor sits at groundY, then the
// whole scene is shifted down by MINE.depth. Mine entities keep normal
// groundY-based physics untouched — only the rendering is offset.

const GAP = 22;                 // packed-dirt strip between surface and cave ceiling
const CH = MINE.depth - GAP;    // interior height of the tunnel

const hash = i => { const s = Math.sin(i * 127.1) * 43758.5453; return s - Math.floor(s); };

const ceilingY = () => groundY - CH;

function drawCaveShell(left, right) {
  const cy = ceilingY();
  // back wall
  ctx.fillStyle = "#221a12";
  ctx.fillRect(left, cy, right - left, groundY - cy);
  // rocky wall variation
  for (let i = 0; i < 90; i++) {
    const x = left + hash(i) * (right - left);
    const y = cy + 10 + hash(i + 300) * (CH - 24);
    const r = 5 + hash(i + 600) * 13;
    ctx.fillStyle = hash(i + 900) > 0.5 ? "rgba(48,38,26,0.55)" : "rgba(16,12,8,0.45)";
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, hash(i) * 3, 0, Math.PI * 2); ctx.fill();
  }
  // ceiling lip + stalactites
  ctx.fillStyle = "#1a1410";
  ctx.fillRect(left, cy, right - left, 5);
  for (let i = 0; i < 34; i++) {
    const x = left + 20 + (i / 34) * (right - left - 40) + hash(i + 50) * 24;
    if (x < left + 24 || x > right - 24) continue;
    if (Math.abs(x - MINE.entranceX) < 26) continue; // keep the shaft opening clear
    const len = 6 + hash(i + 80) * 16;
    const w = 4 + hash(i + 110) * 6;
    ctx.fillStyle = hash(i) > 0.5 ? "#1c1610" : "#241c14";
    ctx.beginPath(); ctx.moveTo(x - w, cy); ctx.lineTo(x, cy + len); ctx.lineTo(x + w, cy); ctx.closePath(); ctx.fill();
  }
  // floor
  ctx.fillStyle = "#171008";
  ctx.fillRect(left, groundY, right - left, 1600);
  ctx.fillStyle = "rgba(90,74,52,0.5)";
  ctx.fillRect(left, groundY, right - left, 2);
  for (let i = 0; i < 60; i++) {
    const x = left + hash(i + 33) * (right - left);
    ctx.fillStyle = "rgba(70,58,40,0.5)";
    ctx.fillRect(x, groundY + 3 + hash(i + 66) * 10, 3 + hash(i + 99) * 6, 2);
  }
  // rocky end walls — these are the dig faces; frontier veins sit embedded in them
  for (const [sx, dir] of [[left, 1], [right, -1]]) {
    ctx.fillStyle = "#15100a";
    ctx.beginPath();
    ctx.moveTo(sx, cy);
    for (let i = 0; i <= 8; i++)
      ctx.lineTo(sx + dir * (6 + hash(i + sx) * 16), cy + (i / 8) * (groundY - cy));
    ctx.lineTo(sx, groundY); ctx.closePath(); ctx.fill();
  }
}

function drawSupportBeams(left, right) {
  const cy = ceilingY();
  for (let x = left + 110; x < right - 60; x += 190) {
    if (Math.abs(x - MINE.entranceX) < 46 || Math.abs(x - MINE.stationX) < 46) continue;
    ctx.fillStyle = "#3c2c18";
    ctx.fillRect(x - 4, cy + 2, 8, groundY - cy - 2);
    ctx.fillStyle = "#4a3820";
    ctx.fillRect(x - 4, cy + 2, 3, groundY - cy - 2);
    // crossbeam cap
    ctx.fillStyle = "#342512";
    ctx.fillRect(x - 26, cy, 52, 6);
  }
}

function drawTorch(x, t) {
  const cy = groundY - 52;
  ctx.strokeStyle = "#4a3820"; ctx.lineWidth = 3; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x, cy + 16); ctx.lineTo(x, cy); ctx.stroke();
  const fl = 0.85 + 0.15 * Math.sin(t * 13 + x);
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, cy - 4, 2, x, cy - 4, 80 * fl);
  g.addColorStop(0, "rgba(255,190,90,0.32)");
  g.addColorStop(0.4, "rgba(255,140,50,0.13)");
  g.addColorStop(1, "rgba(255,110,30,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, cy - 4, 80 * fl, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#ffb347";
  ctx.beginPath(); ctx.ellipse(x, cy - 5, 3.4, 6 * fl, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffe9a0";
  ctx.beginPath(); ctx.ellipse(x, cy - 4, 1.6, 3 * fl, 0, 0, Math.PI * 2); ctx.fill();
}

function drawLadderShaft() {
  const x = MINE.entranceX, cy = ceilingY();
  // shaft carved up through the ceiling toward the surface entrance
  ctx.fillStyle = "#0a0806";
  ctx.fillRect(x - 16, cy - 600, 32, 602);
  const g = ctx.createLinearGradient(0, cy - 40, 0, groundY);
  g.addColorStop(0, "rgba(210,225,255,0.20)");
  g.addColorStop(1, "rgba(210,225,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 15, cy - 40); ctx.lineTo(x + 15, cy - 40);
  ctx.lineTo(x + 30, groundY); ctx.lineTo(x - 30, groundY);
  ctx.closePath(); ctx.fill();
  // the ladder itself, running from the mine floor up to the surface
  ctx.strokeStyle = "#8a6a3a"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x - 6, groundY); ctx.lineTo(x - 6, cy - 60); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 6, groundY); ctx.lineTo(x + 6, cy - 60); ctx.stroke();
  for (let y = groundY - 8; y > cy - 56; y -= 13) {
    ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.stroke();
  }
}

// Frontier veins are embedded straight into the tunnel's end wall (not the
// floor): a patch of exposed gold the miner chips at, which breaks through to
// widen the mine once exhausted (see MineSystem.expandMine).
function drawVein(v, t) {
  const x = v.x;
  const cy = ceilingY();
  const midY = (cy + groundY) / 2;
  const shake = v.workPulse > 0 ? Math.sin(t * 55) * 1.4 : 0;
  ctx.save();
  ctx.translate(x + shake * v.side, 0);
  // exposed ore patch on the wall face
  ctx.fillStyle = v.ore > 0 ? "#453a2a" : "#2c2620";
  ctx.beginPath(); ctx.ellipse(-v.side * 8, midY, 24, CH * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath(); ctx.ellipse(-v.side * 8, midY, 24, CH * 0.42, 0, -Math.PI * 0.5, Math.PI * 0.5); ctx.fill();
  if (v.ore > 0) {
    // gold nuggets embedded in the rock: one per remaining ore
    for (let i = 0; i < v.ore; i++) {
      const nx = -v.side * 8 + (hash(i + x) - 0.5) * 34;
      const ny = midY + (hash(i + x + 7) - 0.5) * (CH * 0.7);
      ctx.fillStyle = "#d8a828";
      ctx.beginPath(); ctx.arc(nx, ny, 2.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffdf70";
      ctx.beginPath(); ctx.arc(nx - 0.8, ny - 0.8, 1.2, 0, Math.PI * 2); ctx.fill();
    }
    // sparkle
    const sp = (Math.sin(t * 2.4 + x) + 1) / 2;
    if (sp > 0.75) {
      const sx = -v.side * 8 + (hash(x) - 0.5) * 30, sy = midY + (hash(x + 3) - 0.5) * (CH * 0.6);
      ctx.save(); ctx.globalAlpha = (sp - 0.75) * 4;
      ctx.strokeStyle = "#fff3c0"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx - 4, sy); ctx.lineTo(sx + 4, sy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx, sy - 4); ctx.lineTo(sx, sy + 4); ctx.stroke();
      ctx.restore();
    }
  } else {
    // cracking through: grey rubble right before the wall breaks
    ctx.fillStyle = "#4a4440";
    for (let i = 0; i < 5; i++) {
      const rx = -v.side * 8 + (hash(i + x + 11) - 0.5) * 30;
      const ry = midY + (hash(i + x) - 0.5) * (CH * 0.6);
      ctx.beginPath(); ctx.arc(rx, ry, 2 + hash(i + x) * 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawMinerStation(t) {
  const x = MINE.stationX;
  groundShadow(x, 12, 0.18);
  // sign post
  ctx.strokeStyle = "#5a4426"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x, groundY - 34); ctx.stroke();
  ctx.fillStyle = "#6a4a28"; ctx.fillRect(x - 16, groundY - 46, 32, 15);
  ctx.fillStyle = "#8a6a3a"; ctx.fillRect(x - 16, groundY - 46, 32, 3);
  // pickaxe leaning against the post
  ctx.save();
  ctx.translate(x + 12, groundY); ctx.rotate(-0.5);
  ctx.strokeStyle = "#8a6a3a"; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -22); ctx.stroke();
  ctx.strokeStyle = "#9aa2ac"; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(-7, -18); ctx.quadraticCurveTo(0, -27, 7, -18); ctx.stroke();
  ctx.restore();
  // bobbing icon
  const bob = Math.sin(t * 2.5 + x) * 3;
  ctx.save(); ctx.font = "18px serif"; ctx.textAlign = "center"; ctx.globalAlpha = 0.92;
  ctx.fillText("⛏", x, groundY - 54 + bob);
  ctx.restore();
}

function drawMiner(u) {
  const x = u.x, y = groundY, dir = u.dir || 1;
  const moving = !!u.moving;
  const working = !!u.working && !moving;
  const anim = u.anim || 0;
  const step = moving ? Math.sin(anim * 1.6) * 3.2 : 0;
  groundShadow(x, 11, 0.2);
  ctx.save();
  ctx.translate(x, 0);
  if (u.transform > 0) ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(u.transform * 22));
  if (dir < 0) ctx.scale(-1, 1);
  if (u.dying) {
    const p = Math.min((u.deathT || 0) / (u.deathDuration || 1.25), 1);
    const ease = 1 - Math.pow(1 - p, 3);
    ctx.globalAlpha *= Math.max(0.25, 1 - Math.max(0, p - 0.72) / 0.28);
    ctx.translate(0, groundY); ctx.rotate((u.deathSpin || 1) * ease * 1.4); ctx.translate(0, -groundY + ease * 3);
  }
  // legs
  ctx.strokeStyle = "#2c2218"; ctx.lineWidth = 3.2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-3, y - 15); ctx.lineTo(-3 - step, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3, y - 15); ctx.lineTo(3 + step, y); ctx.stroke();
  // torso
  ctx.fillStyle = "#5c4832"; ctx.fillRect(-6.5, y - 33, 13, 19);
  ctx.fillStyle = "#4a3826"; ctx.fillRect(-6.5, y - 33, 5, 19);
  ctx.fillStyle = "#2c2218"; ctx.fillRect(-6.5, y - 20, 13, 3);
  // head + mining helmet with lamp
  ctx.fillStyle = "#caa483"; ctx.beginPath(); ctx.arc(0, y - 38, 5.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#b08a2a"; ctx.beginPath(); ctx.arc(0, y - 39.5, 5.8, Math.PI, 0); ctx.fill();
  ctx.fillRect(-6.5, y - 40.5, 13, 2.2);
  ctx.fillStyle = "#ffe9a0"; ctx.beginPath(); ctx.arc(3.6, y - 42.5, 1.7, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const lg = ctx.createRadialGradient(4, y - 42, 1, 4, y - 42, 30);
  lg.addColorStop(0, "rgba(255,220,140,0.28)"); lg.addColorStop(1, "rgba(255,200,100,0)");
  ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(4, y - 42, 30, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // pickaxe arm
  ctx.save();
  ctx.translate(4, y - 29);
  ctx.rotate(working ? -1.6 + Math.abs(Math.sin(anim * 1.35)) * 1.9 : 0.45);
  ctx.strokeStyle = "#caa483"; ctx.lineWidth = 2.6; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(7, 3); ctx.stroke();
  ctx.translate(7, 3); ctx.rotate(-0.5);
  ctx.strokeStyle = "#8a6a3a"; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(0, -13); ctx.stroke();
  ctx.strokeStyle = "#9aa2ac"; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(-6, -9); ctx.quadraticCurveTo(0, -17, 6, -9); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// Draw the whole cutaway. Must be called inside the camera transform.
export function drawMineCutaway(drawPlayerFn, dark) {
  if (!state.mineBuilt) return;
  const t = performance.now() / 1000;
  const left = state.mineActiveLeft, right = state.mineActiveRight;
  ctx.save();
  // Reveal only the underground band, and only as wide as the tunnel has been
  // dug so far — nothing here may draw over the surface grass or beyond the
  // current end walls.
  ctx.beginPath();
  ctx.rect(left, groundY + 1, right - left, 2400);
  ctx.clip();
  ctx.translate(0, MINE.depth);

  drawCaveShell(left, right);
  drawSupportBeams(left, right);
  drawLadderShaft();
  for (let x = left + 150; x < right - 40; x += 260) {
    if (Math.abs(x - MINE.entranceX) < 50) continue;
    drawTorch(x, t);
  }
  drawTorch(MINE.stationX - 46, t);
  for (const v of state.mineVeins) drawVein(v, t);
  drawMinerStation(t);
  drawCoins(true);
  for (const u of state.units) if (u.mine) drawMiner(u);
  if (Game.inMine && drawPlayerFn) {
    groundShadow(state.player.x, 22, 0.3);
    drawPlayerFn(dark);
  }
  drawParticles(true);
  drawFloats(true);

  ctx.restore();
}
