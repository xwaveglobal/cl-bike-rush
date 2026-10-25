import type { WorldId } from './Spawner.ts';

/** Pattern ids the spawner knows (see Spawner.choosePattern). */
export type PatternKey =
  | 'crate' | 'barrier' | 'beam' | 'low2' | 'crateBeam' | 'wall3' | 'drone' | 'platform'
  | 'traffic' | 'trafficMix' | 'ring' | 'laser' | 'gate' | 'asteroid' | 'asteroid2';

export interface Section {
  name: string;
  from: number;
  to: number;
  /** multiplies pattern weights inside this section */
  bias?: Partial<Record<PatternKey, number>>;
  /** 0 = no obstacles (start / finish straights) */
  density?: number;
}

export interface Course {
  id: string;
  name: string;
  world: WorldId;
  /** metres from START to FINISH */
  length: number;
  /** difficulty offset in metres of "endless" progress (speed + pattern mix) */
  diffOffset: number;
  /** 1–5, shown on the card */
  difficulty: number;
  /** coins needed for the third star */
  coinTarget: number;
  /** coin reward for finishing */
  reward: number;
  sections: Section[];
  /** best score needed on the PREVIOUS track to unlock this one (0 = open) */
  unlockScore?: number;
  /** rank class gate (tracks 11–20 need class A) */
  needClass?: 'A';
  /** v2 Bonus event road: coins only, specials on the road fire by themselves */
  bonus?: boolean;
}

/**
 * Track mode: fixed-length courses with a START and FINISH gate, each set in one
 * world. Track 1 follows the "Level 1 — Full Track" plan (9 sections, 3,200 m).
 * Endless mode is `null` — the original rotating-world run.
 */
/** tracks 1–5 (the hand-made worlds) are open from the start; unlocking starts at track 6 */
export const FREE_TRACKS = 5;

const BASE: Course[] = [
  {
    id: 'future-city',
    name: 'Sky City',
    world: 'city',
    length: 3200,
    diffOffset: 0,
    difficulty: 1,
    coinTarget: 120,
    reward: 300,
    sections: [
      { name: 'Start Area', from: 0, to: 200, density: 0.6, bias: { crate: 2, barrier: 1.5 } },
      { name: 'Sky Highway', from: 200, to: 600, bias: { traffic: 3, trafficMix: 2, crate: 1.2 } },
      { name: 'Obstacle Zone', from: 600, to: 1000, bias: { low2: 2.5, crateBeam: 2, beam: 1.5 } },
      { name: 'Ring Tunnel', from: 1000, to: 1400, bias: { ring: 5, beam: 1.5 } },
      { name: 'Crystal Bridge', from: 1400, to: 1800, bias: { ring: 2.5, low2: 2 } },
      { name: 'Beam Alley', from: 1800, to: 2200, bias: { beam: 3, crateBeam: 2 } },
      { name: 'Jump Section', from: 2200, to: 2600, bias: { barrier: 3, crate: 2, low2: 3 } },
      { name: 'Traffic Weave', from: 2600, to: 3000, bias: { traffic: 3, trafficMix: 2.5 } },
      { name: 'Final Sprint', from: 3000, to: 3200, density: 0.8, bias: { traffic: 2, ring: 2 } },
    ],
  },
  {
    id: 'cloud-city',
    name: 'Cloud Highway',
    world: 'cloud',
    length: 2800,
    diffOffset: 700,
    difficulty: 2,
    coinTarget: 110,
    reward: 400,
    sections: [
      { name: 'Cloud Gate', from: 0, to: 300, density: 0.7 },
      { name: 'Floating Islands', from: 300, to: 1100, bias: { platform: 4, crateBeam: 2 } },
      { name: 'Sky Bridges', from: 1100, to: 1900, bias: { ring: 3, beam: 2, low2: 2 } },
      { name: 'Platform Run', from: 1900, to: 2800, bias: { platform: 3, beam: 2, low2: 2 } },
    ],
  },
  {
    id: 'neon-tunnel',
    name: 'Neon Night City',
    world: 'tunnel',
    length: 2400,
    diffOffset: 1300,
    difficulty: 3,
    coinTarget: 100,
    reward: 350,
    sections: [
      { name: 'Tunnel Entry', from: 0, to: 300, density: 0.7, bias: { ring: 3 } },
      { name: 'Laser Corridor', from: 300, to: 1000, bias: { laser: 4, beam: 2 } },
      { name: 'Ring Run', from: 1000, to: 1600, bias: { ring: 5, barrier: 2 } },
      { name: 'Overdrive', from: 1600, to: 2400, bias: { laser: 3, wall3: 2, crateBeam: 2 } },
    ],
  },
  {
    id: 'space-zone',
    name: 'Celestial Gateway',
    world: 'space',
    length: 3000,
    diffOffset: 1900,
    difficulty: 4,
    coinTarget: 120,
    reward: 450,
    sections: [
      { name: 'Launch', from: 0, to: 300, density: 0.7 },
      { name: 'Asteroid Belt', from: 300, to: 1300, bias: { asteroid: 3, asteroid2: 3 } },
      { name: 'Orbital Highway', from: 1300, to: 2200, bias: { traffic: 3, ring: 2 } },
      { name: 'Meteor Storm', from: 2200, to: 3000, bias: { asteroid2: 5, laser: 1.5 } },
    ],
  },
  {
    id: 'mega-city',
    name: 'Sunset Horizon',
    world: 'mega',
    length: 3600,
    diffOffset: 2700,
    difficulty: 5,
    coinTarget: 140,
    reward: 600,
    sections: [
      { name: 'Horizon Approach', from: 0, to: 400, density: 0.8, bias: { traffic: 2 } },
      { name: 'Rush Hour', from: 400, to: 1300, bias: { traffic: 3, trafficMix: 3 } },
      { name: 'Energy Gates', from: 1300, to: 2300, bias: { gate: 6, laser: 3 } },
      { name: 'Tower Run', from: 2300, to: 3100, bias: { wall3: 3, beam: 2, crateBeam: 2 } },
      { name: 'Apex Finale', from: 3100, to: 3600, bias: { ring: 3, laser: 2, gate: 2 } },
    ],
  },
];

/**
 * 20 tracks = the 5 hand-made worlds (tier 0) + 3 harder remixes of each (tiers 1–3).
 * A remix is longer, starts further along the difficulty curve and leans harder on the
 * world's signature obstacles. Unlocks: a target score on the previous track; tracks 11–20
 * additionally need rank class A (the "Rank A gate").
 */
const REMIX: string[][] = [
  ['Floating Islands', 'Crystal Bridge', 'Waterfall Canyon', 'Storm Corridor', 'Mountain Skyway'],
  ['Hyperloop', 'Thunder Peaks', 'Red Zone', 'Black Hole', 'Lockdown'],
  ['Zero Gravity', 'Skyfall', 'Core Breach', 'Supernova', 'Apex Legend'],
];
function remix(b: Course, tier: number, name: string): Course {
  const k = 1 + 0.18 * tier; // longer track
  const len = Math.round((b.length * k) / 100) * 100;
  const sc = len / b.length;
  return {
    ...b,
    id: `${b.id}-${tier + 1}`,
    name: `${b.name} · ${name}`,
    length: len,
    diffOffset: b.diffOffset + 1500 * tier,
    difficulty: Math.min(5, b.difficulty + tier),
    coinTarget: Math.round((b.coinTarget * sc + 10 * tier) / 10) * 10,
    reward: Math.round((b.reward * (1 + 0.6 * tier)) / 50) * 50,
    sections: b.sections.map((x, i) => ({
      ...x,
      name: i === 0 ? x.name : i === b.sections.length - 1 ? 'Final Sprint' : x.name,
      from: Math.round(x.from * sc),
      to: Math.round(x.to * sc),
      bias: Object.fromEntries(Object.entries(x.bias ?? {}).map(([kk, v]) => [kk, (v as number) * (1 + 0.25 * tier)])),
    })),
  };
}
export const COURSES: Course[] = [...BASE, ...REMIX.flatMap((names, t) => BASE.map((b, i) => remix(b, t + 1, names[i])))].map((c, i, all) => ({
  ...c,
  // score to beat on the previous track ≈ 1.5 points per metre of it (rounded)
  unlockScore: i < FREE_TRACKS ? 0 : Math.round((all[i - 1].length * 1.5) / 500) * 500,
  needClass: i >= 10 ? 'A' : undefined,
}));

/** the Rank-A gate sits before this track index */
export const RANK_GATE_AT = 10;

export type TrackLock = { open: true } | { open: false; why: 'score'; need: number; prev: Course } | { open: false; why: 'class' };
/** is track `c` playable for this player? (best scores per track id, current rank class index ≥ A?) */
export function trackLock(c: Course, best: Record<string, number>, hasClassA: boolean): TrackLock {
  const i = COURSES.indexOf(c);
  if (i < FREE_TRACKS) return { open: true }; // the 5 worlds (and Endless) are always open
  if (c.needClass && !hasClassA) return { open: false, why: 'class' };
  const prev = COURSES[i - 1];
  const need = c.unlockScore ?? 0;
  if ((best[prev.id] ?? 0) >= need) return { open: true };
  return { open: false, why: 'score', need, prev };
}

export const courseById = (id: string | null | undefined) => COURSES.find((c) => c.id === id) ?? null;

export const sectionAt = (c: Course, d: number) => c.sections.find((s) => d >= s.from && d < s.to) ?? c.sections[c.sections.length - 1];
