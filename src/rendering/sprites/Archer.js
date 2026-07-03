import { ctx, groundY } from '../canvas.js';

// ---------------------------------------------------------------------------
// Procedural hooded archer: idle / walk / run / shoot, mirrored for east/west.
// All drawing happens in local space: translate(u.x,0), scale(-1,1) for west,
// so "east" (+x) is the only pose authored here.
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
}

export function updateArcherShoot(u, dt) {
  if (!u.shootState) return;
  u.shootTimer += dt;
  if (u.shootTimer >= SHOOT_TOTAL) { u.shootState = null; u.shootTimer = 0; }
}

function shootPose(u) {
  if (!u.shootState) return null;
  let el = 0;
  for (const [phase, dur] of SHOOT_PHASES) {
    if (u.shootTimer < el + dur) return { phase, p: (u.shootTimer - el) / dur };
    el += dur;
  }
  return { phase: "recoil", p: 1 };
}

const ease = p => p * p * (3 - 2 * p); // smoothstep

function limb(x1, y1, x2, y2, col, w) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.lineCap = "butt";
}

// Recurve bow centered on the grip hand. `aim`: 0 = held low at side,
// 1 = raised level. `pull`: 0..1 string draw amount toward `pullPt`.
function drawBow(hx, hy, aim, pull, pullPt) {
  const rot = (1 - aim) * 0.9; // lowered bow tilts forward/down
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(rot);
  const R = 12;
  // Limbs: two mirrored curves with recurved tips
  ctx.strokeStyle = C.bowWood; ctx.lineWidth = 2.4; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(2.5, -R);
  ctx.quadraticCurveTo(6.5, -R * 0.55, 5, 0);
  ctx.quadraticCurveTo(6.5, R * 0.55, 2.5, R);
  ctx.stroke();
  // Recurve tips flick back
  ctx.strokeStyle = C.bowTip; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(2.5, -R); ctx.lineTo(5, -R - 2.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2.5, R); ctx.lineTo(5, R + 2.5); ctx.stroke();
  // Grip wrap
  ctx.strokeStyle = C.belt; ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.moveTo(5, -2.5); ctx.lineTo(5, 2.5); ctx.stroke();
  ctx.lineCap = "butt";
  // String: tip-to-tip, mid vertex pulled back while drawing
  ctx.strokeStyle = C.string; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(5, -R - 2.5);
  if (pull > 0 && pullPt) {
    // pullPt is in archer-local space; un-rotate it into bow-local space
    const dx = pullPt.x - hx, dy = pullPt.y - hy;
    ctx.lineTo(dx * Math.cos(rot) + dy * Math.sin(rot), -dx * Math.sin(rot) + dy * Math.cos(rot));
  }
  ctx.lineTo(5, R + 2.5);
  ctx.stroke();
  ctx.restore();
}

export function drawArcher(u) {
  const t = performance.now() / 1000;
  const speed = u.moveSpeed || 0;
  const moving = !!u.moving;
  const run = moving && speed > 72;
  const shoot = shootPose(u);
  const anim = u.anim || 0;

  ctx.save();
  ctx.translate(u.x, 0);
  if (u.dir < 0) ctx.scale(-1, 1);

  // --- Pose parameters -----------------------------------------------------
  const breathe = Math.sin(t * 1.8 + (u.x || 0) * 0.03);
  const bob = moving ? Math.abs(Math.sin(anim)) * (run ? 2.4 : 1.2) : breathe * 0.5 + 0.5;
  const lean = run ? 3 : 0;                    // upper body shifts forward when running
  const stride = moving ? (run ? 8.5 : 5) : 0; // leg spread

  // Lean back slightly while drawing the bow
  let drawLean = 0, pull = 0, aim = 0;
  if (shoot) {
    if (shoot.phase === "reach")        { aim = ease(shoot.p) * 0.4; }
    else if (shoot.phase === "draw")    { aim = 0.4 + ease(shoot.p) * 0.6; pull = ease(shoot.p); drawLean = ease(shoot.p) * 2; }
    else if (shoot.phase === "release") { aim = 1; pull = 1 - shoot.p; drawLean = 2 - shoot.p; }
    else                                { aim = 1 - ease(shoot.p) * 0.7; drawLean = (1 - ease(shoot.p)) * 1.5; }
  }

  const hipY  = groundY - 18 - bob * 0.4;
  const shX   = lean - drawLean;               // shoulder x offset
  const shY   = groundY - 31 - bob;
  const headX = shX + (run ? 1.5 : 0) - drawLean * 0.5;
  const headY = groundY - 38.5 - bob;

  // --- Cloak (behind everything) --------------------------------------------
  // Flow: streams back when running, sways when walking, snaps on release
  let flow;
  if (shoot) {
    if (shoot.phase === "reach")        flow = -2 * shoot.p;
    else if (shoot.phase === "draw")    flow = -2 - 4 * ease(shoot.p);
    else if (shoot.phase === "release") flow = -6 + 3 * shoot.p;
    else                                flow = -3 + 12 * ease(shoot.p) * (1 - shoot.p * 0.4);
  } else if (run)    flow = -10 - Math.sin(anim * 2) * 2.5;
  else if (moving)   flow = -4 + Math.sin(anim * 1.5) * 3;
  else               flow = breathe * 1.5;

  const capeTopY = shY + 1, capeBotY = groundY - 2 + Math.abs(flow) * 0.12;
  ctx.fillStyle = C.cloakDk;
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
  ctx.strokeStyle = C.cloak; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(shX + 5, capeTopY);
  ctx.bezierCurveTo(shX + 4 + flow * 0.25, shY + 10, shX + 3 + flow * 0.7, hipY + 4, shX + 4 + flow, capeBotY);
  ctx.stroke();

  // --- Quiver on the back (over cloak, under torso) --------------------------
  ctx.save();
  ctx.translate(shX - 4, shY + 5); ctx.rotate(0.5);
  ctx.fillStyle = C.quiver;
  ctx.fillRect(-2.5, -9, 5, 13);
  ctx.fillStyle = C.belt; ctx.fillRect(-2.5, -3, 5, 2);
  // arrow tops
  ctx.strokeStyle = C.shaft; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-1, -9); ctx.lineTo(-1.5, -13); ctx.moveTo(1, -9); ctx.lineTo(1.2, -12.5); ctx.stroke();
  ctx.fillStyle = C.fletch;
  ctx.beginPath(); ctx.moveTo(-1.5, -13); ctx.lineTo(-3.5, -15.5); ctx.lineTo(-0.5, -14.5); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(1.2, -12.5); ctx.lineTo(2.8, -15); ctx.lineTo(3, -12.5); ctx.closePath(); ctx.fill();
  ctx.restore();

  // --- Legs ------------------------------------------------------------------
  const s = Math.sin(anim);
  const backKnee  = { x: -3 + s * stride, y: groundY };
  const frontKnee = { x: 3 - s * stride, y: groundY };
  // shooting stance: feet planted apart
  if (shoot && !moving) { backKnee.x = -6; frontKnee.x = 5; }
  limb(-2.5, hipY, backKnee.x, backKnee.y - 3, C.pants, 3);
  limb(backKnee.x, backKnee.y - 3.5, backKnee.x + 1.5, backKnee.y, C.boots, 3.4);
  limb(2.5, hipY, frontKnee.x, frontKnee.y - 3, C.pants, 3);
  limb(frontKnee.x, frontKnee.y - 3.5, frontKnee.x + 1.5, frontKnee.y, C.boots, 3.4);

  // --- Torso: layered tunic under the cloak's front panel ---------------------
  ctx.fillStyle = C.tunic;
  ctx.beginPath();
  ctx.moveTo(shX - 5, shY);
  ctx.lineTo(shX + 5, shY);
  ctx.lineTo(4, hipY + 3);
  ctx.lineTo(-4, hipY + 3);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.tunicLt; ctx.fillRect(shX - 4, shY + 1, 3, 6); // highlight
  // belt + buckle
  ctx.fillStyle = C.belt; ctx.fillRect(-4.5, hipY - 2, 9, 2.6);
  ctx.fillStyle = C.buckle; ctx.fillRect(-1, hipY - 2, 2, 2.6);
  // cloak shoulder mantle draped over the torso top
  ctx.fillStyle = C.cloak;
  ctx.beginPath();
  ctx.moveTo(shX - 6.5, shY + 0.5);
  ctx.quadraticCurveTo(shX, shY + 7.5, shX + 6.5, shY + 0.5);
  ctx.quadraticCurveTo(shX, shY - 4, shX - 6.5, shY + 0.5);
  ctx.closePath(); ctx.fill();

  // --- Head + hood -------------------------------------------------------------
  ctx.fillStyle = C.skin;
  ctx.beginPath(); ctx.arc(headX, headY, 4.6, 0, Math.PI * 2); ctx.fill();
  // hood: covers back/top of head, opens toward facing direction
  ctx.fillStyle = C.cloak;
  ctx.beginPath();
  ctx.moveTo(headX + 3, headY - 4.5);
  ctx.quadraticCurveTo(headX - 1, headY - 8.5, headX - 5.5, headY - 4);
  ctx.quadraticCurveTo(headX - 7.5, headY + 1, headX - 5, headY + 5.5);
  ctx.lineTo(headX - 1, headY + 5.5);
  ctx.quadraticCurveTo(headX - 4.5, headY + 1, headX - 3, headY - 2);
  ctx.quadraticCurveTo(headX - 1, headY - 5, headX + 3, headY - 4.5);
  ctx.closePath(); ctx.fill();
  // hood peak drooping behind
  ctx.fillStyle = C.cloakDk;
  ctx.beginPath();
  ctx.moveTo(headX - 4.5, headY - 4.5);
  ctx.quadraticCurveTo(headX - 8 + flow * 0.3, headY - 3, headX - 7.5 + flow * 0.4, headY + 2);
  ctx.quadraticCurveTo(headX - 6.5, headY - 1, headX - 5.5, headY - 3);
  ctx.closePath(); ctx.fill();
  // shaded face under the hood brow
  ctx.fillStyle = "rgba(10,14,10,0.4)";
  ctx.beginPath(); ctx.arc(headX - 0.5, headY - 2.2, 3.6, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();

  // --- Arms + bow ----------------------------------------------------------------
  const frontSh = { x: shX + 4, y: shY + 2 };
  const backSh  = { x: shX - 4, y: shY + 2 };

  if (shoot) {
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
    limb(backSh.x, backSh.y, drawHand.x, drawHand.y, C.skin, 2.5);

    // nocked arrow while drawing
    if (shoot.phase === "draw" && shoot.p > 0.3 || shoot.phase === "release") {
      const nockX = shoot.phase === "draw" ? drawHand.x : grip.x + 5;
      ctx.strokeStyle = C.shaft; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(nockX, drawHand.y); ctx.lineTo(grip.x + 9, grip.y); ctx.stroke();
      ctx.fillStyle = "#b8bcc4";
      ctx.beginPath(); ctx.moveTo(grip.x + 9, grip.y - 1.6); ctx.lineTo(grip.x + 12.5, grip.y); ctx.lineTo(grip.x + 9, grip.y + 1.6); ctx.closePath(); ctx.fill();
      // green fletching at the nock end
      ctx.fillStyle = C.fletch;
      ctx.beginPath(); ctx.moveTo(nockX, drawHand.y); ctx.lineTo(nockX - 3, drawHand.y - 2.6); ctx.lineTo(nockX + 1.5, drawHand.y - 0.6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(nockX, drawHand.y); ctx.lineTo(nockX - 3, drawHand.y + 2.6); ctx.lineTo(nockX + 1.5, drawHand.y + 0.6); ctx.closePath(); ctx.fill();
    }

    drawBow(grip.x, grip.y, aim, pull, shoot.phase === "draw" ? drawHand : null);
    // front arm over the bow
    limb(frontSh.x, frontSh.y, grip.x, grip.y, C.skin, 2.6);
  } else {
    // Bow carried in the front hand, held low
    const swing = moving ? Math.sin(anim) * (run ? 4 : 2.5) : 0;
    const grip = { x: frontSh.x + 3 + swing * 0.4, y: frontSh.y + 9 };
    limb(backSh.x, backSh.y, backSh.x - 2 - swing, shY + 11, C.skin, 2.5);
    drawBow(grip.x, grip.y, moving ? 0.15 : 0.05, 0, null);
    limb(frontSh.x, frontSh.y, grip.x, grip.y, C.skin, 2.6);
  }

  ctx.restore();
}
