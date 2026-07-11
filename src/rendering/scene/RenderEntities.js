import { ENEMY_TYPES } from '../../config/enemies.js';
import { ctx, groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { roundedRect, legs, drawArm, drawHpBar } from '../DrawHelpers.js';
import { wallHeight, overWallPlatform } from '../../entities/Wall.js';
import { drawArcher } from '../sprites/Archer.js';
import { drawBuilder } from '../sprites/Builder.js';
import { drawVillager } from '../sprites/Villager.js';
import { drawGuard } from '../sprites/Guard.js';

const STUCK_ARROW_FADE_TIME = 0.55;

function stuckArrowAlpha(ar) {
  const fadeTime = Math.min(STUCK_ARROW_FADE_TIME, ar.maxT || STUCK_ARROW_FADE_TIME);
  return Math.max(0, Math.min(1, ar.t / fadeTime));
}

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
    drawVillager(v, v.vx >= 0 ? 1 : -1, Math.abs(v.vx) > 1);
  }
}

// Grappling hook flight: rope from the archer's hand to a grapnel biting the
// wall top. Drawn in world space so mirroring/lift transforms don't apply.
function drawGrappleRope(u, lift) {
  const g = u.grapple;
  const targetX = g.toX;
  const targetY = groundY - g.lift - 16;
  const handX = u.x + (u.dir || 1) * 5;
  const handY = groundY - lift - 27;
  let hx, hy;
  if (g.phase === "throw") {
    const p = Math.min(g.t, 1);
    const e = 1 - (1 - p) * (1 - p);
    hx = handX + (targetX - handX) * e;
    hy = handY + (targetY - handY) * e - Math.sin(p * Math.PI) * 18; // thrown arc
  } else {
    hx = targetX; hy = targetY;
  }
  // rope sags while flying, snaps taut once the pull starts
  const sag = g.phase === "throw" ? 10 : Math.max(2, 14 * (1 - Math.min(g.t, 1)));
  ctx.save();
  ctx.strokeStyle = "#c9b48a"; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(handX, handY);
  ctx.quadraticCurveTo((handX + hx) / 2, Math.max(handY, hy) + sag, hx, hy);
  ctx.stroke();
  // grapnel: shank with two curved flukes
  const ang = Math.atan2(hy - handY, hx - handX);
  ctx.translate(hx, hy); ctx.rotate(ang);
  ctx.strokeStyle = "#8a8a94"; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(7, -3, 3, -6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(7, 3, 3, 6); ctx.stroke();
  ctx.restore();
}

// Power shot: sparks build while the archer stands still, a bright aura when
// fully charged, and an expanding shockwave ring on release.
function drawPowerCharge(u, lift) {
  const t = performance.now() / 1000;
  const cx = u.x, cy = groundY - 26 - lift;
  const p = Math.min((u.powerTimer || 0) / 3, 1);
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  if (u.powerFlash > 0) {
    const fp = 1 - u.powerFlash / 0.4;
    ctx.globalAlpha = 0.7 * (1 - fp);
    ctx.strokeStyle = "#ffe9a0"; ctx.lineWidth = 3 * (1 - fp) + 1;
    ctx.beginPath(); ctx.arc(cx, cy, 10 + fp * 42, 0, Math.PI * 2); ctx.stroke();
  }
  if (u.charged) {
    const pulse = 0.75 + 0.25 * Math.sin(t * 10 + u.x);
    ctx.globalAlpha = 0.5 * pulse;
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 26);
    g.addColorStop(0, "rgba(255,240,180,0.9)");
    g.addColorStop(0.5, "rgba(255,204,68,0.4)");
    g.addColorStop(1, "rgba(200,120,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill();
    // orbiting sparks
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#fff2b0";
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + i * (Math.PI * 2 / 3);
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 16, cy + Math.sin(a) * 9 - 2, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  } else if (p > 0.13) {
    // charging: sparks rise off the ground and tighten toward the archer
    ctx.fillStyle = "#ffcc44";
    for (let i = 0; i < 4; i++) {
      const cycle = (t * (0.8 + i * 0.13) + i * 0.37) % 1;
      const sx = cx + Math.sin(i * 2.7 + u.x) * 14 * (1 - cycle * 0.6);
      const sy = groundY - 4 - cycle * 34 - lift;
      ctx.globalAlpha = p * 0.8 * Math.sin(cycle * Math.PI);
      ctx.beginPath(); ctx.arc(sx, sy, 1.4 + p, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = p * 0.35;
    ctx.strokeStyle = "#ffcc44"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(cx, groundY - 2 - lift, 12 * p + 4, 3.5, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

export function drawUnits() {
  for (const u of state.units) {
    if (u.mine) continue; // miners are drawn by the mine scene
    let body="#3a3550", head="#caa483", tool=null;
    if (u.role==="archer")  { body="#2f5040"; tool="bow"; }
    else if (u.role==="builder") { body="#6a4a28"; tool="hammer"; }
    else if (u.role==="farmer")  { body="#5a6a2a"; tool="scythe"; }
    else if (u.role==="guard")   { body="#3a4a5a"; head="#b09a7a"; }
    const climbT = u.wall && overWallPlatform(u.wall, u.x) ? (u.wallClimbT || (u.onWall ? 1 : 0)) : 0;
    let wallLift = u.wall ? Math.max(0, wallHeight(u.wall) - 14) * climbT : 0;
    // Grapple flight: the rope, not the climb, carries the archer up
    if (u.grapple) wallLift = u.grappleLiftY || 0;

    const shadowAlpha = u.role === "archer" && state.archerSkills.includes("master_shadows") && Game.isNight && (u.smokeReveal || 0) <= 0 ? 0.32 : 1;
    ctx.save();
    if (wallLift > 0) { ctx.translate(0, -wallLift); }
    ctx.globalAlpha = shadowAlpha;
    if (u.dying) {
      const p = Math.min((u.deathT || 0) / (u.deathDuration || 1.25), 1);
      const ease = 1 - Math.pow(1 - p, 3);
      ctx.globalAlpha *= Math.max(0.25, 1 - Math.max(0, p - 0.72) / 0.28);
      // Pivot at the unit's own feet — sprites draw at absolute u.x, so the
      // rotation origin must be moved there or the body swings around x=0.
      ctx.translate(u.x, groundY);
      ctx.rotate((u.deathSpin || 1) * ease * (u.role === "guard" ? 1.35 : 1.55));
      ctx.translate(-u.x, -groundY + ease * 3);
    }

    if (u.role === "archer") {
      drawArcher(u);
    } else if (u.role === "builder") {
      drawBuilder(u);
    } else if (u.role === "peasant") {
      drawVillager(u);
    } else if (u.role === "guard") {
      drawGuard(u);
    } else {
      drawHumanoid(u.x, u.anim, body, head, tool, u.dir, u.moving);
    }

    if (u.role==="builder" && u.carryLog) {
      ctx.save(); ctx.translate(u.x, groundY - 40);
      ctx.fillStyle = "#4a3420"; roundedRect(-16, -6, 32, 10, 4); ctx.fill();
      ctx.fillStyle = "#c9a878"; ctx.beginPath(); ctx.ellipse(16, -1, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    if (!u.dying && u.role === "archer") {
      if (u.grapple) drawGrappleRope(u, wallLift);
      if (state.archerSkills.includes("powershot") && !state.archerSkills.includes("heavy_ballista") &&
          (u.charged || u.powerFlash > 0 || (u.powerTimer || 0) > 0.4)) {
        drawPowerCharge(u, wallLift);
      }
    }

    if (!u.dying && u.role === "archer" && u.archerName) {
      const shadowAlpha = state.archerSkills.includes("master_shadows") && Game.isNight && (u.smokeReveal || 0) <= 0 ? 0.35 : 0.9;
      ctx.save();
      ctx.globalAlpha = shadowAlpha;
      ctx.textAlign = "center";
      const symbolY = groundY - 68 - wallLift;
      const level = u.level || 1;
      const baseSize = 3 + level * 1.2;
      const color = u.charged ? "#ffcc44" : "#9bd05a";

      ctx.fillStyle = color;
      for (let i = 0; i < level; i++) {
        const angle = (i / level) * Math.PI * 2;
        const radius = baseSize * 2.5;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        ctx.beginPath();
        ctx.arc(px, 0, baseSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.6;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(0, 0, baseSize * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.restore();
    }

    if (!u.dying && u.transform>0) {
      const p=u.transform/0.55;
      ctx.save(); ctx.globalAlpha=p*0.7; ctx.globalCompositeOperation="lighter";
      const grd=ctx.createRadialGradient(u.x,groundY-28-wallLift,2,u.x,groundY-28-wallLift,28*p);
      grd.addColorStop(0,"#ffffff"); grd.addColorStop(0.4,"#9bd05a"); grd.addColorStop(1,"transparent");
      ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(u.x,groundY-28-wallLift,28*p,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    if (!u.dying && u.hp<u.maxHp) drawHpBar(u.x,groundY-46-wallLift,16,u.hp/u.maxHp,"#9bd05a");
  }
}

// Small hunched devil: whip tail, oversized ears, lunging claw swipe.
function drawStuckImpArrows(e) {
  if (!e.stuckArrows || !e.stuckArrows.length) return;
  ctx.save();
  for (const ar of e.stuckArrows) {
    const alpha = stuckArrowAlpha(ar);
    if (alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(ar.x, ar.y);
    ctx.rotate(ar.a || 0);
    const magic = ar.weaponId === "void_bow" || ar.weaponId === "dark_bow" || ar.weaponId === "dragons_bow";
    if (magic) {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.28 * alpha;
      ctx.strokeStyle = ar.weaponId === "dragons_bow" ? "#ff8840" : "#b060ff";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(3, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = magic ? "#e8d8ff" : "#c9b48a";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(5, 0); ctx.stroke();
    ctx.fillStyle = "#b8bcc4";
    ctx.beginPath(); ctx.moveTo(5, -1.6); ctx.lineTo(8, 0); ctx.lineTo(5, 1.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = magic ? "#c69fff" : "#8fae4a";
    ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-17, -2.3); ctx.lineTo(-14, -0.3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-17, 2.3); ctx.lineTo(-14, 0.3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawImp(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const atkKind = e.impAttackKind || "claw";
  // Pounce is driven by the AI's own attack clock so pose and motion stay in sync.
  const pounce = atkKind === "pounce" && e.aiState === "impAttack" && !e.dying && e.impPounceP != null ? e.impPounceP : -1;
  const p = pounce >= 0 ? pounce : atkF > 0 ? 1 - atkF : -1;   // 0..1 swipe progress, -1 when idle
  const bob = Math.abs(Math.sin(e.anim * 2.6)) * 2.2;
  const body = flash ? "#fff" : "#8f221c";
  const bodyDk = flash ? "#fff" : "#4a1016";
  const bodyMid = flash ? "#fff" : "#b33124";
  const ember = "#ff7a24";
  const emberHot = "#ffd060";
  const lunge = p >= 0 ? Math.sin(Math.min(p * 1.6, 1) * Math.PI) * (atkKind === "pounce" ? 1.5 : 6) : 0;

  // Whole-body pounce pose: coil low during windup, stretch into the leap,
  // dive nose-first toward the target, then squash on landing.
  let pounceAir = -1;
  if (pounce >= 0) {
    const windup = 0.22;
    const pivotY = groundY - 6;
    let sx = 1, sy = 1, rot = 0;
    if (pounce < windup) {
      const c = (pounce / windup) ** 2;
      sx = 1 + 0.16 * c; sy = 1 - 0.28 * c; rot = 0.16 * c;   // haunches coiled, weight back
    } else {
      const lp = Math.min(1, (pounce - windup) / (1 - windup));
      pounceAir = Math.min(1, lp / 0.85);
      if (pounceAir < 1) {
        const stretch = Math.sin(pounceAir * Math.PI);
        sx = 1 + 0.3 * stretch; sy = 1 - 0.22 * stretch;      // stretched flat mid-air
        rot = -0.55 + pounceAir * 1.05;                       // nose up at launch → diving at the end
      } else {
        const sq = 1 - (lp - 0.85) / 0.15;                    // landing squash easing back out
        sx = 1 + 0.32 * sq; sy = 1 - 0.36 * sq; rot = 0.12 * sq;
      }
    }
    ctx.save();
    ctx.translate(0, pivotY); ctx.rotate(rot); ctx.scale(sx, sy); ctx.translate(0, -pivotY);
  }

  // ember streak trailing the leap
  if (pounceAir > 0 && pounceAir < 1) {
    const heat = Math.sin(pounceAir * Math.PI);
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.4 * heat;
    const trail = ctx.createLinearGradient(-34, 0, 4, 0);
    trail.addColorStop(0, "rgba(180,30,0,0)");
    trail.addColorStop(0.7, "rgba(255,120,30,0.5)");
    trail.addColorStop(1, "rgba(255,208,96,0.85)");
    ctx.fillStyle = trail;
    ctx.beginPath(); ctx.ellipse(-13, groundY - 15, 21, 6.5 + heat * 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.16 + 0.08 * Math.sin(T * 9 + e.x);
  const aura = ctx.createRadialGradient(0, groundY - 18 - bob, 2, 0, groundY - 18 - bob, 26);
  aura.addColorStop(0, "rgba(255,120,30,0.55)");
  aura.addColorStop(1, "rgba(120,20,0,0)");
  ctx.fillStyle = aura; ctx.beginPath(); ctx.ellipse(0, groundY - 18 - bob, 20, 25, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // drifting smoke wisps rising off the body
  ctx.save(); ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#2a1512";
  for (let k = 0; k < 2; k++) {
    const wt = (T * 0.7 + k * 0.5 + e.x * 0.03) % 1;
    ctx.beginPath();
    ctx.arc(Math.sin((T + k * 2.4) * 2.2) * 4, groundY - 26 - bob - wt * 16, 2.6 * (1 - wt) + 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // whip tail, raised when striking
  const wag = Math.sin(T * 6 + e.x * 0.1) * 4;
  const tailStrike = atkKind === "tail" && p >= 0 ? Math.sin(Math.min(p * 1.45, 1) * Math.PI) : 0;
  const tipX = -20 + tailStrike * 39;
  const tipY = groundY - 22 - bob - wag - (p >= 0 ? 6 : 0) + tailStrike * 6;
  ctx.strokeStyle = bodyDk; ctx.lineWidth = 2.2; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-6, groundY - 10 - bob);
  ctx.quadraticCurveTo(-16 + tailStrike * 26, groundY - 14 - bob + wag * 0.4, tipX, tipY);
  ctx.stroke(); ctx.lineCap = "butt";
  ctx.fillStyle = bodyDk;
  ctx.beginPath(); ctx.moveTo(tipX - 3, tipY + 2); ctx.lineTo(tipX + 1, tipY - 4); ctx.lineTo(tipX + 3, tipY + 2); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.7;
  ctx.fillStyle = ember;
  ctx.beginPath(); ctx.ellipse(tipX + 1, tipY - 4, 3.2, 5.5 + Math.sin(T * 14) * 1.2, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = emberHot;
  ctx.beginPath(); ctx.ellipse(tipX + 1, tipY - 5, 1.4, 2.8, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // scuttling legs with clawed toes (trailing behind while airborne mid-pounce)
  const s = Math.sin(e.anim * 3);
  const airborne = pounceAir > 0 && pounceAir < 1;
  ctx.strokeStyle = body; ctx.lineWidth = 2.4; ctx.lineCap = "round";
  const f1x = airborne ? -11 : -5 + s * 4 + lunge * 0.3, f2x = airborne ? -6 : 4 - s * 4 + lunge * 0.3;
  const footY = airborne ? groundY - 5 : groundY;
  ctx.beginPath(); ctx.moveTo(-4 + lunge * 0.4, groundY - 9 - bob); ctx.lineTo(f1x, footY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3 + lunge * 0.4, groundY - 9 - bob); ctx.lineTo(f2x, footY); ctx.stroke();
  ctx.lineWidth = 1.1; ctx.strokeStyle = bodyDk;
  for (const fx of [f1x, f2x]) {
    ctx.beginPath(); ctx.moveTo(fx, footY - 1); ctx.lineTo(fx + 3, footY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx, footY - 1); ctx.lineTo(fx + 1.4, footY - 2.4); ctx.stroke();
  }
  ctx.lineCap = "butt";

  ctx.save();
  ctx.translate(lunge, 0);
  // hunched body, tilting into the lunge, chest heaving as it breathes
  const breathe = Math.sin(T * 3.2 + e.x * 0.2) * 0.45;
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, groundY - 13 - bob, 8 + breathe * 0.5, 9.5 + breathe, p >= 0 ? -0.5 : -0.25, 0, Math.PI * 2); ctx.fill();
  // pale cracked belly plate
  ctx.fillStyle = bodyMid;
  ctx.beginPath(); ctx.ellipse(2, groundY - 12 - bob, 4.6, 6.2 + breathe * 0.7, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = flash ? "#fff" : "#d8583a"; ctx.lineWidth = 0.8;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath(); ctx.moveTo(-0.5, groundY - 16 - bob + k * 3.4); ctx.lineTo(4.8, groundY - 15.4 - bob + k * 3.4); ctx.stroke();
  }
  // bony spine ridge down the hunched back
  ctx.fillStyle = bodyDk;
  for (let k = 0; k < 3; k++) {
    const spx = -5.5 + k * 2.6, spy = groundY - 19.5 - bob + k * 1.4;
    ctx.beginPath(); ctx.moveTo(spx - 1.4, spy + 2); ctx.lineTo(spx, spy - 2.6 - k * 0.4); ctx.lineTo(spx + 1.4, spy + 2); ctx.closePath(); ctx.fill();
  }
  // molten cracks glowing through the hide
  ctx.strokeStyle = "rgba(255,150,54,0.35)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(-1, groundY - 14 - bob, 7, -0.5, 1.1); ctx.stroke();
  ctx.beginPath(); ctx.arc(2, groundY - 12 - bob, 4, 2.1, 3.45); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.35 + 0.2 * Math.sin(T * 4 + e.x);
  ctx.strokeStyle = ember; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(-4, groundY - 10 - bob); ctx.lineTo(-1.5, groundY - 13 - bob); ctx.lineTo(-3, groundY - 16 - bob); ctx.stroke();
  ctx.restore();

  // big head thrust forward
  const hx = 6 + (p >= 0 ? 2 : 0), hy = groundY - 24 - bob;
  const earTwitch = Math.sin(T * 4.3 + e.x * 0.7) > 0.9 ? 2.2 : 0;
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.fill();
  // far ear (darker, behind the head)
  ctx.fillStyle = bodyDk;
  ctx.beginPath(); ctx.moveTo(hx - 3, hy - 5); ctx.lineTo(hx - 12, hy - 12 - earTwitch * 0.5); ctx.lineTo(hx - 2, hy - 8); ctx.closePath(); ctx.fill();
  // near ear, swept back, twitching now and then
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.moveTo(hx - 4, hy - 4); ctx.lineTo(hx - 14, hy - 9 - earTwitch); ctx.lineTo(hx - 3, hy - 7.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = bodyDk; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(hx - 5, hy - 5.5); ctx.lineTo(hx - 11, hy - 8.2 - earTwitch * 0.8); ctx.stroke();
  // horn nubs with glowing tips
  ctx.fillStyle = bodyDk;
  ctx.beginPath(); ctx.moveTo(hx - 1, hy - 6); ctx.lineTo(hx + 1, hy - 11); ctx.lineTo(hx + 3, hy - 6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(hx + 3, hy - 5); ctx.lineTo(hx + 6, hy - 9.5); ctx.lineTo(hx + 6.5, hy - 4); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5;
  ctx.fillStyle = ember;
  ctx.beginPath(); ctx.arc(hx + 1, hy - 10.6, 1, 0, Math.PI * 2); ctx.arc(hx + 5.9, hy - 9, 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // glowing eyes, with an occasional blink
  const blink = Math.sin(T * 2.7 + e.x * 0.37) > 0.985;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = blink ? 0.15 : 0.7 + 0.25 * dark;
  ctx.fillStyle = emberHot;
  ctx.beginPath(); ctx.arc(hx + 2.2, hy - 1.5, 2.6, 0, Math.PI * 2); ctx.arc(hx + 5.4, hy - 1, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (!blink) {
    ctx.fillStyle = emberHot;
    ctx.beginPath(); ctx.arc(hx + 2.2, hy - 1.5, 1.1, 0, Math.PI * 2); ctx.arc(hx + 5.4, hy - 1, 0.9, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = emberHot; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hx + 1, hy - 1.5); ctx.lineTo(hx + 3.4, hy - 1.5); ctx.moveTo(hx + 4.4, hy - 1); ctx.lineTo(hx + 6.4, hy - 1); ctx.stroke();
  }
  // snarling mouth: dark maw, needle teeth, ember glow inside when striking
  const jaw = p >= 0 ? 1.6 * Math.sin(Math.min(p * 1.5, 1) * Math.PI) : 0.3 + 0.3 * Math.sin(T * 2.1 + e.x);
  ctx.fillStyle = flash ? "#fff" : "#2a0708";
  ctx.beginPath(); ctx.moveTo(hx + 0.5, hy + 3); ctx.quadraticCurveTo(hx + 4, hy + 4.5 + jaw, hx + 7.2, hy + 3.2); ctx.quadraticCurveTo(hx + 4, hy + 2.6, hx + 0.5, hy + 3); ctx.fill();
  if (jaw > 0.8) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5;
    ctx.fillStyle = ember; ctx.beginPath(); ctx.ellipse(hx + 4, hy + 3.6, 2.4, jaw * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = flash ? "#fff" : "#f0e0c0"; ctx.lineWidth = 0.8;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath(); ctx.moveTo(hx + 1.6 + k * 2, hy + 3); ctx.lineTo(hx + 2.1 + k * 2, hy + 3.9 + jaw * 0.5); ctx.stroke();
  }
  ctx.fillStyle = bodyDk;
  ctx.beginPath(); ctx.moveTo(hx - 2, hy - 7); ctx.lineTo(hx - 7, hy - 13); ctx.lineTo(hx - 4, hy - 6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(hx + 2, hy - 7); ctx.lineTo(hx + 3, hy - 14); ctx.lineTo(hx + 5, hy - 6); ctx.closePath(); ctx.fill();

  // claw arms
  const shoX = 3, shoY = groundY - 17 - bob;
  ctx.strokeStyle = body; ctx.lineWidth = 2.2; ctx.lineCap = "round";
  if (p >= 0 && atkKind !== "tail") {
    // swipe: claw whips from raised to down-forward
    const a = -1.7 + Math.min(p * 1.4, 1) * (atkKind === "pounce" ? 2.65 : 2.3);
    const ax = shoX + Math.cos(a) * 9, ay = shoY + Math.sin(a) * 9;
    ctx.beginPath(); ctx.moveTo(shoX, shoY); ctx.lineTo(ax, ay); ctx.stroke();
    ctx.lineWidth = 1.2;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + Math.cos(a + k * 0.35) * 4, ay + Math.sin(a + k * 0.35) * 4); ctx.stroke();
    }
    // slash smear fading out after the hit
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = atkF * 0.8;
    ctx.strokeStyle = ember; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(shoX + 2, shoY, 12, -1.3, 0.9); ctx.stroke();
    ctx.globalAlpha = atkF * 0.4; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(shoX + 2, shoY, 15, -1.2, 0.8); ctx.stroke();
    ctx.restore();
  } else {
    const dangle = Math.sin(e.anim * 3) * 2;
    ctx.beginPath(); ctx.moveTo(shoX, shoY); ctx.lineTo(shoX + 5 + dangle * 0.4, shoY + 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2, shoY + 1); ctx.lineTo(2 - dangle * 0.4, shoY + 9); ctx.stroke();
  }
  ctx.lineCap = "butt";
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5;
  ctx.fillStyle = emberHot;
  for (let k = 0; k < 3; k++) {
    const ex = -3 + k * 4 + Math.sin(T * 5 + k) * 1.2;
    const ey = groundY - 18 - bob + Math.cos(T * 6 + k) * 4;
    ctx.beginPath(); ctx.arc(ex, ey, 0.9, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.restore();
  if (pounce >= 0) ctx.restore();
}

function drawEmberBrute(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const bob = Math.abs(Math.sin(e.anim * 0.9)) * 2;
  const y = groundY - bob;
  const body = flash ? "#fff" : "#5a1a10";
  const bodyDk = flash ? "#fff" : "#2a0a08";
  const bodyMid = flash ? "#fff" : "#8a3018";
  const ember = "#ff6a20";
  const emberHot = "#ffb040";
  const charging = !!e.charging;
  const chargeFlash = Math.max(0, e.chargeFlash || 0);
  const stompFlash = Math.max(0, e.stompFlash || 0);
  // Real remaining swing time (attackAnim is stretched longer for this enemy), not the
  // generic atkF ratio, so the big wind-up plays out at its full slower duration.
  const swingDur = 0.62;
  const swingRemain = Math.max(0, e.attackAnim || 0);
  const swingT = charging ? Math.min((e.chargeT || 0) * 1.1, 1) : (swingRemain > 0 ? 1 - Math.min(1, swingRemain / swingDur) : -1);
  const lunge = charging ? 6 : (swingRemain > 0 ? Math.sin(Math.min(swingT * 1.3, 1) * Math.PI) * 5 : 0);
  const lean = charging ? 0.28 : 0;

  const SCALE = 2.5;
  ctx.save();
  ctx.translate(0, groundY); ctx.scale(SCALE, SCALE); ctx.translate(0, -groundY);

  // ground scorch pulse when it slams down a stomp
  if (stompFlash > 0) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = stompFlash / 0.35;
    ctx.strokeStyle = ember; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, groundY - 2, 30 * (1.4 - stompFlash), 9, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // fire-charge windup glow
  if (chargeFlash > 0 || charging) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = charging ? 0.5 : chargeFlash / 0.3 * 0.5;
    const aura = ctx.createRadialGradient(0, y - 18, 2, 0, y - 18, 26);
    aura.addColorStop(0, "rgba(255,140,40,0.7)");
    aura.addColorStop(1, "rgba(120,20,0,0)");
    ctx.fillStyle = aura; ctx.beginPath(); ctx.ellipse(0, y - 18, 22, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // constant low fire haze around the whole body
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.16 + 0.08 * Math.sin(T * 4 + e.x);
  const haze = ctx.createRadialGradient(0, y - 16, 2, 0, y - 16, 30);
  haze.addColorStop(0, "rgba(255,120,30,0.55)");
  haze.addColorStop(1, "rgba(120,20,0,0)");
  ctx.fillStyle = haze; ctx.beginPath(); ctx.ellipse(0, y - 16, 24, 30, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // rising embers drifting off the body
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < 6; k++) {
    const wt = (T * 0.55 + k * 0.17) % 1;
    const ex = -8 + k * 3.2 + Math.sin((T + k) * 1.6) * 3;
    const ey = y - 8 - wt * 34;
    ctx.globalAlpha = (1 - wt) * 0.6;
    ctx.fillStyle = k % 2 ? ember : emberHot;
    ctx.beginPath(); ctx.arc(ex, ey, 1.3 * (1 - wt) + 0.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // stubby legs, wide stance
  const s = Math.sin(e.anim * 1.3);
  ctx.strokeStyle = body; ctx.lineWidth = 3.4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-6, groundY - 12 - bob); ctx.lineTo(-9 + s * 3, groundY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, groundY - 12 - bob); ctx.lineTo(9 - s * 3, groundY); ctx.stroke();
  ctx.lineCap = "butt";

  ctx.save();
  ctx.translate(lunge, 0);
  ctx.rotate(lean);

  // broad hunched torso
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, y - 17, 12, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = bodyMid;
  ctx.beginPath(); ctx.ellipse(1, y - 15, 6.5, 8.5, -0.15, 0, Math.PI * 2); ctx.fill();

  // glowing ember core in the chest, flares brighter mid-attack/stomp
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.55 + 0.25 * Math.sin(T * 3 + e.x) + atkF * 0.3 + stompFlash;
  ctx.fillStyle = emberHot;
  ctx.beginPath(); ctx.arc(1, y - 15, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // molten cracks glowing across the torso
  ctx.strokeStyle = "rgba(255,140,40,0.45)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(-3, y - 20, 6, -0.4, 1.2); ctx.stroke();
  ctx.beginPath(); ctx.arc(4, y - 22, 5, 1.8, 3.2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-6, y - 12); ctx.lineTo(-2, y - 18); ctx.lineTo(-5, y - 24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, y - 10); ctx.lineTo(3, y - 16); ctx.lineTo(7, y - 21); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.4 + 0.25 * Math.sin(T * 5 + e.x);
  ctx.strokeStyle = ember; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(-6, y - 12); ctx.lineTo(-2, y - 18); ctx.lineTo(-5, y - 24); ctx.stroke();
  ctx.restore();

  // big heavy brow head, low-slung
  const hx = 5, hy = y - 28;
  const headR = 9.5;
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(hx, hy, headR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = bodyDk;
  ctx.beginPath(); ctx.moveTo(hx - 7, hy - 3.5); ctx.lineTo(hx + 8.5, hy - 6); ctx.lineTo(hx + 7, hy - 0.5); ctx.lineTo(hx - 7, hy + 1); ctx.closePath(); ctx.fill();
  // stubby horns
  ctx.fillStyle = bodyDk;
  ctx.beginPath(); ctx.moveTo(hx - 3, hy - 7); ctx.lineTo(hx - 1.5, hy - 14); ctx.lineTo(hx + 1.5, hy - 7); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(hx + 5.5, hy - 7); ctx.lineTo(hx + 8, hy - 13.5); ctx.lineTo(hx + 9.5, hy - 5.5); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5;
  ctx.fillStyle = ember;
  ctx.beginPath(); ctx.arc(hx - 1.5, hy - 13.5, 1, 0, Math.PI * 2); ctx.arc(hx + 8, hy - 13, 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // eyes: glowing molten sclera behind a dark iris + pupil that tracks its target
  const eyeGlow = 0.55 + 0.25 * dark + Math.max(0, swingT) * 0.3 + (charging ? 0.25 : 0);
  const eL = { x: hx + 2.5, y: hy - 1, r: 2.9 };
  const eR = { x: hx + 7.6, y: hy - 1, r: 2.4 };
  for (const eEye of [eL, eR]) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = eyeGlow;
    ctx.fillStyle = t.eye;
    ctx.beginPath(); ctx.arc(eEye.x, eEye.y, eEye.r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // dark iris + pupil, nudged toward whatever it's facing/attacking
    const look = charging || swingT >= 0 ? 0.5 : 0.2;
    ctx.fillStyle = bodyDk;
    ctx.beginPath(); ctx.arc(eEye.x + look, eEye.y, eEye.r * 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0a0304";
    ctx.beginPath(); ctx.arc(eEye.x + look, eEye.y, eEye.r * 0.34, 0, Math.PI * 2); ctx.fill();
    // tiny highlight speck so the eye reads as wet/alive
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#fff2d8";
    ctx.beginPath(); ctx.arc(eEye.x + look - eEye.r * 0.2, eEye.y - eEye.r * 0.3, eEye.r * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // snarling mouth with an ember glow when attacking
  const jaw = swingT >= 0 ? 1.4 * Math.sin(Math.min(swingT * 1.5, 1) * Math.PI) : 0.2;
  ctx.fillStyle = flash ? "#fff" : "#180404";
  ctx.beginPath(); ctx.moveTo(hx - 1, hy + 4.5); ctx.quadraticCurveTo(hx + 5, hy + 5.5 + jaw, hx + 9, hy + 4); ctx.quadraticCurveTo(hx + 5, hy + 3.4, hx - 1, hy + 4.5); ctx.fill();
  if (jaw > 0.6) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5;
    ctx.fillStyle = ember; ctx.beginPath(); ctx.ellipse(hx + 4.5, hy + 4.8, 2.6, jaw * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // huge slamming fists — both arms swing wide together on an attack or charge
  const shoLX = -4, shoRX = 4, shoY = y - 20;
  ctx.strokeStyle = body; ctx.lineWidth = 3.4; ctx.lineCap = "round";
  if (swingT >= 0) {
    const p = Math.min(swingT * 1.4, 1);
    const swing = Math.sin(p * Math.PI);
    // right arm: winds up high behind, then slams down-forward in a big arc
    const aR = -2.7 + p * 3.6;
    const rx = shoRX + Math.cos(aR) * 15, ry = shoY + Math.sin(aR) * 15;
    ctx.beginPath(); ctx.moveTo(shoRX, shoY); ctx.lineTo(rx, ry); ctx.stroke();
    ctx.fillStyle = bodyDk; ctx.beginPath(); ctx.arc(rx, ry, 3.6, 0, Math.PI * 2); ctx.fill();
    // left arm mirrors with a slight delay for a double-hammer feel
    const aL = Math.PI + 2.7 - p * 3.6;
    const lx = shoLX + Math.cos(aL) * 13, ly = shoY + Math.sin(aL) * 13;
    ctx.beginPath(); ctx.moveTo(shoLX, shoY); ctx.lineTo(lx, ly); ctx.stroke();
    ctx.fillStyle = bodyDk; ctx.beginPath(); ctx.arc(lx, ly, 3.2, 0, Math.PI * 2); ctx.fill();
    // fiery smear trailing the swing
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = swing * 0.75;
    ctx.strokeStyle = ember; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(shoRX, shoY, 16, -2.8, 0.9); ctx.stroke();
    ctx.globalAlpha = swing * 0.4; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(shoRX, shoY, 20, -2.6, 0.7); ctx.stroke();
    ctx.restore();
  } else {
    const dangle = Math.sin(e.anim * 2) * 2;
    ctx.beginPath(); ctx.moveTo(shoRX, shoY); ctx.lineTo(shoRX + 6 + dangle, shoY + 10); ctx.stroke();
    ctx.fillStyle = bodyDk; ctx.beginPath(); ctx.arc(shoRX + 6 + dangle, shoY + 10, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(shoLX, shoY); ctx.lineTo(shoLX - 6 - dangle, shoY + 10); ctx.stroke();
    ctx.fillStyle = bodyDk; ctx.beginPath(); ctx.arc(shoLX - 6 - dangle, shoY + 10, 3.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = "butt";
  ctx.restore();
  ctx.restore();
}

function drawFireImp(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const w = t.w;
  const y = groundY - w * 0.62;
  const flap = Math.sin(e.anim * 5) * 8;
  const charge = Math.max(0, atkF);
  const body = flash ? "#fff" : "#9b2418";
  const darkRed = flash ? "#fff" : "#431018";
  const ember = "#ff6a20";
  const hot = "#ffd060";

  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.22 + 0.15 * Math.sin(T * 9 + e.x);
  const aura = ctx.createRadialGradient(0, y, 2, 0, y, 34);
  aura.addColorStop(0, "rgba(255,180,55,0.65)");
  aura.addColorStop(0.55, "rgba(255,70,15,0.25)");
  aura.addColorStop(1, "rgba(120,0,0,0)");
  ctx.fillStyle = aura; ctx.beginPath(); ctx.ellipse(0, y, 28, 22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // bat-like membrane wings: leading-edge bone, two fingers, sagging membrane
  const drawWing = (sgn, fl) => {
    const tipX = sgn * w * 1.5, tipY = y - 8 + fl;
    const f1X = sgn * w * 1.1, f1Y = y + 2 + fl * 0.6;
    const f2X = sgn * w * 0.75, f2Y = y + 9 + fl * 0.3;
    ctx.fillStyle = darkRed;
    ctx.beginPath();
    ctx.moveTo(sgn * w * 0.3, y + 1);
    ctx.quadraticCurveTo(sgn * w * 0.9, y - 12 + fl * 0.8, tipX, tipY);
    ctx.quadraticCurveTo(sgn * w * 1.25, y + 4 + fl * 0.6, f1X, f1Y);
    ctx.quadraticCurveTo(sgn * w * 0.92, y + 9 + fl * 0.4, f2X, f2Y);
    ctx.quadraticCurveTo(sgn * w * 0.5, y + 11, sgn * w * 0.32, y + 8);
    ctx.closePath(); ctx.fill();
    // bone fingers
    ctx.strokeStyle = flash ? "#fff" : "#2c0a10"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(sgn * w * 0.3, y + 1); ctx.quadraticCurveTo(sgn * w * 0.9, y - 12 + fl * 0.8, tipX, tipY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sgn * w * 0.42, y + 1); ctx.lineTo(f1X, f1Y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sgn * w * 0.42, y + 2.5); ctx.lineTo(f2X, f2Y); ctx.stroke();
    ctx.lineCap = "butt";
    // firelight glowing through the membrane
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.3 + 0.12 * Math.sin(T * 8 + sgn);
    ctx.strokeStyle = ember; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(sgn * w * 0.5, y + 3); ctx.quadraticCurveTo(sgn * w * 0.95, y - 2 + fl * 0.6, sgn * w * 1.25, y - 4 + fl * 0.85); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sgn * w * 0.5, y + 5); ctx.quadraticCurveTo(sgn * w * 0.8, y + 4 + fl * 0.4, sgn * w * 1.0, y + 1 + fl * 0.5); ctx.stroke();
    ctx.restore();
  };
  drawWing(-1, -flap);
  drawWing(1, flap);

  // barbed tail ending in a living flame
  const tSw = Math.sin(T * 7) * 3;
  ctx.strokeStyle = darkRed; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-5, y + 7); ctx.quadraticCurveTo(-18, y + 14, -23, y + 4 + tSw); ctx.stroke();
  ctx.fillStyle = darkRed;
  ctx.beginPath(); ctx.moveTo(-21, y + 6 + tSw); ctx.lineTo(-25, y + 4 + tSw); ctx.lineTo(-22, y + 9 + tSw); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = hot; ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.ellipse(-24, y + 2 + tSw, 2.4, 5 + Math.sin(T * 13) * 1.4, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff8d0"; ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.ellipse(-24, y + 3 + tSw, 1, 2.2, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // pot-bellied body with a glowing furnace chest
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, y + 5, 9, 10, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? "#fff" : "#c04a28";
  ctx.beginPath(); ctx.ellipse(3, y + 5, 4.6, 6.6, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.4 + 0.22 * Math.sin(T * 5 + e.x) + charge * 0.4;
  const chest = ctx.createRadialGradient(3, y + 4, 1, 3, y + 4, 7);
  chest.addColorStop(0, "rgba(255,220,110,0.9)"); chest.addColorStop(1, "rgba(200,40,0,0)");
  ctx.fillStyle = chest; ctx.beginPath(); ctx.arc(3, y + 4, 7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // scale ridges on the back
  ctx.strokeStyle = flash ? "#fff" : "#6e1812"; ctx.lineWidth = 0.9;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath(); ctx.arc(-2.5, y + 3 + k * 3.4, 5.5, Math.PI * 0.7, Math.PI * 1.35); ctx.stroke();
  }

  // head with horns and flame crest
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(6, y - 6, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = darkRed;
  ctx.beginPath(); ctx.moveTo(2, y - 12); ctx.lineTo(-4, y - 20); ctx.lineTo(5, y - 14); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(9, y - 13); ctx.lineTo(13, y - 21); ctx.lineTo(12, y - 12); ctx.closePath(); ctx.fill();
  // flickering flame crest between the horns
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.75;
  ctx.fillStyle = ember;
  ctx.beginPath(); ctx.ellipse(6, y - 16 - Math.abs(Math.sin(T * 11)) * 2, 2.6, 4.5 + Math.sin(T * 11) * 1.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hot;
  ctx.beginPath(); ctx.ellipse(6, y - 15.4, 1.2, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // pointed ears
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.moveTo(0, y - 8); ctx.lineTo(-7, y - 11); ctx.lineTo(0, y - 4.5); ctx.closePath(); ctx.fill();

  // eyes + jaw hinging open as the fireball charges
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.75 + dark * 0.25;
  ctx.fillStyle = hot;
  ctx.beginPath(); ctx.arc(8, y - 7, 2.5, 0, Math.PI * 2); ctx.arc(13, y - 6.5, 2.1, 0, Math.PI * 2); ctx.fill();
  if (charge > 0) {
    const g = ctx.createRadialGradient(19, y - 3, 1, 19, y - 3, 9 + charge * 11);
    g.addColorStop(0, "rgba(255,245,150,1)");
    g.addColorStop(0.5, "rgba(255,90,20,0.75)");
    g.addColorStop(1, "rgba(180,20,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(19, y - 3, 9 + charge * 11, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  const jaw = 1 + charge * 3.5;
  ctx.fillStyle = flash ? "#fff" : "#2a0708";
  ctx.beginPath(); ctx.moveTo(10, y - 2.5); ctx.quadraticCurveTo(14, y - 1 + jaw, 17.5, y - 2.5 + jaw * 0.4); ctx.quadraticCurveTo(14, y - 3.4, 10, y - 2.5); ctx.fill();
  ctx.strokeStyle = flash ? "#fff" : "#f0e0c0"; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(11.5, y - 2.6); ctx.lineTo(12, y - 1.4 + jaw * 0.4); ctx.moveTo(14, y - 2.7); ctx.lineTo(14.5, y - 1.5 + jaw * 0.5); ctx.stroke();

  // grasping arms + little legs dangling in the air
  ctx.strokeStyle = body; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(5, y + 3); ctx.lineTo(14 + charge * 5, y + 1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-3, y + 5); ctx.lineTo(4, y + 13); ctx.stroke();
  const dangle = Math.sin(e.anim * 2.4) * 2;
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(-1, y + 13); ctx.lineTo(-2 + dangle, y + 20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3, y + 13.5); ctx.lineTo(4 - dangle, y + 20.5); ctx.stroke();
  ctx.lineCap = "butt";
  // embers drifting off the body
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.55;
  ctx.fillStyle = hot;
  for (let k = 0; k < 3; k++) {
    const et2 = (T * 0.8 + k * 0.37 + e.x * 0.01) % 1;
    ctx.beginPath(); ctx.arc(-6 + Math.sin((T + k) * 5) * 5 + k * 5, y + 8 - et2 * 26, 1.2 * (1 - et2) + 0.3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// Night-5 boss: enormous winged dragon that strafes the base spitting fireballs.
// Rider imps are separate entities positioned on its back by EnemyAI.
function drawFireDragon(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const flash = e.flash > 0 && !e.dying;
  const w = t.w;
  const yc = groundY - 26;              // body centerline (entity is translated by e.fy)
  const flap = Math.sin(e.anim * 1.6);  // slow, heavy wingbeat
  const charge = e.shootCd !== undefined ? Math.max(0, 1 - Math.max(0, e.shootCd) / 0.55) : 0;
  const scale = flash ? "#fff" : "#7a1408";
  const scaleDk = flash ? "#fff" : "#3c0a06";
  const belly = flash ? "#fff" : "#c05a28";
  const ember = "#ff6a20";
  const hot = "#ffd060";

  // heat aura
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.14 + 0.06 * Math.sin(T * 3);
  const aura = ctx.createRadialGradient(0, yc, 10, 0, yc, w * 1.3);
  aura.addColorStop(0, "rgba(255,140,40,0.55)");
  aura.addColorStop(1, "rgba(120,10,0,0)");
  ctx.fillStyle = aura; ctx.beginPath(); ctx.ellipse(0, yc, w * 1.3, w * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // huge membrane wing (one drawn behind the body, one in front)
  const wing = (lift, col, boneCol, alpha) => {
    const rootX = -w * 0.08, rootY = yc - w * 0.16;
    const tipX = -w * 0.55, tipY = rootY - w * 0.62 * lift;
    const f1X = -w * 1.05, f1Y = rootY - w * 0.38 * lift + w * 0.1;
    const f2X = -w * 1.25, f2Y = rootY - w * 0.05 * lift + w * 0.22;
    const f3X = -w * 1.05, f3Y = rootY + w * 0.22 - w * 0.02 * lift;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(rootX, rootY);
    ctx.quadraticCurveTo(-w * 0.3, tipY - w * 0.12, tipX, tipY);
    ctx.quadraticCurveTo(-w * 0.85, tipY + w * 0.02, f1X, f1Y);
    ctx.quadraticCurveTo(-w * 1.2, f1Y + w * 0.14, f2X, f2Y);
    ctx.quadraticCurveTo(-w * 1.18, f2Y + w * 0.14, f3X, f3Y);
    ctx.quadraticCurveTo(-w * 0.5, rootY + w * 0.24, rootX, rootY + w * 0.1);
    ctx.closePath(); ctx.fill();
    // wing bones
    ctx.strokeStyle = boneCol; ctx.lineWidth = Math.max(2.5, w * 0.03); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(rootX, rootY); ctx.quadraticCurveTo(-w * 0.3, tipY - w * 0.12, tipX, tipY); ctx.stroke();
    ctx.lineWidth = Math.max(1.8, w * 0.02);
    ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(f1X, f1Y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(f2X, f2Y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(f3X, f3Y); ctx.stroke();
    ctx.lineCap = "butt";
    // firelight veins in the membrane
    ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = alpha * (0.3 + 0.15 * Math.sin(T * 5));
    ctx.strokeStyle = ember; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(rootX - w * 0.15, rootY + w * 0.02); ctx.quadraticCurveTo(-w * 0.7, f1Y - w * 0.05, f1X + w * 0.1, f1Y - w * 0.02); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rootX - w * 0.15, rootY + w * 0.08); ctx.quadraticCurveTo(-w * 0.75, f2Y - w * 0.1, f2X + w * 0.12, f2Y - w * 0.04); ctx.stroke();
    ctx.restore();
  };
  wing(flap * 0.85 + 1.05, scaleDk, flash ? "#fff" : "#240504", 0.8);   // far wing

  // tail: long, whipping, with fin barbs and a flame tip
  const tw = Math.sin(T * 2.6) * w * 0.06;
  ctx.strokeStyle = scale; ctx.lineWidth = Math.max(5, w * 0.075); ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-w * 0.42, yc + w * 0.02);
  ctx.quadraticCurveTo(-w * 0.85, yc + w * 0.12 + tw, -w * 1.15, yc - w * 0.05 + tw * 1.6);
  ctx.stroke();
  ctx.lineWidth = Math.max(3, w * 0.04);
  ctx.beginPath();
  ctx.moveTo(-w * 1.15, yc - w * 0.05 + tw * 1.6);
  ctx.quadraticCurveTo(-w * 1.35, yc - w * 0.14 + tw * 2, -w * 1.48, yc - w * 0.08 + tw * 2.4);
  ctx.stroke(); ctx.lineCap = "butt";
  ctx.fillStyle = scaleDk;
  for (let k = 0; k < 4; k++) {
    const tfx = -w * (0.55 + k * 0.17), tfy = yc + w * 0.06 + tw * (0.4 + k * 0.3) - k * w * 0.02;
    ctx.beginPath(); ctx.moveTo(tfx, tfy); ctx.lineTo(tfx - w * 0.045, tfy - w * 0.085); ctx.lineTo(tfx - w * 0.09, tfy + w * 0.005); ctx.closePath(); ctx.fill();
  }
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.85;
  ctx.fillStyle = ember;
  ctx.beginPath(); ctx.ellipse(-w * 1.5, yc - w * 0.1 + tw * 2.4, w * 0.045, w * 0.1 + Math.sin(T * 12) * 2, 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hot;
  ctx.beginPath(); ctx.ellipse(-w * 1.49, yc - w * 0.09 + tw * 2.4, w * 0.02, w * 0.045, 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // long body
  const heave = Math.sin(T * 2.2) * w * 0.012;
  ctx.fillStyle = scale;
  ctx.beginPath(); ctx.ellipse(0, yc, w * 0.52, w * 0.24 + heave, -0.06, 0, Math.PI * 2); ctx.fill();
  // glowing belly plates
  ctx.fillStyle = belly;
  ctx.beginPath(); ctx.ellipse(w * 0.04, yc + w * 0.1, w * 0.4, w * 0.13, -0.05, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = flash ? "#fff" : "#8a3a16"; ctx.lineWidth = 1.6;
  for (let k = -3; k <= 3; k++) {
    ctx.beginPath(); ctx.moveTo(k * w * 0.11 - w * 0.04, yc + w * 0.02); ctx.quadraticCurveTo(k * w * 0.11, yc + w * 0.16, k * w * 0.11 + w * 0.05, yc + w * 0.02); ctx.stroke();
  }
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.25 + 0.15 * Math.sin(T * 4) + charge * 0.3;
  const bg = ctx.createRadialGradient(w * 0.1, yc + w * 0.08, 2, w * 0.1, yc + w * 0.08, w * 0.4);
  bg.addColorStop(0, "rgba(255,200,90,0.8)"); bg.addColorStop(1, "rgba(200,40,0,0)");
  ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(w * 0.1, yc + w * 0.08, w * 0.4, w * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // dorsal spines
  ctx.fillStyle = scaleDk;
  for (let k = 0; k < 6; k++) {
    const sx = -w * 0.36 + k * w * 0.13, sy = yc - w * 0.2 - heave;
    const sh = w * (0.08 + (k % 2) * 0.035);
    ctx.beginPath(); ctx.moveTo(sx - w * 0.03, sy + 3); ctx.lineTo(sx, sy - sh); ctx.lineTo(sx + w * 0.03, sy + 3); ctx.closePath(); ctx.fill();
  }
  // tucked hind leg with claws
  ctx.strokeStyle = scaleDk; ctx.lineWidth = Math.max(3.5, w * 0.05); ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-w * 0.18, yc + w * 0.14); ctx.lineTo(-w * 0.1, yc + w * 0.3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.22, yc + w * 0.14); ctx.lineTo(w * 0.3, yc + w * 0.28); ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-w * 0.1, yc + w * 0.3); ctx.lineTo(-w * 0.05, yc + w * 0.34); ctx.moveTo(-w * 0.1, yc + w * 0.3); ctx.lineTo(-w * 0.13, yc + w * 0.35); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.3, yc + w * 0.28); ctx.lineTo(w * 0.35, yc + w * 0.32); ctx.moveTo(w * 0.3, yc + w * 0.28); ctx.lineTo(w * 0.27, yc + w * 0.33); ctx.stroke();
  ctx.lineCap = "butt";

  // neck arcing up and forward to the head
  const hX = w * 0.72, hY = yc - w * 0.3 + Math.sin(T * 2.2) * 2;
  ctx.strokeStyle = scale; ctx.lineWidth = Math.max(8, w * 0.13); ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(w * 0.4, yc - w * 0.05); ctx.quadraticCurveTo(w * 0.6, yc - w * 0.28, hX, hY); ctx.stroke();
  ctx.lineCap = "butt";

  // head: horns, brow, jaw that gapes as fire builds
  const jawOpen = charge * 0.5 + (e.attackAnim > 0 ? 0.35 : 0.06);
  ctx.save(); ctx.translate(hX, hY);
  // horns swept back
  ctx.fillStyle = scaleDk;
  ctx.beginPath(); ctx.moveTo(-w * 0.02, -w * 0.06); ctx.quadraticCurveTo(-w * 0.16, -w * 0.16, -w * 0.24, -w * 0.14); ctx.lineTo(-w * 0.05, -w * 0.02); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w * 0.02, -w * 0.08); ctx.quadraticCurveTo(-w * 0.08, -w * 0.22, -w * 0.17, -w * 0.22); ctx.lineTo(0, -w * 0.03); ctx.closePath(); ctx.fill();
  // skull + upper jaw
  ctx.fillStyle = scale;
  ctx.beginPath();
  ctx.moveTo(-w * 0.08, -w * 0.08);
  ctx.quadraticCurveTo(w * 0.1, -w * 0.13, w * 0.3, -w * 0.02 - jawOpen * w * 0.06);
  ctx.lineTo(w * 0.28, w * 0.02 - jawOpen * w * 0.04);
  ctx.quadraticCurveTo(w * 0.05, w * 0.04, -w * 0.08, w * 0.06);
  ctx.closePath(); ctx.fill();
  // lower jaw hinging open
  ctx.fillStyle = scaleDk;
  ctx.beginPath();
  ctx.moveTo(-w * 0.04, w * 0.05);
  ctx.quadraticCurveTo(w * 0.12, w * 0.06 + jawOpen * w * 0.16, w * 0.27, w * 0.04 + jawOpen * w * 0.2);
  ctx.lineTo(w * 0.24, w * 0.08 + jawOpen * w * 0.22);
  ctx.quadraticCurveTo(w * 0.06, w * 0.11 + jawOpen * w * 0.12, -w * 0.05, w * 0.09);
  ctx.closePath(); ctx.fill();
  // teeth
  ctx.fillStyle = flash ? "#fff" : "#f0e0c0";
  for (let k = 0; k < 4; k++) {
    const tx = w * (0.1 + k * 0.05);
    ctx.beginPath(); ctx.moveTo(tx, w * 0.015); ctx.lineTo(tx + w * 0.012, w * 0.045 + jawOpen * w * 0.03); ctx.lineTo(tx + w * 0.024, w * 0.015); ctx.closePath(); ctx.fill();
  }
  // fire glowing in the throat, building to a blast
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.35 + charge * 0.65;
  const mg = ctx.createRadialGradient(w * 0.18, w * 0.04, 1, w * 0.18, w * 0.04, w * (0.08 + charge * 0.16));
  mg.addColorStop(0, "rgba(255,245,150,1)");
  mg.addColorStop(0.5, "rgba(255,100,20,0.8)");
  mg.addColorStop(1, "rgba(180,20,0,0)");
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(w * 0.18, w * 0.04, w * (0.08 + charge * 0.16), 0, Math.PI * 2); ctx.fill();
  // burning eye
  ctx.globalAlpha = 0.8 + 0.2 * dark;
  ctx.fillStyle = hot;
  ctx.beginPath(); ctx.arc(w * 0.06, -w * 0.045, w * 0.035, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = flash ? "#fff" : "#3c0a06";
  ctx.beginPath(); ctx.arc(w * 0.065, -w * 0.045, w * 0.013, 0, Math.PI * 2); ctx.fill();
  // smoke curling from the nostril
  ctx.save(); ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#2a1512";
  for (let k = 0; k < 2; k++) {
    const st = (T * 0.9 + k * 0.5) % 1;
    ctx.beginPath(); ctx.arc(w * 0.27 + Math.sin((T + k) * 4) * 2, -w * 0.03 - st * w * 0.14, (1 - st) * 2.6 + 0.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.restore();

  wing(-flap * 0.85 - 0.15, scale, scaleDk, 1); // near wing, sweeping in front

  // embers streaming off the beast
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.6;
  ctx.fillStyle = hot;
  for (let k = 0; k < 5; k++) {
    const et2 = (T * 0.6 + k * 0.21) % 1;
    ctx.beginPath();
    ctx.arc(-w * 0.3 + k * w * 0.16 + Math.sin((T + k * 1.7) * 4) * 6, yc + w * 0.2 + et2 * w * 0.4, 1.6 * (1 - et2) + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Night-10 boss: towering magma colossus. It is rendered as layered basalt
// plates around a molten core, with separate poses for slam and boulder volleys.
function drawMagmaGolem(e, t, dark, atkF) {
  const T = performance.now() / 1000;
  const w = t.w;
  const flash = e.flash > 0 && !e.dying;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const smooth = v => {
    v = clamp01(v);
    return v * v * (3 - 2 * v);
  };
  const mix = (a, b, p) => a + (b - a) * p;
  const mixPt = (a, b, p) => ({ x: mix(a.x, b.x, p), y: mix(a.y, b.y, p) });
  const poly = pts => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  };

  const obsidian = flash ? "#fff" : "#211817";
  const basalt = flash ? "#fff" : "#332623";
  const basalt2 = flash ? "#fff" : "#46352f";
  const basalt3 = flash ? "#fff" : "#594238";
  const shadow = flash ? "#fff" : "#120d0c";
  const ember = e.enraged ? "#ff3f20" : "#ff6a20";
  const hot = "#ffd060";
  const whiteHot = "#fff3bf";

  const coreOpen = !!e.coreOpen;
  const coreFlare = clamp01(e.coreFlare || 0);
  const eruptionP = clamp01((e.eruptionAnim || 0) / 1.4);
  const windupP = e.slamT !== undefined ? clamp01(e.slamT / 0.85) : 0;
  const slamP = e.attackKind === "slam" && e.attackAnim > 0 ? clamp01(e.attackAnim / 0.42) : 0;
  const throwAge = e.attackKind === "hurl" && e.hurlAnim > 0 ? clamp01(1 - e.hurlAnim / 0.58) : 0;
  const hurlHold = e.hurlCount > 0 ? 1 : 0;
  const hurlActive = hurlHold > 0 || throwAge > 0;
  const hurlPulse = hurlActive ? (0.75 + 0.18 * Math.sin(T * 10)) : 0;
  const slamEase = smooth(slamP);
  const step = Math.sin(e.anim * 2.4);
  const stride = step * w * 0.05 * (1 - windupP * 0.6 - slamEase * 0.7);
  const bob = Math.abs(step) * 3 * (1 - slamEase * 0.7) - windupP * w * 0.035 + slamEase * w * 0.025;
  const bodyShift = -bob;

  function rockBlob(cx, cy, rx, ry, rot, fill, stroke = shadow, spikes = 8) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      const n = 0.88 + (i % 3) * 0.07 + Math.sin(i * 2.1 + T) * 0.025;
      const px = Math.cos(a) * rx * n;
      const py = Math.sin(a) * ry * n;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(1.1, w * 0.01);
      ctx.stroke();
    }
    ctx.restore();
  }

  function lavaCrack(points, width = 1.8, alpha = 1) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = ember;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,224,120,0.55)";
    ctx.lineWidth = Math.max(0.8, width * 0.42);
    ctx.stroke();
    ctx.restore();
  }

  // Ground mass, molten shadow and slam shock rings.
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.beginPath();
  ctx.ellipse(0, groundY - 1, w * (0.58 + slamEase * 0.15), 11 + slamEase * 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.18 + (coreOpen ? 0.16 : 0) + coreFlare * 0.18 + eruptionP * 0.22;
  const floorGlow = ctx.createRadialGradient(0, groundY - 4, 4, 0, groundY - 4, w * 0.86);
  floorGlow.addColorStop(0, "rgba(255,170,48,0.75)");
  floorGlow.addColorStop(1, "rgba(120,18,0,0)");
  ctx.fillStyle = floorGlow;
  ctx.beginPath();
  ctx.ellipse(0, groundY - 5, w * 0.86, w * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  if (slamP > 0.03) {
    const spread = (1 - slamP) * w * 0.52;
    for (let k = 0; k < 3; k++) {
      ctx.globalAlpha = slamP * (0.42 - k * 0.09);
      ctx.strokeStyle = k === 0 ? hot : ember;
      ctx.lineWidth = 3 - k * 0.45;
      ctx.beginPath();
      ctx.ellipse(0, groundY - 4, w * (0.42 + k * 0.2) + spread, w * (0.12 + k * 0.04) + spread * 0.17, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Heat aura and eruption flare.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = (coreOpen ? 0.28 : 0.14) + coreFlare * 0.22 + eruptionP * 0.22 + (e.enraged ? 0.08 : 0);
  const aura = ctx.createRadialGradient(0, groundY - w * 0.56, 10, 0, groundY - w * 0.56, w * 1.18);
  aura.addColorStop(0, "rgba(255,186,64,0.66)");
  aura.addColorStop(0.52, "rgba(255,88,24,0.24)");
  aura.addColorStop(1, "rgba(120,10,0,0)");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.ellipse(0, groundY - w * 0.56, w * 1.02, w * 0.84, 0, 0, Math.PI * 2);
  ctx.fill();
  if (eruptionP > 0.02) {
    for (let k = 0; k < 6; k++) {
      const ex = -w * 0.34 + k * w * 0.13;
      const h = w * (0.14 + 0.16 * Math.sin(T * 4 + k) + 0.25 * eruptionP);
      ctx.globalAlpha = eruptionP * (0.2 + k % 2 * 0.08);
      ctx.fillStyle = k % 2 ? hot : ember;
      ctx.beginPath();
      ctx.ellipse(ex, groundY - w * 0.28 - h * 0.5, w * 0.025, h, Math.sin(T + k) * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Smoke vents from shoulders and back fissures.
  ctx.save();
  ctx.fillStyle = "#17100f";
  for (let k = 0; k < 7; k++) {
    const st = (T * (0.22 + k * 0.035) + k * 0.17) % 1;
    ctx.globalAlpha = (0.17 + dark * 0.05) * (1 - st);
    const sx = -w * 0.28 + k * w * 0.095 + Math.sin(T * 1.8 + k) * 5;
    const sy = groundY - w * (0.77 + (k % 3) * 0.055) + bodyShift - st * w * 0.34;
    ctx.beginPath();
    ctx.ellipse(sx, sy, w * (0.025 + st * 0.025), w * (0.018 + st * 0.032), Math.sin(T + k), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  function drawLeg(sgn, front) {
    const phase = Math.sin(e.anim * 2.4 + (sgn > 0 ? 0 : Math.PI));
    const lift = Math.max(0, phase) * w * 0.035 * (1 - slamEase);
    const hipX = sgn * w * 0.13 - stride * 0.18;
    const kneeX = sgn * w * 0.15 + stride * 0.16;
    const footX = sgn * w * 0.2 + stride * (front ? 0.3 : -0.2);
    const hipY = groundY - w * 0.38 + bodyShift * 0.45;
    const kneeY = groundY - w * 0.2 - lift * 0.35;
    const footY = groundY - lift + slamEase * 3;
    ctx.save();
    ctx.globalAlpha = front ? 1 : 0.82;
    ctx.fillStyle = front ? basalt2 : basalt;
    poly([
      [hipX - w * 0.09, hipY],
      [hipX + w * 0.08, hipY + w * 0.02],
      [kneeX + w * 0.075, kneeY],
      [kneeX - w * 0.07, kneeY + w * 0.02],
    ]);
    ctx.fill();
    ctx.fillStyle = front ? basalt3 : obsidian;
    poly([
      [kneeX - w * 0.075, kneeY],
      [kneeX + w * 0.07, kneeY - w * 0.01],
      [footX + w * 0.08, footY - w * 0.035],
      [footX - w * 0.09, footY - w * 0.025],
    ]);
    ctx.fill();
    ctx.fillStyle = front ? obsidian : shadow;
    roundedRect(footX - w * 0.15, footY - 8, w * 0.31, 9 + slamEase * 2, 3);
    ctx.fill();
    rockBlob(kneeX, kneeY + w * 0.005, w * 0.09, w * 0.055, 0.05 * sgn, front ? basalt3 : basalt2, shadow, 7);
    lavaCrack([[kneeX - w * 0.052, kneeY + w * 0.015], [kneeX + w * 0.005, kneeY - w * 0.01], [kneeX + w * 0.055, kneeY + w * 0.008]], 1.35, 0.35 + 0.18 * Math.sin(T * 5 + sgn));
    lavaCrack([[footX - w * 0.07, footY - 5], [footX - w * 0.005, footY - 7], [footX + w * 0.06, footY - 4]], 1.2, front ? 0.5 : 0.28);
    ctx.restore();
  }

  drawLeg(-1, false);
  drawLeg(1, true);

  function armPose(front) {
    const idle = {
      shoulder: { x: (front ? 0.25 : -0.27) * w, y: groundY - w * 0.72 + bodyShift },
      elbow: { x: (front ? 0.37 : -0.38) * w, y: groundY - w * 0.42 + bodyShift * 0.35 },
      fist: { x: (front ? 0.46 : -0.42) * w, y: groundY - w * 0.14 + Math.sin(e.anim * 2.4 + (front ? 0.2 : 2.4)) * 2 },
    };
    const slamUp = {
      shoulder: idle.shoulder,
      elbow: { x: (front ? 0.28 : -0.2) * w, y: groundY - w * 0.98 + bodyShift },
      fist: { x: (front ? 0.16 : -0.08) * w, y: groundY - w * 1.12 + bodyShift },
    };
    const slamDown = {
      shoulder: idle.shoulder,
      elbow: { x: (front ? 0.42 : -0.33) * w, y: groundY - w * 0.36 },
      fist: { x: (front ? 0.5 : -0.37) * w, y: groundY - w * 0.04 },
    };
    const hurlLoad = {
      shoulder: idle.shoulder,
      elbow: { x: front ? w * 0.17 : -w * 0.43, y: front ? groundY - w * 1.02 + bodyShift : groundY - w * 0.43 },
      fist: { x: front ? w * 0.04 : -w * 0.48, y: front ? groundY - w * 1.07 + bodyShift : groundY - w * 0.2 },
    };
    const hurlRelease = {
      shoulder: idle.shoulder,
      elbow: { x: front ? w * 0.47 : -w * 0.38, y: front ? groundY - w * 0.72 : groundY - w * 0.36 },
      fist: { x: front ? w * 0.63 : -w * 0.43, y: front ? groundY - w * 0.54 : groundY - w * 0.17 },
    };

    let pose = idle;
    if (hurlActive && windupP <= 0 && slamP <= 0) {
      const p = front ? smooth(throwAge) : 0;
      const held = front ? hurlLoad : hurlRelease;
      pose = {
        shoulder: idle.shoulder,
        elbow: mixPt(held.elbow, hurlRelease.elbow, p),
        fist: mixPt(held.fist, hurlRelease.fist, p),
      };
      if (!front && hurlHold) pose = hurlLoad;
    }
    if (windupP > 0) {
      const p = smooth(windupP);
      pose = {
        shoulder: idle.shoulder,
        elbow: mixPt(idle.elbow, slamUp.elbow, p),
        fist: mixPt(idle.fist, slamUp.fist, p),
      };
    }
    if (slamP > 0) {
      const p = smooth(slamP);
      pose = {
        shoulder: idle.shoulder,
        elbow: mixPt(idle.elbow, slamDown.elbow, p),
        fist: mixPt(idle.fist, slamDown.fist, p),
      };
    }
    return pose;
  }

  function drawMagmaBoulder(x, y, r, charge) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.65 + charge * 0.25;
    const bg = ctx.createRadialGradient(x, y, 2, x, y, r * (2.2 + charge));
    bg.addColorStop(0, "rgba(255,245,170,1)");
    bg.addColorStop(0.35, "rgba(255,126,28,0.88)");
    bg.addColorStop(1, "rgba(160,18,0,0)");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(x, y, r * (2.1 + charge), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    rockBlob(x, y, r * 0.9, r * 0.75, T * 0.8, basalt2, shadow, 9);
    lavaCrack([[x - r * 0.5, y - r * 0.08], [x, y - r * 0.35], [x + r * 0.5, y - r * 0.03]], 1.7, 0.9);
    lavaCrack([[x - r * 0.32, y + r * 0.25], [x + r * 0.1, y + r * 0.05], [x + r * 0.43, y + r * 0.32]], 1.4, 0.75);
  }

  function drawArm(pose, front) {
    ctx.save();
    ctx.globalAlpha = front ? 1 : 0.84;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = front ? basalt2 : obsidian;
    ctx.lineWidth = w * 0.115;
    ctx.beginPath();
    ctx.moveTo(pose.shoulder.x, pose.shoulder.y);
    ctx.lineTo(pose.elbow.x, pose.elbow.y);
    ctx.lineTo(pose.fist.x, pose.fist.y - w * 0.035);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = w * 0.04;
    ctx.beginPath();
    ctx.moveTo(pose.shoulder.x - w * 0.015, pose.shoulder.y - w * 0.01);
    ctx.lineTo(pose.elbow.x - w * 0.02, pose.elbow.y - w * 0.02);
    ctx.stroke();
    ctx.lineCap = "butt";
    rockBlob(pose.shoulder.x, pose.shoulder.y, w * 0.085, w * 0.06, 0.25, front ? basalt3 : basalt, shadow, 7);
    rockBlob(pose.elbow.x, pose.elbow.y, w * 0.075, w * 0.06, -0.2, front ? basalt3 : basalt2, shadow, 7);
    rockBlob(pose.fist.x, pose.fist.y - w * 0.03, w * 0.13, w * 0.1, front ? 0.22 : -0.12, front ? basalt3 : basalt2, shadow, 10);
    lavaCrack([[pose.elbow.x - w * 0.04, pose.elbow.y], [pose.elbow.x + w * 0.02, pose.elbow.y - w * 0.025], [pose.elbow.x + w * 0.05, pose.elbow.y + w * 0.02]], 1.25, front ? 0.55 : 0.36);
    lavaCrack([[pose.fist.x - w * 0.075, pose.fist.y - w * 0.045], [pose.fist.x - w * 0.01, pose.fist.y - w * 0.075], [pose.fist.x + w * 0.07, pose.fist.y - w * 0.02]], 1.45, 0.6 + hurlPulse * 0.3);
    if (front && hurlActive && (hurlHold || throwAge < 0.72)) {
      const charge = hurlHold ? 0.8 + Math.sin(T * 9) * 0.1 : 1 - throwAge * 0.6;
      drawMagmaBoulder(pose.fist.x + w * 0.03, pose.fist.y - w * 0.15, w * 0.075, charge);
    }
    ctx.restore();
  }

  drawArm(armPose(false), false);

  // Torso: layered obsidian plates around the molten heart.
  ctx.save();
  const pivotY = groundY - w * 0.56;
  ctx.translate(0, pivotY + bodyShift + slamEase * w * 0.02);
  ctx.rotate(step * 0.018 - windupP * 0.085 + slamEase * 0.07 - (hurlActive ? 0.035 : 0));
  ctx.translate(0, -pivotY);

  ctx.fillStyle = shadow;
  poly([
    [-w * 0.39, groundY - w * 0.25],
    [-w * 0.47, groundY - w * 0.59],
    [-w * 0.3, groundY - w * 0.86],
    [-w * 0.04, groundY - w * 1.0],
    [w * 0.26, groundY - w * 0.87],
    [w * 0.41, groundY - w * 0.55],
    [w * 0.35, groundY - w * 0.27],
    [w * 0.02, groundY - w * 0.2],
  ]);
  ctx.fill();

  const bodyGrad = ctx.createLinearGradient(-w * 0.35, groundY - w * 0.9, w * 0.35, groundY - w * 0.25);
  bodyGrad.addColorStop(0, basalt2);
  bodyGrad.addColorStop(0.45, basalt);
  bodyGrad.addColorStop(1, obsidian);
  ctx.fillStyle = bodyGrad;
  poly([
    [-w * 0.34, groundY - w * 0.28],
    [-w * 0.43, groundY - w * 0.62],
    [-w * 0.18, groundY - w * 0.91],
    [w * 0.11, groundY - w * 1.02],
    [w * 0.32, groundY - w * 0.82],
    [w * 0.42, groundY - w * 0.5],
    [w * 0.3, groundY - w * 0.27],
    [-w * 0.02, groundY - w * 0.22],
  ]);
  ctx.fill();

  // Armor plates.
  const plates = [
    { c: basalt3, pts: [[-0.31, -0.71], [-0.13, -0.87], [0.02, -0.78], [-0.05, -0.57], [-0.27, -0.52]] },
    { c: basalt2, pts: [[0.02, -0.82], [0.24, -0.78], [0.32, -0.58], [0.14, -0.5], [0.02, -0.6]] },
    { c: basalt, pts: [[-0.28, -0.48], [-0.06, -0.54], [0.04, -0.39], [-0.08, -0.3], [-0.31, -0.34]] },
    { c: obsidian, pts: [[0.09, -0.46], [0.32, -0.42], [0.26, -0.28], [0.07, -0.27], [0.01, -0.36]] },
    { c: basalt2, pts: [[-0.1, -0.97], [0.13, -1.0], [0.23, -0.86], [0.05, -0.78], [-0.17, -0.83]] },
  ];
  for (const p of plates) {
    ctx.fillStyle = p.c;
    poly(p.pts.map(([x, y]) => [x * w, groundY + y * w]));
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.beginPath();
  ctx.ellipse(-w * 0.18, groundY - w * 0.68, w * 0.12, w * 0.24, -0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.26)";
  ctx.beginPath();
  ctx.ellipse(w * 0.22, groundY - w * 0.52, w * 0.12, w * 0.25, 0.25, 0, Math.PI * 2);
  ctx.fill();

  const crackAlpha = (coreOpen ? 0.85 : 0.4) + coreFlare * 0.35 + Math.sin(T * 7) * 0.08;
  lavaCrack([[-w * 0.27, groundY - w * 0.42], [-w * 0.16, groundY - w * 0.5], [-w * 0.2, groundY - w * 0.61], [-w * 0.08, groundY - w * 0.69]], 1.8, crackAlpha);
  lavaCrack([[w * 0.13, groundY - w * 0.39], [w * 0.22, groundY - w * 0.52], [w * 0.16, groundY - w * 0.67]], 1.8, crackAlpha);
  lavaCrack([[-w * 0.02, groundY - w * 0.79], [w * 0.04, groundY - w * 0.88], [w * 0.15, groundY - w * 0.83]], 1.4, crackAlpha * 0.8);

  // Back and shoulder spikes.
  ctx.fillStyle = obsidian;
  for (let k = 0; k < 7; k++) {
    const sx = -w * 0.36 + k * w * 0.11;
    const sy = groundY - w * (0.69 + Math.sin(k * 1.3) * 0.035 + k * 0.035);
    const sh = w * (0.085 + (k % 3) * 0.028);
    poly([[sx - w * 0.035, sy], [sx + w * 0.002, sy - sh], [sx + w * 0.04, sy + w * 0.006]]);
    ctx.fill();
  }

  // Chest core with sliding basalt shutters.
  const cx = w * 0.075;
  const cy = groundY - w * 0.555;
  const cr = w * 0.12;
  const openAmt = coreOpen ? 1 : coreFlare * 0.45;
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(cx, cy, cr * 1.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.32 + openAmt * 0.65 + coreFlare * 0.3;
  const coreGlow = ctx.createRadialGradient(cx, cy, 2, cx, cy, cr * (2.1 + openAmt * 1.5 + coreFlare));
  coreGlow.addColorStop(0, "rgba(255,248,190,1)");
  coreGlow.addColorStop(0.35, "rgba(255,168,44,0.9)");
  coreGlow.addColorStop(0.75, "rgba(255,70,18,0.34)");
  coreGlow.addColorStop(1, "rgba(140,16,0,0)");
  ctx.fillStyle = coreGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, cr * (2.1 + openAmt * 1.5 + coreFlare), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const pulse = 1 + Math.sin(T * (coreOpen ? 9 : 4)) * 0.1 + coreFlare * 0.14;
  ctx.fillStyle = hot;
  ctx.beginPath();
  ctx.arc(cx, cy, cr * (0.55 + openAmt * 0.34) * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = whiteHot;
  ctx.beginPath();
  ctx.arc(cx, cy, cr * (0.2 + openAmt * 0.17) * pulse, 0, Math.PI * 2);
  ctx.fill();

  const shutter = (ang, ox, oy, sx, sy) => {
    ctx.save();
    ctx.translate(cx + ox * openAmt, cy + oy * openAmt);
    ctx.rotate(ang * openAmt);
    ctx.fillStyle = basalt2;
    poly([[-cr * sx, -cr * sy], [cr * 0.95, -cr * 0.38], [cr * 0.82, cr * 0.32], [-cr * 0.75, cr * 0.48]]);
    ctx.fill();
    ctx.strokeStyle = shadow;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  };
  shutter(-0.55, -cr * 0.9, -cr * 0.16, 1.05, 0.45);
  shutter(0.48, cr * 0.82, cr * 0.18, 0.95, 0.5);
  shutter(0.15, -cr * 0.12, cr * 0.72, 0.7, 0.35);

  // Head: furnace mask, jaw and crown shards.
  const hx = w * 0.24 + (hurlActive ? w * 0.02 : 0);
  const hy = groundY - w * 0.91 + bodyShift * 0.55 + windupP * w * 0.04 + slamEase * w * 0.025;
  ctx.fillStyle = obsidian;
  poly([[hx - w * 0.09, hy + w * 0.09], [hx - w * 0.04, hy + w * 0.16], [hx + w * 0.11, hy + w * 0.13], [hx + w * 0.15, hy + w * 0.04], [hx + w * 0.08, hy - w * 0.01], [hx - w * 0.07, hy]]);
  ctx.fill();
  ctx.fillStyle = basalt3;
  poly([[hx - w * 0.12, hy + w * 0.06], [hx - w * 0.08, hy - w * 0.09], [hx + w * 0.09, hy - w * 0.075], [hx + w * 0.15, hy + w * 0.025], [hx + w * 0.07, hy + w * 0.1], [hx - w * 0.06, hy + w * 0.095]]);
  ctx.fill();
  ctx.fillStyle = shadow;
  poly([[hx - w * 0.08, hy - w * 0.075], [hx - w * 0.055, hy - w * 0.18], [hx - w * 0.005, hy - w * 0.08]]);
  ctx.fill();
  poly([[hx + w * 0.02, hy - w * 0.08], [hx + w * 0.06, hy - w * 0.165], [hx + w * 0.095, hy - w * 0.07]]);
  ctx.fill();
  poly([[hx + w * 0.09, hy - w * 0.055], [hx + w * 0.145, hy - w * 0.12], [hx + w * 0.14, hy - w * 0.015]]);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.72 + dark * 0.22 + coreFlare * 0.25;
  ctx.fillStyle = e.enraged ? "#ff4d2d" : hot;
  ctx.beginPath();
  ctx.ellipse(hx + w * 0.025, hy - w * 0.008, w * 0.033, w * 0.021, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(hx + w * 0.094, hy - w * 0.003, w * 0.027, w * 0.018, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  lavaCrack([[hx - w * 0.05, hy + w * 0.055], [hx + w * 0.015, hy + w * 0.075], [hx + w * 0.105, hy + w * 0.045]], 1.35, 0.6);
  lavaCrack([[hx + w * 0.115, hy + w * 0.015], [hx + w * 0.145, hy + w * 0.045], [hx + w * 0.11, hy + w * 0.075]], 1.1, 0.5);

  ctx.restore();

  drawArm(armPose(true), true);

  // Falling lava, cinders and orbiting stone flakes.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < 8; k++) {
    const dripT = (T * (0.48 + k * 0.035) + k * 0.19) % 1;
    const dx = -w * 0.3 + k * w * 0.086 + Math.sin(T * 2.2 + k) * 3;
    const dy = groundY - w * (0.42 + (k % 3) * 0.08) + dripT * w * 0.34;
    ctx.globalAlpha = (0.45 + coreOpen * 0.25 + e.enraged * 0.15) * (1 - dripT * 0.75);
    ctx.fillStyle = k % 2 ? hot : ember;
    ctx.beginPath();
    ctx.ellipse(dx, dy, 1.2 + (k % 3) * 0.45, 3.8 * (1 - dripT) + 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let k = 0; k < 10; k++) {
    const a = T * (0.5 + k * 0.03) + k * 1.7;
    const r = w * (0.42 + (k % 3) * 0.08);
    const px = Math.cos(a) * r * 0.35;
    const py = groundY - w * 0.62 + Math.sin(a * 1.3) * w * 0.16;
    ctx.globalAlpha = 0.25 + (k % 2) * 0.12;
    ctx.fillStyle = k % 3 ? ember : hot;
    ctx.beginPath();
    ctx.arc(px, py, 1.1 + (k % 3) * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawEnemies(dark) {
  for (const e of state.enemies) {
    const t=ENEMY_TYPES[e.type];
    if (!t) continue;
    let drawYOff = e.type === "imp" && e.aiState === "stacking" && e.impStackY !== undefined ? e.impStackY : (e.fy || 0);
    const bossT = performance.now()/1000;

    const w=t.w, bob=Math.abs(Math.sin(e.anim*2))*2;
    const isBoss = !!t.boss;
    const atkF = Math.max(0, e.attackAnim || 0) / 0.25;
    const custom = e.type === "imp" ? drawImp : e.type === "fireImp" ? drawFireImp : e.type === "emberBrute" ? drawEmberBrute : e.type === "fireDragon" ? drawFireDragon : e.type === "magmaGolem" ? drawMagmaGolem : null;
    ctx.save(); ctx.translate(e.x, drawYOff);
    if (atkF > 0 && !custom) ctx.scale(1 + atkF * 0.18, 1 - atkF * 0.12);
    if (e.dir<0) ctx.scale(-1,1);
    if (e.dying) {
      const deathProgress = Math.min(e.deathT / (e.deathDuration || 0.5), 1);
      const ease = 1 - Math.pow(1 - deathProgress, 3);
      // Ragdoll: rotation comes from integrated physics, pivot at body center
      const rotation = e.deathAngle !== undefined ? e.deathAngle : ease * Math.PI / 2;
      const sink = ease * 4;
      const pivotY = groundY - w * 0.45;
      ctx.translate(0, pivotY - sink);
      ctx.rotate(rotation);
      ctx.translate(0, -pivotY);
    }
    if (e.type === "imp" && e.burn > 0) {
      const ft = performance.now() / 1000;
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.35 + 0.18 * Math.sin(ft * 18 + e.x);
      const flame = ctx.createRadialGradient(0, groundY - 18, 2, 0, groundY - 18, 24);
      flame.addColorStop(0, "rgba(255,230,80,0.9)");
      flame.addColorStop(0.45, "rgba(255,90,20,0.45)");
      flame.addColorStop(1, "rgba(180,20,0,0)");
      ctx.fillStyle = flame; ctx.beginPath(); ctx.ellipse(0, groundY - 18, 16, 25, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (custom) {
      custom(e, t, dark, atkF);
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
      if (isBoss) {
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
    drawStuckImpArrows(e);
    ctx.restore();

    // Hunter's Mark: a pulsing crimson chevron hovers over the marked target
    if (e.hunterMark > 0 && !e.dying) {
      const mt = performance.now() / 1000;
      const my = groundY + drawYOff - t.w - (t.flying ? 26 : 16) - Math.sin(mt * 5 + e.x) * 2.5;
      ctx.save();
      ctx.globalAlpha = Math.min(1, e.hunterMark) * (0.75 + 0.25 * Math.sin(mt * 9));
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha *= 0.5;
      const mg = ctx.createRadialGradient(e.x, my, 1, e.x, my, 11);
      mg.addColorStop(0, "rgba(255,90,58,0.9)"); mg.addColorStop(1, "rgba(120,10,0,0)");
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(e.x, my, 11, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#ff5a3a";
      ctx.beginPath();
      ctx.moveTo(e.x - 5, my - 6); ctx.lineTo(e.x, my); ctx.lineTo(e.x + 5, my - 6);
      ctx.lineTo(e.x + 5, my - 3); ctx.lineTo(e.x, my + 3.5); ctx.lineTo(e.x - 5, my - 3);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // Bosses get a big always-on health bar with a name plate
    if (isBoss || t.legendary) {
      drawHpBar(e.x, groundY+drawYOff-t.w-28, t.w*0.85, e.hp/e.maxHp, "#ff2040");
      ctx.save(); ctx.textAlign="center";
      ctx.font="bold 15px Trebuchet MS";
      ctx.fillStyle="rgba(0,0,0,0.85)"; ctx.fillText(t.name, e.x+1, groundY+drawYOff-t.w-42);
      ctx.fillStyle=t.eye; ctx.fillText(t.name, e.x, groundY+drawYOff-t.w-43);
      ctx.font="11px Trebuchet MS";
      ctx.globalAlpha=0.65+0.25*Math.sin(bossT*3);
      ctx.fillStyle="#f2c14e"; ctx.fillText(t.legendary ? "⚔ LEGENDARISK BOSS ⚔" : "⚔ BOSS ⚔", e.x, groundY+drawYOff-t.w-58);
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

export { drawAnimals } from '../sprites/Animals.js';
