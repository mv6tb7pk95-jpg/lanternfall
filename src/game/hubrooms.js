// Lanternfall: the hub's rooms. Data and two small helpers, no drawing and no screens.
//
// The hub is shown one room at a time. A room is a window onto the painted hub (hubscene.js / hubworld.js): the camera
// is locked inside the room's box, so the player never sees the next room until he walks into it.
// The connectors you already have are the exits:
//   Upper Camp  -- wooden staircase (west) --> The Catacombs
//   Upper Camp  -- shaft ladder (x = 470) --> The Crystal Mines
//   Catacombs   -- stone bridge (east, y = 330) --> The Crystal Mines
//   Upper Camp  -- rope bridge (east) --> The Ember Foundry
//   Crystal Mines -- minecart rails (east, y = 330) --> The Ember Foundry
//
// x1..x2 and y1..y2 are the room's box in world pixels (the camera never leaves it).
// gy1..gy2 is the range of floor heights (p.gy) that count as "in this room" when two rooms share the same x range.

export const ROOMS = [
  { id: "camp", name: "Upper Camp", x1: 400, x2: 960, y1: 0, y2: 250, gy1: 0, gy2: 240 },
  { id: "mines", name: "The Crystal Mines", x1: 400, x2: 960, y1: 190, y2: 480, gy1: 240, gy2: 481 },
  { id: "catacombs", name: "The Catacombs", x1: 0, x2: 400, y1: 150, y2: 480, gy1: 0, gy2: 481 },
  { id: "foundry", name: "The Ember Foundry", x1: 960, x2: 1280, y1: 120, y2: 480, gy1: 0, gy2: 481 },
];

// The hero stays in his current room until he is this many px outside its box, so standing on a boundary
// does not flip the room (and the fade) back and forth.
const HOLD = 6;

/** The room that holds a hero at world x with floor height gy. cur is the room he is in now (or null). */
export function roomAt(x, gy, cur) {
  if (cur && x >= cur.x1 - HOLD && x < cur.x2 + HOLD && gy >= cur.gy1 - HOLD && gy < cur.gy2 + HOLD) return cur;
  for (const r of ROOMS) if (x >= r.x1 && x < r.x2 && gy >= r.gy1 && gy < r.gy2) return r;
  return cur || ROOMS[0];
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * The camera for a room: x is the left edge of the view, y the top edge, in world pixels. It follows the hero but
 * never leaves the room's box. His feet sit about 62% of the way down the view. VW, VH is the view size.
 */
export function roomCam(p, room, VW, VH) {
  const feet = p.gy + p.y;
  return {
    x: clamp(Math.round(p.x - VW / 2), room.x1, Math.max(room.x1, room.x2 - VW)),
    y: clamp(Math.round(feet - VH * 0.62), room.y1, Math.max(room.y1, room.y2 - VH)),
  };
}
