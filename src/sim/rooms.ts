// Room detection, room stats, temperature simulation, auto-roofing and roof collapse.
import type { World } from './world';
import { BUILDINGS } from '../data/buildings';
import { ROOF } from './map';
import { buildingValue } from './things';
import { cellBeauty } from './mood';
import { clamp } from '../core/util';
import { applyDamage } from './health';

export interface Room {
  id: number;
  cells: number;
  outdoors: boolean;
  temp: number;
  unroofed: number;
  role: string;
  impressiveness: number;
  beauty: number;
  wealth: number;
  cleanliness: number;
  faction: number;
  x0: number; y0: number; x1: number; y1: number;
  cx: number; cy: number;
}

export const TEMP_INTERVAL = 120;

export function blocksRoom(w: World, i: number): boolean {
  const m = w.map;
  if (m.rock[i]) return true;
  const bid = m.bld[i];
  if (bid) { const b = w.buildings.get(bid); if (b && BUILDINGS[b.def].blocksRoom) return true; }
  return false;
}

export function roomAt(w: World, x: number, y: number): Room | null {
  const m = w.map;
  if (!m.inb(x, y)) return null;
  ensureRooms(w);
  const id = m.roomId[m.idx(x, y)];
  return id ? w.rooms[id - 1] || null : null;
}

export function ensureRooms(w: World) {
  const m = w.map;
  if (!m.roomsDirty) return;
  m.roomsDirty = false;
  const old = m.roomId.slice();
  const oldRooms = w.rooms;
  const rid = m.roomId; rid.fill(0);
  const rooms: Room[] = [];
  const W = m.w, H = m.h;
  const stack: number[] = [];
  for (let s = 0; s < m.n; s++) {
    if (rid[s] || blocksRoom(w, s)) continue;
    const id = rooms.length + 1;
    const room: Room = { id, cells: 0, outdoors: false, temp: w.outdoorTemp, unroofed: 0, role: 'outdoors', impressiveness: 0, beauty: 0, wealth: 0, cleanliness: 0, faction: -1, x0: 1e9, y0: 1e9, x1: -1, y1: -1, cx: 0, cy: 0 };
    rooms.push(room);
    rid[s] = id; stack.push(s);
    const tempVotes = new Map<number, number>();
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W, y = (i / W) | 0;
      room.cells++;
      if (x < room.x0) room.x0 = x; if (x > room.x1) room.x1 = x; if (y < room.y0) room.y0 = y; if (y > room.y1) room.y1 = y;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) room.outdoors = true;
      if (!m.roof[i]) room.unroofed++;
      const o = old[i];
      if (o) tempVotes.set(o, (tempVotes.get(o) || 0) + 1);
      if (x > 0) { const j = i - 1; if (!rid[j] && !blocksRoom(w, j)) { rid[j] = id; stack.push(j); } }
      if (x < W - 1) { const j = i + 1; if (!rid[j] && !blocksRoom(w, j)) { rid[j] = id; stack.push(j); } }
      if (y > 0) { const j = i - W; if (!rid[j] && !blocksRoom(w, j)) { rid[j] = id; stack.push(j); } }
      if (y < H - 1) { const j = i + W; if (!rid[j] && !blocksRoom(w, j)) { rid[j] = id; stack.push(j); } }
    }
    if (room.cells > 2500) room.outdoors = true;
    room.cx = (room.x0 + room.x1) / 2; room.cy = (room.y0 + room.y1) / 2;
    // inherit temperature from the old room that contributed most cells
    let best = 0, bestN = 0;
    for (const [k, v] of tempVotes) if (v > bestN) { bestN = v; best = k; }
    const prev = best ? oldRooms[best - 1] : null;
    room.temp = room.outdoors ? w.outdoorTemp : prev && !prev.outdoors ? prev.temp : w.outdoorTemp;
  }
  w.rooms = rooms;
  for (const r of rooms) computeRoomStats(w, r);
  if (w.mode === 'host') autoRoof(w);
}

export function computeRoomStats(w: World, r: Room) {
  const m = w.map;
  if (r.outdoors) { r.role = 'outdoors'; r.impressiveness = 0; return; }
  let beauty = 0, filth = 0, n = 0;
  const seen = new Set<number>();
  let wealth = 0;
  const counts: Record<string, number> = {};
  const facVotes: Record<number, number> = {};
  for (let y = r.y0 - 1; y <= r.y1 + 1; y++) for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
    if (!m.inb(x, y)) continue;
    const i = m.idx(x, y);
    const inRoom = m.roomId[i] === r.id;
    const bid = m.bld[i];
    if (bid && !seen.has(bid)) {
      // count buildings in room or walls bordering
      const b = w.buildings.get(bid);
      if (b) {
        const d = BUILDINGS[b.def];
        if (inRoom || d.blocksRoom) {
          seen.add(bid);
          if (d.blocksRoom) facVotes[b.faction] = (facVotes[b.faction] || 0) + 1;
          if (inRoom) {
            wealth += buildingValue(b);
            if (d.bed) counts[d.bed.medical || b.medical ? 'hospital' : b.prison ? 'prison' : 'bed'] = (counts[d.bed.medical || b.medical ? 'hospital' : b.prison ? 'prison' : 'bed'] || 0) + d.bed.sleepers;
            if (d.table) counts.table = (counts.table || 0) + 1;
            if (d.joy) counts.joy = (counts.joy || 0) + 1;
            if (d.bench?.research) counts.lab = (counts.lab || 0) + 1;
            else if (d.bench && d.bench.recipes.some(rc => rc.startsWith('cook'))) counts.kitchen = (counts.kitchen || 0) + 1;
            else if (d.bench) counts.workshop = (counts.workshop || 0) + 1;
            if (d.power && (d.power.gen || d.power.battery)) counts.power = (counts.power || 0) + 1;
          }
        }
      }
    }
    if (!inRoom) continue;
    n++;
    beauty += cellBeauty(w, i);
    if (m.filth[i]) filth += 1 + (m.filth[i] >> 6);
    if (m.zone[i]) counts.storage = (counts.storage || 0) + 0.05;
  }
  let bestF = -1, bestN = 0;
  for (const k in facVotes) if (facVotes[k] > bestN) { bestN = facVotes[k]; bestF = +k; }
  r.faction = bestF;
  r.beauty = n ? beauty / n : 0;
  r.wealth = wealth;
  r.cleanliness = n ? -filth / n : 0;
  const beautyS = clamp(r.beauty * 15 + 30, 0, 200);
  const wealthS = clamp(Math.sqrt(wealth) * 2, 0, 200);
  const spaceS = clamp(r.cells * 2.5, 0, 150);
  const cleanS = clamp(60 + r.cleanliness * 60, 0, 100);
  r.impressiveness = Math.round(0.35 * beautyS + 0.25 * wealthS + 0.25 * spaceS + 0.15 * cleanS);
  if (r.cells < 6) r.impressiveness = Math.min(r.impressiveness, 25);
  const role = counts.prison ? 'prison cell' : counts.hospital ? 'hospital' : counts.bed === 1 ? 'bedroom' : counts.bed > 1 ? 'barracks'
    : counts.kitchen ? 'kitchen' : counts.lab ? 'laboratory' : counts.table && counts.joy ? 'dining & rec room' : counts.table ? 'dining room'
    : counts.joy ? 'rec room' : counts.workshop ? 'workshop' : counts.power ? 'power room' : (counts.storage || 0) > 0.5 ? 'storeroom' : 'room';
  r.role = role;
}

export function impressLabel(v: number): string {
  if (v < 20) return 'awful';
  if (v < 30) return 'dull';
  if (v < 40) return 'mediocre';
  if (v < 50) return 'decent';
  if (v < 65) return 'slightly impressive';
  if (v < 85) return 'somewhat impressive';
  if (v < 120) return 'very impressive';
  if (v < 170) return 'extremely impressive';
  return 'wondrously impressive';
}

function autoRoof(w: World) {
  const m = w.map;
  for (const r of w.rooms) {
    if (r.outdoors || !r.unroofed || r.cells > 600 || r.faction < 0 || !w.isPlayerFaction(r.faction)) continue;
    const slot = w.slotOf(r.faction);
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
      const i = m.idx(x, y);
      if (m.roomId[i] !== r.id || m.roof[i] || m.roofDesig[i] || (m.noRoof[i] & (1 << slot))) continue;
      m.setRoofDesig(i, 1, r.faction);
    }
  }
}

export function roofSupported(w: World, x: number, y: number): boolean {
  const m = w.map;
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
    const xx = x + dx, yy = y + dy;
    if (!m.inb(xx, yy)) continue;
    const i = m.idx(xx, yy);
    if (m.rock[i]) return true;
    const bid = m.bld[i];
    if (bid) { const b = w.buildings.get(bid); if (b && BUILDINGS[b.def].supportsRoof) return true; }
  }
  return false;
}

/** after a support was removed near (x,y), collapse unsupported roofs */
export function checkRoofCollapse(w: World, x: number, y: number) {
  const m = w.map;
  const collapsed: number[] = [];
  for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
    const xx = x + dx, yy = y + dy;
    if (!m.inb(xx, yy)) continue;
    const i = m.idx(xx, yy);
    if (m.roof[i] !== ROOF.built && m.roof[i] !== ROOF.thin) continue;
    if (!roofSupported(w, xx, yy)) collapsed.push(i);
  }
  for (const i of collapsed) {
    m.setRoof(i, 0);
    const cx = i % m.w, cy = (i / m.w) | 0;
    m.addFilth(cx, cy, 5, 60);
    for (const p of w.pawnsAt(cx, cy)) applyDamage(w, p, { amount: w.rng.range(8, 20), type: 'crush', group: 'head' });
  }
  if (collapsed.length) {
    w.emit({ k: 'dust', x, y });
    w.sound('collapse', x, y);
  }
}

// ---------------- temperature ----------------
export function ambientTemp(w: World, x: number, y: number): number {
  const m = w.map;
  if (!m.inb(x, y)) return w.outdoorTemp;
  ensureRooms(w);
  const i = m.idx(x, y);
  const id = m.roomId[i];
  if (id) { const r = w.rooms[id - 1]; return r ? (r.outdoors ? w.outdoorTemp : r.temp) : w.outdoorTemp; }
  // wall/door cell: average neighbors
  let s = 0, n = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const xx = x + dx, yy = y + dy;
    if (!m.inb(xx, yy)) continue;
    const rid = m.roomId[m.idx(xx, yy)];
    if (rid) { const r = w.rooms[rid - 1]; s += r.outdoors ? w.outdoorTemp : r.temp; n++; }
  }
  return n ? s / n : w.outdoorTemp;
}

export function temperatureTick(w: World) {
  ensureRooms(w);
  const m = w.map;
  const out = w.outdoorTemp;
  const heat = new Float32Array(w.rooms.length + 1);
  // buildings
  for (const b of w.buildings.values()) {
    const d = BUILDINGS[b.def];
    if (d.heat) {
      const active = d.heat.power ? !!b.powered && b.on !== false : d.heat.fuel ? (b.fuel || 0) > 0 : true;
      if (!active) continue;
      const rid = m.roomId[m.idx(b.x, b.y)];
      if (!rid) continue;
      const r = w.rooms[rid - 1];
      if (r.outdoors) continue;
      const target = b.tgt ?? d.heat.target;
      if (d.heat.watts > 0 ? r.temp < target : r.temp > target) heat[rid] += d.heat.watts;
    } else if (d.cooler && b.powered && b.on !== false) {
      // cold side: front (rot direction), hot side: back
      const [fx, fy] = rotDir(b.rot);
      const cold = m.inb(b.x + fx, b.y + fy) ? m.roomId[m.idx(b.x + fx, b.y + fy)] : 0;
      const hot = m.inb(b.x - fx, b.y - fy) ? m.roomId[m.idx(b.x - fx, b.y - fy)] : 0;
      if (cold) { const r = w.rooms[cold - 1]; if (!r.outdoors && r.temp > (b.tgt ?? 21)) heat[cold] -= 30; }
      if (hot) { const r = w.rooms[hot - 1]; if (!r.outdoors) heat[hot] += 36; }
    } else if (d.vent && b.on !== false) {
      const a = m.inb(b.x + 1, b.y) ? m.roomId[m.idx(b.x + 1, b.y)] : 0, bb = m.inb(b.x - 1, b.y) ? m.roomId[m.idx(b.x - 1, b.y)] : 0;
      const c = m.inb(b.x, b.y + 1) ? m.roomId[m.idx(b.x, b.y + 1)] : 0, e = m.inb(b.x, b.y - 1) ? m.roomId[m.idx(b.x, b.y - 1)] : 0;
      const pair = a && bb && a !== bb ? [a, bb] : c && e && c !== e ? [c, e] : null;
      if (pair) {
        const r1 = w.rooms[pair[0] - 1], r2 = w.rooms[pair[1] - 1];
        const t1 = r1.outdoors ? out : r1.temp, t2 = r2.outdoors ? out : r2.temp;
        const flow = (t2 - t1) * 0.08;
        if (!r1.outdoors) r1.temp += flow * 20 / Math.max(20, r1.cells);
        if (!r2.outdoors) r2.temp -= flow * 20 / Math.max(20, r2.cells);
      }
    }
  }
  for (const f of w.fires.values()) {
    const rid = m.roomId[m.idx(f.x, f.y)];
    if (rid) heat[rid] += 40 * f.size;
  }
  for (const r of w.rooms) {
    if (r.outdoors) { r.temp = out; continue; }
    const openFrac = r.unroofed / r.cells;
    const k = 0.0035 + openFrac * 0.25;
    r.temp += (out - r.temp) * k;
    r.temp += heat[r.id] * 0.5 / Math.max(6, r.cells);
    r.temp = clamp(r.temp, -100, 200);
  }
}

export function rotDir(rot: number): [number, number] {
  return rot === 0 ? [0, 1] : rot === 1 ? [1, 0] : rot === 2 ? [0, -1] : [-1, 0];
}
