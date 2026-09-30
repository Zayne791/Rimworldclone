// Stockpile and growing zones: storage priorities, item filters, finding haul destinations.
import type { World } from './world';
import type { Item, Zone, StorageFilter, Pawn, Building } from './types';
import { ITEMS } from '../data/items';
import { BUILDINGS } from '../data/buildings';
import { cellAccepts, defaultStorageCats } from './things';

export const PRIORITY_LABELS = ['', 'Low', 'Normal', 'Preferred', 'Important', 'Critical'];
const ZONE_COLORS = ['#c9b458', '#58a4c9', '#c95878', '#78c958', '#a458c9', '#c98a58'];
const GROW_COLORS = ['#6fbf4a', '#8fcf3a', '#4abf6f'];

export function newZone(w: World, faction: number, kind: Zone['kind']): Zone {
  const id = w.nextZoneId++;
  const n = [...w.zones.values()].filter(z => z.faction === faction && z.kind === kind).length + 1;
  const z: Zone = {
    id, faction, kind, name: kind === 'grow' ? `Growing zone ${n}` : kind === 'dump' ? `Dumping zone ${n}` : `Stockpile ${n}`,
    cells: [], priority: kind === 'dump' ? 1 : 2, filter: { cats: kind === 'dump' ? ['chunk', 'corpse'] : defaultStorageCats(), deny: [] },
    plant: 'potato', allowSow: true, color: kind === 'grow' ? GROW_COLORS[id % GROW_COLORS.length] : ZONE_COLORS[id % ZONE_COLORS.length],
  };
  w.zones.set(id, z);
  return z;
}

export function filterAllows(f: StorageFilter, it: { def: string; rot?: number }): boolean {
  const d = ITEMS[it.def];
  if (!d) return false;
  if (f.deny.includes(it.def)) return false;
  if ((it.rot || 0) >= 1 && !f.allowRotten) return false;
  return f.cats.includes(d.cat);
}

/** Storage priority of the cell an item currently sits in (0 = not stored). */
export function storagePriorityAt(w: World, it: Item): number {
  const m = w.map;
  const i = m.idx(it.x, it.y);
  const bid = m.bld[i];
  if (bid) {
    const b = w.buildings.get(bid);
    if (b && BUILDINGS[b.def].storage && b.filter && filterAllows(b.filter, it)) return b.priority || 3;
  }
  const zid = m.zone[i];
  if (zid) {
    const z = w.zones.get(zid);
    if (z && (z.kind === 'stockpile' || z.kind === 'dump') && filterAllows(z.filter, it)) return z.priority;
  }
  return 0;
}

export function storageOwnerAt(w: World, i: number): number {
  const m = w.map;
  const bid = m.bld[i];
  if (bid) { const b = w.buildings.get(bid); if (b && BUILDINGS[b.def].storage) return b.faction; }
  const zid = m.zone[i];
  if (zid) { const z = w.zones.get(zid); if (z) return z.faction; }
  return -1;
}

interface StoreDest { cell: number; priority: number }

/** Find best storage cell for an item for a faction, better than its current priority. */
export function findStorageFor(w: World, p: Pawn, it: Item, minPriority?: number): StoreDest | null {
  const m = w.map;
  const cur = minPriority ?? storagePriorityAt(w, it);
  let best: StoreDest | null = null;
  let bestD = Infinity;
  const consider = (i: number, pr: number) => {
    if (pr <= cur) return;
    if (best && pr < best.priority) return;
    const x = i % m.w, y = (i / m.w) | 0;
    const d = (x - it.x) * (x - it.x) + (y - it.y) * (y - it.y);
    if (best && pr === best.priority && d >= bestD) return;
    if (cellAccepts(w, i, it) <= 0) return;
    if (!w.canReserve('c' + i, p.id)) return;
    if (!m.connected(m.idx(p.x, p.y), i, false)) return;
    best = { cell: i, priority: pr }; bestD = d;
  };
  for (const z of w.zones.values()) {
    if (z.faction !== p.faction || (z.kind !== 'stockpile' && z.kind !== 'dump')) continue;
    if (z.priority <= cur || !filterAllows(z.filter, it)) continue;
    if (best && z.priority < (best as StoreDest).priority) continue;
    for (const i of z.cells) { if (m.bld[i] && BUILDINGS[w.buildings.get(m.bld[i])?.def || '']?.storage) continue; consider(i, z.priority); }
  }
  for (const b of w.buildings.values()) {
    const d = BUILDINGS[b.def];
    if (!d.storage || b.faction !== p.faction || !b.filter) continue;
    const pr = b.priority || 3;
    if (pr <= cur || !filterAllows(b.filter, it)) continue;
    for (const i of w.footprint(b.x, b.y, d.size, b.rot)) consider(i, pr);
  }
  return best;
}

/** Items a pawn's faction could legally touch (not in another colony's territory unless at war) */
export function itemAccessible(w: World, p: Pawn, it: Item): boolean {
  if (it.forbidden && (it.owner === undefined || it.owner === p.faction || it.owner < 10)) return false;
  const i = w.map.idx(it.x, it.y);
  const owner = storageOwnerAt(w, i);
  if (owner >= 10 && owner !== p.faction && !w.hostile(owner, p.faction)) return false;
  const home = w.map.home[i];
  if (home) {
    for (const pl of w.players) {
      if (pl.faction === p.faction) continue;
      if ((home & (1 << pl.slot)) && !w.hostile(pl.faction, p.faction) && !((home & (1 << w.slotOf(p.faction))) !== 0)) return false;
    }
  }
  return true;
}

export function addCellsToZone(w: World, z: Zone, cells: number[]) {
  const m = w.map;
  for (const i of cells) {
    if (m.zone[i] && m.zone[i] !== z.id) continue;
    if (m.rock[i] || m.isDeepWater(i)) continue;
    if (z.kind === 'grow') {
      if (m.fertility(i) < 0.3 && !isGrowBasin(w, i)) continue;
    } else {
      if (m.cost[i] === 0xffff && !isStorageBld(w, i)) continue;
    }
    if (m.zone[i] === z.id) continue;
    m.setZone(i, z.id);
    z.cells.push(i);
  }
  if (!z.cells.length) w.zones.delete(z.id);
}
function isGrowBasin(w: World, i: number) { const b = w.buildings.get(w.map.bld[i]); return !!(b && BUILDINGS[b.def].growBasin); }
function isStorageBld(w: World, i: number) { const b = w.buildings.get(w.map.bld[i]); return !!(b && BUILDINGS[b.def].storage); }

export function removeCellsFromZones(w: World, faction: number, cells: number[]) {
  const m = w.map;
  const touched = new Set<Zone>();
  for (const i of cells) {
    const zid = m.zone[i];
    if (!zid) continue;
    const z = w.zones.get(zid);
    if (!z || z.faction !== faction) continue;
    m.setZone(i, 0);
    touched.add(z);
  }
  for (const z of touched) {
    z.cells = z.cells.filter(i => m.zone[i] === z.id);
    if (!z.cells.length) w.zones.delete(z.id);
  }
}

export function deleteZone(w: World, z: Zone) {
  for (const i of z.cells) if (w.map.zone[i] === z.id) w.map.setZone(i, 0);
  w.zones.delete(z.id);
}

/** count of an item def available to a faction (in its storage or home area) */
export function countResource(w: World, faction: number, def: string): number {
  let n = 0;
  const slot = w.slotOf(faction);
  for (const it of w.items.values()) {
    if (it.def !== def) continue;
    const i = w.map.idx(it.x, it.y);
    const owner = storageOwnerAt(w, i);
    if (owner === faction || (owner < 0 && w.map.inHome(i, slot))) n += it.count;
  }
  return n;
}

export function storageBuildingsOf(w: World, faction: number): Building[] {
  return [...w.buildings.values()].filter(b => b.faction === faction && BUILDINGS[b.def].storage);
}
