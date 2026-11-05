// Lanternfall: draws the real pixelfx fire effects (campfire, brazier, torch, candle) with pixelfx's own
// createFx / createFrame / composite. This file is the only new code; everything under src/core and
// src/fx is copied from https://github.com/patch-gg/pixelfx.

import { createFx, createFrame, clearFrame, composite, hex } from "./core/index.js";
import * as campfire from "./fx/fire/campfire.js";
import * as brazier from "./fx/fire/brazier.js";
import * as torch from "./fx/fire/torch.js";
import * as candle from "./fx/fire/candle.js";

const EFFECTS = [campfire, brazier, torch, candle];
const BG = hex("#15121f");
const stage = document.getElementById("stage");
const pauseBtn = document.getElementById("pause");

let scale = innerWidth >= 1300 ? 3 : 2;
let paused = false;

const fail = (msg) => (window.__lfShow ? window.__lfShow(msg) : console.error(msg));

// one canvas per effect, at the effect's native pixel size (enlarged with CSS, crisp pixels)
const items = EFFECTS.map((mod) => {
  const meta = mod.meta, [w, h] = meta.size, [ox, oy] = meta.origin;
  const card = document.createElement("figure");
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const cap = document.createElement("figcaption");
  cap.textContent = meta.name;
  card.append(cv, cap);
  stage.append(card);
  const bytes = new Uint8ClampedArray(w * h * 4);
  return {
    meta, w, h, cv, cap,
    ctx: cv.getContext("2d"),
    fx: createFx(mod, { x: ox, y: oy }), // the effect's origin sits at (ox, oy) in its frame
    frame: createFrame(w, h),
    bytes,
    img: new ImageData(bytes, w, h),
    failed: false,
  };
});

function applyScale() {
  for (const it of items) {
    it.cv.style.width = it.w * scale + "px";
    it.cv.style.height = it.h * scale + "px";
  }
  for (const b of document.querySelectorAll("[data-scale]")) b.classList.toggle("on", Number(b.dataset.scale) === scale);
}
for (const b of document.querySelectorAll("[data-scale]")) {
  b.addEventListener("click", () => {
    scale = Number(b.dataset.scale);
    applyScale();
  });
}
pauseBtn.addEventListener("click", () => {
  paused = !paused;
  pauseBtn.textContent = paused ? "Play" : "Pause";
});
applyScale();

let last = performance.now();
let drewOnce = false;
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) {
    for (const it of items) {
      if (it.failed) continue;
      try {
        it.fx.update(dt);
        clearFrame(it.frame);
        it.fx.draw(it.frame);
        composite(it.frame, it.bytes, BG, 1);
        it.ctx.putImageData(it.img, 0, 0);
      } catch (e) {
        it.failed = true;
        it.cap.textContent = it.meta.name + " (error)";
        fail(it.meta.name + ": " + ((e && e.stack) || e));
      }
    }
    if (!drewOnce) {
      drewOnce = true;
      window.__lfReady = true;
    }
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
