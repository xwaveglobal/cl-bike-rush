import { LANES } from '../config.ts';
import {
  box,
  type Box,
  type ObstacleSpec,
  type LaserMode,
  PASS_ALL,
  PASS_H,
  PASS_L,
  PASS_N,
  PASS_NONE,
} from './types.ts';

/**
 * Single source of truth for every obstacle's collision volume and which car
 * heights pass it. The spawner's fairness check and the runtime collision both
 * read from here, so they can never disagree.
 *
 * Car heights (centre ± half): LOW 0.20–0.76, NORMAL 0.64–1.36, HIGH 2.69–3.41.
 */

const laserMask = (m: LaserMode) =>
  m === 'low' ? PASS_H : m === 'high' ? PASS_L : m === 'block' ? PASS_NONE : PASS_ALL;

export function rowMasks(obstacles: ObstacleSpec[]): [number, number, number] {
  const m: [number, number, number] = [PASS_ALL, PASS_ALL, PASS_ALL];
  for (const o of obstacles) {
    const lm = obstacleMasks(o);
    for (let i = 0; i < 3; i++) m[i] &= lm[i];
  }
  return m;
}

export function obstacleMasks(o: ObstacleSpec): [number, number, number] {
  const m: [number, number, number] = [PASS_ALL, PASS_ALL, PASS_ALL];
  switch (o.type) {
    case 'crate':
    case 'barrier':
      m[o.lane] = PASS_H;
      break;
    case 'beam':
      m[o.lane] = PASS_L;
      break;
    case 'drone':
    case 'platform':
      m[o.lane] = PASS_H;
      m[o.lane2 ?? o.lane] = PASS_H;
      break;
    case 'traffic':
    case 'asteroid':
      m[o.lane] = PASS_NONE;
      break;
    case 'ring':
      m[o.lane] = PASS_L | PASS_N;
      break;
    case 'laser':
      for (let i = 0; i < 3; i++) m[i] = laserMask(o.laser![i]);
      break;
    case 'gate':
      for (let i = 0; i < 3; i++) m[i] = i === o.door ? PASS_L | PASS_N : PASS_NONE;
      break;
  }
  return m;
}

/** Sweep parameters for moving obstacles, as a pure function of remaining distance. */
export function sweepX(o: ObstacleSpec, zRemaining: number): number {
  if (o.type !== 'drone' && o.type !== 'platform') return 0;
  const a = LANES[o.lane];
  const b = LANES[o.lane2 ?? o.lane];
  const mid = (a + b) / 2;
  const half = Math.abs(b - a) / 2;
  const k = (o.type === 'drone' ? 0.16 : 0.11) * (o.sweep ?? 1);
  return mid + half * Math.sin(zRemaining * k + (o.variant ?? 0) * 1.7);
}

/** Oncoming traffic closes faster than the road; it still arrives exactly with its row. */
export const TRAFFIC_CLOSING = 0.6;
export function zOffset(o: ObstacleSpec, zRemaining: number): number {
  return o.type === 'traffic' ? zRemaining * TRAFFIC_CLOSING : 0;
}

/** Local hitboxes. `sx` is the current sweep x (moving types) — x values are world space. */
export function hitboxes(o: ObstacleSpec, sx: number, out: Box[] = []): Box[] {
  out.length = 0;
  const lx = LANES[o.lane];
  switch (o.type) {
    case 'crate':
      out.push(box(lx, 0.85, 0, 0.85, 0.85, 0.85));
      break;
    case 'barrier':
      out.push(box(lx, 0.7, 0, 1.25, 0.65, 0.2));
      break;
    case 'beam':
      out.push(box(lx, 3.45, 0, 1.25, 2.5, 0.5));
      break;
    case 'drone':
      out.push(box(sx, 1.2, 0, 0.9, 0.7, 0.8));
      break;
    case 'platform':
      out.push(box(sx, 0.55, 0, 1.2, 0.55, 1.6));
      break;
    case 'traffic':
      out.push(box(lx, 1.6, 0, 0.85, 1.3, 1.8));
      break;
    case 'asteroid':
      out.push(box(lx, 1.3, 0, 1.1, 1.3, 1.1));
      break;
    case 'ring':
      out.push(box(lx, 2.65, 0, 1.45, 0.25, 0.25));
      out.push(box(lx - 1.3, 1.3, 0, 0.15, 1.3, 0.25));
      out.push(box(lx + 1.3, 1.3, 0, 0.15, 1.3, 0.25));
      break;
    case 'laser':
      for (let i = 0; i < 3; i++) {
        const x = LANES[i];
        const m = o.laser![i];
        if (m === 'low') out.push(box(x, 0.78, 0, 1.3, 0.68, 0.15));
        else if (m === 'high') out.push(box(x, 3.46, 0, 1.3, 2.54, 0.15));
        else if (m === 'block') out.push(box(x, 3, 0, 1.3, 3, 0.15));
      }
      break;
    case 'gate':
      for (let i = 0; i < 3; i++) {
        const x = LANES[i];
        if (i === o.door) out.push(box(x, 4.4, 0, 1.3, 2.0, 0.4));
        else out.push(box(x, 3.5, 0, 1.3, 3.5, 0.4));
      }
      break;
  }
  return out;
}

export const isMultiLane = (o: ObstacleSpec) => o.type === 'laser' || o.type === 'gate';
