// Lanternfall: draws the hub buildings into the frame with the same pxRect helper the rest of the game uses.
// Pure drawing: it keeps no game state. hub.js calls drawBuildings() once per frame, before the fire props.
import { pxRect, hex, mix } from "./px.js";
import { GY } from "./world.js";
import { BUILDINGS, FONT } from "./hubmap.js";

const BLACK = hex("#000000"), WHITE = hex("#ffffff"), INK = hex("#120f1c"), DOOR = hex("#0b0912"), CHIM = hex("#2a2733");
const opaque = (c) => (c | 0xff000000) >>> 0; // make sure a mixed colour keeps full alpha (alpha is the top byte)

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
  const c = palette(b), x0 = b.x - b.w / 2, top = GY - b.h;
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
    pxRect(f, b.x - 12, GY - 40, 24, 40, DOOR);
    for (let j = 0; j < 8; j++) {
      const k = 0.5 + 0.5 * Math.sin(t * 3 + j * 0.8);
      pxRect(f, b.x - 10, GY - 38 + j * 5, 20, 4, opaque(mix(c.accDim, c.acc, 0.2 + 0.6 * k)));
    }
  } else {
    // two lit windows and a door
    const wy = top + 22;
    for (const wx of [x0 + 7, x0 + b.w - 15]) {
      pxRect(f, wx, wy, 8, 8, INK);
      pxRect(f, wx + 1, wy + 1, 6, 6, glow);
    }
    pxRect(f, b.x - 7, GY - 24, 14, 24, c.roof);
    pxRect(f, b.x - 6, GY - 22, 12, 22, DOOR);
    pxRect(f, b.x - 4, GY - 18, 8, 18, glow);
    if (isNear) pxRect(f, b.x - 7, GY - 24, 14, 2, c.accLit);
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

/** f: the frame (f.ox is the camera), t: seconds, nearId: the id of the building the hero is at, or null. */
export function drawBuildings(f, t, nearId) {
  const ox = f.ox | 0;
  for (const b of BUILDINGS) {
    if (b.x + b.w / 2 + 14 < ox || b.x - b.w / 2 - 14 > ox + f.w) continue; // off screen
    drawBuilding(f, b, t, b.id === nearId);
  }
}
