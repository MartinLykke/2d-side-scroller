import { CFG } from '../config/config.js';
import { WEAPONS, RARITY_COL, RARITY_NAME } from '../config/weapons.js';
import { LOC_DEFS } from '../config/locations.js';
import { dist, clamp } from '../util/math.js';
import { Game, state } from '../state.js';
import { Audio } from '../systems/Audio.js';
import { spawnEnemy, planNight, floaty, spawnParticles } from '../systems/SpawnSystem.js';
import { pick } from '../util/math.js';
import { groundY } from '../canvas.js';

function phaseName() {
  const t=Game.time;
  if (t<=CFG.phases.day)   return "Dag";
  if (t<=CFG.phases.dusk)  return "Aften";
  if (t<=CFG.phases.night) return "Nat";
  return "Daggry";
}

function baseName(lvl) { return ["—","Lejr","Lille landsby","Stor landsby","Slot"][lvl]; }
export { baseName };

export const UI = {
  hud:         document.getElementById("hud"),
  prompt:      document.getElementById("prompt"),
  startScreen: document.getElementById("start-screen"),
  endScreen:   document.getElementById("end-screen"),
  pauseScreen: document.getElementById("pause-screen"),
  muted: false,

  toggleMute() { Audio.init(); this.muted = !Audio.toggle(); },

  refresh() {
    const { player, base, units, vagrants, stations, locations } = state;
    document.getElementById("hud-day-text").textContent   = "Dag " + Game.day;
    const ph = phaseName();
    document.getElementById("hud-phase-text").textContent = ph;
    document.getElementById("hud-phase-icon").textContent = ph==="Nat"?"🌙":ph==="Aften"?"🌆":ph==="Daggry"?"🌅":"☀";
    document.getElementById("hud-base-text").textContent  = baseName(base.level);
    document.getElementById("hud-coins-text").textContent = player.coins + "/" + CFG.maxCoinsCarry;
    document.getElementById("hud-hp-text").textContent    = Math.max(0,player.hp) + "/" + player.maxHp;

    const arch  = units.filter(u=>u.role==="archer").length;
    const build = units.filter(u=>u.role==="builder").length;
    document.getElementById("hud-pop-text").textContent   = units.length + vagrants.length;
    document.getElementById("hud-arch-text").textContent  = arch;
    document.getElementById("hud-build-text").textContent = build;

    let obj;
    if (Game.surviveNightForWin) obj="🎯 Slottet står! Overlev natten for at vinde.";
    else if (base.level<4) obj="🎯 Opgradér basen til Slot (niveau "+base.level+"/4)";
    else obj="🎯 Forsvar riget!";
    if (Game.isNight) obj="🌙 NAT — "+(Game.nightQuota-state.enemies.filter(e=>!e.fleeing).length>0?"horden angriber!":"hold linjen!");
    document.getElementById("hud-objective").textContent = obj;

    const wEl=document.getElementById("hud-weapon-text"), wPill=document.getElementById("hud-weapon");
    if (player.weapon) {
      const w=WEAPONS[player.weapon];
      const upgs=(player.weaponUpgrades||[]).length;
      wEl.textContent=w.name+" ("+RARITY_NAME[w.rarity]+")"+(upgs>0?" ×"+upgs:"");
      wPill.style.borderColor=RARITY_COL[w.rarity]+"99";
      wPill.style.color=RARITY_COL[w.rarity];
    } else { wEl.textContent="Intet våben"; wPill.style.borderColor=""; wPill.style.color=""; }

    let near=null, nd=CFG.payRange;
    for (const s of stations) { const c=s.cost(); if (c<=0) continue; const d=dist(player.x,s.x()); if (d<nd) { nd=d; near=s; } }
    const vagNear=state.vagrants.find(v=>dist(player.x,v.x)<46&&Math.abs(v.vx)<1);
    const lootNear=state.lootItems&&state.lootItems.find(it=>dist(player.x,it.x)<50);
    const shopSt=stations.find(s=>s.id==="shop");
    const nearShop=shopSt&&state.base.level>=2&&dist(player.x,shopSt.x())<100;
    if (near) {
      this.prompt.classList.remove("hidden");
      const prog=near.paid>0?` (${near.paid}/${near.cost()})` : "";
      this.prompt.innerHTML=`${near.label()} &nbsp;<span class="cost">${near.cost()}🪙</span>${prog} &nbsp;<span class="hold">hold ↓/S</span>`;
    } else if (vagNear) {
      this.prompt.classList.remove("hidden");
      this.prompt.innerHTML=`Rekruttér undersåt &nbsp;<span class="cost">1🪙</span> &nbsp;<span class="hold">hold ↓/S</span>`;
    } else if (lootNear) {
      this.prompt.classList.remove("hidden");
      const w=WEAPONS[lootNear.weaponId];
      this.prompt.innerHTML=`Saml op: ${w.name} &nbsp;<span class="hold">tryk F</span>`;
    } else if (nearShop && !Game.shopOpen) {
      this.prompt.classList.remove("hidden");
      this.prompt.innerHTML=`B - Åbn butik 🏪`;
    } else {
      this.prompt.classList.add("hidden");
    }
  },
};

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

  skipToNight() {
    if (Game.state!=="play") return;
    Game.time=CFG.phases.dusk+0.005;
    floaty(state.base.x,"→ Nat 🌙","#cfe6f2");
  },

  skipToDay() {
    if (Game.state!=="play") return;
    Game.time=0.02; Game.day++; planNight();
    if (state.enemies) state.enemies.forEach(e=>e.fleeing=true);
    floaty(state.base.x,"→ Dag ☀","#f2c14e");
  },

  upgradeBase() {
    if (Game.state!=="play"||state.base.level>=4) return;
    // call the upgradeBase exported from game.js via window
    window._upgradeBase?.();
  },

  healAll() {
    if (Game.state!=="play") return;
    state.player.hp=state.player.maxHp; state.base.hp=state.base.maxHp;
    state.units.forEach(u=>u.hp=u.maxHp);
    state.walls.forEach(w=>{ if (w.commissioned&&w.buildProgress>=1) w.hp=w.maxHp; });
    floaty(state.base.x,"💚 Helbredt!","#9bd05a");
  },

  doSpawnEnemy(type) {
    if (Game.state!=="play") return;
    spawnEnemy(type, pick(state.portals));
    floaty(state.portals[0].x,"👹 "+type+"!","#ff6a4a");
  },

  killAll() {
    if (Game.state!=="play") return;
    const n=state.enemies.length; state.enemies.length=0;
    floaty(state.base.x,"💀 "+n+" fjender!","#f2c14e");
  },

  toggleGodMode() {
    this.godMode=!this.godMode;
    window._DEV_GOD_MODE=this.godMode;
    const btn=document.getElementById("dev-god-btn");
    btn.textContent="God mode: "+(this.godMode?"🟢 TIL":"⚫ FRA");
    btn.classList.toggle("dev-active",this.godMode);
    if (state.player) floaty(state.player.x,this.godMode?"🛡 Uspårbar":"🛡 Sårbar igen","#cfe6f2");
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

  dropWeapon() {
    if (Game.state!=="play"||!state.player) return;
    if (state.player.weapon) {
      state.lootItems.push({ x:state.player.x+20, weaponId:state.player.weapon });
      state.player.weapon=null;
      floaty(state.player.x,"Våben droppet","#c8c8c8");
    }
  },

  updateStats(dt) {
    this._fps+=(1/Math.max(dt,0.001)-this._fps)*0.08;
    const el=document.getElementById("dev-stats");
    if (!el||document.getElementById("dev-panel").classList.contains("hidden")) return;
    const arch  = state.units ? state.units.filter(u=>u.role==="archer").length  : 0;
    const build = state.units ? state.units.filter(u=>u.role==="builder").length : 0;
    const farm  = state.units ? state.units.filter(u=>u.role==="farmer").length  : 0;
    el.innerHTML=
      `FPS: <b>${Math.round(this._fps)}</b> &nbsp;|&nbsp; Dag: <b>${Game.day}</b> &nbsp;t: <b>${Game.time.toFixed(3)}</b><br>`+
      `Fjender: <b>${state.enemies?.length||0}</b> &nbsp;|&nbsp; Enheder: <b>${state.units?.length||0}</b> (🏹${arch} 🔨${build} 🌾${farm})<br>`+
      `Mønter (jord): <b>${state.coins?.length||0}</b> &nbsp;|&nbsp; Partikler: <b>${state.particles?.length||0}</b><br>`+
      `Spiller X: <b>${state.player?Math.round(state.player.x):"-"}</b> &nbsp;|&nbsp; Kamera: <b>${Math.round(Game.cam)}</b>`;
  },
};

// Expose DEV globally so index.html onclick= attributes still work
window.DEV = DEV;
