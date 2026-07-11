import { state, Game } from '../../core/state.js';
import { canvas, W, H } from '../../core/canvas.js';
import { UI, closeSkillTree, openSkillTree } from '../../rendering/HUD.js';
import { tryOpenShop, handleShopKeys, currentShopList, tryBuyShopItem } from '../economy/ShopSystem.js';
import { applyUpgrade } from '../economy/UpgradeSystem.js';
import { triggerBarrage } from '../ai/AI.js';
import { tryToggleMine } from '../world/MineSystem.js';

export function setupInputHandlers() {
  // UI buttons
  document.getElementById("btn-start").addEventListener("click", ()=>Game.start(false));
  document.getElementById("btn-continue").addEventListener("click", ()=>Game.start(true));
  document.getElementById("btn-restart").addEventListener("click", ()=>Game.start(false));

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

  // Shop item clicks
  canvas.addEventListener("mousedown", handleCanvasClick);
}

function handleKeydown(e) {
  const k = e.key.toLowerCase();
  if (k === "m") UI.toggleMute();
  if (k === "p") window.DEV?.toggle();
  if (k === "escape") {
    if (Game.skillTreeOpen) { closeSkillTree(); return; }
    Game.inventoryOpen = false; Game.shopOpen = false; Game.upgradeMenuOpen = false;
    if (Game.state === "play" || Game.state === "pause") Game.togglePause();
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

  if (k === "k") {
    if (Game.skillTreeOpen) closeSkillTree();
    else openSkillTree();
    e.preventDefault(); return;
  }
  if (k === "q") {
    if (!e.repeat) triggerBarrage();
    e.preventDefault(); return;
  }
  if (k === "f" && !Game.inventoryOpen && !Game.shopOpen) {
    if (tryToggleMine()) { e.preventDefault(); return; }
  }
  if ((k === "arrowdown" || k === "s") && !e.repeat && !Game.inventoryOpen && !Game.shopOpen) {
    if (tryToggleMine()) { e.preventDefault(); return; }
  }
  if (k === "n" && !Game.inventoryOpen && !Game.shopOpen) { UI.skipToDusk(); e.preventDefault(); return; }
  if (k === "i") { Game.inventoryOpen = !Game.inventoryOpen; Game.shopOpen = false; }
  if (k === "b" && !Game.inventoryOpen) tryOpenShop();
  if (Game.shopOpen) handleShopKeys(k, e);
  if (k === "+" || k === "=") { Game.zoom = Math.min(2.5, Game.zoom + 0.15); e.preventDefault(); }
  if (k === "-" || k === "_") { Game.zoom = Math.max(0.35, Game.zoom - 0.15); e.preventDefault(); }
  if (k === "0") { Game.zoom = 1; e.preventDefault(); }
}

function handleWheel(e) {
  e.preventDefault();
  Game.zoom = Math.max(0.35, Math.min(2.5, Game.zoom - e.deltaY * 0.0012));
}

function handleCanvasClick(e) {
  if (!Game.shopOpen) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top)  * scaleY;

  // Check tab header clicks
  if (window._shopTabRects) {
    for (const tr of window._shopTabRects) {
      if (mx >= tr.x && mx <= tr.x+tr.w && my >= tr.y && my <= tr.y+tr.h) {
        Game.shopTab = tr.tab; Game.shopIdx = 0; return;
      }
    }
  }

  // Check item cell clicks
  if (window._shopCells) {
    for (const cell of window._shopCells) {
      if (mx >= cell.x && mx <= cell.x+cell.w && my >= cell.y && my <= cell.y+cell.h) {
        Game.shopIdx = cell.idx;
        tryBuyShopItem(currentShopList()[cell.idx]);
        return;
      }
    }
  }
}
