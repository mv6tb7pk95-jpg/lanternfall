// Lanternfall: who else is here. Shows the other party members and keeps our own state flowing to them.
//
//   presenceTick()          called every frame by hud.js. Sends our state (net.js), smooths the others, updates the party panel.
//   drawRemotes(f, roomId)  called by the hub's drawProps (hub.js). Draws the other heroes standing in that room, with nametags.
//
// What is shown:
//   in the hub   the other heroes who are in the same room (they use the same skeleton hero as ours), a nametag and a small
//                health bar above each one. Our own nametag is drawn too.
//   party panel  a column on the left side of the screen (#pHud, built here) with a badge, name, class, place and health bar for
//                each member. It shows while connected to a party room, in the hub and during a run.
// Not yet: in a hunting ground the other heroes are not drawn (that comes with the hunt sync), and attack / skill poses of the
// others are drawn as standing. Only idle, run, jump and climb are drawn.
//
// The state we send: { x, y (feet, in room pixels), d (1 or -1), a (idle run jump climb attack skill), hp, mh, c (class key), r (place) }.
// r is the hub room id ("camp", "catacombs", ...) or "h:<hunt>" or "run". It is sent only when something changed, plus once a second.
import { G } from "./state.js";
import { net, connected, isHost, sendState, stepRemotes } from "./net.js";
import { drawPlayer } from "./entities.js";
import { pxRect, hex } from "./px.js";
import { GY } from "./world.js";
import { CLASSES } from "./skills.js";
import { ROOMS } from "./fieldmaps.js";

// ---------------------------------------------------------------- our own place and state
/** Where we are right now: the hub room, a hunt, or a run. */
function here() {
  const p = G.player;
  if (!p) return null;
  if (G.world && G.world.vertical) return { x: p.x, y: (p.gy ?? GY) + p.y, r: G.roomId || "" }; // the hub (feet y is gy + the jump offset)
  const h = G.mode === "hunt" && G.hunt ? "h:" + String(G.hunt.id || G.hunt.key || G.hunt.title).replace(/[^A-Za-z0-9]/g, "").slice(0, 10) : "run";
  return { x: p.x, y: GY + p.y, r: h };
}

function animOf(p) {
  if (p.climb) return "climb";
  if (p.atk) return "attack";
  if (G.runs && G.runs.length && !(G.world && G.world.vertical)) return "skill";
  if (p.y < -1) return "jump";
  if (p.moving) return "run";
  return "idle";
}

let lastSig = "", lastAt = 0;
function sendSelf(now) {
  const p = G.player, h = here();
  if (!p || !h || now - lastAt < 70) return;
  const s = { x: Math.round(h.x), y: Math.round(h.y), d: p.face < 0 ? -1 : 1, a: animOf(p), hp: Math.ceil(Math.max(0, p.hp)), mh: p.maxHp, c: G.key || "warden", r: h.r };
  const sig = [s.x, s.y, s.d, s.a, s.hp, s.mh, s.c, s.r].join("|");
  if (sig === lastSig && now - lastAt < 1000) return; // nothing changed: only a heartbeat once a second
  lastSig = sig;
  lastAt = now;
  sendState(s);
}

// ---------------------------------------------------------------- the others, drawn in the hub
const bodies = new Map(); // player id -> a hero object that entities.js drawPlayer() can draw

function bodyOf(p) {
  let b = bodies.get(p.id);
  if (!b) {
    b = { x: 0, gy: 0, y: 0, face: 1, hurt: 0, t: 0, moving: false, walk: 0, climb: null, climbT: 0, atk: null, r: "" };
    bodies.set(p.id, b);
  }
  return b;
}

function advance(dt) {
  for (const id of [...bodies.keys()]) if (!net.players.has(id)) bodies.delete(id);
  for (const p of net.players.values()) {
    if (p.id === net.you || !p.seen) continue;
    const b = bodyOf(p);
    if (b.r !== p.r) {
      b.r = p.r;
      p.vx = p.x; // he changed room: no sliding across the map
      p.vy = p.y;
    }
    const dy = Math.abs(p.y - p.vy);
    b.x = p.vx;
    b.gy = p.vy;
    b.face = p.d < 0 ? -1 : 1;
    b.t += dt;
    b.moving = p.a === "run";
    if (b.moving) b.walk += dt;
    b.climb = p.a === "climb" ? true : null;
    if (b.climb && dy > 0.5) b.climbT += dt; // the climbing pose moves only while he moves
    b.y = p.a === "jump" ? -2 : 0; // -2 gives the jump pose (entities.js uses it below -1)
  }
}

// a 3x5 pixel font for the nametags (my own tuning; lower case is drawn as capitals)
const GL = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111",
  F: "111100110100100", G: "011100101101011", H: "101101111101101", I: "111010010010111", J: "001001001101010",
  K: "101101110101101", L: "100100100100111", M: "101111111101101", N: "110101101101101", O: "010101101101010",
  P: "110101110100100", Q: "010101101111011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101", Y: "101101010010010",
  Z: "111001010100111", 0: "111101101101111", 1: "010110010010111", 2: "110001010100111", 3: "110001010001110",
  4: "101101111001001", 5: "111100110001110", 6: "011100111101111", 7: "111001010010010", 8: "111101111101111",
  9: "111101111001110", "-": "000000111000000", _: "000000000000111", ".": "000000000000010", "?": "110001010000010", " ": "000000000000000",
};
const C = {
  edge: hex("#0a0c12"), plate: hex("#161b27"), gold: hex("#c9993a"), steel: hex("#5a647c"),
  cream: hex("#f2e6c8"), host: hex("#f0bd4e"), me: hex("#9fd0ff"), back: hex("#2a1216"), fill: hex("#5fbf6a"), low: hex("#d8493e"),
};

function text(f, s, x, y, c) {
  for (let i = 0; i < s.length; i++) {
    const g = GL[s[i]] || GL["?"];
    for (let k = 0; k < 15; k++) if (g[k] === "1") pxRect(f, x + i * 4 + (k % 3), y + ((k / 3) | 0), 1, 1, c);
  }
}

/** A nametag with a small health bar, centred above feet at (cx, fy) in room pixels. */
function tag(f, name, cx, fy, host, mine, frac) {
  const s = String(name || "?").toUpperCase().slice(0, 12), w = s.length * 4 - 1, pw = w + 4;
  const x0 = Math.round(cx - pw / 2), y0 = Math.round(fy) - 56;
  pxRect(f, x0 - 1, y0 - 1, pw + 2, 9, mine ? C.steel : C.gold);
  pxRect(f, x0, y0, pw, 7, C.plate);
  text(f, s, x0 + 2, y0 + 1, host ? C.host : mine ? C.me : C.cream);
  frac = Math.max(0, Math.min(1, frac));
  pxRect(f, x0, y0 + 9, pw, 3, C.edge);
  pxRect(f, x0 + 1, y0 + 10, pw - 2, 1, C.back);
  pxRect(f, x0 + 1, y0 + 10, Math.round((pw - 2) * frac), 1, frac < 0.3 ? C.low : C.fill);
}

/** Draw the other party members standing in hub room roomId, and the nametags (ours too). */
export function drawRemotes(f, roomId) {
  if (!connected()) return;
  const now = performance.now();
  for (const p of net.players.values()) {
    if (p.id === net.you || !p.seen || p.r !== roomId || now - p.t > 4000) continue; // not here, or silent for 4 s
    const b = bodies.get(p.id);
    if (!b) continue;
    drawPlayer(f, b);
    tag(f, p.name, p.vx, p.vy, p.id === net.host, false, p.hp / p.mh);
  }
  const me = G.player, you = net.players.get(net.you);
  if (me && roomId === G.roomId) tag(f, you ? you.name : "YOU", me.x, (me.gy ?? GY) + me.y, isHost(), true, me.hp / me.maxHp);
}

// ---------------------------------------------------------------- the party panel (left side)
const CSS = `
#pHud{position:fixed;left:max(8px,env(safe-area-inset-left));top:50%;transform:translateY(-50%);z-index:15;width:148px;display:flex;flex-direction:column;gap:6px;pointer-events:none;font-family:"Pixelify Sans",ui-monospace,Menlo,Consolas,monospace}
#pHud[hidden]{display:none}
#pHud h4{margin:0 0 1px 2px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#d9a441;text-shadow:0 1px 2px #000}
#pHud .pm{display:flex;gap:6px;align-items:center;padding:5px 6px;background:linear-gradient(180deg,#1a1f2c,#0e121b);border:1px solid #3a4256;border-radius:3px;box-shadow:inset 0 0 0 1px #07090f,0 0 0 1px #c9993a44,0 2px 6px #000a}
#pHud .pm.me{border-color:#d9a441}
#pHud .pm.far{opacity:.62}
#pHud .pa{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:700;color:#f6ead0;border:2px solid #d9a441;box-shadow:inset 0 0 0 1px #000,0 0 6px #d9a44155;text-shadow:0 1px 1px #000}
#pHud .pi{min-width:0;flex:1}
#pHud .pn{font-size:11px;color:#f2e6c8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#pHud .pn em{font-style:normal;color:#f0bd4e;margin-left:3px}
#pHud .pc{font-size:9px;color:#9aa4b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#pHud .pb{position:relative;height:10px;margin-top:3px;background:#2a1216;border:1px solid #000;box-shadow:0 0 0 1px #4a3a22}
#pHud .pb i{position:absolute;inset:0 auto 0 0;width:100%;background:linear-gradient(180deg,#76d67f,#3d9c4d)}
#pHud .pb.low i{background:linear-gradient(180deg,#e8695c,#b32d2d)}
#pHud .pb span{position:absolute;inset:0;display:grid;place-items:center;font-size:8px;line-height:1;color:#fff;text-shadow:0 1px 1px #000}
@media (max-height:430px){#pHud{width:120px;gap:4px}#pHud .pm{padding:3px 4px}#pHud .pa{width:20px;height:20px;font-size:10px}#pHud .pn{font-size:10px}#pHud .pc{display:none}}
`;

let panel = null, structSig = "";
const rows = new Map(); // player id -> { el, pc, pb, fill, txt, last... }

const mk = (tagName, cls, txt) => {
  const e = document.createElement(tagName);
  if (cls) e.className = cls;
  if (txt) e.textContent = txt;
  return e;
};

function ensurePanel() {
  if (panel) return panel;
  const st = document.createElement("style");
  st.textContent = CSS;
  document.head.append(st);
  panel = mk("aside");
  panel.id = "pHud";
  panel.setAttribute("aria-label", "Party");
  panel.hidden = true;
  document.body.append(panel);
  return panel;
}

const classKey = (p) => (p.id === net.you ? G.key || p.cls : p.cls) || "";
const classLabel = (k) => (CLASSES[k] && CLASSES[k].name) || "";
const hue = (k) => {
  let h = 0;
  for (const ch of k || "?") h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
};
const where = (r) => (!r ? "" : r.startsWith("h:") ? "On a hunt" : r === "run" ? "In a run" : (ROOMS[r] && ROOMS[r].name) || "");

function build(list) {
  panel.textContent = "";
  rows.clear();
  panel.append(mk("h4", "", "Party"));
  for (const p of list) {
    const k = classKey(p), nm = classLabel(k);
    const el = mk("div", "pm" + (p.id === net.you ? " me" : "")), pa = mk("span", "pa", (nm[0] || "?").toUpperCase());
    pa.style.background = "hsl(" + hue(k) + " 42% 34%)";
    const info = mk("div", "pi"), pn = mk("div", "pn"), pc = mk("div", "pc"), pb = mk("div", "pb"), fill = mk("i"), txt = mk("span");
    pn.textContent = p.name;
    if (p.id === net.host) pn.append(mk("em", "", "★"));
    pb.append(fill, txt);
    info.append(pn, pc, pb);
    el.append(pa, info);
    panel.append(el);
    rows.set(p.id, { el, pc, pb, fill, txt, w: "", t: "", c: "", low: null, far: null, nm });
  }
}

function updatePanel() {
  ensurePanel();
  const list = [...net.players.values()].sort((a, b) => (a.id === net.you ? -1 : b.id === net.you ? 1 : 0));
  const sig = list.map((p) => [p.id, p.name, classKey(p), p.id === net.host ? 1 : 0].join(":")).join("|");
  if (sig !== structSig) {
    structSig = sig;
    build(list);
  }
  const h = here(), myR = h ? h.r : "";
  for (const p of list) {
    const row = rows.get(p.id);
    if (!row) continue;
    const mine = p.id === net.you, pl = G.player;
    let hp = p.hp, mh = p.mh, known = mine ? !!pl : p.seen;
    if (mine && pl) {
      hp = pl.hp;
      mh = pl.maxHp;
    }
    const frac = known ? Math.max(0, Math.min(1, hp / mh)) : 1;
    const w = Math.round(frac * 100) + "%", t = known ? Math.ceil(Math.max(0, hp)) + "/" + Math.round(mh) : "...";
    const far = !mine && p.seen && !!p.r && p.r !== myR;
    const loc = mine ? "" : p.seen ? where(p.r) : "";
    const c = [row.nm, loc].filter(Boolean).join(" · ");
    if (w !== row.w) row.fill.style.width = row.w = w;
    if (t !== row.t) row.txt.textContent = row.t = t;
    if (c !== row.c) row.pc.textContent = row.c = c;
    const low = known && frac < 0.3;
    if (low !== row.low) row.pb.classList.toggle("low", (row.low = low));
    if (far !== row.far) row.el.classList.toggle("far", (row.far = far));
  }
}

let lastT = performance.now(), panelOn = false;

/** Once per frame (hud.js calls it). Does nothing, cheaply, when we are not in a party room. */
export function presenceTick() {
  const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  const on = connected() && (G.state === "hub" || G.state === "play");
  if (!connected()) {
    structSig = "";
    bodies.clear();
  } else {
    stepRemotes(dt);
    advance(dt);
    sendSelf(now);
  }
  if (on) updatePanel();
  if (on !== panelOn) {
    panelOn = on;
    if (panel) panel.hidden = !on;
  }
}
