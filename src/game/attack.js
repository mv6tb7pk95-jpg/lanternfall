// Lanternfall: the basic attack. It needs no cooldown skill: hold J / K / Z or the ATK button to repeat it.
// The data (which pixelfx effect, damage, timing) is in attacks.js. This file decides when it fires and who it hits.
import { G, inp } from "./state.js";
import { BASIC, spawnSwing, spawnShot, moveShot, spawnMissile } from "./attacks.js";
import { hurtEnemy } from "./combat.js";

function nearest(x, maxD) {
  let best = null, bd = maxD;
  for (const e of G.enemies) {
    const d = Math.abs(e.x - x);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

export function tryAttack() {
  const p = G.player;
  if (G.state !== "play" || !p || p.locked || p.atk || G.atkCd > 0) return;
  const b = BASIC[G.key];
  if (!b) return;
  let tx = 0;
  if (b.kind === "missile") {
    // the light bolt needs a target close enough to find
    const t = nearest(p.x, b.range);
    if (!t) return;
    tx = t.x;
    p.face = tx < p.x ? -1 : 1;
  } else if (!inp.left && !inp.right) {
    // no direction held: turn to the nearest enemy
    const n = nearest(p.x, 260);
    if (n) p.face = n.x < p.x ? -1 : 1;
  }
  p.atk = { b, pose: b.pose, t: 0, fired: false, tx };
  G.atkCd = b.cd * (1 - G.st.cdr);
}

function fire(p, a) {
  const b = a.b, mod = G.mods[b.path], dir = p.face;
  if (!mod) return;
  if (b.kind === "melee") {
    G.fxs.push(spawnSwing(mod, p.x, dir));
    const lo = p.x + dir * b.zone[0], hi = p.x + dir * b.zone[1], x0 = Math.min(lo, hi), x1 = Math.max(lo, hi);
    for (const e of G.enemies.slice()) if (e.x + e.T.half >= x0 && e.x - e.T.half <= x1) hurtEnemy(e, b.dmg, dir, 0.9);
  } else if (b.kind === "shot") {
    G.shots.push(spawnShot(mod, b, p.x, dir));
  } else {
    const d = a.tx < p.x ? -1 : 1;
    G.missiles.push({ fx: spawnMissile(mod, b, p.x, d, Math.abs(a.tx - p.x)), tx: a.tx, t: 0, delay: b.delay, dmg: b.dmg, dir: d, hit: false });
  }
}

export function updateAttack(dt) {
  const p = G.player;
  G.atkCd = Math.max(0, G.atkCd - dt);
  if (inp.atk) tryAttack();
  if (p.atk) {
    const a = p.atk;
    a.t += dt;
    if (!a.fired && a.t >= a.b.hitAt) {
      a.fired = true;
      fire(p, a);
    }
    if (a.t >= a.b.dur) p.atk = null;
  }
  // shots fly along the floor until they hit the first enemy or run out of range
  for (let i = G.shots.length - 1; i >= 0; i--) {
    const s = G.shots[i];
    let alive = moveShot(s, dt);
    const hit = G.enemies.find((e) => Math.abs(e.x - s.x) <= e.T.half + 6);
    if (hit) {
      hurtEnemy(hit, s.dmg, s.dir, 1);
      alive = false;
    }
    if (!alive) G.shots.splice(i, 1);
  }
  // a missile bursts where its target stood when it was cast
  for (let i = G.missiles.length - 1; i >= 0; i--) {
    const m = G.missiles[i];
    m.t += dt;
    m.fx.update(dt);
    if (!m.hit && m.t >= m.delay) {
      m.hit = true;
      for (const e of G.enemies.slice()) if (Math.abs(e.x - m.tx) <= e.T.half + 22) hurtEnemy(e, m.dmg, m.dir, 1);
    }
    if (m.fx.done() || m.t > 3) G.missiles.splice(i, 1);
  }
}

export function drawShots(f) {
  for (const s of G.shots) s.fx.draw(f);
  for (const m of G.missiles) m.fx.draw(f);
}
