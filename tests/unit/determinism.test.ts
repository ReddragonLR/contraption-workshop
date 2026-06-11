import { describe, expect, it } from 'vitest';
import { registerAllParts } from '../../src/parts';
import { PlacementFactory } from '../../src/parts/placements';
import { Simulation } from '../../src/engine/simulation';

registerAllParts();

function buildScene(): Simulation {
  const f = new PlacementFactory();
  const placements = [
    f.make('ramp', 300, 300, { rotation: 15 }),
    f.make('ramp', 620, 420, { rotation: -20 }),
    f.make('wall', 480, 560),
    f.make('bucket', 840, 540),
    f.make('basketball', 240, 80, { tag: 'ball-a' }),
    f.make('bowling-ball', 320, 40),
    f.make('tennis-ball', 600, 100),
  ];
  return new Simulation({ width: 960, height: 600, gravity: { x: 0, y: 1 } }, placements);
}

function runHash(steps: number): string {
  const sim = buildScene();
  for (let i = 0; i < steps; i++) sim.step();
  const hash = sim.snapshotHash();
  sim.destroy();
  return hash;
}

describe('determinism (PRD §6)', () => {
  it('produces identical world state hashes across rebuilds after 600 steps', () => {
    const a = runHash(600);
    const b = runHash(600);
    const c = runHash(600);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('actually simulates something (bodies move from their spawn points)', () => {
    const sim = buildScene();
    const ball = sim.runtimeById('ball-a')!.bodies[0];
    const y0 = ball.position.y;
    for (let i = 0; i < 120; i++) sim.step();
    expect(ball.position.y).toBeGreaterThan(y0 + 50);
    sim.destroy();
  });
});
