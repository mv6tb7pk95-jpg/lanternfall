// Lanternfall: the title screen. A small pixel scene (arch, stairs, hanging lantern, embers) on #titleArt, and the Play button.
import { $ } from "./state.js";

const W = 160, H = 90;
const ARCH = [10, 6, 4, 3, 2, 1, 1, 0];

export function initTitle(onPlay) {
  const el = $("title"), cv = $("titleArt"), c = cv.getContext("2d");
  cv.width = W;
  cv.height = H;
  const em = Array.from({ length: 22 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 3 + Math.random() * 6 }));
  const r = (col, x, y, w, h) => {
    c.fillStyle = col;
    c.fillRect(x | 0, y | 0, w, h);
  };
  let t = 0, raf = 0;

  function draw() {
    t += 1 / 60;
    r("#07060d", 0, 0, W, H);
    for (let y = 0; y < H; y += 6) for (let x = -((y / 6) % 2) * 8; x < W; x += 16) r("#15122a", x + 1, y + 1, 14, 4);
    r("#2b2544", 46, 20, 68, 70);
    ARCH.forEach((o, i) => r("#07060d", 52 + o, 24 + i, 56 - o * 2, 1));
    r("#07060d", 52, 32, 56, 58);
    for (let i = 0; i < 4; i++) r(i % 2 ? "#3a3152" : "#2f2842", 44 - i * 6, 90 - (4 - i) * 5, 72 + i * 12, 5);
    const f = 0.34 + 0.08 * Math.sin(t * 7) + 0.04 * Math.sin(t * 17);
    const g = c.createRadialGradient(80, 44, 2, 80, 44, 54);
    g.addColorStop(0, "rgba(255,200,110," + f + ")");
    g.addColorStop(1, "rgba(255,200,110,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    r("#6b5a3a", 80, 24, 1, 14);
    r("#b8893a", 77, 38, 7, 2);
    r("#ffd27a", 78, 40, 5, 8);
    r("#fff2c0", 79, 42, 3, 4);
    r("#b8893a", 77, 48, 7, 2);
    for (const e of em) {
      e.y -= e.v / 60;
      if (e.y < 0) {
        e.y = H;
        e.x = 55 + Math.random() * 50;
      }
      r(e.v > 6 ? "#ffd27a" : "#e8733a", e.x, e.y, 1, 1);
    }
    raf = requestAnimationFrame(draw);
  }
  draw();

  $("play").addEventListener("click", () => {
    $("play").disabled = true;
    el.classList.add("out");
    onPlay();
    setTimeout(() => {
      el.hidden = true;
      cancelAnimationFrame(raf);
    }, 700);
  });
}

export function showTitle() {
  const el = $("title");
  el.hidden = false;
  el.classList.remove("out");
  $("play").disabled = false;
}
