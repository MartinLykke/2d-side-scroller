// The Runeforge — a linear track of arcane fortification upgrades bought at
// the runeforge obelisk (unlocks at base level 3). Each tier is purchased in
// order; `id` is what the effect hooks key on.
export const FORT_TRACK = [
  {
    id: "ember1", name: "Ember Wards", cost: 30, col: "#ff8a3d",
    blurb: "fire runes ignite enemies that strike your walls",
  },
  {
    id: "stone", name: "Stoneskin Masonry", cost: 45, col: "#f2c14e",
    blurb: "walls and base gain +25% max HP",
  },
  {
    id: "frost", name: "Frost Wards", cost: 70, col: "#7ec8e8",
    blurb: "enemies near your walls are chilled and slowed",
  },
  {
    id: "ember2", name: "Greater Ember Wards", cost: 95, col: "#ff6a20",
    blurb: "wall runes burn hotter and longer",
  },
  {
    id: "sigil", name: "Crown Sigil", cost: 130, col: "#c9a2ff",
    blurb: "an arcane ring over the base pulses damage at nearby foes",
  },
  {
    id: "bulwark", name: "Bulwark of the Ancients", cost: 170, col: "#9be8c0",
    blurb: "+50% more defense HP, walls reflect damage to attackers",
  },
];

// Extra max-HP multiplier granted to walls and base by purchased tiers.
export function fortHpMultAt(level) {
  let m = 1;
  for (let i = 0; i < level && i < FORT_TRACK.length; i++) {
    if (FORT_TRACK[i].id === "stone") m += 0.25;
    if (FORT_TRACK[i].id === "bulwark") m += 0.5;
  }
  return m;
}
