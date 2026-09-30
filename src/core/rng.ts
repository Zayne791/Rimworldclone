// Seedable, serializable PRNG (sfc32). All simulation randomness goes through this.
export class Rng {
  a: number; b: number; c: number; d: number;
  constructor(seed: number | string = 12345) {
    let h = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    this.a = 0x9e3779b9; this.b = 0x243f6a88; this.c = 0xb7e15162; this.d = h ^ 0xdeadbeef;
    for (let i = 0; i < 16; i++) this.next();
  }
  next(): number {
    let a = this.a >>> 0, b = this.b >>> 0, c = this.c >>> 0, d = this.d >>> 0;
    const t = (((a + b) >>> 0) + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) >>> 0;
    this.a = a; this.b = b; this.c = c; this.d = d;
    return t / 4294967296;
  }
  /** float in [0,1) */
  f(): number { return this.next(); }
  range(min: number, max: number): number { return min + this.next() * (max - min); }
  /** int in [min, max] inclusive */
  int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
  weighted<T>(items: readonly T[], weight: (t: T) => number): T {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    let r = this.next() * total;
    for (const it of items) { r -= Math.max(0, weight(it)); if (r <= 0) return it; }
    return items[items.length - 1];
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
  gauss(mean = 0, sd = 1): number {
    const u = 1 - this.next(), v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  /** Mean-time-between check: true on average once per `mtb` calls. */
  mtb(mtb: number): boolean { return mtb <= 0 ? true : this.next() < 1 / mtb; }
  state(): number[] { return [this.a, this.b, this.c, this.d]; }
  setState(s: number[]) { [this.a, this.b, this.c, this.d] = s; }
}

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Stateless integer hash -> [0,1). Useful for per-tile visual variation. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}
export function hash1(x: number, seed = 0): number { return hash2(x, 0x5bd1e995, seed); }
