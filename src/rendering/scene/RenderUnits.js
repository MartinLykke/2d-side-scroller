import { ctx, groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { roundedRect, legs, drawArm, drawHpBar } from '../DrawHelpers.js';
import { entityWallLift } from '../../entities/Wall.js';
import { drawArcher } from '../sprites/Archer.js';
import { drawBuilder } from '../sprites/Builder.js';
import { drawVillager } from '../sprites/Villager.js';
import { drawGuard } from '../sprites/Guard.js';
import { drawFarmer } from '../sprites/Farmer.js';

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
  for (const v of state.vagrants) {
    drawVillager(v, v.vx >= 0 ? 1 : -1, Math.abs(v.vx) > 1);
  }
}

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
    hy = handY + (targetY - handY) * e - Math.sin(p * Math.PI) * 18;
  } else {
    hx = targetX; hy = targetY;
  }
  const sag = g.phase === "throw" ? 10 : Math.max(2, 14 * (1 - Math.min(g.t, 1)));
  ctx.save();
  ctx.strokeStyle = "#c9b48a"; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(handX, handY);
  ctx.quadraticCurveTo((handX + hx) / 2, Math.max(handY, hy) + sag, hx, hy);
  ctx.stroke();
  const ang = Math.atan2(hy - handY, hx - handX);
  ctx.translate(hx, hy); ctx.rotate(ang);
  ctx.strokeStyle = "#8a8a94"; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(7, -3, 3, -6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(7, 3, 3, 6); ctx.stroke();
  ctx.restore();
}

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
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#fff2b0";
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + i * (Math.PI * 2 / 3);
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 16, cy + Math.sin(a) * 9 - 2, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  } else if (p > 0.13) {
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
  for (const u of state.units) {
    if (u.mine) continue;
    let body="#3a3550", head="#caa483", tool=null;
    if (u.role==="archer")  { body="#2f5040"; tool="bow"; }
    else if (u.role==="builder") { body="#6a4a28"; tool="hammer"; }
    else if (u.role==="farmer")  { body="#5a6a2a"; tool="scythe"; }
    else if (u.role==="guard")   { body="#3a4a5a"; head="#b09a7a"; }
    let wallLift = entityWallLift(u);
    if (u.grapple) wallLift = u.grappleLiftY || 0;

    const shadowAlpha = u.role === "archer" && state.archerSkills.includes("master_shadows") && Game.isNight && (u.smokeReveal || 0) <= 0 ? 0.32 : 1;
    ctx.save();
    if (wallLift > 0) { ctx.translate(0, -wallLift); }
    ctx.globalAlpha = shadowAlpha;
    if (u.dying) {
      const p = Math.min((u.deathT || 0) / (u.deathDuration || 1.25), 1);
      const ease = 1 - Math.pow(1 - p, 3);
      ctx.globalAlpha *= Math.max(0.25, 1 - Math.max(0, p - 0.72) / 0.28);
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

export { drawAnimals } from '../sprites/Animals.js';
