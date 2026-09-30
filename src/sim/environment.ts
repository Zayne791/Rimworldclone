// Weather, outdoor temperature, lighting, power grids, plant growth, snow, fire and rot.
import type { World } from './world';
import type { Building, Fire } from './types';
import { BUILDINGS } from '../data/buildings';
import { PLANTS, PLANT_INDEX } from '../data/plants';
import { ITEMS } from '../data/items';
import { TERRAIN } from '../data/terrain';
import { TICKS_PER_DAY, DAYS_PER_SEASON } from '../core/constants';
import { clamp } from '../core/util';
import { ambientTemp, ensureRooms } from './rooms';
import { applyDamage } from './health';
import { buildingMaxHp, pawnShortName } from './things';
import { FILTH } from './map';
import { destroyBuilding } from './construction';

// ---------------- weather ----------------
export interface WeatherDef { id: string; label: string; rain: number; snow: number; light: number; accuracy: number; move: number; tempOffset: number; next: [string, number][]; lightning?: boolean; fog?: boolean }
export const WEATHERS: Record<string, WeatherDef> = {
  clear: { id: 'clear', label: 'Clear', rain: 0, snow: 0, light: 1, accuracy: 1, move: 1, tempOffset: 0, next: [['clear', 5], ['cloudy', 3], ['rain', 2], ['fog', 0.6], ['thunderstorm', 0.5]] },
  cloudy: { id: 'cloudy', label: 'Overcast', rain: 0, snow: 0, light: 0.85, accuracy: 1, move: 1, tempOffset: -1, next: [['clear', 3], ['cloudy', 2], ['rain', 3], ['fog', 1], ['thunderstorm', 0.8]] },
  rain: { id: 'rain', label: 'Rain', rain: 1, snow: 0, light: 0.75, accuracy: 0.8, move: 0.95, tempOffset: -2, next: [['clear', 2], ['cloudy', 3], ['rain', 2], ['thunderstorm', 1]] },
  thunderstorm: { id: 'thunderstorm', label: 'Thunderstorm', rain: 1.3, snow: 0, light: 0.65, accuracy: 0.75, move: 0.95, tempOffset: -3, lightning: true, next: [['rain', 3], ['cloudy', 2]] },
  fog: { id: 'fog', label: 'Fog', rain: 0, snow: 0, light: 0.8, accuracy: 0.6, move: 1, tempOffset: -1, fog: true, next: [['clear', 3], ['cloudy', 2]] },
  snow: { id: 'snow', label: 'Snow', rain: 0, snow: 1, light: 0.8, accuracy: 0.85, move: 0.9, tempOffset: -2, next: [['clear', 2], ['cloudy', 2], ['snow', 2], ['blizzard', 0.5]] },
  blizzard: { id: 'blizzard', label: 'Blizzard', rain: 0, snow: 2.2, light: 0.6, accuracy: 0.6, move: 0.75, tempOffset: -8, next: [['snow', 3], ['cloudy', 1]] },
};

export function seasonalTemp(w: World): number {
  const dayOfYear = (w.tick / TICKS_PER_DAY) % (DAYS_PER_SEASON * 4);
  // temperate: coldest in mid-winter (day ~52), warmest mid-summer (~22)
  const annual = 13 + 14 * Math.sin(((dayOfYear - 3) / (DAYS_PER_SEASON * 4)) * Math.PI * 2);
  const hour = w.hour;
  const daily = 5 * Math.sin(((hour - 9) / 24) * Math.PI * 2);
  return annual + daily;
}

export function weatherTick(w: World) {
  // called every 250 ticks
  const wd = WEATHERS[w.weather.cur];
  w.weather.t -= 250;
  w.weather.blend = Math.min(1, w.weather.blend + 0.02);
  const base = seasonalTemp(w);
  let cond = 0;
  if (w.hasCondition('cold_snap')) cond -= 20;
  if (w.hasCondition('heat_wave')) cond += 18;
  w.outdoorTemp = base + wd.tempOffset + cond;
  if (w.weather.t <= 0) {
    let options = wd.next;
    const cold = w.outdoorTemp < 0;
    const next = w.rng.weighted(options, o => o[1])[0];
    let n = next;
    if (cold && (n === 'rain' || n === 'thunderstorm')) n = w.rng.chance(0.7) ? 'snow' : 'cloudy';
    if (!cold && (n === 'snow' || n === 'blizzard')) n = 'rain';
    if (n !== w.weather.cur) { w.weather.next = n; w.weather.cur = n; w.weather.blend = 0; }
    w.weather.t = Math.round(TICKS_PER_DAY * w.rng.range(0.25, 0.9));
  }
  w.weather.windSpeed = clamp(w.weather.windSpeed + w.rng.range(-0.08, 0.08) + (w.weather.cur === 'thunderstorm' || w.weather.cur === 'blizzard' ? 0.02 : 0), 0.05, 1);
  // lightning
  if (wd.lightning && w.rng.chance(0.06)) {
    const m = w.map;
    const x = w.rng.int(0, m.w - 1), y = w.rng.int(0, m.h - 1);
    w.emit({ k: 'lightning', x, y });
    w.sound('thunder', x, y);
    const i = m.idx(x, y);
    if (!m.roof[i] && w.rng.chance(0.5)) startFire(w, x, y, 0.4);
  }
  // extinguish outdoor fires in rain
  if (wd.rain > 0) for (const f of [...w.fires.values()]) {
    if (!w.map.roof[w.map.idx(f.x, f.y)]) { f.size -= 0.08 * wd.rain; if (f.size <= 0) w.despawn(f); }
  }
  // wet pawns outside in rain
  if (wd.rain > 0) for (const p of w.pawns.values()) if (p.race === 'human' && !w.map.roof[w.map.idx(p.x, p.y)]) p.wet = 1200;
}

export function snowTick(w: World) {
  // called every 500 ticks; processes a slice of the map
  const m = w.map;
  const wd = WEATHERS[w.weather.cur];
  const melting = w.outdoorTemp > 1;
  if (!wd.snow && !melting) return;
  const slice = 8;
  const off = (w.tick / 500) % slice;
  for (let i = off; i < m.n; i += slice) {
    if (m.roof[i] || m.rock[i]) { if (m.snow[i]) m.setSnow(i, 0); continue; }
    if (TERRAIN[m.terrain[i]].water) continue;
    let s = m.snow[i];
    if (wd.snow && w.outdoorTemp < 0) s = Math.min(255, s + Math.round(6 * wd.snow * (0.7 + 0.6 * ((i * 2654435761) % 100) / 100)));
    else if (melting && s) s = Math.max(0, s - Math.round(2 + w.outdoorTemp * 0.6));
    if (s !== m.snow[i]) m.setSnow(i, s);
  }
}

// ---------------- light ----------------
export function sunLight(w: World): number {
  const h = w.hour;
  let s: number;
  if (h < 4.5 || h > 20.5) s = 0;
  else if (h < 7) s = (h - 4.5) / 2.5;
  else if (h > 18) s = (20.5 - h) / 2.5;
  else s = 1;
  s = clamp(s, 0, 1);
  s *= WEATHERS[w.weather.cur].light;
  if (w.hasCondition('eclipse')) s *= 0.1;
  return s;
}

/** recompute artificial light map (only when light sources or walls change) */
export function recomputeLight(w: World) {
  const m = w.map;
  if (!m.lightDirty) return;
  m.lightDirty = false;
  const L = new Float32Array(m.n);
  const col = new Float32Array(m.n * 3);
  m.sunLamp.fill(0);
  const sources: { x: number; y: number; r: number; c: [number, number, number]; sun: boolean; power: number }[] = [];
  for (const b of w.buildings.values()) {
    const d = BUILDINGS[b.def];
    if (!d.light) continue;
    if (d.light.power && !(b.powered && b.on !== false)) continue;
    if (d.light.fuel && !(b.fuel && b.fuel > 0)) continue;
    const [bw, bh] = w.rotSize(d.size, b.rot);
    sources.push({ x: b.x + (bw - 1) / 2, y: b.y + (bh - 1) / 2, r: d.light.radius, c: d.light.color, sun: !!d.light.sun, power: 1 });
  }
  for (const f of w.fires.values()) sources.push({ x: f.x, y: f.y, r: 3 + f.size * 3, c: [255, 150, 60], sun: false, power: 1 });
  const visited = new Uint32Array(0);
  for (const s of sources) {
    const R = Math.ceil(s.r);
    const sx = Math.round(s.x), sy = Math.round(s.y);
    // BFS limited by light-blocking cells
    const seen = new Set<number>();
    const q: number[] = [];
    if (!m.inb(sx, sy)) continue;
    const si = m.idx(sx, sy);
    q.push(si); seen.add(si);
    let head = 0;
    while (head < q.length) {
      const i = q[head++];
      const x = i % m.w, y = (i / m.w) | 0;
      const d = Math.hypot(x - s.x, y - s.y);
      const v = clamp(1.25 - d / s.r, 0, 1);
      if (v > L[i]) L[i] = v;
      col[i * 3] += s.c[0] * v; col[i * 3 + 1] += s.c[1] * v; col[i * 3 + 2] += s.c[2] * v;
      if (s.sun && v > 0.3) m.sunLamp[i] = 1;
      if (i !== si && m.sight[i] === 1 && (m.rock[i] || m.bld[i])) {
        // light the wall face but don't pass through
        const bid = m.bld[i];
        if (m.rock[i] || (bid && BUILDINGS[w.buildings.get(bid)?.def || 'wall']?.blocksLight)) continue;
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!m.inb(nx, ny)) continue;
        const ni = ny * m.w + nx;
        if (seen.has(ni)) continue;
        if (Math.abs(nx - sx) > R || Math.abs(ny - sy) > R) continue;
        seen.add(ni); q.push(ni);
      }
    }
  }
  m.light = L;
  for (let i = 0; i < m.n; i++) {
    const tot = col[i * 3] + col[i * 3 + 1] + col[i * 3 + 2];
    const f = tot > 0 ? Math.max(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]) : 1;
    m.lightColor[i * 3] = tot > 0 ? Math.round(255 * col[i * 3] / f) : 0;
    m.lightColor[i * 3 + 1] = tot > 0 ? Math.round(255 * col[i * 3 + 1] / f) : 0;
    m.lightColor[i * 3 + 2] = tot > 0 ? Math.round(255 * col[i * 3 + 2] / f) : 0;
  }
  w._cache.artLight = L;
}

/** total light level at cell (0..1), including sun */
export function lightAt(w: World, i: number): number {
  const m = w.map;
  const art = (w._cache.artLight as Float32Array | undefined)?.[i] ?? 0;
  const sun = m.roof[i] ? 0 : sunLight(w);
  return Math.max(art, sun);
}

export function updateCombinedLight(w: World) {
  // m.light is used by mood (darkness) and plants; combine sun + art
  const m = w.map;
  const art = w._cache.artLight as Float32Array | undefined;
  const sun = sunLight(w);
  if (!art) return;
  const comb = (w._cache.combLight ||= new Float32Array(m.n)) as Float32Array;
  for (let i = 0; i < m.n; i++) comb[i] = Math.max(art[i], m.roof[i] ? 0 : sun);
  m.light = comb;
}

// ---------------- power ----------------
export interface PowerNet { id: number; gen: number; use: number; stored: number; cap: number; buildings: number[]; faction: number }

export function powerTick(w: World) {
  // every 60 ticks
  const m = w.map;
  const dtDays = 60 / TICKS_PER_DAY;
  // Build nets via flood fill over conduit cells and powered building footprints
  const cellB = new Map<number, Building>();
  const powered: Building[] = [];
  for (const b of w.buildings.values()) {
    const d = BUILDINGS[b.def];
    if (!d.power) continue;
    powered.push(b);
    for (const i of w.footprint(b.x, b.y, d.size, b.rot)) cellB.set(i, b);
  }
  if (!powered.length) { w._cache.powerNets = []; return; }
  const netOf = new Map<number, number>();
  const nets: PowerNet[] = [];
  const isNode = (i: number) => m.conduit[i] > 0 || cellB.has(i);
  for (const b of powered) {
    const start = m.idx(b.x, b.y);
    if (netOf.has(start)) continue;
    const net: PowerNet = { id: nets.length + 1, gen: 0, use: 0, stored: 0, cap: 0, buildings: [], faction: b.faction };
    nets.push(net);
    const stack = [start]; netOf.set(start, net.id);
    const seenB = new Set<number>();
    while (stack.length) {
      const i = stack.pop()!;
      const bb = cellB.get(i);
      if (bb && !seenB.has(bb.id)) {
        seenB.add(bb.id); net.buildings.push(bb.id);
        for (const fi of w.footprint(bb.x, bb.y, BUILDINGS[bb.def].size, bb.rot)) if (!netOf.has(fi)) { netOf.set(fi, net.id); stack.push(fi); }
      }
      const x = i % m.w, y = (i / m.w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!m.inb(nx, ny)) continue;
        const ni = ny * m.w + nx;
        if (netOf.has(ni) || !isNode(ni)) continue;
        netOf.set(ni, net.id); stack.push(ni);
      }
    }
  }
  const sun = sunLight(w);
  const flare = w.hasCondition('solar_flare');
  for (const net of nets) {
    const bs = net.buildings.map(id => w.buildings.get(id)!).filter(Boolean);
    for (const b of bs) {
      const d = BUILDINGS[b.def];
      const pw = d.power!;
      if (pw.gen) {
        let out = 0;
        if (!flare) {
          if (pw.kind === 'solar') out = pw.gen * sun * (m.roof[m.idx(b.x, b.y)] ? 0 : 1);
          else if (pw.kind === 'wind') out = pw.gen * clamp(w.weather.windSpeed * 1.1, 0, 1);
          else if (pw.kind === 'fuel') { out = (b.fuel || 0) > 0 && b.on !== false ? pw.gen : 0; }
          else if (pw.kind === 'geo') out = pw.gen;
        }
        b.output = Math.round(out);
        net.gen += out;
      }
      if (pw.use && b.on !== false) {
        let use = pw.use;
        const bd = d.bench;
        // benches only draw full power while in use
        if (bd && !(b.users && b.users.length)) use = pw.use * 0.1;
        if (d.heat?.power) { const t = ambientTemp(w, b.x, b.y); if (t >= (b.tgt ?? 21)) use = pw.use * 0.1; }
        net.use += use;
      }
      if (pw.battery) { net.stored += b.stored || 0; net.cap += pw.battery; }
    }
    const balance = net.gen - net.use; // W
    let ok = balance >= 0;
    const batteries = bs.filter(b => BUILDINGS[b.def].power!.battery);
    if (balance > 0 && batteries.length) {
      // charge
      let e = balance * dtDays * 0.5;
      for (const b of batteries) { const cap = BUILDINGS[b.def].power!.battery!; const add = Math.min(cap - (b.stored || 0), e / batteries.length); b.stored = (b.stored || 0) + add; }
    } else if (balance < 0 && batteries.length) {
      const need = -balance * dtDays;
      if (net.stored >= need) {
        ok = true;
        let rem = need;
        for (const b of batteries) { const take = Math.min(b.stored || 0, rem); b.stored = (b.stored || 0) - take; rem -= take; }
      }
    }
    for (const b of bs) {
      const d = BUILDINGS[b.def];
      if (d.power!.use) {
        const was = b.powered;
        b.powered = ok && b.on !== false && !flare;
        if (was !== b.powered && d.light) m.lightDirty = true;
      }
    }
    net.stored = batteries.reduce((s, b) => s + (b.stored || 0), 0);
  }
  // consumers with no net at all
  w._cache.powerNets = nets;
  // short circuit (rare)
}

// ---------------- plants ----------------
export function plantGrowthTick(w: World) {
  // called every 50 ticks; processes 1/40 slice => each plant every 2000 ticks
  const m = w.map;
  const SLICES = 40;
  const slice = (w.tick / 50) % SLICES;
  const dtDays = 2000 / TICKS_PER_DAY;
  const temp = w.outdoorTemp;
  const tempF = temp < 0 ? 0 : temp < 10 ? temp / 10 : temp > 42 ? 0 : temp > 35 ? (42 - temp) / 7 : 1;
  const sun = sunLight(w);
  const art = w._cache.artLight as Float32Array | undefined;
  const blight = w._cache.blight as number | undefined;
  for (let i = slice; i < m.n; i += SLICES) {
    const p = m.plant[i];
    if (!p) continue;
    const pd = PLANTS[p];
    const g = m.growth[i];
    if (g >= 1) continue;
    const roofed = m.roof[i] > 0;
    const light = Math.max(roofed ? 0 : sun, art ? art[i] : 0, m.sunLamp[i] ? 1 : 0);
    let tf = tempF;
    if (roofed) { const rt = ambientTemp(w, i % m.w, (i / m.w) | 0); tf = rt < 0 ? 0 : rt < 10 ? rt / 10 : rt > 42 ? 0 : 1; }
    if (pd.minTemp !== undefined && temp < pd.minTemp) tf = 0;
    // plants grow ~only in light (except devilstrand)
    const needLight = pd.lightMin ?? 0.35;
    const lf = light >= needLight ? 1 : pd.kind === 'tree' || pd.kind === 'grass' ? 0.2 : 0;
    let fert = m.fertility(i);
    const bid = m.bld[i];
    if (bid) { const b = w.buildings.get(bid); if (b && BUILDINGS[b.def].growBasin) fert = b.powered ? BUILDINGS[b.def].growBasin!.fert : 0; }
    const ff = pd.kind === 'crop' ? clamp(fert, 0.1, 2.5) : Math.min(1, fert + 0.3);
    const rate = (dtDays / pd.growDays) * tf * lf * ff;
    if (rate > 0) m.setGrowth(i, Math.min(1, g + rate));
    // winter kills crops outdoors
    if (temp < -8 && !roofed && pd.kind === 'crop' && w.rng.chance(0.08)) m.setPlant(i, 0);
  }
  // wild plant spreading (slowly repopulate)
  if (w.tick % 2000 === 0) {
    for (let k = 0; k < Math.round(m.n / 1500); k++) {
      const i = w.rng.int(0, m.n - 1);
      if (m.plant[i] || m.rock[i] || m.bld[i] || m.floor[i] || m.zone[i]) continue;
      const t = TERRAIN[m.terrain[i]];
      if (t.fert < 0.5 || t.water) continue;
      if (temp < 0) continue;
      const r = w.rng.f();
      const np = r < 0.6 ? PLANT_INDEX.grass : r < 0.85 ? PLANT_INDEX.tallgrass : r < 0.93 ? PLANT_INDEX.dandelion : r < 0.98 ? PLANT_INDEX.bush : PLANT_INDEX.poplar;
      m.setPlant(i, np, 0.05);
    }
  }
}

// ---------------- fire ----------------
export function startFire(w: World, x: number, y: number, size = 0.3): Fire | null {
  const m = w.map;
  if (!m.inb(x, y)) return null;
  const i = m.idx(x, y);
  if (m.fire[i]) { const f = w.fires.get(m.fire[i]); if (f) f.size = Math.max(f.size, size); return f || null; }
  if (m.isWater(i) || m.rock[i]) return null;
  const f: Fire = { id: w.newId(), kind: 'fire', x, y, size, t: 0 };
  w.register(f);
  m.lightDirty = true;
  return f;
}

function cellFlammability(w: World, i: number): number {
  const m = w.map;
  let f = 0;
  if (m.plant[i]) f = Math.max(f, PLANTS[m.plant[i]].flam * (0.4 + m.growth[i] * 0.6));
  const bid = m.bld[i];
  if (bid) { const b = w.buildings.get(bid); if (b) { const d = BUILDINGS[b.def]; const s = b.stuff ? ITEMS[b.stuff]?.stuff : undefined; f = Math.max(f, s ? s.flam : (d.flam ?? 0.5)); } }
  const items = m.items[i];
  if (items) for (const id of items) { const it = w.items.get(id); if (it) f = Math.max(f, ITEMS[it.def].flam ?? 0.3); }
  if (m.floor[i] && TERRAIN[m.floor[i]].id.includes('wood')) f = Math.max(f, 0.4);
  if (m.floor[i] && TERRAIN[m.floor[i]].id.includes('carpet')) f = Math.max(f, 0.5);
  if (m.snow[i] > 60) f *= 0.3;
  return f;
}

export function fireTick(w: World) {
  // every 30 ticks
  const m = w.map;
  const rainF = WEATHERS[w.weather.cur].rain;
  for (const f of [...w.fires.values()]) {
    const i = m.idx(f.x, f.y);
    f.t += 30;
    const flam = cellFlammability(w, i);
    if (flam <= 0.05) f.size -= 0.05; else f.size = Math.min(1.75, f.size + 0.02 * flam);
    if (rainF && !m.roof[i]) f.size -= 0.03 * rainF;
    if (f.size <= 0) { w.despawn(f); m.addFilth(f.x, f.y, FILTH.ash, 30); m.lightDirty = true; continue; }
    // damage contents
    const dmg = 3 + f.size * 6;
    if (m.plant[i] && w.rng.chance(0.2 * f.size)) { m.setPlant(i, 0); m.addFilth(f.x, f.y, FILTH.ash, 40); }
    const bid = m.bld[i];
    if (bid) { const b = w.buildings.get(bid); if (b && cellFlammability(w, i) > 0.05) { b.hp -= dmg; if (b.hp <= 0) destroyBuilding(w, b, 'burned'); } }
    const items = m.items[i];
    if (items) for (const id of [...items]) { const it = w.items.get(id); if (it && (ITEMS[it.def].flam ?? 0) > 0) { it.hp -= dmg; if (it.hp <= 0) w.despawn(it); } }
    for (const p of w.pawnsAt(f.x, f.y)) if (w.rng.chance(0.3)) applyDamage(w, p, { amount: 2 + f.size * 3, type: 'burn' });
    // spread
    if (f.size > 0.4 && w.rng.chance(0.06 * f.size)) {
      const dx = w.rng.int(-1, 1), dy = w.rng.int(-1, 1);
      const nx = f.x + dx, ny = f.y + dy;
      if (m.inb(nx, ny)) {
        const ni = m.idx(nx, ny);
        const fl = cellFlammability(w, ni);
        if (fl > 0.1 && !m.fire[ni] && w.rng.chance(fl)) startFire(w, nx, ny, 0.2);
      }
    }
  }
}

// ---------------- rot & deterioration ----------------
export function rotTick(w: World) {
  // every 250 ticks
  const m = w.map;
  const dtDays = 250 / TICKS_PER_DAY;
  for (const it of [...w.items.values()]) {
    const d = ITEMS[it.def];
    if (it.corpse) {
      it.age = (it.age || 0) + 250;
      const t = ambientTemp(w, it.x, it.y);
      if (t > 0 && !it.corpse.race.startsWith('scy') && !['scyther', 'lancer', 'centipede'].includes(it.corpse.race)) it.rot = Math.min(1.5, (it.rot || 0) + dtDays / 2.5 * (t > 10 ? 1 : 0.5));
      if ((it.rot || 0) > 1.4 && w.rng.chance(0.02)) { w.despawn(it); m.addFilth(it.x, it.y, FILTH.blood, 20); }
      continue;
    }
    if (d.food?.rotDays) {
      const t = ambientTemp(w, it.x, it.y);
      if (t > 0) it.rot = Math.min(1, (it.rot || 0) + dtDays / d.food.rotDays * (t > 10 ? 1 : 0.5));
      if ((it.rot || 0) >= 1 && w.rng.chance(0.05)) { w.despawn(it); m.addFilth(it.x, it.y, FILTH.dirt, 15); }
    }
    // outdoor deterioration
    if (!m.roof[m.idx(it.x, it.y)] && (d.cat === 'weapon' || d.cat === 'apparel' || d.cat === 'textile' || d.cat === 'medicine') && w.rng.chance(0.02)) {
      it.hp -= 1;
      if (it.hp <= 0) w.despawn(it);
    }
  }
}

export function refuelNeeded(b: Building): number {
  const d = BUILDINGS[b.def];
  if (!d.fuel) return 0;
  return Math.max(0, d.fuel.cap - (b.fuel || 0));
}

export function fuelTick(w: World) {
  // every 60 ticks
  const dt = 60 / TICKS_PER_DAY;
  for (const b of w.buildings.values()) {
    const d = BUILDINGS[b.def];
    if (!d.fuel) continue;
    if (b.on === false) continue;
    // benches only burn fuel when in use; lights/heaters always
    if (d.bench && !d.light && !(b.users && b.users.length)) continue;
    if ((b.fuel || 0) > 0) {
      const was = b.fuel!;
      b.fuel = Math.max(0, b.fuel! - d.fuel.perDay * dt);
      if (was > 0 && b.fuel === 0 && d.light) w.map.lightDirty = true;
    }
  }
}

export { buildingMaxHp, pawnShortName, ensureRooms };
