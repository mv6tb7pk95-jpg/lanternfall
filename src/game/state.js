// Lanternfall: shared state and tiny helpers. Every other game file imports from here.
// G holds everything that changes while the game runs. inp holds what the player is holding down.
export const $ = (id) => document.getElementById(id);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const fail = (e) => {
  const m = String((e && e.stack) || e);
  if (window.__lfShow) window.__lfShow(m);
  else console.error(m);
};

// The "Loading..." box ignores taps, so it can never block the menu buttons under it.
export const setStatus = (t) => {
  const s = $("status");
  s.textContent = t || "";
  s.hidden = !t;
  s.style.pointerEvents = "none";
};

export const G = {
  state: "menu", // menu | play | dialogue (story lines, gameplay paused) | over
  mode: "endless", // endless | story
  loading: false,
  booted: Promise.resolve(), // main.js replaces this with the promise of the shared effects loading
  key: null, // class key, e.g. "warden"
  cls: null, // the class definition from skills.js
  skills: null, // the equipped skills of this run, in slot order (set by run.js from the saved loadout); null = class skills
  chapter: null, // the story chapter being played, or null
  st: { atk: 0, hp: 0, cdr: 0, crit: 0, spd: 0, shard: 0 }, // gear bonuses (fractions)
  player: null,
  world: null,
  enemies: [], runs: [], fxs: [], shots: [], missiles: [],
  zones: [], // running zone skills (single-effect skills, see zoneskill.js)
  cds: [], cdMax: [], cdEls: [],
  mods: {}, // loaded pixelfx modules for the chosen class (skills by id, basic attack by path)
  M: {}, // shared pixelfx effects: slime ghost bat snake wisp hit-spark small-explosion
  wave: 0, kills: 0, got: 0, time: 0, queue: [], gap: 1, cam: 0, sparkN: 0,
  atkCd: 0,
  boss: null, bossOut: false, bossDown: false, bossT: 0,
};

export const inp = { left: false, right: false, jump: false, atk: false };
