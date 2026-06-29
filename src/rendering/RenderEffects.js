import { clamp } from '../util/math.js';
import { ctx, groundY } from '../canvas.js';
import { Game, state } from '../state.js';
import { FX } from './Effects.js';
import { drawFocusHalo } from './DrawHelpers.js';

export function drawCaltrops() {
  if (!state.caltrops || !state.caltrops.length) return;
  ctx.save();
  for (const c of state.caltrops) {
    const alpha = Math.min(1, c.life / 3);
    ctx.globalAlpha = alpha * 0.75;
    ctx.strokeStyle = "#888888"; ctx.lineWidth = 1.5;
    for (let s = 0; s < 4; s++) {
      const a = s * Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(c.x, groundY - 2); ctx.lineTo(c.x + Math.cos(a)*5, groundY - 2 + Math.sin(a)*5); ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawPoisonShots() {
  if (!state.poisonShots || !state.poisonShots.length) return;
  for (const s of state.poisonShots) {
    const age = Math.max(0, 1 - s.life / 1.8);
    ctx.save(); ctx.globalAlpha = 0.25 + 0.2 * age;
    ctx.strokeStyle = "#88cc44"; ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.ellipse(s.landX, groundY - 4, 24, 7, 0, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    ctx.save(); ctx.translate(s.x, s.y);
    ctx.fillStyle = "#7744cc";
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI*2); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.55;
    ctx.fillStyle="#aa66ff";
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.fillStyle="#88cc44"; ctx.globalAlpha=0.7;
    ctx.beginPath(); ctx.arc(-2, -2, 3, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

export function drawLegendaryEffects() {
  for (const ef of state.legendaryEffects) {
    if (ef.type !== "ring") continue;
    const alpha = Math.max(0, ef.life / ef.totalLife);
    ctx.save();
    ctx.globalAlpha = alpha * 0.75;
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = ef.col;
    ctx.lineWidth = (ef.width || 8) * alpha;
    ctx.beginPath();
    ctx.ellipse(ef.x, groundY - 6, ef.radius, ef.radius * 0.25, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.2;
    ctx.fillStyle = ef.col;
    ctx.beginPath();
    ctx.ellipse(ef.x, groundY - 6, ef.radius, ef.radius * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha=p.fly?1:clamp(p.life*1.5,0,1);
    if (!p.fly && p.life>0.12) {
      ctx.save();
      ctx.globalCompositeOperation="lighter";
      ctx.globalAlpha=clamp(p.life,0,1)*0.18;
      ctx.fillStyle=p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size*2.2,0,Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.globalAlpha=p.fly?1:clamp(p.life*1.5,0,1);
    }
    ctx.fillStyle=p.color; ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
  }
  ctx.globalAlpha=1;
}

export function drawFloats() {
  ctx.textAlign="center";
  for (const f of state.floatTexts) {
    ctx.globalAlpha=clamp(f.life,0,1); ctx.font="bold 15px Trebuchet MS";
    ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillText(f.text,f.x+1,f.y+1);
    ctx.fillStyle=f.color; ctx.fillText(f.text,f.x,f.y);
  }
  ctx.globalAlpha=1;
}

export function drawSpells() {
  if (!state.spells || !state.spells.length) return;
  const t = performance.now() / 1000;

  for (const sp of state.spells) {
    ctx.save();
    ctx.translate(sp.x, sp.y);
    const age = sp.age || 0;

    switch (sp.spellType) {
      case "fireball": {
        const ang = Math.atan2(sp.vy, sp.vx);
        ctx.save(); ctx.rotate(ang);

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.6 * (0.8 + 0.2 * Math.sin(t * 30));
        const fg2 = ctx.createRadialGradient(0, 0, 5, -10, 0, 45);
        fg2.addColorStop(0, "rgba(255,200,80,1)");
        fg2.addColorStop(0.4, "rgba(255,60,0,0.6)");
        fg2.addColorStop(1, "rgba(150,0,0,0)");
        ctx.fillStyle = fg2;
        ctx.beginPath(); ctx.arc(-10, 0, 45, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        ctx.fillStyle = "#ff4400";
        ctx.beginPath();
        ctx.moveTo(15, 0); ctx.lineTo(-25, 12); ctx.lineTo(-40, 0); ctx.lineTo(-25, -12);
        ctx.closePath(); ctx.fill();

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(5, 0, 8, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        ctx.restore();
        break;
      }

      case "meteor": {
        const ang3 = Math.atan2(sp.vy, sp.vx);
        ctx.save();
        ctx.rotate(ang3);

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.9;
        const mtg = ctx.createLinearGradient(-100, 0, 20, 0);
        mtg.addColorStop(0, "rgba(100, 10, 0, 0)");
        mtg.addColorStop(0.4, "rgba(255, 60, 10, 0.6)");
        mtg.addColorStop(0.8, "rgba(255, 180, 50, 0.9)");
        mtg.addColorStop(1, "rgba(255, 255, 180, 1)");

        ctx.fillStyle = mtg;
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-40, 25);
        ctx.lineTo(-100, 5);
        ctx.lineTo(-100, -5);
        ctx.lineTo(-40, -25);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = "#2b170a";
        ctx.beginPath();
        ctx.moveTo(22, 3);
        ctx.lineTo(10, 18);
        ctx.lineTo(-10, 16);
        ctx.lineTo(-24, 6);
        ctx.lineTo(-20, -12);
        ctx.lineTo(-4, -20);
        ctx.lineTo(14, -14);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#170a03";
        ctx.beginPath();
        ctx.moveTo(-5, -5); ctx.lineTo(-20, 2); ctx.lineTo(-10, 12);
        ctx.closePath(); ctx.fill();

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const flicker = Math.abs(Math.sin(t * 40)) * 0.3;
        ctx.globalAlpha = 0.7 + flicker;

        const coreGlow = ctx.createRadialGradient(18, 0, 2, 10, 0, 40);
        coreGlow.addColorStop(0, "rgba(255, 255, 255, 1)");
        coreGlow.addColorStop(0.2, "rgba(255, 200, 50, 0.9)");
        coreGlow.addColorStop(0.6, "rgba(255, 50, 0, 0.4)");
        coreGlow.addColorStop(1, "rgba(200, 0, 0, 0)");

        ctx.fillStyle = coreGlow;
        ctx.beginPath();
        ctx.arc(15, 0, 45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = "#ffcc00";
        for (let i = 0; i < 5; i++) {
            const sparkX = -30 - ((age * 120 + i * 25) % 80);
            const sparkY = Math.sin(t * 15 + i) * 20;
            ctx.beginPath(); ctx.arc(sparkX, sparkY, Math.random() * 2 + 1, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
        break;
      }

      case "waterjet": {
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.6;
        const wg=ctx.createRadialGradient(0,0,5,0,0,25);
        wg.addColorStop(0,"rgba(180,255,255,0.9)"); wg.addColorStop(1,"rgba(20,100,220,0)");
        ctx.fillStyle=wg; ctx.beginPath(); ctx.arc(0,0,25,0,Math.PI*2); ctx.fill(); ctx.restore();

        ctx.fillStyle="#1a90d8"; ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#80eeff"; ctx.beginPath(); ctx.arc(-4,-4,6,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#ffffff"; ctx.beginPath(); ctx.arc(-3,-3,3,0,Math.PI*2); ctx.fill();

        ctx.save(); ctx.globalCompositeOperation="lighter";
        for (let ri=0;ri<3;ri++) {
          const rp=(age*4+ri*0.33)%1, rr=12+rp*20, ra=0.5*(1-rp);
          ctx.globalAlpha=ra; ctx.strokeStyle="#80d8ff"; ctx.lineWidth=2.5;
          ctx.beginPath(); ctx.arc(0,0,rr,0,Math.PI*2); ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case "arcane": {
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.9;
        const arcg=ctx.createRadialGradient(0,0,2,0,0,25);
        arcg.addColorStop(0,"rgba(255,255,255,1)"); arcg.addColorStop(0.3,"rgba(255,50,255,0.9)"); arcg.addColorStop(1,"rgba(80,0,200,0)");
        ctx.fillStyle=arcg; ctx.beginPath(); ctx.arc(0,0,25,0,Math.PI*2); ctx.fill();

        ctx.globalAlpha=0.7*(0.5+0.5*Math.sin(t*20));
        ctx.strokeStyle="#ff55ff"; ctx.lineWidth=2.5;
        for (let ri=0;ri<4;ri++) {
          const ra=t*8+ri*(Math.PI*2/4);
          ctx.beginPath(); ctx.arc(0,0,16,ra,ra+1.0); ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle="#ffffff"; ctx.beginPath(); ctx.arc(0,0,7,0,Math.PI*2); ctx.fill();
        break;
      }
      case "shadow": {
        ctx.save(); ctx.globalAlpha=0.85;
        const shg=ctx.createRadialGradient(0,0,5,0,0,30);
        shg.addColorStop(0,"rgba(0,0,0,1)"); shg.addColorStop(0.5,"rgba(40,0,60,0.8)"); shg.addColorStop(1,"rgba(10,0,20,0)");
        ctx.fillStyle=shg; ctx.beginPath(); ctx.arc(0,0,30,0,Math.PI*2); ctx.fill(); ctx.restore();

        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.8;
        ctx.strokeStyle="#aa22ff"; ctx.lineWidth=3;
        for (let ci=0;ci<4;ci++) {
          const ca=-t*6+ci*(Math.PI*2/4);
          const cx2=Math.cos(ca)*22, cy2=Math.sin(ca)*22;
          const mx=Math.cos(ca+0.6)*12, my=Math.sin(ca+0.6)*12;
          ctx.beginPath(); ctx.moveTo(mx,my); ctx.quadraticCurveTo(cx2*0.8,cy2*0.8,cx2,cy2); ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle="#aa22ff"; ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill();
        break;
      }
      case "void": {
        ctx.save(); ctx.globalAlpha=0.95;
        const vbg=ctx.createRadialGradient(0,0,2,0,0,35);
        vbg.addColorStop(0,"rgba(0,0,0,1)"); vbg.addColorStop(0.4,"rgba(15,0,30,0.9)"); vbg.addColorStop(1,"rgba(40,0,80,0)");
        ctx.fillStyle=vbg; ctx.beginPath(); ctx.arc(0,0,35,0,Math.PI*2); ctx.fill(); ctx.restore();

        ctx.save(); ctx.globalCompositeOperation="lighter";
        for (let ri=0;ri<4;ri++) {
          const rp=((age*2.5 + ri*0.25)%1);
          const rr=30*(1-rp), ra=0.8*(1-rp);
          ctx.globalAlpha=ra; ctx.strokeStyle=ri%2===0?"#ff44ff":"#8822ff";
          ctx.lineWidth=2+ri;
          ctx.beginPath(); ctx.arc(0,0,rr,0,Math.PI*2); ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle="#ffffff"; ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill();
        break;
      }
      default: {
        ctx.fillStyle=sp.col||"#ffffff"; ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill(); break;
      }
    }
    ctx.restore();
  }
}

export function drawCampLight(dark) {
  const { base } = state;
  drawFocusHalo(base.x, groundY-24, 170, 68, [255,158,70], 0.08+0.14*Math.max(dark,Game.isNight?1:0));
  for (const s of FX.smoke) { const k=s.t/s.life; ctx.globalAlpha=(1-k)*0.16; ctx.fillStyle="rgba(58,54,58,1)"; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill(); }
  ctx.globalAlpha=1;
  const warm=Math.max(0.22,dark,Game.isNight?0.55:0)*0.95;
  if (warm>0.05) {
    ctx.save(); ctx.globalCompositeOperation="lighter";
    const fl=FX.flicker, R=240*fl;
    const g=ctx.createRadialGradient(base.x,groundY-30,10,base.x,groundY-30,R);
    g.addColorStop(0,`rgba(255,172,72,${0.34*warm*fl})`); g.addColorStop(1,"rgba(255,120,40,0)");
    ctx.fillStyle=g; ctx.fillRect(base.x-R,groundY-30-R,R*2,R*2); ctx.restore();
  }
  ctx.save(); ctx.globalCompositeOperation="lighter";
  for (const e of FX.embers) { const k=e.t/e.life; ctx.globalAlpha=1-k; ctx.fillStyle=`rgba(255,${(170-90*k)|0},60,1)`; ctx.fillRect(e.x,e.y,e.s,e.s); }
  ctx.restore(); ctx.globalAlpha=1;
}
