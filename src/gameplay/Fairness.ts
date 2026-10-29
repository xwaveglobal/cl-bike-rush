import { FAIRNESS } from '../config.ts';
import { PASS_H, PASS_L, PASS_N } from './types.ts';

/**
 * Reachability model for "can a player get through this sequence of rows?".
 * State = (lane 0..2, mode) where mode is the height the car is committed to
 * when it reaches a row: 0 = normal/free, 1 = high, 2 = low.
 * Represented as a 9-bit set: bit = lane * 3 + mode.
 */
export const MODE_N = 0;
export const MODE_H = 1;
export const MODE_L = 2;
/** passed a free row while possibly still airborne from an earlier jump */
export const MODE_A = 3;
const MODES = 4;

export const stateBit = (lane: number, mode: number) => 1 << (lane * MODES + mode);
export const START_STATE = stateBit(1, MODE_N);

/** Car stays in the air (or low) this long after the row it dodged. */
const LINGER = 0.85;
/** Two HIGH rows this close can be cleared by the same single jump. */
const SAME_JUMP = 0.42;
/** Worst case to come down from a jump, rest and be HIGH again. */
const REJUMP = 1.3;

export interface Option {
  mode: number;
  cost: number;
}

/** Ways to pass a lane with mask `m`, coming from `fromMode`, `dt` seconds after the previous row. */
export function passOptions(m: number, fromMode: number, dt: number): Option[] {
  const v = FAIRNESS.verticalTime;
  const opts: Option[] = [];
  if (m === 0) return opts;
  if (m & PASS_N) {
    const stillHigh = (fromMode === MODE_H || fromMode === MODE_A) && dt < LINGER;
    const stillLow = fromMode === MODE_L && dt < LINGER;
    if (stillHigh) {
      if (m & PASS_H) opts.push({ mode: MODE_A, cost: 0 });
      else opts.push({ mode: m & PASS_L ? MODE_L : MODE_N, cost: v }); // must drop
    } else if (stillLow) {
      if (m & PASS_L) opts.push({ mode: MODE_L, cost: 0 });
      else opts.push({ mode: MODE_N, cost: v });
    } else {
      opts.push({ mode: MODE_N, cost: 0 });
    }
    return opts;
  }
  if (m & PASS_H) {
    // one jump covers rows close together; otherwise the car must land, rest and jump again
    const cost = fromMode === MODE_H ? (dt <= SAME_JUMP ? 0 : REJUMP) : fromMode === MODE_A ? REJUMP : v;
    opts.push({ mode: MODE_H, cost });
  }
  if (m & PASS_L) opts.push({ mode: MODE_L, cost: fromMode === MODE_L && dt < LINGER ? 0 : v });
  return opts;
}

/**
 * Advance the reachable set through one row. Returns 0 if the row is unavoidable.
 * `slack` = reaction-time margin every forced move must leave (map/level dependent):
 * a lane switch or dodge only counts if it fits in the gap WITH that margin to spare.
 */
export function step(reach: number, masks: readonly number[], dt: number, slack = 0): number {
  if (dt < FAIRNESS.minRowTime) return 0;
  let next = 0;
  for (let a = 0; a < 3; a++) {
    for (let ma = 0; ma < MODES; ma++) {
      if (!(reach & stateBit(a, ma))) continue;
      // in the air the car may change lane only once per hop: a 2-lane move from an
      // airborne state needs the car to land first (≈ LINGER) before the second lane
      const airborne = ma === MODE_H || ma === MODE_A;
      for (let b = 0; b < 3; b++) {
        const lanes = Math.abs(a - b);
        let travel = lanes * FAIRNESS.laneStepTime;
        if (airborne && lanes === 2) travel = Math.max(travel, LINGER + FAIRNESS.laneStepTime);
        for (const o of passOptions(masks[b], ma, dt)) {
          // staying up in the same hop can't cover two lanes
          if (airborne && lanes === 2 && o.cost === 0 && (o.mode === MODE_H || o.mode === MODE_A)) continue;
          const need = travel + o.cost;
          if (need + (need > 0 ? slack : 0) <= dt) next |= stateBit(b, o.mode);
        }
      }
    }
  }
  return next;
}

export function lanesOf(reach: number): number[] {
  const out: number[] = [];
  for (let l = 0; l < 3; l++) if (reach & (0b1111 << (l * MODES))) out.push(l);
  return out;
}

export function modeIn(reach: number, lane: number): number {
  for (let m = 0; m < MODES; m++) if (reach & stateBit(lane, m)) return m;
  return -1;
}

export { PASS_H, PASS_L, PASS_N };
