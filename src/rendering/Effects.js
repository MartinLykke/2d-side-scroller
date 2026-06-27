import { clamp, lerp, lerpColor, rgb, withA, shade, hazeColor, atmo, rand, mulberry32 } from '../util/math.js';
import { CFG } from '../config/config.js';
import { ctx, W, H, groundY } from '../canvas.js';
import { Game, state } from '../state.js';

// ---------- Biomes ----------
export const BIOME_DEFS = [
  { c:300,  name:"snow",   treeL:[206,219,235], treeD:[120,142,178], gT:[214,224,238], gB:[168,184,208], fog:[214,226,240], sky:[150,176,206], leaf:"#e7f0fb", deco:"snow",   snow:1, moss:0 },
  { c:2050, name:"autumn", treeL:[200,124,52],  treeD:[112,58,32],   gT:[126,98,56],   gB:[80,60,38],    fog:[206,176,142], sky:[206,164,122], leaf:"#d9883c", deco:"autumn", snow:0, moss:0 },
  { c:3800, name:"pine",   treeL:[86,128,78],   treeD:[32,58,42],    gT:[78,108,60],   gB:[42,66,42],    fog:[156,184,172], sky:[120,186,214], leaf:"#9bd05a", deco:"meadow", snow:0, moss:0 },
  { c:5600, name:"dark",   treeL:[46,82,74],    treeD:[16,32,34],    gT:[40,60,50],    gB:[20,32,30],    fog:[78,108,108],  sky:[92,124,134],  leaf:"#3a7a5a", deco:"dark",   snow:0, moss:1 },
  { c:7300, name:"swamp",  treeL:[92,100,58],   treeD:[40,46,30],    gT:[66,72,44],    gB:[36,42,28],    fog:[118,128,96],  sky:[122,132,108], leaf:"#8a9a4a", deco:"swamp",  snow:0, moss:1 },
];

export function biomeAt(x) {
  const d = BIOME_DEFS;
  if (x <= d[0].c) return d[0];
  if (x >= d[d.length-1].c) return d[d.length-1];
  let i = 0; while (i < d.length-1 && !(x >= d[i].c && x <= d[i+1].c)) i++;
  const a = d[i], b = d[i+1], t = (x - a.c) / (b.c - a.c), near = t < 0.5 ? a : b;
  return {
    treeL: lerpColor(a.treeL,b.treeL,t), treeD: lerpColor(a.treeD,b.treeD,t),
    gT: lerpColor(a.gT,b.gT,t), gB: lerpColor(a.gB,b.gB,t),
    fog: lerpColor(a.fog,b.fog,t), sky: lerpColor(a.sky,b.sky,t),
    leaf: near.leaf, deco: near.deco, snow: near.snow, moss: near.moss,
  };
}

// ---------- Sky / time-of-day ----------
const SKY = {
  day:   [[120,186,214],[186,216,226]],
  dusk:  [[224,128,86],[86,70,116]],
  night: [[16,15,36],[34,26,56]],
  dawn:  [[126,116,156],[232,174,132]],
};

export function skyColors() {
  const t = Game.time;
  const stops = [
    [0.00,SKY.day],[0.46,SKY.day],[0.58,SKY.dusk],
    [0.68,SKY.night],[0.90,SKY.night],[0.95,SKY.dawn],[1.0,SKY.day],
  ];
  let a = stops[0], b = stops[stops.length-1];
  for (let i = 0; i < stops.length-1; i++) { if (t >= stops[i][0] && t <= stops[i+1][0]) { a=stops[i]; b=stops[i+1]; break; } }
  const k = (t-a[0]) / Math.max(0.0001, b[0]-a[0]);
  let top = lerpColor(a[1][0], b[1][0], k), bot = lerpColor(a[1][1], b[1][1], k);
  const bi = biomeAt(Game.cam + W/2), w = 0.32 * (1 - darkness());
  top = lerpColor(top, bi.sky, w);
  bot = lerpColor(bot, shade(bi.sky, 1.12), w*0.7);
  return [top, bot];
}

export function darkness() {
  const t = Game.time;
  if (t <= 0.5) return 0;
  if (t <= 0.7) return (t-0.5)/0.2;
  if (t <= 0.9) return 1;
  if (t <= 0.96) return 1-(t-0.9)/0.06;
  return 0;
}

// ---------- Wind ----------
export function windGust() { return Math.sin(Game.windT*0.5)*6 + Math.sin(Game.windT*1.3)*3 + Math.sin(Game.windT*0.21)*5; }
export function windSway(phase, amp) {
  return (Math.sin(Game.windT*1.1+phase)*0.7 + Math.sin(Game.windT*0.37+phase)*0.3)
       * amp * (0.55 + 0.55*Math.abs(Math.sin(Game.windT*0.2+phase*0.3)));
}

// ---------- FX state ----------
export let FX = null;

export function initFX() {
  const R = Math.random;
  FX = {
    stars:  Array.from({length:180}, () => ({ x:R()*W, y:R()*groundY*0.82, s:R()*1.7+0.3, tw:R()*6 })),
    clouds: Array.from({length:7},   () => ({ x:R()*W, y:24+R()*groundY*0.42, s:0.6+R()*1.0, sp:5+R()*9, o:0.4+R()*0.4 })),
    birds:  Array.from({length:6},   () => ({ x:R()*W, y:55+R()*180, sp:16+R()*24, ph:R()*6, dir:R()<0.5?1:-1, scale:0.7+R()*0.6 })),
    butter: Array.from({length:10},  () => ({ x:R()*W, y:groundY-R()*120, ph:R()*6, c:["#f2c14e","#ece4d2","#d9883c","#cfe6f2","#e58fb0"][(R()*5)|0] })),
    flies:  Array.from({length:50},  () => ({ x:R()*W, y:groundY-R()*150, ph:R()*6 })),
    dust:   Array.from({length:64},  () => ({ x:R()*W, y:R()*H, z:0.3+R()*0.7, ph:R()*6 })),
    fall:   Array.from({length:54},  () => ({ x:R()*W, y:R()*H, sp:18+R()*44, sway:2+R()*6, ph:R()*6, rot:R()*6, active:false, snow:false, color:"#9bd05a" })),
    embers: [], smoke: [], flicker: 1,
  };
}

// Re-initialise FX when canvas is resized.
window.addEventListener("resize", () => { if (FX) initFX(); });

export function updateFX(dt) {
  if (!FX) initFX();
  Game.windT += dt;
  const wind = windGust();
  FX.flicker = 0.74 + 0.24*Math.sin(Game.windT*9) + 0.12*Math.sin(Game.windT*23.3) + (Math.random()-0.5)*0.07;

  for (const c of FX.clouds) { c.x += (c.sp*0.18 + wind*0.35)*dt; if (c.x > W+180) c.x=-180; if (c.x < -180) c.x=W+180; }
  for (const b of FX.birds)  { b.x += b.sp*b.dir*dt; b.ph += dt*6; if (b.x > W+50) b.x=-50; if (b.x < -50) b.x=W+50; }
  for (const bf of FX.butter){ bf.ph += dt; bf.x += Math.sin(bf.ph*1.3)*22*dt + wind*0.25*dt; bf.y += Math.cos(bf.ph*1.7)*16*dt; bf.y=clamp(bf.y,groundY-150,groundY-10); if (bf.x<-20) bf.x=W+20; if (bf.x>W+20) bf.x=-20; }
  for (const f of FX.flies)  { f.ph += dt; f.x += Math.sin(f.ph)*11*dt; f.y += Math.cos(f.ph*1.3)*9*dt; f.y=clamp(f.y,groundY-165,groundY-6); if (f.x<0) f.x=W; if (f.x>W) f.x=0; }
  for (const d of FX.dust)   { d.ph += dt; d.x += (wind*d.z*0.7+Math.sin(d.ph)*4)*dt; d.y += Math.cos(d.ph*0.7)*3*dt - 2*d.z*dt; if (d.y<0) d.y=H; if (d.y>H) d.y=0; if (d.x<0) d.x=W; if (d.x>W) d.x=0; }

  const cb = biomeAt(Game.cam + W/2), falling = cb.deco==="autumn" || cb.snow;
  for (const p of FX.fall) {
    if (!p.active) { if (falling && Math.random()<0.025) { p.active=true; p.x=Math.random()*W; p.y=-12; p.snow=!!cb.snow; p.color=cb.snow?"#eef4fb":cb.leaf; } continue; }
    p.ph+=dt; p.rot+=dt*2.4; p.y+=p.sp*dt*(p.snow?0.5:1); p.x+=(Math.sin(p.ph*2)*p.sway+wind*1.3)*dt;
    if (p.y > H+12) p.active=false;
  }

  const base = state.base;
  if (base) {
    if (Math.random()<0.7) FX.embers.push({ x:base.x+rand(-7,7), y:groundY-12, vx:rand(-9,9), vy:-rand(30,64), life:rand(0.7,1.7), t:0, s:rand(1,2.4) });
    if (Math.random()<0.3) FX.smoke.push({ x:base.x+rand(-5,5), y:groundY-28, vy:-rand(13,24), r:rand(5,9), life:rand(1.6,3), t:0 });
  }
  for (let i=FX.embers.length-1;i>=0;i--){ const e=FX.embers[i]; e.t+=dt; e.x+=(e.vx+wind*0.5)*dt; e.y+=e.vy*dt; e.vy*=0.99; if (e.t>e.life) FX.embers.splice(i,1); }
  for (let i=FX.smoke.length-1;i>=0;i--){ const s=FX.smoke[i]; s.t+=dt; s.x+=(wind*0.9)*dt; s.y+=s.vy*dt; s.r+=8*dt; if (s.t>s.life) FX.smoke.splice(i,1); }
  if (FX.embers.length>140) FX.embers.splice(0, FX.embers.length-140);
  if (FX.smoke.length>70)   FX.smoke.splice(0, FX.smoke.length-70);
}

// ---------- Trees ----------
function pickType(b, r) {
  const t = r();
  if (b.snow)              return t<0.5?"fir":t<0.8?"pine":t<0.92?"dead":"birch";
  if (b.deco==="autumn")   return t<0.4?"oak":t<0.66?"birch":t<0.85?"crooked":t<0.93?"bush":"dead";
  if (b.deco==="dark")     return t<0.45?"fir":t<0.72?"pine":t<0.88?"crooked":"dead";
  if (b.deco==="swamp")    return t<0.4?"dead":t<0.66?"crooked":t<0.84?"oak":"bush";
  return t<0.4?"pine":t<0.66?"fir":t<0.82?"oak":t<0.92?"widepine":"birch";
}

function makeTree(x, baseH, r) {
  const b = biomeAt(x), type = pickType(b, r);
  const h = baseH * (0.7+r()*0.7);
  const w = (type==="widepine"?h*0.72:(type==="oak"||type==="bush")?h*0.85:type==="dead"?h*0.42:h*0.5) * (0.82+r()*0.4);
  const tiers = 3+((r()*4)|0), lean = (r()-0.5)*(type==="crooked"?0.5:0.16);
  let clusters=null, branches=null;
  if (type==="oak"||type==="bush"||type==="crooked"||type==="birch") {
    clusters=[];
    const n=type==="bush"?4:type==="birch"?3:6+((r()*3)|0), cy=type==="bush"?0.46:type==="birch"?0.85:0.76;
    for (let i=0;i<n;i++) clusters.push({ dx:(r()-0.5)*w*0.9, dy:cy-r()*0.36, r:(0.28+r()*0.22)*w });
  }
  if (type==="dead") {
    branches=[];
    const n=3+((r()*4)|0);
    for (let i=0;i<n;i++) branches.push({ hf:0.38+r()*0.56, side:r()<0.5?-1:1, len:(0.18+r()*0.22)*h, up:0.3+r()*0.5, broken:r()<0.3 });
  }
  return { x, type, h, w, phase:r()*6, tiers, lean, broken:r()<0.2, snow:b.snow&&r()<0.85, moss:b.moss&&r()<0.6, clusters, branches };
}

function drawTree(t, cx, baseY, light, dark, depthDark, swayAmp) {
  const Ht=t.h, Wd=t.w, lean=t.lean;
  const sw = (hf) => windSway(t.phase, swayAmp)*Math.pow(clamp(hf,0,1),1.35) + lean*hf*Wd*0.7;
  const trunkCol = shade(dark, 0.68);
  if (depthDark < 0.5) { ctx.save(); ctx.globalAlpha=0.16*(1-depthDark); ctx.fillStyle="#0a0810"; ctx.beginPath(); ctx.ellipse(cx,groundY+2,Wd*0.5*(1.15-depthDark),Wd*0.5*(1.15-depthDark)*0.26,0,0,Math.PI*2); ctx.fill(); ctx.restore(); }

  if (t.type==="pine"||t.type==="fir"||t.type==="widepine") {
    ctx.fillStyle=withA(trunkCol,1); ctx.fillRect(cx-Wd*0.05, baseY-Ht*0.16, Wd*0.1, Ht*0.16);
    for (let i=0;i<t.tiers;i++) {
      const bhf=i/t.tiers, thf=(i+1)/t.tiers;
      const tw=Wd*(1-bhf*0.78)*0.5, by=baseY-bhf*Ht-Ht*0.05, ty=baseY-thf*Ht;
      const bx=cx+sw(bhf), tx=cx+sw(thf);
      ctx.fillStyle=withA(dark,1); ctx.beginPath(); ctx.moveTo(bx-tw,by); ctx.lineTo(bx+tw,by); ctx.lineTo(tx,ty); ctx.closePath(); ctx.fill();
      ctx.fillStyle=withA(light,0.5); ctx.beginPath(); ctx.moveTo(bx-tw,by); ctx.lineTo(bx-tw*0.16,by); ctx.lineTo(tx,ty); ctx.closePath(); ctx.fill();
      if (t.snow) { ctx.fillStyle="rgba(238,244,251,0.92)"; ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(tx-tw*0.5,by-(by-ty)*0.5); ctx.lineTo(tx+tw*0.5,by-(by-ty)*0.5); ctx.closePath(); ctx.fill(); }
    }
  } else if (t.type==="dead") {
    ctx.strokeStyle=withA(trunkCol,1); ctx.lineCap="round"; ctx.lineWidth=Math.max(2,Wd*0.14);
    ctx.beginPath(); ctx.moveTo(cx,baseY); ctx.lineTo(cx+sw(1),baseY-Ht); ctx.stroke();
    for (const br of t.branches) {
      const yy=baseY-br.hf*Ht, xx=cx+sw(br.hf), ex=xx+br.side*br.len, ey=yy-br.len*br.up;
      ctx.lineWidth=Math.max(1.5,Wd*0.09);
      ctx.beginPath(); ctx.moveTo(xx,yy); ctx.lineTo(ex,ey);
      if (!br.broken) ctx.lineTo(ex+br.side*br.len*0.4,ey-br.len*0.5);
      ctx.stroke();
      if (t.snow) { ctx.strokeStyle="rgba(238,244,251,0.8)"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(xx,yy-2); ctx.lineTo(ex,ey-2); ctx.stroke(); ctx.strokeStyle=withA(trunkCol,1); }
    }
    ctx.lineCap="butt";
  } else {
    const trunkH=t.type==="bush"?Ht*0.12:t.type==="birch"?Ht*0.6:Ht*0.42;
    const tw=Wd*0.09, isBirch=t.type==="birch";
    ctx.strokeStyle=withA(isBirch?lerpColor(light,[232,234,236],0.55):trunkCol,1);
    ctx.lineWidth=Math.max(2,tw*2); ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(cx,baseY); ctx.lineTo(cx+sw(trunkH/Ht),baseY-trunkH); ctx.stroke();
    ctx.lineCap="butt";
    if (isBirch) { ctx.strokeStyle="rgba(40,44,48,0.45)"; ctx.lineWidth=1; for (let k=1;k<4;k++){ const yy=baseY-trunkH*k/4; ctx.beginPath(); ctx.moveTo(cx-tw,yy); ctx.lineTo(cx+tw*0.4,yy); ctx.stroke(); } }
    for (const cl of t.clusters) { const ox=cx+sw(cl.dy)+cl.dx, oy=baseY-cl.dy*Ht; ctx.fillStyle=withA(dark,1); ctx.beginPath(); ctx.arc(ox,oy,cl.r,0,Math.PI*2); ctx.fill(); }
    for (const cl of t.clusters) { const ox=cx+sw(cl.dy)+cl.dx, oy=baseY-cl.dy*Ht; ctx.fillStyle=withA(light,0.42); ctx.beginPath(); ctx.arc(ox-cl.r*0.3,oy-cl.r*0.32,cl.r*0.62,0,Math.PI*2); ctx.fill(); }
    if (t.snow) for (const cl of t.clusters) { const ox=cx+sw(cl.dy)+cl.dx, oy=baseY-cl.dy*Ht; ctx.fillStyle="rgba(238,244,251,0.85)"; ctx.beginPath(); ctx.arc(ox-cl.r*0.18,oy-cl.r*0.46,cl.r*0.5,0,Math.PI*2); ctx.fill(); }
  }
  if (t.broken&&t.type!=="dead") { ctx.strokeStyle=withA(trunkCol,1); ctx.lineWidth=Math.max(1.5,Wd*0.07); ctx.beginPath(); ctx.moveTo(cx,baseY-Ht*0.34); ctx.lineTo(cx+Wd*0.4,baseY-Ht*0.28); ctx.stroke(); }
  if (t.moss) { ctx.fillStyle="rgba(74,116,84,0.55)"; ctx.beginPath(); ctx.ellipse(cx,baseY-Ht*0.04,Wd*0.12,Ht*0.05,0,0,Math.PI*2); ctx.fill(); }
}

export function drawTreeLayer(trees, factor, depthDark, swayAmp, alpha=1) {
  const dark=darkness(), haze=hazeColor(dark), off=Game.cam*factor;
  if (alpha<1) { ctx.save(); ctx.globalAlpha=alpha; }
  for (const t of trees) {
    const px=t.x-off; if (px<-140||px>W+140) continue;
    const b=biomeAt(t.x);
    drawTree(t, px, groundY+4, atmo(b.treeL,haze,depthDark), atmo(b.treeD,haze,depthDark), depthDark, swayAmp);
  }
  if (alpha<1) ctx.restore();
}

let treeCache = null;
export function getTrees() {
  if (treeCache && treeCache.seed===Game.treeSeed) return treeCache;
  const r=mulberry32(Game.treeSeed||1);
  const far=[],mid=[],near=[],fore=[],hills=[],mountains=[];
  for (let x=-100;x<CFG.worldWidth+100;x+=110) far.push(makeTree(x+r()*80, 72, r));
  for (let x=-100;x<CFG.worldWidth+100;x+=86)  mid.push(makeTree(x+r()*64, 120, r));
  for (let x=-100;x<CFG.worldWidth+100;x+=70)  near.push(makeTree(x+r()*48, 178, r));
  for (let x=-100;x<CFG.worldWidth+100;x+=520) fore.push(makeTree(x+r()*220, 150, r));
  for (let x=-300;x<CFG.worldWidth+300;x+=170) hills.push({ x:x+r()*120, h:50+r()*130, w:200+r()*230 });
  for (let x=-600;x<CFG.worldWidth+600;x+=320) {
    const w=200+r()*160, h=110+r()*140;
    const nPts=6+((r()*4)|0);
    const pts=[];
    for (let k=0;k<=nPts;k++) {
      const t=k/nPts, ox=(t-0.5)*w*2;
      const envelope=Math.max(0,1-Math.pow((t-0.5)*2,2));
      const jitter=(r()-0.5)*h*0.35;
      pts.push([ox, h*envelope+jitter*envelope]);
    }
    const peak=pts.reduce((bi,p,i)=>p[1]>pts[bi][1]?i:bi,0);
    mountains.push({ x:x+r()*180, h, w, pts, peak });
  }
  treeCache={ seed:Game.treeSeed, far, mid, near, fore, hills, mountains };
  return treeCache;
}
export function clearTreeCache() { treeCache=null; }

// ---------- Ground decoration cache ----------
let decoCache=null;
export function getDeco() {
  if (decoCache&&decoCache.seed===Game.treeSeed) return decoCache;
  const r=mulberry32((Game.treeSeed||1)*7+13);
  const items=[];
  for (let x=60;x<CFG.worldWidth-60;x+=22+r()*40) {
    const b=biomeAt(x), t=r();
    let kind;
    if      (b.snow)              kind=t<0.68?"snowtuft":(t<0.86?"stone":"stump");
    else if (b.deco==="autumn")   kind=t<0.42?"grass":(t<0.66?"leafpile":(t<0.82?"stone":(t<0.92?"flower":"stump")));
    else if (b.deco==="swamp")    kind=t<0.48?"reed":(t<0.74?"grass":(t<0.9?"mushroom":"stone"));
    else if (b.deco==="dark")     kind=t<0.52?"grass":(t<0.78?"fern":(t<0.91?"mushroom":"stone"));
    else                          kind=t<0.48?"grass":(t<0.7?"flower":(t<0.84?"stone":(t<0.94?"grass":"stump")));
    items.push({ x, kind, s:0.7+r()*0.8, ph:r()*6, leaf:b.leaf, flower:["#e58fb0","#f2c14e","#cfe6f2","#e87b5a"][(r()*4)|0] });
  }
  decoCache={seed:Game.treeSeed, items};
  return decoCache;
}

let groundTexCache=null;
export function getGroundTex() {
  if (groundTexCache&&groundTexCache.seed===Game.treeSeed) return groundTexCache;
  const r=mulberry32((Game.treeSeed||1)*13+7);
  const fringe=[],patches=[],pebbles=[];
  for (let x=0;x<CFG.worldWidth;x+=12+r()*16) fringe.push({x, h:5+r()*9, ph:r()*6});
  for (let x=0;x<CFG.worldWidth;x+=24+r()*38) patches.push({x, dy:r()*60, r:9+r()*24, light:r()<0.5});
  for (let x=0;x<CFG.worldWidth;x+=28+r()*56) pebbles.push({x, dy:8+r()*70, r:1.4+r()*3});
  groundTexCache={seed:Game.treeSeed, fringe, patches, pebbles};
  return groundTexCache;
}

// ---------- Sky furniture ----------
export function drawStars(dark) {
  if (dark<0.12) return;
  ctx.save();
  for (const s of FX.stars) {
    const tw=0.5+0.5*Math.sin(performance.now()/600+s.tw);
    ctx.globalAlpha=dark*tw; ctx.fillStyle="rgba(255,255,238,1)";
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.restore();
}

export function drawAurora(dark) {
  if (dark<0.6) return;
  const a=(dark-0.6)/0.4*0.12;
  ctx.save(); ctx.globalCompositeOperation="lighter";
  for (let b=0;b<2;b++) {
    const baseY=64+b*42; ctx.beginPath();
    for (let x=0;x<=W;x+=22) { const y=baseY+Math.sin(x*0.01+Game.windT*0.3+b)*22+Math.sin(x*0.03+Game.windT*0.5)*10; x===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
    for (let x=W;x>=0;x-=22) ctx.lineTo(x,baseY+64+Math.sin(x*0.01+Game.windT*0.3+b)*22);
    ctx.closePath();
    const grad=ctx.createLinearGradient(0,baseY,0,baseY+72);
    grad.addColorStop(0,`rgba(80,255,170,${a})`); grad.addColorStop(1,"rgba(80,180,255,0)");
    ctx.fillStyle=grad; ctx.fill();
  }
  ctx.restore();
}

let lastSun={ cx:0, cy:120, isMoon:false };
export function drawCelestial(skyTop) {
  const t=Game.time;
  const isMoon=t>0.6&&t<0.95;
  let frac=isMoon?(t-0.6)/0.35:(t<0.6?t/0.6:(t-0.95)/0.05);
  frac=clamp(frac,0,1);
  const cx=lerp(W*0.12,W*0.88,frac), cy=groundY-70-Math.sin(frac*Math.PI)*(groundY*0.58);
  lastSun={cx,cy,isMoon};
  ctx.save();
  if (isMoon) {
    const gl=ctx.createRadialGradient(cx,cy,4,cx,cy,84); gl.addColorStop(0,"rgba(210,224,255,0.4)"); gl.addColorStop(1,"rgba(210,224,255,0)");
    ctx.fillStyle=gl; ctx.fillRect(cx-90,cy-90,180,180);
    ctx.fillStyle="rgba(238,240,228,0.97)"; ctx.beginPath(); ctx.arc(cx,cy,24,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(206,214,204,0.5)"; ctx.beginPath(); ctx.arc(cx-6,cy+5,5,0,Math.PI*2); ctx.arc(cx+8,cy-7,3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=rgb(skyTop); ctx.beginPath(); ctx.arc(cx+9,cy-6,22,0,Math.PI*2); ctx.fill();
  } else {
    const warm=t<0.12||t>0.93;
    const gl=ctx.createRadialGradient(cx,cy,8,cx,cy,155); gl.addColorStop(0,warm?"rgba(255,168,88,0.5)":"rgba(255,226,150,0.45)"); gl.addColorStop(1,"rgba(255,210,120,0)");
    ctx.fillStyle=gl; ctx.fillRect(cx-160,cy-160,320,320);
    ctx.fillStyle=warm?"rgba(255,196,120,0.98)":"rgba(255,232,156,0.98)"; ctx.beginPath(); ctx.arc(cx,cy,32,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

export function drawClouds(dark, top) {
  const a=(1-dark)*0.9; if (a<=0.02) return;
  const col=lerpColor(top,[255,255,255],0.5);
  ctx.save(); ctx.fillStyle=rgb(col);
  for (const c of FX.clouds) {
    ctx.globalAlpha=a*c.o; const s=c.s;
    for (const o of [[-30,4,18],[-6,-7,25],[20,2,20],[46,6,15]]) { ctx.beginPath(); ctx.ellipse(c.x+o[0]*s,c.y+o[1]*s,o[2]*s,o[2]*s*0.6,0,0,Math.PI*2); ctx.fill(); }
  }
  ctx.restore();
}

export function drawBirds(dark) {
  const a=(1-dark)*0.8; if (a<=0.05) return;
  ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle="#2a2a32"; ctx.lineWidth=2; ctx.lineCap="round";
  for (const b of FX.birds) {
    const flap=Math.sin(b.ph)*0.55, s=6*b.scale;
    ctx.beginPath(); ctx.moveTo(b.x-s,b.y+flap*s); ctx.lineTo(b.x,b.y); ctx.lineTo(b.x+s,b.y+flap*s); ctx.stroke();
  }
  ctx.restore(); ctx.lineCap="butt";
}

export function drawHills(hills, dark) {
  const haze=hazeColor(dark), off=Game.cam*0.12;
  for (const h of hills) {
    const px=h.x-off; if (px<-h.w||px>W+h.w) continue;
    const b=biomeAt(h.x);
    ctx.fillStyle=rgb(lerpColor(atmo(b.gT,haze,0.9),b.snow?[236,241,248]:haze,b.snow?0.5:0.22));
    ctx.beginPath(); ctx.moveTo(px-h.w,groundY+4); ctx.quadraticCurveTo(px,groundY+4-h.h,px+h.w,groundY+4); ctx.closePath(); ctx.fill();
    if (b.snow) { ctx.fillStyle="rgba(245,248,252,0.7)"; ctx.beginPath(); ctx.moveTo(px-h.w*0.3,groundY+4-h.h*0.7); ctx.quadraticCurveTo(px,groundY+4-h.h,px+h.w*0.3,groundY+4-h.h*0.7); ctx.lineTo(px,groundY+4-h.h*0.45); ctx.closePath(); ctx.fill(); }
  }
}

export function drawMountains(mountains, dark) {
  const haze=hazeColor(dark), off=Game.cam*0.06;
  for (const m of mountains) {
    const px=m.x-off; if (px<-m.w*2||px>W+m.w*2) continue;
    // body: cool atmospheric grey-blue, independent of biome
    const bodyCol=lerpColor([88,100,122],haze,0.40+dark*0.35);
    ctx.fillStyle=rgb(bodyCol); ctx.beginPath();
    ctx.moveTo(px-m.w, groundY+4);
    // jagged profile using pre-generated offsets
    for (let k=0;k<m.pts.length;k++) { ctx.lineTo(px+m.pts[k][0], groundY+4-m.pts[k][1]); }
    ctx.lineTo(px+m.w, groundY+4); ctx.closePath(); ctx.fill();
    // snow cap on the top 30%
    const snowH=m.h*0.28, peakX=px+m.pts[m.peak][0], peakY=groundY+4-m.h;
    ctx.fillStyle=rgb(lerpColor([235,240,248],[180,195,215],dark*0.5));
    ctx.beginPath(); ctx.moveTo(peakX-m.w*0.2, groundY+4-m.h+snowH);
    ctx.lineTo(peakX, peakY); ctx.lineTo(peakX+m.w*0.18, groundY+4-m.h+snowH*0.9);
    ctx.closePath(); ctx.fill();
    // subtle edge highlight
    ctx.strokeStyle=rgb(lerpColor([200,210,225],[80,90,110],dark*0.6));
    ctx.lineWidth=1.2; ctx.globalAlpha=0.35;
    ctx.beginPath(); ctx.moveTo(peakX, peakY); ctx.lineTo(peakX+m.w*0.18, groundY+4-m.h+snowH*0.9); ctx.stroke();
    ctx.globalAlpha=1;
  }
}

export function drawFogBand(y, h, dark, intensity) {
  const bi=biomeAt(Game.cam+W/2);
  const a=intensity*(0.16+0.1*Math.sin(Game.windT*0.2))*(1-0.4*dark);
  const col=lerpColor(bi.fog,[20,22,40],dark);
  const grad=ctx.createLinearGradient(0,y-h,0,y+h);
  grad.addColorStop(0,withA(col,0)); grad.addColorStop(0.5,withA(col,a)); grad.addColorStop(1,withA(col,0));
  ctx.fillStyle=grad; ctx.fillRect(0,y-h,W,h*2);
}

export function drawGodrays(dark) {
  if (dark>0.55||lastSun.isMoon) return;
  const a=0.06*(1-dark*1.6); if (a<=0) return;
  ctx.save(); ctx.globalCompositeOperation="lighter";
  const sx=lastSun.cx, sy=lastSun.cy;
  const rayOrigin = sy + 36; // start below the sun disc so rays don't emerge from inside it
  const shift=Math.sin(Game.windT*0.3)*8;
  for (let i=-2;i<=2;i++) {
    const topx=sx+i*7+shift*0.3, botx=sx+i*46+shift, wTop=9, wBot=26;
    const grad=ctx.createLinearGradient(0,rayOrigin,0,groundY);
    grad.addColorStop(0,`rgba(255,240,190,${a})`); grad.addColorStop(1,"rgba(255,240,190,0)");
    ctx.fillStyle=grad;
    ctx.beginPath(); ctx.moveTo(topx-wTop,rayOrigin); ctx.lineTo(topx+wTop,rayOrigin);
    ctx.lineTo(botx+wBot,groundY); ctx.lineTo(botx-wBot,groundY); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

export function drawLowFog(dark, bi) {
  const inten=bi.deco==="swamp"?0.5:bi.snow?0.4:bi.deco==="dark"?0.32:0.2;
  const a=inten*(0.5+0.2*Math.sin(Game.windT*0.3));
  const col=lerpColor(bi.fog,[18,20,36],dark);
  const grad=ctx.createLinearGradient(0,groundY-70,0,groundY+30);
  grad.addColorStop(0,withA(col,0)); grad.addColorStop(0.7,withA(col,a*0.7)); grad.addColorStop(1,withA(col,a));
  ctx.fillStyle=grad; ctx.fillRect(0,groundY-70,W,100);
  ctx.save(); ctx.globalAlpha=a*0.7; ctx.fillStyle=rgb(col);
  for (let i=0;i<4;i++) { const wx=((Game.windT*12+i*W/4)%(W+260))-130; ctx.beginPath(); ctx.ellipse(wx,groundY-18-i*6,120,17,0,0,Math.PI*2); ctx.fill(); }
  ctx.restore();
}

export function drawAmbientFront(dark, bi) {
  ctx.save();
  for (const d of FX.dust) { ctx.globalAlpha=(0.10+0.16*d.z)*(0.5+0.5*(1-dark)); ctx.fillStyle=dark>0.5?"rgba(180,190,220,1)":"rgba(255,250,230,1)"; const s=1+d.z*1.5; ctx.fillRect(d.x,d.y,s,s); }
  ctx.restore();
  if (dark<0.5) { for (const bf of FX.butter) { const w=Math.abs(Math.sin(bf.ph*6)); ctx.globalAlpha=1-dark*2; if (ctx.globalAlpha<=0) continue; ctx.fillStyle=bf.c; ctx.beginPath(); ctx.ellipse(bf.x-2,bf.y,3,1.4+w*1.6,0,0,Math.PI*2); ctx.ellipse(bf.x+2,bf.y,3,1.4+w*1.6,0,0,Math.PI*2); ctx.fill(); } ctx.globalAlpha=1; }
  if (dark>0.4) { ctx.save(); ctx.globalCompositeOperation="lighter"; for (const f of FX.flies) { const tw=0.4+0.6*Math.abs(Math.sin(f.ph*3)); ctx.globalAlpha=tw*dark; ctx.fillStyle="rgba(190,255,120,0.9)"; ctx.beginPath(); ctx.arc(f.x,f.y,1.7,0,Math.PI*2); ctx.fill(); } ctx.restore(); }
  for (const p of FX.fall) { if (!p.active) continue; ctx.globalAlpha=0.85; if (p.snow) { ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,1.8,0,Math.PI*2); ctx.fill(); } else { ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=p.color; ctx.beginPath(); ctx.ellipse(0,0,3.2,1.5,0,0,Math.PI*2); ctx.fill(); ctx.restore(); } }
  ctx.globalAlpha=1;
}
