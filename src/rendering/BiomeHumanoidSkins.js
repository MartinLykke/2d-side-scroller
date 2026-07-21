import { Game } from '../core/state.js';
import { biomeAt } from './Effects.js?v=biomeactive4';

const HOLLOW_MARKS = {
  player: { hollow: true, rune: "#d7b4ff", glow: "#ad82ff" },
  villager: { hollow: true, rune: "#b897ff", glow: "#9f7dff" },
  archer: { hollow: true, rune: "#b897ff", glow: "#9f7dff" },
  builder: { hollow: true, rune: "#b897ff", glow: "#9f7dff" },
  farmer: { hollow: true, rune: "#c7a2ff", glow: "#9f7dff" },
  guard: { hollow: true, rune: "#c6a0ff", glow: "#a875ff" },
};

const SKINS = {
  forest: {
    player: {
      common: {
        detail: "forest", skin: "#d3ac82", hair: "#3c2c1c", boots: "#3a2c1e", leather: "#5a3a24",
        pants: "#443c30", armor: "#596878", armorDk: "#2a3440", armorLt: "#8794a2",
        cape: "#8f2031", capeDk: "#5c1420", capeLt: "#d45555", tabard: "#65594e", tabardDk: "#4b4035",
        gold: "#d4a838", goldDk: "#8a6a2a", jewel: "#ff6a9a", trim: "#9bd05a", accent: "#f2c14e",
      },
    },
    villager: {
      common: { detail: "forest", skin: "#d3ac82", boots: "#3a2c1e", rope: "#a08a58", accent: "#91bd55", trim: "#b7d77a" },
      variants: [
        { tunic: "#6e6250", tunicLt: "#80735e", pants: "#4a4234", hair: "#4a3826" },
        { tunic: "#5d6652", tunicLt: "#6f7a62", pants: "#443c30", hair: "#2e2418" },
        { tunic: "#71584a", tunicLt: "#84685a", pants: "#4c4438", hair: "#6a5a42" },
        { tunic: "#65594e", tunicLt: "#776a5e", pants: "#3e382e", hair: "#3c2c1c" },
      ],
    },
    archer: {
      common: { detail: "forest", cloak: "#2e5d34", cloakDk: "#1f4426", cloakLt: "#477a45", trim: "#9bd05a", accent: "#d7b04a" },
      variants: [{ fletch: "#8fae4a" }, { fletch: "#b4bd58" }, { cloakLt: "#538a4e" }],
    },
    builder: {
      common: { detail: "forest", tunic: "#7a5836", tunicLt: "#8c6a44", apron: "#5d4426", apronLt: "#6e5432", cap: "#4a3220", capLt: "#5c4028", trim: "#9bd05a" },
      variants: [{ pouch: "#6a4a28" }, { pouch: "#5f5630" }, { beard: "#745b3f" }],
    },
    farmer: {
      common: {
        detail: "forest", tunic: "#53683c", tunicLt: "#71884e", apron: "#735536", apronLt: "#98754a",
        pants: "#443b2c", boots: "#302419", skin: "#d2aa7f", straw: "#c9a85e", strawLt: "#e2ca76",
        belt: "#493019", buckle: "#d4a838", scarf: "#b85b3a", wood: "#674624", steel: "#c2c5c8",
        steelDk: "#7d8489", hair: "#573820", trim: "#9bd05a", accent: "#e2bd58",
      },
      variants: [{ scarf: "#b85b3a" }, { tunic: "#5f7042" }, { apron: "#7d5c38" }],
    },
    guard: {
      common: { detail: "forest", gambeson: "#3e4e60", gambesonLt: "#4e5f73", shieldWood: "#4a5060", shieldRim: "#2c323e", accent: "#9bd05a" },
      variants: [{ plume: "#8f3232" }, { plume: "#5f7f3c" }, { boss: "#d4a838" }],
    },
  },
  frozen: {
    player: {
      common: {
        detail: "frozen", skin: "#d8b894", hair: "#5c5860", boots: "#263342", leather: "#526675",
        pants: "#3f5264", armor: "#7898ae", armorDk: "#405f76", armorLt: "#d9eef8",
        cape: "#dcecf5", capeDk: "#7895aa", capeLt: "#f7fdff", tabard: "#426b88", tabardDk: "#294c65",
        gold: "#dff5ff", goldDk: "#7ea7bc", jewel: "#77e4ff", trim: "#f5fdff", accent: "#82dfff", glow: "#92e7ff",
      },
    },
    villager: {
      common: { detail: "frozen", skin: "#d8b894", boots: "#2f3a46", rope: "#d4e7ee", accent: "#eaf7ff", trim: "#f4fbff" },
      variants: [
        { tunic: "#6f879b", tunicLt: "#8ca6b8", pants: "#465667", hair: "#d8e2e8" },
        { tunic: "#8295a2", tunicLt: "#a4b7c1", pants: "#53626d", hair: "#6a5640" },
        { tunic: "#5f748a", tunicLt: "#7f9ab0", pants: "#384a5e", hair: "#443830" },
      ],
    },
    archer: {
      common: {
        detail: "frozen", cloak: "#d8eaf6", cloakDk: "#7f9fba", cloakLt: "#f1fbff", tunic: "#4f6b82",
        tunicLt: "#6f8aa0", pants: "#3f5264", boots: "#263342", skin: "#ddb994", bowWood: "#8b765d",
        bowTip: "#d7eef8", string: "#f3fbff", quiver: "#607684", fletch: "#e8fbff", shaft: "#d1dfdf", trim: "#ffffff", accent: "#9fdfff",
      },
      variants: [{ cloakDk: "#6f8eaa" }, { tunic: "#5a758b" }, { fletch: "#bfefff" }],
    },
    builder: {
      common: {
        detail: "frozen", tunic: "#566f84", tunicLt: "#7892a7", apron: "#67727a", apronLt: "#8c9aa2",
        strap: "#2f3a44", pants: "#3f4f5d", boots: "#26313a", skin: "#d2ad88", cap: "#d7edf7",
        capLt: "#f2fbff", beard: "#6e6a5e", handle: "#735b44", head: "#9db4c4", headLt: "#d5eef8", pouch: "#4d5a62", trim: "#f3fbff",
      },
      variants: [{ capLt: "#ffffff" }, { apron: "#5f6d77" }, { tunicLt: "#83a0b8" }],
    },
    farmer: {
      common: {
        detail: "frozen", tunic: "#607b8f", tunicLt: "#8ca9b9", apron: "#71808a", apronLt: "#a6bac4",
        pants: "#405364", boots: "#26333e", skin: "#d4b18d", straw: "#d8e8ec", strawLt: "#f6fdff",
        belt: "#344553", buckle: "#d8f4ff", scarf: "#68b7d7", wood: "#6f5b47", steel: "#d1e8f1",
        steelDk: "#7895a4", hair: "#6b5a4a", trim: "#f5fdff", accent: "#82dfff", glow: "#92e7ff",
      },
      variants: [{ scarf: "#68b7d7" }, { tunic: "#6c8799" }, { apron: "#657884" }],
    },
    guard: {
      common: {
        detail: "frozen", gambeson: "#607a92", gambesonLt: "#86a3b8", pants: "#46586a", boots: "#273340",
        skin: "#d6b28c", steel: "#b9d2e2", steelLt: "#ecfbff", steelDk: "#7390a4", shieldWood: "#dbeaf2",
        shieldRim: "#6d8798", boss: "#eafaff", haft: "#735b44", strap: "#2d3944", accent: "#c9f3ff", plume: "#eafaff",
      },
      variants: [{ shieldWood: "#c5dce8" }, { gambeson: "#536f88" }, { plume: "#aeeaff" }],
    },
  },
  desert: {
    player: {
      common: {
        detail: "desert", skin: "#ca9765", hair: "#342318", boots: "#452b18", leather: "#69401f",
        pants: "#684727", armor: "#a77a3e", armorDk: "#68431f", armorLt: "#e0bd72",
        cape: "#2d8e8a", capeDk: "#175a5a", capeLt: "#62c5b8", tabard: "#c39b58", tabardDk: "#8d6735",
        gold: "#f0cf78", goldDk: "#9a6a2d", jewel: "#64e0d2", trim: "#f1d58a", accent: "#47a8a0",
      },
    },
    villager: {
      common: { detail: "desert", skin: "#c99562", boots: "#5a351c", rope: "#dbc179", accent: "#55a6a0", trim: "#f1d58a" },
      variants: [
        { tunic: "#c39b58", tunicLt: "#d9b875", pants: "#7d5630", hair: "#3b2a1c" },
        { tunic: "#9c7442", tunicLt: "#c39658", pants: "#67421f", hair: "#5a3820" },
        { tunic: "#d0ae6a", tunicLt: "#e4c982", pants: "#7a5b36", hair: "#2e2117" },
      ],
    },
    archer: {
      common: {
        detail: "desert", cloak: "#c59b54", cloakDk: "#8b6332", cloakLt: "#dfbd6d", tunic: "#7f5a32",
        tunicLt: "#9e7440", pants: "#5f442a", boots: "#3d2819", skin: "#ca9765", bowWood: "#6e4221",
        bowTip: "#4d2e18", string: "#f0ddad", quiver: "#8a6030", fletch: "#52b5ad", shaft: "#d6bb7a", trim: "#f1d58a", accent: "#47a8a0",
      },
      variants: [{ fletch: "#47a8a0" }, { cloak: "#b48746" }, { tunicLt: "#b8874a" }],
    },
    builder: {
      common: {
        detail: "desert", tunic: "#b98443", tunicLt: "#d0a25b", apron: "#8a6030", apronLt: "#aa7b3e",
        strap: "#4a2f18", pants: "#694727", boots: "#3d2819", skin: "#c8915e", cap: "#d2b36b",
        capLt: "#ead28a", beard: "#5d3a1d", handle: "#7a4a24", head: "#b8a178", headLt: "#d5c18f", pouch: "#6c4a25", trim: "#f1d58a",
      },
      variants: [{ cap: "#c79d56" }, { apron: "#936635" }, { tunic: "#c18d4a" }],
    },
    farmer: {
      common: {
        detail: "desert", tunic: "#b48749", tunicLt: "#d0aa68", apron: "#8c6031", apronLt: "#b48145",
        pants: "#694727", boots: "#3d2819", skin: "#c8915e", straw: "#d2b36b", strawLt: "#f0d993",
        belt: "#4a2f18", buckle: "#e2c36e", scarf: "#359b96", wood: "#744823", steel: "#c8b382",
        steelDk: "#8d764b", hair: "#4b2d18", trim: "#f1d58a", accent: "#47a8a0",
      },
      variants: [{ scarf: "#359b96" }, { tunic: "#c09350" }, { apron: "#956737" }],
    },
    guard: {
      common: {
        detail: "desert", gambeson: "#8b6230", gambesonLt: "#b78945", pants: "#5c4226", boots: "#3d2818",
        skin: "#ca9563", steel: "#caa35b", steelLt: "#efd383", steelDk: "#8f6730", shieldWood: "#b88742",
        shieldRim: "#5f3b1d", boss: "#35a69c", haft: "#76502a", strap: "#3c2514", accent: "#45b3aa", plume: "#38aaa3",
      },
      variants: [{ shieldWood: "#c49a54" }, { gambesonLt: "#c89a51" }, { plume: "#e2c069" }],
    },
  },
  swamp: {
    player: {
      common: {
        detail: "swamp", skin: "#b98f65", hair: "#302718", boots: "#202416", leather: "#44351e",
        pants: "#30392f", armor: "#4e6254", armorDk: "#25362d", armorLt: "#83967c",
        cape: "#405f38", capeDk: "#203322", capeLt: "#718a49", tabard: "#596742", tabardDk: "#36422f",
        gold: "#b8c65e", goldDk: "#667735", jewel: "#c9e66b", trim: "#a9ba58", accent: "#c8d760",
      },
    },
    villager: {
      common: { detail: "swamp", skin: "#b98f65", boots: "#242417", rope: "#9aa65a", accent: "#b4bd58", trim: "#6f8a3f" },
      variants: [
        { tunic: "#485a35", tunicLt: "#607343", pants: "#343828", hair: "#2b2518" },
        { tunic: "#5f6440", tunicLt: "#73794f", pants: "#3b3f2c", hair: "#4d3c22" },
        { tunic: "#3d5042", tunicLt: "#54705a", pants: "#283832", hair: "#302718" },
      ],
    },
    archer: {
      common: {
        detail: "swamp", cloak: "#49663e", cloakDk: "#263726", cloakLt: "#6f8646", tunic: "#3f5132",
        tunicLt: "#617342", pants: "#303b2a", boots: "#232719", skin: "#b98f65", bowWood: "#5b4a25",
        bowTip: "#2e2b18", string: "#cbd89a", quiver: "#334529", fletch: "#b4bd58", shaft: "#a6965e", trim: "#7f9a45", accent: "#c8d760",
      },
      variants: [{ cloak: "#405b36" }, { fletch: "#d0d66c" }, { tunicLt: "#6b7d4b" }],
    },
    builder: {
      common: {
        detail: "swamp", tunic: "#53603a", tunicLt: "#6e7a4d", apron: "#4a4b2f", apronLt: "#5f6440",
        strap: "#252819", pants: "#363a2a", boots: "#202316", skin: "#b58b62", cap: "#39472c",
        capLt: "#56653a", beard: "#453821", handle: "#5c4b27", head: "#7f8b83", headLt: "#a4b0a8", pouch: "#3f4428", trim: "#a9ba58",
      },
      variants: [{ capLt: "#61723d" }, { apron: "#42492c" }, { tunic: "#4b5b38" }],
    },
    farmer: {
      common: {
        detail: "swamp", tunic: "#495b3c", tunicLt: "#68794c", apron: "#44482f", apronLt: "#626845",
        pants: "#30382b", boots: "#202416", skin: "#b58b62", straw: "#718049", strawLt: "#a1ad62",
        belt: "#282819", buckle: "#a9ba58", scarf: "#839b48", wood: "#564523", steel: "#87958b",
        steelDk: "#536158", hair: "#40341f", trim: "#a9ba58", accent: "#c8d760",
      },
      variants: [{ scarf: "#839b48" }, { tunic: "#536542" }, { apron: "#4e5235" }],
    },
    guard: {
      common: {
        detail: "swamp", gambeson: "#45513c", gambesonLt: "#65734f", pants: "#30392f", boots: "#202416",
        skin: "#b58b62", steel: "#7f8f82", steelLt: "#aebcae", steelDk: "#4d5a4f", shieldWood: "#3f5a3d",
        shieldRim: "#1f2a20", boss: "#b4bd58", haft: "#5b4a27", strap: "#252616", accent: "#b4bd58", plume: "#718a42",
      },
      variants: [{ shieldWood: "#496743" }, { gambeson: "#3c4b39" }, { plume: "#a9ba58" }],
    },
  },
  volcano: {
    player: {
      common: {
        detail: "volcano", skin: "#bd8061", hair: "#251916", boots: "#1d1714", leather: "#4b2c20",
        pants: "#302729", armor: "#55484a", armorDk: "#201c20", armorLt: "#9b6654",
        cape: "#8f2d22", capeDk: "#451512", capeLt: "#d95b32", tabard: "#5f3429", tabardDk: "#372323",
        gold: "#ff9a46", goldDk: "#9a3f22", jewel: "#ffd05a", trim: "#ff9a46", accent: "#ff6a28", accent2: "#ffd35a", glow: "#ff7a36",
      },
    },
    villager: {
      common: { detail: "volcano", skin: "#b97d5f", boots: "#1f1714", rope: "#a64a2c", accent: "#ff7a36", trim: "#ffb05a", glow: "#ff7a36" },
      variants: [
        { tunic: "#4c3d36", tunicLt: "#6b5144", pants: "#2f2a29", hair: "#211814" },
        { tunic: "#6b3f30", tunicLt: "#8d5a3d", pants: "#3a2924", hair: "#30201a" },
        { tunic: "#3f3d40", tunicLt: "#5d5960", pants: "#29272b", hair: "#1a1412" },
      ],
    },
    archer: {
      common: {
        detail: "volcano", cloak: "#423438", cloakDk: "#1f1b20", cloakLt: "#8a3e28", tunic: "#5a372b",
        tunicLt: "#8e4f34", pants: "#302729", boots: "#1d1714", skin: "#bd8061", bowWood: "#4c2e22",
        bowTip: "#ff7a36", string: "#e8bd85", quiver: "#3b2a24", fletch: "#ff8a36", shaft: "#8d6740", trim: "#ff9a46", accent: "#ff6a28", glow: "#ff7a36",
      },
      variants: [{ cloakLt: "#9e482c" }, { fletch: "#ffb05a" }, { tunic: "#673d2d" }],
    },
    builder: {
      common: {
        detail: "volcano", tunic: "#65382e", tunicLt: "#8d4a34", apron: "#2c2728", apronLt: "#51413d",
        strap: "#1d1714", pants: "#332b2b", boots: "#1d1714", skin: "#b8795c", cap: "#30282a",
        capLt: "#6e3d32", beard: "#2f2019", handle: "#5f3623", head: "#69666a", headLt: "#a08e80", pouch: "#3a2a25", trim: "#ff7a36", glow: "#ff7a36",
      },
      variants: [{ tunicLt: "#a25336" }, { apronLt: "#654940" }, { capLt: "#7d4534" }],
    },
    farmer: {
      common: {
        detail: "volcano", tunic: "#61392f", tunicLt: "#8c4d38", apron: "#2e2828", apronLt: "#55433d",
        pants: "#332b2b", boots: "#1d1714", skin: "#b8795c", straw: "#4e3830", strawLt: "#8c5037",
        belt: "#211815", buckle: "#ff7a36", scarf: "#d94d2b", wood: "#5f3623", steel: "#8d7e76",
        steelDk: "#4f4848", hair: "#2f2019", trim: "#ff7a36", accent: "#ffb05a", glow: "#ff6a28",
      },
      variants: [{ scarf: "#d94d2b" }, { tunic: "#704033" }, { apronLt: "#68493e" }],
    },
    guard: {
      common: {
        detail: "volcano", gambeson: "#523532", gambesonLt: "#834838", pants: "#2c292c", boots: "#1d1714",
        skin: "#bd7e60", steel: "#6b6262", steelLt: "#b09a86", steelDk: "#332f34", shieldWood: "#3a2c2a",
        shieldRim: "#171315", boss: "#ff7a36", haft: "#5f3622", strap: "#1f1714", accent: "#ff7a36", plume: "#ff6a28", glow: "#ff7a36",
      },
      variants: [{ gambesonLt: "#934c38" }, { shieldWood: "#4a302c" }, { plume: "#ffb05a" }],
    },
  },
  corrupted: {
    player: {
      common: {
        detail: "corrupted", skin: "#baa0b9", hair: "#1b1222", boots: "#19141f", leather: "#382642",
        pants: "#292338", armor: "#504361", armorDk: "#21192c", armorLt: "#8e73a7",
        cape: "#512d72", capeDk: "#231330", capeLt: "#9254c1", tabard: "#493850", tabardDk: "#282130",
        gold: "#c79aff", goldDk: "#70469a", jewel: "#f078ff", trim: "#b897ff", accent: "#c56bff", accent2: "#e8b2ff", glow: "#9f68ff", rune: "#d1a1ff",
      },
    },
    villager: {
      common: { detail: "corrupted", skin: "#baa0b9", boots: "#19141f", rope: "#7c5aa8", accent: "#a56bff", trim: "#b897ff", glow: "#9f68ff", rune: "#c796ff" },
      variants: [
        { tunic: "#4b4056", tunicLt: "#685778", pants: "#2c2638", hair: "#18101f" },
        { tunic: "#56405a", tunicLt: "#775c82", pants: "#302638", hair: "#2a1736" },
        { tunic: "#3c364c", tunicLt: "#5d5270", pants: "#262235", hair: "#130f18" },
      ],
    },
    archer: {
      common: {
        detail: "corrupted", cloak: "#3a294c", cloakDk: "#181322", cloakLt: "#7245a0", tunic: "#443354",
        tunicLt: "#674778", pants: "#292338", boots: "#19141f", skin: "#bda0bc", bowWood: "#382642",
        bowTip: "#a56bff", string: "#e0c8ff", quiver: "#261d32", fletch: "#c56bff", shaft: "#9176b0", trim: "#a56bff", accent: "#c56bff", glow: "#9f68ff", rune: "#d1a1ff",
      },
      variants: [{ cloakLt: "#8050b0" }, { fletch: "#e077ff" }, { tunic: "#4c395e" }],
    },
    builder: {
      common: {
        detail: "corrupted", tunic: "#493850", tunicLt: "#694c72", apron: "#282130", apronLt: "#493b56",
        strap: "#1a1421", pants: "#2a2435", boots: "#19141f", skin: "#baa0b9", cap: "#271d32",
        capLt: "#624171", beard: "#22172a", handle: "#3e2b47", head: "#746683", headLt: "#b399cc", pouch: "#35283e", trim: "#a56bff", glow: "#9f68ff", rune: "#d1a1ff",
      },
      variants: [{ tunicLt: "#755282" }, { apronLt: "#564363" }, { capLt: "#714a85" }],
    },
    farmer: {
      common: {
        detail: "corrupted", tunic: "#493850", tunicLt: "#6c4d78", apron: "#292231", apronLt: "#4c3b57",
        pants: "#2a2435", boots: "#19141f", skin: "#baa0b9", straw: "#3b2947", strawLt: "#76518c",
        belt: "#1b1421", buckle: "#a56bff", scarf: "#8e50ba", wood: "#3e2b47", steel: "#8d799e",
        steelDk: "#544761", hair: "#22172a", trim: "#b897ff", accent: "#d077ff", glow: "#9f68ff", rune: "#d1a1ff",
      },
      variants: [{ scarf: "#8e50ba" }, { tunicLt: "#765282" }, { apronLt: "#594363" }],
    },
    guard: {
      common: {
        detail: "corrupted", gambeson: "#3f344e", gambesonLt: "#635278", pants: "#282236", boots: "#19141f",
        skin: "#baa0b9", steel: "#6a5b7e", steelLt: "#bca6d6", steelDk: "#30273e", shieldWood: "#30213f",
        shieldRim: "#17111f", boss: "#a56bff", haft: "#3e2b47", strap: "#1a1421", accent: "#a56bff", plume: "#c56bff", glow: "#9f68ff", rune: "#d1a1ff",
      },
      variants: [{ shieldWood: "#3b2750" }, { gambesonLt: "#715789" }, { plume: "#e077ff" }],
    },
  },
};

function roleSkinDef(role, biomeId) {
  return (SKINS[biomeId] && SKINS[biomeId][role]) || SKINS.forest[role] || { common: {} };
}

export function biomeHumanoidSkin(role, x, base = {}, variant = 0) {
  const biomeId = biomeAt(x)?.id || "forest";
  const def = roleSkinDef(role, biomeId);
  const variants = def.variants || [];
  const variantSkin = variants.length ? variants[Math.abs(Math.floor(variant)) % variants.length] : null;
  const hollow = (Game.worldPhase || 1) >= 2 ? HOLLOW_MARKS[role] : null;
  return {
    ...base,
    biomeId,
    ...(def.common || {}),
    ...(variantSkin || {}),
    ...(hollow || {}),
  };
}

export function unitSkinVariant(entity, count = 3) {
  if (!entity || count <= 1) return 0;
  if (!Number.isFinite(entity.biomeSkinVariant)) {
    entity.biomeSkinVariant = Math.floor(Math.random() * count);
  }
  return Math.abs(Math.floor(entity.biomeSkinVariant)) % count;
}
