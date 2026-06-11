import { describe, expect, it } from 'vitest';
import { registerAllParts } from '../../../src/parts';
import { hasPart, registerPart } from '../../../src/parts/registry';
import { PlacementFactory } from '../../../src/parts/placements';
import { Simulation } from '../../../src/engine/simulation';
import { conveyor } from '../../../src/parts/defs/conveyor';

registerAllParts();
if (!hasPart('conveyor')) registerPart(conveyor);

const WORLD = { width: 960, height: 600, gravity: { x: 0, y: 1 } };

// Conveyor is 140×24 at (480,300); basketball radius 22 rests at y ≈ 300-12-22.
const BELT_X = 480;
const BELT_Y = 300;
const REST_Y = BELT_Y - 12 - 22;

function run(steps: number, sim: Simulation): void {
  for (let i = 0; i < steps; i++) sim.step();
}

describe('conveyor belt behavior', () => {
  it('carries a resting basketball to the right (direction right, speed 3)', () => {
    const f = new PlacementFactory();
    const sim = new Simulation(WORLD, [
      f.make('conveyor', BELT_X, BELT_Y, { options: { direction: 'right', speed: 3 } }),
      f.make('basketball', BELT_X, REST_Y, { tag: 'ball' }),
    ]);
    const ball = sim.runtimeById('ball')!.bodies[0];
    run(180, sim);
    expect(ball.position.x).toBeGreaterThan(BELT_X + 40);
    sim.destroy();
  });

  it('carries a resting basketball to the left (direction left)', () => {
    const f = new PlacementFactory();
    const sim = new Simulation(WORLD, [
      f.make('conveyor', BELT_X, BELT_Y, { options: { direction: 'left', speed: 3 } }),
      f.make('basketball', BELT_X, REST_Y, { tag: 'ball' }),
    ]);
    const ball = sim.runtimeById('ball')!.bodies[0];
    run(180, sim);
    expect(ball.position.x).toBeLessThan(BELT_X - 40);
    sim.destroy();
  });

  it('carries a ball that is dropped onto it from slightly above', () => {
    const f = new PlacementFactory();
    const sim = new Simulation(WORLD, [
      f.make('conveyor', BELT_X, BELT_Y, { options: { direction: 'right', speed: 3 } }),
      f.make('basketball', BELT_X, REST_Y - 10, { tag: 'ball' }),
    ]);
    const ball = sim.runtimeById('ball')!.bodies[0];
    run(240, sim);
    expect(ball.position.x).toBeGreaterThan(BELT_X + 40);
    sim.destroy();
  });

  it('control: a ball resting on a plain wall does not drift', () => {
    const f = new PlacementFactory();
    const sim = new Simulation(WORLD, [
      f.make('wall', BELT_X, BELT_Y),
      // Wall is 100×26, so the ball rests at y ≈ 300-13-22.
      f.make('basketball', BELT_X, BELT_Y - 13 - 22, { tag: 'ball' }),
    ]);
    const ball = sim.runtimeById('ball')!.bodies[0];
    run(180, sim);
    expect(Math.abs(ball.position.x - BELT_X)).toBeLessThan(2);
    sim.destroy();
  });
});
