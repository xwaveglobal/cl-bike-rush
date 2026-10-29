import { GIFTS, POWERUP_DURATION, SCORE, SHIELD, SPEED } from '../config.ts';
import type { MissionStat } from './Missions.ts';
import type { PickupKind } from './types.ts';
import type { WorldEvent } from './World.ts';

export interface Upgrades {
  engine: number;
  shield: number;
  magnet: number;
}

export type Feedback =
  | { t: 'coin'; x: number; y: number; z: number }
  | { t: 'power'; kind: PickupKind; x: number; y: number; z: number }
  | { t: 'near'; points: number; x: number; y: number; z: number }
  | { t: 'ring'; points: number }
  | { t: 'combo'; mult: number }
  | { t: 'shieldBreak' }
  | { t: 'smash'; x: number; y: number; z: number; type: string }
  | { t: 'crash'; final: boolean; x: number; y: number; z: number; type: string }
  | { t: 'expire'; kind: PickupKind }
  /** v2.2 random reward from a mystery box or a ring */
  | { t: 'gift'; src: 'box' | 'ring'; coins: number; kind: PickupKind | null };

/**
 * Per-run rules: score, combo, power-ups, lives. Consumes World events and
 * produces Feedback for audio/VFX/UI. Pure logic — testable headless.
 */
/** obstacles one shield absorbs before it breaks */
export const SHIELD_HITS = SHIELD.hits;

export class Run {
  score = 0;
  coins = 0;
  distance = 0;
  /** v2: EXP per metre for this run's speed level (0 = no EXP, e.g. training) */
  expRate = 0;
  nearMiss = 0;
  dodges = 0;
  rings = 0;
  powerups = 0;
  combo = 0;
  lives = 1;
  maxLives = 3; // HEARTS.max

  /** ROADSTER JUMP charges (swipe UP to use) */
  superJumps = 0;
  /** mythic HYPER JUMP charges (from events / shop / daily); used before Roadster Jumps */
  hyperJumps = 0;
  /** jumps fired this run (daily quests) */
  superUsed = 0;
  /** AIR DASH charges: a sideways swipe while airborne crosses 2 lanes */
  dashes = 0;
  /** SKY ESCAPE charges (emergency button) */
  escapes = 0;
  shield = false;
  shieldT = 0; // >0 timed shield (seconds left)
  /** obstacles the shield can still absorb */
  shieldHits = 0;
  magnetT = 0;
  turboT = 0;
  doubleT = 0;
  /** v2.2 double coins from flying through a ring (seconds left) */
  coin2T = 0;
  invulnT = 0;

  feedback: Feedback[] = [];

  /** @param scoreMul speed-level score multiplier (EASY 0.8 · NORMAL 1 · HARD 1.3) */
  constructor(public up: Upgrades, public scoreMul = 1) {}

  /** v2: EXP earned so far (distance × level rate) */
  get exp() {
    return Math.floor(this.distance * this.expRate + this.expBonus);
  }
  /** v2.2 extra EXP from Double EXP (×2 while it lasts) */
  expBonus = 0;
  get mult() {
    return Math.min(SCORE.comboMax, 1 + Math.floor(this.combo / SCORE.comboStep) * 0.5) * (this.doubleT > 0 ? 2 : 1) * this.scoreMul;
  }
  get comboMult() {
    return Math.min(SCORE.comboMax, 1 + Math.floor(this.combo / SCORE.comboStep) * 0.5);
  }
  get speedMul() {
    return this.turboT > 0 ? SPEED.turboMul : 1;
  }
  get invulnerable() {
    return this.invulnT > 0 || this.turboT > 0;
  }
  get magnetActive() {
    return this.magnetT > 0;
  }
  get magnetRadius() {
    return 6 + this.up.magnet * 0.8;
  }

  durations() {
    return {
      magnet: POWERUP_DURATION.magnet + this.up.magnet * 1.5,
      turbo: POWERUP_DURATION.turbo + this.up.engine * 0.7,
      double: POWERUP_DURATION.double,
      shield: Math.round((12 + this.up.shield * 4) * SHIELD.timeMul),
    };
  }

  update(dt: number, distDelta: number) {
    this.distance += distDelta;
    if (this.doubleT > 0) this.expBonus += distDelta * this.expRate;
    this.score += distDelta * SCORE.perMeter * this.mult;
    const tick = (k: 'magnetT' | 'turboT' | 'doubleT' | 'shieldT', kind: PickupKind) => {
      if (this[k] > 0) {
        this[k] -= dt;
        if (this[k] <= 0) {
          this[k] = 0;
          if (k === 'shieldT') this.shield = false;
          if (k === 'turboT') this.invulnT = Math.max(this.invulnT, 1.1); // grace after turbo
          this.feedback.push({ t: 'expire', kind });
        }
      }
    };
    tick('magnetT', 'magnet');
    tick('turboT', 'turbo');
    tick('doubleT', 'double');
    tick('shieldT', 'shield');
    if (this.coin2T > 0) this.coin2T = Math.max(0, this.coin2T - dt);
    if (this.invulnT > 0) this.invulnT = Math.max(0, this.invulnT - dt);
  }

  /** Returns 'crash' | 'gameover' | null when the car was hit. */
  handle(events: WorldEvent[]): 'crash' | 'gameover' | null {
    let result: 'crash' | 'gameover' | null = null;
    for (const e of events) {
      switch (e.type) {
        case 'pickup': {
          const p = e.p;
          if (p.spec.kind === 'coin') {
            this.coins += this.coin2T > 0 ? 2 : 1;
            this.score += SCORE.coin * this.mult;
            this.feedback.push({ t: 'coin', x: p.x, y: p.y, z: p.z });
          } else if (p.spec.kind === 'mystery') {
            this.powerups++;
            this.gift('box', p.x, p.y, p.z);
          } else {
            this.powerups++;
            this.applyPower(p.spec.kind);
            this.feedback.push({ t: 'power', kind: p.spec.kind, x: p.x, y: p.y, z: p.z });
          }
          break;
        }
        case 'pass': {
          if (e.gap < 2.2) {
            this.dodges++;
            const before = this.comboMult;
            this.combo++;
            this.score += SCORE.dodge * this.mult;
            if (this.comboMult > before) this.feedback.push({ t: 'combo', mult: this.comboMult });
          }
          if (e.gap < 0.5) {
            this.nearMiss++;
            const pts = SCORE.nearMiss * this.mult;
            this.score += pts;
            const b = e.o.boxes[0];
            this.feedback.push({ t: 'near', points: pts, x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, z: 0 });
          }
          break;
        }
        case 'ring': {
          this.rings++;
          const pts = SCORE.ringPass * this.mult;
          this.score += pts;
          this.feedback.push({ t: 'ring', points: pts });
          // v2.2: a ring = double coins for a while
          this.coin2T = POWERUP_DURATION.coin2;
          break;
        }
        case 'smash': {
          const b = e.o.boxes[0];
          this.score += 25 * this.mult;
          this.feedback.push({ t: 'smash', x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, z: e.o.z, type: e.o.spec.type });
          break;
        }
        case 'hit': {
          const b = e.o.boxes[0];
          if (this.shield) {
            // the shield soaks up to SHIELD_HITS obstacles, then it is gone (and so is its light)
            this.shieldHits = Math.max(0, this.shieldHits - 1);
            if (this.shieldHits <= 0) {
              this.shield = false;
              this.shieldT = 0;
            }
            this.invulnT = 0.6;
            e.o.smashed = true;
            this.feedback.push({ t: 'shieldBreak' });
            this.feedback.push({ t: 'smash', x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, z: e.o.z, type: e.o.spec.type });
            break;
          }
          this.combo = 0;
          this.lives--;
          const final = this.lives <= 0;
          this.feedback.push({ t: 'crash', final, x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, z: e.o.z, type: e.o.spec.type });
          result = final ? 'gameover' : 'crash';
          // ignore anything else this frame
          return result;
        }
        default:
          break;
      }
    }
    return result;
  }

  /** random source (tests can seed it) */
  rand: () => number = Math.random;

  /** v2.2: roll a random reward (mystery box / ring) and apply it */
  private gift(src: 'box' | 'ring', x: number, y: number, z: number) {
    const t = GIFTS[src];
    const opts = Object.entries(t.w).filter(([k]) => k !== 'life' || this.lives < this.maxLives);
    let roll = this.rand() * opts.reduce((a, [, w]) => a + w, 0);
    let pick = 'coins';
    for (const [k, w] of opts) {
      roll -= w;
      if (roll <= 0) {
        pick = k;
        break;
      }
    }
    if (pick === 'coins') {
      const n = t.coins[Math.floor(this.rand() * t.coins.length)];
      this.coins += n;
      this.score += SCORE.coin * n * this.mult;
      this.feedback.push({ t: 'gift', src, coins: n, kind: null });
      return;
    }
    const k = pick as PickupKind;
    this.applyPower(k);
    this.feedback.push({ t: 'power', kind: k, x, y, z });
    this.feedback.push({ t: 'gift', src, coins: 0, kind: k });
  }

  private applyPower(kind: PickupKind) {
    const d = this.durations();
    switch (kind) {
      case 'shield':
        this.shield = true;
        this.shieldT = d.shield;
        this.shieldHits = SHIELD_HITS;
        break;
      case 'magnet':
        this.magnetT = d.magnet;
        break;
      case 'turbo':
        this.turboT = d.turbo;
        break;
      case 'double':
        this.doubleT = d.double;
        break;
      case 'life':
        this.lives = Math.min(this.maxLives, this.lives + 1);
        break;
      case 'super':
        this.superJumps = Math.min(2, this.superJumps + 1);
        break;
      case 'dash':
        this.dashes = Math.min(3, this.dashes + 2);
        break;
      case 'escape':
        this.escapes = Math.min(2, this.escapes + 1);
        break;
      case 'hyper':
        this.hyperJumps = 1;
        break;
      default:
        break;
    }
  }

  stats(): Record<MissionStat, number> {
    return {
      coins: this.coins,
      dodges: this.dodges,
      ups: 0,
      downs: 0,
      distance: this.distance,
      nearMiss: this.nearMiss,
      score: this.score,
      rings: this.rings,
      powerups: this.powerups,
      lanes: 0,
    };
  }
}
