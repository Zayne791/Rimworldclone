import { Rng } from '../core/rng';
import { GameMap } from './map';
import type { Thing, Item, Building, Blueprint, Fire, Projectile, Pawn, Zone, Lord, Letter, FxEvent } from './types';
import { TICKS_PER_DAY, TICKS_PER_HOUR, DAYS_PER_SEASON, SEASONS, FACTION_NONE, FACTION_PIRATES, FACTION_MECHS, FACTION_OUTLANDERS, FACTION_TRIBE, FIRST_PLAYER_FACTION } from '../core/constants';
import { BUILDINGS } from '../data/buildings';
import { ITEMS } from '../data/items';

export interface Faction {
  id: number;
  name: string;
  kind: 'player' | 'pirate' | 'mech' | 'outlander' | 'tribe' | 'wild';
  color: string;
  goodwill: Record<number, number>;
  slot?: number;
  colonyName?: string;
  leader?: string;
}

export interface PlayerInfo {
  slot: number;
  faction: number;
  name: string;
  colonyName: string;
  color: string;
  connected: boolean;
  token: string;
  speed: number;
  started: boolean;
  defeated?: boolean;
  won?: boolean;
  isHost?: boolean;
  startX?: number; startY?: number;
  ping?: number;
}

export interface ResearchState { cur: string | null; prog: Record<string, number>; done: string[] }
export interface StoryState { nextBig: number; nextSmall: number; nextGood: number; lastRaid: number; cycle: number; threatsSurvived: number; wealth: number; raidsPending: number }
export interface Settings { storyteller: 'classic' | 'chill' | 'chaos'; difficulty: number; mapSize: number; seed: string; pvp: boolean; maxPlayers: number; permadeath?: boolean }
export interface Weather { cur: string; next: string; t: number; blend: number; windSpeed: number }
export interface GameCondition { id: string; until: number; faction?: number }

export const PLAYER_COLORS = ['#4fa3e0', '#e05f4f', '#5fcf6a', '#e0b34f'];

export class World {
  mode: 'host' | 'client' = 'host';
  seed: string;
  tick = 0;
  rng: Rng;
  map: GameMap;
  nextId = 1;
  things = new Map<number, Thing>();
  items = new Map<number, Item>();
  buildings = new Map<number, Building>();
  blueprints = new Map<number, Blueprint>();
  fires = new Map<number, Fire>();
  projectiles = new Map<number, Projectile>();
  pawns = new Map<number, Pawn>();
  zones = new Map<number, Zone>();
  lords = new Map<number, Lord>();
  factions: Faction[] = [];
  players: PlayerInfo[] = [];
  research: Record<number, ResearchState> = {};
  story: Record<number, StoryState> = {};
  diplomacy: Record<string, 'war' | 'neutral' | 'ally'> = {};
  letters: Letter[] = [];
  conditions: GameCondition[] = [];
  weather: Weather = { cur: 'clear', next: 'clear', t: 0, blend: 1, windSpeed: 0.5 };
  settings: Settings;
  outdoorTemp = 15;
  speed = 1;
  paused = false;
  rooms: import('./rooms').Room[] = [];
  reservations = new Map<string, number>();
  fx: FxEvent[] = [];
  removed: number[] = [];      // ids removed this net frame (host)
  nextZoneId = 1;
  gameOver = false;
  chat: { from: string; text: string; tick: number; color: string }[] = [];
  history: { tick: number; wealth: Record<number, number>; pop: Record<number, number> }[] = [];
  // Transient caches (not saved)
  _cache: Record<string, any> = {};

  constructor(seed: string, w: number, h: number, settings?: Partial<Settings>) {
    this.seed = seed;
    this.rng = new Rng(seed + ':sim');
    this.map = new GameMap(w, h);
    this.map.bldInfo = (id: number) => {
      const b = this.buildings.get(id);
      if (!b) return null;
      const d = BUILDINGS[b.def];
      if (!d) return null;
      const isDoor = !!d.isDoor;
      return { pass: d.pass, pathCost: d.pathCost || 0, isDoor, blocksLight: !!d.blocksLight && !(isDoor && (b.open || 0) > 0) };
    };
    this.settings = { storyteller: 'classic', difficulty: 2, mapSize: w, seed, pvp: true, maxPlayers: 4, ...settings };
    this.initFactions();
  }

  initFactions() {
    this.factions = [];
    const mk = (id: number, name: string, kind: Faction['kind'], color: string, leader?: string) =>
      this.factions.push({ id, name, kind, color, goodwill: {}, leader });
    mk(FACTION_NONE, 'Wildlife', 'wild', '#888');
    mk(FACTION_PIRATES, 'The Rustfang Raiders', 'pirate', '#c0392b', 'Warlord Kessler');
    mk(FACTION_MECHS, 'Mechanoid Hive', 'mech', '#8e44ad');
    mk(FACTION_OUTLANDERS, 'Freeholds of Veran', 'outlander', '#27ae60', 'Mayor Adeyemi');
    mk(FACTION_TRIBE, 'Ashwind Tribe', 'tribe', '#d35400', 'Chief Oruna');
  }

  faction(id: number): Faction | undefined { return this.factions.find(f => f.id === id); }
  isPlayerFaction(id: number) { return id >= FIRST_PLAYER_FACTION; }
  playerByFaction(id: number) { return this.players.find(p => p.faction === id); }
  slotOf(faction: number) { return faction - FIRST_PLAYER_FACTION; }

  addPlayerFaction(slot: number, name: string, colonyName: string): Faction {
    const id = FIRST_PLAYER_FACTION + slot;
    let f = this.faction(id);
    if (!f) {
      f = { id, name: name, kind: 'player', color: PLAYER_COLORS[slot % PLAYER_COLORS.length], goodwill: {}, slot, colonyName };
      this.factions.push(f);
    } else { f.name = name; f.colonyName = colonyName; }
    // default goodwill with NPC factions
    f.goodwill[FACTION_PIRATES] = -100; f.goodwill[FACTION_MECHS] = -100;
    f.goodwill[FACTION_OUTLANDERS] = 20; f.goodwill[FACTION_TRIBE] = 0;
    this.research[id] ||= { cur: null, prog: {}, done: [] };
    this.story[id] ||= { nextBig: TICKS_PER_DAY * 4.5, nextSmall: TICKS_PER_DAY * 2, nextGood: TICKS_PER_DAY * 1.5, lastRaid: 0, cycle: 0, threatsSurvived: 0, wealth: 0, raidsPending: 0 };
    return f;
  }

  goodwill(a: number, b: number): number {
    const fa = this.faction(a), fb = this.faction(b);
    if (!fa || !fb) return 0;
    if (fa.kind === 'player') return fa.goodwill[b] ?? 0;
    if (fb.kind === 'player') return fb.goodwill[a] ?? 0;
    return 0;
  }
  diploKey(a: number, b: number) { return a < b ? a + '-' + b : b + '-' + a; }
  diplo(a: number, b: number) { return this.diplomacy[this.diploKey(a, b)] || 'neutral'; }

  /** faction-level hostility */
  hostile(a: number, b: number): boolean {
    if (a === b) return false;
    if (a === FACTION_NONE || b === FACTION_NONE) return false;
    const fa = this.faction(a), fb = this.faction(b);
    if (!fa || !fb) return false;
    if (fa.kind === 'mech' || fb.kind === 'mech') return true;
    if (fa.kind === 'player' && fb.kind === 'player') return this.diplo(a, b) === 'war';
    if (fa.kind === 'pirate' && fb.kind === 'pirate') return false;
    if (fa.kind === 'pirate' || fb.kind === 'pirate') return true;
    return this.goodwill(a, b) <= -75;
  }
  allied(a: number, b: number): boolean {
    if (a === b) return true;
    const fa = this.faction(a), fb = this.faction(b);
    if (fa?.kind === 'player' && fb?.kind === 'player') return this.diplo(a, b) === 'ally';
    return false;
  }

  // ---------------- time ----------------
  get day() { return Math.floor(this.tick / TICKS_PER_DAY); }
  get hour() { return (this.tick % TICKS_PER_DAY) / TICKS_PER_HOUR; }
  get season() { return Math.floor(this.day / DAYS_PER_SEASON) % 4; }
  get seasonName() { return SEASONS[this.season]; }
  get year() { return 5500 + Math.floor(this.day / (DAYS_PER_SEASON * 4)); }
  dateString() { return `${(this.day % DAYS_PER_SEASON) + 1} ${this.seasonName}, ${this.year}`; }
  timeString() { const h = Math.floor(this.hour); return `${h}h`; }
  hasCondition(id: string, faction?: number) { return this.conditions.some(c => c.id === id && c.until > this.tick && (c.faction === undefined || faction === undefined || c.faction === faction)); }

  newId() { return this.nextId++; }

  // ---------------- thing registry ----------------
  register(t: Thing) {
    this.things.set(t.id, t);
    const m = this.map;
    switch (t.kind) {
      case 'item': this.items.set(t.id, t); m.addItemAt(m.idx(t.x, t.y), t.id); break;
      case 'building': {
        this.buildings.set(t.id, t);
        const d = BUILDINGS[t.def];
        for (const i of this.footprint(t.x, t.y, d.size, t.rot)) { m.bld[i] = t.id; m.updateCost(i); m.touch(i); }
        m.touchRegion();
        this._cache.buildingsVersion = (this._cache.buildingsVersion || 0) + 1;
        break;
      }
      case 'blueprint': {
        this.blueprints.set(t.id, t);
        if (t.floor || BUILDINGS[t.def]?.conduit) { const i = m.idx(t.x, t.y); m.bpFloor[i] = t.id; m.touch(i, false); }
        else { const d = BUILDINGS[t.def]; for (const i of this.footprint(t.x, t.y, d.size, t.rot)) { m.bp[i] = t.id; m.touch(i, false); } }
        break;
      }
      case 'fire': this.fires.set(t.id, t); m.fire[m.idx(t.x, t.y)] = t.id; break;
      case 'projectile': this.projectiles.set(t.id, t); break;
      case 'pawn': this.pawns.set(t.id, t); m.addPawnAt(m.idx(t.x, t.y), t.id); break;
    }
  }

  despawn(t: Thing) {
    if (!this.things.has(t.id)) return;
    this.things.delete(t.id);
    this.removed.push(t.id);
    const m = this.map;
    switch (t.kind) {
      case 'item': this.items.delete(t.id); m.removeItemAt(m.idx(t.x, t.y), t.id); break;
      case 'building': {
        this.buildings.delete(t.id);
        const d = BUILDINGS[t.def];
        for (const i of this.footprint(t.x, t.y, d.size, t.rot)) { if (m.bld[i] === t.id) m.bld[i] = 0; m.updateCost(i); m.touch(i); }
        m.touchRegion();
        this._cache.buildingsVersion = (this._cache.buildingsVersion || 0) + 1;
        break;
      }
      case 'blueprint': {
        this.blueprints.delete(t.id);
        if (t.floor || BUILDINGS[t.def]?.conduit) { const i = m.idx(t.x, t.y); if (m.bpFloor[i] === t.id) m.bpFloor[i] = 0; m.touch(i, false); }
        else { const d = BUILDINGS[t.def]; for (const i of this.footprint(t.x, t.y, d.size, t.rot)) { if (m.bp[i] === t.id) m.bp[i] = 0; m.touch(i, false); } }
        break;
      }
      case 'fire': this.fires.delete(t.id); { const i = m.idx(t.x, t.y); if (m.fire[i] === t.id) m.fire[i] = 0; } break;
      case 'projectile': this.projectiles.delete(t.id); break;
      case 'pawn': this.pawns.delete(t.id); m.removePawnAt(m.idx(t.x, t.y), t.id); break;
    }
    // drop reservations held on this thing
    this.reservations.delete('t' + t.id);
  }

  movePawnCell(p: Pawn, x: number, y: number) {
    const m = this.map;
    if (this.pawns.has(p.id)) m.removePawnAt(m.idx(p.x, p.y), p.id);
    p.x = x; p.y = y;
    if (this.pawns.has(p.id)) m.addPawnAt(m.idx(x, y), p.id);
  }

  moveItem(it: Item, x: number, y: number) {
    const m = this.map;
    m.removeItemAt(m.idx(it.x, it.y), it.id);
    it.x = x; it.y = y;
    m.addItemAt(m.idx(x, y), it.id);
  }

  /** footprint cell indices for a building of size at x,y with rotation */
  footprint(x: number, y: number, size: [number, number], rot: number): number[] {
    const [w, h] = rot % 2 === 1 ? [size[1], size[0]] : size;
    const out: number[] = [];
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const xx = x + dx, yy = y + dy;
      if (this.map.inb(xx, yy)) out.push(this.map.idx(xx, yy));
    }
    return out;
  }
  rotSize(size: [number, number], rot: number): [number, number] { return rot % 2 === 1 ? [size[1], size[0]] : [size[0], size[1]]; }

  /** interaction cell for a building */
  interactCell(b: { def: string; x: number; y: number; rot: number }): [number, number] {
    const d = BUILDINGS[b.def];
    const [w, h] = d.size;
    const [ix, iy] = d.interact || [0, h];
    let lx: number, ly: number;
    switch (b.rot) {
      case 1: lx = iy; ly = w - 1 - ix; break;
      case 2: lx = w - 1 - ix; ly = h - 1 - iy; break;
      case 3: lx = h - 1 - iy; ly = ix; break;
      default: lx = ix; ly = iy;
    }
    return [b.x + lx, b.y + ly];
  }
  center(t: { x: number; y: number; def?: string; rot?: number; kind: string }): [number, number] {
    if (t.kind === 'building' || t.kind === 'blueprint') {
      const bb = t as Building;
      if ((bb as any).floor) return [t.x, t.y];
      const d = BUILDINGS[bb.def];
      if (d) { const [w, h] = this.rotSize(d.size, bb.rot); return [t.x + (w - 1) / 2, t.y + (h - 1) / 2]; }
    }
    return [t.x, t.y];
  }

  buildingAt(x: number, y: number): Building | undefined {
    if (!this.map.inb(x, y)) return undefined;
    const id = this.map.bld[this.map.idx(x, y)];
    return id ? this.buildings.get(id) : undefined;
  }
  itemsAt(x: number, y: number): Item[] {
    const a = this.map.items[this.map.idx(x, y)];
    if (!a) return [];
    const out: Item[] = [];
    for (const id of a) { const it = this.items.get(id); if (it) out.push(it); }
    return out;
  }
  pawnsAt(x: number, y: number): Pawn[] {
    if (!this.map.inb(x, y)) return [];
    const a = this.map.pawns[this.map.idx(x, y)];
    if (!a) return [];
    const out: Pawn[] = [];
    for (const id of a) { const p = this.pawns.get(id); if (p) out.push(p); }
    return out;
  }

  emit(e: FxEvent) { this.fx.push(e); }
  text(x: number, y: number, s: string, c = '#fff') { this.fx.push({ k: 'text', x, y, s, c }); }
  sound(s: string, x: number, y: number) { this.fx.push({ k: 'sound', x, y, s }); }

  letter(faction: number, title: string, text: string, kind: Letter['kind'], x?: number, y?: number, thing?: number) {
    const l: Letter = { id: this.newId(), faction, title, text, kind, tick: this.tick, x, y, thing };
    this.letters.push(l);
    if (this.letters.length > 120) this.letters.splice(0, this.letters.length - 120);
    this.fx.push({ k: 'letter', x: x ?? -1, y: y ?? -1, s: title, f: faction, id: l.id });
    return l;
  }

  playerFactions(): number[] { return this.players.filter(p => p.started).map(p => p.faction); }
  colonists(faction: number): Pawn[] {
    const out: Pawn[] = [];
    for (const p of this.pawns.values()) if (p.faction === faction && p.race === 'human' && !p.dead && !p.guest) out.push(p);
    return out;
  }
  isColonist(p: Pawn) { return p.race === 'human' && this.isPlayerFaction(p.faction) && !p.guest && !p.dead; }

  // ---------------- reservations ----------------
  reserve(key: string, pawnId: number): boolean {
    const cur = this.reservations.get(key);
    if (cur && cur !== pawnId && this.pawns.get(cur)?.job) return false;
    this.reservations.set(key, pawnId);
    return true;
  }
  reservedBy(key: string): number { return this.reservations.get(key) || 0; }
  failMarks = new Map<string, number>();
  markFailed(key: string, pawnId: number, ticks = 900) { this.failMarks.set(key + ':' + pawnId, this.tick + ticks); if (this.failMarks.size > 2000) { for (const [k, v] of this.failMarks) if (v < this.tick) this.failMarks.delete(k); } }
  canReserve(key: string, pawnId: number) {
    const fm = this.failMarks.get(key + ':' + pawnId);
    if (fm !== undefined) { if (fm > this.tick) return false; this.failMarks.delete(key + ':' + pawnId); }
    const cur = this.reservations.get(key);
    if (!cur || cur === pawnId) return true;
    const holder = this.pawns.get(cur);
    if (!holder || !holder.job || holder.dead || holder.downed) { this.reservations.delete(key); return true; }
    return false;
  }
  releaseAll(pawnId: number) {
    for (const [k, v] of this.reservations) if (v === pawnId) this.reservations.delete(k);
  }

  itemDefOf(it: Item) { return ITEMS[it.def]; }
}
