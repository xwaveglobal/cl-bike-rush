/** Small deterministic PRNG (mulberry32) so runs and tests are reproducible. */
export class Rng {
  private s: number;
  constructor(seed = Date.now() >>> 0) {
    this.s = seed >>> 0;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number) {
    return a + (b - a) * this.next();
  }
  int(a: number, bInclusive: number) {
    return a + Math.floor(this.next() * (bInclusive - a + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p: number) {
    return this.next() < p;
  }
  weighted<T>(items: readonly { w: number; v: T }[]): T {
    let total = 0;
    for (const i of items) total += Math.max(0, i.w);
    let r = this.next() * total;
    for (const i of items) {
      r -= Math.max(0, i.w);
      if (r <= 0) return i.v;
    }
    return items[items.length - 1].v;
  }
}
