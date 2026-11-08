// Lanternfall relay (Cloudflare Worker + Durable Objects). It only relays messages; the host's browser runs hunts.
//   GET /rooms  GET /create(POST)  GET /ws?room=ID   party rooms (Room) listed by Lobby
//   GET /hub?ch=1..9   shared Hub channel (Hub, named hub_channel_N): every player in the hub sees the others in the same hub room
// Hub messages: client hello{name,cls} | s{x,y,d,a,hp,mh,c,r,pt} | away | ping
//               server welcome{you} | in{id,name,cls,pt,r,x,y,d,a,hp,mh} | s{id,...} | out{id} | near{n} | err{code}
// A player only receives messages from players in the SAME hub room (spatial filter). Deploy: cd server && npx wrangler deploy

const ORIGINS = ["https://mv6tb7pk95-jpg.github.io", "http://localhost:8000", "http://127.0.0.1:8000"];
const HUNTS = ["grave", "hollow", "slag"];
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ID_RE = /^[A-HJ-NP-Z2-9]{5}$/;
const HUB_MAX = 30;

const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
const num = (v, lo, hi, d = 0) => {
  v = Number(v);
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
};
const code = () => {
  const b = new Uint8Array(5);
  crypto.getRandomValues(b);
  return Array.from(b, (v) => CODE_CHARS[v % CODE_CHARS.length]).join("");
};

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin") || "";
    const okOrigin = !origin || ORIGINS.includes(origin);
    const cors = {
      "access-control-allow-origin": origin && okOrigin ? origin : ORIGINS[0],
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
      vary: "Origin",
    };
    const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "content-type": "application/json" } });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!okOrigin) return json({ error: "This site is not allowed." }, 403);

    if (url.pathname === "/rooms") {
      const r = await env.LOBBY.get(env.LOBBY.idFromName("main")).fetch("https://lobby/list");
      return json(await r.json());
    }

    if (url.pathname === "/create" && req.method === "POST") {
      let b;
      try {
        b = await req.json();
      } catch {
        return json({ error: "Bad request." }, 400);
      }
      if (!HUNTS.includes(b.hunt)) return json({ error: "Pick a hunt." }, 400);
      const info = { name: clean(b.name, 24) || "Party", hunt: b.hunt, pw: clean(b.pw, 16), pub: b.pub !== false, max: Math.round(num(b.max, 2, 4, 4)) };
      for (let i = 0; i < 5; i++) {
        const id = code();
        const r = await env.ROOM.get(env.ROOM.idFromName(id)).fetch("https://room/init", { method: "POST", body: JSON.stringify({ ...info, id }) });
        if (r.status === 200) return json({ id });
      }
      return json({ error: "Could not make a room. Try again." }, 500);
    }

    if (url.pathname === "/ws") {
      if (req.headers.get("Upgrade") !== "websocket") return json({ error: "Expected a WebSocket." }, 426);
      const id = (url.searchParams.get("room") || "").toUpperCase();
      if (!ID_RE.test(id)) return json({ error: "Bad room code." }, 400);
      return env.ROOM.get(env.ROOM.idFromName(id)).fetch(req);
    }

    if (url.pathname === "/hub") {
      if (req.headers.get("Upgrade") !== "websocket") return json({ error: "Expected a WebSocket." }, 426);
      const ch = url.searchParams.get("ch") || "1";
      if (!/^[1-9]$/.test(ch)) return json({ error: "Bad channel." }, 400);
      return env.HUB.get(env.HUB.idFromName("hub_channel_" + ch)).fetch(req);
    }

    return json({ ok: true, service: "lanternfall-relay" });
  },
};

export class Hub {
  constructor() {
    this.players = new Map(); // id -> { id, ws, name, cls, pt, r, st, ts }
    this.seq = 0;
  }

  async fetch() {
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    let me = null;
    server.addEventListener("message", (ev) => {
      if (typeof ev.data !== "string" || ev.data.length > 1024) return;
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (!m || typeof m.t !== "string") return;
      if (!me) {
        if (m.t === "hello") me = this.hello(server, m);
        return;
      }
      this.msg(me, m);
    });
    const bye = () => {
      if (me) this.drop(me);
      me = null;
    };
    server.addEventListener("close", bye);
    server.addEventListener("error", bye);
    return new Response(null, { status: 101, webSocket: client });
  }

  tx(p, o) {
    try {
      p.ws.send(JSON.stringify(o));
    } catch {}
  }

  peers(r, except) {
    return [...this.players.values()].filter((q) => q.r === r && q !== except);
  }

  near(r) {
    if (!r) return;
    const l = this.peers(r);
    for (const q of l) this.tx(q, { t: "near", n: l.length - 1 });
  }

  info(p) {
    return { id: p.id, name: p.name, cls: p.cls, pt: p.pt, r: p.r, ...p.st };
  }

  hello(ws, m) {
    if (this.players.size >= HUB_MAX) {
      try {
        ws.send(JSON.stringify({ t: "err", code: "full" }));
        ws.close(1000);
      } catch {}
      return null;
    }
    const p = { id: "h" + ++this.seq, ws, name: clean(m.name, 16) || "Hero", cls: clean(m.cls, 12), pt: "", r: "", st: null, ts: 0 };
    this.players.set(p.id, p);
    this.tx(p, { t: "welcome", you: p.id });
    return p;
  }

  leaveRoom(me) {
    const r = me.r;
    if (!r) return;
    me.r = "";
    for (const q of this.peers(r)) {
      this.tx(q, { t: "out", id: me.id });
      this.tx(me, { t: "out", id: q.id });
    }
    this.near(r);
    this.tx(me, { t: "near", n: 0 });
  }

  enter(me, r) {
    me.r = r;
    for (const q of this.peers(r, me)) {
      this.tx(me, { t: "in", ...this.info(q) });
      this.tx(q, { t: "in", ...this.info(me) });
    }
    this.near(r);
  }

  msg(me, m) {
    if (m.t === "away") return this.leaveRoom(me);
    if (m.t !== "s") return;
    const now = Date.now();
    if (now - me.ts < 60) return; // about 16 per second at most
    me.ts = now;
    const r = clean(m.r, 16);
    if (!/^[A-Za-z0-9_]{1,16}$/.test(r) || r === "run") return; // hub rooms only
    me.st = { x: num(m.x, -200, 6000), y: num(m.y, -1000, 3000), d: m.d < 0 ? -1 : 1, a: clean(m.a, 8), hp: num(m.hp, 0, 1e6), mh: num(m.mh, 1, 1e6, 1) };
    me.cls = clean(m.c, 12);
    me.pt = ID_RE.test(String(m.pt || "")) ? m.pt : "";
    if (me.r !== r) {
      this.leaveRoom(me);
      this.enter(me, r);
      return;
    }
    const s = JSON.stringify({ t: "s", id: me.id, ...me.st, c: me.cls, pt: me.pt });
    for (const q of this.peers(r, me)) {
      try {
        q.ws.send(s);
      } catch {}
    }
  }

  drop(me) {
    this.leaveRoom(me);
    this.players.delete(me.id);
  }
}

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.info = null;
    this.players = new Map();
    this.hostId = null;
    this.phase = "lobby";
    this.seq = 0;
    this.hb = null;
  }

  async load() {
    if (!this.info) this.info = (await this.state.storage.get("info")) || null;
    return this.info;
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/init") {
      if (await this.load()) return new Response("exists", { status: 409 });
      const b = await req.json();
      this.info = { id: b.id, name: b.name, hunt: b.hunt, pw: b.pw, pub: !!b.pub, max: b.max };
      await this.state.storage.put("info", this.info);
      await this.state.storage.setAlarm(Date.now() + 120000);
      return new Response("ok");
    }
    if (url.pathname === "/ws") {
      await this.load();
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      this.listen(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response("not found", { status: 404 });
  }

  async alarm() {
    if (this.players.size === 0) await this.close();
  }

  listen(ws) {
    let me = null;
    ws.addEventListener("message", (ev) => {
      if (typeof ev.data !== "string" || ev.data.length > 8192) return;
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (!m || typeof m.t !== "string") return;
      if (!me) {
        if (m.t === "hello") me = this.hello(ws, m);
        return;
      }
      this.msg(me, m);
    });
    const bye = () => {
      if (me) this.drop(me);
      me = null;
    };
    ws.addEventListener("close", bye);
    ws.addEventListener("error", bye);
  }

  pubInfo() {
    const i = this.info;
    return { id: i.id, name: i.name, hunt: i.hunt, pub: i.pub, max: i.max, locked: !!i.pw, phase: this.phase };
  }

  tx(p, o) {
    try {
      p.ws.send(JSON.stringify(o));
    } catch {}
  }

  all(o, except) {
    const s = JSON.stringify(o);
    for (const p of this.players.values()) {
      if (p.id === except) continue;
      try {
        p.ws.send(s);
      } catch {}
    }
  }

  lobby(path, body) {
    try {
      this.env.LOBBY.get(this.env.LOBBY.idFromName("main")).fetch("https://lobby" + path, { method: "POST", body }).catch(() => {});
    } catch {}
  }

  touch() {
    if (!this.info) return;
    const host = this.players.get(this.hostId);
    this.lobby("/reg", JSON.stringify({ ...this.pubInfo(), players: this.players.size, host: host ? host.name : "" }));
  }

  hello(ws, m) {
    const i = this.info;
    const err = (c) => {
      try {
        ws.send(JSON.stringify({ t: "err", code: c }));
        ws.close(1000);
      } catch {}
      return null;
    };
    if (!i) return err("none");
    if (i.pw && clean(m.pw, 16) !== i.pw) return err("pw");
    if (this.players.size >= i.max) return err("full");
    if (this.phase !== "lobby") return err("started");
    const id = "p" + ++this.seq;
    const p = { id, ws, name: clean(m.name, 16) || "Hero", cls: clean(m.cls, 12), ready: false, ts: 0, cs: 0 };
    this.players.set(id, p);
    if (!this.hostId || !this.players.has(this.hostId)) this.hostId = id;
    this.tx(p, {
      t: "welcome",
      you: id,
      host: this.hostId,
      room: this.pubInfo(),
      phase: this.phase,
      players: [...this.players.values()].map((q) => ({ id: q.id, name: q.name, cls: q.cls, ready: q.ready })),
    });
    this.all({ t: "join", p: { id, name: p.name, cls: p.cls, ready: false } }, id);
    if (this.players.size === 1) this.hb = setInterval(() => this.touch(), 30000);
    this.touch();
    return p;
  }

  msg(me, m) {
    const isHost = me.id === this.hostId;
    switch (m.t) {
      case "s": {
        const now = Date.now();
        if (now - me.ts < 30) return;
        me.ts = now;
        this.all(
          {
            t: "s", id: me.id,
            x: num(m.x, -200, 6000), y: num(m.y, -1000, 3000), d: m.d < 0 ? -1 : 1, a: clean(m.a, 12),
            hp: num(m.hp, 0, 1e6), mh: num(m.mh, 1, 1e6, 1), c: clean(m.c, 12), r: clean(m.r, 16),
          },
          me.id,
        );
        return;
      }
      case "chat": {
        const now = Date.now();
        if (now - me.cs < 800) return;
        me.cs = now;
        const text = clean(m.text, 80);
        if (text) this.all({ t: "chat", id: me.id, name: me.name, text });
        return;
      }
      case "ready":
        if (this.phase !== "lobby") return;
        me.ready = !!m.v;
        this.all({ t: "ready", id: me.id, v: me.ready });
        return;
      case "set":
        if (!isHost || this.phase !== "lobby") return;
        if (HUNTS.includes(m.hunt)) this.info.hunt = m.hunt;
        if (m.name !== undefined) this.info.name = clean(m.name, 24) || this.info.name;
        this.state.storage.put("info", this.info).catch(() => {});
        this.all({ t: "room", room: this.pubInfo() });
        this.touch();
        return;
      case "start":
        if (!isHost || this.phase !== "lobby") return;
        this.phase = "hunt";
        this.all({ t: "start", hunt: this.info.hunt, seed: (Math.random() * 2147483647) | 0, ids: [...this.players.keys()] });
        this.touch();
        return;
      case "hit": {
        if (isHost || this.phase !== "hunt") return;
        const host = this.players.get(this.hostId);
        if (host) this.tx(host, { t: "hit", id: me.id, m: num(m.m, 0, 1e6), d: num(m.d, 0, 1e5) });
        return;
      }
      case "mon": {
        if (!isHost || this.phase !== "hunt" || !Array.isArray(m.l)) return;
        const l = m.l
          .slice(0, 40)
          .map((e) => (Array.isArray(e) ? [num(e[0], 0, 1e6), clean(e[1], 8), num(e[2], -200, 6000), num(e[3], 0, 1e6), num(e[4], 1, 1e6, 1), e[5] < 0 ? -1 : 1] : null))
          .filter(Boolean);
        this.all({ t: "mon", k: num(m.k, 0, 1000), q: num(m.q, 0, 1000), l }, me.id);
        return;
      }
      case "end":
        if (!isHost || this.phase !== "hunt") return;
        this.phase = "lobby";
        for (const p of this.players.values()) p.ready = false;
        this.all({ t: "end", res: m.res === "win" ? "win" : "lose", kills: num(m.kills, 0, 1000) });
        this.touch();
        return;
      default:
        return;
    }
  }

  drop(me) {
    this.players.delete(me.id);
    if (this.players.size === 0) {
      this.close();
      return;
    }
    if (this.hostId === me.id) {
      this.hostId = this.players.keys().next().value;
      this.all({ t: "host", id: this.hostId });
    }
    this.all({ t: "leave", id: me.id });
    this.touch();
  }

  async close() {
    if (this.hb) clearInterval(this.hb);
    this.hb = null;
    const id = this.info && this.info.id;
    this.info = null;
    this.phase = "lobby";
    try {
      await this.state.storage.deleteAll();
    } catch {}
    if (id) this.lobby("/unreg", JSON.stringify({ id }));
  }
}

export class Lobby {
  constructor(state) {
    this.state = state;
    this.rooms = new Map();
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/reg") {
      const r = await req.json();
      this.rooms.set(r.id, { ...r, ts: Date.now() });
      return new Response("ok");
    }
    if (url.pathname === "/unreg") {
      const r = await req.json();
      this.rooms.delete(r.id);
      return new Response("ok");
    }
    if (url.pathname === "/list") {
      const now = Date.now();
      const out = [];
      for (const [id, r] of this.rooms) {
        if (now - r.ts > 90000) this.rooms.delete(id);
        else if (r.pub && r.players > 0) out.push(r);
      }
      out.sort((a, b) => b.ts - a.ts);
      return Response.json(out.slice(0, 50));
    }
    return new Response("not found", { status: 404 });
  }
}
