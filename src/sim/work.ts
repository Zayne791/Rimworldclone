// Work givers: find the best available job of each work type for a pawn.
import type { World } from './world';
import type { Pawn, Job, Item, Building, Bill } from './types';
import type { WorkType } from '../data/types';
import { WORK_TYPES } from '../data/pawns';
import { ITEMS } from '../data/items';
import { BUILDINGS } from '../data/buildings';
import { RECIPES } from '../data/recipes';
import { PLANTS, PLANT_INDEX } from '../data/plants';
import { ANIMALS } from '../data/animals';
import { mkJob } from './jobs';
import { blueprintNeeds, buildingMaxHp, stackLimit } from './things';
import { findStorageFor, itemAccessible, storagePriorityAt, filterAllows, countResource, storageOwnerAt } from './zones';
import { needsTending } from './health';
import { skillLevel, weaponOf, isIncapable, isAnimal } from './stats';
import { isResearched } from './research';
import { roofSupported } from './rooms';
import { refuelNeeded } from './environment';
import { DESIG, IMPASSABLE } from './map';
import { dist2 } from '../core/util';
import { needsBedRest } from './jobs';

type Giver = (w: World, p: Pawn) => Job | null;

function reach(w: World, p: Pawn, i: number) { return w.map.connected(w.map.idx(p.x, p.y), i); }
function reachXY(w: World, p: Pawn, x: number, y: number) { return w.map.inb(x, y) && reach(w, p, w.map.idx(x, y)); }

/** sort candidates by distance and return first that passes predicate */
function nearest<T>(p: Pawn, list: T[], pos: (t: T) => [number, number], ok: (t: T) => boolean, max = 1e9): T | null {
  const arr = list.map(t => { const [x, y] = pos(t); return { t, d: dist2(p.x, p.y, x, y) }; }).filter(e => e.d <= max * max);
  arr.sort((a, b) => a.d - b.d);
  for (const e of arr) if (ok(e.t)) return e.t;
  return null;
}

// ---------------- firefight ----------------
const firefight: Giver = (w, p) => {
  const slot = w.slotOf(p.faction);
  const fires = [...w.fires.values()].filter(f => w.map.inHome(w.map.idx(f.x, f.y), slot));
  const f = nearest(p, fires, f => [f.x, f.y], f => w.canReserve('t' + f.id, p.id) && reachXY(w, p, f.x, f.y));
  if (!f) return null;
  w.reserve('t' + f.id, p.id);
  return mkJob('firefight', { t: f.id });
};

// ---------------- doctor ----------------
export function findBedFor(w: World, patient: Pawn, faction: number, prisoner = false): Building | null {
  let best: Building | null = null, bestScore = -1e9;
  for (const b of w.buildings.values()) {
    const d = BUILDINGS[b.def];
    if (!d.bed || b.faction !== faction) continue;
    if (!!b.prison !== prisoner) continue;
    const owners = b.owners || [];
    const occupied = [...w.pawns.values()].filter(o => o.id !== patient.id && (o.job?.type === 'rest' || o.job?.type === 'sleep') && o.job.t === b.id).length;
    if (occupied >= d.bed.sleepers) continue;
    let score = -dist2(patient.x, patient.y, b.x, b.y) * 0.01;
    if (d.bed.medical || b.medical) score += 100;
    if (owners.includes(patient.id)) score += 60;
    else if (owners.length >= d.bed.sleepers && !(d.bed.medical || b.medical)) continue;
    if (!w.canReserve('t' + b.id, patient.id) && !owners.includes(patient.id)) continue;
    if (score > bestScore) { bestScore = score; best = b; }
  }
  return best;
}

export function findMedicine(w: World, p: Pawn): Item | null {
  const meds = [...w.items.values()].filter(it => ITEMS[it.def].med && !it.forbidden && itemAccessible(w, p, it));
  meds.sort((a, b) => (ITEMS[b.def].med!.potency - ITEMS[a.def].med!.potency) * 0 + dist2(p.x, p.y, a.x, a.y) - dist2(p.x, p.y, b.x, b.y));
  for (const m of meds) if (w.canReserve('t' + m.id, p.id) && reachXY(w, p, m.x, m.y)) return m;
  return null;
}

const doctor: Giver = (w, p) => {
  // rescue downed colonists
  const downed = [...w.pawns.values()].filter(o => o.downed && !o.dead && o.id !== p.id && !o.carriedBy && (o.faction === p.faction || (o.guest?.host === p.faction)) && o.job?.type !== 'rest' && o.race === 'human');
  for (const o of downed) {
    if (!w.canReserve('t' + o.id, p.id) || !reachXY(w, p, o.x, o.y)) continue;
    const bed = findBedFor(w, o, p.faction, !!o.guest?.prisoner);
    if (!bed) continue;
    w.reserve('t' + o.id, p.id); w.reserve('t' + bed.id, o.id);
    return mkJob('rescue', { t: o.id, t2: bed.id });
  }
  // tend patients
  const patients = [...w.pawns.values()].filter(o => !o.dead && (o.faction === p.faction || o.guest?.host === p.faction) && needsTending(o) && (o.downed || o.job?.type === 'rest' || o.id === p.id || (o.race !== 'human' && o.animal?.tamed)));
  const pt = nearest(p, patients.filter(o => o.id !== p.id), o => [o.x, o.y], o => w.canReserve('p' + o.id, p.id) && reachXY(w, p, o.x, o.y))
    || (patients.some(o => o.id === p.id) && !p.downed && w.colonists(p.faction).filter(c => c.id !== p.id && c.work.doctor > 0 && !c.downed).length === 0 ? p : null);
  if (pt) {
    const med = findMedicine(w, p);
    w.reserve('p' + pt.id, p.id);
    if (med) w.reserve('t' + med.id, p.id);
    return mkJob('tend', { t: pt.id, t2: med?.id });
  }
  // feed patients
  const hungry = [...w.pawns.values()].filter(o => !o.dead && o.race === 'human' && o.faction === p.faction && (o.downed || o.job?.type === 'rest') && o.needs.food < 0.3 && o.id !== p.id);
  for (const o of hungry) {
    if (!w.canReserve('f' + o.id, p.id)) continue;
    const food = findFood(w, p, o);
    if (!food) continue;
    w.reserve('f' + o.id, p.id); w.reserve('t' + food.id, p.id);
    return mkJob('feed', { t: o.id, t2: food.id });
  }
  return null;
};

// ---------------- warden ----------------
const warden: Giver = (w, p) => {
  const prisoners = [...w.pawns.values()].filter(o => o.guest?.prisoner && o.guest.host === p.faction && !o.dead);
  for (const pr of prisoners) {
    if (pr.needs.food < 0.3 && w.canReserve('f' + pr.id, p.id) && reachXY(w, p, pr.x, pr.y)) {
      const food = findFood(w, p, pr);
      if (food) { w.reserve('f' + pr.id, p.id); w.reserve('t' + food.id, p.id); return mkJob('feed', { t: pr.id, t2: food.id }); }
    }
  }
  const pr = nearest(p, prisoners, o => [o.x, o.y], o => o.guest!.mode === 'recruit' && !o.downed && w.tick - (o.guest!.lastChat || -1e9) > 12000 && w.canReserve('p' + o.id, p.id) && reachXY(w, p, o.x, o.y));
  if (!pr) return null;
  w.reserve('p' + pr.id, p.id);
  return mkJob('warden', { t: pr.id });
};

// ---------------- handle ----------------
const handle: Giver = (w, p) => {
  const animals = [...w.pawns.values()].filter(a => !a.dead && isAnimal(a) && !a.downed);
  for (const a of animals) {
    if (a.desig === 'tame' && a.faction === 0 && w.canReserve('t' + a.id, p.id) && reachXY(w, p, a.x, a.y)) {
      const ad = ANIMALS[a.race];
      const minSkill = Math.round(ad.wildness * 10);
      if (skillLevel(p, 'animals') < minSkill) continue;
      const food = [...w.items.values()].find(it => { const f = ITEMS[it.def].food; return f && (f.kind === 'veg' || f.kind === 'meat' || f.kind === 'hay') && !it.forbidden && itemAccessible(w, p, it) && w.canReserve('t' + it.id, p.id); });
      w.reserve('t' + a.id, p.id);
      if (food) w.reserve('t' + food.id, p.id);
      return mkJob('tame', { t: a.id, t2: food?.id });
    }
    if (a.desig === 'slaughter' && a.faction === p.faction && w.canReserve('t' + a.id, p.id) && reachXY(w, p, a.x, a.y)) {
      w.reserve('t' + a.id, p.id);
      return mkJob('slaughter', { t: a.id });
    }
    if (a.faction === p.faction && a.animal?.tamed) {
      const ad = ANIMALS[a.race];
      for (const pr of ad.products || []) {
        if (pr.kind === 'eggs') continue;
        if ((a.animal.products[pr.kind] || 0) >= 1 && a.gender === (pr.kind === 'milk' ? 'f' : a.gender) && w.canReserve('t' + a.id, p.id) && reachXY(w, p, a.x, a.y)) {
          w.reserve('t' + a.id, p.id);
          return mkJob('gather', { t: a.id, data: { kind: pr.kind } });
        }
      }
    }
  }
  return null;
};

// ---------------- hunt ----------------
const hunt: Giver = (w, p) => {
  const wp = weaponOf(p);
  if (!wp || wp.melee) return null;
  const targets = [...w.pawns.values()].filter(a => a.desig === 'hunt' && !a.dead && isAnimal(a) && a.faction === 0);
  const a = nearest(p, targets, a => [a.x, a.y], a => w.canReserve('t' + a.id, p.id) && reachXY(w, p, a.x, a.y));
  if (!a) return null;
  w.reserve('t' + a.id, p.id);
  return mkJob('attack', { t: a.id, forced: true, data: { kill: true, hunt: true } });
};

// ---------------- construct ----------------
function findMaterial(w: World, p: Pawn, def: string, near: [number, number]): Item | null {
  const cands: Item[] = [];
  for (const it of w.items.values()) if (it.def === def && !it.forbidden && itemAccessible(w, p, it)) cands.push(it);
  cands.sort((a, b) => dist2(a.x, a.y, p.x, p.y) + dist2(a.x, a.y, near[0], near[1]) - dist2(b.x, b.y, p.x, p.y) - dist2(b.x, b.y, near[0], near[1]));
  for (const it of cands) if (w.canReserve('t' + it.id, p.id) && reachXY(w, p, it.x, it.y)) return it;
  return null;
}

const construct: Giver = (w, p) => {
  const bps = [...w.blueprints.values()].filter(b => b.faction === p.faction && !b.forbidden);
  bps.sort((a, b) => dist2(p.x, p.y, a.x, a.y) - dist2(p.x, p.y, b.x, b.y));
  let checked = 0;
  for (const bp of bps) {
    if (++checked > 40) break;
    const art = !bp.floor && BUILDINGS[bp.def]?.art;
    if (art) continue; // artists handle art
    if (!reachXY(w, p, bp.x, bp.y)) continue;
    const needs = blueprintNeeds(bp);
    const keys = Object.keys(needs);
    if (!keys.length) {
      if (!w.canReserve('t' + bp.id, p.id)) continue;
      if (!bp.floor && BUILDINGS[bp.def].skill && skillLevel(p, 'construction') < BUILDINGS[bp.def].skill!) continue;
      if (blockedByOther(w, bp)) continue;
      w.reserve('t' + bp.id, p.id);
      return mkJob('construct', { t: bp.id });
    }
    // deliver
    for (const k of keys) {
      const key = 'd' + bp.id + k;
      if (!w.canReserve(key, p.id)) continue;
      const it = findMaterial(w, p, k, [bp.x, bp.y]);
      if (!it) continue;
      w.reserve('t' + it.id, p.id); w.reserve(key, p.id);
      return mkJob('haul', { t: it.id, t2: bp.id, count: Math.min(needs[k], it.count, stackLimit(it)) });
    }
  }
  // deconstruct
  const dec = [...w.buildings.values()].filter(b => b.desig === 'deconstruct' && (b.faction === p.faction || BUILDINGS[b.def].natural || b.faction === 0 || w.hostile(b.faction, p.faction)));
  const b = nearest(p, dec, b => [b.x, b.y], b => w.canReserve('t' + b.id, p.id) && reachXY(w, p, b.x, b.y));
  if (b) { w.reserve('t' + b.id, p.id); return mkJob('deconstruct', { t: b.id }); }
  // roofs
  const m = w.map;
  const roofCells: number[] = [];
  const pi = m.idx(p.x, p.y);
  for (let i = 0; i < m.n; i++) if (m.roofDesig[i] && m.roofDesigF[i] === p.faction) roofCells.push(i);
  if (roofCells.length) {
    roofCells.sort((a, b2) => dist2(p.x, p.y, a % m.w, (a / m.w) | 0) - dist2(p.x, p.y, b2 % m.w, (b2 / m.w) | 0));
    for (const i of roofCells.slice(0, 30)) {
      const x = i % m.w, y = (i / m.w) | 0;
      if (!w.canReserve('c' + i, p.id)) continue;
      if (m.roofDesig[i] === 1 && (m.roof[i] || !roofSupported(w, x, y))) { if (m.roof[i]) m.setRoofDesig(i, 0, 0); continue; }
      if (m.roofDesig[i] === 2 && !m.roof[i]) { m.setRoofDesig(i, 0, 0); continue; }
      if (!m.connected(pi, i)) continue;
      w.reserve('c' + i, p.id);
      return mkJob('roof', { c: i, data: { remove: m.roofDesig[i] === 2 } });
    }
  }
  // repair
  const slot = w.slotOf(p.faction);
  const dmg = [...w.buildings.values()].filter(b => b.faction === p.faction && b.hp < buildingMaxHp(b.def, b.stuff) * 0.75 && m.inHome(m.idx(b.x, b.y), slot) && !BUILDINGS[b.def].natural);
  const r = nearest(p, dmg, b => [b.x, b.y], b => w.canReserve('t' + b.id, p.id) && reachXY(w, p, b.x, b.y));
  if (r) { w.reserve('t' + r.id, p.id); return mkJob('repair', { t: r.id }); }
  return null;
};
function blockedByOther(w: World, bp: any): boolean {
  if (bp.floor) return false;
  const d = BUILDINGS[bp.def];
  for (const i of w.footprint(bp.x, bp.y, d.size, bp.rot)) {
    const ob = w.map.bld[i];
    if (ob) { const o = w.buildings.get(ob); if (o && !(d.wallMounted && o.def === 'wall') && !(d.geyser && o.def === 'geyser')) return true; }
  }
  return false;
}

const art: Giver = (w, p) => {
  const bps = [...w.blueprints.values()].filter(b => b.faction === p.faction && !b.floor && BUILDINGS[b.def]?.art);
  for (const bp of bps) {
    if (!reachXY(w, p, bp.x, bp.y)) continue;
    const needs = blueprintNeeds(bp);
    const keys = Object.keys(needs);
    if (!keys.length) { if (!w.canReserve('t' + bp.id, p.id)) continue; w.reserve('t' + bp.id, p.id); return mkJob('construct', { t: bp.id }); }
    for (const k of keys) {
      const key = 'd' + bp.id + k;
      if (!w.canReserve(key, p.id)) continue;
      const it = findMaterial(w, p, k, [bp.x, bp.y]);
      if (!it) continue;
      w.reserve('t' + it.id, p.id); w.reserve(key, p.id);
      return mkJob('haul', { t: it.id, t2: bp.id, count: Math.min(needs[k], it.count) });
    }
  }
  return billGiver('art')(w, p);
};

// ---------------- grow ----------------
const grow: Giver = (w, p) => {
  const m = w.map;
  const zones = [...w.zones.values()].filter(z => z.kind === 'grow' && z.faction === p.faction);
  zones.sort((a, b) => dist2(p.x, p.y, a.cells[0] % m.w, (a.cells[0] / m.w) | 0) - dist2(p.x, p.y, b.cells[0] % m.w, (b.cells[0] / m.w) | 0));
  const skill = skillLevel(p, 'plants');
  const tooCold = w.outdoorTemp < 2;
  for (const z of zones) {
    const target = PLANT_INDEX[z.plant];
    const pd = PLANTS[target];
    const canSow = z.allowSow && pd && isResearched(w, p.faction, pd.research) && skill >= (pd.sowSkill || 0);
    let bestHarvest = -1, bestCut = -1, bestSow = -1;
    let bdH = 1e9, bdC = 1e9, bdS = 1e9;
    for (const i of z.cells) {
      const x = i % m.w, y = (i / m.w) | 0;
      const d = dist2(p.x, p.y, x, y);
      const pl = m.plant[i];
      if (pl) {
        const cur = PLANTS[pl];
        if (cur.harvestItem && m.growth[i] >= (cur.harvestMin ?? 1) && cur.kind === 'crop') { if (d < bdH && w.canReserve('c' + i, p.id)) { bdH = d; bestHarvest = i; } }
        else if (pl !== target && cur.kind !== 'crop' || (pl !== target && canSow)) { if (d < bdC && w.canReserve('c' + i, p.id)) { bdC = d; bestCut = i; } }
      } else if (canSow && !tooCold && !m.bld[i] || (canSow && m.bld[i] && BUILDINGS[w.buildings.get(m.bld[i])?.def || '']?.growBasin)) {
        if (m.cost[i] === IMPASSABLE) continue;
        if (m.items[i]?.length) continue;
        if (d < bdS && w.canReserve('c' + i, p.id)) { bdS = d; bestSow = i; }
      }
    }
    if (bestHarvest >= 0 && reach(w, p, bestHarvest)) { w.reserve('c' + bestHarvest, p.id); return mkJob('cut', { c: bestHarvest, data: { harvest: true } }); }
    if (bestCut >= 0 && reach(w, p, bestCut)) { w.reserve('c' + bestCut, p.id); return mkJob('cut', { c: bestCut }); }
    if (bestSow >= 0 && w.map.connected(w.map.idx(p.x, p.y), bestSow, false)) { w.reserve('c' + bestSow, p.id); return mkJob('sow', { c: bestSow, data: { plant: z.plant } }); }
  }
  return null;
};

// ---------------- designation-based ----------------
function desigGiver(types: number[], jobType: string): Giver {
  return (w, p) => {
    const m = w.map;
    let best = -1, bestD = 1e18;
    const cache = (w._cache['desig' + p.faction] ||= { t: -1, cells: [] as number[] });
    if (cache.t !== w.tick) {
      cache.cells = [];
      for (let i = 0; i < m.n; i++) if (m.desig[i] && m.desigF[i] === p.faction) cache.cells.push(i);
      cache.t = w.tick;
    }
    const cand: { i: number; d: number }[] = [];
    for (const i of cache.cells) {
      if (!types.includes(m.desig[i])) continue;
      if (jobType === 'mine' ? !m.rock[i] : !m.plant[i]) { m.setDesig(i, 0, 0); continue; }
      const x = i % m.w, y = (i / m.w) | 0;
      cand.push({ i, d: dist2(p.x, p.y, x, y) });
    }
    cand.sort((a, b) => a.d - b.d);
    for (const c of cand.slice(0, 40)) {
      if (!w.canReserve('c' + c.i, p.id)) continue;
      if (!reach(w, p, c.i)) continue;
      best = c.i; bestD = c.d; break;
    }
    if (best < 0) return null;
    w.reserve('c' + best, p.id);
    if (jobType === 'mine') return mkJob('mine', { c: best });
    return mkJob('cut', { c: best, data: { harvest: m.desig[best] === DESIG.harvest } });
  };
}
const mine = desigGiver([DESIG.mine], 'mine');
const plantcut = desigGiver([DESIG.cut, DESIG.chop, DESIG.harvest], 'cut');

// ---------------- bills ----------------
function billNeeded(w: World, b: Building, bill: Bill): boolean {
  if (bill.suspended) return false;
  if (bill.mode === 'count') return bill.done < bill.target;
  if (bill.mode === 'until') {
    const rec = RECIPES[bill.recipe];
    const prod = rec.products?.[0]?.item || rec.product;
    if (!prod) return true;
    return countResource(w, b.faction, prod) < bill.target;
  }
  return true;
}

function ingredientMatches(it: Item, ing: RecipeIng, stuffCats?: string[]): boolean {
  const d = ITEMS[it.def];
  if ((it.rot || 0) >= 1) return false;
  if (ing.items && ing.items.includes(it.def)) return true;
  if (ing.cats && d.stuff && d.stuff.cats.some(c => ing.cats!.includes(c))) return true;
  return false;
}
type RecipeIng = import('../data/types').RecipeDef['ings'][number];

function planIngredients(w: World, p: Pawn, b: Building, bill: Bill): { id: number; count: number }[] | null {
  const rec = RECIPES[bill.recipe];
  const [bx, by] = [b.x, b.y];
  const r2 = bill.radius * bill.radius;
  const pool: Item[] = [];
  for (const it of w.items.values()) {
    if (it.forbidden) continue;
    if (dist2(it.x, it.y, bx, by) > r2) continue;
    if (!rec.ings.some(g => ingredientMatches(it, g))) continue;
    if (!itemAccessible(w, p, it)) continue;
    if (!w.canReserve('t' + it.id, p.id)) continue;
    pool.push(it);
  }
  pool.sort((a, c) => dist2(a.x, a.y, bx, by) - dist2(c.x, c.y, bx, by));
  const plan: { id: number; count: number }[] = [];
  const used = new Map<number, number>();
  for (const ing of rec.ings) {
    let need = ing.count;
    let stuffDef: string | null = null;
    if (rec.special === 'stuffed') {
      // pick one stuff with enough total
      const totals = new Map<string, number>();
      for (const it of pool) if (ingredientMatches(it, ing)) totals.set(it.def, (totals.get(it.def) || 0) + it.count);
      const choices = [...totals.entries()].filter(([k, v]) => v >= need && (!bill.stuff || bill.stuff === k));
      if (!choices.length) return null;
      choices.sort((a, c) => (ITEMS[a[0]].value - ITEMS[c[0]].value));
      stuffDef = bill.stuff || choices[0][0];
    }
    for (const it of pool) {
      if (need <= 0) break;
      if (!ingredientMatches(it, ing)) continue;
      if (stuffDef && it.def !== stuffDef) continue;
      if (it.corpse && (it.rot || 0) > 1.2) continue;
      const avail = it.count - (used.get(it.id) || 0);
      if (avail <= 0) continue;
      const n = Math.min(avail, need, stackLimit(it));
      plan.push({ id: it.id, count: n });
      used.set(it.id, (used.get(it.id) || 0) + n);
      need -= n;
    }
    if (need > 0) return null;
  }
  return plan;
}

function billGiver(wt: WorkType): Giver {
  return (w, p) => {
    const benches = [...w.buildings.values()].filter(b => b.faction === p.faction && b.bills && b.bills.length && BUILDINGS[b.def].bench);
    benches.sort((a, b) => dist2(p.x, p.y, a.x, a.y) - dist2(p.x, p.y, b.x, b.y));
    for (const b of benches) {
      const d = BUILDINGS[b.def];
      if (d.bench!.power && !b.powered) continue;
      if (d.bench!.fuel && !(b.fuel && b.fuel > 0)) continue;
      if (b.forbidden) continue;
      if (!w.canReserve('t' + b.id, p.id)) continue;
      const [ix, iy] = w.interactCell(b);
      if (!reachXY(w, p, ix, iy)) continue;
      for (const bill of b.bills!) {
        const rec = RECIPES[bill.recipe];
        if (!rec || rec.workType !== wt) continue;
        if (!billNeeded(w, b, bill)) continue;
        if (rec.research && !isResearched(w, p.faction, rec.research)) continue;
        if ((rec.minSkill || 0) > skillLevel(p, rec.skill)) continue;
        const plan = planIngredients(w, p, b, bill);
        if (!plan) continue;
        w.reserve('t' + b.id, p.id);
        for (const pl of plan) w.reserve('t' + pl.id, p.id);
        return mkJob('dobill', { t: b.id, bill: bill.id, data: { plan, k: 0, held: [] } });
      }
    }
    return null;
  };
}

// ---------------- haul ----------------
const haul: Giver = (w, p) => {
  // refuel
  for (const b of w.buildings.values()) {
    if (b.faction !== p.faction) continue;
    const d = BUILDINGS[b.def];
    if (!d.fuel || (b.fuel || 0) > d.fuel.cap * 0.5) continue;
    if (!w.canReserve('r' + b.id, p.id)) continue;
    if (!reachXY(w, p, b.x, b.y)) continue;
    const it = findMaterial(w, p, d.fuel.item, [b.x, b.y]);
    if (!it) continue;
    w.reserve('r' + b.id, p.id); w.reserve('t' + it.id, p.id);
    return mkJob('haul', { t: it.id, t2: b.id, count: Math.min(Math.ceil(refuelNeeded(b)), it.count) });
  }
  // corpses to graves
  const graves = [...w.buildings.values()].filter(b => b.faction === p.faction && BUILDINGS[b.def].grave && !b.graveCorpse);
  if (graves.length) {
    const corpses = [...w.items.values()].filter(it => it.corpse && it.corpse.race === 'human' && !it.forbidden && itemAccessible(w, p, it));
    for (const c of corpses) {
      const g = graves.find(g => w.canReserve('t' + g.id, p.id));
      if (!g || !w.canReserve('t' + c.id, p.id) || !reachXY(w, p, c.x, c.y)) continue;
      w.reserve('t' + c.id, p.id); w.reserve('t' + g.id, p.id);
      return mkJob('haul', { t: c.id, t2: g.id, count: 1 });
    }
  }
  // haul to storage
  const cands: { it: Item; d: number }[] = [];
  for (const it of w.items.values()) {
    if (it.forbidden) continue;
    const pr = storagePriorityAt(w, it);
    if (pr >= 5) continue;
    cands.push({ it, d: dist2(p.x, p.y, it.x, it.y) + (pr > 0 ? 1e6 : 0) });
  }
  cands.sort((a, b) => a.d - b.d);
  let tries = 0;
  for (const { it } of cands) {
    if (tries > 25) break;
    if (!w.canReserve('t' + it.id, p.id)) continue;
    if (!itemAccessible(w, p, it)) continue;
    tries++;
    const dest = findStorageFor(w, p, it);
    if (!dest) continue;
    if (!reachXY(w, p, it.x, it.y)) continue;
    w.reserve('t' + it.id, p.id); w.reserve('c' + dest.cell, p.id);
    return mkJob('haul', { t: it.id, c: dest.cell, count: it.count });
  }
  return null;
};

// ---------------- clean ----------------
const clean: Giver = (w, p) => {
  const m = w.map;
  const slot = w.slotOf(p.faction);
  let best = -1, bestD = 1e18;
  const cache = (w._cache['filth' + p.faction] ||= { t: -1e9, cells: [] as number[] });
  if (w.tick - cache.t > 300) {
    cache.cells = [];
    for (let i = 0; i < m.n; i++) if (m.filth[i] && m.inHome(i, slot) && (m.roof[i] || m.floor[i])) cache.cells.push(i);
    cache.t = w.tick;
  }
  for (const i of cache.cells) {
    if (!m.filth[i]) continue;
    const d = dist2(p.x, p.y, i % m.w, (i / m.w) | 0);
    if (d < bestD && w.canReserve('c' + i, p.id) && reach(w, p, i)) { bestD = d; best = i; }
  }
  if (best < 0) return null;
  w.reserve('c' + best, p.id);
  return mkJob('clean', { c: best });
};

// ---------------- research ----------------
const research: Giver = (w, p) => {
  const rs = w.research[p.faction];
  if (!rs?.cur) return null;
  const benches = [...w.buildings.values()].filter(b => b.faction === p.faction && BUILDINGS[b.def].bench?.research);
  const hiTechNeeded = (RESEARCH_HITECH as any)[rs.cur];
  const b = nearest(p, benches, b => [b.x, b.y], b => {
    const d = BUILDINGS[b.def];
    if (d.bench!.power && !b.powered) return false;
    if (hiTechNeeded && b.def !== 'research_bench_hitech') return false;
    if (!w.canReserve('t' + b.id, p.id)) return false;
    const [ix, iy] = w.interactCell(b);
    return reachXY(w, p, ix, iy);
  });
  if (!b) return null;
  w.reserve('t' + b.id, p.id);
  return mkJob('research', { t: b.id });
};
import { RESEARCH } from '../data/recipes';
const RESEARCH_HITECH: Record<string, boolean> = Object.fromEntries(Object.values(RESEARCH).filter(r => r.hiTech).map(r => [r.id, true]));

// ---------------- food ----------------
export function foodScore(w: World, eater: Pawn, it: Item): number {
  const fd = ITEMS[it.def].food;
  if (!fd) return -1;
  if ((it.rot || 0) >= 1) return -1;
  if (eater.race === 'human') {
    if (it.corpse) return -1;
    if (fd.kind === 'hay') return -1;
    if (ITEMS[it.def].cat === 'drug') return -1;
    let s = fd.pref * 10 + (fd.kind === 'meal' ? 20 : 0);
    if (fd.kind === 'meat') s -= 8;
    if (fd.kind === 'veg') s -= 2;
    if (it.def === 'meal_survival') s -= 3; // save survival meals
    return s + 30;
  }
  const ad = ANIMALS[eater.race];
  if (!ad) return -1;
  if (ad.diet === 'grazer' && !(fd.kind === 'veg' || fd.kind === 'hay')) return -1;
  if (ad.diet === 'carnivore' && !(fd.kind === 'meat' || it.corpse)) return -1;
  if (it.corpse && (it.corpse.race === eater.race)) return -1;
  if (fd.kind === 'meal') return 5;
  return fd.kind === 'hay' ? 20 : 10;
}

export function findFood(w: World, seeker: Pawn, eater: Pawn = seeker): Item | null {
  let best: Item | null = null, bestS = -1e9;
  for (const it of w.items.values()) {
    if (it.forbidden && !(it.corpse && isAnimal(eater))) continue;
    const s0 = foodScore(w, eater, it);
    if (s0 < 0) continue;
    if (!itemAccessible(w, seeker, it) && !(isAnimal(eater) && eater.faction === 0)) continue;
    // wild animals don't raid storage in colonies
    if (eater.faction === 0 && isAnimal(eater) && storageOwnerAt(w, w.map.idx(it.x, it.y)) >= 10) continue;
    const d = Math.sqrt(dist2(seeker.x, seeker.y, it.x, it.y));
    const s = s0 - d * 0.35;
    if (s <= bestS) continue;
    if (!w.canReserve('t' + it.id, seeker.id)) continue;
    if (!reachXY(w, seeker, it.x, it.y)) continue;
    best = it; bestS = s;
  }
  return best;
}

export const GIVERS: Partial<Record<WorkType, Giver>> = {
  firefight, doctor, warden, handle, cook: billGiver('cook'), hunt, construct, grow, mine, plantcut,
  smith: billGiver('smith'), tailor: billGiver('tailor'), art, craft: billGiver('craft'), haul, clean, research,
};

/** Try work types in priority order. */
export function findWork(w: World, p: Pawn): Job | null {
  for (let prio = 1; prio <= 4; prio++) {
    for (const wt of WORK_TYPES) {
      if (p.work[wt.id] !== prio) continue;
      if (isIncapable(p, wt.id)) continue;
      const g = GIVERS[wt.id];
      if (!g) continue;
      const j = g(w, p);
      if (j) { j.label = wt.label; return j; }
    }
  }
  return null;
}

export { needsBedRest, filterAllows };
