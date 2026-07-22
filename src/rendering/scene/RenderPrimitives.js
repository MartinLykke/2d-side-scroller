import { ctx, groundY } from '../../core/canvas.js';
import { FX, windGust, windSway } from '../Effects.js';
import { groundShadow } from '../DrawHelpers.js';

export function drawTorch(x, y) {
  const t=performance.now()/1000;
  const fl=0.74 + 0.24*Math.sin(t*9 + x*0.73) + 0.12*Math.sin(t*23.3 + x*1.91);
  const sway=Math.sin(t*7+x*0.7)*1.4+windGust()*0.6;
  const fy=y-16;
  ctx.strokeStyle="#3a2a1a"; ctx.lineWidth=2.4; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y-12); ctx.stroke(); ctx.lineCap="butt";
  ctx.fillStyle="#5a4226"; ctx.fillRect(x-2.2,y-14,4.4,4);
  ctx.strokeStyle="rgba(0,0,0,0.35)"; ctx.lineWidth=0.8;
  ctx.beginPath(); ctx.moveTo(x-2.2,y-12.6); ctx.lineTo(x+2.2,y-11.4); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation="lighter";
  let rg=ctx.createRadialGradient(x,fy,1,x,fy,30*fl);
  rg.addColorStop(0,"rgba(255,180,80,0.34)");
  rg.addColorStop(0.5,"rgba(255,120,40,0.13)");
  rg.addColorStop(1,"rgba(255,80,20,0)");
  ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(x,fy,30*fl,0,Math.PI*2); ctx.fill();
  rg=ctx.createRadialGradient(x,fy,0.5,x,fy,11*fl);
  rg.addColorStop(0,"rgba(255,220,140,0.55)");
  rg.addColorStop(1,"rgba(255,140,40,0)");
  ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(x,fy,11*fl,0,Math.PI*2); ctx.fill();
  ctx.restore();
  const drop=(w,h,col)=>{ ctx.fillStyle=col; ctx.beginPath();
    ctx.moveTo(x,fy+h*0.45);
    ctx.quadraticCurveTo(x-w,fy+h*0.1,x+sway*0.5,fy-h*0.55);
    ctx.quadraticCurveTo(x+sway,fy-h*(0.9+0.25*fl),x+sway*0.9,fy-h*(0.9+0.25*fl));
    ctx.quadraticCurveTo(x+w,fy+h*0.1,x,fy+h*0.45); ctx.fill(); };
  drop(4.6,9,"rgba(255,120,30,0.92)");
  drop(3.2,6.6,"rgba(255,190,70,0.95)");
  drop(1.8,4,"rgba(255,244,200,0.98)");
  const sp=(t*1.3+x*0.13)%1;
  ctx.fillStyle=`rgba(255,200,110,${0.8*(1-sp)})`;
  ctx.beginPath(); ctx.arc(x+Math.sin(t*5+x)*3,fy-8-sp*16,1.1,0,Math.PI*2); ctx.fill();
}

export function drawCampfire(x, dark = 0) {
  const t=performance.now()/1000, fl=(FX&&FX.flicker)||1, wind=windGust()*0.3;
  if (dark > 0.05) {
    ctx.save(); ctx.globalCompositeOperation="lighter";
    const R=110*(0.9+0.1*fl);
    let rg=ctx.createRadialGradient(x,groundY-14,4,x,groundY-14,R);
    rg.addColorStop(0,`rgba(255,160,60,${0.30*dark})`);
    rg.addColorStop(0.45,`rgba(255,110,35,${0.13*dark})`);
    rg.addColorStop(1,"rgba(255,70,20,0)");
    ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(x,groundY-14,R,0,Math.PI*2); ctx.fill();
    rg=ctx.createRadialGradient(x,groundY+2,4,x,groundY+2,80);
    rg.addColorStop(0,`rgba(255,170,80,${0.28*dark*fl})`);
    rg.addColorStop(1,"rgba(255,110,40,0)");
    ctx.fillStyle=rg; ctx.beginPath(); ctx.ellipse(x,groundY+2,80,20,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle="#4e4e5a";
  for (let i=0;i<7;i++) {
    const a=(i/7)*Math.PI, sx=x+Math.cos(a)*17*(i%2?1:1.12);
    ctx.beginPath(); ctx.ellipse(sx,groundY-1.5+(i%2),3.6,2.5,0,0,Math.PI*2); ctx.fill();
  }
  ctx.fillStyle="rgba(255,150,60,0.25)";
  for (let i=0;i<7;i++) { const a=(i/7)*Math.PI; ctx.beginPath(); ctx.ellipse(x+Math.cos(a)*17,groundY-2.4+(i%2),1.8,1,0,0,Math.PI*2); ctx.fill(); }
  ctx.fillStyle=`rgba(255,110,30,${0.55*fl})`; ctx.beginPath(); ctx.ellipse(x,groundY-3,12,3.6,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=`rgba(255,210,120,${0.5*fl})`; ctx.beginPath(); ctx.ellipse(x,groundY-3,6,2,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="#3a2a1a"; ctx.lineWidth=5; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(x-12,groundY-2); ctx.lineTo(x+10,groundY-7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+12,groundY-2); ctx.lineTo(x-10,groundY-7); ctx.stroke();
  ctx.strokeStyle="#181210"; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(x+4,groundY-5.6); ctx.lineTo(x+10,groundY-7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x-4,groundY-5.6); ctx.lineTo(x-10,groundY-7); ctx.stroke();
  ctx.lineCap="butt";
  const flame=(h,w,col,wob)=>{ const sway=Math.sin(t*8+wob)*2+wind; ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(x-w,groundY-6); ctx.quadraticCurveTo(x-w*0.6+sway,groundY-h*0.6,x+sway*1.4,groundY-h*fl); ctx.quadraticCurveTo(x+w*0.6+sway,groundY-h*0.6,x+w,groundY-6); ctx.quadraticCurveTo(x,groundY-2,x-w,groundY-6); ctx.fill(); };
  flame(34,11,"rgba(226,88,30,0.92)",0); flame(26,8,"rgba(255,150,40,0.95)",1.7);
  flame(17,5,"rgba(255,210,90,0.97)",3.1); flame(9,2.6,"rgba(255,244,200,0.98)",4.6);
  ctx.save(); ctx.globalCompositeOperation="lighter";
  const fg=ctx.createRadialGradient(x,groundY-16,2,x,groundY-16,26*fl);
  fg.addColorStop(0,"rgba(255,190,90,0.35)"); fg.addColorStop(1,"rgba(255,120,40,0)");
  ctx.fillStyle=fg; ctx.beginPath(); ctx.arc(x,groundY-16,26*fl,0,Math.PI*2); ctx.fill();
  ctx.restore();
  for (let i=0;i<4;i++) {
    const ph=(t*0.55+i*0.25+x*0.01)%1;
    const ex=x+Math.sin(t*3+i*2.1)*(4+ph*10)+wind*ph*8, ey=groundY-10-ph*46;
    ctx.fillStyle=`rgba(255,${170+i*20},90,${0.85*(1-ph)})`;
    ctx.beginPath(); ctx.arc(ex,ey,1.3-ph*0.6,0,Math.PI*2); ctx.fill();
  }
  ctx.save(); ctx.globalAlpha=0.14+0.06*dark;
  ctx.fillStyle="#c8c4bc";
  for (let i=0;i<3;i++) {
    const ph=(t*0.35+i/3)%1;
    ctx.beginPath(); ctx.arc(x+Math.sin(t*1.4+i*2)*6+wind*ph*14,groundY-36-ph*34,4+ph*7,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

export function drawTent(x, col) {
  ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(x,groundY-44); ctx.lineTo(x-26,groundY); ctx.lineTo(x+26,groundY); ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.28)"; ctx.beginPath(); ctx.moveTo(x,groundY-44); ctx.lineTo(x+26,groundY); ctx.lineTo(x+8,groundY); ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,0.10)"; ctx.beginPath(); ctx.moveTo(x,groundY-44); ctx.lineTo(x-26,groundY); ctx.lineTo(x-12,groundY); ctx.closePath(); ctx.fill();
  ctx.strokeStyle="rgba(40,30,24,0.8)"; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(x,groundY-44); ctx.lineTo(x,groundY-54); ctx.stroke();
  const sway=windSway(x,3); ctx.fillStyle="#c1453b"; ctx.beginPath(); ctx.moveTo(x,groundY-54); ctx.lineTo(x+10+sway,groundY-51); ctx.lineTo(x,groundY-48); ctx.fill();
}

export function drawBuildMarker(x, color) {
  const t = performance.now() / 1000;
  const pulse = 0.55 + 0.45 * Math.sin(t * 2.2 + x * 0.3);

  groundShadow(x, 16, 0.22);
  const rg = ctx.createRadialGradient(x, groundY - 2, 2, x, groundY - 2, 22);
  rg.addColorStop(0, color);
  rg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalAlpha = 0.35 * pulse;
  ctx.fillStyle = rg;
  ctx.beginPath(); ctx.ellipse(x, groundY - 1, 24, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#5a5060";
  ctx.beginPath(); ctx.moveTo(x - 10, groundY); ctx.lineTo(x + 10, groundY); ctx.lineTo(x + 7, groundY - 8); ctx.lineTo(x - 7, groundY - 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#6a6270";
  ctx.beginPath(); ctx.moveTo(x - 7, groundY - 8); ctx.lineTo(x + 7, groundY - 8); ctx.lineTo(x + 4, groundY - 14); ctx.lineTo(x - 4, groundY - 14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#7a7482";
  ctx.beginPath(); ctx.moveTo(x - 4, groundY - 14); ctx.lineTo(x + 4, groundY - 14); ctx.lineTo(x + 1, groundY - 19); ctx.lineTo(x - 1, groundY - 19); ctx.closePath(); ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.7 * pulse;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, groundY - 20, 3.5, 0, Math.PI * 2); ctx.fill();
  const gg = ctx.createRadialGradient(x, groundY - 20, 1, x, groundY - 20, 9);
  gg.addColorStop(0, color); gg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gg;
  ctx.beginPath(); ctx.arc(x, groundY - 20, 9, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawStationIcon(x, emoji) {
  const bob=Math.sin(performance.now()/400+x)*3;
  ctx.save(); ctx.font="18px serif"; ctx.textAlign="center"; ctx.globalAlpha=0.92;
  ctx.fillText(emoji,x,groundY-30+bob);
  ctx.restore();
}
