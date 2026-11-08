// Lanternfall: the Shop screen. It only draws the screen and handles its buttons; the rules are in shop.js.
// The screen's HTML is built here (placed right after the Forge screen), so game.html does not change.
// menu.js calls initShop(goBack) once and renderShop() every time the screen opens.
import { loadSave, writeSave } from "./save.js";
import { UPGRADES, MAX_SHOP_LV, levelOf, costOf, buy } from "./shop.js";

const $ = (id) => document.getElementById(id);
const save = loadSave();
const GOLD = "#d4a548";

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function renderShop() {
  $("shShards").textContent = save.shards;
  const list = $("shList");
  list.innerHTML = "";
  for (const u of UPGRADES) {
    const lv = levelOf(save, u.id), cost = costOf(save, u.id), d = el("div", "item");
    d.style.borderColor = GOLD;
    const n = el("b", "", u.name);
    n.style.color = GOLD;
    const now = u.per * lv;
    d.append(
      n,
      el("small", "", "Level " + lv + " of " + MAX_SHOP_LV),
      el("small", "", u.label + " +" + now + "% now (+" + u.per + "% per level)"),
      el("small", "note", u.note)
    );
    const b = el("button", "eq", cost == null ? "MAXED" : "BUY LEVEL " + (lv + 1) + " (" + cost + " shards)");
    b.disabled = cost == null || save.shards < cost;
    b.addEventListener("click", () => {
      const r = buy(save, u.id);
      if (!r.ok) {
        $("shMsg").textContent = r.reason;
        return;
      }
      $("shMsg").textContent = "";
      writeSave();
      renderShop();
    });
    d.append(b);
    list.append(d);
  }
}

export function initShop(goBack) {
  const s = el("div", "screen");
  s.id = "shop";
  s.hidden = true;
  s.innerHTML =
    "<h2>Shop</h2>" +
    '<p class="sub">Shards: <b id="shShards">0</b></p>' +
    '<div class="fbox">Upgrades last forever and apply to every class and every run. Shards are earned by playing. There is no real money in this game.</div>' +
    '<div class="grid" id="shList"></div>' +
    '<div id="shMsg" style="color:#ff9a8a;font-size:12px;min-height:16px;margin:4px 0"></div>' +
    '<button class="btn small" id="shBack">Back to the square</button>' +
    '<div style="height:24px"></div>';
  $("forge").after(s);
  $("shBack").addEventListener("click", goBack);
}
