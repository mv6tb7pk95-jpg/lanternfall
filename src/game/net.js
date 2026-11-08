// Lanternfall multiplayer client (talks to server/relay.js; imports nothing from the game).
//   Party room (2-4 players, for hunts): net, listRooms, createRoom, joinRoom, leaveRoom, onNet, sendState, setReady, ...
//   Shared Hub channel (everyone in the hub): hub, hubConnected, joinHub, leaveHub, sendHubState, hubAway
//   stepRemotes(dt) smooths both crowds. The relay address: setRelay("https://....workers.dev") or DEFAULT_RELAY.
const LS_RELAY = "lf.relay", LS_NAME = "lf.name";
export const DEFAULT_RELAY = "";

const ls = {
  get(k) {
    try {
      return localStorage.getItem(k) || "";
    } catch {
      return "";
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

export const relayUrl = () => (ls.get(LS_RELAY) || DEFAULT_RELAY).replace(/\/+$/, "");

export function setRelay(u) {
  u = String(u || "").trim().replace(/\/+$/, "");
  if (u && !/^https:\/\/[^\s]+$/.test(u)) throw new Error("The relay address must start with https://");
  ls.set(LS_RELAY, u);
  return u;
}

export function getName() {
  let n = ls.get(LS_NAME);
  if (!n) {
    n = "Hero" + Math.floor(100 + Math.random() * 900);
    ls.set(LS_NAME, n);
  }
  return n;
}

export function setName(n) {
  n = String(n || "").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 16);
  if (n) ls.set(LS_NAME, n);
  return getName();
}

export const net = { ws: null, you: null, host: null, room: null, phase: "lobby", players: new Map() };
export const connected = () => !!net.ws && net.ws.readyState === 1 && !!net.you;
export const isHost = () => connected() && net.you === net.host;

const subs = new Set();
export function onNet(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
const emit = (t, d) => {
  for (const f of [...subs]) {
    try {
      f(t, d);
    } catch (e) {
      console.error(e);
    }
  }
};

const ERR = {
  pw: "Wrong password.",
  full: "The room is full.",
  started: "That hunt has already started.",
  none: "That room does not exist (any more).",
};

async function api(path, opts) {
  const base = relayUrl();
  if (!base) throw new Error("No relay server is set yet.");
  const r = await fetch(base + path, opts);
  let data = null;
  try {
    data = await r.json();
  } catch {}
  if (!r.ok) throw new Error((data && data.error) || "Server error " + r.status);
  return data;
}

export const listRooms = () => api("/rooms");
export const createRoom = (o) => api("/create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(o) });

// ---------------------------------------------------------------- party room
let ping = null;
function reset() {
  if (ping) clearInterval(ping);
  ping = null;
  net.ws = null;
  net.you = null;
  net.host = null;
  net.room = null;
  net.phase = "lobby";
  net.players.clear();
}

function addPlayer(p) {
  net.players.set(p.id, {
    id: p.id, name: p.name, cls: p.cls || "", ready: !!p.ready,
    x: 0, y: 0, d: 1, a: "idle", hp: 1, mh: 1, r: "", vx: 0, vy: 0, seen: false, t: 0,
  });
}

export function send(o) {
  if (connected()) net.ws.send(JSON.stringify(o));
}

export function joinRoom(id, pw = "", cls = "") {
  leaveRoom();
  const base = relayUrl();
  if (!base) return Promise.reject(new Error("No relay server is set yet."));
  id = String(id || "").trim().toUpperCase();
  return new Promise((resolve, reject) => {
    let done = false;
    let ws;
    try {
      ws = new WebSocket(base.replace(/^http/, "ws") + "/ws?room=" + encodeURIComponent(id));
    } catch {
      reject(new Error("The relay address is not valid."));
      return;
    }
    const tm = setTimeout(() => fail("The server did not answer."), 8000);
    const fail = (msg) => {
      if (done) return;
      done = true;
      clearTimeout(tm);
      if (net.ws === ws) reset();
      try {
        ws.close();
      } catch {}
      reject(new Error(msg));
    };
    net.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ t: "hello", name: getName(), cls, pw }));
    ws.onmessage = (ev) => {
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (!m || typeof m.t !== "string") return;
      if (!done) {
        if (m.t === "welcome") {
          done = true;
          clearTimeout(tm);
          net.you = m.you;
          net.host = m.host;
          net.room = m.room;
          net.phase = m.phase;
          net.players.clear();
          for (const p of m.players || []) addPlayer(p);
          ping = setInterval(() => send({ t: "ping" }), 25000);
          emit("welcome", net);
          resolve(net);
        } else if (m.t === "err") fail(ERR[m.code] || "Could not join.");
        return;
      }
      handle(m);
    };
    ws.onerror = () => fail("Could not reach the server.");
    ws.onclose = () => {
      if (!done) return fail("The connection closed.");
      if (net.ws === ws) {
        reset();
        emit("close", {});
      }
    };
  });
}

export function leaveRoom() {
  const ws = net.ws;
  reset();
  if (ws) {
    try {
      ws.close(1000);
    } catch {}
  }
}

function handle(m) {
  switch (m.t) {
    case "join":
      if (m.p && m.p.id) addPlayer(m.p);
      return emit("join", m.p);
    case "leave":
      net.players.delete(m.id);
      return emit("leave", m);
    case "host":
      net.host = m.id;
      return emit("host", m);
    case "room":
      net.room = m.room;
      return emit("room", m);
    case "ready": {
      const p = net.players.get(m.id);
      if (p) p.ready = !!m.v;
      return emit("ready", m);
    }
    case "start":
      net.phase = "hunt";
      return emit("start", m);
    case "end":
      net.phase = "lobby";
      for (const p of net.players.values()) p.ready = false;
      return emit("end", m);
    case "s": {
      const p = net.players.get(m.id);
      if (!p) return;
      p.x = m.x; p.y = m.y; p.d = m.d; p.a = m.a; p.hp = m.hp; p.mh = m.mh; p.r = m.r;
      if (m.c) p.cls = m.c;
      if (!p.seen) {
        p.seen = true;
        p.vx = p.x;
        p.vy = p.y;
      }
      p.t = performance.now();
      return;
    }
    case "chat":
    case "hit":
    case "mon":
      return emit(m.t, m);
    default:
      return;
  }
}

let lastS = 0;
export function sendState(s) {
  if (!connected()) return;
  const now = performance.now();
  if (now - lastS < 66) return;
  lastS = now;
  send({ t: "s", ...s });
}

// ---------------------------------------------------------------- shared Hub channel
// hub.players holds the players in OUR hub room only (the server filters). hub.near = how many others share our room.
export const hub = { ws: null, you: null, ch: 0, near: 0, players: new Map() };
export const hubConnected = () => !!hub.ws && hub.ws.readyState === 1 && !!hub.you;
let hubBusy = false, hubPing = null;

function hubReset() {
  if (hubPing) clearInterval(hubPing);
  hubPing = null;
  hub.ws = null;
  hub.you = null;
  hub.ch = 0;
  hub.near = 0;
  hub.players.clear();
}

const hubSend = (o) => {
  if (hubConnected()) hub.ws.send(JSON.stringify(o));
};

function hubMsg(m) {
  const now = performance.now();
  if (m.t === "in") {
    hub.players.set(m.id, {
      id: m.id, name: m.name, cls: m.cls || "", pt: m.pt || "", r: m.r, x: m.x, y: m.y, d: m.d, a: m.a, hp: m.hp, mh: m.mh,
      vx: m.x, vy: m.y, seen: true, t: now,
    });
  } else if (m.t === "s") {
    const p = hub.players.get(m.id);
    if (!p) return;
    p.x = m.x; p.y = m.y; p.d = m.d; p.a = m.a; p.hp = m.hp; p.mh = m.mh; p.pt = m.pt || "";
    if (m.c) p.cls = m.c;
    p.t = now;
  } else if (m.t === "out") hub.players.delete(m.id);
  else if (m.t === "near") hub.near = m.n | 0;
}

/** Resolves "ok", "full" (that channel is full) or "err"; rejects when the server cannot be reached. */
function openHub(ch, cls) {
  return new Promise((resolve, reject) => {
    let ws, done = false;
    try {
      ws = new WebSocket(relayUrl().replace(/^http/, "ws") + "/hub?ch=" + ch);
    } catch {
      reject(new Error("The relay address is not valid."));
      return;
    }
    const fin = (v, e) => {
      if (done) return;
      done = true;
      clearTimeout(tm);
      if (e || v !== "ok") {
        if (hub.ws === ws) hubReset();
        try {
          ws.close();
        } catch {}
      }
      e ? reject(e) : resolve(v);
    };
    const tm = setTimeout(() => fin(null, new Error("The server did not answer.")), 8000);
    hub.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ t: "hello", name: getName(), cls }));
    ws.onmessage = (ev) => {
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (!m || typeof m.t !== "string") return;
      if (!done) {
        if (m.t === "welcome") {
          hub.you = m.you;
          hub.ch = ch;
          hubPing = setInterval(() => hubSend({ t: "ping" }), 25000);
          fin("ok");
        } else if (m.t === "err") fin(m.code === "full" ? "full" : "err");
        return;
      }
      hubMsg(m);
    };
    ws.onerror = () => fin(null, new Error("Could not reach the server."));
    ws.onclose = () => {
      if (!done) return fin(null, new Error("The connection closed."));
      if (hub.ws === ws) hubReset();
    };
  });
}

/** Joins the first Hub channel (1 to 5) that has room. Resolves true when connected; never rejects. */
export async function joinHub(cls = "") {
  if (hubConnected() || hubBusy || !relayUrl()) return hubConnected();
  hubBusy = true;
  try {
    for (let ch = 1; ch <= 5; ch++) {
      const r = await openHub(ch, cls);
      if (r === "ok") return true;
      if (r !== "full") return false;
    }
    return false;
  } catch {
    return false;
  } finally {
    hubBusy = false;
  }
}

export function leaveHub() {
  const ws = hub.ws;
  hubReset();
  if (ws) {
    try {
      ws.close(1000);
    } catch {}
  }
}

/** { x, y, d, a, hp, mh, c, r (hub room id), pt (party room code or "") }. The caller sets the rate. */
export const sendHubState = (s) => hubSend({ t: "s", ...s });
/** Tell the channel we left the hub (a hunt started), so others stop drawing us. */
export const hubAway = () => hubSend({ t: "away" });

/** Smooths drawn positions (vx, vy) of both crowds toward the last position received. */
export function stepRemotes(dt) {
  const k = 1 - Math.exp(-12 * dt);
  for (const [map, me] of [[net.players, net.you], [hub.players, hub.you]]) {
    for (const p of map.values()) {
      if (p.id === me || !p.seen) continue;
      p.vx += (p.x - p.vx) * k;
      p.vy += (p.y - p.vy) * k;
    }
  }
}

export const setReady = (v) => send({ t: "ready", v: !!v });
export const setRoom = (o) => send({ t: "set", ...o });
export const startHunt = () => send({ t: "start" });
export const endHunt = (res, kills) => send({ t: "end", res, kills });
export const chat = (text) => send({ t: "chat", text });
export const sendHit = (m, d) => send({ t: "hit", m, d });
export const sendMonsters = (l, k, q) => send({ t: "mon", l, k, q });
