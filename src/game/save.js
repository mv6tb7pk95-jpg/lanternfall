// Lanternfall: persistent data. Everything the player keeps (shards, story progress, items, equipment, pity,
// skill books, skill loadouts and shop upgrades) lives in this one plain object and is stored in this browser's localStorage.
// Nothing leaves the device. Data only: the rules that change it live in gacha.js, skillbook.js, loadout.js, shop.js and the screens.
const KEY = "lanternfall.save.v1"; // new fields are additive, so old saves still load

const fresh = () => ({
  shards: 300, // a starting purse so the forge can be tried right away
  cleared: 0, // story chapters cleared (chapter n is open when n <= cleared + 1)
  inv: {}, // item id -> level (1 = owned once; duplicates raise it)
  eq: { weapon: null, acc: null },
  pity: 0, // equipment banner: pulls since the last legendary item
  pulls: 0, // equipment banner: total pulls
  best: 0, // best endless wave
  books: {}, // skill id -> copies owned (1+ = unlocked; extra copies are fragments for later upgrades)
  loadout: {}, // class id -> list of equipped skill ids, in slot order
  bookPity: 0, // skill book banner: pulls since the last legendary book (its own counter, separate from pity)
  bookPulls: 0, // skill book banner: total pulls
  shop: {}, // shop upgrade id -> level (shop.js)
});

let cache = null;

const isId = (v) => typeof v === "string" && v.length > 0 && v.length <= 64;

export function loadSave() {
  if (cache) return cache;
  const s = fresh();
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || "null");
    if (o && typeof o === "object") {
      for (const k of ["shards", "cleared", "pity", "pulls", "best", "bookPity", "bookPulls"]) if (Number.isFinite(o[k])) s[k] = Math.max(0, Math.floor(o[k]));
      if (o.inv && typeof o.inv === "object") for (const [id, n] of Object.entries(o.inv)) if (Number.isFinite(n) && n > 0) s.inv[id] = Math.floor(n);
      if (o.eq && typeof o.eq === "object") {
        s.eq.weapon = typeof o.eq.weapon === "string" ? o.eq.weapon : null;
        s.eq.acc = typeof o.eq.acc === "string" ? o.eq.acc : null;
      }
      if (o.books && typeof o.books === "object") for (const [id, n] of Object.entries(o.books)) if (Number.isFinite(n) && n > 0) s.books[id] = Math.floor(n);
      if (o.loadout && typeof o.loadout === "object") {
        for (const [cls, ids] of Object.entries(o.loadout)) if (Array.isArray(ids)) s.loadout[cls] = ids.filter(isId).slice(0, 8);
      }
      if (o.shop && typeof o.shop === "object") for (const [id, n] of Object.entries(o.shop)) if (Number.isFinite(n) && n > 0) s.shop[id] = Math.floor(n);
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
