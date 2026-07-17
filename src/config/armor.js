// Each armor is a full outfit: it reskins the whole player model (cape,
// cuirass, legs, gauntlets) and adds a matching helmet — see ArmorOutfits.js.
export const ARMORS = {
  // Rarity 0 - Common
  leather_cap: {
    name:"Leather Cap", rarity:0, defense:1, col:"#8a6a3a", desc:"Light leather protection",
    ability:{ name:"Scout's Tread", desc:"+6% movement speed and slightly faster dodge recovery.", moveMult:1.06, dodgeCdMult:0.92 },
  },
  // Rarity 1 - Uncommon
  studded_vest: {
    name:"Studded Garb", rarity:1, defense:2, col:"#7a5a2a", desc:"Riveted leathers and skullcap",
    ability:{ name:"Rivet Guard", desc:"Blocks prime your next attack and scatter bright sparks.", readyAttackOnBlock:true, blockSpark:true },
  },
  chainmail: {
    name:"Chainmail", rarity:1, defense:3, col:"#888898", desc:"Full mail hauberk and coif",
    ability:{ name:"Ringing Rebuke", desc:"Blocks ring out in a small knockback pulse.", blockPulse:{ radius:125, knock:150, damage:0, col:"#cfd3d9" } },
  },
  // Rarity 2 - Rare
  scale_armor: {
    name:"Scale Armor", rarity:2, defense:4, col:"#5a7a4a", desc:"Head-to-toe overlapping scales",
    ability:{ name:"Barbed Scales", desc:"Blocks lash nearby enemies with slowing scale shards.", blockPulse:{ radius:145, knock:120, damage:1, frost:1.3, col:"#8fcf78" } },
  },
  plate_chestplate: {
    name:"Plate Armor", rarity:2, defense:5, col:"#909098", desc:"Full suit of polished steel",
    ability:{ name:"Bulwark Slam", desc:"Blocks create a heavy shockwave that knocks enemies back.", blockPulse:{ radius:170, knock:260, damage:1, col:"#d8d8e2" } },
  },
  // Rarity 3 - Epic
  shadow_cloak: {
    name:"Shadow Cloak", rarity:3, defense:5, col:"#6a2a8a", desc:"Shadow-woven robes and hood",
    ability:{ name:"Umbral Slip", desc:"+8% movement speed. Blocks extend invulnerability and slow nearby enemies.", moveMult:1.08, blockInvuln:1.15, blockPulse:{ radius:155, knock:70, damage:1, root:0.8, col:"#a06ae0" }, ambient:{ rate:2.0, cols:["#a06ae0","#241238"] } },
  },
  dragon_scale: {
    name:"Dragon Scale", rarity:3, defense:6, col:"#9a4a1a", desc:"Horned battledress of a slain dragon",
    ability:{ name:"Dragonheart", desc:"Blocks ignite nearby enemies and shed ember trails.", blockPulse:{ radius:170, knock:170, damage:1, burn:3, burnDmg:1, col:"#ff8a30" }, ambient:{ rate:2.2, cols:["#ff8a30","#ffcc40"] } },
  },
  // Rarity 4 - Legendary
  void_armor: {
    name:"Void Armor", rarity:4, defense:7, col:"#5a2a9a", desc:"A body reforged in living void",
    ability:{ name:"Gravity Crown", desc:"Blocks tear open a void well, pulling and rooting nearby enemies.", blockPulse:{ radius:190, knock:-230, damage:2, root:1.4, col:"#b07aff" }, ambient:{ rate:2.6, cols:["#b07aff","#ffffff"] } },
  },
  sun_plate: {
    name:"Sun Plate", rarity:4, defense:8, col:"#d4a820", desc:"Radiant panoply of the sun itself",
    ability:{ name:"Dawnward", desc:"Regen is 18% faster. Blocks can heal 1 HP and smite nearby enemies.", regenMult:0.82, healOnBlock:{ amount:1, cooldown:10 }, blockPulse:{ radius:185, knock:220, damage:2, burn:2, burnDmg:1, col:"#ffe080" }, ambient:{ rate:2.8, cols:["#ffe080","#ffffff"] } },
  },
};
export const ARMOR_RARITY_COL  = ["#c8c8c8","#4aff4a","#4a9fff","#c87aff","#ffaa00"];
export const ARMOR_RARITY_NAME = ["Common","Uncommon","Rare","Epic","Legendary"];

// Each defense point gives a 6% chance to fully block a hit (capped at 55%),
// and heavy hits are shaved down by ~1 damage per 3 defense in PlayerCombat.
export function armorBlockChance(defense) {
  return Math.min(0.55, (defense || 0) * 0.06);
}
