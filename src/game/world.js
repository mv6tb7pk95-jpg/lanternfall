// Lanternfall: the maps. A map is a THEME (colours and prop positions). Each one is a night sky, a brick wall with
// stone pillars, a stone floor, and real pixelfx fire props that light it: wall torches, braziers and a campfire.
// createWorld() with no argument builds the original gatehouse, so the rest of the game keeps working unchanged.
// The sky and floor use the same recipe as pixelfx's own "sky" and "ground" backdrops, with the colours from the theme.
import * as PX from "./px.js";

const { createFx, hex, mix, rand, loadFx } = PX;

export const VW = 320; // the game's pixel resolution; the canvas is scaled up with crisp pixels
export const VH = 180;
export const GY = 150; // the floor line
export const WORLD_W = 1280;
const WALL_TOP = 44;

export const DEFAULT_THEME = {
  id: "gate",
  sky: { top: "#0d0b14", low: "#221d33", star: "#cfc8ff", moon: null },
  wall: {
    brick: ["#1d192b", "#221d33", "#181523"], mortar: "#110f19", cap: "#322b4c", hi: "#3a3354",
    stone: ["#3a3358", "#2d2848", "#211d36", "#17142a"], gap: 140,
  },
  floor: { edge: "#4a4263", light: "#2b2639", dark: "#211d2d", mortar: "#1a1724" },
  props: { torch: [210, 490, 770, 1050], brazier: [350, 910], campfire: [630], tint: null },
};

// ---------------------------------------------------------------- recolouring
const BLACK = hex("#000000"), WHITE_ = hex("#ffffff");
const lum = (c) => ((c & 255) * 0.3 + ((c >>> 8) & 255) * 0.59 + ((c >>> 16) & 255) * 0.11) / 255;

/**
 * Options that recolour a pixelfx effect: pass them to createFx. `spec` is a pixelfx palette name ("ice", "lava",
 * "blood", "holy", ...) or a "#hex" colour. Returns {} when the effect has no `palette` option or spec is empty.
 */
export function tintOpts(mod, spec, k = 0.7) {
  const pal = mod && mod.meta && mod.meta.options && mod.meta.options.palette;
  if (!spec || !Array.isArray(pal) || !pal.length) return {};
  const ramp = PX.PAL && PX.PAL[spec];
  if (Array.isArray(ramp)) return { palette: ramp };
  if (typeof spec !== "string" || spec[0] !== "#") return {};
  const t = hex(spec);
  return {
    palette: pal.map((c) => {
      const v = hex(c), l = lum(v);
      return mix(v, l < 0.5 ? mix(BLACK, t, l * 2) : mix(t, WHITE_, (l - 0.5) * 2), k);
    }),
  };
}

// ---------------------------------------------------------------- textures
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function buildSky(theme) {
  const S = theme.sky, top = hex(S.top), low = hex(S.low), star = hex(S.star || "#cfc8ff"), m = S.moon, moon = m ? hex(m.c) : 0;
  const out = new Uint32Array(VW * VH);
  for (let y = 0; y < VH; y++)
    for (let x = 0; x < VW; x++) {
      const t = y / (VH - 1), step = (t * 5 + BAYER[((y & 3) << 2) | (x & 3)] / 16) | 0;
      let c = mix(top, low, Math.min(1, step / 4));
      const r = rand(x, y, 77);
      if (r > 0.994) c = mix(c, star, 0.35 + (r - 0.994) * 90);
      if (m) {
        const d = Math.hypot(x - m.x, y - m.y);
        if (d <= m.r) c = Math.hypot(x - (m.x + m.r * 0.35), y - (m.y - m.r * 0.25)) < m.r * 0.9 ? moon : mix(moon, c, 0.5);
        else if (d <= m.r + 4) c = mix(c, moon, 0.2 * (1 - (d - m.r) / 4));
      }
      out[y * VW + x] = c;
    }
  return out;
}

function buildFloor(theme) {
  const F = theme.floor, edge = hex(F.edge), light = hex(F.light), dark = hex(F.dark), mortar = hex(F.mortar);
  const out = new Uint32Array(WORLD_W * VH);
  for (let y = GY; y < VH; y++) {
    const gy = y - GY;
    for (let x = 0; x < WORLD_W; x++) {
      let c;
      if (gy === 0) c = edge;
      else {
        const row = Math.floor((gy - 1) / 5), off = row % 2 ? 6 : 0;
        const mo = (gy - 1) % 5 === 4 || (x + off) % 12 === 0;
        c = mo ? mortar : gy < 3 ? light : dark;
      }
      out[y * WORLD_W + x] = c;
    }
  }
  return out;
}

// the wall is drawn once into a texture the size of the whole world, then scrolled by blitting rows
function buildWall(theme) {
  const W = theme.wall, h = GY - WALL_TOP, tex = new Uint32Array(WORLD_W * h);
  const BRICK = W.brick.map(hex), MORTAR = hex(W.mortar), CAP = hex(W.cap), HI = hex(W.hi), STONE = W.stone.map(hex);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < WORLD_W; x++) {
      const row = (y / 8) | 0, off = row & 1 ? 8 : 0, bx = ((x + off) / 16) | 0;
      let c = BRICK[(rand(bx, row, 5) * 3) | 0];
      if (y % 8 === 7 || (x + off) % 16 === 15) c = MORTAR;
      else if (y % 8 === 0) c = mix(c, HI, 0.3);
      if (y < 3) c = y === 0 ? HI : CAP;
      tex[y * WORLD_W + x] = c;
    }
  // stone pillars: lit on the left, dark on the right, a brighter capital and base
  for (let cx = 70; cx + 8 <= WORLD_W; cx += W.gap || 140)
    for (let y = 0; y < h; y++)
      for (let dx = -8; dx < 8; dx++) {
        let k = dx < -5 ? 0 : dx < 1 ? 1 : dx < 5 ? 2 : 3;
        if (dx === -8 || dx === 7) k = 3;
        let c = STONE[k];
        if (y < 5 || y >= h - 7) c = STONE[Math.max(0, k - 1)];
        if (y === 5 || y === h - 8) c = STONE[3];
        tex[y * WORLD_W + cx + dx] = c;
      }
  return tex;
}

// ---------------------------------------------------------------- the world
export async function createWorld(theme = DEFAULT_THEME) {
  const [torch, brazier, campfire] = await Promise.all(["fire/torch", "fire/brazier", "fire/campfire"].map(loadFx));
  const sky = buildSky(theme), floor = buildFloor(theme), wall = buildWall(theme);
  const bg = new Uint32Array(VW * VH);
  const pr = theme.props;

  // torch: its origin is the bracket plate, so it hangs 58 px above the floor; brazier and campfire stand on it
  const place = [];
  for (const x of pr.torch || []) place.push([torch, x, GY - 58]);
  for (const x of pr.brazier || []) place.push([brazier, x, GY]);
  for (const x of pr.campfire || []) place.push([campfire, x, GY]);
  const props = place.map(([mod, x, y], i) => ({
    x,
    fx: createFx(mod, { x, y, seed: (mod.meta.options.seed ?? 1) + i, ...tintOpts(mod, pr.tint, 0.8) }),
  }));

  const near = (x, cam) => x > cam - 90 && x < cam + VW + 90;
  return {
    props,
    update(dt, cam) {
      for (const p of props) if (near(p.x, cam)) p.fx.update(dt);
    },
    /** The static backdrop for this camera position (cam is an integer, 0..WORLD_W-VW). */
    drawBg(cam) {
      bg.set(sky);
      for (let y = WALL_TOP; y < GY; y++) {
        const r = (y - WALL_TOP) * WORLD_W + cam;
        bg.set(wall.subarray(r, r + VW), y * VW);
      }
      for (let y = GY; y < VH; y++) {
        const r = y * WORLD_W + cam;
        bg.set(floor.subarray(r, r + VW), y * VW);
      }
      return bg;
    },
    drawProps(frame, cam) {
      for (const p of props) if (near(p.x, cam)) p.fx.draw(frame);
    },
  };
}
