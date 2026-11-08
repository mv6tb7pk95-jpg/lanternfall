// Lanternfall: where the real pixelfx loops go in each hub room. Data plus a small builder; it draws nothing itself.
// buildRoomFx(room) -> a list of { x, y, layer, make, fx }. updateFx / drawFx run the list each frame.
//   layer "back"  is drawn before the doors (floor circles, the teleporter pad, the lit signs behind the shops),
//   layer "front" is drawn after them (portal rifts, flames).
// Every effect is placed from the room data (fieldmaps.js): a door's x and y are the floor under its centre.
// An effect that cannot be loaded is skipped, and an effect that ends by itself is started again, so a room never breaks.
import { createFx, loadFx } from "./px.js";
import { tintOpts } from "./world.js";
import { ROOMS } from "./fieldmaps.js";

// Scenery effects per room: path, pts [x, y] (world px), opts, tints (null keeps the effect's own colours).
const ROOM_FX = {
  camp: [{ path: "fire/brazier", pts: [[200, 268], [470, 268]] }],
  catacombs: [{ path: "fire/spirit-flame", pts: [[190, 250], [360, 250], [470, 250], [270, 150]] }],
  mines: [{ path: "ice/ice-crystal", pts: [[134, 256], [352, 204], [522, 256], [582, 152]], opts: { height: 34 }, tints: [null, "#c07aff"] }],
  foundry: [{ path: "fire/brazier", pts: [[355, 308], [240, 204], [440, 204], [420, 256]] }],
};

// Effects on the five buildings. dy moves the effect up (negative) from the door's floor point.
const BUILDING_FX = {
  loadout: [{ path: "arcane/rune-circle", dy: 0, layer: "back", tint: "#7aa8ff" }],
  party: [{ path: "arcane/rune-circle", dy: 0, layer: "back", tint: "#ffb25a" }],
  gate: [{ path: "scifi/teleporter-pad", dy: 0, layer: "back", tint: "#c07aff" }],
  shop: [{ path: "holy/sunburst", dy: -62, layer: "back", tint: "#9fffc0" }],
  forge: [{ path: "holy/sunburst", dy: -62, layer: "back", tint: "#ff9a4a" }],
};

// Beside each hunting door: the flame or crystal of that hunting ground.
const HUNT_FX = {
  grave: { path: "shadow/shadow-flames" },
  hollow: { path: "ice/ice-crystal", opts: { height: 22 } },
  slag: { path: "fire/brazier" },
};

function entries(room) {
  const out = [...(ROOM_FX[room.id] || [])];
  for (const d of room.deco) {
    if (d.t === "torch") out.push({ path: "fire/torch", pts: [[d.x, d.y - 58]] });
    else if (d.t === "campfire") out.push({ path: "fire/campfire", pts: [[d.x, d.y]] });
    else if (d.t === "furnace") out.push({ path: "fire/campfire", pts: [[d.x, d.y - 8]] }); // flames in the furnace mouth
  }
  for (const d of room.doors) {
    if (d.kind === "portal") {
      // the rift is tinted with the colour of the room it leads to
      out.push({ path: "arcane/portal", pts: [[d.x, d.y]], opts: { width: 12, height: 18 }, tints: [ROOMS[d.to] ? ROOMS[d.to].look.accent : room.look.accent] });
    } else if (d.kind === "hunt") {
      out.push({ path: "arcane/portal", pts: [[d.x, d.y]], opts: { width: 12, height: 18 }, tints: ["#ff4a3a"] });
      const h = HUNT_FX[d.hunt];
      if (h) out.push({ path: h.path, pts: [[d.x + 26, d.y]], opts: h.opts });
    } else {
      for (const b of BUILDING_FX[d.id] || []) out.push({ path: b.path, pts: [[d.x, d.y + b.dy]], layer: b.layer, tints: [b.tint] });
    }
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
