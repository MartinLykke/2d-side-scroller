import { clamp, lerp, lerpColor, rgb, withA, shade, hazeColor, atmo, rand, mulberry32 } from '../util/math.js';
import { CFG } from '../config/config.js';
import { ctx, W, H, groundY } from '../core/canvas.js';
import { Game, state } from '../core/state.js';
import { Audio } from '../systems/infrastructure/Audio.js';
import { visibleWorldBounds } from './Viewport.js';
import { renderBudget } from './RenderFrame.js';

// ---------- Biomes ----------
// The map is one continuous kingdom, but it only has one active biome at a
// time. Changing biome remakes the whole landscape instead of moving through
// world-space bands.
const BIOME_BLEND = 180;
export const BIOME_ORDER = ["forest", "frozen", "desert", "swamp", "volcano", "corrupted"];
export const BIOME_DEFS = [
  {
    id:"frozen", name:"Frozen Wastes", c:680, start:0, end:1400,
    treeL:[218,230,242], treeD:[118,146,184], gT:[226,235,244], gB:[170,190,214],
    fog:[224,236,246], sky:[150,182,214], leaf:"#edf6ff", deco:"frozen",
    snow:1, moss:0, dry:0, hot:0, wet:0, corrupt:0, fallKind:"snow",
  },
  {
    id:"desert", name:"Desert", c:2300, start:1400, end:3200,
    treeL:[170,136,80], treeD:[94,66,42], gT:[202,164,92], gB:[122,84,46],
    fog:[224,188,126], sky:[214,174,112], leaf:"#d7b063", deco:"desert",
    snow:0, moss:0, dry:1, hot:0, wet:0, corrupt:0, fallKind:"dust",
  },
  {
    id:"forest", name:"Forest", c:4500, start:3200, end:5850,
    treeL:[82,132,74], treeD:[28,62,42], gT:[76,112,58], gB:[42,68,42],
    fog:[148,184,168], sky:[120,186,214], leaf:"#9bd05a", deco:"forest",
    snow:0, moss:0, dry:0, hot:0, wet:1, corrupt:0, fallKind:"leaf",
  },
  {
    id:"swamp", name:"Swamp", c:6500, start:5850, end:7200,
    treeL:[62,96,64], treeD:[14,36,32], gT:[42,60,38], gB:[14,30,28],
    fog:[92,116,74], sky:[78,104,102], leaf:"#b4bd58", deco:"swamp",
    snow:0, moss:1, dry:0, hot:0, wet:1, corrupt:0, fallKind:"spore",
  },
  {
    id:"volcano", name:"Volcano", c:7950, start:7200, end:8600,
    treeL:[122,92,70], treeD:[42,34,34], gT:[88,66,56], gB:[42,34,34],
    fog:[168,118,92], sky:[166,108,82], leaf:"#ff7a36", deco:"volcano",
    snow:0, moss:0, dry:1, hot:1, wet:0, corrupt:0, fallKind:"ash",
  },
  {
    id:"corrupted", name:"Corrupted Lands", c:8930, start:8600, end:CFG.worldWidth,
    treeL:[94,64,126], treeD:[30,20,44], gT:[52,42,62], gB:[24,20,34],
    fog:[126,86,148], sky:[92,66,122], leaf:"#a56bff", deco:"corrupted",
    snow:0, moss:1, dry:0, hot:0, wet:0, corrupt:1, fallKind:"ash",
  },
];

// Phase 2 ("the Hollow"): the whole land shifts toward a dead violet-grey.
// Applied as a post-tint so the biome bands still read as distinct regions.
const HOLLOW_TINT = {
  treeL: [138, 116, 168], treeD: [50, 38, 74],
  gT: [104, 92, 122], gB: [54, 46, 72],
  fog: [128, 108, 152], sky: [104, 82, 138],
};
const HOLLOW_LEAF = "#8a6fb0";

function applyWorldPhase(b) {
  if ((Game.worldPhase || 1) < 2) return b;
  return {
    ...b,
    treeL: lerpColor(b.treeL, HOLLOW_TINT.treeL, 0.6),
    treeD: lerpColor(b.treeD, HOLLOW_TINT.treeD, 0.6),
    gT: lerpColor(b.gT, HOLLOW_TINT.gT, 0.55),
    gB: lerpColor(b.gB, HOLLOW_TINT.gB, 0.55),
    fog: lerpColor(b.fog, HOLLOW_TINT.fog, 0.6),
    sky: lerpColor(b.sky, HOLLOW_TINT.sky, 0.55),
    leaf: b.corrupt ? b.leaf : HOLLOW_LEAF, deco: b.corrupt ? "corrupted" : b.deco,
    snow: 0, moss: b.moss || b.corrupt,
  };
}

function mixBiome(a, b, t) {
  const near = t < 0.5 ? a : b;
  return {
    ...near,
    treeL: lerpColor(a.treeL,b.treeL,t), treeD: lerpColor(a.treeD,b.treeD,t),
    gT: lerpColor(a.gT,b.gT,t), gB: lerpColor(a.gB,b.gB,t),
    fog: lerpColor(a.fog,b.fog,t), sky: lerpColor(a.sky,b.sky,t),
    leaf: near.leaf, deco: near.deco, snow: near.snow, moss: near.moss,
    dry: near.dry, hot: near.hot, wet: near.wet, corrupt: near.corrupt,
    fallKind: near.fallKind,
  };
}

export function biomeById(id) {
  return BIOME_DEFS.find(b => b.id === id) || BIOME_DEFS.find(b => b.id === "forest") || BIOME_DEFS[0];
}

export function biomeCenterX(id) {
  const b = biomeById(id);
  return clamp(b.c ?? (b.start + b.end) / 2, 120, CFG.worldWidth - 120);
}

export function activeBiomeId() {
  return BIOME_DEFS.some(b => b.id === Game.activeBiome) ? Game.activeBiome : "forest";
}

export function nextBiomeId(id = activeBiomeId()) {
  const i = BIOME_ORDER.indexOf(id);
  return i >= 0 && i < BIOME_ORDER.length - 1 ? BIOME_ORDER[i + 1] : null;
}

export function setActiveBiome(id, opts = {}) {
  const biome = biomeById(id);
  Game.activeBiome = biome.id;
  if (!Array.isArray(Game.unlockedBiomes) || !Game.unlockedBiomes.includes("forest")) {
    Game.unlockedBiomes = ["forest"];
  }
  if (!Game.unlockedBiomes.includes(biome.id)) Game.unlockedBiomes.push(biome.id);
  if (opts.reseed) Game.treeSeed = Math.floor(rand(1, 99999));
  clearTreeCache();
  return biome;
}

export function biomeAt(_x) {
  return applyWorldPhase(biomeById(activeBiomeId()));
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
  if ((Game.worldPhase || 1) >= 2) {
    top = lerpColor(top, [88, 62, 122], 0.45);
    bot = lerpColor(bot, [140, 104, 156], 0.35);
  }
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
    stars:  Array.from({length:90}, () => ({ x:R()*W, y:R()*groundY*0.82, s:R()*1.7+0.3, tw:R()*6 })),
    clouds: Array.from({length:8},  (_,i) => {
      const far = i < 3; // first few are a distant hazy layer
      const puffCount = 5 + (R() * 4 | 0);
      const puffs = Array.from({length:puffCount}, (_,j) => {
        const t = j / (puffCount - 1 || 1);
        return [ -34+t*84 + (R()-0.5)*14, (R()-0.5)*10 - Math.sin(t*Math.PI)*6, 13+R()*13 + Math.sin(t*Math.PI)*7 ];
      });
      return { x:R()*W, y: far ? 14+R()*groundY*0.22 : 30+R()*groundY*0.42,
               s: far ? 0.45+R()*0.5 : 0.7+R()*1.1, sp: far ? 3+R()*4 : 5+R()*9,
               o: far ? 0.22+R()*0.18 : 0.42+R()*0.4, far, puffs };
    }),
    birds:  (() => { // sky birds travel alone or as loose skeins
      const arr=[];
      while (arr.length<9) {
        const flock=R()<0.4?2+(R()*3|0):1;
        const bx=R()*W, by=45+R()*200, sp=16+R()*24, dir=R()<0.5?1:-1, scale=0.6+R()*0.7;
        for (let j=0;j<flock&&arr.length<9;j++)
          arr.push({ x:bx-j*16*dir, y:by+(j%2?j*6:-j*5), sp, ph:R()*6+j*0.8, dir, scale });
      }
      return arr;
    })(),
    butter: Array.from({length:5},  () => ({ x:R()*W, y:groundY-R()*120, ph:R()*6, c:["#f2c14e","#ece4d2","#d9883c","#cfe6f2","#e58fb0"][(R()*5)|0] })),
    flies:  Array.from({length:20}, () => ({ x:R()*W, y:groundY-R()*150, ph:R()*6 })),
    dust:   Array.from({length:24}, () => ({ x:R()*W, y:R()*H, z:0.3+R()*0.7, ph:R()*6 })),
    fall:   Array.from({length:24}, () => ({ x:R()*W, y:R()*H, sp:18+R()*44, sway:2+R()*6, ph:R()*6, rot:R()*6, active:false, snow:false, color:"#9bd05a" })),
    embers: [], smoke: [], levelUpBeams: [], wildBirds: [], flicker: 1,
  };
}

// Re-initialise FX when canvas is resized.
window.addEventListener("resize", () => { if (FX) initFX(); });

export function updateFX(dt) {
  if (!FX) initFX();

  // Camera delta so screen-space ambient elements track the world and don't appear to follow the player
  const camDelta = Game.cam - (FX._prevCam ?? Game.cam);
  FX._prevCam = Game.cam;

  Game.windT += dt;
  const wind = windGust();
  FX.flicker = 0.74 + 0.24*Math.sin(Game.windT*9) + 0.12*Math.sin(Game.windT*23.3) + (Math.random()-0.5)*0.07;

  for (const c of FX.clouds) { c.x += (c.sp*0.18 + wind*0.35)*dt - camDelta*0.12; if (c.x > W+180) c.x=-180; if (c.x < -180) c.x=W+180; }
  for (const b of FX.birds)  { b.x += b.sp*b.dir*dt - camDelta; b.ph += dt*6; if (b.x > W+50) b.x=-50; if (b.x < -50) b.x=W+50; }
  for (const bf of FX.butter){ bf.ph += dt; bf.x += Math.sin(bf.ph*1.3)*22*dt + wind*0.25*dt - camDelta; bf.y += Math.cos(bf.ph*1.7)*16*dt; bf.y=clamp(bf.y,groundY-150,groundY-10); if (bf.x<-20) bf.x=W+20; if (bf.x>W+20) bf.x=-20; }
  for (const f of FX.flies)  { f.ph += dt; f.x += Math.sin(f.ph)*11*dt - camDelta; f.y += Math.cos(f.ph*1.3)*9*dt; f.y=clamp(f.y,groundY-165,groundY-6); if (f.x<0) f.x=W; if (f.x>W) f.x=0; }
  for (const d of FX.dust)   { d.ph += dt; d.x += (wind*d.z*0.7+Math.sin(d.ph)*4)*dt - camDelta; d.y += Math.cos(d.ph*0.7)*3*dt - 2*d.z*dt; if (d.y<0) d.y=H; if (d.y>H) d.y=0; if (d.x<0) d.x=W; if (d.x>W) d.x=0; }

  const cb = biomeAt(Game.cam + W/2);
  const fallKind = cb.fallKind || (cb.snow ? "snow" : "leaf");
  const heavyFall = cb.snow || cb.deco==="volcano" || cb.deco==="corrupted" || cb.deco==="swamp" || cb.deco==="desert";
  // deep in the woods a stray leaf drifts down now and then, whatever the biome
  const inForest = Math.abs(Game.cam + W/2 - CFG.baseX) > 800;
  const fallRate = heavyFall ? (fallKind==="dust" ? 0.018 : 0.025) : inForest ? 0.005 : 0;
  for (const p of FX.fall) {
    if (!p.active) {
      if (fallRate && Math.random()<fallRate) {
        p.active=true; p.x=Math.random()*W; p.y=-12; p.kind=fallKind; p.snow=fallKind==="snow";
        p.color=fallKind==="snow"?"#eef4fb":fallKind==="ash"?"#6d6264":fallKind==="dust"?"#d8b06a":fallKind==="spore"?"#b5d66c":cb.leaf;
      }
      continue;
    }
    p.ph+=dt; p.rot+=dt*2.4; p.y+=p.sp*dt*(p.snow?0.5:1); p.x+=(Math.sin(p.ph*2)*p.sway+wind*1.3)*dt - camDelta;
    if (p.y > H+12) p.active=false;
  }

  updateWildBirds(dt);

  const base = state.base;
  // ember column only while an actual campfire burns at the base (lvl 1-3)
  if (base && base.level < 4) {
    if (Math.random()<0.7) FX.embers.push({ x:base.x+rand(-7,7), y:groundY-12, vx:rand(-9,9), vy:-rand(30,64), life:rand(0.7,1.7), t:0, s:rand(1,2.4) });
  }
  for (let i=FX.embers.length-1;i>=0;i--){ const e=FX.embers[i]; e.t+=dt; e.x+=(e.vx+wind*0.5)*dt; e.y+=e.vy*dt; e.vy*=0.99; if (e.t>e.life) FX.embers.splice(i,1); }
  for (let i=FX.smoke.length-1;i>=0;i--){ const s=FX.smoke[i]; s.t+=dt; s.x+=(wind*0.9)*dt; s.y+=s.vy*dt; s.r+=8*dt; if (s.t>s.life) FX.smoke.splice(i,1); }
  for (let i=FX.levelUpBeams.length-1;i>=0;i--){ const b=FX.levelUpBeams[i]; b.t+=dt; if (b.t>b.life) FX.levelUpBeams.splice(i,1); }
  if (FX.embers.length>140) FX.embers.splice(0, FX.embers.length-140);
  if (FX.smoke.length>70)   FX.smoke.splice(0, FX.smoke.length-70);
}

// ---------- Wild birds ----------
// Small songbirds perch in the forest canopy and flush when something comes
// too close — world-space, drawn inside the camera transform among the trees.
const WILDBIRD_COLS = [
  { body:[110,90,72],  wing:[74,60,48],  breast:[204,134,88]  }, // robin
  { body:[92,100,112], wing:[60,66,78],  breast:[186,190,198] }, // grey tit
  { body:[76,72,64],   wing:[46,44,40],  breast:[218,178,80]  }, // yellowhammer
  { body:[56,66,80],   wing:[36,42,52],  breast:[124,150,176] }, // nuthatch
];

function updateWildBirds(dt) {
  const birds = FX.wildBirds;
  const dark = darkness();
  const player = state.player;
  const view = visibleWorldBounds(500);
  const camL = view.left, camR = view.right;

  // settle new birds on standing forest trees near (but not right next to) the player
  if (dark < 0.15 && birds.length < 7 && Math.random() < dt * 0.7 && state.forestTrees) {
    const cand = [];
    for (const ft of state.forestTrees) {
      if (ft.chopped || ft.falling || ft.lying || ft.carriedBy) continue;
      if (ft.x < camL - 500 || ft.x > camR + 500) continue;
      if (player && Math.abs(ft.x - player.x) < 240) continue;
      cand.push(ft);
    }
    if (cand.length) {
      const ft = cand[(Math.random() * cand.length) | 0];
      const t = ft.tree;
      birds.push({
        ft, mode: "perch",
        x: ft.x + (Math.random() - 0.5) * t.w * 0.5,
        y: groundY + 4 - t.h * (0.55 + Math.random() * 0.3),
        dir: Math.random() < 0.5 ? -1 : 1,
        col: WILDBIRD_COLS[(Math.random() * WILDBIRD_COLS.length) | 0],
        ph: Math.random() * 6,
        hopT: 2 + Math.random() * 5,
        life: 18 + Math.random() * 22,
        vx: 0, vy: 0, t: 0,
      });
    }
  }

  for (let i = birds.length - 1; i >= 0; i--) {
    const b = birds[i];
    b.ph += dt * (b.mode === "fly" ? 16 : 3);
    if (b.mode === "perch") {
      b.life -= dt;
      b.hopT -= dt;
      if (b.hopT <= 0) { // sidestep along the branch, sometimes turning around
        b.hopT = 2 + Math.random() * 5;
        b.x += (Math.random() - 0.5) * 10;
        if (Math.random() < 0.4) b.dir *= -1;
      }
      const ft = b.ft;
      const scared =
        (player && Math.abs(player.x - b.x) < 150 && Math.abs(player.vx || 0) > 40) ||
        (player && Math.abs(player.x - b.x) < 85) ||
        ft.beingChopped || ft.falling || ft.chopped ||
        (state.enemies || []).some(e => Math.abs(e.x - b.x) < 130);
      if (scared || b.life <= 0 || dark > 0.25) {
        b.mode = "fly";
        b.t = 0;
        b.dir = player && player.x > b.x ? -1 : 1; // away from the player
        b.vx = b.dir * (110 + Math.random() * 70);
        b.vy = -(60 + Math.random() * 45);
        if (scared && player && Math.abs(player.x - b.x) < 420 && Audio.chirp) Audio.chirp();
      }
    } else {
      b.t += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy = Math.max(b.vy - 14 * dt, -130); // keeps climbing as it escapes
      b.y += Math.sin(b.ph * 0.6) * 8 * dt;  // flap bounce
      if (b.t > 7 || b.x < camL - 600 || b.x > camR + 600 || b.y < -120) birds.splice(i, 1);
    }
  }
}

export function drawWildBirds() {
  if (!FX || !FX.wildBirds.length) return;
  const view = visibleWorldBounds(60), camL = view.left, camR = view.right;
  ctx.save();
  ctx.lineCap = "round";
  for (const b of FX.wildBirds) {
    if (b.x < camL || b.x > camR) continue;
    const c = b.col;
    ctx.save();
    ctx.translate(b.x, b.y);
    if (b.dir < 0) ctx.scale(-1, 1);
    if (b.mode === "perch") {
      const bob = Math.sin(b.ph) * 0.5;
      // flicking tail
      ctx.strokeStyle = rgb(c.wing); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-3, bob); ctx.lineTo(-7.5, bob + 1.2 + Math.sin(b.ph * 1.7) * 0.9); ctx.stroke();
      // body with pale breast
      ctx.fillStyle = rgb(c.body);
      ctx.beginPath(); ctx.ellipse(0, bob, 4, 3, -0.15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgb(c.breast);
      ctx.beginPath(); ctx.ellipse(1, bob + 1, 2.6, 1.9, 0.1, 0, Math.PI * 2); ctx.fill();
      // head, eye, beak
      ctx.fillStyle = rgb(c.body);
      ctx.beginPath(); ctx.arc(3.4, bob - 2.6, 2.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1c1c20"; ctx.fillRect(4, bob - 3.2, 0.9, 0.9);
      ctx.fillStyle = "#c9a23c";
      ctx.beginPath(); ctx.moveTo(5.3, bob - 2.8); ctx.lineTo(7.4, bob - 2.2); ctx.lineTo(5.3, bob - 1.6); ctx.closePath(); ctx.fill();
      // folded wing
      ctx.fillStyle = rgb(c.wing);
      ctx.beginPath(); ctx.ellipse(-0.6, bob - 0.4, 2.6, 1.5, -0.35, 0, Math.PI * 2); ctx.fill();
    } else {
      const flap = Math.sin(b.ph);
      ctx.fillStyle = rgb(c.body);
      ctx.beginPath(); ctx.ellipse(0, 0, 4, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(3.6, -1, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgb(c.wing); ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(-0.5, 0); ctx.quadraticCurveTo(-2, -flap * 5, -5, -flap * 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-3, 0.8); ctx.lineTo(-6.5, 0.8 + Math.sin(b.ph * 0.7)); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

// ---------- Trees ----------
function pickType(b, r) {
  const t = r();
  if (b.snow || b.deco==="frozen") return t<0.58?"fir":t<0.78?"pine":t<0.90?"birch":"dead";
  if (b.deco==="desert")   return t<0.64?"cactus":t<0.82?"dead":"petrified";
  if (b.deco==="volcano")  return t<0.68?"petrified":t<0.92?"dead":"cactus";
  if (b.deco==="corrupted") return t<0.70?"corrupt":t<0.88?"dead":"petrified";
  if (b.deco==="swamp")    return t<0.52?"mangrove":t<0.78?"crooked":t<0.92?"dead":t<0.98?"bush":"oak";
  return t<0.4?"pine":t<0.66?"fir":t<0.82?"oak":t<0.92?"widepine":"birch";
}

export function makeTree(x, baseH, r, opts = {}) {
  const b = biomeAt(x);
  let type = pickType(b, r);
  if (opts.harvestable && type === "dead" && !b.dry && !b.hot && !b.corrupt && b.deco !== "swamp") type = r() < 0.5 ? "fir" : "oak";
  const heightBoost = opts.harvestable ? 1.18 : 1;
  let h = baseH * heightBoost * (0.76+r()*0.56);
  if (type === "dead") h *= 0.82;
  if (type === "cactus") h *= 0.62 + r() * 0.18;
  if (type === "petrified") h *= 0.72 + r() * 0.2;
  if (type === "corrupt") h *= 0.95 + r() * 0.2;
  if (type === "mangrove") h *= 0.9;
  const w = (type==="widepine"?h*0.74:
    (type==="oak"||type==="bush"||type==="mangrove")?h*0.82:
    type==="cactus"?h*0.34:
    type==="petrified"?h*0.38:
    (type==="dead"||type==="corrupt")?h*0.46:h*0.52) * (0.82+r()*0.4);
  const tiers = 3+((r()*4)|0), lean = (r()-0.5)*(type==="crooked"||type==="corrupt"?0.5:0.16);
  let clusters=null, branches=null, arms=null, roots=null, cracks=null, crystals=null;
  if (type==="oak"||type==="bush"||type==="crooked"||type==="birch"||type==="mangrove") {
    clusters=[];
    const n=type==="bush"?8:type==="birch"?8:type==="mangrove"?12:9+((r()*5)|0), cy=type==="bush"?0.34:type==="birch"?0.84:type==="mangrove"?0.62:0.74;
    const bottomClearance=type==="bush"?0.04:type==="birch"?0.24:type==="mangrove"?0.08:0.20;
    for (let i=0;i<n;i++) {
      const ring = i / Math.max(1, n - 1);
      const clr = (0.20+r()*0.20)*w*(type==="birch"?0.95:1);
      const dy = Math.max(cy-r()*(type==="birch"?0.22:0.42) + Math.sin(i*2.1)*0.035, clr/h + bottomClearance);
      clusters.push({ dx:(r()-0.5)*w*(0.55+ring*0.45), dy, r:clr });
    }
  }
  if (type==="dead" || type==="petrified" || type==="corrupt") {
    branches=[];
    const n=type==="corrupt"?5+((r()*4)|0):3+((r()*4)|0);
    for (let i=0;i<n;i++) branches.push({ hf:0.30+r()*0.62, side:r()<0.5?-1:1, len:(0.16+r()*0.28)*h, up:type==="corrupt"?0.08+r()*0.52:0.3+r()*0.5, broken:r()<0.42 });
  }
  if (type==="cactus") {
    arms=[];
    const n=1+((r()*3)|0);
    for (let i=0;i<n;i++) arms.push({ hf:0.34+r()*0.42, side:r()<0.5?-1:1, len:(0.16+r()*0.14)*h, lift:(0.18+r()*0.22)*h });
  }
  if (type==="mangrove") {
    roots=[];
    for (let i=0;i<6;i++) roots.push({ side:r()<0.5?-1:1, len:(0.08+r()*0.18)*h, spread:(0.15+r()*0.22)*w });
  }
  if (type==="petrified" || type==="corrupt") {
    cracks=[];
    const n=type==="corrupt"?4+((r()*4)|0):3+((r()*3)|0);
    for (let i=0;i<n;i++) cracks.push({ hf:0.14+r()*0.68, side:r()<0.5?-1:1, len:0.06+r()*0.12 });
  }
  if (type==="corrupt") {
    crystals=[];
    for (let i=0;i<3;i++) crystals.push({ hf:0.18+r()*0.74, side:r()<0.5?-1:1, s:0.5+r()*0.8 });
  }
  return {
    x, type, h, w, phase:r()*6, tiers, lean, trunkW:0.08+r()*0.035,
    broken:r()<0.16, snow:b.snow&&r()<0.85, moss:b.moss&&r()<(b.deco==="swamp"?0.94:0.6),
    hot:!!b.hot, corrupt:!!b.corrupt, clusters, branches, arms, roots, cracks, crystals,
  };
}

// Offscreen cache for cluster canopies (oak/bush/crooked/birch). Keyed on a
// quantized lighting bucket so sprites re-bake as day/night shifts, not per frame.
const canopySpriteCache = new WeakMap();
function drawCanopySprite(t, cx, baseY, light, dark, Ht, sw) {
  let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9,avgDy=0;
  for (const cl of t.clusters) {
    minX=Math.min(minX,cl.dx-cl.r); maxX=Math.max(maxX,cl.dx+cl.r);
    minY=Math.min(minY,-cl.dy*Ht-cl.r); maxY=Math.max(maxY,-cl.dy*Ht+cl.r);
    avgDy+=cl.dy;
  }
  avgDy/=t.clusters.length;
  const key=`${light[0]>>3},${light[1]>>3},${light[2]>>3},${dark[0]>>3},${dark[1]>>3},${dark[2]>>3},${t.snow?1:0}`;
  let c=canopySpriteCache.get(t);
  if (!c || c.key!==key) {
    const S=2, pad=3; // 2x supersampling so zoomed-in trees stay crisp
    const cv=c?c.cv:document.createElement("canvas");
    cv.width=Math.ceil((maxX-minX+pad*2)*S); cv.height=Math.ceil((maxY-minY+pad*2)*S);
    const g=cv.getContext("2d");
    g.scale(S,S); g.translate(pad-minX,pad-minY);
    const path=()=>{ g.beginPath(); for (const cl of t.clusters){ const ox=cl.dx, oy=-cl.dy*Ht; g.moveTo(ox+cl.r,oy); g.arc(ox,oy,cl.r,0,Math.PI*2); } };
    path(); g.fillStyle=withA(dark,1); g.fill();
    path(); g.clip();
    // deep shade on the underside of the canopy
    g.fillStyle=withA(shade(dark,0.72),0.45); g.beginPath();
    for (const cl of t.clusters){ const ox=cl.dx+cl.r*0.26, oy=-cl.dy*Ht+cl.r*0.34; g.moveTo(ox+cl.r*0.85,oy); g.arc(ox,oy,cl.r*0.85,0,Math.PI*2); }
    g.fill();
    // lit side toward the sun
    g.fillStyle=withA(light,0.45); g.beginPath();
    for (const cl of t.clusters){ const ox=cl.dx-cl.r*0.3, oy=-cl.dy*Ht-cl.r*0.34; g.moveTo(ox+cl.r*0.78,oy); g.arc(ox,oy,cl.r*0.78,0,Math.PI*2); }
    g.fill();
    // dappled sun spots on the crown
    g.fillStyle=withA(shade(light,1.18),0.25); g.beginPath();
    for (const cl of t.clusters){ const ox=cl.dx-cl.r*0.42, oy=-cl.dy*Ht-cl.r*0.46; g.moveTo(ox+cl.r*0.34,oy); g.arc(ox,oy,cl.r*0.34,0,Math.PI*2); }
    g.fill();
    if (t.snow) { g.fillStyle="rgba(238,244,251,0.85)"; g.beginPath();
      for (const cl of t.clusters){ const ox=cl.dx-cl.r*0.18, oy=-cl.dy*Ht-cl.r*0.46; g.moveTo(ox+cl.r*0.5,oy); g.arc(ox,oy,cl.r*0.5,0,Math.PI*2); }
      g.fill(); }
    c={key,cv,ox:minX-pad,oy:minY-pad};
    canopySpriteCache.set(t,c);
  }
  // whole canopy sways as one; per-cluster sway differences aren't visible
  ctx.drawImage(c.cv, cx+sw(avgDy)+c.ox, baseY+c.oy, c.cv.width/2, c.cv.height/2);
}

function drawCactusTree(t, cx, baseY, light, dark, Ht, Wd, sw) {
  const body = lerpColor(light, [72, 126, 78], 0.42);
  const shadeCol = lerpColor(dark, [30, 76, 50], 0.35);
  const hi = shade(body, 1.18);
  const trunkW = Math.max(8, Wd * 0.20);
  ctx.lineCap = "round";
  ctx.strokeStyle = withA(shadeCol, 1);
  ctx.lineWidth = trunkW;
  ctx.beginPath(); ctx.moveTo(cx, baseY - 2); ctx.lineTo(cx + sw(1) * 0.35, baseY - Ht); ctx.stroke();
  ctx.strokeStyle = withA(body, 1);
  ctx.lineWidth = trunkW * 0.72;
  ctx.beginPath(); ctx.moveTo(cx - trunkW * 0.08, baseY - 4); ctx.lineTo(cx + sw(1) * 0.25 - trunkW * 0.08, baseY - Ht + 2); ctx.stroke();
  for (const a of t.arms || []) {
    const bx = cx + sw(a.hf) * 0.25;
    const by = baseY - Ht * a.hf;
    const elbowX = bx + a.side * a.len;
    const elbowY = by;
    const tipY = by - a.lift;
    ctx.strokeStyle = withA(shadeCol, 1);
    ctx.lineWidth = trunkW * 0.68;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(elbowX, elbowY); ctx.lineTo(elbowX, tipY); ctx.stroke();
    ctx.strokeStyle = withA(body, 1);
    ctx.lineWidth = trunkW * 0.44;
    ctx.beginPath(); ctx.moveTo(bx, by - 1); ctx.lineTo(elbowX, elbowY - 1); ctx.lineTo(elbowX, tipY + 1); ctx.stroke();
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = withA(hi, 0.5);
  for (let i = 0; i < 7; i++) {
    const hf = (i + 1) / 8;
    const y = baseY - Ht * hf;
    const sx = cx + sw(hf) * 0.28;
    ctx.beginPath(); ctx.moveTo(sx - trunkW * 0.22, y); ctx.lineTo(sx - trunkW * 0.15, y - 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx + trunkW * 0.22, y + 1); ctx.lineTo(sx + trunkW * 0.14, y - 2); ctx.stroke();
  }
  if ((t.x | 0) % 3 === 0) {
    ctx.fillStyle = "#f0b2d0";
    ctx.beginPath(); ctx.arc(cx + sw(1) * 0.25, baseY - Ht - 3, 3.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = "butt";
}

function drawPetrifiedTree(t, cx, baseY, light, dark, Ht, Wd, sw) {
  const hot = t.hot;
  const corrupt = t.corrupt;
  const trunk = corrupt ? lerpColor(dark, [42, 26, 62], 0.5) : lerpColor(dark, [42, 38, 38], 0.55);
  const edge = corrupt ? [142, 84, 190] : hot ? [255, 100, 40] : shade(light, 1.05);
  const trunkW = Math.max(8, Wd * 0.19);
  ctx.lineCap = "round";
  ctx.strokeStyle = withA(trunk, 1);
  ctx.lineWidth = trunkW;
  ctx.beginPath();
  ctx.moveTo(cx, baseY);
  ctx.quadraticCurveTo(cx + sw(0.45) * 0.35, baseY - Ht * 0.5, cx + sw(1), baseY - Ht);
  ctx.stroke();
  ctx.strokeStyle = withA(shade(trunk, 1.35), 0.55);
  ctx.lineWidth = Math.max(2, trunkW * 0.28);
  ctx.beginPath();
  ctx.moveTo(cx - trunkW * 0.25, baseY - 5);
  ctx.quadraticCurveTo(cx - trunkW * 0.1 + sw(0.45) * 0.25, baseY - Ht * 0.5, cx + sw(1) - trunkW * 0.08, baseY - Ht + 8);
  ctx.stroke();
  ctx.strokeStyle = withA(trunk, 0.95);
  for (const br of t.branches || []) {
    const yy=baseY-br.hf*Ht, xx=cx+sw(br.hf), ex=xx+br.side*br.len, ey=yy-br.len*br.up;
    ctx.lineWidth=Math.max(1.5,Wd*0.08);
    ctx.beginPath(); ctx.moveTo(xx,yy); ctx.lineTo(ex,ey);
    if (!br.broken) ctx.lineTo(ex+br.side*br.len*0.25,ey-br.len*0.42);
    ctx.stroke();
  }
  ctx.save();
  ctx.globalCompositeOperation = hot || corrupt ? "lighter" : "source-over";
  ctx.strokeStyle = withA(edge, hot || corrupt ? 0.72 : 0.42);
  ctx.lineWidth = hot || corrupt ? 1.5 : 1;
  for (const cr of t.cracks || []) {
    const y = baseY - Ht * cr.hf;
    const x = cx + sw(cr.hf) + cr.side * trunkW * 0.18;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cr.side * trunkW * cr.len, y - Ht * 0.08); ctx.stroke();
  }
  ctx.restore();
  if (corrupt) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const c of t.crystals || []) {
      const x = cx + sw(c.hf) + c.side * trunkW * 0.7;
      const y = baseY - Ht * c.hf;
      const s = 7 * c.s;
      ctx.fillStyle = "rgba(178,100,255,0.9)";
      ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + c.side * s * 0.45, y); ctx.lineTo(x, y + s * 0.35); ctx.lineTo(x - c.side * s * 0.35, y); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  ctx.lineCap = "butt";
}

export function drawTree(t, cx, baseY, light, dark, depthDark, swayAmp) {
  const Ht=t.h, Wd=t.w, lean=t.lean;
  const sw = (hf) => windSway(t.phase, swayAmp)*Math.pow(clamp(hf,0,1),1.35) + lean*hf*Wd*0.7;
  const trunkCol = shade(dark, 0.68);
  const trunkHi = shade(trunkCol, 1.35);
  if (depthDark < 0.5) { ctx.save(); ctx.globalAlpha=0.16*(1-depthDark); ctx.fillStyle="#0a0810"; ctx.beginPath(); ctx.ellipse(cx,baseY-2,Wd*0.5*(1.15-depthDark),Wd*0.5*(1.15-depthDark)*0.26,0,0,Math.PI*2); ctx.fill(); ctx.restore(); }

  if (t.type==="cactus") {
    drawCactusTree(t, cx, baseY, light, dark, Ht, Wd, sw);
    return;
  }
  if (t.type==="petrified" || t.type==="corrupt") {
    drawPetrifiedTree(t, cx, baseY, light, dark, Ht, Wd, sw);
    return;
  }

  if (t.type==="pine"||t.type==="fir"||t.type==="widepine") {
    // tapered trunk
    const tw0 = Wd*(t.trunkW || 0.08), tw1 = tw0*0.38;
    ctx.fillStyle=withA(trunkCol,1);
    ctx.beginPath(); ctx.moveTo(cx-tw0,baseY); ctx.lineTo(cx+tw0,baseY);
    ctx.lineTo(cx+tw1,baseY-Ht*0.34); ctx.lineTo(cx-tw1,baseY-Ht*0.34); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=withA(trunkHi,0.35); ctx.lineWidth=Math.max(1,tw0*0.28);
    ctx.beginPath(); ctx.moveTo(cx-tw0*0.34,baseY-4); ctx.lineTo(cx-tw1*0.2,baseY-Ht*0.31); ctx.stroke();
    const skirt = Math.min(18, Ht*0.075);
    for (let i=0;i<t.tiers;i++) {
      const bhf=i/t.tiers, thf=(i+1)/t.tiers;
      const rootFlare = Math.pow(1-bhf, 1.6);
      // drop each tier's base into the one below so the silhouette stays connected
      const tw=Wd*(1-bhf*0.72)*0.55, by=Math.min(baseY-Ht*0.07, baseY-bhf*Ht+Ht*0.085+skirt*rootFlare), ty=baseY-thf*Ht;
      const bx=cx+sw(bhf), tx=cx+sw(thf);
      ctx.fillStyle=withA(dark,1); ctx.beginPath(); ctx.moveTo(bx-tw,by); ctx.lineTo(bx+tw,by); ctx.lineTo(tx,ty); ctx.closePath(); ctx.fill();
      // shaded facet away from the sun
      ctx.fillStyle=withA(shade(dark,0.74),0.55); ctx.beginPath(); ctx.moveTo(bx+tw,by); ctx.lineTo(bx+tw*0.22,by); ctx.lineTo(tx,ty); ctx.closePath(); ctx.fill();
      ctx.fillStyle=withA(light,0.5); ctx.beginPath(); ctx.moveTo(bx-tw,by); ctx.lineTo(bx-tw*0.16,by); ctx.lineTo(tx,ty); ctx.closePath(); ctx.fill();
      ctx.strokeStyle=withA(shade(light,1.12),0.25); ctx.lineWidth=Math.max(1,Wd*0.012);
      ctx.beginPath(); ctx.moveTo(bx-tw*0.72,by-Ht*0.012); ctx.lineTo(tx,ty+Ht*0.035); ctx.lineTo(bx+tw*0.46,by-Ht*0.01); ctx.stroke();
      if (t.snow) { ctx.fillStyle="rgba(238,244,251,0.92)"; ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(tx-tw*0.5,by-(by-ty)*0.5); ctx.lineTo(tx+tw*0.5,by-(by-ty)*0.5); ctx.closePath(); ctx.fill(); }
    }
    ctx.strokeStyle=withA(shade(trunkCol,0.72),0.45); ctx.lineWidth=Math.max(1.5,tw0*0.36); ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(cx,baseY+2); ctx.lineTo(cx+sw(0.82),baseY-Ht*0.82); ctx.stroke();
    ctx.strokeStyle=withA(trunkHi,0.18); ctx.lineWidth=Math.max(1,tw0*0.14);
    ctx.beginPath(); ctx.moveTo(cx-tw0*0.2,baseY-2); ctx.lineTo(cx+sw(0.62)-tw0*0.1,baseY-Ht*0.62); ctx.stroke();
    ctx.lineCap="butt";
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
    const trunkH=t.type==="bush"?Ht*0.12:t.type==="birch"?Ht*0.68:Ht*0.5;
    const tw=Wd*(t.trunkW || 0.09), isBirch=t.type==="birch";
    if (t.type==="mangrove") {
      ctx.strokeStyle=withA(shade(dark,0.62),0.95); ctx.lineWidth=Math.max(1.5,tw*0.72); ctx.lineCap="round";
      for (const root of t.roots || []) {
        const rx = cx + root.side * tw * 0.45;
        ctx.beginPath();
        ctx.moveTo(rx, baseY - Ht * 0.22);
        ctx.quadraticCurveTo(rx + root.side * root.spread * 0.35, baseY - Ht * 0.12, cx + root.side * root.spread, baseY + 2);
        ctx.stroke();
      }
      ctx.lineCap="butt";
    }
    ctx.strokeStyle=withA(isBirch?lerpColor(light,[232,234,236],0.55):trunkCol,1);
    ctx.lineWidth=Math.max(2,tw*2); ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(cx,baseY); ctx.lineTo(cx+sw(trunkH/Ht),baseY-trunkH); ctx.stroke();
    ctx.strokeStyle=isBirch?"rgba(255,255,255,0.5)":withA(trunkHi,0.35);
    ctx.lineWidth=Math.max(1,tw*0.38);
    ctx.beginPath(); ctx.moveTo(cx-tw*0.35,baseY-4); ctx.lineTo(cx+sw(trunkH/Ht)-tw*0.2,baseY-trunkH+4); ctx.stroke();
    ctx.lineCap="butt";
    if (isBirch) { ctx.strokeStyle="rgba(40,44,48,0.45)"; ctx.lineWidth=1; for (let k=1;k<4;k++){ const yy=baseY-trunkH*k/4; ctx.beginPath(); ctx.moveTo(cx-tw,yy); ctx.lineTo(cx+tw*0.4,yy); ctx.stroke(); } }
    if (t.type!=="bush") {
      ctx.strokeStyle=withA(trunkCol,0.62); ctx.lineWidth=Math.max(1,tw*0.7); ctx.lineCap="round";
      for (let i=0;i<Math.min(5,t.clusters.length);i++) {
        const cl=t.clusters[i], bx=cx+sw(trunkH/Ht), by=baseY-trunkH*0.72;
        ctx.beginPath(); ctx.moveTo(bx,by); ctx.quadraticCurveTo(cx+cl.dx*0.35,baseY-cl.dy*Ht+cl.r*0.2,cx+sw(cl.dy)+cl.dx*0.72,baseY-cl.dy*Ht+cl.r*0.08); ctx.stroke();
      }
      ctx.lineCap="butt";
    }
    // canopy silhouette + clipped shading is expensive (clip per tree per frame),
    // so it's baked to an offscreen sprite and re-baked only when lighting shifts
    drawCanopySprite(t, cx, baseY, light, dark, Ht, sw);
    if (t.moss && t.clusters?.length) {
      ctx.strokeStyle = withA(lerpColor(dark, [138, 148, 74], 0.48), 0.72);
      ctx.lineWidth = Math.max(1, Wd * 0.012);
      ctx.lineCap = "round";
      const n = Math.min(8, t.clusters.length);
      for (let i = 0; i < n; i++) {
        const cl = t.clusters[(i * 2) % t.clusters.length];
        const mx = cx + sw(cl.dy) + cl.dx * (0.55 + (i % 3) * 0.08);
        const my = baseY - cl.dy * Ht + cl.r * 0.35;
        const len = Math.min(Ht * 0.22, cl.r * (0.85 + ((t.x + i * 19) % 7) * 0.08));
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.quadraticCurveTo(mx + windSway(t.phase + i, swayAmp) * 0.18, my + len * 0.55, mx + ((i % 2) ? 3 : -3), my + len);
        ctx.stroke();
      }
      ctx.lineCap = "butt";
    }
  }
  if (t.broken&&t.type!=="dead") { ctx.strokeStyle=withA(trunkCol,1); ctx.lineWidth=Math.max(1.5,Wd*0.07); ctx.beginPath(); ctx.moveTo(cx,baseY-Ht*0.34); ctx.lineTo(cx+Wd*0.4,baseY-Ht*0.28); ctx.stroke(); }
  if (t.moss) { ctx.fillStyle="rgba(74,116,84,0.55)"; ctx.beginPath(); ctx.ellipse(cx,baseY-Ht*0.04,Wd*0.12,Ht*0.05,0,0,Math.PI*2); ctx.fill(); }
}

function drawLowDetailTree(t, cx, baseY, light, dark, depthDark, swayAmp) {
  const Ht = t.h, Wd = t.w;
  const sway = windSway(t.phase, swayAmp * 0.55);
  const trunkW = Math.max(2, Wd * 0.055);
  const trunkCol = shade(dark, 0.68);
  const leafCol = lerpColor(light, dark, 0.46);

  if (depthDark < 0.5) {
    ctx.fillStyle = "rgba(10,8,16,0.10)";
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 1, Wd * 0.42, Wd * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (t.type === "dead") {
    ctx.strokeStyle = withA(trunkCol, 0.95);
    ctx.lineWidth = Math.max(2, Wd * 0.07);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, baseY);
    ctx.lineTo(cx + sway, baseY - Ht * 0.82);
    ctx.stroke();
    ctx.lineWidth = Math.max(1.2, Wd * 0.045);
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      const y = baseY - Ht * (0.42 + i * 0.18);
      const x = cx + sway * (0.42 + i * 0.18);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + side * Wd * 0.28, y - Ht * 0.12);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    return;
  }

  if (t.type === "cactus") {
    ctx.strokeStyle = withA(lerpColor(light, [72, 126, 78], 0.5), 0.95);
    ctx.lineWidth = Math.max(5, Wd * 0.12);
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx, baseY); ctx.lineTo(cx + sway * 0.3, baseY - Ht * 0.82); ctx.stroke();
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      const y = baseY - Ht * (0.38 + i * 0.16);
      ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx + side * Wd * 0.22, y); ctx.lineTo(cx + side * Wd * 0.22, y - Ht * 0.16); ctx.stroke();
    }
    ctx.lineCap = "butt";
    return;
  }

  if (t.type === "petrified" || t.type === "corrupt") {
    ctx.strokeStyle = withA(t.corrupt ? [58, 34, 78] : [54, 48, 46], 0.96);
    ctx.lineWidth = Math.max(4, Wd * 0.1);
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx, baseY); ctx.lineTo(cx + sway * 0.8, baseY - Ht * 0.9); ctx.stroke();
    ctx.lineWidth = Math.max(1.2, Wd * 0.04);
    ctx.strokeStyle = withA(t.corrupt ? [170, 100, 255] : t.hot ? [255, 110, 50] : [150, 132, 120], 0.55);
    ctx.beginPath(); ctx.moveTo(cx + sway * 0.2, baseY - Ht * 0.25); ctx.lineTo(cx + sway * 0.5 + Wd * 0.12, baseY - Ht * 0.38); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + sway * 0.45, baseY - Ht * 0.55); ctx.lineTo(cx + sway * 0.65 - Wd * 0.1, baseY - Ht * 0.7); ctx.stroke();
    ctx.lineCap = "butt";
    return;
  }

  ctx.fillStyle = withA(trunkCol, 0.9);
  ctx.fillRect(cx - trunkW * 0.5, baseY - Ht * 0.48, trunkW, Ht * 0.5);

  if (t.type === "pine" || t.type === "fir" || t.type === "widepine") {
    ctx.fillStyle = withA(leafCol, 0.96);
    for (let i = 0; i < 3; i++) {
      const y = baseY - Ht * (0.18 + i * 0.22);
      const top = baseY - Ht * (0.48 + i * 0.18);
      const w = Wd * (0.58 - i * 0.1);
      const sx = cx + sway * (0.35 + i * 0.2);
      ctx.beginPath();
      ctx.moveTo(sx, top);
      ctx.lineTo(cx - w, y);
      ctx.lineTo(cx + w, y);
      ctx.closePath();
      ctx.fill();
    }
    if (t.snow) {
      ctx.fillStyle = "rgba(238,244,251,0.62)";
      ctx.beginPath();
      ctx.moveTo(cx + sway * 0.7, baseY - Ht * 0.95);
      ctx.lineTo(cx - Wd * 0.19, baseY - Ht * 0.64);
      ctx.lineTo(cx + Wd * 0.18, baseY - Ht * 0.64);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }

  ctx.fillStyle = withA(leafCol, 0.96);
  const cy = baseY - Ht * (t.type === "bush" ? 0.28 : 0.7);
  const sy = t.type === "bush" ? Ht * 0.12 : Ht * 0.2;
  ctx.beginPath();
  ctx.ellipse(cx + sway * 0.35, cy, Wd * 0.45, sy, 0, 0, Math.PI * 2);
  ctx.ellipse(cx - Wd * 0.18 + sway * 0.2, cy + sy * 0.16, Wd * 0.28, sy * 0.78, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + Wd * 0.2 + sway * 0.45, cy + sy * 0.12, Wd * 0.26, sy * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
}

function layerTreeForBiome(t, b) {
  if (b.deco!=="desert" && b.deco!=="volcano" && b.deco!=="corrupted") return t;
  const seed = Math.abs(Math.sin(t.x * 12.9898 + t.phase * 78.233));
  const type = b.deco==="desert" ? "cactus" : b.deco==="volcano" ? "petrified" : "corrupt";
  const h = t.h * (type==="cactus" ? 0.58 : type==="petrified" ? 0.82 : 0.96);
  const w = t.w * (type==="cactus" ? 0.44 : 0.52);
  const out = {
    ...t, type, h, w,
    snow:false, moss:false, hot:!!b.hot, corrupt:!!b.corrupt,
    clusters:null, arms:null, branches:null, cracks:null, crystals:null,
  };
  if (type==="cactus") {
    out.arms = [
      { hf:0.38 + (seed % 0.2), side:seed > 0.45 ? 1 : -1, len:h*0.2, lift:h*0.2 },
      { hf:0.54 + ((seed * 1.7) % 0.16), side:seed > 0.7 ? -1 : 1, len:h*0.16, lift:h*0.16 },
    ];
  } else {
    out.branches = [];
    for (let i=0;i<5;i++) out.branches.push({
      hf:0.28 + ((seed + i * 0.17) % 0.58),
      side:((t.x + i * 37) | 0) % 2 ? 1 : -1,
      len:h * (0.12 + ((seed + i * 0.11) % 0.16)),
      up:type==="corrupt" ? 0.1 + ((seed + i * 0.07) % 0.4) : 0.35 + ((seed + i * 0.09) % 0.38),
      broken:i % 2 === 0,
    });
    out.cracks = [];
    for (let i=0;i<4;i++) out.cracks.push({
      hf:0.18 + ((seed + i * 0.19) % 0.62),
      side:i % 2 ? 1 : -1,
      len:0.08 + ((seed + i * 0.13) % 0.08),
    });
    if (type==="corrupt") {
      out.crystals = [];
      for (let i=0;i<3;i++) out.crystals.push({
        hf:0.22 + ((seed + i * 0.21) % 0.58),
        side:i % 2 ? 1 : -1,
        s:0.5 + ((seed + i * 0.2) % 0.8),
      });
    }
  }
  return out;
}

export function drawTreeLayer(trees, factor, depthDark, swayAmp, alpha=1) {
  const dark=darkness(), haze=hazeColor(dark), off=Game.cam*factor;
  const lowDetailLayer = factor <= 0.7;
  const cameraBiome = biomeAt(Game.cam + W / 2);
  if (alpha<1) { ctx.save(); ctx.globalAlpha=alpha; }
  for (let i = 0; i < trees.length; i++) {
    const t = trees[i];
    const px=t.x-off; if (px<-140||px>W+140) continue;
    const visualTree = factor < 1 ? layerTreeForBiome(t, cameraBiome) : t;
    const b=factor < 1 ? cameraBiome : biomeAt(t.x);
    const light = atmo(b.treeL,haze,depthDark);
    const darkCol = atmo(b.treeD,haze,depthDark);
    if (lowDetailLayer) drawLowDetailTree(visualTree, px, groundY+4, light, darkCol, depthDark, swayAmp);
    else drawTree(visualTree, px, groundY+4, light, darkCol, depthDark, swayAmp);
  }
  if (alpha<1) ctx.restore();
}

let treeCache = null;
function biomeCacheKey() {
  return `${Game.treeSeed || 1}:${activeBiomeId()}:${Game.worldPhase || 1}`;
}

function biomeTreeDensity(x) {
  const b = biomeAt(x);
  if (b.deco==="desert") return 0.34;
  if (b.deco==="volcano") return 0.46;
  if (b.deco==="corrupted") return 0.66;
  if (b.deco==="frozen") return 0.72;
  if (b.deco==="swamp") return 1.08;
  return 1;
}

export function getTrees() {
  const key = biomeCacheKey();
  if (treeCache && treeCache.key===key) return treeCache;
  const r=mulberry32(Game.treeSeed||1);
  const far=[],mid=[],near=[],fore=[],hills=[],mountains=[];
  const campX = CFG.baseX;
  // occasional giants poke above each canopy layer so the treeline isn't a flat band
  for (let x=-140;x<CFG.worldWidth+140;x+=96)  { const tx=x+r()*70; if(Math.abs(tx-campX)>260 && r()<biomeTreeDensity(tx)) far.push(makeTree(tx, r()<0.08?250:165, r)); }
  for (let x=-120;x<CFG.worldWidth+120;x+=82)  { const tx=x+r()*58; if(Math.abs(tx-campX)>300 && r()<biomeTreeDensity(tx)) mid.push(makeTree(tx, r()<0.08?330:225, r)); }
  for (let x=-100;x<CFG.worldWidth+100;x+=74)  { const tx=x+r()*48; if(Math.abs(tx-campX)>380 && r()<biomeTreeDensity(tx)) near.push(makeTree(tx, r()<0.1?405:285, r)); }
  for (let x=-100;x<CFG.worldWidth+100;x+=520) { const tx=x+r()*220; if(Math.abs(tx-campX)>700 && r()<biomeTreeDensity(tx)) fore.push(makeTree(tx, 150, r)); }
  for (let x=-300;x<CFG.worldWidth+300;x+=170) hills.push({ x:x+r()*120, h:50+r()*130, w:200+r()*230 });
  treeCache={ key, seed:Game.treeSeed, far, mid, near, fore, hills, mountains };
  return treeCache;
}
export function clearTreeCache() { treeCache=null; decoCache=null; groundTexCache=null; }

// ---------- Ground decoration cache ----------
let decoCache=null;
export function getDeco() {
  const key = biomeCacheKey();
  if (decoCache&&decoCache.key===key) return decoCache;
  const r=mulberry32((Game.treeSeed||1)*7+13);
  const items=[];
  for (let x=60;x<CFG.worldWidth-60;x+=15+r()*26) {
    if (Math.abs(x - CFG.baseX) < 650) { r(); continue; } // clear deco near camp
    const b=biomeAt(x), t=r();
    let kind;
    if      (b.deco==="frozen" || b.snow) kind=t<0.42?"snowtuft":(t<0.58?"iceShard":(t<0.74?"stone":(t<0.88?"tallgrass":"stump")));
    else if (b.deco==="desert")   kind=t<0.28?"drygrass":(t<0.44?"sandstone":(t<0.58?"smallCactus":(t<0.72?"stone":(t<0.88?"dustPatch":"deadRoot"))));
    else if (b.deco==="swamp")    kind=t<0.26?"reed":(t<0.48?"bogBubble":(t<0.62?"deadRoot":(t<0.74?"mushroom":(t<0.86?"fern":(t<0.94?"tallgrass":"stone")))));
    else if (b.deco==="volcano")  kind=t<0.30?"lavaCrack":(t<0.48?"obsidian":(t<0.66?"ashVent":(t<0.82?"stone":"deadRoot")));
    else if (b.deco==="corrupted") kind=t<0.34?"corruptShard":(t<0.52?"deadRoot":(t<0.68?"mushroom":(t<0.82?"obsidian":(t<0.93?"tallgrass":"stone"))));
    else                          kind=t<0.34?"grass":(t<0.50?"flower":(t<0.62?"tallgrass":(t<0.72?"bush":(t<0.80?"fern":(t<0.88?"stone":(t<0.95?"grass":"sapling"))))));
    items.push({ x, kind, s:0.7+r()*0.8, ph:r()*6, leaf:b.leaf, flower:["#e58fb0","#f2c14e","#cfe6f2","#e87b5a"][(r()*4)|0], berry:r()<0.45 });
  }
  decoCache={key, seed:Game.treeSeed, items};
  return decoCache;
}

let groundTexCache=null;
export function getGroundTex() {
  const key = biomeCacheKey();
  if (groundTexCache&&groundTexCache.key===key) return groundTexCache;
  const r=mulberry32((Game.treeSeed||1)*13+7);
  const fringe=[],patches=[],pebbles=[],specks=[];
  for (let x=0;x<CFG.worldWidth;x+=8+r()*10) fringe.push({x, h:6+r()*11, ph:r()*6, lt:r()<0.4});
  for (let x=0;x<CFG.worldWidth;x+=24+r()*38) patches.push({x, dy:r()*60, r:9+r()*24, light:r()<0.5});
  for (let x=0;x<CFG.worldWidth;x+=28+r()*56) pebbles.push({x, dy:8+r()*70, r:1.4+r()*3});
  for (let x=0;x<CFG.worldWidth;x+=7+r()*12)  specks.push({x, dy:14+r()*85, r:0.6+r()*1.5, light:r()<0.3});
  groundTexCache={key, seed:Game.treeSeed, fringe, patches, pebbles, specks};
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
    if (s.s>1.5) { // bright stars get a faint cross glint
      ctx.globalAlpha=dark*tw*0.4;
      ctx.fillRect(s.x-s.s, s.y+s.s*0.3, s.s*3, s.s*0.4);
      ctx.fillRect(s.x+s.s*0.3, s.y-s.s, s.s*0.4, s.s*3);
    }
  }
  ctx.restore();
}


export function drawClouds(dark, top) {
  const a=(1-dark)*0.9; if (a<=0.02) return;
  const t=Game.time, duskDawn=Math.max(0, 1-Math.abs(t-0.585)/0.09) + Math.max(0, 1-Math.abs(t-0.955)/0.06);
  // clouds pick up warm light at dusk/dawn, cool ambient otherwise
  const lit  = lerpColor(lerpColor(top,[255,255,255],0.62), [255,196,138], Math.min(1,duskDawn)*0.7);
  const base = lerpColor(top,[255,255,255],0.42);
  const shad = lerpColor(lerpColor(top,[110,120,150],0.5), [180,96,110], Math.min(1,duskDawn)*0.45);
  ctx.save();
  for (const c of FX.clouds) {
    const s=c.s, ca=a*c.o;
    if (c.far) { // distant haze band: single flattened pass
      ctx.globalAlpha=ca; ctx.fillStyle=rgb(base);
      for (const [dx,dy,r] of c.puffs) { ctx.beginPath(); ctx.ellipse(c.x+dx*s,c.y+dy*s*0.5,r*s*1.25,r*s*0.32,0,0,Math.PI*2); ctx.fill(); }
      continue;
    }
    // shadowed underside
    ctx.globalAlpha=ca*0.8; ctx.fillStyle=rgb(shad);
    for (const [dx,dy,r] of c.puffs) { ctx.beginPath(); ctx.ellipse(c.x+dx*s,c.y+(dy+3.5)*s,r*s,r*s*0.62,0,0,Math.PI*2); ctx.fill(); }
    // main body
    ctx.globalAlpha=ca; ctx.fillStyle=rgb(base);
    for (const [dx,dy,r] of c.puffs) { ctx.beginPath(); ctx.ellipse(c.x+dx*s,c.y+dy*s,r*s,r*s*0.62,0,0,Math.PI*2); ctx.fill(); }
    // sun-lit tops
    ctx.globalAlpha=ca*0.85; ctx.fillStyle=rgb(lit);
    for (const [dx,dy,r] of c.puffs) { ctx.beginPath(); ctx.ellipse(c.x+dx*s-r*s*0.1,c.y+(dy-2.6)*s,r*s*0.72,r*s*0.4,0,0,Math.PI*2); ctx.fill(); }
  }
  ctx.restore();
}

export function drawCelestials(dark) {
  const t=Game.time;
  // dusk/dawn horizon glow
  const duskDawn=Math.max(0, 1-Math.abs(t-0.585)/0.1) + Math.max(0, 1-Math.abs(t-0.955)/0.07);
  if (duskDawn>0.02) {
    const g=ctx.createLinearGradient(0,groundY*0.45,0,groundY+10);
    g.addColorStop(0,"rgba(255,150,80,0)");
    g.addColorStop(1,`rgba(255,158,88,${Math.min(1,duskDawn)*0.34})`);
    ctx.fillStyle=g; ctx.fillRect(0,groundY*0.45,W,groundY*0.55+10);
  }
  ctx.save();
  // sun: rises at dawn (t~0.95), sets at dusk (t~0.6)
  const sunT = t<0.62 ? (t+0.05)/0.67 : t>0.93 ? (t-0.93)/0.67 : -1;
  if (sunT>=0 && sunT<=1) {
    const sx=W*(0.06+0.88*sunT), sy=groundY*0.86 - Math.sin(sunT*Math.PI)*groundY*0.72;
    const low=1-Math.sin(sunT*Math.PI); // near horizon
    const glow=ctx.createRadialGradient(sx,sy,4,sx,sy,90+low*60);
    glow.addColorStop(0,`rgba(255,${232-low*80|0},${170-low*90|0},0.55)`);
    glow.addColorStop(1,"rgba(255,200,120,0)");
    ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(sx,sy,90+low*60,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=low>0.55?"#ffb45e":"#fff3c8";
    ctx.beginPath(); ctx.arc(sx,sy,15+low*7,0,Math.PI*2); ctx.fill();
  }
  // moon during night
  if (dark>0.05) {
    const nt=clamp((t-0.58)/0.36,0,1);
    const mx=W*(0.1+0.8*nt), my=groundY*0.7 - Math.sin(nt*Math.PI)*groundY*0.5;
    ctx.globalAlpha=dark;
    const glow=ctx.createRadialGradient(mx,my,6,mx,my,70);
    glow.addColorStop(0,"rgba(210,222,255,0.35)"); glow.addColorStop(1,"rgba(210,222,255,0)");
    ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(mx,my,70,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#e8edf8"; ctx.beginPath(); ctx.arc(mx,my,13,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(180,192,214,0.6)";
    for (const [cx,cy,cr] of [[-4,-3,2.6],[4,2,1.8],[-1,5.5,1.5],[5,-5,1.2]]) { ctx.beginPath(); ctx.arc(mx+cx,my+cy,cr,0,Math.PI*2); ctx.fill(); }
    // crescent shadow bite
    ctx.fillStyle="rgba(24,24,52,0.55)"; ctx.beginPath(); ctx.arc(mx+6,my-4,11,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
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
    const hillCol=lerpColor(atmo(b.gT,haze,0.9),b.snow?[236,241,248]:haze,b.snow?0.5:0.22);
    if (b.deco==="desert") {
      ctx.fillStyle=rgb(lerpColor([198,150,82],[74,48,30],dark));
      ctx.beginPath();
      ctx.moveTo(px-h.w,groundY+6);
      ctx.quadraticCurveTo(px-h.w*0.45,groundY-h.h*0.34,px+h.w*0.15,groundY-h.h*0.12);
      ctx.quadraticCurveTo(px+h.w*0.55,groundY-h.h*0.02,px+h.w,groundY+6);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle=withA(lerpColor([238,190,112],[96,66,42],dark),0.34);
      ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(px-h.w*0.72,groundY-h.h*0.12); ctx.quadraticCurveTo(px-h.w*0.18,groundY-h.h*0.24,px+h.w*0.34,groundY-h.h*0.06); ctx.stroke();
      continue;
    }
    if (b.deco==="volcano") {
      const rock=lerpColor([64,54,54],[18,16,20],dark);
      ctx.fillStyle=rgb(rock);
      ctx.beginPath();
      ctx.moveTo(px-h.w,groundY+8);
      ctx.lineTo(px-h.w*0.42,groundY-h.h*0.36);
      ctx.lineTo(px-h.w*0.12,groundY-h.h*0.28);
      ctx.lineTo(px+h.w*0.08,groundY-h.h*0.86);
      ctx.lineTo(px+h.w*0.34,groundY-h.h*0.24);
      ctx.lineTo(px+h.w,groundY+8);
      ctx.closePath(); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation="lighter";
      ctx.strokeStyle=withA([255,92,36],0.34+0.18*Math.sin(Game.windT+h.x));
      ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.moveTo(px+h.w*0.08,groundY-h.h*0.82); ctx.lineTo(px+h.w*0.02,groundY-h.h*0.48); ctx.lineTo(px+h.w*0.16,groundY-h.h*0.18); ctx.stroke();
      ctx.restore();
      continue;
    }
    if (b.deco==="corrupted") {
      const col=lerpColor([46,36,62],[14,12,22],dark);
      ctx.fillStyle=rgb(col);
      ctx.beginPath(); ctx.moveTo(px-h.w,groundY+8);
      for (let i=0;i<5;i++) {
        const t=i/4, sx=px-h.w+t*h.w*2;
        const spike=groundY-h.h*(0.18+0.62*Math.abs(Math.sin(h.x*0.01+i)));
        ctx.lineTo(sx-h.w*0.11,groundY-h.h*0.15);
        ctx.lineTo(sx,spike);
        ctx.lineTo(sx+h.w*0.11,groundY-h.h*0.18);
      }
      ctx.lineTo(px+h.w,groundY+8); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation="lighter";
      ctx.strokeStyle=withA([178,92,255],0.24);
      ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(px-h.w*0.4,groundY-h.h*0.25); ctx.lineTo(px-h.w*0.2,groundY-h.h*0.58); ctx.lineTo(px,groundY-h.h*0.2); ctx.stroke();
      ctx.restore();
      continue;
    }
    if (b.deco==="swamp") {
      ctx.fillStyle=rgb(lerpColor(atmo(b.gT,haze,0.9),[18,28,24],dark*0.7));
      ctx.beginPath(); ctx.moveTo(px-h.w,groundY+5); ctx.quadraticCurveTo(px-h.w*0.35,groundY-h.h*0.22,px,groundY-h.h*0.14); ctx.quadraticCurveTo(px+h.w*0.5,groundY-h.h*0.3,px+h.w,groundY+5); ctx.closePath(); ctx.fill();
      ctx.fillStyle=withA(lerpColor(b.fog,[20,22,36],dark),0.16);
      ctx.beginPath(); ctx.ellipse(px,groundY-h.h*0.08,h.w*0.72,12,0,0,Math.PI*2); ctx.fill();
      continue;
    }
    ctx.fillStyle=rgb(hillCol);
    ctx.beginPath(); ctx.moveTo(px-h.w,groundY+4); ctx.quadraticCurveTo(px,groundY+4-h.h,px+h.w,groundY+4); ctx.closePath(); ctx.fill();
    if (b.snow) { ctx.fillStyle="rgba(245,248,252,0.7)"; ctx.beginPath(); ctx.moveTo(px-h.w*0.3,groundY+4-h.h*0.7); ctx.quadraticCurveTo(px,groundY+4-h.h,px+h.w*0.3,groundY+4-h.h*0.7); ctx.lineTo(px,groundY+4-h.h*0.45); ctx.closePath(); ctx.fill(); }
    else {
      // faint conifer silhouettes along the crest
      ctx.fillStyle=withA(shade(hillCol,0.85),0.85);
      for (let i=-3;i<=3;i++) {
        const t=i*0.2, tx=px+t*h.w;
        const ty=groundY+4-h.h*0.5*(1-t*t)+2;
        const s=6+((i*i+((h.x|0)%5))%3)*3;
        ctx.beginPath(); ctx.moveTo(tx-s*0.55,ty); ctx.lineTo(tx,ty-s*1.9); ctx.lineTo(tx+s*0.55,ty); ctx.closePath(); ctx.fill();
      }
    }
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

function fogHash(n){ const s=Math.sin(n*127.1)*43758.5453; return s-Math.floor(s); }

export function drawLowFog(dark, bi) {
  return; // TEMP: fog disabled for FPS testing
  const inten=bi.deco==="swamp"?0.5:bi.snow?0.4:bi.deco==="dark"?0.32:0.2;
  const a=inten*(0.5+0.2*Math.sin(Game.windT*0.3));
  const col=lerpColor(bi.fog,[18,20,36],dark);
  // uniform ground haze (screen-space band; no visible anchor, so camera-following is fine)
  const grad=ctx.createLinearGradient(0,groundY-70,0,groundY+30);
  grad.addColorStop(0,withA(col,0)); grad.addColorStop(0.7,withA(col,a*0.7)); grad.addColorStop(1,withA(col,a));
  ctx.fillStyle=grad; ctx.fillRect(0,groundY-70,W,100);

  // world-anchored fog wisps: soft radial puffs pinned to world positions,
  // drifting slowly with the wind instead of riding along with the camera
  const zoom=Game.zoom||1;
  const layers=[
    { seg:360, drift:7,  rx:190, ry:24, lift:16, aMul:0.5, salt:0 },
    { seg:230, drift:13, rx:120, ry:15, lift:5,  aMul:0.75, salt:57 },
  ];
  for (const L of layers) {
    const off=Game.windT*L.drift;
    const worldL=Game.cam+W/2-(W/2+L.rx*2)/zoom, worldR=Game.cam+W/2+(W/2+L.rx*2)/zoom;
    const i0=Math.floor((worldL-off)/L.seg)-1, i1=Math.ceil((worldR-off)/L.seg)+1;
    for (let i=i0;i<=i1;i++) {
      const h1=fogHash(i*3.7+L.salt), h2=fogHash(i*9.1+L.salt+11), h3=fogHash(i*5.3+L.salt+29);
      const wob=Math.sin(Game.windT*(0.15+0.2*h2)+h1*6.28)*26;
      const wx=i*L.seg+h1*L.seg+off+wob;
      const sx=W/2+(wx-W/2-Game.cam)*zoom;
      const rx=L.rx*(0.7+0.7*h2)*zoom, ry=L.ry*(0.7+0.6*h3)*zoom;
      if (sx<-rx||sx>W+rx) continue;
      const pa=a*L.aMul*(0.55+0.45*Math.sin(Game.windT*(0.2+0.3*h3)+h2*6.28));
      if (pa<=0.01) continue;
      const cy=groundY-(L.lift+h3*20)*zoom;
      const pcol=lerpColor(biomeAt(wx).fog,[18,20,36],dark);
      const g=ctx.createRadialGradient(sx,cy,0,sx,cy,rx);
      g.addColorStop(0,withA(pcol,pa)); g.addColorStop(0.55,withA(pcol,pa*0.55)); g.addColorStop(1,withA(pcol,0));
      ctx.save(); ctx.translate(sx,cy); ctx.scale(1,ry/rx); ctx.translate(-sx,-cy);
      ctx.fillStyle=g; ctx.fillRect(sx-rx,cy-rx,rx*2,rx*2);
      ctx.restore();
    }
  }
}

export function drawAmbientFront(dark, bi) {
  const budget = renderBudget();
  const every = Math.max(1, budget.ambientEvery || 1);
  const lowDetail = budget.groundDetail === 0;

  ctx.save();
  for (let i = 0; i < FX.dust.length; i += every) {
    const d = FX.dust[i];
    ctx.globalAlpha=(0.10+0.16*d.z)*(0.5+0.5*(1-dark));
    ctx.fillStyle=dark>0.5?"rgba(180,190,220,1)":"rgba(255,250,230,1)";
    const s=1+d.z*1.5;
    ctx.fillRect(d.x,d.y,s,s);
  }
  ctx.restore();
  if (!lowDetail && dark<0.5 && !bi.dry && !bi.hot && !bi.corrupt) {
    for (const bf of FX.butter) {
      const w=Math.abs(Math.sin(bf.ph*6));
      ctx.globalAlpha=1-dark*2;
      if (ctx.globalAlpha<=0) continue;
      ctx.fillStyle=bf.c;
      ctx.beginPath();
      ctx.ellipse(bf.x-2,bf.y,3,1.4+w*1.6,0,0,Math.PI*2);
      ctx.ellipse(bf.x+2,bf.y,3,1.4+w*1.6,0,0,Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  if (!lowDetail && dark>0.4 && (bi.wet || bi.corrupt) && !bi.hot) {
    ctx.save();
    ctx.globalCompositeOperation="lighter";
    for (let i = 0; i < FX.flies.length; i += every) {
      const f = FX.flies[i];
      const tw=0.4+0.6*Math.abs(Math.sin(f.ph*3));
      ctx.globalAlpha=tw*dark;
      ctx.fillStyle="rgba(190,255,120,0.9)";
      ctx.beginPath();
      ctx.arc(f.x,f.y,1.7,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }
  for (let i = 0; i < FX.fall.length; i += every) {
    const p = FX.fall[i];
    if (!p.active) continue;
    ctx.globalAlpha=0.85;
    if (p.kind==="snow" || p.snow) {
      ctx.fillStyle=p.color;
      ctx.beginPath();
      ctx.arc(p.x,p.y,1.8,0,Math.PI*2);
      ctx.fill();
    } else if (p.kind==="ash" || p.kind==="dust" || p.kind==="spore") {
      ctx.globalAlpha = p.kind==="spore" ? 0.65 : 0.45;
      ctx.fillStyle=p.color;
      ctx.beginPath();
      ctx.ellipse(p.x,p.y,p.kind==="dust"?3.2:2.1,p.kind==="dust"?1.2:1.6,0,0,Math.PI*2);
      ctx.fill();
    } else {
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle=p.color;
      ctx.beginPath();
      ctx.ellipse(0,0,3.2,1.5,0,0,Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha=1;
}

export function drawLevelUpBeams() {
  if (!FX || !FX.levelUpBeams.length) return;
  ctx.save(); ctx.globalCompositeOperation="lighter";
  for (const b of FX.levelUpBeams) {
    const t = clamp(b.t / b.life, 0, 1);
    const alpha = t < 0.4 ? t / 0.4 : Math.max(0, 1 - (t - 0.4) / 0.6);
    const height = 400 * (t < 0.5 ? 1 : 1 - (t-0.5) / 0.5);
    const topY = groundY - height;
    const grad = ctx.createLinearGradient(0, topY, 0, groundY);
    grad.addColorStop(0, `rgba(255,200,0,${alpha * 0.8})`);
    grad.addColorStop(0.3, `rgba(255,220,80,${alpha * 0.6})`);
    grad.addColorStop(1, `rgba(255,240,120,0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(b.x - 60, topY, 120, height);
  }
  ctx.restore();
}

export function spawnLevelUpBeam(x) {
  if (!FX) initFX();
  FX.levelUpBeams.push({ x, t: 0, life: 0.9 });
}
