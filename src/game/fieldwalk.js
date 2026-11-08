// Lanternfall: the walking rules of the hub's rooms (fieldmaps.js). No drawing, no screens: only where the hero's feet are.
//
// The hero keeps the two heights that entities.js drawPlayer() already reads:
//   p.gy  the floor under (or, in the air, nearest below) his feet, in room pixels (bigger = lower)
//   p.y   how far his feet are above that floor (0 = standing, negative = in the air)
// so his feet are at p.gy + p.y. This file does its own walking, jumping and climbing and does not call updatePlayer().
//
// Platforms are one-way: he rises through them and lands on top of them. Down + Jump drops through a platform that is not
// solid. A rope is taken hold of with Up (or Down, from the platform at its top). While on a rope: Up / Down climbs,
// Left or Right plus Jump hops off. Reaching either end puts him on the platform there.
//
// Keys (hub.js, controls.js): inp = { left, right, jump } as in a run (jump is one frame), vert = { up, down } held.
import { SPEED } from "./entities.js";

export const JUMP_V = -270; // px/s. With gravity 560 the jump is 65 px high, so a 52 px tier is one jump
export const GRAVITY = 560;
export const CLIMB = 70; // px/s on a rope
const HOP_V = -170; // the hop off a rope
const GRAB = 7; // how close to a rope's x he must be to take hold
const EDGE = 3; // he stays on a platform this many px past its end (so the edge is forgiving)
const DOOR_TIER = 6; // a door is used from a floor within this many px of its y

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const feetOf = (p) => p.gy + p.y;

/** The platform at x whose walking line is within tol of y, or null. */
export function platAt(room, x, y, tol = 1) {
  for (const pl of room.plats) if (x >= pl.x1 - EDGE && x <= pl.x2 + EDGE && Math.abs(pl.y - y) <= tol) return pl;
  return null;
}

/** Put the hero standing on the platform nearest to y at x. If nothing is at x he goes to the room's spawn point. */
export function placeAt(p, room, x, y) {
  const find = (px, py) => {
    let best = null;
    for (const pl of room.plats) if (px >= pl.x1 && px <= pl.x2 && (!best || Math.abs(pl.y - py) < Math.abs(best.y - py))) best = pl;
    return best;
  };
  let best = find(x, y);
  if (!best) {
    x = room.spawn.x;
    best = find(x, room.spawn.y) || room.plats[0];
  }
  Object.assign(p, { x, gy: best.y, y: 0, vy: 0, air: false, climb: null, drop: null, ropeCool: 0, climbT: 0 });
}

/** The rope he could take hold of going dir (-1 up, +1 down), or null. */
function ropeFor(room, x, feet, dir, cool) {
  if (cool > 0) return null;
  for (const R of room.ropes) {
    if (Math.abs(x - R.x) > GRAB) continue;
    if (dir < 0 && feet > R.top + 2 && feet <= R.bottom + 1) return R; // below the top: climb up
    if (dir > 0 && feet >= R.top - 1 && feet < R.bottom - 2) return R; // at or above the bottom: climb down
  }
  return null;
}

function grab(p, R) {
  Object.assign(p, { climb: R, x: R.x, gy: clamp(feetOf(p), R.top, R.bottom), y: 0, vy: 0, air: false, drop: null, climbT: 0 });
}

function leaveRope(p, room, y) {
  p.climb = null;
  p.gy = y;
  p.y = 0;
  p.vy = 0;
  p.ropeCool = 0.25; // no instant re-grab while Up / Down is still held
  p.air = !platAt(room, p.x, y, 0.5); // if the rope's end has no platform under it, he just falls
}

function climbStep(p, room, dt, inp, vert) {
  const R = p.climb;
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  if (inp.jump && dir) {
    // hop off sideways
    p.face = dir;
    Object.assign(p, { climb: null, air: true, vy: HOP_V, y: 0, ropeCool: 0.3, x: clamp(p.x + dir * 4, 12, room.w - 12) });
    return;
  }
  const d = (vert.down ? 1 : 0) - (vert.up ? 1 : 0);
  if (d) {
    p.gy = clamp(p.gy + d * CLIMB * dt, R.top, R.bottom);
    p.climbT += dt;
  }
  if (d < 0 && p.gy <= R.top) leaveRope(p, room, R.top);
  else if (d > 0 && p.gy >= R.bottom) leaveRope(p, room, R.bottom);
}

/**
 * One frame in a room. Call it instead of updatePlayer(). The caller clears inp.jump afterwards.
 * inp: { left, right, jump }; vert: { up, down } (held).
 */
export function stepField(p, room, dt, inp, vert = {}) {
  dt = Math.min(dt, 0.05);
  p.t += dt;
  p.hurt = Math.max(0, p.hurt - dt);
  p.moving = false;
  p.ropeCool = Math.max(0, (p.ropeCool || 0) - dt);
  if (p.climb) return climbStep(p, room, dt, inp, vert);

  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  if (dir) {
    p.face = dir;
    p.x = clamp(p.x + dir * SPEED * (p.spd || 1) * dt, 12, room.w - 12);
    p.walk += dt;
    p.moving = true;
  }

  if (!p.air) {
    const pl = platAt(room, p.x, p.gy, 0.5);
    if (!pl) {
      p.air = true; // walked off an edge
      p.vy = 0;
    } else if (inp.jump) {
      p.air = true;
      if (vert.down && !pl.solid) {
        p.vy = 80; // drop through this platform
        p.drop = pl.y;
      } else p.vy = JUMP_V;
    }
  }

  const dy = (vert.down ? 1 : 0) - (vert.up ? 1 : 0);
  if (dy) {
    const R = ropeFor(room, p.x, feetOf(p), dy, p.ropeCool);
    if (R) return grab(p, R);
  }

  if (!p.air) return;

  const f0 = feetOf(p);
  p.vy += GRAVITY * dt;
  const f1 = f0 + p.vy * dt;
  if (p.drop != null && f1 > p.drop + 3) p.drop = null;
  if (p.vy >= 0) {
    // falling: the highest platform whose line he crosses this frame catches him
    let hit = null;
    for (const pl of room.plats) {
      if (p.x < pl.x1 || p.x > pl.x2) continue;
      if (p.drop != null && pl.y <= p.drop + 0.5) continue;
      if (pl.y >= f0 - 0.01 && pl.y <= f1 && (!hit || pl.y < hit.y)) hit = pl;
    }
    if (hit) {
      Object.assign(p, { gy: hit.y, y: 0, vy: 0, air: false, drop: null });
      return;
    }
  }
  // still in the air: gy is the platform right below him (for the shadow), y how far above it he is
  let below = null;
  for (const pl of room.plats) if (p.x >= pl.x1 && p.x <= pl.x2 && pl.y >= f1 && (!below || pl.y < below.y)) below = pl;
  if (below) {
    p.gy = below.y;
    p.y = f1 - below.y;
  } else {
    p.gy = f1;
    p.y = 0;
    if (f1 > room.h + 60) placeAt(p, room, room.spawn.x, room.spawn.y); // fell out of the room: back to the start
  }
}

/** The door he is standing at (on its floor, not climbing, not in the air), or null. */
export function doorAt(room, p) {
  if (p.climb || p.air) return null;
  let best = null, bd = Infinity;
  for (const d of room.doors) {
    if (Math.abs(p.gy - d.y) > DOOR_TIER) continue;
    const dist = Math.abs(p.x - d.x);
    if (dist <= d.w / 2 + 6 && dist < bd) {
      best = d;
      bd = dist;
    }
  }
  return best;
}

/** The camera for a room: x is the left edge of the view, y the top edge, never outside the room. VW, VH is the view size. */
export function fieldCam(p, room, VW, VH) {
  return {
    x: clamp(Math.round(p.x - VW / 2), 0, Math.max(0, room.w - VW)),
    y: clamp(Math.round(feetOf(p) - VH * 0.62), 0, Math.max(0, room.h - VH)),
  };
}
