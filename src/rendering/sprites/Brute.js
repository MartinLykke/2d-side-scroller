// ---------------------------------------------------------------------------
// Brute — procedural heavy melee monster.
//
// Built purely from stroked capsules, arcs and ellipses (no authored paths).
// Follows the ProceduralEnemy contract: all *timing* lives in update(), draw()
// only reads the resolved pose. Every component brackets itself in
// save()/restore() so no component can leak transform or composite state.
//
// Layer order is strict:
//   0. contact shadow
//   1. back arm + back leg   (desaturated, solveIK)
//   2. effects  (drawTail — shockwaves, dust, embers)
//   3. torso    (breatheCycle + bodyBob)
//   4. head     (small, hunched, overlapping the torso)
//   5. front leg + front arm (brighter, solveIK)
//
// Local space: origin at the feet, -y is up, +x is forward. Mirroring is done
// once by draw() via ctx.scale(facing, 1), so all pose math is facing-agnostic.
// ---------------------------------------------------------------------------

// ---- palette --------------------------------------------------------------
// Red devil. The palette deliberately mirrors the ground imp: broad, flat red
// masses with one warm highlight and one wine-red shadow. Bone is kept dark so
// claws and joints support the silhouette instead of becoming shiny focal
// points. Molten orange/gold is reserved for eyes and attack impacts.
const COL = {
  // flesh — front-facing
  skin:       '#932319', // same family as the imp's primary hide
  skinLit:    '#B8422A', // restrained warm plane, not a glossy hotspot
  skinDeep:   '#5B1517', // broad shadow plane
  muscle:     '#761A18', // secondary definition shapes
  // flesh — back-facing limbs, pushed down into shadow
  skinBack:   '#641716',
  skinBackLit:'#7A211B',
  skinBackDeep:'#481014',
  // bone
  bone:       '#351316',
  boneLit:    '#64402E',
  boneTip:    '#9A7651',
  // fire
  molten0:    '#FF7F11',
  molten1:    '#FFD700',
  eyeCore:    '#FFF4D6',
  eyeGlow:    '#FF3A0A',
  // structure — dark red, never neutral black, so it stays in the game's
  // painted-paper palette rather than reading as comic-book inking.
  edgeDeep:   '#3A0D11',
  crease:     '#511116',
  socket:     '#26080C',
  rock:       '#241416', // volcanic debris
  shadow:     '#12080A', // ground shadow only — never on the body
};

// ---- proportions ----------------------------------------------------------
// Barrel torso, tiny hunched head, tree-trunk legs, gorilla arms that outreach
// the legs by a wide margin.
// The torso bottom must clear the hips, or the legs vanish behind the mass;
// the head must clear the torso top, or it reads as a lump on the shoulder.
//   torso spans  cy±ry  = -164 .. -72     hips at -78, so the legs stay visible
//   head bottom  -158                     just overlapping the torso top
const P = {
  pelvisY: -78, hipX: 18,
  torsoCY: -118, torsoRX: 52, torsoRY: 46,
  shoulderY: -150, shoulderFX: 22, shoulderBX: -20,
  // headR drives the whole skull path; it has to hold its own against the
  // shoulder wedge or the head reads as a knob stuck on a boulder.
  headX: 28, headY: -180, headR: 27,
  thigh: 42, shin: 42,
  upperArm: 62, foreArm: 66,
};

// Height of the foot from sole to ankle joint. Pose targets address the SOLE
// (foot.y === 0 means "standing on the floor"), so the drawn ankle is lifted by
// this much and the foot path puts every contact point back down on the target.
const ANKLE_LIFT = 14;

// Minimum elbow bend, in radians (~26°). Enforced at draw time so an arm never
// locks out into a straight cylinder at rest.
const MIN_ELBOW_FLEX = 0.45;

// How long each strike takes, end to end. attackPhase is stateTime / this.
const DUR = {
  throw:   1.05,
  wall:    1.30, // two-handed horizontal smash into a structure face
  siege0:  0.95, // overhead slam
  siege1:  1.35, // knockback stomp (holds a beat mid-lift)
  melee0:  0.80, // knockback backhand sweep
  melee1:  0.90, // hammer-fist
};

// ---- small math -----------------------------------------------------------
const clamp   = (v, a, b) => (v < a ? a : v > b ? b : v);
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp    = (a, b, t) => a + (b - a) * t;
const ease    = p => { p = clamp01(p); return p * p * (3 - 2 * p); };
// Fast out, slow in — the shape of a heavy thing committing to a blow.
const easeOut = p => { p = clamp01(p); return 1 - (1 - p) * (1 - p) * (1 - p); };
// Windowed pulse, peaks at 1 in the middle of [a,b], zero outside.
const pulse = (p, a, b) => (p <= a || p >= b ? 0 : Math.sin(((p - a) / (b - a)) * Math.PI));
// Framerate-independent exponential approach.
const approach = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));

/**
 * Two-bone analytic IK. Returns the joint and the *reachable* end point: when
 * the target is out of range the chain locks straight instead of stretching,
 * so a limb never visually snaps apart. `invertKnee` picks the bend side.
 */
export function solveTwoBoneIK(startX, startY, targetX, targetY, bone1Len, bone2Len, invertKnee) {
  const dx = targetX - startX, dy = targetY - startY;
  const dist = Math.hypot(dx, dy) || 1e-4;
  const maxD = bone1Len + bone2Len - 1e-3;
  const minD = Math.abs(bone1Len - bone2Len) + 1e-3;
  const d = clamp(dist, minD, maxD);

  const ux = dx / dist, uy = dy / dist;
  const handX = startX + ux * d, handY = startY + uy * d;

  // Law of cosines for the shoulder/hip interior angle.
  const cosA = clamp((bone1Len * bone1Len + d * d - bone2Len * bone2Len) / (2 * bone1Len * d), -1, 1);
  const a = Math.acos(cosA);
  const base = Math.atan2(uy, ux);
  const jointAngle = base + a * (invertKnee ? -1 : 1);

  return {
    elbowX: startX + Math.cos(jointAngle) * bone1Len,
    elbowY: startY + Math.sin(jointAngle) * bone1Len,
    handX, handY,
    // 0..1+ — how close to locked-out the chain is. Drives tendon strain.
    strain: clamp01(dist / (bone1Len + bone2Len)),
  };
}

// ---- drawing primitives ---------------------------------------------------
// The imp aesthetic is driven by silhouette and a few broad value planes, not
// glossy per-part gradients. These primitives therefore use flat base colours
// plus a restrained highlight. That also makes the Brute cheaper to paint.

/** Blend two #rrggbb colours, t=0 → a, t=1 → b. */
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `rgb(${r},${g},${bl})`;
}

/** Flat two-tone muscle capsule. */
function capsule(ctx, x1, y1, x2, y2, w, lit, edge) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1e-4;
  const nx = -dy / len, ny = dx / len;

  ctx.save();
  ctx.strokeStyle = mix(lit, edge, 0.38);
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // One soft painted plane is enough to imply volume without turning the limb
  // into a polished tube.
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = lit;
  ctx.lineWidth = Math.max(2, w * 0.22);
  ctx.beginPath();
  ctx.moveTo(x1 - nx * w * 0.16, y1 - ny * w * 0.16);
  ctx.lineTo(x2 - nx * w * 0.10, y2 - ny * w * 0.10);
  ctx.stroke();
  ctx.restore();
}

/** Flat capsule, for the few places that must not pick up shading. */
function capsuleFlat(ctx, x1, y1, x2, y2, w, col) {
  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/** Flat mass with a small offset highlight, used mostly for shadows/debris. */
function blob(ctx, x, y, rx, ry, rot, lit, edge) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(rx, ry);
  ctx.fillStyle = mix(lit, edge, 0.32);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  if (lit !== edge) {
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = lit;
    ctx.beginPath();
    ctx.ellipse(-0.18, -0.22, 0.58, 0.42, -0.18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Point on a cubic bezier — used to walk the back contour for spine ridges. */
function bezPt(p0, p1, p2, p3, t) {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
           y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

/**
 * Tapered limb segment: a closed path that is *wider at the root than the tip*
 * with an optional outward bulge, so an upper arm reads as a bicep swelling
 * into a narrow elbow rather than a uniform tube.
 *
 *   bulge  0 = straight taper, >0 pushes the outer edge out at ~40% along
 */
function limbTaper(ctx, x1, y1, x2, y2, w1, w2, lit, edge, bulge = 0) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1e-4;
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux;
  const a = Math.atan2(uy, ux);
  const h1 = w1 * 0.5, h2 = w2 * 0.5;

  const build = (g1, g2) => {
    ctx.beginPath();
    ctx.moveTo(x1 + nx * g1, y1 + ny * g1);
    // Outer edge, bulging toward the root.
    ctx.quadraticCurveTo(
      x1 + ux * len * 0.40 + nx * (g1 * (1 + bulge)),
      y1 + uy * len * 0.40 + ny * (g1 * (1 + bulge)),
      x2 + nx * g2, y2 + ny * g2);
    ctx.arc(x2, y2, g2, a + Math.PI / 2, a - Math.PI / 2, true);   // tip cap
    // Inner edge, flatter than the outer one.
    ctx.quadraticCurveTo(
      x1 + ux * len * 0.40 - nx * (g1 * (1 + bulge * 0.35)),
      y1 + uy * len * 0.40 - ny * (g1 * (1 + bulge * 0.35)),
      x1 - nx * g1, y1 - ny * g1);
    ctx.arc(x1, y1, g1, a - Math.PI / 2, a + Math.PI / 2, false);  // root cap
    ctx.closePath();
  };

  ctx.save();
  ctx.fillStyle = mix(lit, edge, 0.36);
  build(h1, h2);
  ctx.fill();

  ctx.globalAlpha = 0.20;
  ctx.strokeStyle = lit;
  ctx.lineWidth = Math.max(2, Math.min(w1, w2) * 0.18);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1 - nx * h1 * 0.30, y1 - ny * h1 * 0.30);
  ctx.quadraticCurveTo(
    lerp(x1, x2, 0.46) - nx * ((h1 + h2) * 0.13),
    lerp(y1, y2, 0.46) - ny * ((h1 + h2) * 0.13),
    x2 - nx * h2 * 0.18, y2 - ny * h2 * 0.18);
  ctx.stroke();
  ctx.restore();
}

/** A small scored joint crease; the limb silhouette supplies the actual cap. */
function bonePlate(ctx, x, y, r, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = COL.crease;
  ctx.lineWidth = Math.max(1.2, r * 0.13);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(-r * 0.04, 0, r * 0.62, r * 0.38, -0.22,
              Math.PI * 1.06, Math.PI * 1.82);
  ctx.stroke();
  ctx.restore();
}

/**
 * Claw. Built from lineTo + quadraticCurveTo so it tapers to a real point, with
 * a gradient running base→tip and scored segment lines across the shaft.
 * Drawn in local space: base at the origin, curving out along +x.
 */
function claw(ctx, len, w, curl = 0.42) {
  ctx.save();
  ctx.fillStyle = COL.bone;

  ctx.beginPath();
  ctx.moveTo(0, -w * 0.50);
  ctx.quadraticCurveTo(len * 0.58, -w * (0.40 + curl * 0.20), len, -w * 0.05);
  ctx.lineTo(len, w * 0.05);
  ctx.quadraticCurveTo(len * 0.52, w * (0.46 - curl * 0.10), 0, w * 0.50);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = COL.boneTip;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(len * 0.68, -w * 0.18);
  ctx.quadraticCurveTo(len * 0.86, -w * 0.12, len * 0.97, -w * 0.04);
  ctx.stroke();
  ctx.restore();
}

/**
 * Horn — a tapering curved spike laid down as a run of overlapping filled arcs
 * along a circular sweep, so the curve stays smooth without an authored path.
 */
function horn(ctx, ox, oy, a0, a1, R, r0) {
  ctx.save();
  const steps = 22;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = lerp(a0, a1, t);
    const px = ox + Math.cos(a) * R;
    const py = oy + Math.sin(a) * R;
    const rr = r0 * (1 - t * 0.93);
    if (rr <= 0.2) break;
    ctx.fillStyle = t > 0.84 ? COL.boneTip : t > 0.62 ? COL.boneLit : COL.bone;
    ctx.beginPath();
    ctx.arc(px, py, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Back spine — a jagged bone blade with a molten core, suggesting fire venting
 * through the ridge. `h` is height above the hide, `w` the half-width of its base.
 */
function spine(ctx, x, y, ang, h, w) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);

  // Bone blade, deliberately asymmetric so the row reads as ragged.
  ctx.fillStyle = COL.bone;
  ctx.beginPath();
  ctx.moveTo(-w, 0);
  ctx.lineTo(-w * 0.42, -h * 0.52);
  ctx.lineTo(-w * 0.16, -h * 0.33);   // the jag
  ctx.lineTo(0, -h);
  ctx.lineTo(w * 0.26, -h * 0.38);
  ctx.lineTo(w * 0.56, -h * 0.58);
  ctx.lineTo(w, 0);
  ctx.closePath();
  ctx.fill();

  // Molten core venting up the centre of the blade.
  ctx.globalAlpha = 0.76;
  ctx.fillStyle = COL.molten0;
  ctx.beginPath();
  ctx.moveTo(-w * 0.30, 0);
  ctx.lineTo(0, -h * 0.74);
  ctx.lineTo(w * 0.30, 0);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// ---------------------------------------------------------------------------

export class Brute {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.facing = 1;

    // idle | walk | throw | siege | melee
    this.state = 'idle';
    this.attackVariation = 0;   // 0 or 1 — alternates each strike
    this.attackPhase = 0;       // 0..1 across windup → impact → recovery

    // --- procedural drivers -------------------------------------------------
    this.time = Math.random() * 100; // desync from other brutes
    this.runCycle = Math.random() * Math.PI * 2;
    this.breatheCycle = 0;
    this.moveAmt = 0;           // 0..1 smoothed exertion

    // --- body transforms ----------------------------------------------------
    this.squashY = 1;
    this.stretchX = 1;
    this.leanAngle = 0;
    this.bodyBob = 0;
    this.torsoLift = 0;         // extra rise/drop on top of the gait bob
    this.overreach = 1;         // >1 momentarily over-extends the arm chain

    // --- IK targets (local space) ------------------------------------------
    this.handF = { x: 48, y: -20 };
    this.handB = { x: -40, y: -16 };
    this.footF = { x: 15, y: 0 };
    this.footB = { x: -16, y: 0 };

    // --- reactive extras ----------------------------------------------------
    this.headTuck = 0;          // 0 = neutral, 1 = jammed down into the chest
    this.jawOpen = 0;
    this.eyeFlare = 0;          // spikes on impact
    this.shock = 0;             // shockwave ring life, 1 → 0
    this.shockX = 0;
    this.dust = 0;
    this.deathFade = 0;         // 0 = alive, 1 = fully gone cold (dims fire/eyes)
  }

  /** Begin a strike. Call from the AI; update() drives the rest. */
  setState(state, variation) {
    this.state = state;
    if (variation === undefined) this.attackVariation ^= 1; // alternate
    else this.attackVariation = variation & 1;
    this.attackPhase = 0;
  }

  /** Full duration of the current strike, so attackPhase is real time-based. */
  attackDuration() {
    if (this.state === 'throw') return DUR.throw;
    if (this.state === 'wall') return DUR.wall;
    if (this.state === 'siege') return this.attackVariation ? DUR.siege1 : DUR.siege0;
    if (this.state === 'melee') return this.attackVariation ? DUR.melee1 : DUR.melee0;
    if (this.state === 'death') return 1; // stateTime is already the 0..1 death progress
    return 0;
  }

  // =========================================================================
  // UPDATE — owns every bit of timing. draw() adds nothing.
  // =========================================================================
  update(dt, velocityX, stateTime) {
    dt = Math.min(dt, 0.05);
    this.time += dt;

    const speed = Math.abs(velocityX);
    const attacking = this.state === 'throw' || this.state === 'wall' || this.state === 'siege' || this.state === 'melee';

    if (!attacking && speed > 6) this.facing = velocityX < 0 ? -1 : 1;

    // 1. Procedural drivers ---------------------------------------------------
    // Slow and deep: a full breath takes ~5.7s and visibly swells the barrel.
    this.breatheCycle = Math.sin(this.time * 1.1);
    // Very slow, heavy steps — a low multiplier keeps strides long at speed.
    this.runCycle += speed * dt * 0.042;
    this.moveAmt = approach(this.moveAmt, clamp01(speed / 46), 6, dt);

    const dur = this.attackDuration();
    this.attackPhase = dur > 0 ? clamp01(stateTime / dur) : 0;
    const p = this.attackPhase;

    // 2. Resolve pose targets -------------------------------------------------
    const t = this._restPose();
    let blend = 12; // how eagerly the body chases the target pose

    switch (this.state) {
      case 'throw':  this._poseThrow(t, p);        blend = 19; break;
      case 'wall':   this._poseWallSmash(t, p);    blend = 20; break;
      case 'siege':  this.attackVariation ? this._poseStomp(t, p) : this._poseSlam(t, p); blend = 20; break;
      case 'melee':  this.attackVariation ? this._poseHammer(t, p) : this._poseSweep(t, p); blend = 19; break;
      case 'walk':   this._poseWalk(t);            blend = 12; break;
      case 'death':  this._poseDeath(t, p);         blend = 13; break;
      default:       this._poseIdle(t);            break;
    }

    // 3. Smooth toward the pose ------------------------------------------------
    this.bodyBob   = approach(this.bodyBob,   t.bob,      blend, dt);
    this.torsoLift = approach(this.torsoLift, t.lift,     blend, dt);
    this.squashY   = approach(this.squashY,   t.squashY,  blend, dt);
    this.stretchX  = approach(this.stretchX,  t.stretchX, blend, dt);
    this.leanAngle = approach(this.leanAngle, t.lean,     blend, dt);
    this.headTuck  = approach(this.headTuck,  t.tuck,     blend, dt);
    this.jawOpen   = approach(this.jawOpen,   t.jaw,      blend, dt);
    this.overreach = approach(this.overreach, t.overreach, blend, dt);
    this.deathFade = approach(this.deathFade, t.deathFade, blend, dt);

    for (const [cur, tgt] of [[this.handF, t.handF], [this.handB, t.handB],
                              [this.footF, t.footF], [this.footB, t.footB]]) {
      cur.x = approach(cur.x, tgt.x, blend, dt);
      cur.y = approach(cur.y, tgt.y, blend, dt);
    }

    // 4. Impact reactions ------------------------------------------------------
    if (t.impact > 0 && this.shock <= 0.01) {
      this.shock = 1;
      this.shockX = t.impactX;
      this.dust = 1;
      this.eyeFlare = 1;
    }
    this.shock     = Math.max(0, this.shock - dt * 2.0);
    this.dust      = Math.max(0, this.dust - dt * 1.6);
    this.eyeFlare  = Math.max(0, this.eyeFlare - dt * 2.8);
  }

  // ---- pose builders -------------------------------------------------------
  // Each returns targets in local space. Neutral first, then each state
  // overwrites only what it cares about.

  _restPose() {
    const breath = this.breatheCycle;
    return {
      bob: 0, lift: 0, squashY: 1, stretchX: 1, lean: 0, tuck: 0, jaw: 0,
      overreach: 1, impact: 0, impactX: 0, deathFade: 0,
      handF: { x: 48, y: -20 + breath * 2 },
      handB: { x: -40, y: -16 + breath * 2 },
      footF: { x: 15, y: 0 },
      footB: { x: -16, y: 0 },
    };
  }

  _poseIdle(t) {
    const b = this.breatheCycle;
    // Knuckles planted, weight rocking almost imperceptibly.
    t.bob  = b * 1.6;
    t.lean = b * 0.012;
    t.handF.x = 48 + b * 2;
    t.handB.x = -40 - b * 1.5;
    t.tuck = 0.15 + b * 0.05;
  }

  _poseWalk(t) {
    const c = this.runCycle, m = this.moveAmt;
    const stride = 26 * m, lift = 15 * m;
    const sf = Math.sin(c), sb = Math.sin(c + Math.PI);

    // Heavy dips: the body drops hardest as each foot takes the load.
    t.bob  = -Math.abs(Math.cos(c)) * 9 * m + this.breatheCycle * 1.2;
    t.lean = 0.09 * m + Math.sin(c * 2) * 0.02 * m;

    t.footF.x = 15 + sf * stride;
    t.footF.y = -Math.max(0, sf) * lift;
    t.footB.x = -16 + sb * stride;
    t.footB.y = -Math.max(0, sb) * lift;

    // Gorilla knuckle-walk: hands swing counter to the legs and stay low.
    t.handF.x = 48 - sf * 18 * m;
    t.handF.y = -20 - Math.max(0, -sf) * 12 * m;
    t.handB.x = -40 - sb * 16 * m;
    t.handB.y = -16 - Math.max(0, -sb) * 10 * m;

    // Shoulders roll, so the mass squashes a touch on each plant.
    t.squashY  = 1 - Math.abs(Math.cos(c)) * 0.05 * m;
    t.stretchX = 1 + Math.abs(Math.cos(c)) * 0.04 * m;
    t.tuck = 0.35 * m;
  }

  // throw — front arm sweeps from the floor, up over the head, snaps forward.
  _poseThrow(t, p) {
    // One continuous arc around the shoulder, described in polar coords:
    // 0 rad = straight forward, negative = up (canvas y grows downward).
    let ang, rad, lean;
    if (p < 0.45) {              // scoop from the floor behind
      const k = ease(p / 0.45);
      ang  = lerp(2.55, -1.75, k);
      rad  = lerp(102, 96, k);
      lean = lerp(0, -0.20, k);
    } else if (p < 0.62) {       // over the top, whipping forward
      const k = easeOut((p - 0.45) / 0.17);
      ang  = lerp(-1.75, -0.10, k);
      rad  = lerp(96, 116, k);   // arm straightens through the release
      lean = lerp(-0.20, 0.24, k);
    } else {                     // follow-through, arm falls back to a drag
      const k = ease((p - 0.62) / 0.38);
      ang  = lerp(-0.10, 0.55, k);
      rad  = lerp(116, 100, k);
      lean = lerp(0.24, 0, k);
    }

    t.handF.x = P.shoulderFX + Math.cos(ang) * rad;
    t.handF.y = P.shoulderY  + Math.sin(ang) * rad;
    t.lean = lean;
    t.bob  = p < 0.45 ? -p * 6 : 0;
    t.lift = p > 0.45 && p < 0.7 ? -5 : 0;
    t.tuck = p < 0.45 ? 0.4 : -0.25;
    t.jaw  = pulse(p, 0.45, 0.75);
    // Braced back leg absorbs the throw.
    t.footB.x = -22 - ease(clamp01(p / 0.5)) * 8;
    t.handB.x = -30;
    t.squashY  = 1 - pulse(p, 0.45, 0.7) * 0.06;
    t.stretchX = 1 + pulse(p, 0.45, 0.7) * 0.07;
  }

  // siege v0 — two-handed overhead slam.
  _poseSlam(t, p) {
    if (p < 0.40) {                       // rise: both hands high, body stretches up
      const k = ease(p / 0.40);
      t.handF.x = lerp(48, 30, k);  t.handF.y = lerp(-20, -212, k);
      t.handB.x = lerp(-40, 6, k);  t.handB.y = lerp(-16, -204, k);
      t.squashY = lerp(1, 1.15, k);
      t.stretchX = lerp(1, 0.88, k);
      t.lift = lerp(0, -14, k);
      t.lean = lerp(0, -0.13, k);
      t.tuck = -0.5 * k;
      t.jaw = k * 0.7;
    } else if (p < 0.54) {                // SLAM straight down
      const k = easeOut((p - 0.40) / 0.14);
      t.handF.x = lerp(30, 50, k);  t.handF.y = lerp(-212, -6, k);
      t.handB.x = lerp(6, 30, k);   t.handB.y = lerp(-204, -2, k);
      t.squashY = lerp(1.15, 0.76, k);
      t.stretchX = lerp(0.88, 1.26, k);
      t.lift = lerp(-14, 16, k);
      t.lean = lerp(-0.13, 0.20, k);
      t.tuck = lerp(-0.5, 0.9, k);
      t.jaw = 1;
      if (p >= 0.50) { t.impact = 1; t.impactX = 40; }
    } else {                              // recovery: mass rebounds, hands drag back
      const k = ease((p - 0.54) / 0.46);
      t.handF.x = lerp(50, 48, k);  t.handF.y = lerp(-6, -20, k);
      t.handB.x = lerp(30, -40, k); t.handB.y = lerp(-2, -16, k);
      t.squashY = lerp(0.76, 1, k);
      t.stretchX = lerp(1.26, 1, k);
      t.lift = lerp(16, 0, k);
      t.lean = lerp(0.20, 0, k);
      t.tuck = lerp(0.9, 0.15, k);
      t.jaw = 1 - k;
    }
    // Feet spread wide and dig in for the whole motion.
    t.footF.x = 24; t.footB.x = -24;
  }

  // siege v1 — knockback stomp. Loads onto the back leg, lifts the front knee
  // impossibly high, holds a beat, then drives it down.
  _poseStomp(t, p) {
    if (p < 0.30) {                       // load onto the back leg
      const k = ease(p / 0.30);
      t.footF.x = lerp(15, 26, k);  t.footF.y = lerp(0, -96, k); // knee into the chest
      t.footB.x = lerp(-16, -8, k);
      t.lean = lerp(0, -0.20, k);
      t.lift = lerp(0, -8, k);
      t.squashY = lerp(1, 1.08, k);
      t.stretchX = lerp(1, 0.93, k);
      t.handF.x = lerp(48, 44, k);  t.handF.y = lerp(-20, -96, k); // arms flare for balance
      t.handB.x = lerp(-40, -50, k); t.handB.y = lerp(-16, -92, k);
      t.tuck = -0.3 * k;
    } else if (p < 0.50) {                // hold the beat — nothing moves but breath
      t.footF.x = 26; t.footF.y = -96 + this.breatheCycle * 1.5;
      t.footB.x = -8;
      t.lean = -0.20; t.lift = -8;
      t.squashY = 1.08; t.stretchX = 0.93;
      t.handF.x = 44; t.handF.y = -96;
      t.handB.x = -50; t.handB.y = -92;
      t.tuck = -0.3; t.jaw = 0.5;
    } else if (p < 0.60) {                // STOMP
      const k = easeOut((p - 0.50) / 0.10);
      t.footF.x = lerp(26, 36, k);  t.footF.y = lerp(-96, 0, k);
      t.footB.x = -12;
      t.lean = lerp(-0.20, 0.12, k);
      t.lift = lerp(-8, 12, k);
      t.squashY = lerp(1.08, 0.78, k);
      t.stretchX = lerp(0.93, 1.24, k);
      t.handF.x = lerp(44, 40, k);  t.handF.y = lerp(-96, -16, k);
      t.handB.x = lerp(-50, -34, k); t.handB.y = lerp(-92, -14, k);
      t.tuck = lerp(-0.3, 0.8, k);
      t.jaw = 1;
      if (p >= 0.56) { t.impact = 1; t.impactX = 36; }
    } else {                              // recovery
      const k = ease((p - 0.60) / 0.40);
      t.footF.x = lerp(36, 15, k);
      t.footB.x = lerp(-12, -16, k);
      t.lean = lerp(0.12, 0, k);
      t.lift = lerp(12, 0, k);
      t.squashY = lerp(0.78, 1, k);
      t.stretchX = lerp(1.24, 1, k);
      t.handF.x = lerp(40, 48, k);  t.handF.y = lerp(-16, -20, k);
      t.handB.x = lerp(-34, -40, k); t.handB.y = lerp(-14, -16, k);
      t.tuck = lerp(0.8, 0.15, k);
      t.jaw = 1 - k;
    }
  }

  // wall — both hands draw back beside the chest, then drive horizontally
  // into the wall face. Unlike the siege slam/stomp, this pose never targets
  // the floor and therefore does not emit ground fissures or a stomp shockwave.
  _poseWallSmash(t, p) {
    if (p < 0.42) {                       // plant and draw both fists back
      const k = ease(p / 0.42);
      t.handF.x = lerp(48, -4, k);   t.handF.y = lerp(-20, -102, k);
      t.handB.x = lerp(-40, -18, k); t.handB.y = lerp(-16, -122, k);
      t.footF.x = lerp(15, 24, k);
      t.footB.x = lerp(-16, -30, k);
      t.lean = lerp(0, -0.20, k);
      t.squashY = lerp(1, 1.07, k);
      t.stretchX = lerp(1, 0.92, k);
      t.tuck = lerp(0.15, -0.28, k);
      t.jaw = k * 0.45;
    } else if (p < 0.58) {                // drive through the wall face
      const k = easeOut((p - 0.42) / 0.16);
      t.handF.x = lerp(-4, 112, k);  t.handF.y = lerp(-102, -94, k);
      t.handB.x = lerp(-18, 102, k); t.handB.y = lerp(-122, -118, k);
      t.footF.x = lerp(24, 34, k);
      t.footB.x = -30;
      t.lean = lerp(-0.20, 0.30, k);
      t.squashY = lerp(1.07, 0.90, k);
      t.stretchX = lerp(0.92, 1.20, k);
      t.overreach = lerp(1, 1.10, k);
      t.tuck = lerp(-0.28, 0.48, k);
      t.jaw = 1;
    } else {                              // recoil and let the arms fall
      const k = ease((p - 0.58) / 0.42);
      t.handF.x = lerp(112, 48, k);  t.handF.y = lerp(-94, -20, k);
      t.handB.x = lerp(102, -40, k); t.handB.y = lerp(-118, -16, k);
      t.footF.x = lerp(34, 15, k);
      t.footB.x = lerp(-30, -16, k);
      t.lean = lerp(0.30, 0, k);
      t.squashY = lerp(0.90, 1, k);
      t.stretchX = lerp(1.20, 1, k);
      t.overreach = lerp(1.10, 1, k);
      t.tuck = lerp(0.48, 0.15, k);
      t.jaw = 1 - k;
    }
  }

  // melee v0 — planted shoulder-led backhand at chest height.
  _poseSweep(t, p) {
    if (p < 0.42) {                       // draw one arm across while the rear arm stays weighted
      const k = ease(p / 0.42);
      t.handF.x = lerp(48, -4, k);   t.handF.y = lerp(-20, -82, k);
      t.handB.x = lerp(-40, -36, k); t.handB.y = lerp(-16, -24, k);
      t.lean = lerp(0, -0.10, k);
      t.stretchX = lerp(1, 0.97, k);
      t.squashY = lerp(1, 1.02, k);
      t.footB.x = lerp(-16, -20, k);
      t.tuck = -0.10 * k;
    } else if (p < 0.64) {                // rotate the shoulder; keep a bend in the striking arm
      const k = easeOut((p - 0.42) / 0.22);
      t.handF.x = lerp(-4, 76, k);   t.handF.y = lerp(-82, -78, k);
      t.handB.x = -36;               t.handB.y = -24;
      t.lean = lerp(-0.10, 0.12, k);
      t.stretchX = lerp(0.97, 1.05, k);
      t.squashY = lerp(1.02, 0.98, k);
      t.footF.x = lerp(15, 20, k);
      t.footB.x = -20;
      t.overreach = lerp(1, 1.01, k);
      t.tuck = lerp(-0.10, 0.18, k);
      t.jaw = 0.6;
    } else {                              // shoulder unwinds before the arm drops to rest
      const k = ease((p - 0.64) / 0.36);
      t.handF.x = lerp(76, 48, k);   t.handF.y = lerp(-78, -20, k);
      t.handB.x = lerp(-36, -40, k); t.handB.y = lerp(-24, -16, k);
      t.lean = lerp(0.12, 0, k);
      t.stretchX = lerp(1.05, 1, k);
      t.squashY = lerp(0.98, 1, k);
      t.footF.x = lerp(20, 15, k);
      t.footB.x = lerp(-20, -16, k);
      t.overreach = lerp(1.01, 1, k);
      t.tuck = lerp(0.18, 0.15, k);
      t.jaw = (1 - k) * 0.6;
    }
  }

  // melee v1 — heavy downward hammer-fist with the BACK arm.
  _poseHammer(t, p) {
    if (p < 0.40) {                       // raise the back fist high and behind
      const k = ease(p / 0.40);
      t.handB.x = lerp(-40, -22, k); t.handB.y = lerp(-16, -216, k);
      t.lean = lerp(0, -0.14, k);
      t.lift = lerp(0, -9, k);
      t.squashY = lerp(1, 1.10, k);
      t.stretchX = lerp(1, 0.92, k);
      t.handF.x = lerp(48, 46, k);  t.handF.y = lerp(-20, -60, k); // front arm braces
      t.footB.x = lerp(-16, -24, k);
      t.tuck = -0.4 * k;
    } else if (p < 0.54) {                // hammer down
      const k = easeOut((p - 0.40) / 0.14);
      t.handB.x = lerp(-22, 46, k);  t.handB.y = lerp(-216, -8, k);
      t.lean = lerp(-0.14, 0.26, k);
      t.lift = lerp(-9, 12, k);
      t.squashY = lerp(1.10, 0.80, k);
      t.stretchX = lerp(0.92, 1.20, k);
      t.handF.x = lerp(46, 20, k);  t.handF.y = lerp(-60, -30, k);
      t.overreach = lerp(1, 1.08, k);
      t.tuck = lerp(-0.4, 0.85, k);
      t.jaw = 1;
      if (p >= 0.50) { t.impact = 1; t.impactX = 46; }
    } else {                              // recovery
      const k = ease((p - 0.54) / 0.46);
      t.handB.x = lerp(46, -40, k);  t.handB.y = lerp(-8, -16, k);
      t.lean = lerp(0.26, 0, k);
      t.lift = lerp(12, 0, k);
      t.squashY = lerp(0.80, 1, k);
      t.stretchX = lerp(1.20, 1, k);
      t.handF.x = lerp(20, 48, k);   t.handF.y = lerp(-30, -20, k);
      t.footB.x = lerp(-24, -16, k);
      t.overreach = lerp(1.08, 1, k);
      t.tuck = lerp(0.85, 0.15, k);
      t.jaw = 1 - k;
    }
  }

  // death — the frame gives out all at once: knees buckle, arms drop to dead
  // weight, and the whole mass sinks and splays flat under its own bulk. The
  // toppling arc itself (knockback, roll to rest) is driven by the enemy's
  // ragdoll physics in RenderEntities, wrapped around this whole draw; this
  // pose only relaxes the limbs into that fall, so a body this size collapses
  // in on itself instead of just rotating rigidly like something half its mass.
  _poseDeath(t, p) {
    if (p < 0.32) {                        // knees buckle, the frame folds
      const k = ease(p / 0.32);
      t.footF.x = lerp(15, 32, k);
      t.footB.x = lerp(-16, -20, k);
      t.lift = lerp(0, 18, k);
      t.squashY = lerp(1, 0.90, k);
      t.stretchX = lerp(1, 1.08, k);
      t.tuck = lerp(0.15, 0.7, k);
      t.jaw = k * 0.55;
      t.handF.x = lerp(48, 44, k);  t.handF.y = lerp(-20, 6, k);
      t.handB.x = lerp(-40, -38, k); t.handB.y = lerp(-16, 10, k);
    } else if (p < 0.55) {                 // the bulk drops and slams flat
      const k = easeOut((p - 0.32) / 0.23);
      t.footF.x = lerp(32, 52, k);
      t.footB.x = lerp(-20, -54, k);
      t.lift = lerp(18, 30, k);
      t.squashY = lerp(0.90, 0.68, k);
      t.stretchX = lerp(1.08, 1.30, k);
      t.tuck = lerp(0.7, 1.10, k);
      t.jaw = lerp(0.55, 1, k);
      t.handF.x = lerp(44, 68, k); t.handF.y = lerp(6, 4, k);
      t.handB.x = lerp(-38, -66, k); t.handB.y = lerp(10, 6, k);
      if (p >= 0.48) { t.impact = 1; t.impactX = 34; }
    } else {                               // dead weight, everything slack
      const k = ease((p - 0.55) / 0.45);
      t.footF.x = lerp(52, 56, k);
      t.footB.x = lerp(-54, -58, k);
      t.lift = lerp(30, 26, k);
      t.squashY = lerp(0.68, 0.66, k);
      t.stretchX = lerp(1.30, 1.32, k);
      t.tuck = lerp(1.10, 1.18, k);
      t.jaw = 1;
      t.handF.x = 68; t.handF.y = lerp(4, 8, k);
      t.handB.x = -66; t.handB.y = lerp(6, 10, k);
    }
    // The furnace inside it cools out over the whole animation, not just the
    // final third — by the time it hits the ground the fire should already
    // be dying, not still burning at full strength.
    t.deathFade = clamp01(p * 1.15);
  }

  // =========================================================================
  // DRAW — reads the resolved pose only.
  // =========================================================================
  /**
   * Standalone draw: positions and mirrors itself in world space.
   * Inside the game the enemy renderer has already done both — use drawBody().
   */
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.facing, 1);
    this.drawBody(ctx);
    ctx.restore();
  }

  /**
   * Draw at the origin, feet on `ground`. The caller owns world translation and
   * mirroring, so this composes with the game's drawEnemies() transform stack.
   */
  drawBody(ctx, ground = 0) {
    ctx.save();
    ctx.translate(0, ground);

    // Layer 0 — contact shadow, drawn before the body transform so squash and
    // lean never drag it off the ground plane.
    this.drawShadow(ctx);

    ctx.rotate(this.leanAngle);
    ctx.scale(this.stretchX, this.squashY);

    const bob = this.bodyBob + this.torsoLift;

    // 1. Back arm & back leg
    this.drawLimb(ctx, 'back', bob);
    // 2. Effects
    this.drawTail(ctx);
    // 3. Torso
    this.drawTorso(ctx, bob);
    // 4. Head
    this.drawHead(ctx, bob);
    // 5. Front leg & front arm
    this.drawLimb(ctx, 'front', bob);

    ctx.restore();
  }

  drawShadow(ctx) {
    ctx.save();
    const spread = 1 + this.dust * 0.35;
    ctx.globalAlpha = 0.38;
    blob(ctx, 4, -2, 56 * spread, 9, 0, COL.shadow, COL.shadow);
    ctx.globalAlpha = 0.22;
    blob(ctx, 4, -2, 78 * spread, 6, 0, COL.shadow, COL.shadow);
    ctx.restore();
  }

  // ---- torso ---------------------------------------------------------------
  drawTorso(ctx, bob) {
    ctx.save();
    ctx.translate(0, bob);

    // Breath swells the barrel noticeably — wide on the inhale, dropping and
    // narrowing on the exhale.
    const br = this.breatheCycle;

    // ---- silhouette ---------------------------------------------------------
    // Two tapered organic masses, NOT one sphere: a broad hunched shoulder /
    // chest wedge that narrows into a thick waist, giving a gorilla V-taper.
    const shY = P.shoulderY - 2;                 // shoulder line
    const wsY = P.pelvisY - 12;                  // waist line
    const shW = 50 + br * 4.5;                   // half-width at the shoulders
    const wsW = 28 + br * 2.0;                   // half-width at the waist
    const chF = 32 + br * 2.0;                   // how far the chest juts forward

    // Back contour of the wedge, kept as explicit control points so the spine
    // ridges can be walked along the exact same curve.
    const back = {
      p0: { x: -wsW - 4, y: wsY },
      p1: { x: -wsW - 26, y: wsY - 34 },
      p2: { x: -shW * 0.98, y: shY + 42 },
      p3: { x: -shW * 0.80, y: shY - 2 },
    };
    this._backCurve = back;

    const wedge = () => {
      ctx.beginPath();
      ctx.moveTo(back.p3.x, back.p3.y);
      // over the hunched shoulders to the front clavicle
      ctx.bezierCurveTo(-shW * 0.44, shY - 30, shW * 0.20, shY - 32, chF + 12, shY + 4);
      // chest falling into the ribs and on into the waist
      ctx.bezierCurveTo(chF + 24, shY + 34, wsW + 18, wsY - 30, wsW + 4, wsY);
      ctx.lineTo(-wsW - 4, wsY);
      // lat sweeping back up to the shoulder
      ctx.bezierCurveTo(back.p1.x, back.p1.y, back.p2.x, back.p2.y, back.p3.x, back.p3.y);
      ctx.closePath();
    };

    // Spine ridges go down before the hide so the blades crest out from behind.
    this.drawSpineRidges(ctx);

    // ---- core / pelvis mass -------------------------------------------------
    // Drawn BEFORE the chest wedge so the wedge overlaps its top edge. This is
    // the mass that closes the gap that used to show background between the
    // ribcage and the legs: it runs from inside the wedge (wsY - 6) down past
    // both hip joints to well below them, so the thigh roots land on solid body.
    const coreTop = wsY - 8;
    const coreBot = P.pelvisY + 32;              // ~34px below the hip joints
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-wsW - 8, coreTop);
    ctx.bezierCurveTo(-wsW - 18, wsY + 16, -P.hipX - 26, P.pelvisY + 4, -P.hipX - 17, coreBot);
    ctx.quadraticCurveTo(0, coreBot + 15, P.hipX + 19, coreBot);      // groin underside
    ctx.bezierCurveTo(chF + 2, P.pelvisY + 4, wsW + 18, wsY + 16, wsW + 8, coreTop);
    ctx.closePath();
    ctx.fillStyle = COL.skinDeep;
    ctx.fill();
    ctx.restore();

    // Glute mass wrapping the back hip, so the tail root sits on something.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-wsW - 6, wsY + 12);
    ctx.bezierCurveTo(-wsW - 30, P.pelvisY - 16, -P.hipX - 30, P.pelvisY + 20, -P.hipX - 10, coreBot - 6);
    ctx.quadraticCurveTo(-P.hipX + 4, P.pelvisY + 2, -wsW - 6, wsY + 12);
    ctx.closePath();
    ctx.fillStyle = COL.skinBack;
    ctx.fill();
    ctx.restore();

    // ---- chest wedge --------------------------------------------------------
    // One uninterrupted hide mass carries the silhouette. Smaller planes below
    // describe the anatomy without carving the torso into glossy sections.
    ctx.save();
    ctx.fillStyle = COL.skin;
    wedge();
    ctx.fill();
    ctx.restore();

    // ---- overlapping muscle groups -----------------------------------------
    ctx.save();

    // Latissimus first — it sits underneath the trap and pec.
    ctx.beginPath();
    ctx.moveTo(-shW * 0.74, shY + 10);
    ctx.bezierCurveTo(-shW * 0.86, shY + 52, -wsW - 16, wsY - 34, -wsW - 2, wsY - 6);
    ctx.bezierCurveTo(-shW * 0.34, wsY - 24, -shW * 0.46, shY + 34, -shW * 0.74, shY + 10);
    ctx.closePath();
    ctx.fillStyle = COL.skinDeep;
    ctx.fill();

    // Trapezius / hunch, riding between the neck and the shoulder cap.
    ctx.beginPath();
    ctx.moveTo(-shW * 0.52, shY - 12);
    ctx.bezierCurveTo(-shW * 0.20, shY - 34, shW * 0.16, shY - 30, chF * 0.62, shY - 2);
    ctx.bezierCurveTo(shW * 0.10, shY + 12, -shW * 0.22, shY + 14, -shW * 0.52, shY - 12);
    ctx.closePath();
    ctx.fillStyle = COL.muscle;
    ctx.fill();

    // Pectoral slab — LIGHTER than the base torso, hanging off the clavicle and
    // undercut by a crimson crease so it reads as a shelf of muscle.
    ctx.beginPath();
    ctx.moveTo(chF + 9, shY + 6);
    ctx.bezierCurveTo(chF + 22, shY + 28, chF + 8, shY + 54, -shW * 0.06, shY + 51);
    ctx.bezierCurveTo(-shW * 0.22, shY + 30, -shW * 0.12, shY + 6, chF + 9, shY + 6);
    ctx.closePath();
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = COL.skinLit;
    ctx.fill();

    ctx.strokeStyle = COL.crease;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.42;
    ctx.beginPath();
    ctx.moveTo(chF + 16, shY + 40);
    ctx.quadraticCurveTo(chF * 0.5, shY + 55, -shW * 0.04, shY + 49);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Abdominal wall — overlapping filled segments, narrowing to the waist,
    // each undercut by a crimson crease. Bare stroked lines read as scratches.
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const y = lerp(shY + 60, wsY + 4, t);
      const hw = lerp(chF * 0.66, wsW * 0.62, t);
      const hh = lerp(9.5, 6.5, t);

      ctx.beginPath();
      ctx.moveTo(-hw * 0.72, y);
      ctx.quadraticCurveTo(hw * 0.12, y - hh, hw, y - hh * 0.34);
      ctx.quadraticCurveTo(hw * 0.16, y + hh, -hw * 0.72, y + hh * 0.28);
      ctx.closePath();
      ctx.globalAlpha = 0.16 - t * 0.025;
      ctx.fillStyle = COL.skinLit;
      ctx.fill();

      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = COL.crease;
      ctx.lineWidth = 2.1 - t * 0.4;
      ctx.beginPath();
      ctx.moveTo(-hw * 0.70, y + hh * 0.30);
      ctx.quadraticCurveTo(hw * 0.16, y + hh * 1.02, hw * 0.96, y - hh * 0.30);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // Rim light down the hunched back edge.
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = COL.skinLit;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(back.p3.x + 3, back.p3.y + 2);
    ctx.bezierCurveTo(back.p2.x + 5, back.p2.y, back.p1.x + 6, back.p1.y, back.p0.x + 4, back.p0.y - 4);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  /**
   * The segmented ridge running the length of the back. Sampled along the same
   * bezier that forms the wedge's back contour, so the blades sit exactly on
   * the silhouette instead of floating off an imagined circle.
   */
  drawSpineRidges(ctx) {
    ctx.save();

    const b = this._backCurve;
    const N = 8;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const p = bezPt(b.p0, b.p1, b.p2, b.p3, t);
      const q = bezPt(b.p0, b.p1, b.p2, b.p3, Math.min(1, t + 0.02));
      // Outward normal = tangent rotated a quarter turn.
      const a = Math.atan2(q.y - p.y, q.x - p.x) - Math.PI * 0.5;
      pts.push({
        x: p.x, y: p.y, a,
        h: 21 - Math.abs(t - 0.70) * 17,     // tallest up near the shoulders
        t: 1 - t,
      });
    }

    // Internal fire bleeding through the hide beneath the ridge.
    // Tight per-blade bloom. A wide radius here just pooled into one glowing
    // smear across the flank instead of reading as fire between the spines.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (0.12 + this.eyeFlare * 0.18 + this.breatheCycle * 0.025) * (1 - this.deathFade * 0.75);
    for (const p of pts) {
      if (p.h < 6) continue;
      const rad = 6 + p.h * 0.28;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      g.addColorStop(0.00, COL.molten1);
      g.addColorStop(0.42, 'rgba(255,127,17,0.38)');
      g.addColorStop(1.00, 'rgba(255,60,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    for (const p of pts) {
      if (p.h < 6) continue;
      spine(ctx, p.x, p.y, p.a, p.h * 1.35, 6.4 - p.t * 1.6);
    }

    ctx.restore();
  }

  // ---- head ----------------------------------------------------------------
  drawHead(ctx, bob) {
    ctx.save();

    // Hunched forward and down; tuck jams it deeper into the chest.
    const tuck = this.headTuck;
    const hx = P.headX + tuck * 5;
    const hy = P.headY + bob * 0.85 + tuck * 12 - this.breatheCycle * 1.2;
    ctx.translate(hx, hy);
    ctx.rotate(0.18 + tuck * 0.30);

    const r = P.headR;

    // Ears and horns go down first so their roots are buried by the skull.
    this.drawEars(ctx, r);
    this.drawHorns(ctx, r);

    // Neck — a thick column running down and back into the shoulder mass.
    // (Shoulder sits at head-local ≈ (-8, 28) with the current proportions.)
    limbTaper(ctx, -6, 30, -1, 8, 30, 25, COL.skin, COL.skinDeep, 0.05, false);

    // ---- angular skull ------------------------------------------------------
    // Narrow cranium, heavy overhanging brow, wide protruding muzzle. Built as
    // one path: a circle here is what made it read as a friendly ball.
    const skull = () => {
      ctx.beginPath();
      ctx.moveTo(-r * 1.02, -r * 0.10);                       // back of cranium
      ctx.quadraticCurveTo(-r * 0.92, -r * 0.86, -r * 0.30, -r * 1.00); // top-back angle
      ctx.quadraticCurveTo(r * 0.30, -r * 1.10, r * 0.86, -r * 0.68);   // crown to brow
      ctx.lineTo(r * 1.24, -r * 0.20);                        // brow overhang
      ctx.lineTo(r * 0.96, r * 0.06);                         // socket shelf
      ctx.quadraticCurveTo(r * 1.36, r * 0.20, r * 1.34, r * 0.50); // muzzle bridge
      ctx.lineTo(r * 0.94, r * 0.66);                         // upper lip
      ctx.quadraticCurveTo(r * 0.20, r * 0.80, -r * 0.52, r * 0.62);   // cheek
      ctx.quadraticCurveTo(-r * 1.00, r * 0.44, -r * 1.02, -r * 0.10); // jaw hinge
      ctx.closePath();
    };

    ctx.save();
    ctx.fillStyle = COL.skin;
    skull();
    ctx.fill();

    // A single broad forehead plane echoes the imp's pale belly/head accent.
    // It is clipped to the skull so it cannot disturb the silhouette.
    ctx.save();
    skull();
    ctx.clip();
    ctx.globalAlpha = 0.20;
    ctx.fillStyle = COL.skinLit;
    ctx.beginPath();
    ctx.ellipse(-r * 0.22, -r * 0.46, r * 0.72, r * 0.42, -0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();

    // Deep sockets carved back under the brow.
    ctx.save();
    ctx.fillStyle = COL.socket;
    ctx.beginPath();
    ctx.moveTo(-r * 0.34, -r * 0.30);
    ctx.quadraticCurveTo(r * 0.44, -r * 0.44, r * 0.98, -r * 0.06);
    ctx.quadraticCurveTo(r * 0.40, r * 0.20, -r * 0.30, r * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Glowing eyes — additive, blooming out of the socket shadow.
    this.drawEyes(ctx, r);

    // Brow ridge over the glow, so the eyes read as recessed beneath bone.
    ctx.save();
    ctx.fillStyle = COL.skinLit;
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    ctx.moveTo(-r * 0.60, -r * 0.52);
    ctx.quadraticCurveTo(r * 0.34, -r * 0.72, r * 1.20, -r * 0.22);
    ctx.lineTo(r * 1.00, r * 0.02);
    ctx.quadraticCurveTo(r * 0.30, -r * 0.34, -r * 0.56, -r * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Jaw + fangs, hinged open on impact.
    ctx.save();
    ctx.translate(-r * 0.72, r * 0.34);          // hinge sits at the jaw joint
    ctx.rotate(this.jawOpen * 0.46);
    ctx.translate(r * 0.72, -r * 0.34);
    this.drawJaw(ctx, r);
    ctx.restore();

    ctx.restore();
  }

  /** Pointed, tattered ears swept back off the jaw hinge. */
  drawEars(ctx, r) {
    ctx.save();

    const ear = (ox, oy, len, rise, notch) => {
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.quadraticCurveTo(ox - len * 0.55, oy - rise * 0.90, ox - len, oy - rise);
      // torn notch on the trailing edge
      ctx.lineTo(ox - len * 0.66, oy - rise * 0.42);
      ctx.lineTo(ox - len * 0.78, oy - rise * 0.16);
      ctx.quadraticCurveTo(ox - len * 0.44, oy + notch, ox, oy + notch * 0.5);
      ctx.closePath();
      ctx.fill();
    };

    // Far ear, dimmed.
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = COL.muscle;
    ear(-r * 0.58, -r * 0.06, r * 1.30, r * 0.78, r * 0.26);
    ctx.restore();

    // Near ear: outlined so it separates from the skull, with a lit inner
    // membrane. Filling it in skinDeep left it invisible against the head.
    // A slightly larger ear in the darkest flesh red sits behind the real one,
    // so the silhouette separates from the skull by value, not by an ink line.
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = COL.edgeDeep;
    ear(-r * 0.70, r * 0.18, r * 1.58, r * 0.94, r * 0.32);
    ctx.restore();

    ctx.fillStyle = COL.skin;
    ear(-r * 0.72, r * 0.16, r * 1.46, r * 0.88, r * 0.30);
    ctx.save();
    ctx.globalAlpha = 0.48;
    ctx.fillStyle = mix(COL.muscle, COL.molten0, 0.30);
    ear(-r * 0.82, r * 0.12, r * 1.02, r * 0.58, r * 0.18);
    ctx.restore();

    ctx.restore();
  }

  /**
   * A pair of heavy horns rising off the crown and curling back.
   *
   * The arc centre sits well behind and below the skull, so sweeping the angle
   * *upward* carries each horn up and then back — a centre placed above or in
   * front makes the sweep dive back down and the pair reads as a dark cap.
   */
  drawHorns(ctx, r) {
    ctx.save();

    // The sweep starts at a POSITIVE angle so the first arcs land roughly
    // 0.5r *inside* the cranium — a base sitting on the outer contour is what
    // makes a horn look glued on rather than grown out of the skull.
    // Far horn: shorter, thinner and dimmed by distance.
    ctx.save();
    ctx.globalAlpha = 0.62;
    horn(ctx, -r * 1.55, -r * 0.72, 0.30, -0.86, r * 1.86, r * 0.32);
    ctx.restore();

    // Near horn: the silhouette read.
    horn(ctx, -r * 1.40, -r * 0.90, 0.23, -0.80, r * 2.00, r * 0.42);

    // Small cheek spur, echoing the crown pair.
    ctx.save();
    ctx.globalAlpha = 0.9;
    horn(ctx, -r * 0.30, r * 0.62, -0.42, -1.05, r * 0.86, r * 0.14);
    ctx.restore();

    ctx.restore();
  }

  /**
   * Wide protruding lower jaw with a snarling gum line and bone fangs that
   * overlap the lip. Fangs are drawn as continuous tapered paths rooted inside
   * the gum, both pointing up from the mandible and down from the muzzle.
   */
  drawJaw(ctx, r) {
    ctx.save();

    // Furnace behind the teeth, showing through when the jaw cracks open.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.22 + this.jawOpen * 0.62;
    const mg = ctx.createLinearGradient(-r * 0.40, r * 0.55, r * 1.20, r * 0.55);
    mg.addColorStop(0.00, 'rgba(255,127,17,0)');
    mg.addColorStop(0.45, COL.molten1);
    mg.addColorStop(1.00, 'rgba(255,60,0,0)');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.moveTo(-r * 0.44, r * 0.56);
    ctx.quadraticCurveTo(r * 0.36, r * 0.40, r * 1.10, r * 0.52);
    ctx.quadraticCurveTo(r * 0.36, r * 0.86, -r * 0.44, r * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Mandible: heavy, wide, jutting past the muzzle.
    const jaw = () => {
      ctx.beginPath();
      ctx.moveTo(-r * 0.92, r * 0.36);                                  // hinge
      ctx.quadraticCurveTo(-r * 0.20, r * 0.60, r * 1.06, r * 0.58);    // gum line
      ctx.quadraticCurveTo(r * 1.42, r * 0.74, r * 1.16, r * 1.02);     // chin
      ctx.quadraticCurveTo(r * 0.20, r * 1.30, -r * 0.72, r * 0.92);    // underside
      ctx.quadraticCurveTo(-r * 1.02, r * 0.72, -r * 0.92, r * 0.36);
      ctx.closePath();
    };
    ctx.save();
    ctx.fillStyle = COL.skinDeep;
    jaw();
    ctx.fill();
    ctx.restore();

    // Exposed bone along the mandible edge.
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.strokeStyle = COL.bone;
    ctx.lineWidth = r * 0.13;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.52, r * 0.98);
    ctx.quadraticCurveTo(r * 0.30, r * 1.20, r * 1.02, r * 0.98);
    ctx.stroke();
    ctx.restore();

    // ---- fangs --------------------------------------------------------------
    const fang = (bx, by, len, halfW, dir, lean) => {
      ctx.beginPath();
      ctx.moveTo(bx - halfW, by);
      ctx.quadraticCurveTo(bx - halfW * 0.5, by + dir * len * 0.62,
                           bx + lean, by + dir * len);            // sharp tip
      ctx.quadraticCurveTo(bx + halfW * 0.7, by + dir * len * 0.5,
                           bx + halfW, by);
      ctx.closePath();
      ctx.fillStyle = COL.boneLit;
      ctx.fill();
    };

    // Lower fangs rising from the mandible, overlapping the upper lip.
    fang(r * 0.94, r * 0.56, r * 0.62, r * 0.15, -1, -r * 0.05);
    fang(r * 0.52, r * 0.58, r * 0.44, r * 0.12, -1, -r * 0.04);
    fang(r * 0.12, r * 0.60, r * 0.30, r * 0.10, -1, -r * 0.03);

    // Upper fangs biting down over the lower lip.
    ctx.save();
    ctx.globalAlpha = 0.95;
    fang(r * 0.74, r * 0.50, r * 0.40, r * 0.11, 1, r * 0.03);
    fang(r * 0.30, r * 0.52, r * 0.28, r * 0.09, 1, r * 0.02);
    ctx.restore();

    ctx.restore();
  }

  drawEyes(ctx, r) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Hotter and further-reaching than before, but the *core* stays small so
    // the eyes still read as points of light set deep under the brow rather
    // than a wash across the face. Two stacked gradients: a wide outer bloom
    // and a tight inner furnace.
    // In death the furnace behind the eyes cools to a dim ember and finally
    // to cold ash, rather than staying lit while the body goes slack.
    const cold = this.deathFade;
    const flare = (1 + this.eyeFlare * 1.1 + this.breatheCycle * 0.05) * (1 - cold * 0.7);
    const coreCol = mix(COL.eyeCore, COL.socket, Math.min(1, cold * 1.3));
    const eyes = [[0.5, -1.0, 2.3], [8.5, 0.8, 1.8]]; // far eye reads smaller

    for (const [ex, ey, er] of eyes) {
      const rad = er * flare;

      // Outer bloom — the light the socket throws onto the surrounding hide.
      ctx.globalAlpha = 0.40 * (1 - cold * 0.85);
      const outer = ctx.createRadialGradient(ex, ey, 0, ex, ey, rad * 3.8);
      outer.addColorStop(0.00, 'rgba(255,120,30,0.75)');
      outer.addColorStop(0.42, 'rgba(255,58,10,0.30)');
      outer.addColorStop(1.00, 'rgba(255,40,0,0)');
      ctx.fillStyle = outer;
      ctx.beginPath();
      ctx.arc(ex, ey, rad * 3.8, 0, Math.PI * 2);
      ctx.fill();

      // Inner furnace.
      ctx.globalAlpha = 0.95 * (1 - cold * 0.6);
      const inner = ctx.createRadialGradient(ex, ey, 0, ex, ey, rad * 2.4);
      inner.addColorStop(0.00, coreCol);
      inner.addColorStop(0.26, COL.molten1);
      inner.addColorStop(0.58, COL.eyeGlow);
      inner.addColorStop(1.00, 'rgba(255,58,10,0)');
      ctx.fillStyle = inner;
      ctx.beginPath();
      ctx.arc(ex, ey, rad * 2.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.fillStyle = coreCol;
      ctx.beginPath();
      ctx.arc(ex, ey, rad * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ---- limbs ---------------------------------------------------------------
  // One call per depth layer, matching the strict z-order: 'back' draws the
  // back arm then the back leg, 'front' draws the front leg then the front arm.
  drawLimb(ctx, type, bob) {
    ctx.save();

    const back = type === 'back';
    if (back) {
      this.drawArm(ctx, back, bob);
      this.drawLeg(ctx, back, bob);
    } else {
      this.drawLeg(ctx, back, bob);
      this.drawArm(ctx, back, bob);
    }

    ctx.restore();
  }

  drawLeg(ctx, back, bob) {
    ctx.save();

    const hipX = back ? -P.hipX : P.hipX;
    const hipY = P.pelvisY + bob;
    const foot = back ? this.footB : this.footF;

    // The pose target is the *sole*, not the ankle. Solving IK straight to it
    // put the joint on the floor and left the foot hanging off the side of a
    // leg stub; lifting the ankle by the foot's height sits the leg on top of
    // the foot and drops the pads flat onto the target plane.
    const ankleY = foot.y - ANKLE_LIFT;

    // Knee bends forward (invertKnee = true in this coordinate space).
    const ik = solveTwoBoneIK(hipX, hipY, foot.x, ankleY, P.thigh, P.shin, true);

    const lit    = back ? COL.skinBackLit : COL.skinLit;
    const edge   = back ? COL.skinBackDeep : COL.skinDeep;
    const thighW = back ? 30 : 34;
    const shinW  = back ? 24 : 27;

    // Thigh swells at the haunch and narrows into the knee; the shin tapers
    // again into the ankle. Uniform tubes are what read as scaffolding poles.
    limbTaper(ctx, hipX, hipY, ik.elbowX, ik.elbowY, thighW + 5, thighW * 0.74, lit, edge, 0.20);
    limbTaper(ctx, ik.elbowX, ik.elbowY, ik.handX, ik.handY, shinW, shinW * 0.66, lit, edge, 0.16);

    // Knee bone plate.
    ctx.save();
    if (back) ctx.globalAlpha = 0.72;
    bonePlate(ctx, ik.elbowX, ik.elbowY, shinW * 0.46,
              Math.atan2(ik.handY - ik.elbowY, ik.handX - ik.elbowX));
    ctx.restore();

    // Foot, drawn in ankle space with its sole on the target plane.
    ctx.save();
    ctx.translate(ik.handX, ik.handY);
    this.drawFoot(ctx, back, lit, edge);
    ctx.restore();

    ctx.restore();
  }

  /**
   * Digitigrade foot as a single continuous path: heel pad, sole, and three
   * talons extruded straight out of the foot mass. Local origin is the ANKLE —
   * every ground-contact point is at y = ANKLE_LIFT, so the pads land flat on
   * the pose target rather than hovering above it.
   */
  drawFoot(ctx, back, lit, edge) {
    ctx.save();

    const G = ANKLE_LIFT;   // ground plane in ankle-local space

    const sole = () => {
      ctx.beginPath();
      ctx.moveTo(-13, -G * 0.30);                       // heel, up behind the ankle
      ctx.quadraticCurveTo(-17, G * 0.60, -11, G);      // heel pad down to the floor
      ctx.lineTo(16, G);                                // flat sole
      // three talons extruded forward, every tip resting on the floor
      ctx.quadraticCurveTo(24, G, 31, G - 1.5);
      ctx.quadraticCurveTo(24, G - 4.5, 17, G - 5);
      ctx.quadraticCurveTo(26, G - 6, 32, G - 8);
      ctx.quadraticCurveTo(24, G - 9.5, 16, G - 9.5);
      ctx.quadraticCurveTo(24, G - 12, 29, G - 15);
      ctx.quadraticCurveTo(20, G - 15, 13, G - 13);
      ctx.quadraticCurveTo(16, -G * 0.10, 4, -G * 0.42); // instep back to the ankle
      ctx.closePath();
    };

    ctx.save();
    ctx.fillStyle = mix(lit, edge, 0.34);
    sole();
    ctx.fill();

    // The imp's claws are dark silhouette accents, not bright ivory fingers.
    ctx.fillStyle = COL.bone;
    ctx.beginPath();
    ctx.moveTo(21, G - 3.6); ctx.lineTo(31, G - 1.5); ctx.lineTo(21, G - 0.2);
    ctx.moveTo(21, G - 9.5); ctx.lineTo(32, G - 8); ctx.lineTo(21, G - 5.8);
    ctx.moveTo(19, G - 14.0); ctx.lineTo(29, G - 15); ctx.lineTo(20, G - 10.8);
    ctx.fill();
    ctx.restore();

    // Rear dew-claw hooking back off the heel.
    ctx.save();
    if (back) ctx.globalAlpha = 0.8;
    ctx.translate(-11, G * 0.25);
    ctx.rotate(Math.PI - 0.55);
    claw(ctx, 11, 6, 0.5);
    ctx.restore();

    ctx.restore();
  }

  drawArm(ctx, back, bob) {
    ctx.save();

    const shX = back ? P.shoulderBX : P.shoulderFX;
    const shY = P.shoulderY + bob;
    const hand = back ? this.handB : this.handF;

    // Over-extension on follow-through: the chain itself lengthens so the arm
    // locks out past its resting reach instead of just pointing at the target.
    const u = P.upperArm * this.overreach;
    const f = P.foreArm * this.overreach;

    // Force a minimum elbow flex. The gorilla rest pose puts the hand ~132px
    // from the shoulder against a 120px chain, so the IK locked out straight
    // and the arm hung as a lifeless stick. Pulling the *effective* target in
    // to the distance that yields MIN_ELBOW_FLEX keeps a live bend without
    // touching the pose targets the state machine drives.
    const dx = hand.x - shX, dy = hand.y - shY;
    const reach = Math.hypot(dx, dy) || 1e-4;
    // Law of cosines for the interior elbow angle at full minimum flex.
    const flexed = Math.sqrt(u * u + f * f - 2 * u * f * Math.cos(Math.PI - MIN_ELBOW_FLEX));
    const eff = Math.min(reach, flexed);
    const tx = shX + (dx / reach) * eff;
    const ty = shY + (dy / reach) * eff;

    // Elbow bows backward/outward (invertKnee = false here).
    const ik = solveTwoBoneIK(shX, shY, tx, ty, u, f, false);

    const lit   = back ? COL.skinBackLit : COL.skinLit;
    const edge  = back ? COL.skinBackDeep : COL.skinDeep;
    const upW   = back ? 26 : 30;
    const foreW = back ? 22 : 25;

    // Base arm segments: broad at the shoulder, narrowing hard into the elbow,
    // forearm tapering again into the wrist.
    limbTaper(ctx, shX, shY, ik.elbowX, ik.elbowY, upW + 3, upW * 0.68, lit, edge, 0.26);
    limbTaper(ctx, ik.elbowX, ik.elbowY, ik.handX, ik.handY, foreW + 2, foreW * 0.68, lit, edge, 0.14);

    // ---- overlapping muscle groups on top of the base arm -------------------
    const ua = Math.atan2(ik.elbowY - shY, ik.elbowX - shX);
    const fa = Math.atan2(ik.handY - ik.elbowY, ik.handX - ik.elbowX);

    // Bicep belly: sits on the upper third, peaking short of the elbow so the
    // arm has topography instead of one uniform gradient down its length.
    const bx = lerp(shX, ik.elbowX, 0.40), by = lerp(shY, ik.elbowY, 0.40);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(ua);
    ctx.beginPath();
    ctx.moveTo(-u * 0.30, 0);
    ctx.bezierCurveTo(-u * 0.14, -upW * 0.52, u * 0.16, -upW * 0.50, u * 0.30, 0);
    ctx.bezierCurveTo(u * 0.16, upW * 0.30, -u * 0.14, upW * 0.32, -u * 0.30, 0);
    ctx.closePath();
    ctx.globalAlpha = back ? 0.34 : 0.42;
    ctx.fillStyle = back ? COL.skinBackLit : COL.skinLit;
    ctx.fill();
    ctx.restore();

    // Forearm flexor mass, bulging just past the elbow.
    const fx = lerp(ik.elbowX, ik.handX, 0.34), fy2 = lerp(ik.elbowY, ik.handY, 0.34);
    ctx.save();
    ctx.translate(fx, fy2);
    ctx.rotate(fa);
    ctx.beginPath();
    ctx.moveTo(-f * 0.26, 0);
    ctx.bezierCurveTo(-f * 0.10, -foreW * 0.46, f * 0.14, -foreW * 0.40, f * 0.30, 0);
    ctx.bezierCurveTo(f * 0.14, foreW * 0.26, -f * 0.10, foreW * 0.28, -f * 0.26, 0);
    ctx.closePath();
    ctx.globalAlpha = back ? 0.30 : 0.38;
    ctx.fillStyle = back ? COL.skinBackLit : COL.skinLit;
    ctx.fill();
    ctx.restore();

    // Deltoid LAST of the arm masses and centred slightly outboard of the
    // shoulder pivot, so it caps and hides the joint seam entirely.
    ctx.save();
    ctx.translate(shX, shY);
    ctx.rotate(ua - 0.35);
    ctx.beginPath();
    ctx.moveTo(-upW * 0.86, -upW * 0.28);
    ctx.bezierCurveTo(-upW * 0.30, -upW * 0.92, upW * 0.62, -upW * 0.72, upW * 0.80, upW * 0.04);
    ctx.bezierCurveTo(upW * 0.58, upW * 0.72, -upW * 0.34, upW * 0.86, -upW * 0.86, upW * 0.30);
    ctx.closePath();
    ctx.globalAlpha = back ? 0.72 : 0.82;
    ctx.fillStyle = back ? COL.skinBack : COL.skin;
    ctx.fill();

    // Crimson crease where the deltoid overlaps the bicep.
    ctx.globalAlpha = back ? 0.18 : 0.30;
    ctx.strokeStyle = COL.crease;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-upW * 0.10, upW * 0.62);
    ctx.quadraticCurveTo(upW * 0.44, upW * 0.40, upW * 0.72, -upW * 0.06);
    ctx.stroke();
    ctx.restore();

    // Forearm strain: a molten tendon that lights only while the chain is being
    // forced *past* its resting reach. Keying this off ik.strain would burn it
    // permanently — the gorilla rest pose already sits at full extension.
    if (this.overreach > 1.01 && !back) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, (this.overreach - 1) / 0.13) * 0.55;
      capsuleFlat(ctx, ik.elbowX, ik.elbowY, ik.handX, ik.handY, foreW * 0.30, COL.molten0);
      ctx.restore();
    }

    // Elbow bone plate.
    ctx.save();
    if (back) ctx.globalAlpha = 0.72;
    bonePlate(ctx, ik.elbowX, ik.elbowY, foreW * 0.50,
              Math.atan2(ik.handY - ik.elbowY, ik.handX - ik.elbowX));
    ctx.restore();

    // Hand.
    ctx.save();
    ctx.translate(ik.handX, ik.handY);
    ctx.rotate(Math.atan2(ik.handY - ik.elbowY, ik.handX - ik.elbowX));
    this.drawHand(ctx, back, lit, edge);
    ctx.restore();

    ctx.restore();
  }

  /**
   * Hand as ONE continuous polygon: a blocky asymmetric palm with a heavy heel,
   * out of which the claws are extruded directly. Drawing a circle palm and
   * then parking cones on knuckle coordinates is exactly what made the old
   * hand read as assembled parts rather than one piece of anatomy.
   *
   * Local space: wrist at the origin, hand extending along +x.
   */
  drawHand(ctx, back, lit, edge) {
    ctx.save();

    const s = back ? 0.88 : 1;      // far hand slightly smaller
    ctx.scale(s, s);

    const hand = () => {
      ctx.beginPath();
      // --- palm heel, deliberately asymmetric -------------------------------
      ctx.moveTo(-7, -13);
      ctx.lineTo(3, -16);                                  // top of the knuckle block
      // --- index claw --------------------------------------------------------
      ctx.quadraticCurveTo(16, -20, 33, -17);              // thick base → sharp tip
      ctx.quadraticCurveTo(19, -11, 11, -9);
      // --- middle claw (longest) --------------------------------------------
      ctx.quadraticCurveTo(24, -6, 40, -1);
      ctx.quadraticCurveTo(23, 2, 12, 3);
      // --- ring claw ---------------------------------------------------------
      ctx.quadraticCurveTo(22, 8, 34, 15);
      ctx.quadraticCurveTo(19, 14, 8, 12);
      // --- heel of the palm --------------------------------------------------
      ctx.lineTo(-2, 17);
      ctx.quadraticCurveTo(-12, 14, -13, 3);               // heavy palm heel
      ctx.quadraticCurveTo(-13, -8, -7, -13);
      ctx.closePath();
    };

    ctx.save();
    ctx.fillStyle = mix(lit, edge, 0.30);
    hand();
    ctx.fill();

    // Dark claw tips preserve the hand silhouette without making every finger
    // compete with the face and eyes.
    ctx.fillStyle = COL.bone;
    ctx.beginPath();
    ctx.moveTo(20, -16); ctx.lineTo(33, -17); ctx.lineTo(20, -11);
    ctx.moveTo(23, -5); ctx.lineTo(40, -1); ctx.lineTo(23, 2);
    ctx.moveTo(21, 8); ctx.lineTo(34, 15); ctx.lineTo(19, 13);
    ctx.fill();
    ctx.restore();

    // Knuckle ridge — a scored line, not stacked discs.
    ctx.save();
    ctx.globalAlpha = 0.26;
    ctx.strokeStyle = COL.skinDeep;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(2, -13);
    ctx.quadraticCurveTo(9, 0, 5, 12);
    ctx.stroke();
    ctx.restore();

    // Thumb, extruded off the heel with its own claw.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-6, 8);
    ctx.quadraticCurveTo(2, 20, 15, 26);                   // thumb tip
    ctx.quadraticCurveTo(4, 27, -4, 20);
    ctx.quadraticCurveTo(-9, 15, -6, 8);
    ctx.closePath();
    ctx.fillStyle = mix(lit, edge, 0.32);
    ctx.fill();

    ctx.fillStyle = COL.bone;
    ctx.beginPath();
    ctx.moveTo(7, 21); ctx.lineTo(15, 26); ctx.lineTo(6, 24);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // ---- tail + effects layer -------------------------------------------------
  // The template's slot 2. Hosts the physical tail (which must sit behind the
  // torso, so this is exactly the right depth for it) and every ground effect.
  drawTail(ctx) {
    ctx.save();

    this.drawSpineTail(ctx);
    this.drawImpactFissures(ctx);
    this.drawEmbers(ctx);

    ctx.restore();
  }

  /**
   * Thick segmented tail off the base of the spine. It carries no state of its
   * own — the sway is read straight out of the existing drivers (gait phase,
   * breath, lean, strike phase), so it swings with the body during every
   * animation without the update loop knowing it exists.
   */
  drawSpineTail(ctx) {
    ctx.save();

    const SEG = 7;
    const rootX = -P.hipX - 6;
    const rootY = P.pelvisY - 6 + this.bodyBob;

    // Sway sources: walk cycle, idle breath, and a whip-crack on strike recoil.
    const gait   = Math.sin(this.runCycle * 1.0) * 0.16 * this.moveAmt;
    const idle   = Math.sin(this.time * 1.3) * 0.05;
    const recoil = -this.leanAngle * 0.9;

    let x = rootX, y = rootY;
    let ang = Math.PI * 0.86;            // pointing back and slightly down

    const pts = [{ x, y }];
    for (let i = 0; i < SEG; i++) {
      const t = i / (SEG - 1);
      // Curl accumulates along the tail so the tip trails the root.
      ang += 0.17 + gait * (0.5 + t) + idle * (0.4 + t) + recoil * (0.10 + t * 0.22);
      const len = 15 - t * 5;
      x += Math.cos(ang) * len;
      y += Math.sin(ang) * len;
      pts.push({ x, y });
    }

    // A soft shadow pass joins the segments into one readable silhouette.
    ctx.save();
    ctx.globalAlpha = 0.46;
    for (let i = 0; i < pts.length - 1; i++) {
      const t = i / (pts.length - 2);
      capsuleFlat(ctx, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y,
                  22 - t * 12, COL.skinBackDeep);
    }
    ctx.restore();
    // Flesh, tapering to the tip.
    for (let i = 0; i < pts.length - 1; i++) {
      const t = i / (pts.length - 2);
      capsule(ctx, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y,
              20 - t * 13, COL.skinBackLit, COL.skinBackDeep, false);
    }

    // Segment rings + a dorsal fin of small spines running the length.
    for (let i = 1; i < pts.length - 1; i++) {
      const t = i / (pts.length - 2);
      const a = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
      ctx.save();
      ctx.globalAlpha = 0.30;
      bonePlate(ctx, pts[i].x, pts[i].y, (7.2 - t * 4.2), a);
      ctx.restore();
      if (t < 0.85) spine(ctx, pts[i].x, pts[i].y, a - Math.PI * 0.5, 11 - t * 6, 3.4 - t * 1.4);
    }

    // Barbed tip.
    const last = pts[pts.length - 1], prev = pts[pts.length - 2];
    ctx.save();
    ctx.translate(last.x, last.y);
    ctx.rotate(Math.atan2(last.y - prev.y, last.x - prev.x));
    claw(ctx, 19, 9, 0.55);
    ctx.restore();

    ctx.restore();
  }

  /**
   * Ground impact. Rather than a clean ring, the floor splits: jagged fissures
   * radiate from the point of impact, lit from within by a molten gradient, and
   * volcanic rock is thrown clear and drifts as it fades.
   *
   * Everything is a pure function of `this.shock` / `this.dust` (both already
   * decayed by update), so the debris needs no particle state of its own —
   * identical input always yields an identical frame.
   */
  drawImpactFissures(ctx) {
    if (this.shock <= 0.01 && this.dust <= 0.01) return;
    ctx.save();

    const s = this.shock;          // 1 → 0 over the life of the impact
    const k = 1 - s;               // 0 → 1, the expansion parameter
    const ox = this.shockX;

    // --- fissures -----------------------------------------------------------
    if (s > 0.01) {
      const reach = 26 + k * 104;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Molten light welling up out of the crack, brightest at the centre.
      ctx.globalAlpha = s * 0.85;
      const core = ctx.createRadialGradient(ox, -4, 0, ox, -4, reach * 0.9);
      core.addColorStop(0.00, COL.molten1);
      core.addColorStop(0.22, COL.molten0);
      core.addColorStop(0.60, 'rgba(255,58,10,0.22)');
      core.addColorStop(1.00, 'rgba(255,40,0,0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.ellipse(ox, -4, reach * 0.9, reach * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();

      // Six cracks, each a jagged polyline stepping outward along the ground.
      // The zig-zag is generated from a fixed hash per branch, so a given
      // impact always cracks the same way for the whole of its life.
      const grad = ctx.createLinearGradient(ox - reach, 0, ox + reach, 0);
      grad.addColorStop(0.00, 'rgba(255,127,17,0)');
      grad.addColorStop(0.28, COL.molten0);
      grad.addColorStop(0.50, COL.molten1);
      grad.addColorStop(0.72, COL.molten0);
      grad.addColorStop(1.00, 'rgba(255,127,17,0)');

      ctx.strokeStyle = grad;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let b = 0; b < 6; b++) {
        const dir = b % 2 ? 1 : -1;
        const seed = b * 12.9898;
        const spread = 0.18 + (b >> 1) * 0.16;      // three fans per side
        const lenF = 0.55 + ((b * 37) % 45) / 100;  // deterministic per branch

        ctx.globalAlpha = s * 0.9;
        ctx.lineWidth = (3.4 - (b >> 1) * 0.8) * s + 0.6;
        ctx.beginPath();
        ctx.moveTo(ox, -4);
        let px = ox, py = -4;
        for (let i = 1; i <= 5; i++) {
          const t = i / 5;
          const step = reach * lenF * t;
          // Jag alternates side to side; amplitude grows with distance.
          const jag = Math.sin(seed + i * 2.3) * 7 * t;
          px = ox + dir * step;
          py = -4 - Math.sin(spread) * step * 0.30 + jag * 0.55;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // --- volcanic debris ----------------------------------------------------
    // Ballistic arcs thrown from the impact, fading as they settle.
    if (this.dust > 0.01) {
      const d = this.dust, kd = 1 - d;
      ctx.save();
      for (let i = 0; i < 11; i++) {
        const dir = i % 2 ? 1 : -1;
        const sp = 0.35 + ((i * 29) % 70) / 70;      // deterministic speed
        const size = 1.8 + ((i * 17) % 40) / 12;
        const dx = dir * sp * 78 * kd;
        // Simple ballistic: up fast, then gravity pulls it back to the floor.
        const dy = -(sp * 54 * kd) + (kd * kd) * 78 * sp;

        ctx.globalAlpha = d * 0.85;
        ctx.fillStyle = COL.rock;
        ctx.save();
        ctx.translate(ox + dx, Math.min(-2, -6 + dy));
        ctx.rotate(kd * 6 * dir + i);
        ctx.beginPath();
        ctx.moveTo(-size, -size * 0.7);
        ctx.lineTo(size * 0.8, -size);
        ctx.lineTo(size, size * 0.6);
        ctx.lineTo(-size * 0.6, size);
        ctx.closePath();
        ctx.fill();

        // Cooling edge — each shard keeps a molten rim early on.
        ctx.globalAlpha = d * d * 0.9;
        ctx.strokeStyle = COL.molten0;
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  /** Ambient embers rising off the hide. */
  drawEmbers(ctx) {
    if (this.deathFade > 0.97) return; // fire's gone out, nothing left to rise
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const ph = (this.time * 0.34 + i * 0.25) % 1;
      ctx.globalAlpha = (1 - ph) * 0.30 * (1 - this.deathFade);
      const ex = -26 + i * 20 + Math.sin(this.time * 1.4 + i) * 7;
      const ey = -150 - ph * 54;
      const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 5);
      g.addColorStop(0.00, COL.molten1);
      g.addColorStop(0.45, 'rgba(255,127,17,0.5)');
      g.addColorStop(1.00, 'rgba(255,60,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ex, ey, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Game adapter
//
// state.enemies holds plain objects, not class instances, so each brute's rig
// lives in a WeakMap keyed by the entity (it dies with the entity, no cleanup).
//
// The rig is ticked from EnemyAI.updateEnemyGait — NOT from the renderer. An
// off-screen or culled brute is skipped by drawEnemies(), so ticking in draw
// would freeze its gait and then snap it forward the moment it came into view.
// This mirrors the reasoning already documented on updateEnemyGait().
// ---------------------------------------------------------------------------

const RIGS = new WeakMap();

/** Attack kind → Brute state + variation. */
const BRUTE_ATTACKS = {
  bruteWallSmash: ['wall', 0],
  bruteSlam:   ['siege', 0],
  bruteStomp:  ['siege', 1],
  bruteSweep:  ['melee', 0],
  bruteHammer: ['melee', 1],
  bruteThrow:  ['throw', 0],
};

export function bruteRig(e) {
  let rig = RIGS.get(e);
  if (!rig) {
    rig = new Brute(0, 0);
    rig.time = (e.x || 0) * 0.013; // desync neighbours without a random seed
    RIGS.set(e, rig);
  }
  return rig;
}

/**
 * Drive a brute's rig from the entity's AI signals. Call once per tick per
 * living brute, before rendering.
 */
// The rig's own timeline already opens with a coil, so the AI's pre-strike
// telegraph (aiState "attacking", lasting windupDur) maps onto its first
// stretch and the blow lands on the AI's schedule. Without this the brute
// stands idle through the telegraph and then snaps — a dead beat before every
// swing. This is the same windup → impact → recovery split EnemyRig documents.
const BRUTE_WINDUP_SPAN = 0.4; // fraction of the rig timeline spent coiling

export function updateBruteRig(e, dt) {
  const rig = bruteRig(e);

  if (e.dying) {
    rig._phase = 'death';
    rig.state = 'death';
    // The kill/knockback physics owns e.deathT vs e.deathDuration (varies with
    // overkill); the rig only needs the normalized fraction of that to pace
    // its own limp-and-collapse timeline against it.
    const dp = clamp01((e.deathT || 0) / (e.deathDuration || 1));
    rig.update(dt, 0, dp);
    return;
  }

  const striking = (e.attackAnim || 0) > 0;
  const telegraphing = !striking && e.aiState === 'attacking' && (e.windupDur || 0) > 0;
  let stateTime = 0;

  if (striking) {
    const dur = e.attackDur || 0.5;
    // Latch the variation for the whole strike so it can't flicker mid-swing.
    if (rig._phase !== 'strike') {
      const map = BRUTE_ATTACKS[e.attackKind];
      if (map) { rig.state = map[0]; rig.attackVariation = map[1]; }
      else { rig.state = 'melee'; rig.attackVariation ^= 1; }
      rig._family = rig.state;
      rig._phase = 'strike';
    }
    // attackAnim counts *down*, so elapsed is the complement. Scale the rig's
    // own timeline to the AI's window and offset past the coil already played.
    const own = rig.attackDuration();
    const p = Math.max(0, dur - e.attackAnim) / dur;
    stateTime = (BRUTE_WINDUP_SPAN + p * (1 - BRUTE_WINDUP_SPAN)) * own;
  } else if (telegraphing) {
    // EnemyAI chooses the variation as soon as the windup starts, so this coil
    // is the opening of the exact same motion that will finish the strike.
    if (rig._phase !== 'windup') {
      const map = BRUTE_ATTACKS[e._preparedAttackKind || e.attackKind];
      if (map) {
        rig.state = map[0];
        rig.attackVariation = map[1];
        rig._family = rig.state;
      } else {
        rig.state = rig._family || 'melee';
      }
      rig._phase = 'windup';
    }
    const own = rig.attackDuration();
    const p = clamp01(1 - e.stateTimer / e.windupDur);
    stateTime = p * BRUTE_WINDUP_SPAN * own;
  } else {
    rig._phase = 'rest';
    rig.state = e.moving ? 'walk' : 'idle';
  }

  // e.moveSpeed is already a magnitude, so the rig never flips its own facing —
  // drawEnemies() owns mirroring via e.dir.
  rig.update(dt, e.moving ? (e.moveSpeed || 0) : 0, stateTime);
}
