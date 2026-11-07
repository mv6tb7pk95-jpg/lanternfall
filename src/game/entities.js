// Lanternfall: the player and the enemies.
// The hero is pixelfx's own skeleton character, drawn with posed() (the same call createAct uses for skills).
// The enemies are the real pixelfx critter effects (slime, ghost, bat, snake, wisp) moved around by changing their x.
// A boss is an ordinary critter recoloured with a pixelfx palette and given much more health.
import { STAND, READY, posed, createFx, hex, pxRect, pxShadow } from "./px.js";
import { GY, WORLD_W, tintOpts } from "./world.js";
import { attackPose } from "./attacks.js";

export const SPEED = 70; // px per second

// ---------------------------------------------------------------- player
/** st: the gear bonuses from gacha.js statsOf() (fractions: 0.1 = 10%). */
export function createPlayer(cls, st = {}) {
  const maxHp = Math.round(cls.hp * (1 + (st.hp || 0)));
  return { cls, x: 110, y: 0, vy: 0, face: 1, hp: maxHp, maxHp, walk: 0, moving: false, hurt: 0, locked: false, t: 0, spd: 1 + (st.spd || 0), atk: null };
}

/** inp: { left, right, jump }. While locked (a skill is playing) the body belongs to the act. */
export function updatePlayer(p, dt, inp) {
  p.t += dt;
  p.hurt = Math.max(0, p.hurt - dt);
  p.moving = false;
  if (!p.locked) {
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir) {
      if (!p.atk) p.face = dir; // he keeps facing the way he swings
      p.x = Math.max(12, Math.min(WORLD_W - 12, p.x + dir * SPEED * p.spd * (p.atk ? 0.5 : 1) * dt));
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
  if (p.climb) {
    // on a ladder (the hub): hands and feet swap up and down while he moves. My own tuning, not seen on screen yet.
    const s = Math.floor((p.climbT || 0) * 6) & 1;
    return { ...STAND, lean: 0, crouch: 0, fx: 2, fy: s ? -34 : -26, bx: 5, by: s ? -26 : -34, ffx: 2, ffy: s ? -10 : -4, fbx: 5, fby: s ? -4 : -10 };
  }
  if (p.atk) return attackPose(p.atk.pose, p.atk.t); // the basic attack's swing (attacks.js)
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
  const gy = p.gy ?? GY; // the hub's upper tiers set p.gy (hubwalk.js); a run leaves it unset and uses the one floor line
  if (!p.climb) pxShadow(f, p.x, gy, 10 - Math.min(6, Math.round(-p.y / 6)));
  if (p.hurt > 0 && (Math.floor(p.t * 20) & 1)) return; // blink while hurt
  const r = posed(poseOf(p));
  const bx = Math.round(p.x) - (f.ox | 0), by = Math.round(gy) + Math.round(p.y) - (f.oy | 0);
  for (let i = 0; i < r.n; i++) {
    const x = p.face < 0 ? bx - r.xs[i] - 1 : bx + r.xs[i], y = by + r.ys[i];
    if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
    f.color[y * f.w + x] = r.color[i];
  }
}

// ---------------------------------------------------------------- enemies
// h      how tall it stands (for its health bar)
// fly    how high above the floor its centre floats
// hy     the height a hit spark appears at
// half   half of its width: attacks reach it when they touch this far around its centre
// reach  how close it must be to the hero to hurt him; stop: how close it walks before it stops
// opts   extra pixelfx options for the effect (the wisp needs a hover height)
// The snake is about 78 px long with its head 30 px ahead of its centre, so it has a wide reach.
export const TYPES = {
  slime: { hp: 55, speed: 16, dmg: 8, h: 26, fly: 0, hy: 12, half: 10, reach: 13, stop: 12 },
  ghost: { hp: 40, speed: 24, dmg: 9, h: 44, fly: 0, hy: 26, half: 10, reach: 13, stop: 12 },
  bat: { hp: 28, speed: 44, dmg: 7, h: 18, fly: 46, hy: 46, half: 8, reach: 13, stop: 12 },
  snake: { hp: 70, speed: 20, dmg: 10, h: 18, fly: 0, hy: 8, half: 24, reach: 32, stop: 28 },
  wisp: { hp: 45, speed: 30, dmg: 10, h: 74, fly: 0, hy: 36, half: 22, reach: 26, stop: 14, opts: { hover: 30 } },
};

let uid = 1;

/**
 * opt.scale  { hp, dmg } multipliers (a chapter's difficulty)
 * opt.tint   a pixelfx palette name or "#hex" that recolours it
 * opt.boss   a boss definition from story.js ({ name, hp, dmg, speed, tint }): it uses those numbers instead
 */
export function spawnEnemy(type, mod, x, opt = {}) {
  const T = TYPES[type], seed = ((uid++ * 7) % 97) + 1; // a different phase for every one
  const sc = opt.scale || { hp: 1, dmg: 1 }, B = opt.boss || null;
  const fx = createFx(mod, { x: Math.round(x), y: GY - T.fly, seed, ...(T.opts || {}), ...tintOpts(mod, B ? B.tint : opt.tint) });
  const maxHp = B ? B.hp : Math.round(T.hp * sc.hp);
  return {
    type, T, fx, x, hp: maxHp, maxHp, dmg: B ? B.dmg : Math.round(T.dmg * sc.dmg), speed: B ? B.speed : T.speed,
    hitCd: 0.6, show: 0, kb: 0, boss: !!B, name: B ? B.name : type, dead: false,
  };
}

export function updateEnemy(e, dt, player) {
  const dx = player.x - e.x, dir = dx < 0 ? -1 : 1;
  e.show = Math.max(0, e.show - dt);
  e.hitCd = Math.max(0, e.hitCd - dt);
  const move = Math.abs(dx) > e.T.stop ? dir * e.speed : 0;
  e.x = Math.max(8, Math.min(WORLD_W - 8, e.x + (move + e.kb) * dt));
  e.kb *= Math.pow(0.02, dt);
  // the effect draws itself where its options say
  e.fx.options.x = Math.round(e.x);
  e.fx.options.flip = dir < 0;
  e.fx.update(dt);
}

export const touching = (e, p) => Math.abs(e.x - p.x) < e.T.reach;

const BAR_EDGE = hex("#150f1a"), BAR_BACK = hex("#5a1a1a"), BAR_FILL = hex("#e0443a");

export function drawEnemy(f, e) {
  e.fx.draw(f);
  if (e.show > 0 && !e.boss) { // a boss shows its health in the bar at the top of the screen
    const w = 16, x = Math.round(e.x) - 8, y = GY - e.T.fly - e.T.h - 6;
    pxRect(f, x - 1, y - 1, w + 2, 4, BAR_EDGE);
    pxRect(f, x, y, w, 2, BAR_BACK);
    pxRect(f, x, y, Math.max(1, Math.round((w * e.hp) / e.maxHp)), 2, BAR_FILL);
  }
}
