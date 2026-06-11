import { registerPart } from './registry';
import { basketball } from './defs/basketball';
import { bowlingBall } from './defs/bowlingBall';
import { tennisBall } from './defs/tennisBall';
import { wall } from './defs/wall';
import { ramp } from './defs/ramp';
import { bucket } from './defs/bucket';

let registered = false;

/** Register every part definition exactly once. Call before using the registry. */
export function registerAllParts(): void {
  if (registered) return;
  registered = true;
  for (const def of [wall, ramp, basketball, bowlingBall, tennisBall, bucket]) {
    registerPart(def);
  }
}
