// Lanternfall: skill loadout. Which skills of a class are equipped, and in which slot.
// Pure helpers: no DOM and no pixelfx calls. The pool of a class is CLASSES[classId].skills (see skills.js);
// the loadout is a list of skill ids saved as save.loadout[classId]. The caller saves with writeSave(save).
import { CLASSES } from "./skills.js";

export const MAX_SLOTS = 4;

const pool = (classId) => (CLASSES[classId] ? CLASSES[classId].skills : []);

/** The default loadout: the first skills of the pool, up to MAX_SLOTS. */
export function defaultIds(classId) {
  return pool(classId).slice(0, MAX_SLOTS).map((s) => s.id);
}

/** Drop unknown and duplicate ids, cap at MAX_SLOTS, and never return an empty loadout. */
function clean(classId, ids) {
  const known = new Set(pool(classId).map((s) => s.id));
  const out = [];
  for (const id of Array.isArray(ids) ? ids : []) {
    if (known.has(id) && !out.includes(id) && out.length < MAX_SLOTS) out.push(id);
  }
  return out.length ? out : defaultIds(classId);
}

/** Equipped ids for a class, in slot order. */
export function getLoadoutIds(save, classId) {
  return clean(classId, save && save.loadout ? save.loadout[classId] : null);
}

/** Equipped skill objects for a class, in slot order. This is what combat should use. */
export function getLoadout(save, classId) {
  const byId = new Map(pool(classId).map((s) => [s.id, s]));
  return getLoadoutIds(save, classId).map((id) => byId.get(id));
}

/** Replace the loadout. Returns the cleaned ids that were stored. */
export function setLoadout(save, classId, ids) {
  const next = clean(classId, ids);
  if (!save.loadout) save.loadout = {};
  save.loadout[classId] = next;
  return next;
}

/**
 * Equip or unequip one skill (for the tap-to-toggle UI).
 * Unequip is refused when it is the last one. Equip is refused when every slot is full.
 * Returns { ok, ids, reason } so the UI can explain a refusal.
 */
export function toggleSkill(save, classId, id) {
  const ids = getLoadoutIds(save, classId);
  if (!pool(classId).some((s) => s.id === id)) return { ok: false, ids, reason: "unknown skill" };
  if (ids.includes(id)) {
    if (ids.length <= 1) return { ok: false, ids, reason: "keep at least one skill" };
    return { ok: true, ids: setLoadout(save, classId, ids.filter((x) => x !== id)) };
  }
  if (ids.length >= MAX_SLOTS) return { ok: false, ids, reason: "all " + MAX_SLOTS + " slots are full" };
  return { ok: true, ids: setLoadout(save, classId, [...ids, id]) };
}
