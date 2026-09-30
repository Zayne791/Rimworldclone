import { TERRAIN, ROCKS } from '../data/terrain';
import { PLANTS } from '../data/plants';

export const IMPASSABLE = 0xffff;
export const DESIG = { none: 0, mine: 1, cut: 2, harvest: 3, smooth: 4, chop: 5 } as const;
export const ROOF = { none: 0, built: 1, thin: 2, thick: 3 } as const;
export const FILTH = { none: 0, dirt: 1, blood: 2, vomit: 3, ash: 4, rubble: 5, animal: 6 } as const;
export const FILTH_LABELS = ['', 'dirt', 'blood', 'vomit', 'ash', 'rubble', 'animal filth'];
export const CHUNK = 16; // tiles per render chunk side

// Dirty flags per tile for replication/render
export const DIRTY_TERRAIN = 1, DIRTY_PLANT = 2, DIRTY_OVERLAY = 4;

function b64(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + 0x8000)));
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
export function encodeTA(a: Uint8Array | Uint16Array | Int32Array | Float32Array): string { return b64(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)); }
export function decodeTA<T extends Uint8Array | Uint16Array | Int32Array | Float32Array>(s: string, ctor: { new (buf: ArrayBuffer): T }): T {
  const u8 = unb64(s);
  const buf = new ArrayBuffer(u8.length);
  new Uint8Array(buf).set(u8);
  return new ctor(buf);
}

export class GameMap {
  w: number; h: number; n: number;
  terrain: Uint8Array; floor: Uint8Array; rock: Uint8Array; rockHp: Uint16Array;
  plant: Uint8Array; growth: Float32Array; roof: Uint8Array; snow: Uint8Array;
  zone: Uint16Array; desig: Uint8Array; desigF: Uint8Array; roofDesig: Uint8Array; roofDesigF: Uint8Array;
  noRoof: Uint8Array; home: Uint8Array; filth: Uint8Array; filthType: Uint8Array; conduit: Uint8Array;
  // occupancy (derived, rebuilt on load)
  bld: Int32Array; bp: Int32Array; bpFloor: Int32Array; fire: Int32Array;
  items: (number[] | undefined)[];
  pawns: (number[] | undefined)[];
  // derived caches
  cost: Uint16Array; door: Int32Array; sight: Uint8Array;
  region: Int32Array; regionDirty = true;
  /** like region, but doors split regions (for wild animals, which can't open colony doors) */
  regionND: Int32Array;
  roomId: Int32Array; roomsDirty = true;
  light: Float32Array; sunLamp: Uint8Array; lightDirty = true;
  lightColor: Uint8Array; // rgb per tile for artificial light
  // change tracking
  dirty = new Set<number>();          // for net replication
  chunkDirty: Uint8Array; chunksW: number; chunksH: number;
  stoneBase = 'granite';

  constructor(w: number, h: number) {
    this.w = w; this.h = h; this.n = w * h;
    const n = this.n;
    this.terrain = new Uint8Array(n); this.floor = new Uint8Array(n); this.rock = new Uint8Array(n); this.rockHp = new Uint16Array(n);
    this.plant = new Uint8Array(n); this.growth = new Float32Array(n); this.roof = new Uint8Array(n); this.snow = new Uint8Array(n);
    this.zone = new Uint16Array(n); this.desig = new Uint8Array(n); this.desigF = new Uint8Array(n);
    this.roofDesig = new Uint8Array(n); this.roofDesigF = new Uint8Array(n); this.noRoof = new Uint8Array(n); this.home = new Uint8Array(n);
    this.filth = new Uint8Array(n); this.filthType = new Uint8Array(n); this.conduit = new Uint8Array(n);
    this.bld = new Int32Array(n); this.bp = new Int32Array(n); this.bpFloor = new Int32Array(n); this.fire = new Int32Array(n);
    this.items = new Array(n); this.pawns = new Array(n);
    this.cost = new Uint16Array(n); this.door = new Int32Array(n); this.sight = new Uint8Array(n);
    this.region = new Int32Array(n); this.regionND = new Int32Array(n); this.roomId = new Int32Array(n);
    this.light = new Float32Array(n); this.sunLamp = new Uint8Array(n); this.lightColor = new Uint8Array(n * 3);
    this.chunksW = Math.ceil(w / CHUNK); this.chunksH = Math.ceil(h / CHUNK);
    this.chunkDirty = new Uint8Array(this.chunksW * this.chunksH).fill(3);
  }

  idx(x: number, y: number) { return y * this.w + x; }
  inb(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  xOf(i: number) { return i % this.w; }
  yOf(i: number) { return (i / this.w) | 0; }

  touch(i: number, render = true) {
    this.dirty.add(i);
    if (render) {
      const cx = ((i % this.w) / CHUNK) | 0, cy = (((i / this.w) | 0) / CHUNK) | 0;
      this.chunkDirty[cy * this.chunksW + cx] |= 1;
    }
  }
  /** terrain-level change: requires expensive base re-render of chunk (and neighbors at chunk borders) */
  touchBase(i: number) {
    this.dirty.add(i);
    const x = i % this.w, y = (i / this.w) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx * 2, yy = y + dy * 2;
      if (!this.inb(xx, yy)) continue;
      this.chunkDirty[((yy / CHUNK) | 0) * this.chunksW + ((xx / CHUNK) | 0)] |= 3;
    }
  }
  touchRegion() { this.regionDirty = true; this.roomsDirty = true; this.lightDirty = true; }

  terrainDef(i: number) { return TERRAIN[this.floor[i] || this.terrain[i]]; }
  baseTerrainDef(i: number) { return TERRAIN[this.terrain[i]]; }
  isWater(i: number) { return !this.floor[i] && !!TERRAIN[this.terrain[i]].water; }
  isDeepWater(i: number) { return !this.floor[i] && TERRAIN[this.terrain[i]].water === 'deep'; }
  fertility(i: number) { return this.floor[i] ? 0 : TERRAIN[this.terrain[i]].fert; }
  plantDef(i: number) { return this.plant[i] ? PLANTS[this.plant[i]] : null; }
  rockDef(i: number) { return this.rock[i] ? ROCKS[this.rock[i]] : null; }

  setTerrain(i: number, t: number) { this.terrain[i] = t; this.touchBase(i); this.updateCost(i); }
  setFloor(i: number, f: number) { this.floor[i] = f; this.touchBase(i); this.updateCost(i); }
  setRock(i: number, r: number, hp = 0) {
    this.rock[i] = r; this.rockHp[i] = r ? (hp || ROCKS[r].hp) : 0;
    if (!r && this.desig[i] === DESIG.mine) { this.desig[i] = 0; this.desigF[i] = 0; }
    this.touchBase(i); this.updateCost(i); this.touchRegion();
  }
  setPlant(i: number, p: number, growth = 0) {
    this.plant[i] = p; this.growth[i] = p ? growth : 0; this.touch(i); this.updateCost(i);
    if (!p && (this.desig[i] === DESIG.cut || this.desig[i] === DESIG.chop || this.desig[i] === DESIG.harvest)) this.setDesig(i, 0, 0);
  }
  setGrowth(i: number, g: number) {
    const q0 = Math.floor(this.growth[i] * 20), q1 = Math.floor(g * 20);
    const s0 = Math.floor(this.growth[i] * 4), s1 = Math.floor(g * 4);
    this.growth[i] = g;
    if (q0 !== q1) this.touch(i, s0 !== s1 || g >= 1);
  }
  setRoof(i: number, r: number) { if (this.roof[i] !== r) { this.roof[i] = r; this.touch(i, false); this.lightDirty = true; this.roomsDirty = true; } }
  setSnow(i: number, s: number) {
    const q0 = this.snow[i] >> 5, q1 = s >> 5;
    this.snow[i] = s;
    if (q0 !== q1) { this.touch(i); this.updateCost(i); }
  }
  setZone(i: number, z: number) { this.zone[i] = z; this.touch(i, false); }
  setDesig(i: number, d: number, f: number) { this.desig[i] = d; this.desigF[i] = d ? f : 0; this.touch(i, false); }
  setRoofDesig(i: number, d: number, f: number) { this.roofDesig[i] = d; this.roofDesigF[i] = d ? f : 0; this.touch(i, false); }
  setFilth(i: number, type: number, amt: number) {
    const q0 = this.filth[i] >> 4;
    this.filth[i] = Math.max(0, Math.min(255, amt)); this.filthType[i] = this.filth[i] ? type : 0;
    if (q0 !== this.filth[i] >> 4 || !this.filth[i]) this.touch(i);
  }
  addFilth(x: number, y: number, type: number, amt = 40) {
    if (!this.inb(x, y)) return;
    const i = this.idx(x, y);
    if (this.isWater(i) || this.rock[i] || this.terrainDef(i).noFilth) return;
    if (this.filth[i] && this.filthType[i] !== type && this.filth[i] > amt) return;
    this.setFilth(i, type, (this.filthType[i] === type ? this.filth[i] : 0) + amt);
  }
  setConduit(i: number, f: number) { this.conduit[i] = f; this.touch(i); }
  setHome(i: number, slot: number, on: boolean) {
    const bit = 1 << slot;
    const v = on ? this.home[i] | bit : this.home[i] & ~bit;
    if (v !== this.home[i]) { this.home[i] = v; this.touch(i, false); }
  }
  inHome(i: number, slot: number) { return (this.home[i] & (1 << slot)) !== 0; }

  addItemAt(i: number, id: number) { (this.items[i] ||= []).push(id); }
  removeItemAt(i: number, id: number) {
    const a = this.items[i]; if (!a) return;
    const k = a.indexOf(id); if (k >= 0) a.splice(k, 1);
    if (!a.length) this.items[i] = undefined;
  }
  addPawnAt(i: number, id: number) { (this.pawns[i] ||= []).push(id); }
  removePawnAt(i: number, id: number) {
    const a = this.pawns[i]; if (!a) return;
    const k = a.indexOf(id); if (k >= 0) a.splice(k, 1);
    if (!a.length) this.pawns[i] = undefined;
  }

  // ------------ pathing costs ------------
  /** buildingLookup provided by world so the map stays data-only */
  bldInfo: (id: number) => { pass: string; pathCost: number; isDoor: boolean; blocksLight: boolean } | null = () => null;

  updateCost(i: number) {
    let c = 0;
    let s = 0;
    if (this.rock[i]) { this.cost[i] = IMPASSABLE; this.sight[i] = 1; this.door[i] = 0; return; }
    const t = TERRAIN[this.floor[i] || this.terrain[i]];
    if (t.water === 'deep' && !this.floor[i]) { this.cost[i] = IMPASSABLE; this.sight[i] = 0; this.door[i] = 0; return; }
    c += t.moveCost;
    const bid = this.bld[i];
    this.door[i] = 0;
    if (bid) {
      const bi = this.bldInfo(bid);
      if (bi) {
        if (bi.pass === 'wall' || bi.pass === 'impassable') { this.cost[i] = IMPASSABLE; this.sight[i] = bi.blocksLight ? 1 : 0; return; }
        c += bi.pathCost;
        if (bi.isDoor) { this.door[i] = bid; s = 1; }
      }
    }
    const p = this.plant[i];
    if (p) c += PLANTS[p].pathCost;
    if (this.snow[i] > 60) c += (this.snow[i] >> 6) * 2;
    this.cost[i] = Math.min(c, 400);
    this.sight[i] = s;
  }
  rebuildCosts() { for (let i = 0; i < this.n; i++) this.updateCost(i); this.touchRegion(); }
  passable(i: number) { return this.cost[i] !== IMPASSABLE; }
  passableXY(x: number, y: number) { return this.inb(x, y) && this.cost[this.idx(x, y)] !== IMPASSABLE; }
  standable(i: number) { return this.cost[i] !== IMPASSABLE; }

  // ------------ connectivity regions ------------
  ensureRegions() {
    if (!this.regionDirty) return;
    this.regionDirty = false;
    this.flood(this.region, false);
    this.flood(this.regionND, true);
  }
  private flood(r: Int32Array, doorsBlock: boolean) {
    r.fill(0);
    const w = this.w, h = this.h, cost = this.cost, door = this.door;
    const open = (j: number) => cost[j] !== IMPASSABLE && !(doorsBlock && door[j]);
    const stack: number[] = [];
    let id = 0;
    for (let s = 0; s < this.n; s++) {
      if (r[s] || !open(s)) continue;
      id++; r[s] = id; stack.push(s);
      while (stack.length) {
        const i = stack.pop()!;
        const x = i % w, y = (i / w) | 0;
        if (x > 0) { const j = i - 1; if (!r[j] && open(j)) { r[j] = id; stack.push(j); } }
        if (x < w - 1) { const j = i + 1; if (!r[j] && open(j)) { r[j] = id; stack.push(j); } }
        if (y > 0) { const j = i - w; if (!r[j] && open(j)) { r[j] = id; stack.push(j); } }
        if (y < h - 1) { const j = i + w; if (!r[j] && open(j)) { r[j] = id; stack.push(j); } }
      }
    }
  }
  /** quick "could a path exist" test used to skip hopeless A* searches (tw/th = target rect, touch = adjacent ok) */
  maybeReachable(a: number, tx: number, ty: number, touch: boolean, tw: number, th: number, doorsBlock: boolean): boolean {
    this.ensureRegions();
    const R = doorsBlock ? this.regionND : this.region;
    const ra = R[a];
    if (!ra) return true; // standing somewhere odd (doorway, rubble): let A* decide
    const x0 = touch ? tx - 1 : tx, y0 = touch ? ty - 1 : ty, x1 = touch ? tx + tw : tx, y1 = touch ? ty + th : ty;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.inb(x, y) && R[y * this.w + x] === ra) return true;
    return false;
  }
  /** can a pawn standing at a reach cell b (or any passable neighbor of b if b is impassable) */
  connected(a: number, b: number, touch = true): boolean {
    this.ensureRegions();
    const ra = this.region[a];
    if (!ra) return false;
    if (this.region[b] === ra) return true;
    if (touch || this.cost[b] === IMPASSABLE) {
      const x = b % this.w, y = (b / this.w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (this.inb(nx, ny) && this.region[ny * this.w + nx] === ra) return true;
      }
    }
    return false;
  }

  // ------------ serialization ------------
  toJSON() {
    return {
      w: this.w, h: this.h, stoneBase: this.stoneBase,
      terrain: encodeTA(this.terrain), floor: encodeTA(this.floor), rock: encodeTA(this.rock), rockHp: encodeTA(this.rockHp),
      plant: encodeTA(this.plant), growth: encodeTA(this.growth), roof: encodeTA(this.roof), snow: encodeTA(this.snow),
      zone: encodeTA(this.zone), desig: encodeTA(this.desig), desigF: encodeTA(this.desigF), roofDesig: encodeTA(this.roofDesig),
      roofDesigF: encodeTA(this.roofDesigF), noRoof: encodeTA(this.noRoof), home: encodeTA(this.home), filth: encodeTA(this.filth),
      filthType: encodeTA(this.filthType), conduit: encodeTA(this.conduit),
    };
  }
  static fromJSON(d: any): GameMap {
    const m = new GameMap(d.w, d.h);
    m.stoneBase = d.stoneBase || 'granite';
    m.terrain = decodeTA(d.terrain, Uint8Array); m.floor = decodeTA(d.floor, Uint8Array); m.rock = decodeTA(d.rock, Uint8Array);
    m.rockHp = decodeTA(d.rockHp, Uint16Array); m.plant = decodeTA(d.plant, Uint8Array); m.growth = decodeTA(d.growth, Float32Array);
    m.roof = decodeTA(d.roof, Uint8Array); m.snow = decodeTA(d.snow, Uint8Array); m.zone = decodeTA(d.zone, Uint16Array);
    m.desig = decodeTA(d.desig, Uint8Array); m.desigF = decodeTA(d.desigF, Uint8Array); m.roofDesig = decodeTA(d.roofDesig, Uint8Array);
    m.roofDesigF = decodeTA(d.roofDesigF, Uint8Array); m.noRoof = decodeTA(d.noRoof, Uint8Array); m.home = decodeTA(d.home, Uint8Array);
    m.filth = decodeTA(d.filth, Uint8Array); m.filthType = decodeTA(d.filthType, Uint8Array); m.conduit = decodeTA(d.conduit, Uint8Array);
    return m;
  }
  /** compact per-tile record for replication */
  tileRecord(i: number): number[] {
    return [i, this.terrain[i], this.floor[i], this.rock[i], this.plant[i], Math.round(this.growth[i] * 100), this.roof[i], this.snow[i],
      this.zone[i], this.desig[i], this.desigF[i], this.roofDesig[i], this.home[i], this.filth[i], this.filthType[i], this.conduit[i], this.noRoof[i], this.rockHp[i]];
  }
  applyTileRecord(r: number[]) {
    const i = r[0];
    const rockChanged = this.rock[i] !== r[3];
    const baseChanged = rockChanged || this.terrain[i] !== r[1] || this.floor[i] !== r[2];
    this.terrain[i] = r[1]; this.floor[i] = r[2]; this.rock[i] = r[3]; this.plant[i] = r[4]; this.growth[i] = r[5] / 100; this.roof[i] = r[6];
    this.snow[i] = r[7]; this.zone[i] = r[8]; this.desig[i] = r[9]; this.desigF[i] = r[10]; this.roofDesig[i] = r[11]; this.home[i] = r[12];
    this.filth[i] = r[13]; this.filthType[i] = r[14]; this.conduit[i] = r[15]; this.noRoof[i] = r[16]; this.rockHp[i] = r[17];
    const cx = ((i % this.w) / CHUNK) | 0, cy = (((i / this.w) | 0) / CHUNK) | 0;
    this.chunkDirty[cy * this.chunksW + cx] |= 1;
    this.updateCost(i);
    this.lightDirty = true;
    if (rockChanged) this.touchRegion();
    if (baseChanged) this.touchBase(i);
    this.dirty.delete(i);
  }
}
