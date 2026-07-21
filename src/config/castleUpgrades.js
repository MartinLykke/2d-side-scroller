export const CASTLE_UPGRADES = [
  {
    id: "masonry",
    name: "Murder Holes",
    col: "#d8c49a",
    costs: [35, 72, 120],
    desc: "Machicolations along the gatehouse pour scalding oil on anything that reaches your door, while thicker walls shrug off more punishment.",
    effects: [
      "+45 castle HP · scalding oil scorches and slows foes at the gate",
      "+95 castle HP · hotter oil, wider scald radius",
      "+155 castle HP · the cauldrons never stop boiling",
    ],
  },
  {
    id: "garrison",
    name: "War Drums",
    col: "#9bd05a",
    costs: [32, 68, 112],
    desc: "A drum tower musters more subjects to the banner and beats a war rhythm that spurs your whole garrison to fight faster.",
    effects: [
      "+4 population cap · periodic war-drum fervor for your subjects",
      "+9 population cap · drums beat faster and the fervor lasts longer",
      "+15 population cap · the garrison never misses a beat",
    ],
  },
  {
    id: "treasury",
    name: "Greedwyrm's Hoard",
    col: "#f2c14e",
    costs: [28, 58, 98],
    desc: "A hoard-wyrm coils atop the vault, carrying more gold and occasionally spitting up a burst of coin for the crown.",
    effects: [
      "+60 gold carry cap · the hoard occasionally overflows",
      "+140 gold carry cap · bigger, more frequent overflow",
      "+240 gold carry cap · the wyrm showers you in gold",
    ],
  },
  {
    id: "aegis",
    name: "Ember Lens",
    col: "#ff8a3d",
    costs: [46, 88, 145],
    desc: "Focuses the crown flame into a castle smite before the Royal Capital awakens.",
    effects: ["castle smite online", "wider, faster smites", "royal-grade firestorm"],
  },
  {
    id: "siege",
    name: "Warwolf Cradle",
    col: "#9aa5ad",
    unlockLevel: 5,
    costs: [60, 115, 185],
    desc: "A wall-mounted trebuchet crew, drilled to lob boulders at the horde before it reaches the gate.",
    effects: [
      "Lobs a boulder at the deadliest approaching foe every few seconds",
      "Reinforced cradle: heavier stones, faster winch, wider blast",
      "Twin-arm cradle: hurls a boulder down each flank at once",
    ],
  },
];

export const CASTLE_UPGRADE_IDS = CASTLE_UPGRADES.map(u => u.id);
export const CASTLE_UPGRADE_MAP = Object.fromEntries(CASTLE_UPGRADES.map(u => [u.id, u]));
