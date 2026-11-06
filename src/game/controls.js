// Lanternfall: the touch stick. Drag it left or right to walk, push it up to jump.
// The Jump and Attack buttons are wired in main.js (data-pad). The keyboard is wired there too.
import { $, G, inp } from "./state.js";

export function initControls() {
  // no long-press menu and no pinch zoom while playing
  addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("gesturestart", (e) => e.preventDefault());

  const stick = $("stick"), knob = $("knob");
  if (!stick || !knob) return;

  const DEAD = 0.25; // fraction of the stick's reach before the hero starts walking
  const UP = 0.7; // fraction of the reach, upward, that counts as a jump
  let id = null; // the finger that owns the stick
  let armed = true; // a jump fires once per push; pull back down to arm it again

  function drive(ev) {
    const r = stick.getBoundingClientRect(), reach = r.width * 0.32;
    let dx = ev.clientX - (r.left + r.width / 2), dy = ev.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > reach) {
      dx = (dx / d) * reach;
      dy = (dy / d) * reach;
    }
    knob.style.transform = "translate(" + dx + "px," + dy + "px)";
    if (G.state !== "play") {
      inp.left = inp.right = false;
      return;
    }
    inp.left = dx < -reach * DEAD;
    inp.right = dx > reach * DEAD;
    if (dy < -reach * UP) {
      if (armed) {
        inp.jump = true; // the game loop clears it after one frame
        armed = false;
      }
    } else if (dy > -reach * 0.4) armed = true;
  }

  function release() {
    id = null;
    inp.left = inp.right = false;
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
}
