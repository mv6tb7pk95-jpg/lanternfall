// Lanternfall: game loop, input, waves and HUD. Every picture comes from the real pixelfx library (see px.js).
// It expects the elements defined in game.html: #view #status #select #cards #over #overTxt #retry
// #skills #hpFill #hpTxt #wave #kills and the [data-pad] buttons.
import { createFrame, clearFrame, composite, createFx, loadFx } from "./px.js";
import { VW, VH, GY, WORLD_W, createWorld } from "./world.js";
import { createPlayer, updatePlayer, drawPlayer, spawnEnemy, updateEnemy, drawEnemy, touching } from "./entities.js";
import { CLASSES, startSkill } from "./skills.js";

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fail = (e) => {
  const m = String((e && e.stack) || e);
  if (window.__lfShow) window.__lfShow(m);
  else console.error(m);
};
const setStatus = (t) => {
  $("status").textContent = t || "";
  $("status").hidden = !t;
};

const cv = $("view"), ctx = cv.getContext("2d");
cv.width = VW;
cv.height = VH;
const frame = createFrame(VW, VH, 0, 0);
const bytes = new Uint8ClampedArray(VW * VH * 4), img = new ImageData(bytes, VW, VH);

// the canvas is shown at a whole-number zoom so every game pixel stays square and crisp
let scale = 1;
function resizeView() {
  scale = Math.max(1, Math.floor(Math.min(innerWidth / VW, innerHeight / VH)));
  cv.style.width = VW * scale + "px";
  cv.style.height = VH * scale + "px";
}
addEventListener("resize", resizeView);
resizeView();

// ---------------------------------------------------------------- state
const G = {
  state: "select", loading: false, cls: null, player: null,
  enemies: [], runs: [], fxs: [], cds: [], cdEls: [], mods: {},
  wave: 0, kills: 0, time: 0, queue: [], gap: 1, cam: 0, sparkN: 0,
};
const inp = { left: false, right: false, jump: false };
let world, M; // M: the shared pixelfx effects (critters, hit spark, explosion)

// ---------------------------------------------------------------- class select
for (const [key, c] of Object.entries(CLASSES)) {
  const b = document.createElement("button");
  b.className = "card";
  b.innerHTML = "<b>" + c.name + "</b><small>" + c.blurb + "</small><small>HP " + c.hp + " · " + c.skills.length + " skills</small>";
  b.addEventListener("click", () => pick(key));
  $("cards").append(b);
}

async function pick(key) {
  if (G.loading) return;
  G.loading = true;
  const c = CLASSES[key];
  setStatus("Loading " + c.name + " skills from pixelfx…");
  try {
    await Promise.all(c.skills.map(async (s) => { G.mods[s.id] = await loadFx(s.path); }));
  } catch (e) {
    G.loading = false;
    setStatus("");
    return fail(e);
  }
  G.loading = false;
  setStatus("");
  startGame(c);
}

function startGame(c) {
  Object.assign(G, { cls: c, player: createPlayer(c), enemies: [], runs: [], fxs: [], cds: c.skills.map(() => 0), wave: 0, kills: 0, time: 0, queue: [], gap: 1, cam: 0, state: "play" });
  $("select").hidden = true;
  $("over").hidden = true;
  $("wave").textContent = "0";
  $("kills").textContent = "0";
  const bar = $("skills");
  bar.innerHTML = "";
  G.cdEls = [];
  c.skills.forEach((s, i) => {
    const b = document.createElement("button");
    b.innerHTML = '<span class="key">' + (i + 1) + '</span><span class="nm">' + s.name + '</span><i class="cd"></i>';
    b.addEventListener("pointerdown", (ev) => { ev.preventDefault(); cast(i); });
    bar.append(b);
    G.cdEls.push(b.querySelector(".cd"));
  });
}

$("retry").addEventListener("click", () => {
  Object.assign(G, { state: "select", player: null, enemies: [], runs: [], fxs: [], queue: [] });
  $("skills").innerHTML = "";
  $("over").hidden = true;
  $("select").hidden = false;
});

// ---------------------------------------------------------------- waves
function startWave() {
  G.wave++;
  const p = G.player;
  if (G.wave > 1) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.25);
  const n = 3 + G.wave * 2, kinds = G.wave < 2 ? ["slime"] : G.wave < 4 ? ["slime", "ghost"] : ["slime", "ghost", "bat"];
  for (let i = 0; i < n; i++) G.queue.push({ at: G.time + i * 0.9, type: kinds[i % kinds.length], side: i % 2 ? 1 : -1 });
  $("wave").textContent = G.wave;
}

function spawnQueued(q) {
  let x = q.side > 0 ? G.cam + VW + 24 : G.cam - 24;
  if (x < 10 || x > WORLD_W - 10) x = q.side > 0 ? G.cam - 24 : G.cam + VW + 24; // the other edge
  G.enemies.push(spawnEnemy(q.type, M[q.type], clamp(x, 10, WORLD_W - 10)));
}

// ---------------------------------------------------------------- combat
function spawnFx(mod, o) {
  if (G.fxs.length < 40) G.fxs.push(createFx(mod, o));
}

function hurtEnemy(e, dmg, dir, push) {
  e.hp -= dmg;
  e.show = 2.5;
  e.kb = dir * 55 * Math.min(2.5, Math.abs(push));
  spawnFx(M["hit-spark"], { x: Math.round(e.x), y: GY, height: e.T.fly || Math.round(e.T.h * 0.6), flip: dir < 0, seed: 1 + (G.sparkN++ % 9) });
  if (e.hp <= 0) {
    G.enemies.splice(G.enemies.indexOf(e), 1);
    G.kills++;
    $("kills").textContent = G.kills;
    spawnFx(M["small-explosion"], { x: Math.round(e.x), y: e.T.fly ? GY - 24 : GY, size: 0.45, seed: 3 + (G.sparkN++ % 7) });
  }
}

// called by the act at the exact moment of each real hit
function zoneHit(run, h) {
  const z = run.skill.zone, lo = run.x + run.dir * z[0], hi = run.x + run.dir * z[1], a = Math.min(lo, hi), b = Math.max(lo, hi);
  for (const e of G.enemies.slice()) if (e.x >= a && e.x <= b) hurtEnemy(e, run.skill.dmg, run.dir, h.push ?? 1.2);
}

function cast(i) {
  if (G.state !== "play") return;
  const p = G.player, s = G.cls.skills[i];
  if (!s || p.locked || p.y < -0.5 || G.cds[i] > 0 || G.runs.length >= 3) return;
  G.cds[i] = s.cd;
  p.locked = true;
  G.runs.push(startSkill(G.mods[s.id], s, p, zoneHit));
}

function die() {
  G.state = "dead";
  $("overTxt").textContent = "Wave " + G.wave + " · " + G.kills + " kills";
  $("over").hidden = false;
}

// ---------------------------------------------------------------- update
function update(dt) {
  world.update(dt, G.cam);
  if (G.state !== "play") return;
  const frozen = G.runs.some((r) => r.act.frozen); // hit-stop: the whole world holds still for a beat
  for (const r of G.runs) r.act.update(dt);
  for (const r of G.runs) {
    if (!r.free && r.act.t >= Math.min(r.freeAt, r.to)) {
      // control comes back; he stays where the move left him
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
  G.cds = G.cds.map((c) => Math.max(0, c - dt));

  if (!G.queue.length && !G.enemies.length) {
    G.gap -= dt;
    if (G.gap <= 0) {
      startWave();
      G.gap = 2.5;
    }
  }
  while (G.queue.length && G.queue[0].at <= G.time) spawnQueued(G.queue.shift());

  for (const e of G.enemies) {
    updateEnemy(e, dt, p);
    if (touching(e, p) && e.hitCd <= 0 && p.hurt <= 0) {
      p.hp -= e.T.dmg;
      p.hurt = 0.8;
      e.hitCd = 1.1;
      spawnFx(M["hit-spark"], { x: Math.round(p.x), y: GY, height: 22, flip: e.x > p.x, seed: 2 });
      if (p.hp <= 0) return die();
    }
  }
  for (const fx of G.fxs) fx.update(dt);
  G.fxs = G.fxs.filter((fx) => !fx.done());

  const target = clamp(Math.round(p.x - VW / 2), 0, WORLD_W - VW);
  G.cam = Math.round(G.cam + (target - G.cam) * Math.min(1, dt * 6));
}

// ---------------------------------------------------------------- draw
function draw() {
  frame.ox = G.cam | 0;
  clearFrame(frame);
  const bg = world.drawBg(frame.ox);
  world.drawProps(frame, frame.ox);
  for (const e of G.enemies) drawEnemy(frame, e);
  const p = G.player;
  if (p && !p.locked) drawPlayer(frame, p);
  // a skill in progress draws its effect, the hero (until control returns) and nothing else
  for (const r of G.runs) r.act.draw(frame, { body: !r.free, target: false });
  for (const fx of G.fxs) fx.draw(frame);
  composite(frame, bytes, bg, 1);
  ctx.putImageData(img, 0, 0);

  // the act's own screen shake, applied to the whole canvas
  let sx = 0, sy = 0;
  for (const r of G.runs) {
    const s = r.act.shake;
    sx += s[0];
    sy += s[1];
  }
  cv.style.transform = sx || sy ? "translate(" + sx * scale + "px," + sy * scale + "px)" : "";
}

function hud() {
  const p = G.player;
  if (!p) return;
  $("hpFill").style.width = Math.max(0, (p.hp / p.maxHp) * 100) + "%";
  $("hpTxt").textContent = Math.ceil(Math.max(0, p.hp)) + " / " + p.maxHp;
  G.cls.skills.forEach((s, i) => {
    G.cdEls[i].style.height = (G.cds[i] / s.cd) * 100 + "%";
  });
}

// ---------------------------------------------------------------- input
const KEYS = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
addEventListener("keydown", (e) => {
  const k = KEYS[e.key], jump = e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W";
  if (k || jump) e.preventDefault();
  if (e.repeat) return;
  if (k) inp[k] = true;
  else if (jump) inp.jump = true;
  else if (e.key >= "1" && e.key <= "9") cast(Number(e.key) - 1);
});
addEventListener("keyup", (e) => {
  const k = KEYS[e.key];
  if (k) inp[k] = false;
});
addEventListener("blur", () => { inp.left = inp.right = false; });
document.querySelectorAll("[data-pad]").forEach((b) => {
  const k = b.dataset.pad;
  const down = (ev) => {
    ev.preventDefault();
    if (k === "jump") inp.jump = true;
    else inp[k] = true;
  };
  const up = (ev) => {
    ev.preventDefault();
    if (k !== "jump") inp[k] = false;
  };
  b.addEventListener("pointerdown", down);
  b.addEventListener("pointerup", up);
  b.addEventListener("pointercancel", up);
  b.addEventListener("pointerleave", up);
});

// ---------------------------------------------------------------- boot
async function boot() {
  setStatus("Loading pixelfx effects…");
  world = await createWorld();
  M = {};
  await Promise.all(
    ["critters/slime", "critters/ghost", "critters/bat", "impacts/hit-spark", "explosions/small-explosion"].map(async (p) => {
      M[p.split("/")[1]] = await loadFx(p);
    })
  );
  setStatus("");
  window.__lfReady = true;
  let last = performance.now(), broken = false;
  const loop = (now) => {
    if (broken) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      update(dt);
      draw();
      hud();
    } catch (e) {
      broken = true;
      fail(e);
      return;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

boot().catch(fail);
