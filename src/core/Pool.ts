/** Generic object pool — avoids per-spawn allocation and GPU resource churn. */
export class Pool<T> {
  private free: T[] = [];
  created = 0;
  constructor(private factory: () => T, private onRelease?: (o: T) => void) {}
  acquire(): T {
    const o = this.free.pop();
    if (o !== undefined) return o;
    this.created++;
    return this.factory();
  }
  release(o: T) {
    this.onRelease?.(o);
    this.free.push(o);
  }
  prewarm(n: number) {
    const tmp: T[] = [];
    for (let i = 0; i < n; i++) tmp.push(this.acquire());
    for (const o of tmp) this.release(o);
  }
  get available() {
    return this.free.length;
  }
}
