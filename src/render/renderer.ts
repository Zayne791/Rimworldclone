// Main world renderer: terrain chunks, y-sorted things, lighting, weather, effects and overlays.
import type { World } from '../sim/world';
import type { Pawn, Building, Item, Blueprint, FxEvent } from '../sim/types';
import { ChunkRenderer, drawSprite } from './chunks';
import { plantSprite, isFlatPlant } from './art/plants';
import { itemSprite, heldWeaponSprite } from './art/items';
import { buildingSprite, wallSprite, doorSprite, turretTopSprite, bladesSprite, stuffColor } from './art/buildings';
import { pawnSprite, lyingSprite } from './art/pawns';
import { Pix, C, addSprite, type Sprite, h2 } from './pixel';
import { BUILDINGS } from '../data/buildings';
import { ITEMS } from '../data/items';
import { TERRAIN } from '../data/terrain';
import { TILE } from '../core/constants';
import { sunLight, WEATHERS } from '../sim/environment';
import { weaponDef } from '../sim/stats';
import { clamp } from '../core/util';
import { iconURL } from './art/icons';

export interface Camera { x: number; y: number; zoom: number }
export interface Overlay { drawWorld?(ctx: CanvasRenderingContext2D, r: Renderer): void; drawScreen?(ctx: CanvasRenderingContext2D, r: Renderer): void }
export interface ViewOpts { faction: number; selection: Set<number>; overlay?: Overlay | null; zones: boolean; roofs: boolean; home: boolean; temps: boolean; beauty?: boolean; labels: boolean }

interface Particle { x: number; y: number; vx: number; vy: number; t: number; life: number; kind: string; c?: string; s?: string; size?: number }

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: World;
  chunks: ChunkRenderer;
  cam: Camera = { x: 0, y: 0, zoom: 3 };
  dpr = 1;
  vw = 0; vh = 0;
  lightCanvas: HTMLCanvasElement; lightCtx: CanvasRenderingContext2D; lightImg: ImageData;
  lastLight = 0;
  particles: Particle[] = [];
  weatherParts: Particle[] = [];
  texts: Particle[] = [];
  flash = 0;
  time = 0;
  frameNo = 0;
  glowSprite: HTMLCanvasElement;
  bpCache = new Map<string, HTMLCanvasElement>();
  desigIcons = new Map<string, HTMLImageElement>();
  opts: ViewOpts;
  pawnDraw = new Map<number, { x: number; y: number }>();
  shake = 0;

  constructor(canvas: HTMLCanvasElement, w: World, opts: ViewOpts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.w = w;
    this.opts = opts;
    this.chunks = new ChunkRenderer(w);
    this.lightCanvas = document.createElement('canvas');
    this.lightCanvas.width = w.map.w; this.lightCanvas.height = w.map.h;
    this.lightCtx = this.lightCanvas.getContext('2d')!;
    this.lightImg = this.lightCtx.createImageData(w.map.w, w.map.h);
    this.glowSprite = makeGlow();
    for (const n of ['mine', 'chop', 'harvest', 'cut', 'hunt', 'tame', 'slaughter', 'deconstruct', 'forbid', 'roof', 'fire']) {
      const img = new Image(); img.src = iconURL(n, 1); this.desigIcons.set(n, img);
    }
    this.resize();
  }

  setWorld(w: World) { this.w = w; this.chunks = new ChunkRenderer(w); this.lightCanvas.width = w.map.w; this.lightCanvas.height = w.map.h; this.lightImg = this.lightCtx.createImageData(w.map.w, w.map.h); }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    const r = this.canvas.getBoundingClientRect();
    this.vw = Math.max(1, Math.round(r.width * this.dpr)); this.vh = Math.max(1, Math.round(r.height * this.dpr));
    this.canvas.width = this.vw; this.canvas.height = this.vh;
  }

  // ---------- coordinates ----------
  screenToWorld(sx: number, sy: number): [number, number] {
    const z = this.cam.zoom;
    return [(sx * this.dpr - this.vw / 2) / z + this.cam.x, (sy * this.dpr - this.vh / 2) / z + this.cam.y];
  }
  screenToTile(sx: number, sy: number): [number, number] { const [x, y] = this.screenToWorld(sx, sy); return [Math.floor(x / TILE), Math.floor(y / TILE)]; }
  worldToScreen(wx: number, wy: number): [number, number] { const z = this.cam.zoom; return [((wx - this.cam.x) * z + this.vw / 2) / this.dpr, ((wy - this.cam.y) * z + this.vh / 2) / this.dpr]; }
  clampCam() {
    const m = this.w.map;
    const minZ = Math.max(0.6 * this.dpr, Math.min(this.vw / (m.w * TILE), this.vh / (m.h * TILE)) * 0.8);
    this.cam.zoom = clamp(this.cam.zoom, minZ, 10 * this.dpr);
    this.cam.x = clamp(this.cam.x, 0, m.w * TILE); this.cam.y = clamp(this.cam.y, 0, m.h * TILE);
  }
  centerOn(tx: number, ty: number) { this.cam.x = (tx + 0.5) * TILE; this.cam.y = (ty + 0.5) * TILE; this.clampCam(); }

  pawnPos(p: Pawn): [number, number] {
    const t = p.mp;
    return [(p.x + (p.nx - p.x) * t) * TILE, (p.y + (p.ny - p.y) * t) * TILE];
  }

  // ---------- fx ----------
  addFx(e: FxEvent) {
    const P = this.particles;
    const tx = (e.x + 0.5) * TILE, ty = (e.y + 0.5) * TILE;
    switch (e.k) {
      case 'text': this.texts.push({ x: tx, y: ty - 4, vx: 0, vy: -10, t: 0, life: 1.4, kind: 'text', s: e.s, c: e.c }); break;
      case 'muzzle': P.push({ x: tx, y: ty - 6, vx: 0, vy: 0, t: 0, life: 0.08, kind: 'muzzle' }); break;
      case 'hit': for (let k = 0; k < (e.s === 'flesh' ? 6 : 4); k++) P.push({ x: (e.x + 0.5) * TILE, y: (e.y + 0.5) * TILE - 5, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.8) * 50, t: 0, life: 0.35, kind: 'spark', c: e.s === 'flesh' ? '#b02020' : e.s === 'bld' ? '#c8b8a0' : '#ffe080' }); break;
      case 'spark': for (let k = 0; k < 6; k++) P.push({ x: tx, y: ty - 6, vx: (Math.random() - 0.5) * 90, vy: (Math.random() - 1) * 70, t: 0, life: 0.4, kind: 'spark', c: '#9fd8ff' }); break;
      case 'explosion': {
        const r = (e.x2 || 2) * TILE;
        P.push({ x: tx, y: ty, vx: 0, vy: 0, t: 0, life: 0.45, kind: 'boom', size: r });
        for (let k = 0; k < 24; k++) { const a = Math.random() * Math.PI * 2, s = 20 + Math.random() * 60; P.push({ x: tx, y: ty, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, t: 0, life: 0.8 + Math.random() * 0.8, kind: 'smoke', size: 3 + Math.random() * 4 }); }
        this.shake = Math.min(1, this.shake + 0.5);
        break;
      }
      case 'dust': for (let k = 0; k < 6; k++) P.push({ x: tx + (Math.random() - 0.5) * 12, y: ty + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 20, vy: -8 - Math.random() * 10, t: 0, life: 0.7, kind: 'dust', size: 2 + Math.random() * 3 }); break;
      case 'droppod': P.push({ x: tx, y: ty - 300, vx: 0, vy: 700, t: 0, life: 0.45, kind: 'pod', size: ty }); break;
      case 'lightning': this.flash = 1; break;
      case 'zzz': P.push({ x: tx + 4, y: ty - 10, vx: 6, vy: -10, t: 0, life: 1.6, kind: 'z' }); break;
      case 'work': if (Math.random() < 0.5) P.push({ x: tx + (Math.random() - 0.5) * 10, y: ty - 4, vx: (Math.random() - 0.5) * 20, vy: -20, t: 0, life: 0.3, kind: 'spark', c: '#e8dcb0' }); break;
      case 'toss': P.push({ x: tx, y: ty - 6, vx: ((e.x2! - e.x) * TILE) / 0.6, vy: ((e.y2! - e.y) * TILE) / 0.6 - 50, t: 0, life: 0.6, kind: 'shoe' }); break;
      case 'launch': for (let k = 0; k < 60; k++) P.push({ x: tx + (Math.random() - 0.5) * 30, y: ty, vx: (Math.random() - 0.5) * 80, vy: -Math.random() * 120, t: 0, life: 2 + Math.random() * 2, kind: 'smoke', size: 5 + Math.random() * 6 }); this.flash = 0.6; break;
    }
  }

  // ---------- lighting ----------
  skyColor(): [number, number, number] {
    const s = sunLight(this.w);
    const h = this.w.hour;
    const dusk = (h > 16 && h < 21) || (h > 4 && h < 8);
    const night: [number, number, number] = [42, 52, 96];
    const day: [number, number, number] = [255, 253, 246];
    let c: [number, number, number] = [night[0] + (day[0] - night[0]) * s, night[1] + (day[1] - night[1]) * s, night[2] + (day[2] - night[2]) * s];
    if (dusk && s > 0.05 && s < 0.95) { const k = 1 - Math.abs(s - 0.5) * 2; c = [c[0], c[1] - 40 * k, c[2] - 70 * k]; }
    if (this.w.hasCondition('aurora') && s < 0.3) c = [c[0], c[1] + 30, c[2] + 20];
    return c;
  }
  updateLight() {
    const m = this.w.map;
    const art = (this.w._cache.artLight as Float32Array | undefined) || m.light;
    const d = this.lightImg.data;
    const sky = this.skyColor();
    const lc = m.lightColor;
    for (let i = 0; i < m.n; i++) {
      const o = i * 4;
      const roofed = m.roof[i] > 0 || m.rock[i] > 0;
      let r: number, g: number, b: number;
      if (roofed) { r = 34; g = 36; b = 52; if (m.rock[i]) { r = sky[0] * 0.5 + 20; g = sky[1] * 0.5 + 20; b = sky[2] * 0.5 + 26; } }
      else { r = sky[0]; g = sky[1]; b = sky[2]; }
      const a = art ? art[i] : 0;
      if (a > 0) {
        const f = Math.min(1, a * 1.15);
        r = Math.max(r, lc[i * 3] * f); g = Math.max(g, lc[i * 3 + 1] * f); b = Math.max(b, lc[i * 3 + 2] * f);
      }
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    }
    this.lightCtx.putImageData(this.lightImg, 0, 0);
  }

  // ---------- main draw ----------
  draw(dt: number) {
    this.time += dt;
    this.frameNo++;
    const ctx = this.ctx;
    const w = this.w, m = w.map;
    const z = this.cam.zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0d0b12';
    ctx.fillRect(0, 0, this.vw, this.vh);
    let sx = 0, sy = 0;
    if (this.shake > 0.01) { sx = (Math.random() - 0.5) * this.shake * 6 * this.dpr; sy = (Math.random() - 0.5) * this.shake * 6 * this.dpr; this.shake *= 0.9; }
    const ox = Math.round(-this.cam.x * z + this.vw / 2 + sx), oy = Math.round(-this.cam.y * z + this.vh / 2 + sy);
    ctx.setTransform(z, 0, 0, z, ox, oy);
    const x0 = -ox / z, y0 = -oy / z, x1 = x0 + this.vw / z, y1 = y0 + this.vh / z;
    const tx0 = Math.max(0, Math.floor(x0 / TILE) - 1), ty0 = Math.max(0, Math.floor(y0 / TILE) - 1);
    const tx1 = Math.min(m.w - 1, Math.ceil(x1 / TILE) + 1), ty1 = Math.min(m.h - 1, Math.ceil(y1 / TILE) + 3);
    this.chunks.draw(ctx, x0, y0, x1, y1, 3);
    this.drawWater(ctx, tx0, ty0, tx1, ty1);
    this.drawZoneOverlays(ctx, tx0, ty0, tx1, ty1);
    // floor-level buildings, floor blueprints
    const drawn = new Set<number>();
    const ysort: { y: number; f: () => void }[] = [];
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = ty * m.w + tx;
      const bid = m.bld[i];
      if (bid && !drawn.has(bid)) {
        const b = w.buildings.get(bid);
        if (b) {
          drawn.add(bid);
          const d = BUILDINGS[b.def];
          if (d.floorLevel || d.storage || d.natural && d.id === 'geyser') this.drawBuilding(ctx, b);
          else { const [, bh] = w.rotSize(d.size, b.rot); const yy = (b.y + bh) * TILE; ysort.push({ y: yy, f: () => this.drawBuilding(ctx, b) }); }
        }
      }
      const fbp = m.bpFloor[i];
      if (fbp) { const bp = w.blueprints.get(fbp); if (bp) this.drawBlueprint(ctx, bp); }
    }
    // items
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const ids = m.items[ty * m.w + tx];
      if (!ids) continue;
      let k = 0;
      for (const id of ids) { const it = w.items.get(id); if (it) { this.drawItem(ctx, it, k); k++; } }
    }
    // plants (non-flat), building blueprints, fires, pawns
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = ty * m.w + tx;
      const p = m.plant[i];
      if (p && !isFlatPlant(p)) {
        const sp = plantSprite(p, m.growth[i], (i * 2654435761) >>> 29);
        if (sp) { const flip = ((i * 7919) & 1) === 1; ysort.push({ y: (ty + 1) * TILE - 0.5, f: () => drawSprite(ctx, sp, tx * TILE, ty * TILE, flip) }); }
      }
      const bpid = m.bp[i];
      if (bpid && !drawn.has(bpid)) { drawn.add(bpid); const bp = w.blueprints.get(bpid); if (bp) ysort.push({ y: (ty + 1) * TILE, f: () => this.drawBlueprint(ctx, bp) }); }
      const fid = m.fire[i];
      if (fid) { const f = w.fires.get(fid); if (f) ysort.push({ y: (ty + 1) * TILE + 0.1, f: () => this.drawFire(ctx, f.x, f.y, f.size) }); }
    }
    for (const p of w.pawns.values()) {
      if (p.x < tx0 - 2 || p.x > tx1 + 2 || p.y < ty0 - 2 || p.y > ty1 + 2) continue;
      const [px, py] = this.smoothPos(p, dt);
      ysort.push({ y: py + TILE - (p.downed ? 6 : 0) + 0.2, f: () => this.drawPawn(ctx, p, px, py) });
    }
    ysort.sort((a, b) => a.y - b.y);
    for (const d of ysort) d.f();
    // designations & selection
    this.drawDesignations(ctx, tx0, ty0, tx1, ty1);
    this.drawProjectiles(ctx, dt);
    this.drawParticles(ctx, dt, 'world');
    this.drawSelection(ctx);
    this.opts.overlay?.drawWorld?.(ctx, this);
    // lighting
    if (this.frameNo % 8 === 1 || this.time - this.lastLight > 0.3) { this.updateLight(); this.lastLight = this.time; }
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.lightCanvas, 0, 0, m.w, m.h, 0, 0, m.w * TILE, m.h * TILE);
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'lighter';
    this.drawGlows(ctx, tx0, ty0, tx1, ty1);
    ctx.globalCompositeOperation = 'source-over';
    this.drawParticles(ctx, dt, 'post');
    // screen space
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawWeather(ctx, dt);
    this.drawTexts(ctx, dt);
    if (this.opts.labels) this.drawLabels(ctx);
    this.opts.overlay?.drawScreen?.(ctx, this);
    if (this.flash > 0) { ctx.fillStyle = `rgba(230,240,255,${this.flash * 0.6})`; ctx.fillRect(0, 0, this.vw, this.vh); this.flash = Math.max(0, this.flash - dt * 3); }
  }

  smoothPos(p: Pawn, dt: number): [number, number] {
    const [tx, ty] = this.pawnPos(p);
    if (this.w.mode === 'host') return [tx, ty];
    const cur = this.pawnDraw.get(p.id);
    if (!cur || Math.abs(cur.x - tx) > 48 || Math.abs(cur.y - ty) > 48) { this.pawnDraw.set(p.id, { x: tx, y: ty }); return [tx, ty]; }
    const k = Math.min(1, dt * 12);
    cur.x += (tx - cur.x) * k; cur.y += (ty - cur.y) * k;
    return [cur.x, cur.y];
  }

  drawWater(ctx: CanvasRenderingContext2D, tx0: number, ty0: number, tx1: number, ty1: number) {
    const m = this.w.map;
    const t = this.time;
    ctx.fillStyle = 'rgba(220,240,255,0.55)';
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = ty * m.w + tx;
      if (m.floor[i] || !TERRAIN[m.terrain[i]].water) continue;
      const ph = h2(tx, ty, 7) * 6.28;
      const v = Math.sin(t * 1.6 + ph);
      if (v > 0.93) { const x = tx * TILE + ((h2(tx, ty, 8) * 12) | 0), y = ty * TILE + ((h2(tx, ty, 9) * 14) | 0); ctx.fillRect(x, y, 3, 1); }
    }
  }

  drawZoneOverlays(ctx: CanvasRenderingContext2D, tx0: number, ty0: number, tx1: number, ty1: number) {
    const m = this.w.map;
    const o = this.opts;
    const slot = this.w.slotOf(o.faction);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = ty * m.w + tx;
      const zid = m.zone[i];
      if (zid && (o.zones || true)) {
        const z = this.w.zones.get(zid);
        if (z) {
          const own = z.faction === o.faction;
          ctx.fillStyle = z.color + (o.zones ? (own ? '55' : '22') : own ? '26' : '10');
          ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
          if (o.zones || own) {
            ctx.fillStyle = z.color + (o.zones ? 'cc' : '66');
            if (ty === 0 || m.zone[i - m.w] !== zid) ctx.fillRect(tx * TILE, ty * TILE, TILE, 1);
            if (ty === m.h - 1 || m.zone[i + m.w] !== zid) ctx.fillRect(tx * TILE, ty * TILE + TILE - 1, TILE, 1);
            if (tx === 0 || m.zone[i - 1] !== zid) ctx.fillRect(tx * TILE, ty * TILE, 1, TILE);
            if (tx === m.w - 1 || m.zone[i + 1] !== zid) ctx.fillRect(tx * TILE + TILE - 1, ty * TILE, 1, TILE);
          }
        }
      }
      if (o.home) {
        if (m.home[i] & (1 << slot)) { ctx.fillStyle = 'rgba(80,160,255,0.22)'; ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE); }
        for (const pl of this.w.players) if (pl.slot !== slot && (m.home[i] & (1 << pl.slot))) { ctx.fillStyle = pl.color + '30'; ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE); }
      }
      if (o.roofs) {
        const r = m.roof[i];
        if (r && !m.rock[i]) { ctx.fillStyle = r === 3 ? 'rgba(40,20,20,0.55)' : r === 2 ? 'rgba(120,80,60,0.45)' : 'rgba(255,220,120,0.35)'; ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE); }
        if (m.noRoof[i] & (1 << slot)) { ctx.strokeStyle = 'rgba(255,90,90,0.8)'; ctx.lineWidth = 1; ctx.strokeRect(tx * TILE + 2, ty * TILE + 2, TILE - 4, TILE - 4); }
      }
    }
    if (o.temps) {
      ctx.font = '5px monospace';
      for (const r of this.w.rooms) {
        if (r.outdoors || r.cells < 2) continue;
        if (r.x1 < tx0 || r.x0 > tx1 || r.y1 < ty0 || r.y0 > ty1) continue;
        const t = Math.round(r.temp);
        const col = t < 0 ? 'rgba(80,140,255,0.3)' : t > 30 ? 'rgba(255,90,60,0.3)' : 'rgba(120,255,140,0.18)';
        for (let ty = r.y0; ty <= r.y1; ty++) for (let tx = r.x0; tx <= r.x1; tx++) if (m.roomId[ty * m.w + tx] === r.id) { ctx.fillStyle = col; ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE); }
      }
    }
  }

  wallMask(x: number, y: number, self: Building): number {
    const w = this.w, m = w.map;
    const isW = (xx: number, yy: number) => {
      if (!m.inb(xx, yy)) return true;
      const i = m.idx(xx, yy);
      if (m.rock[i]) return true;
      const b = m.bld[i] ? w.buildings.get(m.bld[i]) : undefined;
      return !!b && (b.def === self.def || BUILDINGS[b.def].isDoor || BUILDINGS[b.def].wallMounted || b.def === 'wall');
    };
    return (isW(x, y - 1) ? 1 : 0) | (isW(x + 1, y) ? 2 : 0) | (isW(x, y + 1) ? 4 : 0) | (isW(x - 1, y) ? 8 : 0);
  }

  drawBuilding(ctx: CanvasRenderingContext2D, b: Building) {
    const d = BUILDINGS[b.def];
    const X = b.x * TILE, Y = b.y * TILE;
    if (d.linked && (b.def === 'wall')) {
      const dmg = b.hp < d.hp * 0.5 ? 1 : 0;
      drawSprite(ctx, wallSprite(b.stuff, this.wallMask(b.x, b.y, b), dmg), X, Y);
      return;
    }
    if (d.linked) { drawSprite(ctx, buildingSprite(b.def, b.stuff, 0), X, Y); return; }
    if (d.isDoor) {
      const m = this.w.map;
      const wl = (xx: number, yy: number) => { if (!m.inb(xx, yy)) return false; const i = m.idx(xx, yy); if (m.rock[i]) return true; const o = m.bld[i] ? this.w.buildings.get(m.bld[i]) : null; return !!o && (o.def === 'wall' || BUILDINGS[o.def].isDoor); };
      const horiz = wl(b.x - 1, b.y) || wl(b.x + 1, b.y) || !(wl(b.x, b.y - 1) || wl(b.x, b.y + 1));
      drawSprite(ctx, doorSprite(b.def, b.stuff, horiz, (b.open || 0) > 0), X, Y);
      return;
    }
    const state: any = {};
    if (d.light) state.lit = d.light.fuel ? (b.fuel || 0) > 0 : !!b.powered;
    if (d.bench) state.lit = (b.users && b.users.length > 0) && (d.bench.fuel ? (b.fuel || 0) > 0 : true);
    if (d.power?.use) state.powered = !!b.powered;
    if (d.power?.battery) state.charge = (b.stored || 0) / d.power.battery;
    if (d.power?.kind === 'fuel') state.lit = (b.fuel || 0) > 0;
    if (d.plantPot) state.plant = b.plant;
    if (d.art) state.seed = b.id;
    if (d.grave) state.filled = !!b.graveCorpse;
    if (d.ship === 'reactor') state.active = !!b.reactor?.started;
    if (d.growBasin) state.powered = !!b.powered;
    const s = buildingSprite(b.def, b.stuff, b.rot, state);
    drawSprite(ctx, s, X, Y);
    if (d.turret) { const t = turretTopSprite(b.aim || 0); drawSprite(ctx, t, X, Y); }
    if (d.id === 'gen_wind') { const fr = Math.floor(this.time * (2 + this.w.weather.windSpeed * 14)); drawSprite(ctx, bladesSprite(fr), X, Y); }
    if (d.id === 'gen_geo' || d.id === 'geyser') { if (Math.random() < 0.08) this.particles.push({ x: X + 16 + (Math.random() - 0.5) * 8, y: Y + 8, vx: (Math.random() - 0.5) * 6, vy: -18, t: 0, life: 1.5, kind: 'steam', size: 3 + Math.random() * 3 }); }
    if (d.id === 'campfire' || d.id === 'torch') { if ((b.fuel || 0) > 0) this.drawFlame(ctx, X + 8, Y + (d.id === 'torch' ? -2 : 10), d.id === 'torch' ? 0.6 : 1); }
    if (d.fuel && (b.fuel || 0) <= 0 && this.w.isPlayerFaction(b.faction)) this.drawMiniIcon(ctx, 'fire', X + 4, Y - 6);
    if (b.desig === 'deconstruct') this.drawMiniIcon(ctx, 'deconstruct', X + 4, Y + 4);
    if (b.forbidden) this.drawMiniIcon(ctx, 'forbid', X + 8, Y);
    if (d.power?.use && !b.powered && b.on !== false && this.w.isPlayerFaction(b.faction) && (this.frameNo >> 5) % 2) { ctx.fillStyle = '#ffd24a'; ctx.fillRect(X + 11, Y + 1, 3, 4); ctx.fillRect(X + 10, Y + 3, 3, 3); }
    const hpMax = b.hp;
  }

  bpSprite(s: Sprite, key: string): HTMLCanvasElement {
    let c = this.bpCache.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = s.w; c.height = s.h;
    const cx = c.getContext('2d')!;
    cx.drawImage(s.img, s.sx, s.sy, s.w, s.h, 0, 0, s.w, s.h);
    const img = cx.getImageData(0, 0, s.w, s.h);
    for (let i = 0; i < img.data.length; i += 4) {
      if (!img.data[i + 3]) continue;
      const l = (img.data[i] * 0.3 + img.data[i + 1] * 0.59 + img.data[i + 2] * 0.11) / 255;
      img.data[i] = 60 + l * 80; img.data[i + 1] = 130 + l * 90; img.data[i + 2] = 230; img.data[i + 3] = 170;
    }
    cx.putImageData(img, 0, 0);
    this.bpCache.set(key, c);
    return c;
  }

  drawBlueprint(ctx: CanvasRenderingContext2D, bp: Blueprint) {
    const X = bp.x * TILE, Y = bp.y * TILE;
    const own = bp.faction === this.opts.faction;
    ctx.globalAlpha = own ? (bp.started ? 0.95 : 0.7) : 0.35;
    if (bp.floor) {
      ctx.fillStyle = 'rgba(90,160,240,0.35)'; ctx.fillRect(X, Y, TILE, TILE);
      ctx.fillStyle = 'rgba(160,210,255,0.6)'; ctx.fillRect(X, Y, TILE, 1); ctx.fillRect(X, Y, 1, TILE);
    } else {
      const d = BUILDINGS[bp.def];
      if (d.conduit) { ctx.fillStyle = 'rgba(120,180,255,0.7)'; ctx.fillRect(X + 6, Y + 6, 4, 4); }
      else {
        const s = d.id === 'wall' ? wallSprite(bp.stuff, 0) : d.isDoor ? doorSprite(bp.def, bp.stuff, true, false) : buildingSprite(bp.def, bp.stuff, bp.rot, {});
        const c = this.bpSprite(s, bp.def + ':' + bp.stuff + ':' + bp.rot);
        ctx.drawImage(c, X + s.ox, Y + s.oy);
        if (bp.work > 0) {
          const [bw] = this.w.rotSize(d.size, bp.rot);
          const pct = Math.min(1, bp.work / Math.max(1, (d.work || 1)));
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(X + 2, Y + 13, bw * TILE - 4, 2);
          ctx.fillStyle = '#7fd0ff'; ctx.fillRect(X + 2, Y + 13, (bw * TILE - 4) * pct, 2);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  drawItem(ctx: CanvasRenderingContext2D, it: Item, k: number) {
    const X = it.x * TILE + (k ? 2 : 0), Y = it.y * TILE - (k ? 3 : 0);
    if (it.corpse) {
      const s = lyingSprite(it.corpse, true);
      drawSprite(ctx, s, X, Y);
    } else {
      const s = itemSprite(it.def, it.stuff, it.color);
      drawSprite(ctx, s, X, Y);
      if (it.count > 1 && this.cam.zoom > 2.2 * this.dpr) {
        const txt = it.count >= 1000 ? Math.floor(it.count / 1000) + 'k' : String(it.count);
        drawTinyNumber(ctx, txt, X + 15, Y + 11);
      }
    }
    if (it.forbidden) this.drawMiniIcon(ctx, 'forbid', X + 8, Y);
  }

  drawPawn(ctx: CanvasRenderingContext2D, p: Pawn, px: number, py: number) {
    const w = this.w;
    const moving = p.mp > 0 || (p.path && p.path.length > 0 && p.pi < p.path.length);
    const frame = moving ? Math.floor(this.time * 7 + p.id) % 2 : 0;
    const inBed = !!(p.asleep && p.job && (p.job.type === 'sleep' || p.job.type === 'rest') && p.job.t);
    if (p.downed || inBed) {
      const s = lyingSprite(p, false);
      drawSprite(ctx, s, px, py);
    } else {
      const facing = p.rot === 0 ? 0 : p.rot === 1 ? 1 : p.rot === 2 ? 2 : 3;
      if (p.race !== 'human') { if (p.rot === 1 || p.rot === 3) (p as any)._lastH = p.rot; }
      const aimAngle = p.aimX !== undefined && (p.job?.type === 'attack' || p.drafted) ? Math.atan2((p.aimY! - p.y), (p.aimX! - p.x)) : null;
      let face = facing;
      if (aimAngle !== null && p.race === 'human') { const a = aimAngle; face = Math.abs(Math.cos(a)) > 0.6 ? (Math.cos(a) > 0 ? 1 : 3) : Math.sin(a) > 0 ? 0 : 2; }
      const { s, flip } = pawnSprite(p, face, frame, p.drafted);
      const bob = p.asleep ? 0 : 0;
      drawSprite(ctx, s, px, py + bob, flip);
      // weapon
      if (p.race === 'human' && p.equip && (p.drafted || p.job?.type === 'attack' || p.job?.type === 'wait' && p.lord)) {
        const a = aimAngle ?? (face === 1 ? 0 : face === 3 ? Math.PI : face === 0 ? Math.PI / 2 : -Math.PI / 2);
        const { s: ws, flip: wf } = heldWeaponSprite(p.equip.def, p.equip.stuff, a);
        const hx = px + 8 + Math.cos(a) * 3, hy = py + 3 + Math.sin(a) * 2;
        if (face === 2) { /* behind body: skip drawing over */ }
        ctx.save();
        ctx.translate(hx, hy);
        if (wf) ctx.scale(-1, 1);
        ctx.drawImage(ws.img, ws.sx, ws.sy, ws.w, ws.h, ws.ox, ws.oy, ws.w, ws.h);
        ctx.restore();
      }
      if (p.carry) {
        const cs = p.carry.corpse ? lyingSprite(p.carry.corpse, true) : itemSprite(p.carry.def, p.carry.stuff, p.carry.color);
        ctx.drawImage(cs.img, cs.sx, cs.sy, cs.w, cs.h, px + 3, py - 1, cs.w * 0.65, cs.h * 0.65);
      }
    }
    // status icons
    if (p.mental) { ctx.fillStyle = p.mental.kind === 'berserk' ? '#ff3030' : '#ffb030'; ctx.fillRect(px + 7, py - 12, 2, 4); ctx.fillRect(px + 7, py - 7, 2, 2); }
    if (p.bubble && p.bubble.t > w.tick) this.drawBubble(ctx, px + 10, py - 14, p.bubble.icon);
    if (p.desig && p.race !== 'human') this.drawMiniIcon(ctx, p.desig, px + 4, py - 10);
    if (p.drafted) { ctx.fillStyle = '#e05040'; ctx.fillRect(px + 3, py + 16, 10, 1); }
    if (p.guest?.prisoner) { ctx.fillStyle = '#f0a030'; ctx.fillRect(px + 3, py + 16, 10, 1); }
    // faction ring for other players' pawns & hostiles
    const own = p.faction === this.opts.faction;
    if (!own && p.race === 'human' && !p.dead) {
      const hostile = w.hostile(this.opts.faction, p.faction);
      const pl = w.playerByFaction(p.faction);
      ctx.fillStyle = hostile ? '#ff4040' : pl ? pl.color : '#b0d0ff';
      ctx.fillRect(px + 4, py + 17, 8, 1);
    }
  }

  drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, icon: string) {
    ctx.fillStyle = '#f4f0e8'; ctx.fillRect(x - 4, y - 3, 9, 7); ctx.fillRect(x - 3, y - 4, 7, 9);
    ctx.fillStyle = '#1c1622';
    const c = icon === 'heart' ? '#e04060' : icon === 'insult' ? '#e05020' : icon === 'deep' ? '#5a80e0' : icon === 'think' ? '#a070e0' : '#6a6a78';
    ctx.fillStyle = c;
    if (icon === 'heart') { ctx.fillRect(x - 2, y - 1, 2, 2); ctx.fillRect(x + 1, y - 1, 2, 2); ctx.fillRect(x - 1, y + 1, 3, 1); ctx.fillRect(x, y + 2, 1, 1); }
    else if (icon === 'insult') { ctx.fillRect(x - 2, y - 2, 1, 1); ctx.fillRect(x + 2, y - 2, 1, 1); ctx.fillRect(x - 1, y + 1, 3, 1); ctx.fillRect(x - 2, y + 2, 1, 1); ctx.fillRect(x + 2, y + 2, 1, 1); }
    else { ctx.fillRect(x - 2, y, 1, 1); ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 2, y, 1, 1); }
  }

  drawMiniIcon(ctx: CanvasRenderingContext2D, name: string, x: number, y: number) {
    const img = this.desigIcons.get(name);
    if (img && img.complete) ctx.drawImage(img, x, y, 8, 8);
  }

  drawFlame(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
    const t = this.time * 10;
    const cols = ['#ff5020', '#ff9020', '#ffd040', '#fff4b0'];
    for (let k = 0; k < 4; k++) {
      const hgt = (6 - k * 1.3) * s * (0.8 + 0.3 * Math.sin(t + k * 2));
      const wid = (5 - k * 1.1) * s;
      ctx.fillStyle = cols[k];
      ctx.fillRect(Math.round(x - wid / 2 + Math.sin(t * 0.7 + k) * 0.6), Math.round(y - hgt), Math.max(1, Math.round(wid)), Math.max(1, Math.round(hgt)));
    }
    if (Math.random() < 0.15) this.particles.push({ x, y: y - 4, vx: (Math.random() - 0.5) * 10, vy: -25, t: 0, life: 0.6, kind: 'ember' });
  }

  drawFire(ctx: CanvasRenderingContext2D, tx: number, ty: number, size: number) {
    const s = Math.min(1.6, 0.5 + size);
    const X = tx * TILE + 8, Y = ty * TILE + 14;
    this.drawFlame(ctx, X - 3, Y, s * 0.8);
    this.drawFlame(ctx, X + 3, Y + 1, s * 0.7);
    this.drawFlame(ctx, X, Y - 1, s);
    if (Math.random() < 0.1) this.particles.push({ x: X, y: Y - 10, vx: (Math.random() - 0.5) * 8, vy: -15, t: 0, life: 1.5, kind: 'smoke', size: 3 + Math.random() * 3 });
  }

  drawGlows(ctx: CanvasRenderingContext2D, tx0: number, ty0: number, tx1: number, ty1: number) {
    const night = 1 - sunLight(this.w);
    const g = this.glowSprite;
    for (const f of this.w.fires.values()) {
      if (f.x < tx0 || f.x > tx1 || f.y < ty0 || f.y > ty1) continue;
      const r = (2 + f.size * 2.5) * TILE * (0.9 + Math.sin(this.time * 9 + f.id) * 0.08);
      ctx.globalAlpha = 0.35 + night * 0.35;
      ctx.drawImage(g, (f.x + 0.5) * TILE - r, (f.y + 0.5) * TILE - r, r * 2, r * 2);
    }
    if (night < 0.1) { ctx.globalAlpha = 1; return; }
    for (const b of this.w.buildings.values()) {
      const d = BUILDINGS[b.def];
      if (!d.light || b.x < tx0 - 6 || b.x > tx1 + 6 || b.y < ty0 - 6 || b.y > ty1 + 6) continue;
      const lit = d.light.fuel ? (b.fuel || 0) > 0 : !!b.powered;
      if (!lit) continue;
      const r = d.light.radius * TILE * 0.7 * (d.light.fuel ? 0.95 + Math.sin(this.time * 8 + b.id) * 0.05 : 1);
      ctx.globalAlpha = night * (d.light.fuel ? 0.32 : 0.22);
      ctx.drawImage(g, (b.x + 0.5) * TILE - r, (b.y + 0.5) * TILE - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  drawDesignations(ctx: CanvasRenderingContext2D, tx0: number, ty0: number, tx1: number, ty1: number) {
    const m = this.w.map;
    const names = ['', 'mine', 'cut', 'harvest', 'mine', 'chop'];
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = ty * m.w + tx;
      const d = m.desig[i];
      if (d && m.desigF[i] === this.opts.faction) {
        const X = tx * TILE, Y = ty * TILE;
        ctx.fillStyle = d === 1 ? 'rgba(255,220,120,0.18)' : 'rgba(160,255,140,0.12)';
        ctx.fillRect(X, Y, TILE, TILE);
        this.drawMiniIcon(ctx, names[d], X + 4, Y + 4);
      }
      if (m.roofDesig[i] && m.roofDesigF[i] === this.opts.faction && this.opts.roofs) this.drawMiniIcon(ctx, 'roof', tx * TILE + 4, ty * TILE + 4);
    }
  }

  drawProjectiles(ctx: CanvasRenderingContext2D, dt: number) {
    for (const pr of this.w.projectiles.values()) {
      if (this.w.mode === 'client') {
        // client-side flight simulation
        const dx = pr.tx - pr.x, dy = pr.ty - pr.y, d = Math.hypot(dx, dy);
        const step = pr.speed * 60 * dt * (this.w.speed || 1);
        if (d > step) { pr.x += dx / d * step; pr.y += dy / d * step; } else { pr.x = pr.tx; pr.y = pr.ty; }
      }
      const x = (pr.x + 0.5) * TILE, y = (pr.y + 0.5) * TILE - 6;
      const a = Math.atan2(pr.ty - pr.sy, pr.tx - pr.sx);
      const len = pr.proj === 'arrow' ? 6 : pr.proj === 'rocket' ? 3 : 7;
      if (pr.proj === 'rocket') { ctx.fillStyle = '#3a4a2a'; ctx.fillRect(x - 1.5, y - 1.5 - Math.sin(Math.min(1, Math.hypot(pr.x - pr.sx, pr.y - pr.sy) / Math.max(1, Math.hypot(pr.tx - pr.sx, pr.ty - pr.sy))) * Math.PI) * 12, 3, 3); continue; }
      ctx.strokeStyle = pr.proj === 'charge' ? '#8fe8ff' : pr.proj === 'arrow' ? '#d8c8a0' : '#ffe8a0';
      ctx.lineWidth = pr.proj === 'charge' ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a) * len, y - Math.sin(a) * len); ctx.stroke();
    }
  }

  drawParticles(ctx: CanvasRenderingContext2D, dt: number, phase: 'world' | 'post') {
    const P = this.particles;
    for (let k = P.length - 1; k >= 0; k--) {
      const p = P[k];
      const post = p.kind === 'muzzle' || p.kind === 'boom' || p.kind === 'ember' || p.kind === 'spark';
      if ((phase === 'post') !== post) continue;
      p.t += dt;
      if (p.t >= p.life) { P.splice(k, 1); continue; }
      const f = p.t / p.life;
      p.x += p.vx * dt; p.y += p.vy * dt;
      switch (p.kind) {
        case 'muzzle': ctx.fillStyle = '#fff4c0'; ctx.fillRect(p.x - 2, p.y - 1, 4, 2); ctx.fillRect(p.x - 1, p.y - 2, 2, 4); break;
        case 'spark': p.vy += 200 * dt; ctx.fillStyle = p.c || '#ffe080'; ctx.fillRect(p.x, p.y, 1, 1); break;
        case 'ember': ctx.fillStyle = f < 0.5 ? '#ffd040' : '#ff6020'; ctx.fillRect(p.x, p.y, 1, 1); break;
        case 'boom': {
          const r = p.size! * (0.3 + f * 0.9);
          ctx.fillStyle = f < 0.3 ? '#fff4c0' : f < 0.6 ? '#ffb040' : '#c04020';
          ctx.globalAlpha = 1 - f;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'smoke': case 'dust': case 'steam': {
          p.vx *= 0.97; p.vy *= 0.97;
          const s = (p.size || 3) * (1 + f);
          ctx.globalAlpha = (1 - f) * (p.kind === 'steam' ? 0.5 : 0.6);
          ctx.fillStyle = p.kind === 'dust' ? '#b8a888' : p.kind === 'steam' ? '#f0f4f8' : '#4a4448';
          ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.round(s), Math.round(s));
          ctx.globalAlpha = 1;
          break;
        }
        case 'z': ctx.fillStyle = '#e8ecff'; ctx.globalAlpha = 1 - f; ctx.fillRect(p.x, p.y, 3, 1); ctx.fillRect(p.x + 2 - 1, p.y + 1, 1, 1); ctx.fillRect(p.x, p.y + 2, 3, 1); ctx.globalAlpha = 1; break;
        case 'shoe': p.vy += 170 * dt; ctx.fillStyle = '#9aa4ae'; ctx.fillRect(p.x, p.y, 2, 2); break;
        case 'pod': {
          ctx.fillStyle = '#6a7580'; ctx.fillRect(p.x - 4, p.y - 8, 8, 10); ctx.fillStyle = '#ff9030'; ctx.fillRect(p.x - 2, p.y - 14, 4, 6);
          if (p.y >= p.size!) { p.t = p.life; this.addFx({ k: 'dust', x: p.x / TILE - 0.5, y: p.size! / TILE - 0.5 }); this.shake = Math.min(1, this.shake + 0.2); }
          break;
        }
      }
    }
    if (P.length > 600) P.splice(0, P.length - 600);
  }

  drawWeather(ctx: CanvasRenderingContext2D, dt: number) {
    const wd = WEATHERS[this.w.weather.cur];
    const W = this.vw, H = this.vh;
    const target = Math.round((wd.rain * 160 + wd.snow * 140) * (W * H) / (1000 * 1400));
    const parts = this.weatherParts;
    while (parts.length < target) parts.push({ x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, t: 0, life: 1, kind: wd.snow ? 'snow' : 'rain', size: Math.random() });
    if (parts.length > target) parts.length = target;
    const d = this.dpr;
    for (const p of parts) {
      if (p.kind === 'rain') {
        p.x += (-60 - this.w.weather.windSpeed * 120) * dt * d; p.y += 900 * dt * d;
        ctx.fillStyle = 'rgba(180,200,230,0.45)';
        ctx.fillRect(p.x, p.y, 1 * d, 7 * d);
      } else {
        p.x += (Math.sin(this.time + p.size! * 10) * 20 - this.w.weather.windSpeed * 40) * dt * d; p.y += (40 + p.size! * 30) * dt * d * (wd.snow > 1.5 ? 2 : 1);
        ctx.fillStyle = 'rgba(250,252,255,0.85)';
        const s = (p.size! > 0.7 ? 2 : 1) * d;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
      }
      if (p.y > H) { p.y -= H + 10; p.x = Math.random() * W; }
      if (p.x < -10) p.x += W + 10; if (p.x > W + 10) p.x -= W + 10;
    }
    if (wd.fog) { ctx.fillStyle = 'rgba(200,205,215,0.28)'; ctx.fillRect(0, 0, W, H); }
    if (wd.rain > 0 || wd.snow > 1.5) { ctx.fillStyle = `rgba(40,50,70,${0.08 * (wd.rain + wd.snow)})`; ctx.fillRect(0, 0, W, H); }
    if (this.w.hasCondition('toxic')) { ctx.fillStyle = 'rgba(120,200,60,0.1)'; ctx.fillRect(0, 0, W, H); }
  }

  drawTexts(ctx: CanvasRenderingContext2D, dt: number) {
    const T = this.texts;
    const fs = Math.round(11 * this.dpr);
    ctx.font = `${fs}px "Pixelify Sans", monospace`;
    ctx.textAlign = 'center';
    for (let k = T.length - 1; k >= 0; k--) {
      const t = T[k];
      t.t += dt;
      if (t.t >= t.life) { T.splice(k, 1); continue; }
      t.y += t.vy * dt;
      const [sx, sy] = this.worldToScreen(t.x, t.y);
      const a = 1 - Math.max(0, (t.t - t.life * 0.6) / (t.life * 0.4));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#1c1622';
      ctx.fillText(t.s || '', sx * this.dpr + this.dpr, sy * this.dpr + this.dpr);
      ctx.fillStyle = t.c || '#fff';
      ctx.fillText(t.s || '', sx * this.dpr, sy * this.dpr);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    if (T.length > 80) T.splice(0, T.length - 80);
  }

  drawLabels(ctx: CanvasRenderingContext2D) {
    if (this.cam.zoom < 2.2 * this.dpr) return;
    const fs = Math.round(10 * this.dpr);
    ctx.font = `${fs}px "Pixelify Sans", monospace`;
    ctx.textAlign = 'center';
    for (const p of this.w.pawns.values()) {
      if (p.race !== 'human' && !p.animal?.tamed) continue;
      const pos = this.pawnDraw.get(p.id);
      const [wx, wy] = pos && this.w.mode === 'client' ? [pos.x, pos.y] : this.pawnPos(p);
      const [sx, sy] = this.worldToScreen(wx + 8, wy + 19);
      if (sx < -50 || sy < -20 || sx * this.dpr > this.vw + 50 || sy * this.dpr > this.vh + 20) continue;
      const name = p.race === 'human' ? (p.name.nick || p.name.first) : p.animal?.name || '';
      const own = p.faction === this.opts.faction;
      const hostile = this.w.hostile(this.opts.faction, p.faction) || (p.animal?.manhunter || 0) > this.w.tick;
      ctx.fillStyle = 'rgba(12,10,16,0.55)';
      const tw = ctx.measureText(name).width;
      ctx.fillRect(sx * this.dpr - tw / 2 - 2 * this.dpr, sy * this.dpr - fs + 2 * this.dpr, tw + 4 * this.dpr, fs + 1 * this.dpr);
      ctx.fillStyle = hostile ? '#ff7a6a' : own ? (p.downed ? '#ff9a7a' : '#f4f0e8') : this.w.playerByFaction(p.faction)?.color || '#9fd0ff';
      ctx.fillText(name, sx * this.dpr, sy * this.dpr);
    }
    ctx.textAlign = 'left';
  }

  drawSelection(ctx: CanvasRenderingContext2D) {
    const t = this.time;
    for (const id of this.opts.selection) {
      const th = this.w.things.get(id);
      let x: number, y: number, ww = TILE, hh = TILE;
      if (!th) {
        const z = this.w.zones.get(-id);
        continue;
      }
      if (th.kind === 'pawn') { const pos = this.pawnDraw.get(th.id); [x, y] = pos && this.w.mode === 'client' ? [pos.x, pos.y] : this.pawnPos(th); y -= 4; hh = 20; }
      else if (th.kind === 'building' || th.kind === 'blueprint') {
        x = th.x * TILE; y = th.y * TILE;
        if (!(th as any).floor) { const d = BUILDINGS[th.def]; const [bw, bh] = this.w.rotSize(d.size, th.rot); ww = bw * TILE; hh = bh * TILE; }
      } else { x = th.x * TILE; y = th.y * TILE; }
      const o = 1 + Math.sin(t * 6) * 0.6;
      ctx.fillStyle = '#f4f0e8';
      const L = 4;
      const corner = (cx: number, cy: number, dx: number, dy: number) => { ctx.fillRect(cx, cy, L * dx || 1, 1); ctx.fillRect(cx, cy, 1, L * dy || 1); };
      const x0 = x - o, y0 = y - o, x1 = x + ww + o - 1, y1 = y + hh + o - 1;
      ctx.fillRect(x0, y0, L, 1); ctx.fillRect(x0, y0, 1, L);
      ctx.fillRect(x1 - L + 1, y0, L, 1); ctx.fillRect(x1, y0, 1, L);
      ctx.fillRect(x0, y1, L, 1); ctx.fillRect(x0, y1 - L + 1, 1, L);
      ctx.fillRect(x1 - L + 1, y1, L, 1); ctx.fillRect(x1, y1 - L + 1, 1, L);
      void corner;
      // drafted pawn path
      if (th.kind === 'pawn' && th.path && th.pi < th.path.length && th.faction === this.opts.faction) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        for (let k = th.pi; k < th.path.length; k += 1) { const c = th.path[k]; ctx.fillRect((c % this.w.map.w) * TILE + 7, ((c / this.w.map.w) | 0) * TILE + 7, 2, 2); }
      }
      if (th.kind === 'pawn' && th.target && th.job?.type === 'attack') {
        const tg = this.w.things.get(th.target);
        if (tg) { ctx.strokeStyle = 'rgba(255,80,60,0.6)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(x + 8, y + 10); ctx.lineTo(tg.x * TILE + 8, tg.y * TILE + 8); ctx.stroke(); }
      }
    }
  }
}

function makeGlow(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,190,110,0.9)'); g.addColorStop(0.4, 'rgba(255,140,60,0.35)'); g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return c;
}

// 3x5 pixel digits for stack counts
const DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'], '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'], 'k': ['100', '101', '110', '101', '101'],
};
export function drawTinyNumber(ctx: CanvasRenderingContext2D, s: string, rx: number, y: number) {
  const w = s.length * 4;
  let x = rx - w;
  ctx.fillStyle = 'rgba(12,10,16,0.75)';
  ctx.fillRect(x - 1, y - 1, w + 1, 7);
  ctx.fillStyle = '#f4f0e8';
  for (const ch of s) {
    const g = DIGITS[ch];
    if (g) for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 3; xx++) if (g[yy][xx] === '1') ctx.fillRect(x + xx, y + yy, 1, 1);
    x += 4;
  }
}
export { C, Pix, addSprite, stuffColor, ITEMS, weaponDef };
