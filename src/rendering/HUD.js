import { CFG } from '../config/config.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { WEAPONS, RARITY_COL, RARITY_NAME } from '../config/weapons.js';
import { ARMORS, ARMOR_RARITY_COL, ARMOR_RARITY_NAME } from '../config/armor.js';
import { dist, clamp } from '../util/math.js';
import { Game, state } from '../core/state.js';
import { inject, provide } from '../core/services.js';
import { Audio } from '../systems/infrastructure/Audio.js';
import { spawnEnemy, spawnBoss, planNight, floaty, spawnParticles } from '../systems/world/SpawnSystem.js';
import { pick } from '../util/math.js';
import { groundY } from '../core/canvas.js';
import { ARCHER_SKILLS, ARROW_RAIN_COOLDOWN } from '../config/archerSkills.js';
import { GUARD_SKILLS } from '../config/guardSkills.js';
import { makeUnit } from '../entities/Unit.js';
import { saveMeta } from '../systems/infrastructure/RoguelikeSystem.js';
import { equipArmor, unequipArmor } from '../systems/economy/InventorySystem.js';
import { MOUNTS } from '../config/mounts.js';
import { acquireMount, toggleMount } from '../systems/economy/MountSystem.js';
import { expectedGoldForDay, goldRewardAmount } from '../systems/economy/EconomyBalance.js';
import { addSkillPoints, autoSpendSkillPoints } from '../systems/economy/SkillSystem.js';
import { profilerEnabled, setProfilerEnabled, profilerResults, profilerFrameMs, profilerReset } from '../util/Profiler.js';
import { canOpenCastleUpgrades } from '../systems/economy/CastleUpgradeSystem.js';
import { currentCoinCap, currentPopCap, wallMaxHpForLevel } from '../util/DefenseStats.js';
import { generateProceduralWeapon } from '../systems/economy/ProceduralWeaponSystem.js';

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


function phaseName() {
  const t=Game.time;
  if (t<=CFG.phases.day)   return "Day";
  if (t<=CFG.phases.dusk)  return "Dusk";
  if (t<=CFG.phases.night) return "Night";
  return "Dawn";
}

function canSkipToDusk() {
  if (Game.state !== "play") return false;
  return Game.time < CFG.phases.day || Game.nightCleared || Game.time > CFG.phases.night;
}

function advanceToNextDayForSkip() {
  Game.day++;
  Game.time = 0.02;
  Game.isNight = false;
  Game.nightCleared = false;
  Game.nightPortalWarnT = 0;
  if (state.enemies) state.enemies.forEach(e => { e.fleeing = true; });
  Audio.setNight(false);
  planNight();
}

// Roster pill: one entry per unit role (plus vagrants); empty roles fade back.
function setRosterCount(key, count, text) {
  const el = document.getElementById("hud-roster-" + key);
  if (!el) return;
  el.textContent = text !== undefined ? text : count;
  if (el.parentElement) el.parentElement.classList.toggle("is-empty", count <= 0);
}

function baseName(lvl) { return ["—","Camp","Small Village","Large Village","Castle","Fortress","Citadel","Royal Capital"][lvl]; }
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
    if (!canSkipToDusk()) return;
    const fromPostNight = Game.nightCleared || Game.time > CFG.phases.night;
    if (fromPostNight) advanceToNextDayForSkip();

    // Pay out a discounted share of the day's expected income for the skipped time,
    // so skipping is never better than playing the day out.
    const skippedFrac = clamp((CFG.phases.day - Game.time) / CFG.phases.day, 0, 1);
    const gold = goldRewardAmount(expectedGoldForDay() * skippedFrac * 0.45, "passive");
    if (gold > 0) {
      state.player.coins = clamp(state.player.coins + gold, 0, currentCoinCap());
      floaty(state.player.x, "+" + gold + "🪙", "#f2c14e");
    }
    Game.time = CFG.phases.day + 0.005;
    floaty(state.base.x, "→ Dusk 🌆", "#cfe6f2");
  },

  refresh() {
    const { player, base, units, vagrants, stations } = state;
    if (Game.castleOpen) {
      this.hud.classList.add("hidden");
      this.prompt.classList.add("hidden");
      return;
    }
    this.hud.classList.remove("hidden");
    const ph = phaseName();
    let dayText = ph === "Night" ? "Night " + Game.day : "Day " + Game.day;
    if ((Game.worldPhase || 1) >= 2) dayText = "Phase II · " + dayText;
    document.getElementById("hud-day-text").textContent = dayText;
    document.getElementById("hud-phase-text").textContent = "";
    document.getElementById("hud-phase-icon").textContent = ph==="Night"?"🌙":ph==="Dusk"?"🌆":ph==="Dawn"?"🌅":"☀";
    document.getElementById("hud-base-text").textContent = "";
    const skipEl = document.getElementById("hud-skipnight");
    if (skipEl) skipEl.style.display = canSkipToDusk() ? "" : "none";
    document.getElementById("hud-coins-text").textContent = player.coins;
    document.getElementById("hud-hp-text").textContent    = "";

    let arch = 0, build = 0, guards = 0, farmers = 0, clerics = 0;
    for (let i = 0; i < units.length; i++) {
      const r = units[i].role;
      if (r === "archer") arch++;
      else if (r === "builder") build++;
      else if (r === "guard") guards++;
      else if (r === "farmer") farmers++;
      else if (r === "cleric") clerics++;
    }
    const popCap = currentPopCap(base.level);
    document.getElementById("hud-pop-text").textContent   = (units.length + vagrants.length) + "/" + popCap;
    document.getElementById("hud-arch-text").textContent  = arch;
    document.getElementById("hud-build-text").textContent = build;
    setRosterCount("pop", units.length + vagrants.length, (units.length + vagrants.length) + "/" + popCap);
    setRosterCount("archer", arch);
    setRosterCount("guard", guards);
    setRosterCount("builder", build);
    setRosterCount("farmer", farmers);
    setRosterCount("cleric", clerics);
    setRosterCount("vagrant", vagrants.length);

    let obj = "🎯 Survive as long as you can. Threat level " + (Game.threatLevel || Game.day);
    if (base.level<CFG.maxBaseLevel) obj += " · upgrade the base ("+base.level+"/"+CFG.maxBaseLevel+")";
    else obj += " · the royal capital stands";
    if (!Game.isNight && !state.assault && (Game.worldPhase || 1) === 1 && arch + guards > 0) {
      obj += " · G: assault a portal";
    }
    if (Game.isNight) {
      let activeEnemies = 0;
      for (let i = 0; i < state.enemies.length; i++) if (!state.enemies[i].fleeing) activeEnemies++;
      obj="🌙 NIGHT — "+(Game.nightQuota-activeEnemies>0?"the horde attacks!":"hold the line!");
    }
    if (state.assault) {
      const a = state.assault, p = a.portal;
      if (a.phase === "celebrate" || a.phase === "return") {
        obj = "🎉 The portal has fallen! The army returns home";
      } else if (p.hp !== undefined && p.hp < p.maxHp) {
        obj = "⚔ ASSAULT — destroy the portal! " + Math.max(0, Math.ceil(p.hp)) + "/" + p.maxHp;
      } else {
        obj = "⚔ ASSAULT — the army marches on the portal!";
      }
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
    // The objective banner stays tucked away except while an assault runs
    document.getElementById("hud-objective").classList.toggle("hidden", !state.assault);
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
    for (const s of stations) { const c=s.cost(); if (c<=0) continue; const d=dist(player.x,s.x()); if (d<nd) { nd=d; near=s; } }
    const vagNear=state.vagrants.find(v=>dist(player.x,v.x)<46&&Math.abs(v.vx)<1);
    const lootNear=state.lootItems&&state.lootItems.find(it=>dist(player.x,it.x)<50);
    const shopSt=stations.find(s=>s.id==="shop");
    const nearShop=shopSt&&state.base.level>=2&&dist(player.x,shopSt.x())<100;
    const nearCastleUpgrades=canOpenCastleUpgrades();
    if (near) {
      this.prompt.classList.remove("hidden");
      const prog=near.paid>0?` (${near.paid}/${near.cost()})` : "";
      const action=near.instantPurchase ? "press \u2193/S" : "hold \u2193/S";
      const castleHint=near.id==="base"&&nearCastleUpgrades ? ` &nbsp;<span class="hold">C: castle upgrades</span>` : "";
      this.prompt.innerHTML=`${near.label()} &nbsp;<span class="cost">${near.cost()}\u{1FA99}</span>${prog} &nbsp;<span class="hold">${action}</span>${castleHint}`;
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
    } else if (nearCastleUpgrades && !Game.castleOpen) {
      this.prompt.classList.remove("hidden");
      this.prompt.innerHTML=`Castle upgrades &nbsp;<span class="hold">press C</span>`;
    } else if (!state.assault && (Game.worldPhase || 1) === 1 && !Game.isNight
        && state.portals.some(p => !p.destroyed && dist(player.x, p.x) < 520)) {
      this.prompt.classList.remove("hidden");
      this.prompt.innerHTML=`⚔ Sound the war horn — send the army against this portal &nbsp;<span class="hold">press G</span>`;
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
  const typeLabels = { magic: "Magic" };
  for (const type of ["magic"]) {
    const weapons = Object.entries(WEAPONS).filter(([, weapon]) => weapon.type === type && !weapon.generated);
    if (!weapons.length) continue;
    const group = document.createElement("div");
    group.className = "dev-subsection";
    const label = document.createElement("div");
    label.className = "dev-mini-label";
    label.textContent = typeLabels[type] || type;
    const buttons = document.createElement("div");
    buttons.className = "dev-row";
    for (const [weaponId, weapon] of weapons) {
      const btn = document.createElement("button");
      btn.className = "dev-btn";
      btn.textContent = weapon.name;
      btn.title = RARITY_NAME[weapon.rarity] + " " + weapon.type;
      btn.style.color = RARITY_COL[weapon.rarity];
      btn.style.borderColor = RARITY_COL[weapon.rarity] + "80";
      btn.onclick = () => DEV.giveWeapon(weaponId);
      buttons.appendChild(btn);
    }
    group.append(label, buttons);
    row.appendChild(group);
  }
  if (dropButton) row.appendChild(dropButton);
}

function renderDevArmorButtons() {
  const row = document.getElementById("dev-armor-buttons");
  if (!row) return;
  const removeButton = row.querySelector(".dev-danger");
  row.innerHTML = "";
  for (const rarity of [0, 1, 2, 3, 4]) {
    const armors = Object.entries(ARMORS).filter(([, armor]) => armor.rarity === rarity);
    if (!armors.length) continue;
    const group = document.createElement("div");
    group.className = "dev-subsection";
    const label = document.createElement("div");
    label.className = "dev-mini-label";
    label.textContent = ARMOR_RARITY_NAME[rarity];
    label.style.color = ARMOR_RARITY_COL[rarity];
    const buttons = document.createElement("div");
    buttons.className = "dev-row";
    for (const [armorId, armor] of armors) {
      const btn = document.createElement("button");
      btn.className = "dev-btn";
      btn.textContent = armor.name;
      btn.title = ARMOR_RARITY_NAME[armor.rarity] + " · +" + armor.defense + " defense";
      btn.style.color = ARMOR_RARITY_COL[armor.rarity];
      btn.style.borderColor = ARMOR_RARITY_COL[armor.rarity] + "80";
      btn.onclick = () => DEV.giveArmor(armorId);
      buttons.appendChild(btn);
    }
    group.append(label, buttons);
    row.appendChild(group);
  }
  if (removeButton) row.appendChild(removeButton);
}

function renderDevMountButtons() {
  const row = document.getElementById("dev-mount-buttons");
  if (!row) return;
  const stableButton = row.querySelector(".dev-danger");
  row.innerHTML = "";
  const buttons = document.createElement("div");
  buttons.className = "dev-row";
  for (const [mountId, mount] of Object.entries(MOUNTS)) {
    const btn = document.createElement("button");
    btn.className = "dev-btn";
    btn.textContent = mount.name;
    btn.title = "+" + Math.round((mount.speedMult - 1) * 100) + "% move speed";
    btn.style.color = mount.col;
    btn.style.borderColor = mount.col + "80";
    btn.onclick = () => DEV.giveMount(mountId);
    buttons.appendChild(btn);
  }
  row.appendChild(buttons);
  if (stableButton) row.appendChild(stableButton);
}


// ---- Dev tools ----
export const DEV = {
  godMode:   false,
  speedMult: 1,
  _fps:      60,
  _fpsUiElapsed: 0,

  toggle() {
    const panel = document.getElementById("dev-panel");
    if (!panel) return;
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) this._renderPanel();
  },

  updateFps(frameDt) {
    if (!Number.isFinite(frameDt) || frameDt <= 0) return;
    const instantFps = Math.min(240, 1 / frameDt);
    this._fps += (instantFps - this._fps) * Math.min(1, frameDt * 8);

    const panel = document.getElementById("dev-panel");
    if (!panel || panel.classList.contains("hidden")) return;
    this._fpsUiElapsed += frameDt;
    if (this._fpsUiElapsed >= 0.2) {
      this._fpsUiElapsed = 0;
      this._renderPanel();
    }
  },

  _renderPanel() {
    this._renderProfiler();
  },



  addCoins(n) {
    if (Game.state!=="play"||!state.player) return;
    n = Math.max(0, Math.floor(Number(n) || 0));
    if (n <= 0) return;
    state.player.coins=Math.max(0,(state.player.coins||0)+n);
    floaty(state.player.x,"+"+n+"🪙","#f2c14e");
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

  clearLeaderboard() {
    Game.meta = Game.meta || { embers: 0, upgrades: {}, totalRuns: 0, bestDay: 1, totalKills: 0, lastReward: 0, lastDay: 1, lastKills: 0 };
    Game.meta.leaderboard = [];
    Game.meta.lastLeaderboardEntryId = null;
    Game.meta.lastLeaderboardRank = 0;
    saveMeta();
    const x = state.player ? state.player.x : 0;
    floaty(x,"Leaderboard cleared","#ff8a6a");
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
    if (Game.state!=="play"||state.base.level>=CFG.maxBaseLevel) return;
    inject('upgradeBase')?.();
  },

  maxBaseLevel() {
    if (Game.state!=="play") return;
    while (state.base.level < CFG.maxBaseLevel) {
      inject('upgradeBase')?.();
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
      w.maxHp = wallMaxHpForLevel(5);
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

  _spawnBossDev(type, distance) {
    if (Game.state!=="play") return;
    const side = pick([-1, 1]);
    const boss = spawnBoss(type, { x: state.base.x + side * distance, side });
    const bossType = ENEMY_TYPES[type];
    state.legendaryBoss = boss;
    Game.legendaryIntro = { timer: 4.6, maxTimer: 4.6, bossType: type };
    floaty(boss.x, bossType?.name || type, bossType?.eye || "#ff6a4a", 18);
    return boss;
  },

  spawnForestStalkerBoss() {
    return this._spawnBossDev("forestStalker", 940);
  },

  spawnFireDragonBoss() {
    return this._spawnBossDev("fireDragon", 900);
  },

  spawnMagmaGolemBoss() {
    return this._spawnBossDev("magmaGolem", 720);
  },

  spawnPyreTyrantBoss() {
    return this._spawnBossDev("pyreTyrant", 780);
  },



  // Dynamic import keeps HUD out of the AssaultSystem module graph
  startAssaultDev() {
    if (Game.state!=="play") return;
    import('../systems/world/AssaultSystem.js').then(m => m.startAssault());
  },

  crackPortals() {
    if (Game.state!=="play") return;
    let cracked = 0;
    for (const p of state.portals) {
      if (p.destroyed || p.voidRift) continue;
      if (p.maxHp === undefined) p.maxHp = CFG.portalHp + (Game.day - 1) * CFG.portalHpPerDay;
      p.hp = 10;
      cracked++;
    }
    floaty(state.base.x, cracked ? "Portals cracked to 10 hp" : "No portals to crack", cracked ? "#cfe6f2" : "#ff8a6a");
  },

  beginPhase2() {
    if (Game.state!=="play" || (Game.worldPhase||1) >= 2 || Game.phaseTransition) return;
    Game.phaseTransition = { t: 0, swapped: false };
  },



  killAll() {
    if (Game.state!=="play") return;
    const n=state.enemies.length; state.enemies.length=0;
    floaty(state.base.x,"💀 "+n+" enemies!","#f2c14e");
  },

  toggleGodMode() {
    this.godMode=!this.godMode;
    provide('godMode', this.godMode);
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
    inject('pickupWeapon')?.(weaponId);
  },

  spawnGeneratedWeapon() {
    if (Game.state!=="play"||!state.player) return;
    const { id, def } = generateProceduralWeapon();
    inject('pickupWeapon')?.(id);
    floaty(state.player.x, "🎲 " + def.name, RARITY_COL[def.rarity], 16);
    spawnParticles(state.player.x, groundY - 40, 16, def.col, 90, 130);
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

  giveMount(mountId) {
    if (Game.state!=="play"||!state.player||!MOUNTS[mountId]) return;
    acquireMount(mountId);
  },

  stableMount() {
    if (Game.state!=="play"||!state.player||!state.player.mountId) return;
    toggleMount(state.player.mountId); // dismounts the current steed
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
    const popCap = currentPopCap();
    if (state.units.length + state.vagrants.length >= popCap) {
      floaty(state.base.x,"Population cap reached","#ff8a6a");
      return;
    }
    const x = state.base.x + pick([-1, 1]) * 120;
    const u = makeUnit(role, x);
    state.units.push(u);
    const roleNames = { archer: "🏹 Archer", builder: "🔨 Builder", farmer: "🌾 Farmer", guard: "🛡 Guard", cleric: "✨ Cleric" };
    floaty(state.base.x, (roleNames[role] || role) + " born!", "#9bd05a");
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

  triggerWeaponUpgrade() {
    if (Game.state!=="play"||!state.player||!state.player.weapon) {
      if (state.player) floaty(state.player.x, "No weapon equipped", "#ff8a6a");
      return;
    }
    state.player.pendingUpgrade = true;
    floaty(state.player.x, "⬆ Upgrade available!", "#f2c14e");
  },

  toggleProfiler() {
    const on = !profilerEnabled();
    setProfilerEnabled(on);
    if (!on) {
      profilerReset();
      const el = document.getElementById("dev-profiler");
      if (el) el.remove();
    }
    const btn = document.getElementById("dev-profiler-btn");
    if (btn) {
      btn.textContent = "Profiler: " + (on ? "🟢 ON" : "⚫ OFF");
      btn.classList.toggle("dev-active", on);
    }
  },

  _profilerRows: new Map(),
  _profilerOrder: [],

  _renderProfiler() {
    if (!profilerEnabled()) return;

    let el = document.getElementById("dev-profiler");
    if (!el) {
      el = document.createElement("div");
      el.id = "dev-profiler";
      el.style.cssText = [
        "position:fixed", "bottom:12px", "left:12px", "z-index:9999",
        "width:360px", "max-height:50vh", "overflow-y:auto",
        "padding:10px 12px", "border-radius:8px",
        "background:rgba(8,6,18,0.88)", "border:1px solid rgba(155,208,90,0.25)",
        "backdrop-filter:blur(8px)",
        "font-size:11px", "font-family:monospace", "line-height:1.55",
        "color:#c8b890", "pointer-events:none", "user-select:none",
      ].join(";");

      const header = document.createElement("div");
      header.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;";
      header.innerHTML = `<span style="color:#f2c14e;font-weight:bold;">Profiler</span><span id="dev-prof-frame" style="font-weight:bold;"></span>`;
      el.appendChild(header);

      const budgetBar = document.createElement("div");
      budgetBar.style.cssText = "height:4px;background:rgba(255,255,255,0.08);border-radius:2px;margin-bottom:6px;overflow:hidden;";
      budgetBar.innerHTML = `<div id="dev-prof-budget" style="height:100%;border-radius:2px;transition:width .3s,background .3s;"></div>`;
      el.appendChild(budgetBar);

      const body = document.createElement("div");
      body.id = "dev-prof-body";
      el.appendChild(body);

      document.body.appendChild(el);
      this._profilerRows.clear();
      this._profilerOrder.length = 0;
    }

    const results = profilerResults();
    if (!results.length) return;

    const frameMs = profilerFrameMs();
    const budgetMs = 1000 / 60;
    const budgetPct = Math.min(100, (frameMs / budgetMs) * 100);
    const budgetCol = budgetPct > 80 ? "#ff6a6a" : budgetPct > 50 ? "#ffc24e" : "#9bd05a";

    const frameEl = document.getElementById("dev-prof-frame");
    if (frameEl) { frameEl.textContent = `${frameMs.toFixed(1)}ms / ${budgetMs.toFixed(1)}ms`; frameEl.style.color = budgetCol; }
    const budgetEl = document.getElementById("dev-prof-budget");
    if (budgetEl) { budgetEl.style.width = budgetPct.toFixed(0) + "%"; budgetEl.style.background = budgetCol; }

    const body = document.getElementById("dev-prof-body");
    if (!body) return;

    const maxMs = Math.max(0.1, ...results.map(r => r.avg));

    for (const r of results) {
      if (r.avg < 0.005) continue;
      let row = this._profilerRows.get(r.name);
      if (!row) {
        row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:5px;height:14px;margin:1px 0;";
        const label = document.createElement("span");
        label.style.cssText = "width:110px;color:#c8b890;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;";
        label.textContent = r.name;
        label.title = r.name;
        const track = document.createElement("div");
        track.style.cssText = "flex:1;height:8px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;";
        const fill = document.createElement("div");
        fill.style.cssText = "height:100%;border-radius:3px;transition:width .3s,background .3s;";
        fill.className = "prof-fill";
        track.appendChild(fill);
        const val = document.createElement("span");
        val.style.cssText = "width:80px;text-align:right;color:#e0d8c0;flex-shrink:0;";
        val.className = "prof-val";
        row.append(label, track, val);
        this._profilerRows.set(r.name, row);
        this._profilerOrder.push(r.name);
        body.appendChild(row);
      }
      const pct = maxMs > 0 ? (r.avg / maxMs) * 100 : 0;
      const framePct = frameMs > 0 ? (r.avg / frameMs) * 100 : 0;
      const barCol = r.avg > 4 ? "#ff6a6a" : r.avg > 2 ? "#ffc24e" : r.avg > 0.5 ? "#9bd05a" : "#6a8a5a";
      const fill = row.querySelector(".prof-fill");
      if (fill) { fill.style.width = pct.toFixed(0) + "%"; fill.style.background = barCol; }
      const val = row.querySelector(".prof-val");
      if (val) val.innerHTML = `${r.avg.toFixed(2)}ms <span style="color:#888;">${framePct.toFixed(0)}%</span>`;
    }
  },

};

renderDevWeaponButtons();
renderDevArmorButtons();
renderDevMountButtons();

// Keep the documented dev-console entry point while UI events are wired by DevPanel.js.
window.DEV = DEV;
