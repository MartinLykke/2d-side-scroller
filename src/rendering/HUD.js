import { CFG, MINE } from '../config/config.js';
import { WEAPONS, RARITY_COL, RARITY_NAME } from '../config/weapons.js';
import { ARMORS, ARMOR_RARITY_COL, ARMOR_RARITY_NAME } from '../config/armor.js';
import { dist, clamp, rand } from '../util/math.js';
import { Game, state } from '../core/state.js';
import { Audio } from '../systems/infrastructure/Audio.js';
import { spawnEnemy, spawnFireDragon, spawnBoss, planNight, floaty, spawnParticles } from '../systems/world/SpawnSystem.js';
import { pick } from '../util/math.js';
import { groundY } from '../core/canvas.js';
import { ARCHER_SKILLS, ARROW_RAIN_COOLDOWN } from '../config/archerSkills.js';
import { GUARD_SKILLS } from '../config/guardSkills.js';
import { makeUnit } from '../entities/Unit.js';
import { saveMeta } from '../systems/infrastructure/RoguelikeSystem.js';
import { equipArmor, unequipArmor } from '../systems/economy/InventorySystem.js';
import { expectedGoldForDay, goldRewardAmount } from '../systems/economy/EconomyBalance.js';
import { addSkillPoints, autoSpendSkillPoints } from '../systems/economy/SkillSystem.js';

// ── Skill Tree ────────────────────────────────────────────────
const BRANCH_NAMES = {
  archer: { 1: "🎯 The Arrow", 2: "🏹 The Bow", 3: "🌲 Tactics" },
  guard: { 1: "🗡️ Spear", 2: "🛡 Shield", 3: "⚔ Tactics" },
};
const SKILL_TREES = { archer: ARCHER_SKILLS, guard: GUARD_SKILLS };

function currentSkillTree() { return Game.skillTreeType || "archer"; }
function skillUnlocked(id) {
  const type = currentSkillTree();
  return type === "guard" ? state.guardSkills.includes(id) : state.archerSkills.includes(id);
}
function skillAvailable(sk) {
  if (skillUnlocked(sk.id)) return false;
  const type = currentSkillTree();
  const points = type === "guard" ? (state.guardSkillPoints || 0) : (state.archerSkillPoints || 0);
  if (points < sk.cost) return false;
  return sk.requires.every(r => skillUnlocked(r));
}

function renderSkillTree() {
  const branchesEl = document.getElementById("st-branches");
  const ultimatesEl = document.getElementById("st-ultimates");
  const ptEl = document.getElementById("st-points");
  const titleEl = document.getElementById("st-title");
  const tabsEl = document.getElementById("st-tabs");
  if (!branchesEl) return;

  const type = currentSkillTree();
  const points = type === "guard" ? (state.guardSkillPoints || 0) : (state.archerSkillPoints || 0);
  ptEl.textContent = `Skill points: ${points}`;

  // Update title
  if (titleEl) {
    const titles = { archer: "🏹 ARCHER SKILL TREE", guard: "🛡️ GUARD SKILL TREE" };
    titleEl.textContent = titles[type];
  }

  // Update tabs
  if (tabsEl) {
    tabsEl.innerHTML = "";
    for (const t of ["archer", "guard"]) {
      const btn = document.createElement("button");
      btn.textContent = t === "archer" ? "🏹 Archer" : "🛡️ Guard";
      btn.style.cssText = `background:${t===type?"rgba(242,193,78,0.2)":"rgba(255,255,255,0.05)"};border:1px solid ${t===type?"#f2c14e":"rgba(255,255,255,0.2)"};color:${t===type?"#f2c14e":"#c8b890"};padding:6px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit;transition:background 0.15s;`;
      btn.onclick = () => { Game.skillTreeType = t; renderSkillTree(); };
      tabsEl.appendChild(btn);
    }
  }

  const skillTree = SKILL_TREES[type];
  const branchNames = BRANCH_NAMES[type];

  // Build 3 branch columns
  const branches = { 1: [], 2: [], 3: [] };
  const ultimates = [];
  for (const sk of Object.values(skillTree)) {
    if (sk.ultimate) ultimates.push(sk);
    else branches[sk.branch].push(sk);
  }
  for (const b of [1, 2, 3]) branches[b].sort((a, b2) => a.row - b2.row);

  branchesEl.innerHTML = "";
  for (const b of [1, 2, 3]) {
    const col = document.createElement("div");
    col.style.cssText = "display:flex;flex-direction:column;gap:8px;";
    const hdr = document.createElement("div");
    hdr.textContent = branchNames[b];
    hdr.style.cssText = "font-size:12px;font-weight:bold;color:#f2c14e;text-align:center;margin-bottom:4px;letter-spacing:1px;";
    col.appendChild(hdr);
    for (const sk of branches[b]) {
      col.appendChild(makeSkillNode(sk));
    }
    branchesEl.appendChild(col);
  }

  ultimatesEl.innerHTML = "";
  const ultHdr = document.createElement("div");
  ultHdr.style.cssText = "grid-column:1/-1;font-size:11px;color:#c069ff;text-align:center;font-weight:bold;letter-spacing:1px;margin-bottom:4px;";
  ultHdr.textContent = "👑 ULTIMATE ABILITIES";
  ultimatesEl.appendChild(ultHdr);
  for (const sk of ultimates) ultimatesEl.appendChild(makeSkillNode(sk));
}

function makeSkillNode(sk) {
  const unlocked = skillUnlocked(sk.id);
  const available = skillAvailable(sk);
  const type = currentSkillTree();
  const skillTree = SKILL_TREES[type];
  const div = document.createElement("div");
  const bg = unlocked ? "rgba(155,208,90,0.15)" : available ? "rgba(242,193,78,0.12)" : "rgba(255,255,255,0.04)";
  const border = unlocked ? "rgba(155,208,90,0.6)" : available ? "rgba(242,193,78,0.5)" : "rgba(255,255,255,0.1)";
  div.style.cssText = `background:${bg};border:1px solid ${border};border-radius:8px;padding:10px 12px;cursor:${available?"pointer":"default"};transition:background 0.15s;position:relative;`;
  div.innerHTML = `
    <div style="font-size:12px;font-weight:bold;color:${unlocked?"#9bd05a":available?"#f2c14e":"#7a6a50"};">${sk.name} ${unlocked?"✓":""}</div>
    <div style="font-size:10px;color:#9a8a70;margin-top:3px;line-height:1.4;">${sk.desc}</div>
    <div style="font-size:10px;margin-top:5px;color:${available?"#f2c14e":"#5a4a38"};">Cost: ${sk.cost} pts${sk.requires.length?" · Requires: "+sk.requires.map(r=>skillTree[r]?.name||r).join(", "):""}</div>
  `;
  if (available) {
    div.onmouseenter = () => div.style.background = "rgba(242,193,78,0.22)";
    div.onmouseleave = () => div.style.background = bg;
    div.onclick = () => {
      if (type === "guard") {
        state.guardSkillPoints -= sk.cost;
        state.guardSkills.push(sk.id);
      } else {
        state.archerSkillPoints -= sk.cost;
        state.archerSkills.push(sk.id);
      }
      autoSpendSkillPoints(type);
      Audio.upgrade();
      renderSkillTree();
    };
  }
  return div;
}

export function openSkillTree() {
  const el = document.getElementById("skill-tree-screen");
  if (!el) return;
  el.classList.remove("hidden");
  el.style.display = "flex";
  Game.skillTreeOpen = true;
  if (Game.state === "play") Game.state = "pause";
  renderSkillTree();
}

export function closeSkillTree() {
  const el = document.getElementById("skill-tree-screen");
  if (!el) return;
  el.classList.add("hidden");
  el.style.display = "";
  Game.skillTreeOpen = false;
  if (Game.state === "pause") Game.state = "play";
}

window._closeSkillTree = closeSkillTree;
window._openSkillTree  = openSkillTree;
window._skipToDusk = () => UI.skipToDusk();

function phaseName() {
  const t=Game.time;
  if (t<=CFG.phases.day)   return "Day";
  if (t<=CFG.phases.dusk)  return "Dusk";
  if (t<=CFG.phases.night) return "Night";
  return "Dawn";
}

function baseName(lvl) { return ["—","Camp","Small Village","Large Village","Castle"][lvl]; }
export { baseName };

export const UI = {
  hud:         document.getElementById("hud"),
  prompt:      document.getElementById("prompt"),
  startScreen: document.getElementById("start-screen"),
  endScreen:   document.getElementById("end-screen"),
  pauseScreen: document.getElementById("pause-screen"),
  muted: false,

  toggleMute() { Audio.init(); this.muted = !Audio.toggle(); },

  skipToDusk() {
    if (Game.state !== "play" || Game.time >= CFG.phases.day) return;
    // Pay out a discounted share of the day's expected income for the skipped time,
    // so skipping is never better than playing the day out.
    const skippedFrac = (CFG.phases.day - Game.time) / CFG.phases.day;
    const gold = goldRewardAmount(expectedGoldForDay() * skippedFrac * 0.45, "passive");
    if (gold > 0) {
      state.player.coins = clamp(state.player.coins + gold, 0, CFG.maxCoinsCarry);
      floaty(state.player.x, "+" + gold + "🪙", "#f2c14e");
    }
    Game.time = CFG.phases.day + 0.005;
    floaty(state.base.x, "→ Dusk 🌆", "#cfe6f2");
  },

  refresh() {
    const { player, base, units, vagrants, stations } = state;
    const ph = phaseName();
    const dayText = ph === "Night" ? "Night " + Game.day : "Day " + Game.day;
    document.getElementById("hud-day-text").textContent = dayText;
    document.getElementById("hud-phase-text").textContent = "";
    document.getElementById("hud-phase-icon").textContent = ph==="Night"?"🌙":ph==="Dusk"?"🌆":ph==="Dawn"?"🌅":"☀";
    document.getElementById("hud-base-text").textContent = "";
    const skipEl = document.getElementById("hud-skipnight");
    if (skipEl) skipEl.style.display = (ph === "Day" && Game.state === "play") ? "" : "none";
    document.getElementById("hud-coins-text").textContent = player.coins;
    document.getElementById("hud-hp-text").textContent    = "";

    let arch = 0, build = 0;
    for (let i = 0; i < units.length; i++) {
      const r = units[i].role;
      if (r === "archer") arch++;
      else if (r === "builder") build++;
    }
    const popCap = CFG.popCapByLevel[base.level];
    document.getElementById("hud-pop-text").textContent   = (units.length + vagrants.length) + "/" + popCap;
    document.getElementById("hud-arch-text").textContent  = arch;
    document.getElementById("hud-build-text").textContent = build;

    let obj = "🎯 Survive as long as you can. Threat level " + (Game.threatLevel || Game.day);
    if (base.level<4) obj += " · upgrade the base ("+base.level+"/4)";
    else obj += " · the castle stands";
    if (Game.isNight) {
      let activeEnemies = 0;
      for (let i = 0; i < state.enemies.length; i++) if (!state.enemies[i].fleeing) activeEnemies++;
      obj="🌙 NIGHT — "+(Game.nightQuota-activeEnemies>0?"the horde attacks!":"hold the line!");
    }
    document.getElementById("hud-objective").textContent = obj;

    const wEl=document.getElementById("hud-weapon-text"), wPill=document.getElementById("hud-weapon");
    if (player.weapon) {
      const w=WEAPONS[player.weapon];
      const upgs=(player.weaponUpgrades||[]).length;
      wEl.textContent=w.name+" · Lvl "+(1+upgs)+" ("+RARITY_NAME[w.rarity]+")";
      wPill.style.borderColor=RARITY_COL[w.rarity]+"99";
      wPill.style.color=RARITY_COL[w.rarity];
    } else { wEl.textContent=""; wPill.style.borderColor=""; wPill.style.color=""; }

    const aEl=document.getElementById("hud-armor-text"), aPill=document.getElementById("hud-armor");
    if (aEl && aPill) {
      if (player.armor && ARMORS[player.armor]) {
        const a=ARMORS[player.armor];
        aEl.textContent=a.name+" ("+ARMOR_RARITY_NAME[a.rarity]+") +" +a.defense+"🛡";
        aPill.style.borderColor=ARMOR_RARITY_COL[a.rarity]+"99";
        aPill.style.color=ARMOR_RARITY_COL[a.rarity];
      } else { aEl.textContent=""; aPill.style.borderColor=""; aPill.style.color=""; }
    }


    document.getElementById("hud-base").classList.add("hidden");
    document.getElementById("hud-objective").classList.add("hidden");
    document.getElementById("hud-hp").classList.add("hidden");
    document.getElementById("hud-weapon").classList.add("hidden");
    document.getElementById("hud-armor").classList.add("hidden");
    document.getElementById("hud-pop").classList.add("hidden");
    const spEl = document.getElementById("hud-skillpts");
    if (spEl) spEl.style.display = "none";
    const rainEl = document.getElementById("hud-arrow-rain");
    if (rainEl) {
      const unlocked = state.archerSkills.includes("barrage");
      rainEl.classList.toggle("hidden", !unlocked);
      if (unlocked) {
        const cd = Math.max(0, state.arrowRainCd || 0);
        const ready = cd <= 0;
        const cdEl = document.getElementById("hud-arrow-rain-cd");
        const fillEl = document.getElementById("hud-arrow-rain-fill");
        rainEl.classList.toggle("ready", ready);
        if (cdEl) cdEl.textContent = ready ? "Ready" : Math.ceil(cd) + "s";
        if (fillEl) fillEl.style.width = (ready ? 100 : (1 - cd / ARROW_RAIN_COOLDOWN) * 100) + "%";
      }
    }

    let near=null, nd=CFG.payRange;
    for (const s of stations) { if (!!s.mineLayer!==Game.inMine) continue; const c=s.cost(); if (c<=0) continue; const d=dist(player.x,s.x()); if (d<nd) { nd=d; near=s; } }
    const vagNear=!Game.inMine&&state.vagrants.find(v=>dist(player.x,v.x)<46&&Math.abs(v.vx)<1);
    const lootNear=!Game.inMine&&state.lootItems&&state.lootItems.find(it=>dist(player.x,it.x)<50);
    const shopSt=stations.find(s=>s.id==="shop");
    const nearShop=!Game.inMine&&shopSt&&state.base.level>=4&&dist(player.x,shopSt.x())<100;
    const mineLadderNear=state.mineBuilt&&dist(player.x,MINE.entranceX)<70;
    if (near) {
      this.prompt.classList.remove("hidden");
      const prog=near.paid>0?` (${near.paid}/${near.cost()})` : "";
      this.prompt.innerHTML=`${near.label()} &nbsp;<span class="cost">${near.cost()}🪙</span>${prog} &nbsp;<span class="hold">hold ↓/S</span>`;
    } else if (mineLadderNear) {
      this.prompt.classList.remove("hidden");
      this.prompt.innerHTML=Game.inMine
        ? `Climb out of the mine &nbsp;<span class="hold">press F</span>`
        : `⛏ Go down into the mine &nbsp;<span class="hold">press F</span>`;
    } else if (vagNear) {
      this.prompt.classList.remove("hidden");
      this.prompt.innerHTML=`Recruit subject &nbsp;<span class="cost">1🪙</span> &nbsp;<span class="hold">hold ↓/S</span>`;
    } else if (lootNear) {
      this.prompt.classList.remove("hidden");
      const w=WEAPONS[lootNear.weaponId];
      const lootLvl=(lootNear.upgrades&&lootNear.upgrades.length)?` · Lvl ${1+lootNear.upgrades.length}`:"";
      this.prompt.innerHTML=`Pick up: ${w.name}${lootLvl} &nbsp;<span class="hold">press F</span>`;
    } else if (nearShop && !Game.shopOpen) {
      this.prompt.classList.remove("hidden");
      this.prompt.innerHTML=`B - Open shop 🏪`;
    } else {
      this.prompt.classList.add("hidden");
    }
  },
};

function renderDevWeaponButtons() {
  const row = document.getElementById("dev-weapon-buttons");
  if (!row) return;
  const dropButton = row.querySelector(".dev-danger");
  row.innerHTML = "";
  for (const [weaponId, weapon] of Object.entries(WEAPONS)) {
    const btn = document.createElement("button");
    btn.className = "dev-btn";
    btn.textContent = weapon.name;
    btn.title = RARITY_NAME[weapon.rarity] + " " + weapon.type;
    btn.style.color = RARITY_COL[weapon.rarity];
    btn.style.borderColor = RARITY_COL[weapon.rarity] + "80";
    btn.onclick = () => DEV.giveWeapon(weaponId);
    row.appendChild(btn);
  }
  if (dropButton) row.appendChild(dropButton);
}

function renderDevArmorButtons() {
  const row = document.getElementById("dev-armor-buttons");
  if (!row) return;
  const removeButton = row.querySelector(".dev-danger");
  row.innerHTML = "";
  for (const [armorId, armor] of Object.entries(ARMORS)) {
    const btn = document.createElement("button");
    btn.className = "dev-btn";
    btn.textContent = armor.name;
    btn.title = ARMOR_RARITY_NAME[armor.rarity] + " · +" + armor.defense + " defense";
    btn.style.color = ARMOR_RARITY_COL[armor.rarity];
    btn.style.borderColor = ARMOR_RARITY_COL[armor.rarity] + "80";
    btn.onclick = () => DEV.giveArmor(armorId);
    row.appendChild(btn);
  }
  if (removeButton) row.appendChild(removeButton);
}

// ---- Dev tools (exposed on window so inline onclick= buttons work) ----
export const DEV = {
  godMode:   false,
  speedMult: 1,
  _fps:      60,

  toggle() { document.getElementById("dev-panel").classList.toggle("hidden"); },

  addCoins(n) {
    if (Game.state!=="play") return;
    state.player.coins=clamp(state.player.coins+n,0,CFG.maxCoinsCarry);
    floaty(state.player.x,"+"+n+"🪙","#f2c14e");
  },

  give1000Gold() {
    if (Game.state!=="play") return;
    state.player.coins+=1000;
    floaty(state.player.x,"+1000🪙","#f2c14e");
  },

  addEmbers(n) {
    Game.meta = Game.meta || { embers: 0, upgrades: {}, totalRuns: 0, bestDay: 1, totalKills: 0, lastReward: 0, lastDay: 1, lastKills: 0 };
    Game.meta.embers = (Game.meta.embers || 0) + n;
    saveMeta();
    const x = state.player ? state.player.x : 0;
    floaty(x,"+"+n+"🔥","#8fd8ff");
  },

  resetUpgrades() {
    if (!Game.meta) return;
    Game.meta.upgrades = {};
    saveMeta();
    const x = state.player ? state.player.x : 0;
    floaty(x,"Upgrades reset","#ff8a6a");
  },

  skipToNight() {
    if (Game.state!=="play") return;
    Game.time=CFG.phases.dusk+0.005;
    floaty(state.base.x,"→ Night 🌙","#cfe6f2");
  },

  skipToDay() {
    if (Game.state!=="play") return;
    Game.time=0.02; Game.day++; planNight();
    if (state.enemies) state.enemies.forEach(e=>e.fleeing=true);
    floaty(state.base.x,"→ Day ☀","#f2c14e");
  },

  _jumpToDay(n) {
    if (Game.state!=="play") return;
    if (Game.day >= n) { floaty(state.base.x,"Already day "+Game.day,"#ff8a6a"); return; }
    Game.day = n - 1;
    Game.time = 0.02;
    planNight();
    if (state.enemies) state.enemies.forEach(e=>e.fleeing=true);
    // Queue night immediately
    Game.time = CFG.phases.dusk + 0.005;
    floaty(state.base.x,"→ Day "+n+" 📅","#f2c14e");
  },
  skipToDay10() { this._jumpToDay(10); },
  skipToDay15() { this._jumpToDay(15); },
  skipToDay20() { this._jumpToDay(20); },

  upgradeBase() {
    if (Game.state!=="play"||state.base.level>=4) return;
    // call the upgradeBase exported from game.js via window
    window._upgradeBase?.();
  },

  maxBaseLevel() {
    if (Game.state!=="play") return;
    while (state.base.level < 4) {
      window._upgradeBase?.();
    }
    floaty(state.base.x, "🏰 Max level reached!", "#f2c14e");
  },

  maxWallLevels() {
    if (Game.state!=="play") return;
    const { walls } = state;
    if (!walls || walls.length === 0) {
      floaty(state.base.x, "No walls to upgrade", "#ff8a6a");
      return;
    }
    for (const w of walls) {
      w.commissioned = true;
      w.level = 5;
      w.maxHp = CFG.wallHp[5];
      w.hp = w.maxHp;
      w.buildProgress = 1;
    }
    floaty(state.base.x, "⬆ All walls → max level!", "#9bd05a");
  },

  healAll() {
    if (Game.state!=="play") return;
    state.player.hp=state.player.maxHp; state.base.hp=state.base.maxHp;
    state.units.forEach(u=>u.hp=u.maxHp);
    state.walls.forEach(w=>{ if (w.commissioned&&w.buildProgress>=1) w.hp=w.maxHp; });
    floaty(state.base.x,"💚 Healed!","#9bd05a");
  },

  spawnEnemyNearBase(type) {
    if (Game.state!=="play") return;
    const portal = { x: state.base.x + pick([-1, 1]) * 750, side: pick([-1, 1]) };
    spawnEnemy(type, portal);
    floaty(state.base.x, "👹 " + type + "!","#ff6a4a");
  },

  spawn8ImpsRight() {
    if (Game.state!=="play") return;
    for (let i = 0; i < 8; i++) {
      const portal = { x: state.base.x + 750 + i * 120, side: 1 };
      spawnEnemy("imp", portal);
    }
    floaty(state.base.x, "👹 8x Imp!","#ff6a4a");
  },

  spawnFireImpsRight() {
    if (Game.state!=="play") return;
    for (let i = 0; i < 4; i++) {
      const portal = { x: state.base.x + 780 + i * 140, side: 1 };
      spawnEnemy("fireImp", portal);
    }
    floaty(state.base.x, "4x Flying Imp!", "#ff6a20");
  },

  spawnFireDragonBoss() {
    if (Game.state!=="play") return;
    const side = pick([-1, 1]);
    spawnFireDragon({ x: state.base.x + side * 900, side });
  },

  spawnMagmaGolemBoss() {
    if (Game.state!=="play") return;
    const side = pick([-1, 1]);
    spawnBoss("magmaGolem", { x: state.base.x + side * 720, side });
  },

  spawnAnimalNearBase(type) {
    if (Game.state!=="play") return;
    const x = state.base.x + pick([-1, 1]) * rand(200, 400);
    const a = {
      x, vx: 0, dir: pick([-1, 1]),
      state: "graze", stateT: rand(2, 5), alive: true, anim: rand(0, 6),
      flee: 0, fleeT: 0, type,
      eatDown: 0, headT: rand(1, 3), scan: 0, earFlick: 0,
      dying: false, deathT: 0,
    };
    if (type === "duck") { a.fy = 0; a.flyTargetX = null; a.cruiseFy = 0; a.wingStretch = 0; }
    if (type === "bear") { a.hp = 12; a.maxHp = 12; a.attackCd = 0; a.attackAnim = 0; a.flash = 0; a.chargeCd = 0; a.charging = 0; }
    state.animals.push(a);
    const names = { deer: "🦌 Deer", rabbit: "🐇 Rabbit", duck: "🦆 Duck", bear: "🐻 Bear" };
    floaty(state.base.x, (names[type]||type) + "!", "#9bd05a");
  },

  killAll() {
    if (Game.state!=="play") return;
    const n=state.enemies.length; state.enemies.length=0;
    floaty(state.base.x,"💀 "+n+" enemies!","#f2c14e");
  },

  toggleGodMode() {
    this.godMode=!this.godMode;
    window._DEV_GOD_MODE=this.godMode;
    const btn=document.getElementById("dev-god-btn");
    btn.textContent="God mode: "+(this.godMode?"🟢 ON":"⚫ OFF");
    btn.classList.toggle("dev-active",this.godMode);
    if (state.player) floaty(state.player.x,this.godMode?"🛡 Invulnerable":"🛡 Vulnerable again","#cfe6f2");
  },

  setSpeed(mult) {
    this.speedMult=mult;
    document.querySelectorAll(".dev-speed-btn").forEach(b=>b.classList.remove("dev-active"));
    document.getElementById("dev-spd-"+mult).classList.add("dev-active");
  },

  giveWeapon(weaponId) {
    if (Game.state!=="play") return;
    window._pickupWeapon?.(weaponId);
  },

  giveArmor(armorId) {
    if (Game.state!=="play"||!state.player||!ARMORS[armorId]) return;
    equipArmor(armorId);
    floaty(state.player.x, ARMORS[armorId].name + " equipped 🛡", "#9bd05a");
  },

  removeArmor() {
    if (Game.state!=="play"||!state.player) return;
    if (unequipArmor()) floaty(state.player.x, "Armor stored in inventory", "#c8c8c8");
  },

  dropWeapon() {
    if (Game.state!=="play"||!state.player) return;
    if (state.player.weapon) {
      state.lootItems.push({ x:state.player.x+20, weaponId:state.player.weapon, upgrades:state.player.weaponUpgrades||[] });
      state.player.weapon=null;
      state.player.weaponUpgrades=[];
      floaty(state.player.x,"Weapon dropped","#c8c8c8");
    }
  },

  spawnUnit(role) {
    if (Game.state!=="play") return;
    if (role === "miner" && !state.mineBuilt) {
      floaty(state.base.x, "Build the mine first (base lvl 3)", "#ff8a6a");
      return;
    }
    const popCap = CFG.popCapByLevel[state.base.level];
    if (state.units.length + state.vagrants.length >= popCap) {
      floaty(state.base.x,"Population cap reached","#ff8a6a");
      return;
    }
    const x = role === "miner" ? MINE.stationX + pick([-1, 1]) * 30 : state.base.x + pick([-1, 1]) * 120;
    const u = makeUnit(role, x);
    state.units.push(u);
    const roleNames = { archer: "🏹 Archer", builder: "🔨 Builder", farmer: "🌾 Farmer", guard: "🛡 Guard", miner: "⛏ Miner" };
    floaty(state.base.x, roleNames[role] + " born!", "#9bd05a");
  },

  levelUpUnits(role, levels = 1) {
    if (Game.state!=="play") return;
    const targets = state.units.filter(u => u.role === role);
    if (!targets.length) {
      floaty(state.base.x, "No " + (role === "archer" ? "archers" : "guards"), "#ff8a6a");
      return;
    }
    for (const u of targets) {
      u.level = (u.level || 1) + levels;
      u.xp = 0;
      floaty(u.x, "⬆ Lvl " + u.level + "!", "#f2c14e");
      spawnParticles(u.x, groundY - 30, 8, "#f2c14e", 50, 80);
    }
    const pts = targets.length * levels;
    addSkillPoints(role, pts);
    floaty(state.base.x, "+" + pts + " skill points", "#9bd05a");
  },

  // Grant every archer skill at once (or pass a list of ids to test specific ones)
  grantArcherSkills(ids = null) {
    if (Game.state!=="play") return;
    state.archerSkills = ids || Object.keys(ARCHER_SKILLS);
    floaty(state.base.x, "🏹 Archer skills granted!", "#9bd05a");
  },

  addSkillPoints(n) {
    if (Game.state!=="play") return;
    addSkillPoints("archer", n);
    addSkillPoints("guard", n);
    floaty(state.base.x, "+" + n + " skill points", "#9bd05a");
  },

};

// Expose DEV globally so index.html onclick= attributes still work
window.DEV = DEV;
renderDevWeaponButtons();
renderDevArmorButtons();
