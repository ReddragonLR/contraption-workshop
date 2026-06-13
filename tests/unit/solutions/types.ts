import type { OptionValue } from '../../../src/parts/types';

/**
 * A known-good solution placement for one level, used by solvability.test.ts
 * and documented for QA in LEVELS.md. Placements must respect the same grid
 * the player gets: x/y on the 10px grid, rotation in 15° steps.
 */
export interface SolutionPart {
  partId: string;
  x: number;
  y: number;
  rotation?: number;
  options?: Record<string, OptionValue>;
}
