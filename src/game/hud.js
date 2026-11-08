// Lanternfall: the on-canvas HUD. main.js calls hud() every frame.
// presenceTick() (presence.js) also runs here: it sends our state to the party and updates the party panel on the left.
import { $, G, fail } from "./state.js";
import { loadSave } from "./save.js";
import { presenceTick } from "./presence.js";

let shown = -1, presenceOk = true;

export function hud() {
  const sh = loadSave().shards + (G.state === "play" ? G.got | 0 : 0);
  if (sh !== shown) {
    shown = sh;
    const e = $("shardCt");
    if (e) e.textContent = sh;
  }
  if (presenceOk) {
    // a fault in the party code must not stop the game loop: it is reported once and the party display is switched off
    try {
      presenceTick();
    } catch (e) {
      presenceOk = false;
      fail(e);
    }
  }
  const p = G.player;
  if (!p || !G.cls || G.state === "hub") return;
  $("hpFill").style.width = Math.max(0, (p.hp / p.maxHp) * 100) + "%";
  $("hpTxt").textContent = Math.ceil(Math.max(0, p.hp)) + " / " + p.maxHp;
  $("kills").textContent = G.kills;
  G.cdEls.forEach((el, i) => {
    el.style.height = (G.cdMax[i] ? (G.cds[i] / G.cdMax[i]) * 100 : 0) + "%";
  });
  const b = $("boss");
  if (G.boss && !G.bossDown) {
    b.hidden = false;
    $("bossFill").style.width = Math.max(0, (G.boss.hp / G.boss.maxHp) * 100) + "%";
  } else b.hidden = true;
}
