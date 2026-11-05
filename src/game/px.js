// Lanternfall: the one place that talks to the real pixelfx library.
// pixelfx (https://github.com/patch-gg/pixelfx, MIT) is loaded straight from GitHub through jsDelivr,
// pinned to commit a841596, so the whole core and all 244 effects are the untouched originals.
// Every other game file imports pixelfx from here, so there is exactly one copy of the core in the page.
export * from "https://cdn.jsdelivr.net/gh/patch-gg/pixelfx@a841596/src/core/index.js";

export const FX_BASE = "https://cdn.jsdelivr.net/gh/patch-gg/pixelfx@a841596/src/fx/";

const cache = new Map();

/** Import one pixelfx effect by its path, e.g. loadFx("fire/torch") or loadFx("moves/arrow-shot"). */
export function loadFx(path) {
  let p = cache.get(path);
  if (!p) {
    p = import(FX_BASE + path + ".js").catch((e) => {
      cache.delete(path);
      throw new Error("could not load pixelfx effect " + path + ": " + (e && e.message ? e.message : e));
    });
    cache.set(path, p);
  }
  return p;
}

// ---- small helpers that write straight into a frame's color buffer (world coordinates, opaque pixels)

/** A filled rectangle. */
export function pxRect(f, x, y, w, h, c) {
  const x0 = Math.round(x) - (f.ox | 0), y0 = Math.round(y) - (f.oy | 0);
  for (let j = 0; j < h; j++) {
    const yy = y0 + j;
    if (yy < 0 || yy >= f.h) continue;
    for (let i = 0; i < w; i++) {
      const xx = x0 + i;
      if (xx < 0 || xx >= f.w) continue;
      f.color[yy * f.w + xx] = c;
    }
  }
}

/** A soft two-row shadow on the floor under something, only on empty pixels. */
export function pxShadow(f, cx, y, hw, alpha = 110) {
  const sh = (alpha << 24) >>> 0;
  for (let dy = 0; dy < 2; dy++) {
    const py = y + dy - (f.oy | 0);
    if (py < 0 || py >= f.h) continue;
    for (let x = -hw + dy * 2; x <= hw - dy * 2; x++) {
      const px = Math.round(cx) + x - (f.ox | 0);
      if (px < 0 || px >= f.w) continue;
      const i = py * f.w + px;
      if (f.color[i] === 0) f.color[i] = sh;
    }
  }
}
