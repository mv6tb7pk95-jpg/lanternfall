// Lanternfall: the player and the enemies.
// The hero is pixelfx's own skeleton character, drawn with posed() (the same call createAct uses for skills).
// The enemies are the real pixelfx critter effects (slime, ghost, bat) moved around by changing their x.
import { STAND, READY, posed, createFx, hex, pxRect, pxShadow } from "./px.js";
import { GY, WORLD_W } from "./world.js";

export const SPEED = 70; // px per second

// ---------------------------------------------------------------- player
export function createPlayer(cls) {
  return { cls, x: 110, y: 0, vy: 0, face: 1, hp: cls.hp, maxHp: cls.hp, walk: 0, moving: false, hurt: 0, locked: false, t: 0 };
}

/** inp: { left, right, jump }. While locked (a skill is playing) the body belongs to the act. */
export function updatePlayer(p, dt, inp) {
  p.t += dt;
  p.hurt = Math.max(0, p.hurt - dt);
  p.moving = false;
  if (!p.locked) {
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir) {
      p.face = dir;
      p.x = Math.max(12, Math.min(WORLD_W - 12, p.x + dir * SPEED * dt));
      p.walk += dt;
      p.moving = true;
    }
    if (inp.jump && p.y === 0) p.vy = -190;
  }
  if (p.y < 0 || p.vy < 0) {
    p.vy += 560 * dt;
    p.y += p.vy * dt;
    if (p.y >= 0) {
      p.y = 0;
      p.vy = 0;
    }
  }
}

// Poses are pixelfx rig poses: hands (fx, fy / bx, by) and feet (ffx, ffy / fbx, fby), y negative is up.
// The walk is held on 12 fps steps like pixelfx's own acts. These numbers are my own tuning.
function poseOf(p) {
  if (p.y < -1) return { ...STAND, lean: 1, fx: -6, fy: -23, bx: 6, by: -21, ffx: 4, ffy: -10, fbx: -4, fby: -5 };
  if (p.moving) {
    const ph = (Math.floor(p.walk * 12) / 12) * 2.8 * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph);
    return {
      ...STAND,
      lean: 1,
      crouch: Math.abs(c) < 0.45 ? 1 : 0,
      fx: -3 - Math.round(s * 2), bx: 5 + Math.round(s * 2),
      ffx: -2 + Math.round(s * 6), ffy: -4 - Math.round(Math.max(0, c) * 4),
      fbx: 3 - Math.round(s * 6), fby: -4 - Math.round(Math.max(0, -c) * 4),
    };
  }
  // standing: the ready stance, breathing
  const up = Math.floor(p.t * 3) & 1, B = { ...STAND, ...READY };
  return { ...B, crouch: (B.crouch ?? 0) + up, fy: (B.fy ?? STAND.fy) + up, by: (B.by ?? STAND.by) + up };
}

export function drawPlayer(f, p) {
  pxShadow(f, p.x, GY, 10 - Math.min(6, Math.round(-p.y / 6)));
  if (p.hurt > 0 && (Math.floor(p.t * 20) & 1)) return; // blink while hurt
  const r = posed(poseOf(p));
  const bx = Math.round(p.x) - (f.ox | 0), by = GY + Math.round(p.y) - (f.oy | 0);
  for (let i = 0; i < r.n; i++) {
    const x = p.face < 0 ? bx - r.xs[i] - 1 : bx + r.xs[i], y = by + r.ys[i];
    if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
    f.color[y * f.w + x] = r.color[i];
  }
}

// ---------------------------------------------------------------- enemies
// h: how tall it stands (for its health bar); fly: how high above the floor its centre floats
export const TYPES = {
  slime: { hp: 55, speed: 16, dmg: 8, h: 26, fly: 0 },
  ghost: { hp: 40, speed: 24, dmg: 9, h: 44, fly: 0 },
  bat: { hp: 28, speed: 44, dmg: 7, h: 18, fly: 46 },
};

let uid = 1;

export function spawnEnemy(type, mod, x) {
  const T = TYPES[type], seed = ((uid++ * 7) % 97) + 1; // a different phase for every one
  const fx = createFx(mod, { x: Math.round(x), y: GY - T.fly, seed });
  return { type, T, fx, x, hp: T.hp, maxHp: T.hp, hitCd: 0.6, show: 0, kb: 0 };
}

export function updateEnemy(e, dt, player) {
  const dx = player.x - e.x, dir = dx < 0 ? -1 : 1;
  e.show = Math.max(0, e.show - dt);
  e.hitCd = Math.max(0, e.hitCd - dt);
  const move = Math.abs(dx) > 12 ? dir * e.T.speed : 0;
  e.x = Math.max(8, Math.min(WORLD_W - 8, e.x + (move + e.kb) * dt));
  e.kb *= Math.pow(0.02, dt);
  // the effect draws itself where its options say
  e.fx.options.x = Math.round(e.x);
  e.fx.options.flip = dir < 0;
  e.fx.update(dt);
}

export const touching = (e, p) => Math.abs(e.x - p.x) < 13;

const BAR_EDGE = hex("#150f1a"), BAR_BACK = hex("#5a1a1a"), BAR_FILL = hex("#e0443a");

export function drawEnemy(f, e) {
  e.fx.draw(f);
  if (e.show > 0) {
    const w = 16, x = Math.round(e.x) - 8, y = GY - e.T.fly - e.T.h - 6;
    pxRect(f, x - 1, y - 1, w + 2, 4, BAR_EDGE);
    pxRect(f, x, y, w, 2, BAR_BACK);
    pxRect(f, x, y, Math.max(1, Math.round((w * e.hp) / e.maxHp)), 2, BAR_FILL);
  }
}
