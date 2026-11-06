// Lanternfall: skill books in the Lantern Forge. Rules only: no DOM and no pixelfx calls.
// Imports data from skillpool.js (the books) and gacha.js (items, odds, costs). It changes the save object that the
// caller passes in; the caller stores it with writeSave().
//
// How it works:
//  - A book is unlocked when save.books[id] >= 1. Extra copies are fragments (kept for a later upgrade feature).
//  - At MAX_COPIES a further copy refunds shards, like items at MAX_LV in gacha.js.
//  - pullForge() replaces pull() from gacha.js. It uses the SAME odds, costs, pity and 10-pull guarantee, but the
//    pool of each rarity holds the items AND the books of that rarity, each with the same weight.
//    (gacha.js keeps its own pull() untouched, so the current Forge screen still works until it is switched over.)
//  - No class filter: a pull can give a book of any class. Starter skills (skills.js) are always unlocked.
import { booksByRarity, booksOf } from "./skillpool.js";
import { RARITY, COST, PITY, MAX_LV, ITEMS } from "./gacha.js";

export const MAX_COPIES = 10;

const ORDER = ["legend", "epic", "rare", "common"]; // checked in this order when rolling (same as gacha.js)

// POOL[rarity] = [{ kind: "item" | "book", item }]  ("item" holds the book object when kind is "book")
const POOL = Object.fromEntries(
  ORDER.map((r) => [
    r,
    [
      ...ITEMS.filter((i) => i.rarity === r).map((item) => ({ kind: "item", item })),
      ...booksByRarity(r).map((item) => ({ kind: "book", item })),
    ],
  ])
);

/** How many copies of a book the player owns. */
export const copiesOf = (save, id) => (save.books && save.books[id]) || 0;

/** True when the book is unlocked (1 or more copies). */
export const isUnlocked = (save, id) => copiesOf(save, id) > 0;

/** The unlocked books of one class, as book objects (see skillpool.js). */
export const unlockedBooksOf = (save, classId) => booksOf(classId).filter((b) => isUnlocked(save, b.id));

/** Share of a rarity's pool that is books, for the odds text on the Forge screen. Example: { books: 3, total: 9 }. */
export function bookShare(rarity) {
  const list = POOL[rarity] || [];
  return { books: list.filter((p) => p.kind === "book").length, total: list.length };
}

function pickRarity(save) {
  if (save.pity + 1 >= PITY) return "legend";
  let r = Math.random() * 100;
  for (const k of ORDER) {
    r -= RARITY[k].rate;
    if (r < 0) return k;
  }
  return "common";
}

/**
 * Pull n (1 or 10) times. Spends shards, changes save, and returns { ok, results } or { ok: false, reason }.
 * Each result: { kind: "item" | "book", item, isNew, lv, refund }
 *   kind "item": item is from ITEMS and lv is its level (1..MAX_LV).
 *   kind "book": item is a book from BOOKS and lv is the number of copies owned (1..MAX_COPIES).
 *   refund is the shards given back when the item or book was already at its maximum.
 */
export function pullForge(save, n) {
  const cost = n === 10 ? COST.ten : COST.one;
  if (save.shards < cost) return { ok: false, reason: "Not enough shards (" + cost + " needed)." };
  if (!save.books) save.books = {};
  save.shards -= cost;
  const results = [];
  for (let i = 0; i < n; i++) {
    let rk = pickRarity(save);
    if (n === 10 && i === 9 && rk === "common" && !results.some((r) => r.item.rarity !== "common")) rk = "rare";
    save.pity = rk === "legend" ? 0 : save.pity + 1;
    save.pulls++;
    const list = POOL[rk];
    const pick = list[Math.floor(Math.random() * list.length)];
    const it = pick.item;
    const store = pick.kind === "book" ? save.books : save.inv;
    const max = pick.kind === "book" ? MAX_COPIES : MAX_LV;
    const had = store[it.id] || 0;
    let refund = 0;
    if (had >= max) {
      refund = RARITY[rk].refund;
      save.shards += refund;
    } else store[it.id] = had + 1;
    results.push({ kind: pick.kind, item: it, isNew: had === 0, lv: store[it.id], refund });
  }
  return { ok: true, results };
}
