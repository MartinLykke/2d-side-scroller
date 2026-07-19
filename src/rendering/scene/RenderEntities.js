import { ENEMY_TYPES } from '../../config/enemies.js?v=biomeboss1';
import { ctx, groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { roundedRect, legs, drawArm, drawHpBar } from '../DrawHelpers.js';
import { entityWallLift, wallReady, wallHeight } from '../../entities/Wall.js';
import { visibleWorldBounds } from '../Viewport.js';
import { drawArcher } from '../sprites/Archer.js';
import { drawBuilder } from '../sprites/Builder.js';
import { drawVillager } from '../sprites/Villager.js';
import { drawGuard } from '../sprites/Guard.js';
import { drawFarmer } from '../sprites/Farmer.js';
import { drawImp, drawFireImp } from '../sprites/Imps.js';
import { drawShade, drawVoidWraith, drawVoidBrute, drawVoidTitan, drawVoidSeraph } from '../sprites/VoidSpawn.js';
import { renderBudget } from '../RenderFrame.js';
import { drawEnemySilhouette, shouldDrawEnemySilhouette } from './EnemySilhouette.js';

const STUCK_ARROW_FADE_TIME = 0.55;

function stuckArrowAlpha(ar) {
  const fadeTime = Math.min(STUCK_ARROW_FADE_TIME, ar.maxT || STUCK_ARROW_FADE_TIME);
  return Math.max(0, Math.min(1, ar.t / fadeTime));
}

function drawHumanoid(x, anim, bodyCol, headCol, tool, dir, moving) {
  ctx.save(); ctx.translate(x,0); if (dir<0) ctx.scale(-1,1);
  const bob=moving?Math.abs(Math.sin(anim))*1.2:0;
  const swing=moving?Math.sin(anim)*2.5:0;
  legs(0,groundY-15,anim,moving?5:0,bodyCol);
  ctx.fillStyle=bodyCol; roundedRect(-5,groundY-34-bob,10,20,4); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.18)"; roundedRect(2,groundY-34-bob,3,20,2); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,0.14)"; roundedRect(-4,groundY-33-bob,3,14,2); ctx.fill();
  ctx.fillStyle=headCol; ctx.beginPath(); ctx.arc(0,groundY-38-bob,5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.22)"; ctx.beginPath(); ctx.arc(-1,groundY-40-bob,5,Math.PI*1.05,Math.PI*2); ctx.fill();
  if (tool==="bow") {
    ctx.fillStyle="#7a7a8a"; ctx.beginPath(); ctx.arc(0,groundY-39-bob,5.5,Math.PI,0); ctx.fill();
    ctx.fillRect(-5.5,groundY-39-bob,11,3); ctx.fillStyle="#6a6a7a"; ctx.fillRect(-1,groundY-38-bob,2,5);
    ctx.fillStyle="#5a6a50"; roundedRect(-5,groundY-34-bob,10,20,4); ctx.fill();
    ctx.fillStyle="#6a7a5e"; ctx.fillRect(-4,groundY-34-bob,8,3);
    ctx.strokeStyle="#8a5a2a"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(8,groundY-28-bob,9,-1.2,1.2); ctx.stroke();
    ctx.strokeStyle="rgba(230,216,168,0.8)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(8+Math.cos(-1.2)*9,groundY-28-bob+Math.sin(-1.2)*9); ctx.lineTo(8+Math.cos(1.2)*9,groundY-28-bob+Math.sin(1.2)*9); ctx.stroke();
    drawArm(-4,groundY-31-bob, 8,groundY-28-bob, headCol);
    drawArm(4,groundY-31-bob, 1,groundY-29-bob, headCol);
  } else if (tool==="hammer") {
    ctx.fillStyle="#3a200a"; ctx.fillRect(-4,groundY-30-bob,8,4);
    ctx.fillStyle="#4a2e10";
    ctx.beginPath(); ctx.moveTo(-5,groundY-28-bob); ctx.lineTo(5,groundY-28-bob); ctx.lineTo(6,groundY-14-bob); ctx.lineTo(-6,groundY-14-bob); ctx.fill();
    ctx.fillStyle="#5a3a16"; ctx.fillRect(-3,groundY-26-bob,6,2);
    ctx.fillStyle="#5a3a18"; ctx.beginPath(); ctx.arc(0,groundY-39-bob,6,Math.PI,0); ctx.fill();
    ctx.fillStyle="#3e2610"; ctx.fillRect(-8,groundY-39-bob,16,3);
    drawArm(-5,groundY-31-bob, -7,groundY-20-bob, headCol);
    drawArm(5,groundY-31-bob, 9,groundY-34-bob, headCol);
    ctx.strokeStyle="#7a5a2a"; ctx.lineWidth=2.5; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(9,groundY-34-bob); ctx.lineTo(12,groundY-21-bob); ctx.stroke();
    ctx.lineCap="butt";
    ctx.fillStyle="#9a9aaa"; ctx.fillRect(6,groundY-36-bob,9,5);
    ctx.fillStyle="#aaaabc"; ctx.fillRect(6,groundY-36-bob,9,2);
  } else if (tool==="scythe") {
    drawArm(-5,groundY-32-bob, 5,groundY-30-bob, headCol);
    drawArm(5,groundY-28-bob, 8,groundY-22-bob, headCol);
    ctx.fillStyle="#c9a24a"; ctx.beginPath(); ctx.ellipse(0,groundY-42-bob,8,2.6,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(0,groundY-43-bob,4,Math.PI,0); ctx.fill();
    ctx.strokeStyle="#6a4a2a"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(7,groundY-34-bob); ctx.lineTo(9,groundY-16-bob); ctx.stroke();
    ctx.strokeStyle="#bdbdc6"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(9,groundY-34-bob,6,Math.PI*1.1,Math.PI*1.9); ctx.stroke();
  } else {
    drawArm(-5,groundY-31-bob, -7+swing,groundY-19-bob, headCol);
    drawArm(5,groundY-31-bob,   7-swing,groundY-19-bob, headCol);
  }
  ctx.restore();
}

export function drawVagrants() {
  const view = visibleWorldBounds(90);
  for (const v of state.vagrants) {
    if (v.x < view.left || v.x > view.right) continue;
    drawVillager(v, v.vx >= 0 ? 1 : -1, Math.abs(v.vx) > 1);
  }
}

// Grappling hook flight: rope from the archer's hand to a grapnel biting the
// wall top. Drawn in world space so mirroring/lift transforms don't apply.
function drawGrappleRope(u, lift) {
  const g = u.grapple;
  const targetX = g.toX;
  const targetY = groundY - g.lift - 16;
  const handX = u.x + (u.dir || 1) * 5;
  const handY = groundY - lift - 27;
  let hx, hy;
  if (g.phase === "throw") {
    const p = Math.min(g.t, 1);
    const e = 1 - (1 - p) * (1 - p);
    hx = handX + (targetX - handX) * e;
    hy = handY + (targetY - handY) * e - Math.sin(p * Math.PI) * 18; // thrown arc
  } else {
    hx = targetX; hy = targetY;
  }
  // rope sags while flying, snaps taut once the pull starts
  const sag = g.phase === "throw" ? 10 : Math.max(2, 14 * (1 - Math.min(g.t, 1)));
  ctx.save();
  ctx.strokeStyle = "#c9b48a"; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(handX, handY);
  ctx.quadraticCurveTo((handX + hx) / 2, Math.max(handY, hy) + sag, hx, hy);
  ctx.stroke();
  // grapnel: shank with two curved flukes
  const ang = Math.atan2(hy - handY, hx - handX);
  ctx.translate(hx, hy); ctx.rotate(ang);
  ctx.strokeStyle = "#8a8a94"; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(7, -3, 3, -6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(7, 3, 3, 6); ctx.stroke();
  ctx.restore();
}

// Power shot: sparks build while the archer stands still, a bright aura when
// fully charged, and an expanding shockwave ring on release.
function drawPowerCharge(u, lift) {
  const t = performance.now() / 1000;
  const cx = u.x, cy = groundY - 26 - lift;
  const p = Math.min((u.powerTimer || 0) / 3, 1);
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  if (u.powerFlash > 0) {
    const fp = 1 - u.powerFlash / 0.4;
    ctx.globalAlpha = 0.7 * (1 - fp);
    ctx.strokeStyle = "#ffe9a0"; ctx.lineWidth = 3 * (1 - fp) + 1;
    ctx.beginPath(); ctx.arc(cx, cy, 10 + fp * 42, 0, Math.PI * 2); ctx.stroke();
  }
  if (u.charged) {
    const pulse = 0.75 + 0.25 * Math.sin(t * 10 + u.x);
    ctx.globalAlpha = 0.5 * pulse;
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 26);
    g.addColorStop(0, "rgba(255,240,180,0.9)");
    g.addColorStop(0.5, "rgba(255,204,68,0.4)");
    g.addColorStop(1, "rgba(200,120,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill();
    // orbiting sparks
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#fff2b0";
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + i * (Math.PI * 2 / 3);
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 16, cy + Math.sin(a) * 9 - 2, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  } else if (p > 0.13) {
    // charging: sparks rise off the ground and tighten toward the archer
    ctx.fillStyle = "#ffcc44";
    for (let i = 0; i < 4; i++) {
      const cycle = (t * (0.8 + i * 0.13) + i * 0.37) % 1;
      const sx = cx + Math.sin(i * 2.7 + u.x) * 14 * (1 - cycle * 0.6);
      const sy = groundY - 4 - cycle * 34 - lift;
      ctx.globalAlpha = p * 0.8 * Math.sin(cycle * Math.PI);
      ctx.beginPath(); ctx.arc(sx, sy, 1.4 + p, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = p * 0.35;
    ctx.strokeStyle = "#ffcc44"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(cx, groundY - 2 - lift, 12 * p + 4, 3.5, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

export function drawUnits() {
  const view = visibleWorldBounds(220);
  for (const u of state.units) {
    if (u.mine) continue; // miners are drawn by the mine scene
    if (u.x < view.left || u.x > view.right) continue;
    let body="#3a3550", head="#caa483", tool=null;
    if (u.role==="archer")  { body="#2f5040"; tool="bow"; }
    else if (u.role==="builder") { body="#6a4a28"; tool="hammer"; }
    else if (u.role==="farmer")  { body="#5a6a2a"; tool="scythe"; }
    else if (u.role==="guard")   { body="#3a4a5a"; head="#b09a7a"; }
    let wallLift = entityWallLift(u);
    // Grapple flight: the rope, not the climb, carries the archer up
    if (u.grapple) wallLift = u.grappleLiftY || 0;

    const shadowAlpha = u.role === "archer" && state.archerSkills.includes("master_shadows") && Game.isNight && (u.smokeReveal || 0) <= 0 ? 0.32 : 1;
    ctx.save();
    if (wallLift > 0) { ctx.translate(0, -wallLift); }
    ctx.globalAlpha = shadowAlpha;
    if (u.dying) {
      const p = Math.min((u.deathT || 0) / (u.deathDuration || 1.25), 1);
      const ease = 1 - Math.pow(1 - p, 3);
      ctx.globalAlpha *= Math.max(0.25, 1 - Math.max(0, p - 0.72) / 0.28);
      // Pivot at the unit's own feet — sprites draw at absolute u.x, so the
      // rotation origin must be moved there or the body swings around x=0.
      ctx.translate(u.x, groundY);
      ctx.rotate((u.deathSpin || 1) * ease * (u.role === "guard" ? 1.35 : 1.55));
      ctx.translate(-u.x, -groundY + ease * 3);
    }

    if (u.role === "archer") {
      drawArcher(u);
    } else if (u.role === "builder") {
      drawBuilder(u);
    } else if (u.role === "farmer") {
      drawFarmer(u);
    } else if (u.role === "peasant") {
      drawVillager(u);
    } else if (u.role === "guard") {
      drawGuard(u);
    } else {
      drawHumanoid(u.x, u.anim, body, head, tool, u.dir, u.moving);
    }

    if (u.role==="builder" && u.carryLog) {
      ctx.save(); ctx.translate(u.x, groundY - 40);
      ctx.fillStyle = "#4a3420"; roundedRect(-16, -6, 32, 10, 4); ctx.fill();
      ctx.fillStyle = "#c9a878"; ctx.beginPath(); ctx.ellipse(16, -1, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    if (!u.dying && u.role === "archer") {
      if (u.grapple) drawGrappleRope(u, wallLift);
      if (state.archerSkills.includes("powershot") && !state.archerSkills.includes("heavy_ballista") &&
          (u.charged || u.powerFlash > 0 || (u.powerTimer || 0) > 0.4)) {
        drawPowerCharge(u, wallLift);
      }
    }

    if (!u.dying && u.role === "archer" && u.archerName) {
      const shadowAlpha = state.archerSkills.includes("master_shadows") && Game.isNight && (u.smokeReveal || 0) <= 0 ? 0.35 : 0.9;
      ctx.save();
      ctx.globalAlpha = shadowAlpha;
      ctx.textAlign = "center";
      const symbolY = groundY - 68 - wallLift;
      const level = u.level || 1;
      const baseSize = 3 + level * 1.2;
      const color = u.charged ? "#ffcc44" : "#9bd05a";

      ctx.fillStyle = color;
      for (let i = 0; i < level; i++) {
        const angle = (i / level) * Math.PI * 2;
        const radius = baseSize * 2.5;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        ctx.beginPath();
        ctx.arc(px, 0, baseSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.6;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(0, 0, baseSize * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.restore();
    }

    if (!u.dying && u.transform>0) {
      const p=u.transform/0.55;
      ctx.save(); ctx.globalAlpha=p*0.7; ctx.globalCompositeOperation="lighter";
      const grd=ctx.createRadialGradient(u.x,groundY-28-wallLift,2,u.x,groundY-28-wallLift,28*p);
      grd.addColorStop(0,"#ffffff"); grd.addColorStop(0.4,"#9bd05a"); grd.addColorStop(1,"transparent");
      ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(u.x,groundY-28-wallLift,28*p,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    if (!u.dying && u.hp<u.maxHp) drawHpBar(u.x,groundY-46-wallLift,16,u.hp/u.maxHp,"#9bd05a");
  }
}

function drawStuckImpArrows(e) {
  if (!e.stuckArrows || !e.stuckArrows.length) return;
  ctx.save();
  for (const ar of e.stuckArrows) {
    const alpha = stuckArrowAlpha(ar);
    if (alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(ar.x, ar.y);
    ctx.rotate(ar.a || 0);
    const magic = ar.weaponId === "void_bow" || ar.weaponId === "dark_bow" || ar.weaponId === "dragons_bow" || ar.upgradeCol;
    if (magic) {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.28 * alpha;
      ctx.strokeStyle = ar.upgradeCol || (ar.weaponId === "dragons_bow" ? "#ff8840" : "#b060ff");
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(3, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = magic ? "#e8d8ff" : "#c9b48a";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(5, 0); ctx.stroke();
    ctx.fillStyle = "#b8bcc4";
    ctx.beginPath(); ctx.moveTo(5, -1.6); ctx.lineTo(8, 0); ctx.lineTo(5, 1.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = ar.upgradeCol || (magic ? "#c69fff" : "#8fae4a");
    ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-17, -2.3); ctx.lineTo(-14, -0.3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-17, 2.3); ctx.lineTo(-14, 0.3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawEmberBrute(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const PI2 = Math.PI * 2;
  const flash = e.flash > 0 && !e.dying;
  const charging = !!e.charging;
  const chargeT = e.chargeT || 0;
  const chargeFlash = Math.max(0, e.chargeFlash || 0);
  const stompFlash = Math.max(0, e.stompFlash || 0);
  const stompP = stompFlash > 0 ? 1 - stompFlash / 0.35 : -1;   // 0=slam .. 1=recovered
  const throwT = Math.max(0, e.throwAnim || 0);
  const throwP = throwT > 0 ? 1 - throwT / 0.55 : -1;           // 0=grab .. 1=follow-through
  const recovering = e.aiState === "recovery" && !charging;

  // Generic melee swing (suppressed while a throw or stomp owns the arms).
  const swingDur = 0.62;
  const swingRemain = (throwP >= 0 || stompP >= 0) ? 0 : Math.max(0, e.attackAnim || 0);
  const swingT = charging ? -1 : (swingRemain > 0 ? 1 - Math.min(1, swingRemain / swingDur) : -1);

  const hpFrac = e.maxHp ? Math.max(0, Math.min(1, e.hp / e.maxHp)) : 1;
  const lowHp = hpFrac < 0.42;

  // Heat that brightens the internal glow — attacks make the animation readable
  // without relying only on FX.
  const heat = 0.5 + 0.2 * Math.sin(T * 3 + e.x)
    + atkF * 0.3 + stompFlash * 1.4 + chargeFlash * 1.1
    + (charging ? 0.35 : 0) + Math.max(0, throwP >= 0 && throwP < 0.6 ? (0.5 - Math.abs(throwP - 0.4)) : 0);

  const flicker = flash ? "#fff" : null;
  const obsidian = flicker || "#171b21";
  const basalt   = flicker || "#282e37";
  const basalt2  = flicker || "#39424d";
  const rimStone = flicker || "#5a626b";
  const shadow   = flicker || "#0b0d11";
  const ironDk   = flicker || "#2b2e35";
  const iron     = flicker || "#454a53";
  const ironRim  = flicker || "#6c7079";
  const ember    = "#ff6a20";
  const emberHot = "#ffb040";
  const whiteHot = "#ffe0a0";

  // ── gait ───────────────────────────────────────────────────────────────
  // Slow, uneven, weighted steps. Feet lift only a little, then slam; the body
  // drops on each footfall and the opposite shoulder rides up.
  const stride = charging ? Math.sin(chargeT * 26) : Math.sin(e.anim * 1.05);
  const footfall = charging ? 0 : Math.pow(Math.abs(stride), 6);   // spikes at the plant
  const bodyDrop = charging ? Math.abs(Math.sin(chargeT * 22)) * 1.1
    : footfall * 2.2 + (stompP >= 0 && stompP < 0.6 ? (0.5 - Math.abs(stompP - 0.3)) * 12 : 0);
  const idleBreath = (charging || swingT >= 0 || stompP >= 0 || throwP >= 0) ? 0 : Math.sin(T * 1.5) * 0.6;

  const SCALE = 2.7;
  ctx.save();
  ctx.translate(0, groundY); ctx.scale(SCALE, SCALE); ctx.translate(0, -groundY);

  const y = groundY;   // torso reference is built upward from the feet line

  function poly(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  // Thick tapered limb segment between two joints.
  function seg(x1, y1, x2, y2, w1, w2) {
    if (w2 === undefined) w2 = w1;
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    ctx.beginPath();
    ctx.moveTo(x1 + nx * w1, y1 + ny * w1);
    ctx.lineTo(x2 + nx * w2, y2 + ny * w2);
    ctx.lineTo(x2 - nx * w2, y2 - ny * w2);
    ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
    ctx.closePath(); ctx.fill();
  }
  function lavaCrack(pts, width, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const pulse = 0.5 + 0.3 * Math.sin(T * 4.5 + e.x) + heat * 0.25;
    ctx.globalAlpha = Math.min(1, alpha * pulse);
    ctx.strokeStyle = ember; ctx.lineWidth = width; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
    ctx.globalAlpha *= 0.6; ctx.strokeStyle = emberHot; ctx.lineWidth = width * 0.5;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.restore();
  }
  // Angular armored fist with knuckle spikes, pointing along (ang).
  function fist(fx, fy, ang, r, fill) {
    const c = Math.cos(ang), s = Math.sin(ang);
    ctx.fillStyle = fill;
    poly([[fx - c * r + s * r, fy - s * r - c * r],
          [fx + c * r + s * r, fy + s * r - c * r],
          [fx + c * r - s * r, fy + s * r + c * r],
          [fx - c * r - s * r, fy - s * r + c * r]]);
    ctx.fill();
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.moveTo(fx + c * r + s * r, fy + s * r - c * r);
    ctx.lineTo(fx + c * (r + 3), fy + s * (r + 3));
    ctx.lineTo(fx + c * r - s * r, fy + s * r + c * r);
    ctx.closePath(); ctx.fill();
  }

  // ── ground FX (feet space, behind the body) ──────────────────────────────
  // Stomp shockwave — the visible ring matches the damage radius.
  if (stompFlash > 0) {
    const p = 1 - stompFlash / 0.35;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = (1 - p) * 0.9;
    ctx.strokeStyle = ember; ctx.lineWidth = 3.5 * (1 - p);
    ctx.beginPath(); ctx.ellipse(0, groundY - 1, 13 + p * 30, 4 + p * 7, 0, 0, PI2); ctx.stroke();
    ctx.globalAlpha = (1 - p) * 0.5; ctx.strokeStyle = emberHot; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, groundY - 1, 9 + p * 22, 3 + p * 5, 0, 0, PI2); ctx.stroke();
    ctx.globalAlpha = (1 - p) * 0.7; ctx.strokeStyle = ember; ctx.lineWidth = 1.2;
    for (let k = 0; k < 6; k++) {
      const a = k * 0.52 - 0.3, r = 9 + p * 22;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 5, groundY - 1 + Math.sin(a) * 1.5);
      ctx.lineTo(Math.cos(a) * r, groundY - 1 + Math.sin(a) * r * 0.3);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Charge grit thrown backward from the leading run.
  if (charging) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 5; k++) {
      const wt = (chargeT * 3 + k * 0.2) % 1;
      ctx.globalAlpha = (1 - wt) * 0.4;
      ctx.fillStyle = k % 2 ? ember : "#6b5a45";
      ctx.beginPath(); ctx.arc(-8 - wt * 22, groundY - 1 - wt * 8, 1.4 * (1 - wt) + 0.5, 0, PI2); ctx.fill();
    }
    ctx.restore();
  }
  // Charge / stomp wind-up aura.
  if (chargeFlash > 0 || charging) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = charging ? 0.4 : chargeFlash / 0.3 * 0.45;
    const aura = ctx.createRadialGradient(0, y - 22, 3, 0, y - 22, 30);
    aura.addColorStop(0, "rgba(255,140,40,0.6)");
    aura.addColorStop(0.5, "rgba(200,60,10,0.22)");
    aura.addColorStop(1, "rgba(80,10,0,0)");
    ctx.fillStyle = aura; ctx.beginPath(); ctx.ellipse(0, y - 22, 26, 30, 0, 0, PI2); ctx.fill();
    ctx.restore();
  }
  // Subtle heat shimmer — heavy things smolder, they don't blaze.
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.07 + 0.04 * Math.sin(T * 3 + e.x) + (lowHp ? 0.05 : 0);
  const haze = ctx.createRadialGradient(0, y - 18, 4, 0, y - 18, 24);
  haze.addColorStop(0, "rgba(255,100,20,0.4)");
  haze.addColorStop(1, "rgba(80,10,0,0)");
  ctx.fillStyle = haze; ctx.beginPath(); ctx.ellipse(0, y - 18, 22, 26, 0, 0, PI2); ctx.fill();
  ctx.restore();

  // ── LEGS: thick stone pillars, planted wide ──────────────────────────────
  const hipY = y - 14;
  // Front/back leg phase (front = +x, leading). Feet lift only slightly.
  const frontPhase = stride, backPhase = -stride;
  const frontLift = charging ? Math.max(0, Math.sin(chargeT * 26)) * 3 : Math.max(0, frontPhase) * 2.2;
  const backLift  = charging ? Math.max(0, -Math.sin(chargeT * 26)) * 3 : Math.max(0, backPhase) * 2.2;
  const legs = [
    { hx: -5, fx: -13 - stride * 2.5, lift: backLift },
    { hx:  6, fx:  13 - stride * 2.5, lift: frontLift },
  ];
  for (const lg of legs) {
    const kneeX = (lg.hx + lg.fx) * 0.5 + (lg.fx < 0 ? -1.5 : 1.5);
    const footY = groundY - lg.lift;
    ctx.fillStyle = basalt;
    seg(lg.hx, hipY, kneeX, groundY - 8 - lg.lift, 4.6, 4.2);   // thigh
    ctx.fillStyle = basalt2;
    seg(kneeX, groundY - 8 - lg.lift, lg.fx, footY - 2, 3.8, 3.4); // shin
    // heavy flat foot slab
    ctx.fillStyle = obsidian;
    poly([[lg.fx - 5.5, footY - 2.5], [lg.fx + 5, footY - 2.5],
          [lg.fx + 4, footY + 1], [lg.fx - 6.5, footY + 1]]);
    ctx.fill();
    lavaCrack([[lg.hx, hipY + 2], [kneeX, groundY - 9 - lg.lift]], 0.8, 0.32);
    lavaCrack([[lg.fx - 3, footY - 2], [lg.fx + 3, footY - 2]], 0.6, 0.28);
  }
  // Footfall dust + a spray of embers under the planting foot.
  if (footfall > 0.6 && !charging) {
    const fx = frontPhase < 0 ? -13 : 13;
    ctx.save();
    ctx.globalAlpha = (footfall - 0.6) / 0.4 * 0.22; ctx.fillStyle = "#5a5048";
    ctx.beginPath(); ctx.ellipse(fx, groundY, 7, 2.2, 0, 0, PI2); ctx.fill();
    ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (footfall - 0.6) / 0.4 * 0.4;
    ctx.fillStyle = ember;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(fx + (k - 1) * 3, groundY - 1, 0.9, 0, PI2); ctx.fill(); }
    ctx.restore();
  }

  // ── UPPER BODY (leans / lunges as one mass, pivoting at the hips) ─────────
  const shoulderTilt = charging ? 0 : stride * 0.05;              // opposite shoulder rides up
  const chargeAnticip = charging ? Math.max(0, (0.16 - chargeT) / 0.16) : 0;
  const chargeRun = charging ? Math.min(1, (chargeT - 0.06) / 0.16) : 0;
  // Throw twists the torso back on the wind-up, then forward through release.
  const throwLean = throwP < 0 ? 0
    : throwP < 0.55 ? -0.16 * (throwP / 0.55)
    : throwP < 0.8 ? -0.16 + 0.34 * ((throwP - 0.55) / 0.25)
    : 0.18 - 0.13 * ((throwP - 0.8) / 0.2);
  const recoverLean = recovering ? 0.2 : 0;
  const lean = chargeRun * 0.3 - chargeAnticip * 0.12 + shoulderTilt + throwLean + recoverLean
    + (stompP >= 0 && stompP < 0.55 ? 0.22 * (1 - Math.abs(stompP - 0.25) / 0.3) : 0);
  const lunge = charging ? 6 + chargeRun * 3 : (swingT >= 0 ? Math.sin(Math.min(swingT * 1.3, 1) * Math.PI) * 4 : 0)
    + (throwP >= 0.55 && throwP < 0.85 ? (throwP - 0.55) / 0.3 * 4 : 0);
  const upDrop = bodyDrop + idleBreath + (recovering ? 4 : 0);

  ctx.save();
  ctx.translate(lunge, 0);
  ctx.translate(0, hipY); ctx.rotate(lean); ctx.translate(0, -hipY);
  ctx.translate(0, upDrop);

  // Asymmetric shoulders: the armored back shoulder rides high; the throwing
  // shoulder (front) is bulkier, lower and less armored.
  const backShoX = -9, backShoY = y - 31;
  const frontShoX = 9, frontShoY = y - 27;

  // ── BACK ARM (behind torso) — the anvil hand ─────────────────────────────
  {
    let elbX, elbY, fx, fy, ang;
    if (charging) {                        // tucked tight for a compact ram
      elbX = backShoX - 1; elbY = backShoY + 8; fx = backShoX + 4; fy = backShoY + 12; ang = -0.6;
    } else if (stompP >= 0) {              // both fists driven into the ground
      const drive = stompP < 0.5 ? stompP / 0.5 : 1 - (stompP - 0.5) / 0.5 * 0.25;
      elbX = backShoX - 2; elbY = backShoY + 10; fx = backShoX - 3; fy = groundY - 3 - (1 - drive) * 6; ang = 1.6;
    } else if (swingT >= 0) {              // supporting counter-swing
      const p = Math.min(swingT * 1.4, 1); const a = Math.PI + 2.0 - p * 2.8;
      elbX = backShoX + Math.cos(a) * 9; elbY = backShoY + Math.sin(a) * 9;
      fx = backShoX + Math.cos(a) * 15; fy = backShoY + Math.sin(a) * 15; ang = a;
    } else {                               // hangs low and ready
      const d = Math.sin(e.anim * 1.5 + 1) * 1.4;
      elbX = backShoX - 3 - d * 0.4; elbY = backShoY + 9; fx = backShoX - 5 - d; fy = backShoY + 16; ang = 1.8;
    }
    ctx.fillStyle = shadow; seg(backShoX, backShoY, elbX, elbY, 3, 2.6);
    ctx.fillStyle = shadow; ctx.beginPath(); ctx.arc(elbX, elbY, 2.6, 0, PI2); ctx.fill();
    ctx.fillStyle = obsidian; seg(elbX, elbY, fx, fy, 2.6, 2.2);
    // chain-wrapped forearm
    ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = "#3a3d44"; ctx.lineWidth = 0.7;
    for (let k = 0; k < 3; k++) {
      const tt = k / 3; const bx = elbX + (fx - elbX) * tt, by = elbY + (fy - elbY) * tt;
      ctx.beginPath(); ctx.arc(bx, by, 2.4, 0, PI2); ctx.stroke();
    }
    ctx.restore();
    fist(fx, fy, ang, 3.6, shadow);
  }

  // ── TORSO: faceted volcanic plates over a molten core ────────────────────
  // deep chest, hunched, wider across the shoulders than the waist
  ctx.fillStyle = basalt;
  poly([[-9, y - 12], [-13, y - 27], [-9, y - 32], [10, y - 33], [14, y - 28], [11, y - 12]]);
  ctx.fill();
  // narrow waist / belt
  ctx.fillStyle = obsidian;
  poly([[-9, y - 12], [11, y - 12], [9, y - 16], [-7, y - 16]]);
  ctx.fill();
  // darker central chest slab
  ctx.fillStyle = obsidian;
  poly([[-7, y - 15], [-8, y - 26], [8, y - 27], [9, y - 15]]);
  ctx.fill();
  // back armor plate (high armored shoulder)
  ctx.fillStyle = basalt2;
  poly([[-9, y - 32], [-16, y - 31], [-17, y - 24], [-11, y - 21], [-9, y - 26]]);
  ctx.fill();
  ctx.fillStyle = rimStone; ctx.globalAlpha = 0.3;
  poly([[-9, y - 32], [-15.5, y - 31], [-14, y - 28], [-9, y - 29]]);
  ctx.fill(); ctx.globalAlpha = 1;
  // riveted iron pauldron strap
  ctx.strokeStyle = iron; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-14, y - 29); ctx.lineTo(-6, y - 24); ctx.stroke();
  ctx.fillStyle = ironRim;
  ctx.beginPath(); ctx.arc(-13, y - 29.5, 0.8, 0, PI2); ctx.fill();
  ctx.beginPath(); ctx.arc(-7, y - 24.5, 0.8, 0, PI2); ctx.fill();
  // throwing shoulder muscle (front, bulkier, bare rock)
  ctx.fillStyle = basalt2;
  poly([[10, y - 33], [16, y - 30], [17, y - 24], [11, y - 22], [11, y - 29]]);
  ctx.fill();

  // molten core through the chest
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = Math.min(1, 0.45 + heat * 0.4);
  const coreG = ctx.createRadialGradient(1, y - 21, 1, 1, y - 21, 6);
  coreG.addColorStop(0, "rgba(255,205,90,0.95)");
  coreG.addColorStop(0.5, "rgba(255,100,20,0.5)");
  coreG.addColorStop(1, "rgba(120,20,0,0)");
  ctx.fillStyle = coreG; ctx.beginPath(); ctx.arc(1, y - 21, 6, 0, PI2); ctx.fill();
  ctx.restore();

  // cracks concentrated at chest, neck, throwing shoulder, forearms, thighs
  lavaCrack([[-7, y - 15], [-3, y - 21], [-6, y - 27]], 1.1, 0.5);
  lavaCrack([[8, y - 14], [4, y - 20], [8, y - 26]], 1.1, 0.5);
  lavaCrack([[-6, y - 20], [1, y - 21], [7, y - 20]], 0.9, 0.42);
  lavaCrack([[11, y - 30], [15, y - 27]], 0.9, 0.42 + (throwP >= 0.3 && throwP < 0.7 ? 0.4 : 0)); // throwing shoulder brightens on wind-up
  if (lowHp) lavaCrack([[-2, y - 14], [2, y - 24]], 1.4, 0.6);

  // hanging chains / straps at the belt (imps grab these to climb aboard)
  ctx.save();
  const sway = Math.sin(T * 2 + e.x) * 1.2 + (charging ? Math.sin(chargeT * 18) * 1.5 : 0);
  ctx.strokeStyle = "#33363d"; ctx.lineWidth = 1;
  for (const bx of [-6, 4]) {
    ctx.beginPath(); ctx.moveTo(bx, y - 13);
    ctx.quadraticCurveTo(bx + sway * 0.5, y - 8, bx + sway, y - 4);
    ctx.stroke();
    ctx.fillStyle = "#42454c";
    ctx.beginPath(); ctx.arc(bx + sway, y - 4, 1.1, 0, PI2); ctx.fill();
  }
  ctx.restore();

  // ── HEAD: small, low-slung between the shoulders, iron war-mask ──────────
  const hx = 7, hy = y - 36;
  // thick neck sunk into the shoulders
  ctx.fillStyle = basalt;
  poly([[2, y - 27], [1, hy + 5], [11, hy + 5], [11, y - 28]]);
  ctx.fill();
  lavaCrack([[4, y - 27], [5, hy + 4]], 0.7, 0.3);

  // skull base (exposed jaw region)
  ctx.fillStyle = obsidian;
  poly([[hx - 8, hy - 1], [hx - 6, hy - 8], [hx + 3, hy - 9], [hx + 9, hy - 5],
        [hx + 10, hy + 2], [hx + 7, hy + 6], [hx - 3, hy + 6], [hx - 8, hy + 2]]);
  ctx.fill();

  // ram horns — battered, swept back; the front one is chipped/split
  ctx.fillStyle = shadow;
  ctx.beginPath();                                   // back horn (whole)
  ctx.moveTo(hx - 5, hy - 5);
  ctx.quadraticCurveTo(hx - 12, hy - 9, hx - 15, hy - 4);
  ctx.quadraticCurveTo(hx - 13, hy - 3, hx - 11, hy - 5);
  ctx.quadraticCurveTo(hx - 8, hy - 7, hx - 4, hy - 6);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();                                   // front horn (chipped tip)
  ctx.moveTo(hx + 6, hy - 6);
  ctx.quadraticCurveTo(hx + 13, hy - 11, hx + 16, hy - 6);
  ctx.lineTo(hx + 14, hy - 6);                        // blunt broken end
  ctx.quadraticCurveTo(hx + 11, hy - 8, hx + 7, hy - 7);
  ctx.closePath(); ctx.fill();
  // horn ridges + faint heat at the roots
  ctx.strokeStyle = ironDk; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(hx - 6, hy - 5.5); ctx.lineTo(hx - 13, hy - 6); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.35 + heat * 0.15;
  ctx.fillStyle = ember;
  ctx.beginPath(); ctx.arc(hx - 5, hy - 5, 1, 0, PI2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx + 6.5, hy - 6, 1, 0, PI2); ctx.fill();
  ctx.restore();

  // iron war-mask fused over the upper face
  ctx.fillStyle = iron;
  poly([[hx - 7, hy - 2], [hx - 5, hy - 7], [hx + 8, hy - 6], [hx + 10, hy - 1],
        [hx + 8, hy + 2], [hx - 5, hy + 2]]);
  ctx.fill();
  // heavy brow ridge overhanging the eye slits
  ctx.fillStyle = ironDk;
  poly([[hx - 6, hy - 2], [hx - 4, hy - 5], [hx + 8, hy - 4], [hx + 9, hy - 1], [hx - 6, hy - 1]]);
  ctx.fill();
  // reinforced nose guard
  ctx.fillStyle = ironDk;
  poly([[hx + 1, hy - 1], [hx + 3, hy - 1], [hx + 3, hy + 3], [hx + 1.6, hy + 3]]);
  ctx.fill();
  // mask rim highlight + scratches / impact marks
  ctx.strokeStyle = ironRim; ctx.lineWidth = 0.5; ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.moveTo(hx - 5, hy - 6); ctx.lineTo(hx + 7, hy - 5); ctx.stroke();
  ctx.globalAlpha = 0.5; ctx.strokeStyle = shadow;
  ctx.beginPath(); ctx.moveTo(hx - 3, hy - 4); ctx.lineTo(hx + 1, hy - 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx + 5, hy - 5); ctx.lineTo(hx + 7, hy - 2); ctx.stroke();
  ctx.globalAlpha = 1;
  // broken section of the mask exposing rock (lower left)
  ctx.fillStyle = obsidian;
  poly([[hx - 7, hy + 1], [hx - 4, hy + 1], [hx - 5, hy + 3], [hx - 7, hy + 2.5]]);
  ctx.fill();

  // eyes: dim glow through narrow slits, brighter mid-attack
  const eyeGlow = 0.45 + 0.35 * dark + Math.max(0, heat - 0.5) * 0.6
    + (charging ? 0.35 : 0) + (swingT >= 0 ? 0.3 : 0);
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = Math.min(1, eyeGlow);
  for (const ex of [hx - 1.5, hx + 5.5]) {
    const g = ctx.createRadialGradient(ex, hy - 2, 0.3, ex, hy - 2, 2.4);
    g.addColorStop(0, t.eye || "#ff8a30");
    g.addColorStop(1, "rgba(255,80,10,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(ex, hy - 2, 2, 1.1, 0, 0, PI2); ctx.fill();
  }
  ctx.restore();
  // slit cores
  ctx.fillStyle = flash ? "#fff" : (t.eye || "#ff8a30");
  ctx.beginPath(); ctx.ellipse(hx - 1.5, hy - 2, 1.1, 0.5, 0.1, 0, PI2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx + 5.5, hy - 2, 0.9, 0.45, -0.1, 0, PI2); ctx.fill();

  // jaw / mouth beneath the mask — wide, damaged, two short lower tusks.
  // Opens on a roar (charge / stomp wind-up / swing / throw release).
  const roar = charging ? (1 - chargeAnticip) * 0.7 + 0.3
    : swingT >= 0 ? Math.sin(Math.min(swingT * 1.5, 1) * Math.PI)
    : stompP >= 0 && stompP < 0.45 ? 1 - stompP / 0.45
    : throwP >= 0.55 && throwP < 0.85 ? 1
    : 0;
  const jaw = roar * 2.6;
  if (jaw > 0.7) {                                   // furnace glow inside the mouth
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = Math.min(1, (jaw - 0.7) / 1.8) * 0.75;
    const throatG = ctx.createRadialGradient(hx + 3, hy + 4.5, 0.4, hx + 3, hy + 4.5, 4.5);
    throatG.addColorStop(0, "rgba(255,225,110,0.95)");
    throatG.addColorStop(0.5, "rgba(255,100,20,0.5)");
    throatG.addColorStop(1, "rgba(100,20,0,0)");
    ctx.fillStyle = throatG; ctx.beginPath(); ctx.arc(hx + 3, hy + 4.5, 4.5, 0, PI2); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = flash ? "#fff" : "#101318";
  poly([[hx - 4, hy + 2.5], [hx + 8, hy + 2], [hx + 7, hy + 5.5 + jaw], [hx - 3, hy + 6 + jaw]]);
  ctx.fill();
  // upper teeth
  ctx.fillStyle = flash ? "#fff" : "#8a8880";
  for (let k = 0; k < 4; k++) {
    const tx = hx - 2 + k * 2.6;
    ctx.beginPath(); ctx.moveTo(tx, hy + 2.5); ctx.lineTo(tx + 0.9, hy + 4.4 + jaw * 0.35); ctx.lineTo(tx + 1.8, hy + 2.5); ctx.closePath(); ctx.fill();
  }
  // two short lower tusks
  if (jaw > 0.4) {
    ctx.fillStyle = flash ? "#fff" : "#9a988f";
    for (const tx of [hx - 1, hx + 6]) {
      ctx.beginPath(); ctx.moveTo(tx, hy + 5.5 + jaw); ctx.lineTo(tx + 0.9, hy + 2.8 + jaw * 0.55); ctx.lineTo(tx + 1.9, hy + 5.5 + jaw); ctx.closePath(); ctx.fill();
    }
  }

  // ── FRONT (throwing) ARM: massive, articulated ───────────────────────────
  {
    let elbX, elbY, fx, fy, ang, thick = 3.2;
    let swing = 0, grabbing = false;
    if (throwP >= 0) {
      // grab low → wind up behind the shoulder → hurl forward → follow through
      let a, reach;
      if (throwP < 0.3)      { const p = throwP / 0.3;  a = 0.6 + p * 0.5;   reach = 16 + p * 4; grabbing = true; }
      else if (throwP < 0.55){ const p = (throwP - 0.3) / 0.25; a = 1.1 - p * 3.5; reach = 20 - p * 5; }   // up and back
      else if (throwP < 0.8) { const p = (throwP - 0.55) / 0.25; a = -2.4 + p * 2.5; reach = 15 + p * 7; swing = Math.sin(p * Math.PI); } // sweep forward, extend
      else                   { const p = (throwP - 0.8) / 0.2;  a = 0.1 + p * 1.2;  reach = 22 - p * 5; }   // follow down
      elbX = frontShoX + Math.cos(a) * reach * 0.55; elbY = frontShoY + Math.sin(a) * reach * 0.55;
      fx = frontShoX + Math.cos(a) * reach; fy = frontShoY + Math.sin(a) * reach; ang = a;
    } else if (charging) {                            // tucked, shoulder leading the ram
      elbX = frontShoX + 4; elbY = frontShoY + 7; fx = frontShoX + 8; fy = frontShoY + 11; ang = 0.4;
    } else if (stompP >= 0) {                          // driven into the ground beside the other fist
      const drive = stompP < 0.5 ? stompP / 0.5 : 1 - (stompP - 0.5) / 0.5 * 0.25;
      elbX = frontShoX + 2; elbY = frontShoY + 11; fx = frontShoX + 4; fy = groundY - 3 - (1 - drive) * 6; ang = 1.55; thick = 3.4;
    } else if (swingT >= 0) {                           // overhand smash
      const p = Math.min(swingT * 1.4, 1); const a = -2.3 + p * 3.4;
      elbX = frontShoX + Math.cos(a) * 10; elbY = frontShoY + Math.sin(a) * 10;
      fx = frontShoX + Math.cos(a) * 18; fy = frontShoY + Math.sin(a) * 18; ang = a; swing = Math.sin(p * Math.PI);
    } else {                                            // heavy idle dangle, ready to grab
      const d = Math.sin(e.anim * 1.5) * 1.5;
      elbX = frontShoX + 4 + d * 0.4; elbY = frontShoY + 9; fx = frontShoX + 6 + d; fy = frontShoY + 17; ang = 1.6;
    }
    // upper arm (thickest limb)
    ctx.fillStyle = basalt; seg(frontShoX, frontShoY, elbX, elbY, thick + 0.6, thick);
    // elbow joint with a molten seam
    ctx.fillStyle = obsidian; ctx.beginPath(); ctx.arc(elbX, elbY, thick, 0, PI2); ctx.fill();
    lavaCrack([[elbX - 2, elbY], [elbX + 2, elbY]], 0.6, 0.4);
    // chain-wrapped forearm
    ctx.fillStyle = basalt2; seg(elbX, elbY, fx, fy, thick - 0.4, thick - 0.8);
    lavaCrack([[elbX, elbY], [fx * 0.5 + elbX * 0.5, fy * 0.5 + elbY * 0.5]], 0.7, 0.4);
    ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = "#3a3d44"; ctx.lineWidth = 0.8;
    for (let k = 1; k <= 3; k++) {
      const tt = k / 4; const bx = elbX + (fx - elbX) * tt, by = elbY + (fy - elbY) * tt;
      ctx.beginPath(); ctx.arc(bx, by, thick - 0.6, 0, PI2); ctx.stroke();
    }
    ctx.restore();
    // fist (or open grabbing hand)
    if (grabbing) {
      ctx.fillStyle = obsidian;
      ctx.beginPath(); ctx.arc(fx, fy, thick, 0, PI2); ctx.fill();
      ctx.strokeStyle = shadow; ctx.lineWidth = 1; ctx.lineCap = "round";
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath(); ctx.moveTo(fx, fy);
        ctx.lineTo(fx + Math.cos(ang + k * 0.5) * 4, fy + Math.sin(ang + k * 0.5) * 4);
        ctx.stroke();
      }
      ctx.lineCap = "butt";
    } else {
      fist(fx, fy, ang, 4.4, obsidian);
    }
    // fiery arc + impact sparks on the smash / hurl
    if (swing > 0) {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = swing * 0.7; ctx.strokeStyle = ember; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(frontShoX, frontShoY, 19, ang - 1.6, ang + 0.2); ctx.stroke();
      ctx.globalAlpha = swing * 0.35; ctx.strokeStyle = emberHot; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(frontShoX, frontShoY, 23, ang - 1.4, ang); ctx.stroke();
      if (swing > 0.7) {
        ctx.globalAlpha = (swing - 0.7) / 0.3 * 0.8; ctx.fillStyle = whiteHot;
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(fx + (k - 1) * 3, fy + (k - 1) * 2, 1.2, 0, PI2); ctx.fill(); }
      }
      ctx.restore();
    }
  }

  // sparse embers + low-health smoke rising from the shoulders and cracks
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const emberN = lowHp ? 6 : 4;
  for (let k = 0; k < emberN; k++) {
    const wt = (T * 0.4 + k * 0.24) % 1;
    const ex = -6 + k * 3.5 + Math.sin((T + k) * 1.4) * 2;
    const ey = y - 12 - wt * 32;
    ctx.globalAlpha = (1 - wt) * 0.45;
    ctx.fillStyle = k % 2 ? ember : emberHot;
    ctx.beginPath(); ctx.arc(ex, ey, 1 * (1 - wt) + 0.4, 0, PI2); ctx.fill();
  }
  ctx.restore();
  if (lowHp) {                                        // continuous smoke leak from the shoulders
    ctx.save();
    for (let k = 0; k < 3; k++) {
      const wt = (T * 0.3 + k * 0.33) % 1;
      ctx.globalAlpha = (1 - wt) * 0.18;
      ctx.fillStyle = "#2a2622";
      ctx.beginPath(); ctx.arc(-11 + k * 11, y - 30 - wt * 22, 2 + wt * 4, 0, PI2); ctx.fill();
    }
    ctx.restore();
  }

  ctx.restore(); // lunge / lean / drop
  ctx.restore(); // scale
}

function drawAshPriest(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const sway = Math.sin(e.anim * 1.4) * 1.4;
  const robe = flash ? "#fff" : "#38292c";
  const robeDk = flash ? "#fff" : "#1f1416";
  const robePanel = flash ? "#fff" : "#4c383a";
  const ashPale = flash ? "#fff" : "#9c948c";
  const ember = "#ff7a24";
  const emberHot = "#ffc060";
  const castF = Math.max(0, e.ashCastFlash || 0) / 0.34;
  const wardF = Math.max(0, e.ashWardFlash || 0) / 0.45;
  const burstF = Math.max(0, e.ashBurstFlash || 0) / 0.48;
  const chanP = (e.ashChannelT || 0) > 0 ? 1 - Math.max(0, e.ashChannelT) / (e.ashChannelMax || 0.72) : -1;
  // Rituals (scorch channel, kindle ward) lift the arms and staff overhead.
  const raise = chanP >= 0 ? Math.min(1, chanP * 2.2) : Math.min(1, wardF * 1.3);
  // Anticipation: the orb charges and the priest coils back just before a lance cast.
  const windup = chanP < 0 && castF <= 0 && e.ashReady ? Math.max(0, Math.min(1, (0.5 - (e.shootCd ?? 9)) / 0.5)) : 0;
  // Whole-body attack pose: lean/lunge into the cast, crouch into the burst slam.
  const lean = castF * 0.28 - windup * 0.1 - burstF * 0.2 + (chanP >= 0 ? -0.07 : 0);
  const lungeX = castF * 5 - windup * 2 - burstF * 2;
  const y = groundY;

  const SCALE = 1.55;
  ctx.save();
  ctx.translate(0, y); ctx.scale(SCALE, SCALE); ctx.translate(0, -y);

  // ash nova shockwave rolling outward after a burst
  if (burstF > 0) {
    const p = 1 - burstF;
    ctx.save(); ctx.globalAlpha = burstF * 0.8;
    ctx.strokeStyle = "#5a4a44"; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.ellipse(0, y - 3, 8 + p * 26, 4 + p * 7, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = burstF * 0.6; ctx.strokeStyle = ember; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(0, y - 3, 5 + p * 22, 3 + p * 6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // warm radiance while kindling an ally
  if (wardF > 0) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = wardF * 0.55;
    const wg = ctx.createRadialGradient(0, y - 22, 2, 0, y - 22, 26);
    wg.addColorStop(0, "rgba(255,192,96,0.8)");
    wg.addColorStop(1, "rgba(120,40,0,0)");
    ctx.fillStyle = wg; ctx.beginPath(); ctx.ellipse(0, y - 22, 24, 27, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // grey ash motes drifting up off the robe, the odd live ember among them
  for (let k = 0; k < 5; k++) {
    const wt = (T * 0.4 + k * 0.21) % 1;
    const ax = -6 + k * 3 + Math.sin((T + k) * 1.3) * 2.5;
    const ay = y - 6 - wt * 30;
    ctx.save(); ctx.globalAlpha = (1 - wt) * (k % 3 === 0 ? 0.5 : 0.28);
    ctx.fillStyle = k % 3 === 0 ? ember : "#7a6f68";
    ctx.beginPath(); ctx.arc(ax, ay, 1.1 * (1 - wt) + 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // everything from the robe up shares the attack pose, pivoting at the hem
  ctx.save();
  ctx.translate(lungeX, 0);
  ctx.translate(0, y); ctx.rotate(lean); ctx.scale(1, 1 - burstF * 0.14); ctx.translate(0, -y);

  // tattered floor-length robe (no legs — it glides on a skirt of ash)
  const hemY = y - 1;
  const hemPath = () => {
    ctx.moveTo(-9.5 - sway * 0.4, hemY);
    ctx.lineTo(-6.5, hemY - 3); ctx.lineTo(-3.5, hemY); ctx.lineTo(-0.5, hemY - 2.6);
    ctx.lineTo(2.5, hemY); ctx.lineTo(5.5, hemY - 3.2); ctx.lineTo(8.5 + sway * 0.4, hemY);
  };
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-3 + sway * 0.3, y - 32);
  ctx.quadraticCurveTo(-8, y - 22, -9.5 - sway * 0.4, hemY);
  hemPath();
  ctx.quadraticCurveTo(8.5, y - 22, 5.5 + sway * 0.3, y - 31);
  ctx.closePath(); ctx.fill();
  // lighter front panel catching the ember light
  ctx.fillStyle = robePanel;
  ctx.beginPath();
  ctx.moveTo(1 + sway * 0.2, y - 29);
  ctx.quadraticCurveTo(5.5, y - 18, 5 + sway * 0.3, hemY - 1.5);
  ctx.quadraticCurveTo(1.5, hemY - 2.5, -1 + sway * 0.2, hemY - 1);
  ctx.quadraticCurveTo(-1.5, y - 16, 1 + sway * 0.2, y - 29);
  ctx.closePath(); ctx.fill();
  // smouldering hemline, as if the robe never stops burning at the edges
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.35 + 0.18 * Math.sin(T * 2.6 + e.x);
  ctx.strokeStyle = ember; ctx.lineWidth = 1.1;
  ctx.beginPath(); hemPath(); ctx.stroke();
  ctx.restore();
  // ember sigil stitched down the front, flaring during rituals
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.35 + 0.22 * Math.sin(T * 3 + e.x * 0.2) + Math.max(chanP, 0) * 0.5 + wardF * 0.4 + castF * 0.3;
  ctx.strokeStyle = ember; ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(1.6, y - 25); ctx.lineTo(3.6, y - 21); ctx.lineTo(1.6, y - 17);
  ctx.moveTo(0.6, y - 21); ctx.lineTo(4.8, y - 21);
  ctx.stroke();
  ctx.restore();

  // rope belt with a swinging censer trailing smoke
  ctx.strokeStyle = flash ? "#fff" : "#6e5a48"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-5.5, y - 19); ctx.quadraticCurveTo(0, y - 17.6, 6, y - 19.4); ctx.stroke();
  const cSwing = Math.sin(T * 2.3 + e.x * 0.1) * 1.6;
  const cX = -4.5 + cSwing, cY = y - 12.5;
  ctx.strokeStyle = flash ? "#fff" : "#4a3c30"; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-4.5, y - 18.4); ctx.lineTo(cX, cY - 2); ctx.stroke();
  ctx.fillStyle = robeDk;
  ctx.beginPath(); ctx.arc(cX, cY, 2.1, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.55 + 0.25 * Math.sin(T * 6 + e.x);
  ctx.fillStyle = ember;
  ctx.beginPath(); ctx.arc(cX, cY + 0.4, 1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = "#3a3230";
  const st = (T * 0.9 + e.x * 0.05) % 1;
  ctx.beginPath(); ctx.arc(cX + Math.sin(T * 3) * 1.5, cY - 4 - st * 8, 1.8 * (1 - st) + 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // back arm: tucked at the sash, lifted skyward during rituals, flung back on a cast
  ctx.strokeStyle = robeDk; ctx.lineWidth = 2.6; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-2, y - 26);
  ctx.lineTo(-3.5 - raise * 2 - castF * 4, y - 19 - raise * 12 - castF * 3);
  ctx.stroke();
  if (raise > 0.3) {
    ctx.fillStyle = ashPale;
    ctx.beginPath(); ctx.arc(-3.5 - raise * 2, y - 19 - raise * 12, 1.3, 0, Math.PI * 2); ctx.fill();
  }

  // pointed hood, its peak drooping forward
  ctx.fillStyle = robeDk;
  ctx.beginPath();
  ctx.moveTo(-4.5 + sway * 0.3, y - 29);
  ctx.quadraticCurveTo(-3, y - 41, 2, y - 40.5);
  ctx.quadraticCurveTo(6.5, y - 40, 7.5, y - 36.5);
  ctx.quadraticCurveTo(8.6, y - 33, 8.3, y - 28.5);
  ctx.quadraticCurveTo(2, y - 25.5, -4.5 + sway * 0.3, y - 29);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-3 + sway * 0.3, y - 29.5);
  ctx.quadraticCurveTo(-1.5, y - 39, 2.5, y - 38.8);
  ctx.quadraticCurveTo(-0.5, y - 34, -0.2, y - 28.6);
  ctx.closePath(); ctx.fill();
  // hood peak curls to a point with a dying ember at its tip
  ctx.fillStyle = robeDk;
  ctx.beginPath(); ctx.moveTo(0.5, y - 40); ctx.quadraticCurveTo(-2.5, y - 43.5, -5, y - 42.5);
  ctx.quadraticCurveTo(-2.5, y - 41.5, -0.5, y - 38.5); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.4 + 0.3 * Math.sin(T * 4.4 + e.x);
  ctx.fillStyle = ember; ctx.beginPath(); ctx.arc(-4.6, y - 42.4, 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // hollow of the cowl: void-dark, with a cracked ash mask floating in it
  ctx.fillStyle = flash ? "#fff" : "#0d0608";
  ctx.beginPath(); ctx.ellipse(4.3, y - 32, 3.5, 4.1, -0.12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ashPale;
  ctx.beginPath();
  ctx.moveTo(2.2, y - 30.6);
  ctx.quadraticCurveTo(4.6, y - 27.6, 7.2, y - 30);
  ctx.quadraticCurveTo(6.8, y - 32.2, 4.6, y - 32.4);
  ctx.quadraticCurveTo(2.8, y - 32.2, 2.2, y - 30.6);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = flash ? "#fff" : "#5a534e"; ctx.lineWidth = 0.55;
  ctx.beginPath(); ctx.moveTo(4.4, y - 32); ctx.lineTo(4.1, y - 29.4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(5.8, y - 31.4); ctx.lineTo(6.3, y - 30); ctx.stroke();
  // eyes burning above the mask, brighter at night and mid-ritual
  const eyeGlow = 0.5 + 0.35 * dark + Math.max(chanP, 0) * 0.35 + castF * 0.3 + wardF * 0.3;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = eyeGlow;
  ctx.fillStyle = t.eye;
  ctx.beginPath(); ctx.arc(3.3, y - 32.6, 1.7, 0, Math.PI * 2); ctx.arc(6, y - 32.3, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = t.eye;
  ctx.beginPath(); ctx.arc(3.3, y - 32.6, 0.7, 0, Math.PI * 2); ctx.arc(6, y - 32.3, 0.6, 0, Math.PI * 2); ctx.fill();

  // staff arm: idle grip ahead of the body, thrust on a lance cast, raised overhead for rituals
  const handX = 8.5 + castF * 6 - windup * 2 - raise * 3.5;
  const handY = y - 19 - raise * 10 - castF * 2 + burstF * 5;
  ctx.strokeStyle = robe; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(4.5, y - 26); ctx.quadraticCurveTo(7.5, y - 23 - raise * 5, handX, handY); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = ashPale;
  ctx.beginPath(); ctx.arc(handX, handY, 1.4, 0, Math.PI * 2); ctx.fill();

  // gnarled staff crowned with a caged cinder
  // tilt from vertical, forward positive: pulled back on windup, whipped
  // forward on the cast, slammed toward the ground on a burst
  const sa = 0.16 + castF * 1.15 - windup * 0.5 - raise * 0.7 + burstF * 1.3;
  const topX = handX + Math.sin(sa) * 13, topY = handY - Math.cos(sa) * 13;
  const botX = handX - Math.sin(sa) * 9, botY = Math.min(y, handY + Math.cos(sa) * 9);
  ctx.strokeStyle = flash ? "#fff" : "#241512"; ctx.lineWidth = 1.8; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(botX, botY);
  ctx.quadraticCurveTo(handX + Math.sin(sa) * 2 - 1.2, handY - Math.cos(sa) * 2, topX, topY);
  ctx.stroke();
  // crooked prongs cradling the orb
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(topX, topY); ctx.lineTo(topX - 2.4, topY - 3.4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(topX, topY); ctx.lineTo(topX + 2.6, topY - 3); ctx.stroke();
  ctx.lineCap = "butt";
  const orbX = topX + Math.sin(sa) * 1.5, orbY = topY - Math.cos(sa) * 2.6;
  const orbGlow = 0.45 + 0.2 * Math.sin(T * 5 + e.x) + Math.max(chanP, 0) * 0.8 + castF * 0.6 + wardF * 0.7;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = Math.min(1, orbGlow);
  const og = ctx.createRadialGradient(orbX, orbY, 0.4, orbX, orbY, 7 + Math.max(chanP, 0) * 4);
  og.addColorStop(0, "rgba(255,208,96,0.95)");
  og.addColorStop(0.4, "rgba(255,122,36,0.55)");
  og.addColorStop(1, "rgba(120,20,0,0)");
  ctx.fillStyle = og; ctx.beginPath(); ctx.arc(orbX, orbY, 7 + Math.max(chanP, 0) * 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = emberHot;
  ctx.beginPath(); ctx.arc(orbX, orbY, 1.6 + Math.max(chanP, 0) * 0.8, 0, Math.PI * 2); ctx.fill();
  // sparks orbiting the orb while a ritual charges
  if (chanP >= 0 || wardF > 0.2) {
    const spin = chanP >= 0 ? chanP : wardF;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 3; k++) {
      const a = T * (6 + spin * 6) + k * 2.1;
      ctx.globalAlpha = 0.5 + spin * 0.4;
      ctx.fillStyle = k % 2 ? ember : emberHot;
      ctx.beginPath(); ctx.arc(orbX + Math.cos(a) * (4 + spin * 2.5), orbY + Math.sin(a) * (4 + spin * 2.5), 0.9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}

// Night-5 boss: enormous winged dragon that strafes the base spitting fireballs.
// Rider imps are separate entities positioned on its back by EnemyAI.
function drawFireDragon(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const w = t.w;
  const yc = groundY - 26;              // body centerline (entity is translated by e.fy)
  const flap = Math.sin(e.anim * 1.6);  // slow, heavy wingbeat
  const charge = e.shootCd !== undefined ? Math.max(0, 1 - Math.max(0, e.shootCd) / 0.55) : 0;
  const scale = flash ? "#fff" : "#7a1408";
  const scaleDk = flash ? "#fff" : "#3c0a06";
  const belly = flash ? "#fff" : "#c05a28";
  const ember = "#ff6a20";
  const hot = "#ffd060";

  // heat aura
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.14 + 0.06 * Math.sin(T * 3);
  const aura = ctx.createRadialGradient(0, yc, 10, 0, yc, w * 1.3);
  aura.addColorStop(0, "rgba(255,140,40,0.55)");
  aura.addColorStop(1, "rgba(120,10,0,0)");
  ctx.fillStyle = aura; ctx.beginPath(); ctx.ellipse(0, yc, w * 1.3, w * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // huge membrane wing (one drawn behind the body, one in front)
  const wing = (lift, col, boneCol, alpha) => {
    const rootX = -w * 0.08, rootY = yc - w * 0.16;
    const tipX = -w * 0.55, tipY = rootY - w * 0.62 * lift;
    const f1X = -w * 1.05, f1Y = rootY - w * 0.38 * lift + w * 0.1;
    const f2X = -w * 1.25, f2Y = rootY - w * 0.05 * lift + w * 0.22;
    const f3X = -w * 1.05, f3Y = rootY + w * 0.22 - w * 0.02 * lift;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(rootX, rootY);
    ctx.quadraticCurveTo(-w * 0.3, tipY - w * 0.12, tipX, tipY);
    ctx.quadraticCurveTo(-w * 0.85, tipY + w * 0.02, f1X, f1Y);
    ctx.quadraticCurveTo(-w * 1.2, f1Y + w * 0.14, f2X, f2Y);
    ctx.quadraticCurveTo(-w * 1.18, f2Y + w * 0.14, f3X, f3Y);
    ctx.quadraticCurveTo(-w * 0.5, rootY + w * 0.24, rootX, rootY + w * 0.1);
    ctx.closePath(); ctx.fill();
    // wing bones
    ctx.strokeStyle = boneCol; ctx.lineWidth = Math.max(2.5, w * 0.03); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(rootX, rootY); ctx.quadraticCurveTo(-w * 0.3, tipY - w * 0.12, tipX, tipY); ctx.stroke();
    ctx.lineWidth = Math.max(1.8, w * 0.02);
    ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(f1X, f1Y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(f2X, f2Y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(f3X, f3Y); ctx.stroke();
    ctx.lineCap = "butt";
    // firelight veins in the membrane
    ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = alpha * (0.3 + 0.15 * Math.sin(T * 5));
    ctx.strokeStyle = ember; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(rootX - w * 0.15, rootY + w * 0.02); ctx.quadraticCurveTo(-w * 0.7, f1Y - w * 0.05, f1X + w * 0.1, f1Y - w * 0.02); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rootX - w * 0.15, rootY + w * 0.08); ctx.quadraticCurveTo(-w * 0.75, f2Y - w * 0.1, f2X + w * 0.12, f2Y - w * 0.04); ctx.stroke();
    ctx.restore();
  };
  wing(flap * 0.85 + 1.05, scaleDk, flash ? "#fff" : "#240504", 0.8);   // far wing

  // tail: long, whipping, with fin barbs and a flame tip
  const tw = Math.sin(T * 2.6) * w * 0.06;
  ctx.strokeStyle = scale; ctx.lineWidth = Math.max(5, w * 0.075); ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-w * 0.42, yc + w * 0.02);
  ctx.quadraticCurveTo(-w * 0.85, yc + w * 0.12 + tw, -w * 1.15, yc - w * 0.05 + tw * 1.6);
  ctx.stroke();
  ctx.lineWidth = Math.max(3, w * 0.04);
  ctx.beginPath();
  ctx.moveTo(-w * 1.15, yc - w * 0.05 + tw * 1.6);
  ctx.quadraticCurveTo(-w * 1.35, yc - w * 0.14 + tw * 2, -w * 1.48, yc - w * 0.08 + tw * 2.4);
  ctx.stroke(); ctx.lineCap = "butt";
  ctx.fillStyle = scaleDk;
  for (let k = 0; k < 4; k++) {
    const tfx = -w * (0.55 + k * 0.17), tfy = yc + w * 0.06 + tw * (0.4 + k * 0.3) - k * w * 0.02;
    ctx.beginPath(); ctx.moveTo(tfx, tfy); ctx.lineTo(tfx - w * 0.045, tfy - w * 0.085); ctx.lineTo(tfx - w * 0.09, tfy + w * 0.005); ctx.closePath(); ctx.fill();
  }
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.85;
  ctx.fillStyle = ember;
  ctx.beginPath(); ctx.ellipse(-w * 1.5, yc - w * 0.1 + tw * 2.4, w * 0.045, w * 0.1 + Math.sin(T * 12) * 2, 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hot;
  ctx.beginPath(); ctx.ellipse(-w * 1.49, yc - w * 0.09 + tw * 2.4, w * 0.02, w * 0.045, 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // long body
  const heave = Math.sin(T * 2.2) * w * 0.012;
  ctx.fillStyle = scale;
  ctx.beginPath(); ctx.ellipse(0, yc, w * 0.52, w * 0.24 + heave, -0.06, 0, Math.PI * 2); ctx.fill();
  // glowing belly plates
  ctx.fillStyle = belly;
  ctx.beginPath(); ctx.ellipse(w * 0.04, yc + w * 0.1, w * 0.4, w * 0.13, -0.05, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = flash ? "#fff" : "#8a3a16"; ctx.lineWidth = 1.6;
  for (let k = -3; k <= 3; k++) {
    ctx.beginPath(); ctx.moveTo(k * w * 0.11 - w * 0.04, yc + w * 0.02); ctx.quadraticCurveTo(k * w * 0.11, yc + w * 0.16, k * w * 0.11 + w * 0.05, yc + w * 0.02); ctx.stroke();
  }
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.25 + 0.15 * Math.sin(T * 4) + charge * 0.3;
  const bg = ctx.createRadialGradient(w * 0.1, yc + w * 0.08, 2, w * 0.1, yc + w * 0.08, w * 0.4);
  bg.addColorStop(0, "rgba(255,200,90,0.8)"); bg.addColorStop(1, "rgba(200,40,0,0)");
  ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(w * 0.1, yc + w * 0.08, w * 0.4, w * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // dorsal spines
  ctx.fillStyle = scaleDk;
  for (let k = 0; k < 6; k++) {
    const sx = -w * 0.36 + k * w * 0.13, sy = yc - w * 0.2 - heave;
    const sh = w * (0.08 + (k % 2) * 0.035);
    ctx.beginPath(); ctx.moveTo(sx - w * 0.03, sy + 3); ctx.lineTo(sx, sy - sh); ctx.lineTo(sx + w * 0.03, sy + 3); ctx.closePath(); ctx.fill();
  }
  // tucked hind leg with claws
  ctx.strokeStyle = scaleDk; ctx.lineWidth = Math.max(3.5, w * 0.05); ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-w * 0.18, yc + w * 0.14); ctx.lineTo(-w * 0.1, yc + w * 0.3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.22, yc + w * 0.14); ctx.lineTo(w * 0.3, yc + w * 0.28); ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-w * 0.1, yc + w * 0.3); ctx.lineTo(-w * 0.05, yc + w * 0.34); ctx.moveTo(-w * 0.1, yc + w * 0.3); ctx.lineTo(-w * 0.13, yc + w * 0.35); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.3, yc + w * 0.28); ctx.lineTo(w * 0.35, yc + w * 0.32); ctx.moveTo(w * 0.3, yc + w * 0.28); ctx.lineTo(w * 0.27, yc + w * 0.33); ctx.stroke();
  ctx.lineCap = "butt";

  // neck arcing up and forward to the head
  const hX = w * 0.72, hY = yc - w * 0.3 + Math.sin(T * 2.2) * 2;
  ctx.strokeStyle = scale; ctx.lineWidth = Math.max(8, w * 0.13); ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(w * 0.4, yc - w * 0.05); ctx.quadraticCurveTo(w * 0.6, yc - w * 0.28, hX, hY); ctx.stroke();
  ctx.lineCap = "butt";

  // head: horns, brow, jaw that gapes as fire builds
  const jawOpen = charge * 0.5 + (e.attackAnim > 0 ? 0.35 : 0.06);
  ctx.save(); ctx.translate(hX, hY);
  // horns swept back
  ctx.fillStyle = scaleDk;
  ctx.beginPath(); ctx.moveTo(-w * 0.02, -w * 0.06); ctx.quadraticCurveTo(-w * 0.16, -w * 0.16, -w * 0.24, -w * 0.14); ctx.lineTo(-w * 0.05, -w * 0.02); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w * 0.02, -w * 0.08); ctx.quadraticCurveTo(-w * 0.08, -w * 0.22, -w * 0.17, -w * 0.22); ctx.lineTo(0, -w * 0.03); ctx.closePath(); ctx.fill();
  // skull + upper jaw
  ctx.fillStyle = scale;
  ctx.beginPath();
  ctx.moveTo(-w * 0.08, -w * 0.08);
  ctx.quadraticCurveTo(w * 0.1, -w * 0.13, w * 0.3, -w * 0.02 - jawOpen * w * 0.06);
  ctx.lineTo(w * 0.28, w * 0.02 - jawOpen * w * 0.04);
  ctx.quadraticCurveTo(w * 0.05, w * 0.04, -w * 0.08, w * 0.06);
  ctx.closePath(); ctx.fill();
  // lower jaw hinging open
  ctx.fillStyle = scaleDk;
  ctx.beginPath();
  ctx.moveTo(-w * 0.04, w * 0.05);
  ctx.quadraticCurveTo(w * 0.12, w * 0.06 + jawOpen * w * 0.16, w * 0.27, w * 0.04 + jawOpen * w * 0.2);
  ctx.lineTo(w * 0.24, w * 0.08 + jawOpen * w * 0.22);
  ctx.quadraticCurveTo(w * 0.06, w * 0.11 + jawOpen * w * 0.12, -w * 0.05, w * 0.09);
  ctx.closePath(); ctx.fill();
  // teeth
  ctx.fillStyle = flash ? "#fff" : "#f0e0c0";
  for (let k = 0; k < 4; k++) {
    const tx = w * (0.1 + k * 0.05);
    ctx.beginPath(); ctx.moveTo(tx, w * 0.015); ctx.lineTo(tx + w * 0.012, w * 0.045 + jawOpen * w * 0.03); ctx.lineTo(tx + w * 0.024, w * 0.015); ctx.closePath(); ctx.fill();
  }
  // fire glowing in the throat, building to a blast
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.35 + charge * 0.65;
  const mg = ctx.createRadialGradient(w * 0.18, w * 0.04, 1, w * 0.18, w * 0.04, w * (0.08 + charge * 0.16));
  mg.addColorStop(0, "rgba(255,245,150,1)");
  mg.addColorStop(0.5, "rgba(255,100,20,0.8)");
  mg.addColorStop(1, "rgba(180,20,0,0)");
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(w * 0.18, w * 0.04, w * (0.08 + charge * 0.16), 0, Math.PI * 2); ctx.fill();
  // burning eye
  ctx.globalAlpha = 0.8 + 0.2 * dark;
  ctx.fillStyle = hot;
  ctx.beginPath(); ctx.arc(w * 0.06, -w * 0.045, w * 0.035, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = flash ? "#fff" : "#3c0a06";
  ctx.beginPath(); ctx.arc(w * 0.065, -w * 0.045, w * 0.013, 0, Math.PI * 2); ctx.fill();
  // smoke curling from the nostril
  ctx.save(); ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#2a1512";
  for (let k = 0; k < 2; k++) {
    const st = (T * 0.9 + k * 0.5) % 1;
    ctx.beginPath(); ctx.arc(w * 0.27 + Math.sin((T + k) * 4) * 2, -w * 0.03 - st * w * 0.14, (1 - st) * 2.6 + 0.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.restore();

  wing(-flap * 0.85 - 0.15, scale, scaleDk, 1); // near wing, sweeping in front

  // embers streaming off the beast
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.6;
  ctx.fillStyle = hot;
  for (let k = 0; k < 5; k++) {
    const et2 = (T * 0.6 + k * 0.21) % 1;
    ctx.beginPath();
    ctx.arc(-w * 0.3 + k * w * 0.16 + Math.sin((T + k * 1.7) * 4) * 6, yc + w * 0.2 + et2 * w * 0.4, 1.6 * (1 - et2) + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Night-10 boss: towering magma colossus. It is rendered as layered basalt
// plates around a molten core, with separate poses for slam and boulder volleys.
function drawMagmaGolem(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const w = t.w;
  const flash = e.flash > 0 && !e.dying;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const smooth = v => {
    v = clamp01(v);
    return v * v * (3 - 2 * v);
  };
  const mix = (a, b, p) => a + (b - a) * p;
  const mixPt = (a, b, p) => ({ x: mix(a.x, b.x, p), y: mix(a.y, b.y, p) });
  const poly = pts => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  };

  // Cooler charcoal plates make the magma read as dangerous light inside
  // ancient stone instead of as a uniformly warm, toy-like boulder.
  const obsidian = flash ? "#fff" : "#15181d";
  const basalt = flash ? "#fff" : "#252a31";
  const basalt2 = flash ? "#fff" : "#353c45";
  const basalt3 = flash ? "#fff" : "#48515b";
  const rimStone = flash ? "#fff" : "#69737b";
  const shadow = flash ? "#fff" : "#090b0e";
  const ember = e.enraged ? "#ff4829" : "#f45a21";
  const hot = "#ffae4a";
  const whiteHot = "#ffe7a6";

  const coreOpen = !!e.coreOpen;
  const coreOpenVisual = smooth(e.coreVisualOpen ?? (coreOpen ? 1 : 0));
  const coreFlare = clamp01(e.coreFlare || 0);
  const eruptionP = clamp01((e.eruptionAnim || 0) / 1.4);
  const windupP = e.slamT !== undefined ? clamp01(e.slamT / 0.85) : 0;
  const slamP = clamp01((e.golemSlamImpact || 0) / 0.2);
  const slamRecover = clamp01(1 - (e.golemSlamRecover || 0) / 0.5);
  const hurlHold = clamp01(e.golemHurlCharge || 0);
  const throwAge = clamp01(1 - (e.golemHurlRelease || 0) / 0.28);
  const hurlActive = hurlHold > 0.02 || (e.golemHurlRelease || 0) > 0.02;
  const hurlPulse = hurlActive ? (0.72 + 0.14 * Math.sin(T * 9)) : 0;
  const siegeKind = e.golemWallAttackKind || '';
  const siegeT = e.golemWallAttackT;
  const siegeActive = siegeT !== undefined && !!siegeKind;
  const siegePhase = (start, duration) => siegeActive ? smooth((siegeT - start) / duration) : 0;
  const wallRam = siegeActive && siegeKind === 'ram';
  const wallCrush = siegeActive && siegeKind === 'crush';
  const ramLoad = wallRam ? siegePhase(0, 0.48) : 0;
  const ramStrike = wallRam ? siegePhase(0.48, 0.11) : 0;
  const ramRecover = wallRam ? siegePhase(0.59, 0.53) : 0;
  const crushLift = wallCrush ? siegePhase(0, 0.7) : 0;
  const crushDrop = wallCrush ? siegePhase(0.7, 0.12) : 0;
  const crushRecover = wallCrush ? siegePhase(0.82, 0.6) : 0;
  const wallImpact = clamp01((e.golemWallImpact || 0) / (siegeKind === 'crush' ? 0.22 : 0.18));
  const ramLean = wallRam ? (siegeT < 0.48 ? -ramLoad : (siegeT < 0.59 ? -1 + 2 * ramStrike : 1 - ramRecover)) : 0;
  const crushLean = wallCrush ? (siegeT < 0.7 ? -crushLift * 0.52 : (1 - crushRecover) * crushDrop * 0.46) : 0;
  const slamEase = smooth(slamP);
  const walkBlend = clamp01(e.golemWalkBlend || 0);
  const step = Math.sin((e.golemWalkPhase || 0) * Math.PI * 2) * walkBlend;
  const stride = step * w * 0.075 * (1 - windupP * 0.82 - slamEase * 0.9);
  const stepImpact = clamp01(e.golemStepImpact || 0);
  const bob = Math.abs(step) * 4.5 - windupP * w * 0.055 + slamEase * w * 0.04 + stepImpact * 1.8 - crushLift * w * 0.022;
  const bodyShift = -bob;

  // Basalt should feel like rigid slabs. The old live sine deformation made
  // every plate breathe in sync, which was the biggest source of cartoon feel.
  function rockBlob(cx, cy, rx, ry, rot, fill, stroke = shadow, spikes = 8, seed = 0) {
    const facets = [0.93, 1.04, 0.88, 1.02, 0.91, 1.06, 0.9, 1.0, 0.86, 1.03, 0.95];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      const n = facets[(i + seed) % facets.length];
      const px = Math.cos(a) * rx * n;
      const py = Math.sin(a) * ry * n;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(1.1, w * 0.01);
      ctx.stroke();
    }
    ctx.restore();
  }

  function lavaCrack(points, width = 1.8, alpha = 1) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = ember;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,224,120,0.55)";
    ctx.lineWidth = Math.max(0.8, width * 0.42);
    ctx.stroke();
    ctx.restore();
  }

  // Ground mass, molten shadow and slam shock rings.
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.beginPath();
  ctx.ellipse(0, groundY - 1, w * (0.58 + slamEase * 0.15), 11 + slamEase * 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.18 + (coreOpen ? 0.16 : 0) + coreFlare * 0.18 + eruptionP * 0.22;
  const floorGlow = ctx.createRadialGradient(0, groundY - 4, 4, 0, groundY - 4, w * 0.86);
  floorGlow.addColorStop(0, "rgba(255,170,48,0.75)");
  floorGlow.addColorStop(1, "rgba(120,18,0,0)");
  ctx.fillStyle = floorGlow;
  ctx.beginPath();
  ctx.ellipse(0, groundY - 5, w * 0.86, w * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  if (slamP > 0.03) {
    const spread = (1 - slamP) * w * 0.52;
    for (let k = 0; k < 3; k++) {
      ctx.globalAlpha = slamP * (0.42 - k * 0.09);
      ctx.strokeStyle = k === 0 ? hot : ember;
      ctx.lineWidth = 3 - k * 0.45;
      ctx.beginPath();
      ctx.ellipse(0, groundY - 4, w * (0.42 + k * 0.2) + spread, w * (0.12 + k * 0.04) + spread * 0.17, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (wallImpact > 0.03) {
    const hitX = w * 0.72;
    const hitY = groundY - w * (siegeKind === 'crush' ? 0.58 : 0.43);
    ctx.globalAlpha = wallImpact * 0.72;
    const impactGlow = ctx.createRadialGradient(hitX, hitY, 2, hitX, hitY, w * 0.26);
    impactGlow.addColorStop(0, 'rgba(255,228,145,0.84)');
    impactGlow.addColorStop(0.36, 'rgba(255,96,24,0.48)');
    impactGlow.addColorStop(1, 'rgba(120,18,0,0)');
    ctx.fillStyle = impactGlow;
    ctx.beginPath(); ctx.arc(hitX, hitY, w * 0.26, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = hot;
    ctx.lineWidth = 2.2;
    for (let k = 0; k < 3; k++) {
      const y = hitY + (k - 1) * w * 0.052;
      ctx.beginPath(); ctx.moveTo(hitX - w * 0.06, y); ctx.lineTo(hitX + w * (0.11 + k * 0.035), y + (k - 1) * 3); ctx.stroke();
    }
  }
  ctx.restore();

  // Heat aura and eruption flare.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = (coreOpen ? 0.28 : 0.14) + coreFlare * 0.22 + eruptionP * 0.22 + (e.enraged ? 0.08 : 0);
  const aura = ctx.createRadialGradient(0, groundY - w * 0.56, 10, 0, groundY - w * 0.56, w * 1.18);
  aura.addColorStop(0, "rgba(255,186,64,0.66)");
  aura.addColorStop(0.52, "rgba(255,88,24,0.24)");
  aura.addColorStop(1, "rgba(120,10,0,0)");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.ellipse(0, groundY - w * 0.56, w * 1.02, w * 0.84, 0, 0, Math.PI * 2);
  ctx.fill();
  if (eruptionP > 0.02) {
    for (let k = 0; k < 6; k++) {
      const ex = -w * 0.34 + k * w * 0.13;
      const h = Math.max(0.05 * w, w * (0.14 + 0.16 * Math.sin(T * 4 + k) + 0.25 * eruptionP));
      ctx.globalAlpha = eruptionP * (0.2 + k % 2 * 0.08);
      ctx.fillStyle = k % 2 ? hot : ember;
      ctx.beginPath();
      ctx.ellipse(ex, groundY - w * 0.28 - h * 0.5, w * 0.025, h, Math.sin(T + k) * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // A few dense vents read as pressure escaping from a giant furnace; many
  // evenly distributed puffs made its silhouette feel noisy and weightless.
  ctx.save();
  ctx.fillStyle = "#101216";
  for (let k = 0; k < 4; k++) {
    const st = (T * (0.18 + k * 0.035) + k * 0.24) % 1;
    ctx.globalAlpha = (0.14 + dark * 0.05 + coreOpenVisual * 0.05) * (1 - st);
    const sx = (-0.28 + k * 0.17) * w + Math.sin(T * 1.45 + k) * 4;
    const sy = groundY - w * (1.02 + (k % 2) * 0.1) + bodyShift - st * w * 0.34;
    ctx.beginPath();
    ctx.ellipse(sx, sy, w * (0.025 + st * 0.025), w * (0.018 + st * 0.032), Math.sin(T + k), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  function drawLeg(sgn, front) {
    const phase = step * (front ? 1 : -1);
    const lift = Math.max(0, phase) * w * 0.075 * (1 - slamEase);
    const hipX = sgn * w * 0.145 - stride * 0.12;
    const kneeX = sgn * w * 0.19 + stride * (front ? 0.22 : -0.12);
    const footX = sgn * w * 0.27 + stride * (front ? 0.52 : -0.34);
    const hipY = groundY - w * 0.48 + bodyShift * 0.35;
    const kneeY = groundY - w * 0.22 - lift * 0.4;
    const footY = groundY - lift + slamEase * 4;
    ctx.save();
    ctx.globalAlpha = front ? 1 : 0.82;
    // Long, faceted pillar legs make its mass read vertically rather than as
    // a squat pile of rocks.
    ctx.fillStyle = front ? basalt2 : basalt;
    poly([
      [hipX - w * 0.105, hipY - w * 0.01],
      [hipX + w * 0.09, hipY + w * 0.03],
      [kneeX + w * 0.09, kneeY + w * 0.02],
      [kneeX - w * 0.1, kneeY + w * 0.035],
    ]);
    ctx.fill();
    ctx.fillStyle = front ? basalt3 : obsidian;
    poly([
      [kneeX - w * 0.09, kneeY],
      [kneeX + w * 0.082, kneeY - w * 0.012],
      [footX + w * 0.095, footY - w * 0.045],
      [footX - w * 0.11, footY - w * 0.038],
    ]);
    ctx.fill();
    ctx.fillStyle = front ? obsidian : shadow;
    poly([
      [footX - w * 0.19, footY - w * 0.06],
      [footX + w * 0.155, footY - w * 0.055],
      [footX + w * 0.2, footY - 3],
      [footX + w * 0.115, footY + 2],
      [footX - w * 0.18, footY + 1],
      [footX - w * 0.23, footY - 4],
    ]);
    ctx.fill();
    rockBlob(kneeX, kneeY + w * 0.005, w * 0.11, w * 0.07, 0.05 * sgn, front ? basalt3 : basalt2, shadow, 7, front ? 3 : 7);
    ctx.strokeStyle = front ? rimStone : "rgba(105,115,123,0.45)";
    ctx.globalAlpha *= 0.5;
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(hipX - w * 0.06, hipY); ctx.lineTo(kneeX - w * 0.035, kneeY - w * 0.02); ctx.stroke();
    ctx.globalAlpha = front ? 1 : 0.82;
    lavaCrack([[kneeX - w * 0.06, kneeY + w * 0.018], [kneeX + w * 0.005, kneeY - w * 0.012], [kneeX + w * 0.064, kneeY + w * 0.009]], 1.25, 0.22 + coreOpenVisual * 0.28);
    lavaCrack([[footX - w * 0.09, footY - 5], [footX - w * 0.01, footY - 8], [footX + w * 0.075, footY - 4]], 1.1, front ? 0.38 : 0.2);
    ctx.restore();
  }

  drawLeg(-1, false);
  drawLeg(1, true);

  function armPose(front) {
    const idle = {
      shoulder: { x: (front ? 0.29 : -0.31) * w, y: groundY - w * (front ? 0.99 : 1.02) + bodyShift },
      elbow: { x: (front ? 0.46 : -0.46) * w, y: groundY - w * (front ? 0.56 : 0.5) + bodyShift * 0.32 },
      fist: { x: (front ? 0.52 : -0.5) * w, y: groundY - w * (front ? 0.13 : 0.19) + step * (front ? 1.8 : -1.3) },
    };
    const slamUp = {
      shoulder: idle.shoulder,
      elbow: { x: (front ? 0.26 : -0.17) * w, y: groundY - w * 1.28 + bodyShift },
      fist: { x: (front ? 0.08 : -0.07) * w, y: groundY - w * 1.43 + bodyShift },
    };
    const slamDown = {
      shoulder: idle.shoulder,
      elbow: { x: (front ? 0.48 : -0.4) * w, y: groundY - w * 0.34 },
      fist: { x: (front ? 0.56 : -0.45) * w, y: groundY - w * 0.03 },
    };
    const hurlLoad = {
      shoulder: idle.shoulder,
      elbow: { x: front ? w * 0.08 : -w * 0.49, y: front ? groundY - w * 1.3 + bodyShift : groundY - w * 0.48 },
      fist: { x: front ? -w * 0.08 : -w * 0.54, y: front ? groundY - w * 1.34 + bodyShift : groundY - w * 0.2 },
    };
    const hurlRelease = {
      shoulder: idle.shoulder,
      elbow: { x: front ? w * 0.55 : -w * 0.44, y: front ? groundY - w * 0.77 : groundY - w * 0.35 },
      fist: { x: front ? w * 0.72 : -w * 0.49, y: front ? groundY - w * 0.61 : groundY - w * 0.15 },
    };
    const wallRamLoad = {
      shoulder: idle.shoulder,
      elbow: front
        ? { x: w * 0.04, y: groundY - w * 0.86 }
        : { x: -w * 0.56, y: groundY - w * 0.62 },
      fist: front
        ? { x: -w * 0.16, y: groundY - w * 0.63 }
        : { x: -w * 0.65, y: groundY - w * 0.34 },
    };
    const wallRamHit = {
      shoulder: idle.shoulder,
      elbow: front
        ? { x: w * 0.57, y: groundY - w * 0.74 }
        : { x: -w * 0.34, y: groundY - w * 0.68 },
      fist: front
        ? { x: w * 0.9, y: groundY - w * 0.55 }
        : { x: w * 0.02, y: groundY - w * 0.58 },
    };
    const wallCrushUp = {
      shoulder: idle.shoulder,
      elbow: front
        ? { x: w * 0.18, y: groundY - w * 1.36 }
        : { x: -w * 0.08, y: groundY - w * 1.34 },
      fist: front
        ? { x: w * 0.34, y: groundY - w * 1.53 }
        : { x: w * 0.1, y: groundY - w * 1.51 },
    };
    const wallCrushHit = {
      shoulder: idle.shoulder,
      elbow: front
        ? { x: w * 0.52, y: groundY - w * 0.72 }
        : { x: w * 0.22, y: groundY - w * 0.73 },
      fist: front
        ? { x: w * 0.72, y: groundY - w * 0.39 }
        : { x: w * 0.42, y: groundY - w * 0.42 },
    };

    let pose = idle;
    if (hurlActive && windupP <= 0 && slamP <= 0) {
      const p = front ? smooth(throwAge) : 0;
      const held = front ? hurlLoad : hurlRelease;
      pose = {
        shoulder: idle.shoulder,
        elbow: mixPt(held.elbow, hurlRelease.elbow, p),
        fist: mixPt(held.fist, hurlRelease.fist, p),
      };
      if (!front && hurlHold) pose = hurlLoad;
    }
    if (windupP > 0) {
      const p = smooth(windupP);
      pose = {
        shoulder: idle.shoulder,
        elbow: mixPt(idle.elbow, slamUp.elbow, p),
        fist: mixPt(idle.fist, slamUp.fist, p),
      };
    }
    if (slamP > 0) {
      const p = smooth(slamP);
      pose = {
        shoulder: idle.shoulder,
        elbow: mixPt(idle.elbow, slamDown.elbow, p),
        fist: mixPt(idle.fist, slamDown.fist, p),
      };
    } else if ((e.golemSlamRecover || 0) > 0) {
      const p = smooth(slamRecover);
      pose = {
        shoulder: idle.shoulder,
        elbow: mixPt(slamDown.elbow, idle.elbow, p),
        fist: mixPt(slamDown.fist, idle.fist, p),
      };
    }
    // Wall siege moves deliberately override the generic combat poses. The
    // ram pulls one arm far back before a horizontal breach, while the crush
    // lifts both fists together and drops them onto the parapet.
    if (wallRam) {
      if (siegeT < 0.48) {
        pose = {
          shoulder: idle.shoulder,
          elbow: mixPt(idle.elbow, wallRamLoad.elbow, ramLoad),
          fist: mixPt(idle.fist, wallRamLoad.fist, ramLoad),
        };
      } else if (siegeT < 0.59) {
        pose = {
          shoulder: idle.shoulder,
          elbow: mixPt(wallRamLoad.elbow, wallRamHit.elbow, ramStrike),
          fist: mixPt(wallRamLoad.fist, wallRamHit.fist, ramStrike),
        };
      } else {
        pose = {
          shoulder: idle.shoulder,
          elbow: mixPt(wallRamHit.elbow, idle.elbow, ramRecover),
          fist: mixPt(wallRamHit.fist, idle.fist, ramRecover),
        };
      }
    } else if (wallCrush) {
      if (siegeT < 0.7) {
        pose = {
          shoulder: idle.shoulder,
          elbow: mixPt(idle.elbow, wallCrushUp.elbow, crushLift),
          fist: mixPt(idle.fist, wallCrushUp.fist, crushLift),
        };
      } else if (siegeT < 0.82) {
        pose = {
          shoulder: idle.shoulder,
          elbow: mixPt(wallCrushUp.elbow, wallCrushHit.elbow, crushDrop),
          fist: mixPt(wallCrushUp.fist, wallCrushHit.fist, crushDrop),
        };
      } else {
        pose = {
          shoulder: idle.shoulder,
          elbow: mixPt(wallCrushHit.elbow, idle.elbow, crushRecover),
          fist: mixPt(wallCrushHit.fist, idle.fist, crushRecover),
        };
      }
    }
    return pose;
  }

  function drawMagmaBoulder(x, y, r, charge) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.65 + charge * 0.25;
    const bg = ctx.createRadialGradient(x, y, 2, x, y, r * (2.2 + charge));
    bg.addColorStop(0, "rgba(255,245,170,1)");
    bg.addColorStop(0.35, "rgba(255,126,28,0.88)");
    bg.addColorStop(1, "rgba(160,18,0,0)");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(x, y, r * (2.1 + charge), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    rockBlob(x, y, r * 0.9, r * 0.75, T * 0.8, basalt2, shadow, 9);
    lavaCrack([[x - r * 0.5, y - r * 0.08], [x, y - r * 0.35], [x + r * 0.5, y - r * 0.03]], 1.7, 0.9);
    lavaCrack([[x - r * 0.32, y + r * 0.25], [x + r * 0.1, y + r * 0.05], [x + r * 0.43, y + r * 0.32]], 1.4, 0.75);
  }

  function drawArm(pose, front) {
    ctx.save();
    ctx.globalAlpha = front ? 1 : 0.84;
    const slab = (a, b, aw, bw, fill) => {
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const nx = -dy / len, ny = dx / len;
      ctx.fillStyle = fill;
      poly([
        [a.x + nx * aw, a.y + ny * aw],
        [a.x - nx * aw, a.y - ny * aw],
        [b.x - nx * bw, b.y - ny * bw],
        [b.x + nx * bw, b.y + ny * bw],
      ]);
      ctx.fill();
      ctx.strokeStyle = shadow;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.strokeStyle = "rgba(176,190,199,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a.x + nx * aw * 0.48, a.y + ny * aw * 0.48); ctx.lineTo(b.x + nx * bw * 0.42, b.y + ny * bw * 0.42); ctx.stroke();
    };
    const hand = { x: pose.fist.x, y: pose.fist.y - w * 0.025 };
    slab(pose.shoulder, pose.elbow, w * 0.09, w * 0.072, front ? basalt2 : basalt);
    slab(pose.elbow, hand, w * 0.078, w * 0.095, front ? basalt3 : basalt2);
    rockBlob(pose.shoulder.x, pose.shoulder.y, w * 0.105, w * 0.075, front ? 0.18 : -0.2, front ? basalt3 : basalt, shadow, 7, front ? 2 : 5);
    rockBlob(pose.elbow.x, pose.elbow.y, w * 0.09, w * 0.068, front ? -0.12 : 0.15, front ? basalt3 : basalt2, shadow, 7, front ? 6 : 9);
    ctx.fillStyle = front ? basalt3 : basalt2;
    poly([
      [hand.x - w * 0.145, hand.y - w * 0.1],
      [hand.x + w * 0.08, hand.y - w * 0.12],
      [hand.x + w * 0.16, hand.y - w * 0.045],
      [hand.x + w * 0.13, hand.y + w * 0.1],
      [hand.x - w * 0.09, hand.y + w * 0.12],
      [hand.x - w * 0.18, hand.y + w * 0.02],
    ]);
    ctx.fill();
    ctx.strokeStyle = shadow; ctx.lineWidth = 1.5; ctx.stroke();
    // Three blunt, blocky knuckles replace the round mitten silhouette.
    ctx.fillStyle = obsidian;
    for (let k = 0; k < 3; k++) {
      const kx = hand.x + w * (0.015 + k * 0.052);
      const ky = hand.y + w * (0.018 + k * 0.012);
      poly([[kx - w * 0.023, ky - w * 0.035], [kx + w * 0.032, ky - w * 0.02], [kx + w * 0.024, ky + w * 0.05], [kx - w * 0.027, ky + w * 0.038]]);
      ctx.fill();
    }
    lavaCrack([[pose.elbow.x - w * 0.048, pose.elbow.y], [pose.elbow.x + w * 0.02, pose.elbow.y - w * 0.03], [pose.elbow.x + w * 0.058, pose.elbow.y + w * 0.012]], 1.15, front ? 0.38 : 0.22);
    lavaCrack([[hand.x - w * 0.09, hand.y - w * 0.035], [hand.x - w * 0.015, hand.y - w * 0.07], [hand.x + w * 0.08, hand.y - w * 0.025]], 1.35, 0.34 + hurlPulse * 0.28);
    if (front && hurlHold > 0.12 && (e.golemHurlRelease || 0) <= 0.01) {
      const charge = 0.68 + hurlHold * 0.25 + Math.sin(T * 9) * 0.05;
      drawMagmaBoulder(hand.x + w * 0.01, hand.y - w * 0.16, w * 0.083, charge);
    }
    ctx.restore();
  }

  drawArm(armPose(false), false);

  // Torso: layered obsidian plates around the molten heart.
  ctx.save();
  const pivotY = groundY - w * 0.73;
  ctx.translate(0, pivotY + bodyShift + slamEase * w * 0.02);
  ctx.rotate(step * 0.024 - windupP * 0.095 + slamEase * 0.075 - (hurlActive ? 0.045 : 0) + ramLean * 0.14 + crushLean * 0.09);
  ctx.translate(0, -pivotY);

  ctx.fillStyle = shadow;
  poly([
    [-w * 0.34, groundY - w * 0.23],
    [-w * 0.47, groundY - w * 0.62],
    [-w * 0.37, groundY - w * 0.96],
    [-w * 0.22, groundY - w * 1.22],
    [-w * 0.02, groundY - w * 1.34],
    [w * 0.24, groundY - w * 1.21],
    [w * 0.4, groundY - w * 0.88],
    [w * 0.37, groundY - w * 0.52],
    [w * 0.25, groundY - w * 0.29],
    [-w * 0.02, groundY - w * 0.17],
  ]);
  ctx.fill();

  const bodyGrad = ctx.createLinearGradient(-w * 0.36, groundY - w * 1.22, w * 0.34, groundY - w * 0.2);
  bodyGrad.addColorStop(0, basalt2);
  bodyGrad.addColorStop(0.42, basalt);
  bodyGrad.addColorStop(1, obsidian);
  ctx.fillStyle = bodyGrad;
  poly([
    [-w * 0.29, groundY - w * 0.25],
    [-w * 0.4, groundY - w * 0.62],
    [-w * 0.29, groundY - w * 0.98],
    [-w * 0.14, groundY - w * 1.18],
    [w * 0.06, groundY - w * 1.26],
    [w * 0.27, groundY - w * 1.12],
    [w * 0.34, groundY - w * 0.82],
    [w * 0.31, groundY - w * 0.49],
    [w * 0.21, groundY - w * 0.28],
    [-w * 0.01, groundY - w * 0.2],
  ]);
  ctx.fill();

  // Interlocking armor slabs create a tapered, cathedral-like torso instead
  // of a symmetric pile of rounded stones.
  const plates = [
    { c: basalt3, pts: [[-0.31, -0.82], [-0.16, -1.05], [-0.03, -0.98], [-0.08, -0.72], [-0.29, -0.65]] },
    { c: basalt2, pts: [[0.0, -1.06], [0.2, -1.0], [0.3, -0.76], [0.13, -0.65], [0.0, -0.76]] },
    { c: basalt, pts: [[-0.3, -0.61], [-0.08, -0.69], [0.01, -0.5], [-0.1, -0.32], [-0.31, -0.37]] },
    { c: obsidian, pts: [[0.08, -0.61], [0.3, -0.53], [0.23, -0.3], [0.06, -0.28], [-0.01, -0.46]] },
    { c: basalt2, pts: [[-0.13, -1.23], [0.08, -1.27], [0.2, -1.12], [0.04, -1.01], [-0.17, -1.09]] },
  ];
  for (const p of plates) {
    ctx.fillStyle = p.c;
    poly(p.pts.map(([x, y]) => [x * w, groundY + y * w]));
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(190,208,214,0.075)";
  poly([[-w * 0.25, groundY - w * 0.95], [-w * 0.17, groundY - w * 1.06], [-w * 0.12, groundY - w * 0.74], [-w * 0.22, groundY - w * 0.67]]);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  poly([[w * 0.17, groundY - w * 0.84], [w * 0.29, groundY - w * 0.7], [w * 0.21, groundY - w * 0.39], [w * 0.1, groundY - w * 0.47]]);
  ctx.fill();

  const crackAlpha = 0.22 + coreOpenVisual * 0.52 + coreFlare * 0.3 + Math.sin(T * 7) * 0.045;
  lavaCrack([[-w * 0.29, groundY - w * 0.43], [-w * 0.18, groundY - w * 0.55], [-w * 0.22, groundY - w * 0.71], [-w * 0.08, groundY - w * 0.82]], 1.65, crackAlpha);
  lavaCrack([[w * 0.13, groundY - w * 0.38], [w * 0.24, groundY - w * 0.56], [w * 0.17, groundY - w * 0.75]], 1.6, crackAlpha);
  lavaCrack([[-w * 0.06, groundY - w * 0.95], [w * 0.03, groundY - w * 1.08], [w * 0.14, groundY - w * 1.02]], 1.25, crackAlpha * 0.72);

  // Three asymmetric volcanic fins give a strong silhouette without a cute
  // crown of evenly-spaced spikes.
  ctx.fillStyle = obsidian;
  const fins = [[-0.36, -0.9, 0.2], [-0.16, -1.18, 0.16], [0.15, -1.11, 0.14], [0.31, -0.82, 0.12]];
  for (const [fx, fy, fh] of fins) {
    const sx = fx * w, sy = groundY + fy * w, sh = fh * w;
    poly([[sx - w * 0.045, sy], [sx + w * 0.005, sy - sh], [sx + w * 0.05, sy + w * 0.008]]);
    ctx.fill();
  }

  // A narrow, vertical furnace rift replaces the round "stove" core. Its
  // shutters physically move apart as the vulnerable phase begins.
  const cx = -w * 0.015;
  const cy = groundY - w * 0.69;
  const coreH = w * 0.205;
  const coreW = w * (0.035 + coreOpenVisual * 0.105 + coreFlare * 0.025);
  const pulse = 1 + Math.sin(T * (coreOpen ? 8.5 : 3.2)) * (0.035 + coreOpenVisual * 0.065) + coreFlare * 0.12;
  ctx.fillStyle = shadow;
  poly([
    [cx - coreW * 1.2, cy - coreH * 1.1], [cx + coreW * 1.05, cy - coreH * 0.92],
    [cx + coreW * 1.38, cy - coreH * 0.2], [cx + coreW * 0.96, cy + coreH * 1.08],
    [cx - coreW * 1.1, cy + coreH * 0.98], [cx - coreW * 1.35, cy + coreH * 0.15],
  ]);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.15 + coreOpenVisual * 0.56 + coreFlare * 0.32;
  const coreGlow = ctx.createRadialGradient(cx, cy, 2, cx, cy, coreH * (1.25 + coreOpenVisual * 1.35 + coreFlare));
  coreGlow.addColorStop(0, "rgba(255,237,170,0.95)");
  coreGlow.addColorStop(0.34, "rgba(255,130,35,0.64)");
  coreGlow.addColorStop(1, "rgba(150,18,0,0)");
  ctx.fillStyle = coreGlow;
  ctx.beginPath(); ctx.ellipse(cx, cy, coreH * 0.82, coreH * 1.32, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = ember;
  poly([
    [cx - coreW * 0.34, cy - coreH * 0.9], [cx + coreW * 0.38, cy - coreH * 0.58],
    [cx + coreW * 0.2, cy - coreH * 0.12], [cx + coreW * 0.5, cy + coreH * 0.3],
    [cx - coreW * 0.18, cy + coreH * 0.88], [cx - coreW * 0.42, cy + coreH * 0.2],
  ]);
  ctx.fill();
  ctx.fillStyle = whiteHot;
  ctx.globalAlpha = 0.42 + coreOpenVisual * 0.5 + coreFlare * 0.08;
  poly([
    [cx - coreW * 0.12, cy - coreH * 0.62], [cx + coreW * 0.17, cy - coreH * 0.3],
    [cx - coreW * 0.03, cy + coreH * 0.08], [cx + coreW * 0.13, cy + coreH * 0.35],
    [cx - coreW * 0.11, cy + coreH * 0.67], [cx - coreW * 0.22, cy + coreH * 0.05],
  ]);
  ctx.fill();
  ctx.globalAlpha = 1;

  const shutter = (side, yOffset, rot) => {
    ctx.save();
    ctx.translate(cx + side * coreOpenVisual * w * 0.16, cy + yOffset * w * coreOpenVisual * 0.2);
    ctx.rotate(side * rot * coreOpenVisual);
    ctx.fillStyle = side > 0 ? basalt2 : basalt3;
    poly([
      [side * -w * 0.015, -coreH * 1.03], [side * w * 0.14, -coreH * 0.73],
      [side * w * 0.12, coreH * 0.82], [side * -w * 0.045, coreH * 1.05],
    ]);
    ctx.fill();
    ctx.strokeStyle = shadow; ctx.lineWidth = 1.35; ctx.stroke();
    ctx.strokeStyle = "rgba(193,210,220,0.12)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(side * w * 0.02, -coreH * 0.8); ctx.lineTo(side * w * 0.075, coreH * 0.68); ctx.stroke();
    ctx.restore();
  };
  shutter(-1, -0.2, 0.38);
  shutter(1, 0.14, 0.32);
  ctx.fillStyle = obsidian;
  poly([[cx - w * 0.11, cy + coreH * 0.83], [cx + w * 0.105, cy + coreH * 0.76], [cx + w * 0.075, cy + coreH * 1.02], [cx - w * 0.085, cy + coreH * 1.06]]);
  ctx.fill();

  // Recessed helm: a single hard visor slit and thick brow are menacing at a
  // glance, and avoid the round eyes / smiling mouth of the old version.
  const hx = w * 0.12 + (hurlActive ? w * 0.025 : 0);
  const hy = groundY - w * 1.22 + bodyShift * 0.5 + windupP * w * 0.06 + slamEase * w * 0.026;
  ctx.fillStyle = shadow;
  poly([[hx - w * 0.14, hy + w * 0.11], [hx - w * 0.11, hy - w * 0.1], [hx - w * 0.035, hy - w * 0.19], [hx + w * 0.13, hy - w * 0.13], [hx + w * 0.19, hy + w * 0.02], [hx + w * 0.12, hy + w * 0.16], [hx - w * 0.055, hy + w * 0.18]]);
  ctx.fill();
  ctx.fillStyle = basalt3;
  poly([[hx - w * 0.11, hy + w * 0.075], [hx - w * 0.075, hy - w * 0.085], [hx + w * 0.085, hy - w * 0.095], [hx + w * 0.15, hy + w * 0.015], [hx + w * 0.075, hy + w * 0.115], [hx - w * 0.075, hy + w * 0.12]]);
  ctx.fill();
  ctx.fillStyle = obsidian;
  poly([[hx - w * 0.12, hy - w * 0.04], [hx + w * 0.145, hy - w * 0.075], [hx + w * 0.112, hy + w * 0.008], [hx - w * 0.095, hy + w * 0.036]]);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.32 + dark * 0.18 + coreFlare * 0.28 + (e.enraged ? 0.12 : 0);
  ctx.fillStyle = e.enraged ? "#ff5431" : hot;
  poly([[hx - w * 0.083, hy - w * 0.025], [hx + w * 0.105, hy - w * 0.05], [hx + w * 0.077, hy - w * 0.008], [hx - w * 0.06, hy + w * 0.011]]);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = rimStone;
  ctx.globalAlpha = 0.26;
  poly([[hx - w * 0.06, hy - w * 0.12], [hx + w * 0.065, hy - w * 0.13], [hx + w * 0.09, hy - w * 0.1], [hx - w * 0.075, hy - w * 0.09]]);
  ctx.fill(); ctx.globalAlpha = 1;
  // Horn-like collar shards are deliberately uneven and sit behind the mask.
  ctx.fillStyle = obsidian;
  poly([[hx - w * 0.11, hy - w * 0.11], [hx - w * 0.17, hy - w * 0.25], [hx - w * 0.04, hy - w * 0.14]]); ctx.fill();
  poly([[hx + w * 0.09, hy - w * 0.12], [hx + w * 0.15, hy - w * 0.22], [hx + w * 0.17, hy - w * 0.07]]); ctx.fill();
  lavaCrack([[hx - w * 0.08, hy + w * 0.085], [hx - w * 0.005, hy + w * 0.115], [hx + w * 0.1, hy + w * 0.076]], 1.15, 0.3 + coreOpenVisual * 0.26);

  ctx.restore();

  drawArm(armPose(true), true);

  // Sparse sparks and ash only appear around active heat. Constant orbiting
  // particles made the whole body feel buoyant instead of impossibly heavy.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const cinderCount = e.enraged ? 6 : (coreOpenVisual > 0.35 ? 4 : 2);
  for (let k = 0; k < cinderCount; k++) {
    const driftT = (T * (0.28 + k * 0.045) + k * 0.31) % 1;
    const dx = -w * 0.23 + k * w * 0.105 + Math.sin(T * 1.6 + k * 2.1) * 4;
    const dy = groundY - w * (0.74 + (k % 3) * 0.11) - driftT * w * (0.22 + k * 0.025);
    ctx.globalAlpha = (0.18 + coreOpenVisual * 0.32 + e.enraged * 0.12) * (1 - driftT * 0.72);
    ctx.fillStyle = k % 2 ? hot : ember;
    ctx.beginPath();
    ctx.ellipse(dx, dy, 1 + (k % 3) * 0.38, 2.4 * (1 - driftT) + 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Siege Imp: a squat, over-armored brute hauling a huge plank shield and a
// skull-headed battering ram, with a scrap platform on its back for riders.
// Draws facing +x (drawEnemies mirrors for dir < 0). Riders are drawn as their
// own imps by the main loop. Shield lowers and the ram thrusts when it slams.
// ─────────────────────────────────────────────────────────────────────────────
function drawSiegeImp(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

  const body = flash ? "#fff" : "#8a3520";
  const bodyDk = flash ? "#fff" : "#491a10";
  const bodyMid = flash ? "#fff" : "#a8542a";
  const iron = flash ? "#fff" : "#4a4e56";
  const ironDk = flash ? "#fff" : "#282c32";
  const ironLt = flash ? "#fff" : "#6c7078";
  const wood = flash ? "#fff" : "#5a3f24";
  const woodDk = flash ? "#fff" : "#382614";
  const woodLt = flash ? "#fff" : "#7c5c38";
  const hornCol = flash ? "#fff" : "#2a1410";
  const ember = "#ff7a24";
  const hot = "#ffd060";

  // ram animation: haul back through the wind-up, punch forward on the strike
  const windMax = t.ramWindup || 0.72;
  const winding = (e.ramWind || 0) > 0 && !e.dying;
  const windP = winding ? clamp01(1 - (e.ramWind || 0) / windMax) : 0;
  const strikeP = (e.ramStruck && (e.attackAnim || 0) > 0 && !e.dying) ? clamp01((e.attackAnim || 0) / 0.32) : 0;
  const ramX = winding ? -7 * windP : 13 * strikeP;
  // smoothed shield tilt (0 up, 1 dropped forward for the ram)
  const shTarget = e.shieldDown && !e.dying ? 1 : 0;
  e._sShield = (e._sShield ?? shTarget) + (shTarget - (e._sShield ?? shTarget)) * 0.25;
  const shDrop = e._sShield;

  const step = Math.sin(e.anim * 1.1);
  const bob = Math.abs(Math.sin(e.anim * 0.9)) * 1.5;
  const y = groundY - bob;
  const lean = strikeP * 0.10 - windP * 0.04;
  const lunge = strikeP * 6 - windP * 3;

  const SCALE = 1.28;
  ctx.save();
  ctx.translate(0, groundY); ctx.scale(SCALE, SCALE); ctx.translate(0, -groundY);

  // contact shadow
  ctx.save(); ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#0c0406";
  ctx.beginPath(); ctx.ellipse(2, groundY - 1, 26, 4.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // ── back platform: a lashed scrap scaffold rising off the spine (behind body)
  ctx.save();
  ctx.strokeStyle = woodDk; ctx.lineWidth = 3.2; ctx.lineCap = "round";
  // uprights
  ctx.beginPath(); ctx.moveTo(-15, y - 20); ctx.lineTo(-17, y - 54); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-4, y - 24); ctx.lineTo(-5, y - 58); ctx.stroke();
  // deck plank
  ctx.fillStyle = wood;
  ctx.beginPath(); ctx.moveTo(-20, y - 52); ctx.lineTo(-2, y - 56); ctx.lineTo(-2, y - 51); ctx.lineTo(-20, y - 47); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = woodLt; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-19, y - 50.5); ctx.lineTo(-3, y - 54.5); ctx.stroke();
  // spikes & rope handholds
  ctx.strokeStyle = ironDk; ctx.lineWidth = 1.4; ctx.lineCap = "round";
  for (let k = 0; k < 3; k++) {
    const sx = -17 + k * 6;
    ctx.beginPath(); ctx.moveTo(sx, y - 52); ctx.lineTo(sx + 1, y - 58 - (k % 2) * 2); ctx.stroke();
  }
  ctx.strokeStyle = "#7a6a4a"; ctx.lineWidth = 1; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-16, y - 47); ctx.quadraticCurveTo(-11, y - 44, -6, y - 47); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.restore();

  // ── legs: short, thick, splayed for a heavy stance ──
  const hipY = y - 20;
  for (const sgn of [-1, 1]) {
    const sw = sgn * (6 + step * sgn * 2);
    ctx.fillStyle = sgn < 0 ? bodyDk : body;
    ctx.beginPath();
    ctx.moveTo(sgn * 3, hipY); ctx.lineTo(sw - 4, groundY - 3); ctx.lineTo(sw + 4, groundY - 3); ctx.lineTo(sgn * 3 + 5, hipY);
    ctx.closePath(); ctx.fill();
    // iron-shod foot
    ctx.fillStyle = ironDk;
    roundedRect(sw - 6, groundY - 4, 13, 4, 1.5); ctx.fill();
    ctx.fillStyle = ironLt; ctx.globalAlpha = 0.4; roundedRect(sw - 6, groundY - 4, 13, 1.4, 1); ctx.fill(); ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(lunge, 0);
  ctx.translate(2, hipY); ctx.rotate(lean); ctx.translate(-2, -hipY);

  // ── torso: broad, hunched, muscular ──
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, y - 30, 17, 16, -0.12, 0, Math.PI * 2); ctx.fill();
  // hunched upper back (shaded)
  ctx.fillStyle = bodyDk; ctx.globalAlpha = flash ? 1 : 0.6;
  ctx.beginPath(); ctx.ellipse(-8, y - 38, 10, 10, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // mismatched scrap armor: iron plate on the chest, a lashed board on the shoulder
  ctx.fillStyle = iron;
  ctx.beginPath(); ctx.moveTo(3, y - 40); ctx.lineTo(15, y - 36); ctx.lineTo(14, y - 22); ctx.lineTo(4, y - 20); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = ironDk; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = ironLt; ctx.globalAlpha = 0.35;
  ctx.beginPath(); ctx.moveTo(4, y - 39); ctx.lineTo(9, y - 37.5); ctx.lineTo(9, y - 23); ctx.lineTo(5, y - 22); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  // rivets
  ctx.fillStyle = ironDk;
  for (const [rx, ry] of [[6, y - 37], [12, y - 35], [6, y - 25], [12, y - 25]]) { ctx.beginPath(); ctx.arc(rx, ry, 0.9, 0, Math.PI * 2); ctx.fill(); }
  // scratches / soot streaks
  ctx.strokeStyle = bodyDk; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-6, y - 28); ctx.lineTo(1, y - 30); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-9, y - 24); ctx.lineTo(-2, y - 25); ctx.stroke();

  // ── near (ram) arm: an oversized arm gripping the ram haft ──
  const armEx = 12 + ramX * 0.5, armEy = y - 24;
  ctx.strokeStyle = body; ctx.lineWidth = 6.5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(6, y - 30); ctx.lineTo(armEx, armEy); ctx.stroke();
  ctx.lineWidth = 5.5;
  ctx.beginPath(); ctx.moveTo(armEx, armEy); ctx.lineTo(18 + ramX, y - 20); ctx.stroke();
  ctx.lineCap = "butt";

  // ── head: low-slung, small, under a dented iron helmet with chipped horns ──
  const hx = 11 + windP * -1.5 + strikeP * 2, hy = y - 30 + 2;
  // stubby neck
  ctx.strokeStyle = body; ctx.lineWidth = 6; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(4, y - 30); ctx.lineTo(hx - 2, hy); ctx.stroke();
  ctx.lineCap = "butt";
  // face
  ctx.fillStyle = bodyMid;
  ctx.beginPath(); ctx.arc(hx, hy, 6.2, 0, Math.PI * 2); ctx.fill();
  // flat nose + tusks
  ctx.fillStyle = bodyDk;
  ctx.beginPath(); ctx.moveTo(hx + 4, hy + 0.5); ctx.lineTo(hx + 8, hy + 1.5); ctx.lineTo(hx + 4, hy + 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = flash ? "#fff" : "#e8dcc0";
  ctx.beginPath(); ctx.moveTo(hx + 3, hy + 3.4); ctx.lineTo(hx + 3.8, hy + 1.2); ctx.lineTo(hx + 5, hy + 3.4); ctx.closePath(); ctx.fill();
  // narrow yellow eyes
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.55 + dark * 0.3 + strikeP * 0.3;
  ctx.fillStyle = t.eye;
  ctx.beginPath(); ctx.ellipse(hx + 1.5, hy - 1.5, 2, 1.1, -0.2, 0, Math.PI * 2); ctx.ellipse(hx + 5, hy - 1, 1.7, 1, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // dented helmet dome
  ctx.fillStyle = iron;
  ctx.beginPath(); ctx.arc(hx + 1, hy - 2.5, 7, Math.PI * 1.02, Math.PI * 2.02); ctx.fill();
  ctx.fillStyle = ironLt; ctx.globalAlpha = 0.4;
  ctx.beginPath(); ctx.arc(hx - 1, hy - 3.5, 5.5, Math.PI * 1.1, Math.PI * 1.7); ctx.fill(); ctx.globalAlpha = 1;
  // dents + brow rim
  ctx.strokeStyle = ironDk; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(hx - 6, hy - 3); ctx.lineTo(hx + 8, hy - 3.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx - 1, hy - 8); ctx.lineTo(hx + 1, hy - 5); ctx.stroke();
  // chipped horns poking through helmet holes
  ctx.strokeStyle = hornCol; ctx.lineWidth = 2.6; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(hx - 3, hy - 8); ctx.lineTo(hx - 5.5, hy - 13); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx + 4, hy - 8); ctx.lineTo(hx + 6, hy - 12.5); ctx.stroke();
  ctx.lineCap = "butt";

  // ── battering ram: a heavy beam with an iron demon-skull head ──
  const ramBaseX = 14, ramY = y - 16;
  const ramTipX = 30 + ramX;
  ctx.save();
  // wooden haft
  ctx.strokeStyle = wood; ctx.lineWidth = 6; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(ramBaseX, ramY); ctx.lineTo(ramTipX - 4, ramY - 1); ctx.stroke();
  ctx.strokeStyle = woodDk; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ramBaseX + 1, ramY + 1.5); ctx.lineTo(ramTipX - 5, ramY + 0.5); ctx.stroke();
  // binding rings
  ctx.strokeStyle = ironDk; ctx.lineWidth = 1.6;
  for (const bx of [ramBaseX + 5, ramBaseX + 12]) { ctx.beginPath(); ctx.moveTo(bx, ramY - 3.5); ctx.lineTo(bx, ramY + 3.5); ctx.stroke(); }
  ctx.lineCap = "butt";
  // iron demon-skull head
  ctx.fillStyle = iron;
  ctx.beginPath(); ctx.ellipse(ramTipX, ramY - 1, 6, 5.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ironDk;
  ctx.beginPath(); ctx.arc(ramTipX + 1.5, ramY - 2.5, 1.1, 0, Math.PI * 2); ctx.arc(ramTipX + 3, ramY + 0.5, 1, 0, Math.PI * 2); ctx.fill(); // eye sockets
  // blunt skull horns
  ctx.strokeStyle = iron; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(ramTipX - 2, ramY - 5); ctx.lineTo(ramTipX - 4, ramY - 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ramTipX + 2, ramY - 5); ctx.lineTo(ramTipX + 3, ramY - 8); ctx.stroke();
  ctx.lineCap = "butt";
  // heat glow at the ram head on impact
  if (strikeP > 0.05 || winding) {
    const glow = winding ? windP * 0.5 : strikeP * 0.9;
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = glow;
    const rg = ctx.createRadialGradient(ramTipX + 2, ramY - 1, 1, ramTipX + 2, ramY - 1, 10);
    rg.addColorStop(0, "rgba(255,220,110,0.9)"); rg.addColorStop(0.5, "rgba(255,120,30,0.5)"); rg.addColorStop(1, "rgba(180,40,0,0)");
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(ramTipX + 2, ramY - 1, 10, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // ── the great plank shield (front, over most of the body) ──
  ctx.save();
  // pivot at the shield's bottom so it tips forward when lowered for a ram
  ctx.translate(20, groundY - 3);
  ctx.rotate(shDrop * 0.5);
  ctx.translate(-20, -(groundY - 3));
  const shX = 15, shW = 12, shTop = y - 56, shBot = groundY - 2;
  // plank body
  ctx.fillStyle = wood;
  roundedRect(shX, shTop, shW, shBot - shTop, 2); ctx.fill();
  // individual planks
  ctx.strokeStyle = woodDk; ctx.lineWidth = 1;
  for (let k = 1; k < 4; k++) { const px = shX + (shW / 4) * k; ctx.beginPath(); ctx.moveTo(px, shTop + 1); ctx.lineTo(px, shBot - 1); ctx.stroke(); }
  // plank highlights
  ctx.strokeStyle = woodLt; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.6;
  ctx.beginPath(); ctx.moveTo(shX + 1.5, shTop + 3); ctx.lineTo(shX + 1.5, shBot - 3); ctx.stroke();
  ctx.globalAlpha = 1;
  // bent metal reinforcing bands
  ctx.fillStyle = iron;
  for (const by of [shTop + 8, (shTop + shBot) / 2, shBot - 10]) { roundedRect(shX - 1, by, shW + 2, 3.4, 1); ctx.fill(); }
  ctx.strokeStyle = ironLt; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.5;
  for (const by of [shTop + 8, (shTop + shBot) / 2, shBot - 10]) { ctx.beginPath(); ctx.moveTo(shX, by + 0.6); ctx.lineTo(shX + shW, by + 0.6); ctx.stroke(); }
  ctx.globalAlpha = 1;
  // nails / rivets studding the bands
  ctx.fillStyle = ironDk;
  for (const by of [shTop + 9.5, (shTop + shBot) / 2 + 1.5, shBot - 8.5]) {
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(shX + 2 + k * 4, by, 0.9, 0, Math.PI * 2); ctx.fill(); }
  }
  // a stolen round boss bolted to the front, and a hanging chain
  ctx.fillStyle = ironLt;
  ctx.beginPath(); ctx.arc(shX + shW / 2, (shTop + shBot) / 2, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ironDk;
  ctx.beginPath(); ctx.arc(shX + shW / 2, (shTop + shBot) / 2, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#54585f"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(shX + 2, shBot - 4); ctx.quadraticCurveTo(shX + 5, shBot + 1, shX + 8, shBot - 3); ctx.stroke();
  // sight gaps between planks (the imp peers through)
  ctx.strokeStyle = "#12100c"; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(shX + shW * 0.5, y - 44); ctx.lineTo(shX + shW * 0.5, y - 39); ctx.stroke();
  ctx.restore();

  ctx.restore(); // lunge/lean

  // drifting soot off the whole rig
  ctx.save(); ctx.globalAlpha = 0.14;
  ctx.fillStyle = "#2a1512";
  for (let k = 0; k < 2; k++) {
    const wt = (T * 0.6 + k * 0.5 + e.x * 0.02) % 1;
    ctx.beginPath(); ctx.arc(-6 + Math.sin((T + k * 2) * 1.8) * 4, y - 40 - wt * 18, 2.4 * (1 - wt) + 1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  ctx.restore(); // scale
}

function cullStackedImps() {
  return new Set();
}

// ── Chain Imp ────────────────────────────────────────────────────────────────
// A crude barbed iron hook, drawn at the origin pointing along +x.
function drawIronHook(x, y, ang, iron, ironDk, flash) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.strokeStyle = flash ? "#fff" : iron; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(1, 0); ctx.stroke();
  ctx.beginPath(); ctx.arc(1, 2.6, 3, -1.35, 1.9); ctx.stroke();
  ctx.strokeStyle = flash ? "#fff" : ironDk; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(1 + Math.cos(1.9) * 3, 2.6 + Math.sin(1.9) * 3); ctx.lineTo(2.5, 1.4); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.restore();
}

// Lean, hooded imp draped in coils of chain. Hangs low with a heavy stoop; spins
// the hook overhead on the throw wind-up; crouches and hauls on a taut line while
// holding an anchored chain. Draws in entity-local space, facing +x.
function drawChainImp(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const dp = e.dying ? Math.min(1, (e.deathT || 0) / (e.deathDuration || 0.5)) : 0;

  const body = flash ? "#fff" : "#5f4436";
  const bodyDk = flash ? "#fff" : "#3a2a22";
  const skin = flash ? "#fff" : "#7a5142";
  const hood = flash ? "#fff" : "#463228";
  const iron = "#6b6b72";
  const ironDk = "#3a3a40";
  const eye = "#ffd84a";

  const hooking = e.aiState === "hooking" && !e.dying;
  const holding = e.aiState === "holding" && !e.dying;
  const wind = hooking ? Math.min(1, (e.hookT || 0) / (t.hookWindup || 0.95)) : 0;

  const ph = e.anim * 2.4;
  const settled = holding || hooking;
  const bob = Math.abs(Math.sin(ph)) * 1.6 * (settled ? 0.2 : 1) + Math.sin(T * 2.3 + e.x * 0.2) * 0.4;
  const crouch = holding ? 5 : 0;

  if (!e.dying) {
    ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = "#0c0406";
    ctx.beginPath(); ctx.ellipse(0, groundY - 1, 11, 2.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  // loose chain end dragging behind (−x), rattling with a small hook
  {
    let px = -6, py = groundY - 6 - bob;
    for (let k = 1; k <= 5; k++) {
      const nx = -6 - k * 3.2, ny = groundY - 3 + Math.sin(T * 4 - k * 0.8) * 0.8 + (5 - k) * 0.3;
      ctx.strokeStyle = k % 2 ? iron : ironDk; ctx.lineWidth = 1.6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc((px + nx) / 2, (py + ny) / 2, 1.5, 0, Math.PI * 2); ctx.stroke();
      px = nx; py = ny;
    }
    ctx.lineCap = "butt";
    drawIronHook(px - 1, py, 2.4, iron, ironDk, flash);
  }

  // thin bent legs
  {
    ctx.lineCap = "round";
    for (const s of [1, 0]) {
      const swing = settled ? (s ? -2 : 3) : Math.cos(ph + s * Math.PI) * 4;
      ctx.strokeStyle = s ? bodyDk : body;
      ctx.lineWidth = s ? 2.4 : 2.8;
      ctx.beginPath();
      ctx.moveTo(-1 + s * 2, groundY - 13 - bob + crouch * 0.5);
      ctx.lineTo(-1 + s * 3 + swing * 0.4, groundY - 6 + crouch * 0.5);
      ctx.lineTo(-2 + s * 4 + swing, groundY);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
  }

  // torso leans toward the wall (+x); rears back through the hook throw
  ctx.save();
  const pivotY = groundY - 13 - bob + crouch;
  const leanR = hooking ? -0.26 * Math.sin(wind * Math.PI) : holding ? 0.14 : 0.06;
  ctx.translate(0, pivotY); ctx.rotate(leanR); ctx.translate(0, -pivotY);

  // lean hunched body
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-3.5, groundY - 24 - bob + crouch);
  ctx.quadraticCurveTo(4, groundY - 20 - bob + crouch, 3, groundY - 9 + crouch);
  ctx.quadraticCurveTo(-1, groundY - 7 + crouch, -4, groundY - 10 + crouch);
  ctx.quadraticCurveTo(-6, groundY - 18 - bob + crouch, -3.5, groundY - 24 - bob + crouch);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.ellipse(1.5, groundY - 14 + crouch, 2.4, 5.2, -0.1, 0, Math.PI * 2); ctx.fill();

  // chains wrapped around the chest
  for (const [col, lw] of [[ironDk, 1.4], [iron, 0.8]]) {
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    for (let k = 0; k < 3; k++) {
      const yy = groundY - 20 - bob + crouch + k * 4.2;
      ctx.beginPath(); ctx.moveTo(-4.5, yy); ctx.quadraticCurveTo(0, yy + 1.6, 3.5, yy - 0.4); ctx.stroke();
    }
  }

  // hooded head with darting eyes
  const hdx = 1.2 + wind * 0.6, hdy = groundY - 30 - bob + crouch;
  ctx.fillStyle = hood;
  ctx.beginPath();
  ctx.moveTo(hdx - 5.5, hdy + 5);
  ctx.quadraticCurveTo(hdx - 6.5, hdy - 6, hdx + 1, hdy - 7.5);
  ctx.quadraticCurveTo(hdx + 7.5, hdy - 6, hdx + 6, hdy + 4);
  ctx.quadraticCurveTo(hdx + 2, hdy + 6, hdx - 5.5, hdy + 5);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#160f0c";
  ctx.beginPath(); ctx.ellipse(hdx + 2.5, hdy + 1, 3.4, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (0.7 + 0.3 * dark) * (1 - dp);
  const dart = Math.sin(T * 5 + e.x) * 0.6;
  ctx.fillStyle = eye;
  ctx.beginPath(); ctx.arc(hdx + 2 + dart, hdy + 0.5, 1.5, 0, Math.PI * 2); ctx.arc(hdx + 4.6 + dart, hdy + 1, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // rear arm gripping the harness
  ctx.strokeStyle = bodyDk; ctx.lineWidth = 2.2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, groundY - 22 - bob + crouch); ctx.lineTo(3, groundY - 15 + crouch); ctx.stroke();

  // lead arm + hook
  let hookX, hookY, hookAng;
  if (hooking) {
    const spin = Math.min(wind / 0.7, 1) * Math.PI * 3;
    const cx = hdx - 1, cy = hdy - 4, r = 9, a = -Math.PI / 2 + spin;
    hookX = cx + Math.cos(a) * r; hookY = cy + Math.sin(a) * r; hookAng = a + Math.PI / 2;
    ctx.strokeStyle = body; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(2, groundY - 22 - bob + crouch); ctx.lineTo(hookX, hookY); ctx.stroke();
  } else if (holding) {
    hookX = 8; hookY = groundY - 20 + crouch; hookAng = -0.6;
    ctx.strokeStyle = body; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(1, groundY - 21 - bob + crouch); ctx.lineTo(hookX, hookY); ctx.stroke();
  } else {
    const sw = Math.sin(ph) * 2;
    hookX = 7 + sw * 0.4; hookY = groundY - 8 - bob * 0.5; hookAng = 1.2;
    ctx.strokeStyle = body; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(2.5, groundY - 21 - bob + crouch); ctx.lineTo(hookX, hookY); ctx.stroke();
  }
  ctx.lineCap = "butt";
  drawIronHook(hookX, hookY, hookAng, iron, ironDk, flash);

  ctx.restore(); // torso lean
}

// The vertical climbing chain hanging straight down the wall face — this is the
// line the imps actually clamber up.
function drawClimbChain(x, yTop, yBot, seed) {
  const N = Math.max(6, Math.round((yBot - yTop) / 7));
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const link = x + Math.sin(seed * 2 + u * 7) * 0.8;   // faint sway
    const y = yTop + (yBot - yTop) * u;
    ctx.fillStyle = i % 2 ? "#6b6b72" : "#3a3a40";
    ctx.beginPath(); ctx.ellipse(link, y, 1.8, 1.4, 0, 0, Math.PI * 2); ctx.fill();
  }
}

// The slack tail from the hook back to the chain imp bracing it.
function drawSlackChain(x1, y1, x2, y2, seed) {
  const N = 10, sag = 7;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const x = x1 + (x2 - x1) * u;
    const y = y1 + (y2 - y1) * u + Math.sin(u * Math.PI) * sag + Math.sin(seed * 2 + u * 6) * 0.5;
    ctx.fillStyle = i % 2 ? "#6b6b72" : "#3a3a40";
    ctx.beginPath(); ctx.ellipse(x, y, 1.6, 1.3, 0, 0, Math.PI * 2); ctx.fill();
  }
}

// World-space pass for every live grappling chain, drawn behind the imps.
function drawWallChains(view) {
  const T = performance.now() / 1000;
  for (const e of state.enemies) {
    if (e.type !== "chainImp" || e.dying || !e.chainAttached || e.aiState !== "holding") continue;
    const w = e.chainWall;
    if (!w || !wallReady(w)) continue;
    if (e.x < view.left - 80 || e.x > view.right + 80) continue;
    const topX = w.x + w.side * 30;         // outside face of the wall — imps climb here
    const topY = groundY - wallHeight(w);
    // chain runs straight down the wall face for the horde to climb...
    drawClimbChain(topX, topY, groundY, T + e.x);
    // ...with a slack tail trailing back to the chain imp holding it steady
    drawSlackChain(topX, topY + 2, e.x + (e.dir || 1) * 8, groundY - 20, T + e.x);
    // hook biting the wall top
    ctx.save(); ctx.translate(topX, topY);
    ctx.strokeStyle = "#7b7b82"; ctx.lineWidth = 2.2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(0, 3, 3.4, -1.4, 2.2); ctx.stroke();
    ctx.lineCap = "butt"; ctx.restore();
  }
}


function drawBiomeBoss(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const w = t.w;
  const flash = e.flash > 0 && !e.dying;
  const col = flash ? "#fff" : t.color;
  const eye = flash ? "#fff" : t.eye;
  const pulse = 0.5 + 0.5 * Math.sin(T * 4 + e.x * 0.01);
  const cast = e.biomeCastT !== undefined || e.attackKind === "supernova" || (e.suckT || 0) > 0;

  ctx.save();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.16 + 0.08 * pulse + (cast ? 0.12 : 0);
  const auraY = groundY - w * 0.45;
  const aura = ctx.createRadialGradient(0, auraY, 8, 0, auraY, w * 1.8);
  aura.addColorStop(0, t.eye);
  aura.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.ellipse(0, auraY, w * 1.45, w * 1.0, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  if (t.forestStalker) {
    const bob = Math.sin(e.biomeWalkPhase || e.anim) * 3;
    const y = groundY - bob;
    ctx.strokeStyle = flash ? "#fff" : "#25361e";
    ctx.lineWidth = 9; ctx.lineCap = "round";
    for (const lx of [-42, -15, 20, 46]) {
      const step = Math.sin((e.biomeWalkPhase || 0) * 4 + lx * 0.05) * 8;
      ctx.beginPath(); ctx.moveTo(lx, y - 38); ctx.lineTo(lx + step, y - 4); ctx.stroke();
    }
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(4, y - 72, w * 0.48, w * 0.24, -0.04, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = flash ? "#fff" : "#485a32";
    ctx.beginPath(); ctx.ellipse(56, y - 96, w * 0.22, w * 0.18, 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = flash ? "#fff" : "#5a3d26";
    ctx.lineWidth = 5;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(66, y - 112);
      ctx.lineTo(66 + s * 28, y - 154);
      ctx.lineTo(66 + s * 54, y - 174);
      ctx.stroke();
      ctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.moveTo(66 + s * (28 + k * 8), y - 145 - k * 8); ctx.lineTo(66 + s * (48 + k * 13), y - 148 - k * 4); ctx.stroke();
      }
      ctx.lineWidth = 5;
    }
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = eye;
    for (const ex of [48, 61]) for (const ey of [-102, -113]) { ctx.beginPath(); ctx.arc(ex, y + ey, 3.5 + pulse * 1.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    if (cast) {
      ctx.strokeStyle = "#6f8a42"; ctx.lineWidth = 3; ctx.globalAlpha = 0.7;
      for (let k = 0; k < 6; k++) {
        const x = -70 + k * 28;
        ctx.beginPath(); ctx.moveTo(x, groundY - 2); ctx.quadraticCurveTo(x + 10, groundY - 25 - pulse * 14, x + 22, groundY - 5); ctx.stroke();
      }
    }
  } else if (t.skadiWrath) {
    const y = groundY;
    ctx.fillStyle = flash ? "#fff" : "#0d1220";
    ctx.beginPath(); ctx.moveTo(-w * 0.34, y + w * 0.9); ctx.lineTo(0, y - w * 0.62); ctx.lineTo(w * 0.34, y + w * 0.9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = flash ? "#fff" : "#1c2b45";
    ctx.beginPath(); ctx.ellipse(0, y - w * 0.24, w * 0.32, w * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#d8f8ff";
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath(); ctx.moveTo(k * 13, y - w * 0.72); ctx.lineTo(k * 13 + 7, y - w * 0.92 - Math.abs(k) * 8); ctx.lineTo(k * 13 + 14, y - w * 0.72); ctx.closePath(); ctx.fill();
    }
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = eye;
    ctx.beginPath(); ctx.ellipse(-10, y - w * 0.28, 6, 4, 0, 0, Math.PI * 2); ctx.ellipse(10, y - w * 0.28, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
    if ((e.cryoShield || 0) > 0) {
      ctx.strokeStyle = "#bfefff"; ctx.lineWidth = 4 + pulse * 3; ctx.globalAlpha = 0.55 + pulse * 0.22;
      ctx.beginPath(); ctx.arc(0, y - w * 0.12, w * 0.72, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  } else if (t.duneBroodmother) {
    const y = groundY + (e.burrowT || 0) * 32;
    ctx.fillStyle = col;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath(); ctx.ellipse(-42 + k * 18, y - 48 + Math.sin(T * 5 + k) * 2, 26 - k * 1.5, 20, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = flash ? "#fff" : "#6f4e2d"; ctx.lineWidth = 6; ctx.lineCap = "round";
    for (let k = 0; k < 4; k++) {
      ctx.beginPath(); ctx.moveTo(-28 + k * 22, y - 34); ctx.lineTo(-44 + k * 22, y - 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-28 + k * 22, y - 34); ctx.lineTo(-44 + k * 22, y - 62); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(34, y - 56); ctx.quadraticCurveTo(80, y - 116, 20, y - 150); ctx.stroke();
    ctx.fillStyle = flash ? "#fff" : "#df8a3a";
    for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(18 + k * 11, y - 150); ctx.lineTo(27 + k * 11, y - 180); ctx.lineTo(38 + k * 11, y - 150); ctx.closePath(); ctx.fill(); }
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = eye;
    ctx.beginPath(); ctx.arc(54, y - 56, 5 + pulse, 0, Math.PI * 2); ctx.arc(68, y - 54, 4 + pulse, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if ((e.blinded || 0) > 0) {
      ctx.fillStyle = "rgba(216,180,106,0.55)";
      ctx.beginPath(); ctx.ellipse(42, y - 58, 42, 18, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else if (t.sunkenBehemoth) {
    const bob = Math.sin(e.biomeWalkPhase || e.anim) * 2;
    const y = groundY - bob;
    ctx.fillStyle = flash ? "#fff" : "#27391f";
    ctx.beginPath(); ctx.ellipse(0, y - 54, w * 0.54, w * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(46, y - 70, w * 0.34, w * 0.24, -0.08, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = flash ? "#fff" : "#2e4a28";
    ctx.beginPath(); ctx.ellipse(-18, y - 96, w * 0.36, w * 0.13, 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#5d3f28"; ctx.lineWidth = 4; ctx.lineCap = "round";
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-45 + k * 18, y - 105); ctx.lineTo(-54 + k * 22, y - 136 - k * 3); ctx.stroke(); }
    ctx.fillStyle = "#b8ff7a";
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(-44 + k * 18, y - 124 - Math.sin(k) * 8, 5 + (k % 2) * 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = eye;
    ctx.beginPath(); ctx.arc(60, y - 83, 5 + pulse, 0, Math.PI * 2); ctx.arc(81, y - 80, 4 + pulse, 0, Math.PI * 2); ctx.fill();
    if ((e.suckT || 0) > 0) {
      ctx.strokeStyle = "#b8ff7a"; ctx.lineWidth = 3; ctx.globalAlpha = 0.62;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(54, y - 64, 36 + k * 34 + pulse * 10, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.restore();
  } else if (t.ignitedCore) {
    const y = groundY;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const heat = Math.max(e.coreHeat || 0, e.attackKind === "supernova" ? 1 : 0);
    const rg = ctx.createRadialGradient(0, y - 36, 4, 0, y - 36, w * (0.55 + heat * 0.35));
    rg.addColorStop(0, "#fff8c0");
    rg.addColorStop(0.35, "#ff7a2a");
    rg.addColorStop(1, "rgba(180,20,0,0)");
    ctx.fillStyle = rg; ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(0, y - 36, w * (0.35 + heat * 0.08), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = flash ? "#fff" : "#171217";
    for (let k = 0; k < 8; k++) {
      const a = T * 0.9 + k * Math.PI * 2 / 8;
      const rx = Math.cos(a) * w * 0.52, ry = Math.sin(a) * w * 0.32;
      ctx.save(); ctx.translate(rx, y - 38 + ry); ctx.rotate(a + 0.4);
      ctx.beginPath(); ctx.moveTo(-10, -18); ctx.lineTo(18, -8); ctx.lineTo(10, 20); ctx.lineTo(-16, 12); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    if (e.attackKind === "supernova") {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = "#fff0a0"; ctx.lineWidth = 5 + pulse * 5; ctx.globalAlpha = 0.72;
      ctx.beginPath(); ctx.arc(0, y - 36, w * (0.72 + pulse * 0.12), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  } else if (t.voidMindflayer) {
    const y = groundY;
    ctx.fillStyle = flash ? "#fff" : "#0a0614";
    ctx.beginPath(); ctx.ellipse(0, y - 8, w * 0.44, w * 0.56, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = flash ? "#fff" : "#1e0f36"; ctx.lineWidth = 7; ctx.lineCap = "round";
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI * 0.85 + k * Math.PI * 0.28;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * w * 0.22, y + Math.sin(a) * w * 0.2);
      ctx.quadraticCurveTo(Math.cos(a) * w * (0.75 + pulse * 0.1), y + 80 + Math.sin(T * 3 + k) * 18, Math.cos(a) * w * 0.98, groundY - 5);
      ctx.stroke();
    }
    ctx.fillStyle = flash ? "#fff" : "#3b2360";
    ctx.beginPath(); ctx.moveTo(-24, y - 52); ctx.lineTo(24, y - 58); ctx.lineTo(38, y - 8); ctx.lineTo(0, y + 28); ctx.lineTo(-38, y - 8); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = eye;
    ctx.beginPath(); ctx.ellipse(-12, y - 24, 7, 4, 0, 0, Math.PI * 2); ctx.ellipse(12, y - 24, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
    if ((e.tentacleCut || 0) > 0 || (e.maskCracked || 0) > 0) {
      ctx.strokeStyle = "#f0c8ff"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, y - 50); ctx.lineTo(6, y - 6); ctx.lineTo(-8, y + 24); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

export function drawEnemies(dark) {
  const view = visibleWorldBounds(650);
  const budget = renderBudget();
  const hiddenImps = cullStackedImps(state.enemies);
  drawWallChains(view);
  for (const e of state.enemies) {
    const t=ENEMY_TYPES[e.type];
    if (!t) continue;
    if (e.x < view.left || e.x > view.right) continue;
    if (hiddenImps.has(e)) continue;
    let drawYOff = e.fy || 0;
    let drawXOff = 0;
    if (e.type === "imp" && e.aiState === "stacking" && (e.impIndex || 0) > 0) {
      const sT = performance.now() / 1000;
      const idx = e.impIndex;
      drawYOff += Math.sin(sT * 2.2 + idx * 1.4 + (e.stackJoinOrder || 0) * 0.7) * (0.6 + idx * 0.35);
      drawXOff = Math.sin(sT * 1.6 + idx * 2.1 + (e.stackJoinOrder || 0)) * (0.4 + idx * 0.25);
    }
    const bossT = performance.now()/1000;

    const w=t.w, bob=Math.abs(Math.sin(e.anim*2))*2;
    const isBoss = !!t.boss;
    const atkF = Math.max(0, e.attackAnim || 0) / 0.25;
    const custom = e.type === "imp" ? drawImp : e.type === "fireImp" ? drawFireImp : e.type === "emberBrute" ? drawEmberBrute : e.type === "ashPriest" ? drawAshPriest : e.type === "siegeImp" ? drawSiegeImp : e.type === "chainImp" ? drawChainImp : e.type === "fireDragon" ? drawFireDragon : e.type === "magmaGolem" ? drawMagmaGolem : t.biomeBoss ? drawBiomeBoss
      : e.type === "shade" ? drawShade : e.type === "voidWraith" ? drawVoidWraith : e.type === "voidBrute" ? drawVoidBrute : e.type === "voidTitan" ? drawVoidTitan : e.type === "voidSeraph" ? drawVoidSeraph : null;
    const useSilhouette = shouldDrawEnemySilhouette(e, t, budget);
    ctx.save(); ctx.translate(e.x + drawXOff, drawYOff);
    if (atkF > 0 && !custom && !useSilhouette) ctx.scale(1 + atkF * 0.18, 1 - atkF * 0.12);
    if (e.dir<0) ctx.scale(-1,1);
    if (e.dying) {
      const deathProgress = Math.min(e.deathT / (e.deathDuration || 0.5), 1);
      const ease = 1 - Math.pow(1 - deathProgress, 3);
      const kind = e.deathKind || "impFallBack";
      const burstFade = e.deathBurstDone ? Math.max(0.12, 1 - (deathProgress - 0.38) / 0.34) : 1;
      const fadeStart = e.deathFadeStart ?? 0.76;
      ctx.globalAlpha *= burstFade * Math.max(0.16, 1 - Math.max(0, deathProgress - fadeStart) / Math.max(0.18, 1 - fadeStart));
      // Ragdoll: rotation comes from integrated physics, pivot at body center.
      let rotation = e.deathAngle !== undefined ? e.deathAngle : ease * Math.PI / 2;
      let sink = ease * 4;
      let sx = 1, sy = 1;
      if (kind === "impCrumple" || kind === "ashFold") {
        rotation *= 0.74;
        sink += ease * 7;
        sx += ease * 0.1;
        sy -= ease * 0.08;
      } else if (kind === "heavyKneel" || kind === "golemCollapse") {
        rotation *= 0.58;
        sink += ease * 11;
        sx += ease * 0.12;
        sy -= ease * 0.14;
      } else if (kind === "heavySlam" || kind === "golemShatter") {
        sink += Math.sin(Math.min(1, deathProgress * 1.6) * Math.PI) * 5 + ease * 7;
        sx += ease * 0.16;
        sy -= ease * 0.12;
      } else if (kind === "wingShear" || kind === "dragonCrash") {
        rotation *= 1.12;
        sink += ease * 3;
      } else if (kind === "impBurst" || kind === "ashBurst") {
        sx += Math.sin(Math.min(1, deathProgress * 2.4) * Math.PI) * 0.18;
        sy -= Math.sin(Math.min(1, deathProgress * 2.4) * Math.PI) * 0.12;
      }
      const pivotY = groundY - w * 0.45;
      ctx.translate(0, pivotY - sink);
      ctx.rotate(rotation);
      ctx.scale(sx, Math.max(0.62, sy));
      ctx.translate(0, -pivotY);
    }
    if (e.type === "imp" && e.burn > 0 && !useSilhouette) {
      const ft = performance.now() / 1000;
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.35 + 0.18 * Math.sin(ft * 18 + e.x);
      const flame = ctx.createRadialGradient(0, groundY - 18, 2, 0, groundY - 18, 24);
      flame.addColorStop(0, "rgba(255,230,80,0.9)");
      flame.addColorStop(0.45, "rgba(255,90,20,0.45)");
      flame.addColorStop(1, "rgba(180,20,0,0)");
      ctx.fillStyle = flame; ctx.beginPath(); ctx.ellipse(0, groundY - 18, 16, 25, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (useSilhouette) {
      drawEnemySilhouette(e, t, dark, atkF);
    } else if (custom) {
      custom(e, t, dark, atkF);
    } else {
      const s=Math.sin(e.anim*3);
      ctx.strokeStyle=e.flash>0?"#fff":t.color; ctx.lineWidth=Math.max(2,w*0.12); ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(-w*0.25,groundY-8-bob); ctx.lineTo(-w*0.25+s*5,groundY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w*0.25,groundY-8-bob); ctx.lineTo(w*0.25-s*5,groundY); ctx.stroke();
      ctx.lineCap="butt";
      if (isBoss) {
        ctx.save(); ctx.globalCompositeOperation="lighter";
        const aura=0.18+0.08*Math.sin(bossT*2+e.x); ctx.globalAlpha=aura;
        const ag=ctx.createRadialGradient(0,groundY-w*0.5,4,0,groundY-w*0.5,w*1.4);
        ag.addColorStop(0,t.eye); ag.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=ag; ctx.beginPath(); ctx.ellipse(0,groundY-w*0.5,w*1.4,w,0,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle=e.flash>0?"#ffffff":t.color;
      roundedRect(-w/2,groundY-w-6-bob,w,w+6,w*0.4); ctx.fill();
      if (isBoss) {
        ctx.fillStyle=e.flash>0?"#fff":t.color;
        for (let i=-1;i<=1;i++) { const sx=i*w*0.28; ctx.beginPath(); ctx.moveTo(sx-3,groundY-w-2-bob); ctx.lineTo(sx,groundY-w-(isBoss?18:13)-bob); ctx.lineTo(sx+3,groundY-w-2-bob); ctx.fill(); }
      }
      ctx.fillStyle="rgba(255,255,255,0.06)"; roundedRect(-w/2,groundY-w-6-bob,w*0.34,w+6,w*0.4); ctx.fill();
      const ex=w*0.12, ex2=w*0.32, ey=groundY-w*0.6-bob;
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.4+0.35*dark+(isBoss?0.3:0); ctx.fillStyle=t.eye;
      ctx.beginPath(); ctx.arc(ex,ey,w*(isBoss?0.28:0.22),0,Math.PI*2); ctx.arc(ex2,ey,w*(isBoss?0.28:0.22),0,Math.PI*2); ctx.fill(); ctx.restore();
      ctx.fillStyle=t.eye; ctx.beginPath(); ctx.arc(ex,ey,w*0.09,0,Math.PI*2); ctx.arc(ex2,ey,w*0.09,0,Math.PI*2); ctx.fill();
      if (e.carry>0) { ctx.fillStyle="#f2c14e"; ctx.beginPath(); ctx.arc(0,groundY-w-12-bob,4,0,Math.PI*2); ctx.fill(); }
      if (t.flying) {
        ctx.save(); ctx.globalAlpha *= 0.75;
        ctx.fillStyle = e.flash > 0 ? "#fff" : t.color;
        const wingFlap=Math.sin(e.anim*4)*8;
        ctx.beginPath(); ctx.moveTo(-w*0.5,groundY-w*0.5-bob); ctx.lineTo(-w*1.8,groundY-w*0.5-bob-wingFlap); ctx.lineTo(-w*0.5,groundY-w*0.1-bob); ctx.fill();
        ctx.beginPath(); ctx.moveTo(w*0.5,groundY-w*0.5-bob); ctx.lineTo(w*1.8,groundY-w*0.5-bob+wingFlap); ctx.lineTo(w*0.5,groundY-w*0.1-bob); ctx.fill();
        ctx.restore();
      }
    }
    drawStuckImpArrows(e);
    ctx.restore();

    if (e.bounty && !e.dying) {
      const bt = performance.now() / 1000;
      const my = groundY + drawYOff - t.w - (t.flying ? 32 : 20) - Math.sin(bt * 4 + e.x) * 2;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.72 + 0.22 * Math.sin(bt * 7 + e.x);
      const bg = ctx.createRadialGradient(e.x, my, 1, e.x, my, 16);
      bg.addColorStop(0, "rgba(255,224,122,0.85)");
      bg.addColorStop(1, "rgba(255,90,74,0)");
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(e.x, my, 16, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.fillStyle = "#ff6a4a";
      ctx.beginPath();
      ctx.moveTo(e.x - 9, my + 5);
      ctx.lineTo(e.x - 8, my - 2);
      ctx.lineTo(e.x - 4, my - 8);
      ctx.lineTo(e.x, my - 2);
      ctx.lineTo(e.x + 4, my - 8);
      ctx.lineTo(e.x + 8, my - 2);
      ctx.lineTo(e.x + 9, my + 5);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffe07a";
      ctx.fillRect(e.x - 9, my + 3, 18, 2.4);
      ctx.restore();
    }

    // Hunter's Mark: a pulsing crimson chevron hovers over the marked target
    if (e.hunterMark > 0 && !e.dying) {
      const mt = performance.now() / 1000;
      const my = groundY + drawYOff - t.w - (t.flying ? 26 : 16) - Math.sin(mt * 5 + e.x) * 2.5;
      ctx.save();
      ctx.globalAlpha = Math.min(1, e.hunterMark) * (0.75 + 0.25 * Math.sin(mt * 9));
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha *= 0.5;
      const mg = ctx.createRadialGradient(e.x, my, 1, e.x, my, 11);
      mg.addColorStop(0, "rgba(255,90,58,0.9)"); mg.addColorStop(1, "rgba(120,10,0,0)");
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(e.x, my, 11, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#ff5a3a";
      ctx.beginPath();
      ctx.moveTo(e.x - 5, my - 6); ctx.lineTo(e.x, my); ctx.lineTo(e.x + 5, my - 6);
      ctx.lineTo(e.x + 5, my - 3); ctx.lineTo(e.x, my + 3.5); ctx.lineTo(e.x - 5, my - 3);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // Bosses get a big always-on health bar with a name plate
    if ((isBoss || t.legendary) && !e.dying) {
      const bossVisualH = e.type === "magmaGolem" || e.type === "voidTitan" ? t.w * 1.58 : e.type === "voidSeraph" ? t.w * 1.24 : t.biomeBoss ? t.w * (t.flying ? 1.45 : 1.35) : t.w;
      drawHpBar(e.x, groundY+drawYOff-bossVisualH-28, t.w*0.85, e.hp/e.maxHp, "#ff2040");
      ctx.save(); ctx.textAlign="center";
      ctx.font="bold 15px Trebuchet MS";
      ctx.fillStyle="rgba(0,0,0,0.85)"; ctx.fillText(t.name, e.x+1, groundY+drawYOff-bossVisualH-42);
      ctx.fillStyle=t.eye; ctx.fillText(t.name, e.x, groundY+drawYOff-bossVisualH-43);
      ctx.font="11px Trebuchet MS";
      ctx.globalAlpha=0.65+0.25*Math.sin(bossT*3);
      if (e.type === "magmaGolem" || e.type === "voidTitan" || t.biomeBoss) ctx.translate(0, -bossVisualH + t.w);
      ctx.fillStyle="#f2c14e"; ctx.fillText(t.legendary ? "⚔ LEGENDARISK BOSS ⚔" : "⚔ BOSS ⚔", e.x, groundY+drawYOff-t.w-58);
      ctx.restore();
      continue;
    }

    const sprH = t.w;
    const hpFrac = e.maxHp ? e.hp / e.maxHp : 1;
    if (!e.dying && e.hp<e.maxHp && (budget.minorHealthBars || hpFrac < 0.45 || e.flash > 0)) {
      drawHpBar(e.x,groundY+drawYOff-sprH-4,t.w+(isBoss?12:4),hpFrac,isBoss?"#ff4080":"#d05a5a");
    }
    if (isBoss) {
      ctx.save(); ctx.font="bold 12px Trebuchet MS"; ctx.textAlign="center";
      ctx.fillStyle="rgba(0,0,0,0.7)"; ctx.fillText(t.name||e.type, e.x+1, groundY+drawYOff-sprH-18);
      ctx.fillStyle=t.eye; ctx.fillText(t.name||e.type, e.x, groundY+drawYOff-sprH-19); ctx.restore();
    }
  }
}

export { drawAnimals } from '../sprites/Animals.js';
