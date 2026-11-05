// Lanternfall: the map. A night sky, a brick wall with stone pillars, a stone floor (pixelfx's own "sky" and
// "ground" backdrops), and real pixelfx fire props that light it: wall torches, braziers and a campfire.
import { createFx, backdrop, hex, mix, rand, loadFx } from "./px.js";

export const VW = 320; // the game's pixel resolution; the canvas is scaled up with crisp pixels
export const VH = 180;
export const GY = 150; // the floor line
export const WORLD_W = 1280;
const WALL_TOP = 44;

const PILLARS = [];
for (let x = 70; x < WORLD_W; x += 140) PILLARS.push(x);

// the wall is drawn once into a texture the size of the whole world, then scrolled by blitting rows
function buildWall() {
  const h = GY - WALL_TOP, tex = new Uint32Array(WORLD_W * h);
  const BRICK = ["#1d192b", "#221d33", "#181523"].map(hex), MORTAR = hex("#110f19"), CAP = hex("#322b4c"), HI = hex("#3a3354");
  const STONE = ["#3a3358", "#2d2848", "#211d36", "#17142a"].map(hex);
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
  for (const cx of PILLARS)
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

export async function createWorld() {
  const [torch, brazier, campfire] = await Promise.all(["fire/torch", "fire/brazier", "fire/campfire"].map(loadFx));
  const sky = backdrop("sky", VW, VH), floor = backdrop("ground", WORLD_W, VH, GY), wall = buildWall();
  const bg = new Uint32Array(VW * VH);

  // torch: its origin is the bracket plate, so it hangs 58 px above the floor; brazier and campfire stand on it
  const place = [];
  for (const x of [210, 490, 770, 1050]) place.push([torch, x, GY - 58]);
  for (const x of [350, 910]) place.push([brazier, x, GY]);
  place.push([campfire, 630, GY]);
  const props = place.map(([mod, x, y], i) => ({ x, fx: createFx(mod, { x, y, seed: (mod.meta.options.seed ?? 1) + i }) }));

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
