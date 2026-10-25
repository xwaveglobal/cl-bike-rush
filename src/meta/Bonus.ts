/**
 * v2 BONUS events (docs/GAME-DESIGN.md §5) — replace the old cups.
 *
 * v3.0.6: every hour (local time: 00:00, 01:00, …) a Bonus road opens for 30 minutes and can be
 * replayed as often as you like while it is open. Each opening picks a random place (never the same
 * as the hour before; every player sees the same one), a 5-minute road with a
 * FINISH line, and it pays only coins (no EXP, no ranking). Special items lie on the road and fire
 * by themselves when picked up. Pure logic — no DOM.
 */
import type { BonusWorld } from '../gameplay/Spawner.ts';

export const BONUS = {
  everyHours: 1,
  openMinutes: 30,
  /** non-stop minutes from START to FINISH (a short 5-minute road; v3.0.6: replay freely while open) */
  raceMinutes: 5,
  /** coins for reaching the finish line (× speed-level coin multiplier) */
  finishCoins: 300,
  themes: ['desert', 'forest', 'country', 'sea'] as BonusWorld[],
};

export const BONUS_NAME: Record<BonusWorld, string> = {
  desert: 'Desert Highway',
  forest: 'Pine Forest',
  country: 'Country Road',
  sea: 'Ocean Causeway',
};

/** section names along each Bonus road (one per ~5 minutes) */
export const BONUS_SECTIONS: Record<BonusWorld, string[]> = {
  desert: ['Dune Gate', 'Cactus Flats', 'Red Mesas', 'Mirage Mile', 'Canyon Run', 'Sunset Straight'],
  forest: ['Pine Gate', 'Fern Valley', 'Old Bridge', 'Misty Hills', 'Ranger Pass', 'Lakeside'],
  country: ['Farm Gate', 'Wheat Fields', 'Windmill Row', 'Hay Bales', 'Barn Bend', 'Village Lane'],
  sea: ['Harbour Gate', 'Palm Islets', 'Sailing Bay', 'Lighthouse Point', 'Coral Reef', 'Sunset Pier'],
};

export interface BonusSlot {
  theme: BonusWorld;
  start: number;
  end: number;
  key: string;
}

/** shuffled order of all places for block `b` (seeded → the same for every player) */
function shuffled(b: number): number[] {
  const n = BONUS.themes.length;
  const order = Array.from({ length: n }, (_, i) => i);
  let x = (Math.imul(b, 0x9e3779b1) ^ 0x5bd1e995) >>> 0;
  for (let i = n - 1; i > 0; i--) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    const j = x % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
/** random place per opening: every place once per block, never the same twice in a row */
function themeIdx(idx: number): number {
  const n = BONUS.themes.length;
  const b = Math.floor(idx / n);
  const order = shuffled(b);
  if (n > 1 && order[0] === shuffled(b - 1)[n - 1]) [order[0], order[1]] = [order[1], order[0]];
  return order[idx - b * n];
}

/** the slot that contains `now` (open for its first `openMinutes`) */
function slotAt(now: number): BonusSlot {
  const d = new Date(now);
  const h = d.getHours();
  const startH = h - (h % BONUS.everyHours);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), startH, 0, 0, 0).getTime();
  // a random place per opening (seeded by the slot number, so it is the same for everyone)
  const dayIdx = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
  const idx = dayIdx * (24 / BONUS.everyHours) + startH / BONUS.everyHours;
  const theme = BONUS.themes[themeIdx(idx)];
  return { theme, start, end: start + BONUS.openMinutes * 60000, key: `${start}` };
}

/** live event (null when closed) + the next one */
export function bonusState(now = Date.now()) {
  const cur = slotAt(now);
  const live = now < cur.end ? cur : null;
  const next = live ? slotAt(cur.start + BONUS.everyHours * 3600000) : slotAt(cur.start + BONUS.everyHours * 3600000);
  return { live, next };
}

export function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
