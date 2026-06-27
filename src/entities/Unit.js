import { rand } from '../util/math.js';

export function makeUnit(role, x) {
  return {
    role, x, vx: 0, dir: 1, state: "idle", targetX: x,
    hp:    role === "archer" ? 6 : 5,
    maxHp: role === "archer" ? 6 : 5,
    cooldown: 0, anim: rand(0, 6),
    wall: null, retreating: false, workTimer: 0, panic: 0,
  };
}
