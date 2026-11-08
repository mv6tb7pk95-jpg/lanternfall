// Lanternfall: monster hunts. A hunt is a field you enter from a hunt door in the hub (fieldmaps.js, kind "hunt").
// You defeat `quota` monsters to win and get `reward` shards. Monsters keep coming, never more than `max` at once.
// A hunt is NOT a story chapter: no waves, no boss, no dialogue. run.js starts one with beginRun(key, null, hunt).
// This file holds the data (HUNTS) and the spawner (updateHunt). Damage, skills and projectiles are the normal combat engine,
// so the monsters walk on one flat floor line like in every other run. The mood of each ground (mist, lights, pixelfx
// loops) is added by ambient.js through decorateWorld().
//
// theme    colours and prop positions for world.js (the same shape as a chapter's theme)
// kinds    which monsters appear, in rotation: slime ghost bat snake wisp
// tint     a pixelfx palette name that recolours the ordinary monsters, or null
// scale    multipliers on monster HP and damage
// quota    how many monsters to defeat; max   how many may be alive at once; every   seconds between two spawns
// reward   shards for finishing (the shards that monsters drop on the way are added, as in every run)
//
// Spawning: the first monster comes 0.3 s after the start, and one comes within 0.4 s whenever the field is empty.
// A new monster appears just inside the left or right edge of the screen (EDGE px in), at least 80 px from the hero, so it
// is seen at once. It used to appear 24 px outside the edge, and with the camera at the left end every one came from the right.
// If a monster cannot be created, the error is shown once (the red box) instead of failing silently.
// The top bar shows "kills/quota · n on field", so you can see that the spawner is alive.
import { G, $, clamp, fail } from "./state.js";
import { VW, WORLD_W } from "./world.js";
import { spawnEnemy } from "./entities.js";
import { toast } from "./ui.js";
import { decorateWorld } from "./ambient.js";

const GRAVE = {
  id: "grave",
  sky: { top: "#07110f", low: "#16302a", star: "#bfffe0", moon: { x: 70, y: 28, r: 12, c: "#d8ffe8" } },
  wall: { brick: ["#16231f", "#1b2b26", "#121d1a"], mortar: "#0a1210", cap: "#2c4a40", hi: "#4a7a68", stone: ["#4a7a68", "#365a4c", "#25403a", "#162a24"], gap: 150 },
  floor: { edge: "#5b8f7a", light: "#223a32", dark: "#192b25", mortar: "#101d19" },
  props: { torch: [200, 470, 740, 1010], brazier: [330, 880], campfire: [], tint: "#7fe0b0" },
};

const HOLLOW = {
  id: "hollow",
  sky: { top: "#080920", low: "#1b1a45", star: "#c9b8ff", moon: null },
  wall: { brick: ["#1a1a3a", "#202048", "#15152f"], mortar: "#0c0c1e", cap: "#3a3a78", hi: "#5a5aa8", stone: ["#7aa8ff", "#5a78c8", "#3a4f98", "#26346a"], gap: 130 },
  floor: { edge: "#6a78c8", light: "#262a58", dark: "#1c2046", mortar: "#12152e" },
  props: { torch: [160, 420, 680, 940, 1200], brazier: [290, 810], campfire: [550], tint: "#7aa8ff" },
};

const SLAG = {
  id: "slag",
  sky: { top: "#1a0807", low: "#4a1a0c", star: "#ffb070", moon: { x: 240, y: 26, r: 12, c: "#ff7a3a" } },
  wall: { brick: ["#2a1612", "#331c16", "#22120f"], mortar: "#140a08", cap: "#5a3020", hi: "#7a4a2a", stone: ["#8a5a32", "#5a3a22", "#3a2416", "#26150e"], gap: 170 },
  floor: { edge: "#9a5a32", light: "#3a2018", dark: "#2a1611", mortar: "#1c0f0b" },
  props: { torch: [220, 580, 940], brazier: [400, 760, 1120], campfire: [], tint: null },
};

export const HUNTS = {
  grave: {
    id: "grave", title: "Graveyard hunt", theme: GRAVE, kinds: ["slime", "ghost"], tint: null,
    scale: { hp: 1.1, dmg: 1.1 }, quota: 20, max: 5, every: 1.6, reward: 60,
  },
  hollow: {
    id: "hollow", title: "Crystal Hollow hunt", theme: HOLLOW, kinds: ["bat", "wisp", "ghost"], tint: "ice",
    scale: { hp: 1.4, dmg: 1.3 }, quota: 25, max: 6, every: 1.4, reward: 90,
  },
  slag: {
    id: "slag", title: "Slag Pit hunt", theme: SLAG, kinds: ["snake", "wisp", "slime"], tint: "lava",
    scale: { hp: 1.8, dmg: 1.6 }, quota: 30, max: 7, every: 1.2, reward: 130,
  },
};

const EDGE = 10; // px inside the screen edge where a new monster appears
let timer = 0.3, n = 0, shown = "", reported = false;

/** Called by run.js when a hunt begins. */
export function startHunt() {
  timer = 0.3;
  n = 0;
  shown = "";
  reported = false;
  toast("Defeat " + G.hunt.quota + " monsters", 2.4);
  // the ambience loads in the background; if it fails, the hunt plays on without it
  decorateWorld(G.world, G.hunt.id).catch((e) => console.warn("hunt ambience skipped:", e));
}

const label = (h) => h.title + " " + Math.min(G.kills, h.quota) + "/" + h.quota + " · " + G.enemies.length + " on field";

/** Create one monster at a screen edge. Shows an error once if it cannot be created. */
function spawnOne(h) {
  const p = G.player;
  let type = h.kinds[n % h.kinds.length];
  if (!G.M[type]) type = h.kinds.find((k) => G.M[k]); // a missing effect: use another kind of this hunt
  if (!type) {
    if (!reported) {
      reported = true;
      fail(new Error("Hunt spawn: no monster effect is loaded for " + h.kinds.join(", ") + ". Loaded: " + Object.keys(G.M).join(", ")));
    }
    return;
  }
  const left = G.cam + EDGE, right = G.cam + VW - EDGE;
  const order = n % 2 ? [right, left] : [left, right];
  n++;
  const ok = (x) => x >= 10 && x <= WORLD_W - 10 && Math.abs(x - p.x) >= 80; // seen at once, but not on top of the hero
  const x = clamp(order.find(ok) ?? order[0], 10, WORLD_W - 10);
  try {
    G.enemies.push(spawnEnemy(type, G.M[type], x, { scale: h.scale, tint: h.tint }));
  } catch (e) {
    if (!reported) {
      reported = true;
      fail(e);
    }
  }
}

/** Called every frame while a hunt is playing: shows the count and spawns the next monster when it is due. */
export function updateHunt(dt) {
  const h = G.hunt;
  if (!h) return;
  const key = G.kills + ":" + G.enemies.length;
  if (key !== shown) {
    shown = key;
    $("chName").textContent = label(h);
  }
  // never spawn more than are still needed, and never more than `max` at once
  if (G.kills + G.enemies.length >= h.quota || G.enemies.length >= h.max) return;
  timer -= dt;
  if (G.enemies.length === 0) timer = Math.min(timer, 0.4); // the field is never empty for long
  if (timer > 0) return;
  timer = h.every;
  spawnOne(h);
}
