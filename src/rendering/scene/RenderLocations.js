import { lerpColor, rgb } from '../../util/math.js';
import { ctx, W, groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { stoneCol, stoneLt, woodCol } from '../DrawHelpers.js';
import { biomeAt, windSway, FX } from '../Effects.js';
import { LOC_DEFS } from '../../config/locations.js';

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
  const wood = woodCol(dark);
  const woodDark = rgb(lerpColor([56,40,22],[14,10,6],dark));
  const woodLight = rgb(lerpColor([82,60,36],[24,18,10],dark));

  ctx.save();
  ctx.translate(x,groundY-10);
  ctx.rotate(0.32);

  // vogn
  ctx.fillStyle = wood;
  ctx.fillRect(-32,-12,64,22);

  // lys kant
  ctx.fillStyle = woodLight;
  ctx.fillRect(-32,-12,64,3);

  // ramme
  ctx.strokeStyle = woodDark;
  ctx.lineWidth = 2;
  ctx.strokeRect(-32,-12,64,22);

  // planks
  ctx.strokeStyle = woodLight;
  ctx.lineWidth = 1;
  for (let i=-3;i<=3;i++) {
    ctx.beginPath();
    ctx.moveTo(i*9,-12);
    ctx.lineTo(i*9,10);
    ctx.stroke();
  }

  // drawbar
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(32,-2);
  ctx.lineTo(50,-6);
  ctx.stroke();

  ctx.restore();

  // left wheel
  ctx.strokeStyle = wood;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x-38,groundY+4,14,0,Math.PI*2);
  ctx.stroke();

  ctx.lineWidth = 1;
  for(let i=0;i<6;i++){
    let a=i*Math.PI/3;
    ctx.beginPath();
    ctx.moveTo(x-38,groundY+4);
    ctx.lineTo(
      x-38+Math.cos(a)*12,
      groundY+4+Math.sin(a)*12
    );
    ctx.stroke();
  }
  ctx.fillStyle=wood;
  ctx.beginPath();
  ctx.arc(x-38,groundY+4,2,0,Math.PI*2);
  ctx.fill();

  // right wheel
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x+24,groundY-8,12,0,Math.PI*2);
  ctx.stroke();

  ctx.lineWidth = 1;
  for(let i=0;i<6;i++){
    let a=i*Math.PI/3;
    ctx.beginPath();
    ctx.moveTo(x+24,groundY-8);
    ctx.lineTo(
      x+24+Math.cos(a)*10,
      groundY-8+Math.sin(a)*10
    );
    ctx.stroke();
  }
  ctx.fillStyle=wood;
  ctx.beginPath();
  ctx.arc(x+24,groundY-8,2,0,Math.PI*2);
  ctx.fill();

  // kasse
  ctx.fillStyle=wood;
  ctx.fillRect(x+50,groundY-10,13,12);
  ctx.strokeStyle=woodDark;
  ctx.lineWidth=1;
  ctx.strokeRect(x+50,groundY-10,13,12);

  // sack
  ctx.fillStyle=rgb(lerpColor([130,112,82],[38,34,24],dark));
  ctx.beginPath();
  ctx.ellipse(x-56,groundY-4,7,9,0,0,Math.PI*2);
  ctx.fill();

  // small barrel
  ctx.fillStyle=wood;
  ctx.fillRect(x+66,groundY-12,10,12);
  ctx.strokeStyle=woodDark;
  ctx.strokeRect(x+66,groundY-12,10,12);
},
grave(x, dark) {
  const stone = stoneCol(dark);
  const stoneLight = stoneLt(dark);
  const stoneDark = rgb(lerpColor([80,74,70],[22,20,20],dark));

  // skygge
  ctx.fillStyle="rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x+2,groundY-1,18,4,0,0,Math.PI*2);
  ctx.fill();

  // mound of earth
  ctx.fillStyle=rgb(lerpColor([88,68,46],[26,20,16],dark));
  ctx.beginPath();
  ctx.ellipse(x,groundY-1,20,5,0,0,Math.PI*2);
  ctx.fill();

  // gravsten
  ctx.fillStyle=stone;
  ctx.fillRect(x-8,groundY-36,16,36);
  ctx.beginPath();
  ctx.arc(x,groundY-36,8,Math.PI,0);
  ctx.fill();

  // lys kant
  ctx.strokeStyle=stoneLight;
  ctx.lineWidth=2;
  ctx.strokeRect(x-7.5,groundY-36,15,35);

  // kors
  ctx.beginPath();
  ctx.moveTo(x,groundY-32);
  ctx.lineTo(x,groundY-18);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x-5,groundY-26);
  ctx.lineTo(x+5,groundY-26);
  ctx.stroke();

  // revner
  ctx.strokeStyle=stoneDark;
  ctx.lineWidth=1;

  ctx.beginPath();
  ctx.moveTo(x-2,groundY-31);
  ctx.lineTo(x+1,groundY-25);
  ctx.lineTo(x-3,groundY-20);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x+4,groundY-15);
  ctx.lineTo(x+1,groundY-10);
  ctx.stroke();

  // knogler
  const boneC=rgb(lerpColor([192,184,172],[56,52,48],dark));
  ctx.fillStyle=boneC;

  ctx.beginPath();
  ctx.ellipse(x-22,groundY-2,7,3,0.3,0,Math.PI*2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(x+18,groundY-1,5,2.5,-0.2,0,Math.PI*2);
  ctx.fill();

  // lille sten
  ctx.fillStyle=stoneDark;
  ctx.beginPath();
  ctx.ellipse(x+26,groundY-2,3,2,0,0,Math.PI*2);
  ctx.fill();

  // mos
  ctx.fillStyle=rgb(lerpColor([74,104,64],[20,30,18],dark));
  ctx.beginPath();
  ctx.ellipse(x,groundY-33,5,2,0,0,Math.PI*2);
  ctx.fill();

  // weeds left
  ctx.beginPath();
  ctx.moveTo(x-15,groundY);
  ctx.lineTo(x-13,groundY-6);
  ctx.lineTo(x-11,groundY);
  ctx.fill();

  // weeds right
  ctx.beginPath();
  ctx.moveTo(x+12,groundY);
  ctx.lineTo(x+15,groundY-7);
  ctx.lineTo(x+18,groundY);
  ctx.fill();
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
  const wd = woodCol(dark);
  const mt = stoneCol(dark);
  const bone = rgb(lerpColor([192,184,172],[56,52,48],dark));
  const dirt = rgb(lerpColor([88,68,46],[24,18,14],dark));

  // jord/slid
  ctx.fillStyle=dirt;
  ctx.beginPath();
  ctx.ellipse(x,groundY-1,70,6,0,0,Math.PI*2);
  ctx.fill();

  // bannere
  const banner=(bx,lean)=>{
    ctx.strokeStyle=wd;
    ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(bx,groundY);
    ctx.lineTo(bx+lean,groundY-62);
    ctx.stroke();

    ctx.fillStyle=rgb(lerpColor([90,30,30],[28,10,10],dark));
    ctx.beginPath();
    ctx.moveTo(bx+lean,groundY-62);
    ctx.lineTo(bx+lean+18,groundY-54);
    ctx.lineTo(bx+lean+12,groundY-44);
    ctx.lineTo(bx+lean,groundY-44);
    ctx.fill();
  };

  banner(x-68,-8);
  banner(x+42,6);

  // sword
  const sword=(sx,ang)=>{
    ctx.save();
    ctx.translate(sx,groundY);
    ctx.rotate(ang);

    ctx.strokeStyle=mt;
    ctx.lineWidth=2.5;
    ctx.lineCap="round";

    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(0,-30);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-5,-22);
    ctx.lineTo(5,-22);
    ctx.stroke();

    ctx.restore();
  };

  sword(x-36,-0.2);
  sword(x-8,0.15);
  sword(x+20,-0.1);
  sword(x+50,0.22);

  // skjold
  ctx.fillStyle=mt;
  ctx.beginPath();
  ctx.ellipse(x-56,groundY-4,10,7,0.3,0,Math.PI*2);
  ctx.fill();

  ctx.strokeStyle=stoneLt(dark);
  ctx.lineWidth=1;
  ctx.stroke();

  // skjoldets boss
  ctx.fillStyle=stoneLt(dark);
  ctx.beginPath();
  ctx.arc(x-56,groundY-4,2,0,Math.PI*2);
  ctx.fill();

  // broken spear
  ctx.strokeStyle=wd;
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(x+58,groundY-18);
  ctx.lineTo(x+74,groundY);
  ctx.stroke();

  // pil
  ctx.strokeStyle=wd;
  ctx.lineWidth=1.5;
  ctx.beginPath();
  ctx.moveTo(x-12,groundY-10);
  ctx.lineTo(x+4,groundY-3);
  ctx.stroke();

  // knogler
  ctx.fillStyle=bone;
  ctx.beginPath();
  ctx.ellipse(x-26,groundY-2,5,2.5,0.3,0,Math.PI*2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(x+30,groundY-1,6,3,-0.2,0,Math.PI*2);
  ctx.fill();

  // sten
  ctx.fillStyle=mt;
  ctx.beginPath();
  ctx.ellipse(x-2,groundY-1,4,3,0,0,Math.PI*2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(x+18,groundY-2,3,2,0,0,Math.PI*2);
  ctx.fill();

  // grass
  ctx.fillStyle=rgb(lerpColor([74,104,64],[20,30,18],dark));

  ctx.beginPath();
  ctx.moveTo(x-45,groundY);
  ctx.lineTo(x-42,groundY-6);
  ctx.lineTo(x-39,groundY);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x+38,groundY);
  ctx.lineTo(x+41,groundY-5);
  ctx.lineTo(x+44,groundY);
  ctx.fill();
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
abandonedfort(x, dark) {
  const wood = woodCol(dark);
  const woodDark = rgb(lerpColor([56,40,22],[14,10,6],dark));
  const stone = stoneCol(dark);
  const stoneLight = stoneLt(dark);
  const moss = rgb(lerpColor([74,104,64],[20,30,18],dark));
  const cloth = rgb(lerpColor([130,110,80],[40,30,20],dark));
  const bone = rgb(lerpColor([192,184,172],[56,52,48],dark));

  // ground shadow
  ctx.fillStyle="rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x,groundY-2,80,7,0,0,Math.PI*2);
  ctx.fill();

  // stone base walls
  ctx.fillStyle=stone;
  ctx.fillRect(x-40,groundY-30,80,22);

  // broken wall section
  ctx.fillStyle=stoneLight;
  ctx.fillRect(x-18,groundY-48,36,18);

  // collapsed corner
  ctx.fillStyle=stone;
  ctx.beginPath();
  ctx.moveTo(x+28,groundY-30);
  ctx.lineTo(x+50,groundY-10);
  ctx.lineTo(x+22,groundY-10);
  ctx.closePath();
  ctx.fill();

  // wooden gate frame
  ctx.strokeStyle=woodDark;
  ctx.lineWidth=4;
  ctx.beginPath();
  ctx.moveTo(x-12,groundY);
  ctx.lineTo(x-12,groundY-42);
  ctx.lineTo(x+12,groundY-42);
  ctx.lineTo(x+12,groundY);
  ctx.stroke();

  // broken gate door
  ctx.strokeStyle=wood;
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(x-10,groundY-10);
  ctx.lineTo(x+8,groundY-28);
  ctx.stroke();

  // tower stump (left)
  ctx.fillStyle=stone;
  ctx.fillRect(x-55,groundY-55,18,40);

  // damaged top
  ctx.fillStyle=woodDark;
  ctx.beginPath();
  ctx.moveTo(x-55,groundY-55);
  ctx.lineTo(x-37,groundY-70);
  ctx.lineTo(x-37,groundY-55);
  ctx.closePath();
  ctx.fill();

  // flag pole (broken)
  ctx.strokeStyle=woodDark;
  ctx.lineWidth=3;
  ctx.beginPath();
  ctx.moveTo(x+55,groundY);
  ctx.lineTo(x+60,groundY-50);
  ctx.stroke();

  // torn banner
  ctx.fillStyle=rgb(lerpColor([90,30,30],[28,10,10],dark));
  ctx.beginPath();
  ctx.moveTo(x+60,groundY-50);
  ctx.lineTo(x+78,groundY-45);
  ctx.lineTo(x+74,groundY-35);
  ctx.lineTo(x+58,groundY-38);
  ctx.closePath();
  ctx.fill();

  // inside loot sack
  ctx.fillStyle=cloth;
  ctx.beginPath();
  ctx.ellipse(x-10,groundY-8,7,9,0,0,Math.PI*2);
  ctx.fill();

  // bones
  ctx.fillStyle=bone;
  ctx.beginPath();
  ctx.ellipse(x+18,groundY-3,6,3,0.3,0,Math.PI*2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(x-28,groundY-2,5,2.5,-0.2,0,Math.PI*2);
  ctx.fill();

  // moss growth
  ctx.fillStyle=moss;
  ctx.beginPath();
  ctx.ellipse(x,groundY-40,18,6,0,0,Math.PI*2);
  ctx.fill();

  // debris stones
  ctx.fillStyle=stone;
  ctx.beginPath();
  ctx.ellipse(x-48,groundY-2,3,2,0,0,Math.PI*2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(x+48,groundY-1,2.5,1.8,0,0,Math.PI*2);
  ctx.fill();
},
  shack(x, dark) {
  const wood = woodCol(dark);
  const woodDark = rgb(lerpColor([56,40,22],[14,10,6],dark));
  const woodLight = rgb(lerpColor([90,64,40],[28,20,12],dark));
  const glow = rgb(lerpColor([220,180,120],[60,40,20],dark));

  // ground clutter
  ctx.fillStyle="rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(x,groundY,50,6,0,0,Math.PI*2);
  ctx.fill();

  // main hut body (slightly tilted feel)
  ctx.fillStyle = wood;
  ctx.fillRect(x-28, groundY-40, 56, 34);

  // broken roof
  ctx.fillStyle = woodDark;
  ctx.beginPath();
  ctx.moveTo(x-34, groundY-40);
  ctx.lineTo(x+10, groundY-62);
  ctx.lineTo(x+38, groundY-38);
  ctx.lineTo(x+6, groundY-36);
  ctx.closePath();
  ctx.fill();

  // roof crack / missing plank
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x-6, groundY-58, 10, 10);

  // door opening (dark interior)
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(x-10, groundY-22, 16, 16);

  // broken door plank
  ctx.fillStyle = woodLight;
  ctx.save();
  ctx.translate(x-18, groundY-18);
  ctx.rotate(-0.4);
  ctx.fillRect(0,0,14,3);
  ctx.restore();

  // window glow (loot hint / life inside)
  ctx.fillStyle = glow;
  ctx.fillRect(x+10, groundY-30, 10, 8);

  // window frame
  ctx.strokeStyle = woodDark;
  ctx.lineWidth = 1;
  ctx.strokeRect(x+10, groundY-30, 10, 8);

  // fallen crate
  ctx.fillStyle = wood;
  ctx.fillRect(x+30, groundY-10, 12, 10);

  // spilled loot hint (cloth / sack)
  ctx.fillStyle = rgb(lerpColor([130,110,80],[40,30,20],dark));
  ctx.beginPath();
  ctx.ellipse(x-36, groundY-4, 6, 8, 0.3, 0, Math.PI*2);
  ctx.fill();

  // small debris (stones)
  ctx.fillStyle = woodDark;
  ctx.beginPath();
  ctx.ellipse(x+46, groundY-2, 3, 2, 0, 0, Math.PI*2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(x-44, groundY-1, 2, 1.5, 0, 0, Math.PI*2);
  ctx.fill();
}, ruinedwatchtower(x, dark) {
  const wood = woodCol(dark);
  const woodDark = rgb(lerpColor([56,40,22],[14,10,6],dark));
  const rope = rgb(lerpColor([120,90,60],[40,30,20],dark));
  const bone = rgb(lerpColor([192,184,172],[56,52,48],dark));

  // base shadow
  ctx.fillStyle="rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x,groundY-2,55,6,0,0,Math.PI*2);
  ctx.fill();

  // broken platform
  ctx.fillStyle=wood;
  ctx.fillRect(x-22,groundY-45,44,10);

  // main tower frame
  ctx.strokeStyle=woodDark;
  ctx.lineWidth=3;
  ctx.beginPath();
  ctx.moveTo(x-18,groundY);
  ctx.lineTo(x-10,groundY-55);
  ctx.lineTo(x+10,groundY-55);
  ctx.lineTo(x+18,groundY);
  ctx.stroke();

  // broken side beam
  ctx.beginPath();
  ctx.moveTo(x+10,groundY-30);
  ctx.lineTo(x+30,groundY-15);
  ctx.stroke();

  // ladder
  ctx.strokeStyle=wood;
  ctx.lineWidth=2;
  for(let i=0;i<5;i++){
    ctx.beginPath();
    ctx.moveTo(x-12,groundY-10-i*8);
    ctx.lineTo(x-2,groundY-10-i*8);
    ctx.stroke();
  }

  // hanging rope (loot hint)
  ctx.strokeStyle=rope;
  ctx.beginPath();
  ctx.moveTo(x+20,groundY-45);
  ctx.lineTo(x+26,groundY-10);
  ctx.stroke();

  // small bag
  ctx.fillStyle=rgb(lerpColor([140,120,90],[40,30,20],dark));
  ctx.beginPath();
  ctx.ellipse(x+28,groundY-8,6,8,0,0,Math.PI*2);
  ctx.fill();

  // bones / remains
  ctx.fillStyle=bone;
  ctx.beginPath();
  ctx.ellipse(x-28,groundY-2,6,3,0.2,0,Math.PI*2);
  ctx.fill();

  // small stone
  ctx.fillStyle=woodDark;
  ctx.beginPath();
  ctx.ellipse(x-38,groundY-1,3,2,0,0,Math.PI*2);
  ctx.fill();
}, shrine(x, dark) {
  const stone = stoneCol(dark);
  const stoneLight = stoneLt(dark);
  const wood = woodCol(dark);
  const moss = rgb(lerpColor([74,104,64],[20,30,18],dark));
  const glow = rgb(lerpColor([210,190,120],[60,50,30],dark));

  // ground shadow
  ctx.fillStyle="rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x,groundY-2,45,6,0,0,Math.PI*2);
  ctx.fill();

  // base stones
  ctx.fillStyle=stone;
  ctx.fillRect(x-18,groundY-20,36,10);

  ctx.fillStyle=stoneLight;
  ctx.fillRect(x-14,groundY-30,28,10);

  // central altar
  ctx.fillStyle=stone;
  ctx.fillRect(x-10,groundY-40,20,12);

  // cracked top stone
  ctx.strokeStyle="rgba(0,0,0,0.25)";
  ctx.lineWidth=1;
  ctx.beginPath();
  ctx.moveTo(x,groundY-40);
  ctx.lineTo(x-4,groundY-34);
  ctx.lineTo(x+2,groundY-30);
  ctx.stroke();

  // pillars (simple ruins)
  ctx.fillStyle=stone;
  ctx.fillRect(x-26,groundY-38,6,28);
  ctx.fillRect(x+20,groundY-38,6,28);

  // moss overlay
  ctx.fillStyle=moss;
  ctx.beginPath();
  ctx.ellipse(x,groundY-28,18,6,0,0,Math.PI*2);
  ctx.fill();

  // glow (loot hint / magic feel)
  ctx.fillStyle=glow;
  ctx.beginPath();
  ctx.ellipse(x,groundY-32,6,3,0,0,Math.PI*2);
  ctx.fill();

  // small offerings (loot hint)
  ctx.fillStyle=wood;
  ctx.fillRect(x-30,groundY-8,10,6);

  ctx.fillStyle=stoneLight;
  ctx.beginPath();
  ctx.ellipse(x+32,groundY-6,3,2,0,0,Math.PI*2);
  ctx.fill();

  // grass
  ctx.fillStyle=moss;
  ctx.beginPath();
  ctx.moveTo(x-22,groundY);
  ctx.lineTo(x-20,groundY-6);
  ctx.lineTo(x-18,groundY);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x+24,groundY);
  ctx.lineTo(x+26,groundY-5);
  ctx.lineTo(x+28,groundY);
  ctx.fill();
},
huntingstand(x, dark) {
  const wood = woodCol(dark);
  const woodDark = rgb(lerpColor([56,40,22],[14,10,6],dark));
  const rope = rgb(lerpColor([120,90,60],[40,30,20],dark));
  const cloth = rgb(lerpColor([130,110,80],[40,30,20],dark));
  const bone = rgb(lerpColor([192,184,172],[56,52,48],dark));

  // ground shadow
  ctx.fillStyle="rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x,groundY-2,50,6,0,0,Math.PI*2);
  ctx.fill();

  // main platform
  ctx.fillStyle=wood;
  ctx.fillRect(x-18,groundY-35,36,10);

  // legs
  ctx.strokeStyle=woodDark;
  ctx.lineWidth=3;
  ctx.beginPath();
  ctx.moveTo(x-16,groundY-25);
  ctx.lineTo(x-22,groundY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x+16,groundY-25);
  ctx.lineTo(x+22,groundY);
  ctx.stroke();

  // ladder
  ctx.lineWidth=2;
  for(let i=0;i<4;i++){
    ctx.beginPath();
    ctx.moveTo(x-10,groundY-10-i*6);
    ctx.lineTo(x+10,groundY-10-i*6);
    ctx.stroke();
  }

  // small roof plank (lean-to feel)
  ctx.fillStyle=woodDark;
  ctx.beginPath();
  ctx.moveTo(x-22,groundY-35);
  ctx.lineTo(x+22,groundY-35);
  ctx.lineTo(x+12,groundY-48);
  ctx.lineTo(x-32,groundY-48);
  ctx.closePath();
  ctx.fill();

  // rope hanging
  ctx.strokeStyle=rope;
  ctx.beginPath();
  ctx.moveTo(x+10,groundY-35);
  ctx.lineTo(x+14,groundY-10);
  ctx.stroke();

  // sack (loot hint)
  ctx.fillStyle=cloth;
  ctx.beginPath();
  ctx.ellipse(x+14,groundY-8,6,8,0,0,Math.PI*2);
  ctx.fill();

  // arrows stuck in wood
  ctx.strokeStyle=woodDark;
  ctx.lineWidth=1.5;
  ctx.beginPath();
  ctx.moveTo(x-8,groundY-20);
  ctx.lineTo(x-2,groundY-28);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x+2,groundY-18);
  ctx.lineTo(x+8,groundY-26);
  ctx.stroke();

  // bone (small wildlife hint)
  ctx.fillStyle=bone;
  ctx.beginPath();
  ctx.ellipse(x-30,groundY-2,5,2.5,0.2,0,Math.PI*2);
  ctx.fill();

  // grass tufts
  ctx.fillStyle=rgb(lerpColor([74,104,64],[20,30,18],dark));
  ctx.beginPath();
  ctx.moveTo(x-20,groundY);
  ctx.lineTo(x-18,groundY-6);
  ctx.lineTo(x-16,groundY);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x+22,groundY);
  ctx.lineTo(x+24,groundY-5);
  ctx.lineTo(x+26,groundY);
  ctx.fill();
},
mill(x, dark) {
  const wood = woodCol(dark);
  const woodDark = rgb(lerpColor([56,40,22],[14,10,6],dark));
  const stone = stoneCol(dark);
  const stoneLight = stoneLt(dark);
  const moss = rgb(lerpColor([74,104,64],[20,30,18],dark));
  const cloth = rgb(lerpColor([130,110,80],[40,30,20],dark));

  // ground shadow
  ctx.fillStyle="rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x,groundY-2,60,6,0,0,Math.PI*2);
  ctx.fill();

  // stone base
  ctx.fillStyle=stone;
  ctx.fillRect(x-28,groundY-30,56,18);

  // wooden mill house
  ctx.fillStyle=wood;
  ctx.fillRect(x-24,groundY-60,48,30);

  // broken roof
  ctx.fillStyle=woodDark;
  ctx.beginPath();
  ctx.moveTo(x-30,groundY-60);
  ctx.lineTo(x+10,groundY-80);
  ctx.lineTo(x+34,groundY-58);
  ctx.lineTo(x+6,groundY-54);
  ctx.closePath();
  ctx.fill();

  // window opening
  ctx.fillStyle="rgba(0,0,0,0.45)";
  ctx.fillRect(x+6,groundY-50,10,10);

  // broken mill wheel
  ctx.strokeStyle=wood;
  ctx.lineWidth=3;
  ctx.beginPath();
  ctx.arc(x+40,groundY-25,14,0,Math.PI*2);
  ctx.stroke();

  ctx.lineWidth=1.5;
  for(let i=0;i<5;i++){
    let a=i*Math.PI/2.5;
    ctx.beginPath();
    ctx.moveTo(x+40,groundY-25);
    ctx.lineTo(x+40+Math.cos(a)*12,x+Math.sin(a)*12+groundY-25);
    ctx.stroke();
  }

  // fallen beam
  ctx.strokeStyle=woodDark;
  ctx.lineWidth=3;
  ctx.beginPath();
  ctx.moveTo(x-20,groundY-10);
  ctx.lineTo(x+10,groundY-5);
  ctx.stroke();

  // sack loot hint
  ctx.fillStyle=cloth;
  ctx.beginPath();
  ctx.ellipse(x-18,groundY-6,7,9,0,0,Math.PI*2);
  ctx.fill();

  // flour/seed spill (tiny particles feel)
  ctx.fillStyle=stoneLight;
  ctx.beginPath();
  ctx.ellipse(x-8,groundY-3,3,2,0,0,Math.PI*2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(x-2,groundY-2,2,1.5,0,0,Math.PI*2);
  ctx.fill();

  // moss
  ctx.fillStyle=moss;
  ctx.beginPath();
  ctx.ellipse(x,groundY-40,10,4,0,0,Math.PI*2);
  ctx.fill();

  // small debris stones
  ctx.fillStyle=stone;
  ctx.beginPath();
  ctx.ellipse(x+28,groundY-2,3,2,0,0,Math.PI*2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(x-34,groundY-1,2.5,1.8,0,0,Math.PI*2);
  ctx.fill();
}, fallenTree(x, dark) {
  const wood = woodCol(dark);
  const woodDark = rgb(lerpColor([56,40,22],[14,10,6],dark));
  const bark = rgb(lerpColor([92,64,40],[26,18,10],dark));
  const moss = rgb(lerpColor([74,104,64],[20,30,18],dark));
  const cloth = rgb(lerpColor([130,110,80],[40,30,20],dark));
  const bone = rgb(lerpColor([192,184,172],[56,52,48],dark));

  // ground shadow
  ctx.fillStyle="rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x,groundY-2,70,6,0,0,Math.PI*2);
  ctx.fill();

  // fallen trunk
  ctx.fillStyle=bark;
  ctx.save();
  ctx.translate(x,groundY-10);
  ctx.rotate(-0.35);
  ctx.fillRect(-50,-10,100,18);
  ctx.restore();

  // broken root end
  ctx.fillStyle=woodDark;
  ctx.beginPath();
  ctx.ellipse(x-52,groundY-8,10,7,0,0,Math.PI*2);
  ctx.fill();

  // hollow opening (loot hint)
  ctx.fillStyle="rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.ellipse(x+18,groundY-12,10,6,0.2,0,Math.PI*2);
  ctx.fill();

  // moss on top
  ctx.fillStyle=moss;
  ctx.beginPath();
  ctx.ellipse(x,groundY-18,22,5,0,0,Math.PI*2);
  ctx.fill();

  // small broken branch
  ctx.strokeStyle=woodDark;
  ctx.lineWidth=3;
  ctx.beginPath();
  ctx.moveTo(x+30,groundY-18);
  ctx.lineTo(x+48,groundY-6);
  ctx.stroke();

  // sack inside hollow
  ctx.fillStyle=cloth;
  ctx.beginPath();
  ctx.ellipse(x+20,groundY-10,6,8,0,0,Math.PI*2);
  ctx.fill();

  // bones slightly sticking out
  ctx.fillStyle=bone;
  ctx.beginPath();
  ctx.ellipse(x-18,groundY-3,5,2.5,0.3,0,Math.PI*2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(x-6,groundY-2,4,2,-0.2,0,Math.PI*2);
  ctx.fill();

  // small stones
  ctx.fillStyle=woodDark;
  ctx.beginPath();
  ctx.ellipse(x+40,groundY-2,3,2,0,0,Math.PI*2);
  ctx.fill();

  // grass tufts
  ctx.fillStyle=moss;
  ctx.beginPath();
  ctx.moveTo(x-30,groundY);
  ctx.lineTo(x-28,groundY-6);
  ctx.lineTo(x-26,groundY);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x+34,groundY);
  ctx.lineTo(x+36,groundY-5);
  ctx.lineTo(x+38,groundY);
  ctx.fill();
}
};

function drawTorch(x, y) {
  // per-torch flicker phase so neighbouring torches don't pulse in unison
  const t=performance.now()/1000;
  const fl=0.74 + 0.24*Math.sin(t*9 + x*0.73) + 0.12*Math.sin(t*23.3 + x*1.91);
  ctx.strokeStyle="#3a2a1a"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y-12); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.fillStyle=`rgba(255,150,50,0.55)`; ctx.beginPath(); ctx.arc(x,y-15,14*fl,0,Math.PI*2); ctx.fill(); ctx.restore();
  ctx.fillStyle="rgba(255,170,60,0.97)"; ctx.beginPath(); ctx.ellipse(x,y-15,3,6*fl,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(255,234,160,0.98)"; ctx.beginPath(); ctx.ellipse(x,y-15,1.5,3.4*fl,0,0,Math.PI*2); ctx.fill();
}

function drawVagrantCamp(x, count, dark) {
  const fl = (FX && FX.flicker) || 1;
  const t = performance.now() / 1000;

  // campfire: stones in a ring
  const stoneC = rgb(lerpColor([90,84,78],[28,26,24],dark));
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const sx = x + Math.cos(a) * 8, sy = groundY - 2 + Math.sin(a) * 3;
    ctx.fillStyle = stoneC;
    ctx.beginPath(); ctx.ellipse(sx, sy, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
  }

  // embers / ash
  ctx.fillStyle = rgb(lerpColor([60,40,30],[20,14,10],dark));
  ctx.beginPath(); ctx.ellipse(x, groundY - 1, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();

  // fire glow
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const ga = 0.25 + 0.12 * Math.sin(t * 3.1);
  const gr = ctx.createRadialGradient(x, groundY - 10, 2, x, groundY - 8, 40);
  gr.addColorStop(0, `rgba(255,140,40,${ga})`); gr.addColorStop(1, "rgba(255,80,20,0)");
  ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, groundY - 8, 40, 22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // flames
  ctx.fillStyle = `rgba(255,160,50,${0.8 * fl})`;
  ctx.beginPath(); ctx.ellipse(x, groundY - 8, 3, 7 * fl, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(255,220,120,${0.9 * fl})`;
  ctx.beginPath(); ctx.ellipse(x, groundY - 8, 1.5, 4 * fl, 0, 0, Math.PI * 2); ctx.fill();

  // logs in fire
  const logC = woodCol(dark);
  ctx.strokeStyle = logC; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x - 8, groundY - 2); ctx.lineTo(x + 3, groundY - 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 7, groundY - 1); ctx.lineTo(x - 2, groundY - 6); ctx.stroke();

  // sitting vagrant figures around the fire
  const SKIN = "#d3ac82";
  const PALETTES = [
    { tunic: "#6e6250", pants: "#4a4234", hair: "#4a3826" },
    { tunic: "#5d6652", pants: "#443c30", hair: "#2e2418" },
    { tunic: "#71584a", pants: "#4c4438", hair: "#6a5a42" },
  ];
  const spots = count === 1 ? [[-28, 1]] : count === 2 ? [[-28, 1],[28, -1]] : [[-28, 1],[28, -1],[0, 1]];
  for (let i = 0; i < Math.min(count, spots.length); i++) {
    const [ox, dir] = spots[i];
    const P = PALETTES[i % PALETTES.length];
    const sx = x + ox;
    const breathe = Math.sin(t * 1.4 + i * 2.1) * 0.4;

    ctx.save();
    ctx.translate(sx, 0);
    if (dir < 0) ctx.scale(-1, 1);

    const sitY = groundY - 8;
    // legs folded
    ctx.strokeStyle = P.pants; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-3, sitY); ctx.lineTo(-6, sitY + 5); ctx.lineTo(-2, sitY + 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, sitY); ctx.lineTo(6, sitY + 5); ctx.lineTo(2, sitY + 7); ctx.stroke();

    // torso
    ctx.fillStyle = P.tunic;
    ctx.fillRect(-4, sitY - 10 + breathe, 8, 10);

    // arms resting on knees
    ctx.strokeStyle = SKIN; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-3, sitY - 5 + breathe); ctx.lineTo(-5, sitY + 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, sitY - 5 + breathe); ctx.lineTo(5, sitY + 2); ctx.stroke();

    // head
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.arc(0, sitY - 14 + breathe, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.hair;
    ctx.beginPath(); ctx.arc(-0.4, sitY - 15.5 + breathe, 3.8, Math.PI * 0.95, Math.PI * 2.02); ctx.fill();

    ctx.lineCap = "butt";
    ctx.restore();
  }
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

    const def = LOC_DEFS[loc.type];
    const survivorCount = loc.remainingVagrants ?? def?.vagrants ?? 0;
    if (survivorCount > 0) {
      drawVagrantCamp(loc.x, survivorCount, dark);
    }

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
