// Lanternfall: draws the hub buildings and the camp props into the frame with the same pxRect helper the rest of the game uses.
// Pure drawing: it keeps no game state. hub.js calls drawHub() once per frame, before the fire props and the hero.
// Each building stands on its own tier: its x and floor y come from BUILDING_SPOTS in hubworld.js.
// The terrain, the lava, the lights and the fire props are painted by hubscene.js; this file draws what stands on it.
import { pxRect, hex, mix } from "./px.js";
import { VH } from "./world.js";
import { BUILDINGS, FONT } from "./hubmap.js";
import { BUILDING_SPOTS, PROPS } from "./hubworld.js";

const BLACK = hex("#000000"), WHITE = hex("#ffffff"), INK = hex("#120f1c"), DOOR = hex("#0b0912"), CHIM = hex("#2a2733");
const WOODC = hex("#6a4426"), IRONC = hex("#3c3c46"), IRONL = hex("#5a5f6a"), STEELC = hex("#b8c4d0");
const opaque = (c) => (c | 0xff000000) >>> 0; // make sure a mixed colour keeps full alpha (alpha is the top byte)

/** The five buildings with their x and floor y from the multi-tier map. hub.js uses it to find the one the hero stands at. */
export const HUB_BUILDINGS = BUILDINGS.filter((b) => BUILDING_SPOTS[b.id]).map((b) => ({ ...b, ...BUILDING_SPOTS[b.id] }));

const cache = new Map();
function palette(b) {
  let c = cache.get(b.id);
  if (!c) {
    const wall = hex(b.wall), roof = hex(b.roof), acc = hex(b.accent);
    c = {
      wall, roof, acc,
      shade: opaque(mix(wall, BLACK, 0.3)), hi: opaque(mix(wall, WHITE, 0.12)), roofHi: opaque(mix(roof, WHITE, 0.25)),
      accDim: opaque(mix(acc, BLACK, 0.55)), accLit: opaque(mix(acc, WHITE, 0.45)),
    };
    cache.set(b.id, c);
  }
  return c;
}

/** Text in the 3x5 font at an integer scale, centred on cx. Letters that the font does not have are skipped. */
function text(f, str, cx, y, color, k = 2) {
  let x = Math.round(cx - (str.length * 4 * k - k) / 2);
  for (const ch of str) {
    const g = FONT[ch];
    if (g)
      for (let i = 0; i < 15; i++) if (g[i] === "1") pxRect(f, x + (i % 3) * k, y + ((i / 3) | 0) * k, k, k, color);
    x += 4 * k;
  }
}

function drawBuilding(f, b, t, isNear) {
  const c = palette(b), x0 = b.x - b.w / 2, gy = b.y, top = gy - b.h;
  const fl = 0.5 + 0.5 * Math.sin(t * 6 + b.x); // a slow flicker for the lit windows and doors
  const glow = opaque(mix(c.accDim, c.acc, (isNear ? 0.7 : 0.35) + 0.25 * fl));

  if (b.id === "forge") {
    // the chimney is drawn first so the roof covers its base
    pxRect(f, x0 + b.w - 16, top - 28, 9, 20, CHIM);
    pxRect(f, x0 + b.w - 17, top - 30, 11, 3, c.shade);
    pxRect(f, x0 + b.w - 14, top - 31, 5, 2, opaque(mix(c.acc, WHITE, fl * 0.5)));
  }

  // walls: a lit left edge and a dark right edge
  pxRect(f, x0, top, b.w, b.h, c.wall);
  pxRect(f, x0, top, 3, b.h, c.hi);
  pxRect(f, x0 + b.w - 6, top, 6, b.h, c.shade);
  // roof: two stacked slabs with a highlight line
  pxRect(f, x0 - 4, top - 6, b.w + 8, 6, c.roof);
  pxRect(f, x0 - 4, top - 6, b.w + 8, 1, c.roofHi);
  pxRect(f, x0 + 3, top - 11, b.w - 6, 5, c.roof);
  pxRect(f, x0 + 3, top - 11, b.w - 6, 1, c.roofHi);

  // sign plate with the label
  const tw = b.label.length * 8 - 2, pw = tw + 6, px = Math.round(b.x - pw / 2), py = top + 3;
  pxRect(f, px - 1, py - 1, pw + 2, 16, c.acc);
  pxRect(f, px, py, pw, 14, INK);
  text(f, b.label, b.x, py + 2, c.accLit);

  if (b.id === "gate") {
    // a portal: dark arch with bands of light that pulse
    pxRect(f, b.x - 12, gy - 40, 24, 40, DOOR);
    for (let j = 0; j < 8; j++) {
      const k = 0.5 + 0.5 * Math.sin(t * 3 + j * 0.8);
      pxRect(f, b.x - 10, gy - 38 + j * 5, 20, 4, opaque(mix(c.accDim, c.acc, 0.2 + 0.6 * k)));
    }
  } else {
    // two lit windows and a door
    const wy = top + 22;
    for (const wx of [x0 + 7, x0 + b.w - 15]) {
      pxRect(f, wx, wy, 8, 8, INK);
      pxRect(f, wx + 1, wy + 1, 6, 6, glow);
    }
    pxRect(f, b.x - 7, gy - 24, 14, 24, c.roof);
    pxRect(f, b.x - 6, gy - 22, 12, 22, DOOR);
    pxRect(f, b.x - 4, gy - 18, 8, 18, glow);
    if (isNear) pxRect(f, b.x - 7, gy - 24, 14, 2, c.accLit);
  }

  if (isNear) {
    // a bobbing arrow over the building the hero is standing at
    const ay = top - 22 + Math.round(Math.sin(t * 6) * 2);
    pxRect(f, b.x - 4, ay, 9, 2, c.accLit);
    pxRect(f, b.x - 3, ay + 2, 7, 2, c.accLit);
    pxRect(f, b.x - 2, ay + 4, 5, 2, c.accLit);
    pxRect(f, b.x - 1, ay + 6, 3, 2, c.accLit);
  }
}

/** A canvas tent: rows that widen downward, the right half in shade, a dark door, a pole and a small flag. */
function drawTent(f, tn) {
  const col = hex(tn.c), dark = opaque(mix(col, BLACK, 0.4)), lite = opaque(mix(col, WHITE, 0.25));
  const h = Math.round(tn.w * 0.75), top = tn.y - h;
  for (let j = 0; j < h; j++) {
    const half = Math.max(1, Math.round((tn.w / 2) * ((j + 1) / h)));
    pxRect(f, tn.x - half, top + j, half, 1, j % 6 === 5 ? lite : col);
    pxRect(f, tn.x, top + j, half, 1, dark);
  }
  pxRect(f, tn.x - 4, tn.y - 12, 8, 12, DOOR);
  pxRect(f, tn.x, top - 7, 1, 8, WOODC);
  pxRect(f, tn.x + 1, top - 7, 5, 3, lite);
}

/** A furnace on the foundry catwalk: an iron box with a glowing mouth and a chimney. */
function drawFurnace(f, fu, t) {
  const x0 = fu.x - fu.w / 2, top = fu.y - fu.h, fl = 0.5 + 0.5 * Math.sin(t * 7 + fu.x);
  pxRect(f, fu.x - 4, top - 14, 8, 14, CHIM);
  pxRect(f, fu.x - 5, top - 16, 10, 3, IRONL);
  pxRect(f, x0, top, fu.w, fu.h, IRONC);
  pxRect(f, x0, top, 2, fu.h, IRONL);
  pxRect(f, x0, top + 8, fu.w, 2, IRONL);
  const mouth = opaque(mix(hex("#a82a0a"), hex("#ffd36a"), 0.35 + 0.5 * fl));
  pxRect(f, fu.x - 7, fu.y - 16, 14, 12, DOOR);
  pxRect(f, fu.x - 6, fu.y - 14, 12, 10, mouth);
  pxRect(f, fu.x - 3, fu.y - 12, 6, 6, opaque(mix(mouth, WHITE, 0.4)));
}

/** A minecart on the rails, loaded with crystal. */
function drawCart(f, c) {
  const body = hex("#6a707c"), rim = hex("#8a909c");
  pxRect(f, c.x - 11, c.y - 13, 22, 8, body);
  pxRect(f, c.x - 12, c.y - 14, 24, 2, rim);
  pxRect(f, c.x - 8, c.y - 17, 4, 4, hex("#6aa8ff"));
  pxRect(f, c.x - 2, c.y - 19, 4, 6, hex("#b07aff"));
  pxRect(f, c.x + 4, c.y - 16, 4, 3, hex("#7ae0ff"));
  pxRect(f, c.x - 8, c.y - 5, 5, 5, IRONC);
  pxRect(f, c.x + 3, c.y - 5, 5, 5, IRONC);
  pxRect(f, c.x - 7, c.y - 4, 3, 3, STEELC);
  pxRect(f, c.x + 4, c.y - 4, 3, 3, STEELC);
}

/** f: the frame (f.ox, f.oy are the camera), t: seconds, nearId: the id of the building the hero is at, or null. */
export function drawHub(f, t, nearId) {
  const ox = f.ox | 0, oy = f.oy | 0;
  const seen = (x, r, y0, y1) => x + r >= ox && x - r <= ox + f.w && y1 >= oy && y0 <= oy + VH; // anything of it on screen?
  for (const tn of PROPS.tents) if (seen(tn.x, tn.w / 2 + 4, tn.y - tn.w - 10, tn.y)) drawTent(f, tn);
  for (const fu of PROPS.furnaces) if (seen(fu.x, fu.w / 2 + 6, fu.y - fu.h - 20, fu.y)) drawFurnace(f, fu, t);
  if (seen(PROPS.cart.x, 16, PROPS.cart.y - 22, PROPS.cart.y)) drawCart(f, PROPS.cart);
  for (const b of HUB_BUILDINGS) if (seen(b.x, b.w / 2 + 14, b.y - b.h - 40, b.y)) drawBuilding(f, b, t, b.id === nearId);
}
