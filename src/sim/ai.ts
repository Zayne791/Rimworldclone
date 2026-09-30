// Per-pawn tick and the "think tree" that picks what each pawn does next.
import type { World } from './world';
import type { Pawn, Job, Building } from './types';
import { DRIVERS, mkJob, dropCarry, needsBedRest, randomEdgeCell, type Status } from './jobs';
import { findWork, findFood, findBedFor } from './work';
import { needsTick, socialTick, NEEDS_INTERVAL, startMentalBreak } from './mood';
import { healthTick, HEALTH_INTERVAL, needsTending, isSeriouslyHurt } from './health';
import { step, stopMoving } from './move';
import { findEnemy, findHostileBuilding, pawnHostileTo } from './combat';
import { weaponOf, isAnimal, isMech, comfyTemp, bodySize, insulation } from './stats';
import { BUILDINGS } from '../data/buildings';
import { ANIMALS } from '../data/animals';
import { ITEMS } from '../data/items';
import { PLANTS } from '../data/plants';
import { TICKS_PER_DAY } from '../core/constants';
import { dist, dist2 } from '../core/util';
import { lordPawnThink } from './lords';
import { makeItem, placeItem, pawnShortName } from './things';
import { roomAt } from './rooms';
import { itemAccessible } from './zones';
import { bfsNearest, lineOfSight } from './path';

export function endJob(w: World, p: Pawn, st: Status) {
  const j = p.job;
  if (j) {
    if (st === 'fail' && p.carry && j.type !== 'eat') dropCarry(w, p);
    if (j.type === 'eat' && st === 'fail' && p.carry) dropCarry(w, p);
    if (j.type === 'dobill' && st === 'fail') { const held = j.data?.held || []; for (const it of held) placeItem(w, it, p.x, p.y); }
    if (j.type === 'rescue' && j.data?.carrying) { const pt = w.pawns.get(j.data.carrying); if (pt && pt.carriedBy === p.id) pt.carriedBy = undefined; }
    const b = j.t ? w.buildings.get(j.t) : undefined;
    if (b?.users) b.users = b.users.filter(u => u !== p.id);
  }
  if (j && st === 'fail' && !j.forced) {
    if (j.t) w.markFailed('t' + j.t, p.id);
    if (j.c !== undefined) w.markFailed('c' + j.c, p.id);
    if (j.t2) w.markFailed('t' + j.t2, p.id, 300);
  }
  w.releaseAll(p.id);
  p.asleep = false;
  p.warm = 0; p.burst = 0;
  p.job = p.queue.shift() || null;
  if (!p.job) stopMoving(p);
  if (st === 'fail') p.idleT = w.tick + 30;
}

export function assignJob(w: World, p: Pawn, j: Job, clearQueue = true) {
  if (p.job) endJob(w, p, 'done');
  if (clearQueue) p.queue = [];
  p.job = j;
  p.idleT = 0;
}

export function pawnTick(w: World, p: Pawn) {
  if (p.dead) return;
  if (p.carriedBy) {
    const c = w.pawns.get(p.carriedBy);
    if (!c || c.dead || c.downed || !c.job || (c.job.type !== 'rescue' && c.job.type !== 'carry_off')) p.carriedBy = undefined;
    else return;
  }
  if (p.cd > 0) p.cd--;
  if ((w.tick + p.id) % NEEDS_INTERVAL === 0) needsTick(w, p);
  if ((w.tick + p.id * 7) % HEALTH_INTERVAL === 0) { healthTick(w, p); if (p.dead) return; }
  if ((w.tick + p.id) % 250 === 0) { socialTick(w, p); if (isAnimal(p)) animalProducts(w, p); }
  if (p.bubble && p.bubble.t < w.tick) p.bubble = undefined;
  if (p.downed) {
    if (p.mp > 0) p.mp = 0;
    if (p.job && p.job.type === 'rest') { const st = DRIVERS.rest.tick(w, p, p.job); if (st !== 'ongoing') p.job = null; }
    else if (p.job) p.job = null;
    return;
  }
  if (p.stun && p.stun > 0) { p.stun--; return; }
  if (p.job) {
    const d = DRIVERS[p.job.type];
    let st: Status = d ? d.tick(w, p, p.job) : 'fail';
    if (p.job && p.job.expire && w.tick > p.job.expire) st = 'done';
    if (st !== 'ongoing' && p.job) endJob(w, p, st);
    if ((w.tick + p.id) % 45 === 0 && !p.dead) interrupts(w, p);
  } else if (p.mp > 0) step(w, p);
  if (!p.job && !p.dead && !p.downed && (!p.idleT || w.tick >= p.idleT)) {
    think(w, p);
    if (!p.job) { p.idleT = w.tick + 60 + (p.id % 30); }
  }
}

function interrupts(w: World, p: Pawn) {
  const j = p.job;
  if (!j) return;
  if (p.race === 'human' && w.isColonist(p) && !p.drafted && !p.mental) {
    if (j.type === 'flee' || j.type === 'attack' || j.type === 'rescue' || j.type === 'tend' || j.forced) return;
    const enemy = findEnemy(w, p, 7, true);
    if (enemy && dist(p.x, p.y, enemy.x, enemy.y) < 7) {
      if (dist(p.x, p.y, enemy.x, enemy.y) <= 1.5 && !p.disabled.includes('hunt')) { assignJob(w, p, mkJob('attack', { t: enemy.id, expire: w.tick + 600 })); return; }
      const fleeCell = findFleeCell(w, p, enemy.x, enemy.y);
      if (fleeCell >= 0) { assignJob(w, p, mkJob('flee', { c: fleeCell, expire: w.tick + 900 })); p.fleeing = true; if (w.rng.chance(0.3)) w.text(p.x, p.y - 1, 'fleeing!', '#ffd24a'); }
      return;
    }
    // critical need interrupts
    if (p.needs.food < 0.05 && j.type !== 'eat' && j.type !== 'sleep') { endJob(w, p, 'done'); return; }
    if (needsTending(p) && isSeriouslyHurt(p) && j.type !== 'rest' && j.type !== 'eat') { endJob(w, p, 'done'); return; }
  }
  if (isAnimal(p) && !p.animal?.tamed && j.type !== 'flee' && j.type !== 'attack') {
    // wild animals flee from nearby hostile fights / hunters
    if (p.fleeing) { const fc = findFleeCell(w, p, p.x + 1, p.y); if (fc >= 0) assignJob(w, p, mkJob('flee', { c: fc, expire: w.tick + 600 })); }
  }
}

export function findFleeCell(w: World, p: Pawn, fx: number, fy: number): number {
  const m = w.map;
  const ang = Math.atan2(p.y - fy, p.x - fx);
  for (let k = 0; k < 12; k++) {
    const a = ang + w.rng.range(-0.9, 0.9);
    const d = w.rng.range(8, 16);
    const x = Math.round(p.x + Math.cos(a) * d), y = Math.round(p.y + Math.sin(a) * d);
    if (!m.inb(x, y)) continue;
    const i = m.idx(x, y);
    if (m.passable(i) && m.connected(m.idx(p.x, p.y), i, false)) return i;
  }
  return -1;
}

export function think(w: World, p: Pawn) {
  if (p.race !== 'human') { animalThink(w, p); return; }
  if (p.lord) { const j = lordPawnThink(w, p); if (j) assignJob(w, p, j); return; }
  if (p.guest?.prisoner) { prisonerThink(w, p); return; }
  if (!w.isPlayerFaction(p.faction)) { const j = wanderJob(w, p, 6); if (j) assignJob(w, p, j); return; }
  if (p.mental) { mentalThink(w, p); return; }
  if (p.exitMap) { assignJob(w, p, mkJob('exit', { c: randomEdgeCell(w, p) })); return; }
  if (p.drafted) { draftedThink(w, p); return; }
  // bed rest for injured
  if (needsBedRest(p) && (needsTending(p) || isSeriouslyHurt(p) || p.hediffs.some(h => h.type === 'disease'))) {
    const bed = findBedFor(w, p, p.faction);
    if (bed) { w.reserve('t' + bed.id, p.id); assignJob(w, p, mkJob('rest', { t: bed.id })); return; }
  }
  const hour = Math.floor(w.hour);
  const sched = p.schedule[hour] || 'A';
  if (p.needs.food < 0.28) { const j = eatJob(w, p); if (j) { assignJob(w, p, j); return; } }
  if (p.needs.rest < 0.12 || (sched === 'S' && p.needs.rest < 0.92)) { assignJob(w, p, sleepJob(w, p)); return; }
  if (sched === 'J' && p.needs.joy < 0.95) { const j = joyJob(w, p); if (j) { assignJob(w, p, j); return; } }
  if (sched === 'A') {
    if (p.needs.rest < 0.3) { assignJob(w, p, sleepJob(w, p)); return; }
    if (p.needs.joy < 0.35) { const j = joyJob(w, p); if (j) { assignJob(w, p, j); return; } }
  }
  if (p.needs.food < 0.35) { const j = eatJob(w, p); if (j) { assignJob(w, p, j); return; } }
  // self-tend when no doctors
  // gear optimization
  if ((w.tick + p.id * 13) % 1500 < 60) { const j = gearJob(w, p); if (j) { assignJob(w, p, j); return; } }
  if (sched !== 'J') {
    const job = findWork(w, p);
    if (job) { assignJob(w, p, job); return; }
  }
  if (p.needs.joy < 0.9) { const j = joyJob(w, p); if (j) { assignJob(w, p, j); return; } }
  const j = wanderJob(w, p, 8);
  if (j) { j.count = 200; assignJob(w, p, j); }
}

export function eatJob(w: World, p: Pawn): Job | null {
  const food = findFood(w, p);
  if (!food) return null;
  w.reserve('t' + food.id, p.id);
  return mkJob('eat', { t: food.id });
}

export function sleepJob(w: World, p: Pawn): Job {
  let bed: Building | undefined = p.bed ? w.buildings.get(p.bed) : undefined;
  if (bed && !w.map.connected(w.map.idx(p.x, p.y), w.map.idx(bed.x, bed.y))) bed = undefined;
  if (!bed) {
    // claim an unowned bed
    for (const b of w.buildings.values()) {
      const d = BUILDINGS[b.def];
      if (!d.bed || b.faction !== p.faction || d.bed.medical || b.medical || b.prison) continue;
      if ((b.owners || []).length >= d.bed.sleepers) continue;
      if (!w.map.connected(w.map.idx(p.x, p.y), w.map.idx(b.x, b.y))) continue;
      assignBed(w, p, b); bed = b; break;
    }
  }
  if (bed) return mkJob('sleep', { t: bed.id });
  // sleep on ground: prefer roofed cell nearby
  const m = w.map;
  const c = bfsNearest(w, p.x, p.y, i => !!m.roof[i] && !m.bld[i] && !m.pawns[i]?.length, 20);
  return mkJob('sleep', { c: c >= 0 ? c : m.idx(p.x, p.y) });
}

export function assignBed(w: World, p: Pawn, b: Building) {
  if (p.bed) { const old = w.buildings.get(p.bed); if (old?.owners) old.owners = old.owners.filter(o => o !== p.id); }
  b.owners = b.owners || [];
  if (!b.owners.includes(p.id)) b.owners.push(p.id);
  p.bed = b.id;
}

export function joyJob(w: World, p: Pawn): Job | null {
  const m = w.map;
  const opts: { j: Job; wgt: number }[] = [];
  for (const b of w.buildings.values()) {
    const d = BUILDINGS[b.def];
    if (!d.joy || b.faction !== p.faction) continue;
    if (d.power && !b.powered) continue;
    if ((b.users || []).length >= (d.joy.users || 1)) continue;
    if (dist2(p.x, p.y, b.x, b.y) > 50 * 50) continue;
    if (!m.connected(m.idx(p.x, p.y), m.idx(b.x, b.y))) continue;
    if (d.joyTV) {
      // stand in front of TV
      const [fx, fy] = b.rot === 0 ? [0, 2] : b.rot === 1 ? [2, 0] : b.rot === 2 ? [0, -2] : [-2, 0];
      const cx = b.x + fx + w.rng.int(-1, 1), cy = b.y + fy;
      if (m.inb(cx, cy) && m.passable(m.idx(cx, cy))) opts.push({ j: mkJob('joy', { t: b.id, c: m.idx(cx, cy), data: { kind: 'tv' } }), wgt: 3 });
      continue;
    }
    opts.push({ j: mkJob('joy', { t: b.id, data: { kind: 'building' } }), wgt: 3 * d.joy.rate });
  }
  const i = m.idx(p.x, p.y);
  if (!m.roof[i] && w.weather.cur !== 'rain' && w.weather.cur !== 'thunderstorm' && w.weather.cur !== 'snow') {
    opts.push({ j: mkJob('joy', { c: i, data: { kind: 'sky' }, count: 1500 }), wgt: 1 });
  }
  const beer = [...w.items.values()].find(it => it.def === 'beer' && !it.forbidden && itemAccessible(w, p, it) && w.canReserve('t' + it.id, p.id));
  if (beer && p.needs.joy < 0.6) opts.push({ j: mkJob('eat', { t: beer.id }), wgt: 1.5 });
  const walk = wanderJob(w, p, 14);
  if (walk) { walk.data = { joy: true }; walk.count = 400; walk.type = 'wander'; opts.push({ j: walk, wgt: 1 }); }
  if (!opts.length) return null;
  const pick = w.rng.weighted(opts, o => o.wgt).j;
  if (pick.type === 'eat' && pick.t) w.reserve('t' + pick.t, p.id);
  return pick;
}

/** idle colonists drift around their colony instead of random-walking across the map */
function homeAnchor(w: World, p: Pawn): [number, number] | null {
  if (p.race !== 'human' || !w.isPlayerFaction(p.faction)) return null;
  const pl = w.playerByFaction(p.faction);
  return pl && pl.startX !== undefined ? [pl.startX, pl.startY!] : null;
}

export function wanderJob(w: World, p: Pawn, r: number, cx?: number, cy?: number): Job | null {
  const m = w.map;
  let ox = cx ?? p.x, oy = cy ?? p.y;
  const home = cx === undefined ? homeAnchor(w, p) : null;
  const leash = 22;
  if (home && dist2(p.x, p.y, home[0], home[1]) > leash * leash) { ox = home[0]; oy = home[1]; r = Math.min(r, 8); }
  for (let k = 0; k < 10; k++) {
    const x = ox + w.rng.int(-r, r), y = oy + w.rng.int(-r, r);
    if (!m.inb(x, y)) continue;
    if (home && k < 8 && dist2(x, y, home[0], home[1]) > leash * leash) continue;
    const i = m.idx(x, y);
    if (!m.passable(i) || m.fire[i] || m.isWater(i)) continue;
    if (!m.maybeReachable(m.idx(p.x, p.y), x, y, false, 1, 1, p.faction === 0 && p.race !== 'human')) continue;
    return mkJob('wander', { c: i, count: w.rng.int(60, 240) });
  }
  return mkJob('wait', { count: 60 });
}

function gearJob(w: World, p: Pawn): Job | null {
  // wear apparel if missing torso/legs coverage, or if too cold and a warmer outer layer is available
  const covered = new Set<string>();
  for (const a of p.apparel) for (const c of ITEMS[a.def].apparel!.cover) covered.add(c);
  const [lo] = comfyTemp(p);
  const cold = (p.temp ?? 20) < lo + 2;
  let best: any = null, bestS = 0;
  for (const it of w.items.values()) {
    const d = ITEMS[it.def];
    if (!d.apparel || it.forbidden || it.tainted) continue;
    if (!itemAccessible(w, p, it) || !w.canReserve('t' + it.id, p.id)) continue;
    let s = 0;
    if (d.apparel.cover.includes('torso') && !covered.has('torso')) s += 10;
    if (d.apparel.cover.includes('legs') && !covered.has('legs')) s += 10;
    if (cold && d.apparel.layers.includes('outer') && !p.apparel.some(a => ITEMS[a.def].apparel!.layers.includes('outer'))) s += 6 + d.apparel.insCold / 10;
    if (d.apparel.layers.includes('head') && !p.apparel.some(a => ITEMS[a.def].apparel!.layers.includes('head'))) s += (d.apparel.armorSharp > 0.3 ? 4 : 1);
    if (d.apparel.armorSharp > 0.5 && !p.apparel.some(a => ITEMS[a.def].apparel!.armorSharp > 0.5 && ITEMS[a.def].apparel!.layers.some(l => d.apparel!.layers.includes(l)))) s += 5;
    // replace tattered
    const same = p.apparel.find(a => ITEMS[a.def].apparel!.layers.some(l => d.apparel!.layers.includes(l)) && ITEMS[a.def].apparel!.cover.some(c => d.apparel!.cover.includes(c)));
    if (same && same.hp < (ITEMS[same.def].hp || 150) * 0.4 && it.hp > same.hp * 1.5) s += 4;
    if (same && s < 6) s = 0;
    s -= Math.sqrt(dist2(p.x, p.y, it.x, it.y)) * 0.05;
    if (s > bestS) { bestS = s; best = it; }
  }
  if (best && bestS >= 1) { w.reserve('t' + best.id, p.id); return mkJob('wear', { t: best.id }); }
  return null;
}

function draftedThink(w: World, p: Pawn) {
  const wp = weaponOf(p);
  if (p.fireAtWill) {
    const range = wp && !wp.melee ? (wp.range || 20) * 0.95 : 1.5;
    const e = findEnemy(w, p, range, true);
    if (e) { assignJob(w, p, mkJob('attack', { t: e.id })); return; }
  }
  assignJob(w, p, mkJob('wait', { count: 40 }));
}

function prisonerThink(w: World, p: Pawn) {
  const m = w.map;
  // stay in bed-room; eat available food in room
  if (p.needs.food < 0.3) {
    const room = roomAt(w, p.x, p.y);
    const food = [...w.items.values()].find(it => ITEMS[it.def].food && ITEMS[it.def].cat === 'meal' && room && m.roomId[m.idx(it.x, it.y)] === room.id && w.canReserve('t' + it.id, p.id));
    if (food) { w.reserve('t' + food.id, p.id); assignJob(w, p, mkJob('eat', { t: food.id })); return; }
  }
  const bed = [...w.buildings.values()].find(b => b.prison && BUILDINGS[b.def].bed && (b.owners?.includes(p.id) || !(b.owners || []).length));
  if (bed && !bed.owners?.includes(p.id)) { bed.owners = [p.id]; p.bed = bed.id; }
  if (bed && (p.needs.rest < 0.4 || Math.floor(w.hour) < 6)) { assignJob(w, p, mkJob('sleep', { t: bed.id })); return; }
  if (p.guest?.mode === 'release') {
    p.guest = null; p.exitMap = true; p.lord = 0;
    w.letter(w.faction(p.faction)?.kind === 'player' ? p.faction : 10, 'Prisoner released', `${pawnShortName(p)} was released.`, 'neutral');
    assignJob(w, p, mkJob('exit', { c: randomEdgeCell(w, p) }));
    return;
  }
  const room = roomAt(w, p.x, p.y);
  if (room && !room.outdoors) {
    const x = Math.round(room.x0 + w.rng.f() * (room.x1 - room.x0)), y = Math.round(room.y0 + w.rng.f() * (room.y1 - room.y0));
    const i = m.idx(x, y);
    if (m.roomId[i] === room.id && m.passable(i)) { assignJob(w, p, mkJob('wander', { c: i, count: 300 })); return; }
  }
  assignJob(w, p, mkJob('wait', { count: 200 }));
}

function mentalThink(w: World, p: Pawn) {
  const k = p.mental!.kind;
  if (k === 'berserk') {
    const e = findEnemyAny(w, p, 30);
    if (e) { assignJob(w, p, mkJob('attack', { t: e.id, data: { close: true } })); return; }
  } else if (k === 'tantrum') {
    const targets = [...w.buildings.values()].filter(b => b.faction === p.faction && !BUILDINGS[b.def].conduit && dist2(p.x, p.y, b.x, b.y) < 400);
    if (targets.length) { const t = w.rng.pick(targets); assignJob(w, p, mkJob('attack', { t: t.id, expire: w.tick + 600 })); return; }
  } else if (k === 'food_binge') {
    const j = eatJob(w, p);
    if (j) { assignJob(w, p, j); return; }
  } else if (k === 'give_up') {
    assignJob(w, p, mkJob('exit', { c: randomEdgeCell(w, p) }));
    return;
  } else if (k === 'hide_room') {
    const bed = p.bed ? w.buildings.get(p.bed) : undefined;
    if (bed && dist(p.x, p.y, bed.x, bed.y) > 2) { assignJob(w, p, mkJob('goto', { c: w.map.idx(bed.x, bed.y) })); return; }
    assignJob(w, p, mkJob('wait', { count: 300 })); return;
  }
  const j = wanderJob(w, p, 12);
  if (j) assignJob(w, p, j);
}
function findEnemyAny(w: World, p: Pawn, r: number): Pawn | null {
  let best: Pawn | null = null, bd = r * r;
  for (const o of w.pawns.values()) {
    if (o.id === p.id || o.dead || o.downed) continue;
    const d = dist2(p.x, p.y, o.x, o.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

// ---------------- animals ----------------
function animalThink(w: World, p: Pawn) {
  const ad = ANIMALS[p.race];
  if (!ad) return;
  if (p.lord) { const j = lordPawnThink(w, p); if (j) assignJob(w, p, j); return; }
  const m = w.map;
  const manhunter = (p.animal?.manhunter || 0) > w.tick;
  const here = m.idx(p.x, p.y), wild = p.faction === 0;
  const canReach = (o: Pawn) => m.maybeReachable(here, o.x, o.y, true, 1, 1, wild);
  if (manhunter || (p.target && !p.fleeing && ad.predator)) {
    const t = p.target ? w.pawns.get(p.target) : null;
    let e = t && !t.dead && !t.downed && canReach(t) ? t : null;
    if (!e) {
      let bd = 60 * 60;
      for (const o of w.pawns.values()) {
        if (o.dead || o.downed || o.id === p.id) continue;
        if (!pawnHostileTo(w, p, o) || !canReach(o)) continue;
        const d = dist2(p.x, p.y, o.x, o.y);
        if (d < bd) { bd = d; e = o; }
      }
    }
    if (e) { p.target = e.id; assignJob(w, p, mkJob('attack', { t: e.id, expire: w.tick + 900 })); return; }
    if (!manhunter) p.target = 0;
  }
  if (p.fleeing && p.target) {
    const t = w.pawns.get(p.target);
    if (t && !t.dead) {
      const fc = findFleeCell(w, p, t.x, t.y);
      p.fleeing = false;
      if (fc >= 0) { assignJob(w, p, mkJob('flee', { c: fc, expire: w.tick + 600 })); return; }
    }
    p.fleeing = false;
  }
  // sleep at night
  const h = w.hour;
  if (p.needs.rest < 0.2 || ((h < 5 || h > 22) && p.needs.rest < 0.7)) { assignJob(w, p, mkJob('sleep', { c: m.idx(p.x, p.y) })); return; }
  if (p.needs.food < 0.4) {
    if (ad.predator || ad.diet === 'carnivore') {
      const food = findFood(w, p);
      if (food && dist2(p.x, p.y, food.x, food.y) < 40 * 40) { w.reserve('t' + food.id, p.id); assignJob(w, p, mkJob('eat', { t: food.id })); return; }
      if (ad.predator && p.needs.food < 0.25 && !p.animal?.tamed) {
        // hunt prey: animals first; people only when starving, rarely, and never early in the game
        let prey: Pawn | null = null, bd = 40 * 40;
        for (const o of w.pawns.values()) {
          if (o.dead || o.id === p.id || o.race === p.race || o.race === 'human' || !isAnimal(o) || o.animal?.tamed && w.day < 5) continue;
          if (bodySize(o) > bodySize(p) * 1.2) continue;
          const d = dist2(p.x, p.y, o.x, o.y);
          if (d < bd && canReach(o)) { bd = d; prey = o; }
        }
        if (!prey && p.needs.food < 0.06 && w.day >= 4 && w.rng.chance(0.08)) {
          let bh = 30 * 30;
          for (const o of w.pawns.values()) {
            if (o.dead || o.race !== 'human' || o.lord) continue;
            const d = dist2(p.x, p.y, o.x, o.y);
            if (d < bh && canReach(o)) { bh = d; prey = o; }
          }
        }
        if (!prey && p.needs.food < 0.1) { p.needs.food = 0.35; }
        if (prey) {
          p.target = prey.id;
          if (prey.race === 'human' && w.isColonist(prey)) w.letter(prey.faction, 'Predator hunting', `A hungry ${ad.label} is hunting ${pawnShortName(prey)}!`, 'bad', p.x, p.y, p.id);
          assignJob(w, p, mkJob('attack', { t: prey.id, data: { kill: true }, expire: w.tick + 1500 }));
          return;
        }
      }
    } else {
      if (p.animal?.tamed) {
        const food = findFood(w, p);
        if (food && dist2(p.x, p.y, food.x, food.y) < 50 * 50) { w.reserve('t' + food.id, p.id); assignJob(w, p, mkJob('eat', { t: food.id })); return; }
      }
      const c = bfsNearest(w, p.x, p.y, i => { const pl = m.plant[i]; return !!pl && PLANTS[pl].nutrition > 0.1 && m.growth[i] > 0.25 && PLANTS[pl].kind !== 'tree' && !(m.zone[i] && w.zones.get(m.zone[i])?.kind === 'grow' && p.animal?.tamed) && w.canReserve('c' + i, p.id); }, 20);
      if (c >= 0) { w.reserve('c' + c, p.id); assignJob(w, p, mkJob('graze', { c })); return; }
    }
  }
  // tamed: stay near colony; follow master sometimes
  if (p.animal?.tamed) {
    const master = p.animal.master ? w.pawns.get(p.animal.master) : null;
    if (master && !master.dead && w.rng.chance(0.3) && dist(p.x, p.y, master.x, master.y) > 5) {
      const j = wanderJob(w, p, 3, master.x, master.y);
      if (j) { assignJob(w, p, j); return; }
    }
    const pl = w.playerByFaction(p.faction);
    const j = wanderJob(w, p, 10, pl?.startX, pl?.startY);
    if (j) { assignJob(w, p, j); return; }
  }
  const j = wanderJob(w, p, 8);
  if (j) assignJob(w, p, j);
}

function animalProducts(w: World, p: Pawn) {
  const ad = ANIMALS[p.race];
  if (!ad?.products || !p.animal?.tamed || p.gender !== 'f' && ad.products.some(pr => pr.kind !== 'wool')) {
    if (!(ad?.products?.some(pr => pr.kind === 'wool') && p.animal?.tamed)) return;
  }
  const dt = 250 / TICKS_PER_DAY;
  for (const pr of ad.products) {
    if (pr.kind !== 'wool' && p.gender !== 'f') continue;
    const cur = p.animal!.products[pr.kind] || 0;
    const nv = Math.min(1, cur + dt / pr.days);
    p.animal!.products[pr.kind] = nv;
    if (pr.kind === 'eggs' && nv >= 1) {
      p.animal!.products[pr.kind] = 0;
      placeItem(w, makeItem(w, pr.item, pr.count, { owner: p.faction }), p.x, p.y);
    }
  }
}

export { isMech, lineOfSight, insulation };
