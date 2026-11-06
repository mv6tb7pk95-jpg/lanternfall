// Lanternfall: the hub. A walkable square with a Shop, the Lantern Forge, Loadout, the Party Board and the Dungeon Gate.
//
// How it fits in without touching the run loop: the hub is a "world" object like a run's map. While G.state is "hub",
// run.js still calls G.world.update(dt, cam) and drawRun() every frame (it does that for any state), so this file wraps
// that world's update() to walk the hero, find the nearest building and move the camera, and wraps drawProps() to draw
// the buildings behind the hero. main.js and run.js need no change for the walking itself.
//
// Screens: standing at a building and pressing E / Enter (or tapping the prompt) calls hubActions[id]. menu.js fills
// hubActions with the functions that open each screen, so this file does not import the menus (no import cycle).
// G.state is "menu" while a screen is open and "hub" while the hero can walk.
import { $, G, inp, clamp, fail, setStatus } from "./state.js";
import { show, toast } from "./ui.js";
import { CLASSES } from "./skills.js";
import { createPlayer, updatePlayer } from "./entities.js";
import { VW, WORLD_W, createWorld } from "./world.js";
import { BUILDINGS, HUB_THEME, SPAWN_X } from "./hubmap.js";
import { drawBuildings } from "./hubdraw.js";

/** building id -> function that opens its screen. Filled by menu.js. */
export const hubActions = {};

let world = null; // the hub world, built once
let clock = 0; // seconds, for the flicker of the lights
let near = null; // the building the hero is standing at, or null
let lastX = SPAWN_X; // where he stood when he left, so he comes back to the same spot

const KEYS = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
const JUMP = new Set([" ", "ArrowUp", "w", "W"]);
const ENTER = new Set(["e", "E", "Enter", "ArrowDown", "s", "S"]);

function setNear(b) {
  if (b === near) return;
  near = b;
  const pr = $("hubPrompt");
  if (!pr) return;
  pr.hidden = !b;
  if (b) pr.textContent = "Enter " + b.title + "  ·  E or tap";
}

/** One frame of walking. Called from the hub world's update(), only while G.state is "hub". */
function tick(dt) {
  const p = G.player;
  if (!p) return;
  updatePlayer(p, dt, inp);
  inp.jump = false;
  let hit = null, best = Infinity;
  for (const b of BUILDINGS) {
    const d = Math.abs(p.x - b.x);
    if (d <= b.w / 2 + 8 && d < best) {
      best = d;
      hit = b;
    }
  }
  setNear(hit);
  const target = clamp(Math.round(p.x - VW / 2), 0, WORLD_W - VW);
  G.cam = Math.round(G.cam + (target - G.cam) * Math.min(1, dt * 6));
}

async function makeWorld() {
  const w = await createWorld(HUB_THEME);
  const update = w.update, drawProps = w.drawProps;
  w.update = (dt, cam) => {
    clock += dt;
    update(dt, cam); // the fire props
    if (G.state === "hub") tick(dt);
  };
  w.drawProps = (f, cam) => {
    drawBuildings(f, clock, near ? near.id : null); // behind the hero and the fire
    drawProps(f, cam);
  };
  return w;
}

/** Put the hero in the hub. Safe to call from any screen. */
export async function enterHub() {
  if (G.loading) return;
  G.loading = true;
  setStatus("Loading the gatehouse…");
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
  p.x = lastX;
  Object.assign(G, {
    state: "hub", home: "hub", world, player: p,
    enemies: [], runs: [], fxs: [], shots: [], missiles: [], zones: [],
    boss: null, bossOut: false, bossDown: false, hitStop: 0, shakeT: 0, shake0: 0, shakeAmp: 0,
    cam: clamp(Math.round(lastX - VW / 2), 0, WORLD_W - VW),
  });
  inp.left = inp.right = inp.jump = inp.atk = false;
  setNear(null);
  document.body.classList.add("hub"); // game.css / hub.css hide the run HUD and the attack buttons in the hub
  show(null);
}

function leave() {
  if (G.player) lastX = G.player.x;
  G.state = "menu";
  inp.left = inp.right = inp.jump = inp.atk = false;
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
    const k = KEYS[e.key], jump = JUMP.has(e.key), enter = ENTER.has(e.key);
    if (!k && !jump && !enter) return;
    e.preventDefault();
    if (e.repeat) return;
    if (k) inp[k] = true; // main.js's keyup handler clears left / right for every state
    else if (jump) inp.jump = true;
    else interact();
  });
  const pr = $("hubPrompt");
  if (pr)
    pr.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      interact();
    });
}
