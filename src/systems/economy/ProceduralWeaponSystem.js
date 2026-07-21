// Procedural weapon generation: builds a brand-new weapon definition (name,
// category, rarity, stats, an innate affix, and its own unique-upgrade pool)
// and registers it into the same runtime WEAPONS / UNIQUE_UPGRADES tables
// the hand-authored roster lives in, so every other system (combat, loot,
// rendering, the upgrade menu) treats it identically to a curated weapon.
//
// Generated weapons are id-prefixed "gen_" and tracked in a local registry
// so a save can re-register the handful currently in play (player.weapon /
// inventory / chests) after a reload — see exportGeneratedWeapon /
// restoreGeneratedWeapon, wired up in SaveSystem.js.
import { WEAPONS, RARITY_COL } from '../../config/weapons.js?v=biomeweapons1';
import { UNIQUE_UPGRADES } from '../../config/weaponUpgrades.js?v=biomeweapons1';
import {
  WEAPON_CATEGORIES, RARITY_WEIGHTS, AFFIX_COUNT_BY_RARITY, PREFIXES,
  PLAIN_SUFFIXES, EPITHETS, NOUNS, STAT_RANGES, AFFIX_POOL, THEME_BANK,
  SPELL_ELEMENTS, SPELL_FORMS, TRAVEL_BEHAVIORS, IMPACT_EFFECTS, VISUAL_FLOURISHES,
} from '../../config/proceduralWeapons.js?v=procweap1';

const registry = {}; // id -> { def, uniqueUpgrades }

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function pickN(arr, n) {
  const pool = arr.slice();
  const out = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

function randRange(lo, hi) { return lo + Math.random() * (hi - lo); }

function rollRarity() {
  const total = RARITY_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < RARITY_WEIGHTS.length; i++) {
    r -= RARITY_WEIGHTS[i];
    if (r < 0) return i;
  }
  return RARITY_WEIGHTS.length - 1;
}

function buildInnate(category, rarity) {
  const count = AFFIX_COUNT_BY_RARITY[rarity] || 0;
  if (!count) return { innate: null, affixes: [] };
  const affixes = pickN(AFFIX_POOL[category], count);
  const innate = {};
  for (const a of affixes) {
    const v = a.value(rarity);
    for (const k in v) {
      innate[k] = typeof v[k] === "number" ? (innate[k] || 0) + v[k] : v[k];
    }
  }
  return { innate, affixes };
}

function buildUniqueUpgrades(id, category) {
  const themes = pickN(THEME_BANK[category], 2);
  const upgrades = [];
  for (const theme of themes) {
    upgrades.push({
      id: `${id}_${theme.key}_epic`, tier: "epic",
      name: theme.name, desc: theme.desc,
      effect: { ...theme.epic }, vfxCol: theme.col,
    });
    upgrades.push({
      id: `${id}_${theme.key}_legendary`, tier: "legendary",
      name: theme.legendName, desc: theme.legendDesc,
      effect: { ...theme.legendary }, vfxCol: theme.col,
    });
  }
  return upgrades;
}

export function generateProceduralWeapon(rarity = null) {
  const category = pick(WEAPON_CATEGORIES);
  const r = rarity ?? rollRarity();
  const noun = pick(NOUNS[category]);
  const prefix = pick(PREFIXES[r]);
  const { innate, affixes } = buildInnate(category, r);

  // Magic weapons roll a full 5-axis spell recipe: an Element (flavor +
  // color), independent of a Form (projectile shape), a Travel behavior, an
  // Impact effect, and a visual/audio Flourish. An affix that names a
  // spellType (e.g. spellBurn -> fireball) pins the element to match.
  let element = null;
  if (category === "magic") {
    const forcedKey = affixes.find(a => a.spellType)?.spellType;
    element = (forcedKey && SPELL_ELEMENTS.find(e => e.key === forcedKey)) || pick(SPELL_ELEMENTS);
  }

  const suffix = affixes.length ? affixes[0].suffix
    : element ? `of the ${element.name}`
    : (Math.random() < 0.5 ? pick(PLAIN_SUFFIXES) : null);
  const epithet = r >= 4 && Math.random() < 0.3 ? pick(EPITHETS) : null;
  const name = `${prefix} ${noun.label}${suffix ? " " + suffix : ""}${epithet ? ", " + epithet : ""}`;

  const ranges = STAT_RANGES[category];
  const [dmgLo, dmgHi] = ranges.dmgByRarity[r];
  const dmg = Math.round(randRange(dmgLo, dmgHi) * 10) / 10;
  const speed = Math.round(randRange(ranges.speed[0], ranges.speed[1]) * 100) / 100;
  const range = Math.round(randRange(ranges.range[0], ranges.range[1]));
  const col = affixes[0]?.col || (element ? element.cols[0] : RARITY_COL[r]);

  const id = `gen_${category}_${noun.slug}_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

  const def = { name, type: category, dmg, speed, range, rarity: r, col, generated: true };
  if (innate && Object.keys(innate).length) def.innate = innate;
  if (category === "magic") {
    def.spellType = element.key;
    def.spellPalette = element.cols;
    def.spellCore = element.core;
    def.spellPitch = element.pitch;
    def.aoeRadius = Math.round(40 + r * 14 + Math.random() * 10);
    def.spellRecipe = {
      element: element.key,
      form: pick(SPELL_FORMS).key,
      behavior: pick(TRAVEL_BEHAVIORS).key,
      impact: pick(IMPACT_EFFECTS).key,
      flourish: pick(VISUAL_FLOURISHES).key,
    };
  }

  const uniqueUpgrades = buildUniqueUpgrades(id, category);
  registerGeneratedWeapon(id, def, uniqueUpgrades);
  return { id, def, uniqueUpgrades };
}

export function registerGeneratedWeapon(id, def, uniqueUpgrades) {
  WEAPONS[id] = def;
  UNIQUE_UPGRADES[id] = uniqueUpgrades || [];
  registry[id] = { def, uniqueUpgrades: uniqueUpgrades || [] };
}

export function isGeneratedWeaponId(id) {
  return typeof id === "string" && id.startsWith("gen_");
}

export function exportGeneratedWeapon(id) {
  return registry[id] || null;
}

export function restoreGeneratedWeapon(id, data) {
  if (!id || !data || !data.def) return;
  registerGeneratedWeapon(id, data.def, data.uniqueUpgrades || []);
}
