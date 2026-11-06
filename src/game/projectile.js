// Lanternfall: projectile skills (arrow shot, pistol shots, rocket launcher, fireball throw, ice lance throw).
//
// The pixelfx move plays its projectile on a fixed script: it always flies to the same spot and "lands" at a fixed time.
// An enemy standing in the way was crossed without being hit, because damage only landed in a fixed zone at the end.
// This file holds the flight of each projectile as data (taken from the move files, pinned commit a841596), so combat.js
// can follow the projectile frame by frame and hurt the first enemy it touches.
//
// This file is pure data and two tiny helpers. It imports nothing. combat.js decides who gets hurt.
//
// Each flight:
//   t0, t1   the move's own time (seconds) when the projectile leaves and when it would land
//   at(t)    how far ahead of the hero (px) its tip is at move time t
// Each skill:
//   splash   px around the landing point that a blast also hurts (0 = only what the projectile touches)
//   boom     size of the explosion the game adds when a blast projectile is stopped early (0 = none)

const lin = (x0, x1, t0, t1) => (t) => x0 + ((x1 - x0) * (t - t0)) / (t1 - t0);

export const FLIGHTS = {
  // arrow: leaves at 0.56 s, tip travels 30 -> 180 px, lands at 0.80 s
  "arrow-shot": { splash: 0, boom: 0, flights: [{ t0: 0.56, t1: 0.8, at: lin(30, 180, 0.56, 0.8) }] },
  // pistol: three tracers, 0.12 s each, 32 -> 170 px
  "pistol-shots": {
    splash: 0,
    boom: 0,
    flights: [0.14, 0.42, 0.7].map((t) => ({ t0: t, t1: t + 0.12, at: lin(32, 170, t, t + 0.12) })),
  },
  // rocket: leaves at 0.60 s, accelerates (time^1.5), 44 -> 194 px, lands at 1.16 s
  "rocket-launcher": {
    splash: 46,
    boom: 0.9,
    flights: [{ t0: 0.6, t1: 1.16, at: (t) => 44 + Math.pow(Math.max(0, t - 0.6), 1.5) * (150 / Math.pow(0.56, 1.5)) }],
  },
  // fireball: leaves at 0.95 s, 28 -> 184.4 px at 340 px/s, lands at 1.41 s
  "fireball-throw": { splash: 40, boom: 0.6, flights: [{ t0: 0.95, t1: 1.41, at: lin(28, 184.4, 0.95, 1.41) }] },
  // ice lance: leaves at 0.80 s, 34 -> 170 px, lands at 1.14 s
  "ice-lance-throw": { splash: 20, boom: 0, flights: [{ t0: 0.8, t1: 1.14, at: lin(34, 170, 0.8, 1.14) }] },
};

// the same test skills.js uses: a hit that does something (not the caster's own wind-up shake or the end-of-move reset)
const isReal = (h) => h.target !== false && ((h.push ?? 1.2) !== 0 || (h.straw ?? 8) > 0);

/**
 * The module to play for this skill. For a projectile skill it is a copy of the move whose real hits no longer freeze or
 * shake by themselves: the game does that at the moment the projectile really hits (which may be earlier). Others: unchanged.
 */
export function prepared(mod, id) {
  if (!FLIGHTS[id] || !mod || !mod.act || !mod.act.hits) return mod;
  return { ...mod, act: { ...mod.act, hits: mod.act.hits.map((h) => (isReal(h) ? { ...h, stop: 0, shake: 0 } : h)) } };
}

/**
 * Give a running skill its flights: run.fl = { cfg, list, n, orig, cuts }.
 * orig  the move's real hits with their original freeze and shake (the copy from prepared() has them removed)
 * cuts  [from, to] move times during which the move's own effect is hidden (a stopped projectile must not fly on)
 * mod   the ORIGINAL module (not the prepared copy)
 */
export function attachFlights(run, mod, id) {
  const cfg = FLIGHTS[id];
  if (!cfg) return;
  run.fl = {
    cfg,
    list: cfg.flights.map((f, i) => ({ ...f, i, prev: 0, done: false })), // prev starts at the hero, so an enemy next to him is hit too
    n: 0,
    orig: ((mod.act && mod.act.hits) || []).filter(isReal),
    cuts: [],
  };
  // hide the move's own picture while a cut is active (the effect object is a plain object, so its draw can be wrapped)
  const fx = run.act.fx, draw = fx.draw;
  fx.draw = (frame, layer) => {
    const t = run.act.t;
    if (!run.fl.cuts.some((c) => t >= c[0] && t < c[1])) draw(frame, layer);
  };
}
