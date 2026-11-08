// Lanternfall: the terrain painter for the hub rooms. It draws every platform and rope into a room's backdrop texture T
// (a Uint32Array, w * h, one pixel per world pixel). It has no game state and draws nothing per frame.
// Four surfaces: grass over earth ("ground"), planked wood with nails ("wood"), mossy brick ("stone"), riveted iron ("iron").
// Every platform also gets a lit top edge in the room's accent colour, a soft shadow and glow underneath, and wooden, stone
// or steel posts down toward the tier below. Ropes are twisted, knotted and hang from a bracket.
// Use: paintTerrain(T, room) after the sky, lava and before the scenery (fielddraw.js).
import { hex, mix, rand } from "./px.js";

const C = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, hex(v)]));
const M = {
  ground: C({ g1: "#a6e86a", g2: "#5fae4a", g3: "#3f7a38", dirt: "#7a5a3c", dark: "#3a2a1c", stone: "#9a8a72" }),
  wood: C({ hi: "#e0a868", mid: "#a8703c", low: "#7a4a28", dark: "#432616" }),
  stone: C({ hi: "#bcbcd4", mid: "#8c8ca6", low: "#666680", mortar: "#383848", moss: "#58a050" }),
  iron: C({ hi: "#f0a050", mid: "#52525e", low: "#34343c", dark: "#202026", rivet: "#a8b0bc", rust: "#9a5226" }),
};
const BLK = hex("#000000");
const ROPE = hex("#d2b072"), ROPE2 = hex("#8a6e3c"), KNOT = hex("#5c4524");

// the colour of one pixel of a platform: x is the world x, j the row from the top, th the thickness, p the platform
function pix(kind, x, j, th, p) {
  const m = M[kind], u = x - p.x1;
  if (kind === "ground") {
    if (j === 0) return rand(x, 1, 11) > 0.5 ? m.g1 : m.g2;
    if (j < 3) return j === 1 ? m.g2 : m.g3;
    const shade = mix(m.dirt, m.dark, Math.min(0.8, (j / th) * 1.3 + rand(x, j, 12) * 0.15));
    return rand(x, j, 13) > 0.975 ? m.stone : shade;
  }
  if (kind === "wood") {
    const row = j < 5 ? 0 : 1, s = (u + row * 12) % 24;
    if (j === 0) return m.hi;
    if (j === th - 1) return m.dark;
    if (j === 4) return m.low;
    if (s === 0) return m.dark;
    if (s === 3 && (j === 2 || j === 7)) return m.dark; // nails
    return rand(u >> 2, j, 14) > 0.78 ? m.low : m.mid;
  }
  if (kind === "stone") {
    const row = j < 4 ? 0 : 1, uu = u + row * 7;
    if (j === 0) return rand(x >> 1, 5, 15) > 0.7 ? m.moss : m.hi;
    if (j === 4 || j === th - 1) return m.mortar;
    if (uu % 14 === 0) return m.mortar;
    if (j === 1 && rand(x >> 1, 6, 15) > 0.85) return m.moss;
    return rand((uu / 14) | 0, row, 16) > 0.5 ? m.mid : m.low;
  }
  // iron
  if (j === 0) return m.hi;
  if (j === th - 1) return m.dark;
  if (u % 40 === 0) return m.dark;
  if (j === 2 && u % 10 === 4) return m.rivet;
  if (rand(x, j, 17) > 0.93) return m.rust;
  return j === 1 ? m.mid : m.low;
}

// a post of the platform's own material, from y0 down len px
function post(set, kind, x, y0, len) {
  const m = M[kind === "ground" ? "wood" : kind], w = kind === "iron" ? 3 : 4;
  for (let j = 0; j < len; j++)
    for (let i = 0; i < w; i++) set(x + i, y0 + j, j === len - 1 ? m.mid : i === 0 ? m.mid : i === w - 1 ? m.dark : kind === "iron" && j % 8 === 3 ? m.rivet : m.low);
  for (let i = -1; i <= w; i++) set(x + i, y0 + len - 1, m.dark); // foot
}

export function paintTerrain(T, room) {
  const { w, h } = room;
  const lava = room.deco.some((d) => d.t === "lava");
  const acc = hex(room.look.accent), lit = hex(room.look.light);
  const idx = (x, y) => (x >= 0 && x < w && y >= 0 && y < h ? y * w + x : -1);
  const set = (x, y, c) => { const i = idx(Math.round(x), Math.round(y)); if (i >= 0) T[i] = c; };
  const blend = (x, y, c, a) => { const i = idx(x, y); if (i >= 0) T[i] = mix(T[i], c, a); };
  const below = (x, y) => { let best = null; for (const q of room.plats) if (q.y > y && x >= q.x1 && x < q.x2 && (!best || q.y < best.y)) best = q; return best; };

  for (const p of room.plats) {
    const g = p.k === "ground", kind = g && lava ? "iron" : p.k;
    const th = g ? (lava ? 14 : h - p.y) : kind === "iron" ? 6 : 9;
    if (!g) {
      for (let x = p.x1 + 10; x < p.x2 - 8; x += 70) {
        const q = below(x, p.y), len = Math.min(q ? q.y - p.y - th : 30, 40);
        if (len > 6) post(set, kind, x, p.y + th, len);
      }
    }
    for (let x = p.x1; x < p.x2; x++) {
      const edge = x === p.x1 || x === p.x2 - 1;
      for (let j = 0; j < th; j++) {
        if (!g && edge && j === 0) continue; // rounded top corners
        set(x, p.y + j, pix(kind, x, j, th, p));
      }
      if (!g || lava) {
        for (let k = 0; k < 5; k++) { blend(x, p.y + th + k, BLK, 0.3 * (1 - k / 5)); blend(x, p.y + th + k, lit, 0.22 * (1 - k / 5)); }
      }
      blend(x, p.y - 1, acc, 0.2); // rim light in the room's accent colour
      if (kind === "ground" && !lava && rand(x, 2, 18) > 0.8) set(x, p.y - 1, M.ground.g1); // grass blades
    }
  }

  for (const r of room.ropes) {
    for (let y = r.top; y <= r.bottom; y++) {
      const a = (y >> 1) & 1;
      set(r.x, y, a ? ROPE : ROPE2);
      set(r.x + 1, y, a ? ROPE2 : ROPE);
      blend(r.x + 2, y, BLK, 0.35);
      if ((y - r.top) % 14 === 7) for (let i = -1; i < 3; i++) for (let j = 0; j < 3; j++) set(r.x + i, y + j, j === 0 ? ROPE : KNOT);
    }
    for (let i = -3; i < 5; i++) { set(r.x + i, r.top - 4, M.wood.hi); set(r.x + i, r.top - 3, M.wood.mid); set(r.x + i, r.top - 2, M.wood.dark); }
    set(r.x, r.top - 1, M.iron.rivet); set(r.x + 1, r.top - 1, M.iron.rivet);
  }
}
