/**
 * v2.2 Missions = long career chains (separate from the 4 Daily challenges).
 * Each chain has tiers with growing coin rewards; finishing tiers raises the pilot level.
 * Three chains are "active" (the ones closest to their next tier). Pure logic, no DOM.
 */
import type { SaveData } from '../core/Save.ts';
import { CLASSES, playerRank } from './Rank.ts';

export interface CareerStats {
  km: number;
  coins: number;
  bonus: number;
  specials: number;
  bests: number;
  worlds: string[];
  gates: number;
  /** tiers already paid per chain id */
  tier: Record<string, number>;
}

export const careerDefaults = (): CareerStats => ({ km: 0, coins: 0, bonus: 0, specials: 0, bests: 0, worlds: [], gates: 0, tier: {} });

export interface Chain {
  id: string;
  icon: string; // icon key (ui maps it)
  text: (t: number) => string;
  tiers: number[];
  rewards: number[];
  value: (s: SaveData) => number;
}

const RANK_NAMES = ['D', 'C', 'B', 'A', 'AA', 'AAA'];
const c = (s: SaveData) => s.career ?? careerDefaults();
const k = (n: number) => (n >= 1000 ? `${n / 1000}k` : String(n));

export const CHAINS: Chain[] = [
  { id: 'rank', icon: 'rank', text: (t) => `Reach rank ${RANK_NAMES[t]}`, tiers: [1, 2, 3, 4, 5], rewards: [300, 500, 800, 1200, 2000], value: (s) => Math.min(5, CLASSES.indexOf(playerRank(s.expBest, s.exp2Best))) },
  { id: 'km', icon: 'flag', text: (t) => `Drive ${k(t)} km in total`, tiers: [50, 200, 1000, 5000], rewards: [200, 500, 1200, 3000], value: (s) => Math.floor(c(s).km) },
  { id: 'worlds', icon: 'globe', text: (t) => `Visit ${t} Endless worlds`, tiers: [3, 6, 9, 12], rewards: [200, 400, 700, 1200], value: (s) => c(s).worlds.length },
  { id: 'gates', icon: 'gate', text: (t) => `Break through ${t} rank gates`, tiers: [1, 5, 15, 40], rewards: [200, 400, 900, 2000], value: (s) => c(s).gates },
  { id: 'bonus', icon: 'gift', text: (t) => `Finish ${t} Bonus road${t > 1 ? 's' : ''}`, tiers: [1, 5, 20, 50], rewards: [200, 400, 900, 2000], value: (s) => c(s).bonus },
  { id: 'specials', icon: 'rocket', text: (t) => `Use ${t} specials`, tiers: [3, 10, 50, 150], rewards: [150, 300, 800, 1800], value: (s) => c(s).specials },
  { id: 'coins', icon: 'coin', text: (t) => `Collect ${k(t)} coins on the road`, tiers: [5000, 25000, 100000, 500000], rewards: [200, 600, 1500, 4000], value: (s) => c(s).coins },
  { id: 'cars', icon: 'car', text: (t) => `Unlock ${t} cars`, tiers: [2, 3, 4, 6], rewards: [300, 600, 1000, 2000], value: (s) => s.unlocked.length },
  { id: 'bests', icon: 'trophy', text: (t) => `Beat your best EXP ${t} times`, tiers: [3, 10, 25, 60], rewards: [200, 400, 800, 1600], value: (s) => c(s).bests },
  { id: 'races', icon: 'play', text: (t) => `Play ${t} races`, tiers: [10, 50, 200, 1000], rewards: [100, 300, 800, 2000], value: (s) => s.totalRuns },
];

export interface ChainView {
  id: string;
  icon: string;
  text: string;
  value: number;
  target: number;
  reward: number;
  tier: number;
  tiers: number;
  /** all tiers done */
  maxed: boolean;
}

export function chainView(s: SaveData, ch: Chain): ChainView {
  const t = c(s).tier[ch.id] ?? 0;
  const maxed = t >= ch.tiers.length;
  const i = Math.min(t, ch.tiers.length - 1);
  return { id: ch.id, icon: ch.icon, text: ch.text(ch.tiers[i]), value: Math.min(ch.value(s), ch.tiers[i]), target: ch.tiers[i], reward: ch.rewards[i], tier: t, tiers: ch.tiers.length, maxed };
}

/** pilot level = 1 + every tier finished */
export function pilotLevel(s: SaveData) {
  return 1 + Object.values(c(s).tier).reduce((a, b) => a + b, 0);
}

/** the 3 active chains: not maxed, closest to their next tier first */
export function activeChains(s: SaveData): ChainView[] {
  return CHAINS.map((ch) => chainView(s, ch))
    .filter((v) => !v.maxed)
    .sort((a, b) => b.value / b.target - a.value / a.target)
    .slice(0, 3);
}

/** finishes every reached tier (any chain, not just the active 3); returns what was completed */
export function settleCareer(s: SaveData): { text: string; reward: number }[] {
  s.career ??= careerDefaults();
  const out: { text: string; reward: number }[] = [];
  for (const ch of CHAINS) {
    for (let guard = 0; guard < 10; guard++) {
      const t = s.career.tier[ch.id] ?? 0;
      if (t >= ch.tiers.length || ch.value(s) < ch.tiers[t]) break;
      s.career.tier[ch.id] = t + 1;
      out.push({ text: ch.text(ch.tiers[t]), reward: ch.rewards[t] });
    }
  }
  return out;
}
