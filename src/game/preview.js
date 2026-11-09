// Lanternfall: effect preview (batch 1 of 2). A modal that plays ONE skill's real pixelfx effect on a practice slime,
// over the same backdrop as the game, and repeats it until it is closed.
//
// Public API (batch 2 only needs these three):
//   openSkillPreview(skillOrId)  async. A skill id from skills.js or skillpool.js (or the skill object). Resolves true if the id is known.
//   closePreview()
//   canPreview(skillOrId)        true when the id is a starter skill or a skill book (gear has no visual effect, so false for gear ids)
//
// It is self-contained: it builds its own DOM and CSS, owns its own canvas and frame, and NEVER reads or writes G (state.js),
// the save, the network or the run loop. Opening it cannot start a cooldown, hurt anything or change a loadout.
// It plays the skills the same way the game does: an act skill through startSkill() (skills.js), a zone skill through
// spawnZone()/stepZone() (zoneskill.js). Projectile skills play the move as pixelfx made it (no early impact), so a real hit
// can look a little different in a fight.
import { createFrame, clearFrame, composite, loadFx, createFx, pxRect, hex } from "./px.js";
import { VW, VH, GY, WORLD_W, createWorld } from "./world.js";
import { createPlayer, updatePlayer, drawPlayer } from "./entities.js";
import { CLASSES, startSkill } from "./skills.js";
import { bookById } from "./skillpool.js";
import { FLIGHTS } from "./projectile.js";
import { isZoneSkill, zoneCast, spawnZone, stepZone } from "./zoneskill.js";
import { RARITY } from "./gacha.js";

const CAM = 100; // the camera: the hero stands at HERO_X, 50 px from the left edge, so 260 px of reach is on screen
const HERO_X = 150;
const PAUSE = 1; // seconds to wait after a cast ends before it plays again
const BAR = hex("#c9962a"), BAR_HIT = hex("#fff2a8"), HEAL = hex("#3fa65a"), HEAL_HIT = hex("#b8ffc8");

const CSS = `
#fxPv{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(4,3,10,.86);
  padding:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));box-sizing:border-box}
#fxPv[hidden]{display:none}
#fxPv .pv-box{background:#12101c;border:2px solid #3a3354;border-radius:10px;padding:10px 12px;max-width:100%;max-height:100%;overflow:auto;
  box-sizing:border-box;color:#e8e3ff;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.6)}
#fxPv .pv-head{display:flex;flex-direction:column;gap:2px;margin-bottom:8px}
#fxPv #pvName{font-size:18px}
#fxPv #pvSub{font-size:12px;color:#a89fc8}
#fxPv canvas{display:block;margin:0 auto;image-rendering:pixelated;image-rendering:crisp-edges;border:1px solid #2b2639;background:#07060d}
#fxPv #pvInfo,#fxPv #pvHits{font-size:12px;color:#cfc8ff;margin-top:6px}
#fxPv #pvMsg{font-size:11px;color:#a89fc8;margin-top:4px;min-height:14px;white-space:pre-wrap}
#fxPv #pvMsg.bad{color:#ff9a8a}
#fxPv .pv-btns{display:flex;gap:8px;justify-content:center;margin-top:8px;flex-wrap:wrap}
#fxPv .pv-btns button{min-height:44px;min-width:92px;padding:0 14px;border-radius:8px;border:1px solid #5b5080;background:#241f38;color:#f2eeff;font:inherit;font-size:14px}
#fxPv .pv-btns button:active{background:#3a3354}
`;

// ---------------------------------------------------------------- what to play
function findSkill(ref) {
  const id = typeof ref === "string" ? ref : ref && ref.id;
  for (const [key, c] of Object.entries(CLASSES)) {
    const s = c.skills.find((x) => x.id === id);
    if (s) return { skill: s, cls: key, book: false };
  }
  const b = bookById(id);
  return b ? { skill: b, cls: b.cls, book: true } : null;
}

export const canPreview = (ref) => !!findSkill(ref);

/** Where the practice slime stands (world x), or null for a skill that hurts nobody (it heals). */
function dummyX(s) {
  if (s.heal) return null;
  let d;
  if (isZoneSkill(s)) d = s.at + (s.off || 0);
  else if (FLIGHTS[s.id]) {
    const f = FLIGHTS[s.id].flights, last = f[f.length - 1];
    d = last.at(last.t1); // where the projectile lands
  } else d = (s.zone[0] + s.zone[1]) / 2;
  return HERO_X + Math.max(35, Math.round(d)); // never inside the hero
}

/** [from, to] in world x of the area the skill really hurts (the game adds each enemy's half-width on top). */
function areaOf(s) {
  if (isZoneSkill(s)) {
    const cx = HERO_X + (s.at || 0) + (s.off || 0);
    return [cx - s.half, cx + s.half];
  }
  return [HERO_X + Math.min(s.zone[0], s.zone[1]), HERO_X + Math.max(s.zone[0], s.zone[1])];
}

// ---------------------------------------------------------------- state
const view = { frame: createFrame(VW, VH, 0, 0), bytes: new Uint8ClampedArray(VW * VH * 4) };
view.img = new ImageData(view.bytes, VW, VH);
let dom = null, worldP = null, session = 0, raf = 0, last = 0, isOpen = false, showArea = true;
let S = null; // the scene that is playing

const getWorld = () => worldP || (worldP = createWorld().catch((e) => ((worldP = null), Promise.reject(e))));

// ---------------------------------------------------------------- one cast
function spark() {
  if (!S.spark || !S.dx || S.sparks.length > 20) return;
  S.sparks.push(createFx(S.spark, { x: Math.round(S.dx), y: GY, height: 12, flip: false, seed: 1 + (S.n++ % 9) }));
}

function hit() {
  S.flash = 0.18;
  S.hits++;
  spark();
  dom.hits.textContent = (S.skill.heal ? "Heal ticks this cast: " : "Hits this cast: ") + S.hits;
}

function startCycle() {
  const s = S.skill, p = createPlayer(CLASSES[S.cls], {});
  p.x = HERO_X;
  p.face = 1;
  Object.assign(S, { p, run: null, zone: null, sparks: [], flash: 0, hits: 0, t: 0, wait: 0 });
  dom.hits.textContent = s.heal ? "Heal ticks this cast: 0" : "Hits this cast: 0";
  if (isZoneSkill(s)) {
    p.atk = zoneCast(s);
    S.zone = spawnZone(S.mod, s, p);
  } else {
    p.locked = true; // the act draws the body until it gives control back
    S.run = startSkill(S.mod, s, p, () => hit());
  }
}

function step(dt) {
  const p = S.p, r = S.run;
  if (r) {
    r.act.update(dt);
    if (!r.free && r.act.t >= Math.min(r.freeAt, r.to)) {
      r.free = true; // control comes back, the hero stays where the move left him (same as run.js)
      p.x = Math.max(12, Math.min(WORLD_W - 12, p.x + Math.round((r.act.pose && r.act.pose.x) || 0) * r.dir));
      p.locked = false;
    }
    if (r.act.frozen) return; // the hit-stop of the move itself: everything else holds still
  }
  S.t += dt;
  S.world.update(dt, CAM);
  if (S.dummy) S.dummy.update(dt);
  updatePlayer(p, dt, {});
  if (p.atk) {
    p.atk.t += dt;
    if (p.atk.t >= p.atk.b.dur) p.atk = null;
  }
  if (S.zone) stepZone(S.zone, dt, () => hit());
  for (const k of S.sparks) k.update(dt);
  S.sparks = S.sparks.filter((k) => !k.done());
  S.flash = Math.max(0, S.flash - dt);

  const over = (!S.run || S.run.act.t >= S.run.to) && (!S.zone || S.zone.fx.done() || S.zone.t > 8);
  S.wait = over && S.t > 0.2 ? S.wait + dt : 0;
  if (S.wait > PAUSE || S.t > 12) startCycle(); // 12 s is only a safety net
}

function draw() {
  const f = view.frame, p = S.p, heal = !!S.skill.heal;
  f.ox = CAM;
  f.oy = 0;
  clearFrame(f);
  const bg = S.world.drawBg(CAM, 0);
  S.world.drawProps(f, CAM, 0);
  if (showArea) {
    const c = heal ? (S.flash > 0 ? HEAL_HIT : HEAL) : S.flash > 0 ? BAR_HIT : BAR;
    const lo = Math.round(S.area[0]), hi = Math.round(S.area[1]), y = GY + 8;
    pxRect(f, lo, y, hi - lo, 1, c);
    pxRect(f, lo, y - 2, 1, 5, c);
    pxRect(f, hi - 1, y - 2, 1, 5, c);
  }
  if (S.dummy) S.dummy.draw(f);
  if (!p.locked) drawPlayer(f, p);
  if (S.run) S.run.act.draw(f, { body: !S.run.free, target: false });
  if (S.zone) S.zone.fx.draw(f);
  for (const k of S.sparks) k.draw(f);
  composite(f, view.bytes, bg, 1);
  dom.ctx.putImageData(view.img, 0, 0);
}

function tick(now) {
  if (!isOpen || !S) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    step(dt);
    draw();
  } catch (e) {
    console.error(e);
    setMsg("The preview stopped: " + ((e && e.message) || e), true);
    return;
  }
  raf = requestAnimationFrame(tick);
}

// ---------------------------------------------------------------- the modal
function setMsg(text, bad) {
  if (!dom) return;
  dom.msg.textContent = text || "";
  dom.msg.classList.toggle("bad", !!bad);
}

function fit() {
  if (!dom) return;
  const k = Math.max(1, Math.floor(Math.min((innerWidth - 40) / VW, (innerHeight - 200) / VH)));
  dom.cv.style.width = VW * k + "px";
  dom.cv.style.height = VH * k + "px";
}

function ensureDom() {
  if (dom) return dom;
  const st = document.createElement("style");
  st.textContent = CSS;
  document.head.append(st);
  const root = document.createElement("div");
  root.id = "fxPv";
  root.hidden = true;
  root.innerHTML =
    '<div class="pv-box" role="dialog" aria-modal="true" aria-label="Effect preview">' +
    '<div class="pv-head"><b id="pvName"></b><span id="pvSub"></span></div>' +
    '<canvas id="pvCv"></canvas>' +
    '<div id="pvInfo"></div><div id="pvHits"></div><div id="pvMsg"></div>' +
    '<div class="pv-btns"><button id="pvReplay">Replay</button><button id="pvArea">Hit area: on</button><button id="pvClose">Close</button></div>' +
    "</div>";
  document.body.append(root);
  const q = (id) => root.querySelector("#" + id);
  dom = { root, cv: q("pvCv"), name: q("pvName"), sub: q("pvSub"), info: q("pvInfo"), hits: q("pvHits"), msg: q("pvMsg"), area: q("pvArea") };
  dom.cv.width = VW;
  dom.cv.height = VH;
  dom.ctx = dom.cv.getContext("2d");
  q("pvClose").addEventListener("click", closePreview);
  q("pvReplay").addEventListener("click", () => S && startCycle());
  dom.area.addEventListener("click", () => {
    showArea = !showArea;
    dom.area.textContent = "Hit area: " + (showArea ? "on" : "off");
  });
  root.addEventListener("pointerdown", (e) => {
    if (e.target === root) closePreview(); // a tap outside the box closes it
  });
  return dom;
}

const onKey = (e) => {
  if (e.key === "Escape") closePreview();
};

export function closePreview() {
  session++; // a load that is still running will see this and stop
  isOpen = false;
  cancelAnimationFrame(raf);
  S = null;
  removeEventListener("keydown", onKey);
  removeEventListener("resize", fit);
  if (dom) dom.root.hidden = true;
}

export async function openSkillPreview(ref) {
  const found = findSkill(ref);
  if (!found) return false;
  const { skill, cls, book } = found, my = ++session, d = ensureDom();
  cancelAnimationFrame(raf);
  S = null;
  isOpen = true;
  addEventListener("keydown", onKey);
  addEventListener("resize", fit);
  fit();
  d.root.hidden = false;
  const r = book ? RARITY[skill.rarity] : null, cn = CLASSES[cls] ? CLASSES[cls].name : cls;
  d.name.textContent = skill.name;
  d.name.style.color = r ? r.color : "#e8e3ff";
  d.sub.textContent = cn + " · " + (book ? r.name + " skill book" : "Starter skill");
  d.info.textContent = skill.heal
    ? "Cooldown " + skill.cd + " s · restores " + Math.round(skill.heal * 100) + "% of max HP"
    : "Cooldown " + skill.cd + " s · damage " + skill.dmg + (isZoneSkill(skill) ? " per tick" : " per hit");
  d.hits.textContent = "";
  setMsg("Loading the effect…");
  try {
    const [mod, world, slime, sparkMod] = await Promise.all([
      loadFx(skill.path),
      getWorld(),
      loadFx("critters/slime").catch(() => null), // the practice slime and the hit spark are nice to have, not needed
      loadFx("impacts/hit-spark").catch(() => null),
    ]);
    if (my !== session) return true; // closed, or another preview was opened meanwhile
    if (!isZoneSkill(skill) && !mod.act) throw new Error(skill.name + " has no move to play");
    const dx = dummyX(skill);
    S = {
      skill, cls, mod, world, spark: sparkMod, dx, n: 0, area: areaOf(skill),
      dummy: slime && dx ? createFx(slime, { x: Math.round(dx), y: GY, seed: 5 }) : null,
    };
    setMsg("Preview only: nothing is hurt, no cooldown starts. The yellow bar is the hit area.");
    startCycle();
    last = performance.now();
    raf = requestAnimationFrame(tick);
  } catch (e) {
    if (my === session) setMsg("Could not load this preview: " + ((e && e.message) || e), true);
  }
  return true;
}
