// Binary min-heap keyed by float priority, storing int values. Allocation-free after warmup.
export class MinHeap {
  vals: Int32Array; pri: Float32Array; size = 0;
  constructor(cap = 1024) { this.vals = new Int32Array(cap); this.pri = new Float32Array(cap); }
  clear() { this.size = 0; }
  push(v: number, p: number) {
    if (this.size >= this.vals.length) {
      const nv = new Int32Array(this.vals.length * 2); nv.set(this.vals); this.vals = nv;
      const np = new Float32Array(this.pri.length * 2); np.set(this.pri); this.pri = np;
    }
    let i = this.size++;
    const vals = this.vals, pri = this.pri;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (pri[par] <= p) break;
      vals[i] = vals[par]; pri[i] = pri[par]; i = par;
    }
    vals[i] = v; pri[i] = p;
  }
  pop(): number {
    const vals = this.vals, pri = this.pri;
    const top = vals[0];
    const n = --this.size;
    if (n > 0) {
      const v = vals[n], p = pri[n];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && pri[c + 1] < pri[c]) c++;
        if (pri[c] >= p) break;
        vals[i] = vals[c]; pri[i] = pri[c]; i = c;
      }
      vals[i] = v; pri[i] = p;
    }
    return top;
  }
}
