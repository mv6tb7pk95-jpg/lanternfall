// Lanternfall: class passives. One per class, always on, no slot needed. DATA plus one small rule that combat.js calls.
// Fields (a class uses only the ones it needs):
//   dr        fraction of the damage you take that is ignored (combat.js hurtPlayer)
//   every     every Nth hit you land is "kindled": base damage x mul. It counts every hit, so a 3-hit skill moves it 3 steps.
//   crit      extra crit chance (a fraction, added to the 5% base and to gear)
//   critMul   what a crit multiplies damage by (the game's default is 1.5)
//   far       an enemy this many px or more from the hero takes base damage x farMul
//   heal      HP restored for a hit you land, at most once every `gap` seconds
// All numbers are first guesses and need play-testing.
// In co-op, each player's own browser applies his own passive to the hits he lands, so nothing here is sent over the network.
export const PASSIVES = {
  warden: { name: "Stonehide", text: "20% less damage taken", dr: 0.2 },
  emberist: { name: "Kindling", text: "every 5th hit burns +75% harder", every: 5, mul: 1.75 },
  skulker: { name: "Cutthroat", text: "+20% crit chance, crits deal x2", crit: 0.2, critMul: 2 },
  arbalist: { name: "Deadeye", text: "+30% damage to targets 120+ px away", far: 120, farMul: 1.3 },
  lightkeeper: { name: "Mending light", text: "each hit heals 1 HP (max every 0.4 s)", heal: 1, gap: 0.4 },
};

let hits = 0, healAt = -9;

/**
 * Called once for every hit the hero lands. key: the class id, dist: px between hero and enemy, time: G.time.
 * Returns { mul, heal, kindled }: the multiplier for the base damage, the HP to restore, and whether it was a kindled hit.
 */
export function passiveHit(key, dist, time) {
  const P = PASSIVES[key], r = { mul: 1, heal: 0, kindled: false };
  if (!P) return r;
  if (P.every && ++hits % P.every === 0) {
    r.mul *= P.mul;
    r.kindled = true;
  }
  if (P.far && dist >= P.far) r.mul *= P.farMul;
  if (P.heal) {
    if (time < healAt) healAt = -9; // G.time went back to 0: a new run started
    if (time - healAt >= P.gap) {
      healAt = time;
      r.heal = P.heal;
    }
  }
  return r;
}
