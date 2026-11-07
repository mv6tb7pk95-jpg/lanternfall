// Lanternfall: the multi-tier hub as data. World 1280 x 480, y points down, a ledge y is the floor under the hero's feet.
export const WORLD_H = 480;
export const SPAWN = { x: 600, y: 150 };

export const ZONES = [
  { id: "camp", name: "Upper Camp", x1: 400, x2: 1000, y1: 0, y2: 190,
    sky: ["#0d1330", "#1d2a55"], rock: "#3b3a46", light: { c: "#ffb347", a: 0.18 }, fx: "stars" },
  { id: "catacombs", name: "The Catacombs", x1: 0, x2: 400, y1: 150, y2: 480,
    sky: ["#0b1a1c", "#16302f"], rock: "#2c3a38", light: { c: "#5fe0b0", a: 0.14 }, fx: "fireflies" },
  { id: "mines", name: "The Crystal Mines", x1: 400, x2: 960, y1: 190, y2: 480,
    sky: ["#0e0f2a", "#1b1c4a"], rock: "#34365a", light: { c: "#7aa8ff", a: 0.16 }, fx: "snow" },
  { id: "foundry", name: "The Ember Foundry", x1: 960, x2: 1280, y1: 120, y2: 480,
    sky: ["#2a0e08", "#4a1a0c"], rock: "#4a3326", light: { c: "#ff7a2a", a: 0.2 }, fx: "embers" },
];

export const LEDGES = [
  { id: "camp", zone: "camp", kind: "grass", x1: 430, x2: 960, y: 150 },
  { id: "grave", zone: "catacombs", kind: "stone", x1: 140, x2: 340, y: 240 },
  { id: "crypt", zone: "catacombs", kind: "stone", x1: 30, x2: 290, y: 330 },
  { id: "stonebridge", zone: "catacombs", kind: "bridge", x1: 290, x2: 400, y: 330 },
  { id: "rails", zone: "mines", kind: "rails", x1: 400, x2: 960, y: 330 },
  { id: "scaffold", zone: "mines", kind: "scaffold", x1: 600, x2: 760, y: 250 },
  { id: "fupper", zone: "foundry", kind: "catwalk", x1: 1040, x2: 1270, y: 190 },
  { id: "flower", zone: "foundry", kind: "catwalk", x1: 960, x2: 1270, y: 330 },
];

export const STAIRS = [
  { id: "woodstair", zone: "camp", kind: "wood", x1: 340, y1: 240, x2: 430, y2: 150 },
  { id: "stonestair", zone: "catacombs", kind: "stone", x1: 60, y1: 330, x2: 140, y2: 240 },
  { id: "minestair", zone: "mines", kind: "wood", x1: 760, y1: 250, x2: 840, y2: 330 },
  { id: "ropebridge", zone: "foundry", kind: "rope", x1: 960, y1: 150, x2: 1040, y2: 190 },
];

export const LADDERS = [
  { id: "shaft", x: 470, top: 150, bottom: 330 },
  { id: "furnace", x: 1250, top: 190, bottom: 330 },
];

export const BUILDING_SPOTS = {
  loadout: { x: 540, y: 150, zone: "camp" },
  party: { x: 720, y: 150, zone: "camp" },
  gate: { x: 920, y: 150, zone: "camp" },
  forge: { x: 1160, y: 190, zone: "foundry" },
  shop: { x: 1100, y: 330, zone: "foundry" },
};

export const PROPS = {
  campfire: [{ x: 630, y: 150 }],
  tents: [{ x: 664, y: 150, w: 36, c: "#4a6a9a" }, { x: 782, y: 150, w: 40, c: "#8a7a4a" }, { x: 826, y: 150, w: 36, c: "#6a8a6a" }],
  torches: [{ x: 492, y: 150 }, { x: 590, y: 150 }, { x: 250, y: 240 }, { x: 120, y: 330 }, { x: 425, y: 330 },
    { x: 900, y: 330 }, { x: 1020, y: 330 }, { x: 1070, y: 190 }],
  braziers: [{ x: 440, y: 150 }, { x: 866, y: 150 }],
  tombs: [{ x: 170, y: 240 }, { x: 230, y: 240 }, { x: 300, y: 240 }, { x: 110, y: 330 }, { x: 160, y: 330 }, { x: 250, y: 330 }],
  tower: { x: 70, y: 330, h: 170 },
  crystals: [{ x: 440, y: 330, h: 26, c: "#6aa8ff" }, { x: 520, y: 330, h: 18, c: "#b07aff" }, { x: 640, y: 250, h: 22, c: "#6aa8ff" },
    { x: 700, y: 250, h: 16, c: "#b07aff" }, { x: 800, y: 330, h: 28, c: "#7ae0ff" }, { x: 900, y: 330, h: 20, c: "#b07aff" }],
  cart: { x: 560, y: 330 },
  lava: [{ x1: 1000, x2: 1200, y: 372 }],
  gears: [{ x: 1100, y: 140, r: 14 }, { x: 1215, y: 150, r: 10 }],
  chains: [{ x: 1060, y: 104, len: 40 }, { x: 1130, y: 104, len: 56 }],
  furnaces: [{ x: 1218, y: 190, w: 26, h: 34 }],
};

export function zoneAt(x, y) {
  for (const z of ZONES) if (x >= z.x1 && x < z.x2 && y >= z.y1 && y < z.y2) return z;
  return ZONES[0];
}

export function zoneOfLedge(id) {
  const l = LEDGES.find((v) => v.id === id) || STAIRS.find((v) => v.id === id);
  return l ? l.zone : "camp";
}
