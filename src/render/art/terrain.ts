// Procedural tileable 64x64 pixel-art textures for terrain, floors and rock.
import { Pix, C, ramp, mix, bayer, h2, type RGBA, type Col } from '../pixel';
import { TERRAIN, ROCKS } from '../../data/terrain';

export const TEX = 64;

function valueNoise(seed: number, cells: number, x: number, y: number): number {
  const cs = TEX / cells;
  const gx = x / cs, gy = y / cs;
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const fx = gx - x0, fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const v = (i: number, j: number) => h2(((i % cells) + cells) % cells, ((j % cells) + cells) % cells, seed);
  const a = v(x0, y0), b = v(x0 + 1, y0), c = v(x0, y0 + 1), d = v(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
export function fbm(seed: number, x: number, y: number): number {
  return valueNoise(seed, 4, x, y) * 0.45 + valueNoise(seed + 7, 8, x, y) * 0.35 + valueNoise(seed + 13, 16, x, y) * 0.2;
}

function levels(n: number, x: number, y: number, cols: RGBA[], cuts: number[]): RGBA {
  const d = (bayer(x, y) - 0.5) * 0.12;
  for (let k = 0; k < cuts.length; k++) if (n + d < cuts[k]) return cols[k];
  return cols[cols.length - 1];
}

function pebbles(p: Pix, seed: number, density: number, cols: RGBA[], maxR = 1.6) {
  for (let k = 0; k < density; k++) {
    const x = Math.floor(h2(k, 1, seed) * TEX), y = Math.floor(h2(k, 2, seed) * TEX);
    const r = 0.7 + h2(k, 3, seed) * maxR;
    const c = cols[Math.floor(h2(k, 4, seed) * cols.length)];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const xx = (x + dx + TEX) % TEX, yy = (y + dy + TEX) % TEX;
      p.set(xx, yy, dy < 0 ? ramp(c, 1.15) : dy > 0 && dy * dy >= r * r - 1 ? ramp(c, 0.8) : c);
    }
    p.set((x + TEX) % TEX, (y + Math.ceil(r) + TEX) % TEX, ramp(cols[0], 0.7));
  }
}

function soilTex(seed: number, cols: string[]): Pix {
  const p = new Pix(TEX, TEX);
  const [base, dark, light, acc] = cols.map(c => C(c));
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const n = fbm(seed, x, y);
    p.set(x, y, levels(n, x, y, [dark, base, light], [0.38, 0.66]));
    const s = h2(x, y, seed + 99);
    if (s > 0.985) p.set(x, y, acc);
    else if (s < 0.012) p.set(x, y, ramp(dark, 0.85));
  }
  pebbles(p, seed + 5, 10, [light, acc], 0.8);
  return p;
}

export function grassTex(seed = 777): Pix {
  const p = new Pix(TEX, TEX);
  const base = C('#5b8a33'), dark = C('#4a7429'), light = C('#6f9f3e'), hi = C('#89b84c'), deep = C('#3e6424');
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const n = fbm(seed, x, y);
    p.set(x, y, levels(n, x, y, [deep, dark, base, light], [0.3, 0.45, 0.68]));
  }
  // blades
  for (let k = 0; k < 170; k++) {
    const x = Math.floor(h2(k, 11, seed) * TEX), y = Math.floor(h2(k, 12, seed) * TEX);
    const hgt = 2 + Math.floor(h2(k, 13, seed) * 2);
    const c = h2(k, 14, seed) > 0.6 ? hi : light;
    for (let j = 0; j < hgt; j++) p.set((x + (j === hgt - 1 && h2(k, 15, seed) > 0.5 ? 1 : 0)) % TEX, (y - j + TEX) % TEX, c);
    p.set(x, (y + 1) % TEX, deep);
  }
  return p;
}

function gravelTex(seed: number, cols: string[]): Pix {
  const p = soilTex(seed, cols);
  const [base, dark, light, acc] = cols.map(c => C(c));
  pebbles(p, seed + 17, 70, [light, acc, dark, ramp(base, 1.1)], 1.2);
  return p;
}

function sandTex(seed: number, cols: string[]): Pix {
  const p = new Pix(TEX, TEX);
  const [base, dark, light, acc] = cols.map(c => C(c));
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const n = fbm(seed, x, y);
    const ripple = Math.sin(((y + n * 10) / TEX) * Math.PI * 2 * 6);
    let c = levels(n * 0.7 + (ripple > 0.85 ? 0.3 : 0.15), x, y, [dark, base, light], [0.28, 0.62]);
    if (ripple < -0.93) c = ramp(base, 0.93);
    p.set(x, y, c);
    if (h2(x, y, seed + 3) > 0.99) p.set(x, y, acc);
  }
  return p;
}

function waterTex(seed: number, cols: string[], deep: boolean): Pix {
  const p = new Pix(TEX, TEX);
  const [base, dark, light, hi] = cols.map(c => C(c));
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const n = fbm(seed, x, y);
    p.set(x, y, levels(n, x, y, [dark, base, deep ? base : light], [0.4, 0.75]));
  }
  for (let k = 0; k < 26; k++) {
    const x = Math.floor(h2(k, 1, seed) * TEX), y = Math.floor(h2(k, 2, seed) * TEX);
    const len = 2 + Math.floor(h2(k, 3, seed) * 4);
    for (let j = 0; j < len; j++) p.set((x + j) % TEX, y, j === 0 || j === len - 1 ? light : hi);
  }
  return p;
}

function marshTex(seed: number, cols: string[]): Pix {
  const p = soilTex(seed, cols);
  const water = C('#3f6a64'), wl = C('#5a8a80');
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const n = valueNoise(seed + 50, 8, x, y);
    if (n > 0.68) p.set(x, y, n > 0.74 ? water : wl);
  }
  return p;
}

function roughStoneTex(seed: number, cols: string[]): Pix {
  const p = new Pix(TEX, TEX);
  const [base, dark, light, acc] = cols.map(c => C(c));
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const n = fbm(seed, x, y);
    p.set(x, y, levels(n, x, y, [dark, base, light], [0.4, 0.68]));
  }
  // cracks
  for (let k = 0; k < 6; k++) {
    let x = h2(k, 1, seed) * TEX, y = h2(k, 2, seed) * TEX;
    let a = h2(k, 3, seed) * Math.PI * 2;
    for (let s = 0; s < 14; s++) {
      p.set(Math.floor(x + TEX) % TEX, Math.floor(y + TEX) % TEX, ramp(dark, 0.75));
      a += (h2(k, s, seed + 9) - 0.5) * 1.2;
      x += Math.cos(a); y += Math.sin(a);
    }
  }
  pebbles(p, seed + 3, 8, [light, acc], 0.8);
  return p;
}

function plankTex(seed: number, cols: string[]): Pix {
  const p = new Pix(TEX, TEX);
  const [base, dark, light, seam] = cols.map(c => C(c));
  const BH = 4;
  for (let row = 0; row < TEX / BH; row++) {
    let x = Math.floor(h2(row, 0, seed) * 16);
    while (x < TEX + 16) {
      const len = 12 + Math.floor(h2(row, x, seed) * 14);
      const v = 0.9 + h2(row, x, seed + 1) * 0.2;
      const pc = ramp(base, v);
      for (let dx = 0; dx < len; dx++) for (let dy = 0; dy < BH; dy++) {
        const xx = (x + dx) % TEX, yy = row * BH + dy;
        let c = pc;
        if (dy === BH - 1) c = seam;
        else if (dy === 0) c = ramp(pc, 1.08);
        else if (h2(xx, yy, seed + 5) > 0.93) c = ramp(pc, 0.86);
        else if ((xx + row * 3) % 9 === 0 && dy === 1) c = ramp(pc, 0.9);
        if (dx === len - 1) c = seam;
        p.set(xx, yy, c);
      }
      x += len;
    }
  }
  return p;
}

function tileTex(seed: number, cols: string[], size = 8): Pix {
  const p = new Pix(TEX, TEX);
  const [base, dark, light, grout] = cols.map(c => C(c));
  for (let ty = 0; ty < TEX / size; ty++) for (let tx = 0; tx < TEX / size; tx++) {
    const v = 0.93 + h2(tx, ty, seed) * 0.14;
    const tc = ramp(base, v);
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
      const x = tx * size + dx, y = ty * size + dy;
      let c = tc;
      if (dx === size - 1 || dy === size - 1) c = grout;
      else if (dx === 0 || dy === 0) c = ramp(tc, 1.1);
      else if (dx === size - 2 || dy === size - 2) c = ramp(tc, 0.9);
      else if (h2(x, y, seed + 2) > 0.94) c = mix(tc, dark, 0.4);
      p.set(x, y, c);
    }
  }
  return p;
}

function metalTex(seed: number, cols: string[]): Pix {
  const p = new Pix(TEX, TEX);
  const [base, dark, light, seam] = cols.map(c => C(c));
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const lx = x % 16, ly = y % 16;
    let c = base;
    if (lx === 15 || ly === 15) c = seam;
    else if (lx === 0 || ly === 0) c = light;
    else if ((lx + ly) % 4 === 0 && lx > 2 && lx < 13 && ly > 2 && ly < 13) c = ramp(base, 0.92);
    if ((lx === 2 || lx === 13) && (ly === 2 || ly === 13)) c = dark;
    p.set(x, y, c);
  }
  return p;
}

function carpetTex(seed: number, cols: string[]): Pix {
  const p = new Pix(TEX, TEX);
  const [base, dark, light, hi] = cols.map(c => C(c));
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    let c = (x + y) % 2 === 0 ? base : ramp(base, 0.94);
    const n = fbm(seed, x, y);
    if (n > 0.7) c = mix(c, light, 0.35);
    if (n < 0.3) c = mix(c, dark, 0.35);
    if ((x % 16 === 7 || y % 16 === 7) && (x + y) % 3 === 0) c = hi;
    p.set(x, y, c);
  }
  return p;
}

function rugTex(seed: number, cols: string[]): Pix {
  // woven rug: gold-trimmed 16px medallions on a deep field
  const p = new Pix(TEX, TEX);
  const [base, dark, light, gold] = cols.map(c => C(c));
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const lx = x % 16, ly = y % 16;
    const dx = Math.abs(lx - 7.5), dy = Math.abs(ly - 7.5);
    let c = (x + y) % 2 === 0 ? base : ramp(base, 0.93);
    if (lx === 0 || ly === 0) c = dark;
    else if (lx === 1 || ly === 1) c = mix(gold, base, 0.45);
    else if (Math.round(dx + dy) === 5) c = gold;
    else if (dx + dy < 3) c = (lx + ly) % 2 ? light : ramp(light, 0.85);
    else if (dx + dy < 5 && (lx + ly) % 3 === 0) c = mix(base, gold, 0.3);
    if (fbm(seed, x, y) < 0.25) c = ramp(c, 0.94);
    p.set(x, y, c);
  }
  return p;
}

function concreteTex(seed: number, cols: string[]): Pix {
  const p = new Pix(TEX, TEX);
  const [base, dark, light, seam] = cols.map(c => C(c));
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const n = fbm(seed, x, y);
    let c = levels(n, x, y, [ramp(base, 0.95), base, ramp(base, 1.04)], [0.35, 0.7]);
    if (h2(x, y, seed) > 0.97) c = dark; else if (h2(x, y, seed + 1) > 0.975) c = light;
    if (x % 32 === 31 || y % 32 === 31) c = seam;
    p.set(x, y, c);
  }
  return p;
}

function strawTex(seed: number, cols: string[]): Pix {
  const p = new Pix(TEX, TEX);
  const [base, dark, light, deep] = cols.map(c => C(c));
  p.rect(0, 0, TEX, TEX, base);
  for (let k = 0; k < 300; k++) {
    const x = h2(k, 1, seed) * TEX, y = h2(k, 2, seed) * TEX;
    const a = (h2(k, 3, seed) - 0.5) * 1.2 + (k % 2 ? 0 : Math.PI / 2);
    const len = 3 + h2(k, 4, seed) * 4;
    const c = [dark, light, deep][k % 3];
    for (let s = 0; s < len; s++) p.set(Math.floor(x + Math.cos(a) * s + TEX) % TEX, Math.floor(y + Math.sin(a) * s + TEX) % TEX, c);
  }
  return p;
}

function iceTex(seed: number, cols: string[]): Pix {
  const p = roughStoneTex(seed, cols);
  return p;
}

const texCache = new Map<number, Pix>();
export function terrainTexture(ti: number): Pix {
  let p = texCache.get(ti);
  if (p) return p;
  const t = TERRAIN[ti];
  const seed = ti * 31 + 7;
  switch (t.style) {
    case 'soil': p = soilTex(seed, t.colors); break;
    case 'gravel': p = gravelTex(seed, t.colors); break;
    case 'sand': p = sandTex(seed, t.colors); break;
    case 'marsh': p = marshTex(seed, t.colors); break;
    case 'mud': p = soilTex(seed, t.colors); break;
    case 'water': p = waterTex(seed, t.colors, false); break;
    case 'deepwater': p = waterTex(seed, t.colors, true); break;
    case 'ice': p = iceTex(seed, t.colors); break;
    case 'rough': p = roughStoneTex(seed, t.colors); break;
    case 'smooth': p = tileTex(seed, t.colors, 16); break;
    case 'wood': p = plankTex(seed, t.colors); break;
    case 'tile': p = tileTex(seed, t.colors, 8); break;
    case 'sterile': p = tileTex(seed, t.colors, 8); break;
    case 'gold': p = tileTex(seed, t.colors, 8); break;
    case 'metal': p = metalTex(seed, t.colors); break;
    case 'carpet': p = carpetTex(seed, t.colors); break;
    case 'rug': p = rugTex(seed, t.colors); break;
    case 'concrete': p = concreteTex(seed, t.colors); break;
    case 'straw': p = strawTex(seed, t.colors); break;
    default: p = soilTex(seed, t.colors);
  }
  texCache.set(ti, p);
  return p;
}

// ---------------- rock ----------------
const rockCache = new Map<string, Pix>();
/** rock top texture for a rock type (ores get specks) */
export function rockTexture(ri: number, baseRi: number): Pix {
  const key = ri + ':' + baseRi;
  let p = rockCache.get(key);
  if (p) return p;
  const rd = ROCKS[ri];
  const bd = rd.ore ? ROCKS[baseRi] : rd;
  const seed = baseRi * 17 + 3;
  p = new Pix(TEX, TEX);
  const base = ramp(bd.color, 0.92), dark = ramp(bd.color, 0.72), deep = ramp(bd.color, 0.6), light = ramp(bd.color, 1.06);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const n = fbm(seed, x, y);
    p.set(x, y, levels(n, x, y, [deep, dark, base, light], [0.28, 0.45, 0.72]));
  }
  // strata / cracks
  for (let k = 0; k < 9; k++) {
    let x = h2(k, 1, seed) * TEX, y = h2(k, 2, seed) * TEX;
    let a = h2(k, 3, seed) * Math.PI * 2;
    for (let s = 0; s < 10; s++) {
      p.set(Math.floor(x + TEX) % TEX, Math.floor(y + TEX) % TEX, ramp(dark, 0.8));
      p.set(Math.floor(x + TEX) % TEX, Math.floor(y + 1 + TEX) % TEX, ramp(light, 1.02));
      a += (h2(k, s, seed + 9) - 0.5) * 1.1;
      x += Math.cos(a); y += Math.sin(a);
    }
  }
  if (rd.ore && rd.speck) {
    const sp = C(rd.speck);
    for (let k = 0; k < 60; k++) {
      const x = Math.floor(h2(k, 5, ri) * TEX), y = Math.floor(h2(k, 6, ri) * TEX);
      p.set(x, y, sp);
      if (h2(k, 7, ri) > 0.4) p.set((x + 1) % TEX, y, ramp(sp, 0.8));
      if (h2(k, 8, ri) > 0.6) p.set(x, (y + 1) % TEX, ramp(sp, 0.7));
      if (h2(k, 9, ri) > 0.7) p.set((x + TEX - 1) % TEX, (y + TEX - 1) % TEX, ramp(sp, 1.25));
    }
  }
  rockCache.set(key, p);
  return p;
}

/** per-pixel jitter map for organic terrain borders */
let jitter: Int8Array | null = null;
export function jitterMap(): Int8Array {
  if (jitter) return jitter;
  jitter = new Int8Array(TEX * TEX * 2);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const a = fbm(901, x, y), b = fbm(907, x, y);
    jitter[(y * TEX + x) * 2] = Math.round((a - 0.5) * 11);
    jitter[(y * TEX + x) * 2 + 1] = Math.round((b - 0.5) * 11);
  }
  return jitter;
}
export { C, type Col };
