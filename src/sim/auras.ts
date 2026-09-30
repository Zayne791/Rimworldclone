// Area effects and self-running production for research-tree buildings: producers (beehives, meat
// vats, deep drills), fertilizer/moisture/terraform fields, tool cabinets, bed-side equipment,
// firefoam poppers, orbital scanners and weather controllers.
import type { World } from './world';
import type { Building } from './types';
import { BUILDINGS } from '../data/buildings';
import { ITEMS } from '../data/items';
import { T, TERRAIN } from '../data/terrain';
import { TICKS_PER_DAY } from '../core/constants';
import { spawnItem } from './things';
import { ambientTemp } from './rooms';

type Kind = NonNullable<import('../data/types').BuildingDef['aura']>['kind'];

/** buildings with an aura or producer, grouped by kind; rebuilt when buildings change */
function lists(w: World): Map<string, Building[]> {
  const v = w._cache.buildingsVersion || 0;
  let c = w._cache.auraLists as { v: number; m: Map<string, Building[]> } | undefined;
  if (!c || c.v !== v) {
    const m = new Map<string, Building[]>();
    for (const b of w.buildings.values()) {
      const d = BUILDINGS[b.def];
      const k = d.aura?.kind || (d.producer ? 'producer' : null);
      if (!k) continue;
      let a = m.get(k); if (!a) m.set(k, a = []);
      a.push(b);
    }
    c = { v, m };
    w._cache.auraLists = c;
  }
  return c.m;
}
export function auraBuildings(w: World, kind: Kind | 'producer'): Building[] { return lists(w).get(kind) || []; }
const active = (b: Building) => !BUILDINGS[b.def].power?.use || (!!b.powered && b.on !== false);

/** growth multiplier bonus from powered fertilizer pumps at cell i (0 or 0.5) */
export function fertBonus(w: World, i: number): number {
  const pumps = auraBuildings(w, 'fert');
  if (!pumps.length) return 0;
  const x = i % w.map.w, y = (i / w.map.w) | 0;
  for (const b of pumps) {
    if (!active(b)) continue;
    const r = BUILDINGS[b.def].aura!.radius;
    if ((b.x - x) ** 2 + (b.y - y) ** 2 <= r * r) return 0.5;
  }
  return 0;
}

/** work speed bonus for a workbench from nearby tool cabinets (+6% each, two at most) */
export function workshopBonus(w: World, bench: Building): number {
  let n = 0;
  for (const b of auraBuildings(w, 'workshop')) {
    if (b.faction !== bench.faction) continue;
    const r = BUILDINGS[b.def].aura!.radius;
    if (Math.abs(b.x - bench.x) <= r && Math.abs(b.y - bench.y) <= r) n++;
  }
  return Math.min(2, n) * 0.06;
}

/** is a powered building of this aura kind touching the footprint of bed b? */
export function besideBed(w: World, bed: Building, kind: 'sleep' | 'tend'): boolean {
  const list = auraBuildings(w, kind);
  if (!list.length) return false;
  const d = BUILDINGS[bed.def];
  const [sw, sh] = bed.rot % 2 ? [d.size[1], d.size[0]] : d.size;
  for (const b of list) {
    if (!active(b)) continue;
    if (b.x >= bed.x - 1 && b.x <= bed.x + sw && b.y >= bed.y - 1 && b.y <= bed.y + sh) return true;
  }
  return false;
}
/** the bed a pawn is lying in, if any */
export function bedUnder(w: World, x: number, y: number): Building | null {
  const b = w.buildingAt(x, y);
  return b && BUILDINGS[b.def].bed ? b : null;
}

export function weatherControlled(w: World): boolean {
  return auraBuildings(w, 'weather').some(active);
}

/** firefoam: called for every fire each fire tick; returns true if the fire was smothered */
export function firefoamCheck(w: World, fx: number, fy: number): boolean {
  const poppers = auraBuildings(w, 'firefoam');
  if (!poppers.length) return false;
  for (const b of poppers) {
    if ((b.cd || 0) > w.tick) continue; // recharging
    if (Math.abs(b.x - fx) > 3 || Math.abs(b.y - fy) > 3) continue;
    const r = BUILDINGS[b.def].aura!.radius;
    b.cd = w.tick + TICKS_PER_DAY;
    w.emit({ k: 'foam', x: b.x, y: b.y, x2: r });
    w.sound('explosion', b.x, b.y);
    for (const f of [...w.fires.values()]) if ((f.x - b.x) ** 2 + (f.y - b.y) ** 2 <= r * r) w.despawn(f);
    for (const p of w.pawns.values()) if (p.onFire && (p.x - b.x) ** 2 + (p.y - b.y) ** 2 <= r * r) p.onFire = 0;
    w.map.lightDirty = true;
    w.text(b.x, b.y - 1, 'firefoam!', '#e8f0ff');
    return true;
  }
  return false;
}

const MOIST: Record<number, number> = {};
const TERRA: Record<number, number> = {};
function initTables() {
  if (MOIST[T('marsh')]) return;
  MOIST[T('marsh')] = T('soil'); MOIST[T('mud')] = T('soil'); MOIST[T('shallow_water')] = T('mud');
  for (const t of TERRAIN) {
    if (t.floor || t.smooth || t.water === 'deep' || t.id === 'rich_soil' || t.id === 'none' || t.id === 'ice') continue;
    TERRA[T(t.id)] = t.water ? T('soil') : T('rich_soil');
  }
}

/** convert up to n qualifying cells within radius of b; returns count converted */
function convertCells(w: World, b: Building, radius: number, table: Record<number, number>, n: number): number {
  const m = w.map;
  let done = 0, water = false;
  for (let k = 0; k < 12 && done < n; k++) {
    const x = b.x + w.rng.int(-radius, radius), y = b.y + w.rng.int(-radius, radius);
    if (!m.inb(x, y) || (x - b.x) ** 2 + (y - b.y) ** 2 > radius * radius) continue;
    const i = m.idx(x, y);
    if (m.rock[i] || m.floor[i]) continue;
    const to = table[m.terrain[i]];
    if (to === undefined || to === m.terrain[i]) continue;
    if (TERRAIN[m.terrain[i]].water) water = true;
    m.setTerrain(i, to);
    done++;
  }
  if (water) m.touchRegion();
  return done;
}

/** every 250 ticks */
export function auraTick(w: World) {
  initTables();
  const dtDays = 250 / TICKS_PER_DAY;
  for (const b of auraBuildings(w, 'producer')) {
    const pd = BUILDINGS[b.def].producer!;
    if (pd.power && !active(b)) continue;
    if (pd.outdoors && w.map.roof[w.map.idx(b.x, b.y)]) continue;
    if (pd.minTemp !== undefined && ambientTemp(w, b.x, b.y) < pd.minTemp) continue;
    b.prog = (b.prog || 0) + dtDays / pd.days;
    if (b.prog < 1) continue;
    b.prog = 0;
    const [def, n] = w.rng.weighted(pd.items, e => e[2]);
    const [ix, iy] = w.interactCell(b);
    const it = spawnItem(w, def, n, ix, iy, { owner: b.faction });
    const tally = (w._cache.produced ||= {}) as Record<string, number>;
    tally[b.def + ':' + def] = (tally[b.def + ':' + def] || 0) + n;
    if (it) { w.text(b.x, b.y - 1, `+${n} ${ITEMS[def].label}`, '#b8f0a0'); w.emit({ k: 'dust', x: b.x, y: b.y }); }
  }
  for (const b of auraBuildings(w, 'moisture')) if (active(b) && w.rng.chance(0.5)) convertCells(w, b, BUILDINGS[b.def].aura!.radius, MOIST, 1);
  for (const b of auraBuildings(w, 'terraform')) if (active(b)) convertCells(w, b, BUILDINGS[b.def].aura!.radius, TERRA, 2);
  // orbital scanners: guide down a cargo drop roughly every 4 days per colony
  const seen = new Set<number>();
  for (const b of auraBuildings(w, 'scan')) {
    if (!active(b) || seen.has(b.faction)) continue;
    seen.add(b.faction);
    b.prog = (b.prog || 0) + dtDays / 4;
    if (b.prog < 1) continue;
    b.prog = 0;
    orbitalDrop(w, b);
  }
}

function orbitalDrop(w: World, b: Building) {
  const opts: [string, number, number][] = [['steel', w.rng.int(120, 260), 3], ['plasteel', w.rng.int(30, 80), 2], ['components', w.rng.int(6, 14), 2], ['uranium', w.rng.int(20, 50), 1], ['gold', w.rng.int(30, 70), 1], ['silver', w.rng.int(300, 700), 2], ['adv_components', w.rng.int(1, 3), 0.6], ['medicine', w.rng.int(8, 16), 1], ['meal_survival', w.rng.int(15, 30), 1]];
  const [def, n] = w.rng.weighted(opts, o => o[2]);
  const m = w.map;
  let x = b.x, y = b.y;
  for (let k = 0; k < 20; k++) {
    const tx = b.x + w.rng.int(-8, 8), ty = b.y + w.rng.int(-8, 8);
    if (m.inb(tx, ty) && m.passable(m.idx(tx, ty)) && !m.roof[m.idx(tx, ty)]) { x = tx; y = ty; break; }
  }
  spawnItem(w, def, n, x, y, { owner: b.faction });
  w.emit({ k: 'droppod', x, y });
  w.letter(b.faction, 'Orbital scan: cargo', `Your orbital scanner spotted drifting cargo and guided it down: ${n} ${ITEMS[def].label}.`, 'good', x, y);
}
