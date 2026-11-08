// Lanternfall: screens, toast and story dialogue. The HUD is in hud.js (re-exported so main.js keeps working).
import { $ } from "./state.js";
export { hud } from "./hud.js";

const SCREENS = ["chapters", "select", "forge", "loadout", "gate", "party", "quests", "settings", "over"];

/** Show one full-screen panel and hide the others. show(null) hides all of them. */
export function show(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
}

let toastTimer = 0;
export function toast(text, sec = 1.8) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), sec * 1000);
}

/** Show [speaker, line] pairs one at a time. Tap the box (or press Enter / Space) to go on. */
export function dialogue(lines) {
  if (!lines || !lines.length) return Promise.resolve();
  return new Promise((resolve) => {
    const box = $("dlg");
    let i = 0;
    const paint = () => {
      $("dWho").textContent = lines[i][0];
      $("dTxt").textContent = lines[i][1];
      $("dHint").textContent = i < lines.length - 1 ? "tap to continue" : "tap to close";
    };
    function next() {
      if (++i >= lines.length) {
        box.removeEventListener("pointerdown", next);
        removeEventListener("keydown", key);
        box.hidden = true;
        resolve();
      } else paint();
    }
    function key(e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        next();
      }
    }
    box.addEventListener("pointerdown", next);
    addEventListener("keydown", key);
    box.hidden = false;
    paint();
  });
}

/** Kept so older imports still work; there is no main menu any more. */
export function refreshMenu() {}
