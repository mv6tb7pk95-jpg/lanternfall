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
// Books so far: Warden x2, Emberist x1. More are added one class at a time, after reading each effect file.
export const BOOKS = [
  // Warden. Hit at 0.17 s, a ring about 46 px around him: a wide, close, quick hit.
  { id: "spin-slash", cls: "warden", rarity: "common", path: "melee/spin-slash", name: "Spin slash", cd: 4, dmg: 22, zone: [-55, 55] },
  // Warden. One hit at 0.335 s, the slam lands about 66 px ahead: slow, heavy, single blow.
  { id: "heavy-cleave", cls: "warden", rarity: "rare", path: "melee/heavy-cleave", name: "Heavy cleave", cd: 6, dmg: 45, zone: [25, 110] },
  // Emberist. Three hits at 0.05 / 0.14 / 0.23 s on targets 58, 104 and 150 px ahead. Every enemy in the zone is hit
  // by each of the three (the game does not follow the chain from one enemy to the next), so 15 x 3 = 45 in total.
  { id: "chain-lightning", cls: "emberist", rarity: "epic", path: "lightning/chain-lightning", name: "Chain lightning", cd: 6, dmg: 15, zone: [30, 175] },
];

const BY_ID = Object.fromEntries(BOOKS.map((b) => [b.id, b]));

/** One book by skill id, or null. */
export const bookById = (id) => BY_ID[id] || null;

/** All books for one class. */
export const booksOf = (classId) => BOOKS.filter((b) => b.cls === classId);

/** All books of one rarity ("common" | "rare" | "epic" | "legend"). The Forge rolls from these. */
export const booksByRarity = (rarity) => BOOKS.filter((b) => b.rarity === rarity);
