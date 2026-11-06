// Lanternfall: combat rules. ALL damage to enemies goes through rollDamage(), so the weapon bonus, the +-8% variance
// and crits live in one place. Skills, the basic attack and the boss fight all call hurtEnemy().
// Three kinds of skill:
//   act skill         a pixelfx move played by startSkill; damage lands in a fixed zone at each real hit (zoneHit)
//   projectile skill  an act skill whose projectile is followed frame by frame and hurts the first enemy it touches
//                     (arrow, pistol, rocket, fireball, ice lance; the flight data is in projectile.js)
//   zone skill        one effect with no act (see zoneskill.js)
import { G, $ } from "./state.js";
import { GY } from "./world.js";
import { createFx } from "./px.js";
import { startSkill } from "./skills.js";
import { isZoneSkill, zoneCast, spawnZone, stepZone } from "./zoneskill.js";
import { prepared, attachFlights } from "./projectile.js";

/** Start a pixelfx effect that the game owns (a hit spark, an explosion...). Capped so the page stays fast. */
export function spawnFx(mod, o) {
  if (mod && G.fxs.length < 40) G.fxs.push(createFx(mod, o));
}

/** The whole world holds still for a moment (run.js counts it down). The longest request wins. */
export function hitStop(sec) {
  G.hitStop = Math.max(G.hitStop || 0, sec);
}

/** A short screen shake of `amp` px (run.js draws it). A stronger or longer one replaces a weaker one. */
export function shake(sec, amp) {
  if (sec > (G.shakeT || 0)) {
    G.shakeT = G.shake0 = sec;
    G.shakeAmp = amp;
  }
}

/** base damage -> final damage: weapon bonus, +-8% variance, 5% base crit chance (plus gear) for x1.5. */
export function rollDamage(base) {
  const st = G.st;
  let d = base * (1 + st.atk) * (0.92 + Math.random() * 0.16);
  if (Math.random() < 0.05 + st.crit) d *= 1.5;
  return Math.max(1, Math.round(d));
}

export function hurtEnemy(e, base, dir, push = 1) {
  if (e.dead) return;
  e.hp -= rollDamage(base);
  e.show = 2.5;
  e.kb = dir * 55 * Math.min(2.5, Math.abs(push)) * (e.boss ? 0.2 : 1); // a boss is hard to push around
  spawnFx(G.M["hit-spark"], { x: Math.round(e.x), y: GY, height: e.T.hy, flip: dir < 0, seed: 1 + (G.sparkN++ % 9) });
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  e.dead = true;
  const i = G.enemies.indexOf(e);
  if (i >= 0) G.enemies.splice(i, 1);
  G.kills++;
  $("kills").textContent = G.kills;
  spawnFx(G.M["small-explosion"], { x: Math.round(e.x), y: e.T.fly ? GY - 24 : GY, size: e.boss ? 0.9 : 0.45, seed: 3 + (G.sparkN++ % 7) });
  if (Math.random() < 0.15) G.got += 3 + Math.floor(Math.random() * 4); // a shard drop
  if (e.boss) {
    // when the boss falls, the helpers it called fall with it
    G.bossDown = true;
    G.queue = G.queue.filter((q) => !q.helper);
    for (const h of G.enemies.slice()) killEnemy(h);
  }
}

/** Returns true when the hero has died. */
export function hurtPlayer(dmg, fromX) {
  const p = G.player;
  p.hp -= dmg;
  p.hurt = 0.8;
  spawnFx(G.M["hit-spark"], { x: Math.round(p.x), y: GY, height: 22, flip: fromX > p.x, seed: 2 });
  return p.hp <= 0;
}

// called by the pixelfx act at the exact moment of each real hit of a skill
export function zoneHit(run, h) {
  if (run.fl) return scriptedHit(run); // a projectile skill: see below
  const z = run.skill.zone, lo = run.x + run.dir * z[0], hi = run.x + run.dir * z[1], a = Math.min(lo, hi), b = Math.max(lo, hi);
  for (const e of G.enemies.slice()) if (e.x + e.T.half >= a && e.x - e.T.half <= b) hurtEnemy(e, run.skill.dmg, run.dir, h.push ?? 1.2);
}

// ---------------------------------------------------------------- projectile skills
// The projectile's tip is followed from the hero out to where the move would land. The first enemy it touches is hurt
// at once, a blast also hurts what stands around the spot, the move's own picture of the projectile is hidden from then
// on, and the world holds still for a beat. If it touches nothing, it lands where the move shows it (a blast still
// hurts what stands around that spot). Enemies are matched on the ground line only, like the rest of the game.
const PAD = 4; // px added to an enemy's half-width, so a fast projectile can't slip between two frames

function impact(run, f, target, ix, atEnd) {
  const F = run.fl.cfg, h = run.fl.orig[f.i] || {}, s = run.skill;
  f.done = true;
  const victims = new Set(target ? [target] : []);
  if (F.splash) for (const e of G.enemies) if (Math.abs(e.x - ix) <= F.splash + e.T.half) victims.add(e);
  for (const e of victims) hurtEnemy(e, s.dmg, run.dir, h.push ?? 1.2);
  if (!atEnd) {
    // stopped early: the rest of the move's picture (the projectile still flying, its landing effect) is hidden
    const next = run.fl.list[f.i + 1];
    run.fl.cuts.push([run.act.t, next ? next.t0 : Infinity]);
    if (F.boom) spawnFx(G.M["small-explosion"], { x: Math.round(ix), y: GY, size: F.boom, seed: 3 + (G.sparkN++ % 7) });
  }
  if (victims.size) {
    hitStop(h.stop ?? 0.06);
    shake(h.shake ?? 0.1, h.amp ?? 2);
  }
}

/** Move one flight to where the projectile is at move time t; the first enemy in that stretch takes the hit. */
function sweep(run, f, t) {
  if (f.done || t < f.t0) return;
  const cur = f.at(Math.min(t, f.t1));
  const start = run.x + run.dir * f.prev, end = run.x + run.dir * cur;
  f.prev = cur;
  const lo = Math.min(start, end) - PAD, hi = Math.max(start, end) + PAD;
  let hit = null, best = Infinity;
  for (const e of G.enemies) {
    if (e.x + e.T.half < lo || e.x - e.T.half > hi) continue;
    const d = Math.abs(e.x - start); // the nearest one along the path is the one it hits
    if (d < best) {
      best = d;
      hit = e;
    }
  }
  if (hit) impact(run, f, hit, hit.x, false);
}

/** Called every frame by run.js (not while the world is held still). */
export function updateProjectiles() {
  for (const r of G.runs) if (r.fl) for (const f of r.fl.list) sweep(r, f, r.act.t);
}

// the move's own landing time: whatever stretch is left is swept now; if still nothing was touched, it lands at the end
function scriptedHit(run) {
  const f = run.fl.list[run.fl.n++];
  if (!f || f.done) return; // it already hit something on the way
  sweep(run, f, f.t1);
  if (!f.done) impact(run, f, null, run.x + run.dir * f.at(f.t1), true);
}

// ---------------------------------------------------------------- zone skills (one effect, no act)
/** One damage tick of a zone skill: everything standing in the area takes dmg x mul. */
function zoneTick(z, mul) {
  const s = z.skill, lo = z.x - s.half, hi = z.x + s.half;
  for (const e of G.enemies.slice()) if (e.x + e.T.half >= lo && e.x - e.T.half <= hi) hurtEnemy(e, s.dmg * mul, z.dir, s.push ?? 0.3);
}

/** Called every frame by run.js (not while the world is frozen by a hit-stop). */
export function updateZones(dt) {
  for (let i = G.zones.length - 1; i >= 0; i--) {
    const z = G.zones[i];
    stepZone(z, dt, zoneTick);
    if (z.fx.done() || z.t > 8) G.zones.splice(i, 1); // 8 s is only a safety net
  }
}

/** The skills the player can cast right now: the equipped loadout (G.skills, set by run.js), or the class's own skills. */
export function activeSkills() {
  return G.skills || (G.cls ? G.cls.skills : []);
}

export function cast(i) {
  if (G.state !== "play") return;
  const p = G.player, s = activeSkills()[i];
  if (!s || p.locked || p.y < -0.5 || G.cds[i] > 0) return;
  if (isZoneSkill(s)) {
    // he stays free to walk (at half speed) while the short cast pose plays; the effect runs on its own
    if (!G.mods[s.id] || G.zones.length >= 3) return;
    G.cds[i] = G.cdMax[i] = s.cd * (1 - G.st.cdr);
    p.atk = zoneCast(s);
    G.zones.push(spawnZone(G.mods[s.id], s, p));
    return;
  }
  if (G.runs.length >= 3) return;
  G.cds[i] = G.cdMax[i] = s.cd * (1 - G.st.cdr);
  p.locked = true;
  p.atk = null;
  const mod = G.mods[s.id];
  const run = startSkill(prepared(mod, s.id), s, p, zoneHit); // a projectile skill plays a copy without its own freeze
  attachFlights(run, mod, s.id); // no-op for skills that are not projectiles
  G.runs.push(run);
}
