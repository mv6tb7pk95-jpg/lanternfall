// Lanternfall: co-op hunt sync. The HOST's browser runs the hunt (spawns, moves and kills monsters, counts kills).
// A guest spawns nothing: it draws "proxy" monsters from the host's snapshot (about 10 per second) and reports each hit it
// lands with sendHit (combat.js hurtEnemy). The host applies those hits (remoteHit) and the kills count for everybody.
//   scaleHunt(h, n)   a copy of a hunt for a party of n (more monsters, tougher, more to defeat)
//   initCoop(party)   run.js beginRun: the co-op state kept in G.coop
//   coopUpdate(dt)    every frame: the host sends its monster list, a guest applies the last one it got
//   stepProxy(e, dt)  a guest moves a proxy monster toward the host's position (instead of updateEnemy)
//   aimAt(e, p)       the host's monsters walk toward the nearest hero, not only the host
//   coopDown()        a hero at 0 HP is knocked down: back up with half health and 4 s of safety (nobody is out of the hunt)
//   coopEnd(won)      the host tells everybody the hunt is over
//   drawMates(f)      draws the other heroes on the hunt map (presence.js registers the drawer with setMates)
// Not checked against hits: a guest's hit report says which monster and how much damage, so a modified browser could cheat.
import { G, $, fail } from "./state.js";
import { net, onNet, sendMonsters, endHunt } from "./net.js";
import { spawnEnemy } from "./entities.js";
import { GY } from "./world.js";
import { spawnFx, remoteHit } from "./combat.js";
import { toast } from "./ui.js";

let snap = null, seq = 0, mates = null, bad = false;

// the same place id presence.js sends for a hunt ("h:grave")
const room = () => "h:" + String(G.hunt.id).replace(/[^A-Za-z0-9]/g, "").slice(0, 10);

onNet((t, m) => {
  const c = G.coop;
  if (t === "mon") snap = m;
  if (!c || G.state !== "play") return;
  if (t === "hit" && c.host) remoteHit(m.m, m.d);
  else if (t === "end" && !c.host && !c.over) {
    c.over = m.res === "win" ? "win" : "lose";
    G.kills = Math.max(G.kills, m.kills | 0);
  } else if (t === "leave" && !c.over && m.id === c.hostId) {
    c.over = "abort";
    toast("The host left. The hunt is over.", 3);
  }
});

export function scaleHunt(h, n) {
  const k = Math.max(1, Math.min(4, n | 0 || 1)) - 1;
  return {
    ...h,
    quota: Math.round(h.quota * (1 + 0.4 * k)),
    max: h.max + 2 * k,
    every: +(h.every * 0.8 ** k).toFixed(2),
    scale: { hp: +(h.scale.hp * (1 + 0.35 * k)).toFixed(2), dmg: h.scale.dmg },
  };
}

/** party: { host: bool, n: players }. If the party room is no longer in its hunt phase (it ended while we loaded), the run ends at once. */
export function initCoop(party) {
  snap = null;
  seq = 0;
  bad = false;
  return { host: !!party.host, n: party.n || 1, hostId: net.host, over: net.phase === "hunt" ? null : "abort", deaths: 0, t: 0, done: false, seen: null, lab: "" };
}

export function setMates(fn) {
  mates = fn;
}
export function drawMates(f) {
  if (mates && G.coop) mates(f);
}

export function aimAt(e, p) {
  const c = G.coop;
  if (!c || !c.room) return p;
  const now = performance.now();
  let best = p, d = Math.abs(e.x - p.x);
  for (const q of net.players.values()) {
    if (q.id === net.you || !q.seen || q.r !== c.room || now - q.t > 4000) continue;
    const dq = Math.abs(e.x - q.vx);
    if (dq < d) {
      d = dq;
      best = { x: q.vx };
    }
  }
  return best;
}

export function stepProxy(e, dt) {
  e.show = Math.max(0, e.show - dt);
  e.hitCd = Math.max(0, e.hitCd - dt);
  if (e.tx !== undefined) e.x += (e.tx - e.x) * (1 - Math.exp(-14 * dt));
  e.fx.options.x = Math.round(e.x);
  e.fx.options.flip = e.dir < 0;
  e.fx.update(dt);
}

export function coopDown() {
  const p = G.player;
  G.coop.deaths++;
  p.hp = Math.ceil(p.maxHp * 0.5);
  p.hurt = 4;
  toast("Knocked down! Back up with half health.", 2.2);
}

export function coopEnd(won) {
  const c = G.coop;
  if (!c || !c.host || c.done) return;
  c.done = true;
  sendMonsters([], G.kills, G.hunt.quota);
  endHunt(won ? "win" : "lose", G.kills);
}

function applySnap(c, s) {
  const h = G.hunt, seen = new Set();
  if (s.q) h.quota = s.q;
  for (const it of s.l) {
    const [id, type, x, hp, mh, d] = it;
    seen.add(id);
    let e = G.enemies.find((v) => v.nid === id);
    if (!e) {
      if (!G.M[type]) continue;
      try {
        e = spawnEnemy(type, G.M[type], x, { scale: h.scale, tint: h.tint });
      } catch (err) {
        if (!bad) {
          bad = true;
          fail(err);
        }
        continue;
      }
      e.nid = id;
      G.enemies.push(e);
    }
    if (hp < e.hp - 0.5) e.show = 2.5;
    e.hp = hp;
    e.maxHp = mh;
    e.tx = x;
    e.dir = d;
  }
  // a proxy that is no longer in the host's list was defeated
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (!e.nid || seen.has(e.nid)) continue;
    G.enemies.splice(i, 1);
    spawnFx(G.M["small-explosion"], { x: Math.round(e.x), y: e.T.fly ? GY - 24 : GY, size: 0.45, seed: 3 + (G.sparkN++ % 7) });
    if (Math.random() < 0.15) G.got += 3 + Math.floor(Math.random() * 4); // every hero rolls his own shard drop
  }
  if (s.k > G.kills) {
    G.kills = s.k;
    $("kills").textContent = G.kills;
  }
}

export function coopUpdate(dt) {
  const c = G.coop;
  if (!c || !G.hunt) return;
  c.room = room();
  if (c.host) {
    c.t -= dt;
    if (c.t > 0) return;
    c.t = 0.1;
    const l = G.enemies.slice(0, 40).map((e) => [e.nid || (e.nid = ++seq), e.type, Math.round(e.x), Math.max(1, Math.ceil(e.hp)), e.maxHp, e.fx.options.flip ? -1 : 1]);
    sendMonsters(l, G.kills, G.hunt.quota);
    return;
  }
  if (snap && snap !== c.seen) {
    c.seen = snap;
    applySnap(c, snap);
  }
  const h = G.hunt, lab = h.title + " " + Math.min(G.kills, h.quota) + "/" + h.quota + " · " + G.enemies.length + " on field";
  if (lab !== c.lab) {
    c.lab = lab;
    $("chName").textContent = lab;
  }
}
