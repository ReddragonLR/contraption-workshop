import { FIXED_DT_MS } from './simulation';

/**
 * Fixed-timestep driver (PRD §6). One requestAnimationFrame loop runs
 * continuously for rendering; physics only advances while `running`, in
 * constant FIXED_DT_MS increments via an accumulator. The render callback
 * receives the interpolation alpha (fraction of a step accumulated).
 */
export class FixedLoop {
  /** Run-speed multiplier (1× / 2×). Steps more often; never changes dt. */
  speed = 1;
  running = false;

  private acc = 0;
  private last: number | null = null;
  private rafId = 0;
  private disposed = false;

  constructor(
    private stepFn: () => void,
    private renderFn: (alpha: number) => void,
  ) {}

  start(): void {
    if (this.rafId || this.disposed) return;
    this.rafId = requestAnimationFrame(this.frame);
  }

  setRunning(running: boolean): void {
    this.running = running;
    if (!running) {
      this.acc = 0;
      this.last = null;
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private frame = (t: number): void => {
    if (this.disposed) return;
    if (this.running) {
      const dt = this.last === null ? FIXED_DT_MS : Math.min(t - this.last, 100);
      this.last = t;
      this.acc += dt * this.speed;
      // Cap catch-up work so a background tab doesn't freeze the page.
      let steps = 0;
      while (this.acc >= FIXED_DT_MS && steps < 10) {
        this.stepFn();
        this.acc -= FIXED_DT_MS;
        steps++;
      }
      if (steps === 10) this.acc = 0;
      this.renderFn(this.acc / FIXED_DT_MS);
    } else {
      this.renderFn(1);
    }
    this.rafId = requestAnimationFrame(this.frame);
  };
}
