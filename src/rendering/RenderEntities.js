import { clamp } from '../util/math.js';
import { WEAPONS } from '../config/weapons.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { ctx, groundY } from '../canvas.js';
import { Game, state } from '../state.js';
import { roundedRect, legs, drawArm, drawHpBar } from './DrawHelpers.js';
import { wallHeight } from '../entities/Wall.js';
import { drawArcher } from './Archer.js';
import { drawBuilder } from './Builder.js';
import { drawVillager } from './Villager.js';
import { drawGuard } from './Guard.js';

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

export function drawUnits() {
  for (const u of state.units) {
    let body="#3a3550", head="#caa483", tool=null;
    if (u.role==="archer")  { body="#2f5040"; tool="bow"; }
    else if (u.role==="builder") { body="#6a4a28"; tool="hammer"; }
    else if (u.role==="farmer")  { body="#5a6a2a"; tool="scythe"; }
    else if (u.role==="guard")   { body="#3a4a5a"; head="#b09a7a"; }
    const climbT = u.wall && Math.abs(u.x - u.wall.x) < 90 ? (u.wallClimbT || (u.onWall ? 1 : 0)) : 0;
    const wallLift = u.wall ? Math.max(0, wallHeight(u.wall) - 14) * climbT : 0;

    const shadowAlpha = u.role === "archer" && state.archerSkills.includes("master_shadows") && Game.isNight && (u.smokeReveal || 0) <= 0 ? 0.32 : 1;
    ctx.save();
    if (wallLift > 0) { ctx.translate(0, -wallLift); }
    ctx.globalAlpha = shadowAlpha;
    if (u.dying) {
      const p = Math.min((u.deathT || 0) / (u.deathDuration || 1.25), 1);
      const ease = 1 - Math.pow(1 - p, 3);
      ctx.globalAlpha *= Math.max(0.25, 1 - Math.max(0, p - 0.72) / 0.28);
      ctx.translate(0, groundY);
      ctx.rotate((u.deathSpin || 1) * ease * (u.role === "guard" ? 1.35 : 1.55));
      ctx.translate(0, -groundY + ease * 3);
    }

    if (u.role === "archer") {
      drawArcher(u);
    } else if (u.role === "builder") {
      drawBuilder(u);
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

    if (!u.dying && u.role === "archer" && u.archerName) {
      const shadowAlpha = state.archerSkills.includes("master_shadows") && Game.isNight && (u.smokeReveal || 0) <= 0 ? 0.35 : 0.9;
      ctx.save();
      ctx.globalAlpha = shadowAlpha;
      ctx.textAlign = "center";
      const nameY = groundY - 68 - wallLift;
      ctx.font = "bold 10px sans-serif";
      ctx.fillStyle = u.charged ? "#ffcc44" : "#f0e8cc";
      ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = 3;
      ctx.strokeText(u.archerName, u.x, nameY);
      ctx.fillText(u.archerName, u.x, nameY);
      ctx.font = "9px sans-serif";
      ctx.fillStyle = "#9bd05a";
      ctx.strokeText("Niv. " + (u.level || 1), u.x, nameY + 11);
      ctx.fillText("Niv. " + (u.level || 1), u.x, nameY + 11);
      if (u.charged) {
        ctx.globalAlpha = shadowAlpha * 0.8;
        ctx.fillStyle = "#ffcc44";
        ctx.font = "9px sans-serif";
        ctx.fillText("⚡ LADET", u.x, nameY + 22);
      }
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

function drawLegendaryBody(e, t, dark, T) {
  const w=t.w, bob=Math.abs(Math.sin(e.anim*1.4))*4;
  const windupFrac = e.specialPhase===1 ? Math.max(0,1-(e.specialTimer/(t.windupTime||1))) : 0;
  const flashCol = e.flash>0?"#ffffff":t.color;
  const isLegend2 = e.type==="legend2", isLegend3 = e.type==="legend3";

  ctx.save(); ctx.globalAlpha=0.25; ctx.fillStyle="#000";
  ctx.beginPath(); ctx.ellipse(0,groundY-2,w*0.7,10,0,0,Math.PI*2); ctx.fill(); ctx.restore();

  ctx.save(); ctx.globalCompositeOperation="lighter";
  const aR=w*(1.35+0.14*Math.sin(T*1.7)+windupFrac*0.5);
  const ag=ctx.createRadialGradient(0,groundY-w*0.4,10,0,groundY-w*0.4,aR);
  ag.addColorStop(0,t.eye); ag.addColorStop(0.55,`rgba(${t.eyeRgb||[255,60,90]},0.22)`); ag.addColorStop(1,"rgba(0,0,0,0)");
  ctx.globalAlpha=0.2+0.1*Math.sin(T*1.5)+windupFrac*0.35;
  ctx.fillStyle=ag; ctx.beginPath(); ctx.ellipse(0,groundY-w*0.4,aR,aR*0.6,0,0,Math.PI*2); ctx.fill();
  ctx.restore();

  const s=Math.sin(e.anim*3), lw=Math.max(4,w*0.095);
  ctx.strokeStyle=flashCol; ctx.lineWidth=lw; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(-w*0.22,groundY-14-bob); ctx.lineTo(-w*0.22+s*8,groundY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*0.22,groundY-14-bob);  ctx.lineTo(w*0.22-s*8,groundY); ctx.stroke();
  ctx.lineCap="butt";

  const armLift = windupFrac * 50;
  ctx.fillStyle=flashCol;
  ctx.beginPath(); ctx.moveTo(-w*0.5,groundY-w*0.6-bob); ctx.lineTo(-w*0.95,groundY-w*0.82-bob-armLift); ctx.lineTo(-w*0.72,groundY-w*0.38-bob); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w*0.5,groundY-w*0.6-bob);  ctx.lineTo(w*0.95,groundY-w*0.82-bob-armLift);  ctx.lineTo(w*0.72,groundY-w*0.38-bob);  ctx.closePath(); ctx.fill();

  ctx.fillStyle=flashCol;
  roundedRect(-w/2,groundY-w-10-bob,w,w+10,w*0.28); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,0.05)"; roundedRect(-w/2,groundY-w-10-bob,w*0.28,w+10,w*0.28); ctx.fill();

  if (isLegend3) {
    ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.strokeStyle=t.eye; ctx.lineWidth=3;
    ctx.globalAlpha=0.38; ctx.beginPath(); ctx.ellipse(0,groundY-w*0.45-bob,w*0.68,w*0.27,T*0.65,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=0.22; ctx.beginPath(); ctx.ellipse(0,groundY-w*0.45-bob,w*0.88,w*0.34,-T*0.42,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }
  if (isLegend2) {
    ctx.save(); ctx.fillStyle=t.eye; ctx.globalAlpha=0.55;
    for (let ci=0;ci<5;ci++) { const cx=(ci/4-0.5)*w*0.9, ch=18+Math.sin(T*2+ci)*7; ctx.beginPath(); ctx.moveTo(cx-5,groundY); ctx.lineTo(cx,groundY-ch); ctx.lineTo(cx+5,groundY); ctx.fill(); }
    ctx.restore();
  }

  const hornCt = isLegend3?9:isLegend2?5:7;
  ctx.fillStyle=flashCol;
  for (let hi=0;hi<hornCt;hi++) {
    const hfrac=hi/(hornCt-1), hx=(hfrac-0.5)*w*0.94;
    const mid=Math.abs(hi-Math.floor(hornCt/2))<1.5;
    const hh=hi%2===0?40:24+(mid?16:0);
    ctx.beginPath(); ctx.moveTo(hx-5,groundY-w-8-bob); ctx.lineTo(hx,groundY-w-8-hh-bob); ctx.lineTo(hx+5,groundY-w-8-bob); ctx.fill();
  }

  const eyeRows = isLegend3?3:isLegend2?2:1;
  for (let ei=0;ei<eyeRows;ei++) {
    const ey=groundY-w*(0.62-ei*0.2)-bob;
    ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.6+0.28*Math.sin(T*3+ei*2); ctx.fillStyle=t.eye;
    ctx.beginPath(); ctx.ellipse(-w*0.14,ey,w*0.13,w*0.08,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w*0.14,ey,w*0.13,w*0.08,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.fillStyle=t.eye;
    ctx.beginPath(); ctx.arc(-w*0.14,ey,w*0.045,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(w*0.14,ey,w*0.045,0,Math.PI*2); ctx.fill();
  }

  ctx.save(); ctx.globalAlpha=0.28+0.12*Math.sin(T*2.2); ctx.strokeStyle=t.eye; ctx.lineWidth=2;
  for (let ri=0;ri<4;ri++) {
    const ry=groundY-w*(0.18+ri*0.18)-bob;
    ctx.beginPath(); ctx.moveTo(-w*0.35,ry); ctx.lineTo(w*0.35,ry); ctx.stroke();
    if (ri%2===0) { ctx.beginPath(); ctx.moveTo(-w*0.25,ry-5); ctx.lineTo(-w*0.12,ry+5); ctx.moveTo(w*0.25,ry-5); ctx.lineTo(w*0.12,ry+5); ctx.stroke(); }
  }
  ctx.restore();
}

// Small hunched devil: whip tail, oversized ears, lunging claw swipe.
function drawStuckImpArrows(e) {
  if (!e.stuckArrows || !e.stuckArrows.length) return;
  ctx.save();
  for (const ar of e.stuckArrows) {
    ctx.save();
    ctx.translate(ar.x, ar.y);
    ctx.rotate(ar.a || 0);
    const magic = ar.weaponId === "void_bow" || ar.weaponId === "dark_bow" || ar.weaponId === "dragons_bow";
    if (magic) {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.28;
      ctx.strokeStyle = ar.weaponId === "dragons_bow" ? "#ff8840" : "#b060ff";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(3, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = magic ? "#e8d8ff" : "#c9b48a";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(5, 0); ctx.stroke();
    ctx.fillStyle = "#b8bcc4";
    ctx.beginPath(); ctx.moveTo(5, -1.6); ctx.lineTo(8, 0); ctx.lineTo(5, 1.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = magic ? "#c69fff" : "#8fae4a";
    ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-17, -2.3); ctx.lineTo(-14, -0.3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-17, 2.3); ctx.lineTo(-14, 0.3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawImp(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0;
  const p = atkF > 0 ? 1 - atkF : -1;   // 0..1 swipe progress, -1 when idle
  const atkKind = e.impAttackKind || "claw";
  const bob = Math.abs(Math.sin(e.anim * 2.6)) * 2.2;
  const body = flash ? "#fff" : "#8f221c";
  const bodyDk = flash ? "#fff" : "#4a1016";
  const bodyMid = flash ? "#fff" : "#b33124";
  const ember = "#ff7a24";
  const emberHot = "#ffd060";
  const lunge = p >= 0 ? Math.sin(Math.min(p * 1.6, 1) * Math.PI) * (atkKind === "pounce" ? 1.5 : 6) : 0;

  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.16 + 0.08 * Math.sin(T * 9 + e.x);
  const aura = ctx.createRadialGradient(0, groundY - 18 - bob, 2, 0, groundY - 18 - bob, 26);
  aura.addColorStop(0, "rgba(255,120,30,0.55)");
  aura.addColorStop(1, "rgba(120,20,0,0)");
  ctx.fillStyle = aura; ctx.beginPath(); ctx.ellipse(0, groundY - 18 - bob, 20, 25, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // whip tail, raised when striking
  const wag = Math.sin(T * 6 + e.x * 0.1) * 4;
  const tailStrike = atkKind === "tail" && p >= 0 ? Math.sin(Math.min(p * 1.45, 1) * Math.PI) : 0;
  const tipX = -20 + tailStrike * 39;
  const tipY = groundY - 22 - bob - wag - (p >= 0 ? 6 : 0) + tailStrike * 6;
  ctx.strokeStyle = bodyDk; ctx.lineWidth = 2.2; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-6, groundY - 10 - bob);
  ctx.quadraticCurveTo(-16 + tailStrike * 26, groundY - 14 - bob + wag * 0.4, tipX, tipY);
  ctx.stroke(); ctx.lineCap = "butt";
  ctx.fillStyle = bodyDk;
  ctx.beginPath(); ctx.moveTo(tipX - 3, tipY + 2); ctx.lineTo(tipX + 1, tipY - 4); ctx.lineTo(tipX + 3, tipY + 2); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.7;
  ctx.fillStyle = ember;
  ctx.beginPath(); ctx.ellipse(tipX + 1, tipY - 4, 3.2, 5.5 + Math.sin(T * 14) * 1.2, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = emberHot;
  ctx.beginPath(); ctx.ellipse(tipX + 1, tipY - 5, 1.4, 2.8, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // scuttling legs
  const s = Math.sin(e.anim * 3);
  ctx.strokeStyle = body; ctx.lineWidth = 2.4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-4 + lunge * 0.4, groundY - 9 - bob); ctx.lineTo(-5 + s * 4 + lunge * 0.3, groundY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3 + lunge * 0.4, groundY - 9 - bob); ctx.lineTo(4 - s * 4 + lunge * 0.3, groundY); ctx.stroke();
  ctx.lineCap = "butt";

  ctx.save();
  ctx.translate(lunge, 0);
  if (atkKind === "pounce" && p >= 0) ctx.rotate(-0.18 * Math.sin(Math.min(p, 1) * Math.PI));
  // hunched body, tilting into the lunge
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, groundY - 13 - bob, 8, 9.5, p >= 0 ? -0.5 : -0.25, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = bodyMid;
  ctx.beginPath(); ctx.ellipse(2, groundY - 12 - bob, 4.6, 6.2, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(255,150,54,0.35)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(-1, groundY - 14 - bob, 7, -0.5, 1.1); ctx.stroke();
  ctx.beginPath(); ctx.arc(2, groundY - 12 - bob, 4, 2.1, 3.45); ctx.stroke();

  // big head thrust forward
  const hx = 6 + (p >= 0 ? 2 : 0), hy = groundY - 24 - bob;
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.fill();
  // swept-back ear
  ctx.beginPath(); ctx.moveTo(hx - 4, hy - 4); ctx.lineTo(hx - 14, hy - 9); ctx.lineTo(hx - 3, hy - 7.5); ctx.closePath(); ctx.fill();
  // horn nubs
  ctx.fillStyle = bodyDk;
  ctx.beginPath(); ctx.moveTo(hx - 1, hy - 6); ctx.lineTo(hx + 1, hy - 11); ctx.lineTo(hx + 3, hy - 6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(hx + 3, hy - 5); ctx.lineTo(hx + 6, hy - 9.5); ctx.lineTo(hx + 6.5, hy - 4); ctx.closePath(); ctx.fill();
  // glowing eyes + jagged grin
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.7 + 0.25 * dark;
  ctx.fillStyle = emberHot;
  ctx.beginPath(); ctx.arc(hx + 2.2, hy - 1.5, 2.6, 0, Math.PI * 2); ctx.arc(hx + 5.4, hy - 1, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = emberHot;
  ctx.beginPath(); ctx.arc(hx + 2.2, hy - 1.5, 1.1, 0, Math.PI * 2); ctx.arc(hx + 5.4, hy - 1, 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = emberHot; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(hx + 1, hy + 3.5); ctx.lineTo(hx + 3, hy + 4.5); ctx.lineTo(hx + 5, hy + 3.2); ctx.lineTo(hx + 7, hy + 4); ctx.stroke();
  ctx.fillStyle = bodyDk;
  ctx.beginPath(); ctx.moveTo(hx - 2, hy - 7); ctx.lineTo(hx - 7, hy - 13); ctx.lineTo(hx - 4, hy - 6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(hx + 2, hy - 7); ctx.lineTo(hx + 3, hy - 14); ctx.lineTo(hx + 5, hy - 6); ctx.closePath(); ctx.fill();

  // claw arms
  const shoX = 3, shoY = groundY - 17 - bob;
  ctx.strokeStyle = body; ctx.lineWidth = 2.2; ctx.lineCap = "round";
  if (p >= 0 && atkKind !== "tail") {
    // swipe: claw whips from raised to down-forward
    const a = -1.7 + Math.min(p * 1.4, 1) * (atkKind === "pounce" ? 2.65 : 2.3);
    const ax = shoX + Math.cos(a) * 9, ay = shoY + Math.sin(a) * 9;
    ctx.beginPath(); ctx.moveTo(shoX, shoY); ctx.lineTo(ax, ay); ctx.stroke();
    ctx.lineWidth = 1.2;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + Math.cos(a + k * 0.35) * 4, ay + Math.sin(a + k * 0.35) * 4); ctx.stroke();
    }
    // slash smear fading out after the hit
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = atkF * 0.8;
    ctx.strokeStyle = ember; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(shoX + 2, shoY, 12, -1.3, 0.9); ctx.stroke();
    ctx.globalAlpha = atkF * 0.4; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(shoX + 2, shoY, 15, -1.2, 0.8); ctx.stroke();
    ctx.restore();
  } else {
    const dangle = Math.sin(e.anim * 3) * 2;
    ctx.beginPath(); ctx.moveTo(shoX, shoY); ctx.lineTo(shoX + 5 + dangle * 0.4, shoY + 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2, shoY + 1); ctx.lineTo(2 - dangle * 0.4, shoY + 9); ctx.stroke();
  }
  ctx.lineCap = "butt";
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5;
  ctx.fillStyle = emberHot;
  for (let k = 0; k < 3; k++) {
    const ex = -3 + k * 4 + Math.sin(T * 5 + k) * 1.2;
    const ey = groundY - 18 - bob + Math.cos(T * 6 + k) * 4;
    ctx.beginPath(); ctx.arc(ex, ey, 0.9, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  drawStuckImpArrows(e);
  ctx.restore();
}

function drawFireImp(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0;
  const w = t.w;
  const y = groundY - w * 0.62;
  const flap = Math.sin(e.anim * 5) * 8;
  const charge = Math.max(0, atkF);
  const body = flash ? "#fff" : "#9b2418";
  const darkRed = flash ? "#fff" : "#431018";
  const ember = "#ff6a20";
  const hot = "#ffd060";

  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.22 + 0.15 * Math.sin(T * 9 + e.x);
  const aura = ctx.createRadialGradient(0, y, 2, 0, y, 34);
  aura.addColorStop(0, "rgba(255,180,55,0.65)");
  aura.addColorStop(0.55, "rgba(255,70,15,0.25)");
  aura.addColorStop(1, "rgba(120,0,0,0)");
  ctx.fillStyle = aura; ctx.beginPath(); ctx.ellipse(0, y, 28, 22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.fillStyle = darkRed;
  ctx.beginPath(); ctx.moveTo(-w * 0.35, y + 2); ctx.lineTo(-w * 1.45, y - 6 - flap); ctx.lineTo(-w * 0.55, y + 12); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w * 0.35, y + 2); ctx.lineTo(w * 1.45, y - 6 + flap); ctx.lineTo(w * 0.55, y + 12); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.35;
  ctx.strokeStyle = ember; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-w * 0.45, y + 2); ctx.lineTo(-w * 1.15, y - 4 - flap * 0.7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.45, y + 2); ctx.lineTo(w * 1.15, y - 4 + flap * 0.7); ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = darkRed; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-5, y + 7); ctx.quadraticCurveTo(-18, y + 14, -23, y + 4 + Math.sin(T * 7) * 3); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = hot; ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.ellipse(-24, y + 2 + Math.sin(T * 7) * 3, 2.4, 5, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, y + 5, 9, 10, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(6, y - 6, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = darkRed;
  ctx.beginPath(); ctx.moveTo(2, y - 12); ctx.lineTo(-4, y - 20); ctx.lineTo(5, y - 14); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(9, y - 13); ctx.lineTo(13, y - 21); ctx.lineTo(12, y - 12); ctx.closePath(); ctx.fill();

  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.75 + dark * 0.25;
  ctx.fillStyle = hot;
  ctx.beginPath(); ctx.arc(8, y - 7, 2.5, 0, Math.PI * 2); ctx.arc(13, y - 6.5, 2.1, 0, Math.PI * 2); ctx.fill();
  if (charge > 0) {
    const g = ctx.createRadialGradient(19, y - 3, 1, 19, y - 3, 9 + charge * 11);
    g.addColorStop(0, "rgba(255,245,150,1)");
    g.addColorStop(0.5, "rgba(255,90,20,0.75)");
    g.addColorStop(1, "rgba(180,20,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(19, y - 3, 9 + charge * 11, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = body; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(5, y + 3); ctx.lineTo(14 + charge * 5, y + 1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-3, y + 5); ctx.lineTo(4, y + 13); ctx.stroke();
  ctx.lineCap = "butt";
}

// Horn-helmed marauder with fur-trimmed leathers and a heavy axe chop.
function drawRaider(e, t, dark, atkF) {
  const flash = e.flash > 0;
  const p = atkF > 0 ? 1 - atkF : -1;   // 0..1 chop progress, -1 when idle
  const bob = Math.abs(Math.sin(e.anim * 2)) * 1.8;
  const cloth = flash ? "#fff" : "#3a1c16";
  const clothLt = flash ? "#fff" : "#50291f";
  const fur = flash ? "#fff" : "#5a4632";
  const skin = flash ? "#fff" : "#8a6a52";
  const iron = flash ? "#fff" : "#7d7d8c";
  const hipY = groundY - 16 - bob, shY = groundY - 30 - bob, headY = groundY - 37 - bob;

  // legs
  const s = Math.sin(e.anim * 3);
  ctx.strokeStyle = cloth; ctx.lineWidth = 3.2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-3, hipY); ctx.lineTo(-4 + s * 5, groundY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3, hipY); ctx.lineTo(4 - s * 5, groundY); ctx.stroke();
  ctx.lineCap = "butt";

  // torso leans into the chop
  const leanX = p >= 0 ? Math.sin(Math.min(p * 1.5, 1) * Math.PI) * 3 : 0;
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(-7 + leanX, shY);
  ctx.lineTo(7 + leanX, shY);
  ctx.lineTo(5.5, hipY + 3);
  ctx.lineTo(-5.5, hipY + 3);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(-6 + leanX, shY + 1, 3, 8);
  // fur mantle across the shoulders
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.moveTo(-8.5 + leanX, shY + 1);
  for (let k = 0; k <= 6; k++) { const fx = -8.5 + k * 2.9 + leanX; ctx.lineTo(fx + 1.4, shY + 5.5); ctx.lineTo(fx + 2.9, shY + 1); }
  ctx.lineTo(8.5 + leanX, shY - 3);
  ctx.lineTo(-8.5 + leanX, shY - 3);
  ctx.closePath(); ctx.fill();
  // belt
  ctx.fillStyle = flash ? "#fff" : "#26120c"; ctx.fillRect(-5.5, hipY - 2, 11, 2.6);
  ctx.fillStyle = flash ? "#fff" : "#c9a24a"; ctx.fillRect(-1.2, hipY - 2, 2.4, 2.6);

  // head under a horned half-helm, eyes burning in the shadow
  const hx = leanX * 0.8;
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(hx, headY, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = iron;
  ctx.beginPath(); ctx.arc(hx, headY - 1.4, 5.3, Math.PI, 0); ctx.fill();
  ctx.fillRect(hx - 5.3, headY - 1.8, 10.6, 2);
  ctx.strokeStyle = iron; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(hx - 4.5, headY - 4); ctx.quadraticCurveTo(hx - 8, headY - 7, hx - 7.5, headY - 11); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx + 4.5, headY - 4); ctx.quadraticCurveTo(hx + 8, headY - 7, hx + 7.5, headY - 11); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = "rgba(10,6,6,0.5)";
  ctx.beginPath(); ctx.arc(hx + 0.5, headY + 0.6, 4, Math.PI * 1.1, Math.PI * 1.9); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5 + 0.3 * dark;
  ctx.fillStyle = t.eye;
  ctx.beginPath(); ctx.arc(hx + 1.5, headY + 0.4, 1.8, 0, Math.PI * 2); ctx.arc(hx + 4, headY + 0.6, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // arms + axe
  const shoF = { x: 5 + leanX, y: shY + 2.5 }, shoB = { x: -5 + leanX, y: shY + 2.5 };
  const drawAxe = (hxp, hyp, a) => {
    ctx.save(); ctx.translate(hxp, hyp); ctx.rotate(a);
    ctx.strokeStyle = flash ? "#fff" : "#5a3a20"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(15, 0); ctx.stroke(); ctx.lineCap = "butt";
    ctx.fillStyle = iron;
    ctx.beginPath();
    ctx.moveTo(12, -1.5);
    ctx.quadraticCurveTo(14, -8, 20, -7);
    ctx.quadraticCurveTo(21, 0, 19, 6);
    ctx.quadraticCurveTo(14, 5, 12, 1.5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = flash ? "#fff" : "#a8a8ba";
    ctx.beginPath(); ctx.moveTo(20, -7); ctx.quadraticCurveTo(21, 0, 19, 6); ctx.lineTo(20.8, 6.2); ctx.quadraticCurveTo(22.6, 0, 21.6, -7.4); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  ctx.strokeStyle = skin; ctx.lineWidth = 2.6; ctx.lineCap = "round";
  if (p >= 0) {
    // overhead chop: raised behind the helm, slamming down in front
    const a = -2.35 + Math.min(p * 1.35, 1) * 2.75;
    const hand = { x: shoF.x + Math.cos(a) * 9, y: shoF.y + Math.sin(a) * 9 };
    ctx.beginPath(); ctx.moveTo(shoB.x, shoB.y); ctx.lineTo(shoB.x - 3, shY + 11); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(shoF.x, shoF.y); ctx.lineTo(hand.x, hand.y); ctx.stroke();
    ctx.lineCap = "butt";
    drawAxe(hand.x, hand.y, a);
    // motion smear behind the blade
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = atkF * 0.6;
    ctx.strokeStyle = t.eye; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(shoF.x, shoF.y, 22, a - 1.1, a - 0.15); ctx.stroke();
    ctx.restore();
  } else {
    // axe carried low at the side while marching
    const swing = Math.sin(e.anim * 3) * 2;
    const hand = { x: shoF.x + 4 + swing * 0.5, y: shY + 10 };
    ctx.beginPath(); ctx.moveTo(shoB.x, shoB.y); ctx.lineTo(shoB.x - 2 - swing, shY + 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(shoF.x, shoF.y); ctx.lineTo(hand.x, hand.y); ctx.stroke();
    ctx.lineCap = "butt";
    drawAxe(hand.x, hand.y, 0.55);
  }
}

export function drawEnemies(dark) {
  for (const e of state.enemies) {
    const t=ENEMY_TYPES[e.type];
    let drawYOff = e.type === "imp" && e.aiState === "stacking" && e.impStackY !== undefined ? e.impStackY : (e.fy || 0);
    const isLegend = t.legendary === true;
    const bossT = performance.now()/1000;

    const w=t.w, bob=Math.abs(Math.sin(e.anim*2))*2;
    const isBoss = e.type==="boss1"||e.type==="boss2"||e.type==="boss3"||e.type==="boss4";
    const atkF = Math.max(0, e.attackAnim || 0) / 0.25;
    const custom = e.type === "imp" ? drawImp : e.type === "fireImp" ? drawFireImp : e.type === "raider" ? drawRaider : null;
    ctx.save(); ctx.translate(e.x, drawYOff);
    if (atkF > 0 && !custom) ctx.scale(1 + atkF * 0.18, 1 - atkF * 0.12);
    if (e.dir<0) ctx.scale(-1,1);
    if (e.dying) {
      const deathProgress = Math.min(e.deathT / (e.deathDuration || 0.5), 1);
      const ease = 1 - Math.pow(1 - deathProgress, 3);
      const impFall = e.type === "imp";
      const rotation = impFall ? (e.deathSpin || 1) * ease * (e.deathKind === "impFallBack" ? 1.55 : 1.18) : ease * Math.PI / 2;
      const sink = impFall ? ease * 4 : 0;
      ctx.translate(0, groundY - sink);
      ctx.rotate(rotation);
      ctx.translate(0, -groundY);
    }
    if (e.type === "imp" && e.burn > 0) {
      const ft = performance.now() / 1000;
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.35 + 0.18 * Math.sin(ft * 18 + e.x);
      const flame = ctx.createRadialGradient(0, groundY - 18, 2, 0, groundY - 18, 24);
      flame.addColorStop(0, "rgba(255,230,80,0.9)");
      flame.addColorStop(0.45, "rgba(255,90,20,0.45)");
      flame.addColorStop(1, "rgba(180,20,0,0)");
      ctx.fillStyle = flame; ctx.beginPath(); ctx.ellipse(0, groundY - 18, 16, 25, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (isLegend) {
      drawLegendaryBody(e, t, dark, bossT);
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
      if (e.type==="brute"||isBoss) {
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
        ctx.fillStyle=`rgba(${t.color},0.7)`;
        const wingFlap=Math.sin(e.anim*4)*8;
        ctx.beginPath(); ctx.moveTo(-w*0.5,groundY-w*0.5-bob); ctx.lineTo(-w*1.8,groundY-w*0.5-bob-wingFlap); ctx.lineTo(-w*0.5,groundY-w*0.1-bob); ctx.fill();
        ctx.beginPath(); ctx.moveTo(w*0.5,groundY-w*0.5-bob); ctx.lineTo(w*1.8,groundY-w*0.5-bob+wingFlap); ctx.lineTo(w*0.5,groundY-w*0.1-bob); ctx.fill();
      }
    }
    ctx.restore();

    if (isLegend) {
      drawHpBar(e.x, groundY+drawYOff-t.w-28, t.w*0.85, e.hp/e.maxHp, "#ff2040");
      const T2=bossT;
      ctx.save(); ctx.textAlign="center";
      ctx.font="bold 15px Trebuchet MS";
      ctx.fillStyle="rgba(0,0,0,0.85)"; ctx.fillText(t.name, e.x+1, groundY+drawYOff-t.w-42);
      ctx.fillStyle=t.eye; ctx.fillText(t.name, e.x, groundY+drawYOff-t.w-43);
      ctx.font="11px Trebuchet MS";
      ctx.globalAlpha=0.65+0.25*Math.sin(T2*3);
      ctx.fillStyle="#f2c14e"; ctx.fillText("⚔ LEGENDARISK BOSS ⚔", e.x, groundY+drawYOff-t.w-58);
      ctx.restore();
      continue;
    }

    const sprH = t.w;
    if (e.hp<e.maxHp) drawHpBar(e.x,groundY+drawYOff-sprH-4,t.w+(isBoss?12:4),e.hp/e.maxHp,isBoss?"#ff4080":"#d05a5a");
    if (isBoss) {
      ctx.save(); ctx.font="bold 12px Trebuchet MS"; ctx.textAlign="center";
      ctx.fillStyle="rgba(0,0,0,0.7)"; ctx.fillText(t.name||e.type, e.x+1, groundY+drawYOff-sprH-18);
      ctx.fillStyle=t.eye; ctx.fillText(t.name||e.type, e.x, groundY+drawYOff-sprH-19); ctx.restore();
    }
  }
}

export { drawAnimals } from './Animals.js';
