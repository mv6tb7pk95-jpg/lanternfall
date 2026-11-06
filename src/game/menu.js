// Lanternfall: the menus. Main menu -> (Story: chapter list | Endless) -> class select -> beginRun() in run.js.
// Also wires the Forge and Loadout screens and the buttons on the result screen.
import { $, G, fail } from "./state.js";
import { show, refreshMenu } from "./ui.js";
import { CLASSES } from "./skills.js";
import { CHAPTERS } from "./story.js";
import { loadSave } from "./save.js";
import { itemById } from "./gacha.js";
import { initForge, renderForge } from "./forge.js";
import { initLoadout, renderLoadout } from "./loadout-ui.js";
import { beginRun } from "./run.js";

const pick = { chapter: null }; // what the class cards will start: a chapter, or null for endless

function goMenu() {
  G.state = "menu";
  refreshMenu();
  show("menu");
}

function openChapters() {
  const s = loadSave(), list = $("chList");
  list.innerHTML = "";
  for (const ch of CHAPTERS) {
    const open = ch.id <= s.cleared + 1, done = ch.id <= s.cleared;
    const b = document.createElement("button");
    b.className = "chap";
    b.disabled = !open;
    const t = document.createElement("b"), d = document.createElement("small"), m = document.createElement("small");
    t.textContent = "Chapter " + ch.id + " · " + ch.name;
    d.textContent = ch.blurb;
    m.textContent = done
      ? "Cleared · a replay pays " + Math.round(ch.reward * 0.4) + " shards"
      : open ? "Reward " + ch.reward + " shards" : "Locked: clear chapter " + (ch.id - 1) + " first";
    b.append(t, d, m);
    b.addEventListener("click", () => openSelect(ch));
    list.append(b);
  }
  show("chapters");
}

function openSelect(chapter) {
  pick.chapter = chapter;
  $("selSub").textContent = (chapter ? "Chapter " + chapter.id + ": " + chapter.name : "Endless") + " · choose your lantern-bearer";
  const s = loadSave(), w = itemById(s.eq.weapon), a = itemById(s.eq.acc);
  $("selGear").textContent = "Gear: " + (w ? w.name : "no weapon") + " · " + (a ? a.name : "no accessory") + " (change it in the Lantern Forge). Skills: change them in Loadout.";
  show("select");
}

export function initMenu() {
  // class cards
  for (const [key, c] of Object.entries(CLASSES)) {
    const b = document.createElement("button");
    b.className = "card";
    b.innerHTML = "<b>" + c.name + "</b><small>" + c.blurb + "</small><small>HP " + c.hp + " · up to 4 skills + attack</small>";
    b.addEventListener("click", () => beginRun(key, pick.chapter).catch(fail));
    $("cards").append(b);
  }

  // main menu
  $("btnStory").addEventListener("click", openChapters);
  $("btnEndless").addEventListener("click", () => openSelect(null));
  $("btnForge").addEventListener("click", () => {
    renderForge();
    show("forge");
  });
  $("btnLoadout").addEventListener("click", () => {
    renderLoadout();
    show("loadout");
  });

  // back buttons
  $("chBack").addEventListener("click", goMenu);
  $("fBack").addEventListener("click", goMenu);
  $("selBack").addEventListener("click", () => (pick.chapter ? openChapters() : goMenu()));

  // result screen
  $("retry").addEventListener("click", () => beginRun(G.key, G.chapter).catch(fail));
  $("nextCh").addEventListener("click", () => {
    const n = G.chapter && CHAPTERS.find((c) => c.id === G.chapter.id + 1);
    if (n) beginRun(G.key, n).catch(fail);
  });
  $("toMenu").addEventListener("click", goMenu);

  initForge();
  initLoadout(goMenu);
  refreshMenu();
}
