import type { SolutionPart } from './types';

export const levelId = 'level-10';
// Same belt feed as the assembly line: the ball flies into the bay, then
// rolls back across the victory switch — satisfying both halves of the goal.
export const solution: SolutionPart[] = [
  { partId: 'ramp', x: 150, y: 200, rotation: 30 },
  { partId: 'ramp', x: 270, y: 290, rotation: 15 },
];
