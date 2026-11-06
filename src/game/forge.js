// Lanternfall: the Lantern Forge screen. It only draws the screen and handles its buttons.
// The rules live elsewhere: items, odds and costs in gacha.js, skill books and the pull itself in skillbook.js,
// the saved data in save.js. A pull can now give weapons, accessories AND skill books (see pullForge in skillbook.js).
// Skill books are equipped on the Loadout screen (loadout-ui.js), not here.
// main/menu.js calls initForge() once and renderForge() every time the screen opens.
import { loadSave, writeSave } from "./save.js";
import { ITEMS, RARITY, COST, PITY, MAX_LV, describe, itemById, equip, unequip } from "./gacha.js";
import { pullForge, bookShare, copiesOf, MAX_COPIES } from "./skillbook.js";
import { BOOKS } from "./skillpool.js";
import { CLASSES } from "./skills.js";

const $ = (id) => document.getElementById(id);
const save = loadSave();
const RANK = { legend: 0, epic: 1, rare: 2, common: 3 };
let last = []; // the results of the latest pull

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function card(item, lv, tag) {
  const r = RARITY[item.rarity], d = el("div", "item");
  d.style.borderColor = r.color;
  const n = el("b", "", item.name);
  n.style.color = r.color;
  d.append(
    n,
    el("small", "", r.name + " " + (item.slot === "weapon" ? "weapon" : "accessory") + (lv ? " · Lv " + lv : "")),
    el("small", "", describe(item, lv || 1)),
    el("small", "note", item.note)
  );
  if (tag) d.append(el("small", "tag", tag));
  return d;
}

// A skill book card. copies = how many the player owns (0 or undefined hides the count).
function bookCard(book, copies, tag) {
  const r = RARITY[book.rarity], d = el("div", "item");
  d.style.borderColor = r.color;
  const n = el("b", "", book.name);
  n.style.color = r.color;
  const cn = CLASSES[book.cls] ? CLASSES[book.cls].name : book.cls;
  d.append(
    n,
    el("small", "", r.name + " skill book · " + cn + (copies ? " · " + copies + "/" + MAX_COPIES + " copies" : "")),
    el("small", "", "Cooldown " + book.cd + " s · damage " + book.dmg + " per hit")
  );
  if (tag) d.append(el("small", "tag", tag));
  return d;
}

// The skill book collection sits above the BACK button. Built here so game.html needs no change.
function booksBox() {
  let box = $("fBooks");
  if (!box) {
    const back = $("fBack"), title = el("div", "fbox");
    title.id = "fBooksTitle";
    box = el("div", "grid");
    box.id = "fBooks";
    back.parentNode.insertBefore(title, back);
    back.parentNode.insertBefore(box, back);
  }
  return box;
}

function resultCard(r) {
  if (r.kind === "book") {
    const tag = r.isNew ? "NEW! Skill unlocked" : r.refund ? "Max copies: +" + r.refund + " shards" : "Extra copy (" + r.lv + "/" + MAX_COPIES + ")";
    return bookCard(r.item, r.lv, tag);
  }
  return card(r.item, r.lv, r.isNew ? "NEW!" : r.refund ? "Max level: +" + r.refund + " shards" : "Level " + r.lv);
}

export function renderForge() {
  $("fShards").textContent = save.shards;
  $("fCount").textContent = "Items " + Object.keys(save.inv).length + "/" + ITEMS.length + " · Books " + BOOKS.filter((b) => copiesOf(save, b.id) > 0).length + "/" + BOOKS.length + " · Pulls " + save.pulls;
  $("fOdds").textContent = Object.values(RARITY).map((r) => r.name + " " + r.rate + "%").join(" · ");
  const left = PITY - save.pity;
  const shares = Object.keys(RARITY).map((k) => { const s = bookShare(k); return RARITY[k].name + " " + s.books + " of " + s.total; }).join(" · ");
  $("fPity").textContent =
    "Pity: a Legendary is guaranteed in " + left + " pull" + (left === 1 ? "" : "s") +
    ". Each duplicate raises an item's level (max " + MAX_LV + "), then refunds shards. " +
    "Skill books drop in the same pulls (books in each pool: " + shares + ").";
  $("pull1").textContent = "PULL ×1 (" + COST.one + ")";
  $("pull10").textContent = "PULL ×10 (" + COST.ten + ")";
  $("pull1").disabled = save.shards < COST.one;
  $("pull10").disabled = save.shards < COST.ten;

  const res = $("fResults");
  res.innerHTML = "";
  for (const r of last) res.append(resultCard(r));

  const w = itemById(save.eq.weapon), a = itemById(save.eq.acc);
  $("fEquip").textContent = "Weapon: " + (w ? w.name : "none") + " · Accessory: " + (a ? a.name : "none");

  const inv = $("fInv");
  inv.innerHTML = "";
  const owned = ITEMS.filter((i) => save.inv[i.id]).sort((x, y) => RANK[x.rarity] - RANK[y.rarity] || x.name.localeCompare(y.name));
  if (!owned.length) inv.append(el("div", "fbox", "Nothing yet. Pull from the forge to find weapons and accessories."));
  for (const item of owned) {
    const c = card(item, save.inv[item.id]), on = save.eq[item.slot] === item.id;
    const b = el("button", "eq", on ? "EQUIPPED (tap to remove)" : "EQUIP");
    b.addEventListener("click", () => {
      if (on) unequip(save, item.slot);
      else equip(save, item.id);
      writeSave();
      renderForge();
    });
    c.append(b);
    inv.append(c);
  }

  // skill books you own (equip them from the Loadout screen)
  const have = BOOKS.filter((b) => copiesOf(save, b.id) > 0).sort((x, y) => RANK[x.rarity] - RANK[y.rarity] || x.name.localeCompare(y.name));
  $("fBooksTitle").innerHTML = "";
  $("fBooksTitle").append(el("b", "", "Skill books: "), document.createTextNode(have.length + " of " + BOOKS.length + " unlocked. Equip them from the Loadout screen."));
  const bb = booksBox();
  bb.innerHTML = "";
  for (const b of have) bb.append(bookCard(b, copiesOf(save, b.id)));
}

function doPull(n) {
  const r = pullForge(save, n);
  if (!r.ok) {
    $("fMsg").textContent = r.reason;
    return;
  }
  $("fMsg").textContent = "";
  last = r.results;
  writeSave();
  renderForge();
}

export function initForge() {
  booksBox(); // make sure the book section exists before the first render
  $("pull1").addEventListener("click", () => doPull(1));
  $("pull10").addEventListener("click", () => doPull(10));
}
