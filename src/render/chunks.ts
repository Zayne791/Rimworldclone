// Chunked terrain rendering with a two-level cache: an expensive per-pixel "base" (terrain, floors, rock)
// and a cheap "deco" layer (flat plants, filth, snow, conduits) composited on top.
import type { World } from '../sim/world';
import { CHUNK } from '../sim/map';
import { TERRAIN, ROCKS, ROCK_INDEX } from '../data/terrain';
import { terrainTexture, rockTexture, grassTex, jitterMap, TEX } from './art/terrain';
import { plantSprite, isFlatPlant } from './art/plants';
import { Pix, h2, bayer, ramp, C, addSprite, type Sprite, type RGBA } from './pixel';
import { TILE } from '../core/constants';

const PX = CHUNK * TILE; // 256

interface ChunkCache { base: HTMLCanvasElement | null; final: HTMLCanvasElement | null; lastUse: number }

export class ChunkRenderer {
  w: World;
  chunks: ChunkCache[];
  lush: Float32Array;
  grass: Pix;
  texData = new Map<number, Uint8ClampedArray>();
  frame = 0;
  constructor(w: World) {
    this.w = w;
    const m = w.map;
    this.chunks = Array.from({ length: m.chunksW * m.chunksH }, () => ({ base: null, final: null, lastUse: 0 }));
    this.grass = grassTex();
    this.lush = new Float32Array(m.n);
    this.computeLush();
  }
  computeLush() {
    const m = this.w.map;
    const vn = (x: number, y: number, s: number) => {
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = h2(x0, y0, s), b = h2(x0 + 1, y0, s), c = h2(x0, y0 + 1, s), d = h2(x0 + 1, y0 + 1, s);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const i = y * m.w + x;
      const t = TERRAIN[m.terrain[i]];
      if (t.style !== 'soil' || t.id === 'mud') { this.lush[i] = 0; continue; }
      const n = vn(x / 11, y / 11, 3) * 0.7 + vn(x / 4, y / 4, 5) * 0.3;
      this.lush[i] = Math.max(0, Math.min(1, (n - 0.2) * 2.4)) * (t.fert >= 1 ? 1 : 0.7);
    }
  }
  tex(ti: number): Uint8ClampedArray {
    let d = this.texData.get(ti);
    if (!d) { d = terrainTexture(ti).d; this.texData.set(ti, d); }
    return d;
  }
  rockTex(ri: number): Uint8ClampedArray {
    const key = 1000 + ri;
    let d = this.texData.get(key);
    if (!d) { d = rockTexture(ri, ROCK_INDEX[this.w.map.stoneBase] || 1).d; this.texData.set(key, d); }
    return d;
  }

  renderBase(cx: number, cy: number): HTMLCanvasElement {
    const m = this.w.map;
    const cache = this.chunks[cy * m.chunksW + cx];
    const canvas = cache.base || document.createElement('canvas');
    canvas.width = PX; canvas.height = PX;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(PX, PX);
    const out = img.data;
    const jit = jitterMap();
    const grass = this.grass.d;
    const W = m.w, H = m.h;
    const x0 = cx * PX, y0 = cy * PX;
    const isNat = (i: number) => !m.rock[i] && !m.floor[i];
    const lushAt = (fx: number, fy: number) => {
      const tx = Math.floor(fx), ty = Math.floor(fy);
      const ax = Math.max(0, Math.min(W - 1, tx)), ay = Math.max(0, Math.min(H - 1, ty));
      const bx = Math.max(0, Math.min(W - 1, tx + 1)), by = Math.max(0, Math.min(H - 1, ty + 1));
      const u = fx - tx, v = fy - ty;
      const l = this.lush;
      return (l[ay * W + ax] * (1 - u) + l[ay * W + bx] * u) * (1 - v) + (l[by * W + ax] * (1 - u) + l[by * W + bx] * u) * v;
    };
    for (let py = 0; py < PX; py++) {
      const wy = y0 + py;
      const ty = (wy / TILE) | 0;
      if (ty >= H) break;
      for (let px = 0; px < PX; px++) {
        const wx = x0 + px;
        const tx = (wx / TILE) | 0;
        if (tx >= W) break;
        const i = ty * W + tx;
        const o = (py * PX + px) * 4;
        const tu = wx & 63, tv = wy & 63;
        const ti = (tv * TEX + tu) * 4;
        let r = 0, g = 0, b = 0;
        const lx = wx & 15, ly = wy & 15;
        if (m.rock[i]) {
          const d = this.rockTex(m.rock[i]);
          r = d[ti]; g = d[ti + 1]; b = d[ti + 2];
          const s = ty < H - 1 && m.rock[i + W];
          const n = ty > 0 && m.rock[i - W];
          const e = tx < W - 1 && m.rock[i + 1];
          const wv = tx > 0 && m.rock[i - 1];
          let f = 0.9;
          if (!s && ly >= 9) {
            // cliff face with vertical strata
            if (ly === 9) f = 1.22;
            else f = 0.52 - (ly - 10) * 0.035 + (((wx * 5 + (wx >> 2) * 3) % 7) === 0 ? -0.1 : 0) + (((wx + ly) & 3) === 0 ? 0.04 : 0);
            if (ly === 15) f = 0.32;
          } else if (!n && ly <= 1) f = ly === 0 ? 1.32 : 1.14;
          if (!wv && lx === 0) f *= 0.68; else if (!e && lx === 15) f *= 0.68;
          else if (!wv && lx === 1 && (s || ly < 9)) f *= 1.12;
          r *= f; g *= f; b *= f;
          // cool tint on the dark face
          if (!s && ly >= 10) { b = b * 1.08 + 4; }        } else if (m.floor[i]) {
          const d = this.tex(m.floor[i]);
          r = d[ti]; g = d[ti + 1]; b = d[ti + 2];
          const fl = m.floor[i];
          const edge = (lx === 0 && tx > 0 && m.floor[i - 1] !== fl) || (ly === 0 && ty > 0 && m.floor[i - W] !== fl);
          const edge2 = (lx === 15 && tx < W - 1 && m.floor[i + 1] !== fl) || (ly === 15 && ty < H - 1 && m.floor[i + W] !== fl);
          if (edge) { r *= 1.12; g *= 1.12; b *= 1.12; }
          if (edge2) { r *= 0.7; g *= 0.7; b *= 0.7; }
        } else {
          // natural terrain with jittered borders
          const ji = (tv * TEX + tu) * 2;
          let sx = ((wx + jit[ji]) / TILE) | 0, sy = ((wy + jit[ji + 1]) / TILE) | 0;
          sx = Math.max(0, Math.min(W - 1, sx)); sy = Math.max(0, Math.min(H - 1, sy));
          let si = sy * W + sx;
          if (!isNat(si)) si = i;
          const tt = m.terrain[si];
          const td = TERRAIN[tt];
          const d = this.tex(tt);
          r = d[ti]; g = d[ti + 1]; b = d[ti + 2];
          // cast shadow below cliffs
          if (ty > 0 && m.rock[i - W] && ly <= 3) { const f2 = [0.55, 0.66, 0.78, 0.9][ly]; r *= f2; g *= f2; b *= f2 * 1.05; }
          else if (tx > 0 && m.rock[i - 1] && lx <= 1) { const f2 = lx === 0 ? 0.72 : 0.86; r *= f2; g *= f2; b *= f2; }
          if (td.style === 'soil') {
            const L = lushAt(wx / TILE - 0.5, wy / TILE - 0.5);
            if (L > 0.02 && L > bayer(wx, wy) * 0.8 + h2(wx, wy, 1) * 0.2) { r = grass[ti]; g = grass[ti + 1]; b = grass[ti + 2]; }
          } else if (td.water) {
            // foam near shore
            const shore = (dx: number, dy: number) => {
              const qx = Math.max(0, Math.min(W - 1, ((wx + dx + jit[ji]) / TILE) | 0)), qy = Math.max(0, Math.min(H - 1, ((wy + dy + jit[ji + 1]) / TILE) | 0));
              const q = qy * W + qx;
              return !TERRAIN[m.terrain[q]].water && isNat(q);
            };
            if (shore(2, 0) || shore(-2, 0) || shore(0, 2) || shore(0, -2)) { r = r * 0.5 + 110; g = g * 0.5 + 125; b = b * 0.5 + 120; }
            else if (td.water === 'shallow' && (shore(4, 0) || shore(0, 4) || shore(-4, 0) || shore(0, -4))) { r = r * 0.85 + 20; g = g * 0.85 + 26; b = b * 0.85 + 22; }
          } else if (td.id !== 'shallow_water') {
            // wet edge next to water
          }
        }
        out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    cache.base = canvas;
    return canvas;
  }

  renderFinal(cx: number, cy: number) {
    const m = this.w.map;
    const idx = cy * m.chunksW + cx;
    const cache = this.chunks[idx];
    const dirty = m.chunkDirty[idx];
    if (!cache.base || (dirty & 2)) this.renderBase(cx, cy);
    const canvas = cache.final || document.createElement('canvas');
    canvas.width = PX; canvas.height = PX;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cache.base!, 0, 0);
    const tx0 = cx * CHUNK, ty0 = cy * CHUNK;
    for (let ty = ty0; ty < Math.min(m.h, ty0 + CHUNK); ty++) for (let tx = tx0; tx < Math.min(m.w, tx0 + CHUNK); tx++) {
      const i = ty * m.w + tx;
      const lx = (tx - tx0) * TILE, ly = (ty - ty0) * TILE;
      if (m.conduit[i]) drawSprite(ctx, conduitSprite(m, i), lx, ly);
      if (m.filth[i]) drawSprite(ctx, filthSprite(m.filthType[i], m.filth[i], i), lx, ly);
      const p = m.plant[i];
      if (p && isFlatPlant(p)) { const s = plantSprite(p, m.growth[i], (i * 2654435761) >>> 29); if (s) drawSprite(ctx, s, lx, ly); }
      if (m.snow[i] > 20 && !m.rock[i]) drawSprite(ctx, snowSprite(m.snow[i] >> 5, i), lx, ly);
    }
    cache.final = canvas;
    m.chunkDirty[idx] = 0;
  }

  /** draw visible chunks; limit re-renders per frame */
  draw(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, budget = 3) {
    const m = this.w.map;
    this.frame++;
    const c0x = Math.max(0, Math.floor(x0 / PX)), c0y = Math.max(0, Math.floor(y0 / PX));
    const c1x = Math.min(m.chunksW - 1, Math.floor(x1 / PX)), c1y = Math.min(m.chunksH - 1, Math.floor(y1 / PX));
    let rendered = 0;
    for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
      const idx = cy * m.chunksW + cx;
      const c = this.chunks[idx];
      if (!c.final || (m.chunkDirty[idx] && (rendered < budget || !c.final))) { this.renderFinal(cx, cy); rendered++; }
      c.lastUse = this.frame;
      ctx.drawImage(c.final!, cx * PX, cy * PX);
    }
    // free final canvases far from view
    if (this.frame % 120 === 0) {
      for (const c of this.chunks) if (c.final && this.frame - c.lastUse > 600) { c.final.width = 0; c.final = null; }
    }
  }
  invalidateAll() { this.w.map.chunkDirty.fill(3); }
}

export function drawSprite(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, flip = false) {
  if (flip) {
    ctx.save(); ctx.translate(x + TILE - s.ox, y + s.oy); ctx.scale(-1, 1);
    ctx.drawImage(s.img, s.sx, s.sy, s.w, s.h, 0, 0, s.w, s.h);
    ctx.restore();
    return;
  }
  ctx.drawImage(s.img, s.sx, s.sy, s.w, s.h, x + s.ox, y + s.oy, s.w, s.h);
}

// ---------------- deco sprites ----------------
const decoCache = new Map<string, Sprite>();
const FILTH_COLORS: Record<number, string[]> = {
  1: ['#5a4630', '#6e583c', '#4a3a28'], 2: ['#6e1a1a', '#8a2222', '#541212'], 3: ['#8a9a3a', '#a8b050', '#6e7a2e'],
  4: ['#4a4a4e', '#6a6a70', '#35353a'], 5: ['#7a746c', '#98928a', '#5a5550'], 6: ['#5a4428', '#6e5634', '#44321e'],
};
function filthSprite(type: number, amt: number, i: number): Sprite {
  const lvl = Math.min(3, amt >> 6);
  const v = (i * 2246822519) >>> 30;
  const key = `f${type}:${lvl}:${v}`;
  let s = decoCache.get(key);
  if (s) return s;
  const p = new Pix(16, 16);
  const cols = (FILTH_COLORS[type] || FILTH_COLORS[1]).map(c => C(c));
  const n = 4 + lvl * 5;
  for (let k = 0; k < n; k++) {
    const x = 2 + Math.floor(h2(k, v, type) * 12), y = 2 + Math.floor(h2(v, k, type + 9) * 12);
    const c = cols[k % 3];
    p.set(x, y, c);
    if (type === 2 || type === 3) { if (h2(k, 3, v) > 0.4) p.set(x + 1, y, c); if (h2(k, 4, v) > 0.6) p.set(x, y + 1, ramp(c, 0.8)); }
    if (type === 5 && h2(k, 5, v) > 0.5) { p.set(x + 1, y, ramp(c, 1.2)); p.set(x, y + 1, ramp(c, 0.7)); }
  }
  s = addSprite(p);
  decoCache.set(key, s);
  return s;
}
function snowSprite(lvl: number, i: number): Sprite {
  const v = (i * 2654435761) >>> 31;
  const key = `s${lvl}:${v}`;
  let s = decoCache.get(key);
  if (s) return s;
  const p = new Pix(16, 16);
  const white = C('#eef3f8'), sh = C('#c8d4e2');
  const dens = [0.1, 0.25, 0.45, 0.65, 0.8, 0.9, 0.97, 1][Math.min(7, lvl)];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (bayer(x + v * 2, y) < dens * (0.85 + h2(x, y, 44) * 0.3)) p.set(x, y, h2(x, y, 45 + v) > 0.8 ? sh : white);
  }
  s = addSprite(p);
  decoCache.set(key, s);
  return s;
}
function conduitSprite(m: World['map'], i: number): Sprite {
  const x = i % m.w, y = (i / m.w) | 0;
  const n = y > 0 && m.conduit[i - m.w] ? 1 : 0, e = x < m.w - 1 && m.conduit[i + 1] ? 2 : 0, s = y < m.h - 1 && m.conduit[i + m.w] ? 4 : 0, wv = x > 0 && m.conduit[i - 1] ? 8 : 0;
  const mask = n | e | s | wv;
  const key = 'c' + mask;
  let sp = decoCache.get(key);
  if (sp) return sp;
  const p = new Pix(16, 16);
  const col = C('#7a7f88'), dark = C('#3e4148'), hi = C('#b8bcc4');
  const seg = (x0: number, y0: number, x1: number, y1: number) => { p.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, col); };
  seg(6, 6, 9, 9);
  if (mask & 1) seg(7, 0, 8, 6); if (mask & 4) seg(7, 9, 8, 15); if (mask & 2) seg(9, 7, 15, 8); if (mask & 8) seg(0, 7, 6, 8);
  if (!mask) { seg(3, 7, 12, 8); }
  p.map((c, xx, yy) => (p.opaque(xx, yy - 1) ? c : hi));
  p.rect(7, 7, 2, 2, C('#e0b040'));
  p.outline(dark);
  sp = addSprite(p);
  decoCache.set(key, sp);
  return sp;
}
export { TILE };
