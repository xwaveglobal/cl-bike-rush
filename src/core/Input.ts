import { platform } from '../platform.ts';
export type Action = 'left' | 'right' | 'up' | 'down';

/**
 * Keyboard + swipe input. Swipes fire as soon as the finger travels past the
 * threshold (not on touchend) — this is what makes mobile controls feel instant.
 * A single drag can chain gestures: after firing, the origin resets.
 */
export class Input {
  onAction: (a: Action) => void = () => {};
  onPause: () => void = () => {};
  /** emergency SKY ESCAPE key (E / Enter) */
  onSpecial: () => void = () => {};
  /** ROADSTER / HYPER JUMP button (R / Shift) */
  onRocket: () => void = () => {};
  enabled = false;

  private startX = 0;
  private startY = 0;
  private startT = 0;
  private tracking = false;
  private fired = false;
  private readonly threshold: number;

  /**
   * v3 native: touches come from tt.onTouch* through the touch router (src/native/main.ts), which
   * gives the canvas UI first pick and calls touchBegin / touchMove / touchEnd for swipes.
   * The keyboard still works in the desktop preview.
   */
  constructor(el: HTMLElement) {
    this.threshold = Math.max(22, Math.min(window.innerWidth, window.innerHeight) * 0.045);
    window.addEventListener('keydown', this.onKey);
    if (platform.native) return;
    // web build: the page's own touch / mouse events
    el.addEventListener('touchstart', this.onTouchStart, { passive: false });
    el.addEventListener('touchmove', this.onTouchMove, { passive: false });
    el.addEventListener('touchend', this.onTouchEnd);
    el.addEventListener('touchcancel', this.onTouchEnd);
    // Mouse drag fallback for desktop testing of swipes
    el.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  }
  private onTouchStart = (e: TouchEvent) => {
    if (!this.enabled) return;
    const t = e.changedTouches[0];
    this.begin(t.clientX, t.clientY);
    e.preventDefault();
  };
  private onTouchMove = (e: TouchEvent) => {
    if (!this.enabled) return;
    const t = e.changedTouches[0];
    this.move(t.clientX, t.clientY);
    e.preventDefault();
  };
  private onTouchEnd = () => this.end();
  private pointerActive = false;
  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !this.enabled) return;
    this.pointerActive = true;
    this.begin(e.clientX, e.clientY);
  };
  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !this.pointerActive) return;
    this.move(e.clientX, e.clientY);
  };
  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    this.pointerActive = false;
    this.end();
  };
  touchBegin(x: number, y: number) {
    if (this.enabled) this.begin(x, y);
  }
  touchMove(x: number, y: number) {
    if (this.enabled) this.move(x, y);
  }
  touchEnd() {
    this.end();
  }

  private emit(a: Action) {
    if (this.enabled) this.onAction(a);
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.emit('left');
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.emit('right');
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'Space':
        this.emit('up');
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.emit('down');
        break;
      case 'KeyE':
      case 'Enter':
        if (this.enabled) this.onSpecial();
        break;
      case 'KeyR':
      case 'ShiftLeft':
      case 'ShiftRight':
        if (this.enabled) this.onRocket();
        break;
      case 'Escape':
      case 'KeyP':
        this.onPause();
        return;
      default:
        return;
    }
    if (this.enabled) e.preventDefault();
  };

  private begin(x: number, y: number) {
    this.startX = x;
    this.startY = y;
    this.startT = performance.now();
    this.tracking = true;
    this.fired = false;
  }

  private move(x: number, y: number) {
    if (!this.tracking) return;
    const dx = x - this.startX;
    const dy = y - this.startY;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (this.fired) return; // one swipe = one action until the finger lifts
    if (Math.max(adx, ady) < this.threshold) return;
    if (adx > ady) this.emit(dx < 0 ? 'left' : 'right');
    else this.emit(dy < 0 ? 'up' : 'down');
    this.fired = true;
  }

  private end() {
    this.tracking = false;
  }

  /** milliseconds since current gesture began (diagnostics) */
  get gestureAge() {
    return this.tracking ? performance.now() - this.startT : 0;
  }
  get didFire() {
    return this.fired;
  }
}
