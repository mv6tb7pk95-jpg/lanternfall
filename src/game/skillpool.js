// Lanternfall: skill books. DATA ONLY: no DOM, no pixelfx calls, no imports.
// A skill book unlocks one extra skill for one class. Starter skills stay in CLASSES (skills.js) and are always unlocked.
//
// A book has the same shape as a skill in skills.js, so startSkill() can play it unchanged:
//   id, path, name, cd, dmg, zone, free?   (see skills.js for what they mean)
// plus two fields used by the Forge:
//   cls     class id that can equip it
//   rarity  a key of RARITY in gacha.js: "common" | "rare" | "epic" | "legend"
//
// Each book below is a pixelfx effect that exports `act` (poses, target, hits), so createAct can perform it.
// dmg is dealt on EACH real hit of the move. zone is [from, to] px ahead of the hero (negative = behind him);
// the game adds each enemy's half-width on top. All numbers are first guesses and need play-testing.
//
// Books so far: Warden x2, Emberist x2, Skulker x1. More are added one class at a time, after reading each effect file.
// Not a book (yet): fire/flame-pillar. It exports no `act`, so createAct cannot play it. It needs a runner for a
// single effect (like the basic attacks), with its own hit logic.
export const BOOKS = [
  // Warden. Hit at 0.17 s, a ring about 46 px around him: a wide, close, quick hit.
  { id: "spin-slash", cls: "warden", rarity: "common", path: "melee/spin-slash", name: "Spin slash", cd: 4, dmg: 22, zone: [-55, 55] },
  // Warden. One hit at 0.335 s, the slam lands about 66 px ahead: slow, heavy, single blow.
  { id: "heavy-cleave", cls: "warden", rarity: "rare", path: "melee/heavy-cleave", name: "Heavy cleave", cd: 6, dmg: 45, zone: [25, 110] },
  // Emberist. Three hits at 0.05 / 0.14 / 0.23 s on targets 58, 104 and 150 px ahead. Every enemy in the zone is hit
  // by each of the three (the game does not follow the chain from one enemy to the next), so 15 x 3 = 45 in total.
  { id: "chain-lightning", cls: "emberist", rarity: "epic", path: "lightning/chain-lightning", name: "Chain lightning", cd: 6, dmg: 15, zone: [30, 175] },
  // Emberist. The hero slams the floor at 0.32 s and a ring of flame spreads out to 92 px on BOTH sides. Its one real
  // hit is at 0.6 s, when the front has reached about 69 px (70 px at 0.604 s). The ring reaches 92 px later, but the
  // hit has already happened, so the zone is +-80 (the game adds each enemy's half-width): it matches what you see.
  { id: "fire-ring", cls: "emberist", rarity: "rare", path: "fire/fire-ring", name: "Fire ring", cd: 7, dmg: 35, zone: [-80, 80] },
  // Skulker. Seven real hits: six small stabs at 0.05 / 0.105 / 0.16 / 0.215 / 0.27 / 0.325 s, then a big finishing cut
  // at 0.42 s (the act's own `target` is 60 px ahead; the cuts are drawn 19-37 px out, the finisher spans about -6 to 54).
  // The game uses one dmg for every hit, so the finisher is not stronger than the stabs: 6 x 7 = 42 in total.
  // Short range, so he has to stand close. The six stabs are fast, so it finishes at 0.42 s.
  { id: "dagger-flurry", cls: "skulker", rarity: "rare", path: "melee/dagger-flurry", name: "Dagger flurry", cd: 5, dmg: 6, zone: [5, 85] },
];

const BY_ID = Object.fromEntries(BOOKS.map((b) => [b.id, b]));

/** One book by skill id, or null. */
export const bookById = (id) => BY_ID[id] || null;

/** All books for one class. */
export const booksOf = (classId) => BOOKS.filter((b) => b.cls === classId);

/** All books of one rarity ("common" | "rare" | "epic" | "legend"). The Forge rolls from these. */
export const booksByRarity = (rarity) => BOOKS.filter((b) => b.rarity === rarity);
