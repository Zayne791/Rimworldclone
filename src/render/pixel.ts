// Pixel-art toolkit: color helpers, a pixel buffer with drawing primitives, auto-outlining and an atlas packer.
export type RGBA = [number, number, number, number];

const hexCache = new Map<string, RGBA>();
export function hex(h: string): RGBA {
  let c = hexCache.get(h);
  if (c) return c;
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map(x => x + x).join('');
  const n = parseInt(s.slice(0, 6), 16);
  c = [(n >> 16) & 255, (n >> 8) & 255, n & 255, s.length === 8 ? parseInt(s.slice(6), 16) : 255];
  hexCache.set(h, c);
  return c;
}
export type Col = RGBA | string;
export const C = (c: Col): RGBA => (typeof c === 'string' ? hex(c) : c);
export function shade(c: Col, f: number): RGBA {
  const [r, g, b, a] = C(c);
  if (f < 1) return [Math.round(r * f), Math.round(g * f), Math.round(b * f), a];
  const t = f - 1;
  return [Math.round(r + (255 - r) * t), Math.round(g + (255 - g) * t), Math.round(b + (255 - b) * t), a];
}
/** hue-shifted shading: darker goes cooler, lighter warmer (classic pixel art ramp) */
export function ramp(c: Col, f: number): RGBA {
  const [r, g, b, a] = C(c);
  if (f < 1) {
    const d = 1 - f;
    return [Math.round(r * f * (1 - d * 0.15)), Math.round(g * f), Math.round(Math.min(255, b * f * (1 + d * 0.35) + 6 * d)), a];
  }
  const t = f - 1;
  return [Math.round(r + (255 - r) * t * 1.1), Math.round(g + (255 - g) * t), Math.round(b + (255 - b) * t * 0.8), a];
}
export function mix(a: Col, b: Col, t: number): RGBA {
  const x = C(a), y = C(b);
  return [Math.round(x[0] + (y[0] - x[0]) * t), Math.round(x[1] + (y[1] - x[1]) * t), Math.round(x[2] + (y[2] - x[2]) * t), Math.round(x[3] + (y[3] - x[3]) * t)];
}
export function css(c: Col): string { const [r, g, b, a] = C(c); return a === 255 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`; }
export function tint(base: Col, t: Col, amt = 1): RGBA {
  // multiply-ish tint preserving luminance of base
  const b = C(base), c = C(t);
  const lum = (b[0] * 0.3 + b[1] * 0.59 + b[2] * 0.11) / 255;
  const r: RGBA = [Math.round(c[0] * lum * 1.35), Math.round(c[1] * lum * 1.35), Math.round(c[2] * lum * 1.35), b[3]];
  return mix(b, [Math.min(255, r[0]), Math.min(255, r[1]), Math.min(255, r[2]), b[3]], amt);
}

export const OUTLINE: RGBA = hex('#1c1622');
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function bayer(x: number, y: number): number { return (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16; }

/** tiny deterministic hash for art */
export function h2(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Pix {
  w: number; h: number; d: Uint8ClampedArray;
  constructor(w: number, h: number) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  in(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x: number, y: number, c: Col) {
    x |= 0; y |= 0;
    if (!this.in(x, y)) return;
    const cc = C(c);
    const i = (y * this.w + x) * 4;
    if (cc[3] === 255) { this.d[i] = cc[0]; this.d[i + 1] = cc[1]; this.d[i + 2] = cc[2]; this.d[i + 3] = 255; return; }
    if (cc[3] === 0) return;
    const a = cc[3] / 255, ia = 1 - a;
    const da = this.d[i + 3] / 255;
    this.d[i] = cc[0] * a + this.d[i] * ia; this.d[i + 1] = cc[1] * a + this.d[i + 1] * ia; this.d[i + 2] = cc[2] * a + this.d[i + 2] * ia;
    this.d[i + 3] = Math.round((a + da * ia) * 255);
  }
  clear(x: number, y: number) { if (!this.in(x, y)) return; const i = (y * this.w + x) * 4; this.d[i + 3] = 0; }
  get(x: number, y: number): RGBA | null {
    if (!this.in(x, y)) return null;
    const i = (y * this.w + x) * 4;
    if (!this.d[i + 3]) return null;
    return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]];
  }
  opaque(x: number, y: number) { return this.in(x, y) && this.d[(y * this.w + x) * 4 + 3] > 0; }
  rect(x: number, y: number, w: number, h: number, c: Col) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c); }
  frame(x: number, y: number, w: number, h: number, c: Col) { this.hline(x, x + w - 1, y, c); this.hline(x, x + w - 1, y + h - 1, c); this.vline(x, y, y + h - 1, c); this.vline(x + w - 1, y, y + h - 1, c); }
  hline(x0: number, x1: number, y: number, c: Col) { for (let x = x0; x <= x1; x++) this.set(x, y, c); }
  vline(x: number, y0: number, y1: number, c: Col) { for (let y = y0; y <= y1; y++) this.set(x, y, c); }
  line(x0: number, y0: number, x1: number, y1: number, c: Col) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) { this.set(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: Col | ((x: number, y: number, nx: number, ny: number) => Col | null)) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) { const col = typeof c === 'function' ? c(x, y, nx, ny) : c; if (col) this.set(x, y, col); }
    }
  }
  /** shaded sphere-ish ellipse with light from top-left */
  blob(cx: number, cy: number, rx: number, ry: number, base: Col, dither = true) {
    this.ellipse(cx, cy, rx, ry, (x, y, nx, ny) => {
      const l = -nx * 0.55 - ny * 0.75;
      const t = dither ? bayer(x, y) - 0.5 : 0;
      const v = l + t * 0.5;
      return v > 0.55 ? ramp(base, 1.18) : v > 0.05 ? C(base) : v > -0.5 ? ramp(base, 0.8) : ramp(base, 0.62);
    });
  }
  poly(pts: [number, number][], c: Col) {
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
        if ((y + 0.5 >= Math.min(y0, y1)) && (y + 0.5 < Math.max(y0, y1))) xs.push(x0 + (y + 0.5 - y0) * (x1 - x0) / (y1 - y0));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, c);
    }
  }
  /** draw a char grid; '.' or ' ' = transparent */
  grid(rows: string[], pal: Record<string, Col>, ox = 0, oy = 0, flip = false) {
    for (let y = 0; y < rows.length; y++) {
      const r = rows[y];
      for (let x = 0; x < r.length; x++) {
        const ch = r[x];
        if (ch === '.' || ch === ' ') continue;
        const c = pal[ch];
        if (!c) continue;
        this.set(ox + (flip ? r.length - 1 - x : x), oy + y, c);
      }
    }
  }
  blit(src: Pix, dx: number, dy: number, flipX = false) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      if (!src.d[i + 3]) continue;
      this.set(dx + (flipX ? src.w - 1 - x : x), dy + y, [src.d[i], src.d[i + 1], src.d[i + 2], src.d[i + 3]]);
    }
  }
  /** add a 1px outline in empty pixels next to opaque ones */
  outline(col: Col = OUTLINE, diag = false, selective = true) {
    const src = this.d.slice();
    const W = this.w, H = this.h;
    const op = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && src[(y * W + x) * 4 + 3] > 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (op(x, y)) continue;
      let n: [number, number] | null = null;
      if (op(x - 1, y)) n = [x - 1, y]; else if (op(x + 1, y)) n = [x + 1, y]; else if (op(x, y - 1)) n = [x, y - 1]; else if (op(x, y + 1)) n = [x, y + 1];
      else if (diag && (op(x - 1, y - 1) || op(x + 1, y - 1) || op(x - 1, y + 1) || op(x + 1, y + 1))) n = [x, y];
      if (!n) continue;
      if (selective && n[0] !== x) {
        const i = (n[1] * W + n[0]) * 4;
        const c: RGBA = [src[i], src[i + 1], src[i + 2], 255];
        this.set(x, y, mix(ramp(c, 0.32), col, 0.55));
      } else if (selective && n[1] !== y) {
        const i = (n[1] * W + n[0]) * 4;
        const c: RGBA = [src[i], src[i + 1], src[i + 2], 255];
        this.set(x, y, mix(ramp(c, 0.32), col, 0.55));
      } else this.set(x, y, col);
    }
  }
  /** inner edge shading: lighten pixels with empty above, darken with empty below */
  edgeShade(light = 1.15, dark = 0.78) {
    const src = this.d.slice();
    const W = this.w, H = this.h;
    const op = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && src[(y * W + x) * 4 + 3] > 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!op(x, y)) continue;
      const i = (y * W + x) * 4;
      const c: RGBA = [src[i], src[i + 1], src[i + 2], src[i + 3]];
      if (!op(x, y + 1)) { const s = ramp(c, dark); this.d[i] = s[0]; this.d[i + 1] = s[1]; this.d[i + 2] = s[2]; }
      else if (!op(x, y - 1) || !op(x - 1, y)) { const s = ramp(c, light); this.d[i] = s[0]; this.d[i + 1] = s[1]; this.d[i + 2] = s[2]; }
    }
  }
  flipH(): Pix { const o = new Pix(this.w, this.h); o.blit(this, 0, 0, true); return o; }
  /** rotate 90° clockwise k times */
  rot90(k: number): Pix {
    k = ((k % 4) + 4) % 4;
    if (!k) return this;
    const o = k % 2 ? new Pix(this.h, this.w) : new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = (y * this.w + x) * 4;
      if (!this.d[i + 3]) continue;
      let nx = x, ny = y;
      if (k === 1) { nx = this.h - 1 - y; ny = x; }
      else if (k === 2) { nx = this.w - 1 - x; ny = this.h - 1 - y; }
      else { nx = y; ny = this.w - 1 - x; }
      const j = (ny * o.w + nx) * 4;
      o.d[j] = this.d[i]; o.d[j + 1] = this.d[i + 1]; o.d[j + 2] = this.d[i + 2]; o.d[j + 3] = this.d[i + 3];
    }
    return o;
  }
  /** nearest-neighbor rotation by arbitrary angle into a square buffer */
  rotate(a: number, size?: number): Pix {
    const S = size || Math.ceil(Math.hypot(this.w, this.h)) + 1;
    const o = new Pix(S, S);
    const cx = this.w / 2, cy = this.h / 2, ox = S / 2, oy = S / 2;
    const ca = Math.cos(-a), sa = Math.sin(-a);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - ox, dy = y + 0.5 - oy;
      const sx = Math.floor(cx + dx * ca - dy * sa), sy = Math.floor(cy + dx * sa + dy * ca);
      if (sx < 0 || sy < 0 || sx >= this.w || sy >= this.h) continue;
      const i = (sy * this.w + sx) * 4;
      if (!this.d[i + 3]) continue;
      const j = (y * S + x) * 4;
      o.d[j] = this.d[i]; o.d[j + 1] = this.d[i + 1]; o.d[j + 2] = this.d[i + 2]; o.d[j + 3] = this.d[i + 3];
    }
    return o;
  }
  map(fn: (c: RGBA, x: number, y: number) => RGBA | null) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = (y * this.w + x) * 4;
      if (!this.d[i + 3]) continue;
      const r = fn([this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]], x, y);
      if (!r) { this.d[i + 3] = 0; continue; }
      this.d[i] = r[0]; this.d[i + 1] = r[1]; this.d[i + 2] = r[2]; this.d[i + 3] = r[3];
    }
  }
  scaleDown(f: number): Pix {
    const o = new Pix(Math.max(1, Math.round(this.w * f)), Math.max(1, Math.round(this.h * f)));
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
      const sx = Math.min(this.w - 1, Math.floor(x / f)), sy = Math.min(this.h - 1, Math.floor(y / f));
      const i = (sy * this.w + sx) * 4, j = (y * o.w + x) * 4;
      o.d[j] = this.d[i]; o.d[j + 1] = this.d[i + 1]; o.d[j + 2] = this.d[i + 2]; o.d[j + 3] = this.d[i + 3];
    }
    return o;
  }
  imageData(): ImageData { return new ImageData(this.d as any, this.w, this.h); }
}

// ---------------- atlas ----------------
export interface Sprite { img: HTMLCanvasElement; sx: number; sy: number; w: number; h: number; ox: number; oy: number }

class Sheet {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  x = 1; y = 1; rowH = 0; size: number;
  constructor(size: number) {
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = size; this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d')!;
  }
  fit(w: number, h: number): [number, number] | null {
    if (this.x + w + 1 > this.size) { this.x = 1; this.y += this.rowH + 1; this.rowH = 0; }
    if (this.y + h + 1 > this.size) return null;
    const r: [number, number] = [this.x, this.y];
    this.x += w + 1; this.rowH = Math.max(this.rowH, h);
    return r;
  }
}

const sheets: Sheet[] = [];
export function addSprite(p: Pix, ox = 0, oy = 0): Sprite {
  if (p.w > 500 || p.h > 500) {
    const c = document.createElement('canvas'); c.width = p.w; c.height = p.h;
    c.getContext('2d')!.putImageData(p.imageData(), 0, 0);
    return { img: c, sx: 0, sy: 0, w: p.w, h: p.h, ox, oy };
  }
  let sh = sheets[sheets.length - 1];
  let pos = sh ? sh.fit(p.w, p.h) : null;
  if (!pos) { sh = new Sheet(1024); sheets.push(sh); pos = sh.fit(p.w, p.h)!; }
  sh.ctx.putImageData(p.imageData(), pos[0], pos[1]);
  return { img: sh.canvas, sx: pos[0], sy: pos[1], w: p.w, h: p.h, ox, oy };
}

export function spriteToDataURL(s: Sprite, scale = 1): string {
  const c = document.createElement('canvas');
  c.width = s.w * scale; c.height = s.h * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(s.img, s.sx, s.sy, s.w, s.h, 0, 0, s.w * scale, s.h * scale);
  return c.toDataURL();
}
export function pixToCanvas(p: Pix): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = p.w; c.height = p.h;
  c.getContext('2d')!.putImageData(p.imageData(), 0, 0);
  return c;
}
