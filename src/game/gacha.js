// Lanternfall: the Lantern Forge. Items are DATA (the ITEMS table); the rules are a few small functions that take
// the save object. Currency is in-game "shards" earned by playing. There is no real money in this game.
//
// Odds (shown to the player in the forge screen): Common 55% · Rare 30% · Epic 12% · Legendary 3%.
// Pity: the 40th pull since your last Legendary is always a Legendary. A 10-pull always has at least one Rare or better.
// Duplicates raise an item's level (each level adds 15% of its base stats, max level 6). Beyond max you get shards back.
// statsOf() also adds the permanent upgrades bought in the Shop (shop.js).
import { upgradeBonus } from "./shop.js";

export const RARITY = {
  common: { name: "Common", rate: 55, color: "#b8b2c8", refund: 10 },
  rare: { name: "Rare", rate: 30, color: "#5aa8ff", refund: 25 },
  epic: { name: "Epic", rate: 12, color: "#c06cff", refund: 60 },
  legend: { name: "Legendary", rate: 3, color: "#ffc23d", refund: 150 },
};
const ORDER = ["legend", "epic", "rare", "common"]; // checked in this order when rolling

export const COST = { one: 100, ten: 900 };
export const PITY = 40;
export const MAX_LV = 6;
export const LV_BONUS = 0.15;

export const STAT_LABEL = { atk: "Damage", hp: "Max HP", cdr: "Cooldown", crit: "Crit chance", spd: "Move speed", shard: "Shard gain" };

const W = (id, rarity, name, atk, note) => ({ id, slot: "weapon", rarity, name, stats: { atk }, note });
const A = (id, rarity, name, stats, note) => ({ id, slot: "acc", rarity, name, stats, note });

export const ITEMS = [
  // weapons: raise all damage (basic attack and skills)
  W("w-wick-knife", "common", "Wick Knife", 4, "A short blade for trimming lamp wicks."),
  W("w-tin-staff", "common", "Tin Lantern Staff", 4, "Dented, but it still holds a flame."),
  W("w-cudgel", "common", "Charred Cudgel", 5, "Pulled from the gatehouse fire."),
  W("w-sunblade", "rare", "Brass Sunblade", 10, "It stays warm to the touch."),
  W("w-ember-scepter", "rare", "Ember Scepter", 11, "A coal that never goes out."),
  W("w-frost-spear", "rare", "Frostglass Spear", 10, "Cloister ice, cut sharp."),
  W("w-pike", "epic", "Lamplighter's Pike", 18, "Made to reach the highest lamps."),
  W("w-storm-rod", "epic", "Stormwick Rod", 19, "The wick crackles before a strike."),
  W("w-dawn", "legend", "Dawnbreaker", 32, "The first light of the first morning."),
  W("w-heart", "legend", "Heart of the Great Lamp", 35, "A shard of the lamp that fell."),
  // accessories: one or two support stats
  A("a-cloth-charm", "common", "Cloth Wick Charm", { hp: 6 }, "Braided from spare wick."),
  A("a-copper-ring", "common", "Copper Ring", { crit: 3 }, "Thin, bright, lucky."),
  A("a-soot-scarf", "common", "Soot Scarf", { spd: 4 }, "Light enough to run in."),
  A("a-moth-pin", "rare", "Silver Moth Pin", { cdr: 6 }, "Moths know where the light is."),
  A("a-amber", "rare", "Amber Pendant", { hp: 14 }, "Something ancient sleeps inside."),
  A("a-hourglass", "rare", "Hourglass Chip", { crit: 7 }, "A sliver of a slower hour."),
  A("a-glass-earring", "epic", "Lantern-Glass Earring", { cdr: 10 }, "It hums when you cast."),
  A("a-ward-mantle", "epic", "Ward Mantle", { hp: 26 }, "Heavy, and worth it."),
  A("a-fox-bell", "epic", "Fox Bell", { spd: 12, shard: 10 }, "Chimes when treasure is near."),
  A("a-first-light", "legend", "Crown of First Light", { cdr: 15, crit: 10 }, "Worn by the first lamplighter."),
  A("a-wick-crown", "legend", "Everwick Mantle", { hp: 40, atk: 8 }, "It has never burned down."),
];

const BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
const POOL = Object.fromEntries(ORDER.map((r) => [r, ITEMS.filter((i) => i.rarity === r)]));
export const itemById = (id) => BY_ID[id] || null;

export const levelMul = (lv) => 1 + LV_BONUS * (Math.max(1, lv) - 1);

/** Text like "Damage +10%, Crit chance +7%" for an item at a level. */
export function describe(item, lv = 1) {
  return Object.entries(item.stats)
    .map(([k, v]) => STAT_LABEL[k] + " " + (k === "cdr" ? "-" : "+") + Math.round(v * levelMul(lv) * 10) / 10 + "%")
    .join(", ");
}

/** The combined bonuses of what is equipped plus the Shop upgrades, as fractions (0.1 = 10%). */
export function statsOf(save) {
  const t = { atk: 0, hp: 0, cdr: 0, crit: 0, spd: 0, shard: 0 };
  for (const slot of ["weapon", "acc"]) {
    const id = save.eq[slot], it = BY_ID[id], lv = save.inv[id];
    if (!it || !lv || it.slot !== slot) continue;
    for (const [k, v] of Object.entries(it.stats)) t[k] += (v * levelMul(lv)) / 100;
  }
  for (const [k, v] of Object.entries(upgradeBonus(save))) if (k in t) t[k] += v; // the Shop's permanent upgrades
  t.cdr = Math.min(0.4, t.cdr);
  t.crit = Math.min(0.6, t.crit);
  return t;
}

export function equip(save, id) {
  const it = BY_ID[id];
  if (!it || !save.inv[id]) return false;
  save.eq[it.slot] = id;
  return true;
}

export function unequip(save, slot) {
  if (slot in save.eq) save.eq[slot] = null;
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
 * Each result: { item, isNew, lv, refund }.
 */
export function pull(save, n) {
  const cost = n === 10 ? COST.ten : COST.one;
  if (save.shards < cost) return { ok: false, reason: "Not enough shards (" + cost + " needed)." };
  save.shards -= cost;
  const results = [];
  for (let i = 0; i < n; i++) {
    let rk = pickRarity(save);
    if (n === 10 && i === 9 && rk === "common" && !results.some((r) => r.item.rarity !== "common")) rk = "rare";
    save.pity = rk === "legend" ? 0 : save.pity + 1;
    save.pulls++;
    const list = POOL[rk], item = list[Math.floor(Math.random() * list.length)], had = save.inv[item.id] || 0;
    let refund = 0;
    if (had >= MAX_LV) {
      refund = RARITY[rk].refund;
      save.shards += refund;
    } else save.inv[item.id] = had + 1;
    results.push({ item, isNew: had === 0, lv: save.inv[item.id], refund });
  }
  return { ok: true, results };
}
