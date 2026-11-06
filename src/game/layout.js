// Lanternfall: sizes the canvas and tells the CSS which layout to use (game.css reads the variables set here).
//   Landscape: the canvas is centred. On a touch screen the controls sit in the lower corners over its edges.
//              With a keyboard, the canvas is made 96 px shorter so the skill bar under it never covers it.
//   Portrait:  the canvas sits at the top and the controls have the rest of the screen below it.
// The zoom is a whole number of DEVICE pixels, so every game pixel stays square and crisp on high-density screens.
import { VW, VH } from "./world.js";

const root = document.documentElement;
const body = document.body;
let scale = 2;

/** CSS pixels per game pixel. run.js uses it for the screen shake. */
export const getScale = () => scale;

export function layout() {
  const W = innerWidth, H = innerHeight, dpr = window.devicePixelRatio || 1;
  const port = H > W * 1.1;
  const touch = body.classList.contains("touch");
  // the space the canvas may use
  const roomW = W, roomH = port ? H * 0.5 : touch ? H : H - 96;
  const fit = Math.min(roomW / VW, roomH / VH);
  scale = Math.max(1, Math.floor(fit * dpr) / dpr);
  const cw = VW * scale, ch = VH * scale;
  const snap = (v) => Math.round(v * dpr) / dpr;
  const left = snap((W - cw) / 2);
  const top = port ? 8 : snap(Math.max(0, (roomH - ch) / 2));
  root.style.setProperty("--cw", cw + "px");
  root.style.setProperty("--ch", ch + "px");
  root.style.setProperty("--left", left + "px");
  root.style.setProperty("--top", top + "px");
  body.dataset.layout = port ? "port" : "land";
  body.dataset.small = cw < 480 ? "1" : "0";
}

// touch screens get the on-screen stick and buttons; the class is also added on the first real touch
if (window.matchMedia && matchMedia("(pointer: coarse)").matches) body.classList.add("touch");
addEventListener(
  "pointerdown",
  (e) => {
    if (e.pointerType === "touch" && !body.classList.contains("touch")) {
      body.classList.add("touch");
      layout();
    }
  },
  { passive: true }
);
addEventListener("resize", layout);
addEventListener("orientationchange", () => setTimeout(layout, 150));
if (window.visualViewport) visualViewport.addEventListener("resize", layout);
layout();
