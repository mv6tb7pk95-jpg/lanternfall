// Lanternfall: menus. Title -> Play -> the hub. The right sidebar opens Gear, Class, Shop, Quests and Settings.
// Story / Endless are reached through the Dungeon Gate; a hunt door or the Quests panel opens the class select.
import { $, G, fail } from "./state.js";
import { show, toast } from "./ui.js";
import { CLASSES } from "./skills.js";
import { CHAPTERS } from "./story.js";
import { HUNTS } from "./hunts.js";
import { loadSave } from "./save.js";
import { itemById } from "./gacha.js";
import { initForge, renderForge } from "./forge.js";
import { initShop, renderShop } from "./shop-ui.js";
import { initLoadout, renderLoadout } from "./loadout-ui.js";
import { beginRun } from "./run.js";
import { enterHub, initHub, hubActions, leave as leaveHub } from "./hub.js";
import { initTitle, showTitle } from "./title.js";

const pick = { chapter: null, hunt: null, viaQuests: false };
let tipped = false;

async function toHub() {
  await enterHub();
  if (G.state !== "hub") return;
  if (!tipped) {
    tipped = true;
    toast("Up or E enters a door. Up and Down climb ropes. Hold Down and press Jump to drop through a platform.", 6);
  }
}
const goBack = () => toHub().catch(fail);

function openChapters() {
  const s = loadSave(), list = $("chList");
  list.innerHTML = "";
  for (const ch of CHAPTERS) {
    const open = ch.id <= s.cleared + 1, done = ch.id <= s.cleared;
    const b = document.createElement("button");
    b.className = "chap";
    b.disabled = !open;
    const t = document.createElement("b"), d = document.createElement("small"), m = document.createElement("small");
    t.textContent = "Chapter " + ch.id + ": " + ch.name;
    d.textContent = ch.blurb;
    m.textContent = done ? "Cleared. A replay pays " + Math.round(ch.reward * 0.4) + " shards" : open ? "Reward " + ch.reward + " shards" : "Locked: clear chapter " + (ch.id - 1) + " first";
    b.append(t, d, m);
    b.addEventListener("click", () => openSelect(ch));
    list.append(b);
  }
  show("chapters");
}

function openSelect(chapter, hunt = null, viaQuests = false) {
  Object.assign(pick, { chapter, hunt, viaQuests });
  const what = hunt ? hunt.title + ": defeat " + hunt.quota + " monsters, reward " + hunt.reward + " shards" : chapter ? "Chapter " + chapter.id + ": " + chapter.name : "Endless";
  $("selSub").textContent = what + ". Choose your lantern-bearer.";
  const s = loadSave(), w = itemById(s.eq.weapon), a = itemById(s.eq.acc);
  $("selGear").textContent = "Gear: " + (w ? w.name : "no weapon") + ", " + (a ? a.name : "no accessory") + ". Change gear in Gear, skills in Class.";
  show("select");
}

function openForge() { renderForge(); show("forge"); }
function openShop() { renderShop(); show("shop"); }
function openLoadout() { renderLoadout(); show("loadout"); }

function openQuests() {
  const s = loadSave(), list = $("qList");
  $("qStory").textContent = "Story: " + Math.min(s.cleared, CHAPTERS.length) + " of " + CHAPTERS.length + " chapters cleared. Best endless wave: " + s.best + ".";
  list.innerHTML = "";
  for (const h of Object.values(HUNTS)) {
    const b = document.createElement("button");
    b.className = "chap";
    const t = document.createElement("b"), d = document.createElement("small");
    t.textContent = h.title;
    d.textContent = "Defeat " + h.quota + " monsters. Reward " + h.reward + " shards.";
    b.append(t, d);
    b.addEventListener("click", () => openSelect(null, h, true));
    list.append(b);
  }
  show("quests");
}

/** Sidebar: close the square (the hero would otherwise keep walking under the panel), then open the panel.
 *  leaveHub() also remembers where the hero stands, so Back puts him at the same spot. */
function side(id) {
  if (G.loading || G.state === "play") return;
  if (G.state === "hub") leaveHub();
  ({ gear: openForge, cls: openLoadout, shop: openShop, quests: openQuests, settings: () => show("settings") })[id]();
}

export function initMenu() {
  for (const [key, c] of Object.entries(CLASSES)) {
    const b = document.createElement("button");
    b.className = "card";
    b.innerHTML = "<b>" + c.name + "</b><small>" + c.blurb + "</small><small>HP " + c.hp + ", up to 4 skills and an attack</small>";
    b.addEventListener("click", () => beginRun(key, pick.chapter, pick.hunt).catch(fail));
    $("cards").append(b);
  }

  initTitle(goBack);
  document.querySelectorAll("#side button").forEach((b) =>
    b.addEventListener("click", () => { b.blur(); side(b.dataset.p); })
  );

  hubActions.forge = openForge;
  hubActions.shop = openShop;
  hubActions.loadout = openLoadout;
  hubActions.gate = () => show("gate");
  hubActions.party = () => show("party");
  hubActions.hunt = (id) => {
    const h = HUNTS[id];
    if (!h) { toast("That hunting ground is not open yet."); return goBack(); }
    openSelect(null, h);
  };

  $("gStory").addEventListener("click", openChapters);
  $("gEndless").addEventListener("click", () => openSelect(null));
  for (const id of ["gBack", "pBack", "fBack", "qBack", "setHub", "toMenu"]) $(id).addEventListener("click", goBack);
  $("chBack").addEventListener("click", () => show("gate"));
  $("selBack").addEventListener("click", () => (pick.hunt ? (pick.viaQuests ? openQuests() : goBack()) : pick.chapter ? openChapters() : show("gate")));
  $("setTitle").addEventListener("click", () => { show(null); showTitle(); });

  $("retry").addEventListener("click", () => beginRun(G.key, G.chapter, G.hunt).catch(fail));
  $("nextCh").addEventListener("click", () => {
    const n = G.chapter && CHAPTERS.find((c) => c.id === G.chapter.id + 1);
    if (n) beginRun(G.key, n).catch(fail);
  });

  initForge();
  initShop(goBack);
  initLoadout(goBack);
  initHub();
}
