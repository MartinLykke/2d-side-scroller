// ---------------------------------------------------------------------------
// EnemyRig — shared animation foundation for biome (and other) enemies.
//
// Mirrors the hooded archer's architecture (Archer.js): the *timing* of
// movement and attacks is owned by the update loop (EnemyAI.updateEnemyGait /
// startEnemyAttack), never derived by mutating entity state during a draw call.
// Renderers read these two accessors and let the whole body react to one shared
// timing language, instead of each enemy inventing its own Math.sin + guessed
// attackAnim divisor.
//
// Contract — fields written by EnemyAI.js, read here:
//   e.moving     bool    above a small speed threshold
//   e.moveSpeed  px/s    smoothed ground speed (framerate-independent)
//   e.gaitLean   -1..1   smoothed forward/backward body lean
//   e.anim       phase   shared gait accumulator (ticked in the loop)
//   e.attackAnim >0      remaining strike time
//   e.attackDur  s       full duration of the current strike (so p is real)
//   e.attackImpact 0..1  where in the strike the blow lands (default 0.28)
//   e.attackKind string  optional label ("bash" | "swipe" | "spit" | "lob" | …)
//   e.aiState/e.stateTimer/e.windupDur  the pre-strike telegraph, when present
// ---------------------------------------------------------------------------

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

// smoothstep — the same easing the archer uses, so friend and foe share a feel.
export const ease = p => { p = clamp01(p); return p * p * (3 - 2 * p); };

// Gait signal. `run` is a normalized 0..1 exertion so heavy enemies read slower
// than skittering ones off the very same measured speed. `phase` is the shared
// e.anim accumulator; renderers still scale it per-archetype (a greedlet's legs
// cycle faster than a golem's), but they no longer fabricate the movement
// amount itself — that comes from real, culling-proof motion.
export function gait(e) {
  const speed = e.moveSpeed || 0;
  const moving = !!e.moving;
  const run = moving ? clamp01((speed - 10) / 48) : 0;
  return { moving, speed, run, lean: e.gaitLean || 0, phase: e.anim || 0 };
}

// Normalized attack pose. One timeline for every enemy:
//
//   windup   AI telegraph (aiState "attacking") — the limb coils back
//   strike   the attackAnim window — snaps to full reach at `impact`, then
//   recover  eases back toward rest through the follow-through
//
// `ext` is the master extension driver used by renderers:
//   < 0  while coiling (anticipation)
//   → 1  at the moment of impact (a fast snap, matching a decisive blow)
//   → 0  easing back out through the recovery
// Mapping `ext` onto an arm, a tail, a maw, or a whole-body lunge makes all
// attacks share one language, so nothing "starts mid-motion" or "holds a grim
// pose too long" the way a mid-window sine peak did.
//
//   swing    = max(0, ext), for limbs that only ever extend forward
//   hit      an impact pulse (peaks at contact) for flashes / dust / recoil
export function attackPose(e) {
  const dur = e.attackDur || 0.24;
  const striking = (e.attackAnim || 0) > 0;
  const p = striking ? clamp01(1 - (e.attackAnim || 0) / dur) : -1;

  const wdur = e.windupDur || 0;
  const winding = !striking && e.aiState === "attacking" && wdur > 0;
  const wind = winding ? clamp01(1 - (e.stateTimer || 0) / wdur) : 0;

  const impact = e.attackImpact ?? 0.28;

  // `ext` — for thrusts / lunges / snatches that EXTEND at contact:
  //   coil back (<0) during the telegraph → snap to 1 at impact → settle to 0.
  let ext = 0;
  if (striking) {
    ext = p < impact
      ? ease(p / impact)                               // fast snap to contact
      : 1 - 0.9 * ease((p - impact) / (1 - impact));   // follow-through / settle
  } else if (winding) {
    ext = -0.4 * ease(wind);                           // draw back (anticipation)
  }

  // `raise` — for overhead slams (clubs, fists, tails): weapon LOADS high, then
  //   swings DOWN onto the target. 1 = fully loaded overhead, 0 = slammed to the
  //   contact point, with a small rebound through the follow-through.
  let raise = 0;
  if (winding) raise = ease(wind);                     // hoist up during the telegraph
  else if (striking) {
    raise = p < impact
      ? 1 - ease(p / impact)                           // drive down to contact
      : 0.18 * Math.sin(((p - impact) / (1 - impact)) * Math.PI); // rebound + settle
  }

  const hit = striking ? clamp01(1 - Math.abs(p - impact) / Math.max(impact, 0.12)) : 0;

  return {
    active: striking || winding,
    striking, winding,
    p,            // 0..1 through the strike, −1 when not striking
    wind,         // 0..1 through the telegraph, 0 when none
    ext,          // signed master extension (coil → snap → settle)
    raise,        // 0..1 overhead load → slam-down driver
    swing: ext > 0 ? ext : 0,
    hit,          // 0..1 impact pulse, peaks at contact
    impact,
    kind: e.attackKind || null,
  };
}
