import { describe, expect, it } from 'vitest';
import { registerAllParts } from '../../../src/parts';
import { hasPart, registerPart } from '../../../src/parts/registry';
import { fan } from '../../../src/parts/defs/fan';
import { PlacementFactory } from '../../../src/parts/placements';
import { Simulation } from '../../../src/engine/simulation';

registerAllParts();
if (!hasPart('fan')) registerPart(fan);

const WORLD = { width: 960, height: 600, gravity: { x: 0, y: 1 } };

/** Fan at (200,520) blowing right; a ball 100px downwind of it. */
function buildHorizontal(ballPart: string, startsOn: boolean): Simulation {
  const f = new PlacementFactory();
  return new Simulation(WORLD, [
    f.make('fan', 200, 520, { options: { startsOn } }),
    f.make(ballPart, 300, 520, { tag: 'ball' }),
  ]);
}

/** Fan at (480,560) rotated 270° (blowing up); a tennis ball 100px above it. */
function buildVertical(startsOn: boolean): Simulation {
  const f = new PlacementFactory();
  return new Simulation(WORLD, [
    f.make('fan', 480, 560, { rotation: 270, options: { startsOn } }),
    f.make('tennis-ball', 480, 460, { tag: 'ball' }),
  ]);
}

describe('fan (wind field)', () => {
  it('blows a light tennis ball far to the right', () => {
    const sim = buildHorizontal('tennis-ball', true);
    const ball = sim.runtimeById('ball')!.bodies[0];
    const x0 = ball.position.x;
    for (let i = 0; i < 90; i++) sim.step();
    expect(ball.position.x - x0).toBeGreaterThan(60);
    expect(sim.runtimeById('p1')!.state.isOn).toBe(true);
    sim.destroy();
  });

  it('barely moves a heavy bowling ball (constant force, not mass-scaled)', () => {
    const sim = buildHorizontal('bowling-ball', true);
    const ball = sim.runtimeById('ball')!.bodies[0];
    const x0 = ball.position.x;
    for (let i = 0; i < 90; i++) sim.step();
    expect(Math.abs(ball.position.x - x0)).toBeLessThan(15);
    sim.destroy();
  });

  it('does nothing while off (startsOn: false, no power)', () => {
    // Floor-resting geometry: a bouncing ball drifts ~20px on its own in
    // matter.js, which would mask the fan's (lack of) effect. A resting ball
    // inside the wind band isolates it: on blows it ~270px, off must not.
    const build = (startsOn: boolean): Simulation => {
      const f = new PlacementFactory();
      return new Simulation(WORLD, [
        f.make('fan', 200, 567, { options: { startsOn } }),
        f.make('tennis-ball', 300, 587, { tag: 'ball' }),
      ]);
    };
    const off = build(false);
    const ball = off.runtimeById('ball')!.bodies[0];
    const x0 = ball.position.x;
    for (let i = 0; i < 90; i++) off.step();
    expect(Math.abs(ball.position.x - x0)).toBeLessThan(5);
    expect(off.runtimeById('p1')!.state.isOn).toBe(false);
    off.destroy();
    // Guard: the same geometry with the fan on really does move the ball.
    const on = build(true);
    const onBall = on.runtimeById('ball')!.bodies[0];
    for (let i = 0; i < 90; i++) on.step();
    expect(onBall.position.x - x0).toBeGreaterThan(60);
    on.destroy();
  });

  it('rotated 270° it lifts a tennis ball against gravity (vs off control)', () => {
    const windy = buildVertical(true);
    const control = buildVertical(false);
    const windyBall = windy.runtimeById('ball')!.bodies[0];
    const controlBall = control.runtimeById('ball')!.bodies[0];
    const y0 = windyBall.position.y;
    let minY = y0;
    for (let i = 0; i < 90; i++) {
      windy.step();
      control.step();
      if (windyBall.position.y < minY) minY = windyBall.position.y;
    }
    // Lifted above its spawn point at some moment of the run…
    expect(minY).toBeLessThan(y0 - 5);
    // …and held well above the unpowered control, which just falls.
    expect(windyBall.position.y).toBeLessThan(controlBall.position.y);
    windy.destroy();
    control.destroy();
  });
});
