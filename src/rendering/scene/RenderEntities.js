import { ENEMY_TYPES } from '../../config/enemies.js';
import { ctx, groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { roundedRect, legs, drawArm, drawHpBar } from '../DrawHelpers.js';
import { entityWallLift } from '../../entities/Wall.js';
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
  const flash = e.flash > 0 && !e.dying;
  const bob = Math.abs(Math.sin(e.anim * 0.9)) * 2;
  const y = groundY - bob;
  const body = flash ? "#fff" : "#5a1a10";
  const bodyDk = flash ? "#fff" : "#2a0a08";
  const bodyMid = flash ? "#fff" : "#8a3018";
  const ember = "#ff6a20";
  const emberHot = "#ffb040";
  const charging = !!e.charging;
  const chargeFlash = Math.max(0, e.chargeFlash || 0);
  const stompFlash = Math.max(0, e.stompFlash || 0);
  // Real remaining swing time (attackAnim is stretched longer for this enemy), not the
  // generic atkF ratio, so the big wind-up plays out at its full slower duration.
  const swingDur = 0.62;
  const swingRemain = Math.max(0, e.attackAnim || 0);
  const swingT = charging ? Math.min((e.chargeT || 0) * 1.1, 1) : (swingRemain > 0 ? 1 - Math.min(1, swingRemain / swingDur) : -1);
  const lunge = charging ? 6 : (swingRemain > 0 ? Math.sin(Math.min(swingT * 1.3, 1) * Math.PI) * 5 : 0);
  const lean = charging ? 0.28 : 0;

  const SCALE = 2.5;
  ctx.save();
  ctx.translate(0, groundY); ctx.scale(SCALE, SCALE); ctx.translate(0, -groundY);

  // ground scorch pulse when it slams down a stomp
  if (stompFlash > 0) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = stompFlash / 0.35;
    ctx.strokeStyle = ember; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, groundY - 2, 30 * (1.4 - stompFlash), 9, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // fire-charge windup glow
  if (chargeFlash > 0 || charging) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = charging ? 0.5 : chargeFlash / 0.3 * 0.5;
    const aura = ctx.createRadialGradient(0, y - 18, 2, 0, y - 18, 26);
    aura.addColorStop(0, "rgba(255,140,40,0.7)");
    aura.addColorStop(1, "rgba(120,20,0,0)");
    ctx.fillStyle = aura; ctx.beginPath(); ctx.ellipse(0, y - 18, 22, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // constant low fire haze around the whole body
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.16 + 0.08 * Math.sin(T * 4 + e.x);
  const haze = ctx.createRadialGradient(0, y - 16, 2, 0, y - 16, 30);
  haze.addColorStop(0, "rgba(255,120,30,0.55)");
  haze.addColorStop(1, "rgba(120,20,0,0)");
  ctx.fillStyle = haze; ctx.beginPath(); ctx.ellipse(0, y - 16, 24, 30, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // rising embers drifting off the body
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < 6; k++) {
    const wt = (T * 0.55 + k * 0.17) % 1;
    const ex = -8 + k * 3.2 + Math.sin((T + k) * 1.6) * 3;
    const ey = y - 8 - wt * 34;
    ctx.globalAlpha = (1 - wt) * 0.6;
    ctx.fillStyle = k % 2 ? ember : emberHot;
    ctx.beginPath(); ctx.arc(ex, ey, 1.3 * (1 - wt) + 0.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // stubby legs, wide stance
  const s = Math.sin(e.anim * 1.3);
  ctx.strokeStyle = body; ctx.lineWidth = 3.4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-6, groundY - 12 - bob); ctx.lineTo(-9 + s * 3, groundY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, groundY - 12 - bob); ctx.lineTo(9 - s * 3, groundY); ctx.stroke();
  ctx.lineCap = "butt";

  ctx.save();
  ctx.translate(lunge, 0);
  ctx.rotate(lean);

  // broad hunched torso
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, y - 17, 12, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = bodyMid;
  ctx.beginPath(); ctx.ellipse(1, y - 15, 6.5, 8.5, -0.15, 0, Math.PI * 2); ctx.fill();

  // glowing ember core in the chest, flares brighter mid-attack/stomp
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.55 + 0.25 * Math.sin(T * 3 + e.x) + atkF * 0.3 + stompFlash;
  ctx.fillStyle = emberHot;
  ctx.beginPath(); ctx.arc(1, y - 15, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // molten cracks glowing across the torso
  ctx.strokeStyle = "rgba(255,140,40,0.45)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(-3, y - 20, 6, -0.4, 1.2); ctx.stroke();
  ctx.beginPath(); ctx.arc(4, y - 22, 5, 1.8, 3.2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-6, y - 12); ctx.lineTo(-2, y - 18); ctx.lineTo(-5, y - 24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, y - 10); ctx.lineTo(3, y - 16); ctx.lineTo(7, y - 21); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.4 + 0.25 * Math.sin(T * 5 + e.x);
  ctx.strokeStyle = ember; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(-6, y - 12); ctx.lineTo(-2, y - 18); ctx.lineTo(-5, y - 24); ctx.stroke();
  ctx.restore();

  // big heavy brow head, low-slung
  const hx = 5, hy = y - 28;
  const headR = 9.5;
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(hx, hy, headR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = bodyDk;
  ctx.beginPath(); ctx.moveTo(hx - 7, hy - 3.5); ctx.lineTo(hx + 8.5, hy - 6); ctx.lineTo(hx + 7, hy - 0.5); ctx.lineTo(hx - 7, hy + 1); ctx.closePath(); ctx.fill();
  // stubby horns
  ctx.fillStyle = bodyDk;
  ctx.beginPath(); ctx.moveTo(hx - 3, hy - 7); ctx.lineTo(hx - 1.5, hy - 14); ctx.lineTo(hx + 1.5, hy - 7); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(hx + 5.5, hy - 7); ctx.lineTo(hx + 8, hy - 13.5); ctx.lineTo(hx + 9.5, hy - 5.5); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5;
  ctx.fillStyle = ember;
  ctx.beginPath(); ctx.arc(hx - 1.5, hy - 13.5, 1, 0, Math.PI * 2); ctx.arc(hx + 8, hy - 13, 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // eyes: glowing molten sclera behind a dark iris + pupil that tracks its target
  const eyeGlow = 0.55 + 0.25 * dark + Math.max(0, swingT) * 0.3 + (charging ? 0.25 : 0);
  const eL = { x: hx + 2.5, y: hy - 1, r: 2.9 };
  const eR = { x: hx + 7.6, y: hy - 1, r: 2.4 };
  for (const eEye of [eL, eR]) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = eyeGlow;
    ctx.fillStyle = t.eye;
    ctx.beginPath(); ctx.arc(eEye.x, eEye.y, eEye.r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // dark iris + pupil, nudged toward whatever it's facing/attacking
    const look = charging || swingT >= 0 ? 0.5 : 0.2;
    ctx.fillStyle = bodyDk;
    ctx.beginPath(); ctx.arc(eEye.x + look, eEye.y, eEye.r * 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0a0304";
    ctx.beginPath(); ctx.arc(eEye.x + look, eEye.y, eEye.r * 0.34, 0, Math.PI * 2); ctx.fill();
    // tiny highlight speck so the eye reads as wet/alive
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#fff2d8";
    ctx.beginPath(); ctx.arc(eEye.x + look - eEye.r * 0.2, eEye.y - eEye.r * 0.3, eEye.r * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // snarling mouth with an ember glow when attacking
  const jaw = swingT >= 0 ? 1.4 * Math.sin(Math.min(swingT * 1.5, 1) * Math.PI) : 0.2;
  ctx.fillStyle = flash ? "#fff" : "#180404";
  ctx.beginPath(); ctx.moveTo(hx - 1, hy + 4.5); ctx.quadraticCurveTo(hx + 5, hy + 5.5 + jaw, hx + 9, hy + 4); ctx.quadraticCurveTo(hx + 5, hy + 3.4, hx - 1, hy + 4.5); ctx.fill();
  if (jaw > 0.6) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5;
    ctx.fillStyle = ember; ctx.beginPath(); ctx.ellipse(hx + 4.5, hy + 4.8, 2.6, jaw * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // huge slamming fists — both arms swing wide together on an attack or charge
  const shoLX = -4, shoRX = 4, shoY = y - 20;
  ctx.strokeStyle = body; ctx.lineWidth = 3.4; ctx.lineCap = "round";
  if (swingT >= 0) {
    const p = Math.min(swingT * 1.4, 1);
    const swing = Math.sin(p * Math.PI);
    // right arm: winds up high behind, then slams down-forward in a big arc
    const aR = -2.7 + p * 3.6;
    const rx = shoRX + Math.cos(aR) * 15, ry = shoY + Math.sin(aR) * 15;
    ctx.beginPath(); ctx.moveTo(shoRX, shoY); ctx.lineTo(rx, ry); ctx.stroke();
    ctx.fillStyle = bodyDk; ctx.beginPath(); ctx.arc(rx, ry, 3.6, 0, Math.PI * 2); ctx.fill();
    // left arm mirrors with a slight delay for a double-hammer feel
    const aL = Math.PI + 2.7 - p * 3.6;
    const lx = shoLX + Math.cos(aL) * 13, ly = shoY + Math.sin(aL) * 13;
    ctx.beginPath(); ctx.moveTo(shoLX, shoY); ctx.lineTo(lx, ly); ctx.stroke();
    ctx.fillStyle = bodyDk; ctx.beginPath(); ctx.arc(lx, ly, 3.2, 0, Math.PI * 2); ctx.fill();
    // fiery smear trailing the swing
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = swing * 0.75;
    ctx.strokeStyle = ember; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(shoRX, shoY, 16, -2.8, 0.9); ctx.stroke();
    ctx.globalAlpha = swing * 0.4; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(shoRX, shoY, 20, -2.6, 0.7); ctx.stroke();
    ctx.restore();
  } else {
    const dangle = Math.sin(e.anim * 2) * 2;
    ctx.beginPath(); ctx.moveTo(shoRX, shoY); ctx.lineTo(shoRX + 6 + dangle, shoY + 10); ctx.stroke();
    ctx.fillStyle = bodyDk; ctx.beginPath(); ctx.arc(shoRX + 6 + dangle, shoY + 10, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(shoLX, shoY); ctx.lineTo(shoLX - 6 - dangle, shoY + 10); ctx.stroke();
    ctx.fillStyle = bodyDk; ctx.beginPath(); ctx.arc(shoLX - 6 - dangle, shoY + 10, 3.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = "butt";
  ctx.restore();
  ctx.restore();
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

function cullStackedImps(enemies) {
  const wallStacks = new Map();
  for (const e of enemies) {
    if (e.type !== "imp" || e.dying) continue;
    if (e.aiState !== "stacking" && e.aiState !== "stackQueue") continue;
    const key = e.stackWallRef || e.queueWallRef;
    if (!key) continue;
    let entry = wallStacks.get(key);
    if (!entry) { entry = { top: null, topY: Infinity, count: 0 }; wallStacks.set(key, entry); }
    entry.count++;
    const sy = e.impStackY || 0;
    if (sy < entry.topY) { entry.topY = sy; entry.top = e; }
  }
  const hidden = new Set();
  for (const entry of wallStacks.values()) {
    if (entry.count < 3) continue;
    for (const e of enemies) {
      if (e.type !== "imp" || e.dying || e === entry.top) continue;
      if ((e.aiState === "stacking" || e.aiState === "stackQueue") &&
          (e.stackWallRef || e.queueWallRef) === (entry.top.stackWallRef || entry.top.queueWallRef)) {
        hidden.add(e);
      }
    }
    entry.top._stackCount = entry.count;
  }
  return hidden;
}

function isHighDetailContext(e) {
  if (e.aiState === "stacking" || e.aiState === "stackQueue" || e.aiState === "climbOver") return false;
  if (e.attackAnim > 0 || e.target) return true;
  const bx = state.base?.x || 4500;
  if (Math.abs(e.x - bx) < 400) return true;
  return false;
}

export function drawEnemies(dark) {
  const view = visibleWorldBounds(650);
  const budget = renderBudget();
  const hiddenImps = cullStackedImps(state.enemies);
  for (const e of state.enemies) {
    const t=ENEMY_TYPES[e.type];
    if (!t) continue;
    if (e.x < view.left || e.x > view.right) continue;
    if (hiddenImps.has(e)) continue;
    let drawYOff = e.type === "imp" && e.aiState === "stacking" && e.impStackY !== undefined ? e.impStackY : (e.fy || 0);
    const bossT = performance.now()/1000;

    const w=t.w, bob=Math.abs(Math.sin(e.anim*2))*2;
    const isBoss = !!t.boss;
    const atkF = Math.max(0, e.attackAnim || 0) / 0.25;
    const custom = e.type === "imp" ? drawImp : e.type === "fireImp" ? drawFireImp : e.type === "emberBrute" ? drawEmberBrute : e.type === "ashPriest" ? drawAshPriest : e.type === "fireDragon" ? drawFireDragon : e.type === "magmaGolem" ? drawMagmaGolem
      : e.type === "shade" ? drawShade : e.type === "voidWraith" ? drawVoidWraith : e.type === "voidBrute" ? drawVoidBrute : e.type === "voidTitan" ? drawVoidTitan : e.type === "voidSeraph" ? drawVoidSeraph : null;
    const useSilhouette = shouldDrawEnemySilhouette(e, t, budget) ||
      (e.type === "imp" && !e.dying && !isHighDetailContext(e) && !t.boss && !t.legendary);
    ctx.save(); ctx.translate(e.x, drawYOff);
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
    if (!useSilhouette) drawStuckImpArrows(e);
    ctx.restore();

    if (e._stackCount > 1) {
      ctx.save();
      ctx.font = "bold 10px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillText("×" + e._stackCount, e.x + 1, groundY + drawYOff - t.w - 6);
      ctx.fillStyle = "#ffd060";
      ctx.fillText("×" + e._stackCount, e.x, groundY + drawYOff - t.w - 7);
      ctx.restore();
      e._stackCount = 0;
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
      const bossVisualH = e.type === "magmaGolem" || e.type === "voidTitan" ? t.w * 1.58 : e.type === "voidSeraph" ? t.w * 1.24 : t.w;
      drawHpBar(e.x, groundY+drawYOff-bossVisualH-28, t.w*0.85, e.hp/e.maxHp, "#ff2040");
      ctx.save(); ctx.textAlign="center";
      ctx.font="bold 15px Trebuchet MS";
      ctx.fillStyle="rgba(0,0,0,0.85)"; ctx.fillText(t.name, e.x+1, groundY+drawYOff-bossVisualH-42);
      ctx.fillStyle=t.eye; ctx.fillText(t.name, e.x, groundY+drawYOff-bossVisualH-43);
      ctx.font="11px Trebuchet MS";
      ctx.globalAlpha=0.65+0.25*Math.sin(bossT*3);
      if (e.type === "magmaGolem" || e.type === "voidTitan") ctx.translate(0, -bossVisualH + t.w);
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
