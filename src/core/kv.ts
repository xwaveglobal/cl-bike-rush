/**
 * Small key/value store for non-progress data (local boards, cloud tokens).
 * Web: localStorage. v3 native: the runtime adapter points it at the HS profile (src/native/save.ts),
 * so the mini game keeps ONE save system.
 */
export interface KV {
  get(k: string): string | null;
  set(k: string, v: string): void;
  del(k: string): void;
}
let impl: KV = {
  get: (k) => globalThis.localStorage?.getItem(k) ?? null,
  set: (k, v) => globalThis.localStorage?.setItem(k, v),
  del: (k) => globalThis.localStorage?.removeItem(k),
};
export const kv: KV = {
  get: (k) => impl.get(k),
  set: (k, v) => impl.set(k, v),
  del: (k) => impl.del(k),
};
export function setKV(k: KV) {
  impl = k;
}
