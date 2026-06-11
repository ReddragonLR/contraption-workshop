import { describe, expect, it } from 'vitest';
import { registerAllParts } from '../../../src/parts';
import { PlacementFactory } from '../../../src/parts/placements';
import { Simulation } from '../../../src/engine/simulation';

registerAllParts();

const WORLD = { width: 960, height: 600, gravity: { x: 0, y: 1 } };

/**
 * Heavy weight + rope + pulley lifts a light object (PRD §7.3).
 * A bowling ball and a tennis ball hang from opposite ends of a rope laid
 * over a pulley; the bowling ball falls and yanks the tennis ball upward.
 */
function buildPulleyRig() {
  const f = new PlacementFactory();
  const placements = [
    f.make('pulley', 450, 120, { tag: 'pulley-1' }),
    f.make('bowling-ball', 340, 420, { tag: 'weight' }),
    f.make('tennis-ball', 560, 480, { tag: 'cargo' }),
    f.make('rope', 450, 110, {
      tag: 'rope-1',
      link: {
        a: { ref: 'weight', anchorId: 'center' },
        b: { ref: 'cargo', anchorId: 'center' },
        via: ['pulley-1'],
      },
    }),
  ];
  return new Simulation(WORLD, placements);
}

describe('rope + pulley (PRD §7.1, §7.3)', () => {
  it('routes over the pulley with the full path length budgeted', () => {
    const sim = buildPulleyRig();
    const rope = sim.runtimeById('rope-1')!;
    const state = rope.state as { length: number; crowns: unknown[] };
    expect(state.crowns).toHaveLength(1);
    // |weight→crown| + |crown→cargo| at spawn ≈ 320 + 398.
    expect(state.length).toBeGreaterThan(650);
    expect(state.length).toBeLessThan(780);
    sim.destroy();
  });

  it('a falling weight over a pulley lifts the connected object', () => {
    const sim = buildPulleyRig();
    const cargo = sim.runtimeById('cargo')!.bodies[0];
    const weight = sim.runtimeById('weight')!.bodies[0];
    const cargoY0 = cargo.position.y;
    let cargoMinY = cargoY0;
    for (let i = 0; i < 600; i++) {
      sim.step();
      cargoMinY = Math.min(cargoMinY, cargo.position.y);
    }
    expect(weight.position.y).toBeGreaterThan(300); // the weight fell
    expect(cargoMinY).toBeLessThan(cargoY0 - 40); // the cargo was hoisted
    sim.destroy();
  });

  it('severing the rope releases the tension', () => {
    const sim = buildPulleyRig();
    const cargo = sim.runtimeById('cargo')!.bodies[0];
    let cutEvent: unknown = null;
    sim.on('rope-cut', (tag) => {
      cutEvent = tag;
    });
    for (let i = 0; i < 240; i++) sim.step(); // let the weight hoist the cargo
    expect(sim.cutRope('rope-1')).toBe(true);
    expect(cutEvent).toBe('rope-1');
    expect(sim.cutRope('rope-1')).toBe(false); // already severed
    const yAfterCut = cargo.position.y;
    for (let i = 0; i < 300; i++) sim.step();
    // Freed from the rope, the cargo falls back down.
    expect(cargo.position.y).toBeGreaterThan(yAfterCut + 100);
    sim.destroy();
  });
});
