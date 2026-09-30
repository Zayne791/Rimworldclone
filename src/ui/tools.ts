// Map tools: building placement, designations, zones — all drag-paintable for touch.
import type { Game } from '../game';
import type { Renderer } from '../render/renderer';
import { BUILDINGS } from '../data/buildings';
import { TERRAIN } from '../data/terrain';
import { canPlaceBuilding } from '../sim/things';
import { isResearched } from '../sim/research';
import { buildingSprite, wallSprite } from '../render/art/buildings';
import { TILE } from '../core/constants';
import { stuffsFor } from '../data/items';

export interface Tool {
  id: string;
  label: string;
  hint: string;
  drag: boolean;
  rotatable?: boolean;
  rot?: number;
  stuff?: string;
  stuffOptions?: string[];
  tap(tx: number, ty: number): void;
  dragStart?(tx: number, ty: number): void;
  dragMove?(tx: number, ty: number): void;
  dragEnd?(tx: number, ty: number): void;
  cancelDrag?(): void;
  drawWorld?(ctx: CanvasRenderingContext2D, r: Renderer): void;
  hover?: [number, number] | null;
  icon?: string;
}

function rectCells(a: [number, number], b: [number, number]): [number, number][] {
  const out: [number, number][] = [];
  for (let y = Math.min(a[1], b[1]); y <= Math.max(a[1], b[1]); y++) for (let x = Math.min(a[0], b[0]); x <= Math.max(a[0], b[0]); x++) out.push([x, y]);
  return out;
}
function lineOrBox(a: [number, number], b: [number, number]): [number, number][] {
  const dx = Math.abs(b[0] - a[0]), dy = Math.abs(b[1] - a[1]);
  if (dx >= 2 && dy >= 2) {
    // hollow rectangle (instant room outline!)
    const out: [number, number][] = [];
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    for (let x = x0; x <= x1; x++) { out.push([x, y0]); out.push([x, y1]); }
    for (let y = y0 + 1; y < y1; y++) { out.push([x0, y]); out.push([x1, y]); }
    return out;
  }
  const out: [number, number][] = [];
  if (dx >= dy) for (let x = Math.min(a[0], b[0]); x <= Math.max(a[0], b[0]); x++) out.push([x, a[1]]);
  else for (let y = Math.min(a[1], b[1]); y <= Math.max(a[1], b[1]); y++) out.push([a[0], y]);
  return out;
}

abstract class AreaTool implements Tool {
  abstract id: string; abstract label: string; abstract hint: string;
  drag = true;
  start: [number, number] | null = null;
  end: [number, number] | null = null;
  hover: [number, number] | null = null;
  constructor(public g: Game) {}
  cells(): [number, number][] { return this.start && this.end ? rectCells(this.start, this.end) : []; }
  abstract apply(cells: [number, number][]): void;
  tap(tx: number, ty: number) { this.apply([[tx, ty]]); }
  dragStart(tx: number, ty: number) { this.start = [tx, ty]; this.end = [tx, ty]; }
  dragMove(tx: number, ty: number) { this.end = [tx, ty]; this.hover = [tx, ty]; }
  dragEnd(tx: number, ty: number) { this.end = [tx, ty]; const c = this.cells(); this.start = this.end = null; if (c.length) this.apply(c); }
  cancelDrag() { this.start = this.end = null; }
  color = 'rgba(255,255,255,0.25)';
  drawWorld(ctx: CanvasRenderingContext2D) {
    const cells = this.cells();
    if (!cells.length) return;
    ctx.fillStyle = this.color;
    for (const [x, y] of cells) ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
    ctx.strokeStyle = '#f4f0e8'; ctx.lineWidth = 1;
    ctx.strokeRect(x0 * TILE + 0.5, y0 * TILE + 0.5, (x1 - x0 + 1) * TILE - 1, (y1 - y0 + 1) * TILE - 1);
    this.g.setDragInfo(`${x1 - x0 + 1} × ${y1 - y0 + 1}`);
  }
  idx(cells: [number, number][]) { const m = this.g.world.map; return cells.filter(([x, y]) => m.inb(x, y)).map(([x, y]) => m.idx(x, y)); }
}

export class DesignateTool extends AreaTool {
  id: string; label: string; hint: string; icon: string;
  constructor(g: Game, public kind: string, label: string, hint: string, icon: string, color = 'rgba(255,220,120,0.28)') {
    super(g); this.id = 'desig:' + kind; this.label = label; this.hint = hint; this.icon = icon; this.color = color;
  }
  apply(cells: [number, number][]) { this.g.cmd({ c: 'designate', kind: this.kind, cells: this.idx(cells) }); this.g.audio.play('click'); }
}

export class ZoneTool extends AreaTool {
  id: string; label: string; hint: string; icon: string;
  zoneId = 0;
  constructor(g: Game, public kind: 'stockpile' | 'grow' | 'dump' | 'remove', label: string, hint: string, icon: string, public plant = 'potato', expandZone = 0) {
    super(g); this.id = 'zone:' + kind; this.label = label; this.hint = hint; this.icon = icon; this.zoneId = expandZone;
    this.color = kind === 'remove' ? 'rgba(255,90,90,0.3)' : kind === 'grow' ? 'rgba(120,220,90,0.35)' : 'rgba(230,200,90,0.35)';
  }
  async apply(cells: [number, number][]) {
    const idx = this.idx(cells);
    if (this.kind === 'remove') { this.g.cmd({ c: 'zone', op: 'remove', cells: idx }); return; }
    if (this.zoneId && this.g.world.zones.has(this.zoneId)) { this.g.cmd({ c: 'zone', op: 'add', zone: this.zoneId, cells: idx }); return; }
    const r = await this.g.cmdAsync({ c: 'zone', op: 'new', kind: this.kind, plant: this.plant, cells: idx });
    if (r?.ok && r.msg) this.zoneId = +r.msg;
    this.g.audio.play('click');
  }
}

export class FloorTool extends AreaTool {
  id: string; label: string; hint: string; icon: string;
  constructor(g: Game, public def: string) {
    super(g); const t = TERRAIN.find(t => t.id === def)!; this.id = 'floor:' + def; this.label = t.label; this.hint = 'Drag to lay flooring'; this.icon = 'build';
    this.color = 'rgba(120,180,255,0.35)';
  }
  apply(cells: [number, number][]) { this.g.cmd({ c: 'floor', def: this.def, cells: this.idx(cells) }); this.g.audio.play('place'); }
}

export class AreaSimpleTool extends AreaTool {
  id: string; label: string; hint: string; icon: string;
  constructor(g: Game, public kind: string, label: string, hint: string, icon: string, color: string) { super(g); this.id = 'area:' + kind; this.label = label; this.hint = hint; this.icon = icon; this.color = color; }
  apply(cells: [number, number][]) { this.g.cmd({ c: 'designate', kind: this.kind, cells: this.idx(cells) }); }
}

export class BuildTool implements Tool {
  id: string; label: string; hint: string;
  drag = true;
  rotatable: boolean;
  rot = 0;
  stuff?: string;
  stuffOptions?: string[];
  start: [number, number] | null = null;
  end: [number, number] | null = null;
  hover: [number, number] | null = null;
  linear: boolean;
  icon = 'build';
  constructor(public g: Game, public def: string, stuff?: string) {
    const d = BUILDINGS[def];
    this.id = 'build:' + def; this.label = d.label;
    this.rotatable = !!d.rotatable;
    this.linear = d.id === 'wall' || !!d.conduit || d.id === 'sandbags' || d.id === 'barricade' || d.id === 'spike_trap' || d.id === 'ship_beam';
    this.hint = this.linear ? 'Drag a line — or drag diagonally for a whole room outline' : 'Tap to place · drag to position';
    if (d.stuffCats) { this.stuffOptions = stuffsFor(d.stuffCats); this.stuff = stuff && this.stuffOptions.includes(stuff) ? stuff : this.stuffOptions.includes('wood') ? 'wood' : this.stuffOptions.includes('steel') ? 'steel' : this.stuffOptions[0]; }
  }
  size(): [number, number] { const d = BUILDINGS[this.def]; return this.g.world.rotSize(d.size, this.rotatable ? this.rot : 0); }
  anchor(tx: number, ty: number): [number, number] { const [w, h] = this.size(); return [tx - Math.floor((w - 1) / 2), ty - Math.floor((h - 1) / 2)]; }
  cells(): [number, number][] {
    if (!this.start || !this.end) return this.hover ? [this.anchor(...this.hover)] : [];
    if (this.linear) return lineOrBox(this.start, this.end);
    return [this.anchor(...this.end)];
  }
  place(cells: [number, number][]) {
    if (!cells.length) return;
    this.g.cmd({ c: 'build', def: this.def, stuff: this.stuff, rot: this.rot, cells });
    this.g.audio.play('place');
  }
  tap(tx: number, ty: number) { this.hover = [tx, ty]; this.place([this.anchor(tx, ty)]); }
  dragStart(tx: number, ty: number) { this.start = [tx, ty]; this.end = [tx, ty]; }
  dragMove(tx: number, ty: number) { this.end = [tx, ty]; this.hover = [tx, ty]; }
  dragEnd(tx: number, ty: number) { this.end = [tx, ty]; const c = this.cells(); this.start = this.end = null; this.hover = [tx, ty]; this.place(c); }
  cancelDrag() { this.start = this.end = null; }
  rotate() { this.rot = (this.rot + 1) % 4; }
  drawWorld(ctx: CanvasRenderingContext2D, r: Renderer) {
    const w = this.g.world;
    const d = BUILDINGS[this.def];
    const cells = this.cells();
    const f = this.g.faction;
    const researched = isResearched(w, f, d.research);
    for (const [x, y] of cells) {
      const ok = researched && canPlaceBuilding(w, this.def, x, y, this.rot, f).ok && !(d.conduit && w.map.inb(x, y) && w.map.conduit[w.map.idx(x, y)]);
      const [bw, bh] = this.size();
      ctx.globalAlpha = 0.65;
      const s = d.id === 'wall' ? wallSprite(this.stuff, 0) : buildingSprite(this.def, this.stuff, this.rot, { lit: true, powered: true });
      if (!d.conduit) ctx.drawImage(s.img, s.sx, s.sy, s.w, s.h, x * TILE + s.ox, y * TILE + s.oy, s.w, s.h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = ok ? 'rgba(80,220,120,0.28)' : 'rgba(255,60,60,0.35)';
      ctx.fillRect(x * TILE, y * TILE, bw * TILE, bh * TILE);
      if (d.interact && d.bench) {
        const [ix, iy] = w.interactCell({ def: this.def, x, y, rot: this.rotatable ? this.rot : 0 });
        ctx.strokeStyle = 'rgba(255,230,120,0.9)'; ctx.lineWidth = 1;
        ctx.strokeRect(ix * TILE + 3.5, iy * TILE + 3.5, TILE - 7, TILE - 7);
      }
    }
    if (this.linear && this.start && this.end) this.g.setDragInfo(`${cells.length} × ${d.label}`);
    // power range hint: show conduits when placing power things
    if (d.power || d.conduit) {
      const m = w.map;
      ctx.fillStyle = 'rgba(255,220,80,0.35)';
      const [cx, cy] = [r.cam.x / TILE, r.cam.y / TILE];
      for (let y = Math.max(0, Math.floor(cy - 40)); y < Math.min(m.h, cy + 40); y++) for (let x = Math.max(0, Math.floor(cx - 30)); x < Math.min(m.w, cx + 30); x++) if (m.conduit[y * m.w + x] === f) ctx.fillRect(x * TILE + 6, y * TILE + 6, 4, 4);
    }
  }
}

export class SelectBoxTool implements Tool {
  id = 'selectbox'; label = 'Box select'; hint = 'Drag a box to select several colonists'; drag = true; icon = 'select';
  start: [number, number] | null = null; end: [number, number] | null = null;
  constructor(public g: Game) {}
  tap(tx: number, ty: number) { this.g.selectAt(tx, ty, false, false); }
  dragStart(tx: number, ty: number) { this.start = [tx, ty]; this.end = [tx, ty]; }
  dragMove(tx: number, ty: number) { this.end = [tx, ty]; }
  dragEnd(tx: number, ty: number) {
    if (!this.start) return;
    const a = this.start, b = [tx, ty];
    this.start = this.end = null;
    this.g.boxSelect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), false);
    this.g.setTool(null);
  }
  cancelDrag() { this.start = this.end = null; }
  drawWorld(ctx: CanvasRenderingContext2D) {
    if (!this.start || !this.end) return;
    const x0 = Math.min(this.start[0], this.end[0]), y0 = Math.min(this.start[1], this.end[1]);
    const x1 = Math.max(this.start[0], this.end[0]), y1 = Math.max(this.start[1], this.end[1]);
    ctx.fillStyle = 'rgba(160,200,255,0.15)'; ctx.fillRect(x0 * TILE, y0 * TILE, (x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE);
    ctx.strokeStyle = '#cfe4ff'; ctx.lineWidth = 1; ctx.strokeRect(x0 * TILE + 0.5, y0 * TILE + 0.5, (x1 - x0 + 1) * TILE - 1, (y1 - y0 + 1) * TILE - 1);
  }
}

/** pick a target on the map (for "attack", "assign", etc.) */
export class TargetTool implements Tool {
  id = 'target'; drag = false; icon = 'target';
  constructor(public g: Game, public label: string, public hint: string, public onPick: (tx: number, ty: number) => void) {}
  tap(tx: number, ty: number) { this.onPick(tx, ty); this.g.setTool(null); }
}
