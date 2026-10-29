/**
 * Daily live-ops: 7-day check-in calendar + 4 daily quests (reset at local
 * midnight) that earn Daily Points toward 3 milestone chests.
 */
import { hashStr, rng } from './Leaderboard.ts';

export type ItemKey = 'super' | 'hyper' | 'shield' | 'escape' | 'turbo' | 'magnet' | 'double' | 'life';
/** start-of-run boosts unlocked by rank class (then bought with coins) */
export const UNLOCK_BOOSTS: { k: ItemKey; cls: 'C' | 'B' | 'A' | 'AA'; price: number }[] = [
  { k: 'turbo', cls: 'C', price: 150 },
  { k: 'magnet', cls: 'B', price: 180 },
  { k: 'double', cls: 'A', price: 260 },
  { k: 'life', cls: 'AA', price: 400 },
];
/**
 * Coin price of ONE item bought singly (Magic Bag / item card). Deliberately above the
 * value inside real-money bundles, so bundles are always the better deal (see docs/ECONOMY.md).
 */
export const ITEM_PRICE: Record<ItemKey, number> = { super: 3000, hyper: 7000, escape: 2000, shield: 300, turbo: 150, magnet: 180, double: 260, life: 400 };
/** v1 prices — only used to refund retired items when an old save moves to v2 */
export const V1_ITEM_PRICE: Record<ItemKey, number> = { super: 400, hyper: 1200, escape: 350, shield: 300, turbo: 150, magnet: 180, double: 260, life: 400 };

/** v2 special items (docs/GAME-DESIGN.md §4): bought with coins, kept in the Magic Bag, ONE per race */
export const SPECIALS = ['escape', 'super', 'hyper'] as const;
export type SpecialKey = (typeof SPECIALS)[number];
/** teaser specials: shown blurred, unlock at AAA (they appear for real in Bonus events) */
export const LOCKED_SPECIALS: { id: string; name: string; short: string; desc: string }[] = [
  { id: 'tunnel', name: 'Tunnel Rider', short: 'Tunnel', desc: 'In a tunnel, drive on its roof' },
  { id: 'wall', name: 'Wall Run', short: 'Wall', desc: 'Run along the side wall past a whole row' },
  { id: 'ghost', name: 'Phase Ghost', short: 'Ghost', desc: 'Pass through obstacles for a few seconds' },
  { id: 'rail', name: 'Sky Rail', short: 'Rail', desc: 'Grab a rail up high and glide a whole stretch' },
];

/** coin value of a reward (used to show "worth N coins" on shop bundles) */
export function rewardValue(r: { coins?: number; items?: Partial<Record<ItemKey, number>> }) {
  let v = r.coins ?? 0;
  for (const [k, n] of Object.entries(r.items ?? {})) v += (n ?? 0) * ITEM_PRICE[k as ItemKey];
  return v;
}

export interface Reward {
  coins?: number;
  items?: Partial<Record<ItemKey, number>>;
}

/** v2: daily check-in pays coins (day 7 adds a Roadster Jump to the Magic Bag) */
export const CHECKIN: Reward[] = [
  { coins: 100 },
  { coins: 150 },
  { coins: 200 },
  { coins: 250 },
  { coins: 300 },
  { coins: 400 },
  { coins: 600, items: { super: 1 } },
];

export type QuestStat = 'runs' | 'coins' | 'distance' | 'near' | 'powerups' | 'jumps' | 'score' | 'finish' | 'rings' | 'exp' | 'gates' | 'worlds' | 'hearts' | 'hard' | 'clean' | 'far';

export interface Quest {
  id: string;
  text: string;
  stat: QuestStat;
  target: number;
  /** 'sum' accumulates across runs today, 'max' needs it in one run */
  mode: 'sum' | 'max';
  pts: number;
  coins: number;
}

/** v2.2: daily challenges — 4 a day (same for everyone), reset at midnight, coins only */
const POOL: Quest[] = [
  { id: 'runs3', text: 'Play 3 races', stat: 'runs', target: 3, mode: 'sum', pts: 0, coins: 100 },
  { id: 'gate1', text: 'Break through a rank gate', stat: 'gates', target: 1, mode: 'max', pts: 0, coins: 250 },
  { id: 'world2', text: 'Reach the 2nd world in one race', stat: 'worlds', target: 2, mode: 'max', pts: 0, coins: 180 },
  { id: 'world3', text: 'Reach the 3rd world in one race', stat: 'worlds', target: 3, mode: 'max', pts: 0, coins: 300 },
  { id: 'block1', text: 'Clear a car block with a special', stat: 'jumps', target: 1, mode: 'sum', pts: 0, coins: 150 },
  { id: 'hearts2', text: 'Pick up 2 hearts in one race', stat: 'hearts', target: 2, mode: 'max', pts: 0, coins: 220 },
  { id: 'bonus1', text: 'Finish a Bonus road', stat: 'finish', target: 1, mode: 'sum', pts: 0, coins: 300 },
  { id: 'hard3', text: 'Play 3 races on Hard', stat: 'hard', target: 3, mode: 'sum', pts: 0, coins: 200 },
  { id: 'clean1k', text: '1,000 EXP without losing a heart', stat: 'clean', target: 1000, mode: 'max', pts: 0, coins: 200 },
  { id: 'rings10', text: 'Fly through 10 energy rings', stat: 'rings', target: 10, mode: 'sum', pts: 0, coins: 120 },
  { id: 'far8k', text: 'Drive 8 km in one race', stat: 'far', target: 8000, mode: 'max', pts: 0, coins: 250 },
  { id: 'coins150', text: 'Collect 150 coins', stat: 'coins', target: 150, mode: 'sum', pts: 0, coins: 120 },
  { id: 'dist12k', text: 'Drive 12 km in total', stat: 'distance', target: 12000, mode: 'sum', pts: 0, coins: 200 },
  { id: 'exp3000', text: 'Earn 3,000 EXP in one race', stat: 'exp', target: 3000, mode: 'max', pts: 0, coins: 250 },
  { id: 'power5', text: 'Grab 5 road power-ups', stat: 'powerups', target: 5, mode: 'sum', pts: 0, coins: 100 },
];

/** Same 4 quests for everyone on a given day. */
export function questsFor(day: string): Quest[] {
  const r = rng(hashStr(`daily-${day}`));
  const pool = [...POOL];
  const out: Quest[] = [pool.splice(0, 1)[0]]; // "Play 3 runs" is always there
  while (out.length < 4) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}

/** v2: no points / chests any more (Daily pays coins per mission) */
export const CHESTS: { pts: number; reward: Reward }[] = [];

export const rewardText = (r: Reward) => {
  const parts: string[] = [];
  if (r.coins) parts.push(`${r.coins.toLocaleString('en-US')} coins`);
  const names: Record<ItemKey, string> = { super: 'Jump Booster', hyper: 'HYPER FLIGHT', shield: 'Aegis Shield', escape: 'Emergency Rescue', turbo: 'Aero Nitro', magnet: 'Flux Magnet', double: 'Double Coin', life: 'Armor Core' };
  for (const [k, n] of Object.entries(r.items ?? {})) if (n) parts.push(`${names[k as ItemKey]} ×${n}`);
  return parts.join(' + ');
};
