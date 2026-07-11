export const ARCHER_SKILLS = {
  // ── Branch 1: The Arrow ──
  fire_arrows: {
    id: "fire_arrows", branch: 1, row: 1,
    name: "Fire Arrows",
    desc: "Every 4th shot is a fire arrow — ignites the target for 3 sec.",
    cost: 1, requires: [],
  },
  piercing_shot: {
    id: "piercing_shot", branch: 1, row: 2,
    name: "Piercing Shot",
    desc: "Arrows fly through and can hit up to 2 enemies in a line.",
    cost: 2, requires: ["fire_arrows"],
  },
  bouncing_volley: {
    id: "bouncing_volley", branch: 1, row: 3,
    name: "Ricocheting Arrows",
    desc: "The arrow bounces on to the next enemy after hitting a target.",
    cost: 3, requires: ["piercing_shot"],
  },

  // ── Branch 2: The Bow ──
  double_shot: {
    id: "double_shot", branch: 2, row: 1,
    name: "Double Shot",
    desc: "Archers shoot two arrows at a time in a small spread.",
    cost: 1, requires: [],
  },
  barrage: {
    id: "barrage", branch: 2, row: 2,
    name: "Arrow Rain",
    desc: "Press Q — all archers fire 5 arrows at once at the nearest enemy.",
    cost: 2, requires: ["double_shot"],
  },
  powershot: {
    id: "powershot", branch: 2, row: 3,
    name: "Power Shot",
    desc: "Stand still for 3 sec → next shot is charged: 3× damage and heavy knockback.",
    cost: 3, requires: ["barrage"],
  },

  // ── Branch 3: Tactics ──
  caltrops: {
    id: "caltrops", branch: 3, row: 1,
    name: "Caltrops",
    desc: "Outside the base: the archer places a caltrop trap that snaps shut on the enemy and halves their speed for 2 sec. Cooldown: 10 sec.",
    cost: 1, requires: [],
  },
  hunters_mark: {
    id: "hunters_mark", branch: 3, row: 2,
    name: "Hunter's Mark",
    desc: "Arrow hits mark the target for 5 sec — marked enemies take +1 damage from every arrow.",
    cost: 2, requires: ["caltrops"],
  },
  grappling_hook: {
    id: "grappling_hook", branch: 3, row: 3,
    name: "Grappling Hook",
    desc: "Archers fire a grappling hook and zip up onto their wall post instead of climbing.",
    cost: 3, requires: ["hunters_mark"],
  },

  // ── Ultimates ──
  master_shadows: {
    id: "master_shadows", branch: 0, row: 4,
    name: "Master of Shadows",
    desc: "Archers are half-invisible at night — only visible for a moment after shooting.",
    cost: 5, requires: ["bouncing_volley", "hunters_mark"],
    ultimate: true,
  },
  heavy_ballista: {
    id: "heavy_ballista", branch: 0, row: 4,
    name: "Heavy Ballista",
    desc: "Archers re-arm as armored ballista teams: slow, but massive bolts deal 5× damage with brutal knockback.",
    cost: 5, requires: ["powershot", "grappling_hook"],
    ultimate: true,
  },
};
