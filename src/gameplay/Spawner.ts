import { HEIGHT, SPEED, WORLD_LENGTH, FAIRNESS, COIN_LINES, HEARTS, EXP, BONUS_SET, GIFTS } from '../config.ts';
import { clamp01, lerp } from '../core/math.ts';
import { Rng } from '../core/Rng.ts';
import { START_STATE, step, lanesOf, modeIn, MODE_H, MODE_L, stateBit } from './Fairness.ts';
import { rowMasks } from './ObstacleRules.ts';
import type { LaserMode, ObstacleSpec, PickupKind, PickupSpec, RowSpec } from './types.ts';
import { sectionAt, type Course, type PatternKey } from './Courses.ts';
import { PASS_ALL, PASS_N } from './types.ts';
/** extra seconds after a jump/duck row: land, settle, see the next obstacle */
const VERTICAL_RECOVERY = 0.7;
import { MAPS, LEVEL_RULES, PATTERNS, tierWeights, type Tier, type MapDifficultyConfig, PHASES, PHASE_UNLOCK, GATE, RANK_ORDER, rankDist, rankIdxAt, rankSpeed, VARIANTS, expRate, expAtDist, type PhaseRank, type Variant } from './Difficulty.ts';
import type { SpeedLevel } from '../config.ts';

/** Base speed is a pure function of distance so spawn timing can be predicted exactly. */
export function speedAt(dist: number) {
  return SPEED.start + (SPEED.max - SPEED.start) * (1 - Math.exp(-dist / SPEED.rampDistance));
}

// endless world order follows the difficulty ladder: 2/10 → 4 → 6 → 8 → 9
export const WORLDS = ['city', 'cloud', 'tunnel', 'space', 'mega'] as const;
/** v2.1 Endless ladder worlds (new places between the original five) */
export const LADDER_WORLDS = ['harbor', 'solar', 'canyon', 'belt', 'storm', 'volcano', 'ice'] as const;
export type LadderWorld = (typeof LADDER_WORLDS)[number];
/** v2 Bonus event roads (docs/GAME-DESIGN.md §5): everyday places, one per event, rotating */
export const BONUS_WORLDS = ['desert', 'forest', 'country', 'sea'] as const;
export type BonusWorld = (typeof BONUS_WORLDS)[number];
export type WorldId = (typeof WORLDS)[number] | BonusWorld | LadderWorld;
/**
 * v2.1 Endless: 12 worlds, two per rank (the second ends at that rank's gate), so nothing repeats
 * before AAA; after AAA the ladder loops. Same order and minutes on every speed level (EXP-based).
 */
export const ENDLESS_LADDER: WorldId[] = ['city', 'harbor', 'cloud', 'solar', 'tunnel', 'canyon', 'space', 'belt', 'mega', 'storm', 'volcano', 'ice'];
/** EXP at which each ladder world starts (D, mid-D, C, mid-C … AAA, AAA+6k) and the loop span after AAA */
export function ladderStarts(): number[] {
  const r = EXP.rank;
  const t = [r.D, r.C, r.B, r.A, r.AA, r.AAA];
  const out: number[] = [];
  for (let i = 0; i < 5; i++) out.push(t[i], (t[i] + t[i + 1]) / 2);
  out.push(t[5], t[5] + LADDER_AAA_WORLD);
  return out;
}
export const LADDER_AAA_WORLD = 6000;
/** ladder world index + EXP where the next world starts, for a run's EXP */
export function ladderAt(e: number): { idx: number; nextExp: number } {
  const st = ladderStarts();
  const end = st[11] + LADDER_AAA_WORLD;
  if (e < end) {
    let i = 0;
    for (let k = 0; k < 12; k++) if (e >= st[k]) i = k;
    return { idx: i, nextExp: i < 11 ? st[i + 1] : end };
  }
  const k = Math.floor((e - end) / LADDER_AAA_WORLD);
  return { idx: k % 12, nextExp: end + (k + 1) * LADDER_AAA_WORLD };
}
export const TRACK2_WORLDS: WorldId[] = ['mega', 'space', 'tunnel'];
export const worldAt = (dist: number): WorldId => WORLDS[Math.floor(dist / WORLD_LENGTH) % WORLDS.length];

type Pattern = { k: PatternKey; w: number; make: () => ObstacleSpec[]; heavy?: boolean };

export interface SetPiece {
  kind: PickupKind;
  pick: number;
  from: number;
  to: number;
  filled?: boolean;
}

/**
 * Generates rows of obstacles plus coin/power-up lines ahead of the player.
 * Every candidate row is validated against the reachability model; patterns that
 * would make the run unwinnable are discarded and re-rolled.
 */
export class Spawner {
  rows: RowSpec[] = [];
  pickups: PickupSpec[] = [];
  private reach = START_STATE;
  private lastDist = 0;
  private coinLane = 1;
  private nextPowerAt = 320;
  private nextHeartAt = 2500;
  private nextBoxAt = 400;
  rejected = 0;
  generated = 0;
  /** v2.2 Bonus: stretches reserved for a special's set piece (filled only once its pickup is collected) */
  setPieces: SetPiece[] = [];
  private pendingSet: PickupKind | null = null;
  private tunnelOffered = new Set<number>();
  /** Track mode course (null = endless) */
  course: Course | null = null;
  /** speed level multipliers (see config LEVELS) */
  speedMul = 1;
  gapMul = 1;
  level: SpeedLevel = 'normal';
  /** v2 road when course is null: Endless or Track 2 */
  variant: Variant = 'endless';
  /** difficulty bookkeeping */
  private prevRecovery = 0;
  private prevOccludes = false;
  private hardStreak = 0;
  /** why candidate patterns were rejected (debug / tests) */
  rejectStats: Record<string, number> = {};
  private reject(why: string) {
    this.rejected++;
    this.rejectStats[why] = (this.rejectStats[why] ?? 0) + 1;
  }

  private get off() {
    return this.course?.diffOffset ?? 0;
  }
  /** Base speed at a run distance, including the course's difficulty offset (and, on Endless, the rank phase). */
  speed(d: number) {
    return speedAt(d + this.off) * this.speedMul * (this.course ? 1 : this.phaseSpeed(d));
  }

  /** v2 Endless / Track 2: road speed multiplier of the rank reached, eased in after each new rank */
  phaseSpeed(d: number) {
    const v = this.variant;
    const i = rankIdxAt(d, this.level, v);
    if (i === 0) return rankSpeed(0, v);
    const k = Math.min(1, Math.max(0, (d - rankDist(i, this.level, v)) / GATE.speedEase));
    return rankSpeed(i - 1, v) + (rankSpeed(i, v) - rankSpeed(i - 1, v)) * k;
  }

  /**
   * v2: where on the rank ladder distance d is.
   *  phase    — difficulty phase (index into PHASES)
   *  gate     — the last GATE.seconds before rank `next` (hardest stretch)
   *  breather — a few seconds of easier road right after a new rank
   */
  zoneAt(d: number): { phase: number; kind: 'normal' | 'gate' | 'breather'; next: PhaseRank | null; from: number; to: number } {
    const lv = this.level;
    const v = this.variant;
    const sh = VARIANTS[v].shift;
    const i = rankIdxAt(d, lv, v);
    const phase = Math.min(PHASES.length - 1, i + sh);
    if (i + 1 <= VARIANTS[v].top) {
      const to = rankDist(i + 1, lv, v);
      const from = to - GATE.seconds * speedAt(to) * this.speedMul * rankSpeed(i, v);
      if (d >= from) return { phase, kind: 'gate', next: RANK_ORDER[i + 1], from, to };
    }
    if (i > 0) {
      const at = rankDist(i, lv, v);
      const end = at + GATE.breather * speedAt(at) * this.speedMul * rankSpeed(i, v);
      if (d < end) return { phase, kind: 'breather', next: null, from: at, to: end };
    }
    return { phase, kind: 'normal', next: null, from: 0, to: 0 };
  }

  /** v2 Endless: difficulty config at distance d (phase / gate / breather) */
  private phaseCfg(d: number, world: WorldId): MapDifficultyConfig {
    const z = this.zoneAt(d);
    if (z.kind === 'gate') {
      const nx = PHASES[Math.min(PHASES.length - 1, z.phase + 1)];
      const t = [...nx.tiers] as [number, number, number, number];
      t[2] *= GATE.hardBoost;
      t[3] *= GATE.hardBoost;
      const sum = t[0] + t[1] + t[2] + t[3];
      return { ...nx, world, target: 10, tiers: t.map((x) => x / sum) as [number, number, number, number], maxConsecutiveHard: nx.maxConsecutiveHard + 1, density: 1, warmup: 0 };
    }
    const ph = PHASES[z.phase];
    if (z.kind === 'breather') return { ...ph, world, target: 2, tiers: [0.75, 0.25, 0, 0], maxConsecutiveHard: 0, density: 0.7, minGap: ph.minGap * 1.2, warmup: 0 };
    return { ...ph, world, target: 2 + z.phase * 1.6, warmup: 250 };
  }
  worldAt(d: number): WorldId {
    if (this.course) return this.course.world;
    // Track 2 runs through the hard-looking worlds only
    if (this.variant === 'track2') return TRACK2_WORLDS[Math.floor(d / WORLD_LENGTH) % TRACK2_WORLDS.length];
    return ENDLESS_LADDER[ladderAt(expAtDist(d, this.level, this.variant)).idx];
  }

  /** distance where the scenery changes next (portal + preload) */
  nextWorldAt(d: number): { at: number; world: WorldId } {
    if (this.course || this.variant === 'track2') {
      const at = (Math.floor(d / WORLD_LENGTH) + 1) * WORLD_LENGTH;
      return { at, world: this.worldAt(at) };
    }
    const rate = expRate(this.level, this.variant);
    const at = ladderAt(expAtDist(d, this.level, this.variant)).nextExp / rate;
    return { at, world: this.worldAt(at + 1) };
  }

  constructor(public rng = new Rng()) {}

  reset(startDist = 0) {
    this.scripted = false;
    this.setPieces = [];
    this.pendingSet = null;
    this.tunnelOffered.clear();
    this.rows.length = 0;
    this.pickups.length = 0;
    this.reach = START_STATE;
    this.lastDist = startDist + 45; // first row comes after a short warm-up
    this.coinLane = 1;
    this.nextPowerAt = startDist + 300;
    this.nextHeartAt = startDist + HEARTS.everyExp / expRate(this.level, this.variant);
    this.nextBoxAt = startDist + 400;
    this.prevRecovery = 0;
    this.prevOccludes = false;
    this.hardStreak = 0;
  }

  /** map config + progress through the map at distance d */
  mapAt(d: number) {
    const world = this.worldAt(d);
    if (!this.course) {
      // v2 Endless: the rank phase sets the difficulty; the world only changes the scenery / pattern set
      const cfg = this.phaseCfg(d, world);
      return { world, cfg, progress: 0.5, warmup: d < cfg.warmup };
    }
    const cfg = MAPS[world];
    const c = this.course;
    const local = c ? d : d % WORLD_LENGTH;
    const progress = c ? d / c.length : local / WORLD_LENGTH;
    return { world, cfg, progress, warmup: local < cfg.warmup };
  }

  /** After a respawn the player is in a known lane at normal height. */
  resetReach(lane: number) {
    this.reach = stateBit(lane, 0) | stateBit(0, 0) | stateBit(1, 0) | stateBit(2, 0);
  }

  /**
   * ROADSTER showcase: two full-width walls of cars that only a rocket jump clears.
   * Only injected by the game while the player holds a jump charge (and removed again
   * if the charge is lost before arrival) — it never goes through the fairness model.
   */
  injectBlockade(): RowSpec[] {
    const d0 = this.lastDist + this.speed(this.lastDist) * 1.7;
    const wall = (dist: number, v: number): RowSpec => {
      // a semi truck flanked by cars, like a real road block
      const obstacles: ObstacleSpec[] = [0, 1, 2].map((lane) => ({ type: 'traffic', lane, variant: lane === (v ? 0 : 1) ? 4 : (v + lane) % 4 }));
      return { dist, dt: 1.7, masks: rowMasks(obstacles), obstacles };
    };
    const rows = [wall(d0, 0), wall(d0 + 16, 1)];
    this.rows.push(...rows);
    // long, empty run-out after the landing; any lane is fine afterwards
    this.lastDist = d0 + 16 + this.speed(d0) * 1.6;
    this.reach = stateBit(0, 0) | stateBit(1, 0) | stateBit(2, 0);
    return rows;
  }

  /** v2.2 Bonus: tunnel sections along the road (scenery + Tunnel Rider) */
  tunnels(): { from: number; to: number }[] {
    const c = this.course;
    if (!c?.bonus) return [];
    return BONUS_SET.tunnels.map((f) => {
      const mid = Math.round(c.length * f);
      return { from: mid - BONUS_SET.tunnelLen / 2, to: mid + BONUS_SET.tunnelLen / 2 };
    });
  }

  /** reserve an empty stretch for a set piece: pickup (with a short coin line to it), then nothing */
  private reserve(kind: PickupKind, pick: number, from: number, to: number) {
    for (let i = 4; i >= 1; i--) if (pick - i * 4 > this.lastDist + 3) this.pickups.push({ kind: 'coin', lane: 1, dist: pick - i * 4, y: HEIGHT.NORMAL });
    this.pickups.push({ kind, lane: 1, dist: pick, y: HEIGHT.NORMAL });
    this.pickups.sort((a, b) => a.dist - b.dist);
    this.setPieces.push({ kind, pick, from, to });
    this.lastDist = to + 22;
    this.reach = stateBit(0, 0) | stateBit(1, 0) | stateBit(2, 0);
    this.prevRecovery = 0;
    this.prevOccludes = false;
    this.hardStreak = 0;
    return true;
  }

  private trySetPiece(): boolean {
    const c = this.course!;
    const L = this.lastDist;
    // Tunnel Rider: only right in front of a tunnel
    for (const t of this.tunnels()) {
      if (this.tunnelOffered.has(t.from)) continue;
      const ahead = t.from - L;
      if (ahead <= BONUS_SET.lead + 30 && ahead > BONUS_SET.lead + 8) {
        this.tunnelOffered.add(t.from);
        if (this.rng.chance(BONUS_SET.tunnelChance)) return this.reserve('tunnel', t.from - BONUS_SET.lead, t.from, t.to);
      }
    }
    if (!this.pendingSet) return false;
    const k = this.pendingSet;
    const pick = L + 30;
    const from = pick + BONUS_SET.lead;
    const to = from + (BONUS_SET.len[k] ?? 40);
    // never into a tunnel or the finish run-out (try again later)
    if (to > c.length - 90) {
      this.pendingSet = null;
      return false;
    }
    if (this.tunnels().some((t) => to > t.from - 120 && pick < t.to + 20)) return false;
    this.pendingSet = null;
    return this.reserve(k, pick, from, to);
  }

  /** the obstacles of a set piece (only built once its pickup is collected; the special clears them) */
  buildSetPiece(sp: SetPiece): RowSpec[] {
    const r = this.rng;
    const mk = (dist: number, obstacles: ObstacleSpec[]): RowSpec => ({ dist, dt: 1, masks: rowMasks(obstacles), obstacles });
    const cars = (dist: number, v: number) => mk(dist, [0, 1, 2].map((lane) => ({ type: 'traffic' as const, lane, variant: lane === v % 3 ? 4 : (v + lane) % 4 })));
    const out: RowSpec[] = [];
    const { from, to } = sp;
    switch (sp.kind) {
      case 'super':
        // 4 car walls spaced to the Roadster jump (the jump clears all four)
        for (let k = 0; k < 4; k++) out.push(cars(from + k * 8, k));
        break;
      case 'hyper':
      case 'escape':
        for (let d = from, i = 0; d <= to; d += 12, i++) out.push(cars(d, i));
        break;
      case 'wall':
        for (let d = from, i = 0; d <= to; d += 14, i++) out.push(mk(d, [{ type: 'laser', lane: 0, laser: ['block', 'block', 'block'], variant: i % 2 }]));
        break;
      case 'ghost':
        for (let d = from, i = 0; d <= to; d += 9, i++) {
          const m: LaserMode[] = [0, 1, 2].map((l) => ((l + i) % 3 === 0 ? 'high' : 'low'));
          out.push(mk(d, [{ type: 'laser', lane: 0, laser: m as [LaserMode, LaserMode, LaserMode], variant: i % 2 }]));
        }
        break;
      case 'rail':
        for (let d = from, i = 0; d <= to; d += 10, i++) out.push(i % 2 ? cars(d, i) : mk(d, [0, 1, 2].map((lane) => ({ type: r.chance(0.5) ? 'barrier' : 'beam', lane, variant: 0 }) as ObstacleSpec)));
        break;
      case 'tunnel':
        for (let d = from + 10, i = 0; d <= to - 10; d += 16, i++) out.push(cars(d, i));
        break;
    }
    return out;
  }

  /** tutorial: rows/pickups are supplied by a script instead of generated */
  scripted = false;

  /** Make sure rows/pickups exist up to `untilDist`. */
  generateUntil(untilDist: number) {
    if (this.scripted) return;
    while (this.lastDist < untilDist) this.generateRow();
  }

  private gapTime(d: number) {
    const t = clamp01((d + this.off) / 3800);
    return lerp(1.35, 0.66, t) * this.rng.range(0.92, 1.18) * this.gapMul;
  }

  /** distance + arrival-time of the next row for a required time gap */
  private place(gapTime: number) {
    const d0 = this.lastDist;
    const gap = gapTime * this.speed(d0 + gapTime * SPEED.start);
    const d = d0 + gap;
    // time estimate uses the faster (arrival) speed — conservative
    return { d, dt: gap / this.speed(d) };
  }

  private generateRow() {
    if (this.course?.bonus && this.trySetPiece()) return;
    const r = this.rng;
    const lv = LEVEL_RULES[this.level];
    const map0 = this.mapAt(this.lastDist);
    // time-based spacing: base curve, floored by the map's minimum gap, plus recovery after hard rows
    const base = Math.max(this.gapTime(this.lastDist), map0.cfg.minGap * lv.gap * this.gapMul) + this.prevRecovery;
    const p0 = this.place(base);
    const map = this.mapAt(p0.d);
    const slack = Math.max(0, map.cfg.slack + lv.slack);

    // track mode: clear run-out to the FINISH gate, and lighter sections
    const c = this.course;
    const density = (c ? (p0.d > c.length - 40 ? 0 : sectionAt(c, p0.d).density ?? 1) : 1) * map.cfg.density;
    if (density < 1 && this.rng.next() >= density) {
      const empty: RowSpec = { dist: p0.d, dt: p0.dt, masks: [PASS_ALL, PASS_ALL, PASS_ALL], obstacles: [], pid: 'P00', tier: 0 };
      const next = step(this.reach, empty.masks, Math.max(p0.dt, FAIRNESS.minRowTime));
      if (density > 0) {
        this.rows.push(empty);
        this.placeCoins(this.lastDist, empty, next);
      }
      this.reach = next;
      this.lastDist = p0.d;
      this.prevRecovery = 0;
      this.prevOccludes = false;
      return;
    }

    // tier cap: never a trap right behind a wall / gate; limited hard streaks
    let maxTier: Tier = 4;
    if (this.prevOccludes || map.cfg.maxConsecutiveHard === 0 || this.hardStreak >= map.cfg.maxConsecutiveHard) maxTier = 2;

    let obstacles: ObstacleSpec[] | null = null;
    let next = 0;
    let chosen: Pattern | null = null;
    let at = p0;
    for (let attempt = 0; attempt < 12; attempt++) {
      const pat = this.choosePattern(p0.d, maxTier);
      if (!pat) break;
      const def = PATTERNS[pat.k];
      // the pattern decides its own lead time: walls / gates / lasers get room to align
      const need = def.minGap * lv.gap + (def.tier >= 3 ? 0.1 : 0);
      const pl = need > base ? this.place(need) : p0;
      if (c && pl.d > c.length - 40) {
        this.reject('finish');
        continue;
      }
      const cand = pat.make();
      for (const o of cand) if (o.type === 'drone' || o.type === 'platform') o.sweep = map.cfg.movingSpeed;
      const masks = rowMasks(cand);
      // lanes that can't be passed at any height (only a lane change helps)
      const blockers = masks.filter((m) => m === 0).length;
      if (blockers > map.cfg.maxBlockers) {
        this.reject('blockers');
        continue;
      }
      const n = step(this.reach, masks, pl.dt, slack);
      if (n) {
        obstacles = cand;
        next = n;
        chosen = pat;
        at = pl;
        break;
      }
      this.reject('unreachable');
    }
    if (!obstacles) {
      // Guaranteed-safe fallback: a single crate in a lane the player can avoid.
      this.reject('fallback');
      const lane = r.int(0, 2);
      obstacles = [{ type: 'crate', lane, variant: r.int(0, 3) }];
      const t = Math.max(p0.dt, FAIRNESS.minRowTime);
      next = step(this.reach, rowMasks(obstacles), t, slack) || step(this.reach, rowMasks(obstacles), t);
      if (!next) {
        // should be unreachable — keep the run going with an empty row
        obstacles = [];
        next = this.reach | START_STATE;
      }
    }
    const def = PATTERNS[chosen?.k ?? 'crate'];
    const masks = rowMasks(obstacles);
    const row: RowSpec = { dist: at.d, dt: at.dt, masks, obstacles, pid: def.id, tier: def.tier, occludes: def.occludes };
    this.rows.push(row);
    this.generated++;
    this.placeCoins(this.lastDist, row, next);
    this.reach = next;
    this.lastDist = at.d;
    this.prevOccludes = def.occludes;
    this.prevRecovery = def.recovery + (def.tier >= 3 ? map.cfg.recovery * (def.tier === 4 ? 1.6 : 1) : 0);
    // after a row that makes most players jump or duck: time to land and read the next obstacle
    const vertical = masks.filter((m) => !(m & PASS_N)).length >= 2;
    if (vertical) this.prevRecovery = Math.max(this.prevRecovery, VERTICAL_RECOVERY * lv.gap);
    this.hardStreak = def.tier >= 3 ? this.hardStreak + 1 : 0;
  }

  private placeCoins(prevDist: number, row: RowSpec, reach: number) {
    const r = this.rng;
    const lanes = lanesOf(reach);
    if (!lanes.length) return;
    if (!lanes.includes(this.coinLane) || r.chance(0.25)) this.coinLane = r.pick(lanes);
    const lane = this.coinLane;
    const mode = modeIn(reach, lane);
    const gap = row.dist - prevDist;
    const cl = this.course ? (this.course.bonus ? COIN_LINES.bonus : COIN_LINES.course) : COIN_LINES.endless;
    if (gap < 14 || r.chance(cl.skip)) return; // sometimes leave space empty
    const spacing = 3.2;
    const n = Math.min(cl.max, Math.floor((gap * 0.7) / spacing));
    const masked = row.masks[lane] !== PASS_ALL;
    for (let i = 0; i < n; i++) {
      const dist = row.dist - (n - 1 - i) * spacing - (masked ? 0 : 6);
      if (dist < prevDist + 5) continue;
      let y: number = HEIGHT.NORMAL;
      if (masked) {
        const k = 1 - Math.min(1, Math.abs(dist - row.dist) / 9);
        if (mode === MODE_H) y = lerp(HEIGHT.NORMAL, HEIGHT.HIGH, Math.sin((k * Math.PI) / 2));
        else if (mode === MODE_L && Math.abs(dist - row.dist) < 4) y = HEIGHT.LOW;
      }
      let kind: PickupKind = 'coin';
      // v2.2 trick spot: a mystery box right at the obstacle — grab it only with a well-timed hop / duck
      if (masked && (mode === MODE_H || mode === MODE_L) && Math.abs(dist - row.dist) < 1.7 && dist >= this.nextBoxAt) {
        this.nextBoxAt = dist + GIFTS.boxGap * 0.5;
        if (r.chance(GIFTS.boxChance)) {
          this.nextBoxAt = dist + GIFTS.boxGap;
          this.pickups.push({ kind: 'mystery', lane, dist, y });
          continue;
        }
      }
      // v2 hearts on the EXP roads: one about every HEARTS.everyExp EXP
      if (!this.course && dist >= this.nextHeartAt && i === Math.floor(n / 2)) {
        this.nextHeartAt = dist + HEARTS.everyExp / expRate(this.level, this.variant);
        this.pickups.push({ kind: 'life', lane, dist, y });
        continue;
      }
      if (dist >= this.nextPowerAt && i === Math.floor(n / 2)) {
        if (this.course?.bonus) {
          // v2.2 Bonus road: normal items as usual; a special only now and then (it brings its own set piece)
          if (!this.pendingSet && r.chance(BONUS_SET.chance)) {
            this.pendingSet = r.weighted<PickupKind>([
              { w: 2, v: 'super' },
              { w: 1.2, v: 'hyper' },
              { w: 1.2, v: 'escape' },
              { w: 1.2, v: 'wall' },
              { w: 1, v: 'rail' },
              { w: 1.2, v: 'ghost' },
            ]);
          } else {
            kind = r.weighted<PickupKind>([
              { w: 3, v: 'magnet' },
              { w: 2.5, v: 'shield' },
              { w: 1.6, v: 'turbo' },
              { w: 2, v: 'double' },
              { w: 1, v: 'life' },
              { w: 0.5, v: 'mystery' },
            ]);
          }
          this.nextPowerAt = dist + r.range(240, 380); // a few fewer items than before
          if (kind !== 'coin') {
            this.pickups.push({ kind, lane, dist, y });
            continue;
          }
        }
        // v2 Endless / Track 2: specials (Roadster, SOS…) and extra lives are never on the road
        const v1 = !!this.course;
        kind = r.weighted<PickupKind>([
          { w: 3, v: 'magnet' },
          { w: 3, v: 'shield' },
          { w: v1 ? 2.2 : 0.7, v: 'turbo' }, // v2: turbo is rare (it also adds EXP)
          { w: v1 ? 0 : 0.5, v: 'mystery' }, // v2.2 random reward box (now and then)
          { w: 2, v: 'double' },
          { w: v1 && dist > 600 ? 1 : 0, v: 'life' },
          { w: v1 && dist > 250 ? 2 : 0, v: 'super' },
          { w: v1 && dist > 150 ? 2 : 0, v: 'dash' },
          { w: v1 && dist > 400 ? 1.2 : 0, v: 'escape' },
        ]);
        this.nextPowerAt = dist + (v1 ? r.range(260, 420) : r.range(220, 360)); // v2.2.4: road power-ups about as often as v1
      }
      this.pickups.push({ kind, lane, dist, y });
    }
  }

  // ---------------------------------------------------------------- patterns
  private choosePattern(d: number, maxTier: Tier = 4): Pattern | null {
    const r = this.rng;
    const real = d;
    d += this.off; // difficulty gates below use effective progress
    const t = clamp01(d / 3500);
    const world = this.worldAt(real);
    const bias = this.course ? sectionAt(this.course, real).bias ?? {} : {};
    const L = () => r.int(0, 2);
    const two = (): [number, number] => {
      const a = r.int(0, 2);
      let b = r.int(0, 1);
      if (b >= a) b++;
      return [a, b];
    };
    const adj = (): [number, number] => (r.chance(0.5) ? [0, 1] : [1, 2]);
    const v = () => r.int(0, 3);
    const W = (base: number, worlds: Partial<Record<WorldId, number>> = {}) => base * (worlds[world] ?? 1);

    const lowTypes = ['crate', 'barrier'] as const;
    const patterns: Pattern[] = [
      { k: 'crate', w: W(3, { space: 0.4 }), make: () => [{ type: 'crate', lane: L(), variant: v() }] },
      { k: 'barrier', w: W(2, { tunnel: 1.4 }), make: () => [{ type: 'barrier', lane: L(), variant: v() }] },
      { k: 'beam', w: W(2, { tunnel: 1.6, mega: 1.2 }), make: () => [{ type: 'beam', lane: L(), variant: v() }] },
      {
        k: 'low2',
        w: W(0.6 + 2 * t),
        make: () => {
          const [a, b] = two();
          return [
            { type: r.pick(lowTypes), lane: a, variant: v() },
            { type: r.pick(lowTypes), lane: b, variant: v() },
          ];
        },
      },
      {
        k: 'crateBeam',
        w: W(0.5 + 2 * t, { tunnel: 1.5 }),
        make: () => {
          const [a, b] = two();
          return [
            { type: 'crate', lane: a, variant: v() },
            { type: 'beam', lane: b, variant: v() },
          ];
        },
      },
      {
        k: 'wall3',
        // three-lane wall: every lane needs a vertical dodge
        w: d > 600 ? W(1.4 * t + 0.2, { mega: 1.4 }) : 0,
        heavy: true,
        make: () => {
          const out: ObstacleSpec[] = [];
          const beamLane = L();
          for (let i = 0; i < 3; i++)
            out.push(
              i === beamLane
                ? { type: 'beam', lane: i, variant: v() }
                : { type: r.pick(lowTypes), lane: i, variant: v() },
            );
          return out;
        },
      },
      {
        k: 'drone',
        w: d > 220 ? W(1.5, { cloud: 1.6, space: 1.4 }) : 0,
        make: () => {
          const [a, b] = adj();
          return [{ type: 'drone', lane: a, lane2: b, variant: v() }];
        },
      },
      {
        k: 'platform',
        w: d > 380 ? W(0.3, { cloud: 1.2, city: 0.5 }) : 0, // sliding platforms: used sparingly
        make: () => {
          const [a, b] = adj();
          return [{ type: 'platform', lane: a, lane2: b, variant: v() }];
        },
      },
      {
        k: 'traffic',
        w: d > 120 ? W(1.8, { city: 1.3, mega: 1.4, tunnel: 0.5, space: 0.6 }) : 0,
        make: () => [{ type: 'traffic', lane: L(), variant: r.int(0, 4) }],
      },
      {
        k: 'trafficMix',
        w: d > 260 && t > 0.15 ? W(0.9 * t, { city: 1, mega: 1.4 }) : 0,
        make: () => {
          const [a, b] = two();
          return [
            { type: 'traffic', lane: a, variant: v() },
            { type: r.pick(['crate', 'beam'] as const), lane: b, variant: v() },
          ];
        },
      },
      {
        k: 'ring',
        w: W(1.2, { tunnel: 1.8, cloud: 1.4 }),
        make: () => {
          const lane = L();
          const out: ObstacleSpec[] = [{ type: 'ring', lane, variant: v() }];
          if (d > 500 && r.chance(0.5)) {
            for (let i = 0; i < 3; i++) if (i !== lane) out.push({ type: 'crate', lane: i, variant: v() });
          }
          return out;
        },
      },
      {
        k: 'laser',
        w: d > 480 ? W(1.3, { tunnel: 2.6, mega: 1.5 }) : 0,
        heavy: true,
        make: () => {
          // always one open lane (drive straight through), at most one "duck" lane and one
          // full block — never a wall of neon that forces everyone to swipe down
          const cfg: [LaserMode, LaserMode, LaserMode] = ['open', 'open', 'open'];
          const openLane = L();
          let highs = 0;
          let blocks = 0;
          for (let i = 0; i < 3; i++) {
            if (i === openLane) continue;
            let m = r.weighted<LaserMode>([
              { w: 3, v: 'low' as LaserMode },
              { w: 1.6, v: 'high' as LaserMode },
              { w: 1.2, v: 'open' as LaserMode },
              { w: t * 1.2, v: 'block' as LaserMode },
            ]);
            if (m === 'high' && highs >= 1) m = 'low';
            if (m === 'block' && blocks >= 1) m = 'low';
            if (m === 'high') highs++;
            if (m === 'block') blocks++;
            cfg[i] = m;
          }
          return [{ type: 'laser', lane: 0, laser: cfg, variant: v() }];
        },
      },
      {
        k: 'gate',
        w: d > 850 ? W(0.55, { mega: 2.2 }) : 0,
        heavy: true,
        make: () => [{ type: 'gate', lane: 1, door: L(), variant: v() }],
      },
      {
        k: 'asteroid',
        w: world === 'space' || world === 'belt' ? 3.2 : 0,
        make: () => [{ type: 'asteroid', lane: L(), variant: v() }],
      },
      {
        k: 'asteroid2',
        w: world === 'space' || world === 'belt' ? 1.4 * (0.5 + t) : 0,
        make: () => {
          const [a, b] = two();
          return [
            { type: 'asteroid', lane: a, variant: v() },
            { type: 'asteroid', lane: b, variant: v() },
          ];
        },
      },
    ];
    // tier-first: pick a tier by the map's distribution, then a pattern of that tier
    const map = this.mapAt(real);
    const tw = tierWeights(map.cfg, map.progress, map.warmup, LEVEL_RULES[this.level].tierShift);
    if (!this.course) {
      // v2 Endless: patterns unlock phase by phase; each phase boosts its signature obstacles
      const z = this.zoneAt(real);
      const ph = z.kind === 'gate' ? Math.min(PHASES.length - 1, z.phase + 1) : z.phase;
      for (const p of patterns) {
        if (PHASE_UNLOCK[p.k] > ph) p.w = 0;
        else p.w *= PHASES[ph].boost[p.k] ?? 1;
      }
    }
    const usable = patterns.filter((p) => p.w > 0 && PATTERNS[p.k].worlds.includes(world) && PATTERNS[p.k].tier <= maxTier);
    const tiers: { w: number; v: Tier }[] = [];
    for (const t of [1, 2, 3, 4] as Tier[]) {
      if (t > maxTier) continue;
      if (usable.some((p) => PATTERNS[p.k].tier === t)) tiers.push({ w: tw[t - 1], v: t });
    }
    if (!tiers.length || tiers.every((x) => x.w <= 0)) {
      const easy = usable.filter((p) => PATTERNS[p.k].tier <= 2);
      return easy.length ? r.weighted(easy.map((p) => ({ w: p.w * (bias[p.k] ?? 1), v: p }))) : null;
    }
    const tier = r.weighted(tiers);
    const pool = usable.filter((p) => PATTERNS[p.k].tier === tier);
    return r.weighted(pool.map((p) => ({ w: p.w * (bias[p.k] ?? 1), v: p })));
  }

  /** Drop rows/pickups that are behind the player. */
  prune(runDist: number) {
    while (this.rows.length && this.rows[0].dist < runDist - 40) this.rows.shift();
    while (this.pickups.length && this.pickups[0].dist < runDist - 40) this.pickups.shift();
  }
}

export { MODE_H, MODE_L };
