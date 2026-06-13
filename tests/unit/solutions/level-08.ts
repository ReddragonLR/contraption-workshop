import type { SolutionPart } from './types';

export const levelId = 'level-08';
// Two ramps per side form a chute that carries each corner ball down toward
// the fixed central valley; by symmetry they arrive together and collide.
export const solution: SolutionPart[] = [
  { partId: 'ramp', x: 210, y: 230, rotation: 30 },
  { partId: 'ramp', x: 300, y: 380, rotation: 15 },
  { partId: 'ramp', x: 750, y: 230, rotation: 330 },
  { partId: 'ramp', x: 660, y: 380, rotation: 345 },
];
