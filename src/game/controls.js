// Lanternfall: the touch stick. Drag it left or right to walk.
// In a run (G.state "play") pushing it up jumps. In the hub (G.state "hub") pushing it up or down sets inp.up / inp.down,
// the same flags the arrow keys set in hub.js: up grabs a rope or enters a door, down climbs down a rope.
// To drop through a platform on touch, hold the stick down and tap Jump.
// The Jump and Attack buttons are wired in main.js (data-pad). The keyboard is wired there too (and in hub.js for the hub).
import { $, G, inp } from "./state.js";

export function initControls() {
  // no long-press menu and no pinch zoom while playing
  addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("gesturestart", (e) => e.preventDefault());

  const stick = $("stick"), knob = $("knob");
  if (!stick || !knob) return;

  const DEAD = 0.25; // fraction of the stick's reach before the hero starts walking
  const UP = 0.7; // fraction of the reach, upward, that counts as a jump (in a run)
  const CLIMB = 0.5; // fraction of the reach, up or down, that counts as Up / Down in the hub
  let id = null; // the finger that owns the stick
  let armed = true; // a jump fires once per push; pull back down to arm it again

  // Up / Down in the hub. "held" means this stick set the flag. If the game clears the flag by itself (the hero went through
  // a door, or a screen opened), "lock" keeps it off until the stick is let go of, so he is not sent straight back through.
  const dirs = { up: { held: false, lock: false }, down: { held: false, lock: false } };
  function setDir(name, want) {
    const d = dirs[name];
    if (!want) {
      d.lock = false;
      if (d.held) {
        d.held = false;
        inp[name] = false;
      }
      return;
    }
    if (d.held && !inp[name]) d.lock = true;
    d.held = !d.lock;
    if (d.held) inp[name] = true;
  }

  function drive(ev) {
    const r = stick.getBoundingClientRect(), reach = r.width * 0.32;
    let dx = ev.clientX - (r.left + r.width / 2), dy = ev.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > reach) {
      dx = (dx / d) * reach;
      dy = (dy / d) * reach;
    }
    knob.style.transform = "translate(" + dx + "px," + dy + "px)";

    if (G.state === "play") {
      inp.left = dx < -reach * DEAD;
      inp.right = dx > reach * DEAD;
      setDir("up", false);
      setDir("down", false);
      if (dy < -reach * UP) {
        if (armed) {
          inp.jump = true; // the game loop clears it after one frame
          armed = false;
        }
      } else if (dy > -reach * 0.4) armed = true;
    } else if (G.state === "hub") {
      inp.left = dx < -reach * DEAD;
      inp.right = dx > reach * DEAD;
      setDir("up", dy < -reach * CLIMB);
      setDir("down", dy > reach * CLIMB);
      armed = true;
    } else {
      inp.left = inp.right = false;
      setDir("up", false);
      setDir("down", false);
    }
  }

  function release() {
    id = null;
    inp.left = inp.right = false;
    setDir("up", false);
    setDir("down", false);
    knob.style.transform = "";
    stick.classList.remove("on");
    armed = true;
  }

  stick.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    if (id !== null) return;
    id = ev.pointerId;
    try {
      stick.setPointerCapture(id);
    } catch (e) {
      /* the stick still works without capture */
    }
    stick.classList.add("on");
    drive(ev);
  });
  stick.addEventListener("pointermove", (ev) => {
    if (ev.pointerId === id) drive(ev);
  });
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"])
    stick.addEventListener(t, (ev) => {
      if (ev.pointerId === id) release();
    });

  // if the page loses focus while a key is held, no key-up arrives: let go of everything
  addEventListener("blur", () => {
    inp.up = inp.down = false;
    dirs.up.held = dirs.down.held = dirs.up.lock = dirs.down.lock = false;
  });
}
