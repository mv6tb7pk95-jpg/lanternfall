// Lanternfall: one play session.
// beginRun() loads what a run needs and starts it. updateRun() and drawRun() are called every frame by main.js.
// finish() pays the rewards, saves, plays the ending lines and shows the result screen.
import { createFrame, clearFrame, composite, loadFx } from "./px.js";
import { VW, VH, WORLD_W, DEFAULT_THEME, createWorld } from "./world.js";
import { createPlayer, updatePlayer, drawPlayer, updateEnemy, drawEnemy, touching } from "./entities.js";
import { CLASSES } from "./skills.js";
import { BASIC } from "./attacks.js";
import { updateAttack, drawShots } from "./attack.js";
import { hurtPlayer, cast } from "./combat.js";
import { updateSpawns } from "./waves.js";
import { show, dialogue } from "./ui.js";
import { loadSave, writeSave } from "./save.js";
import { statsOf } from "./gacha.js";
import { CHAPTERS } from "./story.js";
import { $, G, inp, clamp, fail, setStatus } from "./state.js";

// ---------------------------------------------------------------- the canvas
const cv = $("view"), ctx = cv.getContext("2d");
cv.width = VW;
cv.height = VH;
const frame = createFrame(VW, VH, 0, 0);
const bytes = new Uint8ClampedArray(VW * VH * 4), img = new ImageData(bytes, VW, VH);

// shown at a whole-number zoom so every game pixel stays square and crisp
let scale = 1;
function resizeView() {
  scale = Math.max(1, Math.floor(Math.min(innerWidth / VW, innerHeight / VH)));
  cv.style.width = VW * scale + "px";
  cv.style.height = VH * scale + "px";
}
addEventListener("resize", resizeView);
resizeView();

let winT = 1.4; // after the boss falls, the game keeps playing this long so its blast can be seen

// ---------------------------------------------------------------- start
/** chapter: an entry of CHAPTERS for story mode, or null for endless mode. */
export async function beginRun(key, chapter) {
  if (G.loading) return;
  G.loading = true;
  const c = CLASSES[key], atk = BASIC[key];
  setStatus("Loading " + c.name + " from pixelfx…");
  const mods = {};
  let world;
  try {
    await G.booted; // the shared effects (enemies, hit spark, explosion) from main.js
    await Promise.all([
      ...c.skills.map(async (s) => {
        mods[s.id] = await loadFx(s.path);
      }),
      loadFx(atk.path).then((m) => {
        mods[atk.path] = m;
      }),
    ]);
    world = await createWorld(chapter ? chapter.theme : DEFAULT_THEME);
  } catch (e) {
    G.loading = false;
    setStatus("");
    return fail(e);
  }

  const st = statsOf(loadSave());
  Object.assign(G, {
    state: chapter ? "dialogue" : "play", mode: chapter ? "story" : "endless", key, cls: c, chapter: chapter || null, st,
    player: createPlayer(c, st), world, mods,
    enemies: [], runs: [], fxs: [], shots: [], missiles: [],
    cds: c.skills.map(() => 0), cdMax: c.skills.map(() => 0), cdEls: [],
    wave: 0, kills: 0, got: 0, time: 0, queue: [], gap: 1, cam: 0, sparkN: 0, atkCd: 0,
    boss: null, bossOut: false, bossDown: false, bossT: 0,
  });
  winT = 1.4;
  inp.left = inp.right = inp.jump = inp.atk = false;

  $("wave").textContent = chapter ? "0/" + chapter.waves.length : "0";
  $("kills").textContent = "0";
  $("chName").textContent = chapter ? "Ch." + chapter.id + " " + chapter.name : "Endless";
  $("boss").hidden = true;
  $("nextCh").hidden = true;
  const bar = $("skills");
  bar.innerHTML = "";
  c.skills.forEach((s, i) => {
    const b = document.createElement("button");
    b.innerHTML = '<span class="key">' + (i + 1) + '</span><span class="nm">' + s.name + '</span><i class="cd"></i>';
    b.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      cast(i);
    });
    bar.append(b);
    G.cdEls.push(b.querySelector(".cd"));
  });

  G.loading = false;
  setStatus("");
  show(null); // hide every full-screen panel: the game is visible
  if (chapter) {
    await dialogue(chapter.intro);
    if (G.state === "dialogue") G.state = "play";
  }
}

// ---------------------------------------------------------------- end of a run
async function finish(won) {
  G.state = "dialogue"; // stops the game right now; the result screen follows
  inp.left = inp.right = inp.jump = inp.atk = false;
  const s = loadSave(), ch = G.chapter, story = G.mode === "story";
  let gain = G.got, note = "";
  if (story && won) {
    const first = s.cleared < ch.id;
    gain += first ? ch.reward : Math.round(ch.reward * 0.4); // a replay pays 40%
    note = first ? "First clear!" : "Replay reward";
    if (first) s.cleared = ch.id;
  } else if (!story) {
    gain += G.wave * 5;
    if (G.wave > s.best) {
      s.best = G.wave;
      note = "New best wave!";
    }
  }
  gain = Math.round(gain * (1 + G.st.shard));
  s.shards += gain;
  writeSave(); // saved before the ending lines, so closing the page can't lose a first clear

  const next = story ? CHAPTERS.find((x) => x.id === ch.id + 1) : null;
  if (story && won) await dialogue(ch.outro);
  $("overTitle").textContent = story && won ? "CHAPTER CLEARED" : "YOU FELL";
  $("overTxt").textContent = [
    story ? ch.name : "Wave " + G.wave,
    G.kills + " kills",
    "+" + gain + " shards",
    note,
    story && won && !next ? "All chapters cleared!" : "",
  ].filter(Boolean).join(" · ");
  $("retry").textContent = won ? "REPLAY" : "TRY AGAIN";
  $("nextCh").hidden = !(story && won && next);
  G.state = "over";
  show("over");
}

// ---------------------------------------------------------------- update
export function updateRun(dt) {
  if (!G.world || !G.player) return;
  G.world.update(dt, G.cam);
  if (G.state !== "play") return;

  const frozen = G.runs.some((r) => r.act.frozen); // hit-stop: the whole world holds still for a beat
  for (const r of G.runs) r.act.update(dt);
  for (const r of G.runs) {
    if (!r.free && r.act.t >= Math.min(r.freeAt, r.to)) {
      // control comes back; the hero stays where the move left him
      r.free = true;
      const p = G.player;
      p.x = clamp(p.x + Math.round(r.act.pose?.x ?? 0) * r.dir, 12, WORLD_W - 12);
      p.locked = false;
    }
  }
  G.runs = G.runs.filter((r) => r.act.t < r.to);
  if (frozen) return;

  G.time += dt;
  const p = G.player;
  updatePlayer(p, dt, inp);
  inp.jump = false;
  updateAttack(dt);
  G.cds = G.cds.map((c) => Math.max(0, c - dt));
  updateSpawns(dt);

  for (const e of G.enemies) {
    updateEnemy(e, dt, p);
    if (touching(e, p) && e.hitCd <= 0 && p.hurt <= 0) {
      e.hitCd = 1.1;
      if (hurtPlayer(e.dmg, e.x)) return void finish(false).catch(fail);
    }
  }
  for (const fx of G.fxs) fx.update(dt);
  G.fxs = G.fxs.filter((fx) => !fx.done());

  if (G.mode === "story" && G.bossDown) {
    winT -= dt;
    if (winT <= 0) return void finish(true).catch(fail);
  }

  const target = clamp(Math.round(p.x - VW / 2), 0, WORLD_W - VW);
  G.cam = Math.round(G.cam + (target - G.cam) * Math.min(1, dt * 6));
}

// ---------------------------------------------------------------- draw
export function drawRun() {
  const W = G.world, p = G.player;
  if (!W || !p) return;
  frame.ox = G.cam | 0;
  clearFrame(frame);
  const bg = W.drawBg(frame.ox);
  W.drawProps(frame, frame.ox);
  for (const e of G.enemies) drawEnemy(frame, e);
  if (!p.locked) drawPlayer(frame, p);
  drawShots(frame);
  // a skill in progress draws its effect, the hero (until control returns) and nothing else
  for (const r of G.runs) r.act.draw(frame, { body: !r.free, target: false });
  for (const fx of G.fxs) fx.draw(frame);
  composite(frame, bytes, bg, 1);
  ctx.putImageData(img, 0, 0);

  // the act's own screen shake, applied to the whole canvas
  let sx = 0, sy = 0;
  for (const r of G.runs) {
    sx += r.act.shake[0];
    sy += r.act.shake[1];
  }
  cv.style.transform = sx || sy ? "translate(" + sx * scale + "px," + sy * scale + "px)" : "";
}
