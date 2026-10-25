import type { WorldId } from './Spawner.ts';
import type { Action } from '../core/Input.ts';
import { HEIGHT } from '../config.ts';
import { rowMasks } from './ObstacleRules.ts';
import type { ObstacleSpec, PickupSpec, RowSpec } from './types.ts';

/** One guided gesture: the game slows almost to a stop until the player does it. */
export interface TutorialStep {
  dist: number;
  /** gesture to wait for ('sos' = tap the Sky Escape button) */
  need: Action | 'sos' | 'rocket';
  title: string;
  sub: string;
  /** seconds before the obstacle when the prompt appears */
  lead: number;
  /** this UP fires the Roadster Jump */
  super?: boolean;
  /** lane-change lessons: the lane the car must reach. The prompt direction is worked out from
   *  where the car actually is when the prompt shows (free control in advanced training). */
  target?: number;
}

export const TUTORIAL_LENGTH = 640;

export const TUTORIAL_STEPS: TutorialStep[] = [
  { dist: 80, need: 'left', title: 'SWIPE LEFT', sub: 'One swipe moves exactly one lane. Dodge the crates!', lead: 0.8 },
  { dist: 160, need: 'right', title: 'SWIPE RIGHT', sub: 'Back to the middle lane.', lead: 0.8 },
  { dist: 245, need: 'up', title: 'SWIPE UP', sub: 'Hop over the barriers. One hop, then the car lands by itself.', lead: 0.5 },
  { dist: 330, need: 'down', title: 'SWIPE DOWN', sub: 'Tuck the wheels in and slide under the beams.', lead: 0.42 },
  { dist: 545, need: 'rocket', title: 'TAP ROADSTER!', sub: 'Your free special: a ROADSTER JUMP. Tap the purple button to rocket over the whole block!', lead: 0.6, super: true },
];

/** Short info captions shown without pausing. */
export const TUTORIAL_HINTS: { dist: number; text: string }[] = [
  { dist: 8, text: 'Drive as far as you can — distance is your EXP' },
  { dist: 352, text: 'Coins buy specials like the Roadster Jump' },
  { dist: 404, text: 'Road power-ups like Magnet, Turbo and ×2 EXP work at once' },
  { dist: 470, text: 'You carry 1 special per race — today: a free Roadster Jump' },
  { dist: 590, text: 'EXP gives your rank D → AAA. Hard rank gates guard every new rank!' },
];

const row = (dist: number, obstacles: ObstacleSpec[]): RowSpec => ({ dist, dt: 1, masks: rowMasks(obstacles), obstacles });

/** Hand-built practice road: crates (left), crates (right), barriers (up), beams (down), coins. */
export function tutorialScript(): { rows: RowSpec[]; pickups: PickupSpec[] } {
  const rows = [
    row(80, [{ type: 'crate', lane: 1, variant: 0 }, { type: 'crate', lane: 2, variant: 1 }]),
    row(160, [{ type: 'crate', lane: 0, variant: 2 }, { type: 'crate', lane: 2, variant: 3 }]),
    row(245, [0, 1, 2].map((lane) => ({ type: 'barrier' as const, lane, variant: 0 }))),
    row(330, [0, 1, 2].map((lane) => ({ type: 'beam' as const, lane, variant: 0 }))),
    row(455, [{ type: 'crate', lane: 1, variant: 0 }, { type: 'crate', lane: 2, variant: 2 }]),
    // four walls of cars across the whole road, spaced to the Roadster jump: one rocket clears all four
    ...[0, 1, 2, 3].map((k) => row(545 + k * 8, [0, 1, 2].map((lane) => ({ type: 'traffic' as const, lane, variant: lane === (k + 1) % 3 ? 4 : (lane + k) % 4 })))),
  ];
  const pickups: PickupSpec[] = [];
  for (let d = 30; d <= 66; d += 6) pickups.push({ kind: 'coin', lane: 1, dist: d, y: HEIGHT.NORMAL });
  for (let d = 360; d <= 396; d += 4) pickups.push({ kind: 'coin', lane: 1, dist: d, y: HEIGHT.NORMAL });
  return { rows, pickups };
}

// ============================================================================
// ADVANCED TRAINING — a guided tour of every obstacle used in one world
// ============================================================================

export interface TrainingScript {
  rows: RowSpec[];
  pickups: PickupSpec[];
  steps: TutorialStep[];
  hints: { dist: number; text: string }[];
  length: number;
  /** boosts handed out at the start (boost trainings) */
  grant?: { super?: number; hyper?: number; escape?: number; shield?: boolean };
  /** obstacles really hit (shield training: watch the shield absorb one) */
  vulnerable?: boolean;
  title?: string;
}

type Lesson = (lane: number, at: number) => { rows: RowSpec[]; step?: Omit<TutorialStep, 'dist'>; hint?: string; lane: number };

/** the free neighbour lane (prefers moving toward the middle) */
const side = (lane: number) => (lane === 0 ? 1 : lane === 2 ? 1 : 2);
const dirTo = (from: number, to: number): Action => (to < from ? 'left' : 'right');

const LESSONS: Record<string, Lesson> = {
  crate: (lane, at) => ({
    rows: [row(at, [{ type: 'crate', lane, variant: 1 }])],
    step: { need: 'up', title: 'CRATE', sub: 'Low cargo box: hop over it (or change lane).', lead: 0.5 },
    lane,
  }),
  barrier: (lane, at) => ({
    rows: [row(at, [0, 1, 2].map((l) => ({ type: 'barrier' as const, lane: l, variant: 0 })))],
    step: { need: 'up', title: 'ENERGY BARRIER', sub: 'Orange force field at road level: only a hop clears it.', lead: 0.5 },
    lane,
  }),
  beam: (lane, at) => ({
    rows: [row(at, [0, 1, 2].map((l) => ({ type: 'beam' as const, lane: l, variant: 0 })))],
    step: { need: 'down', title: 'BEAM', sub: 'Heavy block with a red underside: swipe DOWN and slide under.', lead: 0.42 },
    lane,
  }),
  traffic: (lane, at) => {
    const to = side(lane);
    return {
      rows: [row(at, [{ type: 'traffic', lane, variant: 1 }])],
      step: { need: dirTo(lane, to), title: 'ONCOMING TRAFFIC', sub: 'Red chevrons = a car racing toward you. It is too tall to hop: follow the GREEN arrow.', lead: 1.0, target: to },
      lane: to,
    };
  },
  drone: (lane, at) => {
    // from the middle: the drone sweeps lanes 0–1 → move right; from an edge it sweeps your lane → hop
    const pair: [number, number] = lane === 1 ? [0, 1] : lane === 0 ? [0, 1] : [1, 2];
    const target = lane === 1 ? 2 : lane;
    const need: Action = target === lane ? 'up' : dirTo(lane, target);
    return {
      rows: [row(at, [{ type: 'drone', lane: pair[0], lane2: pair[1], variant: 0 }])],
      step: {
        need,
        title: 'HUNTER DRONE',
        sub: need === 'up' ? 'It slides across the amber zone (⇄). Hop over it!' : 'It slides across the amber zone (⇄). Move to the lane with the GREEN arrow.',
        lead: need === 'up' ? 0.5 : 0.9,
        ...(need === 'up' ? {} : { target }),
      },
      lane: target,
    };
  },
  platform: (lane, at) => {
    const pair: [number, number] = lane === 0 ? [0, 1] : [1, 2];
    return {
      rows: [row(at, [{ type: 'platform', lane: pair[0], lane2: pair[1], variant: 1 }])],
      step: { need: 'up', title: 'SLIDING PLATFORM', sub: 'A floating slab sweeps across the amber zone. Hop over it.', lead: 0.5 },
      lane,
    };
  },
  ring: (lane, at) => ({
    rows: [row(at, [{ type: 'ring', lane, variant: 0 }])],
    hint: 'ENERGY RING ahead: drive through it on the road for bonus points — don\'t jump!',
    lane,
  }),
  laserLow: (lane, at) => ({
    rows: [row(at, [{ type: 'laser', lane: 0, laser: ['low', 'low', 'low'], variant: 0 }])],
    step: { need: 'up', title: 'LOW LASERS', sub: 'Red beams near the road: hop over them.', lead: 0.5 },
    lane,
  }),
  laserHigh: (lane, at) => ({
    rows: [row(at, [{ type: 'laser', lane: 0, laser: [0, 1, 2].map((l) => (l === lane ? 'high' : 'low')) as [LaserModeT, LaserModeT, LaserModeT], variant: 0 }])],
    step: { need: 'down', title: 'HIGH LASERS', sub: 'Beams from knee height up in your lane: swipe DOWN and duck under.', lead: 0.42 },
    lane,
  }),
  laserBlock: (lane, at) => {
    const to = side(lane);
    const cfg: [LaserModeT, LaserModeT, LaserModeT] = ['block', 'block', 'block'];
    cfg[to] = 'open';
    return {
      rows: [row(at, [{ type: 'laser', lane: 0, laser: cfg, variant: 0 }])],
      step: { need: dirTo(lane, to), title: 'LASER WALL', sub: 'Full wall of beams. Only the lane with the GREEN arrow is open.', lead: 0.9, target: to },
      lane: to,
    };
  },
  gate: (lane, at) => {
    const to = side(lane);
    return {
      rows: [row(at, [{ type: 'gate', lane: 1, door: to, variant: 0 }])],
      step: { need: dirTo(lane, to), title: 'MEGA GATE', sub: 'A wall across the road with ONE open door (green frame). Line up with it.', lead: 1.1, target: to },
      lane: to,
    };
  },
  asteroid: (lane, at) => {
    const to = side(lane);
    return {
      rows: [row(at, [{ type: 'asteroid', lane, variant: 0 }])],
      step: { need: dirTo(lane, to), title: 'ASTEROID', sub: 'Huge rock — too big to hop or duck. Change lane!', lead: 0.9, target: to },
      lane: to,
    };
  },
  wall3: (lane, at) => ({
    rows: [row(at, [0, 1, 2].map((l) => (l === lane ? { type: 'beam' as const, lane: l, variant: 0 } : { type: 'crate' as const, lane: l, variant: 2 })))],
    step: { need: 'down', title: 'TRIPLE WALL', sub: 'Every lane is blocked: a beam in yours → slide under.', lead: 0.42 },
    lane,
  }),
};
type LaserModeT = 'low' | 'high' | 'block' | 'open';

export const WORLD_LESSONS: Record<WorldId, { name: string; lessons: string[] }> = {
  city: { name: 'Future City', lessons: ['crate', 'traffic', 'beam', 'barrier', 'ring'] },
  tunnel: { name: 'Neon Tunnel', lessons: ['barrier', 'laserLow', 'beam', 'laserHigh', 'ring', 'laserBlock'] },
  cloud: { name: 'Cloud City', lessons: ['crate', 'platform', 'ring', 'beam', 'traffic'] },
  space: { name: 'Space Zone', lessons: ['asteroid', 'laserLow', 'asteroid', 'ring', 'crate'] },
  mega: { name: 'XWAVE Megacity', lessons: ['traffic', 'gate', 'laserHigh', 'laserBlock', 'beam'] },
  desert: { name: 'Desert Highway', lessons: ['crate', 'traffic', 'barrier', 'ring'] },
  forest: { name: 'Pine Forest', lessons: ['crate', 'beam', 'barrier', 'ring'] },
  country: { name: 'Country Road', lessons: ['traffic', 'crate', 'barrier', 'ring'] },
  sea: { name: 'Ocean Causeway', lessons: ['crate', 'beam', 'traffic', 'ring'] },
  harbor: { name: 'Neon Harbor', lessons: ['crate', 'traffic', 'beam'] },
  solar: { name: 'Solar Farms', lessons: ['barrier', 'beam', 'crate'] },
  canyon: { name: 'Crystal Canyon', lessons: ['crate', 'laserLow', 'beam'] },
  belt: { name: 'Asteroid Belt', lessons: ['asteroid', 'crate', 'laserLow'] },
  storm: { name: 'Storm Front', lessons: ['traffic', 'gate', 'beam'] },
  volcano: { name: 'Volcano Core', lessons: ['barrier', 'laserBlock', 'gate'] },
  ice: { name: 'Aurora Ice', lessons: ['crate', 'beam', 'gate'] },
};

export function advancedScript(world: WorldId): TrainingScript {
  const rows: RowSpec[] = [];
  const steps: TutorialStep[] = [];
  const hints: { dist: number; text: string }[] = [{ dist: 8, text: `${WORLD_LESSONS[world].name}: meet every obstacle of this world` }];
  const pickups: PickupSpec[] = [];
  let lane = 1;
  let at = 90;
  for (const key of WORLD_LESSONS[world].lessons) {
    const l = LESSONS[key](lane, at);
    rows.push(...l.rows);
    if (l.step) steps.push({ dist: at, ...l.step });
    if (l.hint) hints.push({ dist: at - 60, text: l.hint });
    lane = l.lane;
    // a few coins in the lane you end up in, as a reward
    for (let k = 1; k <= 4; k++) pickups.push({ kind: 'coin', lane, dist: at + 10 + k * 5, y: HEIGHT.NORMAL });
    at += 95;
  }
  return { rows, pickups, steps, hints, length: at + 10 };
}

export function basicScript(): TrainingScript {
  const s = tutorialScript();
  // v2: the Roadster Jump comes from the bag (one special per race), not from the road
  return { ...s, steps: TUTORIAL_STEPS, hints: TUTORIAL_HINTS, length: TUTORIAL_LENGTH, grant: { super: 1 } };
}

// ============================================================================
// BOOST TRAININGS — one short practice road per boost, opened from its info card
// ============================================================================
export type BoostKind = 'super' | 'hyper' | 'escape' | 'shield';

const carWall = (dist: number, truckLane: number): RowSpec =>
  row(dist, [0, 1, 2].map((lane) => ({ type: 'traffic' as const, lane, variant: lane === truckLane ? 4 : lane })));

export function boostScript(kind: BoostKind): TrainingScript {
  const hints: { dist: number; text: string }[] = [];
  const pickups: PickupSpec[] = [];
  switch (kind) {
    case 'super':
      hints.push({ dist: 10, text: 'Practice: your Roadster Jump is ready' });
      for (let d = 220; d <= 250; d += 5) pickups.push({ kind: 'coin', lane: 1, dist: d, y: HEIGHT.NORMAL });
      return {
        title: 'ROADSTER JUMP',
        rows: [carWall(140, 1), carWall(156, 0)],
        pickups,
        steps: [{ dist: 140, need: 'rocket', title: 'TAP ROADSTER!', sub: 'Cars block every lane — tap ROADSTER to hop over.', lead: 0.6, super: true }],
        hints,
        length: 270,
        grant: { super: 1 },
      };
    case 'hyper':
      hints.push({ dist: 10, text: 'Practice: your HYPER JUMP is ready' });
      return {
        title: 'HYPER JUMP',
        rows: [carWall(140, 1), carWall(156, 2), carWall(172, 0)],
        pickups,
        steps: [{ dist: 140, need: 'rocket', title: 'TAP HYPER!', sub: 'Three walls of cars — tap HYPER to fly over them all.', lead: 0.6, super: true }],
        hints,
        length: 300,
        grant: { hyper: 1 },
      };
    case 'escape':
      hints.push({ dist: 10, text: 'Practice: your SOS is ready' });
      return {
        title: 'SKY ESCAPE',
        rows: [carWall(140, 1), carWall(156, 0), carWall(172, 2), carWall(188, 1)],
        pickups,
        steps: [{ dist: 140, need: 'sos', title: 'TAP SOS!', sub: 'A convoy blocks the road — tap SOS to rocket up.', lead: 0.9 }],
        hints,
        length: 330,
        grant: { escape: 1 },
      };
    case 'shield':
      hints.push({ dist: 10, text: 'START SHIELD on: the blue bubble absorbs ONE hit' }, { dist: 90, text: 'Crates in every lane — just drive into them!' }, { dist: 170, text: 'Shield popped — you are safe. Next hit would cost a life' });
      return {
        title: 'START SHIELD',
        rows: [row(140, [0, 1, 2].map((lane) => ({ type: 'crate' as const, lane, variant: lane })))],
        pickups,
        steps: [],
        hints,
        length: 220,
        grant: { shield: true },
        vulnerable: true,
      };
  }
}
