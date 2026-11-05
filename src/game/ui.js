// Lanternfall: the parts of the page that are not the canvas: screens, toast, story dialogue, HUD.
import { $, G } from "./state.js";
import { loadSave } from "./save.js";
import { CHAPTERS } from "./story.js";

const SCREENS = ["menu", "chapters", "select", "forge", "over"];

/** Show one full-screen panel and hide the others. show(null) hides all of them (the game is visible). */
export function show(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
}

let toastTimer = 0;
export function toast(text, sec = 1.8) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.hidden = true;
  }, sec * 1000);
}

/** Show [speaker, line] pairs one at a time. Tap the box (or press Enter / Space) to go on. Resolves at the end. */
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
      i++;
      if (i >= lines.length) {
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

export function refreshMenu() {
  const s = loadSave();
  $("mShards").textContent = s.shards;
  $("mProg").textContent = "Story " + Math.min(s.cleared, CHAPTERS.length) + "/" + CHAPTERS.length + " · Best endless wave " + s.best;
}

/** Health bar, skill cooldowns and the boss bar. Called every frame while a run is on screen. */
export function hud() {
  const p = G.player;
  if (!p || !G.cls) return;
  $("hpFill").style.width = Math.max(0, (p.hp / p.maxHp) * 100) + "%";
  $("hpTxt").textContent = Math.ceil(Math.max(0, p.hp)) + " / " + p.maxHp;
  G.cls.skills.forEach((s, i) => {
    const el = G.cdEls[i];
    if (el) el.style.height = (G.cdMax[i] ? (G.cds[i] / G.cdMax[i]) * 100 : 0) + "%";
  });
  const b = $("boss");
  if (G.boss && !G.bossDown) {
    b.hidden = false;
    $("bossFill").style.width = Math.max(0, (G.boss.hp / G.boss.maxHp) * 100) + "%";
  } else b.hidden = true;
}
