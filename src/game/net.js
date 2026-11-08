// Lanternfall: multiplayer client. It talks to the relay in server/relay.js and imports nothing from the game, so it cannot
// create an import loop. The screens (party board, party HUD, nametags) will call it; nothing calls it yet.
//
//   net            what we know right now: our id, the host's id, the room, the phase, and the other players
//   listRooms()    public rooms for the party board          createRoom({name, hunt, pw, pub, max}) -> { id }
//   joinRoom(id, pw, cls)   connects and resolves once the server has welcomed us      leaveRoom()
//   onNet(fn)      fn(type, data) for: welcome join leave host room ready start end chat hit mon close
//   sendState(s)   our position and health, sent at most every 66 ms (about 15 per second)
//   stepRemotes(dt)   smooths the other players' positions; call once per frame
//
// The relay address is set once after deploying the server: setRelay("https://lanternfall-relay.NAME.workers.dev").
// It is kept in this browser (localStorage), or put it in DEFAULT_RELAY below.
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

/** Save the relay address (an empty string clears it). */
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

/** Connect to a room. Resolves with `net` once the server has welcomed us; rejects with a readable message. */
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
          ping = setInterval(() => send({ t: "ping" }), 25000); // keeps an idle connection open
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
/** Our own state: { x, y, d (1 or -1), a (idle|run|attack|skill|jump|climb), hp, mh, c (class key), r (room id) }. */
export function sendState(s) {
  if (!connected()) return;
  const now = performance.now();
  if (now - lastS < 66) return;
  lastS = now;
  send({ t: "s", ...s });
}

/** Moves each other player's drawn position (vx, vy) toward the last position received. */
export function stepRemotes(dt) {
  const k = 1 - Math.exp(-12 * dt);
  for (const p of net.players.values()) {
    if (p.id === net.you || !p.seen) continue;
    p.vx += (p.x - p.vx) * k;
    p.vy += (p.y - p.vy) * k;
  }
}

export const setReady = (v) => send({ t: "ready", v: !!v });
export const setRoom = (o) => send({ t: "set", ...o });
export const startHunt = () => send({ t: "start" });
export const endHunt = (res, kills) => send({ t: "end", res, kills });
export const chat = (text) => send({ t: "chat", text });
export const sendHit = (m, d) => send({ t: "hit", m, d });
export const sendMonsters = (l, k, q) => send({ t: "mon", l, k, q });
