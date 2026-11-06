// Lanternfall: the skill book banner of the Lantern Forge. Rules only: no DOM and no pixelfx calls.
// Imports data from skillpool.js (the books) and gacha.js (rarity names, colours and refunds). It changes the save
// object that the caller passes in; the caller stores it with writeSave().
//
// This banner is SEPARATE from the equipment banner in gacha.js:
//                      equipment banner (gacha.js)        skill book banner (this file)
//   drops              weapons and accessories            skill books only
//   cost               100 / 900 shards (x1 / x10)        120 / 1080 shards
//   odds               55 / 30 / 12 / 3 %                 45 / 35 / 15 / 5 %   (common / rare / epic / legend)
//   pity               a Legendary on pull 40             a Legendary on pull 30
//   counters in save   pity, pulls                        bookPity, bookPulls
//   duplicates         raise the level, max 6             extra copies, max 10, then a shard refund
//   10-pull            at least one Rare or better        at least one Rare or better
//
// A book is unlocked when save.books[id] >= 1. Extra copies are fragments (kept for a later upgrade feature).
// No class filter: a pull can give a book of any class. Starter skills (skills.js) are always unlocked.
import { BOOKS, booksByRarity, booksOf } from "./skillpool.js";
import { RARITY } from "./gacha.js";

export const MAX_COPIES = 10;
export const BOOK_COST = { one: 120, ten: 1080 };
export const BOOK_PITY = 30;
export const BOOK_RATES = { common: 45, rare: 35, epic: 15, legend: 5 }; // adds up to 100

const ORDER = ["legend", "epic", "rare", "common"]; // checked in this order when rolling

// What each rarity can drop. If a rarity has no books yet, a roll of it falls back to any book.
const POOL = Object.fromEntries(ORDER.map((r) => [r, booksByRarity(r)]));

/** How many copies of a book the player owns. */
export const copiesOf = (save, id) => (save.books && save.books[id]) || 0;

/** True when the book is unlocked (1 or more copies). */
export const isUnlocked = (save, id) => copiesOf(save, id) > 0;

/** The unlocked books of one class, as book objects (see skillpool.js). */
export const unlockedBooksOf = (save, classId) => booksOf(classId).filter((b) => isUnlocked(save, b.id));

function pickRarity(save) {
  if ((save.bookPity | 0) + 1 >= BOOK_PITY) return "legend";
  let r = Math.random() * 100;
  for (const k of ORDER) {
    r -= BOOK_RATES[k];
    if (r < 0) return k;
  }
  return "common";
}

/**
 * Pull n (1 or 10) skill books. Spends shards, changes save, and returns { ok, results } or { ok: false, reason }.
 * Each result: { item, isNew, lv, refund }
 *   item   a book from BOOKS
 *   lv     the number of copies owned after the pull (1..MAX_COPIES)
 *   refund the shards given back when the book was already at MAX_COPIES (0 otherwise)
 */
export function pullBooks(save, n) {
  const cost = n === 10 ? BOOK_COST.ten : BOOK_COST.one;
  if (save.shards < cost) return { ok: false, reason: "Not enough shards (" + cost + " needed)." };
  if (!save.books) save.books = {};
  save.shards -= cost;
  const results = [];
  for (let i = 0; i < n; i++) {
    let rk = pickRarity(save);
    if (n === 10 && i === 9 && rk === "common" && !results.some((r) => r.item.rarity !== "common")) rk = "rare";
    save.bookPity = rk === "legend" ? 0 : (save.bookPity | 0) + 1;
    save.bookPulls = (save.bookPulls | 0) + 1;
    const list = POOL[rk].length ? POOL[rk] : BOOKS;
    const book = list[Math.floor(Math.random() * list.length)];
    const had = save.books[book.id] || 0;
    let refund = 0;
    if (had >= MAX_COPIES) {
      refund = RARITY[book.rarity].refund;
      save.shards += refund;
    } else save.books[book.id] = had + 1;
    results.push({ item: book, isNew: had === 0, lv: save.books[book.id], refund });
  }
  return { ok: true, results };
}
