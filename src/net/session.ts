// Multiplayer sessions. The host runs the authoritative simulation and streams field-level deltas;
// clients hold a mirror world, send commands, and render.
import type { World, PlayerInfo } from '../sim/world';
import type { Thing, FxEvent, Pawn } from '../sim/types';
import type { Session, Game } from '../game';
import { serializeWorld, deserializeWorld, gzip, gunzip } from '../sim/save';
import { applyCommand, type Command, type CmdResult } from '../sim/commands';
import { addColony } from '../sim/newgame';
import { openHost, connectClient, type Conn, type HostTransport } from './transport';
import { FIRST_PLAYER_FACTION, VERSION } from '../core/constants';
import { PLAYER_COLORS } from '../sim/world';
import { recomputeLight, updateCombinedLight } from '../sim/environment';
import { ensureRooms } from '../sim/rooms';
import { jobLabel } from '../sim/jobs';
import { BUILDINGS } from '../data/buildings';

const NET_INTERVAL = 100; // ms
const FX_KEEP = new Set(['text', 'muzzle', 'hit', 'explosion', 'dust', 'droppod', 'lightning', 'sound', 'letter', 'spark', 'launch', 'toss', 'zzz']);

function b64(u: Uint8Array) { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(u.subarray(i, i + 0x8000))); return btoa(s); }
function unb64(s: string) { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }

/** round floats so tiny changes don't churn the network */
function rnd(v: any): any {
  if (typeof v === 'number') return Number.isInteger(v) ? v : Math.round(v * 1000) / 1000;
  if (Array.isArray(v)) return v.map(rnd);
  if (v && typeof v === 'object') { const o: any = {}; for (const k in v) { if (k[0] === '_') continue; o[k] = rnd(v[k]); } return o; }
  return v;
}

/** network view of a thing (drops transient/volatile fields) */
function netView(w: World, t: Thing): Record<string, any> {
  const o: any = {};
  for (const k in t) {
    if (k[0] === '_') continue;
    const v = (t as any)[k];
    if (t.kind === 'pawn') {
      if (k === 'queue' || k === 'thoughts' && false) continue;
      if (k === 'job') { const j = v; o.job = j ? { type: j.type, t: j.t, t2: j.t2, c: j.c, bill: j.bill, s: j.s, forced: j.forced, data: j.data && (j.data.foodDef || j.data.kind || j.data.harvest || j.data.plant || j.data.capture) ? { foodDef: j.data.foodDef, kind: j.data.kind, harvest: j.data.harvest, plant: j.data.plant, capture: j.data.capture } : undefined } : null; continue; }
      if (k === 'mp') { o.mp = Math.round(v * 20) / 20; continue; }
    }
    if (t.kind === 'building' && k === 'users') { o.users = v && v.length ? v : undefined; continue; }
    o[k] = rnd(v);
  }
  if (t.kind === 'pawn') o.jobLabel = jobLabel(w, t);
  return o;
}

interface ClientInfo { conn: Conn; slot: number; token: string; ready: boolean; lastPing: number }

// =====================================================================
export class HostSession implements Session {
  isHost = true;
  w: World;
  faction: number;
  maxPlayers: number;
  transport: HostTransport | null = null;
  clients: ClientInfo[] = [];
  roomCode = '';
  status = '';
  game?: Game;
  last = new Map<number, Record<string, string>>();
  lastGlobals: Record<string, string> = {};
  lastLetter = 0; lastChat = 0;
  pendingFx: FxEvent[] = [];
  lastNet = 0;
  rr = 0;
  pendingSnap: ClientInfo[] = [];

  constructor(w: World, faction: number, maxPlayers: number) {
    this.w = w; this.faction = faction; this.maxPlayers = Math.max(2, Math.min(4, maxPlayers));
    w.settings.maxPlayers = this.maxPlayers;
    const me = w.playerByFaction(faction);
    if (me) { me.isHost = true; me.connected = true; }
    for (const p of w.players) if (p.faction !== faction) p.connected = false;
  }

  async open() {
    this.transport = await openHost(c => this.onConn(c));
    this.roomCode = this.transport.code;
    this.status = 'Room open';
    // baseline so first delta isn't the whole world
    this.primeBaseline();
  }

  primeBaseline() {
    for (const t of this.w.things.values()) this.last.set(t.id, this.fieldStrings(netView(this.w, t)));
    this.lastLetter = this.w.letters.length ? this.w.letters[this.w.letters.length - 1].id : 0;
    this.lastChat = this.w.chat.length;
    this.w.map.dirty.clear();
    this.w.removed = [];
    this.lastGlobals = {};
    this.globals(true);
  }
  fieldStrings(o: Record<string, any>) { const r: Record<string, string> = {}; for (const k in o) r[k] = JSON.stringify(o[k]); return r; }

  onConn(c: Conn) {
    const info: ClientInfo = { conn: c, slot: -1, token: '', ready: false, lastPing: performance.now() };
    c.onMessage = (s) => { try { this.onMsg(info, JSON.parse(s)); } catch (e) { console.warn('bad msg', e); } };
    c.onClose = () => {
      this.clients = this.clients.filter(x => x !== info);
      const pl = this.w.players.find(p => p.slot === info.slot);
      if (pl) { pl.connected = false; this.game?.ui?.toast(`${pl.name} disconnected`); }
    };
  }

  onMsg(c: ClientInfo, m: any) {
    const w = this.w;
    switch (m.t) {
      case 'hello': {
        if (m.v !== VERSION) { c.conn.send(JSON.stringify({ t: 'kick', reason: `Version mismatch (host ${VERSION}, you ${m.v}). Refresh the page.` })); return; }
        let pl = w.players.find(p => p.token && p.token === m.token);
        if (!pl) {
          const used = new Set(w.players.map(p => p.slot));
          let slot = -1;
          for (let s = 0; s < this.maxPlayers; s++) if (!used.has(s)) { slot = s; break; }
          if (slot < 0) {
            // reclaim a disconnected, never-started slot
            const free = w.players.find(p => !p.connected && !p.started && !p.isHost);
            if (free) slot = free.slot;
          }
          if (slot < 0) { c.conn.send(JSON.stringify({ t: 'kick', reason: 'This game is full.' })); return; }
          pl = w.players.find(p => p.slot === slot);
          if (!pl) {
            pl = { slot, faction: FIRST_PLAYER_FACTION + slot, name: String(m.name || 'Player').slice(0, 16), colonyName: String(m.colony || 'Outpost').slice(0, 24), color: PLAYER_COLORS[slot % 4], connected: true, token: m.token || String(Math.random()), speed: 1, started: false };
            w.players.push(pl);
          }
        }
        if (pl.connected && this.clients.some(x => x.slot === pl!.slot && x !== c)) { c.conn.send(JSON.stringify({ t: 'kick', reason: 'That player is already connected.' })); return; }
        pl.connected = true;
        if (!pl.started) { pl.name = String(m.name || pl.name).slice(0, 16); pl.colonyName = String(m.colony || pl.colonyName).slice(0, 24); }
        c.slot = pl.slot; c.token = pl.token;
        this.clients.push(c);
        c.conn.send(JSON.stringify({ t: 'welcome', slot: pl.slot, faction: pl.faction, started: pl.started, token: pl.token }));
        this.pendingSnap.push(c);
        this.game?.ui?.toast(`${pl.name} joined`, 'good');
        break;
      }
      case 'start': {
        const pl = w.players.find(p => p.slot === c.slot);
        if (!pl) return;
        if (pl.started && w.colonists(pl.faction).length) { c.conn.send(JSON.stringify({ t: 'res', id: m.id, ok: true, msg: String(pl.faction) })); return; }
        try {
          addColony(w, { slot: pl.slot, playerName: pl.name, colonyName: pl.colonyName, colonists: m.pawns || [], site: m.site, token: pl.token, pet: m.pet });
          w.letter(0, 'New colony', `${pl.name} has landed and founded ${pl.colonyName}!`, 'info', pl.startX, pl.startY);
          c.conn.send(JSON.stringify({ t: 'res', id: m.id, ok: true, msg: String(pl.faction) }));
        } catch (e) { c.conn.send(JSON.stringify({ t: 'res', id: m.id, ok: false, msg: String(e) })); }
        break;
      }
      case 'cmd': {
        const pl = w.players.find(p => p.slot === c.slot);
        if (!pl) return;
        const r = applyCommand(w, pl.faction, m.c);
        c.conn.send(JSON.stringify({ t: 'res', id: m.id, ok: r.ok, msg: r.msg }));
        break;
      }
      case 'speed': { const pl = w.players.find(p => p.slot === c.slot); if (pl) pl.speed = Math.max(0, Math.min(4, m.s | 0)); break; }
      case 'ping': { c.lastPing = performance.now(); c.conn.send(JSON.stringify({ t: 'pong', ts: m.ts })); const pl = w.players.find(p => p.slot === c.slot); if (pl && m.rtt) pl.ping = Math.round(m.rtt); break; }
    }
  }

  setSpeed(s: number) { const me = this.w.playerByFaction(this.faction); if (me) me.speed = s; }
  sendCmd(c: Command): Promise<CmdResult> { return Promise.resolve(applyCommand(this.w, this.faction, c)); }

  hostFrame(fx: FxEvent[]) {
    for (const e of fx) if (FX_KEEP.has(e.k)) this.pendingFx.push(e);
    if (this.pendingFx.length > 300) this.pendingFx.splice(0, this.pendingFx.length - 300);
    const now = performance.now();
    if (now - this.lastNet < NET_INTERVAL) return;
    this.lastNet = now;
    if (!this.clients.length) { this.pendingFx = []; this.primeIfIdle(); return; }
    const delta = this.buildDelta();
    const s = JSON.stringify(delta);
    for (const c of this.clients) if (c.ready) c.conn.send(s);
    // snapshots for newcomers, taken right after the delta so baselines agree
    if (this.pendingSnap.length) {
      const list = this.pendingSnap; this.pendingSnap = [];
      const json = JSON.stringify(serializeWorld(this.w));
      gzip(json).then(u => {
        const msg = JSON.stringify({ t: 'snap', z: b64(u), tick: this.w.tick });
        for (const c of list) { c.conn.send(msg); c.ready = true; }
      });
    }
  }
  private idleFrames = 0;
  primeIfIdle() { if (++this.idleFrames % 20 === 0) this.primeBaseline(); }

  buildDelta() {
    const w = this.w;
    const things: any[] = [];
    const seen = new Set<number>();
    const consider = (t: Thing, force = false) => {
      seen.add(t.id);
      const view = netView(w, t);
      const prev = this.last.get(t.id);
      if (!prev) { things.push({ ...view, _n: 1 }); this.last.set(t.id, this.fieldStrings(view)); return; }
      if (t.kind === 'projectile') return;
      const ch: any = {};
      let any = false;
      for (const k in view) { const s = JSON.stringify(view[k]); if (prev[k] !== s) { ch[k] = view[k]; prev[k] = s; any = true; } }
      for (const k in prev) if (!(k in view)) { ch[k] = null; delete prev[k]; any = true; }
      if (any) { ch.id = t.id; ch.kind = t.kind; things.push(ch); }
    };
    for (const p of w.pawns.values()) consider(p);
    for (const p of w.projectiles.values()) consider(p);
    for (const f of w.fires.values()) consider(f);
    // round-robin through the rest
    const rest: Thing[] = [];
    for (const t of w.items.values()) rest.push(t);
    for (const t of w.buildings.values()) rest.push(t);
    for (const t of w.blueprints.values()) rest.push(t);
    const slice = Math.max(40, Math.ceil(rest.length / 8));
    // always consider brand-new ones
    for (const t of rest) if (!this.last.has(t.id)) consider(t);
    for (let k = 0; k < slice && rest.length; k++) { const t = rest[(this.rr + k) % rest.length]; if (!seen.has(t.id)) consider(t); }
    this.rr = (this.rr + slice) % Math.max(1, rest.length);
    // doors & turrets change visually often: check every frame
    for (const b of w.buildings.values()) { const d = BUILDINGS[b.def]; if ((d.isDoor || d.turret || d.power || d.fuel || d.bench) && !seen.has(b.id)) consider(b); }
    const rm = w.removed; w.removed = [];
    for (const id of rm) this.last.delete(id);
    const tiles: number[][] = [];
    for (const i of w.map.dirty) tiles.push(w.map.tileRecord(i));
    w.map.dirty.clear();
    const fx = this.pendingFx; this.pendingFx = [];
    return { t: 'delta', tick: w.tick, sp: w.speed, th: things, rm, tl: tiles, g: this.globals(false), fx };
  }

  globalsT = 0;
  globals(force: boolean): any {
    const w = this.w;
    const now = performance.now();
    const out: any = {};
    const put = (k: string, v: any) => { const s = JSON.stringify(v); if (this.lastGlobals[k] !== s) { this.lastGlobals[k] = s; out[k] = v; } };
    put('weather', w.weather); put('temp', Math.round(w.outdoorTemp * 10) / 10);
    put('players', w.players.map(p => ({ ...p, token: undefined })));
    if (force || now - this.globalsT > 450) {
      this.globalsT = now;
      put('factions', w.factions); put('research', w.research); put('diplomacy', w.diplomacy); put('conditions', w.conditions);
      put('zones', [...w.zones.values()]); put('lords', [...w.lords.values()]);
      put('story', Object.fromEntries(Object.entries(w.story).map(([k, v]) => [k, { wealth: Math.round(v.wealth) }])));
      put('orbital', (w as any).orbital || {}); put('p2p', (w as any).p2p || []); put('offers', (w as any).diploOffers || []);
      put('history', w.history.slice(-80)); put('settings', w.settings);
      ensureRooms(w);
      put('rooms', w.rooms.filter(r => !r.outdoors).map(r => [w.map.idx(r.x0, r.y0) + firstCellOffset(w, r), Math.round(r.temp * 10) / 10]));
    }
    // letters & chat as appends
    const newL = w.letters.filter(l => l.id > this.lastLetter);
    if (newL.length) { out.letters = newL; this.lastLetter = newL[newL.length - 1].id; }
    if (w.chat.length !== this.lastChat) { out.chat = w.chat.slice(Math.max(0, this.lastChat)); this.lastChat = w.chat.length; if (out.chat.length > 50) out.chat = out.chat.slice(-50); }
    return out;
  }

  clientFrame(): FxEvent[] { return []; }
  close() { this.transport?.close(); for (const c of this.clients) c.conn.close(); }
}

function firstCellOffset(w: World, r: import('../sim/rooms').Room): number {
  // find a cell that belongs to the room (top-left may be a wall-enclosed corner)
  const m = w.map;
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (m.roomId[m.idx(x, y)] === r.id) return m.idx(x, y) - m.idx(r.x0, r.y0);
  return 0;
}

// =====================================================================
export class ClientSession implements Session {
  isHost = false;
  conn: Conn | null = null;
  world: World | null = null;
  slot = -1;
  myFaction = 0;
  started = false;
  roomCode = '';
  status = '';
  game?: Game;
  private reqId = 1;
  private pending = new Map<number, (r: CmdResult) => void>();
  private queue: any[] = [];
  private fx: FxEvent[] = [];
  private pingT = 0;
  private rtt = 0;
  private lostAt = 0;

  async connect(code: string, name: string, colony: string, status: (s: string) => void): Promise<World> {
    this.roomCode = code;
    const tokKey = 'sf_tok_' + code;
    let token = '';
    try { token = localStorage.getItem(tokKey) || ''; } catch { /* */ }
    if (!token) { token = Math.random().toString(36).slice(2) + Date.now().toString(36); try { localStorage.setItem(tokKey, token); } catch { /* */ } }
    this.conn = await connectClient(code, status);
    status('Joining…');
    return new Promise<World>((res, rej) => {
      const to = setTimeout(() => rej(new Error('Host did not respond')), 30000);
      this.conn!.onMessage = async (s) => {
        const m = JSON.parse(s);
        if (m.t === 'welcome') { this.slot = m.slot; this.myFaction = m.faction; this.started = m.started; status('Downloading world…'); }
        else if (m.t === 'kick') { clearTimeout(to); rej(new Error(m.reason)); }
        else if (m.t === 'snap') {
          const json = await gunzip(unb64(m.z));
          this.world = deserializeWorld(JSON.parse(json), 'client');
          this.world.mode = 'client';
          recomputeLight(this.world); updateCombinedLight(this.world);
          clearTimeout(to);
          this.conn!.onMessage = (s2) => this.onMsg(s2);
          for (const q of this.queue) this.apply(q);
          this.queue = [];
          res(this.world);
        } else if (m.t === 'delta') this.queue.push(m);
      };
      this.conn!.onClose = () => { clearTimeout(to); rej(new Error('Connection closed')); };
      this.conn!.send(JSON.stringify({ t: 'hello', name, colony, token, v: VERSION }));
    }).then(w => {
      this.conn!.onClose = () => { this.status = 'Disconnected from host'; this.lostAt = performance.now(); this.game?.ui?.toast('Disconnected from host', 'bad'); };
      return w;
    });
  }

  startColony(pawns: Pawn[], pet: string, site?: [number, number]): Promise<number> {
    return new Promise((res, rej) => {
      const id = this.reqId++;
      this.pending.set(id, r => { if (r.ok) { this.myFaction = +(r.msg || this.myFaction); this.started = true; res(this.myFaction); } else rej(new Error(r.msg)); });
      this.conn!.send(JSON.stringify({ t: 'start', id, pawns, pet, site }));
    });
  }

  onMsg(s: string) {
    const m = JSON.parse(s);
    if (m.t === 'delta') this.apply(m);
    else if (m.t === 'res') { const cb = this.pending.get(m.id); if (cb) { this.pending.delete(m.id); cb({ ok: m.ok, msg: m.msg }); } }
    else if (m.t === 'pong') { this.rtt = performance.now() - m.ts; }
    else if (m.t === 'kick') { this.status = m.reason; this.game?.ui?.toast(m.reason, 'bad'); }
  }

  apply(d: any) {
    const w = this.world!;
    const m = w.map;
    w.tick = d.tick; w.speed = d.sp;
    for (const id of d.rm || []) { const t = w.things.get(id); if (t) w.despawn(t); }
    w.removed = [];
    let lights = false;
    for (const rec of d.th || []) {
      const old = w.things.get(rec.id);
      if (rec._n || !old) {
        delete rec._n;
        if (old) w.despawn(old);
        if (rec.kind === 'projectile') { rec.x = rec.sx; rec.y = rec.sy; }
        w.register(rec);
        if (rec.kind === 'building' && BUILDINGS[rec.def]?.light) lights = true;
        continue;
      }
      if (old.kind === 'pawn') {
        if ((rec.x !== undefined && rec.x !== old.x) || (rec.y !== undefined && rec.y !== old.y)) w.movePawnCell(old, rec.x ?? old.x, rec.y ?? old.y);
        for (const k in rec) (old as any)[k] = rec[k] === null ? undefined : rec[k];
      } else if (old.kind === 'item') {
        if ((rec.x !== undefined && rec.x !== old.x) || (rec.y !== undefined && rec.y !== old.y)) w.moveItem(old, rec.x ?? old.x, rec.y ?? old.y);
        for (const k in rec) (old as any)[k] = rec[k] === null ? undefined : rec[k];
      } else if (old.kind === 'building' || old.kind === 'blueprint') {
        const moved = (rec.x !== undefined && rec.x !== old.x) || (rec.y !== undefined && rec.y !== old.y) || (rec.rot !== undefined && rec.rot !== (old as any).rot) || (rec.def !== undefined && rec.def !== (old as any).def);
        if (moved) { w.despawn(old); for (const k in rec) (old as any)[k] = rec[k] === null ? undefined : rec[k]; w.register(old); w.removed = []; }
        else {
          for (const k in rec) (old as any)[k] = rec[k] === null ? undefined : rec[k];
          if (old.kind === 'building') {
            const bd = BUILDINGS[old.def];
            if (bd.isDoor && rec.open !== undefined) m.updateCost(m.idx(old.x, old.y));
            if (bd.light && (rec.powered !== undefined || rec.fuel !== undefined || rec.on !== undefined)) lights = true;
          }
        }
      } else {
        for (const k in rec) (old as any)[k] = rec[k] === null ? undefined : rec[k];
      }
    }
    for (const r of d.tl || []) m.applyTileRecord(r);
    const g = d.g || {};
    if (g.weather) w.weather = g.weather;
    if (g.temp !== undefined) w.outdoorTemp = g.temp;
    if (g.players) { const toks = new Map(w.players.map(p => [p.slot, p.token])); w.players = g.players.map((p: PlayerInfo) => ({ ...p, token: toks.get(p.slot) || '' })); }
    if (g.factions) w.factions = g.factions;
    if (g.research) w.research = g.research;
    if (g.diplomacy) w.diplomacy = g.diplomacy;
    if (g.conditions) w.conditions = g.conditions;
    if (g.zones) { w.zones.clear(); for (const z of g.zones) w.zones.set(z.id, z); }
    if (g.lords) { w.lords.clear(); for (const l of g.lords) w.lords.set(l.id, l); }
    if (g.story) for (const k in g.story) { w.story[+k] = { ...(w.story[+k] || {} as any), wealth: g.story[k].wealth }; }
    if (g.orbital) (w as any).orbital = g.orbital;
    if (g.p2p) (w as any).p2p = g.p2p;
    if (g.offers) (w as any).diploOffers = g.offers;
    if (g.history) w.history = g.history;
    if (g.settings) w.settings = g.settings;
    if (g.letters) { for (const l of g.letters) if (!w.letters.some(x => x.id === l.id)) w.letters.push(l); if (w.letters.length > 150) w.letters.splice(0, w.letters.length - 150); }
    if (g.chat) { for (const c of g.chat) { w.chat.push(c); this.game?.audio.play('chat'); } if (w.chat.length > 100) w.chat.splice(0, w.chat.length - 100); }
    if (g.rooms) {
      ensureRooms(w);
      for (const [cell, temp] of g.rooms) { const id = m.roomId[cell]; if (id && w.rooms[id - 1]) w.rooms[id - 1].temp = temp; }
    }
    if (lights) m.lightDirty = true;
    for (const e of d.fx || []) this.fx.push(e);
  }

  clientFrame(): FxEvent[] {
    const w = this.world!;
    if (w.map.lightDirty) { recomputeLight(w); }
    if (performance.now() - this.pingT > 2000) { this.pingT = performance.now(); this.conn?.send(JSON.stringify({ t: 'ping', ts: performance.now(), rtt: this.rtt })); }
    // keep projectiles from flying forever if a removal was missed
    for (const p of w.projectiles.values()) if (p.x === p.tx && p.y === p.ty) (p as any)._age = ((p as any)._age || 0) + 1, (p as any)._age > 90 && w.despawn(p);
    if (performance.now() % 1000 < 17) updateCombinedLight(w);
    const out = this.fx; this.fx = [];
    return out;
  }

  sendCmd(c: Command): Promise<CmdResult> {
    return new Promise(res => {
      if (!this.conn) { res({ ok: false, msg: 'Not connected' }); return; }
      const id = this.reqId++;
      const to = setTimeout(() => { this.pending.delete(id); res({ ok: false, msg: 'Host did not respond' }); }, 8000);
      this.pending.set(id, r => { clearTimeout(to); res(r); });
      this.conn.send(JSON.stringify({ t: 'cmd', id, c }));
    });
  }
  setSpeed(s: number) { this.conn?.send(JSON.stringify({ t: 'speed', s })); }
  hostFrame() {}
  close() { this.conn?.close(); }
}
