/** Vertical pass masks: which car heights get through a lane of a row. */
export const PASS_L = 1;
export const PASS_N = 2;
export const PASS_H = 4;
export const PASS_ALL = PASS_L | PASS_N | PASS_H;
export const PASS_NONE = 0;

export type ObstacleType =
  | 'crate'
  | 'barrier'
  | 'beam'
  | 'drone'
  | 'laser'
  | 'traffic'
  | 'ring'
  | 'platform'
  | 'asteroid'
  | 'gate';

export type LaserMode = 'low' | 'high' | 'block' | 'open';

export interface ObstacleSpec {
  type: ObstacleType;
  /** primary lane (0..2). For multi-lane types (laser/gate) it's ignored. */
  lane: number;
  /** second lane for sweeping types (drone/platform) */
  lane2?: number;
  /** laser gate per-lane configuration */
  laser?: [LaserMode, LaserMode, LaserMode];
  /** gate: the open door lane */
  door?: number;
  /** variant index for visuals */
  variant?: number;
  /** sweep speed multiplier for moving obstacles (map difficulty) */
  sweep?: number;
}

export interface RowSpec {
  /** run distance (m) at which the row reaches the car */
  dist: number;
  /** estimated seconds after the previous row */
  dt: number;
  masks: [number, number, number];
  obstacles: ObstacleSpec[];
  /** pattern library id / tier (debug + tests) */
  pid?: string;
  tier?: number;
  /** this row hides what is behind it (wall / gate) */
  occludes?: boolean;
}

export type PickupKind = 'coin' | 'shield' | 'magnet' | 'turbo' | 'double' | 'life' | 'super' | 'dash' | 'escape'
  // v2 Bonus-road specials: fire by themselves on pickup (showcase of the AAA specials)
  | 'hyper' | 'ghost' | 'wall' | 'rail' | 'tunnel'
  // v2.2 mystery box: a random reward (coins / road power-up / heart)
  | 'mystery';

export interface PickupSpec {
  kind: PickupKind;
  lane: number;
  dist: number;
  /** car height state the pickup sits at */
  y: number;
}

/** Axis-aligned box in obstacle-local space (x relative to world 0, y from road, z relative to row). */
export interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export const box = (cx: number, cy: number, cz: number, hx: number, hy: number, hz: number): Box => ({
  minX: cx - hx,
  maxX: cx + hx,
  minY: cy - hy,
  maxY: cy + hy,
  minZ: cz - hz,
  maxZ: cz + hz,
});
