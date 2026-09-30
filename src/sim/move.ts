// Pawn movement along paths, door handling, bashing obstacles.
import type { World } from './world';
import type { Pawn } from './types';
import { findPath, pathOptsFor, BASE_COST, PATH_STATS } from './path';
import { IMPASSABLE } from './map';
import { moveSpeed } from './stats';
import { BUILDINGS } from '../data/buildings';
import { WEATHERS } from './environment';
import { meleeAttack } from './combat';
import { applyDamage } from './health';
import { destroyBuilding } from './construction';

export type MoveResult = 'arrived' | 'moving' | 'fail';

export function atGoal(p: Pawn, x: number, y: number, touch: boolean, tw = 1, th = 1): boolean {
  if (!touch) return p.x === x && p.y === y;
  const dx = p.x < x ? x - p.x : p.x > x + tw - 1 ? p.x - (x + tw - 1) : 0;
  const dy = p.y < y ? y - p.y : p.y > y + th - 1 ? p.y - (y + th - 1) : 0;
  return dx <= 1 && dy <= 1;
}

function speedOf(w: World, p: Pawn): number {
  const c = p as any;
  if (c._spdT === undefined || w.tick - c._spdT > 90) { c._spd = moveSpeed(p) * (WEATHERS[w.weather.cur]?.move ?? 1); c._spdT = w.tick; }
  return c._spd;
}

export function stopMoving(p: Pawn) { p.path = null; p.pi = 0; (p as any)._pk = undefined; }

/** Move pawn toward target. Call every tick from job drivers. */
export function moveTo(w: World, p: Pawn, x: number, y: number, touch = false, tw = 1, th = 1): MoveResult {
  if (p.mp === 0 && atGoal(p, x, y, touch, tw, th)) { stopMoving(p); return 'arrived'; }
  const key = ((x * 4096 + y) * 2 + (touch ? 1 : 0)) * 64 + tw * 8 + th;
  const c = p as any;
  if (p.mp === 0 && (!p.path || c._pk !== key || p.pi >= p.path.length)) {
    if (c._pathFailT && c._pk === key && w.tick - c._pathFailT < 120) return 'fail';
    const path = findPath(w, p.x, p.y, x, y, pathOptsFor(w, p), touch, tw, th);
    c._pk = key;
    if (!path) { c._pathFailT = w.tick; p.path = null; if (PATH_STATS.failBy) { const k = `${p.race}${p.faction >= 10 ? '(col)' : ''}:${p.job?.type}${p.lord ? ':lord' : ''}`; PATH_STATS.failBy[k] = (PATH_STATS.failBy[k] || 0) + 1; } return 'fail'; }
    c._pathFailT = 0;
    p.path = path; p.pi = 0;
    if (!path.length) return 'arrived';
  }
  const r = step(w, p);
  if (r === 'fail') { p.path = null; c._pk = undefined; return 'fail'; }
  return 'moving';
}

/** advance movement one tick; returns 'fail' if path is blocked and cannot bash */
export function step(w: World, p: Pawn): 'ok' | 'fail' {
  const m = w.map;
  if (p.mp === 0) {
    if (!p.path || p.pi >= p.path.length) return 'ok';
    const ni = p.path[p.pi];
    const nx = ni % m.w, ny = (ni / m.w) | 0;
    // obstacle checks
    if (m.cost[ni] === IMPASSABLE) {
      const bid = m.bld[ni];
      const opts = pathOptsFor(w, p);
      if (bid && opts.bash) {
        const b = w.buildings.get(bid);
        if (b && !BUILDINGS[b.def].natural) { if (p.cd <= 0) meleeAttack(w, p, b); return 'ok'; }
      }
      p.path = null;
      return 'ok'; // will repath next tick
    }
    const did = m.door[ni];
    if (did) {
      const d = w.buildings.get(did);
      if (d && d.faction !== p.faction && !w.allied(d.faction, p.faction)) {
        const hostile = w.hostile(d.faction, p.faction) || p.mental?.kind === 'berserk';
        if (hostile) { if (p.cd <= 0) meleeAttack(w, p, d); return 'ok'; }
        if (p.race !== 'human') { p.path = null; return 'fail'; }
      }
      if (d) { d.open = d.def === 'autodoor' ? 40 : 70; m.updateCost(ni); }
    }
    p.nx = nx; p.ny = ny;
    const dx = nx - p.x, dy = ny - p.y;
    p.rot = dx > 0 ? 1 : dx < 0 ? 3 : dy > 0 ? 0 : 2;
    (p as any)._stepT = (60 / speedOf(w, p)) * ((BASE_COST + m.cost[ni]) / BASE_COST) * (dx && dy ? 1.414 : 1) * (did ? (w.buildings.get(did)?.powered ? 0.6 : 1.3) : 1);
  }
  const stepT = (p as any)._stepT || 13;
  p.mp += 1 / stepT;
  if (p.mp >= 1) {
    p.mp = 0;
    w.movePawnCell(p, p.nx, p.ny);
    p.pi++;
    onEnterCell(w, p);
  }
  return 'ok';
}

function onEnterCell(w: World, p: Pawn) {
  const m = w.map;
  const i = m.idx(p.x, p.y);
  const bid = m.bld[i];
  if (bid) {
    const b = w.buildings.get(bid);
    if (b) {
      const d = BUILDINGS[b.def];
      if (d.isDoor) b.open = d.id === 'autodoor' ? 40 : 70;
      if (d.trap && b.armed && w.hostile(b.faction, p.faction) && !p.dead) {
        b.armed = false;
        applyDamage(w, p, { amount: d.trap.damage * (0.7 + w.rng.f() * 0.6), type: 'stab', pen: 0.3, group: 'legs' });
        w.sound('trap', p.x, p.y);
        b.hp = 0;
        destroyBuilding(w, b, 'destroyed');
      }
    }
  }
  // track dirt indoors
  if (p.race === 'human' && m.roof[i] && m.floor[i] && w.rng.chance(0.004)) m.addFilth(p.x, p.y, 1, 8);
  if (p.race !== 'human' && p.animal?.tamed && m.roof[i] && w.rng.chance(0.01)) m.addFilth(p.x, p.y, 6, 10);
}

/** tick doors (close when unused) */
export function doorTick(w: World, dt = 1) {
  const doors = (w._cache.doors ||= { v: -1, ids: [] as number[] });
  if (doors.v !== w._cache.buildingsVersion) { doors.v = w._cache.buildingsVersion; doors.ids = [...w.buildings.values()].filter(b => BUILDINGS[b.def].isDoor).map(b => b.id); }
  for (const id of doors.ids) {
    const b = w.buildings.get(id);
    if (!b || !b.open) continue;
    const i = w.map.idx(b.x, b.y);
    if (w.map.pawns[i]?.length) { b.open = Math.max(b.open, 10); continue; }
    if (b.holdOpen) continue;
    b.open -= dt;
    if (b.open <= 0) { b.open = 0; w.map.updateCost(i); }
  }
}
