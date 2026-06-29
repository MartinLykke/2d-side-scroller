import { lerpColor, rgb } from '../util/math.js';
import { ctx, W, groundY } from '../canvas.js';
import { Game, state } from '../state.js';
import { stoneCol, stoneLt, woodCol } from './DrawHelpers.js';
import { biomeAt, windSway, FX } from './Effects.js';

const LOC_DRAWERS = {
  camp(x, dark) {
    ctx.fillStyle=rgb(lerpColor([52,44,36],[16,14,18],dark)); ctx.beginPath(); ctx.ellipse(x,groundY-2,10,4,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=rgb(lerpColor([72,64,54],[20,18,22],dark)); ctx.beginPath(); ctx.ellipse(x,groundY-3,5.5,2,0,0,Math.PI*2); ctx.fill();
    const tc1=rgb(lerpColor([64,44,28],[18,12,8],dark));
    ctx.fillStyle=tc1; ctx.beginPath(); ctx.moveTo(x-36,groundY-34); ctx.lineTo(x-60,groundY); ctx.lineTo(x-14,groundY); ctx.closePath(); ctx.fill();
    ctx.fillStyle="rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.moveTo(x-36,groundY-34); ctx.lineTo(x-14,groundY); ctx.lineTo(x-26,groundY); ctx.closePath(); ctx.fill();
    ctx.fillStyle=rgb(lerpColor([48,34,20],[14,10,6],dark)); ctx.beginPath(); ctx.moveTo(x+44,groundY-28); ctx.lineTo(x+22,groundY); ctx.lineTo(x+64,groundY); ctx.closePath(); ctx.fill();
    ctx.fillStyle="rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.moveTo(x+44,groundY-28); ctx.lineTo(x+64,groundY); ctx.lineTo(x+52,groundY); ctx.closePath(); ctx.fill();
    ctx.fillStyle=woodCol(dark); ctx.fillRect(x+68,groundY-14,14,14); ctx.fillRect(x+82,groundY-10,10,10);
  },
  wagon(x, dark) {
    ctx.save(); ctx.translate(x,groundY-10); ctx.rotate(0.32);
    ctx.fillStyle=woodCol(dark); ctx.fillRect(-32,-12,64,22);
    ctx.strokeStyle=rgb(lerpColor([56,40,22],[14,10,6],dark)); ctx.lineWidth=2; ctx.strokeRect(-32,-12,64,22);
    ctx.strokeStyle=rgb(lerpColor([72,52,30],[20,14,8],dark)); ctx.lineWidth=1;
    for (let i=-3;i<=3;i++) { ctx.beginPath(); ctx.moveTo(i*9,-12); ctx.lineTo(i*9,10); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle=woodCol(dark); ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(x-38,groundY+4,14,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x+24,groundY-8,12,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle=woodCol(dark); ctx.fillRect(x+50,groundY-10,13,12);
  },
  grave(x, dark) {
    ctx.fillStyle=stoneCol(dark); ctx.fillRect(x-8,groundY-36,16,36);
    ctx.beginPath(); ctx.arc(x,groundY-36,8,Math.PI,0); ctx.fill();
    ctx.strokeStyle=stoneLt(dark); ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(x,groundY-32); ctx.lineTo(x,groundY-18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x-5,groundY-26); ctx.lineTo(x+5,groundY-26); ctx.stroke();
    const boneC=rgb(lerpColor([192,184,172],[56,52,48],dark)); ctx.fillStyle=boneC;
    ctx.beginPath(); ctx.ellipse(x-22,groundY-2,7,3,0.3,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x+18,groundY-1,5,2.5,-0.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=rgb(lerpColor([74,104,64],[20,30,18],dark)); ctx.beginPath(); ctx.ellipse(x,groundY-33,5,2,0,0,Math.PI*2); ctx.fill();
  },
  ruins(x, dark) {
    const c=stoneCol(dark), l=stoneLt(dark);
    const col=(cx,h,broken)=>{
      ctx.fillStyle=c; ctx.fillRect(cx-7,groundY-h,14,h); ctx.fillStyle=l; ctx.fillRect(cx-7,groundY-h,4,h);
      if (!broken) { ctx.fillStyle=c; ctx.fillRect(cx-10,groundY-h-6,20,6); }
      else { ctx.fillStyle=c; ctx.fillRect(cx-5,groundY-h-4,10,4); ctx.beginPath(); ctx.moveTo(cx-8,groundY-h); ctx.lineTo(cx+10,groundY-h-8); ctx.lineTo(cx+12,groundY-h+2); ctx.closePath(); ctx.fill(); }
    };
    col(x-58,66,true); col(x-24,82,false); col(x+22,70,true); col(x+56,58,false);
    ctx.fillStyle=c; for (const ox of [-42,-12,10,36]) { ctx.beginPath(); ctx.ellipse(x+ox,groundY-3,5+Math.abs(ox%7),3,0,0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle=rgb(lerpColor([74,104,64],[20,30,18],dark)); for (const ox of [-30,12,44]) { ctx.beginPath(); ctx.ellipse(x+ox,groundY-3,8,3,0,0,Math.PI*2); ctx.fill(); }
  },
  cave(x, dark) {
    ctx.fillStyle=rgb(lerpColor([42,38,48],[14,12,18],dark)); ctx.beginPath(); ctx.moveTo(x-88,groundY); ctx.quadraticCurveTo(x,groundY-96,x+88,groundY); ctx.closePath(); ctx.fill();
    ctx.fillStyle="#080410"; ctx.beginPath(); ctx.ellipse(x,groundY-26,26,34,0,Math.PI,0); ctx.fill();
    const ig=ctx.createRadialGradient(x,groundY-18,2,x,groundY-22,26); ig.addColorStop(0,"rgba(0,0,0,0.95)"); ig.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=ig; ctx.beginPath(); ctx.ellipse(x,groundY-26,26,34,0,Math.PI,0); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation="lighter"; const eg=0.45+dark*0.45;
    ctx.fillStyle=`rgba(255,60,60,${eg*0.65})`; ctx.beginPath(); ctx.arc(x-9,groundY-36,3,0,Math.PI*2); ctx.arc(x+7,groundY-36,3,0,Math.PI*2); ctx.fill(); ctx.restore();
    const bc=rgb(lerpColor([180,172,160],[52,48,44],dark)); ctx.fillStyle=bc;
    ctx.beginPath(); ctx.ellipse(x-40,groundY-2,8,3,0.2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x+34,groundY-1,6,2.5,-0.3,0,Math.PI*2); ctx.fill();
  },
  battlefield(x, dark) {
    const wd=woodCol(dark), mt=stoneCol(dark);
    const banner=(bx,lean)=>{ ctx.strokeStyle=wd; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(bx,groundY); ctx.lineTo(bx+lean,groundY-62); ctx.stroke(); ctx.fillStyle=rgb(lerpColor([90,30,30],[28,10,10],dark)); ctx.beginPath(); ctx.moveTo(bx+lean,groundY-62); ctx.lineTo(bx+lean+18,groundY-54); ctx.lineTo(bx+lean+12,groundY-44); ctx.lineTo(bx+lean,groundY-44); ctx.fill(); };
    banner(x-68,-8); banner(x+42,6);
    const sword=(sx,ang)=>{ ctx.save(); ctx.translate(sx,groundY); ctx.rotate(ang); ctx.strokeStyle=mt; ctx.lineWidth=2.5; ctx.lineCap="round"; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-30); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-5,-22); ctx.lineTo(5,-22); ctx.stroke(); ctx.restore(); };
    sword(x-36,-0.2); sword(x-8,0.15); sword(x+20,-0.1); sword(x+50,0.22);
    ctx.fillStyle=mt; ctx.beginPath(); ctx.ellipse(x-56,groundY-4,10,7,0.3,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=stoneLt(dark); ctx.lineWidth=1; ctx.beginPath(); ctx.ellipse(x-56,groundY-4,10,7,0.3,0,Math.PI*2); ctx.stroke();
  },
  watchtower(x, dark) {
    const c=stoneCol(dark), l=stoneLt(dark), tw=38;
    ctx.fillStyle=c; ctx.fillRect(x-tw/2,groundY-112,tw,112);
    ctx.fillStyle=l; ctx.fillRect(x-tw/2,groundY-112,tw*0.28,112);
    ctx.fillStyle="rgba(0,0,0,0.18)"; ctx.fillRect(x+tw*0.28,groundY-112,tw*0.22,112);
    ctx.fillStyle=c; ctx.beginPath(); ctx.moveTo(x-tw/2,groundY-112); ctx.lineTo(x+4,groundY-112); ctx.lineTo(x+10,groundY-88); ctx.lineTo(x-tw/2,groundY-88); ctx.closePath(); ctx.fill();
    for (const ox of [-28,-14,10,26]) { ctx.fillStyle=c; ctx.beginPath(); ctx.ellipse(x+ox+tw*0.5,groundY-4,6+Math.abs(ox%5),3.5,0,0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle=c; for (let i=0;i<2;i++) ctx.fillRect(x-tw/2+i*(tw*0.4),groundY-120,tw*0.18,9);
    ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillRect(x-4,groundY-74,8,12);
    ctx.strokeStyle=woodCol(dark); ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(x+tw/2,groundY); ctx.lineTo(x+tw/2+22,groundY-36); ctx.stroke();
    for (let i=0;i<4;i++) { const yy=groundY-i*9,xx=x+tw/2+i*6; ctx.beginPath(); ctx.moveTo(xx,yy); ctx.lineTo(xx+9,yy-4); ctx.stroke(); }
    if (dark>0.2) drawTorch(x-tw/2-6,groundY-58);
    ctx.fillStyle=woodCol(dark); ctx.fillRect(x-tw/2-18,groundY-14,16,13);
    ctx.strokeStyle=stoneLt(dark); ctx.lineWidth=1.5; ctx.strokeRect(x-tw/2-18,groundY-14,16,13);
    ctx.beginPath(); ctx.moveTo(x-tw/2-18,groundY-7); ctx.lineTo(x-tw/2-2,groundY-7); ctx.stroke();
  },
  altar(x, dark) {
    const c=stoneCol(dark);
    const stones=[[-62,0,8,28],[-46,-5,7,22],[20,-5,7,22],[36,0,8,28],[-8,-10,10,36],[14,0,8,20]];
    for (const [ox,dy,w,h] of stones) { ctx.fillStyle=c; ctx.fillRect(x+ox-w/2,groundY-h+dy,w,h-dy); }
    ctx.fillStyle=rgb(lerpColor([76,70,84],[20,18,24],dark)); ctx.fillRect(x-18,groundY-12,36,12);
    const ga=0.22+0.14*Math.sin(Game.windT*2.3);
    ctx.save(); ctx.globalCompositeOperation="lighter";
    const gr=ctx.createRadialGradient(x,groundY-8,4,x,groundY-8,56); gr.addColorStop(0,`rgba(100,140,255,${ga*2})`); gr.addColorStop(1,"rgba(60,80,255,0)");
    ctx.fillStyle=gr; ctx.beginPath(); ctx.ellipse(x,groundY-8,56,28,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=`rgba(100,140,255,${ga})`; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(x,groundY-2,40,0,Math.PI*2); ctx.stroke(); ctx.restore();
    ctx.fillStyle=rgb(lerpColor([60,94,74],[18,28,22],dark));
    for (const [ox] of stones) { ctx.beginPath(); ctx.ellipse(x+ox,groundY-1,4,2.5,0,0,Math.PI*2); ctx.fill(); }
  },
};

function drawTorch(x, y) {
  const fl=(FX&&FX.flicker)||1;
  ctx.strokeStyle="#3a2a1a"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y-12); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.fillStyle=`rgba(255,150,50,0.55)`; ctx.beginPath(); ctx.arc(x,y-15,14*fl,0,Math.PI*2); ctx.fill(); ctx.restore();
  ctx.fillStyle="rgba(255,170,60,0.97)"; ctx.beginPath(); ctx.ellipse(x,y-15,3,6*fl,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(255,234,160,0.98)"; ctx.beginPath(); ctx.ellipse(x,y-15,1.5,3.4*fl,0,0,Math.PI*2); ctx.fill();
}

export function drawLocations(dark) {
  if (!state.locations) return;
  const { player, locations } = state;
  const camL=Game.cam-400, camR=Game.cam+W+400;
  const t=performance.now()/1000;
  const LOC_SCALE=1.55;
  for (const loc of locations) {
    if (loc.x<camL||loc.x>camR) continue;
    const locAlpha = loc.fadeAlpha !== undefined ? loc.fadeAlpha : 1;
    if (locAlpha <= 0) continue;

    ctx.save();
    ctx.globalAlpha = locAlpha;

    if (!loc.cleared) {
      const pulse=0.55+0.18*Math.sin(t*2.2+loc.x*0.001);
      ctx.save(); ctx.globalCompositeOperation="lighter";
      const hasEnemies = loc.preActivated && loc.remainingEnemies > 0;
      const glowCol = hasEnemies ? `rgba(220,60,60,${0.09*pulse})` : `rgba(80,140,255,${0.07*pulse})`;
      const gr=ctx.createRadialGradient(loc.x,groundY-20,20,loc.x,groundY-20,110);
      gr.addColorStop(0,glowCol); gr.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=gr; ctx.beginPath(); ctx.ellipse(loc.x,groundY-20,110,60,0,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(loc.x, groundY);
    ctx.scale(LOC_SCALE, LOC_SCALE);
    ctx.translate(-loc.x, -groundY);
    LOC_DRAWERS[loc.type]?.(loc.x, dark);
    ctx.restore();

    if (loc.preActivated && !loc.cleared && loc.remainingEnemies > 0) {
      const skullY=groundY-170;
      ctx.save(); ctx.font="14px serif"; ctx.textAlign="center";
      const skullStr="💀".repeat(Math.min(loc.remainingEnemies,6))+(loc.remainingEnemies>6?"…":"");
      ctx.globalAlpha=0.85; ctx.fillText(skullStr,loc.x,skullY); ctx.restore();
    }
    if (loc.cleared) {
      ctx.save(); ctx.font="14px serif"; ctx.textAlign="center"; ctx.globalAlpha=0.7;
      ctx.fillText("✅",loc.x,groundY-160); ctx.restore();
    }

    ctx.restore();
  }
}
