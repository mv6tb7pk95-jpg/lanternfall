// Lanternfall: the Party Board screen (markup built inside #party). Talks to the relay only through net.js.
// Start flow: the relay sends {start} to every member; begin() starts the run (retrying while the game is busy loading),
// then answers "go". Until "go" arrives the relay resends start, and an idle client asks "sync" every 4 s and when its tab returns.
import { G, fail } from "./state.js";
import { toast } from "./ui.js";
import { HUNTS } from "./hunts.js";
import { CLASSES } from "./skills.js";
import { beginRun } from "./run.js";
import { leave as leaveHub } from "./hub.js";
import { net, connected, isHost, onNet, send, listRooms, createRoom, joinRoom, leaveRoom, setReady, setRoom, startHunt as startShared, chat, relayUrl, setRelay, getName, setName } from "./net.js";

const CSS = `
#party .pb-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:flex-end;margin:8px 0}
#party .pb-f{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--mute);text-align:left}
#party input,#party select{background:var(--iron);color:var(--paper);border:2px solid var(--steel);border-radius:3px;padding:8px 10px;font:inherit;font-size:16px;min-width:0;max-width:100%}
#party input:focus,#party select:focus{outline:none;border-color:var(--amber);box-shadow:0 0 8px var(--glow)}
#party input[type=checkbox]{width:20px;height:20px;padding:0}
#party .pb-wide{width:min(560px,100%);margin:6px auto;box-sizing:border-box}
#party .pb-list{display:flex;flex-direction:column;gap:6px;width:min(560px,100%);margin:6px auto}
#party .pb-list .chap{text-align:left}
#party .pb-empty{color:var(--mute);font-size:13px;padding:10px;text-align:center}
#party .pb-mem{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:6px 10px;text-align:left}
#party .pb-tag{font-size:11px;padding:2px 6px;border:1px solid var(--steel);border-radius:2px;color:var(--mute)}
#party .pb-tag.ok{color:#8fe3a0;border-color:#4a9a5c}
#party .pb-log{max-height:96px;overflow:auto;text-align:left;font-size:12px;color:#c9cfdb}
#party .pb-msg{color:#ff9a8a;font-size:12px;min-height:16px;margin:4px 0}
#side button.on{border-color:var(--amber);box-shadow:0 0 10px var(--glow)}
@media(max-height:430px){#side button{height:36px}}
`;

const q = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const btn = (text, fn, cls = "btn small") => {
  const b = el("button", cls, text);
  b.type = "button";
  b.addEventListener("click", () => fn(b));
  return b;
};
const input = (o) => Object.assign(el("input"), o);
const field = (label, node) => {
  const l = el("label", "pb-f");
  l.append(el("span", "", label), node);
  return l;
};
const say = (t) => {
  const m = q("pMsg");
  if (m) m.textContent = t || "";
};

let view = "board", busy = false;
const chatLog = [];

async function run(fn) {
  if (busy) return;
  busy = true;
  say("");
  try {
    await fn();
  } catch (e) {
    say(e.message || String(e));
  } finally {
    busy = false;
  }
}

async function join(id, pw) {
  id = String(id || "").trim().toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{5}$/.test(id)) throw new Error("A room code has 5 letters or digits.");
  await joinRoom(id, pw, G.key || "");
  chatLog.length = 0;
  render();
}

// ---------------------------------------------------------------- shared hunt start
let pending = null, tries = 0, starting = false, doneSeed = null, tmr = null;

/** The relay said "start". Every member runs this, the host too. A repeat of an already started hunt only answers "go" again. */
function begin(m) {
  if (m.seed === doneSeed) {
    if (G.coop) send({ t: "go" });
    return;
  }
  if (pending && pending.seed === m.seed) return;
  pending = m;
  tries = 0;
  attempt();
}

function later() {
  clearTimeout(tmr);
  tmr = setTimeout(attempt, 400);
}

async function attempt() {
  const m = pending;
  if (!m || starting) return;
  const h = HUNTS[m.hunt];
  if (!h) {
    pending = null;
    return;
  }
  if (G.state === "play" || G.state === "dialogue") {
    if (G.coop && !G.coop.over) return void (pending = null); // already in a shared hunt
    pending = null;
    return void toast("Your party started a hunt, but you are in the middle of a run.", 4);
  }
  if (G.loading) {
    if (++tries > 40) pending = null; // gave up after about 16 s
    else later();
    return;
  }
  starting = true;
  try {
    if (G.state === "hub") leaveHub(); // stop the walking and remember where we stood
    const n = Array.isArray(m.ids) && m.ids.length ? m.ids.length : net.players.size;
    await beginRun(G.key || "warden", null, h, { host: isHost(), n });
    if (G.mode === "hunt" && G.coop) {
      doneSeed = m.seed;
      pending = null;
      send({ t: "go" });
    } else if (++tries <= 40) later();
    else pending = null;
  } catch (e) {
    pending = null;
    fail(e);
  } finally {
    starting = false;
  }
}

/** A member who is not in a run asks the relay whether a hunt is waiting for him (the relay ignores it otherwise). */
function askSync() {
  if (connected() && !starting && !pending && !(G.coop && G.state === "play")) send({ t: "sync" });
}
setInterval(askSync, 4000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) askSync();
});

function syncSide() {
  const b = document.querySelector('#side button[data-p="party"]');
  if (b) b.classList.toggle("on", connected());
}

async function refresh() {
  const set = (...n) => {
    const box = q("pList");
    if (box) box.replaceChildren(...n);
  };
  if (!relayUrl()) return set(el("div", "pb-empty", "Set the relay server address below to see rooms."));
  set(el("div", "pb-empty", "Loading rooms..."));
  try {
    const list = await listRooms();
    if (!Array.isArray(list) || !list.length) return set(el("div", "pb-empty", "No public rooms right now. Create one."));
    set(
      ...list.map((r) => {
        const h = HUNTS[r.hunt];
        const b = el("button", "chap");
        b.type = "button";
        const t = el("b", "", r.name), d = el("small", "", (h ? h.title : r.hunt) + " · " + r.players + "/" + r.max + (r.locked ? " · password" : "") + (r.host ? " · host " + r.host : "") + (r.phase === "hunt" ? " · in progress" : ""));
        b.append(t, d);
        b.disabled = r.phase === "hunt" || r.players >= r.max;
        b.addEventListener("click", () => {
          if (r.locked) {
            const c = q("pCode"), p = q("pPw");
            if (c) c.value = r.id;
            if (p) p.focus();
            say("This room needs a password. Type it, then press Join.");
          } else run(() => join(r.id, ""));
        });
        return b;
      })
    );
  } catch (e) {
    set(el("div", "pb-empty", "Could not load rooms: " + (e.message || e)));
  }
}

function boardView(body) {
  q("pSub").textContent = "Find a party or start your own. Co-op hunts take 2 to 4 players.";
  const nameIn = input({ value: getName(), maxLength: 16 });
  nameIn.addEventListener("change", () => (nameIn.value = setName(nameIn.value)));
  const top = el("div", "pb-row");
  top.append(field("Your name", nameIn), btn("Create room", () => { view = "create"; render(); }), btn("Refresh", () => refresh()));

  const code = input({ id: "pCode", placeholder: "ABCDE", maxLength: 5, size: 6 });
  code.addEventListener("input", () => (code.value = code.value.toUpperCase()));
  const pw = input({ id: "pPw", type: "password", placeholder: "if locked", maxLength: 16, size: 10, autocomplete: "off" });
  const joinRow = el("div", "pb-row");
  joinRow.append(field("Room code", code), field("Password", pw), btn("Join", () => run(() => join(code.value, pw.value))));

  const list = el("div", "pb-list");
  list.id = "pList";

  const srv = input({ id: "pRelay", value: relayUrl(), placeholder: "https://lanternfall-relay.NAME.workers.dev", size: 34 });
  const srvRow = el("div", "pb-row");
  srvRow.append(
    field("Relay server address", srv),
    btn("Save", () => {
      try {
        srv.value = setRelay(srv.value);
        say(srv.value ? "Server saved." : "Server cleared.");
        refresh();
      } catch (e) {
        say(e.message);
      }
    })
  );
  body.append(top, joinRow, el("h3", "", "Public rooms"), list, srvRow);
}

function createView(body) {
  q("pSub").textContent = "Make a room";
  const nameIn = input({ value: getName() + "'s party", maxLength: 24 });
  const pwIn = input({ type: "password", maxLength: 16, placeholder: "optional", autocomplete: "off" });
  const maxSel = el("select");
  for (const n of [2, 3, 4]) {
    const o = el("option", "", n + " players");
    o.value = String(n);
    maxSel.append(o);
  }
  maxSel.value = "4";
  const pub = input({ type: "checkbox", checked: true });
  let hunt = Object.keys(HUNTS)[0];
  const tabs = el("div", "pb-row"), note = el("div", "fbox pb-wide");
  const paint = () => {
    tabs.replaceChildren(...Object.entries(HUNTS).map(([id, h]) => btn(h.title, () => { hunt = id; paint(); }, "tab" + (id === hunt ? " on" : ""))));
    const h = HUNTS[hunt];
    note.textContent = h.title + ": defeat " + h.quota + " monsters, reward " + h.reward + " shards each.";
  };
  paint();
  const pubRow = el("label", "pb-row");
  pubRow.append(pub, document.createTextNode(" Public (listed on the board)"));
  const f1 = el("div", "pb-row");
  f1.append(field("Room name", nameIn), field("Password", pwIn), field("Size", maxSel));
  const go = el("div", "pb-row");
  go.append(
    btn("Create and join", () =>
      run(async () => {
        const o = await createRoom({ name: nameIn.value, hunt, pw: pwIn.value, pub: pub.checked, max: Number(maxSel.value) });
        view = "board";
        await join(o.id, pwIn.value);
      })
    ),
    btn("Cancel", () => { view = "board"; render(); refresh(); })
  );
  body.append(f1, el("b", "", "Hunting ground"), tabs, note, pubRow, go);
}

function roomView(body, keep) {
  const r = net.room, host = isHost(), me = net.players.get(net.you), h = HUNTS[r.hunt];
  q("pSub").textContent = r.name;

  const info = el("div", "fbox pb-wide");
  info.append(
    el("b", "", "Room " + r.id),
    document.createTextNode(" · " + (r.pub ? "public" : "private") + (r.locked ? " · password" : "") + " · up to " + r.max + " players"),
    document.createElement("br"),
    document.createTextNode("Hunt: " + (h ? h.title + " (defeat " + h.quota + ", reward " + h.reward + " shards; more for a bigger party)" : r.hunt))
  );
  const copy = () => {
    const c = navigator.clipboard;
    if (c && c.writeText) c.writeText(r.id).then(() => toast("Code copied."), () => toast("Code: " + r.id));
    else toast("Code: " + r.id);
  };
  const row0 = el("div", "pb-row");
  row0.append(btn("Copy code", copy));
  body.append(info, row0);

  if (host) {
    const tabs = el("div", "pb-row");
    tabs.append(...Object.entries(HUNTS).map(([id, x]) => btn(x.title, () => setRoom({ hunt: id }), "tab" + (id === r.hunt ? " on" : ""))));
    body.append(el("small", "", "You are the host. Pick the hunting ground:"), tabs);
  }

  body.append(el("h3", "", "Party (" + net.players.size + "/" + r.max + ")"));
  const mem = el("div", "pb-list");
  for (const p of net.players.values()) {
    const row = el("div", "fbox pb-mem");
    const cname = CLASSES[p.cls] ? CLASSES[p.cls].name : "no class yet";
    row.append(el("span", "", (p.id === net.host ? "★ " : "") + p.name + (p.id === net.you ? " (you)" : "") + " · " + cname), el("span", "pb-tag" + (p.ready ? " ok" : ""), p.ready ? "ready" : "not ready"));
    mem.append(row);
  }
  body.append(mem);

  const acts = el("div", "pb-row");
  acts.append(btn(me && me.ready ? "Not ready" : "Ready", () => setReady(!(me && me.ready)), "btn small"));
  if (host) {
    const waiting = [...net.players.values()].filter((p) => p.id !== net.host && !p.ready).length;
    const st = btn(waiting ? "Start hunt (" + waiting + " not ready)" : "Start hunt", () => startShared(), "btn small");
    st.disabled = net.phase !== "lobby" || waiting > 0;
    acts.append(st);
  }
  acts.append(btn("Leave room", () => { leaveRoom(); chatLog.length = 0; render(); refresh(); }));
  body.append(
    acts,
    el("div", "fbox pb-wide", host
      ? "Press Start hunt when everyone is ready. Everyone fights with the class they picked last (Warden if none). The party shares one kill count, and a hero who falls gets back up with half health."
      : "The host starts the hunt once everyone is ready. You fight with the class you picked last (Warden if none).")
  );

  const log = el("div", "fbox pb-wide pb-log");
  if (!chatLog.length) log.append(el("div", "pb-empty", "No messages yet."));
  for (const c of chatLog.slice(-8)) {
    const d = el("div");
    d.append(el("b", "", c.name + ": "), document.createTextNode(c.text));
    log.append(d);
  }
  const ci = input({ id: "pChat", maxLength: 80, placeholder: "Say something", size: 30 });
  const sendIt = () => {
    const t = ci.value.trim();
    if (t) {
      chat(t);
      ci.value = "";
    }
  };
  ci.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendIt();
    }
  });
  const cr = el("div", "pb-row");
  cr.append(ci, btn("Send", sendIt));
  body.append(log, cr);
  if (keep) {
    ci.value = keep.v;
    if (keep.f) ci.focus();
  }
  log.scrollTop = log.scrollHeight;
}

function render() {
  const body = q("pBody");
  if (!body) return;
  const c = q("pChat"), keep = c ? { v: c.value, f: document.activeElement === c } : null;
  body.replaceChildren();
  if (connected()) roomView(body, keep);
  else if (view === "create") createView(body);
  else boardView(body);
  syncSide();
}

export function renderParty() {
  if (!connected()) view = "board";
  say("");
  render();
  if (!connected()) refresh();
}

export function initParty() {
  const st = document.createElement("style");
  st.textContent = CSS;
  document.head.append(st);
  q("party").innerHTML =
    '<h2>Party Board</h2><p class="sub" id="pSub"></p><div id="pBody"></div><div class="pb-msg" id="pMsg"></div>' +
    '<button class="btn small" id="pBack">Back to the square</button><div style="height:24px"></div>';

  const nav = q("side");
  if (nav && !nav.querySelector('[data-p="party"]')) {
    const b = document.createElement("button");
    b.dataset.p = "party";
    b.title = "Party";
    b.setAttribute("aria-label", "Party");
    b.innerHTML = "<span>👥</span><small>Party</small>";
    nav.insertBefore(b, nav.querySelector('[data-p="settings"]'));
  }

  onNet((t, d) => {
    if (t === "start") begin(d);
    if (t === "end" || t === "close") pending = null;
    if (t === "chat") {
      chatLog.push({ name: d.name, text: d.text });
      if (chatLog.length > 30) chatLog.shift();
    }
    if (t === "close") {
      chatLog.length = 0;
      toast("Disconnected from the party.");
    }
    syncSide();
    const p = q("party");
    if (p && !p.hidden) {
      render();
      if (t === "close") refresh();
    }
  });
  render();
}
