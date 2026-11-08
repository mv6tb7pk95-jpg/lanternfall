// Lanternfall: skill books. DATA ONLY: no DOM, no pixelfx calls, no imports.
// A skill book unlocks one extra skill for one class. Starter skills stay in CLASSES (skills.js) and are always unlocked.
//
// A book has the same shape as a skill in skills.js, so the game can play it like a starter skill:
//   id, path, name, cd, dmg, zone, free?   (see skills.js for what they mean)
// plus two fields used by the Forge:
//   cls     class id that can equip it
//   rarity  a key of RARITY in gacha.js: "common" | "rare" | "epic" | "legend"
//
// Two kinds of book:
//   act book   a pixelfx effect that exports `act` (poses, target, hits), played by createAct through startSkill().
//              dmg is dealt on EACH real hit of the move. zone is [from, to] px ahead of the hero (negative = behind him);
//              the game adds each enemy's half-width on top.
//   zone book  kind: "zone". A single effect with no `act`, played by zoneskill.js: it appears `at` px ahead of the hero
//              and deals damage at the times listed in `hits` to everything within `half` px of that spot
//              (`off` moves the centre of that area; `heal` makes it restore the hero instead). zone here is only for display.
// All numbers are first guesses and need play-testing.
//
// Books so far: Warden x4, Emberist x4, Skulker x3, Arbalist x1, Lightkeeper x2.
// Numbers marked "read" below were taken from the effect's source file (pinned pixelfx commit a841596).
// Numbers marked "guess" were NOT read from a timeline: watch the effect and adjust `hits` / `half` if damage looks out of sync.
export const BOOKS = [
  // Warden. Hit at 0.17 s, a ring about 46 px around him: a wide, close, quick hit.
  { id: "spin-slash", cls: "warden", rarity: "common", path: "melee/spin-slash", name: "Spin slash", cd: 4, dmg: 22, zone: [-55, 55] },
  // Warden. One hit at 0.335 s, the slam lands about 66 px ahead: slow, heavy, single blow.
  { id: "heavy-cleave", cls: "warden", rarity: "rare", path: "melee/heavy-cleave", name: "Heavy cleave", cd: 6, dmg: 45, zone: [25, 110] },
  // Warden. act book (read): one real hit at 0.15 s (push 3, a hard shove), the hammer lands 66 px ahead (act target x 66)
  // and the dome of force spreads to about 42 px around that spot, so the zone is 24 to 108.
  { id: "hammer-smash", cls: "warden", rarity: "rare", path: "melee/hammer-smash", name: "Hammer smash", cd: 8, dmg: 52, zone: [24, 108] },
  // Warden, LEGENDARY, a zone book. Three jolts at 0.06 / 0.5 / 0.92 s (read); the rift opens to about 55% of its reach
  // at the second jolt and to full reach by the third, so the ticks are at 0.5 s (x1) and 0.92 s (x1.5): 28 x 2.5 = 70.
  // The effect's own reach (118) is too wide, so fxOpts makes it 70; the hit area is 80 px ahead +-60 (guess).
  { id: "quake", cls: "warden", rarity: "legend", kind: "zone", path: "nature/quake", name: "Quake", cd: 12, dmg: 28, zone: [20, 140], at: 80, half: 60, hits: [[0.5, 1], [0.92, 1.5]], push: 0.8, pose: "sword", castTime: 0.46, fxOpts: { reach: 70 } },
  // Emberist. Three hits at 0.05 / 0.14 / 0.23 s on targets 58, 104 and 150 px ahead. Every enemy in the zone is hit
  // by each of the three (the game does not follow the chain from one enemy to the next), so 15 x 3 = 45 in total.
  { id: "chain-lightning", cls: "emberist", rarity: "epic", path: "lightning/chain-lightning", name: "Chain lightning", cd: 6, dmg: 15, zone: [30, 175] },
  // Emberist. The hero slams the floor at 0.32 s and a ring of flame spreads out to 92 px on BOTH sides. Its one real
  // hit is at 0.6 s, when the front has reached about 69 px (70 px at 0.604 s). The ring reaches 92 px later, but the
  // hit has already happened, so the zone is +-80 (the game adds each enemy's half-width): it matches what you see.
  { id: "fire-ring", cls: "emberist", rarity: "rare", path: "fire/fire-ring", name: "Fire ring", cd: 7, dmg: 35, zone: [-80, 80] },
  // Emberist, LEGENDARY, a zone book. The floor cracks from 0 s, the column erupts at 0.55 s (full height by 0.67 s),
  // and it collapses from 1.95 s (gone at 2.45 s; the smoke lasts to 5 s). The column is about 12-17 px wide and the
  // floor cracks reach about 20-40 px, so it hurts everything within 24 px of the spot 80 px ahead of the hero.
  // Damage ticks: 0.6 s x2 (the eruption itself), then 1.0, 1.4 and 1.8 s x1 each: 20 x (2+1+1+1) = 100 on an enemy that
  // stays inside. Enemies walk toward the hero, so most will take fewer ticks. Knockback is small (push 0.3).
  { id: "flame-pillar", cls: "emberist", rarity: "legend", kind: "zone", path: "fire/flame-pillar", name: "Flame pillar", cd: 11, dmg: 20, zone: [56, 104], at: 80, half: 24, hits: [[0.6, 1 + 1], [1.0, 1], [1.4, 1], [1.8, 1]], push: 0.3, castTime: 0.4 },
  // Emberist. act book (read): the clap is at 0.12 s (a bookkeeping hit, no damage); the one real hit is at 0.42 s (push 2),
  // when the shock ring's front is at 8 + 96 x outCubic(0.6) = about 98 px on BOTH sides (reach 104). Zone +-100.
  { id: "thunderclap", cls: "emberist", rarity: "epic", path: "lightning/thunderclap", name: "Thunderclap", cd: 9, dmg: 34, zone: [-100, 100] },
  // Skulker. Seven real hits: six small stabs at 0.05 / 0.105 / 0.16 / 0.215 / 0.27 / 0.325 s, then a big finishing cut
  // at 0.42 s (the act's own `target` is 60 px ahead; the cuts are drawn 19-37 px out, the finisher spans about -6 to 54).
  // The game uses one dmg for every hit, so the finisher is not stronger than the stabs: 6 x 7 = 42 in total.
  // Short range, so he has to stand close. The six stabs are fast, so it finishes at 0.42 s.
  { id: "dagger-flurry", cls: "skulker", rarity: "rare", path: "melee/dagger-flurry", name: "Dagger flurry", cd: 5, dmg: 6, zone: [5, 85] },
  // Skulker. act book (read): two real hits at 0.06 s and 0.16 s (the second pushes harder), the act's target is 62 px ahead.
  // 13 x 2 = 26 in total, a cheap fast one: cooldown 3.5 s.
  { id: "cross-slash", cls: "skulker", rarity: "common", path: "melee/double-slash", name: "Cross slash", cd: 3.5, dmg: 13, zone: [15, 90] },
  // Skulker, a zone book. The pool is about 40 px wide (RX = 40, read). Tentacles start lashing up from 0.3 s (staggered by
  // 0.045 s each) and start sinking back at about 1.5 s (read), so three ticks while they are up: 0.6 / 0.95 / 1.3 s (guess).
  // 14 x 3 = 42 on an enemy that stays in the pool; the knockback is small so enemies stay in it.
  { id: "shadow-tendrils", cls: "skulker", rarity: "epic", kind: "zone", path: "shadow/shadow-tendrils", name: "Shadow tendrils", cd: 9, dmg: 14, zone: [30, 110], at: 70, half: 40, hits: [[0.6, 1], [0.95, 1], [1.3, 1]], push: 0.2, pose: "claw", castTime: 0.36 },
  // Arbalist, a zone book. The grenade is lobbed in from the left of the effect's origin and blows at 1.62 s (read), so the
  // effect is placed 150 px ahead and the one tick is at 1.62 s. Where exactly it lands and how wide the blast is were NOT
  // read: the area +-45 px is a guess. A long fuse: it rewards throwing it where enemies are walking to.
  { id: "grenade", cls: "arbalist", rarity: "rare", kind: "zone", path: "explosions/grenade", name: "Grenade", cd: 8, dmg: 52, zone: [105, 195], at: 150, half: 45, hits: [[1.62, 1]], push: 1.5, pose: "aim", castTime: 0.3 },
  // Lightkeeper, a zone book. The frost line runs out from the hero from 0.04 s for 0.44 s, the spikes burst up behind it,
  // and they flash at 1.36 s and shatter at 1.42 s; reach 172 px (all read). The effect starts AT the hero, `off` puts the hit
  // area 95 px ahead of him (+-85 = 10 to 180). Ticks: 0.5 s and 0.9 s while the spikes stand, and 1.4 s for the shatter (x1.6).
  // 15 x 3.6 = 54. The tick times are a guess.
  { id: "ice-spikes", cls: "lightkeeper", rarity: "rare", kind: "zone", path: "ice/ice-spikes", name: "Ice spikes", cd: 8, dmg: 15, zone: [10, 180], at: 0, off: 95, half: 85, hits: [[0.5, 1], [0.9, 1], [1.4, 1.6]], push: 0.2, pose: "cast", castTime: 0.4 },
  // Lightkeeper, a zone book that HEALS (holy/heal-aoe, 2.9 s, 256 px wide). It restores 30% of max HP at 0.7 s, once.
  // The moment the ring passes the hero (0.7 s) is a guess: the effect's timeline was not read. Self only for now (co-op: batch 3).
  { id: "healing-ring", cls: "lightkeeper", rarity: "epic", kind: "zone", path: "holy/heal-aoe", name: "Healing ring", cd: 16, dmg: 0, zone: [-100, 100], at: 0, half: 100, heal: 0.3, hits: [[0.7, 1]], pose: "cast", castTime: 0.4 },
];

const BY_ID = Object.fromEntries(BOOKS.map((b) => [b.id, b]));

/** One book by skill id, or null. */
export const bookById = (id) => BY_ID[id] || null;

/** All books for one class. */
export const booksOf = (classId) => BOOKS.filter((b) => b.cls === classId);

/** All books of one rarity ("common" | "rare" | "epic" | "legend"). The Forge rolls from these. */
export const booksByRarity = (rarity) => BOOKS.filter((b) => b.rarity === rarity);
