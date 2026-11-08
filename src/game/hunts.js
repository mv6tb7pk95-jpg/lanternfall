// Lanternfall: monster hunts. A hunt is a field you enter from a hunt door in the hub (fieldmaps.js, kind "hunt").
// You defeat `quota` monsters to win and get `reward` shards. Monsters keep coming, never more than `max` at once.
// A hunt is NOT a story chapter: no waves, no boss, no dialogue. run.js starts one with beginRun(key, null, hunt).
// This file holds the data (HUNTS) and the spawner (updateHunt). Damage, skills and projectiles are the normal combat engine,
// so the monsters walk on one flat floor line like in every other run.
//
// theme    colours and prop positions for world.js (the same shape as a chapter's theme)
// kinds    which monsters appear, in rotation: slime ghost bat snake wisp
// tint     a pixelfx palette name that recolours the ordinary monsters, or null
// scale    multipliers on monster HP and damage
// quota    how many monsters to defeat; max   how many may be alive at once; every   seconds between two spawns
// reward   shards for finishing (the shards that monsters drop on the way are added, as in every run)
import { G, $, clamp } from "./state.js";
import { VW, WORLD_W } from "./world.js";
import { spawnEnemy } from "./entities.js";
import { toast } from "./ui.js";

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

let timer = 1, n = 0, shown = -1;

/** Called by run.js when a hunt begins. */
export function startHunt() {
  timer = 1;
  n = 0;
  shown = -1;
  toast("Defeat " + G.hunt.quota + " monsters", 2.4);
}

/** Called every frame while a hunt is playing: shows the count and spawns the next monster when it is due. */
export function updateHunt(dt) {
  const h = G.hunt;
  if (!h) return;
  if (G.kills !== shown) {
    shown = G.kills;
    $("chName").textContent = h.title + " " + Math.min(shown, h.quota) + "/" + h.quota;
  }
  // never spawn more than are still needed, and never more than `max` at once
  if (G.kills + G.enemies.length >= h.quota || G.enemies.length >= h.max) return;
  timer -= dt;
  if (timer > 0) return;
  timer = h.every;
  const side = n % 2 ? 1 : -1, type = h.kinds[n % h.kinds.length];
  n++;
  let x = side > 0 ? G.cam + VW + 24 : G.cam - 24;
  if (x < 10 || x > WORLD_W - 10) x = side > 0 ? G.cam - 24 : G.cam + VW + 24; // the other edge
  G.enemies.push(spawnEnemy(type, G.M[type], clamp(x, 10, WORLD_W - 10), { scale: h.scale, tint: h.tint }));
}
