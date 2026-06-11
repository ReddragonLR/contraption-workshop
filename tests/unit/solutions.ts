import type { OptionValue } from '../../src/parts/types';

/**
 * Known-good solutions for every shipped level, used by solvability.test.ts
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

export const solutions: Record<string, SolutionPart[]> = {
  'level-01': [
    { partId: 'ramp', x: 230, y: 280, rotation: 15 },
    { partId: 'ramp', x: 450, y: 430, rotation: 15 },
  ],
  'level-02': [
    { partId: 'ramp', x: 520, y: 180, rotation: 15 },
    { partId: 'conveyor', x: 660, y: 380 },
  ],
  'level-03': [{ partId: 'fan', x: 140, y: 60 }],
};
