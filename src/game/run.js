// Lanternfall: one play session.
// beginRun() loads what a run needs and starts it. updateRun() and drawRun() are called every frame by main.js.
// finish() pays the rewards, saves, plays the ending lines and shows the result screen.
// The canvas size on screen is handled by layout.js (a whole-number zoom, set through CSS variables).
// The skills of a run are the player's saved loadout (loadout.js): starters plus unlocked skill books, up to 4.
// Hit-stop: when a projectile hits, combat.js sets G.hitStop; the world then holds still until it has counted down here.
// Screen shake: combat.js sets G.shakeT / G.shakeAmp; it counts down in real time (also during a hit-stop) and is drawn below.
// A world with vertical = true (the hub) also scrolls up and down: frame.oy is G.camY. Runs have no such world, so oy stays 0.
// Three kinds of run: story (a chapter), endless, and a monster hunt (G.mode "hunt", data and spawner in hunts.js).
// A hunt is won when G.kills reaches the quota, and the hero goes back to the same hub door afterwards.
// A co-op hunt is a hunt with a 4th beginRun argument { host, n } (coop.js): the host runs the monsters, guests draw them.
import { createFrame, clearFrame, composite, loadFx } from "./px.js";
import { VW, VH, WORLD_W, DEFAULT_THEME, createWorld } from "./world.js";
import { createPlayer, updatePlayer, drawPlayer, updateEnemy, drawEnemy, touching } from "./entities.js";
import { CLASSES } from "./skills.js";
import { BASIC } from "./attacks.js";
import { updateAttack, drawShots } from "./attack.js";
import { hurtPlayer, cast, updateProjectiles, updateZones } from "./combat.js";
import { updateSpawns } from "./waves.js";
import { updateHunt, startHunt } from "./hunts.js";
import { initCoop, scaleHunt, coopUpdate, coopDown, coopEnd, stepProxy, aimAt, drawMates } from "./coop.js";
import { show, dialogue } from "./ui.js";
import { loadSave, writeSave } from "./save.js";
import { statsOf } from "./gacha.js";
import { getLoadout } from "./loadout.js";
import { CHAPTERS } from "./story.js";
import { getScale } from "./layout.js";
import { $, G, inp, clamp, fail, setStatus } from "./state.js";

// ---------------------------------------------------------------- the canvas
const cv = $("view"), ctx = cv.getContext("2d");
cv.width = VW;
cv.height = VH;
const frame = createFrame(VW, VH, 0, 0);
const bytes = new Uint8ClampedArray(VW * VH * 4), img = new ImageData(bytes, VW, VH);

let winT = 1.4; // after the boss falls (or the hunt quota is reached), the game keeps playing this long

// ---------------------------------------------------------------- start
/**
 * chapter: an entry of CHAPTERS for story mode, or null.
 * hunt: an entry of HUNTS (hunts.js) for a monster hunt, or null. With neither, it is endless mode.
 * party: { host, n } for a co-op hunt (coop.js), or null.
 */
export async function beginRun(key, chapter, hunt = null, party = null) {
  if (G.loading) return;
  G.loading = true;
  const c = CLASSES[key], atk = BASIC[key];
  const save = loadSave();
  const skills = getLoadout(save, key); // the equipped skills, in slot order
  setStatus("Loading " + c.name + " from pixelfx…");
  const mods = {};
  let world;
  try {
    await G.booted; // the shared effects (enemies, hit spark, explosion) from main.js
    await Promise.all([
      ...skills.map(async (s) => {
        mods[s.id] = await loadFx(s.path);
      }),
      loadFx(atk.path).then((m) => {
        mods[atk.path] = m;
      }),
    ]);
    world = await createWorld(hunt ? hunt.theme : chapter ? chapter.theme : DEFAULT_THEME);
  } catch (e) {
    G.loading = false;
    setStatus("");
    return fail(e);
  }

  const coop = hunt && party;
  if (coop) hunt = scaleHunt(hunt, party.n); // a copy: more monsters, tougher, more to defeat for a bigger party
  const st = statsOf(save);
  Object.assign(G, {
    state: chapter ? "dialogue" : "play", mode: hunt ? "hunt" : chapter ? "story" : "endless", key, cls: c, skills, chapter: chapter || null, hunt: hunt || null, st,
    coop: coop ? initCoop(party) : null,
    player: createPlayer(c, st), world, mods,
    enemies: [], runs: [], fxs: [], shots: [], missiles: [], zones: [],
    cds: skills.map(() => 0), cdMax: skills.map(() => 0), cdEls: [],
    wave: 0, kills: 0, got: 0, time: 0, queue: [], gap: 1, cam: 0, sparkN: 0, atkCd: 0,
    hitStop: 0, shakeT: 0, shake0: 0, shakeAmp: 0,
    boss: null, bossOut: false, bossDown: false, bossT: 0,
  });
  winT = hunt ? 0.8 : 1.4;
  inp.left = inp.right = inp.jump = inp.atk = false;

  $("wave").textContent = hunt ? "-" : chapter ? "0/" + chapter.waves.length : "0";
  $("kills").textContent = "0";
  $("chName").textContent = hunt ? hunt.title + " 0/" + hunt.quota : chapter ? "Ch." + chapter.id + " " + chapter.name : "Endless";
  $("boss").hidden = true;
  $("nextCh").hidden = true;
  const bar = $("skills");
  bar.innerHTML = "";
  skills.forEach((s, i) => {
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
  if (hunt) startHunt();
  if (chapter) {
    await dialogue(chapter.intro);
    if (G.state === "dialogue") G.state = "play";
  }
}

// ---------------------------------------------------------------- end of a run
async function finish(won) {
  G.state = "dialogue"; // stops the game right now; the result screen follows
  G.hitStop = 0;
  G.shakeT = 0;
  inp.left = inp.right = inp.jump = inp.atk = false;
  if (G.coop) coopEnd(won); // the host tells the party (a guest does nothing here)
  const s = loadSave(), ch = G.chapter, story = G.mode === "story", hunt = G.mode === "hunt" ? G.hunt : null;
  let gain = G.got, note = "";
  if (hunt) {
    if (won) {
      gain += hunt.reward; // a hunt can be repeated, and pays its reward every time
      note = "Hunt complete!";
    } else note = "Hunt failed: " + G.kills + "/" + hunt.quota;
    if (G.coop && G.coop.deaths) note += " · knocked down " + G.coop.deaths + "×";
  } else if (story && won) {
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
  $("overTitle").textContent = hunt ? (won ? "HUNT COMPLETE" : "YOU FELL") : story && won ? "CHAPTER CLEARED" : "YOU FELL";
  $("overTxt").textContent = [
    hunt ? hunt.title : story ? ch.name : "Wave " + G.wave,
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
  if (G.shakeT > 0) G.shakeT = Math.max(0, G.shakeT - dt); // real time: the shake plays out during the hit-stop too
  if (G.state !== "play") return;
  // co-op: the host ended the hunt, or left (the host's own end goes through the quota check below)
  if (G.coop && G.coop.over) return void finish(G.coop.over === "win").catch(fail);
  if (G.hitStop > 0) {
    // a projectile just hit: everything holds still for a beat
    G.hitStop = Math.max(0, G.hitStop - dt);
    return;
  }

  const frozen = G.runs.some((r) => r.act.frozen); // hit-stop of a move's own hit: the whole world holds still for a beat
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
  const p = G.player, guest = !!(G.coop && !G.coop.host);
  updatePlayer(p, dt, inp);
  inp.jump = false;
  updateAttack(dt);
  updateProjectiles(); // projectile skills: the tip of each is followed here, the first enemy it touches is hurt
  updateZones(dt); // zone skills: their damage ticks
  G.cds = G.cds.map((c) => Math.max(0, c - dt));
  if (G.mode === "hunt") {
    if (!guest) updateHunt(dt); // a hunt spawns its own monsters (a co-op guest gets them from the host instead)
  } else updateSpawns(dt);
  if (G.coop) coopUpdate(dt); // the host sends its monster list; a guest applies the last one it got

  for (const e of G.enemies) {
    if (guest) stepProxy(e, dt);
    else updateEnemy(e, dt, G.coop ? aimAt(e, p) : p);
    if (touching(e, p) && e.hitCd <= 0 && p.hurt <= 0) {
      e.hitCd = 1.1;
      if (hurtPlayer(e.dmg, e.x)) {
        if (!G.coop) return void finish(false).catch(fail);
        coopDown(); // a co-op hero is knocked down, not out
      }
    }
  }
  for (const fx of G.fxs) fx.update(dt);
  G.fxs = G.fxs.filter((fx) => !fx.done());

  if (G.mode === "story" && G.bossDown) {
    winT -= dt;
    if (winT <= 0) return void finish(true).catch(fail);
  }
  if (G.mode === "hunt" && G.kills >= G.hunt.quota) {
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
  frame.oy = W.vertical ? G.camY | 0 : 0; // only the hub scrolls up and down
  clearFrame(frame);
  const bg = W.drawBg(frame.ox, frame.oy);
  W.drawProps(frame, frame.ox, frame.oy);
  for (const e of G.enemies) drawEnemy(frame, e);
  drawMates(frame); // co-op: the other heroes (a no-op outside a co-op hunt)
  if (!p.locked) drawPlayer(frame, p);
  drawShots(frame);
  // a skill in progress draws its effect, the hero (until control returns) and nothing else
  for (const r of G.runs) r.act.draw(frame, { body: !r.free, target: false });
  for (const z of G.zones) z.fx.draw(frame);
  for (const fx of G.fxs) fx.draw(frame);
  composite(frame, bytes, bg, 1);
  ctx.putImageData(img, 0, 0);

  // screen shake, applied to the whole canvas (the stage clips it, so it never leaks onto the controls):
  // the act's own shake, plus the jitter of a projectile hit that fades out as G.shakeT runs down
  let sx = 0, sy = 0;
  for (const r of G.runs) {
    sx += r.act.shake[0];
    sy += r.act.shake[1];
  }
  if (G.shakeT > 0) {
    const a = G.shakeAmp * (G.shakeT / (G.shake0 || 1));
    sx += Math.round((Math.random() * 2 - 1) * a);
    sy += Math.round((Math.random() * 2 - 1) * a);
  }
  const k = getScale();
  cv.style.transform = sx || sy ? "translate(" + sx * k + "px," + sy * k + "px)" : "";
}
