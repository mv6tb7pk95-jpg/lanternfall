// Lanternfall: the hub as MapleStory-style rooms. Data only: no imports, no drawing, no screens.
//
// Each room is its own small level, a few screens wide and tall, with tiers of platforms, ropes and doors:
//   plats  one-way platforms { x1, x2, y, k, solid }. y is the walking line (bigger = lower). The hero jumps up through a
//          platform and lands on top of it. Down + Jump drops through a platform unless it is solid (the ground).
//          k is the look the drawing code uses: "ground" | "wood" | "stone" | "iron".
//   ropes  { x, top, bottom }. Up / Down climbs. top is the y of a platform that contains x; bottom likewise.
//   doors  { id, kind, x, y, w, h, title }, standing on the platform whose y matches.
//            kind "building": id is the key of hubActions (menu.js opens that screen).
//            kind "portal":   to is a room id, arrive is the id of the door he steps out of in that room.
//            kind "hunt":     hunt is the id of a hunting ground (hunts.js, not written yet).
//   deco   scenery for the drawing code: { t, x, y, ... }. It has no effect on walking.
//   look   the room's mood: sky colours, the main light colour and an accent.
// The hero's jump is 65 px high (fieldwalk.js), so every gap between two tiers is 52 px: one jump up, no rope needed.
// Ropes are for the long climbs (several tiers at once) and give a second way up.
//
// Room graph (portals):
//   Upper Camp <-> The Catacombs, Upper Camp <-> The Crystal Mines, Upper Camp <-> The Ember Foundry,
//   The Catacombs <-> The Crystal Mines, The Crystal Mines <-> The Ember Foundry.
// Hunting grounds: one door in each of the Catacombs, the Mines and the Foundry.

const FLOOR = (w, y) => ({ x1: 0, x2: w, y, k: "ground", solid: true });
const P = (x1, x2, y, k) => ({ x1, x2, y, k, solid: false });
const BUILDING = (id, title, x, y) => ({ id, kind: "building", title, x, y, w: 56, h: 48 });
const PORTAL = (id, title, to, arrive, x, y) => ({ id, kind: "portal", title, to, arrive, x, y, w: 24, h: 40 });
const HUNT = (id, title, hunt, x, y) => ({ id, kind: "hunt", title, hunt, x, y, w: 28, h: 40 });

export const ROOM_LIST = [
  {
    id: "camp",
    name: "Upper Camp",
    w: 720, h: 300,
    look: { skyTop: "#0d1030", skyBottom: "#2a2350", light: "#ffb25a", accent: "#ffd98a" },
    spawn: { x: 360, y: 268 },
    plats: [FLOOR(720, 268), P(40, 230, 216, "wood"), P(490, 690, 216, "wood"), P(240, 480, 164, "wood")],
    ropes: [
      { x: 262, top: 164, bottom: 268 },
      { x: 458, top: 164, bottom: 268 },
    ],
    doors: [
      BUILDING("loadout", "Loadout", 130, 216),
      BUILDING("party", "Party Board", 590, 216),
      BUILDING("gate", "Dungeon Gate", 360, 164),
      PORTAL("pCatacombs", "The Catacombs", "catacombs", "pCamp", 34, 268),
      PORTAL("pMines", "The Crystal Mines", "mines", "pCamp", 600, 268),
      PORTAL("pFoundry", "The Ember Foundry", "foundry", "pCamp", 690, 268),
    ],
    deco: [
      { t: "campfire", x: 330, y: 268 },
      { t: "tent", x: 120, y: 268 },
      { t: "tent", x: 520, y: 268 },
      { t: "torch", x: 300, y: 164 },
      { t: "torch", x: 420, y: 164 },
      { t: "torch", x: 70, y: 216 },
      { t: "stars" },
    ],
  },
  {
    id: "catacombs",
    name: "The Catacombs",
    w: 640, h: 300,
    look: { skyTop: "#0a1512", skyBottom: "#1c2d28", light: "#7fe0b0", accent: "#bfffe0" },
    spawn: { x: 320, y: 268 },
    plats: [FLOOR(640, 268), P(60, 260, 216, "stone"), P(120, 320, 164, "stone"), P(400, 600, 216, "stone")],
    ropes: [
      { x: 300, top: 164, bottom: 268 },
      { x: 412, top: 216, bottom: 268 },
    ],
    doors: [
      PORTAL("pCamp", "Upper Camp", "camp", "pCatacombs", 604, 268),
      PORTAL("pMines", "The Crystal Mines", "mines", "pCatacombs", 540, 216),
      HUNT("hGrave", "Graveyard hunt", "grave", 220, 164),
    ],
    deco: [
      { t: "tombstone", x: 40, y: 268 },
      { t: "tombstone", x: 190, y: 268 },
      { t: "tombstone", x: 360, y: 268 },
      { t: "tombstone", x: 470, y: 268 },
      { t: "belltower", x: 170, y: 164 },
      { t: "fog" },
      { t: "fireflies" },
    ],
  },
  {
    id: "mines",
    name: "The Crystal Mines",
    w: 640, h: 340,
    look: { skyTop: "#0b0a1f", skyBottom: "#1b1a3d", light: "#7aa8ff", accent: "#c07aff" },
    spawn: { x: 320, y: 308 },
    plats: [FLOOR(640, 308), P(40, 240, 256, "wood"), P(160, 360, 204, "wood"), P(400, 600, 256, "stone"), P(380, 600, 152, "wood")],
    ropes: [
      { x: 250, top: 204, bottom: 308 },
      { x: 388, top: 152, bottom: 308 },
    ],
    doors: [
      PORTAL("pCatacombs", "The Catacombs", "catacombs", "pMines", 36, 308),
      PORTAL("pCamp", "Upper Camp", "camp", "pMines", 90, 256),
      PORTAL("pFoundry", "The Ember Foundry", "foundry", "pMines", 612, 308),
      HUNT("hHollow", "Crystal Hollow hunt", "hollow", 500, 152),
    ],
    deco: [
      { t: "rails", y: 308 },
      { t: "minecart", x: 300, y: 308 },
      { t: "crystal", x: 90, y: 256, c: "#7aa8ff" },
      { t: "crystal", x: 330, y: 204, c: "#c07aff" },
      { t: "crystal", x: 500, y: 256, c: "#7aa8ff" },
      { t: "crystal", x: 560, y: 152, c: "#c07aff" },
      { t: "snow" },
    ],
  },
  {
    id: "foundry",
    name: "The Ember Foundry",
    w: 640, h: 340,
    look: { skyTop: "#1a0b08", skyBottom: "#3d1a0c", light: "#ff7a2a", accent: "#ffcf6a" },
    spawn: { x: 320, y: 308 },
    plats: [FLOOR(640, 308), P(60, 300, 256, "iron"), P(220, 460, 204, "iron"), P(400, 620, 256, "iron"), P(100, 260, 152, "iron")],
    ropes: [
      { x: 310, top: 204, bottom: 308 },
      { x: 110, top: 152, bottom: 256 },
    ],
    doors: [
      PORTAL("pMines", "The Crystal Mines", "mines", "pFoundry", 36, 308),
      PORTAL("pCamp", "Upper Camp", "camp", "pFoundry", 604, 308),
      BUILDING("shop", "Shop", 200, 256),
      BUILDING("forge", "Lantern Forge", 340, 204),
      HUNT("hSlag", "Slag Pit hunt", "slag", 180, 152),
    ],
    deco: [
      { t: "lava", y: 322 },
      { t: "furnace", x: 520, y: 256 },
      { t: "gear", x: 440, y: 120, r: 22 },
      { t: "pipe", x: 600, y: 60 },
      { t: "embers" },
    ],
  },
];

export const ROOMS = Object.fromEntries(ROOM_LIST.map((r) => [r.id, r]));

/** Where the hero starts the first time he enters the hub. */
export const START = { room: "camp", x: 360, y: 268 };

/** The door with this id in a room, or null. */
export const doorById = (room, id) => room.doors.find((d) => d.id === id) || null;
