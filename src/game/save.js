// Lanternfall: persistent data. Everything the player keeps (shards, story progress, items, equipment, pity)
// lives in this one plain object and is stored in this browser's localStorage. Nothing leaves the device.
// Data only: the rules that change it live in gacha.js and main.js.
const KEY = "lanternfall.save.v1";

const fresh = () => ({
  shards: 300, // a starting purse so the forge can be tried right away
  cleared: 0, // story chapters cleared (chapter n is open when n <= cleared + 1)
  inv: {}, // item id -> level (1 = owned once; duplicates raise it)
  eq: { weapon: null, acc: null },
  pity: 0, // pulls since the last legendary
  pulls: 0,
  best: 0, // best endless wave
});

let cache = null;

export function loadSave() {
  if (cache) return cache;
  const s = fresh();
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || "null");
    if (o && typeof o === "object") {
      for (const k of ["shards", "cleared", "pity", "pulls", "best"]) if (Number.isFinite(o[k])) s[k] = Math.max(0, Math.floor(o[k]));
      if (o.inv && typeof o.inv === "object") for (const [id, n] of Object.entries(o.inv)) if (Number.isFinite(n) && n > 0) s.inv[id] = Math.floor(n);
      if (o.eq && typeof o.eq === "object") {
        s.eq.weapon = typeof o.eq.weapon === "string" ? o.eq.weapon : null;
        s.eq.acc = typeof o.eq.acc === "string" ? o.eq.acc : null;
      }
    }
  } catch (e) {
    // storage blocked (private mode) or corrupt: start fresh and keep playing
  }
  cache = s;
  return s;
}

export function writeSave() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache || fresh()));
  } catch (e) {
    // nothing to do: the game still works, progress just won't persist
  }
}

export function resetSave() {
  cache = fresh();
  writeSave();
  return cache;
}
