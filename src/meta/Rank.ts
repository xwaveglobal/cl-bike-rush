/**
 * v2 RANKS (docs/GAME-DESIGN.md §1)
 *
 * EXP measures skill: run EXP = distance × speed-level rate, and the player's EXP is their BEST
 * run (never summed, never bought). Ranks D → C → B → A → AA → AAA are EXP thresholds (config EXP.rank).
 */
import { EXP, type SpeedLevel } from '../config.ts';

/** D → AAA on Endless; S / SS / SSS only on Track 2 (unlocks at AAA) */
export const CLASSES = ['D', 'C', 'B', 'A', 'AA', 'AAA', 'S', 'SS', 'SSS'] as const;
export type RankClass = (typeof CLASSES)[number];
/** the Endless ladder (and cup divisions while cups still exist) */
export const BASE_CLASSES = ['D', 'C', 'B', 'A', 'AA', 'AAA'] as const;
export type BaseClass = (typeof BASE_CLASSES)[number];
export const toBase = (c: RankClass): BaseClass => (CLASSES.indexOf(c) > 5 ? 'AAA' : (c as BaseClass));
export const rankIdx = (c: RankClass) => CLASSES.indexOf(c);
export const rankAtLeast = (c: RankClass, need: RankClass) => rankIdx(c) >= rankIdx(need);

/** EXP needed to reach each rank */
export const CLASS_MIN: Record<RankClass, number> = EXP.rank;
export const CLASS_COLOR: Record<RankClass, string> = { D: '#9fb3dd', C: '#2fd36b', B: '#4fc3ff', A: '#9b6bff', AA: '#ffc21a', AAA: '#ff4fd8', S: '#ff7a2e', SS: '#ff3b5c', SSS: '#ffe9a8' };

/**
 * The player's rank: Endless counts up to AAA, S tiers come only from Track 2.
 * @param expBest best run on any track · @param exp2Best best run on Track 2
 */
export function playerRank(expBest: number, exp2Best = 0): RankClass {
  const a = Math.min(rankIdx(classFor(expBest)), 5);
  const b = rankIdx(classFor(exp2Best));
  return CLASSES[Math.max(a, b)];
}

/** EXP earned by a run of `distance` metres at a speed level */
export const expFor = (distance: number, level: SpeedLevel) => Math.floor(Math.max(0, distance) * EXP.rate[level]);

/** non-stop minutes to reach a rank at a speed level (design target) */
export const rankMinutes = (c: RankClass, level: SpeedLevel) => EXP.hardMinutes[c] * EXP.timeMul[level];

export function classFor(bolts: number): RankClass {
  let c: RankClass = 'D';
  for (const k of CLASSES) if (bolts >= CLASS_MIN[k]) c = k;
  return c;
}

export function classProgress(bolts: number, rank?: RankClass) {
  const c = rank ?? classFor(bolts);
  const i = CLASSES.indexOf(c);
  const next = CLASSES[i + 1] ?? null;
  const from = CLASS_MIN[c];
  const to = next ? CLASS_MIN[next] : from;
  return { cls: c, next, k: next ? (bolts - from) / (to - from) : 1, need: next ? to - bolts : 0 };
}

/** rivals on the sample boards: rank straight from their EXP */
export const classForScore = (exp: number) => classFor(exp);

/** how EXP works (rank guide) */
export const EXP_RULES: { what: string; gain: string }[] = [
  { what: 'Every metre you drive', gain: 'EXP' },
  { what: 'Speed EASY / NORMAL / HARD', gain: `×${EXP.rate.easy / EXP.rate.easy} / ×${(EXP.rate.normal / EXP.rate.easy).toFixed(2).replace(/0$/, '')} / ×${EXP.rate.hard / EXP.rate.easy}` },
  { what: 'Your EXP = your best single run', gain: 'best' },
];

/** the EXP badge: a small pill that literally reads "EXP" (owner: the shield icon was unclear) */
export const XPT = `<svg viewBox="0 0 36 20" class="xpt" aria-label="EXP"><defs><linearGradient id="xpg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ee6ff"/><stop offset="1" stop-color="#8a4dff"/></linearGradient></defs><rect x="1" y="1" width="34" height="18" rx="6" fill="url(#xpg)" stroke="#1b1450" stroke-width="1.4"/><text x="18" y="14.6" text-anchor="middle" font-family="'Arial Black',Arial,sans-serif" font-weight="900" font-size="12.5" fill="#fff" letter-spacing=".3">EXP</text></svg>`;

/** small class badge (hex plate with the letters) */
export function classBadge(c: RankClass, size = 'sm') {
  return `<span class="clsb ${size}" style="--cc:${CLASS_COLOR[c]}">${c}</span>`;
}
