// Lanternfall: draws one hub room (fieldmaps.js). The backdrop is painted once per room into a texture: sky, lava, the terrain
// (fieldtex.js) and the scenery. Doors, real pixelfx loops (fieldfx.js) and drifting lights are drawn every frame.
// createFieldScene(room) -> { update, drawBg, drawProps }.
import * as PX from "./px.js";
import { VW, VH } from "./world.js";
import { mist, motes, glints, lavaBubbles, grade } from "./ambient.js";
import { paintTerrain } from "./fieldtex.js";
import { buildRoomFx, updateFx, drawFx } from "./fieldfx.js";
import { ROOMS } from "./fieldmaps.js";

const { hex, mix, rand, pxRect } = PX;
const BLK = hex("#000000"), WHT = hex("#ffffff");
const H = (a) => a.map(hex);
const STONE = H(["#bcbcd4", "#8c8ca6", "#666680", "#383848"]), WOODC = H(["#e0a868", "#a8703c", "#7a4a28", "#432616"]);
const STEEL = hex("#b8c4d0"), SLEEP = hex("#6a4a2a"), GOLD = hex("#c9a45a");
const BODY = { loadout: "#6b5a8a", party: "#8a5a3a", gate: "#4a3a6a", shop: "#4f7a55", forge: "#8a3a2a" };
const TRIM = { loadout: "#7aa8ff", party: "#ffb25a", gate: "#c07aff", shop: "#9fffc0", forge: "#ff9a4a" };
const GLYPH = {
  loadout: ["..#..", "..#..", "..#..", "#####", "..#.."],
  party: ["##...", "####.", "#####", "#....", "#...."],
  gate: [".###.", "#...#", "#...#", "#...#", "#####"],
  shop: [".###.", "#.#..", ".###.", "..#.#", ".###."],
  forge: ["#####", ".###.", "..#..", "..#..", ".###."],
};
const LIT0 = hex("#ffcf6a"), LIT1 = hex("#ff7a2a");
const tex = new Map();

// Translucent mist bands per room (world y of the band's middle).
const ROOM_MIST = {
  camp: [{ y: 262, h: 26, col: "#ffb25a", a: 22, speed: 0.4, seed: 1 }],
  catacombs: [{ y: 246, h: 36, col: "#7fe0b0", a: 56, speed: 0.5, seed: 1 }, { y: 196, h: 24, col: "#4a7a68", a: 34, speed: 0.3, seed: 4 }],
  mines: [{ y: 300, h: 30, col: "#7aa8ff", a: 36, speed: 0.4, seed: 2 }],
  foundry: [{ y: 288, h: 36, col: "#ff6a2a", a: 34, speed: 0.8, seed: 3 }],
};
const ROOM_MOTES = {
  camp: [{ kind: "firefly", n: 14, x0: 240, x1: 480, y0: 120, y1: 260, seed: 61, hi: "#ffd98a", lo: "#c8782a" }],
};

function paint(room) {
  let T = tex.get(room.id);
  if (T) return T;
  const { w, h, look } = room;
  T = new Uint32Array(w * h);
  const s0 = hex(look.skyTop), s1 = hex(look.skyBottom);
  const has = (t) => room.deco.some((d) => d.t === t);
  const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < w && y >= 0 && y < h) T[y * w + x] = c; };
  const rect = (x, y, a, b, c) => { for (let j = 0; j < b; j++) for (let i = 0; i < a; i++) set(x + i, y + j, c); };
  const glow = (cx, cy, r, col, a) => {
    const k = hex(col);
    for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(h, cy + r); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(w, cx + r); x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d < r) { const t = 1 - d / r, i = y * w + x; T[i] = mix(T[i], k, a * t * t); }
      }
  };
  const stars = has("stars");
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let c = mix(mix(s0, s1, y / h), BLK, 0.1 * rand(x >> 2, y >> 2, 3));
      if (stars && y < 150 && rand(x, y, 77) > 0.994) c = mix(c, WHT, 0.6);
      T[y * w + x] = c;
    }
  // lava: a bright crust line, cooling red below with dark crust plates and hot cracks, and a glow rising off it
  const lava = room.deco.find((d) => d.t === "lava");
  if (lava) {
    const l0 = hex("#ffb23a"), l1 = hex("#a82a0a"), crust = hex("#4a0e08"), hot = hex("#ffe08a"), rim = hex("#fff0b0"), up = hex("#ff7a2a");
    for (let y = lava.y; y < h; y++)
      for (let x = 0; x < w; x++) {
        let c = mix(l0, l1, Math.min(1, (y - lava.y) / 16));
        const r = rand(x >> 2, y >> 1, 9);
        if (y > lava.y + 1) { if (r > 0.88) c = mix(l1, crust, 0.55); else if (r < 0.04) c = hot; }
        set(x, y, c);
      }
    for (let x = 0; x < w; x++) {
      set(x, lava.y, rand(x, 1, 8) > 0.4 ? rim : hot);
      for (let k = 1; k <= 14; k++) { const i = (lava.y - k) * w + x; if (i >= 0) T[i] = mix(T[i], up, 0.35 * (1 - k / 14) * (1 - k / 14)); }
    }
  }
  paintTerrain(T, room); // platforms, posts and ropes (fieldtex.js)
  for (const d of room.deco) {
    const { x, y } = d;
    if (d.t === "tent") {
      const a = hex("#b05a3a"), b = hex("#8a4228"), e = hex("#4a2012");
      for (let j = 0; j < 30; j++) { const half = Math.round(22 * (1 - j / 30)); rect(x - half, y - j, half * 2 + 1, 1, j % 6 < 3 ? a : b); set(x - half, y - j, e); set(x + half, y - j, e); }
      rect(x, y - 30, 1, 14, e); rect(x - 4, y - 16, 9, 16, hex("#2a1810")); rect(x, y - 36, 1, 6, WOODC[2]); rect(x + 1, y - 36, 5, 3, LIT0);
      glow(x, y - 8, 22, "#ffb347", 0.35);
    } else if (d.t === "tombstone") {
      glow(x, y, 9, "#000000", 0.5);
      if (x % 2) { rect(x - 2, y - 20, 4, 20, STONE[1]); rect(x - 6, y - 15, 12, 4, STONE[1]); rect(x - 2, y - 20, 1, 20, STONE[0]); rect(x - 6, y - 15, 12, 1, STONE[0]); }
      else { rect(x - 5, y - 12, 10, 12, STONE[1]); rect(x - 3, y - 14, 6, 2, STONE[1]); rect(x - 5, y - 12, 2, 12, STONE[0]); rect(x, y - 10, 1, 6, STONE[2]); rect(x - 2, y - 8, 5, 1, STONE[2]); }
      rect(x - 4, y - 3, 4, 2, hex("#58a050"));
    } else if (d.t === "belltower") {
      rect(x - 10, y - 80, 20, 80, STONE[1]); rect(x - 10, y - 80, 4, 80, STONE[0]);
      for (let j = 8; j < 80; j += 8) rect(x - 10, y - 80 + j, 20, 1, STONE[2]);
      rect(x - 5, y - 58, 10, 22, hex("#0c1012")); rect(x - 3, y - 52, 6, 8, hex("#c8883a")); rect(x - 5, y - 60, 10, 2, STONE[0]);
      for (let j = 0; j < 22; j++) { const half = Math.round(13 * (1 - j / 22)); rect(x - half, y - 80 - j, half * 2 + 1, 1, hex("#2a2733")); }
      glow(x, y - 48, 36, "#c8883a", 0.25);
    } else if (d.t === "crystal") {
      const c = hex(d.c), dark = mix(c, BLK, 0.45), lite = mix(c, WHT, 0.35);
      for (const k of [-2, -1, 0, 1, 2]) {
        const sh = k === 0 ? 24 : Math.abs(k) === 1 ? 16 : 10, hw = k === 0 ? 3 : 2;
        for (let j = 0; j < sh; j++) { const half = Math.round(hw * (1 - j / sh)); rect(x + k * 4 - half, y - j, half + 1, 1, j % 5 === 0 ? lite : c); rect(x + k * 4 + 1, y - j, half, 1, dark); }
      }
      glow(x, y - 12, 50, d.c, 0.3); glow(x, y, 26, d.c, 0.25);
    } else if (d.t === "rails") {
      for (let xx = 0; xx < w; xx++) { set(xx, y, STEEL); set(xx, y - 1, STONE[0]); if (xx % 8 < 3) { set(xx, y + 1, SLEEP); set(xx, y + 2, SLEEP); } }
    } else if (d.t === "minecart") {
      rect(x - 13, y - 14, 26, 11, hex("#6a4a2a")); rect(x - 13, y - 14, 26, 2, hex("#8a6a3a")); rect(x - 13, y - 5, 26, 2, hex("#3c3c46")); rect(x - 9, y - 4, 4, 4, BLK); rect(x + 6, y - 4, 4, 4, BLK);
      for (const [dx, c] of [[-6, "#7aa8ff"], [0, "#c07aff"], [6, "#7aa8ff"]]) { rect(x + dx - 2, y - 20, 4, 6, hex(c)); glow(x + dx, y - 17, 12, c, 0.35); }
    } else if (d.t === "furnace") {
      const dk = hex("#2a2a30");
      rect(x - 20, y - 44, 40, 44, hex("#3c3c46")); rect(x - 20, y - 44, 40, 3, hex("#5a5f6a"));
      for (let j = 0; j < 44; j += 6) for (let i = ((j / 6) & 1) * 5; i < 40; i += 10) rect(x - 20 + i, y - 44 + j, 1, 6, dk);
      rect(x - 20, y - 30, 40, 2, hex("#52525e")); for (let i = 2; i < 40; i += 6) set(x - 20 + i, y - 29, STEEL);
      rect(x - 9, y - 23, 18, 18, dk); rect(x - 8, y - 22, 16, 16, hex("#ff7a2a")); rect(x - 5, y - 19, 10, 10, LIT0);
      rect(x - 4, y - 64, 8, 20, dk); rect(x - 6, y - 66, 12, 3, hex("#52525e"));
      glow(x, y - 14, 80, "#ff7a2a", 0.45);
    } else if (d.t === "pipe") {
      rect(x, 0, 5, y, hex("#5a5f6a")); rect(x - 3, y - 2, 11, 4, hex("#3c3c46")); rect(x + 1, 0, 1, y, STEEL);
      for (let j = 12; j < y; j += 24) rect(x - 1, j, 7, 2, hex("#3c3c46"));
    } else if (d.t === "campfire") {
      rect(x - 12, y - 4, 4, 4, STONE[1]); rect(x + 8, y - 4, 4, 4, STONE[1]); rect(x - 8, y - 5, 4, 5, STONE[2]); rect(x + 4, y - 5, 4, 5, STONE[2]);
      rect(x - 9, y - 3, 18, 3, WOODC[2]); rect(x - 7, y - 5, 14, 2, WOODC[1]); glow(x, y - 10, 100, "#ffb347", 0.45);
    } else if (d.t === "torch") {
      rect(x - 1, y - 50, 3, 16, WOODC[2]); rect(x - 3, y - 36, 7, 2, STEEL); glow(x, y - 58, 50, "#ffb347", 0.32);
    }
  }
  if (lava) glow(w / 2, lava.y, 160, "#ff7a2a", 0.4);
  tex.set(room.id, T);
  return T;
}

function arrow(f, x, y, t) {
  const ay = y - 12 + Math.round(Math.sin(t * 5) * 2);
  pxRect(f, x - 3, ay, 7, 2, WHT); pxRect(f, x - 2, ay + 2, 5, 2, WHT); pxRect(f, x - 1, ay + 4, 3, 2, WHT);
}

function glyph(f, g, x, y, c) {
  g.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === "#") pxRect(f, x + i * 2, y + j * 2, 2, 2, c); });
}

function drawDoor(f, d, t, near, accent) {
  const x = d.x - d.w / 2, y = d.y - d.h, fl = d.y, pulse = (Math.sin(t * 3) + 1) / 2;
  if (d.kind === "building") {
    const c = hex(BODY[d.id] || "#555566"), tr = hex(TRIM[d.id] || accent), dk = mix(c, BLK, 0.45), lt = mix(c, WHT, 0.18), w = d.w, h = d.h;
    pxRect(f, x - 5, y - 4, w + 10, 4, dk); pxRect(f, x - 3, y - 8, w + 6, 4, mix(c, BLK, 0.3)); pxRect(f, x - 3, y - 8, w + 6, 1, lt); // roof
    pxRect(f, x, y, w, h, c); pxRect(f, x, y, 3, h, lt); pxRect(f, x + w - 3, y, 3, h, dk); // walls
    for (let i = 8; i < w - 4; i += 8) pxRect(f, x + i, y + 6, 1, h - 12, mix(c, BLK, 0.18)); // plank seams
    for (let i = 0; i < w; i += 6) { const col = (i / 6) & 1 ? tr : LIT0; pxRect(f, x + i + 1, y, 4, 3, col); pxRect(f, x + i + 2, y + 3, 2, 2, col); } // pennants
    pxRect(f, x - 3, fl - 6, w + 6, 6, STONE[1]); pxRect(f, x - 3, fl - 6, w + 6, 2, STONE[0]); // stone base
    for (let i = 0; i < w + 6; i += 9) pxRect(f, x - 3 + i, fl - 4, 1, 4, STONE[2]);
    const mx = x + w / 2;
    pxRect(f, mx - 8, fl - 26, 16, 20, dk); pxRect(f, mx - 6, fl - 24, 12, 2, STONE[0]);
    pxRect(f, mx - 6, fl - 22, 12, 16, mix(LIT0, LIT1, near ? 0.1 : 0.3 + pulse * 0.4)); // lit door
    for (const wx of [x + 3, x + w - 13]) { // windows with flicker
      const fl2 = mix(LIT0, LIT1, 0.5 + 0.4 * Math.sin(t * 4 + wx));
      pxRect(f, wx, y + 9, 10, 10, dk); pxRect(f, wx + 1, y + 10, 8, 8, fl2); pxRect(f, wx + 4, y + 10, 1, 8, dk); pxRect(f, wx + 1, y + 13, 8, 1, dk);
    }
    for (const [rx, ph] of [[mx - 11, 0], [mx + 9, 3]]) pxRect(f, rx, fl - 16, 2, 2, mix(tr, WHT, (Math.sin(t * 3 + ph) + 1) / 2)); // glowing runes
    const sw = 30, sh = 12, sx = d.x - 15, sy = y - 24; // lit signboard on chains
    pxRect(f, sx + 4, y - 12, 1, 4, dk); pxRect(f, sx + sw - 5, y - 12, 1, 4, dk);
    pxRect(f, sx - 1, sy - 1, sw + 2, sh + 2, GOLD); pxRect(f, sx, sy, sw, sh, hex("#14121e"));
    pxRect(f, sx + 1, sy + 1, sw - 2, 1, mix(hex("#14121e"), tr, 0.4 + 0.5 * pulse)); pxRect(f, sx + 1, sy + sh - 2, sw - 2, 1, mix(hex("#14121e"), tr, 0.4 + 0.5 * pulse));
    if (GLYPH[d.id]) glyph(f, GLYPH[d.id], sx + (sw - 10) / 2, sy + 1, mix(tr, WHT, 0.2 + 0.4 * pulse));
    if (near) arrow(f, d.x, y - 28, t);
    return;
  }
  if (d.kind === "portal") {
    const ac = hex((ROOMS[d.to] && ROOMS[d.to].look.accent) || accent);
    pxRect(f, x - 3, y - 3, 3, d.h + 3, STONE[1]); pxRect(f, x + d.w, y - 3, 3, d.h + 3, STONE[1]); pxRect(f, x - 3, y - 6, d.w + 6, 3, STONE[0]);
    pxRect(f, d.x - 2, y - 9, 4, 4, mix(STONE[0], ac, 0.4 + 0.4 * pulse));
    pxRect(f, x, y, d.w, d.h, mix(hex("#0c0818"), ac, 0.18 + 0.2 * pulse));
    for (const [rx, ph] of [[x - 2, 0], [x + d.w, 2]]) pxRect(f, rx, y + 6, 2, 2, mix(ac, WHT, (Math.sin(t * 3 + ph) + 1) / 2));
  } else {
    pxRect(f, x, y, 4, d.h, WOODC[2]); pxRect(f, x + d.w - 4, y, 4, d.h, WOODC[2]); pxRect(f, x, y, d.w, 4, WOODC[1]);
    pxRect(f, x + 4, y + 4, d.w - 8, d.h - 4, mix(hex("#1a0808"), hex("#a82a2a"), 0.2 + 0.3 * pulse));
    pxRect(f, x + d.w / 2 - 3, y + 12, 6, 5, hex("#d8d2c0")); pxRect(f, x + d.w / 2 - 2, y + 14, 1, 1, BLK); pxRect(f, x + d.w / 2 + 1, y + 14, 1, 1, BLK);
  }
  if (near) arrow(f, d.x, y, t);
}

export async function createFieldScene(room) {
  const T = paint(room), W = room.w;
  const fxs = await buildRoomFx(room); // torches, campfires, braziers, portals, rune circles, signs ... (fieldfx.js)
  const kinds = new Set(room.deco.map((d) => d.t));
  const bg = new Uint32Array(VW * VH);
  const fly = [hex("#3f9a78"), hex("#9fffe0")], snow = [hex("#9fb4d8"), WHT], ember = [hex("#ffb347"), hex("#ff4a1a")];
  const lavaDeco = room.deco.find((d) => d.t === "lava");
  const crystalGlints = room.deco.filter((d) => d.t === "crystal").map((d) => ({ col: d.c, pts: [[d.x - 8, d.y - 6], [d.x + 9, d.y - 10], [d.x - 2, d.y - 24], [d.x + 5, d.y - 17]] }));
  const vig = room.id === "camp" ? 0.45 : 0.55;
  let t = 0, camX = 0, camY = 0;
  const near = (x, y) => x > camX - 60 && x < camX + VW + 60 && y > camY - 60 && y < camY + VH + 60; // an effect can be 112 px wide
  const dot = (f, x, y, c, s = 1) => { if (near(x, y)) pxRect(f, x, y, s, s, c); };
  return {
    update(dt, cx, cy) { t += dt; camX = cx; camY = cy; updateFx(fxs, dt, near); },
    drawBg(cx, cy) {
      cx = Math.max(0, Math.min(W - VW, cx | 0));
      cy = Math.max(0, Math.min(room.h - VH, cy | 0));
      for (let y = 0; y < VH; y++) bg.set(T.subarray((cy + y) * W + cx, (cy + y) * W + cx + VW), y * VW);
      grade(bg, { vignette: vig });
      return bg;
    },
    drawProps(f, cx, cy, nearId) {
      camX = cx; camY = cy;
      for (const m of ROOM_MIST[room.id] || []) mist(f, t, m); // translucent, so everything below is drawn in front of it
      drawFx(fxs, f, "back", near); // floor circles, the teleporter pad, the lit shop signs
      for (const d of room.doors) drawDoor(f, d, t, d.id === nearId, room.look.accent);
      drawFx(fxs, f, "front", near); // portal rifts and flames
      for (const d of room.deco) if (d.t === "gear") {
        const ang = t * 0.6, c = hex("#6a707c"), k = hex("#3c4048");
        for (let dy = -d.r; dy <= d.r; dy++) for (let dx = -d.r; dx <= d.r; dx++) { const m = Math.hypot(dx, dy); if (m <= d.r && m >= d.r * 0.4) dot(f, d.x + dx, d.y + dy, m > d.r - 2 ? c : k); }
        for (let i = 0; i < 8; i++) { const a = ang + (i * Math.PI) / 4; dot(f, d.x + Math.cos(a) * (d.r + 1) - 1, d.y + Math.sin(a) * (d.r + 1) - 1, c, 3); }
      }
      if (kinds.has("fireflies")) for (let i = 0; i < 14; i++) { const b = Math.sin(t * 2 + i * 3) > 0.2; dot(f, rand(i, 1, 21) * W + 8 * Math.sin(t * 0.6 + i), room.h * 0.3 + rand(i, 2, 22) * room.h * 0.6, fly[b ? 1 : 0], b ? 2 : 1); }
      if (kinds.has("snow")) for (let i = 0; i < 40; i++) dot(f, rand(i, 1, 31) * W + 6 * Math.sin(t + i), (rand(i, 2, 32) * room.h + t * (14 + rand(i, 3, 33) * 10)) % room.h, snow[i % 3 ? 0 : 1]);
      if (kinds.has("embers")) for (let i = 0; i < 30; i++) { const y = room.h - ((rand(i, 2, 42) * room.h + t * (20 + rand(i, 3, 43) * 18)) % room.h); dot(f, rand(i, 1, 41) * W + 5 * Math.sin(t * 2 + i), y, mix(ember[0], ember[1], 1 - y / room.h)); }
      for (const m of ROOM_MOTES[room.id] || []) motes(f, t, m);
      for (const g of crystalGlints) glints(f, t, g);
      if (lavaDeco) lavaBubbles(f, t, { y: lavaDeco.y, w: W, n: 26, seed: 5 });
    },
  };
}
