// Group AI ("lords"): raiders assaulting, traders visiting, visitors wandering, mechanoid clusters.
import type { World } from './world';
import type { Pawn, Job, Lord, Item } from './types';
import { mkJob, randomEdgeCell } from './jobs';
import { findEnemy, findHostileBuilding } from './combat';
import { weaponOf, isMech } from './stats';
import { dist, dist2 } from '../core/util';
import { BUILDINGS } from '../data/buildings';
import { TICKS_PER_DAY } from '../core/constants';
import { wanderJob } from './ai';
import { pawnShortName } from './things';

export function newLord(w: World, faction: number, kind: Lord['kind'], target: number, spot: [number, number]): Lord {
  const l: Lord = { id: w.newId(), faction, kind, pawns: [], target, stage: 'arrive', t: 0, spot, startCount: 0 };
  w.lords.set(l.id, l);
  return l;
}

export function lordTick(w: World, l: Lord) {
  // every 60 ticks
  l.t += 60;
  const alive = l.pawns.map(id => w.pawns.get(id)).filter((p): p is Pawn => !!p && !p.dead);
  l.pawns = alive.map(p => p.id);
  if (!alive.length) { w.lords.delete(l.id); return; }
  const up = alive.filter(p => !p.downed && !p.guest);
  if (l.kind === 'assault' || l.kind === 'mech') {
    if (l.stage === 'arrive' && (l.t > 1800 || up.some(p => findEnemy(w, p, 12, true)))) {
      l.stage = 'assault';
    }
    if (l.kind === 'assault' && l.stage === 'assault') {
      const lost = l.startCount - up.length;
      if (lost >= Math.ceil(l.startCount * 0.5) || l.t > TICKS_PER_DAY * 1.2) {
        l.stage = 'flee';
        w.letter(l.target, 'Raiders fleeing', 'The raiders have been broken and are fleeing!', 'good');
        for (const p of up) { p.job = null; p.exitMap = true; }
      }
    }
    if (l.kind === 'mech' && l.t > TICKS_PER_DAY * 3) { l.stage = 'flee'; for (const p of up) { p.job = null; p.exitMap = true; } }
  } else if (l.kind === 'trade' || l.kind === 'visit') {
    if (l.stage === 'arrive' && up.some(p => dist(p.x, p.y, l.spot[0], l.spot[1]) < 6)) { l.stage = 'wait'; l.t = 0; }
    if (l.stage === 'wait' && l.t > TICKS_PER_DAY * (l.kind === 'trade' ? 1 : 0.7)) {
      l.stage = 'leave';
      if (l.kind === 'trade') w.letter(l.target, 'Caravan leaving', `${l.traderName || 'The caravan'} is packing up and leaving.`, 'neutral');
    }
    if (l.stage === 'arrive' && l.t > TICKS_PER_DAY * 0.8) l.stage = 'wait';
    // attacked? turn hostile
    if (up.some(p => p.lastHit && w.tick - p.lastHit < 60 && p.hostileTo?.length)) {
      l.kind = 'assault'; l.stage = 'assault';
    }
  }
}

export function lordPawnThink(w: World, p: Pawn): Job | null {
  const l = w.lords.get(p.lord);
  if (!l) { p.lord = 0; return wanderJob(w, p, 5); }
  if (p.exitMap || l.stage === 'flee' || l.stage === 'leave') {
    // kidnap or steal on the way out
    if (l.kind === 'assault' && p.race === 'human' && !p.carry && w.rng.chance(0.25)) {
      const downed = [...w.pawns.values()].find(o => o.downed && !o.dead && w.isColonist(o) && !o.carriedBy && dist2(p.x, p.y, o.x, o.y) < 15 * 15);
      if (downed && w.canReserve('t' + downed.id, p.id)) { w.reserve('t' + downed.id, p.id); return mkJob('carry_off', { t: downed.id, c: randomEdgeCell(w, p) }); }
    }
    return mkJob('exit', { c: randomEdgeCell(w, p) });
  }
  if (l.kind === 'assault' || l.kind === 'mech') {
    if (l.stage === 'arrive') {
      const j = mkJob('goto', { c: w.map.idx(Math.round(l.spot[0] + w.rng.int(-3, 3)), Math.round(l.spot[1] + w.rng.int(-3, 3))), expire: w.tick + 400 });
      if (!w.map.passable(j.c!)) return mkJob('wait', { count: 60 });
      return j;
    }
    const wp = weaponOf(p);
    const range = wp && !wp.melee ? (wp.range || 20) : 20;
    const e = findEnemy(w, p, Math.max(range, 25), true) || findEnemy(w, p, 60, false);
    if (e) return mkJob('attack', { t: e.id, forced: true, expire: w.tick + 600, data: { close: isMech(p) ? false : w.rng.chance(0.3) } });
    const b = findHostileBuilding(w, p, 80);
    if (b) return mkJob('attack', { t: b.id, forced: true, expire: w.tick + 900 });
    const pl = w.playerByFaction(l.target);
    if (pl && pl.startX !== undefined) return mkJob('goto', { c: w.map.idx(pl.startX, pl.startY!), expire: w.tick + 600 });
    return wanderJob(w, p, 10);
  }
  if (l.kind === 'trade' || l.kind === 'visit') {
    if (l.stage === 'arrive') return mkJob('goto', { c: w.map.idx(l.spot[0], l.spot[1]), expire: w.tick + 1200 });
    return wanderJob(w, p, 6, l.spot[0], l.spot[1]);
  }
  return wanderJob(w, p, 6);
}

/** find edge cell connected to target area for arrivals */
export function arrivalEdge(w: World, tx: number, ty: number): [number, number] | null {
  const m = w.map;
  const ti = m.idx(tx, ty);
  for (let k = 0; k < 60; k++) {
    const side = w.rng.int(0, 3);
    const x = side === 0 ? 0 : side === 1 ? m.w - 1 : w.rng.int(0, m.w - 1);
    const y = side === 2 ? 0 : side === 3 ? m.h - 1 : w.rng.int(0, m.h - 1);
    const i = m.idx(x, y);
    if (!m.passable(i)) continue;
    if (!m.connected(i, ti, false)) continue;
    return [x, y];
  }
  return null;
}

export function spawnGroupAt(w: World, pawns: Pawn[], x: number, y: number, lord: Lord | null) {
  const m = w.map;
  for (const p of pawns) {
    let px = x, py = y;
    for (let k = 0; k < 30; k++) {
      const nx = x + w.rng.int(-3, 3), ny = y + w.rng.int(-3, 3);
      if (m.inb(nx, ny) && m.passable(m.idx(nx, ny))) { px = nx; py = ny; break; }
    }
    p.x = px; p.y = py; p.nx = px; p.ny = py;
    if (lord) { p.lord = lord.id; lord.pawns.push(p.id); }
    w.register(p);
  }
  if (lord) lord.startCount = pawns.length;
}

export function stealItems(w: World, l: Lord): Item[] { return []; }
export { pawnShortName, BUILDINGS };
