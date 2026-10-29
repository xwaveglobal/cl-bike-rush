import { CAR_HALF, CAR_HALF_Y_LOW, HEIGHT, LANES, TIMING } from '../config.ts';
import { clamp, clamp01, easeInOutSine, easeOutBack, easeOutCubic, easeOutQuad, lerp } from '../core/math.ts';

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
import type { Action } from '../core/Input.ts';
import type { Box } from './types.ts';

export type VMode = 'none' | 'up' | 'down';
export type VPhase = 'idle' | 'antic' | 'exec' | 'hold' | 'recover';

export interface PlayerEvents {
  lane?: (dir: -1 | 1) => void;
  up?: () => void;
  down?: () => void;
  land?: (fromMode: VMode) => void;
  bump?: (dir: -1 | 1) => void;
  /** booster second swipe in the air (edge → far edge): flip + consume a charge */
  airDash?: (dir: -1 | 1) => void;
  /** an extra air swipe was refused (one lane per hop) */
  airBlocked?: (dir: -1 | 1) => void;
}

/**
 * Gameplay state machine for the car. Pure logic — renderers read the exposed
 * pose values (x, y, bank inputs, wing deploy, thruster tilt...) every frame.
 *
 * Interruption rules:
 *  - Lane changes are always allowed (also while HIGH or LOW); a second press
 *    mid-slide retargets immediately so double-swipes cross two lanes.
 *  - UP while already HIGH extends the hold; UP during DOWN (or while recovering)
 *    skips anticipation and launches from the current height. DOWN mirrors this.
 *  - Inputs arriving during an anticipation are buffered and replayed after it.
 */
export class Player {
  lane = 1;
  x: number = LANES[1];
  y: number = HEIGHT.NORMAL;
  /** lateral velocity (m/s) — drives banking */
  vx = 0;

  vmode: VMode = 'none';
  vphase: VPhase = 'idle';
  private phaseT = 0;
  private phaseDur = 0;
  private yFrom: number = HEIGHT.NORMAL;

  private laneFrom: number = LANES[1];
  private laneT = 1;
  private laneDur: number = TIMING.laneChange;

  private buffer: { a: Action; t: number }[] = [];
  private time = 0;

  /** visual drivers (0..1) */
  wings = 0;
  thrusterTilt = 0; // 1 = pointing straight down (fly up), -1 = tucked (fly down)
  engine = 0; // extra engine brightness
  squash = 0; // >0 compressed (LOW), <0 stretched (launch)
  orange = 0; // thruster colour blend toward orange
  sideThrust = 0; // -1 left thrusters fire, +1 right
  /** 0 = driving on the road (pods are wheels), 1 = airborne (pods are thrusters) */
  air = 0;
  /** 0 = wheels out, 1 = wheels tucked into the body (FLY DOWN) */
  retract = 0;

  stats = { lanes: 0, ups: 0, downs: 0 };
  events: PlayerEvents = {};
  frozen = false;

  reset(lane = 1) {
    this.lane = lane;
    this.x = this.laneFrom = LANES[lane];
    this.laneT = 1;
    this.y = HEIGHT.NORMAL;
    this.vx = 0;
    this.vmode = 'none';
    this.vphase = 'idle';
    this.buffer.length = 0;
    this.landLane = 0;
    this.pendingLane = 0;
    this.jumpReadyAt = 0;
    this.isSuper = false;
    this.isHyper = false;
    this.isEscape = false;
    this.wings = this.thrusterTilt = this.engine = this.squash = this.orange = this.sideThrust = this.air = this.retract = 0;
    this.stats = { lanes: 0, ups: 0, downs: 0 };
    this.frozen = false;
  }

  input(a: Action) {
    if (this.frozen) return;
    if (a === 'left' || a === 'right') {
      this.changeLane(a === 'left' ? -1 : 1);
      return;
    }
    // touch-and-go: UP pressed while still coming down from a hop → jump again the moment it lands
    if (a === 'up' && !this.canJump) {
      this.buffer.push({ a, t: this.time });
      return;
    }
    if (this.vphase === 'antic') {
      this.buffer.push({ a, t: this.time });
      return;
    }
    if (a === 'up') this.flyUp();
    else this.flyDown();
  }

  /** a lane swipe received mid-slide; runs once the car has settled in its lane */
  private pendingLane: -1 | 1 | 0 = 0;

  /** lane changes made during the current hop (max 1, booster exception below) */
  private airLaneUsed = 0;
  /** lane at take-off of the current hop */
  private hopLane = 1;
  /** true while the player holds an AIR DASH booster charge (set by the game) */
  canAirDash: () => boolean = () => false;

  /**
   * In the air the car may change lane ONCE per hop, then it has to land.
   * Exception: took off from an edge lane (0 or 2) with a booster → a second swipe in
   * the same direction carries it on to the far edge (2 lanes) with a flip.
   */
  /** lane changes still allowed before touching down (Infinity on the ground) */
  get airLanesLeft() {
    if (this.vmode !== 'up' || this.isEscape) return Infinity;
    return Math.max(0, 1 - this.airLaneUsed);
  }

  /** seconds until the current hop touches down (0 on the ground) */
  get timeToLand() {
    if (this.vmode !== 'up') return 0;
    const left = Math.max(0, this.phaseDur - this.phaseT);
    const ex = this.isEscape ? TIMING.escExec : this.isHyper ? TIMING.hyperExec : this.isSuper ? TIMING.superExec : TIMING.upExec;
    const ho = this.isEscape ? TIMING.escHold : this.isHyper ? TIMING.hyperHold : this.isSuper ? TIMING.superHold : TIMING.upHold;
    const re = this.isEscape ? TIMING.escRecover : this.isHyper ? TIMING.hyperRecover : this.isSuper ? TIMING.superRecover : TIMING.upRecover;
    if (this.vphase === 'antic') return left + ex + ho + re;
    if (this.vphase === 'exec') return left + ho + re;
    if (this.vphase === 'hold') return left + re;
    return left;
  }

  private airAllowed(dir: -1 | 1): 'ok' | 'dash' | 'no' {
    if (this.vmode !== 'up' || this.isEscape) return 'ok';
    if (this.airLaneUsed === 0) return 'ok';
    const edge = this.hopLane === 0 || this.hopLane === 2;
    const continuing = (this.hopLane === 0 && dir === 1) || (this.hopLane === 2 && dir === -1);
    if (this.airLaneUsed === 1 && edge && continuing && this.canAirDash()) return 'dash';
    return 'no';
  }

  private changeLane(dir: -1 | 1) {
    if (this.laneT < 1) {
      // never retarget mid-slide (the car would stop between lanes): queue exactly one step
      this.pendingLane = dir;
      return;
    }
    const target = clamp(this.lane + dir, 0, 2);
    if (target === this.lane) {
      this.events.bump?.(dir);
      this.sideThrust = dir * 0.6;
      return;
    }
    const air = this.airAllowed(dir);
    if (air === 'no') {
      // about to touch down: keep the swipe and steer the instant the wheels are on the road
      if (this.timeToLand < 0.32) {
        this.landLane = dir;
        this.landLaneT = this.time;
        return;
      }
      this.events.airBlocked?.(dir);
      return;
    }
    if (this.vmode === 'up') this.airLaneUsed++;
    if (air === 'dash') {
      this.events.airDash?.(dir);
      // stay up until the dash has landed in its lane
      if (this.vphase === 'hold') this.phaseT = Math.min(this.phaseT, Math.max(0, this.phaseDur - TIMING.laneChange - 0.08));
    }
    this.lane = target;
    this.laneFrom = this.x;
    this.laneT = 0;
    const dist = Math.abs(LANES[target] - this.x) / (LANES[1] - LANES[0]);
    this.laneDur = TIMING.laneChange * clamp(dist, 0.55, 1.6);
    this.stats.lanes++;
    this.events.lane?.(dir);
  }

  private startPhase(mode: VMode, phase: VPhase, dur: number) {
    if (mode === 'up' && this.vmode !== 'up') {
      // a new hop begins
      this.airLaneUsed = 0;
      this.hopLane = this.lane;
    }
    this.vmode = mode;
    this.vphase = phase;
    this.phaseT = 0;
    this.phaseDur = dur;
    this.yFrom = this.y;
  }

  /** true during a ROADSTER JUMP (higher, longer, rocket hop) */
  isSuper = false;
  /** true during a mythic HYPER JUMP (implies isSuper) */
  isHyper = false;
  /** true during a SKY ESCAPE (implies isSuper) */
  isEscape = false;

  /** airborne enough to steer 2 lanes with an AIR DASH */
  get canDash() {
    return this.vmode === 'up' && this.vphase !== 'antic' && this.vphase !== 'recover' && this.y > HEIGHT.NORMAL + 0.5;
  }

  /**
   * AIR DASH: while airborne, cross two lanes in one swipe (edge → edge).
   * Keeps the car up until the dash has landed in its lane.
   */
  dash(dir: -1 | 1) {
    if (this.frozen || !this.canDash) return false;
    const target = this.lane + dir * 2;
    if (target < 0 || target > 2) return false;
    this.lane = target;
    this.laneFrom = this.x;
    this.laneT = 0;
    this.laneDur = TIMING.dashDur;
    this.pendingLane = 0;
    this.stats.lanes += 2;
    if (this.vphase === 'hold') this.phaseT = Math.min(this.phaseT, Math.max(0, this.phaseDur - TIMING.dashDur - 0.08));
    this.events.lane?.(dir);
    return true;
  }

  /** SKY ESCAPE: from any state, rocket straight up above every obstacle, cruise, glide down. */
  escape() {
    if (this.frozen || this.isEscape) return false;
    this.isSuper = true;
    this.isHyper = false;
    this.isEscape = true;
    this.buffer.length = 0;
    this.stats.ups++;
    this.events.up?.();
    this.startPhase('up', 'exec', TIMING.escExec);
    return true;
  }

  /** Rocket hop granted by the ROADSTER JUMP power-up. Same ground-only rule as a normal jump. */
  superJump(hyper = false) {
    if (!this.canJump) return false;
    this.isSuper = true;
    this.isHyper = hyper;
    this.stats.ups++;
    this.events.up?.();
    this.startPhase('up', 'antic', TIMING.superAntic);
    return true;
  }

  private get topY(): number {
    return this.isEscape ? HEIGHT.ESCAPE : this.isHyper ? HEIGHT.HYPER : this.isSuper ? HEIGHT.SUPER : HEIGHT.HIGH;
  }

  /** earliest time the next jump may start (short rest after touching down) */
  private jumpReadyAt = 0;

  /**
   * One jump = one beat: launch → short hover → automatic landing.
   * Jumping is only possible with the wheels on the road, and not during the
   * brief rest after landing — spamming UP can never keep the car airborne.
   */
  get canJump() {
    return this.vmode !== 'up' && this.y <= HEIGHT.NORMAL + 0.12 && this.time >= this.jumpReadyAt;
  }

  /** seconds the car will still be up high (0 when not in a jump or already descending) */
  get airTimeLeft() {
    if (this.vmode !== 'up') return 0;
    const left = Math.max(0, this.phaseDur - this.phaseT);
    if (this.vphase === 'antic') return left + TIMING.upExec + TIMING.upHold;
    if (this.vphase === 'exec') return left + TIMING.upHold;
    if (this.vphase === 'hold') return left;
    return 0;
  }

  /** seconds until a new jump can start */
  get jumpWait() {
    if (this.vmode === 'up') {
      const left = Math.max(0, this.phaseDur - this.phaseT);
      const rest = this.vphase === 'recover' ? left : this.airTimeLeft + TIMING.upRecover;
      return rest + TIMING.jumpRest;
    }
    return Math.max(0, this.jumpReadyAt - this.time);
  }

  /** lane swipe kept for the moment of landing */
  private landLane: -1 | 1 | 0 = 0;
  private landLaneT = 0;

  private flyUp() {
    const p = this.vphase;
    if (!this.canJump) return;
    this.stats.ups++;
    this.events.up?.();
    if (p === 'idle') {
      this.startPhase('up', 'antic', TIMING.upAntic);
    } else {
      // interrupt: launch from current height, duration proportional to distance
      const k = clamp(Math.abs(HEIGHT.HIGH - this.y) / (HEIGHT.HIGH - HEIGHT.NORMAL), 0.35, 1.3);
      this.startPhase('up', 'exec', TIMING.upExec * k);
    }
  }

  private flyDown() {
    if (this.isEscape) return; // an escape glides down on its own
    this.isSuper = false;
    this.isHyper = false;
    const m = this.vmode;
    const p = this.vphase;
    if (m === 'down' && p === 'hold') {
      this.phaseT = 0;
      return;
    }
    if (m === 'down' && p === 'exec') {
      this.buffer.push({ a: 'down', t: this.time });
      return;
    }
    this.stats.downs++;
    this.events.down?.();
    if (p === 'idle') {
      this.startPhase('down', 'antic', TIMING.downAntic);
    } else {
      const k = clamp(Math.abs(this.y - HEIGHT.LOW) / (HEIGHT.NORMAL - HEIGHT.LOW), 0.35, 2.2);
      // fast-fall from HIGH: cap so a dive from the sky is still snappy
      this.startPhase('down', 'exec', Math.min(0.24, TIMING.downExec * k));
    }
  }

  update(dt: number) {
    this.time += dt;
    // ---- lateral
    const prevX = this.x;
    if (this.laneT < 1) {
      this.laneT = Math.min(1, this.laneT + dt / this.laneDur);
      // ease-in-out: the car eases off its lane and settles into the next, like steering a real car
      this.x = lerp(this.laneFrom, LANES[this.lane], easeInOutCubic(this.laneT));
    } else {
      this.x = LANES[this.lane];
      if (this.pendingLane) {
        const d = this.pendingLane;
        this.pendingLane = 0;
        this.changeLane(d);
      }
    }
    this.vx = dt > 0 ? (this.x - prevX) / dt : 0;
    if (Math.abs(this.vx) > 0.5) this.sideThrust = Math.sign(this.vx);
    else this.sideThrust *= Math.exp(-6 * dt);

    // ---- vertical
    if (this.vphase !== 'idle') {
      this.phaseT += dt;
      const p = this.phaseDur > 0 ? clamp01(this.phaseT / this.phaseDur) : 1;
      this.applyVertical(p);
      if (this.phaseT >= this.phaseDur) this.advancePhase();
    } else {
      this.y = HEIGHT.NORMAL;
    }

    // ---- lane swipe held for touchdown
    if (this.landLane && this.vmode !== 'up') {
      const d = this.landLane;
      this.landLane = 0;
      if (this.time - this.landLaneT < 0.45) this.changeLane(d);
    }

    // ---- buffered inputs
    if (this.buffer.length && this.vphase !== 'antic') {
      const now = this.time;
      const pending = this.buffer.splice(0);
      for (const b of pending) {
        if (b.a === 'up') {
          // UP waits for the landing (touch-and-go), then fires at once
          if (now - b.t > TIMING.landBuffer) continue;
          if (this.canJump) this.flyUp();
          else this.buffer.push(b);
          continue;
        }
        if (now - b.t > TIMING.verticalBuffer) continue;
        if (this.vphase === 'exec' && b.a === 'down' && this.vmode === 'down') {
          this.buffer.push(b); // still rising: hold onto it
          continue;
        }
        this.flyDown();
      }
    }

    // ---- visual drivers (smoothed)
    const k = 1 - Math.exp(-14 * dt);
    const wantWings = this.vmode === 'up' && this.vphase !== 'recover' ? 1 : 0;
    const wantTilt = this.vmode === 'up' && this.vphase !== 'recover' ? 1 : this.vmode === 'down' && this.vphase !== 'recover' ? -1 : 0;
    const wantEngine = this.vmode === 'up' && (this.vphase === 'exec' || this.vphase === 'antic') ? 1 : this.vmode === 'up' && this.vphase === 'hold' ? 0.55 : 0;
    const wantOrange = this.vmode === 'down' && this.vphase !== 'recover' ? 1 : 0;
    this.wings += (wantWings - this.wings) * k;
    this.thrusterTilt += (wantTilt - this.thrusterTilt) * k;
    this.engine += (wantEngine - this.engine) * (1 - Math.exp(-20 * dt));
    this.orange += (wantOrange - this.orange) * k;
    const up = this.vmode === 'up';
    const wantAir = up && (this.vphase !== 'recover' || this.y > 1.55) ? 1 : 0;
    const wantRetract = this.vmode === 'down' && this.vphase !== 'recover' ? 1 : 0;
    // pods flip to thrusters quickly on take-off, back to wheels a touch slower on landing
    this.air += (wantAir - this.air) * (1 - Math.exp(-(wantAir ? 16 : 9) * dt));
    this.retract += (wantRetract - this.retract) * (1 - Math.exp(-18 * dt));
  }

  private applyVertical(p: number) {
    const N = HEIGHT.NORMAL;
    if (this.vmode === 'up') {
      switch (this.vphase) {
        case 'antic':
          this.y = N - 0.07 * Math.sin(Math.PI * p);
          this.squash = 0.18 * Math.sin(Math.PI * p);
          break;
        case 'exec':
          // smooth lift: quick off the ground, gentle arrival (no bounce)
          this.y = lerp(this.yFrom, this.topY, easeOutCubic(p));
          this.squash = -0.12 * Math.sin(Math.PI * p);
          break;
        case 'hold':
          this.y = this.topY + (this.isSuper ? 0.25 * Math.sin((this.phaseT / (this.isEscape ? TIMING.escHold : this.isHyper ? TIMING.hyperHold : TIMING.superHold)) * Math.PI) : 0.04 * Math.sin(this.phaseT * 6));
          this.squash = 0;
          break;
        case 'recover':
          this.y = lerp(this.yFrom, N, easeInOutSine(p));
          this.squash = p > 0.85 ? 0.2 * Math.sin(((p - 0.85) / 0.15) * Math.PI) : 0;
          break;
      }
    } else if (this.vmode === 'down') {
      switch (this.vphase) {
        case 'antic':
          this.y = N + 0.1 * Math.sin(Math.PI * p);
          this.squash = -0.1 * Math.sin(Math.PI * p);
          break;
        case 'exec':
          this.y = lerp(this.yFrom, HEIGHT.LOW, easeOutQuad(p));
          this.squash = 0.32 * p;
          break;
        case 'hold':
          this.y = HEIGHT.LOW + 0.02 * Math.sin(this.phaseT * 14);
          this.squash = 0.32;
          break;
        case 'recover':
          this.y = lerp(this.yFrom, N, easeOutBack(p, 1.4));
          this.squash = 0.32 * (1 - p) - 0.08 * Math.sin(Math.PI * p);
          break;
      }
    }
  }

  private advancePhase() {
    const m = this.vmode;
    switch (this.vphase) {
      case 'antic':
        this.startPhase(m, 'exec', m === 'up' ? (this.isEscape ? TIMING.escExec : this.isHyper ? TIMING.hyperExec : this.isSuper ? TIMING.superExec : TIMING.upExec) : TIMING.downExec);
        break;
      case 'exec':
        this.startPhase(m, 'hold', m === 'up' ? (this.isEscape ? TIMING.escHold : this.isHyper ? TIMING.hyperHold : this.isSuper ? TIMING.superHold : TIMING.upHold) : TIMING.downHold);
        break;
      case 'hold':
        this.startPhase(m, 'recover', m === 'up' ? (this.isEscape ? TIMING.escRecover : this.isHyper ? TIMING.hyperRecover : this.isSuper ? TIMING.superRecover : TIMING.upRecover) : TIMING.downRecover);
        break;
      case 'recover':
        this.vmode = 'none';
        this.vphase = 'idle';
        this.y = HEIGHT.NORMAL;
        this.squash = 0;
        if (m === 'up') this.jumpReadyAt = this.time + TIMING.jumpRest;
        this.isSuper = false;
        this.isHyper = false;
        this.isEscape = false;
        this.events.land?.(m);
        break;
    }
  }

  /** Current collision box in world space (car is always at z = 0). */
  hitbox(out: Box): Box {
    const low = clamp01((HEIGHT.NORMAL - this.y) / (HEIGHT.NORMAL - HEIGHT.LOW));
    const hy = lerp(CAR_HALF.y, CAR_HALF_Y_LOW, low);
    out.minX = this.x - CAR_HALF.x;
    out.maxX = this.x + CAR_HALF.x;
    out.minY = this.y - hy;
    out.maxY = this.y + hy;
    out.minZ = -CAR_HALF.z;
    out.maxZ = CAR_HALF.z;
    return out;
  }

  /** Height state label for HUD/debug. */
  get heightState(): 'LOW' | 'NORMAL' | 'HIGH' {
    if (this.y > (HEIGHT.NORMAL + HEIGHT.HIGH) / 2) return 'HIGH';
    if (this.y < (HEIGHT.NORMAL + HEIGHT.LOW) / 2 + 0.05) return 'LOW';
    return 'NORMAL';
  }
}
