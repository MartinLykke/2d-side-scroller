import { clamp } from '../../util/math.js';
import { WEAPONS, RARITY_COL, RARITY_NAME, effectiveWeapon } from '../../config/weapons.js?v=biomeweapons1';
import { UPGRADE_TIERS } from '../../config/weaponUpgrades.js?v=biomeweapons1';
import { ARMORS, ARMOR_RARITY_COL, ARMOR_RARITY_NAME, armorBlockChance } from '../../config/armor.js';
import { ENEMY_TYPES } from '../../config/enemies.js?v=biomeboss1';
import { ctx, W, H, groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { inject, provide } from '../../core/services.js';
import { roundedRect, drawHeart } from '../DrawHelpers.js?v=biomeweapons1';
import { drawWeaponModel, drawArmorModel, drawHeldWeapon, WEAPON_TYPE_LABEL } from '../ItemRender.js?v=biomeweapons1';
import { MOUNTS } from '../../config/mounts.js';
import { drawMountModel } from '../sprites/Mount.js';
import { drawPlayer as drawPlayerBody } from '../sprites/Player.js';
import { weaponLevel, ensureInventory } from '../../systems/economy/InventorySystem.js';
import { currentShopList, isShopItemOwned, SHOP_COLS } from '../../systems/economy/ShopSystem.js?v=biomeweapons1';
import { CASTLE_UPGRADES } from '../../config/castleUpgrades.js';
import { castleUpgradeCost } from '../../systems/economy/CastleUpgradeSystem.js?v=biomeweapons1';
import { ensureCastleUpgrades, currentPopCap, currentCoinCap, crownAegisStats } from '../../util/DefenseStats.js';

// ---------- Shared UI helpers ----------
const GOLD = "#f2c14e";
const PARCH = "#f0e6cf";
const MUTED = "rgba(200,190,170,0.72)";

function mouse() { return inject('mouse') || { x: -9999, y: -9999 }; }
function inRect(m, r) { return r && m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h; }

function panel(x, y, w, h, r = 16) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 26;
  roundedRect(x, y, w, h, r);
  ctx.fillStyle = "rgba(19,15,33,0.97)";
  ctx.fill();
  ctx.restore();
  roundedRect(x, y, w, h, r);
  ctx.strokeStyle = "rgba(210,185,130,0.4)"; ctx.lineWidth = 2; ctx.stroke();
  roundedRect(x + 3, y + 3, w - 6, h - 6, r - 3);
  ctx.strokeStyle = "rgba(210,185,130,0.12)"; ctx.lineWidth = 1; ctx.stroke();
}

function headerBar(x, y, w, title, hint) {
  ctx.textAlign = "left"; ctx.font = "bold 19px Trebuchet MS"; ctx.fillStyle = PARCH;
  ctx.fillText(title, x + 22, y + 30);
  if (hint) {
    ctx.textAlign = "right"; ctx.font = "11px Trebuchet MS"; ctx.fillStyle = "rgba(200,190,170,0.5)";
    ctx.fillText(hint, x + w - 22, y + 30);
  }
  ctx.strokeStyle = "rgba(210,185,130,0.22)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 16, y + 44); ctx.lineTo(x + w - 16, y + 44); ctx.stroke();
}

function coinChip(x, y, coins) {
  ctx.save();
  roundedRect(x - 74, y - 15, 74, 24, 12);
  ctx.fillStyle = "rgba(242,193,78,0.12)"; ctx.fill();
  ctx.strokeStyle = "rgba(242,193,78,0.5)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.textAlign = "right"; ctx.font = "bold 13px Trebuchet MS"; ctx.fillStyle = GOLD;
  ctx.fillText(coins + " 🪙", x - 10, y + 3);
  ctx.restore();
}

function wrapText(text, maxW, font) {
  ctx.font = font;
  const words = String(text).split(" ");
  const lines = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? cur + " " + word : word;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = word; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function upgradeSummary(u) {
  if (!u || !u.effect) return "";
  if (u.effect.dmg)        return "+" + u.effect.dmg + " damage";
  if (u.effect.range)      return "+" + u.effect.range + " range";
  if (u.effect.speedBonus) return "+" + Math.round(u.effect.speedBonus * 100) + "% speed";
  if (u.effect.critBonus)  return "+" + Math.round(u.effect.critBonus * 100) + "% crit";
  if (u.effect.scorchChain) return "wildfire chains";
  if (u.effect.geyser) return "geyser impacts";
  if (u.effect.stormCloud) return "storm cloud";
  if (u.effect.meteorFragments) return "meteor fragments";
  if (u.effect.runeTrap) return "rune trap";
  if (u.effect.shadowCurse) return "shadow curse";
  if (u.effect.voidScar) return "void scar";
  if (u.effect.splinterCount) return "splinter shots";
  if (u.effect.poisonHit || u.effect.poisonArrow) return "poison";
  if (u.effect.sandBlind) return "blinding sand";
  if (u.effect.heatStacks) return "overheat";
  if (u.effect.frostAura) return "frost aura";
  return UPGRADE_TIERS[u.tier]?.name.toLowerCase() || "special";
}

const BIOME_DROP_LABELS = {
  forest: "Forest",
  frozen: "Frozen Wastes",
  desert: "Desert",
  swamp: "Swamp",
  volcano: "Volcano",
  corrupted: "Corrupted Lands",
};

function armorAbilityText(a) {
  return a?.ability ? a.ability.name + ": " + a.ability.desc : "";
}

// ---------- Tooltip ----------
// item: { kind:"weapon", weaponId, upgrades } | { kind:"armor", armorId } (+ price)
function drawItemTooltip(item, mx, my) {
  const lines = [];
  let title = "", titleCol = PARCH;
  if (item.kind === "weapon") {
    const w = WEAPONS[item.weaponId];
    if (!w) return;
    const upgs = item.upgrades || [];
    const eff = effectiveWeapon(item.weaponId, upgs);
    title = w.name; titleCol = RARITY_COL[w.rarity];
    lines.push({ t: RARITY_NAME[w.rarity] + " · " + WEAPON_TYPE_LABEL[w.type] + " · Lvl " + weaponLevel(upgs), c: MUTED });
    lines.push({ t: "Damage: " + eff.dmg + (eff.dmg > w.dmg ? "  (+" + Math.round((eff.dmg - w.dmg) * 10) / 10 + ")" : ""), c: "#9bd05a" });
    lines.push({ t: "Range: " + eff.range + " px" + (eff.range > w.range ? "  (+" + (eff.range - w.range) + ")" : ""), c: "#e8d8a8" });
    lines.push({ t: "Attack time: " + eff.speed + "s" + (eff.speed < w.speed ? "  (faster)" : ""), c: "#6ab4ff" });
    if (w.biomeOnly) lines.push({ t: "Biome drop: " + (BIOME_DROP_LABELS[w.biome] || w.biome), c: w.col, gap: 4 });
    if (upgs.length) {
      lines.push({ t: "Upgrades:", c: MUTED, gap: 4 });
      for (const u of upgs) lines.push({ t: "• " + u.name + " — " + upgradeSummary(u), c: UPGRADE_TIERS[u.tier]?.col || "#9bd05a" });
    }
  } else {
    const a = ARMORS[item.armorId];
    if (!a) return;
    title = a.name; titleCol = ARMOR_RARITY_COL[a.rarity];
    lines.push({ t: ARMOR_RARITY_NAME[a.rarity] + " · Armor", c: MUTED });
    lines.push({ t: "Defense: +" + a.defense, c: "#9bd05a" });
    lines.push({ t: "Block chance: " + Math.round(armorBlockChance(a.defense) * 100) + "%", c: "#6ab4ff" });
    if (a.defense >= 3) lines.push({ t: "Heavy hits reduced by " + Math.round(a.defense / 3), c: "#e8d8a8" });
    if (a.ability) {
      lines.push({ t: a.ability.name, c: ARMOR_RARITY_COL[a.rarity], gap: 4 });
      for (const dl of wrapText(a.ability.desc, 190, "11px Trebuchet MS")) lines.push({ t: dl, c: "rgba(230,220,190,0.78)" });
    }
    for (const dl of wrapText(a.desc, 190, "italic 11px Trebuchet MS")) lines.push({ t: dl, c: "rgba(200,190,170,0.6)", italic: true });
  }
  if (item.price !== undefined) lines.push({ t: "Price: " + item.price + " 🪙", c: GOLD, gap: 4 });
  if (item.hint) lines.push({ t: item.hint, c: "rgba(255,255,255,0.45)", gap: 4 });

  const tw = 216, lh = 16;
  let th = 40;
  for (const l of lines) th += lh + (l.gap || 0);
  let tx = mx + 18, ty = my + 14;
  if (tx + tw > W - 8) tx = mx - tw - 14;
  if (ty + th > H - 8) ty = H - 8 - th;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 14;
  roundedRect(tx, ty, tw, th, 9);
  ctx.fillStyle = "rgba(10,7,20,0.97)"; ctx.fill();
  ctx.restore();
  roundedRect(tx, ty, tw, th, 9);
  ctx.strokeStyle = titleCol + "88"; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.textAlign = "left";
  ctx.font = "bold 14px Trebuchet MS"; ctx.fillStyle = titleCol;
  ctx.fillText(title, tx + 12, ty + 22);
  let yy = ty + 42;
  for (const l of lines) {
    yy += l.gap || 0;
    ctx.font = (l.italic ? "italic " : "") + "11px Trebuchet MS";
    ctx.fillStyle = l.c;
    ctx.fillText(l.t, tx + 12, yy);
    yy += lh;
  }
}

// ---------- Weapon pickup overlay ----------
export function drawWeaponPickupOverlay() {
  const wp = state.weaponPickup;
  if (!wp) return;
  const a = clamp(wp.timer / 1.0, 0, 1);
  if (a <= 0) return;
  const w = WEAPONS[wp.weaponId], rc = RARITY_COL[w.rarity];
  const cx = W / 2, cy = H * 0.3;
  const elapsed = 3.8 - wp.timer;
  const entryScale = elapsed < 0.25 ? (0.6 + 0.4 * (elapsed / 0.25)) : 1;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(cx, cy); ctx.scale(entryScale, entryScale); ctx.translate(-cx, -cy);
  const panelW2 = w.rarity >= 3 ? 350 : 330, panelH2 = 128;
  roundedRect(cx - panelW2 / 2, cy - panelH2 / 2, panelW2, panelH2, 14);
  ctx.fillStyle = "rgba(12,10,20,0.92)"; ctx.fill();
  ctx.strokeStyle = rc + "dd"; ctx.lineWidth = w.rarity >= 3 ? 2.5 : 2; ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a * (w.rarity >= 3 ? 0.28 : 0.18);
  ctx.fillStyle = rc; roundedRect(cx - panelW2 / 2, cy - panelH2 / 2, panelW2, panelH2, 14); ctx.fill();
  ctx.restore(); ctx.globalAlpha = a;
  ctx.save(); ctx.translate(cx - 100, cy - 4);
  drawWeaponModel(wp.weaponId, 1.15, { glow: 0.1 });
  ctx.restore();
  ctx.textAlign = "left";
  ctx.font = "bold 19px Trebuchet MS";
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillText(w.name, cx - 49, cy - 20);
  ctx.fillStyle = rc; ctx.fillText(w.name, cx - 50, cy - 21);
  ctx.font = "12px Trebuchet MS"; ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(RARITY_NAME[w.rarity] + " · " + WEAPON_TYPE_LABEL[w.type], cx - 50, cy - 2);
  ctx.fillText("Damage " + w.dmg + "  ·  Range " + w.range, cx - 50, cy + 16);
  ctx.fillStyle = "rgba(200,200,200,0.55)"; ctx.font = "11px Trebuchet MS"; ctx.textAlign = "center";
  ctx.fillText("Weapon equipped — the old one is in your inventory [I]", cx, cy + 44);
  ctx.restore();
}

// ---------- Inventory overlay ----------
function drawPaperDoll(cx, footY, scale) {
  const { player } = state;
  if (!player) return;
  const doll = {
    ...player,
    x: 0, vx: 0, knock: 0, swing: 0, castAnim: 0,
    jumpH: 0, jumpVy: 0, bob: 0, hurt: 0, invuln: 0,
    gallop: 0, dir: 1, moving: false,
    wall: null, onWall: false, climbingWall: false, wallClimbT: 0, wallClimbTarget: 0,
  };
  // soft spotlight behind the model
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(cx, footY - 58 * scale * 0.42, 8, cx, footY - 58 * scale * 0.42, 90);
  g.addColorStop(0, "rgba(242,213,138,0.18)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, footY - 58 * scale * 0.42, 92, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // pedestal
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath(); ctx.ellipse(cx, footY + 4, 44, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(210,185,130,0.3)"; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.ellipse(cx, footY + 4, 44, 10, 0, 0, Math.PI * 2); ctx.stroke();
  // the actual in-game player model (armor + weapon included)
  ctx.save();
  ctx.translate(cx, footY);
  ctx.scale(scale, scale);
  ctx.translate(0, -groundY);
  drawPlayerBody(doll, 1, false, 0);
  if (doll.weapon) drawHeldWeapon(doll);
  ctx.restore();
}

function drawEquipSlot(r, item, label, hovered) {
  const filled = !!item;
  const rc = filled
    ? (item.kind === "weapon" ? RARITY_COL[WEAPONS[item.weaponId].rarity] : ARMOR_RARITY_COL[ARMORS[item.armorId].rarity])
    : "rgba(160,145,110,0.3)";
  roundedRect(r.x, r.y, r.w, r.h, 10);
  ctx.fillStyle = hovered && filled ? "rgba(255,235,170,0.10)" : "rgba(255,255,255,0.035)";
  ctx.fill();
  ctx.strokeStyle = filled ? rc + (hovered ? "ff" : "aa") : rc;
  ctx.lineWidth = filled ? 1.8 : 1.2;
  if (!filled) ctx.setLineDash([5, 4]);
  roundedRect(r.x, r.y, r.w, r.h, 10);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = "left"; ctx.font = "bold 10px Trebuchet MS"; ctx.fillStyle = "rgba(200,180,120,0.55)";
  ctx.fillText(label, r.x + 10, r.y + 15);
  if (!filled) {
    ctx.textAlign = "center"; ctx.font = "12px Trebuchet MS"; ctx.fillStyle = "rgba(200,190,170,0.35)";
    ctx.fillText(label === "WEAPON" ? "Nothing equipped" : "No armor equipped", r.x + r.w / 2, r.y + r.h / 2 + 10);
    return;
  }
  // item model
  ctx.save(); ctx.translate(r.x + 42, r.y + r.h / 2 + 4);
  if (item.kind === "weapon") drawWeaponModel(item.weaponId, 0.95);
  else drawArmorModel(item.armorId, 0.95);
  ctx.restore();
  // texts
  const nx = r.x + 84;
  if (item.kind === "weapon") {
    const w = WEAPONS[item.weaponId];
    const upgs = item.upgrades || [];
    const eff = effectiveWeapon(item.weaponId, upgs);
    ctx.textAlign = "left"; ctx.font = "bold 14px Trebuchet MS"; ctx.fillStyle = rc;
    ctx.fillText(w.name, nx, r.y + 32);
    // level badge
    const lvlTxt = "Lvl " + weaponLevel(upgs);
    ctx.font = "bold 10px Trebuchet MS";
    const bw = ctx.measureText(lvlTxt).width + 12;
    roundedRect(nx + 2, r.y + 39, bw, 15, 7);
    ctx.fillStyle = "rgba(242,193,78,0.16)"; ctx.fill();
    ctx.strokeStyle = "rgba(242,193,78,0.55)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = GOLD; ctx.fillText(lvlTxt, nx + 8, r.y + 50);
    ctx.font = "11px Trebuchet MS"; ctx.fillStyle = MUTED;
    ctx.fillText(RARITY_NAME[w.rarity] + " · " + WEAPON_TYPE_LABEL[w.type], nx + bw + 10, r.y + 50);
    ctx.font = "11px Trebuchet MS"; ctx.fillStyle = "#c9c2b2";
    ctx.fillText("⚔ " + eff.dmg + "   ↔ " + eff.range + "px   ⏱ " + eff.speed + "s", nx, r.y + 68);
  } else {
    const a = ARMORS[item.armorId];
    ctx.textAlign = "left"; ctx.font = "bold 14px Trebuchet MS"; ctx.fillStyle = rc;
    ctx.fillText(a.name, nx, r.y + 32);
    ctx.font = "11px Trebuchet MS"; ctx.fillStyle = MUTED;
    ctx.fillText(ARMOR_RARITY_NAME[a.rarity], nx, r.y + 50);
    if (a.ability) {
      ctx.font = "bold 10px Trebuchet MS"; ctx.fillStyle = ARMOR_RARITY_COL[a.rarity];
      ctx.fillText(a.ability.name, nx, r.y + 79);
    }
    ctx.fillStyle = "#c9c2b2";
    ctx.fillText("🛡 +" + a.defense + "   ⛨ " + Math.round(armorBlockChance(a.defense) * 100) + "% block", nx, r.y + 68);
  }
  if (hovered) {
    ctx.textAlign = "right"; ctx.font = "bold 10px Trebuchet MS"; ctx.fillStyle = "rgba(255,220,130,0.85)";
    ctx.fillText("CLICK TO UNEQUIP ⤓", r.x + r.w - 10, r.y + 15);
  }
}

export function drawInventoryOverlay() {
  if (!Game.inventoryOpen) { provide('invRects', null); return; }
  const { player } = state;
  if (!player) return;
  const m = mouse();
  const inv = ensureInventory(player);

  const panelW = Math.min(W - 40, 880);
  const panelH = Math.min(H - 36, 540);
  const px0 = W / 2 - panelW / 2, py0 = H / 2 - panelH / 2;

  ctx.save();
  ctx.fillStyle = "rgba(6,4,14,0.86)"; ctx.fillRect(0, 0, W, H);
  panel(px0, py0, panelW, panelH);
  headerBar(px0, py0, panelW - 90, "🎒 Inventory", "[I] close · click an item to equip / unequip");
  coinChip(px0 + panelW - 16, py0 + 26, player.coins);

  // ----- left column: the real player model -----
  const leftW = Math.floor(panelW * 0.3);
  const dollX = px0 + leftW / 2 + 8;
  const dollFoot = py0 + panelH * 0.58;
  drawPaperDoll(dollX, dollFoot, 2.5);
  ctx.textAlign = "center";
  ctx.font = "bold 15px Trebuchet MS"; ctx.fillStyle = "#e6d8b8";
  ctx.fillText("Monarch", dollX, dollFoot + 34);
  ctx.font = "11px Trebuchet MS"; ctx.fillStyle = MUTED;
  ctx.fillText("Level " + (player.level || 1), dollX, dollFoot + 51);
  const n = player.maxHp, gap = 13, hy = dollFoot + 70;
  for (let i = 0; i < n; i++) drawHeart(dollX - (n - 1) * gap / 2 + i * gap, hy, 4.6, i < player.hp ? "#e0556a" : "rgba(255,255,255,0.18)");
  if (player.armor && ARMORS[player.armor]) {
    const a = ARMORS[player.armor];
    ctx.font = "bold 11px Trebuchet MS"; ctx.fillStyle = ARMOR_RARITY_COL[a.rarity];
    ctx.fillText("🛡 " + a.defense + " defense · " + Math.round(armorBlockChance(a.defense) * 100) + "% block", dollX, hy + 22);
  } else {
    ctx.font = "11px Trebuchet MS"; ctx.fillStyle = "rgba(200,190,170,0.4)";
    ctx.fillText("No armor — buy some in the shop", dollX, hy + 22);
  }

  // divider
  ctx.strokeStyle = "rgba(210,185,130,0.14)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px0 + leftW + 14, py0 + 56); ctx.lineTo(px0 + leftW + 14, py0 + panelH - 18); ctx.stroke();

  // ----- middle column: equipped gear -----
  const midX = px0 + leftW + 28;
  const midW = Math.floor(panelW * 0.33);
  ctx.textAlign = "left"; ctx.font = "bold 11px Trebuchet MS"; ctx.fillStyle = "rgba(200,180,120,0.6)";
  ctx.fillText("EQUIPPED", midX, py0 + 68);
  const weaponRect = { x: midX, y: py0 + 78, w: midW, h: 80 };
  const armorRect  = { x: midX, y: py0 + 166, w: midW, h: 80 };
  const wHov = inRect(m, weaponRect), aHov = inRect(m, armorRect);
  const eqWeapon = player.weapon ? { kind: "weapon", weaponId: player.weapon, upgrades: player.weaponUpgrades || [] } : null;
  const eqArmor  = player.armor ? { kind: "armor", armorId: player.armor } : null;
  drawEquipSlot(weaponRect, eqWeapon, "WEAPON", wHov);
  drawEquipSlot(armorRect, eqArmor, "ARMOR", aHov);

  // upgrades on the equipped weapon
  let uy = py0 + 270;
  ctx.font = "bold 11px Trebuchet MS"; ctx.fillStyle = "rgba(200,180,120,0.6)";
  const upgs = player.weaponUpgrades || [];
  ctx.fillText("WEAPON UPGRADES" + (player.weapon ? " (" + upgs.length + ")" : ""), midX, uy);
  uy += 10;
  if (!player.weapon) {
    ctx.font = "11px Trebuchet MS"; ctx.fillStyle = "rgba(200,190,170,0.35)";
    ctx.fillText("Equip a weapon to see its upgrades.", midX, uy + 16);
  } else if (upgs.length === 0) {
    ctx.font = "11px Trebuchet MS"; ctx.fillStyle = "rgba(200,190,170,0.35)";
    ctx.fillText("None yet — earn XP and level up to", midX, uy + 16);
    ctx.fillText("choose upgrades for this weapon.", midX, uy + 31);
  } else {
    const chipW = (midW - 8) / 2, chipH = 30;
    const maxChips = Math.floor((py0 + panelH - 24 - uy) / (chipH + 6)) * 2;
    for (let i = 0; i < upgs.length && i < maxChips; i++) {
      const cxp = midX + (i % 2) * (chipW + 8);
      const cyp = uy + Math.floor(i / 2) * (chipH + 6);
      roundedRect(cxp, cyp, chipW, chipH, 7);
      ctx.fillStyle = "rgba(155,208,90,0.09)"; ctx.fill();
      ctx.strokeStyle = "rgba(155,208,90,0.45)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.font = "bold 10px Trebuchet MS"; ctx.fillStyle = "#9bd05a"; ctx.textAlign = "left";
      ctx.fillText(upgs[i].name, cxp + 8, cyp + 13);
      ctx.font = "9px Trebuchet MS"; ctx.fillStyle = "rgba(200,220,170,0.6)";
      ctx.fillText(upgradeSummary(upgs[i]), cxp + 8, cyp + 24);
    }
    if (upgs.length > maxChips) {
      ctx.font = "10px Trebuchet MS"; ctx.fillStyle = MUTED;
      ctx.fillText("+" + (upgs.length - maxChips) + " more…", midX, uy + Math.ceil(maxChips / 2) * (chipH + 6) + 12);
    }
  }

  // ----- right column: storage grid -----
  const gridX = midX + midW + 22;
  const gridW = px0 + panelW - 18 - gridX;
  const cols = 5;
  const cell = Math.min(52, Math.floor((gridW - (cols - 1) * 6) / cols));
  const gridY = py0 + 78;
  const maxRows = Math.floor((py0 + panelH - 30 - gridY) / (cell + 6));
  const rows = clamp(Math.ceil((inv.length + 1) / cols), Math.min(4, maxRows), maxRows);
  ctx.textAlign = "left"; ctx.font = "bold 11px Trebuchet MS"; ctx.fillStyle = "rgba(200,180,120,0.6)";
  ctx.fillText("STORAGE (" + inv.length + " items · no weight limit)", gridX, py0 + 68);

  const cells = [];
  let hoveredItem = null, hoveredIsEquip = null;
  for (let i = 0; i < rows * cols; i++) {
    const cx2 = gridX + (i % cols) * (cell + 6);
    const cy2 = gridY + Math.floor(i / cols) * (cell + 6);
    const r = { x: cx2, y: cy2, w: cell, h: cell, idx: i };
    cells.push(r);
    const it = inv[i];
    const hov = inRect(m, r);
    roundedRect(cx2, cy2, cell, cell, 8);
    ctx.fillStyle = it ? (hov ? "rgba(255,235,170,0.12)" : "rgba(255,255,255,0.05)") : "rgba(255,255,255,0.02)";
    ctx.fill();
    let bc = "rgba(160,145,110,0.18)";
    if (it) bc = (it.kind === "weapon" ? RARITY_COL[WEAPONS[it.weaponId].rarity] : ARMOR_RARITY_COL[ARMORS[it.armorId].rarity]) + (hov ? "ff" : "77");
    ctx.strokeStyle = bc; ctx.lineWidth = it ? 1.5 : 1;
    roundedRect(cx2, cy2, cell, cell, 8); ctx.stroke();
    if (it) {
      ctx.save();
      ctx.translate(cx2 + cell / 2, cy2 + cell / 2 + 1);
      const s = cell / 66;
      if (it.kind === "weapon") drawWeaponModel(it.weaponId, s);
      else drawArmorModel(it.armorId, s);
      ctx.restore();
      if (it.kind === "weapon" && (it.upgrades || []).length > 0) {
        ctx.font = "bold 9px Trebuchet MS"; ctx.textAlign = "right"; ctx.fillStyle = GOLD;
        ctx.fillText("L" + weaponLevel(it.upgrades), cx2 + cell - 4, cy2 + cell - 4);
      }
      if (hov) hoveredItem = { ...it, hint: "Click to equip" };
    }
  }
  const hiddenCount = inv.length - rows * cols;
  if (hiddenCount > 0) {
    ctx.textAlign = "left"; ctx.font = "10px Trebuchet MS"; ctx.fillStyle = MUTED;
    ctx.fillText("+" + hiddenCount + " more stored…", gridX, gridY + rows * (cell + 6) + 12);
  }

  provide('invRects', { weapon: weaponRect, armor: armorRect, cells, cols });

  // tooltips last, on top of everything
  if (hoveredItem) drawItemTooltip(hoveredItem, m.x, m.y);
  else if (wHov && eqWeapon) drawItemTooltip({ ...eqWeapon, hint: "Click to unequip" }, m.x, m.y);
  else if (aHov && eqArmor) drawItemTooltip({ ...eqArmor, hint: "Click to unequip" }, m.x, m.y);
  ctx.restore();
}

// ---------- Shop overlay ----------
function shopItemToTooltip(it) {
  return it.armorId
    ? { kind: "armor", armorId: it.armorId, price: it.price }
    : { kind: "weapon", weaponId: it.weaponId, upgrades: [], price: it.price };
}

function statDelta(cur, next, invert = false) {
  const d = Math.round((next - cur) * 100) / 100;
  if (d === 0) return { t: "", c: MUTED };
  const better = invert ? d < 0 : d > 0;
  return { t: (d > 0 ? "  ▲" + d : "  ▼" + Math.abs(d)), c: better ? "#9bd05a" : "#ff7a6a" };
}

export function drawShopOverlay() {
  if (!Game.shopOpen) { provide('shopRects', null); return; }
  const { player } = state;
  if (!player) return;
  const m = mouse();
  const items = currentShopList();
  const tab = Game.shopTab || 0;
  Game.shopIdx = clamp(Game.shopIdx, 0, Math.max(0, items.length - 1));

  const cols = SHOP_COLS;
  const rows = Math.max(1, Math.ceil(items.length / cols));
  const headH = 48, tabH = 42, detailH = 118, padX = 18;
  const cellW = 122;
  const panelW = cols * cellW + padX * 2 + 12;
  const availH = H - 40 - headH - tabH - detailH - 30;
  const cellH = clamp(Math.floor(availH / rows) - 6, 62, 102);
  const panelH = headH + tabH + rows * (cellH + 6) + detailH + 26;
  const px0 = W / 2 - panelW / 2, py0 = H / 2 - panelH / 2;

  ctx.save();
  ctx.fillStyle = "rgba(6,4,14,0.84)"; ctx.fillRect(0, 0, W, H);
  panel(px0, py0, panelW, panelH);
  headerBar(px0, py0, panelW - 90, "🏪 Royal Armory", "[T] switch tab · [E] buy · walk away to close");
  coinChip(px0 + panelW - 16, py0 + 26, player.coins);

  // tabs
  const tabs = [];
  const tabLabels = ["⚔  Weapons", "🛡  Armor", "🐴  Stable"];
  const tabW = (panelW - padX * 2) / 3;
  for (let ti = 0; ti < 3; ti++) {
    const tr = { x: px0 + padX + ti * tabW + (ti ? 4 : 0), y: py0 + headH + 6, w: tabW - 4, h: tabH - 12, tab: ti };
    tabs.push(tr);
    const active = ti === tab, hov = inRect(m, tr);
    roundedRect(tr.x, tr.y, tr.w, tr.h, 8);
    ctx.fillStyle = active ? "rgba(242,193,78,0.18)" : hov ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)";
    ctx.fill();
    ctx.strokeStyle = active ? GOLD : "rgba(180,160,100,0.28)";
    ctx.lineWidth = active ? 1.8 : 1; ctx.stroke();
    ctx.textAlign = "center"; ctx.font = (active ? "bold " : "") + "13px Trebuchet MS";
    ctx.fillStyle = active ? GOLD : "#a09070";
    ctx.fillText(tabLabels[ti], tr.x + tr.w / 2, tr.y + tr.h / 2 + 4);
  }

  // item grid
  const gridY = py0 + headH + tabH + 2;
  const cells = [];
  let hoveredShopItem = null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const cx2 = px0 + padX + (i % cols) * cellW + 3;
    const cy2 = gridY + Math.floor(i / cols) * (cellH + 6);
    const r = { x: cx2, y: cy2, w: cellW - 6, h: cellH, idx: i };
    cells.push(r);
    const selected = i === Game.shopIdx;
    const hov = inRect(m, r);
    const owned = isShopItemOwned(it);
    const equipped = it.mountId ? player.mountId === it.mountId
      : it.armorId ? player.armor === it.armorId : player.weapon === it.weaponId;
    const canAfford = player.coins >= it.price;
    const rc = it.mountId ? MOUNTS[it.mountId].col
      : it.armorId ? ARMOR_RARITY_COL[ARMORS[it.armorId].rarity] : RARITY_COL[WEAPONS[it.weaponId].rarity];

    roundedRect(r.x, r.y, r.w, r.h, 9);
    ctx.fillStyle = selected ? "rgba(255,220,100,0.14)" : hov ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.035)";
    ctx.fill();
    ctx.strokeStyle = selected ? GOLD : hov ? rc + "cc" : rc + "55";
    ctx.lineWidth = selected ? 2 : 1.2;
    roundedRect(r.x, r.y, r.w, r.h, 9); ctx.stroke();
    if (selected) {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.1;
      roundedRect(r.x, r.y, r.w, r.h, 9); ctx.fillStyle = GOLD; ctx.fill(); ctx.restore();
    }

    // model
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + (cellH - 26) / 2 + 2);
    if (!canAfford && !owned) ctx.globalAlpha = 0.45;
    const ms = clamp((cellH - 34) / 46, 0.55, 1.05);
    if (it.mountId) drawMountModel(it.mountId, ms * 0.85);
    else if (it.armorId) drawArmorModel(it.armorId, ms);
    else drawWeaponModel(it.weaponId, ms);
    ctx.restore();

    // name + price
    const name = it.mountId ? MOUNTS[it.mountId].name : it.armorId ? ARMORS[it.armorId].name : WEAPONS[it.weaponId].name;
    ctx.textAlign = "center";
    ctx.font = "bold 10.5px Trebuchet MS";
    ctx.fillStyle = owned ? "rgba(160,150,130,0.8)" : rc;
    ctx.fillText(name, r.x + r.w / 2, r.y + cellH - 16);
    if (owned) {
      ctx.font = "bold 9px Trebuchet MS"; ctx.fillStyle = equipped ? GOLD : "#9bd05a";
      const label = it.mountId ? (equipped ? "★ RIDING" : "✓ STABLED") : (equipped ? "★ EQUIPPED" : "✓ OWNED");
      ctx.fillText(label, r.x + r.w / 2, r.y + cellH - 4);
    } else {
      ctx.font = "11px Trebuchet MS";
      ctx.fillStyle = canAfford ? GOLD : "rgba(255,110,90,0.85)";
      ctx.fillText(it.price + " 🪙", r.x + r.w / 2, r.y + cellH - 4);
    }
    if (hov && !it.mountId) hoveredShopItem = { ...shopItemToTooltip(it), hint: owned ? (equipped ? "Already equipped" : "Already in your inventory") : selected ? "Click again to buy" : "Click to inspect" };
  }

  // ----- detail footer -----
  const dy = gridY + rows * (cellH + 6) + 6;
  ctx.strokeStyle = "rgba(210,185,130,0.2)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px0 + 14, dy - 2); ctx.lineTo(px0 + panelW - 14, dy - 2); ctx.stroke();

  const sel = items[Game.shopIdx];
  let buyRect = null;
  if (sel) {
    const owned = isShopItemOwned(sel);
    const canAfford = player.coins >= sel.price;
    // preview box
    roundedRect(px0 + 18, dy + 8, 96, detailH - 20, 10);
    ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fill();
    ctx.strokeStyle = "rgba(210,185,130,0.25)"; ctx.stroke();
    ctx.save();
    ctx.translate(px0 + 18 + 48, dy + 8 + (detailH - 20) / 2);
    if (sel.mountId) drawMountModel(sel.mountId, 1.35);
    else if (sel.armorId) drawArmorModel(sel.armorId, 1.75, { glow: 0.12 });
    else drawWeaponModel(sel.weaponId, 1.75, { glow: 0.12 });
    ctx.restore();

    const tx = px0 + 132;
    ctx.textAlign = "left";
    if (sel.mountId) {
      const mo = MOUNTS[sel.mountId];
      const riding = player.mountId === sel.mountId;
      ctx.font = "bold 17px Trebuchet MS"; ctx.fillStyle = mo.col;
      ctx.fillText(mo.name, tx, dy + 28);
      ctx.font = "11px Trebuchet MS"; ctx.fillStyle = MUTED;
      ctx.fillText("Mount  ·  " + mo.desc, tx, dy + 46);
      ctx.font = "12px Trebuchet MS"; ctx.fillStyle = "#c9c2b2";
      ctx.fillText("Move speed: +" + Math.round((mo.speedMult - 1) * 100) + "%", tx, dy + 68);
      const curMo = player.mountId ? MOUNTS[player.mountId] : null;
      if (curMo && !riding) {
        const d = statDelta(Math.round((curMo.speedMult - 1) * 100), Math.round((mo.speedMult - 1) * 100));
        if (d.t) { ctx.fillStyle = d.c; ctx.fillText(d.t + "% vs " + curMo.name, tx + 118, dy + 68); }
      }
      ctx.font = "10px Trebuchet MS"; ctx.fillStyle = "rgba(200,190,170,0.45)";
      ctx.fillText(riding ? "Currently riding · press H in the field to dismount" : "Press H in the field to mount your last steed", tx, dy + 88);
    } else if (sel.armorId) {
      const a = ARMORS[sel.armorId];
      ctx.font = "bold 17px Trebuchet MS"; ctx.fillStyle = ARMOR_RARITY_COL[a.rarity];
      ctx.fillText(a.name, tx, dy + 28);
      ctx.font = "11px Trebuchet MS"; ctx.fillStyle = MUTED;
      ctx.fillText(ARMOR_RARITY_NAME[a.rarity] + " armor  ·  " + a.desc, tx, dy + 46);
      const curA = player.armor ? ARMORS[player.armor] : null;
      const dDef = statDelta(curA ? curA.defense : 0, a.defense);
      ctx.font = "12px Trebuchet MS"; ctx.fillStyle = "#c9c2b2";
      ctx.fillText("Defense: " + a.defense, tx, dy + 68);
      if (dDef.t) { ctx.fillStyle = dDef.c; ctx.fillText(dDef.t + " vs equipped", tx + 78, dy + 68); }
      ctx.fillStyle = "#c9c2b2";
      ctx.fillText("Block chance: " + Math.round(armorBlockChance(a.defense) * 100) + "%", tx, dy + 86);
      const curBlock = curA ? Math.round(armorBlockChance(curA.defense) * 100) : 0;
      const dBlk = statDelta(curBlock, Math.round(armorBlockChance(a.defense) * 100));
      if (dBlk.t) { ctx.fillStyle = dBlk.c; ctx.fillText(dBlk.t + "%", tx + 118, dy + 86); }
      if (a.ability) {
        ctx.font = "bold 11px Trebuchet MS"; ctx.fillStyle = ARMOR_RARITY_COL[a.rarity];
        const abilityLines = wrapText(armorAbilityText(a), panelW - 330, "bold 11px Trebuchet MS").slice(0, 2);
        for (let i = 0; i < abilityLines.length; i++) ctx.fillText(abilityLines[i], tx, dy + 104 + i * 13);
      }
    } else {
      const w = WEAPONS[sel.weaponId];
      ctx.font = "bold 17px Trebuchet MS"; ctx.fillStyle = RARITY_COL[w.rarity];
      ctx.fillText(w.name, tx, dy + 28);
      ctx.font = "11px Trebuchet MS"; ctx.fillStyle = MUTED;
      ctx.fillText(RARITY_NAME[w.rarity] + " · " + WEAPON_TYPE_LABEL[w.type] + " · Lvl 1 (upgrades with your XP)", tx, dy + 46);
      const cur = player.weapon ? effectiveWeapon(player.weapon, player.weaponUpgrades || []) : null;
      ctx.font = "12px Trebuchet MS";
      const stats = [
        ["Damage: " + w.dmg, cur ? statDelta(cur.dmg, w.dmg) : null],
        ["Range: " + w.range + "px", cur ? statDelta(cur.range, w.range) : null],
        ["Attack time: " + w.speed + "s", cur ? statDelta(cur.speed, w.speed, true) : null],
      ];
      let sx2 = tx;
      for (const [label, d] of stats) {
        ctx.fillStyle = "#c9c2b2"; ctx.fillText(label, sx2, dy + 70);
        const lw = ctx.measureText(label).width;
        if (d && d.t) { ctx.fillStyle = d.c; ctx.fillText(d.t, sx2 + lw, dy + 70); sx2 += lw + ctx.measureText(d.t).width + 22; }
        else sx2 += lw + 22;
      }
      ctx.font = "10px Trebuchet MS"; ctx.fillStyle = "rgba(200,190,170,0.45)";
      ctx.fillText(cur ? "Compared with your equipped " + WEAPONS[player.weapon].name : "You have no weapon equipped", tx, dy + 88);
    }

    // buy button (owned mounts keep it live as a ride/dismount toggle)
    buyRect = { x: px0 + panelW - 158, y: dy + 26, w: 138, h: 44 };
    const bHov = inRect(m, buyRect);
    const mountToggle = owned && !!sel.mountId;
    const riding = mountToggle && player.mountId === sel.mountId;
    const active = mountToggle || (canAfford && !owned);
    roundedRect(buyRect.x, buyRect.y, buyRect.w, buyRect.h, 10);
    if (active) { ctx.fillStyle = bHov ? "rgba(242,193,78,0.4)" : "rgba(242,193,78,0.24)"; }
    else if (owned) { ctx.fillStyle = "rgba(130,130,130,0.12)"; }
    else { ctx.fillStyle = "rgba(255,90,70,0.10)"; }
    ctx.fill();
    ctx.strokeStyle = active ? GOLD : owned ? "rgba(150,150,150,0.4)" : "rgba(255,110,90,0.5)";
    ctx.lineWidth = active ? 2 : 1;
    roundedRect(buyRect.x, buyRect.y, buyRect.w, buyRect.h, 10); ctx.stroke();
    ctx.textAlign = "center"; ctx.font = "bold 14px Trebuchet MS";
    ctx.fillStyle = active ? "#ffe9b0" : owned ? "rgba(180,180,180,0.6)" : "rgba(255,140,120,0.8)";
    const label = mountToggle ? (riding ? "DISMOUNT" : "RIDE  🐴")
      : owned ? "OWNED" : "BUY  ·  " + sel.price + " 🪙";
    ctx.fillText(label, buyRect.x + buyRect.w / 2, buyRect.y + 27);
  } else {
    ctx.textAlign = "center"; ctx.font = "13px Trebuchet MS"; ctx.fillStyle = MUTED;
    ctx.fillText("Nothing for sale in this tab yet.", px0 + panelW / 2, dy + detailH / 2);
  }

  provide('shopRects', { tabs, cells, buy: buyRect });
  if (hoveredShopItem) drawItemTooltip(hoveredShopItem, m.x, m.y);
  ctx.restore();
}

// ---------- Castle upgrade council ----------
function drawCastlePips(x, y, level, col) {
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.arc(x + i * 15, y, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = i < level ? col : "rgba(255,255,255,0.10)";
    ctx.fill();
    ctx.strokeStyle = i < level ? col : "rgba(180,160,120,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function castleAegisLabel() {
  const stats = crownAegisStats();
  if (!stats) return "offline";
  return stats.damage + " dmg / " + stats.interval.toFixed(1) + "s";
}

export function drawCastleUpgradeOverlay() {
  if (!Game.castleOpen) { provide('castleRects', null); return; }
  const { player, base } = state;
  if (!player || !base) return;
  const m = mouse();
  const levels = ensureCastleUpgrades();
  Game.castleIdx = clamp(Game.castleIdx || 0, 0, CASTLE_UPGRADES.length - 1);

  const panelW = Math.min(W - 44, 820);
  const panelH = Math.min(H - 38, 526);
  const px0 = W / 2 - panelW / 2, py0 = H / 2 - panelH / 2;
  const pad = 18, gap = 12;
  const cardW = (panelW - pad * 2 - gap) / 2;
  const cardH = 126;
  const gridY = py0 + 118;
  const detailY = gridY + cardH * 2 + gap + 14;

  ctx.save();
  ctx.fillStyle = "rgba(6,4,14,0.84)";
  ctx.fillRect(0, 0, W, H);
  panel(px0, py0, panelW, panelH);
  headerBar(px0, py0, panelW - 90, "Castle Council", "[C] close  |  arrows choose  |  E buy");
  coinChip(px0 + panelW - 16, py0 + 26, player.coins);

  const statY = py0 + 64;
  const stats = [
    ["Castle HP", Math.ceil(base.hp) + "/" + base.maxHp],
    ["Pop cap", String(currentPopCap(base.level))],
    ["Gold cap", String(currentCoinCap())],
    ["Aegis", castleAegisLabel()],
  ];
  const statW = (panelW - pad * 2 - gap * 3) / 4;
  for (let i = 0; i < stats.length; i++) {
    const sx = px0 + pad + i * (statW + gap);
    roundedRect(sx, statY, statW, 34, 8);
    ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fill();
    ctx.strokeStyle = "rgba(210,185,130,0.18)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = "left";
    ctx.font = "bold 9.5px Trebuchet MS"; ctx.fillStyle = "rgba(200,180,120,0.58)";
    ctx.fillText(stats[i][0].toUpperCase(), sx + 9, statY + 13);
    ctx.font = "bold 13px Trebuchet MS"; ctx.fillStyle = i === 2 ? GOLD : PARCH;
    ctx.fillText(stats[i][1], sx + 9, statY + 28);
  }

  const cards = [];
  for (let i = 0; i < CASTLE_UPGRADES.length; i++) {
    const up = CASTLE_UPGRADES[i];
    const lvl = levels[up.id] || 0;
    const col = up.col;
    const row = Math.floor(i / 2), colIdx = i % 2;
    const r = {
      x: px0 + pad + colIdx * (cardW + gap),
      y: gridY + row * (cardH + gap),
      w: cardW,
      h: cardH,
      idx: i,
    };
    cards.push(r);
    const selected = i === Game.castleIdx;
    const hov = inRect(m, r);
    roundedRect(r.x, r.y, r.w, r.h, 9);
    ctx.fillStyle = selected ? "rgba(255,220,100,0.13)" : hov ? "rgba(255,255,255,0.065)" : "rgba(255,255,255,0.035)";
    ctx.fill();
    ctx.strokeStyle = selected ? col : hov ? col + "cc" : "rgba(180,160,110,0.28)";
    ctx.lineWidth = selected ? 2 : 1.2;
    roundedRect(r.x, r.y, r.w, r.h, 9); ctx.stroke();
    if (selected) {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.09;
      roundedRect(r.x, r.y, r.w, r.h, 9); ctx.fillStyle = col; ctx.fill(); ctx.restore();
    }

    ctx.textAlign = "left";
    ctx.font = "bold 15px Trebuchet MS"; ctx.fillStyle = col;
    ctx.fillText("[" + (i + 1) + "] " + up.name, r.x + 14, r.y + 24);
    drawCastlePips(r.x + r.w - 50, r.y + 19, lvl, col);
    ctx.font = "11px Trebuchet MS"; ctx.fillStyle = MUTED;
    let yy = r.y + 46;
    for (const line of wrapText(up.desc, r.w - 28, "11px Trebuchet MS").slice(0, 2)) {
      ctx.fillText(line, r.x + 14, yy);
      yy += 14;
    }
    const effect = lvl >= 3 ? "Complete: " + up.effects[2] : "Next: " + up.effects[lvl];
    ctx.font = "bold 11px Trebuchet MS"; ctx.fillStyle = lvl >= 3 ? "#9bd05a" : col;
    ctx.fillText(effect, r.x + 14, r.y + r.h - 34);
    ctx.font = "11px Trebuchet MS";
    ctx.fillStyle = lvl >= 3 ? "rgba(155,208,90,0.8)" : player.coins >= castleUpgradeCost(up.id) ? GOLD : "rgba(255,110,90,0.85)";
    ctx.fillText(lvl >= 3 ? "MAX LEVEL" : castleUpgradeCost(up.id) + " gold", r.x + 14, r.y + r.h - 14);
  }

  ctx.strokeStyle = "rgba(210,185,130,0.2)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px0 + pad, detailY - 8); ctx.lineTo(px0 + panelW - pad, detailY - 8); ctx.stroke();

  const sel = CASTLE_UPGRADES[Game.castleIdx];
  const selLvl = levels[sel.id] || 0;
  const nextCost = castleUpgradeCost(sel.id);
  ctx.textAlign = "left";
  ctx.font = "bold 17px Trebuchet MS"; ctx.fillStyle = sel.col;
  ctx.fillText(sel.name, px0 + pad, detailY + 18);
  ctx.font = "11px Trebuchet MS"; ctx.fillStyle = MUTED;
  const current = selLvl > 0 ? sel.effects[selLvl - 1] : "not started";
  const next = selLvl >= 3 ? "complete" : sel.effects[selLvl];
  ctx.fillText("Current: " + current, px0 + pad, detailY + 40);
  ctx.fillText("Next: " + next, px0 + pad, detailY + 58);

  const buyRect = { x: px0 + panelW - 166, y: detailY + 12, w: 142, h: 44 };
  const canBuy = selLvl < 3 && player.coins >= nextCost;
  const bHov = inRect(m, buyRect);
  roundedRect(buyRect.x, buyRect.y, buyRect.w, buyRect.h, 10);
  ctx.fillStyle = selLvl >= 3 ? "rgba(130,130,130,0.12)"
    : canBuy ? (bHov ? "rgba(242,193,78,0.4)" : "rgba(242,193,78,0.24)")
    : "rgba(255,90,70,0.10)";
  ctx.fill();
  ctx.strokeStyle = selLvl >= 3 ? "rgba(150,150,150,0.4)" : canBuy ? GOLD : "rgba(255,110,90,0.5)";
  ctx.lineWidth = canBuy ? 2 : 1;
  roundedRect(buyRect.x, buyRect.y, buyRect.w, buyRect.h, 10); ctx.stroke();
  ctx.textAlign = "center"; ctx.font = "bold 13px Trebuchet MS";
  ctx.fillStyle = selLvl >= 3 ? "rgba(180,180,180,0.65)" : canBuy ? "#ffe9b0" : "rgba(255,140,120,0.8)";
  ctx.fillText(selLvl >= 3 ? "COMPLETE" : "BUY  |  " + nextCost + " gold", buyRect.x + buyRect.w / 2, buyRect.y + 27);

  provide('castleRects', { cards, buy: selLvl >= 3 ? null : buyRect });
  ctx.restore();
}

// ---------- Upgrade menu ----------
export function drawUpgradeMenu() {
  if (!Game.upgradeMenuOpen || !Game.upgradeOptions) return;
  const opts = Game.upgradeOptions;
  const { player } = state;
  if (!player || !player.weapon) return;
  const w = WEAPONS[player.weapon], rc = RARITY_COL[w.rarity];
  const cx = W / 2, cy = H / 2;
  const t = performance.now() / 1000;
  ctx.save();
  // dark backdrop with a soft violet vignette so the pick feels like a reveal
  ctx.fillStyle = "rgba(6,4,14,0.92)"; ctx.fillRect(0, 0, W, H);
  const vg = ctx.createRadialGradient(cx, cy - 40, 60, cx, cy - 40, Math.max(W, H) * 0.55);
  vg.addColorStop(0, "rgba(60,40,90,0.28)"); vg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.font = "bold 22px Trebuchet MS"; ctx.fillStyle = "#f2c14e";
  ctx.fillText("⬆ Level " + player.level + "! Choose an upgrade", cx, cy - 196);
  // the weapon itself floats beneath the title, wearing its enchant glow
  ctx.save();
  ctx.translate(cx, cy - 150 + Math.sin(t * 1.8) * 3);
  drawWeaponModel(player.weapon, 1.15, { glow: 0.15, upgrades: player.weaponUpgrades });
  ctx.restore();
  ctx.font = "13px Trebuchet MS"; ctx.fillStyle = rc;
  const lvl = weaponLevel(player.weaponUpgrades);
  ctx.fillText(w.name + " · Lvl " + lvl + "  →  Lvl " + (lvl + 1), cx, cy - 108);

  const cardW = 200, cardH = 224, gap = 18;
  const totalW = opts.length * cardW + (opts.length - 1) * gap;
  const sx = cx - totalW / 2;
  const curEff = effectiveWeapon(player.weapon, player.weaponUpgrades || []);
  for (let i = 0; i < opts.length; i++) {
    const opt = opts[i], sel = i === Game.upgradeIdx;
    const tier = UPGRADE_TIERS[opt.tier] ? opt.tier : "rare";
    const tdef = UPGRADE_TIERS[tier];
    const isLegend = tier === "legendary";
    const pulse = isLegend ? 0.5 + 0.5 * Math.sin(t * 3.2) : 0;
    const ox = sx + i * (cardW + gap), oy = cy - 88 - (sel ? 6 : 0);
    const nxtEff = effectiveWeapon(player.weapon, [...(player.weaponUpgrades || []), opt]);

    // card body with a tier-colored aura
    ctx.save();
    if (sel || isLegend) {
      ctx.shadowColor = tdef.col;
      ctx.shadowBlur = sel ? 26 : 12 + pulse * 12;
    }
    roundedRect(ox, oy, cardW, cardH, 12);
    ctx.fillStyle = sel ? "rgba(30,24,50,0.98)" : "rgba(16,12,30,0.96)";
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = sel ? 0.12 : 0.05;
    ctx.fillStyle = tdef.col;
    roundedRect(ox, oy, cardW, cardH, 12); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = sel ? 1 : 0.55 + pulse * 0.45;
    ctx.strokeStyle = tdef.col;
    ctx.lineWidth = sel ? 2.5 : isLegend ? 2 : 1.2;
    roundedRect(ox, oy, cardW, cardH, 12); ctx.stroke();
    ctx.restore();

    // legendary cards twinkle
    if (isLegend) {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 5; k++) {
        const a = Math.sin(t * 2.4 + k * 2.1) * 0.5 + 0.5;
        const px2 = ox + 14 + ((k * 47.3) % (cardW - 28));
        const py2 = oy + 34 + ((k * 71.7) % (cardH - 48));
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = "#ffe9a0";
        ctx.beginPath(); ctx.arc(px2, py2, 1.2 + a, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    ctx.textAlign = "center";
    // tier banner
    ctx.font = "bold 11px Trebuchet MS"; ctx.fillStyle = tdef.col;
    ctx.fillText(isLegend ? "★ LEGENDARY ★" : tdef.name.toUpperCase(), ox + cardW / 2, oy + 20);
    ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ox + 16, oy + 27); ctx.lineTo(ox + cardW - 16, oy + 27); ctx.stroke();
    // key hint + name
    ctx.font = "bold 10px Trebuchet MS"; ctx.fillStyle = sel ? "#f2c14e" : "#907860";
    ctx.fillText("[" + (i + 1) + "]", ox + cardW / 2, oy + 41);
    ctx.font = "bold 15px Trebuchet MS";
    ctx.fillStyle = sel ? "#f0e6cf" : "#d8c8a8";
    ctx.fillText(opt.name, ox + cardW / 2, oy + 61);
    let yy = oy + 77;
    if (opt.unique || opt.ultimate) {
      ctx.font = "italic 10px Trebuchet MS"; ctx.fillStyle = rc;
      ctx.fillText(opt.ultimate ? "◆ " + w.name + " ultimate" : "◆ " + w.name + " only", ox + cardW / 2, yy);
      yy += 15;
    }
    // wrapped description
    ctx.fillStyle = "rgba(205,195,175,0.82)";
    for (const ln of wrapText(opt.desc, cardW - 28, "11px Trebuchet MS").slice(0, 5)) {
      ctx.fillText(ln, ox + cardW / 2, yy); yy += 14;
    }
    // stat deltas pinned to the card bottom
    const statLines = [];
    if (opt.effect.dmg)        statLines.push(["Damage: " + curEff.dmg + " → " + nxtEff.dmg, "#9bd05a"]);
    if (opt.effect.speedBonus) statLines.push(["Speed: " + curEff.speed + "s → " + nxtEff.speed + "s", "#6ab4ff"]);
    if (opt.effect.range)      statLines.push(["Range: " + curEff.range + " → " + nxtEff.range + " px", "#f2c14e"]);
    if (opt.effect.critBonus)  statLines.push(["Crit: +" + Math.round(opt.effect.critBonus * 100) + "%", "#ff8a5a"]);
    let sy = oy + cardH - 14 - (statLines.length - 1) * 17;
    ctx.font = "12px Trebuchet MS";
    for (const [txt, col] of statLines) { ctx.fillStyle = col; ctx.fillText(txt, ox + cardW / 2, sy); sy += 17; }
  }
  ctx.textAlign = "center"; ctx.font = "11px Trebuchet MS"; ctx.fillStyle = "rgba(180,180,180,0.45)";
  ctx.fillText("◀▶ navigate  ·  E/Enter select  ·  1/2/3 direct  ·  Esc cancel", cx, cy - 88 + cardH + 30);
  ctx.restore();
}

// ---------- XP bar ----------
export function drawXpBar() {
  const { player } = state;
  if (!player || !player.level) return;
  const xpNeeded = 60 + player.level * 45;
  const frac = clamp((player.xp || 0) / xpNeeded, 0, 1);
  const bx = 20, by = H - 48, bw = 150, bh = 7;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.5)"; roundedRect(bx - 6, by - 22, bw + 12, bh + 30, 6); ctx.fill();
  ctx.font = "bold 11px Trebuchet MS"; ctx.textAlign = "left";
  ctx.fillStyle = "#f2c14e"; ctx.fillText("Level " + player.level, bx, by - 7);
  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = "#9bd05a"; ctx.fillRect(bx, by, bw * frac, bh);
  ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
  ctx.restore();
}

// ---------- Legendary intro ----------
function drawLegendaryBossHead(intro, cx, cy, size) {
  const t = ENEMY_TYPES[intro.bossType];
  if (!t) return;
  const T = performance.now() / 1000;
  const w = size, col = t.color, eye = t.eye;
  if (intro.bossType === "magmaGolem") {
    // Match the in-world redesign: a narrow furnace rift and one severe visor
    // read far more threatening than the generic pair of round boss eyes.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.24 + 0.12 * Math.sin(T * 2.4);
    const glow = ctx.createRadialGradient(cx, cy, 3, cx, cy, w * 1.08);
    glow.addColorStop(0, "rgba(255,125,35,0.78)"); glow.addColorStop(1, "rgba(120,10,0,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.9, w * 1.04, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = "#101318";
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.42, cy + w * 0.44); ctx.lineTo(cx - w * 0.48, cy - w * 0.14);
    ctx.lineTo(cx - w * 0.24, cy - w * 0.58); ctx.lineTo(cx + w * 0.16, cy - w * 0.62);
    ctx.lineTo(cx + w * 0.44, cy - w * 0.2); ctx.lineTo(cx + w * 0.36, cy + w * 0.46); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#333b44";
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.33, cy + w * 0.39); ctx.lineTo(cx - w * 0.36, cy - w * 0.08);
    ctx.lineTo(cx - w * 0.16, cy - w * 0.48); ctx.lineTo(cx + w * 0.11, cy - w * 0.52);
    ctx.lineTo(cx + w * 0.3, cy - w * 0.14); ctx.lineTo(cx + w * 0.25, cy + w * 0.39); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#090b0e";
    ctx.beginPath(); ctx.moveTo(cx - w * 0.19, cy - w * 0.3); ctx.lineTo(cx + w * 0.22, cy - w * 0.34); ctx.lineTo(cx + w * 0.16, cy - w * 0.21); ctx.lineTo(cx - w * 0.15, cy - w * 0.17); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.82 + 0.16 * Math.sin(T * 7);
    ctx.fillStyle = "#ffad48";
    ctx.beginPath(); ctx.moveTo(cx - w * 0.13, cy - w * 0.265); ctx.lineTo(cx + w * 0.17, cy - w * 0.292); ctx.lineTo(cx + w * 0.12, cy - w * 0.232); ctx.lineTo(cx - w * 0.1, cy - w * 0.208); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f45a21";
    ctx.beginPath(); ctx.moveTo(cx - w * 0.055, cy - w * 0.1); ctx.lineTo(cx + w * 0.055, cy - w * 0.04); ctx.lineTo(cx + w * 0.02, cy + w * 0.26); ctx.lineTo(cx - w * 0.05, cy + w * 0.14); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
    return;
  }
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const ag = ctx.createRadialGradient(cx, cy, 4, cx, cy, w * 1.1);
  ag.addColorStop(0, eye); ag.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.35 + 0.12 * Math.sin(T * 2); ctx.fillStyle = ag;
  ctx.beginPath(); ctx.arc(cx, cy, w * 1.1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.55, w * 0.65, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col;
  const hc = 5;
  for (let i = 0; i < hc; i++) { const hx = cx + (i / (hc - 1) - 0.5) * w * 0.9, hh = i % 2 === 0 ? w * 0.45 : w * 0.3; ctx.beginPath(); ctx.moveTo(hx - 4, cy - w * 0.6); ctx.lineTo(hx, cy - w * 0.6 - hh); ctx.lineTo(hx + 4, cy - w * 0.6); ctx.fill(); }
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = eye;
  ctx.globalAlpha = 0.7 + 0.25 * Math.sin(T * 4); ctx.beginPath();
  ctx.ellipse(cx - w * 0.14, cy - w * 0.05, w * 0.13, w * 0.09, 0, 0, Math.PI * 2); ctx.fill();
  ctx.ellipse(cx + w * 0.14, cy - w * 0.05, w * 0.13, w * 0.09, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore(); ctx.fillStyle = eye;
  ctx.beginPath(); ctx.arc(cx - w * 0.14, cy - w * 0.05, w * 0.05, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + w * 0.14, cy - w * 0.05, w * 0.05, 0, Math.PI * 2); ctx.fill();
}

export function drawLegendaryIntro() {
  const intro = Game.legendaryIntro;
  if (!intro) return;
  intro.timer -= 1 / 60;
  if (intro.timer <= 0) { Game.legendaryIntro = null; return; }
  const max = intro.maxTimer;
  const slideIn = Math.min(1, (max - intro.timer) / 0.6);
  const fadeOut = intro.timer < 1.2 ? intro.timer / 1.2 : 1;
  const alpha = Math.min(slideIn, fadeOut);
  const yOff = (1 - slideIn) * -220;
  const cx = W / 2, panW = Math.min(620, W - 40), panH = 200;
  const py = H * 0.12 + yOff;

  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(6,4,14,0.92)";
  roundedRect(cx - panW / 2, py, panW, panH, 16); ctx.fill();
  const ET = ENEMY_TYPES[intro.bossType];
  if (!ET) { Game.legendaryIntro = null; ctx.restore(); return; }
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5 * alpha;
  ctx.strokeStyle = ET.eye; ctx.lineWidth = 2;
  roundedRect(cx - panW / 2, py, panW, panH, 16); ctx.stroke();
  ctx.restore();
  drawLegendaryBossHead(intro, cx - panW / 2 + 110, py + panH / 2, 72);
  const tx = cx - panW / 2 + 210;
  ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.font = "11px Trebuchet MS"; ctx.textAlign = "left";
  ctx.fillText("⚔ LEGENDARY BOSS APPROACHES", tx, py + 38);
  ctx.fillStyle = "#f2c14e"; ctx.font = "bold 28px Trebuchet MS";
  ctx.fillText(ET.name, tx, py + 74);
  ctx.fillStyle = ET.eye; ctx.font = "13px Trebuchet MS";
  ctx.fillText("Day " + Game.day + "  ·  Special attack: " + (ET.attackName || ""), tx, py + 98);
  ctx.fillStyle = "rgba(240,230,210,0.7)"; ctx.font = "12px Trebuchet MS";
  const descs = {
    legend1: "Stomps the ground and sends a shockwave destroying everything within 200px.",
    legend2: "Charges up and rushes at lightning speed, crushing everything in its path.",
    legend3: "Emits a massive void pulse that hits everything within 310px.",
    magmaGolem: "Armored obsidian shell – hit the glowing core when it opens! Crushes walls and leaves burning pools of magma.",
  };
  descs.voidTitan = "Sealed void plates halve damage until the star-core opens. Tears gravity scars into the battlefield.";
  descs.voidSeraph = "A flying ritual horror that fires black-star lances, screams shockwaves and summons the Hollow.";
  descs.forestStalker = "Rams walls, stuns archers and grows roots through the base. Splinter Bow clears roots; Lumberjack's Hatchet cracks its bark.";
  descs.skadiWrath = "Deep Freeze makes your strongest wall brittle and Cryo-Shield reflects arrows. Icicle Lance breaks the shield; Blizzard Chime protects archers.";
  descs.duneBroodmother = "Burrows under the line, breaches near the outer wall and leaves acid rain. Sandstorm Sling makes her big attacks miss.";
  descs.sunkenBehemoth = "Sucks in coins and defenders, healing from swallowed gold. Acid Blowgun blocks the healing; Gator Maul interrupts the suction.";
  descs.ignitedCore = "Opens lava cracks and charges a Supernova at half HP. Obsidian Brand and Magma Mortar can interrupt the core.";
  descs.voidMindflayer = "Possesses archers and decays your gold. Shadow Scythe cuts the control tentacles; Possessed Heart cracks the mask.";
  ctx.fillText(descs[intro.bossType] || "", tx, py + 120);
  ctx.fillStyle = "rgba(255,255,255,0.1)"; roundedRect(tx, py + 140, panW - 230, 12, 6); ctx.fill();
  ctx.fillStyle = ET.eye;
  const barW = (panW - 230) * 0.7;
  roundedRect(tx, py + 140, barW, 12, 6); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "10px Trebuchet MS"; ctx.textAlign = "left";
  ctx.fillText("HP: " + ET.hp, tx, py + 168);
  ctx.restore();
}

export function drawOneSidedAnnounce() {
  const a = Game.oneSidedAnnounce;
  if (!a) return;
  a.timer -= 1 / 60;
  if (a.timer <= 0) { Game.oneSidedAnnounce = null; return; }
  const max = a.maxTimer;
  const slideIn = Math.min(1, (max - a.timer) / 0.6);
  const fadeOut = a.timer < 1.2 ? a.timer / 1.2 : 1;
  const alpha = Math.min(slideIn, fadeOut);
  const yOff = (1 - slideIn) * -80;
  const cx = W / 2, panW = Math.min(480, W - 40), panH = 66;
  const py = H * 0.16 + yOff;
  const sideLabel = a.side < 0 ? "WEST" : "EAST";

  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(6,4,14,0.92)";
  roundedRect(cx - panW / 2, py, panW, panH, 14); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5 * alpha;
  ctx.strokeStyle = "#f2c14e"; ctx.lineWidth = 2;
  roundedRect(cx - panW / 2, py, panW, panH, 14); ctx.stroke();
  ctx.restore();
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "11px Trebuchet MS";
  ctx.fillText("⚠ SCOUTS REPORT", cx, py + 22);
  ctx.fillStyle = "#f2c14e"; ctx.font = "bold 20px Trebuchet MS";
  ctx.fillText("Tonight the horde attacks only from the " + sideLabel, cx, py + 48);
  ctx.textAlign = "left";
  ctx.restore();
}
