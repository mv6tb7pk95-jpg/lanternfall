// Lanternfall: the real pixelfx loops of each hub room. Kept small on purpose: torches, the campfire, the portal rifts and
// one or two flames per room. Buildings get no pixelfx at all (fielddraw.js paints them), so nothing covers their signs.
// buildRoomFx(room) -> a list of { x, y, layer, make, fx }. updateFx / drawFx run the list each frame.
// Every effect is placed from the room data (fieldmaps.js): a door's x and y are the floor under its centre.
// An effect that cannot be loaded is skipped, and an effect that ends by itself is started again, so a room never breaks.
import { createFx, loadFx } from "./px.js";
import { tintOpts } from "./world.js";
import { ROOMS } from "./fieldmaps.js";

// Scenery effects per room: path, pts [x, y] (world px), opts, tints (null keeps the effect's own colours).
const ROOM_FX = {
  camp: [],
  catacombs: [{ path: "fire/spirit-flame", pts: [[190, 250], [470, 250]] }],
  mines: [{ path: "ice/ice-crystal", pts: [[352, 204], [582, 152]], opts: { height: 34 }, tints: [null, "#c07aff"] }],
  foundry: [{ path: "fire/brazier", pts: [[355, 308]] }],
};

function entries(room) {
  const out = [...(ROOM_FX[room.id] || [])];
  for (const d of room.deco) {
    if (d.t === "torch") out.push({ path: "fire/torch", pts: [[d.x, d.y - 58]] });
    else if (d.t === "campfire") out.push({ path: "fire/campfire", pts: [[d.x, d.y]] });
  }
  for (const d of room.doors) {
    if (d.kind !== "portal") continue; // only the portals get a rift; buildings and hunt doors are painted
    // the rift is tinted with the colour of the room it leads to
    out.push({ path: "arcane/portal", pts: [[d.x, d.y]], opts: { width: 12, height: 18 }, tints: [ROOMS[d.to] ? ROOMS[d.to].look.accent : room.look.accent] });
  }
  return out;
}

export async function buildRoomFx(room) {
  const list = [], todo = entries(room);
  await Promise.all([...new Set(todo.map((e) => e.path))].map((p) => loadFx(p).catch(() => null))); // load them side by side
  let n = 0;
  for (const e of todo) {
    let mod;
    try { mod = await loadFx(e.path); } catch (err) { console.warn("room effect skipped:", e.path, err); continue; }
    e.pts.forEach(([x, y], i) => {
      const seed = ((mod.meta && mod.meta.options && mod.meta.options.seed) ?? 1) + n++ * 3;
      const make = () => createFx(mod, { x, y, seed, ...(e.opts || {}), ...tintOpts(mod, e.tints ? e.tints[i % e.tints.length] : null, 0.8) });
      try { list.push({ x, y, layer: e.layer || "front", make, fx: make() }); } catch (err) { console.warn("room effect skipped:", e.path, err); }
    });
  }
  return list;
}

/** Step the effects that are near the screen. seen(x, y) says whether a point is near the view. */
export function updateFx(list, dt, seen) {
  for (const p of list) {
    if (!seen(p.x, p.y)) continue;
    p.fx.update(dt);
    if (p.fx.done && p.fx.done()) p.fx = p.make();
  }
}

/** Draw the effects of one layer ("back" or "front") that are near the screen. */
export function drawFx(list, f, layer, seen) {
  for (const p of list) if (p.layer === layer && seen(p.x, p.y)) p.fx.draw(f);
}
