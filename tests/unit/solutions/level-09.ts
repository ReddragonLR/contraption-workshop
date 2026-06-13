import type { SolutionPart } from './types';

export const levelId = 'level-09';
// Two ramps cascade the ball from its corner onto the conveyor; the belt
// accelerates it and flings it off the end, clearing the barrier into the bay.
export const solution: SolutionPart[] = [
  { partId: 'ramp', x: 150, y: 200, rotation: 30 },
  { partId: 'ramp', x: 270, y: 290, rotation: 15 },
];
