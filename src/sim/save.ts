// World serialization for saves and multiplayer snapshots.
import { World } from './world';
import { GameMap } from './map';
import type { Thing } from './types';
import { VERSION } from '../core/constants';

function strip(k: string, v: any) { return k.startsWith('_') ? undefined : v; }

export function serializeWorld(w: World): any {
  const things: Thing[] = [];
  for (const t of w.things.values()) things.push(t);
  return JSON.parse(JSON.stringify({
    v: VERSION, seed: w.seed, tick: w.tick, rng: w.rng.state(), settings: w.settings, nextId: w.nextId, nextZoneId: w.nextZoneId,
    map: w.map.toJSON(), things, zones: [...w.zones.values()], lords: [...w.lords.values()], factions: w.factions, players: w.players,
    research: w.research, story: w.story, diplomacy: w.diplomacy, letters: w.letters, conditions: w.conditions, weather: w.weather,
    outdoorTemp: w.outdoorTemp, chat: w.chat, history: w.history, orbital: (w as any).orbital || {}, p2p: (w as any).p2p || [], diploOffers: (w as any).diploOffers || [],
    speed: w.speed, paused: w.paused,
  }, strip));
}

export function deserializeWorld(d: any, mode: 'host' | 'client' = 'host'): World {
  const m = GameMap.fromJSON(d.map);
  const w = new World(d.seed, m.w, m.h, d.settings);
  w.mode = mode;
  const bi = w.map.bldInfo;
  w.map = m;
  m.bldInfo = bi;
  w.tick = d.tick; w.rng.setState(d.rng); w.nextId = d.nextId; w.nextZoneId = d.nextZoneId || 1;
  w.factions = d.factions; w.players = d.players; w.research = d.research; w.story = d.story; w.diplomacy = d.diplomacy || {};
  w.letters = d.letters || []; w.conditions = d.conditions || []; w.weather = d.weather; w.outdoorTemp = d.outdoorTemp ?? 15;
  w.chat = d.chat || []; w.history = d.history || [];
  (w as any).orbital = d.orbital || {}; (w as any).p2p = d.p2p || []; (w as any).diploOffers = d.diploOffers || [];
  w.speed = d.speed ?? 1; w.paused = !!d.paused;
  for (const z of d.zones || []) w.zones.set(z.id, z);
  for (const l of d.lords || []) w.lords.set(l.id, l);
  // register things: buildings first so costs are right
  const order = ['building', 'blueprint', 'item', 'fire', 'pawn', 'projectile'];
  const things = [...(d.things as Thing[])].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  for (const t of things) w.register(t);
  m.rebuildCosts();
  m.roomsDirty = true; m.lightDirty = true; m.regionDirty = true;
  m.dirty.clear();
  w.removed = [];
  return w;
}

// ---------------- compression + storage ----------------
export async function gzip(s: string): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') return new TextEncoder().encode(s);
  const cs = new CompressionStream('gzip');
  const stream = new Blob([s]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
export async function gunzip(u: Uint8Array): Promise<string> {
  if (u[0] !== 0x1f || u[1] !== 0x8b || typeof DecompressionStream === 'undefined') return new TextDecoder().decode(u);
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([u as any]).stream().pipeThrough(ds);
  return await new Response(stream).text();
}

const DB = 'starfall-saves';
function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('saves'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export interface SaveMeta { name: string; colony: string; day: number; time: number; size: number; mp: boolean }
export async function saveToDb(slot: string, w: World, meta: Partial<SaveMeta> = {}) {
  const data = await gzip(JSON.stringify(serializeWorld(w)));
  const db = await openDb();
  const m: SaveMeta = { name: slot, colony: meta.colony || w.players[0]?.colonyName || 'Colony', day: w.day, time: Date.now(), size: data.length, mp: w.players.length > 1, ...meta };
  await new Promise<void>((res, rej) => {
    const tx = db.transaction('saves', 'readwrite');
    tx.objectStore('saves').put({ meta: m, data }, slot);
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
  });
}
export async function listSaves(): Promise<SaveMeta[]> {
  try {
    const db = await openDb();
    return await new Promise((res, rej) => {
      const out: SaveMeta[] = [];
      const tx = db.transaction('saves', 'readonly');
      const req = tx.objectStore('saves').openCursor();
      req.onsuccess = () => { const c = req.result; if (c) { out.push((c.value as any).meta); c.continue(); } else res(out.sort((a, b) => b.time - a.time)); };
      req.onerror = () => rej(req.error);
    });
  } catch { return []; }
}
export async function loadFromDb(slot: string): Promise<World | null> {
  const db = await openDb();
  const rec: any = await new Promise((res, rej) => {
    const tx = db.transaction('saves', 'readonly');
    const r = tx.objectStore('saves').get(slot);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  if (!rec) return null;
  const s = await gunzip(rec.data);
  return deserializeWorld(JSON.parse(s));
}
export async function deleteSave(slot: string) {
  const db = await openDb();
  await new Promise<void>((res) => { const tx = db.transaction('saves', 'readwrite'); tx.objectStore('saves').delete(slot); tx.oncomplete = () => res(); });
}
export async function exportSave(w: World): Promise<Blob> { return new Blob([await gzip(JSON.stringify(serializeWorld(w)))] as any, { type: 'application/octet-stream' }); }
export async function importSave(file: File): Promise<World> { const u = new Uint8Array(await file.arrayBuffer()); return deserializeWorld(JSON.parse(await gunzip(u))); }
