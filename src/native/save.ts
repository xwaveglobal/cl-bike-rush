/**
 * v3 native save: the whole SaveData lives in the ONE HS profile (HS kit rule 2).
 *
 *  - numbers HSGame rewards can add to are real profile fields — coins (= wallet), super, hyper,
 *    escape, no_ads — and the game's save object reads / writes them through accessors, so there
 *    is no second copy: a reward HSGame adds shows up in the game at once.
 *  - exp_best / exp2_best are mirrored as 'max' fields (the profile summary).
 *  - everything else is the `game` field (a plain object).
 */
import { setSaveBackend, type SaveData } from '../core/Save.ts';
import { setKV } from '../core/kv.ts';
import { profile } from './hs.ts';

type P = { get(k: string): unknown; set(k: string, v: unknown): void; update(o: Record<string, unknown>): void };
const pr = profile as P;

const num = (k: string) => Number(pr.get(k)) || 0;

setSaveBackend({
  read() {
    const g = pr.get('game') as Record<string, unknown> | null;
    if (!g || typeof g !== 'object') return null;
    return JSON.stringify(g);
  },
  write(_json, s) {
    // `game` = the save without the fields the profile owns (they are accessors on `s`)
    const g = JSON.parse(_json) as Record<string, unknown>;
    delete g.wallet;
    delete g.noAds;
    const items = { ...(g.items as Record<string, number>) };
    delete items.super;
    delete items.hyper;
    delete items.escape;
    g.items = items;
    pr.update({ game: g, exp_best: Math.max(num('exp_best'), s.expBest | 0), exp2_best: Math.max(num('exp2_best'), s.exp2Best | 0) });
  },
  bind(s: SaveData) {
    const fresh = !pr.get('game');
    // a brand-new player: the save's starting values go into the profile once
    if (fresh) {
      pr.update({ coins: s.wallet, super: s.items.super, hyper: s.items.hyper, escape: s.items.escape, no_ads: s.noAds ? 1 : 0 });
    }
    const field = (obj: object, key: string, pk: string) =>
      Object.defineProperty(obj, key, {
        get: () => num(pk),
        set: (v: number) => pr.set(pk, Math.max(0, Math.round(Number(v) || 0))),
        enumerable: true,
        configurable: true,
      });
    field(s, 'wallet', 'coins');
    field(s.items, 'super', 'super');
    field(s.items, 'hyper', 'hyper');
    field(s.items, 'escape', 'escape');
    Object.defineProperty(s, 'noAds', {
      get: () => num('no_ads') > 0,
      set: (v: boolean) => pr.set('no_ads', v ? 1 : 0),
      enumerable: true,
      configurable: true,
    });
  },
});

// everything else the game keeps (local leaderboard, flags) → the profile's `kv` field
const kvObj = () => ({ ...((pr.get('kv') as Record<string, string> | null) ?? {}) });
setKV({
  get: (k) => kvObj()[k] ?? null,
  set: (k, v) => {
    const o = kvObj();
    o[k] = v;
    pr.set('kv', o);
  },
  del: (k) => {
    const o = kvObj();
    delete o[k];
    pr.set('kv', o);
  },
});
