import { clamp } from '../util/math.js';
import { WEAPONS } from '../config/weapons.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { ctx, groundY } from '../canvas.js';
import { Game, state } from '../state.js';
import { roundedRect, legs, drawArm, drawHpBar } from './DrawHelpers.js';
import { wallHeight } from '../entities/Wall.js';

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
    drawHumanoid(v.x, v.anim, "#4a4438", "#9a8a6a", null, v.vx>=0?1:-1, Math.abs(v.vx)>1);
  }
}

export function drawUnits() {
  for (const u of state.units) {
    let body="#3a3550", head="#caa483", tool=null;
    if (u.role==="archer")  { body="#2f5040"; tool="bow"; }
    else if (u.role==="builder") { body="#6a4a28"; tool="hammer"; }
    else if (u.role==="farmer")  { body="#5a6a2a"; tool="scythe"; }
    else if (u.role==="guard")   { body="#3a4a5a"; head="#b09a7a"; }
    const wallLift = u.onWall && u.wall && Math.abs(u.x - u.wall.x) < 40 ? Math.max(0, wallHeight(u.wall) - 14) : 0;

    const shadowAlpha = u.role === "archer" && state.archerSkills.includes("master_shadows") && Game.isNight && (u.smokeReveal || 0) <= 0 ? 0.32 : 1;
    ctx.save();
    if (wallLift > 0) { ctx.translate(0, -wallLift); }
    ctx.globalAlpha = shadowAlpha;
    drawHumanoid(u.x, u.anim, body, head, tool, u.dir, u.moving);
    if (u.role==="guard") {
      const bob=u.moving?Math.abs(Math.sin(u.anim))*1.2:0;
      ctx.save(); ctx.translate(u.x,0); if (u.dir<0) ctx.scale(-1,1);
      ctx.fillStyle="#4a5060"; roundedRect(8,groundY-34-bob,10,16,3); ctx.fill();
      ctx.fillStyle="#f2c14e"; ctx.beginPath(); ctx.arc(13,groundY-28-bob,2.5,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="#b0b8c8"; ctx.lineWidth=2; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(-8,groundY-14-bob); ctx.lineTo(-8,groundY-30-bob); ctx.stroke();
      ctx.strokeStyle="#8a6a30"; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(-5,groundY-22-bob); ctx.lineTo(-11,groundY-22-bob); ctx.stroke();
      ctx.fillStyle="#4a5060"; ctx.beginPath(); ctx.arc(0,groundY-38-bob,6,Math.PI,0); ctx.fill();
      ctx.fillRect(-6,groundY-40-bob,12,3);
      ctx.restore();
    }
    ctx.restore();

    if (u.role === "archer" && u.archerName) {
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

    if (u.transform>0) {
      const p=u.transform/0.55;
      ctx.save(); ctx.globalAlpha=p*0.7; ctx.globalCompositeOperation="lighter";
      const grd=ctx.createRadialGradient(u.x,groundY-28-wallLift,2,u.x,groundY-28-wallLift,28*p);
      grd.addColorStop(0,"#ffffff"); grd.addColorStop(0.4,"#9bd05a"); grd.addColorStop(1,"transparent");
      ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(u.x,groundY-28-wallLift,28*p,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    if (u.hp<u.maxHp) drawHpBar(u.x,groundY-46-wallLift,16,u.hp/u.maxHp,"#9bd05a");
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

export function drawEnemies(dark) {
  for (const e of state.enemies) {
    const t=ENEMY_TYPES[e.type];
    const drawYOff = e.fy || 0;
    const isLegend = t.legendary === true;
    const bossT = performance.now()/1000;

    const w=t.w, bob=Math.abs(Math.sin(e.anim*2))*2;
    const isBoss = e.type==="boss1"||e.type==="boss2"||e.type==="boss3"||e.type==="boss4";
    const atkF = Math.max(0, e.attackAnim || 0) / 0.25;
    ctx.save(); ctx.translate(e.x, drawYOff);
    if (atkF > 0) ctx.scale(1 + atkF * 0.18, 1 - atkF * 0.12);
    if (e.dir<0) ctx.scale(-1,1);
    if (isLegend) {
      drawLegendaryBody(e, t, dark, bossT);
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

export function drawAnimals() {
  for (const a of state.animals) {
    if (!a.alive) continue;
    ctx.save(); ctx.translate(a.x,0); if (a.vx<0) ctx.scale(-1,1);
    const col=a.type==="deer"?"#6a4a2a":"#8a7a6a";
    ctx.fillStyle=col;
    const sz=a.type==="deer"?1.5:1;
    legs(0,groundY-8*sz,a.anim*1.5,4,col);
    roundedRect(-9*sz,groundY-18*sz,18*sz,12*sz,5); ctx.fill();
    ctx.beginPath(); ctx.arc(8*sz,groundY-20*sz,4*sz,0,Math.PI*2); ctx.fill();
    if (a.type==="deer") { ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(8*sz,groundY-24*sz); ctx.lineTo(6*sz,groundY-30*sz); ctx.moveTo(10*sz,groundY-24*sz); ctx.lineTo(12*sz,groundY-30*sz); ctx.stroke(); }
    ctx.restore();
  }
}
