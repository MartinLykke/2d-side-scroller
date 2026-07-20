import { ctx, groundY } from '../../core/canvas.js';
import { state } from '../../core/state.js';
import { Audio } from '../../systems/infrastructure/Audio.js';
import { drawBoot } from '../DrawHelpers.js';
import { biomeHumanoidSkin, unitSkinVariant } from '../BiomeHumanoidSkins.js';
import { drawClimbPose, isClimbingEntity } from './FriendlyClimb.js';

// ---------------------------------------------------------------------------
// Procedural hooded archer: idle / walk / run / shoot, mirrored for east/west.
// All drawing happens in local space: translate(u.x,0), scale(-1,1) for west,
// so "east" (+x) is the only pose authored here.
// With the Heavy Ballista ultimate the whole outfit changes: steel kettle helm,
// plate over the tunic, crimson cloak, and a cranked siege crossbow.
// ---------------------------------------------------------------------------

// Palette — earth tones, forest green cloak
const C = {
  cloak:    "#2e5d34",
  cloakDk:  "#1f4426",
  cloakLt:  "#477a45",
  tunic:    "#6b4f2e",
  tunicLt:  "#7d5f3a",
  belt:     "#3a2a18",
  buckle:   "#c9a24a",
  pants:    "#4a3a26",
  boots:    "#33261a",
  skin:     "#d8b58e",
  bowWood:  "#7a4f26",
  bowTip:   "#5a3a1c",
  string:   "#e8dcae",
  quiver:   "#5a3a20",
  fletch:   "#8fae4a",
  shaft:    "#c9b48a",
};

// Ballista-team palette — dark steel and crimson
const CB = {
  cloak:    "#6e2323",
  cloakDk:  "#471414",
  cloakLt:  "#8f3232",
  tunic:    "#44444e",
  tunicLt:  "#565662",
  belt:     "#232329",
  buckle:   "#c9a24a",
  pants:    "#3a3a42",
  boots:    "#26262c",
  skin:     "#d8b58e",
  bowWood:  "#5a4028",
  bowTip:   "#3d2b1a",
  string:   "#d8d2c0",
  quiver:   "#33333b",
  fletch:   "#8f2a24",
  shaft:    "#6b5a42",
  steel:    "#9aa2ae",
  steelDk:  "#6b7280",
  steelLt:  "#c3cad4",
};

function isBallista() {
  return state.archerSkills && state.archerSkills.includes("heavy_ballista");
}

// Shoot sequence: [phase, duration]
const SHOOT_PHASES = [
  ["reach",   0.12],  // hand goes back to the quiver
  ["draw",    0.26],  // nock + pull the string, body leans back
  ["release", 0.05],  // string snaps forward
  ["recoil",  0.20],  // follow-through, cloak swings
];
const SHOOT_TOTAL = SHOOT_PHASES.reduce((s, p) => s + p[1], 0);
// Time from animation start until the string is released (reach + draw)
export const SHOOT_RELEASE_TIME = SHOOT_PHASES[0][1] + SHOOT_PHASES[1][1];

export function startArcherShoot(u) {
  u.shootState = "reach";
  u.shootTimer = 0;
  Audio.bowLoad();
}

export function updateArcherShoot(u, dt) {
  if (!u.shootState) return;
  u.shootTimer += dt;
  if (u.shootTimer >= SHOOT_TOTAL) { u.shootState = null; u.shootTimer = 0; }
}

export function shootPose(u) {
  if (!u.shootState) return null;
  let el = 0;
  for (const [phase, dur] of SHOOT_PHASES) {
    if (u.shootTimer < el + dur) return { phase, p: (u.shootTimer - el) / dur };
    el += dur;
  }
  return { phase: "recoil", p: 1 };
}

export const ease = p => p * p * (3 - 2 * p); // smoothstep

export function limb(x1, y1, x2, y2, col, w) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.lineCap = "butt";
}

// Recurve bow centered on the grip hand. `aim`: 0 = held low at side,
// 1 = raised level. `pull`: 0..1 string draw amount toward `pullPt`.
export function drawBow(hx, hy, aim, pull, pullPt, look = {}) {
  const rot = (1 - aim) * 0.9; // lowered bow tilts forward/down
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(rot);
  const R = look.radius || 12;
  const tipX = R * 0.21;
  const bellyX = R * 0.42;
  const curveX = R * 0.54;
  const tipKick = R * 0.21;
  const wood = look.wood || C.bowWood;
  const tip = look.tip || C.bowTip;
  const string = look.string || C.string;
  const grip = look.grip || C.belt;
  const rank = look.rank || 0;
  const shortBowUpgraded = look.weaponId === "short_bow" && rank >= 2;
  const shortBowLegend = look.weaponId === "short_bow" && rank >= 3;
  const t = performance.now() / 1000;
  if (look.glow) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = look.glowAlpha || 0.28;
    ctx.strokeStyle = look.glow;
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(tipX, -R);
    ctx.quadraticCurveTo(curveX, -R * 0.55, bellyX, 0);
    ctx.quadraticCurveTo(curveX, R * 0.55, tipX, R);
    ctx.stroke();
    ctx.restore();
  }
  if (shortBowLegend) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.18 + 0.08 * Math.sin(t * 2.4);
    ctx.fillStyle = "#d8ffd0";
    for (let k = 0; k < 6; k++) {
      const a = t * 1.5 + k * Math.PI * 2 / 6;
      const lx = Math.cos(a) * R * 0.9;
      const ly = Math.sin(a) * R * 1.12;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.quadraticCurveTo(2.7, 0, 0, 2);
      ctx.quadraticCurveTo(-2.3, 0, 0, -2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  // Limbs: two mirrored curves with recurved tips
  ctx.strokeStyle = wood; ctx.lineWidth = look.limbWidth || 2.4; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(tipX, -R);
  ctx.quadraticCurveTo(curveX, -R * 0.55, bellyX, 0);
  ctx.quadraticCurveTo(curveX, R * 0.55, tipX, R);
  ctx.stroke();
  if (shortBowUpgraded) {
    ctx.save();
    ctx.strokeStyle = "#3f7f3a";
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const p = i / 16;
      const y = -R + p * R * 2;
      const x = tipX + Math.sin(p * Math.PI * 4 + t * 2) * 1.4;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = look.hasIceExplosion ? "#d8fbff" : "#9bd05a";
    for (let k = 0; k < 4; k++) {
      const y = -R * 0.7 + k * R * 0.46;
      ctx.beginPath();
      ctx.moveTo(tipX + 0.5, y);
      ctx.lineTo(tipX + 4.2, y + (k % 2 ? 2.4 : -2.4));
      ctx.stroke();
    }
    ctx.restore();
  }
  // Recurve tips flick back
  ctx.strokeStyle = tip; ctx.lineWidth = look.tipWidth || 2;
  ctx.beginPath(); ctx.moveTo(tipX, -R); ctx.lineTo(tipX + tipKick, -R - tipKick); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tipX, R); ctx.lineTo(tipX + tipKick, R + tipKick); ctx.stroke();
  // Grip wrap
  ctx.strokeStyle = grip; ctx.lineWidth = look.gripWidth || 3.2;
  ctx.beginPath(); ctx.moveTo(bellyX, -2.5); ctx.lineTo(bellyX, 2.5); ctx.stroke();
  ctx.lineCap = "butt";
  if (look.detail === "frozen") {
    ctx.save();
    ctx.strokeStyle = look.trim || "#e8fbff";
    ctx.fillStyle = look.trim || "#e8fbff";
    ctx.lineWidth = 1.1;
    for (const y of [-R * 0.72, R * 0.72]) {
      ctx.beginPath(); ctx.moveTo(tipX - 1, y); ctx.lineTo(tipX + 6, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tipX + 2.4, y - 3); ctx.lineTo(tipX + 2.4, y + 3); ctx.stroke();
      ctx.beginPath(); ctx.arc(tipX + 2.4, y, 1.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  } else if (look.detail === "desert") {
    ctx.fillStyle = look.accent || "#47a8a0";
    ctx.fillRect(bellyX - 2, -5.6, 4, 11.2);
    ctx.fillStyle = look.trim || "#f1d58a";
    ctx.beginPath(); ctx.arc(bellyX + 2.8, -4.8, 1.25, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bellyX + 2.8, 4.8, 1.25, 0, Math.PI * 2); ctx.fill();
  } else if (look.detail === "swamp") {
    ctx.save();
    ctx.strokeStyle = look.trim || "#a9ba58";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const p = i / 10;
      const y = -R + p * R * 2;
      const x = tipX + Math.sin(p * Math.PI * 5) * 1.8;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = look.accent || "#c8d760";
    for (const y of [-R * 0.42, R * 0.15, R * 0.55]) {
      ctx.beginPath(); ctx.moveTo(tipX + 1, y); ctx.lineTo(tipX + 5, y - 2.2); ctx.lineTo(tipX + 3, y + 2); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  } else if (look.detail === "volcano") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = look.glow || "#ff7a36";
    ctx.lineWidth = 1.35;
    ctx.beginPath(); ctx.moveTo(tipX + 1, -R + 2); ctx.quadraticCurveTo(tipX + 4, -R * 0.35, bellyX + 1, -1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tipX + 1, R - 2); ctx.quadraticCurveTo(tipX + 4, R * 0.35, bellyX + 1, 1); ctx.stroke();
    ctx.fillStyle = look.glow || "#ff7a36";
    ctx.beginPath(); ctx.arc(tipX + 2, -R + 2, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(tipX + 2, R - 2, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (look.detail === "corrupted") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = look.rune || "#d1a1ff";
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(tipX - 3, -R - 2); ctx.quadraticCurveTo(-R * 0.32, 0, tipX - 3, R + 2); ctx.stroke();
    ctx.fillStyle = look.glow || "#9f68ff";
    ctx.beginPath(); ctx.arc(bellyX + 3.5, 0, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // String: tip-to-tip, mid vertex pulled back while drawing
  ctx.strokeStyle = string; ctx.lineWidth = look.stringWidth || 1;
  ctx.beginPath();
  ctx.moveTo(tipX + tipKick, -R - tipKick);
  if (pull > 0 && pullPt) {
    // pullPt is in archer-local space; un-rotate it into bow-local space
    const dx = pullPt.x - hx, dy = pullPt.y - hy;
    ctx.lineTo(dx * Math.cos(rot) + dy * Math.sin(rot), -dx * Math.sin(rot) + dy * Math.cos(rot));
  }
  ctx.lineTo(tipX + tipKick, R + tipKick);
  ctx.stroke();
  if (shortBowLegend) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.52 + 0.14 * Math.sin(t * 3.4);
    ctx.strokeStyle = "#d8ffd0";
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(tipX + tipKick - 3, -R - tipKick);
    if (pull > 0 && pullPt) {
      const dx = pullPt.x - hx, dy = pullPt.y - hy;
      ctx.lineTo(dx * Math.cos(rot) + dy * Math.sin(rot) - 3, -dx * Math.sin(rot) + dy * Math.cos(rot));
    }
    ctx.lineTo(tipX + tipKick - 3, R + tipKick);
    ctx.stroke();
    ctx.restore();
  }
  if (shortBowUpgraded) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const nockCol = look.hasIceExplosion ? "#ffffff" : look.hasBinding ? "#8fd8ff" : (look.upgradeCol || "#9bd05a");
    ctx.globalAlpha = 0.34 + 0.18 * Math.sin(t * 4.8);
    ctx.fillStyle = nockCol;
    ctx.beginPath(); ctx.arc(bellyX + pull * 1.5, 0, shortBowLegend ? 4.2 : 3.1, 0, Math.PI * 2); ctx.fill();
    if (look.hasBinding || look.hasIceExplosion) {
      ctx.strokeStyle = nockCol;
      ctx.lineWidth = 0.85;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.ellipse(bellyX + 5 + k * 3.2, 0, 1.5, 2.1, 0.7, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (shortBowLegend) {
      ctx.strokeStyle = "#e8f8ff";
      ctx.lineWidth = 1;
      for (let k = -1; k <= 1; k += 2) {
        ctx.beginPath(); ctx.moveTo(bellyX - 2, k * 3.2); ctx.lineTo(R + 7, k * 1.4); ctx.stroke();
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawDagger(hx, hy, p = 0) {
  const thrust = ease(Math.min(1, Math.max(0, p)));
  ctx.save();
  ctx.translate(hx + thrust * 7, hy - thrust * 2);
  ctx.rotate(-0.55 + thrust * 1.15);
  ctx.fillStyle = "#4b3522";
  ctx.fillRect(-2, -1.5, 5, 3);
  ctx.fillStyle = "#c9a24a";
  ctx.fillRect(1, -3, 1.5, 6);
  ctx.fillStyle = "#cfd5dc";
  ctx.beginPath();
  ctx.moveTo(2, -2.2);
  ctx.lineTo(15, 0);
  ctx.lineTo(2, 2.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.moveTo(4, -0.8);
  ctx.lineTo(12, 0);
  ctx.lineTo(4, 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Heavy siege crossbow held level. `aim` raises it from carry to firing line,
// `pull` winds the string back along the stock, `recoil` kicks the whole
// weapon back on release. A bolt sits on the rail while loaded.
function drawBallistaWeapon(hx, hy, aim, pull, recoil, loaded, P = CB) {
  const rot = (1 - aim) * 0.55;
  ctx.save();
  ctx.translate(hx - recoil * 3.5, hy);
  ctx.rotate(rot + recoil * 0.1);

  // Wooden stock with a steel rail on top
  ctx.fillStyle = P.bowWood;
  ctx.fillRect(-11, -1.5, 24, 4);
  ctx.fillStyle = P.steelDk;
  ctx.fillRect(-11, -2.6, 24, 1.4);
  // Shoulder butt
  ctx.fillStyle = P.bowWood;
  ctx.beginPath(); ctx.moveTo(-11, -1.5); ctx.lineTo(-15, 4.5); ctx.lineTo(-11, 3.5); ctx.closePath(); ctx.fill();

  // Steel bow arms mounted at the muzzle, flexing as the string winds back
  const R = 9.5, flex = pull * 2.4;
  ctx.strokeStyle = P.steel; ctx.lineWidth = 2.2; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(13 - flex, -R);
  ctx.quadraticCurveTo(16.5, -R * 0.45, 13, -1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(13 - flex, R);
  ctx.quadraticCurveTo(16.5, R * 0.45, 13, 1);
  ctx.stroke();
  ctx.strokeStyle = P.steelLt; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(13 - flex, -R); ctx.lineTo(14.5 - flex, -R - 1.8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(13 - flex, R); ctx.lineTo(14.5 - flex, R + 1.8); ctx.stroke();
  ctx.lineCap = "butt";

  // String: tips to the nut, wound back along the rail while loading
  const nutX = 12 - pull * 15;
  ctx.strokeStyle = P.string; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(13 - flex, -R);
  ctx.lineTo(nutX, -1.2);
  ctx.lineTo(nutX, 1.2);
  ctx.lineTo(13 - flex, R);
  ctx.stroke();

  // Crank wheel at the rear of the stock
  ctx.strokeStyle = P.steelDk; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(-7, -0.5, 2.6, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = P.steel;
  ctx.beginPath(); ctx.arc(-7, -0.5, 1.1, 0, Math.PI * 2); ctx.fill();

  // Loaded bolt riding the rail, head poking past the muzzle
  if (loaded) {
    ctx.strokeStyle = "#3a2c1c"; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(nutX, -2.8); ctx.lineTo(16, -2.8); ctx.stroke();
    ctx.fillStyle = P.steelLt;
    ctx.beginPath(); ctx.moveTo(16, -4.4); ctx.lineTo(20.5, -2.8); ctx.lineTo(16, -1.2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.fletch;
    ctx.beginPath(); ctx.moveTo(nutX, -2.8); ctx.lineTo(nutX - 2.6, -5); ctx.lineTo(nutX + 1.6, -3.4); ctx.closePath(); ctx.fill();
  }
  if (P.detail === "frozen") {
    ctx.strokeStyle = P.trim || "#e8fbff";
    ctx.lineWidth = 1;
    for (const y of [-R, R]) {
      ctx.beginPath(); ctx.moveTo(13 - flex, y); ctx.lineTo(18 - flex, y + (y < 0 ? -4 : 4)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(13 - flex, y); ctx.lineTo(8 - flex, y + (y < 0 ? -3 : 3)); ctx.stroke();
    }
  } else if (P.detail === "desert") {
    ctx.fillStyle = P.accent || "#47a8a0";
    ctx.fillRect(-1, -4.6, 4, 8.4);
    ctx.fillStyle = P.trim || "#f1d58a";
    ctx.fillRect(-8, 2.8, 17, 1.6);
  } else if (P.detail === "swamp") {
    ctx.strokeStyle = P.trim || "#a9ba58";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-9, 3.6); ctx.quadraticCurveTo(-2, -5, 9, 3.4); ctx.stroke();
    ctx.fillStyle = P.accent || "#c8d760";
    ctx.beginPath(); ctx.arc(2, -4.2, 1, 0, Math.PI * 2); ctx.fill();
  } else if (P.detail === "volcano") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.glow || "#ff7a36";
    ctx.fillRect(-8, -1.1, 19, 1.6);
    ctx.beginPath(); ctx.arc(14, -2, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (P.detail === "corrupted") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = P.rune || "#d1a1ff";
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(-7, -0.5, 5.2, 0.2, Math.PI * 1.8); ctx.stroke();
    ctx.fillStyle = P.glow || "#9f68ff";
    ctx.beginPath(); ctx.arc(12, 0, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export function drawArcher(u) {
  const t = performance.now() / 1000;
  const speed = u.moveSpeed || 0;
  const moving = !!u.moving;
  const run = moving && speed > 72;
  const shoot = shootPose(u);
  const anim = u.anim || 0;
  const ball = isBallista();
  const P = biomeHumanoidSkin("archer", u.x, ball ? CB : C, unitSkinVariant(u));
  const bowLook = {
    wood: P.bowWood, tip: P.bowTip, string: P.string, grip: P.belt,
    detail: P.detail, trim: P.trim, accent: P.accent, glow: P.glow, rune: P.rune,
  };
  const grap = u.grapple;
  const grapPull = grap && grap.phase === "pull";
  const melee = !grap && !shoot && (u.meleeMode > 0 || (u.aiState === "combat" && u.combatTarget && u.combatTarget.type === "imp"));

  ctx.save();
  ctx.translate(u.x, 0);
  if (u.dir < 0) ctx.scale(-1, 1);

  if (isClimbingEntity(u)) {
    drawClimbPose(u, P, { hood: !ball, helm: ball, plume: ball, cloak: true, quiver: true });
    ctx.restore();
    return;
  }

  // --- Pose parameters -----------------------------------------------------
  const breathe = Math.sin(t * 1.8 + (u.x || 0) * 0.03);
  const bob = moving && !grap ? Math.abs(Math.sin(anim)) * (run ? 2.4 : 1.2) : breathe * 0.5 + 0.5;
  const lean = run && !grap ? 3 : 0;           // upper body shifts forward when running
  const stride = moving && !grap ? (run ? 8.5 : 5) : 0; // leg spread

  // Lean back slightly while drawing the bow
  let drawLean = 0, pull = 0, aim = 0;
  if (shoot) {
    if (shoot.phase === "reach")        { aim = ease(shoot.p) * 0.4; }
    else if (shoot.phase === "draw")    { aim = 0.4 + ease(shoot.p) * 0.6; pull = ease(shoot.p); drawLean = ease(shoot.p) * 2; }
    else if (shoot.phase === "release") { aim = 1; pull = 1 - shoot.p; drawLean = 2 - shoot.p; }
    else                                { aim = 1 - ease(shoot.p) * 0.7; drawLean = (1 - ease(shoot.p)) * 1.5; }
  }

  // Kneeling pose while a caltrop is being placed (u.placingTrap goes 0→1 over the animation)
  const placeP = u.placingTrap > 0 ? Math.min(u.placingTrap, 1) : 0;
  const kneel = placeP > 0 ? Math.sin(placeP * Math.PI) : 0; // down and up again

  const hipY  = groundY - 18 - bob * 0.4 + kneel * 5;
  const shX   = lean - drawLean + kneel * 3;   // shoulder x offset, leans forward when kneeling
  const shY   = groundY - 31 - bob + kneel * 8;
  const headX = shX + (run ? 1.5 : 0) - drawLean * 0.5 + kneel * 2;
  const headY = groundY - 38.5 - bob + kneel * 8;

  // --- Cloak (behind everything) --------------------------------------------
  // Flow: streams back when running, sways when walking, snaps on release,
  // and whips out hard while riding the grappling hook
  let flow;
  if (grapPull) flow = -13 - Math.sin(t * 22) * 2;
  else if (shoot) {
    if (shoot.phase === "reach")        flow = -2 * shoot.p;
    else if (shoot.phase === "draw")    flow = -2 - 4 * ease(shoot.p);
    else if (shoot.phase === "release") flow = -6 + 3 * shoot.p;
    else                                flow = -3 + 12 * ease(shoot.p) * (1 - shoot.p * 0.4);
  } else if (run)    flow = -10 - Math.sin(anim * 2) * 2.5;
  else if (moving)   flow = -4 + Math.sin(anim * 1.5) * 3;
  else               flow = breathe * 1.5;

  const capeTopY = shY + 1, capeBotY = groundY - 2 + Math.abs(flow) * 0.12;
  ctx.fillStyle = P.cloakDk;
  ctx.beginPath();
  ctx.moveTo(shX - 5, capeTopY);
  ctx.lineTo(shX + 5, capeTopY);
  ctx.bezierCurveTo(shX + 4 + flow * 0.25, shY + 10, shX + 3 + flow * 0.7, hipY + 4, shX + 4 + flow, capeBotY);
  // ragged hem
  ctx.lineTo(shX + flow * 0.9, capeBotY - 2.5);
  ctx.lineTo(shX - 3 + flow * 0.95, capeBotY + 0.5);
  ctx.lineTo(shX - 6 + flow, capeBotY - 1.5);
  ctx.bezierCurveTo(shX - 8 + flow * 0.6, hipY + 2, shX - 7 + flow * 0.2, shY + 9, shX - 5, capeTopY);
  ctx.closePath();
  ctx.fill();
  // subtle lit edge
  ctx.strokeStyle = P.cloak; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(shX + 5, capeTopY);
  ctx.bezierCurveTo(shX + 4 + flow * 0.25, shY + 10, shX + 3 + flow * 0.7, hipY + 4, shX + 4 + flow, capeBotY);
  ctx.stroke();

  // --- Quiver on the back (over cloak, under torso) --------------------------
  ctx.save();
  ctx.translate(shX - 4, shY + 5); ctx.rotate(0.5);
  ctx.fillStyle = P.quiver;
  if (ball) {
    // Wide iron-bound bolt case with two heavy bolts
    ctx.fillRect(-3.5, -9, 7, 13);
    ctx.fillStyle = P.steelDk; ctx.fillRect(-3.5, -4, 7, 2);
    ctx.strokeStyle = "#3a2c1c"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-1.5, -9); ctx.lineTo(-2.2, -14); ctx.moveTo(1.5, -9); ctx.lineTo(1.8, -13.5); ctx.stroke();
    ctx.fillStyle = P.fletch;
    ctx.beginPath(); ctx.moveTo(-2.2, -14); ctx.lineTo(-4.6, -16.5); ctx.lineTo(-1, -15.5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(1.8, -13.5); ctx.lineTo(3.6, -16); ctx.lineTo(3.9, -13.5); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillRect(-2.5, -9, 5, 13);
    ctx.fillStyle = P.belt; ctx.fillRect(-2.5, -3, 5, 2);
    // arrow tops
    ctx.strokeStyle = P.shaft; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-1, -9); ctx.lineTo(-1.5, -13); ctx.moveTo(1, -9); ctx.lineTo(1.2, -12.5); ctx.stroke();
    ctx.fillStyle = P.fletch;
    ctx.beginPath(); ctx.moveTo(-1.5, -13); ctx.lineTo(-3.5, -15.5); ctx.lineTo(-0.5, -14.5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(1.2, -12.5); ctx.lineTo(2.8, -15); ctx.lineTo(3, -12.5); ctx.closePath(); ctx.fill();
  }
  if (P.detail === "frozen") {
    ctx.fillStyle = P.trim;
    ctx.fillRect(-3.3, -10, 6.6, 1.8);
    ctx.beginPath(); ctx.moveTo(-2.8, 3.5); ctx.lineTo(0, 8); ctx.lineTo(2.8, 3.5); ctx.closePath(); ctx.fill();
  } else if (P.detail === "desert") {
    ctx.fillStyle = P.accent;
    ctx.fillRect(-3.4, -5, 6.8, 2);
    ctx.strokeStyle = P.trim;
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(3.2, -5); ctx.quadraticCurveTo(7, -2, 4, 1.5); ctx.stroke();
  } else if (P.detail === "swamp") {
    ctx.strokeStyle = P.trim;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-3.4, -9); ctx.quadraticCurveTo(2, -5, -2, 5); ctx.stroke();
    ctx.fillStyle = P.accent;
    ctx.beginPath(); ctx.arc(2.8, -2, 0.9, 0, Math.PI * 2); ctx.fill();
  } else if (P.detail === "volcano") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.glow;
    ctx.beginPath(); ctx.arc(-2, -4, 0.9, 0, Math.PI * 2); ctx.arc(2, 1, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (P.detail === "corrupted") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = P.rune;
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(0, -2, 3.7, 0.3, Math.PI * 1.8); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // --- Legs ------------------------------------------------------------------
  const s = Math.sin(anim);
  const backKnee  = { x: -3 + s * stride, y: groundY };
  const frontKnee = { x: 3 - s * stride, y: groundY };
  // shooting stance: feet planted apart
  if (shoot && !moving) { backKnee.x = -6; frontKnee.x = 5; }
  // kneeling stance while setting a trap
  if (kneel > 0.05) { backKnee.x = -7; frontKnee.x = 6; }
  // riding the rope: legs trail behind
  if (grapPull) { backKnee.x = -8; frontKnee.x = -3.5; }
  limb(-2.5, hipY, backKnee.x, backKnee.y - 4, P.pants, 3);
  limb(backKnee.x, backKnee.y - 4.5, backKnee.x + 0.5, backKnee.y - 2, P.boots, 3.4);
  drawBoot(backKnee.x + 0.5, backKnee.y, P.boots, 0.9);
  limb(2.5, hipY, frontKnee.x, frontKnee.y - 4, P.pants, 3);
  limb(frontKnee.x, frontKnee.y - 4.5, frontKnee.x + 0.5, frontKnee.y - 2, P.boots, 3.4);
  drawBoot(frontKnee.x + 0.5, frontKnee.y, P.boots, 0.9);

  // --- Torso: layered tunic under the cloak's front panel ---------------------
  ctx.fillStyle = P.tunic;
  ctx.beginPath();
  ctx.moveTo(shX - 5, shY);
  ctx.lineTo(shX + 5, shY);
  ctx.lineTo(4, hipY + 3);
  ctx.lineTo(-4, hipY + 3);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.tunicLt; ctx.fillRect(shX - 4, shY + 1, 3, 6); // highlight
  if (ball) {
    // Steel breastplate with rivets strapped over the tunic
    ctx.fillStyle = P.steel;
    ctx.beginPath();
    ctx.moveTo(shX - 4.5, shY + 1);
    ctx.lineTo(shX + 4.5, shY + 1);
    ctx.lineTo(3.2, hipY - 1);
    ctx.lineTo(-3.2, hipY - 1);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.steelLt; ctx.fillRect(shX - 3.5, shY + 2, 2, 5);
    ctx.fillStyle = P.steelDk;
    ctx.beginPath(); ctx.arc(shX - 2.5, shY + 3, 0.7, 0, Math.PI * 2); ctx.arc(shX + 2.5, shY + 3, 0.7, 0, Math.PI * 2); ctx.fill();
  }
  // belt + buckle
  ctx.fillStyle = P.belt; ctx.fillRect(-4.5, hipY - 2, 9, 2.6);
  ctx.fillStyle = P.buckle; ctx.fillRect(-1, hipY - 2, 2, 2.6);
  ctx.strokeStyle = "rgba(30,20,12,0.55)";
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(shX - 4.8, shY + 1); ctx.lineTo(3.8, hipY + 2); ctx.stroke();
  ctx.fillStyle = P.belt;
  ctx.fillRect(4.5, hipY - 0.5, 3, 5);
  ctx.fillStyle = P.buckle;
  ctx.fillRect(5, hipY + 0.4, 2, 1.2);
  // cloak shoulder mantle draped over the torso top
  ctx.fillStyle = P.cloak;
  ctx.beginPath();
  ctx.moveTo(shX - 6.5, shY + 0.5);
  ctx.quadraticCurveTo(shX, shY + 7.5, shX + 6.5, shY + 0.5);
  ctx.quadraticCurveTo(shX, shY - 4, shX - 6.5, shY + 0.5);
  ctx.closePath(); ctx.fill();
  if (P.detail === "frozen") {
    ctx.strokeStyle = P.trim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(shX - 6.2, shY + 1); ctx.quadraticCurveTo(shX, shY + 6.2, shX + 6.2, shY + 1); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillRect(-4.3, hipY + 2.4, 8.6, 2);
  } else if (P.detail === "desert") {
    ctx.fillStyle = P.accent;
    ctx.fillRect(-5.2, hipY + 0.6, 10.4, 1.8);
    ctx.fillStyle = "rgba(255,230,150,0.35)";
    ctx.fillRect(shX - 5.4, shY + 4.2, 10.8, 2);
  } else if (P.detail === "swamp") {
    ctx.fillStyle = P.trim;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(shX - 4 + i * 4, shY + 6 + (i % 2), 1, 0, Math.PI * 2); ctx.fill();
    }
  } else if (P.detail === "volcano") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.glow;
    ctx.beginPath(); ctx.arc(shX + 3.8, shY + 5.5, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (P.detail === "corrupted") {
    ctx.strokeStyle = P.rune; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(shX + 2, shY + 4); ctx.lineTo(shX + 4, shY + 7); ctx.lineTo(shX + 2.5, shY + 10); ctx.stroke();
  } else {
    ctx.fillStyle = P.trim;
    ctx.beginPath(); ctx.arc(shX - 4.6, shY + 3.8, 1.2, 0, Math.PI * 2); ctx.fill();
  }
  if (ball) {
    // Plated pauldron capping the front shoulder
    ctx.fillStyle = P.steel;
    ctx.beginPath(); ctx.arc(shX + 4.5, shY + 1.5, 3.4, Math.PI * 0.9, Math.PI * 2.1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = P.steelDk; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(shX + 4.5, shY + 1.5, 2.2, Math.PI, Math.PI * 2); ctx.stroke();
  }

  // --- Head: hood for archers, steel kettle helm for ballista teams -----------
  ctx.fillStyle = P.skin;
  ctx.beginPath(); ctx.arc(headX, headY, 4.6, 0, Math.PI * 2); ctx.fill();
  if (ball) {
    // Kettle helm: rounded steel cap with a wide brim and a crimson plume
    ctx.fillStyle = P.steel;
    ctx.beginPath(); ctx.arc(headX, headY - 1.2, 4.9, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.steelLt;
    ctx.beginPath(); ctx.arc(headX - 1.4, headY - 2.4, 1.7, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.steelDk;
    ctx.fillRect(headX - 6.4, headY - 1.8, 12.4, 1.6); // brim
    // neck guard trailing behind
    ctx.fillStyle = P.steel;
    ctx.beginPath();
    ctx.moveTo(headX - 5.2, headY - 0.5);
    ctx.quadraticCurveTo(headX - 6.8, headY + 2.5, headX - 4.6, headY + 4.5);
    ctx.lineTo(headX - 3.2, headY + 1.5);
    ctx.closePath(); ctx.fill();
    // plume
    ctx.strokeStyle = P.cloakLt; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(headX, headY - 5.6);
    ctx.quadraticCurveTo(headX - 3 + flow * 0.25, headY - 8.5, headX - 6 + flow * 0.4, headY - 7);
    ctx.stroke();
    ctx.lineCap = "butt";
    // shadowed eyes under the brim
    ctx.fillStyle = "rgba(10,10,14,0.45)";
    ctx.beginPath(); ctx.arc(headX + 0.5, headY - 0.2, 3.4, Math.PI * 1.1, Math.PI * 1.9); ctx.fill();
  } else {
    // hood: covers back/top of head, opens toward facing direction
    ctx.fillStyle = P.cloak;
    ctx.beginPath();
    ctx.moveTo(headX + 3, headY - 4.5);
    ctx.quadraticCurveTo(headX - 1, headY - 8.5, headX - 5.5, headY - 4);
    ctx.quadraticCurveTo(headX - 7.5, headY + 1, headX - 5, headY + 5.5);
    ctx.lineTo(headX - 1, headY + 5.5);
    ctx.quadraticCurveTo(headX - 4.5, headY + 1, headX - 3, headY - 2);
    ctx.quadraticCurveTo(headX - 1, headY - 5, headX + 3, headY - 4.5);
    ctx.closePath(); ctx.fill();
    // hood peak drooping behind
    ctx.fillStyle = P.cloakDk;
    ctx.beginPath();
    ctx.moveTo(headX - 4.5, headY - 4.5);
    ctx.quadraticCurveTo(headX - 8 + flow * 0.3, headY - 3, headX - 7.5 + flow * 0.4, headY + 2);
    ctx.quadraticCurveTo(headX - 6.5, headY - 1, headX - 5.5, headY - 3);
    ctx.closePath(); ctx.fill();
    // shaded face under the hood brow
    ctx.fillStyle = "rgba(10,14,10,0.4)";
    ctx.beginPath(); ctx.arc(headX - 0.5, headY - 2.2, 3.6, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  }
  if (P.detail === "frozen") {
    ctx.strokeStyle = P.trim;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(headX - 0.8, headY - 1.5, 5.4, Math.PI * 0.95, Math.PI * 1.9); ctx.stroke();
  } else if (P.detail === "desert") {
    ctx.fillStyle = P.trim;
    ctx.beginPath();
    ctx.moveTo(headX - 5.2, headY - 4.1);
    ctx.quadraticCurveTo(headX, headY - 8.2, headX + 5.2, headY - 4.1);
    ctx.lineTo(headX + 4.4, headY - 1.1);
    ctx.quadraticCurveTo(headX, headY - 3.1, headX - 5, headY - 1.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = P.accent;
    ctx.fillRect(headX - 4.6, headY + 1, 8.8, 2);
  } else if (P.detail === "swamp") {
    ctx.fillStyle = P.trim;
    ctx.beginPath(); ctx.moveTo(headX - 4.5, headY - 4.5); ctx.lineTo(headX - 2, headY - 8.5); ctx.lineTo(headX, headY - 4.7); ctx.closePath(); ctx.fill();
  } else if (P.detail === "volcano") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.glow;
    ctx.beginPath(); ctx.arc(headX + 2.5, headY - 3.5, 1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (P.detail === "corrupted") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.glow;
    ctx.beginPath(); ctx.arc(headX + 1.6, headY - 0.4, 1.25, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // --- Arms + weapon ---------------------------------------------------------
  const frontSh = { x: shX + 4, y: shY + 2 };
  const backSh  = { x: shX - 4, y: shY + 2 };

  if (grap) {
    // Grappling hook: front arm reaches up the rope, weapon slung in the back hand
    const reachP = grap.phase === "throw" ? ease(Math.min(grap.t, 1)) : 1;
    const hand = { x: frontSh.x + 3 + reachP * 6, y: frontSh.y + 6 - reachP * 15 };
    const grip = { x: backSh.x - 2, y: shY + 10 };
    limb(backSh.x, backSh.y, grip.x, grip.y, P.skin, 2.5);
    if (ball) drawBallistaWeapon(grip.x, grip.y, 0.05, 0, 0, false, P);
    else drawBow(grip.x, grip.y, 0.05, 0, null, bowLook);
    limb(frontSh.x, frontSh.y, hand.x, hand.y, P.skin, 2.6);
  } else if (melee) {
    const slash = u.strike > 0 ? 1 - Math.min(1, u.strike / 0.22) : 0.18 + Math.sin(t * 8) * 0.05;
    const guardHand = { x: backSh.x - 2, y: shY + 10 };
    const knifeHand = {
      x: frontSh.x + 5 + slash * 5,
      y: frontSh.y + 7 - Math.sin(slash * Math.PI) * 5,
    };
    limb(backSh.x, backSh.y, guardHand.x, guardHand.y, P.skin, 2.5);
    if (ball) drawBallistaWeapon(guardHand.x, guardHand.y, 0.05, 0, 0, false, P);
    else drawBow(guardHand.x, guardHand.y, 0.05, 0, null, bowLook);
    limb(frontSh.x, frontSh.y, knifeHand.x, knifeHand.y, P.skin, 2.8);
    drawDagger(knifeHand.x, knifeHand.y, slash);
    if (u.strike > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.45, u.strike * 1.8);
      ctx.strokeStyle = "#d7dde5";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(knifeHand.x + 10, knifeHand.y, 12, -0.75, 0.55);
      ctx.stroke();
      ctx.restore();
    }
  } else if (shoot && ball) {
    // Siege crossbow: held level with both hands; the rear hand cranks the
    // windlass during the draw, and the whole weapon kicks back on release
    const grip = { x: frontSh.x + 4 + aim * 5, y: frontSh.y + 8 - aim * 7 };
    const recoil = shoot.phase === "release" ? shoot.p : shoot.phase === "recoil" ? 1 - ease(shoot.p) : 0;
    let crank;
    if (shoot.phase === "draw") {
      const ca = ease(shoot.p) * Math.PI * 3; // one and a half turns of the crank
      crank = { x: grip.x - 7 + Math.cos(ca) * 3.5, y: grip.y - 0.5 + Math.sin(ca) * 3.5 };
    } else {
      crank = { x: grip.x - 4, y: grip.y + 1 };
    }
    limb(backSh.x, backSh.y, crank.x, crank.y, P.skin, 2.5);
    const loaded = (shoot.phase === "draw" && shoot.p > 0.45) || shoot.phase === "release";
    drawBallistaWeapon(grip.x, grip.y, aim, pull, recoil, loaded, P);
    // muzzle flare on release
    if (shoot.phase === "release") {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.8 * (1 - shoot.p);
      const mg = ctx.createRadialGradient(grip.x + 18, grip.y - 2, 1, grip.x + 18, grip.y - 2, 10);
      mg.addColorStop(0, "rgba(255,220,150,0.95)"); mg.addColorStop(1, "rgba(255,120,30,0)");
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(grip.x + 18, grip.y - 2, 10, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    limb(frontSh.x, frontSh.y, grip.x + 6 - recoil * 3.5, grip.y - 1, P.skin, 2.6);
  } else if (shoot) {
    // Grip hand raises the bow forward as `aim` goes 0→1
    const grip = {
      x: frontSh.x + 4 + aim * 7,
      y: frontSh.y + 7 - aim * 8,
    };
    // Draw hand: reaches quiver, then pulls string from bow to cheek
    let drawHand;
    if (shoot.phase === "reach") {
      const p = ease(shoot.p);
      drawHand = { x: backSh.x + 2 - p * 6, y: backSh.y + 8 - p * 14 }; // hip → over shoulder
    } else if (shoot.phase === "draw") {
      const p = ease(shoot.p);
      // hand travels from the bow grip back to the cheek as the string is pulled
      drawHand = {
        x: (1 - p) * (grip.x + 4) + p * (headX + 1),
        y: (1 - p) * (backSh.y - 6) + p * (headY + 3),
      };
    } else if (shoot.phase === "release") {
      drawHand = { x: headX - 1 - shoot.p * 3, y: headY + 3 + shoot.p * 2 };
    } else {
      const p = ease(shoot.p);
      drawHand = { x: headX - 4 - p * 3, y: headY + 5 + p * 9 };
    }

    // back arm (draw arm) behind torso
    limb(backSh.x, backSh.y, drawHand.x, drawHand.y, P.skin, 2.5);

    // nocked arrow while drawing — glows gold when a power shot is charged
    if (shoot.phase === "draw" && shoot.p > 0.3 || shoot.phase === "release") {
      const nockX = shoot.phase === "draw" ? drawHand.x : grip.x + 5;
      if (u.charged) {
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.6;
        const cg = ctx.createRadialGradient(grip.x + 6, grip.y, 1, grip.x + 6, grip.y, 12);
        cg.addColorStop(0, "rgba(255,235,160,0.9)"); cg.addColorStop(1, "rgba(255,160,20,0)");
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(grip.x + 6, grip.y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = u.charged ? "#ffe9a0" : P.shaft; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(nockX, drawHand.y); ctx.lineTo(grip.x + 9, grip.y); ctx.stroke();
      ctx.fillStyle = u.charged ? "#fff6d0" : "#b8bcc4";
      ctx.beginPath(); ctx.moveTo(grip.x + 9, grip.y - 1.6); ctx.lineTo(grip.x + 12.5, grip.y); ctx.lineTo(grip.x + 9, grip.y + 1.6); ctx.closePath(); ctx.fill();
      // fletching at the nock end
      ctx.fillStyle = u.charged ? "#ffcc44" : P.fletch;
      ctx.beginPath(); ctx.moveTo(nockX, drawHand.y); ctx.lineTo(nockX - 3, drawHand.y - 2.6); ctx.lineTo(nockX + 1.5, drawHand.y - 0.6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(nockX, drawHand.y); ctx.lineTo(nockX - 3, drawHand.y + 2.6); ctx.lineTo(nockX + 1.5, drawHand.y + 0.6); ctx.closePath(); ctx.fill();
    }

    drawBow(grip.x, grip.y, aim, pull, shoot.phase === "draw" ? drawHand : null, bowLook);
    // front arm over the bow
    limb(frontSh.x, frontSh.y, grip.x, grip.y, P.skin, 2.6);
  } else if (kneel > 0.01) {
    // Placing a caltrop: back hand holds the weapon low, front hand guides the trap toward the ground
    const reach = ease(Math.min(1, kneel));
    const handX = frontSh.x + 6 + reach * 5;
    const handY = frontSh.y + 6 + reach * (groundY - 4 - frontSh.y - 6);
    const grip = { x: backSh.x - 2, y: shY + 10 };
    limb(backSh.x, backSh.y, grip.x, grip.y, P.skin, 2.5);
    if (ball) drawBallistaWeapon(grip.x, grip.y, 0.05, 0, 0, false, P);
    else drawBow(grip.x, grip.y, 0.05, 0, null, bowLook);
    limb(frontSh.x, frontSh.y, handX, handY, P.skin, 2.6);
    // the folded trap in hand until the AI releases it
    if (!u.trapDropped) {
      ctx.strokeStyle = "#8a8a94"; ctx.lineWidth = 1.4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(handX - 3, handY + 2.5); ctx.lineTo(handX + 3, handY + 2.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(handX - 1.5, handY + 2.5); ctx.lineTo(handX - 0.5, handY - 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(handX + 1.5, handY + 2.5); ctx.lineTo(handX + 0.5, handY - 2); ctx.stroke();
      ctx.lineCap = "butt";
    }
  } else {
    // Weapon carried in the front hand, held low
    const swing = moving ? Math.sin(anim) * (run ? 4 : 2.5) : 0;
    const grip = { x: frontSh.x + 3 + swing * 0.4, y: frontSh.y + 9 };
    limb(backSh.x, backSh.y, backSh.x - 2 - swing, shY + 11, P.skin, 2.5);
    ctx.fillStyle = P.belt;
    ctx.beginPath(); ctx.ellipse(backSh.x - 1 - swing * 0.5, shY + 8, 1.8, 2.8, -0.3, 0, Math.PI * 2); ctx.fill();
    if (ball) drawBallistaWeapon(grip.x, grip.y, moving ? 0.15 : 0.05, 0, 0, false, P);
    else drawBow(grip.x, grip.y, moving ? 0.15 : 0.05, 0, null, bowLook);
    limb(frontSh.x, frontSh.y, grip.x, grip.y, P.skin, 2.6);
    ctx.fillStyle = P.belt;
    ctx.beginPath(); ctx.ellipse(grip.x - 1, grip.y - 1.5, 1.8, 2.8, 0.2, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}
