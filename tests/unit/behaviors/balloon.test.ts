import Matter from 'matter-js';
import { describe, expect, it } from 'vitest';
import { registerAllParts } from '../../../src/parts';
import { hasPart, registerPart } from '../../../src/parts/registry';
import { balloon, popBalloon } from '../../../src/parts/defs/balloon';
import { PlacementFactory } from '../../../src/parts/placements';
import { Simulation } from '../../../src/engine/simulation';

registerAllParts();
if (!hasPart('balloon')) registerPart(balloon);

function buildSim(partId: string): Simulation {
  const f = new PlacementFactory();
  const placements = [f.make(partId, 480, 400, { tag: 'subject' })];
  return new Simulation({ width: 960, height: 600, gravity: { x: 0, y: 1 } }, placements);
}

describe('balloon', () => {
  it('rises: y decreases by more than 120 within 150 steps', () => {
    const sim = buildSim('balloon');
    const body = sim.runtimeById('subject')!.bodies[0];
    const y0 = body.position.y;
    for (let i = 0; i < 150; i++) sim.step();
    expect(y0 - body.position.y).toBeGreaterThan(120);
    sim.destroy();
  });

  it('reaches and holds near the ceiling after 600 steps', () => {
    const sim = buildSim('balloon');
    const body = sim.runtimeById('subject')!.bodies[0];
    for (let i = 0; i < 600; i++) sim.step();
    expect(body.position.y).toBeLessThan(120);
    sim.destroy();
  });

  it('popBalloon removes the body from the world and emits balloon-pop with the tag', () => {
    const sim = buildSim('balloon');
    const events: unknown[] = [];
    sim.on('balloon-pop', (payload) => events.push(payload));
    const rt = sim.runtimeById('subject')!;
    const body = rt.bodies[0];
    expect(Matter.Composite.allBodies(sim.world)).toContain(body);

    expect(popBalloon(rt, sim)).toBe(true);
    expect(Matter.Composite.allBodies(sim.world)).not.toContain(body);
    expect(events).toEqual(['subject']);

    // Already popped: no-op, no second event.
    expect(popBalloon(rt, sim)).toBe(false);
    expect(events).toEqual(['subject']);
    sim.destroy();
  });

  it('control: a basketball at the same spot falls', () => {
    const sim = buildSim('basketball');
    const body = sim.runtimeById('subject')!.bodies[0];
    const y0 = body.position.y;
    for (let i = 0; i < 150; i++) sim.step();
    expect(body.position.y).toBeGreaterThan(y0 + 100);
    sim.destroy();
  });
});
