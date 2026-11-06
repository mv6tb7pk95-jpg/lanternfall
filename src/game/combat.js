// Lanternfall: combat rules. ALL damage to enemies goes through rollDamage(), so the weapon bonus, the +-8% variance
// and crits live in one place. Skills, the basic attack and the boss fight all call hurtEnemy().
// Two kinds of skill: an act skill (a pixelfx move played by startSkill) and a zone skill (one effect, see zoneskill.js).
import { G, $ } from "./state.js";
import { GY } from "./world.js";
import { createFx } from "./px.js";
import { startSkill } from "./skills.js";
import { isZoneSkill, zoneCast, spawnZone, stepZone } from "./zoneskill.js";

/** Start a pixelfx effect that the game owns (a hit spark, an explosion...). Capped so the page stays fast. */
export function spawnFx(mod, o) {
  if (mod && G.fxs.length < 40) G.fxs.push(createFx(mod, o));
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
  const z = run.skill.zone, lo = run.x + run.dir * z[0], hi = run.x + run.dir * z[1], a = Math.min(lo, hi), b = Math.max(lo, hi);
  for (const e of G.enemies.slice()) if (e.x + e.T.half >= a && e.x - e.T.half <= b) hurtEnemy(e, run.skill.dmg, run.dir, h.push ?? 1.2);
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
  G.runs.push(startSkill(G.mods[s.id], s, p, zoneHit));
}
