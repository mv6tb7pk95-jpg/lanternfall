// Lanternfall: the hub map as DATA. The square in front of the gatehouse: five buildings you walk up to.
// No game logic here: hub.js walks the hero and opens screens, hubdraw.js draws the buildings.
// The hub uses the same 1280 px wide world as a run, with its own colours and torch / brazier / campfire positions.
import { DEFAULT_THEME } from "./world.js";

export const SPAWN_X = 610; // where the hero stands the first time he enters the hub

export const HUB_THEME = {
  ...DEFAULT_THEME,
  id: "hub",
  sky: { ...DEFAULT_THEME.sky, moon: { x: 250, y: 34, r: 11, c: "#e9e4ff" } },
  // torches between the buildings, two braziers flanking the gate, a campfire in the square
  props: { torch: [110, 310, 510, 710, 1190], brazier: [985, 1115], campfire: [900], tint: null },
};

// x: centre of the building, w/h: size in px (it stands on the floor line), label: the sign text (letters in FONT only),
// title: shown on the "Enter ..." prompt, wall / roof / accent: colours.
export const BUILDINGS = [
  { id: "shop", label: "SHOP", title: "Shop", x: 210, w: 64, h: 50, wall: "#5a4630", roof: "#8a3a2a", accent: "#ffc23d" },
  { id: "forge", label: "FORGE", title: "Lantern Forge", x: 410, w: 68, h: 56, wall: "#3d3a4a", roof: "#2a2733", accent: "#ff8a3d" },
  { id: "loadout", label: "LOADOUT", title: "Loadout", x: 610, w: 64, h: 48, wall: "#2f4a52", roof: "#1f3238", accent: "#5ad0c0" },
  { id: "party", label: "PARTY", title: "Party Board", x: 810, w: 60, h: 46, wall: "#6a5236", roof: "#4a3622", accent: "#ffd9a0" },
  { id: "gate", label: "GATE", title: "Dungeon Gate", x: 1050, w: 72, h: 62, wall: "#2b2640", roof: "#1c1830", accent: "#a98bff" },
];

// A 3x5 pixel font, only the letters the sign labels use. Each glyph is 15 characters, row by row.
const ROWS = {
  S: ["111", "100", "111", "001", "111"],
  H: ["101", "101", "111", "101", "101"],
  O: ["111", "101", "101", "101", "111"],
  P: ["111", "101", "111", "100", "100"],
  F: ["111", "100", "111", "100", "100"],
  R: ["110", "101", "110", "101", "101"],
  G: ["111", "100", "101", "101", "111"],
  E: ["111", "100", "111", "100", "111"],
  L: ["100", "100", "100", "100", "111"],
  A: ["111", "101", "111", "101", "101"],
  D: ["110", "101", "101", "101", "110"],
  U: ["101", "101", "101", "101", "111"],
  T: ["111", "010", "010", "010", "010"],
  Y: ["101", "101", "010", "010", "010"],
};
export const FONT = Object.fromEntries(Object.entries(ROWS).map(([k, r]) => [k, r.join("")]));
