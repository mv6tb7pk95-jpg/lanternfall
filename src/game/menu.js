// Lanternfall: the menus. Main menu -> (Story: chapter list | Endless) -> class select -> beginRun() in run.js.
// Also wires the Forge and Loadout screens, the hub doors (hub.js) and the buttons on the result screen.
// Once the hero has entered the hub (G.home === "hub"), every Back button returns to the square instead of the main menu,
// and Story / Endless are reached through the Dungeon Gate. A hunt door (hunts.js) goes straight to the class select.
import { $, G, fail } from "./state.js";
import { show, refreshMenu, toast } from "./ui.js";
import { CLASSES } from "./skills.js";
import { CHAPTERS } from "./story.js";
import { HUNTS } from "./hunts.js";
import { loadSave } from "./save.js";
import { itemById } from "./gacha.js";
import { initForge, renderForge } from "./forge.js";
import { initLoadout, renderLoadout } from "./loadout-ui.js";
import { beginRun } from "./run.js";
import { enterHub, initHub, hubActions } from "./hub.js";

const pick = { chapter: null, hunt: null }; // what the class cards will start: a chapter, a hunt, or neither (endless)
let tipped = false; // the controls tip is shown once per visit to the page

const inHub = () => G.home === "hub";

/** The main menu. */
function goMenu() {
  G.state = "menu";
  refreshMenu();
  show("menu");
}

/** Put the hero in the square. The first time, a short tip explains how to walk, climb and enter doors. */
async function toHub() {
  await enterHub();
  if (G.state !== "hub") return;
  $("toMenu").textContent = "BACK TO THE SQUARE";
  if (!tipped) {
    tipped = true;
    toast("Up or E enters a door. Up and Down climb ropes. Hold Down and press Jump to drop through a platform.", 6);
  }
}

/** Back from a full-screen panel: the square once the hero has entered the hub, the main menu before that. */
function goBack() {
  if (inHub()) toHub().catch(fail);
  else goMenu();
}

/** One step back inside the Story / Endless flow: the Dungeon Gate in the hub, the main menu otherwise. */
function toGate() {
  G.state = "menu";
  if (inHub()) show("gate");
  else goMenu();
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

/** The class select. chapter: a story chapter; hunt: a hunting ground; neither: endless. */
function openSelect(chapter, hunt = null) {
  pick.chapter = chapter;
  pick.hunt = hunt;
  const what = hunt
    ? hunt.title + ": defeat " + hunt.quota + " monsters, reward " + hunt.reward + " shards"
    : chapter ? "Chapter " + chapter.id + ": " + chapter.name : "Endless";
  $("selSub").textContent = what + " · choose your lantern-bearer";
  const s = loadSave(), w = itemById(s.eq.weapon), a = itemById(s.eq.acc);
  $("selGear").textContent = "Gear: " + (w ? w.name : "no weapon") + " · " + (a ? a.name : "no accessory") + " (change it in the Lantern Forge). Skills: change them in Loadout.";
  show("select");
}

function openForge() {
  renderForge();
  show("forge");
}

function openLoadout() {
  renderLoadout();
  show("loadout");
}

export function initMenu() {
  // class cards
  for (const [key, c] of Object.entries(CLASSES)) {
    const b = document.createElement("button");
    b.className = "card";
    b.innerHTML = "<b>" + c.name + "</b><small>" + c.blurb + "</small><small>HP " + c.hp + " · up to 4 skills + attack</small>";
    b.addEventListener("click", () => beginRun(key, pick.chapter, pick.hunt).catch(fail));
    $("cards").append(b);
  }

  // main menu
  $("btnHub").addEventListener("click", () => toHub().catch(fail));
  $("btnStory").addEventListener("click", openChapters);
  $("btnEndless").addEventListener("click", () => openSelect(null));
  $("btnForge").addEventListener("click", openForge);
  $("btnLoadout").addEventListener("click", openLoadout);

  // the hub: what each door opens (the Shop has no entry yet, so hub.js says "not open yet")
  hubActions.forge = openForge;
  hubActions.loadout = openLoadout;
  hubActions.gate = () => show("gate");
  hubActions.party = () => show("party");
  hubActions.hunt = (id) => {
    const h = HUNTS[id];
    if (!h) {
      toast("That hunting ground is not open yet.");
      return goBack(); // hub.js has already closed the square, so go back into it
    }
    openSelect(null, h);
  };
  $("gStory").addEventListener("click", openChapters);
  $("gEndless").addEventListener("click", () => openSelect(null));
  $("gBack").addEventListener("click", goBack);
  $("pBack").addEventListener("click", goBack);

  // back buttons
  $("chBack").addEventListener("click", toGate);
  $("fBack").addEventListener("click", goBack);
  $("selBack").addEventListener("click", () => (pick.hunt ? goBack() : pick.chapter ? openChapters() : toGate()));

  // result screen
  $("retry").addEventListener("click", () => beginRun(G.key, G.chapter, G.hunt).catch(fail));
  $("nextCh").addEventListener("click", () => {
    const n = G.chapter && CHAPTERS.find((c) => c.id === G.chapter.id + 1);
    if (n) beginRun(G.key, n).catch(fail);
  });
  $("toMenu").addEventListener("click", goBack);

  initForge();
  initLoadout(goBack);
  initHub();
  refreshMenu();
}
