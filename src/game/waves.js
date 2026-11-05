// Lanternfall: what appears and when. Endless mode grows forever; story mode follows the chapter in story.js:
// its waves in order, then the boss. The boss calls helpers every few seconds and they die with it (combat.js).
import { G, $, clamp } from "./state.js";
import { VW, WORLD_W } from "./world.js";
import { spawnEnemy } from "./entities.js";
import { toast } from "./ui.js";

const endlessKinds = (w) =>
  w < 2 ? ["slime"] : w < 4 ? ["slime", "ghost"] : w < 6 ? ["slime", "ghost", "bat"] : w < 8 ? ["slime", "ghost", "bat", "snake"] : ["ghost", "bat", "snake", "wisp", "slime"];

export function startWave() {
  G.wave++;
  const p = G.player, ch = G.chapter;
  if (G.wave > 1) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.25);
  let n, kinds, scale, tint;
  if (G.mode === "story") {
    const w = ch.waves[G.wave - 1];
    n = w.n;
    kinds = w.kinds;
    scale = ch.scale;
    tint = ch.tint;
    $("wave").textContent = G.wave + "/" + ch.waves.length;
  } else {
    const k = 1 + (G.wave - 1) * 0.08; // a little tougher every wave
    n = Math.min(16, 3 + G.wave * 2);
    kinds = endlessKinds(G.wave);
    scale = { hp: k, dmg: k };
    tint = null;
    $("wave").textContent = G.wave;
  }
  for (let i = 0; i < n; i++) G.queue.push({ at: G.time + i * 0.9, type: kinds[i % kinds.length], side: i % 2 ? 1 : -1, scale, tint });
  toast("Wave " + G.wave, 1.4);
}

function spawnQueued(q) {
  let x = q.side > 0 ? G.cam + VW + 24 : G.cam - 24;
  if (x < 10 || x > WORLD_W - 10) x = q.side > 0 ? G.cam - 24 : G.cam + VW + 24; // the other edge
  const e = spawnEnemy(q.type, G.M[q.type], clamp(x, 10, WORLD_W - 10), { scale: q.scale, tint: q.tint });
  if (q.helper) e.helper = true;
  G.enemies.push(e);
}

function spawnBoss() {
  const B = G.chapter.boss;
  const x = clamp(G.player.x + (G.player.x < WORLD_W / 2 ? 1 : -1) * (VW / 2 + 40), 20, WORLD_W - 20);
  const e = spawnEnemy(B.type, G.M[B.type], x, { boss: B });
  G.enemies.push(e);
  G.boss = e;
  G.bossOut = true;
  G.bossT = B.summon.every;
  $("bossName").textContent = B.name;
  toast(B.name, 2.4);
}

function bossHelpers(dt) {
  if (!G.boss || G.bossDown) return;
  const B = G.chapter.boss;
  G.bossT -= dt;
  if (G.bossT > 0) return;
  G.bossT = B.summon.every;
  for (let i = 0; i < B.summon.n; i++)
    G.queue.push({ at: G.time + i * 0.6, type: B.summon.kinds[i % B.summon.kinds.length], side: i % 2 ? 1 : -1, scale: G.chapter.scale, tint: G.chapter.tint, helper: true });
}

/** Called every frame while playing: spawn what is due, and start the next wave or the boss when the field is empty. */
export function updateSpawns(dt) {
  if (G.mode === "story") bossHelpers(dt);
  const due = G.queue.filter((q) => q.at <= G.time);
  if (due.length) {
    G.queue = G.queue.filter((q) => q.at > G.time);
    due.forEach(spawnQueued);
  }
  if (G.queue.length || G.enemies.length) return;
  G.gap -= dt;
  if (G.gap > 0) return;
  G.gap = 2.5;
  if (G.mode === "endless") return startWave();
  if (G.wave < G.chapter.waves.length) return startWave();
  if (!G.bossOut) spawnBoss();
}
