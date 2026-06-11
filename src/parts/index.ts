import { registerPart } from './registry';
import { basketball } from './defs/basketball';
import { bowlingBall } from './defs/bowlingBall';
import { tennisBall } from './defs/tennisBall';
import { wall } from './defs/wall';
import { ramp } from './defs/ramp';
import { bucket } from './defs/bucket';
import { conveyor } from './defs/conveyor';
import { fan } from './defs/fan';
import { balloon } from './defs/balloon';
import { trampoline } from './defs/trampoline';
import { seesaw } from './defs/seesaw';
import { rope } from './defs/rope';
import { pulley } from './defs/pulley';
import { button } from './defs/button';

let registered = false;

/** Register every part definition exactly once. Call before using the registry. */
export function registerAllParts(): void {
  if (registered) return;
  registered = true;
  for (const def of [
    // balls
    basketball,
    bowlingBall,
    tennisBall,
    // structure
    wall,
    ramp,
    // mechanisms
    conveyor,
    fan,
    balloon,
    trampoline,
    seesaw,
    rope,
    pulley,
    button,
    // containers
    bucket,
  ]) {
    registerPart(def);
  }
}
