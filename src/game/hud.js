// Lanternfall: the on-canvas HUD. main.js calls hud() every frame.
import { $, G } from "./state.js";
import { loadSave } from "./save.js";

let shown = -1;

export function hud() {
  const sh = loadSave().shards + (G.state === "play" ? G.got | 0 : 0);
  if (sh !== shown) {
    shown = sh;
    const e = $("shardCt");
    if (e) e.textContent = sh;
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
