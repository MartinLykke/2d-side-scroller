import { clamp, dist } from '../../util/math.js';
import { WEAPONS, RARITY_COL } from '../../config/weapons.js';
import { ctx, W, H, groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { windSway } from '../Effects.js';
import { roundedRect, groundShadow, drawTomeIcon } from '../DrawHelpers.js';

export function drawCoins() {
  const t=performance.now();
  for (const c of state.coins) {
    const yy=c.settled?groundY-4-Math.sin(t/300+c.x)*1.5:c.y;
    if (c.settled) groundShadow(c.x,5,0.15);
    ctx.fillStyle="#f2c14e"; ctx.beginPath(); ctx.ellipse(c.x,yy,5,6,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#caa028"; ctx.beginPath(); ctx.ellipse(c.x,yy,2.4,3.4,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(255,250,210,0.9)"; ctx.beginPath(); ctx.ellipse(c.x-1.4,yy-1.8,1,1.6,0,0,Math.PI*2); ctx.fill();
  }
}

export function drawArrows() {
  const t = performance.now() / 1000;
  for (const ar of state.arrows) {
    if (ar.delay > 0) continue; // still nocked on the archer's bow
    const ang=Math.atan2(ar.vy,ar.vx);
    ctx.save(); ctx.translate(ar.x,ar.y); ctx.rotate(ang);
    const wid = ar.weaponId;
    if (ar.enemyFireball) {
      const sc = ar.big ? 2.1 : 1;
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.scale(sc, sc);
      const pulse = 0.85 + 0.15 * Math.sin(t * 24 + ar.x);
      const fg=ctx.createRadialGradient(0,0,2,0,0,20 * pulse);
      fg.addColorStop(0,"rgba(255,245,150,1)");
      fg.addColorStop(0.35,"rgba(255,105,20,0.85)");
      fg.addColorStop(1,"rgba(160,20,0,0)");
      ctx.fillStyle=fg; ctx.beginPath(); ctx.arc(0,0,20 * pulse,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#ffd060"; ctx.beginPath(); ctx.arc(4,0,5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#ff5a16"; ctx.beginPath(); ctx.moveTo(-18,0); ctx.quadraticCurveTo(-7,-10,3,-3); ctx.quadraticCurveTo(-7,8,-18,0); ctx.fill();
      if (ar.big) {
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = "#ff8a30"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-30,0); ctx.quadraticCurveTo(-16,-7+Math.sin(t*30)*3,-4,-2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-30,0); ctx.quadraticCurveTo(-16,7+Math.sin(t*26)*3,-4,2); ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
      continue;
    }
    if (ar.fireArrow) {
      ctx.save(); ctx.globalCompositeOperation="lighter";
      const fg=ctx.createRadialGradient(1,0,1,1,0,17);
      fg.addColorStop(0,"rgba(255,230,110,0.95)");
      fg.addColorStop(0.45,"rgba(255,100,20,0.65)");
      fg.addColorStop(1,"rgba(180,20,0,0)");
      ctx.fillStyle=fg; ctx.beginPath(); ctx.arc(1,0,17,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=0.7;
      ctx.strokeStyle="#ff7a20"; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(-18,0); ctx.lineTo(5,0); ctx.stroke();
      ctx.restore();
    }
    if (wid === "dark_bow") {
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.55;
      const dg=ctx.createRadialGradient(0,0,1,0,0,12);
      dg.addColorStop(0,"rgba(180,80,255,0.8)"); dg.addColorStop(1,"rgba(40,0,80,0)");
      ctx.fillStyle=dg; ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill(); ctx.restore();
      ctx.strokeStyle="#220033"; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(-22,0); ctx.lineTo(6,0); ctx.stroke();
      ctx.fillStyle="#9933cc"; ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(1,-3); ctx.lineTo(1,3); ctx.fill();
      ctx.save(); ctx.globalAlpha=0.7; ctx.strokeStyle="#aa44ff"; ctx.lineWidth=1.5;
      for (let k=0;k<3;k++) { const bx=-8-k*4; ctx.beginPath(); ctx.moveTo(bx,0); ctx.lineTo(bx-4,-4); ctx.moveTo(bx,0); ctx.lineTo(bx-4,4); ctx.stroke(); } ctx.restore();
    } else if (wid === "void_bow") {
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.7;
      const vg=ctx.createRadialGradient(0,0,2,0,0,14);
      vg.addColorStop(0,"rgba(160,60,255,0.9)"); vg.addColorStop(1,"rgba(60,0,140,0)");
      ctx.fillStyle=vg; ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=0.4*(0.7+0.3*Math.sin(t*18));
      const vg2=ctx.createRadialGradient(0,0,4,0,0,22);
      vg2.addColorStop(0,"rgba(255,180,255,0.5)"); vg2.addColorStop(1,"rgba(80,0,160,0)");
      ctx.fillStyle=vg2; ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.fill(); ctx.restore();
      ctx.strokeStyle="#dd99ff"; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.moveTo(-20,0); ctx.lineTo(7,0); ctx.stroke();
      ctx.fillStyle="#ffffff"; ctx.beginPath(); ctx.arc(7,0,2.5,0,Math.PI*2); ctx.fill();
    } else if (wid === "dragons_bow") {
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.8;
      const frg=ctx.createRadialGradient(2,0,2,2,0,18);
      frg.addColorStop(0,"rgba(255,220,100,1)"); frg.addColorStop(0.4,"rgba(255,100,20,0.8)"); frg.addColorStop(1,"rgba(200,40,0,0)");
      ctx.fillStyle=frg; ctx.beginPath(); ctx.arc(2,0,18,0,Math.PI*2); ctx.fill();
      const flk=0.8+0.2*Math.sin(t*25); ctx.globalAlpha=0.5*flk;
      ctx.fillStyle="rgba(255,240,160,0.6)"; ctx.beginPath(); ctx.arc(2,0,10,0,Math.PI*2); ctx.fill(); ctx.restore();
      ctx.strokeStyle="#cc4400"; ctx.lineWidth=3.5;
      ctx.beginPath(); ctx.moveTo(-18,0); ctx.lineTo(5,0); ctx.stroke();
      ctx.fillStyle="#ffaa40"; ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(2,-4); ctx.lineTo(2,4); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.45;
      ctx.strokeStyle="#ff8820"; ctx.lineWidth=1;
      for (let k=0;k<4;k++) { const bx=-5-k*4; const fl=Math.sin(t*20+k)*3; ctx.beginPath(); ctx.moveTo(bx,0); ctx.lineTo(bx-2,-4+fl); ctx.stroke(); } ctx.restore();
    } else {
      // Same arrow the archer nocks: wooden shaft, steel head, green fletching
      ctx.strokeStyle="#c9b48a"; ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(5,0); ctx.stroke();
      ctx.fillStyle="#b8bcc4";
      ctx.beginPath(); ctx.moveTo(5,-1.6); ctx.lineTo(8.5,0); ctx.lineTo(5,1.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle="#8fae4a";
      ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(-13,-2.6); ctx.lineTo(-8.5,-0.6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(-13,2.6); ctx.lineTo(-8.5,0.6); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

export function drawLootItems() {
  if (!state.lootItems) return;
  const t=performance.now()/1000;
  for (const it of state.lootItems) {
    const w=WEAPONS[it.weaponId], bob=Math.sin(t*2.5+it.x*0.01)*3;
    const yy = (it.dropY !== undefined) ? it.dropY : groundY-16+bob;
    const rc=RARITY_COL[w.rarity];
    const stillFalling = it.dropVy !== undefined && it.dropVy !== 0;
    const timeLeft = 10 - (it.despawnTimer || 0);
    const blinking = !stillFalling && timeLeft < 3;
    const blinkAlpha = blinking ? (0.4 + 0.6 * Math.abs(Math.sin(t * 8))) : 1;
    ctx.save(); ctx.globalAlpha = blinkAlpha;
    ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=(stillFalling?0.08:0.2)+0.12*Math.sin(t*3+it.x*0.004);
    ctx.fillStyle=rc; ctx.beginPath(); ctx.arc(it.x,yy,14,0,Math.PI*2); ctx.fill(); ctx.restore();
    if (!stillFalling) groundShadow(it.x,9,0.22);
    const spinAng = stillFalling ? (t*8 % (Math.PI*2)) : (-0.35+Math.sin(t*1.2+it.x*0.005)*0.07);
    ctx.save(); ctx.translate(it.x,yy); ctx.rotate(spinAng);
    ctx.strokeStyle=w.col; ctx.lineWidth=3; ctx.lineCap="round";
    if (w.type==="melee") {
      const len=clamp(w.range*0.28,12,26);
      ctx.beginPath(); ctx.moveTo(-len/2,0); ctx.lineTo(len/2,0); ctx.stroke();
      ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(-len*0.3,-5); ctx.lineTo(-len*0.3,5); ctx.stroke();
    } else if (w.type==="ranged") {
      ctx.beginPath(); ctx.arc(0,0,9,-1.3,1.3); ctx.stroke();
      ctx.strokeStyle="#e8d8a8"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(9*Math.cos(-1.3),9*Math.sin(-1.3)); ctx.lineTo(9*Math.cos(1.3),9*Math.sin(1.3)); ctx.stroke();
    } else {
      drawTomeIcon(w.col, 1);
    }
    ctx.restore();
    ctx.restore();
  }
}

export function drawChests() {
  if (!state.chests || !state.chests.length) return;
  const t=performance.now()/1000;
  const { player } = state;
  for (const ch of state.chests) {
    const x=ch.x, bob=Math.sin(t*2+x*0.01)*2.5, yy=groundY-18+bob;
    const near=dist(x,player.x)<64, oa=ch.openAnim||0;
    groundShadow(x,14,0.22);
    ctx.save(); ctx.translate(x,yy);
    if (near && !ch.open) {
      ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.25+0.12*Math.sin(t*4);
      ctx.fillStyle="#f2c14e"; ctx.beginPath(); ctx.arc(0,0,20,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    const openY = ch.open ? -10*oa : 0;
    ctx.fillStyle=ch.open?"#6a4a22":"#7a5a28"; ctx.fillRect(-14,openY-10,28,20);
    ctx.fillStyle="rgba(255,255,255,0.09)"; ctx.fillRect(-14,openY-10,9,20);
    ctx.fillStyle="rgba(0,0,0,0.22)"; ctx.fillRect(8,openY-10,6,20);
    ctx.fillStyle="#9a8060"; ctx.fillRect(-14,openY-2,28,3); ctx.fillRect(-14,openY+5,28,2);
    ctx.fillStyle="#c0a060"; ctx.beginPath(); ctx.arc(0,openY,3.5,0,Math.PI*2); ctx.fill();
    const lidAngle = ch.open ? -Math.PI*0.55*oa : 0;
    ctx.save(); ctx.translate(0,openY-10); ctx.rotate(lidAngle);
    ctx.fillStyle=ch.open?"#8a6a30":"#9a7a34"; ctx.fillRect(-14,-10,28,10);
    ctx.fillStyle="rgba(255,255,255,0.09)"; ctx.fillRect(-14,-10,9,10);
    ctx.fillStyle="#9a8060"; ctx.fillRect(-14,-2,28,2);
    ctx.restore();
    ctx.restore();
    if (near && !ch.open) {
      ctx.save(); ctx.font="bold 12px Trebuchet MS"; ctx.textAlign="center";
      const py=yy-bob-36, pa=0.7+0.28*Math.sin(t*3);
      ctx.globalAlpha=pa;
      ctx.fillStyle="rgba(0,0,0,0.55)"; ctx.fillText("[F] Åbn kiste",x+1,py+1);
      ctx.fillStyle="#f2c14e"; ctx.fillText("[F] Åbn kiste",x,py);
      ctx.restore();
    }
  }
}

export function drawGroundBows() {
  if (!state.groundBows) return;
  const t=performance.now()/1000;
  for (const b of state.groundBows) {
    const bob=Math.sin(t*2.2+b.x*0.01)*2.5, yy=groundY-14+bob, alpha=b.claimed?0.35:0.7;
    groundShadow(b.x,8,0.18);
    ctx.save(); ctx.globalAlpha=alpha; ctx.translate(b.x,yy); ctx.rotate(-0.3+Math.sin(t*1.1+b.x*0.005)*0.06);
    ctx.strokeStyle="#8a5a2a"; ctx.lineWidth=2.5; ctx.lineCap="round"; ctx.beginPath(); ctx.arc(0,0,8,-1.2,1.2); ctx.stroke();
    ctx.strokeStyle="#e8d8a8"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(8*Math.cos(-1.2),8*Math.sin(-1.2)); ctx.lineTo(8*Math.cos(1.2),8*Math.sin(1.2)); ctx.stroke();
    ctx.restore();
    if (!b.claimed) {
      ctx.save(); ctx.globalAlpha=0.55+0.2*Math.sin(t*3+b.x*0.01); ctx.globalCompositeOperation="lighter";
      ctx.fillStyle="#9bd05a"; ctx.beginPath(); ctx.arc(b.x,yy,12,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
  }
}

export function drawGroundHammers() {
  if (!state.groundHammers) return;
  const t = performance.now()/1000;
  for (const h of state.groundHammers) {
    const bob = Math.sin(t*2.2+h.x*0.01)*2.5, yy = groundY-16+bob, alpha = h.claimed ? 0.35 : 0.72;
    groundShadow(h.x, 8, 0.18);
    ctx.save(); ctx.globalAlpha=alpha; ctx.translate(h.x, yy); ctx.rotate(0.3+Math.sin(t*1.1+h.x*0.005)*0.06);
    ctx.strokeStyle="#7a5a2a"; ctx.lineWidth=2.5; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(0,8); ctx.lineTo(0,-8); ctx.stroke();
    ctx.lineCap="butt";
    ctx.fillStyle="#9a9aaa"; ctx.fillRect(-5,-12,10,5);
    ctx.fillStyle="#bbbbcc"; ctx.fillRect(-5,-12,10,2);
    ctx.restore();
    if (!h.claimed) {
      ctx.save(); ctx.globalAlpha=0.5+0.2*Math.sin(t*3+h.x*0.01); ctx.globalCompositeOperation="lighter";
      ctx.fillStyle="#f2a230"; ctx.beginPath(); ctx.arc(h.x, yy, 13, 0, Math.PI*2); ctx.fill(); ctx.restore();
    }
  }
}
