import { clamp } from '../../util/math.js';
import { WEAPONS, RARITY_COL, RARITY_NAME, WEAPON_UPGRADES, effectiveWeapon } from '../../config/weapons.js';
import { ARMORS, ARMOR_RARITY_COL, ARMOR_RARITY_NAME } from '../../config/armor.js';
import { ENEMY_TYPES } from '../../config/enemies.js';
import { ctx, W, H, groundY } from '../../core/canvas.js';
import { Game, state } from '../../core/state.js';
import { roundedRect, drawHeart, drawTomeIcon } from '../DrawHelpers.js';

// ---------- Weapon pickup overlay ----------
export function drawWeaponPickupOverlay() {
  const wp = state.weaponPickup;
  if (!wp) return;
  const a = clamp(wp.timer / 1.0, 0, 1);
  if (a <= 0) return;
  const w = WEAPONS[wp.weaponId], rc = RARITY_COL[w.rarity];
  const cx = W/2, cy = H*0.32;
  const elapsed = 3.8 - wp.timer;
  const entryScale = elapsed < 0.25 ? (0.6 + 0.4 * (elapsed / 0.25)) : 1;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(cx, cy); ctx.scale(entryScale, entryScale); ctx.translate(-cx, -cy);
  const panelW2 = w.rarity >= 3 ? 340 : 320, panelH2 = w.rarity >= 3 ? 134 : 124;
  roundedRect(cx-panelW2/2, cy-panelH2/2, panelW2, panelH2, 14);
  ctx.fillStyle = "rgba(12,10,20,0.92)"; ctx.fill();
  ctx.strokeStyle = rc + "dd"; ctx.lineWidth = w.rarity >= 3 ? 2.5 : 2; ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=a*(w.rarity >= 3 ? 0.28 : 0.18);
  ctx.fillStyle=rc; roundedRect(cx-panelW2/2,cy-panelH2/2,panelW2,panelH2,14); ctx.fill();
  ctx.restore(); ctx.globalAlpha=a;
  ctx.save(); ctx.translate(cx-90, cy+4);
  if (w.type==="melee") {
    const len=clamp(w.range*0.55,26,46);
    ctx.strokeStyle=w.col; ctx.lineWidth=4; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(-len/2,-2); ctx.lineTo(len/2,-2); ctx.stroke();
    ctx.lineWidth=7; ctx.beginPath(); ctx.moveTo(-len*0.35,-10); ctx.lineTo(-len*0.35,6); ctx.stroke();
    if (w.rarity>=2) { ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.4; ctx.strokeStyle=w.col; ctx.lineWidth=8; ctx.beginPath(); ctx.moveTo(-len/2,-2); ctx.lineTo(len/2,-2); ctx.stroke(); ctx.restore(); }
  } else if (w.type==="ranged") {
    ctx.strokeStyle=w.col; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(0,0,16,-1.3,1.3); ctx.stroke();
    ctx.strokeStyle="#e8d8a8"; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(16*Math.cos(-1.3),16*Math.sin(-1.3)); ctx.lineTo(16*Math.cos(1.3),16*Math.sin(1.3)); ctx.stroke();
  } else {
    drawTomeIcon(w.col, 1.8);
  }
  ctx.restore();
  ctx.textAlign="left";
  ctx.font="bold 20px Trebuchet MS"; ctx.fillStyle=rc;
  ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillText(w.name, cx-39, cy-16);
  ctx.fillStyle=rc; ctx.fillText(w.name, cx-40, cy-17);
  ctx.font="13px Trebuchet MS"; ctx.fillStyle="rgba(255,255,255,0.75)";
  ctx.fillText(RARITY_NAME[w.rarity], cx-40, cy+4);
  ctx.fillText("Skade: "+w.dmg+"  Rækkevidde: "+w.range, cx-40, cy+22);
  ctx.fillStyle="rgba(200,200,200,0.5)"; ctx.font="11px Trebuchet MS"; ctx.textAlign="center";
  ctx.fillText("Våben samlet op", cx, cy+46);
  ctx.restore();
}

// ---------- Inventory overlay ----------
export function drawInventoryOverlay() {
  if (!Game.inventoryOpen) return;
  const { player } = state;
  ctx.save();
  ctx.fillStyle="rgba(6,4,14,0.88)"; ctx.fillRect(0,0,W,H);
  roundedRect(W/2-280,H/2-180,560,360,18);
  ctx.fillStyle="rgba(20,16,36,0.97)"; ctx.fill();
  ctx.strokeStyle="rgba(200,180,120,0.35)"; ctx.lineWidth=2; ctx.stroke();
  ctx.textAlign="center"; ctx.font="bold 18px Trebuchet MS";
  ctx.fillStyle="#f0e6cf"; ctx.fillText("Inventar  [I – luk]", W/2, H/2-144);
  ctx.strokeStyle="rgba(200,180,120,0.2)"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(W/2, H/2-128); ctx.lineTo(W/2, H/2+158); ctx.stroke();
  const charX=W/2-130, charY=H/2+60;
  ctx.save(); ctx.translate(charX, charY); ctx.scale(2.2, 2.2);
  ctx.fillStyle="#7a2440"; roundedRect(-6,-70,16,26,6); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,0.18)"; roundedRect(4,-70,6,26,4); ctx.fill();
  ctx.fillStyle="#caa483"; ctx.beginPath(); ctx.arc(2,-74,6,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#5a182e"; ctx.beginPath(); ctx.moveTo(-4,-66); ctx.quadraticCurveTo(-16,-52,-22,-32); ctx.lineTo(-8,-40); ctx.quadraticCurveTo(-6,-54,2,-64); ctx.fill();
  ctx.fillStyle="#2a2230"; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(-14,-26); ctx.lineTo(-14,0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(12,-26); ctx.lineTo(12,0); ctx.stroke();
  ctx.fillStyle="#2a2230"; roundedRect(-20,-46,44,22,10); ctx.fill();
  if (player && player.weapon) {
    const ww=WEAPONS[player.weapon];
    if (ww.type==="melee") {
      const len=clamp(ww.range*0.35,14,28);
      ctx.save(); ctx.translate(10,-58); ctx.rotate(-0.22);
      ctx.strokeStyle=ww.col; ctx.lineWidth=2.5; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(len,0); ctx.stroke(); ctx.restore();
    } else if (ww.type==="ranged") {
      ctx.strokeStyle=WEAPONS[player.weapon].col; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(14,-58,9,-1.25,1.25); ctx.stroke();
    } else {
      ctx.save(); ctx.translate(12,-58); drawTomeIcon(ww.col, 1.1); ctx.restore();
    }
  }
  ctx.restore();
  ctx.textAlign="center"; ctx.font="bold 13px Trebuchet MS";
  ctx.fillStyle="#c8b890"; ctx.fillText("Monarch", charX, H/2+130);
  const n=player?player.maxHp:0, gap=10, hhy=H/2+148;
  for (let i=0;i<n;i++) drawHeart(charX-(n-1)*gap/2+i*gap, hhy, 4, (player&&i<player.hp)?"#e0556a":"rgba(255,255,255,0.2)");
  const rx=W/2+40;
  ctx.textAlign="left"; ctx.font="bold 14px Trebuchet MS"; ctx.fillStyle="rgba(200,180,120,0.6)";
  ctx.fillText("Udstyret våben", rx, H/2-105);
  if (player && player.weapon) {
    const ww=WEAPONS[player.weapon], rc=RARITY_COL[ww.rarity];
    const eff=effectiveWeapon(player.weapon, player.weaponUpgrades||[]);
    const upgs=player.weaponUpgrades||[];
    ctx.font="bold 20px Trebuchet MS"; ctx.fillStyle=rc;
    ctx.fillText(ww.name, rx, H/2-78);
    ctx.font="13px Trebuchet MS"; ctx.fillStyle="rgba(255,255,255,0.65)";
    ctx.fillText(RARITY_NAME[ww.rarity]+(upgs.length>0?" · "+upgs.length+" opgraderinger":""), rx, H/2-58);
    ctx.fillStyle="rgba(200,200,200,0.8)";
    ctx.fillText("Type:        "+(ww.type==="melee"?"Nærkamp":ww.type==="ranged"?"Bue":"Magi"), rx, H/2-32);
    const dmgBonus=eff.dmg-ww.dmg, rngBonus=eff.range-ww.range, spdDiff=Math.round((ww.speed-eff.speed)*100)/100;
    ctx.fillStyle="rgba(200,200,200,0.8)"; ctx.fillText("Skade:", rx, H/2-12);
    ctx.fillStyle="#f0e6cf"; ctx.fillText(eff.dmg+(dmgBonus>0?" (+"+dmgBonus+")":""), rx+90, H/2-12);
    ctx.fillStyle="rgba(200,200,200,0.8)"; ctx.fillText("Rækkevidde:", rx, H/2+10);
    ctx.fillStyle="#f0e6cf"; ctx.fillText(eff.range+" px"+(rngBonus>0?" (+"+rngBonus+")":""), rx+110, H/2+10);
    ctx.fillStyle="rgba(200,200,200,0.8)"; ctx.fillText("Hastighed:", rx, H/2+32);
    ctx.fillStyle="#f0e6cf"; ctx.fillText(eff.speed+"x"+(spdDiff>0?" (hurtigere)":""), rx+90, H/2+32);
    ctx.save(); ctx.translate(rx+90, H/2+100);
    if (ww.type==="melee") {
      const len=clamp(ww.range*0.6,30,52);
      ctx.strokeStyle=ww.col; ctx.lineWidth=5; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(-len/2,-4); ctx.lineTo(len/2,-4); ctx.stroke();
      ctx.lineWidth=9; ctx.beginPath(); ctx.moveTo(-len*0.32,-14); ctx.lineTo(-len*0.32,8); ctx.stroke();
      if (ww.rarity>=2) { ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.35; ctx.strokeStyle=ww.col; ctx.lineWidth=10; ctx.beginPath(); ctx.moveTo(-len/2,-4); ctx.lineTo(len/2,-4); ctx.stroke(); ctx.restore(); }
    } else if (ww.type==="ranged") {
      ctx.strokeStyle=ww.col; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(0,0,20,-1.3,1.3); ctx.stroke();
      ctx.strokeStyle="#e8d8a8"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(20*Math.cos(-1.3),20*Math.sin(-1.3)); ctx.lineTo(20*Math.cos(1.3),20*Math.sin(1.3)); ctx.stroke();
    } else {
      drawTomeIcon(ww.col, 2.2);
    }
    ctx.restore();
  } else {
    ctx.font="15px Trebuchet MS"; ctx.fillStyle="rgba(200,200,200,0.4)";
    ctx.fillText("Intet våben udstyret", rx, H/2-60);
    ctx.font="12px Trebuchet MS"; ctx.fillStyle="rgba(200,200,200,0.3)";
    ctx.fillText("Find et våben i verden og", rx, H/2-30);
    ctx.fillText("tryk F for at samle det op.", rx, H/2-12);
  }
  ctx.restore();
}

// ---------- Shop overlay ----------
function drawArmorIcon(col, scale=1, canAfford=true) {
  const c = canAfford ? col : "rgba(100,100,100,0.6)";
  ctx.save(); ctx.scale(scale, scale);
  ctx.strokeStyle=c; ctx.lineWidth=2.5; ctx.lineJoin="round";
  ctx.beginPath();
  ctx.moveTo(-9,10); ctx.lineTo(-12,2); ctx.lineTo(-12,-6); ctx.lineTo(0,-10); ctx.lineTo(12,-6);
  ctx.lineTo(12,2); ctx.lineTo(9,10); ctx.lineTo(0,12); ctx.closePath();
  ctx.stroke();
  ctx.fillStyle=canAfford?col+"44":"rgba(80,80,80,0.2)"; ctx.fill();
  ctx.restore();
}

export function drawShopOverlay() {
  if (!Game.shopOpen) return;
  const weaponList = window._WEAPON_SHOP || [];
  const armorList  = window._ARMOR_SHOP || [];
  if (!weaponList.length || !armorList.length) return;
  const tab = Game.shopTab || 0;
  const items = tab === 1 ? armorList : weaponList;
  const { player } = state;
  const cx=W/2, cy=H/2;
  const cols=5, cellW=120, cellH=90, padX=20, padY=20;
  const rows=Math.ceil(items.length/cols);
  const tabH=36;
  const panelW=cols*cellW+padX*2, panelH=rows*cellH+padY*2+48+tabH+58;
  ctx.save();
  ctx.fillStyle="rgba(6,4,14,0.82)"; ctx.fillRect(0,0,W,H);
  roundedRect(cx-panelW/2,cy-panelH/2,panelW,panelH,16);
  ctx.fillStyle="rgba(18,14,32,0.97)"; ctx.fill();
  ctx.strokeStyle="rgba(200,180,120,0.4)"; ctx.lineWidth=2; ctx.stroke();
  ctx.textAlign="center"; ctx.font="bold 18px Trebuchet MS";
  ctx.fillStyle="#f0e6cf"; ctx.fillText("🏪 Butik  [B – luk | ◀▶ naviger | T – skift fane | E – køb]", cx, cy-panelH/2+30);
  ctx.strokeStyle="rgba(200,180,120,0.2)"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(cx-panelW/2+16,cy-panelH/2+40); ctx.lineTo(cx+panelW/2-16,cy-panelH/2+40); ctx.stroke();
  const tabW = (panelW-padX*2)/2;
  const tabY = cy-panelH/2+44;
  const tabLabels = ["⚔ Våben","🛡 Rustning"];
  window._shopTabRects = [];
  for (let ti=0;ti<2;ti++) {
    const tx = cx-panelW/2+padX+ti*tabW;
    window._shopTabRects.push({ x:tx, y:tabY, w:tabW-4, h:tabH-6, tab:ti });
    roundedRect(tx, tabY, tabW-4, tabH-6, 6);
    ctx.fillStyle = ti===tab ? "rgba(242,193,78,0.22)" : "rgba(255,255,255,0.05)";
    ctx.fill();
    ctx.strokeStyle = ti===tab ? "#f2c14e" : "rgba(180,160,100,0.25)";
    ctx.lineWidth = ti===tab ? 2 : 1; ctx.stroke();
    ctx.textAlign="center"; ctx.font = (ti===tab?"bold ":"")+"14px Trebuchet MS";
    ctx.fillStyle = ti===tab ? "#f2c14e" : "#a09070";
    ctx.fillText(tabLabels[ti], tx+tabW*0.5-2, tabY+tabH*0.5-1);
  }
  const gridTop = tabY + tabH;
  window._shopCells = [];
  for (let i=0;i<items.length;i++) {
    const it=items[i];
    const col=i%cols, row=Math.floor(i/cols);
    const ix=cx-panelW/2+padX+col*cellW, iy=gridTop+padY*0.5+row*cellH;
    window._shopCells.push({ x:ix, y:iy, w:cellW-6, h:cellH-6, idx:i });
    const selected=i===Game.shopIdx;
    const canAfford=player.coins>=it.price;
    roundedRect(ix,iy,cellW-6,cellH-6,8);
    ctx.fillStyle=selected?"rgba(255,220,100,0.18)":"rgba(255,255,255,0.04)"; ctx.fill();
    if (selected) { ctx.strokeStyle="#f2c14e"; ctx.lineWidth=2; ctx.stroke(); }
    ctx.save(); ctx.translate(ix+cellW*0.35,iy+cellH*0.38);
    if (it.armorId) {
      const a = ARMORS[it.armorId];
      drawArmorIcon(a.col, 1.05, canAfford);
    } else {
      const w=WEAPONS[it.weaponId];
      if (w.type==="melee") {
        const len=clamp(w.range*0.28,14,24);
        ctx.strokeStyle=canAfford?w.col:"rgba(100,100,100,0.6)"; ctx.lineWidth=3; ctx.lineCap="round";
        ctx.beginPath(); ctx.moveTo(-len/2,0); ctx.lineTo(len/2,0); ctx.stroke();
        ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(-len*0.3,-6); ctx.lineTo(-len*0.3,6); ctx.stroke();
      } else if (w.type==="ranged") {
        ctx.strokeStyle=canAfford?w.col:"rgba(100,100,100,0.6)"; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.arc(0,0,10,-1.3,1.3); ctx.stroke();
        ctx.strokeStyle="#e8d8a8"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(10*Math.cos(-1.3),10*Math.sin(-1.3)); ctx.lineTo(10*Math.cos(1.3),10*Math.sin(1.3)); ctx.stroke();
      } else {
        ctx.globalAlpha = canAfford ? 1 : 0.4;
        drawTomeIcon(w.col, 0.95);
        ctx.globalAlpha = 1;
      }
    }
    ctx.lineCap="butt"; ctx.restore();
    ctx.textAlign="center";
    const itemName = it.armorId ? ARMORS[it.armorId].name : WEAPONS[it.weaponId].name;
    const itemRar  = it.armorId ? ARMORS[it.armorId].rarity : WEAPONS[it.weaponId].rarity;
    const rc = it.armorId ? ARMOR_RARITY_COL[itemRar] : RARITY_COL[itemRar];
    ctx.font="bold 11px Trebuchet MS";
    ctx.fillStyle=canAfford?rc:"rgba(120,110,100,0.8)";
    ctx.fillText(itemName, ix+cellW*0.5-3, iy+cellH*0.72);
    ctx.font="12px Trebuchet MS";
    ctx.fillStyle=canAfford?"#f2c14e":"rgba(160,120,80,0.7)";
    ctx.fillText(it.price+"🪙", ix+cellW*0.5-3, iy+cellH*0.88);
  }
  const selItem = items[Game.shopIdx];
  const statsY = cy + panelH/2 - 52;
  if (selItem) {
    ctx.strokeStyle = "rgba(200,180,120,0.18)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(cx-panelW/2+16, statsY-6); ctx.lineTo(cx+panelW/2-16, statsY-6); ctx.stroke();
    if (selItem.armorId) {
      const sa = ARMORS[selItem.armorId];
      ctx.textAlign="left"; ctx.font="bold 13px Trebuchet MS";
      ctx.fillStyle=ARMOR_RARITY_COL[sa.rarity];
      ctx.fillText(sa.name, cx-panelW/2+20, statsY+12);
      ctx.font="12px Trebuchet MS"; ctx.fillStyle="rgba(200,200,200,0.75)";
      ctx.fillText(ARMOR_RARITY_NAME[sa.rarity]+"  ·  Forsvar: +"+sa.defense+"  ·  "+sa.desc, cx-panelW/2+20, statsY+32);
    } else {
      const sw = WEAPONS[selItem.weaponId];
      ctx.textAlign="left"; ctx.font="bold 13px Trebuchet MS"; ctx.fillStyle=RARITY_COL[sw.rarity];
      ctx.fillText(sw.name, cx-panelW/2+20, statsY+12);
      ctx.font="12px Trebuchet MS"; ctx.fillStyle="rgba(200,200,200,0.75)";
      const typeLabel = sw.type==="melee"?"Nærkamp":sw.type==="ranged"?"Bue":"Magi";
      ctx.fillText(typeLabel+"  ·  Skade: "+sw.dmg+"  ·  Rækkevidde: "+sw.range+" px  ·  Hastighed: "+sw.speed+"x", cx-panelW/2+20, statsY+32);
    }
  }
  ctx.textAlign="center"; ctx.font="13px Trebuchet MS";
  ctx.fillStyle="#f2c14e";
  ctx.fillText("Dine mønter: "+player.coins+"🪙", cx, cy+panelH/2-12);
  ctx.restore();
}

// ---------- Upgrade menu ----------
export function drawUpgradeMenu() {
  if (!Game.upgradeMenuOpen || !Game.upgradeOptions) return;
  const opts = Game.upgradeOptions;
  const { player } = state;
  if (!player || !player.weapon) return;
  const w = WEAPONS[player.weapon], rc = RARITY_COL[w.rarity];
  const cx = W/2, cy = H/2;
  ctx.save();
  ctx.fillStyle = "rgba(6,4,14,0.9)"; ctx.fillRect(0,0,W,H);
  ctx.textAlign = "center";
  ctx.font = "bold 20px Trebuchet MS"; ctx.fillStyle = "#f2c14e";
  ctx.fillText("⬆ Niveau " + player.level + "! Vælg en opgradering", cx, cy - 158);
  ctx.font = "13px Trebuchet MS"; ctx.fillStyle = rc;
  const upgs = (player.weaponUpgrades||[]).length;
  ctx.fillText(w.name + (upgs > 0 ? "  (+" + upgs + " opgraderinger)" : ""), cx, cy - 132);
  const cardW = 185, cardH = 168, gap = 14;
  const totalW = opts.length * cardW + (opts.length - 1) * gap;
  const sx = cx - totalW/2;
  const curEff = effectiveWeapon(player.weapon, player.weaponUpgrades || []);
  for (let i = 0; i < opts.length; i++) {
    const opt = opts[i], ox = sx + i*(cardW+gap), oy = cy - 78, sel = i === Game.upgradeIdx;
    const nxtEff = effectiveWeapon(player.weapon, [...(player.weaponUpgrades||[]), opt]);
    roundedRect(ox, oy, cardW, cardH, 12);
    ctx.fillStyle = sel ? "rgba(242,193,78,0.16)" : "rgba(255,255,255,0.04)"; ctx.fill();
    ctx.strokeStyle = sel ? "#f2c14e" : "rgba(200,180,120,0.22)"; ctx.lineWidth = sel ? 2 : 1; ctx.stroke();
    ctx.textAlign = "center";
    ctx.font = "bold 12px Trebuchet MS";
    ctx.fillStyle = sel ? "#f2c14e" : "#907860";
    ctx.fillText("[" + (i+1) + "]", ox+cardW/2, oy+22);
    ctx.font = "bold 15px Trebuchet MS";
    ctx.fillStyle = sel ? "#f0e6cf" : "#c8b890";
    ctx.fillText(opt.name, ox+cardW/2, oy+50);
    ctx.font = "11px Trebuchet MS"; ctx.fillStyle = "rgba(200,190,170,0.72)";
    ctx.fillText(opt.desc, ox+cardW/2, oy+70);
    let yy = oy + 96;
    if (opt.effect.dmg)        { ctx.fillStyle="#9bd05a"; ctx.font="12px Trebuchet MS"; ctx.fillText("Skade: " + curEff.dmg + " → " + nxtEff.dmg, ox+cardW/2, yy); yy+=20; }
    if (opt.effect.speedBonus) { ctx.fillStyle="#6ab4ff"; ctx.font="12px Trebuchet MS"; ctx.fillText("Hastighed: " + curEff.speed + " → " + nxtEff.speed + "x", ox+cardW/2, yy); yy+=20; }
    if (opt.effect.range)      { ctx.fillStyle="#f2c14e"; ctx.font="12px Trebuchet MS"; ctx.fillText("Rækkevidde: " + curEff.range + " → " + nxtEff.range + " px", ox+cardW/2, yy); yy+=20; }
  }
  ctx.textAlign = "center"; ctx.font = "11px Trebuchet MS"; ctx.fillStyle = "rgba(180,180,180,0.45)";
  ctx.fillText("◀▶ naviger  ·  E/Enter vælg  ·  1/2/3 direkte  ·  Esc annuller", cx, cy + cardH/2 + 46);
  ctx.restore();
}

// ---------- XP bar ----------
export function drawXpBar() {
  const { player } = state;
  if (!player || !player.level) return;
  const xpNeeded = 60 + player.level * 45;
  const frac = clamp((player.xp||0) / xpNeeded, 0, 1);
  const bx = 20, by = H - 48, bw = 150, bh = 7;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.5)"; roundedRect(bx-6, by-22, bw+12, bh+30, 6); ctx.fill();
  ctx.font = "bold 11px Trebuchet MS"; ctx.textAlign = "left";
  ctx.fillStyle = "#f2c14e"; ctx.fillText("Niveau " + player.level, bx, by-7);
  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = "#9bd05a"; ctx.fillRect(bx, by, bw*frac, bh);
  ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth=1; ctx.strokeRect(bx, by, bw, bh);
  ctx.restore();
}

// ---------- Legendary intro ----------
function drawLegendaryBossHead(intro, cx, cy, size) {
  const t = ENEMY_TYPES[intro.bossType];
  if (!t) return;
  const T = performance.now()/1000;
  const w = size, col = t.color, eye = t.eye;
  ctx.save(); ctx.globalCompositeOperation="lighter";
  const ag=ctx.createRadialGradient(cx,cy,4,cx,cy,w*1.1);
  ag.addColorStop(0,eye); ag.addColorStop(1,"rgba(0,0,0,0)");
  ctx.globalAlpha=0.35+0.12*Math.sin(T*2); ctx.fillStyle=ag;
  ctx.beginPath(); ctx.arc(cx,cy,w*1.1,0,Math.PI*2); ctx.fill(); ctx.restore();
  ctx.fillStyle=col;
  ctx.beginPath(); ctx.ellipse(cx,cy,w*0.55,w*0.65,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=col;
  const hc=5;
  for(let i=0;i<hc;i++){const hx=cx+(i/(hc-1)-0.5)*w*0.9,hh=i%2===0?w*0.45:w*0.3;ctx.beginPath();ctx.moveTo(hx-4,cy-w*0.6);ctx.lineTo(hx,cy-w*0.6-hh);ctx.lineTo(hx+4,cy-w*0.6);ctx.fill();}
  ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.fillStyle=eye;
  ctx.globalAlpha=0.7+0.25*Math.sin(T*4); ctx.beginPath();
  ctx.ellipse(cx-w*0.14,cy-w*0.05,w*0.13,w*0.09,0,0,Math.PI*2); ctx.fill();
  ctx.ellipse(cx+w*0.14,cy-w*0.05,w*0.13,w*0.09,0,0,Math.PI*2); ctx.fill();
  ctx.restore(); ctx.fillStyle=eye;
  ctx.beginPath(); ctx.arc(cx-w*0.14,cy-w*0.05,w*0.05,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+w*0.14,cy-w*0.05,w*0.05,0,Math.PI*2); ctx.fill();
}

export function drawLegendaryIntro() {
  const intro = Game.legendaryIntro;
  if (!intro) return;
  const T = performance.now()/1000;
  intro.timer -= 1/60;
  if (intro.timer <= 0) { Game.legendaryIntro = null; return; }
  const max = intro.maxTimer;
  const slideIn = Math.min(1, (max - intro.timer) / 0.6);
  const fadeOut = intro.timer < 1.2 ? intro.timer / 1.2 : 1;
  const alpha = Math.min(slideIn, fadeOut);
  const yOff = (1 - slideIn) * -220;
  const cx = W/2, panW = Math.min(620, W-40), panH = 200;
  const py = H*0.12 + yOff;

  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle="rgba(6,4,14,0.92)";
  roundedRect(cx-panW/2, py, panW, panH, 16); ctx.fill();
  const ET = ENEMY_TYPES[intro.bossType];
  if (!ET) { Game.legendaryIntro = null; ctx.restore(); return; }
  ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.globalAlpha=0.5*alpha;
  ctx.strokeStyle=ET.eye; ctx.lineWidth=2;
  roundedRect(cx-panW/2, py, panW, panH, 16); ctx.stroke();
  ctx.restore();
  drawLegendaryBossHead(intro, cx-panW/2+110, py+panH/2, 72);
  const tx = cx-panW/2+210;
  ctx.fillStyle="rgba(255,255,255,0.35)"; ctx.font="11px Trebuchet MS"; ctx.textAlign="left";
  ctx.fillText("⚔ LEGENDARISK BOSS ANKOMMER", tx, py+38);
  ctx.fillStyle="#f2c14e"; ctx.font="bold 28px Trebuchet MS";
  ctx.fillText(ET.name, tx, py+74);
  ctx.fillStyle=ET.eye; ctx.font="13px Trebuchet MS";
  ctx.fillText("Dag " + Game.day + "  ·  Specielt angreb: " + (ET.attackName||""), tx, py+98);
  ctx.fillStyle="rgba(240,230,210,0.7)"; ctx.font="12px Trebuchet MS";
  const descs = {
    legend1:"Stamper jorden og sender en shockwave der ødelægger alt inden for 200px.",
    legend2:"Lader op og charger med lynhurtig fart og knuser alt i vejen.",
    legend3:"Udsender en kæmpemæssig tomhedspuls der rammer alt inden for 310px.",
    magmaGolem:"Panserskal af obsidian – ram den glødende kerne når den åbner sig! Knuser mure og efterlader brændende magmasøer.",
  };
  ctx.fillText(descs[intro.bossType]||"", tx, py+120);
  ctx.fillStyle="rgba(255,255,255,0.1)"; roundedRect(tx, py+140, panW-230, 12, 6); ctx.fill();
  ctx.fillStyle=ET.eye;
  const barW=(panW-230)*0.7;
  roundedRect(tx, py+140, barW, 12, 6); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,0.5)"; ctx.font="10px Trebuchet MS"; ctx.textAlign="left";
  ctx.fillText("Liv: " + ET.hp, tx, py+168);
  ctx.restore();
}
