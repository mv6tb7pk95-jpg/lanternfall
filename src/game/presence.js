// Lanternfall presence. Hub: we auto-join the shared Hub channel and draw EVERY player in our hub room (nametag, class gem, health).
// Party: the left-side panel (#pHud) still shows only our party room. Hunts use the party room (hunt sync comes later).
//   presenceTick()          every frame (hud.js): connect, send our state, smooth the others, update the panel
//   drawRemotes(f, roomId)  the hub's drawProps (hub.js): draws the other heroes in that room
import { G } from "./state.js";
import { net, hub, connected, hubConnected, isHost, getName, relayUrl, sendState, sendHubState, hubAway, joinHub, stepRemotes } from "./net.js";
import { drawPlayer } from "./entities.js";
import { pxRect, hex } from "./px.js";
import { GY } from "./world.js";
import { CLASSES } from "./skills.js";
import { ROOMS } from "./fieldmaps.js";

const MAX_DRAW = 14; // at most this many other heroes are drawn (the nearest ones)

function here() {
  const p = G.player;
  if (!p) return null;
  if (G.world && G.world.vertical) return { x: p.x, y: (p.gy ?? GY) + p.y, r: G.roomId || "", hub: !!G.roomId };
  const h = G.mode === "hunt" && G.hunt ? "h:" + String(G.hunt.id || G.hunt.key || G.hunt.title).replace(/[^A-Za-z0-9]/g, "").slice(0, 10) : "run";
  return { x: p.x, y: GY + p.y, r: h, hub: false };
}

function animOf(p) {
  if (p.climb) return "climb";
  if (p.atk) return "attack";
  if (G.runs && G.runs.length && !(G.world && G.world.vertical)) return "skill";
  if (p.y < -1) return "jump";
  if (p.moving) return "run";
  return "idle";
}

// ---------------------------------------------------------------- sending (party and hub each have their own rate gate)
const gateP = { sig: "", at: 0 }, gateH = { sig: "", at: 0 };
const due = (g, sig, now, min, hb) => {
  if (now - g.at < min || (sig === g.sig && now - g.at < hb)) return false;
  g.sig = sig;
  g.at = now;
  return true;
};
let hubIn = false;

function sendSelf(now) {
  const p = G.player, h = here();
  if (!p || !h) return;
  const s = { x: Math.round(h.x), y: Math.round(h.y), d: p.face < 0 ? -1 : 1, a: animOf(p), hp: Math.ceil(Math.max(0, p.hp)), mh: p.maxHp, c: G.key || "warden", r: h.r };
  const sig = [s.x, s.y, s.d, s.a, s.hp, s.mh, s.c, s.r].join("|");
  if (connected() && due(gateP, sig, now, 70, 1000)) sendState(s);
  if (!hubConnected()) {
    gateH.sig = "";
    hubIn = false;
    return;
  }
  if (h.hub) {
    hubIn = true;
    s.pt = (net.room && net.room.id) || "";
    // about 12 per second while someone is in our room, one every 2 s when we are alone (saves relay requests)
    if (due(gateH, sig + s.pt, now, 80, hub.near ? 1000 : 2000)) sendHubState(s);
  } else if (hubIn) {
    hubIn = false; // a hunt or run started: leave the hub room
    gateH.sig = "";
    hubAway();
  }
}

// ---------------------------------------------------------------- the others, drawn in the hub
const bodies = new Map();
const crowd = () => (hubConnected() ? hub.players : net.players);
const youId = () => (hubConnected() ? hub.you : net.you);

function bodyOf(p) {
  let b = bodies.get(p.id);
  if (!b) {
    b = { x: 0, gy: 0, y: 0, face: 1, hurt: 0, t: 0, moving: false, walk: 0, climb: null, climbT: 0, atk: null, r: "" };
    bodies.set(p.id, b);
  }
  return b;
}

function advance(dt) {
  const src = crowd();
  for (const id of [...bodies.keys()]) if (!src.has(id)) bodies.delete(id);
  for (const p of src.values()) {
    if (p.id === youId() || !p.seen) continue;
    const b = bodyOf(p);
    if (b.r !== p.r) {
      b.r = p.r;
      p.vx = p.x;
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
    if (b.climb && dy > 0.5) b.climbT += dt;
    b.y = p.a === "jump" ? -2 : 0;
  }
}

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
  edge: hex("#0a0c12"), plate: hex("#161b27"), gold: hex("#c9993a"), steel: hex("#5a647c"), dim: hex("#9aa4b8"),
  cream: hex("#f2e6c8"), host: hex("#f0bd4e"), me: hex("#9fd0ff"), back: hex("#2a1216"), fill: hex("#5fbf6a"), low: hex("#d8493e"),
};
// tag kinds: me (light blue), host / party (gold plate), other (steel plate, the rest of the hub)
const KIND = { me: [C.steel, C.me], host: [C.gold, C.host], party: [C.gold, C.cream], other: [C.steel, C.dim] };

const hue = (k) => {
  let h = 0;
  for (const ch of k || "?") h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
};
const gems = new Map();
function gem(k) {
  let c = gems.get(k);
  if (c === undefined) {
    const h = hue(k), s = 0.55, l = 0.55, a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const q = (n + h / 30) % 12;
      return Math.round(255 * (l - a * Math.max(-1, Math.min(q - 3, 9 - q, 1)))).toString(16).padStart(2, "0");
    };
    c = hex("#" + f(0) + f(8) + f(4));
    gems.set(k, c);
  }
  return c;
}

function text(f, s, x, y, c) {
  for (let i = 0; i < s.length; i++) {
    const g = GL[s[i]] || GL["?"];
    for (let k = 0; k < 15; k++) if (g[k] === "1") pxRect(f, x + i * 4 + (k % 3), y + ((k / 3) | 0), 1, 1, c);
  }
}

function tag(f, name, cx, fy, kind, frac, cls) {
  const [bd, tc] = KIND[kind] || KIND.other;
  const s = String(name || "?").toUpperCase().slice(0, 12), w = s.length * 4 - 1, pw = w + 4;
  const x0 = Math.round(cx - pw / 2), y0 = Math.round(fy) - 56;
  if (cls) {
    pxRect(f, x0 - 6, y0 - 1, 5, 9, C.edge); // class gem: its colour comes from the class key
    pxRect(f, x0 - 5, y0, 3, 7, gem(cls));
  }
  pxRect(f, x0 - 1, y0 - 1, pw + 2, 9, bd);
  pxRect(f, x0, y0, pw, 7, C.plate);
  text(f, s, x0 + 2, y0 + 1, tc);
  frac = Math.max(0, Math.min(1, frac));
  pxRect(f, x0, y0 + 9, pw, 3, C.edge);
  pxRect(f, x0 + 1, y0 + 10, pw - 2, 1, C.back);
  pxRect(f, x0 + 1, y0 + 10, Math.round((pw - 2) * frac), 1, frac < 0.3 ? C.low : C.fill);
}

export function drawRemotes(f, roomId) {
  const onHub = hubConnected();
  if (!onHub && !connected()) return;
  const now = performance.now(), me = G.player, list = [];
  const hostP = !onHub || !net.host ? null : net.players.get(net.host);
  for (const p of crowd().values()) {
    if (p.id !== youId() && p.seen && p.r === roomId && now - p.t < 4000 && bodies.has(p.id)) list.push(p);
  }
  if (me && list.length > MAX_DRAW) {
    list.sort((a, b) => Math.abs(a.vx - me.x) - Math.abs(b.vx - me.x));
    list.length = MAX_DRAW;
  }
  for (const p of list) {
    let kind;
    if (!onHub) kind = p.id === net.host ? "host" : "party";
    else if (p.pt && net.room && p.pt === net.room.id) kind = hostP && hostP.name === p.name ? "host" : "party";
    else kind = "other";
    drawPlayer(f, bodies.get(p.id));
    tag(f, p.name, p.vx, p.vy, kind, p.hp / p.mh, p.cls);
  }
  if (me && roomId === G.roomId) tag(f, getName(), me.x, (me.gy ?? GY) + me.y, "me", me.hp / me.maxHp, G.key);
}

// ---------------------------------------------------------------- the party panel (left side), party room only
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
const rows = new Map();

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

let lastT = performance.now(), panelOn = false, retryAt = 0, fails = 0;

export function presenceTick() {
  const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  // entering the hub joins the shared channel by itself (retries with a growing pause if the server is down)
  if (G.state === "hub" && !hubConnected() && relayUrl() && now >= retryAt) {
    retryAt = now + Math.min(30000, 3000 * 2 ** fails);
    joinHub(G.key || "warden").then((ok) => {
      fails = ok ? 0 : Math.min(fails + 1, 4);
    });
  }
  if (!connected()) structSig = "";
  if (!connected() && !hubConnected()) bodies.clear();
  else {
    stepRemotes(dt);
    advance(dt);
    sendSelf(now);
  }
  const on = connected() && (G.state === "hub" || G.state === "play");
  if (on) updatePanel();
  if (on !== panelOn) {
    panelOn = on;
    if (panel) panel.hidden = !on;
  }
}
