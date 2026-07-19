export const CASTLE_UPGRADES = [
  {
    id: "masonry",
    name: "Mason's Rise",
    col: "#d8c49a",
    costs: [35, 72, 120],
    desc: "Thicker curtain walls, buttresses and an armored gate raise castle HP.",
    effects: ["+45 castle HP", "+95 castle HP", "+155 castle HP"],
  },
  {
    id: "garrison",
    name: "Garrison Wings",
    col: "#9bd05a",
    costs: [32, 68, 112],
    desc: "New barracks and drill yards let the crown field a larger army.",
    effects: ["+4 population cap", "+9 population cap", "+15 population cap"],
  },
  {
    id: "treasury",
    name: "Treasury Vault",
    col: "#f2c14e",
    costs: [28, 58, 98],
    desc: "Secure vaults and tax offices let the monarch carry more gold.",
    effects: ["+60 gold carry cap", "+140 gold carry cap", "+240 gold carry cap"],
  },
  {
    id: "aegis",
    name: "Ember Lens",
    col: "#ff8a3d",
    costs: [46, 88, 145],
    desc: "Focuses the crown flame into a castle smite before the Royal Capital awakens.",
    effects: ["castle smite online", "wider, faster smites", "royal-grade firestorm"],
  },
];

export const CASTLE_UPGRADE_IDS = CASTLE_UPGRADES.map(u => u.id);
export const CASTLE_UPGRADE_MAP = Object.fromEntries(CASTLE_UPGRADES.map(u => [u.id, u]));
