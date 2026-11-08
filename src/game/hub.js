// Lanternfall: the hub as rooms (fieldmaps.js). Walking is in fieldwalk.js, drawing in fielddraw.js.
// The hub is a "world" object like a run's map: while G.state is "hub", run.js calls G.world.update(dt) and drawRun() every frame.
// Keys: A D / arrows walk, Space jumps, Down + Space drops through a platform, Up / Down climb a rope.
// Up at a door (and not at a rope) enters it; E and Enter always enter. Touch: the stick (controls.js) sets inp.up / inp.down.
// Doors: "building" opens a screen through hubActions[id] (filled by menu.js); "portal" fades to another room;
// "hunt" calls hubActions.hunt(huntId) (menu.js opens the class select for that hunt).
// leave() closes the square and remembers where the hero stands. Doors call it, and so does the sidebar (menu.js).
import { $, G, inp, fail, setStatus } from "./state.js";
import { show, toast } from "./ui.js";
import { CLASSES } from "./skills.js";
import { createPlayer } from "./entities.js";
import { VW, VH } from "./world.js";
import { ROOMS, START, doorById } from "./fieldmaps.js";
import { stepField, placeAt, doorAt, fieldCam } from "./fieldwalk.js";
import { createFieldScene } from "./fielddraw.js";

export const hubActions = {};

const scenes = {};
let world = null, scene = null, room = null, near = null, veil = null, busy = false, prevUp = false;
let last = { room: START.room, x: START.x, y: START.y };

const KEYS = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
const UP = new Set(["ArrowUp", "w", "W"]), DOWN = new Set(["ArrowDown", "s", "S"]), ENTER = new Set(["e", "E", "Enter"]);
const clearInp = () => { inp.left = inp.right = inp.jump = inp.atk = inp.up = inp.down = false; };
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function setNear(d) {
  if (d === near) return;
  near = d;
  const pr = $("hubPrompt");
  if (!pr) return;
  pr.hidden = !d;
  if (d) pr.textContent = (d.kind === "hunt" ? "Hunt: " : "Enter ") + d.title + "  ·  E or tap";
}

function makeVeil() {
  if (veil) return veil;
  veil = document.createElement("div");
  veil.id = "hubVeil";
  veil.setAttribute("aria-hidden", "true");
  veil.style.cssText = "position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0;color:#f2e6c8;font-family:inherit;font-weight:700;font-size:22px;letter-spacing:.04em;text-shadow:0 2px 8px #000;";
  document.body.appendChild(veil);
  return veil;
}

/** Fade to black, run cb, then the caller reveals the next room. */
function cover(cb) {
  const v = makeVeil();
  v.textContent = "";
  v.style.background = "#05060d";
  v.style.transition = calm() ? "none" : "opacity .25s ease";
  void v.offsetWidth;
  v.style.opacity = "1";
  setTimeout(cb, calm() ? 40 : 270);
}

/** Show the room's name and fade the black away. dark = false shows only the name. */
function reveal(name, dark = true) {
  const v = makeVeil();
  v.textContent = name;
  v.style.transition = "none";
  v.style.background = dark ? "#05060d" : "transparent";
  v.style.opacity = "1";
  void v.offsetWidth;
  v.style.transition = calm() ? "opacity .2s linear .5s" : "opacity .6s ease .35s";
  v.style.opacity = "0";
}

const ropeNear = (p) => room.ropes.some((R) => Math.abs(p.x - R.x) <= 9 && p.gy + p.y >= R.top - 2 && p.gy + p.y <= R.bottom + 2);

function tick(dt) {
  const p = G.player;
  if (!p || busy) return;
  stepField(p, room, dt, inp, inp);
  inp.jump = false;
  const up = !!inp.up;
  const enter = up && !prevUp && near && !ropeNear(p);
  prevUp = up;
  if (enter) return interact();
  setNear(doorAt(room, p));
  const c = fieldCam(p, room, VW, VH), k = Math.min(1, dt * 6);
  G.cam = Math.round(G.cam + (c.x - G.cam) * k);
  G.camY = Math.round(G.camY + (c.y - G.camY) * k);
}

function makeWorld() {
  return {
    vertical: true,
    update(dt) {
      scene.update(dt, G.cam, G.camY || 0);
      if (G.state === "hub") tick(dt);
    },
    drawBg: (cx, cy) => scene.drawBg(cx, cy),
    drawProps: (f, cx, cy) => scene.drawProps(f, cx, cy, near ? near.id : null),
  };
}

const sceneOf = async (r) => (scenes[r.id] ||= await createFieldScene(r));

export async function enterHub() {
  if (G.loading) return;
  G.loading = true;
  setStatus("Loading the camp…");
  try {
    room = ROOMS[last.room] || ROOMS[START.room];
    scene = await sceneOf(room);
    if (!world) world = makeWorld();
  } catch (e) {
    G.loading = false;
    setStatus("");
    return fail(e);
  }
  G.loading = false;
  setStatus("");
  const p = createPlayer(CLASSES.warden, {});
  placeAt(p, room, last.x, last.y);
  const c = fieldCam(p, room, VW, VH);
  Object.assign(G, {
    state: "hub", home: "hub", world, player: p,
    enemies: [], runs: [], fxs: [], shots: [], missiles: [], zones: [],
    boss: null, bossOut: false, bossDown: false, hitStop: 0, shakeT: 0, shake0: 0, shakeAmp: 0,
    cam: c.x, camY: c.y,
  });
  busy = false;
  prevUp = false;
  clearInp();
  setNear(null);
  document.body.classList.add("hub");
  show(null);
  reveal(room.name, false);
}

/** Close the square: remember where the hero stands (so Back returns him there), stop the walking, hide the prompt. */
export function leave() {
  const p = G.player;
  if (p) last = { room: room.id, x: p.x, y: p.gy };
  G.state = "menu";
  clearInp();
  setNear(null);
  document.body.classList.remove("hub");
}

function travel(d) {
  busy = true;
  clearInp();
  cover(async () => {
    try {
      const to = ROOMS[d.to];
      scene = await sceneOf(to);
      room = to;
      const a = doorById(to, d.arrive);
      placeAt(G.player, to, a ? a.x : to.spawn.x, a ? a.y : to.spawn.y);
      const c = fieldCam(G.player, to, VW, VH);
      G.cam = c.x;
      G.camY = c.y;
      setNear(null);
      reveal(to.name);
    } catch (e) {
      fail(e);
    }
    busy = false;
  });
}

export function interact() {
  if (G.state !== "hub" || busy || !near) return;
  const d = near;
  if (d.kind === "portal") return travel(d);
  const fn = d.kind === "hunt" ? hubActions.hunt && (() => hubActions.hunt(d.hunt)) : hubActions[d.id];
  if (!fn) return toast(d.title + " is not open yet.");
  leave();
  fn();
}

export function initHub() {
  addEventListener("keydown", (e) => {
    if (G.state !== "hub") return;
    const key = e.key, k = KEYS[key];
    if (!k && key !== " " && !UP.has(key) && !DOWN.has(key) && !ENTER.has(key)) return;
    e.preventDefault();
    if (e.repeat || busy) return;
    if (k) inp[k] = true;
    else if (key === " ") inp.jump = true;
    else if (UP.has(key)) inp.up = true;
    else if (DOWN.has(key)) inp.down = true;
    else interact();
  });
  addEventListener("keyup", (e) => {
    if (UP.has(e.key)) inp.up = false;
    else if (DOWN.has(e.key)) inp.down = false;
  });
  const pr = $("hubPrompt");
  if (pr) pr.addEventListener("pointerdown", (ev) => { ev.preventDefault(); interact(); });
}
