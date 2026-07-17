// Mounts: rideable steeds sold in the Royal Armory stable tab. A mount raises
// the rider (`lift`, in px — the whole player transform including the held
// weapon shifts up by this) and multiplies both walk and sprint speed.
// `lift` is tuned so the rider's hips (17px above their feet) land exactly on
// the saddle top, which sits ~27.5*scale above the hooves: lift = 27.5*scale - 17.
export const MOUNTS = {
  dun_pony: {
    name: "Dun Pony",
    desc: "A stout, sure-footed pony. Faster than boots.",
    speedMult: 1.35,
    lift: 15,
    scale: 1.15,
    col: "#c8a86a",
    body: "#a8845a", bodyDk: "#7a5c3a", belly: "#c4a478",
    mane: "#4a3420", tail: "#4a3420",
    saddle: "#7a3a2a", blanket: "#65594e",
  },
  chestnut_courser: {
    name: "Chestnut Courser",
    desc: "A swift courser bred for the king's messengers.",
    speedMult: 1.65,
    lift: 19,
    scale: 1.3,
    col: "#d07a4a",
    body: "#8a4a2a", bodyDk: "#5c3018", belly: "#b07a50",
    mane: "#2c1a10", tail: "#2c1a10",
    saddle: "#3a4a5a", blanket: "#8f2031",
  },
  ember_warhorse: {
    name: "Ember Warhorse",
    desc: "A black destrier with embers in its mane. Rides like wildfire.",
    speedMult: 2.0,
    lift: 23,
    scale: 1.45,
    col: "#ff8840",
    body: "#2c2430", bodyDk: "#181220", belly: "#4a3e50",
    mane: "#ff6a20", tail: "#ff6a20",
    saddle: "#8f2031", blanket: "#2a3440",
    ember: true,
  },
};
