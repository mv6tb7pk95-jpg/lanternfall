// Lanternfall: the walking rules of the multi-tier hub. No drawing, no screens: only where the hero's feet are.
//
// The hero keeps two heights. p.gy is the floor under his feet in world pixels (bigger = lower; a run leaves it unset
// and uses GY). p.y is the jump offset above that floor, exactly as in a run, so entities.js updatePlayer() still does
// the walking and the jump for us. After it runs we only fix up p.gy: follow stairs, step off ledge edges, grab ladders.
//
// Keys: a stair or a ladder is entered with "up" (touch: stick up). Walking along a floor that passes under a stair
// does not pull the hero up onto it. Coming down a stair or ladder needs no key.
import { LEDGES, STAIRS, LADDERS, SPAWN, WORLD_H, zoneAt } from "./hubworld.js";
import { updatePlayer } from "./entities.js";

export const CLIMB_SPEED = 62; // px per second on a ladder
const FOLLOW = 10; // a floor within this many px of his feet counts as the one he stands on (stairs change height as he walks)
const GRAB = 6; // how close to a ladder's x he must be to take hold
const TIER = 6; // building doors are used from the tier within this many px of the door's floor

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Every floor at world x: [{ y, stair }]. */
export function surfacesAt(x) {
  const out = [];
  for (const l of LEDGES) if (x >= l.x1 && x <= l.x2) out.push({ y: l.y, stair: false });
  for (const s of STAIRS)
    if (x >= s.x1 && x <= s.x2) out.push({ y: s.y1 + ((s.y2 - s.y1) * (x - s.x1)) / (s.x2 - s.x1), stair: true });
  return out;
}

/** The ladder the hero could take hold of right now going dir (-1 up, +1 down), or null. */
function ladderAt(x, gy, dir) {
  for (const L of LADDERS) {
    if (Math.abs(x - L.x) > GRAB) continue;
    if (dir < 0 && gy > L.top + 0.5 && gy <= L.bottom + 0.5) return L;
    if (dir > 0 && gy < L.bottom - 0.5 && gy >= L.top - 0.5) return L;
  }
  return null;
}

/** True if pressing up (dir -1) or down (dir +1) would start a climb. hub.js uses it so "up" climbs near a ladder. */
export function canClimb(p, dir) {
  return !p.climb && p.y === 0 && !!ladderAt(p.x, p.gy, dir);
}

/** True while the hero hangs on a ladder. */
export const isClimbing = (p) => !!p.climb;

/** Put the hero on the floor nearest to (x, y). If nothing is at x he goes to the spawn point. */
export function placeHero(p, x, y) {
  let list = surfacesAt(x);
  if (!list.length) {
    x = SPAWN.x;
    y = SPAWN.y;
    list = surfacesAt(x);
  }
  let best = list[0];
  for (const s of list) if (Math.abs(s.y - y) < Math.abs(best.y - y)) best = s;
  Object.assign(p, { x, gy: best.y, y: 0, vy: 0, climb: null, stair: best.stair, climbT: 0 });
}

/** True when the hero stands on the same tier as a door whose floor is at doorY (not climbing, not in the air). */
export function onTier(p, doorY) {
  return !p.climb && p.y === 0 && Math.abs(p.gy - doorY) <= TIER;
}

/** The zone he is in, for lighting. Uses the floor he stands on, one pixel above it. */
export function heroZone(p) {
  return zoneAt(p.x, p.gy - 1);
}

/**
 * The camera that follows him: x is the left edge of the view, y the top edge, both in world pixels.
 * His feet sit about 62% of the way down the view. VW, VH is the view size, worldW the world width.
 */
export function camTarget(p, VW, VH, worldW) {
  const feet = p.gy + p.y;
  return {
    x: clamp(Math.round(p.x - VW / 2), 0, worldW - VW),
    y: clamp(Math.round(feet - VH * 0.62), 0, WORLD_H - VH),
  };
}

function climbStep(p, dt, inp, vert) {
  const L = p.climb;
  const dir = (vert.down ? 1 : 0) - (vert.up ? 1 : 0);
  p.t += dt;
  p.hurt = Math.max(0, p.hurt - dt);
  p.moving = false;
  p.x = L.x;
  if (dir) {
    p.gy = clamp(p.gy + dir * CLIMB_SPEED * dt, L.top, L.bottom);
    p.climbT += dt;
  }
  if ((dir < 0 && p.gy <= L.top) || (dir > 0 && p.gy >= L.bottom)) {
    p.gy = dir < 0 ? L.top : L.bottom; // reached an end: stand on the floor there
    p.climb = null;
    return;
  }
  if (inp.left || inp.right) {
    // step sideways off the ladder, but only onto a floor that is right there
    const near = surfacesAt(p.x).find((s) => Math.abs(s.y - p.gy) <= 3);
    if (near) {
      p.gy = near.y;
      p.stair = near.stair;
      p.climb = null;
    }
  }
}

/**
 * One frame of hub walking. inp is the usual { left, right, jump }; vert is { up, down } (held keys / stick).
 * Call it instead of updatePlayer().
 */
export function walkStep(p, dt, inp, vert = {}) {
  if (p.climb) return climbStep(p, dt, inp, vert);
  const x0 = p.x;
  updatePlayer(p, dt, inp); // sideways walking, the jump and gravity, all relative to p.gy
  if (p.y < 0 || p.vy < 0) return; // in the air: the floor is checked again when he lands

  const dir = (vert.up ? -1 : 0) + (vert.down ? 1 : 0);
  if (dir) {
    const L = ladderAt(p.x, p.gy, dir);
    if (L) {
      p.climb = L;
      p.x = L.x;
      p.stair = false;
      return;
    }
  }

  const here = surfacesAt(p.x).filter((s) => Math.abs(s.y - p.gy) <= FOLLOW);
  if (here.length) {
    let nearest = here[0];
    for (const s of here) if (Math.abs(s.y - p.gy) < Math.abs(nearest.y - p.gy)) nearest = s;
    let higher = null;
    for (const s of here) if (s.y < nearest.y - 0.5 && (!higher || s.y < higher.y)) higher = s;
    const pick = higher && (vert.up || p.stair) ? higher : nearest; // a higher floor only on "up", or when already on stairs
    p.gy = pick.y;
    p.stair = pick.stair;
    return;
  }

  // no floor under his feet: he walked off an edge, drop to the next floor below
  let below = null;
  for (const s of surfacesAt(p.x)) if (s.y > p.gy && (!below || s.y < below.y)) below = s;
  if (below) {
    p.y = p.gy - below.y; // negative: he starts above the new floor, gravity does the rest
    p.gy = below.y;
    p.vy = 0;
    p.stair = false;
  } else {
    p.x = x0; // nothing below either: the edge of the world, he stays put
  }
}
