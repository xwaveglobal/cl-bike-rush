import { LANES, HEIGHT, LEVELS, type SpeedLevel } from '../config.ts';
import { Player } from './Player.ts';
import { Spawner, speedAt, type WorldId } from './Spawner.ts';
import type { Variant } from './Difficulty.ts';
import type { Course } from './Courses.ts';
import { hitboxes, sweepX, zOffset } from './ObstacleRules.ts';
import type { Box, ObstacleSpec, PickupSpec, RowSpec } from './types.ts';
import { Rng } from '../core/Rng.ts';

export const SPAWN_AHEAD = 175;
const DESPAWN_BEHIND = 14;

let nextId = 1;

export interface LiveObstacle {
  id: number;
  spec: ObstacleSpec;
  row: RowSpec;
  /** world z of the obstacle origin (negative = ahead) */
  z: number;
  /** current sweep x for moving obstacles */
  sx: number;
  boxes: Box[];
  hit: boolean;
  smashed: boolean;
  passed: boolean;
  /** closest clearance while overlapping in z (for near misses) */
  minGap: number;
  /** z velocity this frame (m/s), for swept collision and visuals */
  vz: number;
  /** renderer handle */
  view?: unknown;
}

export interface LivePickup {
  id: number;
  spec: PickupSpec;
  x: number;
  y: number;
  z: number;
  attracted: boolean;
  collected: boolean;
  view?: unknown;
}

export type WorldEvent =
  | { type: 'hit'; o: LiveObstacle }
  | { type: 'smash'; o: LiveObstacle }
  | { type: 'pass'; o: LiveObstacle; gap: number }
  | { type: 'ring'; o: LiveObstacle }
  | { type: 'pickup'; p: LivePickup }
  | { type: 'world'; world: WorldId };

export interface WorldHooks {
  spawnObstacle?: (o: LiveObstacle) => void;
  despawnObstacle?: (o: LiveObstacle) => void;
  spawnPickup?: (p: LivePickup) => void;
  despawnPickup?: (p: LivePickup) => void;
}

export interface StepOptions {
  invulnerable: boolean;
  smash: boolean; // turbo: obstacles explode on contact
  magnet: boolean;
  magnetRadius: number;
  speedMul: number;
}

/**
 * Pure simulation of the run: scrolling obstacles/pickups toward the car (the
 * car sits at z = 0, the world moves — keeps float precision perfect on long runs),
 * swept AABB collision, near-miss tracking and pickup collection.
 */
export class World {
  player = new Player();
  spawner: Spawner;
  dist = 0;
  speed = speedAt(0);
  time = 0;
  obstacles: LiveObstacle[] = [];
  pickups: LivePickup[] = [];
  /** rows not yet passed (for autopilot/fairness tooling) */
  upcoming: RowSpec[] = [];
  world: WorldId = 'city';
  hooks: WorldHooks = {};
  private carBox: Box = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
  private events: WorldEvent[] = [];

  constructor(seed?: number) {
    this.spawner = new Spawner(new Rng(seed));
  }

  /** @param startDist start the run further down the road (tests / debug "jump to a rank") */
  reset(seed?: number, course: Course | null = null, level: SpeedLevel = 'normal', startDist = 0, variant: Variant = 'endless') {
    this.spawner.course = course;
    this.spawner.variant = variant;
    this.spawner.speedMul = LEVELS[level].speed;
    this.spawner.gapMul = LEVELS[level].gap;
    this.spawner.level = level;
    for (const o of this.obstacles) this.hooks.despawnObstacle?.(o);
    for (const p of this.pickups) this.hooks.despawnPickup?.(p);
    this.obstacles.length = 0;
    this.pickups.length = 0;
    this.upcoming.length = 0;
    if (seed !== undefined) this.spawner.rng = new Rng(seed);
    this.spawner.reset(startDist);
    this.player.reset(1);
    this.dist = startDist;
    this.time = 0;
    this.speed = this.spawner.speed(startDist);
    this.world = this.spawner.worldAt(startDist);
  }

  /** Clear everything near the car (used after a respawn). */
  clearAhead(meters: number) {
    const keep: LiveObstacle[] = [];
    for (const o of this.obstacles) {
      if (o.z > -meters) this.hooks.despawnObstacle?.(o);
      else keep.push(o);
    }
    this.obstacles = keep;
    this.upcoming = this.upcoming.filter((r) => r.dist - this.dist > meters);
    // and make sure the spawner does not place rows inside the cleared zone
    while (this.spawner.rows.length && this.spawner.rows[0].dist - this.dist < meters) this.spawner.rows.shift();
    this.spawner.resetReach(this.player.lane);
  }

  step(dt: number, opt: StepOptions): WorldEvent[] {
    const ev = this.events;
    ev.length = 0;
    this.time += dt;
    // v2.2: the road speed glides to its target (level, rank phase, turbo, respawn) — never a jolt
    const want = this.spawner.speed(this.dist) * opt.speedMul;
    this.speed += (want - this.speed) * Math.min(1, dt * (want < this.speed ? 3 : 4));
    if (Math.abs(want - this.speed) < 0.05) this.speed = want;
    const dz = this.speed * dt;
    this.dist += dz;

    const w = this.spawner.worldAt(this.dist);
    if (w !== this.world) {
      this.world = w;
      ev.push({ type: 'world', world: w });
    }

    this.player.update(dt);

    // ---- spawn
    const sp = this.spawner;
    sp.generateUntil(this.dist + SPAWN_AHEAD + 60);
    while (sp.rows.length && sp.rows[0].dist - this.dist < SPAWN_AHEAD) {
      this.spawnRow(sp.rows.shift()!);
    }
    while (sp.pickups.length && sp.pickups[0].dist - this.dist < SPAWN_AHEAD) {
      const spec = sp.pickups.shift()!;
      const p: LivePickup = {
        id: nextId++,
        spec,
        x: LANES[spec.lane],
        y: spec.y,
        z: -(spec.dist - this.dist),
        attracted: false,
        collected: false,
      };
      this.pickups.push(p);
      this.hooks.spawnPickup?.(p);
    }
    while (this.upcoming.length && this.upcoming[0].dist < this.dist - 6) this.upcoming.shift();

    // ---- obstacles
    const car = this.player.hitbox(this.carBox);
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      const prevZ = o.z;
      this.placeObstacle(o, dt);
      const moved = Math.max(0, o.z - prevZ);
      if (!o.hit && !o.smashed) {
        let overlapZ = false;
        let collide = false;
        let gap = Infinity;
        for (const b of o.boxes) {
          // swept along z: union of previous and current position
          const zMin = b.minZ - moved;
          if (car.maxZ < zMin || car.minZ > b.maxZ) continue;
          overlapZ = true;
          const gx = Math.max(b.minX - car.maxX, car.minX - b.maxX);
          const gy = Math.max(b.minY - car.maxY, car.minY - b.maxY);
          const g = Math.max(gx, gy);
          if (g < 0) collide = true;
          else gap = Math.min(gap, g);
        }
        if (collide) {
          if (opt.smash) {
            o.smashed = true;
            ev.push({ type: 'smash', o });
          } else if (!opt.invulnerable) {
            o.hit = true;
            ev.push({ type: 'hit', o });
          }
        } else if (overlapZ) {
          o.minGap = Math.min(o.minGap, gap);
        }
      }
      // passed the car entirely?
      if (!o.passed && this.boxesBehind(o)) {
        o.passed = true;
        if (!o.hit && !o.smashed) {
          ev.push({ type: 'pass', o, gap: o.minGap });
          if (o.spec.type === 'ring' && Math.abs(this.player.x - LANES[o.spec.lane]) < 0.9 && this.player.y < 2.3)
            ev.push({ type: 'ring', o });
        }
      }
      if (o.z > DESPAWN_BEHIND + 8) {
        this.hooks.despawnObstacle?.(o);
        this.obstacles.splice(i, 1);
      }
    }

    // ---- pickups
    const px = this.player.x;
    const py = this.player.y;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      const prevZ = p.z;
      if (p.attracted) {
        const k = 1 - Math.exp(-12 * dt);
        p.x += (px - p.x) * k;
        p.y += (py - p.y) * k;
        p.z += (0 - p.z) * k + dz * 0.15;
      } else {
        p.z += dz;
        if (
          opt.magnet &&
          p.spec.kind === 'coin' &&
          p.z > -opt.magnetRadius * 1.6 &&
          p.z < 1 &&
          Math.abs(p.x - px) < opt.magnetRadius
        )
          p.attracted = true;
      }
      if (!p.collected) {
        const zLo = Math.min(prevZ, p.z) - 0.5;
        const zHi = Math.max(prevZ, p.z) + 0.5;
        const inZ = zHi > -1.1 && zLo < 1.1;
        const r = p.spec.kind === 'coin' ? 1.05 : 1.25;
        if (inZ && Math.abs(p.x - px) < r && Math.abs(p.y - py) < r + 0.15) {
          p.collected = true;
          ev.push({ type: 'pickup', p });
        }
      }
      if (p.collected || p.z > DESPAWN_BEHIND) {
        this.hooks.despawnPickup?.(p);
        this.pickups.splice(i, 1);
      }
    }
    return ev;
  }

  /** a row reaches spawn distance: its obstacles go live */
  private spawnRow(row: RowSpec) {
    this.upcoming.push(row);
    for (const spec of row.obstacles) {
      const o: LiveObstacle = {
        id: nextId++,
        spec,
        row,
        z: 0,
        sx: 0,
        boxes: [],
        hit: false,
        smashed: false,
        passed: false,
        minGap: Infinity,
        vz: this.speed,
      };
      this.placeObstacle(o, 0);
      this.obstacles.push(o);
      this.hooks.spawnObstacle?.(o);
    }
  }

  /** v2.2 Bonus set pieces: rows added after the fact (rows already in view spawn at once, the rest queue) */
  injectRows(rows: RowSpec[]) {
    for (const row of rows) {
      if (row.dist - this.dist < SPAWN_AHEAD) {
        this.spawnRow(row);
        this.upcoming.sort((a, b) => a.dist - b.dist);
      } else {
        this.spawner.rows.push(row);
        this.spawner.rows.sort((a, b) => a.dist - b.dist);
      }
    }
  }

  private placeObstacle(o: LiveObstacle, dt: number) {
    const rem = o.row.dist - this.dist; // metres until the row reaches the car
    const prev = o.z;
    o.z = -(rem + zOffset(o.spec, Math.max(0, rem)));
    o.vz = dt > 0 ? (o.z - prev) / dt : this.speed;
    o.sx = sweepX(o.spec, rem);
    hitboxes(o.spec, o.sx, o.boxes);
    for (const b of o.boxes) {
      b.minZ += o.z;
      b.maxZ += o.z;
    }
  }

  private boxesBehind(o: LiveObstacle) {
    for (const b of o.boxes) if (b.minZ < this.carBox.maxZ) return false;
    return true;
  }

  /** Lane-height helpers for UI/debug */
  static heightOf(state: 'LOW' | 'NORMAL' | 'HIGH') {
    return HEIGHT[state];
  }
}
