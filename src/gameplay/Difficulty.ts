import type { PatternKey } from './Courses.ts';
import type { WorldId } from './Spawner.ts';
import { EXP, type SpeedLevel } from '../config.ts';

/**
 * OBSTACLE DIFFICULTY SYSTEM
 *
 * Every spawner pattern is a curated library entry with a tier, the actions it asks
 * for and its spacing needs. Each world (map) has a MapDifficultyConfig that decides
 * which patterns exist there and in what tier mix; the spawner picks a tier first
 * (by the map's distribution, shifted by progress through the map) and then a pattern
 * of that tier. All rows still pass the time-aware reachability validator (Fairness.ts).
 */

export type Tier = 1 | 2 | 3 | 4;
export const TIER_WEIGHT: Record<Tier, number> = { 1: 1, 2: 2, 3: 4, 4: 7 };
export const TIER_NAME: Record<Tier, string> = { 1: 'EASY', 2: 'NORMAL', 3: 'HARD', 4: 'EXPERT' };

export type Act = 'left' | 'right' | 'up' | 'down' | 'none';

export interface PatternDef {
  key: PatternKey;
  id: string;
  name: string;
  tier: Tier;
  /** actions that solve it (any one of them) */
  actions: Act[];
  /** minimum seconds since the previous row */
  minGap: number;
  /** recovery seconds required after it (on top of the normal gap) */
  recovery: number;
  /** hides what is behind it (tall wall / full-width) → never followed by a trap */
  occludes: boolean;
  /** worlds where it may appear */
  worlds: WorldId[];
}

const BONUS_ROADS: WorldId[] = ['desert', 'forest', 'country', 'sea'];
const LADDER: WorldId[] = ['harbor', 'solar', 'canyon', 'belt', 'storm', 'volcano', 'ice'];
const ALL: WorldId[] = ['city', 'cloud', 'tunnel', 'space', 'mega', ...BONUS_ROADS, ...LADDER];

export const PATTERNS: Record<PatternKey, PatternDef> = {
  crate: { key: 'crate', id: 'P01', name: 'Single blocker · 2 safe lanes', tier: 1, actions: ['left', 'right', 'up'], minGap: 0, recovery: 0, occludes: false, worlds: ALL },
  barrier: { key: 'barrier', id: 'P03', name: 'Low barrier · fly up or switch', tier: 1, actions: ['up', 'left', 'right'], minGap: 0, recovery: 0, occludes: false, worlds: ALL },
  ring: { key: 'ring', id: 'P06', name: 'Energy ring · coin route', tier: 1, actions: ['none'], minGap: 0, recovery: 0, occludes: false, worlds: ALL },
  asteroid: { key: 'asteroid', id: 'P11', name: 'Asteroid · switch lane', tier: 1, actions: ['left', 'right'], minGap: 0, recovery: 0, occludes: false, worlds: ['space', 'belt'] },
  beam: { key: 'beam', id: 'P04', name: 'Overhead beam · fly down', tier: 2, actions: ['down', 'left', 'right'], minGap: 0, recovery: 0, occludes: false, worlds: ALL },
  low2: { key: 'low2', id: 'P02', name: 'Two blockers · 1 safe lane', tier: 2, actions: ['left', 'right', 'up'], minGap: 0.75, recovery: 0, occludes: false, worlds: ALL },
  traffic: { key: 'traffic', id: 'P12', name: 'Oncoming vehicle', tier: 2, actions: ['left', 'right'], minGap: 0.75, recovery: 0, occludes: false, worlds: ['city', 'cloud', 'space', 'mega', ...BONUS_ROADS, 'harbor', 'solar', 'storm', 'volcano', 'ice'] },
  trafficMix: { key: 'trafficMix', id: 'P13', name: 'Vehicle + blocker', tier: 2, actions: ['left', 'right', 'up', 'down'], minGap: 0.8, recovery: 0.15, occludes: false, worlds: ['city', 'mega', 'desert', 'country', 'harbor', 'storm', 'volcano', 'ice'] },
  crateBeam: { key: 'crateBeam', id: 'P05', name: 'Alternating blockers', tier: 2, actions: ['left', 'right', 'up', 'down'], minGap: 0.75, recovery: 0, occludes: false, worlds: ALL },
  asteroid2: { key: 'asteroid2', id: 'P14', name: 'Two asteroids · 1 safe lane', tier: 2, actions: ['left', 'right'], minGap: 0.8, recovery: 0.1, occludes: false, worlds: ['space', 'belt'] },
  drone: { key: 'drone', id: 'P07', name: 'Moving drone · predictable sweep', tier: 2, actions: ['left', 'right', 'up'], minGap: 0.8, recovery: 0.1, occludes: false, worlds: [] }, // drone removed from the game (no spawns)
  platform: { key: 'platform', id: 'P15', name: 'Sliding platform', tier: 3, actions: ['up', 'left', 'right'], minGap: 0.95, recovery: 0.3, occludes: false, worlds: ['cloud', 'space', 'mega', 'harbor', 'solar', 'canyon', 'belt', 'storm', 'ice'] },
  wall3: { key: 'wall3', id: 'P09', name: 'Triple wall · jump/duck + recovery', tier: 3, actions: ['up', 'down'], minGap: 1.0, recovery: 0.45, occludes: false, worlds: [] }, // removed: a triple wall forced a jump/duck in every lane — too punishing
  laser: { key: 'laser', id: 'P08', name: 'Laser gate · highlighted opening', tier: 3, actions: ['up', 'down', 'left', 'right'], minGap: 1.0, recovery: 0.45, occludes: false, worlds: ['tunnel', 'space', 'mega', 'canyon', 'belt', 'storm', 'volcano', 'ice'] },
  gate: { key: 'gate', id: 'P10', name: 'Mega gate · one door (expert)', tier: 4, actions: ['left', 'right'], minGap: 1.35, recovery: 0.9, occludes: true, worlds: ['space', 'mega', 'belt', 'storm', 'volcano', 'ice'] },
};

export interface MapDifficultyConfig {
  world: WorldId;
  /** 1–10 */
  target: number;
  /** probability of each tier (sums to 1) */
  tiers: [number, number, number, number];
  /** at most this many lanes fully blocked (no height passes) in one row */
  maxBlockers: number;
  /** minimum seconds between rows (scaled by speed level) */
  minGap: number;
  /** reaction-time slack the validator must leave on every forced move (s) */
  slack: number;
  /** max tier-3+ rows in a row */
  maxConsecutiveHard: number;
  /** extra recovery seconds after tier 3 / tier 4 rows */
  recovery: number;
  /** obstacle density 0..1 (chance a row slot is used) */
  density: number;
  /** sweep speed multiplier for moving obstacles */
  movingSpeed: number;
  /** metres at the start of the map that only use tier 1–2 */
  warmup: number;
}

/** Initial balancing targets (tune through playtesting). */
export const MAPS: Record<WorldId, MapDifficultyConfig> = {
  city: { world: 'city', target: 2, tiers: [0.8, 0.2, 0, 0], maxBlockers: 1, minGap: 1.2, slack: 0.26, maxConsecutiveHard: 0, recovery: 0.5, density: 0.92, movingSpeed: 0.7, warmup: 250 },
  cloud: { world: 'cloud', target: 4, tiers: [0.62, 0.35, 0.03, 0], maxBlockers: 2, minGap: 1.08, slack: 0.22, maxConsecutiveHard: 1, recovery: 0.5, density: 0.95, movingSpeed: 0.8, warmup: 200 },
  tunnel: { world: 'tunnel', target: 5, tiers: [0.42, 0.43, 0.15, 0], maxBlockers: 2, minGap: 0.98, slack: 0.19, maxConsecutiveHard: 1, recovery: 0.45, density: 1, movingSpeed: 0.9, warmup: 150 },
  space: { world: 'space', target: 7, tiers: [0.3, 0.42, 0.23, 0.05], maxBlockers: 2, minGap: 0.9, slack: 0.15, maxConsecutiveHard: 2, recovery: 0.4, density: 1, movingSpeed: 1, warmup: 120 },
  // Bonus roads: lively but friendly (coins + showcase specials are the point)
  desert: { world: 'desert', target: 4, tiers: [0.55, 0.42, 0.03, 0], maxBlockers: 2, minGap: 1.05, slack: 0.22, maxConsecutiveHard: 1, recovery: 0.5, density: 0.9, movingSpeed: 0.8, warmup: 250 },
  forest: { world: 'forest', target: 4, tiers: [0.55, 0.42, 0.03, 0], maxBlockers: 2, minGap: 1.05, slack: 0.22, maxConsecutiveHard: 1, recovery: 0.5, density: 0.9, movingSpeed: 0.8, warmup: 250 },
  country: { world: 'country', target: 4, tiers: [0.55, 0.42, 0.03, 0], maxBlockers: 2, minGap: 1.05, slack: 0.22, maxConsecutiveHard: 1, recovery: 0.5, density: 0.9, movingSpeed: 0.8, warmup: 250 },
  sea: { world: 'sea', target: 4, tiers: [0.55, 0.42, 0.03, 0], maxBlockers: 2, minGap: 1.05, slack: 0.22, maxConsecutiveHard: 1, recovery: 0.5, density: 0.9, movingSpeed: 0.8, warmup: 250 },
  harbor: { world: 'harbor', target: 3, tiers: [0.7, 0.3, 0, 0], maxBlockers: 1, minGap: 1.15, slack: 0.24, maxConsecutiveHard: 0, recovery: 0.5, density: 0.92, movingSpeed: 0.75, warmup: 200 },
  solar: { world: 'solar', target: 4, tiers: [0.55, 0.45, 0, 0], maxBlockers: 2, minGap: 1.08, slack: 0.22, maxConsecutiveHard: 1, recovery: 0.5, density: 0.95, movingSpeed: 0.8, warmup: 200 },
  canyon: { world: 'canyon', target: 6, tiers: [0.3, 0.45, 0.25, 0], maxBlockers: 2, minGap: 0.95, slack: 0.17, maxConsecutiveHard: 2, recovery: 0.42, density: 1, movingSpeed: 0.95, warmup: 150 },
  belt: { world: 'belt', target: 7, tiers: [0.2, 0.42, 0.3, 0.08], maxBlockers: 2, minGap: 0.9, slack: 0.15, maxConsecutiveHard: 2, recovery: 0.4, density: 1, movingSpeed: 1.05, warmup: 120 },
  storm: { world: 'storm', target: 8, tiers: [0.1, 0.36, 0.38, 0.16], maxBlockers: 2, minGap: 0.84, slack: 0.13, maxConsecutiveHard: 3, recovery: 0.36, density: 1, movingSpeed: 1.15, warmup: 120 },
  volcano: { world: 'volcano', target: 9, tiers: [0.05, 0.3, 0.44, 0.21], maxBlockers: 2, minGap: 0.8, slack: 0.12, maxConsecutiveHard: 3, recovery: 0.34, density: 1, movingSpeed: 1.2, warmup: 120 },
  ice: { world: 'ice', target: 9, tiers: [0.05, 0.3, 0.44, 0.21], maxBlockers: 2, minGap: 0.8, slack: 0.12, maxConsecutiveHard: 3, recovery: 0.34, density: 1, movingSpeed: 1.2, warmup: 120 },
  mega: { world: 'mega', target: 8, tiers: [0.2, 0.37, 0.33, 0.1], maxBlockers: 2, minGap: 0.84, slack: 0.13, maxConsecutiveHard: 2, recovery: 0.4, density: 1, movingSpeed: 1.1, warmup: 120 },
};

/** Speed-level multipliers on the reaction rules (EASY gets more time, HARD less). */
export const LEVEL_RULES: Record<SpeedLevel, { gap: number; slack: number; tierShift: number }> = {
  easy: { gap: 1.18, slack: 0.12, tierShift: -1 },
  normal: { gap: 1, slack: 0, tierShift: 0 },
  hard: { gap: 0.92, slack: -0.04, tierShift: 1 },
};

/**
 * Tier probabilities at a point of the map:
 *  START (first 30 %): tier 3/4 damped, easy boosted — introduce mechanics
 *  MIDDLE: the map's distribution
 *  END (last 25 %): tier 3/4 slightly boosted — a final exciting stretch
 * `levelShift` (−1 easy / +1 hard) nudges the mix one step.
 */
export function tierWeights(cfg: MapDifficultyConfig, progress: number, inWarmup: boolean, levelShift: number): number[] {
  const w = [...cfg.tiers];
  // compensate for the recovery rules (a hard row is usually followed by an easier one),
  // so the observed mix lands near the map's target distribution
  const hard = cfg.tiers[2] + cfg.tiers[3];
  const comp = 1 / Math.max(0.35, 1 - hard * 0.85);
  w[2] *= comp;
  w[3] *= comp;
  if (inWarmup) {
    w[2] = 0;
    w[3] = 0;
  } else if (progress < 0.3) {
    w[0] *= 1.3;
    w[2] *= 0.45;
    w[3] *= 0.25;
  } else if (progress > 0.75) {
    w[2] *= 1.25;
    w[3] *= 1.3;
  }
  if (levelShift < 0) {
    w[0] *= 1.35;
    w[2] *= 0.6;
    w[3] *= 0.4;
  } else if (levelShift > 0) {
    w[0] *= 0.8;
    w[2] *= 1.25;
    w[3] *= 1.25;
  }
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  return w.map((x) => x / sum);
}

export const patternOf = (k: PatternKey) => PATTERNS[k];


// ===================================================================== v2 ENDLESS PHASES
/**
 * v2 Endless (docs/GAME-DESIGN.md §1): difficulty climbs by RANK PHASE, measured in EXP so every
 * speed level meets the same phase at the same point of its time line (Hard 3 min = Normal 6 = Easy 9).
 *
 *  D  → C   single blockers, wide gaps — learn left / right / up / down
 *  C  → B   two-lane blocks, first overhead beams / low barriers (vertical moves)
 *  B  → A   combos: hard rows chained, vehicle + blocker, laser gates, sliding platforms
 *  A  → AA  one safe lane, mega gates (one door), road speed +6 %
 *  AA → AAA rhythm chains at the fairness limit, road speed +10 %
 *  AAA      everything at once, road speed +14 %
 *
 * The last GATE.seconds before each new rank is a RANK GATE (next phase's mix, pushed harder);
 * right after it comes a short BREATHER. Every row still passes the reachability validator, and no
 * row ever needs a special item.
 */
/** the full rank ladder (Endless stops at AAA; Track 2 goes on to S / SS / SSS) */
export const RANK_ORDER = ['D', 'C', 'B', 'A', 'AA', 'AAA', 'S', 'SS', 'SSS'] as const;
export type PhaseRank = (typeof RANK_ORDER)[number];

/** v2 roads that use the rank phases */
export type Variant = 'endless' | 'track2';
export const VARIANTS: Record<Variant, { top: number; rateMul: number; shift: number }> = {
  endless: { top: 5, rateMul: 1, shift: 0 },
  track2: { top: 8, rateMul: EXP.track2.rateMul, shift: EXP.track2.phaseShift },
};

export interface PhaseConfig extends Omit<MapDifficultyConfig, 'world' | 'target' | 'warmup'> {
  rank: PhaseRank;
  /** road speed multiplier (eased in over the first `speedEase` metres of the phase) */
  speed: number;
  /** pattern weight multipliers — the phase's "signature" obstacles */
  boost: Partial<Record<PatternKey, number>>;
}

export const PHASES: PhaseConfig[] = [
  // v2.2.4: early phases brought back to v1's lively rhythm (v1 city → cloud → tunnel mix) — the D road was too empty
  { rank: 'D', tiers: [0.62, 0.36, 0.02, 0], maxBlockers: 2, minGap: 1.12, slack: 0.24, maxConsecutiveHard: 1, recovery: 0.5, density: 0.95, movingSpeed: 0.75, speed: 1, boost: { crate: 1.2, barrier: 1.2, ring: 1.4, beam: 1.2, low2: 1.3 } },
  { rank: 'C', tiers: [0.42, 0.43, 0.15, 0], maxBlockers: 2, minGap: 1.02, slack: 0.2, maxConsecutiveHard: 1, recovery: 0.46, density: 1, movingSpeed: 0.85, speed: 1, boost: { low2: 1.6, beam: 1.4, crateBeam: 1.5, trafficMix: 1.3 } },
  { rank: 'B', tiers: [0.25, 0.45, 0.25, 0.05], maxBlockers: 2, minGap: 0.95, slack: 0.17, maxConsecutiveHard: 2, recovery: 0.42, density: 1, movingSpeed: 0.95, speed: 1.03, boost: { trafficMix: 2, laser: 1.6, platform: 1.6, crateBeam: 1.3 } },
  { rank: 'A', tiers: [0.12, 0.43, 0.33, 0.12], maxBlockers: 2, minGap: 0.9, slack: 0.15, maxConsecutiveHard: 2, recovery: 0.4, density: 1, movingSpeed: 1.05, speed: 1.06, boost: { gate: 2.2, low2: 1.4, laser: 1.3 } },
  { rank: 'AA', tiers: [0.06, 0.36, 0.4, 0.18], maxBlockers: 2, minGap: 0.84, slack: 0.13, maxConsecutiveHard: 3, recovery: 0.36, density: 1, movingSpeed: 1.15, speed: 1.1, boost: { trafficMix: 1.5, laser: 1.5, gate: 1.6 } },
  { rank: 'AAA', tiers: [0.04, 0.3, 0.44, 0.22], maxBlockers: 2, minGap: 0.8, slack: 0.12, maxConsecutiveHard: 3, recovery: 0.34, density: 1, movingSpeed: 1.2, speed: 1.14, boost: { gate: 1.8, laser: 1.6, trafficMix: 1.6 } },
];

/** first phase (index into PHASES) in which a pattern may appear on Endless */
export const PHASE_UNLOCK: Record<PatternKey, number> = {
  crate: 0, barrier: 0, ring: 0, beam: 0, asteroid: 0, traffic: 0,
  low2: 0, crateBeam: 0, asteroid2: 0,
  trafficMix: 1, laser: 1, platform: 1, drone: 1, wall3: 9,
  gate: 2,
};

export const GATE = {
  /** seconds of rank gate before each new rank */
  seconds: 30,
  /** seconds of easier road right after a gate */
  breather: 8,
  /** gate pushes the next phase's hard tiers by this factor */
  hardBoost: 1.45,
  /** metres over which a phase's speed is eased in */
  speedEase: 600,
};

/** EXP per metre on a road at a speed level */
export const expRate = (level: SpeedLevel, v: Variant = 'endless') => EXP.rate[level] * VARIANTS[v].rateMul;
/** EXP of a run that has driven d metres */
export const expAtDist = (d: number, level: SpeedLevel, v: Variant = 'endless') => Math.max(0, d) * expRate(level, v);
/** distance at which rank i (index into RANK_ORDER) is reached */
export const rankDist = (i: number, level: SpeedLevel, v: Variant = 'endless') => EXP.rank[RANK_ORDER[Math.min(i, RANK_ORDER.length - 1)]] / expRate(level, v);
/** rank index (into RANK_ORDER) a run has reached at distance d — capped at the road's top rank */
export function rankIdxAt(d: number, level: SpeedLevel, v: Variant = 'endless') {
  const e = expAtDist(d, level, v);
  let i = 0;
  for (let k = 1; k <= VARIANTS[v].top; k++) if (e >= EXP.rank[RANK_ORDER[k]]) i = k;
  return i;
}
/** difficulty phase (index into PHASES) at distance d */
export const phaseAt = (d: number, level: SpeedLevel, v: Variant = 'endless') => Math.min(PHASES.length - 1, rankIdxAt(d, level, v) + VARIANTS[v].shift);
/** road speed multiplier of a rank index (Track 2 keeps speeding up past AAA) */
export function rankSpeed(i: number, v: Variant = 'endless') {
  const p = i + VARIANTS[v].shift;
  return PHASES[Math.min(PHASES.length - 1, p)].speed + Math.max(0, p - (PHASES.length - 1)) * EXP.track2.sSpeedStep;
}
