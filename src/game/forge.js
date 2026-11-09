// Lanternfall: the Lantern Forge screen. It only draws the screen and handles its buttons.
// Two separate banners, each on its own tab:
//   Equipment    weapons and accessories. Rules, odds and costs in gacha.js (pull()).
//   Skill Books  skill books only. Rules, odds and costs in skillbook.js (pullBooks()).
// The saved data is in save.js. Skill books are equipped on the Loadout screen (loadout-ui.js), not here.
// menu.js calls initForge() once and renderForge() every time the screen opens.
//
// Every skill book card has a PREVIEW EFFECT button (also for books you don't own yet). It opens the modal of preview.js.
// preview.js is loaded only when the button is tapped, so a problem in it can never stop the Forge from loading.
// Gear (weapons and accessories) has no visual effect in the code, so it has no preview button.
//
// Elements it expects in game.html: fShards, fCount, fTabEq, fTabBk, the equipment panel (elements with class "fe":
// fOdds, fPity, pull1, pull10, fMsg, fResults, fEquip, fInv) and the book panel (elements with class "fb":
// bOdds, bPool, bPity, bPull1, bPull10, bMsg, bResults, bOwned), and fBack.
import { loadSave, writeSave } from "./save.js";
import { ITEMS, RARITY, COST, PITY, MAX_LV, describe, itemById, equip, unequip, pull } from "./gacha.js";
import { pullBooks, copiesOf, MAX_COPIES, BOOK_COST, BOOK_PITY, BOOK_RATES } from "./skillbook.js";
import { BOOKS, booksByRarity } from "./skillpool.js";
import { CLASSES } from "./skills.js";

const $ = (id) => document.getElementById(id);
const save = loadSave();
const RANK = { legend: 0, epic: 1, rare: 2, common: 3 };
const SHOW = ["common", "rare", "epic", "legend"]; // order of the odds text
let tab = "eq"; // "eq" (equipment) or "bk" (skill books)
let lastEq = []; // the results of the latest equipment pull
let lastBk = []; // the results of the latest skill book pull

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// Opens the effect preview of one skill book. A failure only shows a message under the books; nothing else is touched.
async function openPreview(id) {
  const m = $("bMsg");
  try {
    const mod = await import("./preview.js");
    m.textContent = (await mod.openSkillPreview(id)) ? "" : "There is no preview for this skill.";
  } catch (e) {
    console.error(e);
    m.textContent = "The preview could not open: " + ((e && e.message) || e);
  }
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
    el("small", "", "Cooldown " + book.cd + " s · damage " + book.dmg + (book.kind === "zone" ? " per tick" : " per hit"))
  );
  if (tag) d.append(el("small", "tag", tag));
  const pv = el("button", "eq pv", "PREVIEW EFFECT");
  pv.addEventListener("click", () => openPreview(book.id));
  d.append(pv);
  return d;
}

// ---------- tabs ----------
function showTab() {
  for (const e of document.querySelectorAll("#forge .fe")) e.hidden = tab !== "eq";
  for (const e of document.querySelectorAll("#forge .fb")) e.hidden = tab !== "bk";
  $("fTabEq").classList.toggle("on", tab === "eq");
  $("fTabBk").classList.toggle("on", tab === "bk");
}

// ---------- equipment banner ----------
function renderEquipment() {
  $("fOdds").textContent = SHOW.map((k) => RARITY[k].name + " " + RARITY[k].rate + "%").join(" · ");
  const left = PITY - save.pity;
  $("fPity").textContent =
    "Pity: a Legendary item is guaranteed in " + left + " pull" + (left === 1 ? "" : "s") +
    ". A 10-pull has at least one Rare or better. Each duplicate raises an item's level (max " + MAX_LV + "), then refunds shards.";
  $("pull1").textContent = "PULL ×1 (" + COST.one + ")";
  $("pull10").textContent = "PULL ×10 (" + COST.ten + ")";
  $("pull1").disabled = save.shards < COST.one;
  $("pull10").disabled = save.shards < COST.ten;

  const res = $("fResults");
  res.innerHTML = "";
  for (const r of lastEq) res.append(card(r.item, r.lv, r.isNew ? "NEW!" : r.refund ? "Max level: +" + r.refund + " shards" : "Level " + r.lv));

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
}

// ---------- skill book banner ----------
function renderBooks() {
  $("bOdds").textContent = SHOW.map((k) => RARITY[k].name + " " + BOOK_RATES[k] + "%").join(" · ");

  // what each rarity can drop, and the chance of each single book (the rarity's odds split between its books)
  const pool = $("bPool");
  pool.innerHTML = "";
  for (const k of SHOW) {
    const list = booksByRarity(k), line = el("div", "");
    const name = el("b", "", RARITY[k].name + ": ");
    name.style.color = RARITY[k].color;
    const each = list.length ? " (each " + Math.round((BOOK_RATES[k] / list.length) * 10) / 10 + "%)" : "";
    line.append(name, document.createTextNode(list.length ? list.map((b) => b.name).join(", ") + each : "no books yet"));
    pool.append(line);
  }

  const left = BOOK_PITY - (save.bookPity | 0);
  $("bPity").textContent =
    "Pity: a Legendary book is guaranteed in " + left + " pull" + (left === 1 ? "" : "s") +
    ". A 10-pull has at least one Rare or better. The first copy unlocks the skill. Extra copies count up to " + MAX_COPIES +
    ", then refund shards. Equip books on the Loadout screen. Tap PREVIEW EFFECT on any book to watch its effect.";
  $("bPull1").textContent = "PULL ×1 (" + BOOK_COST.one + ")";
  $("bPull10").textContent = "PULL ×10 (" + BOOK_COST.ten + ")";
  $("bPull1").disabled = save.shards < BOOK_COST.one;
  $("bPull10").disabled = save.shards < BOOK_COST.ten;

  const res = $("bResults");
  res.innerHTML = "";
  for (const r of lastBk) {
    const tag = r.isNew ? "NEW! Skill unlocked" : r.refund ? "Max copies: +" + r.refund + " shards" : "Extra copy (" + r.lv + "/" + MAX_COPIES + ")";
    res.append(bookCard(r.item, r.lv, tag));
  }

  // the whole collection: books you don't own yet are dimmed
  const own = $("bOwned");
  own.innerHTML = "";
  const all = [...BOOKS].sort((x, y) => RANK[x.rarity] - RANK[y.rarity] || x.name.localeCompare(y.name));
  for (const b of all) {
    const n = copiesOf(save, b.id), c = bookCard(b, n, n ? "" : "Not found yet");
    if (!n) c.style.opacity = "0.5";
    own.append(c);
  }
}

export function renderForge() {
  const have = BOOKS.filter((b) => copiesOf(save, b.id) > 0).length;
  $("fShards").textContent = save.shards;
  $("fCount").textContent =
    "Items " + Object.keys(save.inv).length + "/" + ITEMS.length +
    " · Books " + have + "/" + BOOKS.length +
    " · Pulls " + ((save.pulls | 0) + (save.bookPulls | 0));
  $("fTabEq").textContent = "EQUIPMENT";
  $("fTabBk").textContent = "SKILL BOOKS";
  renderEquipment();
  renderBooks();
  showTab();
}

function pullEquipment(n) {
  const r = pull(save, n);
  if (!r.ok) {
    $("fMsg").textContent = r.reason;
    return;
  }
  $("fMsg").textContent = "";
  lastEq = r.results;
  writeSave();
  renderForge();
}

function pullSkillBooks(n) {
  const r = pullBooks(save, n);
  if (!r.ok) {
    $("bMsg").textContent = r.reason;
    return;
  }
  $("bMsg").textContent = "";
  lastBk = r.results;
  writeSave();
  renderForge();
}

export function initForge() {
  $("fTabEq").addEventListener("click", () => { tab = "eq"; showTab(); });
  $("fTabBk").addEventListener("click", () => { tab = "bk"; showTab(); });
  $("pull1").addEventListener("click", () => pullEquipment(1));
  $("pull10").addEventListener("click", () => pullEquipment(10));
  $("bPull1").addEventListener("click", () => pullSkillBooks(1));
  $("bPull10").addEventListener("click", () => pullSkillBooks(10));
}
