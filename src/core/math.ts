export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => clamp01((v - a) / (b - a));
/** Frame-rate independent exponential smoothing factor. */
export const damp = (lambda: number, dt: number) => 1 - Math.exp(-lambda * dt);

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
export const easeInQuad = (t: number) => t * t;
export const easeOutBack = (t: number, s = 1.6) => {
  const c3 = s + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
};

/** Critically-damped-ish spring integrator used for banking / squash recoveries. */
export class Spring {
  value: number;
  velocity = 0;
  target: number;
  constructor(value = 0, public stiffness = 180, public damping = 18) {
    this.value = value;
    this.target = value;
  }
  update(dt: number) {
    // semi-implicit Euler, sub-stepped for stability on long frames
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const f = (this.target - this.value) * this.stiffness - this.velocity * this.damping;
      this.velocity += f * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
  snap(v: number) {
    this.value = this.target = v;
    this.velocity = 0;
  }
}
