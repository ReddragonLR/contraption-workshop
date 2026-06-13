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

/**
 * A scene exercising every force-applying step hook — fan (applyForce),
 * conveyor (setVelocity on contact), balloon (buoyancy), trampoline (kick),
 * seesaw (pivot constraint), rope-over-pulley (positional solver), and a
 * powered button. These are exactly the parts where nondeterminism could
 * hide, so the hash assertion must cover them (review hardening, PRD §6).
 */
function buildActiveScene(): Simulation {
  const f = new PlacementFactory();
  const placements = [
    f.make('fan', 120, 520, { options: { startsOn: true } }),
    f.make('conveyor', 470, 330, { options: { direction: 'right', speed: 4 } }),
    f.make('balloon', 300, 470, { tag: 'balloon-a' }),
    f.make('trampoline', 700, 560),
    f.make('seesaw', 500, 200),
    f.make('button', 760, 586, { options: { powers: 'dev-1' } }),
    f.make('wall', 250, 200, { tag: 'anchor', rotation: 90 }),
    f.make('pulley', 350, 120, { tag: 'pulley-a' }),
    f.make('basketball', 240, 60),
    f.make('bowling-ball', 520, 40),
    f.make('tennis-ball', 700, 60),
    f.make('rope', 300, 150, {
      tag: 'rope-a',
      link: {
        a: { ref: 'balloon-a', anchorId: 'knot' },
        b: { ref: 'anchor', anchorId: 'center' },
        via: ['pulley-a'],
      },
    }),
  ];
  return new Simulation({ width: 960, height: 600, gravity: { x: 0, y: 1 } }, placements);
}

function runHash(steps: number, build: () => Simulation = buildScene): string {
  const sim = build();
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

  it('is deterministic for force-applying parts (fan/conveyor/balloon/rope/seesaw/trampoline/button)', () => {
    const a = runHash(600, buildActiveScene);
    const b = runHash(600, buildActiveScene);
    const c = runHash(600, buildActiveScene);
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
