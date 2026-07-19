import { state, Game } from '../../core/state.js';
import { canvas, W, H } from '../../core/canvas.js';
import { inject, provide } from '../../core/services.js';
import { UI, DEV, closeSkillTree, openSkillTree } from '../../rendering/HUD.js?v=biomeactive1';
import { tryOpenShop, handleShopKeys, currentShopList, tryBuyShopItem } from '../economy/ShopSystem.js?v=biomeweapons1';
import { tryOpenCastleUpgrades, closeCastleUpgrades, buyCastleUpgrade } from '../economy/CastleUpgradeSystem.js?v=biomeweapons1';
import { toggleMount } from '../economy/MountSystem.js';
import { equipFromInventory, unequipWeapon, unequipArmor, ensureInventory } from '../economy/InventorySystem.js';
import { applyUpgrade, checkUpgrade } from '../economy/UpgradeSystem.js?v=biomeweapons1';
import { triggerBarrage, triggerRoyalRally } from '../ai/AI.js?v=biomeactive1';
import { tryToggleMine } from '../world/MineSystem.js';
import { startAssault } from '../world/AssaultSystem.js?v=biomeactive1';
import { setupDevPanel } from './DevPanel.js?v=biomeactive1';
import { warpToHubPortal, snapHubToPlaza } from '../infrastructure/RoguelikeSystem.js';

export function setupInputHandlers() {
  // UI buttons
  document.getElementById("btn-start").addEventListener("click", ()=>Game.start(false));
  document.getElementById("btn-continue").addEventListener("click", ()=>Game.start(true));
  document.getElementById("btn-restart").addEventListener("click", ()=>Game.start(false));

  // HUD buttons
  document.getElementById("hud-skipnight").addEventListener("click", () => UI.skipToDusk());
  document.getElementById("hud-skillpts").addEventListener("click", () => openSkillTree());
  document.getElementById("st-close-btn").addEventListener("click", () => closeSkillTree());

  // Dev panel
  setupDevPanel();

  // Difficulty buttons
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('diff-active'));
      btn.classList.add('diff-active');
    });
  });

  // Keyboard input
  document.addEventListener("keydown", handleKeydown);

  // Mouse wheel zoom
  canvas.addEventListener("wheel", handleWheel, { passive: false });

  // Mouse position for canvas-drawn UI (inventory/shop hover + tooltips)
  const mouse = { x: -9999, y: -9999 };
  provide('mouse', mouse);
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * (W / rect.width);
    mouse.y = (e.clientY - rect.top) * (H / rect.height);
  });
  canvas.addEventListener("mouseleave", () => { mouse.x = -9999; mouse.y = -9999; });

  // Inventory + shop item clicks
  canvas.addEventListener("mousedown", handleCanvasClick);
}

function handleKeydown(e) {
  const k = e.key.toLowerCase();
  if (k === "m") UI.toggleMute();
  if (k === "p") DEV.toggle();
  if (k === "escape") {
    if (Game.skillTreeOpen) { closeSkillTree(); return; }
    if (Game.castleOpen) { closeCastleUpgrades(); e.preventDefault(); return; }
    Game.inventoryOpen = false; Game.shopOpen = false; Game.castleOpen = false; Game.upgradeMenuOpen = false;
    if (Game.state === "play" || Game.state === "pause") Game.togglePause();
  }

  // Hub state - start new run with Enter/Space, hop between plazas with Q/E
  if (Game.state === "hub") {
    if (k === "enter" || k === " " || k === "space") {
      e.preventDefault();
      warpToHubPortal();
      return;
    }
    if (k === "e") { e.preventDefault(); snapHubToPlaza(1); return; }
    if (k === "q") { e.preventDefault(); snapHubToPlaza(-1); return; }
  }

  if (Game.state !== "play") return;

  if (Game.upgradeMenuOpen) {
    if (k === "1") { applyUpgrade(0); e.preventDefault(); return; }
    if (k === "2") { applyUpgrade(1); e.preventDefault(); return; }
    if (k === "3") { applyUpgrade(2); e.preventDefault(); return; }
    if (k === "arrowleft")  { Game.upgradeIdx = Math.max(0, Game.upgradeIdx - 1); e.preventDefault(); return; }
    if (k === "arrowright") { Game.upgradeIdx = Math.min((Game.upgradeOptions?.length || 1) - 1, Game.upgradeIdx + 1); e.preventDefault(); return; }
    if (k === "e" || k === "enter") { applyUpgrade(Game.upgradeIdx); e.preventDefault(); return; }
    e.preventDefault(); return;
  }

  if (Game.castleOpen) {
    const last = 3;
    if (k === "arrowleft")  { Game.castleIdx = Math.max(0, (Game.castleIdx || 0) - 1); e.preventDefault(); return; }
    if (k === "arrowright") { Game.castleIdx = Math.min(last, (Game.castleIdx || 0) + 1); e.preventDefault(); return; }
    if (k === "arrowup")    { Game.castleIdx = Math.max(0, (Game.castleIdx || 0) - 2); e.preventDefault(); return; }
    if (k === "arrowdown")  { Game.castleIdx = Math.min(last, (Game.castleIdx || 0) + 2); e.preventDefault(); return; }
    if (k >= "1" && k <= "4") { Game.castleIdx = Number(k) - 1; e.preventDefault(); return; }
    if (k === "e" || k === "enter") { buyCastleUpgrade(); e.preventDefault(); return; }
    e.preventDefault(); return;
  }

  if (k === "k") {
    if (Game.skillTreeOpen) closeSkillTree();
    else openSkillTree();
    e.preventDefault(); return;
  }
  if (k === "q") {
    if (!e.repeat) triggerBarrage();
    e.preventDefault(); return;
  }
  if (k === "r") {
    if (!e.repeat) triggerRoyalRally();
    e.preventDefault(); return;
  }
  if (k === "g") {
    if (!e.repeat) startAssault();
    e.preventDefault(); return;
  }
  if (k === "u") {
    if (!e.repeat) DEV.triggerWeaponUpgrade();
    e.preventDefault(); return;
  }
  if (k === "f" && !Game.inventoryOpen && !Game.shopOpen) {
    if (tryToggleMine()) { e.preventDefault(); return; }
  }
  if ((k === "arrowdown" || k === "s") && !e.repeat && !Game.inventoryOpen && !Game.shopOpen) {
    if (tryToggleMine()) { e.preventDefault(); return; }
  }
  if (k === "n" && !Game.inventoryOpen && !Game.shopOpen) { UI.skipToDusk(); e.preventDefault(); return; }
  if (k === "h" && !e.repeat && !Game.inventoryOpen && !Game.shopOpen) toggleMount();
  if (k === "c" && !Game.inventoryOpen && !Game.shopOpen) { if (tryOpenCastleUpgrades()) e.preventDefault(); return; }
  if (k === "i") { Game.inventoryOpen = !Game.inventoryOpen; Game.shopOpen = false; Game.castleOpen = false; }
  if (k === "b" && !Game.inventoryOpen) { Game.castleOpen = false; tryOpenShop(); }
  if (Game.shopOpen) handleShopKeys(k, e);
  if (k === "+" || k === "=") { Game.zoom = Math.min(2.5, Game.zoom + 0.15); e.preventDefault(); }
  if (k === "-" || k === "_") { Game.zoom = Math.max(0.35, Game.zoom - 0.15); e.preventDefault(); }
  if (k === "0") { Game.zoom = 1; e.preventDefault(); }
}

function handleWheel(e) {
  e.preventDefault();
  if (Game.shopOpen || Game.inventoryOpen || Game.castleOpen) return; // don't zoom the world behind menus
  Game.zoom = Math.max(0.35, Math.min(2.5, Game.zoom - e.deltaY * 0.0012));
}

function hitRect(mx, my, r) {
  return r && mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
}

function handleCanvasClick(e) {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (W / rect.width);
  const my = (e.clientY - rect.top)  * (H / rect.height);
  if (Game.castleOpen)   { handleCastleClick(mx, my); return; }
  if (Game.inventoryOpen) { handleInventoryClick(mx, my); return; }
  if (Game.shopOpen)      { handleShopClick(mx, my); return; }
}

function handleInventoryClick(mx, my) {
  const R = inject('invRects');
  if (!R || !state.player) return;
  if (hitRect(mx, my, R.weapon) && state.player.weapon) { unequipWeapon(); return; }
  if (hitRect(mx, my, R.armor) && state.player.armor)   { unequipArmor(); return; }
  const inv = ensureInventory(state.player);
  for (const cell of R.cells || []) {
    if (hitRect(mx, my, cell) && cell.idx < inv.length) {
      equipFromInventory(cell.idx);
      return;
    }
  }
}

function handleShopClick(mx, my) {
  const R = inject('shopRects');
  if (!R) return;
  for (const tr of R.tabs || []) {
    if (hitRect(mx, my, tr)) { Game.shopTab = tr.tab; Game.shopIdx = 0; return; }
  }
  if (hitRect(mx, my, R.buy)) {
    tryBuyShopItem(currentShopList()[Game.shopIdx]);
    return;
  }
  for (const cell of R.cells || []) {
    if (hitRect(mx, my, cell)) {
      // first click selects; clicking the selected item buys it
      if (Game.shopIdx === cell.idx) tryBuyShopItem(currentShopList()[cell.idx]);
      else Game.shopIdx = cell.idx;
      return;
    }
  }
}

function handleCastleClick(mx, my) {
  const R = inject('castleRects');
  if (!R) return;
  if (hitRect(mx, my, R.buy)) {
    buyCastleUpgrade();
    return;
  }
  for (const card of R.cards || []) {
    if (!hitRect(mx, my, card)) continue;
    if (Game.castleIdx === card.idx) buyCastleUpgrade();
    else Game.castleIdx = card.idx;
    return;
  }
}
