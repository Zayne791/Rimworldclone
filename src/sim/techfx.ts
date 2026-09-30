// Passive research effects ("techs"): colony-wide bonuses summed from finished projects.
// Stat functions that only get a Pawn read the currently bound world (bound by simTick and the
// renderer frame), so this module must stay free of sim imports to avoid cycles.
import type { World } from './world';
import { RESEARCH } from '../data/research';

let W: World | null = null;
export function bindFx(w: World) { W = w; }
export function boundWorld() { return W; }

interface FxCache { n: number; fx: Record<string, number> }

function table(w: World, faction: number): Record<string, number> | null {
  const rs = w.research[faction];
  if (!rs || !rs.done.length) return null;
  const cache = (w._cache.resFx ||= new Map<number, FxCache>()) as Map<number, FxCache>;
  let c = cache.get(faction);
  if (!c || c.n !== rs.done.length) {
    const fx: Record<string, number> = {};
    for (const id of rs.done) {
      const e = RESEARCH[id]?.effects;
      if (e) for (const k in e) fx[k] = (fx[k] || 0) + (e as any)[k];
    }
    c = { n: rs.done.length, fx };
    cache.set(faction, c);
  }
  return c.fx;
}

/** summed effect value for a faction in the given world (0 when none) */
export function fxw(w: World, faction: number, key: string): number {
  const t = table(w, faction);
  return t ? t[key] || 0 : 0;
}
/** summed effect value in the bound world */
export function fx(faction: number, key: string): number {
  return W ? fxw(W, faction, key) : 0;
}
/** multiplier helpers: 1 + bonus, and 1 - reduction (never below 0.05) */
export const fxMul = (faction: number, key: string) => 1 + fx(faction, key);
export const fxRed = (faction: number, key: string) => Math.max(0.05, 1 - fx(faction, key));
export const fxwMul = (w: World, faction: number, key: string) => 1 + fxw(w, faction, key);
export const fxwRed = (w: World, faction: number, key: string) => Math.max(0.05, 1 - fxw(w, faction, key));
