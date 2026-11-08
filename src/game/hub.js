// Lanternfall: the hub. Four rooms (Upper Camp, Catacombs, Crystal Mines, Ember Foundry) with a Shop, the Lantern Forge,
// Loadout, the Party Board and the Dungeon Gate, each standing on its own tier (hubworld.js).
//
// One room is on screen at a time (hubrooms.js). The camera is locked inside the room's box. When the hero walks through
// an exit (staircase, ladder, bridge, rails) he enters the next room: the screen fades through black, the camera cuts to
// the new room and its name appears.
//
// How it fits in without touching the run loop: the hub is a "world" object like a run's map. While G.state is "hub",
// run.js still calls G.world.update(dt, cam) and drawRun() every frame (it does that for any state), so this file's world
// walks the hero (hubwalk.js), finds the building he stands at and moves the camera, and draws the buildings (hubdraw.js).
// The world has vertical = true, so run.js scrolls it up and down with G.camY as well.
//
// Keys: left / right (A D) walk. Space and the Jump button jump. Up (W) takes hold of a ladder or climbs a stair, held.
// Down (S): climbs down a ladder; away from a ladder it enters the building. E and Enter always enter.
// Touch: the stick sets inp.up / inp.down (controls.js), so pushing it up or down climbs.
//
// Screens: standing at a building and pressing E / Enter (or tapping the prompt) calls hubActions[id]. menu.js fills
// hubActions with the functions that open each screen, so this file does not import the menus (no import cycle).
// G.state is "menu" while a screen is open and "hub" while the hero can walk.
import { $, G, inp, fail, setStatus } from "./state.js";
import { show, toast } from "./ui.js";
import { CLASSES } from "./skills.js";
import { createPlayer } from "./entities.js";
import { VW, VH } from "./world.js";
import { SPAWN } from "./hubworld.js";
import { walkStep, canClimb, onTier, placeHero } from "./hubwalk.js";
import { roomAt, roomCam } from "./hubrooms.js";
import { createHubScene } from "./hubscene.js";
import { HUB_BUILDINGS, drawHub } from "./hubdraw.js";

/** building id -> function that opens its screen. Filled by menu.js. */
export const hubActions = {};

let world = null; // the hub world, built once
let clock = 0; // seconds, for the flicker of the lights
let near = null; // the building the hero is standing at, or null
let room = null; // the room on screen (hubrooms.js)
let lastX = SPAWN.x; // where he stood when he left, so he comes back to the same spot and tier
let lastY = SPAWN.y;
let veil = null; // the full-screen cover used for the room fade

const KEYS = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
const UP = new Set(["ArrowUp", "w", "W"]);
const DOWN = new Set(["ArrowDown", "s", "S"]);
const ENTER = new Set(["e", "E", "Enter"]);

function setNear(b) {
  if (b === near) return;
  near = b;
  const pr = $("hubPrompt");
  if (!pr) return;
  pr.hidden = !b;
  if (b) pr.textContent = "Enter " + b.title + "  ·  E or tap";
}

/** Show the room's name. dark = true covers the screen in black first (a room change), false shows only the name. */
function announce(name, dark) {
  if (!veil) {
    veil = document.createElement("div");
    veil.id = "hubVeil";
    veil.setAttribute("aria-hidden", "true");
    veil.style.cssText =
      "position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;pointer-events:none;" +
      "opacity:0;color:#f2e6c8;font-family:inherit;font-weight:700;font-size:22px;letter-spacing:.04em;text-shadow:0 2px 8px #000;";
    document.body.appendChild(veil);
  }
  veil.textContent = name;
  veil.style.transition = "none";
  veil.style.background = dark ? "#05060d" : "transparent";
  veil.style.opacity = "1";
  void veil.offsetWidth; // restart the CSS transition
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  veil.style.transition = calm ? "opacity .2s linear .5s" : "opacity .6s ease .35s";
  veil.style.opacity = "0";
}

/** One frame of walking. Called from the hub world's update(), only while G.state is "hub". */
function tick(dt) {
  const p = G.player;
  if (!p) return;
  walkStep(p, dt, inp, inp); // inp.up / inp.down are the climb keys
  inp.jump = false;
  let hit = null, best = Infinity;
  for (const b of HUB_BUILDINGS) {
    if (!onTier(p, b.y)) continue; // only the tier the door stands on
    const d = Math.abs(p.x - b.x);
    if (d <= b.w / 2 + 8 && d < best) {
      best = d;
      hit = b;
    }
  }
  setNear(hit);
  const r = roomAt(p.x, p.gy, room);
  const c = roomCam(p, r, VW, VH);
  if (r !== room) {
    room = r; // he went through an exit: cut to the new room under the fade
    G.cam = c.x;
    G.camY = c.y;
    announce(room.name, true);
    return;
  }
  const k = Math.min(1, dt * 6);
  G.cam = Math.round(G.cam + (c.x - G.cam) * k);
  G.camY = Math.round((G.camY ?? c.y) + (c.y - (G.camY ?? c.y)) * k);
}

async function makeWorld() {
  const scene = await createHubScene();
  return {
    vertical: true, // run.js: scroll this world up and down too
    update(dt) {
      clock += dt;
      scene.update(dt, G.cam, G.camY || 0); // the fire props
      if (G.state === "hub") tick(dt);
    },
    drawBg: (cx, cy) => scene.drawBg(cx, cy),
    drawProps(f, cx, cy) {
      drawHub(f, clock, near ? near.id : null); // buildings and camp props, behind the hero
      scene.drawProps(f, cx, cy); // the fire, the gears and the drifting lights
    },
  };
}

/** Put the hero in the hub. Safe to call from any screen. */
export async function enterHub() {
  if (G.loading) return;
  G.loading = true;
  setStatus("Loading the camp…");
  try {
    if (!world) world = await makeWorld();
  } catch (e) {
    G.loading = false;
    setStatus("");
    return fail(e);
  }
  G.loading = false;
  setStatus("");
  const p = createPlayer(CLASSES.warden, {}); // only the body is used here; the class matters in a run
  placeHero(p, lastX, lastY);
  room = roomAt(p.x, p.gy, null); // the room he stands in, with no bias from the last one
  const c = roomCam(p, room, VW, VH);
  Object.assign(G, {
    state: "hub", home: "hub", world, player: p,
    enemies: [], runs: [], fxs: [], shots: [], missiles: [], zones: [],
    boss: null, bossOut: false, bossDown: false, hitStop: 0, shakeT: 0, shake0: 0, shakeAmp: 0,
    cam: c.x, camY: c.y,
  });
  inp.left = inp.right = inp.jump = inp.atk = inp.up = inp.down = false;
  setNear(null);
  document.body.classList.add("hub"); // game.css / hub.css hide the run HUD and the attack buttons in the hub
  show(null);
  announce(room.name, false);
}

function leave() {
  if (G.player) {
    lastX = G.player.x;
    lastY = G.player.gy;
  }
  G.state = "menu";
  inp.left = inp.right = inp.jump = inp.atk = inp.up = inp.down = false;
  setNear(null);
  document.body.classList.remove("hub");
}

/** Open the screen of the building the hero is standing at. */
export function interact() {
  if (G.state !== "hub" || !near) return;
  const fn = hubActions[near.id];
  if (!fn) return toast(near.title + " is not open yet.");
  leave();
  fn();
}

/** Wire the keyboard and the prompt button. Called once by menu.js. */
export function initHub() {
  addEventListener("keydown", (e) => {
    if (G.state !== "hub") return;
    const key = e.key, k = KEYS[key];
    if (!k && key !== " " && !UP.has(key) && !DOWN.has(key) && !ENTER.has(key)) return;
    e.preventDefault();
    if (e.repeat) return;
    const p = G.player;
    if (k) inp[k] = true; // main.js's keyup handler clears left / right for every state
    else if (key === " ") inp.jump = true;
    else if (UP.has(key)) inp.up = true;
    else if (DOWN.has(key)) {
      if (p && (p.climb || canClimb(p, 1))) inp.down = true; // on or at the top of a ladder: climb down
      else interact(); // otherwise "down" enters the building, as before
    } else interact();
  });
  addEventListener("keyup", (e) => {
    if (UP.has(e.key)) inp.up = false;
    else if (DOWN.has(e.key)) inp.down = false;
  });
  const pr = $("hubPrompt");
  if (pr)
    pr.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      interact();
    });
}
