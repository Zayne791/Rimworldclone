export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sat = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export function dist(ax: number, ay: number, bx: number, by: number) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
export function dist2(ax: number, ay: number, bx: number, by: number) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function octile(ax: number, ay: number, bx: number, by: number) { const dx = Math.abs(ax - bx), dy = Math.abs(ay - by); return dx > dy ? dx + 0.4142 * dy : dy + 0.4142 * dx; }
export function round2(v: number) { return Math.round(v * 100) / 100; }
export function round3(v: number) { return Math.round(v * 1000) / 1000; }
export function pct(v: number) { return Math.round(v * 100) + '%'; }
export function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
export function fmtNum(n: number) { return n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n)); }
export function escapeHtml(s: string) { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)); }
/** Bresenham line cells from a to b (inclusive). */
export function lineCells(x0: number, y0: number, x1: number, y1: number, out: [number, number][] = []): [number, number][] {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return out;
}
export function removeFrom<T>(arr: T[], v: T): boolean { const i = arr.indexOf(v); if (i >= 0) { arr.splice(i, 1); return true; } return false; }
export function sum<T>(arr: readonly T[], f: (t: T) => number) { let s = 0; for (const a of arr) s += f(a); return s; }
export const DIRS8: readonly [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export const DIRS4: readonly [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
