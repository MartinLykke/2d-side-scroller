import { rand } from '../util/math.js';

const FIRST_NAMES = ["Eldrin","Garrick","Lyra","Rowan","Allon","Kaelen","Silas","Bryn","Faye","Arvid","Taurone","Sariel","Yvaine","Cedric","Orin","Kira"];
const TITLES = ["The Hawk","Swiftwind","Sharp-Eye","The Eagle","Oakbow","Greencloak","Arrowfall","The Whisper","Stormbow","Deadeye","The Pierce","Surefoot","Silverstring","Shadowstalker","The Fleet","Trueflight"];

export function generateArcherName() {
  return FIRST_NAMES[Math.floor(Math.random()*FIRST_NAMES.length)] + " " + TITLES[Math.floor(Math.random()*TITLES.length)];
}

export function makeUnit(role, x) {
  const u = {
    role, x, vx: 0, dir: 1, state: "idle", targetX: x,
    hp:    role === "archer" ? 6 : 5,
    maxHp: role === "archer" ? 6 : 5,
    cooldown: 0, anim: rand(0, 6),
    wall: null, retreating: false, workTimer: 0, panic: 0,
    patrolDir: Math.random() < 0.5 ? -1 : 1,
  };
  if (role === "archer") {
    u.archerName = generateArcherName();
    u.level = 1;
    u.xp = 0;
    u.shotCount = 0;
    u.powerTimer = 0;
    u.charged = false;
    u.smoked = 0;
    u.smokeReveal = 0;
    u.barrageCount = 0;
  }
  return u;
}
