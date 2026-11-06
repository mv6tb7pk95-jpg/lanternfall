// Lanternfall: entry point. Wires the menus, loads the shared pixelfx effects, handles input and runs the loop.
// The game itself lives in small files: state.js, ui.js, menu.js, run.js, combat.js, attack.js, waves.js, forge.js.
// Screen layout is layout.js and the touch stick is controls.js. Every picture comes from the real pixelfx library (px.js).
// It expects the elements defined in game.html.
import { loadFx } from "./px.js";
import { G, inp, fail } from "./state.js";
import { hud } from "./ui.js";
import { cast } from "./combat.js";
import { initMenu } from "./menu.js";
import { initControls } from "./controls.js";
import { updateRun, drawRun } from "./run.js";

// ---------------------------------------------------------------- menus (wired first, so the buttons work at once)
initMenu();
initControls();

// ---------------------------------------------------------------- shared effects, loaded in the background
// beginRun() in run.js waits for this before it starts a run.
const SHARED = ["critters/slime", "critters/ghost", "critters/bat", "critters/snake", "critters/wisp", "impacts/hit-spark", "explosions/small-explosion"];
G.booted = Promise.all(
  SHARED.map(async (p) => {
    G.M[p.split("/")[1]] = await loadFx(p);
  })
);
G.booted.catch(fail);

// ---------------------------------------------------------------- keyboard
// Keys only act while a run is being played, so Space and Enter still work on the menu buttons and in dialogue.
const KEYS = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
const ATTACK = new Set(["j", "J", "k", "K", "z", "Z"]);

addEventListener("keydown", (e) => {
  if (G.state !== "play") return;
  const k = KEYS[e.key], jump = e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W", atk = ATTACK.has(e.key);
  if (k || jump || atk) e.preventDefault();
  if (e.repeat) return;
  if (k) inp[k] = true;
  else if (jump) inp.jump = true;
  else if (atk) inp.atk = true;
  else if (e.key >= "1" && e.key <= "9") cast(Number(e.key) - 1);
});
addEventListener("keyup", (e) => {
  const k = KEYS[e.key];
  if (k) inp[k] = false;
  if (ATTACK.has(e.key)) inp.atk = false;
});
addEventListener("blur", () => {
  inp.left = inp.right = inp.atk = false;
});

// ---------------------------------------------------------------- on-screen buttons (Jump and Attack; Attack repeats while held)
// The touch stick for walking and jumping is in controls.js. Each button gets an "on" look while it is held.
document.querySelectorAll("[data-pad]").forEach((b) => {
  const k = b.dataset.pad;
  const down = (ev) => {
    ev.preventDefault();
    if (G.state !== "play") return;
    inp[k] = true; // jump is cleared by the game loop after one frame
    b.classList.add("on");
  };
  const up = (ev) => {
    ev.preventDefault();
    b.classList.remove("on");
    if (k !== "jump") inp[k] = false;
  };
  b.addEventListener("pointerdown", down);
  b.addEventListener("pointerup", up);
  b.addEventListener("pointercancel", up);
  b.addEventListener("pointerleave", up);
});

// the controls are only on screen while a run is being played (game.css reads body.playing)
let playing = false;
function setPlaying(v) {
  if (v === playing) return;
  playing = v;
  document.body.classList.toggle("playing", v);
}

// ---------------------------------------------------------------- loop
let last = performance.now(), broken = false;
function loop(now) {
  if (broken) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    setPlaying(G.state === "play");
    updateRun(dt);
    drawRun();
    hud();
  } catch (e) {
    broken = true;
    fail(e);
    return;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.__lfReady = true;
