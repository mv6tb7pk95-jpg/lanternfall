// Lanternfall: the Lantern Forge screen. It only draws the screen and handles its buttons.
// The rules (odds, pity, duplicates) live in gacha.js and the saved data in save.js.
// main.js calls initForge() once and renderForge() every time the screen opens.
import { loadSave, writeSave } from "./save.js";
import { ITEMS, RARITY, COST, PITY, MAX_LV, describe, itemById, equip, unequip, pull } from "./gacha.js";

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

export function renderForge() {
  $("fShards").textContent = save.shards;
  $("fCount").textContent = "Items " + Object.keys(save.inv).length + "/" + ITEMS.length + " · Pulls " + save.pulls;
  $("fOdds").textContent = Object.values(RARITY).map((r) => r.name + " " + r.rate + "%").join(" · ");
  const left = PITY - save.pity;
  $("fPity").textContent =
    "Pity: a Legendary is guaranteed in " + left + " pull" + (left === 1 ? "" : "s") +
    ". Each duplicate raises an item's level (max " + MAX_LV + "), then refunds shards.";
  $("pull1").textContent = "PULL ×1 (" + COST.one + ")";
  $("pull10").textContent = "PULL ×10 (" + COST.ten + ")";
  $("pull1").disabled = save.shards < COST.one;
  $("pull10").disabled = save.shards < COST.ten;

  const res = $("fResults");
  res.innerHTML = "";
  for (const r of last) res.append(card(r.item, r.lv, r.isNew ? "NEW!" : r.refund ? "Max level: +" + r.refund + " shards" : "Level " + r.lv));

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

function doPull(n) {
  const r = pull(save, n);
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
  $("pull1").addEventListener("click", () => doPull(1));
  $("pull10").addEventListener("click", () => doPull(10));
}
