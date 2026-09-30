// Procedural pixel-art plants: grass, flowers, bushes, trees and crops (4 growth stages, 3 variants).
import { Pix, C, ramp, mix, bayer, h2, addSprite, type Sprite, type RGBA } from '../pixel';
import { PLANTS } from '../../data/plants';

const SHADOW: RGBA = [20, 16, 30, 70];

function canopy(p: Pix, cx: number, cy: number, rx: number, ry: number, base: RGBA, seed: number, lumps = 5) {
  const pts: [number, number, number, number][] = [[cx, cy, rx, ry]];
  for (let k = 0; k < lumps; k++) {
    const a = (k / lumps) * Math.PI * 2 + h2(k, 1, seed) * 0.8;
    pts.push([cx + Math.cos(a) * rx * 0.55, cy + Math.sin(a) * ry * 0.5, rx * (0.45 + h2(k, 2, seed) * 0.2), ry * (0.45 + h2(k, 3, seed) * 0.2)]);
  }
  for (const [x0, y0, a, b] of pts) {
    p.ellipse(x0, y0, a, b, (x, y) => {
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      const l = -nx * 0.5 - ny * 0.8 + (h2(x, y, seed) - 0.5) * 0.5 + (bayer(x, y) - 0.5) * 0.3;
      return l > 0.55 ? ramp(base, 1.22) : l > 0.1 ? ramp(base, 1.06) : l > -0.35 ? base : l > -0.75 ? ramp(base, 0.8) : ramp(base, 0.64);
    });
  }
  // leaf highlight specks
  for (let k = 0; k < rx * ry * 0.3; k++) {
    const x = Math.round(cx + (h2(k, 5, seed) - 0.5) * rx * 1.6), y = Math.round(cy + (h2(k, 6, seed) - 0.7) * ry * 1.4);
    if (p.opaque(x, y) && p.opaque(x, y - 1)) p.set(x, y, ramp(base, 1.3));
  }
}

function trunk(p: Pix, cx: number, top: number, bottom: number, w: number, col: RGBA, birch = false) {
  for (let y = top; y <= bottom; y++) for (let dx = 0; dx < w; dx++) {
    const x = Math.round(cx - w / 2 + dx);
    let c = dx === 0 ? ramp(col, 1.12) : dx === w - 1 ? ramp(col, 0.72) : col;
    if (birch && (y * 7 + dx * 3) % 5 === 0) c = C('#2a2426');
    p.set(x, y, c);
  }
  // roots
  p.set(Math.round(cx - w / 2) - 1, bottom, ramp(col, 0.8));
  p.set(Math.round(cx + w / 2), bottom, ramp(col, 0.7));
}

function tree(id: string, stage: number, variant: number): Sprite {
  const pd = PLANTS.find(p => p.id === id)!;
  const s = [0.42, 0.62, 0.82, 1][stage];
  const seed = id.length * 31 + variant * 7 + stage;
  const base = C(pd.color), base2 = C(pd.color2 || pd.color);
  const leaf = mix(base, base2, 0.35 + variant * 0.15);
  let W = 28, H = 34;
  const p = new Pix(W, H);
  const cx = W / 2;
  const bottom = H - 3;
  p.ellipse(cx, bottom + 0.5, 6 * s + 2, 2.2 * s + 1, SHADOW);
  const bark = C(id === 'birch' ? '#e8e4dc' : id === 'pine' ? '#5a3e28' : '#6e4c30');
  if (id === 'pine') {
    trunk(p, cx, bottom - 6 * s, bottom, 2 + (s > 0.7 ? 1 : 0), bark);
    const tiers = 3;
    for (let t = 0; t < tiers; t++) {
      const ty = bottom - 5 * s - t * 7 * s;
      const hw = (10 - t * 2.8) * s + 1;
      const th = 9 * s;
      p.poly([[cx - hw, ty], [cx + hw, ty], [cx, ty - th]], ramp(leaf, 0.85));
      // shading: left light, right dark
      for (let y = Math.floor(ty - th); y <= ty; y++) for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
        if (!p.opaque(x, y)) continue;
        const c = p.get(x, y)!;
        const f = (x < cx - 1 ? 1.12 : x > cx + 1 ? 0.8 : 1) * (y > ty - 1.5 ? 0.78 : 1) * (0.94 + h2(x, y, seed) * 0.12);
        p.set(x, y, ramp(leaf, 0.85 * f));
      }
    }
  } else {
    const narrow = id === 'poplar';
    const th = narrow ? 8 : id === 'birch' ? 8 : 7;
    trunk(p, cx, bottom - th * s - 4, bottom, s > 0.6 ? 3 : 2, bark, id === 'birch');
    const rx = (narrow ? 6.5 : id === 'birch' ? 8.5 : 11) * s + 1.5, ry = (narrow ? 12 : id === 'birch' ? 9 : 9.5) * s + 1.5;
    const cy = bottom - th * s - ry * 0.75 - 2;
    canopy(p, cx, cy, rx, ry, leaf, seed, narrow ? 4 : 6);
    // a few branches peeking
    if (!narrow && s > 0.7) { p.set(cx - 3, cy + ry * 0.6, bark); p.set(cx + 3, cy + ry * 0.5, ramp(bark, 0.8)); }
  }
  p.outline(undefined, false, true);
  // restore shadow (outline may add around it) – shadow is translucent, fine
  return addSprite(p, Math.round((16 - W) / 2), 16 - H + 1);
}

function grass(pd: typeof PLANTS[number], stage: number, variant: number, tall: boolean): Sprite {
  const p = new Pix(16, 16);
  const c1 = C(pd.color), c2 = C(pd.color2 || pd.color);
  const seed = variant * 13 + (tall ? 5 : 0);
  const n = [3, 6, 9, 12][stage] * (tall ? 1.3 : 1);
  for (let k = 0; k < n; k++) {
    const x = 1 + Math.floor(h2(k, 1, seed) * 14), y = 4 + Math.floor(h2(k, 2, seed) * 11);
    const hgt = (tall ? 3 : 2) + Math.floor(h2(k, 3, seed) * (tall ? 4 : 2)) * (0.5 + stage * 0.2);
    const lean = h2(k, 4, seed) > 0.5 ? 1 : -1;
    for (let j = 0; j < hgt; j++) {
      const c = j === Math.floor(hgt) - 1 ? ramp(c2, 1.1) : j === 0 ? ramp(c1, 0.8) : mix(c1, c2, j / hgt);
      p.set(x + (j > hgt * 0.6 ? lean : 0), y - j, c);
    }
    if (h2(k, 5, seed) > 0.5) { p.set(x - 1, y - 1, ramp(c1, 0.9)); }
  }
  if (pd.kind === 'flower' && stage >= 2) {
    const fc = C(pd.fruit || '#f2d23c');
    for (let k = 0; k < (stage === 3 ? 5 : 3); k++) {
      const x = 2 + Math.floor(h2(k, 7, seed) * 12), y = 3 + Math.floor(h2(k, 8, seed) * 9);
      p.set(x, y, fc); p.set(x + 1, y, ramp(fc, 0.8)); p.set(x, y - 1, ramp(fc, 1.2)); p.set(x, y + 1, ramp(c1, 0.8));
    }
  }
  return addSprite(p, 0, 0);
}

function bush(pd: typeof PLANTS[number], stage: number, variant: number, ripe: boolean): Sprite {
  const p = new Pix(18, 18);
  const s = [0.45, 0.65, 0.85, 1][stage];
  const base = mix(C(pd.color), C(pd.color2 || pd.color), 0.4);
  const seed = pd.id.length * 3 + variant;
  p.ellipse(9, 15.5, 6 * s + 1, 1.6, SHADOW);
  canopy(p, 9, 15 - 5.5 * s, 7 * s + 0.5, 5.5 * s + 0.5, base, seed, 4);
  if (ripe && pd.fruit) {
    const fc = C(pd.fruit);
    for (let k = 0; k < 7; k++) {
      const x = Math.round(9 + (h2(k, 1, seed) - 0.5) * 11 * s), y = Math.round(15 - 5.5 * s + (h2(k, 2, seed) - 0.5) * 8 * s);
      if (p.opaque(x, y)) { p.set(x, y, fc); p.set(x, y - 1, ramp(fc, 1.3)); }
    }
  }
  p.outline();
  return addSprite(p, -1, -3);
}

function crop(pd: typeof PLANTS[number], stage: number, variant: number, ripe: boolean): Sprite {
  const id = pd.id;
  const tall = id === 'corn';
  const H = tall ? 24 : 16;
  const p = new Pix(16, H);
  const c1 = C(pd.color), c2 = C(pd.color2 || pd.color), fc = C(pd.fruit || '#fff');
  const s = [0.3, 0.55, 0.8, 1][stage];
  const oy = H - 16;
  const seed = variant * 5 + id.length;
  // soil mound
  p.ellipse(8, oy + 13, 6, 2.5, [78, 58, 38, 150]);
  if (id === 'rice' || id === 'haygrass') {
    for (let k = 0; k < 9; k++) {
      const x = 2 + k * 1.5 + h2(k, 1, seed), hgt = (5 + h2(k, 2, seed) * 5) * s + 1;
      for (let j = 0; j < hgt; j++) p.set(Math.round(x + (j > hgt * 0.7 ? 1 : 0)), oy + 13 - j, j > hgt - 2 && ripe ? fc : mix(c1, c2, ripe ? 0.6 : j / hgt * 0.3));
      if (ripe) { p.set(Math.round(x) + 1, oy + 13 - Math.floor(hgt) + 1, ramp(fc, 0.85)); }
    }
  } else if (id === 'corn') {
    for (let k = 0; k < 3; k++) {
      const x = 3 + k * 5, hgt = 18 * s + 2;
      for (let j = 0; j < hgt; j++) p.set(x, oy + 13 - j, j % 5 === 0 ? ramp(c1, 0.85) : c1);
      for (let l = 0; l < 3; l++) { const ly = oy + 13 - Math.floor(hgt * (0.3 + l * 0.25)); p.line(x, ly, x + (l % 2 ? 3 : -3), ly - 2, c2); }
      if (ripe) { p.rect(x + 1, oy + 13 - Math.floor(hgt * 0.55), 2, 4, fc); p.set(x + 1, oy + 13 - Math.floor(hgt * 0.55) - 1, C('#c8a040')); }
    }
  } else if (id === 'cotton') {
    for (let k = 0; k < 3; k++) {
      const x = 3 + k * 5, hgt = 9 * s + 2;
      p.vline(x, oy + 13 - Math.floor(hgt), oy + 13, ramp(c1, 0.8));
      p.blob(x, oy + 13 - hgt * 0.6, 2.5 * s + 0.5, 2 * s + 0.5, c2);
      if (ripe) for (let b = 0; b < 3; b++) { const bx = x - 2 + b * 2, by = oy + 13 - Math.floor(hgt) + (b % 2); p.set(bx, by, fc); p.set(bx + 1, by, ramp(fc, 0.9)); p.set(bx, by - 1, fc); }
    }
  } else if (id === 'devilstrand_plant') {
    for (let k = 0; k < 4; k++) {
      const x = 3 + k * 3.3, hgt = (3 + h2(k, 1, seed) * 3) * s + 1;
      p.vline(Math.round(x), oy + 13 - Math.floor(hgt), oy + 13, C('#d8c8b0'));
      p.ellipse(x, oy + 13 - hgt, 2.2 * s + 0.6, 1.4 * s + 0.4, ripe ? fc : c2);
    }
  } else {
    // leafy low plants: potato, strawberry, healroot, rose, daylily
    for (let k = 0; k < 3; k++) {
      const x = 3.5 + k * 4.5, y = oy + 11.5;
      p.blob(x, y - 1.5 * s, 3 * s + 0.8, 2.6 * s + 0.6, mix(c1, c2, 0.3 + (k % 2) * 0.3));
      if (ripe || (pd.kind === 'flower' && stage >= 2)) {
        for (let b = 0; b < 3; b++) {
          const bx = Math.round(x - 2 + h2(k, b, seed) * 4), by = Math.round(y - 3 * s + h2(b, k, seed) * 3);
          p.set(bx, by, fc); if (id === 'healroot') p.set(bx, by - 1, C('#fffff0'));
          else p.set(bx + 1, by, ramp(fc, 0.8));
        }
      }
    }
  }
  p.outline();
  return addSprite(p, 0, -oy);
}

const cache = new Map<string, Sprite>();
export function plantSprite(pi: number, growth: number, variant: number): Sprite | null {
  const pd = PLANTS[pi];
  if (!pd || pd.id === 'none') return null;
  const stage = Math.min(3, Math.floor(growth * 4));
  const ripe = !!pd.harvestItem && growth >= (pd.harvestMin ?? 1) - 0.001;
  const v = variant % 3;
  const key = pi + ':' + stage + ':' + v + ':' + (ripe ? 1 : 0);
  let s = cache.get(key);
  if (s) return s;
  if (pd.kind === 'tree') s = tree(pd.id, stage, v);
  else if (pd.kind === 'grass' || (pd.kind === 'flower' && pd.wild)) s = grass(pd, stage, v, pd.id === 'tallgrass');
  else if (pd.kind === 'bush') s = bush(pd, stage, v, ripe);
  else s = crop(pd, stage, v, ripe);
  cache.set(key, s);
  return s;
}

/** flat plants get baked into the terrain chunk cache */
export function isFlatPlant(pi: number): boolean {
  const pd = PLANTS[pi];
  return !!pd && (pd.kind === 'grass' || (pd.kind === 'flower' && pd.wild));
}
