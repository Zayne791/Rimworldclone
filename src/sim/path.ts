import { MinHeap } from '../core/heap';
import { IMPASSABLE } from './map';
import type { World } from './world';
import type { Pawn } from './types';
import { BUILDINGS } from '../data/buildings';

export const BASE_COST = 13; // ticks per cardinal step at speed 1

export interface PathOpts {
  bash?: boolean;         // may path through hostile doors/walls (raiders)
  faction: number;
  animal?: boolean;
  humanlike?: boolean;
  maxNodes?: number;
  avoidFire?: boolean;
}

let gScore: Float32Array, parent: Int32Array, stamp: Uint32Array, closed: Uint32Array;
let gen = 1;
const heap = new MinHeap(4096);

function ensure(n: number) {
  if (!gScore || gScore.length !== n) {
    gScore = new Float32Array(n); parent = new Int32Array(n); stamp = new Uint32Array(n); closed = new Uint32Array(n); gen = 1;
  }
}

export function pathOptsFor(w: World, p: Pawn): PathOpts {
  const hostileHuman = p.race === 'human' && !w.isPlayerFaction(p.faction) && w.factions.find(f => f.id === p.faction)?.kind === 'pirate';
  const mech = w.faction(p.faction)?.kind === 'mech';
  return { faction: p.faction, bash: !!(hostileHuman || mech || p.mental?.kind === 'berserk'), animal: p.race !== 'human', humanlike: p.race === 'human' };
}

/** extra traversal cost for cell i, or -1 if not traversable. */
function cellCost(w: World, i: number, o: PathOpts, wallBash: boolean): number {
  const m = w.map;
  const c = m.cost[i];
  if (c === IMPASSABLE) {
    if (!wallBash || m.rock[i]) return -1;
    const bid = m.bld[i];
    if (!bid) return -1;
    const b = w.buildings.get(bid);
    if (!b) return -1;
    if (BUILDINGS[b.def].natural) return -1;
    return 60 + b.hp * 0.5;
  }
  const did = m.door[i];
  if (did) {
    const d = w.buildings.get(did);
    if (d && d.faction !== o.faction && !w.allied(d.faction, o.faction)) {
      const hostile = w.hostile(d.faction, o.faction);
      if (o.animal && !o.bash) return -1;
      if (hostile) { if (!o.bash) return -1; return c + 80 + d.hp * 0.3; }
      if (!o.humanlike) return -1;
    }
  }
  if (o.avoidFire && m.fire[i]) return c + 200;
  return c;
}

/**
 * A* from (sx,sy) to goal. goal can be exact cell, or touch mode (reach any cell adjacent to target rect).
 * Returns list of cell indices (excluding start) or null.
 */
/** debug counters (cheap; read by tests) */
export const PATH_STATS: { calls: number; fails: number; nodes: number; failBy?: Record<string, number> } = { calls: 0, fails: 0, nodes: 0 };

export function findPath(w: World, sx: number, sy: number, tx: number, ty: number, o: PathOpts, touch = false, tw = 1, th = 1): number[] | null {
  const m = w.map;
  const W = m.w, H = m.h;
  ensure(m.n);
  gen++;
  if (gen >= 0xfffffff0) { stamp.fill(0); closed.fill(0); gen = 1; }
  const start = sy * W + sx;
  // goal predicate
  const isGoal = (x: number, y: number) => {
    if (!touch) return x === tx && y === ty;
    // adjacent (8-way) to rect [tx..tx+tw-1] x [ty..ty+th-1], or inside it if rect cell passable
    const dx = x < tx ? tx - x : x > tx + tw - 1 ? x - (tx + tw - 1) : 0;
    const dy = y < ty ? ty - y : y > ty + th - 1 ? y - (ty + th - 1) : 0;
    return dx <= 1 && dy <= 1;
  };
  PATH_STATS.calls++;
  if (isGoal(sx, sy)) return [];
  // hopeless searches flood the whole region before failing: rule them out with the region maps first
  const reachable = m.maybeReachable(start, tx, ty, touch, tw, th, !!o.animal && o.faction === 0);
  if (!o.bash && !reachable) { PATH_STATS.fails++; return null; }
  const cx = tx + (tw - 1) / 2, cy = ty + (th - 1) / 2;
  const hFn = (x: number, y: number) => {
    const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
    return BASE_COST * (dx > dy ? dx + 0.4142 * dy : dy + 0.4142 * dx);
  };
  // walled-off goal for a wall-basher: skip the doomed no-bash pass
  for (let pass = o.bash && !reachable ? 1 : 0; pass < (o.bash ? 2 : 1); pass++) {
    const wallBash = pass === 1;
    if (pass === 1) { gen++; }
    heap.clear();
    gScore[start] = 0; parent[start] = -1; stamp[start] = gen;
    heap.push(start, hFn(sx, sy));
    let nodes = 0;
    const maxNodes = o.maxNodes ?? 60000;
    while (heap.size > 0) {
      const cur = heap.pop();
      if (closed[cur] === gen) continue;
      closed[cur] = gen;
      const x = cur % W, y = (cur / W) | 0;
      if (isGoal(x, y)) {
        const out: number[] = [];
        let c = cur;
        while (c !== start) { out.push(c); c = parent[c]; }
        out.reverse();
        return out;
      }
      if (++nodes > maxNodes) break;
      PATH_STATS.nodes++;
      const g0 = gScore[cur];
      for (let d = 0; d < 8; d++) {
        const dx = d < 4 ? (d === 0 ? 1 : d === 1 ? -1 : 0) : (d === 4 || d === 6 ? 1 : -1);
        const dy = d < 4 ? (d === 2 ? 1 : d === 3 ? -1 : 0) : (d === 4 || d === 5 ? 1 : -1);
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (closed[ni] === gen) continue;
        let cc = cellCost(w, ni, o, wallBash);
        if (cc < 0) {
          // allow stepping into goal-rect cells that are impassable? no — touch mode handles adjacency
          continue;
        }
        const diag = dx !== 0 && dy !== 0;
        if (diag) {
          // no corner cutting
          if (m.cost[y * W + nx] === IMPASSABLE || m.cost[ny * W + x] === IMPASSABLE) continue;
          if (m.door[y * W + nx] || m.door[ny * W + x] || m.door[ni]) continue;
        }
        const g = g0 + (BASE_COST + cc) * (diag ? 1.4142 : 1);
        if (stamp[ni] !== gen || g < gScore[ni]) {
          stamp[ni] = gen; gScore[ni] = g; parent[ni] = cur;
          heap.push(ni, g + hFn(nx, ny));
        }
      }
    }
  }
  PATH_STATS.fails++;
  return null;
}

/** Quick straight-line check for line of sight between cells. */
export function lineOfSight(w: World, x0: number, y0: number, x1: number, y1: number): boolean {
  const m = w.map;
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0, y = y0;
  for (;;) {
    if (!(x === x0 && y === y0) && !(x === x1 && y === y1)) {
      const i = y * m.w + x;
      if (m.rock[i]) return false;
      if (m.cost[i] === IMPASSABLE && m.bld[i]) {
        const b = w.buildings.get(m.bld[i]);
        if (b && BUILDINGS[b.def].blocksLight) return false;
      }
      if (m.door[i]) { const d = w.buildings.get(m.door[i]); if (d && !(d.open && d.open > 0)) return false; }
    }
    if (x === x1 && y === y1) return true;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

/** Find nearest cell satisfying predicate via BFS over passable cells from start. */
export function bfsNearest(w: World, sx: number, sy: number, pred: (i: number) => boolean, maxDist = 60, passableOnly = true): number {
  const m = w.map;
  ensure(m.n);
  gen++;
  const q: number[] = [m.idx(sx, sy)];
  stamp[q[0]] = gen;
  const maxD2 = maxDist * maxDist;
  let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    if (pred(cur)) return cur;
    const x = cur % m.w, y = (cur / m.w) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const ni = ny * m.w + nx;
      if (stamp[ni] === gen) continue;
      stamp[ni] = gen;
      if (passableOnly && m.cost[ni] === IMPASSABLE) continue;
      if ((nx - sx) * (nx - sx) + (ny - sy) * (ny - sy) > maxD2) continue;
      q.push(ni);
    }
  }
  return -1;
}
