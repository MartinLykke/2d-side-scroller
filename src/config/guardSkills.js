export const GUARD_SKILLS = {
  // ── Gren 1: Spyd ──
  piercing_thrust: {
    id: "piercing_thrust", branch: 1, row: 1,
    name: "Trængende Stød",
    desc: "Stød øger skaden med 50% og gennemtrænger 2 fjender på linje.",
    cost: 1, requires: [],
  },
  impale_wall_climber: {
    id: "impale_wall_climber", branch: 1, row: 2,
    name: "Murtrolde-Spyd",
    desc: "Hvis en fjende klatrer på mur: spyd dem fast og kast dem langt væk.",
    cost: 2, requires: ["piercing_thrust"],
  },
  whirlwind_strike: {
    id: "whirlwind_strike", branch: 1, row: 3,
    name: "Hvirvlende Slag",
    desc: "Spin omkring og ramt alle fjender i nærheden — cooldown 4 sek.",
    cost: 3, requires: ["impale_wall_climber"],
  },

  // ── Gren 2: Skjold ──
  shield_bash: {
    id: "shield_bash", branch: 2, row: 1,
    name: "Skjoldstød",
    desc: "Tryk Q — skjoldstød slår fjenden baglæns og stivner dem i 1 sek.",
    cost: 1, requires: [],
  },
  shield_wall: {
    id: "shield_wall", branch: 2, row: 2,
    name: "Skjoldmur",
    desc: "Når fjenden rammer: reflektér 40% af skaden tilbage til angriberen.",
    cost: 2, requires: ["shield_bash"],
  },
  unbreakable: {
    id: "unbreakable", branch: 2, row: 3,
    name: "Ubrydeligt",
    desc: "Maksimal HP stiger med 4, og tar 20% mindre skade fra alle kilder.",
    cost: 3, requires: ["shield_wall"],
  },

  // ── Gren 3: Taktik ──
  guard_stance: {
    id: "guard_stance", branch: 3, row: 1,
    name: "Vågen Holdning",
    desc: "Når stille: reducér incoming skade med 30% og omdannelse til XP.",
    cost: 1, requires: [],
  },
  taunt: {
    id: "taunt", branch: 3, row: 2,
    name: "Styremandat",
    desc: "Ramt fjende: tvinge dem til at angribe dig næste sek i stedet for basis.",
    cost: 2, requires: ["guard_stance"],
  },
  rally_cry: {
    id: "rally_cry", branch: 3, row: 3,
    name: "Samlingsråb",
    desc: "Tryk Q — alle allierede enheder får +20% skade i 6 sekunder.",
    cost: 3, requires: ["taunt"],
  },

  // ── Ultimative ──
  spear_titan: {
    id: "spear_titan", branch: 0, row: 4,
    name: "Spydtitan",
    desc: "Spyd vokser massivt: 3× rækkevidde, 4× skade, kan splitte fjender.",
    cost: 5, requires: ["whirlwind_strike", "taunt"],
    ultimate: true,
  },
  fortress_guardian: {
    id: "fortress_guardian", branch: 0, row: 4,
    name: "Fæstningens Værnr",
    desc: "Skjold dekker 360°: modstår alle projektiler, og næby allierede tar -25% skade.",
    cost: 5, requires: ["unbreakable", "rally_cry"],
    ultimate: true,
  },
};
