export const ARCHER_SKILLS = {
  // ── Gren 1: Pilen ──
  fire_arrows: {
    id: "fire_arrows", branch: 1, row: 1,
    name: "Brandpile",
    desc: "Hvert 4. skud er en brandpil — sætter ild til målet i 3 sek.",
    cost: 1, requires: [],
  },
  piercing_shot: {
    id: "piercing_shot", branch: 1, row: 2,
    name: "Gennemborende Skud",
    desc: "Pile flyver igennem og kan ramme op til 2 fjender på linje.",
    cost: 2, requires: ["fire_arrows"],
  },
  bouncing_volley: {
    id: "bouncing_volley", branch: 1, row: 3,
    name: "Rikochetterende Pile",
    desc: "Pilen springer videre til næste fjende ved ramte mål.",
    cost: 3, requires: ["piercing_shot"],
  },

  // ── Gren 2: Buen ──
  double_shot: {
    id: "double_shot", branch: 2, row: 1,
    name: "Dobbeltskud",
    desc: "Bueskytterne skyder to pile ad gangen i en lille vifte.",
    cost: 1, requires: [],
  },
  barrage: {
    id: "barrage", branch: 2, row: 2,
    name: "Pilsregn",
    desc: "Tryk Q — alle bueskytter fyrer 5 pile på én gang mod nærmeste fjende.",
    cost: 2, requires: ["double_shot"],
  },
  powershot: {
    id: "powershot", branch: 2, row: 3,
    name: "Kraftskud",
    desc: "Stille i 3 sek → næste skud er ladet: 3× skade og kraftig knockback.",
    cost: 3, requires: ["barrage"],
  },

  // ── Gren 3: Taktik ──
  caltrops: {
    id: "caltrops", branch: 3, row: 1,
    name: "Pigfælder",
    desc: "Udenfor basen: bueskytten lægger en pigfælde der klapper sammen om fjenden og halverer farten i 2 sek. Cooldown: 10 sek.",
    cost: 1, requires: [],
  },
  smoke_bomb: {
    id: "smoke_bomb", branch: 3, row: 2,
    name: "Røgbombe",
    desc: "Ramt i nærkamp: røgbombe giver 2 sek usårlighed og escape.",
    cost: 2, requires: ["caltrops"],
  },
  grappling_hook: {
    id: "grappling_hook", branch: 3, row: 3,
    name: "Entrehage",
    desc: "Bueskytter teleporterer øjeblikkeligt op på tårne.",
    cost: 3, requires: ["smoke_bomb"],
  },

  // ── Ultimative ──
  master_shadows: {
    id: "master_shadows", branch: 0, row: 4,
    name: "Skyggernes Mester",
    desc: "Bueskytter er halvsynlige om natten — kun synlige et øjeblik efter at skyde.",
    cost: 5, requires: ["bouncing_volley", "smoke_bomb"],
    ultimate: true,
  },
  heavy_ballista: {
    id: "heavy_ballista", branch: 0, row: 4,
    name: "Balistakrydsskytter",
    desc: "Tunge balistaer: langsomt, men 5× skade med massiv knockback.",
    cost: 5, requires: ["powershot", "grappling_hook"],
    ultimate: true,
  },
};
