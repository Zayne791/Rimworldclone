import { Rng } from '../core/rng';
import { Simplex } from '../core/noise';
import { T, ROCK_INDEX, TERRAIN } from '../data/terrain';
import { PLANT_INDEX, PLANTS } from '../data/plants';
import { ROOF } from './map';
import type { World } from './world';
import { clamp } from '../core/util';

export function generateMap(w: World) {
  const m = w.map;
  const rng = new Rng(w.seed + ':map');
  const elevN = new Simplex(rng), moistN = new Simplex(rng), stoneN = new Simplex(rng), fertN = new Simplex(rng), forestN = new Simplex(rng), warpN = new Simplex(rng);
  const W = m.w, H = m.h;
  const stones = rng.shuffle(['granite', 'limestone', 'marble', 'sandstone', 'slate']).slice(0, 2);
  m.stoneBase = stones[0];
  const elev = new Float32Array(m.n), moist = new Float32Array(m.n);
  const mountainBias = rng.range(-0.04, 0.06);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const wx = x + warpN.noise(x / 40, y / 40) * 10, wy = y + warpN.noise(x / 40 + 99, y / 40) * 10;
    let e = elevN.fbm(wx / 70, wy / 70, 5);
    // push mountains toward edges a bit so there's usable land
    const ex = Math.min(x, W - 1 - x) / W, ey = Math.min(y, H - 1 - y) / H;
    const edge = Math.min(ex, ey);
    e += (0.18 - edge) * 0.35 + mountainBias;
    elev[i] = e;
    moist[i] = moistN.fbm(x / 55, y / 55, 4);
  }
  // River
  const hasRiver = rng.chance(0.55);
  const riverMask = new Uint8Array(m.n);
  if (hasRiver) {
    const horiz = rng.chance(0.5);
    const len = horiz ? W : H;
    let pos = rng.range(0.25, 0.75) * (horiz ? H : W);
    const width = rng.range(2.5, 4.5);
    let drift = 0;
    for (let t = 0; t < len; t++) {
      drift += (rng.f() - 0.5) * 0.25; drift = clamp(drift, -0.8, 0.8);
      pos += drift + warpN.noise(t / 30, 7) * 0.6;
      const wd = width + warpN.noise(t / 20, 3) * 1.2;
      for (let o = -Math.ceil(wd + 3); o <= Math.ceil(wd + 3); o++) {
        const x = horiz ? t : Math.round(pos + o), y = horiz ? Math.round(pos + o) : t;
        if (!m.inb(x, y)) continue;
        const i = y * W + x;
        const d = Math.abs(o);
        if (d <= wd) riverMask[i] = Math.max(riverMask[i], 2);
        else if (d <= wd + 2.5) riverMask[i] = Math.max(riverMask[i], 1);
      }
    }
  }
  const MOUNTAIN = 0.6;
  for (let i = 0; i < m.n; i++) {
    const x = i % W, y = (i / W) | 0;
    const e = elev[i], mo = moist[i];
    let t = T('soil');
    if (riverMask[i] === 2 && e < MOUNTAIN + 0.05) { t = T('shallow_water'); m.terrain[i] = t; elev[i] = 0.3; continue; }
    if (e < 0.2) t = e < 0.14 ? T('deep_water') : T('shallow_water');
    else if (e < 0.235) t = mo > 0.55 ? T('marsh') : T('sand');
    else if (riverMask[i] === 1) t = mo > 0.6 ? T('mud') : T('sand');
    else if (e > MOUNTAIN - 0.022) t = T('gravel');
    else {
      const f = fertN.fbm(x / 25, y / 25, 3);
      if (mo > 0.66 && f > 0.55) t = T('marsh');
      else if (f > 0.66) t = T('rich_soil');
      else if (f < 0.22 && mo < 0.35) t = T('gravel');
      else t = T('soil');
    }
    m.terrain[i] = t;
    if (e > MOUNTAIN) {
      const s = stoneN.fbm(x / 45, y / 45, 2) > 0.5 ? stones[0] : stones[1];
      m.rock[i] = ROCK_INDEX[s];
      m.terrain[i] = T('rough_' + s);
      m.roof[i] = e > MOUNTAIN + 0.07 ? ROOF.thick : ROOF.thin;
    }
  }
  // Ore veins
  const area = (W * H) / (150 * 150);
  const veins: [string, number, number, number][] = [
    ['steel_ore', 14, 6, 16], ['machinery', 6, 3, 6], ['silver_ore', 4, 4, 9], ['gold_ore', 3, 3, 6],
    ['plasteel_ore', 3, 3, 7], ['uranium_ore', 2, 3, 6], ['jade_ore', 2, 3, 6],
  ];
  for (const [ore, count, minS, maxS] of veins) {
    const n = Math.round(count * area);
    for (let k = 0; k < n; k++) {
      // find a rock cell
      let tries = 0, i = -1;
      while (tries++ < 200) {
        const c = rng.int(0, m.n - 1);
        if (m.rock[c] && !TERRAIN_ORE(m.rock[c])) { i = c; break; }
      }
      if (i < 0) continue;
      const size = rng.int(minS, maxS);
      let x = i % W, y = (i / W) | 0;
      for (let s = 0; s < size; s++) {
        const ii = y * W + x;
        if (m.rock[ii]) m.rock[ii] = ROCK_INDEX[ore];
        const d = rng.int(0, 3);
        x = clamp(x + (d === 0 ? 1 : d === 1 ? -1 : 0), 0, W - 1);
        y = clamp(y + (d === 2 ? 1 : d === 3 ? -1 : 0), 0, H - 1);
      }
    }
  }
  for (let i = 0; i < m.n; i++) if (m.rock[i]) m.rockHp[i] = rockHp(m.rock[i]);

  // Plants
  for (let i = 0; i < m.n; i++) {
    if (m.rock[i]) continue;
    const t = TERRAIN[m.terrain[i]];
    if (t.fert <= 0.05 || t.water) continue;
    const x = i % W, y = (i / W) | 0;
    const forest = forestN.fbm(x / 30, y / 30, 3);
    const r = rng.f();
    let p = 0;
    if (t.id === 'marsh') { if (r < 0.35) p = PLANT_INDEX.tallgrass; else if (r < 0.4) p = PLANT_INDEX.bush; }
    else if (forest > 0.6 && r < 0.16 + (forest - 0.6) * 1.2) p = rng.pick([PLANT_INDEX.oak, PLANT_INDEX.poplar, PLANT_INDEX.pine, PLANT_INDEX.birch, PLANT_INDEX.oak]);
    else if (r < 0.018 * t.fert) p = rng.pick([PLANT_INDEX.oak, PLANT_INDEX.poplar, PLANT_INDEX.pine, PLANT_INDEX.birch]);
    else if (r < 0.05) p = PLANT_INDEX.bush;
    else if (r < 0.056) p = PLANT_INDEX.berry_bush;
    else if (r < 0.0575) p = PLANT_INDEX.healroot_wild;
    else if (r < 0.075) p = PLANT_INDEX.dandelion;
    else if (r < 0.17 + t.fert * 0.3) p = PLANT_INDEX.tallgrass;
    else if (r < 0.28 + t.fert * 0.45) p = PLANT_INDEX.grass;
    if (p) {
      const pd = PLANTS[p];
      if (t.fert < pd.minFert) continue;
      m.plant[i] = p;
      m.growth[i] = pd.kind === 'tree' ? rng.range(0.35, 1) : rng.range(0.15, 1);
    }
  }
  m.rebuildCosts();
}

function TERRAIN_ORE(r: number) { return r >= ROCK_INDEX.steel_ore; }
function rockHp(r: number) { return [0, 1800, 1550, 1200, 1400, 1300, 1500, 1500, 1500, 2000, 2000, 1500, 1500][r] || 1500; }

/** openness score around (x,y) - fraction of buildable, passable cells within radius */
export function openness(w: World, x: number, y: number, r: number): number {
  const m = w.map;
  let ok = 0, tot = 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const xx = x + dx, yy = y + dy;
    tot++;
    if (!m.inb(xx, yy)) continue;
    const i = yy * m.w + xx;
    if (m.rock[i]) continue;
    const t = TERRAIN[m.terrain[i]];
    if (!t.canBuild || t.water) continue;
    ok++;
  }
  return ok / tot;
}

export function findStartSite(w: World, px: number, py: number, avoid: [number, number][] = [], minSep = 50): [number, number] {
  const m = w.map;
  let best: [number, number] = [px, py], bestScore = -1;
  const step = 3;
  for (let r = 0; r < Math.max(m.w, m.h); r += step) {
    for (let a = 0; a < Math.max(1, r * 2); a++) {
      const ang = (a / Math.max(1, r * 2)) * Math.PI * 2;
      const x = Math.round(px + Math.cos(ang) * r), y = Math.round(py + Math.sin(ang) * r);
      if (x < 15 || y < 15 || x >= m.w - 15 || y >= m.h - 15) continue;
      if (avoid.some(([ax, ay]) => Math.hypot(ax - x, ay - y) < minSep)) continue;
      const s = openness(w, x, y, 6);
      const score = s - r * 0.002;
      if (s > 0.9 && score > bestScore) { bestScore = score; best = [x, y]; }
    }
    if (bestScore > 0.85) break;
  }
  return best;
}
