// Lanternfall: draws one hub room (fieldmaps.js). The backdrop and terrain are painted once per room into a texture;
// doors, fires and drifting lights are drawn every frame. createFieldScene(room) -> { update, drawBg, drawProps }.
// The mood of each room comes from ambient.js (translucent mist, glints, bubbling lava, a vignette) and from real pixelfx
// loops placed by ROOM_FX below: spirit flames over the graves, floating ice crystals in the mines, a brazier in the foundry.
import * as PX from "./px.js";
import { VW, VH, tintOpts } from "./world.js";
import { mist, motes, glints, lavaBubbles, grade } from "./ambient.js";

const { createFx, hex, mix, rand, loadFx, pxRect } = PX;
const BLK = hex("#000000"), WHT = hex("#ffffff");
const MAT = { ground: ["#8fd068", "#5a4632", "#3a2c1e"], wood: ["#c08a4f", "#8a5a32", "#6a4426"], stone: ["#9a9ab0", "#7c7c92", "#5c5c70"], iron: ["#c8742a", "#3c3c46", "#2a2a30"] };
for (const k in MAT) MAT[k] = MAT[k].map(hex);
const ROPE = hex("#c9a96a"), ROPE2 = hex("#8a7040"), STEEL = hex("#b8c4d0"), SLEEP = hex("#6a4a2a"), WOOD = MAT.wood;
const BODY = { loadout: "#6b5a8a", party: "#8a5a3a", gate: "#4a3a6a", shop: "#4f7a55", forge: "#8a3a2a" };
const LIT0 = hex("#ffcf6a"), LIT1 = hex("#ff7a2a");
const tex = new Map();

// Real pixelfx loops per room: path, pts [x, y] (world px; y is the floor or the base of the flame), opts, tints.
// ice-crystal floats `height` px above its point; spirit-flame floats with its base at the point; brazier stands on it.
const ROOM_FX = {
  catacombs: [{ path: "fire/spirit-flame", pts: [[190, 250], [360, 250], [470, 250], [270, 150]] }],
  mines: [{ path: "ice/ice-crystal", pts: [[134, 256], [352, 204], [522, 256], [582, 152]], opts: { height: 34 }, tints: [null, "#c07aff"] }],
  foundry: [{ path: "fire/brazier", pts: [[355, 308]] }],
};

// Translucent mist bands per room (world y of the band's middle).
const ROOM_MIST = {
  camp: [{ y: 262, h: 26, col: "#ffb25a", a: 22, speed: 0.4, seed: 1 }],
  catacombs: [{ y: 246, h: 36, col: "#7fe0b0", a: 56, speed: 0.5, seed: 1 }, { y: 196, h: 24, col: "#4a7a68", a: 34, speed: 0.3, seed: 4 }],
  mines: [{ y: 300, h: 30, col: "#7aa8ff", a: 36, speed: 0.4, seed: 2 }],
  foundry: [{ y: 288, h: 36, col: "#ff6a2a", a: 34, speed: 0.8, seed: 3 }],
};

// Extra drifting lights (the older fireflies, snow and embers below are still drawn).
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
  const lava = room.deco.find((d) => d.t === "lava");
  if (lava)
    for (let y = lava.y; y < h; y++)
      for (let x = 0; x < w; x++) set(x, y, mix(hex("#ffb23a"), hex("#a82a0a"), Math.min(1, (y - lava.y) / 16)));
  for (const p of room.plats) {
    const g = p.k === "ground", m = g && lava ? MAT.iron : MAT[p.k], th = g ? (lava ? 14 : h - p.y) : p.k === "iron" ? 6 : 9;
    for (let x = p.x1; x < p.x2; x++)
      for (let j = 0; j < th; j++) {
        let c;
        if (j === 0) c = m[0];
        else if (g && !lava) c = j < 2 ? m[0] : mix(m[1], BLK, Math.min(0.7, j / th) + rand(x, j, 3) * 0.2);
        else c = (x + j * 3) % 11 === 0 || j === th - 1 ? m[2] : m[1];
        set(x, p.y + j, c);
      }
  }
  for (const r of room.ropes) {
    for (let y = r.top; y <= r.bottom; y++) { set(r.x, y, ROPE); set(r.x + 1, y, ROPE2); if (y % 8 === 0) set(r.x - 1, y, ROPE); }
    rect(r.x - 2, r.top - 3, 6, 3, WOOD[2]);
  }
  for (const d of room.deco) {
    const { x, y } = d;
    if (d.t === "tent") {
      for (let j = 0; j < 30; j++) { const half = Math.round(22 * (1 - j / 30)); rect(x - half, y - j, half * 2 + 1, 1, j % 6 < 3 ? hex("#b05a3a") : hex("#8a4228")); }
      rect(x - 4, y - 16, 9, 16, hex("#2a1810"));
    } else if (d.t === "tombstone") {
      rect(x - 5, y - 12, 10, 12, MAT.stone[1]); rect(x - 3, y - 14, 6, 2, MAT.stone[1]); rect(x - 5, y - 12, 2, 12, MAT.stone[0]); rect(x, y - 10, 1, 6, MAT.stone[2]); rect(x - 2, y - 8, 5, 1, MAT.stone[2]);
    } else if (d.t === "belltower") {
      rect(x - 10, y - 80, 20, 80, MAT.stone[1]); rect(x - 10, y - 80, 4, 80, MAT.stone[0]); rect(x - 4, y - 56, 8, 18, hex("#0c1012")); rect(x - 3, y - 52, 6, 8, hex("#c8883a"));
      for (let j = 0; j < 22; j++) { const half = Math.round(13 * (1 - j / 22)); rect(x - half, y - 80 - j, half * 2 + 1, 1, hex("#2a2733")); }
    } else if (d.t === "crystal") {
      const c = hex(d.c), dark = mix(c, BLK, 0.45), lite = mix(c, WHT, 0.35);
      for (const k of [-1, 0, 1]) { const sh = k ? 14 : 24, hw = k ? 2 : 3; for (let j = 0; j < sh; j++) { const half = Math.round(hw * (1 - j / sh)); rect(x + k * 5 - half, y - j, half + 1, 1, j % 5 === 0 ? lite : c); rect(x + k * 5 + 1, y - j, half, 1, dark); } }
      glow(x, y - 12, 50, d.c, 0.3);
    } else if (d.t === "rails") {
      for (let xx = 0; xx < w; xx++) { set(xx, y, STEEL); if (xx % 8 < 3) { set(xx, y + 1, SLEEP); set(xx, y + 2, SLEEP); } }
    } else if (d.t === "minecart") {
      rect(x - 13, y - 14, 26, 11, hex("#6a4a2a")); rect(x - 13, y - 14, 26, 2, hex("#8a6a3a")); rect(x - 9, y - 4, 4, 4, BLK); rect(x + 6, y - 4, 4, 4, BLK);
      for (const [dx, c] of [[-6, "#7aa8ff"], [0, "#c07aff"], [6, "#7aa8ff"]]) rect(x + dx - 2, y - 20, 4, 6, hex(c));
    } else if (d.t === "furnace") {
      rect(x - 20, y - 44, 40, 44, hex("#3c3c46")); rect(x - 20, y - 44, 40, 3, hex("#5a5f6a")); rect(x - 8, y - 22, 16, 16, hex("#ff7a2a")); rect(x - 5, y - 19, 10, 10, hex("#ffcf6a")); rect(x - 4, y - 64, 8, 20, hex("#2a2a30"));
      glow(x, y - 14, 70, "#ff7a2a", 0.4);
    } else if (d.t === "pipe") {
      rect(x, 0, 5, y, hex("#5a5f6a")); rect(x - 3, y - 2, 11, 4, hex("#3c3c46")); rect(x + 1, 0, 1, y, STEEL);
    } else if (d.t === "campfire") {
      rect(x - 9, y - 3, 18, 3, WOOD[2]); rect(x - 7, y - 5, 14, 2, WOOD[1]); glow(x, y - 10, 90, "#ffb347", 0.4);
    } else if (d.t === "torch") {
      rect(x - 1, y - 50, 3, 16, WOOD[2]); glow(x, y - 58, 46, "#ffb347", 0.28);
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

function drawDoor(f, d, t, near, accent) {
  const x = d.x - d.w / 2, y = d.y - d.h, pulse = (Math.sin(t * 3) + 1) / 2;
  if (d.kind === "building") {
    const c = hex(BODY[d.id] || "#555566");
    pxRect(f, x - 3, y - 6, d.w + 6, 6, mix(c, BLK, 0.45));
    pxRect(f, x, y, d.w, d.h, c);
    pxRect(f, x + d.w / 2 - 6, y + d.h - 22, 12, 22, mix(LIT0, LIT1, near ? 0.1 : 0.3 + pulse * 0.4));
    pxRect(f, x + 4, y + 8, 8, 8, LIT0); pxRect(f, x + d.w - 12, y + 8, 8, 8, LIT0);
  } else if (d.kind === "portal") {
    pxRect(f, x - 2, y - 2, d.w + 4, d.h + 2, hex("#3a3a4a"));
    pxRect(f, x, y, d.w, d.h, mix(hex("#1a1030"), hex(accent), 0.3 + 0.5 * pulse));
    pxRect(f, x + 4, y + 6, d.w - 8, d.h - 12, mix(hex("#1a1030"), WHT, 0.1 + 0.2 * pulse));
  } else {
    pxRect(f, x, y, 4, d.h, WOOD[2]); pxRect(f, x + d.w - 4, y, 4, d.h, WOOD[2]); pxRect(f, x, y, d.w, 4, WOOD[1]);
    pxRect(f, x + 4, y + 4, d.w - 8, d.h - 4, mix(hex("#1a0808"), hex("#a82a2a"), 0.2 + 0.4 * pulse));
    pxRect(f, x + d.w / 2 - 3, y + 12, 6, 5, hex("#d8d2c0"));
  }
  if (near) arrow(f, d.x, y, t);
}

export async function createFieldScene(room) {
  const T = paint(room), W = room.w;
  const [torch, campfire] = await Promise.all(["fire/torch", "fire/campfire"].map(loadFx));
  const fxs = [];
  room.deco.forEach((d, i) => {
    if (d.t === "torch") fxs.push({ x: d.x, y: d.y - 58, fx: createFx(torch, { x: d.x, y: d.y - 58, seed: (torch.meta.options.seed ?? 1) + i }) });
    if (d.t === "campfire") fxs.push({ x: d.x, y: d.y, fx: createFx(campfire, { x: d.x, y: d.y, seed: (campfire.meta.options.seed ?? 1) + i }) });
  });
  // the room's own pixelfx loops; one that cannot be loaded is skipped, the room still works
  for (const e of ROOM_FX[room.id] || []) {
    try {
      const mod = await loadFx(e.path);
      e.pts.forEach(([x, y], i) =>
        fxs.push({ x, y, fx: createFx(mod, { x, y, seed: (mod.meta.options.seed ?? 1) + i * 3, ...(e.opts || {}), ...tintOpts(mod, e.tints ? e.tints[i % e.tints.length] : null, 0.8) }) })
      );
    } catch (err) {
      console.warn("room effect skipped:", e.path, err);
    }
  }
  const kinds = new Set(room.deco.map((d) => d.t));
  const bg = new Uint32Array(VW * VH);
  const fly = [hex("#3f9a78"), hex("#9fffe0")], snow = [hex("#9fb4d8"), WHT], ember = [hex("#ffb347"), hex("#ff4a1a")];
  const lavaDeco = room.deco.find((d) => d.t === "lava");
  // twinkling glints over every painted crystal, in the crystal's own colour
  const crystalGlints = room.deco.filter((d) => d.t === "crystal").map((d) => ({ col: d.c, pts: [[d.x - 8, d.y - 6], [d.x + 9, d.y - 10], [d.x - 2, d.y - 24], [d.x + 5, d.y - 17]] }));
  const vig = room.id === "camp" ? 0.45 : 0.55;
  let t = 0;
  const seen = (x, y, cx, cy) => x > cx - 60 && x < cx + VW + 60 && y > cy - 60 && y < cy + VH + 60; // an effect can be 112 px wide
  const dot = (f, x, y, cx, cy, c, s = 1) => { if (seen(x, y, cx, cy)) pxRect(f, x, y, s, s, c); };
  return {
    update(dt, cx, cy) { t += dt; for (const p of fxs) if (seen(p.x, p.y, cx, cy)) p.fx.update(dt); },
    drawBg(cx, cy) {
      cx = Math.max(0, Math.min(W - VW, cx | 0));
      cy = Math.max(0, Math.min(room.h - VH, cy | 0));
      for (let y = 0; y < VH; y++) bg.set(T.subarray((cy + y) * W + cx, (cy + y) * W + cx + VW), y * VW);
      grade(bg, { vignette: vig });
      return bg;
    },
    drawProps(f, cx, cy, nearId) {
      // mist first: it is translucent and only fills empty pixels, so everything below is drawn in front of it
      for (const m of ROOM_MIST[room.id] || []) mist(f, t, m);
      for (const d of room.doors) drawDoor(f, d, t, d.id === nearId, room.look.accent);
      for (const p of fxs) if (seen(p.x, p.y, cx, cy)) p.fx.draw(f);
      for (const d of room.deco) if (d.t === "gear") {
        const ang = t * 0.6, c = hex("#6a707c"), k = hex("#3c4048");
        for (let dy = -d.r; dy <= d.r; dy++) for (let dx = -d.r; dx <= d.r; dx++) { const m = Math.hypot(dx, dy); if (m <= d.r && m >= d.r * 0.4) dot(f, d.x + dx, d.y + dy, cx, cy, m > d.r - 2 ? c : k); }
        for (let i = 0; i < 8; i++) { const a = ang + (i * Math.PI) / 4; dot(f, d.x + Math.cos(a) * (d.r + 1) - 1, d.y + Math.sin(a) * (d.r + 1) - 1, cx, cy, c, 3); }
      }
      if (kinds.has("fireflies")) for (let i = 0; i < 14; i++) { const b = Math.sin(t * 2 + i * 3) > 0.2; dot(f, rand(i, 1, 21) * W + 8 * Math.sin(t * 0.6 + i), room.h * 0.3 + rand(i, 2, 22) * room.h * 0.6, cx, cy, fly[b ? 1 : 0], b ? 2 : 1); }
      if (kinds.has("snow")) for (let i = 0; i < 40; i++) dot(f, rand(i, 1, 31) * W + 6 * Math.sin(t + i), (rand(i, 2, 32) * room.h + t * (14 + rand(i, 3, 33) * 10)) % room.h, cx, cy, snow[i % 3 ? 0 : 1]);
      if (kinds.has("embers")) for (let i = 0; i < 30; i++) { const y = room.h - ((rand(i, 2, 42) * room.h + t * (20 + rand(i, 3, 43) * 18)) % room.h); dot(f, rand(i, 1, 41) * W + 5 * Math.sin(t * 2 + i), y, cx, cy, mix(ember[0], ember[1], 1 - y / room.h)); }
      for (const m of ROOM_MOTES[room.id] || []) motes(f, t, m);
      for (const g of crystalGlints) glints(f, t, g);
      if (lavaDeco) lavaBubbles(f, t, { y: lavaDeco.y, w: W, n: 26, seed: 5 });
    },
  };
}
