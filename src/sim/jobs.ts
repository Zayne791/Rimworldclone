// Job drivers: the step-by-step execution of every pawn action.
import type { World } from './world';
import type { Pawn, Job, Item, Building } from './types';
import { moveTo, stopMoving, atGoal } from './move';
import { ITEMS } from '../data/items';
import { BUILDINGS } from '../data/buildings';
import { RECIPES, RESEARCH } from '../data/recipes';
import { PLANTS, PLANT_INDEX } from '../data/plants';
import { ROCKS } from '../data/terrain';
import { ANIMALS } from '../data/animals';
import { makeItem, placeItem, blueprintCost, blueprintWork, blueprintNeeds, stackLimit, canStack, buildingMaxHp, pawnShortName, itemLabel } from './things';
import { completeBlueprint, destroyBuilding, mineCell, cutPlant, rollQuality } from './construction';
import { skillSpeed, workSpeedFor, skillLevel, weaponOf, weaponDef, isAnimal, capacity } from './stats';
import { gainXp, fireAt, meleeAttack, pawnHostileTo, hitChance } from './combat';
import { tend, die, setDowned, needsTending, applyDamage } from './health';
import { addThought, changeOpinion } from './mood';
import { roomAt, impressLabel } from './rooms';
import { lineOfSight } from './path';
import { dist } from '../core/util';
import { TICKS_PER_DAY } from '../core/constants';
import { petName } from './pawngen';
import { FILTH, IMPASSABLE, ROOF } from './map';
import { onResearchComplete } from './research';

export type Status = 'ongoing' | 'done' | 'fail';
interface Driver { tick(w: World, p: Pawn, j: Job): Status; label(w: World, p: Pawn, j: Job): string }

export const DRIVERS: Record<string, Driver> = {};
const def = (id: string, d: Driver) => (DRIVERS[id] = d);

// ---------------- helpers ----------------
export function mkJob(type: string, fields: Partial<Job> = {}): Job { return { type, s: 0, w: 0, ...fields }; }

export function pickUp(w: World, p: Pawn, it: Item, count: number): boolean {
  if (!w.items.has(it.id)) return false;
  if (p.carry) {
    if (canStack(p.carry, it) && p.carry.count < stackLimit(it)) {
      const n = Math.min(count, it.count, stackLimit(it) - p.carry.count);
      p.carry.count += n; it.count -= n;
      if (it.count <= 0) w.despawn(it);
      return true;
    }
    dropCarry(w, p);
  }
  const n = Math.min(count, it.count);
  if (n <= 0) return false;
  if (n >= it.count) { w.despawn(it); p.carry = it; }
  else { it.count -= n; p.carry = { ...it, id: w.newId(), count: n }; }
  p.carry.forbidden = false;
  w.sound('pickup', p.x, p.y);
  return true;
}
export function dropCarry(w: World, p: Pawn, x = p.x, y = p.y) {
  if (!p.carry) return;
  const c = p.carry; p.carry = null;
  c.owner = p.faction;
  placeItem(w, c, x, y);
}
function thing<T>(w: World, id: number | undefined): T | undefined { return id ? (w.things.get(id) as any) : undefined; }
function cellXY(w: World, c: number): [number, number] { return [c % w.map.w, (c / w.map.w) | 0]; }
function bldRect(w: World, b: { def: string; x: number; y: number; rot: number }): [number, number] { return w.rotSize(BUILDINGS[b.def].size, b.rot); }
function workTick(w: World, p: Pawn) { if (p.race === 'human' && w.tick % 20 === p.id % 20) w.emit({ k: 'work', x: p.x, y: p.y, id: p.id }); }

// ---------------- basic ----------------
def('goto', {
  label: () => 'moving',
  tick(w, p, j) {
    const [x, y] = cellXY(w, j.c!);
    const r = moveTo(w, p, x, y);
    return r === 'arrived' ? 'done' : r === 'fail' ? 'fail' : 'ongoing';
  },
});
def('wait', {
  label: (w, p) => (p.drafted ? 'standing by' : 'idle'),
  tick(w, p, j) { j.w++; return j.w >= (j.count || 60) ? 'done' : 'ongoing'; },
});
def('wander', {
  label: (w, p) => (p.mental ? 'wandering in a daze' : p.race !== 'human' ? 'wandering' : 'wandering'),
  tick(w, p, j) {
    if (j.s === 0) {
      const [x, y] = cellXY(w, j.c!);
      const r = moveTo(w, p, x, y);
      if (r === 'fail') return 'fail';
      if (r === 'arrived') { j.s = 1; j.w = 0; }
      return 'ongoing';
    }
    j.w++;
    if (p.race === 'human' && j.data?.joy) p.needs.joy = Math.min(1, p.needs.joy + 0.00009);
    return j.w > (j.count || 90) ? 'done' : 'ongoing';
  },
});

// ---------------- hauling ----------------
def('haul', {
  label: (w, p, j) => { const it = thing<Item>(w, j.t) || p.carry; return it ? `hauling ${ITEMS[it.def].label}` : 'hauling'; },
  tick(w, p, j) {
    if (j.s === 0) {
      const it = thing<Item>(w, j.t);
      if (!it || it.kind !== 'item') return p.carry && p.carry.def ? ((j.s = 2), 'ongoing') : 'fail';
      const r = moveTo(w, p, it.x, it.y, true);
      if (r === 'fail') return 'fail';
      if (r === 'arrived') { if (!pickUp(w, p, it, j.count || it.count)) return 'fail'; j.s = 2; }
      return 'ongoing';
    }
    if (!p.carry) return 'fail';
    // destinations: blueprint, building (fuel), cell
    if (j.t2) {
      const tgt = w.things.get(j.t2);
      if (!tgt) return 'fail';
      const [bw, bh] = tgt.kind === 'blueprint' && !(tgt as any).floor ? bldRect(w, tgt as any) : tgt.kind === 'building' ? bldRect(w, tgt as any) : [1, 1];
      const r = moveTo(w, p, tgt.x, tgt.y, true, bw, bh);
      if (r === 'fail') return 'fail';
      if (r !== 'arrived') return 'ongoing';
      if (tgt.kind === 'blueprint') {
        const need = blueprintNeeds(tgt)[p.carry.def] || 0;
        const n = Math.min(need, p.carry.count);
        tgt.delivered[p.carry.def] = (tgt.delivered[p.carry.def] || 0) + n;
        p.carry.count -= n;
        if (p.carry.count <= 0) p.carry = null; else dropCarry(w, p);
        w.sound('drop', p.x, p.y);
        return 'done';
      }
      if (tgt.kind === 'building') {
        const d = BUILDINGS[tgt.def];
        if (d.fuel && d.fuel.item === p.carry.def) {
          const room = Math.ceil(d.fuel.cap - (tgt.fuel || 0));
          const n = Math.min(room, p.carry.count);
          tgt.fuel = Math.min(d.fuel.cap, (tgt.fuel || 0) + n);
          p.carry.count -= n;
          if (p.carry.count <= 0) p.carry = null; else dropCarry(w, p);
          if (d.light) w.map.lightDirty = true;
          return 'done';
        }
        if (d.grave && p.carry.corpse) { tgt.graveCorpse = p.carry; p.carry = null; w.text(tgt.x, tgt.y, 'buried', '#ccc'); return 'done'; }
      }
      dropCarry(w, p);
      return 'done';
    }
    const [x, y] = cellXY(w, j.c!);
    const touchDest = w.map.cost[j.c!] === IMPASSABLE;
    const r = moveTo(w, p, x, y, touchDest);
    if (r === 'fail') { dropCarry(w, p); return 'fail'; }
    if (r !== 'arrived') return 'ongoing';
    const c = p.carry; p.carry = null;
    c.owner = p.faction;
    placeItem(w, c, x, y);
    w.sound('drop', x, y);
    return 'done';
  },
});

// ---------------- construction ----------------
def('construct', {
  label: (w, p, j) => { const bp = thing<any>(w, j.t); return bp ? `building ${bp.floor ? 'floor' : BUILDINGS[bp.def]?.label}` : 'building'; },
  tick(w, p, j) {
    const bp = thing<any>(w, j.t);
    if (!bp || bp.kind !== 'blueprint') return 'fail';
    if (Object.keys(blueprintNeeds(bp)).length) return 'fail';
    const [bw, bh] = bp.floor ? [1, 1] : bldRect(w, bp);
    const r = moveTo(w, p, bp.x, bp.y, true, bw, bh);
    if (r === 'fail') return 'fail';
    if (r !== 'arrived') return 'ongoing';
    // don't build impassable things on top of self
    if (!bp.floor && BUILDINGS[bp.def].pass !== 'pass' && p.x >= bp.x && p.x < bp.x + bw && p.y >= bp.y && p.y < bp.y + bh) {
      const m = w.map;
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = p.x + dx, ny = p.y + dy;
        if (m.inb(nx, ny) && m.passable(m.idx(nx, ny)) && !(nx >= bp.x && nx < bp.x + bw && ny >= bp.y && ny < bp.y + bh)) { w.movePawnCell(p, nx, ny); break; }
      }
    }
    bp.started = true;
    const art = !bp.floor && BUILDINGS[bp.def].art;
    const speed = art ? skillSpeed(p, 'artistic') : workSpeedFor(p, 'construct');
    bp.work += speed;
    workTick(w, p);
    if (w.tick % 60 === 0) gainXp(p, art ? 'artistic' : 'construction', 8);
    if (w.tick % 45 === p.id % 45) w.sound('hammer', bp.x, bp.y);
    if (bp.work >= blueprintWork(bp)) {
      // failure chance for low-skill builders
      const skill = skillLevel(p, art ? 'artistic' : 'construction');
      if (!bp.floor && !art && skill < 5 && w.rng.chance((5 - skill) * 0.02)) {
        w.text(bp.x, bp.y, 'construction failed', '#f88');
        bp.work = 0;
        for (const k of Object.keys(bp.delivered)) bp.delivered[k] = Math.floor(bp.delivered[k] * 0.5);
        return 'done';
      }
      completeBlueprint(w, bp, p);
      return 'done';
    }
    return 'ongoing';
  },
});
def('deconstruct', {
  label: () => 'deconstructing',
  tick(w, p, j) {
    const b = thing<Building>(w, j.t);
    if (!b || b.kind !== 'building' || b.desig !== 'deconstruct') return 'fail';
    const [bw, bh] = bldRect(w, b);
    const r = moveTo(w, p, b.x, b.y, true, bw, bh);
    if (r === 'fail') return 'fail';
    if (r !== 'arrived') return 'ongoing';
    j.w += workSpeedFor(p, 'construct');
    workTick(w, p);
    if (w.tick % 45 === p.id % 45) w.sound('hammer', b.x, b.y);
    if (j.w >= Math.max(60, BUILDINGS[b.def].work * 0.4)) { gainXp(p, 'construction', 20); destroyBuilding(w, b, 'deconstruct'); return 'done'; }
    return 'ongoing';
  },
});
def('repair', {
  label: () => 'repairing',
  tick(w, p, j) {
    const b = thing<Building>(w, j.t);
    if (!b || b.kind !== 'building') return 'fail';
    const [bw, bh] = bldRect(w, b);
    const r = moveTo(w, p, b.x, b.y, true, bw, bh);
    if (r === 'fail') return 'fail';
    if (r !== 'arrived') return 'ongoing';
    const max = buildingMaxHp(b.def, b.stuff);
    b.hp = Math.min(max, b.hp + 0.25 * workSpeedFor(p, 'construct'));
    workTick(w, p);
    return b.hp >= max ? 'done' : 'ongoing';
  },
});
def('roof', {
  label: (w, p, j) => (j.data?.remove ? 'removing roof' : 'building roof'),
  tick(w, p, j) {
    const m = w.map;
    const [x, y] = cellXY(w, j.c!);
    const want = j.data?.remove ? 2 : 1;
    if (m.roofDesig[j.c!] !== want) return 'fail';
    const r = moveTo(w, p, x, y, true);
    if (r === 'fail') return 'fail';
    if (r !== 'arrived') return 'ongoing';
    j.w += workSpeedFor(p, 'construct');
    workTick(w, p);
    if (j.w >= 65) {
      m.setRoof(j.c!, want === 1 ? ROOF.built : 0);
      m.setRoofDesig(j.c!, 0, 0);
      m.roomsDirty = true;
      gainXp(p, 'construction', 5);
      return 'done';
    }
    return 'ongoing';
  },
});

// ---------------- mining & plants ----------------
def('mine', {
  label: () => 'mining',
  tick(w, p, j) {
    const m = w.map;
    const i = j.c!;
    if (!m.rock[i] || m.desig[i] !== 1) return 'fail';
    const [x, y] = cellXY(w, i);
    const r = moveTo(w, p, x, y, true);
    if (r === 'fail') return 'fail';
    if (r !== 'arrived') return 'ongoing';
    p.rot = x > p.x ? 1 : x < p.x ? 3 : y > p.y ? 0 : 2;
    const rd = ROCKS[m.rock[i]];
    j.w += workSpeedFor(p, 'mine');
    workTick(w, p);
    if (w.tick % 40 === p.id % 40) w.sound('pick', x, y);
    if (w.tick % 60 === 0) gainXp(p, 'mining', 8);
    const hpLeft = Math.max(1, Math.round(rd.hp * (1 - j.w / rd.work)));
    if (w.tick % 15 === 0) m.rockHp[i] = hpLeft;
    if (j.w >= rd.work) { mineCell(w, i, p); return 'done'; }
    return 'ongoing';
  },
});
def('cut', {
  label: (w, p, j) => { const pd = w.map.plantDef(j.c!); return pd?.kind === 'tree' ? 'chopping tree' : j.data?.harvest ? `harvesting ${pd?.label || 'plant'}` : 'cutting plant'; },
  tick(w, p, j) {
    const m = w.map;
    const i = j.c!;
    const pid = m.plant[i];
    if (!pid) return 'fail';
    const [x, y] = cellXY(w, i);
    const r = moveTo(w, p, x, y, true);
    if (r === 'fail') return 'fail';
    if (r !== 'arrived') return 'ongoing';
    const pd = PLANTS[pid];
    const need = pd.kind === 'tree' ? 250 + 350 * m.growth[i] : pd.kind === 'crop' ? 170 : 100;
    j.w += workSpeedFor(p, 'plantcut');
    workTick(w, p);
    if (pd.kind === 'tree' && w.tick % 35 === p.id % 35) w.sound('chop', x, y);
    if (j.w >= need) { gainXp(p, 'plants', 30); cutPlant(w, i, p, !!j.data?.harvest); return 'done'; }
    return 'ongoing';
  },
});
def('sow', {
  label: (w, p, j) => `sowing ${PLANTS[PLANT_INDEX[j.data?.plant]]?.label || ''}`,
  tick(w, p, j) {
    const m = w.map;
    const i = j.c!;
    const [x, y] = cellXY(w, i);
    if (m.plant[i] && PLANTS[m.plant[i]].id !== j.data.plant) return 'fail';
    if (m.plant[i]) return 'done';
    const r = moveTo(w, p, x, y);
    if (r === 'fail') return 'fail';
    if (r !== 'arrived') return 'ongoing';
    j.w += workSpeedFor(p, 'grow');
    workTick(w, p);
    if (j.w >= 170) { m.setPlant(i, PLANT_INDEX[j.data.plant], 0.01); gainXp(p, 'plants', 25); return 'done'; }
    return 'ongoing';
  },
});

// ---------------- bills ----------------
def('dobill', {
  label: (w, p, j) => { const b = thing<Building>(w, j.t); const bill = b?.bills?.find(x => x.id === j.bill); return bill ? RECIPES[bill.recipe].label.toLowerCase() : 'working'; },
  tick(w, p, j) {
    const b = thing<Building>(w, j.t);
    const bill = b?.bills?.find(x => x.id === j.bill);
    if (!b || !bill) { dropHeld(w, p, j); return 'fail'; }
    const rec = RECIPES[bill.recipe];
    const d = BUILDINGS[b.def];
    const [ix, iy] = w.interactCell(b);
    const plan: { id: number; count: number }[] = j.data.plan;
    const held: Item[] = (j.data.held ||= []);
    if (j.s === 0) {
      // gather next ingredient
      if (j.data.k >= plan.length) { j.s = 1; return 'ongoing'; }
      const pl = plan[j.data.k];
      const it = thing<Item>(w, pl.id);
      if (!p.carry) {
        if (!it) { dropHeld(w, p, j); return 'fail'; }
        const r = moveTo(w, p, it.x, it.y, true);
        if (r === 'fail') { dropHeld(w, p, j); return 'fail'; }
        if (r !== 'arrived') return 'ongoing';
        if (!pickUp(w, p, it, pl.count)) { dropHeld(w, p, j); return 'fail'; }
        return 'ongoing';
      }
      const r = moveTo(w, p, ix, iy);
      if (r === 'fail') { dropHeld(w, p, j); return 'fail'; }
      if (r !== 'arrived') return 'ongoing';
      held.push(p.carry); p.carry = null;
      j.data.k++;
      return 'ongoing';
    }
    // work
    const r = moveTo(w, p, ix, iy);
    if (r === 'fail') { dropHeld(w, p, j); return 'fail'; }
    if (r !== 'arrived') return 'ongoing';
    if (d.bench?.power && !b.powered) { if (w.tick % 120 === 0) w.text(b.x, b.y, 'no power', '#f88'); return j.w > 0 && w.tick % 600 === 0 ? 'fail' : 'ongoing'; }
    if (d.bench?.fuel && !(b.fuel && b.fuel > 0)) { dropHeld(w, p, j); return 'fail'; }
    b.users = [p.id];
    p.rot = faceTo(p, b);
    const speed = skillSpeed(p, rec.skill) * (d.bench?.speed || 1);
    j.w += speed;
    workTick(w, p);
    if (w.tick % 60 === 0) gainXp(p, rec.skill, 10);
    if (j.w < rec.work) return 'ongoing';
    b.users = [];
    finishBill(w, p, b, bill, held);
    j.data.held = [];
    return 'done';
  },
});
function faceTo(p: Pawn, t: { x: number; y: number }) { const dx = t.x - p.x, dy = t.y - p.y; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 0 : 2; }
function dropHeld(w: World, p: Pawn, j: Job) {
  const held: Item[] = j.data?.held || [];
  for (const it of held) placeItem(w, it, p.x, p.y);
  if (j.data) j.data.held = [];
  const b = thing<Building>(w, j.t); if (b) b.users = [];
}

function finishBill(w: World, p: Pawn, b: Building, bill: any, held: Item[]) {
  const rec = RECIPES[bill.recipe];
  const [ix, iy] = w.interactCell(b);
  const products: Item[] = [];
  if (rec.special === 'butcher') {
    const c = held.find(h => h.corpse);
    if (c?.corpse) {
      const ad = ANIMALS[c.corpse.race];
      const rotten = (c.rot || 0) > 0.8;
      const yf = Math.min(1.1, 0.6 + skillLevel(p, 'cooking') * 0.03);
      if (c.corpse.race === 'human') {
        products.push(makeItem(w, 'leather', 12));
        for (const a of c.corpse.apparel) products.push({ ...a, tainted: true });
      } else if (ad?.mech) {
        products.push(makeItem(w, 'steel', 20), makeItem(w, 'plasteel', 6), makeItem(w, 'components', 1));
      } else if (ad) {
        if (!rotten && ad.meat) products.push(makeItem(w, 'meat', Math.max(1, Math.round(ad.meat * yf))));
        if (ad.leather) products.push(makeItem(w, ad.leather, Math.max(1, Math.round((ad.leatherCount || 10) * yf))));
      }
      w.map.addFilth(ix, iy, FILTH.blood, 40);
    }
  } else if (rec.special === 'stuffed') {
    const stuffItem = held.find(h => ITEMS[h.def].stuff);
    const q = rollQuality(w, skillLevel(p, 'crafting'), p.inspired === 'creativity');
    const it = makeItem(w, rec.product!, 1, { stuff: stuffItem?.def, quality: q });
    products.push(it);
    if (q >= 5) w.letter(p.faction, 'Masterwork!', `${pawnShortName(p)} crafted a ${itemLabel(it)}!`, 'good', ix, iy);
  } else if (rec.products) {
    for (const pr of rec.products) {
      const pd = ITEMS[pr.item];
      const it = makeItem(w, pr.item, pr.count);
      if (pd.quality) it.quality = rollQuality(w, skillLevel(p, rec.skill));
      products.push(it);
    }
  }
  bill.done = (bill.done || 0) + 1;
  if (bill.mode === 'count' && bill.done >= bill.target) b.bills = b.bills!.filter(x => x.id !== bill.id);
  // food poisoning chance tagged on meals from low skill cooks
  for (const it of products) {
    it.owner = p.faction;
    const placed = placeItem(w, it, ix, iy);
    if (placed && ITEMS[placed.def].cat === 'meal' && skillLevel(p, 'cooking') < 6 && w.rng.chance(0.04)) (placed as any).poison = true;
  }
  w.sound('craft_done', ix, iy);
}

// ---------------- research ----------------
def('research', {
  label: (w, p) => { const cur = w.research[p.faction]?.cur; return cur ? `researching ${RESEARCH[cur].label}` : 'researching'; },
  tick(w, p, j) {
    const b = thing<Building>(w, j.t);
    const rs = w.research[p.faction];
    if (!b || !rs?.cur) return 'fail';
    const d = BUILDINGS[b.def];
    if (d.bench?.power && !b.powered) return 'fail';
    const [ix, iy] = w.interactCell(b);
    const r = moveTo(w, p, ix, iy);
    if (r === 'fail') return 'fail';
    if (r !== 'arrived') return 'ongoing';
    b.users = [p.id];
    p.rot = faceTo(p, b);
    let boost = 1;
    for (const o of w.buildings.values()) if (o.def === 'multi_analyzer' && o.powered && Math.abs(o.x - b.x) < 6 && Math.abs(o.y - b.y) < 6) boost += 0.1;
    const pts = skillSpeed(p, 'intellectual') * (d.bench?.researchSpeed || 1) * boost * 0.03;
    const cur = rs.cur;
    rs.prog[cur] = (rs.prog[cur] || 0) + pts;
    workTick(w, p);
    if (w.tick % 60 === 0) gainXp(p, 'intellectual', 9);
    if (rs.prog[cur] >= RESEARCH[cur].cost) { onResearchComplete(w, p.faction, cur); b.users = []; return 'done'; }
    j.w++;
    if (j.w > 4000) { b.users = []; return 'done'; }
    return 'ongoing';
  },
});

// ---------------- needs ----------------
def('eat', {
  label: (w, p, j) => { const n = j.data?.foodDef; return n ? `eating ${ITEMS[n]?.label || 'food'}` : 'eating'; },
  tick(w, p, j) {
    if (j.s === 0) {
      const it = thing<Item>(w, j.t);
      if (!it || it.kind !== 'item') return 'fail';
      const r = moveTo(w, p, it.x, it.y, true);
      if (r === 'fail') return 'fail';
      if (r !== 'arrived') return 'ongoing';
      const fd = ITEMS[it.def].food!;
      const need = Math.max(1, Math.ceil((1 - p.needs.food) / fd.nutrition));
      const count = it.corpse ? 1 : Math.min(it.count, fd.kind === 'meal' && fd.nutrition >= 0.5 ? 1 : need);
      j.data = { ...(j.data || {}), foodDef: it.def, poison: (it as any).poison, rot: it.rot || 0 };
      if (it.corpse) { j.data.corpse = it.id; j.s = 2; j.w = 0; return 'ongoing'; }
      if (!pickUp(w, p, it, count)) return 'fail';
      j.s = 1;
      // find a table seat
      if (p.race === 'human' && !p.guest?.prisoner) {
        const seat = findDiningSeat(w, p);
        if (seat) { j.c = seat; } else j.c = undefined;
      }
      return 'ongoing';
    }
    if (j.s === 1) {
      if (j.c !== undefined) {
        const [x, y] = cellXY(w, j.c);
        const r = moveTo(w, p, x, y);
        if (r === 'fail') j.c = undefined;
        else if (r !== 'arrived') return 'ongoing';
      }
      j.s = 2; j.w = 0;
      if (j.c !== undefined) j.data.table = true;
      return 'ongoing';
    }
    j.w++;
    if (j.w % 40 === 0) w.emit({ k: 'eat', x: p.x, y: p.y, id: p.id });
    const dur = p.race === 'human' ? 400 : 250;
    if (j.w < dur) return 'ongoing';
    // consume
    if (j.data.corpse) {
      const c = thing<Item>(w, j.data.corpse);
      if (c) { p.needs.food = Math.min(1, p.needs.food + 0.8); c.rot = Math.max(c.rot || 0, 0.5); if (w.rng.chance(0.4)) w.despawn(c); }
      return 'done';
    }
    const it = p.carry;
    if (!it) return 'fail';
    const fd = ITEMS[it.def].food!;
    p.needs.food = Math.min(1, p.needs.food + fd.nutrition * it.count);
    if (fd.joy) p.needs.joy = Math.min(1, p.needs.joy + fd.joy);
    p.carry = null;
    if (p.race === 'human') {
      if (fd.thought) addThought(w, p, fd.thought);
      if (fd.kind !== 'meal' && fd.kind !== 'hay' && !fd.thought) addThought(w, p, 'ate_raw');
      if (!j.data.table && !p.guest?.prisoner && fd.kind === 'meal') addThought(w, p, 'ate_without_table');
      if (j.data.table) { const room = roomAt(w, p.x, p.y); if (room && room.impressiveness >= 50) addThought(w, p, 'ate_impressive_dining'); }
      if (j.data.poison || (j.data.rot || 0) > 0.9 || (fd.kind !== 'meal' && w.rng.chance(0.01))) {
        p.hediffs.push({ type: 'food_poisoning', sev: 1, age: 0 });
        w.text(p.x, p.y - 1, 'food poisoning', '#9c6');
      }
    }
    return 'done';
  },
});
function findDiningSeat(w: World, p: Pawn): number | undefined {
  const m = w.map;
  let best: number | undefined, bestD = 30 * 30;
  for (const b of w.buildings.values()) {
    const d = BUILDINGS[b.def];
    if (!d.seat || b.faction !== p.faction) continue;
    const dd = (b.x - p.x) ** 2 + (b.y - p.y) ** 2;
    if (dd > bestD) continue;
    // adjacent table?
    let table = false;
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) { const t = w.buildingAt(b.x + dx, b.y + dy); if (t && BUILDINGS[t.def].table) { table = true; break; } }
    if (!table) continue;
    const ci = m.idx(b.x, b.y);
    if (!w.canReserve('c' + ci, p.id) || (m.pawns[ci]?.length && !m.pawns[ci]!.includes(p.id))) continue;
    if (!m.connected(m.idx(p.x, p.y), ci, false)) continue;
    best = ci; bestD = dd;
  }
  if (best !== undefined) w.reserve('c' + best, p.id);
  return best;
}

def('graze', {
  label: () => 'grazing',
  tick(w, p, j) {
    const m = w.map;
    const i = j.c!;
    if (!m.plant[i]) return 'fail';
    const [x, y] = cellXY(w, i);
    const r = moveTo(w, p, x, y);
    if (r === 'fail') return 'fail';
    if (r !== 'arrived') return 'ongoing';
    j.w++;
    if (j.w < 200) return 'ongoing';
    const pd = PLANTS[m.plant[i]];
    p.needs.food = Math.min(1, p.needs.food + pd.nutrition * Math.max(0.3, m.growth[i]) * (1 / Math.max(0.3, ANIMALS[p.race]?.size || 1)));
    if (pd.kind === 'tree') m.setGrowth(i, Math.max(0.1, m.growth[i] - 0.1));
    else m.setPlant(i, 0);
    return 'done';
  },
});

def('sleep', {
  label: (w, p) => (p.asleep ? 'sleeping' : 'going to sleep'),
  tick(w, p, j) {
    const m = w.map;
    const bed = thing<Building>(w, j.t);
    if (j.s === 0) {
      let tx: number, ty: number;
      if (bed) { const c = sleepCell(w, bed, p); tx = c[0]; ty = c[1]; }
      else { [tx, ty] = cellXY(w, j.c ?? m.idx(p.x, p.y)); }
      const r = moveTo(w, p, tx, ty);
      if (r === 'fail') { if (bed) return 'fail'; j.s = 1; }
      else if (r !== 'arrived') return 'ongoing';
      j.s = 1; p.asleep = true; j.w = 0;
      return 'ongoing';
    }
    p.asleep = true;
    const bd = bed ? BUILDINGS[bed.def].bed : null;
    const eff = bd ? bd.restEff * (bed?.quality !== undefined ? 0.9 + bed.quality * 0.05 : 1) : 0.75;
    p.needs.rest = Math.min(1, p.needs.rest + (1 / (TICKS_PER_DAY * 0.32)) * eff);
    p.needs.comfort += ((bd ? bd.comfort : 0.25) - p.needs.comfort) * 0.001;
    j.w++;
    if (w.tick % 150 === 0 && p.race === 'human') w.emit({ k: 'zzz', x: p.x, y: p.y, id: p.id });
    // wake conditions
    const hour = w.hour;
    const sched = p.schedule[Math.floor(hour)] || 'A';
    if (p.needs.rest >= 0.99 && (sched !== 'S' || p.needs.rest >= 1)) { wake(w, p, bed); return 'done'; }
    if (p.needs.food < 0.12 && j.w > 500) { wake(w, p, bed); return 'done'; }
    return 'ongoing';
  },
});
export function sleepCell(w: World, bed: Building, p: Pawn): [number, number] {
  const d = BUILDINGS[bed.def];
  if (d.bed && d.bed.sleepers > 1 && bed.owners && bed.owners.indexOf(p.id) === 1) {
    return bed.rot % 2 === 0 ? [bed.x + 1, bed.y] : [bed.x, bed.y + 1];
  }
  // head cell is the top-left for rot 0
  if (bed.rot === 2) return [bed.x, bed.y + (d.size[1] - 1)];
  if (bed.rot === 3) return [bed.x + (d.size[1] - 1), bed.y];
  return [bed.x, bed.y];
}
function wake(w: World, p: Pawn, bed?: Building) {
  p.asleep = false;
  if (p.race !== 'human') return;
  const room = roomAt(w, p.x, p.y);
  const t = p.temp ?? 20;
  if (!bed) addThought(w, p, 'slept_on_ground');
  else if (BUILDINGS[bed.def].bed?.bedroll) addThought(w, p, 'slept_on_ground');
  if (!room || room.outdoors) addThought(w, p, 'slept_outside');
  else if (room.role === 'barracks') addThought(w, p, 'slept_in_barracks');
  else if (room.role === 'bedroom') { if (room.impressiveness >= 50) addThought(w, p, 'impressive_bedroom'); else if (room.impressiveness < 20) addThought(w, p, 'awful_bedroom'); }
  if (t < 10) addThought(w, p, 'slept_in_cold'); else if (t > 32) addThought(w, p, 'slept_in_heat');
}

def('rest', {
  label: () => 'resting in bed',
  tick(w, p, j) {
    const bed = thing<Building>(w, j.t);
    if (!bed) return 'fail';
    if (j.s === 0) {
      const [x, y] = sleepCell(w, bed, p);
      const r = moveTo(w, p, x, y);
      if (r === 'fail') return 'fail';
      if (r !== 'arrived') return 'ongoing';
      j.s = 1;
    }
    p.asleep = p.needs.rest < 0.95;
    if (p.asleep) p.needs.rest = Math.min(1, p.needs.rest + 1 / (TICKS_PER_DAY * 0.32));
    j.w++;
    if (j.w % 300 === 0 && !needsBedRest(p)) { p.asleep = false; return 'done'; }
    if (p.needs.food < 0.2 && j.w > 300) { p.asleep = false; return 'done'; }
    return 'ongoing';
  },
});
export function needsBedRest(p: Pawn): boolean {
  if (p.downed) return true;
  if (needsTending(p)) return true;
  return p.hediffs.some(h => (h.type === 'disease' && h.sev > 0.05) || (h.type === 'injury' && h.sev > 6) || (h.type === 'bloodloss' && h.sev > 0.2));
}

def('joy', {
  label: (w, p, j) => ({ walk: 'walking for fun', sky: 'gazing at the sky', building: 'playing', beer: 'having a drink', social: 'relaxing socially', tv: 'watching TV', meditate: 'meditating' } as any)[j.data?.kind] || 'relaxing',
  tick(w, p, j) {
    const b = thing<Building>(w, j.t);
    if (j.s === 0) {
      let tx: number, ty: number;
      if (j.c !== undefined) [tx, ty] = cellXY(w, j.c);
      else if (b) [tx, ty] = [b.x, b.y];
      else return 'fail';
      const touch = j.c === undefined && !!b;
      const r = moveTo(w, p, tx, ty, touch, b ? bldRect(w, b)[0] : 1, b ? bldRect(w, b)[1] : 1);
      if (r === 'fail') return 'fail';
      if (r !== 'arrived') return 'ongoing';
      j.s = 1; j.w = 0;
      if (b) p.rot = faceTo(p, b);
    }
    j.w++;
    const rate = b && BUILDINGS[b.def].joy ? BUILDINGS[b.def].joy!.rate : j.data?.kind === 'sky' ? 1 : 0.8;
    if (b && BUILDINGS[b.def].power && !b.powered) return 'done';
    p.needs.joy = Math.min(1, p.needs.joy + 0.00013 * rate);
    if (j.data?.kind === 'sky') p.asleep = false;
    if (b) b.users = [p.id];
    if (b?.def === 'horseshoes' && j.w % 90 === 0) w.emit({ k: 'toss', x: p.x, y: p.y, x2: b.x, y2: b.y });
    if (j.w % 200 === 0 && b?.def === 'chess_table') p.bubble = { icon: 'think', t: w.tick + 100 };
    if (p.needs.joy >= 0.98 || j.w > (j.count || 2500)) { if (b) b.users = []; return 'done'; }
    return 'ongoing';
  },
});

// ---------------- medical ----------------
def('tend', {
  label: (w, p, j) => { const pt = thing<Pawn>(w, j.t); return pt ? `tending ${pawnShortName(pt)}` : 'tending'; },
  tick(w, p, j) {
    const pt = thing<Pawn>(w, j.t);
    if (!pt || pt.dead || !needsTending(pt)) { if (p.carry) dropCarry(w, p); return pt && !pt.dead ? 'done' : 'fail'; }
    if (j.s === 0 && j.t2) {
      const med = thing<Item>(w, j.t2);
      if (!med) { j.t2 = undefined; j.s = 1; return 'ongoing'; }
      const r = moveTo(w, p, med.x, med.y, true);
      if (r === 'fail') { j.t2 = undefined; j.s = 1; return 'ongoing'; }
      if (r !== 'arrived') return 'ongoing';
      pickUp(w, p, med, 1);
      j.s = 1;
      return 'ongoing';
    }
    j.s = Math.max(1, j.s);
    if (pt.id !== p.id) {
      const r = moveTo(w, p, pt.x, pt.y, true);
      if (r === 'fail') return 'fail';
      if (r !== 'arrived') return 'ongoing';
    }
    j.w += workSpeedFor(p, 'doctor');
    workTick(w, p);
    if (j.w < 400) return 'ongoing';
    const potency = p.carry && ITEMS[p.carry.def].med ? ITEMS[p.carry.def].med!.potency : 0;
    if (p.carry && ITEMS[p.carry.def].med) { p.carry.count--; if (p.carry.count <= 0) p.carry = null; else dropCarry(w, p); }
    tend(w, p, pt, potency);
    gainXp(p, 'medical', 60);
    if (pt.id !== p.id && pt.race === 'human') changeOpinion(pt, p.id, 3);
    return needsTending(pt) ? ((j.w = 0), 'ongoing') : 'done';
  },
});

def('rescue', {
  label: (w, p, j) => { const pt = thing<Pawn>(w, j.t); return pt ? (j.data?.capture ? `capturing ${pawnShortName(pt)}` : `rescuing ${pawnShortName(pt)}`) : 'rescuing'; },
  tick(w, p, j) {
    const pt = thing<Pawn>(w, j.t);
    const bed = thing<Building>(w, j.t2);
    if (!pt || pt.dead || !bed) { releaseCarried(w, p); return 'fail'; }
    if (j.s === 0) {
      if (!pt.downed) return 'fail';
      const r = moveTo(w, p, pt.x, pt.y, true);
      if (r === 'fail') return 'fail';
      if (r !== 'arrived') return 'ongoing';
      (pt as any).carriedBy = p.id;
      j.data = { ...(j.data || {}), carrying: pt.id };
      j.s = 1;
      return 'ongoing';
    }
    const [x, y] = sleepCell(w, bed, pt);
    const r = moveTo(w, p, x, y, true);
    if (r === 'fail') { releaseCarried(w, p); return 'fail'; }
    // carried pawn follows
    w.movePawnCell(pt, p.x, p.y); pt.nx = p.x; pt.ny = p.y;
    if (r !== 'arrived') return 'ongoing';
    (pt as any).carriedBy = undefined;
    w.movePawnCell(pt, x, y); pt.nx = x; pt.ny = y; pt.mp = 0;
    if (j.data?.capture) {
      pt.guest = { prisoner: true, resistance: 10 + w.rng.range(0, 20), mode: 'recruit', host: p.faction };
      pt.lord = 0; pt.faction = pt.faction; pt.drafted = false;
      if (pt.equip) { placeItem(w, pt.equip, x, y); pt.equip = null; }
      w.letter(p.faction, 'Prisoner captured', `${pawnShortName(pt)} is now your prisoner. Wardens will try to recruit them.`, 'neutral', x, y, pt.id);
    } else if (pt.race === 'human') addThought(w, pt, 'rescued', p.id);
    pt.job = mkJob('rest', { t: bed.id, s: 1 });
    if (bed.owners && !bed.owners.includes(pt.id) && (BUILDINGS[bed.def].bed?.medical || j.data?.capture || !pt.bed)) { /* temporary use */ }
    return 'done';
  },
});
function releaseCarried(w: World, p: Pawn) {
  const id = p.job?.data?.carrying;
  if (id) { const pt = w.pawns.get(id); if (pt) (pt as any).carriedBy = undefined; }
}

def('feed', {
  label: () => 'feeding patient',
  tick(w, p, j) {
    const pt = thing<Pawn>(w, j.t);
    if (!pt || pt.dead) { dropCarry(w, p); return 'fail'; }
    if (j.s === 0) {
      const it = thing<Item>(w, j.t2);
      if (!it) return 'fail';
      const r = moveTo(w, p, it.x, it.y, true);
      if (r === 'fail') return 'fail';
      if (r !== 'arrived') return 'ongoing';
      const fd = ITEMS[it.def].food!;
      pickUp(w, p, it, fd.nutrition >= 0.5 ? 1 : Math.ceil(0.9 / fd.nutrition));
      j.s = 1;
      return 'ongoing';
    }
    const r = moveTo(w, p, pt.x, pt.y, true);
    if (r === 'fail') { dropCarry(w, p); return 'fail'; }
    if (r !== 'arrived') return 'ongoing';
    j.w++;
    if (j.w < 200) return 'ongoing';
    if (p.carry?.def && ITEMS[p.carry.def].food) {
      pt.needs.food = Math.min(1, pt.needs.food + ITEMS[p.carry.def].food!.nutrition * p.carry.count);
      p.carry = null;
    }
    return 'done';
  },
});

def('warden', {
  label: (w, p, j) => { const pt = thing<Pawn>(w, j.t); return pt ? `chatting with ${pawnShortName(pt)}` : 'chatting'; },
  tick(w, p, j) {
    const pt = thing<Pawn>(w, j.t);
    if (!pt || pt.dead || !pt.guest?.prisoner) return 'fail';
    const r = moveTo(w, p, pt.x, pt.y, true);
    if (r === 'fail') return 'fail';
    if (r !== 'arrived') return 'ongoing';
    j.w++;
    if (j.w % 60 === 0) { p.bubble = { icon: 'chat', t: w.tick + 80 }; }
    if (j.w < 350) return 'ongoing';
    pt.guest.lastChat = w.tick;
    gainXp(p, 'social', 40);
    if (pt.guest.mode === 'recruit') {
      const power = 1 + skillLevel(p, 'social') * 0.25;
      if (pt.guest.resistance > 0) {
        pt.guest.resistance = Math.max(0, pt.guest.resistance - power * w.rng.range(0.6, 1.2) * (pt.needs.mood > 0.5 ? 1.2 : 0.8));
        w.text(pt.x, pt.y - 1, `resistance ${pt.guest.resistance.toFixed(1)}`, '#ccc');
      } else if (w.rng.chance(0.3 + skillLevel(p, 'social') * 0.04)) {
        recruit(w, pt, p.faction);
      } else w.text(pt.x, pt.y - 1, 'recruit failed', '#f99');
    }
    return 'done';
  },
});
export function recruit(w: World, pt: Pawn, faction: number) {
  pt.guest = null; pt.faction = faction; pt.lord = 0; pt.hostileTo = undefined; pt.job = null; pt.exitMap = false;
  pt.work = Object.fromEntries(Object.keys(pt.work).map(k => [k, pt.disabled.includes(k as any) ? 0 : 3])) as any;
  w.letter(faction, 'Recruited!', `${pawnShortName(pt)} has joined your colony.`, 'good', pt.x, pt.y, pt.id);
  for (const o of w.colonists(faction)) if (o.id !== pt.id) addThought(w, o, 'new_colonist');
}

// ---------------- fire ----------------
def('firefight', {
  label: () => 'extinguishing fire',
  tick(w, p, j) {
    const f = thing<any>(w, j.t);
    if (!f || f.kind !== 'fire') return 'done';
    const r = moveTo(w, p, f.x, f.y, true);
    if (r === 'fail') return 'fail';
    if (r !== 'arrived') return 'ongoing';
    f.size -= 0.012;
    if (w.tick % 30 === 0) w.emit({ k: 'dust', x: f.x, y: f.y });
    if (f.size <= 0) { w.despawn(f); w.map.lightDirty = true; return 'done'; }
    return 'ongoing';
  },
});

// ---------------- gear ----------------
def('equip', {
  label: () => 'equipping',
  tick(w, p, j) {
    const it = thing<Item>(w, j.t);
    if (!it || it.kind !== 'item') return 'fail';
    const r = moveTo(w, p, it.x, it.y, true);
    if (r === 'fail') return 'fail';
    if (r !== 'arrived') return 'ongoing';
    w.despawn(it);
    const n = { ...it, count: 1 };
    if (it.count > 1) { it.count--; placeItem(w, it, it.x, it.y); n.id = w.newId(); }
    if (p.equip) placeItem(w, p.equip, p.x, p.y);
    p.equip = n;
    return 'done';
  },
});
def('wear', {
  label: () => 'changing clothes',
  tick(w, p, j) {
    const it = thing<Item>(w, j.t);
    if (!it || it.kind !== 'item') return 'fail';
    const r = moveTo(w, p, it.x, it.y, true);
    if (r === 'fail') return 'fail';
    if (r !== 'arrived') return 'ongoing';
    j.w++;
    if (j.w < 120) return 'ongoing';
    const ap = ITEMS[it.def].apparel!;
    w.despawn(it);
    const conflicts = p.apparel.filter(a => { const o = ITEMS[a.def].apparel!; return o.layers.some(l => ap.layers.includes(l)) && o.cover.some(c => ap.cover.includes(c) || (c === 'fullhead' && ap.cover.includes('head')) || (c === 'head' && ap.cover.includes('fullhead'))); });
    for (const c of conflicts) { p.apparel.splice(p.apparel.indexOf(c), 1); placeItem(w, c, p.x, p.y); }
    p.apparel.push(it);
    return 'done';
  },
});

// ---------------- cleaning ----------------
def('clean', {
  label: () => 'cleaning',
  tick(w, p, j) {
    const m = w.map;
    const i = j.c!;
    if (!m.filth[i]) return 'done';
    const [x, y] = cellXY(w, i);
    const r = moveTo(w, p, x, y);
    if (r === 'fail') return 'fail';
    if (r !== 'arrived') return 'ongoing';
    j.w++;
    if (j.w % 8 === 0) m.setFilth(i, m.filthType[i], m.filth[i] - 8);
    if (!m.filth[i]) {
      // chain to adjacent filth
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!m.inb(nx, ny)) continue;
        const ni = m.idx(nx, ny);
        if (m.filth[ni] && m.roof[ni] && w.canReserve('c' + ni, p.id) && (j.count || 0) < 8) { w.reserve('c' + ni, p.id); j.c = ni; j.count = (j.count || 0) + 1; j.w = 0; return 'ongoing'; }
      }
      return 'done';
    }
    return 'ongoing';
  },
});

// ---------------- animals ----------------
def('tame', {
  label: () => 'taming',
  tick(w, p, j) {
    const a = thing<Pawn>(w, j.t);
    if (!a || a.dead || a.animal?.tamed || a.faction !== 0) { dropCarry(w, p); return 'fail'; }
    if (j.s === 0 && j.t2) {
      const it = thing<Item>(w, j.t2);
      if (!it) return 'fail';
      const r = moveTo(w, p, it.x, it.y, true);
      if (r === 'fail') return 'fail';
      if (r !== 'arrived') return 'ongoing';
      pickUp(w, p, it, 3);
      j.s = 1;
      return 'ongoing';
    }
    const r = moveTo(w, p, a.x, a.y, true);
    if (r === 'fail') { dropCarry(w, p); return 'fail'; }
    if (r !== 'arrived') return 'ongoing';
    a.job = mkJob('wait', { count: 60 });
    j.w++;
    if (j.w < 300) return 'ongoing';
    if (p.carry) p.carry = null;
    const ad = ANIMALS[a.race];
    const chance = Math.max(0.02, (1 - ad.wildness) * (0.4 + skillLevel(p, 'animals') * 0.04));
    gainXp(p, 'animals', 60);
    if (w.rng.chance(chance)) {
      a.faction = p.faction; a.animal!.tamed = true; a.animal!.name = petName(w); a.animal!.master = p.id;
      w.map.home[0] = w.map.home[0];
      (a as any).desig = undefined;
      w.letter(p.faction, 'Animal tamed', `${pawnShortName(p)} tamed a ${ad.label}, now called ${a.animal!.name}.`, 'good', a.x, a.y, a.id);
      if (w.rng.chance(0.3)) { a.animal!.bonded = p.id; }
    } else {
      w.text(a.x, a.y - 1, 'taming failed', '#f99');
      if (w.rng.chance(ad.wildness * 0.1)) { a.animal!.manhunter = w.tick + 5000; a.target = p.id; w.letter(p.faction, 'Taming failed badly', `The ${ad.label} turned on ${pawnShortName(p)}!`, 'bad', a.x, a.y, a.id); }
    }
    return 'done';
  },
});
def('slaughter', {
  label: () => 'slaughtering',
  tick(w, p, j) {
    const a = thing<Pawn>(w, j.t);
    if (!a || a.dead) return 'fail';
    const r = moveTo(w, p, a.x, a.y, true);
    if (r === 'fail') return 'fail';
    if (r !== 'arrived') return 'ongoing';
    a.job = mkJob('wait', { count: 40 });
    j.w++;
    if (j.w < 180) return 'ongoing';
    die(w, a, 'slaughtered');
    return 'done';
  },
});
def('gather', {
  label: (w, p, j) => `${j.data?.kind === 'milk' ? 'milking' : j.data?.kind === 'wool' ? 'shearing' : 'gathering'} animal`,
  tick(w, p, j) {
    const a = thing<Pawn>(w, j.t);
    if (!a || a.dead || !a.animal) return 'fail';
    const r = moveTo(w, p, a.x, a.y, true);
    if (r === 'fail') return 'fail';
    if (r !== 'arrived') return 'ongoing';
    a.job = mkJob('wait', { count: 40 });
    j.w += workSpeedFor(p, 'handle');
    if (j.w < 250) return 'ongoing';
    const ad = ANIMALS[a.race];
    const prod = ad.products?.find(pr => pr.kind === j.data.kind);
    if (prod && (a.animal.products[prod.kind] || 0) >= 1) {
      a.animal.products[prod.kind] = 0;
      const it = makeItem(w, prod.item, prod.count, { owner: p.faction });
      placeItem(w, it, a.x, a.y);
      gainXp(p, 'animals', 30);
    }
    return 'done';
  },
});

// ---------------- combat ----------------
def('attack', {
  label: (w, p, j) => { const t = w.things.get(j.t!); return t && t.kind === 'pawn' ? `attacking ${pawnShortName(t)}` : 'attacking'; },
  tick(w, p, j) {
    const t = w.things.get(j.t!) as Pawn | Building | undefined;
    if (!t || (t.kind === 'pawn' && (t.dead || (t.downed && !j.data?.kill)))) return 'done';
    if (t.kind !== 'pawn' && t.kind !== 'building') return 'fail';
    const wp = weaponOf(p);
    const tx = t.x, ty = t.y;
    const d = dist(p.x, p.y, tx, ty);
    if (wp && !wp.melee) {
      const range = (wp.range || 20) * (j.data?.close ? 0.6 : 0.95);
      const canShoot = d <= range && lineOfSight(w, p.x, p.y, tx, ty);
      if (!canShoot || p.mp > 0) {
        if (p.drafted && !j.forced && d > range) return 'done'; // drafted pawns hold position unless forced
        p.warm = 0;
        const r = moveTo(w, p, tx, ty, true);
        if (r === 'fail') return 'fail';
        if (r === 'arrived' && !canShoot) return 'fail';
        return 'ongoing';
      }
      stopMoving(p);
      p.rot = faceTo(p, t);
      p.aimX = tx; p.aimY = ty;
      if (p.cd > 0) return 'ongoing';
      if (p.burst > 0) {
        fireAt(w, p, null, weaponDef(p)!, p.x, p.y, t, p.faction);
        p.burst--;
        p.cd = p.burst > 0 ? (wp.burstDelay || 6) : wp.cooldown;
        return 'ongoing';
      }
      if (p.warm === 0) { p.warm = Math.max(1, Math.round((wp.warmup || 30) * (p.traits.includes('careful_shooter') ? 1.25 : p.traits.includes('trigger_happy') ? 0.5 : 1))); return 'ongoing'; }
      p.warm--;
      if (p.warm > 0) return 'ongoing';
      p.burst = (wp.burst || 1);
      fireAt(w, p, null, weaponDef(p)!, p.x, p.y, t, p.faction);
      p.burst--;
      p.cd = p.burst > 0 ? (wp.burstDelay || 6) : wp.cooldown;
      return 'ongoing';
    }
    // melee
    const [bw, bh] = t.kind === 'building' ? bldRect(w, t) : [1, 1];
    const adjacent = atGoal(p, tx, ty, true, bw, bh) && p.mp === 0;
    if (!adjacent) {
      const r = moveTo(w, p, tx, ty, true, bw, bh);
      if (r === 'fail') return 'fail';
      return 'ongoing';
    }
    stopMoving(p);
    p.rot = faceTo(p, t);
    if (p.cd > 0) return 'ongoing';
    meleeAttack(w, p, t);
    return 'ongoing';
  },
});

def('flee', {
  label: () => 'fleeing',
  tick(w, p, j) {
    const [x, y] = cellXY(w, j.c!);
    const r = moveTo(w, p, x, y);
    if (r === 'fail' || r === 'arrived') { p.fleeing = false; return 'done'; }
    return 'ongoing';
  },
});

def('exit', {
  label: () => 'leaving',
  tick(w, p, j) {
    const m = w.map;
    const [x, y] = cellXY(w, j.c!);
    const r = moveTo(w, p, x, y);
    const onEdge = p.x === 0 || p.y === 0 || p.x === m.w - 1 || p.y === m.h - 1;
    if (r === 'arrived' || (onEdge && p.mp === 0)) {
      // carried loot / kidnapped leave too
      const lord = p.lord ? w.lords.get(p.lord) : null;
      if (lord) lord.pawns = lord.pawns.filter(id => id !== p.id);
      if (p.carry) p.carry = null;
      if (w.isColonist(p) && p.mental?.kind === 'give_up') w.letter(p.faction, `${pawnShortName(p)} left`, `${pawnShortName(p)} has given up and left the colony forever.`, 'bad');
      w.despawn(p);
      return 'done';
    }
    if (r === 'fail') {
      // try another edge cell
      j.c = randomEdgeCell(w, p);
      return 'ongoing';
    }
    return 'ongoing';
  },
});
export function randomEdgeCell(w: World, p: Pawn): number {
  const m = w.map;
  // choose nearest edge
  const opts = [[0, p.y], [m.w - 1, p.y], [p.x, 0], [p.x, m.h - 1]] as [number, number][];
  opts.sort((a, b) => dist(p.x, p.y, a[0], a[1]) - dist(p.x, p.y, b[0], b[1]));
  for (const [x, y] of opts) {
    for (let k = 0; k < 30; k++) {
      const xx = x === 0 || x === m.w - 1 ? x : Math.max(0, Math.min(m.w - 1, x + w.rng.int(-20, 20)));
      const yy = y === 0 || y === m.h - 1 ? y : Math.max(0, Math.min(m.h - 1, y + w.rng.int(-20, 20)));
      const i = m.idx(xx, yy);
      if (m.passable(i) && m.connected(m.idx(p.x, p.y), i, false)) return i;
    }
  }
  return m.idx(opts[0][0], opts[0][1]);
}

def('carry_off', {
  label: () => 'carrying off',
  tick(w, p, j) {
    // kidnappers carrying a downed pawn to the map edge
    const pt = thing<Pawn>(w, j.t);
    if (!pt || pt.dead) return 'fail';
    if (j.s === 0) {
      const r = moveTo(w, p, pt.x, pt.y, true);
      if (r === 'fail') return 'fail';
      if (r !== 'arrived') return 'ongoing';
      (pt as any).carriedBy = p.id; j.s = 1;
      return 'ongoing';
    }
    const [x, y] = cellXY(w, j.c!);
    const r = moveTo(w, p, x, y);
    w.movePawnCell(pt, p.x, p.y);
    const m = w.map;
    if (r === 'arrived' || p.x === 0 || p.y === 0 || p.x === m.w - 1 || p.y === m.h - 1) {
      if (w.isColonist(pt)) w.letter(pt.faction, `${pawnShortName(pt)} kidnapped`, `${pawnShortName(pt)} was carried off by raiders.`, 'bad');
      w.despawn(pt); w.despawn(p);
      return 'done';
    }
    return r === 'fail' ? 'fail' : 'ongoing';
  },
});

export function jobLabel(w: World, p: Pawn): string {
  if (w.mode === 'client' && p.jobLabel) return p.jobLabel;
  if (p.dead) return 'dead';
  if (p.downed) return p.mental?.kind === 'catatonic' ? 'catatonic' : 'downed';
  if (p.mental) return ({ sad_wander: 'wandering sadly', food_binge: 'binge eating', hide_room: 'hiding', tantrum: 'throwing a tantrum', berserk: 'BERSERK', insulting_spree: 'insulting people', give_up: 'giving up', catatonic: 'catatonic' } as any)[p.mental.kind] || p.mental.kind;
  if (!p.job) return p.drafted ? 'drafted' : 'idle';
  const d = DRIVERS[p.job.type];
  return d ? d.label(w, p, p.job) : p.job.type;
}

export { hitChance, pawnHostileTo, isAnimal, capacity, applyDamage, setDowned, impressLabel };
