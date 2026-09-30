// Creation / placement helpers for items, buildings and blueprints.
import type { World } from './world';
import type { Item, Building, Blueprint, Bill, Pawn } from './types';
import { ITEMS, QUALITY_VALUE, stuffOf } from '../data/items';
import { BUILDINGS } from '../data/buildings';
import { TERRAIN } from '../data/terrain';
import { IMPASSABLE } from './map';
import { ANIMALS } from '../data/animals';

export function maxItemHp(def: string, stuff?: string) {
  const d = ITEMS[def];
  const base = d.hp || 100;
  const s = stuffOf(stuff);
  return Math.round(base * (s ? Math.max(0.5, s.hpF) : 1));
}

export function makeItem(w: World, def: string, count = 1, opts: Partial<Item> = {}): Item {
  const d = ITEMS[def];
  if (!d) throw new Error('bad item ' + def);
  const it: Item = { id: w.newId(), kind: 'item', def, x: 0, y: 0, count, hp: 0, ...opts };
  if (!it.hp) it.hp = maxItemHp(def, it.stuff);
  if (d.stuffCats && !it.stuff) it.stuff = d.stuffCats.includes('metallic') ? 'steel' : d.stuffCats.includes('fabric') ? 'cloth' : d.stuffCats.includes('woody') ? 'wood' : 'leather';
  if (d.quality && it.quality === undefined) it.quality = 2;
  return it;
}

export function stackLimit(it: Item) { return ITEMS[it.def].stack; }
export function canStack(a: Item, b: { def: string; stuff?: string; quality?: number }) {
  return a.def === b.def && a.stuff === b.stuff && a.quality === b.quality && !a.corpse && ITEMS[a.def].stack > 1;
}

/** Storage capacity (stacks) of a cell */
export function cellStackCap(w: World, i: number): number {
  const m = w.map;
  if (m.cost[i] === IMPASSABLE) {
    const bid = m.bld[i];
    if (bid) { const b = w.buildings.get(bid); if (b && BUILDINGS[b.def].storage) return BUILDINGS[b.def].storage!.stacks; }
    return 0;
  }
  if (m.isDeepWater(i)) return 0;
  const bid = m.bld[i];
  if (bid) {
    const b = w.buildings.get(bid);
    if (b) {
      const d = BUILDINGS[b.def];
      if (d.storage) return d.storage.stacks;
      if (d.bed || d.isDoor || d.turret || d.trap || d.growBasin) return 0;
    }
  }
  return 1;
}

/** Can item (def/stuff) be placed into cell i, and how many units. */
export function cellAccepts(w: World, i: number, it: Item): number {
  const cap = cellStackCap(w, i);
  if (!cap) return 0;
  const ids = w.map.items[i];
  const lim = stackLimit(it);
  if (!ids || !ids.length) return lim;
  let room = 0, stacks = 0;
  for (const id of ids) {
    const o = w.items.get(id); if (!o) continue;
    stacks++;
    if (canStack(o, it)) room += Math.max(0, lim - o.count);
  }
  if (stacks < cap) room += lim;
  return room;
}

/** Place item at/near (x,y), merging with stacks. Returns the resulting item on map (last merged into) or null. */
export function placeItem(w: World, it: Item, x: number, y: number, maxRadius = 12, exact = false): Item | null {
  const m = w.map;
  let remaining = it.count;
  let last: Item | null = null;
  const tryCell = (xx: number, yy: number): boolean => {
    if (!m.inb(xx, yy)) return false;
    const i = m.idx(xx, yy);
    if (m.isWater(i) && !exact) return false;
    const acc = cellAccepts(w, i, it);
    if (acc <= 0) return false;
    // merge into existing stacks first
    const ids = m.items[i];
    if (ids) for (const id of ids) {
      const o = w.items.get(id);
      if (o && canStack(o, it) && o.count < stackLimit(o)) {
        const n = Math.min(remaining, stackLimit(o) - o.count);
        o.count += n; remaining -= n; last = o;
        if (!remaining) return true;
      }
    }
    const cap = cellStackCap(w, i);
    const stacks = (m.items[i] || []).length;
    if (remaining > 0 && stacks < cap) {
      const n = Math.min(remaining, stackLimit(it));
      const ni: Item = n === it.count && remaining === it.count ? it : { ...it, id: w.newId(), count: n };
      ni.x = xx; ni.y = yy; ni.count = n;
      w.register(ni);
      remaining -= n; last = ni;
    }
    return remaining <= 0;
  };
  if (tryCell(x, y)) return last;
  if (exact) return last;
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (tryCell(x + dx, y + dy)) return last;
    }
  }
  return last;
}

export function spawnItem(w: World, def: string, count: number, x: number, y: number, opts: Partial<Item> = {}): Item | null {
  let last: Item | null = null;
  const lim = ITEMS[def].stack;
  while (count > 0) {
    const n = Math.min(count, lim);
    last = placeItem(w, makeItem(w, def, n, opts), x, y) || last;
    count -= n;
  }
  return last;
}

export function itemValue(it: Item): number {
  const d = ITEMS[it.def];
  let v = d.value;
  if (d.stuffCats && it.stuff) v += (ITEMS[it.stuff]?.value || 1) * (d.stuffCount || 0) * 0.8;
  if (d.quality && it.quality !== undefined) v *= QUALITY_VALUE[it.quality];
  if (it.hp && d.hp) v *= 0.3 + 0.7 * Math.min(1, it.hp / maxItemHp(it.def, it.stuff));
  if (it.corpse) v = 0;
  if (it.rot && it.rot >= 1) v = 0;
  return v * it.count;
}

export function itemLabel(it: Item): string {
  const d = ITEMS[it.def];
  if (it.corpse) return `corpse of ${pawnShortName(it.corpse)}`;
  let s = d.label;
  if (d.stuffCats && it.stuff) s = `${ITEMS[it.stuff].label} ${d.label}`;
  if (it.count > 1) s += ` x${it.count}`;
  if (d.quality && it.quality !== undefined) s += ` (${['awful', 'poor', 'normal', 'good', 'excellent', 'masterwork', 'legendary'][it.quality]})`;
  if (it.rot && it.rot >= 1) s = 'rotten ' + s;
  return s;
}

export function pawnShortName(p: Pawn): string {
  if (p.race !== 'human') return p.animal?.name || ANIMALS[p.race]?.label || p.race;
  return p.name.nick || p.name.first;
}

// ---------------- Buildings ----------------
export function buildingMaxHp(def: string, stuff?: string) {
  const d = BUILDINGS[def];
  const s = stuffOf(stuff);
  return Math.round(d.hp * (s ? s.hpF : 1));
}

export function makeBuilding(w: World, def: string, x: number, y: number, rot: number, stuff: string | undefined, faction: number): Building {
  const d = BUILDINGS[def];
  const b: Building = { id: w.newId(), kind: 'building', def, x, y, rot: d.rotatable ? rot : 0, stuff, hp: 0, faction };
  b.hp = buildingMaxHp(def, stuff);
  if (d.power?.use) { b.on = true; b.powered = false; }
  if (d.power?.battery) b.stored = 0;
  if (d.power?.gen) b.output = 0;
  if (d.fuel) b.fuel = d.fuel.cap * 0.5;
  if (d.bench && !d.bench.research) b.bills = [];
  if (d.bed) b.owners = [];
  if (d.heat || d.cooler) b.tgt = d.cooler ? 21 : d.heat!.target;
  if (d.storage) { b.priority = 3; b.filter = { cats: defaultStorageCats(), deny: [] }; }
  if (d.quality) b.quality = 2;
  if (d.turret) { b.aim = 0; b.cd = 0; b.warm = 0; b.burst = 0; b.target = 0; }
  if (d.trap) b.armed = true;
  if (d.plantPot) b.plant = w.rng.chance(0.5) ? 'rose' : 'daylily';
  if (d.ship === 'reactor') b.reactor = { started: false, t: 0 };
  return b;
}

export function defaultStorageCats() { return ['resource', 'raw_food', 'meal', 'medicine', 'weapon', 'apparel', 'textile', 'animal_product', 'feed', 'drug', 'chunk', 'misc']; }

export interface PlaceCheck { ok: boolean; reason?: string }

/** Validate placing a blueprint for building def at x,y. */
export function canPlaceBuilding(w: World, def: string, x: number, y: number, rot: number, faction: number, ignoreBlueprint = false): PlaceCheck {
  const d = BUILDINGS[def];
  const m = w.map;
  const [bw, bh] = w.rotSize(d.size, d.rotatable ? rot : 0);
  if (x < 0 || y < 0 || x + bw > m.w || y + bh > m.h) return { ok: false, reason: 'Out of bounds' };
  let geyserCells = 0;
  for (let dy = 0; dy < bh; dy++) for (let dx = 0; dx < bw; dx++) {
    const i = m.idx(x + dx, y + dy);
    if (m.rock[i]) return { ok: false, reason: 'Blocked by rock' };
    const t = TERRAIN[m.floor[i] || m.terrain[i]];
    if (d.conduit) {
      if (m.conduit[i]) return { ok: false, reason: 'Conduit already here' };
      continue;
    }
    if (t.water === 'deep') return { ok: false, reason: 'Deep water' };
    if (!t.canBuild && (d.pass !== 'pass' || d.cat === 'structure')) return { ok: false, reason: `Can't build on ${t.label}` };
    const bid = m.bld[i];
    if (bid) {
      const ob = w.buildings.get(bid);
      if (ob) {
        const od = BUILDINGS[ob.def];
        if (d.geyser && ob.def === 'geyser') { geyserCells++; continue; }
        if (d.wallMounted && ob.def === 'wall' && ob.faction === faction) continue; // replaces wall
        return { ok: false, reason: `Occupied by ${od.label}` };
      }
    }
    if (!ignoreBlueprint && m.bp[i]) return { ok: false, reason: 'Blueprint already here' };
    // other factions' home areas
    for (const p of w.players) if (p.faction !== faction && m.inHome(i, p.slot)) return { ok: false, reason: "Inside another colony's territory" };
  }
  if (d.geyser && geyserCells < bw * bh) return { ok: false, reason: 'Must be placed on a steam geyser' };
  // interaction cell must be free-ish
  if (d.interact && d.bench) {
    const [ix, iy] = w.interactCell({ def, x, y, rot: d.rotatable ? rot : 0 });
    if (!m.inb(ix, iy)) return { ok: false, reason: 'Interaction spot out of bounds' };
    const ii = m.idx(ix, iy);
    if (m.rock[ii] || (m.bld[ii] && BUILDINGS[w.buildings.get(m.bld[ii])?.def || 'wall']?.pass !== 'pass')) return { ok: false, reason: 'Interaction spot blocked' };
  }
  return { ok: true };
}

export function newBill(w: World, recipe: string): Bill {
  return { id: w.newId(), recipe, mode: 'forever', target: 10, done: 0, suspended: false, stuff: null, radius: 60 };
}

/** total cost list for a blueprint (building or floor) */
export function blueprintCost(bp: { def: string; floor?: boolean; stuff?: string }): Record<string, number> {
  if (bp.floor) {
    const t = TERRAIN.find(t => t.id === bp.def);
    return { ...(t?.cost || {}) };
  }
  const d = BUILDINGS[bp.def];
  const cost: Record<string, number> = { ...(d.cost || {}) };
  if (d.stuffCats && d.stuffCount && bp.stuff) cost[bp.stuff] = (cost[bp.stuff] || 0) + d.stuffCount;
  return cost;
}

export function blueprintWork(bp: { def: string; floor?: boolean; stuff?: string }): number {
  if (bp.floor) return TERRAIN.find(t => t.id === bp.def)?.work || 100;
  const d = BUILDINGS[bp.def];
  const s = stuffOf(bp.stuff);
  return Math.max(30, d.work * (s ? s.workF : 1));
}

export function blueprintNeeds(bp: Blueprint): Record<string, number> {
  const cost = blueprintCost(bp);
  const out: Record<string, number> = {};
  for (const k in cost) { const n = cost[k] - (bp.delivered[k] || 0); if (n > 0) out[k] = n; }
  return out;
}

export function buildingLabel(b: Building): string {
  const d = BUILDINGS[b.def];
  if (d.stuffCats && b.stuff) return `${ITEMS[b.stuff].label} ${d.label}`;
  return d.label;
}

export function buildingBeauty(b: Building): number {
  const d = BUILDINGS[b.def];
  const s = stuffOf(b.stuff);
  let v = (d.beauty || 0);
  if (s) v = v * (s.beautyF || 1) + s.beauty * (d.stuffCount ? Math.min(3, d.stuffCount / 25) : 1);
  if (d.quality && b.quality !== undefined) v *= [0.5, 0.75, 1, 1.25, 1.5, 2.5, 4][b.quality];
  return v;
}

export function buildingValue(b: Building): number {
  const d = BUILDINGS[b.def];
  let v = d.value || 0;
  for (const [k, n] of Object.entries(d.cost || {})) v += (ITEMS[k]?.value || 1) * n;
  if (d.stuffCount && b.stuff) v += (ITEMS[b.stuff]?.value || 1) * d.stuffCount;
  v += d.work * 0.01;
  if (d.quality && b.quality !== undefined) v *= QUALITY_VALUE[b.quality];
  return v;
}
