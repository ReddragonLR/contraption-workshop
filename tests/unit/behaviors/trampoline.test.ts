import Matter from 'matter-js';
import { describe, expect, it } from 'vitest';
import { registerAllParts } from '../../../src/parts';
import { hasPart, registerPart } from '../../../src/parts/registry';
import { trampoline } from '../../../src/parts/defs/trampoline';
import { PlacementFactory } from '../../../src/parts/placements';
import { Simulation } from '../../../src/engine/simulation';

registerAllParts();
if (!hasPart('trampoline')) registerPart(trampoline);

function dropScene(surfaceId: 'trampoline' | 'wall'): Simulation {
  const f = new PlacementFactory();
  const placements = [
    f.make(surfaceId, 480, 520),
    f.make('basketball', 480, 200, { tag: 'ball' }),
  ];
  return new Simulation({ width: 960, height: 600, gravity: { x: 0, y: 1 } }, placements);
}

/** Highest point (min y) the ball reaches after it first rebounds upward. */
function reboundTopY(sim: Simulation, steps: number): number {
  const ball = sim.runtimeById('ball')!.bodies[0];
  let bounced = false;
  let minY = Infinity;
  for (let i = 0; i < steps; i++) {
    sim.step();
    if (!bounced && ball.velocity.y < -0.5) bounced = true;
    if (bounced) minY = Math.min(minY, ball.position.y);
  }
  expect(bounced).toBe(true);
  return minY;
}

describe('trampoline behavior', () => {
  it('rebounds a dropped basketball much higher than a brick wall control', () => {
    const tramp = dropScene('trampoline');
    const trampTop = reboundTopY(tramp, 240);
    tramp.destroy();

    const control = dropScene('wall');
    const controlTop = reboundTopY(control, 240);
    control.destroy();

    expect(trampTop).toBeLessThan(330);
    expect(controlTop).toBeGreaterThan(380);
    expect(trampTop).toBeLessThan(controlTop);
  });

  it('caps exit speed at 16 px/step across 2000 steps of repeated bounces', () => {
    const sim = dropScene('trampoline');
    const ball = sim.runtimeById('ball')!.bodies[0];
    let bounces = 0;
    sim.on('bounce', () => bounces++);
    let maxSpeed = 0;
    for (let i = 0; i < 2000; i++) {
      sim.step();
      const speed = Math.hypot(ball.velocity.x, ball.velocity.y);
      maxSpeed = Math.max(maxSpeed, speed);
    }
    expect(maxSpeed).toBeLessThanOrEqual(16.01);
    // The kick must keep it bouncing fast enough that the cap is actually
    // exercised, not merely never approached.
    expect(maxSpeed).toBeGreaterThan(14);
    expect(bounces).toBeGreaterThan(5);
    sim.destroy();
  });

  it('caps the launch even when struck faster than the cap allows', () => {
    const f = new PlacementFactory();
    const sim = new Simulation({ width: 960, height: 600, gravity: { x: 0, y: 1 } }, [
      f.make('trampoline', 480, 520),
      f.make('basketball', 440, 470, { tag: 'ball' }),
    ]);
    const ball = sim.runtimeById('ball')!.bodies[0];
    // Slam the bed diagonally: the low-friction bed keeps the tangential
    // speed, so restitution + kick would exit at ~16.7 px/step without the cap.
    Matter.Body.setVelocity(ball, { x: 14, y: 8 });
    let bounced = false;
    let maxExit = 0;
    for (let i = 0; i < 120; i++) {
      sim.step();
      if (!bounced && ball.velocity.y < -0.5) bounced = true;
      // Sample only while ascending — the capped launch, not later free fall.
      if (bounced && ball.velocity.y < 0) {
        maxExit = Math.max(maxExit, Math.hypot(ball.velocity.x, ball.velocity.y));
      }
    }
    expect(bounced).toBe(true);
    expect(maxExit).toBeLessThanOrEqual(16.01);
    expect(maxExit).toBeGreaterThan(15);
    sim.destroy();
  });

  it('is deterministic: identical snapshot hashes across rebuilds', () => {
    const run = (): string => {
      const sim = dropScene('trampoline');
      for (let i = 0; i < 600; i++) sim.step();
      const hash = sim.snapshotHash();
      sim.destroy();
      return hash;
    };
    expect(run()).toBe(run());
  });
});
