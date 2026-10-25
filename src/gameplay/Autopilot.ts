import { CAR_HALF } from '../config.ts';
import type { Action } from '../core/Input.ts';
import { passOptions, MODE_H, MODE_L, MODE_N } from './Fairness.ts';
import { hitboxes } from './ObstacleRules.ts';
import { PASS_H, PASS_L, PASS_N, type Box, type RowSpec } from './types.ts';
import type { World } from './World.ts';

/**
 * Plays the game using only information a human sees (upcoming obstacles) and the
 * same inputs a human has. Used by the headless fairness test (it must never be
 * forced into a crash) and as a demo mode (`?autopilot`).
 */
export class Autopilot {
  private cooldown = 0;
  private tmp: Box[] = [];

  update(world: World, dt: number, send: (a: Action) => void) {
    this.cooldown -= dt;
    const p = world.player;
    const speed = Math.max(1, world.speed);
    const rows = world.upcoming.filter((r) => r.dist - world.dist > -this.halfDepth(r) - CAR_HALF.z - 0.2);
    if (!rows.length) return;
    const r0 = rows[0];
    const rem0 = r0.dist - world.dist;
    const depth0 = this.halfDepth(r0);
    // seconds until the near face of row 0 touches the car's nose
    const tFace0 = (rem0 - depth0 - CAR_HALF.z) / speed;
    const inZone = tFace0 < 0.04; // obstacles alongside the car: don't slide into them

    // ---------- lane planning (search next 3 rows)
    const curMode = p.heightState === 'HIGH' ? MODE_H : p.heightState === 'LOW' ? MODE_L : MODE_N;
    let best = { cost: Infinity, lane: p.lane };
    let N = Math.min(3, rows.length);
    const times = rows.slice(0, N).map((r) => (r.dist - world.dist) / speed);
    const search = (i: number, lane: number, mode: number, tPrev: number, cost: number, first: number) => {
      if (cost >= best.cost) return;
      if (i === N) {
        best = { cost, lane: first };
        return;
      }
      const r = rows[i];
      const dtAvail = times[i] - tPrev - (i === 0 ? 0.04 : 0.08);
      for (let b = 0; b < 3; b++) {
        if (i === 0 && inZone && b !== lane) continue;
        const lanes = Math.abs(b - lane);
        let travel = lanes * (i === 0 ? 0.24 : 0.27);
        // one lane per hop: moves beyond the allowance wait for touch-down
        if (lanes > 0 && tPrev < p.timeToLand) {
          const free = Math.min(lanes, p.airLanesLeft);
          if (lanes > free) travel = Math.max(travel, p.timeToLand - tPrev + (lanes - free) * 0.27 + 0.05);
        }
        for (const o of passOptions(r.masks[b], mode, i === 0 ? 0.3 : times[i] - tPrev)) {
          let oc = i === 0 ? Math.min(o.cost, 0.22) : o.cost;
          if (i === 0 && o.mode === MODE_H) {
            // the very next row: use the real jump state (one hop per beat, rest after landing)
            const tail = times[0] + 0.12;
            oc = p.airTimeLeft > tail ? 0 : p.airTimeLeft > 0 || !p.canJump ? p.jumpWait + 0.26 : 0.22;
          }
          if (travel + oc > dtAvail) continue;
          const c = cost + Math.abs(b - lane) * 1 + (o.mode !== MODE_N ? 0.6 : 0) + (b === 1 ? 0 : 0.05);
          search(i + 1, b, o.mode, times[i], c, i === 0 ? b : first);
        }
      }
    };
    // deepest plan that works; fall back to shorter horizons rather than freezing
    while (N > 0) {
      search(0, p.lane, curMode, 0, 0, p.lane);
      if (best.cost < Infinity) break;
      N--;
    }

    if (!inZone && best.lane !== p.lane && this.cooldown <= 0) {
      send(best.lane < p.lane ? 'left' : 'right');
      this.cooldown = 0.08;
    }

    // ---------- vertical
    const lane = p.lane;
    // find the first row that is not yet fully past the car
    for (const r of rows) {
      const rem = r.dist - world.dist;
      const depth = this.halfDepth(r);
      const tFace = (rem - depth - CAR_HALF.z) / speed;
      const tTail = (rem + depth + CAR_HALF.z) / speed;
      if (tTail < 0) continue;
      const m = r.masks[lane];
      if (tFace > 0.6) break;
      if (!(m & PASS_N) || (p.heightState === 'HIGH' && !(m & PASS_H))) {
        const wantHigh = !!(m & PASS_H) && (p.heightState !== 'LOW' || !(m & PASS_L));
        if (wantHigh) {
          const needPress = p.canJump; // one jump per beat, only from the road
          if (needPress && tFace < 0.24 && this.cooldown <= 0.05) {
            send('up');
            this.cooldown = Math.max(this.cooldown, 0.1);
          }
        } else if (m & PASS_L) {
          const needPress = p.vmode !== 'down' || p.vphase === 'recover' || (p.vphase === 'hold' && tTail > 0.25);
          if (needPress && tFace < (p.heightState === 'HIGH' ? 0.3 : 0.2) && this.cooldown <= 0.05) {
            send('down');
            this.cooldown = Math.max(this.cooldown, 0.1);
          }
        }
      }
      break;
    }
  }

  private halfDepth(r: RowSpec) {
    let d = 0.3;
    for (const o of r.obstacles) {
      for (const b of hitboxes(o, 0, this.tmp)) d = Math.max(d, (b.maxZ - b.minZ) / 2);
    }
    return d;
  }
}

export { PASS_L };
