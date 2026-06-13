import type { SolutionPart } from './types';

export const levelId = 'level-04';
export const solution: SolutionPart[] = [
  // Seesaw under the floating tennis ball: the ball drops onto the left half,
  // rolls to the tip and waits in the backstop pocket.
  { partId: 'seesaw', x: 450, y: 570, rotation: 0 },
  // High deflector: the bowling ball rolls down-left off it and free-falls
  // onto the seesaw just right of the pivot — maximum catapult flick.
  { partId: 'ramp', x: 650, y: 140, rotation: 345 },
];
