import type { Simulation } from './simulation';
import { FIXED_DT_MS } from './simulation';

const GRACE_MS = 1500; // let the machine start moving before judging it
const KE_THRESHOLD = 0.25;
const QUIET_MS = 2000;

/**
 * Detects that a run has "settled": total kinetic energy stayed below a
 * threshold for ~2 seconds (PRD §6). The 60s max-run cap lives in the
 * controller.
 */
export class SettleDetector {
  private quietMs = 0;

  tick(sim: Simulation, elapsedMs: number): boolean {
    if (elapsedMs < GRACE_MS) return false;
    if (sim.kineticEnergy() < KE_THRESHOLD) {
      this.quietMs += FIXED_DT_MS;
    } else {
      this.quietMs = 0;
    }
    return this.quietMs >= QUIET_MS;
  }
}
