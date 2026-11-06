// Lanternfall: skill loadout. Which skills of a class are equipped, and in which slot.
// Pure helpers: no DOM and no pixelfx calls. The pool of a class is its starter skills (CLASSES[classId].skills in
// skills.js, always unlocked) PLUS the skill books the player has unlocked (skillbook.js / skillpool.js).
// The loadout is a list of skill ids saved as save.loadout[classId]. The caller saves with writeSave(save).
// Every helper takes the save object first, because the pool depends on which books the player owns.
import { CLASSES } from "./skills.js";
import { unlockedBooksOf } from "./skillbook.js";
import { bookById } from "./skillpool.js";

export const MAX_SLOTS = 4;

const starters = (classId) => (CLASSES[classId] ? CLASSES[classId].skills : []);

/** Every skill the player can equip for a class: starters first, then unlocked books (skill objects). */
export function poolOf(save, classId) {
  if (!CLASSES[classId]) return [];
  return [...starters(classId), ...unlockedBooksOf(save || {}, classId)];
}

/** The default loadout: the first starter skills, up to MAX_SLOTS. */
export function defaultIds(classId) {
  return starters(classId).slice(0, MAX_SLOTS).map((s) => s.id);
}

/** Drop unknown, locked and duplicate ids, cap at MAX_SLOTS, and never return an empty loadout. */
function clean(save, classId, ids) {
  const known = new Set(poolOf(save, classId).map((s) => s.id));
  const out = [];
  for (const id of Array.isArray(ids) ? ids : []) {
    if (known.has(id) && !out.includes(id) && out.length < MAX_SLOTS) out.push(id);
  }
  return out.length ? out : defaultIds(classId);
}

/** Equipped ids for a class, in slot order. */
export function getLoadoutIds(save, classId) {
  return clean(save, classId, save && save.loadout ? save.loadout[classId] : null);
}

/** Equipped skill objects for a class, in slot order. This is what combat should use. */
export function getLoadout(save, classId) {
  const byId = new Map(poolOf(save, classId).map((s) => [s.id, s]));
  return getLoadoutIds(save, classId).map((id) => byId.get(id));
}

/** Replace the loadout. Returns the cleaned ids that were stored. */
export function setLoadout(save, classId, ids) {
  const next = clean(save, classId, ids);
  if (!save.loadout) save.loadout = {};
  save.loadout[classId] = next;
  return next;
}

/**
 * Equip or unequip one skill (for the tap-to-toggle UI).
 * Refused when: the skill is unknown or still locked, it is the last equipped skill, or every slot is full.
 * Returns { ok, ids, reason } so the UI can explain a refusal.
 */
export function toggleSkill(save, classId, id) {
  const ids = getLoadoutIds(save, classId);
  if (!poolOf(save, classId).some((s) => s.id === id)) {
    const book = bookById(id);
    return { ok: false, ids, reason: book && book.cls === classId ? "locked: find this book in the Forge" : "unknown skill" };
  }
  if (ids.includes(id)) {
    if (ids.length <= 1) return { ok: false, ids, reason: "keep at least one skill" };
    return { ok: true, ids: setLoadout(save, classId, ids.filter((x) => x !== id)) };
  }
  if (ids.length >= MAX_SLOTS) return { ok: false, ids, reason: "all " + MAX_SLOTS + " slots are full" };
  return { ok: true, ids: setLoadout(save, classId, [...ids, id]) };
}
