import type { SolutionPart } from './types';

export const levelId = 'level-05';
export const solution: SolutionPart[] = [
  // Catch the falling ball and turn the drop into a rightward run-up.
  { partId: 'ramp', x: 140, y: 230, rotation: 30 },
  // The fast diagonal landing bounces off the bed (16 px/step exit cap)
  // and arcs over the 270px barrier, dropping gently into the bucket.
  { partId: 'trampoline', x: 380, y: 580 },
];
