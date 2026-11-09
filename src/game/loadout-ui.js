// Lanternfall: the Loadout screen. It only draws the screen and handles taps; the rules are in loadout.js.
// Pick a class on the tabs, then tap a skill to equip it (up to 4 slots) or tap it again / tap its slot to remove it.
// Starter skills are always available. Skill books show as locked until you pull them in the Lantern Forge.
// The choice is saved per class (save.loadout) and run.js reads it when a run starts.
//
// Every skill card sits in a small wrapper (.lskw) with a PREVIEW button under the card, also for locked books.
// The button is NOT inside the card button (a button inside a button is invalid, and a disabled card would swallow the tap).
// preview.js is loaded only when PREVIEW is tapped, so a problem in it can never stop this screen from loading.
//
// Elements it expects in game.html: lTabs, lSlots, lPool, lMsg, lBack.
// menu.js calls initLoadout(goBack) once and renderLoadout(classKey?) every time the screen opens.
import { $ } from "./state.js";
import { loadSave, writeSave } from "./save.js";
import { CLASSES } from "./skills.js";
import { RARITY } from "./gacha.js";
import { BOOKS } from "./skillpool.js";
import { copiesOf } from "./skillbook.js";
import { MAX_SLOTS, getLoadoutIds, toggleSkill } from "./loadout.js";

const save = loadSave();
let cls = Object.keys(CLASSES)[0]; // the class shown on the tabs
let msg = ""; // why the last tap was refused

function el(tag, cls2, text) {
  const e = document.createElement(tag);
  if (cls2) e.className = cls2;
  if (text != null) e.textContent = text;
  return e;
}

// Every skill the class could use: starters first, then all its books (locked ones too, so you can see what to look for).
function entries() {
  return [
    ...CLASSES[cls].skills.map((s) => ({ s, book: false })),
    ...BOOKS.filter((b) => b.cls === cls).map((s) => ({ s, book: true })),
  ];
}

function toggle(id) {
  const r = toggleSkill(save, cls, id);
  if (r.ok) {
    writeSave();
    msg = "";
  } else {
    msg = "Can't change that: " + r.reason + (/full/.test(r.reason) ? ". Remove a skill first." : ".");
  }
  renderLoadout();
}

// Opens the effect preview of one skill. A failure only shows a message on this screen; nothing else is touched.
async function openPreview(id) {
  const m = $("lMsg");
  try {
    const mod = await import("./preview.js");
    if (!(await mod.openSkillPreview(id))) m.textContent = "There is no preview for this skill.";
  } catch (e) {
    console.error(e);
    m.textContent = "The preview could not open: " + ((e && e.message) || e);
  }
}

export function renderLoadout(classKey) {
  if (classKey && CLASSES[classKey]) cls = classKey;

  const tabs = $("lTabs");
  tabs.innerHTML = "";
  for (const [key, c] of Object.entries(CLASSES)) {
    const b = el("button", "tab" + (key === cls ? " on" : ""), c.name);
    b.addEventListener("click", () => {
      cls = key;
      msg = "";
      renderLoadout();
    });
    tabs.append(b);
  }

  const all = entries();
  const byId = new Map(all.map((e) => [e.s.id, e]));
  const ids = getLoadoutIds(save, cls);

  const slots = $("lSlots");
  slots.innerHTML = "";
  for (let i = 0; i < MAX_SLOTS; i++) {
    const e = byId.get(ids[i]);
    const b = el("button", "slot" + (e ? " full" : ""));
    b.append(el("span", "n", "Slot " + (i + 1) + " · key " + (i + 1)), document.createTextNode(e ? e.s.name : "empty"));
    if (e) b.addEventListener("click", () => toggle(e.s.id));
    slots.append(b);
  }

  const pool = $("lPool");
  pool.innerHTML = "";
  for (const e of all) {
    const s = e.s, copies = e.book ? copiesOf(save, s.id) : 0;
    const owned = !e.book || copies > 0, on = ids.includes(s.id), r = e.book ? RARITY[s.rarity] : null;
    const b = el("button", "item lsk" + (on ? " on" : "") + (owned ? "" : " lock"));
    b.disabled = !owned;
    if (r) b.style.borderColor = r.color;
    const n = el("b", "", s.name);
    if (r) n.style.color = r.color;
    b.append(
      n,
      el("small", "", e.book ? r.name + " skill book" + (owned ? " · " + copies + " cop" + (copies === 1 ? "y" : "ies") : "") : "Starter skill"),
      el("small", "", "Cooldown " + s.cd + " s" + (typeof s.dmg === "number" ? " · damage " + s.dmg : "")),
      el("small", "tag", !owned ? "Locked: find it in the Forge" : on ? "EQUIPPED (tap to remove)" : "Tap to equip")
    );
    if (owned) b.addEventListener("click", () => toggle(s.id));

    const pv = el("button", "pvb", "PREVIEW");
    pv.addEventListener("click", () => openPreview(s.id));
    const wrap = el("div", "lskw");
    wrap.append(b, pv);
    pool.append(wrap);
  }

  $("lMsg").textContent = msg || "Tap a skill to equip it, or tap a slot to remove it. Up to " + MAX_SLOTS + " skills per class. PREVIEW shows the effect.";
}

export function initLoadout(onBack) {
  $("lBack").addEventListener("click", onBack);
}
