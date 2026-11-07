// Lanternfall hub scene: paints the 1280x480 backdrop and all terrain once, then scrolls it with a vertical camera.
import * as PX from "./px.js";
import { VW, VH, WORLD_W as W } from "./world.js";
import { ZONES, LEDGES, STAIRS, LADDERS, PROPS, WORLD_H as H } from "./hubworld.js";

const { createFx, hex, mix, rand, loadFx, pxRect } = PX;
export const CAM_MAX_Y = H - VH;
const BLK = hex("#000000"), WHT = hex("#ffffff");
const WOOD = ["#a9743f", "#8a5a32", "#6a4426"].map(hex), STONE = ["#9a9ab0", "#7c7c92", "#5c5c70"].map(hex);
const MOSS = hex("#4f8a45"), GR0 = hex("#8fd068"), GR1 = hex("#6aa84a"), DIRT = hex("#5a4632");
const IRON0 = hex("#2a2a30"), IRON1 = hex("#3c3c46"), ORG = hex("#c8742a"), RAIL = hex("#6a707c");
const STEEL = hex("#b8c4d0"), SLEEP = hex("#6a4a2a"), BALLAST = hex("#3a3a44"), ROPE = hex("#c9a96a");

const T = new Uint32Array(W * H);
const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) T[y * W + x] = c; };
const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
const rockTop = (x) => (x < 960 ? 150 : x >= 1040 ? 100 : 150 - ((x - 960) / 80) * 50);
const across = (x, a, m, f) => (x < 380 ? a : x < 420 ? mix(a, m, (x - 380) / 40) : x < 940 ? m : x < 980 ? mix(m, f, (x - 940) / 40) : f);

function glow(cx, cy, r, col, a) {
  const k = hex(col);
  for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(H, cy + r); y++)
    for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(W, cx + r); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < r) { const t = 1 - d / r, i = y * W + x; T[i] = mix(T[i], k, a * t * t); }
    }
}

function crystal(x, y, h, col) {
  const c = hex(col), dark = mix(c, BLK, 0.45), lite = mix(c, WHT, 0.35);
  for (const k of [-1, 0, 1]) {
    const sh = k === 0 ? h : Math.round(h * 0.6), w = k === 0 ? 6 : 4, cx = x + k * 5;
    for (let j = 0; j < sh; j++) {
      const half = Math.round((w / 2) * (1 - j / sh));
      rect(cx - half, y - j, half + 1, 1, j % 5 === 0 ? lite : c);
      rect(cx + 1, y - j, half, 1, dark);
    }
  }
}

function paintBackdrop() {
  const P = {};
  for (const z of ZONES) P[z.id] = { s0: hex(z.sky[0]), s1: hex(z.sky[1]), r: hex(z.rock), l: hex(z.light.c) };
  const C = P.catacombs, M = P.camp, F = P.foundry, N = P.mines;
  const rockPx = (x, y) => {
    if (x < 400) {
      const row = y >> 3, off = row & 1 ? 8 : 0, bx = (x + off) >> 4;
      let c = mix(C.r, BLK, 0.3 * rand(bx, row, 5));
      if ((y & 7) === 7 || ((x + off) & 15) === 15) c = mix(C.r, BLK, 0.65);
      else if (rand(x >> 1, y >> 1, 9) > 0.93) c = mix(c, MOSS, 0.6);
      return c;
    }
    if (x < 960) {
      let c = mix(N.r, BLK, 0.15 + 0.35 * rand((x / 5) | 0, (y / 5) | 0, 3));
      if ((x + y) % 9 === 0) c = mix(c, WHT, 0.06);
      return c;
    }
    const px = x % 24, py = y % 16;
    let c = mix(F.r, BLK, 0.2 + 0.2 * rand((x / 24) | 0, (y / 16) | 0, 4));
    if (px === 0 || py === 0) c = mix(F.r, BLK, 0.65);
    else if ((px === 3 || px === 21) && (py === 3 || py === 13)) c = mix(c, WHT, 0.25);
    return c;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const top = rockTop(x);
      let c;
      if (y < top) {
        const t = y / top;
        c = across(x, mix(C.s0, C.s1, t), mix(M.s0, M.s1, t), mix(F.s0, F.s1, t));
        if (rand(x, y, 77) > 0.995) c = mix(c, WHT, 0.6);
      } else {
        c = mix(rockPx(x, y), BLK, 0.12 + 0.4 * Math.min(1, (y - 150) / 330));
        c = mix(c, x < 400 ? C.l : x < 960 ? N.l : F.l, 0.1);
      }
      T[y * W + x] = c;
    }
  // skull alcoves in the catacomb wall
  const bone = hex("#d8d2c0");
  for (let gx = 24; gx < 380; gx += 48)
    for (let gy = 205; gy < 470; gy += 40) {
      rect(gx, gy, 9, 7, hex("#0c1412"));
      rect(gx + 2, gy + 2, 5, 3, bone);
      set(gx + 3, gy + 3, BLK); set(gx + 5, gy + 3, BLK);
    }
  // crystals growing from the mine walls
  for (let i = 0; i < 16; i++) crystal(410 + rand(i, 1, 11) * 540, 200 + rand(i, 2, 12) * 260, 10 + rand(i, 3, 13) * 12, i % 2 ? "#6aa8ff" : "#b07aff");
}

function paintLava(l) {
  const lx = hex("#ff9a2a"), ld = hex("#a82a0a"), top = hex("#ffd36a");
  for (let x = l.x1; x < l.x2; x++)
    for (let y = l.y; y < H; y++) {
      const t = y - l.y;
      let c = y === l.y ? top : mix(lx, ld, Math.min(1, t / 40));
      if (rand(x >> 2, (y >> 2) + (x >> 5), 8) > 0.82) c = mix(c, top, 0.4);
      set(x, y, c);
    }
  rect(l.x1 - 4, l.y - 2, 4, H - l.y + 2, hex("#2a1a14"));
  rect(l.x2, l.y - 2, 4, H - l.y + 2, hex("#2a1a14"));
}

function paintLedge(l) {
  const w = l.x2 - l.x1, y = l.y, ladderX = LADDERS.map((v) => v.x);
  for (let x = l.x1; x < l.x2; x++) {
    const i = x - l.x1;
    if (l.kind === "grass") {
      const d = 8 + Math.round(34 * Math.sin((Math.PI * i) / w) + rand(x, 1, 2) * 4);
      set(x, y, GR0); set(x, y + 1, GR1);
      for (let j = 2; j < d; j++) set(x, y + j, mix(DIRT, BLK, (j / d) * 0.6 + rand(x, j, 3) * 0.2));
    } else if (l.kind === "stone" || l.kind === "bridge") {
      const th = l.kind === "bridge" ? 7 : 10;
      set(x, y, STONE[0]);
      for (let j = 1; j < th; j++) set(x, y + j, j % 5 === 0 || (x + (((j / 5) | 0) % 2) * 6) % 12 === 0 ? STONE[2] : STONE[1]);
      if (l.kind === "bridge") {
        set(x, y - 10, STONE[0]);
        if (i % 14 < 3) for (let j = 1; j < 10; j++) set(x, y - j, STONE[1]);
      }
    } else if (l.kind === "rails") {
      for (let j = 0; j < 6; j++) set(x, y + j, mix(BALLAST, BLK, rand(x, j, 6) * 0.5));
      if (i % 8 < 3) { set(x, y + 1, SLEEP); set(x, y + 2, SLEEP); }
      set(x, y, STEEL);
    } else if (l.kind === "scaffold") {
      for (let j = 0; j < 5; j++) set(x, y + j, i % 10 === 0 || j === 0 ? WOOD[2] : WOOD[j & 1 ? 0 : 1]);
      if (i % 40 < 3) for (let yy = y + 5; yy < 330; yy++) set(x, yy, WOOD[2]);
    } else {
      for (let j = 0; j < 4; j++) set(x, y + j, j === 0 ? ORG : i % 4 === 0 ? IRON1 : IRON0);
      if (!ladderX.some((lx) => Math.abs(lx - x) < 9)) {
        set(x, y - 12, RAIL);
        if (i % 14 === 0) for (let j = 1; j <= 12; j++) set(x, y - j, RAIL);
      }
      if (i % 50 === 0) for (let yy = y + 4; yy < (y < 250 ? 330 : 372); yy++) { set(x, yy, IRON0); set(x + 1, yy, IRON1); }
    }
  }
  if (l.kind === "scaffold")
    for (let p = l.x1; p + 40 <= l.x2; p += 40)
      for (let k = 0; k < 35; k++) { set(p + 3 + k, y + 6 + k, WOOD[1]); set(p + 37 - k, y + 6 + k, WOOD[1]); }
}

function paintStair(s) {
  const cols = s.kind === "stone" ? STONE : WOOD, rope = s.kind === "rope", w = s.x2 - s.x1;
  for (let x = s.x1; x <= s.x2; x++) {
    const i = x - s.x1, t = i / w, y = Math.round(s.y1 + (s.y2 - s.y1) * t), th = rope ? 3 : 6;
    for (let j = 0; j < th; j++) set(x, y + j, j === 0 ? cols[0] : i % 6 === 0 ? cols[2] : cols[1]);
    if (rope) {
      const sag = Math.round(4 * Math.sin(Math.PI * t));
      set(x, y - 14 + sag, ROPE);
      if (i % 10 === 0) for (let j = -13 + sag; j < 0; j++) set(x, y + j, ROPE);
    } else {
      set(x, y - 16, cols[1]);
      if (i % 18 === 0) for (let j = 1; j <= 16; j++) set(x, y - j, cols[1]);
      if (i % 20 === 0) for (let j = th; j < th + 26; j++) set(x, y + j, cols[2]);
    }
  }
  if (rope) { rect(s.x1, s.y1 - 16, 3, 22, WOOD[2]); rect(s.x2 - 2, s.y2 - 16, 3, 22, WOOD[2]); }
}

function paintTower(t) {
  const roof = hex("#2a2733"), dark = hex("#0c1012"), bronze = hex("#c8883a"), top = t.y - t.h;
  for (let y = top; y < t.y; y++)
    for (let x = t.x - 11; x <= t.x + 11; x++) {
      const row = (y - top) >> 3, off = row & 1 ? 8 : 0;
      set(x, y, (y & 7) === 7 || ((x + off) & 15) === 15 ? STONE[2] : x < t.x - 5 ? STONE[0] : x < t.x + 4 ? STONE[1] : STONE[2]);
    }
  rect(t.x - 5, top + 24, 11, 22, dark);
  rect(t.x - 4, top + 28, 9, 8, bronze); rect(t.x - 3, top + 36, 7, 3, bronze); set(t.x, top + 40, bronze);
  for (let j = 0; j < 24; j++) { const half = Math.round(13 * (1 - j / 24)); rect(t.x - half, top - j, half * 2 + 1, 1, roof); }
}

function paintTomb(x, y) {
  rect(x - 5, y - 12, 10, 12, STONE[1]); rect(x - 3, y - 14, 6, 2, STONE[1]); rect(x - 5, y - 12, 2, 12, STONE[0]);
  rect(x, y - 10, 1, 6, STONE[2]); rect(x - 2, y - 8, 5, 1, STONE[2]);
}

function paintLadder(l) {
  for (let y = l.top - 8; y <= l.bottom; y++) { set(l.x - 4, y, WOOD[0]); set(l.x - 3, y, WOOD[1]); set(l.x + 2, y, WOOD[0]); set(l.x + 3, y, WOOD[1]); }
  for (let y = l.top; y <= l.bottom; y += 6) rect(l.x - 4, y, 8, 1, WOOD[0]);
}

let painted = false;
function paintAll() {
  if (painted) return;
  painted = true;
  paintBackdrop();
  for (const p of PROPS.lava) paintLava(p);
  const pipe = hex("#5a5f6a");
  rect(1000, 128, 280, 5, pipe); rect(1000, 128, 280, 1, STEEL);
  for (let x = 1010; x < 1280; x += 40) rect(x, 126, 3, 9, IRON1);
  rect(1020, 100, 5, 90, pipe); rect(1180, 100, 5, 28, pipe);
  paintTower(PROPS.tower);
  for (const t of PROPS.tombs) paintTomb(t.x, t.y);
  for (const l of LEDGES) paintLedge(l);
  for (const s of STAIRS) paintStair(s);
  for (const l of LADDERS) paintLadder(l);
  for (const c of PROPS.crystals) crystal(c.x, c.y, c.h, c.c);
  for (const c of PROPS.chains) for (let j = 0; j < c.len; j++) rect(c.x, c.y + j, 2, 1, j % 4 < 2 ? hex("#8a8f9a") : hex("#4a4f5a"));
  for (const c of PROPS.crystals) glow(c.x, c.y - c.h / 2, c.h * 2 + 20, c.c, 0.3);
  for (const p of PROPS.campfire) glow(p.x, p.y - 10, 80, "#ffb347", 0.4);
  for (const p of PROPS.torches) glow(p.x, p.y - 58, 46, "#ffb347", 0.28);
  for (const p of PROPS.braziers) glow(p.x, p.y - 14, 46, "#ffb347", 0.28);
  for (const p of PROPS.lava) glow((p.x1 + p.x2) / 2, p.y, 110, "#ff7a2a", 0.45);
  for (const f of PROPS.furnaces) glow(f.x, f.y - 14, 56, "#ff7a2a", 0.4);
}

function gear(f, x, y, r, ang) {
  const c = hex("#6a707c"), d = hex("#3c4048");
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const m = Math.hypot(dx, dy);
      if (m <= r && m >= r * 0.4) pxRect(f, x + dx, y + dy, 1, 1, m > r - 2 ? c : d);
    }
  for (let k = 0; k < 8; k++) {
    const a = ang + (k * Math.PI) / 4;
    pxRect(f, x + Math.cos(a) * (r + 1) - 1, y + Math.sin(a) * (r + 1) - 1, 3, 3, c);
    pxRect(f, x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, 1, 1, c);
  }
}

export async function createHubScene() {
  paintAll();
  const [torch, brazier, campfire] = await Promise.all(["fire/torch", "fire/brazier", "fire/campfire"].map(loadFx));
  const list = [];
  for (const p of PROPS.torches) list.push([torch, p.x, p.y - 58]);
  for (const p of PROPS.braziers) list.push([brazier, p.x, p.y]);
  for (const p of PROPS.campfire) list.push([campfire, p.x, p.y]);
  const fxs = list.map(([mod, x, y], i) => ({ x, y, fx: createFx(mod, { x, y, seed: (mod.meta.options.seed ?? 1) + i }) }));
  const bg = new Uint32Array(VW * VH);
  const fly = [hex("#3f9a78"), hex("#9fffe0")], snow = [hex("#9fb4d8"), hex("#ffffff")];
  let t = 0;
  const near = (p, cx, cy) => p.x > cx - 90 && p.x < cx + VW + 90 && p.y > cy - 120 && p.y < cy + VH + 120;
  return {
    update(dt, cx, cy) {
      t += dt;
      for (const p of fxs) if (near(p, cx, cy)) p.fx.update(dt);
    },
    drawBg(cx, cy) {
      cx = Math.max(0, Math.min(W - VW, cx | 0));
      cy = Math.max(0, Math.min(CAM_MAX_Y, cy | 0));
      for (let y = 0; y < VH; y++) bg.set(T.subarray((cy + y) * W + cx, (cy + y) * W + cx + VW), y * VW);
      return bg;
    },
    drawProps(f, cx, cy) {
      for (const p of fxs) if (near(p, cx, cy)) p.fx.draw(f);
      for (const g of PROPS.gears) if (g.x > cx - 30 && g.x < cx + VW + 30) gear(f, g.x, g.y, g.r, t * (g.r > 12 ? 0.6 : -0.9));
      for (let i = 0; i < 16; i++) {
        const x = 30 + rand(i, 1, 21) * 360 + 8 * Math.sin(t * 0.6 + i), y = 170 + rand(i, 2, 22) * 290 + 6 * Math.cos(t * 0.5 + i * 2);
        const bright = Math.sin(t * 2 + i * 3) > 0.2;
        pxRect(f, x, y, bright ? 2 : 1, bright ? 2 : 1, fly[bright ? 1 : 0]);
      }
      for (let i = 0; i < 45; i++) {
        const x = 400 + rand(i, 1, 31) * 560 + 6 * Math.sin(t + i), y = 190 + ((rand(i, 2, 32) * 280 + t * (14 + rand(i, 3, 33) * 10)) % 280);
        pxRect(f, x, y, 1, 1, snow[i % 3 === 0 ? 1 : 0]);
      }
      for (let i = 0; i < 36; i++) {
        const x = 965 + rand(i, 1, 41) * 310 + 5 * Math.sin(t * 2 + i), y = 480 - ((rand(i, 2, 42) * 360 + t * (20 + rand(i, 3, 43) * 18)) % 360);
        pxRect(f, x, y, 1, 1, mix(hex("#ffb347"), hex("#ff4a1a"), (480 - y) / 360));
      }
    },
  };
}
