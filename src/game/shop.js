// Lanternfall: the Shop. Data and rules only: no screen and no imports, so any file can use it without an import loop.
// The Shop sells five permanent upgrades. Each can be bought up to level 5, and each level costs more than the last.
// The bonuses are added to the gear bonuses in gacha.js statsOf(), so a run, the hero's HP and the shard gain all see them.
// Currency is in-game "shards" earned by playing. There is no real money in this game.
// The levels are saved in save.shop (save.js): upgrade id -> level.

export const MAX_SHOP_LV = 5;
const STEPS = [1, 2, 3, 5, 8]; // the price of level n+1 is base x STEPS[n], so a whole upgrade costs base x 19

// stat: the key used by gacha.js statsOf (atk, hp, spd, crit, shard). per: percent added by each level.
export const UPGRADES = [
  { id: "oil", name: "Lantern Oil", stat: "hp", per: 4, base: 60, label: "Max HP", note: "More oil, a longer light." },
  { id: "wick", name: "Sharp Wick", stat: "atk", per: 3, base: 80, label: "Damage", note: "A finer edge on every hit." },
  { id: "boots", name: "Light Boots", stat: "spd", per: 3, base: 50, label: "Move speed", note: "Soft soles for long corridors." },
  { id: "lens", name: "Keen Lens", stat: "crit", per: 2, base: 90, label: "Crit chance", note: "You spot the weak point sooner." },
  { id: "purse", name: "Lucky Purse", stat: "shard", per: 4, base: 70, label: "Shard gain", note: "Shards seem to find you." },
];

const BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
export const upgradeById = (id) => BY_ID[id] || null;

/** The level of an upgrade (0 = not bought). */
export const levelOf = (save, id) => Math.min(MAX_SHOP_LV, (save.shop && save.shop[id]) | 0);

/** The price of the next level, or null when the upgrade is at the top level (or unknown). */
export function costOf(save, id) {
  const u = BY_ID[id];
  if (!u) return null;
  const lv = levelOf(save, id);
  return lv >= MAX_SHOP_LV ? null : u.base * STEPS[lv];
}

/** Buy the next level. Spends shards, changes save, and returns { ok, lv } or { ok: false, reason }. */
export function buy(save, id) {
  const u = BY_ID[id], cost = costOf(save, id);
  if (!u) return { ok: false, reason: "That item is not for sale." };
  if (cost == null) return { ok: false, reason: u.name + " is already at the top level." };
  if (save.shards < cost) return { ok: false, reason: "Not enough shards (" + cost + " needed)." };
  if (!save.shop) save.shop = {};
  save.shards -= cost;
  save.shop[id] = levelOf(save, id) + 1;
  return { ok: true, lv: save.shop[id] };
}

/** What the bought upgrades add, as fractions like gacha.js statsOf uses (0.1 = 10%). Only stats with a bonus appear. */
export function upgradeBonus(save) {
  const t = {};
  for (const u of UPGRADES) {
    const lv = levelOf(save, u.id);
    if (lv) t[u.stat] = (t[u.stat] || 0) + (u.per * lv) / 100;
  }
  return t;
}
