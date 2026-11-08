// Lanternfall: ambient polish for the hub rooms (fielddraw.js) and the hunting grounds (hunts.js).
// It adds what the plain painted backdrop lacks: real pixelfx loops (spirit flames, floating ice crystals), drifting
// translucent mist, fireflies / embers / dust, twinkling glints, bubbling lava, a vignette and glowing floor cracks.
// Nothing here changes the rules of the game. Every draw call only writes pixels; a hunt world is wrapped by decorateWorld().
// Translucent pixels use the same trick as pxShadow in px.js: the alpha byte of the colour buffer. They are written only
// onto empty pixels, so they sit behind the doors, props, enemies and the hero, which are drawn after them.
import * as PX from "./px.js";
import { VW, VH, GY, WORLD_W, tintOpts } from "./world.js";

const { createFx, hex, mix, rand, loadFx, pxRect } = PX;
const BLK = hex("#000000"), WHT = hex("#ffffff");
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const HALO = [[-1, 0], [2, 0], [0, -1], [0, 2], [-1, -1], [2, -1], [-1, 2], [2, 2]];
const PLUS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/** A translucent colour for the colour buffer: alpha 0..255 in the top byte, like pxShadow's shadow. */
export const tr = (c, a) => ((Math.max(0, Math.min(255, a | 0)) << 24) | (c & 0xffffff)) >>> 0;

/** Write one pixel, only if it is still empty. x, y are world coordinates. */
function put(f, x, y, c) {
  const sx = Math.round(x) - (f.ox | 0), sy = Math.round(y) - (f.oy | 0);
  if (sx < 0 || sy < 0 || sx >= f.w || sy >= f.h) return;
  const i = sy * f.w + sx;
  if (f.color[i] === 0) f.color[i] = c;
}

/**
 * A drifting band of translucent mist, drawn in 2x2 blocks so it stays chunky like the rest of the pixel art.
 * o: { y (world y of the band's middle), h (height), col "#rrggbb", a (strongest alpha 0..255), speed, seed }
 */
export function mist(f, t, o) {
  const c = hex(o.col), ox = f.ox | 0, oy = f.oy | 0, top = o.y - o.h / 2, sp = o.speed ?? 0.5, sd = o.seed ?? 0;
  for (let j = 0; j < o.h; j += 2) {
    const sy = Math.round(top + j) - oy;
    if (sy < 0 || sy >= f.h - 1) continue;
    const edge = 1 - Math.abs((j / o.h) * 2 - 1); // 0 at the band's top and bottom, 1 in the middle
    for (let sx = 0; sx < f.w; sx += 2) {
      const wx = sx + ox;
      const d = 0.5 + 0.25 * Math.sin(wx * 0.045 + t * sp + sd) + 0.25 * Math.sin(wx * 0.017 - t * sp * 0.6 + sd * 2 + j * 0.05);
      const a = (Math.round(clamp01((d - 0.25) / 0.75) * edge * 4) / 4) * o.a; // four steps: a banded, pixel-art look
      if (a < 8) continue;
      const col = tr(c, a), i0 = sy * f.w + sx, wide = sx + 1 < f.w;
      if (f.color[i0] === 0) f.color[i0] = col;
      if (wide && f.color[i0 + 1] === 0) f.color[i0 + 1] = col;
      if (f.color[i0 + f.w] === 0) f.color[i0 + f.w] = col;
      if (wide && f.color[i0 + f.w + 1] === 0) f.color[i0 + f.w + 1] = col;
    }
  }
}

/**
 * Drifting lights. o: { kind "firefly" | "ember" | "dust", n, x0, x1, y0, y1 (the area, world px), seed, hi, lo (colours),
 * vy (px/s, ember and dust) }. Each one has its own phase, speed and size.
 */
export function motes(f, t, o) {
  const ox = f.ox | 0, oy = f.oy | 0, W = o.x1 - o.x0, H = o.y1 - o.y0, S = o.seed ?? 1, HI = hex(o.hi), LO = hex(o.lo);
  for (let i = 0; i < o.n; i++) {
    const r1 = rand(i, 1, S), r2 = rand(i, 2, S), r3 = rand(i, 3, S);
    let x, y;
    if (o.kind === "firefly") {
      x = o.x0 + r1 * W + 8 * Math.sin(t * 0.6 + i);
      y = o.y0 + r2 * H + 5 * Math.sin(t * 0.9 + i * 2);
    } else if (o.kind === "ember") {
      y = o.y1 - ((r2 * H + t * o.vy * (0.6 + r3 * 0.8)) % H); // rises
      x = o.x0 + r1 * W + 5 * Math.sin(t * 2 + i);
    } else {
      y = o.y0 + ((r2 * H + t * o.vy * (0.6 + r3 * 0.8)) % H); // falls slowly
      x = o.x0 + r1 * W + 6 * Math.sin(t + i);
    }
    if (x < ox - 4 || x > ox + f.w + 4 || y < oy - 4 || y > oy + f.h + 4) continue;
    if (o.kind === "firefly") {
      if (Math.sin(t * 2 + i * 3) > 0.2) {
        for (const [dx, dy] of HALO) put(f, x + dx, y + dy, tr(HI, 46));
        pxRect(f, x, y, 2, 2, HI);
      } else pxRect(f, x, y, 1, 1, LO);
    } else if (o.kind === "ember") {
      const k = (o.y1 - y) / H;
      if (k > 0.85 && i & 1) continue; // half of them die out near the top
      pxRect(f, x, y, 1, 1, mix(HI, LO, k));
      if (i % 5 === 0) put(f, x, y - 1, tr(HI, 90)); // a short tail on some
    } else {
      const tw = Math.sin(t * 3 + i * 5);
      pxRect(f, x, y, 1, 1, tw > 0.75 ? WHT : i % 3 ? HI : LO);
      if (tw > 0.92) for (const [dx, dy] of PLUS) put(f, x + dx, y + dy, tr(HI, 150)); // a twinkle
    }
  }
}

/** Twinkling glints at fixed spots (crystals). o: { pts: [[x, y], ...] in world px, col "#rrggbb" }. */
export function glints(f, t, o) {
  const C = hex(o.col);
  o.pts.forEach(([x, y], i) => {
    const ph = (t * 0.6 + i * 0.37) % 1;
    if (ph > 0.25) return;
    const k = Math.sin((ph / 0.25) * Math.PI); // 0 -> 1 -> 0 over a quarter of the cycle
    pxRect(f, x, y, 1, 1, WHT);
    if (k > 0.45) for (const [dx, dy] of PLUS) pxRect(f, x + dx, y + dy, 1, 1, C);
    if (k > 0.85) for (const [dx, dy] of PLUS) pxRect(f, x + dx * 2, y + dy * 2, 1, 1, C);
  });
}

/** Bubbling lava: bubbles swell on the surface and pop in a spray of sparks. o: { y (the lava surface), w (room width), n, seed }. */
export function lavaBubbles(f, t, o) {
  const hot = hex("#ffcf6a"), mid = hex("#ff7a2a"), dark = hex("#a82a0a");
  for (let i = 0; i < o.n; i++) {
    const per = 1.8 + rand(i, 1, o.seed) * 1.6, ph = ((t + rand(i, 2, o.seed) * 10) % per) / per;
    const x = Math.round(rand(i, 3, o.seed) * o.w), y = o.y + 4 + (i % 3) * 4;
    if (ph < 0.7) {
      const r = 1 + Math.floor((ph / 0.7) * 3); // 1..3
      pxRect(f, x - r, y - r, 2 * r + 1, 2 * r + 1, mid);
      pxRect(f, x - r + 1, y - r + 1, 2 * r - 1, 2 * r - 1, dark);
      pxRect(f, x - r + 1, y - r + 1, 1, 1, hot);
    } else if (ph < 0.9) {
      const k = (ph - 0.7) / 0.2;
      for (const s of [-1, 0, 1]) pxRect(f, x + s * (2 + k * 5), y - 3 - k * 9 + k * k * 8 - (s === 0 ? 3 : 0), 1, 1, k < 0.5 ? hot : mid);
    }
  }
}

// ---------------------------------------------------------------- grading the backdrop
let VIG = null;
const VSTR = [0, 0.12, 0.24, 0.36, 0.5];
function vignette() {
  if (VIG) return VIG;
  VIG = new Uint8Array(VW * VH);
  for (let y = 0; y < VH; y++)
    for (let x = 0; x < VW; x++) {
      const d = Math.hypot((x - VW / 2) / (VW / 2), (y - VH / 2) / (VH / 2));
      VIG[y * VW + x] = Math.round(clamp01((d - 0.62) / 0.75) * 4); // four steps toward the corners
    }
  return VIG;
}

/** Darken the corners of the finished backdrop (in place). o.vignette: 0.5 is the default strength. */
export function grade(bg, o = {}) {
  const k = (o.vignette ?? 0.5) / 0.5, V = vignette();
  for (let i = 0; i < bg.length; i++) {
    const l = V[i];
    if (l) bg[i] = mix(bg[i], BLK, Math.min(0.8, VSTR[l] * k));
  }
}

/** Glowing cracks in a stone floor that pulse slowly. o: { y (the floor line, screen = world here), hot "#rrggbb", seed }. */
export function cracks(bg, cam, t, o) {
  const hot = hex(o.hot);
  for (let cell = Math.floor(cam / 16); cell <= Math.floor((cam + VW) / 16) + 1; cell++) {
    const r = rand(cell, 5, o.seed ?? 1);
    if (r < 0.55) continue;
    const cx = cell * 16 + 1 + ((r * 13) | 0) - cam, pulse = 0.45 + 0.35 * Math.sin(t * 2.5 + cell);
    for (let j = 0; j < 6; j++) {
      const sx = cx + (j % 2 ? 1 : 0) + (j > 3 ? 1 : 0), sy = o.y + 2 + j;
      if (sx < 0 || sx >= VW || sy < 0 || sy >= VH) continue;
      bg[sy * VW + sx] = mix(bg[sy * VW + sx], hot, pulse);
    }
  }
}

// ---------------------------------------------------------------- the hunting grounds
// Positions are world pixels; the floor line is GY. effects are real pixelfx loops (path, xs, y, opts, tints).
const wallGlints = (seed, n) => Array.from({ length: n }, (_, i) => [(rand(i, 1, seed) * WORLD_W) | 0, 50 + ((rand(i, 2, seed + 1) * 90) | 0)]);

export const HUNT_AMBIENT = {
  grave: {
    effects: [{ path: "fire/spirit-flame", xs: [170, 430, 700, 960, 1190], y: GY - 14 }],
    mist: [
      { y: GY - 14, h: 30, col: "#7fe0b0", a: 54, speed: 0.5, seed: 1 },
      { y: GY - 56, h: 24, col: "#4a7a68", a: 30, speed: 0.3, seed: 4 },
    ],
    motes: [{ kind: "firefly", n: 28, x0: 0, x1: WORLD_W, y0: 50, y1: 140, seed: 21, hi: "#9fffe0", lo: "#3f9a78" }],
    grade: { vignette: 0.55 },
  },
  hollow: {
    effects: [{ path: "ice/ice-crystal", xs: [140, 360, 600, 830, 1060, 1230], y: GY, opts: { height: 30 }, tints: [null, "#c07aff"] }],
    mist: [{ y: GY - 12, h: 24, col: "#7aa8ff", a: 40, speed: 0.4, seed: 2 }],
    motes: [{ kind: "dust", n: 50, x0: 0, x1: WORLD_W, y0: 20, y1: GY, seed: 31, hi: "#c9d8ff", lo: "#7aa8ff", vy: 10 }],
    glints: { pts: wallGlints(71, 20), col: "#a6ecff" },
    grade: { vignette: 0.5 },
  },
  slag: {
    mist: [{ y: GY - 18, h: 34, col: "#ff6a2a", a: 40, speed: 0.7, seed: 3 }],
    motes: [{ kind: "ember", n: 44, x0: 0, x1: WORLD_W, y0: 30, y1: GY, seed: 41, hi: "#ffb347", lo: "#ff3a1a", vy: 22 }],
    grade: { vignette: 0.5, cracks: { y: GY, hot: "#ff7a2a", seed: 9 } },
  },
};

/**
 * Wrap a world built by createWorld() (world.js) so it also shows the ambience of hunt `id`.
 * The wrapping is done at once (mist, lights, vignette); the pixelfx loops join as soon as they have loaded.
 * If an effect cannot be loaded, it is skipped and the rest still works.
 */
export async function decorateWorld(world, id) {
  const S = HUNT_AMBIENT[id];
  if (!S || !world || world.ambient) return;
  world.ambient = true;
  const list = [];
  let t = 0;
  const near = (x, cam) => x > cam - 90 && x < cam + VW + 90;
  const update = world.update, props = world.drawProps, bgOf = world.drawBg;
  world.update = (dt, cam) => {
    update(dt, cam);
    t += dt;
    for (const p of list) if (near(p.x, cam)) p.fx.update(dt);
  };
  world.drawProps = (f, cam, cy) => {
    props(f, cam, cy);
    for (const m of S.mist || []) mist(f, t, m);
    for (const m of S.motes || []) motes(f, t, m);
    if (S.glints) glints(f, t, S.glints);
    for (const p of list) if (near(p.x, cam)) p.fx.draw(f);
  };
  world.drawBg = (cam, cy) => {
    const bg = bgOf(cam, cy);
    grade(bg, S.grade);
    if (S.grade && S.grade.cracks) cracks(bg, cam, t, S.grade.cracks);
    return bg;
  };
  for (const e of S.effects || []) {
    try {
      const mod = await loadFx(e.path);
      e.xs.forEach((x, i) => {
        const tint = e.tints ? e.tints[i % e.tints.length] : null;
        list.push({ x, fx: createFx(mod, { x, y: e.y, seed: (mod.meta.options.seed ?? 1) + i * 3, ...(e.opts || {}), ...tintOpts(mod, tint, 0.8) }) });
      });
    } catch (err) {
      console.warn("ambient effect skipped:", e.path, err);
    }
  }
}
